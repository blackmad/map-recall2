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
vec3 facadeRecordColour(out vec2 m) {
  frFetch(vRec);
  vec3 wallC = fr_wall();
  m = vec2(1.0, 0.0);
  float kind = vWallKind - 8.0 * step(7.5, vWallKind);
  if (kind > 6.5) { m = vec2(0.0); return fr_roof(); }
  if (kind > 2.5 && kind < 5.5 || kind > 5.5) return wallC;      // party wall, exposed strip, chamfer, crown field: blank
  vec2 w = vWall.xy;
  vec2 fw = max(fwidth(w), vec2(1e-4));
  float plinth = fr_plinthDm() * 0.1, groundH = max(fr_groundDm() * 0.1, 0.5), upperH = max(fr_upperDm() * 0.1, 0.5);
  float atticH = fr_atticDm() * 0.1, storeys = max(fr_storeys(), 1.0);
  float v = w.y - plinth;
  if (v < 0.0 || w.y > fr_wallHcm() * 0.01) return wallC;          // plinth band; the crown above the eaves
  float storey, sv, sh;
  if (v < groundH) { storey = 0.0; sh = groundH; sv = v; }
  else {
    float u = (v - groundH) / upperH; storey = 1.0 + floor(u); sh = upperH; sv = (u - floor(u)) * upperH;
    if (atticH > 0.0 && storey >= storeys - 1.0) { storey = storeys - 1.0; sh = atticH; sv = v - groundH - (storeys - 2.0) * upperH; }
  }
  if (storey > storeys - 0.5) return wallC;
  bool front = kind < 0.5;
  float len = max(vWall.z, 1e-3), pitch = frPitch(fr_style());
  float bays = front ? (storey < 0.5 ? fr_baysGround() : (storey > storeys - 1.5 && fr_baysAttic() > 0.0 ? fr_baysAttic() : fr_baysUpper())) : 0.0;
  if (bays < 0.5) bays = max(1.0, floor(len / pitch + 0.5));
  float bw = len / bays, bay = floor(w.x / bw), bx = w.x - bay * bw;
  // The door: a front's ground storey, in doorBay (254: the bay nearest the centre; 255 none).
  float doorBay = fr_doorBay(), door = doorBay > 253.5 && doorBay < 254.5 ? floor((bays - 1.0) * 0.5) : doorBay;
  vec2 p = vec2(bx, sv);
  float share = fr_windowShare() / 255.0, winH = fr_windowHeightQ() / 255.0;
  vec3 frame = fr_frame();
  if (front && storey < 0.5 && abs(bay - door) < 0.5 && doorBay < 254.5) {
    float dw = min(1.2, bw * 0.7), x0 = 0.5 * (bw - dw), dh = min(sh * 0.85, 2.6);
    float o = frOpening(p, fw, x0, x0 + dw, 0.0, dh, 0.0, 0.0), leaf = frOpening(p, fw, x0 + 0.06, x0 + dw - 0.06, 0.0, dh - 0.06, 0.0, 0.0);
    vec3 c = mix(wallC, frame, o); c = mix(c, fr_door(), leaf);
    m = vec2(1.0 - o, 0.0);
    return c;
  }
  // One window per bay, centred: width share x bay, height winH x storey, its top under the storey's head line.
  float ww = clamp(share, 0.15, 0.9) * bw, wh = clamp(winH, 0.2, 0.92) * sh;
  float x0 = 0.5 * (bw - ww), y0 = max(0.25, (sh - wh) * 0.55), y1 = min(sh - 0.1, y0 + wh);
  float head = fr_windowHead(), rise = head > 0.5 && head < 1.5 ? min(0.18 * ww, 0.35) : 0.0;
  if (head > 1.5 && head < 2.5) y1 = max(y1, y0 + 0.5 * ww + 0.2);
  float outer = frOpening(p, fw, x0, x0 + ww, y0, y1, head > 2.5 ? 0.0 : head, rise);
  if (outer <= 0.0) return wallC;
  float fr = min(0.07, 0.12 * ww);
  float pane = frOpening(p, fw, x0 + fr, x0 + ww - fr, y0 + fr, y1 - fr, head > 2.5 ? 0.0 : head, rise);
  float g = clamp((y1 - p.y) / max(y1 - y0, 1e-3), 0.0, 1.0);
  vec3 c = mix(wallC, frame, outer);
  c = mix(c, frGlass(g), pane);
  m = vec2(1.0 - outer, 0.0);
  return c;
}
`;

/** Bytes the CPU side needs to mirror the vertex attribute: Int16 metres x WALL_UV_UNIT_M. */
export const FACADE_SHADER_VERSION = 1;
