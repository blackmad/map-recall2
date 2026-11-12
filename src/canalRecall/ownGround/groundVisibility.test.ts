import { test } from 'node:test';
import assert from 'node:assert/strict';
import { concentration, crossWeight, distanceGrid, segmentsOf, visWeight, weightField } from './groundVisibility.ts';

test('visibility: full within 15 m, linear to 0 at 60 m', () => {
  assert.equal(visWeight(0), 1); assert.equal(visWeight(15), 1); assert.equal(visWeight(60), 0); assert.equal(visWeight(100), 0);
  assert.ok(Math.abs(visWeight(37.5) - 0.5) < 1e-9);
});
test('crossing: x3 within 30 m of a structure only', () => { assert.equal(crossWeight(30), 3); assert.equal(crossWeight(30.1), 1); });
test('distanceGrid measures to the nearest segment and caps', () => {
  const d = distanceGrid(segmentsOf([[0, 0], [100, 0]]), 0, 0, 10, 10, 60);
  assert.ok(d[0] < 6, `${d[0]}`); assert.ok(Math.abs(d[9 * 10] - 60) < 1e-6 || d[9 * 10] >= 60 - 1e-6 || d[9 * 10] > 59);
});
test('weightField: a way next to a structure outweighs the same way alone, and far ground is 0', () => {
  const way = segmentsOf([[0, 0], [200, 0]]), deck = segmentsOf([[100, 0], [100, 10]]);
  const alone = weightField(way, [], 0, -50, 200), near = weightField(way, deck, 0, -50, 200);
  assert.equal(alone.at(100, 5), 1); assert.equal(near.at(100, 5), 3); assert.equal(near.at(100, 90 - 50), alone.at(100, 40));
  assert.equal(weightField(way, [], 0, 0, 200).at(100, 190), 0);
});
test('concentration: density, priority factor, area floor', () => {
  assert.equal(concentration(1000, 10_000, 0), 1000);
  assert.equal(concentration(1000, 10_000, 1), 2000);
  assert.equal(concentration(10, 1, 0), 20);
});
