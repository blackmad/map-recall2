// Roof and dormer cells for the three.js building layer. Same convention as
// `facadeCells.ts`: 256 x 256 RGBA, rgb luminance (or fixed colour), alpha = tint
// weight so one cell serves every roof colour. A roof cell covers 1.2 m x 1.2 m
// of slope; the dormer cell covers the whole dormer face.
//   tile   – Dutch pantiles: rounded S-curves in courses
//   slate  – staggered slates, finer and flatter
//   dormer – small window set in a wall surround
// `toon` draws the cartoon version: flat tones, thick dark lines, no mottling.

import { CELL_PX } from './facadeCells.js';

export type RoofCellKind = 'tile' | 'slate' | 'dormer';
export const ROOF_CELL_KINDS: readonly RoofCellKind[] = ['tile', 'slate', 'dormer'];
export const ROOF_CELL_M = 1.2;

function hash2(a: number, b: number, seed: number): number {
  let h = Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263) ^ Math.imul(seed | 0, 2246822519);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export function paintRoofCell(kind: RoofCellKind, toon: boolean): Uint8ClampedArray {
  const data = new Uint8ClampedArray(CELL_PX * CELL_PX * 4);
  const put = (x: number, y: number, v: number, a: number, rgb?: [number, number, number]) => {
    const i = (y * CELL_PX + x) * 4;
    const c = rgb ?? [v, v, v];
    data[i] = c[0]; data[i + 1] = c[1]; data[i + 2] = c[2]; data[i + 3] = a;
  };
  if (kind === 'tile') {
    const rows = 8, cols = 5, rowH = CELL_PX / rows, colW = CELL_PX / cols;
    for (let y = 0; y < CELL_PX; y++) for (let x = 0; x < CELL_PX; x++) {
      const row = Math.floor(y / rowH), fy = (y % rowH) / rowH;
      const shifted = (x + (row % 2) * colW * 0.5) % CELL_PX;
      const col = Math.floor(shifted / colW), fx = (shifted % colW) / colW;
      // The S of a pantile: a ridge rising across its width, shadowed under its lower edge.
      const wave = Math.sin(fx * Math.PI);
      let v = toon ? 0.92 : 0.7 + 0.22 * wave - 0.28 * Math.pow(Math.max(0, 1 - fy * 3.2), 1.5) * 0 - 0.22 * Math.max(0, (0.18 - fy) / 0.18);
      if (!toon) v += (hash2(col, row, 7) - 0.5) * 0.14;
      const line = toon ? (fy < 0.07 || fx < 0.035 || fx > 0.965) : false;
      put(x, y, Math.round(Math.max(0, Math.min(1, line ? 0.28 : v)) * 255), 255);
    }
  } else if (kind === 'slate') {
    const rows = 11, cols = 6, rowH = CELL_PX / rows, colW = CELL_PX / cols;
    for (let y = 0; y < CELL_PX; y++) for (let x = 0; x < CELL_PX; x++) {
      const row = Math.floor(y / rowH), fy = (y % rowH) / rowH;
      const shifted = (x + (row % 2) * colW * 0.5) % CELL_PX;
      const col = Math.floor(shifted / colW), fx = (shifted % colW) / colW;
      let v = toon ? 0.9 : 0.82 + (hash2(col, row, 11) - 0.5) * 0.16 - 0.16 * Math.max(0, (0.16 - fy) / 0.16);
      const joint = fx < (toon ? 0.05 : 0.025) || fy < (toon ? 0.09 : 0.04);
      if (joint) v = toon ? 0.3 : v * 0.7;
      put(x, y, Math.round(Math.max(0, Math.min(1, v)) * 255), 255);
    }
  } else {
    // Dormer face: tinted wall around a white-framed window, fixed colours for the window itself.
    const wx0 = 0.2, wx1 = 0.8, wy0 = 0.2, wy1 = 0.82;
    for (let y = 0; y < CELL_PX; y++) for (let x = 0; x < CELL_PX; x++) {
      const fx = x / CELL_PX, fy = y / CELL_PX;
      const inFrame = fx > wx0 - 0.06 && fx < wx1 + 0.06 && fy > wy0 - 0.06 && fy < wy1 + 0.06;
      const inGlass = fx > wx0 + 0.03 && fx < wx1 - 0.03 && fy > wy0 + 0.03 && fy < wy1 - 0.03;
      const muntin = Math.abs(fx - 0.5) < 0.018 || Math.abs(fy - 0.5) < 0.018;
      if (inGlass && !muntin) {
        const t = (fy - wy0) / (wy1 - wy0);
        const g = toon ? [150 + 60 * t, 200 + 30 * t, 235] : [40 + 80 * t * t, 55 + 90 * t * t, 68 + 90 * t * t];
        put(x, y, 0, 0, [g[0], g[1], g[2]]);
      } else if (inFrame) put(x, y, 0, 0, toon ? [255, 250, 240] : [236, 232, 221]);
      else {
        const v = toon ? 0.92 : 0.85 + (hash2(x >> 3, y >> 3, 5) - 0.5) * 0.12;
        const edge = toon && (x < 5 || y < 5 || x > CELL_PX - 6 || y > CELL_PX - 6);
        put(x, y, Math.round((edge ? 0.3 : v) * 255), 255);
      }
    }
  }
  return data;
}

/** Roof cells in `ROOF_CELL_KINDS` order, for appending to a layer array. */
export const paintRoofLayers = (toon: boolean): Uint8ClampedArray[] => ROOF_CELL_KINDS.map(kind => paintRoofCell(kind, toon));
