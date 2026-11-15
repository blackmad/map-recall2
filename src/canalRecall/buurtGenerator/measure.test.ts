// Buurt generator round 9 (docs/handoffs/buurt-generators-20261115.md): the row brick read from panoramas (white
// balance on the trim, warm median, the vote across captures) and the roof form from the AHN DSM.
import test from 'node:test';
import assert from 'node:assert/strict';
import { HUE_GUARD, hueGuard, isFoliage, labOf, localFront, roofFormOf, visibleAlong, voteWall, wallBrickOf, whiteRefOf, type RoofCell, type WallRead } from './measure.js';
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

test('the camera sees only the unblocked, not edge-on, part of the row (Lekstraat 147614: a corner block filled the window)', () => {
  // A 40 m front on y = 0, the camera 12 m out at x = 10; a block between them covering x 0-6 at y 3-8.
  const a = { x: 0, y: 0 }, b = { x: 40, y: 0 }, cam = { x: 10, y: 12 };
  const block = [{ x: 0, y: 3 }, { x: 6, y: 3 }, { x: 6, y: 8 }, { x: 0, y: 8 }, { x: 0, y: 3 }];
  const free = visibleAlong(cam, a, b, []), seen = visibleAlong(cam, a, b, [block]);
  const at = (v: boolean[], t: number) => v[Math.round(t / 0.5)];
  assert.equal(at(free, 10), true, 'square on');
  assert.equal(at(free, 35), false, 'edge-on (64 deg): a smear');
  assert.equal(at(seen, 2), false, 'behind the block');
  assert.equal(at(seen, 12), true);
  // A neighbour sharing the wall line (touching the front) does not block it.
  const party = [{ x: 40, y: 0 }, { x: 50, y: 0 }, { x: 50, y: 10 }, { x: 40, y: 10 }, { x: 40, y: 0 }];
  assert.equal(at(visibleAlong(cam, a, b, [party]), 15), true);
});

test('a bent row is read on the straight run nearest the camera, not its chord', () => {
  // Ten 6 m members along x, then ten turning 40 degrees: the chord from first to last cuts the corner.
  const segs: [{ x: number; y: number }, { x: number; y: number }][] = [];
  for (let i = 0; i < 10; i++) segs.push([{ x: i * 6, y: 0 }, { x: i * 6 + 6, y: 0 }]);
  const c = Math.cos((40 * Math.PI) / 180), s = Math.sin((40 * Math.PI) / 180);
  for (let i = 0; i < 10; i++) segs.push([{ x: 60 + i * 6 * c, y: i * 6 * s }, { x: 60 + (i + 1) * 6 * c, y: (i + 1) * 6 * s }]);
  const lf = localFront(segs, { x: 20, y: -15 })!;
  assert.ok(lf.hi <= 9, 'the run stops at the bend');
  assert.ok(Math.hypot(lf.b.x - lf.a.x, lf.b.y - lf.a.y) <= 30.001, 'within spanM');
  assert.ok(Math.abs(lf.a.y) < 1e-9 && Math.abs(lf.b.y) < 1e-9, 'on the straight leg');
  assert.ok(Math.abs(Math.abs(lf.offM) - 15) < 1e-9, 'offset is the camera distance off the run');
  assert.equal(localFront([], { x: 0, y: 0 }), null);
});

test('hue guard: the white balance moves a read at most 12 deg toward red, and a grey raw read never lands pink-mauve', () => {
  const at = (L: number, C: number, h: number): [number, number, number] => [L, C * Math.cos((h * Math.PI) / 180), C * Math.sin((h * Math.PI) / 180)];
  const hueOf = (l: readonly number[]) => ((Math.atan2(l[2], l[1]) * 180) / Math.PI + 360) % 360;
  // Within the shift: untouched.
  assert.deepEqual(hueGuard(at(0.5, 0.03, 50), at(0.4, 0.03, 58)), { lab: at(0.5, 0.03, 50), guard: null });
  // Toward yellow is not guarded.
  assert.equal(hueGuard(at(0.5, 0.03, 70), at(0.4, 0.03, 40)).guard, null);
  // A brown raw read pushed red: held at raw - 12, balanced L and C kept.
  const g = hueGuard(at(0.5, 0.03, 30), at(0.4, 0.02, 60));
  assert.equal(g.guard, 'raw');
  assert.ok(Math.abs(hueOf(g.lab) - 48) < 1e-6 && g.lab[0] === 0.5 && Math.abs(Math.hypot(g.lab[1], g.lab[2]) - 0.03) < 1e-9);
  // A grey raw read (no hue to keep) pushed to mauve: floored at 36 deg (Rubensstraat 102986: raw h197 C0.005, balanced h355).
  const f = hueGuard(at(0.45, 0.02, 355), at(0.3, 0.005, 197));
  assert.equal(f.guard, 'floor');
  assert.ok(Math.abs(hueOf(f.lab) - HUE_GUARD.floorH) < 1e-6);
  // A grey raw read pushed to a plausible brown stays.
  assert.equal(hueGuard(at(0.45, 0.02, 50), at(0.3, 0.005, 197)).guard, null);
});
