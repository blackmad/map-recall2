// Level of detail for the curated landmark GLBs. Each model with a `lod1`
// sibling (`<id>.lod1.glb`, ~15% of the triangles, see
// scripts/landmarks/build-landmark-lods.ts) is drawn from it while it is small
// on screen and swapped for the full model when it gets large.

export type LandmarkLevel = 'lod1' | 'full';

/** Bump to force every lod1 to rebuild after the build parameters change. */
export const LOD1_BUILD_VERSION = 2;
export const LOD1_TRIANGLE_RATIO = 0.15;
/** Relative to the mesh extent (meshoptimizer's error scale). */
export const LOD1_MAX_ERROR = 0.01;
/** Textures are shrunk to this (never enlarged); lod1 is only seen small. */
export const LOD1_MAX_TEXTURE_SIZE = 256;
/** Models at or under this many triangles are not worth a second level. */
export const LOD1_MIN_SOURCE_TRIANGLES = 3000;

/** Footprint radius in pixels above which the full model replaces lod1. */
export const LOD_UPGRADE_RADIUS_PX = 45;
/** ...and below which a full model may drop back to lod1 (hysteresis gap). */
export const LOD_DOWNGRADE_RADIUS_PX = 30;

export interface LandmarkLodRecord {
  /** Fingerprint of the source GLB this lod1 was built from. */
  sourceHash: string;
  buildVersion: number;
  bytes: number;
  triangles: number;
}

/** `./models/x.glb` -> `./models/x.lod1.glb`. */
export function lod1Url(modelUrl: string): string {
  return modelUrl.replace(/\.glb(\?|$)/, '.lod1.glb$1');
}

/** Whether the stored lod1 is still the output of this source and these parameters. */
export function lod1IsCurrent(record: LandmarkLodRecord | undefined, sourceHash: string): boolean {
  return !!record && record.sourceHash === sourceHash && record.buildVersion === LOD1_BUILD_VERSION;
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
