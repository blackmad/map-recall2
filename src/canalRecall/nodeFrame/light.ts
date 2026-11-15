/**
 * The shared frame's light (rendererShared/lightRig.ts, the sunny rig by default) as numbers for the node frame's
 * shaders: three's Lambert under one HemisphereLight (z up) and one DirectionalLight with a shadow map whose
 * `shadow.intensity` leaves SHADOW_FILL of the sun in cast shadow.
 *
 *   out = linearToSRGB(albedo / PI * (sun * max(n.l, 0) * mix(1, lit, shadowIntensity) + mix(ground, sky, 0.5 n.z + 0.5)) + emissive)
 */
import { activeLightRig, sunDirection } from '../rendererShared/lightRig.ts';

export type SceneLight = {
  toSun: [number, number, number];
  /** Linear colour x intensity. */
  sun: [number, number, number]; sky: [number, number, number]; ground: [number, number, number];
  shadowIntensity: number;
};

export const srgbToLinear = (x: number) => (x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4));
/** srgbToLinear by table on [0, 1] (4096 steps, linear between): for texture samples, per pixel. */
const LIN_LUT = (() => { const t = new Float32Array(4098); for (let i = 0; i <= 4097; i++) t[i] = srgbToLinear(Math.min(1, i / 4096)); return t; })();
export const srgbToLinearFast = (x: number) => { if (x <= 0) return 0; if (x >= 1) return 1; const f = x * 4096, i = f | 0; return LIN_LUT[i] + (LIN_LUT[i + 1] - LIN_LUT[i]) * (f - i); };
/** x^2.2 by table on [0, 2] (the chunk material's albedo decode; the wall gain can lift a cell over 1). */
const POW_LUT = (() => { const t = new Float32Array(8194); for (let i = 0; i <= 8193; i++) t[i] = Math.pow(i / 4096, 2.2); return t; })();
export const pow22 = (x: number) => { if (x <= 0) return 0; if (x >= 2) return Math.pow(x, 2.2); const f = x * 4096, i = f | 0; return POW_LUT[i] + (POW_LUT[i + 1] - POW_LUT[i]) * (f - i); };
export const linearToSrgbExact = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : x < 0.0031308 ? 12.92 * x : 1.055 * Math.pow(x, 1 / 2.4) - 0.055);
/** The encode by table (65536 steps of the linear value, the output is 8-bit): ~10x the pow, under 1/1000 off. */
const SRGB_LUT = (() => { const t = new Float32Array(65537); for (let i = 0; i <= 65536; i++) t[i] = linearToSrgbExact(i / 65536); return t; })();
export const linearToSrgb = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : SRGB_LUT[(x * 65536 + 0.5) | 0]);
export const hexLinear = (hex: string | number, k = 1): [number, number, number] => {
  const n = typeof hex === 'number' ? hex : parseInt(hex.replace('#', ''), 16);
  return [srgbToLinear(((n >> 16) & 255) / 255) * k, srgbToLinear(((n >> 8) & 255) / 255) * k, srgbToLinear((n & 255) / 255) * k];
};

export function sceneLight(search = ''): SceneLight {
  const rig = activeLightRig(search);
  const d = sunDirection(rig.sunAzimuthDeg, rig.sunElevationDeg);
  return {
    toSun: [d[0], d[1], d[2]], sun: hexLinear(rig.sunColour, rig.sunIntensity), sky: hexLinear(rig.skyColour, rig.skyIntensity),
    ground: hexLinear(rig.groundColour, rig.skyIntensity), shadowIntensity: rig.shadows ? rig.shadowIntensity : 0,
  };
}

/** Lambert irradiance / PI for unit normal n with the sun visibility `lit` (1 lit, 0 in cast shadow), into out. */
/** n.l toward the sun (0 when the surface faces away: the shadow map need not be read). */
export const sunFacing = (L: SceneLight, nx: number, ny: number, nz: number) => nx * L.toSun[0] + ny * L.toSun[1] + nz * L.toSun[2];

export function lambert(L: SceneLight, nx: number, ny: number, nz: number, lit: number, out: Float64Array): void {
  const ndl = Math.max(0, nx * L.toSun[0] + ny * L.toSun[1] + nz * L.toSun[2]);
  const k = ndl * (1 - L.shadowIntensity * (1 - lit)), h = 0.5 * nz + 0.5;
  for (let c = 0; c < 3; c++) out[c] = (L.sun[c] * k + L.ground[c] + (L.sky[c] - L.ground[c]) * h) / Math.PI;
}
