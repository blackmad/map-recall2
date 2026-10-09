// One sun shadow map that follows the view.
//
// The shadow camera is an orthographic box looking along the sun. It is
// centred on the ground point the player is looking at and sized to the part
// of the city that reads at the current zoom. Two things keep it from
// shimmering while riding:
//
// 1. the centre is snapped to whole shadow-map texels *in light space*, in a
//    fixed absolute frame (not the eye-relative world, which moves every
//    frame), so a static wall always rasterises into the same texels;
// 2. the box size only changes in coarse steps (powers of two of the zoom),
//    so the texel size is not re-derived every frame of a zoom ease.

import type { Vec3 } from './frameMath.js';

export type ShadowFitInput = {
  /** Focus point in an absolute ENU frame (metres, z up). */
  focusAbs: Vec3;
  /** Unit vector from the scene toward the sun (ENU). */
  toSun: Vec3;
  /** Half-width of the square box, metres. */
  halfSizeM: number;
  /** Shadow map edge, texels. */
  mapSize: number;
  /** Tallest caster we must catch above the focus (Westerkerk ~87 m). */
  maxCasterHeightM?: number;
  /**
   * Move the box only in steps of about this many metres (rounded to whole
   * texels). The box is far larger than the view near the rider, so a coarse
   * step costs nothing visible and lets the shadow map be reused for many
   * frames while riding (see SharedFrame).
   */
  snapStepM?: number;
};

export type ShadowFit = {
  /** Snapped focus (light target) in the absolute ENU frame. */
  targetAbs: Vec3;
  /** Light position in the absolute ENU frame. */
  lightAbs: Vec3;
  left: number; right: number; top: number; bottom: number; near: number; far: number;
  texelM: number;
};

const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a: Vec3): Vec3 => { const l = Math.hypot(...a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };

/** Light-space basis matching three's lookAt for a directional light with up = +z. */
export function lightBasis(toSun: Vec3): { right: Vec3; up: Vec3; forward: Vec3 } {
  const forward = norm(toSun); // camera looks along -forward
  const worldUp: Vec3 = Math.abs(forward[2]) > 0.999 ? [0, 1, 0] : [0, 0, 1];
  const right = norm(cross(worldUp, forward));
  const up = cross(forward, right);
  return { right, up, forward };
}

/** Sun box size for a map zoom: ~160 m half-width at z18, doubling per zoom out, stepped. */
export function shadowHalfSizeForZoom(zoom: number, base = 160, min = 100, max = 640): number {
  const steps = Math.ceil(18 - zoom);
  return Math.max(min, Math.min(max, base * 2 ** steps));
}

export function fitShadowCamera(input: ShadowFitInput): ShadowFit {
  const { focusAbs, halfSizeM, mapSize } = input;
  const maxHeight = input.maxCasterHeightM ?? 120;
  const { right, up, forward } = lightBasis(input.toSun);
  const texelM = (2 * halfSizeM) / mapSize;
  const step = Math.max(1, Math.round((input.snapStepM ?? 0) / texelM)) * texelM;
  // Snap the focus in light space (right/up set the texel grid).
  const r = Math.round(dot(focusAbs, right) / step) * step;
  const u = Math.round(dot(focusAbs, up) / step) * step;
  // Depth along the sun is snapped too: a cached map is only valid for the exact light position it was drawn from.
  const f = Math.round(dot(focusAbs, forward) / step) * step;
  const targetAbs: Vec3 = [
    right[0] * r + up[0] * u + forward[0] * f,
    right[1] * r + up[1] * u + forward[1] * f,
    right[2] * r + up[2] * u + forward[2] * f,
  ];
  // Back far enough along the sun ray that the tallest caster inside the box is in front of near.
  const elevation = Math.max(0.05, forward[2]);
  const distance = maxHeight / elevation + halfSizeM;
  const lightAbs: Vec3 = [targetAbs[0] + forward[0] * distance, targetAbs[1] + forward[1] * distance, targetAbs[2] + forward[2] * distance];
  return {
    targetAbs, lightAbs,
    left: -halfSizeM, right: halfSizeM, top: halfSizeM, bottom: -halfSizeM,
    near: 1, far: distance + halfSizeM / elevation + 50,
    texelM,
  };
}
