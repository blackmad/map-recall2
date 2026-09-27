import assert from 'node:assert/strict';
import test from 'node:test';
import {applyAwningAssemblies} from './awningAssembly';
import type {MeshData} from './componentGeometry';

const wall = (): MeshData => ({id: 'front', kind: 'wall', textured: true,
  positions: [0, 0, 0, 4, 0, 0, 4, 4, 0, 0, 4, 0],
  indices: [0, 1, 2, 0, 2, 3], uvs: [0, 0, 1, 0, 1, 1, 0, 1]});

test('awning projects a sloped canopy outward with fascia and side caps', () => {
  const result = applyAwningAssemblies([wall()], [{id: 'shop', bbox: [0.2, 0.4, 0.8, 0.5], depth: 0.9}]);
  assert.deepEqual(result.stats.accepted, ['shop']);
  const top = result.meshes.find(mesh => mesh.id === 'awning:shop:top');
  assert.ok(top);
  assert.deepEqual(top.positions.slice(0, 3), [0.8, 2.4, 0]);
  assert.ok(Math.abs(top.positions[8] - 0.9) < 1e-6);
  assert.ok(top.positions[7] < top.positions[1], 'front edge follows the lower image edge');
  assert.ok(result.meshes.some(mesh => mesh.id === 'awning:shop:fascia'));
  assert.ok(result.meshes.some(mesh => mesh.id === 'awning:shop:left-cap'));
  assert.ok(result.meshes.some(mesh => mesh.id === 'awning:shop:right-cap'));
});

test('awning outside textured wall produces no invented projection', () => {
  const half = wall();
  half.positions = [0, 0, 0, 2, 0, 0, 2, 4, 0, 0, 4, 0];
  half.uvs = [0, 0, 0.5, 0, 0.5, 1, 0, 1];
  const result = applyAwningAssemblies([half], [{id: 'off', bbox: [0.4, 0.4, 0.8, 0.5]}]);
  assert.deepEqual(result.stats.accepted, []);
  assert.equal(result.stats.skipped[0].reason, 'outside-wall');
  assert.deepEqual(result.meshes, [half]);
});
