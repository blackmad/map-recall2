import assert from 'node:assert/strict';
import test from 'node:test';
import {arcFrame, bayAngles, domeProfile} from './roundTower';

const near = (a: number, b: number, eps = 1e-9) => Math.abs(a - b) < eps;

test('arcFrame sits on the circle with an outward normal and the viewer-right tangent', () => {
  // north point of a circle at the origin (z south, so north is -z): normal (0, -1), viewer's right facing south is west
  const f = arcFrame([0, 0], 2, -Math.PI / 2);
  assert.ok(near(f.origin[0], 0) && near(f.origin[1], -2));
  assert.ok(near(f.n[0], 0) && near(f.n[1], -1));
  assert.ok(near(f.tangent[0], -1) && near(f.tangent[1], 0));
  // same convention as nearbar-kit ringFrame: tangent x n = +1 everywhere, as for ringFrame
  for (const a of [0, 1, 2.5, -2]) {
    const g = arcFrame([3, 4], 1.5, a);
    assert.ok(near(Math.hypot(g.origin[0] - 3, g.origin[1] - 4), 1.5));
    assert.ok(near(g.tangent[0] * g.n[1] - g.tangent[1] * g.n[0], 1));
  }
  assert.throws(() => arcFrame([0, 0], 0, 0));
});

test('bayAngles centres the run and reads left to right (decreasing angle)', () => {
  const a = bayAngles(-Math.PI / 2, 3, 1.2, 2.4);
  assert.equal(a.length, 3);
  assert.ok(near(a[1], -Math.PI / 2));
  assert.ok(a[0] > a[1] && a[1] > a[2]);
  assert.ok(near((a[0] - a[1]) * 2.4, 1.2));
  assert.deepEqual(bayAngles(0.3, 1, 5, 2), [0.3]);
  assert.throws(() => bayAngles(0, 0, 1, 1));
  assert.throws(() => bayAngles(0, 2, 1, 0));
});

test('domeProfile springs at the radius, closes at the crown and stays monotonic', () => {
  for (const e of [1.5, 2, 3]) {
    const p = domeProfile({radius: 2.1, rise: 4.3, exponent: e, steps: 10});
    assert.deepEqual(p[0], [2.1, 0]);
    assert.deepEqual(p[p.length - 1], [0, 4.3]);
    for (let i = 1; i < p.length; i++) assert.ok(p[i][0] <= p[i - 1][0] + 1e-12 && p[i][1] >= p[i - 1][1] - 1e-12);
    // every point on the superellipse
    for (const [r, y] of p) assert.ok(near(Math.pow(r / 2.1, e) + Math.pow(y / 4.3, e), 1, 1e-9));
  }
  // a fuller exponent stands steeper: higher at half the radius
  const yAtHalf = (e: number) => { const p = domeProfile({radius: 2, rise: 4, exponent: e, steps: 64}); return p.find(q => q[0] <= 1)![1]; };
  assert.ok(yAtHalf(3) > yAtHalf(2));
});

test('domeProfile with a neck ends on the neck ring below the crown', () => {
  const p = domeProfile({radius: 2, rise: 4, neck: 0.4, steps: 12});
  const last = p[p.length - 1];
  assert.ok(near(last[0], 0.4));
  assert.ok(last[1] < 4 && last[1] > 3.5);
  assert.throws(() => domeProfile({radius: 2, rise: 4, neck: 2}));
  assert.throws(() => domeProfile({radius: 0, rise: 4}));
});
