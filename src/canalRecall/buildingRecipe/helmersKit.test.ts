/**
 * Helmersbuurt kit components (issue #81): frieze vents (`friezeVents`), jamb blocks (`jambBlocks`), per-axis window
 * heads (`axisHeads`), wall-dormer lights per axis and the merlon cap (`tower.lights`, `cap: merlons`), a band-brick
 * tympanum under a relieving arch, the measured crown band (`entablature`) and white dormer bodies (`dormerBody`); each
 * validated, each drawn on its exemplar house, and absent = no meshes/openings.
 *   node --import tsx --test src/canalRecall/buildingRecipe/helmersKit.test.ts
 */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as T from 'three';
import type {BuildingFacts} from './facts.ts';
import {compileBuilding} from './compile.ts';
import {validateIntent, type CanalHouseIntent, type FrontIntent} from './intent.ts';
import {topStoreyAxes} from './friezeVents.ts';
import {jambBlockBoxes} from './jambBlocks.ts';
import {fitIntent} from './fit.ts';
import {resolvePlacement, mirrorFront} from '../blockFace/houseType.ts';
import {defaultTypeLoader} from '../blockFace/typeLibrary.ts';

const facts = (face: string, pand: string): BuildingFacts => JSON.parse(fs.readFileSync(`scripts/block-face/faces/${face}/pands/${pand}/facts.json`, 'utf8'));
const meshes = (g: T.Object3D, re: RegExp) => { const out: T.Mesh[] = []; g.traverse(o => { if (o instanceof T.Mesh && re.test(o.name)) out.push(o); }); return out; };

function house(typeId: string, pand: string, edit?: (f: FrontIntent) => void): CanalHouseIntent {
  const t = defaultTypeLoader(typeId)!;
  const design = resolvePlacement(t, {type: t.id}, 'Eerste Helmersstraat').design;
  if (edit) design.fronts.forEach(edit);
  return validateIntent({schemaVersion: 1, kind: 'canal-house', id: `helmers-${pand.slice(-6)}`, pandId: pand, address: 'Eerste Helmersstraat', sources: [{id: 'strip', kind: 'street-panorama', capturedAt: '2024-11-29'}], ...design, notes: []} as CanalHouseIntent);
}
const bad = (h: CanalHouseIntent, patch: Partial<FrontIntent>) => () => validateIntent({...h, fronts: h.fronts.map(f => ({...f, ...patch}))} as CanalHouseIntent);

test('frieze vents: top-storey axes; validation; one panel per axis on Eerste Helmersstraat 225, none without the key', async () => {
  assert.deepEqual(topStoreyAxes([{id: 's1-b0', kind: 'window', leftM: 0, widthM: 1}, {id: 's2-b1', kind: 'window', leftM: 2, widthM: 1}, {id: 's2-b0', kind: 'window', leftM: 0, widthM: 1}, {id: 'door', kind: 'door', leftM: 4, widthM: 1}]), [0.5, 2.5]);
  const h = house('helmers-1897-balconette', '0363100012164920');
  assert.throws(bad(h, {friezeVents: {span: 0.85, rise: 0.18, drop: 0.2, width: 1} as never}), /friezeVents/);
  assert.throws(bad(h, {friezeVents: {span: 5, rise: 0.18, drop: 0.2}}), /friezeVents.span/);
  assert.throws(bad(h, {cornice: 'none'}), /needs a cornice/);
  const f = facts('helmers-209-253', '0363100012164920');
  const built = await compileBuilding(h, f);
  const panels = meshes(built.group, /^frieze-vents\/.*\/panels$/);
  assert.equal(panels.length, 1);
  assert.equal(panels[0].geometry.getAttribute('position').count, 3 * 30, 'three boxes of 5 faces');
  const without = await compileBuilding(house('helmers-1897-balconette', '0363100012164920', fr => { delete fr.friezeVents; }), f);
  assert.equal(meshes(without.group, /^frieze-vents/).length, 0);
});

test('jamb blocks: count a jamb, evenly spaced, both sides; validation; drawn on Eerste Helmersstraat 118', async () => {
  const boxes = jambBlockBoxes([{id: 's1-b0', kind: 'window', leftM: 1, widthM: 1, bottomM: 4, heightM: 2}, {id: 's1-door', kind: 'door', leftM: 3, widthM: 1, bottomM: 0, heightM: 2}], {count: 2, rise: 0.1, reach: 0.15});
  assert.equal(boxes.length, 4);
  assert.deepEqual(boxes[0].map(v => Math.round(v * 1000) / 1000), [0.85, 1.02, 4.45, 4.55]);
  assert.deepEqual(boxes[3].map(v => Math.round(v * 1000) / 1000), [1.98, 2.15, 5.45, 5.55]);
  assert.equal(jambBlockBoxes([{id: 's1-b0', kind: 'window', leftM: 1, widthM: 1, bottomM: 4, heightM: 2}], {count: 2, rise: 0.1, reach: 0.15, storeys: [2]}).length, 0);
  const h = house('helmers-1893-jamb-blocks', '0363100012157518');
  assert.throws(bad(h, {jambBlocks: {count: 0, rise: 0.12, reach: 0.14}}), /jambBlocks.count/);
  assert.throws(bad(h, {jambBlocks: {count: 3, rise: 0.12, reach: 0.14, storeys: [5]}}), /jambBlocks.storeys/);
  const f = facts('helmers-108-174', '0363100012157518');
  const built = await compileBuilding(h, f);
  const m = meshes(built.group, /^jamb-blocks\//);
  assert.equal(m.length, 1);
  assert.equal(m[0].userData.surface, 'stone');
  assert.ok(m[0].geometry.getAttribute('position').count / 30 >= 3 * 3 * 2 * 2, 'three blocks a jamb on at least two storeys of three windows');
  const without = await compileBuilding(house('helmers-1893-jamb-blocks', '0363100012157518', fr => { delete fr.jambBlocks; }), f);
  assert.equal(meshes(without.group, /^jamb-blocks/).length, 0);
});

test('axis heads: the round-arched top centre window of Eerste Helmersstraat 237; validation; mirrored keys', () => {
  const h = house('helmers-1899-wall-dormer', '0363100012161336');
  assert.throws(bad(h, {axisHeads: {'7': {kind: 'round', storeys: [3]}}}), /axisHeads.7/);
  assert.throws(bad(h, {axisHeads: {'1': {kind: 'pointed' as never, storeys: [3]}}}), /axisHeads.1.kind/);
  assert.throws(bad(h, {axisHeads: {'1': {kind: 'round', storeys: [0]}}}), /axisHeads.1.storeys/);
  const f = facts('helmers-209-253', '0363100012161336');
  const {recipe} = fitIntent(h, f);
  const win = (id: string) => recipe.elevations[0].openings.value.find(o => o.id === id)!;
  const centre = win('s3-b1'), side = win('s3-b0');
  assert.equal(centre.head, 'segmental');
  assert.ok(Math.abs(centre.headRiseM! - centre.widthM / 2) < 0.002, 'a semicircle');
  assert.ok(side.headRiseM! < 0.15, 'the neighbours keep the shallow segmental head');
  assert.ok(win('s2-b0').headRiseM! < 0.15 && win('s1-b0').headRiseM! < 0.15, 'only the listed storeys');
  const m = mirrorFront({...h.fronts[0], bays: 4, axisHeads: {'0': {kind: 'round', storeys: [3]}}} as FrontIntent);
  assert.deepEqual(m.axisHeads, {'3': {kind: 'round', storeys: [3]}});
});

test('wall dormer: one light per spanned axis; merlon cap; validation', async () => {
  const h = house('helmers-1899-wall-dormer', '0363100012161336');
  const f = facts('helmers-209-253', '0363100012161336');
  const {recipe} = fitIntent(h, f);
  const lights = recipe.elevations[0].openings.value.filter(o => /^tower-a\d+$/.test(o.id));
  assert.deepEqual(lights.map(o => o.id), ['tower-a1']);
  const top = recipe.elevations[0].openings.value.find(o => o.id === 's3-b1')!;
  assert.ok(Math.abs(lights[0].leftM + lights[0].widthM / 2 - (top.leftM + top.widthM / 2)) < 0.02, 'centred on the axis');
  assert.throws(bad(h, {tower: {...h.fronts[0].tower!, lightRise: 1.5}}), /lightRise/);
  assert.throws(bad(h, {tower: {rise: 0.65, cap: 'flat', lights: 'per-axis'}}), /lights/);
  const merlons = house('helmers-1899-wall-dormer', '0363100012161336', fr => { fr.tower = {...fr.tower!, cap: 'merlons'}; });
  const built = await compileBuilding(merlons, f);
  let names = 0; built.group.traverse(o => { if (/merlon/i.test(o.name)) names++; });
  assert.ok(names >= 1, 'merlon blocks on the cap');
});

test('relieving arch over a band-brick tympanum (Eerste Helmersstraat 213); stone still refused', () => {
  const h = house('helmers-1897-banded', '0363100012159748');
  const f = facts('helmers-209-253', '0363100012159748');
  const {recipe} = fitIntent(h, f);
  const tymp = (recipe.elevations[0].ornaments?.value ?? []).filter(o => o.id.startsWith('tympanum-'));
  assert.ok(tymp.length >= 6, `tympana ${tymp.length}`);
  assert.ok(tymp.every(o => o.fill === 'accent'));
  assert.throws(bad(h, {windowHead: {...h.fronts[0].windowHead!, tympanum: 'stone'}}), /tympanum/);
});

test('entablature: the measured crown band of Eerste Helmersstraat 120 (white frieze) and 54 (consoles); validation; absent = style', () => {
  const h = house('helmers-1893-jamb-blocks', '0363100012164727');
  const f = facts('helmers-108-174', '0363100012164727');
  const c = fitIntent(h, f).recipe.elevations[0].cornice!.value;
  assert.equal(c.heightM, 1.2);
  assert.equal(c.layers!.length, 3, 'cap, flush white frieze, architrave');
  assert.ok(Math.abs(c.layers![0].bottomM + c.layers![0].heightM - (c.bottomM + c.heightM)) < 0.002, 'the cap tops the band');
  assert.ok(c.layers![0].underside, 'a moulded cap');
  assert.equal(c.accents, undefined, 'no consoles');
  const g = fitIntent(house('helmers-1900-balcony-arch', '0363100012165540'), facts('helmers-40-60', '0363100012165540')).recipe.elevations[0].cornice!.value;
  assert.equal(g.heightM, 1.65);
  assert.equal(g.layers!.length, 2, 'cap and architrave over an open brick frieze');
  assert.equal(g.accents!.length, 4);
  assert.ok(g.accents!.every(a => a.profile === 'console' && a.bottomM >= g.bottomM && a.bottomM + a.heightM <= g.bottomM + g.heightM + 1e-9));
  assert.throws(bad(h, {entablature: {rise: 3, cap: 0.35, frieze: 'trim'}}), /entablature.rise/);
  assert.throws(bad(h, {entablature: {rise: 1.2, cap: 0.35, frieze: 'stone' as never}}), /entablature.frieze/);
  assert.throws(bad(h, {entablature: {rise: 0.5, cap: 0.4, frieze: 'trim', architrave: 0.1}}), /no frieze/);
  assert.throws(bad(h, {entablature: {rise: 1.2, cap: 0.35, frieze: 'trim', consoles: 1}}), /consoles/);
  assert.throws(bad(h, {cornice: 'none'}), /entablature: needs a cornice/);
  const plain = fitIntent(house('helmers-1893-jamb-blocks', '0363100012164727', fr => { delete fr.entablature; }), f).recipe.elevations[0].cornice!.value;
  assert.equal(plain.heightM, 0.35);
  assert.equal(plain.layers, undefined);
});

test('dormer body: white timber dormers in the stone slot (not frame-class); validation; absent = trim', () => {
  const h = house('helmers-1897-balconette', '0363100012164920');
  const f = facts('helmers-209-253', '0363100012164920');
  const d = fitIntent(h, f).recipe.elevations[0].dormers!.value;
  assert.ok(d.length >= 1 && d.every(x => x.wallSurface === 'stone'));
  const trim = fitIntent(house('helmers-1897-balconette', '0363100012164920', fr => { delete fr.dormerBody; }), f).recipe.elevations[0].dormers!.value;
  assert.ok(trim.every(x => x.wallSurface === 'trim'));
  assert.throws(bad(h, {dormerBody: 'timber' as never}), /dormerBody/);
  assert.throws(bad(h, {dormers: 0}), /dormerBody: needs dormers/);
  assert.throws(bad(h, {dormerStyle: 'box'}), /dormerBody: a box dormer/);
});
