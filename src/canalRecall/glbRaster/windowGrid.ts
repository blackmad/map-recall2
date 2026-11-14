/**
 * The city look's shader window grid (look/cityLook.ts cityWindowGrid, `otherWalls: 'window-grid'`) for the Node GLB
 * rasteriser (lane blank-walls-20261114), so a review sheet shows the windows the game paints on a large house's
 * unphotographed walls instead of the blank quad the GLB carries.
 *
 * The rasteriser has no per-pixel shader, so the grid is baked: one texture tile of GRID_TILE_M x GRID_TILE_M metres (a
 * whole number of 3.0 m bays and 3.2 m storeys, so it repeats seamlessly) sampled at the GLB's metre UVs. The wall
 * between the windows is the cell's mean colour (the brick/stucco/stone texture is below a pixel at gallery-card size);
 * the window is the shader's untinted frame and glass. A cell material multiplies texture by tint, so window texels
 * carry win / tint and come out as the shader's colours. The far-distance fade is left to the mip pyramid.
 */
import { SLOT_CELL, type MaterialSlot } from '../look/palette.ts';
import { WINDOW_GRID_BAY_M, WINDOW_GRID_BOX, WINDOW_GRID_STOREY_M } from '../look/cityLook.ts';
import { makeTexture, type RasterTexture, type Vec3 } from './raster.ts';

/** Tile side (m): 16 bays of 3.0 m and 15 storeys of 3.2 m. */
export const GRID_TILE_M = 48;
const PX_PER_M = 8;
/** The cells the shader paints the grid on (cityLook.ts WINDOW_GRID_CELLS). */
const GRID_CELLS: ReadonlySet<string> = new Set(['brick', 'stucco', 'stone']);

/** True when the game paints the window grid on a material with these glTF extras. */
export function paintsWindowGrid(extras: Record<string, unknown>): boolean {
  const slot = extras.materialSlot;
  return extras.windowGrid === true && typeof slot === 'string' && GRID_CELLS.has(SLOT_CELL[slot as MaterialSlot]);
}

/** Mean RGB of a texture (its last mip level). */
export function textureMean(t: RasterTexture): Vec3 {
  const L = t.levels[t.levels.length - 1], d = L.data, n = L.width * L.height;
  const s = [0, 0, 0];
  for (let i = 0; i < n; i++) for (let c = 0; c < 3; c++) s[c] += d[i * 4 + c];
  return [s[0] / n, s[1] / n, s[2] / n];
}

const smooth = (e0: number, e1: number, x: number) => { const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };

/**
 * The grid tile for a wall whose cell mean is `wall` under `tint` (both as the cell material uses them); sample it at
 * uv * (1 / GRID_TILE_M) with the material's tint.
 */
export function windowGridTexture(wall: Vec3, tint: Vec3): RasterTexture {
  const size = GRID_TILE_M * PX_PER_M, data = new Float32Array(size * size * 4), aa = 0.5 / PX_PER_M;
  const { x0, x1, y0, y1, frame } = WINDOW_GRID_BOX;
  for (let row = 0; row < size; row++) for (let col = 0; col < size; col++) {
    // GL rows: row 0 is v = 0 (flipY false below), so metres up the wall = (row + 0.5) / PX_PER_M.
    const mx = (col + 0.5) / PX_PER_M, my = (row + 0.5) / PX_PER_M;
    const cx = mx / WINDOW_GRID_BAY_M - Math.floor(mx / WINDOW_GRID_BAY_M), cy = my / WINDOW_GRID_STOREY_M - Math.floor(my / WINDOW_GRID_STOREY_M);
    const ax = aa / WINDOW_GRID_BAY_M, ay = aa / WINDOW_GRID_STOREY_M;
    const box = (lo: number, hi: number, c: number, a: number) => smooth(lo - a, lo + a, c) * (1 - smooth(hi - a, hi + a, c));
    const outer = box(x0, x1, cx, ax) * box(y0, y1, cy, ay), glass = box(x0 + frame, x1 - frame, cx, ax) * box(y0 + frame, y1 - frame, cy, ay);
    const i = (row * size + col) * 4;
    for (let c = 0; c < 3; c++) {
      const g = [0.17, 0.21, 0.25][c] + ([0.33, 0.39, 0.44][c] - [0.17, 0.21, 0.25][c]) * cy;
      const win = [0.86, 0.85, 0.82][c] + (g - [0.86, 0.85, 0.82][c]) * glass;
      const out = wall[c] * tint[c] * (1 - outer) + win * outer;
      // makeTexture divides by 255; texels may exceed 1 (window / dark tint), which the float pyramid keeps.
      data[i + c] = (tint[c] > 1e-4 ? out / tint[c] : 0) * 255;
    }
    data[i + 3] = 255;
  }
  return makeTexture(data as unknown as Uint8Array, size, size, false);
}
