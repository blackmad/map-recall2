/**
 * Loggias (recessed balconies cut deep into a punched grid) and the glazed plinth (a ground or first storey with its own
 * height and mullion pitch under the upper grid), factory batch 1 kit gaps (OBA IJburg, Reigersbos, Buitenveldert,
 * 2026-10-24): schema, fit (rows, depth, storey lines), compiled geometry (glass at the back of the loggia, closed rails,
 * gates), the byte-identical expansion without them, and the measurement rule that proposes a plinth.
 */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {validateLargeIntent} from './largeIntent.ts';
import {fitLarge, storeyLines} from './fitLarge.ts';
import {compileBuilding} from './compile.ts';
import {evaluateLargeGates, LARGE_BUDGET_TRIANGLES} from './largeGates.ts';
import type {BuildingFacts} from './facts.ts';
import {LOGGIA, largeSystem, type SystemFit} from '../blockBuilding/systems.ts';
import {glazedPlinth} from './measureWriteback.ts';
import {canalhouseGroupToGlb} from '../../../scripts/canalhouse-recipes/export-glb.ts';
import {decodeTriangles} from '../../../scripts/building-recipes/compile.ts';

const HOUSES = 'scripts/building-recipes/houses';
const raw = (id: string) => JSON.parse(fs.readFileSync(`${HOUSES}/${id}/intent.json`, 'utf8'));
const facts = (id: string): BuildingFacts => JSON.parse(fs.readFileSync(`${HOUSES}/${id}/facts.json`, 'utf8'));
const IJ = 'oba-ijburg-070481';
const slots = {frame: 'frame', stone: 'stone', glass: 'glass', door: 'door', curtain: 'frame'};

test('loggias / plinth schema: bounded fractions, no metric keys, no clashing storeys or ground systems', () => {
  const base = raw('politie-van-leijenberghlaan'), w0 = {...base.walls[0], baysPerStorey: 6};
  delete w0.entrance;
  const withWall = (w: object) => ({...base, walls: [{...w0, ...w}, ...base.walls.slice(1)]});
  assert.ok(validateLargeIntent(withWall({loggias: {storeys: [1, 2], bays: [1, 2], rail: 'bars', deep: 0.6}, plinth: {lights: 3, factor: 1.4}})));
  assert.throws(() => validateLargeIntent(withWall({loggias: {storeys: [1], depth: 1.5}})), /coordinate\/metric/);
  assert.throws(() => validateLargeIntent(withWall({loggias: {storeys: [1], deep: 1.5}})), /loggias\.deep/);
  assert.throws(() => validateLargeIntent(withWall({loggias: {storeys: [1], rail: 'rope'}})), /loggias\.rail/);
  assert.throws(() => validateLargeIntent(withWall({loggias: {storeys: [1]}, blankStoreys: [1]})), /also blank or glazed/);
  assert.throws(() => validateLargeIntent(withWall({plinth: {lights: 0}})), /plinth\.lights/);
  assert.throws(() => validateLargeIntent(withWall({plinth: {lights: 2, sill: 0.3, h: 0.9}})), /sill \+ h/);
  assert.throws(() => validateLargeIntent(withWall({plinth: {lights: 2, factor: 1.3}, groundFactor: 1.2})), /plinth\.factor/);
  assert.throws(() => validateLargeIntent(withWall({plinth: {lights: 2}, ground: 'glazed'})), /ground plinth/);
  assert.throws(() => validateLargeIntent(withWall({plinth: {lights: 2, storeys: [1]}, loggias: {storeys: [1]}})), /also a loggia/);
  assert.throws(() => validateLargeIntent(withWall({system: 'curtain-wall', plinth: {lights: 2}})), /wall with a face/);
});

test('weighted storey lines: a taller plinth storey, the unit shared by the rest; absent weights are the old lines', () => {
  const plain = storeyLines(18, true, 5, 3.2, 1.2, 18);
  assert.deepEqual(storeyLines(18, true, 5, 3.2, 1.2, 18, undefined, {}), plain);
  const w = storeyLines(18, true, 5, 3.2, 1.2, 18, undefined, {1: 1.65});
  assert.equal(w.storeys, 5);
  assert.ok(Math.abs(w.heights[1] / w.heights[2] - 1.65) < 0.01 && Math.abs(w.heights[0] / w.heights[2] - 1.2) < 0.01, JSON.stringify(w.heights));
  assert.ok(Math.abs(w.lines[5] - plain.lines[5]) < 0.01, 'same usable height');
});

test('largeSystem: loggia rows cut deep with a rail above the ground, plinth rows with their own lights; absent = unchanged', () => {
  const fit: SystemFit = {pitchM: 5, lines: [0, 3.6, 8.5, 11.5, 14.5, 18], ground: 'system', slots, bays: 4};
  const plain = largeSystem('brick-bay-grid', fit);
  assert.equal(JSON.stringify(plain).includes('loggia'), false);
  const s = largeSystem('brick-bay-grid', {...fit, plinth: {storeys: [1], lights: 3, sill: 0.08, h: 0.78, pier: 0.15, transom: 0},
    loggias: {storeys: [0, 2, 3], bays: [1, 2], w: 0.78, h: 0.78, sill: 0.02, deep: 0.5, rail: 'glass', lights: 2, railSlot: 'rail@g0'}});
  const p = s.rowOverrides!['1'].win!;
  assert.deepEqual([p.w, p.h, p.sill, p.mullAt], [0.85, 0.78, +(0.08 * 4.9).toFixed(3), [0.3333, 0.6667]]);
  const row2 = s.rowOverrides!['2'];
  assert.equal(row2.cycle!.length, 4);
  assert.deepEqual(row2.cycle![0], plain.typical, 'unlisted bays keep the storey row');
  assert.deepEqual(row2.cycle![1].win!.loggia, {depth: 1.5, rail: {kind: 'glass', h: LOGGIA.railM, slot: 'rail@g0'}});
  const g = s.ground.cycle![1].win!.loggia!;
  assert.equal(g.depth, 1.8);
  assert.equal(g.rail, undefined, 'no balustrade on the ground');
  // everything else of the expansion is the plain one
  assert.deepEqual({...s, ground: plain.ground, rowOverrides: undefined}, {...plain, rowOverrides: undefined});
});

test('IJburg compile: loggia glazing at the back of the recess, rails closed, plinth storey taller, gates pass in budget', async () => {
  const intent = validateLargeIntent(raw(IJ)), f = facts(IJ);
  const {recipe} = fitLarge(intent, f), g = recipe.groups[2];
  assert.ok(g.storeyHeightsM[1] > 1.5 * g.storeyHeightsM[2], JSON.stringify(g.storeyHeightsM));
  assert.equal(g.loggiaDepthM, +(Math.max(g.storeyHeightsM[0], g.storeyHeightsM[2], g.storeyHeightsM[3], g.storeyHeightsM[4]) * 0.5).toFixed(3));
  const built = compileBuilding(intent, f);
  const main = built.panels.find(p => p.index === g.mainPanel)!, depth = +((g.lines[3] - g.lines[2]) * 0.5).toFixed(3);
  let back = 0;
  for (const m of built.group.children as import('three').Mesh[]) {
    if (m.userData.materialSlot !== 'glass') continue;
    const a = m.geometry.getAttribute('position');
    for (let i = 0; i < a.count; i++) {
      const p = [a.getX(i) - main.o[0], a.getY(i) - main.o[1], a.getZ(i) - main.o[2]], d = p[0] * main.n[0] + p[1] * main.n[1] + p[2] * main.n[2];
      if (a.getY(i) > g.lines[2] && a.getY(i) < g.lines[3] && Math.abs(d + depth) < 0.05) back++;
    }
  }
  assert.ok(back >= 8 * 4, `loggia glass vertices ${depth} m behind the face: ${back}`);
  const glb = await canalhouseGroupToGlb(intent.id, built.group, {metreUvs: true, slotFor: m => m.userData.materialSlot as string, maxBytes: 2_000_000});
  const tris = await decodeTriangles(glb.bytes);
  assert.ok(tris.length <= LARGE_BUDGET_TRIANGLES, `${tris.length}`);
  const gates = evaluateLargeGates(tris, built).gates;
  assert.deepEqual(gates.filter(x => !x.pass).map(x => x.id), []);
});

test('glazedPlinth: a glazed ground far above the upper storeys on a clean crop; not one-storey fronts, dark paint or a lit upper grid', () => {
  const clean = {glass: '#303136', wall: '#757c82', usable: 0.8, foliage: 0, washedOut: 0.1};
  // OBA Buitenveldert walls[4] (w05-0): 100 % ground under a blank wall
  assert.deepEqual(glazedPlinth({...clean, ground: 1, storeyGlazing: [null, 0.002, 0.502, null]}).plinth, {lights: 2, sill: 0.04, h: 0.84});
  // OBA IJburg walls[2]: the ground is not the glazed storey
  assert.equal(glazedPlinth({...clean, ground: 0.486, storeyGlazing: [null, 0.182, 0.388, 0.594, 0.636, null]}).plinth, null);
  // one-storey front (Buitenveldert walls[3], Reigersbos walls[7]): nothing to stand out from
  assert.match(glazedPlinth({...clean, ground: 0.9, storeyGlazing: [null, null]}).why.join(), /no upper storey/);
  // dark paint reads as glazing: not glass
  assert.match(glazedPlinth({...clean, glass: '#2c2c2e', wall: '#28242a', ground: 0.9, storeyGlazing: [null, 0.1]}).why.join(), /does not read as glass/);
  assert.match(glazedPlinth({...clean, ground: 0.8, storeyGlazing: [null, 0.6]}).why.join(), /points over/);
  assert.match(glazedPlinth({...clean, foliage: 0.5, ground: 0.9, storeyGlazing: [null, 0.1]}).why.join(), /foliage/);
});
