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
