/**
 * Does a facade have a differently coloured ground floor, and where does it start?
 *
 * A single wall colour per building is wrong for most Amsterdam buildings, and
 * wrong exactly at eye level. The reviewed set showed a differently coloured
 * ground floor on 36 of 46 buildings whose base was visible: shopfronts,
 * rendered plinths, stone bases. The ground floor is also the most occluded part
 * of a crop (12 of 60 bases were behind a parked van, car or tree), so the
 * honest answer is sometimes *indeterminate*, not a guess between two options.
 *
 * This module measures the change from the crop itself. It bands the building's
 * own vertical extent — not the crop's, which carries sky above and pavement
 * below — into a row profile, finds the split where the colour above and below
 * differ most, and then refuses the split unless it is a material change rather
 * than a lighting gradient.
 *
 * The order is the design:
 *  1. Locate the building span as the contiguous rows that actually hold usable
 *     pixels. Sky and pavement are masked out; a span too short to divide is a
 *     `null`, not a guess.
 *  2. Band that span and measure each band with `dominantWallColour`, so there
 *     is one colour-finding method in the codebase. A band with too few usable
 *     pixels reports a `null` colour.
 *  3. Scan candidate splits and take the largest below/above colour distance.
 *     The top 15% and bottom 5% are skipped: a cornice or gable is not a ground
 *     floor, and the pavement edge is not a material.
 *  4. Call two-tone only when the split beats a minimum distance, beats the
 *     typical variation *within* each side, sits low enough to be a ground
 *     floor, and has enough bands and pixels on both sides. A split at 60%
 *     height is reported honestly as `two-tone-other`, not as a ground floor.
 *
 * The two-tone colours are measurements with their basis named. They are never
 * an accepted material and never a named hex from an eye — see the colour
 * constancy note in `dominantWallColour.ts` for why a pixel estimator must not
 * be tuned to match a perceived colour.
 */
import {
  dominantWallColour,
  type DominantWallColour,
  type DominantWallColourOptions,
} from './dominantWallColour.ts';
import { nearestMaterial, wallFamily, type MaterialFamily, type MaterialId } from './materials.ts';
import type { RgbImage } from './wallColourSample.ts';

export type FacadeBandVerdict =
  | 'one-tone'
  | 'two-tone-ground-floor'
  | 'two-tone-other'
  | 'indeterminate';

/** One horizontal slice of the building's own vertical extent. */
export interface FacadeBand {
  /** 0 is the topmost band; the array runs top to bottom. */
  index: number;
  /** Inclusive row range in the original image. */
  topRow: number;
  bottomRow: number;
  /** Vertical centre as a fraction up from the building base (0 base, 1 top). */
  baseFraction: number;
  usablePixels: number;
  /** The band's dominant colour, or null when it held too little to measure. */
  colour: DominantWallColour | null;
}

/** The aggregate colour and material of one side of a split. */
export interface FacadeBandSide {
  /** Bands on this side that contributed a colour. */
  bands: number;
  /** All usable pixels on this side, including bands with no colour. */
  usablePixels: number;
  rgb: [number, number, number];
  hex: string;
  family: Extract<MaterialFamily, 'brick' | 'paint' | 'stone'>;
  material: MaterialId;
  materialDistance: number;
  /** Largest distance of any contributing band from this side's mean colour. */
  variation: number;
}

export interface FacadeBandsSplit {
  /** Split height as a fraction up from the building base (0 base, 1 top). */
  baseFraction: number;
  /** Image row of the split: the last row counted on the upper side. */
  row: number;
  /** Colour distance between the two side means. */
  distance: number;
  /** The largest within-side band deviation the split had to beat. */
  withinVariation: number;
  above: FacadeBandSide;
  below: FacadeBandSide;
}

export interface FacadeBandsResult {
  topRow: number;
  bottomRow: number;
  spanHeight: number;
  usablePixels: number;
  /** The full profile, top to bottom, including bands with no colour. */
  bands: FacadeBand[];
  /** The best split, or null when the verdict is one-tone or indeterminate. */
  split: FacadeBandsSplit | null;
  verdict: FacadeBandVerdict;
  reason: string;
}

export interface FacadeBandsOptions {
  /** Number of horizontal bands across the building span. Default 12. */
  bandCount?: number;
  /** A row belongs to the building when this fraction of its pixels are usable.
   * Default 0.05. */
  minRowUsableFraction?: number;
  /** Absolute floor under `minRowUsableFraction`. Default 4. */
  minRowUsablePixels?: number;
  /** A band needs this many usable pixels before `dominantWallColour` runs.
   * Default 24. */
  minBandPixels?: number;
  /** A building span shorter than this fraction of the crop is not divided.
   * Default 0.25; below it the result is `null`. */
  minSpanFraction?: number;
  /** Splits below this height fraction are the pavement edge. Default 0.05. */
  minSplitFraction?: number;
  /** Splits above this height fraction are a cornice or gable. Default 0.85. */
  maxSplitFraction?: number;
  /** A split at or below this height fraction is a ground floor. Default 0.4. */
  groundFloorMaxFraction?: number;
  /** Below this below/above colour distance, a split is noise. Default 30. */
  minSplitDistance?: number;
  /** The split must exceed this multiple of the within-side variation, so a
   * shadow or weather gradient is not called a material change. Default 2.5. */
  minContrastRatio?: number;
  /** Bands with a colour required on each side of a candidate split. Default 2. */
  minBandsPerSide?: number;
  /** Usable pixels on each side, as a fraction of the building's total.
   * Default 0.1. */
  minSidePixelFraction?: number;
  /** If more than this fraction of the crop lies below the building span, the
   * base is not observed (a van, or the frame) and the ground floor cannot be
   * judged. Default 0.25. */
  maxBaseMarginFraction?: number;
  /** Passed through to `dominantWallColour` for each band. */
  dominant?: DominantWallColourOptions;
}

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const toHex = (rgb: [number, number, number]) =>
  '#' + rgb.map(value => clamp(Math.round(value), 0, 255).toString(16).padStart(2, '0')).join('');

/**
 * A colour distance built for *material* changes, not pixel deltas.
 *
 * Chroma is compared at full weight and lightness at a third, so a brick in
 * shadow stays near the same brick and a lighting gradient measures small. The
 * same weighting is used by `nearestMaterial`, which is the point: the distance
 * that decides a split is the distance the material taxonomy already trusts.
 */
export function bandColourDistance(a: [number, number, number], b: [number, number, number]): number {
  const dLight = ((a[0] + a[1] + a[2]) - (b[0] + b[1] + b[2])) / 3;
  const dRg = (a[0] - a[1]) - (b[0] - b[1]);
  const dGb = (a[1] - a[2]) - (b[1] - b[2]);
  return Math.sqrt(dRg * dRg + dGb * dGb + (dLight * dLight) / 9);
}

/** Pixel-weighted mean of a set of measured band colours. */
const meanColour = (bands: readonly FacadeBand[]): [number, number, number] => {
  let weight = 0, sumR = 0, sumG = 0, sumB = 0;
  for (const band of bands) {
    const colour = band.colour;
    if (!colour) continue;
    const w = Math.max(1, colour.pixels);
    weight += w;
    sumR += colour.rgb[0] * w;
    sumG += colour.rgb[1] * w;
    sumB += colour.rgb[2] * w;
  }
  if (weight === 0) return [0, 0, 0];
  return [sumR / weight, sumG / weight, sumB / weight];
};

const describeSide = (bands: readonly FacadeBand[]): FacadeBandSide => {
  const measured = bands.filter(band => band.colour !== null);
  const rgb = meanColour(measured);
  const rounded = rgb.map(value => clamp(Math.round(value), 0, 255)) as [number, number, number];
  const family = wallFamily(rounded);
  const nearest = nearestMaterial(rounded, family);
  let variation = 0;
  for (const band of measured) variation = Math.max(variation, bandColourDistance(band.colour!.rgb, rgb));
  return {
    bands: measured.length,
    usablePixels: bands.reduce((sum, band) => sum + band.usablePixels, 0),
    rgb: rounded,
    hex: toHex(rounded),
    family,
    material: nearest.material.id,
    materialDistance: Number(nearest.distance.toFixed(2)),
    variation: Number(variation.toFixed(2)),
  };
};

/**
 * Measure the horizontal bands of a facade and whether they split into a
 * differently coloured ground floor.
 *
 * A non-zero `mask` entry means "use this pixel"; zero excludes it (sky, trees,
 * vehicles and, in the real data, the building segmentation's other labels).
 * Returns `null` when the image is degenerate, when no pixel is usable, or when
 * the building span is too short to divide — an abstention, never a guess.
 */
export function facadeBands(
  image: RgbImage,
  mask?: Uint8Array | null,
  options: FacadeBandsOptions = {},
): FacadeBandsResult | null {
  const { width, height } = image;
  const channels = image.channels ?? 3;
  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) return null;
  if (image.data.length < width * height * channels) return null;

  const bandCount = Math.max(2, Math.floor(options.bandCount ?? 12));
  const minRowUsableFraction = options.minRowUsableFraction ?? 0.05;
  const minRowUsablePixels = options.minRowUsablePixels ?? 4;
  const minBandPixels = options.minBandPixels ?? 24;
  const minSpanFraction = options.minSpanFraction ?? 0.25;
  const minSplitFraction = options.minSplitFraction ?? 0.05;
  const maxSplitFraction = options.maxSplitFraction ?? 0.85;
  const groundFloorMaxFraction = options.groundFloorMaxFraction ?? 0.4;
  const minSplitDistance = options.minSplitDistance ?? 30;
  const minContrastRatio = options.minContrastRatio ?? 2.5;
  const minBandsPerSide = options.minBandsPerSide ?? 2;
  const minSidePixelFraction = options.minSidePixelFraction ?? 0.1;
  const maxBaseMarginFraction = options.maxBaseMarginFraction ?? 0.25;
  const usableMask = mask && mask.length === width * height ? mask : null;

  // How many usable pixels each row holds. Sky and pavement fall below the row
  // threshold; a full-width van does too, which is why the base margin below is
  // also checked.
  const rowUsable = new Int32Array(height);
  let usablePixels = 0;
  for (let y = 0; y < height; y++) {
    let count = 0;
    for (let x = 0; x < width; x++) {
      const index = y * width + x;
      if (!usableMask || usableMask[index] !== 0) count += 1;
    }
    rowUsable[y] = count;
    usablePixels += count;
  }
  if (usablePixels === 0) return null;

  const rowThreshold = Math.max(minRowUsablePixels, Math.ceil(width * minRowUsableFraction));
  let topRow = -1;
  let bottomRow = -1;
  for (let y = 0; y < height; y++) if (rowUsable[y] >= rowThreshold) { topRow = y; break; }
  for (let y = height - 1; y >= 0; y--) if (rowUsable[y] >= rowThreshold) { bottomRow = y; break; }
  if (topRow < 0 || bottomRow < topRow) return null;

  const spanHeight = bottomRow - topRow + 1;
  if (spanHeight < Math.max(2, Math.floor(height * minSpanFraction))) return null;

  // Band the span itself. The bottom band is inclusive of `bottomRow`; the
  // fraction is taken from the base so the bottom band is near 0 and the top
  // near 1, which is how a reader thinks about a ground floor.
  const bands: FacadeBand[] = [];
  for (let index = 0; index < bandCount; index++) {
    const bandTop = topRow + Math.floor((index * spanHeight) / bandCount);
    const bandBottom = topRow + Math.floor(((index + 1) * spanHeight) / bandCount) - 1;
    const centre = (bandTop + bandBottom) / 2;
    const baseFraction = spanHeight <= 1 ? 0 : clamp((bottomRow - centre) / (spanHeight - 1), 0, 1);
    if (bandBottom < bandTop) {
      bands.push({ index, topRow: bandTop, bottomRow: bandBottom, baseFraction, usablePixels: 0, colour: null });
      continue;
    }

    let bandUsable = 0;
    for (let y = bandTop; y <= bandBottom; y++) bandUsable += rowUsable[y];

    let colour: DominantWallColour | null = null;
    if (bandUsable >= minBandPixels) {
      const bandHeight = bandBottom - bandTop + 1;
      const bandData = new Uint8Array(width * bandHeight * channels);
      const bandMask = usableMask ? new Uint8Array(width * bandHeight) : null;
      for (let r = 0; r < bandHeight; r++) {
        const source = (bandTop + r) * width;
        for (let k = 0; k < width; k++) {
          if (bandMask) bandMask[r * width + k] = usableMask![source + k];
          for (let c = 0; c < channels; c++) bandData[(r * width + k) * channels + c] = image.data[(source + k) * channels + c];
        }
      }
      colour = dominantWallColour({ data: bandData, width, height: bandHeight, channels }, bandMask, options.dominant);
    }
    bands.push({ index, topRow: bandTop, bottomRow: bandBottom, baseFraction, usablePixels: bandUsable, colour });
  }

  // A large unobserved region below the span means the base is hidden — by a
  // parked van, or by the crop framing — so the ground floor cannot be judged.
  // The real masks zero vehicles and pavement alike; this margin is what keeps a
  // van from being read as an unusually high building base.
  const baseMargin = height - 1 - bottomRow;
  const baseObscured = baseMargin > height * maxBaseMarginFraction;

  const totalUsable = bands.reduce((sum, band) => sum + band.usablePixels, 0);

  // Candidate splits sit between bands. Both sides must hold enough measured
  // bands and enough pixels, and the split must not be in the pavement edge or
  // the cornice/gable cap.
  let best: { splitIndex: number; distance: number } | null = null;
  for (let splitIndex = 1; splitIndex < bandCount; splitIndex++) {
    const aboveBands = bands.slice(0, splitIndex);
    const belowBands = bands.slice(splitIndex);
    const aboveColour = aboveBands.filter(band => band.colour !== null);
    const belowColour = belowBands.filter(band => band.colour !== null);
    if (aboveColour.length < minBandsPerSide || belowColour.length < minBandsPerSide) continue;

    const abovePixels = aboveBands.reduce((sum, band) => sum + band.usablePixels, 0);
    const belowPixels = belowBands.reduce((sum, band) => sum + band.usablePixels, 0);
    if (abovePixels < totalUsable * minSidePixelFraction || belowPixels < totalUsable * minSidePixelFraction) continue;

    const splitFraction = (bottomRow - bands[splitIndex - 1].bottomRow) / spanHeight;
    if (splitFraction < minSplitFraction || splitFraction > maxSplitFraction) continue;

    const distance = bandColourDistance(meanColour(aboveColour), meanColour(belowColour));
    if (!best || distance > best.distance) best = { splitIndex, distance };
  }

  if (baseObscured) {
    return {
      topRow, bottomRow, spanHeight, usablePixels, bands, split: null,
      verdict: 'indeterminate',
      reason: `base of the building is not observed: ${baseMargin} of ${height} rows below the span are usable`,
    };
  }
  if (!best) {
    return {
      topRow, bottomRow, spanHeight, usablePixels, bands, split: null,
      verdict: 'indeterminate',
      reason: 'no split has enough measured bands and pixels on both sides',
    };
  }

  const splitRow = bands[best.splitIndex - 1].bottomRow;
  const splitFraction = (bottomRow - splitRow) / spanHeight;
  const above = describeSide(bands.slice(0, best.splitIndex));
  const below = describeSide(bands.slice(best.splitIndex));
  const withinVariation = Math.max(above.variation, below.variation);

  if (best.distance < minSplitDistance) {
    return {
      topRow, bottomRow, spanHeight, usablePixels, bands, split: null,
      verdict: 'one-tone',
      reason: `no material change: strongest split distance ${best.distance.toFixed(1)} is below the ${minSplitDistance} minimum`,
    };
  }
  // A gradient darkens every band a little; a material change moves the two
  // sides apart while each side stays coherent. Requiring the split to beat the
  // largest within-side deviation by a factor is what separates the two, and a
  // floor keeps a perfectly flat pair (variation 0) from passing on a rounding
  // error.
  if (best.distance < minContrastRatio * Math.max(1, withinVariation)) {
    return {
      topRow, bottomRow, spanHeight, usablePixels, bands, split: null,
      verdict: 'one-tone',
      reason: `change is a gradation, not a material: distance ${best.distance.toFixed(1)} vs within-side variation ${withinVariation.toFixed(1)}`,
    };
  }

  const split: FacadeBandsSplit = {
    baseFraction: Number(splitFraction.toFixed(4)),
    row: splitRow,
    distance: Number(best.distance.toFixed(2)),
    withinVariation,
    above,
    below,
  };
  if (splitFraction <= groundFloorMaxFraction) {
    return {
      topRow, bottomRow, spanHeight, usablePixels, bands, split,
      verdict: 'two-tone-ground-floor',
      reason: `the colour changes at ${(splitFraction * 100).toFixed(0)}% height, within a ground floor`,
    };
  }
  return {
    topRow, bottomRow, spanHeight, usablePixels, bands, split,
    verdict: 'two-tone-other',
    reason: `the colour changes at ${(splitFraction * 100).toFixed(0)}% height, too high for a ground floor`,
  };
}
