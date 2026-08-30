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

// Zuiderzeeweg carries four separate bridges over three different waters on its
// way north out of the city. Asking about "Zuiderzeeweg" once taught one of them.
{
  const crossings = published.bridges[bridgeNamed('Zuiderzeeweg').id];
  assert.equal(crossings.length, 4, 'Zuiderzeeweg should resolve to four crossings');
  assert.deepEqual(
    crossings.map((crossing) => crossing.waterway),
    ['IJmeer', 'Buiten-IJ', 'Weersloot', null],
    'Zuiderzeeweg crossings should be ordered south to north with their own waters',
  );
  // Crossings must be far enough apart that nearest-centre lookup is unambiguous.
  for (let i = 1; i < crossings.length; i++) {
    assert.ok(
      metersBetween(crossings[i - 1].center, crossings[i].center) > 200,
      'Zuiderzeeweg crossings should be hundreds of metres apart',
    );
  }
}

// IJburglaan ships 66 mapped ways. They are five bridges, not 66 and not one.
{
  const crossings = published.bridges[bridgeNamed('IJburglaan').id];
  assert.equal(crossings.length, 5, 'IJburglaan should resolve to five crossings');
  assert.equal(crossings.at(-1)!.waterway, 'IJmeer', 'the northern IJburglaan crossing spans the IJmeer');
}

// Recomputing from the extracts must reproduce the published file exactly, or
// the game is gating on crossings the generator no longer agrees with.
for (const name of ['Magere Brug', 'Zuiderzeeweg', 'IJburglaan', 'Westelijke Ringspoorbaan']) {
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

console.log('Bridge crossing and location-scoped recall checks passed.');
