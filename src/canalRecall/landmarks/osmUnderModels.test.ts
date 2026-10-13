import test from 'node:test';
import assert from 'node:assert/strict';
import {nativeRingToLngLat, orientedRectRing, overlapFraction, unsuppressedUnder, ringAreaM2, type Ring} from './osmUnderModels';

const C: [number, number] = [4.9, 52.37];
const square = (centre: [number, number], side: number, heading = 0): Ring => orientedRectRing(centre, heading, side, side);
const shift = (c: [number, number], eastM: number, northM: number): [number, number] =>
  [c[0] + eastM / (111320 * Math.cos(c[1] * Math.PI / 180)), c[1] + northM / 111320];

test('oriented rect has the stated area and rotates with heading', () => {
  assert.ok(Math.abs(ringAreaM2(orientedRectRing(C, 30, 40, 10)) - 400) < 2);
  const r0 = orientedRectRing(C, 0, 40, 10), r90 = orientedRectRing(C, 90, 40, 10);
  const w = (r: Ring) => Math.max(...r.map(p => p[0])) - Math.min(...r.map(p => p[0]));
  assert.ok(w(r90) > 3 * w(r0));
});
test('nativeRing is east/south metres from the anchor', () => {
  const ring = nativeRingToLngLat([[0, 0], [10, 0], [10, 10], [0, 10]], C);
  assert.ok(ring[2][1] < C[1] && ring[2][0] > C[0]);
  assert.ok(Math.abs(ringAreaM2(ring) - 100) < 2);
});
test('overlapFraction: contained, half, disjoint', () => {
  const model = [square(C, 40)];
  assert.ok(overlapFraction(square(C, 10), model) > .99);
  assert.ok(Math.abs(overlapFraction(square(shift(C, 20, 0), 10), model) - .5) < .06);
  assert.equal(overlapFraction(square(shift(C, 200, 0), 10), model), 0);
});
test('a neighbour whose centroid clips the model corner is not a hit; one mostly inside is', () => {
  const model = [square(C, 40)];
  const outside = {id: 'w1', height: 9, rings: [square(shift(C, 26, 0), 10)]};
  const clipping = {id: 'w2', height: 9, rings: [square(shift(C, 24, 0), 10)]}; // only ~10% of its area inside
  const inside = {id: 'w3', height: 12, rings: [square(shift(C, 5, 5), 10)]};
  const hits = unsuppressedUnder(model, [outside, clipping, inside], new Set());
  assert.deepEqual(hits.map(h => h.id), ['w3']);
  assert.equal(hits[0].height, 12);
});
test('suppressed and other-model-claimed ids are not reported', () => {
  const model = [square(C, 40)];
  const b = [{id: 'a', height: 5, rings: [square(C, 10)]}, {id: 'b', height: 5, rings: [square(shift(C, 5, 0), 10)]}, {id: 'c', height: 5, rings: [square(shift(C, -5, 0), 10)]}];
  assert.deepEqual(unsuppressedUnder(model, b, new Set(['a']), new Set(['b'])).map(h => h.id), ['c']);
});
test('L-shaped footprint: a building in the notch is not a hit', () => {
  const L: Ring = [[0, 0], [30, 0], [30, 10], [10, 10], [10, 30], [0, 30]].map(([e, n]) => shift(C, e, n));
  const inNotch = {id: 'n', height: 5, rings: [square(shift(C, 22, 22), 8)]};
  assert.equal(unsuppressedUnder([L], [inNotch], new Set()).length, 0);
});

test('soupFootprint: a placed box occupies its ground area and honours northOffset', async () => {
  const {soupFootprint} = await import('./osmUnderModels');
  // 20 (east) x 10 (south) box, 6 m tall: two roof triangles at y=6 and four wall quads.
  const [x0, x1, z0, z1] = [-10, 10, -5, 5], y = 6;
  const positions = [x0, y, z0, x1, y, z0, x1, y, z1, x0, y, z1, x0, 0, z0, x1, 0, z0, x1, 0, z1, x0, 0, z1];
  const indices = [0, 1, 2, 0, 2, 3, 0, 4, 5, 0, 5, 1, 1, 5, 6, 1, 6, 2, 2, 6, 7, 2, 7, 3, 3, 7, 4, 3, 4, 0];
  const north0 = soupFootprint(positions, indices, C, 0)!;
  assert.ok(north0.contains(C) && north0.contains(shift(C, 8, 3)) && !north0.contains(shift(C, 8, 8)) && !north0.contains(shift(C, 12, 0)));
  // +X is east at northOffset 0; turned 90 degrees clockwise it points south, so the long axis runs north-south.
  const turned = soupFootprint(positions, indices, C, 90)!;
  assert.ok(turned.contains(shift(C, 0, -8)) && turned.contains(shift(C, 0, 8)) && !turned.contains(shift(C, 8, 0)));
  // Flat paving below the 2.5 m floor is not "the building".
  assert.equal(soupFootprint([x0, 0.2, z0, x1, 0.2, z0, x1, 0.2, z1], [0, 1, 2], C, 0), null);
  // overlapFraction against it: a house inside the box is a hit, a neighbour beside it is not.
  assert.ok(overlapFraction(square(shift(C, 3, 0), 4), north0) > .99);
  assert.equal(overlapFraction(square(shift(C, 20, 0), 4), north0), 0);
});
