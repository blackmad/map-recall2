import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { InstanceCull } from './instanceCull';
import { DroppedTileCache, keepTiles, treeTileKeepFlag } from './treeTileKeep';
import { treeShadowFadeFlag } from './treeFade';

const ranked = (n: number) => Array.from({ length: n }, (_, i) => `t${i}`);

test('off (no keep band) is the nearest budget, as before', () => {
  assert.deepEqual([...keepTiles(ranked(20), new Set(['t15']), { budget: 12, keepExtra: 0 })], ranked(12));
});

test('a resident tile inside the keep band stays; a new one there is not added; past the band it leaves', () => {
  const keys = keepTiles(ranked(20), new Set(['t13', 't14', 't16', 't3']), { budget: 12, keepExtra: 4 });
  assert.ok(keys.has('t13') && keys.has('t14'));
  assert.ok(!keys.has('t12') && !keys.has('t15'), 'not resident: not added past the budget');
  assert.ok(!keys.has('t16'), 'past budget + keepExtra');
  assert.equal(keys.size, 14);
});

test('the oscillating pair of P5 (a tile at rank 12/13 swapping) no longer drops and refetches', () => {
  let resident = keepTiles(['a', 'b', 'x', 'y'], new Set(), { budget: 3, keepExtra: 1 }); // a b x
  resident = keepTiles(['a', 'b', 'y', 'x'], resident, { budget: 3, keepExtra: 1 }); // y enters, x kept at rank 3
  assert.deepEqual([...resident].sort(), ['a', 'b', 'x', 'y']);
  resident = keepTiles(['a', 'b', 'x', 'y'], resident, { budget: 3, keepExtra: 1 });
  assert.deepEqual([...resident].sort(), ['a', 'b', 'x', 'y']);
});

test('the dropped cache restores within cacheMs, expires after, and evicts the oldest past cacheMax', () => {
  const c = new DroppedTileCache<number[]>({ cacheMax: 2, cacheMs: 1000 });
  const a = [1], b = [2], d = [3];
  c.put('a', a, 0); c.put('b', b, 100);
  assert.equal(c.take('a', 900), a);
  assert.equal(c.take('a', 900), undefined, 'taken: resident again');
  c.put('a', a, 950); c.put('d', d, 960); // b is oldest -> evicted
  assert.equal(c.size, 2); assert.equal(c.take('b', 970), undefined);
  assert.equal(c.take('d', 2000), undefined, 'expired');
  assert.equal(c.restores, 1);
  const off = new DroppedTileCache<number[]>({ cacheMax: 0, cacheMs: 1000 });
  off.put('a', a, 0); assert.equal(off.size, 0);
});

test('flags: tile keep and shadow fade default on, off by query or global', () => {
  assert.equal(treeTileKeepFlag(), true);
  assert.equal(treeShadowFadeFlag(), true);
  (globalThis as any).__canalRecallTreeTileKeep = '0'; (globalThis as any).__canalRecallTreeShadowFade = false;
  try { assert.equal(treeTileKeepFlag(), false); assert.equal(treeShadowFadeFlag(), false); }
  finally { delete (globalThis as any).__canalRecallTreeTileKeep; delete (globalThis as any).__canalRecallTreeShadowFade; }
});

test('a shadow twin with per-instance extras gets full copies; shared attributes survive disposeShadow', () => {
  const base = new THREE.BoxGeometry(1, 1, 1);
  const g = new THREE.BufferGeometry();
  for (const [k, v] of Object.entries(base.attributes)) g.setAttribute(k, v as any);
  g.setIndex(base.index); g.setAttribute('treeFade', new THREE.InstancedBufferAttribute(Float32Array.from([0, 5, -7]), 1));
  const mesh = new THREE.InstancedMesh(g, new THREE.MeshBasicMaterial(), 3);
  [0, 100, 200].forEach((x, i) => mesh.setMatrixAt(i, new THREE.Matrix4().makeTranslation(x, 0, 0)));
  const c = new InstanceCull(THREE, mesh, { castShadow: true });
  const twin = c.shadow;
  assert.notEqual(twin.geometry, mesh.geometry);
  assert.equal(twin.geometry.attributes.position, g.attributes.position, 'plain attributes shared');
  assert.notEqual(twin.geometry.attributes.treeFade, g.attributes.treeFade);
  assert.deepEqual([...twin.geometry.attributes.treeFade.array], [0, 5, -7]);
  // Cull to the first instance only: the mesh's fade is compacted, the twin's stays full.
  const cam = new THREE.OrthographicCamera(-10, 10, 10, -10, 0.1, 100); cam.position.set(0, 0, 50); cam.updateMatrixWorld(); cam.updateProjectionMatrix();
  c.update(new THREE.Matrix4().multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse));
  assert.equal(mesh.count, 1);
  assert.deepEqual([...twin.geometry.attributes.treeFade.array], [0, 5, -7]);
  let disposed = 0; twin.geometry.addEventListener('dispose', () => disposed++);
  c.disposeShadow();
  assert.equal(disposed, 1);
  assert.ok(g.attributes.position && g.index, 'the mesh keeps its attributes');
  assert.equal(Object.keys(twin.geometry.attributes).join(), 'treeFade', 'only the own copy left to free');
});

test('without extras the twin draws the mesh geometry (unchanged path)', () => {
  const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial(), 2);
  const c = new InstanceCull(THREE, mesh, { castShadow: true });
  assert.equal(c.shadow.geometry, mesh.geometry);
  c.disposeShadow();
  assert.ok(mesh.geometry.attributes.position);
});
