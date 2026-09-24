/** Heuristics to find where a building actually sits in a facade crop.
 *
 * Registration can be a little off, but the façade's vertical structure is
 * visible: a building is a run of strong vertical edges bounded by weaker
 * background (sky, street, neighbouring mass). This module measures that run
 * and reports how far its centre is from where the registration says the wall
 * centre should be, so a small correction can be inferred instead of requiring
 * a perfect fit. It is a heuristic, not a registration.
 */
import { edgeMaps, type GrayImage } from './edgeSupport.ts';

export interface FacadeBounds {
  leftPx: number;
  rightPx: number;
  centrePx: number;
  /** Fraction of the crop width covered by the detected building run. */
  coverage: number;
  /** Mean vertical-edge energy inside the run. */
  strength: number;
}

export interface CenteringResult extends FacadeBounds {
  /** Detected centre minus the expected wall centre, in pixels. */
  offsetPx: number;
}

/** Column-wise vertical-edge energy (horizontal gradient summed down each column). */
export function columnEdgeProfile(image: GrayImage): Float64Array {
  const maps = edgeMaps(image);
  const profile = new Float64Array(image.width);
  for (let x = 0; x < image.width; x++) {
    let sum = 0;
    for (let y = 0; y < image.height; y++) sum += maps.gx[y * image.width + x];
    profile[x] = sum;
  }
  return profile;
}

const mean = (values: ArrayLike<number>) => {
  let sum = 0;
  for (let i = 0; i < values.length; i++) sum += values[i];
  return values.length ? sum / values.length : 0;
};

/**
 * Longest contiguous run of columns above `thresholdFraction` of the mean
 * profile, measured on a smoothed profile because a real facade has vertical
 * edges spaced apart (window bays) with quiet columns between them. A flat
 * profile (uniform texture or empty background) has no run and returns null,
 * which callers must treat as "cannot tell", never as centred.
 */
export function detectFacadeBounds(
  profile: Float64Array,
  options: { thresholdFraction?: number; minCoverageFraction?: number; smoothFraction?: number } = {},
): FacadeBounds | null {
  const { thresholdFraction = 0.6, minCoverageFraction = 0.15, smoothFraction = 0.06 } = options;
  if (profile.length === 0) return null;
  const average = mean(profile);
  if (average <= 0) return null;

  // Box-smooth so the gaps between window-bay edges do not break the run.
  const half = Math.max(1, Math.round(profile.length * smoothFraction / 2));
  const smoothed = new Float64Array(profile.length);
  for (let x = 0; x < profile.length; x++) {
    let sum = 0, count = 0;
    for (let k = x - half; k <= x + half; k++) {
      if (k < 0 || k >= profile.length) continue;
      sum += profile[k]; count += 1;
    }
    smoothed[x] = count ? sum / count : 0;
  }
  const smoothedMean = mean(smoothed);
  const threshold = smoothedMean * thresholdFraction;

  let bestStart = -1, bestEnd = -1, start = -1;
  for (let x = 0; x <= smoothed.length; x++) {
    const above = x < smoothed.length && smoothed[x] >= threshold;
    if (above && start < 0) start = x;
    if (!above && start >= 0) {
      if (bestStart < 0 || x - start > bestEnd - bestStart) { bestStart = start; bestEnd = x; }
      start = -1;
    }
  }
  if (bestStart < 0) return null;
  const coverage = (bestEnd - bestStart) / profile.length;
  if (coverage < minCoverageFraction) return null;

  let strength = 0;
  for (let x = bestStart; x < bestEnd; x++) strength += profile[x];
  strength /= (bestEnd - bestStart);
  return {
    leftPx: bestStart,
    rightPx: bestEnd - 1,
    centrePx: (bestStart + bestEnd - 1) / 2,
    coverage,
    strength,
  };
}

/** Detected building centre versus the registered wall centre. */
export function centreOffset(image: GrayImage, expectedCentrePx: number, options?: { thresholdFraction?: number }): CenteringResult | null {
  const bounds = detectFacadeBounds(columnEdgeProfile(image), options);
  if (!bounds) return null;
  return { ...bounds, offsetPx: Number((bounds.centrePx - expectedCentrePx).toFixed(2)) };
}
