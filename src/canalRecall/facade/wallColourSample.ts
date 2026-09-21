/**
 * A deterministic, declared wall-colour observation from a facade crop.
 *
 * The paid extraction asks a model for an observed hex per material region, and
 * it is not reliable: on the reviewed set it returned a whole-facade "accent"
 * (`#ffffff` over the entire crop) for Elandsgracht 19 and omitted the wall
 * colour entirely for Rozengracht 251. Neither is a measurement, and a renderer
 * that trusts them paints a red-brick building white or beige.
 *
 * This module measures the wall from the pixels instead. It is deliberately
 * conservative and it *reports what it cannot see*: openings and localized trim
 * are masked out, the top and bottom margins are skipped, near-white joinery is
 * excluded, and the result carries the sampled population and its luma spread
 * so a caller can see whether the crop was a clean wall or a shadowed/occluded
 * one. The output is a `needs-review` observation with its basis named — never
 * an accepted material.
 */
import { nearestMaterial, wallFamily, type MaterialId } from './materials.ts';

/** Minimal structural view of a facade feature. It matches the extraction
 * module's `kind`/`bounds`/`region` without depending on it. */
export interface WallColourFeature {
  kind: string;
  bounds: readonly number[];
  region?: string;
}

export interface RgbImage {
  data: ArrayLike<number>;
  width: number;
  height: number;
  /** Interleaved channels; 3 (RGB) by default, 4 accepted for RGBA buffers. */
  channels?: 3 | 4;
}

export interface WallColourSample {
  rgb: [number, number, number];
  hex: string;
  family: 'brick' | 'paint' | 'stone';
  material: MaterialId;
  materialDistance: number;
  /** Wall pixels that survived masking and the near-white exclusion. */
  sampledPixels: number;
  /** Surviving pixels as a fraction of the whole crop. */
  wallFraction: number;
  /** p90 − p10 luma across the surviving pixels: wide means mixed light. */
  lumaSpread: number;
  basis: 'masked-crop-percentile';
  state: 'needs-review';
}

export interface WallColourSampleOptions {
  /** Luma percentile of the surviving wall pixels to report. Default 0.6. */
  percentile?: number;
  /** Fraction of the crop skipped at the top (sky). Default 0.08. */
  topMarginFraction?: number;
  /** Fraction of the crop skipped at the bottom (pavement/shopfront). Default 0.2. */
  bottomMarginFraction?: number;
  /**
   * A trim/accent/band/surround/plinth region covering more than this fraction
   * of the crop is not a usable mask — a real accent is small — so it is left
   * unmasked and the near-white exclusion does the work instead. Default 0.6.
   */
  maxTrimCoverage?: number;
  /** Pixels at or above this luma with chroma at or below `whiteChroma` are
   * joinery, not wall, and are excluded. Defaults 205 / 45. */
  whiteLuma?: number;
  whiteChroma?: number;
}

const OPENING_KINDS = new Set(['window', 'door', 'awning', 'fascia']);
const TRIM_REGIONS = new Set(['accent', 'band', 'surround', 'plinth']);

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

/** Luma percentile of the surviving wall pixels, returned as a real pixel. */
export function sampleWallColour(
  image: RgbImage,
  features: ReadonlyArray<WallColourFeature>,
  options: WallColourSampleOptions = {},
): WallColourSample | null {
  const { width, height } = image;
  const channels = image.channels ?? 3;
  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) return null;
  if (image.data.length < width * height * channels) return null;
  const {
    percentile = 0.6, topMarginFraction = 0.08, bottomMarginFraction = 0.2,
    maxTrimCoverage = 0.6, whiteLuma = 205, whiteChroma = 45,
  } = options;

  const blocked = new Uint8Array(width * height);
  const mask = (bounds: readonly number[]) => {
    const [left, top, right, bottom] = bounds;
    const x0 = clamp(Math.floor(left), 0, width), x1 = clamp(Math.ceil(right), 0, width);
    const y0 = clamp(Math.floor(top), 0, height), y1 = clamp(Math.ceil(bottom), 0, height);
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) blocked[y * width + x] = 1;
  };
  const cropArea = width * height;
  for (const feature of features) {
    if (!Array.isArray(feature.bounds) || feature.bounds.length !== 4 || !feature.bounds.every(Number.isFinite)) continue;
    if (OPENING_KINDS.has(feature.kind)) { mask(feature.bounds); continue; }
    if (feature.kind === 'material' && feature.region && TRIM_REGIONS.has(feature.region)) {
      const [left, top, right, bottom] = feature.bounds;
      const coverage = Math.max(0, right - left) * Math.max(0, bottom - top) / cropArea;
      if (coverage < maxTrimCoverage) mask(feature.bounds);
    }
  }

  const pixels: Array<{ r: number; g: number; b: number; luma: number }> = [];
  const firstRow = clamp(Math.floor(height * topMarginFraction), 0, height);
  const lastRow = clamp(Math.ceil(height * (1 - bottomMarginFraction)), firstRow, height);
  for (let y = firstRow; y < lastRow; y++) {
    for (let x = 0; x < width; x++) {
      if (blocked[y * width + x]) continue;
      const i = (y * width + x) * channels;
      const r = image.data[i], g = image.data[i + 1], b = image.data[i + 2];
      const luma = (r + g + b) / 3;
      if (luma >= whiteLuma && Math.max(r, g, b) - Math.min(r, g, b) <= whiteChroma) continue;
      pixels.push({ r, g, b, luma });
    }
  }
  if (!pixels.length) return null;
  pixels.sort((left, right) => left.luma - right.luma);
  const pick = pixels[clamp(Math.floor(pixels.length * percentile), 0, pixels.length - 1)];
  const at = (fraction: number) => pixels[clamp(Math.floor(pixels.length * fraction), 0, pixels.length - 1)].luma;
  const rgb: [number, number, number] = [pick.r, pick.g, pick.b];
  const family = wallFamily(rgb);
  const nearest = nearestMaterial(rgb, family);
  const hex = '#' + rgb.map(value => clamp(Math.round(value), 0, 255).toString(16).padStart(2, '0')).join('');
  return {
    rgb, hex, family, material: nearest.material.id, materialDistance: Number(nearest.distance.toFixed(2)),
    sampledPixels: pixels.length, wallFraction: Number((pixels.length / cropArea).toFixed(3)),
    lumaSpread: Number((at(0.9) - at(0.1)).toFixed(1)),
    basis: 'masked-crop-percentile', state: 'needs-review',
  };
}
