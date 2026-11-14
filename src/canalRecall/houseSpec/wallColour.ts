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
 * The rule keeps what the photo says and draws it at the city's brightness (round 2, the judgement session's ruling
 * on #345: "brighter, not dour", and the trim misread; docs/house-line.md §1 "The wall colour"):
 *  - `specWallSource`: a reading lighter than its family's usual tone, on a brick front or against a reader's family,
 *    is a trim misread and draws the family tone instead (`FAMILY_TONE`);
 *  - `specWallDisplay`: lightness goes through one monotone lift towards white, `L' = 1 - (1 - L) * (1 - LIFT.k)`, so
 *    the order of the walls in a row holds; dark neutral paint takes none of it (`liftShare`);
 *  - warm pixel readings gain chroma with the lift (overcast readings carry about half the period palette's), their
 *    yellow cast comes half way back towards brick, and a hue-dependent cap stops brown turning ochre; neutrals keep
 *    theirs and a cool cast is damped;
 *  - a floor (`LIFT.minL`) keeps a black front from drawing as a hole, a ceiling (`LIFT.maxL`) keeps white below the
 *    paper white of the trim; out of the sRGB gamut, chroma is reduced at the same lightness and hue.
 * Pure, no DOM. `?specWalls=0` (or SPEC_WALLS=0 in Node) draws the period colour again, as H1 did.
 */

/** The lift constants (OKLab L, 0..1). Measured on the easy-houses set and Kinkerstraat 244-332 (docs/house-line.md §1). */
export const SPEC_WALL_LIFT = { k: 0.2, minL: 0.34, maxL: 0.93, chroma: 2.4, maxC: 0.12, hue: { pull: 0.5, toward: 40, warm: [20, 85], capAt: [45, 70], capC: [0.12, 0.06] }, neutralC: [0.015, 0.03], coolKeep: 0.35, darkL: [0.38, 0.46], darkGain: 0.35, darkLift: [0.3, 0.5], paleL: [0.65, 0.72], paint: { c0: 0.01, c1: 0.018, l0: 0.45, l1: 0.6 } } as const;
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

/**
 * `?wallChroma=0` (WALL_CHROMA=0 in Node) restores the round-3 chroma gain and hue pull of `specWallDisplay`; default on
 * (lane W1, 2026-11-12): a pixel reading keeps its own chroma and hue, the lightness lift stays. Measured per stage on the
 * house:frames pairs (docs/house-line.md §11): the readings sit at the photo's chroma (reading vs photo dC +0.01), the
 * decoration added +0.028 and a hue pull of -4 degrees, and the drawn walls ended at pixel C 0.043 against the photos'
 * 0.016, hue 48 against 62: brown brick drawn orange-red. The gain matched the old period palette's chroma, not the photo;
 * the user's ruling of 2026-11-12 is correctness first.
 */
export const WALL_CHROMA_TRUTH_DEFAULT = true;
export function wallChromaTruthEnabled(search?: string | null, env?: string | null): boolean {
  const q = search ? /[?&]wallChroma=([01])\b/.exec(search)?.[1] : undefined, v = q ?? (env === '0' || env === '1' ? env : undefined);
  return v === undefined ? WALL_CHROMA_TRUTH_DEFAULT : v === '1';
}
let chromaCached: boolean | undefined;
export function wallChromaTruthOn(): boolean {
  if (chromaCached !== undefined) return chromaCached;
  const g = globalThis as { location?: { search?: string }; process?: { env?: Record<string, string | undefined> } };
  return (chromaCached = wallChromaTruthEnabled(g.location?.search ?? null, g.process?.env?.WALL_CHROMA ?? null));
}
/** Tests only: forget the cached flag. */
export const resetWallChromaFlag = () => { chromaCached = undefined; };
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
/** An explicit opt-in (`?specWalls=1`, SPEC_WALLS=1) that draws the rule while SPEC_WALLS_HELD holds it: the before/after
 *  frame read and the rule's own tests. Read with the same cache as specWallsOn. */
export function specWallsForcedOn(): boolean {
  const g = globalThis as { location?: { search?: string }; process?: { env?: Record<string, string | undefined> } };
  const q = g.location?.search ? /[?&]specWalls=([01])\b/.exec(g.location.search)?.[1] : undefined;
  return (q ?? g.process?.env?.SPEC_WALLS) === '1';
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

/**
 * A wall colour -> the tint the generic mesher draws: measured hue, lifted lightness and, for a pixel reading, lifted
 * chroma. The overcast readings carry about half the period palette's chroma (Kinkerstraat 244-332: render C 0.065
 * before, 0.032 with chroma 1; the judgement session's ruling on #345, "brighter, not dour"), so chroma rises with the
 * same lift share as lightness (dark paint keeps its own; a near-neutral reading keeps its own), yellow-shifted warm hues
 * come half way back towards the brown tone, chroma is capped by hue (0.12 at red, 0.06 at yellow-brown: high chroma on
 * a yellowish brown reads ochre), then fitted to the sRGB gamut at the same lightness and hue. A family tone (`fromPixel: false`) is already a full-colour daylight tone: lightness only.
 */
/** `minL` (lane WC, `?wallExposure=floor|normfloor` only): a lower lightness floor than SPEC_WALL_LIFT.minL for a staged photo-measured wall. */
export function specWallDisplay(measuredHex: string, opts: { fromPixel?: boolean; minL?: number } = {}): string {
  const [L, a, b] = hexToOklab(measuredHex), C = Math.hypot(a, b), share = liftShare(L, C);
  // Round 3: the lift ramps in over darkLift (none at OKLab L 0.36, all of it from 0.5). Still monotone (dL'/dL =
  // (1 - k) + (1 - L) k' > 0, never reorders), and it widens the gap between a dark brown reading (L 0.41) and a red one
  // (L 0.45) instead of compressing it: a dark-brown street stays darker than a red one.
  const k = SPEC_WALL_LIFT.k * share * Math.max(0, Math.min(1, (L - SPEC_WALL_LIFT.darkLift[0]) / (SPEC_WALL_LIFT.darkLift[1] - SPEC_WALL_LIFT.darkLift[0])));
  const L2 = Math.min(SPEC_WALL_LIFT.maxL, Math.max(opts.minL ?? SPEC_WALL_LIFT.minL, 1 - (1 - L) * (1 - k)));
  if (opts.fromPixel === false || C < 1e-6) return oklabToHex([L2, a, b]);
  const lift = SPEC_WALL_LIFT, clamp = (v: number) => Math.max(0, Math.min(1, v));
  // A near-neutral reading stays neutral (its faint tint is camera cast: lifted, greys went blue or green).
  const colourful = clamp((C - lift.neutralC[0]) / (lift.neutralC[1] - lift.neutralC[0])) * share;
  // Round 3 (the ruling on round 2: "relative darkness is lost"): a dark reading (OKLab L under darkL, about HSL 0.30-0.36)
  // gains little chroma, so a dark brown street stays darker than a red one instead of rising into terracotta; a pale
  // reading (over paleL) keeps its own chroma and hue, so beige stays beige rather than turning peach.
  const darkRamp = clamp((L - lift.darkL[0]) / (lift.darkL[1] - lift.darkL[0])), dark = lift.darkGain + (1 - lift.darkGain) * darkRamp, pale = 1 - clamp((L - lift.paleL[0]) / (lift.paleL[1] - lift.paleL[0]));
  const gain = colourful * dark * pale;
  let h = (Math.atan2(b, a) * 180) / Math.PI;
  // Only warm readings gain chroma. A cool tint (blue, green) on a wall reading is camera cast, not paint, and keeps only
  // `coolKeep` of it (0363100012167431, a grey front read blue-grey, drew lilac).
  if (h < lift.hue.warm[0] || h > lift.hue.warm[1]) return oklabToHex([L2, a * lift.coolKeep, b * lift.coolKeep]);
  // Lane W1 (`?wallChroma`, default on): a warm reading keeps its measured chroma and hue.
  if (wallChromaTruthOn()) return oklabToHex([L2, a, b]);
  // Overcast readings sit yellower than brick (readings hue 52-72 vs the brown tone 46 and red-brown 33; J2: the pixel
  // turns red-brown into dull brown). Half of the shift past `toward` (40, the brick edge of the orange band) comes back,
  // so a lifted brown stays brown rather than orange-tan; a pale front keeps its hue.
  // A dark reading keeps its brown hue (pulled towards 40 and given chroma, it turned terracotta).
  if (h > lift.hue.toward) h += (lift.hue.toward - h) * lift.hue.pull * colourful * pale * darkRamp;
  const t = clamp((h - lift.hue.capAt[0]) / (lift.hue.capAt[1] - lift.hue.capAt[0]));
  const cap = lift.hue.capC[0] + (lift.hue.capC[1] - lift.hue.capC[0]) * t;
  const C2 = Math.min(C * (1 + (lift.chroma - 1) * gain), Math.max(C, cap));
  return oklabToHex([L2, C2 * Math.cos((h * Math.PI) / 180), C2 * Math.sin((h * Math.PI) / 180)]);
}

/** A reader's wall-colour family (the H5h hand-set vocabulary, docs/house-line.md §4c; J2's words map onto it). */
export const WALL_FAMILIES = ['white', 'grey', 'buff', 'orange', 'red', 'red-brown', 'brown', 'dark'] as const;
export type WallFamily = typeof WALL_FAMILIES[number];
/**
 * Each family's usual tone in neutral daylight: J2's swatches (scripts/jev/j2 on lane/jev-j2-20261110: near_black, red_brown,
 * orange, tan_yellow, grey_stone, white_plaster) and, for the hand set's red and mid brown, a tone between them.
 */
export const FAMILY_TONE: Record<WallFamily, string> = {
  white: '#e8e4da', grey: '#8a8d8f', buff: '#c4a574', orange: '#b8643c', red: '#9c4433', 'red-brown': '#8a4a3c', brown: '#6a4c3e', dark: '#2b2b2e',
};
const BRICK_FAMILIES: WallFamily[] = ['brown', 'red-brown', 'red', 'orange', 'buff'];
/** The family whose tone is nearest a colour (OKLab distance). */
export function nearestWallFamily(hex: string, among: readonly WallFamily[] = WALL_FAMILIES): WallFamily {
  const [L, a, b] = hexToOklab(hex);
  let best = among[0], d = Infinity;
  for (const f of among) { const [l2, a2, b2] = hexToOklab(FAMILY_TONE[f]); const e = Math.hypot(L - l2, a - a2, b - b2); if (e < d) { d = e; best = f; } }
  return best;
}
/** How much lighter than the family's usual tone (OKLab L) a reading may be before it reads as trim, not wall. */
export const TRIM_MISREAD_L = 0.05;
/**
 * The wall colour the rule starts from: the pixel reading, or the family's usual tone when the reading is a trim misread
 * (the judgement session's ruling on #345). A reading lighter than the family's usual tone, on a front whose finish is
 * brick or whose reader family (hand set, J2) disagrees with the pixel's family, has caught white speklagen, frames or
 * glare (Nieuwmarkt 0363100012182857: red brick with white bands read #ceb8ae, drawn pale pink-beige). Without a reader
 * family, a brick finish compares with the nearest brick family to the pixel.
 */
export function specWallSource(measuredHex: string, ctx: { family?: WallFamily | null; brick?: boolean }): { hex: string; fromPixel: boolean; family: WallFamily | null } {
  const family = ctx.family ?? (ctx.brick ? nearestWallFamily(measuredHex, BRICK_FAMILIES) : null);
  if (!family) return { hex: measuredHex, fromPixel: true, family: null };
  const lighter = hexToOklab(measuredHex)[0] > hexToOklab(FAMILY_TONE[family])[0] + TRIM_MISREAD_L;
  const disagrees = !!ctx.family && nearestWallFamily(measuredHex) !== ctx.family;
  return lighter && (ctx.brick || disagrees) ? { hex: FAMILY_TONE[family], fromPixel: false, family } : { hex: measuredHex, fromPixel: true, family };
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

/**
 * The pale-warm guard (lane H9f, the judgement session's rulings on the house:frames wall read, 2026-11-10, round 2).
 * Kinkerstraat 154359 and its row drew peach, orange and salmon where the photo is one uniform dark-brown brick row; the
 * relative flag cannot see it because the whole row shifted together. It judges the DRAWN colour (the reading after the
 * trim-misread rule and the lift, decorate.ts specWallColour), because a pale or a lifted reading is what draws peach:
 *  1. hold when the drawn colour has OKLab L over `PALE_WARM.minL` and hue inside `PALE_WARM.hue` (peach, salmon, orange);
 *  2. hold when the drawn L is more than `PALE_WARM.inversion` above the measured reading's L (a darkness inversion:
 *     orange for dark brown outside the hue band). The black floor (`SPEC_WALL_LIFT.minL`) is the design, not an inversion,
 *     so the reading is compared at no less than that floor.
 * A held pand keeps its period colour, as SPEC_WALL_HOLD does per pand. Both apply to brick or unknown walls only: a
 * stucco or light finish (register) or a reader's white, grey or buff family passes. Two agreeing capture dates would pass
 * a reading too; the spec view carries one date per pand (provenance `at` is the latest of the sources), so that
 * exception is not available and the family alone decides (`agreeingDates` is accepted for when the view carries it).
 */
export const PALE_WARM = { minL: 0.6, hue: [35, 70], inversion: 0.12 } as const;
const LIGHT_FAMILIES: readonly WallFamily[] = ['white', 'grey', 'buff'];
/** Rule 1 alone: a colour that reads peach, salmon or orange (pale and warm). */
export function paleWarmReading(hex: string): boolean {
  const [L, a, b] = hexToOklab(hex);
  const h = ((Math.atan2(b, a) * 180) / Math.PI + 360) % 360;
  return L > PALE_WARM.minL && h >= PALE_WARM.hue[0] && h <= PALE_WARM.hue[1];
}
/** True when the guard holds this drawn colour (`readingL`: the measured reading's OKLab L, for the inversion rule). */
export function paleWarmHeld(drawnHex: string, ctx: { family?: WallFamily | null; render?: boolean; agreeingDates?: number; readingL?: number }): boolean {
  if (ctx.render || (ctx.family && LIGHT_FAMILIES.includes(ctx.family)) || (ctx.agreeingDates ?? 1) >= 2) return false;
  if (paleWarmReading(drawnHex)) return true;
  return ctx.readingL !== undefined && hexToOklab(drawnHex)[0] - Math.max(ctx.readingL, SPEC_WALL_LIFT.minL) > PALE_WARM.inversion;
}

/**
 * The held-wall fallback is family-aware (lane H9g, #345). A pand the pale-warm guard holds keeps its period colour, and on
 * Kinkerstraat 154359 and its row the period colour the mesher resolves is a slate grey: the
 * buurt profile, the period-wall enricher or the material prior, none of which knows the pand is brick. A held pand that is
 * not stated light (stucco, painted, register light) is brick by the guard's own scope, so a grey (or a pale peach) fallback
 * is swapped for a dark, red or brown entry of the period palette, picked by `pick` (a hash of the pand id, the same one
 * the palette pick uses, so the choice is stable). A fallback already in a brick family stays.
 */
const HELD_BRICK_FAMILIES: readonly WallColourFamily[] = ['brick-dark', 'brick-red', 'brick-brown'];
export function heldBrickWall(fallbackHex: string, palette: readonly string[] | null | undefined, pick: number): string {
  if (HELD_BRICK_FAMILIES.includes(wallColourFamily(fallbackHex))) return fallbackHex;
  const bricks = (palette ?? []).filter(h => HELD_BRICK_FAMILIES.includes(wallColourFamily(h)));
  return bricks.length ? bricks[Math.abs(Math.trunc(pick)) % bricks.length] : fallbackHex;
}
/** A held pand takes the brick fallback unless its finish is stated light (stucco, painted, register light). */
export function heldTakesBrick(ctx: { wallMaterial?: string; registerFinish?: string }): boolean {
  return ctx.wallMaterial ? ctx.wallMaterial === 'brick' : ctx.registerFinish !== 'light';
}
