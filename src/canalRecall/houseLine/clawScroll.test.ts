// Belt kit roofs lane (2026-11-21): carved claw pieces as measured scrolls (clawScroll.ts, RowCrown.claw). Named
// regressions: Herengracht 16 (0363100012179761; claws 2.33 m to their top, waist 0.24, band 0.28, the hollow measured at
// 0.39 and 0.29 of the height at 0.39 and 0.67 of the reach) and Herengracht 28 (0363100012179837; narrow claws hugging the
// neck). Absent: the stock carved claw, byte for byte.
import test from 'node:test';
import assert from 'node:assert/strict';
import { RoofSink } from '../roofSink.ts';
import { CLAW_SCROLL, clawScrollPieces, clawTop } from './clawScroll.ts';
import { rowCrownAccents, rowCrownProfile, rowCrownRoofRise, type RowCrown } from './crownProfile.ts';

test('the silhouette: upright to the waist, a hollow sweep to the band (Herengracht 16 within 0.06 of its height)', () => {
  const h = 2.33, w = 0.24, b = 0.28;
  assert.equal(clawTop(0, h, w, b), h); assert.equal(clawTop(w, h, w, b), h);
  assert.ok(Math.abs(clawTop(1, h, w, b) - b * h) < 1e-9);
  for (let u = w; u < 1; u += 0.05) assert.ok(clawTop(u + 0.05, h, w, b) <= clawTop(u, h, w, b) + 1e-9, 'never rises outward');
  assert.ok(Math.abs(clawTop(0.39, h, w, b) / h - 0.39) < 0.06, `0.39 -> ${clawTop(0.39, h, w, b) / h}`);
  assert.ok(Math.abs(clawTop(0.67, h, w, b) / h - 0.29) < 0.06, `0.67 -> ${clawTop(0.67, h, w, b) / h}`);
});

test('the pieces stay on their side between the neck and the foot, cover the brick shoulder, and reach the measured top', () => {
  const neck = 0.84, foot = 2.26, under = (x: number) => Math.max(0, 1.1 * (1 - (Math.abs(x) - neck) / (foot - neck)));
  for (const sg of [-1, 1] as const) {
    const ps = clawScrollPieces({ heightM: 2.33, waist: 0.24, band: 0.28 }, sg, neck, foot, 0, under);
    const blocks = ps.filter(p => p.kind === 'block') as Array<{ pts: Array<[number, number]> }>;
    for (const b of blocks) for (const [x] of b.pts) assert.ok(sg * x >= neck - 0.15 && sg * x <= foot + 1e-9, `x ${x} on side ${sg}`);
    assert.ok(Math.abs(Math.max(...blocks.flatMap(b => b.pts.map(p => p[1]))) - 2.33) < 1e-9);
    // The body's strips stand over the brick shoulder everywhere.
    for (const b of blocks.slice(0, CLAW_SCROLL.seg)) for (const [x, y] of b.pts) if (y > 0) assert.ok(y >= under(x) + 0.08 - 1e-9);
    assert.equal(ps.filter(p => p.kind === 'volute').length, 2, 'the foot curl and the ear');
  }
});

const sink = (W: number) => new RoofSink({ cx: 0, cy: 0, ux: 1, uy: 0, len: 14, wid: W, coverage: 1, maxDev: 0 }, 0, { bayM: 1, storeyM: 3, cellM: 1 });
const draw = (c: RowCrown, W: number) => { const R = rowCrownRoofRise(c, W), s = sink(W); rowCrownAccents(s, c, rowCrownProfile(c, W, R), 7, 1, W, R, '#efebe2'); return s.out; };
const H16: RowCrown = { shape: 'neck', riseM: 3.69, dress: 'belt', neckW: 1.68, shoulderRise: 0.3, capM: 0.41, cap: 'rounded', stone: { claws: 'carved', cap: 'carved' }, neckLights: 1, lowerLights: 0 };

test('Herengracht 16: the measured scroll replaces the stock carved claw; unset, the stock claw byte for byte', () => {
  const W = 4.53, stock = draw(H16, W), scroll = draw({ ...H16, claw: { heightM: 2.33, waist: 0.24, band: 0.28 } }, W);
  assert.deepEqual(draw({ ...H16 }, W), stock);
  assert.notDeepEqual(scroll, stock);
  // The scroll stands taller than the stock piece (2.33 m against about half the neck).
  const top = (out: typeof stock) => Math.max(...out.filter(t => t.part === 'trim').flatMap(t => t.p.filter(p => Math.abs(p[1]) > 0.9 && Math.abs(p[1]) < 2.2).map(p => p[2])));
  assert.ok(top(scroll) >= 2.3, `scroll top ${top(scroll)}`);
});

test('measured claws keep the saddle under their hollow (the sky shows there); without them the stock saddle', () => {
  const W = 4.53, c = { ...H16, claw: { heightM: 2.33, waist: 0.24, band: 0.28 } };
  const R = rowCrownRoofRise(c, W), R0 = rowCrownRoofRise(H16, W);
  assert.ok(R < R0, `${R} < ${R0}`);
  for (let u = 0; u <= 1; u += 0.05) { const x = 0.84 + u * (2.265 - 0.84); assert.ok(R * (1 - x / 2.265) <= clawTop(u, 2.33, 0.24, 0.28) + 1e-6); }
});
