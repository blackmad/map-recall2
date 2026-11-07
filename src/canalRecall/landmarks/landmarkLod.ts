// Level of detail for the curated landmark GLBs. Each model with a `lod1`
// sibling (`<id>.lod1.glb`, ~15% of the triangles, see
// scripts/landmarks/build-landmark-lods.ts) is drawn from it while it is small
// on screen and swapped for the full model when it gets large.
//
// `lod2` (lane R4-B #244, landmarks from the air): `<id>.lod2.glb`, every
// primitive merged into ONE with the material colour baked into COLOR_0, ~2 %
// of the triangles under a 0.5 m error bound. One draw per model instead of ~8,
// and one geometry the landmark batch (landmarks/landmarkBatch.ts) can hold, so
// every lod2 model on screen draws in one call. Chosen when the model is tiny on
// screen, or from the air (rendererShared/aerialView.ts) beyond LOD2_AERIAL_M of
// the view centre. `?landmarkLod2=0` restores the lod1/full choice.

export type LandmarkLevel = 'lod2' | 'lod1' | 'full';

/** Bump to force every lod1 to rebuild after the build parameters change. */
export const LOD1_BUILD_VERSION = 2;
export const LOD1_TRIANGLE_RATIO = 0.15;
/** Relative to the mesh extent (meshoptimizer's error scale). */
export const LOD1_MAX_ERROR = 0.01;
/** Textures are shrunk to this (never enlarged); lod1 is only seen small. */
export const LOD1_MAX_TEXTURE_SIZE = 256;
/**
 * Per-model lod1 error caps (meshoptimizer's scale, relative to the mesh extent) where the default is too coarse. On
 * Centraal's 430 m site 0.01 lets vertices move 4.3 m: the 1.4 m brick bands between the east wing's window rows collapsed
 * onto the window edges and the 119 m wall went see-through (integrator review 2026-10-16). 0.001 (0.43 m) keeps every band
 * and pier: 42,807 -> 14,278 triangles, 185 kB. (A locked border also kept it solid but stopped at 31k triangles.)
 */
export const LOD1_MAX_ERROR_BY_ID: Readonly<Record<string, number>> = {'centraal-station': 0.001};

/** meshoptimizer settings for one model's lod1. */
export function lod1SimplifyOptions(id: string): {ratio: number; error: number} {
  return {ratio: LOD1_TRIANGLE_RATIO, error: LOD1_MAX_ERROR_BY_ID[id] ?? LOD1_MAX_ERROR};
}

/** Models at or under this many triangles are not worth a second level. */
export const LOD1_MIN_SOURCE_TRIANGLES = 3000;

/** Footprint radius in pixels above which the full model replaces lod1.
 *  Was 45 px: in the chase view a 15 m-radius landmark is ~30 px, so every
 *  modelled house along the route showed its lod1 (user 2026-10-13 "LOD
 *  cutoff is too low, at this zoom they should be full rez"). 30 px keeps
 *  the chase view full and leaves lod1 to the aerial views (a 40 m landmark
 *  is 14 px at zoom 15). */
export const LOD_UPGRADE_RADIUS_PX = 30;
/** ...and below which a full model may drop back to lod1 (hysteresis gap). */
export const LOD_DOWNGRADE_RADIUS_PX = 20;

export interface LandmarkLodRecord {
  /** Fingerprint of the source GLB this lod1 was built from. */
  sourceHash: string;
  buildVersion: number;
  bytes: number;
  triangles: number;
}

/**
 * One row of modelLods.json: the lod1 record's fields when the model has a lod1 (models under
 * LOD1_MIN_SOURCE_TRIANGLES have none), and `lod2` when it has a lod2.
 */
export type LandmarkLodEntry = Partial<LandmarkLodRecord> & { lod2?: LandmarkLodRecord };

/** Bump to force every lod2 to rebuild after the lod2 build parameters change. */
export const LOD2_BUILD_VERSION = 1;
/** Target share of the source triangles; the error bound below stops the simplifier first on detailed models. */
export const LOD2_TRIANGLE_RATIO = 0.02;
/**
 * Largest vertex move the lod2 simplifier may make, metres (converted to meshoptimizer's extent-relative scale).
 * Swept 0.5 / 1 / 2 m at 2 % (lane R4-B): 14.5 / 7.9 / 5.9 MB for the 459 models. lod2 is drawn beyond 500 m from the
 * view centre from the air, or under 12 px: 1 m is ~2 px there.
 */
export const LOD2_MAX_ERROR_M = 1.25;
/**
 * Triangle cap: a model the error bound leaves above this is simplified again to it, with the bound relaxed to
 * LOD2_CAP_ERROR_M (the large curved and terraced blocks: American Hotel 11.8k, Valley 13.1k at 1 m). Keeps the set
 * under the 6 MB budget. Models with an error override are exempt.
 */
export const LOD2_MAX_TRIANGLES = 2000;
export const LOD2_CAP_ERROR_M = 3;
/**
 * Per-model lod2 error caps, metres, where the default eats a silhouette the user steers by: thin spires and
 * lanterns, and Centraal's storey bands (see LOD1_MAX_ERROR_BY_ID).
 */
export const LOD2_MAX_ERROR_M_BY_ID: Readonly<Record<string, number>> = {
  'centraal-station': 0.5, westerkerk: 0.5, rijksmuseum: 0.5,
};
/** Blended (glass) primitives at or above this opacity are baked opaque into lod2; fainter ones are left out. */
export const LOD2_MIN_ALPHA = 0.5;

/** meshoptimizer settings for one model's lod2, its extent (largest bounding-box side, metres) given. */
export function lod2SimplifyOptions(id: string, extentM: number, ratio = LOD2_TRIANGLE_RATIO, errorM = LOD2_MAX_ERROR_M_BY_ID[id] ?? LOD2_MAX_ERROR_M): {ratio: number; error: number} {
  return {ratio, error: extentM > 0 ? Math.min(1, errorM / extentM) : 0.01};
}

/** `./models/x.glb` -> `./models/x.lod2.glb`. */
export function lod2Url(modelUrl: string): string {
  return modelUrl.replace(/\.glb(\?|$)/, '.lod2.glb$1');
}

/** Whether a stored lod2 is still the output of this source and the current lod2 parameters. */
export function lod2IsCurrent(record: LandmarkLodRecord | undefined, sourceHash: string | undefined): boolean {
  return !!record && !!sourceHash && record.sourceHash === sourceHash && record.buildVersion === LOD2_BUILD_VERSION;
}

/**
 * Below this footprint radius (px) a model drops to lod2; it leaves lod2 above LOD2_UPGRADE_RADIUS_PX (hysteresis, as
 * the lod1/full pair). `?landmarkLod2Px=` sweeps it.
 */
export const LOD2_DOWNGRADE_RADIUS_PX = 12;
export const LOD2_HYSTERESIS = 1.5;
/** From the air, models further than this from the view centre draw at lod2 (`?landmarkLod2M=` sweeps it). */
export const LOD2_AERIAL_M = 500;
/** ...and come back once nearer than this share of it. */
export const LOD2_AERIAL_RETURN = 0.8;

export interface LevelInputs {
  /** Footprint radius on screen at the view centre's scale. */
  radiusPixels: number;
  hasLod1: boolean;
  hasLod2: boolean;
  /** Metres from the view centre while the view is aerial (isAerialView), else null. */
  aerialDistanceM: number | null;
  /** A model the card lights stays off lod2 (it leaves the batch for its own level). */
  highlighted?: boolean;
  lod2DowngradePx?: number;
  lod2AerialM?: number;
}

function wantsLod2(current: LandmarkLevel | null, i: LevelInputs): boolean {
  if (!i.hasLod2 || i.highlighted) return false;
  const down = i.lod2DowngradePx ?? LOD2_DOWNGRADE_RADIUS_PX, far = i.lod2AerialM ?? LOD2_AERIAL_M;
  const at = current === 'lod2';
  if (i.aerialDistanceM != null && i.aerialDistanceM > (at ? far * LOD2_AERIAL_RETURN : far)) return true;
  return at ? i.radiusPixels <= down * LOD2_HYSTERESIS : i.radiusPixels < down;
}

/**
 * The level with lod2 in play. Without a lod2 (or with lod2 not wanted) it is exactly `chooseLevel` (from lod2, the
 * no-history `initialLevel`), so street views are untouched: the aerial rule needs `aerialDistanceM`, which the
 * runtime passes only while isAerialView holds.
 */
export function chooseLandmarkLevel(current: LandmarkLevel, i: LevelInputs): LandmarkLevel {
  if (wantsLod2(current, i)) return 'lod2';
  if (!i.hasLod1) return 'full';
  return current === 'lod2' ? initialLevel(i.radiusPixels) : chooseLevel(current, i.radiusPixels);
}

/** The level to load first with lod2 in play (no history). */
export function initialLandmarkLevel(i: LevelInputs): LandmarkLevel {
  if (wantsLod2(null, i)) return 'lod2';
  return i.hasLod1 ? initialLevel(i.radiusPixels) : 'full';
}

/** `./models/x.glb` -> `./models/x.lod1.glb`. */
export function lod1Url(modelUrl: string): string {
  return modelUrl.replace(/\.glb(\?|$)/, '.lod1.glb$1');
}

/** Whether the stored lod1 is still the output of this source and these parameters. */
export function lod1IsCurrent(record: LandmarkLodRecord | undefined, sourceHash: string | undefined): boolean {
  return !!record && !!sourceHash && record.sourceHash === sourceHash && record.buildVersion === LOD1_BUILD_VERSION;
}

/** Ground metres per CSS pixel at a MapLibre zoom (512 px tiles) and latitude. */
export function metresPerPixel(zoom: number, latitudeDegrees: number): number {
  return (40075016.686 * Math.cos(latitudeDegrees * Math.PI / 180)) / (512 * 2 ** zoom);
}

export function footprintRadiusPixels(radiusMetres: number, zoom: number, latitudeDegrees: number): number {
  return radiusMetres / metresPerPixel(zoom, latitudeDegrees);
}

/**
 * The level a model should be drawn at. Between the two thresholds the current
 * level is kept, so a camera hovering near the boundary does not flicker.
 */
export function chooseLevel(current: LandmarkLevel, radiusPixels: number): LandmarkLevel {
  if (current === 'lod1') return radiusPixels > LOD_UPGRADE_RADIUS_PX ? 'full' : 'lod1';
  return radiusPixels < LOD_DOWNGRADE_RADIUS_PX ? 'lod1' : 'full';
}

/** The level to start loading at, with no history. */
export function initialLevel(radiusPixels: number): LandmarkLevel {
  return radiusPixels > LOD_UPGRADE_RADIUS_PX ? 'full' : 'lod1';
}
