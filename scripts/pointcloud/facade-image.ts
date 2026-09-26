import { encodePng } from './png.ts';
import { MINIMUM_POINTS_PER_CELL, type WallMeasurement } from './measure-tile.ts';

export interface FacadeImage {
  png: Buffer;
  width: number;
  height: number;
  /** Metres per pixel of the rectified image. */
  metresPerPixel: number;
  /** (along, up) in the wall frame of the image's top-left corner. */
  origin: readonly [number, number];
  /** The raw RGB buffer (row-major, 3 bytes/pixel), for a caller that wants to draw an overlay before encoding. */
  rgb: Uint8Array;
}

const background = [24, 30, 38] as const;

/**
 * A rectified façade image built from the cloud's own RGB — the same view a
 * photograph gives, but with no perspective and no occlusion by the street,
 * because every pixel is a measured point. This is the image the plan's
 * appearance layer runs models on.
 */
export const renderFacadeImage = (
  measurement: WallMeasurement,
  options: { pixelsPerMetre?: number; upwardSearch?: number; minimumPointsPerCell?: number } = {},
): FacadeImage => {
  const raster = measurement.raster;
  const pixelsPerMetre = options.pixelsPerMetre ?? 40;
  const upwardSearch = options.upwardSearch ?? 8;
  const minimumPointsPerCell = options.minimumPointsPerCell ?? MINIMUM_POINTS_PER_CELL;
  const bottom = raster.frame.minUp - 0.3;
  const top = raster.frame.maxUp + upwardSearch;
  const widthMetres = raster.frame.maxAlong - raster.frame.minAlong;
  const heightMetres = top - bottom;
  const width = Math.max(1, Math.round(widthMetres * pixelsPerMetre));
  const height = Math.max(1, Math.round(heightMetres * pixelsPerMetre));
  const rgb = new Uint8Array(width * height * 3);
  for (let index = 0; index < width * height; index += 1) {
    rgb[index * 3] = background[0];
    rgb[index * 3 + 1] = background[1];
    rgb[index * 3 + 2] = background[2];
  }
  const metresPerPixel = 1 / pixelsPerMetre;
  for (const cell of raster.cells) {
    if (cell.count < minimumPointsPerCell || !cell.rgb) continue;
    const along = (cell.column + 0.5) * raster.cellSize + raster.frame.minAlong;
    const up = (cell.row + 0.5) * raster.cellSize + raster.bottomUp;
    const x = Math.floor((along - raster.frame.minAlong) * pixelsPerMetre);
    const y = Math.floor((top - up) * pixelsPerMetre);
    if (x < 0 || y < 0 || x >= width || y >= height) continue;
    const offset = (y * width + x) * 3;
    rgb[offset] = cell.rgb[0];
    rgb[offset + 1] = cell.rgb[1];
    rgb[offset + 2] = cell.rgb[2];
  }
  return {
    png: encodePng(width, height, rgb),
    width,
    height,
    metresPerPixel,
    origin: [raster.frame.minAlong, top],
    rgb,
  };
};
