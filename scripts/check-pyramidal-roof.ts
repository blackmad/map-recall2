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
assert.equal(mesh.positions.length / 3, 5, 'apex + 4 eaves corners');
assert.equal(mesh.indices.length / 3, 4, 'four triangular faces');
assert.equal(mesh.positions[2], 26, 'apex sits at the tagged height');
assert.equal(mesh.positions[5], 16, 'eaves sit at height − roof:height');
assert.ok(Number.isFinite(mesh.originLng) && Number.isFinite(mesh.originLat));

const wall = wallTopHeightExpression();
assert.equal(wall[0], 'case');
const flat = flatRoofFilter();
assert.equal(flat[0], 'all');

process.stdout.write('Pyramidal roof checks passed\n');
