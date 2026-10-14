import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
  LANDMARK_SEQUENCE, anchorWorldFromMercator, bySequence, mercatorFromAnchorWorld, multiplyMat4, needsRebase,
  painterSortStable, reversePainterSortStable, sequenceOf,
} from './batchedLegacyFrame.ts';
import { enuDirectionInLocal, SUN_DIRECTION } from '../rendererShared/lightRig.ts';
import { mercatorOfLngLat, mercatorUnitsPerMetre } from '../rendererShared/frameMath.ts';

let seed = 11;
const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32; };

/** A legacy placement transform, as signature-landmarks-source.js `_add` builds it (both branches). */
function legacyTransform(lng: number, lat: number, basis: boolean): THREE.Matrix4 {
  const [x, y] = mercatorOfLngLat(lng, lat, 0);
  const u = mercatorUnitsPerMetre(y);
  if (basis) {
    const a = rnd() * 6.28, skew = (rnd() - 0.5) * 0.004;
    const bx = [Math.cos(a), Math.sin(a)], by = [-Math.sin(a + skew), Math.cos(a + skew)];
    return new THREE.Matrix4().set(
      u * bx[0], 0, -u * by[0], x,
      u * bx[1], 0, -u * by[1], y,
      0, u, 0, 0,
      0, 0, 0, 1,
    );
  }
  return new THREE.Matrix4().makeTranslation(x, y, 0).scale(new THREE.Vector3(u, -u, u))
    .multiply(new THREE.Matrix4().makeRotationZ(rnd() * 6.28)).multiply(new THREE.Matrix4().makeRotationX(Math.PI / 2));
}

/** A MapLibre-like main matrix looking at (lng, lat) from ~300 m. */
function mainMatrix(lng: number, lat: number): THREE.Matrix4 {
  const [x, y] = mercatorOfLngLat(lng, lat, 0);
  const u = mercatorUnitsPerMetre(y);
  const view = new THREE.Matrix4().lookAt(new THREE.Vector3(x, y + 200 * u, 300 * u), new THREE.Vector3(x, y, 0), new THREE.Vector3(0, 0, 1));
  view.setPosition(x, y + 200 * u, 300 * u);
  const proj = new THREE.Matrix4().makePerspective(-u, u, u, -u, u, 4000 * u);
  return proj.multiply(view.invert());
}

test('anchor world and its inverse compose to the identity; world is x east, y up, z south', () => {
  const [x, y] = mercatorOfLngLat(4.89, 52.37, 0), u = mercatorUnitsPerMetre(y);
  const m = multiplyMat4(mercatorFromAnchorWorld(x, y, u), anchorWorldFromMercator(x, y, u));
  for (let i = 0; i < 16; i++) assert.ok(Math.abs(m[i] - (i % 5 === 0 ? 1 : 0)) < 1e-9, `element ${i}: ${m[i]}`);
  const o = new THREE.Matrix4().fromArray(mercatorFromAnchorWorld(x, y, u));
  const up = new THREE.Vector3(0, 1, 0).applyMatrix4(o), south = new THREE.Vector3(0, 0, 1).applyMatrix4(o);
  assert.ok(Math.abs(up.z - u) < 1e-18 && Math.abs(up.x - x) < 1e-12 && Math.abs(up.y - y) < 1e-12, 'world +y is Mercator up');
  assert.ok(south.y > y, 'world +z is Mercator +y (south)');
});

test('projection × holder reproduces the per-model projection × transform', () => {
  for (let i = 0; i < 200; i++) {
    const lng = 4.85 + rnd() * 0.08, lat = 52.34 + rnd() * 0.05;
    const transform = legacyTransform(lng, lat, i % 2 === 0);
    const main = mainMatrix(lng + (rnd() - 0.5) * 0.01, lat + (rnd() - 0.5) * 0.01);
    const [ax, ay] = mercatorOfLngLat(lng + (rnd() - 0.5) * 0.02, lat + (rnd() - 0.5) * 0.02, 0);
    const u = mercatorUnitsPerMetre(ay);
    const clipFromWorld = multiplyMat4(main.elements, mercatorFromAnchorWorld(ax, ay, u));
    const holder = multiplyMat4(anchorWorldFromMercator(ax, ay, u), transform.elements);
    const legacy = multiplyMat4(main.elements, transform.elements);
    const batched = multiplyMat4(clipFromWorld, holder);
    const scale = Math.max(...legacy.map(Math.abs));
    for (let k = 0; k < 16; k++) assert.ok(Math.abs(batched[k] - legacy[k]) <= scale * 1e-9, `${i}/${k}: ${batched[k]} vs ${legacy[k]}`);
  }
});

test('a holder keeps model up as world up (a rotation about +y, metres)', () => {
  for (let i = 0; i < 50; i++) {
    const transform = legacyTransform(4.85 + rnd() * 0.08, 52.34 + rnd() * 0.05, false);
    const [ax, ay] = mercatorOfLngLat(4.89, 52.37, 0);
    const h = new THREE.Matrix4().fromArray(multiplyMat4(anchorWorldFromMercator(ax, ay, mercatorUnitsPerMetre(ay)), transform.elements));
    const up = new THREE.Vector3(0, 1, 0).transformDirection(h);
    assert.ok(up.y > 1 - 1e-9, `model up maps to world up (${up.toArray()})`);
    const scale = new THREE.Vector3().setFromMatrixColumn(h, 0).length();
    assert.ok(Math.abs(scale - 1) < 0.01, `metre scale ${scale}`);
  }
});

test('lighting: one set aimed through the anchor gives the per-model lights’ n·l', () => {
  for (let i = 0; i < 300; i++) {
    const transform = legacyTransform(4.85 + rnd() * 0.08, 52.34 + rnd() * 0.05, i % 3 === 0);
    const [ax, ay] = mercatorOfLngLat(4.85 + rnd() * 0.08, 52.34 + rnd() * 0.05, 0);
    const u = mercatorUnitsPerMetre(ay);
    const holder = new THREE.Matrix4().fromArray(multiplyMat4(anchorWorldFromMercator(ax, ay, u), transform.elements));
    const n = new THREE.Vector3(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).normalize();
    // Per model: the normal in the model scene, the light aimed through the model's transform.
    const lLegacy = new THREE.Vector3().fromArray(enuDirectionInLocal(transform.elements, SUN_DIRECTION));
    // One scene: the normal through the holder's normal matrix, the light aimed through the anchor.
    const nWorld = n.clone().applyMatrix3(new THREE.Matrix3().getNormalMatrix(holder)).normalize();
    const lBatch = new THREE.Vector3().fromArray(enuDirectionInLocal(mercatorFromAnchorWorld(ax, ay, u), SUN_DIRECTION));
    // The RD basis can be a hair off orthogonal: the old per-model aim was M⁻¹·l, not the normal-matrix one.
    const tolerance = i % 3 === 0 ? 3e-3 : 1e-9;
    assert.ok(Math.abs(n.dot(lLegacy) - nWorld.dot(lBatch)) < tolerance, `${i}: ${n.dot(lLegacy)} vs ${nWorld.dot(lBatch)}`);
  }
});

test('recipe look: the anchor ENU maps world normals as each model’s ENU mapped its own', () => {
  for (let i = 0; i < 100; i++) {
    const transform = legacyTransform(4.85 + rnd() * 0.08, 52.34 + rnd() * 0.05, false);
    const units = new THREE.Vector3().setFromMatrixColumn(transform, 0).length();
    const flip = new THREE.Matrix3().set(1, 0, 0, 0, -1, 0, 0, 0, 1);
    const legacyEnu = new THREE.Matrix3().setFromMatrix4(transform).premultiply(flip).multiplyScalar(1 / units);
    const [ax, ay] = mercatorOfLngLat(4.89, 52.37, 0), u = mercatorUnitsPerMetre(ay);
    const batchEnu = new THREE.Matrix3().setFromMatrix4(new THREE.Matrix4().fromArray(mercatorFromAnchorWorld(ax, ay, u))).premultiply(flip).multiplyScalar(1 / u);
    const holder = new THREE.Matrix3().setFromMatrix4(new THREE.Matrix4().fromArray(multiplyMat4(anchorWorldFromMercator(ax, ay, u), transform.elements)));
    const n = new THREE.Vector3(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5);
    const a = n.clone().applyMatrix3(legacyEnu).normalize(), b = n.clone().applyMatrix3(holder).applyMatrix3(batchEnu).normalize();
    assert.ok(a.distanceTo(b) < 1e-9, `${i}: ${a.toArray()} vs ${b.toArray()}`);
  }
});

test('re-base only past the limit', () => {
  const [x, y] = mercatorOfLngLat(4.89, 52.37, 0), u = mercatorUnitsPerMetre(y);
  assert.equal(needsRebase(null, [x, y], u), true);
  assert.equal(needsRebase([x, y], [x + 1400 * u, y], u), false);
  assert.equal(needsRebase([x, y], [x + 1100 * u, y + 1100 * u], u), true);
  assert.equal(needsRebase([x, y], [x + 10 * u, y], u, 5), true);
});

test('sequence sort: model order first, then three’s own order inside a model', () => {
  const holders = [1, 2, 3].map(seq => { const g = new THREE.Group(); (g as any)[LANDMARK_SEQUENCE] = seq; return g; });
  const items: any[] = [];
  let id = 0;
  for (let k = 0; k < 60; k++) {
    const holder = holders[Math.floor(rnd() * 3)];
    const inner = new THREE.Group(); holder.add(inner);
    const mesh = new THREE.Mesh(); inner.add(mesh);
    items.push({ object: mesh, groupOrder: 0, renderOrder: Math.floor(rnd() * 2), material: { id: Math.floor(rnd() * 4) }, materialVariant: 0, z: Math.floor(rnd() * 5) / 5, id: id++ });
  }
  for (const [within, name] of [[painterSortStable, 'opaque'], [reversePainterSortStable, 'transparent']] as const) {
    const sorted = [...items].sort(bySequence(within));
    for (let k = 1; k < sorted.length; k++) {
      const a = sorted[k - 1], b = sorted[k], sa = sequenceOf(a.object), sb = sequenceOf(b.object);
      assert.ok(sa <= sb, `${name}: sequence order`);
      if (sa === sb) assert.ok(within(a, b) <= 0, `${name}: three's order inside a model`);
    }
    // Inside one model the order is exactly what three would have produced rendering that model alone.
    for (const holder of holders) {
      const seq = (holder as any)[LANDMARK_SEQUENCE];
      const alone = items.filter(i => sequenceOf(i.object) === seq).sort(within);
      assert.deepEqual(sorted.filter(i => sequenceOf(i.object) === seq).map(i => i.id), alone.map(i => i.id));
    }
  }
});

test('sequenceOf finds the nearest holder and caches it; orphans are 0', () => {
  const holder = new THREE.Group(); (holder as any)[LANDMARK_SEQUENCE] = 7;
  const mesh = new THREE.Mesh(); const pass = new THREE.Mesh();
  holder.add(mesh); mesh.add(pass);
  assert.equal(sequenceOf(pass), 7);
  assert.equal((pass as any)[LANDMARK_SEQUENCE], 7);
  assert.equal(sequenceOf(new THREE.Mesh()), 0);
});
