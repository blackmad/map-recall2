import { accentGlsl } from './look/maskPacking.js';
import { DEPTH_FADE_DETAIL_GLSL, DEPTH_FADE_DETAIL_PARS } from './look/depthFade.js';
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
 *
 * The rates are per CSS pixel and scale with the canvas pixel ratio: the shader measures texels per framebuffer
 * pixel, so at a fixed [16, 30] a Retina screen (ratio 2) flattened windows still ~4 device px wide. At map zoom 16
 * over Wibautstraat and Diemen the mid-distance blocks went to plain walls where the unflattened sample read as
 * clean windows (user, 2026-10-30, "on my mac these buildings should be able to render windows at this zoom").
 * At ratio 1 the tier is unchanged.
 */
export const FACADE_TIER_FROM_TEXELS = 16;
/**
 * The mip level the cell's mean colour is read at. GL clamps a textureLod level to the texture's last mip, so 12 reads
 * the 1x1 level of any cell up to 4096 px: level 8 of today's 256 px cells (the literal 8.0 this replaced, same
 * pixels), level 7 of the 128 px touch cells (8.0 clamped there too) and level 9 of the 512 px desktop-high cells
 * (look/texturePolicy.ts), where 8.0 would have read a 2x2 mip.
 */
export const CELL_MEAN_LOD = 12;
const CELL_MEAN_LOD_GLSL = '12.0';
export const FACADE_TIER_TO_TEXELS = 30;
export const FACADE_TIER_OFF: [number, number] = [-1, -1];
/**
 * `tierScale` (look/texturePolicy.ts, cellPx / 256): the rates are texels per pixel, so a 512 px cell doubles them and
 * the windows still flatten at the same size on screen. 1 (the default) is the tier as before.
 */
export const facadeTierUniform = (pixelRatio = 1, tierScale = 1): [number, number] => {
  const k = (Number.isFinite(pixelRatio) && pixelRatio > 1 ? pixelRatio : 1) * (Number.isFinite(tierScale) && tierScale > 0 ? tierScale : 1);
  return [FACADE_TIER_FROM_TEXELS * k, FACADE_TIER_TO_TEXELS * k];
};

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
  vec3 flatMean = textureLod(cells, vec3(uv, layer), ${CELL_MEAN_LOD_GLSL}).rgb;
  return mix(mix(fine, coarse, mid), flatMean, far);
}`;

/**
 * GLSL: `cellTierSample(p, dist, c, m)` replaces `texture(cells, p)` / `texture(masks, p)` for facade cells. Needs
 * both samplers above it. `dist` (eye metres) drives the depth fade's detail blend when the scene fades
 * (USE_FOG, look/depthFade.ts). Within the near tier it is
 * exactly the filtered `texture` call.
 */
export const FACADE_TIER_GLSL = /* glsl */ `${DEPTH_FADE_DETAIL_PARS}
uniform vec2 cellTier;
#ifdef CELL_TIER_PROBE
// What the last cellTierSample saw (look/windowSdf.ts reads them: the ?cellDebug=rho view, the analytic windows' fade).
float cellRho = 0.0; float cellFarTier = 0.0; float cellFar = 0.0;
#endif
#ifdef CELL_TIER_ANISO
// The anisotropy-aware footprint (lane R3-D #233, ?cellTierAniso=0 drops the define): cellAniso is the anisotropy the
// cells texture was given (look/texturePolicy.ts); <= 0 falls back to the major-axis rule in the same program (A/B).
// cellAnisoRule = (flatten on the effective footprint 1/0, fade where the filter undersamples 1/0, fade band from, to).
uniform float cellAniso;
uniform vec4 cellAnisoRule;
#ifdef CELL_TIER_PROBE
float cellRhoEff = 0.0; float cellUnder = 0.0; float cellFarFlat = 0.0; float cellFarUnder = 0.0;
#endif
#endif
#ifdef CELL_LOD_BIAS
// ?cellLodBias=<b> (lane R3-B #231, look/cellMips.ts): a mip bias on the facade cell sample, the cheap sharpness A/B.
uniform float cellLodBias;
#endif
void cellTierSample(vec3 p, float dist, out vec3 c, out vec2 m) {
#ifdef CELL_LOD_BIAS
  vec4 cc = texture(cells, p, cellLodBias); vec2 mm = texture(masks, p, cellLodBias).rg;
#else
  vec4 cc = texture(cells, p); vec2 mm = texture(masks, p).rg;
#endif
  c = cc.rgb; m = vec2(mm.r, ${accentGlsl('mm', 'cc')});
  float far = 0.0;
#ifdef CELL_TIER_PROBE
  cellRho = max(length(dFdx(p.xy)), length(dFdy(p.xy))) * float(textureSize(cells, 0).x);
#endif
  if (cellTier.x >= 0.0) {
#ifdef CELL_TIER_ANISO
    // The footprint the anisotropic filter samples at (EXT_texture_filter_anisotropic: N = min(ceil(major / minor),
    // aniso) probes at level log2(major / N)), i.e. max(minor, major / aniso): flatten on that, not on the major axis, so
    // a grazing wall keeps the windows the filter can still draw. Where major / (aniso x max(minor, 1)) passes 1 the
    // probes no longer cover the footprint along the wall (minification stops at level 0 across it) and the grid
    // beats against the pixels: fade toward the mean there instead.
    float texels = float(textureSize(cells, 0).x);
    float lx = length(dFdx(p.xy)) * texels, ly = length(dFdy(p.xy)) * texels;
    float major = max(lx, ly), minor = min(lx, ly);
    float rhoEff = cellAniso > 0.0 && cellAnisoRule.x > 0.5 ? max(minor, major / cellAniso) : major;
    float under = cellAniso > 0.0 ? major / (cellAniso * max(minor, 1.0)) : 0.0;
    float farFlat = smoothstep(cellTier.x, cellTier.y, rhoEff);
    float farUnder = cellAniso > 0.0 && cellAnisoRule.y > 0.5 ? smoothstep(cellAnisoRule.z, cellAnisoRule.w, under) : 0.0;
    far = max(farFlat, farUnder);
#ifdef CELL_TIER_PROBE
    cellRhoEff = rhoEff; cellUnder = under; cellFarFlat = farFlat; cellFarUnder = farUnder;
#endif
#else
    float rho = max(length(dFdx(p.xy)), length(dFdy(p.xy))) * float(textureSize(cells, 0).x);
    far = smoothstep(cellTier.x, cellTier.y, rho);
#endif
  }
#ifdef CELL_TIER_PROBE
  cellFarTier = far;
#endif
#ifdef USE_FOG
  far = max(far, ${DEPTH_FADE_DETAIL_GLSL('dist')});
#endif
#ifdef CELL_TIER_PROBE
  cellFar = far;
#endif
  if (far <= 0.0) return;
  vec4 fc = textureLod(cells, p, ${CELL_MEAN_LOD_GLSL}); vec2 fm = textureLod(masks, p, ${CELL_MEAN_LOD_GLSL}).rg;
  c = mix(c, fc.rgb, far); m = mix(m, vec2(fm.r, ${accentGlsl('fm', 'fc')}), far);
}`;

/**
 * The anisotropy-aware facade tier (lane R3-D #233). At the user's S3 pose (`s3-slab-user`, the 1962 slab on
 * Weesperstraat, #230) 92 % of the moving pixels were the window texture on the slab's long street wall, seen almost
 * edge-on, and at DPR 1 the same wall drew blank. Both came from flattening on the major axis of the pixel footprint:
 * with anisotropic filtering the hardware samples a footprint of about `max(minor, major / aniso)`, so the wall
 * flattened where the filter could still draw it (blank), and just under the threshold the grid was drawn where
 * `major / minor` exceeds the anisotropy cap and the probes undersample along the wall (moiré). The rule:
 *   flatten   `smoothstep(cellTier.x, cellTier.y, rhoEff)`, `rhoEff = max(minor, major / aniso)`;
 *   fade      `smoothstep(band[0], band[1], under)`, `under = major / (aniso x max(minor, 1))` (texels; across the wall
 *             minification stops at level 0, hence the 1);
 *   far       the larger of the two, mixed toward the cell's mean colour as before (the analytic windows read it).
 * `aniso` is the anisotropy the cells texture was given (16 desktop, 4 coarse or low GPUs), not a constant.
 * `?cellTierAniso=0` drops the define: the major-axis rule, byte for byte.
 */
export const FACADE_TIER_UNDER_BAND: readonly [number, number] = [1, 2];

/** `[aniso, rule]` uniform values: `cellAniso` and `cellAnisoRule` (flatten on rhoEff, fade on under, band from, to). */
export function facadeTierAnisoUniform(anisotropy: number, band: readonly [number, number] = FACADE_TIER_UNDER_BAND): { cellAniso: number; cellAnisoRule: [number, number, number, number] } {
  return { cellAniso: Number.isFinite(anisotropy) && anisotropy >= 1 ? anisotropy : 1, cellAnisoRule: [1, 1, band[0], band[1]] };
}

/** `?cellTierAniso=0` (or `window.__canalRecallCellTierAniso = false`): the major-axis tier. On by default. */
export function facadeTierAnisoEnabled(): boolean {
  const g = globalThis as Record<string, unknown>;
  let asked = g.__canalRecallCellTierAniso;
  if (asked == null) {
    try { asked = typeof URLSearchParams === 'function' ? new URLSearchParams((g.location as { search?: string } | undefined)?.search ?? '').get('cellTierAniso') : null; } catch { asked = null; }
  }
  return !(asked === false || asked === '0' || asked === 'false' || asked === 'off');
}

const smoothstep = (a: number, b: number, x: number) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

/**
 * The facade tier on the CPU (the shader's twin): `major`/`minor` are the footprint's axis lengths in texels per pixel
 * (|dFdx|, |dFdy| x cell size), `tier` the `cellTier` uniform. `aniso` null is the major-axis rule.
 */
export function facadeTierWeights(major: number, minor: number, tier: readonly [number, number], aniso: number | null, band: readonly [number, number] = FACADE_TIER_UNDER_BAND): { rhoEff: number; under: number; flat: number; fade: number; far: number } {
  const hi = Math.max(major, minor), lo = Math.min(major, minor);
  if (aniso == null || !(aniso > 0)) { const flat = tier[0] >= 0 ? smoothstep(tier[0], tier[1], hi) : 0; return { rhoEff: hi, under: 0, flat, fade: 0, far: flat }; }
  const rhoEff = Math.max(lo, hi / aniso), under = hi / (aniso * Math.max(lo, 1));
  const flat = tier[0] >= 0 ? smoothstep(tier[0], tier[1], rhoEff) : 0, fade = tier[0] >= 0 ? smoothstep(band[0], band[1], under) : 0;
  return { rhoEff, under, flat, fade, far: Math.max(flat, fade) };
}

/** The roof blend on the CPU, for tests and the gallery's tier readout: weights of the fine, mid and far samples. */
export function roofTierWeights(distM: number): { fine: number; mid: number; far: number } {
  const smooth = (a: number, b: number, x: number) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const mid = smooth(ROOF_TIER_MID_M - ROOF_TIER_MID_FADE_M, ROOF_TIER_MID_M + ROOF_TIER_MID_FADE_M, distM);
  const far = smooth(ROOF_TIER_FAR_M - ROOF_TIER_FAR_FADE_M, ROOF_TIER_FAR_M + ROOF_TIER_FAR_FADE_M, distM);
  return { fine: (1 - mid) * (1 - far), mid: mid * (1 - far), far };
}
