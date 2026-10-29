import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {appendAll, canalhouseGroupToGlb} from '../../../scripts/canalhouse-recipes/export-glb.ts';

// KPN Teleport (pand 0363100012165158) crashed measure with "Maximum call stack size exceeded" at export-glb.ts:81:
// `push(...Array.from(positions))` passes ~1 M arguments. A dense plane (~160 k vertices, ~480 k floats) reproduces it.
test('canalhouseGroupToGlb: a large mesh exports without spreading its attributes into push()', async () => {
  const group = new THREE.Group();
  group.add(new THREE.Mesh(new THREE.PlaneGeometry(40, 40, 400, 400), new THREE.MeshStandardMaterial({color: '#8a5a44'})));
  const out = await canalhouseGroupToGlb('large-mesh', group, {metreUvs: true});
  assert.ok(out.triangles > 0);
  assert.ok(out.bytes.byteLength > 0);
});

test('appendAll: appends every value in order, without spreading', () => {
  const target: number[] = [1];
  const big = new Float32Array(300000).map((_, i) => i);
  appendAll(target, big);
  assert.equal(target.length, 300001);
  assert.equal(target[300000], 299999);
  appendAll(target, [7, 8]);
  assert.deepEqual(target.slice(-2), [7, 8]);
});
