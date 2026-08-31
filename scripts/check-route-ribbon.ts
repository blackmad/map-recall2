// What the game rewards, and what it remembers.
//
// The ribbon is the game's statement of what it values, so its edges are worth
// pinning: speed is not an input, a recall gate sits above the blended score,
// and every navigation aid you leaned on costs you.

import assert from 'node:assert/strict';

import {
  computeRouteRibbon,
  idealRouteLength,
  RIBBON_AID_COST,
  ROUTE_RIBBON_TIERS,
  type RibbonInput,
} from '../src/canalRecall/game/routeRibbon';
import {
  emptyExploration,
  explorationGain,
  getBestTime,
  mergeExploration,
  pixelsToMiles,
  readExploration,
  recordBestTime,
  saveExploration,
  type BestTime,
  type KeyValueStore,
} from '../src/canalRecall/game/progressStore';

const checks: string[] = [];
function check(name: string, run: () => void): void {
  run();
  checks.push(name);
}

function ribbon(overrides: Partial<RibbonInput> = {}) {
  return computeRouteRibbon({
    correct: 10, attempts: 10,
    aidsUsed: {}, typedAnswers: false,
    idealPx: 1000, actualPx: 1000,
    ...overrides,
  });
}

// ---- The ribbon ----

check('a perfect unaided run takes gold', () => {
  const result = ribbon();
  assert.equal(result.id, 'gold');
  assert.equal(result.score, 1);
});

check('speed is not an input', () => {
  // There is nowhere to pass a time, by construction. The two runs below differ
  // only in how far they wandered, and that is efficiency, not pace.
  const direct = ribbon({ idealPx: 1000, actualPx: 1000 });
  const wandering = ribbon({ idealPx: 1000, actualPx: 2000 });
  assert.ok(direct.score > wandering.score,
    'wasted distance costs; the clock does not exist');
});

check('the recall gate outranks the blended score', () => {
  // A spotless, efficient, entirely unaided run that never named anything.
  const silent = ribbon({ correct: 0, attempts: 10 });
  assert.equal(silent.id, 'none',
    'naming nothing cannot buy a ribbon however clean the driving was');

  // And a player who knew where they were, but leaned on every aid.
  const knowing = ribbon({
    correct: 10, attempts: 10, aidsUsed: { line: true, arrow: true, minimap: true },
  });
  assert.ok(knowing.score > silent.score,
    'knowing the city beats driving it well but blindly');
});

check('each tier has to clear both its score and its recall gate', () => {
  // 60% recall clears silver's score band but not gold's recall gate.
  const result = ribbon({ correct: 6, attempts: 10 });
  assert.ok(result.score >= ROUTE_RIBBON_TIERS[1].min,
    `expected a silver-band score, got ${result.score.toFixed(3)}`);
  assert.equal(result.id, 'silver', 'gold needs 80% recall, not just the score');
});

check('every aid used costs self-reliance', () => {
  const unaided = ribbon();
  let previous = unaided.score;
  for (const aid of ['minimap', 'arrow', 'line'] as const) {
    const withAid = ribbon({ aidsUsed: { [aid]: true } });
    assert.ok(withAid.score < unaided.score, `${aid} must cost something`);
    previous = withAid.score;
  }
  assert.ok(previous > 0, 'sanity');
  // The route line removes the navigation problem entirely, so it costs most.
  assert.ok(RIBBON_AID_COST.line > RIBBON_AID_COST.arrow);
  assert.ok(ribbon({ aidsUsed: { line: true } }).score < ribbon({ aidsUsed: { arrow: true } }).score);
});

check('typing buys back some of the aid cost', () => {
  const picking = ribbon({ aidsUsed: { minimap: true }, typedAnswers: false });
  const typing = ribbon({ aidsUsed: { minimap: true }, typedAnswers: true });
  assert.ok(typing.score > picking.score,
    'recalling a name unprompted is harder than picking it from four');
});

check('self-reliance never leaves 0..1', () => {
  const everyAid = ribbon({ aidsUsed: { line: true, arrow: true, minimap: true }, typedAnswers: false });
  const aids = everyAid.axes.find(axis => axis.id === 'aids');
  assert.equal(aids?.score, 0, 'using everything floors the axis rather than going negative');

  const typedUnaided = ribbon({ typedAnswers: true });
  assert.equal(typedUnaided.axes.find(axis => axis.id === 'aids')?.score, 1,
    'the typing bonus cannot push the axis above full marks');
});

check('a route with nothing to name settles at ROUTE COMPLETE', () => {
  const result = ribbon({ correct: 0, attempts: 0 });
  assert.equal(result.id, 'none', 'no questions asked is not a free gold');
  assert.equal(result.axes.find(axis => axis.id === 'recall')?.score, 0);
});

check('efficiency is dropped rather than guessed when there is no route length', () => {
  const result = ribbon({ idealPx: 0, actualPx: 0 });
  assert.equal(result.axes.some(axis => axis.id === 'efficiency'), false,
    'an unmeasurable axis must not be scored as zero and drag the ribbon down');
  assert.equal(result.id, 'gold', 'the remaining axes still weigh correctly');
});

check('efficiency tolerates a slight overshoot but not wandering', () => {
  const clean = ribbon({ idealPx: 900, actualPx: 1000 });
  assert.equal(clean.axes.find(axis => axis.id === 'efficiency')?.score, 1,
    '90% of ideal is a full score; even a clean run overshoots the graph route');

  const lost = ribbon({ idealPx: 550, actualPx: 1000 });
  assert.equal(lost.axes.find(axis => axis.id === 'efficiency')?.score, 0,
    'at 55% of ideal the player has driven nearly twice the route');
});

check('idealRouteLength prefers the length planned at the start', () => {
  const path = [{ x: 0, y: 0 }, { x: 300, y: 400 }];
  assert.equal(idealRouteLength(1234, path), 1234,
    'the live line is consumed as the player advances, so it cannot be the reference');
  assert.equal(idealRouteLength(0, path), 500);
  assert.equal(idealRouteLength(0, null), 0);
  assert.equal(idealRouteLength(0, [{ x: 0, y: 0 }]), 0, 'one point is not a route');
});

// ---- Persistence ----

function memoryStore(seed: Record<string, string> = {}): KeyValueStore & { data: Record<string, string> } {
  const data = { ...seed };
  return {
    data,
    getItem: key => (key in data ? data[key] : null),
    setItem: (key, value) => { data[key] = value; },
  };
}

const RUN: BestTime = { time: 100, date: '2026-08-31T00:00:00.000Z', distance: 1.5 };

check('a personal best is only written when it is actually better', () => {
  const store = memoryStore();
  assert.equal(recordBestTime(store, 'route-a', RUN), true, 'the first run is a best');
  assert.equal(getBestTime(store, 'route-a')?.time, 100);

  assert.equal(recordBestTime(store, 'route-a', { ...RUN, time: 120 }), false, 'slower is not a best');
  assert.equal(getBestTime(store, 'route-a')?.time, 100);
  assert.equal(recordBestTime(store, 'route-a', { ...RUN, time: 100 }), false, 'nor is a tie');

  assert.equal(recordBestTime(store, 'route-a', { ...RUN, time: 90 }), true);
  assert.equal(getBestTime(store, 'route-a')?.time, 90);
});

check('a route with no key records nothing', () => {
  const store = memoryStore();
  assert.equal(recordBestTime(store, null, RUN), false);
  assert.equal(getBestTime(store, null), null);
  assert.deepEqual(store.data, {});
});

check('bests evict oldest-first once the cap is reached', () => {
  const store = memoryStore();
  for (let i = 0; i < 5; i++) {
    recordBestTime(store, `route-${i}`, { ...RUN, date: `2026-08-0${i + 1}T00:00:00.000Z` }, 3);
  }
  const kept = Object.keys(JSON.parse(store.data['satb_bestTimes']));
  assert.equal(kept.length, 3);
  assert.deepEqual(kept.sort(), ['route-2', 'route-3', 'route-4'],
    'the routes a player has moved past are the ones dropped');
});

check('corrupt storage yields a fresh collection rather than a broken game', () => {
  const store = memoryStore({ satb_bestTimes: '{not json', 'canalRecall.exploration.v1': 'null' });
  assert.deepEqual(getBestTime(store, 'route-a'), null);
  assert.deepEqual(readExploration(store), emptyExploration());
});

check('a stored collection missing a newer field is not blanked', () => {
  const store = memoryStore({
    'canalRecall.exploration.v1': JSON.stringify({ learnedStreets: ['Nes'], totalRoutes: 4 }),
  });
  const exploration = readExploration(store);
  assert.deepEqual(exploration.learnedStreets, ['Nes'], 'what was stored survives');
  assert.equal(exploration.totalRoutes, 4);
  assert.deepEqual(exploration.seenLandmarks, [], 'and what was missing defaults');
});

check('waterways and streets are collected apart', () => {
  const byBoat = mergeExploration(emptyExploration(), {
    byBoat: true, learnedNames: ['Singel'], visitedNeighborhoods: [], seenLandmarkNames: [],
    correct: 1, attempts: 2,
  });
  assert.deepEqual(byBoat.learnedWaterways, ['Singel']);
  assert.deepEqual(byBoat.learnedStreets, [], 'a canal is not a street');

  const thenByCar = mergeExploration(byBoat, {
    byBoat: false, learnedNames: ['Nes'], visitedNeighborhoods: ['Centrum'], seenLandmarkNames: ['Dam'],
    correct: 2, attempts: 2,
  });
  assert.deepEqual(thenByCar.learnedWaterways, ['Singel'], 'the earlier body of knowledge is kept');
  assert.deepEqual(thenByCar.learnedStreets, ['Nes']);
  assert.equal(thenByCar.totalRoutes, 2);
  assert.equal(thenByCar.totalCorrect, 3);
  assert.equal(thenByCar.totalAttempts, 4);
});

check('driving the same street twice does not count it twice', () => {
  const once = mergeExploration(emptyExploration(), {
    byBoat: false, learnedNames: ['Nes', 'Nes'], visitedNeighborhoods: ['Centrum'],
    seenLandmarkNames: [], correct: 1, attempts: 1,
  });
  const twice = mergeExploration(once, {
    byBoat: false, learnedNames: ['Nes'], visitedNeighborhoods: ['Centrum'],
    seenLandmarkNames: [], correct: 1, attempts: 1,
  });
  assert.deepEqual(twice.learnedStreets, ['Nes']);
  assert.deepEqual(twice.visitedNeighborhoods, ['Centrum']);
  assert.equal(twice.totalRoutes, 2, 'but the route itself still counts');
});

check('the finish screen can tell what this route added', () => {
  const before = emptyExploration();
  const after = mergeExploration(before, {
    byBoat: false, learnedNames: ['Nes', 'Damrak'], visitedNeighborhoods: ['Centrum'],
    seenLandmarkNames: ['Dam', 'Beurs'], correct: 2, attempts: 2,
  });
  assert.deepEqual(explorationGain(before, after),
    { newNames: 2, newNeighborhoods: 1, newLandmarks: 2 });
  assert.deepEqual(explorationGain(after, after),
    { newNames: 0, newNeighborhoods: 0, newLandmarks: 0 }, 'a repeat route adds nothing new');
});

check('saved collections round-trip', () => {
  const store = memoryStore();
  const exploration = mergeExploration(emptyExploration(), {
    byBoat: true, learnedNames: ['Singel'], visitedNeighborhoods: [], seenLandmarkNames: [],
    correct: 1, attempts: 1,
  });
  saveExploration(store, exploration);
  assert.deepEqual(readExploration(store), exploration);
});

check('stored distance is miles, to two decimals', () => {
  // 3 px per metre; 1609.344 m to the mile.
  assert.equal(pixelsToMiles(1609.344 * 3, 3), 1);
  assert.equal(pixelsToMiles(0, 3), 0);
});

console.log(`Route ribbon and progress OK: ${checks.length} checks.`);
for (const name of checks) console.log(`  · ${name}`);
