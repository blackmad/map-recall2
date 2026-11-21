// Pane fillers (lane shop-variety-20261120; David 2026-11-20: "this place wouldn't have four doners, this wouldn't
// have gelato in every window"). A template's goods cell is its signature display (the doner spit, the gelato counter,
// the bakery shelf); the shop's other panes show what a real shop's other windows show: tables and diners, a stool bar
// at the glass, a drinks fridge, a menu poster stuck inside the glass, a dim room with pendant lamps, a promo poster,
// a plinth display, the counter and till, wall shelving, a plant against reflecting glass, a half-drawn blind.
// shopVariety.ts decides which pane shows which; this module paints the cells.
//
// Same hand and design space as retailGoods.ts (GOODS_W x GOODS_H units, scaled to a square cell, the glass over it),
// so a filler sits beside its signature as one window. Every cell is lit and busy at its own brightness, often with
// decals (the previous retail blind: real windows read warm, lit and cluttered at varied brightness; darker glass lost).
// The cells live on their own texture-array layers after the chain-logo pages (retailPages.ts VARIETY_BASE), so the
// goods layers, and every layer index before them, are unchanged. Deterministic (seeded per kind), no text, no images.
//
// Round m (lane shop-one-room-20261121; David 2026-11-21: "these still look very inconsistent"): one room per shop.
// A filler is painted once per room family (retailRoomTone.ts FAMILY_FILLERS) on that family's room, the room its
// signature cells are painted on too, at the family's glass light: every pane of a shop looks into the same room, and
// the panes differ only in what stands in it. A painter keeps to that room (no wall of its own: no tiled wall, no dark
// overlay, no lit box), and dresses its things for the family (no diners in a chemist's fridge window).
import { GOODS_GRID, GOODS_H, GOODS_PER_LAYER, GOODS_W, goodsPaint as G, type Ctx2D, type GoodsPaint as P } from './retailGoods.js';
import { FAMILY_FILLERS, FAMILY_ROOMS, ROOM_FAMILIES, type RoomFamily } from './retailRoomTone.js';

export const FILLER_KINDS = [
  'tablesBright', 'tablesWarm', 'windowBar', 'drinksFridge', 'menuPoster', 'lamps',
  'promoPoster', 'plinthDisplay', 'counterTill', 'wallShelves', 'plantGlass', 'blind', 'lounge',
] as const;
export type FillerKind = (typeof FILLER_KINDS)[number];
/** Every painted filler cell: each family's fillers on its room, in family order. */
export const FILLER_CELLS: ReadonlyArray<{ family: RoomFamily; filler: FillerKind }> = ROOM_FAMILIES.flatMap(family => FAMILY_FILLERS[family].map(filler => ({ family, filler })));
export const FILLER_LAYERS = Math.ceil(FILLER_CELLS.length / GOODS_PER_LAYER);
const cellIndex = (family: RoomFamily, kind: FillerKind): number => {
  const i = FILLER_CELLS.findIndex(c => c.family === family && c.filler === kind);
  if (i < 0) throw new Error(`no ${kind} filler on the ${family} room`);
  return i;
};

/** A filler's layer (0-based among the filler layers) and uv rect (u0, v0, u1, v1; v up), as retailGoods goodsCell. */
export function fillerCell(family: RoomFamily, kind: FillerKind): { page: number; rect: [number, number, number, number] } {
  const i = cellIndex(family, kind), page = Math.floor(i / GOODS_PER_LAYER), k = i % GOODS_PER_LAYER;
  const c = k % GOODS_GRID, r = Math.floor(k / GOODS_GRID), s = 1 / GOODS_GRID, inset = 0.012;
  const y0 = r * s, y1 = (r + 1) * s;
  return { page, rect: [c * s + inset, 1 - y1 + inset, (c + 1) * s - inset, 1 - y0 - inset] };
}
/** A filler cell's box in a layer image (px, from the top-left) for a layer `size` px square. */
export function fillerCellPx(family: RoomFamily, kind: FillerKind, size: number): { page: number; x: number; y: number; w: number } {
  const i = cellIndex(family, kind), k = i % GOODS_PER_LAYER, w = size / GOODS_GRID;
  return { page: Math.floor(i / GOODS_PER_LAYER), x: (k % GOODS_GRID) * w, y: Math.floor(k / GOODS_GRID) * w, w };
}

const W = GOODS_W, H = GOODS_H;
const { rect, round, oval, poly, glow, room, shelves, packets, pick, PRODUCT } = G;
const SKIN = ['#e8c8a8', '#c89a74', '#8a5a3a', '#f0d4bc', '#6a4028'];
const HAIR = ['#2a1e16', '#4a3020', '#8a6a3a', '#1a1a1a', '#c8a070', '#6a6a6a'];
const TOPS = ['#2f4a6a', '#a83a2a', '#e8e2d2', '#3a6a3a', '#d8a030', '#1e1e22', '#7a4a8a', '#c86a8a'];

/** A person from the waist up (seated at a table or the counter), seat line at y. */
function person(p: P, x: number, y: number, s: number): void {
  const top = pick(p.r, TOPS);
  round(p, x - 11 * s, y - 34 * s, 22 * s, 36 * s, 7 * s, top);
  rect(p, x - 2.5 * s, y - 40 * s, 5 * s, 6 * s, pick(p.r, SKIN));
  oval(p, x, y - 47 * s, 7 * s, 8.5 * s, pick(p.r, SKIN));
  oval(p, x, y - 51 * s, 7.4 * s, 5.5 * s, pick(p.r, HAIR));
}
/** A standing person (shopkeeper behind a counter, a customer), feet at y. */
function standing(p: P, x: number, y: number, s: number): void {
  const top = pick(p.r, TOPS);
  rect(p, x - 7 * s, y - 50 * s, 6 * s, 50 * s, '#2a2a30'); rect(p, x + 1 * s, y - 50 * s, 6 * s, 50 * s, '#2a2a30');
  round(p, x - 11 * s, y - 92 * s, 22 * s, 44 * s, 6 * s, top);
  oval(p, x, y - 100 * s, 7 * s, 8.5 * s, pick(p.r, SKIN));
  oval(p, x, y - 104 * s, 7.4 * s, 5.5 * s, pick(p.r, HAIR));
}
/** A small table with two chairs, top at y. */
function table(p: P, x: number, y: number, top: string, leg: string, chair: string): void {
  round(p, x - 34, y - 26, 9, 46, 2, chair); round(p, x + 25, y - 26, 9, 46, 2, chair);
  oval(p, x, y, 24, 5, top); rect(p, x - 2, y, 4, 34, leg); rect(p, x - 10, y + 32, 20, 3, leg);
}
/** Decals stuck inside the glass's lower corner: an opening-hours plate, card marks, a round sticker. */
function decals(p: P, right: boolean, y = H - 44): void {
  const x = right ? W - 40 : 8;
  rect(p, x, y, 30, 22, 'rgba(250,248,240,0.92)');
  for (let k = 0; k < 4; k++) rect(p, x + 3, y + 4 + k * 4.4, 14 + 8 * p.r(), 1.6, 'rgba(60,60,60,0.8)');
  const marks = ['#1a4fa0', '#e8322a', '#f2b92e', '#2a8a4a', '#111111'];
  for (let k = 0; k < 3; k++) round(p, x + k * 10.5, y + 25, 9, 6, 1.2, marks[(k + Math.floor(p.r() * 5)) % marks.length]);
  if (p.r() < 0.6) oval(p, right ? x - 8 : x + 40, y + 6, 6, 6, pick(p.r, ['#e8322a', '#2a8a4a', '#f2b92e', '#ffffff']));
}

/** How a family dresses its things: tables and chairs, counter and shelf wood. */
type Dress = { table: string; leg: string; chair: string; counter: string; counterTop: string; shelf: string; plinth: readonly [string, string]; stock: readonly string[] };
/** The warm room's shelf stock: kraft, wicker, cream and tins (a bakery's, cheese shop's or greengrocer's back wall); the
 *  supermarket's bright packets read as another shop there. */
const WARM_STOCK = ['#c8a060', '#e8dcc0', '#8a5a30', '#d8b070', '#a8783a', '#f0e6d0', '#7a4a2a', '#b84a32'];
const DRESS: Readonly<Record<RoomFamily, Dress>> = {
  shop: { table: '#e8e4dc', leg: '#8a8a8a', chair: '#5a5a5a', counter: '#d8d2c8', counterTop: '#f4f2ec', shelf: '#f4f2ec', plinth: ['#f2eee6', '#e4ded2'], stock: PRODUCT },
  takeaway: { table: '#e8e4dc', leg: '#6a6a6a', chair: '#8a2a22', counter: '#b8a888', counterTop: '#d8cbb0', shelf: '#d8d2c4', plinth: ['#f2eee6', '#e4ded2'], stock: PRODUCT },
  sweet: { table: '#ffffff', leg: '#b8a0a8', chair: '#e890aa', counter: '#f4dce4', counterTop: '#ffffff', shelf: '#ffffff', plinth: ['#ffffff', '#f4e4ea'], stock: PRODUCT },
  warm: { table: '#5a3a22', leg: '#2a1a10', chair: '#3a2416', counter: '#7a5634', counterTop: '#c8a878', shelf: '#a07848', plinth: ['#e8dcc4', '#d4c4a6'], stock: WARM_STOCK },
  dark: { table: '#3a2416', leg: '#1a120a', chair: '#2a1a10', counter: '#3a2614', counterTop: '#6a4a2a', shelf: '#5a3e22', plinth: ['#4a3a2e', '#3e3026'], stock: PRODUCT },
};

const PAINTERS: Record<FillerKind, (p: P, fam: RoomFamily) => void> = {
  tablesBright(p, fam) {
    // The takeaway's or ijssalon's seating: formica tables, two diners, a shelf of drinks on the family wall.
    const d = DRESS[fam];
    room(p, '', '');
    shelves(p, [104], d.shelf, 0, W); for (let x = 8; x < W - 8; x += 12) round(p, x, 88, 7, 16, 1.5, pick(p.r, ['#d8452f', '#f2e8d0', '#3f8f4a', '#f2b92e']));
    person(p, 30, 186, 1); person(p, 118, 186, 0.92);
    table(p, 40, 190, d.table, d.leg, d.chair); table(p, 116, 196, d.table, d.leg, d.chair);
    for (const x of [34, 46, 112]) round(p, x, 180, 5, 10, 1, pick(p.r, ['#d8452f', '#f2e8d0', '#3f8f4a']));
    decals(p, p.r() < 0.5);
  },
  tablesWarm(p, fam) {
    // A sit-down room: framed pictures on the family wall, pendant lamps, wooden tables with diners.
    const d = DRESS[fam];
    room(p, '', '');
    for (const [x, w] of [[14, 30], [60, 22], [98, 34]] as const) { rect(p, x - 2, 74, w + 4, 30, '#3a2a1a'); rect(p, x, 76, w, 26, pick(p.r, ['#8aa0b0', '#c8b080', '#a8604a', '#6a8a6a'])); }
    for (const x of [38, 112]) { rect(p, x, 0, 1, 64, '#222'); poly(p, [[x - 10, 72], [x + 10, 72], [x + 5, 60], [x - 5, 60]], '#e8c070'); glow(p, x, 78, 36, '255,190,110', 0.6); }
    person(p, 22, 182, 1); person(p, 58, 184, 0.95); person(p, 126, 182, 1);
    table(p, 40, 188, d.table, d.leg, d.chair); table(p, 116, 190, d.table, d.leg, d.chair);
    for (const x of [32, 48, 110, 122]) { oval(p, x, 184, 4, 2, '#ffffff'); }
    rect(p, 112, 176, 2, 8, '#e8e0c0'); glow(p, 113, 176, 6, '255,220,150', 0.8);
    if (p.r() < 0.6) decals(p, true);
  },
  windowBar(p, fam) {
    // A ledge along the glass with stools, two people at it looking out; a shelf of jars on the family wall behind.
    const d = DRESS[fam];
    room(p, '', '');
    shelves(p, [104], d.shelf, 0, W); for (let x = 6; x < W - 10; x += 16) round(p, x, 80, 12, 24, 2, pick(p.r, ['#c8782f', '#e8e2d2', '#5a8a4a', '#a8422a']));
    person(p, 40, 174, 1.1); person(p, 108, 174, 1.05);
    rect(p, 0, 168, W, 7, d.counterTop); rect(p, 0, 175, W, 3, 'rgba(0,0,0,0.3)');
    for (const x of [28, 40, 100, 112]) oval(p, x, 165, 4, 3, pick(p.r, ['#ffffff', '#c8782f', '#e8e0c0']));
    for (const x of [40, 108]) { rect(p, x - 2, 178, 4, 46, '#3a3a3a'); oval(p, x, 178, 10, 3, '#2a2a2a'); rect(p, x - 9, 220, 18, 2, '#3a3a3a'); }
    decals(p, p.r() < 0.5);
  },
  drinksFridge(p, fam) {
    // A cold-drinks fridge (blind round 1: a wall of mixed bottles read as a liquor shop in a doner's window): one tall
    // glass-door fridge glowing cool white, rows of one can colour each under a brand header; beside it a diner at a
    // table in a takeaway, a customer standing in a shop.
    room(p, '', '');
    const x0 = 8, w = 74;
    rect(p, x0 - 4, 30, w + 8, 196, '#b8bcc0'); rect(p, x0, 50, w, 170, '#eef6fb'); glow(p, x0 + w / 2, 130, 70, '220,240,255', 0.5);
    rect(p, x0 - 4, 30, w + 8, 18, pick(p.r, ['#d8302a', '#1a4fa0', '#2a8a4a'])); rect(p, x0 + 12, 36, w - 24, 6, '#ffffff');
    const rows = [['#d8302a', '#d8302a', '#c02420'], ['#2a6ab0', '#e8e8e8'], ['#f2a020', '#f2c230'], ['#3a9a3a', '#7ac04a'], ['#e8e8e8', '#d8302a'], ['#6a3a8a', '#e04a8a']];
    for (const [k, y] of [74, 98, 122, 146, 170, 194].entries()) {
      rect(p, x0, y, w, 3, '#c8d0d6');
      const cols = rows[(k + Math.floor(p.r() * rows.length)) % rows.length];
      for (let x = x0 + 3; x < x0 + w - 8; x += 8) { round(p, x, y - 15, 7, 15, 1.5, cols[Math.floor((x - x0) / 24) % cols.length]); rect(p, x + 1, y - 13, 1.5, 11, 'rgba(255,255,255,0.4)'); }
    }
    rect(p, x0 + w / 2 - 1, 50, 2, 170, 'rgba(120,130,140,0.8)'); rect(p, x0 + w - 6, 110, 2, 40, '#888');
    rect(p, x0 + 2, 52, 5, 166, 'rgba(255,255,255,0.4)');
    if (fam === 'shop') { shelves(p, [110], DRESS[fam].shelf, 90, W); packets(p, 90, W, 110, 14, 24, PRODUCT, 5, 10); standing(p, 118, 226, 0.95); }
    else { person(p, 118, 188, 0.9); table(p, 118, 194, DRESS[fam].table, DRESS[fam].leg, DRESS[fam].chair); }
    decals(p, true);
  },
  menuPoster(p, fam) {
    // A big menu / food-photo poster stuck to the inside of the glass, the counter's steel front under it.
    room(p, '', '');
    rect(p, 0, 120, W, 70, '#c9ccce'); rect(p, 0, 120, W, 4, '#e8eaea');
    const bg = pick(p.r, fam === 'sweet' ? ['#e8457a', '#f2c230', '#5ab0d8', '#1d1d1b'] : ['#1d1d1b', '#b02a22', '#f2c230', '#2a4a2a']);
    const ink = bg === '#f2c230' ? '#2a1a10' : '#f6e8c0';
    rect(p, 18, 52, W - 36, 132, bg);
    round(p, 26, 60, W - 52, 66, 3, pick(p.r, ['#c8782f', '#e0b04a', '#a8422a']));
    oval(p, 58, 98, 26, 14, '#e8c890'); oval(p, 94, 92, 20, 16, '#a8422a'); oval(p, 64, 92, 10, 6, '#7aa83a'); oval(p, 88, 104, 14, 6, '#f2e8d0');
    for (let y = 134; y < 176; y += 7) { rect(p, 26, y, (W - 70) * (0.5 + 0.4 * p.r()), 3, ink); rect(p, W - 42, y, 16, 3, ink); }
    oval(p, W - 30, 62, 13, 13, '#f2c230'); rect(p, W - 38, 60, 16, 4, '#b02a22');
    decals(p, p.r() < 0.5, H - 52);
  },
  lamps(p, fam) {
    // The quieter window: pendant lamps and a wall lamp in the family room, tables, one guest, a plant.
    const d = DRESS[fam];
    room(p, '', '');
    for (const [x, len] of [[30, 70], [78, 56], [124, 76]] as const) { rect(p, x, 0, 1, len, '#1a1a1a'); oval(p, x, len + 6, 9, 7, '#f6d090'); glow(p, x, len + 6, 44, '255,196,120', 0.7); }
    rect(p, 6, 110, 10, 14, '#e8c070'); glow(p, 11, 116, 26, '255,200,130', 0.6);
    for (const x of [44, 110]) { oval(p, x, 186, 26, 5, d.table); rect(p, x - 2, 186, 4, 36, d.leg); }
    person(p, 98, 182, 0.95);
    rect(p, 128, 160, 14, 62, '#4a3020'); for (let k = 0; k < 8; k++) oval(p, 128 + 14 * p.r(), 130 + 34 * p.r(), 9, 4, pick(p.r, ['#3a6a2a', '#2a5a22', '#4a7a32']));
    rect(p, 64, 196, 10, 12, '#f0e0c0'); glow(p, 69, 198, 10, '255,220,150', 0.8);
    if (p.r() < 0.7) decals(p, false);
  },
  promoPoster(p, fam) {
    // A campaign poster inside the glass (a figure on a colour field, a stripe of offer), stocked shelves round it.
    const d = DRESS[fam];
    room(p, '', '');
    shelves(p, [96, 140], d.shelf); for (const y of [96, 140]) packets(p, 0, W, y, 16, 26, PRODUCT, 5, 10);
    const field = pick(p.r, ['#e8457a', '#2f6fb0', '#f2b92e', '#3f8f4a', '#d8452f', '#1e1e22', '#c9b8e8']);
    rect(p, 22, 34, W - 44, 170, '#f8f6f0'); rect(p, 25, 37, W - 50, 164, field);
    const skin = pick(p.r, SKIN), x = W / 2 + (p.r() - 0.5) * 20;
    oval(p, x, 84, 16, 20, skin); oval(p, x, 72, 18, 12, pick(p.r, HAIR));
    poly(p, [[x - 30, 150], [x + 30, 150], [x + 22, 106], [x - 22, 106]], pick(p.r, ['#f4f1ea', '#1e1e22', '#e8c070', '#a83a2a']));
    rect(p, 25, 156, W - 50, 22, '#f8f6f0'); rect(p, 32, 162, 50, 10, field); rect(p, 90, 162, 26, 10, '#1e1e22');
    for (let k = 0; k < 3; k++) rect(p, 32, 184 + k * 5, 60 - k * 12, 2, 'rgba(255,255,255,0.85)');
  },
  plinthDisplay(p, fam) {
    // A dressed window: a stepped plinth with a few items under spotlights, a shelf of stock on the family wall.
    const d = DRESS[fam], [pa, pb] = d.plinth;
    room(p, '', '');
    shelves(p, [110], d.shelf, 0, W); packets(p, 0, W, 110, 14, 24, ['#c8b8a0', '#7a6a5a', '#e8e2d2', '#4a5a6a', '#a8603a'], 6, 12);
    rect(p, 14, 196, 56, 30, pa); rect(p, 64, 176, 44, 50, pb); rect(p, 104, 206, 36, 20, pa);
    rect(p, 14, 196, 56, 3, 'rgba(255,255,255,0.4)'); rect(p, 64, 176, 44, 3, 'rgba(255,255,255,0.4)');
    const items = [pick(p.r, d.stock), pick(p.r, d.stock), pick(p.r, d.stock)];
    round(p, 26, 160, 24, 36, 4, items[0]); oval(p, 86, 160, 15, 16, items[1]); round(p, 112, 186, 20, 20, 3, items[2]);
    rect(p, 30, 166, 16, 5, 'rgba(255,255,255,0.4)'); oval(p, 82, 154, 5, 4, 'rgba(255,255,255,0.45)');
    for (const x of [38, 86, 122]) { glow(p, x, 176, 34, '255,240,200', 0.5); rect(p, x - 3, 0, 6, 8, '#2a2a2a'); }
    rect(p, 72, 214, 22, 8, '#ffffff'); rect(p, 74, 216, 12, 2, '#444');
    if (p.r() < 0.5) decals(p, true, H - 92);
  },
  counterTill(p, fam) {
    // The counter seen through the glass: a till, the shopkeeper behind it, stocked shelves on the family wall.
    const d = DRESS[fam];
    room(p, '', '');
    shelves(p, [70, 104, 138], d.shelf); for (const y of [70, 104, 138]) packets(p, 0, W, y, 14, 26, d.stock, 5, 12);
    standing(p, 92, 210, 0.95);
    rect(p, 0, 160, W, 66, d.counter); rect(p, 0, 160, W, 6, d.counterTop); rect(p, 0, 166, W, 3, 'rgba(0,0,0,0.3)');
    for (let x = 6; x < W; x += 30) rect(p, x, 174, 24, 46, 'rgba(255,255,255,0.08)');
    rect(p, 30, 140, 30, 20, '#2a2a2e'); rect(p, 34, 143, 22, 10, '#8ab0c8'); rect(p, 34, 156, 22, 4, '#4a4a4e');
    for (let k = 0; k < 5; k++) round(p, 70 + k * 12, 148, 9, 12, 1.5, pick(p.r, d.stock));
    decals(p, p.r() < 0.5);
  },
  wallShelves(p, fam) {
    // Wooden shelving on the family wall with boxes, tins and jars (no bottles: blind round 1 read a bottle wall as a
    // liquor shop), a wall lamp over it.
    const d = DRESS[fam], ys = [58, 92, 126, 160];
    room(p, '', '');
    rect(p, 4, 40, W - 8, 124, shade(d.shelf, 0.6));
    shelves(p, ys, d.shelf, 4, W - 4);
    for (const [i, y] of ys.entries()) {
      if (i % 2 === 0) packets(p, 6, W - 6, y, 14, 26, d.stock, 7, 14);
      else for (let x = 10; x < W - 12; x += 13) { round(p, x, y - 18, 10, 18, 3, 'rgba(230,236,232,0.6)'); rect(p, x + 1, y - 12, 8, 10, pick(p.r, ['#e8a23a', '#c8462a', '#7aa83a', '#f2e8d0'])); rect(p, x, y - 21, 10, 3, pick(p.r, ['#c8262d', '#2a4a6a', '#e8e0c0'])); }
    }
    glow(p, W / 2, 50, 70, '255,210,150', 0.35);
    if (p.r() < 0.6) decals(p, p.r() < 0.5);
  },
  plantGlass(p, fam) {
    // The window as glass first: the street's reflection, a big plant on the sill, a guest further in.
    void fam;
    room(p, '', '');
    person(p, 104, 170, 0.75);
    rect(p, 22, 196, 34, 30, pick(p.r, ['#c8784a', '#e8e2d2', '#3a3a3a']));
    for (let k = 0; k < 18; k++) { const a = p.r() * Math.PI, rr = 30 + 40 * p.r(); oval(p, 39 + Math.cos(a) * rr * 0.7, 196 - Math.sin(a) * rr, 12, 5, pick(p.r, ['#3a6a2a', '#2a5a22', '#4a7a32', '#5a8a3a'])); }
    poly(p, [[0, 0], [W * 0.5, 0], [W * 0.1, H], [0, H]], 'rgba(170,184,194,0.22)');
    rect(p, 0, 34, W, 2, 'rgba(255,255,255,0.25)');
    if (p.r() < 0.7) decals(p, true);
  },
  lounge(p, fam) {
    // The dark shop's other window (a coffeeshop, a smartshop, a studio, a bar): low sofas, coloured lamp glows, a plant.
    void fam;
    room(p, '', '');
    // Warm and green glows only (blind round m1: a purple cast read as another room beside the brown bar).
    const tint = pick(p.r, ['120,255,140', '255,150,80', '255,120,90']);
    glow(p, 34, 96, 50, tint, 0.45); glow(p, 116, 70, 40, '255,190,110', 0.55);
    rect(p, 20, 70, 30, 40, '#5a4a3a'); rect(p, 23, 73, 24, 34, pick(p.r, ['#3a6a4a', '#6a3a6a', '#8a5a2a']));
    rect(p, 116, 0, 1, 58, '#111'); oval(p, 116, 64, 9, 6, '#f2c070');
    round(p, 6, 170, 80, 40, 8, pick(p.r, ['#5a2a22', '#2a3a2a', '#3a2a4a'])); round(p, 6, 158, 80, 18, 6, 'rgba(255,255,255,0.08)');
    person(p, 46, 176, 0.9);
    oval(p, 110, 196, 22, 5, '#2a1a10'); rect(p, 108, 196, 4, 26, '#1a120a');
    rect(p, 104, 186, 6, 10, '#e8e0c0'); glow(p, 107, 186, 10, '255,210,140', 0.8);
    rect(p, 132, 150, 12, 72, '#2a2018'); for (let k = 0; k < 8; k++) oval(p, 132 + 12 * p.r(), 120 + 34 * p.r(), 9, 4, pick(p.r, ['#2a5a22', '#3a6a2a']));
    if (p.r() < 0.8) decals(p, p.r() < 0.5);
  },
  blind: (p, fam) => {
    // A half-drawn roller blind over the upper glass, the shop under it: a shelf of stock and a customer.
    room(p, '', '');
    shelves(p, [150], DRESS[fam].shelf); packets(p, 0, W, 150, 14, 24, PRODUCT, 6, 12);
    standing(p, 56, 226, 0.9);
    // Neutral cloths only (2026-11-20): a red or green blind read as another shop's colours beside the signature.
    const cloth = pick(p.r, ['#efe6d2', '#d8c8a0', '#e6dcc4', '#f4f1ea']);
    rect(p, 0, 0, W, 112, cloth);
    for (let x = 4; x < W; x += 10) rect(p, x, 0, 2, 112, 'rgba(0,0,0,0.08)');
    rect(p, 0, 112, W, 6, shade(cloth, 0.7));
    if (p.r() < 0.5) { for (let x = 10; x < W - 10; x += 22) poly(p, [[x, 112], [x + 22, 112], [x + 11, 126]], cloth); }
    rect(p, 0, 118, W, 3, 'rgba(0,0,0,0.3)');
    decals(p, p.r() < 0.5);
  },
};
function shade(hex: string, k: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgb(${Math.round(((n >> 16) & 255) * k)},${Math.round(((n >> 8) & 255) * k)},${Math.round((n & 255) * k)})`;
}

/** Paints `family`'s `kind` cell into the square [x, y, x + size]² of `ctx`, on the family room at its glass light
 *  (seeded per family and kind: one picture city-wide). */
export function paintFiller(ctx: Ctx2D, family: RoomFamily, kind: FillerKind, x: number, y: number, size: number): void {
  ctx.save();
  ctx.beginPath(); ctx.rect(x, y, size, size); ctx.clip();
  ctx.translate(x, y); ctx.scale(size / W, size / H);
  let h = 2166136261; for (const ch of `filler:${family}:${kind}`) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  const room = FAMILY_ROOMS[family], p: P = { c: ctx, r: G.stream(h >>> 0), room };
  ctx.globalAlpha = 1; ctx.lineWidth = 1;
  PAINTERS[kind](p, family);
  G.glassOver(p, room.lit);
  ctx.restore();
}

/** Paints filler layer `page` (0-based) into a `size` px square context, every cell of it. */
export function paintFillerLayer(ctx: Ctx2D, page: number, size: number): void {
  ctx.fillStyle = '#2a2420'; ctx.fillRect(0, 0, size, size);
  for (const { family, filler } of FILLER_CELLS) { const c = fillerCellPx(family, filler, size); if (c.page === page) paintFiller(ctx, family, filler, c.x, c.y, c.w); }
}
