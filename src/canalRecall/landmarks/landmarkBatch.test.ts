import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as THREE from 'three';

import { LandmarkBatch, grownCapacity } from './landmarkBatch';

/** A lod2-shaped geometry: indexed, position + normal + colour, `n` triangles. */
function lod2Geometry(n: number): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  const positions = new Float32Array(n * 9), normals = new Float32Array(n * 9), colours = new Float32Array(n * 9).fill(0.5);
  for (let t = 0; t < n; t++) positions.set([t, 0, 0, t + 1, 0, 0, t, 1, 0], t * 9);
  g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  g.setAttribute('color', new THREE.BufferAttribute(colours, 3));
  g.setIndex(Array.from({ length: n * 3 }, (_, i) => i));
  return g;
}

const ORIGIN = [0.51, 0.33, 0] as const;
function makeBatch(extra: Partial<ConstructorParameters<typeof LandmarkBatch>[1]> = {}) {
  const parent = new THREE.Group();
  const configured: string[] = [];
  const batch = new LandmarkBatch(THREE, {
    parent, origin: ORIGIN, material: key => new THREE.MeshLambertMaterial({ vertexColors: true, fog: key !== 'noFade' }),
    configure: (_mesh, key) => configured.push(key), initialInstances: 2, initialVertices: 30, initialIndices: 30, ...extra,
  });
  return { batch, parent, configured };
}

const at = (x: number, y: number) => new THREE.Matrix4().makeTranslation(x, y, 0).multiply(new THREE.Matrix4().makeScale(4e-8, -4e-8, 4e-8));

test('add, remove and re-add keep one instance per model, one batch per key', () => {
  const { batch, parent, configured } = makeBatch();
  const a = lod2Geometry(2), b = lod2Geometry(3);
  assert.ok(batch.add('a', 'fade', a, at(0.5101, 0.3301)));
  assert.ok(batch.add('b', 'noFade', b, at(0.5102, 0.3302)));
  assert.deepEqual(configured, ['fade', 'noFade']);
  assert.equal(parent.children.length, 2);
  assert.equal(batch.stats().instances, 2);
  // Same geometry and key: only the matrix moves.
  assert.ok(batch.add('a', 'fade', a, at(0.5103, 0.3301)));
  assert.equal(batch.stats().instances, 2);
  assert.ok(batch.remove('a'));
  assert.ok(!batch.has('a'));
  assert.ok(!batch.remove('a'));
  assert.equal(batch.stats().instances, 1);
  assert.equal(batch.geometryOf('b'), b);
  // A new level's geometry replaces the old one.
  const b2 = lod2Geometry(1);
  assert.ok(batch.add('b', 'noFade', b2, at(0.5102, 0.3302)));
  assert.equal(batch.geometryOf('b'), b2);
  assert.equal(batch.stats().verticesUsed, 3);
});

test('matrices are stored relative to the origin (float32-safe) and the batch sits at the origin', () => {
  const { batch, parent } = makeBatch();
  batch.add('a', 'fade', lod2Geometry(1), at(0.5101, 0.3302));
  const mesh = parent.children[0] as THREE.BatchedMesh;
  assert.deepEqual(mesh.position.toArray(), [...ORIGIN]);
  const m = new THREE.Matrix4();
  mesh.getMatrixAt(0, m);
  assert.ok(Math.abs(m.elements[12] - 0.0001) < 1e-9, `x ${m.elements[12]}`);
  assert.ok(Math.abs(m.elements[13] - 0.0002) < 1e-9, `y ${m.elements[13]}`);
  // Composed back in float64 it lands where the per-model holder put it.
  const world = new THREE.Matrix4().multiplyMatrices(mesh.matrix, m);
  assert.ok(Math.abs(world.elements[12] - 0.5101) < 1e-9);
  batch.setMatrix('a', at(0.52, 0.33));
  mesh.getMatrixAt(0, m);
  assert.ok(Math.abs(m.elements[12] - 0.01) < 1e-9);
});

test('visibility is per model and idempotent', () => {
  const { batch, parent } = makeBatch();
  batch.add('a', 'fade', lod2Geometry(1), at(0.51, 0.33));
  batch.add('b', 'fade', lod2Geometry(1), at(0.51, 0.33));
  const mesh = parent.children[0] as THREE.BatchedMesh;
  batch.setVisible('a', false);
  batch.setVisible('a', false);
  assert.equal(mesh.getVisibleAt(0), false);
  assert.equal(mesh.getVisibleAt(1), true);
  assert.equal(batch.stats().visible, 1);
  batch.setVisible('missing', false); // no throw
});

test('capacity grows by reallocation and removed space is compacted before growing', () => {
  const { batch } = makeBatch();
  // 30 vertices reserved: three 9-vertex models fit, the fourth forces a reallocation.
  for (const id of ['a', 'b', 'c']) batch.add(id, 'fade', lod2Geometry(3), at(0.51, 0.33));
  assert.equal(batch.stats().reallocations, 1, 'third instance grew the instance texture (2 -> 4)');
  batch.add('d', 'fade', lod2Geometry(3), at(0.51, 0.33));
  const grown = batch.stats();
  assert.ok(grown.vertexCapacity >= 36, `vertex capacity ${grown.vertexCapacity}`);
  assert.ok(grown.reallocations >= 2);
  // Remove two and add one that fits in what is live: compaction, not growth.
  batch.remove('a'); batch.remove('b');
  const before = batch.stats();
  for (const id of ['e', 'f', 'g']) batch.add(id, 'fade', lod2Geometry(3), at(0.51, 0.33));
  const after = batch.stats();
  assert.equal(after.instances, 5);
  assert.equal(after.verticesUsed, 45);
  assert.ok(after.compactions >= 1 || after.reallocations > before.reallocations);
  assert.ok(after.vertexCapacity >= after.verticesUsed);
});

test('a geometry with another attribute layout is refused, not corrupted into the batch', () => {
  const { batch } = makeBatch();
  batch.add('a', 'fade', lod2Geometry(1), at(0.51, 0.33));
  const odd = lod2Geometry(1);
  odd.setAttribute('color', new THREE.BufferAttribute(new Uint16Array(9), 3, true));
  assert.equal(batch.add('b', 'fade', odd, at(0.51, 0.33)), false);
  assert.ok(!batch.has('b'));
});

test('a highlighted model leaves the batch (the adapter removes it) and comes back unchanged', () => {
  const { batch } = makeBatch();
  const g = lod2Geometry(2);
  batch.add('westerkerk', 'noFade', g, at(0.51, 0.33));
  batch.remove('westerkerk');
  assert.equal(batch.stats().instances, 0);
  assert.ok(batch.add('westerkerk', 'noFade', g, at(0.51, 0.33)));
  assert.equal(batch.stats().instances, 1);
});

test('depth bias follows the per-model rule, on existing and new batches', () => {
  const { batch, parent } = makeBatch();
  batch.add('a', 'fade', lod2Geometry(1), at(0.51, 0.33));
  batch.setDepthBias(-1);
  const m = (parent.children[0] as THREE.Mesh).material as THREE.Material;
  assert.equal(m.polygonOffset, true);
  assert.equal(m.polygonOffsetUnits, -4096);
  batch.add('b', 'noFade', lod2Geometry(1), at(0.51, 0.33));
  assert.equal(((parent.children[1] as THREE.Mesh).material as THREE.Material).polygonOffsetUnits, -4096);
  batch.setDepthBias(0);
  assert.equal(m.polygonOffset, false);
});

test('grownCapacity grows by half at least', () => {
  assert.equal(grownCapacity(100, 90, 20), 165);
  assert.equal(grownCapacity(1000, 10, 5), 1500);
});

test('dispose removes the batches from the parent', () => {
  const { batch, parent } = makeBatch();
  batch.add('a', 'fade', lod2Geometry(1), at(0.51, 0.33));
  batch.dispose();
  assert.equal(parent.children.length, 0);
  assert.equal(batch.size, 0);
});

test('mergeLevelByLook: one mesh per look, colours moved into vertex colours, positions in root space', async () => {
  const { mergeLevelByLook } = await import('./landmarkBatch');
  const root = new THREE.Group();
  const box = () => new THREE.BoxGeometry(1, 1, 1);
  const brick = new THREE.MeshLambertMaterial({ color: 0x884422 }), stone = new THREE.MeshLambertMaterial({ color: 0xcccccc });
  const glass = new THREE.MeshLambertMaterial({ color: 0x223344 }); glass.emissive.setRGB(0.035, 0.05, 0.07);
  const a = new THREE.Mesh(box(), brick), b = new THREE.Mesh(box(), stone), c = new THREE.Mesh(box(), glass), d = new THREE.Mesh(box(), glass.clone());
  b.position.set(10, 0, 0); b.updateMatrix();
  const holder = new THREE.Group(); holder.add(b);
  root.add(a, holder, c, d);
  const { before, after } = mergeLevelByLook(THREE, root);
  assert.equal(before, 4);
  assert.equal(after, 2, 'walls in one, the two glass meshes (same emissive tint) in another');
  const merged = root.children.filter((o: any) => o.isMesh && o.material.vertexColors) as THREE.Mesh[];
  assert.equal(merged.length, 2);
  const walls = merged.find(m => (m.material as THREE.MeshLambertMaterial).emissive.getHex() === 0)!;
  const colour = walls.geometry.getAttribute('color');
  const brickLinear = new THREE.Color(0x884422);
  assert.ok(Math.abs(colour.getX(0) - brickLinear.r) < 1e-6);
  assert.equal((walls.material as THREE.MeshLambertMaterial).color.getHex(), 0xffffff);
  walls.geometry.computeBoundingBox();
  assert.ok(Math.abs(walls.geometry.boundingBox!.max.x - 10.5) < 1e-6, 'nested mesh placed through its parents');
});
