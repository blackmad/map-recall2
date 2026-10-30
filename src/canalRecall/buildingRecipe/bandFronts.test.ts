/**
 * Band fronts (GitHub #126): measure.ts proposals from the photo's own rows (bandFronts.ts) and the balcony-band kit
 * component (blockBuilding/balconyBands.ts). Mask fixtures (`likeness-band-<pand>-walls<n>-photo-mask.png`, MASK values
 * as grey on 10 cm cells, the padded photo box as measured; `-wall-like-mask.png` 1 where the cell's colour cluster is
 * wall) come from the archived panorama crops named in each fixture's json (Gemeente Amsterdam, CC BY 4.0):
 *   p145366 walls[4]: a Bos en Lommer gallery flat, ribbon glazing behind continuous balcony bands on every storey;
 *   p242968 walls[0]: Dulcie Septemberpad, a glazed first-floor ribbon over punched upper storeys;
 *   p247342 walls[1]: Mary van der Sluisstraat, staggered balcony slabs whose shadow lines read as ribbons over thin glazing.
 */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import sharp from 'sharp';
import type {FacadeBox} from './measureFacade.ts';
import {rowOpenings} from './rowOpenings.ts';
import {BALCONY_SPANS, balconySpansProposal, bandFrontProposal, GLAZED_STOREY_MIN, photoRowBands, RIBBON_FRONT, type RowBands} from './bandFronts.ts';
import {LIGHT_RUN, lightRuns} from './lightBands.ts';
import type {LightBand} from './lightBands.ts';
import {validateLargeIntent} from './largeIntent.ts';
import {compileBuilding} from './compile.ts';
import type {BuildingFacts} from './facts.ts';
import {BALCONY_BAND, balconyBandRuns, balconyBandsProblems, fitBalconyBands} from '../blockBuilding/balconyBands.ts';
import {meshHashOf} from '../../../scripts/building-recipes/mesh-hash.ts';

const fixture = (f: string) => new URL(`./fixtures/${f}`, import.meta.url);
async function bandFixture(name: string) {
  const meta = JSON.parse(fs.readFileSync(fixture(`likeness-${name}-photo-mask.json`), 'utf8')) as {cell: number; box: FacadeBox; lines: number[]; storeyGlazing: (number | null)[]; usable: number; foliage: number; washedOut: number};
  const read = async (f: string) => { const {data, info} = await sharp(fs.readFileSync(fixture(f))).extractChannel(0).raw().toBuffer({resolveWithObject: true}); return {data: new Uint8Array(data), info}; };
  const m = await read(`likeness-${name}-photo-mask.png`), wl = await read(`likeness-${name}-wall-like-mask.png`);
  const summary = rowOpenings({mask: m.data, cols: m.info.width, rows: m.info.height, cell: meta.cell, box: meta.box, lines: meta.lines, wallLike: wl.data});
  return {meta, rowBands: photoRowBands(summary), storeys: meta.lines.length - 1};
}
const base = (b: Awaited<ReturnType<typeof bandFixture>>, system = 'brick-bay-grid') =>
  ({rowBands: b.rowBands, system, storeys: b.storeys, usable: b.meta.usable, foliage: b.meta.foliage, washedOut: b.meta.washedOut, storeyGlazing: b.meta.storeyGlazing});

test('ribbon front (p145366 walls[4]): ribbons on every judged upper storey propose ribbon-windows; only on a grid system', async () => {
  const b = await bandFixture('band-p145366-walls4');
  assert.ok(b.rowBands.judged.length >= RIBBON_FRONT.minStoreys, `judged ${b.rowBands.judged}`);
  assert.ok(b.rowBands.ribbons.length >= RIBBON_FRONT.share * b.rowBands.judged.length, JSON.stringify(b.rowBands));
  const p = bandFrontProposal(base(b));
  assert.equal(p.kind, 'ribbon-front'); assert.equal(p.system, 'ribbon-windows'); assert.equal(p.glazedStoreys, undefined);
  assert.equal(p.balconyBands, undefined, 'no light slab edges measured: no balcony bands proposed');
  assert.equal(bandFrontProposal(base(b, 'curtain-wall')).kind, null, 'a curtain wall is not re-systemed');
  assert.equal(bandFrontProposal({...base(b), foliage: 0.4}).kind, null, 'foliage over the judge limit: no proposal');
});

test('balcony bands: a ribbon front with light bands on two or more floor lines proposes a solid slab in the trim colour', async () => {
  const b = await bandFixture('band-p145366-walls4');
  const lb = (storey: number, at: LightBand['at']): LightBand => ({v0: 0, v1: 0.3, share: 0.8, storey, at});
  const p = bandFrontProposal({...base(b), lightBands: [lb(1, 'floor'), lb(2, 'floor'), lb(1, 'head')], trim: '#d6d5d0'});
  assert.deepEqual(p.balconyBands, {storeys: [1, 2], kind: 'solid', colour: '#d6d5d0'});
  assert.equal(bandFrontProposal({...base(b), lightBands: [lb(1, 'floor'), lb(2, 'sill')]}).balconyBands, undefined, 'one floor line is not a band');
});

test('ribbon storey over punched rows (p242968 walls[0]): glazedStoreys on the glazed ribbon storey', async () => {
  const b = await bandFixture('band-p242968-walls0');
  const p = bandFrontProposal(base(b));
  assert.equal(p.kind, 'ribbon-storeys', JSON.stringify(p));
  assert.deepEqual(p.glazedStoreys, [1]);
  assert.ok((b.meta.storeyGlazing[1] ?? 0) >= GLAZED_STOREY_MIN);
  assert.equal(bandFrontProposal({...base(b), taken: [1]}).kind, null, 'a storey another field claims is left alone');
});

test('thin ribbons (p247342 walls[1], slab shadow lines over punched windows): no glazed storey proposed', async () => {
  const b = await bandFixture('band-p247342-walls1');
  assert.ok(b.rowBands.ribbons.some(r => r.against !== null), JSON.stringify(b.rowBands));
  const p = bandFrontProposal(base(b));
  assert.equal(p.kind, null, JSON.stringify(p));
  assert.ok(p.why.some(w => /glazed under 50 %/.test(w)), p.why.join('; '));
});

test('photoRowBands: no ribbon, no proposal', () => {
  const rb: RowBands = {judged: [1, 2, 3], ribbons: []};
  assert.equal(bandFrontProposal({rowBands: rb, system: 'brick-bay-grid', storeys: 4, usable: 0.9, foliage: 0, washedOut: 0}).kind, null);
  assert.equal(bandFrontProposal({rowBands: null, system: 'brick-bay-grid', storeys: 4, usable: 0.9, foliage: 0, washedOut: 0}).kind, null);
});

test('balconyBands schema: storeys 1..storeys-1, fractions in range, a kind, hex colours, no unknown fields', () => {
  assert.deepEqual(balconyBandsProblems({storeys: [1, 2, 3], deep: 0.4, rail: 0.33, kind: 'glass', colour: '#d6d5d0', railColour: '#202020'}, 'bb', 5), []);
  assert.ok(balconyBandsProblems({storeys: [0]}, 'bb', 5).some(p => /storeys/.test(p)), 'no slab on the ground');
  assert.ok(balconyBandsProblems({storeys: [5]}, 'bb', 5).some(p => /storeys/.test(p)), 'no slab past the top storey');
  assert.ok(balconyBandsProblems({storeys: [1, 1]}, 'bb', 5).some(p => /twice/.test(p)));
  assert.ok(balconyBandsProblems({storeys: [1], deep: 0.9}, 'bb', 5).some(p => /deep/.test(p)));
  assert.ok(balconyBandsProblems({storeys: [1], kind: 'rods'}, 'bb', 5).some(p => /kind/.test(p)));
  assert.ok(balconyBandsProblems({storeys: [1], depthM: 1}, 'bb', 5).some(p => /unknown field/.test(p)));
  assert.ok(balconyBandsProblems({storeys: [1], colour: 'white'}, 'bb', 5).some(p => /colour/.test(p)));
});

test('balconyBands runs: one run per storey across the panel, broken where the outline does not fit, none above the top', () => {
  const f = fitBalconyBands({storeys: [3, 1, 2]}, {slab: 'stone', rail: 'frame', glass: 'glass'});
  assert.deepEqual(f.storeys, [1, 2, 3]); assert.equal(f.kind, 'solid'); assert.equal(f.deep, BALCONY_BAND.deep);
  const levels = [0, 4, 7, 10, 13];
  const all = balconyBandRuns({uMin: 0, uMax: 20}, levels, f, 12.5, () => true);
  assert.deepEqual(all.map(r => [r.storey, r.u0, r.u1]), [[1, 0, 20], [2, 0, 20], [3, 0, 20]]);
  assert.ok(Math.abs(all[0].d - 0.4 * 3) < 1e-9 && Math.abs(all[0].top - (4 + 0.33 * 3)) < 1e-9);
  const stepped = balconyBandRuns({uMin: 0, uMax: 20}, levels, f, 12.5, (u0, u1, v0) => v0 < 8 || u1 <= 10);
  assert.deepEqual(stepped.filter(r => r.storey === 3).map(r => [r.u0, r.u1]), [[0, 10]], 'storey 3 only over the left half');
  assert.deepEqual(balconyBandRuns({uMin: 0, uMax: 20}, levels, f, 10.5, () => true).map(r => r.storey), [1, 2], 'storey 3 parapet above the top');
});

test('balconyBands compile: drawn when present, absent compiles without it (byte-identical path)', () => {
  const HOUSES = 'scripts/building-recipes/houses', id = 'haarlemmerweg-778';
  const raw = () => JSON.parse(fs.readFileSync(`${HOUSES}/${id}/intent.json`, 'utf8')), f: BuildingFacts = JSON.parse(fs.readFileSync(`${HOUSES}/${id}/facts.json`, 'utf8'));
  const plain = compileBuilding(validateLargeIntent(raw()), f);
  assert.equal(plain.components.balconyBands, undefined);
  const banded = raw(), gi = banded.walls.findIndex((w: any) => ['brick-bay-grid', 'ribbon-windows'].includes(w.system) && !w.balconies);
  assert.ok(gi >= 0);
  banded.walls[gi].balconyBands = {storeys: [1, 2], kind: 'solid', colour: '#d6d5d0'};
  const b = compileBuilding(validateLargeIntent(banded), f);
  assert.ok((b.components.balconyBands ?? 0) >= 2, `runs ${b.components.balconyBands}`);
  assert.notEqual(meshHashOf(b.group), meshHashOf(plain.group));
});

// ---- part-width balcony bands (GitHub #127) ------------------------------------------------------------------------
test('balconyBands.spans schema: bay ranges per storey, in the bay grid, no overlap, a storey in storeys or spans', () => {
  const ok = {storeys: [], spans: [{storey: 1, bays: [[0, 1], [3, 5]]}, {storey: 2, bays: [[7, 9]]}], kind: 'glass'};
  assert.deepEqual(balconyBandsProblems(ok, 'b', 5, 17), []);
  assert.deepEqual(balconyBandsProblems({storeys: [3], spans: ok.spans}, 'b', 5, 17), [], 'full-width storeys beside spans');
  assert.match(balconyBandsProblems({storeys: [], spans: [{storey: 1, bays: [[0, 17]]}]}, 'b', 5, 17).join(), /bay ranges/);
  assert.match(balconyBandsProblems({storeys: [], spans: [{storey: 1, bays: [[0, 3], [2, 5]]}]}, 'b', 5, 17).join(), /overlap/);
  assert.match(balconyBandsProblems({storeys: [1], spans: [{storey: 1, bays: [[0, 1]]}]}, 'b', 5, 17).join(), /also a full-width band/);
  assert.match(balconyBandsProblems({storeys: [], spans: [{storey: 1, bays: [[0, 1]]}, {storey: 1, bays: [[4, 5]]}]}, 'b', 5, 17).join(), /two span rows/);
  assert.match(balconyBandsProblems({storeys: []}, 'b', 5, 17).join(), /storeys: list/, 'empty storeys need spans');
  assert.match(balconyBandsProblems({storeys: [], spans: [{storey: 5, bays: [[0, 1]]}]}, 'b', 5, 17).join(), /storeys 1\.\.4/);
});

test('balconyBands.spans runs: one slab per bay range on the main panel only; none without the bay count', () => {
  const levels = [0, 3.5, 7, 10.5, 14], f = fitBalconyBands({storeys: [], spans: [{storey: 2, bays: [[7, 9]]}, {storey: 1, bays: [[3, 5], [0, 1]]}]}, {slab: 's', rail: 'r', glass: 'g'});
  const runs = balconyBandRuns({uMin: 0, uMax: 17}, levels, f, 15, () => true, 17);
  assert.deepEqual(runs.map(r => [r.storey, r.u0, r.u1]), [[1, 0, 2], [1, 3, 6], [2, 7, 10]]);
  assert.deepEqual(balconyBandRuns({uMin: 0, uMax: 17}, levels, f, 15, () => true), [], 'another panel of the group draws no spans');
  // a run shorter than BALCONY_BAND.minRunM is not drawn (one 1 m bay)
  assert.deepEqual(balconyBandRuns({uMin: 0, uMax: 17}, levels, fitBalconyBands({storeys: [], spans: [{storey: 1, bays: [[0, 0]]}]}, {slab: 's', rail: 'r', glass: 'g'}), 15, () => true, 17), []);
});

test('balconyBands.spans compile: spans draw on the main panel; the same intent without spans is the plain band mesh', () => {
  const HOUSES = 'scripts/building-recipes/houses', id = 'haarlemmerweg-778';
  const raw = () => JSON.parse(fs.readFileSync(`${HOUSES}/${id}/intent.json`, 'utf8')), f: BuildingFacts = JSON.parse(fs.readFileSync(`${HOUSES}/${id}/facts.json`, 'utf8'));
  const banded = raw(), gi = banded.walls.findIndex((w: any) => ['brick-bay-grid', 'ribbon-windows'].includes(w.system) && !w.balconies);
  banded.walls[gi].balconyBands = {storeys: [1], kind: 'glass'};
  const plain = compileBuilding(validateLargeIntent(banded), f);
  const spanned = raw(), bays = compileBuilding(validateLargeIntent(raw()), f).recipe.groups[gi].bays;
  assert.ok(bays >= 4, `bays ${bays}`);
  spanned.walls[gi].balconyBands = {storeys: [1], spans: [{storey: 2, bays: [[0, 1], [bays - 2, bays - 1]]}], kind: 'glass'};
  const b = compileBuilding(validateLargeIntent(spanned), f);
  assert.ok((b.components.balconyBands ?? 0) > (plain.components.balconyBands ?? 0), `runs ${b.components.balconyBands} vs ${plain.components.balconyBands}`);
  assert.notEqual(meshHashOf(b.group), meshHashOf(plain.group));
});

test('lightRuns: part-width light parapets on the floor lines, gaps under LIGHT_RUN.gapM bridged, sky over the top line not read', () => {
  // a 20 m x 10 m wall at 20 px/m, dark wall, storey lines every 3 m; light slabs on storey 1 at 2..6 m (a 0.25 m post
  // gap at 4 m) and storey 2 at 10..14 m; a lone 1 m light frame on storey 2 at 17 m
  const ppm = 20, W = 20, H = 10, width = W * ppm, height = H * ppm, rgb = new Uint8Array(width * height * 3).fill(50), valid = new Uint8Array(width * height).fill(255), topM = H;
  const paint = (u0: number, u1: number, v0: number, v1: number) => { for (let y = Math.round((topM - v1) * ppm); y < Math.round((topM - v0) * ppm); y++) for (let x = Math.round(u0 * ppm); x < Math.round(u1 * ppm); x++) rgb.fill(220, (y * width + x) * 3, (y * width + x) * 3 + 3); };
  paint(2, 4, 3, 4); paint(4.25, 6, 3, 4); paint(10, 14, 6, 7); paint(17, 18, 6, 7);
  const runs = lightRuns({image: {width, height, rgb, valid, ppm, topM}, wall: [50, 50, 50]}, [0, 3, 6, 9, 9.5]);
  assert.deepEqual(runs, [{storey: 1, u0: 2, u1: 6}, {storey: 2, u0: 10, u1: 14}]);
  assert.ok(LIGHT_RUN.minRunM > 1, 'a lone light frame is not a run');
});

test('balconySpansProposal: bay ranges of the part-width storeys; full-width storeys, lone bays and thin evidence propose nothing', () => {
  const base = {bays: 17, storeys: 5, usable: 0.8, foliage: 0.05, washedOut: 0.1};
  const runs = [{storey: 1, from: 0.18, to: 0.35}, {storey: 1, from: 0.65, to: 0.77}, {storey: 2, from: 0.41, to: 0.53}, {storey: 3, from: 0.02, to: 0.98}];
  const p = balconySpansProposal({...base, runs});
  assert.deepEqual(p.balconyBands, {storeys: [], spans: [{storey: 1, bays: [[3, 5], [11, 12]]}, {storey: 2, bays: [[7, 8]]}], kind: 'glass'});
  assert.match(p.why.join(), /storey 3: light across 96 %/);
  assert.equal(balconySpansProposal({...base, runs: runs.filter(r => r.storey !== 2)}).balconyBands, null, `under ${BALCONY_SPANS.minStoreys} part-width storeys`);
  assert.equal(balconySpansProposal({...base, runs: [{storey: 1, from: 0.1, to: 0.13}, {storey: 2, from: 0.5, to: 0.53}]}).balconyBands, null, 'lone light bays');
  assert.equal(balconySpansProposal({...base, washedOut: 0.5, runs}).balconyBands, null, 'washed out');
  assert.equal(balconySpansProposal({...base, runs, taken: [1]}).balconyBands, null, 'storey 1 claimed by another field');
});
