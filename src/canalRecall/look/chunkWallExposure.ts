// Street-chunk walls at the sunny look's exposure. Pure.
//
// Why (docs/chunk-brightness-20261016.md, 2026-10-16): with `?streetChunks=1` the block-face chunks drew their walls at
// 0.56-0.73 of their photo strip and 1.47 on Bilderdijkstraat 135-153. Decomposed on the five measured faces:
//   chunk / photo = (drawn head-on / strip wall) x (light on that wall) x (exposure gain, missing)
// - drawn head-on / strip wall (0.86-1.44 in sRGB): the authoring loop matches cell x cityTint(palette.brick) to the
//   rectified strip (scripts/block-face/review.ts wall-colour check), so a chunk wall facing the light IS the strip's
//   colour at the strip's own exposure; a few faces were lifted by eye over a dark capture;
// - light: every measured view of the four dark faces looks at a shade side (95-146 degrees off the sun's azimuth);
//   the sunny rig lights a shade side at 0.41 of a sun side in linear light, a white Lambert drew 171/255 there (and
//   244/255 on the sun-side Bilderdijkstraat wall);
// - the missing gain: per-house measured walls are normalised from their crop's white to a sunlit white
//   (sunny.ts `sunlitMeasuredWall`), but chunk walls carry no `tintSource`, so they took the city brick path
//   (cityWallTint, no exposure record) and drew the overcast reading.
// The fix brings every chunk wall to its photo colour normalised to sunlight: the drawn colour times
//   measuredWallGain(strip white) x stripOverDrawn
// in linear light, both measured per chunk on its strip by scripts/look/build-chunk-wall-exposure.ts. The shade side
// then draws 0.41 of that (the rig, as for every other wall).

import { FALLBACK_WALL_GAIN } from './measuredWhitePoints.js';
import { measuredWallGain, scaleLinear, sceneLookFrom, type SceneLook, type WhitePoint } from './sunny.js';
import { CHUNK_WALL_EXPOSURE_DATA } from './chunkWallExposureData.js';

/** What a model's photo-matched walls were matched under (look/chunkWallExposureData.ts). */
export interface WallExposure {
  /** Raw light-trim white of the photo (sRGB bytes or hex); null = not recorded (FALLBACK_WALL_GAIN). */
  readonly white: WhitePoint | null;
  /** Photo wall over the drawn wall, linear light; null = not measured (1). */
  readonly stripOverDrawn: number | null;
}

/** Bounds of a chunk's wall gain (linear): beyond these the strip measurement is a bad reference, not a wall. */
export const CHUNK_WALL_GAIN_RANGE: readonly [number, number] = [0.4, 2.5];

/** Slots that are the photo-matched wall itself: brick and its accent courses, and rendered (stucco) walls. */
export const PHOTO_MATCHED_SLOTS: readonly string[] = ['brick', 'accent', 'stucco'];

/** Linear gain on a chunk's walls: to a sunlit white, and from the authored colour to its strip's. */
export function chunkWallGain(exposure: WallExposure | null | undefined): number {
  const g = (exposure?.white ? measuredWallGain(exposure.white) : FALLBACK_WALL_GAIN) * (exposure?.stripOverDrawn ?? 1);
  return Math.max(CHUNK_WALL_GAIN_RANGE[0], Math.min(CHUNK_WALL_GAIN_RANGE[1], g));
}

/** The exposure a chunk (chunks.json `name`) was matched under; a chunk without a strip has none recorded. */
export function chunkWallExposure(name: string): WallExposure {
  return CHUNK_WALL_EXPOSURE_DATA[name] ?? { white: null, stripOverDrawn: null };
}

/**
 * A photo-matched wall's tint under a look: `drawnHex` is the tint the look draws it with (after cityTint), scaled in
 * linear light by `chunkWallGain` in the sunny look. Other slots, a measured tint (it carries its own white,
 * sunny.ts `sceneSlotHex`), no exposure, and the legacy look keep `drawnHex`.
 */
export function photoMatchedWallTint(slot: string, drawnHex: string, exposure: WallExposure | null | undefined, source?: string | null, look: SceneLook = sceneLookFrom()): string {
  if (!exposure || look !== 'sunny' || source === 'measured' || !PHOTO_MATCHED_SLOTS.includes(slot)) return drawnHex;
  return scaleLinear(drawnHex, chunkWallGain(exposure));
}
