import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { CULL_MARGIN, InstanceCull, treeCullFlag } from './instanceCull';
import { SHADOW_ONLY_LAYER } from './shadowStandIns';

function grid(n: number, step: number): THREE.InstancedMesh {
  const mesh = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0), new THREE.MeshBasicMaterial(), n * n);
  const m = new THREE.Matrix4(), c = new THREE.Color();
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const k = j * n + i;
    mesh.setMatrixAt(k, m.compose(new THREE.Vector3(i * step, j * step, 2), new THREE.Quaternion(), new THREE.Vector3(2, 2, 3)));
    mesh.setColorAt(k, c.setRGB(k / (n * n), 0.5, 0.25));
  }
  return mesh;
}

function clipOf(camera: THREE.PerspectiveCamera): THREE.Matrix4 {
  camera.updateMatrixWorld(true);
  return new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
}

test('InstanceCull: the buffers hold every instance the view meets, in order, plus a margin; the twin keeps all', () => {
  const n = 40, step = 10, mesh = grid(n, step);
  const full = Float32Array.from(mesh.instanceMatrix.array), colours = Float32Array.from(mesh.instanceColor!.array);
  const cull = new InstanceCull(THREE, mesh, { castShadow: true });
  assert.ok(cull.shadow, 'a shadow twin');
  assert.equal(cull.shadow.layers.mask, 1 << SHADOW_ONLY_LAYER);
  assert.equal(mesh.castShadow, false);
  assert.deepEqual(Array.from(cull.shadow.instanceMatrix.array), Array.from(full));
  const camera = new THREE.PerspectiveCamera(50, 1.5, 1, 400);
  camera.position.set(50, -40, 60); camera.up.set(0, 0, 1); camera.lookAt(80, 120, 0);
  assert.ok(cull.update(clipOf(camera)));
  const frustum = new THREE.Frustum().setFromProjectionMatrix(clipOf(camera));
  const seen: number[] = [], m = new THREE.Matrix4(), box = new THREE.Sphere();
  for (let k = 0; k < n * n; k++) {
    m.fromArray(full, 16 * k);
    box.set(new THREE.Vector3().setFromMatrixPosition(m), 3 * 1.0001);
    if (frustum.intersectsSphere(box)) seen.push(k);
  }
  assert.ok(seen.length > 0 && mesh.count < n * n && mesh.count >= seen.length, `kept ${mesh.count} of ${n * n}, ${seen.length} on screen`);
  // Every on-screen instance is in the buffer, with its colour, in the original order.
  const kept: number[] = [];
  for (let j = 0; j < mesh.count; j++) {
    const x = mesh.instanceMatrix.array[16 * j + 12], y = mesh.instanceMatrix.array[16 * j + 13];
    const k = Math.round(y / step) * n + Math.round(x / step);
    kept.push(k);
    assert.equal(mesh.instanceColor!.array[3 * j], colours[3 * k]);
  }
  assert.deepEqual([...kept].sort((a, b) => a - b), kept, 'original order');
  for (const k of seen) assert.ok(kept.includes(k), `on-screen instance ${k} kept`);
  // Nothing missing: no upload. A turn away: a new set.
  assert.equal(cull.update(clipOf(camera)), false);
  camera.lookAt(380, 300, 0);
  assert.equal(cull.update(clipOf(camera)), true);
  cull.restore();
  assert.equal(mesh.count, n * n);
  assert.deepEqual(Array.from(mesh.instanceMatrix.array), Array.from(full));
  assert.ok(CULL_MARGIN > 0);
});

test('treeCullFlag: on unless ?treeCull=0 or the global is false', () => {
  const g = globalThis as any, saved = { location: g.location, flag: g.__canalRecallTreeCull };
  try {
    g.location = { search: '?engine=own' }; assert.equal(treeCullFlag(), true);
    g.location = { search: '?treeCull=0' }; assert.equal(treeCullFlag(), false);
    g.location = { search: '' }; g.__canalRecallTreeCull = false; assert.equal(treeCullFlag(), false);
  } finally { g.location = saved.location; g.__canalRecallTreeCull = saved.flag; }
});
