/**
 * Masks for the blind critic's pairs (lane F4, #379). Both halves of a pair get the same treatment, so what is left to
 * compare is the building, not the things only a photo has:
 *
 * - **street band**: everything under a line `bandM` above the wall's foot (default 1.5 m; parked cars, vans, bikes,
 *   people, the street itself) is painted MASK_GREY on both halves. The line is given as pixel points along the wall
 *   (from the pose), extended flat to the crop's edges. Stoops and stallrisers under it are lost; the shopfront glass,
 *   fascia and door heads above it stay.
 * - **trees**: leaf pixels (measureFacade's isLeaf, the rule the pose pick uses) in either half, dilated by `leafDilate` px,
 *   are painted MASK_GREY on both halves (the union, so the mask itself says nothing about which half is which).
 * - **sky**: each half's own sky (a top-down flood per column while the pixel stays close to the column's first sky pixel
 *   and bright) is painted one flat SKY_FLAT. Not a union: the skyline is evidence (crown/gable type, eaves height), and a
 *   union would draw the photo's skyline into the game's half. Clouds and the renderer's gradient are what go.
 *
 * Pure functions over RGB8 buffers; scripts/house-line/critic.ts does the I/O.
 */
import { isLeaf } from '../../buildingRecipe/measureFacade.ts';

export interface Rgb8 { width: number; height: number; data: Uint8Array }
export const MASK_GREY: [number, number, number] = [128, 128, 128];
export const SKY_FLAT: [number, number, number] = [200, 208, 216];

export interface MaskOptions {
  /** y (px) of the street-band line at each x, or null for no band. Pixels with y >= bandY[x] are masked. */
  bandY: Float32Array | null;
  leafDilate?: number;
  /** Sky flood: max RGB distance from the column's first pixel, and min brightness (max channel). */
  skyTol?: number;
  skyMinBright?: number;
  /** y (px) per column below which the sky flood stops (a line part-way up the wall: a white front is not sky). */
  skyStopY?: Float32Array | null;
}

/** bandY per column from a polyline of pixel points (the band line along the wall), held flat beyond its ends. */
export function bandLine(width: number, points: Array<{ x: number; y: number }>): Float32Array {
  const pts = [...points].filter(p => Number.isFinite(p.x) && Number.isFinite(p.y)).sort((a, b) => a.x - b.x);
  const out = new Float32Array(width);
  if (!pts.length) return out.fill(Infinity);
  for (let x = 0; x < width; x++) {
    if (x <= pts[0].x) { out[x] = pts[0].y; continue; }
    if (x >= pts[pts.length - 1].x) { out[x] = pts[pts.length - 1].y; continue; }
    let i = 0; while (i + 1 < pts.length && pts[i + 1].x < x) i++;
    const a = pts[i], b = pts[i + 1], t = (x - a.x) / Math.max(1e-6, b.x - a.x);
    out[x] = a.y + t * (b.y - a.y);
  }
  return out;
}

/** Leaf pixels of one image (1 = leaf). */
export function leafMask(img: Rgb8): Uint8Array {
  const m = new Uint8Array(img.width * img.height);
  for (let i = 0, o = 0; i < m.length; i++, o += 3) if (isLeaf(img.data[o], img.data[o + 1], img.data[o + 2])) m[i] = 1;
  return m;
}

/** Square dilation by r px (separable max). */
export function dilate(m: Uint8Array, width: number, height: number, r: number): Uint8Array {
  if (r <= 0) return m;
  const tmp = new Uint8Array(m.length), out = new Uint8Array(m.length);
  for (let y = 0; y < height; y++) {
    let run = -Infinity;
    for (let x = 0; x < width; x++) { if (m[y * width + x]) run = x; if (x - run <= r) tmp[y * width + x] = 1; }
    run = Infinity;
    for (let x = width - 1; x >= 0; x--) { if (m[y * width + x]) run = x; if (run - x <= r) tmp[y * width + x] = 1; }
  }
  for (let x = 0; x < width; x++) {
    let run = -Infinity;
    for (let y = 0; y < height; y++) { if (tmp[y * width + x]) run = y; if (y - run <= r) out[y * width + x] = 1; }
    run = Infinity;
    for (let y = height - 1; y >= 0; y--) { if (tmp[y * width + x]) run = y; if (run - y <= r) out[y * width + x] = 1; }
  }
  return out;
}

/** Sky pixels of one image: per column, from the top row down while the pixel stays within tol of the first and bright. */
export function skyMask(img: Rgb8, tol = 38, minBright = 120, stopY: Float32Array | null = null): Uint8Array {
  const { width: W, height: H, data } = img, m = new Uint8Array(W * H);
  for (let x = 0; x < W; x++) {
    const o0 = x * 3;
    if (Math.max(data[o0], data[o0 + 1], data[o0 + 2]) < minBright) continue;
    let pr = data[o0], pg = data[o0 + 1], pb = data[o0 + 2];
    const stop = stopY ? Math.min(H, stopY[x]) : H;
    for (let y = 0; y < stop; y++) {
      const o = (y * W + x) * 3, r = data[o], g = data[o + 1], b = data[o + 2];
      if (Math.max(r, g, b) < minBright || Math.hypot(r - pr, g - pg, b - pb) > tol) break;
      m[y * W + x] = 1;
      pr = (pr * 3 + r) / 4; pg = (pg * 3 + g) / 4; pb = (pb * 3 + b) / 4; // follow a gradient slowly
    }
  }
  return m;
}

export interface MaskStats { band: number; leaf: number; skyA: number; skyB: number }

/**
 * Masks both halves in place (same size required): street band and leaf union in MASK_GREY, each half's own sky in SKY_FLAT.
 * Returns the masked share of each kind (of all pixels).
 */
export function maskPair(a: Rgb8, b: Rgb8, opts: MaskOptions): MaskStats {
  if (a.width !== b.width || a.height !== b.height) throw new Error('maskPair: halves differ in size');
  const W = a.width, H = a.height, n = W * H;
  const la = leafMask(a), lb = leafMask(b), leafU = new Uint8Array(n);
  for (let i = 0; i < n; i++) leafU[i] = la[i] | lb[i];
  const leaf = dilate(leafU, W, H, opts.leafDilate ?? 3);
  const sa = skyMask(a, opts.skyTol, opts.skyMinBright, opts.skyStopY ?? null), sb = skyMask(b, opts.skyTol, opts.skyMinBright, opts.skyStopY ?? null);
  let band = 0, leafN = 0, skyA = 0, skyB = 0;
  const paint = (img: Rgb8, i: number, c: [number, number, number]) => { img.data[i * 3] = c[0]; img.data[i * 3 + 1] = c[1]; img.data[i * 3 + 2] = c[2]; };
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x;
    if (opts.bandY && y >= opts.bandY[x]) { paint(a, i, MASK_GREY); paint(b, i, MASK_GREY); band++; continue; }
    if (leaf[i]) { paint(a, i, MASK_GREY); paint(b, i, MASK_GREY); leafN++; continue; }
    if (sa[i]) { paint(a, i, SKY_FLAT); skyA++; }
    if (sb[i]) { paint(b, i, SKY_FLAT); skyB++; }
  }
  return { band: band / n, leaf: leafN / n, skyA: skyA / n, skyB: skyB / n };
}
