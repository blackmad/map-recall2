import assert from 'node:assert/strict';
import test from 'node:test';
import {hexArea, hexOpeningWall, triArea, triNormal, type HexOpening, type Tri} from './hexOpeningWall';

const area = (ts: Tri[]) => ts.reduce((s, t) => s + triArea(t), 0);
const close = (a: number, b: number, eps = 1e-9) => Math.abs(a - b) < eps;
const ROW: HexOpening[] = [0, 1, 2].map(i => ({t0: 0.7 + i * 3.85, t1: 3.15 + i * 3.85, y0: 1.2, y1: 2.16, tip: 0.4, depth: 0.25}));

test('face area is the band minus its hexagons; backs cover the hexagons', () => {
  const w = hexOpeningWall(12, 0, 2.45, ROW);
  const holes = ROW.reduce((s, o) => s + hexArea(o), 0);
  assert.ok(close(area(w.face), 12 * 2.45 - holes));
  assert.ok(close(area(w.backs.flat()), holes));
});

test('every triangle winds towards its declared normal', () => {
  const w = hexOpeningWall(12, 0, 2.45, ROW);
  for (const t of [...w.face, ...w.reveals.flat(), ...w.backs.flat()]) {
    const n = triNormal(t);
    assert.ok(n[0] * t.normal[0] + n[1] * t.normal[1] + n[2] * t.normal[2] > 0.999, JSON.stringify(t));
  }
});

test('reveals face into the opening and run its full perimeter at its depth', () => {
  const o = ROW[0], w = hexOpeningWall(12, 0, 2.45, [o]);
  const side = Math.hypot(o.tip, (o.y1 - o.y0) / 2), perimeter = 2 * (o.t1 - o.t0 - 2 * o.tip) + 4 * side;
  assert.equal(w.reveals[0].length, 12);
  assert.ok(close(area(w.reveals[0]), perimeter * o.depth));
  const cx = (o.t0 + o.t1) / 2, cy = (o.y0 + o.y1) / 2;
  for (const t of w.reveals[0]) {
    const m = [0, 1].map(k => (t.pts[0][k] + t.pts[1][k] + t.pts[2][k]) / 3);
    assert.ok((cx - m[0]) * t.normal[0] + (cy - m[1]) * t.normal[1] > 0, 'reveal normal points at the opening centre');
  }
  for (const t of w.backs[0]) for (const p of t.pts) assert.equal(p[2], -o.depth);
});

test('tip 0 is a rectangle; bad input throws', () => {
  const r = hexOpeningWall(4, 0, 3, [{t0: 1, t1: 3, y0: 1, y1: 2, tip: 0, depth: 0.2}]);
  assert.ok(close(area(r.face), 12 - 2));
  assert.ok(close(area(r.reveals[0]), 6 * 0.2), 'split left and right sides still cover the perimeter once');
  assert.throws(() => hexOpeningWall(4, 0, 3, [{t0: 1, t1: 5, y0: 1, y1: 2, tip: 0.2, depth: 0.2}]));
  assert.throws(() => hexOpeningWall(8, 0, 3, [{t0: 1, t1: 3, y0: 1, y1: 2, tip: 0.2, depth: 0.2}, {t0: 2.5, t1: 4, y0: 1, y1: 2, tip: 0.2, depth: 0.2}]));
  assert.throws(() => hexOpeningWall(4, 0, 3, [{t0: 1, t1: 2, y0: 1, y1: 2, tip: 0.6, depth: 0.2}]));
});
