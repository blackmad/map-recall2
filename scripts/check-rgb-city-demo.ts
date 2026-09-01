import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const summary = JSON.parse(await readFile('public/data/rgb-city-demo/summary.json', 'utf8')) as Record<string, number | string>;
const collection = JSON.parse(await readFile('public/data/rgb-city-demo/roof-planes.geojson', 'utf8')) as {
  features: Array<{ properties: Record<string, unknown>; geometry: { type: string; coordinates: number[][][] } }>;
};
assert.equal(summary.sampledBuildings, 20);
assert.equal(summary.semanticRoofPlanes, collection.features.length);
assert.ok(Number(summary.independentlyAgreedPlanes) >= 60, 'the demo keeps broad independently agreeing evidence');
assert.ok(Number(summary.buildingsWithAgreedRgb) >= 16, 'the spatial sample is not one lucky building');
for (const feature of collection.features) {
  assert.equal(feature.geometry.type, 'Polygon');
  assert.ok(feature.geometry.coordinates[0].length >= 4);
  assert.equal(feature.properties.reviewStatus, 'machine-proposal');
  assert.equal(feature.properties.acceptedForNow, false);
  if (feature.properties.status === 'proposed') {
    assert.match(String(feature.properties.pointColour), /^#[0-9a-f]{6}$/i);
    assert.ok(Number(feature.properties.sampleCount) >= 30);
    assert.ok(Number(feature.properties.rgbDistance) <= 20);
  } else {
    assert.ok(feature.properties.reason, 'every abstention explains itself');
  }
}
console.log(`RGB city demo checks passed (${summary.independentlyAgreedPlanes}/${summary.semanticRoofPlanes} planes across ${summary.buildingsWithAgreedRgb}/${summary.sampledBuildings} buildings).`);
