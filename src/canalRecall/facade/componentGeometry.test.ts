import assert from 'node:assert/strict';
import test from 'node:test';
import {applyEntranceAssembly, applyFacadeComponents, type MeshData} from './componentGeometry';

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

test('reviewed arched entrance cuts its polygon exactly and leaves outer trim intact', () => {
  const outline = [[0.3, 0.8], [0.3, 0.35], [0.37, 0.25], [0.5, 0.2], [0.63, 0.25], [0.7, 0.35], [0.7, 0.8]] as const;
  const result = applyEntranceAssembly([wall()], {id: 'door', outline, depth: 0.65, basePosts: true});
  assert.equal(result.stats.accepted, true);
  assert.ok(result.stats.cutAreaUv > 0.2);
  assert.deepEqual(result.stats.focus?.outward, [0, 0, 1]);
  assert.ok(Math.abs(result.stats.focus!.center[1]-2)<1e-6, 'camera focus uses full-height midpoint, not arch vertex density');
  const posts=result.meshes.filter(m=>m.id.includes(':stone-post:'));
  assert.equal(posts.length,2);
  assert.ok(posts.every(m=>m.positions.filter((_,i)=>i%3===2).every(z=>z>0)), 'stone posts stand in front of mouth');
  const retained = result.meshes.find(mesh => mesh.id === 'front');
  assert.ok(retained?.uvs);
  const onOriginalWall = (point: readonly [number, number]) => {
    for (let i = 0; i < retained.indices.length; i += 3) {
      const points = retained.indices.slice(i, i + 3).map(index =>
        [retained.uvs![index * 2], retained.uvs![index * 2 + 1]] as const);
      if (contains(point, points[0], points[1], points[2])) return true;
    }
    return false;
  };
  assert.equal(onOriginalWall([0.5, 0.5]), false, 'door center must be fully cut');
  assert.equal(onOriginalWall([0.31, 0.7]), true, 'spandrel beside arch must remain');
  assert.equal(onOriginalWall([0.5, 0.1]), true, 'trim above arch must remain');
  const door = result.meshes.find(mesh => mesh.id === 'entrance:door:door');
  assert.ok(door && !door.textured);
  assert.ok(door.positions.filter((_, i) => i % 3 === 2).every(z => Math.abs(z + 0.65) < 1e-6));
  const reveal = result.meshes.find(mesh => mesh.id === 'entrance:door:reveal');
  assert.ok(reveal && !reveal.textured && reveal.indices.length === outline.length * 6);
  assert.ok(result.meshes.some(mesh => mesh.id === 'entrance:door:transom'));
  assert.ok(result.meshes.some(mesh => mesh.id === 'entrance:door:glazing'));
  assert.equal(result.meshes.some(mesh => mesh.id.includes('front-frame')), false);
});

test('entrance refuses an outline crossing the wall boundary', () => {
  const half = wall();
  half.positions = [0, 0, 0, 2, 0, 0, 2, 4, 0, 0, 4, 0];
  half.uvs = [0, 0, 0.5, 0, 0.5, 1, 0, 1];
  const result = applyEntranceAssembly([half], {id: 'off', outline: [[0.35, 0.7], [0.65, 0.7], [0.65, 0.2], [0.35, 0.2]]});
  assert.equal(result.stats.accepted, false);
  assert.equal(result.stats.reason, 'outside-or-ambiguous-wall');
  assert.equal(result.meshes[0], half);
});
