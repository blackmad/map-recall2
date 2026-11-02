import assert from 'node:assert/strict';
import test from 'node:test';
import {corbelArcadeOutline, crenellationOutline, outlineArea, type Pt} from './crenellation';

const close = (a: number, b: number, eps = 1e-6) => Math.abs(a - b) < eps;
/** True when no two non-adjacent edges of the closed outline cross. */
function simple(pts: Pt[]): boolean {
  const n = pts.length, cross = (o: Pt, a: Pt, b: Pt) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  for (let i = 0; i < n; i++) for (let j = i + 2; j < n; j++) {
    if (i === 0 && j === n - 1) continue;
    const [p, q, r, s] = [pts[i], pts[(i + 1) % n], pts[j], pts[(j + 1) % n]];
    const d1 = cross(r, s, p), d2 = cross(r, s, q), d3 = cross(p, q, r), d4 = cross(p, q, s);
    if (((d1 > 1e-12 && d2 < -1e-12) || (d1 < -1e-12 && d2 > 1e-12)) && ((d3 > 1e-12 && d4 < -1e-12) || (d3 < -1e-12 && d4 > 1e-12))) return false;
  }
  return true;
}
const mirror = (pts: Pt[], c: number) => pts.map(([t, y]) => `${(2 * c - t).toFixed(6)},${y.toFixed(6)}`).sort().join(' ');
const key = (pts: Pt[]) => pts.map(([t, y]) => `${t.toFixed(6)},${y.toFixed(6)}`).sort().join(' ');

test('corbel arcade: counter-clockwise, simple, area = band minus the arch voids, symmetric', () => {
  const o = {t0: 0, t1: 2.8, y0: 12.4, y1: 13.0, arches: 5, corbel: 0.14, drop: 0.12, segments: 64};
  const pts = corbelArcadeOutline(o);
  assert.ok(simple(pts));
  const span = 2.8 / 5 - 0.14, r = span / 2;
  const voids = 5 * (span * 0.12 + Math.PI * r * r / 2);
  assert.ok(Math.abs(outlineArea(pts) - (2.8 * 0.6 - voids)) < 2e-3, `${outlineArea(pts)} vs ${2.8 * 0.6 - voids}`);
  assert.equal(key(pts), mirror(pts, 1.4));
  assert.equal(pts.filter(p => close(p[1], o.y0)).length, 2 * 5 + 2, 'two feet per arch plus the band corners');
});

test('corbel arcade: crown above the band and corbels wider than the pitch throw', () => {
  assert.throws(() => corbelArcadeOutline({t0: 0, t1: 3, y0: 0, y1: 0.3, arches: 2, corbel: 0.1, drop: 0.1}));
  assert.throws(() => corbelArcadeOutline({t0: 0, t1: 1, y0: 0, y1: 1, arches: 4, corbel: 0.3, drop: 0.1}));
});

test('crenellation: merlons at both ends, n - 1 crenels, area and symmetry', () => {
  const o = {t0: 2, t1: 7.6, y0: 23.2, yCrenel: 23.8, y1: 24.6, merlons: 5, ratio: 0.55};
  const pts = crenellationOutline(o);
  assert.ok(simple(pts));
  const pitch = 5.6 / (4 + 0.55), crenel = pitch * 0.45;
  assert.ok(close(outlineArea(pts), 5.6 * 1.4 - 4 * crenel * 0.8));
  assert.equal(key(pts), mirror(pts, 4.8));
  const tops = pts.filter(p => close(p[1], o.y1)).map(p => p[0]).sort((a, b) => a - b);
  assert.equal(tops.length, 10);
  assert.ok(close(tops[0], 2) && close(tops[9], 7.6));
  assert.throws(() => crenellationOutline({...o, merlons: 1}));
  assert.throws(() => crenellationOutline({...o, yCrenel: 25}));
});
