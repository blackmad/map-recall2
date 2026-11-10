/**
 * houseFrontRoof.ts: `roof.source: front` on a house compiled alone replaces the 3DBAG roof with the front's forms;
 * without it (and on facts a block face already roofed) the facts come back as the same object (byte-identical compile).
 */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import type {BuildingFacts} from './facts.ts';
import type {CanalHouseIntent} from './intent.ts';
import {resolveIntent} from './compile.ts';
import {houseFrontRoofFacts, wantsHouseFrontRoof} from './houseFrontRoof.ts';
import {recipeDir} from './recipeFixtures.ts';

// A Bilderdijkstraat cornice house with dormers (scripts/building-recipes/houses/bilder-152363).
const ID = 'bilder-152363';
const load = (id: string) => JSON.parse(fs.readFileSync(`${recipeDir(id)}/intent.json`, 'utf8'));
const intent = (): CanalHouseIntent => resolveIntent(load(ID), load) as CanalHouseIntent;
const facts = (): BuildingFacts => JSON.parse(fs.readFileSync(`${recipeDir(ID)}/facts.json`, 'utf8'));

test('absent roof.source: the same facts object', () => {
  const f = facts(), i = intent();
  assert.equal(wantsHouseFrontRoof(i, f), false);
  assert.equal(houseFrontRoofFacts(i, f).facts, f);
});

test('roof.source front: the roof follows the front, 3DBAG an upper bound only', () => {
  const f = facts(), i = intent();
  i.roof = {...i.roof, source: 'front'};
  const out = houseFrontRoofFacts(i, f);
  assert.notEqual(out.facts, f);
  assert.equal(out.facts.roofSource?.kind, 'front');
  assert.ok(out.facts.roofsRD.length > 0);
  // Forced flat: every band flat at the eaves.
  i.roof = {...i.roof, form: 'flat'};
  const flat = houseFrontRoofFacts(i, f);
  assert.deepEqual(Object.values(flat.facts.roofSource?.forms ?? {}), ['flat']);
});

test('facts a face already roofed are left alone', () => {
  const f = {...facts(), roofSource: {kind: 'front' as const, surveyRoofMaxM: 12, capM: 11}}, i = intent();
  i.roof = {...i.roof, source: 'front'};
  assert.equal(houseFrontRoofFacts(i, f).facts, f);
});
