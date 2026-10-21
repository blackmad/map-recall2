/**
 * The opt-in per-house triangle budget (`intent.budgetTriangles`, user-approved 2026-10-21 for the Haarlemmerweg north
 * row). The global large-tier budget stays 12,000; a house that names a number uses it for its own `triangle-budget`
 * gate and for the block-kit gate, and the mesh it builds is byte-identical to the same house without the field.
 */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {validateLargeIntent} from './largeIntent.ts';
import {compileBuilding} from './compile.ts';
import {evaluateLargeGates, LARGE_BUDGET_TRIANGLES, LARGE_BUDGET_TRIANGLES_MAX} from './largeGates.ts';
import type {BuildingFacts} from './facts.ts';
import type {LargeBuildingIntent} from './intent.ts';
import {canalhouseGroupToGlb} from '../../../scripts/canalhouse-recipes/export-glb.ts';
import {decodeTriangles} from '../../../scripts/building-recipes/compile.ts';

const HOUSES = 'scripts/building-recipes/houses';
const raw = (id: string): LargeBuildingIntent => JSON.parse(fs.readFileSync(`${HOUSES}/${id}/intent.json`, 'utf8'));
const facts = (id: string): BuildingFacts => JSON.parse(fs.readFileSync(`${HOUSES}/${id}/facts.json`, 'utf8'));
const HOUSE = 'politie-van-leijenberghlaan';

const exportGlb = (intent: LargeBuildingIntent, f: BuildingFacts) =>
  canalhouseGroupToGlb(intent.id, compileBuilding(intent, f).group, {metreUvs: true, slotFor: m => m.userData.materialSlot as string, maxBytes: 2_000_000});

test('budgetTriangles: the schema takes an integer inside the per-house cap and nothing else', () => {
  const base = raw(HOUSE);
  assert.equal(validateLargeIntent(base).budgetTriangles, undefined, 'absent by default');
  assert.equal(validateLargeIntent({...base, budgetTriangles: LARGE_BUDGET_TRIANGLES_MAX}).budgetTriangles, LARGE_BUDGET_TRIANGLES_MAX);
  assert.equal(validateLargeIntent({...base, budgetTriangles: 12000}).budgetTriangles, 12000);
  assert.throws(() => validateLargeIntent({...base, budgetTriangles: 900}), /budgetTriangles/);
  assert.throws(() => validateLargeIntent({...base, budgetTriangles: LARGE_BUDGET_TRIANGLES_MAX + 1}), /budgetTriangles/);
  assert.throws(() => validateLargeIntent({...base, budgetTriangles: 12000.5}), /budgetTriangles/);
  assert.throws(() => validateLargeIntent({...base, budgetTriangles: '12000'}), /budgetTriangles/);
});

test('budgetTriangles: the gate uses the house number, and the default limit stays 12,000', async () => {
  const intent = validateLargeIntent(raw(HOUSE)), f = facts(HOUSE);
  const tris = await decodeTriangles((await exportGlb(intent, f)).bytes);
  assert.ok(tris.length > 1000, `the fixture house needs to be bigger than the small budget (${tris.length})`);
  const gate = (opts: {budget?: number}) => evaluateLargeGates(tris, compileBuilding(intent, f), opts).gates.find(g => g.id === 'triangle-budget')!;
  assert.equal(gate({}).limit, `<= ${LARGE_BUDGET_TRIANGLES}`);
  assert.equal(gate({}).pass, true);
  assert.equal(gate({budget: 40000}).limit, '<= 40000');
  assert.equal(gate({budget: 40000}).pass, true);
  assert.equal(gate({budget: 1000}).pass, false, 'a house budget under the mesh size still fails');
});

test('budgetTriangles: compile passes it to the block-kit gate and changes no geometry', async () => {
  const base = validateLargeIntent(raw(HOUSE)), f = facts(HOUSE);
  const plain = compileBuilding(base, f);
  assert.equal(plain.blockGates.budget, LARGE_BUDGET_TRIANGLES);
  assert.equal(plain.blockGates.ok, true);
  const raised = compileBuilding(validateLargeIntent({...raw(HOUSE), budgetTriangles: LARGE_BUDGET_TRIANGLES_MAX}), f);
  assert.equal(raised.blockGates.budget, LARGE_BUDGET_TRIANGLES_MAX);
  assert.equal(raised.blockGates.ok, true);
  // The schema refuses a budget under the 12,000 default, so the gate cannot be starved from a house file; the gate's
  // own failure path is exercised through `evaluateLargeGates` above.
  assert.throws(() => validateLargeIntent({...raw(HOUSE), budgetTriangles: 1000}), /budgetTriangles/);
  const [a, b] = await Promise.all([exportGlb(base, f), exportGlb(validateLargeIntent({...raw(HOUSE), budgetTriangles: LARGE_BUDGET_TRIANGLES_MAX}), f)]);
  assert.ok(Buffer.compare(Buffer.from(a.bytes), Buffer.from(b.bytes)) === 0, 'budgetTriangles is a gate limit only: same bytes');
});
