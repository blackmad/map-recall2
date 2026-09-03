/**
 * Pyramidal roof mesh math — the Waag's turrets.
 */

import assert from 'node:assert/strict';
import {
  eavesHeightM,
  pyramidalRoofMesh,
  wantsPyramidalRoof,
} from '../src/canalRecall/pyramidalRoof.js';
import {
  flatRoofFilter,
  wallTopHeightExpression,
} from '../src/canalRecall/buildingStyle.js';

assert.equal(eavesHeightM(26, 10), 16);
assert.equal(eavesHeightM(15, 4), 11);
assert.equal(eavesHeightM(12, 0), 12);
assert.equal(eavesHeightM(12, null), 12);

assert.equal(wantsPyramidalRoof({ roofShape: 'pyramidal', height: 26, roofHeight: 10 }), true);
assert.equal(wantsPyramidalRoof({ roofShape: 'pyramidal', height: 26, roofHeight: 0 }), false);
assert.equal(wantsPyramidalRoof({ roofShape: 'gabled', height: 26, roofHeight: 10 }), false);

const square = [[0, 0], [0.001, 0], [0.001, 0.001], [0, 0.001], [0, 0]];
const mesh = pyramidalRoofMesh({
  ring: square,
  apexHeightM: 26,
  eavesHeightM: 16,
  colour: '#708090',
});
assert.ok(mesh);
assert.equal(mesh.vertices.length, 5, 'apex + 4 eaves corners');
assert.equal(mesh.indices.length / 3, 4, 'four triangular faces');
assert.equal(mesh.vertices[0].altM, 26, 'apex sits at the tagged height');
assert.equal(mesh.vertices[1].altM, 16, 'eaves sit at height − roof:height');
assert.equal(mesh.vertices[0].lng, mesh.originLng);
assert.equal(mesh.vertices[0].lat, mesh.originLat);
assert.ok(mesh.vertices.slice(1).every(vertex => {
  const mLng = 111320 * Math.cos(mesh.originLat * Math.PI / 180);
  const east = (vertex.lng - mesh.originLng) * mLng;
  const north = (vertex.lat - mesh.originLat) * 111320;
  return Math.hypot(east, north) < 80;
}), 'eaves stay on the footprint, not collapsed to the centroid');
assert.ok(Number.isFinite(mesh.originLng) && Number.isFinite(mesh.originLat));

// Waag main turret: a regular ~11 m octagon. Raw-lng/lat shoelace used to put
// the apex 5 m off-centre; radii then ranged 1–10 m and the fan looked like a
// shard. After translating before the area sum, radii stay near 5.5 m.
{
  const waag = [
    [4.9002277, 52.3727826], [4.9002556, 52.3727487], [4.9003153, 52.3727378],
    [4.9003692, 52.3727539], [4.9003869, 52.3727903], [4.900359, 52.3728243],
    [4.9002994, 52.3728351], [4.9002454, 52.372819], [4.9002277, 52.3727826],
  ];
  const turret = pyramidalRoofMesh({ ring: waag, apexHeightM: 26, eavesHeightM: 16.05 });
  assert.ok(turret);
  const mLng = 111320 * Math.cos(turret.originLat * Math.PI / 180);
  const radii = turret.vertices.slice(1).map(vertex => Math.hypot(
    (vertex.lng - turret.originLng) * mLng,
    (vertex.lat - turret.originLat) * 111320,
  ));
  assert.ok(Math.min(...radii) > 5 && Math.max(...radii) < 6,
    `Waag turret radii stay near 5.5 m (got ${Math.min(...radii).toFixed(2)}–${Math.max(...radii).toFixed(2)})`);
}

const wall = wallTopHeightExpression();
assert.equal(wall[0], 'case');
const flat = flatRoofFilter();
assert.equal(flat[0], 'all');

process.stdout.write('Pyramidal roof checks passed\n');
