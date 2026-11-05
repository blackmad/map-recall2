/**
 * Riding under a building: the Cuyperspassage under Amsterdam Centraal, the
 * Rijksmuseum passage, any covered cycle way. OSM maps the building over the
 * passage as a solid prism from the ground (Centraal's train shed is 9 m with
 * no min_height), so in the chase view the whole corridor, the route line and
 * the kerbs vanished under one beige slab. Only the bike's x-ray silhouette
 * showed, and the rider steered a 6 m tunnel blind (user report 2026-10-01,
 * "driving through this tunnel in centraal is really hard").
 *
 * The map asks which extrusions are drawn at the rider's screen point; this
 * module decides whether one of them actually covers the rider (its footprint
 * contains the rider and it comes down to the ground there), and holds that
 * decision with a little hysteresis so riding along a footprint's edge does
 * not flicker the city in and out.
 */

export type LngLat = readonly [number, number];
type Ring = ReadonlyArray<readonly number[]>;
export type FootprintGeometry =
  | { type: 'Polygon'; coordinates: ReadonlyArray<Ring> }
  | { type: 'MultiPolygon'; coordinates: ReadonlyArray<ReadonlyArray<Ring>> }
  | { type: string; coordinates?: unknown };
export type FootprintFeature = {
  geometry?: FootprintGeometry | null;
  properties?: Record<string, unknown> | null;
};

/** Metres: a building whose base is above this is a bridge or roof the rider passes under in the open, and is drawn floating anyway. */
export const COVER_MAX_BASE_M = 2.5;
/** Seconds covered before the buildings fade, and uncovered before they return. */
export const COVER_ENTER_S = 0.2;
export const COVER_LEAVE_S = 0.5;
/** Building opacity while the rider is under one. */
export const COVERED_BUILDING_OPACITY = 0.28;

function pointInRing(point: LngLat, ring: Ring): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i], b = ring[j];
    if (!a || !b || a.length < 2 || b.length < 2) continue;
    const crosses = (a[1] > point[1]) !== (b[1] > point[1]);
    if (crosses && point[0] < (b[0] - a[0]) * (point[1] - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
  }
  return inside;
}

export function footprintContains(geometry: FootprintGeometry | null | undefined, point: LngLat): boolean {
  if (!geometry) return false;
  const polygons = geometry.type === 'Polygon'
    ? [geometry.coordinates as ReadonlyArray<Ring>]
    : geometry.type === 'MultiPolygon'
      ? geometry.coordinates as ReadonlyArray<ReadonlyArray<Ring>>
      : [];
  return polygons.some(rings => Array.isArray(rings) && rings.length > 0
    && pointInRing(point, rings[0])
    && !rings.slice(1).some(hole => pointInRing(point, hole)));
}

const numberOf = (value: unknown): number | null => {
  const n = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  return Number.isFinite(n) ? n : null;
};

/** Base of an extrusion in metres, across the property names our sources use. */
export function extrusionBase(properties: Record<string, unknown> | null | undefined): number {
  const p = properties || {};
  return numberOf(p.minHeight) ?? numberOf(p.min_height) ?? numberOf(p.render_min_height) ?? 0;
}

/** The first feature whose footprint contains the rider and reaches down to the ground. */
export function coveringBuilding<T extends FootprintFeature>(
  features: readonly T[],
  rider: LngLat,
  maxBaseM = COVER_MAX_BASE_M,
): T | null {
  for (const feature of features) {
    if (extrusionBase(feature.properties) > maxBaseM) continue;
    if (footprintContains(feature.geometry, rider)) return feature;
  }
  return null;
}

export type CoverState = { covered: boolean; pendingSince: number | null };

export function initialCoverState(): CoverState {
  return { covered: false, pendingSince: null };
}

/**
 * Advance the held decision. `nowS` is a monotonic clock in seconds. Returns
 * the new state; `covered` only flips once the raw reading has disagreed with
 * it for COVER_ENTER_S (entering) or COVER_LEAVE_S (leaving).
 */
export function updateCoverState(state: CoverState, coveredNow: boolean, nowS: number): CoverState {
  if (coveredNow === state.covered) return { covered: state.covered, pendingSince: null };
  const since = state.pendingSince ?? nowS;
  const hold = coveredNow ? COVER_ENTER_S : COVER_LEAVE_S;
  if (nowS - since >= hold) return { covered: coveredNow, pendingSince: null };
  return { covered: state.covered, pendingSince: since };
}

// ---------------------------------------------------------------------------
// Route-aware cover (own engine, lane E1 2026-11-05, plan #213 item B)
//
// Under the own engine the cover query is the streamed city's exact footprint at the rider (`featuresAt`), not the
// rendered extrusion under the rider's screen point. Bumping into a house front puts the rider's point a little way
// inside that house's footprint, so the old rule covered the rider and the house the rider had just hit went away
// (user report 2026-11-05, "buildings vanish when I bump into them"). A passage is on the way the rider is going; a
// bump is not. So cover now also needs the rider to be well inside the footprint (COVER_MIN_DEPTH_M from its edge)
// and the path ahead (the next COVER_AHEAD_M of the route, or the heading point when there is no route near) to be
// inside the same footprint. `?coverRoute=0` restores the old rule.
// ---------------------------------------------------------------------------

/** Metres: the rider must be at least this far inside the footprint's edge (a bump stops short of it). */
export const COVER_MIN_DEPTH_M = 1.5;
/** Metres of the route (or the heading) ahead that are tested against the footprint. */
export const COVER_AHEAD_M = 15;
/** Metres between the samples along the path ahead. */
export const COVER_AHEAD_STEP_M = 3;
/** Metres: further than this from the route, the rider has left it and the heading answers instead. */
export const COVER_OFF_ROUTE_M = 25;

const M_PER_DEG_LAT = 110_540;
const mPerDegLng = (lat: number) => 111_320 * Math.cos(lat * Math.PI / 180);

export function coverRouteFlag(): boolean {
  const g = globalThis as { __canalRecallCoverRoute?: boolean | string; location?: { search?: string } };
  const asked = g.__canalRecallCoverRoute ?? new URLSearchParams(g.location?.search ?? '').get('coverRoute');
  return !(asked === false || asked === '0' || asked === 'false' || asked === 'off');
}

const polygonsOf = (geometry: FootprintGeometry | null | undefined): ReadonlyArray<ReadonlyArray<Ring>> =>
  !geometry ? [] : geometry.type === 'Polygon'
    ? [geometry.coordinates as ReadonlyArray<Ring>]
    : geometry.type === 'MultiPolygon' ? geometry.coordinates as ReadonlyArray<ReadonlyArray<Ring>> : [];

/** Metres from `point` to the nearest edge of the footprint that contains it (holes count as edges); 0 outside. */
export function insideDepthM(geometry: FootprintGeometry | null | undefined, point: LngLat): number {
  const kx = mPerDegLng(point[1]), ky = M_PER_DEG_LAT;
  for (const rings of polygonsOf(geometry)) {
    if (!Array.isArray(rings) || !rings.length || !pointInRing(point, rings[0]) || rings.slice(1).some(h => pointInRing(point, h))) continue;
    let best = Infinity;
    for (const ring of rings) for (let i = 1; i < ring.length; i++) {
      const a = ring[i - 1], b = ring[i];
      if (!a || !b || a.length < 2 || b.length < 2) continue;
      const ax = (a[0] - point[0]) * kx, ay = (a[1] - point[1]) * ky, bx = (b[0] - point[0]) * kx, by = (b[1] - point[1]) * ky;
      const dx = bx - ax, dy = by - ay, len2 = dx * dx + dy * dy;
      const t = len2 > 0 ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / len2)) : 0;
      best = Math.min(best, Math.hypot(ax + dx * t, ay + dy * t));
    }
    return Number.isFinite(best) ? best : 0;
  }
  return 0;
}

/**
 * Points along `route` (lng/lat) from the rider's nearest point on it to COVER_AHEAD_M further on, every
 * COVER_AHEAD_STEP_M; null when the route is missing or the rider is more than `offRouteM` from it.
 */
export function routeAheadPoints(route: readonly LngLat[] | null | undefined, rider: LngLat, aheadM = COVER_AHEAD_M, stepM = COVER_AHEAD_STEP_M, offRouteM = COVER_OFF_ROUTE_M): LngLat[] | null {
  if (!route || route.length < 2) return null;
  const kx = mPerDegLng(rider[1]), ky = M_PER_DEG_LAT;
  const xy = (p: LngLat) => [(p[0] - rider[0]) * kx, (p[1] - rider[1]) * ky] as const;
  let bestD = Infinity, bestI = -1, bestT = 0;
  for (let i = 1; i < route.length; i++) {
    const [ax, ay] = xy(route[i - 1]), [bx, by] = xy(route[i]);
    const dx = bx - ax, dy = by - ay, len2 = dx * dx + dy * dy;
    const t = len2 > 0 ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / len2)) : 0;
    const d = Math.hypot(ax + dx * t, ay + dy * t);
    if (d < bestD) { bestD = d; bestI = i; bestT = t; }
  }
  if (bestI < 0 || bestD > offRouteM) return null;
  const lerp = (a: LngLat, b: LngLat, t: number): LngLat => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  const out: LngLat[] = [lerp(route[bestI - 1], route[bestI], bestT)];
  let i = bestI, from = out[0], walked = 0, nextAt = stepM;
  while (i < route.length && nextAt <= aheadM + 1e-9) {
    const to = route[i];
    const [fx, fy] = xy(from), [tx, ty] = xy(to);
    const seg = Math.hypot(tx - fx, ty - fy);
    if (walked + seg >= nextAt && seg > 0) {
      const p = lerp(from, to, (nextAt - walked) / seg);
      out.push(p);
      walked = nextAt; from = p; nextAt += stepM;
      continue;
    }
    walked += seg; from = to; i++;
  }
  return out;
}

/** Points ahead of the rider along a compass bearing (radians, 0 north, clockwise), every COVER_AHEAD_STEP_M. */
export function headingAheadPoints(rider: LngLat, bearingRad: number, aheadM = COVER_AHEAD_M, stepM = COVER_AHEAD_STEP_M): LngLat[] {
  const kx = mPerDegLng(rider[1]), ky = M_PER_DEG_LAT;
  const out: LngLat[] = [];
  for (let d = stepM; d <= aheadM + 1e-9; d += stepM) out.push([rider[0] + Math.sin(bearingRad) * d / kx, rider[1] + Math.cos(bearingRad) * d / ky]);
  return out;
}

/**
 * The first ground-based feature that holds the rider at least `minDepthM` inside its edge and that the path
 * `ahead` (route or heading samples) also runs through. A rider who bumped a house front is a metre or so inside
 * it and the route runs on along the street outside: not covered.
 */
export function coveringBuildingOnPath<T extends FootprintFeature>(
  features: readonly T[],
  rider: LngLat,
  ahead: readonly LngLat[],
  { maxBaseM = COVER_MAX_BASE_M, minDepthM = COVER_MIN_DEPTH_M }: { maxBaseM?: number; minDepthM?: number } = {},
): T | null {
  for (const feature of features) {
    if (extrusionBase(feature.properties) > maxBaseM) continue;
    if (insideDepthM(feature.geometry, rider) < minDepthM) continue;
    if (ahead.some(p => footprintContains(feature.geometry, p))) return feature;
  }
  return null;
}
