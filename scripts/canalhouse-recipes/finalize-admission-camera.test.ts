import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { finalizeAdmissionCamera } from './finalize-admission-camera.ts';

const manifest = JSON.parse(fs.readFileSync(new URL('./admission-camera-80.fixture.json', import.meta.url), 'utf8'));
const images = manifest.records[0].images;
function admission(tier = 'full') {
  return { status: 'candidate-only', houses: [{ pandId: manifest.records[0].buildingId, sources: {
    lowerReferenceTier: tier,
    projection: { camera: { pano_id: images.full.panoramaId, timestamp: 'preserved', geometry: { type: 'Point', coordinates: [null, null] } } },
    nearCamera: { pano_id: images[tier].panoramaId, _links: { preserved: true } },
  } }] };
}

test('actual 80 pose repairs null coordinates and preserves provenance without acceptance', () => {
  const input = admission();
  const output = finalizeAdmissionCamera(input, manifest);
  const sources = output.houses[0].sources as any;
  assert.ok(Math.abs(sources.projection.camera.geometry.coordinates[0] - 4.88107466) < 0.00001);
  assert.ok(Math.abs(sources.projection.camera.geometry.coordinates[1] - 52.37486459) < 0.00001);
  assert.deepEqual(sources.nearCamera.geometry.coordinates, sources.projection.camera.geometry.coordinates);
  assert.equal(sources.projection.camera.timestamp, 'preserved');
  assert.equal(sources.projection.camera.datum, images.full.datum);
  assert.equal(sources.projection.camera.metricEligible, false);
  assert.equal(output.status, 'candidate-only');
  assert.deepEqual(input.houses[0].sources.projection.camera.geometry.coordinates, [null, null]);
});

test('ground uses its different panorama pose and projection', () => {
  const sources = finalizeAdmissionCamera(admission('ground'), manifest).houses[0].sources as any;
  assert.notDeepEqual(sources.nearCamera.geometry.coordinates, sources.projection.camera.geometry.coordinates);
  assert.deepEqual(sources.nearProjection, images.ground.projection);
  assert.equal(sources.nearCamera.datum, images.ground.datum);
  assert.equal(sources.nearCamera.heightInferred, true);
  assert.deepEqual(sources.nearCamera._links, { preserved: true });
});

test('rejects missing/mismatched panorama IDs and ambiguous records', () => {
  const input = admission();
  input.houses[0].sources.nearCamera.pano_id = images.ground.panoramaId;
  assert.throws(() => finalizeAdmissionCamera(input, manifest), /Expected one full camera/);
  input.houses[0].sources.nearCamera.pano_id = '';
  assert.throws(() => finalizeAdmissionCamera(input, manifest), /Missing full recorded panorama ID/);
  assert.throws(() => finalizeAdmissionCamera(admission(), { records: [...manifest.records, ...manifest.records] }), /found 2/);
});

test('rejects null, array and nonfinite RD poses or projection values', () => {
  for (const pose of [null, [120534, 487563], { x: null, y: 487563, z: 4 }, { x: Infinity, y: 487563, z: 4 }]) {
    const invalid = structuredClone(manifest);
    invalid.records[0].images.full.pose = pose;
    assert.throws(() => finalizeAdmissionCamera(admission(), invalid), /Invalid RD pose/);
  }
  const invalid = structuredClone(manifest);
  invalid.records[0].images.full.projection.pitchDeg = null;
  assert.throws(() => finalizeAdmissionCamera(admission(), invalid), /Invalid full projection/);
});
