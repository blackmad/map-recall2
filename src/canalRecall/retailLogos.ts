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
export const LOGO_GRID = { cols: 2, rows: 4, pad: 0.025 } as const;
/** The atlas's published path under canal-drive/ (scripts/retail-ground/build-logo-atlas.ts --publish). */
export const LOGO_ATLAS_PATH = 'materials/retail-logos/atlas.png';

/**
 * The logo layer's ordinal: after the flat-roof surface layer (flatRoofSurfaceLayer), so the bay, roof, glass-block, slot
 * and surface layers keep theirs. Procedural cells have no room (their array stands at 256 layers) and no templates.
 */
export function retailLogoLayer(cells: string): number | null {
  return cells === 'procedural' ? null : BAY_LAYER_COUNT + SURFACE_ROOF_LAYERS + 1 + SURFACE_SLOT_LAYERS + 1;
}

/** A logo's cell in image space (x, y from the top-left, fractions) and the logo's fitted box inside it. */
export function logoBox(i: number): { x: number; y: number; w: number; h: number } {
  const { cols, rows, pad } = LOGO_GRID, cw = 1 / cols, ch = 1 / rows, A = LOGOS[i].aspect;
  const iw = cw - 2 * pad, ih = ch - 2 * pad;
  const [w, h] = A > iw / ih ? [iw, iw / A] : [ih * A, ih];
  return { x: (i % cols) * cw + (cw - w) / 2, y: Math.floor(i / cols) * ch + (ch - h) / 2, w, h };
}

/** The template's logo: the uv rect (u0, v0, u1, v1; v up, as the array rows are bottom-first) and its aspect. */
export function logoFor(template: RetailTemplate): { rect: [number, number, number, number]; aspect: number } | null {
  const i = LOGOS.findIndex(l => l.key === template);
  if (i < 0) return null;
  const b = logoBox(i);
  return { rect: [b.x, 1 - (b.y + b.h), b.x + b.w, 1 - b.y], aspect: LOGOS[i].aspect };
}
