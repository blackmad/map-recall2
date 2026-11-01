import assert from 'node:assert/strict';
import test from 'node:test';
import { packMask } from './maskPacking';

test('packMask r8: R alone, the accent as 255 − G in the colour alpha; rg: alpha 255, mask as is', () => {
  const mask = new Uint8Array([255, 0, 0, 255, 0, 0, 128, 64]);
  const colour = new Uint8Array(16).map((_, i) => i * 10);
  const r8 = packMask(colour.slice(), mask, 'r8');
  assert.equal(r8.channels, 1);
  assert.deepEqual(Array.from(r8.mask), [255, 0, 0, 128]);
  assert.deepEqual(Array.from(r8.colour).filter((_, i) => i % 4 === 3), [255, 0, 255, 191]);
  assert.deepEqual(Array.from(r8.colour).filter((_, i) => i % 4 !== 3), Array.from(colour).filter((_, i) => i % 4 !== 3));
  // The shader's accent (mask.g + 1 − colour.a) is G under either upload.
  for (let i = 0; i < 4; i++) assert.equal(0 + 255 - r8.colour[i * 4 + 3], mask[i * 2 + 1]);
  const rg = packMask(colour.slice(), mask, 'rg');
  assert.equal(rg.channels, 2);
  assert.equal(rg.mask, mask);
  for (let i = 0; i < 4; i++) assert.equal(mask[i * 2 + 1] + 255 - rg.colour[i * 4 + 3], mask[i * 2 + 1]);
  assert.throws(() => packMask(new Uint8Array(12), mask, 'r8'));
});
