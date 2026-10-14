// How bright the light rig draws flat ground, and the gain that undoes it (pure).
//
// The own ground is lit by the shared rig (rendererShared/lightRig.ts): a
// level surface in full sun receives the sun at its elevation plus the whole
// sky, and three's Lambert divides by π. Under the default rig that is 0.83 of
// the albedo in linear luminance (≈ 0.92 in sRGB), and 0.66 in cast shadow, so
// every ground colour drew darker than its palette value, while the basemap
// beyond the resident ring (basemapPalette.ts) and the legacy ground draw
// their palette flat. The user's "city too dark" (live play 2026-10-14) was
// mostly this plus a near-black asphalt prior.
//
// `FLAT_GROUND_GAIN` is the scalar (luminance, not per channel, so the sun's
// warmth stays) that makes a level, sunlit ground surface draw exactly its
// palette luminance. Buildings, trees and vehicles are not touched: their
// calibration (docs/LOOK.md §Parity) is against the rig as it is.

import { DEFAULT_LIGHT_RIG, SHADOW_FILL, type LightRigOptions } from '../rendererShared/lightRig.js';

const srgbToLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const linearToSrgb = (c: number) => (c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055);
const hexLinear = (hex: string): [number, number, number] => {
  const h = hex.replace('#', '');
  return [0, 2, 4].map(i => srgbToLinear(parseInt(h.slice(i, i + 2), 16) / 255)) as [number, number, number];
};
const Y = (c: readonly number[]) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];

/**
 * Linear-RGB factor the rig applies to the albedo of an upward-facing surface
 * (three.js: direct sun `colour × intensity × cos(zenith)` plus hemisphere sky
 * `skyColour × intensity`, both × 1/π). `sunShare` is the share of the sun that
 * reaches it (1 in sun, `SHADOW_FILL` in cast shadow).
 */
export function flatGroundLight(rig: Required<LightRigOptions> = DEFAULT_LIGHT_RIG, sunShare = 1): [number, number, number] {
  const sun = hexLinear(rig.sunColour), sky = hexLinear(rig.skyColour);
  const cosZ = Math.sin((rig.sunElevationDeg * Math.PI) / 180);
  return [0, 1, 2].map(i => (sun[i] * rig.sunIntensity * cosZ * sunShare + sky[i] * rig.skyIntensity) / Math.PI) as [number, number, number];
}

/** Luminance of `flatGroundLight` (linear). */
export const flatGroundLuminance = (rig: Required<LightRigOptions> = DEFAULT_LIGHT_RIG, sunShare = 1) => Y(flatGroundLight(rig, sunShare));

/** Scalar gain on ground materials so a level sunlit surface draws its palette luminance. */
export const FLAT_GROUND_GAIN = 1 / flatGroundLuminance();

/** sRGB value (0–255) a grey palette value `v` draws at on level ground, in sun or cast shadow, with a material gain. */
export function drawnGrey(v: number, gain = 1, shadow = false): number {
  const lit = flatGroundLuminance(DEFAULT_LIGHT_RIG, shadow ? SHADOW_FILL : 1) * gain;
  return Math.min(255, 255 * linearToSrgb(Math.min(1, srgbToLinear(v / 255) * lit)));
}
