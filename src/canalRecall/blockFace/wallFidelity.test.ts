/**
 * Wall colour fidelity on the Kinkerstraat odd side (lane kinker-colour-fidelity, 2026-10-14). Named regressions:
 *  - black-painted brick drawn as measured, not lifted to olive: 158968 (Kinkerstraat 31, `paletteOverrides` painted-brick);
 *  - sunlit light brick and grey-brown brick drawn as measured (`wallTint: measured`): 161457 (47), 133467 (63), 156991 (87);
 *  - the crop's exposure (light-trim white point) travels with the measured tint (`tintWhitePoint` extras);
 *  - a white-painted first storey over brick (`paintedStoreys`): 165338 (21), 159971 (23);
 *  - a placement without `paletteOverrides` resolves to its named palette object unchanged (byte-identical).
 *   node --import tsx --test src/canalRecall/blockFace/wallFidelity.test.ts
 */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as T from 'three';
import type {BuildingFacts} from '../buildingRecipe/facts.ts';
import {compileBuilding} from '../buildingRecipe/compile.ts';
import {PAINTED_STOREY_DEPTH_M} from '../buildingRecipe/fit.ts';
import {validateIntent, type CanalHouseIntent} from '../buildingRecipe/intent.ts';
import {groupToBuckets, recipeSlotFor} from '../streetChunks/soup.ts';
import {houseIntents, validateBlockFace} from './intent.ts';
import {resolvePlacement, placementProblems, type HouseTypeIntent} from './houseType.ts';
import {defaultTypeLoader} from './typeLibrary.ts';

const load = (id: string) => {
  const dir = `scripts/block-face/faces/${id}`;
  const face = validateBlockFace(JSON.parse(fs.readFileSync(`${dir}/intent.json`, 'utf8')), JSON.parse(fs.readFileSync(`${dir}/discovery.json`, 'utf8')).members);
  return {face, dir, intents: houseIntents(face)};
};
const build = (id: string, pand: string) => {
  const {face, dir, intents} = load(id), i = intents.findIndex(x => x.pandId.endsWith(pand));
  const facts: BuildingFacts = JSON.parse(fs.readFileSync(`${dir}/pands/${face.houses[i].pandId}/facts.json`, 'utf8'));
  return {intent: intents[i], b: compileBuilding(intents[i], facts)};
};
const wallBuckets = (intent: CanalHouseIntent, g: T.Group) => [...groupToBuckets(g, new T.Matrix4(), recipeSlotFor(intent)).values()].filter(b => b.slot === 'brick');

test('placement paletteOverrides: merged onto the named palette, reported, keys checked; absent = the same palette object', () => {
  const t = defaultTypeLoader('kinker-1890-plain-brick') as HouseTypeIntent;
  const plain = resolvePlacement(t, {type: t.id}, 'Kinkerstraat');
  assert.equal(plain.design.palette, t.palettes[Object.keys(t.palettes)[0]]);
  const over = resolvePlacement(t, {type: t.id, paletteOverrides: {brick: '#282b24', wallMaterial: 'painted-brick'}}, 'Kinkerstraat');
  assert.equal(over.design.palette.brick, '#282b24');
  assert.equal(over.design.palette.wallMaterial, 'painted-brick');
  assert.equal(over.design.palette.frame, plain.design.palette.frame);
  assert.ok(over.deviations.some(d => d.startsWith('palette ')));
  const problems = placementProblems(new Map([[t.id, t]]), [{pandId: '0363100012000001', type: {type: t.id, paletteOverrides: {brick: '#000000', glass: '#111111'} as never}}]);
  assert.ok(problems.some(p => /paletteOverrides\.glass/.test(p)));
});

test('validation: wallTint, whitePoint and paintedStoreys need their partners', () => {
  const {intents} = load('kinker-31-49');
  const base = intents.find(i => i.pandId.endsWith('154359'))!;
  const bad = (palette: object, front: object = {}) => assert.throws(() => validateIntent({...base, palette: {...base.palette, ...palette}, fronts: [{...base.fronts[0], ...front}]}));
  bad({wallTint: 'sunlit'});
  bad({wallTint: 'measured', wallMaterial: 'stucco'});
  bad({whitePoint: '#a1a698'}, {});
  bad({}, {palette: {wallTint: 'measured'}});
  bad({}, {paintedStoreys: {storeys: [0], colour: '#e3e2d7'}});
  bad({}, {paintedStoreys: {storeys: [2, 1], colour: '#e3e2d7'}});
  bad({}, {paintedStoreys: {storeys: [1], colour: 'white'}});
  validateIntent({...base, fronts: [{...base.fronts[0], paintedStoreys: {storeys: [1], colour: '#e3e2d7'}}]});
});

test('Kinkerstraat 31: black paint is a measured painted-brick wall with its exposure, no facing', () => {
  const {intent, b} = build('kinker-31-49', '158968');
  assert.equal(intent.palette.wallMaterial, 'painted-brick');
  assert.equal(intent.fronts[0].palette?.brick, undefined, 'the front facing is gone');
  const walls = wallBuckets(intent, b.group);
  assert.ok(walls.length && walls.every(w => w.tintSource === 'measured' && w.tintWhitePoint === '#a1a698'));
  assert.ok(walls.some(w => w.tint === '#282b24'));
});

test('Kinkerstraat 47, 63, 87: brick walls with wallTint measured export the measured tint and white point', () => {
  for (const [face, pand, hex] of [['kinker-31-49', '161457', '#c09d84'], ['kinker-49-63', '133467', '#78675b'], ['kinker-65-87', '156991', '#74705e']] as const) {
    const {intent, b} = build(face, pand);
    assert.equal(intent.palette.wallTint, 'measured', pand);
    const walls = wallBuckets(intent, b.group);
    assert.ok(walls.some(w => w.tint === hex && w.tintSource === 'measured' && w.tintWhitePoint), `${pand}: measured ${hex}`);
    assert.ok(walls.every(w => w.tintSource === 'measured'), `${pand}: every wall bucket measured`);
  }
});

test('plain brick on the same face stays unmeasured (Kinkerstraat 45)', () => {
  const {intent, b} = build('kinker-31-49', '154359');
  assert.ok(wallBuckets(intent, b.group).every(w => !w.tintSource && !w.tintWhitePoint));
});

test('Kinkerstraat 21 and 23: the first storey is a white-painted facing cut around its four lights, measured paint', () => {
  for (const pand of ['165338', '159971']) {
    const {intent, b} = build('kinker-1-29', pand);
    const paint = intent.fronts[0].paintedStoreys!;
    assert.deepEqual(paint, {storeys: [1], colour: '#e3e2d7'});
    const el = b.recipe.elevations[0], band = el.bands!.value.find(x => x.id === 'painted-storey-s1')!;
    assert.ok(band && band.depthM === PAINTED_STOREY_DEPTH_M && band.surface === 'wall');
    const h = b.fit.fronts[0].storeyHeightsM, base = h[0];
    assert.ok(Math.abs(band.bottomM - base) < 0.05 && Math.abs(band.bottomM + band.heightM - (base + h[1])) < 0.05, `${pand}: band spans storey 1`);
    const lights = el.openings.value.filter(o => /s1-b\d/.test(o.id));
    assert.equal(lights.length, 4);
    const pieces: T.Mesh[] = [];
    b.group.traverse(o => { if (o instanceof T.Mesh && /facadeDetail\/bands\/painted-storey-s1\//.test(o.name)) pieces.push(o); });
    assert.ok(pieces.length >= 5, 'cut around the openings');
    for (const m of pieces) {
      const mat = m.material as T.MeshStandardMaterial;
      assert.equal('#' + mat.color.getHexString(), '#e3e2d7');
      assert.equal(mat.userData.tintSource, 'measured');
    }
    const walls = wallBuckets(intent, b.group);
    assert.ok(walls.some(w => w.tint === '#e3e2d7' && w.tintSource === 'measured'));
    assert.ok(walls.some(w => !w.tintSource), 'the brick above stays unmeasured');
  }
});

test('Kinkerstraat 19: same type without paintedStoreys has no painted facing', () => {
  const {b} = build('kinker-1-29', '158983');
  assert.ok(!b.recipe.elevations[0].bands!.value.some(x => x.id.startsWith('painted-storey')));
});
