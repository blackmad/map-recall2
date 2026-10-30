// Camera clearance (lifted from vector-map.js `_clearCameraFromBuildingFootprints`
// and its helpers, engine programme P0 freeze rule). A pitched camera sits
// behind the route centre; on a narrow street that physical camera can land
// inside a building. Lower the pitch (at most CLEARANCE_MAX_DROP, never below
// 17°) until the camera → rider sightline clears the resident measured
// footprints. The camera model is the caller's (`eyeAt(pitch)`: MapLibre's
// transform, or engine/cameraMap.ts), so both world views share the rule.

import { footprintContains, type FootprintFeature } from '../coveredPassage';

/** Degrees the guard may lower the pitch (a 17° floor read as the chase view switching to overhead). */
export const CLEARANCE_MAX_DROP = 10;
export const CLEARANCE_MIN_PITCH = 17;

type LngLat = readonly [number, number];
export type Box = readonly [number, number, number, number];

export interface ClearanceResult {
  constrained: boolean;
  requestedPitch: number;
  safePitch: number;
  cameraBefore: LngLat;
  cameraAfter: LngLat;
  altitudeBefore: number;
  altitudeAfter: number;
  center: LngLat;
  clear: boolean;
  blockingBuildingId: unknown;
}

const boxes = new WeakMap<object, Box | null>();

/** [west, south, east, north] of a footprint's outer rings, cached per feature object. */
export function featureBox(feature: FootprintFeature): Box | null {
  const cached = boxes.get(feature);
  if (cached !== undefined) return cached;
  const g = feature && feature.geometry as { type?: string; coordinates?: any } | null | undefined;
  const polygons = g && g.type === 'Polygon' ? [g.coordinates] : g && g.type === 'MultiPolygon' ? g.coordinates : [];
  let w = Infinity, s = Infinity, e = -Infinity, n = -Infinity;
  for (const rings of polygons || []) {
    const outer = Array.isArray(rings) && rings[0];
    if (!Array.isArray(outer)) continue;
    for (const v of outer) {
      if (!Array.isArray(v)) continue;
      if (v[0] < w) w = v[0]; if (v[0] > e) e = v[0];
      if (v[1] < s) s = v[1]; if (v[1] > n) n = v[1];
    }
  }
  const box: Box | null = Number.isFinite(w) ? [w, s, e, n] : null;
  boxes.set(feature, box);
  return box;
}

/** The first footprint at `point` whose top is above `altitude` (+0.75 m). */
export function blockingFeature<T extends FootprintFeature>(point: LngLat, altitude: number, features: readonly T[]): T | null {
  return features.find(feature => {
    const p = feature.properties || {};
    const top = Number(p.roofEavesHeightM ?? p.height ?? 5);
    return Number.isFinite(top) && altitude < top + 0.75 && footprintContains(feature.geometry, point);
  }) || null;
}

/**
 * Walk the sightline from the camera (`from`, `altitude` metres) down to the rider (`center`, ground) one metre at a
 * time; the last 2 m are ignored so rounding at a kerb cannot make the camera oscillate. Only footprints whose box
 * touches the line's box are tested (point-in-polygon over 20 000 residents per metre was a phone frame's largest cost).
 */
export function sightlineBlocker<T extends FootprintFeature>(from: LngLat, center: LngLat, altitude: number, resident: readonly T[]): T | null {
  const mLat = 111320, mLng = 111320 * Math.cos(center[1] * Math.PI / 180);
  const east = (center[0] - from[0]) * mLng, north = (center[1] - from[1]) * mLat;
  const distance = Math.hypot(east, north);
  if (!distance) return null;
  const west = Math.min(from[0], center[0]), eastEdge = Math.max(from[0], center[0]);
  const south = Math.min(from[1], center[1]), northEdge = Math.max(from[1], center[1]);
  const candidates: T[] = [];
  for (const f of resident) {
    const b = featureBox(f);
    if (b && b[0] <= eastEdge && b[2] >= west && b[1] <= northEdge && b[3] >= south) candidates.push(f);
  }
  if (!candidates.length) return null;
  for (let travelled = 1; travelled < distance - 2; travelled += 1) {
    const t = travelled / distance;
    const point: LngLat = [from[0] + east * t / mLng, from[1] + north * t / mLat];
    const here = candidates.filter(f => { const b = featureBox(f)!; return point[0] >= b[0] && point[0] <= b[2] && point[1] >= b[1] && point[1] <= b[3]; });
    if (!here.length) continue;
    const blocker = blockingFeature(point, altitude * (1 - t), here);
    if (blocker) return blocker;
  }
  return null;
}

/**
 * Lower `pitch` in 4° steps until the sightline clears (or the floor is reached). `eyeAt(pitch)` returns the camera
 * position for the requested view at that pitch; the route centre stays fixed, so the canvas overlays stay registered.
 */
export function clearCamera<T extends FootprintFeature>(
  pitch: number, center: LngLat, subject: LngLat,
  eyeAt: (pitch: number) => { lngLat: LngLat; altitude: number } | null,
  resident: () => readonly T[],
): ClearanceResult | null {
  const first = eyeAt(pitch);
  if (!first || !Number.isFinite(first.altitude)) return null;
  const features = resident();
  let camera = first.lngLat, altitude = first.altitude;
  let blocker = sightlineBlocker(camera, subject, altitude, features);
  let safePitch = pitch;
  const floor = Math.max(CLEARANCE_MIN_PITCH, pitch - CLEARANCE_MAX_DROP);
  while (blocker && safePitch > floor) {
    safePitch = Math.max(floor, safePitch - 4);
    const next = eyeAt(safePitch);
    if (!next) break;
    camera = next.lngLat; altitude = next.altitude;
    blocker = sightlineBlocker(camera, subject, altitude, features);
  }
  const p = blocker && (blocker as FootprintFeature).properties;
  return {
    constrained: safePitch !== pitch, requestedPitch: pitch, safePitch,
    cameraBefore: first.lngLat, cameraAfter: camera, altitudeBefore: first.altitude, altitudeAfter: altitude,
    center, clear: !blocker, blockingBuildingId: (p && p.id) || null,
  };
}
