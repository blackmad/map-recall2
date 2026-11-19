/**
 * The shader window grid's pitch, window box and GLSL (lane newbuild-kit-20261110; moved out of cityLook.ts by lane
 * fb-models-20261119 so the building-page galleries paint the same grid: galleryWindowGrid.ts, feedback 13fa7f).
 * `cityWindowGrid(m, c, mk)` takes the wall position in metres (the GLB's metre UVs) and mixes the sRGB cell colour `c`
 * toward a pale frame round dark glass, clearing the tint/accent masks `mk` under the window.
 */
const glslF = (v: number) => (Number.isInteger(v) ? v.toFixed(1) : String(v));
/** Grid pitch (m): a civic bay and storey, the window centred in each cell. */
export const WINDOW_GRID_BAY_M = 3.0;
export const WINDOW_GRID_STOREY_M = 3.2;
/** Window box in the cell (fractions): left/right, sill/head, and the frame width. */
export const WINDOW_GRID_BOX = { x0: 0.28, x1: 0.72, y0: 0.3, y1: 0.8, frame: 0.035 } as const;
export const WINDOW_GRID_GLSL = /* glsl */ `
void cityWindowGrid(vec2 m, inout vec3 c, inout vec2 mk) {
  vec2 cell = fract(m / vec2(${glslF(WINDOW_GRID_BAY_M)}, ${glslF(WINDOW_GRID_STOREY_M)}));
  vec2 lo = vec2(${glslF(WINDOW_GRID_BOX.x0)}, ${glslF(WINDOW_GRID_BOX.y0)}), hi = vec2(${glslF(WINDOW_GRID_BOX.x1)}, ${glslF(WINDOW_GRID_BOX.y1)});
  vec2 aa = max(fwidth(cell), vec2(1e-4));
  vec2 inO = smoothstep(lo - aa, lo + aa, cell) * (1.0 - smoothstep(hi - aa, hi + aa, cell));
  vec2 lg = lo + ${glslF(WINDOW_GRID_BOX.frame)}, hg = hi - ${glslF(WINDOW_GRID_BOX.frame)};
  vec2 inG = smoothstep(lg - aa, lg + aa, cell) * (1.0 - smoothstep(hg - aa, hg + aa, cell));
  float outer = inO.x * inO.y, glass = inG.x * inG.y;
  // far away the cells shrink under a pixel: fade the grid to the wall rather than shimmer
  float fade = 1.0 - smoothstep(0.08, 0.2, max(aa.x, aa.y));
  vec3 win = mix(vec3(0.86, 0.85, 0.82), mix(vec3(0.17, 0.21, 0.25), vec3(0.33, 0.39, 0.44), cell.y), glass);
  float k = outer * fade;
  c = mix(c, win, k);
  mk.r *= 1.0 - k;
  mk.g *= 1.0 - k;
}`;
