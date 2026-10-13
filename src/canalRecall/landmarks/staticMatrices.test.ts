import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { freezeStaticMatrices } from './staticMatrices.ts';

function placed() {
  const scene = new THREE.Scene();
  const holder = new THREE.Group();
  const group = new THREE.Group();
  const imported = new THREE.Group();
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
  imported.position.set(-3, 0, 2);
  mesh.position.set(1, 2, 3); mesh.rotation.set(0.3, 0.2, 0.1); mesh.scale.set(2, 2, 2);
  group.scale.set(-1.5, 1.5, 1.5);
  imported.add(mesh); group.add(imported); holder.add(group); scene.add(holder);
  return { scene, holder, group, mesh };
}

test('frozen models get the same world matrices, and follow a moved parent', () => {
  const a = placed(), b = placed();
  a.scene.updateMatrixWorld();
  assert.equal(freezeStaticMatrices(b.group), 3);
  b.scene.updateMatrixWorld();
  assert.deepEqual(b.mesh.matrixWorld.elements, a.mesh.matrixWorld.elements);
  for (const s of [a, b]) { s.holder.position.set(10, 0, -4); s.scene.updateMatrixWorld(); }
  assert.deepEqual(b.mesh.matrixWorld.elements, a.mesh.matrixWorld.elements);
});

test('a frozen object ignores later position edits until updateMatrix, a new child is still updated', () => {
  const { scene, mesh } = placed();
  freezeStaticMatrices(scene);
  scene.updateMatrixWorld();
  const before = mesh.matrixWorld.clone();
  mesh.position.x += 5;
  scene.updateMatrixWorld();
  assert.ok(mesh.matrixWorld.equals(before));
  const pass = new THREE.Mesh(mesh.geometry);
  pass.position.set(0, 1, 0);
  mesh.add(pass);
  scene.updateMatrixWorld();
  assert.ok(pass.matrixWorld.equals(new THREE.Matrix4().multiplyMatrices(mesh.matrixWorld, new THREE.Matrix4().makeTranslation(0, 1, 0))));
});
