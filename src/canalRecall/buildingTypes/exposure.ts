/**
 * White-reference exposure for facade colours read from a shaded or overcast street photo (issue #75).
 *
 * Most terraces face away from the sun when the panorama car passes (Dichtersbuurt fronts face 14 or 284 degrees, every
 * panorama is a morning one), so the wall in the crop is lit by the sky only: dark and blue-shifted. The white paint of the
 * same facade (window frames, door surrounds) is in the same light, so dividing the wall sample by that white, channel by
 * channel, and multiplying by the sunlit white of the paint gives the wall under sunlight: the exposure and the sky cast
 * cancel. The white is read from the frames of the same crop, the target is the painted-frame white the specs use.
 */
import {hexToRgb, rgbToHex, type RGB} from '../look/palette.ts';

/** Sunlit painted-frame white (the specs' `frame` for white joinery). */
export const SUNLIT_FRAME_WHITE = '#f0eee6';

/** `sample` as it would read if `white` (the same photo's white paint) read `target`. Channels clamp at 255. */
export function whiteReferenced(sample: string, white: string, target: string = SUNLIT_FRAME_WHITE): string {
  const s = hexToRgb(sample), w = hexToRgb(white), t = hexToRgb(target);
  return rgbToHex([0, 1, 2].map(c => Math.min(255, Math.round(s[c] * t[c] / Math.max(1, w[c])))) as unknown as RGB);
}
