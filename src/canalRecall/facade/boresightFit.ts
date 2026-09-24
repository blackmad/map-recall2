/** Fit a panorama boresight (yaw + pitch) from world↔pixel anchors.
 *
 * `scripts/review/solve-pano-boresight.ts` grid-searches the correction that
 * puts known world points onto their hand-clicked panoramica pixels, then the
 * measured values are pasted into `panoCamera.ts`. That inline search has one
 * honesty problem: the residual it prints is minimised on the same anchors it
 * is measured on, so it flatters both the fit and the source table.
 *
 * This module keeps the search but adds a deterministic calibration/validation
 * split, so the reported residual is measured on anchors the fit never saw.
 * Everything is pure and deterministic: same anchors in, same numbers out.
 */
import {
  AMSTERDAM_WORLD_ALIGNED,
  worldToEquirectangularPixel,
  type CameraModel,
  type CameraPose,
} from './rectify.ts';

export interface FitAnchor {
  world: { x: number; y: number; z: number };
  pixel: [number, number];
}

export interface BoresightFit {
  yawDeg: number;
  pitchDeg: number;
  rmsPx: number;
  anchors: number;
}

export interface FitOptions {
  yawRangeDeg?: number;
  pitchRangeDeg?: number;
  coarseStepDeg?: number;
  fineStepDeg?: number;
  /** Base camera convention. Defaults to the world-aligned municipal model. */
  baseModel?: CameraModel;
}

const DEFAULT_YAW_RANGE_DEG = 6;
const DEFAULT_PITCH_RANGE_DEG = 1;
const DEFAULT_COARSE_STEP_DEG = 0.2;
const DEFAULT_FINE_STEP_DEG = 0.05;
const DEFAULT_VALIDATION_FRACTION = 0.25;

/** Signed horizontal offset, wrapping because the panorama is a cylinder. */
function wrapDeltaU(delta: number, width: number): number {
  const half = width / 2;
  return ((((delta + half) % width) + width) % width) - half;
}

function modelWithBoresight(base: CameraModel, yawDeg: number, pitchDeg: number): CameraModel {
  return { ...base, boresightYawDeg: yawDeg, boresightPitchDeg: pitchDeg };
}

/** Squared pixel residual of one anchor under a given boresight. */
export function squaredPixelResidual(
  anchor: FitAnchor,
  pose: CameraPose,
  image: { width: number; height: number },
  baseModel: CameraModel,
  yawDeg: number,
  pitchDeg: number,
): number {
  const [u, v] = worldToEquirectangularPixel(anchor.world, pose, image, modelWithBoresight(baseModel, yawDeg, pitchDeg));
  const du = wrapDeltaU(u - anchor.pixel[0], image.width);
  const dv = v - anchor.pixel[1];
  return du * du + dv * dv;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

/**
 * Coarse-to-fine grid search for the boresight minimising mean squared pixel
 * residual. Returns null when there are no anchors, since there is nothing to
 * fit and any value would be invented.
 */
export function fitBoresight(
  anchors: FitAnchor[],
  pose: CameraPose,
  image: { width: number; height: number },
  options: FitOptions = {},
): BoresightFit | null {
  if (anchors.length === 0) return null;
  const {
    yawRangeDeg = DEFAULT_YAW_RANGE_DEG,
    pitchRangeDeg = DEFAULT_PITCH_RANGE_DEG,
    coarseStepDeg = DEFAULT_COARSE_STEP_DEG,
    fineStepDeg = DEFAULT_FINE_STEP_DEG,
    baseModel = AMSTERDAM_WORLD_ALIGNED,
  } = options;

  const yawCentre = baseModel.boresightYawDeg ?? 0;
  const pitchCentre = baseModel.boresightPitchDeg ?? 0;

  const meanSquared = (yawDeg: number, pitchDeg: number): number => {
    let sum = 0;
    for (const anchor of anchors) {
      sum += squaredPixelResidual(anchor, pose, image, baseModel, yawDeg, pitchDeg);
    }
    return sum / anchors.length;
  };

  let bestYaw = yawCentre;
  let bestPitch = pitchCentre;
  let bestCost = meanSquared(bestYaw, bestPitch);

  const search = (yawFrom: number, yawTo: number, yawStep: number, pitchFrom: number, pitchTo: number, pitchStep: number) => {
    const yawCount = Math.max(0, Math.round((yawTo - yawFrom) / yawStep));
    const pitchCount = Math.max(0, Math.round((pitchTo - pitchFrom) / pitchStep));
    for (let i = 0; i <= yawCount; i++) {
      const yawDeg = yawFrom + i * yawStep;
      for (let j = 0; j <= pitchCount; j++) {
        const pitchDeg = pitchFrom + j * pitchStep;
        const cost = meanSquared(yawDeg, pitchDeg);
        if (cost < bestCost) {
          bestCost = cost;
          bestYaw = yawDeg;
          bestPitch = pitchDeg;
        }
      }
    }
  };

  search(
    yawCentre - yawRangeDeg,
    yawCentre + yawRangeDeg,
    coarseStepDeg,
    pitchCentre - pitchRangeDeg,
    pitchCentre + pitchRangeDeg,
    coarseStepDeg,
  );
  search(
    bestYaw - coarseStepDeg,
    bestYaw + coarseStepDeg,
    fineStepDeg,
    bestPitch - coarseStepDeg,
    bestPitch + coarseStepDeg,
    fineStepDeg,
  );

  return {
    yawDeg: Number(bestYaw.toFixed(4)),
    pitchDeg: Number(bestPitch.toFixed(4)),
    rmsPx: Number(Math.sqrt(bestCost).toFixed(4)),
    anchors: anchors.length,
  };
}

/**
 * Deterministic split sorted by pixel u then v, with every Nth anchor held out
 * for validation. Interleaving rather than slicing keeps both sets spanning the
 * facade instead of one owning the left edge and the other the right.
 */
export function splitAnchors<T extends { pixel: [number, number] }>(
  anchors: T[],
  options: { validationFraction?: number } = {},
): { calibration: T[]; validation: T[] } {
  if (anchors.length < 2) return { calibration: [...anchors], validation: [] };

  const fraction = options.validationFraction ?? DEFAULT_VALIDATION_FRACTION;
  const stride = Math.max(2, Math.round(1 / Math.max(fraction, Number.EPSILON)));
  const ordered = [...anchors].sort((a, b) => a.pixel[0] - b.pixel[0] || a.pixel[1] - b.pixel[1]);

  const calibration: T[] = [];
  const validation: T[] = [];
  ordered.forEach((anchor, index) => {
    if (index % stride === 0) validation.push(anchor);
    else calibration.push(anchor);
  });
  return { calibration, validation };
}

export interface CrossValidatedFit {
  fit: BoresightFit;
  validationRmsPx: number;
  validationMedianPx: number;
  validationCount: number;
}
/**
 * Fit on the calibration split and measure only on the held-out validation
 * split. Returns null when there are too few anchors to split at all, so the
 * caller must fall back to `fitBoresight` and mark that number optimistic
 * rather than presenting it as cross-validated.
 */
export function crossValidateBoresight(
  anchors: FitAnchor[],
  pose: CameraPose,
  image: { width: number; height: number },
  options: { validationFraction?: number; baseModel?: CameraModel } = {},
): CrossValidatedFit | null {
  const { calibration, validation } = splitAnchors(anchors, { validationFraction: options.validationFraction });
  if (calibration.length === 0 || validation.length === 0) return null;

  const fit = fitBoresight(calibration, pose, image, { baseModel: options.baseModel });
  if (!fit) return null;

  const baseModel = options.baseModel ?? AMSTERDAM_WORLD_ALIGNED;
  const residuals = validation.map((anchor) =>
    Math.sqrt(squaredPixelResidual(anchor, pose, image, baseModel, fit.yawDeg, fit.pitchDeg)),
  );
  const meanSquared = residuals.reduce((sum, r) => sum + r * r, 0) / residuals.length;

  return {
    fit,
    validationRmsPx: Number(Math.sqrt(meanSquared).toFixed(4)),
    validationMedianPx: Number(median(residuals).toFixed(4)),
    validationCount: validation.length,
  };
}

export interface RobustBoresightFit {
  fit: BoresightFit;
  inlierCount: number;
  /** Indices into the input array whose residual exceeded the trim threshold. */
  outlierIndices: number[];
  residualsPx: number[];
  medianPx: number;
}

/**
 * Robust fit: fit, flag anchors whose residual clearly exceeds the rest, refit
 * on the inliers. A single mis-clicked marker (wrong edge of the wall) should
 * be flagged rather than allowed to drag the whole panorama's boresight.
 * If trimming would leave fewer than `minInliers`, the original fit is kept and
 * the outliers are still reported, so an inconsistent panorama is visible as
 * inconsistent rather than silently fitted.
 */
export function fitBoresightRobust(
  anchors: FitAnchor[],
  pose: CameraPose,
  image: { width: number; height: number },
  options: FitOptions & { outlierFloorPx?: number; outlierMultiplier?: number; minInliers?: number } = {},
): RobustBoresightFit | null {
  if (anchors.length === 0) return null;
  const { outlierFloorPx = 20, outlierMultiplier = 3, minInliers = 3, baseModel = AMSTERDAM_WORLD_ALIGNED } = options;
  const residualsFor = (fit: BoresightFit, subset: FitAnchor[]): number[] =>
    subset.map((anchor) => Math.sqrt(squaredPixelResidual(anchor, pose, image, baseModel, fit.yawDeg, fit.pitchDeg)));

  const initial = fitBoresight(anchors, pose, image, options);
  if (!initial) return null;

  const initialResiduals = residualsFor(initial, anchors);
  const threshold = Math.max(outlierFloorPx, median(initialResiduals) * outlierMultiplier);
  const outlierIndices = initialResiduals.map((residual, index) => [residual, index] as const)
    .filter(([residual]) => residual > threshold).map(([, index]) => index);

  let fit = initial;
  if (outlierIndices.length && anchors.length - outlierIndices.length >= minInliers) {
    const outliers = new Set(outlierIndices);
    const refit = fitBoresight(anchors.filter((_, index) => !outliers.has(index)), pose, image, options);
    if (refit) fit = refit;
  }
  const residualsPx = residualsFor(fit, anchors);
  return {
    fit,
    inlierCount: anchors.length - outlierIndices.length,
    outlierIndices,
    residualsPx: residualsPx.map((residual) => Number(residual.toFixed(2))),
    medianPx: Number(median(residualsPx).toFixed(2)),
  };
}
