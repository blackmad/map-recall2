import assert from 'node:assert/strict';
import test from 'node:test';
import { applyHintCeiling, applyHintCeilingToAccuracy, describeHintCap, scoreCeiling } from './hintCost';

test('ceiling falls 1,000 per hint down to 2,000', () => {
  assert.deepEqual([0, 1, 2, 3, 4, 9].map(scoreCeiling), [5000, 4000, 3000, 2000, 2000, 2000]);
  assert.equal(scoreCeiling(-2), 5000);
  assert.equal(scoreCeiling(Number.NaN), 5000);
});

test('ceiling only lowers scores', () => {
  assert.equal(applyHintCeiling(5000, 0), 5000);
  assert.equal(applyHintCeiling(5000, 1), 4000);
  assert.equal(applyHintCeiling(3500, 1), 3500);
  assert.equal(applyHintCeiling(100, 3), 100);
  assert.equal(applyHintCeilingToAccuracy(100, 2), 60);
  assert.equal(applyHintCeilingToAccuracy(40, 2), 40);
});

test('cap line wording', () => {
  assert.equal(describeHintCap(1), 'Capped at 4,000 (1 hint)');
  assert.equal(describeHintCap(2), 'Capped at 3,000 (2 hints)');
});
