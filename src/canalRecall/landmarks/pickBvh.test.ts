import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { buildPickBvhs, meshBvh, nearestVisibleHit } from './pickBvh.ts';

let seed = 7;
const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32; };

/** A model like a landmark GLB: a few meshes of random triangles, mixed sides, groups, draw ranges. */
function model(): THREE.Group {
  const group = new THREE.Group();
  const inner = new THREE.Group();
  inner.position.set(rnd() * 4 - 2, 0, rnd() * 4 - 2);
  inner.rotation.y = rnd() * 3;
  group.add(inner);
  group.scale.set(-1.3, 1.3, 1.3); // mirrored instance
  const sides = [THREE.FrontSide, THREE.BackSide, THREE.DoubleSide];
  for (let m = 0; m < 6; m++) {
    const tris = 200 + Math.floor(rnd() * 400);
    const pos = new Float32Array(tris * 9);
    for (let t = 0; t < tris; t++) {
      const cx = rnd() * 20 - 10, cy = rnd() * 20, cz = rnd() * 20 - 10;
      for (let k = 0; k < 9; k += 3) { pos[t * 9 + k] = cx + rnd() * 3 - 1.5; pos[t * 9 + k + 1] = cy + rnd() * 3 - 1.5; pos[t * 9 + k + 2] = cz + rnd() * 3 - 1.5; }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    // A grid-aligned shared edge, so exact ties happen.
    pos.set([0, 0, 0, 4, 0, 0, 0, 4, 0, 4, 0, 0, 4, 4, 0, 0, 4, 0], 0);
    if (m % 2 === 0) {
      // Indexed (identity index) to exercise index reads.
      g.setIndex(Array.from({ length: tris * 3 }, (_, i) => i));
    }
    let material: THREE.Material | THREE.Material[];
    if (m % 3 === 0) {
      material = [new THREE.MeshBasicMaterial({ side: sides[m % 3] }), new THREE.MeshBasicMaterial({ side: sides[(m + 1) % 3] })];
      g.addGroup(0, Math.floor(tris / 2) * 3, 0);
      g.addGroup(Math.floor(tris / 2) * 3, tris * 3, 1);
    } else material = new THREE.MeshBasicMaterial({ side: sides[m % 3] });
    if (m === 4) g.setDrawRange(30, (tris - 20) * 3);
    const mesh = new THREE.Mesh(g, material);
    mesh.position.set(rnd() * 2, rnd() * 2, rnd() * 2);
    mesh.rotation.set(rnd(), rnd(), rnd());
    if (m === 5) mesh.visible = false;
    (m < 3 ? inner : group).add(mesh);
  }
  // An instanced mesh goes through three's own raycast.
  const inst = new THREE.InstancedMesh(new THREE.BoxGeometry(2, 2, 2), new THREE.MeshBasicMaterial(), 5);
  for (let i = 0; i < 5; i++) inst.setMatrixAt(i, new THREE.Matrix4().makeTranslation(rnd() * 16 - 8, rnd() * 16, rnd() * 16 - 8));
  group.add(inst);
  group.updateMatrixWorld(true);
  return group;
}

function three(root: THREE.Object3D, raycaster: THREE.Raycaster) {
  return raycaster.intersectObject(root, true).find(hit => hit.object.visible) ?? null;
}

test('the BVH pick returns what intersectObject(...).find(visible) returns', () => {
  for (let k = 0; k < 4; k++) {
    const root = model();
    // Half the models with every BVH built, half with some meshes still on three's path.
    if (k % 2 === 0) assert.equal(buildPickBvhs(root, Infinity), true);
    else { let i = 0; root.traverse(o => { if ((o as THREE.Mesh).isMesh && i++ % 2 === 0) meshBvh(o as THREE.Mesh); }); }
    let hits = 0;
    for (let r = 0; r < 600; r++) {
      const origin = new THREE.Vector3(rnd() * 80 - 40, rnd() * 60 - 10, rnd() * 80 - 40);
      // Aim at the model most of the time, with exact grid rays now and then (shared-edge ties).
      const target = r % 10 === 0 ? new THREE.Vector3(-2 * 1.3, 2 * 1.3, 0) : new THREE.Vector3(rnd() * 30 - 15, rnd() * 25, rnd() * 30 - 15);
      const raycaster = new THREE.Raycaster(origin, target.sub(origin).normalize());
      const want = three(root, raycaster), got = nearestVisibleHit(root, raycaster);
      if (!want) { assert.equal(got, null, `ray ${r}`); continue; }
      hits++;
      assert.ok(got, `ray ${r}: missed`);
      assert.equal(got!.object, want.object, `ray ${r}: object`);
      assert.equal(got!.distance, want.distance, `ray ${r}: distance`);
      assert.equal(got!.faceIndex, want.faceIndex, `ray ${r}: face`);
      assert.equal(got!.instanceId, want.instanceId, `ray ${r}: instance`);
      assert.ok(got!.point.equals(want.point), `ray ${r}: point`);
    }
    assert.ok(hits > 100, `only ${hits} hits`);
  }
});

test('the BVH is rebuilt when the positions change', () => {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 1, -1, 0, 0, 1, 0]), 3));
  const mesh = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
  mesh.updateMatrixWorld(true);
  buildPickBvhs(mesh);
  const ray = new THREE.Raycaster(new THREE.Vector3(0, 0, 5), new THREE.Vector3(0, 0, -1));
  assert.equal(nearestVisibleHit(mesh, ray)!.distance, 5);
  (g.attributes.position as THREE.BufferAttribute).setZ(0, 2).setZ(1, 2).setZ(2, 2);
  g.attributes.position.needsUpdate = true;
  g.computeBoundingSphere(); g.computeBoundingBox();
  // The stale BVH is not used: three's path answers until it is rebuilt.
  assert.equal(nearestVisibleHit(mesh, ray)!.distance, 3);
  assert.equal(buildPickBvhs(mesh), true);
  assert.equal(nearestVisibleHit(mesh, ray)!.distance, 3);
});

test('buildPickBvhs stops at its budget and resumes', () => {
  const root = new THREE.Group();
  for (let i = 0; i < 4; i++) root.add(new THREE.Mesh(new THREE.SphereGeometry(1, 8, 8), new THREE.MeshBasicMaterial()));
  let clock = 0;
  const now = () => clock++;
  // Each mesh check advances the fake clock by one: a budget of 1 builds one or two per call.
  let calls = 0;
  while (!buildPickBvhs(root, 1, now)) calls++;
  assert.ok(calls >= 1);
  assert.equal(buildPickBvhs(root, 1, now), true);
});
