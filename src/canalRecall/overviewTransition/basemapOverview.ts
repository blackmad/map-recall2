// The flat overview in the city's tokens (pure): what the basemap needs beyond the own-ground palette
// (ownGround/basemapPalette.ts) so that zooming from the overview into the shaded city is continuous.
//
// Measured on the plan-view sweep over the Westerstraat (scripts/look/transition-zoom.ts, 2026-10-16):
// - The map's `park` layer carries protected areas, and Amsterdam's canal belt is one (UNESCO): painted in the
//   park green it turned the whole Grachtengordel green in the overview, and that green showed through the
//   dissolving own ground. Protected / nature areas take the land tone; real parks keep the park green.
// - The map's flat `building` footprints end at zoom 14 (ΔL −28 in one 0.1-zoom step). They now carry the city's
//   roof tone (CITY_ROOF: flat greys, slate and tile, as the 3D roofs read from above) and stay until the
//   three.js city is complete (BLEND_END_ZOOM), then fade out, so the 3D roofs dissolve in over their own colour.

import { CITY_ROOF, hexToRgb, type RGB } from '../look/palette.js';
import { GROUND_LOOK_DEFAULT, groundPalette, type GroundPalette } from '../ownGround/groundLook.js';
import type { StyleLayerLike } from '../ownGround/basemapPalette.js';
import { BLEND_END_ZOOM } from './blend.js';
import { groundTokens } from '../look/sunny.js';

export interface OverviewPatch { id: string; property: string; value: unknown }
export interface ZoomRangePatch { id: string; minzoom: number; maxzoom: number }

const mean = (hexes: readonly string[]): RGB => {
  const s = hexes.map(hexToRgb).reduce((a, c) => [a[0] + c[0], a[1] + c[1], a[2] + c[2]], [0, 0, 0] as [number, number, number]);
  return [s[0] / hexes.length, s[1] / hexes.length, s[2] / hexes.length];
};

/** Roof shares seen from above in the canal belt and the 19th-century ring: mostly flat, then slate, then tile. */
export const FOOTPRINT_ROOF_MIX = { flat: 0.6, slate: 0.25, tile: 0.15 } as const;

/** The flat footprint colour: the city's roof tokens mixed by FOOTPRINT_ROOF_MIX (sRGB, rounded). */
export function footprintTone(): RGB {
  const f = mean(CITY_ROOF.flat), s = mean(CITY_ROOF.slate), t = mean(CITY_ROOF.tile), m = FOOTPRINT_ROOF_MIX;
  return [0, 1, 2].map(i => Math.round(f[i] * m.flat + s[i] * m.slate + t[i] * m.tile)) as unknown as RGB;
}

const css = (c: RGB) => `rgb(${c[0]},${c[1]},${c[2]})`;
/** OpenMapTiles `park` classes that are not parks. */
export const NOT_PARK_CLASSES = ['protected_area', 'nature_reserve', 'national_park', 'aboriginal_lands'];
/** Footprints fade out over this zoom span after the city is complete. */
export const FOOTPRINT_FADE_ZOOM = 0.6;

/** Paint and zoom-range patches for the overview (transition on), on top of basemapGroundPatches. */
export function overviewBasemapPatches(layers: readonly StyleLayerLike[], palette: GroundPalette = groundPalette(GROUND_LOOK_DEFAULT)): { paint: OverviewPatch[]; zoomRanges: ZoomRangePatch[] } {
  const paint: OverviewPatch[] = [], zoomRanges: ZoomRangePatch[] = [];
  // The same tokens the basemap ground patches and the 3D ground read (look/sunny.ts).
  const { land, park } = groundTokens(palette);
  for (const layer of layers) {
    const src = layer['source-layer'] ?? '';
    if (src === 'park' && layer.type === 'fill') {
      const colour = ['match', ['get', 'class'], NOT_PARK_CLASSES, land, park];
      paint.push({ id: layer.id, property: 'fill-color', value: colour }, { id: layer.id, property: 'fill-outline-color', value: colour });
    } else if (src === 'park' && layer.type === 'line') {
      paint.push({ id: layer.id, property: 'line-opacity', value: 0 });
    } else if (src === 'building' && layer.type === 'fill') {
      const roof = css(footprintTone());
      paint.push({ id: layer.id, property: 'fill-color', value: roof }, { id: layer.id, property: 'fill-outline-color', value: roof },
        { id: layer.id, property: 'fill-opacity', value: ['interpolate', ['linear'], ['zoom'], BLEND_END_ZOOM, 1, BLEND_END_ZOOM + FOOTPRINT_FADE_ZOOM, 0] });
      zoomRanges.push({ id: layer.id, minzoom: 13, maxzoom: BLEND_END_ZOOM + FOOTPRINT_FADE_ZOOM });
    }
  }
  return { paint, zoomRanges };
}
