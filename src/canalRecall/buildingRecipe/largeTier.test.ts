import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {validateLargeIntent} from './largeIntent.ts';
import {fitLarge} from './fitLarge.ts';
import {compileBuilding} from './compile.ts';
import {evaluateLargeGates, LARGE_BUDGET_TRIANGLES} from './largeGates.ts';
import type {BuildingFacts} from './facts.ts';
import type {LargeBuildingIntent} from './intent.ts';
import {canalhouseGroupToGlb} from '../../../scripts/canalhouse-recipes/export-glb.ts';
import {decodeTriangles} from '../../../scripts/building-recipes/compile.ts';
import {dissolveFaces} from '../blockBuilding/dissolve.ts';

const HOUSES = 'scripts/building-recipes/houses';
const raw = (id: string) => JSON.parse(fs.readFileSync(`${HOUSES}/${id}/intent.json`, 'utf8'));
const facts = (id: string): BuildingFacts => JSON.parse(fs.readFileSync(`${HOUSES}/${id}/facts.json`, 'utf8'));
const LARGE = ['politie-van-leijenberghlaan', 'leidsestraat-67-large', 'de-balie-large', 'social-history-large'];

async function gatesOf(intent: LargeBuildingIntent, f: BuildingFacts) {
  const built = compileBuilding(intent, f);
  const glb = await canalhouseGroupToGlb(intent.id, built.group, {metreUvs: true, slotFor: m => m.userData.materialSlot as string, maxBytes: 2_000_000});
  const tris = await decodeTriangles(glb.bytes);
  return {built, tris, gates: evaluateLargeGates(tris, built).gates};
}

test('large intent schema: coordinates, unknown keys, duplicate surfaces and component prerequisites are rejected', () => {
  const base = raw('politie-van-leijenberghlaan');
  assert.equal(validateLargeIntent(base).id, 'politie-van-leijenberghlaan');
  assert.throws(() => validateLargeIntent({...base, walls: [{...base.walls[0], widthM: 40}]}), /coordinate\/metric|widthM/);
  assert.throws(() => validateLargeIntent({...base, walls: [{...base.walls[0], gable: 'neck'}]}), /gable/);
  assert.throws(() => validateLargeIntent({...base, walls: [base.walls[0], {...base.walls[2], wallSurfaces: [57]}]}), /57/);
  assert.throws(() => validateLargeIntent({...base, walls: [{...base.walls[0], police: {lamp: true}}]}), /lamp/);
  assert.throws(() => validateLargeIntent({...base, walls: [base.walls[0], {...base.walls[2], alignWith: 0, storeys: 3}]}), /alignWith/);
  assert.throws(() => validateLargeIntent({...base, walls: [{...base.walls[0], alignWith: 0}]}), /alignWith/);
});

test('fitLarge is deterministic and keeps coplanar surfaces of different wall groups in separate panels', () => {
  for (const id of LARGE) {
    const intent = validateLargeIntent(raw(id)), f = facts(id);
    const a = fitLarge(intent, f), b = fitLarge(intent, f);
    assert.equal(JSON.stringify(a), JSON.stringify(b), id);
    assert.deepEqual(a.report.warnings, [], id);
  }
  // Leidsestraat 67: surfaces 15 (ribbon front), 28 (stair tower) and 48 (brick part) are one 3DBAG plane, three groups.
  const {recipe} = fitLarge(validateLargeIntent(raw('leidsestraat-67-large')), facts('leidsestraat-67-large'));
  assert.deepEqual(recipe.groups.slice(0, 3).map(g => g.panels.length), [1, 1, 1]);
  assert.deepEqual(recipe.groups.slice(0, 3).map(g => g.system), ['ribbon-windows', 'brick-bay-grid', 'brick-bay-grid']);
  // De Balie: the wings share the centre block's storey lines (alignWith).
  const balie = fitLarge(validateLargeIntent(raw('de-balie-large')), facts('de-balie-large')).recipe;
  assert.equal(balie.groups[1].storeyHeightsM[0], balie.groups[0].storeyHeightsM[0]);
});

test('large customers pass the large-tier gates within the 12k budget', async () => {
  for (const id of LARGE) {
    const {gates, tris} = await gatesOf(validateLargeIntent(raw(id)), facts(id));
    assert.ok(tris.length <= LARGE_BUDGET_TRIANGLES, `${id}: ${tris.length}`);
    assert.deepEqual(gates.filter(g => !g.pass).map(g => g.id), [], id);
  }
});

test('police signature components build and stay attached (stripe, blue lamp, canopy, garage doors, roof plant)', async () => {
  const base = validateLargeIntent(raw('politie-van-leijenberghlaan'));
  // The east wing (ribbons down to the ground) gets the full police kit: canopied entrance, striped band, lamp, two garage doors (bays wide enough for 3 m doors).
  const walls = base.walls.map((w, i) => i === 2 ? {...w, baysPerStorey: 5, entrance: {bay: 1, canopy: true}, garageDoors: 2, police: {stripe: true, lamp: true}} : w);
  const intent = validateLargeIntent({...base, walls, roofPlant: true});
  const {built, gates} = await gatesOf(intent, facts('politie-van-leijenberghlaan'));
  const c = built.components;
  assert.ok(c.policeStripes >= 1 && c.lamps === 1 && c.canopies === 1 && c.garageDoors === 2, JSON.stringify(c));
  assert.deepEqual(gates.filter(g => !g.pass).map(g => g.id), []);
});

test('dissolveFaces merges two coplanar strips into one face and keeps the original vertices', () => {
  // Two 1 x 2 m strips side by side plus a T-junction vertex on the shared edge.
  const to3 = (u: number, v: number): [number, number, number] => [u, v, 0];
  const a = [[0, 0], [1, 0], [1, 1], [1, 2], [0, 2]].map(([u, v]) => to3(u, v));
  const b = [[1, 0], [2, 0], [2, 2], [1, 2]].map(([u, v]) => to3(u, v));
  const poly = (r: [number, number, number][]) => ({outer: r.map(p => [p[0], p[1]] as [number, number]), holes: []});
  const faces = dissolveFaces([{rings: [a], poly: poly(a)}, {rings: [b], poly: poly(b)}], p => [p[0], p[1]]);
  assert.ok(faces);
  assert.equal(faces.length, 1);
  const us = faces[0].poly.outer.map(p => p[0]).sort((x, y) => x - y);
  assert.equal(us[0], 0); assert.equal(us[us.length - 1], 2);
  assert.ok(!faces[0].poly.outer.some(p => p[0] === 1 && p[1] === 1), 'the T-junction vertex on the cancelled edge is dropped');
});
