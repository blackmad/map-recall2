/**
 * Kit additions from the Stadsloket Zuidoost likeness pass (2026-10-25): free-standing arcade piers on their own pitch
 * (blockBuilding/arcadePiers.ts) and windowPattern together with openBays (blind bays in a mixed-width rhythm).
 */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {validateLargeIntent} from './largeIntent.ts';
import {fitLarge} from './fitLarge.ts';
import {compileBuilding} from './compile.ts';
import {evaluateLargeGates} from './largeGates.ts';
import type {BuildingFacts} from './facts.ts';
import type {LargeBuildingIntent} from './intent.ts';
import {largeSystem, type SystemFit} from '../blockBuilding/systems.ts';
import {ARCADE_PIERS, fitArcadePiers, pierCentres} from '../blockBuilding/arcadePiers.ts';
import {canalhouseGroupToGlb} from '../../../scripts/canalhouse-recipes/export-glb.ts';
import {decodeTriangles} from '../../../scripts/building-recipes/compile.ts';
import {meshHashOf} from '../../../scripts/building-recipes/mesh-hash.ts';

const HOUSES = 'scripts/building-recipes/houses', ID = 'stadsloket-zuidoost';
const raw = (id: string) => JSON.parse(fs.readFileSync(`${HOUSES}/${id}/intent.json`, 'utf8'));
const facts = (id: string): BuildingFacts => JSON.parse(fs.readFileSync(`${HOUSES}/${id}/facts.json`, 'utf8'));
const slots = {frame: 'frame', stone: 'stone', glass: 'glass', door: 'door', curtain: 'frame'};

async function gatesOf(intent: LargeBuildingIntent, f: BuildingFacts) {
  const built = compileBuilding(intent, f);
  const glb = await canalhouseGroupToGlb(intent.id, built.group, {metreUvs: true, slotFor: m => m.userData.materialSlot as string, maxBytes: 2_000_000});
  const tris = await decodeTriangles(glb.bytes);
  return {built, tris, gates: evaluateLargeGates(tris, built).gates};
}

test('arcadePiers schema: fractions only, contiguous storeys, a bay span needs the bay count, not on a glass skin', () => {
  const base = raw(ID), w0 = {...base.walls[2]};
  const withWall = (w: object) => ({...base, walls: [base.walls[0], base.walls[1], {...w0, ...w}, base.walls[3]]});
  assert.ok(validateLargeIntent(withWall({arcadePiers: {storeys: [0, 1], count: 5, bays: [3, 11], w: 0.2, proud: 0.45, beam: 0.09}})));
  assert.throws(() => validateLargeIntent(withWall({arcadePiers: {storeys: [0, 1], count: 5, depth: 0.5}})), /coordinate\/metric/);
  assert.throws(() => validateLargeIntent(withWall({arcadePiers: {storeys: [0, 2], count: 5}})), /contiguous/);
  assert.throws(() => validateLargeIntent(withWall({arcadePiers: {storeys: [0], count: 1}})), /count/);
  assert.throws(() => validateLargeIntent(withWall({arcadePiers: {storeys: [0], count: 4, w: 0.9}})), /arcadePiers\.w/);
  assert.throws(() => validateLargeIntent(withWall({arcadePiers: {storeys: [0], count: 4, bays: [3, 12]}})), /last bay/);
  assert.throws(() => validateLargeIntent(withWall({arcadePiers: {storeys: [0], count: 4, bays: [3, 11]}, baysPerStorey: undefined})), /needs baysPerStorey/);
  assert.throws(() => validateLargeIntent(withWall({arcadePiers: {storeys: [7], count: 4}})), /under storeys/);
  assert.throws(() => validateLargeIntent(withWall({arcadePiers: {storeys: [0], count: 4}, system: 'curtain-wall', windowShape: undefined, windowPattern: undefined, plinth: undefined})), /wall with a face/);
});

test('pier centres: the outer piers flush with the span ends, evenly spaced; too narrow a span draws none', () => {
  assert.deepEqual(pierCentres(0, 10, 3, 1), [0.5, 5, 9.5]);
  assert.deepEqual(pierCentres(2, 4, 3, 1), []);
  assert.deepEqual(fitArcadePiers({storeys: [1, 2], count: 4}, 'stone@g0'), {from: 1, to: 2, count: 4, w: ARCADE_PIERS.w, proud: ARCADE_PIERS.proud, beam: ARCADE_PIERS.beam, slot: 'stone@g0'});
});

test('Stadsloket Zuidoost: arcade piers drawn in the stone on their own pitch, within the gates; absent = no piers', async () => {
  const intent = validateLargeIntent(raw(ID)), f = facts(ID);
  const {recipe} = fitLarge(intent, f);
  assert.deepEqual(recipe.groups.map(g => g.arcadePiers?.count ?? 0), [9, 4, 5, 0]);
  assert.equal(recipe.groups[0].arcadePiers!.slot, recipe.groups[0].slots.stone);
  const a = await gatesOf(intent, f);
  assert.equal(a.built.components.arcadePiers, 18);
  assert.deepEqual(a.gates.filter(g => !g.pass && !g.advisory).map(g => g.id), []);
  const stripped = raw(ID);
  for (const w of stripped.walls) delete w.arcadePiers;
  const b = await gatesOf(validateLargeIntent(stripped), f);
  assert.equal(b.built.components.arcadePiers, undefined);
  assert.notEqual(meshHashOf(a.built.group), meshHashOf(b.built.group));
  assert.ok(a.tris.length > b.tris.length);
});

test('windowPattern with openBays: blind bays stay blind, the windowed bays keep the per-bay widths; without openBays unchanged', () => {
  const fit: SystemFit = {pitchM: 2.4, lines: [0, 3.6, 7.2, 10.8, 14.4], ground: 'system', slots, bays: 6, windowPattern: [0.4, 0.4, 0.97]};
  const plain = largeSystem('brick-bay-grid', fit);
  assert.deepEqual(plain.typical.cycle!.map(r => r.win?.w), [0.4, 0.4, 0.97]);
  const s = largeSystem('brick-bay-grid', {...fit, openBays: [{storeys: [1, 2], bays: [0, 1, 2, 3, 5]}]});
  const row = s.rowOverrides!['1'];
  assert.equal(row.cycle!.length, 6);
  assert.deepEqual(row.cycle!.map(r => r.kind === 'punched' ? r.win!.w : null), [0.4, 0.4, 0.97, 0.4, null, 0.97]);
  assert.deepEqual(s.rowOverrides!['2'], row);
  assert.deepEqual(s.typical, plain.typical, 'storeys outside openBays keep the plain pattern');
  // a pattern whose length does not divide the bays: the cycle runs to the common multiple
  const odd = largeSystem('brick-bay-grid', {...fit, bays: 4, windowPattern: [0.8, 0.3, 0.5], openBays: [{storeys: [1], bays: [0, 1, 2]}]});
  assert.deepEqual(odd.rowOverrides!['1'].cycle!.map(r => r.kind === 'punched' ? r.win!.w : null), [0.8, 0.3, 0.5, null, 0.3, 0.5, 0.8, null, 0.5, 0.8, 0.3, null]);
});
