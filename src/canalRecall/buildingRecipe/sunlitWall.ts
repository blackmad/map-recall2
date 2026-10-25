/**
 * Measured walls read from shade (issue #73, "dark, dour"): the wall colour a large recipe carries comes from the crop
 * its group was paired with (measure.ts), and for most groups that crop shows the wall in shade or under overcast sky
 * (north fronts, winter captures). The light-trim normalisation (measureFacade `lightTrimNormalisation`) lifts it by at
 * most 1.45 and only when a light trim is in frame, so the shade survives: over the 183 measured groups of the installed
 * large houses the colour draws at a median luma 88 while the same pand's sunlit crop shows its brick at a median 153.
 *
 * This module re-reads such a wall from a sunlit crop of the same pand: it keeps the measured colour's hue and
 * chromaticity (the material) and scales it in linear light so the look draws it at the sunlit crop's brick luma, only
 * when the sunlit crop shows the same warm material (chromaticity, `SAME_MATERIAL`), is clearly brighter than the crop
 * the colour came from, and never above a buff-brick ceiling (white and pale walls are not this module's business).
 * Pure: the crop pixels come in as RGB bytes; `scripts/building-recipes/sunlit-walls.ts` reads the crops and writes.
 */
import {chromaticity, SAME_MATERIAL} from './measureFacade.ts';
import {measuredWallGain, scaleLinear, sunlitMeasuredWall} from '../look/sunny.ts';
import {CITY_BRICK_LIGHTNESS, hexToRgb, lumaOf, rgbToHsl} from '../look/palette.ts';

type Rgb = [number, number, number];

export const SUNLIT_WALL = {
  /** a crop reading needs this share of its pixels to be brick-like */
  minShare: 0.1,
  /** the sunlit reading must be at least this much brighter (luma) than the reading of the crop the colour came from */
  minRatio: 1.3,
  /** never draw a re-read wall above this luma (a sunlit buff brick; light render and white stone are left alone) */
  maxLuma: 175,
  /**
   * nor above this HSL lightness: the city's brick ceiling (CITY_BRICK_LIGHTNESS[1], what `cityWallTint` draws the
   * procedural rows' brightest brick at). Scaling a shaded red brick to its sunlit luma in linear light pales it towards
   * salmon (#5c3d33 -> #e09a84, L 0.70); the ceiling keeps it a brick beside the procedural rows (#d0876c at 0.60).
   */
  maxLightness: CITY_BRICK_LIGHTNESS[1],
  /** the measured colour must be at least this saturated (brick, not a grey or white wall) */
  minSaturation: 0.1,
  /** and the change must lift the drawn luma by at least this much to be worth a write */
  minLift: 6,
  /**
   * months a capture may be the sunlit reference in: May-September, the window SUNLIT_WHITE_LUMA was calibrated on
   * (measuredWhitePoints.ts). A bright winter capture is haze or low sun on wet brick (Westerdok 748 w03-5L, 2024-11-21:
   * a washed pink), not the sunlit wall.
   */
  months: [5, 6, 7, 8, 9] as readonly number[],
} as const;

/** Whether a capture date (`YYYY-MM-DD`) may serve as the sunlit reference. */
export const sunlitSeason = (date: string | null | undefined): boolean => !!date && SUNLIT_WALL.months.includes(Number(date.slice(5, 7)));

export interface BrickReading { rgb: Rgb; luma: number; share: number }

/**
 * The brick of a crop: the per-channel median of its brick-like pixels (warm hue 345..50 deg, saturation >= 0.10, red
 * at least green, luma 35..235: no sky, leaves, glass, white trim or clipped sun). Null when fewer than `minShare` are.
 */
export function brickReading(rgb: ArrayLike<number>, n: number): BrickReading | null {
  const ch: number[][] = [[], [], []];
  for (let i = 0; i < n; i++) {
    const r = rgb[i * 3], g = rgb[i * 3 + 1], b = rgb[i * 3 + 2], y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    if (y < 35 || y > 235 || g > r) continue;
    const [h, s] = rgbToHsl([r, g, b]);
    if (s < 0.1 || (h > 50 && h < 345)) continue;
    ch[0].push(r); ch[1].push(g); ch[2].push(b);
  }
  const share = n ? ch[0].length / n : 0;
  if (share < SUNLIT_WALL.minShare) return null;
  const med = (a: number[]) => a.sort((p, q) => p - q)[a.length >> 1];
  const c: Rgb = [med(ch[0]), med(ch[1]), med(ch[2])];
  return {rgb: c, luma: Math.round(lumaOf(c)), share: +share.toFixed(3)};
}

/** The same warm material by chromaticity (measureFacade SAME_MATERIAL: within maxDist x the wall's distance from neutral, at least minChromaShare as far). */
export function sameWarmMaterial(wall: Rgb, other: Rgb): boolean {
  const N3 = 100 / 3, m = chromaticity(wall), p = chromaticity(other);
  if (m[0] - m[2] < SAME_MATERIAL.minWarmth) return false;
  const fromNeutral = (q: Rgb) => Math.hypot(q[0] - N3, q[1] - N3, q[2] - N3), mn = fromNeutral(m);
  return Math.hypot(p[0] - m[0], p[1] - m[1], p[2] - m[2]) <= SAME_MATERIAL.maxDist * mn && fromNeutral(p) >= SAME_MATERIAL.minChromaShare * mn;
}

/** Luma the sunny look draws a measured wall hex at (`sunlitMeasuredWall`, with its recorded white or none). */
export const drawnLuma = (hex: string, white?: readonly number[] | null): number => lumaOf(hexToRgb(white ? sunlitMeasuredWall(hex, white) : sunlitMeasuredWall(hex, null)));

export type SunlitProposal = {hex: string; drawnBefore: number; drawnAfter: number; target: number} | {skip: string};

/**
 * The re-read colour for a measured wall `hex` (drawn with `white`, its recorded white point, or none): `used` is the
 * brick reading of the crop it was measured from, `sunlit` that of a sunlit crop of the same pand. The result draws
 * (with no recorded white: a new hex is not in WALL_WHITE_POINTS) at min(sunlit luma, maxLuma) and at most maxLightness,
 * hue kept.
 */
export function sunlitWallProposal(hex: string, white: readonly number[] | null, used: BrickReading | null, sunlit: BrickReading | null): SunlitProposal {
  const rgb = hexToRgb(hex) as Rgb, drawnBefore = Math.round(drawnLuma(hex, white));
  if (rgbToHsl(rgb)[1] < SUNLIT_WALL.minSaturation) return {skip: 'grey or white wall'};
  if (!used) return {skip: 'no brick reading in its crop'};
  if (!sunlit) return {skip: 'no sunlit brick reading for the pand'};
  if (sunlit.luma < used.luma * SUNLIT_WALL.minRatio) return {skip: `its crop is not in shade (brick ${used.luma} vs brightest ${sunlit.luma})`};
  if (!sameWarmMaterial(rgb, sunlit.rgb)) return {skip: 'the sunlit brick is another material (chromaticity)'};
  const target = Math.min(sunlit.luma, SUNLIT_WALL.maxLuma);
  if (target < drawnBefore + SUNLIT_WALL.minLift) return {skip: `already drawn at ${drawnBefore} (sunlit ${sunlit.luma})`};
  // bisection on the linear scale of the measured colour: drawn luma rises monotonically with it
  const gain = measuredWallGain(null);
  let lo = 1, hi = 8;
  const under = (k: number) => { const c = hexToRgb(scaleLinear(hex, k * gain)); return lumaOf(c) < target && rgbToHsl(c)[2] <= SUNLIT_WALL.maxLightness; };
  for (let i = 0; i < 40; i++) { const k = (lo + hi) / 2; if (under(k)) lo = k; else hi = k; }
  const out = scaleLinear(hex, lo), drawnAfter = Math.round(drawnLuma(out));
  if (drawnAfter < drawnBefore + SUNLIT_WALL.minLift) return {skip: `already drawn at ${drawnBefore} (at the brick ceiling)`};
  return {hex: out, drawnBefore, drawnAfter, target};
}
