// Lane WC (#384): wall-exposure options and the smooth finish, both default off and byte-identical off.
import test from 'node:test';
import assert from 'node:assert/strict';
import { EXPOSURE, exposeHex, exposedWall, isWallExposureFact, normGain, resetWallExposureMode, resetWallFinish, smoothFinishOf, wallExposureMode, wallExposureModeOf, wallFinishEnabled, wallFinishOn, STONE_HEX } from './wallExposure.ts';
import { houseSpecPatch, withWallExposure, type HouseSpecView } from './decorate.ts';
import { specView } from './view.ts';
import { emptySpec, setSpecField, specProblems } from './spec.ts';

const fact = { off: '#3c302a', floor: '#2a201c', gain: '#5a4234', norm: '#6b4a38', normfloor: '#5e4030' };
const p = { id: 'NL.IMBAG.Pand.0363100012168095', constructionYear: 1870 };

test('mode: default off, query wins over env, unknown values read as off', () => {
  assert.equal(wallExposureModeOf(''), 'off');
  assert.equal(wallExposureModeOf('?a=1&wallExposure=norm'), 'norm');
  assert.equal(wallExposureModeOf(null, 'gain'), 'gain');
  assert.equal(wallExposureModeOf('?wallExposure=floor', 'gain'), 'floor');
  assert.equal(wallExposureModeOf('?wallExposure=bogus'), 'off');
  assert.equal(wallFinishEnabled(''), false);
  assert.equal(wallFinishEnabled('?wallFinish=1'), true);
  assert.equal(wallFinishEnabled(null, '1'), true);
});

test('exposeHex: gain 1 is identity, gains act in linear light and keep hue order, clip at white', () => {
  assert.equal(exposeHex('#3C302A', 1), '#3c302a');
  const up = exposeHex('#3c302a', 2);
  assert.ok(parseInt(up.slice(1, 3), 16) > 0x3c && parseInt(up.slice(1, 3), 16) > parseInt(up.slice(3, 5), 16));
  assert.equal(exposeHex('#f0f0f0', 3), '#ffffff');
});

test('normGain: target over the reference level, clamped', () => {
  assert.equal(normGain({ white: EXPOSURE.target, scene: EXPOSURE.target }), 1);
  assert.equal(normGain({ white: 0.001, scene: 0.001 }), EXPOSURE.gainMax);
  assert.equal(normGain({ white: 1, scene: 1 }), EXPOSURE.gainMin);
});

test('exposedWall: off keeps the wall; an option replaces only the staged off brick', () => {
  assert.equal(exposedWall('#3c302a', fact, 'off'), '#3c302a');
  assert.equal(exposedWall('#3C302A', fact, 'norm'), fact.norm);
  assert.equal(exposedWall('#112233', fact, 'norm'), '#112233', 'another source won the wall');
  assert.equal(exposedWall('#3c302a', undefined, 'gain'), '#3c302a');
});

test('the fact validates and rides into the view only beside its own wall', () => {
  const s = emptySpec('0363100012168095');
  setSpecField(s, 'palette/brick', fact.off); s.provenance['palette/brick'] = { source: 'streetlevel-measured', confidence: 0.6, ref: 'cut.jpg', at: null };
  setSpecField(s, 'facts/wallExposure', { ...fact, g: 1.9 }); s.provenance['facts/wallExposure'] = { source: 'streetlevel-measured', confidence: 0.6, ref: 'cut.jpg', at: null };
  assert.deepEqual(specProblems(s), []);
  assert.ok(isWallExposureFact({ ...fact, g: 1 }));
  assert.equal(isWallExposureFact({ ...fact }), false);
  assert.deepEqual(specView(s).wallExposure, fact);
  setSpecField(s, 'palette/brick', '#112233');
  assert.equal(specView(s).wallExposure, undefined);
});

test('decorate: off (both flags) is byte-identical with and without the staged options', () => {
  delete process.env.WALL_EXPOSURE; delete process.env.WALL_FINISH; resetWallExposureMode(); resetWallFinish();
  assert.equal(wallExposureMode(), 'off');
  assert.equal(wallFinishOn(), false);
  const view: HouseSpecView = { wallHex: fact.off, wallMaterial: 'stucco', src: { wallHex: 'streetlevel-measured' } };
  const withFact: HouseSpecView = { ...view, wallExposure: fact, wallStone: true };
  assert.equal(withWallExposure(withFact), withFact);
  assert.deepEqual(houseSpecPatch(withFact, p), houseSpecPatch(view, p));
});

test('decorate: ?wallExposure=norm draws the norm brick; ?wallFinish=1 marks render/stone fronts smooth', () => {
  process.env.WALL_EXPOSURE = 'norm'; process.env.WALL_FINISH = '1'; resetWallExposureMode(); resetWallFinish();
  try {
    const view: HouseSpecView = { wallHex: fact.off, wallMaterial: 'brick', wallExposure: fact, src: { wallHex: 'streetlevel-measured' } };
    assert.equal(withWallExposure(view).wallHex, fact.norm);
    assert.equal((houseSpecPatch(view, p).specRecipe as { finish?: string } | undefined)?.finish, undefined, 'brick stays brick');
    const stone = houseSpecPatch({ wallMaterial: 'stucco', wallStone: true, src: {} }, p);
    assert.equal((stone.specRecipe as { finish?: string; wallHex?: string }).finish, 'stone');
    assert.equal((stone.specRecipe as { wallHex?: string }).wallHex, STONE_HEX);
    assert.equal(stone.registerFinish, 'light');
    assert.equal(smoothFinishOf('painted-brick', false), 'painted');
    assert.equal(smoothFinishOf('brick', false), null);
  } finally { delete process.env.WALL_EXPOSURE; delete process.env.WALL_FINISH; resetWallExposureMode(); resetWallFinish(); }
});
