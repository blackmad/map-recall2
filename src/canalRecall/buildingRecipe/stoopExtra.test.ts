import test from 'node:test';
import assert from 'node:assert/strict';
import {ExtraSink, EXTRA_BUDGET, wallExtras, type ExtraContext} from '../facadeExtras.ts';
import {genericStoopPlan, specStoopExtra, streamStoopTris} from '../stoopExtra.ts';
import {houseSpecPatch} from '../houseSpec/decorate.ts';
import {fromJev} from '../houseSpec/adapters.ts';
import {judgementOf} from '../houseSpec/writers/jev.ts';

const wall = (over: Partial<ExtraContext> = {}): ExtraContext => ({
  id: 'NL.IMBAG.Pand.0363100012175702', style: 'canal', wallKey: 'w0', f: {x0: 0, y0: 0, ux: 1, uy: 0, nx: 0, ny: -1, len: 7}, base: 0, top: 14,
  layout: {bays: 2, bayWidthM: 3.5, groundM: 3.4, storeys: 3, storeyM: 3.1, doorBays: [0]}, wallHex: '#4a3a33', accentHex: '#ffffff', groundLevel: true, streetSide: true, ...over,
});

test('generic path: a spec stoop draws typed, inside the street wall budget', () => {
  const s = new ExtraSink(EXTRA_BUDGET.building);
  assert.ok(specStoopExtra(wall({stoop: {flight: 'front', railStyle: 'bars'}, stoopReachM: 4}), s));
  assert.ok(s.tris.length > 40 && s.tris.length <= EXTRA_BUDGET.wall, `${s.tris.length} triangles`);
  assert.ok(s.tris.some(t => t.hex === '#1d1f22'), 'black iron');
});

test('generic path: a front flight past the pavement turns along the wall, and nothing is drawn without room', () => {
  const front = genericStoopPlan(wall({stoop: {}, stoopReachM: 4}))!;
  assert.equal(front.plan.flight, 'front');
  const turned = genericStoopPlan(wall({stoop: {}, stoopReachM: 1.3}))!;
  assert.match(turned.plan.flight, /^side-/);
  assert.ok(turned.plan.projectionM <= 1.3);
  assert.equal(genericStoopPlan(wall({stoop: {}, stoopReachM: 0.5})), null);
  // Shopfront ground floors and walls without a door get none.
  assert.equal(genericStoopPlan(wall({stoop: {}, shopfront: true})), null);
  assert.equal(genericStoopPlan(wall({stoop: {}, layout: {...wall().layout, doorBays: []}})), null);
});

test('generic path: without a spec stoop the wall dresses exactly as before', () => {
  const a = new ExtraSink(EXTRA_BUDGET.building), b = new ExtraSink(EXTRA_BUDGET.building);
  wallExtras(wall(), a); wallExtras(wall({stoopReachM: 3}), b);
  assert.deepEqual(a.tris, b.tris);
  // A spec stoop, forced first (threeBuildingFeatures adds 'stoop' to registerForce), replaces the dice stoop.
  const c = new ExtraSink(EXTRA_BUDGET.building), used = wallExtras(wall({stoop: {flight: 'double'}, stoopReachM: 3, registerForce: ['stoop']}), c);
  assert.ok(used.includes('stoop') && !used.includes('double-stoop'));
  assert.ok(c.tris.some(t => t.hex === '#1d1f22'));
});

test('spec view -> specStoop property; Jev yes writes basement stoop', () => {
  assert.deepEqual(houseSpecPatch({stoop: {flight: 'side-left'}, src: {stoop: 'monument-text'}}, {}).specStoop, {flight: 'side-left'});
  assert.equal(houseSpecPatch({src: {}}, {}).specStoop, undefined);
  const j = judgementOf('0363100012175702', 'crop.jpg', null, {stoop: {noul: 0.97}});
  assert.equal(fromJev(j).design.fronts?.[0]?.basement, 'stoop');
  assert.equal(judgementOf('0363100012175702', 'crop.jpg', null, {stoop: {noul: 0.2}}).stoop, undefined);
});

test('generic path: an ornate stoop over the wall budget draws with a cheaper iron railing, not the slabs', () => {
  const c = wall({stoop: {flight: 'side-right', steps: 7, landing: {depth: 1.3, width: 2.2}, widthM: 1.1, railStyle: 'ornate', under: 'window'}, stoopReachM: 3.5, layout: {...wall().layout, doorBays: [0]}});
  const plan = genericStoopPlan(c)!.plan;
  assert.ok(streamStoopTris(plan) > EXTRA_BUDGET.wall, `ornate ${streamStoopTris(plan)}`);
  const s = new ExtraSink(EXTRA_BUDGET.wall);
  assert.ok(specStoopExtra(c, s));
  assert.ok(s.tris.length <= EXTRA_BUDGET.wall && s.tris.some(t => t.hex === '#1d1f22'));
});
