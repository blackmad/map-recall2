import test from 'node:test';
import assert from 'node:assert/strict';
import {columnsCriterion} from './autoPlace.ts';

test('columnsPerBay: Haarlemmerdijk 131 (7 columns over 2 wide three-light axes) scores 1 with [2, 4]; absent = one column per axis', () => {
  assert.equal(columnsCriterion(7, 2, [2, 4]).score, 1);
  assert.equal(columnsCriterion(7, 2).score, 0);
  assert.equal(columnsCriterion(3, 3).score, 1);
  assert.equal(columnsCriterion(4, 3).score, 0.4);
  assert.equal(columnsCriterion(9, 2, [2, 4]).score, 0, 'over the range falls back to the plain rule');
  assert.deepEqual(columnsCriterion(4, 3, undefined), {key: 'columns', weight: 1.5, score: 0.4, note: 'strip columns 4 vs 3 bays'});
});
