/**
 * Transvaalbuurt library (scripts/block-face/types/transvaalbuurt; issue #149): the 1923 portiek types resolve with the
 * dark parapet band and the stair tower / raised panel over the centre axis, and compile on the Albert Luthulistraat
 * pands they were measured on (run face luthuli-21-41-r1), the tower type also mirrored (37-39).
 *   node --import tsx --test src/canalRecall/blockFace/transvaalbuurt.test.ts
 */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import type {BuildingFacts} from '../buildingRecipe/facts.ts';
import {compileBuilding} from '../buildingRecipe/compile.ts';
import {validateIntent, type CanalHouseIntent} from '../buildingRecipe/intent.ts';
import {resolvePlacement} from './houseType.ts';
import {defaultTypeLoader} from './typeLibrary.ts';

const facts = (pand: string): BuildingFacts => JSON.parse(fs.readFileSync(`scripts/block-face/faces/luthuli-21-41-r1/pands/0363100012${pand}/facts.json`, 'utf8'));
function house(typeId: string, pand: string, mirror = false): CanalHouseIntent {
  const t = defaultTypeLoader(typeId)!;
  const design = resolvePlacement(t, {type: t.id, ...(mirror ? {mirror} : {})}, 'Albert Luthulistraat').design;
  return validateIntent({schemaVersion: 1, kind: 'canal-house', id: `luthuli-${pand}`, pandId: `0363100012${pand}`, address: 'Albert Luthulistraat', sources: [{id: 'strip', kind: 'street-panorama', capturedAt: '2017-04-06'}], ...design, notes: []} as CanalHouseIntent);
}

test('types: parapet band with dentils, a tower over the stair axis, five axes with the stair light on the middle one', () => {
  for (const [id, rise] of [['transvaal-1923-portiek-tower', 1.44], ['transvaal-1923-portiek', 0.65]] as const) {
    const f = house(id, '126814').fronts[0];
    assert.deepEqual(f.parapet?.band, {courses: 5, dentils: {pitch: 0.5, courses: 2}});
    assert.deepEqual(f.tower?.bays, {from: 1, to: 3});
    assert.equal(f.tower?.rise, rise);
    assert.equal(f.axisGrid, 5);
    assert.equal(f.axisWindows?.['2'], 'plain');
  }
});

test('compile: 29-31 (tower), 33-35 (raised panel), 37-39 (tower, mirrored)', async () => {
  for (const [id, pand, mirror] of [['transvaal-1923-portiek-tower', '142206', false], ['transvaal-1923-portiek', '126814', false], ['transvaal-1923-portiek-tower', '128866', true]] as const) {
    const built = await compileBuilding(house(id, pand, mirror), facts(pand));
    assert.ok(built.group.children.length > 0, `${id} on ${pand}`);
  }
});
