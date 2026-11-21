// Window goods (lane retail-real-20261115; David 2026-11-15: "more things in the window that correspond to the retail
// type"). Each shop type's pane interior is a painted cell of what a rider sees through the glass from the street:
// bread on tiered shelves, cheese wheels, buckets of flowers, phone cases on a pegboard, mannequins and racks. A pane is
// cut into tiles about GOODS_TILE_M wide, each one textured quad of its type's cell, so the cost is two triangles a tile
// (the round 3c interior was two a pane) and no new geometry. The cells live on texture-array layers after the logo
// pages (retailPages.ts); paintLookAtlas paints them at load from this module, and the Node template sheet paints the
// same cells, so the sheet shows what the game draws.
//
// Pure: a painter takes a 2D context (the browser's or @napi-rs/canvas's) and a square cell. Every cell is painted in a
// design space of GOODS_W x GOODS_H units (the tile's shape on the wall: ~1.15 m wide by the 1.9 m of glass under the
// transom bar), scaled to the square cell; the quad stretches it back. Deterministic (seeded), no text, no images.
import { roomOf, type RoomSpec } from './retailRoomTone.js';
import { shopVarietyOn } from './shopVariety.js';

/** A pane tile's width on the wall (m): a pane wider than 1.5 tiles takes two, and so on. */
export const GOODS_TILE_M = 1.15;
/** The design space (units): a tile is GOODS_W wide and GOODS_H tall (the glass under the transom, ~1.9 m). */
export const GOODS_W = 150, GOODS_H = 250;

export const GOODS_KINDS = [
  'aisles', 'drugstore', 'bread', 'butcher', 'cheese', 'produce', 'flowers', 'books', 'phones', 'gelato', 'waffles', 'doner',
  'souvenirs', 'tobacco', 'exchange', 'bikes', 'coffeeshop', 'smartshop', 'clothing', 'magazines', 'ducks', 'deli', 'bowls',
  'automatiek', 'fastfood', 'bainMarie', 'jars', 'liquor', 'hair', 'pharmacy', 'frites', 'cafe', 'optician', 'shoes',
  'cosmetics', 'pancakes', 'brownBar', 'pizza', 'redWindow', 'tattoo',
] as const;
export type GoodsKind = (typeof GOODS_KINDS)[number];
/** Cells per goods layer (2 x 2). */
export const GOODS_GRID = 2;
export const GOODS_PER_LAYER = GOODS_GRID * GOODS_GRID;
export const GOODS_LAYERS = Math.ceil(GOODS_KINDS.length / GOODS_PER_LAYER);

/** A goods kind's layer (0-based among the goods layers) and uv rect on it (u0, v0, u1, v1; v up, rows bottom-first),
 *  inset half a texel's worth so mips do not bleed the neighbour cell. */
export function goodsCell(kind: GoodsKind): { page: number; rect: [number, number, number, number] } {
  const i = GOODS_KINDS.indexOf(kind), page = Math.floor(i / GOODS_PER_LAYER), k = i % GOODS_PER_LAYER;
  const c = k % GOODS_GRID, r = Math.floor(k / GOODS_GRID), s = 1 / GOODS_GRID, inset = 0.012;
  // Image rows run top-down; the array's v runs bottom-up.
  const y0 = r * s, y1 = (r + 1) * s;
  return { page, rect: [c * s + inset, 1 - y1 + inset, (c + 1) * s - inset, 1 - y0 - inset] };
}
/** A cell's box in a layer image (px, from the top-left) for a layer `size` px square. */
export function goodsCellPx(kind: GoodsKind, size: number): { page: number; x: number; y: number; w: number } {
  const i = GOODS_KINDS.indexOf(kind), k = i % GOODS_PER_LAYER, w = size / GOODS_GRID;
  return { page: Math.floor(i / GOODS_PER_LAYER), x: (k % GOODS_GRID) * w, y: Math.floor(k / GOODS_GRID) * w, w };
}

/** The subset of CanvasRenderingContext2D the painters use (the browser's and @napi-rs/canvas's both fit). */
export type Ctx2D = {
  fillStyle: unknown; strokeStyle: unknown; lineWidth: number; globalAlpha: number;
  fillRect(x: number, y: number, w: number, h: number): void;
  beginPath(): void; closePath(): void; moveTo(x: number, y: number): void; lineTo(x: number, y: number): void;
  arc(x: number, y: number, r: number, a0: number, a1: number, ccw?: boolean): void;
  ellipse(x: number, y: number, rx: number, ry: number, rot: number, a0: number, a1: number, ccw?: boolean): void;
  quadraticCurveTo(cx: number, cy: number, x: number, y: number): void;
  fill(): void; stroke(): void; save(): void; restore(): void; translate(x: number, y: number): void; scale(x: number, y: number): void;
  rect(x: number, y: number, w: number, h: number): void; clip(): void;
  createLinearGradient(x0: number, y0: number, x1: number, y1: number): { addColorStop(o: number, c: string): void };
  createRadialGradient(x0: number, y0: number, r0: number, x1: number, y1: number, r1: number): { addColorStop(o: number, c: string): void };
};

/** Seeded 0..1 stream (mulberry32). */
function stream(seed: number): () => number {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const pick = <T>(r: () => number, list: readonly T[]): T => list[Math.floor(r() * list.length) % list.length];

/** `room`: the shop's family room (retailRoomTone.ts, round m): room() paints it whatever the painter asked for. */
type P = { c: Ctx2D; r: () => number; room?: RoomSpec };
const W = GOODS_W, H = GOODS_H;
function rect(p: P, x: number, y: number, w: number, h: number, fill: string): void { p.c.fillStyle = fill; p.c.fillRect(x, y, w, h); }
function round(p: P, x: number, y: number, w: number, h: number, rad: number, fill: string): void {
  const c = p.c, q = Math.min(rad, w / 2, h / 2);
  c.beginPath(); c.moveTo(x + q, y); c.lineTo(x + w - q, y); c.quadraticCurveTo(x + w, y, x + w, y + q); c.lineTo(x + w, y + h - q);
  c.quadraticCurveTo(x + w, y + h, x + w - q, y + h); c.lineTo(x + q, y + h); c.quadraticCurveTo(x, y + h, x, y + h - q); c.lineTo(x, y + q);
  c.quadraticCurveTo(x, y, x + q, y); c.closePath(); c.fillStyle = fill; c.fill();
}
function oval(p: P, x: number, y: number, rx: number, ry: number, fill: string): void { p.c.beginPath(); p.c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); p.c.fillStyle = fill; p.c.fill(); }
function poly(p: P, pts: ReadonlyArray<readonly [number, number]>, fill: string): void {
  const c = p.c; c.beginPath(); c.moveTo(pts[0][0], pts[0][1]); for (const [x, y] of pts.slice(1)) c.lineTo(x, y); c.closePath(); c.fillStyle = fill; c.fill();
}
function vgrad(p: P, x: number, y: number, w: number, h: number, stops: ReadonlyArray<readonly [number, string]>): void {
  const g = p.c.createLinearGradient(0, y, 0, y + h); for (const [o, s] of stops) g.addColorStop(o, s); p.c.fillStyle = g; p.c.fillRect(x, y, w, h);
}
function glow(p: P, x: number, y: number, rad: number, rgb: string, a: number): void {
  const g = p.c.createRadialGradient(x, y, 0, x, y, rad); g.addColorStop(0, `rgba(${rgb},${a})`); g.addColorStop(1, `rgba(${rgb},0)`); p.c.fillStyle = g; p.c.fillRect(x - rad, y - rad, rad * 2, rad * 2);
}
/** Where a family room's dado starts (design units from the top): the same height in every pane of a shop. */
export const DADO_Y = 168;
/** A lit room behind the glass: back wall, ceiling band with lights, floor. */
function room(p: P, wall: string, floor: string, ceilingLight = '255,236,200', lights = 3): void {
  const o = p.room;
  if (o) { wall = o.wall; floor = o.floor; ceilingLight = o.light; lights = o.lights; }
  rect(p, 0, 0, W, H, wall);
  vgrad(p, 0, 0, W, 40, [[0, 'rgba(0,0,0,0.35)'], [1, 'rgba(0,0,0,0)']]);
  // The family room's dado: one line along the lower wall that runs on from pane to pane.
  if (o) { rect(p, 0, DADO_Y, W, H - 26 - DADO_Y, o.dado); rect(p, 0, DADO_Y - 3, W, 3, shade(o.dado, 0.8)); }
  rect(p, 0, H - 26, W, 26, floor);
  vgrad(p, 0, H - 26, W, 26, [[0, 'rgba(0,0,0,0.25)'], [1, 'rgba(0,0,0,0)']]);
  for (let k = 0; k < lights; k++) { const x = W * (k + 0.5) / lights; rect(p, x - 9, 6, 18, 3, `rgb(${ceilingLight})`); glow(p, x, 10, 34, ceilingLight, 0.28); }
}
/** Shelf boards across the cell at these y values. */
function shelves(p: P, ys: readonly number[], edge: string, x0 = 0, x1 = W): void { for (const y of ys) { rect(p, x0, y, x1 - x0, 4, edge); rect(p, x0, y + 4, x1 - x0, 2, 'rgba(0,0,0,0.25)'); } }
/** Packets standing on a shelf from x0 to x1 with their bottoms at y. */
function packets(p: P, x0: number, x1: number, y: number, hMin: number, hMax: number, colours: readonly string[], wMin = 5, wMax = 11): void {
  for (let x = x0 + 1; x < x1 - 3;) {
    const w = wMin + p.r() * (wMax - wMin), h = hMin + p.r() * (hMax - hMin), col = pick(p.r, colours);
    rect(p, x, y - h, Math.min(w, x1 - x), h, col);
    rect(p, x, y - h, Math.min(w, x1 - x), Math.max(1.5, h * 0.18), 'rgba(255,255,255,0.22)');
    x += w + 0.8;
  }
}

/** A mannequin in a dress or coat, feet at y. */
function mannequin(p: P, x: number, y: number, s: number, cloth: string, skin = '#e8dccb'): void {
  oval(p, x, y - 150 * s, 9 * s, 11 * s, skin);
  rect(p, x - 3 * s, y - 140 * s, 6 * s, 8 * s, skin);
  poly(p, [[x - 17 * s, y - 132 * s], [x + 17 * s, y - 132 * s], [x + 13 * s, y - 92 * s], [x + 24 * s, y - 40 * s], [x - 24 * s, y - 40 * s], [x - 13 * s, y - 92 * s]], cloth);
  poly(p, [[x - 17 * s, y - 132 * s], [x - 23 * s, y - 128 * s], [x - 26 * s, y - 80 * s], [x - 19 * s, y - 80 * s]], cloth);
  poly(p, [[x + 17 * s, y - 132 * s], [x + 23 * s, y - 128 * s], [x + 26 * s, y - 80 * s], [x + 19 * s, y - 80 * s]], cloth);
  rect(p, x - 9 * s, y - 40 * s, 5 * s, 34 * s, skin); rect(p, x + 4 * s, y - 40 * s, 5 * s, 34 * s, skin);
  rect(p, x - 1.5 * s, y - 6 * s, 3 * s, 6 * s, '#555'); rect(p, x - 14 * s, y - 2 * s, 28 * s, 2 * s, '#444');
}
/** A rail of hanging garments from x0 to x1 at rail height y. */
function rail(p: P, x0: number, x1: number, y: number, colours: readonly string[], len = 60): void {
  rect(p, x0, y, x1 - x0, 3, '#8a8a88');
  for (let x = x0 + 3; x < x1 - 6; x += 6 + p.r() * 3) {
    const col = pick(p.r, colours), l = len * (0.7 + 0.4 * p.r());
    poly(p, [[x, y + 3], [x + 9, y + 3], [x + 10, y + 3 + l], [x - 1, y + 3 + l]], col);
    rect(p, x, y + 3, 1.5, l, 'rgba(0,0,0,0.25)');
  }
}
/** A loaf (bread) at x, y. */
function loaf(p: P, x: number, y: number, w: number, h: number, crust: string): void {
  oval(p, x, y, w / 2, h / 2, crust);
  oval(p, x - w * 0.08, y - h * 0.18, w * 0.32, h * 0.2, 'rgba(255,230,180,0.35)');
  for (let k = -1; k <= 1; k++) rect(p, x + k * w * 0.22 - 1, y - h * 0.35, 2, h * 0.45, 'rgba(90,50,20,0.45)');
}
/** A bike side-on, rear axle at x, wheels on y. */
function bike(p: P, x: number, y: number, s: number, frame: string): void {
  const c = p.c, R = 17 * s, wb = 46 * s;
  c.lineWidth = 3 * s; c.strokeStyle = '#151515';
  for (const wx of [x, x + wb]) { c.beginPath(); c.arc(wx, y - R, R, 0, Math.PI * 2); c.stroke(); }
  c.lineWidth = 3.4 * s; c.strokeStyle = frame;
  const bb: [number, number] = [x + wb * 0.42, y - R], seat: [number, number] = [x + wb * 0.3, y - R - 30 * s], head: [number, number] = [x + wb * 0.82, y - R - 28 * s];
  c.beginPath(); c.moveTo(x, y - R); c.lineTo(bb[0], bb[1]); c.lineTo(seat[0], seat[1]); c.lineTo(x, y - R); c.moveTo(seat[0], seat[1]); c.lineTo(head[0], head[1]); c.lineTo(bb[0], bb[1]); c.moveTo(head[0], head[1]); c.lineTo(x + wb, y - R); c.stroke();
  rect(p, seat[0] - 6 * s, seat[1] - 3 * s, 12 * s, 3 * s, '#1a1a1a'); rect(p, head[0] - 2 * s, head[1] - 8 * s, 10 * s, 2.5 * s, '#1a1a1a');
}
/** A bottle standing on y. */
function bottle(p: P, x: number, y: number, h: number, glass: string, label: string): void {
  const w = h * 0.28;
  round(p, x - w / 2, y - h * 0.72, w, h * 0.72, w * 0.25, glass);
  rect(p, x - w * 0.18, y - h, w * 0.36, h * 0.3, glass);
  rect(p, x - w / 2, y - h * 0.5, w, h * 0.22, label);
  rect(p, x - w / 2 + 1, y - h * 0.7, 1.4, h * 0.6, 'rgba(255,255,255,0.3)');
}
/** A lit menu board with lines of price text (bars, no glyphs). */
function menuBoard(p: P, x: number, y: number, w: number, h: number, bg: string, ink: string, photos = 0, photoCols: readonly string[] = ['#c8782f', '#e0b04a', '#a8422a']): void {
  rect(p, x - 2, y - 2, w + 4, h + 4, '#141414'); rect(p, x, y, w, h, bg);
  let yy = y + 5;
  if (photos) { const pw = (w - 6 - (photos - 1) * 3) / photos; for (let k = 0; k < photos; k++) { round(p, x + 3 + k * (pw + 3), yy, pw, h * 0.38, 2, pick(p.r, photoCols)); oval(p, x + 3 + k * (pw + 3) + pw / 2, yy + h * 0.2, pw * 0.3, h * 0.1, 'rgba(255,240,200,0.35)'); } yy += h * 0.38 + 4; }
  for (; yy < y + h - 4; yy += 6) { rect(p, x + 4, yy, (w - 8) * (0.45 + 0.35 * p.r()), 2.2, ink); rect(p, x + w - 14, yy, 10, 2.2, ink); }
}

const PRODUCT = ['#d8452f', '#f2b92e', '#3f8f4a', '#2f6fb0', '#e8e2d2', '#c0392b', '#7cb342', '#ee7f2c', '#6a3d8f', '#f4f1ea'];
const PASTEL = ['#f4c6d6', '#bcd8f0', '#f6f0e4', '#d6eccf', '#f2b5c4', '#ffffff', '#c9b8e8', '#4a8fd6', '#e8457a'];

const PAINTERS: Record<GoodsKind, (p: P) => void> = {
  aisles(p) {
    // A supermarket seen through the glass: gondola shelves in coloured product rows either side of an aisle that runs
    // back into the light, ceiling strip lights, a promo stack of crates at the window.
    room(p, '#e9e6de', '#cfcac0', '255,250,235', 2);
    const gap0 = W * 0.42, gap1 = W * 0.58;
    vgrad(p, gap0, 30, gap1 - gap0, 150, [[0, '#f6f4ec'], [1, '#d8d4ca']]);
    for (let k = 0; k < 3; k++) rect(p, gap0 + 2, 60 + k * 30, gap1 - gap0 - 4, 10, pick(p.r, PRODUCT));
    const ys = [62, 96, 130, 164];
    shelves(p, ys, '#f4f2ec', 0, gap0); shelves(p, ys, '#f4f2ec', gap1, W);
    for (const y of ys) { packets(p, 0, gap0, y, 18, 28, PRODUCT, 4, 9); packets(p, gap1, W, y, 18, 28, PRODUCT, 4, 9); }
    for (const x of [gap0 - 3, gap1]) rect(p, x, 26, 3, 160, '#bdb8ae');
    for (let k = 0; k < 3; k++) rect(p, 10 + k * 50, 8, 30, 2.5, '#fffef4');
    rect(p, 18, H - 66, 114, 46, '#9a6b3e');
    for (let k = 0; k < 5; k++) rect(p, 22 + k * 22, H - 86, 19, 20, pick(p.r, PRODUCT));
    rect(p, 18, H - 66, 114, 4, 'rgba(255,255,255,0.25)');
  },
  drugstore(p) {
    room(p, '#f4f2ef', '#d8d4ce', '255,252,245', 2);
    shelves(p, [58, 98, 138, 178], '#ffffff');
    for (const y of [58, 98, 138, 178]) packets(p, 0, W, y, 14, 26, PASTEL, 4, 8);
    // A promo cube by the glass and a pink sale card.
    rect(p, 30, H - 58, 90, 38, '#ffffff'); rect(p, 30, H - 58, 90, 6, '#e8457a');
    packets(p, 34, 116, H - 58, 10, 18, PASTEL, 5, 9);
  },
  bread(p) {
    // A bakery: a warm wall of bread on tiered racks, a glass counter of cakes and pastries low down.
    room(p, '#d8a868', '#8a6038', '255,214,150', 3);
    vgrad(p, 0, 20, W, 140, [[0, '#c48a4a'], [1, '#b07838']]);
    shelves(p, [62, 100, 138], '#7a4e28');
    for (const [y, h] of [[62, 20], [100, 22], [138, 24]] as const) for (let x = 12; x < W - 8; x += 22 + p.r() * 6) loaf(p, x, y - h / 2 - 1, 20 + p.r() * 6, h, pick(p.r, ['#b8702c', '#a05a22', '#c9883e', '#8a4a1c']));
    // Counter: glass front, three tiers of cakes and tarts.
    rect(p, 6, 160, W - 12, 66, '#efe4d0');
    rect(p, 10, 164, W - 20, 56, 'rgba(255,248,232,0.85)');
    for (const y of [186, 210]) { rect(p, 10, y, W - 20, 2, '#cbb894'); for (let x = 18; x < W - 14; x += 24) { const k = p.r(); if (k < 0.5) { rect(p, x - 9, y - 12, 18, 12, pick(p.r, ['#f4e1c8', '#e8b8c8', '#6a3a22', '#f6efe0'])); rect(p, x - 9, y - 12, 18, 3, pick(p.r, ['#d23a4a', '#f2d36a', '#ffffff', '#7a3a1a'])); } else { oval(p, x, y - 5, 9, 5, pick(p.r, ['#d9a35a', '#c98a3a', '#e8c27a'])); } } }
    rect(p, 6, 226, W - 12, 4, '#cbb894');
  },
  butcher(p) {
    // A slagerij: white tiles, a lit refrigerated counter of red meat trays, sausages hanging on a rail behind.
    room(p, '#eef0ee', '#c9ccca', '250,252,255', 2);
    for (let y = 22; y < 150; y += 9) rect(p, 0, y, W, 0.8, 'rgba(120,130,130,0.35)');
    for (let x = 0; x < W; x += 9) rect(p, x, 22, 0.8, 128, 'rgba(120,130,130,0.25)');
    rect(p, 10, 44, W - 20, 2, '#9a9a96');
    for (let x = 16; x < W - 10; x += 9) { const l = 22 + p.r() * 16; round(p, x, 46, 5, l, 2.5, pick(p.r, ['#8a2a1e', '#a8442c', '#6e2418', '#c8785a'])); }
    rect(p, 6, 138, W - 12, 90, '#d9dcdb');
    rect(p, 10, 142, W - 20, 52, 'rgba(235,245,250,0.8)');
    for (let x = 14; x < W - 18; x += 22) { rect(p, x, 172, 19, 18, '#f6f6f2'); rect(p, x + 2, 174, 15, 14, pick(p.r, ['#b3262b', '#c84a4a', '#d9707a', '#9a2a22', '#e8a090'])); }
    for (let x = 14; x < W - 18; x += 22) { rect(p, x, 152, 19, 16, '#f6f6f2'); rect(p, x + 2, 154, 15, 12, pick(p.r, ['#b3262b', '#e3b6a0', '#c84a4a', '#f0d8c0'])); }
    rect(p, 6, 196, W - 12, 32, '#b9bcbd');
  },
  cheese(p) {
    // A kaaswinkel: wooden shelves stacked with wheels (yellow, orange, red and black wax), cut wedges in front.
    room(p, '#7a5532', '#4a3320', '255,220,160', 3);
    shelves(p, [70, 120, 170], '#5a3a1e');
    for (const y of [70, 120, 170]) for (let x = 6; x < W - 12;) {
      const r = 15 + p.r() * 5, col = pick(p.r, ['#f2c230', '#f2c230', '#e0a21c', '#c8262d', '#2a2a2a', '#e8b84a', '#7a9a3a']);
      oval(p, x + r, y - 7, r, 7, col); rect(p, x, y - 22, r * 2, 15, col); oval(p, x + r, y - 22, r, 7, shade(col, 1.15));
      if (p.r() < 0.5) { rect(p, x, y - 37, r * 2, 15, col); oval(p, x + r, y - 37, r, 7, shade(col, 1.15)); }
      x += r * 2 + 3;
    }
    rect(p, 0, 196, W, 34, '#6a4528');
    for (let x = 8; x < W - 20; x += 26) poly(p, [[x, 210], [x + 22, 210], [x + 22, 196]], pick(p.r, ['#f6d860', '#f2c230', '#ffe7a0']));
  },
  produce(p) {
    // Groente en fruit: tiered crates of fruit and vegetables under bright light.
    room(p, '#5a5148', '#3a332c', '255,240,210', 2);
    const fruit = ['#d8452f', '#f2b92e', '#7cb342', '#ee7f2c', '#3f8f4a', '#c0392b', '#f6e04a', '#7a2a5a', '#9cc24a'];
    for (let row = 0; row < 4; row++) {
      const y = 70 + row * 42, x0 = row * 3;
      for (let x = x0; x < W - 4; x += 36) {
        poly(p, [[x, y], [x + 34, y], [x + 32, y + 30], [x + 2, y + 30]], '#8a6038');
        const col = pick(p.r, fruit);
        for (let k = 0; k < 9; k++) oval(p, x + 5 + (k % 3) * 11 + p.r() * 2, y + 2 + Math.floor(k / 3) * 5 - 6, 6, 5.5, col);
        for (let k = 0; k < 3; k++) oval(p, x + 8 + k * 9, y - 6, 2, 1.5, 'rgba(255,255,255,0.35)');
      }
    }
  },
  flowers(p) {
    // A bloemist: buckets of colour in stepped rows, greenery behind.
    room(p, '#4a5a44', '#3a3a32', '255,244,220', 2);
    for (let k = 0; k < 18; k++) oval(p, p.r() * W, 30 + p.r() * 60, 14, 10, pick(p.r, ['#2f5a30', '#3d6b35', '#4f7a3a']));
    const blooms = ['#e85a8c', '#f2c21b', '#f4efe2', '#c8262d', '#8a4fb0', '#f08a2a', '#f7a8c4', '#ffffff', '#d62a5a'];
    for (let row = 0; row < 3; row++) {
      const y = 120 + row * 40;
      for (let x = 4 + row * 6; x < W - 10; x += 26) {
        const col = pick(p.r, blooms);
        for (let k = 0; k < 7; k++) oval(p, x + 11 + (p.r() - 0.5) * 18, y - 16 + (p.r() - 0.5) * 12, 4.5, 4.5, col);
        for (let k = 0; k < 3; k++) rect(p, x + 6 + k * 5, y - 10, 1.4, 14, '#3d6b35');
        poly(p, [[x + 2, y], [x + 22, y], [x + 20, y + 24], [x + 4, y + 24]], '#9aa2a6');
        rect(p, x + 2, y, 20, 2, '#c8ced2');
      }
    }
  },
  books(p) {
    // A bookshop: floor-to-ceiling shelves of spines, a table of face-out books at the glass.
    room(p, '#5a3a22', '#3a2616', '255,226,180', 3);
    shelves(p, [52, 88, 124, 160], '#4a2e18');
    const spines = ['#7a1f2b', '#1c3a5e', '#d6c7a1', '#2a6f6f', '#c9a227', '#3a3a3a', '#8a3b12', '#e8e2d2', '#4b2c5e', '#b8442c', '#f0ead8'];
    for (const y of [52, 88, 124, 160]) for (let x = 2; x < W - 3;) { const w = 3 + p.r() * 4, h = 22 + p.r() * 10; rect(p, x, y - h, w, h, pick(p.r, spines)); x += w + 0.5; if (p.r() < 0.06) x += 8; }
    rect(p, 6, 188, W - 12, 6, '#6a4528'); rect(p, 12, 194, 6, 36, '#4a2e18'); rect(p, W - 18, 194, 6, 36, '#4a2e18');
    for (let x = 10; x < W - 20; x += 23) { round(p, x, 168, 20, 20, 1, pick(p.r, ['#e8e2d2', '#c9a227', '#1c3a5e', '#b8442c', '#f4efe2', '#2a6f6f'])); rect(p, x + 3, 172, 14, 3, 'rgba(0,0,0,0.4)'); }
  },
  phones(p) {
    // A telefoonwinkel: a pegboard wall of phone cases and cables, a lit counter.
    room(p, '#e8e8e8', '#9a9a9a', '255,255,255', 2);
    rect(p, 6, 26, W - 12, 150, '#d9d9d9');
    for (let y = 30; y < 172; y += 5) for (let x = 10; x < W - 10; x += 5) rect(p, x, y, 1, 1, 'rgba(0,0,0,0.25)');
    const cases = ['#1d1d1b', '#e8457a', '#2f6fb0', '#f2b92e', '#ffffff', '#3f8f4a', '#c0392b', '#8a4fb0', '#7ad0e8'];
    for (let y = 34; y < 160; y += 30) for (let x = 12; x < W - 18; x += 17) { rect(p, x + 5, y - 2, 2, 4, '#777'); round(p, x, y + 2, 13, 24, 3, '#f4f4f4'); round(p, x + 2, y + 4, 9, 18, 2, pick(p.r, cases)); }
    rect(p, 6, 186, W - 12, 44, '#2a2a2a'); rect(p, 6, 186, W - 12, 4, '#ffdd00');
    for (let x = 16; x < W - 20; x += 30) round(p, x, 192, 14, 26, 2, '#111');
  },
  gelato(p) {
    // An ijssalon: a curved glass counter of coloured tubs, a menu board above.
    room(p, '#f6e9ec', '#cdb9be', '255,248,250', 2);
    menuBoard(p, 12, 30, W - 24, 46, '#f6b6c8', '#5a2340', 4, ['#f4e3a0', '#f6c6d8', '#c8e8a0', '#7a4a22']);
    rect(p, 4, 132, W - 8, 98, '#e9e2e4');
    vgrad(p, 8, 136, W - 16, 30, [[0, 'rgba(255,255,255,0.7)'], [1, 'rgba(255,255,255,0.15)']]);
    const flavours = ['#f6efe0', '#f4c6d6', '#7a4a22', '#f2d36a', '#9cd06a', '#e85a5a', '#f7a8c4', '#c8a07a', '#4a2a1a', '#f6e4a8', '#7ad0e8', '#ffffff'];
    for (const y of [168, 196]) for (let x = 10; x < W - 20; x += 22) { rect(p, x, y, 20, 22, '#c0c4c6'); oval(p, x + 10, y + 2, 10, 6, pick(p.r, flavours)); rect(p, x, y + 2, 20, 10, 'rgba(0,0,0,0)'); }
  },
  waffles(p) {
    // A wafel/stroopwafel shop: plates of waffles with toppings stacked on tiers, a pink menu board.
    room(p, '#ffe3ef', '#c48a9a', '255,240,246', 2);
    menuBoard(p, 10, 26, W - 20, 54, '#ff6fa8', '#ffffff', 3, ['#c98a3a', '#e85a8c', '#7a3b1a']);
    shelves(p, [128, 172], '#ffffff');
    for (const y of [128, 172]) for (let x = 8; x < W - 20; x += 28) {
      oval(p, x + 12, y - 4, 13, 4, '#ffffff');
      rect(p, x + 2, y - 18, 20, 14, '#d9a050');
      for (let k = 0; k < 4; k++) rect(p, x + 3 + k * 5, y - 18, 1, 14, 'rgba(120,70,20,0.5)');
      oval(p, x + 12, y - 18, 10, 4, pick(p.r, ['#e85a8c', '#7a3b1a', '#ffffff', '#c8262d', '#f2d36a']));
    }
    rect(p, 4, 196, W - 8, 34, '#f2f2f2');
  },
  doner(p) {
    // A doner/shoarma takeaway: the turning spit behind the counter, lit photo menu panels overhead.
    room(p, '#f1e6cf', '#9a8a70', '255,240,210', 2);
    menuBoard(p, 6, 22, W - 12, 58, '#1d1d1b', '#f6e27a', 3, ['#c8782f', '#a8422a', '#e8d090', '#6a8a3a']);
    rect(p, 54, 88, 4, 90, '#888');
    poly(p, [[40, 96], [72, 96], [66, 168], [46, 168]], '#a8642a');
    for (let y = 100; y < 166; y += 7) rect(p, 44 + (y - 96) * 0.08, y, 26 - (y - 96) * 0.16, 2, 'rgba(70,30,10,0.45)');
    rect(p, 78, 92, 28, 82, '#b03024'); for (let y = 98; y < 170; y += 10) rect(p, 80, y, 24, 4, '#f08a2a');
    rect(p, 4, 178, W - 8, 52, '#c9ccce'); rect(p, 4, 178, W - 8, 5, '#e8eaea');
    for (let x = 12; x < W - 20; x += 20) rect(p, x, 186, 16, 10, pick(p.r, ['#e04a2a', '#f2e8d0', '#7aa83a', '#f2c230', '#c84a2a']));
  },
  souvenirs(p) {
    // A souvenir shop: racks of clogs (yellow and painted), a tulip bucket, Amsterdam tees on a rail, magnet boards.
    room(p, '#f0ebe0', '#a89c88', '255,250,236', 2);
    rail(p, 6, W - 6, 26, ['#c4161c', '#ffffff', '#1d1d1b', '#f08a2a', '#1f4f9c'], 46);
    for (let x = 14; x < W - 16; x += 28) { rect(p, x, 46, 20, 4, '#ffffff'); poly(p, [[x + 4, 50], [x + 16, 50], [x + 14, 60], [x + 6, 60]], '#c4161c'); }
    shelves(p, [112, 150, 188], '#c8b89a');
    for (const y of [112, 150, 188]) for (let x = 6; x < W - 20; x += 19) {
      const col = pick(p.r, ['#f2c21b', '#f2c21b', '#ffffff', '#1f4f9c', '#c4161c', '#f08a2a']);
      oval(p, x + 8, y - 6, 9, 5.5, col); poly(p, [[x, y - 6], [x + 6, y - 14], [x + 12, y - 14], [x + 17, y - 6]], col); oval(p, x + 11, y - 12, 3.5, 2.5, 'rgba(40,30,20,0.6)');
    }
    // Tulips in a bucket at the glass.
    for (let k = 0; k < 14; k++) { const x = 100 + (p.r() - 0.5) * 34, y = 196 + (p.r() - 0.5) * 16; rect(p, x, y, 1.4, 22, '#3d6b35'); oval(p, x + 0.7, y, 3.6, 5, pick(p.r, ['#e8243a', '#f2c21b', '#ff7a2a', '#f4a8c4', '#ffffff'])); }
    poly(p, [[84, 214], [118, 214], [114, 230], [88, 230]], '#9aa2a6');
  },
  tobacco(p) {
    // A sigarenwinkel: the cigarette wall behind the counter, lottery cards and placards on the glass.
    room(p, '#3a332c', '#26201a', '255,226,180', 2);
    rect(p, 8, 30, W - 16, 96, '#5a4a3a');
    for (let y = 34; y < 120; y += 12) for (let x = 12; x < W - 14; x += 9) rect(p, x, y, 7, 9, pick(p.r, ['#f4efe2', '#d9302f', '#1a3a8f', '#c9a227', '#1d1d1b', '#2f7d32', '#e8e2d2', '#7a1f2b']));
    rect(p, 4, 160, W - 8, 70, '#6a4a32'); rect(p, 4, 160, W - 8, 5, '#8a6a4a');
    // The lottery panel: blue with a yellow band and a red ball.
    round(p, 14, 130, 54, 40, 3, '#1a3a8f'); rect(p, 14, 144, 54, 10, '#ffd200'); oval(p, 30, 138, 5, 5, '#e8243a'); oval(p, 50, 138, 5, 5, '#ffffff');
    round(p, 84, 136, 46, 34, 3, '#ffd200'); rect(p, 88, 142, 38, 6, '#c4161c'); rect(p, 88, 154, 30, 4, '#1d1d1b');
    for (let k = 0; k < 6; k++) rect(p, 10 + k * 22, 200, 18, 26, pick(p.r, ['#d9302f', '#1a3a8f', '#ffd200', '#f4efe2', '#2f7d32']));
  },
  exchange(p) {
    // A wisselkantoor: the rates board (flags and LED figures in rows on black), a counter with glass.
    room(p, '#d9dde0', '#8a9094', '245,250,255', 2);
    rect(p, 8, 24, W - 16, 120, '#101418');
    const flags = [['#b22234', '#ffffff', '#3c3b6e'], ['#012169', '#ffffff', '#c8102e'], ['#003399', '#ffcc00', '#003399'], ['#d52b1e', '#ffffff', '#d52b1e'], ['#000000', '#dd0000', '#ffce00'], ['#bc002d', '#ffffff', '#bc002d']];
    for (let k = 0; k < 7; k++) {
      const y = 30 + k * 16, f = flags[k % flags.length];
      rect(p, 12, y, 16, 4, f[0]); rect(p, 12, y + 4, 16, 4, f[1]); rect(p, 12, y + 8, 16, 4, f[2]);
      for (let d = 0; d < 4; d++) rect(p, 40 + d * 9, y + 1, 7, 10, '#ff3a2a');
      for (let d = 0; d < 4; d++) rect(p, 90 + d * 9, y + 1, 7, 10, '#3aff6a');
    }
    rect(p, 4, 168, W - 8, 62, '#2a3a5a'); rect(p, 10, 150, W - 20, 18, 'rgba(220,235,245,0.6)');
  },
  bikes(p) {
    // A fietsenwinkel: bikes standing in rows inside, wheels hung on the wall, a workbench light.
    room(p, '#cfd2d2', '#6a6c6c', '250,250,245', 2);
    for (let k = 0; k < 5; k++) { const x = 16 + k * 28; p.c.lineWidth = 2.5; p.c.strokeStyle = '#2a2a2a'; p.c.beginPath(); p.c.arc(x, 52, 11, 0, Math.PI * 2); p.c.stroke(); }
    const frames = ['#1c1c1c', '#2f5d8a', '#7a1f2b', '#e8e2d2', '#2f5d3a', '#c9a227'];
    bike(p, 6, 172, 1, pick(p.r, frames)); bike(p, 40, 186, 1.05, pick(p.r, frames)); bike(p, 70, 200, 1.12, pick(p.r, frames)); bike(p, 2, 230, 1.2, pick(p.r, frames));
  },
  coffeeshop(p) {
    // A coffeeshop: dim, warm, painted inside, plants in the window, low lamps over a counter.
    if (p.room) room(p, '', ''); else { rect(p, 0, 0, W, H, '#1d241e'); vgrad(p, 0, 0, W, H, [[0, '#2a3628'], [0.6, '#1a2018'], [1, '#121510']]); }
    for (const x of [30, 90, 130]) { rect(p, x, 0, 1, 60, '#111'); glow(p, x, 64, 28, '255,170,90', 0.55); oval(p, x, 62, 8, 4, '#ffb060'); }
    rect(p, 0, 150, W, 18, '#3a2a1a');
    for (let k = 0; k < 4; k++) { const x = 18 + k * 38; poly(p, [[x - 12, 230], [x + 12, 230], [x + 9, 206], [x - 9, 206]], '#6a4a2a');
      for (let l = 0; l < 9; l++) { const a = -Math.PI / 2 + (l - 4) * 0.32; poly(p, [[x, 206], [x + Math.cos(a - 0.12) * 30, 206 + Math.sin(a - 0.12) * 30], [x + Math.cos(a) * 42, 206 + Math.sin(a) * 42], [x + Math.cos(a + 0.12) * 30, 206 + Math.sin(a + 0.12) * 30]], l % 2 ? '#3f7a3a' : '#2f6a2e'); } }
  },
  smartshop(p) {
    // A smartshop/headshop: dark, lit glass cabinets with coloured jars and pipes, a neon line.
    if (p.room) room(p, '', ''); else rect(p, 0, 0, W, H, '#140f1e');
    for (const [y, c] of [[30, '#ff4fd8'], [40, '#3fe0ff']] as const) { rect(p, 10, y, W - 20, 2.5, c); glow(p, W / 2, y, 60, c === '#ff4fd8' ? '255,79,216' : '63,224,255', 0.18); }
    for (const x0 of [6, 78]) { rect(p, x0, 60, 66, 150, '#2a2238'); vgrad(p, x0 + 2, 62, 62, 146, [[0, 'rgba(180,220,255,0.25)'], [1, 'rgba(180,220,255,0.05)']]);
      for (const y of [96, 132, 168, 204]) { rect(p, x0 + 2, y, 62, 2, '#cfe8ff'); for (let x = x0 + 5; x < x0 + 60; x += 9) { const h = 10 + p.r() * 14; round(p, x, y - h, 6, h, 2, pick(p.r, ['#9dff4f', '#ff4fd8', '#3fe0ff', '#ffb13f', '#c08aff', '#ffffff'])); } } }
  },
  clothing(p) {
    // A clothes shop: two mannequins at the glass, racks of garments and folded stacks behind.
    room(p, '#ece8e2', '#b8b0a6', '255,248,236', 3);
    rail(p, 0, W, 40, ['#1d1d1b', '#e8e2d2', '#8a8f96', '#2f4a6a', '#a83a3a', '#d6c7a1', '#5a6a4a'], 70);
    shelves(p, [150], '#ffffff', 0, W);
    for (let x = 4; x < W - 10; x += 16) for (let k = 0; k < 3; k++) rect(p, x, 144 - k * 6, 14, 5, pick(p.r, ['#e8e2d2', '#1d1d1b', '#2f4a6a', '#a8a29a', '#c9a0a0']));
    mannequin(p, 40, 238, 1, pick(p.r, ['#1d1d1b', '#7a1f2b', '#2f4a6a', '#c9b79a'])); mannequin(p, 108, 238, 0.95, pick(p.r, ['#e8e2d2', '#5a6a4a', '#a83a3a', '#1d1d1b']));
  },
  magazines(p) {
    // A Bruna/kiosk: magazine racks face-out in rows of bright covers, a card stand.
    room(p, '#f2f0ea', '#b8b4aa', '255,252,240', 2);
    const covers = ['#d9302f', '#1f4f9c', '#f2b92e', '#ffffff', '#1d1d1b', '#e8457a', '#3f8f4a', '#f08a2a', '#7ad0e8'];
    for (let row = 0; row < 5; row++) { const y = 30 + row * 38; rect(p, 0, y + 30, W, 3, '#c8c4bc');
      for (let x = 3; x < W - 16; x += 19) { rect(p, x, y, 17, 30, pick(p.r, covers)); rect(p, x + 2, y + 2, 13, 5, 'rgba(255,255,255,0.75)'); rect(p, x + 2, y + 10, 9, 13, 'rgba(0,0,0,0.18)'); } }
    rect(p, 0, 226, W, 4, '#0a3d91');
  },
  ducks(p) {
    room(p, '#fff6d0', '#d8c890', '255,250,220', 2);
    shelves(p, [60, 100, 140, 180, 220], '#ffffff');
    for (const y of [60, 100, 140, 180, 220]) for (let x = 6; x < W - 10; x += 15) { const col = p.r() < 0.8 ? '#ffd21f' : pick(p.r, ['#ff8a1f', '#e8457a', '#2f6fb0', '#ffffff', '#1d1d1b']);
      oval(p, x + 6, y - 7, 7, 6, col); oval(p, x + 9, y - 16, 4.5, 4.5, col); poly(p, [[x + 12, y - 16], [x + 16, y - 15], [x + 12, y - 13]], '#ff7a1a'); oval(p, x + 10, y - 17, 0.9, 0.9, '#111'); }
  },
  deli(p) {
    // A deli/café counter (Stach): cakes and sandwiches in a glass counter, a chalkboard, shelves of jars.
    room(p, '#e9e2d4', '#8a7a62', '255,236,200', 3);
    rect(p, 12, 26, 60, 50, '#2a2a28'); for (let y = 34; y < 72; y += 6) rect(p, 18, y, 30 + p.r() * 18, 2, '#e8e2d2');
    shelves(p, [74, 108], '#6a4a2a', 80, W);
    for (const y of [74, 108]) for (let x = 84; x < W - 8; x += 11) { round(p, x, y - 16, 9, 16, 2, pick(p.r, ['#c8462a', '#f2c230', '#6a8a3a', '#e8e2d2', '#7a3a1a'])); rect(p, x, y - 18, 9, 3, '#d9d4c7'); }
    rect(p, 4, 140, W - 8, 90, '#cfc8b8'); rect(p, 8, 144, W - 16, 50, 'rgba(250,246,236,0.85)');
    for (const y of [166, 190]) for (let x = 12; x < W - 16; x += 22) { rect(p, x, y - 12, 18, 12, pick(p.r, ['#e8c27a', '#c9883e', '#f4e1c8', '#6a8a3a', '#7a3a1a', '#f6efe0'])); rect(p, x, y - 12, 18, 3, pick(p.r, ['#ffffff', '#c8262d', '#7aa83a'])); }
  },
  bowls(p) {
    // A salad bar (SLA): white and pale wood, green bowls on the counter, plants on shelves.
    room(p, '#f4f6ef', '#d8cfb8', '255,252,240', 3);
    shelves(p, [70, 110], '#d8c09a');
    for (const y of [70, 110]) for (let x = 8; x < W - 14; x += 22) { poly(p, [[x, y - 14], [x + 14, y - 14], [x + 12, y], [x + 2, y]], '#ffffff'); oval(p, x + 7, y - 18, 9, 7, pick(p.r, ['#3f8f4a', '#6aa84f', '#2f6a2e', '#9cc24a'])); }
    rect(p, 4, 150, W - 8, 80, '#e8dcc0'); rect(p, 4, 150, W - 8, 5, '#c8b28a');
    for (let x = 12; x < W - 22; x += 26) { oval(p, x + 11, 174, 13, 6, '#ffffff'); oval(p, x + 11, 172, 11, 4.5, pick(p.r, ['#3f8f4a', '#6aa84f', '#e8a23a', '#c8462a', '#9cc24a'])); }
  },
  automatiek(p) {
    // FEBO's automatiek: a wall of small heated doors in steel, every one lit warm with a snack in it.
    rect(p, 0, 0, W, H, '#b7b9b8');
    const cols = 4, rows = 7, cw = (W - 8) / cols, ch = (H - 30) / rows;
    for (let c = 0; c < cols; c++) for (let r = 0; r < rows; r++) {
      const x = 4 + c * cw, y = 4 + r * ch; rect(p, x + 2, y + 2, cw - 4, ch - 4, '#8a8c8c');
      rect(p, x + 4, y + 4, cw - 8, ch - 8, p.r() < 0.85 ? '#ffd27a' : '#e8a23a');
      oval(p, x + cw / 2, y + ch * 0.62, cw * 0.28, ch * 0.16, pick(p.r, ['#c8782f', '#b8602a', '#e0a050']));
      rect(p, x + cw - 9, y + ch / 2 - 3, 3, 6, '#555');
    }
    rect(p, 0, H - 26, W, 26, '#d9302f');
  },
  fastfood(p) {
    // A fast-food counter: a row of lit photo menu screens, the steel counter and the kitchen glow behind.
    room(p, '#3a2e2a', '#2a2422', '255,240,220', 2);
    for (let k = 0; k < 3; k++) menuBoard(p, 6 + k * 47, 24, 44, 60, '#2b2422', '#ffffff', 1, ['#e8a23a', '#c8462a', '#f2c230']);
    rect(p, 0, 92, W, 70, '#7a6a5a'); for (let x = 6; x < W; x += 24) rect(p, x, 100, 18, 40, '#c8c4bc');
    rect(p, 0, 162, W, 68, '#d6d2cc'); rect(p, 0, 162, W, 6, '#ffbc0d');
    for (let x = 14; x < W - 14; x += 40) { rect(p, x, 150, 22, 12, '#c8262d'); rect(p, x + 2, 144, 18, 6, '#f2c230'); }
  },
  bainMarie(p) {
    // A toko/Surinamese takeaway: the bain-marie of trays under heat lamps, a menu board, posters.
    room(p, '#e9d9b4', '#9a8862', '255,232,190', 2);
    menuBoard(p, 8, 26, W - 16, 52, '#fff6d8', '#7a1f12', 0);
    rect(p, 4, 140, W - 8, 90, '#b9bcbd'); rect(p, 8, 144, W - 16, 30, 'rgba(240,248,250,0.7)');
    for (let x = 10; x < W - 20; x += 22) { rect(p, x, 176, 20, 16, '#9a9ea0'); rect(p, x + 2, 178, 16, 10, pick(p.r, ['#d9822b', '#b4482a', '#e8c070', '#6a8a3a', '#f4e0b0', '#8a3a1a'])); glow(p, x + 10, 150, 16, '255,140,60', 0.35); }
  },
  jars(p) {
    // A notenbar: rows of glass bins of nuts, dried fruit and sweets, lit warm.
    room(p, '#f4efe2', '#a89878', '255,236,190', 3);
    const nuts = ['#b07a3c', '#d9a35a', '#7a4a22', '#e8c27a', '#9c2f2f', '#5f7d2a', '#c46a2a', '#e85a8c', '#f2d36a'];
    for (let row = 0; row < 5; row++) { const y = 40 + row * 38; rect(p, 0, y + 30, W, 4, '#d8c8a8');
      for (let x = 4; x < W - 20; x += 24) { rect(p, x, y, 21, 30, 'rgba(220,232,236,0.75)'); rect(p, x + 2, y + 10, 17, 19, pick(p.r, nuts)); for (let k = 0; k < 5; k++) oval(p, x + 4 + p.r() * 13, y + 12 + p.r() * 14, 1.6, 1.2, 'rgba(255,240,200,0.45)'); } }
  },
  liquor(p) {
    // Gall & Gall / a slijterij: dark wood shelves of bottles, labels catching the light.
    room(p, '#3a2a22', '#241a14', '255,224,170', 3);
    shelves(p, [70, 116, 162, 208], '#5a3e2a');
    for (const y of [70, 116, 162, 208]) for (let x = 6; x < W - 6; x += 10 + p.r() * 2) bottle(p, x, y, 32 + p.r() * 8, pick(p.r, ['#2f5a2a', '#6a3a1a', '#e8e0c0', '#3a1a12', '#a8642a', '#1f3a5a', '#c8b07a']), pick(p.r, ['#f4efe2', '#e8d090', '#c8262d', '#1d1d1b', '#ffffff']));
  },
  hair(p) {
    // A kapper/barber: mirrors over a counter, salon chairs, a pendant light row.
    room(p, '#2e2c2a', '#1e1c1a', '255,236,210', 3);
    for (const x of [8, 78]) { rect(p, x, 40, 64, 80, '#7d878e'); vgrad(p, x + 3, 43, 58, 74, [[0, 'rgba(255,255,255,0.35)'], [1, 'rgba(255,255,255,0.05)']]); glow(p, x + 32, 40, 30, '255,230,190', 0.35); }
    rect(p, 0, 124, W, 10, '#c8b89a');
    for (const x of [40, 110]) { round(p, x - 18, 148, 36, 34, 6, '#1d1d1b'); rect(p, x - 22, 176, 44, 10, '#2a2a2a'); rect(p, x - 2, 186, 4, 30, '#888'); oval(p, x, 220, 16, 4, '#555'); round(p, x - 15, 120, 30, 30, 6, '#2a2a2a'); }
  },
  pharmacy(p) {
    // An apotheek: white shelves of boxed medicines in blues and greens, a counter, a green-cross light.
    room(p, '#f4f6f6', '#c8d0d0', '250,255,255', 2);
    shelves(p, [56, 92, 128], '#ffffff');
    for (const y of [56, 92, 128]) packets(p, 0, W, y, 14, 22, ['#ffffff', '#cfe4f0', '#3a7ab8', '#e8f0e8', '#3e8a5a', '#f2f2f2', '#e8457a'], 5, 9);
    rect(p, 4, 160, W - 8, 70, '#e8ecec'); rect(p, 4, 160, W - 8, 4, '#3e6254');
    rect(p, 64, 176, 22, 8, '#3e8a5a'); rect(p, 71, 169, 8, 22, '#3e8a5a');
  },
  frites(p) {
    // A friterie: the fryer counter, cones of fries, a yellow-and-red menu.
    room(p, '#f7e7b0', '#a8946a', '255,244,200', 2);
    menuBoard(p, 8, 24, W - 16, 56, '#f7c600', '#c4161c', 2, ['#f2c230', '#e8a23a']);
    rect(p, 4, 150, W - 8, 80, '#c9ccce'); rect(p, 4, 150, W - 8, 5, '#e8eaea');
    for (let x = 16; x < W - 20; x += 30) { poly(p, [[x, 150], [x + 18, 150], [x + 9, 174]], '#f4efe2'); for (let k = 0; k < 6; k++) rect(p, x + 2 + k * 2.6, 134 + p.r() * 6, 2, 18, '#f2c230'); }
    rect(p, 14, 186, 50, 30, '#8a8c8e'); rect(p, 80, 186, 50, 30, '#8a8c8e'); glow(p, 40, 200, 22, '255,200,80', 0.4); glow(p, 106, 200, 22, '255,200,80', 0.4);
  },
  cafe(p) {
    // A café: tables and chairs inside, pendant lamps, a bar with a coffee machine at the back.
    room(p, '#c8a882', '#6a4a30', '255,214,150', 3);
    rect(p, 0, 90, W, 50, '#7a5a3a'); for (let x = 8; x < W; x += 14) bottle(p, x, 104, 14, pick(p.r, ['#2f5a2a', '#6a3a1a', '#e8e0c0']), '#f4efe2');
    rect(p, 50, 106, 40, 30, '#9a9ea0');
    for (const x of [30, 75, 120]) { rect(p, x, 0, 1, 52, '#222'); poly(p, [[x - 9, 60], [x + 9, 60], [x + 5, 50], [x - 5, 50]], '#2a2a2a'); glow(p, x, 64, 26, '255,190,110', 0.55); }
    for (const x of [36, 110]) { oval(p, x, 190, 26, 6, '#5a3a22'); rect(p, x - 2, 190, 4, 34, '#2a2a2a'); round(p, x - 34, 176, 10, 40, 2, '#2a1a10'); round(p, x + 24, 176, 10, 40, 2, '#2a1a10'); oval(p, x - 6, 185, 4, 2.5, '#ffffff'); oval(p, x + 8, 185, 4, 2.5, '#ffffff'); }
  },
  optician(p) {
    // An opticien: rows of frames on white glass shelves, a lit wall, a face poster.
    room(p, '#f2f2f0', '#c8c8c4', '255,255,250', 2);
    round(p, 92, 30, 46, 64, 2, '#d9c8b8'); oval(p, 115, 58, 13, 16, '#c8a890'); rect(p, 103, 54, 24, 4, '#1d1d1b');
    for (let row = 0; row < 6; row++) { const y = 104 + row * 20; rect(p, 6, y + 7, W - 12, 1.5, 'rgba(180,200,210,0.9)');
      for (let x = 10; x < W - 22; x += 24) { const col = pick(p.r, ['#1d1d1b', '#8a4a22', '#2f4a6a', '#c8262d', '#9a9a9a', '#6a3a1a']); p.c.lineWidth = 1.6; p.c.strokeStyle = col; for (const dx of [0, 10]) { p.c.beginPath(); p.c.ellipse(x + 5 + dx, y + 2, 4.5, 3.5, 0, 0, Math.PI * 2); p.c.stroke(); } rect(p, x + 9, y + 1, 2, 1.4, col); } }
  },
  shoes(p) {
    // A shoe shop: wall shelves of single shoes in profile, a bench and a display at the glass.
    room(p, '#ece6dc', '#a89a88', '255,246,230', 3);
    shelves(p, [60, 96, 132, 168], '#ffffff');
    for (const y of [60, 96, 132, 168]) for (let x = 6; x < W - 20; x += 24) { const col = pick(p.r, ['#1d1d1b', '#8a4a22', '#e8e2d2', '#c8262d', '#2f4a6a', '#c9a07a', '#ffffff']);
      poly(p, [[x, y], [x + 19, y], [x + 19, y - 5], [x + 9, y - 8], [x + 6, y - 15], [x, y - 15]], col); rect(p, x, y - 2, 19, 2, 'rgba(0,0,0,0.35)'); }
    rect(p, 20, 196, 110, 14, '#6a4a32'); rect(p, 26, 210, 6, 20, '#4a3424'); rect(p, 118, 210, 6, 20, '#4a3424');
  },
  cosmetics(p) {
    // A cosmetics/beauty chain: lit tester units with rows of small bottles and jars, warm and polished.
    room(p, '#2a2624', '#1a1816', '255,226,190', 3);
    for (const x0 of [4, 78]) { rect(p, x0, 34, 68, 150, '#ece4d8'); glow(p, x0 + 34, 60, 40, '255,240,220', 0.3);
      for (const y of [70, 104, 138, 172]) { rect(p, x0 + 2, y, 64, 3, '#c8b89a'); for (let x = x0 + 5; x < x0 + 62; x += 8) { const h = 10 + p.r() * 12; round(p, x, y - h, 6, h, 1.5, pick(p.r, ['#e8d8c0', '#c9a07a', '#1d1d1b', '#d4af37', '#ffffff', '#b8a8c8', '#e8b8c8'])); } } }
    rect(p, 0, 196, W, 34, '#3a3430');
  },
  pancakes(p) {
    // A pannenkoekenhuis: warm wooden room, checked half-curtains, plates of pancakes on tables.
    room(p, '#a8682a', '#5a3a1e', '255,200,130', 3);
    for (let y = 30; y < 120; y += 12) rect(p, 0, y, W, 1.2, 'rgba(60,30,10,0.35)');
    for (const x of [30, 90]) { for (let k = 0; k < 3; k++) { oval(p, x + k * 16, 70, 7, 7, '#7a4a22'); } }
    rect(p, 0, 128, W, 102, '#e8e2d2');
    for (let y = 128; y < 230; y += 12) for (let x = 0; x < W; x += 12) if (((x + y) / 12) % 2) rect(p, x, y, 12, 12, '#b8302a');
    for (let k = 0; k < 5; k++) rect(p, k * 32, 128, 2.5, 102, '#3a2010');
  },
  brownBar(p) {
    // A bruin café by day: dark wood, a bar with bottles on a lit back shelf, globe lamps, a figure or two at the bar.
    if (p.room) room(p, '', ''); else { rect(p, 0, 0, W, H, '#2a1a10'); vgrad(p, 0, 0, W, H, [[0, '#3a2414'], [0.5, '#24160c'], [1, '#160d07']]); }
    rect(p, 0, 70, W, 56, '#3a2412'); glow(p, W * 0.5, 96, 70, '255,170,90', 0.28);
    shelves(p, [96, 122], '#6a4a2a');
    for (const y of [96, 122]) for (let x = 6; x < W - 6; x += 9) bottle(p, x, y, 20 + p.r() * 4, pick(p.r, ['#2f5a2a', '#6a3a1a', '#c8a050', '#3a1a12', '#a8642a']), pick(p.r, ['#f4efe2', '#e8d090', '#c8262d']));
    for (const x of [30, 120]) { rect(p, x, 0, 1, 34, '#111'); oval(p, x, 40, 8, 8, '#ffd8a0'); glow(p, x, 40, 30, '255,190,110', 0.6); }
    rect(p, 0, 150, W, 16, '#5a3a1e'); rect(p, 0, 166, W, 64, '#2e1c10');
    for (const x of [44, 96]) { oval(p, x, 132, 7, 8, '#1a120c'); poly(p, [[x - 11, 140], [x + 11, 140], [x + 13, 168], [x - 13, 168]], '#1e140e'); }
  },
  redWindow(p) {
    // A raamprostitutie window (coordinator 2026-11-15, De Wallen): a small room lit red through a glass door, a velvet
    // curtain drawn to one side, a stool and a mirror; never a figure.
    rect(p, 0, 0, W, H, '#6a0a18');
    vgrad(p, 0, 0, W, H, [[0, '#a0102a'], [0.55, '#c8183a'], [1, '#5a0814']]);
    glow(p, W * 0.55, H * 0.35, 90, '255,80,120', 0.45);
    rect(p, 20, 46, 50, 70, '#3a0610'); rect(p, 24, 50, 42, 62, 'rgba(255,170,190,0.35)');
    rect(p, 0, H - 30, W, 30, '#3a0610');
    round(p, 84, 170, 36, 10, 4, '#2a0408'); rect(p, 100, 180, 4, 44, '#1a0204'); oval(p, 102, 226, 14, 3, '#1a0204');
    // The curtain: heavy folds from the head down one side.
    for (let k = 0; k < 6; k++) poly(p, [[k * 8, 0], [k * 8 + 9, 0], [k * 8 + 6 + (k % 2) * 3, H], [k * 8 - 2, H]], k % 2 ? '#4a0614' : '#5e0a1c');
    rect(p, 0, 0, W, 6, '#2a0208');
  },
  tattoo(p) {
    // A tattoo studio: a dark room, the wall covered in framed flash sheets, a neon sign, the chair under a lamp.
    if (p.room) room(p, '', ''); else { rect(p, 0, 0, W, H, '#1c1a1a'); vgrad(p, 0, 0, W, H, [[0, '#2a2626'], [1, '#121010']]); }
    for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) { const x = 6 + c * 36, y = 24 + r * 40; rect(p, x, y, 32, 36, '#0e0c0c'); rect(p, x + 2, y + 2, 28, 32, '#efe6cf');
      for (let k = 0; k < 3; k++) oval(p, x + 8 + p.r() * 16, y + 8 + p.r() * 20, 3 + p.r() * 3, 3 + p.r() * 3, pick(p.r, ['#c8262d', '#1d1d1b', '#2f6fb0', '#f2b92e', '#3f8f4a'])); }
    rect(p, 24, 150, 100, 3, '#ff4f7a'); glow(p, 74, 152, 60, '255,79,122', 0.35); rect(p, 40, 158, 70, 3, '#3fe0ff'); glow(p, 74, 160, 50, '63,224,255', 0.25);
    round(p, 50, 190, 54, 16, 5, '#2a2a2a'); rect(p, 74, 206, 6, 24, '#555'); glow(p, 110, 180, 30, '255,240,210', 0.4);
  },
  pizza(p) {
    // A pizzeria/pizza takeaway: the oven glow at the back, a counter with pizza boxes, a red menu board.
    room(p, '#e9dcc8', '#7a6a58', '255,230,190', 2);
    menuBoard(p, 8, 24, W - 16, 50, '#c4161c', '#ffffff', 2, ['#e8a23a', '#c8462a']);
    round(p, 30, 90, 90, 56, 26, '#8a8682'); oval(p, 75, 128, 26, 12, '#1a0a04'); glow(p, 75, 128, 30, '255,120,40', 0.7);
    rect(p, 4, 162, W - 8, 68, '#3a6a3a'); rect(p, 4, 162, W - 8, 5, '#ffffff');
    for (let k = 0; k < 4; k++) rect(p, 14, 150 - k * 6, 50, 5, '#f4efe2');
  },
};

function shade(hex: string, k: number): string {
  const n = parseInt(hex.slice(1), 16);
  return '#' + [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(v => Math.max(0, Math.min(255, Math.round(k > 1 ? v + (255 - v) * (k - 1) : v * k)))).map(v => v.toString(16).padStart(2, '0')).join('');
}

/**
 * The glass over a painted interior: shop glass by day reads darker than the room (round 3b measured the photos' ground
 * storey at L 0.37), with the street's reflection over the upper part and a soft diagonal streak. `lit` rooms (a
 * supermarket, a bakery) keep more of their light.
 */
function glassOver(p: P, lit: number): void {
  const c = p.c;
  c.fillStyle = `rgba(22,18,14,${(0.5 - 0.3 * lit).toFixed(3)})`; c.fillRect(0, 0, W, H);
  vgrad(p, 0, 0, W, H * 0.4, [[0, 'rgba(150,164,174,0.55)'], [0.5, 'rgba(140,154,164,0.25)'], [1, 'rgba(150,164,174,0)']]);
  poly(p, [[W * 0.58, 0], [W * 0.78, 0], [W * 0.38, H], [W * 0.18, H]], 'rgba(214,222,228,0.08)');
  // The frame's shadow along the head and one side: the glass sits back in its frame.
  vgrad(p, 0, 0, W, 10, [[0, 'rgba(0,0,0,0.45)'], [1, 'rgba(0,0,0,0)']]);
}

/** How lit each kind's room reads through the glass (0 dim .. 1 bright). */
const LIT: Partial<Record<GoodsKind, number>> = {
  aisles: 0.9, drugstore: 0.9, pharmacy: 0.85, phones: 0.8, gelato: 0.8, waffles: 0.75, magazines: 0.8, ducks: 0.8, exchange: 0.7,
  automatiek: 1, fastfood: 0.7, bowls: 0.75, optician: 0.85, bread: 0.7, butcher: 0.8, frites: 0.75, bainMarie: 0.7, doner: 0.7,
  coffeeshop: 0.2, smartshop: 0.35, redWindow: 1, tattoo: 0.3, brownBar: 0.25, liquor: 0.45, cosmetics: 0.5, hair: 0.8, books: 0.55, cheese: 0.6, pancakes: 0.55,
};

/**
 * Paints `kind`'s cell into the square [x, y, x + size]² of `ctx`. `seed` varies the arrangement (a kind's cell is one
 * picture city-wide; the seed is fixed per kind so the published look is stable). `oneRoom` (round m, with the
 * shop-variety flag): the cell is painted on its family's room (retailRoomTone.ts) and glass light, the room its pane
 * fillers share; off, byte-identical to before.
 */
export function paintGoods(ctx: Ctx2D, kind: GoodsKind, x: number, y: number, size: number, oneRoom = shopVarietyOn()): void {
  ctx.save();
  ctx.beginPath(); ctx.rect(x, y, size, size); ctx.clip();
  ctx.translate(x, y); ctx.scale(size / W, size / H);
  let h = 2166136261; for (const ch of kind) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  const fam = oneRoom ? roomOf(kind) : undefined;
  const p: P = fam ? { c: ctx, r: stream(h >>> 0), room: fam } : { c: ctx, r: stream(h >>> 0) };
  ctx.globalAlpha = 1; ctx.lineWidth = 1;
  PAINTERS[kind](p);
  glassOver(p, fam ? fam.lit : LIT[kind] ?? 0.6);
  ctx.restore();
}

/** Paints goods layer `page` (0-based) into a `size` px square context, every cell of it. */
export function paintGoodsLayer(ctx: Ctx2D, page: number, size: number, oneRoom = shopVarietyOn()): void {
  ctx.fillStyle = '#2a2420'; ctx.fillRect(0, 0, size, size);
  for (const kind of GOODS_KINDS) { const c = goodsCellPx(kind, size); if (c.page === page) paintGoods(ctx, kind, c.x, c.y, c.w, oneRoom); }
}

/**
 * The tiles a pane [c0, c1] (m along the wall) is cut into: about GOODS_TILE_M each, at least one. Alternate tiles
 * mirror the cell (`flip`), so a long window is not one picture repeated.
 */
export function goodsTiles(c0: number, c1: number): Array<{ a0: number; a1: number; flip: boolean }> {
  const n = Math.max(1, Math.round((c1 - c0) / GOODS_TILE_M)), w = (c1 - c0) / n;
  return Array.from({ length: n }, (_, k) => ({ a0: c0 + k * w, a1: c0 + (k + 1) * w, flip: k % 2 === 1 }));
}

/** Lane shop-variety-20261120: the painting helpers, for the pane fillers (retailPaneFillers.ts) to paint in the same hand. */
export type GoodsPaint = P;
export const goodsPaint = { stream, pick, rect, round, oval, poly, vgrad, glow, room, shelves, packets, mannequin, rail, loaf, bottle, menuBoard, glassOver, PRODUCT, PASTEL } as const;
