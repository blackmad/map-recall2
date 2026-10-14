// The flat basemap in the own ground's colours (pure).
//
// Beyond the resident cells the basemap's fills show as the ground. Liberty's
// white streets, light-blue water and pale land ended in a hard edge against
// the dark relief streets and teal canals of the own ground (user shot from
// ~300 m above Nieuw-West, 2026-10-13). While the own ground is on, the
// basemap ground layers take its palette (look/palette.ts STREET_GROUND and
// GROUND_TONES), so the edge disappears in colour. Buildings, labels, POIs,
// boundaries and the game's own overlays are left alone.

import { groundLookFrom, groundPalette, type GroundPalette } from './groundLook.js';

export interface StyleLayerLike { id: string; type: string; 'source-layer'?: string }
export interface PaintPatch { id: string; property: string; value: string }

type RGB = readonly [number, number, number];
const css = (c: RGB) => `rgb(${c[0]},${c[1]},${c[2]})`;

/** The own-ground colour for a basemap layer, or null to leave it (in the page's `?groundLook` palette by default). */
export function basemapGroundColour(layer: StyleLayerLike, palette: GroundPalette = groundPalette(groundLookFrom())): string | null {
  const id = layer.id, src = layer['source-layer'] ?? '', { street: STREET_GROUND, tones: G } = palette;
  if (layer.type === 'background') return css(G.land.base);
  if (layer.type !== 'fill' && layer.type !== 'line') return null;
  if (src === 'water' || src === 'waterway' || /^water(way)?(_|$)/.test(id)) return G.water;
  if (src === 'park' || /^park/.test(id) || id === 'landcover_grass' || id === 'landuse_pitch' || id === 'landuse_track' || id === 'landuse_cemetery') return css(G.park);
  if (id === 'landcover_wood') return css(G.wood);
  if (id === 'landcover_sand') return css(G.gravel);
  if (id === 'landuse_residential' || id === 'landuse_school' || id === 'landuse_hospital' || id === 'aeroway_fill') return css(G.land.base);
  if (src === 'transportation' || /^(road|bridge|tunnel)_/.test(id)) {
    if (/rail/.test(id)) return STREET_GROUND.rail;
    if (/path_pedestrian/.test(id)) return css(STREET_GROUND.pavement.base);
    if (layer.type === 'fill') return css(STREET_GROUND.pavement.base);
    return css(STREET_GROUND.asphalt.base);
  }
  return null;
}

/** Paint patches (property, value) for every basemap ground layer of a style. */
export function basemapGroundPatches(layers: readonly StyleLayerLike[], palette: GroundPalette = groundPalette(groundLookFrom())): PaintPatch[] {
  const out: PaintPatch[] = [];
  for (const layer of layers) {
    const colour = basemapGroundColour(layer, palette);
    if (!colour) continue;
    const property = layer.type === 'background' ? 'background-color' : layer.type === 'fill' ? 'fill-color' : 'line-color';
    out.push({ id: layer.id, property, value: colour });
    if (layer.type === 'fill') out.push({ id: layer.id, property: 'fill-outline-color', value: colour });
    // Casings carry the street's edge: same asphalt, so a street reads as one dark band, not an outlined white one.
  }
  return out;
}
