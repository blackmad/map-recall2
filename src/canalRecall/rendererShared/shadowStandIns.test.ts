import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as THREE from 'three';

import {
  SHADOW_ONLY_LAYER, SHADOW_STAND_IN_PENDING, SHADOW_STAND_IN_SOURCE, answerStandIn, buildShadowStandIn, canStandIn, disposeShadowStandIn, isStandInRequest, shadowOnlyLayerPass, shadowSideOf, shadowStandInFor,
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
  // Welded: each box's 24 split corners are its 8 positions.
  assert.deepEqual((standIn.object.children as THREE.Mesh[]).map(m => m.geometry.attributes.position.count).sort(), [16, 8].sort());
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

// ------------------------------------------------------------------ #129: the weld in the worker pool is exact
// The main-thread build as it was before the split (HEAD bdce74817), kept here as the reference.
function legacyBuildShadowStandIn(THREE: any, root: any): any {
  const bySide = new Map<number, { mesh: any; matrix: any }[]>();
  const matrixWithin = (THREE: any, root: any, mesh: any) => { const out = new THREE.Matrix4(); for (let object = mesh; object && object !== root; object = object.parent) { if (object.matrixAutoUpdate) object.updateMatrix(); out.premultiply(object.matrix); } return out; };
  const visibleWithin = (root: any, mesh: any) => { for (let object = mesh; object && object !== root; object = object.parent) if (!object.visible) return false; return true; };
  root.traverse((mesh: any) => {
    if (!canStandIn(mesh) || !visibleWithin(root, mesh)) return;
    const side = shadowSideOf(mesh.material);
    if (!bySide.has(side)) bySide.set(side, []);
    bySide.get(side)!.push({ mesh, matrix: matrixWithin(THREE, root, mesh) });
  });
  if (!bySide.size) return null;
  const object = new THREE.Group();
  object.name = 'shadow-stand-in';
  object.matrixAutoUpdate = false;
  const sources: any[] = [];
  let triangles = 0, bytes = 0;
  const v = new THREE.Vector3();
  for (const [side, parts] of bySide) {
    // Bounds of the transformed vertices, then quantise over the largest half extent.
    const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
    let vertexCount = 0, indexCount = 0;
    for (const { mesh, matrix } of parts) {
      const position = mesh.geometry.attributes.position;
      for (let i = 0; i < position.count; i++) {
        v.fromBufferAttribute(position, i).applyMatrix4(matrix);
        if (v.x < min[0]) min[0] = v.x; if (v.y < min[1]) min[1] = v.y; if (v.z < min[2]) min[2] = v.z;
        if (v.x > max[0]) max[0] = v.x; if (v.y > max[1]) max[1] = v.y; if (v.z > max[2]) max[2] = v.z;
      }
      vertexCount += position.count;
      indexCount += mesh.geometry.index ? mesh.geometry.index.count : position.count;
    }
    if (!vertexCount || !indexCount) continue;
    const centre = [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2];
    const half = Math.max(max[0] - min[0], max[1] - min[1], max[2] - min[2], 1e-6) / 2;
    const q = 32767 / half;
    // Weld on the quantised position: GLB vertices are split by normal and uv, the depth pass needs neither
    // (a flat-shaded box's 24 corners are 8). Key: three 16-bit fields in one exact double.
    const welded = new Map<number, number>();
    const quantised = new Int16Array(vertexCount * 3);
    const remap = new Uint32Array(vertexCount);
    const index = new Uint32Array(indexCount);
    let vo = 0, unique = 0, io = 0;
    for (const { mesh, matrix } of parts) {
      const geometry = mesh.geometry, position = geometry.attributes.position;
      // A mirrored part turns its triangles inside out: swap two corners to keep the cast side.
      const flip = matrix.determinant() < 0;
      for (let i = 0; i < position.count; i++) {
        v.fromBufferAttribute(position, i).applyMatrix4(matrix);
        const x = Math.round((v.x - centre[0]) * q), y = Math.round((v.y - centre[1]) * q), z = Math.round((v.z - centre[2]) * q);
        const key = ((x + 32768) * 65536 + (y + 32768)) * 65536 + (z + 32768);
        let at = welded.get(key);
        if (at === undefined) {
          at = unique++;
          welded.set(key, at);
          quantised[at * 3] = x; quantised[at * 3 + 1] = y; quantised[at * 3 + 2] = z;
        }
        remap[vo + i] = at;
      }
      const source = geometry.index ? geometry.index.array : null;
      const count = source ? source.length : position.count;
      for (let i = 0; i + 2 < count; i += 3) {
        const a = remap[vo + (source ? source[i] : i)], b = remap[vo + (source ? source[i + 1] : i + 1)], c = remap[vo + (source ? source[i + 2] : i + 2)];
        // Welding can collapse a sliver to a line or point: it casts nothing, drop it.
        if (a === b || b === c || a === c) continue;
        index[io++] = a; index[io++] = flip ? c : b; index[io++] = flip ? b : c;
      }
      vo += position.count;
      mesh.castShadow = false;
      mesh.userData[SHADOW_STAND_IN_SOURCE] = true;
      sources.push(mesh);
    }
    if (!io) continue;
    const positions = quantised.slice(0, unique * 3);
    const indices = unique > 65535 ? index.slice(0, io) : Uint16Array.from(index.subarray(0, io));
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3, true));
    geometry.setIndex(new THREE.BufferAttribute(indices, 1));
    geometry.computeBoundingSphere();
    geometry.computeBoundingBox();
    // The CPU copies are not needed once uploaded.
    for (const attribute of [geometry.attributes.position, geometry.index]) attribute.onUpload(function (this: any) { this.array = null; });
    const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ side }));
    mesh.name = `shadow-stand-in-${side}`;
    mesh.layers.set(SHADOW_ONLY_LAYER);
    mesh.castShadow = true;
    mesh.receiveShadow = false;
    mesh.matrixAutoUpdate = false;
    // Normalised int16 reads back as [-1, 1]: scale by the half extent.
    mesh.matrix.makeScale(half, half, half).setPosition(centre[0], centre[1], centre[2]);
    mesh.raycast = () => {};
    object.add(mesh);
    triangles += io / 3;
    bytes += positions.byteLength + indices.byteLength;
  }
  return object.children.length ? { object, sources, triangles, bytes } : null;
}

/** A scene with every attribute shape a GLB gives: plain float, normalised int16, interleaved, non-indexed, 8-bit index, mirrored and nested matrices, both shadow sides, hidden and non-casting meshes, > 65535 welded vertices. */
function glbLikeScene(seed: number): THREE.Group {
  let s = seed;
  const rnd = () => (s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32;
  const root = new THREE.Group();
  root.position.set(rnd() * 100, rnd() * 10, rnd() * 100); root.rotation.set(rnd(), rnd() * 6, rnd()); root.scale.setScalar(0.5 + rnd());
  const front = new THREE.MeshStandardMaterial(), double = new THREE.MeshStandardMaterial({ side: THREE.DoubleSide }), back = new THREE.MeshStandardMaterial({ side: THREE.BackSide });
  const add = (g: THREE.BufferGeometry, m: THREE.Material, parent: THREE.Object3D = root) => { const mesh = new THREE.Mesh(g, m); mesh.name = `part-${root.children.length}-${parent.children.length}`; mesh.castShadow = true; mesh.position.set(rnd() * 40 - 20, rnd() * 30, rnd() * 40 - 20); mesh.rotation.set(rnd() * 3, rnd() * 3, rnd() * 3); parent.add(mesh); return mesh; };
  add(new THREE.BoxGeometry(3, 8, 2), front);
  add(new THREE.SphereGeometry(4, 40, 30), double);
  add(new THREE.CylinderGeometry(1, 2, 12, 24).toNonIndexed(), back);
  const sub = new THREE.Group(); sub.scale.set(-1, 1, 1); sub.position.set(5, 0, 5); root.add(sub);
  add(new THREE.TorusKnotGeometry(3, 0.8, 120, 16), front, sub);
  // Normalised int16 positions (KHR_mesh_quantization) with an 8-bit index.
  const q = new THREE.BufferGeometry(), n = 60, qp = new Int16Array(n * 3), qi = new Uint8Array((n - 2) * 3);
  for (let i = 0; i < qp.length; i++) qp[i] = Math.round((rnd() * 2 - 1) * 32767);
  for (let t = 0; t < n - 2; t++) qi.set([0, t + 1, t + 2], t * 3);
  q.setAttribute('position', new THREE.BufferAttribute(qp, 3, true)); q.setIndex(new THREE.BufferAttribute(qi, 1));
  add(q, front).scale.setScalar(7);
  // Interleaved position (offset 0) with uv beside it.
  const ib = new THREE.InterleavedBuffer(new Float32Array(Array.from({ length: 90 * 5 }, () => rnd() * 10)), 5), ig = new THREE.BufferGeometry();
  ig.setAttribute('position', new THREE.InterleavedBufferAttribute(ib, 3, 0)); ig.setAttribute('uv', new THREE.InterleavedBufferAttribute(ib, 2, 3));
  add(ig, double);
  // Big enough to weld past 65535 vertices (32-bit index).
  add(new THREE.SphereGeometry(10, 400, 200), front);
  add(new THREE.BoxGeometry(1, 1, 1), front).visible = false;
  add(new THREE.BoxGeometry(1, 1, 1), front).castShadow = false;
  root.updateMatrixWorld(true);
  return root;
}

const bytesOf = (a: ArrayBufferView) => Buffer.from(a.buffer, a.byteOffset, a.byteLength);
function assertSameStandIn(a: any, b: any, what: string): void {
  assert.equal(!!a, !!b, `${what}: built`);
  if (!a) return;
  assert.equal(a.triangles, b.triangles, `${what}: triangles`); assert.equal(a.bytes, b.bytes, `${what}: bytes`);
  assert.equal(a.sources.length, b.sources.length, `${what}: sources`);
  a.sources.forEach((m: any, i: number) => assert.equal(m.name, b.sources[i].name, `${what}: source ${i}`));
  assert.equal(a.object.children.length, b.object.children.length, `${what}: sides`);
  a.object.children.forEach((m: any, i: number) => {
    const o = b.object.children[i];
    assert.equal(m.material.side, o.material.side, `${what}: side ${i}`);
    assert.deepEqual(m.matrix.elements, o.matrix.elements, `${what}: side ${i} matrix`);
    assert.ok(bytesOf(m.geometry.attributes.position.array).equals(bytesOf(o.geometry.attributes.position.array)), `${what}: side ${i} positions`);
    assert.equal(m.geometry.index.array.constructor, o.geometry.index.array.constructor, `${what}: side ${i} index type`);
    assert.ok(bytesOf(m.geometry.index.array).equals(bytesOf(o.geometry.index.array)), `${what}: side ${i} index`);
  });
}

/** A one-worker pool that answers on the next tick through a structured clone with transfer, as a real worker does. */
function fakePool() {
  const subs: ((data: unknown, w: number) => boolean)[] = [];
  const pool = { live: 1, size: 1, posts: 0, alive: () => true, subscribe: (on: (data: unknown, w: number) => boolean) => { subs.push(on); return () => {}; },
    post(_w: number, message: unknown, transfer: Transferable[] = []) {
      pool.posts++;
      const msg = structuredClone(message, { transfer });
      setTimeout(() => { if (isStandInRequest(msg)) answerStandIn(msg, (reply, t) => { const r = structuredClone(reply, { transfer: t }); for (const s of subs) if (s(r, 0)) break; }); }, 0);
      return true;
    } };
  return pool;
}

test('the stand-in welded in the pool is byte-identical to the main-thread build (legacy, sync, pool)', async () => {
  for (const seed of [1, 2, 3]) {
    const legacy = legacyBuildShadowStandIn(THREE, glbLikeScene(seed));
    assert.ok(legacy && legacy.triangles > 100000 && legacy.object.children.some((m: any) => m.geometry.index.array instanceof Uint32Array), 'the fixture reaches a 32-bit index');
    assertSameStandIn(buildShadowStandIn(THREE, glbLikeScene(seed)), legacy, `sync ${seed}`);
    const root = glbLikeScene(seed), pool = fakePool();
    let ready: any = 'not yet';
    assert.equal(shadowStandInFor(THREE, root, pool, s => { ready = s; }), null, 'pending while the pool welds');
    assert.ok(root.userData[SHADOW_STAND_IN_PENDING], 'marked in flight');
    let casting = 0; root.traverse((m: any) => { if (m.isMesh && m.castShadow) casting++; });
    assert.ok(casting >= 7, 'the sources keep casting until the stand-in arrives');
    await new Promise(r => setTimeout(r, 20));
    assertSameStandIn(ready, legacy, `pool ${seed}`);
    assert.equal(root.userData.shadowStandIn, ready);
    assert.equal(shadowStandInFor(THREE, root, pool, () => assert.fail('built once')), ready, 'built once');
    assert.equal(pool.posts, 1);
  }
});

test('a cancelled pool weld is dropped (dispose, context restore)', async () => {
  const root = glbLikeScene(4), pool = fakePool();
  let called = false;
  shadowStandInFor(THREE, root, pool, () => { called = true; });
  delete root.userData[SHADOW_STAND_IN_PENDING];
  await new Promise(r => setTimeout(r, 20));
  assert.equal(called, false); assert.equal(root.userData.shadowStandIn, undefined);
  let casting = 0; root.traverse((m: any) => { if (m.isMesh && m.castShadow) casting++; });
  assert.ok(casting >= 7, 'nothing stopped casting');
});
