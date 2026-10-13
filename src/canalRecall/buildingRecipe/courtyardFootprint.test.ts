import {test} from 'node:test';
import assert from 'node:assert/strict';
import {decodeThreeDBag, type CityJsonItem} from './facts.ts';
import {footprintIoU} from './gates.ts';
import type {BuildingFacts} from './facts.ts';

// A 20 x 20 m block with a 6 x 6 m courtyard, as 3DBAG LoD0 (outer ring + hole in one surface) and LoD2.2 ground.
const item: CityJsonItem = {
  metadata: {transform: {scale: [1, 1, 1], translate: [0, 0, 0]}},
  feature: {
    vertices: [[0, 0, 0], [20, 0, 0], [20, 20, 0], [0, 20, 0], [7, 7, 0], [7, 13, 0], [13, 13, 0], [13, 7, 0]],
    CityObjects: {b: {type: 'Building', attributes: {b3_h_maaiveld: 0}, geometry: [
      {lod: '0', type: 'MultiSurface', boundaries: [[[0, 1, 2, 3], [4, 5, 6, 7]]]},
      {lod: '2.2', type: 'Solid', boundaries: [[[[0, 1, 2, 3], [4, 5, 6, 7]]]], semantics: {surfaces: [{type: 'GroundSurface'}], values: [[0]]}},
    ]}},
  },
};

test('LoD0 courtyard holes are kept so the footprint gate sees the same shape as the LoD2.2 ground', () => {
  const d = decodeThreeDBag(item);
  assert.equal(d.bag.length, 2, 'outer ring and the courtyard');
  assert.equal(d.ground[0].length, 2);
  const facts = {bagFootprintRD: d.bag} as unknown as BuildingFacts;
  const ground = d.ground[0].map(r => r.map(([x, y]) => [x, -y])); // model frame: x east, z south, anchor (0, 0)
  assert.ok(footprintIoU(facts, ground, [0, 0]) > 0.99);
});
