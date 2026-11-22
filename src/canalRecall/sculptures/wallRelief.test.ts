import assert from 'node:assert/strict';
import test from 'node:test';
import type {V3} from './kitParts.js';
import {inWallCut, placeRelief, planeAlignment, smallestAxis, toWallLocal} from './wallRelief.js';

// A generator-frame box (TripoSR-like: z up, the camera on +x): 2 deep (x), 4 wide (y), 1 high (z), front face at x = 1.
function box(): V3[][] {
  const c = (x: number, y: number, z: number): V3 => [x, y, z];
  const q = (a: V3, b: V3, cc: V3, d: V3): V3[][] => [[a, b, cc], [a, cc, d]];
  const [x0, x1, y0, y1, z0, z1] = [-1, 1, -2, 2, 0, 1];
  return [
    ...q(c(x1, y0, z0), c(x1, y1, z0), c(x1, y1, z1), c(x1, y0, z1)), // front (+x)
    ...q(c(x0, y0, z0), c(x0, y0, z1), c(x0, y1, z1), c(x0, y1, z0)), // back (-x)
    ...q(c(x0, y0, z1), c(x1, y0, z1), c(x1, y1, z1), c(x0, y1, z1)), // top
    ...q(c(x0, y0, z0), c(x0, y1, z0), c(x1, y1, z0), c(x1, y0, z0)), // bottom
  ];
}
const bounds = (tris: V3[][]) => {
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (const t of tris) for (const p of t) for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], p[k]); hi[k] = Math.max(hi[k], p[k]); }
  return {lo, hi};
};

test('toWallLocal turns the generator frame without mirroring', () => {
  // TripoSR: front +x, up z -> right = z x x = +y
  assert.deepEqual(toWallLocal([0, 1, 0], '+x', '+z'), [1, 0, 0]);
  assert.deepEqual(toWallLocal([0, 0, 1], '+x', '+z'), [0, 1, 0]);
  assert.deepEqual(toWallLocal([1, 0, 0], '+x', '+z'), [0, 0, 1]);
  assert.throws(() => toWallLocal([0, 0, 0], '+x', '-x'));
});

test('placeRelief fits width and height on a south-facing wall and keeps only the front depth', () => {
  const r = placeRelief(box(), '+x', '+z', {origin: [10, 5, 3], normal: [0, 1]}, {width: 2, height: 1.5, depth: 0.3, embed: 0});
  const {lo, hi} = bounds(r.triangles);
  // South-facing (+z): along the wall is east (+x), width 2 centred on x = 10
  assert.ok(Math.abs(lo[0] - 9) < 1e-9 && Math.abs(hi[0] - 11) < 1e-9);
  assert.ok(Math.abs(lo[1] - 5) < 1e-9 && Math.abs(hi[1] - 6.5) < 1e-9);
  // Depth: the mesh is 2 deep at width scale 0.5 -> 1 m; only 0.3 m is kept in front of the wall plane z = 3
  assert.ok(Math.abs(lo[2] - 3) < 1e-9 && Math.abs(hi[2] - 3.3) < 1e-9);
  // The back face lies wholly on the wall plane and is dropped
  assert.equal(r.droppedBack, 2);
  assert.equal(r.triangles.length, 6);
});

test('placeRelief keeps the viewer\'s left on the left (no mirror) on an east-facing wall', () => {
  // A marker triangle on the generator's left (-y, seen from the camera on +x looking back: right = up x front = +y)
  const left: V3[][] = [[[1, -2, 0], [1, -1.9, 0], [1, -2, 0.1]], [[1, 2, 1], [0.9, 2, 1], [1, 1.9, 1]]];
  const r = placeRelief(left, '+x', '+z', {origin: [0, 0, 0], normal: [1, 0]}, {width: 4, height: 1, depth: 0.5, embed: 0});
  // East-facing wall: a viewer to the east looks west; their right is north (-z). The generator's left marker must end up south (+z).
  const z = (tri: V3[]) => tri.reduce((s, p) => s + p[2], 0) / 3;
  assert.ok(z(r.triangles[0]) > 0 && z(r.triangles[1]) < 0);
});

test('embed sinks the flattened back behind the wall plane', () => {
  const r = placeRelief(box(), '+x', '+z', {origin: [0, 0, 0], normal: [0, -1]}, {width: 4, height: 1, depth: 2, embed: 0.05});
  const {lo, hi} = bounds(r.triangles);
  // North-facing (-z): out is -z; the full 2 m depth kept, the back face on the plane (dropped), the sides reach 0.05 m behind it
  assert.ok(Math.abs(hi[2] - 0.05) < 1e-9 && Math.abs(lo[2] + 1.95) < 1e-9);
  assert.equal(r.droppedBack, 2);
});

test('inWallCut tests an oriented box on a diagonal wall', () => {
  const cut = {origin: [0, 10, 0] as V3, normal: [Math.SQRT1_2, Math.SQRT1_2] as [number, number], min: [-1, 0, -0.2] as V3, max: [1, 2, 0.5] as V3};
  assert.ok(inWallCut([0.2, 11, 0.2], cut)); // 0.28 out, on the axis
  assert.ok(!inWallCut([0.6, 11, 0.6], cut)); // 0.85 out
  assert.ok(!inWallCut([0, 9.9, 0], cut)); // below
  // along the wall: t = [nz, -nx] = [0.707, -0.707]; 0.9 m along is inside, 1.2 m is not
  assert.ok(inWallCut([0.9 * Math.SQRT1_2, 10.5, -0.9 * Math.SQRT1_2], cut));
  assert.ok(!inWallCut([1.2 * Math.SQRT1_2, 10.5, -1.2 * Math.SQRT1_2], cut));
});

test('smallestAxis finds the thin direction of a covariance', () => {
  const e = smallestAxis([[4, 0, 0], [0, 9, 0], [0, 0, 0.1]]);
  assert.ok(Math.abs(Math.abs(e[2]) - 1) < 1e-9);
});

test('planeAlignment levels a disc tilted 20 degrees about x, and leaves a 60 degree tilt alone', () => {
  const tilt = (deg: number) => {
    const a = deg * Math.PI / 180, pts: V3[] = [];
    for (let i = 0; i < 64; i++) { const t = i / 64 * 2 * Math.PI, x = Math.cos(t), y = Math.sin(t); pts.push([x, y * Math.cos(a), y * Math.sin(a)]); }
    return pts;
  };
  const r = planeAlignment(tilt(20));
  assert.ok(Math.abs(r.tiltDeg - 20) < 1e-6);
  for (const p of tilt(20).map(r.rotate)) assert.ok(Math.abs(p[2]) < 1e-9);
  const far = planeAlignment(tilt(60));
  assert.deepEqual(far.rotate([0, 1, 0]), [0, 1, 0]);
});

test('alignToPlane keeps a tilted medallion face instead of one rim', () => {
  // a 2 m disc tilted 25 deg (front +z, up +y), as a fan of triangles
  const a = 25 * Math.PI / 180, ring: V3[] = [];
  for (let i = 0; i < 32; i++) { const t = i / 32 * 2 * Math.PI, y = Math.sin(t); ring.push([Math.cos(t), y * Math.cos(a), y * Math.sin(a)]); }
  const tris: V3[][] = ring.map((p, i) => [[0, 0, 0], p, ring[(i + 1) % 32]]);
  const frame = {origin: [0, 0, 0] as V3, normal: [0, 1] as [number, number]};
  const fit = {width: 2, height: 2, depth: 0.1, embed: 0};
  assert.ok(placeRelief(tris, '+z', '+y', frame, fit).droppedBack > 10);
  assert.equal(placeRelief(tris, '+z', '+y', frame, {...fit, alignToPlane: true}).droppedBack, 0);
});

test('dropBackFacing drops the back face of a closed box even when the depth keeps all of it', () => {
  const r = placeRelief(box(), '+x', '+z', {origin: [0, 0, 0], normal: [0, 1]}, {width: 4, height: 1, depth: 5, embed: 0, dropBackFacing: true});
  // front 2, top 2 and bottom 2 stay (top/bottom are edge-on: out component 0); the back face (2) faces into the wall
  assert.equal(r.droppedBack, 2);
  assert.equal(r.triangles.length, 6);
});
