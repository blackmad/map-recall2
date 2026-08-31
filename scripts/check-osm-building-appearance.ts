import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

type Building = {
  properties: { osmId: string | number; name: string; colour: string; sideColour?: string; roofColour: string; roofShape: string; height: number };
};
const collection = JSON.parse(await readFile('public/data/extracts/amsterdam/buildings-colored.geojson', 'utf8')) as { features: Building[] };
assert.ok(collection.features.length >= 100, `expected broad Amsterdam building appearance coverage, found ${collection.features.length}`);
assert.ok(new Set(collection.features.map(feature => feature.properties.colour)).size >= 10, 'building data retains a useful variety of source colors');
const nemo = collection.features.find(feature => String(feature.properties.osmId).includes('1390692772'));
assert.ok(nemo, 'NEMO building part comes from the generated OSM appearance data');
assert.equal(nemo.properties.colour.toLowerCase(), '#43888b');
if (nemo.properties.sideColour) assert.equal(nemo.properties.sideColour.toLowerCase(), '#43888b');
assert.equal(nemo.properties.roofColour.toLowerCase(), '#f5f5dc');
assert.equal(nemo.properties.roofShape, 'skillion');
assert.equal(nemo.properties.height, 21.7);
process.stdout.write(`OSM building appearance checks passed (${collection.features.length} buildings).\n`);
