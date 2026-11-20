import {test} from 'node:test';
import assert from 'node:assert/strict';
import {bayCentres, storeysUnder} from './row-front';

test('bayCentres: equal bays inside the margins', () => {
  assert.deepEqual(bayCentres(0, 10, 4, 1), [2, 4, 6, 8]);
  assert.deepEqual(bayCentres(0, 10, 0), []);
});

test('storeysUnder: every window head stays below the top less the attic', () => {
  const s = storeysUnder(13.4, {ground: 1.2, floor: 3.2, winH: 2.2, attic: 1.0});
  assert.equal(s.length, 3);
  for (const b of s) assert.ok(b.y + b.h <= 12.4);
  assert.ok(s[1].h < s[0].h);
  assert.deepEqual(storeysUnder(2), []);
});
