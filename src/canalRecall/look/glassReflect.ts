/**
 * Reflective glass (`?glassReflect=1`, lane glass-reflect-20261116; prototype, off by default).
 *
 * The city look draws glass as a cell x tint lit by Lambert, plus a constant sky tint (cityLook.ts SKY_TINT): view
 * independent, so a glass curtain wall reads as opaque grey-blue cladding (Room Mate Aitana failed blind review on
 * it). A material whose glTF extras say `glassFinish: 'reflective'` takes, under the flag, a reflection of the game's
 * own sky with a Schlick Fresnel term instead of that constant:
 *
 *   r      = reflect(-v, n)                                   (world, east/north/up: the shared frame's world)
 *   env(r) = sky above the skyline (SKY horizon -> zenith), the facades opposite at the skyline, the street below it,
 *            the bands blurred by roughness; plus a sun glint on the sun side
 *   F      = f0' + (max(1 - roughness, f0') - f0') (1 - n.v)^5,  f0' = mix(f0, albedo, metalness)
 *   out    = Lambert(albedo (1 - F)(1 - metalness)) + F env(r)
 *
 * The environment is analytic (no texture, no PMREM, zero bytes): the sky is MapLibre's measured sunny gradient
 * (sunny.ts SKY), the sun is the rig's (lightRig.ts SUN_DIRECTION). There is no time-of-day gradient in the game to
 * follow. One GLSL source (GLASS_REFLECT_GLSL) and one TS copy (glassReflectInto, nodeFrame/slotMaterial.ts) share
 * the constants below.
 *
 * Flag off, or a material without the extra: no variant, define, program key or shader text changes (cityLook.ts
 * `reflect` is never set). GLBs without the tag are byte-identical (scripts/landmarks/glass-finish-tags.ts).
 */
import { SKY } from './sunny.ts';
import { SUN_DIRECTION } from '../rendererShared/lightRig.ts';

export const GLASS_REFLECT_PARAM = 'glassReflect';

/** On by default since round t (2026-11-16: no measurable frame or GPU cost, blind ING 5/5 and Aitana 3/5 for on);
 *  `?glassReflect=0`, `window.__canalRecallGlassReflect = false` or GLASS_REFLECT=0 turns it off. Only tagged glass changes. */
export function glassReflectEnabled(search?: string): boolean {
  try {
    const g = globalThis as any;
    if (search === undefined && typeof g.__canalRecallGlassReflect === 'boolean') return g.__canalRecallGlassReflect;
    const q = search ?? g.location?.search;
    if (q !== undefined) return new URLSearchParams(q).get(GLASS_REFLECT_PARAM) !== '0';
    return g.process?.env?.GLASS_REFLECT !== '0';
  } catch { return true; }
}

/** The glTF material extra a builder writes (glass-finish-tags.ts). */
export const GLASS_FINISH_EXTRA = 'glassFinish';
export const GLASS_FINISHES = ['reflective'] as const;
export type GlassFinish = typeof GLASS_FINISHES[number];
export const isGlassFinish = (v: unknown): v is GlassFinish => typeof v === 'string' && (GLASS_FINISHES as readonly string[]).includes(v);

/**
 * Coated curtain-wall glass. f0 0.6: a reflective (metal-oxide) coating, far above clear float glass (0.04). Tuned on
 * the Node frame of Room Mate Aitana (2026-11-16): at 0.25 the glass drew a flat mid blue-grey, still cladding; the
 * photo's glass is nearly as bright as the sky it mirrors. Metalness 0.2 tints the reflection with the pane's own
 * colour; roughness 0.12: slightly wavy panes.
 */
export const GLASS_REFLECT = {
  f0: 0.6,
  metalness: 0.2,
  roughness: 0.12,
  /** sin(elevation) of the skyline the street sees: the facades opposite fill the reflection below ~8 degrees up. */
  skyline: 0.14,
  /** sin(elevation) below which the reflection is the street. */
  street: -0.2,
  /** The sun glint's peak, in units of a sunlit white wall (clips to white), and its lobe exponent at roughness 0.12. */
  glintPeak: 3.0,
  /** Share of the reflected sky covered by drifting cloud (0 = the clear measured sky). */
  clouds: 0.55,
} as const;

/** The reflected surroundings (sRGB): the measured sunny sky, the facades opposite, the street. */
export const GLASS_ENV_COLOURS = { zenith: SKY.zenith, horizon: SKY.horizon, facades: '#69635c', street: '#8f887c', sun: '#fff4e2', cloud: '#e9edf0' } as const;

const lin = (v: number) => { const s = v / 255; return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
const linHex = (hex: string): [number, number, number] => [1, 3, 5].map(i => lin(parseInt(hex.slice(i, i + 2), 16))) as [number, number, number];
export const GLASS_ENV_LINEAR = {
  zenith: linHex(GLASS_ENV_COLOURS.zenith), horizon: linHex(GLASS_ENV_COLOURS.horizon), facades: linHex(GLASS_ENV_COLOURS.facades),
  street: linHex(GLASS_ENV_COLOURS.street), sun: linHex(GLASS_ENV_COLOURS.sun), cloud: linHex(GLASS_ENV_COLOURS.cloud),
} as const;

/** Blur half-width of the skyline band (sin elevation) at a roughness. */
export const bandWidth = (roughness: number) => 0.03 + 0.5 * roughness;
/** Phong-like lobe exponent of the sun glint at a roughness (2 / r^2: ~6 degrees wide at 0.12). */
export const glintExponent = (roughness: number) => 2 / Math.max(roughness * roughness, 1e-3);

const smooth = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

/**
 * Cloud cover in direction r: two crossed warped sine fields on the sky dome projected to a plane (no texture), so a
 * flat curtain wall shows a mottled sky that slides as the eye moves, as real mirrored glass does. 0..1.
 */
export function cloudCover(rx: number, ry: number, rz: number): number {
  const k = 3 / (Math.max(rz, 0) + 0.3), px = rx * k, py = ry * k;
  const c = 0.5 + 0.25 * (Math.sin(px * 1.7 + Math.sin(py * 2.3)) + Math.sin(py * 1.3 + Math.sin(px * 2.9 + 1)));
  return smooth(0.45, 0.85, c);
}

/** env(r): linear radiance the unit world direction r (z up) sees, without the glint. */
export function glassEnvInto(rx: number, ry: number, rz: number, out: Float64Array | number[], roughness: number = GLASS_REFLECT.roughness): void {
  const E = GLASS_ENV_LINEAR, w = bandWidth(roughness), P = GLASS_REFLECT;
  const up = smooth(P.skyline, 1, rz), sky = smooth(P.skyline - w, P.skyline + w, rz), low = smooth(P.street - w, P.skyline, rz);
  const cloud = P.clouds * (sky > 0 ? cloudCover(rx, ry, rz) : 0);
  for (let k = 0; k < 3; k++) {
    const s0 = E.horizon[k] + (E.zenith[k] - E.horizon[k]) * up, s = s0 + (E.cloud[k] - s0) * cloud;
    const b = E.street[k] + (E.facades[k] - E.street[k]) * low;
    out[k] = b + (s - b) * sky;
  }
}

/**
 * Reflection for one pixel: n (unit, world), v (unit, toward the eye), albedo (linear). Writes the reflected radiance
 * F env + glint into `add` and returns the factor on the diffuse albedo, (1 - F)(1 - metalness) per channel into `keep`.
 */
export function glassReflectInto(n: readonly number[], v: readonly number[], albedo: readonly number[], add: Float64Array | number[], keep: Float64Array | number[],
  toSun: readonly number[] = SUN_DIRECTION, P: { f0: number; metalness: number; roughness: number; glintPeak: number } = GLASS_REFLECT): void {
  const nv = Math.max(0, Math.min(1, n[0] * v[0] + n[1] * v[1] + n[2] * v[2]));
  const rx = 2 * nv * n[0] - v[0], ry = 2 * nv * n[1] - v[1], rz = 2 * nv * n[2] - v[2];
  const env = [0, 0, 0];
  glassEnvInto(rx, ry, rz, env, P.roughness);
  const ns = n[0] * toSun[0] + n[1] * toSun[1] + n[2] * toSun[2];
  const rs = Math.max(0, rx * toSun[0] + ry * toSun[1] + rz * toSun[2]);
  const glint = ns > 0 ? P.glintPeak * Math.pow(rs, glintExponent(P.roughness)) : 0;
  const fres = Math.pow(1 - nv, 5);
  for (let k = 0; k < 3; k++) {
    const f0 = P.f0 + (albedo[k] - P.f0) * P.metalness;
    const F = f0 + (Math.max(1 - P.roughness, f0) - f0) * fres;
    add[k] = F * (env[k] + glint * GLASS_ENV_LINEAR.sun[k]);
    keep[k] = (1 - F) * (1 - P.metalness);
  }
}

const f = (x: number) => (Number.isInteger(x) ? x.toFixed(1) : String(+x.toFixed(6)));
const v3 = (c: readonly number[]) => `vec3(${c.map(f).join(', ')})`;

/**
 * GLSL of the same function. `cityGlassReflect(n, v, albedo, keep)` returns the added radiance; n and v in the
 * world (the shared frame draws with an identity view matrix, so view space is the east/north/up world; the caller
 * turns view-space vectors into the world with viewMatrix all the same).
 */
export const GLASS_REFLECT_GLSL = /* glsl */ `
vec3 cityGlassEnv(vec3 r) {
  float w = ${f(bandWidth(GLASS_REFLECT.roughness))};
  float up = smoothstep(${f(GLASS_REFLECT.skyline)}, 1.0, r.z);
  float skyK = smoothstep(${f(GLASS_REFLECT.skyline)} - w, ${f(GLASS_REFLECT.skyline)} + w, r.z);
  float lowK = smoothstep(${f(GLASS_REFLECT.street)} - w, ${f(GLASS_REFLECT.skyline)}, r.z);
  float ck = 3.0 / (max(r.z, 0.0) + 0.3);
  vec2 cp = r.xy * ck;
  float cc = smoothstep(0.45, 0.85, 0.5 + 0.25 * (sin(cp.x * 1.7 + sin(cp.y * 2.3)) + sin(cp.y * 1.3 + sin(cp.x * 2.9 + 1.0))));
  vec3 s = mix(mix(${v3(GLASS_ENV_LINEAR.horizon)}, ${v3(GLASS_ENV_LINEAR.zenith)}, up), ${v3(GLASS_ENV_LINEAR.cloud)}, ${f(GLASS_REFLECT.clouds)} * (skyK > 0.0 ? cc : 0.0));
  vec3 b = mix(${v3(GLASS_ENV_LINEAR.street)}, ${v3(GLASS_ENV_LINEAR.facades)}, lowK);
  return mix(b, s, skyK);
}
vec3 cityGlassReflect(vec3 n, vec3 v, vec3 albedo, out vec3 keep) {
  float nv = clamp(dot(n, v), 0.0, 1.0);
  vec3 r = 2.0 * nv * n - v;
  vec3 sunDir = ${v3(SUN_DIRECTION)};
  float glint = dot(n, sunDir) > 0.0 ? ${f(GLASS_REFLECT.glintPeak)} * pow(max(dot(r, sunDir), 0.0), ${f(glintExponent(GLASS_REFLECT.roughness))}) : 0.0;
  vec3 f0 = mix(vec3(${f(GLASS_REFLECT.f0)}), albedo, ${f(GLASS_REFLECT.metalness)});
  vec3 F = f0 + (max(vec3(${f(1 - GLASS_REFLECT.roughness)}), f0) - f0) * pow(1.0 - nv, 5.0);
  keep = (1.0 - F) * ${f(1 - GLASS_REFLECT.metalness)};
  return F * (cityGlassEnv(r) + glint * ${v3(GLASS_ENV_LINEAR.sun)});
}`;
