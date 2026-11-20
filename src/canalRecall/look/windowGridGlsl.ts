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

/**
 * Window reveal depth on the shader grid (`?gridReveal=1`, lane large-buildings-20261120 round 5; off by default).
 *
 * The flat grid paints each window flush with the wall, so at an oblique ride pose a receding wall's windows read as
 * skewed stickers. Under the flag the glass and frame sit WINDOW_GRID_REVEAL_DEPTH_M behind the wall face (a fake inset,
 * no geometry): the fragment builds the wall's tangent frame from screen derivatives of the view position and the
 * metre UV, shifts the frame/glass box by depth * view.xy / view.z (parallax), and paints the part of the opening the
 * shifted window leaves uncovered as the reveal: the jamb on the side away from the viewer in the wall colour shaded
 * WINDOW_GRID_REVEAL_SHADE.jamb, the head (seen from below) darker, the sill top lighter. A stone sill line sits under
 * each opening. Flag off: no variant, define, program key or shader text changes (cityLook.ts `gridReveal`).
 */
export const GRID_REVEAL_PARAM = 'gridReveal';
/** Inset of the glass behind the wall face (m): a shallow brick reveal (blind 16: 0.18 m with jamb 0.62 / head 0.42 read as dark offset bands on dark brick). */
export const WINDOW_GRID_REVEAL_DEPTH_M = 0.14;
/** Reveal shades (multipliers of the wall colour): jamb, head soffit, sill top. */
export const WINDOW_GRID_REVEAL_SHADE = { jamb: 0.78, head: 0.62, sill: 0.9 } as const;
/** Stone sill under each opening, in cell fractions: height below the opening and overhang either side. */
export const WINDOW_GRID_SILL = { h: 0.035, over: 0.02, shadow: 0.025 } as const;

export function gridRevealEnabled(search?: string): boolean {
  try {
    const g = globalThis as any;
    if (search === undefined && typeof g.__canalRecallGridReveal === 'boolean') return g.__canalRecallGridReveal;
    const q = search ?? g.location?.search;
    if (q !== undefined) return new URLSearchParams(q).get(GRID_REVEAL_PARAM) === '1';
    return g.process?.env?.GRID_REVEAL === '1';
  } catch { return false; }
}

/** `cityWindowGridReveal(m, p, c, mk)`: cityWindowGrid with the inset; `p` the fragment's view-space position. */
export const WINDOW_GRID_REVEAL_GLSL = /* glsl */ `
float cityGridBox(vec2 q, vec2 lo, vec2 hi, vec2 aa) {
  vec2 b = smoothstep(lo - aa, lo + aa, q) * (1.0 - smoothstep(hi - aa, hi + aa, q));
  return b.x * b.y;
}
void cityWindowGridReveal(vec2 m, vec3 p, inout vec3 c, inout vec2 mk) {
  vec2 pitch = vec2(${glslF(WINDOW_GRID_BAY_M)}, ${glslF(WINDOW_GRID_STOREY_M)});
  vec2 cell = fract(m / pitch);
  vec2 lo = vec2(${glslF(WINDOW_GRID_BOX.x0)}, ${glslF(WINDOW_GRID_BOX.y0)}), hi = vec2(${glslF(WINDOW_GRID_BOX.x1)}, ${glslF(WINDOW_GRID_BOX.y1)});
  vec2 aa = max(fwidth(cell), vec2(1e-4));
  // the wall's tangent frame (cotangent frame from derivatives): u along the wall, v up, n toward the viewer
  vec3 dpx = dFdx(p), dpy = dFdy(p);
  vec2 dmx = dFdx(m), dmy = dFdy(m);
  vec3 n = normalize(cross(dpx, dpy));
  vec3 ax = cross(dpy, n), bx = cross(n, dpx);
  vec3 t = ax * dmx.x + bx * dmy.x, b = ax * dmx.y + bx * dmy.y;
  vec3 v = normalize(-p);
  float tl = length(t), bl = length(b);
  vec3 tv = vec3(tl > 1e-8 ? dot(v, t / tl) : 0.0, bl > 1e-8 ? dot(v, b / bl) : 0.0, dot(v, n));
  // the glass plane seen through this point: depth * view.xy / view.z behind it (grazing views clamped)
  vec2 off = ${glslF(WINDOW_GRID_REVEAL_DEPTH_M)} * tv.xy / max(tv.z, 0.35) / pitch;
  vec2 cg = cell - off;
  float outer = cityGridBox(cell, lo, hi, aa);
  float win = cityGridBox(cg, lo, hi, aa);
  vec2 lg = lo + ${glslF(WINDOW_GRID_BOX.frame)}, hg = hi - ${glslF(WINDOW_GRID_BOX.frame)};
  float glass = cityGridBox(cg, lg, hg, aa);
  vec3 winC = mix(vec3(0.86, 0.85, 0.82), mix(vec3(0.17, 0.21, 0.25), vec3(0.33, 0.39, 0.44), clamp(cg.y, 0.0, 1.0)), glass);
  // the uncovered opening: head soffit above the shifted window, sill top below it, else a jamb
  float shade = cg.y > hi.y ? ${glslF(WINDOW_GRID_REVEAL_SHADE.head)} : (cg.y < lo.y ? ${glslF(WINDOW_GRID_REVEAL_SHADE.sill)} : ${glslF(WINDOW_GRID_REVEAL_SHADE.jamb)});
  vec3 open = mix(c * shade, winC, win);
  // stone sill under the opening, a soft shadow under the sill
  float sill = cityGridBox(cell, vec2(lo.x - ${glslF(WINDOW_GRID_SILL.over)}, lo.y - ${glslF(WINDOW_GRID_SILL.h)}), vec2(hi.x + ${glslF(WINDOW_GRID_SILL.over)}, lo.y), aa) * (1.0 - outer);
  float under = cityGridBox(cell, vec2(lo.x - ${glslF(WINDOW_GRID_SILL.over)}, lo.y - ${glslF(WINDOW_GRID_SILL.h + WINDOW_GRID_SILL.shadow)}), vec2(hi.x + ${glslF(WINDOW_GRID_SILL.over)}, lo.y - ${glslF(WINDOW_GRID_SILL.h)}), aa) * (1.0 - outer);
  float fade = 1.0 - smoothstep(0.08, 0.2, max(aa.x, aa.y));
  vec3 wall = mix(c * mix(1.0, 0.82, under), vec3(0.78, 0.76, 0.72), sill);
  float k = outer * fade;
  c = mix(mix(c, wall, fade), open, k);
  // the reveal keeps the wall's tint (it is shaded wall); only the window and the stone sill clear the masks
  float clear = max(k * win, sill * fade);
  mk.r *= 1.0 - clear;
  mk.g *= 1.0 - clear;
}`;
