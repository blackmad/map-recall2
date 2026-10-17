/**
 * Plan Zuid kit components on the Rivierenbuurt flat type, Boterdiepstraat 46 (065337, boterdiep-36-66): the flat roof's
 * deep eaves overhang (`eavesOverhang`, eavesOverhang.ts) and the slab canopies over the ground door and window
 * (`groundCanopy`, groundCanopy.ts): validation, geometry against the fit, measured tints; without the keys no mesh.
 *   node --import tsx --test src/canalRecall/buildingRecipe/rivierenbuurt.test.ts
 */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as T from 'three';
import type {BuildingFacts} from './facts.ts';
import {compileBuilding} from './compile.ts';
import {validateIntent, type CanalHouseIntent} from './intent.ts';
import {mergeSpans} from './groundCanopy.ts';
import {RIBBON_POST_M} from './fit.ts';
import {resolvePlacement} from '../blockFace/houseType.ts';
import {defaultTypeLoader} from '../blockFace/typeLibrary.ts';

const PAND = '0363100012065337';
const facts: BuildingFacts = JSON.parse(fs.readFileSync(`scripts/block-face/faces/boterdiep-36-66/pands/${PAND}/facts.json`, 'utf8'));
const meshes = (g: T.Object3D, re: RegExp) => { const out: T.Mesh[] = []; g.traverse(o => { if (o instanceof T.Mesh && re.test(o.name)) out.push(o); }); return out; };
const box = (m: T.Mesh) => new T.Box3().setFromBufferAttribute(m.geometry.getAttribute('position') as T.BufferAttribute);

function house(o: {overhang?: boolean; canopy?: boolean} = {}): CanalHouseIntent {
  const t = defaultTypeLoader('rijn-1934-flat-three')!;
  const design = resolvePlacement(t, {type: t.id}, 'Boterdiepstraat').design;
  for (const f of design.fronts) { if (o.overhang === false) delete f.eavesOverhang; if (o.canopy === false) delete f.groundCanopy; }
  return validateIntent({schemaVersion: 1, kind: 'canal-house', id: 'boterdiep-065337', pandId: PAND, address: 'Boterdiepstraat 46', sources: [{id: 'strip', kind: 'street-panorama', capturedAt: '2020-01-07'}], ...design} as CanalHouseIntent);
}

test('validation: ranges, colours, and the fronts each key needs', () => {
  const base = house();
  const front = (patch: Record<string, unknown>) => () => validateIntent({...base, fronts: base.fronts.map(f => ({...f, ...patch}))} as CanalHouseIntent);
  assert.throws(front({eavesOverhang: {projection: 2, fascia: 0.45}}), /eavesOverhang.projection/);
  assert.throws(front({eavesOverhang: {projection: 0.75, fascia: 0.45, colour: 'white'}}), /eavesOverhang.colour/);
  assert.throws(front({cornice: 'simple'}), /eavesOverhang: the overhang is the front's eaves/);
  assert.throws(front({groundCanopy: {projection: 0.45, thickness: 0.5, overhang: 0.1, gap: 0.1}}), /groundCanopy.thickness/);
  assert.throws(front({groundCanopy: {projection: 0.45, thickness: 0.12, overhang: 0.1, gap: 0.1, over: ['roof']}}), /groundCanopy.over/);
  assert.throws(front({groundCanopy: {projection: 0.45, thickness: 0.12, overhang: 0.1, gap: 0.1, depthM: 1}}), /groundCanopy/);
});

test('mergeSpans: slabs that meet at one height become one', () => {
  assert.deepEqual(mergeSpans([{l: 2, r: 4, y: 2.2}, {l: 0, r: 2.1, y: 2.21}]), [{l: 0, r: 4, y: 2.21}]);
  assert.equal(mergeSpans([{l: 0, r: 1, y: 2.2}, {l: 1.5, r: 3, y: 2.2}]).length, 2);
  assert.equal(mergeSpans([{l: 0, r: 2, y: 2.2}, {l: 1.5, r: 3, y: 2.6}]).length, 2);
});

test('Boterdiepstraat 46: a 0.75 m overhang at the eaves and canopies over the ground openings, measured tints', async () => {
  const built = await compileBuilding(house(), facts);
  const fascia = meshes(built.group, /^eaves-overhang\/.*\/fascia$/), soffit = meshes(built.group, /^eaves-overhang\/.*\/soffit$/);
  assert.equal(fascia.length, 1);
  assert.equal(soffit.length, 1);
  const fb = box(fascia[0]);
  // Facade frame: z out of the wall; the slab reaches 0.75 m out and hangs 0.45 m from the eaves.
  assert.ok(Math.abs(fb.max.z - 0.75) < 1e-3, `projection ${fb.max.z}`);
  assert.ok(Math.abs(fb.max.y - fb.min.y - 0.45) < 1e-3, `fascia ${fb.max.y - fb.min.y}`);
  assert.ok(fb.max.y > 11.8 && fb.max.y < 12.9, `eaves ${fb.max.y}`);
  for (const m of [...fascia, ...soffit]) assert.equal(((m.material as T.MeshStandardMaterial).userData as {tintSource?: string}).tintSource, 'measured');
  assert.equal('#' + (fascia[0].material as T.MeshStandardMaterial).color.getHexString(), '#e4e1d8');
  const canopy = meshes(built.group, /^ground-canopy\//);
  assert.equal(canopy.length, 1);
  const cb = box(canopy[0]);
  // Over the ground openings (heads near 3 m on this type), under the first-storey sills (4.0 m), 0.45 m deep.
  assert.ok(cb.min.y > 2.2 && cb.max.y < 4.0, `canopy ${cb.min.y}-${cb.max.y}`);
  assert.ok(Math.abs(cb.max.z - 0.45) < 1e-3);
  // The door slab and the window slab: two boxes of 5 faces (10 triangles) each.
  assert.equal(canopy[0].geometry.getAttribute('position').count / 3, 20);
});

test('without the keys no overhang and no canopy mesh (the kit stays as it was)', async () => {
  const without = await compileBuilding(house({overhang: false, canopy: false}), facts);
  assert.equal(meshes(without.group, /^(eaves-overhang|ground-canopy)\//).length, 0);
  const onlyOverhang = await compileBuilding(house({canopy: false}), facts);
  assert.equal(meshes(onlyOverhang.group, /^ground-canopy\//).length, 0);
  assert.equal(meshes(onlyOverhang.group, /^eaves-overhang\//).length, 2);
});

test('ground oriel: Boterdiepstraat 17 (134610) canted bay from the pavement, the console under storey 1', async () => {
  const pand = '0363100012134610', f17: BuildingFacts = JSON.parse(fs.readFileSync(`scripts/block-face/faces/boterdiep-3-59/pands/${pand}/facts.json`, 'utf8'));
  const t = defaultTypeLoader('rijn-1934-erker-ribbon')!;
  const intent = validateIntent({schemaVersion: 1, kind: 'canal-house', id: 'boterdiep-134610', pandId: pand, address: 'Boterdiepstraat 17', sources: [{id: 'strip', kind: 'street-panorama', capturedAt: '2020-01-07'}], ...resolvePlacement(t, {type: t.id}, 'Boterdiepstraat').design} as CanalHouseIntent);
  assert.deepEqual(intent.fronts[0].bayWindows!.storeys, [0, 1, 2]);
  const built = await compileBuilding(intent, f17), el = built.recipe.elevations[0];
  const bays = (el.glazedBays?.value ?? []).filter(b => /^erker-s\d$/.test(b.id)).sort((a, b) => a.bottomM! - b.bottomM!);
  assert.deepEqual(bays.map(b => b.id), ['erker-s0', 'erker-s1', 'erker-s2']);
  assert.equal(bays[0].bottomM, 0);
  // Measured: glazing 1.0-2.9 m over a brick stallriser.
  assert.ok(Math.abs(bays[0].lowerPanelM - 0.95) < 1e-9 && Math.abs(bays[0].heightM - bays[0].upperPanelM - 2.9) < 0.05, `ground module ${bays[0].lowerPanelM}-${bays[0].heightM - bays[0].upperPanelM}`);
  // No flat ground window left behind the bay; the house door stays.
  assert.equal(el.openings.value.filter(o => /^s0-b\d$/.test(o.id)).length, 0);
  assert.equal(el.openings.value.filter(o => o.id === 'door').length, 1);
  // The console: under storey 1's module, not on the pavement.
  const console = meshes(built.group, /^oriel-console\//);
  assert.equal(console.length, 1);
  const cb = box(console[0]);
  assert.ok(Math.abs(cb.max.y - bays[1].bottomM!) < 0.01, `console top ${cb.max.y} vs storey 1 ${bays[1].bottomM}`);
  // Without a ground oriel the storeys still start at 1 (and 0 is refused on a shopfront).
  assert.throws(() => validateIntent({...intent, fronts: intent.fronts.map(f => ({...f, bayWindows: {...f.bayWindows!, oriel: undefined}}))} as CanalHouseIntent), /bayWindows.storeys/);
});

test('storeyRibbons: Boterdiepstraat 17 (134610) top storey, three two-light windows 0.38 m apart over 0.174-0.911 of the front', async () => {
  const pand = '0363100012134610', f17: BuildingFacts = JSON.parse(fs.readFileSync(`scripts/block-face/faces/boterdiep-3-59/pands/${pand}/facts.json`, 'utf8'));
  const t = defaultTypeLoader('rijn-1934-erker-ribbon')!;
  const design = resolvePlacement(t, {type: t.id}, 'Boterdiepstraat').design;
  const intent = validateIntent({schemaVersion: 1, kind: 'canal-house', id: 'boterdiep-134610', pandId: pand, address: 'Boterdiepstraat 17', sources: [{id: 'strip', kind: 'street-panorama', capturedAt: '2020-01-07'}], ...design} as CanalHouseIntent);
  const width = (await compileBuilding(intent, f17)).fit.fronts[0].widthM;
  const tops = async (it: CanalHouseIntent) => (await compileBuilding(it, f17)).recipe.elevations[0].openings.value.filter(o => /^s3-b\d$/.test(o.id)).sort((a, b) => a.leftM - b.leftM);
  // Measured on the 2020 strip at 80 px/m: 1.06-2.31, 2.69-3.94, 4.31-5.56 m.
  const piers = await tops(intent);
  assert.equal(piers.length, 3);
  assert.ok(Math.abs(piers[0].leftM - 0.174 * width) < 0.01, `band starts ${piers[0].leftM}`);
  assert.ok(Math.abs(piers[2].leftM + piers[2].widthM - 0.911 * width) < 0.01, `band ends ${piers[2].leftM + piers[2].widthM}`);
  for (let k = 1; k < 3; k++) assert.ok(Math.abs(piers[k].leftM - (piers[k - 1].leftM + piers[k - 1].widthM) - 0.38) < 0.01, 'brick piers 0.38 m');
  // Without a pier the windows touch: one post of RIBBON_POST_M between frames.
  const touching = await tops({...intent, fronts: intent.fronts.map(f => ({...f, storeyRibbons: {'3': {from: 0.18, to: 0.91}}}))});
  for (let k = 1; k < 3; k++) assert.ok(Math.abs(touching[k].leftM - (touching[k - 1].leftM + touching[k - 1].widthM) - RIBBON_POST_M) < 1e-3, 'lights 2 cm apart');
  assert.ok(Math.abs(touching[0].leftM - (0.18 * width + RIBBON_POST_M / 2)) < 0.01);
  // The body keeps its narrow axis under the band.
  assert.equal((await compileBuilding(intent, f17)).recipe.elevations[0].openings.value.filter(o => /^s1-b\d$/.test(o.id)).length, 1);
  const bad = (r: unknown) => () => validateIntent({...intent, fronts: intent.fronts.map(f => ({...f, storeyRibbons: r}))} as CanalHouseIntent);
  assert.throws(bad({'3': {from: 0.5, to: 0.6}}), /storeyRibbons.3/);
  assert.throws(bad({'7': {from: 0.1, to: 0.9}}), /storeyRibbons.7/);
  assert.throws(bad({'3': {from: 0.1, to: 0.9, pier: 3}}), /storeyRibbons.3.pier/);
  assert.throws(bad({'3': {from: 0.1, to: 0.9, leftM: 1}}), /storeyRibbons|coordinate/);
});
