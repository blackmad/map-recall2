// What the recall subsystem decides, with no DOM, store or canvas involved.
//
// The rules here are the ones that change what the player learns: where a
// question is anchored, which crossing counts as crossed, whether a crossing
// asks about the water or the deck, and when a name has settled long enough to
// be worth asking about. Each of those was previously reachable only by
// driving a boat at it.

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

// ---- Settling on a name to ask about ----

export interface RouteQuizState {
  candidateName: string;
  candidateSeconds: number;
}

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
}

export type RouteQuizDecision =
  /** Nothing to do; keep driving. */
  | { action: 'idle'; state: RouteQuizState }
  /** The player already knows this one — adopt it silently, do not ask. */
  | { action: 'adopt'; name: string; state: RouteQuizState }
  /** Settled long enough, and moving: ask. */
  | { action: 'ask'; name: string; state: RouteQuizState };

const CLEARED: RouteQuizState = { candidateName: '', candidateSeconds: 0 };
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
 */
export function advanceRouteQuiz(
  state: RouteQuizState,
  input: RouteQuizInput,
  dt: number,
  suppressedHere: boolean,
): RouteQuizDecision {
  const { roadName, currentName } = input;
  if (roadName && roadName !== currentName && suppressedHere) {
    return { action: 'adopt', name: roadName, state: CLEARED };
  }
  if (!roadName || roadName === currentName) return { action: 'idle', state: CLEARED };
  if (input.headingOffRoad !== null && input.headingOffRoad > MAX_HEADING_OFF_ROAD) {
    return { action: 'idle', state: CLEARED };
  }
  if (roadName !== state.candidateName) {
    return { action: 'idle', state: { candidateName: roadName, candidateSeconds: 0 } };
  }
  const candidateSeconds = state.candidateSeconds + dt;
  const settled = { candidateName: roadName, candidateSeconds };
  const settleFor = input.alreadyRevealed ? input.retestSeconds : input.settleSeconds;
  if (candidateSeconds < settleFor || Math.abs(input.speed) < MIN_QUIZ_SPEED) {
    return { action: 'idle', state: settled };
  }
  return { action: 'ask', name: roadName, state: settled };
}

/** How far the vehicle's heading is from the road's, folded into [0, π/2]. */
export function headingOffRoad(playerAngle: number, roadAngle: number): number {
  let difference = Math.abs(playerAngle - roadAngle) % Math.PI;
  if (difference > Math.PI / 2) difference = Math.PI - difference;
  return difference;
}
