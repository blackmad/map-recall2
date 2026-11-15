// Shopfront templates as geometry (lane retail-ground-20261114, `?retailGround=1`): a fascia board with the chain's
// or the business's lettering, window content just proud of the glass, and what stands on the pavement, built on the
// street wall nearest the POI. Flat-colour triangles in the sign layer (threeBuildingMesh SignTri), so no texture
// layer is spent: the atlas has two free layers. Pure (no DOM): runs in the mesh worker and in Node tests.
import { glyphLayout } from './retailLogos.js';
import { BIKE, bikeQuads, outsideBikes, SHOW_HEXES, USED_HEXES, type BikeClass } from './retailBikes.js';
import { signText, TEMPLATE_LOOKS, type RetailTemplate, type TemplateLook } from './retailTemplates.js';

export type V3 = [number, number, number];
export type FrontTri = { p: V3[]; hex: string; n: V3; lit?: boolean; uv?: [number, number][]; layer?: number; accentHex?: string };
/** The wall: origin, unit direction along it, outward normal (x along, y out, z up). */
export type WallFrame = { x0: number; y0: number; ux: number; uy: number; nx: number; ny: number };

/** Measured proportions (Haarlemmerdijk traces, retailTemplates.ts PUI): fascia 0.6 m under the ground storey top. */
export const FRONT = {
  /** Board under the ground storey's top (m), its height and how far it stands out. */
  fasciaGapM: 0.12, fasciaM: 0.6, fasciaOutM: 0.12,
  // Round 3b: letters and logos stand 3 cm proud of the board (raised letters). At 5 mm they z-fought the board at ride
  // distance and read as dotted glyphs (Utrechtsestraat 61 zoom).
  letterOutM: 0.03,
  /** The window content's zone: from the stall riser to a little under the fascia. */
  riserM: 0.5, headGapM: 0.18,
  /** Window content stands this far proud of the wall (the glass plane in the texture). */
  contentOutM: 0.02,
  /** At most this much of a long wall carries one template front (m): round 2's Kinkerstraat sheet showed 14 m fronts
   *  over what the photo has as two or three shops; the Haarlemmerdijk traces' shopfronts are 4-8 m. */
  maxSpanM: 9,
  /** Round 2 doors: one per front (48 of the 66 traced Haarlemmerdijk fronts had one, ~0.75 m leaf), its head at most
   *  this high, the frame's depth proud of the wall, and a traced door's recess when the trace gives none. */
  doorM: 1.0, doorHeadM: 2.4, frameOutM: 0.09, recessM: 0.5,
  /** Round 3 (lane retail-look-20261114): the fascia's cornice cap (height, how far out) and the bead under the board;
   *  the end posts, mullions (at most paneMaxM apart) and the transom bar at the door head; the sill over the riser;
   *  the share of the glass's height that reflects the street. */
  capM: 0.08, capOutM: 0.2, beadM: 0.04, postM: 0.14, mullionM: 0.06, paneMaxM: 1.9, transomM: 0.08, sillOutM: 0.06,
  reflectShare: 0.34,
} as const;

/** Behind the glass reads dark and warm (round 2; round 3 pulls further, 0.62 lit / 0.68 unlit, under the reflection): content colours pulled toward the interior's dark. */
const GLASS_DARK = [38, 33, 28] as const, GLASS_PULL = 0.55;
export function glassTone(hex: string, pull = GLASS_PULL): string {
  const n = parseInt(hex.slice(1), 16), c = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  const grey = (c[0] + c[1] + c[2]) / 3;
  return '#' + c.map((v, i) => Math.round((v * 0.6 + grey * 0.4) * (1 - pull) + GLASS_DARK[i] * pull)).map(v => v.toString(16).padStart(2, '0')).join('');
}
/** Content that is its own light (lit windows, neon, FEBO's heated doors) or stuck on the glass (a sigarenwinkel's
 *  placards) keeps its colours. */
const OWN_LIGHT = new Set(['redGlow', 'neon', 'automatiek', 'placards']);

/** Stable 0..1 hash of a string (FNV-1a). */
function hash01(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0) / 4294967296;
}

class Builder {
  readonly out: FrontTri[] = [];
  constructor(readonly e: WallFrame) {}
  P(a: number, o: number, z: number): V3 { const e = this.e; return [e.x0 + e.ux * a + e.nx * o, e.y0 + e.uy * a + e.ny * o, z]; }
  N(a: number, o: number, z: number): V3 { const e = this.e; return [e.ux * a + e.nx * o, e.uy * a + e.ny * o, z]; }
  face(q: V3[], n: V3, hex: string, lit?: boolean): void {
    const [A, B, C, D] = q;
    const u = [B[0] - A[0], B[1] - A[1], B[2] - A[2]], w = [C[0] - A[0], C[1] - A[1], C[2] - A[2]];
    const c = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]];
    const flip = c[0] * n[0] + c[1] * n[1] + c[2] * n[2] < 0;
    const t = (p: V3[]): FrontTri => (lit ? { p, hex, n, lit } : { p, hex, n });
    this.out.push(t(flip ? [A, C, B] : [A, B, C]), t(flip ? [A, D, C] : [A, C, D]));
  }
  /** A flat panel parallel to the wall at `o` out. */
  panel(a0: number, a1: number, o: number, z0: number, z1: number, hex: string, lit?: boolean): void {
    if (a1 - a0 < 1e-3 || z1 - z0 < 1e-3) return;
    this.face([this.P(a0, o, z0), this.P(a1, o, z0), this.P(a1, o, z1), this.P(a0, o, z1)], this.N(0, 1, 0), hex, lit);
  }
  /** A panel carrying a texture rect (u0, v0, u1, v1) of `layer` (the logo layer). */
  textured(a0: number, a1: number, o: number, z0: number, z1: number, layer: number, r: readonly [number, number, number, number]): void {
    const first = this.out.length;
    this.panel(a0, a1, o, z0, z1, '#ffffff', true);
    for (const t of this.out.slice(first)) {
      t.layer = layer;
      t.uv = t.p.map(q => { const a = (q[0] - this.e.x0) * this.e.ux + (q[1] - this.e.y0) * this.e.uy; return [r[0] + (r[2] - r[0]) * (a - a0) / (a1 - a0), r[1] + (r[3] - r[1]) * (q[2] - z0) / (z1 - z0)] as [number, number]; });
    }
  }
  /** A box: front, both ends and the top (and the bottom when it floats). */
  box(a0: number, a1: number, o0: number, o1: number, z0: number, z1: number, hex: string, lit?: boolean, bottom = false): void {
    const P = this.P.bind(this), N = this.N.bind(this);
    this.face([P(a0, o1, z0), P(a1, o1, z0), P(a1, o1, z1), P(a0, o1, z1)], N(0, 1, 0), hex, lit);
    this.face([P(a0, o0, z0), P(a0, o1, z0), P(a0, o1, z1), P(a0, o0, z1)], N(-1, 0, 0), hex, lit);
    this.face([P(a1, o0, z0), P(a1, o1, z0), P(a1, o1, z1), P(a1, o0, z1)], N(1, 0, 0), hex, lit);
    this.face([P(a0, o0, z1), P(a1, o0, z1), P(a1, o1, z1), P(a0, o1, z1)], [0, 0, 1], hex, lit);
    if (bottom) this.face([P(a0, o0, z0), P(a1, o0, z0), P(a1, o1, z0), P(a0, o1, z0)], [0, 0, -1], hex, lit);
  }
  /** Round 3c: a horizontal member drawn as the faces a rider sees: its front and its top (a sill, under the eye) or its
   *  bottom (a transom bar, bead or cap, over it), with its ends only when asked. */
  slab(a0: number, a1: number, o0: number, o1: number, z0: number, z1: number, hex: string, seen: 'top' | 'bottom', ends = false, lit?: boolean): void {
    const P = this.P.bind(this), N = this.N.bind(this);
    this.face([P(a0, o1, z0), P(a1, o1, z0), P(a1, o1, z1), P(a0, o1, z1)], N(0, 1, 0), hex, lit);
    const z = seen === 'top' ? z1 : z0;
    this.face([P(a0, o0, z), P(a1, o0, z), P(a1, o1, z), P(a0, o1, z)], [0, 0, seen === 'top' ? 1 : -1], hex, lit);
    if (ends) {
      this.face([P(a0, o0, z0), P(a0, o1, z0), P(a0, o1, z1), P(a0, o0, z1)], N(-1, 0, 0), hex, lit);
      this.face([P(a1, o0, z0), P(a1, o1, z0), P(a1, o1, z1), P(a1, o0, z1)], N(1, 0, 0), hex, lit);
    }
  }
  /** A slim upright (mullion, post): its front and both ends, no top (nothing sees it under the fascia). */
  fin(a0: number, a1: number, o0: number, o1: number, z0: number, z1: number, hex: string): void {
    const P = this.P.bind(this), N = this.N.bind(this);
    this.face([P(a0, o1, z0), P(a1, o1, z0), P(a1, o1, z1), P(a0, o1, z1)], N(0, 1, 0), hex);
    this.face([P(a0, o0, z0), P(a0, o1, z0), P(a0, o1, z1), P(a0, o0, z1)], N(-1, 0, 0), hex);
    this.face([P(a1, o0, z0), P(a1, o1, z0), P(a1, o1, z1), P(a1, o0, z1)], N(1, 0, 0), hex);
  }
  /** A sloped awning from the wall at z0 out to `out` at z1. */
  slope(a0: number, a1: number, out: number, z0: number, z1: number, hex: string): void {
    const n = this.N(0, z0 - z1, out), l = Math.hypot(...n);
    this.face([this.P(a0, 0.02, z0), this.P(a1, 0.02, z0), this.P(a1, out, z1), this.P(a0, out, z1)], [n[0] / l, n[1] / l, n[2] / l], hex);
    this.panel(a0, a1, out, z1 - 0.18, z1, hex);
  }
  /** The word centred on [a0, a1] at height zMid, letters at most `maxH` m tall, from the logo layer's lettering cell
   *  (retailLogos.ts glyphLayout); the shortest form that fits at legible size (fitWord), else nothing: a plain board. */
  word(text: string, a0: number, a1: number, zMid: number, o: number, maxH: number, hex: string, board: string, lit: boolean, layer: number | undefined): void {
    if (layer === undefined) return;
    const fit = fitWord(text, a1 - a0, maxH);
    if (!fit) return;
    const { quads, width } = glyphLayout(fit.text), h = fit.heightM, w0 = (a0 + a1) / 2 - (width * h) / 2;
    for (const q of quads) {
      const first = this.out.length;
      this.textured(w0 + q.a0 * h, w0 + q.a1 * h, o, zMid - h / 2, zMid + h / 2, layer, q.rect);
      for (const t of this.out.slice(first)) { t.hex = hex; t.accentHex = board; if (!lit) delete t.lit; }
    }
  }
}

/**
 * Round 3c (lane retail-look-20261114): fascia letters are one textured quad each from a bold sans in the logo layer
 * (retailLogos.ts GLYPH_*), replacing the 5 x 7 block letters whose strips broke into dot matrices at ride distance.
 * A letter quad's height: the caps are 0.725 of it and a stem 0.142 of it. At the smallest, 0.35 m, a stem is 5 cm,
 * 2.6 css px at the first-person lens (72 deg, 900 px) from 12 m. A name that cannot reach it is not lettered at all.
 */
export const MIN_LETTER_H = 0.35;
/** The tallest letter quad: caps 0.36 m on the 0.6 m board. */
export const MAX_LETTER_H = 0.5;
/** A stem's width as a share of the letter quad's height (Helvetica Neue Bold at the atlas's size). */
export const LETTER_STEM = 0.142;
/** CSS px of a `m`-metre stroke at the first-person lens from `distM` (the acceptance pose: 72 deg, 900 px, 12 m). */
export const strokePx = (m: number, distM = 12, vfovDeg = 72, heightPx = 900) => m * (heightPx / 2 / Math.tan(vfovDeg * Math.PI / 360)) / distM;

/**
 * The lettering a fascia `availM` wide draws: the whole text if it fits at a letter height of at least MIN_LETTER_H,
 * else the longest leading run of whole words that does, else null (a plain board: broken letters read worse than none).
 */
export function fitWord(text: string, availM: number, maxH: number): { text: string; heightM: number; widthM: number } | null {
  const words = text.trim().split(/\s+/).filter(Boolean);
  for (let k = words.length; k >= 1; k--) {
    const t = words.slice(0, k).join(' '), { quads, width } = glyphLayout(t);
    if (!quads.length || width <= 0) continue;
    const heightM = Math.min(maxH, availM / width);
    if (heightM >= MIN_LETTER_H - 1e-9) return { text: t, heightM, widthM: width * heightM };
  }
  return null;
}

const PRODUCT = ['#d8452f', '#f2b92e', '#3f8f4a', '#2f6fb0', '#e8e2d2', '#c0392b', '#7cb342', '#ee7f2c'];
const SPINES = ['#7a1f2b', '#1c3a5e', '#d6c7a1', '#2a6f6f', '#c9a227', '#3a3a3a', '#8a3b12', '#e8e2d2', '#4b2c5e', '#b8442c'];

/** Window content over [a0, a1] x [z0, z1], `o` out from the wall. `seed` keeps rows varied but stable. */
function content(b: Builder, look: TemplateLook, a0: number, a1: number, z0: number, z1: number, seed: string): void {
  const o = FRONT.contentOutM, w = a1 - a0, h = z1 - z0, lit = look.lit;
  const r = (k: string) => hash01(`${seed}:${k}`);
  switch (look.content) {
    case 'shelves': case 'deli': case 'bread': case 'magazines': case 'books': case 'souvenirs': case 'ducks': case 'cheese': {
      // A lit interior: a pale back wall, then rows of goods. Supermarkets and chemists read as bright shelving.
      const back = look.content === 'bread' ? '#f3dcb0' : look.content === 'cheese' ? '#f6e7b8' : look.content === 'books' ? '#e9dfc8' : '#f1efe8';
      b.panel(a0, a1, o, z0, z1, back, lit);
      const rows = look.content === 'ducks' ? 7 : look.content === 'books' || look.content === 'magazines' ? 5 : 4;
      const step = w > 0 ? (look.content === 'books' ? 0.12 : look.content === 'ducks' ? 0.2 : look.content === 'magazines' ? 0.32 : 0.42) : 1;
      // Round 3: goods only under the glass's reflection (the upper FRONT.reflectShare covers the rest), each row on a
      // shelf edge, items of uneven width so a supermarket's window is not a sheet of equal tiles.
      const under = z1 - h * FRONT.reflectShare;
      for (let row = 0; row < rows; row++) {
        const zr0 = z0 + h * (row + 0.18) / rows, zr1 = Math.min(under, z0 + h * (row + 0.8) / rows);
        if (zr1 - zr0 < 0.05) continue;
        if (look.content === 'shelves') b.panel(a0, a1, o + 0.008, zr0 - 0.035, zr0, '#d9d4c8', lit);
        for (let a = a0 + 0.05, k = 0, st = step; a < a1 - step * 0.6; a += st, k++) {
          st = step * (look.content === 'shelves' ? 0.6 + 0.8 * r(`sw${row}:${k}`) : 1);
          const hex = look.content === 'ducks' ? (r(`d${row}:${k}`) < 0.88 ? '#ffd21f' : '#ff8a1f')
            : look.content === 'cheese' ? (r(`c${row}:${k}`) < 0.7 ? '#f2c230' : '#e0a21c')
            : look.content === 'bread' ? (r(`b${row}:${k}`) < 0.5 ? '#c98a3a' : '#a8692c')
            : look.content === 'books' ? SPINES[Math.floor(r(`s${row}:${k}`) * SPINES.length)]
            : look.content === 'souvenirs' ? ['#1f4f9c', '#ffffff', '#e8572d', '#d9302f', '#f2b92e'][Math.floor(r(`v${row}:${k}`) * 5)]
            : look.content === 'deli' ? (row === 0 ? '#c9b79a' : PRODUCT[Math.floor(r(`p${row}:${k}`) * PRODUCT.length)])
            : PRODUCT[Math.floor(r(`p${row}:${k}`) * PRODUCT.length)];
          b.panel(a, Math.min(a1, a + st * (look.content === 'books' ? 0.85 : 0.82)), o + 0.01, zr0, look.content === 'books' ? zr1 - r(`h${row}:${k}`) * 0.06 : zr1, hex, lit);
        }
      }
      // Cheese wheels stand in stacks; a counter runs along the deli's foot.
      if (look.content === 'deli') b.box(a0 + 0.1, a1 - 0.1, o, o + 0.08, z0, z0 + h * 0.3, '#d9d4c7', lit);
      break;
    }
    case 'automatiek': {
      // FEBO's wall of small heated doors: a steel grid, every cell lit warm.
      b.panel(a0, a1, o, z0, z1, '#b7b9b8');
      const cols = Math.max(2, Math.floor(w / 0.45)), rows = 4, cw = w / cols, ch = h / rows;
      for (let c = 0; c < cols; c++) for (let row = 0; row < rows; row++) b.panel(a0 + c * cw + 0.04, a0 + (c + 1) * cw - 0.04, o + 0.01, z0 + row * ch + 0.04, z0 + (row + 1) * ch - 0.04, r(`f${c}:${row}`) < 0.85 ? '#ffd27a' : '#e8a23a', true);
      break;
    }
    case 'barGlow': {
      // A brown cafe: dark inside, a warm glint behind the glass here and there (lamps), never a lit fill.
      b.panel(a0, a1, o, z0, z1, '#1e130c');
      const panes = Math.max(2, Math.round(w / 0.42)), pw = w / panes;
      for (let k = 0; k < panes; k++) if (r(`g${k}`) < 0.45) { const c = a0 + pw * (k + 0.5) + (r(`gx${k}`) - 0.5) * pw * 0.3, zc = z0 + h * (0.45 + 0.25 * r(`gz${k}`)); b.panel(c - 0.06, c + 0.06, o + 0.008, zc - 0.04, zc + 0.04, '#c88a46', true); }
      // Round 3: no bars of its own; the pui's mullions and transom lights divide the glass (retailFrontTris).
      break;
    }
    case 'curtains': {
      // A pancake house: warm light, a checked half curtain.
      b.panel(a0, a1, o, z0, z1, '#d58a2e', true);
      b.panel(a0, a1, o + 0.008, z0, z0 + h * 0.5, '#e8e2d2', false);
      for (let a = a0, k = 0; a < a1; a += 0.12, k++) if (k % 2) b.panel(a, Math.min(a1, a + 0.12), o + 0.008, z0 + h * 0.25, z0 + h * 0.5, '#b8302a');
      const panes = Math.max(2, Math.round(w / 0.4));
      for (let k = 1; k < panes; k++) { const a = a0 + (w * k) / panes; b.panel(a - 0.025, a + 0.025, o + 0.01, z0 + h * 0.5, z1, '#2b1a12'); }
      b.panel(a0, a1, o + 0.01, z0 + h * 0.74, z0 + h * 0.74 + 0.05, '#2b1a12');
      break;
    }
    case 'menu': case 'bainMarie': case 'counter': {
      // A takeaway: menu boards across the top, a counter with lit trays (toko) or a grill (doner) below.
      b.panel(a0, a1, o, z0, z1, look.content === 'bainMarie' ? '#e9d9b4' : '#f1e6cf', lit);
      const mb = Math.max(1, Math.floor(w / 0.9)), mw = w / mb;
      for (let k = 0; k < mb; k++) {
        b.panel(a0 + k * mw + 0.05, a0 + (k + 1) * mw - 0.05, o + 0.01, z1 - h * 0.32, z1 - 0.05, look.content === 'menu' ? '#2a2a2a' : '#fff6d8', true);
        for (let line = 0; line < 4; line++) b.panel(a0 + k * mw + 0.12, a0 + k * mw + mw * (0.5 + 0.4 * r(`l${k}:${line}`)), o + 0.01, z1 - h * 0.3 + line * h * 0.065, z1 - h * 0.3 + line * h * 0.065 + 0.03, look.content === 'menu' ? '#f6e27a' : '#7a1f12', true);
      }
      b.box(a0 + 0.05, a1 - 0.05, o, o + 0.1, z0, z0 + h * 0.42, look.content === 'menu' ? '#b03024' : '#b9bcbd', false);
      if (look.content === 'bainMarie') for (let a = a0 + 0.12; a < a1 - 0.3; a += 0.32) b.panel(a, a + 0.26, o + 0.105, z0 + h * 0.34, z0 + h * 0.42, r(`t${a.toFixed(2)}`) < 0.5 ? '#d9822b' : '#b4482a', true);
      if (look.content === 'menu') b.box(a0 + w * 0.15, a0 + w * 0.15 + 0.22, o + 0.1, o + 0.32, z0 + h * 0.42, z0 + h * 0.85, '#8a4a22', true);
      break;
    }
    case 'meat': {
      b.panel(a0, a1, o, z0, z1, '#f4f4f2', lit);
      for (let a = a0 + 0.1; a < a1 - 0.2; a += 0.25) b.panel(a, a + 0.18, o + 0.01, z0 + h * 0.3, z0 + h * 0.42, r(`m${a.toFixed(2)}`) < 0.5 ? '#b3262b' : '#d9707a', lit);
      b.box(a0 + 0.05, a1 - 0.05, o, o + 0.1, z0, z0 + h * 0.3, '#e6e6e4', lit);
      break;
    }
    case 'produce': case 'bowls': {
      b.panel(a0, a1, o, z0, z1, look.content === 'bowls' ? '#f4f6ef' : '#5a5148', lit);
      for (let a = a0 + 0.1, k = 0; a < a1 - 0.3; a += 0.35, k++) {
        b.panel(a, a + 0.28, o + 0.01, z0 + h * 0.25, z0 + h * 0.45, look.content === 'bowls' ? '#3f8f4a' : PRODUCT[Math.floor(r(`g${k}`) * PRODUCT.length)], lit);
        if (look.content === 'bowls') b.panel(a + 0.04, a + 0.24, o + 0.01, z0 + h * 0.6, z0 + h * 0.85, '#6aa84f', lit);
      }
      break;
    }
    case 'frosted': {
      // A coffeeshop: frosted or painted glass, dark inside, the green-and-white licence sticker by the door.
      b.panel(a0, a1, o, z0, z1, '#9fae9a');
      b.panel(a0, a1, o + 0.008, z0 + h * 0.62, z1, '#24302a');
      b.panel(a1 - 0.35, a1 - 0.17, o + 0.008, z0 + h * 0.45, z0 + h * 0.57, '#1f8a3a', true);
      b.panel(a1 - 0.33, a1 - 0.19, o + 0.012, z0 + h * 0.48, z0 + h * 0.54, '#ffffff', true);
      break;
    }
    case 'neon': {
      b.panel(a0, a1, o, z0, z1, '#1b1426');
      for (let k = 0; k < 4; k++) { const z = z0 + h * (0.25 + 0.17 * k), x0 = a0 + w * 0.1 + r(`n${k}`) * w * 0.2; b.panel(x0, x0 + w * (0.3 + 0.3 * r(`nw${k}`)), o + 0.014, z, z + 0.045, ['#ff4fd8', '#3fe0ff', '#9dff4f', '#ffb13f'][k], true); }
      for (let a = a0 + 0.1, k = 0; a < a1 - 0.2; a += 0.22, k++) b.panel(a, a + 0.16, o + 0.008, z0 + 0.05, z0 + h * 0.2, PRODUCT[k % PRODUCT.length]);
      break;
    }
    case 'bikes': {
      // Racked bikes behind the glass: a darker shop, rows of frames.
      b.panel(a0, a1, o, z0, z1, '#3b3f42');
      for (let a = a0 + 0.2, k = 0; a < a1 - 0.5; a += 0.42, k++) { const hex = ['#1c1c1c', '#2f5d8a', '#7a1f2b', '#e8e2d2'][k % 4]; b.panel(a, a + 0.06, o + 0.01, z0 + 0.05, z0 + 0.75, hex); b.panel(a - 0.15, a + 0.25, o + 0.014, z0 + 0.62, z0 + 0.67, hex); }
      break;
    }
    case 'redGlow': {
      // Window rows: a glass door per 1.1 m, lit red or purple inside, curtains half drawn, a red tube round each.
      const doors = Math.max(1, Math.floor(w / 1.1)), dw = w / doors;
      for (let k = 0; k < doors; k++) {
        const d0 = a0 + k * dw + 0.08, d1 = a0 + (k + 1) * dw - 0.08, purple = r(`rl${k}`) < 0.3;
        b.panel(d0, d1, o, z0 - FRONT.riserM + 0.05, z1, purple ? '#8a2ad0' : '#d8102e', true);
        b.panel(d0, d0 + (d1 - d0) * (0.25 + 0.15 * r(`c${k}`)), o + 0.008, z0 - FRONT.riserM + 0.05, z1, '#5a0a1e');
        const t = 0.035, hex = look.tube ?? '#ff2a3a';
        b.panel(d0 - t, d1 + t, o + 0.008, z1, z1 + t, hex, true); b.panel(d0 - t, d0, o + 0.008, z0 - FRONT.riserM + 0.05, z1, hex, true); b.panel(d1, d1 + t, o + 0.008, z0 - FRONT.riserM + 0.05, z1, hex, true);
      }
      break;
    }
    case 'placards': {
      // A sigarenwinkel's cluttered window: cigarette-carton stacks low, lottery and tobacco placards as coloured cards
      // at every height, a blue-and-yellow lottery card or two (plain, no brand artwork).
      b.panel(a0, a1, o, z0, z1, '#3a332c');
      const CARDS = ['#d9302f', '#1a3a8f', '#ffd200', '#f4efe2', '#2f7d32', '#e8572d', '#7a1f6e', '#1d1d1b', '#c9a227'];
      for (let a = a0 + 0.04, k = 0; a < a1 - 0.08; a += 0.09, k++) b.panel(a, a + 0.07, o + 0.008, z0 + 0.02, z0 + 0.18 + 0.12 * r(`c${k}`), CARDS[Math.floor(r(`cc${k}`) * CARDS.length)], true);
      for (let k = 0; k < Math.max(4, Math.round(w * 3.5)); k++) {
        const cw = 0.16 + 0.22 * r(`w${k}`), ch = 0.12 + 0.22 * r(`h${k}`), ca = a0 + (w - cw) * r(`x${k}`), cz = z0 + 0.3 + (h - 0.3 - ch) * r(`z${k}`);
        b.panel(ca, ca + cw, o + 0.014 + 0.002 * (k % 5), cz, cz + ch, CARDS[Math.floor(r(`p${k}`) * CARDS.length)], true);
      }
      for (let k = 0; k < Math.max(1, Math.floor(w / 1.6)); k++) { const ca = a0 + 0.15 + k * 1.6; if (ca + 0.5 > a1) break; b.panel(ca, ca + 0.5, o + 0.013, z1 - 0.42, z1 - 0.08, '#1a3a8f', true); b.panel(ca + 0.05, ca + 0.45, o + 0.016, z1 - 0.3, z1 - 0.2, '#ffd200', true); }
      break;
    }
    case 'stickers': {
      b.panel(a0, a1, o, z0, z1, '#e9ece9', lit);
      for (let a = a0 + 0.1, k = 0; a < a1 - 0.3; a += 0.3, k++) b.panel(a, a + 0.24, o + 0.01, z1 - h * 0.45, z1 - h * 0.15, ['#ffdd00', '#1d1d1b', '#d9302f', '#2f6fb0'][k % 4], lit);
      for (let row = 0; row < 3; row++) for (let a = a0 + 0.15; a < a1 - 0.2; a += 0.22) b.panel(a, a + 0.14, o + 0.01, z0 + h * (0.1 + row * 0.12), z0 + h * (0.17 + row * 0.12), '#3a3a3a');
      break;
    }
    case 'jars': {
      // A notenbar: rows of glass bins, each a warm nut or fruit colour, on pale shelving.
      b.panel(a0, a1, o, z0, z1, '#f4efe2', lit);
      const NUTS = ['#b07a3c', '#d9a35a', '#7a4a22', '#e8c27a', '#9c2f2f', '#5f7d2a', '#c46a2a'];
      for (let row = 0; row < 3; row++) for (let a = a0 + 0.08, k = 0; a < a1 - 0.25; a += 0.28, k++) b.panel(a, a + 0.22, o + 0.01, z0 + h * (0.12 + row * 0.3), z0 + h * (0.34 + row * 0.3), NUTS[Math.floor(r(`j${row}:${k}`) * NUTS.length)], lit);
      break;
    }
    case 'waffles': {
      b.panel(a0, a1, o, z0, z1, '#ffe3ef', true);
      for (let row = 0; row < 3; row++) for (let a = a0 + 0.1; a < a1 - 0.15; a += 0.16) b.panel(a, a + 0.11, o + 0.01, z0 + h * (0.2 + row * 0.22), z0 + h * (0.34 + row * 0.22), row === 2 ? '#7a3b1a' : r(`w${row}${a.toFixed(2)}`) < 0.5 ? '#c98a3a' : '#e85a8c', true);
      break;
    }
  }
}

const BIKE_QUADS = bikeQuads();
/**
 * One bike side-on to the street (round 6): BIKE_QUADS as strips in the plane `o` out from the wall, rear axle at `a`,
 * wheels on `z0`, scaled by `k`; `lean` tips the top out from the wall. The frame in `hex`, tyres, saddle and bar dark.
 */
function bikeSide(b: Builder, a: number, o: number, z0: number, hex: string, k = 1, lean = 0, kx = k): void {
  const n = b.N(0, 1, 0);
  for (const q of BIKE_QUADS) {
    const dx = (q.x1 - q.x0) * kx, dz = (q.z1 - q.z0) * k, l = Math.hypot(dx, dz) || 1, px = (-dz / l) * q.w / 2 * k / kx, pz = (dx / l) * q.w / 2;
    const at = (x: number, z: number): V3 => b.P(a + x * kx, o + z * k * lean, z0 + z * k);
    const tone = q.part === 'frame' ? hex : q.part === 'wheel' ? '#161616' : '#202020';
    b.face([at(q.x0 - px, q.z0 - pz), at(q.x1 - px, q.z1 - pz), at(q.x1 + px, q.z1 + pz), at(q.x0 + px, q.z0 + pz)], n, tone);
  }
}

/**
 * Round 6: the bike shop's row against the front, side-on, two depths alternating, either side of the door: the row is
 * laid out over both runs end to end, and a bike that would cross into the doorway moves past it.
 */
function bikeRow(b: Builder, bike: NonNullable<RetailFrontInput['bike']>, s0: number, s1: number, door: { a0: number; a1: number } | null, base: number, seed: string): void {
  const runs = (door ? [[s0, door.a0 - 0.12], [door.a1 + 0.12, s1]] : [[s0, s1]] as Array<[number, number]>).filter(([r0, r1]) => r1 - r0 > 0.2);
  const rnd = (k: string) => hash01(`${seed}:bk:${k}`), len = (BIKE.wheelbase + 2 * BIKE.wheelR);
  const row = outsideBikes(bike.cls, runs.reduce((t, [r0, r1]) => t + r1 - r0, 0), rnd, bike.fleetHex);
  let run = 0, start = 0;
  for (const [k, p] of row.entries()) {
    const d = p.a - BIKE.wheelR;
    start = k === 0 ? (runs[0]?.[0] ?? 0) + d : start + d - (row[k - 1].a - BIKE.wheelR);
    if (run < runs.length && start + len > runs[run][1] + 1e-6) { run++; if (run < runs.length) start = runs[run][0] + row[0].a - BIKE.wheelR; }
    if (run >= runs.length || start + len > runs[run][1] + 1e-6) break;
    bikeSide(b, start + BIKE.wheelR, (k % 2 ? 0.52 : 0.34) + (bike.cls === 'used' ? (rnd(`o${k}`) - 0.5) * 0.08 : 0), base, p.hex, 1, p.lean);
  }
}

/** Round 6: two to four bikes side-on behind the glass (the premium shop's clean showroom bikes, the used shop's
 *  racked ones, the rental fleet's), over the window runs `segs`, scaled to fit under the door head. */
function windowBikes(b: Builder, bike: NonNullable<RetailFrontInput['bike']>, segs: ReadonlyArray<[number, number]>, zr: number, head: number, seed: string): void {
  // A narrow pane takes its bikes angled (foreshortened along the street to 0.6), as a showroom stands them.
  const k = Math.min(1, (head - zr - 0.08) / 1.08), full = (BIKE.wheelbase + 2 * BIKE.wheelR) * k;
  const rnd = (t: string) => hash01(`${seed}:bw:${t}`);
  const want = bike.cls === 'premium' ? 2 + Math.floor(rnd('n') * 3) : bike.cls === 'used' ? 2 + Math.floor(rnd('n') * 2) : 2;
  let left = want, i = 0;
  for (const [c0, c1] of segs) {
    const kx = k * Math.max(0.6, Math.min(1, (c1 - c0 - 0.1) / full)), span = full * kx / k, step = span * 0.72;
    if (c1 - c0 - 0.1 < span - 1e-6) continue;
    const m = Math.min(left, Math.floor((c1 - c0 - 0.1 - span) / step) + 1);
    for (let j = 0; j < m; j++, i++) {
      const hex = bike.cls === 'rental' ? bike.fleetHex ?? '#2a2a2a' : bike.cls === 'premium' ? SHOW_HEXES[Math.floor(rnd(`h${i}`) * SHOW_HEXES.length)] : USED_HEXES[Math.floor(rnd(`h${i}`) * USED_HEXES.length)];
      const a = c0 + 0.05 + BIKE.wheelR * kx + ((c1 - c0 - 0.1 - span) - (m - 1) * step) / 2 + j * step;
      bikeSide(b, a, FRONT.contentOutM + 0.012 + (j % 2) * 0.004, zr + 0.04, hex, k, 0, kx);
    }
    left -= m;
  }
}

/** What stands on the pavement in front of the shop. */
function pavement(b: Builder, look: TemplateLook, a0: number, a1: number, base: number, seed: string): void {
  if (!look.pavement) return;
  if (look.pavement === 'crates') {
    for (let a = a0 + 0.3, k = 0; a < a1 - 0.6; a += 0.62, k++) {
      // Round 3c (cost): front and top of each crate and of the produce in it.
      b.slab(a, a + 0.52, 0.15, 0.75, base, base + 0.62, '#7a5a3a', 'top');
      b.slab(a + 0.02, a + 0.5, 0.17, 0.73, base + 0.62, base + 0.7, PRODUCT[Math.floor(hash01(`${seed}:cr${k}`) * PRODUCT.length)], 'top');
    }
  } else if (look.pavement === 'racks' || look.pavement === 'boards') {
    for (const a of [a0 + 0.4, a1 - 1.0]) if (a + 0.6 <= a1 && a >= a0) {
      b.box(a, a + 0.6, 0.3, 0.42, base, base + (look.pavement === 'racks' ? 1.6 : 0.9), look.pavement === 'racks' ? '#d9d4c7' : '#5a4632');
      b.panel(a + 0.04, a + 0.56, 0.425, base + 0.3, base + (look.pavement === 'racks' ? 1.5 : 0.85), look.pavement === 'racks' ? look.rack ?? '#2f6fb0' : '#c9a227');
    }
  } else if (look.pavement === 'flowers') {
    // A bloemist's display (round 6): a low timber table along the front with pots of greens and blooms on it, and a
    // row of zinc buckets of cut flowers on the pavement before it. Fronts and tops only.
    const BLOOMS = ['#e85a8c', '#f2c21b', '#f4efe2', '#c8262d', '#8a4fb0', '#f08a2a', '#f7a8c4'], LEAF = ['#3d6b35', '#4f7a3a', '#2f5a30'];
    const r = (k: string) => hash01(`${seed}:fl:${k}`);
    for (const [t0, t1] of [[a0 + 0.2, a0 + Math.min(2.4, (a1 - a0) * 0.45)], [a1 - Math.min(2.4, (a1 - a0) * 0.45), a1 - 0.2]] as const) {
      if (t1 - t0 < 0.6) continue;
      b.slab(t0, t1, 0.25, 0.85, base + 0.62, base + 0.68, '#6b4e33', 'top');
      b.panel(t0 + 0.04, t0 + 0.1, 0.8, base, base + 0.62, '#4a3624');
      b.panel(t1 - 0.1, t1 - 0.04, 0.8, base, base + 0.62, '#4a3624');
      // Each pot: its terracotta front, then one mass of leaf or bloom (front and top) over it.
      for (let a = t0 + 0.06, k = 0; a < t1 - 0.2; a += 0.26, k++) {
        const h = 0.16 + r(`h${t0}${k}`) * 0.22, bloom = r(`b${t0}${k}`) < 0.7;
        b.panel(a, a + 0.18, 0.62, base + 0.68, base + 0.8, '#a0522d');
        b.slab(a - 0.03, a + 0.21, 0.42, 0.6, base + 0.8, base + 0.8 + h, bloom ? BLOOMS[Math.floor(r(`c${t0}${k}`) * BLOOMS.length)] : LEAF[k % LEAF.length], 'top');
      }
      // Buckets on the pavement: the zinc front, the bunch over it.
      for (let a = t0 + 0.1, k = 0; a < t1 - 0.25; a += 0.32, k++) {
        b.panel(a, a + 0.24, 1.05, base, base + 0.32, '#8d9396');
        b.slab(a - 0.03, a + 0.27, 0.92, 1.07, base + 0.32, base + 0.55 + r(`s${t0}${k}`) * 0.15, BLOOMS[Math.floor(r(`d${t0}${k}`) * BLOOMS.length)], 'top');
      }
    }
  } else if (look.pavement === 'bikes') {
    // A row of bikes parked nose-in to the wall (side-on to the street): wheel discs as thin boxes, a top tube.
    for (let a = a0 + 0.3, k = 0; a < a1 - 0.3; a += 0.55, k++) {
      const hex = ['#1c1c1c', '#2a3a48', '#7a1f2b', '#2f5d3a'][k % 4];
      // Round 3c (cost): the wheels as their two discs (faces along the street), the top tube as its top.
      const P = b.P.bind(b), N = b.N.bind(b);
      b.face([P(a, 0.25, base + 0.6), P(a + 0.05, 0.25, base + 0.6), P(a + 0.05, 0.9, base + 0.6), P(a, 0.9, base + 0.6)], [0, 0, 1], hex);
      for (const o of [0.35, 0.8]) for (const [x, n] of [[a - 0.01, -1], [a + 0.06, 1]] as const) b.face([P(x, o - 0.3, base), P(x, o + 0.3, base), P(x, o + 0.3, base + 0.62), P(x, o - 0.3, base + 0.62)], N(n, 0, 0), '#2a2a2a');
    }
  }
}

export type RetailFrontInput = {
  template: RetailTemplate; word?: string; seed: string;
  /** A traced door (row-front ground box) over [a0, a1] metres along the wall: drawn set back `depthM` into a hole the
   *  mesher cuts (retailFrontCut). Absent: one flush door at an end of the front. */
  door?: { a0: number; a1: number; depthM: number };
  /** The chain's logo: the logo layer and its rect there (retailLogos.ts). */
  logo?: { layer: number; rect: readonly [number, number, number, number]; aspect: number };
  /** Round 3c: the logo layer, whose lettering cell letters the name; absent: no lettering (a plain board). */
  letters?: number;
  /** Round 3c: the building's shop cell and its glass's uv rect: each pane's interior is one quad of it. Absent: the
   *  flat-colour goods. */
  interior?: { layer: number; rect: readonly [number, number, number, number] };
  /** Round 4: the pui paint measured on a street panorama (measure-pui.ts), in the look's palette; it paints the frame
   *  (bead, posts, mullions, transom) in place of the template's, and (round 5b) on a front with no chain logo also the
   *  fascia board and cap, the letters in a contrasting dark or white: the photos' independent shops (Keurslagerij Pouw)
   *  paint board and frame one colour. Absent: the template's frame and board. */
  paint?: string;
  /** Round 6: a bike shop's class (retailBikes.ts bikeShopClass, staged per pand): side-on bikes parked against the
   *  front (used: a muted irregular row; premium: a neat clean row; rental: the fleet's identical bikes) and two to
   *  four side-on behind the glass. Absent: the template's racks and pavement discs. */
  bike?: { cls: BikeClass; fleetHex?: string };
  /** Round 7: the awning measured on a street panorama (measure-awning.ts, staged per pand), over the window in this
   *  colour, in place of the template's (the black awnings of Unique Eyefashion, Gall & Gall). Absent: the template's. */
  awning?: string;
};

/** Where the door's head stands: under the fascia, at most FRONT.doorHeadM. */
export function doorHead(base: number, groundM: number): number {
  const top = base + Math.min(Math.max(2.8, groundM), 4.6) - FRONT.fasciaGapM;
  return Math.min(base + FRONT.doorHeadM, top - FRONT.fasciaM - 0.15);
}

/**
 * The front's door over [s0, s1] (round 3): the traced one, else one at the end the seed picks, inside the end post.
 * Every door is set back in a recess (round 3: Amsterdam shop doors stand in a portiek; a flush door on the glass line
 * was the round-2 default and read as a painted panel). Window rows (red-light) have none. The mesher cuts the wall
 * over the returned span (threeBuildingMesh retailFrontOn), so the recess is open.
 */
export function retailDoor(input: Pick<RetailFrontInput, 'template' | 'door' | 'seed'>, s0: number, s1: number): { a0: number; a1: number; depthM: number } | null {
  const look = TEMPLATE_LOOKS[input.template];
  if (look.content === 'redGlow' || s1 - s0 < 1.2) return null;
  if (input.door) {
    const a0 = Math.max(s0 + FRONT.postM, input.door.a0), a1 = Math.min(s1 - FRONT.postM, input.door.a1);
    return a1 - a0 > 0.5 ? { a0, a1, depthM: input.door.depthM > 0 ? input.door.depthM : FRONT.recessM } : null;
  }
  const w = Math.min(look.doorM ?? FRONT.doorM, (s1 - s0) * 0.25);
  if (w <= 0.5) return null;
  const atStart = hash01(`${input.seed}:door`) < 0.5;
  return atStart ? { a0: s0 + FRONT.postM, a1: s0 + FRONT.postM + w, depthM: FRONT.recessM } : { a0: s1 - FRONT.postM - w, a1: s1 - FRONT.postM, depthM: FRONT.recessM };
}

/** A shop door: a slim frame round a tall glass leaf over a kick plate; at `o` from the wall. */
function doorUnit(b: Builder, d0: number, d1: number, o: number, base: number, head: number, frame: string): void {
  const f = 0.06;
  b.panel(d0, d1, o, base, head, frame);
  b.panel(d0 + f, d1 - f, o + 0.01, base + 0.28, head - f, glassTone('#4a4642', 0.6));
  // Round 3c (cost): the leaf's reflection and the handle are gone; in the recess's shadow they read as nothing.
}

/** A hex's relative luminance (linear sRGB, Rec. 709). */
function hexLuma(hex: string): number {
  const n = parseInt(hex.slice(1), 16), lin = (v: number) => { const c = v / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
}
/** A hex a step darker (k < 1) or lighter (k > 1), kept in gamut. */
function shadeHex(hex: string, k: number): string {
  const n = parseInt(hex.slice(1), 16);
  return '#' + [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(v => Math.max(0, Math.min(255, Math.round(k > 1 ? v + (255 - v) * (k - 1) : v * k)))).map(v => v.toString(16).padStart(2, '0')).join('');
}

/**
 * The glass over [a0, a1] x [z0, z1] (round 3): what is behind it (the template's content, darkened and warmed) with
 * the street's reflection over the upper part: three bands from a pale sky grey-blue down into the interior, the way
 * shop glass reads by day (the round-2 glass was one flat sheet of content and read as a painted board).
 */
function glass(b: Builder, look: TemplateLook, a0: number, a1: number, z0: number, z1: number, seed: string): void {
  const first = b.out.length;
  content(b, look, a0, a1, z0, z1, seed);
  if (!OWN_LIGHT.has(look.content)) for (const t of b.out.slice(first)) t.hex = glassTone(t.hex, look.lit ? 0.62 : 0.68);
  if (look.content === 'redGlow') return;
  const h = (z1 - z0) * FRONT.reflectShare, o = FRONT.contentOutM + 0.025;
  REFLECT.forEach((hex, k) => b.panel(a0, a1, o, z1 - h * (k + 1) / REFLECT.length, z1 - h * k / REFLECT.length, hex));
}
// Round 3b tone: the photos' shop glass measures darker than round 3's sky (mean ground L 0.37 against 0.43 drawn).
const REFLECT = ['#7d878e', '#5f676c'] as const;

/**
 * The template's front on the wall `e` over [s0, s1] (metres along it), ground storey [base, base + groundM].
 * Returns flat triangles; nothing for a span under 1.2 m.
 *
 * Round 3 (lane retail-look-20261114; David: the shops looked "very cheap and out of place"): a pui built like the
 * photos' rather than a dark box with a sticker sheet in it. A fascia board under a projecting cornice cap and over a
 * bead; slim posts at both ends; glass from a panelled stall riser with a sill up to a transom bar at the door head,
 * divided by slim mullions at most FRONT.paneMaxM apart, with a band of transom lights (bovenlichten) over it; the door
 * always in a recess; the glass reflecting the street over its upper third.
 */
export function retailFrontTris(input: RetailFrontInput, e: WallFrame, s0: number, s1: number, base: number, groundM: number): FrontTri[] {
  const look = TEMPLATE_LOOKS[input.template];
  if (s1 - s0 < 1.2) return [];
  const b = new Builder(e);
  const top = base + Math.min(Math.max(2.8, groundM), 4.6) - FRONT.fasciaGapM, bottom = top - FRONT.fasciaM;
  const frame = input.paint ?? look.frame ?? '#2b2724', head = doorHead(base, groundM), puiTop = bottom - FRONT.beadM;
  const timber = look.surround ?? frame, riser = look.surround ?? shadeHex(frame, 1.12);
  // Fascia board, a cornice cap over it (a step darker, standing further out) and a bead under it.
  // Round 3c (cost): each member draws the faces a rider sees (Builder.slab): the board and cap their front, underside
  // and the board's ends, the cap and bead their front and underside.
  const board = input.paint && !input.logo ? input.paint : look.fascia, cap = input.paint && !input.logo ? shadeHex(input.paint, 0.85) : look.cap ?? shadeHex(look.fascia, 0.72);
  const ink = input.paint && !input.logo ? (hexLuma(input.paint) > 0.35 ? '#2b2724' : '#f4f1ea') : look.letters;
  b.slab(s0, s1, 0.01, FRONT.fasciaOutM, bottom, top, board, 'bottom', true, look.lit);
  b.slab(s0 - 0.04, s1 + 0.04, 0.01, FRONT.capOutM, top, top + FRONT.capM, cap, 'bottom');
  b.slab(s0, s1, 0.01, FRONT.fasciaOutM - 0.02, puiTop, bottom, frame, 'bottom');
  const word = look.word === 'name' ? (input.word ? signText(input.word) : input.word) : look.word;
  if (input.logo) {
    const hM = FRONT.fasciaM - 0.1, wM = Math.min(s1 - s0 - 0.4, hM * input.logo.aspect), mid = (s0 + s1) / 2;
    b.textured(mid - wM / 2, mid + wM / 2, FRONT.fasciaOutM + FRONT.letterOutM, bottom + 0.05, bottom + 0.05 + (wM / input.logo.aspect), input.logo.layer, input.logo.rect);
  } else if (word) b.word(word, s0 + 0.2, s1 - 0.2, (top + bottom) / 2, FRONT.fasciaOutM + FRONT.letterOutM, MAX_LETTER_H, ink, board, look.lit, input.letters);
  const windows = look.content === 'redGlow';
  // End posts: the pui's frame against the neighbours, in the timber or the frame colour.
  if (!windows) { b.fin(s0, s0 + FRONT.postM, 0, FRONT.frameOutM, base, puiTop, timber); b.fin(s1 - FRONT.postM, s1, 0, FRONT.frameOutM, base, puiTop, timber); }
  const door = retailDoor(input, s0, s1);
  if (door) {
    const d = door.depthM, { a0: d0, a1: d1 } = door;
    // The recess: reveals, soffit and a tiled step floor, the door at the back (the mesher cuts the wall over [d0, d1] x [base, head]).
    // Round 3b tone: the recess reads as a deep shadow in the photos, not a lit reveal.
    const rev = shadeHex(timber, 0.6);
    b.face([b.P(d0, -d, base), b.P(d0, 0, base), b.P(d0, 0, head), b.P(d0, -d, head)], b.N(1, 0, 0), rev);
    b.face([b.P(d1, -d, base), b.P(d1, 0, base), b.P(d1, 0, head), b.P(d1, -d, head)], b.N(-1, 0, 0), rev);
    b.face([b.P(d0, -d, head), b.P(d1, -d, head), b.P(d1, 0, head), b.P(d0, 0, head)], [0, 0, -1], '#2a2622');
    b.face([b.P(d0, -d, base + 0.02), b.P(d1, -d, base + 0.02), b.P(d1, 0, base + 0.02), b.P(d0, 0, base + 0.02)], [0, 0, 1], '#4a4540');
    doorUnit(b, d0, d1, -d, base + 0.02, head, frame);
    // Frame round the opening on the glass line, and the transom light over it.
    b.panel(d0 - FRONT.mullionM, d0, FRONT.frameOutM - 0.02, base, puiTop, frame);
    b.panel(d1, d1 + FRONT.mullionM, FRONT.frameOutM - 0.02, base, puiTop, frame);
  }
  // The glass either side of the door: riser, sill, glass to the transom bar, mullions, the transom lights above.
  const zr = base + FRONT.riserM;
  const segs: Array<[number, number]> = windows ? [[s0 + 0.1, s1 - 0.1]]
    : door ? [[s0 + FRONT.postM, door.a0 - FRONT.mullionM], [door.a1 + FRONT.mullionM, s1 - FRONT.postM]] : [[s0 + FRONT.postM, s1 - FRONT.postM]];
  const lightHex = glassTone('#7f8b93', 0.5);
  if (door && puiTop - head > 0.25) b.panel(door.a0, door.a1, FRONT.contentOutM, head + FRONT.transomM, puiTop, lightHex);
  if (door && puiTop - head > 0.25) b.slab(door.a0, door.a1, 0, FRONT.frameOutM - 0.03, head, head + FRONT.transomM, frame, 'bottom');
  for (const [c0, c1] of segs) {
    if (c1 - c0 < 0.4) { if (c1 > c0) b.fin(c0, c1, 0, FRONT.frameOutM - 0.02, base, puiTop, timber); continue; }
    if (windows) { content(b, look, c0, c1, zr, puiTop - FRONT.headGapM, input.seed); continue; }
    const panes = Math.max(1, Math.ceil((c1 - c0) / (look.paneM ?? FRONT.paneMaxM))), pw = (c1 - c0) / panes;
    // Stall riser in the riser colour, a sill over it (round 3c: one riser panel; the per-pane sunk panels were 2 tris a
    // pane nobody reads at ride distance).
    b.panel(c0, c1, 0.015, base, zr, riser);
    b.slab(c0 - 0.02, c1 + 0.02, 0, FRONT.sillOutM + 0.03, zr - 0.05, zr, frame, 'top');
    if (input.interior && !OWN_LIGHT.has(look.content) && look.content !== 'barGlow') {
      // Round 3c (cost): each pane's interior is one quad of the building's own shop cell (bayTextures puiAt: its dark
      // interior, shelf glow and the street's reflection), in place of the flat-colour goods.
      for (let k = 0; k < panes; k++) {
        const first = b.out.length;
        b.textured(c0 + k * pw, c0 + (k + 1) * pw, FRONT.contentOutM, zr, head, input.interior.layer, input.interior.rect);
        for (const t of b.out.slice(first)) delete t.lit;
      }
    } else glass(b, look, c0, c1, zr, head, input.seed);
    // The transom bar at the door head, the transom lights over it (dark glass with the sky in it).
    const hasLights = puiTop - head > 0.25;
    if (hasLights) {
      b.slab(c0, c1, 0, FRONT.frameOutM - 0.03, head, head + FRONT.transomM, frame, 'bottom');
      b.panel(c0, c1, FRONT.contentOutM, head + FRONT.transomM, puiTop, lightHex);
    }
    // Mullions: their fronts only (round 3c: the 6 cm ends were 4 tris each).
    for (let k = 1; k < panes; k++) { const a = c0 + k * pw; b.panel(a - FRONT.mullionM / 2, a + FRONT.mullionM / 2, FRONT.frameOutM - 0.03, zr, puiTop, frame); }
    // Transom lights carry their own glazing bars (two per pane) on cafés and small-paned fronts.
    if (hasLights && look.paneM) for (let k = 0; k < panes; k++) for (const t of [1 / 3, 2 / 3]) { const a = c0 + (k + t) * pw; b.panel(a - 0.02, a + 0.02, 0.055, head + FRONT.transomM, puiTop, frame); }
  }
  const awning = input.awning ?? look.awning;
  if (awning) b.slope(s0, s1, 1.1, bottom - 0.05, bottom - 0.55, awning);
  if (look.blade) {
    const at = door && door.a0 < (s0 + s1) / 2 ? s0 + 0.3 : s1 - 0.3;
    b.box(at - 0.03, at + 0.03, 0.05, 0.9, top + 0.35, top + 0.4, '#2a2a2a', false, true);
    b.box(at - 0.05, at + 0.05, 0.25, 0.85, top - 0.2, top + 0.35, look.blade, look.lit, true);
  }
  if (input.bike && look.pavement === 'bikes') {
    if (!windows) windowBikes(b, input.bike, segs.filter(([c0, c1]) => c1 - c0 >= 0.4), zr, head, input.seed);
    bikeRow(b, input.bike, s0, s1, door, base, input.seed);
  } else pavement(b, look, s0, s1, base, input.seed);
  return b.out;
}
