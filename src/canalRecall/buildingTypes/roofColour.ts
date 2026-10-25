/**
 * Measured pitched-roof colour for a building-type design (issue #75).
 *
 * A design's `palette.roof` was an authored tint the look maps through `cityRoofTint`: a tile tint's saturation is floored
 * at 0.35 and its lightness lifted into 0.38-0.5 (Tuindorp Amstelstation's brown-red #6a443c drew orange), and any tile
 * tint with S < 0.2 becomes the city's slate (Circus/Kermisbuurt's olive-brown concrete tiles drew slate). With
 * `palette.roof.measured: true` the GLB material carries `tintSource: 'measured'` and the look draws the tint as is
 * (look/palette.ts `cityMeasuredPitchedRoofTint`, shared with the large-recipe tier, #73).
 *
 * The tint is the sunlit street-photo median of the roof slope (survey crops, `sample-colours.ts`); the PDOK orthophoto
 * reading of the same pands (roof-facts sidecar, cast removed) is the cross-check: same hue family and comparable
 * lightness, or the photo sample is suspect (shade, a sky reflection, moss). `roofEvidence` keeps both on the spec.
 */
import {hexToRgb, hslToRgb, rgbToHex, rgbToHsl, type RGB} from '../look/palette.ts';
import type {RoofFact, RoofSlot} from '../roofs/roofSlots.ts';

/** Pitched readings of the orthophoto classifier (flat-roof slots, sedum, solar, terraces and glass say nothing about tile colour). */
export const PITCHED_FACT_SLOTS: readonly RoofSlot[] = ['pantile-red', 'pantile-dark', 'slate', 'zinc'];

export interface OrthoRoofSummary {
  /** Facts read (any slot). */
  read: number;
  /** Pitched readings used for the median. */
  used: number;
  /** Readings per slot. */
  slots: Partial<Record<RoofSlot, number>>;
  /** Per-channel median of the pitched readings (sRGB, cast removed), null when none. */
  median: RGB | null;
  hex: string | null;
}

const medianOf = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : NaN; };

/** Per-channel median of the pitched orthophoto readings of a design's pands. */
export function orthoRoofSummary(facts: readonly (RoofFact | null | undefined)[]): OrthoRoofSummary {
  const slots: Partial<Record<RoofSlot, number>> = {};
  const used = facts.filter((f): f is RoofFact => !!f).filter(f => { slots[f.slot] = (slots[f.slot] ?? 0) + 1; return PITCHED_FACT_SLOTS.includes(f.slot); });
  if (!used.length) return {read: facts.filter(Boolean).length, used: 0, slots, median: null, hex: null};
  const median = [0, 1, 2].map(c => Math.round(medianOf(used.map(f => f.rgb[c])))) as unknown as RGB;
  return {read: facts.filter(Boolean).length, used: used.length, slots, median, hex: rgbToHex(median)};
}

export interface RoofColourCheck {
  /** Hue difference photo vs ortho, degrees (0..180); null when either is near-neutral (S < 0.08) and hue is meaningless. */
  hueDiffDeg: number | null;
  /** Lightness photo - ortho (HSL L, 0..1). */
  lightnessDiff: number;
  /** Saturation photo - ortho. */
  saturationDiff: number;
  agrees: boolean;
  reason: string;
}

/** Hue window and lightness window within which a photo sample and the orthophoto reading count as the same roof colour. */
export const ROOF_CHECK_HUE_DEG = 30, ROOF_CHECK_LIGHTNESS = 0.18;
/**
 * Below this saturation (either side) hue is not compared: the orthophoto's haze strips saturation (red pantile rows read
 * S 0.12-0.17 from above, Tuindorp Amstelstation's brown-red tiles S 0.09), so a near-neutral reading carries no hue.
 */
export const ROOF_CHECK_NEUTRAL_S = 0.1;

/**
 * Does the sunlit photo sample agree with the orthophoto reading? The orthophoto is taken from above at another sun and
 * slope angle, so only the colour family is compared: hue within ROOF_CHECK_HUE_DEG (unless both are near-neutral) and
 * lightness within ROOF_CHECK_LIGHTNESS.
 */
export function checkRoofColour(photoHex: string, orthoHex: string): RoofColourCheck {
  const [hp, sp, lp] = rgbToHsl(hexToRgb(photoHex)), [ho, so, lo] = rgbToHsl(hexToRgb(orthoHex));
  const neutral = sp < ROOF_CHECK_NEUTRAL_S || so < ROOF_CHECK_NEUTRAL_S;
  const dh = Math.abs(hp - ho), hueDiffDeg = neutral ? null : Math.round(Math.min(dh, 360 - dh));
  const lightnessDiff = +(lp - lo).toFixed(3), saturationDiff = +(sp - so).toFixed(3);
  const hueOk = hueDiffDeg === null || hueDiffDeg <= ROOF_CHECK_HUE_DEG, lOk = Math.abs(lightnessDiff) <= ROOF_CHECK_LIGHTNESS;
  const reason = hueOk && lOk ? 'agrees' : [!hueOk ? `hue ${hueDiffDeg} deg apart` : '', !lOk ? `lightness ${lightnessDiff > 0 ? '+' : ''}${lightnessDiff.toFixed(2)}` : ''].filter(Boolean).join(', ');
  return {hueDiffDeg, lightnessDiff, saturationDiff, agrees: hueOk && lOk, reason};
}

/**
 * A roof seen only under overcast skies (or with its sunlit slope facing away from every panorama): the street photo
 * gives the material's hue and saturation (diffuse light, no sky reflection; a shaded slope under a blue sky reads
 * blue-grey), the orthophoto the sunlit lightness. Returns the photo's hue and saturation at lightness `l` (0..1).
 */
export function photoHueAtLightness(photoHex: string, l: number): string {
  const [h, s] = rgbToHsl(hexToRgb(photoHex));
  return rgbToHex(hslToRgb([h, s, Math.max(0, Math.min(1, l))]));
}

/** Per-channel mean of several photo samples (sRGB hex). */
export function meanHex(hexes: readonly string[]): string {
  const rgbs = hexes.map(hexToRgb);
  return rgbToHex([0, 1, 2].map(c => Math.round(rgbs.reduce((t, v) => t + v[c], 0) / rgbs.length)) as unknown as RGB);
}

/**
 * The lit tile body of a sunlit roof crop: per-channel median of the pixels at or above both the median saturation and the
 * median luma. A plain median counts the course shadows, mortar, lichen and sky glints between the tiles, which the game's
 * tile cell (roofCells.ts: courses darkened under each tile) draws again on top of the tint, so the roof would be
 * shaded twice (Tuindorp Amstelstation's cottage pantiles: plain median #ae816b, lit tile body #cb8d74).
 */
export function litTileMedian(pixels: readonly (readonly [number, number, number])[]): string | null {
  if (!pixels.length) return null;
  const sat = (p: readonly number[]) => { const mx = Math.max(p[0], p[1], p[2]); return mx ? (mx - Math.min(p[0], p[1], p[2])) / mx : 0; };
  const lum = (p: readonly number[]) => 0.2126 * p[0] + 0.7152 * p[1] + 0.0722 * p[2];
  const ms = medianOf(pixels.map(sat)), ml = medianOf(pixels.map(lum));
  const keep = pixels.filter(p => sat(p) >= ms && lum(p) >= ml), use = keep.length ? keep : pixels;
  return rgbToHex([0, 1, 2].map(c => Math.round(medianOf(use.map(p => p[c])))) as unknown as RGB);
}
