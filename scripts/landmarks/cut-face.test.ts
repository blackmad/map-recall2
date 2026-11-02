import {test} from 'node:test';
import assert from 'node:assert/strict';
import {hole, type CutFace} from './cut-face';

const face = (len: number, y0 = 0, y1 = 10): CutFace => ({f: {origin: [0, 0], tangent: [1, 0], n: [0, 1]}, len, y0, y1, c: 'brick', holes: []});

test('cuts an opening that fits and refuses an overlapping one', () => {
  const F = face(5);
  assert.equal(hole(F, 1, 2, 1, 3, 0.12, 'glass'), true);
  assert.equal(hole(F, 1.5, 2.5, 2, 4, 0.12, 'glass'), false);
  assert.equal(hole(F, 2, 3, 1, 3, 0.12, 'glass'), true, 'touching is not overlapping');
  assert.equal(F.holes.length, 2);
});

test('refuses openings outside the face or within the margin', () => {
  const F = face(5, 2, 6);
  assert.equal(hole(F, 0.01, 1, 3, 4, 0.1, 'glass'), false);
  assert.equal(hole(F, 4, 4.99, 3, 4, 0.1, 'glass'), false);
  assert.equal(hole(F, 1, 2, 1.5, 3, 0.1, 'glass'), false);
  assert.equal(hole(F, 1, 2, 3, 6, 0.1, 'glass'), false);
  assert.equal(F.holes.length, 0);
});

test('faces under a metre either way take no openings', () => {
  assert.equal(hole(face(0.9), 0.1, 0.8, 1, 2, 0.1, 'glass'), false);
  assert.equal(hole(face(5, 0, 0.9), 1, 2, 0.1, 0.8, 0.1, 'glass'), false);
});
