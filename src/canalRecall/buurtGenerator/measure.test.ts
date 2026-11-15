// Buurt generator round 9 (docs/handoffs/buurt-generators-20261115.md): the row brick read from panoramas (white
// balance on the trim, warm median, the vote across captures) and the roof form from the AHN DSM.
import test from 'node:test';
import assert from 'node:assert/strict';
import { isFoliage, labOf, roofFormOf, voteWall, wallBrickOf, whiteRefOf, type RoofCell, type WallRead } from './measure.js';
import { oklab } from '../retailPuiPaint.js';

test('foliage: green counts, yellow brick does not', () => {
  assert.equal(isFoliage(70, 110, 50), true);
  assert.equal(isFoliage(190, 185, 130), false, 'Amsterdam-Zuid yellow brick');
  assert.equal(isFoliage(140, 110, 90), false);
});

// A band: 60 % brick, 10 % white trim, 30 % dark glass, all under one camera cast (cyan) and exposure.
const band = (brick: [number, number, number], white: [number, number, number]) => [
  ...Array.from({ length: 600 }, (_, i) => brick.map(v => v + (i % 7) - 3) as [number, number, number]),
  ...Array.from({ length: 100 }, () => white), ...Array.from({ length: 300 }, () => [40, 42, 44] as [number, number, number]),
].map(([r, g, b]) => labOf(r, g, b));

test('the brick is read over its white trim: a cast camera and a bright one agree', () => {
  const warm = wallBrickOf(band([139, 118, 102], [237, 237, 235]))!, cyan = wallBrickOf(band([96, 92, 86], [165, 175, 178]))!;
  assert.ok(warm.balanced && cyan.balanced);
  const [a, b] = [oklab(...(warm.hex.match(/\w\w/g)!.map(h => parseInt(h, 16)) as [number, number, number])), oklab(...(cyan.hex.match(/\w\w/g)!.map(h => parseInt(h, 16)) as [number, number, number]))];
  assert.ok(Math.abs(a[0] - b[0]) < 0.1, `lightness over the white: ${warm.hex} vs ${cyan.hex}`);
  assert.ok(Math.hypot(a[1] - b[1], a[2] - b[2]) < 0.03, `cast removed: ${warm.hex} vs ${cyan.hex}`);
  // A buff wall with no trim: its own warm brightest pixels are not taken for white.
  assert.equal(whiteRefOf(Array.from({ length: 200 }, (_, i) => labOf(200 + (i % 20), 175, 120))), null);
});

test('the vote: two captures that agree draw; a lone or split read leaves the pool', () => {
  const v = (pano: string, date: string, rgb: [number, number, number]): WallRead => ({ pano, date, verdict: { hex: '#000000', lab: labOf(...rgb), share: 0.6, kind: 'brick', balanced: true } });
  const ok = voteWall([v('a', '2022-03-21', [139, 118, 102]), v('b', '2021-04-28', [132, 112, 98]), v('c', '2025-07-29', [200, 200, 205])]);
  assert.ok(!('skip' in ok) && ok.n === 2 && ok.dates === 2 && ok.balanced, JSON.stringify(ok));
  assert.ok('skip' in voteWall([v('a', '2022-03-21', [139, 118, 102])]));
  assert.ok('skip' in voteWall([v('a', '2022-03-21', [139, 118, 102]), v('b', '2021-04-28', [90, 110, 140])]));
});

// Synthetic DSM cells for a 20 m row 10 m deep: h(t, n).
const cells = (h: (t: number, n: number) => number): RoofCell[] => {
  const out: RoofCell[] = [];
  for (let t = 0.25; t < 20; t += 0.5) for (let n = 0.25; n < 10; n += 0.5) out.push({ t, n, h: h(t, n) });
  return out;
};
test('roof form: pitched from the front, flat, highest at the front, and hipped ends', () => {
  const pitched = roofFormOf(cells((_, n) => 10 + Math.min(n, 3) * 1.6), 20);
  assert.equal(pitched.form, 'pitched', pitched.why);
  assert.equal(roofFormOf(cells((_, n) => 10 + Math.min(n, 10 - n) * 0.7), 20).form, 'hidden-pitch', 'a gentle pitch behind the front is not seen');
  assert.equal(roofFormOf(cells(() => 12), 20).form, 'flat');
  assert.equal(roofFormOf(cells((_, n) => (n < 2 ? 15 : 12)), 20).form, 'flat', 'a high front over a lower back: the street sees a flat top');
  const hip = roofFormOf(cells((t, n) => 10 + Math.min(n, 10 - n, t, 20 - t) * 1.6), 20);
  assert.deepEqual(hip.hipped, { start: true, end: true });
  assert.deepEqual(roofFormOf(cells((t, n) => 10 + Math.min(n, 10 - n, t, 20 - t) * 1.6), 20, { start: false, end: true }).hipped, { start: false, end: true });
  assert.equal(roofFormOf(cells(() => 12).slice(0, 20), 20).form, 'unclear', 'too few cells');
});
