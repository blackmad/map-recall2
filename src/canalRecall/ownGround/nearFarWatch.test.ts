import test from 'node:test';
import assert from 'node:assert/strict';
import { NearFarWatch, NEAR_FAR_MS, nearFarFlag, type NearFarPart } from './nearFarWatch';

const part = (key: string): NearFarPart => ({ key, distM: 90, resident: false, fading: false, pending: true, lod: null });

test('NearFarWatch: silent until a part stands past NEAR_FAR_MS, then reports once', () => {
  const w = new NearFarWatch();
  assert.equal(w.step(0, [part('a')]), null);
  assert.equal(w.step(NEAR_FAR_MS, [part('a')]), null);
  const r = w.step(NEAR_FAR_MS + 1, [part('a')]);
  assert.deepEqual(r?.keys, ['a']);
  assert.equal(w.step(NEAR_FAR_MS * 3, [part('a')]), null, 'once per stand');
});
test('NearFarWatch: a part that clears resets its clock', () => {
  const w = new NearFarWatch();
  w.step(0, [part('a')]); w.step(1000, []);
  assert.equal(w.step(2500, [part('a')]), null);
  assert.ok(w.step(4600, [part('a')]));
});
test('nearFarFlag: on unless ?nearFar=0', () => {
  assert.equal(nearFarFlag(''), true);
  assert.equal(nearFarFlag('?nearFar=0'), false);
});

import { touchFine, touchFineFlag, TOUCH_FINE_M } from './nearFarWatch';
test('touchFine: a cell within the fine distance of the centre is full; the old own-cell rule at 0; `all` stays coarse', () => {
  assert.equal(touchFine('cell', false, true, 58, TOUCH_FINE_M), true, 'Lelylaan: neighbour 58 m away');
  assert.equal(touchFine('cell', false, true, 245, TOUCH_FINE_M), false, '245 m is beyond it');
  assert.equal(touchFine('cell', false, true, 58, 0), false, '?touchFine=0 = the old rule');
  assert.equal(touchFine('cell', true, false, 0, 0), true);
  assert.equal(touchFine('all', true, true, 0, TOUCH_FINE_M), false);
  assert.equal(touchFineFlag('?touchFine=0'), 0);
  assert.equal(touchFineFlag(''), TOUCH_FINE_M);
});
