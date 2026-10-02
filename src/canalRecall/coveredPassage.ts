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
