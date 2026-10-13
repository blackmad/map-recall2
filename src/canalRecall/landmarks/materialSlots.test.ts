import assert from 'node:assert/strict';
import test from 'node:test';
import {RECIPE_SLOTS} from '../buildingRecipe/recipeLook';
import {landmarkSlot, PALETTE_SLOT, slotExtras} from './materialSlots';

test('every builder palette colour maps to a slot the shared look knows', () => {
  for (const [name, slot] of Object.entries(PALETTE_SLOT)) assert.ok(RECIPE_SLOTS.includes(slot), `${name} -> ${slot}`);
  // The 17 colours of build-manual-landmarks.ts `palette`.
  for (const name of ['brick', 'stone', 'sandstone', 'slate', 'white', 'gold', 'glass', 'dark', 'frame', 'red', 'blue', 'pink', 'bronze', 'copper', 'green', 'ochre', 'concrete', 'greyBrick']) {
    assert.ok(landmarkSlot(name), `${name} has a slot`);
  }
});

test('decals take accent, unknown names take nothing, extras carry the tint', () => {
  assert.equal(landmarkSlot('decal-ff0000-unlit'), 'accent');
  assert.equal(landmarkSlot('mystery'), undefined);
  assert.deepEqual(slotExtras('brick', '#9A5240'), {materialSlot: 'brick', tint: '#9a5240'});
  assert.equal(slotExtras('brick', 'red'), undefined);
});
