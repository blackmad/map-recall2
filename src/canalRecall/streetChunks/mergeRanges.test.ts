import assert from 'node:assert/strict';
import {test} from 'node:test';

import {pandIndexForFace} from './extras.ts';
import {concatPandRanges, lowestPandBase, splitPandRanges} from './mergeRanges.ts';

test('concatPandRanges: parts shift by the triangles before them and split back to the same ranges', () => {
  const parts = [
    {ranges: [[0, 0, 4], [1, 4, 2]], triangles: 6},
    {ranges: [[1, 0, 3]], triangles: 3},
    {ranges: [[0, 0, 1], [2, 1, 5]], triangles: 6},
  ];
  const merged = concatPandRanges(parts)!;
  assert.deepEqual(merged, [[0, 0, 4], [1, 4, 2], [1, 6, 3], [0, 9, 1], [2, 10, 5]]);
  assert.deepEqual(splitPandRanges(merged, parts.map(p => p.triangles)), parts.map(p => p.ranges));
  // Every merged face resolves to the pand its source face had.
  let at = 0;
  for (const part of parts) {
    for (let t = 0; t < part.triangles; t++) assert.equal(pandIndexForFace(merged, at + t), pandIndexForFace(part.ranges, t));
    at += part.triangles;
  }
});

test('concatPandRanges: a part with no ranges takes no pand; none at all is null (catalogue landmarks untouched)', () => {
  assert.equal(concatPandRanges([{triangles: 3}, {ranges: [], triangles: 2}]), null);
  const merged = concatPandRanges([{triangles: 3}, {ranges: [[5, 0, 2]], triangles: 2}])!;
  assert.deepEqual(merged, [[5, 3, 2]]);
  assert.equal(pandIndexForFace(merged, 1), -1);
});

test('concatPandRanges: a range past its part is clipped, never claims the next part', () => {
  assert.deepEqual(concatPandRanges([{ranges: [[0, 0, 9]], triangles: 2}, {ranges: [[1, 0, 1]], triangles: 1}]), [[0, 0, 2], [1, 2, 1]]);
});

test('lowestPandBase: the lowest finite base, 0 without pands', () => {
  assert.equal(lowestPandBase(new Map([[0, 1.2], [1, -0.4], [2, 0.3]])), -0.4);
  assert.equal(lowestPandBase({0: 2, 1: 0.5}), 0.5);
  assert.equal(lowestPandBase(new Map()), 0);
});
