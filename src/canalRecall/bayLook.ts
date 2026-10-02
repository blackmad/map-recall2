// Which bay textures the in-game layer uses for the `cartoon` and `photo`
// looks (the per-bay drawing lives in `bayTextures.ts`, from the standalone
// rendering spike). The spike builds one mesh per variant; here the variants
// are a small fixed set so they fit one texture array and one draw per tile:
// 8 building styles x 4 bay kinds = 32 layers.

import { archetypeFor, paletteFor, type Archetype, type BayKind, type BayVariant, type Look } from './bayTextures.js';
import { hashSeed } from './wallBays.js';
import type { FacadeStyle } from './genericFacades.js';

export const BAY_KINDS = ['upper', 'ground', 'groundDoor', 'groundShop'] as const satisfies readonly BayKind[];
type BayStyle = Omit<BayVariant, 'kind' | 'archetype'>;

/** Curated building styles per archetype (window count, head shape, shutters, painted frames). */
export const BAY_STYLES: Record<Archetype, readonly BayStyle[]> = {
  canal: [
    { windows: 2, shape: 'rect', shutters: false, paintedFrames: false },
    { windows: 2, shape: 'rect', shutters: true, paintedFrames: false },
    { windows: 3, shape: 'rect', shutters: false, paintedFrames: true },
    { windows: 2, shape: 'arch', shutters: false, paintedFrames: false },
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
export const BAY_ENTRIES: readonly Entry[] = ARCHETYPES.flatMap(archetype =>
  BAY_STYLES[archetype].flatMap((_, style) => BAY_KINDS.map(kind => ({ archetype, style, kind, layer: 0 })))).map((e, layer) => ({ ...e, layer }));
export const BAY_LAYER_COUNT = BAY_ENTRIES.length;

export const bayVariant = (e: Entry): BayVariant => ({ archetype: e.archetype, kind: e.kind, ...BAY_STYLES[e.archetype][e.style] });
export const bayLayer = (archetype: Archetype, style: number, kind: (typeof BAY_KINDS)[number]): number =>
  BAY_ENTRIES.find(e => e.archetype === archetype && e.style === style && e.kind === kind)!.layer;

/** The layout style (cell dimensions) each archetype uses. */
export const ARCHETYPE_LAYOUT: Record<Archetype, FacadeStyle> = { canal: 'canal', school: 'school', modern: 'modern' };

/**
 * Wall colours for the photo look: the real Amsterdam range (red and orange
 * brick, grey-brown, buff, a little limewash), with weights so reds dominate
 * the way they do on the streets. The spike's palette was pastel, which over
 * the dark brick photo came out as one chocolate wall.
 */
const PHOTO_WALLS = ['#b05a40', '#b05a40', '#a24d38', '#bd6a45', '#9a5846', '#8c5a48', '#c58b5e', '#d3b184', '#a8766a', '#7f6258', '#d9c5a4'];
/** Wall colours for the cartoon look, widened beyond the spike's mostly-terracotta mix. */
const CARTOON_WALLS = ['#e0694b', '#e0694b', '#cf7c52', '#eba05d', '#f0c35a', '#f3e2bb', '#e8a99b', '#d98a6a', '#9fc09f', '#7fa7c6', '#b9805a', '#f0b48a'];

/** Everything the mesh builder needs from a feature for a bay look. */
export function bayLookFor(id: string, year: number | null, heightM: number, look: Look) {
  const archetype = archetypeFor(id, year, heightM);
  const h = hashSeed(id), style = (h >>> 4) % BAY_STYLES[archetype].length;
  const shop = (h >>> 13) % 4 === 0;
  const palette = paletteFor(id, archetype, look);
  const walls = look === 'photo' ? PHOTO_WALLS : look === 'cartoon' && archetype !== 'modern' ? CARTOON_WALLS : null;
  if (walls) palette.wall = walls[(hashSeed(id) >>> 7) % walls.length];
  return {
    archetype, layout: ARCHETYPE_LAYOUT[archetype], wallHex: palette.wall, accentHex: palette.accent,
    layers: { upper: bayLayer(archetype, style, 'upper'), ground: bayLayer(archetype, style, shop ? 'groundShop' : 'ground'), door: bayLayer(archetype, style, 'groundDoor') },
  };
}
