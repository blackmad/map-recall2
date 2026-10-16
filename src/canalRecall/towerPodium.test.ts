import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { readBagBuildings, type BagBuilding, type CityJson } from './bag3dCityJson.js';
import { mergeFaces, polygonAreaM2, splitTowerPodium, towerFeatureId, towerTileFeature, TOWER_MIN_AREA_M2, TOWER_WHOLE_SHARE, type RdPolygon } from './towerPodium.js';

// 3DBAG v20250903, cut to LoD0 + LoD1.3 (scratch cutter recorded in the fixture's metadata).
const city = JSON.parse(readFileSync(new URL('./fixtures/tower-podium-3dbag.json', import.meta.url), 'utf8')) as CityJson;
const buildings = new Map(readBagBuildings(city).map(b => [b.bagId.slice(-16), b]));
const pand = (id: string): BagBuilding => { const b = buildings.get(id); assert.ok(b, id); return b; };
const ridgeOf = (b: BagBuilding): number => b.ridgeM!;

test('Hotelschool The Hague (Jan Evertsenstraat 171-175): a ~13 m front with a ~72 m tower over its own part only', () => {
  const b = pand('0363100012148630');
  assert.equal(b.heightSource, 'tower-podium');
  assert.ok(Math.abs(b.heightM! - 13.65) < 0.05, `podium ${b.heightM}`);
  assert.ok(b.tower);
  assert.ok(Math.abs(b.tower.heightM - 72.62) < 0.05, `tower ${b.tower.heightM}`);
  assert.equal(b.tower.minHeightM, b.heightM, 'the tower stands on the podium roof');
  // The tower part (BuildingPart -1) is 1,243 m² of a 14,270 m² footprint.
  assert.ok(Math.abs(b.tower.areaM2 - 1243) < 15, `tower area ${b.tower.areaM2}`);
  assert.ok(b.tower.tallShare > 0.05 && b.tower.tallShare < 0.15, `tall share ${b.tower.tallShare}`);
  // Merged into one ring: the 281 m² top face filled the hole in the 1,243 m² face.
  assert.equal(b.tower.polygons.length, 1);
  assert.equal(b.tower.polygons[0].length, 1);
  const feature = towerTileFeature(b.bagId, b.tower);
  assert.equal(feature.properties.id, 'tower:NL.IMBAG.Pand.0363100012148630');
  assert.equal(feature.properties.pand, b.bagId);
  assert.equal(feature.properties.minHeight, 13.65);
  assert.equal(feature.properties.height, 72.62);
  assert.equal(feature.geometry.type, 'Polygon');
});

for (const [id, name] of [
  ['0363100012146659', 'Zuidas tower, Gustav Mahlerlaan (1999, ridge 105 m)'],
  ['0363100012065344', 'Zuidas tower, Gustav Mahlerlaan (2004, ridge 101 m)'],
  ['0363100012136232', 'Zuidas tower by the A10 (1973, ridge 65 m)'],
] as const) {
  test(`${name}: the tower the ridge rule protected still stands at the ridge, now over its own footprint`, () => {
    const b = pand(id);
    assert.equal(b.heightSource, 'tower-podium');
    assert.ok(b.tower);
    assert.equal(b.tower.heightM, ridgeOf(b), 'tower top unchanged: the ridge');
    assert.ok(b.tower.heightM - b.heightM! >= 10, 'still a tower on a podium');
    assert.ok(b.tower.tallShare < TOWER_WHOLE_SHARE);
    assert.ok(b.tower.areaM2 >= TOWER_MIN_AREA_M2);
  });
}

test('a ridge-tower pand whose LoD1.3 has no tall face keeps the ridge over its whole footprint (Zuidas, 2015)', () => {
  const b = pand('0363100012240476');
  assert.equal(b.heightSource, 'ridge-tower');
  assert.equal(b.tower, null);
  assert.equal(b.heightM, ridgeOf(b));
});

const square = (x: number, y: number, size: number): RdPolygon => [[[x, y], [x + size, y], [x + size, y + size], [x, y + size]]];

test('splitTowerPodium: thresholds', () => {
  const podium = { polygon: square(0, 0, 100), topM: 12 };
  const tower = (size: number, topM = 60) => ({ polygon: square(0, 0, size), topM });
  // Tall faces stand past the midpoint between podium (12) and ridge (62).
  assert.equal(splitTowerPodium({ podiumM: 12, ridgeM: 62, footprintAreaM2: 10_000, faces: [podium, tower(20, 36)] }).kind, 'unlocated');
  assert.equal(splitTowerPodium({ podiumM: 12, ridgeM: 62, footprintAreaM2: 10_000, faces: [podium, tower(20, 38)] }).kind, 'split');
  assert.equal(splitTowerPodium({ podiumM: 12, ridgeM: 62, footprintAreaM2: 10_000, faces: [podium, tower(2)] }).kind, 'unlocated');
  assert.equal(splitTowerPodium({ podiumM: 12, ridgeM: 62, footprintAreaM2: 10_000, faces: [tower(90)] }).kind, 'whole');
  const split = splitTowerPodium({ podiumM: 12, ridgeM: 62, footprintAreaM2: 10_000, faces: [podium, tower(30)] });
  assert.equal(split.kind, 'split');
  if (split.kind === 'split') { assert.equal(split.podiumM, 12); assert.equal(split.towerM, 62); assert.equal(split.towerAreaM2, 900); assert.equal(split.tallShare, 900 / 10_900, "denominator: the larger of footprint and roof faces"); }
});

test('mergeFaces: shared edges cancel, a filled hole disappears, a lone face survives', () => {
  const merged = mergeFaces([square(0, 0, 10), square(10, 0, 10)]);
  assert.ok(merged);
  assert.equal(merged.length, 1);
  assert.equal(polygonAreaM2(merged[0]), 200);
  assert.equal(merged[0][0].length, 5, 'collinear joints dropped: four corners, closed');
  const ring: RdPolygon = [[[0, 0], [30, 0], [30, 30], [0, 30]], [[10, 10], [10, 20], [20, 20], [20, 10]]];
  const filled = mergeFaces([ring, square(10, 10, 10)]);
  assert.ok(filled);
  assert.equal(filled.length, 1);
  assert.equal(filled[0].length, 1);
  assert.equal(polygonAreaM2(filled[0]), 900);
  const apart = mergeFaces([square(0, 0, 10), square(50, 0, 10)]);
  assert.equal(apart?.length, 2);
});

test('towerFeatureId never reads as a pand id', () => {
  assert.ok(!towerFeatureId('NL.IMBAG.Pand.0363100012148630').startsWith('NL.IMBAG.Pand.'));
});

test('a tower wears its pand\'s display identity (same citywide wall and roof prior)', async () => {
  const { decorateBuildingFeature } = await import('./buildingTilesBrowser.js');
  const b = pand('0363100012148630');
  const tower = towerTileFeature(b.bagId, b.tower!);
  const podium = { type: 'Feature', properties: { id: b.bagId, tier: 3, minHeight: 0, height: 13.65 }, geometry: tower.geometry };
  const a = decorateBuildingFeature(podium as never, new Map()).properties!, t = decorateBuildingFeature(tower as never, new Map()).properties!;
  assert.ok(typeof a.sideColour === 'string');
  assert.equal(t.sideColour, a.sideColour);
  assert.equal(t.roofColour, a.roofColour);
  assert.equal(t.id, 'tower:NL.IMBAG.Pand.0363100012148630', 'the tile id stays the tower\'s own');
});
