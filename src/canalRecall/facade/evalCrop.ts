/**
 * Shared crop helper for the façade model evaluation.
 *
 * `FACADE_MODEL_EVALUATION_PLAN.md` §5–§6 and task 3 define an A/B experiment:
 * score a detector on the cached strips (R0) and on strips re-rendered at the
 * panorama's native resolution (R1). Both model lanes must see byte-identical
 * pixels, so the two settings and the tile geometry live here rather than being
 * re-derived in each adapter.
 *
 * R0 is a file that already exists — the 45 px/m `full` strip written by
 * `scripts/da-costa-block/prepare-neighbourhood.ts`. R1 is recomputed from the
 * source panorama at `min(150, 0.9 × nativeCeiling)` px/m with a 4 MP cap, then
 * cut into overlapping tiles because RF-DETR and the window detector both resize
 * to 768 px: a larger crop is downscaled again unless it is tiled.
 *
 * Everything below is pure. Image decoding and file reads stay in the callers,
 * so the resolution formula, the frame, the tile grid and the tile↔wall-metre
 * mapping are all unit-testable without a panorama on disk.
 *
 * Measurement frame, matching {@link rectifyFacade}: `along` is metres from
 * `plane.start` towards `plane.end`; `up` is metres above `plane.baseZ`. Pixel
 * coordinates are continuous pixel *indices* in the same convention the
 * rectifier samples in, i.e. the centre of pixel `i` sits at `i` and the left
 * edge of the crop at `-0.5`.
 */
import {
  AMSTERDAM_WORLD_ALIGNED,
  rectifyFacade,
  type CameraModel,
  type CameraPose,
  type EquirectangularImage,
  type FacadePlane,
  type RectifiedFacade,
} from './rectify.ts';

/** The cached `full` strip's scale. */
export const FULL_TIER_PIXELS_PER_METRE = 45;
/** The cap `prepare-neighbourhood.ts` used when writing the cached strips. */
export const CACHED_FULL_MAX_PIXELS = 1_400_000;

/** R1's absolute scale cap. */
export const R1_MAX_PIXELS_PER_METRE = 150;
/** Fraction of the panorama's native ceiling R1 is allowed to use. */
export const R1_NATIVE_UTILISATION = 0.9;
/** R1's output allocation cap, in pixels. */
export const R1_MAX_PIXELS = 4_000_000;

/** Municipal panoramas are 8000×4000 equirectangular. */
export const EQUIRECTANGULAR_WIDTH_PX = 8000;
export const EQUIRECTANGULAR_HEIGHT_PX = 4000;
/** Pixels per radian at the equator: 8000 / 2π ≈ 1273, the plan's constant. */
export const EQUIRECTANGULAR_PIXELS_PER_RADIAN = EQUIRECTANGULAR_WIDTH_PX / (2 * Math.PI);

export const DEFAULT_TILE_SIZE_PX = 768;
export const DEFAULT_TILE_OVERLAP = 0.15;

const DEGREES_TO_RADIANS = Math.PI / 180;

/**
 * One `images.full` record from an evidence manifest, narrowed to what the crop
 * and tile helpers need. A manifest entry satisfies this structurally, so lanes
 * can pass `record.images.full` without a mapping step.
 */
export interface FacadeWallEvidence {
  /** Crop file name, relative to `<evidenceDir>/images/`. */
  file: string;
  pose: CameraPose;
  plane: FacadePlane;
  /** Cached crop width/height in pixels. */
  width: number;
  height: number;
  /** Source panorama dimensions, `[width, height]`. */
  sourceDimensions: readonly [number, number];
  /** Perpendicular distance from the camera to the wall plane, metres. */
  standoff: number;
  /** Angle between the wall normal and the camera ray, degrees. */
  obliquity: number;
}

/** A point on the wall, in the rectified crop's metric frame. */
export interface WallMetre {
  /** Metres along the wall from `plane.start`. */
  along: number;
  /** Metres above `plane.baseZ`; add `frame.baseZ` for absolute NAP. */
  up: number;
}

/**
 * The constant metric scale of one rectified crop. `width`/`height` are the
 * raster dimensions; `wallWidthM`/`wallHeightM` are the wall extent they cover.
 */
export interface CropFrame {
  width: number;
  height: number;
  /** Uniform scale, pixels per wall metre. */
  pixelsPerMetre: number;
  wallWidthM: number;
  wallHeightM: number;
  /** NAP height of the wall base, for turning relative `up` into absolute NAP. */
  baseZ: number;
  /** NAP height of the top of the sampled strip. */
  topZ: number;
}

export interface Tile {
  /** Deterministic row-major index: `row * columns + column`. */
  index: number;
  column: number;
  row: number;
  columns: number;
  rows: number;
  /** Tile origin in crop pixel indices. */
  x: number;
  y: number;
  /** Tile size in crop pixels, clipped at the right/bottom crop edge. */
  width: number;
  height: number;
}

export interface TileGrid {
  tiles: Tile[];
  tileSize: number;
  overlap: number;
  /** Pixel step between adjacent tile origins. */
  stride: number;
  columns: number;
  rows: number;
}

export interface TileOptions {
  tileSize?: number;
  /** Fractional overlap, `0 ≤ overlap < 1`. */
  overlap?: number;
}

/**
 * Native sampling limit of the source panorama along the wall, px/m.
 *
 * `1273 · cos(obliquity) / standoff`: the equatorial pixel angular resolution
 * divided by the slant that foreshortens the wall. Above this, a re-render is
 * interpolating detail the panorama never captured.
 */
export function nativeCeilingPixelsPerMetre(
  wall: Pick<FacadeWallEvidence, 'standoff' | 'obliquity'>,
): number {
  return (EQUIRECTANGULAR_PIXELS_PER_RADIAN * Math.cos(wall.obliquity * DEGREES_TO_RADIANS)) / wall.standoff;
}

/** The plan's literal R1 scale, `min(150, 0.9 × native)`, before flooring at R0. */
export function r1NativePixelsPerMetre(
  wall: Pick<FacadeWallEvidence, 'standoff' | 'obliquity'>,
): number {
  return Math.min(R1_MAX_PIXELS_PER_METRE, R1_NATIVE_UTILISATION * nativeCeilingPixelsPerMetre(wall));
}

/**
 * Effective R1 render scale.
 *
 * Floored at the cached R0 scale: when the native ceiling cannot support
 * 45 px/m there is nothing to gain from a re-render, so R1 *is* R0 and tiling
 * adds nothing. Above that the plain `min(150, 0.9 × native)` applies.
 */
export function r1PixelsPerMetre(wall: Pick<FacadeWallEvidence, 'standoff' | 'obliquity'>): number {
  return Math.max(FULL_TIER_PIXELS_PER_METRE, r1NativePixelsPerMetre(wall));
}

/** True when R1 resolves to a higher-resolution render than the cached R0 strip. */
export function r1BeatsR0(wall: Pick<FacadeWallEvidence, 'standoff' | 'obliquity'>): boolean {
  return r1PixelsPerMetre(wall) > FULL_TIER_PIXELS_PER_METRE;
}

/** Path to a cached strip: `<evidenceDir>/images/<file>`. Pure string join. */
export function r0ImagePath(evidenceDir: string, file: string): string {
  const base = evidenceDir.replace(/[/\\]+$/, '');
  return `${base}/images/${file}`;
}

/**
 * Build the metric frame for a raster covering `plane`.
 *
 * `pixelsPerMetre` is derived from the raster width when not supplied, so the
 * same call works for the cached R0 strip and for an R1 render whose scale the
 * `maxPixels` cap may have pulled below the requested value.
 */
export function cropFrame(
  plane: FacadePlane,
  raster: { width: number; height: number; pixelsPerMetre?: number },
): CropFrame {
  const wallWidthM = Math.hypot(plane.end.x - plane.start.x, plane.end.y - plane.start.y);
  const wallHeightM = plane.topZ - plane.baseZ;
  if (!(wallWidthM > 0)) throw new RangeError('cropFrame: wall has zero length');
  if (!(wallHeightM > 0)) throw new RangeError('cropFrame: wall has zero height');
  if (!(raster.width > 0) || !(raster.height > 0)) throw new RangeError('cropFrame: raster has non-positive size');
  return {
    width: raster.width,
    height: raster.height,
    pixelsPerMetre: raster.pixelsPerMetre ?? raster.width / wallWidthM,
    wallWidthM,
    wallHeightM,
    baseZ: plane.baseZ,
    topZ: plane.topZ,
  };
}

/** Crop pixel index → wall metres (pixel centre at integer coordinates). */
export function cropPixelToWallMetre(frame: CropFrame, x: number, y: number): WallMetre {
  return {
    along: ((x + 0.5) / frame.width) * frame.wallWidthM,
    up: frame.wallHeightM * (1 - (y + 0.5) / frame.height),
  };
}

/** Wall metres → crop pixel index. Exact inverse of {@link cropPixelToWallMetre}. */
export function wallMetreToCropPixel(frame: CropFrame, point: WallMetre): { x: number; y: number } {
  return {
    x: (point.along / frame.wallWidthM) * frame.width - 0.5,
    y: (1 - point.up / frame.wallHeightM) * frame.height - 0.5,
  };
}

/** Tile-local pixel index → wall metres. */
export function tilePixelToWallMetre(frame: CropFrame, tile: Tile, x: number, y: number): WallMetre {
  return cropPixelToWallMetre(frame, tile.x + x, tile.y + y);
}

/** Wall metres → tile-local pixel index. Exact inverse of {@link tilePixelToWallMetre}. */
export function wallMetreToTilePixel(frame: CropFrame, tile: Tile, point: WallMetre): { x: number; y: number } {
  const crop = wallMetreToCropPixel(frame, point);
  return { x: crop.x - tile.x, y: crop.y - tile.y };
}

/**
 * Cover a raster with overlapping square tiles, row-major.
 *
 * Origins step by `floor(tileSize × (1 − overlap))`, so adjacent tiles always
 * overlap by at least the declared fraction, and the final tile in each row or
 * column is clipped to the edge. Runs are deterministic: the same raster and
 * options yield deep-equal tiles every time.
 */
export function planTiles(raster: { width: number; height: number }, options: TileOptions = {}): TileGrid {
  const tileSize = options.tileSize ?? DEFAULT_TILE_SIZE_PX;
  const overlap = options.overlap ?? DEFAULT_TILE_OVERLAP;
  if (!(raster.width > 0) || !(raster.height > 0)) throw new RangeError('planTiles: raster has non-positive size');
  if (!(tileSize >= 1)) throw new RangeError(`planTiles: tileSize ${tileSize} must be at least 1`);
  if (!(overlap >= 0 && overlap < 1)) throw new RangeError(`planTiles: overlap ${overlap} must be in [0, 1)`);

  const stride = Math.max(1, Math.floor(tileSize * (1 - overlap)));
  const count = (length: number) => (length <= tileSize ? 1 : 1 + Math.ceil((length - tileSize) / stride));
  const columns = count(raster.width);
  const rows = count(raster.height);

  const tiles: Tile[] = [];
  for (let row = 0; row < rows; row++) {
    const y = row * stride;
    const height = Math.min(tileSize, raster.height - y);
    for (let column = 0; column < columns; column++) {
      const x = column * stride;
      tiles.push({
        index: row * columns + column,
        column,
        row,
        columns,
        rows,
        x,
        y,
        width: Math.min(tileSize, raster.width - x),
        height,
      });
    }
  }
  return { tiles, tileSize, overlap, stride, columns, rows };
}

export interface R0Crop {
  /** Absolute or caller-relative path to the cached strip. */
  path: string;
  file: string;
  frame: CropFrame;
}

/** Describe the cached 45 px/m `full` strip. Does not read the file. */
export function resolveR0(
  evidenceDir: string,
  wall: Pick<FacadeWallEvidence, 'file' | 'plane' | 'width' | 'height'>,
): R0Crop {
  return {
    path: r0ImagePath(evidenceDir, wall.file),
    file: wall.file,
    frame: cropFrame(wall.plane, { width: wall.width, height: wall.height, pixelsPerMetre: FULL_TIER_PIXELS_PER_METRE }),
  };
}

export interface R1Crop {
  image: RectifiedFacade;
  frame: CropFrame;
  /** Scale actually used, after the `maxPixels` cap. */
  pixelsPerMetre: number;
  /** True when the render resolves above the cached R0 strip. */
  beatsR0: boolean;
}

/**
 * Re-render a wall from its source panorama at R1 scale. Pure: pass an already
 * decoded equirectangular image.
 */
export function renderR1(
  source: EquirectangularImage,
  wall: FacadeWallEvidence,
  options: { camera?: CameraModel } = {},
): R1Crop {
  const requested = r1PixelsPerMetre(wall);
  const image = rectifyFacade(source, wall.pose, wall.plane, {
    camera: options.camera ?? AMSTERDAM_WORLD_ALIGNED,
    pixelsPerMetre: requested,
    maxPixels: R1_MAX_PIXELS,
  });
  return {
    image,
    frame: cropFrame(wall.plane, image),
    pixelsPerMetre: image.pixelsPerMetre,
    beatsR0: requested > FULL_TIER_PIXELS_PER_METRE,
  };
}
