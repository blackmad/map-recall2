import test from 'node:test';
import assert from 'node:assert/strict';
import { GUESSED_WALL_TINTS, glbWallProvenance, ruledSlotSource, ruledSpecWall, setWallRuleFlag, wallRuleEnabled } from './wallRule.ts';
import { SWATCHES } from '../buildingRecipe/intent.ts';
import { slotForMaterial } from './cityLook.ts';
import { gameColour } from '../buildingRecipe/likeness.ts';
import { specWallColour } from '../houseSpec/decorate.ts';

test('wall rule flag: query or env, off by default', () => {
  assert.equal(wallRuleEnabled(null, null), false);
  assert.equal(wallRuleEnabled('?wallRule=1', null), true);
  assert.equal(wallRuleEnabled('?a=2&wallRule=on', null), true);
  assert.equal(wallRuleEnabled('?wallRule=0', '1'), false);
  assert.equal(wallRuleEnabled(null, '1'), true);
});

test('the guessed tints hold every kit swatch', () => {
  for (const v of Object.values(SWATCHES)) assert.ok(GUESSED_WALL_TINTS.has(v.toLowerCase()), v);
  assert.equal(glbWallProvenance('#4E3027'), 'guessed');
  assert.equal(glbWallProvenance('#473936'), 'measured');
  assert.equal(glbWallProvenance('#4e3027', 'measured'), 'measured');
});

test('rule off: every path byte-identical', () => {
  setWallRuleFlag(false);
  try {
    assert.equal(ruledSlotSource('brick', '#473936', undefined), undefined);
    assert.equal(slotForMaterial({ userData: { materialSlot: 'brick', tint: '#473936' } }, false)?.source, undefined);
    assert.deepEqual(gameColour({ materialSlot: 'brick', tint: '#473936', rgb: [71, 57, 54] } as never), [0x63, 0x4f, 0x4b]);
    assert.equal(ruledSpecWall({ hex: '#473936', fromPixel: true }, () => 'lifted'), 'lifted');
  } finally { setWallRuleFlag(); }
});

test('rule on: a record brick is drawn as measured, a guess keeps the city tint', () => {
  setWallRuleFlag(true);
  try {
    assert.equal(ruledSlotSource('brick', '#473936', undefined), 'measured');
    assert.equal(ruledSlotSource('stone', '#473936', undefined), undefined);
    assert.equal(ruledSlotSource('brick', '#4e3027', undefined), undefined);
    assert.equal(slotForMaterial({ userData: { materialSlot: 'brick', tint: '#473936' } }, false)?.source, 'measured');
    // the kit's game colour: the record brick itself, not cityWallTint's lift (#634f4b)
    assert.deepEqual(gameColour({ materialSlot: 'brick', tint: '#473936', rgb: [71, 57, 54] } as never), [0x47, 0x39, 0x36]);
    assert.equal(ruledSpecWall({ hex: '#473936', fromPixel: true }, () => 'lifted'), '#473936');
    assert.equal(ruledSpecWall({ hex: '#5a3a2a', fromPixel: false }, () => 'lifted'), 'lifted');
    // a spec's measured dark brick reaches the mesher unlifted
    assert.equal(specWallColour({ wallHex: '#473936', wallMaterial: 'brick' } as never, {}), '#473936');
  } finally { setWallRuleFlag(); }
});
