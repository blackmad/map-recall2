import assert from 'node:assert/strict';
import test from 'node:test';
import {barRailing, roundedFrontPath, signedArea, type XZ} from './barRailing';

/** Triangle normals (unnormalised) and centroids of a railing mesh. */
function triNormals(m: {positions: number[]; indices: number[]}) {
  const P = m.positions, out: {n: number[]; c: number[]}[] = [];
  for (let i = 0; i < m.indices.length; i += 3) {
    const [a, b, c] = [0, 1, 2].map(k => [P[m.indices[i + k] * 3], P[m.indices[i + k] * 3 + 1], P[m.indices[i + k] * 3 + 2]]);
    const u = b.map((v, k) => v - a[k]), w = c.map((v, k) => v - a[k]);
    out.push({n: [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]], c: [0, 1, 2].map(k => (a[k] + b[k] + c[k]) / 3)});
  }
  return out;
}

test('a straight 1.3 m run: bars at the pitch, rails at the right heights, everything inside the height', () => {
  const m = barRailing([[0, 0], [1.3, 0]], {height: 1, barPitch: 0.13});
  assert.equal(m.bars, 10);
  const ys = m.positions.filter((_, i) => i % 3 === 1);
  assert.equal(Math.min(...ys), 0.08);
  assert.equal(Math.max(...ys), 1);
  // 2 rails x 6 quads + 10 bars x 4 quads, 2 triangles each
  assert.equal(m.indices.length / 3, (2 * 6 + 10 * 4) * 2);
});

test('faces wind outward: a single bar post has normals pointing away from its axis', () => {
  const m = barRailing([[0, 0], [0.13, 0]], {barPitch: 0.13});
  const centre = [0.065, 0];
  // the bar's side quads are the last 4 quads
  for (const {n, c} of triNormals(m).slice(-8)) assert.ok(n[0] * (c[0] - centre[0]) + n[2] * (c[2] - centre[1]) > 0);
});

test('rail caps face up on top and down below', () => {
  const m = barRailing([[0, 0], [1, 0]], {height: 1});
  const tris = triNormals(m).slice(0, 12);                                         // the top rail: 4 sides + top + bottom
  assert.ok(tris.slice(8, 10).every(t => t.n[1] > 0));
  assert.ok(tris.slice(10, 12).every(t => t.n[1] < 0));
  for (const t of tris.slice(0, 8)) assert.ok(Math.abs(t.n[1]) < 1e-12);
});

test('rounded front path: starts and ends at the wall, front at depth, corners on the radius', () => {
  const p = roundedFrontPath(0, 3, 0.3, 1.6, 0.6, 8);
  assert.deepEqual(p[0], [0, 0.3]);
  assert.deepEqual(p.at(-1), [3, 0.3]);
  assert.ok(p.every(q => q[1] <= 1.6 + 1e-9 && q[0] >= -1e-9 && q[0] <= 3 + 1e-9));
  for (const q of p.slice(2, 9)) assert.ok(Math.abs(Math.hypot(q[0] - 0.6, q[1] - 1.0) - 0.6) < 1e-9);
  // the railing follows it with bars on every part
  const m = barRailing(p);
  const len = p.slice(1).reduce((s, q, i) => s + Math.hypot(q[0] - p[i][0], q[1] - p[i][1]), 0);
  assert.equal(m.bars, Math.round(len / 0.13));
});

test('signed area and input checks', () => {
  const sq: XZ[] = [[0, 0], [1, 0], [1, 1], [0, 1]];
  assert.equal(signedArea(sq), 1);
  assert.throws(() => barRailing([[0, 0]]));
  assert.throws(() => barRailing([[0, 0], [1, 0]], {height: 0.1}));
});
