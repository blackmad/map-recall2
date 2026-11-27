// Desktop-perf 2026-11-27: footprintBase, frontBase and GroundField.heightRd's coverage edge were rewritten without
// per-call arrays (the ride allocated ~84 MB/s, a large share from building bases). These pin the new code to the old
// numbers, bit for bit, on random footprints over a relief with holes.
import assert from 'node:assert/strict';
import test from 'node:test';
import { FRONT_MAX_RAISE_M, FRONT_MAX_SAMPLES, FRONT_OUT_M, FRONT_QUANTILE, FRONT_STEP_M, footprintBase, frontBase } from './placement';
import { GroundField } from './heightField';

type V = [number, number];
// The pre-2026-11-27 implementations, verbatim.
function oldFootprintBase(ring: readonly V[], height: (x: number, y: number) => number) {
  const zs: number[] = [];
  let cx = 0, cy = 0;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i], b = ring[(i + 1) % ring.length];
    zs.push(height(a[0], a[1]), height((a[0] + b[0]) / 2, (a[1] + b[1]) / 2));
    cx += a[0] / ring.length; cy += a[1] / ring.length;
  }
  zs.push(height(cx, cy));
  const finite = zs.filter(Number.isFinite);
  if (!finite.length) return { base: 0, max: 0, mean: 0, samples: 0 };
  return { base: Math.min(...finite), max: Math.max(...finite), mean: finite.reduce((s, z) => s + z, 0) / finite.length, samples: finite.length };
}
function oldFrontBase(ring: readonly V[], height: (x: number, y: number) => number) {
  const low = oldFootprintBase(ring, height);
  if (!low.samples) return { ...low, front: low.base, low: low.base };
  let area = 0, perimeter = 0;
  for (let i = 0; i < ring.length; i++) { const a = ring[i], b = ring[(i + 1) % ring.length]; area += a[0] * b[1] - b[0] * a[1]; perimeter += Math.hypot(b[0] - a[0], b[1] - a[1]); }
  const outward = area > 0 ? 1 : -1, step = Math.max(FRONT_STEP_M, perimeter / FRONT_MAX_SAMPLES);
  const zs: number[] = [];
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i], b = ring[(i + 1) % ring.length], len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (len < 1e-6) continue;
    const ux = (b[0] - a[0]) / len, uy = (b[1] - a[1]) / len, nx = uy * outward * FRONT_OUT_M, ny = -ux * outward * FRONT_OUT_M;
    const n = Math.max(1, Math.round(len / step));
    for (let k = 0; k < n; k++) { const t = (k + 0.5) / n, z = height(a[0] + (b[0] - a[0]) * t + nx, a[1] + (b[1] - a[1]) * t + ny); if (Number.isFinite(z)) zs.push(z); }
  }
  if (!zs.length) return { ...low, front: low.base, low: low.base };
  const s = [...zs].sort((x, y) => x - y), q = s[Math.min(s.length - 1, Math.max(0, Math.round(FRONT_QUANTILE * (s.length - 1))))];
  const front = Math.min(low.base + FRONT_MAX_RAISE_M, Math.max(low.base, q));
  return { ...low, base: front, front, low: low.base };
}

function rng(seed: number) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; }; }

test('footprintBase / frontBase: the array-free code gives the old numbers on 2,000 random footprints', () => {
  const r = rng(7);
  // A relief with ridges and holes (NaN where a tile is missing).
  const height = (x: number, y: number) => ((Math.floor(x / 17) + Math.floor(y / 13)) % 7 === 0 ? NaN : Math.sin(x * 0.13) * 2.3 + Math.cos(y * 0.07) * 1.1 + x * 0.004);
  for (let k = 0; k < 2000; k++) {
    const cx = r() * 400, cy = r() * 400, n = 3 + Math.floor(r() * 12), rad = 2 + r() * 40, ring: V[] = [];
    for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2 * (k % 2 ? 1 : -1), rr = rad * (0.5 + r()); ring.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]); }
    assert.deepEqual(footprintBase(ring, height), oldFootprintBase(ring, height), `footprint ${k}`);
    assert.deepEqual(frontBase(ring, height), oldFrontBase(ring, height), `front ${k}`);
  }
  assert.deepEqual(footprintBase([[0, 0], [1, 0], [0, 1]], () => NaN), { base: 0, max: 0, mean: 0, samples: 0 });
});

test('GroundField.heightRd: the coverage edge blends the resident neighbours as before', () => {
  const f = new GroundField(2, 8), n = f.samples, r = rng(11);
  const tile = () => { const t = new Float32Array(n * n); for (let i = 0; i < t.length; i++) t[i] = Math.fround(r() * 10); return t; };
  f.addTile(0, 0, tile()); f.addTile(1, 1, tile());
  const old = (x: number, y: number) => {
    const fx = x / 2 - 0.5, fy = y / 2 - 0.5, i = Math.floor(fx), j = Math.floor(fy), u = fx - i, v = fy - j;
    const a = f.sampleAt(i, j), b = f.sampleAt(i + 1, j), c = f.sampleAt(i, j + 1), d = f.sampleAt(i + 1, j + 1);
    if (a !== a || b !== b || c !== c || d !== d) {
      const known = [[a, (1 - u) * (1 - v)], [b, u * (1 - v)], [c, (1 - u) * v], [d, u * v]].filter(([h]) => h === h);
      if (!known.length) return NaN;
      const w = known.reduce((s, [, k]) => s + k, 0);
      return w > 1e-9 ? known.reduce((s, [h, k]) => s + h * k, 0) / w : known[0][0];
    }
    return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;
  };
  let edges = 0;
  for (let k = 0; k < 5000; k++) {
    const x = r() * 20 - 2, y = r() * 20 - 2, want = old(x, y), got = f.heightRd(x, y);
    if (Number.isNaN(want)) assert.ok(Number.isNaN(got)); else assert.equal(got, want, `(${x}, ${y})`);
    if (x > 6 && x < 10) edges++;
  }
  assert.ok(edges > 100);
});

test('GroundField.changedSince: a memo over an area is stale only when a tile it reads (one sample wider) changed', () => {
  // 2 m samples, 16 m tiles.
  const f = new GroundField(2, 16), n = f.samples, tile = () => new Float32Array(n * n).fill(1);
  f.addTile(0, 0, tile());
  const v = f.version;
  assert.equal(f.changedSince(v, 2, 2, 10, 10), false);
  f.addTile(3, 3, tile());
  // Far away: still good.
  assert.equal(f.changedSince(v, 2, 2, 10, 10), false);
  // Within one sample of the area's edge (bilinear reads reach the next tile).
  f.addTile(1, 0, tile());
  assert.equal(f.changedSince(v, 2, 2, 14.5, 10), true);
  assert.equal(f.changedSince(v, 2, 2, 10, 10), false);
  const w = f.version;
  f.removeTile(0, 0);
  assert.equal(f.changedSince(w, 2, 2, 10, 10), true);
  assert.equal(f.changedSince(f.version, 2, 2, 10, 10), false);
});
