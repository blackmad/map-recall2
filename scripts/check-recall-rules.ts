// Contract for the recall subsystem's rules. These decide what the player is
// asked and where the answer is filed, which is the part of Canal Recall that
// can teach something false — so they are asserted directly rather than
// reached by driving a boat at a bridge.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  advanceRouteQuiz,
  ROUTE_QUIZ_RETEST_METRES,
  ROUTE_QUIZ_SETTLE_METRES,
  routeQuizContext,
  bridgeGate,
  crossingQuestionKind,
  findBridgeRouteAt,
  findCrossedBridge,
  findGateCrossing,
  findWaterCrossing,
  TrackTrail,
  CROSSING_DECK_METRES,
  CROSSING_TRAIL_METRES,
  headingOffRoad,
  hudWithholdsRouteName,
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
import { buildBridges } from '../src/canalRecall/game/landmarkData';
import { nearestCrossing } from '../src/canalRecall/bridgeCrossings';
import { buildSpoilerIndex } from '../src/canalRecall/orientationPois';
import { labelAllowed, labelBudget, planLabels, VENUE_RADIUS_M, type LabelRules, type ScreenCandidate } from '../src/canalRecall/labels/labelPlan';

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

check('below hard a bridge is only asked when it is famous', () => {
  assert.equal(crossingQuestionKind(crossing({ hasWater: false, bridgeAskable: false })), null,
    'Brug 117 at medium: no bridge question');
  assert.equal(crossingQuestionKind(crossing({ bridgeAskable: false })), 'water',
    'the water under it is still taught');
  assert.equal(crossingQuestionKind(crossing({ hasWater: false, bridgeAskable: true })), 'bridge');
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

check('Blauwbrug is described as a bridge when it is the routed way under the bike', () => {
  const namedDeck = { id: 'blauwbrug', name: 'Blauwbrug', lines: [deck] };
  assert.equal(
    findBridgeRouteAt([namedDeck], 'Blauwbrug', { x: 8, y: 40 }, 10)?.id,
    'blauwbrug',
  );
  assert.equal(
    findBridgeRouteAt([namedDeck], 'Amstelstraat', { x: 8, y: 40 }, 10),
    null,
    'a nearby bridge with another name does not change a street question',
  );
  assert.equal(
    findBridgeRouteAt([namedDeck], 'Blauwbrug', { x: 8, y: 140 }, 10),
    null,
    'the same route name away from the deck is still described as a street',
  );
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
  const first = advanceRouteQuiz(fresh, quizInput(), 0.1, 'none');
  assert.equal(first.action, 'idle');
  assert.equal(first.state.candidateName, 'Prinsengracht', 'the first frame only nominates');

  let state = first.state;
  let decision = advanceRouteQuiz(state, quizInput(), 0.5, 'none');
  assert.equal(decision.action, 'idle', 'still under the settle delay');
  state = decision.state;

  decision = advanceRouteQuiz(state, quizInput(), 0.3, 'none');
  assert.equal(decision.action, 'ask');
  assert.equal(decision.action === 'ask' && decision.name, 'Prinsengracht');
});

check('clipping the corner of a side street is not a turn onto it', () => {
  const nominated = advanceRouteQuiz(fresh, quizInput(), 0.1, 'none').state;
  // The vehicle leaves the side street again before the delay elapses.
  const left = advanceRouteQuiz(
    nominated, quizInput({ roadName: 'Reguliersgracht' }), 0.2, 'none',
  );
  assert.equal(left.action, 'idle');
  assert.equal(left.state.candidateName, 'Reguliersgracht');
  assert.equal(left.state.candidateSeconds, 0, 'a different name restarts the clock');
});

check('crossing a street without turning onto it asks nothing', () => {
  const decision = advanceRouteQuiz(
    fresh, quizInput({ headingOffRoad: Math.PI / 3 }), 1, 'none',
  );
  assert.equal(decision.action, 'idle');
  assert.equal(decision.state.candidateName, '', 'the candidate is abandoned, not merely paused');
});

check('a stopped vehicle is not asked where it is', () => {
  const nominated = advanceRouteQuiz(fresh, quizInput(), 0.1, 'none').state;
  const decision = advanceRouteQuiz(nominated, quizInput({ speed: 1 }), 1, 'none');
  assert.equal(decision.action, 'idle', 'below 5 px/s the vehicle is not really under way');
});

check('an already-revealed name comes back sooner', () => {
  const nominated = advanceRouteQuiz(
    fresh, quizInput({ alreadyRevealed: true }), 0.1, 'none',
  ).state;
  const decision = advanceRouteQuiz(
    nominated, quizInput({ alreadyRevealed: true }), 0.35, 'none',
  );
  assert.equal(decision.action, 'ask', 'a re-test is a quick check, not a fresh question');

  // The same elapsed time is not enough for a name the player has never seen.
  const unseen = advanceRouteQuiz(fresh, quizInput(), 0.1, 'none').state;
  assert.equal(advanceRouteQuiz(unseen, quizInput(), 0.35, 'none').action, 'idle',
    'a first question waits the full settle delay');
});

// Named regression (user report 2026-10-09, "asked me kinda too late"):
// riding Herenstraat → Noordsche Compagniebrug → Prinsenstraat at cruise
// (~55 m/s in world units), the 0.65 s settle covered 33 m of the 40 m
// bridge way, so the question opened at the far quay of the Keizersgracht.
check('a fast rider is asked a few metres into a short street, not at its end', () => {
  const cruise = (overrides: Partial<RouteQuizInput> = {}) => quizInput({
    roadName: 'Noordsche Compagniebrug',
    currentName: 'Herenstraat',
    speed: 165,
    movedMetres: 55 / 60,
    settleMetres: ROUTE_QUIZ_SETTLE_METRES,
    retestMetres: ROUTE_QUIZ_RETEST_METRES,
    ...overrides,
  });
  let state = advanceRouteQuiz(fresh, cruise(), 1 / 60, 'none').state;
  let metres = 0;
  let decision = advanceRouteQuiz(state, cruise(), 1 / 60, 'none');
  while (decision.action === 'idle') {
    metres += 55 / 60;
    state = decision.state;
    decision = advanceRouteQuiz(state, cruise(), 1 / 60, 'none');
    assert.ok(metres < 40, 'the question opens before the 40 m bridge way ends');
  }
  assert.equal(decision.action, 'ask');
  assert.ok(metres <= ROUTE_QUIZ_SETTLE_METRES + 1,
    `asked ${metres.toFixed(1)} m in, not after the time settle (~36 m)`);

  // Without the distance input, the old time-only settle is unchanged.
  const timeOnly = quizInput({ movedMetres: 5 });
  const nominated = advanceRouteQuiz(fresh, timeOnly, 0.1, 'none').state;
  assert.equal(advanceRouteQuiz(nominated, timeOnly, 0.1, 'none').action, 'idle',
    'a caller that passes no settle distance keeps the time settle');
});

check('the settle distance resets when the name under the rider changes', () => {
  const input = (roadName: string) => quizInput({
    roadName, movedMetres: 3, settleMetres: ROUTE_QUIZ_SETTLE_METRES,
  });
  let state = advanceRouteQuiz(fresh, input('Noordsche Compagniebrug'), 0.02, 'none').state;
  state = advanceRouteQuiz(state, input('Noordsche Compagniebrug'), 0.02, 'none').state;
  state = advanceRouteQuiz(state, input('Noordsche Compagniebrug'), 0.02, 'none').state;
  assert.equal(state.candidateMetres, 6);
  // The rider is off the bridge before it settled: the ask is about the
  // street now under the bike, measured from where it began.
  const moved = advanceRouteQuiz(state, input('Prinsenstraat'), 0.02, 'none');
  assert.equal(moved.action, 'idle');
  assert.deepEqual(moved.state, { candidateName: 'Prinsenstraat', candidateSeconds: 0, candidateMetres: 0 });
});

check('distance does not accrue while crossing a street at an angle', () => {
  const crossing = quizInput({ headingOffRoad: Math.PI / 3, movedMetres: 20, settleMetres: 8 });
  const decision = advanceRouteQuiz(fresh, crossing, 0.1, 'none');
  assert.equal(decision.action, 'idle');
  assert.equal(decision.state.candidateMetres, 0);
});

check('"You made a turn" only after a turn', () => {
  const base = { onBridge: false, transit: false, hadCorridor: true, corridorHeading: 0.1, heading: 0.1 };
  // Herenstraat straight on to the Noordsche Compagniebrug (2026-10-09).
  assert.equal(routeQuizContext({ ...base, heading: 0.15 }), 'The street name changed');
  assert.equal(routeQuizContext({ ...base, heading: 0.1 + Math.PI / 2 }), 'You made a turn');
  assert.equal(routeQuizContext({ ...base, corridorHeading: Math.PI - 0.05, heading: -Math.PI + 0.05 }),
    'The street name changed', 'the heading wraps at ±π');
  assert.equal(routeQuizContext({ ...base, corridorHeading: null }), 'You made a turn');
  assert.equal(routeQuizContext({ ...base, hadCorridor: false }), 'Where you set off');
  assert.equal(routeQuizContext({ ...base, onBridge: true }), 'Crossing a waterway');
  assert.equal(routeQuizContext({ ...base, transit: true }), 'Riding the corridor');
});

check('a name the player has proved they know is adopted, not asked', () => {
  const decision = advanceRouteQuiz(fresh, quizInput(), 0.1, 'known');
  assert.equal(decision.action, 'adopt');
  assert.equal(decision.action === 'adopt' && decision.name, 'Prinsengracht');
  assert.equal(decision.state.candidateName, '', 'adopting clears any pending candidate');
});

check('a recent miss is deferred without claiming the player knows it', () => {
  const decision = advanceRouteQuiz(fresh, quizInput(), 0.1, 'learning');
  assert.equal(decision.action, 'defer');
  assert.equal(decision.action === 'defer' && decision.name, 'Prinsengracht');
  assert.equal(decision.state.candidateName, '', 'deferring clears any pending candidate');
});

check('the road already being asked about is left alone', () => {
  const decision = advanceRouteQuiz(
    fresh, quizInput({ currentName: 'Prinsengracht' }), 1, 'none',
  );
  assert.equal(decision.action, 'idle');
  const unnamed = advanceRouteQuiz(fresh, quizInput({ roadName: '' }), 1, 'none');
  assert.equal(unnamed.action, 'idle', 'an unnamed way is never a question');
});

check('headingOffRoad folds direction of travel away', () => {
  assert.ok(Math.abs(headingOffRoad(0, 0)) < 1e-9);
  assert.ok(Math.abs(headingOffRoad(0, Math.PI) - 0) < 1e-9,
    'driving the same road backwards is still driving it');
  assert.ok(Math.abs(headingOffRoad(0, Math.PI / 2) - Math.PI / 2) < 1e-9,
    'a perpendicular crossing is the maximum offset');
});

check('the HUD never prints an unanswered name, however the bike is turned', () => {
  const base = { roadName: 'Tuinstraat', currentName: '', promptName: '', candidateName: '', revealed: false, learned: false };
  // Heading more than 45° off the road clears the candidate: the old rule
  // then printed the name.
  assert.equal(hudWithholdsRouteName(base), true, 'unasked, misaligned: withheld');
  assert.equal(hudWithholdsRouteName({ ...base, currentName: 'Tuinstraat' }), false, 'the current corridor shows');
  assert.equal(hudWithholdsRouteName({ ...base, learned: true }), false, 'an answered name shows');
  assert.equal(hudWithholdsRouteName({ ...base, revealed: true }), false, 'a name already shown shows');
  assert.equal(hudWithholdsRouteName({ ...base, currentName: 'Tuinstraat', promptName: 'Tuinstraat' }), true, 'the open question is withheld');
  assert.equal(hudWithholdsRouteName({ ...base, currentName: 'Egelantiersgracht', candidateName: 'Tuinstraat', learned: true }), true,
    'a settling candidate is withheld');
  assert.equal(hudWithholdsRouteName({ ...base, roadName: '' }), false);
});

// ---- Map labels never reveal the question (lane 2026-10-13) ----

const labelRules = (over: Partial<LabelRules> = {}): LabelRules => ({
  labelsOff: false, hiddenName: '', spoilerIndex: null, quizQuiet: false, isLabelled: () => false, ...over,
});
const screenLabel = (name: string, over: Partial<ScreenCandidate> = {}): ScreenCandidate => ({
  id: name, name, lng: 4.894, lat: 52.374, heightM: 13, cls: 'culture', rank: 50,
  x: 700, y: 450, width: 90, height: 24, distM: 200, riderDistM: 30, occluded: false, ...over,
});

check('a POI label that names the asked street is hidden while it is asked', () => {
  // "Hotel Damrak 1" on the Damrak answers "which street is this?" (handoff 2026-10-13).
  const asking = labelRules({ hiddenName: 'Damrak' });
  assert.equal(labelAllowed(asking, 'venue', 'Hotel Damrak 1'), false);
  assert.equal(labelAllowed(asking, 'culture', 'Damrak'), false, 'a POI named exactly the street');
  // Dutch compounds: word n-grams miss them, the prefix rule does not.
  assert.equal(labelAllowed(labelRules({ hiddenName: 'Keizersgracht' }), 'culture', 'Keizersgrachtkerk'), false);
  assert.equal(labelAllowed(labelRules({ hiddenName: 'Prins Hendrikkade' }), 'venue', 'Prinshendrikkadecafé'), false);
  // Not asked: the same names are ordinary cues (the all-names index aside).
  assert.equal(labelAllowed(labelRules(), 'venue', 'Hotel Damrak 1'), true);
  assert.equal(labelAllowed(labelRules({ hiddenName: 'Damrak' }), 'culture', 'Beurs van Berlage'), true);
});

check('quiz-eligible names and the quiet map hold for the label overlay too', () => {
  const index = buildSpoilerIndex(['Nassaukade', 'Majoor Bosshardtbrug']);
  assert.equal(labelAllowed(labelRules({ spoilerIndex: index }), 'venue', 'Tramhalte Nassaukade'), false);
  assert.equal(labelAllowed(labelRules({ quizQuiet: true }), 'landmark', 'Westerkerk'), false, 'nothing during a quiz');
  // The destination survives the quiet map (the HUD card names it) but never the asked name.
  assert.equal(labelAllowed(labelRules({ quizQuiet: true }), 'destination', 'Westerkerk'), true);
  assert.equal(labelAllowed(labelRules({ hiddenName: 'Keizersgracht' }), 'destination', 'Keizersgrachtkerk'), false);
});

check('the planner drops a spoiling label even when it is the best on screen', () => {
  const plan = planLabels({
    candidates: [screenLabel('Hotel Damrak 1', { rank: 999, cls: 'landmark' }), screenLabel('Beurs van Berlage', { x: 400 })],
    rules: labelRules({ hiddenName: 'Damrak' }), cameraHeightM: 250, viewport: { width: 1440, height: 900 }, hud: [],
  });
  assert.deepEqual(plan.map(p => p.id), ['Beurs van Berlage']);
});

check('labels stay within the budget, clear of the HUD, and venues stay near the rider', () => {
  assert.equal(labelBudget(250), 12, 'the Damrak viewpoint budget');
  assert.ok(labelBudget(1.7) <= 6 && labelBudget(1.7) >= 4, 'a rider\'s eye reads a street, not a directory');
  assert.ok(labelBudget(250, 390 * 844) < 12, 'a phone gets fewer');
  const many = Array.from({ length: 60 }, (_, i) => screenLabel(`Venue ${i}`, { cls: 'civic', x: 60 + (i % 10) * 130, y: 120 + Math.floor(i / 10) * 120 }));
  const plaque = { x: 0, y: 0, width: 360, height: 130 };
  const plan = planLabels({ candidates: many, rules: labelRules(), cameraHeightM: 250, viewport: { width: 1440, height: 900 }, hud: [plaque] });
  assert.equal(plan.length, 12);
  for (const p of plan) {
    const c = many.find(m => m.id === p.id)!;
    assert.ok(!(c.x - c.width / 2 < plaque.width + 6 && c.y + 3 - c.height < plaque.height + 6), `${c.name} sits on the plaque`);
  }
  const far = planLabels({ candidates: [screenLabel('Café', { cls: 'venue', riderDistM: VENUE_RADIUS_M + 1 })], rules: labelRules(), cameraHeightM: 250, viewport: { width: 1440, height: 900 }, hud: [] });
  assert.equal(far.length, 0, 'a café beyond 80 m of the rider is not a cue');
  const hidden = planLabels({ candidates: [screenLabel('Westerkerk', { cls: 'landmark', occluded: true })], rules: labelRules(), cameraHeightM: 2, viewport: { width: 1440, height: 900 }, hud: [] });
  assert.equal(hidden.length, 0, 'a label whose anchor a building hides is not drawn');
});

// ---- Street crossings cross the water (teaser ride 2026-10-22) ----
// Riding straight down the Prinsengracht quay past the Westertoren, over the
// end of the Nieuwe-Wercksbrug deck (extract_bridges_1079333700, the
// Westermarkt-Rozengracht bridge), asked "Which waterway are you crossing?
// Prinsengracht". The deck outline's bank-side edge runs along the quay and its
// gate lay across it. The street rule now asks only when the rider's track
// crosses the waterway's centreline, steeply, on the deck. Real geometry from
// the Amsterdam extract; routes are routing-extract nodes, ridden in 1 m steps
// as runtime does (recallRuntime._updateBridgeQuiz).
{
  const base = 'public/data/extracts/amsterdam';
  const read = (file: string) => JSON.parse(readFileSync(`${base}/${file}`, 'utf8'));
  const PPM = 3, LAT0 = 52.37, LNG0 = 4.89;
  const mLat = 111_320, mLng = 111_320 * Math.cos(LAT0 * Math.PI / 180);
  type LL = [number, number];
  const project = ([lat, lng]: LL): WorldPoint => ({ x: (lng - LNG0) * mLng * PPM, y: -(lat - LAT0) * mLat * PPM });
  const realBridges = buildBridges(read('bridges.json'), read('bridge-crossings.json'), project, read('water.json'));
  /** Every crossing question a street ride along `route` would fire: "bridge name|water". */
  const ride = (route: LL[]): string[] => {
    const points = route.map(project);
    const trail = new TrackTrail(CROSSING_TRAIL_METRES * PPM * 1.5);
    const asked: string[] = [];
    let previous = points[0];
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1], b = points[i];
      const length = Math.hypot(b.x - a.x, b.y - a.y);
      for (let d = Math.min(PPM, length); d <= length; d += PPM) {
        const current = { x: a.x + (b.x - a.x) * d / length, y: a.y + (b.y - a.y) * d / length };
        trail.push(previous);
        const trailStart = trail.pointBack(current, CROSSING_TRAIL_METRES * PPM);
        const water = findWaterCrossing(realBridges, previous, current, { trailStart, deckRangePx: CROSSING_DECK_METRES * PPM, searchPx: 900 });
        if (water) asked.push(`${water.bridge.name}|${water.crossing.waterway}`);
        else {
          const gated = findGateCrossing(realBridges, previous, current, trailStart, 26);
          const near = gated && nearestCrossing(gated.crossings, current.x, current.y, 900);
          if (gated && near && !(near.waterLines && near.waterLines.length)) asked.push(`${gated.name}|${near.waterway}`);
        }
        previous = current;
      }
    }
    return [...new Set(asked)];
  };
  const both = (route: LL[]) => [ride(route), ride([...route].reverse())];

  // Prinsengracht, east quay, north to south past the Westermarkt end of the deck (and back).
  const eastQuay: LL[] = [[52.374566, 4.883391], [52.374263, 4.883363], [52.374198, 4.883358], [52.374099, 4.883347],
    [52.373984, 4.883334], [52.373916, 4.883327], [52.372406, 4.883179]];
  // Prinsengracht, west quay, past the Rozengracht end.
  const westQuay: LL[] = [[52.373195, 4.882729], [52.373816, 4.882776], [52.37394, 4.8828], [52.374041, 4.88282], [52.374478, 4.882874]];
  // Westermarkt to Rozengracht over the Nieuwe-Wercksbrug: a real crossing of the Prinsengracht.
  const acrossNieuweWercksbrug: LL[] = [[52.373985, 4.883448], [52.373984, 4.883334], [52.373966, 4.883203],
    [52.373902, 4.882909], [52.373926, 4.882797], [52.373902, 4.882696], [52.37361, 4.881533]];

  check('regression: riding along the Prinsengracht over the Nieuwe-Wercksbrug deck end asks nothing (teaser 2026-10-22)', () => {
    for (const asked of [...both(eastQuay), ...both(westQuay)]) assert.deepEqual(asked, [], `asked ${asked} riding along the canal`);
  });
  check('positive control: Westermarkt to Rozengracht over the Nieuwe-Wercksbrug asks for the Prinsengracht', () => {
    for (const asked of both(acrossNieuweWercksbrug)) assert.deepEqual(asked, ['Nieuwe-Wercksbrug|Prinsengracht']);
  });

  // The canal-ring survey: every routing way of the four ring quays, chained
  // straight on through junction nodes (so a deck mapped as its own way is
  // ridden over), in both directions. Before the fix, 20 junction bridges asked
  // for the canal being ridden along (Walenweeshuissluis, De Duifbrug,
  // Torensluis, Muntsluis, Johanna Borskibrug, Isa van Eeghenbrug, ...); side
  // canals crossed at their mouths (Leliegracht, Leidsegracht, Brouwersgracht)
  // are real crossings and must still ask.
  const routing: Array<{ name: string; path?: LL[]; paths?: LL[][] }> = read('streets-routing.json');
  const nodeKey = (p: LL) => `${p[0].toFixed(6)},${p[1].toFixed(6)}`;
  const leaving = new Map<string, LL[][]>();
  for (const way of routing) for (const path of way.paths || (way.path ? [way.path] : [])) {
    if (!path || path.length < 2) continue;
    for (const run of [path, [...path].reverse()]) {
      const k = nodeKey(run[0]);
      if (!leaving.has(k)) leaving.set(k, []);
      leaving.get(k)!.push(run);
    }
  }
  const bearing = (a: LL, b: LL) => Math.atan2((b[0] - a[0]) * mLat, (b[1] - a[1]) * mLng);
  const straightOn = (run: LL[], metres: number): LL[] => {
    const out = [...run];
    for (let left = metres; left > 0;) {
      const a = out[out.length - 2], b = out[out.length - 1];
      let next: LL[] | null = null, bestTurn = 35 * Math.PI / 180;
      for (const candidate of leaving.get(nodeKey(b)) || []) {
        const delta = bearing(candidate[0], candidate[1]) - bearing(a, b);
        const turn = Math.abs(Math.atan2(Math.sin(delta), Math.cos(delta)));
        if (turn < bestTurn && nodeKey(candidate[1]) !== nodeKey(a)) { bestTurn = turn; next = candidate; }
      }
      if (!next) break;
      for (let i = 1; i < next.length; i++) { left -= Math.hypot((next[i][0] - next[i - 1][0]) * mLat, (next[i][1] - next[i - 1][1]) * mLng); out.push(next[i]); }
    }
    return out;
  };
  /** Each routing path of `street`, both ways, carried 40 m back and 60 m on. */
  const streetRuns = (street: string): LL[][] => {
    const runs: LL[][] = [];
    for (const way of routing) {
      if (way.name !== street) continue;
      for (const path of way.paths || (way.path ? [way.path] : [])) {
        if (!path || path.length < 2) continue;
        for (const run of [path, [...path].reverse()]) runs.push(straightOn(straightOn([...run].reverse(), 40).reverse(), 60));
      }
    }
    return runs;
  };

  check('regression: no canal-ring junction bridge asks for the canal being ridden along (Prinsengracht, Keizersgracht, Herengracht, Singel)', () => {
    const sameCanal = new Set<string>();
    const sideCanals = new Set<string>();
    for (const canal of ['Prinsengracht', 'Keizersgracht', 'Herengracht', 'Singel']) {
      for (const run of streetRuns(canal)) for (const asked of ride(run)) (asked.endsWith(`|${canal}`) ? sameCanal : sideCanals).add(asked);
    }
    assert.deepEqual([...sameCanal], [], 'riding along a ring canal is not crossing it');
    for (const real of ['Grote Brouwerssluis|Leliegracht', 'Beudekerbrug|Leidsegracht', 'Pieter Goemansbrug|Leidsegracht', 'Papiermolensluis|Brouwersgracht']) {
      assert.ok(sideCanals.has(real), `${real}: crossing a side canal's mouth along the quay still asks`);
    }
  });

  check('positive controls: cross streets over the ring still ask for each canal they cross', () => {
    const expected: Record<string, string[]> = {
      Vijzelstraat: ['Walenweeshuissluis|Prinsengracht', 'Johanna Borskibrug|Keizersgracht', 'Isa van Eeghenbrug|Herengracht', 'Muntsluis|Singel'],
      Raadhuisstraat: ['Niek Engelschmanbrug|Keizersgracht', 'Warmoesbrug|Herengracht', 'Huiszittenbrug|Singel'],
      Reestraat: ['Reesluis|Prinsengracht', 'Kees Fensbrug|Keizersgracht'],
      Berenstraat: ['Berensluis|Prinsengracht', 'Marten Toonderbrug|Keizersgracht'],
    };
    for (const [street, crossings] of Object.entries(expected)) {
      const asked = new Set(streetRuns(street).flatMap(ride));
      for (const want of crossings) assert.ok(asked.has(want), `${street}: ${want} should still ask (asked: ${[...asked].join(', ')})`);
    }
  });
}

console.log(`Recall rules OK: ${checks.length} checks.`);
for (const name of checks) console.log(`  · ${name}`);
