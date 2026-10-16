// What a camera straight above the own ground sees, as a raster of layer ids (pure, offline).
//
// Every built cell's layer triangles are z-buffered top-down; within 2 cm the higher draw rank wins (the game's
// polygon offsets, groundCell DRAW_RANK), and the water mask discards the land and street layers over water as the
// shader does (CUT_CHANNEL, bilinear < 0.5). Shared by the overview tiles and scripts/own-ground/render-topdown.ts.

import { CUT_CHANNEL, DRAW_RANK, GROUND_LAYERS, maskChannelAt, type BuiltCell, type GroundLayer } from '../ownGround/groundCell.js';

/** Layer id in a raster: index in GROUND_LAYERS + 1; 0 = nothing drawn there. */
export const layerId = (layer: GroundLayer): number => GROUND_LAYERS.indexOf(layer) + 1;
export const layerOfId = (id: number): GroundLayer | null => (id > 0 ? GROUND_LAYERS[id - 1] ?? null : null);

/**
 * Rasterise built cells over [x0, y0]–[x0 + w·res, y0 + h·res] (game frame metres, north up: row 0 is the north
 * edge). `skip`: layers left out (the layer beneath shows). Returns one layer id per pixel.
 */
export function rasterLayerIds(cells: readonly BuiltCell[], x0: number, y0: number, w: number, h: number, res: number, skip: ReadonlySet<GroundLayer> = new Set()): Uint8Array {
  const zbuf = new Float32Array(w * h).fill(-Infinity), rank = new Int8Array(w * h).fill(-1), out = new Uint8Array(w * h);
  const top = y0 + h * res;
  for (const cell of cells) for (const layer of GROUND_LAYERS) {
    if (skip.has(layer)) continue;
    const m = cell.layers[layer];
    if (!m) continue;
    const p = m.positions, idx = m.indices, rk = DRAW_RANK[layer] ?? 0, ch = CUT_CHANNEL[layer], id = layerId(layer);
    for (let t = 0; t < idx.length; t += 3) {
      const a = idx[t] * 3, b = idx[t + 1] * 3, c = idx[t + 2] * 3;
      const ax = (p[a] - x0) / res, ay = (top - p[a + 1]) / res, bx = (p[b] - x0) / res, by = (top - p[b + 1]) / res, cx = (p[c] - x0) / res, cy = (top - p[c + 1]) / res;
      const minX = Math.max(0, Math.floor(Math.min(ax, bx, cx))), maxX = Math.min(w - 1, Math.ceil(Math.max(ax, bx, cx)));
      const minY = Math.max(0, Math.floor(Math.min(ay, by, cy))), maxY = Math.min(h - 1, Math.ceil(Math.max(ay, by, cy)));
      if (minX > maxX || minY > maxY) continue;
      const d = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy);
      if (Math.abs(d) < 1e-9) continue;
      for (let py = minY; py <= maxY; py++) for (let px = minX; px <= maxX; px++) {
        const sx = px + 0.5, sy = py + 0.5;
        const u = ((by - cy) * (sx - cx) + (cx - bx) * (sy - cy)) / d, v = ((cy - ay) * (sx - cx) + (ax - cx) * (sy - cy)) / d;
        if (u < 0 || v < 0 || u + v > 1) continue;
        const z = u * p[a + 2] + v * p[b + 2] + (1 - u - v) * p[c + 2];
        const i = py * w + px, zi = zbuf[i];
        if (!(z > zi + 0.02 || (Math.abs(z - zi) <= 0.02 && rk > rank[i]))) continue;
        if (ch !== undefined && cell.mask && maskChannelAt(cell.mask, x0 + sx * res, top - sy * res, ch) < 0.5) continue;
        zbuf[i] = z; rank[i] = rk; out[i] = id;
      }
    }
  }
  return out;
}
