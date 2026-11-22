/**
 * `crownEdge: "none"`: a gabled crown drawn in its own brick, without the 0.08 m white raking edge. Van Baerlestraat
 * 28-30 (1900s): a brick point gable whose edges meet the tiled roof cheeks; the stock white edge drew it as a
 * pale-outlined spike (user review 2026-11-22). Fronts that do not opt in compile exactly as before.
 *   node --import tsx --test src/canalRecall/buildingRecipe/crownEdge.test.ts
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
const front = {id: 'front0', street: base.fronts[0].street, gable: 'point', storeys: 3, bays: 5, doorBay: 0, basement: 'none', cornice: 'simple', windows: 'sash', hoist: false, crownAt: {from: 0.3, to: 0.7}, crownRise: 1.19};
const variant = (f: Record<string, unknown> = {}): CanalHouseIntent => validateIntent({...base, fronts: [{...front, ...f}]});
const build = (f: Record<string, unknown> = {}) => compileBuilding(variant(f), facts);
const crownOf = (b: ReturnType<typeof compileBuilding>) => b.recipe.elevations[0].crown!.value;

test('absent: the crown keeps its 0.08 m white edge', () => {
  assert.equal(crownOf(build()).trimWidthM, 0.08);
});

test('crownEdge none: the same outline, no edge trim, and nothing else changes', () => {
  const stock = build(), plain = build({crownEdge: 'none'});
  assert.equal(crownOf(plain).trimWidthM, 0);
  assert.deepEqual(crownOf(plain).profile, crownOf(stock).profile);
  assert.deepEqual(plain.recipe.elevations[0].openings, stock.recipe.elevations[0].openings);
});

test('validation: "none" only, on a gabled crown', () => {
  assert.throws(() => variant({crownEdge: 'white'}), /crownEdge/);
  assert.throws(() => variant({gable: 'flat', crownAt: undefined, crownRise: undefined, crownEdge: 'none'}), /crownEdge/);
  assert.doesNotThrow(() => variant({gable: 'step', crownAt: undefined, crownEdge: 'none'}));
});
