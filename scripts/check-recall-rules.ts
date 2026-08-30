// Contract for the recall subsystem's rules. These decide what the player is
// asked and where the answer is filed, which is the part of Canal Recall that
// can teach something false — so they are asserted directly rather than
// reached by driving a boat at a bridge.

import assert from 'node:assert/strict';

import {
  advanceRouteQuiz,
  bridgeGate,
  crossingQuestionKind,
  findCrossedBridge,
  headingOffRoad,
  isPlaceKnown,
  pickDistractors,
  segmentsIntersect,
  toLatLon,
  toWorld,
  type CrossingQuestionInput,
  type RouteQuizInput,
  type RouteQuizState,
  type WorldOrigin,
} from '../src/canalRecall/game/recallRules';
import type { WorldPoint } from '../src/canalRecall/game/worldTypes';

const checks: string[] = [];
function check(name: string, run: () => void): void {
  run();
  checks.push(name);
}

const ORIGIN: WorldOrigin = {
  centerLat: 52.3676, centerLng: 4.9041,
  offsetX: 1200, offsetY: -800, pixelsPerMeter: 3,
};

// ---- Route-relative coordinates ----

check('world and lat/lon convert back to each other', () => {
  // Recall identity is stored in lat/lon precisely because world pixels are
  // rebuilt per route; a lossy round trip would file answers in the wrong place.
  for (const [lat, lon] of [[52.3676, 4.9041], [52.3800, 4.8700], [52.3500, 4.9500]]) {
    const world = toWorld(ORIGIN, lat, lon);
    const [backLat, backLon] = toLatLon(ORIGIN, world.x, world.y);
    assert.ok(Math.abs(backLat - lat) < 1e-9, `lat round trip drifted: ${lat} -> ${backLat}`);
    assert.ok(Math.abs(backLon - lon) < 1e-9, `lon round trip drifted: ${lon} -> ${backLon}`);
  }
});

check('the world origin sits at the projection centre', () => {
  const centre = toWorld(ORIGIN, ORIGIN.centerLat, ORIGIN.centerLng);
  assert.deepEqual(centre, { x: ORIGIN.offsetX, y: ORIGIN.offsetY });
});

check('north is up and east is right', () => {
  const centre = toWorld(ORIGIN, 52.3676, 4.9041);
  const north = toWorld(ORIGIN, 52.3776, 4.9041);
  const east = toWorld(ORIGIN, 52.3676, 4.9141);
  assert.ok(north.y < centre.y, 'increasing latitude decreases y');
  assert.ok(east.x > centre.x, 'increasing longitude increases x');
});

// ---- Known places ----

check('isPlaceKnown is a radius test around proved places', () => {
  const points: WorldPoint[] = [{ x: 0, y: 0 }, { x: 500, y: 0 }];
  assert.equal(isPlaceKnown(points, 30, 40, 60), true, 'inside the radius of the first point');
  assert.equal(isPlaceKnown(points, 30, 40, 40), false, 'just outside it');
  assert.equal(isPlaceKnown(points, 520, 0, 60), true, 'a second proved place also counts');
  assert.equal(isPlaceKnown(undefined, 0, 0, 60), false, 'a name never proved anywhere is not known');
  // Labelling the whole of a long street because one junction was answered
  // would hand the player the answer to the far end before it was ever asked.
  assert.equal(isPlaceKnown(points, 250, 0, 60), false,
    'the middle of a long street is not known just because both ends are');
});

// ---- Crossing geometry ----

check('segmentsIntersect ignores parallel and non-touching spans', () => {
  const a = { x: 0, y: 0 }, b = { x: 10, y: 0 };
  assert.equal(segmentsIntersect(a, b, { x: 5, y: -5 }, { x: 5, y: 5 }), true);
  assert.equal(segmentsIntersect(a, b, { x: 15, y: -5 }, { x: 15, y: 5 }), false, 'beyond the end');
  assert.equal(segmentsIntersect(a, b, { x: 0, y: 1 }, { x: 10, y: 1 }), false, 'parallel never meets');
});

check('bridgeGate spans the deck perpendicular to it', () => {
  // A north-south span produces an east-west gate through its midpoint.
  const gate = bridgeGate({ x: 0, y: 0 }, { x: 0, y: 100 }, 26);
  assert.deepEqual(gate.map(p => ({ x: Math.round(p.x), y: Math.round(p.y) })),
    [{ x: 26, y: 50 }, { x: -26, y: 50 }]);
  const width = Math.hypot(gate[0].x - gate[1].x, gate[0].y - gate[1].y);
  assert.ok(Math.abs(width - 52) < 1e-6, 'the gate reaches the half-width either side');
});

const deck: WorldPoint[] = [{ x: 0, y: 0 }, { x: 0, y: 100 }];
const bridges = [{ id: 'blauwbrug', lines: [deck] }];

check('a boat crosses the span; a car crosses its midpoint gate', () => {
  // Passing under: the hull's travel crosses the mapped centreline.
  assert.equal(
    findCrossedBridge(bridges, { x: -20, y: 50 }, { x: 20, y: 50 }, true, 26)?.id,
    'blauwbrug');
  // Driving over runs *along* the deck, so the centreline test can never fire
  // for a car — which is exactly why car mode uses a gate instead.
  assert.equal(
    findCrossedBridge(bridges, { x: 0, y: 20 }, { x: 0, y: 80 }, true, 26), null,
    'travel along the deck never crosses the centreline');
  assert.equal(
    findCrossedBridge(bridges, { x: 0, y: 20 }, { x: 0, y: 80 }, false, 26)?.id,
    'blauwbrug', 'the same travel does pass the midpoint gate');
});

check('sitting at the kerb aligned with a bridge is not a crossing', () => {
  // The whole point of the gate: proximity must never count as traversal.
  assert.equal(findCrossedBridge(bridges, { x: 40, y: 50 }, { x: 41, y: 50 }, false, 26), null,
    'alongside the gate but never through it');
  assert.equal(findCrossedBridge(bridges, { x: 0, y: 10 }, { x: 0, y: 12 }, false, 26), null,
    'on the deck but nowhere near its middle');
});

// ---- What a crossing asks ----

function crossing(overrides: Partial<CrossingQuestionInput> = {}): CrossingQuestionInput {
  return {
    bridgeName: 'Blauwbrug',
    hasWater: true,
    alreadyAsked: undefined,
    byBoat: false,
    waterKnownHere: false,
    waterSuppressedHere: false,
    bridgeSuppressedHere: false,
    currentRoadName: 'Amstelstraat',
    quizCurrentName: 'Amstelstraat',
    ...overrides,
  };
}

check('a crossing teaches the water before the deck', () => {
  assert.equal(crossingQuestionKind(crossing()), 'water',
    'the water under an unknown crossing is asked first');
  assert.equal(crossingQuestionKind(crossing({ waterKnownHere: true })), 'bridge',
    'once the water is known here, the bridge is worth asking');
  assert.equal(crossingQuestionKind(crossing({ alreadyAsked: 'water' })), null,
    'the deck stays held back until the water is actually answered right, not merely asked');
});

check('by boat the route quiz already owns the water', () => {
  assert.equal(crossingQuestionKind(crossing({ byBoat: true })), null,
    'the bridge simply waits rather than duplicating the route question');
  assert.equal(crossingQuestionKind(crossing({ byBoat: true, waterKnownHere: true })), 'bridge');
});

check('a crossing with no mapped water goes straight to the bridge', () => {
  assert.equal(crossingQuestionKind(crossing({ hasWater: false })), 'bridge');
});

check('a name is never asked twice in two guises', () => {
  // Raampoort is both a street and a bridge.
  assert.equal(crossingQuestionKind(crossing({
    hasWater: false, bridgeName: 'Raampoort', currentRoadName: 'Raampoort',
  })), null, 'the bridge under the wheels is the street already being driven');
  assert.equal(crossingQuestionKind(crossing({
    hasWater: false, bridgeName: 'Raampoort', quizCurrentName: 'Raampoort',
  })), null, 'or the name the route quiz already owns');
});

check('suppression and repeats silence a crossing', () => {
  assert.equal(crossingQuestionKind(crossing({ waterSuppressedHere: true })), null);
  assert.equal(crossingQuestionKind(crossing({ hasWater: false, bridgeSuppressedHere: true })), null);
  assert.equal(crossingQuestionKind(crossing({ hasWater: false, alreadyAsked: 'bridge' })), null);
});

// ---- Distractors ----

const noShuffle = <T,>(items: T[]): T[] => items;

check('distractors are deduplicated, never the answer, and capped', () => {
  assert.deepEqual(
    pickDistractors(['Amstel', 'Singel', 'Amstel', '', 'IJ', 'Herengracht', 'Keizersgracht'],
      'Amstel', 3, noShuffle),
    ['Singel', 'IJ', 'Herengracht'],
    'the right answer, blanks and duplicates never become wrong answers');
  assert.deepEqual(pickDistractors(['Amstel'], 'Amstel', 3, noShuffle), [],
    'a pool of nothing but the answer offers no alternatives');
});

// ---- Settling on a question ----

function quizInput(overrides: Partial<RouteQuizInput> = {}): RouteQuizInput {
  return {
    roadName: 'Prinsengracht',
    currentName: '',
    headingOffRoad: 0,
    speed: 50,
    alreadyRevealed: false,
    settleSeconds: 0.65,
    retestSeconds: 0.3,
    ...overrides,
  };
}
const fresh: RouteQuizState = { candidateName: '', candidateSeconds: 0 };

check('a name must settle before it becomes a question', () => {
  const first = advanceRouteQuiz(fresh, quizInput(), 0.1, false);
  assert.equal(first.action, 'idle');
  assert.equal(first.state.candidateName, 'Prinsengracht', 'the first frame only nominates');

  let state = first.state;
  let decision = advanceRouteQuiz(state, quizInput(), 0.5, false);
  assert.equal(decision.action, 'idle', 'still under the settle delay');
  state = decision.state;

  decision = advanceRouteQuiz(state, quizInput(), 0.3, false);
  assert.equal(decision.action, 'ask');
  assert.equal(decision.action === 'ask' && decision.name, 'Prinsengracht');
});

check('clipping the corner of a side street is not a turn onto it', () => {
  const nominated = advanceRouteQuiz(fresh, quizInput(), 0.1, false).state;
  // The vehicle leaves the side street again before the delay elapses.
  const left = advanceRouteQuiz(nominated, quizInput({ roadName: 'Reguliersgracht' }), 0.2, false);
  assert.equal(left.action, 'idle');
  assert.equal(left.state.candidateName, 'Reguliersgracht');
  assert.equal(left.state.candidateSeconds, 0, 'a different name restarts the clock');
});

check('crossing a street without turning onto it asks nothing', () => {
  const decision = advanceRouteQuiz(fresh, quizInput({ headingOffRoad: Math.PI / 3 }), 1, false);
  assert.equal(decision.action, 'idle');
  assert.equal(decision.state.candidateName, '', 'the candidate is abandoned, not merely paused');
});

check('a stopped vehicle is not asked where it is', () => {
  const nominated = advanceRouteQuiz(fresh, quizInput(), 0.1, false).state;
  const decision = advanceRouteQuiz(nominated, quizInput({ speed: 1 }), 1, false);
  assert.equal(decision.action, 'idle', 'below 5 px/s the vehicle is not really under way');
});

check('an already-revealed name comes back sooner', () => {
  const nominated = advanceRouteQuiz(fresh, quizInput({ alreadyRevealed: true }), 0.1, false).state;
  const decision = advanceRouteQuiz(nominated, quizInput({ alreadyRevealed: true }), 0.35, false);
  assert.equal(decision.action, 'ask', 'a re-test is a quick check, not a fresh question');

  // The same elapsed time is not enough for a name the player has never seen.
  const unseen = advanceRouteQuiz(fresh, quizInput(), 0.1, false).state;
  assert.equal(advanceRouteQuiz(unseen, quizInput(), 0.35, false).action, 'idle',
    'a first question waits the full settle delay');
});

check('a name the player has proved they know is adopted, not asked', () => {
  const decision = advanceRouteQuiz(fresh, quizInput(), 0.1, true);
  assert.equal(decision.action, 'adopt');
  assert.equal(decision.action === 'adopt' && decision.name, 'Prinsengracht');
  assert.equal(decision.state.candidateName, '', 'adopting clears any pending candidate');
});

check('the road already being asked about is left alone', () => {
  const decision = advanceRouteQuiz(fresh, quizInput({ currentName: 'Prinsengracht' }), 1, false);
  assert.equal(decision.action, 'idle');
  const unnamed = advanceRouteQuiz(fresh, quizInput({ roadName: '' }), 1, false);
  assert.equal(unnamed.action, 'idle', 'an unnamed way is never a question');
});

check('headingOffRoad folds direction of travel away', () => {
  assert.ok(Math.abs(headingOffRoad(0, 0)) < 1e-9);
  assert.ok(Math.abs(headingOffRoad(0, Math.PI) - 0) < 1e-9,
    'driving the same road backwards is still driving it');
  assert.ok(Math.abs(headingOffRoad(0, Math.PI / 2) - Math.PI / 2) < 1e-9,
    'a perpendicular crossing is the maximum offset');
});

console.log(`Recall rules OK: ${checks.length} checks.`);
for (const name of checks) console.log(`  · ${name}`);
