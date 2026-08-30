// Runtime shapes the game works in, as distinct from the extract shapes it
// loads. The split matters because world coordinates are game pixels projected
// around one route's centre: the same landmark has different x/y on the next
// route, so nothing here may be cached across routes.

import type { LngLat } from './extracts';

export interface WorldPoint {
  x: number;
  y: number;
}

/** A GeoJSON FeatureCollection, kept loose because it is only ever handed
 *  straight back to MapLibre for display. */
export interface GeoJsonFeatureCollection {
  type: 'FeatureCollection';
  features: GeoJsonFeature[];
}

export interface GeoJsonFeature {
  type: 'Feature';
  properties: Record<string, unknown>;
  geometry:
    | { type: 'Point'; coordinates: number[] }
    | { type: 'LineString'; coordinates: number[][] }
    | { type: 'Polygon'; coordinates: number[][][] }
    | { type: 'MultiPolygon'; coordinates: number[][][][] };
}

/** The handle MapLibre needs to set feature state on one drawn extrusion. */
export interface FeatureTarget {
  source: string;
  sourceLayer?: string;
  id: string | number;
}

/** Everything the landmark card can draw. Both curated landmarks and the
 *  stand-in cards for a clicked-but-unnamed building satisfy this, which is
 *  why the notice slot is typed on it rather than on `Landmark`. */
export interface LandmarkNotice {
  id: string;
  name: string;
  type?: string;
  detail?: string;
  longDetail?: string;
  imageUrl?: string;
  wikipediaUrl?: string;
  wikidata?: string;
  wikipedia?: string;
  extractLang?: string;
  lngLat?: LngLat;
  geojson?: GeoJsonFeatureCollection;
  featureTarget?: FeatureTarget | null;
}

/** A landmark placed in the current route's world. */
export interface Landmark extends LandmarkNotice {
  type: string;
  x: number;
  y: number;
  lngLat: LngLat;
  detail: string;
  longDetail: string;
  imageUrl: string;
  prominenceScore: number;
  wikipediaUrl: string;
  wikidata: string;
  wikipedia: string;
  extractLang: string;
  geojson: GeoJsonFeatureCollection;
}

export interface Neighborhood {
  name: string;
  kind: string;
  rank: number;
  rings: WorldPoint[][];
  wikipediaExtract: string;
  imageUrl: string;
  imageAttribution: string;
  /** Set when the postcard borrows a containing district's photograph, so the
   *  card can say which area the picture actually shows. */
  imageArea?: string;
}

/** A bridge crossing placed in the world: the published crossing record plus
 *  its centre in game pixels. */
export interface BridgeCrossing extends WorldPoint {
  index: number;
  center: readonly [number, number];
  waterway: string | null;
  waterwayType: string | null;
  waterDistractors: string[];
  spans: number;
}

export interface Bridge {
  id: string;
  name: string;
  lines: WorldPoint[][];
  crossings: BridgeCrossing[];
  distractors: string[];
  wikipediaUrl: string;
  detail: string;
}

/** What `vectorMap.inspectBuilding` reports for the footprint under a click. */
export interface BuildingHit {
  id?: string | number;
  name?: string;
  lngLat: LngLat;
  geojson?: GeoJsonFeatureCollection;
  featureTarget: FeatureTarget | null;
}
