import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as THREE from 'three';

import {
  SHADOW_ONLY_LAYER, SHADOW_STAND_IN_SOURCE, buildShadowStandIn, canStandIn, disposeShadowStandIn, shadowOnlyLayerPass, shadowSideOf,
} from './shadowStandIns';
import { SharedFrame } from './sharedFrame';

function box(material: THREE.Material, x = 0): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(2, 4, 6), material);
  mesh.position.set(x, 1, 0);
  mesh.castShadow = true;
  return mesh;
}

/** World-space triangles a mesh tree casts, in the winding three draws (a mirrored matrix flips the front face). */
function castTriangles(root: THREE.Object3D, standIn = false): number[][] {
  root.updateMatrixWorld(true);
  const out: number[][] = [], v = new THREE.Vector3();
  root.traverse(object => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh || !mesh.castShadow || mesh.layers.isEnabled(SHADOW_ONLY_LAYER) !== standIn) return;
    const g = mesh.geometry, p = g.attributes.position as THREE.BufferAttribute, idx = g.index;
    const flip = mesh.matrixWorld.determinant() < 0, n = idx ? idx.count : p.count;
    for (let i = 0; i < n; i += 3) {
      const order = flip ? [0, 2, 1] : [0, 1, 2];
      out.push(order.flatMap(j => v.fromBufferAttribute(p, idx ? idx.getX(i + j) : i + j).applyMatrix4(mesh.matrixWorld).toArray()));
    }
  });
  return out;
}

/** Same triangles with the same winding (any starting corner), each corner within `tolerance`. */
function sameTriangles(a: number[][], b: number[][], tolerance: number): boolean {
  if (a.length !== b.length) return false;
  const left = [...b];
  const near = (t: number[], u: number[], shift: number) => t.every((c, i) => Math.abs(c - u[(i + shift * 3) % 9]) <= tolerance);
  for (const t of a) {
    const k = left.findIndex(u => near(t, u, 0) || near(t, u, 1) || near(t, u, 2));
    if (k < 0) return false;
    left.splice(k, 1);
  }
  return true;
}

test('shadow side follows three: single-sided materials cast their far faces', () => {
  assert.equal(shadowSideOf({ side: THREE.FrontSide }), THREE.BackSide);
  assert.equal(shadowSideOf({ side: THREE.BackSide }), THREE.FrontSide);
  assert.equal(shadowSideOf({ side: THREE.DoubleSide }), THREE.DoubleSide);
  assert.equal(shadowSideOf({ side: THREE.DoubleSide, shadowSide: THREE.BackSide }), THREE.BackSide);
});

test('only plain depth casters are merged', () => {
  const plain = box(new THREE.MeshStandardMaterial());
  assert.equal(canStandIn(plain), true);
  assert.equal(canStandIn(box(new THREE.MeshStandardMaterial({ alphaTest: 0.5 }))), false);
  assert.equal(canStandIn(box(new THREE.MeshStandardMaterial({ visible: false }))), false);
  const multi = new THREE.Mesh(new THREE.BoxGeometry(), [new THREE.MeshBasicMaterial(), new THREE.MeshBasicMaterial()]);
  multi.castShadow = true;
  assert.equal(canStandIn(multi), false);
  const custom = box(new THREE.MeshStandardMaterial()); custom.customDepthMaterial = new THREE.MeshDepthMaterial();
  assert.equal(canStandIn(custom), false);
  const instanced = new THREE.InstancedMesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial(), 2); instanced.castShadow = true;
  assert.equal(canStandIn(instanced), false);
  plain.castShadow = false;
  assert.equal(canStandIn(plain), false);
});

test('the stand-in casts the same triangles, one mesh per shadow side, and the sources stop casting', () => {
  const model = new THREE.Group();
  model.position.set(-3, 0, 2);
  const part = new THREE.Group(); part.rotation.y = 0.7; part.scale.set(-1, 1, 1); // mirrored part: winding must survive
  model.add(box(new THREE.MeshStandardMaterial(), 0), box(new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, shadowSide: THREE.BackSide }), 5), part);
  part.add(box(new THREE.MeshStandardMaterial({ side: THREE.DoubleSide }), -4));
  const hidden = box(new THREE.MeshStandardMaterial(), 9); hidden.visible = false; model.add(hidden);
  const cutout = box(new THREE.MeshStandardMaterial({ alphaTest: 0.5 }), 12); model.add(cutout);
  const holder = new THREE.Group(); holder.add(model);
  const before = castTriangles(holder);

  const standIn = buildShadowStandIn(THREE, model)!;
  assert.ok(standIn);
  standIn.object.matrix.copy(model.matrix.compose(model.position, model.quaternion, model.scale));
  holder.add(standIn.object);
  assert.equal(standIn.sources.length, 3);
  assert.equal(standIn.object.children.length, 2, 'BackSide and DoubleSide');
  for (const mesh of standIn.sources) { assert.equal(mesh.castShadow, false); assert.equal(mesh.userData[SHADOW_STAND_IN_SOURCE], true); }
  assert.equal(cutout.castShadow, true, 'alpha-tested part still casts itself');
  assert.equal(standIn.triangles, 36);
  for (const mesh of standIn.object.children as THREE.Mesh[]) {
    assert.equal(mesh.layers.mask, 1 << SHADOW_ONLY_LAYER);
    assert.ok((mesh.geometry.attributes.position.array as unknown) instanceof Int16Array);
  }
  // Same casters (cutout from itself, the rest from the stand-in), within the int16 quantisation step.
  const after = [...castTriangles(holder), ...castTriangles(holder, true)];
  assert.ok(sameTriangles(after, before, 1e-3));

  // setShadows (run again on every level swap) must not turn a source back on.
  SharedFrame.setShadows(model, true, true);
  for (const mesh of standIn.sources) assert.equal(mesh.castShadow, false);

  disposeShadowStandIn(standIn, true);
  assert.equal(standIn.object.parent, null);
  for (const mesh of standIn.sources) assert.equal(mesh.castShadow, true);
});

test('nothing to merge gives no stand-in', () => {
  const model = new THREE.Group();
  model.add(box(new THREE.MeshStandardMaterial({ alphaTest: 0.5 })));
  assert.equal(buildShadowStandIn(THREE, model), null);
});

test('the shadow pass sees the stand-in layer; the camera never keeps it', () => {
  const seen: boolean[] = [];
  const renderer = { shadowMap: { render(_l: unknown, _s: unknown, camera: THREE.Camera) { seen.push(camera.layers.isEnabled(SHADOW_ONLY_LAYER)); } } };
  shadowOnlyLayerPass(renderer);
  shadowOnlyLayerPass(renderer); // idempotent
  const camera = new THREE.PerspectiveCamera();
  renderer.shadowMap.render([], null, camera);
  assert.deepEqual(seen, [true]);
  assert.equal(camera.layers.isEnabled(SHADOW_ONLY_LAYER), false);
  assert.equal(camera.layers.isEnabled(0), true);
});
