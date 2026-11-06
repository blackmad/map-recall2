// Resolution-independent windows (lane R2-A, #228): the facade shader draws window frames, glass and muntins
// analytically from a per-layer window table (look/windowTable.ts) instead of only sampling the painted 256 px cell,
// and a debug view of the facade tier (`?cellDebug=rho`). Pure strings and flags; look/cityLook.ts installs them.
//
// User shots (map-recall2-screenshots engine/2026-11-06-user-shots/): S2 Da Costakade "windows and trim look fuzzy",
// S3 the 1962 Weesperstraat slab "moving stripes over its window grid while the camera moves".

/** `?cellDebug=rho`: paint the facade tier's texels-per-pixel (and its far blend) as flat classes, for the histogram. */
export type CellDebug = 'rho' | null;

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
  { name: 'roof layer', rgb: [128, 128, 128] },
] as const;
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
  if (roofLayers.x >= 0.0 && layer > roofLayers.x - 0.5 && layer < roofLayers.y - 0.5) return ${v3(CELL_DEBUG_CLASSES[8].rgb)};
  if (cellFarTier > 0.001) return ${v3(CELL_DEBUG_CLASSES[6].rgb)};
  if (cellFar > 0.001) return ${v3(CELL_DEBUG_CLASSES[7].rgb)};
  if (cellRho < 1.0) return ${v3(CELL_DEBUG_CLASSES[0].rgb)};
  if (cellRho < 2.0) return ${v3(CELL_DEBUG_CLASSES[1].rgb)};
  if (cellRho < 4.0) return ${v3(CELL_DEBUG_CLASSES[2].rgb)};
  if (cellRho < 8.0) return ${v3(CELL_DEBUG_CLASSES[3].rgb)};
  if (cellRho < 16.0) return ${v3(CELL_DEBUG_CLASSES[4].rgb)};
  return ${v3(CELL_DEBUG_CLASSES[5].rgb)};
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
  return asked === 'rho' ? 'rho' : null;
}

/** `?windowSdf=0` (or `window.__canalRecallWindowSdf = false`): facades sample only the painted cell, as before. */
export function windowSdfEnabled(touch = false): boolean {
  const g = globalThis as Record<string, unknown>;
  const asked = g.__canalRecallWindowSdf ?? pageParam('windowSdf');
  if (asked === false || asked === '0' || asked === 'false' || asked === 'off') return false;
  if (asked === true || asked === '1' || asked === 'true' || asked === 'on') return true;
  return !touch || WINDOW_SDF_TOUCH_DEFAULT;
}
/** Touch tier default (the brief: on only if the iPhone GPU cost holds; see the hand-back on #228). */
export const WINDOW_SDF_TOUCH_DEFAULT = false;

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
// Coverage of [a, b] by a pixel of width fw centred at x (exact for a box pixel; thin bars give their area).
float wsCover(float x, float a, float b, float fw) { return clamp((min(b, x + 0.5 * fw) - max(a, x - 0.5 * fw)) / fw, 0.0, 1.0); }
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
void windowSdf(vec2 uv, float layer, float weight, inout vec3 c, inout vec2 m) {
  weight *= windowSdfMix;
  if (weight <= 0.0) return;
  int row = int(layer + 0.5);
  vec4 head = texelFetch(windowTable, ivec2(0, row), 0);
  int count = int(head.x + 0.5);
  if (count <= 0) return;
  vec2 cell = vec2(${BAY_PX_GLSL}, head.y);
  vec2 p = fract(uv) * cell;
  // The footprint from the continuous uv (fract jumps at the cell seam).
  vec2 fw = max(fwidth(uv * cell), vec2(1e-3));
  for (int i = 0; i < ${WINDOW_MAX_GLSL}; i++) {
    if (i >= count) break;
    vec4 r = texelFetch(windowTable, ivec2(1 + 4 * i, row), 0) * vec4(cell.x, cell.x, cell.y, cell.y);
    // Windows never overlap in x: skip any whose opening (plus a footprint) does not hold this pixel.
    if (p.x < r.x - fw.x || p.x > r.y + fw.x || p.y < r.z - fw.y || p.y > r.w + fw.y) continue;
    vec4 t1 = texelFetch(windowTable, ivec2(2 + 4 * i, row), 0);
    vec4 frame = texelFetch(windowTable, ivec2(3 + 4 * i, row), 0);
    vec4 t3 = texelFetch(windowTable, ivec2(4 + 4 * i, row), 0);
    float shape = t1.x, muntin = t1.y, ix = t1.z * cell.x, iy = t1.w * cell.y, rise = t3.x * cell.y, lift = t3.y;
    float outer = wsOpening(p, fw, r.x, r.y, r.z, r.w, shape, rise);
    if (outer <= 0.0) continue;
    float px0 = r.x + ix, px1 = r.y - ix, py0 = r.z + iy, py1 = r.w - iy;
    float paneRise = shape > 0.5 && shape < 1.5 ? rise : 0.0;
    float pane = wsOpening(p, fw, px0, px1, py0, py1, shape, paneRise);
    // Muntins, the painter's bars (bayTextures.ts windowAt), positioned on the opening's height h from its top.
    float h = r.w - r.z, top = r.w, xm = 0.5 * (r.x + r.y), bars = 0.0;
    if (muntin > 0.5 && muntin < 1.5) bars = wsBarH(p, fw, px0, px1, top - 0.29 * h, 2.0);
    else if (muntin < 2.5 && muntin > 1.5) bars = max(wsBarH(p, fw, px0, px1, top - 0.27 * h, 2.0), wsBarV(p, fw, py0, py1, xm, 2.0));
    else if (muntin < 3.5 && muntin > 2.5) bars = max(wsBarH(p, fw, px0, px1, top - 0.42 * h - 4.0, 4.0), wsBarV(p, fw, py0, py1, xm, 4.0));
    else if (muntin < 4.5 && muntin > 3.5) {
      bars = max(wsBarH(p, fw, px0, px1, top - 0.5 * h, 3.0), max(wsBarH(p, fw, px0, px1, top - 0.25 * h, 1.5), wsBarH(p, fw, px0, px1, top - 0.75 * h, 1.5)));
      float third = (px1 - px0) / 3.0;
      bars = max(bars, max(wsBarV(p, fw, py0, py1, px0 + third, 1.5), wsBarV(p, fw, py0, py1, px0 + 2.0 * third, 1.5)));
    } else if (muntin > 4.5) {
      float quarter = (px1 - px0) / 4.0;
      bars = max(wsBarV(p, fw, py0, py1, px0 + quarter, 3.0), max(wsBarV(p, fw, py0, py1, px0 + 2.0 * quarter, 3.0), wsBarV(p, fw, py0, py1, px0 + 3.0 * quarter, 3.0)));
    }
    float glass = pane * (1.0 - bars);
    // The glazing gradient down the opening, then the atlas's calm lift of dark texels (paintLookAtlas.ts).
    float g = clamp((top - p.y) / max(h, 1e-3), 0.0, 1.0);
    vec3 gc = g < 0.55 ? mix(${hexV3(GLASS_STOPS[0])}, ${hexV3(GLASS_STOPS[1])}, g / 0.55) : mix(${hexV3(GLASS_STOPS[1])}, ${hexV3(GLASS_STOPS[2])}, (g - 0.55) / 0.45);
    float lum = (gc.r + gc.g + gc.b) / 3.0;
    if (lum < ${(90 / 255).toFixed(5)}) gc += (vec3(${(150 / 255).toFixed(5)}) - gc) * lift * (1.0 - lum / ${(90 / 255).toFixed(5)});
    c = mix(c, frame.rgb, outer * weight); m = mix(m, vec2(0.0, frame.a), outer * weight);
    c = mix(c, gc, glass * weight); m = mix(m, vec2(0.0), glass * weight);
  }
}
#endif`;
