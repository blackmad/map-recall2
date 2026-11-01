/**
 * Transvaalbuurt round 5b types (issue #158): the 1930 Albert Luthulistraat stair-tower and stair pands, the 1931
 * Afrikanerplein plain grid (and its door-less half), the 1931 Schalk Burgerstraat diaper row and the 1922 loggia row
 * resolve, validate and compile on the pands they were measured on; `FrontIntent.loggia` (frontLoggia.ts) cuts a
 * recessed opening over a parapet, follows a mirror and is validated.
 *   node --import tsx --test src/canalRecall/blockFace/transvaalbuurt5b.test.ts
 */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as T from 'three';
import type {BuildingFacts} from '../buildingRecipe/facts.ts';
import {compileBuilding} from '../buildingRecipe/compile.ts';
import {validateIntent, type CanalHouseIntent} from '../buildingRecipe/intent.ts';
import {frontLoggiaOpening, frontLoggiaProblems} from '../buildingRecipe/frontLoggia.ts';
import {mirrorFront, resolvePlacement} from './houseType.ts';
import {defaultTypeLoader} from './typeLibrary.ts';

const facts = (face: string, pand: string): BuildingFacts => JSON.parse(fs.readFileSync(`scripts/block-face/faces/${face}/pands/0363100012${pand}/facts.json`, 'utf8'));
function house(typeId: string, pand: string, street: string, mirror = false): CanalHouseIntent {
  const t = defaultTypeLoader(typeId)!;
  const design = resolvePlacement(t, {type: t.id, ...(mirror ? {mirror} : {})}, street).design;
  return validateIntent({schemaVersion: 1, kind: 'canal-house', id: `t-${pand}`, pandId: `0363100012${pand}`, address: street, sources: [{id: 'strip', kind: 'street-panorama', capturedAt: '2020-04-29'}], ...design, notes: []} as CanalHouseIntent);
}
const named = (g: T.Object3D, re: RegExp) => { const out: T.Mesh[] = []; g.traverse(o => { if (o instanceof T.Mesh && re.test(o.name)) out.push(o); }); return out; };
const box = (ms: T.Mesh[]) => { const b = new T.Box3(); for (const m of ms) b.expandByObject(m); return b; };

test('1930 stair tower: eight axes, the tower over the flank-stair-flank axes, the door on the stair axis', () => {
  const f = house('transvaal-1930-stair-tower', '124743', 'Albert Luthulistraat').fronts[0];
  assert.equal(f.axisGrid, 8);
  assert.deepEqual(f.tower?.bays, {from: 3, to: 5});
  assert.equal(f.doorBay, 4);
  assert.deepEqual(mirrorFront(f).tower?.bays, {from: 2, to: 4});
});

test('compile: Albert Luthulistraat 30-32 and 18-20 carry the tower over the coping; 26-28 and 14-16 the ochre stair stripes, no tower', async () => {
  for (const [face, pand] of [['luthuli-22-32', '124743'], ['luthuli-6-20', '092667']] as const) {
    const built = await compileBuilding(house('transvaal-1930-stair-tower', pand, 'Albert Luthulistraat'), facts(face, pand));
    const tower = box(named(built.group, /tower/));
    assert.ok(!tower.isEmpty() && tower.max.y > 15, `${pand}: tower top ${tower.max.y.toFixed(2)} m`);
  }
  for (const [face, pand] of [['luthuli-22-32', '088339'], ['luthuli-6-20', '087850']] as const) {
    const built = await compileBuilding(house('transvaal-1930-stair-block', pand, 'Albert Luthulistraat'), facts(face, pand));
    assert.equal(named(built.group, /tower/).length, 0, `${pand}: no tower`);
    assert.ok(named(built.group, /stripe-z0/).length > 0, `${pand}: stair stripes`);
  }
});

test('compile: Afrikanerplein 35 and 49 (plain grid, door-less half), Schalk Burgerstraat 71-77 and 59-63 (diaper row, mirrored)', async () => {
  for (const [typeId, face, pand, street, mirror] of [
    ['transvaal-1931-plain-grid', 'afrikanerplein-25-55', '086955', 'Afrikanerplein', false],
    ['transvaal-1931-plain-grid-nodoor', 'afrikanerplein-25-55', '125852', 'Afrikanerplein', true],
    ['transvaal-1931-diaper-row', 'burger-45-131', '093454', 'Schalk Burgerstraat', false],
    ['transvaal-1931-diaper-row', 'burger-45-131', '140152', 'Schalk Burgerstraat', true],
  ] as const) {
    const h = house(typeId, pand, street, mirror);
    assert.equal(h.fronts[0].storeys, 5);
    if (typeId.endsWith('nodoor')) assert.equal(h.fronts[0].doorBay, null);
    const built = await compileBuilding(h, facts(face, pand));
    assert.ok(named(built.group, /eaves-overhang|eavesOverhang/i).length > 0 || built.group.children.length > 0);
  }
});

test('loggia: validation of storeys, axes, deep, rail, head, lights', () => {
  const ok = {storeys: [1], axes: [1], deep: 1, rail: 1.3};
  assert.deepEqual(frontLoggiaProblems(ok, 2, 2, 'f'), []);
  assert.match(frontLoggiaProblems({...ok, storeys: [0]}, 2, 2, 'f').join(), /storeys/);
  assert.match(frontLoggiaProblems({...ok, axes: [2]}, 2, 2, 'f').join(), /axes/);
  assert.match(frontLoggiaProblems({...ok, deep: 2}, 2, 2, 'f').join(), /deep/);
  assert.match(frontLoggiaProblems({...ok, rail: 0.1}, 2, 2, 'f').join(), /rail/);
  assert.match(frontLoggiaProblems({...ok, head: 1.2}, 2, 2, 'f').join(), /head/);
  assert.match(frontLoggiaProblems({...ok, lights: 0}, 2, 2, 'f').join(), /lights/);
  assert.match(frontLoggiaProblems({...ok, depth: 1}, 2, 2, 'f').join(), /\{storeys/);
  const o = frontLoggiaOpening({...ok, head: 0.88, lights: 3}, 'l', 4.7, 2.5, 3.25, 3, 0.75);
  assert.deepEqual([o.bottomM, o.heightM, o.widthM, o.recessM], [4.55, 1.34, 2.5, 1]);
  assert.equal(o.verticalBars?.length, 2);
});

// The Colensostraat and Vaalrivierstraat pands do not compile with any type: BAG puts their window axis 0.64-0.66 m in front
// of the door/loggia bay, past the kit's 0.5 m frontage outset (canalhouseRecipes: 'Grouped frontage is not a straight
// surveyed wall'). The loggia is exercised on two straight-fronted 1920 pands of De la Reijstraat 25-39 (5.6 and 7.2 m).
test('compile: the loggia row on De la Reijstraat 33 and 37-39 (mirrored) facts: the loggia glass stands back over a parapet; the other axis keeps its window', async () => {
  for (const [face, pand, mirror] of [['reij-25-39', '098320', false], ['reij-25-39', '123796', true]] as const) {
    const h = house('transvaal-1922-loggia-row', pand, 'De la Reijstraat', mirror);
    assert.deepEqual(h.fronts[0].loggia?.axes, [mirror ? 0 : 1]);
    const built = await compileBuilding(h, facts(face, pand));
    const panes = named(built.group, /opening\/loggia-s1-b\d\/pane/), returns = named(built.group, /opening\/loggia-s1-b\d\/recess/);
    assert.ok(panes.length > 0 && returns.length > 0, `${pand}: loggia pane and recess`);
    const windows = named(built.group, /opening\/s1-b\d\/pane/);
    assert.ok(windows.length > 0, `${pand}: the window axis`);
    const lb = box(panes), wb = box(windows);
    assert.ok(lb.min.y > wb.min.y + 0.1, `${pand}: loggia glass from the parapet top (${lb.min.y.toFixed(2)} m) over the window sill (${wb.min.y.toFixed(2)} m)`);
  }
});
