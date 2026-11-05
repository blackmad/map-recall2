import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SWAP_SLOT_COUNT, SwapSlots, clearSlot, paintSlot, swapComplementEnabled } from './swapComplement.js';
import { variantDefines, variantKey, cityProgramKey, createCityUniforms } from './look/cityLook.js';

const ranges = new Map([['a', { start: 0, count: 4 }], ['b', { start: 4, count: 2 }], ['c', { start: 6, count: 3 }]]);

test('slots: claim, follow the fade, release; exhausted slots fall back to the old overlap', () => {
  const slots = new SwapSlots(2);
  const s0 = slots.claim(new Set(['a']), 0), s1 = slots.claim(new Set(['b']), 1);
  assert.deepEqual([s0, s1], [0, 1]);
  assert.equal(slots.claim(new Set(['c']), 0), -1, 'no free slot: that swap draws both, as before');
  assert.equal(slots.claim(new Set(), 0), -1, 'nothing to cover');
  slots.set(s0, 0.4);
  assert.ok(Math.abs(slots.under[s0] - 0.4) < 1e-6);
  assert.deepEqual([...slots.release(s0)!], ['a']);
  assert.equal(slots.under[s0], 0, 'a released slot yields nothing');
  assert.equal(slots.release(s0), null);
  slots.set(s0, 0.9);
  assert.equal(slots.under[s0], 0, 'setting a free slot is a no-op');
  assert.deepEqual([...slots.active()].map(([s]) => s), [1]);
  assert.equal(new SwapSlots().count, SWAP_SLOT_COUNT);
});

test('paint and clear a shell\'s swapSlot bytes per building; a later swap keeps its mark', () => {
  const array = new Uint8Array(9);
  assert.equal(paintSlot(array, ranges, ['a', 'missing'], 0), true);
  assert.deepEqual([...array], [1, 1, 1, 1, 0, 0, 0, 0, 0]);
  paintSlot(array, ranges, ['b'], 3);
  assert.deepEqual([...array], [1, 1, 1, 1, 4, 4, 0, 0, 0]);
  // b re-marked by slot 3: clearing slot 0 from both leaves it.
  assert.equal(clearSlot(array, ranges, ['a', 'b'], 0), true);
  assert.deepEqual([...array], [0, 0, 0, 0, 4, 4, 0, 0, 0]);
  assert.equal(clearSlot(array, ranges, ['a'], 0), false, 'nothing left to clear');
});

test('flag: on by default, ?swapComplement=0 off', () => {
  assert.equal(swapComplementEnabled(''), true);
  assert.equal(swapComplementEnabled('?swapComplement=0'), false);
  assert.equal(swapComplementEnabled('?swapComplement=1'), true);
});

test('city look: the swap variant is its own program; without it the defines and keys are unchanged', () => {
  for (const lit of [true, false]) {
    const plain = { lit, kind: 'chunk' as const };
    assert.equal(variantDefines(plain).CITY_SWAP, undefined);
    assert.equal(variantDefines({ ...plain, swap: true }).CITY_SWAP, '');
    assert.equal(variantKey(plain), variantKey({ ...plain, swap: false }));
    assert.notEqual(cityProgramKey(plain), cityProgramKey({ ...plain, swap: true }));
  }
  assert.equal(cityProgramKey({ lit: true, kind: 'chunk' }), 'city-look-v4|lit|chunk', 'the shipped key, unchanged');
  const fake = { Vector4: class { constructor(..._: number[]) {} }, Matrix3: class {} };
  const u = createCityUniforms(fake);
  assert.equal(u.citySwapUnder.value.length, SWAP_SLOT_COUNT);
  assert.equal(u.cityUnder.value, 0);
});
