/**
 * The landmark highlight: what marks "this is the destination" / "this is the building you tapped"
 * (docs/gameplay/loop.md), in every building pipeline and both frames.
 *
 * `?highlight=` picks a style (window.__canalRecallHighlight takes the same values):
 *   - unset / `a` (the default since 2026-10-13) outline + ground ring + beacon: real materials, a screen-space
 *     silhouette in the accent (2 px, wider far away: `outlineWidthPx`), a soft ring on the ground at the footprint
 *     and a thin vertical beacon above the roof that fades with distance;
 *   - `yellow`: the old look kept for comparison, the building painted #ffd21f (pixel-identical: nothing below
 *     changes a shader);
 *   - `b` rim light + pulse: real materials, a fresnel rim in the accent pulsing slowly, plus the ground ring;
 *   - `c` desaturate the rest: real materials, buildings within 60 m lose 40 % saturation, plus the ground ring.
 *
 * Every pipeline speaks one protocol, the `hidden` value it already had (vertex or instance attribute):
 *   0 drawn, 1 hidden (a model replaces it), 2 the highlighted building, 3 dimmed (style c's neighbours).
 * Whole-mesh pipelines (landmark GLBs, recipe houses, highlight copies of instances) swap to a material variant
 * instead (`highlightMaterialFor`). The shaders read the state through `HIGHLIGHT_GLSL`:
 * `HL_PAINT(state)` is today's yellow branch, compiled out under a/b/c (define `HL_KEEP`), and `hlDesat` dims.
 *
 * The outline and the rim are extra draws of the highlighted geometry only (`attachHighlightPasses`): children of
 * the mesh that share its geometry (and instance matrices), so they follow any transform and either frame. On a
 * merged mesh (chunks, recipe tiles, instanced types) the pass keeps only `hidden == 2` vertices.
 *
 * The ring and beacon are one object for the whole page (`highlightMarker.ts`).
 *
 * Small targets (style a): when the lit building's footprint covers under ~1 % of the frame (an ordinary terrace
 * house from the chase camera), the marker raises the beacon and publishes a boost (`smallTargetBoost`, on
 * `window.__canalRecallHighlightBoost`); a third pass, the roof wash, paints the building's upward faces in the
 * accent at up to `ROOF_WASH_ALPHA`. Both fade out as the footprint grows past ~2 %. Walls are never washed, so the
 * facade stays the building's own from the saddle.
 */
import { HIGHLIGHT_CORAL, HIGHLIGHT_YELLOW, HUD_ACCENT, hexToRgb, type RGB } from './palette.ts';

export type HighlightStyle = 'yellow' | 'a' | 'b' | 'c';
export const HIGHLIGHT_PARAM = 'highlight';
export const HIGHLIGHT_GLOBAL = '__canalRecallHighlight';
export const HIGHLIGHT_ACCENT_PARAM = 'highlightAccent';
export const HIGHLIGHT_ACCENT_GLOBAL = '__canalRecallHighlightAccent';

export interface HighlightRecipe {
  /** The building keeps its own materials (no yellow). */
  keepMaterials: boolean;
  outline: boolean;
  rim: boolean;
  /** Neighbours within `DESATURATE_RADIUS_M` drop `DESATURATE_AMOUNT` saturation. */
  desaturate: boolean;
  ring: boolean;
  beacon: boolean;
  /** Small-target roof wash (`smallTargetBoost`). */
  wash: boolean;
  /** Needs a redraw every frame while shown (the pulse). */
  animated: boolean;
}

export const HIGHLIGHT_RECIPES: Readonly<Record<HighlightStyle, HighlightRecipe>> = {
  yellow: { keepMaterials: false, outline: false, rim: false, desaturate: false, ring: false, beacon: false, wash: false, animated: false },
  a: { keepMaterials: true, outline: true, rim: false, desaturate: false, ring: true, beacon: true, wash: true, animated: false },
  b: { keepMaterials: true, outline: false, rim: true, desaturate: false, ring: true, beacon: false, wash: false, animated: true },
  c: { keepMaterials: true, outline: false, rim: false, desaturate: true, ring: true, beacon: false, wash: false, animated: false },
};

export const HIGHLIGHT_STYLES: readonly HighlightStyle[] = ['yellow', 'a', 'b', 'c'];
export const DESATURATE_RADIUS_M = 60;
export const DESATURATE_AMOUNT = 0.4;
/** Outline width near the camera, CSS pixels. */
export const OUTLINE_PX = 2;
/**
 * Far away the outline widens, so it still reads at chase distance on an ordinary 6 m house (measured 2026-10-13 at
 * the Oud-West terrace, chase camera 213 m from the roof: median 2.0 px but a quarter of the outline at 1 px, and
 * too thin to find the house by; `scripts/highlight-outline-width.mjs`). Linear in the camera's distance to the
 * building's centre from `OUTLINE_NEAR_M` to `OUTLINE_FAR_M`, clamped. Per building, so one outline is one width.
 */
export const OUTLINE_FAR_PX = 3.5;
export const OUTLINE_NEAR_M = 100;
export const OUTLINE_FAR_M = 300;

/** Outline width (CSS px) at a camera distance (metres) from the building's centre. */
export function outlineWidthPx(distanceM: number, nearPx = OUTLINE_PX, farPx = OUTLINE_FAR_PX): number {
  const t = Math.min(1, Math.max(0, (distanceM - OUTLINE_NEAR_M) / (OUTLINE_FAR_M - OUTLINE_NEAR_M)));
  return nearPx + (farPx - nearPx) * (Number.isFinite(t) ? t : 0);
}
/**
 * Small-target boost (style a). The chase sheets of 2026-10-13 found an ordinary 6 m terrace house at 213 m carrying
 * 0.08 % accent pixels against 0.55 % under the old yellow: outline, ring and beacon are too thin for a footprint of
 * ~0.2 % of the frame. Under `SMALL_TARGET_SHARE` of the frame the boost is full; it fades out (smoothstep) by
 * `SMALL_TARGET_FADE_SHARE`. The share is the footprint's equivalent circle (radius √(area/π)) at its on-screen
 * scale: π r_px² / frame area.
 */
export const SMALL_TARGET_SHARE = 0.02; // integrator 2026-10-14: 1 % left the Westermarkt block (2.6 %) and the terrace at the edge (1.04 %) unboosted
export const SMALL_TARGET_FADE_SHARE = 0.04;
/**
 * Roof wash opacity at full boost (the accent over the roof's own colour, unlit). Measured at the Oud-West terrace
 * (chase, default frame, dark slate roof; accent pixels = RGB distance < 60 of the coral): 0.55 → 0.13 %, 0.65 →
 * 0.15 %, 0.70 → 0.22 %, 0.75 → 0.69 % of the frame. Below ~0.75 a dark roof reads as rust rather than the accent.
 */
export const ROOF_WASH_ALPHA = 0.75;
/** Faces whose normal is at least this far up (cos of the slope from vertical: ~70° roofs and flatter) are roof. */
export const ROOF_WASH_MIN_UP = 0.35;
/** The page's current boost weight (0..1), written by the marker each frame and read by the roof-wash passes. */
export const HIGHLIGHT_BOOST_GLOBAL = '__canalRecallHighlightBoost';

/** Share of the frame covered by a footprint of `radiusPx` (equivalent circle) in a `width` × `height` frame. */
export function footprintShare(radiusPx: number, width: number, height: number): number {
  const area = width * height;
  return area > 0 && Number.isFinite(radiusPx) && radiusPx > 0 ? (Math.PI * radiusPx * radiusPx) / area : 0;
}

/**
 * The small-target boost at a footprint share: `weight` 1 at or under `SMALL_TARGET_SHARE`, 0 at or over
 * `SMALL_TARGET_FADE_SHARE` (smoothstep between); `shortfall` how far under `SMALL_TARGET_SHARE` (0..1). An unknown
 * share (0: no footprint, off screen) gives no boost.
 */
export function smallTargetBoost(share: number): { share: number; weight: number; shortfall: number } {
  if (!(share > 0) || !Number.isFinite(share)) return { share: 0, weight: 0, shortfall: 0 };
  const t = Math.min(1, Math.max(0, (share - SMALL_TARGET_SHARE) / (SMALL_TARGET_FADE_SHARE - SMALL_TARGET_SHARE)));
  return { share, weight: 1 - t * t * (3 - 2 * t), shortfall: Math.min(1, Math.max(0, 1 - share / SMALL_TARGET_SHARE)) };
}

/** The boost weight the marker last published (0 when none). */
export function currentBoostWeight(): number {
  const v = Number((globalThis as any)[HIGHLIGHT_BOOST_GLOBAL]);
  return Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0;
}

/**
 * The boost with hysteresis (ride review 2026-10-14, J2). Coming from a small target the weight fades over
 * [`SMALL_TARGET_SHARE`, `SMALL_TARGET_FADE_SHARE`] as before; once the share has reached the fade end the target is
 * latched large, and the weight then fades back in only over [`SMALL_TARGET_UNLATCH_SHARE`, `SMALL_TARGET_SHARE`],
 * unlatching at the lower end. Both bands give 0 at the latch and 1 at the unlatch, so the weight never jumps, and a
 * share wobbling around 2–4 % (a model half off the frame edge, a camera easing) cannot flicker the wash on.
 */
export const SMALL_TARGET_UNLATCH_SHARE = 0.01;
export function smallTargetBoostLatched(share: number, latched: boolean): { boost: { share: number; weight: number; shortfall: number }; latched: boolean } {
  const boost = smallTargetBoost(share);
  if (!(share > 0) || !Number.isFinite(share)) return { boost, latched: false };
  const next = latched ? share > SMALL_TARGET_UNLATCH_SHARE : share >= SMALL_TARGET_FADE_SHARE;
  if (!next) return { boost, latched: false };
  const t = Math.min(1, Math.max(0, (share - SMALL_TARGET_UNLATCH_SHARE) / (SMALL_TARGET_SHARE - SMALL_TARGET_UNLATCH_SHARE)));
  return { boost: { ...boost, weight: 1 - t * t * (3 - 2 * t) }, latched: true };
}

/**
 * The highlighted model's own extent on screen (J2: the Westerkerk took the small-target roof wash at 0.42–0.66 while
 * the church filled ~15 % of the frame, because the boost was measured on the focus footprint, the 9.6 m Westertoren
 * polygon). The outline pass of every whole highlighted mesh (landmark GLBs, recipe houses, the marker's hull; not the
 * merged chunks or batched features, whose geometry is the whole tile) leaves its bounding box's eight corners, in CSS
 * pixels, on this global each frame; the marker takes the convex hull of the fresh ones, clipped to the frame.
 */
export const HIGHLIGHT_EXTENT_GLOBAL = '__canalRecallHighlightExtent';
/** Corners older than this (ms) are a model no longer drawn. */
export const EXTENT_FRESH_MS = 250;
export interface ScreenExtent { t: number; points: number[]; behind: boolean; width: number; height: number }
export function extentRegistry(): Map<unknown, ScreenExtent> {
  const g = globalThis as any;
  return g[HIGHLIGHT_EXTENT_GLOBAL] instanceof Map ? g[HIGHLIGHT_EXTENT_GLOBAL] : (g[HIGHLIGHT_EXTENT_GLOBAL] = new Map());
}

/** Convex hull (monotone chain) of [x, y, x, y, …], counter-clockwise in a y-up frame. */
export function convexHull(flat: readonly number[]): [number, number][] {
  const p: [number, number][] = [];
  for (let i = 0; i + 1 < flat.length; i += 2) p.push([flat[i], flat[i + 1]]);
  p.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (p.length < 3) return p;
  const cross = (o: [number, number], a: [number, number], b: [number, number]) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower: [number, number][] = [], upper: [number, number][] = [];
  for (const q of p) { while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], q) <= 0) lower.pop(); lower.push(q); }
  for (const q of [...p].reverse()) { while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], q) <= 0) upper.pop(); upper.push(q); }
  return [...lower.slice(0, -1), ...upper.slice(0, -1)];
}

/** Area of a polygon clipped to [0, w] × [0, h] (Sutherland–Hodgman). */
export function clippedArea(poly: readonly [number, number][], w: number, h: number): number {
  let out = poly.slice();
  const clip = (inside: (q: [number, number]) => boolean, cut: (a: [number, number], b: [number, number]) => [number, number]) => {
    const res: [number, number][] = [];
    for (let i = 0; i < out.length; i++) {
      const a = out[i], b = out[(i + 1) % out.length], ia = inside(a), ib = inside(b);
      if (ia) res.push(a);
      if (ia !== ib) res.push(cut(a, b));
    }
    out = res;
  };
  const at = (a: [number, number], b: [number, number], k: 0 | 1, v: number): [number, number] => { const t = (v - a[k]) / (b[k] - a[k]); return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]; };
  clip(q => q[0] >= 0, (a, b) => at(a, b, 0, 0)); clip(q => q[0] <= w, (a, b) => at(a, b, 0, w));
  clip(q => q[1] >= 0, (a, b) => at(a, b, 1, 0)); clip(q => q[1] <= h, (a, b) => at(a, b, 1, h));
  let area = 0;
  for (let i = 0; i < out.length; i++) { const [x0, y0] = out[i], [x1, y1] = out[(i + 1) % out.length]; area += x0 * y1 - x1 * y0; }
  return Math.abs(area) / 2;
}

/**
 * Share of the frame the highlighted models cover (their boxes' hull, clipped to the frame), from the extents fresh
 * at `now`; 1 when a box reaches behind the camera (the camera is at or in the model); 0 with none.
 */
export function modelScreenShare(extents: Iterable<ScreenExtent>, now: number): number {
  const pts: number[] = [];
  let w = 0, h = 0;
  for (const e of extents) {
    if (now - e.t > EXTENT_FRESH_MS) continue;
    if (e.behind) return 1;
    pts.push(...e.points); w = e.width; h = e.height;
  }
  return pts.length >= 6 && w > 0 && h > 0 ? Math.min(1, clippedArea(convexHull(pts), w, h) / (w * h)) : 0;
}

/** The outline hull sits this far behind the surface along the view ray (mesh units: metres). */
export const OUTLINE_PUSH_M = 0.3;
/** Rim pulse period, seconds; the rim swings between 55 % and 100 % of `RIM_STRENGTH`. */
export const RIM_PULSE_S = 2.4;
export const RIM_STRENGTH = 0.9;
export const RIM_POWER = 2.2;

/** `hidden` attribute values (one protocol for every merged pipeline). */
export const HIDDEN = { drawn: 0, hide: 1, highlight: 2, dim: 3 } as const;

function parseStyle(raw: unknown): HighlightStyle | null {
  if (typeof raw !== 'string') return null;
  const v = raw.trim().toLowerCase();
  if (v === 'a' || v === 'outline') return 'a';
  if (v === 'b' || v === 'rim') return 'b';
  if (v === 'c' || v === 'desaturate') return 'c';
  if (v === 'yellow' || v === '0' || v === 'off' || v === 'old') return 'yellow';
  if (v === 'default') return DEFAULT_HIGHLIGHT_STYLE;
  return null;
}

/** The style when nothing asks for one: a (LOOK §Highlight; the yellow hid the building the player is meant to learn). */
export const DEFAULT_HIGHLIGHT_STYLE: HighlightStyle = 'a';

/** The page's style: window.__canalRecallHighlight, else `?highlight=`, else the default (a). */
export function highlightStyle(search?: string): HighlightStyle {
  try {
    const g = globalThis as any;
    if (search === undefined) {
      const forced = parseStyle(g[HIGHLIGHT_GLOBAL]);
      if (forced) return forced;
    }
    return parseStyle(new URLSearchParams(search ?? g.location?.search ?? '').get(HIGHLIGHT_PARAM)) ?? DEFAULT_HIGHLIGHT_STYLE;
  } catch { return DEFAULT_HIGHLIGHT_STYLE; }
}

export const highlightRecipe = (style: HighlightStyle = highlightStyle()): HighlightRecipe => HIGHLIGHT_RECIPES[style];

/** The accent of the candidates: the coral, or the HUD accent under `?highlightAccent=hud`. Yellow keeps #ffd21f. */
export function highlightAccent(style: HighlightStyle = highlightStyle(), search?: string): string {
  if (style === 'yellow') return HIGHLIGHT_YELLOW;
  try {
    const g = globalThis as any;
    const raw = (search === undefined ? g[HIGHLIGHT_ACCENT_GLOBAL] : undefined) ?? new URLSearchParams(search ?? g.location?.search ?? '').get(HIGHLIGHT_ACCENT_PARAM);
    if (raw === 'hud') return HUD_ACCENT;
    if (typeof raw === 'string' && /^#?[0-9a-f]{6}$/i.test(raw)) return raw.startsWith('#') ? raw : `#${raw}`;
  } catch { /* no window */ }
  return HIGHLIGHT_CORAL;
}

/** Material defines for the page's style (empty for yellow: the programs are the old ones). */
export function highlightDefines(style: HighlightStyle = highlightStyle()): Record<string, string> {
  return HIGHLIGHT_RECIPES[style].keepMaterials ? { HL_KEEP: '' } : {};
}

/**
 * GLSL shared by every building shader that reads `hidden`.
 * `hlState(hidden)`: 0 plain, 1 highlighted, 2 dimmed. `HL_PAINT(state)`: today's yellow branch.
 */
export const HIGHLIGHT_GLSL = /* glsl */ `
#ifdef HL_KEEP
#define HL_PAINT(h) false
#else
#define HL_PAINT(h) ((h) > 0.5 && (h) < 1.5)
#endif
float hlState(float hidden) { return hidden > 2.5 ? 2.0 : (hidden > 1.5 ? 1.0 : 0.0); }
vec3 hlDesat(vec3 c, float h) { return h > 1.5 ? mix(c, vec3(dot(c, vec3(0.2126, 0.7152, 0.0722))), ${DESATURATE_AMOUNT.toFixed(2)}) : c; }`;

// ---------------------------------------------------------------------------
// Geometry helpers (pure)
// ---------------------------------------------------------------------------

export type LngLat = readonly [number, number];
const M_PER_DEG_LAT = 110_540;
export const mPerDegLng = (lat: number) => 111_320 * Math.cos((lat * Math.PI) / 180);

/** Ground distance in metres (equirectangular; exact enough within a few km). */
export function metresBetween(a: LngLat, b: LngLat): number {
  const lat = (a[1] + b[1]) / 2;
  return Math.hypot((a[0] - b[0]) * mPerDegLng(lat), (a[1] - b[1]) * M_PER_DEG_LAT);
}

/** Whether a building at `point` is dimmed around `focus` (style c). */
export const withinDesaturation = (focus: LngLat | null | undefined, point: LngLat, radiusM = DESATURATE_RADIUS_M) =>
  !!focus && metresBetween(focus, point) <= radiusM;

/** Where the highlight is: the card's point, the building ids lit, and (when known) the footprint and its height. */
export interface HighlightFocus {
  lngLat: LngLat;
  ids?: readonly string[];
  /** GeoJSON Polygon / MultiPolygon coordinates (lng/lat rings). */
  polygons?: LngLat[][][];
  /** Roof top, metres above the ground. */
  heightM?: number;
  /**
   * No pipeline outlines this building (MapLibre's fallback extrusions draw it): the marker draws the outline itself,
   * round a prism of the footprint (`HighlightMarker`), with the footprint read from the map's building source
   * (`HULL_SOURCE`) when `polygons` are not given.
   */
  hull?: boolean;
  /** Bottom of the hull, metres above the ground (a building on stilts). */
  baseM?: number;
}

/** The MapLibre source of the fallback extrusions (vector-map.js), keyed by `promoteId: 'id'`. */
export const HULL_SOURCE = 'osm-building-appearance';

/** Centroid (vertex mean of outer rings) of footprint polygons, or null. */
export function footprintCentroid(polygons: readonly (readonly (readonly LngLat[])[])[] | undefined): [number, number] | null {
  let x = 0, y = 0, n = 0;
  for (const polygon of polygons ?? []) for (const [lng, lat] of polygon[0] ?? []) { x += lng; y += lat; n++; }
  return n ? [x / n, y / n] : null;
}

// ---------------------------------------------------------------------------
// Colour-blind check (pure): Machado et al. 2009 full-severity matrices, linear RGB; CIELAB ΔE76.
// ---------------------------------------------------------------------------

export type Vision = 'normal' | 'protan' | 'deutan' | 'tritan';
const CVD: Record<Exclude<Vision, 'normal'>, number[]> = {
  protan: [0.152286, 1.052583, -0.204868, 0.114503, 0.786281, 0.099216, -0.003882, -0.048116, 1.051998],
  deutan: [0.367322, 0.860646, -0.227968, 0.280085, 0.672501, 0.047413, -0.01182, 0.04294, 0.968881],
  tritan: [1.255528, -0.076749, -0.178779, -0.078411, 0.930809, 0.147602, 0.004733, 0.691367, 0.3039],
};
const toLinear = (v: number) => { const c = v / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const toSrgb = (c: number) => 255 * (c <= 0.0031308 ? 12.92 * c : 1.055 * Math.max(0, c) ** (1 / 2.4) - 0.055);

export function simulateVision(rgb: RGB, vision: Vision): RGB {
  if (vision === 'normal') return rgb;
  const m = CVD[vision], l = rgb.map(toLinear);
  return [0, 1, 2].map(r => toSrgb(Math.min(1, Math.max(0, m[r * 3] * l[0] + m[r * 3 + 1] * l[1] + m[r * 3 + 2] * l[2])))) as RGB;
}

export function rgbToLab(rgb: RGB): [number, number, number] {
  const [r, g, b] = rgb.map(toLinear);
  const f = (t: number) => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116);
  const x = f((0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047), y = f(0.2126 * r + 0.7152 * g + 0.0722 * b), z = f((0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883);
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
}

export function deltaE(a: RGB, b: RGB): number {
  const p = rgbToLab(a), q = rgbToLab(b);
  return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
}

/** What an accent must stand apart from on screen: brick, roofs, stucco, street, canal, sky, trees. */
export const HIGHLIGHT_BACKDROPS: Readonly<Record<string, string>> = {
  brick: '#9a5846', darkBrick: '#6e3b2e', pantile: '#a4553a', slate: '#55585c', stucco: '#ded8cb',
  street: '#8f8a83', canal: '#5f7a83', sky: '#c4d0d8', tree: '#5d7a3e',
};

/** Smallest ΔE between the accent and any backdrop, per vision. */
export function accentSeparation(accent: string, backdrops: Readonly<Record<string, string>> = HIGHLIGHT_BACKDROPS): Record<Vision, { min: number; against: string }> {
  const out = {} as Record<Vision, { min: number; against: string }>;
  for (const vision of ['normal', 'protan', 'deutan', 'tritan'] as Vision[]) {
    const a = simulateVision(hexToRgb(accent), vision);
    let min = Infinity, against = '';
    for (const [name, hex] of Object.entries(backdrops)) {
      const d = deltaE(a, simulateVision(hexToRgb(hex), vision));
      if (d < min) { min = d; against = name; }
    }
    out[vision] = { min, against };
  }
  return out;
}

// ---------------------------------------------------------------------------
// three.js: the outline and rim passes, and per-material variants
// ---------------------------------------------------------------------------

const PASS_VERTEX = /* glsl */ `
attribute float hidden;
uniform vec2 hlViewport;
uniform float hlWidthPx;
uniform float hlFarScale;
uniform vec3 hlCentre;
uniform float hlDepthPush;
uniform vec3 hlEye;
varying vec3 vHlPos;
varying vec3 vHlNormal;
void main() {
  vec4 p = vec4(position, 1.0);
  vec3 n = normal;
#ifdef USE_INSTANCING
  p = instanceMatrix * p;
  n = mat3(instanceMatrix) * n;
#endif
  vHlPos = p.xyz;
  vHlNormal = n;
#ifdef HL_MERGED
  if (hidden < 1.5 || hidden > 2.5) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
#endif
#ifdef HL_FEATURE
  // A batched tile (3DBAG detailed mode): only the highlighted feature's vertices.
  if (abs(HL_FEATURE - hlFeatureId) > 0.5) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
#endif
  mat4 mvp = projectionMatrix * modelViewMatrix;
#ifdef HL_OUTLINE
  // Behind the building's own surface (metres along the view ray), so it shows only past the silhouette.
  vec3 away = p.xyz - hlEye;
  if (dot(away, away) > 1e-6) p.xyz += normalize(away) * hlDepthPush;
#endif
  vec4 clip = mvp * p;
#ifdef HL_OUTLINE
  // Screen-space push: along the projected normal and away from the building's projected centre (closes the
  // corners split normals leave open, and serves meshes without normals).
  vec2 dir = vec2(0.0);
  vec4 cn = mvp * vec4(n, 0.0);
  vec2 dn = (cn.xy * clip.w - clip.xy * cn.w) * hlViewport;
  if (dot(dn, dn) > 1e-12) dir += normalize(dn);
  vec4 c4 = vec4(hlCentre, 1.0);
#ifdef USE_INSTANCING
  c4 = instanceMatrix * c4;
#endif
  vec4 cc = mvp * c4;
  if (cc.w > 0.0 && clip.w > 0.0) {
    vec2 dr = (clip.xy / clip.w - cc.xy / cc.w) * hlViewport;
    if (dot(dr, dr) > 1e-6) dir += normalize(dr);
  }
  // Wider far away (outlineWidthPx): by the camera's distance to the building's centre, one width per outline.
  float far = clamp((length(c4.xyz - hlEye) - ${OUTLINE_NEAR_M.toFixed(1)}) / ${(OUTLINE_FAR_M - OUTLINE_NEAR_M).toFixed(1)}, 0.0, 1.0);
  float width = hlWidthPx * mix(1.0, hlFarScale, far);
  if (dot(dir, dir) > 1e-12) clip.xy += normalize(dir) * width * 2.0 / hlViewport * clip.w;
#endif
  gl_Position = clip;
}`;

const PASS_FRAGMENT = /* glsl */ `
uniform vec3 hlAccent;
uniform vec3 hlEye;
uniform float hlTime;
uniform float hlHasNormal;
uniform vec3 hlUp;
uniform float hlWash;
varying vec3 vHlPos;
varying vec3 vHlNormal;
void main() {
#if defined(HL_OUTLINE)
  gl_FragColor = vec4(hlAccent, 1.0);
#elif defined(HL_ROOF)
  // Roof wash: upward faces only (walls keep their own colours). Derived normals have no reliable sign: |up|.
  vec3 n = hlHasNormal > 0.5 ? normalize(vHlNormal) : normalize(cross(dFdx(vHlPos), dFdy(vHlPos)));
  float up = dot(n, hlUp);
  if (hlHasNormal < 0.5) up = abs(up);
  if (up < ${ROOF_WASH_MIN_UP.toFixed(2)} || hlWash <= 0.0) discard;
  gl_FragColor = vec4(hlAccent, hlWash * smoothstep(${ROOF_WASH_MIN_UP.toFixed(2)}, ${(ROOF_WASH_MIN_UP + 0.15).toFixed(2)}, up));
#else
  vec3 n = hlHasNormal > 0.5 ? normalize(vHlNormal) : normalize(cross(dFdx(vHlPos), dFdy(vHlPos)));
  vec3 v = normalize(hlEye - vHlPos);
  float f = pow(1.0 - abs(dot(n, v)), ${RIM_POWER.toFixed(2)});
  float pulse = 0.775 + 0.225 * sin(hlTime * 6.2831853 / ${RIM_PULSE_S.toFixed(2)});
  gl_FragColor = vec4(hlAccent * f * ${RIM_STRENGTH.toFixed(2)} * pulse, 1.0);
#endif
}`;

export type PassKind = 'outline' | 'rim' | 'roof';
/** A feature of a batched mesh (3D Tiles `_feature_id_N`): the float vertex attribute and the feature's id. */
export interface FeatureSelector { attribute: string; id: number }

export interface PassOptions {
  /** Merged mesh: draw only `hidden == 2` vertices. */
  merged?: boolean;
  /** Batched mesh: draw only this feature's vertices. */
  feature?: FeatureSelector | null;
  /** Centre of the highlighted building in the mesh's (pre-instance) space; default the geometry's bounding-box centre. */
  centre?: readonly [number, number, number] | null;
  style?: HighlightStyle;
  accent?: string;
  /**
   * Up in the mesh's world space (after `matrixWorld`) when that world is in metres; a Mercator world (scale < 1e-3)
   * is always +z up. Default +z (the three.js city, the marker); glTF worlds (landmark models in the default frame,
   * building types) pass +y.
   */
  up?: readonly [number, number, number];
}

const PASS_TAG = 'canalRecallHighlightPass';
/**
 * Measurement override: a fixed outline width in CSS px at every distance (`window.__canalRecallHighlightOutlinePx`;
 * 0 hides the outline, `2` is the width before the distance rule).
 */
export const OUTLINE_PX_GLOBAL = '__canalRecallHighlightOutlinePx';
function forcedOutlinePx(): number | null {
  const raw = (globalThis as any)[OUTLINE_PX_GLOBAL];
  const forced = raw == null || raw === '' ? NaN : Number(raw);
  return Number.isFinite(forced) && forced >= 0 ? forced : null;
}
/** Linear RGB of an sRGB hex (three's ShaderMaterial output is written as-is, so the accent stays sRGB). */
const accentVector = (THREE: any, hex: string) => { const [r, g, b] = hexToRgb(hex); return new THREE.Vector3(r / 255, g / 255, b / 255); };

/** One pass material (per pass mesh: its uniforms are per object). */
export function createHighlightPassMaterial(THREE: any, kind: PassKind, options: { merged?: boolean; accent?: string; feature?: FeatureSelector | null } = {}): any {
  const defines: Record<string, string> = {};
  if (options.merged) defines.HL_MERGED = '';
  if (kind === 'outline') defines.HL_OUTLINE = '';
  if (kind === 'roof') defines.HL_ROOF = '';
  let vertexShader = PASS_VERTEX;
  if (options.feature) {
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(options.feature.attribute)) throw new Error(`highlight: bad feature attribute ${options.feature.attribute}`);
    defines.HL_FEATURE = options.feature.attribute;
    vertexShader = `attribute float ${options.feature.attribute};\nuniform float hlFeatureId;\n${PASS_VERTEX}`;
  }
  const material = new THREE.ShaderMaterial({
    defines,
    uniforms: {
      hlViewport: { value: new THREE.Vector2(1, 1) },
      hlWidthPx: { value: OUTLINE_PX },
      hlFarScale: { value: OUTLINE_FAR_PX / OUTLINE_PX },
      hlCentre: { value: new THREE.Vector3() },
      hlDepthPush: { value: OUTLINE_PUSH_M },
      hlAccent: { value: accentVector(THREE, options.accent ?? highlightAccent()) },
      hlEye: { value: new THREE.Vector3() },
      hlTime: { value: 0 },
      hlHasNormal: { value: 1 },
      hlFeatureId: { value: options.feature?.id ?? 0 },
      hlUp: { value: new THREE.Vector3(0, 0, 1) },
      hlWash: { value: 0 },
    },
    vertexShader,
    fragmentShader: PASS_FRAGMENT,
    // Outline: the inverted hull (back faces only), so a wall seen at a grazing angle is never painted over.
    side: kind === 'outline' ? THREE.BackSide : THREE.FrontSide,
    transparent: true,
    depthTest: true,
    // The outline keeps its pixels against anything drawn later behind it; the rim only adds light.
    depthWrite: kind === 'outline',
    blending: kind === 'rim' ? THREE.AdditiveBlending : THREE.NormalBlending,
    polygonOffset: kind !== 'outline',
    polygonOffsetFactor: -1,
    polygonOffsetUnits: kind === 'roof' ? -4 : -2,
  });
  material.name = `highlight/${kind}${options.merged ? '/merged' : ''}`;
  material.userData = { [PASS_TAG]: true };
  material.defaultAttributeValues = { hidden: [0], normal: [0, 0, 0] };
  return material;
}

/** Leave a whole mesh's box corners on screen (CSS px) in the extent registry (`modelScreenShare`). `mvp`: mesh → clip. */
function recordExtent(pass: any, mvp: any, renderer: any, size: any): void {
  const box = pass.geometry?.boundingBox, e = mvp.elements;
  if (!box) return;
  const css = renderer.domElement, width = css?.clientWidth || size.x, height = css?.clientHeight || size.y, points: number[] = [];
  let behind = false;
  for (let k = 0; k < 8; k++) {
    const x = k & 1 ? box.max.x : box.min.x, y = k & 2 ? box.max.y : box.min.y, z = k & 4 ? box.max.z : box.min.z;
    const cx = e[0] * x + e[4] * y + e[8] * z + e[12], cy = e[1] * x + e[5] * y + e[9] * z + e[13], w = e[3] * x + e[7] * y + e[11] * z + e[15];
    if (!(w > 1e-9)) { behind = true; break; }
    points.push((cx / w + 1) / 2 * width, (1 - cy / w) / 2 * height);
  }
  extentRegistry().set(pass, { t: performance.now(), points, behind, width, height });
}

/** Remove the passes `attachHighlightPasses` added under `mesh`. */
export function detachHighlightPasses(mesh: any): void {
  for (const pass of mesh?.userData?.[PASS_TAG] ?? []) { mesh.remove(pass); pass.material.dispose(); extentRegistry().delete(pass); }
  if (mesh?.userData) delete mesh.userData[PASS_TAG];
}

/**
 * World up for the landmark GLBs' passes (`PassOptions.up`), by how signature-landmarks draws them. The shared frame
 * puts each Mercator holder under a root its frame maps to east/north/up metres: up is +z. Both legacy layers draw a
 * y-up world (a per-model scene in glTF space, the transform baked into the camera; the batched scene's
 * `anchorWorldFromMercator` sends altitude to +y): up is +y. Ride review 2026-10-14: the landmark layer passed +y in
 * the shared frame too, so the roof wash read north as up and painted the Westerkerk's walls orange while its card was
 * open (hlUp [-0.06, 0, -1] in glTF space; the roofs stayed slate).
 */
export const LANDMARK_WORLD_UP = { shared: [0, 0, 1], legacy: [0, 1, 0] } as const satisfies Record<string, readonly [number, number, number]>;

/**
 * Add the style's passes as children of `mesh` (sharing geometry; instanced meshes share instance matrices).
 * Idempotent; no passes for styles without outline/rim. Returns the pass meshes.
 */
export function attachHighlightPasses(THREE: any, mesh: any, options: PassOptions = {}): any[] {
  detachHighlightPasses(mesh);
  const recipe = HIGHLIGHT_RECIPES[options.style ?? highlightStyle()];
  // The roof wash needs a known up: not on a batched 3D Tiles feature (3DBAG detailed mode, frame unverified).
  const kinds: PassKind[] = [...(recipe.outline ? ['outline' as const] : []), ...(recipe.rim ? ['rim' as const] : []),
    ...(recipe.wash && !options.feature ? ['roof' as const] : [])];
  if (!kinds.length || !mesh?.geometry) return [];
  const geometry = mesh.geometry;
  let centre = options.centre;
  if (!centre) {
    if (!geometry.boundingBox) geometry.computeBoundingBox?.();
    const c = geometry.boundingBox?.getCenter(new THREE.Vector3());
    centre = c ? [c.x, c.y, c.z] : [0, 0, 0];
  }
  const hasNormal = geometry.getAttribute?.('normal') ? 1 : 0;
  const passes: any[] = [];
  const mvp = new THREE.Matrix4(), eye = new THREE.Vector4(), size = new THREE.Vector2(), toMesh = new THREE.Matrix3(), scale = new THREE.Vector3();
  const metreUp = options.up ?? [0, 0, 1];
  // Whole meshes only: a merged chunk's or a batched tile's box is the whole tile, not the building (J2).
  const measureExtent = !options.merged && !options.feature && !mesh.isInstancedMesh;
  if (measureExtent && !geometry.boundingBox) geometry.computeBoundingBox?.();
  for (const kind of kinds) {
    const material = createHighlightPassMaterial(THREE, kind, { merged: options.merged, feature: options.feature, accent: options.accent ?? highlightAccent(options.style) });
    material.uniforms.hlCentre.value.set(centre[0], centre[1], centre[2]);
    material.uniforms.hlHasNormal.value = hasNormal;
    const pass = mesh.isInstancedMesh ? new THREE.InstancedMesh(geometry, material, mesh.count) : new THREE.Mesh(geometry, material);
    if (mesh.isInstancedMesh) pass.instanceMatrix = mesh.instanceMatrix;
    pass.name = `${mesh.name || 'mesh'}/highlight-${kind}`;
    pass.frustumCulled = false;
    pass.castShadow = pass.receiveShadow = false;
    pass.renderOrder = (mesh.renderOrder ?? 0) + 1;
    pass.raycast = () => {};
    if (kind === 'roof') {
      // Drawn only while the marker publishes a boost: no draw call for a large building.
      Object.defineProperty(pass, 'visible', { get: () => mesh.visible && currentBoostWeight() > 0.001, set: () => {}, configurable: true });
    }
    pass.onBeforeRender = (renderer: any, _scene: any, camera: any) => {
      if (mesh.isInstancedMesh) pass.count = mesh.count;
      if (kind !== 'roof') pass.visible = mesh.visible;
      const u = material.uniforms;
      if (kind === 'roof') {
        // Up in the pass's own space: N_world ∝ M⁻ᵀ n, so n · M⁻¹ up is the world up component.
        toMesh.setFromMatrix4(pass.matrixWorld);
        scale.setFromMatrixColumn(pass.matrixWorld, 0);
        const up = scale.length() < 1e-3 ? [0, 0, 1] : metreUp;
        u.hlUp.value.set(up[0], up[1], up[2]).applyMatrix3(toMesh.invert()).normalize();
        u.hlWash.value = ROOF_WASH_ALPHA * currentBoostWeight();
      }
      renderer.getDrawingBufferSize(size);
      u.hlViewport.value.copy(size);
      const css = renderer.domElement?.clientWidth || size.x;
      const forced = forcedOutlinePx();
      u.hlWidthPx.value = (forced ?? OUTLINE_PX) * (size.x / css);
      u.hlFarScale.value = forced == null ? OUTLINE_FAR_PX / OUTLINE_PX : 1;
      // The eye in the mesh's space: the point clip space sends to w = 0 (works for MapLibre's baked projection too).
      mvp.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse).multiply(pass.matrixWorld);
      if (kind === 'outline' && measureExtent) recordExtent(pass, mvp, renderer, size);
      mvp.invert();
      eye.set(0, 0, 1, 0).applyMatrix4(mvp);
      if (Math.abs(eye.w) > 1e-12) u.hlEye.value.set(eye.x / eye.w, eye.y / eye.w, eye.z / eye.w);
      u.hlTime.value = performance.now() / 1000;
      material.uniformsNeedUpdate = true;
    };
    mesh.add(pass);
    passes.push(pass);
  }
  mesh.userData ??= {};
  mesh.userData[PASS_TAG] = passes;
  return passes;
}

const variantCache = new WeakMap<any, Map<string, any>>();

/**
 * The variant of a whole-mesh material for a highlight state: `highlight` (yellow under the yellow style, the
 * material itself otherwise) or `dim` (a desaturated clone). City-look materials are handled by the caller
 * (`CityLook.highlighted` / `dimmed`), since they are shared variants with their own defines.
 */
export function highlightMaterialFor(THREE: any, material: any, state: 'plain' | 'highlight' | 'dim', style: HighlightStyle = highlightStyle()): any {
  if (!material || state === 'plain') return material;
  if (state === 'highlight' && HIGHLIGHT_RECIPES[style].keepMaterials) return material;
  let cache = variantCache.get(material);
  if (!cache) variantCache.set(material, cache = new Map());
  const key = `${state}|${style}`;
  let out = cache.get(key);
  if (out) return out;
  if (state === 'highlight') {
    // Yellow on a material that has no emissive: a plain Lambert in today's colours (tileBuildings did the same).
    out = new THREE.MeshLambertMaterial({ color: 0xffd21f, emissive: 0x6b5400, side: material.side ?? THREE.FrontSide });
  } else if (material.isShaderMaterial && material.uniforms?.tint?.value?.isVector3) {
    // Recipe look: per-material tint uniform; shared textures and frame stay shared.
    out = material.clone();
    out.uniforms = { ...material.uniforms, tint: { value: desatVector(material.uniforms.tint.value.clone()) } };
  } else if (material.isShaderMaterial) {
    out = material.clone();
    out.uniforms = material.uniforms;
    out.defines = { ...(material.defines ?? {}), HL_DIM_ALL: '' };
  } else {
    out = material.clone();
    if (out.color) { const c = out.color; const l = 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b; c.setRGB(c.r + (l - c.r) * DESATURATE_AMOUNT, c.g + (l - c.g) * DESATURATE_AMOUNT, c.b + (l - c.b) * DESATURATE_AMOUNT); }
    if (out.map) {
      // Textured: desaturate the sampled colour too.
      const previous = out.onBeforeCompile;
      out.onBeforeCompile = (shader: any, renderer: any) => {
        previous?.call(out, shader, renderer);
        shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
diffuseColor.rgb = mix(diffuseColor.rgb, vec3(dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722))), ${DESATURATE_AMOUNT.toFixed(2)});`);
      };
      out.customProgramCacheKey = () => `${material.customProgramCacheKey?.() ?? ''}|hl-dim`;
    }
  }
  out.name = `${material.name || 'material'}/${state}`;
  out.userData = { ...(material.userData ?? {}), highlightVariantOf: material };
  cache.set(key, out);
  return out;
}

function desatVector(v: any): any {
  const l = 0.2126 * v.x + 0.7152 * v.y + 0.0722 * v.z;
  return v.set(v.x + (l - v.x) * DESATURATE_AMOUNT, v.y + (l - v.y) * DESATURATE_AMOUNT, v.z + (l - v.z) * DESATURATE_AMOUNT);
}

/** The base material behind a variant (identity for a base). */
export const baseMaterialOf = (material: any) => material?.userData?.highlightVariantOf ?? material;

/**
 * Apply a whole-mesh highlight state to every mesh under `root` (landmark entries, recipe houses, highlight copies):
 * swap materials to the state's variant (via `cityVariant` for city-look materials) and attach or drop the passes.
 * Arrays of materials are mapped element-wise; passes need a single geometry, so they attach per mesh either way.
 */
export function applyMeshHighlight(THREE: any, root: any, state: 'plain' | 'highlight' | 'dim', options: {
  style?: HighlightStyle;
  /** City look's own variants (`CityLook.highlighted` / `dimmed`), for materials carrying `userData.cityLook`. */
  cityVariant?: (material: any, state: 'plain' | 'highlight' | 'dim') => any;
  /** Up in a metre world (`PassOptions.up`): +y for glTF models drawn in their own frame. */
  up?: readonly [number, number, number];
} = {}): void {
  const style = options.style ?? highlightStyle();
  const meshes: any[] = [];
  root.traverse((child: any) => { if (child.isMesh && child.material && !child.material.userData?.[PASS_TAG]) meshes.push(child); });
  for (const child of meshes) {
    const swap = (m: any) => {
      if (m?.userData?.[PASS_TAG]) return m;
      if (m?.userData?.cityLook && options.cityVariant) return options.cityVariant(m, state);
      return highlightMaterialFor(THREE, baseMaterialOf(m), state, style);
    };
    child.material = Array.isArray(child.material) ? child.material.map(swap) : swap(child.material);
    if (state === 'highlight') attachHighlightPasses(THREE, child, { style, up: options.up });
    else detachHighlightPasses(child);
  }
}

/** Centre (bounding-box centre, mesh space) of one feature's vertices in a batched mesh, or null if it has none. */
export function featureCentre(geometry: any, feature: FeatureSelector): [number, number, number] | null {
  const ids = geometry?.getAttribute?.(feature.attribute), position = geometry?.getAttribute?.('position');
  if (!ids || !position) return null;
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < position.count; i++) {
    if (Math.abs(ids.getX(i) - feature.id) > 0.5) continue;
    const v = [position.getX(i), position.getY(i), position.getZ(i)];
    for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], v[k]); hi[k] = Math.max(hi[k], v[k]); }
  }
  return lo[0] <= hi[0] ? [(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, (lo[2] + hi[2]) / 2] : null;
}

/**
 * The highlight on one feature of a batched mesh (3DBAG detailed mode, `detailed-buildings-source.js`): the mesh
 * keeps its materials and gets the style's passes restricted to the feature. Returns false for the yellow style
 * (the caller keeps its own yellow tint) or when the feature is not in the mesh; `detachHighlightPasses` clears it.
 */
export function highlightFeature(THREE: any, mesh: any, feature: FeatureSelector, style: HighlightStyle = highlightStyle()): boolean {
  if (!HIGHLIGHT_RECIPES[style].keepMaterials) return false;
  const centre = featureCentre(mesh?.geometry, feature);
  if (!centre) return false;
  attachHighlightPasses(THREE, mesh, { feature, centre, style });
  return true;
}
