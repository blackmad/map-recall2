import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { parse } from '@loaders.gl/core';
import { LASLoader } from '@loaders.gl/las';
import type { CloudPoint } from '../../src/canalRecall/facade/pointCloudGeometry.ts';

export interface Bounds3 {
  minX: number;
  minY: number;
  minZ: number;
  maxX: number;
  maxY: number;
  maxZ: number;
}

export interface LazTile {
  source: string;
  sha256: string;
  bytes: number;
  count: number;
  bounds: Bounds3;
  positions: Float32Array;
  colours: Uint8Array | null;
  intensities: Uint16Array | null;
}

/**
 * Decode a (LAZ|LAS) tile to absolute RD/NAP positions. `colorDepth: 'auto'` is
 * required: the loader's default of 8 reads 16-bit municipal colours as 255.
 */
export async function loadLazTile(file: string): Promise<LazTile> {
  const bytes = await readFile(file);
  const data = await parse(bytes, LASLoader, { las: { fp64: false, colorDepth: 'auto' } });
  const positions = data.attributes.POSITION?.value as Float32Array | undefined;
  if (!positions) throw new Error(`no POSITION attribute in ${file}`);
  const count = (data.loaderData?.pointsCount as number) ?? positions.length / 3;
  const colourAttribute = data.attributes.COLOR_0?.value as Uint8Array | undefined;
  const intensityAttribute = data.attributes.intensity?.value as Uint16Array | undefined;
  const mins = data.loaderData?.mins as number[] | undefined;
  const maxs = data.loaderData?.maxs as number[] | undefined;
  const bounds: Bounds3 = mins && maxs
    ? { minX: mins[0], minY: mins[1], minZ: mins[2], maxX: maxs[0], maxY: maxs[1], maxZ: maxs[2] }
    : scanBounds(positions, count);
  return {
    source: file,
    sha256: createHash('sha256').update(bytes).digest('hex'),
    bytes: bytes.byteLength,
    count,
    bounds,
    positions,
    colours: colourAttribute ? toRgb(colourAttribute, count) : null,
    intensities: intensityAttribute ? intensityAttribute.subarray(0, count) : null,
  };
}

const scanBounds = (positions: Float32Array, count: number): Bounds3 => {
  const bounds: Bounds3 = { minX: Infinity, minY: Infinity, minZ: Infinity, maxX: -Infinity, maxY: -Infinity, maxZ: -Infinity };
  for (let index = 0; index < count; index += 1) {
    const x = positions[index * 3];
    const y = positions[index * 3 + 1];
    const z = positions[index * 3 + 2];
    bounds.minX = Math.min(bounds.minX, x); bounds.maxX = Math.max(bounds.maxX, x);
    bounds.minY = Math.min(bounds.minY, y); bounds.maxY = Math.max(bounds.maxY, y);
    bounds.minZ = Math.min(bounds.minZ, z); bounds.maxZ = Math.max(bounds.maxZ, z);
  }
  return bounds;
};

const toRgb = (colour: Uint8Array, count: number) => {
  const rgb = new Uint8Array(count * 3);
  for (let index = 0; index < count; index += 1) {
    rgb[index * 3] = colour[index * 4];
    rgb[index * 3 + 1] = colour[index * 4 + 1];
    rgb[index * 3 + 2] = colour[index * 4 + 2];
  }
  return rgb;
};

export type PointSelector = (bounds: Partial<Bounds3>) => CloudPoint[];

/**
 * Uniform-grid index over the tile's (x, y). A wall's slab is a thin box, so
 * this turns a per-wall scan of the whole tile into a handful of cells.
 */
export function createPointSelector(tile: LazTile, cellSize = 5): PointSelector {
  const width = Math.max(1, Math.ceil((tile.bounds.maxX - tile.bounds.minX) / cellSize));
  const height = Math.max(1, Math.ceil((tile.bounds.maxY - tile.bounds.minY) / cellSize));
  const columns: number[][] = Array.from({ length: width * height }, () => []);
  for (let index = 0; index < tile.count; index += 1) {
    const x = tile.positions[index * 3];
    const y = tile.positions[index * 3 + 1];
    const column = Math.min(width - 1, Math.max(0, Math.floor((x - tile.bounds.minX) / cellSize)));
    const row = Math.min(height - 1, Math.max(0, Math.floor((y - tile.bounds.minY) / cellSize)));
    columns[row * width + column].push(index);
  }
  return (bounds) => {
    const minX = bounds.minX ?? tile.bounds.minX;
    const minY = bounds.minY ?? tile.bounds.minY;
    const minZ = bounds.minZ ?? tile.bounds.minZ;
    const maxX = bounds.maxX ?? tile.bounds.maxX;
    const maxY = bounds.maxY ?? tile.bounds.maxY;
    const maxZ = bounds.maxZ ?? tile.bounds.maxZ;
    const firstColumn = Math.max(0, Math.floor((minX - tile.bounds.minX) / cellSize));
    const lastColumn = Math.min(width - 1, Math.floor((maxX - tile.bounds.minX) / cellSize));
    const firstRow = Math.max(0, Math.floor((minY - tile.bounds.minY) / cellSize));
    const lastRow = Math.min(height - 1, Math.floor((maxY - tile.bounds.minY) / cellSize));
    const points: CloudPoint[] = [];
    for (let row = firstRow; row <= lastRow; row += 1) {
      for (let column = firstColumn; column <= lastColumn; column += 1) {
        for (const index of columns[row * width + column]) {
          const x = tile.positions[index * 3];
          const y = tile.positions[index * 3 + 1];
          const z = tile.positions[index * 3 + 2];
          if (x < minX || x > maxX || y < minY || y > maxY || z < minZ || z > maxZ) continue;
          points.push({
            x, y, z,
            red: tile.colours ? tile.colours[index * 3] : undefined,
            green: tile.colours ? tile.colours[index * 3 + 1] : undefined,
            blue: tile.colours ? tile.colours[index * 3 + 2] : undefined,
            intensity: tile.intensities ? tile.intensities[index] : undefined,
          });
        }
      }
    }
    return points;
  };
}
