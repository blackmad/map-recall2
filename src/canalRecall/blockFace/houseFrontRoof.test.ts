/**
 * roof.form / roof.source 'front' on a canal-house intent compiled alone (houseFrontRoof.ts), #356.
 * Pinned case: Haarlemmerdijk 6 (176172), a frieze cornice front whose 3DBAG roof (max 11.84 m over a 10.9 m cornice) drew a hip
 * above the cream cornice where the 2022-12-15 strip shows sky.
 *   node --import tsx --test src/canalRecall/blockFace/houseFrontRoof.test.ts
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import type {BuildingFacts} from '../buildingRecipe/facts.ts';
import {fitIntent} from '../buildingRecipe/fit.ts';
import type {CanalHouseIntent} from '../buildingRecipe/intent.ts';
import {toRecipe} from '../houseSpec/toRecipe.ts';
import {withFrontRoof, wantsFrontRoof} from '../buildingRecipe/houseFrontRoof.ts';

const PAND = '0363100012176172';
const read = <T>(p: string) => JSON.parse(fs.readFileSync(p, 'utf8')) as T;
const facts = () => read<BuildingFacts>(`scripts/block-face/faces/haarlemmerdijk-2-58-r2/pands/${PAND}/facts.json`);
const intent = () => toRecipe(read(`scripts/house-specs/specs/${PAND}.json`))!;
const without = (i: CanalHouseIntent): CanalHouseIntent => { const {source: _s, form: _f, ...roof} = i.roof; return {...i, roof}; };

test('the pinned spec asks for a front roof', () => {
  assert.equal(intent().roof.form, 'flat');
  assert.equal(wantsFrontRoof(intent()), true);
  assert.equal(wantsFrontRoof(without(intent())), false);
  assert.equal(wantsFrontRoof({...intent(), roof: {...intent().roof, source: '3dbag', form: undefined}}), false);
});

test('without roof.form and roof.source the facts come back untouched (byte-identical)', () => {
  const f = facts();
  const plain = (i: CanalHouseIntent): CanalHouseIntent => ({...without(i), fronts: i.fronts.map(({eavesHeight: _e, ...fr}) => fr)});
  assert.equal(withFrontRoof(plain(intent()), f), f);
  const marked = {...f, roofSource: {kind: 'front' as const, surveyRoofMaxM: 1, capM: 1}};
  assert.equal(withFrontRoof({...plain(intent()), roof: intent().roof}, marked), marked);
});

const roofTop = (f: BuildingFacts) => Math.max(...f.roofsRD.flatMap(r => r.vertices.map(v => v[2] - f.heights.groundNAP)));

test('Haarlemmerdijk 6: the pinned eaves line is the facade top (FrontIntent.eavesHeight), 3DBAG read the rear roof', () => {
  const i = intent(), f = facts();
  assert.equal(i.fronts[0].eavesHeight, 11);
  assert.ok(fitIntent(without({...i, fronts: [{...i.fronts[0], eavesHeight: undefined}]}), f).report.fronts[0].eavesM < 9.5, '3DBAG 10th percentile');
  assert.equal(fitIntent(i, withFrontRoof(i, f)).report.fronts[0].eavesM, 11);
});

test('Haarlemmerdijk 6: the roof stands no higher than the cornice line, not 3DBAG max', () => {
  const f = facts(), i = intent();
  const after = withFrontRoof(i, f);
  assert.ok(roofTop(f) > 11.5, `3DBAG roof ${roofTop(f)}`);
  assert.equal(after.roofSource?.kind, 'front');
  assert.ok(roofTop(after) <= 11 + 0.3, `front roof ${roofTop(after)} vs the 11.0 m cornice`);
  assert.ok(after.roofsRD.length > 0);
});

test('eavesHeight alone changes only measuredEavesM', () => {
  const i = without(intent()), f = facts(), g = withFrontRoof(i, f);
  assert.deepEqual({...g, measuredEavesM: undefined}, {...f, measuredEavesM: undefined});
  assert.equal(g.measuredEavesM?.[i.fronts[0].id], 11);
  assert.equal(withFrontRoof({...i, fronts: [{...i.fronts[0], eavesHeight: undefined}]}, f), f);
});
