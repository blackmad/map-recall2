// Chain logos on template fascias (lane retail-ground round 2, `?retailGround=1`): one texture-array layer, the logo
// layer, holds a 2 x 4 grid of logos sourced from Wikimedia Commons (data/retail-ground/logos/provenance.json: file,
// licence, artist, sha1 per logo; no brand sites, no Google/Apple). scripts/retail-ground/build-logo-atlas.ts paints the
// atlas with this module's layout; look/paintLookAtlas.ts loads it into the layer; the mesher maps fascia quads onto a
// logo's rect. Pure (no DOM): the worker and Node tests use it.
import { BAY_LAYER_COUNT } from './bayLook.js';
import { SURFACE_ROOF_LAYERS, SURFACE_SLOT_LAYERS } from './roofs/flatRoofSurface.js';
import type { RetailTemplate } from './retailTemplates.js';

/** Logos in atlas order, with each source render's width/height once its transparent margin is trimmed (the atlas
 *  builder checks them). Chains without a free Commons logo
 *  (FEBO, Stach, SLA on 2026-11-14) keep their block lettering. */
export const LOGOS: ReadonlyArray<{ key: RetailTemplate; aspect: number }> = [
  { key: 'ah', aspect: 864 / 910 }, { key: 'jumbo', aspect: 960 / 364 }, { key: 'hema', aspect: 960 / 583 },
  { key: 'etos', aspect: 960 / 766 }, { key: 'dirk', aspect: 960 / 557 }, { key: 'action', aspect: 960 / 182 },
  { key: 'bruna', aspect: 219 / 60 },
];
/** Round 6 (lane retail-look): the second logo page, one more layer after the first (retailLogoLayer + 1), the same
 *  2 x 4 grid with no lettering cell. Commons renders (public domain, provenance.json), matched to open panoramas. */
export const LOGOS_2: ReadonlyArray<{ key: RetailTemplate; aspect: number }> = [
  { key: 'mcdonalds', aspect: 954 / 833 }, { key: 'gallgall', aspect: 616 / 334 }, { key: 'kruidvat', aspect: 960 / 252 },
];
export const LOGO_GRID = { cols: 2, rows: 4, pad: 0.025 } as const;
/** The atlas's published path under canal-drive/ (scripts/retail-ground/build-logo-atlas.ts --publish). */
export const LOGO_ATLAS_PATH = 'materials/retail-logos/atlas.png';
/** The second page's atlas (round 6). */
export const LOGO_ATLAS_2_PATH = 'materials/retail-logos/atlas-2.png';

/**
 * The logo layer's ordinal: after the flat-roof surface layer (flatRoofSurfaceLayer), so the bay, roof, glass-block, slot
 * and surface layers keep theirs. Procedural cells have no room (their array stands at 256 layers) and no templates.
 */
export function retailLogoLayer(cells: string): number | null {
  return cells === 'procedural' ? null : BAY_LAYER_COUNT + SURFACE_ROOF_LAYERS + 1 + SURFACE_SLOT_LAYERS + 1;
}

/** A logo's cell in image space (x, y from the top-left, fractions) and the logo's fitted box inside it. */
export function logoBox(i: number, page: 0 | 1 = 0): { x: number; y: number; w: number; h: number } {
  const { cols, rows, pad } = LOGO_GRID, cw = 1 / cols, ch = 1 / rows, A = (page ? LOGOS_2 : LOGOS)[i].aspect;
  const iw = cw - 2 * pad, ih = ch - 2 * pad;
  const [w, h] = A > iw / ih ? [iw, iw / A] : [ih * A, ih];
  return { x: (i % cols) * cw + (cw - w) / 2, y: Math.floor(i / cols) * ch + (ch - h) / 2, w, h };
}

/** The template's logo: the uv rect (u0, v0, u1, v1; v up, as the array rows are bottom-first), its aspect, and its
 *  page (0: the logo layer, 1: the layer after it). */
export function logoFor(template: RetailTemplate): { rect: [number, number, number, number]; aspect: number; page: 0 | 1 } | null {
  for (const page of [0, 1] as const) {
    const list = page ? LOGOS_2 : LOGOS, i = list.findIndex(l => l.key === template);
    if (i < 0) continue;
    const b = logoBox(i, page);
    return { rect: [b.x, 1 - (b.y + b.h), b.x + b.w, 1 - b.y], aspect: list[i].aspect, page };
  }
  return null;
}

/**
 * Round 3c (lane retail-look-20261114): fascia lettering from the logo layer's spare cell (index 7, bottom right): a
 * bold sans (Helvetica Neue Bold, drawn by scripts/retail-ground/build-logo-atlas.ts) in a 9 x 4 grid, A-Z then 0-9,
 * white on black. paintLookAtlas paints the cell white with the glyph's coverage in the mask's tint channel (the
 * letters' colour) and the rest in the accent channel (the board's colour), so one atlas letters every template. A
 * letter is one textured quad. The 5 x 7 block letters this replaces were built from strips that broke into dots at
 * ride distance. Texture filtering and mips keep a solid stroke at any distance.
 */
export const GLYPH_CELL = 7;
// Round 6: & and ' (Gall & Gall, McDonald's), in a 10 x 4 grid at nine tenths of the old size (a W still fits its
// narrower cell; the ink fractions of the cell's width are unchanged).
export const GLYPH_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789&'";
export const GLYPH_GRID = { cols: 10, rows: 4 } as const;
/** Font size as a share of a glyph cell's height, and the baseline's place in it (the builder's text layout). */
export const GLYPH_FONT = { size: 0.9 * 26 / 32, baseline: 0.5 + 0.9 * (26 / 32) * 0.36 } as const;
/** Each glyph's ink, [x0, x1] as fractions of its cell's width (measured by the builder, which checks them). */
export const GLYPH_INK: Readonly<Record<string, readonly [number, number]>> = {
  '0': [0.263, 0.732], '1': [0.311, 0.605], '2': [0.263, 0.732], '3': [0.259, 0.737], '4': [0.259, 0.741], '5': [0.263, 0.737],
  '6': [0.263, 0.732], '7': [0.281, 0.719], '8': [0.259, 0.741], '9': [0.263, 0.732], A: [0.18, 0.82], B: [0.241, 0.789],
  C: [0.193, 0.803], D: [0.224, 0.803], E: [0.263, 0.763], F: [0.289, 0.75], G: [0.189, 0.794], H: [0.224, 0.776],
  I: [0.425, 0.57], J: [0.259, 0.689], K: [0.232, 0.833], L: [0.289, 0.754], M: [0.149, 0.851], N: [0.224, 0.776],
  O: [0.18, 0.82], P: [0.259, 0.776], Q: [0.18, 0.82], R: [0.232, 0.794], S: [0.224, 0.776], T: [0.232, 0.768],
  U: [0.219, 0.776], V: [0.206, 0.794], W: [0.07, 0.925], X: [0.189, 0.807], Y: [0.189, 0.811], Z: [0.224, 0.776],
  '&': [0.215, 0.82], "'": [0.449, 0.551],
};
/** A letter quad's rows of its cell (v from the cell's top): the caps run 0.21-0.79, Q's tail to 0.85. */
export const GLYPH_V = [0.1, 0.9] as const;
/** Side bearing each side of the ink, as a share of the quad's height, and a space's advance. */
export const GLYPH_SIDE = 0.07, GLYPH_SPACE = 0.32;
/** The glyph cell's box in the atlas image (x, y from the top-left, fractions). */
export function glyphCellBox(): { x: number; y: number; w: number; h: number } {
  const { cols, rows } = LOGO_GRID;
  return { x: (GLYPH_CELL % cols) / cols, y: Math.floor(GLYPH_CELL / cols) / rows, w: 1 / cols, h: 1 / rows };
}
/**
 * A letter quad: its span along the word (units of the quad's height) and uv rect. `z` (accent marks only): its
 * vertical span in units of the quad's height from the letter quad's foot, where it differs from the letter's [0, 1].
 */
export type GlyphQuad = { ch: string; a0: number; a1: number; rect: [number, number, number, number]; z?: readonly [number, number] };

// Lane shopfront-feedback-20261123 (David's note fd607d78, "Café Bonjour: missing the é"): accented letters drew as a
// gap ('CAF BONJOUR'). The lettering cell's two free slots (after the apostrophe) hold two marks, an acute stroke and
// a diaeresis, drawn over the cap band of their slot (accentGlyphSvg); a decomposed letter (NFD) draws its base glyph
// and its mark as a second quad over the capital. A grave is the acute mirrored (u swapped), a circumflex an acute and
// a grave side by side; a tilde, ring or cedilla draws the bare letter, which still reads better than a gap.
export const ACCENT_SLOTS = { acute: 38, diaeresis: 39 } as const;
/** A mark's quad: as wide as this share of the letter quad's height, centred on its letter, from ACCENT_Z (units of
 *  the letter quad's height from its foot: the caps run to 0.8625 of it, GLYPH_V and the 0.21 cap line). */
export const ACCENT_W = 0.34, ACCENT_Z = [0.885, 1.075] as const;
/** The slot's uv band the mark is drawn over and sampled from (fractions of the slot, from its top-left). */
export const ACCENT_UV = { u: [0.1, 0.9], v: [0.21, 0.79] } as const;
/** The SVG for a mark in its slot at (x, y), gw x gh px (white on the cell's black, as the letters). The quad squashes
 *  the band to ACCENT_W x (ACCENT_Z[1] - ACCENT_Z[0]) of the letter height, so the shapes are drawn pre-stretched. */
export function accentGlyphSvg(kind: keyof typeof ACCENT_SLOTS, x: number, y: number, gw: number, gh: number): string {
  const U = (f: number) => (x + gw * (ACCENT_UV.u[0] + (ACCENT_UV.u[1] - ACCENT_UV.u[0]) * f)).toFixed(2);
  const V = (f: number) => (y + gh * (ACCENT_UV.v[0] + (ACCENT_UV.v[1] - ACCENT_UV.v[0]) * f)).toFixed(2);
  if (kind === 'acute') return `<path d="M${U(0.18)} ${V(1)}L${U(0.52)} ${V(1)}L${U(0.88)} ${V(0)}L${U(0.48)} ${V(0)}Z" fill="#ffffff"/>`;
  return `<path d="M${U(0.06)} ${V(0.12)}H${U(0.38)}V${V(0.88)}H${U(0.06)}Z M${U(0.62)} ${V(0.12)}H${U(0.94)}V${V(0.88)}H${U(0.62)}Z" fill="#ffffff"/>`;
}
const MARKS: Readonly<Record<string, Array<{ slot: keyof typeof ACCENT_SLOTS; flip?: boolean; half?: 0 | 1 }>>> = {
  '́': [{ slot: 'acute' }], '̀': [{ slot: 'acute', flip: true }], '̈': [{ slot: 'diaeresis' }],
  '̂': [{ slot: 'acute', half: 0 }, { slot: 'acute', flip: true, half: 1 }],
};
/**
 * The word laid out in units of the letter quad's height: one quad per letter with its uv rect (v up, as logoFor), and
 * the word's width. An accented letter is its base letter and a mark quad over it (ACCENT_SLOTS). Other characters
 * outside A-Z 0-9 advance as a space.
 */
export function glyphLayout(word: string): { quads: GlyphQuad[]; width: number } {
  const box = glyphCellBox(), gw = box.w / GLYPH_GRID.cols, gh = box.h / GLYPH_GRID.rows, quads: GlyphQuad[] = [];
  const cellAspect = gw / gh;
  const slotXY = (i: number) => [box.x + (i % GLYPH_GRID.cols) * gw, box.y + Math.floor(i / GLYPH_GRID.cols) * gh] as const;
  let x = 0;
  for (const raw of [...word.toUpperCase()]) {
    // Precomposed letters outside the cell (É, Ö) decompose to their base letter and combining marks.
    const parts = GLYPH_CHARS.includes(raw) ? [raw] : [...raw.normalize('NFD')], ch = parts[0];
    const i = GLYPH_CHARS.indexOf(ch), ink = GLYPH_INK[ch];
    if (i < 0 || !ink) { x += GLYPH_SPACE; continue; }
    const [cx, cy] = slotXY(i);
    const side = GLYPH_SIDE * (GLYPH_V[1] - GLYPH_V[0]) / cellAspect;
    const f0 = Math.max(0, ink[0] - side), f1 = Math.min(1, ink[1] + side), w = (f1 - f0) * cellAspect / (GLYPH_V[1] - GLYPH_V[0]);
    const y0 = cy + GLYPH_V[0] * gh, y1 = cy + GLYPH_V[1] * gh;
    quads.push({ ch, a0: x, a1: x + w, rect: [cx + f0 * gw, 1 - y1, cx + f1 * gw, 1 - y0] });
    const mid = x + w / 2;
    for (const m of parts.slice(1).flatMap(c => MARKS[c] ?? [])) {
      const [sx, sy] = slotXY(ACCENT_SLOTS[m.slot]);
      let u0 = sx + ACCENT_UV.u[0] * gw, u1 = sx + ACCENT_UV.u[1] * gw;
      if (m.flip) [u0, u1] = [u1, u0];
      const half = m.half === undefined ? null : m.half, mw = half === null ? ACCENT_W : ACCENT_W * 0.55;
      const c = half === null ? mid : mid + (half === 0 ? -1 : 1) * mw * 0.45;
      quads.push({ ch: `${ch}${m.slot}`, a0: c - mw / 2, a1: c + mw / 2, rect: [u0, 1 - (sy + ACCENT_UV.v[1] * gh), u1, 1 - (sy + ACCENT_UV.v[0] * gh)], z: ACCENT_Z });
    }
    x += w;
  }
  return { quads, width: x };
}
