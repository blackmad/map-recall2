import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { InstanceCull } from './instanceCull';
import { diffGroup, fadeGeometry, instanceKey, injectTreeFade, leavingArrays, patchTreeFadeMaterial, releaseFadeGeometry, treeFadeFlag, type GroupSnapshot } from './treeFade';

function mats(points: [number, number][]): Float32Array {
  const out = new Float32Array(16 * points.length), m = new THREE.Matrix4();
  points.forEach(([x, y], i) => m.makeTranslation(x, y, 3).toArray(out, 16 * i));
  return out;
}
const snap = (points: [number, number][], fades?: number[]): GroupSnapshot => ({ matrices: mats(points), colours: new Float32Array(3 * points.length).fill(0.5), fades: fades ? Float32Array.from(fades) : null, count: points.length });

test('a rebuild with the same trees changes nothing: every instance drawn, none leaving', () => {
  const pts: [number, number][] = [[0, 0], [10, 5], [20.04, 7]];
  const d = diffGroup(snap(pts), mats([[20, 7], [0, 0], [10, 5]]), 3, 50);
  assert.deepEqual([...d.fades], [0, 0, 0]);
  assert.deepEqual(d.leaving, []);
  assert.equal(d.kept, 3); assert.equal(d.entered, 0);
});

test('new trees enter at now, dropped trees leave, a z-only move (ground re-base) is kept', () => {
  const next = mats([[0, 0], [30, 30]]);
  next[14] = 9; // lifted
  const d = diffGroup(snap([[0, 0], [10, 5]]), next, 2, 50);
  assert.deepEqual([...d.fades], [0, 50]);
  assert.deepEqual(d.leaving, [1]);
  const a = leavingArrays(snap([[0, 0], [10, 5]]), d.leaving, 50);
  assert.equal(a.fades[0], -50);
  assert.equal(instanceKey(a.matrices, 0), instanceKey(mats([[10, 5]]), 0));
});

test('a running fade-in carries on; a finished one becomes drawn; leaving trees are not matched again', () => {
  const prev = snap([[0, 0], [5, 5], [9, 9]], [49.9, 40, -49.8]);
  const d = diffGroup(prev, mats([[0, 0], [5, 5], [9, 9]]), 3, 50);
  assert.deepEqual([...d.fades].map(v => +v.toFixed(1)), [49.9, 0, 50]);
  assert.deepEqual(d.leaving, []);
});

test('the group is new: every instance enters', () => {
  const d = diffGroup(null, mats([[1, 1], [2, 2]]), 2, 7);
  assert.deepEqual([...d.fades], [7, 7]);
});

test('the shader gets the attribute, varying and a complementary in/out discard; the program key changes', () => {
  const s = injectTreeFade('void main() {\n gl_Position = vec4(0.);\n}', 'void main() {\n gl_FragColor = vec4(1.);\n}');
  assert.match(s.vertexShader, /^attribute float treeFade;/);
  assert.match(s.vertexShader, /vTreeFade = treeFade;/);
  assert.match(s.fragmentShader, /vTreeFade > 0\.0 \? tfHash >= tfT : tfHash < tfT/);
  assert.match(s.fragmentShader, /#define TREE_FADE_RATE 1\.666667/);
  const now = { value: 3 }, m = patchTreeFadeMaterial(new THREE.MeshStandardMaterial(), now);
  assert.equal(m.customProgramCacheKey(), '|treeFade');
  const shader: any = { uniforms: {}, vertexShader: 'void main() {}', fragmentShader: 'void main() {}' };
  m.onBeforeCompile(shader, null as any);
  assert.equal(shader.uniforms.treeFadeNow, now);
  assert.equal(patchTreeFadeMaterial(m, now), m);
});

test('the fade geometry shares buffers; releasing it leaves the shared geometry intact', () => {
  const shared = new THREE.IcosahedronGeometry(1, 0);
  let disposedShared = 0; shared.addEventListener('dispose', () => disposedShared++);
  const g = fadeGeometry(THREE, shared, new Float32Array([1, 0]));
  assert.equal(g.attributes.position, shared.attributes.position);
  assert.ok(g.attributes.treeFade.isInstancedBufferAttribute);
  releaseFadeGeometry(g);
  assert.equal(disposedShared, 0);
  assert.ok(shared.attributes.position);
  assert.equal(g.attributes.position, undefined);
});

test('InstanceCull compacts the fade attribute with the matrices and exposes the full arrays', () => {
  const n = 3, mesh = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0), new THREE.MeshBasicMaterial(), n);
  const m = mats([[0, 0], [1000, 0], [0, 5]]);
  mesh.instanceMatrix.array.set(m);
  mesh.geometry = fadeGeometry(THREE, mesh.geometry, new Float32Array([11, 22, 33]));
  const cull = new InstanceCull(THREE, mesh);
  const cam = new THREE.PerspectiveCamera(60, 1, 1, 200); cam.position.set(0, 0, 100); cam.lookAt(0, 0, 0); cam.updateMatrixWorld(true);
  cull.update(new THREE.Matrix4().multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse));
  assert.equal(mesh.count, 2);
  assert.deepEqual([...mesh.geometry.attributes.treeFade.array.subarray(0, 2)], [11, 33]);
  assert.deepEqual([...cull.full().extras.treeFade], [11, 22, 33]);
  cull.restore();
  assert.deepEqual([...mesh.geometry.attributes.treeFade.array], [11, 22, 33]);
});

test('treeFade flag: default on, =0 off, off under popFade=0', () => {
  const g = globalThis as any, loc = g.location;
  try {
    g.location = { search: '' }; assert.equal(treeFadeFlag(), true);
    g.location = { search: '?treeFade=0' }; assert.equal(treeFadeFlag(), false);
    g.location = { search: '?popFade=0' }; assert.equal(treeFadeFlag(), false);
  } finally { g.location = loc; }
});
