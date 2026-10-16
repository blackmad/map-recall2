/**
 * Neck/bell heads measured from the photo (2026-10-16, Oudezijds Voorburgwal 115/119): neck width share, a segmental cap
 * with a measured rise share, and an entablature (frieze + projecting cornice ledge) under the cap. Fronts that do not
 * opt in compile exactly as before.
 *   node --import tsx --test src/canalRecall/buildingRecipe/neckEntablature.test.ts
 */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {validateIntent, type CanalHouseIntent} from './intent.ts';
import {compileBuilding} from './compile.ts';
import type {BuildingFacts} from './facts.ts';

const H = 'scripts/building-recipes/houses/bilder-087959';
const base = JSON.parse(fs.readFileSync(`${H}/intent.json`, 'utf8'));
const facts: BuildingFacts = JSON.parse(fs.readFileSync(`${H}/facts.json`, 'utf8'));
const front = {id: 'front0', street: base.fronts[0].street, gable: 'neck', storeys: 3, bays: 3, doorBay: 0, basement: 'none', cornice: 'none', windows: 'sash', hoist: false, crownCap: 'rounded'};
const variant = (f: Record<string, unknown> = {}): CanalHouseIntent => validateIntent({...base, fronts: [{...front, ...f}]});
const crownOf = (b: ReturnType<typeof compileBuilding>) => b.recipe.elevations[0].crown!.value;

test('absent fields: the neck head is unchanged (stock neck share, stock cap rise, no entablature)', () => {
  const a = crownOf(compileBuilding(variant(), facts)), b = crownOf(compileBuilding(variant({crownCap: 'rounded'}), facts));
  assert.deepEqual(a, b);
  assert.equal(a.capCornice, undefined);
});

test('crownNeckWidth narrows the neck; a segmental cap is lower than a rounded one', () => {
  const xs = (b: ReturnType<typeof compileBuilding>) => { const p = crownOf(b).profile, top = Math.max(...p.map(q => q[1])); const hi = p.filter(q => q[1] > top - 1.2).map(q => q[0]); return Math.max(...hi) - Math.min(...hi); };
  const stock = compileBuilding(variant(), facts), narrow = compileBuilding(variant({crownNeckWidth: 0.38}), facts);
  assert.ok(xs(narrow) < xs(stock) - 0.2, `narrow neck ${xs(narrow)} vs stock ${xs(stock)}`);
  const seg = crownOf(compileBuilding(variant({crownCap: 'segmental', crownCapRatio: 0.1}), facts)).profile;
  const rnd = crownOf(compileBuilding(variant({crownCap: 'rounded', crownCapRatio: 0.1}), facts)).profile;
  assert.notDeepEqual(seg, rnd);
});

test('crownCapCornice puts a stone ledge wider than the neck under the cap, over a frieze', () => {
  const b = compileBuilding(variant({crownCap: 'segmental', crownRise: 3, crownNeckWidth: 0.44, crownCapRatio: 0.11, crownCapCornice: {ledge: 0.15, projection: 0.086, frieze: 0.19}}), facts);
  const c = crownOf(b), k = c.capCornice!;
  assert.ok(k, 'cornice ledge emitted');
  assert.ok(c.capFacing && c.capFacing.bottomM < k.bottomM - 0.05, 'frieze facing below the ledge');
  const top = Math.max(...c.profile.map(q => q[1]));
  assert.ok(k.bottomM + k.heightM < top, 'ledge under the cap');
  assert.ok(k.depthM >= 0.06 && k.depthM <= 0.3);
  assert.ok(b.group.getObjectByName('crown/cap-cornice'), 'compiled into the facade');
  // A neck too short for the measured entablature is reported and skipped rather than drawn into the shoulders.
  const low = compileBuilding(variant({crownCap: 'segmental', crownRise: 1, crownCapCornice: {ledge: 0.3, projection: 0.1, frieze: 0.5}}), facts);
  assert.equal(crownOf(low).capCornice, undefined);
  assert.ok(low.fit.warnings.some(w => /crownCapCornice reaches below the neck/.test(w)));
});

test('validation: the new fields stay neck/bell-only and bounded (shares, no metres)', () => {
  assert.throws(() => variant({gable: 'step', crownNeckWidth: 0.4}), /crownNeckWidth/);
  assert.throws(() => variant({crownNeckWidth: 0.9}), /crownNeckWidth/);
  assert.throws(() => variant({crownCapRatio: 0.9}), /crownCapRatio/);
  assert.throws(() => variant({gable: 'step', crownCapCornice: {ledge: 0.1, projection: 0.1}}), /crownCapCornice/);
  assert.throws(() => variant({crownCapCornice: {ledge: 0.5, projection: 0.1}}), /crownCapCornice/);
  assert.throws(() => variant({crownCapCornice: {heightM: 0.25, projectM: 0.1}}), /metric field|crownCapCornice/);
  assert.doesNotThrow(() => variant({gable: 'bell', crownCap: 'segmental', crownNeckWidth: 0.38, crownCapRatio: 0.18, crownCapCornice: {ledge: 0.12, projection: 0.095, frieze: 0.18}}));
});
