/**
 * Roof schema (2026-10-16): `roof.source` / `form` / `pitchDeg` / `evidence` on a house intent, the placement roof
 * override on a typed house, `continuity.rowCoherence` on a face. Validators reject what the rules cannot read.
 *   node --import tsx --test src/canalRecall/blockFace/roofSchema.test.ts
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import {validateIntent} from '../buildingRecipe/intent.ts';
import {houseIntents, validateBlockFace} from './intent.ts';
import {fileTypeLoader} from './typeLibrary.ts';

const FACES = 'scripts/block-face/faces';
const load = (id: string) => {
  const dir = path.join(FACES, id), members = JSON.parse(fs.readFileSync(path.join(dir, 'discovery.json'), 'utf8')).members;
  return {raw: JSON.parse(fs.readFileSync(path.join(dir, 'intent.json'), 'utf8')), members};
};

test('house intent: roof source/form/pitch/evidence validated; unknown roof fields rejected', () => {
  const {raw, members} = load('kinker-56-84');
  const face = validateBlockFace(raw, members, fileTypeLoader());
  const base = JSON.parse(JSON.stringify(houseIntents(face, fileTypeLoader())[1]));
  assert.doesNotThrow(() => validateIntent({...base, roof: {...base.roof, source: 'front', form: 'saddle', pitchDeg: 55, evidence: 'the strip shows the saddle'}}));
  assert.throws(() => validateIntent({...base, roof: {...base.roof, source: 'lidar'}}), /roof\.source/);
  assert.throws(() => validateIntent({...base, roof: {...base.roof, form: 'dome'}}), /roof\.form/);
  assert.throws(() => validateIntent({...base, roof: {...base.roof, pitchDeg: 5}}), /roof\.pitchDeg: 15\.\.80/);
  assert.throws(() => validateIntent({...base, roof: {...base.roof, evidence: 3}}), /roof\.evidence/);
  assert.throws(() => validateIntent({...base, roof: {...base.roof, ridgeM: 17}}), /roof/);
});

test('typed placement: roof override merges over the type roof; source front needs evidence; a material override needs evidence and a known covering', () => {
  const {raw, members} = load('kinker-315-359');
  const ok = JSON.parse(JSON.stringify(raw));
  ok.houses[2].type.roof = {source: 'front', form: 'saddle', evidence: 'strip pand 3: the neck gable with a saddle behind'};
  const face = validateBlockFace(ok, members, fileTypeLoader());
  const intent = houseIntents(face, fileTypeLoader())[2];
  assert.deepEqual({source: intent.roof.source, form: intent.roof.form}, {source: 'front', form: 'saddle'});
  assert.ok(intent.roof.material, 'the material stays the type\'s');
  const noEvidence = JSON.parse(JSON.stringify(raw));
  noEvidence.houses[2].type.roof = {source: 'front'};
  assert.throws(() => validateBlockFace(noEvidence, members, fileTypeLoader()), /roof\.source front needs evidence/);
  const material = JSON.parse(JSON.stringify(raw));
  material.houses[2].type.roof = {material: 'red-tile'};
  assert.throws(() => validateBlockFace(material, members, fileTypeLoader()), /material or hip override needs evidence/);
  material.houses[2].type.roof = {material: 'tile', evidence: 'orthophoto 2024'};
  assert.throws(() => validateBlockFace(material, members, fileTypeLoader()), /roof\.material/);
  material.houses[2].type.roof = {material: 'red-tile', evidence: 'orthophoto 2024: orange tiles'};
  assert.equal(houseIntents(validateBlockFace(material, members, fileTypeLoader()), fileTypeLoader())[2].roof.material, 'red-tile');
  const unknown = JSON.parse(JSON.stringify(raw));
  unknown.houses[2].type.roof = {ridgeM: 17};
  assert.throws(() => validateBlockFace(unknown, members, fileTypeLoader()), /not a placement roof field/);
  const bad = JSON.parse(JSON.stringify(raw));
  bad.houses[2].type.roof = {pitchDeg: 90};
  assert.throws(() => validateBlockFace(bad, members, fileTypeLoader()), /pitchDeg/);
});

test('continuity.rowCoherence: false or a threshold between 0.2 and 3 m', () => {
  const {raw, members} = load('kinker-315-359');
  for (const v of [false, {thresholdM: 0.8}, undefined]) {
    const c = JSON.parse(JSON.stringify(raw));
    if (v === undefined) delete c.continuity.rowCoherence; else c.continuity.rowCoherence = v;
    assert.doesNotThrow(() => validateBlockFace(c, members, fileTypeLoader()));
  }
  for (const v of [true, {thresholdM: 5}, {thresholdM: '1'}, {}]) {
    const c = JSON.parse(JSON.stringify(raw));
    c.continuity.rowCoherence = v;
    assert.throws(() => validateBlockFace(c, members, fileTypeLoader()), /continuity\.rowCoherence/);
  }
});
