import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {measureFloorBands} from './floorBands.ts';
import {MASK} from './measureFacade.ts';
import {floorBandSpans, FLOOR_BAND_LIMITS, storeyUnit} from '../blockBuilding/components.ts';
import {validateLargeIntent} from './largeIntent.ts';
import {fitLarge} from './fitLarge.ts';
import {compileBuilding} from './compile.ts';
import {evaluateLargeGates} from './largeGates.ts';
import {canalhouseGroupToGlb} from '../../../scripts/canalhouse-recipes/export-glb.ts';
import {decodeTriangles} from '../../../scripts/building-recipes/compile.ts';
import type {BuildingFacts} from './facts.ts';

const HOUSES = 'scripts/building-recipes/houses';
const raw = (id: string) => JSON.parse(fs.readFileSync(`${HOUSES}/${id}/intent.json`, 'utf8'));
const facts = (id: string): BuildingFacts => JSON.parse(fs.readFileSync(`${HOUSES}/${id}/facts.json`, 'utf8'));

/** A 20 m front, 0.1 m cells, v 0..top; `wallAt(v)` says which rows are wall (the rest glass). */
function maskOf(top: number, wallAt: (v: number) => boolean) {
  const cell = 0.1, cols = 200, rows = Math.round(top / cell), mask = new Uint8Array(cols * rows);
  for (let r = 0; r < rows; r++) { const v = top - (r + 0.5) * cell; mask.fill(wallAt(v) ? MASK.wall : MASK.dark, r * cols, (r + 1) * cols); }
  return {mask, cols, rows, cell, box: {u0: 0, u1: 20, v0: 0, v1: top}};
}

test('measureFloorBands: 1 m bands 0.3 m over every storey line of a glass front, as fractions of the storey', () => {
  const lines = [0, 4, 7.5, 11, 14.5, 15];
  const m = maskOf(15, v => [4, 7.5, 11].some(L => v > L - 0.2 && v < L + 0.8));
  const r = measureFloorBands(m, lines);
  assert.deepEqual(r.lines.map(x => x.band), [[3.8, 4.8], [7.3, 8.3], [10.8, 11.8]]);
  assert.ok(r.proposal, JSON.stringify(r.lines));
  assert.equal(storeyUnit(lines, 15), 3.5);
  assert.deepEqual(r.proposal, {share: 0.29, lift: 0.09, heightM: 1, liftM: 0.3});
});

test('measureFloorBands: a wall front, a front without bands and bands at too few lines propose nothing', () => {
  const lines = [0, 4, 7.5, 11, 14.5, 15];
  assert.equal(measureFloorBands(maskOf(15, () => true), lines).proposal, null, 'solid wall: runs longer than a band');
  assert.equal(measureFloorBands(maskOf(15, () => false), lines).proposal, null, 'all glass');
  assert.equal(measureFloorBands(maskOf(15, v => v > 3.8 && v < 4.8), lines).proposal, null, 'one band of three lines: under the quorum');
  // a punched front: the storey over the band is mostly wall
  const punched = maskOf(15, v => { const s = ((v - 4) % 3.5 + 3.5) % 3.5; return s < 1.2 || s > 2.6; });
  assert.equal(measureFloorBands(punched, lines).proposal, null);
});

test('measureFloorBands: a low wing whose only band is under its roof edge proposes the roof band (Apollo walls[5])', () => {
  const r = measureFloorBands(maskOf(6.4, v => v > 5.2 && v < 5.6), [0, 5.77, 11.02], 5.9);
  assert.deepEqual(r.lines, []);
  assert.ok(r.proposal?.roof && r.proposal.lift === 0 && Math.abs(r.proposal.heightM - 0.4) < 0.01, JSON.stringify(r));
});

test('floorBandSpans: centred lift over each upper floor line, clipped to the grid, the roof band under the top rail', () => {
  const cells = [1, 2, 3].map(floor => ({floor, v0: [0, 4, 7.5, 11][floor], v1: [4, 7.5, 11, 14.5][floor], u0: 0, u1: 2, bay: 0})) as Parameters<typeof floorBandSpans>[0];
  const levels = [0, 4, 7.5, 11, 14.5];
  const s = floorBandSpans(cells, levels, {share: 2 / 7, lift: 0.3 / 3.5}, 14.5).map(([a, b]) => [+a.toFixed(3), +b.toFixed(3)]);
  assert.deepEqual(s, [[4, 4.8], [7.3, 8.3], [10.8, 11.8]], 'the first band clipped to the grid foot (no cells under 4 m)');
  const roof = floorBandSpans(cells, levels, {share: 0.2, roof: true}, 14.5);
  assert.equal(roof.length, 4);
  assert.ok(Math.abs(roof[3][0] - 13.8) < 1e-9 && roof[3][1] < 14.5, JSON.stringify(roof[3]));
  assert.deepEqual(floorBandSpans([], levels, {share: 0.2}, 14.5), []);
});

test('floorBands: validated, fitted to the spandrel slot, compiled within the gates; absent leaves the recipe untouched (Rietveld building)', async () => {
  const id = 'rietveld-gebouw-077325', base = raw(id), {spandrels: _s, ...w0} = base.walls[0];
  const withBands = (fb: unknown, patch: object = {}) => ({...base, walls: [{...w0, floorBands: fb, ...patch}, ...base.walls.slice(1)]});
  const bad = (fb: unknown, re: RegExp, patch: object = {}) => assert.throws(() => validateLargeIntent(withBands(fb, patch)), re);
  bad({share: 0.9}, /share/);
  bad({share: 0.2, lift: 0.6}, /lift/);
  bad({share: 0.2, heightM: 1}, /metric field|unknown field/);
  bad({share: 0.2, roof: 'yes'}, /roof/);
  bad({share: 0.2}, /not with spandrels/, {spandrels: {sill: 0.25}});
  bad({share: 0.2}, /layered curtain-wall/, {system: 'brick-bay-grid', ground: 'system'});
  assert.throws(() => validateLargeIntent({...withBands({share: 0.2}), layeredKit: false}), /floorBands/);
  assert.ok(FLOOR_BAND_LIMITS.maxShare <= 0.6);
  const intent = validateLargeIntent(withBands({share: 0.25, lift: 0.08, roof: true, colour: '#5e6461'})), f = facts(id);
  const {recipe} = fitLarge(intent, f), g0 = recipe.groups[0];
  assert.deepEqual(g0.floorBands, {share: 0.25, lift: 0.08, roof: true, slot: 'spandrel@g0'});
  assert.equal(g0.spandrels, undefined);
  assert.equal(recipe.spec.palette['spandrel@g0'], '#5e6461');
  const built = compileBuilding(intent, f);
  const glb = await canalhouseGroupToGlb(intent.id, built.group, {metreUvs: true, slotFor: m => m.userData.materialSlot as string, maxBytes: 2_000_000});
  const tris = await decodeTriangles(glb.bytes);
  assert.deepEqual(evaluateLargeGates(tris, built).gates.filter(g => !g.pass).map(g => g.id), [], 'no coplanar overlap, within budget');
  assert.ok((built.components as {floorBands?: number}).floorBands! > 5, JSON.stringify(built.components));
  // absent: no band slot and no band count
  const plain = validateLargeIntent({...base, walls: [w0, ...base.walls.slice(1)]});
  const pr = fitLarge(plain, f).recipe;
  assert.equal(pr.groups[0].floorBands, undefined);
  assert.equal((compileBuilding(plain, f).components as {floorBands?: number}).floorBands, undefined);
});
