// The game's own POI layer: which places it draws, how they rank, which
// roofline each sits on, and that spoilers never reach the map.
import assert from 'node:assert/strict';
import { classifyPoi, heightBand, rankPoi } from '../src/canalRecall/poiCatalog';
import { ownPoiFeatures, type OrientationPoiFile } from '../src/canalRecall/ownPois';

assert.equal(classifyPoi({ amenity: 'waste_basket' }), null, 'unnamed street furniture is not a cue');
assert.equal(classifyPoi({ amenity: 'bench', name: 'Bankje' }), null, 'a named bench is not a cue either');
assert.equal(classifyPoi({ tourism: 'museum', name: 'Museum Van Loon' })?.category, 'culture');
assert.equal(classifyPoi({ tourism: 'museum', shop: 'gift', name: 'Museumwinkel' })?.category, 'culture', 'first key wins: a museum shop is a museum');
assert.equal(classifyPoi({ amenity: 'cafe', name: 'Café Papeneiland' })?.category, 'food');
assert.equal(classifyPoi({ shop: 'bicycle', name: 'Fietsenmaker' })?.category, 'bike');
assert.equal(classifyPoi({ 'disused:amenity': 'pub', amenity: 'pub', name: 'Oud' }), null, 'closed places are not drawn');
const museum = classifyPoi({ tourism: 'museum', name: 'M' })!;
assert.ok(rankPoi({ name: 'M', wikidata: 'Q1' }, museum, false) > rankPoi({ name: 'M' }, museum, false), 'fame ranks higher');

assert.equal(heightBand(null), 'ground');
assert.equal(heightBand(6), 'low');
assert.equal(heightBand(12), 'mid');
assert.equal(heightBand(30), 'high');

const file: OrientationPoiFile = {
  version: 1, categories: ['culture', 'food'], bands: ['ground', 'low', 'mid', 'high'],
  pois: [
    ['Café Prinsengracht', 4.884, 52.372, 1, 30, 2],
    ['Museum Het Grachtenhuis', 4.889, 52.3695, 0, 100, 3],
    ['Weak Café', 4.88901, 52.36951, 1, 10, 1],
  ],
};
const features = ownPoiFeatures(file, name => /prinsengracht/i.test(name)).features;
assert.deepEqual(features.map(f => f.properties.name), ['Museum Het Grachtenhuis'],
  'a spoiler is screened out; a weaker POI on the same block is thinned');
assert.equal(features[0].properties.band, 'high');
assert.deepEqual(features[0].geometry.coordinates, [4.889, 52.3695]);
assert.deepEqual(ownPoiFeatures(null, () => false).features, []);
process.stdout.write('Own POI checks passed\n');
