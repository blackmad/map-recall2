/** Cheap pre-inference crop usability check.
 *
 * The plan calls for routing unusable crops (blank, blurred, mostly sky,
 * featureless) to another view or `unknown` before any model runs. This is a
 * pure heuristic over a single-channel image: it never claims a crop is a
 * *correct* observation, only that it is worth or not worth interpreting.
 */
import { gradientMagnitude, type GrayImage } from './edgeSupport.ts';

export interface CropPreflightMetrics {
  meanLuma: number;
  stdevLuma: number;
  edgeDensity: number;
  /** Fraction of image rows that are sky rows (mean luma at or above the sky threshold). */
  skyRowFraction: number;
}

export interface CropPreflight {
  usable: boolean;
  reasons: string[];
  metrics: CropPreflightMetrics;
}

export interface CropPreflightOptions {
  minStdev?: number;
  minEdgeDensity?: number;
  maxSkyRowFraction?: number;
  edgeThreshold?: number;
  skyLuma?: number;
}

export function preflightCrop(image: GrayImage, options: CropPreflightOptions = {}): CropPreflight {
  const {
    minStdev = 8,
    minEdgeDensity = 0.01,
    maxSkyRowFraction = 0.5,
    edgeThreshold = 40,
    skyLuma = 200,
  } = options;
  const { data, width, height } = image;
  const count = width * height;
  if (!count) return { usable: false, reasons: ['empty-image'], metrics: { meanLuma: 0, stdevLuma: 0, edgeDensity: 0, skyRowFraction: 0 } };

  let sum = 0;
  for (let i = 0; i < count; i++) sum += data[i];
  const meanLuma = sum / count;
  let variance = 0;
  for (let i = 0; i < count; i++) variance += (data[i] - meanLuma) ** 2;
  const stdevLuma = Math.sqrt(variance / count);

  const magnitude = gradientMagnitude(image);
  let edges = 0;
  for (let i = 0; i < count; i++) if (magnitude[i] > edgeThreshold) edges += 1;
  const edgeDensity = edges / count;

  // Sky is bright and occupies whole rows near the top; a row is a sky row when
  // its mean luma is at or above the threshold. Measuring the whole height, not
  // just the top band, is what distinguishes a sky-dominated crop from a tall
  // building crop that merely has a little sky above the roofline.
  let skyRows = 0;
  for (let y = 0; y < height; y++) {
    let rowSum = 0;
    for (let x = 0; x < width; x++) rowSum += data[y * width + x];
    if (rowSum / width >= skyLuma) skyRows += 1;
  }
  const skyRowFraction = skyRows / height;

  const reasons: string[] = [];
  if (stdevLuma < minStdev) reasons.push('blank-or-flat');
  if (edgeDensity < minEdgeDensity) reasons.push('featureless');
  if (skyRowFraction > maxSkyRowFraction) reasons.push('mostly-sky');
  return { usable: reasons.length === 0, reasons, metrics: { meanLuma, stdevLuma, edgeDensity, skyRowFraction } };
}
