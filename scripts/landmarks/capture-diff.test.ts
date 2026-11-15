import assert from 'node:assert/strict';
import {test} from 'node:test';
import {changedShare} from './capture-diff.ts';

test('changedShare counts pixels over the tolerance', () => {
  const a = new Uint8Array([0, 0, 0, 255, 10, 10, 10, 255]);
  const b = new Uint8Array([0, 0, 5, 255, 200, 10, 10, 255]);
  assert.equal(changedShare(a, b, 4), 0.5);
  assert.equal(changedShare(a, a, 4), 0);
});
test('changedShare rejects different sizes', () => {
  assert.throws(() => changedShare(new Uint8Array(3), new Uint8Array(6), 3));
});
