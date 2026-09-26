// Shapes of the versioned Amsterdam extracts as they are actually shipped in
// `public/data/extracts/amsterdam/`. These describe the file on disk, not what
// the game would like it to contain: every field the runtime reads defensively
// is optional here, so the compiler forces the same defensiveness in code.

/** Extract coordinates are `[lat, lng]`. Display geometry is `[lng, lat]`. */
export type LatLng = readonly [number, number];
export type LngLat = readonly [number, number];

export interface LandmarkFeature {
  id: string;
  name: string;
  type?: string;
  center?: LatLng;
  path?: LatLng[];
  paths?: LatLng[][];
  funFact?: string;
  prominenceScore?: number;
  wikidata?: string;
  wikipedia?: string;
  wikipediaUrl?: string;
  wikipediaExtract?: string;
  wikipediaExtractLang?: string;
  wikipediaImageUrl?: string;
}

export interface BoundaryFeature {
  id: string;
  name: string;
  kind: string;
  /** Polygons, each an array of rings, each ring an array of `[lat, lng]`. */
  geometry?: LatLng[][][];
}

export interface NeighborhoodEnrichment {
  name: string;
  wikipediaExtract?: string;
  imageUrl?: string;
  imageAttribution?: string;
}

export interface BridgeFeature {
  id: string;
  name?: string;
  center?: LatLng;
  path?: LatLng[];
  paths?: LatLng[][];
  distractors?: string[];
  carriesRailway?: boolean;
  carriesRoad?: boolean;
  wikipediaUrl?: string;
  wikipediaExtract?: string;
}

/** One physical span-crossing of a named bridge, precomputed by
 *  `scripts/build-bridge-crossings.ts`. */
export interface PublishedCrossing {
  index: number;
  center: LatLng;
  waterway: string | null;
  waterwayType: string | null;
  waterDistractors: string[];
  spans: number;
}

export interface BridgeCrossingIndex {
  bridges?: Record<string, PublishedCrossing[] | undefined>;
}

export interface StreetKnowledgeEntry {
  id?: string;
  name: string;
  type?: string;
  /** From `streets.json` / `water.json` so we can resolve the English article. */
  wikidata?: string;
  wikipedia?: string;
  wikipediaUrl?: string;
  wikipediaExtract?: string;
  wikipediaExtractLang?: string;
  /** Commons / Wikipedia page image when the enricher found one. Street and
   *  water cards use the same notice slot as landmarks, so this must travel. */
  wikipediaImageUrl?: string;
  /** Curated street geometry — used for transit corridor street quizzes. */
  path?: LatLng[];
  paths?: LatLng[][];
  distractors?: string[];
}
