/**
 * Composition ownership: one massing per landmark, no outline-vs-part fight.
 */

import assert from 'node:assert/strict';
import {
  compositionDrawIds,
  isHandMappedComposition,
  selectRenderableBuildings,
  type CompositionFeature,
} from '../src/canalRecall/buildingComposition.js';
import { type Ring } from '../src/canalRecall/buildingGeometry.js';
import { bagHeightM, TOWER_PODIUM_GAP_M } from '../src/canalRecall/bag3dCityJson.js';
import { lod1HeightM } from '../src/canalRecall/bag3dTiles.js';

const square = (x: number, y: number, size: number): Ring =>
  [[x, y], [x + size, y], [x + size, y + size], [x, y + size], [x, y]];

const feature = (
  id: string,
  ring: Ring,
  heightM: number,
  minHeightM = 0,
  isPart = false,
): CompositionFeature => ({ osmId: id, rings: [ring], heightM, minHeightM, isPart });

// Lone outline is not a composition.
assert.equal(isHandMappedComposition([feature('w1', square(0, 0, 1), 12)]), false);

// Stacked part is always a composition.
assert.equal(
  isHandMappedComposition([
    feature('w1', square(0, 0, 1), 12),
    feature('w2', square(0.2, 0.2, 0.3), 20, 12, true),
  ]),
  true,
);

// Multi-height parts without min_height (Oude Kerk / Magna Plaza class).
const church = [
  feature('outline', square(0, 0, 1), 9, 0, false),
  feature('nave', square(0.1, 0.1, 0.6), 23, 0, true),
  feature('tower', square(0.7, 0.7, 0.2), 40, 0, true),
];
assert.equal(isHandMappedComposition(church), true);
assert.deepEqual(compositionDrawIds(church).sort(), ['nave', 'tower'], 'parent outline is dropped when parts exist');

// Without part tags, a container with two differently-tall children is still an outline.
const inferred = [
  feature('shell', square(0, 0, 1), 8),
  feature('a', square(0.1, 0.1, 0.3), 12),
  feature('b', square(0.55, 0.55, 0.3), 28),
];
assert.deepEqual(compositionDrawIds(inferred).sort(), ['a', 'b']);

// selectRenderableBuildings keeps ordinary houses and strips composition shells.
const houses = [
  feature('house', square(4, 4, 0.2), 10),
  ...church.map(part => ({
    ...part,
    rings: part.rings.map(ring => ring.map(([lng, lat]) => [lng + 10, lat + 10] as [number, number])),
  })),
];
const kept = selectRenderableBuildings(houses, feature =>
  houses.filter(other => other.osmId !== feature.osmId && other.rings[0][0][0] > 9 === feature.rings[0][0][0] > 9),
);
assert.ok(kept.some(f => f.osmId === 'house'));
assert.ok(!kept.some(f => f.osmId === 'outline'));
assert.ok(kept.some(f => f.osmId === 'nave'));

// Tower-on-podium: ridge 40 m above a 20 m LoD1.2 height.
const tower = bagHeightM({
  b3_h_maaiveld: 0,
  b3_h_dak_70p: 20,
  b3_h_nok: 20 + TOWER_PODIUM_GAP_M + 5,
});
assert.equal(tower.source, 'ridge-tower');
assert.equal(tower.heightM, 35);

const ordinary = bagHeightM({ b3_h_maaiveld: 0, b3_h_dak_70p: 12, b3_h_nok: 14 });
assert.equal(ordinary.source, 'roof-70p');
assert.equal(ordinary.heightM, 12);

const tilesTower = lod1HeightM({
  bagId: 'x',
  status: '',
  constructionYear: null,
  storeys: null,
  groundHeightNap: 0,
  ridgeHeightNap: 45,
  roofType: null,
  groundAreaM2: 1000,
  flatRoofAreaM2: null,
  slopedRoofAreaM2: null,
  partyWallAreaM2: null,
  volumeLod12M3: 20_000, // 20 m average
  volumeLod22M3: null,
  rmseLod22: null,
  validityLod22: '',
  pointCloudInsufficient: false,
});
assert.equal(tilesTower.source, 'ridge-tower');
assert.equal(tilesTower.heightM, 45);

process.stdout.write('Building composition and tower-height checks passed\n');
