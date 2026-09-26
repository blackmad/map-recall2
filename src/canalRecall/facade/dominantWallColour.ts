/**
 * The dominant wall colour of a facade crop, found as a coherent cluster.
 *
 * `sampleWallColour` reports a luma percentile over the unmasked pixels, and on
 * the district's real crops that lands *between* the building's parts. A typical
 * Amsterdam facade crop is roughly half brick, a third strongly blue or near-black
 * window glass, a tenth white or cream joinery, and often a wedge of sky in the
 * corners. The 60th-luma pixel of that mixture is neither brick nor glass; it is
 * a colour present nowhere on the building. It is why a red-brown brick wall came
 * back `#3f6b6e` and another `#375d81`.
 *
 * This module stops averaging and instead looks for the largest *coherent* colour
 * cluster, which on a brick facade is the brick. It quantises usable pixels into
 * coarse hue/saturation/lightness bins, throws away bins that cannot be masonry
 * (bright neutral trim, very dark glass and doorways, blue-dominant sky and
 * reflecting glass), aggregates each surviving bin with its immediate neighbours
 * so one material under lighting variation stays one cluster, and reports the
 * intensity-weighted mean of the winning cluster's actual pixels. Everything it
 * discards is counted, and a facade that is genuinely two-tone comes back flagged
 * for review rather than confidently wrong.
 *
 * The output is a measurement with its basis named — `dominant-colour-cluster` —
 * never an accepted material. It classifies with `wallFamily`/`nearestMaterial`
 * exactly as `sampleWallColour` does, so there is one material taxonomy.
 */
import { nearestMaterial, wallFamily, type MaterialId } from './materials.ts';
import type { RgbImage } from './wallColourSample.ts';

/** A colour the algorithm can return, with its material snap and its share. */
export interface DominantColour {
  rgb: [number, number, number];
  hex: string;
  family: 'brick' | 'paint' | 'stone';
  material: MaterialId;
  materialDistance: number;
  pixels: number;
  /** Pixels in this cluster as a fraction of the usable (mask-included) pixels. */
  fraction: number;
}

export interface DominantWallColour extends DominantColour {
  /** Pixels that passed the mask and bounds checks and entered the histogram. */
  usablePixels: number;
  /** The next-largest cluster outside the winner's neighbourhood, if any. */
  runnerUp: DominantColour | null;
  /** Pixels removed before clustering, by the rule that removed them. */
  rejected: { trim: number; dark: number; blueGlass: number };
  /** False when the winner is too small or the runner-up too close to trust. */
  reliable: boolean;
  /** Why the result is flagged unreliable, for the review queue. */
  review: string[];
  basis: 'dominant-colour-cluster';
}

export interface DominantWallColourOptions {
  /**
   * A bin whose mean blue exceeds its mean red by this much (0–255) is sky,
   * reflecting glass or a blue cast, never masonry. Default 24.
   */
  blueRedMargin?: number;
  /**
   * A bin at or above this lightness *and* at or below this saturation is
   * painted trim, joinery or sky haze. Defaults 0.86 / 0.18 in HSL units.
   */
  trimLightness?: number;
  trimSaturation?: number;
  /** A bin at or below this lightness is glass in shadow, a doorway, or the
   * dark interior seen through glass. Default 0.15. */
  darkLightness?: number;
  /** A winner holding less of the usable pixels than this is unreliable.
   * Default 0.25. */
  minShare?: number;
  /** A runner-up at or above this share of the winner's fraction is too close
   * to call, so the result is flagged unreliable. Default 0.75. */
  runnerUpRatio?: number;
}

/**
 * Bins are coarse on purpose. Hue is cut every 30° (12 bins): that separates the
 * red-to-yellow masonry range from green and blue, while a single brick material
 * straddling a boundary is healed by neighbour aggregation. Saturation and
 * lightness are cut every 0.10 (10 bins each): lighting moves a wall a bin or two
 * in lightness, which neighbour aggregation absorbs, but a shadowed brick and a
 * lit brick still cluster apart from glass and trim.
 */
const HUE_BINS = 12;
const SAT_BINS = 10;
const LIGHT_BINS = 10;
const HUE_STEP = 360 / HUE_BINS;
const VALUE_STEP = 1 / SAT_BINS;

interface Hsl { h: number; s: number; l: number }

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const rgbToHsl = (r: number, g: number, b: number): Hsl => {
  const rn = r / 255, gn = g / 255, bn = b / 255;
  const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return { h: 0, s: 0, l };
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === rn) h = (gn - bn) / d + (gn < bn ? 6 : 0);
  else if (max === gn) h = (bn - rn) / d + 2;
  else h = (rn - gn) / d + 4;
  return { h: (h * 60) % 360, s, l };
};

const toHex = (rgb: [number, number, number]) =>
  '#' + rgb.map(value => clamp(Math.round(value), 0, 255).toString(16).padStart(2, '0')).join('');

/**
 * One colour-space cell. It keeps the mean RGB (for the rejection rules), the
 * plain channel sums (fallback mean) and each channel weighted by pixel luma
 * (the intensity-weighted mean the caller actually receives).
 */
interface Bin {
  key: number;
  hi: number;
  si: number;
  li: number;
  count: number;
  sumR: number;
  sumG: number;
  sumB: number;
  sumLuma: number;
  sumRLuma: number;
  sumGLuma: number;
  sumBLuma: number;
}

const binKey = (hi: number, si: number, li: number) => (hi * SAT_BINS + si) * LIGHT_BINS + li;

/** The 27 cells in the immediate 3×3×3 neighbourhood, with hue wrapping. */
function neighbourhood(hi: number, si: number, li: number): number[] {
  const keys: number[] = [];
  for (let dh = -1; dh <= 1; dh++) {
    const nh = (hi + dh + HUE_BINS) % HUE_BINS;
    for (let ds = -1; ds <= 1; ds++) {
      const ns = si + ds;
      if (ns < 0 || ns >= SAT_BINS) continue;
      for (let dl = -1; dl <= 1; dl++) {
        const nl = li + dl;
        if (nl < 0 || nl >= LIGHT_BINS) continue;
        keys.push(binKey(nh, ns, nl));
      }
    }
  }
  return keys;
}

/** Round an intensity-weighted (or fallback plain) mean from a set of bins. */
function meanOf(bins: Bin[]): [number, number, number] {
  let weight = 0, sumR = 0, sumG = 0, sumB = 0;
  for (const bin of bins) {
    weight += bin.sumLuma;
    sumR += bin.sumRLuma;
    sumG += bin.sumGLuma;
    sumB += bin.sumBLuma;
  }
  if (weight > 0) {
    return [sumR / weight, sumG / weight, sumB / weight];
  }
  let count = 0;
  sumR = sumG = sumB = 0;
  for (const bin of bins) {
    count += bin.count;
    sumR += bin.sumR;
    sumG += bin.sumG;
    sumB += bin.sumB;
  }
  return count > 0 ? [sumR / count, sumG / count, sumB / count] : [0, 0, 0];
}

const describe = (rgb: [number, number, number], pixels: number, fraction: number): DominantColour => {
  const rounded = rgb.map(value => clamp(Math.round(value), 0, 255)) as [number, number, number];
  const family = wallFamily(rounded);
  const nearest = nearestMaterial(rounded, family);
  return {
    rgb: rounded,
    hex: toHex(rounded),
    family,
    material: nearest.material.id,
    materialDistance: Number(nearest.distance.toFixed(2)),
    pixels,
    fraction: Number(fraction.toFixed(3)),
  };
};

/**
 * Measure the dominant wall colour of a crop.
 *
 * A non-zero `mask` entry means "use this pixel"; zero excludes it. A mask whose
 * length is not `width * height` is ignored. Returns `null` when the image is
 * unusable, when no pixel is selected, or when every selected pixel is thrown
 * away by the rejection rules — an abstention, never a guess.
 */
export function dominantWallColour(
  image: RgbImage,
  mask?: Uint8Array | null,
  options: DominantWallColourOptions = {},
): DominantWallColour | null {
  const { width, height } = image;
  const channels = image.channels ?? 3;
  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) return null;
  if (image.data.length < width * height * channels) return null;
  const {
    blueRedMargin = 24, trimLightness = 0.86, trimSaturation = 0.18, darkLightness = 0.15,
    minShare = 0.25, runnerUpRatio = 0.75,
  } = options;
  const usableMask = mask && mask.length === width * height ? mask : null;

  const bins = new Map<number, Bin>();
  let usablePixels = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const index = y * width + x;
      if (usableMask && usableMask[index] === 0) continue;
      const i = index * channels;
      const r = image.data[i], g = image.data[i + 1], b = image.data[i + 2];
      const { h, s, l } = rgbToHsl(r, g, b);
      const hi = Math.min(HUE_BINS - 1, Math.floor(h / HUE_STEP));
      const si = Math.min(SAT_BINS - 1, Math.floor(s / VALUE_STEP));
      const li = Math.min(LIGHT_BINS - 1, Math.floor(l / VALUE_STEP));
      const key = binKey(hi, si, li);
      let bin = bins.get(key);
      if (!bin) {
        bin = {
          key, hi, si, li, count: 0,
          sumR: 0, sumG: 0, sumB: 0, sumLuma: 0, sumRLuma: 0, sumGLuma: 0, sumBLuma: 0,
        };
        bins.set(key, bin);
      }
      const luma = (r + g + b) / 3;
      bin.count += 1;
      bin.sumR += r; bin.sumG += g; bin.sumB += b;
      bin.sumLuma += luma;
      bin.sumRLuma += r * luma; bin.sumGLuma += g * luma; bin.sumBLuma += b * luma;
      usablePixels += 1;
    }
  }
  if (usablePixels === 0) return null;

  // Reject whole bins before any clustering. A bin is judged by its mean pixel,
  // which is what its members are closest to. The categories are exclusive and
  // checked in this order so a multiply-invalid bin is counted once: blue first,
  // because sky and reflecting glass are the most damaging confusion on brick.
  const rejected = { trim: 0, dark: 0, blueGlass: 0 };
  const candidates: Bin[] = [];
  for (const bin of bins.values()) {
    const meanR = bin.sumR / bin.count, meanG = bin.sumG / bin.count, meanB = bin.sumB / bin.count;
    const { s, l } = rgbToHsl(meanR, meanG, meanB);
    if (meanB - meanR >= blueRedMargin) rejected.blueGlass += bin.count;
    else if (l >= trimLightness && s <= trimSaturation) rejected.trim += bin.count;
    else if (l <= darkLightness) rejected.dark += bin.count;
    else candidates.push(bin);
  }
  if (!candidates.length) return null;

  const candidateByKey = new Map(candidates.map(bin => [bin.key, bin]));
  const candidatesByKey = [...candidates].sort((a, b) => a.key - b.key);
  const clusterPixels = (keys: Set<number>) => {
    let pixels = 0;
    for (const bin of candidates) if (keys.has(bin.key)) pixels += bin.count;
    return pixels;
  };

  // Rank each surviving bin by the total populating it and its immediate
  // neighbours: a material under a lighting gradient owns several cells, and the
  // cell at the middle of that spread outranks each fringe cell.
  let winner: Bin | null = null;
  let winnerKeys = new Set<number>();
  let winnerScore = -1;
  for (const bin of candidatesByKey) {
    const keys = new Set(neighbourhood(bin.hi, bin.si, bin.li));
    let score = 0;
    for (const key of keys) score += candidateByKey.get(key)?.count ?? 0;
    if (score > winnerScore || (score === winnerScore && winner && bin.count > winner.count)) {
      winner = bin; winnerKeys = keys; winnerScore = score;
    }
  }
  const winningPixels = clusterPixels(winnerKeys);

  // The runner-up is the densest cluster that does not overlap the winner, so a
  // second material sharing the winner's neighbourhood is not double counted.
  let runnerUp: Bin | null = null;
  let runnerUpKeys = new Set<number>();
  let runnerUpScore = -1;
  for (const bin of candidatesByKey) {
    if (winnerKeys.has(bin.key)) continue;
    const keys = new Set(neighbourhood(bin.hi, bin.si, bin.li));
    let score = 0;
    for (const key of keys) if (!winnerKeys.has(key)) score += candidateByKey.get(key)?.count ?? 0;
    if (score > runnerUpScore) { runnerUp = bin; runnerUpKeys = keys; runnerUpScore = score; }
  }

  const winnerMean = meanOf(candidates.filter(bin => winnerKeys.has(bin.key)));
  const winning = describe(winnerMean, winningPixels, winningPixels / usablePixels);

  let runner: DominantColour | null = null;
  if (runnerUp && runnerUpScore > 0) {
    const keys = new Set([...runnerUpKeys].filter(key => !winnerKeys.has(key)));
    const pixels = clusterPixels(keys);
    if (pixels > 0) {
      const mean = meanOf(candidates.filter(bin => keys.has(bin.key)));
      runner = describe(mean, pixels, pixels / usablePixels);
    }
  }

  const review: string[] = [];
  if (winning.fraction < minShare) review.push('winner-below-minimum-share');
  if (runner && runner.fraction >= winning.fraction * runnerUpRatio) review.push('runner-up-too-close');

  return {
    ...winning,
    usablePixels,
    runnerUp: runner,
    rejected,
    reliable: review.length === 0,
    review,
    basis: 'dominant-colour-cluster',
  };
}
