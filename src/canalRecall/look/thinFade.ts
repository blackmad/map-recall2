// Thin-element fade (lane R3-A, #230): trim, cornices, decals and facade extras narrower than a pixel on screen.
//
// User shot S3 (map-recall2-screenshots engine/2026-11-06-user-shots/s3-weesperstraat-slab-moire.png): moving stripes
// on the Weesperstraat slab while the camera moves. Round 2 (#228) found the moving pixels on eaves, parapet and
// cornice lines: geometry a few centimetres to a few decimetres across, drawn at 150 m where it covers less than one
// pixel, so MSAA's four samples catch it on some frames and miss it on the next.
//
// Every facade chunk vertex carries `thin` (threeBuildingMesh.ts buildChunk): x = the triangle's smallest
// cross-section in cm (its shortest altitude, 1..254; 0 = not a thin element: walls, roofs, lids) and y = its owner
// class (THIN_CLASS). The fragment shader projects the cross-section to framebuffer pixels
// (`px = thin_m * thinFocalPx / vFacDist`, thinFocalPx = projectionMatrix[1][1] * drawing-buffer height / 2) and
// below THIN_FADE_FROM_PX dithers the element out with the screen-door hash of the city fade (no blending, no sort);
// between THIN_FADE_FROM_PX and THIN_FADE_TO_PX it fades in. The wall behind stays. Decals and trim (class `trim`)
// also get a small depth bias so a 1-2 cm proud decal stops z-fighting its wall at distance.
//
// `?thinFade=0` (or `window.__canalRecallThinFade = false`) leaves every program key and picture as before.
// `?thinDebug=owner` paints each chunk pixel by its owner class (THIN_OWNER_CLASSES), for swap-zfight's ZFIGHT_OWNER.
// One installer (installThinFade) patches a finished city-look or lit-facade material: the only hook in
// look/cityLook.ts and rendererShared/litFacadeMaterial.ts.

/** Owner classes, `thin.y`. 0: a mesh without the attribute (kits, slot meshes, boats). */
export const THIN_CLASS = {
  other: 0, wall: 1, roof: 2, lid: 3, trim: 4, cornice: 5, frontage: 6, extrasStrip: 7, extrasBox: 8, extrasOther: 9, shell: 10,
} as const;
export type ThinClass = typeof THIN_CLASS[keyof typeof THIN_CLASS];

/** The owner view's flat colours (sRGB bytes): the cube's corners and three face centres, ≥ 254 apart in L1, so a resolved pixel buckets within L1 90. */
export const THIN_OWNER_CLASSES = [
  { name: 'other', id: THIN_CLASS.other, rgb: [0, 0, 0] },
  { name: 'wall', id: THIN_CLASS.wall, rgb: [255, 255, 255] },
  { name: 'roof', id: THIN_CLASS.roof, rgb: [255, 0, 0] },
  { name: 'lid', id: THIN_CLASS.lid, rgb: [128, 0, 128] },
  { name: 'trim-decal', id: THIN_CLASS.trim, rgb: [0, 255, 0] },
  { name: 'cornice', id: THIN_CLASS.cornice, rgb: [0, 0, 255] },
  { name: 'frontage', id: THIN_CLASS.frontage, rgb: [255, 255, 0] },
  { name: 'extras-strip', id: THIN_CLASS.extrasStrip, rgb: [255, 0, 255] },
  { name: 'extras-box', id: THIN_CLASS.extrasBox, rgb: [0, 255, 255] },
  { name: 'extras-other', id: THIN_CLASS.extrasOther, rgb: [128, 128, 0] },
  { name: 'shell', id: THIN_CLASS.shell, rgb: [0, 128, 128] },
] as const;

/** Below this many framebuffer pixels across a thin element is gone; above THIN_FADE_TO_PX it is solid. */
export const THIN_FADE_FROM_PX = 1;
export const THIN_FADE_TO_PX = 2;
/** Clip-space depth bias of `trim` (decals 1-2 cm proud, gableTrim.ts PROUD), in units of w. */
export const THIN_TRIM_DEPTH_BIAS = 4e-6;
/** Largest cross-section the attribute records (cm); anything wider is not thin. */
export const THIN_MAX_CM = 254;

/** The cross-section of a triangle, cm: its shortest altitude (2 · area / longest edge), 0 when wider than THIN_MAX_CM. */
export function thinCm(a: readonly number[], b: readonly number[], c: readonly number[]): number {
  const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
  const cx = uy * vz - uz * vy, cy = uz * vx - ux * vz, cz = ux * vy - uy * vx;
  const area2 = Math.hypot(cx, cy, cz);
  const l = Math.max(Math.hypot(ux, uy, uz), Math.hypot(vx, vy, vz), Math.hypot(c[0] - b[0], c[1] - b[1], c[2] - b[2]));
  if (!(l > 0) || !(area2 > 0)) return 1;
  const cm = Math.round(area2 / l * 100);
  return cm > THIN_MAX_CM ? 0 : Math.max(1, cm);
}

/** The fade's coverage at `px` framebuffer pixels across (the shader's ramp, for tests and reports). */
export function thinFadeCoverage(px: number): number {
  return Math.max(0, Math.min(1, (px - THIN_FADE_FROM_PX) / (THIN_FADE_TO_PX - THIN_FADE_FROM_PX)));
}

/** `thinFocalPx`: framebuffer pixels per metre at 1 m from the eye (projectionMatrix[1][1] · height / 2). */
export const thinFocalPx = (projection11: number, drawingBufferHeight: number): number => projection11 * drawingBufferHeight / 2;

function pageParam(param: string): string | null {
  try {
    return typeof URLSearchParams === 'function' ? new URLSearchParams((globalThis as { location?: { search?: string } }).location?.search ?? '').get(param) : null;
  } catch { return null; }
}

/** `?thinFade=0|1` (or `window.__canalRecallThinFade`). On unless asked off. */
export function thinFadeEnabled(): boolean {
  const g = globalThis as Record<string, unknown>;
  const asked = g.__canalRecallThinFade ?? pageParam('thinFade');
  return !(asked === false || asked === '0' || asked === 'false' || asked === 'off');
}

/** `?thinDebug=owner` (or `window.__canalRecallThinDebug = 'owner'`). Off by default. */
export function thinDebugMode(): 'owner' | null {
  const g = globalThis as Record<string, unknown>;
  return (g.__canalRecallThinDebug ?? pageParam('thinDebug')) === 'owner' ? 'owner' : null;
}

const f = (v: number) => (Number.isInteger(v) ? v.toFixed(1) : String(v));
const v3 = (rgb: readonly number[]) => `vec3(${rgb.map(c => (c / 255).toFixed(4)).join(', ')})`;

const VERTEX_DECLS = /* glsl */ `
attribute vec2 thin;
varying float vThinM;
flat varying float vThinClass;
`;
const VERTEX_BODY = /* glsl */ `
vThinM = thin.x * 0.01; vThinClass = thin.y;
#ifdef CITY_THIN_FADE
if (thin.y > ${f(THIN_CLASS.trim - 0.5)} && thin.y < ${f(THIN_CLASS.trim + 0.5)}) gl_Position.z -= ${THIN_TRIM_DEPTH_BIAS.toExponential()} * gl_Position.w;
#endif
`;
const FRAGMENT_DECLS = /* glsl */ `
uniform float thinFocalPx;
varying float vThinM;
flat varying float vThinClass;
vec3 thinOwnerColour(float c) {
${THIN_OWNER_CLASSES.map(k => `  if (c < ${f(k.id + 0.5)}) return ${v3(k.rgb)};`).join('\n')}
  return vec3(0.5);
}
`;
const FRAGMENT_FADE = /* glsl */ `
#ifdef CITY_THIN_FADE
if (vThinM > 0.0) {
  float thinPx = vThinM * thinFocalPx / max(vFacDist, 0.01);
  float thinCover = clamp((thinPx - ${f(THIN_FADE_FROM_PX)}) / ${f(THIN_FADE_TO_PX - THIN_FADE_FROM_PX)}, 0.0, 1.0);
  if (thinCover < 1.0 && fract(dot(floor(gl_FragCoord.xy), vec2(0.754877666, 0.569840296))) >= thinCover) discard;
}
#endif
`;
const FRAGMENT_OWNER = /* glsl */ `
#ifdef CITY_THIN_OWNER
gl_FragColor = vec4(thinOwnerColour(vThinClass), 1.0);
#endif
`;

/** Shared by every patched material: updated before each draw from the camera and the drawing buffer. */
const FOCAL = { value: 1000 };

/** Patch shader strings (exported for the tests): returns null when an anchor is missing (the material is left alone). */
export function patchThinShaders(vertex: string, fragment: string, lit: boolean): { vertex: string; fragment: string } | null {
  const main = 'void main() {';
  const dist = /vFacDist = length\([^;]*\);/;
  const ghost = 'if (HL_GHOST(vHighlight)) discard;';
  if (!vertex.includes(main) || !dist.test(vertex) || !fragment.includes(main) || !fragment.includes(ghost)) return null;
  const v = vertex.replace(main, `${VERTEX_DECLS}${main}`).replace(dist, m => `${m}${VERTEX_BODY}`);
  let fr = fragment.replace(main, `${FRAGMENT_DECLS}${main}`).replace(ghost, `${ghost}${FRAGMENT_FADE}`);
  if (lit) {
    if (!fr.includes('#include <dithering_fragment>')) return null;
    fr = fr.replace('#include <dithering_fragment>', `#include <dithering_fragment>${FRAGMENT_OWNER}`);
  } else {
    const end = fr.lastIndexOf('}');
    fr = `${fr.slice(0, end)}${FRAGMENT_OWNER}${fr.slice(end)}`;
  }
  return { vertex: v, fragment: fr };
}

/**
 * The one hook: patch a facade-chunk material (city look, lit or unlit, or the lit facade material) for the thin fade
 * and the owner view. A no-op (the material and its program key untouched) when both are off.
 */
export function installThinFade(material: any, lit: boolean, options: { fade?: boolean; debug?: 'owner' | null } = {}): any {
  const fade = options.fade ?? thinFadeEnabled(), debug = options.debug === undefined ? thinDebugMode() : options.debug;
  if (!fade && !debug) return material;
  material.defines = { ...(material.defines ?? {}), ...(fade ? { CITY_THIN_FADE: '' } : {}), ...(debug ? { CITY_THIN_OWNER: '' } : {}) };
  // A mesh without `thin` (kits, boats) reads the attribute's generic value, which WebGL shares across programs per
  // location: pin it to (0, 0) (not thin, class other) so a value another program left there cannot fade a kit out.
  material.defaultAttributeValues = { ...(material.defaultAttributeValues ?? {}), thin: [0, 0] };
  if (lit) {
    const before = material.onBeforeCompile;
    material.onBeforeCompile = function (this: any, shader: any, renderer: any) {
      before?.call(this, shader, renderer);
      const patched = patchThinShaders(shader.vertexShader, shader.fragmentShader, true);
      if (!patched) return;
      shader.vertexShader = patched.vertex; shader.fragmentShader = patched.fragment;
      shader.uniforms.thinFocalPx = FOCAL;
    };
  } else {
    const patched = patchThinShaders(material.vertexShader, material.fragmentShader, false);
    if (!patched) return material;
    material.vertexShader = patched.vertex; material.fragmentShader = patched.fragment;
    material.uniforms = { ...material.uniforms, thinFocalPx: FOCAL };
  }
  // The program cache key stays the factory's: three hashes `defines` into every program key, so CITY_THIN_FADE /
  // CITY_THIN_OWNER already keep a patched program apart from an unpatched one (and the registry keys stay as pinned).
  const render = material.onBeforeRender;
  const size = { x: 0, y: 0, set(x: number, y: number) { this.x = x; this.y = y; return this; }, floor() { this.x = Math.floor(this.x); this.y = Math.floor(this.y); return this; } };
  material.onBeforeRender = function (this: any, renderer: any, scene: any, camera: any, ...rest: any[]) {
    render?.call(this, renderer, scene, camera, ...rest);
    const h = renderer?.getDrawingBufferSize ? renderer.getDrawingBufferSize(size).y : 0;
    const p11 = camera?.projectionMatrix?.elements?.[5];
    if (h > 0 && Number.isFinite(p11)) FOCAL.value = thinFocalPx(p11, h);
  };
  material.userData = { ...(material.userData ?? {}), thinFade: fade, thinDebug: debug };
  return material;
}
