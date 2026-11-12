/**
 * `brickLift=v2`: the dark-brick lift (lane #373, 2026-11-12; docs/house-line.md §9). off by default (it was on briefly on 2026-11-12; the user:
 * "go for correctness, we can lighten it later"); `?brickLift=v1` (BRICK_LIFT=v1 in Node) is the escape hatch and draws the old
 * lift byte-for-byte: every function the runtime calls returns the v1 value when the flag says v1.
 *
 * Why. Measured on 59 plain-brick c19 pands of Oud-West / De Baarsjes (overcast winter panoramas, wallFit's masks and white
 * balance), the game drew brick 24 L* lighter than the panorama (median +25, p10 +8, p90 +37) and with 2.5x the chroma. Three
 * stages, none of them the period palette alone:
 *  1. the buurt profile's wall pool holds bright and grey entries (mean L* 48 against 30 measured);
 *  2. `cityWallTint` (l' = clamp(0.12 + 0.9 l, 0.3, 0.6)) lifts a dark brick by ~4 L* and floors it at HSL 0.3 (about L* 37, while
 *     measured walls sit at 21-35), so no dark purple-brown can be drawn at all;
 *  3. the sunny exposure gain adds ~2.
 * v2 changes the first two and leaves the third: a profile brick wall takes a linear-light gain of `profileGain`; a wall
 * below `paleL` HSL lightness (light buff excepted) lifts by a small offset instead (`l' = clamp(l + offset, floor, ceil)`),
 * hue kept, saturation clamp as today (a grey stays grey); the c19 period brick entries are replaced by `C19_WALLS_V2`.
 * Pale render, white and buff take today's tint untouched (`brickLiftV2Tint` returns null for them), so they stay bright.
 * Aim: the drawn wall a little lighter than the overcast measurement (median residual +5.7 L*, mean +8.1), the brighter-palette
 * priority of 2026-10-16; the accents (white bands, frames, cornices) carry the brightness.
 * Pure, no DOM. `?brickLift=v1` in the page, BRICK_LIFT=v1 in Node: the old lift. Read once.
 */
import { hexToRgb, hslToRgb, rgbToHex, rgbToHsl } from './palette.js';
import { scaleLinear } from './sunny.js';
import { measuredPeriodList } from './measuredWallPool.js';

export const BRICK_LIFT_V2 = {
  /** HSL lightness offset, floor and ceiling of a lifted brick wall (today: 0.12 + 0.9 l, floor 0.3, ceiling 0.6). */
  offset: 0.05, floor: 0.14, ceil: 0.6,
  /** A wall at or above this HSL lightness is render or paint: today's tint (sunlitPeriodWall's PALE_L). */
  paleL: 0.62,
  /** Light buff: HSL l >= buff.l, saturation >= buff.s, hue inside buff.h. Takes today's tint. */
  buff: { l: 0.5, s: 0.3, h: [35, 65] },
  /** Saturation clamp of a coloured brick (as cityWallTint); below `greyBelowS` the saturation stays. */
  sat: [0.12, 0.5], greyBelowS: 0.12,
  /** Linear-light gain on a buurt profile's brick wall before the lift. */
  profileGain: 0.4,
} as const;

/** `PERIOD_WALLS.photo.c19` under v2: the red-brown brick entries drawn at the measured quantiles; buff, cream and stucco entries unchanged. */
export const C19_WALLS_V2: readonly string[] = ['#564543', '#564543', '#654a34', '#594940', '#594b40', '#d3b184', '#e2d5ba', '#e2d5ba', '#d9c5a4', '#764e2e'];

// OFF by default again (integrator, 2026-11-12): the wall-colour-truth frames (lane/wall-colour-truth-20261112,
// screenshots ui/2026-11-12-wall-colour-truth/) show v2 closer to the photo on only 5 of 11 walls (mean dE 0.124 -> 0.118),
// turning brown brick near-black grey (159937) or redder (160049). `?brickLift=v2` keeps it reachable for the next lane.
export const BRICK_LIFT_DEFAULT_ON = false;
export function brickLiftEnabled(search?: string | null, env?: string | null): boolean {
  const q = search ? /[?&]brickLift=(\w+)/.exec(search)?.[1] : undefined, v = q ?? env;
  return v === 'v1' ? false : v === 'v2' ? true : BRICK_LIFT_DEFAULT_ON;
}
let cached: boolean | undefined;
/** The flag as the runtime sees it: the page's query in a browser, BRICK_LIFT in Node (default v2). Read once. */
export function brickLiftOn(): boolean {
  if (cached !== undefined) return cached;
  const g = globalThis as { location?: { search?: string }; process?: { env?: Record<string, string | undefined> } };
  return (cached = brickLiftEnabled(g.location?.search ?? null, g.process?.env?.BRICK_LIFT ?? null));
}
/** Tests only: forget the cached flag. */
export const resetBrickLiftFlag = () => { cached = undefined; };

/** A dark or mid brick, grey brick included: below `paleL` and not light buff. These take the lift and the profile gain. */
export function isDarkBrick(hex: string): boolean {
  const [h, s, l] = rgbToHsl(hexToRgb(hex)), b = BRICK_LIFT_V2.buff;
  return l < BRICK_LIFT_V2.paleL && !(l >= b.l && s >= b.s && h >= b.h[0] && h <= b.h[1]);
}

/** The v2 brick tint of a wall, or null when the wall is pale render, white or buff (today's tint stands). */
export function brickLiftV2Tint(hex: string): string | null {
  if (!isDarkBrick(hex)) return null;
  const [h, s, l] = rgbToHsl(hexToRgb(hex)), c = BRICK_LIFT_V2;
  return rgbToHex(hslToRgb([h, s < c.greyBelowS ? s : Math.min(c.sat[1], Math.max(c.sat[0], s)), Math.min(c.ceil, Math.max(c.floor, l + c.offset))]));
}
/** A buurt profile's wall under v2: a dark brick takes the linear-light gain, anything else is unchanged. */
export function brickLiftV2ProfileWall(hex: string): string {
  return isDarkBrick(hex) ? scaleLinear(hex, BRICK_LIFT_V2.profileGain) : hex;
}
/** The period wall list the runtime picks from: the measured list under `?wallPool` (default on), C19_WALLS_V2 for the photo look's c19 archetype under v2, else `base`. */
export function periodWallList<T extends readonly string[] | null>(look: string, archetype: string, base: T): T | readonly string[] {
  // The measured wall pool's period list (look/measuredWallPool.ts, lane W1, `?wallPool=0`) outranks both.
  const measured = look === 'photo' ? measuredPeriodList(archetype) : null;
  if (measured) return measured;
  return brickLiftOn() && look === 'photo' && archetype === 'c19' ? C19_WALLS_V2 : base;
}
