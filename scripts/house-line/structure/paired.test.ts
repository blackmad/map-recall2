import test from 'node:test';
import assert from 'node:assert/strict';
import { mcnemarExact, paired } from './paired.ts';

test('McNemar exact: no discordant pairs is p 1; 14 vs 6 is p 0.115; 45 vs 11 is far under 0.001', () => {
  assert.equal(mcnemarExact(0, 0), 1);
  assert.ok(Math.abs(mcnemarExact(14, 6) - 0.1153) < 1e-3);
  assert.ok(mcnemarExact(45, 11) < 1e-5);
  assert.equal(mcnemarExact(3, 3), 1);
});

test('paired cells', () => {
  const r = paired([{ truth: 4, off: 5, on: 4 }, { truth: 4, off: 4, on: 5 }, { truth: 3, off: 3, on: 3 }, { truth: 3, off: 2, on: 4 }]);
  assert.deepEqual([r.wrongToRight, r.rightToWrong, r.rightBoth, r.wrongBoth, r.offRate, r.onRate], [1, 1, 1, 1, 0.5, 0.5]);
});
