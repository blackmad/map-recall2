/** Pixel measurements of one decoded crop (H4b): white-balanced foliage, height cover, edge density, seam step. Pure; tested in flags.test.ts. */
import { balancedLeaf, measureWhiteBalance } from '../../src/canalRecall/blockFace/stripWhiteBalance.ts';
import { isLeaf } from '../../src/canalRecall/buildingRecipe/measureFacade.ts';
import { voidShare, occluderShare } from './flags.ts';
import { occlusionMask } from './f3/occlusion.ts';

export const EDGE_GRADIENT = 20;
/** A channel at or above this counts as clipped. 255 exactly, minus one level for the JPEG round trip (the archived crops are q80 JPEGs, the live measurement reads the raw pixels; both use 254 so they agree). */
export const CLIP_LEVEL = 254;

/** H4c washed-out: share of valid mid-wall pixels (rows 20-90 %) with any channel clipped. Brightness alone flagged white-painted canal fronts; clipping does not, because a correctly exposed white wall sits at 200-245. `alpha` may be omitted for an archived JPEG (void pixels are mid-grey there and never clip). */
export function clippedShare(rgba: Uint8ClampedArray | Uint8Array, alpha: Uint8Array | null, width: number, height: number): number {
  let bad = 0, n = 0;
  for (let y = Math.floor(height * 0.2); y < Math.floor(height * 0.9); y += 2) for (let x = 0; x < width; x += 2) {
    const p = y * width + x; if (alpha && alpha[p] !== 255) continue; n++;
    if (Math.max(rgba[p * 4], rgba[p * 4 + 1], rgba[p * 4 + 2]) >= CLIP_LEVEL) bad++;
  }
  return n ? bad / n : 0;
}
const luma = (d: Uint8ClampedArray | Uint8Array, i: number) => 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];

/** Valid rows counted up from the bottom (the ground) while at least half their pixels are valid, as a share of the crop height. */
export function heightCover(alpha: Uint8Array, width: number, height: number): number {
  let rows = 0;
  for (let y = height - 1; y >= 0; y--) {
    let v = 0; for (let x = 0; x < width; x += 2) if (alpha[y * width + x] === 255) v++;
    if (v < Math.ceil(width / 2) * 0.5) break;
    rows++;
  }
  return height ? rows / height : 0;
}

/** Share of valid pixels in the middle of the crop (rows 25-75 %, columns 10-90 %) whose luma gradient (|dx| + |dy|) exceeds EDGE_GRADIENT. */
export function edgeDensity(rgba: Uint8ClampedArray | Uint8Array, alpha: Uint8Array, width: number, height: number): number {
  const y0 = Math.floor(height * 0.25), y1 = Math.floor(height * 0.75), x0 = Math.floor(width * 0.1), x1 = Math.floor(width * 0.9);
  let n = 0, e = 0;
  for (let y = y0; y < y1 - 1; y += 2) for (let x = x0; x < x1 - 1; x += 2) {
    const p = y * width + x;
    if (alpha[p] !== 255 || alpha[p + 1] !== 255 || alpha[p + width] !== 255) continue;
    n++;
    if (Math.abs(luma(rgba, p * 4) - luma(rgba, (p + 1) * 4)) + Math.abs(luma(rgba, p * 4) - luma(rgba, (p + width) * 4)) > EDGE_GRADIENT) e++;
  }
  return n ? e / n : 0;
}

/** Largest step in mean luma between adjacent bands of the body (columns and rows, 3 pixels wide on each side): a fusion seam shows as one line that differs across its whole length. */
export function seamStep(rgba: Uint8ClampedArray | Uint8Array, alpha: Uint8Array, width: number, height: number): number {
  const y0 = Math.floor(height * 0.1), y1 = Math.floor(height * 0.9), band = 3;
  const colMean = new Float64Array(width).fill(NaN), rowMean = new Float64Array(height).fill(NaN);
  for (let x = 0; x < width; x++) { let s = 0, n = 0; for (let y = y0; y < y1; y += 2) if (alpha[y * width + x] === 255) { s += luma(rgba, (y * width + x) * 4); n++; } if (n > (y1 - y0) / 4) colMean[x] = s / n; }
  for (let y = y0; y < y1; y++) { let s = 0, n = 0; for (let x = 0; x < width; x += 2) if (alpha[y * width + x] === 255) { s += luma(rgba, (y * width + x) * 4); n++; } if (n > width / 8) rowMean[y] = s / n; }
  const step = (m: Float64Array, lo: number, hi: number) => {
    let best = 0;
    for (let i = lo + band; i < hi - band; i++) {
      let a = 0, b = 0, ok = true;
      for (let k = 1; k <= band; k++) { const l = m[i - k], r = m[i + k - 1]; if (Number.isNaN(l) || Number.isNaN(r)) { ok = false; break; } a += l; b += r; }
      if (ok) best = Math.max(best, Math.abs(a - b) / band);
    }
    return best;
  };
  return Math.max(step(colMean, 0, width), step(rowMean, y0, y1));
}

/** Foliage share over valid pixels on a leaf test; stride 2 as pand-reference's foliageFraction. */
export function foliageShare(rgba: Uint8ClampedArray | Uint8Array, alpha: Uint8Array, width: number, height: number, leaf: (r: number, g: number, b: number) => boolean): number {
  let bad = 0, n = 0;
  for (let y = 0; y < height; y += 2) for (let x = 0; x < width; x += 2) { const p = y * width + x; if (alpha[p] !== 255) continue; n++; const i = p * 4; if (leaf(rgba[i], rgba[i + 1], rgba[i + 2])) bad++; }
  return n ? bad / n : 0;
}

export function measureCrop(rgba: Uint8ClampedArray | Uint8Array, alpha: Uint8Array, width: number, height: number, ppm = 50) {
  // white-balance reference from the valid pixels only, on a 1/3 grid (the module keeps every pixel in a JS array); invalid ones become placeholder grey, which it skips
  const sw = Math.floor(width / 3), sh = Math.floor(height / 3), rgb = new Uint8Array(sw * sh * 3);
  for (let y = 0; y < sh; y++) for (let x = 0; x < sw; x++) { const p = (y * 3) * width + x * 3, o = (y * sw + x) * 3, v = alpha[p] === 255; rgb[o] = v ? rgba[p * 4] : 128; rgb[o + 1] = v ? rgba[p * 4 + 1] : 128; rgb[o + 2] = v ? rgba[p * 4 + 2] : 128; }
  const wb = measureWhiteBalance(rgb, sw, sh, [[0, sw]]);
  const washedOut = clippedShare(rgba, alpha, width, height);
  const occ = occlusionMask(rgba, alpha, width, height, balancedLeaf(wb), ppm);
  let miss = 0; for (let p = 0; p < alpha.length; p++) if (alpha[p] !== 255) miss++;
  return {
    foliage: foliageShare(rgba, alpha, width, height, balancedLeaf(wb)), foliagePlain: foliageShare(rgba, alpha, width, height, isLeaf), wbApplied: wb.applied,
    washedOut, missing: alpha.length ? miss / alpha.length : 1, voidShare: voidShare(alpha, width, height), occluderShare: occluderShare(rgba, alpha, width, height),
    maskedShare: occ.maskedShare, trunkShare: occ.trunkShare, vehicleShare: occ.vehicleShare,
    heightCover: heightCover(alpha, width, height), edgeDensity: edgeDensity(rgba, alpha, width, height), seamStep: seamStep(rgba, alpha, width, height),
  };
}
