// The shop-interior shader (lane shop-interiors-20261116, `?shopInteriors=1`): interior mapping on a shop window's glass.
//
// A pane (retailFront.ts with the flag on) is one quad whose uv is (u, INTERIOR_V + v) over the glass and whose accent
// colour carries the room, the variant and the lit flag (rooms.ts). The fragment shader rebuilds the glass's frame from
// screen derivatives of the view position and the uv (so no tangent or size attribute is needed: |dP/du| is the glass's
// width in metres), casts the view ray into a box behind the glass (floor FLOOR_DROP under the glass, ceiling CEIL_RISE
// over it, the back wall the variant's depth away), and samples the hit face from the atlas (atlas.ts). One mid plane of
// furniture with alpha (counter, racks, tables) stands between the glass and the back wall. The glass then reflects the
// street and sky by a Fresnel term, strongest at grazing angles and by day; `shopDusk` lights the room warm and weakens
// the reflection. Far away the room fades to its own mean, so a distant front does not shimmer.
//
// The chunk materials stay as they are with the flag off: installShopInteriors is the only entry, and it is only called
// with the flag on. It patches the material's shader text in place (city look lit and unlit, the lit facade material,
// the unlit raw material) and adds its own program key suffix.

import { ATLAS_H, ATLAS_W, CEIL_RISE, CEIL_TILE, CELL, COLS, FACE, FLOOR_DROP, FLOOR_TILE, MID_H, ROOM_W, paintInteriorAtlas } from './atlas.js';
import { INTERIOR_V, ROOM_DEPTHS, shopDuskLevel } from './rooms.js';

const f = (v: number) => (Number.isInteger(v) ? `${v}.0` : String(v));
const rect = (k: keyof typeof FACE) => `vec4(${FACE[k].map(f).join(', ')})`;

/** The shader's tunables, measured against the photos' shop glass in the A/B frames. */
export const SHOP_LOOK = {
  /** Linear radiance of a white back wall by day (unlit shop: under the street's light, glass reads dark). */
  dayLevel: 0.42,
  /** A lit chain's interior (supermarket, chemist) by day. */
  dayLitLevel: 0.62,
  /** At dusk: the room's own lamps. */
  duskLevel: 0.95,
  /** Reflection: base share by day and at dusk, and the Fresnel gain on top. */
  reflectDay: 0.2, reflectDusk: 0.06, fresnelGain: 0.8,
  /** The reflected street (ground) and sky (linear). */
  street: [0.085, 0.085, 0.082], sky: [0.36, 0.40, 0.45],
  /** The mid plane's distance behind the glass: at most this, and at most this share of the room's depth. */
  midM: 1.5, midShare: 0.38,
  /** From this distance (m) the room fades to its mean colour, gone by `fadeFar`. */
  fadeNear: 28, fadeFar: 55,
} as const;

/** GLSL: the uniforms and `bool shopInterior(vec2 uv, vec3 accent, vec3 P, out vec3 lin)` (P: view-space position). */
export function shopInteriorGlsl(): string {
  const L = SHOP_LOOK;
  return /* glsl */ `
uniform sampler2D shopAtlas;
uniform float shopDusk;
uniform float shopLevel;
vec3 shopTex(vec2 cell, vec4 r, vec2 q, float lod, out float a) {
  // q in 0..1 over the face (y down); clamped inside the face by the mip's half texel so cells do not bleed.
  vec2 inset = vec2(0.5 * exp2(lod) + 0.5);
  vec2 p = cell + r.xy + clamp(q * r.zw, inset, r.zw - inset);
  vec4 c = textureLod(shopAtlas, p / vec2(${f(ATLAS_W)}, ${f(ATLAS_H)}), lod);
  a = c.a;
  return pow(c.rgb, vec3(2.2));
}
bool shopInterior(vec2 uv, vec3 acc, vec3 P, out vec3 lin) {
  if (uv.y < ${f(INTERIOR_V - 0.5)}) return false;
  vec2 st = vec2(uv.x, uv.y - ${f(INTERIOR_V)});
  vec3 dpx = dFdx(P), dpy = dFdy(P);
  vec2 dsx = dFdx(st), dsy = dFdy(st);
  float det = dsx.x * dsy.y - dsx.y * dsy.x;
  float roomIx = floor(acc.r * 255.0 + 0.5), variant = floor(acc.g * 255.0 + 0.5);
  bool litShop = acc.b > 0.002;
  vec2 cell = vec2(mod(roomIx, ${f(COLS)}), floor(roomIx / ${f(COLS)})) * ${f(CELL)};
  float a;
  // The room's mean (the back wall's coarsest mip), for distance and degenerate frames.
  vec3 mean = shopTex(cell, ${rect('back')}, vec2(0.5), 6.0, a);
  float level = mix(litShop ? ${f(L.dayLitLevel)} : ${f(L.dayLevel)}, ${f(L.duskLevel)}, shopDusk) * shopLevel;
  float dist = length(P);
  vec3 d = P / dist;
  if (abs(det) < 1e-14) { lin = mean * level * 0.7; return true; }
  vec3 Pu = (dsy.y * dpx - dsx.y * dpy) / det, Pv = (dsx.x * dpy - dsy.x * dpx) / det;
  float W = max(length(Pu), 0.05), H = max(length(Pv), 0.05);
  vec3 T = Pu / W, B = Pv / H, N = normalize(cross(T, B));
  if (dot(N, d) > 0.0) N = -N;
  // Local frame: x along the glass, y up it, z into the room.
  vec3 dl = vec3(dot(d, T), dot(d, B), max(-dot(d, N), 1e-3));
  vec3 o = vec3(st.x * W, st.y * H, 0.0);
  float bits = variant;
  bool mirror = mod(bits, 2.0) > 0.5;
  float depthIx = mod(floor(bits / 2.0), 4.0);
  float D = depthIx < 0.5 ? ${f(ROOM_DEPTHS[0])} : depthIx < 1.5 ? ${f(ROOM_DEPTHS[1])} : depthIx < 2.5 ? ${f(ROOM_DEPTHS[2])} : ${f(ROOM_DEPTHS[3])};
  float offset = floor(bits / 8.0) / 32.0 * ${f(ROOM_W)};
  if (mirror) { o.x = W - o.x; dl.x = -dl.x; }
  float yF = -${f(FLOOR_DROP)}, yC = H + ${f(CEIL_RISE)}, rh = yC - yF;
  float tx = abs(dl.x) < 1e-4 ? 1e4 : ((dl.x > 0.0 ? W : 0.0) - o.x) / dl.x;
  float ty = abs(dl.y) < 1e-4 ? 1e4 : ((dl.y > 0.0 ? yC : yF) - o.y) / dl.y;
  float tz = D / dl.z;
  float t = min(tz, min(tx, ty));
  vec3 h = o + dl * t;
  // Pixel footprint (m) where the ray lands: the glass's footprint grown with the extra distance.
  float foot = max(length(dpx), length(dpy)) * (dist + t) / dist;
  vec3 c; float k;
  if (t == tz) {
    c = shopTex(cell, ${rect('back')}, vec2(fract((h.x + offset) / ${f(ROOM_W)}), 1.0 - (h.y - yF) / rh), clamp(log2(max(foot * ${f(FACE.back[2] / ROOM_W)}, 1.0)), 0.0, 4.0), a);
    k = 1.0;
  } else if (t == tx) {
    c = shopTex(cell, ${rect('side')}, vec2(h.z / D, 1.0 - (h.y - yF) / rh), clamp(log2(max(foot * ${f(FACE.side[2])} / D, 1.0)), 0.0, 4.0), a);
    k = 0.8;
  } else if (dl.y < 0.0) {
    c = shopTex(cell, ${rect('floor')}, fract(vec2(h.x, h.z) / ${f(FLOOR_TILE)}), clamp(log2(max(foot * ${f(FACE.floor[2] / FLOOR_TILE)}, 1.0)), 0.0, 4.0), a);
    k = 0.72;
  } else {
    c = shopTex(cell, ${rect('ceil')}, fract(vec2(h.x + 0.5, h.z) / ${f(CEIL_TILE)}), clamp(log2(max(foot * ${f(FACE.ceil[2] / CEIL_TILE)}, 1.0)), 0.0, 4.0), a);
    k = 0.9;
  }
  k *= mix(1.0, 0.72, h.z / D);
  // The mid plane: furniture between the glass and the back wall, where its alpha holds.
  float zm = min(${f(L.midM)}, ${f(L.midShare)} * D), tm = zm / dl.z;
  if (tm < t) {
    vec3 hm = o + dl * tm;
    float my = (hm.y - yF) / ${f(MID_H)};
    if (my < 1.0) {
      float ma;
      vec3 mc = shopTex(cell, ${rect('mid')}, vec2(fract((hm.x + offset) / ${f(ROOM_W)}), 1.0 - my), clamp(log2(max(foot * tm / max(t, 1e-3) * ${f(FACE.mid[2] / ROOM_W)}, 1.0)), 0.0, 4.0), ma);
      float m = smoothstep(0.35, 0.65, ma);
      c = mix(c, mc, m); k = mix(k, mix(1.0, 0.72, zm / D), m);
    }
  }
  vec3 rc = c * k * level;
  rc = mix(rc, mean * level * 0.8, smoothstep(${f(L.fadeNear)}, ${f(L.fadeFar)}, dist));
  // The glass: the street below the horizon, the sky above it, by the reflected ray, with a Fresnel rise at grazing angles.
  vec3 r = reflect(d, N);
  vec3 refl = mix(vec3(${L.street.map(f).join(', ')}), vec3(${L.sky.map(f).join(', ')}), smoothstep(-0.15, 0.35, dot(r, B)));
  float cosv = clamp(-dot(d, N), 0.0, 1.0);
  float fres = 0.04 + 0.96 * pow(1.0 - cosv, 5.0);
  float amount = clamp(mix(${f(L.reflectDay)}, ${f(L.reflectDusk)}, shopDusk) + ${f(L.fresnelGain)} * fres, 0.0, 0.9);
  lin = mix(rc, refl * mix(1.0, 0.35, shopDusk), amount);
  return true;
}`;
}

export type ShopInteriorUniforms = { shopAtlas: { value: any }; shopDusk: { value: number }; shopLevel: { value: number } };
const KEY = '__canalRecallShopInteriorUniforms';
/** The page's one atlas texture and its uniforms (built on first use; every chunk material shares them). */
export function shopInteriorUniforms(THREE: any): ShopInteriorUniforms {
  const g = globalThis as unknown as Record<string, ShopInteriorUniforms | undefined>;
  if (g[KEY]) return g[KEY]!;
  const tex = new THREE.DataTexture(new Uint8Array(paintInteriorAtlas().buffer), ATLAS_W, ATLAS_H, THREE.RGBAFormat, THREE.UnsignedByteType);
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.flipY = false;
  tex.needsUpdate = true;
  tex.userData = { bytes: ATLAS_W * ATLAS_H * 4 * 4 / 3, label: 'shop-interiors' };
  return (g[KEY] = { shopAtlas: { value: tex }, shopDusk: { value: shopDuskLevel() }, shopLevel: { value: 1 } });
}

/** GPU bytes of the atlas with its mips. */
export const SHOP_ATLAS_BYTES = Math.round(ATLAS_W * ATLAS_H * 4 * 4 / 3);

const MARK = '/*shop-interiors*/';
/** Which chunk shader a material is: the city look lit (Lambert) or unlit (ShaderMaterial), the lit facade material
 *  (Lambert), or the raw GLSL3 facade material (threeBuildingsBrowser VERTEX/FRAGMENT). */
export type ShopMaterialKind = 'lambert' | 'cityUnlit' | 'raw';
export function shopMaterialKind(material: any): ShopMaterialKind | null {
  if (material?.isMeshLambertMaterial) return 'lambert';
  if (material?.isRawShaderMaterial) return 'raw';
  if (material?.isShaderMaterial && typeof material.fragmentShader === 'string' && material.fragmentShader.includes('gl_FragColor = vec4(cityC * shade, 1.0);')) return 'cityUnlit';
  return null;
}

/**
 * Patch a facade chunk material to draw shop interiors. Only called with the flag on. Idempotent (a cloned raw material
 * is re-pointed at the shared uniforms). Returns the material.
 */
export function installShopInteriors(THREE: any, material: any): any {
  const kind = shopMaterialKind(material);
  if (!kind) return material;
  const u = shopInteriorUniforms(THREE);
  const glsl = shopInteriorGlsl();
  const apply = `{ vec3 shopLin; if (!HL_PAINT(vHighlight) && shopInterior(${kind === 'raw' ? 'vUv' : 'vFacUv'}, vAccent, -vShopView, shopLin))`;
  if (kind === 'lambert') {
    if (material.userData?.shopInteriors) return material;
    const prev = material.onBeforeCompile, prevKey = material.customProgramCacheKey;
    material.onBeforeCompile = (shader: any, renderer: any) => {
      prev?.call(material, shader, renderer);
      Object.assign(shader.uniforms, u);
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', `#include <common>\nvarying vec3 vShopView;`)
        .replace('#include <project_vertex>', `#include <project_vertex>\nvShopView = -mvPosition.xyz;`);
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', `#include <common>\nvarying vec3 vShopView;${glsl}`)
        .replace('#include <opaque_fragment>', `${MARK}${apply} outgoingLight = shopLin; }\n#include <opaque_fragment>`);
    };
    material.customProgramCacheKey = () => `${prevKey ? prevKey.call(material) : ''}|shopi`;
    if (material.uniforms) Object.assign(material.uniforms, u);
    material.userData = { ...material.userData, shopInteriors: true };
    material.needsUpdate = true;
    return material;
  }
  Object.assign(material.uniforms, u);
  if (material.fragmentShader.includes(MARK)) return material;
  if (kind === 'cityUnlit') {
    material.vertexShader = material.vertexShader
      .replace('void main() {', 'varying vec3 vShopView;\nvoid main() {')
      .replace('vFacDist = length((modelViewMatrix * vec4(position, 1.0)).xyz);', 'vFacDist = length((modelViewMatrix * vec4(position, 1.0)).xyz);\nvShopView = -(modelViewMatrix * vec4(position, 1.0)).xyz;');
    material.fragmentShader = material.fragmentShader
      .replace('varying float vShade;', `varying float vShade;\nvarying vec3 vShopView;${glsl}`)
      .replace('gl_FragColor = vec4(cityC * shade, 1.0);', `gl_FragColor = vec4(cityC * shade, 1.0);\n${MARK}${apply} gl_FragColor = vec4(pow(shopLin, vec3(1.0 / 2.2)), 1.0); }`);
  } else {
    material.vertexShader = material.vertexShader
      .replace('out float vDist;', 'out float vDist;\nout vec3 vShopView;')
      .replace('vDist = length(viewPosition.xyz);', 'vDist = length(viewPosition.xyz);\n  vShopView = -viewPosition.xyz;');
    material.fragmentShader = material.fragmentShader
      .replace('in float vDist;', `in float vDist;\nin vec3 vShopView;${glsl}`)
      .replace('fragColor = vec4(c * shade, 1.0);', `fragColor = vec4(c * shade, 1.0);\n  ${MARK}${apply} fragColor = vec4(pow(shopLin, vec3(1.0 / 2.2)), 1.0); }`);
  }
  material.needsUpdate = true;
  return material;
}
