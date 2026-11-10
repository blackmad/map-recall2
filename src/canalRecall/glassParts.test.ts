// Glazed OSM parts (lane glass-parts-20261110, feedback fc427560): the tile stamp and the curtain-wall mesh treatment.
//   node --import tsx --test src/canalRecall/glassParts.test.ts
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import zlib from 'node:zlib';
import { bayLayer } from './bayLook.ts';
import { CURTAIN_STYLE, GLAZING_FRAME_HEX, applyGlazing, glazedMaterialOf, glazingOf } from './glassParts.ts';
import { lookHex } from './look/palette.ts';
import { meshBuildingFor, type Feature } from './threeBuildingFeatures.ts';
import { glazedSourceIds, stampTileBody } from '../../scripts/building-tiles/stamp-glass-material.ts';

const EXTRACT = path.resolve(import.meta.dirname, '../../public/data/extracts/amsterdam');
const tileBody = (t: string) => zlib.gunzipSync(fs.readFileSync(path.join(EXTRACT, `building-tiles/14/${t}.geojson.gz`))).toString('utf8');
const glazed = () => glazedSourceIds(JSON.parse(fs.readFileSync(path.join(EXTRACT, 'buildings-colored.geojson'), 'utf8')));

// The IJdok skybridge (w1088847353) as the tile carries it, 14.5-18 m between the Openbaar Ministerie and the Gerechtshof.
const bridge = (extra: Record<string, unknown> = {}): Feature => ({ type: 'Feature', properties: { id: 'w1088847353', tier: 2, minHeight: 14.5, height: 18, colour: '#5a81a0', roofColour: '#354660', ...extra },
  geometry: { type: 'Polygon', coordinates: [[[4.8946561, 52.384187], [4.8947033, 52.3841846], [4.8947933, 52.3841801], [4.8947946, 52.3841907], [4.8946572, 52.3841977], [4.8946561, 52.384187]]] } });

test('glazedMaterialOf: glass and mirror from the wall keys, the facade key first; nothing else', () => {
  assert.equal(glazedMaterialOf({ 'building:material': 'glass' }), 'glass');
  assert.equal(glazedMaterialOf({ 'building:material': 'Mirror' }), 'mirror');
  assert.equal(glazedMaterialOf({ 'building:facade:material': 'glass', 'building:material': 'concrete' }), 'glass');
  assert.equal(glazedMaterialOf({ 'building:facade:material': 'brick', 'building:material': 'glass' }), undefined);
  assert.equal(glazedMaterialOf({ 'building:material': 'glass;steel' }), 'glass');
  for (const m of ['brick', 'steel', 'plastic', '', undefined]) assert.equal(glazedMaterialOf({ 'building:material': m }), undefined);
  assert.equal(glazingOf({ material: 'glass' }), 'glass');
  assert.equal(glazingOf({ material: 'brick' }), undefined);
});

test('stampTileBody: inserts material after the id only, in both tile layouts, idempotently', () => {
  const ids = new Map([['w1', 'glass' as const]]);
  const lines = '{"type":"FeatureCollection","features":[\n{"type":"Feature","properties":{"id":"w1","tier":2},"geometry":null},\n{"type":"Feature","properties":{"id":"w2","tier":2},"geometry":null}\n]}\n';
  const once = stampTileBody(lines, ids);
  assert.deepEqual(once.stamped, ['w1']);
  assert.equal(once.body, lines.replace('{"id":"w1",', '{"id":"w1","material":"glass",'));
  assert.equal(stampTileBody(once.body, ids).body, once.body);
  assert.deepEqual(stampTileBody(once.body, ids).stamped, []);
  const oneLine = lines.replace(/\n/g, '');
  assert.equal(stampTileBody(oneLine, ids).body, oneLine.replace('{"id":"w1",', '{"id":"w1","material":"glass",'));
  const none = stampTileBody(lines, new Map());
  assert.equal(none.body, lines);
});

test('IJdok tile 8414/5383: the stamp names exactly its six glazed OSM parts, the bridge and the oriel among them', () => {
  const { body, present } = stampTileBody(tileBody('8414/5383'), glazed());
  assert.deepEqual(present.sort(), ['w1088847352', 'w1088847353', 'w1097460490', 'w755935170', 'w757595921', 'w757595922']);
  const byId = new Map((JSON.parse(body).features as Feature[]).map(f => [String(f.properties.id), f]));
  assert.equal(byId.get('w1088847352')!.properties.material, 'glass');
  assert.equal(byId.get('w1088847353')!.properties.material, 'glass');
  // The slender fin the part-overlap lane drops has no material and stays unstamped.
  assert.equal(byId.get('w1088847358')?.properties.material, undefined);
});

test('a glazed part draws as a curtain wall in the textured looks', () => {
  const curtain = bayLayer('modern', CURTAIN_STYLE, 'upper');
  for (const look of ['photo', 'storybook', 'cartoon'] as const) {
    const b = meshBuildingFor(bridge({ material: 'glass' }), look)!;
    assert.equal(b.bare, false, look);
    assert.deepEqual(b.layers, { upper: curtain, ground: curtain, door: curtain }, look);
    assert.equal(b.wallHex, lookHex(GLAZING_FRAME_HEX.glass, look), look);
    assert.equal(b.extras, false); assert.equal(b.shop, false); assert.equal(b.shopfront, false);
    assert.equal(b.openings?.upper.axes.length, 1);
    assert.equal(b.heightM, 18); assert.equal(b.minHeightM, 14.5);
  }
  // A tagged glass colour (not the #5a81a0 prior) tints the spandrels.
  assert.equal(meshBuildingFor(bridge({ material: 'glass', colour: '#c4f2e0' }), 'photo')!.accentHex, lookHex('#c4f2e0', 'photo'));
});

test('byte-identical without the tag: no material, a non-glazing material, and the procedural looks draw as before', () => {
  for (const look of ['photo', 'storybook', 'cartoon', 'procedural', 'untextured'] as const) {
    const before = meshBuildingFor(bridge(), look);
    assert.equal(before!.bare, true, look);
    assert.deepEqual(meshBuildingFor(bridge({ material: 'brick' }), look), before, look);
    assert.deepEqual(meshBuildingFor(bridge({ material: '' }), look), before, look);
    if (look === 'procedural' || look === 'untextured') assert.deepEqual(meshBuildingFor(bridge({ material: 'glass' }), look), before, look);
  }
  const b = meshBuildingFor(bridge(), 'procedural')!;
  assert.equal(applyGlazing(b, 'glass', 'procedural'), false);
});

test('IJdok tile: every feature the stamp does not touch builds the same mesh building', () => {
  const original = JSON.parse(tileBody('8414/5383')).features as Feature[];
  const stamped = JSON.parse(stampTileBody(tileBody('8414/5383'), glazed()).body).features as Feature[];
  assert.equal(stamped.length, original.length);
  let same = 0;
  for (let i = 0; i < original.length; i++) {
    if (glazingOf(stamped[i].properties)) continue;
    assert.deepEqual(stamped[i], original[i]);
    assert.deepEqual(meshBuildingFor(stamped[i], 'photo'), meshBuildingFor(original[i], 'photo'));
    same++;
  }
  assert.ok(same > 5000, `${same}`);
});
