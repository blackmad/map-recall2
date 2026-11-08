import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { TreeInstanceCache, compileTreeSource, composeInto, groupOf, treesIncrementalFlag, type TreeEmit, type TreeInstanceItem } from './treeInstances';

type Tree = { lng: number; lat: number; kind: number; source?: string };

// A stand-in for the layer's appendTree: a trunk, two or three lobes (yawed), a fork per offset lobe (a quaternion),
// keyed by crown kind and tone like the layer's groups; kind 3 has no typology (skipped).
function itemsOf(tree: Tree, z0: number, push: (key: string, item: TreeInstanceItem) => void): boolean {
  if (tree.kind === 3) return false;
  const x = (tree.lng - 4.9) * 68000, south = (52.37 - tree.lat) * 111000, h = 4 + tree.kind * 2.5, bark = new THREE.Color(0.3, 0.2, 0.1 + tree.kind / 10);
  push('wood', { p: [x, -south, z0 + h / 2], s: [0.4, 0.4, h], color: bark });
  const geometry = tree.kind === 2 ? 'cone' : 'faceted';
  const lobes = tree.kind === 1 ? 3 : 2, rot = tree.lng * 1000 % 6.28;
  for (let l = 0; l < lobes; l++) {
    const off = [l * 0.9 - 0.4, h + l * 0.7, 0.3 * l], co = Math.cos(rot), si = Math.sin(rot);
    const dx = off[0] * co - off[2] * si, dz = off[0] * si + off[2] * co;
    push(`${geometry}-${l % 3}`, { p: [x + dx, -(south + dz), z0 + off[1]], s: [2, 2.2, 1.8], rotation: -(rot + l * 0.3), color: new THREE.Color(0.1, 0.4 + l / 10, 0.1) });
    if (geometry === 'faceted' && Math.hypot(dx, dz) > 0.1) {
      const from = new THREE.Vector3(x, -south, z0 + h * 0.72), to = new THREE.Vector3(x + dx * 0.75, -(south + dz * 0.75), z0 + off[1]);
      const delta = to.clone().sub(from), length = delta.length(), seg = [from.x, from.y, from.z, to.x, to.y, to.z];
      push('wood', { p: from.add(to).multiplyScalar(0.5).toArray(), s: [0.2, 0.2, length], q: new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), delta.divideScalar(length)), color: bark, seg });
    }
  }
  return true;
}
const emit: TreeEmit<Tree> = (tree, push) => itemsOf(tree, 0, push) ? { archetype: `a${tree.kind}`, authored: tree.source === 'allotment-prior' } : null;

/** The legacy rebuild (inventory-trees-source.js rebuild()), on the three.js Object3D path. */
function legacy(sources: Tree[][], b: { west: number; south: number; east: number; north: number }, z0: ((lng: number, lat: number) => number) | null, extra: TreeInstanceItem[] = []) {
  const groups = new Map<string, TreeInstanceItem[]>();
  const append = (key: string, item: TreeInstanceItem) => { if (!groups.has(key)) groups.set(key, []); groups.get(key)!.push(item); };
  let trees = 0;
  for (const tile of sources) for (const tree of tile) {
    if (!Number.isFinite(tree.lng) || !Number.isFinite(tree.lat) || tree.lng < b.west || tree.lng > b.east || tree.lat < b.south || tree.lat > b.north) continue;
    if (tree.kind === 3) continue;
    trees++;
    itemsOf(tree, z0 ? z0(tree.lng, tree.lat) : 0, append);
  }
  for (const r of extra) append('rose-bush', r);
  const dummy = new THREE.Object3D();
  return { trees, groups: [...groups].map(([key, items]) => {
    const m = new THREE.InstancedMesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial(), items.length);
    items.forEach((v, j) => {
      dummy.position.set(v.p[0], v.p[1], v.p[2]); dummy.scale.set(v.s[0], v.s[1], v.s[2]); dummy.quaternion.identity();
      if (v.q) dummy.quaternion.copy(v.q as THREE.Quaternion); else if (v.rotation) dummy.rotation.z = v.rotation;
      dummy.updateMatrix(); m.setMatrixAt(j, dummy.matrix); m.setColorAt(j, v.color as THREE.Color);
    });
    return { key, count: items.length, matrices: m.instanceMatrix.array as Float32Array, colours: m.instanceColor!.array as Float32Array };
  }) };
}

function forest(seed: number, n: number, at: [number, number], span: number): Tree[] {
  let s = seed;
  const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const out: Tree[] = [];
  for (let i = 0; i < n; i++) out.push({ lng: at[0] + rnd() * span, lat: at[1] + rnd() * span * 0.6, kind: Math.floor(rnd() * 4), source: rnd() < 0.1 ? 'allotment-prior' : undefined });
  out.push({ lng: NaN, lat: at[1], kind: 0 });
  return out;
}

const A = forest(1, 300, [4.89, 52.365], 0.01), B = forest(2, 200, [4.90, 52.365], 0.01), C = forest(3, 50, [4.895, 52.372], 0.004);
const all = { west: 4.8, south: 52.3, east: 5, north: 52.4 }, part = { west: 4.893, south: 52.366, east: 4.905, north: 52.371 };

function same(a: ReturnType<typeof legacy>['groups'], b: ReturnType<typeof legacy>['groups'], tol = 0) {
  assert.deepEqual(a.map(g => [g.key, g.count]), b.map(g => [g.key, g.count]), 'same groups in the same order');
  for (let i = 0; i < a.length; i++) {
    if (tol === 0) { assert.deepEqual(Array.from(b[i].matrices), Array.from(a[i].matrices), `${a[i].key} matrices`); }
    else for (let k = 0; k < a[i].matrices.length; k++) assert.ok(Math.abs(a[i].matrices[k] - b[i].matrices[k]) <= tol, `${a[i].key} matrix ${k}: ${a[i].matrices[k]} vs ${b[i].matrices[k]}`);
    assert.deepEqual(Array.from(b[i].colours), Array.from(a[i].colours), `${a[i].key} colours`);
  }
}

test('composeInto is three.js Matrix4.compose, bit for bit', () => {
  const out = new Float32Array(16), m = new THREE.Matrix4(), o = new THREE.Object3D();
  for (const rotation of [0, 0.3, -2.9, 5.5]) {
    composeInto(out, 0, { p: [1.5, -2.25, 3.125], s: [2, 3, 4], rotation, color: { r: 0, g: 0, b: 0 } });
    o.position.set(1.5, -2.25, 3.125); o.scale.set(2, 3, 4); o.quaternion.identity(); if (rotation) o.rotation.z = rotation; o.updateMatrix();
    assert.deepEqual(Array.from(out), Array.from(Float32Array.from(o.matrix.elements)));
  }
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(0.3, -0.4, 0.866).normalize());
  composeInto(out, 0, { p: [0, 0, 0], s: [1, 1, 2], q, color: { r: 0, g: 0, b: 0 } });
  assert.deepEqual(Array.from(out), Array.from(Float32Array.from(m.compose(new THREE.Vector3(), q, new THREE.Vector3(1, 1, 2)).elements)));
});

test('assemble: the legacy rebuild\'s groups, order, matrices and colours (no ground lift), whole and clipped', () => {
  const cache = new TreeInstanceCache<Tree>();
  for (const b of [all, part]) {
    const ref = legacy([A, B, C], b, null), got = cache.assemble([A, B, C], 'v1', emit, b, null, 0);
    same(ref.groups, got.groups);
    assert.equal(got.trees, ref.trees);
  }
  assert.equal(cache.compiles, 3, 'each source compiled once across rebuilds');
});

test('assemble: source order changes, a source leaves, a variant is its own compile', () => {
  const cache = new TreeInstanceCache<Tree>();
  cache.assemble([A, B, C], 'v1', emit, all, null, 0);
  same(legacy([C, A], part, null).groups, cache.assemble([C, A], 'v1', emit, part, null, 0).groups);
  assert.equal(cache.compiles, 3);
  cache.assemble([C], 'v0', emit, part, null, 0);
  assert.equal(cache.compiles, 4);
});

test('assemble: the ground lift is read once per tree per revision and lands on every instance, to the bit', () => {
  const cache = new TreeInstanceCache<Tree>();
  let reads = 0, lift = 1.25;
  const z0 = (lng: number, lat: number) => { reads++; return lift + (lng - 4.9) * 10 + (lat - 52.37) * 5 - 0.05; };
  const ref = legacy([A, B], part, z0); reads = 0;
  const got = cache.assemble([A, B], 'v1', emit, part, z0, 1);
  same(ref.groups, got.groups);
  assert.equal(reads, got.trees, 'one read per kept tree in bounds');
  reads = 0; cache.assemble([A, B], 'v1', emit, part, z0, 1);
  assert.equal(reads, 0, 'same revision: no reads');
  lift = 3; reads = 0;
  same(legacy([A, B], part, z0).groups, cache.assemble([A, B], 'v1', emit, part, z0, 2).groups);
  // Ground gone (null) then back at the same revision: the lift is read again, not taken from the stale cache.
  same(legacy([A, B], part, null).groups, cache.assemble([A, B], 'v1', emit, part, null, 2).groups);
  reads = 0; cache.assemble([A, B], 'v1', emit, part, z0, 2);
  assert.ok(reads > 0);
});

test('assemble: extra groups (rose bushes) follow the trees; empty bounds give nothing', () => {
  const cache = new TreeInstanceCache<Tree>();
  const roses: TreeInstanceItem[] = [0, 1, 2].map(i => ({ p: [i, i, 0.3], s: [0.4, 0.37, 0.5], rotation: i * 0.7, color: new THREE.Color('#d03050') }));
  same(legacy([A], part, null, roses).groups, cache.assemble([A], 'v1', emit, part, null, 0, [groupOf('rose-bush', roses)]).groups);
  const none = cache.assemble([A, B], 'v1', emit, { west: 0, south: 0, east: 1, north: 1 }, null, 0);
  assert.equal(none.groups.length, 0); assert.equal(none.trees, 0);
});

test('compileTreeSource keeps finite, typed trees and their archetypes', () => {
  const src = compileTreeSource(C, emit);
  assert.equal(src.trees, C.filter(t => Number.isFinite(t.lng) && t.kind !== 3).length);
  assert.ok(src.archetypes.every(a => /^a[012]$/.test(a)));
});

test('treesIncrementalFlag: off by default; 1 is from the air, all is everywhere', () => {
  assert.equal(treesIncrementalFlag(''), 'off');
  assert.equal(treesIncrementalFlag('?treesIncremental=1'), 'air');
  assert.equal(treesIncrementalFlag('?treesIncremental=all'), 'all');
  assert.equal(treesIncrementalFlag('?treesIncremental=0'), 'off');
});
