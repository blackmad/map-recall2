// The flat colour of every own-ground layer (pure): one table for the three places that draw the ground flat.
//
//   - the own ground's overview → city blend (gameGround.ts `blendMaterial`): a layer fades from this tone to its
//     lit, textured self;
//   - the overview tiles (scripts/overview-tiles/build-overview-tiles.ts): the own ground's cells rasterised from
//     straight above, each pixel in its top layer's tone, so the flat map far below the ride is the same ground;
//   - the runtime check that the published tiles were baked from the palette the page runs (tileset.ts).
//
// Tones come from look/sunny.ts `groundTokens` and the ground look's palette (ownGround/groundLook.ts), the same
// strings the basemap patches use (ownGround/basemapPalette.ts). Vertex-coloured layers take their vertex tone.

import { groundTokens } from '../look/sunny.js';
import { hexToRgb, type RGB } from '../look/palette.js';
import type { GroundPalette } from '../ownGround/groundLook.js';
import type { GroundLayer } from '../ownGround/groundCell.js';
import { QUAY } from '../ownGround/water.js';
import { DECK_TOP } from '../ownGround/decks.js';
import { PARK_FURNITURE_COLOURS } from '../ownGround/parks.js';

/** A flat tone: a CSS colour (`rgb(r,g,b)` or hex), an sRGB triple 0..255, or 'vertex' (the mesh's own colours). */
export type FlatTone = string | readonly number[] | 'vertex';

/** The blend's flat tone per ground layer (gameGround.ts): layers missing here blend from their vertex colours. */
export function flatLayerTones(palette: GroundPalette): Partial<Record<GroundLayer, FlatTone>> {
  const T = groundTokens(palette), { street: S, tones: G } = palette;
  return {
    land: T.land, klinker: T.klinker, brick: S.brick.base, asphalt: T.road, cycle: T.cycle,
    paving: T.pavement, gravel: T.gravel, kerb: S.kerb, paint: T.road, tram: T.road,
    bollard: T.pavement, park: T.park, wood: T.wood, square: G.square.base, parking: G.parking, water: T.water,
    lawn: G.lawn, bed: G.bed.soil, shrub: G.shrub.base, bark: G.bark, sand: G.sand, parkGravel: G.parkGravel, parkPath: G.parkPath, pond: G.pond,
  };
}

/** Vertex tones seen from above (water.ts QUAY coping, decks.ts DECK_TOP, parks.ts hedge tops), sRGB 0..255. */
const unit = (c: readonly number[]): RGB => [Math.round(c[0] * 255), Math.round(c[1] * 255), Math.round(c[2] * 255)];
export const VERTEX_TOP_TONES: Partial<Record<GroundLayer, RGB>> = {
  quay: unit(QUAY.coping),
  deckTop: unit(DECK_TOP),
  deckBody: unit(DECK_TOP),
  hedge: unit(PARK_FURNITURE_COLOURS.hedgeTop),
};

/**
 * Layers the overview raster leaves out: lines narrower than a tile pixel at z16 (1.5 m), which would alias into
 * specks (paint 0.15 m, rails, kerb tops 0.11 m), and the point furniture. The layer beneath shows instead.
 */
export const OVERVIEW_SKIPPED: ReadonlySet<GroundLayer> = new Set<GroundLayer>(['paint', 'tram', 'bollard', 'kerb', 'furniture']);

/** Parse a CSS `rgb(r,g,b)` / hex string or pass an RGB triple through (sRGB 0..255, rounded). */
export function toneRgb(tone: string | readonly number[]): RGB {
  if (typeof tone !== 'string') return [Math.round(tone[0]), Math.round(tone[1]), Math.round(tone[2])];
  const m = /^rgb\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*\)$/.exec(tone);
  if (m) return [Math.round(+m[1]), Math.round(+m[2]), Math.round(+m[3])];
  return hexToRgb(tone);
}

/** The overview colour of each ground layer the raster draws (sRGB 0..255): the blend's flat tone, else the vertex tone. */
export function overviewLayerColours(palette: GroundPalette, layers: readonly GroundLayer[]): Partial<Record<GroundLayer, RGB>> {
  const flat = flatLayerTones(palette), out: Partial<Record<GroundLayer, RGB>> = {};
  for (const layer of layers) {
    if (OVERVIEW_SKIPPED.has(layer)) continue;
    const t = flat[layer];
    const rgb = t && t !== 'vertex' ? toneRgb(t) : VERTEX_TOP_TONES[layer];
    if (rgb) out[layer] = rgb;
  }
  return out;
}
