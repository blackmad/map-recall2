// Street-level visibility (lane F4, #320, 2026-11-09): a building never fully disappears at street level.
//
// User, 2026-11-05 (#213 row B): "buildings disappearing on bump"; 2026-11-09 (#320, Free Ride on ef73a29): "buildings
// still disappearing when I smash into them sometimes". E1 (#214) fixed the rider cover under `?engine=own` only. Two
// paths still make a struck building vanish (inventory in docs/handoffs/lane-f4-building-vanish-20261109.md):
//
//  1. The rider cover under the default engine (vector-map.js `_updateRiderCover`) still runs the point-only rule
//     (`coveringBuilding`): a bump that puts the rider's point inside a ground-based footprint for COVER_ENTER_S hides
//     that house outright (`ThreeBuildings.setHidden('cover')`). The route-aware decision below is shared by both
//     engines, and the cover draws ghosted (a screen door), never hidden.
//  2. The chase camera inside a building. Every building chunk draws FrontSide, so from inside a closed prism none of
//     its faces draw: the whole house vanishes, not just the wall in front of the rider. After a smash the rider turns
//     away from the wall and the camera, behind the rider, swings into the house; the clearance may lower the pitch
//     only CLEARANCE_MAX_DROP (10°) and only re-checks every 8 m / 8° / 1 s. The eye test below runs every frame and
//     pulls the camera in toward the rider (then, if that is not enough, lowers the pitch past the cap) before the
//     near plane reaches a wall.
//
// Pure: callers hand in their footprints and an `eyeAt(pitch, fraction)` camera model (engine/cameraMap.ts
// EngineCamera, or MapLibre's transform).

import { coveringBuildingOnPath, footprintContains, roadAheadPoints, routeAheadPoints, type FootprintFeature, type LngLat } from '../coveredPassage';
import { lngLatToWorld, worldToLngLat, type LoaderFrame } from './gameCamera';
import { featureBox, residentIndex, RESIDENT_INDEX_MIN, RESIDENT_GRID_DEG, residentGridKey } from './cameraClearance';

/** No fade of a building near the camera goes below this alpha (the brief's floor). */
export const STREET_MIN_ALPHA = 0.5;
/** Metres: buildings within this of the rider must draw pixels in every frame (the gate's radius). */
export const STREET_LEVEL_RADIUS_M = 20;
/** Metres of clearance kept between the eye and a wall on top of the near plane's half-diagonal. */
export const EYE_WALL_MARGIN_M = 0.5;
/** Metres above a footprint's top that still count as inside it (roof edges, ridge rounding). */
export const EYE_TOP_MARGIN_M = 0.75;
/** The camera is never pulled in closer than this fraction of its distance; past it the pitch drops instead. */
export const PULL_IN_MIN_FRACTION = 0.3;
/** Step of the pull-in search (fraction of the camera distance). */
export const PULL_IN_STEP = 0.05;
/** Degrees per step when the pitch has to drop past the clearance cap. */
export const PITCH_ESCAPE_STEP_DEG = 4;
/** Per frame: how fast a released pull-in eases back out (in is immediate). */
export const PULL_OUT_RATE = 0.06;

export type Eye = { lngLat: LngLat; altitude: number };

const M_LAT = 111_320;
const mLng = (lat: number) => 111_320 * Math.cos(lat * Math.PI / 180);

/** A footprint's top in metres: the ridge when known (a roof prism is closed too), else the eaves, else 5 m. */
export function footprintTopM(properties: Record<string, unknown> | null | undefined): number {
  const p = properties || {};
  const vals = [p.height, p.roofEavesHeightM, p.render_height].map(Number).filter(Number.isFinite);
  return vals.length ? Math.max(...vals) : 5;
}

/** Footprints whose box comes within `radiusM` of `point` (the resident grid when the list is long). */
export function footprintsNear<T extends FootprintFeature>(point: LngLat, radiusM: number, resident: readonly T[], indexMin = RESIDENT_INDEX_MIN): T[] {
  const dLng = radiusM / mLng(point[1]), dLat = radiusM / M_LAT;
  const w = point[0] - dLng, e = point[0] + dLng, s = point[1] - dLat, n = point[1] + dLat;
  const hits = (f: T) => { const b = featureBox(f); return !!b && b[0] <= e && b[2] >= w && b[1] <= n && b[3] >= s; };
  if (resident.length < indexMin) return resident.filter(hits);
  const index = residentIndex(resident), seen = new Set<number>();
  for (let i = Math.floor(w / RESIDENT_GRID_DEG); i <= Math.floor(e / RESIDENT_GRID_DEG); i++) {
    for (let j = Math.floor(s / RESIDENT_GRID_DEG); j <= Math.floor(n / RESIDENT_GRID_DEG); j++) for (const k of index.get(residentGridKey(i, j)) ?? []) seen.add(k);
  }
  return [...seen].sort((a, b) => a - b).map(k => resident[k]).filter(hits);
}

/**
 * The footprint the eye is inside: the eye point, or any of eight points `radiusM` around it (the near plane's
 * reach), inside a footprint whose top (+EYE_TOP_MARGIN_M) is above the eye. Null when the eye is clear.
 */
export function eyeInsideBuilding<T extends FootprintFeature>(eye: Eye, resident: readonly T[], radiusM: number): T | null {
  if (!Number.isFinite(eye.altitude)) return null;
  const near = footprintsNear(eye.lngLat, radiusM + 1, resident).filter(f => eye.altitude < footprintTopM(f.properties) + EYE_TOP_MARGIN_M);
  if (!near.length) return null;
  const kx = mLng(eye.lngLat[1]);
  const probes: LngLat[] = [eye.lngLat];
  for (let k = 0; k < 8; k++) {
    const a = k * Math.PI / 4;
    probes.push([eye.lngLat[0] + Math.cos(a) * radiusM / kx, eye.lngLat[1] + Math.sin(a) * radiusM / M_LAT]);
  }
  for (const f of near) if (probes.some(p => footprintContains(f.geometry, p))) return f;
  return null;
}

/** The near plane's half-diagonal in metres (perspective `near`, vertical `fovDeg`, `aspect` width/height). */
export function nearPlaneReachM(nearM: number, fovDeg: number, aspect: number): number {
  const halfH = nearM * Math.tan(fovDeg * Math.PI / 360);
  return Math.hypot(halfH, halfH * aspect);
}

export interface EyeClearance {
  /** The pitch to draw (≤ the requested one). */
  pitch: number;
  /** Fraction of the camera distance to keep (1 = no pull-in). Zoom in by log2(1 / fraction). */
  fraction: number;
  /** The footprint the requested eye was inside, or null. */
  insideId: string | null;
  /** Still inside after every escape (the rider is deep in a footprint): callers ghost it rather than lose it. */
  stuck: boolean;
}

/**
 * Keep the eye out of every building: at `pitch` and full distance if clear; else pull the camera toward the subject
 * along its sightline (fraction down to PULL_IN_MIN_FRACTION); else, at the least fraction tried, lower the pitch in
 * PITCH_ESCAPE_STEP_DEG steps down to `minPitch` (overhead) until the eye clears.
 * `eyeAt(pitch, fraction)` is the camera for the view at that pitch with its distance scaled by `fraction`.
 */
export function clearEye<T extends FootprintFeature>(
  pitch: number,
  eyeAt: (pitch: number, fraction: number) => Eye | null,
  resident: readonly T[],
  reachM: (fraction: number) => number,
  { minFraction = PULL_IN_MIN_FRACTION, step = PULL_IN_STEP, minPitch = 0 }: { minFraction?: number; step?: number; minPitch?: number } = {},
): EyeClearance {
  const idOf = (f: T | null) => {
    const p = f?.properties as Record<string, unknown> | null | undefined;
    return f ? String(p?.id ?? (f as { id?: unknown }).id ?? '') || null : null;
  };
  const first = eyeAt(pitch, 1);
  const blocker = first ? eyeInsideBuilding(first, resident, reachM(1)) : null;
  if (!blocker) return { pitch, fraction: 1, insideId: null, stuck: false };
  for (let f = 1 - step; f >= minFraction - 1e-9; f -= step) {
    const eye = eyeAt(pitch, f);
    if (eye && !eyeInsideBuilding(eye, resident, reachM(f))) return { pitch, fraction: f, insideId: idOf(blocker), stuck: false };
  }
  for (let p = pitch - PITCH_ESCAPE_STEP_DEG; p >= minPitch - 1e-9; p -= PITCH_ESCAPE_STEP_DEG) {
    const eye = eyeAt(Math.max(minPitch, p), minFraction);
    if (eye && !eyeInsideBuilding(eye, resident, reachM(minFraction))) return { pitch: Math.max(minPitch, p), fraction: minFraction, insideId: idOf(blocker), stuck: false };
  }
  return { pitch: minPitch, fraction: minFraction, insideId: idOf(blocker), stuck: true };
}

/**
 * The drawn pull-in: a tighter fraction applies at once (the camera must not spend a frame in a wall); a released one
 * eases back out at PULL_OUT_RATE per frame, re-checked by the caller so the ease never re-enters the wall.
 */
export function easePullIn(current: number | null, target: number, rate = PULL_OUT_RATE): number {
  if (current == null || target <= current) return target;
  const next = current + (target - current) * rate;
  return target - next < 0.002 ? target : next;
}

export interface CoverAheadInput {
  rider: LngLat;
  /** The route as lng/lat, when one is set. */
  route: readonly LngLat[] | null | undefined;
  /** The road underfoot (world frame: x east, y south; angle radians), from `track.getNearestRoad`, or null. */
  road: { lngLat: LngLat; angle: number } | null;
  /** The bike's world heading (radians), or null. */
  riderAngle: number | null;
}

/**
 * The path ahead the rider cover tests (coveredPassage.ts `coveringBuildingOnPath`): the route's next 15 m when the
 * rider is on it, else the road underfoot along the way the bike faces, else nothing (no cover: a bump never counts).
 * Shared by both engines (ownWorldView `coverAhead` and vector-map.js `_updateRiderCover`).
 */
export function coverAheadPoints({ rider, route, road, riderAngle }: CoverAheadInput): LngLat[] {
  const onRoute = routeAheadPoints(route, rider);
  if (onRoute) return onRoute;
  if (!road || !Number.isFinite(road.angle)) return [];
  // World x east, y south: a world angle `a` is compass bearing a + π/2. Along the road, the way the bike faces.
  const forward = riderAngle == null || Math.cos(road.angle - riderAngle) >= 0 ? road.angle : road.angle + Math.PI;
  return roadAheadPoints(road.lngLat, forward + Math.PI / 2);
}

/** The cover decision both engines run: route-aware, and only ever a ghost. */
export function streetCover<T extends FootprintFeature>(features: readonly T[], input: CoverAheadInput): T | null {
  return coveringBuildingOnPath(features, input.rider, coverAheadPoints(input));
}


export type NearestRoadTrack = { getNearestRoad?(x: number, y: number, angle?: number | null): { x: number; y: number; angle: number } | null };

/**
 * The cover decision from the game's world frame (vector-map.js has the track, the loader and the bike's world angle,
 * not lng/lat roads): the road underfoot from `track.getNearestRoad`, then `streetCover`.
 */
export function streetCoverInWorld<T extends FootprintFeature>(
  features: readonly T[],
  { rider, route, track, loader, riderAngle }: { rider: LngLat; route: readonly LngLat[] | null | undefined; track: NearestRoadTrack | null | undefined; loader: LoaderFrame | null | undefined; riderAngle: number | null | undefined },
): T | null {
  let road: CoverAheadInput['road'] = null;
  if (!routeAheadPoints(route, rider) && track?.getNearestRoad && loader && loader._lastCenterLat != null) {
    const w = lngLatToWorld(rider[0], rider[1], loader);
    const r = track.getNearestRoad(w.x, w.y, riderAngle ?? null);
    if (r && Number.isFinite(r.angle)) road = { lngLat: worldToLngLat(r.x, r.y, loader), angle: r.angle };
  }
  return streetCover(features, { rider, route, road, riderAngle: Number.isFinite(riderAngle) ? riderAngle! : null });
}
