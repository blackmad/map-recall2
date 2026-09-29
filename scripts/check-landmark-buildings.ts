// Which streamed building a landmark card is about, decided at extract time.
// Named regression: user report 2026-09-29, the Bevrijdingslinde (a tree at
// 52.3776344, 4.878829) lit a 52 m² shed 5 m away under the runtime's 10 m
// nearest-footprint rule.

import assert from 'node:assert/strict';
import {
  BuildingGrid, isStreetObject, pandTileId, resolveLandmarkBuildings, sameRing,
  type LandmarkSource, type OsmBuilding, type Ring,
} from './lib/landmarkBuildings.ts';

const checks: string[] = [];
function check(name: string, run: () => void): void { run(); checks.push(name); }

/** A square footprint of `metres` a side, south-west corner at (lng, lat). */
const square = (lng: number, lat: number, metres = 20): Ring => {
  const dx = metres / (111_320 * Math.cos(lat * Math.PI / 180)), dy = metres / 110_540;
  return [[lng, lat], [lng + dx, lat], [lng + dx, lat + dy], [lng, lat + dy], [lng, lat]];
};
const building = (osmId: string, ring: Ring, extra: Partial<OsmBuilding> = {}): OsmBuilding =>
  ({ osmId, refBag: null, wikidata: null, rings: [ring], ...extra });
const landmark = (extra: Partial<LandmarkSource>): LandmarkSource =>
  ({ id: 'l', wikidata: null, point: [4.9, 52.37], outline: [], nodeTags: null, ...extra });
const world = (...buildings: OsmBuilding[]) => {
  const grid = new BuildingGrid();
  for (const b of buildings) grid.add(b);
  return grid;
};

check('OSM ref:bag becomes the tiles\' pand id, leading zeros restored', () => {
  assert.equal(pandTileId('363100012168198'), 'NL.IMBAG.Pand.0363100012168198');
  assert.equal(pandTileId('0363100012168198;0363100012168199'), 'NL.IMBAG.Pand.0363100012168198');
  assert.equal(pandTileId('abc'), null);
});

check('a tree beside a shed has no building (Bevrijdingslinde)', () => {
  const lng = 4.878829, lat = 52.3776344;
  // The shed's edge 5 m east of the tree.
  const shed = building('w1', square(lng + 5 / (111_320 * Math.cos(lat * Math.PI / 180)), lat - 0.00003, 7), { refBag: '363100000000001' });
  const grid = world(shed);
  const match = resolveLandmarkBuildings(landmark({ point: [lng, lat], nodeTags: { natural: 'tree', name: 'Bevrijdingslinde' } }), grid,
    new Set(['NL.IMBAG.Pand.0363100000000001']));
  assert.deepEqual(match, { buildingIds: [], how: 'object' });
});

check('an unknown node outside every building gets no guess', () => {
  const grid = world(building('w1', square(4.9, 52.37)));
  const match = resolveLandmarkBuildings(landmark({ point: [4.89995, 52.37] }), grid, new Set(['w1']));
  assert.equal(match.how, 'none');
});

check('a museum\'s entrance node on the pavement finds its building', () => {
  const grid = world(building('w1', square(4.9, 52.37)));
  const match = resolveLandmarkBuildings(landmark({ point: [4.89995, 52.37002], nodeTags: { tourism: 'museum' } }), grid, new Set(['w1']));
  assert.deepEqual(match, { buildingIds: ['w1'], how: 'entrance' });
});

check('a memorial with a house number is the building it names (Hollandsche Schouwburg)', () => {
  assert.equal(isStreetObject({ historic: 'memorial', 'addr:housenumber': '24' }), false);
  assert.equal(isStreetObject({ historic: 'memorial' }), true);
  assert.equal(isStreetObject({ tourism: 'artwork' }), true);
  assert.equal(isStreetObject({ amenity: 'theatre' }), false);
});

check('the building carrying the landmark\'s Wikidata item wins, by identity', () => {
  const grid = world(building('w1', square(4.9, 52.37)), building('w2', square(4.9004, 52.37), { wikidata: 'Q1' }));
  const match = resolveLandmarkBuildings(landmark({ wikidata: 'Q1', point: [4.90005, 52.37005] }), grid, new Set(['w1', 'w2']));
  assert.deepEqual(match, { buildingIds: ['w2'], how: 'wikidata' });
});

check('a building drawn as parts resolves to its parts (Royal Palace, Muziekgebouw)', () => {
  const outline = square(4.9, 52.37, 40);
  const grid = world(
    building('w1', outline, { refBag: '363100000000009' }),
    building('w10', square(4.90005, 52.37005, 10), { part: true }),
    building('w11', square(4.9002, 52.3701, 10), { part: true }),
  );
  const match = resolveLandmarkBuildings(landmark({ point: [4.9001, 52.3701] }), grid, new Set(['w10', 'w11']));
  assert.deepEqual(match.buildingIds.sort(), ['w10', 'w11']);
  assert.equal(match.how, 'contains-point');
});

check('an outline that is a building\'s own ring is that building', () => {
  const ring = square(4.9, 52.37);
  assert.ok(sameRing(ring, [...ring]));
  const grid = world(building('w5', ring, { refBag: '1' }));
  const match = resolveLandmarkBuildings(landmark({ outline: [ring], point: [4.90005, 52.37005] }), grid, new Set(['NL.IMBAG.Pand.0000000000000001']));
  assert.deepEqual(match, { buildingIds: ['NL.IMBAG.Pand.0000000000000001'], how: 'own-way' });
});

check('a site claims the buildings inside it, but a district claims none', () => {
  const site = square(4.9, 52.37, 100);
  const inside = [0, 1, 2].map(i => building(`w${i}`, square(4.9002 + i * 0.0003, 52.3702, 10)));
  const match = resolveLandmarkBuildings(landmark({ outline: [site], point: [4.9007, 52.3704] }), world(...inside), new Set(['w0', 'w1', 'w2']));
  assert.equal(match.how, 'site');
  assert.equal(match.buildingIds.length, 3);
  const district = square(4.9, 52.37, 400);
  const many = Array.from({ length: 20 }, (_, i) => building(`d${i}`, square(4.9002 + (i % 5) * 0.001, 52.3702 + Math.floor(i / 5) * 0.0008, 10)));
  const wide = resolveLandmarkBuildings(landmark({ outline: [district], point: [4.903, 52.3718] }), world(...many), new Set(many.map(b => b.osmId)));
  assert.notEqual(wide.how, 'site');
});

for (const name of checks) process.stdout.write(`· ${name}\n`);
process.stdout.write(`Landmark building checks passed (${checks.length})\n`);
