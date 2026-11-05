import assert from 'node:assert/strict';
import test from 'node:test';
import {mansardDormers, mansardEnd, polyArea, polyNormal, type MansardPoly} from './mansardDormers';

const area = (ps: MansardPoly[]) => ps.reduce((s, p) => s + polyArea(p.pts), 0);
const close = (a: number, b: number, eps = 1e-9) => Math.abs(a - b) < eps;
const opts = {yFoot: 15, oFoot: -0.2, yTop: 18, depth: 1};

test('without dormers the slope is one quad of the full run', () => {
  const r = mansardDormers(10, opts);
  assert.equal(r.slope.length, 1);
  assert.ok(close(area(r.slope), 10 * Math.hypot(3, 1)));
  assert.equal(r.cheeks.length + r.caps.length + r.fronts.length, 0);
});

test('the slope area is the run minus the dormers\' footprints on it', () => {
  const r = mansardDormers(20, {...opts, dormers: [{t0: 2, t1: 5, top: 17.4}, {t0: 9, t1: 13, top: 18}]});
  const L = Math.hypot(3, 1), sA = 2.4 / 3, sB = 1;
  assert.ok(close(area(r.slope), 20 * L - 3 * sA * L - 4 * sB * L, 1e-9));
  assert.equal(r.fronts.length, 2);
  assert.deepEqual(r.fronts[0], {t0: 2, t1: 5, y0: 15, y1: 17.4, o: -0.2});
});

test('every polygon winds towards its declared normal, and the slope faces up and out', () => {
  const r = mansardDormers(12, {...opts, dormers: [{t0: 1, t1: 4, top: 17.5, front: 0}, {t0: 6, t1: 9, top: 17.9}], capOverhang: 0.1});
  for (const p of [...r.slope, ...r.cheeks, ...r.caps]) {
    const n = polyNormal(p.pts);
    assert.ok(n[0] * p.normal[0] + n[1] * p.normal[1] + n[2] * p.normal[2] > 0.999, JSON.stringify(p));
  }
  for (const p of r.slope) assert.ok(p.normal[1] > 0 && p.normal[2] > 0);
});

test('cheeks are triangles when the front stands on the slope foot, quads when it stands proud', () => {
  const tri = mansardDormers(6, {...opts, dormers: [{t0: 1, t1: 3, top: 17}]});
  assert.ok(tri.cheeks.every(c => c.pts.length === 3));
  // the cheek spans from the foot to the dormer top, back to where the slope reaches that height
  assert.ok(close(polyArea(tri.cheeks[0].pts), 0.5 * 2 * (2 / 3)));
  const quad = mansardDormers(6, {...opts, dormers: [{t0: 1, t1: 3, top: 17, front: 0}]});
  assert.ok(quad.cheeks.every(c => c.pts.length === 4));
});

test('nothing of the slope lies inside a dormer footprint', () => {
  const r = mansardDormers(10, {...opts, dormers: [{t0: 3, t1: 6, top: 17}]});
  for (const p of r.slope) {
    const t0 = Math.min(...p.pts.map(q => q[0])), t1 = Math.max(...p.pts.map(q => q[0])), y0 = Math.min(...p.pts.map(q => q[1]));
    assert.ok(!(t0 < 6 - 1e-9 && t1 > 3 + 1e-9 && y0 < 17 - 1e-9), JSON.stringify(p.pts));
  }
});

test('bad input throws: overlapping dormers, a top above the run, a flat run', () => {
  assert.throws(() => mansardDormers(10, {...opts, dormers: [{t0: 1, t1: 4, top: 17}, {t0: 3, t1: 6, top: 17}]}));
  assert.throws(() => mansardDormers(10, {...opts, dormers: [{t0: 1, t1: 4, top: 18.5}]}));
  assert.throws(() => mansardDormers(10, {...opts, yTop: 15}));
});

test('the end wedge closes the run behind the slope and faces along the run', () => {
  const e = mansardEnd(0, -1, opts);
  assert.ok(close(polyArea(e.pts), 0.5 * 3 * 1));
  const n = polyNormal(e.pts);
  assert.ok(n[0] < -0.999);
});
