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

/**
 * Facade cells (the bay and procedural window grids) get a far tier by screen footprint, not metres: the camera
 * sits 100-300 m from the street in the chase view, so a distance rule flattens near windows ("get rid of the
 * stipple on zoom out", user 2026-10-13, Singelgracht at ~300 m). The cell arrays already carry mipmaps, trilinear
 * and anisotropic filtering; what still sparkles is a window of under ~2 px. `cellTier` is `[from, to]` in texels per
 * pixel: below `from` the cell is exactly the filtered sample, above `to` it is the cell's mean colour (last mip),
 * crossfaded between.
 *
 * The rate is the larger of the two axes, and on a wall seen from the chase camera (pitch 48°, eye ~127 m up and
 * ~190 m out) that is the foreshortened vertical. A cell is one bay (3.6-5 m, 256 texels: ~51-71 texels a metre)
 * by one storey (~3 m: ~85 texels a metre), so a window is ~55 texels wide and ~150 tall. At [4, 10] the quay
 * houses 30-60 m from the boat (vertical rate ~18 texels/px, windows still ~7 x 8 px) went to their mean colour:
 * "why such low detail from so close?" (user, Singelgracht, 2026-10-14). At [16, 30] they keep their windows up to
 * ~220 m from the eye and are flat again by ~300 m (windows ~4 x 5 px, where the dots read as stipple; the
 * 0.16-zoom aerial at ~770 m is flat as before). docs/images/live-play-20261014/item3-*.
 */
export const FACADE_TIER_FROM_TEXELS = 16;
export const FACADE_TIER_TO_TEXELS = 30;
export const FACADE_TIER_OFF: [number, number] = [-1, -1];
export const facadeTierUniform = (): [number, number] => [FACADE_TIER_FROM_TEXELS, FACADE_TIER_TO_TEXELS];

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

/**
 * GLSL: `cellTierSample(p, dist, c, m)` replaces `texture(cells, p)` / `texture(masks, p)` for facade cells. Needs
 * both samplers above it. `dist` is unused (kept so call sites read like the roof tier). Within the near tier it is
 * exactly the filtered `texture` call.
 */
export const FACADE_TIER_GLSL = /* glsl */ `
uniform vec2 cellTier;
void cellTierSample(vec3 p, float dist, out vec3 c, out vec2 m) {
  c = texture(cells, p).rgb; m = texture(masks, p).rg;
  if (cellTier.x < 0.0) return;
  float rho = max(length(dFdx(p.xy)), length(dFdy(p.xy))) * float(textureSize(cells, 0).x);
  float far = smoothstep(cellTier.x, cellTier.y, rho);
  if (far <= 0.0) return;
  c = mix(c, textureLod(cells, p, 8.0).rgb, far); m = mix(m, textureLod(masks, p, 8.0).rg, far);
}`;

/** The roof blend on the CPU, for tests and the gallery's tier readout: weights of the fine, mid and far samples. */
export function roofTierWeights(distM: number): { fine: number; mid: number; far: number } {
  const smooth = (a: number, b: number, x: number) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const mid = smooth(ROOF_TIER_MID_M - ROOF_TIER_MID_FADE_M, ROOF_TIER_MID_M + ROOF_TIER_MID_FADE_M, distM);
  const far = smooth(ROOF_TIER_FAR_M - ROOF_TIER_FAR_FADE_M, ROOF_TIER_FAR_M + ROOF_TIER_FAR_FADE_M, distM);
  return { fine: (1 - mid) * (1 - far), mid: mid * (1 - far), far };
}
