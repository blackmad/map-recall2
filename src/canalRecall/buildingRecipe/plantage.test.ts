/** Plantage (2026-11-10): `windowHead.rise`, the segmental arch rise in metres (a flattened basket head). Absent = byte-identical. */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {compileBuilding, resolveIntent} from './compile.ts';
import type {BuildingFacts} from './facts.ts';
import {validateIntent} from './intent.ts';

const raw = (id: string) => JSON.parse(fs.readFileSync(`scripts/building-recipes/houses/${id}/intent.json`, 'utf8'));
const facts = (id: string): BuildingFacts => JSON.parse(fs.readFileSync(`scripts/building-recipes/houses/${id}/facts.json`, 'utf8'));
const canal = (patch: Record<string, unknown>) => { const i = raw('bilder-153622'); Object.assign(i.fronts[0], patch); return i; };
const fit = (patch: Record<string, unknown>) => compileBuilding(resolveIntent(canal(patch), raw), facts('bilder-153622'));

test('windowHead.rise: schema', () => {
  validateIntent(canal({windowHead: {kind: 'segmental', rise: 0.15}}));
  assert.throws(() => validateIntent(canal({windowHead: {kind: 'round', rise: 0.15}})), /rise/);
  assert.throws(() => validateIntent(canal({windowHead: {kind: 'segmental', rise: 0.9}})), /rise/);
});

test('windowHead.rise: sets the head rise in metres; absent keeps 0.08 x width', () => {
  const base = fit({windowHead: {kind: 'segmental'}}).recipe.elevations[0].openings.value.filter(o => o.head === 'segmental');
  const flat = fit({windowHead: {kind: 'segmental', rise: 0.15}}).recipe.elevations[0].openings.value.filter(o => o.head === 'segmental');
  assert.ok(base.length > 0 && flat.length === base.length);
  for (const o of base) assert.ok(Math.abs(o.headRiseM! - Math.round(o.widthM * 0.08 * 100) / 100) < 0.02);
  for (const o of flat) assert.equal(o.headRiseM, 0.15);
});
