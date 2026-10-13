/**
 * Street-survey catalogue (street-surveys.html): the repetitive canal-house /
 * block-face work (taxonomy: src/canalRecall/buildingCategory.ts), grouped
 * street → block face → houses. Written by scripts/street-surveys/build.ts
 * into public/canal-drive/street-surveys-data/surveys.json.
 */

/** installed = drawn in game from chunks.json; held = compiled but kept out (reason given); staged = intake only. */
export type FaceStatus = 'installed' | 'held' | 'staged';

/** How a pand is drawn in the game today. */
export type LiveRepresentation =
  | 'face'        // an installed block-face chunk (chunk-face-*)
  | 'chunk'       // a post-hoc chunk of per-house recipes (chunk-bilder-*-x2)
  | 'standalone'  // its own per-house recipe model
  | 'generic';    // no survey model: the streamed city mesh (incl. the large-building tier)

export interface Thumb { src: string; width: number; height: number; caption: string }

export interface SurveyHouse {
  pandId: string;
  address: string;
  /** Ground-floor business/use as recorded in the face intent (photo/BAG/OSM). */
  shop?: { use: string; name?: string; agreement?: string };
  /** `rhythm.schemaLimits` from the intent: what the schema could not express. */
  limits: string[];
  /** Inferred rear (no photo): windows per storey on the rear edges. */
  rear?: string;
  /** Concrete render-vs-photo defects found in review (scripts/street-surveys/reviews/*.json). */
  defects?: string[];
}

export interface SurveyFace {
  id: string;
  street: string;
  title: string;
  status: FaceStatus;
  statusReason: string;
  chunkId?: string;
  triangles?: number;
  photoDate?: string;
  photo?: Thumb;
  model?: Thumb;
  houses: SurveyHouse[];
  /** Face-level review notes (LOOKED at photo vs model). */
  review?: string[];
}

/** A per-house recipe model (scripts/building-recipes/houses/*) and what became of it. */
export interface SurveyRecipeHouse {
  id: string;
  pandId: string;
  address: string;
  name: string;
  /** standalone/chunk = still drawn as this model; superseded = a face draws the pand now. */
  status: 'standalone' | 'chunk' | 'superseded';
  /** The face or chunk that draws it instead (superseded) or contains it (chunk). */
  drawnBy?: string;
  updatedAt?: string;
  reviewState?: string;
  photo?: Thumb;
  model?: Thumb;
  defects?: string[];
}

export interface StreetPandRow {
  pandId: string;
  label: string;
  buildYear: number | null;
  live: LiveRepresentation;
  /** Model id that draws it (face/chunk/recipe), when any. */
  drawnBy?: string;
  /** A face covering the pand that is held/staged, if any. */
  pendingFace?: string;
  note?: string;
  defects?: string[];
}

export interface StreetSurvey {
  street: string;
  faces: SurveyFace[];
  recipeHouses: SurveyRecipeHouse[];
  /** Every pand with a current address on the street (BAG), when fetched. */
  pandTable?: { source: string; fetchedAt: string; rows: StreetPandRow[] };
}

export interface StreetSurveyData {
  version: 1;
  generatedAt: string;
  streets: StreetSurvey[];
}

export const STATUS_LABEL: Readonly<Record<FaceStatus, string>> = { installed: 'Installed', held: 'Held', staged: 'Staged' };
export const LIVE_LABEL: Readonly<Record<LiveRepresentation, string>> = {
  face: 'Block face', chunk: 'Recipe chunk', standalone: 'Standalone recipe', generic: 'Generic city mesh',
};
