import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {houseCuts, modalLine, proposeHouses, roofSteps, rowCoherence, rowSegments} from './rowSplit.ts';
import {validateLargeIntent} from './largeIntent.ts';
import {fitLarge} from './fitLarge.ts';
import {compileLargeBuilding} from './largeCompile.ts';
import type {BuildingFacts} from './facts.ts';
import type {LargeBuildingIntent} from './intent.ts';

const HOUSES = 'scripts/building-recipes/houses';
const raw = (id: string): LargeBuildingIntent => JSON.parse(fs.readFileSync(`${HOUSES}/${id}/intent.json`, 'utf8'));
const facts = (id: string): BuildingFacts => JSON.parse(fs.readFileSync(`${HOUSES}/${id}/facts.json`, 'utf8'));

test('houseCuts: cumulative normalised shares', () => {
  assert.deepEqual(houseCuts(0, 10, [1, 1, 2]), [2.5, 5]);
  assert.deepEqual(houseCuts(-5, 5, [0.3, 0.7]), [-2]);
});

test('modalLine: the line most of a span stands on, null for a zigzag', () => {
  assert.equal(modalLine([17, 17.05, 17, 13.6, 14.4, 17.02, 17, 16.9]), 17);
  assert.equal(modalLine(Array.from({length: 20}, (_, i) => 12 + i * 0.15)), null);
});

test('rowCoherence: a lone outlier between neighbours on the line is clamped; a kept or flanked one is not', () => {
  const r = rowCoherence([12.5, 12.4, 13.5, 12.5, 12.6], [false, false, false, false, false]);
  assert.deepEqual(r.clamps, [{house: 2, fromM: 13.5, toM: 12.5}]);
  assert.equal(r.eaves[2], 12.5);
  assert.equal(rowCoherence([12.5, 12.4, 13.5, 12.5, 12.6], [false, false, true, false, false]).clamps.length, 0);
  // two high houses side by side are a different row line, not a lone outlier
  assert.equal(rowCoherence([12.5, 14, 14, 12.5, 12.5], [false, false, false, false, false]).clamps.length, 0);
  assert.equal(rowCoherence([12.5, 14], [false, false]).clamps.length, 0);
});

test('rowSegments: alternating dark and cream fronts split; one material does not', () => {
  const dark: [number, number, number] = [18, 1, 0], cream: [number, number, number] = [70, 0, 8];
  const labs = [...Array(6).fill(dark), ...Array(4).fill(cream), ...Array(5).fill(dark)];
  const segs = rowSegments(labs);
  assert.equal(segs.length, 3);
  assert.deepEqual(segs.map(s => [s.from, s.to]), [[0, 0.4], [0.4, 0.667], [0.667, 1]]);
  assert.equal(rowSegments(Array(12).fill([40, 5, 10])).length, 1);
});

test('roofSteps: joints at height steps of 1.5 m or more', () => {
  assert.deepEqual(roofSteps([12, 12, 12, 14, 14, null, 14, 12.2]), [0.375, 0.875]);
});

test('proposeHouses: only on clear joints, never for one colour or under 3 m houses', () => {
  const colour = [{from: 0, to: 0.4, hex: '#2d2b2e'}, {from: 0.4, to: 0.6, hex: '#afb0a3'}, {from: 0.6, to: 1, hex: '#2f3031'}];
  const p = proposeHouses({widthM: 20, colour, roof: [], pitchM: 2, usable: 0.8});
  assert.ok(p);
  assert.deepEqual(p.houses, [{w: 0.4, bays: 4, brick: '#2d2b2e'}, {w: 0.2, bays: 2, brick: '#afb0a3'}, {w: 0.4, bays: 4, brick: '#2f3031'}]);
  // a poor crop: no colour evidence; roof steps alone are not joints
  assert.equal(proposeHouses({widthM: 20, colour, roof: [0.4, 0.6], pitchM: 2, usable: 0.4}), null);
  // a weak colour change (dE < 20) counts only on a roof step
  const weak = [{from: 0, to: 0.5, hex: '#928372'}, {from: 0.5, to: 0.75, hex: '#867b7f'}, {from: 0.75, to: 1, hex: '#625961'}];
  assert.equal(proposeHouses({widthM: 22, colour: weak, roof: [], pitchM: 3, usable: 0.9}), null);
  assert.ok(proposeHouses({widthM: 22, colour: weak, roof: [0.5, 0.75], pitchM: 3, usable: 0.9}));
  // a 2 m house is not a house
  assert.equal(proposeHouses({widthM: 10, colour, roof: [], pitchM: 2, usable: 0.8}), null);
});

test('houses: validator', () => {
  const base = raw('pand-165427');
  const withHouses = (houses: unknown, extra: Record<string, unknown> = {}) => ({...base, walls: base.walls.map((w, i) => (i === 0 ? {...w, houses, ...extra} : w))});
  assert.doesNotThrow(() => validateLargeIntent(withHouses([{w: 1}, {w: 2, crown: 'gable', brick: '#2d2b2e', bays: 2, storeys: 3, ownEaves: true}])));
  assert.throws(() => validateLargeIntent(withHouses([{w: 1}])), /a row of 2\.\.24 houses/);
  assert.throws(() => validateLargeIntent(withHouses([{w: 1}, {w: 1, crown: 'step'}])), /crown/);
  assert.throws(() => validateLargeIntent(withHouses([{w: 1}, {w: 1, widthM: 3}])), /unknown field|coordinate/);
  assert.throws(() => validateLargeIntent(withHouses([{w: 1}, {w: 1}], {wallSplit: {at: 0.5, brick: '#ffffff'}})), /not with wallSplit/);
});

test('houses: fit gives each house its own system, eaves, storeys and wall slot; absent changes nothing', () => {
  const intent = validateLargeIntent(raw('pand-165427')), f = facts('pand-165427');
  const g0 = fitLarge(intent, f).recipe.groups[0];
  assert.ok(g0.houses);
  const segs = g0.houses.segs;
  assert.equal(segs.length, 4);
  assert.equal(segs.reduce((a, s) => a + s.bays, 0), g0.bays);
  assert.deepEqual(segs.map(s => s.bayOffset), [0, 2, 3, 9]);
  // the tall left house stands on its own 3DBAG line (19.1 m) with five storeys; the row's other houses on the 15.3 m line
  assert.ok(Math.abs(segs[0].eavesM - 19.1) < 0.1 && segs[0].storeys === 5);
  for (const s of segs.slice(1)) assert.ok(Math.abs(s.eavesM - 15.25) < 0.1);
  assert.equal(segs[3].crown, 'gable');
  // houses tile the main panel
  for (let k = 1; k < segs.length; k++) assert.equal(segs[k].u0, segs[k - 1].u1);
  // without houses: no row fit, the group's own system only
  const plain = {...intent, walls: intent.walls.map(w => { const {houses, ...rest} = w; void houses; return rest; })};
  const r = fitLarge(plain, f).recipe;
  assert.equal(r.groups[0].houses, undefined);
  assert.ok(!Object.keys(r.spec.systems).some(k => /h\d+$/.test(k)));
});

test('houses: compile colours each house span in its own wall slot, with per-house gates', () => {
  const intent = validateLargeIntent(raw('stadhouderskade-111-137448')), f = facts('stadhouderskade-111-137448');
  const built = compileLargeBuilding(intent, f, {budget: 1e9});
  const segs = built.recipe.groups[0].houses!.segs;
  const slots = [...new Set(segs.map(s => s.slot))];
  assert.ok(slots.length >= 5);
  const names = new Set<string>();
  built.group.traverse(o => { if ((o as {isMesh?: boolean}).isMesh) names.add(o.name); });
  for (const s of slots) assert.ok(names.has(`wall/${s}`), `mesh for ${s}`);
  // row coherence clamped the black house whose LoD2.2 eaves read a metre high
  assert.ok(built.fit.warnings.some(w => /houses\[5\]: eaves 13\.5\d* m -> row line 12\.5/.test(w)));
});
