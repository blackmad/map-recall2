/**
 * F3 (#381) step 1: an occlusion mask for a rectified facade crop. Trees (leaf colour, after the white balance), bare trunks
 * and poles (dark, near-vertical, narrow, darker than the strips either side) and the largest dark lower-third blob (the
 * van / scaffold proxy of flags.ts, as a box) are masked; `maskedShare` is the share of the valid body pixels hidden. The
 * mask is what the F3 crop ranking scores and what pixel measurements must skip. Pure; tested in occlusion.test.ts.
 * Bare branches are not reliably visible in pixels: the Gemini occlusion question (J3) covers them inside the crop gate.
 */
export type LeafTest = (r: number, g: number, b: number) => boolean;
export type OcclusionStats = { mask: Uint8Array; maskedShare: number; leafShare: number; trunkShare: number; vehicleShare: number; trunkColumns: number[] };

const STEP = 2;
const luma = (d: Uint8ClampedArray | Uint8Array, i: number) => 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
const sat = (d: Uint8ClampedArray | Uint8Array, i: number) => { const mx = Math.max(d[i], d[i + 1], d[i + 2]), mn = Math.min(d[i], d[i + 1], d[i + 2]); return mx ? (mx - mn) / mx : 0; };

/** Trunk columns: x indices (on the STEP grid) whose dark share over the lower body is high, within a run 0.1-0.8 m wide that is clearly darker than the strips 0.3-1.0 m either side (a dark painted facade is dark everywhere, so it has no contrast). */
export function trunkColumns(rgba: Uint8ClampedArray | Uint8Array, alpha: Uint8Array, width: number, height: number, ppm: number): number[] {
  const y0 = Math.floor(height * 0.35), y1 = Math.floor(height * 0.95), gw = Math.floor(width / STEP);
  const frac = new Float64Array(gw);
  for (let gx = 0; gx < gw; gx++) {
    let dark = 0, n = 0;
    for (let y = y0; y < y1; y += STEP) { const p = y * width + gx * STEP; if (alpha[p] !== 255) continue; n++; const i = p * 4; if (luma(rgba, i) < 95 && sat(rgba, i) < 0.4) dark++; }
    frac[gx] = n > (y1 - y0) / STEP / 2 ? dark / n : 0;
  }
  const minW = Math.max(2, Math.round(0.1 * ppm / STEP)), maxW = Math.round(0.8 * ppm / STEP), near = Math.round(0.3 * ppm / STEP), far = Math.round(1.0 * ppm / STEP);
  const out: number[] = [];
  let x = 0;
  while (x < gw) {
    if (frac[x] < 0.6) { x++; continue; }
    let e = x; while (e < gw && frac[e] >= 0.6) e++;
    const w = e - x;
    if (w >= minW && w <= maxW) {
      const side = (a: number, b: number) => { let s = 0, n = 0; for (let k = Math.max(0, a); k < Math.min(gw, b); k++) { s += frac[k]; n++; } return n ? s / n : 1; };
      const left = side(x - far, x - near), right = side(e + near, e + far);
      if (Math.min(left, right) < 0.35 || (left < 0.35 && right < 0.5) || (right < 0.35 && left < 0.5)) for (let k = x; k < e; k++) out.push(k);
    }
    x = e;
  }
  return out;
}

/** Bounding box (crop pixels) of the largest 4-connected dark blob in the lower third, on a 4 px grid; null when none. */
export function vehicleBox(rgba: Uint8ClampedArray | Uint8Array, alpha: Uint8Array, width: number, height: number, lumaMax = 50): { x0: number; x1: number; y0: number; y1: number } | null {
  const step = 4, gw = Math.floor(width / step), top = Math.floor(height * 2 / 3), gh = Math.floor((height - top) / step);
  if (gw < 2 || gh < 2) return null;
  const dark = new Uint8Array(gw * gh);
  for (let gy = 0; gy < gh; gy++) for (let gx = 0; gx < gw; gx++) { const p = (top + gy * step + 2) * width + gx * step + 2; if (alpha[p] === 255 && luma(rgba, p * 4) < lumaMax) dark[gy * gw + gx] = 1; }
  let best = 0, box: { x0: number; x1: number; y0: number; y1: number } | null = null;
  const stack: number[] = [];
  for (let s = 0; s < dark.length; s++) {
    if (dark[s] !== 1) continue;
    let size = 0, x0 = gw, x1 = 0, y0 = gh, y1 = 0; dark[s] = 2; stack.push(s);
    while (stack.length) {
      const c = stack.pop()!, cx = c % gw, cy = (c / gw) | 0; size++;
      x0 = Math.min(x0, cx); x1 = Math.max(x1, cx); y0 = Math.min(y0, cy); y1 = Math.max(y1, cy);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) { const nx = cx + dx, ny = cy + dy; if (nx < 0 || ny < 0 || nx >= gw || ny >= gh) continue; const n = ny * gw + nx; if (dark[n] === 1) { dark[n] = 2; stack.push(n); } }
    }
    if (size > best) { best = size; box = { x0: x0 * step, x1: (x1 + 1) * step, y0: top + y0 * step, y1: top + (y1 + 1) * step }; }
  }
  // a blob under 1.5 % of the lower third is a window or a shadow, not a vehicle
  return best >= 0.015 * gw * gh ? box : null;
}

export function occlusionMask(rgba: Uint8ClampedArray | Uint8Array, alpha: Uint8Array, width: number, height: number, leaf: LeafTest, ppm = 50): OcclusionStats {
  const mask = new Uint8Array(width * height); // 1 leaf, 2 trunk, 3 vehicle
  const y0 = Math.floor(height * 0.1), y1 = Math.floor(height * 0.9);
  let valid = 0, nLeaf = 0, nTrunk = 0, nVeh = 0, nAny = 0;
  const cols = trunkColumns(rgba, alpha, width, height, ppm), colSet = new Set(cols);
  const box = vehicleBox(rgba, alpha, width, height);
  for (let y = y0; y < y1; y += STEP) for (let x = 0; x < width; x += STEP) {
    const p = y * width + x; if (alpha[p] !== 255) continue;
    valid++; const i = p * 4; let kind = 0;
    if (leaf(rgba[i], rgba[i + 1], rgba[i + 2])) { kind = 1; nLeaf++; }
    else if (colSet.has((x / STEP) | 0) && y >= height * 0.35 && luma(rgba, i) < 110) { kind = 2; nTrunk++; }
    else if (box && x >= box.x0 && x < box.x1 && y >= box.y0 && y < box.y1) { kind = 3; nVeh++; }
    if (kind) { nAny++; mask[p] = kind; }
  }
  const sh = (n: number) => (valid ? +(n / valid).toFixed(4) : 1);
  return { mask, maskedShare: sh(nAny), leafShare: sh(nLeaf), trunkShare: sh(nTrunk), vehicleShare: sh(nVeh), trunkColumns: cols };
}
