/**
 * Roof furniture from the orthophoto: colour + shape heuristics on the roof raster (0.21 m/px).
 *
 * On a flat roof, against the roof's own base tone (cast removed):
 *   - solar: connected runs of solar-class pixels (dark, blue over red), >= 1.2 m², as oriented boxes;
 *   - bright blobs (base + 38 luma): 0.25-1.6 m² with no shadow -> skylight; 1.0-14 m² with a dark
 *     blob touching their north side (the photo's sun is in the south) -> hvac; > 14 m² with a
 *     shadow -> overrun (lift/stair housing);
 *   - dark compact blobs (base - 40 luma) 0.12-1.4 m², away from the roof edge and not a bright
 *     blob's shadow -> vent (< 0.45 m²) or chimney.
 * Positions are centroids; sizes come from the blob's principal axes. Precision is checked by eye
 * on the labelled 100 (`eval-furniture.mts`, contact sheet with the detections drawn).
 */
import { castAt, ORTHO25_CAST, pixelClass, type FurnitureItem } from '../../src/canalRecall/roofs/roofSlots.ts';
import { insidePand, rdToAnchorOffset, type Pand } from './roofPixels.ts';
import type { OrthoMosaic } from './orthoTiles.ts';

export type RoofRaster = { w: number; h: number; x0: number; y0: number; res: number; rgb: Uint8Array; luma: Float32Array; mask: Uint8Array; edge: Uint8Array };

/** The roof as a raster on the mosaic grid: mask = inside the outline eroded 0.3 m; edge = within 0.9 m of it. */
export function roofRaster(pand: Pand, mosaic: OrthoMosaic): RoofRaster | null {
  const [minX, minY, maxX, maxY] = pand.bbox, res = mosaic.res;
  const w = Math.ceil((maxX - minX) / res), h = Math.ceil((maxY - minY) / res);
  if (w < 3 || h < 3 || w * h > 400_000) return null;
  const rgb = new Uint8Array(w * h * 3), luma = new Float32Array(w * h), mask = new Uint8Array(w * h), edge = new Uint8Array(w * h);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const x = minX + (i + 0.5) * res, y = maxY - (j + 0.5) * res, k = j * w + i;
    if (!insidePand(x, y, pand, 0.3)) continue;
    const p = mosaic.pixel(x, y);
    if (!p) continue;
    const y0 = 0.2126 * p[0] + 0.7152 * p[1] + 0.0722 * p[2], [cr, cg, cb] = castAt(ORTHO25_CAST, y0);
    rgb[k * 3] = Math.max(0, Math.min(255, p[0] - cr)); rgb[k * 3 + 1] = Math.max(0, Math.min(255, p[1] - cg)); rgb[k * 3 + 2] = Math.max(0, Math.min(255, p[2] - cb));
    luma[k] = y0; mask[k] = 1;
    if (!insidePand(x, y, pand, 0.9)) edge[k] = 1;
  }
  return { w, h, x0: minX, y0: maxY, res, rgb, luma, mask, edge };
}

type Blob = { idx: number[]; cx: number; cy: number; area: number; touchesEdge: boolean };
function blobs(r: RoofRaster, on: Uint8Array): Blob[] {
  const seen = new Uint8Array(on.length), out: Blob[] = [];
  for (let s = 0; s < on.length; s++) {
    if (!on[s] || seen[s]) continue;
    const idx: number[] = [], stack = [s]; seen[s] = 1;
    let touchesEdge = false;
    while (stack.length) {
      const k = stack.pop()!; idx.push(k);
      if (r.edge[k]) touchesEdge = true;
      const i = k % r.w, j = (k / r.w) | 0;
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const a = i + di, b = j + dj; if (a < 0 || b < 0 || a >= r.w || b >= r.h) continue;
        const n = b * r.w + a; if (on[n] && !seen[n]) { seen[n] = 1; stack.push(n); }
      }
    }
    let cx = 0, cy = 0; for (const k of idx) { cx += k % r.w; cy += (k / r.w) | 0; }
    out.push({ idx, cx: cx / idx.length, cy: cy / idx.length, area: idx.length * r.res * r.res, touchesEdge });
  }
  return out;
}

/** Principal-axis box of a blob: [length, width] metres and yaw (degrees, east = 0, counter-clockwise). */
function axes(r: RoofRaster, b: Blob): { l: number; w: number; yawDeg: number } {
  let sxx = 0, syy = 0, sxy = 0;
  for (const k of b.idx) { const dx = (k % r.w) - b.cx, dy = -(((k / r.w) | 0) - b.cy); sxx += dx * dx; syy += dy * dy; sxy += dx * dy; }
  const n = b.idx.length, a = sxx / n, c = syy / n, d = sxy / n;
  const theta = 0.5 * Math.atan2(2 * d, a - c), tr = a + c, det = a * c - d * d, disc = Math.sqrt(Math.max(0, tr * tr / 4 - det));
  const l1 = tr / 2 + disc, l2 = Math.max(0, tr / 2 - disc);
  // A uniform rectangle of side s has variance s²/12 along it.
  return { l: Math.max(r.res, Math.sqrt(12 * l1) * r.res), w: Math.max(r.res, Math.sqrt(12 * l2) * r.res), yawDeg: (theta * 180) / Math.PI };
}

export const MAX_ITEMS = 16;

export function detectFurniture(pand: Pand, r: RoofRaster): FurnitureItem[] {
  const n = r.w * r.h, lit: number[] = [];
  for (let k = 0; k < n; k++) if (r.mask[k]) lit.push(r.luma[k]);
  if (lit.length < 60) return [];
  lit.sort((a, b) => a - b);
  const base = lit[lit.length >> 1], p75 = lit[Math.floor(lit.length * 0.75)];
  const solarOn = new Uint8Array(n), brightOn = new Uint8Array(n), darkOn = new Uint8Array(n);
  const shadowBelow = Math.min(72, Math.max(34, p75 * 0.5));
  for (let k = 0; k < n; k++) {
    if (!r.mask[k]) continue;
    const cls = pixelClass(r.rgb[k * 3], r.rgb[k * 3 + 1], r.rgb[k * 3 + 2], shadowBelow);
    if (cls === 'solar' && r.luma[k] > 30 && r.luma[k] < base - 12) solarOn[k] = 1;
    else if (r.luma[k] > base + 38) brightOn[k] = 1;
    else if (r.luma[k] < base - 40) darkOn[k] = 1;
  }
  const items: Array<FurnitureItem & { score: number }> = [];
  const centre = (b: Blob) => rdToAnchorOffset(pand, r.x0 + (b.cx + 0.5) * r.res, r.y0 - (b.cy + 0.5) * r.res);
  for (const b of blobs(r, solarOn)) {
    if (b.area < 1.2) continue;
    const ax = axes(r, b), [e, nn] = centre(b);
    items.push({ kind: 'solar', e, n: nn, l: ax.l, w: ax.w, yawDeg: ax.yawDeg, score: b.area });
  }
  const dark = blobs(r, darkOn);
  const darkAt = new Int32Array(n).fill(-1);
  dark.forEach((b, i) => { for (const k of b.idx) darkAt[k] = i; });
  const usedDark = new Set<number>();
  for (const b of blobs(r, brightOn)) {
    if (b.area < 0.25) continue;
    // A shadow touching the north half of the blob (rows above it in the raster, the photo's sun is south).
    let shadow = -1;
    for (const k of b.idx) {
      const i = k % r.w, j = (k / r.w) | 0;
      for (const [di, dj] of [[0, -1], [0, -2], [1, -1], [-1, -1]]) {
        const a = i + di, c = j + dj; if (a < 0 || c < 0 || a >= r.w) continue;
        const d = darkAt[c * r.w + a]; if (d >= 0) { shadow = d; break; }
      }
      if (shadow >= 0) break;
    }
    const ax = axes(r, b), [e, nn] = centre(b);
    if (ax.l > 4 * ax.w + r.res && ax.w < 1.2) continue; // a thin strip: a parapet coping or a seam
    if (shadow >= 0) {
      usedDark.add(shadow);
      if (b.area >= 14) items.push({ kind: 'overrun', e, n: nn, l: ax.l, w: ax.w, yawDeg: ax.yawDeg, score: b.area });
      else if (b.area >= 1.0) items.push({ kind: 'hvac', e, n: nn, l: ax.l, w: ax.w, yawDeg: ax.yawDeg, score: b.area });
      else items.push({ kind: 'skylight', e, n: nn, l: ax.l, w: ax.w, yawDeg: ax.yawDeg, score: b.area });
    } else if (b.area <= 12 && !b.touchesEdge) items.push({ kind: 'skylight', e, n: nn, l: ax.l, w: ax.w, yawDeg: ax.yawDeg, score: b.area * 0.8 });
  }
  dark.forEach((b, i) => {
    if (usedDark.has(i) || b.touchesEdge || b.area < 0.15 || b.area > 1.4) return;
    let mean = 0; for (const k of b.idx) mean += r.luma[k]; mean /= b.idx.length;
    if (mean > base - 55) return; // only a really dark stack, not a stain or a soft shadow
    const ax = axes(r, b);
    if (ax.l > 3 * ax.w + r.res) return; // a strip is a seam or a parapet shadow, not a stack
    const [e, nn] = centre(b);
    items.push({ kind: b.area < 0.45 ? 'vent' : 'chimney', e, n: nn, l: Math.max(0.4, ax.l), w: Math.max(0.4, ax.w), yawDeg: ax.yawDeg, score: b.area * 0.6 });
  });
  return items.sort((a, b) => b.score - a.score).slice(0, MAX_ITEMS).map(({ score: _s, ...it }) => it);
}
