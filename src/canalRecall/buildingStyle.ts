import {
  compositionDrawIds,
  isHandMappedComposition,
  selectRenderableBuildings,
} from './buildingComposition.js';
import { FootprintGrid } from './buildingLadder.js';
import { ringCentroid, type Ring } from './buildingGeometry.js';

export type CanalTheme = 'clean' | '8bit' | '16bit' | 'psx' | 'cyberpunk';

type MapLibreExpression = unknown[];

const THEME_DEFAULTS: Record<CanalTheme, string> = {
  clean: '#D8D3CA', '8bit': '#B8C68E', '16bit': '#A99BC8', psx: '#9B958E', cyberpunk: '#25114D',
};

const THEME_FALLBACK_RAMPS: Record<Exclude<CanalTheme, 'cyberpunk'>, readonly [string, string, string, string]> = {
  clean: ['#DED9D0', '#D2C9BC', '#C2B5A5', '#AAA095'],
  '8bit': ['#C8BE78', '#B8A060', '#A68A50', '#8E7444'],
  '16bit': ['#B9A8C5', '#A98A9E', '#97798E', '#806A80'],
  psx: ['#9B9588', '#888174', '#777169', '#666159'],
};

const MATERIAL_COLORS: Record<string, string> = {
  cement_block: '#6a7880', brick: '#bd8161', plaster: '#dadbdb', wood: '#d48741',
  concrete: '#d3c2b0', metal: '#b7b1a6', steel: '#b7b1a6', stone: '#b4a995',
  mud: '#9d8b75', glass: '#5a81a0', masonry: '#bd8161', traditional: '#bd8161',
};

export function buildingColorExpression(theme: CanalTheme | string): MapLibreExpression | string {
  const selectedTheme = theme in THEME_DEFAULTS ? theme as CanalTheme : 'clean';
  if (selectedTheme === 'cyberpunk') return THEME_DEFAULTS.cyberpunk;

  const ramp = THEME_FALLBACK_RAMPS[selectedTheme];
  const heightFallback: unknown[] = [
    'interpolate', ['linear'], ['coalesce', ['get', 'render_height'], ['get', 'height'], 8],
    0, ramp[0], 8, ramp[1], 20, ramp[2], 60, ramp[3],
  ];
  const materialMatch: unknown[] = ['match', ['downcase', ['coalesce', ['get', 'material'], '']]];
  for (const [material, color] of Object.entries(MATERIAL_COLORS)) materialMatch.push(material, color);
  materialMatch.push(heightFallback);
  // OSM `colour` is free text: plenty of buildings carry values like "brick"
  // or "light sandstone" that are not CSS colors. Feeding those straight to
  // fill-extrusion-color makes MapLibre reject the whole expression with
  // "Expected color but found null", which drops every building back to the
  // style default. `to-color` with a fallback keeps the good values and
  // quietly ignores the rest.
  return [
    'case',
    ['has', 'colour'], ['to-color', ['get', 'colour'], THEME_DEFAULTS[selectedTheme]],
    ['has', 'color'], ['to-color', ['get', 'color'], THEME_DEFAULTS[selectedTheme]],
    materialMatch,
  ];
}

export function buildingOpacity(theme: CanalTheme | string): number {
  // Fully opaque. Translucent fill-extrusions are not depth-sorted against
  // each other, so overlapping footprints tore into visible streaks where
  // one building showed through another.
  return theme === 'cyberpunk' ? 0.98 : 1;
}

// OpenFreeMap's planet tiles are built with planetiler, which drops the OSM id
// from the building layer's properties and folds it into the vector-tile
// feature id instead, as `osmId * 10 + type`. Measured against
// `buildings-colored.geojson` across central Amsterdam, ways recovered with
// type 2 sit a median 1.5 m from the extract building they name, and the three
// relations recovered with type 3 within 2.8 m.
//
// Type 0 is a different id space that happens to overlap the way numbering:
// 90 of its ids decode to a real extract way, but a median 27 m away and up to
// 1.3 km, so matching it would erase ~90 buildings the extract never had. Only
// 2 and 3 are safe to match.
const BASEMAP_ID_TYPES: Record<string, number> = { w: 2, r: 3 };

export function encodeBasemapBuildingId(osmId: string): number | null {
  const type = BASEMAP_ID_TYPES[osmId.slice(0, 1)];
  if (type === undefined) return null;
  const id = Number(osmId.slice(1));
  if (!Number.isSafeInteger(id) || id <= 0) return null;
  const encoded = id * 10 + type;
  return Number.isSafeInteger(encoded) ? encoded : null;
}

/**
 * A filter for the basemap's `building-3d` layer that drops every building the
 * Canal Recall extract draws itself.
 *
 * Both layers extrude the same OSM buildings from different pipelines, so where
 * they overlap the two sets of walls are exactly coplanar. No height offset can
 * separate a vertical face from itself, so the depth test picks a different
 * winner per pixel and facades break into stripes. The two pipelines also
 * disagree on height — 7 m against 14 m, 10 m against 19 m on the Singel —
 * which pushes the basemap's grey box out through the coloured one.
 *
 * `hide_3d` is OpenMapTiles' own marker for a building that a `building:part`
 * already covers, which is the same fight one layer down.
 *
 * `extraEncodedIds` covers the residual pairs the two pipelines hold under
 * different OSM ids: the runtime measures proximity against the extract and
 * feeds the basemap feature ids straight in (already `osmId * 10 + type`).
 */
export function basemapBuildingFilter(
  osmIds: Iterable<string>,
  existingFilter?: unknown,
  extraEncodedIds?: Iterable<number>,
): MapLibreExpression {
  const encoded: number[] = [];
  const seen = new Set<number>();
  for (const osmId of osmIds) {
    const id = typeof osmId === 'string' ? encodeBasemapBuildingId(osmId) : null;
    if (id !== null && !seen.has(id)) { seen.add(id); encoded.push(id); }
  }
  if (extraEncodedIds) {
    for (const id of extraEncodedIds) {
      if (typeof id === 'number' && Number.isSafeInteger(id) && id > 0 && !seen.has(id)) {
        seen.add(id);
        encoded.push(id);
      }
    }
  }
  const clauses: unknown[] = [['!', ['to-boolean', ['get', 'hide_3d']]]];
  // `match` builds a lookup keyed on the label; `in` over ten thousand ids
  // would rescan the whole list for every building in every tile.
  if (encoded.length) clauses.push(['!', ['match', ['id'], encoded, true, false]]);
  if (existingFilter) clauses.unshift(existingFilter);
  return ['all', ...clauses];
}

export {
  compositionDrawIds,
  isHandMappedComposition,
  selectRenderableBuildings,
  FootprintGrid,
};
export type { Ring };

type AppearanceFeature = {
  type: string;
  properties?: Record<string, unknown>;
  geometry?: { type: string; coordinates: unknown };
};

/**
 * Drop parent outlines from coloured-extract compositions before they reach
 * MapLibre. Without this, Oude Kerk and Waag draw their shell and their parts
 * in the same air and z-fight.
 */
export function dedupeAppearanceFeatures(features: AppearanceFeature[]): AppearanceFeature[] {
  type Item = {
    osmId: string;
    rings: Ring[];
    minHeightM: number;
    heightM: number;
    isPart?: boolean;
    feature: AppearanceFeature;
  };

  const items: Item[] = [];
  for (const feature of features) {
    const props = feature.properties || {};
    const osmId = String(props.osmId || '');
    if (!osmId || !feature.geometry) continue;
    const geometry = feature.geometry;
    const rings: Ring[] = geometry.type === 'Polygon'
      ? [(geometry.coordinates as Ring[])[0]]
      : geometry.type === 'MultiPolygon'
        ? (geometry.coordinates as Ring[][]).map(polygon => polygon[0])
        : [];
    if (!rings.length || !rings[0]?.length) continue;
    if (!Number.isFinite(ringCentroid(rings[0])[0])) continue;
    items.push({
      osmId,
      rings,
      minHeightM: Number(props.minHeight ?? 0),
      heightM: Number(props.height ?? 0),
      isPart: Boolean(props.isPart),
      feature,
    });
  }

  const grid = new FootprintGrid<Item>();
  for (const item of items) grid.add(item);
  return selectRenderableBuildings(items, item => grid.near(item.rings)).map(item => item.feature);
}

/**
 * Wall top for a fill-extrusion: below a procedural roof when OSM tagged one.
 *
 * Pyramidal parts carry `height` at the apex and `roofHeight` for the cone.
 * Walls must stop at the eaves or the flat cap fights the mesh roof.
 */
export function wallTopHeightExpression(): MapLibreExpression {
  return [
    'case',
    ['all',
      ['==', ['get', 'roofShape'], 'pyramidal'],
      ['>', ['coalesce', ['get', 'roofHeight'], 0], 0],
    ],
    ['-', ['coalesce', ['get', 'height'], 5], ['get', 'roofHeight']],
    ['coalesce', ['get', 'height'], 5],
  ];
}

/** Flat roof caps skip features that get a procedural pyramidal mesh. */
export function flatRoofFilter(): MapLibreExpression {
  return [
    'all',
    ['has', 'roofColour'],
    ['!',
      ['all',
        ['==', ['get', 'roofShape'], 'pyramidal'],
        ['>', ['coalesce', ['get', 'roofHeight'], 0], 0],
      ],
    ],
  ];
}
