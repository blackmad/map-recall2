// Shopfront templates as geometry (lane retail-ground-20261114, `?retailGround=1`): a fascia board with the chain's
// or the business's lettering, window content just proud of the glass, and what stands on the pavement, built on the
// street wall nearest the POI. Flat-colour triangles in the sign layer (threeBuildingMesh SignTri), so no texture
// layer is spent: the atlas has two free layers. Pure (no DOM): runs in the mesh worker and in Node tests.
import { wordRuns } from './blockLetters.js';
import { TEMPLATE_LOOKS, type RetailTemplate, type TemplateLook } from './retailTemplates.js';

export type V3 = [number, number, number];
export type FrontTri = { p: V3[]; hex: string; n: V3; lit?: boolean };
/** The wall: origin, unit direction along it, outward normal (x along, y out, z up). */
export type WallFrame = { x0: number; y0: number; ux: number; uy: number; nx: number; ny: number };

/** Measured proportions (Haarlemmerdijk traces, retailTemplates.ts PUI): fascia 0.6 m under the ground storey top. */
export const FRONT = {
  /** Board under the ground storey's top (m), its height and how far it stands out. */
  fasciaGapM: 0.12, fasciaM: 0.6, fasciaOutM: 0.12,
  /** The window content's zone: from the stall riser to a little under the fascia. */
  riserM: 0.5, headGapM: 0.18,
  /** Window content stands this far proud of the wall (the glass plane in the texture). */
  contentOutM: 0.02,
  /** At most this much of a long wall carries one template front (m). */
  maxSpanM: 14,
} as const;

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
  /** A box: front, both ends and the top (and the bottom when it floats). */
  box(a0: number, a1: number, o0: number, o1: number, z0: number, z1: number, hex: string, lit?: boolean, bottom = false): void {
    const P = this.P.bind(this), N = this.N.bind(this);
    this.face([P(a0, o1, z0), P(a1, o1, z0), P(a1, o1, z1), P(a0, o1, z1)], N(0, 1, 0), hex, lit);
    this.face([P(a0, o0, z0), P(a0, o1, z0), P(a0, o1, z1), P(a0, o0, z1)], N(-1, 0, 0), hex, lit);
    this.face([P(a1, o0, z0), P(a1, o1, z0), P(a1, o1, z1), P(a1, o0, z1)], N(1, 0, 0), hex, lit);
    this.face([P(a0, o0, z1), P(a1, o0, z1), P(a1, o1, z1), P(a0, o1, z1)], [0, 0, 1], hex, lit);
    if (bottom) this.face([P(a0, o0, z0), P(a1, o0, z0), P(a1, o1, z0), P(a0, o1, z0)], [0, 0, -1], hex, lit);
  }
  /** A sloped awning from the wall at z0 out to `out` at z1. */
  slope(a0: number, a1: number, out: number, z0: number, z1: number, hex: string): void {
    const n = this.N(0, z0 - z1, out), l = Math.hypot(...n);
    this.face([this.P(a0, 0.02, z0), this.P(a1, 0.02, z0), this.P(a1, out, z1), this.P(a0, out, z1)], [n[0] / l, n[1] / l, n[2] / l], hex);
    this.panel(a0, a1, out, z1 - 0.18, z1, hex);
  }
  /** The block-letter word centred on [a0, a1] at height zMid, cells of at most `maxCell` m. */
  word(text: string, a0: number, a1: number, zMid: number, o: number, maxCell: number, hex: string, lit: boolean): void {
    const { runs, width } = wordRuns(text);
    if (!runs.length) return;
    const cell = Math.min(maxCell, (a1 - a0) / Math.max(1, width));
    if (cell < 0.02) return;
    const w0 = (a0 + a1) / 2 - (width * cell) / 2;
    for (const r of runs) this.panel(w0 + r.c0 * cell, w0 + r.c1 * cell, o, zMid + (3.5 - r.row - 1) * cell, zMid + (3.5 - r.row) * cell, hex, lit);
  }
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
      for (let row = 0; row < rows; row++) {
        const zr0 = z0 + h * (row + 0.18) / rows, zr1 = z0 + h * (row + 0.8) / rows;
        for (let a = a0 + 0.05, k = 0; a < a1 - step * 0.6; a += step, k++) {
          const hex = look.content === 'ducks' ? (r(`d${row}:${k}`) < 0.88 ? '#ffd21f' : '#ff8a1f')
            : look.content === 'cheese' ? (r(`c${row}:${k}`) < 0.7 ? '#f2c230' : '#e0a21c')
            : look.content === 'bread' ? (r(`b${row}:${k}`) < 0.5 ? '#c98a3a' : '#a8692c')
            : look.content === 'books' ? SPINES[Math.floor(r(`s${row}:${k}`) * SPINES.length)]
            : look.content === 'souvenirs' ? ['#1f4f9c', '#ffffff', '#e8572d', '#d9302f', '#f2b92e'][Math.floor(r(`v${row}:${k}`) * 5)]
            : look.content === 'deli' ? (row === 0 ? '#c9b79a' : PRODUCT[Math.floor(r(`p${row}:${k}`) * PRODUCT.length)])
            : PRODUCT[Math.floor(r(`p${row}:${k}`) * PRODUCT.length)];
          b.panel(a, a + step * (look.content === 'books' ? 0.85 : 0.82), o + 0.005, zr0, look.content === 'books' ? zr1 - r(`h${row}:${k}`) * 0.06 : zr1, hex, lit);
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
      for (let c = 0; c < cols; c++) for (let row = 0; row < rows; row++) b.panel(a0 + c * cw + 0.04, a0 + (c + 1) * cw - 0.04, o + 0.005, z0 + row * ch + 0.04, z0 + (row + 1) * ch - 0.04, r(`f${c}:${row}`) < 0.85 ? '#ffd27a' : '#e8a23a', true);
      break;
    }
    case 'barGlow': case 'curtains': {
      // A brown cafe: dark timber, small panes over a warm glow, a lace (or checked) curtain across the lower half.
      b.panel(a0, a1, o, z0, z1, '#d58a2e', true);
      b.panel(a0, a1, o + 0.004, z0, z0 + h * 0.5, look.content === 'curtains' ? '#e8e2d2' : '#efe6d2', false);
      if (look.content === 'curtains') for (let a = a0, k = 0; a < a1; a += 0.12, k++) if (k % 2) b.panel(a, Math.min(a1, a + 0.12), o + 0.008, z0 + h * 0.25, z0 + h * 0.5, '#b8302a');
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
        b.panel(a0 + k * mw + 0.05, a0 + (k + 1) * mw - 0.05, o + 0.005, z1 - h * 0.32, z1 - 0.05, look.content === 'menu' ? '#2a2a2a' : '#fff6d8', true);
        for (let line = 0; line < 4; line++) b.panel(a0 + k * mw + 0.12, a0 + k * mw + mw * (0.5 + 0.4 * r(`l${k}:${line}`)), o + 0.01, z1 - h * 0.3 + line * h * 0.065, z1 - h * 0.3 + line * h * 0.065 + 0.03, look.content === 'menu' ? '#f6e27a' : '#7a1f12', true);
      }
      b.box(a0 + 0.05, a1 - 0.05, o, o + 0.1, z0, z0 + h * 0.42, look.content === 'menu' ? '#b03024' : '#b9bcbd', false);
      if (look.content === 'bainMarie') for (let a = a0 + 0.12; a < a1 - 0.3; a += 0.32) b.panel(a, a + 0.26, o + 0.105, z0 + h * 0.34, z0 + h * 0.42, r(`t${a.toFixed(2)}`) < 0.5 ? '#d9822b' : '#b4482a', true);
      if (look.content === 'menu') b.box(a0 + w * 0.15, a0 + w * 0.15 + 0.22, o + 0.1, o + 0.32, z0 + h * 0.42, z0 + h * 0.85, '#8a4a22', true);
      break;
    }
    case 'meat': {
      b.panel(a0, a1, o, z0, z1, '#f4f4f2', lit);
      for (let a = a0 + 0.1; a < a1 - 0.2; a += 0.25) b.panel(a, a + 0.18, o + 0.005, z0 + h * 0.3, z0 + h * 0.42, r(`m${a.toFixed(2)}`) < 0.5 ? '#b3262b' : '#d9707a', lit);
      b.box(a0 + 0.05, a1 - 0.05, o, o + 0.1, z0, z0 + h * 0.3, '#e6e6e4', lit);
      break;
    }
    case 'produce': case 'bowls': {
      b.panel(a0, a1, o, z0, z1, look.content === 'bowls' ? '#f4f6ef' : '#5a5148', lit);
      for (let a = a0 + 0.1, k = 0; a < a1 - 0.3; a += 0.35, k++) {
        b.panel(a, a + 0.28, o + 0.005, z0 + h * 0.25, z0 + h * 0.45, look.content === 'bowls' ? '#3f8f4a' : PRODUCT[Math.floor(r(`g${k}`) * PRODUCT.length)], lit);
        if (look.content === 'bowls') b.panel(a + 0.04, a + 0.24, o + 0.01, z0 + h * 0.6, z0 + h * 0.85, '#6aa84f', lit);
      }
      break;
    }
    case 'frosted': {
      // A coffeeshop: frosted or painted glass, dark inside, the green-and-white licence sticker by the door.
      b.panel(a0, a1, o, z0, z1, '#9fae9a');
      b.panel(a0, a1, o + 0.004, z0 + h * 0.62, z1, '#24302a');
      b.panel(a1 - 0.35, a1 - 0.17, o + 0.008, z0 + h * 0.45, z0 + h * 0.57, '#1f8a3a', true);
      b.panel(a1 - 0.33, a1 - 0.19, o + 0.012, z0 + h * 0.48, z0 + h * 0.54, '#ffffff', true);
      break;
    }
    case 'neon': {
      b.panel(a0, a1, o, z0, z1, '#1b1426');
      for (let k = 0; k < 4; k++) { const z = z0 + h * (0.25 + 0.17 * k), x0 = a0 + w * 0.1 + r(`n${k}`) * w * 0.2; b.panel(x0, x0 + w * (0.3 + 0.3 * r(`nw${k}`)), o + 0.006, z, z + 0.045, ['#ff4fd8', '#3fe0ff', '#9dff4f', '#ffb13f'][k], true); }
      for (let a = a0 + 0.1, k = 0; a < a1 - 0.2; a += 0.22, k++) b.panel(a, a + 0.16, o + 0.004, z0 + 0.05, z0 + h * 0.2, PRODUCT[k % PRODUCT.length]);
      break;
    }
    case 'bikes': {
      // Racked bikes behind the glass: a darker shop, rows of frames.
      b.panel(a0, a1, o, z0, z1, '#3b3f42');
      for (let a = a0 + 0.2, k = 0; a < a1 - 0.5; a += 0.42, k++) { const hex = ['#1c1c1c', '#2f5d8a', '#7a1f2b', '#e8e2d2'][k % 4]; b.panel(a, a + 0.06, o + 0.005, z0 + 0.05, z0 + 0.75, hex); b.panel(a - 0.15, a + 0.25, o + 0.006, z0 + 0.62, z0 + 0.67, hex); }
      break;
    }
    case 'redGlow': {
      // Window rows: a glass door per 1.1 m, lit red or purple inside, curtains half drawn, a red tube round each.
      const doors = Math.max(1, Math.floor(w / 1.1)), dw = w / doors;
      for (let k = 0; k < doors; k++) {
        const d0 = a0 + k * dw + 0.08, d1 = a0 + (k + 1) * dw - 0.08, purple = r(`rl${k}`) < 0.3;
        b.panel(d0, d1, o, z0 - FRONT.riserM + 0.05, z1, purple ? '#8a2ad0' : '#d8102e', true);
        b.panel(d0, d0 + (d1 - d0) * (0.25 + 0.15 * r(`c${k}`)), o + 0.004, z0 - FRONT.riserM + 0.05, z1, '#5a0a1e');
        const t = 0.035, hex = look.tube ?? '#ff2a3a';
        b.panel(d0 - t, d1 + t, o + 0.008, z1, z1 + t, hex, true); b.panel(d0 - t, d0, o + 0.008, z0 - FRONT.riserM + 0.05, z1, hex, true); b.panel(d1, d1 + t, o + 0.008, z0 - FRONT.riserM + 0.05, z1, hex, true);
      }
      break;
    }
    case 'stickers': {
      b.panel(a0, a1, o, z0, z1, '#e9ece9', lit);
      for (let a = a0 + 0.1, k = 0; a < a1 - 0.3; a += 0.3, k++) b.panel(a, a + 0.24, o + 0.005, z1 - h * 0.45, z1 - h * 0.15, ['#ffdd00', '#1d1d1b', '#d9302f', '#2f6fb0'][k % 4], lit);
      for (let row = 0; row < 3; row++) for (let a = a0 + 0.15; a < a1 - 0.2; a += 0.22) b.panel(a, a + 0.14, o + 0.005, z0 + h * (0.1 + row * 0.12), z0 + h * (0.17 + row * 0.12), '#3a3a3a');
      break;
    }
    case 'jars': {
      // A notenbar: rows of glass bins, each a warm nut or fruit colour, on pale shelving.
      b.panel(a0, a1, o, z0, z1, '#f4efe2', lit);
      const NUTS = ['#b07a3c', '#d9a35a', '#7a4a22', '#e8c27a', '#9c2f2f', '#5f7d2a', '#c46a2a'];
      for (let row = 0; row < 3; row++) for (let a = a0 + 0.08, k = 0; a < a1 - 0.25; a += 0.28, k++) b.panel(a, a + 0.22, o + 0.005, z0 + h * (0.12 + row * 0.3), z0 + h * (0.34 + row * 0.3), NUTS[Math.floor(r(`j${row}:${k}`) * NUTS.length)], lit);
      break;
    }
    case 'waffles': {
      b.panel(a0, a1, o, z0, z1, '#ffe3ef', true);
      for (let row = 0; row < 3; row++) for (let a = a0 + 0.1; a < a1 - 0.15; a += 0.16) b.panel(a, a + 0.11, o + 0.005, z0 + h * (0.2 + row * 0.22), z0 + h * (0.34 + row * 0.22), row === 2 ? '#7a3b1a' : r(`w${row}${a.toFixed(2)}`) < 0.5 ? '#c98a3a' : '#e85a8c', true);
      break;
    }
  }
}

/** What stands on the pavement in front of the shop. */
function pavement(b: Builder, look: TemplateLook, a0: number, a1: number, base: number, seed: string): void {
  if (!look.pavement) return;
  if (look.pavement === 'crates') {
    for (let a = a0 + 0.3, k = 0; a < a1 - 0.6; a += 0.62, k++) {
      b.box(a, a + 0.52, 0.15, 0.75, base, base + 0.62, '#7a5a3a');
      b.box(a + 0.02, a + 0.5, 0.17, 0.73, base + 0.62, base + 0.7, PRODUCT[Math.floor(hash01(`${seed}:cr${k}`) * PRODUCT.length)]);
    }
  } else if (look.pavement === 'racks' || look.pavement === 'boards') {
    for (const a of [a0 + 0.4, a1 - 1.0]) if (a + 0.6 <= a1 && a >= a0) {
      b.box(a, a + 0.6, 0.3, 0.42, base, base + (look.pavement === 'racks' ? 1.6 : 0.9), look.pavement === 'racks' ? '#d9d4c7' : '#5a4632');
      b.panel(a + 0.04, a + 0.56, 0.425, base + 0.3, base + (look.pavement === 'racks' ? 1.5 : 0.85), look.pavement === 'racks' ? '#2f6fb0' : '#c9a227');
    }
  } else if (look.pavement === 'bikes') {
    // A row of bikes parked nose-in to the wall (side-on to the street): wheel discs as thin boxes, a top tube.
    for (let a = a0 + 0.3, k = 0; a < a1 - 0.3; a += 0.55, k++) {
      const hex = ['#1c1c1c', '#2a3a48', '#7a1f2b', '#2f5d3a'][k % 4];
      b.box(a, a + 0.05, 0.25, 0.9, base + 0.55, base + 0.6, hex);
      for (const o of [0.35, 0.8]) b.box(a - 0.01, a + 0.06, o - 0.3, o + 0.3, base, base + 0.62, '#2a2a2a');
    }
  }
}

export type RetailFrontInput = { template: RetailTemplate; word?: string; seed: string };
/**
 * The template's front on the wall `e` over [s0, s1] (metres along it), ground storey [base, base + groundM].
 * Returns flat triangles; nothing for a span under 1.2 m.
 */
export function retailFrontTris(input: RetailFrontInput, e: WallFrame, s0: number, s1: number, base: number, groundM: number): FrontTri[] {
  const look = TEMPLATE_LOOKS[input.template];
  if (s1 - s0 < 1.2) return [];
  const b = new Builder(e);
  const top = base + Math.min(Math.max(2.8, groundM), 4.6) - FRONT.fasciaGapM, bottom = top - FRONT.fasciaM;
  // Fascia board, with its lettering just proud of it.
  b.box(s0, s1, 0.01, FRONT.fasciaOutM, bottom, top, look.fascia, look.lit, true);
  const word = look.word === 'name' ? input.word : look.word;
  if (word) b.word(word, s0 + 0.2, s1 - 0.2, (top + bottom) / 2, FRONT.fasciaOutM + 0.005, 0.06, look.letters, look.lit);
  // Window content between the stall riser and the fascia; a door gap of 1 m at one end (none on window rows).
  const doorAtStart = hash01(`${input.seed}:door`) < 0.5, door = look.content === 'redGlow' ? 0 : Math.min(1.0, (s1 - s0) * 0.25);
  const c0 = doorAtStart ? s0 + door + 0.1 : s0 + 0.1, c1 = doorAtStart ? s1 - 0.1 : s1 - door - 0.1;
  content(b, look, c0, c1, base + FRONT.riserM, bottom - FRONT.headGapM, input.seed);
  if (look.awning) b.slope(s0, s1, 1.1, bottom - 0.05, bottom - 0.55, look.awning);
  if (look.blade) {
    const at = doorAtStart ? s0 + 0.3 : s1 - 0.3;
    b.box(at - 0.03, at + 0.03, 0.05, 0.9, top + 0.35, top + 0.4, '#2a2a2a', false, true);
    b.box(at - 0.05, at + 0.05, 0.25, 0.85, top - 0.2, top + 0.35, look.blade, look.lit, true);
  }
  pavement(b, look, s0, s1, base, input.seed);
  return b.out;
}
