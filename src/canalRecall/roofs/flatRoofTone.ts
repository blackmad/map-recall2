/**
 * Flat-roof tone (lane R5-E, #265; the user's U1 shot "roofs look too bright/flat/unfinished", 2026-11-08).
 *
 * An unmeasured flat roof took one of four slot bases by hash (`FLAT_ROOF_GREYS`): two of the four are light
 * (white membrane, light bitumen), so half the unmeasured lids drew brighter than any orthophoto roof around them.
 * With `?flatRoofTone=0` off, that stays. On, an unmeasured flat roof takes its build-year band's prior: the
 * median display colour of the measured flat roofs of that band (`scripts/roofs/flat-roof-priors.mts`).
 */
import { FLAT_ROOF_PERIOD_PRIORS, hexToRgb, hslToRgb, rgbToHex, rgbToHsl, type RGB } from '../look/palette.js';

/** Build-year bands for the flat-roof priors (inclusive upper bounds). */
export const FLAT_ROOF_BANDS = [
  { name: 'pre-1900', to: 1899 },
  { name: '1900-1944', to: 1944 },
  { name: '1945-1969', to: 1969 },
  { name: '1970-1989', to: 1989 },
  { name: '1990-2009', to: 2009 },
  { name: '2010+', to: Infinity },
] as const;
export type FlatRoofBand = typeof FLAT_ROOF_BANDS[number]['name'] | 'unknown';

export function flatRoofBand(year: number | null | undefined): FlatRoofBand {
  if (year === null || year === undefined || !Number.isFinite(year)) return 'unknown';
  return FLAT_ROOF_BANDS.find(b => year <= b.to)!.name;
}

/** `?flatRoofTone=0` restores the hashed slot bases. */
export function flatRoofToneEnabled(search: string = typeof location !== 'undefined' ? location.search : ''): boolean {
  return new URLSearchParams(search).get('flatRoofTone') !== '0';
}


/** Lightness spread between unmeasured neighbours of one band (± fraction), so a row of priors is not one slab. */
export const PRIOR_JITTER = 0.06;
/** Readings below MIN_CONFIDENCE but at or above this bias the prior toward themselves (weight ramps to 1 at MIN). */
export const LOW_CONFIDENCE_FROM = 0.2;

/**
 * The roof-facts stamp's reading when it is a low-confidence one (confidence in [LOW_CONFIDENCE_FROM, minConfidence),
 * a sidecar exported at `--min-confidence=0.2`): it only biases the prior, it is not drawn as measured. Null for a
 * confident, missing or unreadable stamp. A stamp without a confidence (older callers) counts as confident.
 */
export function lowConfidenceReading(p: Record<string, unknown>, minConfidence = 0.35): { rgb: RGB; confidence: number } | null {
  const confidence = Number(p.roofConfidence);
  if (p.roofConfidence === undefined || !Number.isFinite(confidence) || confidence >= minConfidence || confidence < LOW_CONFIDENCE_FROM) return null;
  if (typeof p.roofMeasured !== 'string' || !/^#[0-9a-f]{6}$/i.test(p.roofMeasured)) return null;
  return { rgb: hexToRgb(p.roofMeasured), confidence };
}

/** A roof-facts stamp below `minConfidence` is not a measurement (MIN_CONFIDENCE in roofSlots.ts). */
export const roofStampConfident = (p: Record<string, unknown>, minConfidence = 0.35): boolean => {
  if (p.roofConfidence === undefined) return true;
  const confidence = Number(p.roofConfidence);
  return !Number.isFinite(confidence) || confidence >= minConfidence;
};

const hash01 = (s: string) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0) / 4294967296; };

/**
 * An unmeasured flat roof's display tint: its band's prior, its lightness jittered by ±PRIOR_JITTER per building,
 * then moved toward a low-confidence reading (confidence in [LOW_CONFIDENCE_FROM, minConfidence)) by up to the
 * measured weight `roofSlotHex` gives a confident reading (0.75).
 */
export function flatRoofPriorHex(id: string, year: number | null | undefined, reading?: { rgb: RGB; confidence: number } | null, minConfidence = 0.35): string {
  const [h, s, l] = rgbToHsl(hexToRgb(FLAT_ROOF_PERIOD_PRIORS[flatRoofBand(year)]));
  let c = hslToRgb([h, s, Math.max(0, Math.min(1, l * (1 + (hash01(`${id}:flatRoof`) * 2 - 1) * PRIOR_JITTER)))]);
  if (reading && reading.confidence >= LOW_CONFIDENCE_FROM && reading.confidence < minConfidence) {
    const w = 0.75 * (reading.confidence - LOW_CONFIDENCE_FROM) / (minConfidence - LOW_CONFIDENCE_FROM);
    c = [c[0] + (reading.rgb[0] - c[0]) * w, c[1] + (reading.rgb[1] - c[1]) * w, c[2] + (reading.rgb[2] - c[2]) * w];
  }
  return rgbToHex(c);
}

/**
 * The lid's render gain at the U1 pose (#265 step 1): rendered luma / tint luma = 1.13–1.14 on 12 of the 15 largest
 * flat lids. The tint already matches the orthophoto (measured slots: mean tint 135 vs ortho 136), so the frame read
 * ~+13 brighter than the photo. With the tone flag on the lid tint is scaled by ~1/1.135 (0.89 fits U1 best: 13/15 predicted within ±10); the shared LID_SHADE /
 * BAKED_LID_SHADE (also the pitched-roof and shell constant) is left alone.
 */
export const FLAT_LID_EXPOSURE = 0.89;
/** A mapped roof colour (a tag, not a measurement) keeps its hue but moves this far toward the prior's lightness (U1: the one mapped lid, #a99b84, read +51 over the orthophoto, +14 at 0.5). */
export const MAPPED_TOWARD_PRIOR = 0.75;

export function scaleHex(hex: string, k: number): string {
  const [r, g, b] = hexToRgb(hex);
  return rgbToHex([r * k, g * k, b * k]);
}

/** `mapped` with its HSL lightness moved `w` of the way to `prior`'s (hue and saturation kept). */
export function mappedTowardPrior(mapped: string, prior: string, w = MAPPED_TOWARD_PRIOR): string {
  const [h, s, l] = rgbToHsl(hexToRgb(mapped));
  const [, , lp] = rgbToHsl(hexToRgb(prior));
  return rgbToHex(hslToRgb([h, s, l + (lp - l) * w]));
}
