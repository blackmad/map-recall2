/**
 * Does a facade have a differently coloured ground floor, and where does it start?
 *
 * A single wall colour per building is wrong for most Amsterdam buildings, and
 * wrong exactly at eye level: 36 of 46 reviewed bases differ from the wall above
 * them. The change is a shopfront, a rendered plinth or a stone base — none of
 * which is masonry, all of which are the wall's own pixels.
 *
 * That last point is the whole design. An earlier version measured each band
 * with `dominantWallColour`, whose job is to find masonry and which rejects blue
 * glass, near-white joinery and dark shopfronts by design. It therefore threw
 * away the ground floor and returned the brick above it: 1 of 36 differences
 * found. Here bands are compared on the **raw colour of whatever is there**,
 * with no material rejection, because the question is "does the lower facade
 * differ from the upper", not "what masonry is each band". Material is
 * classified only after a split exists.
 *
 * The order is the design:
 *  1. Locate the facade span from the building rows, then extend its base
 *     downward through occluder-only rows. A van that crosses the whole facade
 *     would otherwise truncate the span above the shopfront, which is the very
 *     silent fallback this module must not make; sky and pavement never extend
 *     it, so an ordinary crop gains nothing.
 *  2. Band the span, and take each band's colour as the component-wise median of
 *     its raw building pixels — robust to a bright sign or a dark doorway,
 *     without deciding what is or is not wall.
 *  3. Find the change-point: the split whose windowed below/above colour step is
 *     largest, judged against the median step across all candidate splits. A
 *     material boundary is a spike in an otherwise flat step profile; a shadow
 *     or weather gradient moves every split by a similar amount and is not.
 *  4. Abstain when the base is occluded. The segmentation contract separates
 *     `building` from `occluder`, so a van, tree or person standing in front of
 *     the ground floor is visible as occluder pixels in the lowest part of the
 *     span. A confident verdict over a hidden base is a failure, not a success.
 *
 * The two-tone colours are measurements with their basis named. They are never
 * an accepted material and never a named hex from an eye — a human discounts the
 * illuminant and a pixel estimator must not be tuned to imitate that.
 */
import { nearestMaterial, wallFamily, type MaterialFamily, type MaterialId } from './materials.ts';
import type { RgbImage } from './wallColourSample.ts';

export type FacadeBandVerdict =
  | 'one-tone'
  | 'two-tone-ground-floor'
  | 'two-tone-other'
  | 'indeterminate';

/**
 * The segmentation contract the label image must follow (see
 * `scripts/roofline-eval/segment.py`). The module only knows these five ids, so
 * it stays independent of any particular segmenter.
 */
export const SEGMENT_OTHER = 0;
export const SEGMENT_SKY = 1;
export const SEGMENT_BUILDING = 2;
export const SEGMENT_OCCLUDER = 3;
export const SEGMENT_UNKNOWN = 255;

/** A raw colour measured from a band's building pixels; no material claim. */
export interface BandColour {
  rgb: [number, number, number];
  hex: string;
  /** Building pixels the median was taken over. */
  pixels: number;
}

/** One horizontal slice of the facade's own vertical extent. */
export interface FacadeBand {
  /** 0 is the topmost band; the array runs top to bottom. */
  index: number;
  /** Inclusive row range in the original image. */
  topRow: number;
  bottomRow: number;
  /** Vertical centre as a fraction up from the facade base (0 base, 1 top). */
  baseFraction: number;
  /** Pixels the segmentation calls building; the colour population. */
  buildingPixels: number;
  /** Pixels the segmentation calls occluder (vehicle, tree, person, pole). */
  occluderPixels: number;
  /** The band's raw median colour, or null when too little was building. */
  colour: BandColour | null;
}

/** The aggregate colour and material of one side of a split. */
export interface FacadeBandSide {
  /** Bands on this side that contributed a colour. */
  bands: number;
  /** Building pixels on this side, including bands with no colour. */
  buildingPixels: number;
  rgb: [number, number, number];
  hex: string;
  family: Extract<MaterialFamily, 'brick' | 'paint' | 'stone'>;
  material: MaterialId;
  materialDistance: number;
}

export interface FacadeBandsSplit {
  /** Split height as a fraction up from the facade base (0 base, 1 top). */
  baseFraction: number;
  /** Image row of the split: the last row counted on the upper side. */
  row: number;
  /** Windowed colour step across the split: the change-point statistic. */
  step: number;
  /** Median windowed step across every candidate split: the noise the step
   *  had to beat. A gradient has a step close to this; a material boundary is
   *  a spike well above it. */
  noiseFloor: number;
  above: FacadeBandSide;
  below: FacadeBandSide;
}

export interface FacadeBandsResult {
  topRow: number;
  bottomRow: number;
  spanHeight: number;
  /** Building pixels in the span. */
  buildingPixels: number;
  /** Occluder fraction in the lowest `occlusionWindowFraction` of the span. */
  baseOccluderFraction: number;
  bands: FacadeBand[];
  split: FacadeBandsSplit | null;
  verdict: FacadeBandVerdict;
  reason: string;
}

export interface FacadeBandsOptions {
  /** Number of horizontal bands across the facade span. Default 12. */
  bandCount?: number;
  /** A row belongs to the facade when this fraction is building or occluder.
   * Default 0.05. */
  minRowFacadeFraction?: number;
  /** Absolute floor under `minRowFacadeFraction`. Default 4. */
  minRowFacadePixels?: number;
  /** A band needs this many building pixels before a colour is reported.
   * Default 24. */
  minBandPixels?: number;
  /** A facade span shorter than this fraction of the crop is not divided.
   * Default 0.25; below it the result is `null`. */
  minSpanFraction?: number;
  /** Splits below this height fraction are the pavement edge. Default 0.05. */
  minSplitFraction?: number;
  /** Splits above this height fraction are a cornice or gable. Default 0.85. */
  maxSplitFraction?: number;
  /** A split at or below this height fraction is a ground floor. Default 0.4. */
  groundFloorMaxFraction?: number;
  /** Bands averaged on each side of a candidate split. Three smooths a single
   * band that caught a window or a sign. Default 3. */
  windowBands?: number;
  /** Below this change-point step, a split is noise. Default 10. */
  minSplitStep?: number;
  /** The step must exceed this multiple of the median step across candidate
   * splits, so a shadow or weather gradient is not a material change. A real
   * boundary is a spike; a gradient is a plateau. Default 1.2, which is
   * deliberately slack: it rejects a uniform ramp, not every band-to-band
   * wobble, and the minimum step above is the stronger gate. The gold-set sweep
   * never beat this point on strict accuracy, only moved where the error fell. */
  changePointRatio?: number;
  /** Building pixels required on each side of a split, as a fraction of the
   * span total. Default 0.1. */
  minSidePixelFraction?: number;
  /** Fraction of the span, measured up from the base, searched for occluders.
   * Default 0.28. */
  occlusionWindowFraction?: number;
  /** At or above this occluder fraction in the base window the ground floor is
   * unobserved and the answer is indeterminate. Default 0.25. The whole sweep,
   * 0.15 to 0.4, traded obscured recall against false abstentions on `same`
   * with no free setting: the occluder class cannot tell a van in front of a
   * shopfront from a tree beside one. 0.25 is chosen for the balance, 11 of 12
   * `obscured` against 14 of 46 false abstentions; rectifying that limitation
   * needs a wall-vs-non-wall label, not a threshold. */
  maxBaseOccluderFraction?: number;
  /** Occluder pixels needed before that fraction is trusted. Default 8. */
  minOccluderPixels?: number;
}

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const toHex = (rgb: [number, number, number]) =>
  '#' + rgb.map(value => clamp(Math.round(value), 0, 255).toString(16).padStart(2, '0')).join('');

/**
 * A colour distance built for *material* changes, not pixel deltas.
 *
 * Chroma is compared at full weight and lightness at a third, so a brick in
 * shadow stays near the same brick and a lighting gradient measures small. This
 * only shapes the statistic; the change-point test is what actually separates a
 * boundary from a gradient.
 */
export function bandColourDistance(a: [number, number, number], b: [number, number, number]): number {
  const dLight = ((a[0] + a[1] + a[2]) - (b[0] + b[1] + b[2])) / 3;
  const dRg = (a[0] - a[1]) - (b[0] - b[1]);
  const dGb = (a[1] - a[2]) - (b[1] - b[2]);
  return Math.sqrt(dRg * dRg + dGb * dGb + (dLight * dLight) / 9);
}

/** Component-wise median of a band's building pixels: a raw, outlier-resistant
 *  colour with no judgement about material. */
const medianColour = (bands: readonly FacadeBand[]): [number, number, number] => {
  const reds: number[] = [], greens: number[] = [], blues: number[] = [];
  for (const band of bands) {
    if (!band.colour) continue;
    reds.push(band.colour.rgb[0]); greens.push(band.colour.rgb[1]); blues.push(band.colour.rgb[2]);
  }
  if (!reds.length) return [0, 0, 0];
  const mid = (values: number[]) => {
    values.sort((a, b) => a - b);
    return values.length % 2 ? values[(values.length - 1) / 2] : (values[values.length / 2 - 1] + values[values.length / 2]) / 2;
  };
  return [mid(reds), mid(greens), mid(blues)];
};

/** Pixel-weighted mean of a band set's colours, for a side's reported colour. */
const meanColour = (bands: readonly FacadeBand[]): [number, number, number] => {
  let weight = 0, sumR = 0, sumG = 0, sumB = 0;
  for (const band of bands) {
    if (!band.colour) continue;
    const w = Math.max(1, band.colour.pixels);
    weight += w;
    sumR += band.colour.rgb[0] * w;
    sumG += band.colour.rgb[1] * w;
    sumB += band.colour.rgb[2] * w;
  }
  return weight ? [sumR / weight, sumG / weight, sumB / weight] : [0, 0, 0];
};

const describeSide = (bands: readonly FacadeBand[]): FacadeBandSide => {
  const measured = bands.filter(band => band.colour !== null);
  const rgb = meanColour(measured);
  const rounded = rgb.map(value => clamp(Math.round(value), 0, 255)) as [number, number, number];
  const family = wallFamily(rounded);
  const nearest = nearestMaterial(rounded, family);
  return {
    bands: measured.length,
    buildingPixels: bands.reduce((sum, band) => sum + band.buildingPixels, 0),
    rgb: rounded,
    hex: toHex(rounded),
    family,
    material: nearest.material.id,
    materialDistance: Number(nearest.distance.toFixed(2)),
  };
};

const median = (values: number[]): number => {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted.length % 2 ? sorted[(sorted.length - 1) / 2] : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2;
};

/**
 * Measure the bands of a facade and whether they split into a differently
 * coloured ground floor.
 *
 * `labels` is the segmentation contract (`0` other, `1` sky, `2` building,
 * `3` occluder, `255` unknown); building pixels are the colour population and
 * occluder pixels drive abstention. Pass `null` when no segmentation is
 * available — every pixel is then treated as building and occlusion is not
 * assessed. Returns `null` when the image is degenerate, when nothing is
 * building, or when the facade span is too short to divide.
 */
export function facadeBands(
  image: RgbImage,
  labels?: Uint8Array | null,
  options: FacadeBandsOptions = {},
): FacadeBandsResult | null {
  const { width, height } = image;
  const channels = image.channels ?? 3;
  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) return null;
  if (image.data.length < width * height * channels) return null;

  const bandCount = Math.max(2, Math.floor(options.bandCount ?? 12));
  const minRowFacadeFraction = options.minRowFacadeFraction ?? 0.05;
  const minRowFacadePixels = options.minRowFacadePixels ?? 4;
  const minBandPixels = options.minBandPixels ?? 24;
  const minSpanFraction = options.minSpanFraction ?? 0.25;
  const minSplitFraction = options.minSplitFraction ?? 0.05;
  const maxSplitFraction = options.maxSplitFraction ?? 0.85;
  const groundFloorMaxFraction = options.groundFloorMaxFraction ?? 0.4;
  const windowBands = Math.max(1, Math.floor(options.windowBands ?? 3));
  const minSplitStep = options.minSplitStep ?? 10;
  const changePointRatio = options.changePointRatio ?? 1.2;
  const minSidePixelFraction = options.minSidePixelFraction ?? 0.1;
  const occlusionWindowFraction = options.occlusionWindowFraction ?? 0.28;
  const maxBaseOccluderFraction = options.maxBaseOccluderFraction ?? 0.25;
  const minOccluderPixels = options.minOccluderPixels ?? 8;
  const labelMap = labels && labels.length === width * height ? labels : null;

  const isBuilding = (index: number) => labelMap ? labelMap[index] === SEGMENT_BUILDING : true;
  const isOccluder = (index: number) => labelMap ? labelMap[index] === SEGMENT_OCCLUDER : false;

  // The span is the building's own rows, extended down through occluder-only
  // rows: a van across the whole facade would otherwise end the span above the
  // shopfront, which is the silent fallback this module must not make. Sky and
  // pavement extend nothing, so an ordinary crop is unaffected.
  const rowBuilding = new Int32Array(height);
  const rowOccluder = new Int32Array(height);
  let buildingPixels = 0;
  for (let y = 0; y < height; y++) {
    let building = 0, occluder = 0;
    for (let x = 0; x < width; x++) {
      const index = y * width + x;
      if (isBuilding(index)) building += 1;
      else if (isOccluder(index)) occluder += 1;
    }
    rowBuilding[y] = building;
    rowOccluder[y] = occluder;
    buildingPixels += building;
  }
  if (buildingPixels === 0) return null;

  const rowThreshold = Math.max(minRowFacadePixels, Math.ceil(width * minRowFacadeFraction));
  let topRow = -1;
  let bottomRow = -1;
  for (let y = 0; y < height; y++) if (rowBuilding[y] >= rowThreshold) { topRow = y; break; }
  for (let y = height - 1; y >= 0; y--) if (rowBuilding[y] >= rowThreshold) { bottomRow = y; break; }
  if (topRow < 0 || bottomRow < topRow) return null;
  while (bottomRow + 1 < height && rowBuilding[bottomRow + 1] < rowThreshold && rowOccluder[bottomRow + 1] >= rowThreshold) {
    bottomRow += 1;
  }

  const spanHeight = bottomRow - topRow + 1;
  if (spanHeight < Math.max(2, Math.floor(height * minSpanFraction))) return null;

  // Band the span. Each colour is the median of the band's raw building pixels,
  // so a sign or a doorway moves it little and a genuine change of material
  // moves it a lot. The fraction is taken from the base so the bottom band is
  // near 0 and the top near 1, which is how a ground floor is reasoned about
  const bands: FacadeBand[] = [];
  for (let index = 0; index < bandCount; index++) {
    const bandTop = topRow + Math.floor((index * spanHeight) / bandCount);
    const bandBottom = topRow + Math.floor(((index + 1) * spanHeight) / bandCount) - 1;
    const centre = (bandTop + bandBottom) / 2;
    const baseFraction = spanHeight <= 1 ? 0 : clamp((bottomRow - centre) / (spanHeight - 1), 0, 1);
    if (bandBottom < bandTop) {
      bands.push({ index, topRow: bandTop, bottomRow: bandBottom, baseFraction, buildingPixels: 0, occluderPixels: 0, colour: null });
      continue;
    }

    let bandBuilding = 0, bandOccluder = 0;
    for (let y = bandTop; y <= bandBottom; y++) { bandBuilding += rowBuilding[y]; bandOccluder += rowOccluder[y]; }

    let colour: BandColour | null = null;
    if (bandBuilding >= minBandPixels) {
      const reds: number[] = [], greens: number[] = [], blues: number[] = [];
      for (let y = bandTop; y <= bandBottom; y++) {
        const row = y * width;
        for (let x = 0; x < width; x++) {
          const index = row + x;
          if (!isBuilding(index)) continue;
          const i = index * channels;
          reds.push(image.data[i]); greens.push(image.data[i + 1]); blues.push(image.data[i + 2]);
        }
      }
      const pick = (values: number[]) => {
        values.sort((a, b) => a - b);
        return values.length % 2 ? values[(values.length - 1) / 2] : (values[values.length / 2 - 1] + values[values.length / 2]) / 2;
      };
      const rgb: [number, number, number] = [pick(reds), pick(greens), pick(blues)];
      colour = { rgb, hex: toHex(rgb), pixels: reds.length };
    }
    bands.push({ index, topRow: bandTop, bottomRow: bandBottom, baseFraction, buildingPixels: bandBuilding, occluderPixels: bandOccluder, colour });
  }

  // Occlusion is read from the label map, not inferred from coverage. A van,
  // tree or person in front of the ground floor is occluder pixels in the
  // lowest part of the span; anything above that is the facade. A confident
  // ground-floor verdict over a hidden base is the failure this prevents.
  const occlusionTop = bottomRow - Math.floor(occlusionWindowFraction * spanHeight) + 1;
  let baseOccluder = 0, baseBuilding = 0;
  for (let y = Math.max(topRow, occlusionTop); y <= bottomRow; y++) { baseOccluder += rowOccluder[y]; baseBuilding += rowBuilding[y]; }
  const baseOccluderFraction = baseOccluder + baseBuilding > 0 ? baseOccluder / (baseOccluder + baseBuilding) : 0;
  if (labelMap && baseOccluder >= minOccluderPixels && baseOccluderFraction >= maxBaseOccluderFraction) {
    return {
      topRow, bottomRow, spanHeight, buildingPixels, baseOccluderFraction, bands, split: null,
      verdict: 'indeterminate',
      reason: `ground floor is occluded: ${(baseOccluderFraction * 100).toFixed(0)}% of the base window is occluder (${baseOccluder} px)`,
    };
  }

  // The change-point statistic. For every candidate split, take the mean colour
  // of `windowBands` bands on each side (which smooths a single band that
  // caught a window or sign) and measure the colour step between them. A
  // material boundary is a spike in this step profile; a shadow or weather
  // gradient raises every split by a similar amount, so the median step across
  // all candidates is the noise floor a real split has to clear.
  const totalBuilding = bands.reduce((sum, band) => sum + band.buildingPixels, 0);
  const candidates: Array<{ splitIndex: number; step: number }> = [];
  for (let splitIndex = windowBands; splitIndex <= bandCount - windowBands; splitIndex++) {
    const aboveWindow = bands.slice(splitIndex - windowBands, splitIndex);
    const belowWindow = bands.slice(splitIndex, splitIndex + windowBands);
    if (aboveWindow.some(band => !band.colour) || belowWindow.some(band => !band.colour)) continue;

    const abovePixels = bands.slice(0, splitIndex).reduce((sum, band) => sum + band.buildingPixels, 0);
    const belowPixels = bands.slice(splitIndex).reduce((sum, band) => sum + band.buildingPixels, 0);
    if (abovePixels < totalBuilding * minSidePixelFraction || belowPixels < totalBuilding * minSidePixelFraction) continue;

    const splitFraction = (bottomRow - bands[splitIndex - 1].bottomRow) / spanHeight;
    if (splitFraction < minSplitFraction || splitFraction > maxSplitFraction) continue;

    candidates.push({ splitIndex, step: bandColourDistance(meanColour(aboveWindow), meanColour(belowWindow)) });
  }

  if (!candidates.length) {
    return {
      topRow, bottomRow, spanHeight, buildingPixels, baseOccluderFraction, bands, split: null,
      verdict: 'indeterminate',
      reason: 'no split has enough measured bands on both sides',
    };
  }

  const noiseFloor = median(candidates.map(candidate => candidate.step));
  const best = candidates.reduce((a, b) => (b.step > a.step ? b : a));
  const splitRow = bands[best.splitIndex - 1].bottomRow;
  const splitFraction = (bottomRow - splitRow) / spanHeight;
  const above = describeSide(bands.slice(0, best.splitIndex));
  const below = describeSide(bands.slice(best.splitIndex));
  const split: FacadeBandsSplit = {
    baseFraction: Number(splitFraction.toFixed(4)),
    row: splitRow,
    step: Number(best.step.toFixed(2)),
    noiseFloor: Number(noiseFloor.toFixed(2)),
    above,
    below,
  };

  if (best.step < minSplitStep) {
    return {
      topRow, bottomRow, spanHeight, buildingPixels, baseOccluderFraction, bands, split: null,
      verdict: 'one-tone',
      reason: `no material change: strongest step ${best.step.toFixed(1)} is below the ${minSplitStep} minimum`,
    };
  }
  if (best.step < changePointRatio * Math.max(1, noiseFloor)) {
    return {
      topRow, bottomRow, spanHeight, buildingPixels, baseOccluderFraction, bands, split: null,
      verdict: 'one-tone',
      reason: `change is a gradation, not a boundary: step ${best.step.toFixed(1)} against a median step of ${noiseFloor.toFixed(1)}`,
    };
  }
  if (splitFraction <= groundFloorMaxFraction) {
    return {
      topRow, bottomRow, spanHeight, buildingPixels, baseOccluderFraction, bands, split,
      verdict: 'two-tone-ground-floor',
      reason: `the colour changes at ${(splitFraction * 100).toFixed(0)}% height, within a ground floor`,
    };
  }
  return {
    topRow, bottomRow, spanHeight, buildingPixels, baseOccluderFraction, bands, split,
    verdict: 'two-tone-other',
    reason: `the colour changes at ${(splitFraction * 100).toFixed(0)}% height, too high for a ground floor`,
  };
}
