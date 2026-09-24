/**
 * Impute openings a detector missed from the rhythm of a façade's storey rows.
 *
 * The union of detectors (`openingMerge.ts`) is precise but not exhaustive in
 * the way that matters: a parked van, a tree or a shadow hides a window, and no
 * amount of harder detection recovers evidence that is not in the photo. Dutch
 * canal façades are regular, though, so the openings that *were* found describe
 * where the missing ones must be.
 *
 * The order below is the design, not an implementation detail:
 *  1. Cluster by vertical centre into storey rows first. Floor lines are the
 *     strongest signal on a canal wall, and the tolerance is a factor of the
 *     median opening height rather than a metre guess.
 *  2. Estimate the horizontal pitch *within each row*. Amsterdam bays are
 *     irregular and window heights shrink storey by storey, so one global grid
 *     would force regularity onto rows that do not have it. A missing opening
 *     only ever widens a gap, so the pitch is taken from each row's tightest
 *     gaps and then refined by snapping every gap to an integer multiple.
 *  3. Impute conservatively: the median size of the row's own boxes, at the
 *     interpolated centre, never outside the wall and never overlapping what is
 *     already there.
 *  4. Cross-row column support is recorded on the imputed box and used to order
 *     candidates under the per-row cap; it never creates an opening on its own —
 *     the row's own pitch does.
 *  5. The ground row is left alone unless asked: shopfronts, doors and stoeps
 *     genuinely break the rhythm there.
 *  6. A gap that holds a door is never filled, and a door is never treated as
 *     part of the window rhythm; doors displace windows rather than continuing
 *     them.
 *  7. A row with too few boxes, or gaps that no single pitch explains, is
 *     returned untouched with a reason. A hole is far cheaper than a confident,
 *     invented window on a façade an owner will review.
 *
 * Detected boxes are never moved, resized or dropped; the result holds them
 * unchanged with `origin: 'detected'` and appends only imputed ones.
 */
import type { MergedBox, WallRect } from './openingMerge.ts';

export type OpeningOrigin = 'detected' | 'imputed';

export interface LatticeBox extends MergedBox {
  origin: OpeningOrigin;
  /** Imputed boxes only: how many other rows hold a box at this column. */
  rowSupport?: number;
}

export interface LatticeOptions {
  /** Row clustering tolerance as a multiple of the median opening height. */
  rowToleranceFactor?: number;
  /** Minimum detected windows in a row before its rhythm is trusted. */
  minimumPerRow?: number;
  /** Largest gap residual, as a fraction of the fitted pitch, that is accepted. */
  maximumResidualRatio?: number;
  /** Whether the ground (lowest) row may be filled; default off. */
  fillGroundRow?: boolean;
  /** Safety cap on boxes imputed into one row. */
  maximumImputedPerRow?: number;
}

export interface LatticeRowDiagnostic {
  /** 0 is the ground row (lowest vertical centre). */
  row: number;
  /** Vertical centre of the row in wall metres. */
  centreUp: number;
  /** Detected boxes that fell into this row. */
  detected: number;
  /** Boxes imputed into this row. */
  imputed: number;
  /** Candidate positions the wall/overlap guards rejected. */
  rejected: number;
  /** Why the row was left as detected, or null when imputation ran. */
  abstained: string | null;
}

export interface LatticeResult {
  /** Detected boxes unchanged, followed by the imputed ones. */
  boxes: LatticeBox[];
  /** Number of storey rows the boxes clustered into. */
  rows: number;
  /** Number of boxes added by inference. */
  imputed: number;
  /** One entry per clustered row, ordered from the ground row upward. */
  rowDiagnostics: LatticeRowDiagnostic[];
}

const median = (values: readonly number[]): number | null => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};

const intersectionArea = (a: WallRect, b: WallRect): number => {
  const left = Math.max(a.along, b.along);
  const right = Math.min(a.along + a.width, b.along + b.width);
  const bottom = Math.max(a.up, b.up);
  const top = Math.min(a.up + a.height, b.up + b.height);
  if (right <= left || top <= bottom) return 0;
  return (right - left) * (top - bottom);
};

const insideWall = (box: WallRect, wallWidthM: number, wallHeightM: number): boolean =>
  box.along >= -1e-9
  && box.up >= -1e-9
  && box.along + box.width <= wallWidthM + 1e-9
  && box.up + box.height <= wallHeightM + 1e-9;

interface DetectedRow {
  boxes: MergedBox[];
  centreUp: number;
}

/** Group boxes by vertical centre so consecutive centres within tolerance merge. */
const clusterRows = (boxes: readonly MergedBox[], tolerance: number): DetectedRow[] => {
  const entries = boxes
    .map((box) => ({ box, centre: box.up + box.height / 2 }))
    .sort((a, b) => a.centre - b.centre || a.box.along - b.box.along);
  const clusters: Array<{ boxes: MergedBox[]; centreSum: number }> = [];
  for (const entry of entries) {
    const cluster = clusters[clusters.length - 1];
    if (cluster && entry.centre - cluster.centreSum / cluster.boxes.length <= tolerance) {
      cluster.boxes.push(entry.box);
      cluster.centreSum += entry.centre;
    } else {
      clusters.push({ boxes: [entry.box], centreSum: entry.centre });
    }
  }
  return clusters.map((cluster) => ({ boxes: cluster.boxes, centreUp: cluster.centreSum / cluster.boxes.length }));
};

interface Rhythm {
  spacing: number;
  residualRatio: number;
}

/**
 * Fit one pitch to a row's consecutive window centres. Missing openings only
 * widen a gap, so the base pitch is read from the tightest cluster of gaps
 * (a plain median would be inflated by a single missing window), then every gap
 * is snapped to an integer multiple and the pitch refitted.
 */
const fitRhythm = (centres: readonly number[], medianWidth: number): Rhythm | null => {
  const gaps = centres
    .slice(1)
    .map((centre, index) => centre - centres[index])
    .filter((gap) => gap > 0);
  if (!gaps.length) return null;

  const sorted = [...gaps].sort((a, b) => a - b);
  const tight = sorted.filter((gap) => gap <= sorted[0] * 1.5);
  let spacing = median(tight) ?? sorted[0];
  if (!(spacing > 0) || spacing < 0.3 * medianWidth) return null;

  let multiples = gaps.map(() => 1);
  for (let iteration = 0; iteration < 4; iteration++) {
    multiples = gaps.map((gap) => Math.max(1, Math.round(gap / spacing)));
    const denominator = multiples.reduce((sum, k) => sum + k * k, 0);
    const numerator = gaps.reduce((sum, gap, index) => sum + gap * multiples[index], 0);
    const next = denominator > 0 ? numerator / denominator : spacing;
    if (!(next > 0)) return null;
    const converged = Math.abs(next - spacing) < 1e-9;
    spacing = next;
    if (converged) break;
  }

  const residualRatio = Math.max(...gaps.map((gap, index) => Math.abs(gap - multiples[index] * spacing) / spacing));
  return { spacing, residualRatio };
};

export function fillOpeningLattice(
  boxes: readonly MergedBox[],
  wallWidthM: number,
  wallHeightM: number,
  options: LatticeOptions = {},
): LatticeResult {
  const rowToleranceFactor = options.rowToleranceFactor ?? 0.5;
  const minimumPerRow = options.minimumPerRow ?? 3;
  const maximumResidualRatio = options.maximumResidualRatio ?? 0.3;
  const fillGroundRow = options.fillGroundRow ?? false;
  const maximumImputedPerRow = options.maximumImputedPerRow ?? 4;

  const detected: LatticeBox[] = boxes.map((box) => ({ ...box, origin: 'detected' }));
  const medianHeight = median(boxes.filter((box) => box.height > 0).map((box) => box.height));
  if (!boxes.length || !medianHeight) {
    return { boxes: detected, rows: 0, imputed: 0, rowDiagnostics: [] };
  }

  const rows = clusterRows(boxes, medianHeight * rowToleranceFactor);
  const imputed: LatticeBox[] = [];
  const rowDiagnostics: LatticeRowDiagnostic[] = [];

  rows.forEach((row, index) => {
    const diagnostic: LatticeRowDiagnostic = {
      row: index,
      centreUp: row.centreUp,
      detected: row.boxes.length,
      imputed: 0,
      rejected: 0,
      abstained: null,
    };
    rowDiagnostics.push(diagnostic);

    if (index === 0 && !fillGroundRow) {
      diagnostic.abstained = 'ground row left as detected (shopfront rhythm is not assumed)';
      return;
    }

    const rhythm = row.boxes.filter((box) => box.kind === 'window').sort((a, b) => a.along - b.along);
    if (rhythm.length < minimumPerRow) {
      diagnostic.abstained = `row has ${rhythm.length} window(s), fewer than the ${minimumPerRow} required`;
      return;
    }

    const centres = rhythm.map((box) => box.along + box.width / 2);
    const medianWidth = median(row.boxes.map((box) => box.width)) ?? 0;
    const fit = fitRhythm(centres, medianWidth);
    if (!fit) {
      diagnostic.abstained = 'row has no consecutive window gap to estimate a pitch from';
      return;
    }
    if (fit.residualRatio > maximumResidualRatio) {
      diagnostic.abstained = `row gaps are not one pitch (residual ${fit.residualRatio.toFixed(2)} of ${fit.spacing.toFixed(2)} m)`;
      return;
    }

    const rowWidth = median(row.boxes.map((box) => box.width)) ?? 0;
    const rowHeight = median(row.boxes.map((box) => box.height)) ?? medianHeight;
    const doors = row.boxes.filter((box) => box.kind === 'door');
    const columnTolerance = Math.max(1e-6, 0.25 * fit.spacing);

    const candidates: Array<{ along: number; support: number }> = [];
    for (let i = 0; i < centres.length - 1; i++) {
      const gap = centres[i + 1] - centres[i];
      const multiple = Math.round(gap / fit.spacing);
      if (multiple < 2) continue;
      // A door in the gap breaks the window rhythm; never bridge it.
      if (doors.some((door) => door.along < centres[i + 1] && door.along + door.width > centres[i])) continue;
      for (let step = 1; step < multiple; step++) {
        const along = centres[i] + step * fit.spacing;
        const support = rows.reduce((count, other, otherIndex) => {
          if (otherIndex === index) return count;
          return count + (other.boxes.some((box) => Math.abs(box.along + box.width / 2 - along) <= columnTolerance) ? 1 : 0);
        }, 0);
        candidates.push({ along, support });
      }
    }

    candidates.sort((a, b) => b.support - a.support || a.along - b.along);
    for (const candidate of candidates) {
      if (diagnostic.imputed >= maximumImputedPerRow) break;
      const proposed: WallRect = {
        along: candidate.along - rowWidth / 2,
        up: row.centreUp - rowHeight / 2,
        width: rowWidth,
        height: rowHeight,
      };
      if (!insideWall(proposed, wallWidthM, wallHeightM)) { diagnostic.rejected += 1; continue; }
      if (detected.some((box) => intersectionArea(proposed, box) > 1e-9)) { diagnostic.rejected += 1; continue; }
      if (imputed.some((box) => intersectionArea(proposed, box) > 1e-9)) { diagnostic.rejected += 1; continue; }
      imputed.push({
        ...proposed,
        kind: 'window',
        sources: ['opening-lattice'],
        origin: 'imputed',
        rowSupport: candidate.support,
      });
      diagnostic.imputed += 1;
    }
  });

  return { boxes: [...detected, ...imputed], rows: rows.length, imputed: imputed.length, rowDiagnostics };
}
