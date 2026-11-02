import assert from 'node:assert/strict';
import test from 'node:test';
import {clawOutline, gableSilhouette, pedimentOutline, signedArea, type NeckGableSpec} from './neck-gable';

// Herengracht 366 as measured on the rectified 2021 panorama (cromhouthuizen-builder.ts)
const g: NeckGableSpec = {x0: 11.9, x1: 20.0, axis: 15.95, neckHalf: 1.85, shoulderY: 16.6, clawTopY: 17.4, corniceY: 20.9, corniceH: 0.6, corniceHalf: 2.05, apexY: 22.5};

test('claw outlines are closed, counter-clockwise and stay between the house edge and the neck', () => {
  for (const side of [-1, 1] as const) {
    const r = clawOutline(g, side);
    assert.ok(signedArea(r) > 0, 'counter-clockwise');
    const edge = side < 0 ? g.x0 : g.x1, neck = g.axis + side * g.neckHalf;
    for (const [t, y] of r) {
      assert.ok(t >= Math.min(edge, neck) - 1e-9 && t <= Math.max(edge, neck) + 1e-9, `t ${t} outside the shoulder`);
      assert.ok(y >= g.shoulderY - 1e-9 && y <= g.clawTopY + 1e-9, `y ${y} outside the claw band`);
    }
  }
});

test('the claw is concave: flat at the house edge, vertical against the neck', () => {
  const r = clawOutline(g, -1, 16).filter(p => p[1] > g.shoulderY + 1e-9 || p[0] === g.x0);
  const curve = r.filter(p => !(p[0] === g.axis - g.neckHalf && p[1] === g.shoulderY)).sort((a, b) => a[0] - b[0]);
  // the curve lies on or below the chord from its foot to its top
  const [a, b] = [curve[0], curve[curve.length - 1]];
  for (const [t, y] of curve) {
    const chord = a[1] + (b[1] - a[1]) * (t - a[0]) / (b[0] - a[0]);
    assert.ok(y <= chord + 1e-9, `point (${t}, ${y}) above the chord`);
  }
});

test('a gable on its own axis is mirror symmetric', () => {
  const s: NeckGableSpec = {...g, x0: -4, x1: 4, axis: 0};
  const L = clawOutline(s, -1), R = clawOutline(s, 1);
  const key = (r: [number, number][]) => r.map(([t, y]) => `${Math.abs(t).toFixed(6)},${y.toFixed(6)}`).sort().join(' ');
  assert.equal(key(L), key(R));
});

test('the silhouette rises from the shoulders to the pediment apex and ends at the party lines', () => {
  const s = gableSilhouette(g);
  assert.equal(s[0][0], g.x0);
  assert.equal(s[s.length - 1][0], g.x1);
  assert.equal(Math.max(...s.map(p => p[1])), g.apexY);
  const ped = pedimentOutline(g);
  assert.equal(ped.length, 3);
  assert.ok(Math.abs(ped[2][1] - (g.apexY - g.corniceY - g.corniceH)) < 1e-9);
});

test('a segmental crown is an arc from the cornice ends to the apex, counter-clockwise, and tops the silhouette', () => {
  const s: NeckGableSpec = {...g, crown: 'segment'};
  const ped = pedimentOutline(s);
  assert.ok(signedArea(ped) > 0, 'counter-clockwise');
  const top = s.apexY - s.corniceY - s.corniceH;
  assert.ok(Math.abs(Math.max(...ped.map(p => p[1])) - top) < 1e-9);
  for (const [x, y] of ped) { assert.ok(Math.abs(x) <= s.corniceHalf + 1e-9); assert.ok(y >= -1e-9 && y <= top + 1e-9); }
  const sil = gableSilhouette(s);
  assert.equal(Math.max(...sil.map(p => p[1])), s.apexY);
  assert.equal(sil[0][0], s.x0);
  assert.equal(sil[sil.length - 1][0], s.x1);
});

test('the default crown is unchanged: a triangle', () => {
  const ped = pedimentOutline(g);
  assert.equal(ped.length, 3);
  assert.deepEqual(ped.slice(0, 2), [[-g.corniceHalf, 0], [g.corniceHalf, 0]]);
  assert.deepEqual(ped[2], [0, g.apexY - (g.corniceY + g.corniceH)]);
});
