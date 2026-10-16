import {test} from 'node:test';
import assert from 'node:assert/strict';
import {measureFacade, rgbToLab, isOpeningCell, MASK, type FacadeImage, type Rgb} from './measureFacade.ts';
import {classifyOpenings, OMASK} from './facadeOpenings.ts';
import {wallFamily} from '../facade/materials.ts';

// Synthetic rectified crops at the archive's 50 px/m, so brick courses (3 px: 2 px face + 1 px joint, a head joint every
// 12 px, half-bond) are at the resolution the texture test reads.
const PPM = 50;
const LINES = [0, 4, 7.2, 10.4, 13.6, 16.8];
const dE = (a: Rgb, b: Rgb) => { const x = rgbToLab(a), y = rgbToLab(b); return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]); };
const hexRgb = (h: string): Rgb => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)) as Rgb;

function canvas(widthM: number, heightM: number) {
  const width = Math.round(widthM * PPM), height = Math.round(heightM * PPM), rgb = new Uint8Array(width * height * 3);
  let seed = 11; const rnd = (a: number) => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648 - 0.5) * a;
  const px = (x: number, y: number, c: Rgb, noise = 6) => { const p = (y * width + x) * 3; for (let ch = 0; ch < 3; ch++) rgb[p + ch] = Math.max(0, Math.min(255, Math.round(c[ch] + rnd(noise)))); };
  const rect = (u0: number, u1: number, v0: number, v1: number, f: (x: number, y: number) => void) => {
    for (let y = Math.max(0, Math.round((heightM - v1) * PPM)); y < Math.min(height, Math.round((heightM - v0) * PPM)); y++)
      for (let x = Math.max(0, Math.round(u0 * PPM)); x < Math.min(width, Math.round(u1 * PPM)); x++) f(x, y);
  };
  const fill = (u0: number, u1: number, v0: number, v1: number, c: Rgb, noise = 6) => rect(u0, u1, v0, v1, (x, y) => px(x, y, c, noise));
  /** brick in courses: face colour, joint colour */
  const brick = (u0: number, u1: number, v0: number, v1: number, face: Rgb, joint: Rgb) => rect(u0, u1, v0, v1, (x, y) => {
    const course = Math.floor(y / 3), joints = y % 3 === 2 || (x + (course % 2) * 6) % 12 === 0;
    px(x, y, joints ? joint : face, 8);
  });
  const image: FacadeImage = {width, height, rgb, ppm: PPM, topM: heightM};
  return {image, fill, brick};
}
const box = (w: number, top = 16.8) => ({u0: 0, u1: w, v0: 0, v1: top});

test('glazing is the opening area: white frames and bars, and a lower sash of dark panes in the wall\'s own colour, count as window (within 0.05)', () => {
  // Waagdragerhof 198 walls[2]: dark panes that the colour clusters put with the brick, between white frames and bars
  const BRICK: Rgb = [92, 60, 54], JOINT: Rgb = [70, 62, 60], WHITE: Rgb = [226, 228, 224], SKY: Rgb = [160, 176, 188], DARK: Rgb = [90, 63, 58];
  const c = canvas(30, 18.3), w = 1.4, h = 2.2, sill = 0.6;
  c.brick(0, 30, 0, 18.3, BRICK, JOINT);
  let open = 0;
  for (let s = 1; s + 1 < LINES.length; s++) for (let b = 0; b < 10; b++) {
    const u0 = b * 3 + 0.8, v0 = LINES[s] + sill;
    c.fill(u0, u0 + w, v0, v0 + h, WHITE); // frame
    c.fill(u0 + 0.08, u0 + w - 0.08, v0 + 1.08, v0 + h - 0.08, SKY); // upper sash: sky-lit glass
    c.brick(u0 + 0.08, u0 + w - 0.08, v0 + 0.08, v0 + 1.0, DARK, JOINT); // lower sash: dark panes mirroring the brick across the street
    c.fill(u0 + w / 2 - 0.03, u0 + w / 2 + 0.03, v0, v0 + h, WHITE); // glazing bar
    open += w * h;
  }
  const upper = 30 * (16.8 - 2.5), truth = open / upper;
  const m = measureFacade({image: c.image, box: box(30), lines: LINES});
  assert.ok(Math.abs(m.glazing - truth) <= 0.05, `glazing ${m.glazing} vs ${truth.toFixed(3)}`);
  // the colour clusters alone leave the wall-coloured panels out (what the opening pass fixes)
  const before = (() => { let n = 0, o = 0; for (let k = 0; k < m.mask.length; k++) { const v = m.box.v1 - (Math.floor(k / m.cols) + 0.5) * m.cell; if (v < 2.5 || m.clusterMask![k] === MASK.unusable) continue; n++; if (m.clusterMask![k] !== MASK.wall) o++; } return o / n; })();
  assert.ok(truth - before > 0.06, `cluster mask glazing ${before.toFixed(3)} should undercount ${truth.toFixed(3)}`);
  assert.equal(m.openings!.abstain, null);
  assert.ok(m.mask.includes(MASK.frame), 'frames and bars are opening cells');
  assert.equal(m.columns, 10);
});

test('dark neutral brick with white surrounds reads as brick by its courses (the colour alone says paint)', () => {
  const FACE: Rgb = [66, 60, 64], JOINT: Rgb = [40, 38, 40], WHITE: Rgb = [228, 228, 222], GLASS: Rgb = [36, 44, 50];
  assert.equal(wallFamily(FACE), 'paint', 'the colour family alone calls this paint');
  const c = canvas(30, 18.3);
  c.brick(0, 30, 0, 18.3, FACE, JOINT);
  for (let s = 1; s + 1 < LINES.length; s++) for (let b = 0; b < 10; b++) {
    const u0 = b * 3 + 0.8, v0 = LINES[s] + 0.8;
    c.fill(u0 - 0.3, u0 + 1.7, v0 - 0.3, v0 + 2.0, WHITE); // stone surround, 0.3 m
    c.fill(u0, u0 + 1.4, v0, v0 + 1.7, GLASS);
  }
  const m = measureFacade({image: c.image, box: box(30), lines: LINES});
  assert.equal(m.material?.family, 'brick', JSON.stringify(m.material));
  assert.equal(m.material?.basis, 'courses');
  // the wall colour is the brick faces', not pulled toward the white surrounds or the joints
  assert.ok(dE(m.wall.raw, FACE) < 6, `wall ${m.wall.raw} vs face ${FACE}`);
  // the 0.3 m surrounds are trim, not glazing: glazing is the glass plus at most its one-cell blurred edge (0.07), far
  // from the glass-and-surround area (0.42) that the opening pass alone would count
  const glass = (40 * 1.4 * 1.7) / (30 * 14.3);
  assert.ok(m.glazing >= glass - 0.03 && m.glazing <= glass + 0.07, `glazing ${m.glazing} vs glass ${glass.toFixed(3)}`);
  assert.ok(m.openings!.surrounds >= 30, `surrounds ${m.openings!.surrounds}`);
});

test('a smooth dark wall stays paint; a pale render is paint by colour', () => {
  const c = canvas(30, 18.3);
  c.fill(0, 30, 0, 18.3, [52, 52, 54], 2);
  for (let s = 1; s + 1 < LINES.length; s++) for (let b = 0; b < 10; b++) c.fill(b * 3 + 0.8, b * 3 + 2.2, LINES[s] + 0.8, LINES[s] + 2.5, [200, 210, 220], 2);
  const m = measureFacade({image: c.image, box: box(30), lines: LINES});
  assert.equal(m.material?.family, 'paint', JSON.stringify(m.material));
});

test('spandrel-and-column front: per-band materials, not one averaged colour', () => {
  const BRICK: Rgb = [140, 70, 52], JOINT: Rgb = [170, 160, 150], CONCRETE: Rgb = [196, 194, 188], GLASS: Rgb = [44, 54, 62];
  const c = canvas(30, 18.3);
  c.brick(0, 30, 0, 18.3, BRICK, JOINT);
  // storeys 1 and 2: concrete columns 0.6 m on a 3 m pitch, brick spandrels 1.2 m, glass between the columns above
  for (let s = 1; s <= 2; s++) for (let b = 0; b < 10; b++) {
    const u = b * 3, lo = LINES[s], hi = LINES[s + 1];
    c.fill(u, u + 0.6, lo, hi, CONCRETE, 3);
    c.fill(u + 0.6, u + 3, lo + 1.2, hi, GLASS);
  }
  // storeys 3 and 4: punched windows in the brick
  for (let s = 3; s <= 4; s++) for (let b = 0; b < 10; b++) c.fill(b * 3 + 0.9, b * 3 + 2.1, LINES[s] + 0.9, LINES[s] + 2.5, GLASS);
  const m = measureFacade({image: c.image, box: box(30), lines: LINES}), bands = m.bands!;
  // colours are compared normalised and as cell means (the joints are in them): by family and lightness, not by hex
  const L = (h: string) => rgbToLab(hexRgb(h))[0];
  for (const s of [1, 2]) {
    const b = bands[s]!;
    assert.ok(b?.second, `band ${s} reports a runner-up material: ${JSON.stringify(b)}`);
    const [dark, light] = [b.hex, b.second!.hex].sort((x, y) => L(x) - L(y)), fam = b.hex === dark ? b.family : b.second!.family;
    assert.equal(fam, 'brick', `band ${s} spandrels are brick: ${JSON.stringify(b)}`);
    assert.ok(L(light) - L(dark) > 15 && rgbToLab(hexRgb(light))[1] < 4, `band ${s} columns are light neutral concrete: ${JSON.stringify(b)}`);
    assert.ok(b.share + b.second!.share > 0.9, `band ${s}: the two materials are the band: ${JSON.stringify(b)}`);
  }
  for (const s of [3, 4]) {
    const b = bands[s]!;
    assert.ok(b.family === 'brick' && b.second === null, `band ${s} is one brick: ${JSON.stringify(b)}`);
  }
  // one averaged colour would have been neither
  assert.ok(Math.abs(L(bands[1]!.hex) - L(bands[3]!.hex)) < 3 || Math.abs(L(bands[1]!.second!.hex) - L(bands[3]!.hex)) < 3, 'the spandrel brick is the punched storeys\' brick');
  // the column faces are not glazing
  near(m.storeyGlazing[1]!, (10 * 2.4 * 2.0) / (30 * 3.2), 0.07, 'storey 1 glazing');
});

const near = (a: number, b: number, tol: number, what: string) => assert.ok(Math.abs(a - b) <= tol, `${what}: ${a} vs ${b.toFixed(3)}`);

test('classifyOpenings: a string course is trim, a ribbon frame rail along its glass is ambiguous and can abstain', () => {
  // 40 x 30 cells (0.1 m): wall label 0; a light band label 1 (3 rows, full width); a window label 2 under it
  const cols = 40, rows = 30, N = cols * rows, mask = new Uint8Array(N).fill(OMASK.wall), label = new Int8Array(N).fill(0);
  const set = (x0: number, x1: number, y0: number, y1: number, m: number, l: number) => { for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { mask[y * cols + x] = m; label[y * cols + x] = l; } };
  set(0, 40, 5, 8, OMASK.trim, 1); // string course across the front
  set(5, 15, 12, 25, OMASK.dark, 2); set(25, 35, 12, 25, OMASK.dark, 2); // two windows
  const r = classifyOpenings({mask, label, wallSet: [true, false, false], cols, rows, cell: 0.1});
  assert.equal(r.mask[6 * cols + 20], OMASK.trim, 'string course stays trim');
  assert.ok(isOpeningCell(r.mask[18 * cols + 10]), 'window is an opening');
  assert.equal(r.abstain, null);
  // a ribbon: a light full-width rail directly on a full-width glass band: frame or band? ambiguous; glazing range reported
  // (8 m wide: wider than a punched window's hull)
  const C2 = 80, N2 = C2 * rows, m2 = new Uint8Array(N2).fill(OMASK.wall), l2 = new Int8Array(N2).fill(0);
  for (let y = 10; y < 12; y++) for (let x = 0; x < C2; x++) { m2[y * C2 + x] = OMASK.trim; l2[y * C2 + x] = 1; } // light rail
  for (let y = 12; y < 20; y++) for (let x = 0; x < C2; x++) { m2[y * C2 + x] = OMASK.dark; l2[y * C2 + x] = 2; } // glass band
  const r2 = classifyOpenings({mask: m2, label: l2, wallSet: [true, false, false], cols: C2, rows, cell: 0.1});
  assert.ok(r2.ambiguous > 0 && r2.range[1] > r2.range[0], JSON.stringify(r2.range));
});
