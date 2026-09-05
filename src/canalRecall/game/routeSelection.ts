// Choosing where a route starts and ends, and keeping its line honest while
// it is driven.
//
// These are geographic rules, not UI: which destinations are close enough to
// pair, what to do when a destination turns out to be unreachable, and when a
// drawn route line has stopped describing the trip. They survive whatever the
// setup screen is built out of, so they live here rather than in the form.

import type { WorldPoint } from './worldTypes';

export interface RoutePoi {
  id: string;
  name: string;
  lat: number;
  lng: number;
}

/**
 * Both ends of a route must sit inside the single OSM window fetched around
 * their midpoint, so candidates are capped by distance from each other —
 * otherwise a Weesp fort could be paired with Westerpark and half the route
 * would fall outside the loaded network.
 */
export const ROUTE_POI_MAX_PAIR_KM = 6;

/** How many nearby stand-ins to snap-test before giving up on routing. */
export const RETARGET_ATTEMPTS = 25;

/** Home-mode learning ring: start tight, expand as nearby knowledge grows. */
export const HOME_RADIUS_MIN_KM = 1.0;
export const HOME_RADIUS_MAX_KM = ROUTE_POI_MAX_PAIR_KM;
export const HOME_RADIUS_STEP_KM = 0.75;
/** Mastered samples inside the ring required before expanding one step. */
export const HOME_RADIUS_KNOWN_TO_EXPAND = 3;
export const HOME_RADIUS_MASTERED_MIN = 0.45;
/** Soft overshoot so the frontier is not a hard wall. */
export const HOME_RADIUS_OVERSHOOT = 1.15;
/** Destinations closer than this feel like a stub trip. */
export const HOME_MIN_TRIP_KM = 0.2;

export interface MasterySample {
  lat: number;
  lng: number;
  /** 0..1 familiarity at that place. */
  mastery: number;
}

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

/**
 * A destination for a trip starting at `from`.
 *
 * Prefers somewhere within pairing range, but falls back to the whole pool
 * rather than returning nothing: a start with no near neighbour should still
 * produce a trip, and the loader's own window check is what ultimately rejects
 * an impossible pair.
 */
export function pickDestinationNear(
  pois: readonly RoutePoi[],
  from: { id: string; lat: number; lng: number },
  chooseIndex: ChooseIndex = randomIndex,
  alsoExcludeId: string | null = null,
): RoutePoi | null {
  const candidates = pois.filter(poi => poi.id !== from.id && poi.id !== alsoExcludeId);
  if (candidates.length === 0) return null;
  const inRange = candidates.filter(poi => kmBetween(poi, from) <= ROUTE_POI_MAX_PAIR_KM);
  const pool = inRange.length > 0 ? inRange : candidates;
  return pool[chooseIndex(pool.length)] ?? null;
}

/**
 * How far from home destination picks may roam.
 *
 * Fresh players stay in a ~1 km ring. Each time enough nearby street/canal
 * answers look practised, the ring steps outward — up to the same pairing
 * cap surprise routes use — so the city opens as local knowledge sticks.
 */
export function homeLearningRadiusKm(
  home: { lat: number; lng: number },
  samples: readonly MasterySample[],
): number {
  let radius = HOME_RADIUS_MIN_KM;
  while (radius < HOME_RADIUS_MAX_KM - 1e-9) {
    const known = samples.filter(
      sample => sample.mastery >= HOME_RADIUS_MASTERED_MIN && kmBetween(sample, home) <= radius,
    );
    if (known.length < HOME_RADIUS_KNOWN_TO_EXPAND) break;
    const next = Math.min(HOME_RADIUS_MAX_KM, radius + HOME_RADIUS_STEP_KM);
    if (next <= radius) break;
    radius = next;
  }
  return radius;
}

function localFamiliarity(
  point: { lat: number; lng: number },
  samples: readonly MasterySample[],
  bandKm = 0.6,
): number {
  const near = samples.filter(sample => kmBetween(sample, point) <= bandKm);
  if (near.length === 0) return 0;
  return near.reduce((sum, sample) => sum + sample.mastery, 0) / near.length;
}

/** Higher is better: near + novel corridors beat far mastered ones. */
export function scoreHomeDestination(
  poi: RoutePoi,
  home: { lat: number; lng: number },
  radiusKm: number,
  samples: readonly MasterySample[],
): number {
  const km = kmBetween(poi, home);
  if (km < HOME_MIN_TRIP_KM) return 0;
  if (km > radiusKm * HOME_RADIUS_OVERSHOOT) return 0;
  const closeness = 1 / (0.35 + km);
  const novelty = 1 - localFamiliarity(poi, samples);
  return closeness * (0.35 + 0.65 * novelty);
}

/** Injected so weighted home picks stay deterministic under test. */
export type ChooseUnit = () => number;

export const randomUnit: ChooseUnit = () => Math.random();

function pickWeighted<T>(
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

export interface HomeDestinationPick {
  poi: RoutePoi;
  radiusKm: number;
}

/**
 * Home-base destination: prefer closer, less-familiar landmarks inside the
 * player's current learning radius. Falls back to the surprise pairing pool
 * when the ring has no landmarks yet (new address / sparse extract).
 */
export function pickHomeDestination(
  pois: readonly RoutePoi[],
  home: { id?: string; lat: number; lng: number },
  samples: readonly MasterySample[] = [],
  chooseUnit: ChooseUnit = randomUnit,
  alsoExcludeId: string | null = null,
): HomeDestinationPick | null {
  const radiusKm = homeLearningRadiusKm(home, samples);
  const homeId = home.id ?? 'home';
  const candidates = pois.filter(poi => poi.id !== homeId && poi.id !== alsoExcludeId);
  if (candidates.length === 0) return null;

  const scored = candidates.map(poi => ({
    item: poi,
    weight: scoreHomeDestination(poi, home, radiusKm, samples),
  }));
  const picked = pickWeighted(scored, chooseUnit);
  if (picked) return { poi: picked, radiusKm };

  const chooseIndex: ChooseIndex = count => Math.min(count - 1, Math.floor(chooseUnit() * count));
  const fallback = pickDestinationNear(
    pois,
    { id: homeId, lat: home.lat, lng: home.lng },
    chooseIndex,
    alsoExcludeId,
  );
  return fallback ? { poi: fallback, radiusKm } : null;
}

/** Projects a POI onto the loaded network, or `null` where it does not snap. */
export type SnapToNetwork = (poi: RoutePoi) => WorldPoint | null;

export interface SnappedPoi {
  poi: RoutePoi;
  point: WorldPoint;
}

/**
 * The nearest POI to `target` that actually snaps onto the mapped network.
 *
 * Ranked by distance and tried in order, capped at `RETARGET_ATTEMPTS` because
 * each attempt is a snap search over every loaded segment.
 */
export function nearestSnappableDestination(
  pois: readonly RoutePoi[],
  target: { lat: number; lng: number },
  snap: SnapToNetwork,
  excludeId: string | null = null,
  attempts = RETARGET_ATTEMPTS,
): SnappedPoi | null {
  const ranked = pois
    .filter(poi => poi.id !== excludeId && Number.isFinite(poi.lat))
    .map(poi => ({ poi, km: kmBetween(poi, target) }))
    .sort((a, b) => a.km - b.km);
  for (const entry of ranked.slice(0, attempts)) {
    const point = snap(entry.poi);
    if (point) return { poi: entry.poi, point };
  }
  return null;
}

/**
 * Rank stand-ins for an unroutable destination: reachable-looking POIs, sorted
 * by how near they are to the destination the player was actually given, and
 * never so close to the start that the trip is trivial.
 *
 * Returns the shortlist rather than the answer, because deciding which is
 * genuinely reachable needs one Dijkstra over the whole graph — the caller's
 * job. There is no cap here: only the snap search is expensive per candidate.
 */
export function rankRetargetCandidates(
  pois: readonly RoutePoi[],
  start: WorldPoint,
  originalFinish: WorldPoint,
  snap: SnapToNetwork,
  minStartFinishDistance: number,
  excludeId: string | null = null,
): SnappedPoi[] {
  const ranked: Array<SnappedPoi & { gap: number }> = [];
  for (const poi of pois) {
    if (poi.id === excludeId || !Number.isFinite(poi.lat)) continue;
    const point = snap(poi);
    if (!point) continue;
    if (Math.hypot(point.x - start.x, point.y - start.y) < minStartFinishDistance) continue;
    ranked.push({ poi, point, gap: Math.hypot(point.x - originalFinish.x, point.y - originalFinish.y) });
  }
  ranked.sort((a, b) => a.gap - b.gap);
  return ranked.map(({ poi, point }) => ({ poi, point }));
}

// ---- The live route line ----

/** px off the drawn path before the route is replanned outright. */
export const LIVE_ROUTE_OFF_ROUTE_DIST = 140;
/** Seconds between reroute attempts. */
export const LIVE_ROUTE_REROUTE_INTERVAL = 2;

export interface LiveRouteState {
  /** Index of the route vertex the line currently starts from. */
  index: number;
  /** Seconds until another reroute may be attempted. */
  rerouteTimer: number;
}

export interface LiveRouteDecision {
  state: LiveRouteState;
  /** True when the caller should replan from the player's position. */
  shouldReroute: boolean;
  /** Index of the nearest route vertex to the player. */
  nearestIndex: number;
  /** How far the player is from the drawn path, in px. */
  offBy: number;
}

export function nearestRouteIndex(
  route: readonly WorldPoint[],
  player: WorldPoint,
): { index: number; distance: number } {
  let index = 0, distance = Infinity;
  for (let i = 0; i < route.length; i++) {
    const d = Math.hypot(route[i].x - player.x, route[i].y - player.y);
    if (d < distance) { distance = d; index = i; }
  }
  return { index, distance };
}

/**
 * Whether the drawn line still describes the trip.
 *
 * A reroute is rationed by a timer so that a player cutting a corner does not
 * trigger a fresh Dijkstra every frame.
 */
export function advanceLiveRoute(
  state: LiveRouteState,
  route: readonly WorldPoint[],
  player: WorldPoint,
  dt: number,
): LiveRouteDecision {
  const rerouteTimer = Math.max(0, state.rerouteTimer - dt);
  const nearest = nearestRouteIndex(route, player);
  const shouldReroute = nearest.distance > LIVE_ROUTE_OFF_ROUTE_DIST && rerouteTimer <= 0;
  return {
    state: {
      index: state.index,
      rerouteTimer: shouldReroute ? LIVE_ROUTE_REROUTE_INTERVAL : rerouteTimer,
    },
    shouldReroute,
    nearestIndex: nearest.index,
    offBy: nearest.distance,
  };
}

/**
 * The stretch of route still ahead of the player.
 *
 * Anchored to route vertices rather than to the player: giving the line a head
 * at the player's exact position meant redrawing every 40 px of travel, which
 * read as a jerk. Trimming whole vertices as they are passed only changes the
 * geometry at junctions, where it is invisible.
 */
export function routeAhead(
  route: readonly WorldPoint[],
  fromIndex: number,
  finish: WorldPoint,
): WorldPoint[] {
  const ahead = route.slice(fromIndex);
  if (ahead.length >= 2) return ahead;
  const last = route[route.length - 1];
  return last ? [last, finish] : [finish];
}
