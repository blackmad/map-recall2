import assert from 'node:assert/strict';
import test from 'node:test';
import { SHED_DEFAULT_HEIGHT_M, SHED_LID_HEX, SHED_WALL_HEXES, eavesOf, isGardenShed, isShedSized, ringAreaM2, shedHeightM, shedWallHex, streetWithin } from './gardenSheds.ts';
import { SegmentGrid } from './streetFronts.ts';
import { ORIGIN, buildFeatureChunk, meshBuildingFor, type Feature } from './threeBuildingFeatures.ts';

const KX = 111_320 * Math.cos(ORIGIN.lat * Math.PI / 180), KY = 110_540;
/** A footprint of w x d metres whose south-west corner is x, y metres from the origin. */
const box = (x: number, y: number, w: number, d: number): number[][] => [[x, y], [x + w, y], [x + w, y + d], [x, y + d], [x, y]].map(([a, b]) => [ORIGIN.lng + a / KX, ORIGIN.lat + b / KY]);
const feature = (id: string, ring: number[][], properties: Record<string, unknown> = {}): Feature => ({ type: 'Feature', properties: { id, height: 2.4, minHeight: 0, ...properties }, geometry: { type: 'Polygon', coordinates: [ring] } }) as Feature;
/** A street running east-west at y = 0 from x = -100 to 100. */
const street = new SegmentGrid(Float32Array.from([-100, 0, 100, 0]), 25);

test('shed size: under 25 m2, or under 40 m2 with low eaves', () => {
  assert.equal(isShedSized({ areaM2: 6, eavesM: 2.4 }), true);
  assert.equal(isShedSized({ areaM2: 24.9, eavesM: 9 }), true, 'small is small, however tall');
  assert.equal(isShedSized({ areaM2: 32, eavesM: 3.0 }), true);
  assert.equal(isShedSized({ areaM2: 32, eavesM: 3.4 }), false);
  assert.equal(isShedSized({ areaM2: 32, eavesM: null }), false);
  assert.equal(isShedSized({ areaM2: 41, eavesM: 2.5 }), false);
  assert.ok(Math.abs(ringAreaM2(box(0, 0, 3, 2)) - 6) < 0.05);
  assert.equal(eavesOf({ eaves: 2.2, height: 2.9 }), 2.2);
  assert.equal(eavesOf({ height: 2.9 }), 2.9);
  assert.equal(eavesOf({}), null);
});

test('a small pand is a shed only away from the street: 6 m reach from any footprint edge', () => {
  const garden = feature('garden', box(0, 20, 2.5, 2.5)), kiosk = feature('kiosk', box(0, 4, 2.5, 2.5));
  assert.equal(isGardenShed(garden, street, ORIGIN), true);
  assert.equal(isGardenShed(kiosk, street, ORIGIN), false, '4 m from the street: it stands on it');
  assert.equal(isGardenShed(feature('edge-in', box(0, 5.8, 2.5, 2.5)), street, ORIGIN), false, 'the south edge is 5.8 m from the street: within the 6 m reach');
  assert.equal(isGardenShed(feature('edge-out', box(0, 6.3, 2.5, 2.5)), street, ORIGIN), true, '6.3 m: clear of the street');
  assert.equal(isGardenShed(garden, null, ORIGIN), false, 'no streets known: nothing is classified');
  assert.equal(streetWithin(box(0, 0, 3, 3).slice(0, -1).map(([lng, lat]) => [(lng - ORIGIN.lng) * KX, (lat - ORIGIN.lat) * KY] as [number, number]), street), true, 'a footprint on the street');
});

test('houses, minHeight parts, shops, landmarks and allotment huts are never sheds', () => {
  assert.equal(isGardenShed(feature('house', box(0, 20, 8, 10)), street, ORIGIN), false);
  assert.equal(isGardenShed(feature('part', box(0, 20, 2.5, 2.5), { minHeight: 3 }), street, ORIGIN), false);
  assert.equal(isGardenShed(feature('shop', box(0, 20, 2.5, 2.5), { shopSignature: [0, 0] }), street, ORIGIN), false);
  assert.equal(isGardenShed(feature('kit', box(0, 20, 2.5, 2.5), { kitWall: 'plain' }), street, ORIGIN), false);
  assert.equal(isGardenShed(feature('hut', box(0, 20, 2.5, 2.5), { allotmentHouse: 'garden-house-v1' }), street, ORIGIN), false);
});

test('a shed with no height is 2.6 m, not the 5 m storey default', () => {
  assert.equal(shedHeightM({}), SHED_DEFAULT_HEIGHT_M);
  assert.equal(shedHeightM({ height: 2.31 }), 2.31);
});

test('the mesh draws a shed as a bare muted box at its own height, and drops it below the near tier', () => {
  const shed = feature('NL.IMBAG.Pand.0363100012183198', box(0, 20, 2.5, 2.5), { height: 2.31, sideColour: '#ff00ff', gardenShed: true });
  const building = meshBuildingFor(shed, 'photo')!;
  assert.equal(building.heightM, 2.31, 'the 3DBAG height, untouched');
  assert.equal(building.bare, true);
  assert.ok(SHED_WALL_HEXES.includes(building.wallHex) && building.wallHex === shedWallHex(shed.properties.id as string), 'a muted shed colour, not the random prior');
  assert.equal(building.lid?.hex, SHED_LID_HEX);
  assert.equal(building.extras, false);
  assert.equal(building.roof, undefined, 'flat roof');
  const plain = feature('a-house', box(0, 20, 8, 10), { height: 12 }), unmarked = feature(shed.properties.id as string, box(0, 20, 2.5, 2.5), { height: 2.31 });
  const near = buildFeatureChunk([unmarked, plain], 'photo', 'walls', Float32Array.from([-100, 0, 100, 0]));
  const far = buildFeatureChunk([unmarked, plain], 'photo', 'coarse', Float32Array.from([-100, 0, 100, 0]));
  assert.equal(near.buildingCount, 2);
  assert.equal(far.buildingCount, 1, 'the shed is not drawn beyond the near tier');
  assert.equal(buildFeatureChunk([unmarked, plain], 'photo', 'coarse').buildingCount, 2, 'with no streets nothing is dropped');
});
