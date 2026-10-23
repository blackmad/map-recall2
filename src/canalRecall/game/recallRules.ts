// What the recall subsystem decides, with no DOM, store or canvas involved.
//
// The rules here are the ones that change what the player learns: where a
// question is anchored, which crossing counts as crossed, whether a crossing
// asks about the water or the deck, and when a name has settled long enough to
// be worth asking about. Each of those was previously reachable only by
// driving a boat at it.

import { t } from '../../i18n/index.ts';
import type { WorldPoint } from './worldTypes';

/** Extract and store coordinates are `[lat, lon]`. */
export type LatLon = [number, number];

/**
 * The origin of one route's world. World pixels are route-relative — the
 * network origin is recomputed for every race from the loaded bounds — so
 * anything that has to survive the race, recall identity above all, is stored
 * in lat/lon and converted through here.
 */
export interface WorldOrigin {
  centerLat: number;
  centerLng: number;
  offsetX: number;
  offsetY: number;
  pixelsPerMeter: number;
}

const METERS_PER_DEGREE_LAT = 111320;

function metersPerDegreeLng(centerLat: number): number {
  return METERS_PER_DEGREE_LAT * Math.cos(centerLat * Math.PI / 180);
}

export function toLatLon(origin: WorldOrigin, x: number, y: number): LatLon {
  const { centerLat, centerLng, offsetX, offsetY, pixelsPerMeter } = origin;
  return [
    centerLat - (y - offsetY) / (METERS_PER_DEGREE_LAT * pixelsPerMeter),
    centerLng + (x - offsetX) / (metersPerDegreeLng(centerLat) * pixelsPerMeter),
  ];
}

export function toWorld(origin: WorldOrigin, lat: number, lon: number): WorldPoint {
  const { centerLat, centerLng, offsetX, offsetY, pixelsPerMeter } = origin;
  return {
    x: (lon - centerLng) * metersPerDegreeLng(centerLat) * pixelsPerMeter + offsetX,
    y: -(lat - centerLat) * METERS_PER_DEGREE_LAT * pixelsPerMeter + offsetY,
  };
}

/** Is this label close enough to somewhere the player has proved they know it? */
export function isPlaceKnown(
  knownPoints: readonly WorldPoint[] | undefined,
  x: number,
  y: number,
  radiusPixels: number,
): boolean {
  if (!knownPoints) return false;
  return knownPoints.some(point => Math.hypot(point.x - x, point.y - y) <= radiusPixels);
}

// ---- Crossing a bridge ----

/** Ported from the page's `utils.js` so the rule can be tested off-page. The
 *  epsilon matters: near-parallel spans are common where a deck is mapped as
 *  several almost-collinear ways. */
export function segmentsIntersect(
  p1: WorldPoint, p2: WorldPoint, p3: WorldPoint, p4: WorldPoint,
): boolean {
  const d = (p2.x - p1.x) * (p4.y - p3.y) - (p2.y - p1.y) * (p4.x - p3.x);
  if (Math.abs(d) < 1e-9) return false;
  const t = ((p3.x - p1.x) * (p4.y - p3.y) - (p3.y - p1.y) * (p4.x - p3.x)) / d;
  const u = ((p3.x - p1.x) * (p2.y - p1.y) - (p3.y - p1.y) * (p2.x - p1.x)) / d;
  return t >= 0 && t <= 1 && u >= 0 && u <= 1;
}

/** A gate across the middle of a span, perpendicular to it. */
export function bridgeGate(
  a: WorldPoint,
  b: WorldPoint,
  halfWidth: number,
): [WorldPoint, WorldPoint] {
  const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
  const dx = b.x - a.x, dy = b.y - a.y;
  const length = Math.hypot(dx, dy) || 1;
  const nx = -dy / length * halfWidth, ny = dx / length * halfWidth;
  return [{ x: mx - nx, y: my - ny }, { x: mx + nx, y: my + ny }];
}

/** The shape `findCrossedBridge` needs: identity plus span geometry. */
export interface CrossableBridge {
  id: string;
  lines: WorldPoint[][];
}

/**
 * Which bridge, if any, this movement step crossed.
 *
 * Both modes require an actual traversal, never proximity. A boat passes under
 * the span, so its travel crosses the mapped centreline. A car drives *along*
 * the deck, so it never crosses that line — it is tested against a gate drawn
 * perpendicular through the span's midpoint instead. Sitting at the kerb
 * aligned with a bridge does not count; passing its middle does.
 */
export function findCrossedBridge<T extends CrossableBridge>(
  bridges: readonly T[],
  previous: WorldPoint,
  current: WorldPoint,
  byBoat: boolean,
  gateHalfWidth: number,
): T | null {
  for (const bridge of bridges) {
    for (const line of bridge.lines) {
      for (let i = 1; i < line.length; i++) {
        const a = line[i - 1], b = line[i];
        if (byBoat) {
          if (segmentsIntersect(previous, current, a, b)) return bridge;
        } else {
          const gate = bridgeGate(a, b, gateHalfWidth);
          if (segmentsIntersect(previous, current, gate[0], gate[1])) return bridge;
        }
      }
    }
  }
  return null;
}

// ---- Crossing the water, not just the deck ----
//
// The gate test above fires for any step through a gate drawn across any edge
// of a bridge's geometry, and 158 of Amsterdam's 415 bridges are mapped only as
// deck outlines. Where a cross street's bridge meets a quay, the outline's
// bank-side edge runs along the quay, its gate lies across the quay, and a
// rider going straight along the canal was asked "Which waterway are you
// crossing?" for the canal beside them: Prinsengracht at the
// Nieuwe-Wercksbrug (Westermarkt), teaser ride 2026-10-22. So a street
// crossing with a known waterway asks only when the rider's track crosses that
// waterway's centreline, steeply enough, on the deck.

/** The track is judged over this much riding, so a wiggle on the deck does not count. */
export const CROSSING_TRAIL_METRES = 18;
/** The smoothed track must cross the water centreline at least this steeply (degrees). */
export const CROSSING_MIN_ANGLE_DEG = 35;
/** The water crossing must lie on (or this close to) the bridge's mapped geometry. */
export const CROSSING_DECK_METRES = 14;

/** A short memory of where the rider has been, by distance travelled. */
export class TrackTrail {
  private points: WorldPoint[] = [];
  constructor(private readonly keepPx: number, private readonly stepPx = 3) {}

  reset(): void { this.points = []; }

  push(point: WorldPoint): void {
    const last = this.points[this.points.length - 1];
    if (last && Math.hypot(point.x - last.x, point.y - last.y) < this.stepPx) return;
    this.points.push({ x: point.x, y: point.y });
    // Trim from the front while the rest still covers `keepPx`.
    let length = 0;
    for (let i = this.points.length - 1; i > 0; i--) {
      length += Math.hypot(this.points[i].x - this.points[i - 1].x, this.points[i].y - this.points[i - 1].y);
      if (length >= this.keepPx) { this.points.splice(0, i - 1); break; }
    }
  }

  /** The point about `backPx` of travel behind `current` (the oldest kept when the trail is shorter). */
  pointBack(current: WorldPoint, backPx: number): WorldPoint {
    let left = backPx;
    let at = current;
    for (let i = this.points.length - 1; i >= 0; i--) {
      const p = this.points[i];
      const d = Math.hypot(p.x - at.x, p.y - at.y);
      if (d >= left) {
        const f = left / (d || 1);
        return { x: at.x + (p.x - at.x) * f, y: at.y + (p.y - at.y) * f };
      }
      left -= d;
      at = p;
    }
    return at;
  }
}

function crossingAngleDeg(p: WorldPoint, q: WorldPoint, a: WorldPoint, b: WorldPoint): number {
  const ux = q.x - p.x, uy = q.y - p.y, vx = b.x - a.x, vy = b.y - a.y;
  const cross = Math.abs(ux * vy - uy * vx);
  const dot = Math.abs(ux * vx + uy * vy);
  return Math.atan2(cross, dot) * 180 / Math.PI;
}

function intersection(p: WorldPoint, q: WorldPoint, a: WorldPoint, b: WorldPoint): WorldPoint {
  const d = (q.x - p.x) * (b.y - a.y) - (q.y - p.y) * (b.x - a.x);
  const t = d ? ((a.x - p.x) * (b.y - a.y) - (a.y - p.y) * (b.x - a.x)) / d : 0;
  return { x: p.x + (q.x - p.x) * t, y: p.y + (q.y - p.y) * t };
}

function isClosedRing(line: readonly WorldPoint[]): boolean {
  if (line.length < 4) return false;
  const a = line[0], b = line[line.length - 1];
  return Math.abs(a.x - b.x) < 1e-6 && Math.abs(a.y - b.y) < 1e-6;
}

function insideRing(point: WorldPoint, ring: readonly WorldPoint[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i], b = ring[j];
    if ((a.y > point.y) !== (b.y > point.y) && point.x < (b.x - a.x) * (point.y - a.y) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

/** Whether `point` is on the bridge: inside a deck outline, or within `rangePx` of any of its lines. */
export function onBridgeDeck(lines: readonly (readonly WorldPoint[])[], point: WorldPoint, rangePx: number): boolean {
  for (const line of lines) {
    if (isClosedRing(line) && insideRing(point, line)) return true;
    for (let i = 1; i < line.length; i++) if (distanceToSegment(point, line[i - 1], line[i]) <= rangePx) return true;
  }
  return false;
}

export interface WaterCrossable extends CrossableBridge {
  crossings: ReadonlyArray<WorldPoint & { waterLines?: WorldPoint[][] }>;
}

export interface WaterCrossingOptions {
  /** Where the rider was CROSSING_TRAIL_METRES of travel ago (TrackTrail.pointBack). */
  trailStart: WorldPoint;
  deckRangePx: number;
  minAngleDeg?: number;
  /** Crossings further than this from the rider are not tested. */
  searchPx: number;
}

/**
 * The crossing whose water this step actually crossed: the step and the
 * smoothed track (trail start → now) both cross a centreline segment of the
 * crossing's waterway, at `minAngleDeg` or steeper, at a point on the deck.
 * Riding along the canal, on a quay or over a junction deck, never crosses
 * its centreline.
 */
export function findWaterCrossing<T extends WaterCrossable>(
  bridges: readonly T[],
  previous: WorldPoint,
  current: WorldPoint,
  { trailStart, deckRangePx, minAngleDeg = CROSSING_MIN_ANGLE_DEG, searchPx }: WaterCrossingOptions,
): { bridge: T; crossing: T['crossings'][number] } | null {
  for (const bridge of bridges) {
    for (const crossing of bridge.crossings) {
      if (!crossing.waterLines || !crossing.waterLines.length) continue;
      if (Math.hypot(crossing.x - current.x, crossing.y - current.y) > searchPx) continue;
      for (const line of crossing.waterLines) {
        for (let i = 1; i < line.length; i++) {
          const a = line[i - 1], b = line[i];
          if (!segmentsIntersect(previous, current, a, b)) continue;
          if (!segmentsIntersect(trailStart, current, a, b)) continue;
          if (crossingAngleDeg(trailStart, current, a, b) < minAngleDeg) continue;
          if (!onBridgeDeck(bridge.lines, intersection(previous, current, a, b), deckRangePx)) continue;
          return { bridge, crossing };
        }
      }
    }
  }
  return null;
}

/**
 * The gate test for crossings with no water geometry (no waterway identified,
 * or none mapped nearby). Deck outlines are skipped when the bridge has a
 * mapped way, since an outline's bank-side edge runs along the quay; and the
 * smoothed track must run along the gated span (within `maxOffAxisDeg`), not
 * across it. A bridge mapped only as an outline has no travel axis to trust
 * and asks nothing here.
 */
export function findGateCrossing<T extends CrossableBridge>(
  bridges: readonly T[],
  previous: WorldPoint,
  current: WorldPoint,
  trailStart: WorldPoint,
  gateHalfWidth: number,
  maxOffAxisDeg = 90 - CROSSING_MIN_ANGLE_DEG,
): T | null {
  for (const bridge of bridges) {
    for (const line of bridge.lines) {
      if (isClosedRing(line)) continue;
      for (let i = 1; i < line.length; i++) {
        const a = line[i - 1], b = line[i];
        const gate = bridgeGate(a, b, gateHalfWidth);
        if (!segmentsIntersect(previous, current, gate[0], gate[1])) continue;
        if (crossingAngleDeg(trailStart, current, a, b) > maxOffAxisDeg) continue;
        return bridge;
      }
    }
  }
  return null;
}

// ---- What a crossing asks ----

export type CrossingQuestionKind = 'water' | 'bridge';

export interface CrossingQuestionInput {
  /** The name of the bridge that was crossed. */
  bridgeName: string;
  /** Whether this crossing has a mapped waterway under it. */
  hasWater: boolean;
  /** What this exact crossing has already been asked, if anything. */
  alreadyAsked?: CrossingQuestionKind;
  byBoat: boolean;
  /** True once the player has proved they know this water *here*. */
  waterKnownHere: boolean;
  /** True when asking this water here again would be noise. */
  waterSuppressedHere: boolean;
  /** Same, for the bridge itself. */
  bridgeSuppressedHere: boolean;
  /** Below hard difficulty only famous bridges are asked (notableBridges.ts);
   *  undefined means askable. */
  bridgeAskable?: boolean;
  /** The road the vehicle is on, and the name the route quiz already owns. */
  currentRoadName: string;
  quizCurrentName: string;
}

/**
 * A bridge is a landmark *on* a waterway. Naming the deck before you can name
 * the water under it teaches the wrong half, so a crossing asks for the water
 * first and holds the bridge back until that has actually been answered right
 * — per crossing, because the Amstel at the Berlagebrug and the Amstel at the
 * Magere Brug are two pieces of local knowledge.
 *
 * Returns `null` when this crossing should ask nothing at all.
 */
export function crossingQuestionKind(input: CrossingQuestionInput): CrossingQuestionKind | null {
  if (input.hasWater && !input.waterKnownHere) {
    // Street mode never otherwise asks about water, so the crossing is where
    // the canal gets taught. By boat the route quiz already owns the waterway
    // the hull is on, so the bridge simply waits for it.
    if (!input.byBoat && input.alreadyAsked !== 'water' && !input.waterSuppressedHere) return 'water';
    return null;
  }
  if (input.alreadyAsked === 'bridge') return null;
  // Raampoort is both a street and a bridge. Asking for it as a bridge and then
  // again as a street left the player answering the same name twice.
  if (input.bridgeName === input.currentRoadName) return null;
  if (input.bridgeName === input.quizCurrentName) return null;
  if (input.bridgeSuppressedHere) return null;
  if (input.bridgeAskable === false) return null;
  return 'bridge';
}

/**
 * Wrong answers for a multiple-choice question: deduplicated, never the right
 * answer, never blank, and capped. `shuffle` is injected so the caller's
 * randomness stays out of the rule.
 */
export function pickDistractors(
  pool: readonly string[],
  answer: string,
  limit: number,
  shuffle: <T>(items: T[]) => T[],
): string[] {
  return shuffle([...new Set(pool)].filter(candidate => candidate && candidate !== answer)).slice(0, limit);
}

function distanceToSegment(point: WorldPoint, a: WorldPoint, b: WorldPoint): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared === 0) return Math.hypot(point.x - a.x, point.y - a.y);
  const t = Math.max(0, Math.min(1,
    ((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSquared));
  return Math.hypot(point.x - (a.x + t * dx), point.y - (a.y + t * dy));
}

/**
 * A named bridge can also be the routing way under the bike. Match both its
 * name and local deck geometry: matching only the name would mislabel the rest
 * of a long street whose bridge happens to carry that street's name.
 */
export function findBridgeRouteAt<T extends CrossableBridge & { name: string }>(
  bridges: readonly T[],
  routeName: string,
  point: WorldPoint,
  maxDistance: number,
): T | null {
  if (!routeName) return null;
  for (const bridge of bridges) {
    if (bridge.name !== routeName) continue;
    for (const line of bridge.lines) {
      for (let i = 1; i < line.length; i++) {
        if (distanceToSegment(point, line[i - 1], line[i]) <= maxDistance) return bridge;
      }
    }
  }
  return null;
}

// ---- Settling on a name to ask about ----

export interface RouteQuizState {
  candidateName: string;
  candidateSeconds: number;
  /** Metres travelled, aligned with it, since the candidate was nominated. */
  candidateMetres?: number;
}

/**
 * Metres along a newly entered street after which its question opens, even
 * if the settle time has not run out. The settle delay alone was a time, and
 * the arcade bike covers 15–60 m a second: at cruise 0.65 s is ~35 m, so a
 * 40 m bridge such as the Noordsche Compagniebrug was asked as the rider
 * reached the far quay (user report 2026-10-09, "asked me kinda too late").
 * Clipping a corner is a spatial event, so a distance guards it as well as
 * the clock did at turning speed (0.65 s ≈ 10–18 m there).
 */
export const ROUTE_QUIZ_SETTLE_METRES = 8;
/** The quicker re-test for an already revealed name, in metres. */
export const ROUTE_QUIZ_RETEST_METRES = 4;

export interface RouteQuizInput {
  /** The road under the vehicle, if it has a name. */
  roadName: string;
  /** The name the quiz already treats as answered here. */
  currentName: string;
  /** Radians: how far the vehicle's heading is from the road's. */
  headingOffRoad: number | null;
  speed: number;
  /** True when the player has already been shown this name this route. */
  alreadyRevealed: boolean;
  settleSeconds: number;
  retestSeconds: number;
  /** Metres moved this frame. Omitted: the settle is judged on time alone. */
  movedMetres?: number;
  /** Distance settle for a fresh name; omitted or Infinity disables it. */
  settleMetres?: number;
  /** Distance settle for an already revealed name. */
  retestMetres?: number;
}

export type RouteQuizDecision =
  /** Nothing to do; keep driving. */
  | { action: 'idle'; state: RouteQuizState }
  /** The player already knows this one — adopt it silently, do not ask. */
  | { action: 'adopt'; name: string; state: RouteQuizState }
  /** A recent miss is waiting for review — do not ask or claim mastery. */
  | { action: 'defer'; name: string; state: RouteQuizState }
  /** Settled long enough, and moving: ask. */
  | { action: 'ask'; name: string; state: RouteQuizState };

export type RouteQuizRecallStatus = 'none' | 'learning' | 'known';

const CLEARED: RouteQuizState = { candidateName: '', candidateSeconds: 0, candidateMetres: 0 };
/** Beyond 45° off the road the vehicle is crossing it, not travelling it. */
const MAX_HEADING_OFF_ROAD = Math.PI / 4;
/** px/s below which the vehicle is not really under way. */
const MIN_QUIZ_SPEED = 5;

/**
 * Whether the name under the vehicle has settled into a question.
 *
 * The alignment gate is what stops the game quizzing on a waterway or street
 * merely crossed without turning onto it, and the settle delay is what stops
 * clipping the corner of a side street counting as a turn. A name already
 * revealed comes back sooner: the point of the label is that you read it while
 * driving, so the re-test should feel like a quick check rather than a fresh
 * question.
 *
 * The settle is time *or* distance, whichever comes first. Time alone let a
 * fast rider cover a whole short street or bridge before being asked; the
 * distance keeps the ask within a few metres of committing to the street.
 * A name that changes resets both, so the ask is always about the street
 * under the vehicle on that frame, never one it has already left.
 */
export function advanceRouteQuiz(
  state: RouteQuizState,
  input: RouteQuizInput,
  dt: number,
  recallStatus: RouteQuizRecallStatus,
): RouteQuizDecision {
  const { roadName, currentName } = input;
  if (roadName && roadName !== currentName && recallStatus === 'known') {
    return { action: 'adopt', name: roadName, state: CLEARED };
  }
  if (roadName && roadName !== currentName && recallStatus === 'learning') {
    return { action: 'defer', name: roadName, state: CLEARED };
  }
  if (!roadName || roadName === currentName) return { action: 'idle', state: CLEARED };
  if (input.headingOffRoad !== null && input.headingOffRoad > MAX_HEADING_OFF_ROAD) {
    return { action: 'idle', state: CLEARED };
  }
  if (roadName !== state.candidateName) {
    return { action: 'idle', state: { candidateName: roadName, candidateSeconds: 0, candidateMetres: 0 } };
  }
  const candidateSeconds = state.candidateSeconds + dt;
  const candidateMetres = (state.candidateMetres ?? 0) + Math.max(0, input.movedMetres ?? 0);
  const settled = { candidateName: roadName, candidateSeconds, candidateMetres };
  const settleFor = input.alreadyRevealed ? input.retestSeconds : input.settleSeconds;
  const settleMetres = (input.alreadyRevealed ? input.retestMetres : input.settleMetres) ?? Infinity;
  const timeSettled = candidateSeconds >= settleFor;
  const distanceSettled = candidateMetres >= settleMetres;
  if ((!timeSettled && !distanceSettled) || Math.abs(input.speed) < MIN_QUIZ_SPEED) {
    return { action: 'idle', state: settled };
  }
  return { action: 'ask', name: roadName, state: settled };
}

/** Heading change, in radians, beyond which a new name counts as a turn. */
export const ROUTE_QUIZ_TURN_RADIANS = Math.PI / 6;

/**
 * The line under a route question. It used to say "You made a turn" for any
 * new name after the first, including riding straight on from Herenstraat
 * onto the Noordsche Compagniebrug (user report 2026-10-09), which told the
 * rider about a turn that did not happen. A turn is now measured: the
 * heading on the previous corridor against the heading now.
 */
export function routeQuizContext(input: {
  onBridge: boolean;
  transit: boolean;
  /** The ride has already settled on a corridor before this one. */
  hadCorridor: boolean;
  /** Heading on the last frame on the previous corridor, if known. */
  corridorHeading: number | null;
  heading: number;
}): string {
  if (input.onBridge) return t('ride.context.bridge');
  if (input.transit) return t('ride.context.transit');
  // The first ask of a ride follows no turn; saying so was false.
  if (!input.hadCorridor) return t('ride.context.start');
  if (input.corridorHeading === null) return t('ride.context.turn');
  const change = Math.abs(Math.atan2(
    Math.sin(input.heading - input.corridorHeading),
    Math.cos(input.heading - input.corridorHeading),
  ));
  return change > ROUTE_QUIZ_TURN_RADIANS ? t('ride.context.turn') : t('ride.context.nameChanged');
}

/** How far the vehicle's heading is from the road's, folded into [0, π/2]. */
export function headingOffRoad(playerAngle: number, roadAngle: number): number {
  let difference = Math.abs(playerAngle - roadAngle) % Math.PI;
  if (difference > Math.PI / 2) difference = Math.PI - difference;
  return difference;
}

export interface HudNameInput {
  /** The name under the vehicle. */
  roadName: string;
  /** The corridor already asked, adopted or deferred. */
  currentName: string;
  /** The open question, if any. */
  promptName: string;
  /** The name settling into a question, if any. */
  candidateName: string;
  /** Shown to the player already (a correction, a label). */
  revealed: boolean;
  /** Answered correctly or adopted as known. */
  learned: boolean;
  /** How `roadName` is printed once it may show: a bridge's official spelling
   *  ("Katten brug" prints as Kattenbrug; bridgeDisplayNames.ts). Withholding
   *  is still decided on the raw `roadName`. */
  shownName?: string;
}

/**
 * Whether the HUD must withhold the name under the vehicle.
 *
 * It used to hide a name only while it was a question or a settling
 * candidate. But candidacy is cleared whenever the heading is more than 45°
 * off the road, so stopping and pivoting at a junction, riding across a street,
 * or spawning misaligned printed an unanswered name in the plaque, and it was
 * asked a moment later (found 2026-09-30 from screenshots with
 * "DE WITTENKADE" and "TUINSTRAAT" in the HUD of a fresh profile). Now any
 * name that is not the current corridor, and has not been answered or shown,
 * stays hidden.
 */
export function hudWithholdsRouteName(input: HudNameInput): boolean {
  if (input.promptName) return true;
  if (input.candidateName && input.candidateName !== input.currentName) return true;
  if (!input.roadName || input.roadName === input.currentName) return false;
  return !input.revealed && !input.learned;
}

/**
 * What the street plaque prints: `roadName` is the name the route question
 * settles on (on a bridge-named deck, the street it carries, or '' when the
 * deck is transparent; see bridgeStreetName.ts), and the plaque withholds it
 * under `hudWithholdsRouteName`, exactly as on an ordinary street.
 */
export function routePlaqueName(input: HudNameInput): { routeName: string; answerHidden: boolean } {
  const answerHidden = hudWithholdsRouteName(input);
  return { routeName: answerHidden ? '' : (input.shownName || input.roadName), answerHidden };
}
