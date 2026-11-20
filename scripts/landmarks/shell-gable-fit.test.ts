import {test} from 'node:test';
import assert from 'node:assert/strict';
import {bellCrestOutline, frameCoords, isSymmetric, pointedGableOutline, reshapeShell} from './shell-gable-fit';
import {signedArea} from './neck-gable';
import type {Frame} from './nearbar-kit';
import type {Surface} from './worship-shell';

// a front along +x at z = 0, the building to the north (z < 0): outward normal +z
const f: Frame = {origin: [0, 0], tangent: [1, 0], n: [0, 1]};

test('frameCoords: t along the wall, d positive into the building', () => {
  assert.deepEqual(frameCoords(f, 3, -2), {t: 3, d: 2});
});

test('outlines are symmetric about their axis and wound counter-clockwise', () => {
  const p = pointedGableOutline({axis: 5, half: 2.7, footY: 14.3, apexY: 18.1});
  assert.ok(isSymmetric(p, 5));
  assert.ok(signedArea(p) > 0);
  const b = bellCrestOutline({axis: 3.4, half: 1.8, neckHalf: 0.8, footY: 20, shoulderY: 21, neckTopY: 21.3});
  assert.ok(isSymmetric(b, 3.4));
  assert.ok(signedArea(b) > 0);
  assert.ok(Math.abs(Math.max(...b.map(q => q[1])) - 22.1) < 1e-9);
});

test('reshapeShell clamps a lopsided front to one eaves line, snaps the ridge and drops collapsed walls', () => {
  const surfaces: Surface[] = [
    // the front wall with an off-centre lump at x = 3 (18.4 m) and eaves of 13.9 and 14.7
    {type: 'WallSurface', rings: [[[0, 0, 0], [10, 0, 0], [10, 14.7, 0], [3, 18.4, 0], [0, 13.9, 0]]]},
    // a 30 cm step between roof planes, 2.5 m back
    {type: 'WallSurface', rings: [[[2, 17.1, -2.5], [4, 17.1, -2.5], [4, 17.6, -2.5], [2, 17.6, -2.5]]]},
    // a ground-floor wall far below the eaves is untouched
    {type: 'WallSurface', rings: [[[0, 0, -0.1], [0, 5, -0.1], [0, 5, -3], [0, 0, -3]]]},
  ];
  const out = reshapeShell(surfaces, {fronts: [{frame: f, t0: 0, t1: 10, front: 0.6, eaves: 14.3, ridge: {lo: 16.8, hi: 18.6, to: 17.4, maxDepth: 4}}]});
  assert.equal(out.length, 2);
  assert.deepEqual(out[0].rings[0].map(p => p[1]), [0, 0, 14.3, 14.3, 14.3]);
  assert.deepEqual(out[1].rings[0].map(p => p[1]), [0, 5, 5, 0]);
  assert.deepEqual(surfaces[0].rings[0][3], [3, 18.4, 0]); // input untouched
});

test('reshapeShell compresses heights above a level inside a region only', () => {
  const s: Surface[] = [{type: 'RoofSurface', rings: [[[0, 25, 0], [1, 21, 0], [9, 25, 0]]]}];
  const out = reshapeShell(s, {compress: [{inside: x => x < 5, y0: 19, s: 0.5}]});
  assert.deepEqual(out[0].rings[0].map(p => p[1]), [22, 20, 25]);
});
