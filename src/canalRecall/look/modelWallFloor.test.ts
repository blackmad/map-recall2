import { test } from 'node:test';
import assert from 'node:assert/strict';
import { modelWallFloorEnabled, modelWallTint, resetModelWallFloor } from './modelWallFloor.ts';
import { cityLookTint } from './cityLook.ts';
import { hexToOklab, specWallDisplay, specWallSource } from '../houseSpec/wallColour.ts';

const L = (hex: string) => hexToOklab(hex)[0];

test('flag parsing: default off, query over env', () => {
  assert.equal(modelWallFloorEnabled(null, null), false);
  assert.equal(modelWallFloorEnabled('?modelWallFloor=1', null), true);
  assert.equal(modelWallFloorEnabled('?x=1', '1'), true);
  assert.equal(modelWallFloorEnabled('?modelWallFloor=0', '1'), false);
});

test('173483 regression: a dark spec brick on the model path draws no lighter than on the generic path', () => {
  const spec = '#312d2c', src = specWallSource(spec, { brick: true }), generic = L(specWallDisplay(src.hex, { fromPixel: src.fromPixel }));
  delete process.env.MODEL_WALL_FLOOR; resetModelWallFloor();
  const off = cityLookTint('brick', spec, null, undefined, null, false, true);
  assert.ok(L(off) > generic + 0.05, `today the model lifts ${L(off).toFixed(3)} over generic ${generic.toFixed(3)}`);
  process.env.MODEL_WALL_FLOOR = '1'; resetModelWallFloor();
  const on = cityLookTint('brick', spec, null, undefined, null, false, true);
  assert.ok(Math.abs(L(on) - generic) < 0.01, `${L(on)} vs ${generic}`);
  // Not a model slot, a measured slot, or a mid wall: unchanged.
  assert.equal(cityLookTint('brick', spec, null, undefined, null, false, false), off);
  assert.equal(cityLookTint('brick', spec, 'measured', undefined, null, false, true), cityLookTint('brick', spec, 'measured', undefined, null, false, false));
  delete process.env.MODEL_WALL_FLOOR; resetModelWallFloor();
});

test('modelWallTint keeps a tint already at or below the generic L', () => {
  assert.equal(modelWallTint('#202020', '#8a6a50'), '#202020');
});
