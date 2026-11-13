/**
 * The CPU twin of the record shader (F1 S5, #380; docs/plans/facade-f1-design-20261112.md §3.4): `facadePixel` is
 * look/facadeShader.ts `facadeRecordColour` line for line, on an unpacked record, so the Node preview (`house:preview
 * --shader-facades`), the pixel-effect gate and the tests see what the GPU draws. Keep the two in step: the GLSL-vs-twin
 * check (tests/e2e/facade-twin.spec.ts) renders the fixture records through the real program and compares.
 */
import { FACADE_WINDOW_PITCH_M, type FacadeRecord } from './facadeRecord.js';
import { FACADE_STYLES } from '../genericFacades.js';
import { GLASS_STOPS } from './windowSdf.js';
import { FACADE_PANES, FR_BAR, FR_CORNICE_M, FR_REVEAL_SHADE, FACADE_WALL_MEAN, FR_BRICK, FR_COURSE, FR_COURSING, FR_JOINT, FR_MORTAR, FR_PATTERN_MEAN, FR_TONE, FR_MOTTLE, FR_MOTTLE_FADE, FR_MOTTLE_U, FR_MOTTLE_V } from './facadeShader.js';

const clamp = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x));
const hexRgb = (h: string): [number, number, number] => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255) as [number, number, number];
const GLASS = GLASS_STOPS.map(hexRgb);
const rgb = (c: readonly number[]): [number, number, number] => [c[0] / 255, c[1] / 255, c[2] / 255];
const mix3 = (a: readonly number[], b: readonly number[], t: number): [number, number, number] => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

export function frPitch(style: number): number {
  for (let i = 0; i < FACADE_STYLES.length; i++) if (style < i + 0.5) return FACADE_WINDOW_PITCH_M[FACADE_STYLES[i]];
  return 2.0;
}
export const frCover = (x: number, a: number, b: number, fw: number) => clamp((Math.min(b, x + 0.5 * fw) - Math.max(a, x - 0.5 * fw)) / fw, 0, 1);
export function frOpening(p: [number, number], fw: [number, number], x0: number, x1: number, y0: number, y1: number, head: number, rise: number): number {
  const cx = frCover(p[0], x0, x1, fw[0]);
  if (head > 1.5 && head < 2.5) {
    const r = 0.5 * (x1 - x0), cy = y1 - r;
    const below = frCover(p[1], y0, cy, fw[1]);
    const d = Math.hypot(p[0] - (x0 + r), p[1] - cy) - r, fwr = Math.max(0.5 * (fw[0] + fw[1]), 1e-4);
    const above = p[1] > cy ? clamp(0.5 - d / fwr, 0, 1) : 0;
    return Math.max(cx * below, above * frCover(p[1], cy, y1, fw[1]));
  }
  let top = y1;
  if (head > 0.5 && head < 1.5) { const s = clamp((p[0] - x0) / Math.max(x1 - x0, 1e-4), 0, 1); top = y1 - rise + 4 * rise * s * (1 - s); }
  return cx * frCover(p[1], y0, top, fw[1]);
}
export const frGlass = (g: number) => (g < 0.55 ? mix3(GLASS[0], GLASS[1], g / 0.55) : mix3(GLASS[1], GLASS[2], (g - 0.55) / 0.45));

const smooth = (e0: number, e1: number, x: number) => { const t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };
const mod = (x: number, y: number) => x - y * Math.floor(x / y);
const fract = (x: number) => x - Math.floor(x);
export const frHash = (a: number, b: number) => fract(Math.sin(a * 12.9898 + b * 78.233) * 43758.5453);
export function frBrick(w: readonly [number, number], fw: readonly [number, number], material: number, contrast = 1): number {
  let amp = material < 0.5 ? FR_COURSING[0] : material > 1.5 && material < 2.5 ? FR_COURSING[2] : 0;
  if (amp <= 0) return 1;
  const prow = Math.floor(w[1] / FR_MOTTLE_V), pcol = Math.floor((w[0] + mod(prow, 2) * 0.5 * FR_MOTTLE_U) / FR_MOTTLE_U);
  const brickPatch = 1 + amp * contrast * FR_MOTTLE * (frHash(prow * 7 + 3, pcol * 3 + 11) - 0.5) * (1 - smooth(FR_MOTTLE_FADE[0] * FR_MOTTLE_V, FR_MOTTLE_FADE[1] * FR_MOTTLE_V, Math.max(fw[0], fw[1])));
  amp *= contrast * (1 - smooth(0.25 * FR_COURSE, 0.6 * FR_COURSE, Math.max(fw[0], fw[1])));
  if (amp <= 0) return brickPatch;
  const row = Math.floor(w[1] / FR_COURSE), yy = w[1] - row * FR_COURSE;
  const x = w[0] + mod(row, 2) * 0.5 * FR_BRICK, col = Math.floor(x / FR_BRICK), xx = x - col * FR_BRICK;
  const joint = Math.max(1 - frCover(yy, FR_JOINT, FR_COURSE, fw[1]), 1 - frCover(xx, FR_JOINT, FR_BRICK, fw[0]));
  const tone = 1 + (frHash(row, col) - 0.5) * FR_TONE;
  return brickPatch * (1 + amp * ((tone + (FR_MORTAR - tone) * joint) / FR_PATTERN_MEAN - 1));
}
export function frSpek(r: FacadeRecord, y: number, fw: readonly [number, number]): number {
  const s = r.spekSpacing, n = r.spekCourses;
  if (s < 0.5 || n < 0.5) return 0;
  const per = (s + n) * FR_COURSE, h = n * FR_COURSE, t = smooth(0.5 * per, per, fw[1]);
  return frCover(mod(y, per), 0, h, fw[1]) * (1 - t) + (h / per) * t;
}
export function frBandLines(r: FacadeRecord, sv: number, sh: number, y0: number, y1: number, storey: number, fw: readonly [number, number]): number {
  const b = r.bands;
  if (b < 0.5 || (b > 4.5 && b < 5.5)) return 0;
  const l = r.bandLines;
  const floorLine = l < 0.5 && (b < 1.5 || (b > 2.5 && b < 4.5) || b > 5.5);
  const sill = l > 0.5 && mod(l, 2) > 0.5;
  const transom = l > 0.5 && mod(Math.floor(l / 2), 2) > 0.5;
  const head = l > 0.5 ? l > 3.5 : b > 1.5 && b < 4.5;
  const hs = r.bandSillCm * 0.01, hh = r.bandHeadCm * 0.01;
  let c = 0;
  if (sill && storey > 0.5) c = Math.max(c, frCover(sv, y0 - hs, y0, fw[1]));
  if (floorLine && storey > 0.5) c = Math.max(c, frCover(sv, 0, hs, fw[1]));
  if (head) c = Math.max(c, frCover(sv, y1, y1 + hh, fw[1]));
  if (transom) { const t = y0 + (y1 - y0) * r.bandTransomAt / 255; c = Math.max(c, frCover(sv, t - 0.04, t + 0.04, fw[1])); }
  return c;
}
export function frSurround(r: FacadeRecord, p: [number, number], fw: [number, number], x0: number, x1: number, y0: number, y1: number, head: number, rise: number): number {
  const s = r.surround;
  let c = 0;
  if (s > 0.5 && s < 1.5) c = Math.max(c, frCover(p[0], x0 - 0.08, x1 + 0.08, fw[0]) * frCover(p[1], y1, y1 + 0.16, fw[1]));
  if ((s > 1.5 && s < 2.5) || s > 4.5) c = Math.max(c, frOpening(p, fw, x0 - 0.09, x1 + 0.09, y0 - 0.09, y1 + 0.09, head, rise) - frOpening(p, fw, x0, x1, y0, y1, head, rise));
  if (r.sills > 0.5 || (s > 3.5 && s < 4.5)) c = Math.max(c, frCover(p[0], x0 - 0.06, x1 + 0.06, fw[0]) * frCover(p[1], y0 - 0.08, y0, fw[1]));
  if (r.keystone > 0.5 || (s > 2.5 && s < 3.5) || s > 4.5) { const xc = 0.5 * (x0 + x1); c = Math.max(c, frCover(p[0], xc - 0.09, xc + 0.09, fw[0]) * frCover(p[1], y1 - 0.02, y1 + 0.2, fw[1])); }
  return c;
}
export function frBars(x: number, a: number, b: number, n: number, fw: number): number {
  if (n < 1.5) return 0;
  const part = (b - a) / n, t = (x - a) / part, d = Math.abs(t - Math.floor(t + 0.5)) * part;
  if (t < 0.5 || t > n - 0.5) return 0;
  const c = clamp(0.5 + (FR_BAR / 2 - d) / fw, 0, 1), k = smooth(0.5 * part, part, fw);
  return c * (1 - k) + (FR_BAR / part) * k;
}
export function frGlazing(p: [number, number], fw: [number, number], x0: number, x1: number, y0: number, y1: number, kind: number): number {
  const g = FACADE_PANES[Math.round(clamp(kind, 0, FACADE_PANES.length - 1))], top = g[4];
  const split = top > 0 ? y1 - (y1 - y0) * top : y1;
  let c = p[1] < split ? Math.max(frBars(p[0], x0, x1, g[0], fw[0]), frBars(p[1], y0, split, g[1], fw[1])) : Math.max(frBars(p[0], x0, x1, g[2], fw[0]), frBars(p[1], split, y1, g[3], fw[1]));
  if (top > 0) c = Math.max(c, frCover(p[1], split - FR_BAR / 2, split + FR_BAR / 2, fw[1]));
  return c;
}
export const frReveal = (p: [number, number], fw: [number, number], x0: number, y1: number, depth: number) => Math.max(frCover(p[0], x0, x0 + depth, fw[0]), frCover(p[1], y1 - depth, y1, fw[1])) * FR_REVEAL_SHADE;
export function frCornice(r: FacadeRecord, y: number, fw: readonly [number, number]): number {
  const h = FR_CORNICE_M[Math.round(r.cornice)] ?? 0;
  if (h <= 0) return 0;
  const top = r.wallHcm * 0.01;
  return frCover(y, top - h, top, fw[1]);
}
export function frQuoin(w: readonly [number, number], len: number, fw: readonly [number, number]): number {
  const k = Math.floor(w[1] / 0.25), d = mod(k, 2) < 0.5 ? 0.45 : 0.3;
  const joint = frCover(w[1] - k * 0.25, 0.015, 0.25, fw[1]);
  return Math.max(frCover(w[0], 0, d, fw[0]), frCover(w[0], len - d, len, fw[0])) * joint;
}

/** One fragment: `wall` = (u, v, run length) in metres, `kind` the wall kind (bit 8 mirrored), `fw` the pixel's metres. */
export function facadePixel(r: FacadeRecord, wall: readonly [number, number, number], kindIn: number, fw: readonly [number, number], knobs: readonly number[] = [1, 1, 1, 0]): { rgb: [number, number, number]; m: [number, number] } {
  const w: [number, number] = [wall[0], wall[1]];
  const f: [number, number] = [Math.max(fw[0], 1e-4), Math.max(fw[1], 1e-4)];
  const kind = kindIn - 8 * (kindIn >= 7.5 ? 1 : 0), front = kind < 0.5;
  if (kind > 6.5) return { rgb: rgb(r.roof), m: [0, 0] };
  const tone = FACADE_WALL_MEAN * frBrick(w, f, r.wallMaterial, knobs[0]);
  let wallC = rgb(r.wall).map(x => x * tone) as [number, number, number];
  const spek = frSpek(r, w[1], f), bandC = rgb(r.band);
  wallC = mix3(wallC, bandC, spek);
  let mr = 1 - spek;
  if ((kind > 2.5 && kind < 5.5) || kind > 5.5) return { rgb: wallC, m: [mr, 0] };
  const plinth = r.plinthDm * 0.1, groundH = Math.max(r.groundDm * 0.1, 0.5), upperH = Math.max(r.upperDm * 0.1, 0.5);
  const atticH = r.atticDm * 0.1, storeys = Math.max(r.storeys, 1);
  const v = w[1] - plinth;
  if (v < 0 || w[1] > r.wallHcm * 0.01) return { rgb: wallC, m: [mr, 0] };
  const corn = front ? frCornice(r, w[1], f) : 0;
  if (corn > 0) { wallC = mix3(wallC, rgb(r.accent), corn); mr *= 1 - corn; if (corn > 0.999) return { rgb: wallC, m: [mr, 0] }; }
  let storey: number, sv: number, sh: number;
  if (v < groundH) { storey = 0; sh = groundH; sv = v; }
  else {
    const u = (v - groundH) / upperH; storey = 1 + Math.floor(u); sh = upperH; sv = (u - Math.floor(u)) * upperH;
    if (atticH > 0 && storey >= storeys - 1) { storey = storeys - 1; sh = atticH; sv = v - groundH - (storeys - 2) * upperH; }
  }
  if (storey > storeys - 0.5) return { rgb: wallC, m: [mr, 0] };
  const len = Math.max(wall[2], 1e-3), pitch = frPitch(r.style);
  let bays = front ? (storey < 0.5 ? r.baysGround : (atticH > 0 && storey > storeys - 1.5 && r.baysAttic > 0 ? r.baysAttic : r.baysUpper)) : 0;
  if (bays < 0.5) bays = Math.max(1, Math.floor(len / pitch + 0.5));
  const bw = len / bays, bay = Math.floor(w[0] / bw), bx = w[0] - bay * bw;
  const accentC = rgb(r.accent);
  if (front && r.quoins > 0.5) { const q = frQuoin(w, len, f); wallC = mix3(wallC, accentC, q); mr *= 1 - q; }
  const doorBay = r.doorBay, door = doorBay > 253.5 && doorBay < 254.5 ? Math.floor((bays - 1) * 0.5) : doorBay;
  const p: [number, number] = [bx, sv];
  const gk = r.groundKind;
  if (front && storey < 0.5 && (Math.abs(gk - 1) < 0.5 || Math.abs(gk - 6) < 0.5) && !(Math.abs(bay - door) < 0.5 && doorBay < 254.5)) {
    const riser = r.stallriserOn > 0.5 || gk < 1.5 ? r.stallriserDm * 0.1 : 0, fascia = r.fasciaOn > 0.5 || gk < 1.5 ? Math.max(r.fasciaHeightDm * 0.1, 0.3) : 0;
    const top = sh - fascia;
    const fasc = frCover(sv, top, sh, f[1]), glass = frOpening(p, f, 0.08, bw - 0.08, riser, top - 0.08, 0, 0), rs = frCover(sv, 0, riser, f[1]);
    let c = mix3(wallC, rgb(r.shopPaint), Math.max(fasc, rs));
    c = mix3(c, rgb(r.fascia), fasc);
    c = mix3(c, frGlass(clamp((top - sv) / Math.max(top - riser, 0.1), 0, 1)), glass);
    return { rgb: c, m: [mr * (1 - Math.max(glass, Math.max(fasc, rs))), 0] };
  }
  const share = r.windowShare / 255, winH = r.windowHeightQ / 255;
  const frame = rgb(r.frame);
  if (front && storey < 0.5 && Math.abs(bay - door) < 0.5 && doorBay < 254.5) {
    const dw = Math.min(1.2, bw * 0.7), x0 = 0.5 * (bw - dw), dh = Math.min(sh * 0.85, 2.6);
    const o = frOpening(p, f, x0, x0 + dw, 0, dh, 0, 0), leaf = frOpening(p, f, x0 + 0.06, x0 + dw - 0.06, 0, dh - 0.06, 0, 0);
    return { rgb: mix3(mix3(wallC, frame, o), rgb(r.door), leaf), m: [mr * (1 - o), 0] };
  }
  const ww = clamp(share, 0.15, 0.9) * bw, wh = clamp(winH, 0.2, 0.92) * sh;
  const x0 = 0.5 * (bw - ww), y0 = Math.max(0.25, (sh - wh) * 0.55);
  let y1 = Math.min(sh - 0.1, y0 + wh);
  const head = r.windowHead, rise = head > 0.5 && head < 1.5 ? Math.min(0.1 * ww, 0.15) : 0;
  if (head > 1.5 && head < 2.5) y1 = Math.max(y1, y0 + 0.5 * ww + 0.2);
  const hd = head > 2.5 ? 0 : head;
  const bnd = frBandLines(r, sv, sh, y0, y1, storey, f);
  const acc = Math.max(bnd, frSurround(r, p, f, x0, x0 + ww, y0, y1, hd, rise));
  wallC = mix3(wallC, bnd > 0 ? bandC : accentC, acc); mr *= 1 - acc;
  const outer = frOpening(p, f, x0, x0 + ww, y0, y1, hd, rise);
  if (outer <= 0) return { rgb: wallC, m: [mr, 0] };
  const fr = Math.min(0.07, 0.12 * ww);
  const pane = frOpening(p, f, x0 + fr, x0 + ww - fr, y0 + fr, y1 - fr, hd, rise);
  const g = clamp((y1 - p[1]) / Math.max(y1 - y0, 1e-3), 0, 1);
  const shade = 1 - frReveal(p, f, x0 + fr, y1 - fr, r.windowRevealCm * 0.01 * (knobs[1] ?? 1));
  const glassC = mix3(frGlass(g).map(x => x * shade), frame, frGlazing(p, f, x0 + fr, x0 + ww - fr, y0 + fr, y1 - fr, r.windowKind));
  return { rgb: mix3(mix3(wallC, frame, outer), glassC, pane), m: [mr * (1 - outer), 0] };
}
