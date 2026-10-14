import {test} from 'node:test';
import assert from 'node:assert/strict';
import {measureFacade, rgbToLab, MASK, type FacadeImage, type Rgb} from './measureFacade.ts';

const PPM = 20;
/** A synthetic rectified crop: `widthM` x `heightM`, filled with `wall`, a deterministic +-6 noise. */
function canvas(widthM: number, heightM: number, wall: Rgb) {
  const width = Math.round(widthM * PPM), height = Math.round(heightM * PPM), rgb = new Uint8Array(width * height * 3), valid = new Uint8Array(width * height).fill(255);
  let seed = 7; const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648 - 0.5) * 12;
  for (let p = 0; p < width * height; p++) for (let c = 0; c < 3; c++) rgb[p * 3 + c] = Math.max(0, Math.min(255, wall[c] + rnd()));
  const fill = (u0: number, u1: number, v0: number, v1: number, col: Rgb) => {
    for (let y = Math.round((heightM - v1) * PPM); y < Math.round((heightM - v0) * PPM); y++) for (let x = Math.round(u0 * PPM); x < Math.round(u1 * PPM); x++) {
      if (x < 0 || y < 0 || x >= width || y >= height) continue; const p = y * width + x; rgb.set(col, p * 3);
    }
  };
  const image: FacadeImage = {width, height, rgb, valid, ppm: PPM, topM: heightM};
  return {image, fill, valid, width, height};
}
const BRICK: Rgb = [150, 82, 62], GLASS: Rgb = [52, 62, 72], TRIM: Rgb = [225, 225, 218];
const LINES = [0, 4, 7.2, 10.4, 13.6, 16.8];
const box = (w: number, top = 16.8) => ({u0: 0, u1: w, v0: 0, v1: top});
const near = (a: number, b: number, tol: number, what: string) => assert.ok(Math.abs(a - b) <= tol, `${what}: ${a} vs ${b}`);
const dE = (a: Rgb, b: Rgb) => { const x = rgbToLab(a), y = rgbToLab(b); return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]); };

/** Punched grid: windows `w` of a `pitch` bay, `h` of the storey, sill fraction `sill`, on every storey from the first. */
function punched(pitch: number, w: number, h: number, sill: number, opts: {cols?: number; glass?: Rgb; frames?: boolean} = {}) {
  const n = opts.cols ?? 10, c = canvas(pitch * n, 18.3, BRICK);
  for (let s = 1; s + 1 < LINES.length; s++) for (let b = 0; b < n; b++) {
    const lo = LINES[s], H = LINES[s + 1] - lo, u0 = b * pitch + pitch * (1 - w) / 2;
    if (opts.frames) c.fill(u0 - 0.15, u0 + pitch * w + 0.15, lo + sill * H - 0.15, lo + (sill + h) * H + 0.15, TRIM);
    c.fill(u0, u0 + pitch * w, lo + sill * H, lo + (sill + h) * H, opts.glass ?? GLASS);
  }
  return c;
}

test('punched grid: pitch, columns, window proportions, wall and glass colour', () => {
  const c = punched(3, 0.5, 0.55, 0.25);
  const m = measureFacade({image: c.image, box: box(30), lines: LINES});
  assert.equal(m.frontClass, 'punched');
  near(m.pitchM!, 3, 0.15, 'pitch'); assert.equal(m.columns, 10);
  near(m.window!.w, 0.5, 0.1, 'w'); near(m.window!.h, 0.55, 0.1, 'h'); near(m.window!.sill, 0.25, 0.1, 'sill');
  assert.equal(m.window!.shape, 'square');
  assert.ok(dE(m.wall.raw, BRICK) < 5, `wall ${m.wall.raw}`);
  assert.ok(dE(m.glass!.raw, GLASS) < 5, `glass ${m.glass!.raw}`);
  near(m.glazing, 0.5 * 0.55 * (12.8 / 14.3), 0.06, 'glazing');
  assert.equal(m.storeyGlazing[0], null, 'the ground storey is the ground band, never pooled');
  assert.ok(m.mask.includes(MASK.dark) && m.mask.includes(MASK.wall));
});

test('tall French windows with light frames: dark brick, columns counted, tall shape', () => {
  const DARK: Rgb = [92, 56, 50];
  const c = canvas(28, 18.3, DARK);
  for (let s = 1; s + 1 < LINES.length; s++) for (let b = 0; b < 13; b++) { const u0 = b * (28 / 13) + 0.55, lo = LINES[s]; c.fill(u0 - 0.08, u0 + 1.13, lo + 0.12, lo + 2.75, [180, 182, 178]); c.fill(u0, u0 + 1.05, lo + 0.2, lo + 2.65, [70, 80, 86]); }
  const m = measureFacade({image: c.image, box: box(28), lines: LINES});
  assert.equal(m.columns, 13);
  assert.equal(m.window!.shape, 'tall');
  assert.ok(dE(m.wall.raw, DARK) < 6, `wall ${m.wall.raw}`);
});

test('ribbon, curtain wall and glazed columns are told apart', () => {
  const r = canvas(30, 18.3, BRICK);
  for (let s = 1; s + 1 < LINES.length; s++) r.fill(0, 30, LINES[s] + 1, LINES[s] + 2.3, GLASS);
  assert.equal(measureFacade({image: r.image, box: box(30), lines: LINES}).frontClass, 'ribbon');

  const cw = canvas(30, 18.3, [150, 150, 150]);
  cw.fill(0, 30, 0, 16.8, GLASS);
  for (let u = 0; u < 30; u += 1.5) cw.fill(u, u + 0.1, 0, 16.8, [150, 150, 150]);
  for (let v = 0; v < 16.8; v += 3.2) cw.fill(0, 30, v, v + 0.1, [150, 150, 150]);
  assert.equal(measureFacade({image: cw.image, box: box(30), lines: LINES}).frontClass, 'curtain');

  const col = canvas(30, 18.3, BRICK);
  for (let b = 0; b < 10; b++) col.fill(b * 3 + 0.9, b * 3 + 2.1, 4, 16.8, GLASS);
  const m = measureFacade({image: col.image, box: box(30), lines: LINES});
  assert.equal(m.frontClass, 'columns', JSON.stringify(m.window));
  assert.equal(m.columns, 10);
});

test('exposure: a darker exposure normalises to nearly the same wall colour; raw stays raw', () => {
  const a = punched(3, 0.5, 0.55, 0.25, {frames: true}), b = punched(3, 0.5, 0.55, 0.25, {frames: true});
  for (let i = 0; i < b.image.rgb.length; i++) b.image.rgb[i] = Math.round(b.image.rgb[i] * 0.7);
  const ma = measureFacade({image: a.image, box: box(30), lines: LINES}), mb = measureFacade({image: b.image, box: box(30), lines: LINES});
  assert.ok(dE(mb.wall.raw, ma.wall.raw) > 10, 'raw colours differ');
  assert.ok(dE(mb.wall.normalised, ma.wall.normalised) < 4, `${mb.wall.normalised} vs ${ma.wall.normalised}`);
  assert.ok(mb.normalisation.gain > ma.normalisation.gain);
});

test('missing pixels and a tree blob: left out, grid still found', () => {
  const c = punched(3, 0.5, 0.55, 0.25);
  // a missing strip on the right (behind the camera) and a leaf-green blob over the lower left
  for (let y = 0; y < c.height; y++) for (let x = Math.round(26 * PPM); x < c.width; x++) c.valid[y * c.width + x] = 0;
  c.fill(1, 8, 0, 9, [70, 110, 50]);
  const m = measureFacade({image: c.image, box: box(30), lines: LINES});
  assert.ok(m.foliageFraction > 0.08 && m.foliageFraction < 0.2, `foliage ${m.foliageFraction}`);
  assert.ok(m.usableFraction < 0.9);
  near(m.pitchM!, 3, 0.2, 'pitch'); assert.equal(m.columns, 10);
  assert.ok(dE(m.wall.raw, BRICK) < 5);
});

// Houthavenkade 26 (pand 0363100012247232) g0: one 3DBAG plane, yellow-brown brick on the left ~55 %, dark brick on the right.
test('two bricks side by side on one plane: split along u measured; a one-brick front has none', () => {
  const DARK: Rgb = [70, 58, 56], c = punched(3, 0.5, 0.55, 0.25);
  // repaint the wall (not the glass) right of 18 m dark brick
  const {rgb, width, height} = {rgb: c.image.rgb, width: c.width, height: c.height};
  for (let y = 0; y < height; y++) for (let x = Math.round(18 * PPM); x < width; x++) { const p = y * width + x; if (Math.abs(rgb[p * 3] - BRICK[0]) < 10 && Math.abs(rgb[p * 3 + 1] - BRICK[1]) < 10) rgb.set(DARK, p * 3); }
  const m = measureFacade({image: c.image, box: box(30), lines: LINES});
  assert.ok(m.split, 'split found');
  near(m.split!.at, 0.6, 0.05, 'split at');
  // normalised colours (as palette.brick): the left is the lighter, redder brick
  const l = rgbToLab(hexRgb(m.split!.left)), r = rgbToLab(hexRgb(m.split!.right));
  assert.ok(l[0] > r[0] + 15 && l[1] > r[1] + 10, `${m.split!.left} | ${m.split!.right}`);
  assert.equal(measureFacade({image: punched(3, 0.5, 0.55, 0.25).image, box: box(30), lines: LINES}).split, null);
});
const hexRgb = (h: string): Rgb => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)) as Rgb;
