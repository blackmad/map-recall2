/**
 * Oud-West kit (#98), named regressions.
 *
 * Kinkerstraat 33-47 (kinker-31-49, 1885-1886): the 2024 orthophoto shows each house under a saddle ridged front to
 * back, hipped down behind the cornice under its dormer; the strip (2024-12-11) shows only the tile edge over the
 * cornice. The 70 degree attic drew a 2 m slate band over every cornice. `roof: {form: saddle, hip: front, pitchDeg}`.
 *   node --import tsx --test src/canalRecall/blockFace/oudWestKit.test.ts
 */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import type {BuildingFacts} from '../buildingRecipe/facts.ts';
import {validateIntent} from '../buildingRecipe/intent.ts';
import {validateBlockFace, type BlockFaceIntent} from './intent.ts';
import {compileBlockFace, type StripScale} from './compile.ts';

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
