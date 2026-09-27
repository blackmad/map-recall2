import assert from 'node:assert/strict';
import test from 'node:test';
import {applyFacadeComponents, type MeshData} from './componentGeometry';

const wall = (): MeshData => ({id: 'front', kind: 'wall', textured: true,
  positions: [0, 0, 0, 4, 0, 0, 4, 4, 0, 0, 4, 0],
  indices: [0, 1, 2, 0, 2, 3], uvs: [0, 0, 1, 0, 1, 1, 0, 1]});

const contains = (point: readonly [number, number], a: readonly [number, number], b: readonly [number, number], c: readonly [number, number]) => {
  const cross = (p: readonly [number, number], q: readonly [number, number], r: readonly [number, number]) =>
    (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]);
  const v = [cross(a, b, point), cross(b, c, point), cross(c, a, point)];
  return v.every(x => x >= -1e-7) || v.every(x => x <= 1e-7);
};

test('window cuts the original wall and places a textured panel behind the frame', () => {
  const result = applyFacadeComponents([wall()], [{id: 'w1', kind: 'window', bbox: [0.25, 0.25, 0.75, 0.75]}]);
  assert.deepEqual(result.stats.accepted, ['w1']);
  assert.equal(result.stats.apertures, 1);
  const base = result.meshes.find(mesh => mesh.id === 'front');
  assert.ok(base?.uvs);
  for (let i = 0; i < base.indices.length; i += 3) {
    const points: Array<readonly [number, number]> = base.indices.slice(i, i + 3)
      .map(index => [base.uvs![index * 2], base.uvs![index * 2 + 1]] as const);
    assert.equal(contains([0.5, 0.5], points[0], points[1], points[2]), false, 'original wall cannot remain behind aperture');
  }
  const panel = result.meshes.find(mesh => mesh.id.includes(':inset'));
  assert.ok(panel?.textured && panel.positions.length);
  assert.ok(panel.positions.filter((_, index) => index % 3 === 2).every(z => Math.abs(z + 0.12) < 1e-6));
  assert.equal(result.meshes.filter(mesh => mesh.id.includes(':frame:')).length, 4);
});

test('out-of-wall and conflicting door/window openings are withheld', () => {
  const half = wall();
  half.positions = [0, 0, 0, 2, 0, 0, 2, 4, 0, 0, 4, 0];
  half.uvs = [0, 0, 0.5, 0, 0.5, 1, 0, 1];
  const result = applyFacadeComponents([half], [
    {id: 'off', kind: 'window', bbox: [0.6, 0.2, 0.8, 0.6]},
    {id: 'w1', kind: 'window', bbox: [0.1, 0.2, 0.4, 0.6]},
    {id: 'w2', kind: 'door', bbox: [0.2, 0.3, 0.45, 0.8]},
  ]);
  assert.deepEqual(result.stats.accepted, []);
  assert.deepEqual(result.stats.skipped.map(item => item.reason), ['outside-or-ambiguous-wall', 'ambiguous-opening-conflict', 'ambiguous-opening-conflict']);
});

test('balcony may overlap an observed window and projects a 0.65 m slab with rail', () => {
  const result = applyFacadeComponents([wall()], [
    {id: 'w', kind: 'window', bbox: [0.3, 0.3, 0.7, 0.7]},
    {id: 'b', kind: 'balcony', bbox: [0.25, 0.45, 0.75, 0.8]},
  ]);
  assert.deepEqual(result.stats.accepted, ['w', 'b']);
  assert.equal(result.stats.apertures, 1);
  const slab = result.meshes.find(mesh => mesh.id === 'component:b:slab');
  assert.ok(slab);
  assert.ok(Math.abs(Math.max(...slab.positions.filter((_, index) => index % 3 === 2)) - 0.65) < 1e-6);
  assert.ok(result.meshes.some(mesh => mesh.id === 'component:b:top-rail'));
  assert.ok(result.meshes.some(mesh => mesh.id.startsWith('component:b:post:')));
});

test('standalone balcony does not invent an aperture', () => {
  const result = applyFacadeComponents([wall()], [{id: 'b', kind: 'balcony', bbox: [0.25, 0.2, 0.75, 0.8]}]);
  assert.equal(result.stats.apertures, 0);
  assert.equal(result.meshes.some(mesh => mesh.id.includes('component:b:inset')), false);
  assert.ok(result.meshes.some(mesh => mesh.id === 'component:b:slab'));
});
