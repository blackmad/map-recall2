/**
 * Named regression locations for per-crossing bridge identity and the water
 * beneath each crossing, plus the pure clustering and locality rules the game
 * gates its questions on.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  BridgeCrossingIndex, BridgeSource, WaterSource, clusterSpans, findBridgeCrossings, nearestCrossing,
} from '../src/canalRecall/bridgeCrossings';
import {
  LocalReviewState, chunkCenter, isKnownNear, isSuppressedNear, metersBetween,
  RECALL_CHUNK_METERS, RECALL_LOCAL_RADIUS_METERS,
} from '../src/canalRecall/recallChunks';

const extractDir = resolve(dirname(fileURLToPath(import.meta.url)), '../public/data/extracts/amsterdam');
const bridges = JSON.parse(readFileSync(resolve(extractDir, 'bridges.json'), 'utf8')) as BridgeSource[];
const waters = JSON.parse(readFileSync(resolve(extractDir, 'water.json'), 'utf8')) as WaterSource[];
const published = JSON.parse(readFileSync(resolve(extractDir, 'bridge-crossings.json'), 'utf8')) as BridgeCrossingIndex;

const bridgeNamed = (name: string): BridgeSource => {
  const found = bridges.find((bridge) => bridge.name === name);
  assert.ok(found, `${name} is missing from the bridge extract`);
  return found;
};

// ---- Named crossings -------------------------------------------------------
// Single-span city bridges must stay single crossings over the right water.
for (const [name, waterway] of [
  ['Magere Brug', 'Amstel'],
  ['Blauwbrug', 'Amstel'],
  ['Hoge Sluis', 'Amstel'],
  ['Berlagebrug', 'Amstel'],
  ['Torensluis', 'Singel'],
] as const) {
  const crossings = published.bridges[bridgeNamed(name).id];
  assert.ok(crossings, `${name} has no published crossings`);
  assert.equal(crossings.length, 1, `${name} should be one crossing, got ${crossings.length}`);
  assert.equal(crossings[0].waterway, waterway, `${name} should cross the ${waterway}`);
  // The alternatives have to be a real test: nearby water, not four unrelated
  // canals from the other side of the city.
  assert.ok(crossings[0].waterDistractors.length >= 2,
    `${name} needs plausible wrong answers for the water beneath it`);
  assert.ok(!crossings[0].waterDistractors.includes(waterway),
    `${name} must not offer ${waterway} twice`);
}
// Named distractor regression: the Magere Brug crosses the Amstel, and the
// canals it should be confused with are the ones that meet it there.
{
  const crossing = published.bridges[bridgeNamed('Magere Brug').id][0];
  assert.deepEqual(crossing.waterDistractors.slice(0, 2), ['Prinsengracht', 'Nieuwe Prinsengracht']);
  assert.equal(crossing.waterwayType, 'water', 'the Amstel is a river, and its type is part of its review key');
}

// A road is not a bridge.
//
// Zuiderzeeweg and IJburglaan each carry several separate bridges over
// different waters on their way out of the city, and both used to be published
// as a single bridge feature — so "which bridge is this?" was answered with the
// name of the road, once, for four different structures. The extractor prefers
// OSM's `bridge:name` over the carried road's `name`, which splits them into
// the structures they actually are.
//
// This is the same principle the crossing clustering exists for, one level up:
// identity first, then per-crossing geometry.
{
  for (const road of ['Zuiderzeeweg', 'IJburglaan']) {
    assert.ok(!bridges.some((bridge) => bridge.name === road),
      `${road} is a road; its bridges belong under their own names`);
  }
  // The structures that road carries, each over its own water.
  const structures: Array<[string, string]> = [
    ['Schellingwouderbrug', 'Buiten-IJ'],
    ['Amsterdamschebrug', 'IJmeer'],
    ['Zeeburgerbrug', 'IJmeer'],
    ['Enneüs Heermabrug', 'IJmeer'],
  ];
  const centres: Array<[number, number]> = [];
  for (const [name, water] of structures) {
    const bridge = bridges.find((candidate) => candidate.name === name);
    assert.ok(bridge, `${name} should be published as its own bridge`);
    const crossings = published.bridges[bridge.id];
    assert.ok(crossings?.length, `${name} should resolve to at least one crossing`);
    assert.ok(crossings.some((crossing) => crossing.waterway === water),
      `${name} should cross the ${water}`);
    centres.push(crossings[0].center);
  }
  // And they must be far enough apart that the nearest-centre lookup which
  // picks one at runtime is unambiguous.
  for (let i = 0; i < centres.length; i++) {
    for (let j = i + 1; j < centres.length; j++) {
      assert.ok(metersBetween(centres[i], centres[j]) > 200,
        `${structures[i][0]} and ${structures[j][0]} must be distinguishable by position`);
    }
  }
}


// Recomputing from the extracts must reproduce the published file exactly, or
// the game is gating on crossings the generator no longer agrees with.
for (const name of ['Magere Brug', 'Schellingwouderbrug', 'Enneüs Heermabrug', 'Westelijke Ringspoorbaan']) {
  const bridge = bridgeNamed(name);
  assert.deepEqual(
    findBridgeCrossings(bridge, waters), published.bridges[bridge.id],
    `${name} crossings drifted from the published extract — re-run build:bridge-crossings`,
  );
}

// ---- Clustering rules ------------------------------------------------------
{
  // Two parallel decks 20 m apart are one crossing; a third 500 m away is not.
  const deck = [{ x: 0, y: 0 }, { x: 40, y: 0 }];
  const cycleDeck = [{ x: 0, y: 20 }, { x: 40, y: 20 }];
  const farBridge = [{ x: 0, y: 520 }, { x: 40, y: 520 }];
  const groups = clusterSpans([deck, cycleDeck, farBridge]).map((group) => group.sort());
  assert.equal(groups.length, 2);
  assert.ok(groups.some((group) => group.length === 2 && group[0] === 0 && group[1] === 1));
}
assert.equal(nearestCrossing([{ x: 0, y: 0 }, { x: 100, y: 0 }], 90, 0)!.x, 100);
assert.equal(nearestCrossing([{ x: 0, y: 0 }], 500, 0, 100), null, 'a far traversal matches no crossing');

// ---- Location-scoped recall ------------------------------------------------
const overtoomWest: [number, number] = [52.3626, 4.8570];
const overtoomEast: [number, number] = [52.3608, 4.8790];
assert.ok(metersBetween(overtoomWest, overtoomEast) > RECALL_LOCAL_RADIUS_METERS,
  'the two ends of the Overtoom must be far enough apart to be separate knowledge');

// A point and its chunk centre are always within the cell, so the recorded
// centre never lands outside the radius that reads it back.
for (const point of [overtoomWest, overtoomEast, [52.3, 4.9] as [number, number]]) {
  assert.ok(metersBetween(point, chunkCenter(point)) <= RECALL_CHUNK_METERS,
    'a chunk centre must stay within one cell of the point that produced it');
}
// Neighbouring points share a key, so answering once does not re-ask a block later.
assert.deepEqual(chunkCenter([52.36260, 4.85700]), chunkCenter([52.36265, 4.85710]));

const state = (name: string, center: [number, number], overrides: Partial<LocalReviewState> = {}): LocalReviewState => ({
  dueAt: 10_000, repetitions: 1, mode: 'guess_name',
  featureSnapshot: { name, cityId: 'amsterdam', center }, ...overrides,
});
const known = [state('Overtoom', chunkCenter(overtoomWest))];
const query = { states: known, name: 'Overtoom', cityId: 'amsterdam', now: 0 };
assert.ok(isKnownNear({ ...query, point: overtoomWest }), 'the answered end of the Overtoom is known');
assert.ok(!isKnownNear({ ...query, point: overtoomEast }), 'the far end of the Overtoom is still unlearned');
assert.ok(!isKnownNear({ ...query, name: 'Kinkerstraat', point: overtoomWest }), 'knowledge does not leak between names');
assert.ok(!isKnownNear({ ...query, cityId: 'utrecht', point: overtoomWest }), 'knowledge does not leak between cities');
assert.ok(!isKnownNear({ ...query, point: overtoomWest, now: 20_000 }), 'a lapsed interval is not knowledge');

// A wrong answer parks the question for ten minutes without ever counting as
// knowing it — which is exactly the difference the bridge gate depends on.
const missed = [state('Prinsengracht', chunkCenter(overtoomWest), { repetitions: 0 })];
const missedQuery = { states: missed, name: 'Prinsengracht', cityId: 'amsterdam', point: overtoomWest, now: 0 };
assert.ok(isSuppressedNear(missedQuery), 'a fresh wrong answer is not re-asked immediately');
assert.ok(!isKnownNear(missedQuery), 'a wrong answer must never unlock the bridge above it');

// `bridges.json` and `bridge-crossings.json` are a matched pair keyed on
// bridge id, and nothing else enforces that they describe the same city.
//
// This is a named regression. A rebuild of `bridges.json` alone renumbered
// every id and orphaned the crossing index: matching bridges fell from 257 of
// 300 to 28. Nothing crashed, which is what made it dangerous — the runtime
// falls back to a synthetic crossing with no waterway, so 229 bridges silently
// lost the water beneath them and the water-before-bridge rule stopped
// applying across the whole city. Rebuild the two together.
{
  const published = JSON.parse(
    readFileSync(resolve(extractDir, 'bridge-crossings.json'), 'utf8'),
  ) as { bridges?: Record<string, unknown[]> };
  const index = published.bridges ?? {};
  const indexedIds = Object.keys(index);
  assert.ok(indexedIds.length > 0, 'bridge-crossings.json publishes crossings');

  const bridgeIds = new Set(bridges.map(bridge => bridge.id));
  const orphaned = indexedIds.filter(id => !bridgeIds.has(id));
  assert.deepEqual(orphaned.slice(0, 5), [],
    `${orphaned.length} of ${indexedIds.length} crossing-index entries name a bridge that `
    + 'no longer exists; rebuild bridge-crossings.json in the same change as bridges.json');

  // The pair is only useful if most named bridges actually resolve to their
  // real crossings. A loose floor: this is 86% today and was 9% when broken.
  const matched = bridges.filter(bridge => index[bridge.id]).length;
  assert.ok(matched / bridges.length > 0.5,
    `only ${matched} of ${bridges.length} bridges resolve to a published crossing`);
}

console.log('Bridge crossing and location-scoped recall checks passed.');
