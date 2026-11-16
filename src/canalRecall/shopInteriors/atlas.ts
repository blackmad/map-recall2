// The shop-interior atlas (lane shop-interiors-20261116): one 256 px cell per room kind (rooms.ts ROOM_KINDS), painted
// procedurally into plain RGBA bytes, so the browser, the worker and Node draw the same bytes (no canvas, no fonts, no
// photos). Deterministic: a room's PRNG is seeded by its name.
//
// A cell holds the room's five faces as the shader samples them (shader.ts):
//   BACK   256 x 112  the back wall, ROOM_W m wide (it repeats along a wider window) by the room's height
//   MID    256 x  80  one plane of furniture with alpha (counter, racks, tables), ROOM_W m wide by MID_H m from the floor
//   SIDE   128 x  64  the left wall, glass to back wall by the room's height (the right wall is its mirror)
//   FLOOR   64 x  64  a FLOOR_TILE m square tile
//   CEIL    64 x  64  a CEIL_TILE m square tile with its lamp
// Image rows run top-down (row 0 is the top of a face); the shader samples with the same convention.

import { ROOM_KINDS, type RoomKind } from './rooms.js';

export const CELL = 256, COLS = 4, ROWS = Math.ceil(ROOM_KINDS.length / COLS);
export const ATLAS_W = CELL * COLS, ATLAS_H = CELL * ROWS;
/** Face rects in a cell: [x, y, w, h] px. */
export const FACE = {
  back: [0, 0, 256, 112], mid: [0, 112, 256, 80], side: [0, 192, 128, 64], floor: [128, 192, 64, 64], ceil: [192, 192, 64, 64],
} as const;
/** Metres the faces span: the back and mid planes' width, the mid plane's height, the floor and ceiling tiles. */
export const ROOM_W = 4, MID_H = 2.4, FLOOR_TILE = 1, CEIL_TILE = 2;
/** The room's height below the glass's bottom and above its head (m): the floor at the stall riser's foot, the ceiling
 *  over the transom. The shader's box is [-FLOOR_DROP, glassH + CEIL_RISE]. */
export const FLOOR_DROP = 0.5, CEIL_RISE = 0.7;
/** The height the back and side faces are painted for (m): a typical 1.9 m glass plus drop and rise. */
export const PAINT_H = 1.9 + FLOOR_DROP + CEIL_RISE;

type RGB = readonly [number, number, number];
const rgb = (hex: string): RGB => { const n = parseInt(hex.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const mix = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const shade = (a: RGB, k: number): RGB => [a[0] * k, a[1] * k, a[2] * k];

function prng(seed: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) { h ^= seed.charCodeAt(i); h = Math.imul(h, 16777619); }
  let s = h >>> 0;
  return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/** One face of a cell, addressed in metres: x from the face's left, y up from its bottom. */
class Face {
  constructor(readonly img: Uint8ClampedArray, readonly x0: number, readonly y0: number, readonly w: number, readonly h: number,
    readonly mW: number, readonly mH: number, readonly wrap: boolean) {}
  px(x: number, y: number, c: RGB, a = 1): void {
    if (this.wrap) x = ((x % this.w) + this.w) % this.w;
    if (x < 0 || x >= this.w || y < 0 || y >= this.h) return;
    const i = ((this.y0 + this.h - 1 - y) * ATLAS_W + this.x0 + x) * 4, d = this.img;
    if (a >= 1) { d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = 255; return; }
    const da = d[i + 3] / 255, oa = a + da * (1 - a);
    for (let k = 0; k < 3; k++) d[i + k] = oa > 0 ? (c[k] * a + d[i + k] * da * (1 - a)) / oa : 0;
    d[i + 3] = oa * 255;
  }
  /** A rectangle in metres (x, y bottom-left), wrapping across a repeating face. */
  rect(x: number, y: number, w: number, h: number, c: RGB, a = 1): void {
    const sx = this.w / this.mW, sy = this.h / this.mH;
    const X0 = Math.round(x * sx), X1 = Math.round((x + w) * sx), Y0 = Math.round(y * sy), Y1 = Math.round((y + h) * sy);
    for (let Y = Y0; Y < Math.max(Y1, Y0 + 1); Y++) for (let X = X0; X < Math.max(X1, X0 + 1); X++) this.px(X, Y, c, a);
  }
  /** A filled disc in metres. */
  disc(cx: number, cy: number, r: number, c: RGB, a = 1): void {
    const sx = this.w / this.mW, sy = this.h / this.mH;
    for (let Y = Math.floor((cy - r) * sy); Y <= Math.ceil((cy + r) * sy); Y++) for (let X = Math.floor((cx - r) * sx); X <= Math.ceil((cx + r) * sx); X++) {
      const dx = X / sx - cx, dy = Y / sy - cy;
      if (dx * dx + dy * dy <= r * r) this.px(X, Y, c, a);
    }
  }
  /** A ring (wheel) in metres. */
  ring(cx: number, cy: number, r: number, t: number, c: RGB): void {
    const sx = this.w / this.mW, sy = this.h / this.mH;
    for (let Y = Math.floor((cy - r) * sy); Y <= Math.ceil((cy + r) * sy); Y++) for (let X = Math.floor((cx - r) * sx); X <= Math.ceil((cx + r) * sx); X++) {
      const d = Math.hypot(X / sx - cx, Y / sy - cy);
      if (d <= r && d >= r - t) this.px(X, Y, c);
    }
  }
  /** A line in metres, `t` m thick. */
  line(x0: number, y0: number, x1: number, y1: number, t: number, c: RGB): void {
    const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) / (this.mW / this.w) * 2) + 1;
    for (let k = 0; k <= n; k++) { const s = k / n; this.rect(x0 + (x1 - x0) * s - t / 2, y0 + (y1 - y0) * s - t / 2, t, t, c); }
  }
  fill(c: RGB): void { this.rect(0, 0, this.mW, this.mH, c); }
  /** A vertical gradient from `bottom` to `top` over the whole face. */
  vgrad(bottom: RGB, top: RGB): void { for (let Y = 0; Y < this.h; Y++) for (let X = 0; X < this.w; X++) this.px(X, Y, mix(bottom, top, Y / (this.h - 1))); }
  /** Fine grain, so flat paint does not read as a vector fill. */
  grain(rand: () => number, k: number): void {
    for (let Y = 0; Y < this.h; Y++) for (let X = 0; X < this.w; X++) {
      const i = ((this.y0 + this.h - 1 - Y) * ATLAS_W + this.x0 + X) * 4, d = this.img, g = 1 + (rand() - 0.5) * k;
      if (d[i + 3] === 0) continue;
      for (let c = 0; c < 3; c++) d[i + c] = d[i + c] * g;
    }
  }
}

type Faces = { back: Face; mid: Face; side: Face; floor: Face; ceil: Face; r: () => number };

/** Rows of small goods on shelves over [x0, x0 + w] (metres), shelves at `levels`. */
function shelves(f: Face, r: () => number, x0: number, w: number, levels: number[], board: RGB, palette: RGB[], itemW = 0.08, itemH = 0.22, fill = 0.85): void {
  for (const y of levels) {
    f.rect(x0, y - 0.03, w, 0.03, board);
    for (let x = x0 + 0.02; x < x0 + w - itemW; x += itemW * (1.05 + r() * 0.3)) {
      if (r() > fill) continue;
      const c = palette[Math.floor(r() * palette.length)], h = itemH * (0.7 + r() * 0.3);
      f.rect(x, y, itemW * 0.9, h, c);
      f.rect(x, y + h - 0.02, itemW * 0.9, 0.02, shade(c, 1.25));
    }
  }
}
const floorTiles = (f: Face, a: RGB, b: RGB, n: number) => { const s = FLOOR_TILE / n; for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) f.rect(i * s, j * s, s, s, (i + j) % 2 ? a : b); };
const floorGrid = (f: Face, a: RGB, joint: RGB, n: number) => { f.fill(a); const s = FLOOR_TILE / n; for (let i = 0; i < n; i++) { f.rect(i * s, 0, 0.012, FLOOR_TILE, joint); f.rect(0, i * s, FLOOR_TILE, 0.012, joint); } };
const planks = (f: Face, a: RGB, r: () => number) => { for (let i = 0; i < 6; i++) f.rect(i / 6, 0, 1 / 6, 1, shade(a, 0.85 + r() * 0.3)); for (let i = 0; i < 6; i++) f.rect(i / 6, 0, 0.01, 1, shade(a, 0.6)); };
/** A ceiling tile: plain, with a lamp at its centre (a disc of light with a soft halo). */
const ceiling = (f: Face, c: RGB, lamp: RGB, kind: 'disc' | 'strip' | 'spots') => {
  f.fill(c);
  if (kind === 'strip') { f.rect(0.2, 0.92, 1.6, 0.16, lamp); f.rect(0.1, 0.8, 1.8, 0.4, lamp, 0.25); }
  else if (kind === 'spots') for (const [x, y] of [[0.5, 0.5], [1.5, 1.5], [0.5, 1.5], [1.5, 0.5]]) { f.disc(x, y, 0.2, lamp, 0.25); f.disc(x, y, 0.07, lamp); }
  else { f.disc(1, 1, 0.55, lamp, 0.2); f.disc(1, 1, 0.3, lamp, 0.4); f.disc(1, 1, 0.14, lamp); }
};
/** A pendant lamp hanging into the mid plane from its top. */
const pendant = (f: Face, x: number, c: RGB, glow: RGB) => { f.rect(x - 0.005, 2.05, 0.01, MID_H - 2.05, shade(c, 0.6)); f.rect(x - 0.13, 1.92, 0.26, 0.14, c); f.disc(x, 1.9, 0.09, glow); };

const WARM: RGB = rgb('#ffe2b0'), COOL: RGB = rgb('#f4f7ff');
const PRODUCTS: RGB[] = ['#d23a2e', '#f2b632', '#2f74c0', '#3f9a4b', '#f4f1ea', '#e8752b', '#7a3e91', '#1f2a44'].map(rgb);
const PASTEL: RGB[] = ['#f4f1ea', '#cfe3f2', '#f2d7e0', '#d9eecf', '#2f74c0', '#e8e2d0', '#ffffff'].map(rgb);
const GARMENTS: RGB[] = ['#2b2d33', '#7d8b9a', '#c8b89c', '#8a3a33', '#e9e5dc', '#3d4f3a', '#1d3557', '#a9a39a'].map(rgb);
const SPINES: RGB[] = ['#7a2e26', '#22436b', '#2f5233', '#c8a24a', '#e9dfc8', '#4a3b5c', '#a4462b', '#1d1d1b', '#d8cdb8'].map(rgb);

/** A side-on bike in metres: wheels at (x, 0.34) and (x + 1.05, 0.34). */
function bike(f: Face, x: number, frame: RGB, tyre: RGB): void {
  f.ring(x, 0.34, 0.34, 0.04, tyre); f.ring(x + 1.05, 0.34, 0.34, 0.04, tyre);
  f.line(x, 0.34, x + 0.42, 0.34, 0.035, frame); f.line(x + 0.42, 0.34, x + 0.78, 0.82, 0.035, frame); f.line(x, 0.34, x + 0.3, 0.82, 0.035, frame);
  f.line(x + 0.3, 0.82, x + 0.78, 0.82, 0.035, frame); f.line(x + 0.78, 0.82, x + 1.05, 0.34, 0.035, frame); f.line(x + 0.42, 0.34, x + 0.28, 0.9, 0.035, frame);
  f.rect(x + 0.2, 0.9, 0.18, 0.04, tyre); f.line(x + 0.78, 0.82, x + 0.82, 1.0, 0.03, frame); f.rect(x + 0.74, 1.0, 0.22, 0.03, tyre);
}
/** A chair seen from the front: seat, back, legs. */
function chair(f: Face, x: number, c: RGB): void { f.rect(x, 0, 0.03, 0.45, c); f.rect(x + 0.37, 0, 0.03, 0.45, c); f.rect(x - 0.01, 0.43, 0.42, 0.05, c); f.rect(x + 0.02, 0.48, 0.36, 0.42, shade(c, 0.9)); }
function table(f: Face, x: number, w: number, top: RGB, leg: RGB, cloth = false): void { f.rect(x + w / 2 - 0.03, 0, 0.06, 0.74, leg); f.rect(x, 0.72, w, 0.04, top); if (cloth) f.rect(x, 0.5, w, 0.24, top); }

const PAINTERS: Record<RoomKind, (s: Faces) => void> = {
  supermarket({ back, mid, side, floor, ceil, r }) {
    back.vgrad(rgb('#e9e7e0'), rgb('#f5f4ef'));
    shelves(back, r, 0, ROOM_W, [0.25, 0.65, 1.05, 1.45, 1.85], rgb('#c9ccd0'), PRODUCTS, 0.09, 0.3, 0.92);
    back.rect(0, 2.45, ROOM_W, 0.28, rgb('#2f74c0'));
    for (let x = 0; x < ROOM_W; x += 1.0) back.rect(x + 0.1, 2.52, 0.5, 0.12, rgb('#f4f1ea'));
    for (let k = 0; k < 2; k++) { const x = 0.35 + k * 2.05; mid.rect(x, 0, 1.25, 1.62, rgb('#d5d8dc')); shelves(mid, r, x + 0.04, 1.17, [0.12, 0.5, 0.88, 1.26], rgb('#b9bdc2'), PRODUCTS, 0.09, 0.3, 0.95); mid.rect(x, 1.55, 1.25, 0.08, rgb('#e30613')); }
    side.vgrad(rgb('#e3e1da'), rgb('#f0efe9')); shelves(side, r, 0, 1, [0.25, 0.65, 1.05, 1.45, 1.85].map(v => v), rgb('#c9ccd0'), PRODUCTS, 0.03, 0.3, 0.95);
    floorGrid(floor, rgb('#d9d6cf'), rgb('#bdb9b0'), 3); ceiling(ceil, rgb('#eceae4'), COOL, 'strip');
  },
  clothing({ back, mid, side, floor, ceil, r }) {
    back.vgrad(rgb('#d9d2c6'), rgb('#e6e0d6'));
    for (const y of [1.15, 2.05]) { back.rect(0, y + 0.02, ROOM_W, 0.025, rgb('#3a3632')); for (let x = 0.05; x < ROOM_W - 0.1; x += 0.07 + r() * 0.04) back.rect(x, y - 0.75, 0.06, 0.77, GARMENTS[Math.floor(r() * GARMENTS.length)]); }
    for (let x = 0.3; x < ROOM_W; x += 2) { back.rect(x, 2.45, 1.2, 0.02, rgb('#3a3632')); }
    for (const [x0, w] of [[0.2, 1.3], [2.3, 1.2]] as const) { mid.rect(x0, 0, 0.03, 1.45, rgb('#2b2724')); mid.rect(x0 + w, 0, 0.03, 1.45, rgb('#2b2724')); mid.rect(x0, 1.42, w + 0.03, 0.03, rgb('#2b2724')); for (let x = x0 + 0.06; x < x0 + w - 0.05; x += 0.06 + r() * 0.03) mid.rect(x, 0.62 + r() * 0.15, 0.055, 0.8 - r() * 0.15, GARMENTS[Math.floor(r() * GARMENTS.length)]); }
    const m = 1.85; mid.disc(m, 1.62, 0.1, rgb('#e9e5dc')); mid.rect(m - 0.16, 0.85, 0.32, 0.68, rgb('#1d3557')); mid.rect(m - 0.12, 0.2, 0.24, 0.66, rgb('#2b2d33')); mid.rect(m - 0.01, 0, 0.02, 0.2, rgb('#3a3632')); mid.rect(m - 0.15, 0, 0.3, 0.02, rgb('#3a3632'));
    side.vgrad(rgb('#d0c8bb'), rgb('#ded7cc')); for (const y of [0.4, 0.9, 1.4]) { side.rect(0.05, y, 0.9, 0.025, rgb('#8a7e6c')); for (let x = 0.07; x < 0.93; x += 0.07) side.rect(x, y + 0.025, 0.05, 0.14, GARMENTS[Math.floor(r() * GARMENTS.length)]); }
    planks(floor, rgb('#b08a5e'), r); ceiling(ceil, rgb('#3a3835'), WARM, 'spots');
  },
  cafeBar({ back, mid, side, floor, ceil, r }) {
    back.vgrad(rgb('#3b2a1e'), rgb('#4a3626'));
    back.rect(0, 0, ROOM_W, 1.0, rgb('#2e2018'));
    for (const y of [1.25, 1.6, 1.95]) { back.rect(0.4, y - 0.03, 3.2, 0.03, rgb('#6b4a2e')); for (let x = 0.45; x < 3.55; x += 0.09 + r() * 0.04) { const c = [rgb('#3d6b3a'), rgb('#c89b3c'), rgb('#7a2e26'), rgb('#e9dfc8'), rgb('#4a3b5c')][Math.floor(r() * 5)]; back.rect(x, y, 0.06, 0.24, c); back.rect(x + 0.02, y + 0.24, 0.02, 0.06, c); back.rect(x + 0.01, y + 0.05, 0.015, 0.12, shade(c, 1.6)); } }
    back.rect(0.45, 2.3, 3.1, 0.35, rgb('#5a4a3a')); back.rect(0.5, 2.33, 3.0, 0.29, rgb('#8a7a64'));
    mid.rect(0, 0, ROOM_W, 1.1, rgb('#4a2f1e')); mid.rect(0, 1.06, ROOM_W, 0.06, rgb('#7a5236')); mid.rect(0, 0, ROOM_W, 0.12, rgb('#2a1a12'));
    for (let x = 0.3; x < ROOM_W; x += 0.55) { mid.rect(x, 0, 0.03, 0.72, rgb('#1d1410')); mid.rect(x - 0.12, 0.7, 0.27, 0.06, rgb('#2a1a12')); }
    mid.rect(0, 0, ROOM_W, 1.12, rgb('#000000'), 0); for (const x of [0.8, 2.0, 3.2]) pendant(mid, x, rgb('#2a1a12'), WARM);
    side.vgrad(rgb('#33241a'), rgb('#433022')); side.rect(0, 0, 1, 0.9, rgb('#2a1c14')); for (const x of [0.15, 0.45, 0.75]) { side.rect(x, 1.35, 0.16, 0.5, rgb('#7a6a50')); side.rect(x + 0.01, 1.37, 0.14, 0.46, rgb('#a89878')); }
    planks(floor, rgb('#5a3c26'), r); ceiling(ceil, rgb('#2a1e16'), WARM, 'disc');
  },
  restaurant({ back, mid, side, floor, ceil, r }) {
    back.vgrad(rgb('#a8634a'), rgb('#b8735a')); back.rect(0, 0, ROOM_W, 1.0, rgb('#5a3a2a'));
    for (let x = 0.4; x < ROOM_W; x += 1.3) { back.rect(x, 1.45, 0.6, 0.45, rgb('#3a2a20')); back.rect(x + 0.04, 1.49, 0.52, 0.37, [rgb('#c8a24a'), rgb('#6b8a9a'), rgb('#e9dfc8')][Math.floor(r() * 3)]); }
    for (const x of [0.25, 2.25]) { table(mid, x, 1.0, rgb('#f4f1ea'), rgb('#2a2622'), true); chair(mid, x - 0.35, rgb('#4a3020')); chair(mid, x + 0.95, rgb('#4a3020')); mid.rect(x + 0.4, 0.76, 0.06, 0.16, rgb('#e9dfc8')); mid.disc(x + 0.43, 0.95, 0.03, WARM); }
    for (const x of [0.75, 2.75]) pendant(mid, x, rgb('#1d1d1b'), WARM);
    side.vgrad(rgb('#9a5a44'), rgb('#aa6a52')); side.rect(0, 0, 1, 0.9, rgb('#5a3a2a')); side.rect(0.3, 1.4, 0.3, 0.5, rgb('#3a2a20'));
    planks(floor, rgb('#7a5236'), r); ceiling(ceil, rgb('#e6dccb'), WARM, 'disc');
  },
  bakery({ back, mid, side, floor, ceil, r }) {
    back.vgrad(rgb('#efe2c8'), rgb('#f6ecd8'));
    back.rect(0, 0.95, ROOM_W, 1.4, rgb('#8a5a32'));
    for (const y of [1.0, 1.45, 1.9]) { back.rect(0, y - 0.04, ROOM_W, 0.04, rgb('#5a3a20')); for (let x = 0.05; x < ROOM_W - 0.15; x += 0.18 + r() * 0.1) { const c = [rgb('#c8862e'), rgb('#a0602a'), rgb('#e0b060'), rgb('#7a4a22')][Math.floor(r() * 4)]; back.disc(x + 0.08, y + 0.08, 0.08, c); back.rect(x, y, 0.16, 0.08, c); } }
    mid.rect(0, 0, ROOM_W, 0.95, rgb('#e9e2d4')); mid.rect(0, 0, ROOM_W, 0.5, rgb('#b89a78'));
    mid.rect(0, 0.5, ROOM_W, 0.42, rgb('#fff6e0')); for (let x = 0.08; x < ROOM_W - 0.2; x += 0.2 + r() * 0.08) { const c = [rgb('#c8862e'), rgb('#f2d7e0'), rgb('#e0b060'), rgb('#7a3a22'), rgb('#f4f1ea')][Math.floor(r() * 5)]; mid.disc(x + 0.08, 0.6 + r() * 0.15, 0.07, c); }
    mid.rect(0, 0.92, ROOM_W, 0.05, rgb('#d0d4d8')); mid.rect(0, 0.97, ROOM_W, 0.25, rgb('#cfe3f2'), 0.25);
    side.vgrad(rgb('#e6d8bc'), rgb('#efe3cc')); shelves(side, r, 0, 1, [0.95, 1.45, 1.95], rgb('#5a3a20'), [rgb('#c8862e'), rgb('#a0602a'), rgb('#e0b060')], 0.04, 0.12);
    floorTiles(floor, rgb('#d8d0c0'), rgb('#9a8c78'), 4); ceiling(ceil, rgb('#f2ede2'), WARM, 'strip');
  },
  bikeShop({ back, mid, side, floor, ceil, r }) {
    back.vgrad(rgb('#cfcfca'), rgb('#dcdcd6'));
    for (let x = 0.1; x < ROOM_W; x += 1.35) bike(back, x + 0.3, [rgb('#1d1d1b'), rgb('#2f5a8a'), rgb('#8a2a22'), rgb('#3d6b3a')][Math.floor(r() * 4)], rgb('#1a1a1a'));
    for (let x = 0.3; x < ROOM_W; x += 1.3) { back.ring(x + 0.3, 1.9, 0.3, 0.035, rgb('#1a1a1a')); back.ring(x + 0.9, 1.95, 0.3, 0.035, rgb('#1a1a1a')); back.rect(x, 2.3, 1.2, 0.03, rgb('#5a5a58')); }
    for (const x of [0.15, 2.2]) bike(mid, x, [rgb('#1d1d1b'), rgb('#c8c4bc'), rgb('#2f5a8a')][Math.floor(r() * 3)], rgb('#151515'));
    side.vgrad(rgb('#c4c4be'), rgb('#d2d2cc')); for (let x = 0.1; x < 1; x += 0.25) side.rect(x, 0.2, 0.18, 1.0, rgb('#5a5a58'), 0.6);
    floorGrid(floor, rgb('#9a9a94'), rgb('#86867f'), 1); ceiling(ceil, rgb('#bdbdb8'), COOL, 'strip');
  },
  bookshop({ back, mid, side, floor, ceil, r }) {
    back.fill(rgb('#5a3f2a'));
    for (let y = 0.1; y < 2.6; y += 0.36) { back.rect(0, y - 0.03, ROOM_W, 0.03, rgb('#3a2818')); for (let x = 0; x < ROOM_W; x += 0.035 + r() * 0.02) { if (r() > 0.93) continue; back.rect(x, y, 0.03, 0.24 + r() * 0.07, SPINES[Math.floor(r() * SPINES.length)]); } }
    for (const x0 of [0.3, 2.3]) { mid.rect(x0, 0, 1.4, 0.78, rgb('#4a3020')); mid.rect(x0 - 0.04, 0.76, 1.48, 0.04, rgb('#6b4a2e')); for (let x = x0 + 0.05; x < x0 + 1.3; x += 0.2) { let y = 0.8; for (let k = 0; k < 2 + Math.floor(r() * 3); k++) { mid.rect(x, y, 0.17, 0.035, SPINES[Math.floor(r() * SPINES.length)]); y += 0.035; } } }
    side.fill(rgb('#5a3f2a')); for (let y = 0.1; y < 2.6; y += 0.36) { side.rect(0, y - 0.03, 1, 0.03, rgb('#3a2818')); for (let x = 0; x < 1; x += 0.012) side.rect(x, y, 0.009, 0.25, SPINES[Math.floor(r() * SPINES.length)]); }
    planks(floor, rgb('#8a6440'), r); ceiling(ceil, rgb('#e2d8c4'), WARM, 'disc');
  },
  pharmacy({ back, mid, side, floor, ceil, r }) {
    back.fill(rgb('#f4f4f2'));
    shelves(back, r, 0, ROOM_W, [0.95, 1.3, 1.65, 2.0], rgb('#dcdcda'), PASTEL, 0.07, 0.2, 0.9);
    back.rect(1.75, 2.35, 0.5, 0.3, rgb('#2f9a4b')); back.rect(1.92, 2.38, 0.16, 0.24, rgb('#ffffff')); back.rect(1.82, 2.45, 0.36, 0.1, rgb('#ffffff'));
    mid.rect(0.2, 0, 1.6, 1.0, rgb('#f0f0ee')); mid.rect(0.15, 0.98, 1.7, 0.05, rgb('#c8ccd0')); mid.rect(0.2, 0, 1.6, 0.1, rgb('#9aa0a6'));
    mid.rect(2.6, 0, 0.9, 1.5, rgb('#e6e6e4')); shelves(mid, r, 2.64, 0.82, [0.3, 0.7, 1.1], rgb('#cfcfcd'), PASTEL, 0.07, 0.18, 0.95);
    side.fill(rgb('#ededeb')); shelves(side, r, 0, 1, [0.6, 1.0, 1.4, 1.8], rgb('#d4d4d2'), PASTEL, 0.025, 0.2, 0.95);
    floorGrid(floor, rgb('#e8e8e4'), rgb('#cfcfca'), 2); ceiling(ceil, rgb('#f6f6f4'), COOL, 'strip');
  },
  hairdresser({ back, mid, side, floor, ceil, r }) {
    back.vgrad(rgb('#d8d2ca'), rgb('#e4dfd8'));
    for (let x = 0.2; x < ROOM_W; x += 1.3) { back.rect(x, 0.95, 0.9, 1.25, rgb('#2a2622')); back.rect(x + 0.05, 1.0, 0.8, 1.15, rgb('#8a98a4')); back.rect(x + 0.05, 1.7, 0.8, 0.45, rgb('#a9b5c0')); back.rect(x - 0.05, 0.85, 1.0, 0.08, rgb('#2a2622')); for (let k = 0; k < 4; k++) back.disc(x + 0.15 + k * 0.2, 2.3, 0.04, WARM); }
    void r;
    for (const x of [0.6, 1.9, 3.2]) { mid.rect(x - 0.03, 0, 0.06, 0.4, rgb('#9a9a9a')); mid.rect(x - 0.25, 0, 0.5, 0.04, rgb('#9a9a9a')); mid.rect(x - 0.28, 0.4, 0.56, 0.16, rgb('#1d1d1b')); mid.rect(x - 0.24, 0.56, 0.48, 0.55, rgb('#2a2622')); mid.rect(x - 0.32, 0.5, 0.06, 0.25, rgb('#1d1d1b')); mid.rect(x + 0.26, 0.5, 0.06, 0.25, rgb('#1d1d1b')); }
    side.vgrad(rgb('#d0cac2'), rgb('#ddd8d0')); side.rect(0.2, 1.0, 0.5, 1.1, rgb('#8a98a4'));
    floorTiles(floor, rgb('#1d1d1b'), rgb('#e9e5dc'), 4); ceiling(ceil, rgb('#efebe4'), WARM, 'spots');
  },
  gallery({ back, mid, side, floor, ceil, r }) {
    back.fill(rgb('#f2f1ee'));
    for (const [x, w, h] of [[0.4, 1.0, 0.8], [1.9, 0.6, 0.9], [2.9, 0.8, 0.6]] as const) { back.rect(x - 0.03, 1.25 - 0.03, w + 0.06, h + 0.06, rgb('#2a2a2a')); back.rect(x, 1.25, w, h, [rgb('#c8a24a'), rgb('#2f5a8a'), rgb('#a4462b'), rgb('#3d6b3a')][Math.floor(r() * 4)]); back.rect(x + w * 0.3, 1.25 + h * 0.2, w * 0.4, h * 0.5, rgb('#e9e5dc'), 0.5); }
    mid.rect(1.0, 0, 0.5, 0.9, rgb('#f6f6f4')); mid.rect(1.08, 0.9, 0.34, 0.12, rgb('#3a3a3a')); mid.rect(2.8, 0, 0.6, 0.95, rgb('#f6f6f4')); mid.rect(2.9, 0.95, 0.4, 0.06, rgb('#1d1d1b'));
    side.fill(rgb('#ecebe8')); side.rect(0.35, 1.2, 0.3, 0.7, rgb('#2a2a2a')); side.rect(0.37, 1.22, 0.26, 0.66, rgb('#c8b89c'));
    floorGrid(floor, rgb('#cfccc6'), rgb('#bcb8b1'), 1); ceiling(ceil, rgb('#f6f6f4'), COOL, 'spots');
  },
  office({ back, mid, side, floor, ceil, r }) {
    back.vgrad(rgb('#c9c6bf'), rgb('#d6d3cc')); back.rect(0.5, 1.3, 1.2, 0.8, rgb('#e9e5dc')); back.rect(2.4, 0, 0.8, 1.9, rgb('#8a8680')); back.rect(2.45, 0, 0.7, 1.85, rgb('#b0aca4'));
    void r;
    mid.rect(0.5, 0.72, 1.8, 0.05, rgb('#d8d4cc')); mid.rect(0.55, 0, 0.05, 0.72, rgb('#5a5650')); mid.rect(2.2, 0, 0.05, 0.72, rgb('#5a5650')); mid.rect(0.9, 0.77, 0.5, 0.32, rgb('#1d1d1b')); mid.rect(1.12, 0.77, 0.06, 0.05, rgb('#3a3a3a'));
    mid.rect(1.3, 0.4, 0.45, 0.06, rgb('#2a2a2a')); mid.rect(1.35, 0.46, 0.35, 0.5, rgb('#2a2a2a')); mid.rect(3.3, 0, 0.3, 0.35, rgb('#6b5a4a')); mid.disc(3.45, 0.7, 0.28, rgb('#3d6b3a'));
    side.vgrad(rgb('#c2bfb8'), rgb('#cfccc5'));
    floorGrid(floor, rgb('#7a7a78'), rgb('#727270'), 1); ceiling(ceil, rgb('#e2e0da'), COOL, 'strip');
  },
  dark({ back, mid, side, floor, ceil, r }) {
    back.vgrad(rgb('#1c1a18'), rgb('#24211e')); for (let x = 0.3; x < ROOM_W; x += 1.2 + r()) back.rect(x, 0.2, 0.7, 1.4, rgb('#2c2824'));
    mid.rect(0.8, 0, 1.6, 0.95, rgb('#151311'));
    side.fill(rgb('#1a1816')); floor.fill(rgb('#141210')); ceiling(ceil, rgb('#161412'), rgb('#4a3a28'), 'disc');
  },
  takeaway({ back, mid, side, floor, ceil, r }) {
    back.vgrad(rgb('#e6e2da'), rgb('#efebe4')); back.rect(0, 0, ROOM_W, 1.05, rgb('#b8bcc0'));
    for (let x = 0.15; x < ROOM_W; x += 1.3) { back.rect(x, 1.7, 1.15, 0.75, rgb('#1d1d1b')); back.rect(x + 0.04, 1.74, 1.07, 0.67, rgb('#f2d16b')); for (let y = 1.8; y < 2.35; y += 0.11) { back.rect(x + 0.1, y, 0.6, 0.04, rgb('#3a2a20')); back.rect(x + 0.85, y, 0.18, 0.04, rgb('#c8362a')); } back.rect(x + 0.1, 2.3, 0.4, 0.06, rgb('#c8362a')); }
    back.rect(1.6, 1.1, 0.3, 0.5, rgb('#9a5a2a')); back.rect(1.55, 1.05, 0.4, 0.06, rgb('#6a6a6a'));
    mid.rect(0, 0, ROOM_W, 1.05, rgb('#c8ccd0')); mid.rect(0, 1.02, ROOM_W, 0.05, rgb('#e6e8ea')); mid.rect(0, 0, ROOM_W, 0.1, rgb('#6a6e72'));
    for (let x = 0.4; x < ROOM_W; x += 0.45) { const c = [rgb('#e0a040'), rgb('#3f9a4b'), rgb('#d23a2e'), rgb('#f4f1ea')][Math.floor(r() * 4)]; mid.rect(x, 0.82, 0.3, 0.18, c); }
    mid.rect(0, 1.07, ROOM_W, 0.22, rgb('#cfe3f2'), 0.2);
    side.vgrad(rgb('#e0dcd4'), rgb('#ebe7e0')); side.rect(0, 0, 1, 1.0, rgb('#c9c3b8')); side.rect(0.1, 0.7, 0.8, 0.04, rgb('#8a8680'));
    floorTiles(floor, rgb('#c8c0b4'), rgb('#a89e90'), 2); ceiling(ceil, rgb('#f2f0ea'), COOL, 'strip');
  },
  florist({ back, mid, side, floor, ceil, r }) {
    back.vgrad(rgb('#c8c4b4'), rgb('#d6d2c4'));
    for (const y of [0.9, 1.5]) { back.rect(0, y - 0.04, ROOM_W, 0.04, rgb('#6b5a44')); for (let x = 0.05; x < ROOM_W; x += 0.22 + r() * 0.1) { back.rect(x + 0.05, y, 0.12, 0.14, rgb('#8a5a3a')); back.disc(x + 0.11, y + 0.3, 0.16 + r() * 0.06, [rgb('#3d6b3a'), rgb('#2f5233'), rgb('#5a8a4a')][Math.floor(r() * 3)]); } }
    for (let x = 0.1; x < ROOM_W; x += 0.32) { const top = 0.55 + r() * 0.35; mid.rect(x + 0.04, 0, 0.22, 0.42, rgb('#6a6e72')); for (let k = 0; k < 7; k++) { const fx = x + 0.04 + r() * 0.22, fy = top + r() * 0.3; mid.line(x + 0.15, 0.4, fx, fy, 0.012, rgb('#3d6b3a')); mid.disc(fx, fy, 0.045, [rgb('#d23a2e'), rgb('#f2b632'), rgb('#f2d7e0'), rgb('#7a3e91'), rgb('#f4f1ea'), rgb('#e8752b')][Math.floor(r() * 6)]); } }
    side.vgrad(rgb('#bfbbab'), rgb('#ccc8b9')); for (let x = 0.1; x < 1; x += 0.15) side.disc(x, 1.0, 0.07, rgb('#3d6b3a'));
    floorTiles(floor, rgb('#8a7e6c'), rgb('#9a8e7c'), 2); ceiling(ceil, rgb('#e6e2d8'), WARM, 'disc');
  },
  shopGeneric({ back, mid, side, floor, ceil, r }) {
    // A neutral shopfront with no template (retail round 6 `groundShop`): a plain dim shop, never a trade. Pale walls, a
    // low counter and a few indistinct cases; muted greys and browns only.
    back.vgrad(rgb('#9e9a92'), rgb('#aaa69e')); back.rect(0, 0, ROOM_W, 0.9, rgb('#7e7a72'));
    for (let x = 0.2; x < ROOM_W; x += 1.3 + r() * 0.3) { back.rect(x, 0.95, 0.9, 1.2, rgb('#8a857c')); back.rect(x + 0.05, 1.3, 0.8, 0.03, rgb('#6e6a62')); back.rect(x + 0.05, 1.7, 0.8, 0.03, rgb('#6e6a62')); }
    mid.rect(0.6, 0, 1.4, 0.95, rgb('#6e6a62')); mid.rect(0.55, 0.93, 1.5, 0.04, rgb('#8e8a82'));
    side.vgrad(rgb('#96928a'), rgb('#a29e96')); floorGrid(floor, rgb('#8a867e'), rgb('#7a766e'), 2); ceiling(ceil, rgb('#b8b4ac'), rgb('#e8dcc4'), 'disc');
  },
  automat({ back, mid, side, floor, ceil, r }) {
    // FEBO's automatiek (Korte Niezel, David 2026-11-16): a wall of small hatches, each a lit warm cell behind a chrome
    // frame with a dark handle, in a dark surround; the rest of the shop dark. The shader draws this room at the dusk
    // level by day too (OWN_LIGHT_ROOMS), so the hatches glow and the dark wall stays dark.
    back.vgrad(rgb('#1a1715'), rgb('#211d1a'));
    const hw = 0.3, hh = 0.24, x0 = 0.1, y0 = 0.62;
    back.rect(0, y0 - 0.08, ROOM_W, 6 * hh + 0.16, rgb('#3a3632'));
    for (let j = 0; j < 6; j++) for (let i = 0; i * hw < ROOM_W - 0.2; i++) {
      const x = x0 + i * hw, y = y0 + j * hh;
      back.rect(x, y, hw - 0.03, hh - 0.03, rgb('#b8b4ac'));
      const warm = [rgb('#ffd27a'), rgb('#ffc860'), rgb('#ffdc94')][Math.floor(r() * 3)], empty = r() < 0.18;
      back.rect(x + 0.025, y + 0.025, hw - 0.08, hh - 0.08, empty ? rgb('#6a4a2a') : warm);
      if (!empty) back.disc(x + hw / 2 - 0.015, y + hh / 2 - 0.02, 0.06, [rgb('#c8862e'), rgb('#a0602a'), rgb('#e0a040')][Math.floor(r() * 3)]);
      back.rect(x + hw - 0.07, y + hh / 2 - 0.03, 0.025, 0.05, rgb('#1d1d1b'));
    }
    back.rect(0, y0 + 6 * hh + 0.12, ROOM_W, 0.14, rgb('#c8102e'));
    mid.rect(0, 0, ROOM_W, 0.32, rgb('#2a2622')); mid.rect(0, 0.3, ROOM_W, 0.04, rgb('#8a8680'));
    side.vgrad(rgb('#1c1916'), rgb('#24201c')); floorTiles(floor, rgb('#2a2622'), rgb('#3a3430'), 2); ceiling(ceil, rgb('#1e1b18'), rgb('#6a5030'), 'disc');
  },
};

/** The atlas (ATLAS_W x ATLAS_H RGBA, rows top-down). Faces are opaque except the mid plane (alpha 0 where empty). */
export function paintInteriorAtlas(): Uint8ClampedArray {
  const img = new Uint8ClampedArray(ATLAS_W * ATLAS_H * 4);
  ROOM_KINDS.forEach((room, i) => {
    const cx = (i % COLS) * CELL, cy = Math.floor(i / COLS) * CELL, r = prng(`shop-interior:${room}`);
    const face = (k: keyof typeof FACE, mW: number, mH: number, wrap: boolean) => { const [x, y, w, h] = FACE[k]; return new Face(img, cx + x, cy + y, w, h, mW, mH, wrap); };
    const faces: Faces = { back: face('back', ROOM_W, PAINT_H, true), mid: face('mid', ROOM_W, MID_H, true), side: face('side', 1, PAINT_H, false), floor: face('floor', FLOOR_TILE, FLOOR_TILE, true), ceil: face('ceil', CEIL_TILE, CEIL_TILE, true), r };
    PAINTERS[room](faces);
    for (const k of ['back', 'side', 'floor', 'ceil'] as const) faces[k].grain(r, 0.06);
  });
  return img;
}

/** The atlas cell's origin (px) of a room. */
export function roomCell(room: RoomKind): [number, number] {
  const i = ROOM_KINDS.indexOf(room);
  return [(i % COLS) * CELL, Math.floor(i / COLS) * CELL];
}
