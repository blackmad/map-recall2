/**
 * Dark parapet band (`parapet.band`, buildingRecipe/parapetBand.ts; Transvaalbuurt, issue #149): the band under the
 * coping, its dentils, the gap over a tower and the band under the tower top; validation.
 *   node --import tsx --test src/canalRecall/buildingRecipe/parapetBand.test.ts
 */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parapetBandBlocks, parapetBandProblems, PARAPET_BAND} from './parapetBand.ts';

const id = (k: number, x: number) => k * 6 + x;
const flip = (x: number) => x;

test('band under the coping across the module, dentils evenly at its foot', () => {
  const blocks = parapetBandBlocks({courses: 10, dentils: {pitch: 1, courses: 2}}, {count: 1, mw: 6, eaves: 14, copingM: 0.1, tower: null, place: id, flipX: flip});
  const band = blocks.find(b => b.id === 'parapet-band-m0')!;
  assert.equal(band.bottomM, 13.35);
  assert.equal(band.heightM, 0.55);
  assert.equal(band.widthM, 6);
  assert.equal(band.surface, 'accent');
  assert.equal(band.depthM, PARAPET_BAND.depthM);
  const dentils = blocks.filter(b => b.id.startsWith('parapet-dentil'));
  assert.equal(dentils.length, 6);
  assert.deepEqual(dentils.map(d => d.leftM), [0.25, 1.25, 2.25, 3.25, 4.25, 5.25]);
  for (const d of dentils) { assert.equal(d.widthM, 0.5); assert.ok(Math.abs(d.bottomM + d.heightM - band.bottomM - 0.002) < 1e-6); }
});

test('a tower span breaks the band; the tower top carries its own', () => {
  const blocks = parapetBandBlocks({courses: 8}, {count: 2, mw: 5, eaves: 12, copingM: 0, tower: {span: [2, 3], top: 15}, place: (k, x) => k * 5 + x, flipX: flip});
  assert.equal(blocks.length, 6);
  const t = blocks.filter(b => b.id.endsWith('-t'));
  assert.deepEqual(t.map(b => [b.leftM, b.widthM, b.bottomM]), [[2.005, 0.99, 14.56], [7.005, 0.99, 14.56]]);
  const l = blocks.find(b => b.id === 'parapet-band-m1-l')!;
  assert.deepEqual([l.leftM, l.widthM, l.bottomM], [5, 2, 11.56]);
});

test('validation: courses within the parapet, dentils shape, band brick', () => {
  assert.deepEqual(parapetBandProblems({courses: 10}, 14, '#2a2624', 'f'), []);
  assert.match(parapetBandProblems({courses: 20}, 14, '#2a2624', 'f')[0], /at most the parapet/);
  assert.match(parapetBandProblems({courses: 10, dentils: {pitch: 1, courses: 6}}, 14, '#2a2624', 'f')[0], /pass the parapet/);
  assert.match(parapetBandProblems({courses: 10, dentils: {pitch: 0.1, courses: 2}}, 14, '#2a2624', 'f')[0], /dentils/);
  assert.match(parapetBandProblems({courses: 10}, 14, undefined, 'f')[0], /palette.band/);
  assert.match(parapetBandProblems({courses: 10, colour: 'black'}, 14, '#000000', 'f')[0], /\{courses/);
});
