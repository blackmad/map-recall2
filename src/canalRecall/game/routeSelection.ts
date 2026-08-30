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
