/**
 * FH pin for the single-house front roof (houseFrontRoof.ts, belt-jordaan #366; pin added by lane recipe-front-roof 2026-11-12). Frederik Hendrikstraat
 * 142 (0363100012152966, FH lane hendrik-134-154): the strips show only the pediment dormer and a low slate band over the
 * heavy cornice (`roof: {source: front, rise: 0.25, pitchDeg: 45}`), but the recipe route kept the 3DBAG LoD2.2 roof,
 * 3.6 m of slate over a 13.5 m cornice. Fixtures: the face's facts.json and the resolved spec intent (`toRecipe`, minus
 * the FH lane's `wallAnchors.colour`, which main does not have yet).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {compileBuilding} from './compile.ts';
import {fitIntent} from './fit.ts';
import {validateIntent, type CanalHouseIntent} from './intent.ts';
import type {BuildingFacts} from './facts.ts';
import {houseFrontRoofFacts, pandRoofFacts} from './houseFrontRoof.ts';
const withFrontRoof = (i: CanalHouseIntent, f: BuildingFacts) => houseFrontRoofFacts(i, f).facts;

const read = (f: string) => JSON.parse(fs.readFileSync(path.join(import.meta.dirname, 'fixtures', f), 'utf8'));
const facts = read('fh-152966-facts.json') as BuildingFacts;
const intent = validateIntent(read('fh-152966-intent.json')) as CanalHouseIntent;
const roofTop = (f: BuildingFacts) => Math.max(...f.roofsRD.flatMap(r => r.vertices.map(v => v[2]))) - f.heights.groundNAP;

test('FH 152966: the recipe roof crown sits at the front-measured height, not 3DBAG', () => {
  const survey = fitIntent(intent, facts), f0 = survey.report.fronts[0];
  const built = compileBuilding(intent, facts);
  assert.equal(built.facts.roofSource?.kind, 'front');
  assert.deepEqual(built.facts.roofSource?.forms, {front0: 'attic'});
  // rise 0.25 x the top storey (3.0 m) over the 13.52 m cornice = 14.27 m; 3DBAG's LoD2.2 stands at 17.16 m.
  const front = f0.eavesM + 0.25 * f0.storeyHeightsM!.at(-1)!;
  assert.ok(Math.abs(f0.eavesM - 13.52) < 0.02, `eaves ${f0.eavesM}`);
  assert.ok(Math.abs(roofTop(built.facts) - front) < 0.02, `roof top ${roofTop(built.facts)} vs front ${front}`);
  assert.ok(roofTop(survey.facts) > front + 2.5, `3DBAG roof ${roofTop(survey.facts)}`);
});

test('FH 152966: the recipe route shares the block-face roof (pandRoofFacts, no face options)', () => {
  assert.deepEqual(withFrontRoof(intent, facts), pandRoofFacts(intent, facts, 'front').facts);
});

test('front roof: absent, 3dbag or an already roofed fact set pass through unchanged', () => {
  const {source: _s, ...rest} = intent.roof;
  for (const roof of [rest, {...rest, source: '3dbag' as const}]) assert.equal(withFrontRoof({...intent, roof}, facts), facts);
  const roofed = withFrontRoof(intent, facts);
  assert.equal(withFrontRoof(intent, roofed), roofed);
  // Without the field the compile is the survey fit.
  assert.deepEqual(compileBuilding({...intent, roof: rest}, facts).facts, fitIntent({...intent, roof: rest}, facts).facts);
});

test('a corner house alone: the front roof falls to its other street too (sideFronts, shared with the face compile)', async () => {
  const {resolveIntent} = await import('./compile.ts');
  const {recipeDir} = await import('./recipeFixtures.ts');
  const ID = 'leidsestraat-67-kerkstraat-50', load = (id: string) => JSON.parse(fs.readFileSync(`${recipeDir(id)}/intent.json`, 'utf8'));
  const corner = resolveIntent(load(ID), load) as CanalHouseIntent, f = JSON.parse(fs.readFileSync(`${recipeDir(ID)}/facts.json`, 'utf8')) as BuildingFacts;
  corner.roof = {...corner.roof, source: 'front'};
  const r = houseFrontRoofFacts(corner, f).report!;
  assert.ok(new Set(corner.fronts.map(x => x.street)).size > 1);
  assert.ok(r.notes.some(n => /^falls to .* a hip at the corner$/.test(n)), r.notes.join('; '));
});
