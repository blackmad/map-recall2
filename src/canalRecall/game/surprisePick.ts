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

/** A practised place near a destination (routeSelection.MasterySample). */
export interface FameSample {
  lat: number;
  lng: number;
  /** 0..1 familiarity at that place. */
  mastery: number;
}

/**
 * The well-known tier: notability at or above this. Measured 2026-11-13 on
 * the deduplicated Amsterdam pool: about 60 places in range of the centre
 * (Rijksmuseum 20, Westerkerk 18.4 …); the tail below holds neighbourhood
 * churches and mosques (Meerpadkerk 5.3, El Tawheed 3.8) that a new rider
 * should not be sent to. scripts/audit-destination-pool.ts re-measures it.
 */
export const FAMOUS_TIER_SCORE = 8;
/** Weight multiplier on a tail destination for a rider new to the area. */
export const TAIL_FLOOR = 0.02;
/**
 * Famous candidates a draw needs before the tail is held at TAIL_FLOOR. With
 * fewer (a home ring in Oud-West, a review corridor in Noord) the floor rises
 * towards 1, so one famous place does not become every ride.
 */
export const FAMOUS_ENOUGH = 8;

/** The tail floor for a draw over `candidates`. */
export function tailFloorFor(candidates: readonly RoutePoi[]): number {
  let famous = 0;
  for (const poi of candidates) if (notabilityScore(poi) >= FAMOUS_TIER_SCORE) famous += 1;
  return Math.max(TAIL_FLOOR, 1 - famous / FAMOUS_ENOUGH);
}
/** Practised names within this of the ride's start open the tail. */
export const TAIL_AREA_KM = 2;
/** Mastered names round the start for the tail to weigh as much as the famous tier. */
export const TAIL_OPEN_KNOWN = 40;
/** Mastery at which a sample counts (routeSelection.HOME_RADIUS_MASTERED_MIN). */
export const TAIL_MASTERED_MIN = 0.45;

/**
 * 0 (new to the area round `origin`) .. 1 (knows it well). Measured round the
 * ride's start rather than each destination, so it does not fight the
 * pickers' own novelty bias towards unfamiliar corridors.
 */
export function tailOpenness(origin: { lat: number; lng: number } | null | undefined, samples: readonly FameSample[]): number {
  if (!origin || !samples.length) return 0;
  let known = 0;
  for (const sample of samples) {
    if (sample.mastery >= TAIL_MASTERED_MIN && kmBetween(sample, origin) <= TAIL_AREA_KM) known += 1;
  }
  return Math.min(1, known / TAIL_OPEN_KNOWN);
}

/**
 * Famous places always weigh fully. The tail opens progressively as the
 * rider masters the area: a new rider at Vijzelstraat is sent to the
 * Westerkerk; one who has learned forty names round there may be sent to a
 * neighbourhood church.
 */
export function fameTierFactor(poi: RoutePoi, openness = 0, floor = TAIL_FLOOR, score = notabilityScore(poi)): number {
  if (score >= FAMOUS_TIER_SCORE) return 1;
  return floor + (1 - floor) * Math.max(0, Math.min(1, openness));
}

/** Pick weight of a destination: notability, gated by the fame tier. */
export function destinationWeight(poi: RoutePoi, openness = 0, floor = TAIL_FLOOR): number {
  const score = notabilityScore(poi);
  return notabilityWeight(score) * fameTierFactor(poi, openness, floor, score);
}

/**
 * Where a surprise ride starts. This was a uniform draw over the whole pool,
 * so three rides in four started at a tail place nobody had heard of (El
 * Tawheed, Meerpadkerk: the 2026-11-13 report) even though the destination
 * was fame-weighted. Weighted like a destination now, with the tail opening
 * round each start as the rider learns its streets.
 */
export function pickSurpriseStart(
  pois: readonly RoutePoi[],
  samples: readonly FameSample[] = [],
  chooseUnit: ChooseUnit = randomUnit,
): RoutePoi | null {
  const floor = tailFloorFor(pois);
  return pickWeighted(pois.map(poi => ({ item: poi, weight: destinationWeight(poi, tailOpenness(poi, samples), floor) })), chooseUnit);
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
  /** The rider's practised places; none = a new rider, who gets the famous tier. */
  samples: readonly FameSample[] = [],
): RoutePoi | null {
  const candidates = pois.filter(poi => poi.id !== from.id && poi.id !== alsoExcludeId);
  if (candidates.length === 0) return null;
  const inRange = candidates.filter(poi => kmBetween(poi, from) <= ROUTE_POI_MAX_PAIR_KM);
  const pool = inRange.length > 0 ? inRange : candidates;
  const openness = tailOpenness(from, samples);
  const floor = tailFloorFor(pool);
  const scored = pool.map(poi => ({
    item: poi,
    weight: destinationWeight(poi, openness, floor),
  }));
  const pick = pickWeighted(scored, chooseUnit);
  // A neighbour is drawn again from the places far enough away. A pick that is far enough is returned as it was,
  // after the same draws, so every ride that started before starts the same.
  if (!pick || kmBetween(pick, from) >= SURPRISE_MIN_PAIR_KM) return pick;
  const apart = scored.filter(entry => kmBetween(entry.item, from) >= SURPRISE_MIN_PAIR_KM);
  return apart.length ? pickWeighted(apart, chooseUnit) ?? pick : pick;
}
