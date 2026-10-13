/**
 * Roof texture scale by distance: the pantile and slate cells are 1.2 m wide with
 * 5-6 courses of 0.2 m tiles, which reads as noise from a chase camera. The
 * facade shaders take the roof cell through `roofTierColour`:
 *
 *   near  (< `ROOF_TIER_MID_M`)   the cell as painted, 1x
 *   mid   (to `ROOF_TIER_FAR_M`)  the same cell at half the frequency (0.5x), crossfaded
 *   far   (beyond)                the cell's mean colour (its last mip), crossfaded
 *
 * Crossfading samples rather than warping the UVs, so a long roof never swims.
 * The cells' own contrast is held to `ROOF_CELL_SD_MAX` (roofCells.ts, LOOK.md
 * "Roofs"). The distance is view distance in metres from the camera.
 */

export const ROOF_TIER_MID_M = 70;
export const ROOF_TIER_FAR_M = 190;
/** Cell frequency in the mid tier (0.5 = tiles twice as large). */
export const ROOF_TIER_MID_SCALE = 0.5;
/** Half-width of the crossfade into the mid and far tiers, metres. */
export const ROOF_TIER_MID_FADE_M = 15;
export const ROOF_TIER_FAR_FADE_M = 40;

/** Uniform defaults: `[lo, hi)` is the layer range of the pantile and slate cells; lo < 0 turns the tiers off. */
export const ROOF_LAYERS_OFF: [number, number] = [-1, -1];
export const roofTierUniform = (): [number, number, number] => [ROOF_TIER_MID_M, ROOF_TIER_FAR_M, ROOF_TIER_MID_SCALE];

const glsl = (v: number) => (Number.isInteger(v) ? v.toFixed(1) : String(v));

/**
 * GLSL for the shaders: needs a `sampler2DArray cells` declared above it. `roofLayers` and `roofTier` are
 * uniforms (vec2, vec3); the function leaves every other layer alone.
 */
export const ROOF_TIER_GLSL = /* glsl */ `
uniform vec2 roofLayers;
uniform vec3 roofTier;
vec3 roofTierColour(vec3 fine, vec2 uv, float layer, float dist) {
  if (roofLayers.x < 0.0 || layer < roofLayers.x - 0.5 || layer > roofLayers.y - 0.5) return fine;
  float mid = smoothstep(roofTier.x - ${glsl(ROOF_TIER_MID_FADE_M)}, roofTier.x + ${glsl(ROOF_TIER_MID_FADE_M)}, dist);
  if (mid <= 0.0) return fine;
  float far = smoothstep(roofTier.y - ${glsl(ROOF_TIER_FAR_FADE_M)}, roofTier.y + ${glsl(ROOF_TIER_FAR_FADE_M)}, dist);
  vec3 coarse = texture(cells, vec3(uv * roofTier.z, layer)).rgb;
  vec3 flatMean = textureLod(cells, vec3(uv, layer), 8.0).rgb;
  return mix(mix(fine, coarse, mid), flatMean, far);
}`;

/** The same blend on the CPU, for tests and the gallery's tier readout: weights of the fine, mid and far samples. */
export function roofTierWeights(distM: number): { fine: number; mid: number; far: number } {
  const smooth = (a: number, b: number, x: number) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const mid = smooth(ROOF_TIER_MID_M - ROOF_TIER_MID_FADE_M, ROOF_TIER_MID_M + ROOF_TIER_MID_FADE_M, distM);
  const far = smooth(ROOF_TIER_FAR_M - ROOF_TIER_FAR_FADE_M, ROOF_TIER_FAR_M + ROOF_TIER_FAR_FADE_M, distM);
  return { fine: (1 - mid) * (1 - far), mid: mid * (1 - far), far };
}
