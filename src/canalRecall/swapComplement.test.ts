import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SWAP_SLOT_COUNT, SwapSlots, clearSlot, paintSlot, swapComplementEnabled } from './swapComplement.js';
import { variantDefines, variantKey, cityProgramKey, createCityUniforms, SWAP_SLOTS } from './look/cityLook.js';

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

test('landmarkYield: an everywhere slot is listed for non-shell chunks, a detail swap slot is not; release forgets it', () => {
  const slots = new SwapSlots(4);
  const detail = slots.claim(new Set(['a']), 0);
  const landmark = slots.claim(new Set(['b', 'c']), 0, true);
  assert.equal(slots.isEverywhere(detail), false, 'a detail chunk over the shells: shells only (it must not yield to itself)');
  assert.equal(slots.isEverywhere(landmark), true);
  assert.deepEqual([...slots.activeEverywhere()].map(([s]) => s), [landmark]);
  assert.deepEqual([...slots.active()].map(([s]) => s), [detail, landmark], 'the shells take both');
  const array = new Uint8Array(9);
  assert.ok(paintSlot(array, ranges, [...slots.activeEverywhere()][0][1], landmark));
  assert.deepEqual([...array], [0, 0, 0, 0, landmark + 1, landmark + 1, landmark + 1, landmark + 1, landmark + 1]);
  slots.release(landmark);
  assert.equal(slots.isEverywhere(landmark), false);
  assert.equal([...slots.activeEverywhere()].length, 0);
  const again = slots.claim(new Set(['c']), 0);
  assert.equal(again, landmark, 'the freed slot is reused');
  assert.equal(slots.isEverywhere(again), false, 'and is not everywhere unless claimed so');
});

test('swap slots: 32, the shader array and the bookkeeping agree, and a vec4 array holds them', () => {
  assert.equal(SWAP_SLOT_COUNT, 32);
  assert.equal(SWAP_SLOTS, SWAP_SLOT_COUNT);
  assert.equal(SWAP_SLOTS % 4, 0);
  // The swapSlot byte stores slot + 1.
  assert.ok(SWAP_SLOT_COUNT + 1 <= 255);
  const slots = new SwapSlots();
  for (let k = 0; k < SWAP_SLOT_COUNT; k++) assert.equal(slots.claim(new Set([`b${k}`]), 0, k % 2 === 0), k);
  assert.equal(slots.claim(new Set(['over']), 0), -1, 'the 33rd swap overlaps, as before');
});

test('landmarkYield: beginYield paints every chunk holding the ids, set moves the slot, release clears only what it painted', async () => {
  const { ThreeBuildings } = await import('./threeBuildingsBrowser.js');
  let repaints = 0;
  const tb = new ThreeBuildings({ triggerRepaint() { repaints++; }, getZoom: () => 17, getCanvas: () => ({}) } as never, {} as never) as any;
  class BufferAttribute { needsUpdate = false; constructor(public array: Uint8Array, public itemSize: number) {} }
  tb.THREE = { BufferAttribute };
  tb.material = { uniforms: { citySwapUnder: { value: tb.swapSlots.under } } };
  const geometry = (n: number, slot?: Uint8Array) => {
    const attrs: Record<string, any> = { position: { count: n } };
    if (slot) attrs.swapSlot = new BufferAttribute(slot, 1);
    return { getAttribute: (k: string) => attrs[k], setAttribute: (k: string, a: any) => { attrs[k] = a; } };
  };
  const shell = { mesh: { geometry: geometry(6, new Uint8Array(6)) }, ranges: new Map([['a', { start: 0, count: 3 }], ['z', { start: 3, count: 3 }]]) };
  const detail = { mesh: { geometry: geometry(4) }, ranges: new Map([['a', { start: 0, count: 4 }]]) };
  const other = { mesh: { geometry: geometry(4) }, ranges: new Map([['q', { start: 0, count: 4 }]]) };
  tb.chunks.set('coarse:1', shell); tb.chunks.set('near:1', detail); tb.chunks.set('near:2', other);
  assert.equal(tb.complement, true, "the complementary dissolve is on by default");
  const y = tb.beginYield(new Set(['a']));
  assert.ok(y);
  const s = [...tb.swapSlots.activeEverywhere()][0][0];
  assert.deepEqual([...shell.mesh.geometry.getAttribute('swapSlot').array], [s + 1, s + 1, s + 1, 0, 0, 0]);
  assert.deepEqual([...detail.mesh.geometry.getAttribute('swapSlot').array], [s + 1, s + 1, s + 1, s + 1], 'detail gets a slot array');
  assert.equal(other.mesh.geometry.getAttribute('swapSlot'), undefined, 'a chunk without the ids is untouched');
  assert.equal(tb.yieldPainted.get(s).size, 2, 'the painted arrays are cached for the release');
  y.set(0.4);
  assert.ok(Math.abs(tb.swapSlots.under[s] - 0.4) < 1e-6);
  // Release walks only the cached arrays: a chunk added after the claim without the slot is never visited.
  tb.chunks.set('near:3', { mesh: { geometry: { getAttribute() { throw new Error('walked'); } } }, ranges: new Map() });
  y.release();
  assert.deepEqual([...shell.mesh.geometry.getAttribute('swapSlot').array], [0, 0, 0, 0, 0, 0]);
  assert.deepEqual([...detail.mesh.geometry.getAttribute('swapSlot').array], [0, 0, 0, 0]);
  assert.equal(tb.swapSlots.used, 0);
  assert.equal(tb.yieldPainted.size, 0);
  assert.ok(repaints >= 2);
});
