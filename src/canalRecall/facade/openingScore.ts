/**
 * Scoring predicted façade openings against measured ones, in wall metres.
 *
 * The measured set is point-cloud geometry (recesses behind the wall plane), so
 * it is a measurement, not another model's opinion. Matching is axis-aligned IoU
 * in the wall's own metric frame, which is the frame a rectified crop already
 * carries — no pixel scales, no perspective.
 *
 * Two conventions this module keeps explicit, because getting them wrong makes a
 * model look better or worse than it is:
 *  - A prediction whose class is not the one being scored is *unknown*, not a
 *    negative, so it is neither a true nor a false positive (see `kinds`).
 *  - Every rate reports its denominator. A model that predicts nothing has
 *    precision undefined, not 1.0.
 */

export interface WallRect {
  along: number;
  up: number;
  width: number;
  height: number;
}

export interface ScoredBox extends WallRect {
  kind?: string;
  score?: number;
}

export interface MatchPair {
  gold: WallRect;
  prediction: ScoredBox;
  iou: number;
  centreErrorM: number;
}

export interface OpeningScore {
  /** Predictions eligible for this class. */
  predicted: number;
  /** Measured openings in scope. */
  measured: number;
  truePositives: number;
  falsePositives: number;
  falseNegatives: number;
  /** TP / (TP + FP); null when nothing was predicted (undefined, not 1.0). */
  precision: number | null;
  /** TP / (TP + FN); null when nothing was measured. */
  recall: number | null;
  /** Median centre distance of matched pairs, in metres; null when no matches. */
  medianCentreErrorM: number | null;
  matches: MatchPair[];
  unmatchedPredictions: ScoredBox[];
  unmatchedMeasured: WallRect[];
}

export interface ScoreOptions {
  /** Minimum IoU for a match. */
  iouThreshold?: number;
  /** Only predictions with these kinds are eligible; undefined scores all. */
  kinds?: readonly string[];
  /** Ignore predictions below this score. */
  minimumScore?: number;
}

const intersectionOverUnion = (a: WallRect, b: WallRect) => {
  const left = Math.max(a.along, b.along);
  const right = Math.min(a.along + a.width, b.along + b.width);
  const bottom = Math.max(a.up, b.up);
  const top = Math.min(a.up + a.height, b.up + b.height);
  if (right <= left || top <= bottom) return 0;
  const intersection = (right - left) * (top - bottom);
  const union = a.width * a.height + b.width * b.height - intersection;
  return union > 0 ? intersection / union : 0;
};

const centreError = (a: WallRect, b: WallRect) =>
  Math.hypot(a.along + a.width / 2 - (b.along + b.width / 2), a.up + a.height / 2 - (b.up + b.height / 2));

const median = (values: number[]): number | null => {
  if (!values.length) return null;
  const sorted = [...values].sort((x, y) => x - y);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};

/** Match predictions to measured openings greedily by IoU, each used at most once. */
export function scoreOpenings(
  measured: readonly WallRect[],
  predictions: readonly ScoredBox[],
  options: ScoreOptions = {},
): OpeningScore {
  const iouThreshold = options.iouThreshold ?? 0.5;
  const eligible = predictions.filter((box) =>
    (options.kinds === undefined || (box.kind !== undefined && options.kinds.includes(box.kind)))
    && (options.minimumScore === undefined || (box.score ?? 1) >= options.minimumScore));

  const candidates: Array<{ m: number; p: number; iou: number }> = [];
  measured.forEach((gold, m) => {
    eligible.forEach((prediction, p) => {
      const iou = intersectionOverUnion(gold, prediction);
      if (iou >= iouThreshold) candidates.push({ m, p, iou });
    });
  });
  candidates.sort((a, b) => b.iou - a.iou);

  const usedMeasured = new Set<number>();
  const usedPrediction = new Set<number>();
  const matches: MatchPair[] = [];
  for (const candidate of candidates) {
    if (usedMeasured.has(candidate.m) || usedPrediction.has(candidate.p)) continue;
    usedMeasured.add(candidate.m);
    usedPrediction.add(candidate.p);
    matches.push({
      gold: measured[candidate.m],
      prediction: eligible[candidate.p],
      iou: candidate.iou,
      centreErrorM: centreError(measured[candidate.m], eligible[candidate.p]),
    });
  }

  const truePositives = matches.length;
  const falsePositives = eligible.length - truePositives;
  const falseNegatives = measured.length - truePositives;
  return {
    predicted: eligible.length,
    measured: measured.length,
    truePositives,
    falsePositives,
    falseNegatives,
    precision: eligible.length ? truePositives / eligible.length : null,
    recall: measured.length ? truePositives / measured.length : null,
    medianCentreErrorM: median(matches.map((match) => match.centreErrorM)),
    matches,
    unmatchedPredictions: eligible.filter((_, index) => !usedPrediction.has(index)),
    unmatchedMeasured: measured.filter((_, index) => !usedMeasured.has(index)),
  };
}

/** Pool per-wall scores into one figure, keeping the denominators explicit. */
export function poolScores(scores: readonly OpeningScore[]): OpeningScore {
  const predicted = scores.reduce((sum, score) => sum + score.predicted, 0);
  const measured = scores.reduce((sum, score) => sum + score.measured, 0);
  const truePositives = scores.reduce((sum, score) => sum + score.truePositives, 0);
  const falsePositives = scores.reduce((sum, score) => sum + score.falsePositives, 0);
  const falseNegatives = scores.reduce((sum, score) => sum + score.falseNegatives, 0);
  const errors = scores.flatMap((score) => score.matches.map((match) => match.centreErrorM));
  return {
    predicted,
    measured,
    truePositives,
    falsePositives,
    falseNegatives,
    precision: predicted ? truePositives / predicted : null,
    recall: measured ? truePositives / measured : null,
    medianCentreErrorM: median(errors),
    matches: scores.flatMap((score) => score.matches),
    unmatchedPredictions: scores.flatMap((score) => score.unmatchedPredictions),
    unmatchedMeasured: scores.flatMap((score) => score.unmatchedMeasured),
  };
}

/** The plan's adoption rule, applied to one pooled score. */
export interface DecisionThresholds {
  recall: number;
  precision: number;
  centreErrorM: number;
}
export const ADOPTION_THRESHOLDS: DecisionThresholds = { recall: 0.8, precision: 0.8, centreErrorM: 0.3 };

export function clearsThresholds(score: OpeningScore, thresholds: DecisionThresholds = ADOPTION_THRESHOLDS) {
  return {
    recall: score.recall !== null && score.recall >= thresholds.recall,
    precision: score.precision !== null && score.precision >= thresholds.precision,
    centreError: score.medianCentreErrorM !== null && score.medianCentreErrorM <= thresholds.centreErrorM,
  };
}
