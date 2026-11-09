import assert from 'node:assert/strict';
import test from 'node:test';
import { wrapKeycapRows } from './keycapAction.ts';

// R2-6 (#304): the pause card's keycap row wraps instead of running past the card.
test('a row that fits stays on one line', () => {
  assert.deepEqual(wrapKeycapRows([100, 100], 300, 22), [[0, 1]]);
});
test('the pause card row (121 + 105 + 126, gaps 22) wraps in a 344 px card', () => {
  assert.deepEqual(wrapKeycapRows([121, 105, 126], 344, 22), [[0, 1], [2]]);
});
test('an over-wide action gets its own row; no actions give no rows', () => {
  assert.deepEqual(wrapKeycapRows([400, 50], 344, 22), [[0], [1]]);
  assert.deepEqual(wrapKeycapRows([], 344, 22), []);
});
