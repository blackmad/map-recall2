/**
 * Reading a gable's type off its own roofline.
 *
 * The gable is the single most identifying feature of a canal house and the one
 * thing 3DBAG cannot supply — RECON-2 established that its roof reconstruction
 * tracks complexity rather than truth on the 96% of the pilot that is pitched.
 * The register names a type for 23% of buildings and says nothing about the
 * rest. So the type has to be measured, and the roofline is where it lives.
 *
 * The classifier is deliberately a set of stated rules over named measurements
 * rather than a learned model. Two reasons, both from the brief: a measurement
 * has to carry a reason a reviewer can argue with, and every value needs a
 * confidence that means something. A rule that says "three plateaus of
 * decreasing width, therefore trapgevel" can be checked against the photograph;
 * a model's logit cannot.
 *
 * The silhouette is measured in units of the plot's own width, which BAG knows
 * exactly. That is the same trick the whole pipeline runs on: scale from the one
 * dimension already certain.
 */

export type GableType = 'lijstgevel' | 'puntgevel' | 'tuitgevel' | 'trapgevel' | 'klokgevel' | 'halsgevel' | 'unknown';

export interface GableSilhouette {
  /** Height above the eaves, in metres, sampled left to right across the plot. */
  profile: number[];
  plotWidthM: number;
  /** Metres per sample. */
  sampleM: number;
}

export interface GableFeatures {
  /** Peak rise above the eaves, as a fraction of plot width. */
  riseRatio: number;
  /** Fraction of the width within 15% of the peak height — a flat top. */
  topFlatness: number;
  /** Width of the raised central section, as a fraction of plot width. */
  neckWidth: number;
  /** Horizontal plateaus at distinct heights, the signature of a step gable. */
  plateaus: number;
  /** How far the peak sits from centre, as a fraction of plot width. */
  peakOffset: number;
  /** Positive where the flanks bulge outward (a bell), negative where they cut in. */
  flankCurvature: number;
  /** Left/right mirror agreement, 1 is perfectly symmetric. */
  symmetry: number;
}

const median = (values: number[]) => {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
};

export function gableFeatures({ profile, plotWidthM, sampleM }: GableSilhouette): GableFeatures {
  const n = profile.length;
  if (n < 8) return { riseRatio: 0, topFlatness: 1, neckWidth: 1, plateaus: 0, peakOffset: 0, flankCurvature: 0, symmetry: 1 };

  // Eaves level: the height the flanks settle at. Taken from the outer eighths,
  // which are the parts of a gable that sit on the party walls.
  const flank = [...profile.slice(0, Math.floor(n / 8)), ...profile.slice(n - Math.floor(n / 8))];
  const eaves = median(flank);
  const rise = profile.map(h => h - eaves);
  const peak = Math.max(...rise);
  if (peak <= 0.2) {
    return { riseRatio: 0, topFlatness: 1, neckWidth: 1, plateaus: 0, peakOffset: 0, flankCurvature: 0, symmetry: 1 };
  }

  const peakIndex = rise.indexOf(peak);
  const nearTop = rise.filter(h => h > peak * 0.85).length / n;
  const raised = rise.map(h => h > peak * 0.35);
  const neck = raised.filter(Boolean).length / n;

  // Plateaus: runs where the height holds steady, at heights distinct from each
  // other. A step gable has several; a bell gable has one at the top.
  const stepHeights: number[] = [];
  let runStart = 0;
  for (let i = 1; i <= n; i++) {
    const ended = i === n || Math.abs(rise[i] - rise[runStart]) > 0.35;
    if (!ended) continue;
    const runLength = i - runStart;
    if (runLength * sampleM > plotWidthM * 0.08 && rise[runStart] > 0.3) {
      const height = median(rise.slice(runStart, i));
      if (!stepHeights.some(existing => Math.abs(existing - height) < 0.45)) stepHeights.push(height);
    }
    runStart = i;
  }

  // Flank curvature: does the outline between shoulder and top bow outward
  // (a bell) or run straight (a neck)? Compared against the straight line from
  // the shoulder to the top on the taller flank.
  const shoulder = Math.max(0, rise.findIndex(h => h > peak * 0.2));
  let curvature = 0;
  if (peakIndex > shoulder + 2) {
    let sum = 0;
    for (let i = shoulder; i <= peakIndex; i++) {
      const t = (i - shoulder) / (peakIndex - shoulder);
      const straight = rise[shoulder] + t * (peak - rise[shoulder]);
      sum += (rise[i] - straight) / peak;
    }
    curvature = sum / (peakIndex - shoulder + 1);
  }

  let mirror = 0;
  for (let i = 0; i < Math.floor(n / 2); i++) mirror += Math.abs(rise[i] - rise[n - 1 - i]);
  const symmetry = 1 - Math.min(1, mirror / (Math.floor(n / 2) * Math.max(peak, 1)));

  return {
    riseRatio: peak / plotWidthM,
    topFlatness: nearTop,
    neckWidth: neck,
    plateaus: stepHeights.length,
    peakOffset: Math.abs(peakIndex - (n - 1) / 2) / n,
    flankCurvature: curvature,
    symmetry,
  };
}

export interface GableReading {
  type: GableType;
  confidence: number;
  /** The rule that fired, in words a reviewer can disagree with. */
  reason: string;
}

/**
 * Classify a silhouette.
 *
 * Ordered most-distinctive first. Confidence is how far the measurement sits
 * inside its rule rather than on the boundary, so a building that only just
 * qualifies says so.
 */
export function classifyGable(features: GableFeatures): GableReading {
  const { riseRatio, topFlatness, neckWidth, plateaus, flankCurvature, symmetry } = features;
  const margin = (value: number, threshold: number, scale: number) =>
    Math.max(0.35, Math.min(0.95, 0.5 + (value - threshold) / scale));

  // A cornice gable barely rises: the roof hides behind a horizontal line.
  if (riseRatio < 0.12) {
    return { type: 'lijstgevel', confidence: margin(0.12 - riseRatio, 0, 0.16), reason: `rise is only ${(riseRatio * 100).toFixed(0)}% of plot width — the roof sits behind a horizontal cornice` };
  }
  // A step gable is the only form with several distinct horizontal plateaus.
  if (plateaus >= 3) {
    return { type: 'trapgevel', confidence: margin(plateaus, 3, 4), reason: `${plateaus} horizontal plateaus at distinct heights — a stepped outline` };
  }
  // A neck gable raises a narrow block with straight sides above the shoulders.
  if (neckWidth < 0.5 && Math.abs(flankCurvature) < 0.09 && topFlatness > 0.12) {
    return { type: 'halsgevel', confidence: margin(0.5 - neckWidth, 0, 0.4), reason: `a raised centre ${(neckWidth * 100).toFixed(0)}% of the width with straight flanks and a flat top — a neck` };
  }
  // A bell gable's flanks bow outward on the way up.
  if (flankCurvature > 0.06 && topFlatness > 0.08) {
    return { type: 'klokgevel', confidence: margin(flankCurvature, 0.06, 0.2), reason: `flanks bow outward by ${(flankCurvature * 100).toFixed(0)}% of the rise — a bell outline` };
  }
  // A spout gable is a point with a small flat tip.
  if (topFlatness < 0.1 && neckWidth < 0.45 && riseRatio > 0.25) {
    return { type: 'tuitgevel', confidence: margin(0.45 - neckWidth, 0, 0.3), reason: `a narrow raised tip on a steep outline — a spout` };
  }
  // A pointed gable follows the roof pitch straight to an apex.
  if (topFlatness < 0.16 && symmetry > 0.55) {
    return { type: 'puntgevel', confidence: margin(symmetry, 0.55, 0.7), reason: `a symmetric apex with no plateau — the outline follows the roof pitch` };
  }
  return { type: 'unknown', confidence: 0, reason: `rise ${(riseRatio * 100).toFixed(0)}%, top ${(topFlatness * 100).toFixed(0)}%, neck ${(neckWidth * 100).toFixed(0)}%, ${plateaus} plateaus — matches no rule` };
}
