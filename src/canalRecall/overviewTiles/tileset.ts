// The overview tiles at runtime (pure): whether the published tileset fits the page's palette, and the MapLibre
// source and layer that draw it.
//
// The tiles (scripts/overview-tiles/build-overview-tiles.ts) are the own ground's cells rasterised from straight
// above in the ground look's flat tones, published under public/data/extracts/amsterdam/overview-tiles-v<N>/ with a
// manifest naming the look and every layer's colour. The page draws them only when those colours are exactly the
// ones it would draw (`?groundLook=` variants and palette edits not yet re-baked fall back to the recoloured
// basemap, never to a mismatched flat map). Above the basemap's ground fills and lines, below its buildings and
// labels and the game's overlays; transparent where there is no own ground, so the basemap shows outside the
// extract.

import type { RGB } from '../look/palette.js';
import { GROUND_LOOK_DEFAULT, groundPalette, type GroundLook } from '../ownGround/groundLook.js';
import type { GroundLayer } from '../ownGround/groundCell.js';
import { overviewLayerColours } from './layerColours.js';
import { footprintTone } from '../overviewTransition/basemapOverview.js';

export interface OverviewTilesManifest {
  version: 1;
  /** The ground look the tiles were baked in. */
  look: GroundLook;
  /** Every layer's tone in the tiles (sRGB 0..255). */
  colours: Partial<Record<GroundLayer, RGB>>;
  /** The building footprints' tone (basemapOverview.ts footprintTone, the city's roofs from above). */
  roof: RGB;
  minzoom: number;
  maxzoom: number;
  /** lng/lat [w, s, e, n] of the tiles that exist. */
  bounds: [number, number, number, number];
  tiles: number;
  bytes: number;
  built: string;
  attribution: string;
}

export const OVERVIEW_TILES_DIR = 'overview-tiles-v1';
export const OVERVIEW_TILES_SOURCE = 'canal-overview-ground';
export const OVERVIEW_TILES_LAYER = 'canal-overview-ground';
/**
 * Basemap source layers the tiles replace (they go above the topmost of them): the ground, and the flat building
 * footprints, which the tiles carry from the city's own footprints at every zoom. The basemap's footprints change
 * geometry at its zoom-14 tiles (generalised blocks below, single buildings from 14): a jump of ~5 % of the view
 * at 13.9 → 14 in the overview-transition sweep that no palette can remove.
 */
export const BASEMAP_GROUND_SOURCE_LAYERS = ['water', 'waterway', 'landcover', 'landuse', 'park', 'transportation', 'aeroway', 'building'];

/** The layers whose colour differs between the tiles and the page's palette (empty: the tiles fit). */
export function tilesetMismatch(manifest: Pick<OverviewTilesManifest, 'colours' | 'roof'>, look: GroundLook): (GroundLayer | 'roof')[] {
  const layers = Object.keys(manifest.colours) as GroundLayer[];
  const want = overviewLayerColours(groundPalette(look), layers), bad: (GroundLayer | 'roof')[] = [];
  const differ = (a?: readonly number[], b?: readonly number[]) => !a || !b || a[0] !== b[0] || a[1] !== b[1] || a[2] !== b[2];
  for (const layer of layers) if (differ(manifest.colours[layer], want[layer])) bad.push(layer);
  if (differ(manifest.roof, footprintTone())) bad.push('roof');
  return bad;
}

interface LayerLike { id: string; type: string; source?: string; 'source-layer'?: string }

/** The id the tiles' layer goes before: the layer right above the basemap's topmost flat ground or footprint layer (undefined: on top). */
export function overviewTilesBeforeId(layers: readonly LayerLike[]): string | undefined {
  let last = -1;
  layers.forEach((l, i) => {
    if (l.type === 'background' || ((l.type === 'fill' || l.type === 'line') && BASEMAP_GROUND_SOURCE_LAYERS.includes(l['source-layer'] ?? ''))) last = i;
  });
  return layers[last + 1]?.id;
}

/** Zoom over which the tiles fade in above their minimum zoom (the basemap's recoloured ground shows below). */
export const OVERVIEW_TILES_FADE_ZOOM = 0.5;

/** The MapLibre raster source and layer for a fitting tileset (`root`: the extract root URL, trailing slash). */
export function overviewTilesStyle(manifest: OverviewTilesManifest, root: string): { source: Record<string, unknown>; layer: Record<string, unknown> } {
  return {
    source: {
      type: 'raster', tiles: [`${root}${OVERVIEW_TILES_DIR}/{z}/{x}/{y}.png`], tileSize: 256,
      minzoom: manifest.minzoom, maxzoom: manifest.maxzoom, bounds: manifest.bounds, attribution: manifest.attribution,
    },
    layer: {
      id: OVERVIEW_TILES_LAYER, type: 'raster', source: OVERVIEW_TILES_SOURCE, minzoom: manifest.minzoom,
      paint: {
        'raster-opacity': ['interpolate', ['linear'], ['zoom'], manifest.minzoom, 0, manifest.minzoom + OVERVIEW_TILES_FADE_ZOOM, 1],
        'raster-fade-duration': 0,
      },
    },
  };
}

/**
 * The adapter's whole decision (vector-map.js `_ensureOverviewTiles`): the source, layer and insertion point for a
 * manifest, or why the tiles are not drawn (no manifest, a different ground look, a palette not yet re-baked).
 */
export function overviewTilesPlan(manifest: OverviewTilesManifest | null | undefined, root: string, layers: readonly LayerLike[], look: GroundLook = GROUND_LOOK_DEFAULT):
  { source: Record<string, unknown>; layer: Record<string, unknown>; beforeId: string | undefined } | { skip: string } {
  if (!manifest || manifest.version !== 1) return { skip: 'no overview tiles manifest' };
  const bad = tilesetMismatch(manifest, look);
  if (bad.length) return { skip: `overview tiles baked for another palette (${manifest.look}; differs in ${bad.join(', ')})` };
  const { source, layer } = overviewTilesStyle(manifest, root.endsWith('/') ? root : `${root}/`);
  return { source, layer, beforeId: overviewTilesBeforeId(layers) };
}
