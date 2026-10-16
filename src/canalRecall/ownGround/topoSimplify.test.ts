// Topology-preserving simplification (roads-v1 phase 2): an edge two polygons share is simplified once.
//   node --import tsx --test src/canalRecall/ownGround/topoSimplify.test.ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { TopoSimplifier, dpIndices, vertexKey, type Vec2 } from './topoSimplify';

// Points on a 1 cm grid; the key is the grid position.
const key = (p: Vec2) => Math.round(p[0] * 100) * 1e6 + Math.round(p[1] * 100);
const keysOf = (r: Vec2[]) => r.map(key);

// A wiggly shared edge from (0, 0) to (0, 40): 0.05 m noise on a 0.25 m swell, so a 0.1 m DP keeps a different subset depending
// on where the ring starts and which way it runs.
const wiggle: Vec2[] = [];
for (let i = 0; i <= 80; i++) wiggle.push([+(Math.sin(i * 1.7) * 0.05 + Math.sin(i * 0.23) * 0.25).toFixed(2), i * 0.5]);
// West polygon: the wiggle north, then around to the west. East polygon: the wiggle south, then around to the east
// (opposite direction along the shared edge, the ring starting mid-edge).
const west: Vec2[] = [...wiggle, [-12, 40], [-12, 0]];
const east: Vec2[] = [...wiggle.slice(0, 31).reverse(), [12, 0], [12, 40], ...wiggle.slice(31).reverse()];

const sharedRun = (ring: Vec2[]): string[] => ring.filter(p => Math.abs(p[0]) < 1).map(p => `${p[0]},${p[1]}`).sort();

test('topoSimplify: the edge two polygons share comes out vertex-for-vertex identical on both sides', () => {
  const t = new TopoSimplifier();
  t.addRing(keysOf(west)); t.addRing(keysOf(east));
  assert.ok(t.isNode(key([0, 0])) && t.isNode(key([0, 40])), 'the shared edge ends are nodes');
  assert.ok(!t.isNode(key(wiggle[40])), 'a vertex inside the shared edge is not');
  for (const tol of [0.1, 0.15]) {
    const w = t.simplifyRing(keysOf(west), west, tol)!, e = t.simplifyRing(keysOf(east), east, tol)!;
    assert.deepEqual(sharedRun(w.pts), sharedRun(e.pts), `tol ${tol}: identical shared vertices`);
    assert.ok(sharedRun(w.pts).length < wiggle.length / 2, 'and simplified');
    assert.ok(sharedRun(w.pts).length >= 4, 'but not to a straight line (the wiggle exceeds the tolerance)');
  }
});

test('topoSimplify: simplifying each ring alone (the old build) does not keep the shared edge identical', () => {
  // The fixture is meaningful: the per-ring DP the extractor used before differs on this edge.
  const alone = (ring: Vec2[]) => dpIndices([...ring, ring[0]], 0.1).map(i => [...ring, ring[0]][i]).slice(0, -1);
  assert.notDeepEqual(sharedRun(alone(west)), sharedRun(alone(east)));
});

test('topoSimplify: a third polygon joining mid-edge splits the chain there; island rings and collapses', () => {
  // A north polygon touches the west/east edge at (0, 20) (wiggle index 40).
  const mid = wiggle[40];
  const north: Vec2[] = [mid, [6, 25], [-6, 25]];
  const t = new TopoSimplifier();
  for (const r of [west, east, north]) t.addRing(keysOf(r));
  assert.ok(t.isNode(key(mid)));
  const w = t.simplifyRing(keysOf(west), west, 0.1)!, e = t.simplifyRing(keysOf(east), east, 0.1)!;
  assert.ok(w.keys.includes(key(mid)) && e.keys.includes(key(mid)), 'the node survives on both sides');
  assert.deepEqual(sharedRun(w.pts), sharedRun(e.pts));
  // A ring with no node (nothing else touches it) simplifies as a closed ring.
  const circle: Vec2[] = []; for (let i = 0; i < 64; i++) circle.push([+(100 + 10 * Math.cos(i / 10)).toFixed(2), +(10 * Math.sin(i / 10)).toFixed(2)]);
  const t2 = new TopoSimplifier(); t2.addRing(keysOf(circle));
  const c = t2.simplifyRing(keysOf(circle), circle, 0.1)!;
  assert.ok(c.pts.length >= 8 && c.pts.length < circle.length);
  // A sliver thinner than the tolerance between two nodes collapses and is dropped.
  const sliver: Vec2[] = [[0, 0], [5, 0.02], [10, 0], [5, -0.02]];
  const t3 = new TopoSimplifier(); t3.addRing(keysOf(sliver)); t3.addRing(keysOf([[0, 0], [-1, 1], [-1, -1]])); t3.addRing(keysOf([[10, 0], [11, 1], [11, -1]]));
  assert.equal(t3.simplifyRing(keysOf(sliver), sliver, 0.1), null);
});

test('topoSimplify: vertexKey is exact on the 1e-7° grid', () => {
  assert.equal(vertexKey(4.8732301, 52.3675451), vertexKey(4.87323010000001, 52.36754509999999));
  assert.notEqual(vertexKey(4.8732301, 52.3675451), vertexKey(4.8732302, 52.3675451));
  assert.notEqual(vertexKey(4.8732301, 52.3675451), vertexKey(4.8732301, 52.3675452));
});
