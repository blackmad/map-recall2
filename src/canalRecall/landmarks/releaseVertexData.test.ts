import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { hasReleasedVertexData, releaseVertexDataOnUpload } from './releaseVertexData.ts';

/** What three's WebGLAttributes does after creating a buffer. */
const upload = (attribute: THREE.BufferAttribute) => (attribute as any).onUploadCallback();

test('non-position attributes drop their arrays on upload; position and index stay', () => {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial());
  const g = mesh.geometry, root = new THREE.Group().add(mesh);
  const counts = { normal: g.attributes.normal.count, uv: g.attributes.uv.count };
  assert.equal(releaseVertexDataOnUpload(root), 2);
  assert.equal(releaseVertexDataOnUpload(root), 0, 'marking twice is a no-op');
  assert.equal(hasReleasedVertexData(root), false);
  for (const name of Object.keys(g.attributes)) upload(g.attributes[name] as THREE.BufferAttribute);
  upload(g.index!);
  assert.equal(g.attributes.normal.array.length, 0);
  assert.ok(g.attributes.normal.array instanceof Float32Array);
  assert.equal(g.attributes.uv.array.length, 0);
  assert.equal(g.attributes.normal.count, counts.normal, 'count keeps draw ranges');
  assert.equal(g.attributes.uv.count, counts.uv);
  assert.equal(g.attributes.position.array.length, 24 * 3);
  assert.equal(g.index!.array.length, 36);
  assert.equal(hasReleasedVertexData(root), true);
});

test('three\'s raycast still hits a released mesh (the picker fallback before its BVH exists)', () => {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2), new THREE.MeshBasicMaterial());
  releaseVertexDataOnUpload(mesh);
  for (const name of Object.keys(mesh.geometry.attributes)) upload(mesh.geometry.attributes[name] as THREE.BufferAttribute);
  mesh.updateMatrixWorld();
  const raycaster = new THREE.Raycaster(new THREE.Vector3(0, 0, 10), new THREE.Vector3(0, 0, -1));
  const hits = raycaster.intersectObject(mesh);
  assert.ok(hits.length > 0);
  assert.ok(Math.abs(hits[0].distance - 9) < 1e-9);
  assert.ok(Math.abs(hits[0].point.z - 1) < 1e-9);
});

test('skipped geometries and interleaved attributes are left alone', () => {
  const skipped = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
  skipped.geometry.userData.pandRanges = [[0, 1]];
  const interleaved = new THREE.BufferGeometry();
  const buffer = new THREE.InterleavedBuffer(new Float32Array(3 * 5), 5);
  interleaved.setAttribute('position', new THREE.InterleavedBufferAttribute(buffer, 3, 0));
  interleaved.setAttribute('uv', new THREE.InterleavedBufferAttribute(buffer, 2, 3));
  const root = new THREE.Group().add(skipped, new THREE.Mesh(interleaved));
  assert.equal(releaseVertexDataOnUpload(root, g => !!g.userData.pandRanges), 0);
});
