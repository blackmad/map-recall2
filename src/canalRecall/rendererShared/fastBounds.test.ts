// fastBounds gives three's own bounds and position reads, bit for bit, on plain, normalised and interleaved positions.
import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { ensureBounds, ensureGeometryBounds, fastBoundsOn, positionsOf } from './fastBounds';

function rng(seed: number) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; }; }

function geometries(r: () => number): { name: string; geometry: THREE.BufferGeometry }[] {
  const out: { name: string; geometry: THREE.BufferGeometry }[] = [];
  const n = 50 + Math.floor(r() * 400);
  const f32 = new Float32Array(n * 3).map(() => (r() - 0.5) * 300);
  out.push({ name: 'float32', geometry: new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(f32, 3)) });
  for (const [Ctor, span] of [[Int16Array, 65536], [Int8Array, 256], [Uint16Array, 65536], [Uint8Array, 256]] as const) {
    const signed = Ctor === Int16Array || Ctor === Int8Array;
    // Includes the most negative value (clamped to -1 by denormalize).
    const a = new Ctor(n * 3).map(() => Math.floor(r() * span) - (signed ? span / 2 : 0));
    a[0] = signed ? -span / 2 : 0;
    out.push({ name: `${Ctor.name} normalised`, geometry: new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(a, 3, true)) });
  }
  const stride = 8, inter = new Float32Array(n * stride).map(() => (r() - 0.5) * 80);
  out.push({ name: 'interleaved float32', geometry: new THREE.BufferGeometry().setAttribute('position', new THREE.InterleavedBufferAttribute(new THREE.InterleavedBuffer(inter, stride), 3, 2)) });
  const i16 = new Int16Array(n * 4).map(() => Math.floor(r() * 65536) - 32768);
  out.push({ name: 'interleaved int16 normalised', geometry: new THREE.BufferGeometry().setAttribute('position', new THREE.InterleavedBufferAttribute(new THREE.InterleavedBuffer(i16, 4), 3, 0, true)) });
  out.push({ name: 'empty', geometry: new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array(0), 3)) });
  return out;
}

test('ensureGeometryBounds: three\'s box and sphere, bit for bit', () => {
  const r = rng(5);
  for (let k = 0; k < 40; k++) {
    for (const { name, geometry } of geometries(r)) {
      const ref = geometry.clone();
      ref.computeBoundingBox(); ref.computeBoundingSphere();
      assert.equal(ensureGeometryBounds(THREE, geometry), true, name);
      assert.deepEqual(geometry.boundingBox!.min.toArray(), ref.boundingBox!.min.toArray(), `${name} min`);
      assert.deepEqual(geometry.boundingBox!.max.toArray(), ref.boundingBox!.max.toArray(), `${name} max`);
      assert.deepEqual(geometry.boundingSphere!.center.toArray(), ref.boundingSphere!.center.toArray(), `${name} centre`);
      assert.equal(geometry.boundingSphere!.radius, ref.boundingSphere!.radius, `${name} radius`);
      // Already filled: left alone.
      assert.equal(ensureGeometryBounds(THREE, geometry), false);
    }
  }
});

test('ensureGeometryBounds leaves morph targets and existing bounds to three', () => {
  const g = new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array(9), 3));
  g.morphAttributes.position = [new THREE.BufferAttribute(new Float32Array(9), 3)];
  assert.equal(ensureGeometryBounds(THREE, g), false);
  assert.equal(g.boundingBox, null);
  const h = new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array([1, 2, 3, 4, 5, 6]), 3));
  const box = new THREE.Box3(new THREE.Vector3(-9, -9, -9), new THREE.Vector3(9, 9, 9));
  h.boundingBox = box;
  ensureGeometryBounds(THREE, h);
  assert.equal(h.boundingBox, box);
  assert.ok(h.boundingSphere);
  const root = new THREE.Group(), mesh = new THREE.Mesh(new THREE.BoxGeometry(2, 3, 4));
  mesh.geometry.boundingBox = null; mesh.geometry.boundingSphere = null;
  root.add(mesh, new THREE.Mesh(mesh.geometry));
  assert.equal(ensureBounds(THREE, root), 1);
});

test('positionsOf reads as Vector3.fromBufferAttribute', () => {
  const r = rng(9), v = new THREE.Vector3();
  for (const { name, geometry } of geometries(r)) {
    const p = geometry.attributes.position as THREE.BufferAttribute, got = positionsOf(p as any);
    assert.equal(got.length, p.count * 3);
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i);
      assert.equal(got[i * 3], v.x, `${name} x${i}`); assert.equal(got[i * 3 + 1], v.y); assert.equal(got[i * 3 + 2], v.z);
    }
  }
});

test('fastBoundsOn: on by default, ?fastBounds=0 or the global turns it off', () => {
  assert.equal(fastBoundsOn('', undefined), true);
  assert.equal(fastBoundsOn('?fastBounds=0', undefined), false);
  assert.equal(fastBoundsOn('', false), false);
});
