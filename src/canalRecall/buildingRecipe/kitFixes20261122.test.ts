/**
 * Kit fixes from the 2026-11-21 kit batches (lane kit-fixes-20261122): the spike threshold under `shellRepair`, per-house
 * bay cycles in a row split (a wide bay window in `houses[]` drew nothing), and garage doors on a low or narrow ground.
 * Recipes without these cases stay byte-identical: `large-mesh-hashes.ts` over the installed recipes.
 */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {clampSpikes, SPIKE_M} from './shellRepair.ts';
import {houseCountsOwnBays} from './houseComponents.ts';
import {validateLargeIntent} from './largeIntent.ts';
import {compileLargeBuilding, garageRuns} from './largeCompile.ts';
import {fitLarge} from './fitLarge.ts';
import {GARAGE_FIT} from '../blockBuilding/components.ts';
import type {Cell} from '../blockBuilding/compose.ts';
import type {V3} from '../blockBuilding/mesh.ts';
import type {LargeBuildingIntent} from './intent.ts';

const HOUSES = 'scripts/building-recipes/houses';
const load = (id: string) => ({intent: JSON.parse(fs.readFileSync(`${HOUSES}/${id}/intent.json`, 'utf8')) as LargeBuildingIntent, facts: JSON.parse(fs.readFileSync(`${HOUSES}/${id}/facts.json`, 'utf8'))});
const slotTris = (intent: LargeBuildingIntent, facts: unknown) => {
  const b = compileLargeBuilding(validateLargeIntent(intent), facts as never, {budget: 1e9}), out: Record<string, number> = {};
  for (const m of b.group.children as unknown as {name: string; geometry: {getAttribute(n: string): {count: number}}}[]) out[m.name] = (out[m.name] ?? 0) + m.geometry.getAttribute('position').count / 3;
  return {out, components: b.components};
};

test('clampSpikes: a 0.23 m parapet spike (Gustav Mahlerlaan 7-27) drops onto its roof edge; 0.15 m stays', () => {
  assert.equal(SPIKE_M, 0.2);
  const W = 10, H = 9, roofs = [[[[0, H, 0], [W, H, 0], [W, H, 6], [0, H, 6]] as V3[]]];
  const wall = (dy: number): V3[][][] => [[[[0, 0, 0], [W, 0, 0], [W, H + dy, 0], [0, H, 0]]]];
  const c = clampSpikes(wall(0.23), roofs);
  assert.equal(c.clamped, 1);
  assert.equal(c.walls[0][0][2][1], H);
  assert.equal(clampSpikes(wall(0.15), roofs).clamped, 0);
});

test('houseCountsOwnBays: only houses with bay-indexed fields of their own', () => {
  assert.equal(houseCountsOwnBays({w: 1}), false);
  assert.equal(houseCountsOwnBays({w: 1, brick: '#884433', windows: 'cross', blankStoreys: [2]}), false);
  assert.equal(houseCountsOwnBays({w: 1, bayWindows: [{storeys: [1], pattern: [{w: 0.5}]}]}), true);
  assert.equal(houseCountsOwnBays({w: 1, residential: {pattern: ['door', 'window']}}), true);
  assert.equal(houseCountsOwnBays({w: 1, loggias: {storeys: [2], bays: [0]}}), true);
  assert.equal(houseCountsOwnBays({w: 1, loggias: {storeys: [2]}}), false);
  assert.equal(houseCountsOwnBays({w: 1, balconies: {storeys: [2], bays: [1]}}), true);
});

test('row split: a house after a 1-bay house reads its bay windows from its own first bay; a w > 1 window draws', () => {
  // Bos en Lommerplein 2 walls[0]: house 0 is one bay, house 1 four; the batch's w 1.55 window over house 1's first two
  // bays fell on its last bay (bayOffset 1), past the panel end, and was skipped.
  const {intent, facts} = load('bos-en-lommerplein-2-097332');
  const wide = structuredClone(intent), none = structuredClone(intent);
  const pat = (first: {w: number; at?: number; h?: number; sill?: number}) => [first, {w: 0}, {w: 0.75, h: 0.86, sill: 0.02}, {w: 0.4, h: 0.86, sill: 0.02}];
  wide.walls[0].houses![1].bayWindows![0].pattern = pat({w: 1.55, at: 0.5, h: 0.86, sill: 0.02});
  none.walls[0].houses![1].bayWindows![0].pattern = pat({w: 0});
  const a = slotTris(wide, facts).out, b = slotTris(none, facts).out;
  assert.ok(a['glass/glass'] > b['glass/glass'], `the wide window draws glass: ${a['glass/glass']} vs ${b['glass/glass']}`);
  const segs = fitLarge(validateLargeIntent(wide), facts).recipe.groups[0].houses!.segs;
  assert.deepEqual(segs.map(s => [s.bayOffset, s.localBays ?? false]), [[0, true], [1, true]]);
});

test('row split: houses without bay-indexed fields keep the row-wide count (no localBays)', () => {
  const {intent, facts} = load('bos-en-lommerplein-2-097332');
  const plain = structuredClone(intent);
  for (const h of plain.walls[0].houses!) delete h.bayWindows;
  const segs = fitLarge(validateLargeIntent(plain), facts).recipe.groups[0].houses!.segs;
  assert.ok(segs.every(s => s.localBays === undefined));
});

test('garageRuns: adjacent bays in one run, gaps split', () => {
  const cell = (bay: number, u0: number, u1: number): Cell => ({u0, u1, v0: 0, v1: 2.4, bay, floor: 0, bays: 9});
  const runs = garageRuns([cell(4, 10, 12), cell(1, 2.6, 5.2), cell(0, 0, 2.6), cell(5, 12, 14)]);
  assert.deepEqual(runs.map(r => r.map(c => c.bay)), [[0, 1], [4, 5]]);
  assert.deepEqual(garageRuns([]), []);
});

test('garage doors on a low ground with narrow bays (Jesse Owenshof INRIT / UITRIT): one door per pair, in palette.garage', () => {
  const {intent, facts} = load('jesse-owenshof-1-131508');
  const built = slotTris(intent, facts);
  assert.equal(built.components.garageDoors, 2);
  assert.ok((built.out['door/door@garage0'] ?? 0) > 0, `garage slot drawn: ${Object.keys(built.out).filter(k => k.includes('door')).join(', ')}`);
  // without the fallback size (cells 2.6 x 2.4 m) nothing would fit: the plain door needs 2.8 x 2.6 m
  const fit = fitLarge(validateLargeIntent(intent), facts);
  assert.ok(fit.recipe.groups[0].pitchM < 2.8 && fit.recipe.groups[0].pitchM - GARAGE_FIT.sideM >= GARAGE_FIT.minM / 2);
  // a colour with no garage doors is refused
  const bad = structuredClone(intent);
  delete bad.walls[0].garageBays;
  assert.throws(() => validateLargeIntent(bad), /palette\.garage/);
});
