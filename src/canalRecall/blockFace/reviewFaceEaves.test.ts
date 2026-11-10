/**
 * Reviewer face eaves pins (reviewFaceEaves.ts): a dike cottage's gutter measured on the strip.
 *   node --import tsx --test src/canalRecall/blockFace/reviewFaceEaves.test.ts
 */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {eavesPinProblems, pinnedEaves} from './reviewFaceEaves.ts';

const pins = [{face: 'a-1-9', eavesM: 3.25, reason: 'gutter on the strip'}];

test('a pin applies to its face only; no pin is null (byte-identical)', () => {
  assert.equal(pinnedEaves(pins, 'a-1-9'), 3.25);
  assert.equal(pinnedEaves(pins, 'b-2-4'), null);
  assert.equal(pinnedEaves([], 'a-1-9'), null);
});

test('bad pins are reported', () => {
  assert.deepEqual(eavesPinProblems(pins), []);
  assert.equal(eavesPinProblems([{face: '', eavesM: 40, reason: ''}]).length, 3);
});
