// Kit-gables lane (2026-11-21): the belt gable parts a crown read states (houseLine/crownProfile.ts RowCrown raiseM,
// capM, footLedge, neckLights, lowerLights). Named regressions: Herengracht 64 (0363100012168545, an elevated neck: one
// light in its full-width rise, one in the neck, carved claws) and Herengracht 84 (0363100012175702, a step gable with three
// lights in its lowest storey and one in the top). Absent: the profile and accents are the stock belt neck's, byte for byte.
import test from 'node:test';
import assert from 'node:assert/strict';
import { RoofSink } from '../roofSink.ts';
import { rowCrownAccents, rowCrownProfile, rowCrownRoofRise, type RowCrown } from './crownProfile.ts';

const sink = (W: number) => new RoofSink({ cx: 0, cy: 0, ux: 1, uy: 0, len: 14, wid: W, coverage: 1, maxDev: 0 }, 0, { bayM: 1, storeyM: 3, cellM: 1 });
const draw = (c: RowCrown, W: number) => { const R = rowCrownRoofRise(c, W), s = sink(W); rowCrownAccents(s, c, rowCrownProfile(c, W, R), 7, 1, W, R, '#efebe2'); return s.out; };
/** Glass panes as [v0, v1, z0, z1] (two triangles each, grouped by their box). */
const panes = (out: ReturnType<typeof draw>) => {
  const g = out.filter(t => t.hex === '#272c33'), boxes: Array<[number, number, number, number]> = [];
  for (let i = 0; i + 1 < g.length; i += 2) { const p = [...g[i].p, ...g[i + 1].p]; boxes.push([Math.min(...p.map(q => q[1])), Math.max(...p.map(q => q[1])), Math.min(...p.map(q => q[2])), Math.max(...p.map(q => q[2]))]); }
  return boxes;
};
const H64: RowCrown = { shape: 'neck', riseM: 7.7, dress: 'belt', raiseM: 3.1, neckW: 2.8, shoulderRise: 0.64, capM: 0.6, cap: 'segmental', stone: { claws: 'carved' }, neckLights: 1, lowerLights: 1 };

test('an elevated neck (Herengracht 64): full width up to its rise, then the shoulders; symmetric, never back', () => {
  const W = 6.7, p = rowCrownProfile(H64, W, rowCrownRoofRise(H64, W));
  // The upright sides at the front's edges reach the rise.
  assert.ok(p.some(([x, y]) => Math.abs(x + W / 2) < 1e-6 && Math.abs(y - 3.1) < 1e-6), 'left side to the rise');
  assert.ok(p.some(([x, y]) => Math.abs(x - W / 2) < 1e-6 && Math.abs(y - 3.1) < 1e-6), 'right side to the rise');
  for (let i = 1; i < p.length; i++) assert.ok(p[i][0] >= p[i - 1][0] - 1e-9);
  for (const [x, y] of p) assert.ok(p.some(([u, v]) => Math.abs(u + x) < 1e-6 && Math.abs(v - y) < 1e-6), `asymmetric at ${x}`);
  assert.ok(Math.abs(Math.max(...p.map(q => q[1])) - 7.7) < 0.02);
  // Without a rise it is the stock belt neck.
  const { raiseM: _r, ...flat } = H64;
  assert.ok(!rowCrownProfile(flat, W, rowCrownRoofRise(flat, W)).some(([x, y]) => Math.abs(x + W / 2) < 1e-6 && y > 0.5));
});

test('stated lights: Herengracht 64 one in the rise and one in the neck over it; Herengracht 84 three low and one in the top', () => {
  const W = 6.7, ps = panes(draw(H64, W)).sort((a, b) => a[2] - b[2]);
  assert.equal(ps.length, 2);
  assert.ok(ps[0][3] <= 3.1, `lower light under the rise top (${ps[0][3]})`);
  assert.ok(ps[1][2] > 3.1, 'neck light over the rise');
  for (const q of ps) assert.ok(Math.abs((q[0] + q[1]) / 2) < 1e-6, 'centred');
  const c84: RowCrown = { shape: 'step', riseM: 5.6, dress: 'belt', neckW: 1.4, lowerLights: 3, neckLights: 1 };
  const p84 = panes(draw(c84, 5.4)).sort((a, b) => a[2] - b[2]);
  assert.equal(p84.length, 4);
  const low = p84.slice(0, 3);
  assert.ok(low.every(q => Math.abs(q[2] - low[0][2]) < 1e-6), 'one row');
  assert.ok(p84[3][2] > low[0][3], 'the top light over the row');
});

test('no stated parts: the accents are the stock belt neck\'s', () => {
  const base: RowCrown = { shape: 'neck', riseM: 4, dress: 'belt' };
  assert.deepEqual(draw({ ...base }, 5), draw(base, 5));
  assert.equal(panes(draw(base, 5)).length, 1);
  // A foot ledge adds stone across the whole front at the foot.
  const led = draw({ ...base, footLedge: true }, 5);
  assert.ok(led.length > draw(base, 5).length);
});
