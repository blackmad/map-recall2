// Belt builder lane (Grachtengordel-West, 2026-11-10): the front roof for a recipe house compiled alone, and a block-face
// house as a hand HouseSpec (houseSpec/fromFace.ts). Both are opt-in: absent, nothing changes.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {houseFrontRoof} from './houseRoof.ts';
import {houseIntents, validateBlockFace} from './intent.ts';
import {fromBlockFace} from '../houseSpec/adapters.ts';
import {specFromFace} from '../houseSpec/fromFace.ts';
import {specProblems} from '../houseSpec/spec.ts';
import {toRecipe} from '../houseSpec/toRecipe.ts';
import type {BuildingFacts} from '../buildingRecipe/facts.ts';

const FACE = 'scripts/block-face/faces/herengracht-84-148-r1';
const face = validateBlockFace(JSON.parse(readFileSync(`${FACE}/intent.json`, 'utf8')));
const PAND = '0363100012175699'; // Herengracht 94A: a frieze-cornice front whose 3DBAG roof drew a red hip over the cornice
const facts: BuildingFacts = JSON.parse(readFileSync(`${FACE}/pands/${PAND}/facts.json`, 'utf8'));
const intent = houseIntents(face).find(i => i.pandId === PAND)!;

test('houseFrontRoof: no roof.source "front" = the very same facts object (byte-identical compile)', () => {
  assert.equal(intent.roof.source, undefined);
  const r = houseFrontRoof(intent, facts);
  assert.equal(r.facts, facts);
  assert.equal(r.report, null);
});

test('houseFrontRoof: Herengracht 94A with roof.source front + form flat draws no roof over the cornice', () => {
  const r = houseFrontRoof({...intent, roof: {...intent.roof, source: 'front', form: 'flat'}}, facts);
  assert.equal(r.report?.form, 'flat');
  assert.equal(r.facts.roofSource?.kind, 'front');
  // the flat top stands at the fitted eaves, metres under 3DBAG's hip (surveyed 3DBAG max over the ground)
  assert.ok(r.report!.ridgeM < r.report!.surveyMaxM - 0.5, `${r.report!.ridgeM} vs ${r.report!.surveyMaxM}`);
});

test('houseFrontRoof: facts that already carry a generated roof are left alone (a block face replaced it)', () => {
  const once = houseFrontRoof({...intent, roof: {...intent.roof, source: 'front', form: 'flat'}}, facts).facts;
  assert.equal(houseFrontRoof({...intent, roof: {...intent.roof, source: 'front', form: 'flat'}}, once).facts, once);
});

test('specFromFace: every face field keeps its own receipt; no fixes = the face design, recipe route', () => {
  const base = fromBlockFace(face, PAND)!, spec = specFromFace(base);
  assert.deepEqual(spec.design, base.design);
  assert.equal(spec.provenance[''], undefined);
  assert.equal(spec.provenance['fronts/0/gable'].source, 'streetlevel-measured');
  assert.equal(spec.provenance['roof/material'].ref, base.provenance[''].ref);
  assert.deepEqual(specProblems(spec), []);
  assert.ok(toRecipe(spec));
});

test('specFromFace: fixes are author fields with the reason; drop removes a face field', () => {
  const base = fromBlockFace(face, PAND)!;
  const spec = specFromFace(base, {ref: 'strip herengracht-84-148 2021-01-25', at: '2021-01-25', fields: {'roof/source': 'front', 'roof/form': 'flat'},
    why: {'roof/form': 'no roof face over the cornice'}, drop: ['roof/squareSaddle'], limits: [{component: 'gable ornament', what: 'carved crest'}]});
  assert.equal(spec.design.roof?.form, 'flat');
  assert.equal(spec.provenance['roof/form'].source, 'author');
  assert.match(spec.provenance['roof/form'].ref, /no roof face over the cornice/);
  assert.equal(spec.design.roof?.squareSaddle, undefined);
  assert.equal(spec.provenance['roof/squareSaddle'], undefined);
  assert.deepEqual(spec.schemaLimits?.at(-1), {component: 'gable ornament', what: 'carved crest'});
  assert.ok(toRecipe(spec));
});
