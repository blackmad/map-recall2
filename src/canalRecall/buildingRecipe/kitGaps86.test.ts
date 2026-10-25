/**
 * GitHub #86 kit gaps (Da Vinci college Nieuwpoortkade, GWL terrein Waterkeringweg, 2026-10-25): a ringed side light in
 * its own frame colour inside each window (`sideLight`), per-storey per-bay windows off the bay axis with doors
 * (`bayWindows`), and recessed loggia bands across a run of bays and storeys with a windowed back wall (`loggiaBands`):
 * schema, the byte-identical expansion without them, the system rows they make, and the compiled houses.
 */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import type {Mesh} from 'three';
import {validateLargeIntent} from './largeIntent.ts';
import {fitLarge} from './fitLarge.ts';
import {compileBuilding} from './compile.ts';
import {evaluateLargeGates, LARGE_BUDGET_TRIANGLES} from './largeGates.ts';
import type {BuildingFacts} from './facts.ts';
import type {CompiledLargeBuilding} from './largeCompile.ts';
import {largeSystem, LOGGIA_BAND, type SystemFit} from '../blockBuilding/systems.ts';
import {canalhouseGroupToGlb} from '../../../scripts/canalhouse-recipes/export-glb.ts';
import {decodeTriangles} from '../../../scripts/building-recipes/compile.ts';

const HOUSES = 'scripts/building-recipes/houses';
const raw = (id: string) => JSON.parse(fs.readFileSync(`${HOUSES}/${id}/intent.json`, 'utf8'));
const facts = (id: string): BuildingFacts => JSON.parse(fs.readFileSync(`${HOUSES}/${id}/facts.json`, 'utf8'));
const DV = 'nieuwpoortkade-2-090791', GWL = 'waterkeringweg-7-136141';
const slots = {frame: 'frame', stone: 'stone', glass: 'glass', door: 'door', curtain: 'frame'};

test('#86 schema: sideLight, bayWindows and loggiaBands are bounded fractions with clashes refused', () => {
  const base = raw(DV), w2 = base.walls[2];
  const bare = {...w2};
  delete bare.sideLight; delete bare.bayWindows;
  const withWall = (w: object) => ({...base, walls: [...base.walls.slice(0, 2), {...bare, ...w}, ...base.walls.slice(3)]});
  assert.ok(validateLargeIntent(base));
  assert.ok(validateLargeIntent(withWall({})));
  const sl = {side: 'left', w: 0.38, low: 0.15, high: 0.82, colour: '#3f7e9a'};
  assert.throws(() => validateLargeIntent(withWall({sideLight: {...sl, w: 1.4}})), /sideLight/);
  assert.throws(() => validateLargeIntent(withWall({sideLight: sl, glazing: 'panes'})), /not with glazing panes/);
  const pat = (b: object) => ({bayWindows: [{storeys: [1], pattern: [{w: 0.8}, b]}]});
  assert.ok(validateLargeIntent(withWall({sideLight: sl, ...pat({w: 0.3, at: -0.2, h: 0.4, sill: 0.4, light: 1})})));
  assert.throws(() => validateLargeIntent(withWall(pat({w: 0.3, light: 0.5}))), /needs the group's sideLight/);
  assert.throws(() => validateLargeIntent(withWall(pat({w: 0.3, at: 1.5}))), /\.at: fraction/);
  assert.throws(() => validateLargeIntent(withWall(pat({w: 0.3, h: 0.6, sill: 0.5}))), /leave a head/);
  assert.throws(() => validateLargeIntent(withWall(pat({w: 0.3, widthM: 1}))), /widthM/);
  assert.throws(() => validateLargeIntent(withWall({...pat({w: 0.3}), windowPattern: [0.8, 0.3]})), /not with windowPattern/);
  assert.throws(() => validateLargeIntent(withWall({bayWindows: [{storeys: [1], pattern: [{w: 0.8}]}, {storeys: [1], pattern: [{w: 0.5}]}]})), /in two entries/);
  const band = {storeys: [1, 2], bays: [2, 4], sill: 0.03, head: 0.85, deep: 0.5, lights: 3, rail: 'bars'};
  assert.ok(validateLargeIntent(withWall({loggiaBands: [band]})));
  assert.ok(validateLargeIntent(withWall({loggiaBands: [{...band, back: [{sill: 0, h: 0.5, every: 2, w: 0.8}]}]})));
  assert.throws(() => validateLargeIntent(withWall({loggiaBands: [band, {...band, bays: [4, 5]}]})), /overlaps/);
  assert.throws(() => validateLargeIntent(withWall({loggiaBands: [{...band, deep: 1.2}]})), /deep/);
  assert.throws(() => validateLargeIntent(withWall({loggiaBands: [{...band, storeys: [2, 1]}]})), /storeys/);
});

test('#86 largeSystem: absent = unchanged; side lights ring the punched windows; bay windows place items; bands recess', () => {
  const fit: SystemFit = {pitchM: 4, lines: [0, 3.6, 7, 10.4, 13], ground: 'system', slots, bays: 4, shape: {w: 0.8, h: 0.55, sillM: 0.7}};
  const plain = largeSystem('brick-bay-grid', fit);
  for (const k of ['sash', 'recessBands', 'items']) assert.equal(JSON.stringify(plain).includes(k), false, k);
  assert.deepEqual(largeSystem('brick-bay-grid', {...fit, bayWindows: [], loggiaBands: []}), plain);
  const sash = {side: 'left' as const, w: 0.38, low: 0.15, high: 0.82, slot: 'frame@sl0'};
  const lit = largeSystem('brick-bay-grid', {...fit, sideLight: sash});
  for (const st of ['1', '2']) assert.deepEqual(lit.rowOverrides![st].win!.sash, sash);
  assert.deepEqual(lit.ground.win?.sash, sash);
  assert.deepEqual({...lit.rowOverrides!['1'].win, sash: undefined}, {...plain.typical.win, sash: undefined}, 'only the light is added');
  const bw = largeSystem('brick-bay-grid', {...fit, sideLight: sash, bayWindows: [{storeys: [1], pattern: [{w: 0.3, at: -0.2, h: 0.4, sillM: 1.2, light: 1}, {w: 0}, {w: 0.4, door: true}]}]});
  const cyc = bw.rowOverrides!['1'].cycle!;
  assert.equal(cyc.length, 3);
  const it = cyc[0].items![0][0];
  assert.equal(it.kind, 'win');
  if (it.kind === 'win' && it.win) {
    assert.deepEqual(it.u, [0.6, 1.8]); // centre 2 - 0.8, 1.2 wide
    assert.deepEqual(it.v, [1.2, +(1.2 + 0.4 * 3.4).toFixed(3)]);
    assert.equal(it.win.sash!.w, 1);
  }
  assert.deepEqual(cyc[1], {kind: 'wall'});
  const door = cyc[2].items![0][0];
  if (door.kind === 'win' && door.win) { assert.equal(door.win.glass, 'door'); assert.equal(door.win.sillSlot, null); assert.equal(door.win.sash, undefined); }
  assert.deepEqual(bw.rowOverrides!['2'], lit.rowOverrides!['2'], 'unlisted storeys keep their row');
  const lb = largeSystem('brick-bay-grid', {...fit, loggiaBands: [{storeys: [1, 2], bays: [1, 2], sillM: 0.1, headM: 2.9, deepM: 1.7, lights: 4, rail: 'bars', railSlot: 'rail@lb0k0',
    back: [{sill: 0, h: 0.5, every: 2, w: 0.75}]}]});
  assert.deepEqual({...lb, recessBands: undefined}, {...plain, recessBands: undefined}, 'the band leaves the rows alone');
  const rb = lb.recessBands![0];
  assert.deepEqual([rb.floors, rb.bays, rb.sill, rb.head, rb.inset], [[1, 2], [1, 2], 0.1, 2.9, LOGGIA_BAND.insetM]);
  assert.equal(rb.win.w, 8);
  assert.deepEqual(rb.win.mullAt, [0.25, 0.5, 0.75]);
  assert.deepEqual(rb.win.loggia, {depth: 1.7, rail: {kind: 'bars', h: 1, slot: 'rail@lb0k0'}, back: {rows: [{lo: 0, hi: 0.5, pitch: 8, winW: 6}]}});
  const ground = largeSystem('brick-bay-grid', {...fit, loggiaBands: [{storeys: [0, 0], bays: [0, 0], sillM: 0, headM: 3, deepM: 1.8, lights: 1, rail: 'glass', railSlot: 'frame'}]});
  assert.equal(ground.recessBands![0].win.loggia!.rail, undefined, 'no rail on the ground');
});

const glbTris = async (id: string, built: CompiledLargeBuilding) =>
  decodeTriangles((await canalhouseGroupToGlb(id, built.group, {metreUvs: true, slotFor: m => m.userData.materialSlot as string, maxBytes: 2_000_000})).bytes);

test('#86 Da Vinci compile: the side-light slot carries the measured blue, gates pass in budget', async () => {
  const intent = validateLargeIntent(raw(DV)), f = facts(DV);
  const {recipe} = fitLarge(intent, f);
  const sl = [...new Set(JSON.stringify(recipe.spec).match(/frame@sl\d+/g) ?? [])];
  assert.ok(sl.length >= 2, JSON.stringify(sl));
  const built = compileBuilding(intent, f);
  const blue = (built.group.children as Mesh[]).filter(m => m.userData.materialSlot === 'frame' && (m.material as import('three').MeshStandardMaterial).color?.getHexString() === '3f7e9a');
  assert.ok(blue.length >= 1 && blue.some(m => m.geometry.getAttribute('position').count > 1000), 'the side lights draw in the measured blue frame tint');
  const tris = await glbTris(intent.id, built);
  assert.ok(tris.length <= (intent.budgetTriangles ?? LARGE_BUDGET_TRIANGLES), `${tris.length}`);
  assert.deepEqual(evaluateLargeGates(tris, built).gates.filter(x => !x.pass).map(x => x.id), []);
});

test('#86 GWL compile: loggia band glass sits at the band depth behind the face, gates pass in budget', async () => {
  const intent = validateLargeIntent(raw(GWL)), f = facts(GWL);
  const {recipe} = fitLarge(intent, f), g = recipe.groups[4];
  assert.ok(g.loggiaDepthM! > 1, `${g.loggiaDepthM}`);
  const built = compileBuilding(intent, f), main = built.panels.find(p => p.index === g.mainPanel)!;
  let back = 0;
  for (const m of built.group.children as Mesh[]) {
    if (m.userData.materialSlot !== 'glass') continue;
    const a = m.geometry.getAttribute('position');
    for (let i = 0; i < a.count; i++) {
      const d = (a.getX(i) - main.o[0]) * main.n[0] + (a.getY(i) - main.o[1]) * main.n[1] + (a.getZ(i) - main.o[2]) * main.n[2];
      if (a.getY(i) > g.lines[3] && d < -1) back++;
    }
  }
  assert.ok(back >= 16, `band glass vertices more than 1 m behind the face: ${back}`);
  const tris = await glbTris(intent.id, built);
  assert.ok(tris.length <= (intent.budgetTriangles ?? LARGE_BUDGET_TRIANGLES), `${tris.length}`);
  assert.deepEqual(evaluateLargeGates(tris, built).gates.filter(x => !x.pass).map(x => x.id), []);
});
