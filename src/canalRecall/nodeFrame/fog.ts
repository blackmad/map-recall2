/**
 * The shared frame's fog in the node frame (lane node-world-frames): three's Fog over the depth fade and draw limit
 * (look/depthFade.ts, engine/drawLimit.ts; sharedFrame.ts rangeFog), as the fog chunk mixes it, into the encoded sRGB
 * colour with the fog colour's linear values (three hands `fogColor` its working-space colour after the output
 * conversion, so the haze is the horizon's linear triple read as sRGB):
 *
 *   f    = smoothstep(near, near x ratio, dist)                  (the gentle fade; landmarks skip it, landmarkHaze)
 *   rgb  = mix(rgb, luma(rgb), f x DESATURATE); rgb = mix(rgb, fog, f x HAZE)
 *   rgb  = mix(rgb, fog, smoothstep(limit x RAMP_FROM, limit, dist))   (the draw limit)
 */
import { depthFadeRange, DEPTH_FADE_DESATURATE, DEPTH_FADE_HAZE } from '../look/depthFade.ts';
import { DRAW_LIMIT_RAMP_FROM, drawLimitFogRange, drawLimitM } from '../engine/drawLimit.ts';
import { SKY } from '../look/sunny.ts';
import { hexLinear } from './light.ts';
import type { FogFn } from './chunkMaterial.ts';

export type FogSetup = { full: FogFn; limitOnly: FogFn; near: number; gentleFar: number; limit: number; sky: [number, number, number] };

const smooth = (a: number, b: number, x: number) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

/** `frame.distance`: the eye-to-centre metres the shared frame ranges the fade by. */
export function fogFor(view: { frame: { distance: number }; aerial?: boolean }): FogSetup {
  const d = view.frame.distance, aerial = !!view.aerial;
  const gentle = depthFadeRange(d);
  const limit = drawLimitM(aerial, d);
  const r = drawLimitFogRange(gentle, limit, aerial);
  const ratio = 1 + (r.far - Math.floor(r.far)) * 8;
  const near = r.near, gentleFar = near * ratio, lim = Math.floor(r.far);
  const fog = hexLinear(SKY.horizon);
  const sky = hexLinear(SKY.zenith).map(() => 0) as [number, number, number];
  const z = parseInt(SKY.zenith.slice(1), 16);
  sky[0] = ((z >> 16) & 255) / 255; sky[1] = ((z >> 8) & 255) / 255; sky[2] = (z & 255) / 255;
  const ramp = (dist: number, rgb: Float64Array) => { const k = smooth(lim * DRAW_LIMIT_RAMP_FROM, lim, dist); if (k > 0) for (let c = 0; c < 3; c++) rgb[c] += (fog[c] - rgb[c]) * k; };
  const full: FogFn = (dist, rgb) => {
    const f = smooth(near, gentleFar, dist);
    if (f > 0) {
      const l = 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
      for (let c = 0; c < 3; c++) { rgb[c] += (l - rgb[c]) * f * DEPTH_FADE_DESATURATE; rgb[c] += (fog[c] - rgb[c]) * f * DEPTH_FADE_HAZE; }
    }
    ramp(dist, rgb);
  };
  return { full, limitOnly: ramp, near, gentleFar, limit: lim, sky };
}
