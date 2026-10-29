/**
 * Oud-West kit (#98), named regressions.
 *
 * Kinkerstraat 33-47 (kinker-31-49, 1885-1886): the 2024 orthophoto shows each house under a saddle ridged front to
 * back, hipped down behind the cornice under its dormer; the strip (2024-12-11) shows only the tile edge over the
 * cornice. The 70 degree attic drew a 2 m slate band over every cornice. `roof: {form: saddle, hip: front, pitchDeg}`.
 *
 * Kinkerstraat 60-62 (kinker-56-84, 1893): brick wall dormers over the cornice between the gables, drawn in the wall
 * colour (`dormerBody: "brick"`); Kinkerstraat 66: a white stone dormer, not a step gable (2023-01-10 strip).
 *   node --import tsx --test src/canalRecall/blockFace/oudWestKit.test.ts
 */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import type {BuildingFacts} from '../buildingRecipe/facts.ts';
import {validateIntent} from '../buildingRecipe/intent.ts';
import {validateBlockFace, type BlockFaceIntent} from './intent.ts';
import {compileBlockFace, type StripScale} from './compile.ts';
import {fitIntent} from '../buildingRecipe/fit.ts';
import type {CanalHouseIntent} from '../buildingRecipe/intent.ts';
import {resolvePlacement} from './houseType.ts';
import {defaultTypeLoader} from './typeLibrary.ts';

const load = (id: string) => {
  const dir = `scripts/block-face/faces/${id}`, raw = JSON.parse(fs.readFileSync(`${dir}/intent.json`, 'utf8'));
  const face: BlockFaceIntent = validateBlockFace(raw, JSON.parse(fs.readFileSync(`${dir}/discovery.json`, 'utf8')).members);
  const facts = new Map<string, BuildingFacts>(face.houses.map(h => [h.pandId, JSON.parse(fs.readFileSync(`${dir}/pands/${h.pandId}/facts.json`, 'utf8'))]));
  const s = JSON.parse(fs.readFileSync(`${dir}/strip.json`, 'utf8')), strip: StripScale = {heightPx: s.height, pixelsPerMetre: s.pixelsPerMetre, groundNAP: s.groundNAP};
  return {raw, face, facts, strip};
};

test('roof.hip: front only, with form saddle and a measured pitch', () => {
  const base = JSON.parse(fs.readFileSync('scripts/building-recipes/houses/' + fs.readdirSync('scripts/building-recipes/houses').find(d => fs.existsSync(`scripts/building-recipes/houses/${d}/intent.json`) && JSON.parse(fs.readFileSync(`scripts/building-recipes/houses/${d}/intent.json`, 'utf8')).kind === 'canal-house') + '/intent.json', 'utf8'));
  assert.doesNotThrow(() => validateIntent({...base, roof: {...base.roof, form: 'saddle', hip: 'front', pitchDeg: 35}}));
  assert.throws(() => validateIntent({...base, roof: {...base.roof, form: 'saddle', hip: 'back', pitchDeg: 35}}), /roof\.hip/);
  assert.throws(() => validateIntent({...base, roof: {...base.roof, hip: 'front', pitchDeg: 35}}), /roof\.hip: needs form "saddle"/);
  assert.throws(() => validateIntent({...base, roof: {...base.roof, form: 'saddle', hip: 'front'}}), /measured pitchDeg/);
});

test('Kinkerstraat 33-47: hipped saddles behind the cornice, ridged front to back, under the 3DBAG max; 31 and 49 keep their attics', async () => {
  const {face, facts, strip} = load('kinker-31-49');
  const r = await compileBlockFace(face, facts, 'face-oudwest-hip-test', {strip});
  assert.deepEqual(r.gates.filter(g => !g.pass).map(g => `${g.pand}/${g.id}`), []);
  const roofs = new Map((r.recipeRoofs ?? []).map(x => [x.pandId.slice(-6), x]));
  for (const p of ['160646', '155369', '160073', '160074', '167106', '159384', '154359', '161457']) {
    const rep = roofs.get(p)!, band = rep.bands?.[0];
    assert.ok(band && band.form === 'saddle' && band.hip === 'front', `${p}: ${JSON.stringify(band)}`);
    assert.equal(band.sideEavesM, band.eavesM, `${p}: the saddle's sides sit on the eaves at the party walls`);
    assert.ok(band.ridgeM - band.eavesM > 1.5 && band.ridgeM <= rep.surveyMaxM + 1e-6, `${p}: ridge ${band.ridgeM} over eaves ${band.eavesM}, 3DBAG max ${rep.surveyMaxM}`);
  }
  for (const p of ['158968', '157926']) assert.equal(roofs.get(p)?.bands?.[0]?.hip, undefined, `${p} has no hip`);
});

test('dormer body brick: cheeks, back and pointed front in the wall colour; frame stays trim; stone and absent unchanged', () => {
  const t = defaultTypeLoader('kinker-1886-neo-renaissance')!;
  const f: BuildingFacts = JSON.parse(fs.readFileSync('scripts/block-face/faces/kinker-56-84/pands/0363100012236441/facts.json', 'utf8'));
  const dormersOf = (crown: string, edit?: (x: Record<string, unknown>) => void) => {
    const design = resolvePlacement(t, {type: t.id, crown}, 'Kinkerstraat').design;
    if (edit) design.fronts.forEach(edit as never);
    const h = validateIntent({schemaVersion: 1, kind: 'canal-house', id: 'kinker-236441', pandId: '0363100012236441', address: 'Kinkerstraat 60', sources: [{id: 'strip', kind: 'street-panorama', capturedAt: '2023-01-10'}], ...design, notes: []} as CanalHouseIntent);
    return fitIntent(h, f).recipe.elevations[0].dormers!.value;
  };
  const brick = dormersOf('wall-dormer');
  assert.ok(brick.length === 1 && brick[0].wallSurface === 'wall' && brick[0].roofRiseM >= 0.8, JSON.stringify(brick));
  assert.equal(brick[0].heightM, 1.8);
  assert.equal(dormersOf('stone-dormer')[0].wallSurface, 'stone');
  assert.equal(dormersOf('stone-dormer', x => { delete x.dormerBody; })[0].wallSurface, 'trim');
});

test('Kinkerstraat 56-84: wall dormers on 60 and 62, a stone dormer on 66, gates pass', async () => {
  const {face, facts, strip} = load('kinker-56-84');
  const r = await compileBlockFace(face, facts, 'face-oudwest-dormer-test', {strip});
  assert.deepEqual(r.gates.filter(g => !g.pass).map(g => `${g.pand}/${g.id}`), []);
  const crowns = (pand: string) => (face.houses.find(h => h.pandId.endsWith(pand))!.type as {modules: {crown?: string}[]}).modules.map(m => m.crown);
  assert.deepEqual(crowns('236441').slice(0, 2), ['wall-dormer', 'wall-dormer']);
  assert.equal(crowns('236325')[0], 'stone-dormer');
});
