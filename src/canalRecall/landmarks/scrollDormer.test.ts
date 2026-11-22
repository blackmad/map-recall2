import assert from 'node:assert/strict';
import test from 'node:test';
import {scrollDormer} from './scrollDormer';

const opts = {t: 4, width: 2, flare: 0.4, y0: 14.4, coveH: 0.6, y1: 16.0};
const signedArea = (pts: [number, number][]) => pts.reduce((s, p, i) => { const q = pts[(i + 1) % pts.length]; return s + p[0] * q[1] - q[0] * p[1]; }, 0) / 2;

test('outline is counter-clockwise, closed by the base, and spans the feet and the cap line', () => {
  const {outline} = scrollDormer(opts);
  assert.ok(signedArea(outline) > 0, 'counter-clockwise');
  assert.deepEqual(outline[0], [5.4, 14.4]);
  const last = outline.at(-1)!;
  assert.ok(Math.abs(last[0] - 2.6) < 1e-9 && Math.abs(last[1] - 14.4) < 1e-9);
  assert.equal(Math.max(...outline.map(p => p[1])), 16.0);
  assert.equal(Math.min(...outline.map(p => p[1])), 14.4);
  // area: body rectangle plus the two coves (each the flare x coveH rectangle minus a quarter ellipse)
  const cove = 0.4 * 0.6 * (1 - Math.PI / 4);
  const want = 2 * (16.0 - 14.4) + 2 * cove;
  assert.ok(Math.abs(signedArea(outline) - want) < 0.01, `area ${signedArea(outline)} vs ${want}`);
});

test('outline is mirror symmetric about the centre line', () => {
  const {outline} = scrollDormer({...opts, segments: 5});
  for (const [t, y] of outline) assert.ok(outline.some(([u, v]) => Math.abs(u - (2 * opts.t - t)) < 1e-9 && Math.abs(v - y) < 1e-9), `mirror of ${t},${y}`);
});

test('the cove is concave: every cove point lies below the chord from the foot to the body side', () => {
  const {coves} = scrollDormer(opts);
  for (const c of coves) {
    const [a, b] = [c[0], c.at(-1)!];
    assert.ok(Math.abs(b[1] - (opts.y0 + opts.coveH)) < 1e-9 && Math.abs(Math.abs(b[0] - opts.t) - 1) < 1e-9, 'ends at the body side');
    for (const p of c.slice(1, -1)) {
      const chordY = a[1] + (b[1] - a[1]) * (p[0] - a[0]) / (b[0] - a[0]);
      assert.ok(p[1] < chordY, 'below the chord (hollow), not a bulge');
    }
    for (let i = 1; i < c.length; i++) assert.ok(c[i][1] > c[i - 1][1] && Math.abs(c[i][0] - opts.t) < Math.abs(c[i - 1][0] - opts.t), 'rises inward monotonically');
  }
});

test('bad proportions are refused', () => {
  assert.throws(() => scrollDormer({...opts, flare: 0}));
  assert.throws(() => scrollDormer({...opts, y1: opts.y0 + opts.coveH}));
});
