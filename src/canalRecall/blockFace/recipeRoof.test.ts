/**
 * Recipe roofs on block faces (`continuity.roof.source = recipe`, 2026-10-10): the user, comparing the
 * Bilderdijkstraat 081118-155417 strip with the model, "we need to discard a fair bit of the 3dbag roof geometry".
 *  - every pand of every face keeps its footprint area exactly through the survey conversion (the library throws
 *    otherwise; slivers from near-collinear outlines broke it on 087959, utrechtse 178874, wallen-oza 177922);
 *  - Bilderdijkstraat 136 (081118): the roof edge ended 0.1 mm past a near-collinear corner and the side wall at the
 *    face's left end lost its closure (an open side);
 *  - a 30 degree pitch with no flat top (marnix-124-138 174914) ordered two knots backwards and overlapped bands.
 *   node --import tsx --test src/canalRecall/blockFace/recipeRoof.test.ts
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import type {BuildingFacts} from '../buildingRecipe/facts.ts';
import {surveyRecipe} from '../../../scripts/canalhouse-recipes/survey-recipe.ts';
import {compileBlockFace, decodePands} from './compile.ts';
import {validateBlockFace} from './intent.ts';
import {recipeRoofFacts} from './recipeRoof.ts';

const FACES = 'scripts/block-face/faces';
const load = (id: string) => {
  const dir = path.join(FACES, id), members = JSON.parse(fs.readFileSync(path.join(dir, 'discovery.json'), 'utf8')).members;
  const face = validateBlockFace(JSON.parse(fs.readFileSync(path.join(dir, 'intent.json'), 'utf8')), members);
  const facts = new Map(face.houses.map(h => [h.pandId, JSON.parse(fs.readFileSync(path.join(dir, 'pands', h.pandId, 'facts.json'), 'utf8')) as BuildingFacts]));
  return {face, facts};
};
const area = (r: number[][]) => Math.abs(r.reduce((s, p, i) => { const q = r[(i + 1) % r.length]; return s + p[0] * q[1] - q[0] * p[1]; }, 0) / 2);

test('recipe roofs partition every installed pand footprint exactly (both pitches)', () => {
  const faces = fs.readdirSync(FACES).filter(f => fs.existsSync(path.join(FACES, f, 'intent.json')) && fs.existsSync(path.join(FACES, f, 'pands')));
  let n = 0;
  for (const face of faces) for (const pand of fs.readdirSync(path.join(FACES, face, 'pands'))) {
    const file = path.join(FACES, face, 'pands', pand, 'facts.json');
    if (!fs.existsSync(file)) continue;
    const f = JSON.parse(fs.readFileSync(file, 'utf8')) as BuildingFacts;
    for (const frontPitchDeg of [70, 30]) {
      const {facts} = recipeRoofFacts(f, {eavesM: f.fronts[0].eavesM, storeyHeightsM: [3, 3, 3], street: f.fronts[0].street}, {frontPitchDeg});
      const s = surveyRecipe({attributes: facts.attributes, roofsRD: facts.roofsRD}, facts.surveyFootprintPolygonsRD, facts.fronts[0].endpointsRD);
      const roof = s.roof.reduce((a: number, r: {polygon: {outer: number[][]}}) => a + area(r.polygon.outer), 0);
      const foot = s.polygons.reduce((a: number, q: {outer: number[][]; holes: number[][][]}) => a + area(q.outer) - q.holes.reduce((t, h) => t + area(h), 0), 0);
      assert.ok(Math.abs(roof - foot) <= Math.max(2e-4, foot * 1e-6), `${face} ${pand} @${frontPitchDeg}: roof ${roof} vs footprint ${foot}`);
      n++;
    }
  }
  assert.ok(n >= 150, `${n} pand/pitch cases`);
});

test('Bilderdijkstraat 081118-155417: recipe roofs drop the 3DBAG ridges, gates pass, side wall closed', async () => {
  const {face, facts} = load('bilder-081118-155417');
  assert.equal(face.continuity.roof?.source, 'recipe');
  const r = await compileBlockFace(face, facts, 'face-recipe-roof-test', {inferRears: false});
  assert.deepEqual(r.gates.filter(g => !g.pass), []);
  const recipe = new Map((r.recipeRoofs ?? []).map(x => [x.pandId, x]));
  assert.equal(recipe.size, face.houses.length);
  // The three gabled houses and the two behind them carried 3DBAG ridges and rear volumes up to 19.7 m.
  for (const id of ['0363100012156287', '0363100012156286', '0363100012155418']) {
    const p = r.perPand.find(x => x.pand === id)!;
    assert.ok(p.roofMaxM <= p.roofMaxFactsM - 1, `${id}: model ${p.roofMaxM} vs 3DBAG ${p.roofMaxFactsM}`);
  }
  for (const x of recipe.values()) assert.ok(x.ridgeM >= x.eavesM && x.ridgeM <= x.capM + 1e-6, `${x.pandId} ridge within eaves..cap`);
  // Bilderdijkstraat 136 side wall at the face's left end: walls facing -x up to the roof, not an open side.
  const i = face.houses.findIndex(h => h.pandId.endsWith('081118'));
  const tris = (await decodePands(r.chunk.glb, face.houses.length))[i];
  // Sample the wall where the hole was (z -19.4..-10.2, up to 13 m): every point lies in a -x facing triangle.
  const side = tris.filter((t: {p: number[][]; n: number[]}) => t.n[0] < -0.9 && t.p.every(v => v[0] < -23.2)).map((t: {p: number[][]}) => t.p.map(v => [v[2], v[1]]));
  const inside = (q: number[], t: number[][]) => { const s0 = (a: number[], b: number[]) => (b[0] - a[0]) * (q[1] - a[1]) - (b[1] - a[1]) * (q[0] - a[0]); const d = [s0(t[0], t[1]), s0(t[1], t[2]), s0(t[2], t[0])]; return d.every(x => x >= -1e-6) || d.every(x => x <= 1e-6); };
  const open: number[][] = [];
  for (let z = -19.2; z <= -10.4; z += 0.4) for (let y = 4; y <= 13; y += 0.5) if (!side.some(t => inside([z, y], t))) open.push([z, y]);
  assert.deepEqual(open, [], 'Bilderdijkstraat 136 side wall closed');
});

test('a face without continuity.roof keeps the 3DBAG roof (no recipe roofs)', async () => {
  const {face, facts} = load('bilder-080336-090492');
  assert.equal(face.continuity.roof, undefined);
  const r = await compileBlockFace(face, facts, 'face-survey-roof-test', {inferRears: false});
  assert.equal(r.recipeRoofs, undefined);
});
