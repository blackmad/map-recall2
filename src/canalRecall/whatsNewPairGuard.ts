/**
 * What's New before/after guard (user, 2026-11-22). Two failures reached the page: a "before" frame taken before the
 * world had streamed in (Openbare Handelsschool, Raamplein: empty lots, so the change looked far bigger than it was)
 * and a pair that barely differed (Nieuwe Doelenstraat 12: slightly darker brick). This module measures a pair and
 * refuses it in either case. Pure: frames are raw pixel buffers (sharp's `raw()` output), so the unit tests need no
 * browser and the e2e capture (tests/e2e/whats-new-pair.spec.ts) and the CLI (scripts/whats-new/pair-guard.ts) share it.
 *
 * Two pixel checks, each over a region given as fractions of the frame:
 *  - context (outside the target box, the part of the frame the change is not about): the share of pixels that differ
 *    between the frames, and each frame's edge density. A frame missing the streamed-in buildings has far fewer edges
 *    there than the other, and its context differs from the other's in most pixels.
 *  - target (the box the note is about): the mean per-pixel difference. Below the threshold the pair shows nothing a
 *    reader can see at gallery size.
 * The capture also records the engine's own counters (settled tiers, buildings drawn) and `engineChecks` refuses a pair
 * whose frames were not settled or whose building counts disagree: two frames that are BOTH half-loaded agree with each
 * other in pixels, so only the engine can tell (Raamplein's, Jungle's and Hans en Grietje's frames were).
 */

export interface RawImage { width: number; height: number; channels: number; data: Uint8Array }
/** Fractions of the frame, 0..1. */
export interface Box { x: number; y: number; w: number; h: number }

export const WHOLE: Box = { x: 0, y: 0, w: 1, h: 1 };

/**
 * Target mean per-pixel difference (RGB, at gallery size: `downsample`) below which a pair is "too similar to show": 3 %
 * of full scale, about 8 of 255 per channel. Calibrated 2026-11-22 on every pair of the 2026-11-21/22 notes, each with
 * the target box drawn round what the note is about: Nieuwe Doelenstraat 12 (darker brick and a few stone dots; the
 * user: "nearly identical") 2.2 %, the shop-one-room sheet's pairs 1.4-1.5 %; the faintest pairs that read at a glance,
 * the post-war grey brick facade and the Lijnbaansgracht shop windows removed, 3.5 %; landmarks and new fronts 9-23 %.
 * 3 % sits near the geometric mean of 2.2 and 3.5. OKLab ΔE (meanDeltaE) ranks the pairs the same way and separates
 * them no better, so the plain RGB mean the brief asked for stays.
 */
export const MIN_TARGET_MEAN_DIFF = 0.03;
/** A context pixel "differs" when a channel moves more than this (of 255); JPEG noise stays under ~12. */
export const PIXEL_TOL = 28;
/** Above this share of differing context pixels the two frames do not show the same surroundings. */
export const MAX_CONTEXT_CHANGED = 0.3;
/**
 * One frame's context edge density under this fraction of the other's, and at least MIN_EDGE_GAP lower in absolute
 * terms: it is missing most of the buildings. The gap keeps two nearly edge-free frames (a street of plain walls, 1.0 %
 * against 1.7 %) from tripping the ratio.
 */
export const MIN_EDGE_RATIO = 0.6;
export const MIN_EDGE_GAP = 0.02;
/** Engine counters: a frame drawing fewer than this fraction of the other's buildings is incomplete. */
export const MIN_BUILDING_RATIO = 0.8;

interface PixelBox { x0: number; y0: number; x1: number; y1: number }

const toPixels = (img: RawImage, b: Box): PixelBox => ({
  x0: Math.max(0, Math.floor(b.x * img.width)), y0: Math.max(0, Math.floor(b.y * img.height)),
  x1: Math.min(img.width, Math.ceil((b.x + b.w) * img.width)), y1: Math.min(img.height, Math.ceil((b.y + b.h) * img.height)),
});
const inside = (p: PixelBox, x: number, y: number): boolean => x >= p.x0 && x < p.x1 && y >= p.y0 && y < p.y1;

function assertSameSize(a: RawImage, b: RawImage): void {
  if (a.width !== b.width || a.height !== b.height) throw new Error(`frames differ in size: ${a.width}x${a.height} vs ${b.width}x${b.height}`);
}

const luma = (img: RawImage, x: number, y: number): number => {
  const i = (y * img.width + x) * img.channels, d = img.data;
  return img.channels >= 3 ? 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2] : d[i];
};

const lin = (v: number): number => { const c = v / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
/** sRGB 0..255 to OKLab (Ottosson 2020). */
export function oklab(r8: number, g8: number, b8: number): [number, number, number] {
  const r = lin(r8), g = lin(g8), b = lin(b8);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s];
}

/** Mean OKLab distance (ΔE) over the box: a hue or chroma change counts as much as a lightness one. */
export function meanDeltaE(a: RawImage, b: RawImage, box: Box = WHOLE): number {
  assertSameSize(a, b);
  if (a.channels < 3) return meanDiff(a, b, box);
  const p = toPixels(a, box);
  let sum = 0, n = 0;
  for (let y = p.y0; y < p.y1; y++) for (let x = p.x0; x < p.x1; x++) {
    const i = (y * a.width + x) * a.channels;
    const [l1, a1, b1] = oklab(a.data[i], a.data[i + 1], a.data[i + 2]), [l2, a2, b2] = oklab(b.data[i], b.data[i + 1], b.data[i + 2]);
    sum += Math.hypot(l1 - l2, a1 - a2, b1 - b2); n++;
  }
  return n ? sum / n : 0;
}

/** Mean of |a - b| over the box, per channel (alpha ignored), as a fraction of full scale. */
export function meanDiff(a: RawImage, b: RawImage, box: Box = WHOLE): number {
  assertSameSize(a, b);
  const p = toPixels(a, box), ch = Math.min(3, a.channels);
  let sum = 0, n = 0;
  for (let y = p.y0; y < p.y1; y++) for (let x = p.x0; x < p.x1; x++) {
    const i = (y * a.width + x) * a.channels;
    for (let c = 0; c < ch; c++) sum += Math.abs(a.data[i + c] - b.data[i + c]);
    n += ch;
  }
  return n ? sum / n / 255 : 0;
}

/** Pixels in `box` but outside `hole` (hole null: the whole box). */
function* pixelsOf(img: RawImage, box: Box, hole: Box | null): Generator<[number, number]> {
  const p = toPixels(img, box), h = hole ? toPixels(img, hole) : null;
  for (let y = p.y0; y < p.y1; y++) for (let x = p.x0; x < p.x1; x++) if (!h || !inside(h, x, y)) yield [x, y];
}

/** Share of pixels (in box, outside hole) where some channel moves more than PIXEL_TOL. */
export function changedShare(a: RawImage, b: RawImage, box: Box = WHOLE, hole: Box | null = null, tol = PIXEL_TOL): number {
  assertSameSize(a, b);
  const ch = Math.min(3, a.channels);
  let changed = 0, n = 0;
  for (const [x, y] of pixelsOf(a, box, hole)) {
    const i = (y * a.width + x) * a.channels;
    let max = 0;
    for (let c = 0; c < ch; c++) max = Math.max(max, Math.abs(a.data[i + c] - b.data[i + c]));
    if (max > tol) changed++;
    n++;
  }
  return n ? changed / n : 0;
}

/**
 * Share of pixels (in box, outside hole) on a strong edge: |dL/dx| + |dL/dy| over 40 of 255. Facade edges (windows,
 * cornices, wall corners) pass; the ground's paving and flat lots mostly do not, so a frame whose buildings have not
 * streamed in scores far lower than a settled one at the same pose.
 */
export function edgeDensity(img: RawImage, box: Box = WHOLE, hole: Box | null = null, threshold = 40): number {
  let edges = 0, n = 0;
  for (const [x, y] of pixelsOf(img, box, hole)) {
    if (x + 1 >= img.width || y + 1 >= img.height) continue;
    const l = luma(img, x, y);
    if (Math.abs(luma(img, x + 1, y) - l) + Math.abs(luma(img, x, y + 1) - l) > threshold) edges++;
    n++;
  }
  return n ? edges / n : 0;
}

export interface PairMetrics {
  targetMeanDiff: number;
  contextChanged: number | null;
  edgeBefore: number | null;
  edgeAfter: number | null;
}

/** Context = `frame` minus `target`; null when the target covers the whole frame. */
export function pairMetrics(before: RawImage, after: RawImage, target: Box = WHOLE, frame: Box = WHOLE): PairMetrics {
  const hasContext = target.w * target.h < frame.w * frame.h * 0.9;
  return {
    // Judged at gallery size (downsample): what a reader sees in the list.
    targetMeanDiff: meanDiff(downsample(before), downsample(after), target),
    contextChanged: hasContext ? changedShare(before, after, frame, target) : null,
    edgeBefore: hasContext ? edgeDensity(before, frame, target) : null,
    edgeAfter: hasContext ? edgeDensity(after, frame, target) : null,
  };
}

export type Refusal = { code: 'too-similar' | 'context-changed' | 'missing-buildings' | 'not-settled' | 'building-count'; message: string };

export interface Thresholds { minTargetMeanDiff: number; maxContextChanged: number; minEdgeRatio: number; minBuildingRatio: number }
export const DEFAULT_THRESHOLDS: Thresholds = {
  minTargetMeanDiff: MIN_TARGET_MEAN_DIFF, maxContextChanged: MAX_CONTEXT_CHANGED, minEdgeRatio: MIN_EDGE_RATIO, minBuildingRatio: MIN_BUILDING_RATIO,
};

const pct = (v: number): string => `${(v * 100).toFixed(1)} %`;

export function pixelChecks(m: PairMetrics, t: Thresholds = DEFAULT_THRESHOLDS): Refusal[] {
  const out: Refusal[] = [];
  if (m.edgeBefore != null && m.edgeAfter != null) {
    const lo = Math.min(m.edgeBefore, m.edgeAfter), hi = Math.max(m.edgeBefore, m.edgeAfter);
    if (hi > 0 && lo / hi < t.minEdgeRatio && hi - lo >= MIN_EDGE_GAP) {
      const which = m.edgeBefore < m.edgeAfter ? 'before' : 'after';
      out.push({ code: 'missing-buildings', message: `the ${which} frame's surroundings have ${pct(lo / hi)} of the other's edges (under ${pct(t.minEdgeRatio)}): it is missing buildings (unsettled world?)` });
    }
  }
  if (m.contextChanged != null && m.contextChanged > t.maxContextChanged) {
    out.push({ code: 'context-changed', message: `${pct(m.contextChanged)} of the surroundings differ (over ${pct(t.maxContextChanged)}): the frames do not show the same world or pose` });
  }
  if (m.targetMeanDiff < t.minTargetMeanDiff) {
    out.push({ code: 'too-similar', message: `target mean difference ${pct(m.targetMeanDiff)} (under ${pct(t.minTargetMeanDiff)}): the change is too small to see` });
  }
  return out;
}

/** What the capture reads from the page after settling (tests/e2e/whats-new-pair.spec.ts). */
export interface EngineState { settled: boolean; pending: string[]; buildings: number | null }

export function engineChecks(before: EngineState, after: EngineState, t: Thresholds = DEFAULT_THRESHOLDS): Refusal[] {
  const out: Refusal[] = [];
  for (const [name, s] of [['before', before], ['after', after]] as const) {
    if (!s.settled || s.pending.length) out.push({ code: 'not-settled', message: `the ${name} frame was taken before the world settled (pending: ${s.pending.join(', ') || 'tiers'})` });
  }
  if (before.buildings != null && after.buildings != null) {
    const lo = Math.min(before.buildings, after.buildings), hi = Math.max(before.buildings, after.buildings);
    if (hi > 0 && lo / hi < t.minBuildingRatio) {
      const which = before.buildings < after.buildings ? 'before' : 'after';
      out.push({ code: 'building-count', message: `the ${which} frame drew ${lo} buildings against ${hi} (under ${pct(t.minBuildingRatio)})` });
    }
  }
  return out;
}

/** Splits a side-by-side composite into `panels` equal columns (or rows) separated by `gutter` px. */
export function splitPanels(img: RawImage, panels: number, gutter: number, vertical = false): RawImage[] {
  const along = vertical ? img.height : img.width;
  const size = Math.floor((along - gutter * (panels - 1)) / panels);
  const out: RawImage[] = [];
  for (let k = 0; k < panels; k++) {
    const off = k * (size + gutter);
    const w = vertical ? img.width : size, h = vertical ? size : img.height;
    const data = new Uint8Array(w * h * img.channels);
    for (let y = 0; y < h; y++) {
      const sy = vertical ? off + y : y, sx = vertical ? 0 : off;
      const from = (sy * img.width + sx) * img.channels;
      data.set(img.data.subarray(from, from + w * img.channels), y * w * img.channels);
    }
    out.push({ width: w, height: h, channels: img.channels, data });
  }
  return out;
}

/**
 * Panels of a composed sheet, found from its gutters: runs of columns (rows, when `vertical`) whose luma barely varies
 * along the whole height. Panels narrower than `minPanel` of the sheet (caption bands, slivers) are dropped. A sheet's
 * gutter width changes when it is scaled down, so equal splitting misaligns the halves by a few pixels, and a few pixels
 * of misalignment reads as a change on every edge.
 */
export function detectPanels(img: RawImage, vertical = false, maxStd = 4, minPanel = 0.15): RawImage[] {
  const along = vertical ? img.height : img.width, across = vertical ? img.width : img.height;
  const uniform: boolean[] = [];
  for (let k = 0; k < along; k++) {
    let s = 0, s2 = 0;
    for (let j = 0; j < across; j++) { const l = vertical ? luma(img, j, k) : luma(img, k, j); s += l; s2 += l * l; }
    const mean = s / across;
    uniform.push(Math.sqrt(Math.max(0, s2 / across - mean * mean)) <= maxStd);
  }
  const spans: Array<[number, number]> = [];
  let start = -1;
  for (let k = 0; k <= along; k++) {
    const content = k < along && !uniform[k];
    if (content && start < 0) start = k;
    if (!content && start >= 0) { if (k - start >= minPanel * along) spans.push([start, k]); start = -1; }
  }
  const size = Math.min(...spans.map(([a, b]) => b - a));
  return spans.map(([a]) => {
    const w = vertical ? img.width : size, h = vertical ? size : img.height;
    const data = new Uint8Array(w * h * img.channels);
    for (let y = 0; y < h; y++) {
      const sy = vertical ? a + y : y, sx = vertical ? 0 : a;
      const from = (sy * img.width + sx) * img.channels;
      data.set(img.data.subarray(from, from + w * img.channels), y * w * img.channels);
    }
    return { width: w, height: h, channels: img.channels, data };
  });
}

/**
 * The What's New page shows each shot 260 CSS px wide (whats-new.html `.changes .shots img`). A change is judged at that
 * size: box-average the frame down to `width` first, so brick texture, stone dots and sub-pixel shifts average out and
 * what is left is what a reader sees in the list before opening the lightbox.
 */
export const GALLERY_WIDTH = 260;
export function downsample(img: RawImage, width = GALLERY_WIDTH): RawImage {
  if (img.width <= width) return img;
  const height = Math.max(1, Math.round(img.height * width / img.width)), ch = img.channels;
  const data = new Uint8Array(width * height * ch);
  for (let y = 0; y < height; y++) {
    const sy0 = Math.floor(y * img.height / height), sy1 = Math.max(sy0 + 1, Math.floor((y + 1) * img.height / height));
    for (let x = 0; x < width; x++) {
      const sx0 = Math.floor(x * img.width / width), sx1 = Math.max(sx0 + 1, Math.floor((x + 1) * img.width / width));
      for (let c = 0; c < ch; c++) {
        let s = 0;
        for (let sy = sy0; sy < sy1; sy++) for (let sx = sx0; sx < sx1; sx++) s += img.data[(sy * img.width + sx) * ch + c];
        data[(y * width + x) * ch + c] = Math.round(s / ((sy1 - sy0) * (sx1 - sx0)));
      }
    }
  }
  return { width, height, channels: ch, data };
}
