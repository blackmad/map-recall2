/**
 * Window proportions per storey (`walls[].storeyShapes`, factory acceptance #45, 2026-10-24): schema, byte-identical
 * when absent, only the listed storeys reshaped, arched heads and open bays build on the storey's own window.
 */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {validateLargeIntent} from './largeIntent.ts';
import {fitLarge} from './fitLarge.ts';
import type {BuildingFacts} from './facts.ts';
import type {LargeBuildingIntent} from './intent.ts';
import {largeSystem} from '../blockBuilding/systems.ts';

const HOUSES = 'scripts/building-recipes/houses', ID = 'oostpoort-montessori-080630';
const raw = (): LargeBuildingIntent => JSON.parse(fs.readFileSync(`${HOUSES}/${ID}/intent.json`, 'utf8'));
const facts = (): BuildingFacts => JSON.parse(fs.readFileSync(`${HOUSES}/${ID}/facts.json`, 'utf8'));
const withShapes = (shapes: unknown, system?: string) => { const i = raw(); i.walls[0] = {...i.walls[0], storeyShapes: shapes as never, ...(system ? {system: system as never} : {})}; return i; };

test('schema: storeyShapes are upper storeys and fractions, one entry per storey, punched systems only', () => {
  const ok = [{storeys: [2], w: 0.4, h: 0.4, sill: 0.3}];
  assert.doesNotThrow(() => validateLargeIntent(withShapes(ok)));
  assert.throws(() => validateLargeIntent(withShapes([{storeys: [0], w: 0.4, h: 0.4, sill: 0.3}])), /storeyShapes\[0\]\.storeys/);
  assert.throws(() => validateLargeIntent(withShapes([{storeys: [2], w: 0.4, h: 0.7, sill: 0.4}])), /sill \+ h/);
  assert.throws(() => validateLargeIntent(withShapes([{storeys: [2], w: 1.4, h: 0.4, sill: 0.3}])), /\.w: fraction/);
  assert.throws(() => validateLargeIntent(withShapes([{storeys: [1, 2], w: 0.4, h: 0.4, sill: 0.3}, {storeys: [2], w: 0.5, h: 0.5, sill: 0.2}])), /storey 2 in two entries/);
  assert.throws(() => validateLargeIntent(withShapes([{storeys: [2], w: 0.4, h: 0.4, sill: 0.3, xM: 1}])), /unknown field/);
  assert.throws(() => validateLargeIntent(withShapes(ok, 'ribbon-windows')), /only brick-bay-grid and plinth-shopfronts/);
  assert.throws(() => validateLargeIntent(withShapes([])), /1\.\.8 entries/);
});

test('largeSystem: absent leaves the system unchanged; listed storeys get their own window, others keep the typical', () => {
  const f = {pitchM: 3, lines: [0, 4, 8, 10.5], ground: 'system' as const, slots: {frame: 'frame', stone: 'stone', glass: 'glass', door: 'door', curtain: 'curtain'}, shape: {w: 0.7, h: 0.55, sillM: 0.9}};
  const plain = largeSystem('brick-bay-grid', f);
  assert.deepEqual(largeSystem('brick-bay-grid', {...f, storeyShapes: undefined}), plain);
  const s = largeSystem('brick-bay-grid', {...f, storeyShapes: [{storey: 2, w: 0.35, h: 0.4, sillM: 0.8}]});
  assert.deepEqual(s.typical, plain.typical);
  assert.deepEqual(s.ground, plain.ground);
  const w2 = s.rowOverrides!['2'].win!;
  assert.equal(w2.w, 0.35); assert.equal(w2.h, 0.4); assert.equal(w2.sill, 0.8);
  assert.equal(w2.frame, plain.typical.win!.frame, 'frame, glass and sill slots stay the group\'s');
  assert.equal(s.rowOverrides!['1'], undefined);
  // arched heads on that storey keep its shape; open bays cycle its own row
  const a = largeSystem('brick-bay-grid', {...f, storeyShapes: [{storey: 2, w: 0.35, h: 0.4, sillM: 0.8}], arches: {windows: 'round', storeys: [2]}});
  assert.equal(a.rowOverrides!['2'].win!.w, 0.35); assert.ok(a.rowOverrides!['2'].win!.arch);
  const o = largeSystem('brick-bay-grid', {...f, storeyShapes: [{storey: 2, w: 0.35, h: 0.4, sillM: 0.8}], openBays: [{storeys: [2], bays: [0]}], bays: 2});
  assert.equal(o.rowOverrides!['2'].cycle![0].win!.w, 0.35);
  // a non-punched system ignores it
  assert.deepEqual(largeSystem('ribbon-windows', {...f, storeyShapes: [{storey: 2, w: 0.35, h: 0.4, sillM: 0.8}]}), largeSystem('ribbon-windows', f));
});

test('fitLarge: the sill is a fraction of that storey\'s own height; storeys above the eaves are dropped', () => {
  const i = withShapes([{storeys: [2, 9], w: 0.4, h: 0.4, sill: 0.25}]);
  const fit = fitLarge(validateLargeIntent(i), facts()), plain = fitLarge(validateLargeIntent(raw()), facts());
  const sys = Object.entries(fit.recipe.spec.systems).find(([k]) => k.endsWith('0') || k.includes('g0'))!;
  const before = plain.recipe.spec.systems[sys[0]];
  const lines = before.lines!, row = sys[1].rowOverrides!['2'].win!;
  assert.ok(Math.abs(row.sill! - 0.25 * (lines[3] - lines[2])) < 0.002, `sill ${row.sill} vs storey ${lines[3] - lines[2]}`);
  assert.equal(sys[1].rowOverrides!['9'], undefined);
});
