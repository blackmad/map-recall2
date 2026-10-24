import {test} from 'node:test';
import assert from 'node:assert/strict';
import {cropPredatesBuilding, curtainEvidence, glassReadsAsGlass, majoritySystem, photoBays} from './measureWriteback.ts';

test('cropPredatesBuilding: a crop in or before the construction year is not evidence', () => {
  assert.equal(cropPredatesBuilding('2018-01-08', 2019), true); // OBA Postjesweg
  assert.equal(cropPredatesBuilding('2022-01-07', 2022), true); // Stadsloket Nieuw-West, under scaffolding
  assert.equal(cropPredatesBuilding('2025-09-24', 2022), false);
  assert.equal(cropPredatesBuilding('2025-09-24', null), false);
  assert.equal(cropPredatesBuilding(undefined, 2000), false);
});

test('glassReadsAsGlass: darker than the wall by 10 L* and nearly neutral', () => {
  assert.equal(glassReadsAsGlass('#212a26', '#3c4240'), true); // Metis
  assert.equal(glassReadsAsGlass('#322d27', '#3d342f'), false); // Slotermeer walls[1]: branches, not glass
  assert.equal(glassReadsAsGlass('#303235', '#611113'), false); // Molenwijk walls[0]: dark paint
  assert.equal(glassReadsAsGlass(null, '#3d342f'), false);
});

test('curtainEvidence: the likeness abstain thresholds and the glass test, each named', () => {
  const clean = {glass: '#1c2425', wall: '#8a8a88', usable: 0.9, likenessUsable: 0.9, foliage: 0.02, washedOut: 0.01};
  assert.deepEqual(curtainEvidence(clean), []);
  assert.match(curtainEvidence({...clean, usable: 0.389}).join(), /usable 39 % < 40 %/); // Buitenveldert walls[3]
  assert.match(curtainEvidence({...clean, foliage: 0.3}).join(), /foliage 30 % > 25 %/);
  assert.match(curtainEvidence({...clean, washedOut: 0.31}).join(), /washed out/);
  assert.match(curtainEvidence({...clean, glass: '#322d27', wall: '#3d342f'}).join(), /does not read as glass/);
});

test('photoBays: the likeness grid wins when it found columns, its own window with it', () => {
  // OBA IJburg walls[3]: padded measurement 53 (mullion pitch), grid 10
  assert.deepEqual(photoBays({measuredBays: 53, measuredWindow: null, gridColumns: 10, gridWindow: {w: 0.8, h: 0.6, sill: 0.2, shape: 'wide'}}), {bays: 10, window: {w: 0.8, h: 0.6, sill: 0.2, shape: 'wide'}, source: 'grid'});
  // grid with columns but no folded window: the measured window only when the counts agree
  assert.deepEqual(photoBays({measuredBays: 5, measuredWindow: {w: 0.7, h: 0.65, sill: 0.25}, gridColumns: 29, gridWindow: null}).window, null);
  assert.deepEqual(photoBays({measuredBays: 9, measuredWindow: {w: 0.7, h: 0.65, sill: 0.25}, gridColumns: 9, gridWindow: null}).window, {w: 0.7, h: 0.65, sill: 0.25});
  assert.deepEqual(photoBays({measuredBays: 12, measuredWindow: null, gridColumns: null, gridWindow: null}), {bays: 12, window: null, source: 'measurement'});
});

test('majoritySystem: area-weighted, fallback without trusted groups', () => {
  assert.equal(majoritySystem([], 'brick-bay-grid'), 'brick-bay-grid');
  assert.equal(majoritySystem([{system: 'ribbon-windows', areaM2: 300}, {system: 'brick-bay-grid', areaM2: 200}, {system: 'brick-bay-grid', areaM2: 150}], 'curtain-wall'), 'brick-bay-grid');
  assert.equal(majoritySystem([{system: 'ribbon-windows', areaM2: 300}], 'brick-bay-grid'), 'ribbon-windows');
});
