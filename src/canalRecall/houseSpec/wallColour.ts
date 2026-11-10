/**
 * The wall-colour rule of the house line (lane H9, 2026-11-10; docs/house-line.md §1 "The wall colour").
 *
 * A HouseSpec's wall colour is a street-photo reading (`palette.brick`: a block-face strip or a pand-reference crop
 * read by `buildingRecipe/measureFacade.ts`). Drawn raw, those readings are overcast and darker than the city's
 * palette: H1 held them (`SPEC_WALLS_HELD`) because Kinkerstraat 244-332 rendered darker than the generic period
 * colours, against the user's brighter-palette priority (2026-10-16). Held, every measured house fell back to its
 * period colour, which is the wrong colour *family* (the user's easy-houses sheet, 2026-11-10: near-black painted
 * fronts as white plaster or orange brick, pale salmon brick as dark maroon).
 *
 * The rule keeps what the photo says and lifts how bright it is drawn, in one place:
 *  - OKLab hue and chroma are kept (a brown stays brown, a neutral black or grey stays neutral, salmon stays salmon);
 *  - lightness goes through one monotone lift towards white, `L' = 1 - (1 - L) * (1 - LIFT.k)`, so the order of the
 *    walls in a row holds (a near-black painted front is still the darkest front in its row), the overcast readings
 *    come up to the city's brightness, and a pale wall moves least (pale brick stays pale brick, not cream);
 *  - a dark neutral (black or charcoal paint) takes none of the lift (`liftShare`): its reading is already relative to
 *    its own white trim, and lifted it drew level with the brown brick beside it;
 *  - a floor (`LIFT.minL`) keeps a black front from drawing as a hole, a ceiling (`LIFT.maxL`) keeps white below
 *    the paper white of the trim;
 *  - out of the sRGB gamut, chroma is reduced at the same lightness and hue.
 * Pure, no DOM. `?specWalls=0` (or SPEC_WALLS=0 in Node) draws the period colour again, as H1 did.
 */

/** The lift constants (OKLab L, 0..1). Measured on the easy-houses set and Kinkerstraat 244-332 (docs/house-line.md §1). */
export const SPEC_WALL_LIFT = { k: 0.2, minL: 0.34, maxL: 0.93, chroma: 1, paint: { c0: 0.01, c1: 0.018, l0: 0.45, l1: 0.6 } } as const;
/**
 * How much of the lift a reading takes: all of it, except a dark neutral (black or charcoal paint), which takes none.
 * The readings are normalised to the crop's white trim (measureFacade's light-trim rule), so a painted black front
 * already reads dark *against its own white frames*; lifted like overcast brick it drew Herengracht 0363100012175321
 * (near-black in the photo) as mid grey, level with the brown brick beside it. The weight falls smoothly from chroma
 * `c0` to `c1` and lightness `l0` to `l1`, so the lift stays monotone in lightness.
 */
export function liftShare(L: number, C: number): number {
  const { c0, c1, l0, l1 } = SPEC_WALL_LIFT.paint;
  const clamp = (v: number) => Math.max(0, Math.min(1, v));
  return 1 - (1 - clamp((C - c0) / (c1 - c0))) * (1 - clamp((L - l0) / (l1 - l0)));
}

/** Default on; `?specWalls=0` in the page or SPEC_WALLS=0 in Node keeps the period colour (the H1 hold). */
export const SPEC_WALLS_DEFAULT = true;
export function specWallsEnabled(search?: string | null, env?: string | null): boolean {
  const q = search ? /[?&]specWalls=([01])\b/.exec(search)?.[1] : undefined;
  const v = q ?? (env === '0' || env === '1' ? env : undefined);
  return v === undefined ? SPEC_WALLS_DEFAULT : v === '1';
}
/** The flag as the runtime sees it: the page's query in a browser, SPEC_WALLS in Node. Read once. */
let cached: boolean | undefined;
export function specWallsOn(): boolean {
  if (cached !== undefined) return cached;
  const g = globalThis as { location?: { search?: string }; process?: { env?: Record<string, string | undefined> } };
  return (cached = specWallsEnabled(g.location?.search ?? null, g.process?.env?.SPEC_WALLS ?? null));
}
/** Tests only: forget the cached flag. */
export const resetSpecWallsFlag = () => { cached = undefined; };

// --- OKLab (Ottosson 2020) ------------------------------------------------------------------------------------------
type Vec3 = [number, number, number];
const toLin = (c: number) => { const v = c / 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
const toSrgb = (v: number) => 255 * (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055);
export function hexToOklab(hex: string): Vec3 {
  const n = parseInt(hex.slice(1), 16), r = toLin((n >> 16) & 255), g = toLin((n >> 8) & 255), b = toLin(n & 255);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s];
}
/** Linear sRGB of an OKLab colour (may be out of gamut). */
function oklabToLinear([L, a, b]: Vec3): Vec3 {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3, m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3, s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s];
}
const inGamut = (c: Vec3) => c.every(v => v >= -1e-4 && v <= 1 + 1e-4);
export function oklabToHex(lab: Vec3): string {
  let [L, a, b] = lab, lin = oklabToLinear([L, a, b]);
  // Out of gamut: halve the chroma step by step at the same lightness and hue (bisection on the chroma scale).
  if (!inGamut(lin)) {
    let lo = 0, hi = 1;
    for (let i = 0; i < 20; i++) { const k = (lo + hi) / 2; if (inGamut(oklabToLinear([L, a * k, b * k]))) lo = k; else hi = k; }
    a *= lo; b *= lo; lin = oklabToLinear([L, a, b]);
  }
  return '#' + lin.map(v => Math.round(Math.max(0, Math.min(255, toSrgb(Math.max(0, Math.min(1, v)))))).toString(16).padStart(2, '0')).join('');
}

/** A measured wall reading -> the tint the generic mesher draws: measured hue and chroma, lifted lightness. */
export function specWallDisplay(measuredHex: string): string {
  const [L, a, b] = hexToOklab(measuredHex), k = SPEC_WALL_LIFT.k * liftShare(L, Math.hypot(a, b));
  const L2 = Math.min(SPEC_WALL_LIFT.maxL, Math.max(SPEC_WALL_LIFT.minL, 1 - (1 - L) * (1 - k)));
  return oklabToHex([L2, a * SPEC_WALL_LIFT.chroma, b * SPEC_WALL_LIFT.chroma]);
}

/**
 * The colour family a wall reads as, for the likeness gate (lane H9): neutral (chroma under NEUTRAL_C) by lightness,
 * warm by lightness and hue. Lightness tiers are OKLab; the photo and the render are compared after their own
 * exposure normalisation (measureFacade's light-trim rule), so the tiers are wide.
 */
export type WallColourFamily = 'neutral-dark' | 'neutral-mid' | 'neutral-light' | 'brick-dark' | 'brick-red' | 'brick-brown' | 'brick-pale';
export const FAMILY = { neutralC: 0.03, darkL: 0.42, lightL: 0.72, paleL: 0.68, redHue: 40 } as const;
export function wallColourFamily(hex: string): WallColourFamily {
  const [L, a, b] = hexToOklab(hex), C = Math.hypot(a, b), h = (Math.atan2(b, a) * 180) / Math.PI;
  if (C < FAMILY.neutralC) return L < FAMILY.darkL ? 'neutral-dark' : L < FAMILY.lightL ? 'neutral-mid' : 'neutral-light';
  if (L >= FAMILY.paleL) return 'brick-pale';
  if (L < FAMILY.darkL) return 'brick-dark';
  return h < FAMILY.redHue ? 'brick-red' : 'brick-brown';
}
