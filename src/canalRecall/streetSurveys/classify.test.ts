// node --import tsx --test src/canalRecall/streetSurveys/classify.test.ts
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {addressRange, liveFor, pandRows, recipeStatus} from './classify.ts';

const chunks = [{id: 'chunk-face-a', pandIds: ['1', '2']}, {id: 'chunk-bilder-x2', pandIds: ['3']}];
const recipes = [{id: 'r1', pandId: '1'}, {id: 'r3', pandId: '3'}, {id: 'r4', pandId: '4'}];

test('live representation follows the runtime: chunks replace per-house specs', () => {
  assert.deepEqual(liveFor('1', chunks, recipes), {live: 'face', drawnBy: 'chunk-face-a'});
  assert.deepEqual(liveFor('3', chunks, recipes), {live: 'chunk', drawnBy: 'chunk-bilder-x2'});
  assert.deepEqual(liveFor('4', chunks, recipes), {live: 'standalone', drawnBy: 'r4'});
  assert.deepEqual(liveFor('9', chunks, recipes), {live: 'generic'});
});

test('a recipe replaced by a face is superseded; one in a post-hoc chunk is not', () => {
  assert.deepEqual(recipeStatus(recipes[0], chunks), {status: 'superseded', drawnBy: 'chunk-face-a'});
  assert.deepEqual(recipeStatus(recipes[1], chunks), {status: 'chunk', drawnBy: 'chunk-bilder-x2'});
  assert.deepEqual(recipeStatus(recipes[2], chunks), {status: 'standalone'});
});

test('held faces are reported only for pands not already drawn by a face', () => {
  const rows = pandRows([{pandId: '9', label: 'S 9', buildYear: 1900}, {pandId: '1', label: 'S 1', buildYear: null}], chunks, recipes, [{id: 'held', status: 'held', pandIds: ['9', '1']}]);
  assert.equal(rows[0].pendingFace, 'held');
  assert.equal(rows[1].pendingFace, undefined);
});

test('address ranges', () => {
  assert.equal(addressRange('B', ['B 122', 'B 134', 'B 128']), 'B 122–134');
  assert.equal(addressRange('B', ['B 7']), 'B 7');
});

test('regression: Bilderdijkstraat 128 (1903 orange brick, pand 156287) is drawn by the 122–134 face, not its stale per-house model', () => {
  const data = JSON.parse(fs.readFileSync('public/canal-drive/street-surveys-data/surveys.json', 'utf8'));
  const street = data.streets.find((s: any) => s.street === 'Bilderdijkstraat');
  const row = street.pandTable.rows.find((r: any) => r.pandId === '0363100012156287');
  assert.equal(row.live, 'face');
  assert.equal(row.drawnBy, 'chunk-face-bilder-081118-155417');
  const recipe = street.recipeHouses.find((r: any) => r.id === 'bilder-156287');
  assert.equal(recipe.status, 'superseded');
  assert.equal(recipe.model, undefined, 'a superseded per-house model must not be shown');
  for (const id of ['bilder-153622', 'bilder-153782', 'bilder-154127']) assert.equal(street.recipeHouses.find((r: any) => r.id === id).status, 'standalone', id);
});
