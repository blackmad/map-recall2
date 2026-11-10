// Calmer tones (#161 levers 4 and 5, default off). Both are pure colour maps over what the frame already draws; no new
// models, no new evidence, and an unflagged call returns its input unchanged.
//
//  - Lever 4, `?treeCalm=1`: crown green loses TREE_CALM_DESAT of its saturation (the 15-20 % of the design note). Far
//    crowns already go bluer and lighter through the depth fade (engine depthFade: trees take fog); dropping the
//    smallest crowns beyond 200 m needs a per-frame instance cull and is not part of this step.
//  - Lever 5, `?roofFamily=1`: a roof tint within ROOF_FAMILY_REACH of one of a few family tones (the orthophoto's
//    recurring pantile reds, dark pantile, slate greys, gravel, bitumen, membrane) is pulled ROOF_FAMILY_PULL of the
//    way to it, so a row's roofs read as 3-4 tones; a roof that measures strongly different keeps its measurement.

import { hexToRgb, rgbToHex, rgbToHsl, hslToRgb, ROOF_SLOT_TONES, MEASURED_SLATE, type RGB } from './palette';

export const TREE_CALM_DESAT = 0.18;
export const ROOF_FAMILY_PULL = 0.7;
/** Euclidean RGB distance (0-255) within which a roof snaps toward a family; beyond it the measurement stands. */
export const ROOF_FAMILY_REACH = 46;

// Built on first use: palette.ts calls snapRoofFamily from cityTint, so nothing here may read palette.ts at load.
let families: readonly string[] | null = null;
export const roofFamilies = (): readonly string[] => (families ??= [
  ROOF_SLOT_TONES['pantile-red'].hex, ROOF_SLOT_TONES['pantile-dark'].hex, MEASURED_SLATE[0], MEASURED_SLATE[1],
  ROOF_SLOT_TONES.gravel.hex, ROOF_SLOT_TONES['bitumen-dark'].hex, ROOF_SLOT_TONES['white-membrane'].hex,
]);

function flagOf(name: string, global: string): boolean {
  const g = globalThis as Record<string, unknown> & { location?: { search?: string } };
  const asked = g[global] ?? (typeof URLSearchParams === 'function' ? new URLSearchParams(g.location?.search ?? '').get(name) : null);
  return asked === true || asked === '1' || asked === 'true' || asked === 'on';
}
let treeFlag: boolean | null = null, roofFlag: boolean | null = null;
export const treeCalmFlag = (): boolean => (treeFlag ??= flagOf('treeCalm', '__canalRecallTreeCalm'));
export const roofFamilyFlag = (): boolean => (roofFlag ??= flagOf('roofFamily', '__canalRecallRoofFamily'));

/** A crown colour with TREE_CALM_DESAT less saturation (hue and lightness held). */
export function calmFoliage(hex: string, amount = TREE_CALM_DESAT): string {
  const [h, s, l] = rgbToHsl(hexToRgb(hex));
  return rgbToHex(hslToRgb([h, s * (1 - amount), l]));
}

const dist = (a: RGB, b: RGB) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

/** The roof family tone nearest `hex` within reach, else null. */
export function nearestRoofFamily(hex: string, pool: readonly string[] = roofFamilies(), reach = ROOF_FAMILY_REACH): string | null {
  const rgb = hexToRgb(hex);
  let best: string | null = null, bestD = reach;
  for (const f of pool) { const d = dist(rgb, hexToRgb(f)); if (d <= bestD) { bestD = d; best = f; } }
  return best;
}

/** A measured roof tint pulled toward its family; a roof beyond reach of every family is returned as it came. */
export function snapRoofFamily(hex: string, pull = ROOF_FAMILY_PULL): string {
  const family = nearestRoofFamily(hex);
  if (!family) return hex;
  const a = hexToRgb(hex), b = hexToRgb(family);
  return rgbToHex([0, 1, 2].map(i => a[i] + (b[i] - a[i]) * pull) as RGB);
}
