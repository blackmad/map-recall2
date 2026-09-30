// Choosing where a route starts and ends, and keeping its line honest while
// it is driven.
//
// These are geographic rules, not UI: which destinations are close enough to
// pair, what to do when a destination turns out to be unreachable, and when a
// drawn route line has stopped describing the trip. They survive whatever the
// setup screen is built out of, so they live here rather than in the form.

import type { WorldPoint } from './worldTypes';
import { isWorthACard } from './landmarkData';

export interface RoutePoi {
  id: string;
  name: string;
  lat: number;
  lng: number;
}

/** The content fields available on a raw landmark-extract destination. */
export interface RouteDestinationFeature {
  funFact?: string;
  wikipediaExtract?: string;
  wikipediaImageUrl?: string;
  wikipediaUrl?: string;
}

/**
 * A route destination has to teach something when the player reaches it.
 *
 * This deliberately uses the same content floor as drive-by landmark cards:
 * a name and OSM category alone are not a reward for completing a route.
 */
export function isTeachableRouteDestination(feature: RouteDestinationFeature): boolean {
  return isWorthACard({
    detail: feature.funFact || feature.wikipediaExtract,
    imageUrl: feature.wikipediaImageUrl,
    wikipediaUrl: feature.wikipediaUrl,
  });
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

// ---------------------------------------------------------------------------
// Review rides (TODO item 6, "due-aware where next").
//
// Plan review used to switch questions to due names only, while the route
// was still a random pair: most due names never came under the wheels, and a
// question about a place you cannot see teaches a false pairing. A review
// ride instead picks the landmark pair whose straight line passes the most
// due names. Trips keep their usual length cap, so the detour is bounded by
// construction; the route planner's own due-name bias does the rest.
// ---------------------------------------------------------------------------

/** A due name counts as on the way within this distance of the from→to line. */
export const REVIEW_CORRIDOR_KM = 0.2;
/** Shorter pairs are stub trips that pass nothing. */
export const REVIEW_MIN_TRIP_KM = 0.8;
/** Starts sampled when the start is free (surprise); keeps the search cheap. */
export const REVIEW_FROM_SAMPLES = 40;
/** Among pairs passing the most names, allow this much extra length. */
export const REVIEW_LENGTH_SLACK = 1.3;
/**
 * A due name no pair's line passes (a quarter of Amsterdam's street names:
 * Noord and the outer districts have few landmarks) can be ridden as a via
 * when from → via → to is at most this much longer than from → to in a
 * straight line. The planner caps the real detour again
 * (`planLearningRoadRoute`'s `viaDetourRatio`).
 */
export const REVIEW_VIA_SLACK = 1.3;

export interface DuePlace {
  name: string;
  center: [number, number];
}

/**
 * A review ride can end on a due street instead of at a landmark: a
 * cul-de-sac or court cannot be ridden through as a via, but it can be ridden
 * to. The street's name is the answer, so until arrival the destination shows
 * only as this label, and the POI carries a blank name.
 */
export const REVIEW_STOP_LABEL = 'the mystery street';
/** Seconds arrival may wait inside the finish radius for the stop's question
 *  to open (it opens after `QUIZ_CANDIDATE_DELAY` on the street). */
export const REVIEW_STOP_MAX_WAIT = 2.5;

export interface ReviewStopPoi extends RoutePoi {
  /** The due street the ride ends on; `name` stays blank until arrival. */
  reviewStop: string;
}

export function reviewStopPoi(place: { name: string; lat: number; lng: number }): ReviewStopPoi {
  return { id: `review-stop:${place.name}`, name: '', lat: place.lat, lng: place.lng, reviewStop: place.name };
}

export function isReviewStop(poi: unknown): poi is ReviewStopPoi {
  return !!poi && typeof (poi as ReviewStopPoi).reviewStop === 'string';
}

/**
 * Whether arrival at a review stop waits: while a question is open, and
 * briefly before the stop's question opens, so a short court cannot end the
 * ride before its review. Never once the name is revealed, and never past
 * `REVIEW_STOP_MAX_WAIT` (the question may be suppressed there).
 */
export function reviewStopHoldsArrival(input: {
  stop: string | null | undefined;
  promptOpen: boolean;
  revealed: boolean;
  waitedSeconds: number;
}): boolean {
  if (!input.stop) return false;
  if (input.promptOpen) return true;
  if (input.revealed) return false;
  return input.waitedSeconds < REVIEW_STOP_MAX_WAIT;
}

export interface ReviewRouteInput {
  pois: readonly RoutePoi[];
  due: readonly DuePlace[];
  /** Fixed start (home, GPS); omitted, a start is chosen too. */
  from?: RoutePoi | null;
  maxKm?: number;
  chooseIndex?: ChooseIndex;
  excludeId?: string | null;
}

export interface ReviewRoutePick {
  from: RoutePoi;
  to: RoutePoi;
  /** Distinct due names within the corridor, for the briefing count. */
  dueNear: string[];
  /** A due name off every line, ridden through on the way. Its name is for
   *  the count only; the briefing never shows it. */
  via?: DuePlace;
  /** A due name off every line that the ride ends on (`to` is then a
   *  `ReviewStopPoi`). Offered as the last runner-up, for when the planner
   *  refuses the via (a cul-de-sac). */
  stop?: DuePlace;
  /** Runner-up pairs by straight-line count, for `choosePlannedReview`: the
   *  line is only a guess at what the router will ride. */
  alternatives?: Array<Omit<ReviewRoutePick, 'alternatives'>>;
}

/** Pairs planned for real before a review ride starts, the pick included. */
export const REVIEW_PLANNED_CANDIDATES = 5;

function kmToSegment(point: { lat: number; lng: number }, a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const kx = 111.32 * Math.cos(a.lat * Math.PI / 180), ky = 111.32;
  const px = (point.lng - a.lng) * kx, py = (point.lat - a.lat) * ky;
  const bx = (b.lng - a.lng) * kx, by = (b.lat - a.lat) * ky;
  const t = Math.max(0, Math.min(1, (px * bx + py * by) / (bx * bx + by * by || 1)));
  return Math.hypot(px - bx * t, py - by * t);
}

/** The pair passing the most due names, or null when no pair passes any. */
export function pickReviewRoute(input: ReviewRouteInput): ReviewRoutePick | null {
  const maxKm = input.maxKm ?? ROUTE_POI_MAX_PAIR_KM;
  const chooseIndex = input.chooseIndex ?? randomIndex;
  const due = input.due.filter(place => place.name && Number.isFinite(place.center[0]) && Number.isFinite(place.center[1]))
    .map(place => ({ name: place.name, lat: place.center[0], lng: place.center[1] }));
  const pois = input.pois.filter(poi => poi.id !== input.excludeId);
  if (!due.length || pois.length < 2) return null;
  let froms: RoutePoi[];
  if (input.from) froms = [input.from];
  else {
    const pool = pois.slice();
    froms = [];
    while (pool.length && froms.length < REVIEW_FROM_SAMPLES) froms.push(pool.splice(chooseIndex(pool.length), 1)[0]);
  }
  type Pair = Omit<ReviewRoutePick, 'alternatives'> & { km: number };
  let best = 0;
  let pairs: Pair[] = [];
  const all: Pair[] = [];
  for (const from of froms) {
    // Only due names that could lie near some line out of this start.
    const reachable = due.filter(place => kmBetween(from, place) <= maxKm + REVIEW_CORRIDOR_KM);
    if (!reachable.length) continue;
    for (const to of pois) {
      if (to.id === from.id) continue;
      const km = kmBetween(from, to);
      if (km < REVIEW_MIN_TRIP_KM || km > maxKm) continue;
      const names = new Set<string>();
      for (const place of reachable) if (kmToSegment(place, from, to) <= REVIEW_CORRIDOR_KM) names.add(place.name);
      if (!names.size) continue;
      const pair = { from, to, dueNear: [...names].sort(), km };
      all.push(pair);
      if (names.size < best) continue;
      if (names.size > best) { best = names.size; pairs = []; }
      pairs.push(pair);
    }
  }
  // Due names no line passes: offer each pair the one it detours least for.
  const covered = new Set(all.flatMap(pair => pair.dueNear));
  const uncovered = due.filter(place => !covered.has(place.name));
  if (uncovered.length) {
    const lineNames = new Map(all.map(pair => [`${pair.from.id}>${pair.to.id}`, pair.dueNear]));
    for (const from of froms) {
      const reachable = uncovered.filter(place => kmBetween(from, place) <= maxKm * REVIEW_VIA_SLACK);
      if (!reachable.length) continue;
      for (const to of pois) {
        if (to.id === from.id) continue;
        const km = kmBetween(from, to);
        if (km < REVIEW_MIN_TRIP_KM || km > maxKm) continue;
        let via: (typeof due)[number] | null = null, viaKm = km * REVIEW_VIA_SLACK;
        for (const place of reachable) {
          const through = kmBetween(from, place) + kmBetween(place, to);
          if (through <= viaKm) { via = place; viaKm = through; }
        }
        if (!via) continue;
        const names = [...new Set([...(lineNames.get(`${from.id}>${to.id}`) ?? []), via.name])].sort();
        const pair = { from, to, dueNear: names, km: viaKm, via: { name: via.name, center: [via.lat, via.lng] as [number, number] } };
        all.push(pair);
        if (names.length < best) continue;
        if (names.length > best) { best = names.length; pairs = []; }
        pairs.push(pair);
      }
    }
  }
  // Ending the ride on an uncovered name, for when its via is refused. The
  // best such pair travels as the last runner-up, so it is planned only when
  // nothing ahead of it rides as many due names.
  let stopPair: Pair | null = null;
  for (const from of froms) {
    for (const place of uncovered) {
      const km = kmBetween(from, place);
      if (km < REVIEW_MIN_TRIP_KM || km > maxKm) continue;
      const names = new Set([place.name]);
      for (const other of due) if (kmToSegment(other, from, place) <= REVIEW_CORRIDOR_KM) names.add(other.name);
      if (stopPair && (names.size < stopPair.dueNear.length || (names.size === stopPair.dueNear.length && km >= stopPair.km))) continue;
      stopPair = { from, to: reviewStopPoi(place), dueNear: [...names].sort(), km, stop: { name: place.name, center: [place.lat, place.lng] } };
    }
  }
  const strip = ({ km: _km, ...pick }: Pair) => pick;
  if (!pairs.length) return stopPair ? { ...strip(stopPair), alternatives: [] } : null;
  const shortest = Math.min(...pairs.map(pair => pair.km));
  const close = pairs.filter(pair => pair.km <= shortest * REVIEW_LENGTH_SLACK);
  const chosen = close[chooseIndex(close.length)];
  // Runners-up by count, then length, one per destination, from any start.
  const seen = new Set([`${chosen.from.id}>${chosen.to.id}`]);
  const alternatives: Array<Omit<ReviewRoutePick, 'alternatives'>> = [];
  for (const pair of all.sort((a, b) => b.dueNear.length - a.dueNear.length || a.km - b.km)) {
    if (alternatives.length >= REVIEW_PLANNED_CANDIDATES - 1) break;
    const key = `${pair.from.id}>${pair.to.id}`;
    if (seen.has(key) || pair.to.id === chosen.to.id) continue;
    seen.add(key);
    alternatives.push(strip(pair));
  }
  if (stopPair) {
    if (alternatives.length >= REVIEW_PLANNED_CANDIDATES - 1) alternatives.pop();
    alternatives.push(strip(stopPair));
  }
  return { ...strip(chosen), alternatives };
}

export interface PlannedReview<P, V = P> {
  pick: Omit<ReviewRoutePick, 'alternatives'>;
  start: P;
  finish: P;
  /** The via as planned (a point or a stretch of street), when the pick has
   *  one and the planned path rides it. */
  via?: V;
  /** Due names the planned path rides. */
  dueOnPath: string[];
}

/**
 * Plan the pick and its runners-up and keep the one whose *planned path*
 * rides the most due names. The straight line guesses: a pair whose line
 * grazes four due streets may be routed along none of them, while one past
 * two can ride both. The pick is kept on a tie, so an equal alternative does
 * not replace the random choice. Null when nothing snaps or plans.
 */
export function choosePlannedReview<P, V = P>(
  pick: ReviewRoutePick,
  snap: (poi: RoutePoi) => P | null,
  plan: (start: P, finish: P, via?: V) => { dueNamesOnPath?: readonly string[]; viaUsed?: boolean } | null,
  /** Where along the via's street to plan through, tried in turn: the game
   *  passes stretches of it, since its centre may be a node the ride would
   *  touch and turn back from. Defaults to the snapped centre alone. */
  viaPoints?: (via: DuePlace) => V[],
): PlannedReview<P, V> | null {
  let best: PlannedReview<P, V> | null = null;
  for (const candidate of [pick, ...(pick.alternatives ?? [])].slice(0, REVIEW_PLANNED_CANDIDATES)) {
    // A line past no more due names than the best path already rides is not
    // expected to beat it, and planning costs (a via plans several legs).
    if (best && best.dueOnPath.length >= candidate.dueNear.length) continue;
    const start = snap(candidate.from), finish = snap(candidate.to);
    if (!start || !finish) continue;
    // Snapped under a blank name, so nothing downstream can show it.
    const centre = candidate.via && !viaPoints ? snap({ id: 'review-via', name: '', lat: candidate.via.center[0], lng: candidate.via.center[1] }) : null;
    const tries: V[] = candidate.via ? (viaPoints ? viaPoints(candidate.via) : centre ? [centre as unknown as V] : []) : [];
    let via: V | null = null;
    let planned: ReturnType<typeof plan> = null;
    for (const point of tries) {
      planned = plan(start, finish, point);
      if (planned?.viaUsed) { via = point; break; }
    }
    // A refused via comes back as the direct plan, so only plan when none was tried.
    if (!tries.length) planned = plan(start, finish);
    if (!planned) continue;
    const dueOnPath = [...(planned.dueNamesOnPath ?? [])];
    // A stop the path does not reach (a court outside the routing graph)
    // would send the ride to a finish it cannot ride to.
    if (candidate.stop && !dueOnPath.includes(candidate.stop.name)) continue;
    if (!best || dueOnPath.length > best.dueOnPath.length) {
      const { alternatives: _alternatives, ...bare } = candidate as ReviewRoutePick;
      best = { pick: bare, start, finish, dueOnPath, ...(via && planned.viaUsed ? { via } : {}) };
    }
  }
  return best;
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

/**
 * Where the player is along the route: the start of the nearest segment, and
 * the distance to the route line itself.
 *
 * This used to measure to the route's vertices. Down a long straight with few
 * vertices (Marnixstraat), a rider mid-block was more than
 * `LIVE_ROUTE_OFF_ROUTE_DIST` from every vertex while riding on the line, so
 * the game replanned every two seconds and the line hopped to a near-equal
 * street across the canal (user report 2026-09-29, "while I'm on it, it
 * jumps to another street"). The segment start, not the nearer vertex, is
 * returned so the stretch being ridden stays drawn.
 */
export function nearestRouteIndex(
  route: readonly WorldPoint[],
  player: WorldPoint,
): { index: number; distance: number } {
  if (route.length === 1) return { index: 0, distance: Math.hypot(route[0].x - player.x, route[0].y - player.y) };
  let index = 0, distance = Infinity;
  for (let i = 0; i < route.length - 1; i++) {
    const a = route[i], b = route[i + 1];
    const dx = b.x - a.x, dy = b.y - a.y;
    const t = Math.max(0, Math.min(1, ((player.x - a.x) * dx + (player.y - a.y) * dy) / (dx * dx + dy * dy || 1)));
    const d = Math.hypot(a.x + dx * t - player.x, a.y + dy * t - player.y);
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

export {
  GPS_ORIGIN_ID,
  GpsOriginError,
  browserGpsReader,
  gpsOriginPoi,
  pointInGeocodeViewbox,
  resolveGpsOrigin,
} from './gpsOrigin.ts';
