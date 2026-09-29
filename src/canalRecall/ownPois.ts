// The game's own POI layer at runtime: decode the published extract, screen
// out spoilers, thin to a deliberate spread, and hand MapLibre one feature
// collection whose `band` says which roofline layer draws it.

import { HEIGHT_BAND_METRES, POI_CATEGORY_COLOURS, type HeightBand, type PoiCategory } from './poiCatalog';
import { thinOrientationPois } from './orientationPois';

export interface OrientationPoiFile {
  version: number;
  categories: PoiCategory[];
  bands: HeightBand[];
  /** [name, lng, lat, category index, rank, band index] */
  pois: Array<[string, number, number, number, number, number]>;
}

/** About one label per block side at street zoom; MapLibre's collision drops
 *  the rest, but thinning first makes the survivors the best on their block
 *  rather than whichever drew first. */
export const OWN_POI_CELL_METRES = 70;

export interface OwnPoiFeature {
  type: 'Feature';
  properties: { name: string; category: PoiCategory; colour: string; rank: number; band: HeightBand };
  geometry: { type: 'Point'; coordinates: [number, number] };
}

export function ownPoiFeatures(
  file: OrientationPoiFile | null | undefined,
  spoils: (name: string) => boolean,
): { type: 'FeatureCollection'; features: OwnPoiFeature[] } {
  if (!file || !Array.isArray(file.pois)) return { type: 'FeatureCollection', features: [] };
  const candidates = file.pois
    .filter(row => row[0] && !spoils(row[0]))
    .map((row, index) => ({
      id: String(index).padStart(6, '0'),
      name: row[0],
      kind: 'own',
      center: [row[2], row[1]] as [number, number],
      orientationScore: row[4],
      category: file.categories[row[3]],
      band: file.bands[row[5]] ?? 'ground',
    }));
  const thinned = thinOrientationPois(candidates, { kinds: ['own'], cellMetres: OWN_POI_CELL_METRES });
  return {
    type: 'FeatureCollection',
    features: thinned.filter(poi => poi.category).map(poi => ({
      type: 'Feature' as const,
      properties: {
        name: poi.name, category: poi.category, colour: POI_CATEGORY_COLOURS[poi.category] ?? '#5b6b7a',
        rank: poi.orientationScore ?? 0, band: poi.band,
      },
      geometry: { type: 'Point' as const, coordinates: [poi.center[1], poi.center[0]] as [number, number] },
    })),
  };
}

/** The layer ids of one band: its dots and its labels. */
export const OWN_POI_BANDS: readonly HeightBand[] = ['ground', 'low', 'mid', 'high'];
export const ownPoiLayerIds = (band: HeightBand) => ({ dots: `own-poi-dots-${band}`, labels: `own-poi-labels-${band}` });
export { HEIGHT_BAND_METRES };
