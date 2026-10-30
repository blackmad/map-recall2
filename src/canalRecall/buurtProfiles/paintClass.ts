/**
 * Painted or bare brick, decided on an exposure-normalised wall colour (GitHub #121).
 *
 * The buurt profiles (scripts/buurt-profiles/derive.ts) read walls from photos whose exposure varies a lot: the
 * panorama thumbnails' light trim (white frames, sills) reads L* 39-97 (median 67). A fixed L* test on the raw wall
 * then calls a white front in a dull capture brick, and a cream or buff front (L* >= 62 but C* >= 14) brick too; the
 * brick calibration then lifts its chroma about six times and clamps it to the brightest allowed brick, a salmon
 * L* 72 C* 34 (`#e3a280`-like swatches in most centre profiles, Kerkstraat's white and grey fronts drawn salmon).
 *
 * Here a wall is first brought to ONE white point, the light-trim reference that measureFacade.ts uses for every crop
 * (light trim -> 215/255, gain 0.75-1.45). A sample's own trim sets the gain when it is real trim (clearly lighter
 * than the wall); otherwise (no pale pixels, or the wall is its own trim) the city white point does: the median trim
 * of the reference source. The painted test runs on that normalised colour. Bare brick keeps its raw reading (the
 * #118 decision: a buurt keeps the lightness its photos measure); only the painted decision and the painted swatch
 * use the normalised colour.
 */

export type Rgb = readonly number[];

/** The light-trim reference every crop is normalised to (measureFacade.ts lightTrimNormalisation). */
export const TRIM_REF = 215;
export const GAIN_RANGE: readonly [number, number] = [0.75, 1.45];
/** A sample's trim counts as real trim when it is at least this much lighter (L*) than the wall (lightTrimNormalisation). */
export const TRIM_GAP_L = 25;

const lin = (v: number) => { const c = v / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
export function lchOf(rgb: Rgb): { L: number; C: number; h: number } {
  const R = lin(rgb[0]), G = lin(rgb[1]), B = lin(rgb[2]);
  const f = (t: number) => t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116;
  const X = f((0.4124 * R + 0.3576 * G + 0.1805 * B) / 0.95047), Y = f(0.2126 * R + 0.7152 * G + 0.0722 * B), Z = f((0.0193 * R + 0.1192 * G + 0.9505 * B) / 1.08883);
  const L = 116 * Y - 16, a = 500 * (X - Y), b = 200 * (Y - Z);
  return { L, C: Math.hypot(a, b), h: (Math.atan2(b, a) * 180 / Math.PI + 360) % 360 };
}
const meanY = (rgb: Rgb) => (rgb[0] + rgb[1] + rgb[2]) / 3;
const clampGain = (g: number) => Math.max(GAIN_RANGE[0], Math.min(GAIN_RANGE[1], g));

/** The city white point: the median light-trim level (mean of R, G, B) of a source's samples. */
export function cityTrimLevel(trims: readonly (Rgb | null | undefined)[]): number {
  const ys = trims.filter((t): t is Rgb => !!t).map(meanY).sort((a, b) => a - b);
  return ys.length ? ys[ys.length >> 1] : TRIM_REF;
}

/** Exposure gain for one wall: its own trim when that is real trim, else the city white point. */
export function trimGain(wall: Rgb, trim: Rgb | null | undefined, cityTrim: number): { gain: number; via: 'trim' | 'city' } {
  if (trim && meanY(trim) > 1 && lchOf(trim).L - lchOf(wall).L >= TRIM_GAP_L) return { gain: clampGain(TRIM_REF / meanY(trim)), via: 'trim' };
  return { gain: clampGain(TRIM_REF / Math.max(1, cityTrim)), via: 'city' };
}

export const scaleRgb = (rgb: Rgb, gain: number): number[] => [0, 1, 2].map(i => Math.max(0, Math.min(255, rgb[i] * gain)));

/**
 * Painted or rendered, on the normalised wall. Paint is light (L* >= 62) and either near-neutral (white and grey
 * render, C* < 14) or cream to buff (hue 60-110, C* < 30: cream render, sandstone, pale buff; never bare red brick,
 * whose hue sits at 15-55); or a mid cool grey-green (hue 100-250, C* < 12, L* >= 40). Sunlit red brick (L* 62+, hue
 * under 60, C* >= 14) stays brick. Dark neutral walls are not paint: in the thumbnails they are mostly brick in shade.
 */
export const PAINT = { minL: 62, neutralC: 14, creamHue: [60, 110] as const, creamC: 30, coolHue: [100, 250] as const, coolC: 12, coolMinL: 40 } as const;
export function paintedWall(rgb: Rgb): boolean {
  const { L, C, h } = lchOf(rgb);
  if (L >= PAINT.minL && (C < PAINT.neutralC || (h >= PAINT.creamHue[0] && h <= PAINT.creamHue[1] && C < PAINT.creamC))) return true;
  return L >= PAINT.coolMinL && h > PAINT.coolHue[0] && h < PAINT.coolHue[1] && C < PAINT.coolC;
}

/** One photo wall: painted or not on the normalised colour, and the colour its swatch should carry. */
export function classifyWall(wall: Rgb, trim: Rgb | null | undefined, cityTrim: number): { painted: boolean; normalised: number[]; gain: number; via: 'trim' | 'city' } {
  const t = trimGain(wall, trim, cityTrim), via = t.via;
  // A lift never takes the wall past the white point itself (a white front that is its own trim keeps its raw
  // reading, measureFacade.ts selfTrimWall): sunlit white render is not pushed to clipped 255.
  const gain = t.gain > 1 ? Math.min(t.gain, Math.max(1, TRIM_REF / Math.max(1, meanY(wall)))) : t.gain;
  const normalised = scaleRgb(wall, gain);
  return { painted: paintedWall(normalised), normalised, gain, via };
}
