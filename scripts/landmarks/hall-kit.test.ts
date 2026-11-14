import assert from 'node:assert/strict';
import {test} from 'node:test';
import {blobOutline, glasshouseRidges, graffitiLayout, sawtoothOutline, scallopOutline, seeded, spokeTips, strokePattern} from './hall-kit';

test('sawtoothOutline walks valley, apex, valley over the eaves', () => {
  const pts = sawtoothOutline({valleys: [0, 4, 8], apexes: [3, 7], eaves: 6, apex: 8});
  assert.deepEqual(pts[0], [0, 6]);
  assert.deepEqual(pts[pts.length - 1], [8, 6]);
  const apexes = pts.filter(([, y]) => y === 8).map(([s]) => s);
  assert.deepEqual(apexes, [3, 7]);
  for (let k = 1; k < pts.length; k++) assert.ok(pts[k][0] >= pts[k - 1][0], 'monotone along s');
});

test('glasshouseRidges centres one ridge per equal bay', () => {
  assert.deepEqual(glasshouseRidges(0, 12, 4), [1.5, 4.5, 7.5, 10.5]);
  assert.equal(glasshouseRidges(-2, 2, 1)[0], 0);
});

test('scallopOutline keeps the rake as its top edge and hangs below it', () => {
  const pts = scallopOutline(0, 6, 4, 8, 0.4, 5, 6);
  assert.deepEqual(pts[0], [0, 6]);
  assert.deepEqual(pts[1], [4, 8]);
  assert.equal(pts.length, 2 + 5 * 7);
  // every scallop point lies below the rake line y = 6 + s/2
  for (const [s, y] of pts.slice(2)) assert.ok(y < 6 + s / 2 + 1e-9);
});

test('spokeTips spread evenly at radius r, drooping', () => {
  const tips = spokeTips(6, 3, 5.4, 0.4);
  assert.equal(tips.length, 6);
  for (const [x, y, z] of tips) { assert.ok(Math.abs(Math.hypot(x, z) - 3) < 1e-9); assert.ok(Math.abs(y - 5.0) < 1e-9); }
});

test('seeded, graffiti layout and stroke patterns are deterministic', () => {
  const a = seeded(7), b = seeded(7);
  for (let k = 0; k < 5; k++) assert.equal(a(), b());
  const l1 = graffitiLayout(0, 20, 0.3, 3, 42, ['#fff', '#f0f']), l2 = graffitiLayout(0, 20, 0.3, 3, 42, ['#fff', '#f0f']);
  assert.deepEqual(l1, l2);
  assert.ok(l1.length > 2);
  for (const p of l1) { assert.ok(p.t - p.rx >= 0 && p.t + p.rx <= 20); assert.ok(p.y >= 0.3 && p.y + 2 * p.ry <= 3 + 1e-9); assert.ok(p.letters >= 2); }
  assert.deepEqual(strokePattern(3), strokePattern(3));
  for (const [x, y, w, h] of strokePattern(5)) assert.ok(x >= 0 && y >= 0 && x + w <= 1 && y + h <= 1);
  assert.equal(blobOutline(1, 0.5).length, 14);
});
