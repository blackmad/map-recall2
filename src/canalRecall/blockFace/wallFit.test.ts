import assert from 'node:assert/strict';
import test from 'node:test';
import {rgbToLab, type Rgb} from '../look/brickTone.ts';
import {combineWallFits, DARK_PAINT, fitWallColour, liftWithChroma, PALER_MIN_SHARE} from './wallFit.ts';

// Deterministic jitter (LCG), so a pixel population is a colour with texture, not one value.
const lcg = (seed: number) => () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
const pop = (c: Rgb, n: number, spread = 6, seed = 1): Rgb[] => { const r = lcg(seed); return Array.from({length: n}, () => c.map(v => Math.max(0, Math.min(255, Math.round(v + (r() - 0.5) * 2 * spread)))) as Rgb); };
const hueChroma = (lab: readonly number[]) => ({hue: (Math.atan2(lab[2], lab[1]) * 180 / Math.PI + 360) % 360, chroma: Math.hypot(lab[1], lab[2])});

test('painted black under a golden-hour cast is a neutral near-black, not olive, and never lifted (Nassaukade 149/147)', () => {
  // The 2024-11-21 strip read 147's paint as #615a47 (olive); add foliage and a pale sunlit course.
  const px = [...pop([97, 90, 71], 700, 8, 2), ...pop([70, 66, 50], 300, 6, 3), ...pop([96, 128, 46], 250, 8, 4), ...pop([200, 196, 160], 150, 8, 5)];
  const f = fitWallColour(px, {painted: true})!;
  assert.ok(f.neutralised);
  assert.equal(f.lab[1], 0); assert.equal(f.lab[2], 0);
  const [r, g, b] = [1, 3, 5].map(i => parseInt(f.hex.slice(i, i + 2), 16));
  assert.ok(r === g && g === b, `neutral hex ${f.hex}`);
  assert.ok(f.lab[0] <= DARK_PAINT.maxL, 'stays dark');
  assert.ok(f.lab[0] <= rgbToLab([97, 90, 71])[0] + 1, 'not lifted over the dominant paint');
  assert.ok(f.foliage > 0.1, 'foliage dropped');
  // The same pixels, not painted: the warm cast is kept (it is brick's hue then).
  assert.ok(!fitWallColour(px)!.neutralised);
});

test('red-brown brick keeps its chroma: joints and pale trim do not pull it to mauve (Nassaukade 148, the corner)', () => {
  const brick: Rgb = [128, 76, 58], joint: Rgb = [150, 140, 132], trim: Rgb = [214, 208, 196];
  const px = [...pop(brick, 470, 8, 6), ...pop(joint, 390, 6, 7), ...pop(trim, 140, 5, 8)];
  const f = fitWallColour(px)!;
  const want = hueChroma(rgbToLab(brick)), got = hueChroma(f.lab);
  assert.ok(Math.abs(got.hue - want.hue) < 12, `hue ${got.hue} vs brick ${want.hue}`);
  assert.ok(got.chroma >= want.chroma * 0.8, `chroma ${got.chroma} vs brick ${want.chroma}`);
  // The plain per-channel median is the mauve the ruling objected to: much less chroma.
  const med = [0, 1, 2].map(c => px.map(p => p[c]).sort((a, b) => a - b)[px.length >> 1]);
  assert.ok(hueChroma(rgbToLab(med)).chroma < got.chroma * 0.8);
});

test(`the dominant cluster wins; the paler one only at >= ${PALER_MIN_SHARE * 100} % of the wall (Nassaukade 145)`, () => {
  const dark: Rgb = [136, 84, 62], pale: Rgb = [214, 170, 132];
  const at = (paleN: number) => fitWallColour([...pop(dark, 1000 - paleN, 5, 9), ...pop(pale, paleN, 5, 10)])!;
  const f55 = at(550), f65 = at(650), f30 = at(300);
  assert.equal(f30.pick, 'dominant'); assert.ok(f30.lab[0] < 50);
  assert.equal(f55.pick, 'dominant', 'a 55 % paler cluster is not enough'); assert.ok(f55.lab[0] < 50);
  assert.equal(f65.pick, 'paler'); assert.ok(f65.lab[0] > 60);
});

test('chroma travels with a lift', () => {
  const lifted = liftWithChroma([30, 12, 16], 45);
  assert.equal(lifted[0], 45);
  assert.ok(Math.abs(Math.hypot(lifted[1], lifted[2]) / Math.hypot(12, 16) - 1.5) < 1e-9);
  assert.ok(Math.abs(Math.atan2(lifted[2], lifted[1]) - Math.atan2(16, 12)) < 1e-9);
  const f = fitWallColour(pop([90, 56, 44], 400, 4, 11), {liftL: 45})!;
  assert.ok(f.lab[0] >= 44.9);
  assert.ok(hueChroma(f.lab).chroma > hueChroma(rgbToLab([90, 56, 44])).chroma, 'lifted brick gains chroma with L*');
});

test('combineWallFits: one vote per capture, a dark painted wall stays neutral', () => {
  const painted = [fitWallColour(pop([70, 70, 60], 300, 4, 12), {painted: true})!, fitWallColour(pop([60, 58, 50], 300, 4, 13), {painted: true})!, fitWallColour(pop([120, 116, 100], 300, 4, 14), {painted: true})!];
  const c = combineWallFits(painted)!;
  assert.ok(c.neutral); assert.equal(c.lab[1], 0);
  const brick = [[136, 84, 62], [96, 66, 56], [190, 140, 112]].map((rgb, i) => fitWallColour(pop(rgb as Rgb, 300, 4, 20 + i))!);
  const b = combineWallFits(brick)!;
  assert.ok(!b.neutral);
  const Ls = brick.map(f => f.lab[0]).sort((x, y) => x - y);
  assert.ok(Math.abs(b.lab[0] - Ls[1]) < 1.5, 'median L*');
  assert.equal(combineWallFits([]), null);
});

test('too few pixels after the masks: null', () => {
  assert.equal(fitWallColour(pop([96, 128, 46], 500, 5, 30)), null);
});
