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
 * unknown pixel sits within 3 px of the chosen transition, the column has no
 * sky pixels to anchor a boundary against, or anything other than sky sits
 * above the chosen transition (see `coarseColumnBoundary` below).
 *
 * That last rule exists because of a failure the first version of this module
 * had: a winter tree in front of a roofline is not a solid occluder block, it
 * is *mostly* sky with the canopy's silhouette mixed in, and a window several
 * storeys down can show a sky reflection that also reads as "sky" to the
 * model. Scanning down a column and taking the first run of ≥4 building
 * pixels after what *looked* like open sky would walk straight through the
 * canopy — reading its gaps as open sky and its branches as too short a
 * "building" run to count — and land on a solid building run at a window
 * frame, metres below the real roof. The fix is not to trust "sky" as a
 * floor; it must be *unbroken* sky from the strip's own top row down to the
 * boundary (a small tolerance for mask speckle right at the edge itself),
 * or the column abstains rather than reporting a confident, wrong, low line.
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
export type NullReason =
  | 'clipped' | 'no-sky' | 'no-run' | 'occluder-near-transition'
  | 'not-open-sky-above' | 'below-3dbag-eave' | 'above-3dbag-max';

export const NULL_REASONS: readonly NullReason[] = [
  'clipped', 'no-sky', 'no-run', 'occluder-near-transition', 'not-open-sky-above', 'below-3dbag-eave', 'above-3dbag-max',
];

export function emptyNullReasonTotals(): Record<NullReason, number> {
  return {
    clipped: 0, 'no-sky': 0, 'no-run': 0, 'occluder-near-transition': 0,
    'not-open-sky-above': 0, 'below-3dbag-eave': 0, 'above-3dbag-max': 0,
  };
}

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
 * "building" after (not necessarily immediately after) sky — *provisionally*.
 *
 * The candidate is then held to "only open sky above it": every pixel from
 * row 0 to the candidate (minus a small `openSkyToleranceAbovePx` right at
 * the edge, for ordinary mask speckle at the soft boundary) must be sky. Any
 * building, occluder, unknown or "other" pixel further up — a tree canopy, a
 * neighbour's roof, a stray mislabel — disqualifies the candidate outright:
 * the scan does not fall back to continuing past it in search of a later run,
 * because a later run found *underneath* an obstruction is exactly the false
 * low roofline this rule exists to prevent (see the module doc).
 */
export function coarseColumnBoundary(
  labels: Uint8Array, width: number, height: number, x: number,
  runLength = 4, openSkyToleranceAbovePx = 2,
): { y: number } | { nullReason: NullReason } {
  const at = (y: number) => labels[y * width + x];
  if (at(0) === LABEL.BUILDING) return { nullReason: 'clipped' };
  let sawSky = false;
  let candidate: number | null = null;
  let y = 0;
  while (y < height) {
    const label = at(y);
    if (label === LABEL.SKY) { sawSky = true; y++; continue; }
    if (label === LABEL.BUILDING) {
      let end = y;
      while (end < height && at(end) === LABEL.BUILDING) end++;
      if (end - y >= runLength) { candidate = y; break; }
      y = end;
      continue;
    }
    // Occluder, unknown or "other": not a building run, keep scanning past it
    // to find where the provisional candidate would be.
    y++;
  }
  if (candidate === null) return { nullReason: sawSky ? 'no-run' : 'no-sky' };
  for (let row = 0; row < candidate; row++) {
    if (at(row) === LABEL.SKY) continue;
    if (candidate - row <= openSkyToleranceAbovePx) continue; // speckle right at the edge
    return { nullReason: 'not-open-sky-above' };
  }
  return { y: candidate };
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
  const nullReasons = emptyNullReasonTotals();
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
 * The 3DBAG plausibility gate: a column whose resolved `up` falls more than
 * `marginM` below the matched LoD2.2 wall surface's own eave is rejected. A
 * roofline below its own building's known eave height is not a gable or a
 * cornice above the eave (what this measures) — it is the same false-low
 * failure `coarseColumnBoundary`'s purity rule targets, caught here by an
 * independent, model-free signal for the columns that rule doesn't reach.
 */
export function applyEaveGate(
  frame: StripFrame, rowPx: Array<number | null>, eaveNap: number, marginM = 1.0,
): { rowPx: Array<number | null>; gated: number } {
  const gated: Array<number | null> = rowPx.slice();
  let gatedCount = 0;
  for (let x = 0; x < gated.length; x++) {
    const y = gated[x];
    if (y === null) continue;
    const { up } = pixelToWorld(frame, x, y);
    if (up < eaveNap - marginM) { gated[x] = null; gatedCount++; }
  }
  return { rowPx: gated, gated: gatedCount };
}

/**
 * The upper counterpart of `applyEaveGate`: a column whose `up` sits more
 * than `marginM` *above* the pand's own airborne-lidar roof max
 * (`b3_h_dak_max`) is rejected. Airborne lidar sees the tops of gables, so a
 * genuine roofline should not exceed it by much; a column that does is more
 * likely a taller neighbour, a chimney or a rear roof projecting onto the
 * wall plane than an actual part of this wall's own roof.
 *
 * Unlike `applyEaveGate`, this operates on a metre-space profile (`along`,
 * `up`) rather than one view's own pixel rows, because it is meant to run
 * *after* per-view bias alignment — the integrator's diagnostic compares the
 * gate's effect before and after alignment, which only makes sense once both
 * are expressed on the same metre scale.
 */
export function applyRoofMaxGate(
  profile: Array<[number, number | null]>, roofMaxNap: number, marginM = 1.0,
): { profile: Array<[number, number | null]>; gated: number } {
  let gatedCount = 0;
  const out: Array<[number, number | null]> = profile.map(([along, up]) => {
    if (up !== null && up > roofMaxNap + marginM) { gatedCount++; return [along, null]; }
    return [along, up];
  });
  return { profile: out, gated: gatedCount };
}

/** Median of `up - referenceNap` over a profile's resolved samples, or null if none resolve. */
export function medianOffset(profile: Array<[number, number | null]>, referenceNap: number): number | null {
  const diffs = profile.map(([, up]) => up).filter((u): u is number => u !== null).map(u => u - referenceNap);
  if (diffs.length === 0) return null;
  const sorted = [...diffs].sort((a, b) => a - b);
  return Math.round(sorted[Math.floor(sorted.length / 2)] * 1000) / 1000;
}

/**
 * Convert a final consensus profile back into one view's own pixel rows, for
 * drawing on that view's own photo.
 *
 * `consensus` is expressed in the REFERENCE view's datum: `estimateViewBias`/
 * `applyViewBias` shift every usable view's profile by `up - biasM` before
 * consensus, so consensus already lives on the reference view's own scale.
 * A non-reference view's own photo is still in its own, unshifted scale, so
 * drawing the consensus on it must undo that shift first: `viewBiasM` is
 * *this* view's own offset from the reference (what `applyViewBias`
 * subtracted to align it), so adding it back recovers this view's own NAP
 * before converting to its own pixel rows. For the reference view itself
 * `viewBiasM` is 0, so this is a no-op there.
 */
export function consensusToViewPx(
  frame: StripFrame, consensus: Array<[number, number | null]>, width: number, viewBiasM = 0, sampleM = 0.10,
): Array<number | null> {
  const byKey = new Map<number, number | null>();
  for (const [along, up] of consensus) byKey.set(Math.round(along / sampleM), up);
  const out: Array<number | null> = new Array(width).fill(null);
  for (let x = 0; x < width; x++) {
    const along = x / frame.pixelsPerMetreX - frame.marginM;
    const up = byKey.get(Math.round(along / sampleM));
    out[x] = up == null ? null : (frame.topNap - (up + viewBiasM)) * frame.pixelsPerMetreY;
  }
  return out;
}

export type ColumnProvenance = 'own' | 'filled';

/**
 * Per drawn consensus column (matched by `along`, not by pixel — see
 * `consensusProvenancePx` for the pixel-column version this feeds): whether
 * the given view's own (gated, pre-alignment) profile resolved that column
 * itself (`'own'`), or the drawn value came only from another view
 * (`'filled'` — including the single-view-consensus carve-out, where exactly
 * one *other* view supplied it), or the column isn't drawn at all
 * (`consensus` itself null there, returned as `null`).
 *
 * This exists because a view's own null columns still get a consensus value
 * whenever another view (or the single-view carve-out) resolved them, and
 * drawing that value on THIS view's photo with no distinction looks like the
 * line is "drawing all the outlines at once" — a real grading hazard the
 * owner hit that a bias fix alone does not address.
 */
export function consensusProvenance(
  consensus: Array<[number, number | null]>, ownProfile: Array<[number, number | null]>, sampleM = 0.10,
): Array<ColumnProvenance | null> {
  const ownByKey = new Map<number, number | null>();
  for (const [along, up] of ownProfile) ownByKey.set(Math.round(along / sampleM), up);
  return consensus.map(([along, up]) => {
    if (up === null) return null;
    const own = ownByKey.get(Math.round(along / sampleM));
    return own != null ? 'own' : 'filled';
  });
}

/** The pixel-column version of `consensusProvenance`, in one view's own frame, for drawing. */
export function consensusProvenancePx(
  frame: StripFrame, consensus: Array<[number, number | null]>, ownProfile: Array<[number, number | null]>, width: number, sampleM = 0.10,
): Array<ColumnProvenance | null> {
  const consensusByKey = new Map<number, number | null>();
  for (const [along, up] of consensus) consensusByKey.set(Math.round(along / sampleM), up);
  const ownByKey = new Map<number, number | null>();
  for (const [along, up] of ownProfile) ownByKey.set(Math.round(along / sampleM), up);
  const out: Array<ColumnProvenance | null> = new Array(width).fill(null);
  for (let x = 0; x < width; x++) {
    const key = Math.round((x / frame.pixelsPerMetreX - frame.marginM) / sampleM);
    const up = consensusByKey.get(key);
    if (up == null) continue;
    const own = ownByKey.get(key);
    out[x] = own != null ? 'own' : 'filled';
  }
  return out;
}

/**
 * Fraction of a view's DRAWN consensus columns (`'own'` + `'filled'`) that
 * were `'filled'` — the view did not resolve them itself. Null when nothing
 * is drawn for this view at all (not 0: "nothing drawn" and "everything
 * self-resolved" are different findings).
 */
export function unresolvedFraction(provenance: Array<ColumnProvenance | null>): number | null {
  const drawn = provenance.filter((p): p is ColumnProvenance => p !== null);
  if (drawn.length === 0) return null;
  const filled = drawn.filter(p => p === 'filled').length;
  return Math.round((filled / drawn.length) * 1000) / 1000;
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

export interface ConsensusResult {
  profile: Array<[number, number | null]>;
  /** Parallel to `profile`: true where exactly one view resolved that sample. */
  singleView: boolean[];
}

/**
 * Multi-view consensus (R6, done here for strips): at each `along` sample,
 *
 * - 0 views resolve it: `null`.
 * - exactly 1 view resolves it: kept, flagged `singleView: true` — there is
 *   nothing to disagree with, and a strip is expensive enough that discarding
 *   its only measurement of a column is not free.
 * - ≥ 2 views resolve it: kept as their median when they agree within
 *   `toleranceM`, otherwise `null` — they disagree, and averaging in an
 *   outlier would hide that rather than report it honestly.
 */
export function consensusProfile(
  profiles: Array<Array<[number, number | null]>>, toleranceM = 0.25, sampleM = 0.10,
): ConsensusResult {
  const usable = profiles.filter(p => p.length > 0);
  if (usable.length === 0) return { profile: [], singleView: [] };
  const byAlong = new Map<number, number[]>();
  let minKey = Infinity, maxKey = -Infinity;
  for (const profile of usable) {
    for (const [along, up] of profile) {
      const key = Math.round(along / sampleM);
      if (key < minKey) minKey = key;
      if (key > maxKey) maxKey = key;
      if (up === null) continue;
      const list = byAlong.get(key);
      if (list) list.push(up); else byAlong.set(key, [up]);
    }
  }
  const median = (values: number[]) => { const s = [...values].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };
  const profile: Array<[number, number | null]> = [];
  const singleView: boolean[] = [];
  for (let key = minKey; key <= maxKey; key++) {
    const along = Math.round(key * sampleM * 1e6) / 1e6;
    const values = byAlong.get(key) ?? [];
    if (values.length === 0) { profile.push([along, null]); singleView.push(false); continue; }
    if (values.length === 1) { profile.push([along, Math.round(values[0] * 1000) / 1000]); singleView.push(true); continue; }
    const spread = Math.max(...values) - Math.min(...values);
    profile.push([along, spread <= toleranceM ? Math.round(median(values) * 1000) / 1000 : null]);
    singleView.push(false);
  }
  return { profile, singleView };
}

/** §3 shape rule, reusing the point-cloud gold's classifier rather than a second definition. */
export function profileShape(profile: Array<[number, number | null]>): RooflineShape {
  const heights = profile.map(([, up]) => up).filter((up): up is number => up !== null);
  return classifyRoofline(heights);
}

export interface ViewAlignment {
  /** Parallel to the input profiles; the reference view's own is always 0. */
  biasesM: number[];
  referenceIndex: number;
}

/**
 * Per-view vertical bias, estimated *before* consensus.
 *
 * A strip's absolute NAP comes from the wall frame the generator recorded for
 * that one view — its own lens height, its own render. Two views of the same
 * wall can therefore agree on the roofline's *shape* while disagreeing on its
 * *height* by more than the 0.25 m consensus tolerance, and the naive
 * consensus rule then reads that as the views disagreeing about the roofline
 * itself, nulling almost everything, when what actually disagrees is the
 * datum. The fix is to measure that offset directly — the median difference
 * between two views' `up` values at the columns where both resolve — and
 * shift every other view onto one reference view's own scale before the
 * agreement test ever runs.
 *
 * The reference is the view with the most resolved columns (the most
 * evidence to align everyone else onto), except with exactly 3 views, where
 * the view whose own median height sits between the other two is used
 * instead — the view most resolved is not necessarily the one least likely
 * to itself be the outlier, and the middle of three is a cheap, honest guard
 * against picking an outlier as the datum.
 */
export function estimateViewBias(
  profiles: Array<Array<[number, number | null]>>, sampleM = 0.10, minOverlapColumns = 3,
): ViewAlignment {
  const n = profiles.length;
  if (n === 0) return { biasesM: [], referenceIndex: -1 };
  if (n === 1) return { biasesM: [0], referenceIndex: 0 };
  const median = (values: number[]) => { const s = [...values].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };
  const resolvedCounts = profiles.map(p => p.filter(([, up]) => up !== null).length);

  let referenceIndex: number;
  if (n === 3) {
    const ownMedians = profiles.map((p) => {
      const ups = p.map(([, up]) => up).filter((u): u is number => u !== null);
      return ups.length ? median(ups) : null;
    });
    const withIndex = ownMedians
      .map((m, i) => ({ m, i }))
      .filter((v): v is { m: number; i: number } => v.m !== null);
    referenceIndex = withIndex.length === 3
      ? [...withIndex].sort((a, b) => a.m - b.m)[1].i
      : resolvedCounts.indexOf(Math.max(...resolvedCounts));
  } else {
    referenceIndex = resolvedCounts.indexOf(Math.max(...resolvedCounts));
  }

  const refByKey = new Map<number, number>();
  for (const [along, up] of profiles[referenceIndex]) {
    if (up === null) continue;
    refByKey.set(Math.round(along / sampleM), up);
  }
  const biasesM = profiles.map((profile, i) => {
    if (i === referenceIndex) return 0;
    const diffs: number[] = [];
    for (const [along, up] of profile) {
      if (up === null) continue;
      const refUp = refByKey.get(Math.round(along / sampleM));
      if (refUp === undefined) continue;
      diffs.push(up - refUp);
    }
    if (diffs.length < minOverlapColumns) return 0; // not enough overlap to trust an estimate
    return Math.round(median(diffs) * 1000) / 1000;
  });
  return { biasesM, referenceIndex };
}

/** Shift a profile's `up` values by `-biasM`, onto the reference view's own scale. */
export function applyViewBias(profile: Array<[number, number | null]>, biasM: number): Array<[number, number | null]> {
  if (biasM === 0) return profile;
  return profile.map(([along, up]) => [along, up === null ? null : Math.round((up - biasM) * 1000) / 1000]);
}

export interface SkyRescueResult {
  labels: Uint8Array;
  /** Fraction of the image's pixels that changed from a non-sky label to sky. */
  rescuedSkyFraction: number;
}

/**
 * Recover sky the segmentation model mislabelled as vegetation/other/unknown
 * under flat, overcast light.
 *
 * Mask2Former's occluder class is meant for vegetation, poles, wires — things
 * with texture. A featureless white overcast sky has none, and on the strips
 * this affects it isn't *slightly* wrong, it is confidently wrong across
 * nearly the whole sky region (one wall measured 99% of its top rows labelled
 * occluder against 2.9% sky). `coarseColumnBoundary`'s purity rule then
 * abstains almost every column, correctly by its own logic — there really is
 * "occluder" between the top row and the roofline — but for the wrong reason.
 *
 * This is a targeted rescue, not a re-segmentation: a pixel labelled occluder,
 * other or unknown is treated as sky only when it is bright and smooth
 * (`luma >= brightLuma` and a local 5×5 standard deviation below `maxStd`)
 * *and* reachable from the strip's own top row through other sky-or-rescued
 * pixels (4-connected). The connectivity requirement is what keeps a bare
 * branch an occluder rather than a rescued gap: a branch is dark and
 * high-variance so it is never itself rescued, and it is what blocks the
 * flood fill from reaching a bright, smooth surface that only *looks* like
 * sky but sits below the roofline (a rendered wall in flat light) — that
 * surface is never connected to the top edge through sky, so it stays as it
 * was. Building pixels are always a hard stop, rescued or not.
 *
 * The original mask on disk is untouched; this returns a new label array for
 * `coarseColumnBoundary` etc. to use instead.
 */
export function rescueSky(
  mask: Mask, luma: Luma,
  { brightLuma = 140, maxStd = 6, windowRadius = 2 }: { brightLuma?: number; maxStd?: number; windowRadius?: number } = {},
): SkyRescueResult {
  const { width, height, labels } = mask;
  if (luma.width !== width || luma.height !== height) throw new Error('rescueSky: mask and luma dimensions do not match');
  const w1 = width + 1;
  // Integral images (sum, sum of squares) for an O(1) windowed mean/variance.
  const sum = new Float64Array(w1 * (height + 1));
  const sumSq = new Float64Array(w1 * (height + 1));
  for (let y = 0; y < height; y++) {
    let rowSum = 0, rowSumSq = 0;
    for (let x = 0; x < width; x++) {
      const v = luma.values[y * width + x];
      rowSum += v; rowSumSq += v * v;
      const idx = (y + 1) * w1 + (x + 1);
      sum[idx] = sum[idx - w1] + rowSum;
      sumSq[idx] = sumSq[idx - w1] + rowSumSq;
    }
  }
  const windowStats = (cx: number, cy: number) => {
    const x0 = Math.max(0, cx - windowRadius), y0 = Math.max(0, cy - windowRadius);
    const x1 = Math.min(width - 1, cx + windowRadius), y1 = Math.min(height - 1, cy + windowRadius);
    const count = (x1 - x0 + 1) * (y1 - y0 + 1);
    const a = y0 * w1 + x0, b = y0 * w1 + (x1 + 1), c = (y1 + 1) * w1 + x0, d = (y1 + 1) * w1 + (x1 + 1);
    const s = sum[d] - sum[b] - sum[c] + sum[a];
    const sq = sumSq[d] - sumSq[b] - sumSq[c] + sumSq[a];
    const mean = s / count;
    return { mean, std: Math.sqrt(Math.max(0, sq / count - mean * mean)) };
  };
  const isBrightSmooth = (x: number, y: number) => {
    const { mean, std } = windowStats(x, y);
    return mean >= brightLuma && std < maxStd;
  };
  const skyLike = (x: number, y: number) => {
    const label = labels[y * width + x];
    if (label === LABEL.SKY) return true;
    if (label === LABEL.BUILDING) return false;
    return isBrightSmooth(x, y);
  };

  const rescued = Uint8Array.from(labels);
  const visited = new Uint8Array(width * height);
  const queue: number[] = [];
  for (let x = 0; x < width; x++) {
    if (skyLike(x, 0)) { visited[x] = 1; queue.push(x); }
  }
  let head = 0;
  while (head < queue.length) {
    const idx = queue[head++];
    rescued[idx] = LABEL.SKY;
    const x = idx % width, y = (idx / width) | 0;
    const neighbours: Array<[number, number]> = [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]];
    for (const [nx, ny] of neighbours) {
      if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
      const nIdx = ny * width + nx;
      if (visited[nIdx]) continue;
      if (!skyLike(nx, ny)) continue;
      visited[nIdx] = 1;
      queue.push(nIdx);
    }
  }
  let rescuedCount = 0;
  for (let i = 0; i < labels.length; i++) if (labels[i] !== LABEL.SKY && rescued[i] === LABEL.SKY) rescuedCount++;
  return { labels: rescued, rescuedSkyFraction: rescuedCount / labels.length };
}
