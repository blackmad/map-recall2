/**
 * The wall colour a palette takes from a photographed front's wall pixels (lane H7 round 2, #354, 2026-11-10).
 *
 * Why. The Nassaukade 145-152 library palettes were per-channel medians of every "wall" pixel of the strip
 * (stripPalette.ts `wall`). On a golden-hour strip with trees in front, that median mixes the brick or paint with
 * foliage, sunlit and shaded courses and pale trim bleed, so painted-black 149 and 147 drew olive-khaki (#6a685d,
 * #615a47), red-brown 148 drew mauve (#806e5e) and red 145 drew pale peach (#b58c6f) (judgement ruling on #354,
 * the same family as the H9/H2e wall-colour rulings).
 *
 * The fit, in CIE Lab:
 *   1. drop foliage and light trim. Both masks look at the white-balanced pixel when the caller passes the day's gains
 *      (stripWhiteBalance.ts: a yellow-green cast day photographs white frames as (240, 240, 192), which is neither
 *      "light and grey" nor "not a leaf" until balanced): foliage = `leaf(r, g, b)` when given, else green-dominant
 *      (Lab hue FOLIAGE.minHue..maxHue with chroma >= FOLIAGE.minChroma, or G over R and B); trim = balanced L* >= TRIM.minL
 *      with C* < TRIM.maxChroma (white paint, frames, sky bleed). The colour itself is measured on the UNBALANCED pixels,
 *      as every library palette is (stripWhiteBalance.ts: the look's brick lift is calibrated on unbalanced strips);
 *   2. split the rest into two clusters by 2-means (seeded at the 25th and 75th L* percentiles, deterministic);
 *   3. the dominant (larger-area) cluster wins; the PALER cluster only when it holds >= PALER_MIN_SHARE of the
 *      wall mask (a sunlit course or pale bleed beside a brick wall is not the wall);
 *   4. the colour is the chosen cluster's median L*, a*, b*; on a wall that is not painted, the brick is split from its
 *      joints first (brickTone.ts step 3: Otsu on chroma; the split stands when the high-chroma class holds >= 30 % and
 *      is clearly apart), and the brick class's median is the colour: at panorama scale grey mortar and texture pull a
 *      red-brown wall's median to mauve;
 *   5. a dark painted wall (`painted` and L* <= DARK_PAINT.maxL) is a neutral near-black: a* = b* = 0, L* as measured,
 *      never lifted. The warm cast of the light is not the paint's hue;
 *   6. brick keeps its measured chroma. When a caller lifts L* (`liftL`), chroma travels with it: C* is scaled by the
 *      same ratio, so a lifted red-brown stays red-brown instead of washing to mauve or peach.
 * Pure; the strip tool (scripts/block-face/palette-from-strip.ts) prints it as `fit`.
 */
import {combineBrickTones, labToRgb, otsu01, rgbToLab, type Rgb} from '../look/brickTone.ts';
import {toHex} from './wallColour.ts';

export const PALER_MIN_SHARE = 0.6;
export const FOLIAGE = {minHue: 95, maxHue: 200, minChroma: 8} as const;
export const DARK_PAINT = {maxL: 40} as const;
export const TRIM = {minL: 72, maxChroma: 14} as const;
export const MIN_PIXELS = 40;
/** Brick/joint split on Lab chroma (C* / BRICK_SPLIT.scale into 0..1 for Otsu): high class share and mean-chroma gap. */
export const BRICK_SPLIT = {scale: 60, minHighShare: 0.3, minGap: 4} as const;

export interface WallFitOptions {
  /** The wall is painted (palette.wallMaterial painted-brick / painted): a dark one is drawn neutral. */
  painted?: boolean;
  /** Lift the fitted L* to at least this value (chroma scales with it). */
  liftL?: number;
  /** The day's white-balance gains (stripWhiteBalance.ts); the masks read the balanced pixel. Default [1, 1, 1]. */
  gains?: Rgb;
  /** Leaf test on the balanced pixel (stripWhiteBalance.ts balancedLeaf, measureFacade isLeaf); default `isFoliage`. */
  leaf?: (r: number, g: number, b: number) => boolean;
  /** Measure the colour on the balanced pixels too (a cast day whose white paint is a known neutral). Default false. */
  colourOnBalanced?: boolean;
}

export interface WallFit {
  hex: string; lab: Rgb;
  /** Which cluster was taken and why; shares of the non-foliage wall pixels. */
  pick: 'dominant' | 'paler' | 'single';
  shares: {darker: number; paler: number};
  /** Foliage and light-trim pixels dropped, as shares of the input. */
  foliage: number; trim: number;
  neutralised: boolean;
  /** A brick/joint split was found and the brick class taken (never on a painted wall). */
  brickSplit: boolean;
  pixels: number;
}

const median = (v: number[]) => { const s = [...v].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };

export function isFoliage(p: Rgb, lab = rgbToLab(p)): boolean {
  const hue = (Math.atan2(lab[2], lab[1]) * 180 / Math.PI + 360) % 360, chroma = Math.hypot(lab[1], lab[2]);
  return (hue >= FOLIAGE.minHue && hue <= FOLIAGE.maxHue && chroma >= FOLIAGE.minChroma) || (p[1] > p[0] + 2 && p[1] > p[2] + 2);
}

/** Fit the wall colour of `pixels` (sRGB). Null when fewer than MIN_PIXELS survive the foliage drop. */
export function fitWallColour(pixels: readonly Rgb[], opts: WallFitOptions = {}): WallFit | null {
  const labs: Rgb[] = [], g = opts.gains ?? [1, 1, 1];
  let nLeaf = 0, nTrim = 0;
  for (const p of pixels) {
    const b: Rgb = [Math.min(255, p[0] * g[0]), Math.min(255, p[1] * g[1]), Math.min(255, p[2] * g[2])], bl = rgbToLab(b);
    if (opts.leaf ? opts.leaf(b[0], b[1], b[2]) : isFoliage(b, bl)) { nLeaf++; continue; }
    if (bl[0] >= TRIM.minL && Math.hypot(bl[1], bl[2]) < TRIM.maxChroma) { nTrim++; continue; }
    labs.push(opts.colourOnBalanced ? bl : rgbToLab(p));
  }
  if (labs.length < MIN_PIXELS) return null;
  const foliage = +(nLeaf / pixels.length).toFixed(3), trim = +(nTrim / pixels.length).toFixed(3);
  const Ls = labs.map(l => l[0]).sort((a, b) => a - b);
  let c0: Rgb = [Ls[Math.floor(Ls.length * 0.25)], 0, 0], c1: Rgb = [Ls[Math.floor(Ls.length * 0.75)], 0, 0];
  // Seed chroma at the overall median so the first assignment is by lightness.
  const ma = median(labs.map(l => l[1])), mb = median(labs.map(l => l[2]));
  c0 = [c0[0], ma, mb]; c1 = [c1[0], ma, mb];
  let assign = new Uint8Array(labs.length);
  const d2 = (a: Rgb, b: Rgb) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;
  for (let it = 0; it < 12; it++) {
    const next = new Uint8Array(labs.length);
    const sum = [[0, 0, 0, 0], [0, 0, 0, 0]];
    labs.forEach((l, i) => { const k = d2(l, c0) <= d2(l, c1) ? 0 : 1; next[i] = k; sum[k][0] += l[0]; sum[k][1] += l[1]; sum[k][2] += l[2]; sum[k][3]++; });
    if (sum[0][3]) c0 = [sum[0][0] / sum[0][3], sum[0][1] / sum[0][3], sum[0][2] / sum[0][3]];
    if (sum[1][3]) c1 = [sum[1][0] / sum[1][3], sum[1][1] / sum[1][3], sum[1][2] / sum[1][3]];
    const same = next.every((v, i) => v === assign[i]);
    assign = next;
    if (same && it) break;
  }
  const darkerK = c0[0] <= c1[0] ? 0 : 1;
  const nDark = assign.reduce((n, k) => n + (k === darkerK ? 1 : 0), 0), nPale = labs.length - nDark;
  const shares = {darker: +(nDark / labs.length).toFixed(3), paler: +(nPale / labs.length).toFixed(3)};
  let pick: WallFit['pick'], chosen: Rgb[];
  if (!nDark || !nPale) { pick = 'single'; chosen = labs; }
  else if (shares.paler >= PALER_MIN_SHARE) { pick = 'paler'; chosen = labs.filter((_, i) => assign[i] !== darkerK); }
  else { pick = 'dominant'; chosen = labs.filter((_, i) => assign[i] === darkerK); }
  let split = false;
  if (!opts.painted && chosen.length >= MIN_PIXELS) {
    const c = chosen.map(l => Math.hypot(l[1], l[2])), t = otsu01(c.map(v => Math.min(1, v / BRICK_SPLIT.scale))) * BRICK_SPLIT.scale;
    const hi = chosen.filter((_, i) => c[i] >= t), lo = chosen.filter((_, i) => c[i] < t);
    const mean = (xs: Rgb[]) => xs.reduce((s, l) => s + Math.hypot(l[1], l[2]), 0) / Math.max(1, xs.length);
    if (hi.length >= chosen.length * BRICK_SPLIT.minHighShare && lo.length && mean(hi) - mean(lo) >= BRICK_SPLIT.minGap) { chosen = hi; split = true; }
  }
  let lab: Rgb = [median(chosen.map(l => l[0])), median(chosen.map(l => l[1])), median(chosen.map(l => l[2]))];
  let neutralised = false;
  if (opts.painted && lab[0] <= DARK_PAINT.maxL) { lab = [lab[0], 0, 0]; neutralised = true; }
  else if (opts.liftL !== undefined && lab[0] < opts.liftL) lab = liftWithChroma(lab, opts.liftL);
  const rgb = labToRgb(lab);
  return {hex: toHex(rgb), lab: lab.map(v => +v.toFixed(2)) as Rgb, pick, shares, foliage, trim, neutralised, brickSplit: split, pixels: labs.length};
}

/** Raise L* to `toL`, scaling chroma by the same ratio (hue unchanged): "chroma travels with any lift". */
export function liftWithChroma([L, a, b]: Rgb, toL: number): Rgb {
  if (L >= toL || L <= 0) return [Math.max(L, toL), a, b];
  const k = toL / L;
  return [toL, a * k, b * k];
}

/**
 * One wall colour from several captures' fits (one vote per capture: years and days light a front differently, the
 * 2019 / 2020 / 2021 / 2022 crops of Nassaukade 145 read L* 64 / 81 / 32 / 37). Median L*, median chroma and the
 * circular-median hue (brickTone.ts combineBrickTones), so one sunlit or dull capture moves none of the three past the
 * middle one. A dark painted wall stays neutral (any capture neutralised and the median L* <= DARK_PAINT.maxL).
 */
export function combineWallFits(fits: readonly WallFit[]): {hex: string; lab: Rgb; votes: number; neutral: boolean} | null {
  if (!fits.length) return null;
  const Ls = fits.map(f => f.lab[0]), L = median(Ls);
  if (fits.some(f => f.neutralised) && L <= DARK_PAINT.maxL) return {hex: toHex(labToRgb([L, 0, 0])), lab: [+L.toFixed(2), 0, 0], votes: fits.length, neutral: true};
  const rgb = combineBrickTones(fits.map(f => labToRgb(f.lab)));
  return {hex: toHex(rgb), lab: rgbToLab(rgb).map(v => +v.toFixed(2)) as Rgb, votes: fits.length, neutral: false};
}
