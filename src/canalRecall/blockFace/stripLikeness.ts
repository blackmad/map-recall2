/**
 * Structural likeness of one pand: the normalised cross-correlation (NCC) of the EDGES (gradient magnitude) of the
 * photo strip and of the model's orthographic render over the pand's body (top of the ground storey to just under the eaves), at the strip's scale.
 *
 * Why not only buildingRecipe/likeness.ts: its photo pass clusters colours into wall / glass / trim, and on an overcast
 * strip of dark brick (Hasebroekstraat 2022-01-04) the wall cluster lands on the panes, so the glazing per storey
 * reads 0.2-0.8 on identical houses. NCC compares the luminance STRUCTURE (window grid, bands, balconies) and is blind
 * to gain and offset (both images are z-scored), so exposure and the city look's lifted brick do not enter. The
 * photo's placeholder grey and foliage are masked out; the best shift within `maxShiftM` absorbs the decimetres between
 * BAG edges, 3DBAG planes and the strip's ground estimate.
 *
 * Calibration (docs/buurt-generator-20261016.md): the same pands scored with their placed type and with a wrong type.
 */
import {classifyPixel} from './stripPalette.ts';
import {isLeaf} from '../buildingRecipe/measureFacade.ts';

export interface Gray { data: Float32Array; mask: Uint8Array; width: number; height: number }

export const STRIP_LIKENESS = {
  /** Work at this many px/m (the strip is 40). */
  ppm: 20,
  maxShiftM: 0.4,
  /** Body band: from this height to `eavesM - topMarginM`. */
  bodyFromM: 3.6, topMarginM: 0.3,
  /** Box-blur radius in work pixels before correlating (kills JPEG noise and brick texture). */
  blur: 1,
  /** A placement scoring under this is held (calibration 2026-10-16: right types 0.2-0.43, wrong 0.0-0.3 on the same pands). */
  minNcc: 0.15,
  /** A challenger type scoring this much over the placed type holds the placement (the photo prefers another type). */
  challengeMargin: 0.05,
  /** Under this share of usable photo pixels the score abstains. */
  minUsable: 0.5,
} as const;

/** Luma of an RGB (3-channel) buffer region, resampled (box) to `ppm`; `photo` masks placeholder grey and foliage. */
export function grayRegion(rgb: Uint8Array, width: number, x0: number, x1: number, y0: number, y1: number, scale: number, photo: boolean): Gray {
  const W = Math.max(1, Math.floor((x1 - x0) / scale)), H = Math.max(1, Math.floor((y1 - y0) / scale));
  const data = new Float32Array(W * H), mask = new Uint8Array(W * H);
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    let s = 0, n = 0, bad = 0;
    for (let y = Math.floor(y0 + j * scale); y < Math.floor(y0 + (j + 1) * scale); y++) for (let x = Math.floor(x0 + i * scale); x < Math.floor(x0 + (i + 1) * scale); x++) {
      const k = (y * width + x) * 3, r = rgb[k], g = rgb[k + 1], b = rgb[k + 2];
      if (photo && (classifyPixel([r, g, b]) === 'void' || isLeaf(r, g, b))) { bad++; continue; }
      s += 0.299 * r + 0.587 * g + 0.114 * b; n++;
    }
    data[j * W + i] = n ? s / n : 0; mask[j * W + i] = n > bad ? 1 : 0;
  }
  return {data, mask, width: W, height: H};
}

function blur(g: Gray, r: number): Gray {
  if (r <= 0) return g;
  const out = new Float32Array(g.data.length);
  for (let j = 0; j < g.height; j++) for (let i = 0; i < g.width; i++) {
    let s = 0, n = 0;
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      const x = i + dx, y = j + dy;
      if (x < 0 || y < 0 || x >= g.width || y >= g.height || !g.mask[y * g.width + x]) continue;
      s += g.data[y * g.width + x]; n++;
    }
    out[j * g.width + i] = n ? s / n : 0;
  }
  return {...g, data: out};
}

/**
 * Gradient magnitude (central differences): window and band EDGES, whatever their polarity. A curtained or reflecting
 * pane is light on one photo and dark on the next, and the model draws every pane dark; its outline is an edge on both.
 */
export function gradient(g: Gray): Gray {
  const out = new Float32Array(g.data.length), mask = new Uint8Array(g.data.length), W = g.width;
  for (let j = 1; j < g.height - 1; j++) for (let i = 1; i < W - 1; i++) {
    const k = j * W + i;
    if (!g.mask[k] || !g.mask[k - 1] || !g.mask[k + 1] || !g.mask[k - W] || !g.mask[k + W]) continue;
    out[k] = Math.hypot(g.data[k + 1] - g.data[k - 1], g.data[k + W] - g.data[k - W]); mask[k] = 1;
  }
  return {data: out, mask, width: W, height: g.height};
}

/** NCC of `model` against `photo` (same size) at the best integer shift within `maxShift` px; usable = the share of photo pixels compared. */
export function bestNcc(photo: Gray, model: Gray, maxShift: number): {ncc: number; dx: number; dy: number; usable: number} {
  const W = Math.min(photo.width, model.width), H = Math.min(photo.height, model.height);
  let best = {ncc: -1, dx: 0, dy: 0, usable: 0};
  for (let dy = -maxShift; dy <= maxShift; dy++) for (let dx = -maxShift; dx <= maxShift; dx++) {
    let n = 0, sp = 0, sm = 0, spp = 0, smm = 0, spm = 0, total = 0;
    for (let j = maxShift; j < H - maxShift; j++) for (let i = maxShift; i < W - maxShift; i++) {
      total++;
      const q = (j + dy) * photo.width + (i + dx);
      if (!photo.mask[q] || !model.mask[j * model.width + i]) continue;
      const p = photo.data[q], m = model.data[j * model.width + i];
      n++; sp += p; sm += m; spp += p * p; smm += m * m; spm += p * m;
    }
    if (n < 50) continue;
    const cov = spm / n - (sp / n) * (sm / n), vp = spp / n - (sp / n) ** 2, vm = smm / n - (sm / n) ** 2;
    const ncc = vp > 1e-6 && vm > 1e-6 ? cov / Math.sqrt(vp * vm) : 0;
    if (ncc > best.ncc) best = {ncc, dx, dy, usable: n / Math.max(1, total)};
  }
  return {...best, ncc: +best.ncc.toFixed(3), usable: +best.usable.toFixed(2)};
}

/**
 * Body NCC of one pand span: `photoRgb` (the strip) and `modelRgb` (the ortho render, same size and frame), the span's
 * pixel columns and the eaves, at the strip's px/m.
 */
export function spanLikeness(a: {photoRgb: Uint8Array; modelRgb: Uint8Array; width: number; height: number; px: [number, number]; eavesM: number; pixelsPerMetre: number}) {
  const scale = a.pixelsPerMetre / STRIP_LIKENESS.ppm, inset = Math.round((a.px[1] - a.px[0]) * 0.04);
  const y0 = Math.max(0, Math.round(a.height - (a.eavesM - STRIP_LIKENESS.topMarginM) * a.pixelsPerMetre)), y1 = Math.round(a.height - STRIP_LIKENESS.bodyFromM * a.pixelsPerMetre);
  const x0 = a.px[0] + inset, x1 = a.px[1] - inset;
  if (y1 - y0 < 40 || x1 - x0 < 20) return {ncc: null, dx: 0, dy: 0, usable: 0, abstain: 'span too small'};
  const photo = blur(gradient(blur(grayRegion(a.photoRgb, a.width, x0, x1, y0, y1, scale, true), STRIP_LIKENESS.blur)), STRIP_LIKENESS.blur);
  const model = blur(gradient(blur(grayRegion(a.modelRgb, a.width, x0, x1, y0, y1, scale, false), STRIP_LIKENESS.blur)), STRIP_LIKENESS.blur);
  const r = bestNcc(photo, model, Math.round(STRIP_LIKENESS.maxShiftM * STRIP_LIKENESS.ppm));
  const abstain = r.usable < STRIP_LIKENESS.minUsable ? `usable photo ${Math.round(r.usable * 100)} % < ${STRIP_LIKENESS.minUsable * 100} %` : null;
  return {ncc: abstain ? null : r.ncc, nccRaw: r.ncc, dx: r.dx / STRIP_LIKENESS.ppm, dy: r.dy / STRIP_LIKENESS.ppm, usable: r.usable, abstain};
}
