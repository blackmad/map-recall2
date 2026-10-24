/**
 * Large kit giant order, corbel tables, grouped windows and iron balconies (issue #35; review of pand-233585,
 * Hirschpassage 2 and Stadhouderskade 111): schema, byte-identical when absent, and the compiled parts (capitals and
 * bases in the dressing stone, deeper and stone-faced piers, a corbel table at a storey line, `count` windows per bay,
 * balcony rails in their own slot, balconies spanning the bay's window group) inside the gates and the budget.
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
import type {LargeBuildingIntent} from './intent.ts';
import {DRESS} from '../blockBuilding/dressings.ts';
import {largeSystem} from '../blockBuilding/systems.ts';
import {canalhouseGroupToGlb} from '../../../scripts/canalhouse-recipes/export-glb.ts';
import {decodeTriangles} from '../../../scripts/building-recipes/compile.ts';

const HOUSES = 'scripts/building-recipes/houses';
const raw = (id: string): LargeBuildingIntent => JSON.parse(fs.readFileSync(`${HOUSES}/${id}/intent.json`, 'utf8'));
const facts = (id: string): BuildingFacts => JSON.parse(fs.readFileSync(`${HOUSES}/${id}/facts.json`, 'utf8'));
const WAREHOUSE = 'pand-233585', HIRSCH = 'hirschpassage-2-165488', SCHOOL = 'stadhouderskade-111-137448';
const compile = (i: LargeBuildingIntent, id: string) => compileBuilding(validateLargeIntent(i), facts(id)) as unknown as CompiledLargeBuilding;

async function gatesOf(id: string, built: CompiledLargeBuilding) {
  const glb = await canalhouseGroupToGlb(id, built.group, {metreUvs: true, slotFor: m => m.userData.materialSlot as string, maxBytes: 2_000_000});
  const tris = await decodeTriangles(glb.bytes);
  return {tris: tris.length, failing: evaluateLargeGates(tris, built).gates.filter(x => !x.pass && !x.advisory).map(x => x.id)};
}
const triangles = (built: CompiledLargeBuilding, slot?: (s: string) => boolean) => (built.group.children as T.Mesh[])
  .filter(m => !slot || slot(String(m.userData.materialSlot ?? m.userData.kitSlot ?? '')))
  .reduce((n, m) => n + (m.geometry.index ? m.geometry.index.count : m.geometry.getAttribute('position').count) / 3, 0);
const strip = (i: LargeBuildingIntent, k: number, keys: string[]) => ({...i, walls: i.walls.map((w, j) => (j === k ? Object.fromEntries(Object.entries(w).filter(([x]) => !keys.includes(x))) : w))}) as LargeBuildingIntent;

test('schema: giant-order piers, corbels, window groups and balcony colour are counts and fractions only', () => {
  const base = raw(WAREHOUSE), w1 = base.walls[1];
  const withD = (d: unknown) => ({...base, walls: base.walls.map((w, k) => (k === 1 ? {...w1, dressings: d} : w))});
  assert.ok(validateLargeIntent(withD({piers: {w: 0.2, from: 1, to: 3, capital: true, base: true, flutes: 4, stone: true, ends: true, deep: 0.1}, corbels: {storey: 4, foot: true, count: 6, drop: 0.3, stone: true}})));
  assert.throws(() => validateLargeIntent(withD({piers: {flutes: 12}})), /piers\.flutes/);
  assert.throws(() => validateLargeIntent(withD({piers: {from: 2, to: 1}})), /piers\.to/);
  assert.throws(() => validateLargeIntent(withD({piers: {deep: 0.6}})), /piers\.deep/);
  assert.throws(() => validateLargeIntent(withD({piers: {capitalM: 0.5}})), /unknown field|metric/);
  assert.throws(() => validateLargeIntent(withD({corbels: {count: 40}})), /corbels\.count/);
  assert.throws(() => validateLargeIntent(withD({corbels: {foot: true}})), /foot needs storey/);
  const withW = (x: Record<string, unknown>) => ({...base, walls: base.walls.map((w, k) => (k === 1 ? {...w1, ...x} : w))});
  assert.ok(validateLargeIntent(withW({windowGroup: {count: 3, gap: 0.08, storeys: [1, 2]}})));
  assert.throws(() => validateLargeIntent(withW({windowGroup: {count: 6}})), /windowGroup\.count/);
  assert.throws(() => validateLargeIntent(withW({windowGroup: {count: 2, gap: 0.5}})), /windowGroup\.gap/);
  assert.throws(() => validateLargeIntent(withW({windowGroup: {count: 2, gapM: 0.2}})), /unknown field|metric/);
  assert.ok(validateLargeIntent(withW({balconies: {storeys: [2], colour: '#26292b', deep: 0.15, windows: true}})));
  assert.throws(() => validateLargeIntent(withW({balconies: {storeys: [2], colour: 'iron'}})), /balconies\.colour/);
  assert.throws(() => validateLargeIntent(withW({balconies: {storeys: [2], deep: 0.9}})), /balconies\.deep/);
});

test('absent fields leave the system and the recipe unchanged; a balcony colour gets its own rail slot', () => {
  const f = {pitchM: 4, lines: [0, 5, 8, 11, 14], ground: 'system' as const, slots: {frame: 'frame', stone: 'stone', glass: 'glass', door: 'door', curtain: 'curtain'}, balconyStoreys: [2]};
  const plain = largeSystem('brick-bay-grid', f);
  assert.deepEqual(largeSystem('brick-bay-grid', {...f, windowGroup: undefined, balconyRailSlot: undefined}), plain);
  const grouped = largeSystem('brick-bay-grid', {...f, windowGroup: {count: 3, gapM: 0.3}});
  assert.deepEqual(grouped.typical.win?.group, {count: 3, gap: 0.3});
  assert.equal(grouped.ground.win?.group, undefined, 'the ground is grouped only when listed');
  const iron = largeSystem('brick-bay-grid', {...f, balconyRailSlot: 'rail@bg1', balconyDeepM: 0.5, balconyOnWindows: true});
  const b = iron.rowOverrides!['2'].balcony!;
  assert.equal(b.rail?.slot, 'rail@bg1'); assert.equal(b.rail?.top, 'rail@bg1'); assert.equal(b.depth, 0.5);
  assert.ok(Math.abs(b.back!.w! * b.w! - plain.typical.win!.w! * f.pitchM) < 0.01, 'the balcony stands on the storey\'s own window, as wide as on the other storeys');
  assert.ok(b.w! < f.pitchM, 'and spans the window, not the whole bay');
  const fit = fitLarge(validateLargeIntent(raw(HIRSCH)), facts(HIRSCH));
  assert.equal(fit.recipe.spec.palette['rail@bg1'], '#26292b');
});

test('pand-233585: deeper piers and a stone corbel table over the glazing bays, inside the gates and the budget', async () => {
  const i = raw(WAREHOUSE), built = compile(i, WAREHOUSE);
  const without = compile({...i, walls: i.walls.map(w => (w.dressings ? {...w, dressings: {...w.dressings, corbels: undefined}} : w))} as LargeBuildingIntent, WAREHOUSE);
  const corbelTris = triangles(built) - triangles(without);
  assert.ok(corbelTris >= 13 * 4 * 10, `a corbel table of 4 corbels per bay over 13 bays (${corbelTris} triangles)`);
  const g = await gatesOf(WAREHOUSE, built);
  assert.deepEqual(g.failing, []);
  assert.ok(g.tris <= (i.budgetTriangles ?? LARGE_BUDGET_TRIANGLES), `${g.tris} triangles (the house budget; walls[0] carries the giant order since #45)`);
});

test('Hirschpassage: fluted giant pilasters with capitals, three windows per bay, black iron balconies', async () => {
  const i = raw(HIRSCH), built = compile(i, HIRSCH);
  const noGroup = compile(strip(strip(i, 1, ['windowGroup']), 3, ['windowGroup']), HIRSCH);
  assert.ok(triangles(built, s => s === 'glass') > triangles(noGroup, s => s === 'glass'), 'more panes with three windows per bay');
  const noPiers = compile(strip(i, 1, ['dressings']), HIRSCH);
  assert.ok(triangles(built, s => s === 'stone') > triangles(noPiers, s => s === 'stone'), 'capitals and bases in the dressing stone');
  const g = await gatesOf(HIRSCH, built);
  assert.deepEqual(g.failing, []);
  assert.ok(g.tris <= LARGE_BUDGET_TRIANGLES, `${g.tris} triangles`);
});

test('Stadhouderskade 111 school wing: white pilasters and paired windows within the budget', async () => {
  const g = await gatesOf(SCHOOL, compile(raw(SCHOOL), SCHOOL));
  assert.ok(g.tris <= LARGE_BUDGET_TRIANGLES, `${g.tris} triangles`);
  assert.ok(!g.failing.includes('triangle-budget'));
  assert.ok(DRESS.capital.h > 0 && DRESS.corbel.out < DRESS.pier.out, 'a corbel course ends inside the piers, never on their face');
});
