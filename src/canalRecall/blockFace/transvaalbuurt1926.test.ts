/**
 * Transvaalbuurt 1926-1928 (#155): the Danie Theronstraat band row and the President Steynstraat plain row resolve,
 * compile on the pands they were measured on, and the kit pieces they brought behave:
 * - a mirrored placement of an alternating repeated front (`repeat.mirrored`) lays its modules in the other order;
 * - a ground canopy on a repeated front puts a slab over every module's door;
 * - `bandHeights.headLift` raises the painted head band over the window heads.
 *   node --import tsx --test src/canalRecall/blockFace/transvaalbuurt1926.test.ts
 */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import type {BuildingFacts} from '../buildingRecipe/facts.ts';
import {compileBuilding} from '../buildingRecipe/compile.ts';
import {validateIntent, type CanalHouseIntent} from '../buildingRecipe/intent.ts';
import {mirrorFront, resolvePlacement} from './houseType.ts';
import {defaultTypeLoader} from './typeLibrary.ts';
import {frontageVetoes, scoreType, type MatchableType, type PandEvidence} from './autoPlace.ts';

const facts = (face: string, pand: string): BuildingFacts => JSON.parse(fs.readFileSync(`scripts/block-face/faces/${face}/pands/0363100012${pand}/facts.json`, 'utf8'));
function house(typeId: string, pand: string, street: string, mirror = false): CanalHouseIntent {
  const t = defaultTypeLoader(typeId)!;
  const design = resolvePlacement(t, {type: t.id, ...(mirror ? {mirror} : {})}, street).design;
  return validateIntent({schemaVersion: 1, kind: 'canal-house', id: `t1926-${pand}`, pandId: `0363100012${pand}`, address: street, sources: [{id: 'strip', kind: 'street-panorama', capturedAt: '2020-04-29'}], ...design, notes: []} as CanalHouseIntent);
}
type Built = Awaited<ReturnType<typeof compileBuilding>>;
const elevation = (b: Built) => b.recipe.elevations[0];
const openings = (b: Built, re: RegExp) => elevation(b).openings.value.filter(o => re.test(o.id)).map(o => +o.leftM.toFixed(2)).sort((p, q) => p - q);

test('band row: four storeys under a 24-course parapet, the top storey a ribbon of three between painted bands lifted 0.5 m', () => {
  const f = house('transvaal-1926-band-row', '140487', 'Danie Theronstraat').fronts[0];
  assert.equal(f.storeys, 4);
  assert.deepEqual(f.parapet, {courses: 24, coping: true});
  assert.deepEqual(f.repeat, {count: 'fit', mirrorAlternate: true});
  assert.equal(f.bandHeights?.headLift, 0.5);
  assert.deepEqual(f.bandStoreys, [3]);
  assert.equal(f.storeyRibbons?.last.pier, 0.8);
  assert.equal(f.doorBay, 2);
});

test('mirrorFront: an alternating row is mirrored by its module order, the module itself as authored', () => {
  const f = house('transvaal-1926-band-row', '140487', 'Danie Theronstraat').fronts[0];
  const m = mirrorFront(f);
  assert.deepEqual(m.repeat, {count: 'fit', mirrorAlternate: true, mirrored: true});
  assert.deepEqual(m.bayWidths, f.bayWidths);
  assert.deepEqual(mirrorFront(m).repeat, f.repeat);
  assert.throws(() => mirrorFront({...f, crownAt: {from: 0, to: 0.5}}), /crownAt inside a mirrored type/);
});

test('compile: Danie Theronstraat 29 (6 m) as authored and mirrored, 25-27 (12 m) two mirrored modules; a mirrored even row is the same front', async () => {
  const six = await compileBuilding(house('transvaal-1926-band-row', '140487', 'Danie Theronstraat'), facts('theron-9-37', '140487'));
  const sixM = await compileBuilding(house('transvaal-1926-band-row', '140487', 'Danie Theronstraat', true), facts('theron-9-37', '140487'));
  const w = six.fit.fronts[0].widthM;
  // The stair light (storey 1, axis 3) stands against the right party wall as authored, against the left one mirrored.
  const stair = (b: Built) => elevation(b).openings.value.filter(o => /s1-b2(-m\d)?$/.test(o.id)).map(o => o.leftM + o.widthM / 2);
  assert.ok(stair(six)[0] > w * 0.8, `stair light at ${stair(six)} of ${w} m`);
  assert.ok(stair(sixM)[0] < w * 0.2, `mirrored stair light at ${stair(sixM)} of ${w} m`);
  const twelve = await compileBuilding(house('transvaal-1926-band-row', '139446', 'Danie Theronstraat'), facts('theron-9-37', '139446'));
  const twelveM = await compileBuilding(house('transvaal-1926-band-row', '139446', 'Danie Theronstraat', true), facts('theron-9-37', '139446'));
  const tw = twelve.fit.fronts[0].widthM, lights = stair(twelve);
  assert.equal(lights.length, 2);
  // pair | stair stair | pair: both stair lights meet at the middle.
  for (const x of lights) assert.ok(Math.abs(x - tw / 2) < 1, `stair light at ${x} of ${tw} m`);
  assert.deepEqual(openings(twelveM, /^s\d-b\d-m\d$/), openings(twelve, /^s\d-b\d-m\d$/));
});

test('ground canopy on a repeated front: one slab over each module door; head band 0.5 m over the top-storey heads', async () => {
  const twelve = await compileBuilding(house('transvaal-1926-band-row', '139446', 'Danie Theronstraat'), facts('theron-9-37', '139446'));
  const canopy = twelve.group.getObjectByName('ground-canopy/front0');
  assert.ok(canopy, 'canopy mesh');
  const doors = elevation(twelve).openings.value.filter(o => o.kind === 'door');
  assert.equal(doors.length, 2);
  const bands = elevation(twelve).bands!.value, head = bands.find(b => b.id === 'painted-head-s3')!;
  const tops = elevation(twelve).openings.value.filter(o => /^s3-/.test(o.id)).map(o => o.bottomM + o.heightM);
  assert.ok(Math.abs(head.bottomM - (Math.max(...tops) + 0.5)) < 0.02, `head band at ${head.bottomM}, heads ${Math.max(...tops)}`);
});

test('plain row: President Steynstraat 9 and 11 compile, door left and mirrored; three sash windows a storey over a door and a wide window', async () => {
  for (const [pand, mirror] of [['063929', false], ['073365', true]] as const) {
    const b = await compileBuilding(house('transvaal-1928-plain-row', pand, 'President Steynstraat', mirror), facts('steyn-9-19', pand));
    assert.equal(openings(b, /^s2-b\d$/).length, 3);
    assert.equal(elevation(b).openings.value.filter(o => o.kind === 'door').length, 1);
  }
});

test('match: the 1926 band row admits the 6 m and 12 m stair pands of Danie Theronstraat and vetoes the 4.4 m corner', () => {
  const t = defaultTypeLoader('transvaal-1926-band-row') as unknown as MatchableType;
  const ev = (widthM: number, eavesM: number, builtYear: number) => ({pandId: 'x', address: 'x', builtYear, widthM, eavesM, storeys3dbag: 5, roofMaxM: eavesM + 2, groundUses: [], osm: [], strip: null} as unknown as PandEvidence);
  assert.deepEqual(frontageVetoes(t, ev(6, 13, 1927)), []);
  assert.deepEqual(frontageVetoes(t, ev(12, 13, 1926)), []);
  assert.ok(frontageVetoes(t, ev(4.4, 9.7, 1928)).length);
  assert.ok(scoreType(t, ev(6, 13, 1923)).veto.some(v => /built 1923/.test(v)));
});
