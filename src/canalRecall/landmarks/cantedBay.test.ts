import assert from 'node:assert/strict';
import test from 'node:test';
import {cantedBayFacets, cantedBayOutline, facetOpening, offsetOutline} from './cantedBay';

const near = (a: number, b: number, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} vs ${b}`);

test('a symmetric trapezoid bay: front facet faces out, the sides splay symmetrically', () => {
  const f = cantedBayFacets({t: 5, base: 3.1, front: 1.5, out: 0.75});
  assert.equal(f.length, 3);
  near(f[1].width, 1.5);
  near(f[1].normal[0], 0); near(f[1].normal[1], 1);
  near(f[1].centre[0], 5); near(f[1].centre[1], 0.75);
  // sides: run 0.8 m along the wall and 0.75 m out
  near(f[0].width, Math.hypot(0.8, 0.75)); near(f[2].width, f[0].width);
  near(f[0].angle, -f[2].angle);
  assert.ok(f[0].normal[0] < 0 && f[0].normal[1] > 0 && f[2].normal[0] > 0 && f[2].normal[1] > 0);
  for (const x of f) near(Math.hypot(...x.normal), 1);
});

test('outline runs wall-left, front-left, front-right, wall-right', () => {
  assert.deepEqual(cantedBayOutline({t: 0, base: 2, front: 1, out: 0.5}), [[-1, 0], [-0.5, 0.5], [0.5, 0.5], [1, 0]]);
});

test('offset outline stays parallel to every facet and meets the wall line', () => {
  const p = {t: 2, base: 2.4, front: 1.2, out: 0.6}, d = 0.1;
  const o = offsetOutline(p, d), f = cantedBayFacets(p);
  near(o[0][1], 0); near(o[3][1], 0);
  near(o[1][1], 0.7); near(o[2][1], 0.7);
  // each offset point lies d from its facets' lines
  const dist = (q: [number, number], k: number) => (q[0] - f[k].a[0]) * f[k].normal[0] + (q[1] - f[k].a[1]) * f[k].normal[1];
  near(dist(o[1], 0), d); near(dist(o[1], 1), d); near(dist(o[2], 1), d); near(dist(o[2], 2), d);
  // symmetric about the bay axis, wider than the base
  near(o[0][0] + o[3][0], 2 * p.t); assert.ok(o[3][0] - o[0][0] > p.base);
  offsetOutline(p, 0).forEach((q, i) => { near(q[0], cantedBayOutline(p)[i][0]); near(q[1], cantedBayOutline(p)[i][1]); });
});

test('a square bay (front = base) has sides square to the wall; bad plans throw', () => {
  const f = cantedBayFacets({t: 0, base: 1, front: 1, out: 0.4});
  near(f[0].angle, -Math.PI / 2); near(f[2].angle, Math.PI / 2); near(f[0].width, 0.4);
  assert.throws(() => cantedBayFacets({t: 0, base: 1, front: 1.2, out: 0.4}));
  assert.throws(() => cantedBayFacets({t: 0, base: 1, front: 0.5, out: 0}));
  near(facetOpening(f[1], 0.2), 0.6); near(facetOpening(f[0], 0.3), 0);
});
