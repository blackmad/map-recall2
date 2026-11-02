import {test} from 'node:test';
import assert from 'node:assert/strict';
import {roundedBandOutline} from './roundedBand';

const area = (r: [number, number][]) => r.reduce((a, p, i) => { const q = r[(i + 1) % r.length]; return a + p[0] * q[1] - q[0] * p[1]; }, 0) / 2;

test('no radii: the plain rectangle, counter-clockwise', () => {
  const r = roundedBandOutline(4, 2);
  assert.deepEqual(r, [[0, 0], [4, 0], [4, 2], [0, 2]]);
  assert.equal(area(r), 8);
});

test('one rounded corner removes the corner square minus the quarter disc', () => {
  const r = roundedBandOutline(10, 2, {bottomLeft: 1.5}, 64);
  assert.ok(area(r) > 0, 'counter-clockwise');
  const expected = 20 - (1.5 * 1.5 - Math.PI * 1.5 * 1.5 / 4);
  assert.ok(Math.abs(area(r) - expected) < 0.01);
  assert.ok(r.every(([t, y]) => t >= -1e-9 && t <= 10 + 1e-9 && y >= -1e-9 && y <= 2 + 1e-9), 'stays inside its box');
  assert.ok(!r.some(([t, y]) => t < 0.2 && y < 0.2), 'the bottom-left corner is cut away');
});

test('radii sharing a side are scaled to fit it, so the outline never folds', () => {
  const r = roundedBandOutline(3, 1, {bottomLeft: 5, topLeft: 5}, 16);
  assert.ok(area(r) > 0);
  assert.ok(Math.abs(area(r) - (3 - 2 * (0.25 - Math.PI * 0.25 / 4))) < 0.01, 'two quarter discs of radius 0.5 = one half disc at the left end');
});

test('rejects an empty band', () => {
  assert.throws(() => roundedBandOutline(0, 1));
});
