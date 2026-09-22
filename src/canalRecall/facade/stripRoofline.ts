/**
 * Roofline from a rectified façade strip: A2 of `ROOFLINE_FROM_PHOTOS_PLAN.md`.
 *
 * Two signals disagree in useful ways, so this uses both instead of picking
 * one. The segmentation mask (§4 label contract) is coarse but knows *what*
 * a pixel is — sky, building, tree, unknown — so it is trusted for deciding
 * whether a column has a usable roofline at all. Luminance alone can't make
 * that call: a bare winter tree against a bright sky reads exactly like a
 * roof edge to a brightness threshold. But the mask's boundary is soft
 * (Mask2Former resamples labels to a lower internal resolution than the
 * strip), so the exact row is handed to the sharpest nearby luminance
 * gradient, which a segmentation head doesn't need to get pixel-perfect for
 * its own purpose but this measurement does.
 *
 * A column abstains (`null`) rather than guessing whenever the mask can't
 * support a clean answer: the top row is already building (the strip didn't
 * clear the roof — a headroom problem, not a model problem), an occluder or
 * unknown pixel sits within 3 px of the chosen transition, or the column has
 * no sky pixels to anchor a boundary against.
 */
import { classifyRoofline, type RooflineShape } from '../../../scripts/pointcloud/measure-tile.ts';
import type { StripFrame } from './stripFrame.ts';

/** §4 label contract. */
export const LABEL = { OTHER: 0, SKY: 1, BUILDING: 2, OCCLUDER: 3, UNKNOWN: 255 } as const;

export interface Mask {
  width: number;
  height: number;
  /** One byte per pixel, row-major, §4 label values. */
  labels: Uint8Array;
}

export interface Luma {
  width: number;
  height: number;
  /** One byte per pixel, row-major, 0-255 greyscale. */
  values: Uint8Array;
}

export type BoundaryMethod = 'coarse' | 'snapped';
export type NullReason = 'clipped' | 'no-sky' | 'no-run' | 'occluder-near-transition';

export interface ColumnBoundary {
  /** Row of the chosen boundary, or null when the column abstains. */
  rowPx: number | null;
  coarsePx: number | null;
  snappedPx: number | null;
  method: BoundaryMethod | null;
  nullReason: NullReason | null;
}

/**
 * The coarse boundary: the first run of ≥ `runLength` building-labelled
 * pixels reading down a column, i.e. the topmost place the mask commits to
 * "building" after (not necessarily immediately after) sky. A run shorter
 * than `runLength` is segmentation noise and is skipped, not accepted.
 */
export function coarseColumnBoundary(
  labels: Uint8Array, width: number, height: number, x: number, runLength = 4,
): { y: number } | { nullReason: NullReason } {
  const at = (y: number) => labels[y * width + x];
  if (at(0) === LABEL.BUILDING) return { nullReason: 'clipped' };
  let sawSky = false;
  let y = 0;
  while (y < height) {
    const label = at(y);
    if (label === LABEL.SKY) { sawSky = true; y++; continue; }
    if (label === LABEL.BUILDING) {
      let end = y;
      while (end < height && at(end) === LABEL.BUILDING) end++;
      if (end - y >= runLength) return { y };
      y = end;
      continue;
    }
    // Occluder, unknown or "other": not a building run, keep scanning past it.
    y++;
  }
  return { nullReason: sawSky ? 'no-run' : 'no-sky' };
}

/**
 * Snap a coarse row to the strongest nearby luminance step, sky (bright)
 * above and building (dark) below. Searches `window` px either side; keeps
 * the coarse row if no step clears `minGradient` luma units.
 */
export function snapColumnBoundary(
  luma: Uint8Array, width: number, height: number, x: number, coarseY: number,
  { window = 8, minGradient = 14 }: { window?: number; minGradient?: number } = {},
): { y: number; method: BoundaryMethod } {
  const at = (y: number) => luma[Math.min(height - 1, Math.max(0, y)) * width + x];
  let bestY = coarseY;
  let bestGradient = -Infinity;
  const lo = Math.max(1, coarseY - window);
  const hi = Math.min(height - 1, coarseY + window);
  for (let y = lo; y <= hi; y++) {
    // Positive when row y-1 (above) is brighter than row y (below): sky-above,
    // building-below, the sign the plan requires.
    const gradient = at(y - 1) - at(y);
    if (gradient > bestGradient) { bestGradient = gradient; bestY = y; }
  }
  if (bestGradient >= minGradient) return { y: bestY, method: 'snapped' };
  return { y: coarseY, method: 'coarse' };
}

/** Does an occluder or unknown pixel sit within `marginPx` of `y` in this column? */
function occluderNearTransition(labels: Uint8Array, width: number, height: number, x: number, y: number, marginPx = 3): boolean {
  const lo = Math.max(0, y - marginPx);
  const hi = Math.min(height - 1, y + marginPx);
  for (let row = lo; row <= hi; row++) {
    const label = labels[row * width + x];
    if (label === LABEL.OCCLUDER || label === LABEL.UNKNOWN) return true;
  }
  return false;
}

/** Full per-column boundary: coarse, snap, occluder check, in that order. */
export function columnBoundary(
  mask: Mask, luma: Luma, x: number,
  opts: { runLength?: number; snapWindow?: number; minGradient?: number; occluderMarginPx?: number } = {},
): ColumnBoundary {
  const { width, height, labels } = mask;
  const coarse = coarseColumnBoundary(labels, width, height, x, opts.runLength ?? 4);
  if ('nullReason' in coarse) {
    return { rowPx: null, coarsePx: null, snappedPx: null, method: null, nullReason: coarse.nullReason };
  }
  const snapped = snapColumnBoundary(luma.values, luma.width, luma.height, x, coarse.y, {
    window: opts.snapWindow ?? 8, minGradient: opts.minGradient ?? 14,
  });
  if (occluderNearTransition(labels, width, height, x, snapped.y, opts.occluderMarginPx ?? 3)) {
    return { rowPx: null, coarsePx: coarse.y, snappedPx: snapped.y, method: snapped.method, nullReason: 'occluder-near-transition' };
  }
  return { rowPx: snapped.y, coarsePx: coarse.y, snappedPx: snapped.y, method: snapped.method, nullReason: null };
}

export interface StripBoundaries {
  coarsePx: Array<number | null>;
  snappedPx: Array<number | null>;
  /** Final chosen row per column (== snappedPx unless nulled), for frame conversion. */
  rowPx: Array<number | null>;
  nullReasons: Record<NullReason, number>;
}

/** Every column of a strip, in one pass. */
export function stripBoundaries(
  mask: Mask, luma: Luma,
  opts: { runLength?: number; snapWindow?: number; minGradient?: number; occluderMarginPx?: number } = {},
): StripBoundaries {
  const coarsePx: Array<number | null> = new Array(mask.width).fill(null);
  const snappedPx: Array<number | null> = new Array(mask.width).fill(null);
  const rowPx: Array<number | null> = new Array(mask.width).fill(null);
  const nullReasons: Record<NullReason, number> = { clipped: 0, 'no-sky': 0, 'no-run': 0, 'occluder-near-transition': 0 };
  for (let x = 0; x < mask.width; x++) {
    const column = columnBoundary(mask, luma, x, opts);
    coarsePx[x] = column.coarsePx;
    snappedPx[x] = column.snappedPx;
    rowPx[x] = column.rowPx;
    if (column.nullReason) nullReasons[column.nullReason]++;
  }
  return { coarsePx, snappedPx, rowPx, nullReasons };
}

/** Pixel row → the §3 frame: metres along the wall, absolute NAP up. */
export function pixelToWorld(frame: StripFrame, x: number, y: number): { along: number; up: number } {
  return {
    along: x / frame.pixelsPerMetreX - frame.marginM,
    up: frame.topNap - y / frame.pixelsPerMetreY,
  };
}

/**
 * Resample a per-column boundary (image pixels) onto a 0.10 m `along` grid,
 * in the §3 frame. Each bin takes the median `up` of the columns landing in
 * it; an empty bin is `null`.
 */
export function resampleProfile(
  frame: StripFrame, rowPx: Array<number | null>, sampleM = 0.10,
): Array<[number, number | null]> {
  const width = rowPx.length;
  if (width === 0) return [];
  const alongAt = (x: number) => x / frame.pixelsPerMetreX - frame.marginM;
  const firstAlong = alongAt(0);
  const lastAlong = alongAt(width - 1);
  const firstBin = Math.floor(firstAlong / sampleM);
  const lastBin = Math.ceil(lastAlong / sampleM);
  const bins = new Map<number, number[]>();
  for (let x = 0; x < width; x++) {
    const y = rowPx[x];
    if (y === null) continue;
    const bin = Math.round(alongAt(x) / sampleM);
    const list = bins.get(bin);
    if (list) list.push(y); else bins.set(bin, [y]);
  }
  const median = (values: number[]) => { const s = [...values].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };
  const profile: Array<[number, number | null]> = [];
  for (let bin = firstBin; bin <= lastBin; bin++) {
    const along = Math.round(bin * sampleM * 1e6) / 1e6;
    const rows = bins.get(bin);
    if (!rows || rows.length === 0) { profile.push([along, null]); continue; }
    const up = frame.topNap - median(rows) / frame.pixelsPerMetreY;
    profile.push([along, Math.round(up * 1000) / 1000]);
  }
  return profile;
}

/**
 * Multi-view consensus (R6, done here for strips): at each `along` sample,
 * keep the value where ≥ 2 views agree within `toleranceM` (their median);
 * otherwise `null`. A single view's profile is returned unchanged — there is
 * nothing to agree or disagree with.
 */
export function consensusProfile(
  profiles: Array<Array<[number, number | null]>>, toleranceM = 0.25, sampleM = 0.10,
): Array<[number, number | null]> {
  const usable = profiles.filter(p => p.length > 0);
  if (usable.length === 0) return [];
  if (usable.length === 1) return usable[0];
  const byAlong = new Map<number, number[]>();
  for (const profile of usable) {
    for (const [along, up] of profile) {
      if (up === null) continue;
      const key = Math.round(along / sampleM);
      const list = byAlong.get(key);
      if (list) list.push(up); else byAlong.set(key, [up]);
    }
  }
  let minKey = Infinity, maxKey = -Infinity;
  for (const profile of usable) for (const [along] of profile) {
    const key = Math.round(along / sampleM);
    if (key < minKey) minKey = key;
    if (key > maxKey) maxKey = key;
  }
  const median = (values: number[]) => { const s = [...values].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };
  const out: Array<[number, number | null]> = [];
  for (let key = minKey; key <= maxKey; key++) {
    const along = Math.round(key * sampleM * 1e6) / 1e6;
    const values = byAlong.get(key) ?? [];
    if (values.length < 2) { out.push([along, null]); continue; }
    const spread = Math.max(...values) - Math.min(...values);
    out.push([along, spread <= toleranceM ? Math.round(median(values) * 1000) / 1000 : null]);
  }
  return out;
}

/** §3 shape rule, reusing the point-cloud gold's classifier rather than a second definition. */
export function profileShape(profile: Array<[number, number | null]>): RooflineShape {
  const heights = profile.map(([, up]) => up).filter((up): up is number => up !== null);
  return classifyRoofline(heights);
}
