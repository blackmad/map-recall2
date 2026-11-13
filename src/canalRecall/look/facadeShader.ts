/**
 * The parametric facade shader (F1 S4, issue #380; docs/plans/facade-f1-design-20261112.md §3).
 *
 * A record mesh (SHEL level 3 / a record-mode chunk) carries, per vertex, its wall metres (`wall`: u along the run, v
 * above the pand's wall base, the run's length), the record it draws from (`rec`) and how (`wallKind`). The fragment
 * shader fetches the pand's 64-byte record (look/facadeRecord.ts) from one city-wide RGBA32UI texture (4 texelFetch, the
 * same row for every fragment of a pand), lays storeys and bays out in metres and draws wall, openings, frame and glass,
 * the door, and flat roofs. Every edge is box-filtered over the pixel footprint (`fwidth` of the wall metres), so an edge
 * is as wide on screen as the pixels it covers at any distance, as `look/windowSdf.ts` does in canvas pixels.
 *
 * v1 (S4): walls, storeys, bays, one window per bay with its head (flat, segmental, round, relieving drawn flat), frame
 * and glass, the door, roofs flat. Brick coursing, bands, accents, reveals and the ground band follow in S6.
 *
 * The GLSL unpack is generated from `FACADE_FIELDS`, so the shader reads exactly the bytes the packer writes.
 * Flag: `?shaderFacades=1|0`, `window.__canalRecallShaderFacades`; off on desktop and touch until the §6 gates pass.
 */
import { FACADE_FIELDS, FACADE_RECORDS_PER_ROW, FACADE_WINDOW_PITCH_M } from './facadeRecord.ts';
import { FACADE_STYLES } from '../genericFacades.ts';
import { GLASS_STOPS } from './windowSdf.ts';
import { BRICK_CELL_MEAN } from './palette.ts';

export const SHADER_FACADES_PARAM = 'shaderFacades';
export const SHADER_FACADES_DESKTOP_DEFAULT = false;
export const SHADER_FACADES_TOUCH_DEFAULT = false;

/** The record path is drawn: `?shaderFacades=1|0` wins, then `window.__canalRecallShaderFacades`, then the device default. */
export function shaderFacadesEnabled(touch = false, search?: string | null, global?: Record<string, unknown> | null): boolean {
  const g = global ?? (globalThis as Record<string, unknown>);
  const s = search ?? ((g.location as { search?: string } | undefined)?.search ?? '');
  const q = new RegExp(`[?&]${SHADER_FACADES_PARAM}=([01])\\b`).exec(s)?.[1];
  if (q) return q === '1';
  const w = g.__canalRecallShaderFacades;
  if (typeof w === 'boolean') return w;
  return touch ? SHADER_FACADES_TOUCH_DEFAULT : SHADER_FACADES_DESKTOP_DEFAULT;
}

const f1 = (v: number) => (Number.isInteger(v) ? v.toFixed(1) : String(v));
const hexV3 = (hex: string) => `vec3(${[1, 3, 5].map(i => (parseInt(hex.slice(i, i + 2), 16) / 255).toFixed(5)).join(', ')})`;

/** GLSL: `frField_<name>()` reads of every record field from the four fetched texels `frT0..3` (generated from the table). */
function fieldAccessors(): string {
  const byte = (b: number) => `((frT${b >> 4}[${(b >> 2) & 3}] >> ${(b & 3) * 8}u) & 255u)`;
  return FACADE_FIELDS.map(x => {
    if (x.kind === 'rgb') return `vec3 fr_${x.name}() { return vec3(float(${byte(x.byte)}), float(${byte(x.byte + 1)}), float(${byte(x.byte + 2)})) / 255.0; }`;
    if (x.kind === 'u16') return `float fr_${x.name}() { return float(${byte(x.byte)} | (${byte(x.byte + 1)} << 8u)); }`;
    if (x.kind === 'u8') return `float fr_${x.name}() { return float(${byte(x.byte)}); }`;
    return `float fr_${x.name}() { return float((${byte(x.byte)} >> ${x.bit}u) & ${(1 << x.width!) - 1}u); }`;
  }).join('\n');
}

/** Window pitch per FACADE_STYLES index (the record's `style`), for walls no source counts (baysUpper 0). */
const PITCH_GLSL = `float frPitch(float style) { ${FACADE_STYLES.map((s, i) => `if (style < ${f1(i + 0.5)}) return ${f1(FACADE_WINDOW_PITCH_M[s])};`).join(' ')} return 2.0; }`;

/**
 * The wall's mean against its colour. Integrator ruling (#380, 2026-11-12, the user's correctness-first rule): the record
 * wall is the measured colour itself (1.0 x wallHex), not the atlas brick cell's mean (BRICK_CELL_MEAN, 0.88), even where
 * the city then reads lighter than the atlas path; the atlas parity is a reported number (facadeTwin.test.ts), not a gate.
 */
export const FACADE_WALL_MEAN = 1;
/** The atlas wall's mean against its colour, for the parity report. */
export const ATLAS_WALL_MEAN = BRICK_CELL_MEAN;
/** Brick coursing (S6): a Dutch waalformaat course (50 mm brick + 12.5 mm joint) and a 220 mm stretcher. */
export const FR_COURSE = 0.0625, FR_BRICK = 0.22, FR_JOINT = 0.012, FR_MORTAR = 1.35, FR_TONE = 0.14;
const JOINT_SHARE = FR_JOINT / FR_COURSE + FR_JOINT / FR_BRICK - (FR_JOINT / FR_COURSE) * (FR_JOINT / FR_BRICK);
/** Mean of the coursing before normalising: joints at FR_MORTAR, bricks at 1 (their hash tone averages 1). */
export const FR_PATTERN_MEAN = JOINT_SHARE * FR_MORTAR + (1 - JOINT_SHARE);
/** Coursing amplitude by FACADE_WALL_MATERIALS index: brick full, painted brick faint, the rest smooth. */
export const FR_COURSING = [1, 0, 0.35, 0, 0, 0, 0] as const;
/**
 * Brick patches (S6c): a tone per brick length x two courses (0.22 x 0.125 m, offset every patch row), FR_MOTTLE deep, fading
 * between 0.3 and 0.5 of a patch row per pixel. The coursing fades out under about two pixels a course (ppm < 27, the
 * benchmark median), and then the wall reads as render: F4 round 1 named "brick vs render" on 32 pairs (11 in round 0).
 * Measured with scripts/house-frames/brick-texture.ts (detail std over the mean, 0.25 m running mean removed), the photos'
 * medians are 0.066 under 25 px/m, 0.131 at 25-40, 0.147 at 40-60 and 0.157 above. Round 1's frames read 0.064, 0.078,
 * 0.110 and 0.100. With the frame's other detail (base about 0.065-0.078, in quadrature), the patches must supply about
 * 0.10 at 30 px/m and 0.13 at 50. The twin with FR_MOTTLE 0.6 gives 0.066 / 0.112 / 0.116 / 0.146 / 0.161 at
 * 20 / 27 / 35 / 50 / 70 px/m.
 */
export const FR_MOTTLE = 0.9, FR_MOTTLE_V = 0.125, FR_MOTTLE_U = 0.22;
/**
 * The patch fade, in patch rows per pixel. S7a (#380) raised FR_MOTTLE from 0.6 to 0.9 after round 3 measured the GPU
 * frames against the photos at W1's wall colours. The texture by px/m was:
 *  - photos 0.071 / 0.123 / 0.147 / 0.157 (under 25 / 25-40 / 40-60 / over 60 px/m);
 *  - round 3 0.040 / 0.075 / 0.108 / 0.129.
 * Round 2 read 0.094 / 0.119 / 0.146 / 0.153, but only because the period walls it drew were near-black (#4c1f0f). In
 * every render path, the atlas included, the frame's detail over its mean is two to three times larger on such a wall
 * (172590 with the flag off: 0.44 at #4c1f0f, 0.17 at #925441). The S6c calibration had banked on that dark-wall detail,
 * and W1's measured walls took it away. It was not a W1 code path: the record differs only in `wall`.
 * The frames read about 0.6-0.85 of the twin's number (more at higher px/m). The twin at 0.9 gives 0.098 / 0.169 / 0.172 /
 * 0.195 / 0.209 at 20 / 27 / 35 / 50 / 70 px/m. A wider fade overshot the photos under 25 px/m in the twin.
 */
export const FR_MOTTLE_FADE = [0.3, 0.5] as const;

/**
 * Glazing per window kind (intent.ts WINDOWS order): lower part cols x rows, toplight cols x rows, toplight share of the
 * opening's height (0: no transom). S6b's reading of each kind's name; a kind the table draws wrongly is a one-row fix.
 */
export const FACADE_PANES: readonly (readonly [number, number, number, number, number])[] = [
  [1, 2, 0, 0, 0], [3, 4, 0, 0, 0], [2, 2, 0, 0, 0], [1, 1, 0, 0, 0], [2, 1, 0, 0, 0], [1, 1, 0, 0, 0], [2, 1, 0, 0, 0], [1, 5, 0, 0, 0],
  [3, 4, 0, 0, 0], [4, 4, 0, 0, 0], [3, 6, 0, 0, 0], [2, 3, 0, 0, 0], [2, 1, 1, 1, 0.3], [1, 1, 4, 1, 0.3], [2, 1, 2, 1, 0.3], [2, 1, 1, 1, 0.25],
  [2, 1, 2, 1, 0.25], [2, 1, 4, 2, 0.3], [3, 1, 3, 1, 0.25], [2, 1, 2, 1, 0.25], [2, 1, 6, 2, 0.3], [2, 1, 0, 0, 0], [2, 4, 0, 0, 0], [3, 1, 1, 1, 0.25],
];
/** Glazing bar width (m), the reveal's shadow share of its depth, the eaves cornice band height (m) by CORNICES index. */
export const FR_BAR = 0.04, FR_REVEAL_SHADE = 0.45, FR_CORNICE_M = [0, 0.25, 0.4, 0.55, 0.5] as const;
const vec4s = (rows: readonly (readonly number[])[]) => rows.map(r => `vec4(${r.map(f1).join(', ')})`).join(', ');

const SURFACE_GLSL = /* glsl */ `
const vec4 FR_PANES[${FACADE_PANES.length}] = vec4[${FACADE_PANES.length}](${vec4s(FACADE_PANES.map(r => r.slice(0, 4)))});
const float FR_PANE_TOP[${FACADE_PANES.length}] = float[${FACADE_PANES.length}](${FACADE_PANES.map(r => f1(r[4])).join(', ')});
// Bars dividing [a, b] into n parts (n - 1 bars of FR_BAR), box-filtered; their area share once a part is under a pixel.
float frBars(float x, float a, float b, float n, float fw) {
  if (n < 1.5) return 0.0;
  float part = (b - a) / n, t = (x - a) / part, d = abs(t - floor(t + 0.5)) * part;
  if (t < 0.5 || t > n - 0.5) return 0.0;
  float c = clamp(0.5 + (${f1(FR_BAR / 2)} - d) / fw, 0.0, 1.0);
  return mix(c, ${f1(FR_BAR)} / part, smoothstep(0.5 * part, part, fw));
}
// Glazing bars of a window kind over the pane [x0, x1] x [y0, y1]; a transom bar under the toplight.
float frGlazing(vec2 p, vec2 fw, float x0, float x1, float y0, float y1, float kind) {
  int k = int(clamp(kind, 0.0, ${f1(FACADE_PANES.length - 1)}) + 0.5);
  vec4 g = FR_PANES[k]; float top = FR_PANE_TOP[k];
  float split = top > 0.0 ? y1 - (y1 - y0) * top : y1;
  float c;
  if (p.y < split) c = max(frBars(p.x, x0, x1, g.x, fw.x), frBars(p.y, y0, split, g.y, fw.y));
  else c = max(frBars(p.x, x0, x1, g.z, fw.x), frBars(p.y, split, y1, g.w, fw.y));
  if (top > 0.0) c = max(c, frCover(p.y, split - ${f1(FR_BAR / 2)}, split + ${f1(FR_BAR / 2)}, fw.y));
  return c;
}
// The reveal's shadow on the glass: a strip along the head and the left jamb as deep as the reveal (sun from the upper left).
float frReveal(vec2 p, vec2 fw, float x0, float y1, float depth) {
  return max(frCover(p.x, x0, x0 + depth, fw.x), frCover(p.y, y1 - depth, y1, fw.y)) * ${f1(FR_REVEAL_SHADE)};
}
float frHash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
// Brick coursing, mean 1 over the wall; it fades to its mean as a course falls under about two pixels. Brick patches
// (two bricks x two courses) carry the brick's texture further out (FR_MOTTLE, S6c).
float frBrick(vec2 w, vec2 fw, float material, float contrast) {
  float amp = material < 0.5 ? ${f1(FR_COURSING[0])} : (material > 1.5 && material < 2.5 ? ${f1(FR_COURSING[2])} : 0.0);
  if (amp <= 0.0) return 1.0;
  float prow = floor(w.y / ${f1(FR_MOTTLE_V)}), pcol = floor((w.x + mod(prow, 2.0) * ${f1(0.5 * FR_MOTTLE_U)}) / ${f1(FR_MOTTLE_U)});
  float brickPatch = 1.0 + amp * contrast * ${f1(FR_MOTTLE)} * (frHash(vec2(prow * 7.0 + 3.0, pcol * 3.0 + 11.0)) - 0.5)
    * (1.0 - smoothstep(${f1(FR_MOTTLE_FADE[0] * FR_MOTTLE_V)}, ${f1(FR_MOTTLE_FADE[1] * FR_MOTTLE_V)}, max(fw.x, fw.y)));
  amp *= contrast * (1.0 - smoothstep(${f1(0.25 * FR_COURSE)}, ${f1(0.6 * FR_COURSE)}, max(fw.x, fw.y)));
  if (amp <= 0.0) return brickPatch;
  float row = floor(w.y / ${f1(FR_COURSE)}), yy = w.y - row * ${f1(FR_COURSE)};
  float x = w.x + mod(row, 2.0) * ${f1(0.5 * FR_BRICK)}, col = floor(x / ${f1(FR_BRICK)}), xx = x - col * ${f1(FR_BRICK)};
  float joint = max(1.0 - frCover(yy, ${f1(FR_JOINT)}, ${f1(FR_COURSE)}, fw.y), 1.0 - frCover(xx, ${f1(FR_JOINT)}, ${f1(FR_BRICK)}, fw.x));
  float tone = 1.0 + (frHash(vec2(row, col)) - 0.5) * ${f1(FR_TONE)};
  return brickPatch * (1.0 + amp * (mix(tone, ${f1(FR_MORTAR)}, joint) / ${f1(FR_PATTERN_MEAN)} - 1.0));
}
// Speklagen: spekCourses stone courses every spekSpacing + spekCourses courses, averaged when under a pixel.
float frSpek(float y, vec2 fw) {
  float s = fr_spekSpacing(), n = fr_spekCourses();
  if (s < 0.5 || n < 0.5) return 0.0;
  float per = (s + n) * ${f1(FR_COURSE)}, h = n * ${f1(FR_COURSE)};
  return mix(frCover(mod(y, per), 0.0, h, fw.y), h / per, smoothstep(0.5 * per, per, fw.y));
}
// Band lines of a storey: bandLines (sill 1, transom 2, head 4) when stated, else by the band kind.
float frBandLines(float sv, float sh, float y0, float y1, float storey, vec2 fw) {
  float b = fr_bands();
  if (b < 0.5 || (b > 4.5 && b < 5.5)) return 0.0;
  float l = fr_bandLines();
  // Unstated lines: a storey band (storey, both, courses, painted) is the string course at each upper floor.
  bool floorLine = l < 0.5 && (b < 1.5 || (b > 2.5 && b < 4.5) || b > 5.5);
  bool sill = l > 0.5 && mod(l, 2.0) > 0.5;
  bool transom = l > 0.5 && mod(floor(l / 2.0), 2.0) > 0.5;
  bool head = l > 0.5 ? l > 3.5 : (b > 1.5 && b < 4.5);
  float hs = fr_bandSillCm() * 0.01, hh = fr_bandHeadCm() * 0.01, c = 0.0;
  if (sill && storey > 0.5) c = max(c, frCover(sv, y0 - hs, y0, fw.y));
  if (floorLine && storey > 0.5) c = max(c, frCover(sv, 0.0, hs, fw.y));
  if (head) c = max(c, frCover(sv, y1, y1 + hh, fw.y));
  if (transom) { float t = y0 + (y1 - y0) * fr_bandTransomAt() / 255.0; c = max(c, frCover(sv, t - 0.04, t + 0.04, fw.y)); }
  return c;
}
// The window's stone (WINDOW_SURROUNDS: 1 stone-lintel, 2 full-frame, 3 keystone, 4 sill, 5 eared-keystone; sills, keystone).
float frSurround(vec2 p, vec2 fw, float x0, float x1, float y0, float y1, float head, float rise) {
  float s = fr_surround(), c = 0.0;
  if (s > 0.5 && s < 1.5) c = max(c, frCover(p.x, x0 - 0.08, x1 + 0.08, fw.x) * frCover(p.y, y1, y1 + 0.16, fw.y));
  if ((s > 1.5 && s < 2.5) || s > 4.5) c = max(c, frOpening(p, fw, x0 - 0.09, x1 + 0.09, y0 - 0.09, y1 + 0.09, head, rise) - frOpening(p, fw, x0, x1, y0, y1, head, rise));
  if (fr_sills() > 0.5 || (s > 3.5 && s < 4.5)) c = max(c, frCover(p.x, x0 - 0.06, x1 + 0.06, fw.x) * frCover(p.y, y0 - 0.08, y0, fw.y));
  if (fr_keystone() > 0.5 || (s > 2.5 && s < 3.5) || s > 4.5) { float xc = 0.5 * (x0 + x1); c = max(c, frCover(p.x, xc - 0.09, xc + 0.09, fw.x) * frCover(p.y, y1 - 0.02, y1 + 0.2, fw.y)); }
  return c;
}
// The eaves cornice band: CORNICES height under the wall top, a shadow line under it.
float frCornice(float y, vec2 fw) {
  int k = int(fr_cornice() + 0.5);
  float h = k == 1 ? ${f1(FR_CORNICE_M[1])} : k == 2 ? ${f1(FR_CORNICE_M[2])} : k == 3 ? ${f1(FR_CORNICE_M[3])} : k == 4 ? ${f1(FR_CORNICE_M[4])} : 0.0;
  if (h <= 0.0) return 0.0;
  float top = fr_wallHcm() * 0.01;
  return frCover(y, top - h, top, fw.y);
}
// Quoins: stones 0.25 m high at both ends of a front, alternately 0.45 and 0.3 m deep into the wall.
float frQuoin(vec2 w, float len, vec2 fw) {
  float k = floor(w.y / 0.25), d = mod(k, 2.0) < 0.5 ? 0.45 : 0.3;
  float joint = frCover(w.y - k * 0.25, 0.015, 0.25, fw.y);
  return max(frCover(w.x, 0.0, d, fw.x), frCover(w.x, len - d, len, fw.x)) * joint;
}
`;

/** Vertex declarations and body of the record variant (replace the chunk's layer/tint/accent/uv attributes). */
export const FACADE_RECORD_VERTEX_DECLS = /* glsl */ `
attribute vec3 wall;
attribute float rec;
attribute float wallKind;
uniform float wallUnit;
varying vec3 vWall;
flat varying float vRec;
flat varying float vWallKind;
`;
export const FACADE_RECORD_VERTEX_BODY = /* glsl */ `
vWall = wall * wallUnit; vRec = rec; vWallKind = wallKind;
`;

/**
 * Fragment: declarations and `facadeRecordColour(out vec2 m)`, the record's colour at this fragment. `m.r` is the wall
 * mask (1 where the wall colour shows, so the lit path's wall gain applies as on a chunk), `m.g` the accent mask.
 */
export const FACADE_RECORD_GLSL = /* glsl */ `
precision highp usampler2D;
uniform usampler2D facadeRecords;
uniform float recBase;
uniform vec4 facadeKnobs;
varying vec3 vWall;
flat varying float vRec;
flat varying float vWallKind;
uvec4 frT0, frT1, frT2, frT3;
void frFetch(float rec) {
  int r = int(rec + 0.5);
  ivec2 at = ivec2((r % ${FACADE_RECORDS_PER_ROW}) * 4, int(recBase + 0.5) + r / ${FACADE_RECORDS_PER_ROW});
  frT0 = texelFetch(facadeRecords, at, 0); frT1 = texelFetch(facadeRecords, at + ivec2(1, 0), 0);
  frT2 = texelFetch(facadeRecords, at + ivec2(2, 0), 0); frT3 = texelFetch(facadeRecords, at + ivec2(3, 0), 0);
}
${fieldAccessors()}
${PITCH_GLSL}
// Coverage of [a, b] by a box pixel of width fw centred at x (windowSdf.ts wsCover, box mode).
float frCover(float x, float a, float b, float fw) { return clamp((min(b, x + 0.5 * fw) - max(a, x - 0.5 * fw)) / fw, 0.0, 1.0); }
// Coverage of an opening [x0, x1] x [y0, top(x)]; head 1 segmental (rise), 2 round.
float frOpening(vec2 p, vec2 fw, float x0, float x1, float y0, float y1, float head, float rise) {
  float cx = frCover(p.x, x0, x1, fw.x);
  if (head > 1.5 && head < 2.5) {
    float r = 0.5 * (x1 - x0), cy = y1 - r;
    float below = frCover(p.y, y0, cy, fw.y);
    float d = length(p - vec2(x0 + r, cy)) - r, fwr = max(0.5 * (fw.x + fw.y), 1e-4);
    float above = p.y > cy ? clamp(0.5 - d / fwr, 0.0, 1.0) : 0.0;
    return max(cx * below, above * frCover(p.y, cy, y1, fw.y));
  }
  float top = y1;
  if (head > 0.5 && head < 1.5) { float s = clamp((p.x - x0) / max(x1 - x0, 1e-4), 0.0, 1.0); top = y1 - rise + 4.0 * rise * s * (1.0 - s); }
  return cx * frCover(p.y, y0, top, fw.y);
}
vec3 frGlass(float g) {
  return g < 0.55 ? mix(${hexV3(GLASS_STOPS[0])}, ${hexV3(GLASS_STOPS[1])}, g / 0.55) : mix(${hexV3(GLASS_STOPS[1])}, ${hexV3(GLASS_STOPS[2])}, (g - 0.55) / 0.45);
}
${SURFACE_GLSL}
vec3 facadeRecordColour(out vec2 m) {
  frFetch(vRec);
  vec2 w = vWall.xy;
  vec2 fw = max(fwidth(w), vec2(1e-4));
  float kind = vWallKind - 8.0 * step(7.5, vWallKind);
  bool front = kind < 0.5;
  m = vec2(1.0, 0.0);
  if (kind > 6.5) { m = vec2(0.0); return fr_roof(); }
  // The wall: the record colour at the atlas wall's mean (lookParity), brick coursing around it, speklagen over it.
  vec3 wallC = fr_wall() * ${f1(FACADE_WALL_MEAN)} * frBrick(w, fw, fr_wallMaterial(), facadeKnobs.x);
  float spek = frSpek(w.y, fw);
  vec3 bandC = fr_band();
  wallC = mix(wallC, bandC, spek); m.r = 1.0 - spek;
  if (kind > 2.5 && kind < 5.5 || kind > 5.5) return wallC;      // party wall, exposed strip, chamfer, crown field: blank
  float plinth = fr_plinthDm() * 0.1, groundH = max(fr_groundDm() * 0.1, 0.5), upperH = max(fr_upperDm() * 0.1, 0.5);
  float atticH = fr_atticDm() * 0.1, storeys = max(fr_storeys(), 1.0);
  float v = w.y - plinth;
  if (v < 0.0 || w.y > fr_wallHcm() * 0.01) return wallC;          // plinth band; the crown above the eaves
  // The eaves cornice as a band under the wall top (S6b; the projecting ledge is S7's crown instance).
  float corn = front ? frCornice(w.y, fw) : 0.0;
  if (corn > 0.0) { wallC = mix(wallC, fr_accent(), corn); m.r *= 1.0 - corn; if (corn > 0.999) return wallC; }
  float storey, sv, sh;
  if (v < groundH) { storey = 0.0; sh = groundH; sv = v; }
  else {
    float u = (v - groundH) / upperH; storey = 1.0 + floor(u); sh = upperH; sv = (u - floor(u)) * upperH;
    if (atticH > 0.0 && storey >= storeys - 1.0) { storey = storeys - 1.0; sh = atticH; sv = v - groundH - (storeys - 2.0) * upperH; }
  }
  if (storey > storeys - 0.5) return wallC;
  float len = max(vWall.z, 1e-3), pitch = frPitch(fr_style());
  float bays = front ? (storey < 0.5 ? fr_baysGround() : (atticH > 0.0 && storey > storeys - 1.5 && fr_baysAttic() > 0.0 ? fr_baysAttic() : fr_baysUpper())) : 0.0;
  if (bays < 0.5) bays = max(1.0, floor(len / pitch + 0.5));
  float bw = len / bays, bay = floor(w.x / bw), bx = w.x - bay * bw;
  vec3 accentC = fr_accent();
  // Quoins: alternating stones at both ends of a front (stated only).
  if (front && fr_quoins() > 0.5) { float q = frQuoin(w, len, fw); wallC = mix(wallC, accentC, q); m.r *= 1.0 - q; }
  // The door: a front's ground storey, in doorBay (254: the bay nearest the centre; 255 none).
  float doorBay = fr_doorBay(), door = doorBay > 253.5 && doorBay < 254.5 ? floor((bays - 1.0) * 0.5) : doorBay;
  vec2 p = vec2(bx, sv);
  // A shop ground storey (groundKind shop / pui-glazed): stallriser, display glass and fascia across the front (S6b
  // generic; F2 replaces this with the measured pui).
  float gk = fr_groundKind();
  if (front && storey < 0.5 && (abs(gk - 1.0) < 0.5 || abs(gk - 6.0) < 0.5) && !(abs(bay - door) < 0.5 && doorBay < 254.5)) {
    float riser = fr_stallriserOn() > 0.5 || gk < 1.5 ? fr_stallriserDm() * 0.1 : 0.0, fascia = fr_fasciaOn() > 0.5 || gk < 1.5 ? max(fr_fasciaHeightDm() * 0.1, 0.3) : 0.0;
    float top = sh - fascia;
    float fasc = frCover(sv, top, sh, fw.y), glass = frOpening(p, fw, 0.08, bw - 0.08, riser, top - 0.08, 0.0, 0.0);
    vec3 c = mix(wallC, fr_shopPaint(), max(fasc, frCover(sv, 0.0, riser, fw.y)));
    c = mix(c, fr_fascia(), fasc);
    c = mix(c, frGlass(clamp((top - sv) / max(top - riser, 0.1), 0.0, 1.0)), glass);
    m = vec2(m.r * (1.0 - max(glass, max(fasc, frCover(sv, 0.0, riser, fw.y)))), 0.0);
    return c;
  }
  float share = fr_windowShare() / 255.0, winH = fr_windowHeightQ() / 255.0;
  vec3 frame = fr_frame();
  if (front && storey < 0.5 && abs(bay - door) < 0.5 && doorBay < 254.5) {
    float dw = min(1.2, bw * 0.7), x0 = 0.5 * (bw - dw), dh = min(sh * 0.85, 2.6);
    float o = frOpening(p, fw, x0, x0 + dw, 0.0, dh, 0.0, 0.0), leaf = frOpening(p, fw, x0 + 0.06, x0 + dw - 0.06, 0.0, dh - 0.06, 0.0, 0.0);
    vec3 c = mix(wallC, frame, o); c = mix(c, fr_door(), leaf);
    m = vec2(m.r * (1.0 - o), 0.0);
    return c;
  }
  // One window per bay, centred: width share x bay, height winH x storey, its top under the storey's head line.
  float ww = clamp(share, 0.15, 0.9) * bw, wh = clamp(winH, 0.2, 0.92) * sh;
  float x0 = 0.5 * (bw - ww), y0 = max(0.25, (sh - wh) * 0.55), y1 = min(sh - 0.1, y0 + wh);
  float head = fr_windowHead(), rise = head > 0.5 && head < 1.5 ? min(0.1 * ww, 0.15) : 0.0;
  if (head > 1.5 && head < 2.5) y1 = max(y1, y0 + 0.5 * ww + 0.2);
  float hd = head > 2.5 ? 0.0 : head;
  // Storey bands at the sill / head lines, then the window's own stone: lintel, frame, sill, keystone.
  float bnd = frBandLines(sv, sh, y0, y1, storey, fw);
  float acc = max(bnd, frSurround(p, fw, x0, x0 + ww, y0, y1, hd, rise));
  wallC = mix(wallC, bnd > 0.0 ? bandC : accentC, acc); m.r *= 1.0 - acc;
  float outer = frOpening(p, fw, x0, x0 + ww, y0, y1, hd, rise);
  if (outer <= 0.0) return wallC;
  float fr = min(0.07, 0.12 * ww);
  float pane = frOpening(p, fw, x0 + fr, x0 + ww - fr, y0 + fr, y1 - fr, hd, rise);
  float g = clamp((y1 - p.y) / max(y1 - y0, 1e-3), 0.0, 1.0);
  vec3 c = mix(wallC, frame, outer);
  vec3 glassC = frGlass(g) * (1.0 - frReveal(p, fw, x0 + fr, y1 - fr, fr_windowRevealCm() * 0.01 * facadeKnobs.y));
  glassC = mix(glassC, frame, frGlazing(p, fw, x0 + fr, x0 + ww - fr, y0 + fr, y1 - fr, fr_windowKind()));
  c = mix(c, glassC, pane);
  m = vec2(m.r * (1.0 - outer), 0.0);
  return c;
}
`;

/** Bytes the CPU side needs to mirror the vertex attribute: Int16 metres x WALL_UV_UNIT_M. */
export const FACADE_SHADER_VERSION = 1;
