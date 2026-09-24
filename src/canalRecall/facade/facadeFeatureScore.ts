export interface Box {
  id?: string;
  kind: string;
  bounds: [number, number, number, number];
}

type Quad = [number, number, number, number];

function normalize(bounds: Quad): Quad {
  const [left, top, right, bottom] = bounds;
  return [
    Math.min(left, right),
    Math.min(top, bottom),
    Math.max(left, right),
    Math.max(top, bottom),
  ];
}

export function iou(a: Quad, b: Quad): number {
  const [al, at, ar, ab] = normalize(a);
  const [bl, bt, br, bb] = normalize(b);
  const interWidth = Math.min(ar, br) - Math.max(al, bl);
  const interHeight = Math.min(ab, bb) - Math.max(at, bt);
  if (interWidth <= 0 || interHeight <= 0) return 0;
  const intersection = interWidth * interHeight;
  const areaA = (ar - al) * (ab - at);
  const areaB = (br - bl) * (bb - bt);
  const union = areaA + areaB - intersection;
  if (union <= 0) return 0;
  return intersection / union;
}

export interface MatchOpeningsResult {
  matches: { reference: Box; prediction: Box; iou: number }[];
  unmatchedReferences: Box[];
  unmatchedPredictions: Box[];
  precision: number;
  recall: number;
}

/**
 * Greedy one-to-one opening matching. Precision/recall return 0 when their
 * denominator is 0 (e.g. empty inputs), because there is nothing to score.
 */
export function matchOpenings(
  references: Box[],
  predictions: Box[],
  options: { iouThreshold?: number; sameKindOnly?: boolean } = {},
): MatchOpeningsResult {
  const iouThreshold = options.iouThreshold ?? 0.7;
  const sameKindOnly = options.sameKindOnly ?? false;

  const candidates: { ri: number; pi: number; score: number }[] = [];
  for (let ri = 0; ri < references.length; ri++) {
    for (let pi = 0; pi < predictions.length; pi++) {
      if (sameKindOnly && references[ri].kind !== predictions[pi].kind) continue;
      const score = iou(references[ri].bounds, predictions[pi].bounds);
      if (score < iouThreshold) continue;
      candidates.push({ ri, pi, score });
    }
  }
  candidates.sort((x, y) => y.score - x.score || x.ri - y.ri || x.pi - y.pi);

  const usedReferences = new Set<number>();
  const usedPredictions = new Set<number>();
  const matches: MatchOpeningsResult['matches'] = [];
  for (const candidate of candidates) {
    if (usedReferences.has(candidate.ri) || usedPredictions.has(candidate.pi)) continue;
    usedReferences.add(candidate.ri);
    usedPredictions.add(candidate.pi);
    matches.push({
      reference: references[candidate.ri],
      prediction: predictions[candidate.pi],
      iou: candidate.score,
    });
  }

  const unmatchedReferences = references.filter((_, i) => !usedReferences.has(i));
  const unmatchedPredictions = predictions.filter((_, i) => !usedPredictions.has(i));

  const precisionDenominator = matches.length + unmatchedPredictions.length;
  const recallDenominator = matches.length + unmatchedReferences.length;
  const precision = precisionDenominator === 0 ? 0 : matches.length / precisionDenominator;
  const recall = recallDenominator === 0 ? 0 : matches.length / recallDenominator;

  return { matches, unmatchedReferences, unmatchedPredictions, precision, recall };
}

export interface ContourDistance {
  meanM: number;
  p95M: number;
  maxM: number;
  samples: number;
}

type Point = [number, number];

function resample(points: Point[], samples: number, closed: boolean): Point[] {
  const path: Point[] = points.map((p) => [p[0], p[1]]);
  const first = path[0];
  const last = path[path.length - 1];
  if (closed && (first[0] !== last[0] || first[1] !== last[1])) {
    path.push([first[0], first[1]]);
  }

  const cumulative = [0];
  for (let i = 1; i < path.length; i++) {
    const dx = path[i][0] - path[i - 1][0];
    const dy = path[i][1] - path[i - 1][1];
    cumulative.push(cumulative[i - 1] + Math.hypot(dx, dy));
  }
  const total = cumulative[cumulative.length - 1];
  const divisor = closed ? samples : samples - 1;

  const result: Point[] = [];
  let segment = 0;
  for (let i = 0; i < samples; i++) {
    const target = total === 0 ? 0 : (i / divisor) * total;
    while (segment < path.length - 2 && cumulative[segment + 1] < target) segment++;
    const segmentLength = cumulative[segment + 1] - cumulative[segment];
    const t = segmentLength === 0 ? 0 : (target - cumulative[segment]) / segmentLength;
    result.push([
      path[segment][0] + (path[segment + 1][0] - path[segment][0]) * t,
      path[segment][1] + (path[segment + 1][1] - path[segment][1]) * t,
    ]);
  }
  return result;
}

/**
 * Arc-length resamples both polylines to the same count, then reports the
 * mean/p95/max paired point distance. Degenerate inputs (<2 points) return
 * zeros with samples 0.
 */
export function contourDistance(
  a: Point[],
  b: Point[],
  options: { samples?: number; closed?: boolean } = {},
): ContourDistance {
  if (a.length < 2 || b.length < 2) return { meanM: 0, p95M: 0, maxM: 0, samples: 0 };

  const closed = options.closed ?? false;
  const samples = Math.max(2, Math.floor(options.samples ?? 64));
  const resampledA = resample(a, samples, closed);
  const resampledB = resample(b, samples, closed);

  const distances: number[] = [];
  for (let i = 0; i < samples; i++) {
    distances.push(
      Math.hypot(resampledA[i][0] - resampledB[i][0], resampledA[i][1] - resampledB[i][1]),
    );
  }
  const sorted = [...distances].sort((x, y) => x - y);
  const meanM = distances.reduce((sum, value) => sum + value, 0) / samples;
  const p95Index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(0.95 * sorted.length) - 1));
  return { meanM, p95M: sorted[p95Index], maxM: sorted[sorted.length - 1], samples };
}

export interface ColourRegion {
  region: string;
  colour: string;
}

export interface ColourConfusionResult {
  agreements: number;
  total: number;
  confusion: { region: string; reference: string | null; prediction: string | null }[];
}

export function colourConfusion(
  references: ColourRegion[],
  predictions: ColourRegion[],
): ColourConfusionResult {
  const referenceByRegion = new Map<string, string>();
  for (const entry of references) referenceByRegion.set(entry.region, entry.colour);
  const predictionByRegion = new Map<string, string>();
  for (const entry of predictions) predictionByRegion.set(entry.region, entry.colour);

  const regions = Array.from(
    new Set([...referenceByRegion.keys(), ...predictionByRegion.keys()]),
  ).sort();

  let agreements = 0;
  const confusion: ColourConfusionResult['confusion'] = [];
  for (const region of regions) {
    const reference = referenceByRegion.has(region) ? referenceByRegion.get(region)! : null;
    const prediction = predictionByRegion.has(region) ? predictionByRegion.get(region)! : null;
    if (reference !== null && prediction !== null && reference === prediction) {
      agreements++;
    } else {
      confusion.push({ region, reference, prediction });
    }
  }
  return { agreements, total: regions.length, confusion };
}
