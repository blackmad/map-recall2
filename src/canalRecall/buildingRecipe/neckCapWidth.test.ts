/**
 * A neck crown whose cap is narrower than its neck (`crownCapWidth`) and a round-arched gable light (`atticShape:
 * "arched"`), both measured on Van Baerlestraat 26 (1909): a 3.4 m round cap on a 4.5 m neck with a level ledge either
 * side, and one 1.25 x 2.2 m arched light in the neck. Fronts that do not opt in compile exactly as before.
 *   node --import tsx --test src/canalRecall/buildingRecipe/neckCapWidth.test.ts
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
const front = {id: 'front0', street: base.fronts[0].street, gable: 'neck', storeys: 3, bays: 3, doorBay: 0, basement: 'none', cornice: 'none', windows: 'sash', hoist: false, crownCap: 'rounded', crownRise: 1.3, crownNeckWidth: 0.67, crownCapRatio: 0.41, crownShoulderRise: 0.35};
const variant = (f: Record<string, unknown> = {}): CanalHouseIntent => validateIntent({...base, fronts: [{...front, ...f}]});
const build = (f: Record<string, unknown> = {}) => compileBuilding(variant(f), facts);
const crownOf = (b: ReturnType<typeof compileBuilding>) => b.recipe.elevations[0].crown!.value;
const attic = (b: ReturnType<typeof compileBuilding>) => b.recipe.elevations[0].openings.value.filter(o => /attic/.test(o.id));

test('absent fields: the crown and the attic light are unchanged (a full-neck cap, a square light)', () => {
  assert.deepEqual(crownOf(build()), crownOf(build({crownCapWidth: 1})));
  const a = attic(build({atticWindows: 1})), r = attic(build({atticWindows: 1, atticShape: 'rectangular'}));
  assert.deepEqual(a, r);
  assert.equal(a[0].head, undefined);
});

test('crownCapWidth narrows the cap on the neck and leaves a level ledge either side of its foot', () => {
  const span = (b: ReturnType<typeof compileBuilding>, from: number) => { const p = crownOf(b).profile, hi = p.filter(q => q[1] > from).map(q => q[0]); return Math.max(...hi) - Math.min(...hi); };
  const full = build(), narrow = build({crownCapWidth: 0.76});
  const p = crownOf(narrow).profile, top = Math.max(...p.map(q => q[1]));
  // The shoulders and neck are the same; only the cap differs.
  assert.notDeepEqual(crownOf(full).profile, p);
  const capFoot = top - 0.4;
  assert.ok(span(narrow, capFoot) < span(full, capFoot) - 0.4, `cap ${span(narrow, capFoot)} vs full ${span(full, capFoot)}`);
  // Ledges: two vertices at one height (the cap's foot) inside the neck on each side.
  const ys = p.map(q => q[1]), foot = ys.filter(y => ys.filter(z => Math.abs(z - y) < 1e-6).length >= 4);
  assert.ok(foot.length >= 4, 'level ledges at the cap foot');
});

test('atticShape arched: the gable light ends in a semicircular head, sized by atticSize', () => {
  const [l] = attic(build({atticWindows: 1, atticShape: 'arched', atticSize: {span: 1.25, rise: 2.2, sill: 0}}));
  assert.equal(l.head, 'segmental');
  assert.equal(l.headRiseM, 0.625);
  assert.equal(l.widthM, 1.25);
  assert.equal(l.heightM, 2.2);
});

test('validation: crownCapWidth is a neck/bell share and an arched light needs a light', () => {
  assert.throws(() => variant({gable: 'step', crownCap: undefined, crownNeckWidth: undefined, crownCapRatio: undefined, crownShoulderRise: undefined, crownCapWidth: 0.7}), /crownCapWidth/);
  assert.throws(() => variant({crownCapWidth: 0.2}), /crownCapWidth/);
  assert.throws(() => variant({crownCap: 'flat', crownCapRatio: undefined, crownCapWidth: 0.7}), /crownCapWidth/);
  assert.throws(() => variant({atticShape: 'arched'}), /atticShape/);
  assert.doesNotThrow(() => variant({gable: 'bell', crownCapWidth: 0.6, atticWindows: 1, atticShape: 'arched'}));
});
