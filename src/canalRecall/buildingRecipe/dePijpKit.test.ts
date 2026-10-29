/**
 * De Pijp kit components (issue #96): hoist beams over every dormer (`dormerHoist`), iron wall anchors on the piers over
 * each upper storey's heads (`wallAnchors`) and window hoods in the band brick or stone colour (`windowHoods: {colour}`);
 * each validated, each drawn on its exemplar house, and absent = no meshes/beams.
 *   node --import tsx --test src/canalRecall/buildingRecipe/dePijpKit.test.ts
 */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as T from 'three';
import type {BuildingFacts} from './facts.ts';
import {compileBuilding} from './compile.ts';
import {validateIntent, type CanalHouseIntent, type FrontIntent} from './intent.ts';
import {fitIntent} from './fit.ts';
import {wallAnchorCentres, WALL_ANCHORS} from './wallAnchors.ts';
import {resolvePlacement} from '../blockFace/houseType.ts';
import {defaultTypeLoader} from '../blockFace/typeLibrary.ts';

const facts = (face: string, pand: string): BuildingFacts => JSON.parse(fs.readFileSync(`scripts/block-face/faces/${face}/pands/${pand}/facts.json`, 'utf8'));
const meshes = (g: T.Object3D, re: RegExp) => { const out: T.Mesh[] = []; g.traverse(o => { if (o instanceof T.Mesh && re.test(o.name)) out.push(o); }); return out; };

function house(typeId: string, pand: string, street: string, edit?: (f: FrontIntent) => void): CanalHouseIntent {
  const t = defaultTypeLoader(typeId)!;
  const design = resolvePlacement(t, {type: t.id}, street).design;
  if (edit) design.fronts.forEach(edit);
  return validateIntent({schemaVersion: 1, kind: 'canal-house', id: `pijp-${pand.slice(-6)}`, pandId: pand, address: street, sources: [{id: 'strip', kind: 'street-panorama', capturedAt: '2022-03-21'}], ...design, notes: []} as CanalHouseIntent);
}
const bad = (h: CanalHouseIntent, patch: Partial<FrontIntent>) => () => validateIntent({...h, fronts: h.fronts.map(f => ({...f, ...patch}))} as CanalHouseIntent);

// Albert Cuypstraat 162 (pijp-1892-plain-anchor): a pediment dormer with its hoist beam, anchors on every pier.
const CUYP = ['cuyp-130-168', '0363100012164103', 'Albert Cuypstraat'] as const;

test('dormer hoist: one beam per dormer at its crown, stone with a stone dormer; validation; none without the key', () => {
  const h = house('pijp-1892-plain-anchor', CUYP[1], CUYP[2]);
  assert.throws(bad(h, {dormerHoist: {reach: 3}}), /dormerHoist/);
  assert.throws(bad(h, {dormerHoist: {reach: 0.8, beam: 1} as never}), /dormerHoist/);
  assert.throws(bad(h, {dormerHoist: {}, hoist: true} as never), /hoist/);
  const f = facts(CUYP[0], CUYP[1]);
  const {recipe} = fitIntent(h, f);
  const el = recipe.elevations[0], dormers = el.dormers!.value, hoists = el.hoists!.value;
  assert.equal(hoists.length, dormers.length);
  const d = dormers[0], b = hoists[0];
  assert.ok(Math.abs(b.centerM - (d.leftM + d.widthM / 2)) < 0.01);
  assert.ok(Math.abs(b.heightM - (d.bottomM + d.heightM + 0.08)) < 0.01);
  assert.equal(b.surface, 'stone');
  const {recipe: without} = fitIntent(house('pijp-1892-plain-anchor', CUYP[1], CUYP[2], fr => { delete fr.dormerHoist; }), f);
  assert.equal(without.elevations[0].hoists, undefined);
});

test('wall anchors: one per pier and end pier over each upper storey; validation; drawn in the door colour, none without the key', async () => {
  const w = (id: string, l: number) => ({id, kind: 'window', leftM: l, widthM: 1, bottomM: 4, heightM: 2});
  const c = wallAnchorCentres([w('s1-b0', 1), w('s1-b1', 3), {id: 'door', kind: 'door', leftM: 5, widthM: 1, bottomM: 0, heightM: 2}, w('s0-b0', 1)], {}, 0, 5);
  assert.deepEqual(c, [[0.5, 6 + WALL_ANCHORS.over], [2.5, 6 + WALL_ANCHORS.over], [4.5, 6 + WALL_ANCHORS.over]]);
  assert.equal(wallAnchorCentres([w('s1-b0', 1)], {storeys: [2]}, 0, 3).length, 0);
  const h = house('pijp-1892-plain-anchor', CUYP[1], CUYP[2]);
  assert.throws(bad(h, {wallAnchors: {size: 2}}), /wallAnchors.size/);
  assert.throws(bad(h, {wallAnchors: {storeys: [0]}}), /wallAnchors.storeys/);
  assert.throws(bad(h, {wallAnchors: {over: 0.3, colour: 'red'} as never}), /wallAnchors/);
  const f = facts(CUYP[0], CUYP[1]);
  const built = await compileBuilding(h, f);
  const m = meshes(built.group, /^wall-anchors\//);
  assert.equal(m.length, 1);
  assert.equal(m[0].userData.surface, 'door');
  // two 5-face boxes (30 unindexed positions each) per anchor; three upper storeys x at least three piers
  assert.equal(m[0].geometry.getAttribute('position').count % 60, 0);
  assert.ok(m[0].geometry.getAttribute('position').count / 60 >= 9);
  const without = await compileBuilding(house('pijp-1892-plain-anchor', CUYP[1], CUYP[2], fr => { delete fr.wallAnchors; }), f);
  assert.equal(meshes(without.group, /^wall-anchors/).length, 0);
});

// Ferdinand Bolstraat 40 (pijp-1876-hood-frieze): buff hoods (#d9c49c) over red-brown brick.
const BOL = ['bol-40-54', '0363100012164043', 'Ferdinand Bolstraat'] as const;

test('window hoods colour: band needs palette.band; the hood mesh takes the band colour; plain hoods keep the wall material', async () => {
  const h = house('pijp-1876-hood-frieze', BOL[1], BOL[2]);
  assert.throws(bad(h, {windowHoods: {colour: 'gold'} as never}), /windowHoods/);
  assert.throws(() => validateIntent({...h, palette: {...h.palette, band: undefined}} as CanalHouseIntent), /windowHoods/);
  const f = facts(BOL[0], BOL[1]);
  const built = await compileBuilding(h, f);
  const [hood] = meshes(built.group, /^window-hoods\//);
  assert.equal(hood.userData.surface, 'accent');
  assert.equal('#' + (hood.material as T.MeshStandardMaterial).color.getHexString(), h.palette.band!.toLowerCase());
  const plain = await compileBuilding(house('pijp-1876-hood-frieze', BOL[1], BOL[2], fr => { fr.windowHoods = true; }), f);
  assert.equal(meshes(plain.group, /^window-hoods\//)[0].userData.surface, 'wall');
});
