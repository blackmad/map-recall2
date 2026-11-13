/**
 * Wall exposure (lane WC, #384; docs/house-line.md §15). Flag `?wallExposure=off|floor|gain|norm`, `WALL_EXPOSURE` in Node,
 * default `off` (David's call on #384; off is byte-identical).
 *
 * D1 stages a photo-measured wall from lane W1's wall sample of the pinned panorama (stage.ts wallBrickFromSample). 153 of
 * 194 AH07 samples sit below the city brick floor: most are overcast winter captures and shaded fronts, not near-black
 * brick. Measured on 138 AH07 fronts with 2-4 captures each (scripts/house-specs/wall-exposure/captures.ts): 60 % of the
 * variance of a raw sample's ln Y is the capture, 40 % the wall (ICC 0.40). The three options:
 *   floor  (a) the brick floor lowered for photo-measured walls: the sample as measured, darker walls allowed;
 *   gain   (b) one gain for every photo-measured sample (EXPOSURE.gainB, the AH07 median of the `norm` gains), then the
 *              existing floor: the population is lifted, the capture's own exposure is not removed;
 *   norm   (c) per-capture normalisation: the sample x (target / reference), the reference the geometric mean of the
 *              capture's white level on the pand's own wall (95th percentile Y: frames, dressings) and the scene's median
 *              Y (analyse.ts wallExposureRef), then the existing floor. Cross-capture ICC 0.63 (within-pand variance
 *              0.281 -> 0.082, between-pand 0.184 -> 0.137).
 *   normfloor  (c) then (a): normalised, and the lowered floor (the staging floor is the recipe route's cityWallTint clamp;
 *              the generic route has no such clamp, so (c) alone still parks 80 of 185 AH07 walls on it).
 * Gains act on linear RGB (chromaticity kept, so a dull red-orange brick regains its chroma as it regains its lightness).
 * The staged spec carries the three bricks as `facts/wallExposure` (stage.ts); the extract's view carries them
 * (`view.wallExposure`) and decorate.ts swaps the view's wall under the flag. This file is pure.
 */
import { hexToRgb, rgbToHex } from '../look/palette.ts';

export type WallExposureMode = 'off' | 'floor' | 'gain' | 'norm' | 'normfloor';
export const WALL_EXPOSURE_MODES: readonly WallExposureMode[] = ['off', 'floor', 'gain', 'norm', 'normfloor'];
/** The default (`off`): no exposure rule. Changing it is David's call (#384). */
export const WALL_EXPOSURE_DEFAULT: WallExposureMode = 'off';

export const EXPOSURE = {
  /** (c) target of the reference sqrt(white x scene) (linear Y): the 80th percentile over the 428 AH07 captures, a well-lit day. */
  target: 0.23,
  /** (c) gain clamp: never darken a sample by more than this, nor lift it by more than gainMax. */
  gainMin: 0.8,
  gainMax: 3,
  /** (b) the one gain: the AH07 median of the (c) gains on the pinned captures. */
  gainB: 1.69,
  /** (a) the city brick tint floor for photo-measured walls (CITY_BRICK_LIGHTNESS[0] is 0.3). */
  floorTintL: 0.16,
};

/** The capture's references (analyse.ts ExposureRef), linear Y. */
export type ExposureRefLike = { white: number; scene: number };
/** (c) the reference level: the geometric mean of the wall's white level and the scene median. */
export const exposureLevel = (ref: ExposureRefLike): number => Math.sqrt(Math.max(1e-4, ref.white) * Math.max(1e-4, ref.scene));
/** (c) the capture's gain, clamped. */
export const normGain = (ref: ExposureRefLike): number => Math.min(EXPOSURE.gainMax, Math.max(EXPOSURE.gainMin, EXPOSURE.target / exposureLevel(ref)));

const lin = (c: number) => { const v = c / 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
const unlin = (c: number) => 255 * (c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055);
/** A colour x gain in linear light, each channel clipped at white (a gain of 1 returns the hex lower-cased). */
export function exposeHex(hex: string, gain: number): string {
  if (gain === 1) return hex.toLowerCase();
  return rgbToHex(hexToRgb(hex).map(c => Math.max(0, Math.min(255, Math.round(unlin(Math.min(1, lin(c) * gain)))))) as [number, number, number]);
}

/** `?wallExposure=` / WALL_EXPOSURE, an unknown value reads as the default. */
export function wallExposureModeOf(search?: string | null, env?: string | null): WallExposureMode {
  const v = (search ? /[?&]wallExposure=(\w+)/.exec(search)?.[1] : undefined) ?? env ?? undefined;
  return (WALL_EXPOSURE_MODES as readonly string[]).includes(v ?? '') ? (v as WallExposureMode) : WALL_EXPOSURE_DEFAULT;
}
let cached: WallExposureMode | undefined;
/** The mode as the runtime sees it: the page's query in a browser, WALL_EXPOSURE in Node. Read once. */
export function wallExposureMode(): WallExposureMode {
  if (cached !== undefined) return cached;
  const g = globalThis as { location?: { search?: string }; process?: { env?: Record<string, string | undefined> } };
  return (cached = wallExposureModeOf(g.location?.search ?? null, g.process?.env?.WALL_EXPOSURE ?? null));
}
/** Tests only: forget the cached mode. */
export const resetWallExposureMode = () => { cached = undefined; };

/** The staged alternatives (`facts/wallExposure`): the brick each option stages, and the off brick they replace. */
export type WallExposureFact = { off: string; floor: string; gain: string; norm: string; normfloor: string; /** (c)'s gain on this capture */ g: number };
const HEX = /^#[0-9a-f]{6}$/i;
export const isWallExposureFact = (v: unknown): v is WallExposureFact =>
  !!v && typeof v === 'object' && (['off', 'floor', 'gain', 'norm', 'normfloor'] as const).every(k => HEX.test(String((v as Record<string, unknown>)[k]))) && Number.isFinite((v as { g?: unknown }).g);
/** The wall a view draws under `mode`: the option's brick when the view's wall is still the staged off brick. */
export function exposedWall(wallHex: string | undefined, fact: Omit<WallExposureFact, 'g'> | undefined, mode: WallExposureMode = wallExposureMode()): string | undefined {
  if (mode === 'off' || !fact || !wallHex || wallHex.toLowerCase() !== fact.off.toLowerCase()) return wallHex;
  return fact[mode];
}

// ---- finish (task 2): `?wallFinish=1`, WALL_FINISH=1, default off ------------------------------------------------------
/**
 * A front the describer reads as render, stone or painted (precision 0.85-0.89) draws the kit's smooth painted cells
 * (bayLook.ts paintedLayers, lane W2) instead of brick courses; a stone front takes a stone tone. Off: brick cells, as before.
 */
export const WALL_FINISH_DEFAULT_ON = false;
export function wallFinishEnabled(search?: string | null, env?: string | null): boolean {
  const v = (search ? /[?&]wallFinish=([01])\b/.exec(search)?.[1] : undefined) ?? env ?? undefined;
  return v === '1' ? true : v === '0' ? false : WALL_FINISH_DEFAULT_ON;
}
let finishCached: boolean | undefined;
export function wallFinishOn(): boolean {
  if (finishCached !== undefined) return finishCached;
  const g = globalThis as { location?: { search?: string }; process?: { env?: Record<string, string | undefined> } };
  return (finishCached = wallFinishEnabled(g.location?.search ?? null, g.process?.env?.WALL_FINISH ?? null));
}
export const resetWallFinish = () => { finishCached = undefined; };
/** The smooth finish a spec's wall material asks for: render (stucco) and painted brick paint, stone a stone face. */
export function smoothFinishOf(material: string | undefined, stone: boolean | undefined): 'painted' | 'stone' | null {
  if (stone) return 'stone';
  return material === 'stucco' || material === 'painted-brick' ? 'painted' : null;
}
/** City stone (palette.ts CITY_STONE): the tone a stone front takes when no reading says otherwise. */
export const STONE_HEX = '#cfc8b8';
