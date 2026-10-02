// Which bay textures the in-game layer uses for the `cartoon` and `photo`
// looks (the per-bay drawing lives in `bayTextures.ts`, from the standalone
// rendering spike). The spike builds one mesh per variant; here the variants
// are a small fixed set so they fit one texture array and one draw per tile:
// 10 building styles x 4 bay kinds, plus 7 shopfronts per archetype = 68 layers.

import { SHOP_KINDS, archetypeFor, paletteFor, type Archetype, type BayKind, type BayVariant, type Look, type ShopKind } from './bayTextures.js';
import { hashSeed } from './wallBays.js';
import type { FacadeStyle } from './genericFacades.js';

export const BAY_KINDS = ['upper', 'ground', 'groundDoor', ...SHOP_KINDS, 'plain'] as const satisfies readonly BayKind[];
const isShopKind = (kind: string) => (SHOP_KINDS as readonly string[]).includes(kind);
type BayStyle = Omit<BayVariant, 'kind' | 'archetype'>;

/** Curated building styles per archetype (window count, head shape, shutters, painted frames). */
export const BAY_STYLES: Record<Archetype, readonly BayStyle[]> = {
  // Canal houses: tall white-framed sashes under flat lintels; shutters only beside ground-floor windows.
  canal: [
    { windows: 2, shape: 'rect', shutters: false, paintedFrames: false },
    { windows: 2, shape: 'rect', shutters: true, paintedFrames: false },
    { windows: 3, shape: 'rect', shutters: false, paintedFrames: true },
    { windows: 2, shape: 'rect', shutters: false, paintedFrames: true },
  ],
  // 1860-1914: segmental-arched windows under stucco hoods, string courses at every floor.
  c19: [
    { windows: 2, shape: 'arch', shutters: false, paintedFrames: false },
    { windows: 2, shape: 'rect', shutters: false, paintedFrames: false },
  ],
  school: [
    { windows: 2, shape: 'rect', shutters: false, paintedFrames: false },
    { windows: 2, shape: 'rect', shutters: false, paintedFrames: true },
  ],
  modern: [
    { windows: 1, shape: 'rect', shutters: false, paintedFrames: false },
    { windows: 1, shape: 'rect', shutters: false, paintedFrames: true },
  ],
};
const ARCHETYPES = Object.keys(BAY_STYLES) as Archetype[];

type Entry = { archetype: Archetype; style: number; kind: (typeof BAY_KINDS)[number]; layer: number };
// Shopfronts do not depend on the building's window style, so they exist once per archetype.
export const BAY_ENTRIES: readonly Entry[] = ARCHETYPES.flatMap(archetype =>
  BAY_STYLES[archetype].flatMap((_, style) => BAY_KINDS.filter(kind => !isShopKind(kind) || style === 0).map(kind => ({ archetype, style, kind, layer: 0 })))).map((e, layer) => ({ ...e, layer }));
export const BAY_LAYER_COUNT = BAY_ENTRIES.length;

export const bayVariant = (e: Entry): BayVariant => ({ archetype: e.archetype, kind: e.kind, ...BAY_STYLES[e.archetype][e.style] });
export const bayLayer = (archetype: Archetype, style: number, kind: (typeof BAY_KINDS)[number]): number =>
  BAY_ENTRIES.find(e => e.archetype === archetype && e.style === (isShopKind(kind) ? 0 : style) && e.kind === kind)!.layer;

/** The layout style (cell dimensions) each archetype uses. */
export const ARCHETYPE_LAYOUT: Record<Archetype, FacadeStyle> = { canal: 'canal', c19: 'c19', school: 'school', modern: 'modern' };

/**
 * Wall colours for the photo look: the real Amsterdam range (red and orange
 * brick, grey-brown, buff, a little limewash), with weights so reds dominate
 * the way they do on the streets. The spike's palette was pastel, which over
 * the dark brick photo came out as one chocolate wall.
 */
export const PHOTO_WALLS = ['#b05a40', '#b05a40', '#a24d38', '#bd6a45', '#9a5846', '#8c5a48', '#c58b5e', '#d3b184', '#a8766a', '#7f6258', '#d9c5a4'];
/** Storybook: the natural palette, slightly warmed and softened, as an illustrator would paint it. */
export const STORYBOOK_WALLS = ['#c8664a', '#c8664a', '#b9583f', '#d98b5f', '#e0b36a', '#ead9b0', '#c9a08c', '#b87a5c', '#9bb09a', '#8aa4b8', '#d9b995'];
/** Cartoon: a short sticker palette, saturated and similar in value, so the street reads as one bold design. */
export const CARTOON_WALLS = ['#e8573d', '#e8573d', '#ee7f2c', '#f2b92e', '#f2b92e', '#2a9d8f', '#4672b0', '#f3e6c8', '#d96a4d'];

/**
 * Ground-floor paint for shopfronts, per look, weighted the way Amsterdam streets are: mostly
 * white and cream, then the dark greens, blacks, oxbloods and navies of older shopfronts.
 */
export const GROUND_PAINTS: Record<Look, readonly string[]> = {
  photo: ['#f1eee6', '#f1eee6', '#f1eee6', '#e8dfc9', '#e8dfc9', '#2b2d2c', '#2f4a3a', '#5a2a26', '#25344a', '#8b8f8c'],
  storybook: ['#f6f1e4', '#f6f1e4', '#f6f1e4', '#efe2c2', '#efe2c2', '#3a3d3c', '#3f6a52', '#8a3b33', '#3a527a', '#a3a8a4'],
  cartoon: ['#fffaf0', '#fffaf0', '#fffaf0', '#ffe9b8', '#ffe9b8', '#3b3b4a', '#2a9d8f', '#d9453d', '#4672b0', '#f2b92e'],
};

/** Everything the mesh builder needs from a feature for a bay look. */
/**
 * `shopfront`: from the shopfronts extract, the shopfront this building really has, or
 * 'quiet' for none; undefined (no extract) keeps the old random third of shops.
 */
export function bayLookFor(id: string, year: number | null, heightM: number, look: Look, shopfront?: ShopKind | 'quiet') {
  const archetype = archetypeFor(id, year, heightM);
  const h = hashSeed(id), style = (h >>> 4) % BAY_STYLES[archetype].length;
  // Without the extract: a third of buildings, picking among the original four shopfronts.
  const shop = shopfront ? shopfront !== 'quiet' : (h >>> 13) % 3 === 0;
  const shopKind = shopfront && shopfront !== 'quiet' ? shopfront : SHOP_KINDS[(h >>> 17) % 4];
  const palette = paletteFor(id, archetype, look);
  const walls = look === 'photo' ? PHOTO_WALLS : archetype === 'modern' ? null : look === 'storybook' ? STORYBOOK_WALLS : CARTOON_WALLS;
  if (walls) palette.wall = walls[(hashSeed(id) >>> 7) % walls.length];
  // A shop's ground floor is painted, and the paint is its own colour, not the brick's.
  const paints = GROUND_PAINTS[look];
  return {
    archetype, layout: ARCHETYPE_LAYOUT[archetype], wallHex: palette.wall, accentHex: palette.accent,
    groundHex: shop ? paints[(h >>> 21) % paints.length] : undefined,
    layers: { upper: bayLayer(archetype, style, 'upper'), ground: bayLayer(archetype, style, shop ? shopKind : 'ground'), door: bayLayer(archetype, style, 'groundDoor') },
    plain: bayLayer(archetype, style, 'plain'),
  };
}
