import assert from 'node:assert/strict';
import test from 'node:test';
import {outwardRing, planeAt, ringHeightRuns, type P2} from './ring-height-runs';

const square: P2[] = [[0, 0], [10, 0], [10, 10], [0, 10]];

test('outwardRing winds so n = (-tz, tx) points out of the ring', () => {
  for (const r of [square, [...square].reverse()]) {
    const q = outwardRing(r), [a, b] = [q[0], q[1]], L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const n = [-(b[1] - a[1]) / L, (b[0] - a[0]) / L], m = [(a[0] + b[0]) / 2 + n[0], (a[1] + b[1]) / 2 + n[1]];
    assert.ok(m[0] < 0 || m[0] > 10 || m[1] < 0 || m[1] > 10, 'midpoint + n is outside');
  }
});

test('planeAt fits a sloped piece and clamps to its range', () => {
  const pc = [[0, 10, 0], [10, 20, 0], [10, 20, 10], [0, 10, 10]];
  assert.ok(Math.abs(planeAt(pc, [5, 5]) - 15) < 1e-6);
  assert.equal(planeAt(pc, [20, 5]), 20);
});

test('runs split an edge at a step in the roof and carry the miters', () => {
  const lo = [[0, 9, 0], [6, 9, 0], [6, 9, 10], [0, 9, 10]], hi = [[6, 21, 0], [10, 21, 0], [10, 21, 10], [6, 21, 10]];
  const edges = ringHeightRuns(square, [lo, hi]);
  assert.equal(edges.length, 4);
  for (const e of edges) assert.ok(Math.abs(e.ext0 - 0.3) < 1e-9 && Math.abs(e.ext1 - 0.3) < 1e-9, 'convex square corners extend by off');
  const stepped = edges.filter(e => e.runs.length === 2);
  assert.equal(stepped.length, 2, 'the two edges crossing x = 6 step');
  for (const e of stepped) {
    const tops = e.runs.map(r => r.top).sort((a, b) => a - b);
    assert.deepEqual(tops, [9, 21]);
    const cut = e.runs[0].s1;
    assert.ok(Math.abs(cut - 6) < 0.6 || Math.abs(cut - 4) < 0.6);
  }
});

test('a concave corner stops the fronts short', () => {
  const L: P2[] = [[0, 0], [10, 0], [10, 4], [4, 4], [4, 10], [0, 10]];
  const pc = [[0, 6, 0], [10, 6, 0], [10, 6, 10], [0, 6, 10]];
  const edges = ringHeightRuns(L, [pc]);
  assert.ok(edges.some(e => e.ext0 < -0.29 || e.ext1 < -0.29));
});

test('pieceFacadeBands finds the upper wall of a set-back storey over a lower roof', async () => {
  const {pieceFacadeBands} = await import('./ring-height-runs');
  const low = [[0, 5, 0], [10, 5, 0], [10, 5, 10], [0, 5, 10]], high = [[2, 20, 2], [8, 20, 2], [8, 20, 8], [2, 20, 8]];
  const edges = pieceFacadeBands([low, high]);
  const hb = edges.filter(e => e.piece === 1).flatMap(e => e.bands);
  assert.equal(hb.length, 4);
  for (const b of hb) assert.ok(b.bottom === 5 && b.top === 20);
  const lb = edges.filter(e => e.piece === 0).flatMap(e => e.bands);
  assert.equal(lb.length, 4, 'the low piece shows its four street walls');
  for (const b of lb) assert.ok(b.bottom === 0 && b.top === 5);
});
