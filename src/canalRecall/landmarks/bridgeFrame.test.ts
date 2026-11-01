import assert from 'node:assert/strict';
import test from 'node:test';
import { bridgeBasis, determinant, offsetArc, profileZ, segmentalArc, toModel } from './bridgeFrame';

test('the basis is a proper rotation for any bearing', () => {
  for (const bearing of [0, 69.1, 73, 180, 271.5]) assert.ok(Math.abs(determinant(bridgeBasis(bearing)) - 1) < 1e-12, `bearing ${bearing}`);
});

test('along follows the bearing and right is its clockwise side (x east, z south)', () => {
  const north = bridgeBasis(0);
  assert.deepEqual(toModel(north, 1, 0, 0).map(v => +v.toFixed(9) + 0), [0, 0, -1]);
  assert.deepEqual(toModel(north, 0, 0, 1).map(v => +v.toFixed(9) + 0), [1, 0, 0]);
  const east = bridgeBasis(90);
  assert.deepEqual(toModel(east, 1, 2, 0).map(v => +v.toFixed(9) + 0), [1, 2, 0]);
  assert.deepEqual(toModel(east, 0, 0, 1).map(v => +v.toFixed(9) + 0), [0, 0, 1]);
});

test('profileZ interpolates and clamps', () => {
  const p: [number, number][] = [[-2, 1], [0, 2], [2, 1]];
  assert.equal(profileZ(p, -5), 1);
  assert.equal(profileZ(p, -1), 1.5);
  assert.equal(profileZ(p, 0), 2);
  assert.equal(profileZ(p, 9), 1);
});

test('segmental arcs spring at the ends and crown at mid-span', () => {
  const arc = segmentalArc(9.85, 23.2, -1.4, 1.0, 16);
  assert.deepEqual(arc[0], [9.85, -1.4]);
  assert.deepEqual(arc[16], [23.2, -1.4]);
  assert.ok(Math.abs(arc[8][0] - 16.525) < 1e-9 && Math.abs(arc[8][1] - 1.0) < 1e-9);
  for (let i = 1; i < arc.length; i++) assert.ok(arc[i][0] > arc[i - 1][0]);
  const ring = offsetArc(9.85, 23.2, -1.4, 1.0, 16, 0.45);
  assert.ok(Math.abs(ring[8][1] - 1.45) < 1e-9);
  assert.throws(() => segmentalArc(0, 1, 1, 1, 4));
});
