// Shopfront templates as geometry (lane retail-ground-20261114, `?retailGround=1`): a fascia board with the chain's
// or the business's lettering, window content just proud of the glass, and what stands on the pavement, built on the
// street wall nearest the POI. Flat-colour triangles in the sign layer (threeBuildingMesh SignTri), so no texture
// layer is spent: the atlas has two free layers. Pure (no DOM): runs in the mesh worker and in Node tests.
import { historicPuiFront, type HistoricPuiHost } from './retailFit/historicPuiFront.js';
import { glyphLayout } from './retailLogos.js';
import { goodsCell, goodsTiles, type GoodsKind } from './retailGoods.js';
import { fillerCell } from './retailPaneFillers.js';
import { ROOM_FAMILY_OF } from './retailRoomTone.js';
import { planPanes, shopVarietyOn } from './shopVariety.js';
import { drawRedLightFront, type RedLightFront } from './groundParts/redLightFront.js';
import { retailBrandOn, retailPartsOn } from './retailPages.js';
import { brandAccepted, brandLook } from './retailBrandStyles.js';
import { capShare, titleCase, typeLayout, type TypeFace } from './retailTypeFaces.js';
import { type BikeClass } from './retailBikes.js';
import { type PropTri } from './shopProps/kit.js';
import { BIKE_HEXES } from './shopProps/props.js';
import { insideProps, outsideProps, SHOP_PROPS, shopPropsFor } from './shopProps/layout.js';
import { baySeed, goodsTileRect } from './shopProps/variety.js';
import { shopPassOn } from './shopProps/flags.js';
import { intoRoom, roomTris } from './shopProps/interiors.js';
import { CHAIN_TEMPLATES, signText, TEMPLATE_LOOKS, TEMPLATE_PARTS, type RetailTemplate, type TemplateLook } from './retailTemplates.js';
import { archRiseM, type GfFinish, type GfHead, type GfOpeningKind, type GfPier, type GroundFloorDraw } from './groundFloor/types.js';

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

export class Builder {
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
  /** One triangle wound to `n` (lane ground-floor: an arch's fanlight). */
  tri(A: V3, B: V3, C: V3, n: V3, hex: string): void {
    const u = [B[0] - A[0], B[1] - A[1], B[2] - A[2]], w = [C[0] - A[0], C[1] - A[1], C[2] - A[2]];
    const flip = (u[1] * w[2] - u[2] * w[1]) * n[0] + (u[2] * w[0] - u[0] * w[2]) * n[1] + (u[0] * w[1] - u[1] * w[0]) * n[2] < 0;
    this.out.push({ p: flip ? [A, C, B] : [A, B, C], hex, n });
  }
  /** Lane shop-goods: a prop's triangles (shopProps/kit.ts, x along, y out, z up) placed by `at`, each wound to its normal. */
  put(tris: readonly PropTri[], at: (p: readonly [number, number, number]) => [number, number, number], recolour?: (hex: string) => string): void {
    for (const t of tris) {
      const [A, B, C] = t.p.map(q => { const [a, o, z] = at(q); return this.P(a, o, z); }), n = this.N(t.n[0], t.n[1], t.n[2]);
      const u = [B[0] - A[0], B[1] - A[1], B[2] - A[2]], w = [C[0] - A[0], C[1] - A[1], C[2] - A[2]];
      const flip = (u[1] * w[2] - u[2] * w[1]) * n[0] + (u[2] * w[0] - u[0] * w[2]) * n[1] + (u[0] * w[1] - u[1] * w[0]) * n[2] < 0;
      // A prop's own light (a mirror's lamp) keeps its colour and draws lit; everything else takes the recolour.
      if (t.lit) this.out.push({ p: flip ? [A, C, B] : [A, B, C], hex: t.hex, n, lit: true });
      else this.out.push({ p: flip ? [A, C, B] : [A, B, C], hex: recolour ? recolour(t.hex) : t.hex, n });
    }
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
  /** Round 7: one glyph on a face across the wall (a blade sign's side), the face's normal along +-u, reading left to
   *  right for a rider facing it: its texture's u runs along the viewer's right (-normal x up). */
  sideGlyph(ch: string, a: number, side: 1 | -1, oMid: number, zMid: number, h: number, layer: number, hex: string, accent: string, lit: boolean): void {
    const q = glyphLayout(ch).quads[0];
    if (!q) return;
    const w = (q.a1 - q.a0) * h, n = this.N(side, 0, 0), right: V3 = [-n[1], n[0], 0];
    const pts = [this.P(a, oMid - w / 2, zMid - h / 2), this.P(a, oMid + w / 2, zMid - h / 2), this.P(a, oMid + w / 2, zMid + h / 2), this.P(a, oMid - w / 2, zMid + h / 2)];
    const first = this.out.length;
    this.face(pts, n, hex, lit);
    const ref = this.P(a, oMid, zMid), r = q.rect;
    for (const t of this.out.slice(first)) {
      t.layer = layer; t.accentHex = accent;
      t.uv = t.p.map(p => [r[0] + (r[2] - r[0]) * (((p[0] - ref[0]) * right[0] + (p[1] - ref[1]) * right[1]) / w + 0.5), r[1] + (r[3] - r[1]) * ((p[2] - zMid) / h + 0.5)] as [number, number]);
    }
  }
  /** The word centred on [a0, a1] at height zMid, letters at most `maxH` m tall, from the logo layer's lettering cell
   *  (retailLogos.ts glyphLayout); the shortest form that fits at legible size (fitWord), else nothing: a plain board. */
  word(text: string, a0: number, a1: number, zMid: number, o: number, maxH: number, hex: string, board: string, lit: boolean, layer: number | undefined, face?: { face: TypeFace; layer: number }): void {
    if (layer === undefined && !face) return;
    const fit = fitWord(text, a1 - a0, maxH, face?.face);
    if (!fit) return;
    const { quads, width } = face ? typeLayout(face.face, fit.text) : glyphLayout(fit.text), h = fit.heightM, w0 = (a0 + a1) / 2 - (width * h) / 2;
    if (face) layer = face.layer;
    for (const q of quads) {
      const first = this.out.length;
      // An accent mark (retailLogos.ts glyphLayout `z`) stands over its capital, 3 mm proud of the letter quads it overlaps.
      const z = (q as { z?: readonly [number, number] }).z;
      if (z) this.textured(w0 + q.a0 * h, w0 + q.a1 * h, o + 0.003, zMid - h / 2 + z[0] * h, zMid - h / 2 + z[1] * h, layer!, q.rect);
      else this.textured(w0 + q.a0 * h, w0 + q.a1 * h, o, zMid - h / 2, zMid + h / 2, layer!, q.rect);
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
export function fitWord(text: string, availM: number, maxH: number, face?: TypeFace): { text: string; heightM: number; widthM: number } | null {
  const words = text.trim().split(/\s+/).filter(Boolean);
  // Lane retail-real: a face's quad is its whole row (ascender to descender), so its minimum keeps the same cap height
  // as the bold sans at MIN_LETTER_H (caps 0.725 of that quad).
  const minH = face ? MIN_LETTER_H * 0.725 / capShare(face) : MIN_LETTER_H;
  for (let k = words.length; k >= 1; k--) {
    const t = words.slice(0, k).join(' '), { quads, width } = face ? typeLayout(face, t) : glyphLayout(t);
    if (!quads.length || width <= 0) continue;
    const heightM = Math.min(maxH, availM / width);
    if (heightM >= minH - 1e-9) return { text: t, heightM, widthM: width * heightM };
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
      // Lane shop-goods: a greengrocer's and a florist's window goods are props (shopProps), crates and plants.
      if (look.content === 'produce') break;
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
    case 'bikes': case 'salon': {
      // Lane shop-goods: the shop's back wall only; its bikes, chairs and stations are props (shopProps), not crosses.
      b.panel(a0, a1, o, z0, z1, look.content === 'salon' ? '#e9e4da' : '#8f8d86', lit);
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

/** What stands on the pavement in front of the shop. */
function pavement(b: Builder, look: TemplateLook, a0: number, a1: number, base: number, seed: string): void {
  if (!look.pavement) return;
  if (look.pavement === 'crates') {
    for (let a = a0 + 0.3, k = 0; a < a1 - 0.6; a += 0.62, k++) {
      // Round 3c (cost): front and top of each crate and of the produce in it.
      b.slab(a, a + 0.52, 0.15, 0.75, base, base + 0.62, '#7a5a3a', 'top');
      b.slab(a + 0.02, a + 0.5, 0.17, 0.73, base + 0.62, base + 0.7, PRODUCT[Math.floor(hash01(`${seed}:cr${k}`) * PRODUCT.length)], 'top');
    }
  } else if (look.pavement === 'racks' && retailBrandOn()) {
    // Round 7 (David: "weird blue slabs"): a postcard stand: two slim dark uprights, a top bar and, on its face, rows
    // of small cards in many colours with the gaps between them open.
    const CARDS = ['#f4efe2', '#2f6fb0', '#e8572d', '#f2b92e', '#d9302f', '#3f8f4a', '#8fc6e8', '#f7a8c4', '#1d1d1b'];
    for (const a of [a0 + 0.4, a1 - 1.0]) if (a + 0.6 <= a1 && a >= a0) {
      for (const x of [a, a + 0.57]) b.fin(x, x + 0.03, 0.34, 0.38, base, base + 1.65, '#3a3a3a');
      b.box(a, a + 0.6, 0.34, 0.38, base + 1.62, base + 1.66, '#3a3a3a');
      for (let row = 0; row < 6; row++) for (let col = 0; col < 3; col++) {
        const x = a + 0.06 + col * 0.17, z = base + 0.45 + row * 0.19;
        b.panel(x, x + 0.14, 0.39, z, z + 0.16, CARDS[Math.floor(hash01(`${seed}:pc${a.toFixed(1)}:${row}:${col}`) * CARDS.length)]);
      }
    }
  } else if (look.pavement === 'promo') {
    // A chain's promotional stand (Kruidvat): a solid stand in the template's rack colour, 0.6 x 1.4 m, three shelves of
    // small boxed products in mixed colours and a header panel on top. Fronts and tops only.
    const BOXES = ['#f4efe2', '#2f6fb0', '#f2b92e', '#3f8f4a', '#f7a8c4', '#ffffff', '#8fc6e8'], red = look.rack ?? '#c8102e';
    for (const a of [a0 + 0.4, a1 - 1.0]) if (a + 0.6 <= a1 && a >= a0) {
      b.slab(a, a + 0.6, 0.3, 0.42, base, base + 1.2, red, 'top');
      for (let row = 0; row < 3; row++) {
        const z = base + 0.12 + row * 0.34;
        b.panel(a + 0.04, a + 0.56, 0.425, z, z + 0.3, '#8c0f1d');
        for (let col = 0; col < 3; col++) {
          const x = a + 0.07 + col * 0.16, h = 0.16 + 0.05 * hash01(`${seed}:pm${a.toFixed(1)}:${row}:${col}`);
          b.slab(x, x + 0.13, 0.425, 0.46, z + 0.02, z + 0.02 + h, BOXES[Math.floor(hash01(`${seed}:pb${a.toFixed(1)}:${row}:${col}`) * BOXES.length)], 'top');
        }
      }
      b.box(a - 0.02, a + 0.62, 0.3, 0.44, base + 1.2, base + 1.42, red);
      b.panel(a + 0.04, a + 0.58, 0.445, base + 1.24, base + 1.38, '#ffffff');
    }
  } else if (look.pavement === 'boards' && retailBrandOn()) {
    // Round 7: an A-board: a timber frame round a chalkboard with a few lines of chalk on it.
    for (const a of [a0 + 0.4, a1 - 1.0]) if (a + 0.6 <= a1 && a >= a0) {
      b.box(a, a + 0.6, 0.34, 0.4, base, base + 0.95, '#6b4e33');
      b.panel(a + 0.05, a + 0.55, 0.405, base + 0.3, base + 0.9, '#2b2f2c');
      for (const [k, w] of [[0, 0.36], [1, 0.28], [2, 0.32], [3, 0.2]] as const) b.panel(a + 0.1, a + 0.1 + w, 0.41, base + 0.78 - k * 0.12, base + 0.805 - k * 0.12, '#e8e4da');
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
  /** Lane ground-floor: a held or unaccepted template drawn only for its ground-floor record: a neutral fill (dark frame
   *  and board, glass, the type's goods; no template board colours, awning or blade). */
  neutral?: boolean;
  /** Round 6: a bike shop's class (retailBikes.ts bikeShopClass, staged per pand): side-on bikes parked against the
   *  front (used: a muted irregular row; premium: a neat clean row; rental: the fleet's identical bikes) and two to
   *  four side-on behind the glass. Absent: the template's racks and pavement discs. */
  bike?: { cls: BikeClass; fleetHex?: string };
  /** Lane shop-bikes-perp: the pavement in front of the wall (wall to kerb, metres) where the mesher knows it
   *  (threeBuildingMesh.ts: wall to street centreline less GENERIC_STOOP.carriageHalfM). Pavement props that need more
   *  room give way (perpendicular bikes need 2.5 m; side-on bikes 1 m); unknown counts as wide. */
  pavementM?: number;
  /** Lane retail-pass round 2 (`?shopInteriors=1`): the window bays (indices into retailWindowBays) whose wall the mesher
   *  cut, so they draw a room behind the glass (shopProps/interiors.ts) in place of the pane and the props' relief. */
  rooms?: readonly number[];
  /** Round 7: the awning measured on a street panorama (measure-awning.ts, staged per pand), over the window in this
   *  colour, in place of the template's (the black awnings of Unique Eyefashion, Gall & Gall). Absent: the template's. */
  awning?: string;
  /** Lane retail-real: the first window-goods layer (retailPages.ts GOODS_BASE from the logo layer); with it a template
   *  with `goods` shows its goods cell in every pane tile. Absent: round n's interior. */
  goods?: number;
  /** Lane shop-variety (default on; `?shopVariety=0` off): the first pane-filler layer (retailPages.ts VARIETY_BASE); with it and
   *  `goods` the signature goods show in the window they belong in and the other panes take the kind's pane set
   *  (shopVariety.ts). Absent: the goods cell in every pane tile. */
  variety?: number;
  /** Lane retail-real: the first lettering-face layer (retailPages.ts TYPE_BASE); with it a template with `face` letters
   *  its word in that face. Absent: the bold sans. */
  faces?: number;
  /** Lane retail-real: a chain's board and letter colours and its name (lettered when it has no logo). */
  chain?: { fascia: string; letters: string; word: string; goods?: GoodsKind };
  /** Round 7 (`?retailBrand=1`): the chain's key in BRAND_STYLES (retailBrandStyles.ts), and the building's wall colour
   *  that shows behind letters on the wall. */
  brand?: string;
  wallHex?: string;
  /** Lane retail-real: the host front's ground-floor cells across [s0, s1] where a read or register traced them
   *  (specRecipe.groundBoxes); a red-light front puts one door in each. Absent: doors at the measured 1.15 m pitch. */
  bays?: number;
  /** Lane retail-real: lane R's audited window front (doors, tube, curtains, frame) for this pand; it outranks `bays`. */
  redLight?: RedLightFront;
  /** Round 4 (`?retailParts=1`): a per-pand frame colour read on a photo (data/retail-ground/front-overrides.json, with
   *  its receipt): the posts, mullions, transom and riser in place of the template's surround; the board keeps its own. */
  frameHex?: string;
  /** Lane retail-fit round 5: a register-named historic pui (retailFit/historicPui.ts): the template draws nothing; the
   *  host's measured kit pui stands in its place, or only its name on the pand's own front (historicPuiFront.ts).
   *  Absent: unchanged. */
  host?: HistoricPuiHost;
};

/** Where the door's head stands: under the fascia, at most FRONT.doorHeadM. */
/** The glass bays of a front over [s0, s1] (either side of its door, inside the end posts), as retailFrontTris lays
 *  them out; a red-light row has one. Lane retail-pass round 2: the mesher cuts the wall behind these for rooms. */
export function retailWindowBays(input: Pick<RetailFrontInput, 'template' | 'door' | 'seed'>, s0: number, s1: number): Array<[number, number]> {
  const door = retailDoor(input, s0, s1);
  if (TEMPLATE_LOOKS[input.template].content === 'redGlow') return [[s0 + 0.1, s1 - 0.1]];
  return door ? [[s0 + FRONT.postM, door.a0 - FRONT.mullionM], [door.a1 + FRONT.mullionM, s1 - FRONT.postM]] : [[s0 + FRONT.postM, s1 - FRONT.postM]];
}

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
function glass(b: Builder, look: TemplateLook, a0: number, a1: number, z0: number, z1: number, seed: string, reflectShare: number = FRONT.reflectShare): void {
  const first = b.out.length;
  content(b, look, a0, a1, z0, z1, seed);
  if (!OWN_LIGHT.has(look.content)) for (const t of b.out.slice(first)) t.hex = glassTone(t.hex, look.lit ? 0.62 : 0.68);
  if (look.content === 'redGlow') return;
  const h = (z1 - z0) * reflectShare, o = FRONT.contentOutM + 0.025;
  REFLECT.forEach((hex, k) => b.panel(a0, a1, o, z1 - h * (k + 1) / REFLECT.length, z1 - h * k / REFLECT.length, hex));
}
// Round 3b tone: the photos' shop glass measures darker than round 3's sky (mean ground L 0.37 against 0.43 drawn).
const REFLECT = ['#7d878e', '#5f676c'] as const;
/** Lane retail-pass: the reflection's share of the glass over props behind it (the props are the window's read). */
export const PASS_REFLECT_SHARE = 0.16;

/** Lane shop-goods: props behind the glass are drawn as a relief between the pane (contentOutM) and the glass's
 *  reflection (contentOutM + 0.025): the wall is not cut behind a window, so a 2.5 m deep shop is pressed into 2.5 cm,
 *  deeper props nearer the pane, a little smaller and higher (the eye looks down into the shop). They keep their 3D
 *  normals, so they shade as solids; the shop-interiors lane's room (rooms.ts, 3.6-6 m deep) stays behind them. */
export const INSIDE = { o0: FRONT.contentOutM + 0.002, o1: FRONT.contentOutM + 0.022, deepM: 2.5, squash: 0.012, riserOutM: FRONT.contentOutM + 0.03 } as const;
function insideRelief(b: Builder, props: NonNullable<(typeof SHOP_PROPS)[string]>, c0: number, c1: number, base: number, head: number, seed: string, bay: number, lit: boolean): void {
  const items = insideProps(props, c0, c1, seed, bay).sort((p, q) => q.depth - p.depth);
  for (const { tris, depth } of items) {
    const f = Math.min(1, depth / INSIDE.deepM), k = 1 - 0.12 * f, lift = 0.1 * f, oMid = INSIDE.o1 - (INSIDE.o1 - INSIDE.o0) * f;
    const xs = tris.flatMap(t => t.p.map(p => p[0])), mid = (Math.min(...xs) + Math.max(...xs)) / 2;
    const top = Math.max(...tris.flatMap(t => t.p.map(p => p[2])));
    // Scaled about its centre along the wall; no taller than the glass; kept inside the bay.
    const kk = Math.min(k, (head - 0.05 - base - lift) / Math.max(0.1, top));
    const x0 = mid + (Math.min(...xs) - mid) * kk, x1 = mid + (Math.max(...xs) - mid) * kk;
    const shift = x0 < c0 + 0.02 ? c0 + 0.02 - x0 : x1 > c1 - 0.02 ? c1 - 0.02 - x1 : 0;
    if (x1 - x0 > c1 - c0 - 0.04) continue;
    b.put(tris, p => [mid + (p[0] - mid) * kk + shift, Math.max(INSIDE.o0, Math.min(INSIDE.o1, oMid + p[1] * INSIDE.squash)), base + 0.02 + lift + p[2] * kk], hex => glassTone(hex, lit ? 0.22 : 0.3));
  }
}

/** Lane retail-pass round 2: room surfaces through the glass are pulled this far toward its dark; props less.
 *  Blind round 2 (2026-11-19): at 0.55 the rooms read as pale flat boxes against the photos' dark glass with warm
 *  points of light; the surfaces now sit near the glass's dark, lamps and mirrors (lit) carry the read. */
export const ROOM_PULL = 0.75, ROOM_PROP_PULL = 0.4;
function shopRoom(b: Builder, template: string, props: NonNullable<(typeof SHOP_PROPS)[string]>, c0: number, c1: number, base: number, head: number, seed: string, bay: number): void {
  b.put(roomTris(template, c0, c1, base, head, `${seed}:bay${bay}`), p => [p[0], p[1], p[2]], hex => glassTone(hex, ROOM_PULL));
  for (const { tris, depth } of insideProps(props, c0, c1, seed, bay)) b.put(intoRoom(tris, depth, base), p => [p[0], p[1], p[2]], hex => glassTone(hex, ROOM_PROP_PULL));
}

/** Lane shop-variety: a goods tile as drawn (its triangles in `out`, its span, bay, tile index and uv rect), for
 *  varyPanes to swap once the whole front's tiles and doors are known. */
type GoodsTileRec = { out: FrontTri[]; first: number; end: number; a0: number; a1: number; bay: number; tile: number; rect: [number, number, number, number] };

/** Lane shop-variety (default on; `?shopVariety=0` off): the front's goods tiles planned together (shopVariety.ts planPanes); a filler
 *  tile keeps its two triangles and takes the filler cell's layer and a seeded stretch of it (goodsTileRect). */
function varyPanes(recs: GoodsTileRec[], doors: ReadonlyArray<readonly [number, number]>, kind: GoodsKind, input: RetailFrontInput): void {
  if (input.variety === undefined || recs.length < 2) return;
  const sorted = recs.slice().sort((p, q) => p.a0 - q.a0), plan = planPanes(kind, sorted, doors, input.seed), family = ROOM_FAMILY_OF[kind];
  if (!family) return;
  for (const [i, r] of sorted.entries()) {
    const c = plan[i];
    if (c.signature) continue;
    // One room per shop (retailRoomTone.ts): the filler as painted on the signature's family room.
    const cell = fillerCell(family, c.filler), to = goodsTileRect(cell.rect, input.seed, r.bay, r.tile), [f0, g0, f1, g1] = r.rect;
    for (const t of r.out.slice(r.first, r.end)) {
      t.layer = input.variety + cell.page;
      t.uv = t.uv!.map(([u, v]) => [to[0] + (to[2] - to[0]) * (u - f0) / (f1 - f0), to[1] + (to[3] - to[1]) * (v - g0) / (g1 - g0)] as [number, number]);
    }
  }
}

/** The glass of one bay over [c0, c1] x [zr, head], `panes` panes `pw` wide (round 3c / lane retail-real / round 7);
 *  shared by the template front and the ground-floor inset (groundFloorFrontTris). With `recs` (lane shop-variety) its
 *  goods tiles are recorded for varyPanes. */
function fillPanes(b: Builder, look: TemplateLook, input: RetailFrontInput, c0: number, c1: number, zr: number, head: number, bay: number, panes: number, pw: number, seed: string, recs?: GoodsTileRec[]): void {
  // Lane retail-pass (`?shopPass=1`): a front with props behind its glass keeps its own back wall, not the shop cell's
  // shelves (they read as a bookshop behind a salon's chairs), and its reflection shrinks to the glass's head.
  const passProps = shopPassOn() && !!shopPropsFor(input.template)?.inside;
  if (look.window === 'plate') {
    // Round 7: dark reflective plate glass, the sky's light in its upper part.
    b.panel(c0, c1, FRONT.contentOutM, zr, head, '#20272c');
    b.panel(c0, c1, FRONT.contentOutM + 0.003, head - (head - zr) * 0.32, head, '#46525a');
  } else if (look.goods && input.goods !== undefined) {
    // Lane retail-real: the pane cut into tiles of the template's goods cell (alternate tiles mirrored).
    const cell = goodsCell(look.goods), layer = input.goods + cell.page, [u0, v0, u1, v1] = cell.rect;
    // Lane shop-goods: each tile a seeded stretch of the cell, mirrored or not, per bay (goodsTileRect).
    for (let k = 0; k < panes; k++) for (const [ti, t] of goodsTiles(c0 + k * pw, c0 + (k + 1) * pw).entries()) {
      const first = b.out.length, rect = goodsTileRect([u0, v0, u1, v1], input.seed, bay, k * 16 + ti);
      b.textured(t.a0, t.a1, FRONT.contentOutM, zr, head, layer, rect);
      if (!look.lit) for (const tr of b.out.slice(first)) delete tr.lit;
      recs?.push({ out: b.out, first, end: b.out.length, a0: t.a0, a1: t.a1, bay, tile: k * 16 + ti, rect });
    }
  } else if (input.interior && !OWN_LIGHT.has(look.content) && look.content !== 'barGlow' && !passProps) {
    // Round 3c (cost): each pane's interior is one quad of the building's own shop cell (bayTextures puiAt: its dark
    // interior, shelf glow and the street's reflection), in place of the flat-colour goods.
    for (let k = 0; k < panes; k++) {
      const first = b.out.length;
      b.textured(c0 + k * pw, c0 + (k + 1) * pw, FRONT.contentOutM, zr, head, input.interior.layer, input.interior.rect);
      for (const t of b.out.slice(first)) delete t.lit;
    }
  } else glass(b, look, c0, c1, zr, head, seed, passProps ? PASS_REFLECT_SHARE : FRONT.reflectShare);
}

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
  // Lane retail-real: a chain (retailChains.ts) draws its type's template under its own board and letter colours.
  const look0 = chainLook(input);
  // Round 7: the chain's measured brand style over its template (retailBrandStyles.ts).
  const brand = input.brand && retailBrandOn() && brandAccepted(input.brand) ? brandLook(input.brand) : undefined, look: TemplateLook = brand ? { ...look0, ...brand } : look0;
  if (s1 - s0 < 1.2) return [];
  const b = new Builder(e);
  // Lane retail-fit round 5: a historic pui draws its own front (or only its name) in the template's place.
  if (input.host) { historicPuiFront(b, input.host, input, s0, s1, base, base + Math.min(Math.max(2.8, groundM), 4.6), retailDoor(input, s0, s1)); return b.out; }
  const top = base + Math.min(Math.max(2.8, groundM), 4.6) - FRONT.fasciaGapM, bottom = top - FRONT.fasciaM;
  // Lane retail-real (coordinator 2026-11-15): a red-light front is lane R's window-front part (groundParts/
  // redLightFront.ts: glazed doors in a cream frame, kick panels, curtains, a lit red tube on the head), with no pui
  // fascia, riser or recessed door; `?retailReal=0` keeps round n's redGlow box.
  if (look.content === 'redGlow' && look.goods && input.goods !== undefined) {
    const n = Math.floor(hash01(input.seed + ":redLight") * 12);
    // Unaudited (no usable view): the audit's majority, no tube (21 of 27) and drawn curtains (17 of 27); one pand in
    // four gathered, so a run of windows is not uniform.
    const spec: RedLightFront = input.redLight ?? { ...(input.bays ? { doors: input.bays } : {}), tube: 'none', curtains: n % 4 === 1 ? 'gathered' : 'drawn' };
    drawRedLightFront(b, s0, s1, base, 0, spec);
    return b.out;
  }
  const frame = input.frameHex ?? input.paint ?? look.frame ?? '#2b2724', head = doorHead(base, groundM), puiTop = bottom - FRONT.beadM;
  const timber = input.frameHex ?? look.surround ?? frame, riser = input.frameHex ? shadeHex(input.frameHex, 0.92) : look.surround ?? shadeHex(frame, 1.12);
  // Fascia board, a cornice cap over it (a step darker, standing further out) and a bead under it.
  // Round 3c (cost): each member draws the faces a rider sees (Builder.slab): the board and cap their front, underside
  // and the board's ends, the cap and bead their front and underside.
  const board = input.paint && !input.logo ? input.paint : look.fascia, cap = input.paint && !input.logo ? shadeHex(input.paint, 0.85) : look.cap ?? shadeHex(look.fascia, 0.72);
  const ink = input.paint && !input.logo ? (hexLuma(input.paint) > 0.35 ? '#2b2724' : '#f4f1ea') : look.letters;
  const onWall = look.mount === 'wall', wallHex = input.wallHex ?? '#cfc6b4';
  if (onWall) {
    // Round 7: no board; the wall itself (its colour over whatever the ground cell painted there) carries the letters.
    b.panel(s0, s1, 0.006, bottom, top, wallHex);
  } else {
    b.slab(s0, s1, 0.01, FRONT.fasciaOutM, bottom, top, board, 'bottom', true, look.lit);
    b.slab(s0 - 0.04, s1 + 0.04, 0.01, FRONT.capOutM, top, top + FRONT.capM, cap, 'bottom');
  }
  b.slab(s0, s1, 0.01, FRONT.fasciaOutM - 0.02, puiTop, bottom, frame, 'bottom');
  const word = input.chain ? input.chain.word : look.word === 'name' ? (input.word ? signText(input.word) : input.word) : look.word;
  if (onWall && word) {
    // Channel letters on the wall, standing a letter's depth proud of it, as tall as the band would have been.
    b.word(word, s0 + 0.2, s1 - 0.2, (top + bottom) / 2, 0.006 + FRONT.letterOutM, FRONT.fasciaM - 0.04, look.letters, wallHex, look.lit, input.letters);
  } else if (input.logo) {
    // Lane retail-real: a square-ish mark (Lidl, Aldi, Vodafone, Burger King) is a lightbox larger than the board, as on
    // the street (centred on it, up to 0.95 m); a wordmark keeps to the board. Lane shopfront-feedback-20261123: an
    // own-front chain (retailChains.ts CHAINS_OWN_FRONT, drawn with no goods) too, or Burger King's and Vodafone's
    // square marks shrank to a 0.5 m patch on the board; every own-front chain before it had a wide logo.
    // Coordinator review (round 3b): an own-front chain's square mark (H&M) is as tall as the board (the cap stands in front of anything higher),
    // not a 0.95 m box over the cap (Vodafone stuck out above the board); a chain's wide logo fills 90 % of the board.
    const box = (input.goods !== undefined || input.chain !== undefined) && input.logo.aspect < 1.6, chainBox = box && input.chain !== undefined;
    const hM = chainBox ? FRONT.fasciaM - 0.04 : box ? 0.95 : input.chain ? FRONT.fasciaM - 0.06 : FRONT.fasciaM - 0.1;
    const wM = Math.min(s1 - s0 - 0.4, hM * input.logo.aspect), mid = (s0 + s1) / 2;
    const z0 = chainBox ? bottom + 0.02 : box ? (top + bottom) / 2 - wM / input.logo.aspect / 2 : input.chain ? bottom + 0.03 + (hM - wM / input.logo.aspect) / 2 : bottom + 0.05;
    b.textured(mid - wM / 2, mid + wM / 2, FRONT.fasciaOutM + FRONT.letterOutM + (box ? 0.03 : 0), z0, z0 + (wM / input.logo.aspect), input.logo.layer, input.logo.rect);
  } else if (word) {
    const face = look.face && input.faces !== undefined ? { face: look.face, layer: input.faces + ['serif', 'condensed', 'script'].indexOf(look.face) } : undefined;
    // A face's quad spans its row, so it may fill the board (less a margin); the bold sans keeps MAX_LETTER_H.
    b.word(face?.face === 'script' && look.word === 'name' ? titleCase(word) : word, s0 + 0.2, s1 - 0.2, (top + bottom) / 2, FRONT.fasciaOutM + FRONT.letterOutM, face ? FRONT.fasciaM - 0.04 : MAX_LETTER_H, ink, board, look.lit, input.letters, face);
  }
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
  const segs = retailWindowBays(input, s0, s1);
  const lightHex = glassTone('#7f8b93', 0.5);
  if (door && puiTop - head > 0.25) b.panel(door.a0, door.a1, FRONT.contentOutM, head + FRONT.transomM, puiTop, lightHex);
  if (door && puiTop - head > 0.25) b.slab(door.a0, door.a1, 0, FRONT.frameOutM - 0.03, head, head + FRONT.transomM, frame, 'bottom');
  const props = shopPropsFor(input.template);
  const recs: GoodsTileRec[] | undefined = look.goods && input.variety !== undefined && shopVarietyOn() ? [] : undefined;
  for (const [bay, [c0, c1]] of segs.entries()) {
    if (c1 - c0 < 0.4) { if (c1 > c0) b.fin(c0, c1, 0, FRONT.frameOutM - 0.02, base, puiTop, timber); continue; }
    // Lane shop-goods: every bay its own seed (pand and bay index), so no two windows of a front draw the same goods.
    const seed = baySeed(input.seed, bay);
    if (windows) { content(b, look, c0, c1, zr, puiTop - FRONT.headGapM, seed); continue; }
    const panes = Math.max(1, Math.ceil((c1 - c0) / (look.paneM ?? FRONT.paneMaxM))), pw = (c1 - c0) / panes;
    // Stall riser in the riser colour, a sill over it (round 3c: one riser panel; the per-pane sunk panels were 2 tris a
    // pane nobody reads at ride distance).
    // Lane shop-goods: with props behind the glass the riser stands on the glass line, in front of them (their feet).
    const room = !!input.rooms?.includes(bay) && !!props?.inside;
    b.panel(c0, c1, props?.inside && !room ? INSIDE.riserOutM : 0.015, base, zr, riser);
    b.slab(c0 - 0.02, c1 + 0.02, 0, FRONT.sillOutM + 0.03, zr - 0.05, zr, frame, 'top');
    if (room) {
      // Lane retail-pass round 2: the mesher cut the wall here; a room with the props at their depth, the street's
      // reflection over the glass's head.
      shopRoom(b, input.template, props!, c0, c1, base, head, input.seed, bay);
      const h = (head - zr) * PASS_REFLECT_SHARE, o = FRONT.contentOutM + 0.025;
      REFLECT.forEach((hex, k) => b.panel(c0, c1, o, head - h * (k + 1) / REFLECT.length, head - h * k / REFLECT.length, hex));
    } else fillPanes(b, look, input, c0, c1, zr, head, bay, panes, pw, seed, recs);
    if (props?.inside && !room) insideRelief(b, props, c0, c1, base, head, input.seed, bay, look.lit);
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
  if (recs && look.goods) varyPanes(recs, door ? [[door.a0, door.a1]] : [], look.goods, input);
  // Round 4 (`?retailParts=1`): the template's parts (retailTemplates.ts TEMPLATE_PARTS).
  const parts = retailPartsOn() && input.goods !== undefined ? TEMPLATE_PARTS[input.template] : undefined;
  if (parts && !windows) {
    const glassSegs = segs.filter(([c0, c1]) => c1 - c0 >= 0.9);
    if (parts.shutter) {
      // The roller box under the bead, standing a little proud, and a guide rail inside each end post.
      b.slab(s0 + FRONT.postM, s1 - FRONT.postM, 0, 0.13, puiTop - 0.24, puiTop, '#8a8c8e', 'bottom', true);
      for (const [c0, c1] of segs) if (c1 - c0 >= 0.4) { b.panel(c0, c0 + 0.045, FRONT.frameOutM, zr, puiTop - 0.24, '#7a7c7e'); b.panel(c1 - 0.045, c1, FRONT.frameOutM, zr, puiTop - 0.24, '#7a7c7e'); }
    }
    // The pane nearest the door carries the neon; the widest other one the glass lettering.
    const byDoor = glassSegs.slice().sort((p, q) => (door ? Math.abs((p[0] + p[1]) / 2 - door.a0) - Math.abs((q[0] + q[1]) / 2 - door.a0) : 0));
    if (parts.neon && byDoor[0] && input.letters !== undefined) {
      const [c0, c1] = byDoor[0], w = Math.min(c1 - c0 - 0.2, 0.42 * parts.neon.text.length);
      const mid = door && door.a0 > (c0 + c1) / 2 ? c1 - 0.1 - w / 2 : c0 + 0.1 + w / 2;
      b.word(parts.neon.text, mid - w / 2, mid + w / 2, head - 0.45, FRONT.contentOutM + 0.012, 0.42, parts.neon.hex, '#141414', true, input.letters);
    }
    const glassWord = parts.glass === 'name' ? (input.chain ? undefined : input.word ? signText(input.word) : undefined) : parts.glass;
    const gseg = glassSegs.slice().sort((p, q) => (q[1] - q[0]) - (p[1] - p[0]))[0];
    if (glassWord && gseg) {
      const face = look.face && input.faces !== undefined ? { face: look.face, layer: input.faces + ['serif', 'condensed', 'script'].indexOf(look.face) } : undefined;
      b.word(face?.face === 'script' ? titleCase(glassWord) : glassWord, gseg[0] + 0.15, gseg[1] - 0.15, zr + (head - zr) * 0.6, FRONT.contentOutM + 0.012, 0.45, '#e9dcbc', '#1e140c', false, input.letters, face);
    }
  }
  const awning = input.awning ?? look.awning;
  if (awning) b.slope(s0, s1, 1.1, bottom - 0.05, bottom - 0.55, awning);
  if (look.blade) {
    const at = door && door.a0 < (s0 + s1) / 2 ? s0 + 0.3 : s1 - 0.3;
    b.box(at - 0.03, at + 0.03, 0.05, 0.9, top + 0.35, top + 0.4, '#2a2a2a', false, true);
    b.box(at - 0.05, at + 0.05, 0.25, 0.85, top - 0.2, top + 0.35, look.blade, look.lit, true);
    // Round 7: the blade's glyph on both faces (FEBO's red F on white).
    if (look.bladeGlyph && input.letters !== undefined) for (const side of [1, -1] as const) b.sideGlyph(look.bladeGlyph, at + side * 0.052, side, 0.55, top + 0.075, 0.44, input.letters, look.bladeInk ?? '#d0101b', look.blade, look.lit);
  }
  if (props?.outside) {
    // Lane shop-goods: the template's pavement props (shopProps/layout.ts) either side of the door; a rental fleet's
    // bikes all in its colour.
    const runs = (door ? [[s0 + 0.1, door.a0 - 0.12], [door.a1 + 0.12, s1 - 0.1]] : [[s0 + 0.1, s1 - 0.1]] as Array<[number, number]>).filter(([r0, r1]) => r1 - r0 > 0.5) as Array<[number, number]>;
    const fleet = input.bike?.cls === 'rental' ? input.bike.fleetHex : undefined, frames = new Set<string>(BIKE_HEXES);
    b.put(outsideProps(props, runs, input.seed, input.pavementM), q => [q[0], q[1], base + q[2]], fleet ? hex => (frames.has(hex) ? fleet : hex) : undefined);
  } else pavement(b, look, s0, s1, base, input.seed);
  return b.out;
}

// ---------------------------------------------------------------------------------------------------------------------
// Lane ground-floor-20261116 (`?groundFloor=1`): the building draws its own ground floor from its GroundFloor record
// (groundFloor/types.ts): piers, plinth, the finish round the openings and their arched or flat heads, the reveals into
// the wall; the shop fills each `shop` opening (inset mode: glass, goods, props and door set back in the opening) and its
// sign goes where the record says (letters on the wall, a board in the opening, a fascia, a lightbox). The mesher cuts
// the wall over the whole ground storey of the front (threeBuildingMesh retailFrontOn), so this covers all of it.
// No record: retailFrontTris, unchanged.

/** The finish colours when the record states a material but no colour. */
/** The dark of a shopfront's frame, painted pui and plain fascia (blind round 1: the photos' fronts are dark). */
export const GF_DARK = '#2b2724';
export const GF_FINISH_HEX: Readonly<Record<GfFinish, string>> = { stone: '#c9c1ad', stucco: '#e6e1d4', brick: '#8a4f3c', 'painted-pui': GF_DARK };
/** How far piers stand proud of the finish, how deep openings are set in, by material (m). */
export const GF_DEPTH = { pierOutStone: 0.08, pierOutPui: 0.04, recessMasonry: 0.25, recessPui: 0.2, courseM: 0.42, channelM: 0.035, archSegments: 10 } as const;

/** The template's look under a chain's board and letter colours (lane retail-real), and (lane shopfront-feedback-
 *  20261123) the chain's own goods kind where the template shows goods: Bever's sports gear, Samsonite's cases. */
export function chainLook(input: Pick<RetailFrontInput, 'template' | 'chain'>): TemplateLook {
  const t = TEMPLATE_LOOKS[input.template];
  if (!input.chain) return t;
  return { ...t, fascia: input.chain.fascia, letters: input.chain.letters, cap: undefined, word: undefined, face: undefined, ...(input.chain.goods && t.goods ? { goods: input.chain.goods } : {}) };
}
function frontLook(input: RetailFrontInput): TemplateLook {
  const look0 = chainLook(input);
  const brand = input.brand && retailBrandOn() && brandAccepted(input.brand) ? brandLook(input.brand) : undefined;
  return brand ? { ...look0, ...brand } : look0;
}
/** The wall frame `d` metres further along its normal (negative: into the wall). */
function shifted(e: WallFrame, d: number): WallFrame { return { ...e, x0: e.x0 + e.nx * d, y0: e.y0 + e.ny * d }; }
/** canalhouseRecipes.archPoints (a circular arch through both springing points and the crown), right to left; copied
 *  here because that module pulls three and the landmark tools into the mesh worker. */
function archPoints(x: number, w: number, ys: number, rise: number, inset: number, segments: number): Array<[number, number]> {
  const radius = w * w / (8 * rise) + rise / 2, cy = ys + rise - radius, r = radius - inset, half = w / 2 - inset, out: Array<[number, number]> = [];
  for (let i = 0; i <= segments; i++) { const u = half - 2 * half * i / segments; out.push([x + w / 2 + u, cy + Math.sqrt(Math.max(0, r * r - u * u))]); }
  return out;
}
/** The arch over [a0, a1] springing at `spring` with `rise`, as points left to right. */
function archLine(a0: number, a1: number, spring: number, rise: number, n: number = GF_DEPTH.archSegments): Array<[number, number]> {
  if (rise <= 1e-3) return [[a0, spring], [a1, spring]];
  return archPoints(a0, a1 - a0, spring, rise, 0, n).reverse();
}

export type GroundFloorOpeningDrawn = { a0: number; a1: number; z0: number; spring: number; crown: number; head: GfHead; kind: GfOpeningKind };
/** The lowest an opening's head is pressed to (m over the sill line) to make room for the sign zone over it. */
export const GF_MIN_HEAD_M = 2.3;
/**
 * The band (m) the record's sign needs between the openings' heads and the storey top: a fascia's height, a line of wall
 * letters, a lightbox; else the 0.15 m lintel. Fix round 2 (blind round 2): the openings were scaled to fill the storey
 * to 0.15 m under its top, so where the read's heads stood near the mesher's ground storey a fascia, wall letters or a
 * lightbox had no room and the shop lost its name (De Slegte, Burger King, Manfield, Blokker).
 */
export function groundFloorSignBand(gf: GroundFloorDraw): number {
  if (gf.sign.kind === 'fascia' && !gf.fascia.inOpening) return Math.max(0.35, Math.min(gf.fascia.heightM ?? FRONT.fasciaM, 1.0)) + 0.12;
  if (gf.sign.kind === 'wall-letters') return 0.55;
  if (gf.sign.kind === 'lightbox') return 0.5;
  return 0.15;
}
/** The record's openings in wall metres: along [s0, s1], heights over `base`, scaled down to fit under `top` with the
 *  sign's band over the tallest head (never pressing a head under GF_MIN_HEAD_M). */
export function groundFloorOpenings(gf: GroundFloorDraw, s0: number, s1: number, base: number, top: number): GroundFloorOpeningDrawn[] {
  const W = s1 - s0, maxHead = Math.max(...gf.openings.map(o => o.headM)), room = top - base;
  const k = Math.min(1, Math.max(Math.min(GF_MIN_HEAD_M, room - 0.15), room - groundFloorSignBand(gf)) / Math.max(1e-3, maxHead));
  return gf.openings.map(o => {
    const a0 = s0 + o.a0 * W, a1 = s0 + o.a1 * W, z0 = base + o.sillM * k, crown = base + o.headM * k;
    const rise = Math.min(archRiseM(o.head, a1 - a0), Math.max(0, crown - z0 - 0.9));
    return { a0, a1, z0, spring: crown - rise, crown, head: rise > 1e-3 ? o.head : 'flat', kind: o.kind };
  });
}

/**
 * The ground floor of `gf` on the wall `e` over [s0, s1], ground storey [base, top], with the shop `input` in its
 * shop openings. Returns flat triangles in the sign layer, like retailFrontTris.
 */
export function groundFloorFrontTris(input: RetailFrontInput, gf: GroundFloorDraw, e: WallFrame, s0: number, s1: number, base: number, top: number): FrontTri[] {
  if (s1 - s0 < 1.2 || !gf.openings.length) return [];
  // Fix round (blind round 1, 5-5-3: bright painted fronts where the photos show dark recessed ones): the frame, a painted
  // pui and the fascia are dark unless the record (a confident read: groundFloor/read.ts), a photo-read frame colour or a
  // brand says otherwise; a template's own bright board and awning draw only for a chain or an accepted brand.
  const brandish = !input.neutral && (!!input.chain || (CHAIN_TEMPLATES as readonly string[]).includes(input.template) || !!(input.brand && retailBrandOn() && brandAccepted(input.brand)));
  const look0 = frontLook(input), look: TemplateLook = brandish ? look0 : { ...look0, awning: undefined, blade: undefined, lit: false }, b = new Builder(e);
  const painted = gf.groundFinish.material === 'painted-pui';
  const finish = gf.groundFinish.hex ?? (gf.groundFinish.material === 'brick' && input.wallHex ? input.wallHex : painted ? input.frameHex ?? GF_DARK : GF_FINISH_HEX[gf.groundFinish.material]);
  const masonry = !painted;
  const recess = masonry ? GF_DEPTH.recessMasonry : GF_DEPTH.recessPui;
  const frame = input.frameHex ?? (painted && gf.groundFinish.hex ? shadeHex(finish, 0.8) : GF_DARK);
  const ops = groundFloorOpenings(gf, s0, s1, base, top);
  const pierHex = (m: GfPier['material']) => m === 'iron' ? '#2b2d30' : m === 'brick' ? (gf.groundFinish.material === 'brick' ? finish : input.wallHex ?? GF_FINISH_HEX.brick) : m === 'timber' && masonry ? frame : finish;
  // Piers: proud of the finish (stone) or flush pilasters (a pui); rusticated stone in courses with channels between.
  const W = s1 - s0;
  for (const p of gf.piers) {
    const p0 = s0 + p.a0 * W, p1 = s0 + p.a1 * W, hex = pierHex(p.material), out = p.material === 'stone' || p.material === 'brick' ? GF_DEPTH.pierOutStone : GF_DEPTH.pierOutPui;
    if (p1 - p0 < 0.02) continue;
    if (p.rusticated) {
      b.panel(p0, p1, out - GF_DEPTH.channelM, base, top, shadeHex(hex, 0.78));
      for (let z = base; z < top - 0.05; z += GF_DEPTH.courseM) b.slab(p0 + 0.015, p1 - 0.015, out - GF_DEPTH.channelM, out, z + 0.03, Math.min(top, z + GF_DEPTH.courseM) - 0.01, hex, 'top');
      b.face([b.P(p0, 0, base), b.P(p0, out - GF_DEPTH.channelM, base), b.P(p0, out - GF_DEPTH.channelM, top), b.P(p0, 0, top)], b.N(-1, 0, 0), shadeHex(hex, 0.85));
      b.face([b.P(p1, 0, base), b.P(p1, out - GF_DEPTH.channelM, base), b.P(p1, out - GF_DEPTH.channelM, top), b.P(p1, 0, top)], b.N(1, 0, 0), shadeHex(hex, 0.85));
    } else b.fin(p0, p1, 0, out, base, top, hex);
  }
  // The finish over and under each opening: the spandrel to the storey top (following an arch), the stall under a sill.
  for (const o of ops) {
    const line = archLine(o.a0, o.a1, o.spring, o.crown - o.spring);
    for (let i = 1; i < line.length; i++) {
      const [x0, y0] = line[i - 1], [x1, y1] = line[i];
      b.face([b.P(x0, 0, y0), b.P(x1, 0, y1), b.P(x1, 0, top), b.P(x0, 0, top)], b.N(0, 1, 0), finish);
    }
    if (o.z0 - base > 0.05) {
      b.panel(o.a0, o.a1, 0, base, o.z0, gf.plinth.kind !== 'none' ? shadeHex(finish, 0.82) : finish);
      b.slab(o.a0 - 0.03, o.a1 + 0.03, 0, FRONT.sillOutM + 0.02, o.z0 - 0.05, o.z0, masonry ? shadeHex(finish, 1.08) : frame, 'top');
    }
    // Reveals into the cut wall: both sides to the spring, the soffit or the arch's intrados, in the finish's shade.
    const rev = shadeHex(finish, 0.62);
    b.face([b.P(o.a0, -recess, o.z0), b.P(o.a0, 0, o.z0), b.P(o.a0, 0, o.spring), b.P(o.a0, -recess, o.spring)], b.N(1, 0, 0), rev);
    b.face([b.P(o.a1, -recess, o.z0), b.P(o.a1, 0, o.z0), b.P(o.a1, 0, o.spring), b.P(o.a1, -recess, o.spring)], b.N(-1, 0, 0), rev);
    for (let i = 1; i < line.length; i++) {
      const [x0, y0] = line[i - 1], [x1, y1] = line[i], nx = y1 - y0, nz = -(x1 - x0), l = Math.hypot(nx, nz) || 1;
      const n = b.N(nx / l, 0, nz / l);
      b.face([b.P(x0, -recess, y0), b.P(x1, -recess, y1), b.P(x1, 0, y1), b.P(x0, 0, y0)], n, shadeHex(finish, 0.5));
    }
    // A plinth course under the opening's sill (the same course the piers carry).
  }
  if (gf.plinth.kind !== 'none' && gf.plinth.heightM > 0.05) {
    const h = Math.min(gf.plinth.heightM, top - base - 1), hex = gf.plinth.kind === 'rusticated' ? shadeHex(finish, 0.88) : shadeHex(finish, 0.8);
    for (const p of gf.piers) b.slab(s0 + p.a0 * W - 0.01, s0 + p.a1 * W + 0.01, 0, GF_DEPTH.pierOutStone + 0.03, base, base + h, hex, 'top', true);
  }
  // What fills each opening, set back in it.
  const back = shifted(e, -recess), bb = new Builder(back), props = shopPropsFor(input.template);
  const shops = ops.map((o, i) => ({ o, i })).filter(x => x.o.kind === 'shop');
  const signIdx = gf.sign.opening !== undefined && ops[gf.sign.opening] ? gf.sign.opening : shops.slice().sort((p, q) => (q.o.a1 - q.o.a0) - (p.o.a1 - p.o.a0))[0]?.i;
  const word = input.chain ? input.chain.word : look.word === 'name' ? (input.word ? signText(input.word) : input.word) : look.word;
  const boardHex = gf.fascia.hex ?? (input.chain?.fascia ?? (brandish ? look.fascia : GF_DARK));
  const ink = input.chain?.letters ?? (brandish || gf.fascia.hex ? look.letters : '#efe9dc');
  // A sign outside the openings that finds no room over them (a head the storey cannot press further) goes up as a board
  // in its opening instead, so the shop keeps its name (fix round 2); a read of no sign stays bare.
  const sgOut = signIdx !== undefined ? ops[signIdx] : undefined, crownMax = Math.max(...ops.map(o => o.crown));
  const outsideFits = gf.sign.kind === 'fascia' && !gf.fascia.inOpening ? top - 0.08 - Math.max(crownMax + 0.04, top - 0.08 - Math.min(gf.fascia.heightM ?? FRONT.fasciaM, 1.0)) >= 0.25
    : gf.sign.kind === 'wall-letters' ? !!sgOut && !!word && top - 0.16 - sgOut.crown >= 0.3
      : gf.sign.kind === 'lightbox' ? !!sgOut && Math.min(top - 0.06, sgOut.crown + 0.86) - (sgOut.crown + 0.06) >= 0.3 : false;
  const named = !!(word || input.logo);
  const inOpeningBoard = gf.sign.kind === 'board-in-opening' || (gf.sign.kind === 'fascia' && gf.fascia.inOpening)
    || (named && !outsideFits && (gf.sign.kind === 'fascia' || gf.sign.kind === 'wall-letters' || gf.sign.kind === 'lightbox'));
  const hasDoorOpening = ops.some(o => o.kind === 'door');
  const lightHex = glassTone('#7f8b93', 0.5);
  // Lane shop-variety: the goods tiles of every shop opening, planned together with the front's doors.
  const recs: GoodsTileRec[] | undefined = look.goods && input.variety !== undefined && shopVarietyOn() ? [] : undefined;
  const doors: Array<[number, number]> = ops.filter(o => o.kind === 'door').map(o => [o.a0, o.a1]);
  for (const [i, o] of ops.entries()) {
    const w = o.a1 - o.a0;
    if (o.kind === 'door') {
      doorUnit(bb, o.a0 + 0.04, o.a1 - 0.04, 0, o.z0, Math.min(o.spring, o.z0 + FRONT.doorHeadM + 0.3), frame);
      if (o.spring - (o.z0 + FRONT.doorHeadM + 0.3) > 0.2) bb.panel(o.a0, o.a1, FRONT.contentOutM, o.z0 + FRONT.doorHeadM + 0.3, o.spring, lightHex);
    } else if (o.kind === 'passage') {
      bb.panel(o.a0, o.a1, -1.2, o.z0, o.spring, '#26272a');
      for (const [s, f] of [[o.a0, 1], [o.a1, -1]] as const) bb.face([bb.P(s, -1.2, o.z0), bb.P(s, 0, o.z0), bb.P(s, 0, o.spring), bb.P(s, -1.2, o.spring)], bb.N(f, 0, 0), '#3a3836');
    } else if (o.kind === 'blank') {
      bb.panel(o.a0, o.a1, 0, o.z0, o.spring, shadeHex(finish, 0.9));
    } else if (o.kind === 'window') {
      bb.panel(o.a0, o.a1, 0, o.z0, o.spring, glassTone('#5c6a73', 0.55));
      bb.panel(o.a0, o.a1, 0.004, o.spring - 0.06, o.spring, frame);
    } else {
      // A shop: riser, sill, panes, props behind the glass; a door at the seeded end when the record has no door of its own.
      const signHere = inOpeningBoard && i === signIdx;
      const boardH = signHere ? Math.min(gf.fascia.heightM ?? 0.55, Math.max(0.3, (o.spring - o.z0) * 0.18)) : 0;
      const glassTop = o.spring - boardH - (signHere ? 0.04 : 0);
      const zr = o.z0 + Math.min(FRONT.riserM, Math.max(0, glassTop - o.z0 - 1.2));
      const door = !hasDoorOpening && w >= 2.0 && look.content !== 'redGlow' ? retailDoor({ template: input.template, seed: `${input.seed}:${i}` }, o.a0 + 0.02, o.a1 - 0.02) : null;
      const segs: Array<[number, number]> = door ? [[o.a0 + 0.04, door.a0 - FRONT.mullionM], [door.a1 + FRONT.mullionM, o.a1 - 0.04]] : [[o.a0 + 0.04, o.a1 - 0.04]];
      if (door) {
        doors.push([door.a0, door.a1]);
        const dh = Math.min(glassTop, o.z0 + FRONT.doorHeadM);
        doorUnit(bb, door.a0, door.a1, 0, o.z0, dh, frame);
        if (glassTop - dh > 0.2) bb.panel(door.a0, door.a1, FRONT.contentOutM, dh, glassTop, lightHex);
      }
      bb.fin(o.a0, o.a0 + 0.04, 0, FRONT.frameOutM, o.z0, o.spring, frame);
      bb.fin(o.a1 - 0.04, o.a1, 0, FRONT.frameOutM, o.z0, o.spring, frame);
      for (const [bay, [c0, c1]] of segs.entries()) {
        if (c1 - c0 < 0.4) continue;
        const seed = baySeed(`${input.seed}:${i}`, bay), panes = Math.max(1, Math.ceil((c1 - c0) / (look.paneM ?? FRONT.paneMaxM))), pw = (c1 - c0) / panes;
        if (zr - o.z0 > 0.05) bb.panel(c0, c1, props?.inside ? INSIDE.riserOutM : 0.015, o.z0, zr, shadeHex(frame, 1.12));
        if (look.content === 'redGlow') content(bb, look, c0, c1, zr, glassTop - FRONT.headGapM, seed);
        else fillPanes(bb, look, input, c0, c1, zr, glassTop, i * 4 + bay, panes, pw, seed, recs);
        if (props?.inside) insideRelief(bb, props, c0, c1, o.z0, glassTop, input.seed, i * 4 + bay, look.lit);
        for (let k = 1; k < panes; k++) { const a = c0 + k * pw; bb.panel(a - FRONT.mullionM / 2, a + FRONT.mullionM / 2, FRONT.frameOutM - 0.03, zr, glassTop, frame); }
      }
      if (signHere) {
        // The board inside the opening (The Sting's black board at the arch's springing; Scheltema's blue band).
        bb.slab(o.a0 + 0.04, o.a1 - 0.04, 0, FRONT.frameOutM, glassTop, o.spring, boardHex, 'bottom', false, look.lit);
        letterBoard(bb, input, look, word, o.a0 + 0.04, o.a1 - 0.04, glassTop, o.spring, FRONT.frameOutM + FRONT.letterOutM, ink, boardHex);
      }
      // An arched head's fanlight: dark glass under the arch, a transom bar on the springing line.
      if (o.crown - o.spring > 0.05) {
        const line = archLine(o.a0, o.a1, o.spring, o.crown - o.spring), mid = (o.a0 + o.a1) / 2;
        // Strips from the springing line up to the arch, wound like the spandrels (a fan of triangles drew half of
        // them back-facing: the red and grey quadrants of blind round 1).
        for (let k = 1; k < line.length; k++) { const [x0, y0] = line[k - 1], [x1, y1] = line[k]; bb.face([bb.P(x0, FRONT.contentOutM, o.spring), bb.P(x1, FRONT.contentOutM, o.spring), bb.P(x1, FRONT.contentOutM, y1), bb.P(x0, FRONT.contentOutM, y0)], bb.N(0, 1, 0), lightHex); }
        bb.slab(o.a0, o.a1, 0, FRONT.frameOutM - 0.03, o.spring - FRONT.transomM, o.spring, frame, 'bottom');
        for (const t of [1 / 3, 2 / 3]) { const ang = Math.PI * t, r = (o.a1 - o.a0) / 2; bb.face([bb.P(mid - 0.02, 0.05, o.spring), bb.P(mid + 0.02, 0.05, o.spring), bb.P(mid + r * Math.cos(ang) + 0.02, 0.05, o.spring + (o.crown - o.spring) * Math.sin(ang)), bb.P(mid + r * Math.cos(ang) - 0.02, 0.05, o.spring + (o.crown - o.spring) * Math.sin(ang))], bb.N(0, 1, 0), frame); }
      }
      const awning = input.awning ?? look.awning;
      if (awning && o.head === 'flat') b.slope(o.a0, o.a1, 1.0, o.spring + 0.05, o.spring - 0.45, awning);
    }
  }
  if (recs && look.goods) varyPanes(recs, doors, look.goods, input);
  // The sign outside the openings: a fascia band over them, letters on the wall, a lightbox.
  const sg = signIdx !== undefined ? ops[signIdx] : undefined;
  const crownTop = Math.max(...ops.map(o => o.crown));
  if (gf.sign.kind === 'fascia' && !gf.fascia.inOpening) {
    const h = Math.min(gf.fascia.heightM ?? FRONT.fasciaM, 1.0), z1 = top - 0.08, z0 = Math.max(crownTop + 0.04, z1 - h);
    if (z1 - z0 >= 0.25) {
      b.slab(s0, s1, 0.01, FRONT.fasciaOutM, z0, z1, boardHex, 'bottom', true, look.lit);
      letterBoard(b, input, look, word, s0 + 0.1, s1 - 0.1, z0, z1, FRONT.fasciaOutM + FRONT.letterOutM, ink, boardHex);
    }
  } else if (gf.sign.kind === 'wall-letters' && sg && word) {
    const z0 = sg.crown + 0.08, z1 = top - 0.08;
    if (z1 - z0 >= 0.3) b.word(word, sg.a0, sg.a1, (z0 + z1) / 2, FRONT.letterOutM + 0.01, Math.min(0.7, z1 - z0 - 0.04), look.letters === boardHex ? ink : look.letters, finish, look.lit, input.letters);
  } else if (gf.sign.kind === 'lightbox' && sg) {
    const z0 = sg.crown + 0.06, z1 = Math.min(top - 0.06, z0 + 0.8);
    if (z1 - z0 >= 0.3) {
      if (input.logo) {
        const hM = z1 - z0, wM = Math.min(sg.a1 - sg.a0, hM * input.logo.aspect), mid = (sg.a0 + sg.a1) / 2;
        b.textured(mid - wM / 2, mid + wM / 2, 0.12, z0, z0 + wM / input.logo.aspect, input.logo.layer, input.logo.rect);
      } else {
        const mid = (sg.a0 + sg.a1) / 2, wM = Math.min(sg.a1 - sg.a0, 3);
        b.box(mid - wM / 2, mid + wM / 2, 0, 0.12, z0, z1, boardHex, look.lit, true);
        letterBoard(b, input, look, word, mid - wM / 2, mid + wM / 2, z0, z1, 0.12 + FRONT.letterOutM, ink, boardHex);
      }
    }
  }
  if (gf.sign.blade || look.blade) {
    const firstPier = gf.piers.map(p => [s0 + p.a0 * W, s0 + p.a1 * W]).find(([p0, p1]) => p1 - p0 >= 0.15) ?? [s0, s0 + 0.3];
    const at = (firstPier[0] + firstPier[1]) / 2, z = Math.min(top - 0.3, Math.max(base + 2.6, (sg?.spring ?? base + 3) - 0.2));
    const hex = look.blade ?? boardHex;
    b.box(at - 0.03, at + 0.03, 0.05, 0.85, z + 0.35, z + 0.4, '#2a2a2a', false, true);
    b.box(at - 0.05, at + 0.05, 0.25, 0.8, z - 0.25, z + 0.35, hex, look.lit, true);
    if (look.bladeGlyph && input.letters !== undefined) for (const side of [1, -1] as const) b.sideGlyph(look.bladeGlyph, at + side * 0.052, side, 0.52, z + 0.05, 0.44, input.letters, look.bladeInk ?? '#d0101b', hex, look.lit);
  }
  // On the pavement: the template's props in front of each shop opening, else its pavement goods along the front.
  if (props?.outside) {
    const runs = shops.map(({ o }) => [o.a0 + 0.1, o.a1 - 0.1] as [number, number]).filter(([r0, r1]) => r1 - r0 > 0.5);
    const fleet = input.bike?.cls === 'rental' ? input.bike.fleetHex : undefined, frames = new Set<string>(BIKE_HEXES);
    b.put(outsideProps(props, runs, input.seed), q => [q[0], q[1], base + q[2]], fleet ? hex => (frames.has(hex) ? fleet : hex) : undefined);
  } else pavement(b, look, s0, s1, base, input.seed);
  return [...b.out, ...bb.out];
}

/** A logo or the name on a board over [a0, a1] x [z0, z1] at `o` out (the chain's logo when it has one). */
function letterBoard(b: Builder, input: RetailFrontInput, look: TemplateLook, word: string | undefined, a0: number, a1: number, z0: number, z1: number, o: number, ink: string, board: string): void {
  const h = z1 - z0;
  if (input.logo) {
    const hM = Math.min(h - 0.06, 0.9), wM = Math.min(a1 - a0 - 0.1, hM * input.logo.aspect), mid = (a0 + a1) / 2;
    if (wM > 0.1) b.textured(mid - wM / 2, mid + wM / 2, o, (z0 + z1) / 2 - wM / input.logo.aspect / 2, (z0 + z1) / 2 + wM / input.logo.aspect / 2, input.logo.layer, input.logo.rect);
  } else if (word) {
    const face = look.face && input.faces !== undefined ? { face: look.face, layer: input.faces + ['serif', 'condensed', 'script'].indexOf(look.face) } : undefined;
    b.word(face?.face === 'script' && look.word === 'name' ? titleCase(word) : word, a0 + 0.1, a1 - 0.1, (z0 + z1) / 2, o, Math.min(face ? h - 0.04 : MAX_LETTER_H, h - 0.04), ink, board, look.lit, input.letters, face);
  }
}
