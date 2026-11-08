// The surprise picker's draw: a destination near a start, weighted by
// notability. Split out of routeSelection.ts (which re-exports all of it) so
// light pages can draw the same pair without the route pool's catalogues:
// today's ride on the landing page (dailyRide.ts) uses it.

import {
  notabilityScore,
  notabilityWeight,
  type PoiNotability,
} from './poiNotability';

export interface RoutePoi extends PoiNotability {
  id: string;
  name: string;
  lat: number;
  lng: number;
  landmarkId?: string;
}

/**
 * Both ends of a route must sit inside the single OSM window fetched around
 * their midpoint, so candidates are capped by distance from each other —
 * otherwise a Weesp fort could be paired with Westerpark and half the route
 * would fall outside the loaded network.
 */
export const ROUTE_POI_MAX_PAIR_KM = 6;

/** Destinations closer than this feel like a stub trip. */
export const HOME_MIN_TRIP_KM = 0.2;
/**
 * A surprise destination closer than this is re-drawn: Micropia and Artis are 45 m apart, both snap to Plantage
 * Kerklaan, and the ride ended "Start and finish are too close" (MIN_START_FINISH_DIST, 67 m) instead of starting.
 */
export const SURPRISE_MIN_PAIR_KM = HOME_MIN_TRIP_KM;

export function kmBetween(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const latKm = (a.lat - b.lat) * 111.32;
  const lngKm = (a.lng - b.lng) * 111.32 * Math.cos(a.lat * Math.PI / 180);
  return Math.hypot(latKm, lngKm);
}

/** Injected so route generation is deterministic under test. */
export type ChooseIndex = (count: number) => number;

export const randomIndex: ChooseIndex = count => Math.floor(Math.random() * count);

/** Injected so weighted picks stay deterministic under test. */
export type ChooseUnit = () => number;

export const randomUnit: ChooseUnit = () => Math.random();

export function pickWeighted<T>(
  entries: readonly { item: T; weight: number }[],
  chooseUnit: ChooseUnit,
): T | null {
  const positive = entries.filter(entry => entry.weight > 0);
  if (positive.length === 0) return null;
  const total = positive.reduce((sum, entry) => sum + entry.weight, 0);
  let tick = chooseUnit() * total;
  for (const entry of positive) {
    tick -= entry.weight;
    if (tick <= 0) return entry.item;
  }
  return positive[positive.length - 1]?.item ?? null;
}

/**
 * A destination for a trip starting at `from`.
 *
 * Prefers somewhere within pairing range, but falls back to the whole pool
 * rather than returning nothing: a start with no near neighbour should still
 * produce a trip, and the loader's own window check is what ultimately rejects
 * an impossible pair.
 *
 * Weighted by notability so the more recognisable landmarks come up more
 * often, with an exponential temperature that keeps some variety in the mix.
 * A bare POI with no enrichment still gets a stable baseline weight, so this
 * degrades to a uniform pick.
 */
export function pickDestinationNear(
  pois: readonly RoutePoi[],
  from: { id: string; lat: number; lng: number },
  chooseUnit: ChooseUnit = randomUnit,
  alsoExcludeId: string | null = null,
): RoutePoi | null {
  const candidates = pois.filter(poi => poi.id !== from.id && poi.id !== alsoExcludeId);
  if (candidates.length === 0) return null;
  const inRange = candidates.filter(poi => kmBetween(poi, from) <= ROUTE_POI_MAX_PAIR_KM);
  const pool = inRange.length > 0 ? inRange : candidates;
  const scored = pool.map(poi => ({
    item: poi,
    weight: notabilityWeight(notabilityScore(poi)),
  }));
  const pick = pickWeighted(scored, chooseUnit);
  // A neighbour is drawn again from the places far enough away. A pick that is far enough is returned as it was,
  // after the same draws, so every ride that started before starts the same.
  if (!pick || kmBetween(pick, from) >= SURPRISE_MIN_PAIR_KM) return pick;
  const apart = scored.filter(entry => kmBetween(entry.item, from) >= SURPRISE_MIN_PAIR_KM);
  return apart.length ? pickWeighted(apart, chooseUnit) ?? pick : pick;
}
