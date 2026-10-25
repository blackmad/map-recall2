/**
 * Box balconies (blockBuilding/boxBalcony.ts, Haarlemmerweg 778-938 "Pepper"): closed trays on listed (storey, bay)
 * cells. Opt-in: a house without `boxBalconies` compiles byte-identically.
 */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {validateLargeIntent} from './largeIntent.ts';
import {fitLarge} from './fitLarge.ts';
import {compileBuilding} from './compile.ts';
import type {BuildingFacts} from './facts.ts';
import {BOX_BALCONY, boxBalconyProblems, boxBalconyRect, fitBoxBalconies} from '../blockBuilding/boxBalcony.ts';
import {meshHashOf} from '../../../scripts/building-recipes/mesh-hash.ts';

const HOUSES = 'scripts/building-recipes/houses', PEPPER = 'haarlemmerweg-778';
const raw = (id: string) => JSON.parse(fs.readFileSync(`${HOUSES}/${id}/intent.json`, 'utf8'));
const facts = (id: string): BuildingFacts => JSON.parse(fs.readFileSync(`${HOUSES}/${id}/facts.json`, 'utf8'));

test('boxBalconies schema: storeys 1..storeys-1, bays within the row, fractions in range, a hex colour, no unknown fields', () => {
  assert.deepEqual(boxBalconyProblems({storeyBays: {1: [0, 3], 10: [5]}, deep: 0.5, wide: 0.8, rail: 0.35, colour: '#2b2b2c'}, 'bb', 6, 11), []);
  assert.ok(boxBalconyProblems({storeyBays: {0: [1]}}, 'bb', 6, 11).some(p => /storeyBays\.0/.test(p)), 'no tray on the ground');
  assert.ok(boxBalconyProblems({storeyBays: {11: [1]}}, 'bb', 6, 11).some(p => /storeyBays\.11/.test(p)), 'no tray past the top storey');
  assert.ok(boxBalconyProblems({storeyBays: {2: [6]}}, 'bb', 6, 11).some(p => /bay indices/.test(p)));
  assert.ok(boxBalconyProblems({storeyBays: {2: [1, 1]}}, 'bb', 6, 11).some(p => /twice/.test(p)));
  assert.ok(boxBalconyProblems({storeyBays: {}}, 'bb', 6, 11).some(p => /at least one/.test(p)));
  assert.ok(boxBalconyProblems({storeyBays: {2: [1]}, deep: 0.9}, 'bb', 6, 11).some(p => /deep/.test(p)));
  assert.ok(boxBalconyProblems({storeyBays: {2: [1]}, depthM: 1}, 'bb', 6, 11).some(p => /unknown field/.test(p)));
  assert.ok(boxBalconyProblems({storeyBays: {2: [1]}, colour: 'black'}, 'bb', 6, 11).some(p => /colour/.test(p)));
});

test('boxBalconies fit and rect: cells sorted by storey and bay, defaults applied, the tray centred on its bay at its floor line', () => {
  const f = fitBoxBalconies({storeyBays: {3: [2, 0], 1: [4]}}, 'frame');
  assert.deepEqual(f.cells, [{storey: 1, bay: 4}, {storey: 3, bay: 0}, {storey: 3, bay: 2}]);
  assert.equal(f.deep, BOX_BALCONY.deep); assert.equal(f.wide, BOX_BALCONY.wide); assert.equal(f.rail, BOX_BALCONY.rail);
  const r = boxBalconyRect(0, 18, 6, [0, 4, 7, 10, 13], f, {storey: 1, bay: 4})!;
  assert.ok(Math.abs((r.u0 + r.u1) / 2 - 13.5) < 1e-9, 'centred on bay 4 of 3 m bays');
  assert.ok(Math.abs(r.u1 - r.u0 - 0.85 * 3) < 1e-9);
  assert.equal(r.floor, 4); assert.ok(Math.abs(r.top - (4 + 0.35 * 3)) < 1e-9); assert.equal(r.d, 1.5);
  assert.equal(boxBalconyRect(0, 18, 6, [0, 4], f, {storey: 1, bay: 0}), null, 'no storey above: no tray');
});

test('Haarlemmerweg 778: the trays are drawn on every group; without boxBalconies the mesh changes and none are counted', () => {
  const intent = validateLargeIntent(raw(PEPPER)), f = facts(PEPPER);
  const {recipe} = fitLarge(intent, f);
  assert.equal(recipe.groups[3].boxBalconies!.cells.length, 17);
  const a = compileBuilding(intent, f);
  assert.ok((a.components.boxBalconies ?? 0) >= 40, `trays ${a.components.boxBalconies}`);
  const stripped = raw(PEPPER);
  for (const w of stripped.walls) delete w.boxBalconies;
  const b = compileBuilding(validateLargeIntent(stripped), f);
  assert.equal(b.components.boxBalconies, undefined);
  assert.notEqual(meshHashOf(a.group), meshHashOf(b.group));
});
