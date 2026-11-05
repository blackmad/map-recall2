import assert from 'node:assert/strict';
import test from 'node:test';
import {inferredSlotExtras} from '../../src/canalRecall/look/materialSlotInference';
import {slotTintBytes} from '../../src/canalRecall/look/cityLook';
import {MATERIAL_SLOT_TAG, MATERIAL_SLOT_TAGS, slotTagFor, tagExtras} from './material-slot-tags';

test('tagExtras without a measured tint is the pre-#226 tag, key for key and in order', () => {
  const base = inferredSlotExtras('slate', '#4a525d'), tag = {slot: 'roofTile' as const, why: 'test'};
  const before = {...base, materialSlot: tag.slot, materialSlotTag: MATERIAL_SLOT_TAG};
  assert.equal(JSON.stringify(tagExtras(base, tag)), JSON.stringify(before));
  for (const [id, tags] of Object.entries(MATERIAL_SLOT_TAGS)) for (const [name, t] of Object.entries(tags)) {
    if (t.measured) continue;
    const b = inferredSlotExtras(name, '#808080');
    assert.equal(JSON.stringify(tagExtras(b, t)), JSON.stringify({...b, materialSlot: t.slot, materialSlotTag: MATERIAL_SLOT_TAG}), `${id}/${name}`);
  }
});

test('a measured tag writes its colour as a measured tint and refuses a malformed one', () => {
  const ex = tagExtras(inferredSlotExtras('slate', '#6f7173'), {slot: 'bitumen', why: 'test', measured: '#e8e7e3'});
  assert.equal(ex.materialSlot, 'bitumen');
  assert.equal(ex.tint, '#e8e7e3');
  assert.equal(ex.tintSource, 'measured');
  assert.throws(() => tagExtras({tint: '#000000'}, {slot: 'bitumen', why: 'x', measured: '#E8E7E3'}), /measured tint/);
  assert.throws(() => tagExtras({tint: '#000000'}, {slot: 'bitumen', why: 'x', measured: 'white'}), /measured tint/);
});

test('Ziggo Dome: the white membrane roof draws its measured colour, not the gravel the light slate got', () => {
  const tag = slotTagFor('ziggo-dome', 'slate');
  assert.ok(tag?.measured);
  // the untagged path: the catalogue's slate #6f7173 on a level face is a flat roof with the bitumen tint -> warm gravel
  assert.deepEqual(slotTintBytes('bitumen', '#6f7173'), [158, 146, 129, 255]);
  const [r, g, b] = slotTintBytes(tag.slot, tag.measured, 'measured');
  assert.deepEqual([r, g, b], [0xe8, 0xe7, 0xe3]);
});
