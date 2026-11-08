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
 * The footprint prefilter of the facade cell sample (lane R4-D #246, `?cellTaps=1`; desktop on, touch off since 2026-11-08: CELL_TAPS_DESKTOP_DEFAULT / CELL_TAPS_TOUCH_DEFAULT).
 *
 * At the user's S3 pose (`s3-slab-user`) the slab's long street wall is plain minification at 16-32 texels per device
 * pixel (R3-D #233): the sampler reads mip 4-5 of the 256 px cell, where the window pitch is near the texel pitch, and
 * GL's box chain keeps ~71 % of that contrast per level (R3-E #240). One trilinear tap of a near-Nyquist grid is the
 * moire. Where rho (texels per framebuffer pixel, the tier's own measure) passes `threshold`, the sample becomes `taps`
 * samples spread over the pixel footprint (dFdx / dFdy of the cell uv), each read with its gradient scaled by `grad`
 * (0.5: one level finer than the pixel), and averaged with tent weights before the tier mix. That is a supersample of
 * the pixel in the shader: the same filter the 2x supersampled alias reference applies. Below the threshold one tap,
 * exactly as before; the weight ramps over [threshold, 1.25 x threshold] so no seam is drawn where it starts.
 *
 * `cellTaps` uniform: (threshold texels/px, taps 2 | 4 | 9, spread px between taps, grad scale). `cellTapsSdf` widens the
 * analytic windows' edge filter by that factor where the taps are on, so the glazing bars are filtered with the wall
 * (look/windowSdf.ts reads `cellTapW`).
 */
/**
 * Desktop default ON (2026-11-08, the user's call on #247 after R4-D: "trust your rec", option 1, no wider band): the
 * slab on Weesperstraat stops shimmering at the user's S3 pose. Touch stays off (R4-D: no threshold serves both the
 * slab and S2 on the iPhone). `?cellTaps=0|1` overrides either.
 */
export const CELL_TAPS_DESKTOP_DEFAULT = true;
export const CELL_TAPS_TOUCH_DEFAULT = false;
/** The default for this device: a coarse pointer (touch) takes CELL_TAPS_TOUCH_DEFAULT, else CELL_TAPS_DESKTOP_DEFAULT. */
export function cellTapsDefault(w: any = globalThis): boolean {
  let touch = false;
  try { touch = !!w?.matchMedia?.('(pointer: coarse)')?.matches; } catch { /* no matchMedia */ }
  return touch ? CELL_TAPS_TOUCH_DEFAULT : CELL_TAPS_DESKTOP_DEFAULT;
}
/** @deprecated the device-split defaults above; kept for the R4-D test's name. */
export const CELL_TAPS_DEFAULT = CELL_TAPS_DESKTOP_DEFAULT;
/**
 * Default knobs, the measured best (#246 hand-back, desktop DPR 2): threshold 20 texels per framebuffer pixel (scaled by
 * the policy's tierScale, like the tier), 3 x 3 tent taps 1 px apart, each read at 0.85 x the pixel's gradient. At
 * `s3-slab-user` aliasPx sdf 29,997 -> 21,322 (gate 22,822), painted 49,918 -> 24,462 (gate 23,500, missed); S2 lapVar
 * -1.5 / -2.9 / -2.4 % (sdf), GPU +0.10 ms at the pose. Threshold 16 or lower reaches the quay walls of S2 (chase -4 %,
 * threshold 8: -19 %); 2 x 2 taps at half gradient made the slab worse (they read a sharper level each).
 * Touch (iPhone profile, painted, 128 px cells, tierScale 1): no threshold meets both ends; s3-slab-user aliasPx 14,937 ->
 * 13,512 / 8,187 / 3,825 at 20 / 16 / 14, da-costakade-chase lapVar -4 / -16 / -20 %. Leave touch off.
 */
export const CELL_TAPS = { threshold: 20, taps: 9, spread: 1, grad: 0.85, sdf: 1 } as const;
export type CellTapsOptions = { threshold: number; taps: number; spread: number; grad: number; sdf: number };

const CELL_TAPS_GLSL = /* glsl */ `
uniform vec4 cellTaps;
uniform float cellTapsSdf;
float cellTapW = 0.0;
float cellTapsWeight(float rho) { return cellTaps.y > 1.5 && cellTaps.x >= 0.0 ? smoothstep(cellTaps.x, max(1.25 * cellTaps.x, cellTaps.x + 1e-3), rho) : 0.0; }
void cellTapsSample(vec3 p, vec2 dx, vec2 dy, out vec4 cc, out vec2 mm) {
  cc = vec4(0.0); mm = vec2(0.0);
  float s = cellTaps.z;
  if (cellTaps.y > 6.5) {
    // 3 x 3 at -s, 0, s on both screen axes, tent weights 1/4 1/2 1/4.
    vec2 gx = dx * cellTaps.w, gy = dy * cellTaps.w;
    for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
      float w = (i == 0 ? 0.5 : 0.25) * (j == 0 ? 0.5 : 0.25);
      vec3 q = vec3(p.xy + (float(i) * s) * dx + (float(j) * s) * dy, p.z);
      cc += w * textureGrad(cells, q, gx, gy); mm += w * textureGrad(masks, q, gx, gy).rg;
    }
  } else if (cellTaps.y > 3.5) {
    // 2 x 2 at +-s/2 on both screen axes, equal weights (the tent of a two-tap row).
    vec2 gx = dx * cellTaps.w, gy = dy * cellTaps.w;
    for (int j = 0; j < 2; j++) for (int i = 0; i < 2; i++) {
      vec3 q = vec3(p.xy + ((float(i) - 0.5) * s) * dx + ((float(j) - 0.5) * s) * dy, p.z);
      cc += 0.25 * textureGrad(cells, q, gx, gy); mm += 0.25 * textureGrad(masks, q, gx, gy).rg;
    }
  } else {
    // 2 taps at +-s/2 along the longer screen derivative; only that axis's gradient is scaled.
    bool alongX = dot(dx, dx) >= dot(dy, dy);
    vec2 ax = alongX ? dx : dy;
    vec2 gx = alongX ? dx * cellTaps.w : dx, gy = alongX ? dy : dy * cellTaps.w;
    for (int i = 0; i < 2; i++) {
      vec3 q = vec3(p.xy + ((float(i) - 0.5) * s) * ax, p.z);
      cc += 0.5 * textureGrad(cells, q, gx, gy); mm += 0.5 * textureGrad(masks, q, gx, gy).rg;
    }
  }
}`;

/** The tap weight on the CPU (the shader's `cellTapsWeight`): 0 at or below the threshold, 1 from 1.25 x threshold. */
export function cellTapsWeight(rho: number, threshold: number, taps = 4): number {
  if (!(taps > 1.5) || !(threshold >= 0)) return 0;
  return smoothstep(threshold, Math.max(1.25 * threshold, threshold + 1e-3), rho);
}

/** The tap pattern on the CPU (the shader's `cellTapsSample`): offsets in screen pixels (x along dFdx, y along dFdy) and weights. */
export function cellTapPattern(taps: number, spread: number): { x: number; y: number; w: number }[] {
  if (taps > 6.5) {
    const out: { x: number; y: number; w: number }[] = [];
    for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) out.push({ x: i * spread, y: j * spread, w: (i === 0 ? 0.5 : 0.25) * (j === 0 ? 0.5 : 0.25) });
    return out;
  }
  if (taps > 3.5) return [[0, 0], [1, 0], [0, 1], [1, 1]].map(([i, j]) => ({ x: (i - 0.5) * spread, y: (j - 0.5) * spread, w: 0.25 }));
  return [0, 1].map(i => ({ x: (i - 0.5) * spread, y: 0, w: 0.5 }));
}

const tapsParam = (name: string): string | null => {
  try { return typeof URLSearchParams === 'function' ? new URLSearchParams(((globalThis as Record<string, unknown>).location as { search?: string } | undefined)?.search ?? '').get(name) : null; } catch { return null; }
};

/** `?cellTaps=1` / `=0` (or `window.__canalRecallCellTaps`); unasked, the device default (cellTapsDefault). Off: no define, no uniform. */
export function cellTapsEnabled(): boolean {
  const asked = (globalThis as Record<string, unknown>).__canalRecallCellTaps ?? tapsParam('cellTaps');
  if (asked === false || asked === '0' || asked === 'false' || asked === 'off') return false;
  if (asked === true || asked === '1' || asked === 'true' || asked === 'on') return true;
  return cellTapsDefault();
}

/** The knobs for this page: `?cellTapsAt=` (threshold), `?cellTapsN=` (2, 4, 9), `?cellTapsSpread=`, `?cellTapsGrad=`, `?cellTapsSdf=`. */
export function cellTapsOptions(): CellTapsOptions {
  const num = (name: string, fallback: number, ok: (v: number) => boolean) => { const raw = tapsParam(name); const v = raw == null ? NaN : Number(raw); return Number.isFinite(v) && ok(v) ? v : fallback; };
  return {
    threshold: num('cellTapsAt', CELL_TAPS.threshold, v => v >= 0),
    taps: num('cellTapsN', CELL_TAPS.taps, v => v === 2 || v === 4 || v === 9),
    spread: num('cellTapsSpread', CELL_TAPS.spread, v => v >= 0),
    grad: num('cellTapsGrad', CELL_TAPS.grad, v => v > 0),
    sdf: num('cellTapsSdf', CELL_TAPS.sdf, v => v >= 1),
  };
}

/** Uniform values: `cellTaps` = (threshold x tierScale, taps, spread, grad), `cellTapsSdf`. */
export function cellTapsUniform(options: CellTapsOptions = CELL_TAPS, tierScale = 1): { cellTaps: [number, number, number, number]; cellTapsSdf: number } {
  const k = Number.isFinite(tierScale) && tierScale > 0 ? tierScale : 1;
  return { cellTaps: [options.threshold * k, options.taps, options.spread, options.grad], cellTapsSdf: options.sdf };
}

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
// The anisotropy-aware footprint (lane R3-D #233, off by default, ?cellTierAniso=1 adds the define): cellAniso is the anisotropy the
// cells texture was given (look/texturePolicy.ts); <= 0 falls back to the major-axis rule in the same program (A/B).
// cellAnisoRule = (flatten on the effective footprint 1/0, fade where the filter undersamples: 0 off, 1 on the |dFdx|/|dFdy|
// axes, 2 on the footprint ellipse's axes; fade band from, to).
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
#ifdef CELL_TAPS
${CELL_TAPS_GLSL}
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
    vec2 ja = dFdx(p.xy) * texels, jb = dFdy(p.xy) * texels;
    float lx = length(ja), ly = length(jb);
    float major = max(lx, ly), minor = min(lx, ly);
    float rhoEff = cellAniso > 0.0 && cellAnisoRule.x > 0.5 ? max(minor, major / cellAniso) : major;
    float under = 0.0;
    if (cellAniso > 0.0) {
      if (cellAnisoRule.y > 1.5) {
        // The footprint ellipse's own axes (the singular values of the uv Jacobian): on a wall receding diagonally
        // across the screen both derivatives are long and min(|dFdx|, |dFdy|) hides how thin the footprint is.
        float tr = dot(ja, ja) + dot(jb, jb), det = abs(ja.x * jb.y - ja.y * jb.x);
        float s1 = sqrt(0.5 * (tr + sqrt(max(tr * tr - 4.0 * det * det, 0.0))));
        under = s1 / (cellAniso * max(det / max(s1, 1e-6), 1.0));
      } else under = major / (cellAniso * max(minor, 1.0));
    }
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
#ifdef CELL_TAPS
  // The footprint prefilter (lane R4-D #246): above the threshold the one sample becomes several over the pixel (skipped
  // where the tier or the depth fade has made the texel wholly the mean colour).
  if (far < 1.0) {
    vec2 tdx = dFdx(p.xy), tdy = dFdy(p.xy);
    cellTapW = cellTapsWeight(max(length(tdx), length(tdy)) * float(textureSize(cells, 0).x));
    if (cellTapW > 0.0) {
      vec4 tc; vec2 tm; cellTapsSample(p, tdx, tdy, tc, tm);
      c = mix(c, tc.rgb, cellTapW); m = mix(m, vec2(tm.r, ${accentGlsl('tm', 'tc')}), cellTapW);
    }
  }
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
 * Off by default (FACADE_TIER_ANISO_DEFAULT, measured); `?cellTierAniso=1` adds the define.
 */
export const FACADE_TIER_UNDER_BAND: readonly [number, number] = [1, 2];

/** `[aniso, rule]` uniform values: `cellAniso` and `cellAnisoRule` (flatten on rhoEff, fade on under, band from, to). */
export function facadeTierAnisoUniform(anisotropy: number, band: readonly [number, number] = FACADE_TIER_UNDER_BAND): { cellAniso: number; cellAnisoRule: [number, number, number, number] } {
  return { cellAniso: Number.isFinite(anisotropy) && anisotropy >= 1 ? anisotropy : 1, cellAnisoRule: [1, 1, band[0], band[1]] };
}

/**
 * Measured off (lane R3-D #233 hand-back). At the user's S3 pose the rule raised aliasPx 46,984 -> 55,502 (painted) and
 * 41,116 -> 58,970 (analytic windows), DPR 2: the flatten on rhoEff brings back the grid on the 37 % of the street wall
 * the major-axis tier had flattened, and that grid aliases; the under fade never fires there, because the wall's footprint
 * is under 4:1 anisotropic (rho 16-32 texels/px on both axes), i.e. plain minification, not anisotropic undersampling.
 * `?cellTierAniso=1` turns it on for A/B; off, the program is the major-axis tier byte for byte (no define, no uniform).
 */
export const FACADE_TIER_ANISO_DEFAULT = false;

/** `?cellTierAniso=1` / `=0` (or `window.__canalRecallCellTierAniso`); unasked, FACADE_TIER_ANISO_DEFAULT. */
export function facadeTierAnisoEnabled(): boolean {
  const g = globalThis as Record<string, unknown>;
  let asked = g.__canalRecallCellTierAniso;
  if (asked == null) {
    try { asked = typeof URLSearchParams === 'function' ? new URLSearchParams((g.location as { search?: string } | undefined)?.search ?? '').get('cellTierAniso') : null; } catch { asked = null; }
  }
  if (asked === false || asked === '0' || asked === 'false' || asked === 'off') return false;
  if (asked === true || asked === '1' || asked === 'true' || asked === 'on') return true;
  return FACADE_TIER_ANISO_DEFAULT;
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

/** The footprint ellipse's axes (singular values of the Jacobian [dx dy], texels per pixel), the shader's `cellAnisoRule.y = 2`. */
export function footprintAxes(dx: readonly [number, number], dy: readonly [number, number]): { major: number; minor: number } {
  const tr = dx[0] ** 2 + dx[1] ** 2 + dy[0] ** 2 + dy[1] ** 2, det = Math.abs(dx[0] * dy[1] - dx[1] * dy[0]);
  const major = Math.sqrt(0.5 * (tr + Math.sqrt(Math.max(tr * tr - 4 * det * det, 0))));
  return { major, minor: det / Math.max(major, 1e-6) };
}

/** The roof blend on the CPU, for tests and the gallery's tier readout: weights of the fine, mid and far samples. */
export function roofTierWeights(distM: number): { fine: number; mid: number; far: number } {
  const smooth = (a: number, b: number, x: number) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const mid = smooth(ROOF_TIER_MID_M - ROOF_TIER_MID_FADE_M, ROOF_TIER_MID_M + ROOF_TIER_MID_FADE_M, distM);
  const far = smooth(ROOF_TIER_FAR_M - ROOF_TIER_FAR_FADE_M, ROOF_TIER_FAR_M + ROOF_TIER_FAR_FADE_M, distM);
  return { fine: (1 - mid) * (1 - far), mid: mid * (1 - far), far };
}
