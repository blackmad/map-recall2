/**
 * Stone dressings on the large kit (issue #31, factory batch 2 gap "white stone bands, oriels and arch heads on dark
 * brick": Damrak 77, pand-233585, Hirschpassage 2): schema, the fit passing them through (absent = no key, so every other
 * house's recipe is unchanged), compiled geometry (oriels proud of the wall, chains, banded arches, heads, quoins) inside
 * the gates and the budget, and the measurement rule that proposes bands only from clear light rows.
 */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import type * as T from 'three';
import {validateLargeIntent} from './largeIntent.ts';
import {fitLarge} from './fitLarge.ts';
import {compileBuilding} from './compile.ts';
import {evaluateLargeGates, LARGE_BUDGET_TRIANGLES} from './largeGates.ts';
import type {BuildingFacts} from './facts.ts';
import type {CompiledLargeBuilding} from './largeCompile.ts';
import {DRESS, DRESSING_MIN_OUT} from '../blockBuilding/dressings.ts';
import {lightBands, placeBand, proposeBands} from './lightBands.ts';
import {MASK} from './measureFacade.ts';
import {canalhouseGroupToGlb} from '../../../scripts/canalhouse-recipes/export-glb.ts';
import {decodeTriangles} from '../../../scripts/building-recipes/compile.ts';

const HOUSES = 'scripts/building-recipes/houses';
const raw = (id: string) => JSON.parse(fs.readFileSync(`${HOUSES}/${id}/intent.json`, 'utf8'));
const facts = (id: string): BuildingFacts => JSON.parse(fs.readFileSync(`${HOUSES}/${id}/facts.json`, 'utf8'));
const DAMRAK = 'damrak-77-165746', HIRSCH = 'hirschpassage-2-165488';

async function gatesOf(id: string, intent: ReturnType<typeof validateLargeIntent>, built: CompiledLargeBuilding) {
  const glb = await canalhouseGroupToGlb(id, built.group, {metreUvs: true, slotFor: m => m.userData.materialSlot as string, maxBytes: 2_000_000});
  const tris = await decodeTriangles(glb.bytes);
  return {tris: tris.length, failing: evaluateLargeGates(tris, built).gates.filter(x => !x.pass && !x.advisory).map(x => x.id)};
}

/** Vertices of meshes in `slot` lying `d0..d1` in front of panel `p` (metres along its normal). */
function proud(built: CompiledLargeBuilding, panel: number, slot: string, d0: number, d1: number): number {
  const p = built.panels.find(q => q.index === panel)!;
  let n = 0;
  for (const m of built.group.children as T.Mesh[]) {
    if (m.userData.materialSlot !== slot) continue;
    const a = m.geometry.getAttribute('position');
    for (let i = 0; i < a.count; i++) {
      const d = (a.getX(i) - p.o[0]) * p.n[0] + (a.getY(i) - p.o[1]) * p.n[1] + (a.getZ(i) - p.o[2]) * p.n[2];
      const u = (a.getX(i) - p.o[0]) * p.r[0] + (a.getZ(i) - p.o[2]) * p.r[2];
      if (d >= d0 && d <= d1 && u >= p.uMin - 0.1 && u <= p.uMax + 0.1) n++;
    }
  }
  return n;
}

test('dressings schema: counts, storeys and fractions only; unknown fields, metric keys and clashes rejected', () => {
  const base = raw(DAMRAK), withD = (d: unknown) => ({...base, walls: [{...base.walls[0], dressings: d}, ...base.walls.slice(1)]});
  assert.ok(validateLargeIntent(base).walls[0].dressings?.oriels);
  assert.ok(validateLargeIntent(withD({heads: {kind: 'lintel-keystone', storeys: [1, 2]}, quoins: {ends: true}, voussoirs: {jambs: true}, colour: '#f0ebe0'})));
  assert.throws(() => validateLargeIntent(withD({})), /at least one dressing/);
  assert.throws(() => validateLargeIntent(withD({bands: {at: ['eaves']}})), /bands\.at/);
  assert.throws(() => validateLargeIntent(withD({bands: {at: ['floor'], storeys: [9]}})), /bands\.storeys/);
  assert.throws(() => validateLargeIntent(withD({stripes: {storeys: [0], count: 12}})), /stripes\.count/);
  assert.throws(() => validateLargeIntent(withD({heads: {kind: 'lintel'}, surrounds: {}})), /only "keystone" together with surrounds/);
  assert.throws(() => validateLargeIntent(withD({oriels: {bays: [0], from: 0, to: 2}})), /oriels: 1 <= from/);
  assert.throws(() => validateLargeIntent(withD({oriels: {bays: [0], from: 1, to: 2, depthM: 0.6}})), /coordinate\/metric|unknown field/);
  assert.throws(() => validateLargeIntent(withD({quoins: {}})), /ends and\/or joints/);
  assert.throws(() => validateLargeIntent(withD({piers: {w: 0.9}})), /piers\.w/);
  assert.throws(() => validateLargeIntent(withD({colour: 'white'})), /dressings\.colour/);
  assert.throws(() => validateLargeIntent(withD({ribbons: true})), /dressings\.ribbons: unknown field/);
});

test('fit: dressings pass through with their slot; a group without them has no key (recipes of other houses unchanged)', () => {
  const plain = fitLarge(validateLargeIntent(raw('politie-van-leijenberghlaan')), facts('politie-van-leijenberghlaan')).recipe;
  assert.ok(plain.groups.every(g => !('dressings' in g)));
  const base = raw(DAMRAK);
  const own = {...base, walls: [{...base.walls[0], dressings: {...base.walls[0].dressings, colour: '#f2eee4'}}, ...base.walls.slice(1)]};
  const r = fitLarge(validateLargeIntent(own), facts(DAMRAK)).recipe;
  assert.equal(r.groups[0].dressings!.slot, 'dress@g0');
  assert.equal(r.spec.palette['dress@g0'], '#f2eee4');
  assert.equal(fitLarge(validateLargeIntent(base), facts(DAMRAK)).recipe.groups[0].dressings!.slot, r.groups[0].slots.stone);
  assert.ok(!('dressings' in r.groups[1]));
});

test('Damrak 77: canted stone oriels stand proud, chains and speklagen drawn, gates pass in budget', async () => {
  const intent = validateLargeIntent(raw(DAMRAK)), built = compileBuilding(intent, facts(DAMRAK)) as CompiledLargeBuilding;
  const g = built.recipe.groups[0];
  assert.ok((built.components.dressings ?? 0) >= 40, JSON.stringify(built.components));
  // four oriels about 0.6 m out: their fronts and frames stand well past every other dressing
  assert.ok(proud(built, g.mainPanel!, 'stone', 0.4, 1.0) >= 4 * 8, 'oriel bodies');
  assert.ok(proud(built, g.mainPanel!, 'glass', 0.4, 1.1) >= 4 * 4 * 8, 'oriel glazing on the front face');
  const {tris, failing} = await gatesOf(DAMRAK, intent, built);
  assert.ok(tris <= LARGE_BUDGET_TRIANGLES, `${tris}`);
  assert.deepEqual(failing, []);
  // without dressings the same intent draws none of it
  const bare = raw(DAMRAK); delete bare.walls[0].dressings;
  const plain = compileBuilding(validateLargeIntent(bare), facts(DAMRAK)) as CompiledLargeBuilding;
  assert.equal(plain.components.dressings, undefined);
  assert.equal(proud(plain, g.mainPanel!, 'glass', 0.4, 1.1), 0);
});

for (const [name, dressings] of [
  ['banded arches with jambs, keystones and eared surrounds', {voussoirs: {storeys: [0], jambs: true}, heads: {kind: 'keystone', storeys: [1, 2]}, surrounds: {storeys: [1], eared: true}}],
  ['quoins and double sill bands', {quoins: {ends: true}, bands: {at: ['sill'], storeys: [2, 3], double: true}}],
] as const) {
  test(`Hirschpassage Leidsestraat group: ${name} compile closed, inside the gates and the budget`, async () => {
    const base = raw(HIRSCH), w1 = {...base.walls[1], arches: {...base.walls[1].arches, band: 'none'}, dressings};
    delete w1.stringCourses;
    const intent = validateLargeIntent({...base, walls: [base.walls[0], w1, base.walls[2]]});
    const built = compileBuilding(intent, facts(HIRSCH)) as CompiledLargeBuilding;
    assert.ok((built.components.dressings ?? 0) > 0, JSON.stringify(built.components));
    const {tris, failing} = await gatesOf(HIRSCH, intent, built);
    assert.ok(tris <= LARGE_BUDGET_TRIANGLES, `${tris}`);
    assert.deepEqual(failing, []);
  });
}

test('every dressing stands at least 4.5 cm proud (clear of the z-fight band)', () => {
  assert.ok(DRESSING_MIN_OUT >= 0.045, `${DRESSING_MIN_OUT}`);
  assert.ok(DRESS.keystone.out > DRESS.lintel.out && DRESS.surround.earOut > DRESS.surround.out, 'overlapping parts never share a front plane');
});

/** A 10 m x 12 m mask (0.1 m cells) with windows on a 3 m storey grid and optional light rows. */
function mask(light: (v: number) => boolean, opts: {frames?: boolean} = {}) {
  const cell = 0.1, cols = 100, rows = 120, box = {u0: 0, u1: 10, v0: 0, v1: 12}, m = new Uint8Array(cols * rows);
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const v = box.v1 - (r + 0.5) * cell, u = (c + 0.5) * cell, inStorey = v % 3, win = u % 2.5 > 0.7 && u % 2.5 < 1.8 && inStorey > 0.9 && inStorey < 2.5;
    m[r * cols + c] = win ? (opts.frames && (inStorey < 1.0 || inStorey > 2.4) ? MASK.frame : MASK.dark) : light(v) ? MASK.trim : MASK.wall;
  }
  return {mask: m, cols, rows, cell, box};
}
const LINES = [0, 3, 6, 9, 12];

test('lightBands: clear white bands at the storey lines and under the sills are found and placed; a plain wall gives none', () => {
  assert.deepEqual(lightBands(mask(() => false), LINES), []);
  const floorBands = lightBands(mask(v => [3, 6, 9].some(l => Math.abs(v - l) < 0.1)), LINES);
  assert.deepEqual(floorBands.map(b => [b.at, b.storey]), [['floor', 1], ['floor', 2], ['floor', 3]]);
  assert.deepEqual(proposeBands(floorBands), {at: ['floor'], storeys: [1, 2, 3]});
  // a sill band at 0.7 m into each storey
  const sills = lightBands(mask(v => [3.7, 6.7, 9.7].some(l => Math.abs(v - l) < 0.1)), LINES);
  assert.deepEqual(proposeBands(sills), {at: ['sill'], storeys: [1, 2, 3]});
});

test('lightBands: a light wall, a thick stone storey, one lone band or white window frames propose nothing', () => {
  assert.equal(proposeBands(lightBands(mask(() => true), LINES)), null, 'all light: no contrast');
  assert.equal(proposeBands(lightBands(mask(v => v > 6 && v < 8), LINES)), null, 'a 2 m stone zone is not a band');
  assert.equal(proposeBands(lightBands(mask(v => Math.abs(v - 6) < 0.1), LINES)), null, 'one band in one storey');
  assert.equal(proposeBands(lightBands(mask(() => false, {frames: true}), LINES)), null, 'frames are not wall');
  assert.equal(proposeBands(lightBands(mask(v => Math.abs(v - 1.5) < 0.1 || Math.abs(v - 2.5) < 0.1), LINES)), null, 'bands in the ground band are signage, not counted');
  assert.deepEqual(placeBand(4.6, LINES), {storey: 1, at: 'mid'});
  assert.deepEqual(placeBand(8.6, LINES), {storey: 2, at: 'head'});
});

test('lightBands with the photo: white stone the clustering left unusable still reads as a band by its lightness', () => {
  const ppm = 10, width = 100, height = 120, rgb = new Uint8Array(width * height * 3);
  const band = (v: number) => [3, 6, 9].some(l => Math.abs(v - l) < 0.1);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const v = 12 - (y + 0.5) / ppm, c = band(v) ? [222, 216, 200] : [62, 42, 30];
    rgb.set(c, (y * width + x) * 3);
  }
  // the mask: wall and windows only, the bands marked unusable (an overcast crop's white stone)
  const m = mask(() => false), unusable = mask(band);
  for (let k = 0; k < m.mask.length; k++) if (unusable.mask[k] === MASK.trim) m.mask[k] = MASK.unusable;
  assert.deepEqual(lightBands(m, LINES), [], 'the mask alone sees no trim');
  const found = lightBands(m, LINES, {image: {width, height, rgb, ppm, topM: 12}, wall: [62, 42, 30]});
  assert.deepEqual(proposeBands(found), {at: ['floor'], storeys: [1, 2, 3]});
});
