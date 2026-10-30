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
import {bandFrontProposal, GLAZED_STOREY_MIN, photoRowBands, RIBBON_FRONT, type RowBands} from './bandFronts.ts';
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
