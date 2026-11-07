// Resolution-independent windows (lane R2-A, #228): the facade shader draws window frames, glass and muntins
// analytically from a per-layer window table (look/windowTable.ts) instead of only sampling the painted 256 px cell,
// and a debug view of the facade tier (`?cellDebug=rho`). Pure strings and flags; look/cityLook.ts installs them.
//
// User shots (map-recall2-screenshots engine/2026-11-06-user-shots/): S2 Da Costakade "windows and trim look fuzzy",
// S3 the 1962 Weesperstraat slab "moving stripes over its window grid while the camera moves".

/**
 * `?cellDebug=rho`: paint the facade tier's texels-per-pixel (and its far blend) as flat classes, for the histogram.
 * `?cellDebug=under` (lane R3-D #233, needs the anisotropy-aware tier): the same colours binned by `under`, the footprint
 * along the wall over what the anisotropic filter covers (roofTier.ts), see CELL_UNDER_CLASS_NAMES.
 */
export type CellDebug = 'rho' | 'under' | null;

/**
 * The classes the rho view paints (sRGB bytes), in the order the histogram reports them. `rho` is texels per
 * framebuffer pixel of the cell sample (roofTier.ts FACADE_TIER_GLSL); `far` the tier's mean-colour blend.
 */
export const CELL_DEBUG_CLASSES = [
  { name: 'magnified (rho < 1)', rgb: [255, 0, 0] },
  { name: 'rho 1-2', rgb: [255, 255, 0] },
  { name: 'rho 2-4', rgb: [0, 255, 0] },
  { name: 'rho 4-8', rgb: [0, 255, 255] },
  { name: 'rho 8-16', rgb: [0, 0, 255] },
  { name: 'rho 16-tier', rgb: [255, 128, 0] },
  { name: 'tier far > 0', rgb: [255, 0, 255] },
  { name: 'depth-fade far > 0 (tier 0)', rgb: [255, 255, 255] },
  // Lane R3-D (#233): with the anisotropy-aware tier, 'tier far' is the flatten on the effective footprint and this the
  // fade where the filter undersamples along the wall.
  { name: 'under fade > 0', rgb: [128, 0, 255] },
  { name: 'roof layer', rgb: [128, 128, 128] },
] as const;
/** `?cellDebug=under`: what each class colour means there (same colours, binned by `under` instead of `rho`). */
export const CELL_UNDER_CLASS_NAMES = ['under < 0.5', 'under 0.5-0.75', 'under 0.75-1', 'under 1-1.5', 'under 1.5-2', 'under >= 2', 'tier flatten > 0', 'depth-fade far > 0 (tier 0)', 'under fade > 0 (unused)', 'roof layer'] as const;
/** Classes that are facade pixels (the histogram's denominator): all but the roof. */
export const CELL_DEBUG_FACADE_CLASSES = CELL_DEBUG_CLASSES.length - 1;

/**
 * Table shape, shared with look/windowTable.ts (which imports these, so the shader strings do not pull the bay painter
 * into every bundle that carries cityLook.ts). `SDF_BAY_PX` is bayTextures.ts BAY_PX (pinned by windowTable.test.ts).
 */
export const WINDOW_TABLE_MAX = 3;
export const WINDOW_TABLE_WIDTH = 16;
export const SDF_BAY_PX = 520;
const BAY_PX_GLSL = SDF_BAY_PX.toFixed(1), WINDOW_MAX_GLSL = String(WINDOW_TABLE_MAX);
const v3 = (rgb: readonly number[]) => `vec3(${rgb.map(c => (c / 255).toFixed(4)).join(', ')})`;

/** GLSL: the debug colour of the last cellTierSample (needs CELL_TIER_PROBE and `roofLayers`). */
export const CELL_DEBUG_GLSL = /* glsl */ `
#ifdef CELL_DEBUG_RHO
vec3 cellDebugColour(float layer) {
  if (roofLayers.x >= 0.0 && layer > roofLayers.x - 0.5 && layer < roofLayers.y - 0.5) return ${v3(CELL_DEBUG_CLASSES[9].rgb)};
#if defined(CELL_TIER_ANISO) && defined(CELL_DEBUG_UNDER)
  if (cellFarFlat > 0.001) return ${v3(CELL_DEBUG_CLASSES[6].rgb)};
  if (cellFarTier <= 0.001 && cellFar > 0.001) return ${v3(CELL_DEBUG_CLASSES[7].rgb)};
  if (cellUnder < 0.5) return ${v3(CELL_DEBUG_CLASSES[0].rgb)};
  if (cellUnder < 0.75) return ${v3(CELL_DEBUG_CLASSES[1].rgb)};
  if (cellUnder < 1.0) return ${v3(CELL_DEBUG_CLASSES[2].rgb)};
  if (cellUnder < 1.5) return ${v3(CELL_DEBUG_CLASSES[3].rgb)};
  if (cellUnder < 2.0) return ${v3(CELL_DEBUG_CLASSES[4].rgb)};
  return ${v3(CELL_DEBUG_CLASSES[5].rgb)};
#else
#ifdef CELL_TIER_ANISO
  if (cellFarFlat > 0.001) return ${v3(CELL_DEBUG_CLASSES[6].rgb)};
  if (cellFarUnder > 0.001) return ${v3(CELL_DEBUG_CLASSES[8].rgb)};
#else
  if (cellFarTier > 0.001) return ${v3(CELL_DEBUG_CLASSES[6].rgb)};
#endif
  if (cellFar > 0.001) return ${v3(CELL_DEBUG_CLASSES[7].rgb)};
  if (cellRho < 1.0) return ${v3(CELL_DEBUG_CLASSES[0].rgb)};
  if (cellRho < 2.0) return ${v3(CELL_DEBUG_CLASSES[1].rgb)};
  if (cellRho < 4.0) return ${v3(CELL_DEBUG_CLASSES[2].rgb)};
  if (cellRho < 8.0) return ${v3(CELL_DEBUG_CLASSES[3].rgb)};
  if (cellRho < 16.0) return ${v3(CELL_DEBUG_CLASSES[4].rgb)};
  return ${v3(CELL_DEBUG_CLASSES[5].rgb)};
#endif
}
#endif`;

/** Classify one sRGB pixel to a debug class index (nearest within `tolerance` Manhattan), or -1 (not a facade). */
export function cellDebugClass(r: number, g: number, b: number, tolerance = 60): number {
  let best = -1, bestD = tolerance;
  CELL_DEBUG_CLASSES.forEach((c, i) => {
    const d = Math.abs(r - c.rgb[0]) + Math.abs(g - c.rgb[1]) + Math.abs(b - c.rgb[2]);
    if (d < bestD) { bestD = d; best = i; }
  });
  return best;
}

/** Histogram of the debug classes inside `rect` (fractions) of an RGB(A) frame, rows from the top. */
export function cellDebugHistogram(data: ArrayLike<number>, width: number, height: number, channels: number, rect = { x0: 0, y0: 0, x1: 1, y1: 1 }): { counts: number[]; facade: number; share: number[] } {
  const counts = CELL_DEBUG_CLASSES.map(() => 0);
  const X0 = Math.floor(rect.x0 * width), X1 = Math.ceil(rect.x1 * width), Y0 = Math.floor(rect.y0 * height), Y1 = Math.ceil(rect.y1 * height);
  for (let y = Y0; y < Y1; y++) for (let x = X0; x < X1; x++) {
    const o = (y * width + x) * channels, k = cellDebugClass(data[o], data[o + 1], data[o + 2]);
    if (k >= 0) counts[k]++;
  }
  // Roof pixels are not facade pixels: the shares are over the facade classes.
  const facade = counts.slice(0, CELL_DEBUG_FACADE_CLASSES).reduce((s, v) => s + v, 0);
  return { counts, facade, share: counts.map((c, i) => (i < CELL_DEBUG_FACADE_CLASSES && facade ? c / facade : 0)) };
}

function pageParam(param: string): string | null {
  try {
    return typeof URLSearchParams === 'function' ? new URLSearchParams((globalThis as { location?: { search?: string } }).location?.search ?? '').get(param) : null;
  } catch { return null; }
}

/** `?cellDebug=rho` (or `window.__canalRecallCellDebug = 'rho'`). Off by default. */
export function cellDebugMode(): CellDebug {
  const g = globalThis as Record<string, unknown>;
  const asked = g.__canalRecallCellDebug ?? pageParam('cellDebug');
  return asked === 'rho' || asked === 'under' ? asked : null;
}

/**
 * `?windowSdf=1` / `?windowSdf=0` (or `window.__canalRecallWindowSdf = true | false`). Unasked, desktop follows
 * WINDOW_SDF_DESKTOP_DEFAULT and touch WINDOW_SDF_TOUCH_DEFAULT. Desktop flipped on 2026-11-07 after a quiet
 * GPU-timer read on cf0f9d02e (6 alternating runs, DPR 2: dam painted 4.98 ms vs sdf 3.98, westerkerk 4.64 vs 4.43,
 * cost under the noise floor; lapVar +13 % at the user's S2 pose). Touch stays off until the user's iPhone has been
 * measured (the emulated profile read +1.6 ms at Dam); `?windowSdf=1` is the phone try-URL.
 */
export function windowSdfEnabled(touch = false): boolean {
  const g = globalThis as Record<string, unknown>;
  const asked = g.__canalRecallWindowSdf ?? pageParam('windowSdf');
  if (asked === false || asked === '0' || asked === 'false' || asked === 'off') return false;
  if (asked === true || asked === '1' || asked === 'true' || asked === 'on') return true;
  return touch ? WINDOW_SDF_TOUCH_DEFAULT : WINDOW_SDF_DESKTOP_DEFAULT;
}
export const WINDOW_SDF_DESKTOP_DEFAULT = true;
/** Touch tier default (the brief: on only if the iPhone GPU cost holds; the emulated profile is not the phone's GPU). */
export const WINDOW_SDF_TOUCH_DEFAULT = false;

/** The pixel footprint the edges are filtered over, in pixels (1 = a box exactly one pixel wide). Round two's shader. */
export const WINDOW_SDF_FOOTPRINT = 1.25;
/**
 * On-screen opening size (px, the smaller axis) over which the analytic window fades in from the painted cell. Measured
 * at hand-back: [5, 10] removed the S3 flicker excess but also every S2 gain; [2.5, 5] keeps about two thirds of the S2
 * gain; no fade (v1) the most S2 gain and the most S3 flicker. Round two's shader.
 */
export const WINDOW_SDF_FADE_PX = [2.5, 5] as const;

/**
 * Band-limited windows (lane R3-B #231, `?windowSdfBand=0` restores round two's shader in the same program): every
 * feature keeps a minimum screen width with energy-conserving coverage (look/windowSdf.ts `bandFrameWeight`, the rail
 * stripes' rule in ownGround/railStripes.ts), so a sub-pixel frame or bar no longer flickers between 0 and 1 coverage
 * as the pixel grid slides over it:
 *   footprint  the box the edges are filtered over, in framebuffer px (fwidth per axis x this);
 *   fadePx     opening size (px, smaller axis) over which the window fades in from the painted (mip) texel;
 *   frameMinPx the frame ring is drawn at least this wide on screen, its contrast scaled by true / drawn area;
 *   barPx      glazing bars fade out as their width on screen falls from [1] to [0] px, the glass taking their mean;
 *              [0, 0] (the default) never fades them: a tent-filtered bar already draws at its true area, and fading
 *              them erased the sash panes at da-costakade-near while aliasPx was lower without the fade (#231 sweep 8).
 *   tent       filter the edges by a tent of half-width footprint x fwidth instead of a box (`?windowSdfTent=1`).
 * The values are uniforms (`windowSdfBand`, `windowSdfShape`) so the probes sweep them in one page; the query flags
 * `?windowSdfFoot=`, `?windowSdfFade=a,b`, `?windowSdfFrameMin=`, `?windowSdfBar=a,b` set them for a page.
 */
export const WINDOW_SDF_BAND = { footprint: 1.0, fadePx: [2, 4] as readonly [number, number], frameMinPx: 0, barPx: [0, 0] as readonly [number, number], tent: true };
/**
 * The facade cell sample's mip bias while the band-limited windows are on (`?cellLodBias=` overrides, 0 = none). The
 * windows fix the alias, the bias buys the brick/trim sharpness back; picked by the sweep in the lane's hand-back
 * (#231): at -0.6 aliasPx is 13 % under the painted cell's at s3-slab-user and 13 % under at s3-slab; -0.75 is 5 % under at s3-slab-user.
 */
export const WINDOW_SDF_LOD_BIAS = -0.6;

/** `?windowSdfBand=0` (or `window.__canalRecallWindowSdfBand = false`): round two's shader. On by default. */
export function windowSdfBandEnabled(): boolean {
  const g = globalThis as Record<string, unknown>;
  const asked = g.__canalRecallWindowSdfBand ?? pageParam('windowSdfBand');
  return !(asked === false || asked === '0' || asked === 'false' || asked === 'off');
}

const numbers = (raw: string | null, n: number): number[] | null => {
  if (raw == null) return null;
  const v = raw.split(',').map(Number);
  return v.length === n && v.every(x => Number.isFinite(x) && x >= 0) ? v : null;
};

/** The band uniforms' values for this page: [band on, footprint, fade from, fade to] and [frame min px, bar from, bar to, tent]. */
export function windowSdfBandValues(): { band: [number, number, number, number]; shape: [number, number, number, number] } {
  const b = WINDOW_SDF_BAND;
  const foot = numbers(pageParam('windowSdfFoot'), 1)?.[0] ?? b.footprint;
  const fade = numbers(pageParam('windowSdfFade'), 2) ?? b.fadePx;
  const frameMin = numbers(pageParam('windowSdfFrameMin'), 1)?.[0] ?? b.frameMinPx;
  const bar = numbers(pageParam('windowSdfBar'), 2) ?? b.barPx;
  const tentAsked = pageParam('windowSdfTent'), tent = tentAsked == null ? b.tent : tentAsked === '1';
  return { band: [windowSdfBandEnabled() ? 1 : 0, foot, fade[0], fade[1]], shape: [frameMin, bar[0], bar[1], tent ? 1 : 0] };
}

let bandCache: { key: string; v: ReturnType<typeof windowSdfBandValues> } | null = null;
/** Fresh uniforms for one material (the probes set every material's, as with `windowSdfMix`). */
export function windowSdfBandUniforms(): { windowSdfBand: { value: number[] }; windowSdfShape: { value: number[] } } {
  // Every city-look material calls this: the query is parsed once per page (and again only if it changes, as in tests).
  const key = `${(globalThis as { location?: { search?: string } }).location?.search ?? ''}|${String((globalThis as Record<string, unknown>).__canalRecallWindowSdfBand)}`;
  if (bandCache?.key !== key) bandCache = { key, v: windowSdfBandValues() };
  const v = bandCache.v;
  return { windowSdfBand: { value: [...v.band] }, windowSdfShape: { value: [...v.shape] } };
}

// CPU twins of the band shader (windowSdf.test.ts): the same arithmetic in one dimension.
/** Coverage of [a, b] by a box pixel of width fw centred at x (wsCover). */
export const coverBox = (x: number, a: number, b: number, fw: number): number => Math.min(1, Math.max(0, (Math.min(b, x + 0.5 * fw) - Math.max(a, x - 0.5 * fw)) / fw));
/** Coverage of [a, b] by a tent pixel of half-width fw centred at x (the band shader's `windowSdfShape.w = 1`). */
export const coverTent = (x: number, a: number, b: number, fw: number): number => {
  const cdf = (u: number) => { u = Math.min(1, Math.max(-1, u)); return u < 0 ? 0.5 * (1 + u) * (1 + u) : 1 - 0.5 * (1 - u) * (1 - u); };
  return Math.max(0, cdf((b - x) / fw) - cdf((a - x) / fw));
};
/**
 * A frame side `width` canvas px wide at [a, a + width], drawn at least `minPx` screen px wide (fw canvas px per px):
 * its drawn span and the contrast weight that keeps the integrated tone (wsRing's `k`), capped at `cap` canvas px.
 */
export function bandFrameSpan(width: number, fw: number, minPx: number, cap = Infinity): { drawn: number; k: number } {
  const drawn = Math.min(cap, Math.max(width, minPx * fw));
  return { drawn, k: drawn > 0 ? Math.min(1, width / drawn) : 0 };
}
/** One pixel's frame tone weight at x for a frame [a, a + width] (frame tone k over glass): the band shader's ring. */
export function bandFrameWeight(x: number, a: number, width: number, fw: number, minPx: number, footprint = 1): number {
  // Widened inwards (into the glass), as the shader shrinks the pane: the opening's outline stays put.
  const { drawn, k } = bandFrameSpan(width, fw, minPx);
  return k * coverBox(x, a, a + drawn, fw * footprint);
}
/** Glazing bar weight for a bar `width` canvas px wide with `fw` canvas px per screen px (fades out [from, to] px). */
export function barFade(width: number, fw: number, from: number, to: number): number {
  if (to <= 0) return 1;
  const t = Math.min(1, Math.max(0, (width / Math.max(fw, 1e-6) - from) / Math.max(to - from, 1e-6)));
  return t * t * (3 - 2 * t);
}

/** The painter's glazing gradient (bayTextures.ts windowAt, photo look): stops at 0, 0.55, 1 down the opening. */
export const GLASS_STOPS = ['#6f8796', '#2f4350', '#1d2a33'] as const;

const hexV3 = (hex: string) => v3([parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)]);

/**
 * GLSL (CITY_WINDOW_SDF): `windowSdf(uv, layer, c, m)` redraws the frame, glass and muntins of the layer's windows
 * (look/windowTable.ts) over the painted sample `c`/`m`, box-filtered by the pixel's footprint per axis, so an edge is
 * exactly as wide on screen as the pixels it covers at any distance: no bilinear softening when magnified, no mip
 * blur when minified, and thin bars average to their area instead of aliasing. Everything outside the openings (wall,
 * brick, reveal, lintel, sill, shutters) stays the painted texel. Blended out with the tier's `cellFar` (needs
 * CELL_TIER_PROBE), so the mean-colour fallback and the depth fade are unchanged.
 */
export const WINDOW_SDF_GLSL = /* glsl */ `
#ifdef CITY_WINDOW_SDF
uniform highp sampler2D windowTable;
// 1 in the game; the A/B probes set 0 to draw the painted cell in the same page and pose (tests/e2e/crisp-textures).
uniform float windowSdfMix;
// Band-limited windows (lane R3-B #231): [on, footprint, fade from px, fade to px], [frame min px, bar fade from px, to px, tent].
// x = 0 is round two's shader exactly (?windowSdfBand=0).
uniform vec4 windowSdfBand;
uniform vec4 windowSdfShape;
// Coverage of [a, b] by a pixel of width fw centred at x (exact for a box pixel; thin bars give their area). Band mode
// with windowSdfShape.w = 1: a tent reaching fw either side instead (a partition of unity at the pixel pitch, so a thin bar's
// summed coverage and its peak stay the same at every sub-pixel phase).
float wsTentCdf(float u) { u = clamp(u, -1.0, 1.0); return u < 0.0 ? 0.5 * (1.0 + u) * (1.0 + u) : 1.0 - 0.5 * (1.0 - u) * (1.0 - u); }
float wsCover(float x, float a, float b, float fw) {
  if (windowSdfBand.x > 0.5 && windowSdfShape.w > 0.5) return max(wsTentCdf((b - x) / fw) - wsTentCdf((a - x) / fw), 0.0);
  return clamp((min(b, x + 0.5 * fw) - max(a, x - 0.5 * fw)) / fw, 0.0, 1.0);
}
// Coverage of the opening [x0, x1] x [y0, top(x)] in canvas px (y up); shape 1 segmental, 2 arch.
float wsOpening(vec2 p, vec2 fw, float x0, float x1, float y0, float y1, float shape, float rise) {
  float cx = wsCover(p.x, x0, x1, fw.x);
  if (shape > 1.5) {
    float r = 0.5 * (x1 - x0), cy = y1 - r;
    float below = wsCover(p.y, y0, cy, fw.y);
    float d = length(p - vec2(x0 + r, cy)) - r, fwr = max(0.5 * (fw.x + fw.y), 1e-4);
    float above = p.y > cy ? clamp(0.5 - d / fwr, 0.0, 1.0) : 0.0;
    return max(cx * below, above * wsCover(p.y, cy, y1, fw.y));
  }
  float top = y1;
  if (shape > 0.5) { float s = clamp((p.x - x0) / max(x1 - x0, 1e-4), 0.0, 1.0); top = y1 - rise + 4.0 * rise * s * (1.0 - s); }
  return cx * wsCover(p.y, y0, top, fw.y);
}
float wsBarH(vec2 p, vec2 fw, float x0, float x1, float yc, float hw) { return wsCover(p.x, x0, x1, fw.x) * wsCover(p.y, yc - hw, yc + hw, fw.y); }
float wsBarV(vec2 p, vec2 fw, float y0, float y1, float xc, float hw) { return wsCover(p.y, y0, y1, fw.y) * wsCover(p.x, xc - hw, xc + hw, fw.x); }
// Band mode: a bar's weight as its width on screen (2 hw / fw across it) falls through the bar fade, and its area share
// of the span it crosses (what the glass takes over as it fades).
float wsBarFade(float hw, float fwAcross) { return windowSdfShape.z <= 0.0 ? 1.0 : smoothstep(windowSdfShape.y, windowSdfShape.z, 2.0 * hw / max(fwAcross, 1e-4)); }
void windowSdf(vec2 uv, float layer, float weight, inout vec3 c, inout vec2 m) {
  weight *= windowSdfMix;
  if (weight <= 0.0) return;
  int row = int(layer + 0.5);
  vec4 head = texelFetch(windowTable, ivec2(0, row), 0);
  int count = int(head.x + 0.5);
  if (count <= 0) return;
  bool band = windowSdfBand.x > 0.5;
  vec2 cell = vec2(${BAY_PX_GLSL}, head.y);
  vec2 p = fract(uv) * cell;
  // The pixel's footprint from the continuous uv (fract jumps at the cell seam), in canvas px per framebuffer px.
  vec2 fpx = max(fwidth(uv * cell), vec2(1e-3));
  vec2 fw = fpx * (band ? windowSdfBand.y : ${WINDOW_SDF_FOOTPRINT.toFixed(2)});
#ifdef CELL_TAPS
  // The footprint prefilter's taps (roofTier.ts, lane R4-D #246) widen the edge box with the wall under the windows.
  fw *= mix(1.0, cellTapsSdf, cellTapW);
#endif
  vec2 fade = band ? windowSdfBand.zw : vec2(${WINDOW_SDF_FADE_PX[0].toFixed(1)}, ${WINDOW_SDF_FADE_PX[1].toFixed(1)});
  for (int i = 0; i < ${WINDOW_MAX_GLSL}; i++) {
    if (i >= count) break;
    vec4 r = texelFetch(windowTable, ivec2(1 + 4 * i, row), 0) * vec4(cell.x, cell.x, cell.y, cell.y);
    // Windows never overlap in x: skip any whose opening (plus a footprint) does not hold this pixel.
    if (p.x < r.x - fw.x || p.x > r.y + fw.x || p.y < r.z - fw.y || p.y > r.w + fw.y) continue;
    vec4 t1 = texelFetch(windowTable, ivec2(2 + 4 * i, row), 0);
    vec4 frame = texelFetch(windowTable, ivec2(3 + 4 * i, row), 0);
    vec4 t3 = texelFetch(windowTable, ivec2(4 + 4 * i, row), 0);
    float shape = t1.x, muntin = t1.y, ix = t1.z * cell.x, iy = t1.w * cell.y, rise = t3.x * cell.y, lift = t3.y;
    // Small windows go back to the painted (mip-filtered) cell: a box-filtered grid of 2-4 px openings beats against
    // the pixel grid as the camera moves (S3 still pan, DPR 2 and the phone), where the trilinear texel does not.
    // Band mode measures the opening in true pixels (the footprint widens the box, not the size test).
    vec2 fs = band ? fpx : fw;
    float sizePx = min((r.y - r.x) / fs.x, (r.w - r.z) / fs.y);
    float wk = weight * smoothstep(fade.x, fade.y, sizePx);
    if (wk <= 0.0) continue;
    float outer = wsOpening(p, fw, r.x, r.y, r.z, r.w, shape, rise);
    if (outer <= 0.0) continue;
    // Band mode: the frame ring at least frameMinPx wide on screen (widened into the glass, the outline stays), drawn
    // at the contrast k that keeps its integrated tone: true ring area over the drawn ring's.
    float k = 1.0, ixd = ix, iyd = iy;
    if (band) {
      ixd = min(max(ix, windowSdfShape.x * fpx.x), 0.35 * (r.y - r.x));
      iyd = min(max(iy, windowSdfShape.x * fpx.y), 0.35 * (r.w - r.z));
      float W = r.y - r.x, H = r.w - r.z;
      float trueRing = W * H - max(W - 2.0 * ix, 0.0) * max(H - 2.0 * iy, 0.0);
      float drawnRing = W * H - max(W - 2.0 * ixd, 0.0) * max(H - 2.0 * iyd, 0.0);
      k = drawnRing > 0.0 ? clamp(trueRing / drawnRing, 0.0, 1.0) : 1.0;
    }
    float px0 = r.x + ixd, px1 = r.y - ixd, py0 = r.z + iyd, py1 = r.w - iyd;
    float paneRise = shape > 0.5 && shape < 1.5 ? rise : 0.0;
    float pane = wsOpening(p, fw, px0, px1, py0, py1, shape, paneRise);
    // Muntins, the painter's bars (bayTextures.ts windowAt), positioned on the opening's height h from its top. In band
    // mode each bar fades out by its width on screen and its lost area goes into the glass mean (barMean).
    float h = r.w - r.z, top = r.w, xm = 0.5 * (r.x + r.y), bars = 0.0, barMean = 0.0;
    float bh = 1.0, bv = 1.0;
    float hp = max(py1 - py0, 1e-3), wp = max(px1 - px0, 1e-3);
    if (muntin > 0.5 && muntin < 1.5) {
      if (band) { bh = wsBarFade(2.0, fpx.y); barMean = (1.0 - bh) * 4.0 / hp; }
      bars = bh * wsBarH(p, fw, px0, px1, top - 0.29 * h, 2.0);
    } else if (muntin < 2.5 && muntin > 1.5) {
      if (band) { bh = wsBarFade(2.0, fpx.y); bv = wsBarFade(2.0, fpx.x); barMean = (1.0 - bh) * 4.0 / hp + (1.0 - bv) * 4.0 / wp; }
      bars = max(bh * wsBarH(p, fw, px0, px1, top - 0.27 * h, 2.0), bv * wsBarV(p, fw, py0, py1, xm, 2.0));
    } else if (muntin < 3.5 && muntin > 2.5) {
      if (band) { bh = wsBarFade(4.0, fpx.y); bv = wsBarFade(4.0, fpx.x); barMean = (1.0 - bh) * 8.0 / hp + (1.0 - bv) * 8.0 / wp; }
      bars = max(bh * wsBarH(p, fw, px0, px1, top - 0.42 * h - 4.0, 4.0), bv * wsBarV(p, fw, py0, py1, xm, 4.0));
    } else if (muntin < 4.5 && muntin > 3.5) {
      float bh3 = 1.0, bh15 = 1.0, bv15 = 1.0;
      if (band) { bh3 = wsBarFade(3.0, fpx.y); bh15 = wsBarFade(1.5, fpx.y); bv15 = wsBarFade(1.5, fpx.x); barMean = ((1.0 - bh3) * 6.0 + (1.0 - bh15) * 6.0) / hp + (1.0 - bv15) * 6.0 / wp; }
      bars = max(bh3 * wsBarH(p, fw, px0, px1, top - 0.5 * h, 3.0), bh15 * max(wsBarH(p, fw, px0, px1, top - 0.25 * h, 1.5), wsBarH(p, fw, px0, px1, top - 0.75 * h, 1.5)));
      float third = (px1 - px0) / 3.0;
      bars = max(bars, bv15 * max(wsBarV(p, fw, py0, py1, px0 + third, 1.5), wsBarV(p, fw, py0, py1, px0 + 2.0 * third, 1.5)));
    } else if (muntin > 4.5) {
      if (band) { bv = wsBarFade(3.0, fpx.x); barMean = (1.0 - bv) * 18.0 / wp; }
      float quarter = (px1 - px0) / 4.0;
      bars = bv * max(wsBarV(p, fw, py0, py1, px0 + quarter, 3.0), max(wsBarV(p, fw, py0, py1, px0 + 2.0 * quarter, 3.0), wsBarV(p, fw, py0, py1, px0 + 3.0 * quarter, 3.0)));
    }
    float glass = pane * (1.0 - bars);
    // The glazing gradient down the opening, then the atlas's calm lift of dark texels (paintLookAtlas.ts).
    float g = clamp((top - p.y) / max(h, 1e-3), 0.0, 1.0);
    vec3 gc = g < 0.55 ? mix(${hexV3(GLASS_STOPS[0])}, ${hexV3(GLASS_STOPS[1])}, g / 0.55) : mix(${hexV3(GLASS_STOPS[1])}, ${hexV3(GLASS_STOPS[2])}, (g - 0.55) / 0.45);
    float lum = (gc.r + gc.g + gc.b) / 3.0;
    if (lum < ${(90 / 255).toFixed(5)}) gc += (vec3(${(150 / 255).toFixed(5)}) - gc) * lift * (1.0 - lum / ${(90 / 255).toFixed(5)});
    if (band) {
      // The glass takes the faded bars' mean; the drawn ring is frame over that glass at contrast k.
      vec3 gm = mix(gc, frame.rgb, clamp(barMean, 0.0, 1.0));
      float mf = frame.a * clamp(barMean, 0.0, 1.0);
      c = mix(c, mix(gm, frame.rgb, k), outer * wk); m = mix(m, vec2(0.0, mix(mf, frame.a, k)), outer * wk);
      c = mix(c, mix(gm, frame.rgb, bars), pane * wk); m = mix(m, vec2(0.0, mix(mf, frame.a, bars)), pane * wk);
      continue;
    }
    c = mix(c, frame.rgb, outer * wk); m = mix(m, vec2(0.0, frame.a), outer * wk);
    c = mix(c, gc, glass * wk); m = mix(m, vec2(0.0), glass * wk);
  }
}
#endif`;
