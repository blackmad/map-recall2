// Belt kit roofs lane (2026-11-21): the Jugendstil sweep (crownSweep.ts, RowCrown.sweep) and a pair of crowns over one front
// (RowCrown.pair). Named regressions: Herengracht 74 (0363100012175616; a left sweep from 0.2 to 0.43 of the front, a pier
// and a pinnacle, a three-light window with its left light arched) and Herengracht 76-78 (0363100012175784; two neck gables
// over one pand).
import test from 'node:test';
import assert from 'node:assert/strict';
import { sweepOutline, sweepParts, sweepRoofRise, type CrownSweep } from './crownSweep.ts';
import { rowCrownProfile, rowCrownRoofRise, PAIR_VALLEY_M, type RowCrown } from './crownProfile.ts';

const S74: CrownSweep = { side: 'left', startShare: 0.2, topShare: 0.43, ledgeM: 0.12, roundShare: 0.45, pierM: [0.4, 0.82], pinnacleM: [0.45, 0.55], window: { lights: 3, widthShare: 0.52, headGapM: 1.0, archNearSweep: true } };
const at = (p: Array<[number, number]>, x: number) => Math.max(...p.filter((q, i) => i < p.length - 1).flatMap((q, i) => { const r = p[i + 1]; if ((q[0] - x) * (r[0] - x) > 0) return []; return [Math.abs(r[0] - q[0]) < 1e-9 ? Math.max(q[1], r[1]) : q[1] + (x - q[0]) / (r[0] - q[0]) * (r[1] - q[1])]; }));

test('Herengracht 74: low at the swept left, the flat top from 0.43 of the front to the right edge; never back', () => {
  const W = 4.4, T = 3.05, p = sweepOutline(S74, W, T) as Array<[number, number]>;
  for (let i = 1; i < p.length; i++) assert.ok(p[i][0] >= p[i - 1][0] - 1e-9);
  assert.deepEqual(p[0], [-2.2, 0]); assert.deepEqual(p[p.length - 1], [2.2, 0]);
  assert.ok(at(p, -2.2 + 0.1 * W) < 0.2, 'the ledge');
  assert.ok(Math.abs(at(p, -2.2 + 0.43 * W) - T) < 1e-6 && Math.abs(at(p, 2.1) - T) < 1e-6, 'the flat top');
  // A right sweep mirrors it; a sweep on both sides is symmetric.
  const r = sweepOutline({ ...S74, side: 'right' }, W, T) as Array<[number, number]>;
  assert.ok(Math.abs(at(r, 2.2 - 0.1 * W) - at(p, -2.2 + 0.1 * W)) < 1e-6);
  const b = sweepOutline({ ...S74, side: 'both' }, W, T) as Array<[number, number]>;
  for (const x of [0.3, 0.9, 1.5, 2.0]) assert.ok(Math.abs(at(b, x) - at(b, -x)) < 1e-6);
});

test('Herengracht 74: a pier at the swept end, a pinnacle over the top at the other, three lights under the outline, the left one arched', () => {
  const W = 4.4, T = 3.05, parts = sweepParts(S74, W, T), p = sweepOutline(S74, W, T) as Array<[number, number]>;
  const stone = parts.filter(q => q.tone === 'stone');
  assert.ok(stone.some(q => q.pts.every(([x]) => x <= -2.2 + 0.4 + 1e-9) && Math.max(...q.pts.map(v => v[1])) >= 0.82), 'left pier');
  assert.ok(stone.some(q => q.pts.every(([x]) => x >= 2.2 - 0.45 - 1e-9) && Math.max(...q.pts.map(v => v[1])) >= T + 0.55), 'right pinnacle');
  const glass = parts.filter(q => q.tone === 'glass');
  assert.ok(glass.length > 0);
  for (const g of glass) for (const [x, y] of g.pts) assert.ok(y <= at(p, x) + 1e-6, `glass under the outline at ${x}`);
  const x0 = Math.min(...glass.flatMap(g => g.pts.map(v => v[0]))), x1 = Math.max(...glass.flatMap(g => g.pts.map(v => v[0])));
  assert.ok(Math.abs(x1 - x0 - 0.52 * W) < 1e-6, 'the window 0.52 of the front');
  const mullions = parts.filter(q => q.tone === 'frame' && q.pts.length === 4 && Math.abs(q.pts[1][0] - q.pts[0][0] - 0.1) < 1e-6);
  assert.equal(mullions.length, 2, 'three lights');
  // Each glass strip's left top corner is the head at its left edge.
  const headAt = (x: number) => { const g = glass.reduce((a, q) => Math.abs(q.pts[3][0] - x) < Math.abs(a.pts[3][0] - x) ? q : a); return g.pts[3][1]; };
  assert.ok(headAt(x0) < T - 1.0 - 0.3, `the left light springs low (arched): ${headAt(x0)}`);
  assert.ok(Math.abs(headAt(x0 + 0.52 * W / 6) - (T - 1.0)) < 0.05, 'its crown on the head line');
  assert.ok(Math.abs(headAt(x1 - 0.2) - (T - 1.0)) < 1e-6, 'the right light flat at the head line');
});

test('the sweep through RowCrown: the profile is the sweep outline over a saddle that stays under it', () => {
  const W = 4.4, c: RowCrown = { shape: 'bell', riseM: 3.05, dress: 'belt', sweep: S74 };
  const R = rowCrownRoofRise(c, W);
  assert.equal(R, sweepRoofRise(S74, W, 3.05));
  const p = rowCrownProfile(c, W, R), o = sweepOutline(S74, W, 3.05);
  assert.equal(p.length, o.length);
  p.forEach(([x, y], i) => { assert.equal(x, o[i][0]); assert.ok(Math.abs(y - o[i][1]) < 1e-9); });
});

test('Herengracht 76-78: a pair draws two necks on the halves, the valley between them at most PAIR_VALLEY_M', () => {
  const W = 8.33, c: RowCrown = { shape: 'neck', riseM: 3.6, dress: 'belt', neckW: 1.44, shoulderRise: 0.3, capM: 0.5, cap: 'rounded', stone: { claws: 'carved' }, pair: true };
  const R = rowCrownRoofRise(c, W);
  assert.ok(R <= PAIR_VALLEY_M);
  const p = rowCrownProfile(c, W, R) as Array<[number, number]>;
  for (let i = 1; i < p.length; i++) assert.ok(p[i][0] >= p[i - 1][0] - 1e-9);
  assert.ok(Math.abs(at(p, -W / 4) - 3.6) < 0.05 && Math.abs(at(p, W / 4) - 3.6) < 0.05, 'two tops at the halves\' centres');
  assert.ok(at(p, 0) <= PAIR_VALLEY_M + 0.05, `valley ${at(p, 0)}`);
  // Unpaired: one crown at the centre.
  const { pair: _p, ...one } = c;
  assert.ok(Math.abs(at(rowCrownProfile(one, W, rowCrownRoofRise(one, W)) as Array<[number, number]>, 0) - 3.6) < 0.05);
});
