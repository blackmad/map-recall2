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
// The Waag is the named regression for hand-mapped 3D. Thirteen unnamed OSM
// building:part ways carry its towers at 6/15/17/20/26 m, and that variation is
// the whole silhouette — BAG holds the Waag as essentially one pand, so any
// pipeline that keys geometry on BAG alone flattens it into a single ~14 m box.
// Government geometry is the floor for the city, never the ceiling for a
// landmark; if this count collapses, a landmark has been flattened.
const centreOf = (geometry: { type: string; coordinates: number[][][] | number[][][][] }) => {
  const points = (geometry.type === 'Polygon' ? geometry.coordinates.flat() : geometry.coordinates.flat(2)) as number[][];
  return [points.reduce((sum, p) => sum + p[0], 0) / points.length, points.reduce((sum, p) => sum + p[1], 0) / points.length];
};
const [WAAG_LNG, WAAG_LAT] = [4.90028, 52.37256];
const nearWaag = (collection.features as unknown as { properties: Building['properties'] & { minHeight?: number }; geometry: never }[])
  .filter(feature => {
    const [lng, lat] = centreOf(feature.geometry);
    return Math.hypot((lng - WAAG_LNG) * 111320 * Math.cos((WAAG_LAT * Math.PI) / 180), (lat - WAAG_LAT) * 110540) < 45;
  });
const waagHeights = new Set(nearWaag.map(feature => feature.properties.height));
assert.ok(nearWaag.length >= 12, `the Waag keeps its hand-mapped building parts, found ${nearWaag.length}`);
assert.ok(waagHeights.size >= 5, `the Waag's parts keep distinct heights, found ${[...waagHeights].sort((a, b) => a - b).join('/')}`);
assert.ok(nearWaag.some(feature => feature.properties.roofShape === 'pyramidal'), 'the Waag keeps its pyramidal tower roofs');
const turret = nearWaag.find(feature => String(feature.properties.osmId) === 'w749066943') as
  { properties: Building['properties'] & { roofHeight?: number; minHeight?: number } } | undefined;
assert.ok(turret, 'the tallest Waag turret is in the extract');
assert.equal(turret.properties.roofHeight, 10, 'roof:height survives so the cone can be drawn');
assert.equal(turret.properties.minHeight, 13);

process.stdout.write(`OSM building appearance checks passed (${collection.features.length} buildings, Waag ${nearWaag.length} parts at ${[...waagHeights].sort((a, b) => a - b).join('/')} m).\n`);
