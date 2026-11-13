/**
 * Block-face intake reads OSM businesses from a local city extract instead of one Overpass query per face
 * (osmPoiExtract.ts). A cut must equal the per-face answer on the same data: same keys, same bbox rule, same shape.
 *   node --import tsx --test src/canalRecall/blockFace/osmPoiExtract.test.ts
 */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {bboxCovers, businessesFrom, cutExtract, newestExtract, poiQuery, type OverpassExtract} from './osmPoiExtract.ts';

const city: OverpassExtract = {bbox: [52.27, 4.72, 52.44, 5.1], fetchedAt: '2026-11-10T12:00:00Z', endpoint: 'e', query: 'q', elements: [
  {type: 'node', id: 1, lat: 52.3770, lon: 4.8890, tags: {shop: 'bakery', name: 'In'}},
  {type: 'way', id: 2, center: {lat: 52.3771, lon: 4.8891}, tags: {amenity: 'cafe'}},
  {type: 'node', id: 3, lat: 52.3800, lon: 4.8890, tags: {shop: 'books'}},
  {type: 'node', id: 4, lat: 52.3770, lon: 4.8890, tags: {highway: 'bus_stop'}},
  {type: 'relation', id: 5, tags: {office: 'company'}},
]};
const face = [52.3765, 4.8885, 52.3775, 4.8895];

test('a face cut keeps the elements of the six intake keys inside the bbox, centres included', () => {
  const cut = cutExtract(city, face, '/x/amsterdam-pois-20261110.json.gz')!;
  assert.deepEqual(cut.elements.map(e => e.id), [1, 2]);
  assert.equal(cut.cutFrom, '/x/amsterdam-pois-20261110.json.gz');
  assert.deepEqual(cut.bbox, face);
  assert.deepEqual(businessesFrom(cut).map(b => [b.id, b.lngLat, b.fetchedAt]), [[1, [4.889, 52.377], '2026-11-10T12:00:00Z'], [2, [4.8891, 52.3771], '2026-11-10T12:00:00Z']]);
});

test('an extract that does not cover the face is not used (intake falls back to Overpass)', () => {
  assert.equal(cutExtract({...city, bbox: [52.37, 4.88, 52.3770, 4.90]}, face, 'f'), null);
  assert.ok(bboxCovers(city.bbox, face) && !bboxCovers(face, city.bbox));
});

test('the per-face query asks for the same six keys, and the newest dated extract wins', () => {
  assert.equal(poiQuery([1, 2, 3, 4]), '[out:json][timeout:60];(nwr["shop"](1,2,3,4);nwr["amenity"](1,2,3,4);nwr["craft"](1,2,3,4);nwr["office"](1,2,3,4);nwr["healthcare"](1,2,3,4);nwr["tourism"](1,2,3,4););out center tags;');
  assert.equal(newestExtract(['README.md', 'amsterdam-pois-20261110.json.gz', 'amsterdam-pois-20261201.json.gz', 'amsterdam-pois-x.json']), 'amsterdam-pois-20261201.json.gz');
  assert.equal(newestExtract([]), null);
});
