import assert from 'node:assert/strict';
import test from 'node:test';
import {exposedRuns, insetRing, ogeeProfile, outward, signedArea, type Part, type V2} from './pavilion-kit';
import {islandParts, LOETJE, LOETJE_INSETS, neckGableOutline} from './stationsplein-paviljoens-builder';

const sq = (x0: number, z0: number, s: number): V2[] => [[x0, z0], [x0 + s, z0], [x0 + s, z0 + s], [x0, z0 + s]];

test('outward normals point out for either winding', () => {
  for (const r of [sq(0, 0, 4), sq(0, 0, 4).reverse()]) {
    for (let i = 0; i < 4; i++) {
      const a = r[i], b = r[(i + 1) % 4], o = outward(r, i), m: V2 = [(a[0] + b[0]) / 2 + o[0], (a[1] + b[1]) / 2 + o[1]];
      assert.ok(Math.abs(m[0] - 2) > 2 - 1e-9 || Math.abs(m[1] - 2) > 2 - 1e-9, `edge ${i} normal points inside`);
    }
  }
});

test('exposedRuns: a lower neighbour exposes the wall above its top, a taller one hides it', () => {
  const parts: Part[] = [{ring: sq(0, 0, 4), top: 6}, {ring: sq(4, 0, 4), top: 3}, {ring: sq(-4, 0, 4), top: 8}];
  const runs = exposedRuns(parts, 0);
  const east = runs.filter(r => r.out[0] > .9), west = runs.filter(r => r.out[0] < -.9);
  assert.equal(east.length, 1); assert.equal(east[0].from, 3); assert.ok(Math.abs(east[0].t1 - east[0].t0 - 4) < 1e-9);
  assert.equal(west.length, 0, 'the taller western neighbour hides that wall');
  assert.ok(runs.filter(r => Math.abs(r.out[1]) > .9).every(r => r.from === 0), 'north and south walls stand from the ground');
});

test('exposedRuns splits an edge that is only partly shared', () => {
  const parts: Part[] = [{ring: sq(0, 0, 4), top: 5}, {ring: [[4, 1], [6, 1], [6, 3], [4, 3]], top: 2}];
  const east = exposedRuns(parts, 0).filter(r => r.out[0] > .9).map(r => [r.t0, r.t1, r.from]);
  assert.deepEqual(east.map(r => r[2]), [0, 2, 0]);
  assert.ok(Math.abs(east[1][0] - 1) < .26 && Math.abs(east[1][1] - 3) < .26);
});

test('insetRing keeps zero-inset edges and shrinks the others', () => {
  const r = sq(0, 0, 10), inner = insetRing(r, [0, 2, 2, 2]);
  assert.ok(Math.abs(signedArea(inner)) < Math.abs(signedArea(r)));
  for (const p of inner) assert.ok(p[1] >= -1e-9, 'the zero-inset edge (z = 0) stays put');
  assert.throws(() => insetRing(sq(0, 0, 3), [2, 2, 2, 2]), /reverses/);
});

test('the Loetje mansard inset is valid and its ring is the authored one', () => {
  const inner = insetRing(LOETJE, LOETJE_INSETS);
  assert.equal(inner.length, LOETJE.length);
  assert.ok(Math.abs(signedArea(inner)) > 0.4 * Math.abs(signedArea(LOETJE)));
});

test('island parts: every part has walls and the stolp north wall stands from the ground', () => {
  const P = islandParts(), list = Object.values(P), keys = Object.keys(P);
  for (const k of keys) assert.ok(exposedRuns(list, keys.indexOf(k)).length > 0, `${k} has no exposed wall`);
  const north = exposedRuns(list, keys.indexOf('stolp')).filter(r => r.from === 0 && r.out[1] < -.5);
  const len = north.reduce((s, r) => s + r.t1 - r.t0, 0);
  assert.ok(len > 4.5 && len < 6.5, `exposed stolp north wall ${len.toFixed(1)} m (panorama w04: about 5.5 m beside the hall)`);
});

test('neck gable outline is symmetric and rises above the kiosk ridge', () => {
  const o = neckGableOutline(6.9, 3.9);
  const top = Math.max(...o.map(p => p[1]));
  assert.ok(top > 7.3 && top < 8.9, `neck top ${top}`);
  const xs = o.map(p => p[0]).sort((a, b) => a - b);
  assert.ok(Math.abs(xs[0] + xs[xs.length - 1]) < 1e-9);
});

test('ogee profile starts with a lip and narrows to the neck', () => {
  const p = ogeeProfile(1, 0, 2);
  assert.equal(p[0][1], 0); assert.ok(p[1][1] >= .1 - 1e-9);
  assert.ok(Math.abs(p[p.length - 1][1] - 2) < 1e-9); assert.ok(p[p.length - 1][0] < .2);
});
