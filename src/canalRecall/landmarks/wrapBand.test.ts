import assert from 'node:assert/strict';
import test from 'node:test';
import {outlineArea, simplifyPath, wrapBandFace, wrapBandOutline, type XZ} from './wrapBand';

const close = (a: number, b: number, eps = 1e-6) => Math.abs(a - b) < eps;

// An outside corner: east wall running north (x = 0, z 10 -> 0), then a north wall running west (z = 0, x 0 -> -10).
// Outward of the first segment is +x (east), of the second -z (north): side +1 with outward (-tz, tx).
const corner: XZ[] = [[0, 10], [0, 0], [-10, 0]];

test('a straight run is a rectangle of depth x length', () => {
  const ring = wrapBandOutline([[0, 10], [0, 0]], {depth: 1.5});
  assert.ok(close(outlineArea(ring), 15));
  assert.deepEqual(wrapBandFace([[0, 10], [0, 0]], {depth: 1.5})[0], [1.5, 10]);
});

test('an outside corner gets a quarter-circle nose of radius depth', () => {
  const D = 2, face = wrapBandFace(corner, {depth: D, arcSegmentsPerQuarter: 64});
  for (const p of face.slice(1, -1)) assert.ok(close(Math.hypot(p[0], p[1]), D, 1e-9), `arc point ${p} not on radius`);
  const area = outlineArea(wrapBandOutline(corner, {depth: D, arcSegmentsPerQuarter: 256}));
  assert.ok(Math.abs(area - (10 * D * 2 + Math.PI * D * D / 4)) < 0.01, `area ${area}`);
});

test('an inside corner meets the offset lines (no arc, no overlap)', () => {
  // the same corner walked from the other side is concave for side -1 (outward faces the inside of the L)
  const face = wrapBandFace(corner, {depth: 1, side: -1});
  assert.equal(face.length, 3);
  assert.deepEqual(face[1].map(v => Math.round(v * 1e9) / 1e9), [-1, 1]);
});

test('the band face stays depth away from every wall segment', () => {
  const path: XZ[] = [[0, 0], [6, 0], [6, -4], [10, -6], [10, -12]];
  const D = 1.2, face = wrapBandFace(path, {depth: D, side: -1});
  const segDist = (p: XZ, a: XZ, b: XZ) => {
    const dx = b[0] - a[0], dz = b[1] - a[1], L2 = dx * dx + dz * dz;
    const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / L2));
    return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dz);
  };
  for (const p of face) {
    const d = Math.min(...path.slice(1).map((b, i) => segDist(p, path[i], b)));
    assert.ok(d > D - 1e-6, `face point ${p} only ${d} from the walls`);
  }
});

test('simplifyPath drops jogs under the tolerance and keeps the ends and real corners', () => {
  const jogged: XZ[] = [[0, 0], [0, -5], [0.2, -5], [0.2, -10], [-8, -10]];
  assert.deepEqual(simplifyPath(jogged, 0.5), [[0, 0], [0.2, -10], [-8, -10]]);
  assert.deepEqual(simplifyPath(jogged, 0.05), jogged);
});

test('rejects a zero depth and a degenerate path', () => {
  assert.throws(() => wrapBandFace(corner, {depth: 0}));
  assert.throws(() => wrapBandFace([[1, 1], [1, 1]], {depth: 1}));
});
