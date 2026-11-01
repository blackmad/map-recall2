// Run: node --import tsx --test src/canalRecall/rendererShared/drawnWorld.test.ts
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { updateDrawnWorld, type WorldNode } from './drawnWorld';

/** Every node whose whole ancestry is visible: what three can draw. */
function drawable(root: THREE.Object3D): THREE.Object3D[] {
  const out: THREE.Object3D[] = [];
  const walk = (o: THREE.Object3D) => { if (!o.visible) return; out.push(o); for (const c of o.children) walk(c); };
  walk(root);
  return out;
}

function randomScene(seed: number): { scene: THREE.Scene; all: THREE.Object3D[] } {
  let s = seed >>> 0; const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; };
  const scene = new THREE.Scene(), all: THREE.Object3D[] = [scene];
  for (let i = 0; i < 300; i++) {
    const o = rnd() < 0.5 ? new THREE.Group() : new THREE.Mesh();
    o.position.set(rnd() * 100 - 50, rnd() * 100 - 50, rnd() * 10);
    o.rotation.set(rnd(), rnd(), rnd());
    o.scale.setScalar(0.5 + rnd());
    o.visible = rnd() > 0.25;
    o.matrixAutoUpdate = rnd() > 0.3;
    if (!o.matrixAutoUpdate) o.updateMatrix();
    all[Math.floor(rnd() * all.length)].add(o);
    all.push(o);
  }
  return { scene, all };
}

test('updateDrawnWorld: every drawable node gets the world matrix three computes, frame after frame', () => {
  for (const seed of [1, 7, 42, 1234]) {
    const a = randomScene(seed), b = randomScene(seed);
    let s = seed * 31 >>> 0; const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; };
    for (let frame = 0; frame < 20; frame++) {
      // The same changes in both: an eye-relative wrapper moves, nodes move, visibility flips (a node shows again).
      for (let i = 1; i < a.all.length; i++) {
        const r = rnd(), r2 = rnd();
        if (r < 0.05) { a.all[i].visible = !a.all[i].visible; b.all[i].visible = a.all[i].visible; }
        if (r2 < 0.1) {
          a.all[i].position.x += 1; b.all[i].position.x += 1;
          if (!a.all[i].matrixAutoUpdate) { a.all[i].updateMatrix(); b.all[i].updateMatrix(); }
        }
      }
      a.scene.updateMatrixWorld();
      updateDrawnWorld(b.scene as unknown as WorldNode);
      const da = drawable(a.scene), db = drawable(b.scene);
      assert.equal(da.length, db.length);
      for (let k = 0; k < da.length; k++) assert.deepEqual(db[k].matrixWorld.elements, da[k].matrixWorld.elements, `seed ${seed} frame ${frame} node ${k}`);
    }
  }
});

test('updateDrawnWorld: hidden subtrees are not visited', () => {
  const scene = new THREE.Scene(), hidden = new THREE.Group();
  hidden.visible = false;
  for (let i = 0; i < 50; i++) hidden.add(new THREE.Mesh());
  scene.add(hidden, new THREE.Mesh());
  assert.equal(updateDrawnWorld(scene as unknown as WorldNode), 2);
});

test('updateDrawnWorld: a child hidden while its static parent moved shows with the moved world matrix', () => {
  const mk = () => {
    const scene = new THREE.Scene(), parent = new THREE.Group(), child = new THREE.Mesh(), leaf = new THREE.Mesh();
    parent.matrixAutoUpdate = false; child.matrixAutoUpdate = false; leaf.matrixAutoUpdate = false;
    child.position.set(1, 2, 3); child.updateMatrix(); leaf.position.set(0, 0, 5); leaf.updateMatrix();
    scene.add(parent); parent.add(child); child.add(leaf);
    return { scene, parent, child, leaf };
  };
  const a = mk(), b = mk();
  a.scene.updateMatrixWorld(); updateDrawnWorld(b.scene as unknown as WorldNode);
  for (const x of [a, b]) { x.child.visible = false; x.parent.position.set(10, 0, 0); x.parent.updateMatrix(); x.parent.matrixWorldNeedsUpdate = true; }
  a.scene.updateMatrixWorld(); updateDrawnWorld(b.scene as unknown as WorldNode);
  for (const x of [a, b]) x.child.visible = true;
  a.scene.updateMatrixWorld(); updateDrawnWorld(b.scene as unknown as WorldNode);
  assert.deepEqual(b.child.matrixWorld.elements, a.child.matrixWorld.elements);
  assert.deepEqual(b.leaf.matrixWorld.elements, a.leaf.matrixWorld.elements);
  assert.equal(b.leaf.matrixWorld.elements[12], 11);
});
