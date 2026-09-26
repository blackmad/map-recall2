/**
 * Fitting a parametric gable template to a measured roofline.
 *
 * `gable.ts` names the type from a silhouette (`classifyGable`); this module
 * takes that type and the roofline profile it was named from (§3 frame:
 * `along` metres from the wall's `start`, `up` absolute NAP metres, sampled
 * every 0.10 m, `null` where the column is unmeasured) and fits the type's
 * template by least squares on the non-null columns. A clean low-poly
 * template beats a noisy polyline at game distance — G1 attaches the result
 * as a gable screen — but a template is only kept when it actually beats a
 * generic Douglas–Peucker polyline by a real margin; otherwise the polyline
 * is the honest answer.
 *
 * Every template is symmetric in practice, so when one side of the profile
 * is entirely occluded (`null`) it is completed by mirroring the measured
 * side. A measured asymmetry is never overwritten: mirroring only fills
 * columns that are actually null.
 */

import type { GableType } from './gable.ts';
import { simplifyPolyline } from './pointCloudGeometry.ts';

export type GableProfileSample = readonly [number, number | null];

export interface GableFitInput {
  /** §3-frame samples: (along metres, up NAP metres or null), sampled every `sampleM`. */
  profile: readonly GableProfileSample[];
  type: GableType;
  /** Metres per sample. Only used to size the flank window for the eave estimate. Default 0.10. */
  sampleM?: number;
  /** Douglas–Peucker tolerance for the fallback polyline, in metres. Default 0.15. */
  polylineToleranceM?: number;
}

export type GableFitMethod = 'template' | 'polyline';

export interface GableFitResult {
  type: GableType;
  method: GableFitMethod;
  /** Closed (along, up) outline: first point repeats as the last. */
  outline: Array<readonly [number, number]>;
  /**
   * The open trace this outline was closed from: left base point to right
   * base point, without the synthetic closing corners `closeOutline` adds
   * when the trace's own ends aren't already at its minimum height. Consumers
   * that want "the roofline shape" rather than "a simple closed polygon" (for
   * example G1's gable screen, whose top must follow the actual measured or
   * fitted rise, not an artificial drop back to the outline's own floor) should
   * use this instead of `outline`.
   */
  trace: Array<readonly [number, number]>;
  /** Fitted template parameters, or null when the polyline fallback was used. */
  params: Record<string, number> | null;
  /** RMS error of the chosen fit against the non-null columns, in metres. */
  fitErrorM: number;
  /** RMS error of the Douglas–Peucker fallback, for comparison (always computed). */
  polylineErrorM: number;
  /** Which side, if any, was completed by mirroring the other side. */
  mirroredSide: 'left' | 'right' | null;
  /** The estimated eaves level the template's base sits on, absolute NAP metres. */
  eaveUp: number;
}

const mean = (values: readonly number[]) => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0);
const median = (values: readonly number[]) => {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
};

/** Fraction of samples in a slice whose `up` is null. */
const nullFraction = (slice: readonly GableProfileSample[]) =>
  slice.length ? slice.filter((s) => s[1] == null).length / slice.length : 1;

/**
 * Complete an occluded side by mirroring the other side, only where the
 * occluded side is actually null. Occlusion is judged over each half of the
 * profile (split at its midpoint index): one half must be mostly null (>60%)
 * and the other mostly measured (<40% null) for mirroring to apply.
 */
function fillOcclusion(profile: readonly GableProfileSample[]): {
  profile: Array<[number, number | null]>;
  mirroredSide: 'left' | 'right' | null;
} {
  const n = profile.length;
  const filled: Array<[number, number | null]> = profile.map((s) => [s[0], s[1]]);
  if (n < 4) return { profile: filled, mirroredSide: null };

  const mid = Math.floor(n / 2);
  const leftNull = nullFraction(profile.slice(0, mid));
  const rightNull = nullFraction(profile.slice(n - mid));

  let side: 'left' | 'right' | null = null;
  if (leftNull > 0.6 && rightNull < 0.4) side = 'left';
  else if (rightNull > 0.6 && leftNull < 0.4) side = 'right';
  if (!side) return { profile: filled, mirroredSide: null };

  for (let i = 0; i < n; i += 1) {
    if (filled[i][1] != null) continue;
    const mirrorIndex = n - 1 - i;
    const mirrorValue = profile[mirrorIndex]?.[1];
    if (mirrorValue != null) filled[i][1] = mirrorValue;
  }
  return { profile: filled, mirroredSide: side };
}

/** Median of the outer flanks (the parts of a gable that sit on the party walls). */
function estimateEaves(profile: readonly (readonly [number, number | null])[]): number {
  const n = profile.length;
  const flankCount = Math.max(1, Math.floor(n / 8));
  const flank = [...profile.slice(0, flankCount), ...profile.slice(n - flankCount)]
    .map((s) => s[1])
    .filter((v): v is number => v != null);
  if (flank.length) return median(flank);
  const all = profile.map((s) => s[1]).filter((v): v is number => v != null);
  return all.length ? median(all) : 0;
}

type NonNullSample = readonly [number, number];

const rmsError = (points: readonly NonNullSample[], predict: (along: number) => number) => {
  if (!points.length) return 0;
  const sse = points.reduce((sum, [along, up]) => sum + (up - predict(along)) ** 2, 0);
  return Math.sqrt(sse / points.length);
};

const interpolatePolyline = (points: readonly (readonly [number, number])[], along: number): number => {
  if (!points.length) return 0;
  if (points.length === 1) return points[0][1];
  if (along <= points[0][0]) return points[0][1];
  if (along >= points[points.length - 1][0]) return points[points.length - 1][1];
  for (let i = 1; i < points.length; i += 1) {
    const [a0, u0] = points[i - 1];
    const [a1, u1] = points[i];
    if (along <= a1) {
      const t = a1 === a0 ? 0 : (along - a0) / (a1 - a0);
      return u0 + t * (u1 - u0);
    }
  }
  return points[points.length - 1][1];
};

interface TemplateFit {
  params: Record<string, number>;
  predict: (along: number) => number;
  /** Open trace from the left base point to the right base point. */
  trace: Array<[number, number]>;
}

// --- lijstgevel: a flat cornice, with an optional raised parapet plateau ---
// The parapet's along-range is found by a sliding-window least-squares search
// (a two-level piecewise-constant fit) rather than a fixed height threshold:
// a threshold close in height to the noise floor fragments a true plateau
// into many short runs.
function fitLijstgevel(points: readonly NonNullSample[], start: number, end: number, eaveUp: number): TemplateFit | null {
  if (points.length < 3) return null;
  const width = end - start;
  const baseUpAll = mean(points.map((p) => p[1]));
  const noParapetSse = points.reduce((sum, [, val]) => sum + (val - baseUpAll) ** 2, 0);

  const steps = 20;
  let parapet: { start: number; end: number; up: number; baseUp: number; sse: number } | null = null;
  for (let si = 0; si <= steps; si += 1) {
    const windowStart = start + (si / steps) * width;
    for (let ei = si + 1; ei <= steps; ei += 1) {
      const windowEnd = start + (ei / steps) * width;
      const windowWidth = windowEnd - windowStart;
      if (windowWidth < width * 0.1 || windowWidth > width * 0.8) continue;
      const inside: number[] = [];
      const outside: number[] = [];
      for (const [along, val] of points) (along >= windowStart && along <= windowEnd ? inside : outside).push(val);
      if (inside.length < 2 || outside.length < 2) continue;
      const insideUp = mean(inside);
      const outsideUp = mean(outside);
      let sse = 0;
      for (const [along, val] of points) {
        const pred = along >= windowStart && along <= windowEnd ? insideUp : outsideUp;
        sse += (val - pred) ** 2;
      }
      if (!parapet || sse < parapet.sse) parapet = { start: windowStart, end: windowEnd, up: insideUp, baseUp: outsideUp, sse };
    }
  }
  // Only keep the parapet if it earns its keep over a plain flat line.
  const baseUp = parapet && parapet.sse < noParapetSse * 0.7 && parapet.up > parapet.baseUp + 0.05 ? parapet.baseUp : baseUpAll;
  if (!parapet || parapet.sse >= noParapetSse * 0.7 || parapet.up <= parapet.baseUp + 0.05) parapet = null;

  const predict = (along: number) => (parapet && along >= parapet.start && along <= parapet.end ? parapet.up : baseUp);
  const params: Record<string, number> = parapet
    ? { baseUp, parapetUp: parapet.up, parapetStartAlong: parapet.start, parapetEndAlong: parapet.end }
    : { baseUp };
  const trace: Array<[number, number]> = parapet
    ? [
        [start, baseUp],
        [parapet.start, baseUp],
        [parapet.start, parapet.up],
        [parapet.end, parapet.up],
        [parapet.end, baseUp],
        [end, baseUp],
      ]
    : [
        [start, baseUp],
        [end, baseUp],
      ];
  return { params, predict, trace };
}

// --- puntgevel / tuitgevel: a single symmetric triangle (apex and eave) ---
function fitPuntTuit(points: readonly NonNullSample[], start: number, end: number, eaveUp: number): TemplateFit | null {
  if (points.length < 3) return null;
  const width = end - start;
  if (width <= 0) return null;

  const candidates = new Set<number>(points.map((p) => p[0]).filter((a) => a > start + width * 0.1 && a < end - width * 0.1));
  if (!candidates.size) candidates.add((start + end) / 2);

  let best: { apexAlong: number; rise: number; sse: number } | null = null;
  for (const apexAlong of candidates) {
    const leftHalf = Math.max(apexAlong - start, 1e-6);
    const rightHalf = Math.max(end - apexAlong, 1e-6);
    const shapeOf = (along: number) => {
      const half = along < apexAlong ? leftHalf : rightHalf;
      return Math.max(0, 1 - Math.abs(along - apexAlong) / half);
    };
    let num = 0;
    let den = 0;
    for (const [along, val] of points) {
      const shape = shapeOf(along);
      num += shape * (val - eaveUp);
      den += shape * shape;
    }
    if (den < 1e-9) continue;
    const rise = num / den;
    let sse = 0;
    for (const [along, val] of points) {
      const pred = eaveUp + rise * shapeOf(along);
      sse += (val - pred) ** 2;
    }
    if (!best || sse < best.sse) best = { apexAlong, rise, sse };
  }
  if (!best || best.rise <= 0) return null;

  const { apexAlong, rise } = best;
  const leftHalf = Math.max(apexAlong - start, 1e-6);
  const rightHalf = Math.max(end - apexAlong, 1e-6);
  const predict = (along: number) => {
    const half = along < apexAlong ? leftHalf : rightHalf;
    const shape = Math.max(0, 1 - Math.abs(along - apexAlong) / half);
    return eaveUp + rise * shape;
  };
  const apexUp = eaveUp + rise;
  return {
    params: { apexAlong, apexUp, eaveUp },
    predict,
    trace: [
      [start, eaveUp],
      [apexAlong, apexUp],
      [end, eaveUp],
    ],
  };
}

// --- trapgevel: n symmetric steps each side, uniform rise and run ---
function fitTrapgevel(points: readonly NonNullSample[], start: number, end: number, eaveUp: number): TemplateFit | null {
  if (points.length < 4) return null;
  const width = end - start;
  if (width <= 0) return null;

  let best: { n: number; stepRise: number; stepRun: number; sse: number; adjustedSse: number } | null = null;
  for (let n = 1; n <= 6; n += 1) {
    const stepRun = width / 2 / n;
    if (stepRun <= 1e-6) continue;
    const stepIndex = (along: number) => {
      const d = Math.min(along - start, end - along);
      return Math.min(n, Math.floor(Math.max(0, d) / stepRun));
    };
    let num = 0;
    let den = 0;
    for (const [along, val] of points) {
      const k = stepIndex(along);
      num += k * (val - eaveUp);
      den += k * k;
    }
    if (den < 1e-9) continue;
    const stepRise = num / den;
    if (stepRise <= 0) continue;
    let sse = 0;
    for (const [along, val] of points) {
      const pred = eaveUp + stepIndex(along) * stepRise;
      sse += (val - pred) ** 2;
    }
    // A finer staircase (larger n) can always match the data at least as well
    // as a coarser one — it is strictly more expressive, so raw SSE always
    // prefers the largest n and chases noise. Charge each extra step against
    // the residual degrees of freedom, the same guard used against the
    // polyline fallback (see fitGable), so a step only earns its place by
    // reducing error more than it costs in resolution.
    const adjustedSse = sse / Math.max(1, points.length - n);
    if (!best || adjustedSse < best.adjustedSse) best = { n, stepRise, stepRun, sse, adjustedSse };
  }
  if (!best) return null;

  const { n, stepRise, stepRun } = best;
  const predict = (along: number) => {
    const d = Math.min(along - start, end - along);
    const k = Math.min(n, Math.floor(Math.max(0, d) / stepRun));
    return eaveUp + k * stepRise;
  };

  const leftPts: Array<[number, number]> = [[start, eaveUp]];
  for (let k = 1; k <= n; k += 1) {
    const up = eaveUp + k * stepRise;
    leftPts.push([start + (k - 1) * stepRun, up]);
    leftPts.push([start + k * stepRun, up]);
  }
  const rightPts = leftPts
    .slice(0, -1)
    .reverse()
    .map(([along, up]) => [start + end - along, up] as [number, number]);
  const trace = [...leftPts, ...rightPts];

  return { params: { steps: n, stepRiseM: stepRise, stepRunM: stepRun }, predict, trace };
}

/** Shared neck/shoulder search used by halsgevel and klokgevel. */
function fitNeckShoulder(points: readonly NonNullSample[], start: number, end: number) {
  const width = end - start;
  const centre = (start + end) / 2;
  let best: { neckWidth: number; neckUp: number; shoulderUp: number; sse: number } | null = null;
  for (let frac = 0.15; frac <= 0.7; frac += 0.05) {
    const neckWidth = width * frac;
    const halfNeck = neckWidth / 2;
    const neckVals: number[] = [];
    const shoulderVals: number[] = [];
    for (const [along, val] of points) {
      if (Math.abs(along - centre) <= halfNeck) neckVals.push(val);
      else shoulderVals.push(val);
    }
    if (neckVals.length < 2 || shoulderVals.length < 2) continue;
    const neckUp = mean(neckVals);
    const shoulderUp = mean(shoulderVals);
    let sse = 0;
    for (const [along, val] of points) {
      const pred = Math.abs(along - centre) <= halfNeck ? neckUp : shoulderUp;
      sse += (val - pred) ** 2;
    }
    if (!best || sse < best.sse) best = { neckWidth, neckUp, shoulderUp, sse };
  }
  return best;
}

// --- halsgevel: a raised neck on straight shoulders ---
function fitHalsgevel(points: readonly NonNullSample[], start: number, end: number, eaveUp: number): TemplateFit | null {
  if (points.length < 4) return null;
  const best = fitNeckShoulder(points, start, end);
  if (!best || best.neckUp <= best.shoulderUp) return null;
  const centre = (start + end) / 2;
  const halfNeck = best.neckWidth / 2;
  const predict = (along: number) => (Math.abs(along - centre) <= halfNeck ? best.neckUp : best.shoulderUp);
  return {
    params: { neckWidthM: best.neckWidth, neckUp: best.neckUp, shoulderUp: best.shoulderUp },
    predict,
    trace: [
      [start, best.shoulderUp],
      [centre - halfNeck, best.shoulderUp],
      [centre - halfNeck, best.neckUp],
      [centre + halfNeck, best.neckUp],
      [centre + halfNeck, best.shoulderUp],
      [end, best.shoulderUp],
    ],
  };
}

// --- klokgevel: a raised neck on shoulders that bow outward (curved, <=6 segments per side) ---
/** Solve a 3x3 symmetric positive-definite linear system by Cramer's rule. */
function solve3x3(a: number[][], b: number[]): [number, number, number] | null {
  const det3 = (m: number[][]) =>
    m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) -
    m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) +
    m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);
  const det = det3(a);
  if (Math.abs(det) < 1e-9) return null;
  const withCol = (col: number) => a.map((row, i) => row.map((v, j) => (j === col ? b[i] : v)));
  return [det3(withCol(0)) / det, det3(withCol(1)) / det, det3(withCol(2)) / det];
}

// --- klokgevel: a raised neck on shoulders that bow outward (curved, <=6 segments per side) ---
// Unlike halsgevel's straight shoulders, a candidate neck width can't be
// scored with a flat two-level split: a smoothly bowed shoulder's height
// keeps approaching the neck's as the window widens, so a hard flat/flat
// split's SSE falls monotonically with width and never finds the true neck —
// it just keeps eating the curve. Scoring each candidate width against the
// *actual* curved shape (a joint linear fit for shoulderUp, neckUp and the
// bulge, `solve3x3`) fixes that: a too-wide or too-narrow window now costs
// real residual because it forces the curve's basis functions onto the wrong
// columns, not just because it truncates a slope.
function fitKlokgevel(points: readonly NonNullSample[], start: number, end: number, eaveUp: number): TemplateFit | null {
  if (points.length < 6) return null;
  const centre = (start + end) / 2;
  const width = end - start;

  let best: { halfNeck: number; shoulderUp: number; neckUp: number; bulge: number; sse: number } | null = null;
  for (let frac = 0.1; frac <= 0.7; frac += 0.025) {
    const halfNeck = (width * frac) / 2;
    const leftEnd = centre - halfNeck;
    const rightStart = centre + halfNeck;
    if (leftEnd <= start + 1e-6 || rightStart >= end - 1e-6) continue;

    // Basis: predict = shoulderUp*fS + neckUp*fN + bulge*fB.
    let a00 = 0, a01 = 0, a02 = 0, a11 = 0, a12 = 0, a22 = 0;
    let b0 = 0, b1 = 0, b2 = 0;
    let neckCount = 0;
    for (const [along, val] of points) {
      let fS: number;
      let fN: number;
      let fB: number;
      if (Math.abs(along - centre) <= halfNeck) {
        fS = 0;
        fN = 1;
        fB = 0;
        neckCount += 1;
      } else if (along < centre) {
        const t = Math.max(0, Math.min(1, (along - start) / (leftEnd - start)));
        fS = 1 - t;
        fN = t;
        fB = Math.sin(Math.PI * t);
      } else {
        const t = Math.max(0, Math.min(1, (along - rightStart) / (end - rightStart)));
        fS = t;
        fN = 1 - t;
        fB = Math.sin(Math.PI * t);
      }
      a00 += fS * fS; a01 += fS * fN; a02 += fS * fB;
      a11 += fN * fN; a12 += fN * fB; a22 += fB * fB;
      b0 += fS * val; b1 += fN * val; b2 += fB * val;
    }
    if (neckCount < 2) continue;
    const solved = solve3x3(
      [
        [a00, a01, a02],
        [a01, a11, a12],
        [a02, a12, a22],
      ],
      [b0, b1, b2],
    );
    if (!solved) continue;
    const [shoulderUp, neckUp, bulge] = solved;
    if (neckUp <= shoulderUp) continue;

    let sse = 0;
    for (const [along, val] of points) {
      let pred: number;
      if (Math.abs(along - centre) <= halfNeck) pred = neckUp;
      else if (along < centre) {
        const t = Math.max(0, Math.min(1, (along - start) / (leftEnd - start)));
        pred = shoulderUp * (1 - t) + neckUp * t + bulge * Math.sin(Math.PI * t);
      } else {
        const t = Math.max(0, Math.min(1, (along - rightStart) / (end - rightStart)));
        pred = neckUp * (1 - t) + shoulderUp * t + bulge * Math.sin(Math.PI * t);
      }
      sse += (val - pred) ** 2;
    }
    if (!best || sse < best.sse) best = { halfNeck, shoulderUp, neckUp, bulge, sse };
  }
  if (!best) return null;

  const { halfNeck, shoulderUp, neckUp, bulge } = best;
  const leftEnd = centre - halfNeck;
  const rightStart = centre + halfNeck;
  const predict = (along: number) => {
    if (Math.abs(along - centre) <= halfNeck) return neckUp;
    if (along < centre) {
      const t = Math.max(0, Math.min(1, (along - start) / (leftEnd - start)));
      return shoulderUp * (1 - t) + neckUp * t + bulge * Math.sin(Math.PI * t);
    }
    const t = Math.max(0, Math.min(1, (along - rightStart) / (end - rightStart)));
    return neckUp * (1 - t) + shoulderUp * t + bulge * Math.sin(Math.PI * t);
  };

  const segments = 6;
  const buildCurve = (a0: number, a1: number, u0: number, u1: number) => {
    const pts: Array<[number, number]> = [];
    for (let i = 0; i <= segments; i += 1) {
      const t = i / segments;
      pts.push([a0 + t * (a1 - a0), u0 + t * (u1 - u0) + bulge * Math.sin(Math.PI * t)]);
    }
    return pts;
  };
  const leftCurve = buildCurve(start, leftEnd, shoulderUp, neckUp);
  const rightCurve = buildCurve(rightStart, end, neckUp, shoulderUp);

  return {
    params: { neckWidthM: 2 * halfNeck, neckUp, shoulderUp, bulgeM: bulge },
    predict,
    trace: [...leftCurve, ...rightCurve],
  };
}

/**
 * Close a trace (left base to right base) into an explicit closed outline.
 *
 * The trace's `along` is monotonically increasing by construction (every
 * template and the polyline both build it left to right), so extruding it
 * down to a flat floor and back is always a simple polygon *provided the
 * floor is at or below every point of the trace*. That rules out using a
 * separately estimated eaves level as the floor: for a curved trace
 * (klokgevel) or a wavy fallback polyline, a foreign height can sit *above*
 * part of the trace, and the closing edge then cuts back through it. The
 * floor is instead the trace's own minimum height, which can never do that.
 */
function closeOutline(trace: readonly (readonly [number, number])[], start: number, end: number): Array<readonly [number, number]> {
  if (!trace.length) return [[start, 0], [end, 0], [start, 0]];
  const baseUp = Math.min(...trace.map((p) => p[1]));
  const first = trace[0];
  const last = trace[trace.length - 1];
  const outline: Array<readonly [number, number]> = [[start, baseUp]];
  if (Math.abs(first[0] - start) > 1e-9 || Math.abs(first[1] - baseUp) > 1e-9) outline.push(first);
  for (const point of trace) outline.push(point);
  if (Math.abs(last[0] - end) > 1e-9 || Math.abs(last[1] - baseUp) > 1e-9) outline.push([end, baseUp]);
  outline.push([start, baseUp]);
  return outline;
}

function fitTemplateFor(type: GableType, points: readonly NonNullSample[], start: number, end: number, eaveUp: number): TemplateFit | null {
  switch (type) {
    case 'lijstgevel':
      return fitLijstgevel(points, start, end, eaveUp);
    case 'puntgevel':
    case 'tuitgevel':
      return fitPuntTuit(points, start, end, eaveUp);
    case 'trapgevel':
      return fitTrapgevel(points, start, end, eaveUp);
    case 'halsgevel':
      return fitHalsgevel(points, start, end, eaveUp);
    case 'klokgevel':
      return fitKlokgevel(points, start, end, eaveUp);
    default:
      return null;
  }
}

interface PreparedProfile {
  start: number;
  end: number;
  eaveUp: number;
  nonNull: NonNullSample[];
  mirroredSide: 'left' | 'right' | null;
}

/** Shared prep: mirror-fill an occluded side, estimate the eaves, drop nulls. */
function prepareProfile(type: GableType, rawProfile: readonly GableProfileSample[]): PreparedProfile {
  const start = rawProfile[0][0];
  const end = rawProfile[rawProfile.length - 1][0];
  const { profile: filled, mirroredSide } =
    type === 'unknown'
      ? { profile: rawProfile.map((s) => [s[0], s[1]] as [number, number | null]), mirroredSide: null as 'left' | 'right' | null }
      : fillOcclusion(rawProfile);
  const eaveUp = estimateEaves(filled);
  const nonNull: NonNullSample[] = filled.filter((s): s is [number, number] => s[1] != null);
  return { start, end, eaveUp, nonNull, mirroredSide };
}

export interface GableTemplateFit {
  type: GableType;
  params: Record<string, number>;
  outline: Array<readonly [number, number]>;
  /** See `GableFitResult.trace`: the open trace `outline` was closed from. */
  trace: Array<readonly [number, number]>;
  fitErrorM: number;
  eaveUp: number;
  mirroredSide: 'left' | 'right' | null;
}

/**
 * Fit `type`'s template by least squares, independent of whether it will
 * beat the polyline fallback. `fitGable` is the decision the game uses; this
 * is the fitting step on its own — the recoverable-parameters half of the job.
 * Returns null for `unknown` or when there isn't enough data to fit.
 */
export function fitGableTemplate(input: GableFitInput): GableTemplateFit | null {
  const { type } = input;
  if (type === 'unknown') return null;
  const { start, end, eaveUp, nonNull, mirroredSide } = prepareProfile(type, input.profile);
  if (nonNull.length < 4) return null;
  const fit = fitTemplateFor(type, nonNull, start, end, eaveUp);
  if (!fit) return null;
  return {
    type,
    params: fit.params,
    outline: closeOutline(fit.trace, start, end),
    trace: fit.trace,
    fitErrorM: rmsError(nonNull, fit.predict),
    eaveUp,
    mirroredSide,
  };
}

/**
 * Fit `type`'s template, and decide whether to keep it or fall back to a
 * Douglas-Peucker polyline of the measured columns.
 *
 * The catch: for a template whose true shape is itself piecewise-linear
 * (lijstgevel, puntgevel/tuitgevel, trapgevel, halsgevel are all straight
 * segments), a fine-grained polyline is a *superset* model — at 0.10 m
 * sampling and a 0.15 m tolerance it can trace those corners about as well as
 * the template, sometimes fitting individual noisy samples more closely than
 * the template's honest least-squares average does. So the 30% margin is
 * judged on the residual per fitted parameter (an AIC-style penalty for the
 * polyline's vertex count) rather than on raw RMS: a polyline only "wins" by
 * spending vertices that earn their keep, not by having more of them.
 */
export function fitGable(input: GableFitInput): GableFitResult {
  const { type } = input;
  const polylineToleranceM = input.polylineToleranceM ?? 0.15;
  const rawProfile = input.profile;

  if (rawProfile.length < 2) {
    return { type, method: 'polyline', outline: [], trace: [], params: null, fitErrorM: 0, polylineErrorM: 0, mirroredSide: null, eaveUp: 0 };
  }

  const { start, end, eaveUp, nonNull, mirroredSide } = prepareProfile(type, rawProfile);

  const polylinePoints = simplifyPolyline(nonNull, polylineToleranceM);
  const polylineErrorM = rmsError(nonNull, (along) => interpolatePolyline(polylinePoints, along));
  const polylineOutline = closeOutline(polylinePoints, start, end);

  const fallback = (): GableFitResult => ({
    type,
    method: 'polyline',
    outline: polylineOutline,
    trace: polylinePoints,
    params: null,
    fitErrorM: polylineErrorM,
    polylineErrorM,
    mirroredSide,
    eaveUp,
  });

  if (type === 'unknown' || nonNull.length < 4) return fallback();

  const fit = fitTemplateFor(type, nonNull, start, end, eaveUp);
  if (!fit) return fallback();
  const templateErrorM = rmsError(nonNull, fit.predict);

  const n = nonNull.length;
  const templateSse = templateErrorM ** 2 * n;
  const polylineSse = polylineErrorM ** 2 * n;
  const templateK = Object.keys(fit.params).length;
  // Every interior polyline vertex is a freely *chosen* (along, up) pair, not
  // a coefficient constrained to a fixed shape, so it is charged like two
  // continuous parameters.
  const polylineK = Math.min(n - 1, 2 * polylinePoints.length);
  const adjusted = (sse: number, k: number) => Math.sqrt(sse / Math.max(1, n - k));
  const templateAdjustedM = adjusted(templateSse, templateK);
  const polylineAdjustedM = adjusted(polylineSse, polylineK);

  const beatsPolyline = polylineAdjustedM <= 1e-9 ? templateAdjustedM <= 1e-6 : templateAdjustedM <= polylineAdjustedM * 0.7;
  if (!beatsPolyline) return fallback();

  return {
    type,
    method: 'template',
    outline: closeOutline(fit.trace, start, end),
    trace: fit.trace,
    params: fit.params,
    fitErrorM: templateErrorM,
    polylineErrorM,
    mirroredSide,
    eaveUp,
  };
}
