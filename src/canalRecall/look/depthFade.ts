// Depth fade, aerial perspective (#161 design note lever 1, "make the chase-cam frame less busy"). The far third of
// the chase frame carried more edge energy than the near third (look/busyness.ts: far/near 1.45-1.82 at four of the
// five spots). Not a fog blend to one colour: with distance, saturation fades and contrast compresses part-way toward
// the measured horizon haze (look/sunny.ts SKY.horizon), and the facade cells' window-pane and trim detail blends to
// the cell's mean tint beyond ~150 m (roofTier.ts FACADE_TIER_GLSL). The near field is pixel-unchanged: every weight
// is exactly 0 closer than DEPTH_FADE_MIN_NEAR_M.
//
// It rides three's fog plumbing (scene.fog, USE_FOG, fog uniforms) with the fog chunks replaced, so only materials
// that take fog change. The shared frame keeps its view in the projection and draws an eye-relative world
// (frameMath.ts), so three's stock fog depth (-mvPosition.z) would be height; fog_vertex measures eye distance. The
// range scales with the eye-to-centre distance, so the high overview barely fades.
//
// Landmarks opt out entirely (depthFadeOptOut): orientation landmarks are what players steer by, so a catalogue
// landmark's materials draw without fog at any distance (#161 look review: the Westerkerk tower lost its edge).
//
// On by default for every look after the #161 look review; `?depthFade=0` (or `__canalRecallDepthFade = false` before
// load) turns it off, and then nothing is installed and every program is as before.
//
// Gentler since 2026-11-05 (lane E1, plan #213 item E; user: "gentle far haze for now, but make it turn-off-able"):
// the fade still starts at 0.8x the eye-to-centre distance but never inside 200 m (was 80 m), is full at 4x (was
// 3.5x), takes 50 % of the saturation (was 70 %) and goes 38 % of the way to the haze (was 55 %); facade detail blends
// from 250 m to 600 m at the closest (was 150-320 m). Measured at the five busyness spots (look/busyness.ts, world A/B
// fixed camera, zoom 17.5, eye ~348 m from the centre): 52-58 % of the old fade's far/near gain is kept on desktop.
// A later start (the 2x / 6x first tried) left the chase frame's far third unfaded: 0-1 % of the gain. `?fadeStrength=0..1` scales the desaturation, haze and detail blend together for
// look review. The player's "Distance haze" switch (preferences `distanceHaze`) turns it off at runtime without a
// recompile: the fog range moves out of reach (`distanceHazeOn`).

import { DEPTH_FADE_LIMIT_ONLY, DRAW_LIMIT_GENTLE_FAR_GLSL, drawLimitFlag, drawLimitFogFragment, landmarkHazeFlag } from '../engine/drawLimit';

export const DEPTH_FADE_DEFAULT = true;
/** The fade starts at this multiple of the eye-to-centre distance... */
export const DEPTH_FADE_NEAR = 0.8;
/** ...and is full at this multiple. */
export const DEPTH_FADE_FAR = 4.0;
/** Never fade closer than this, metres: the street ahead stays exactly as drawn. */
export const DEPTH_FADE_MIN_NEAR_M = 200;
/** At full fade: share of the saturation removed... */
export const DEPTH_FADE_DESATURATE = 0.5;
/** ...and the share of the way to the haze tone (the rest of the contrast survives: not a fog to one colour). */
export const DEPTH_FADE_HAZE = 0.38;
/**
 * Facade cell detail (panes, trim) blends to the cell's mean tint from the later of 250 m and the fade's start, and is
 * gone at the later of 600 m and 40 % of the way to the fade's end: the chase cam keeps the street's windows, a high
 * camera's whole frame does not lose them at once.
 */
export const DEPTH_FADE_DETAIL_FROM_M = 250;
export const DEPTH_FADE_DETAIL_FULL_M = 600;
export const DEPTH_FADE_DETAIL_SPAN = 0.4;

export function depthFadeFlag(): boolean {
  const g = globalThis as { __canalRecallDepthFade?: boolean | string; location?: { search?: string } };
  const asked = g.__canalRecallDepthFade ?? new URLSearchParams(g.location?.search ?? '').get('depthFade');
  if (asked === true || asked === '1' || asked === 'true' || asked === 'on') return true;
  if (asked === false || asked === '0' || asked === 'false' || asked === 'off') return false;
  return DEPTH_FADE_DEFAULT;
}

/**
 * `?fadeStrength=0..1` (or `__canalRecallFadeStrength`): one dial over the desaturation, the haze and the facade detail
 * blend. Read once, when the chunks are built (a page-load knob).
 */
export function depthFadeStrength(): number {
  const g = globalThis as { __canalRecallFadeStrength?: number | string; location?: { search?: string } };
  // Guarded: the bundle is also evaluated where URLSearchParams is absent (check-game-decomposition, CI 2026-11-05).
  const fromUrl = typeof URLSearchParams === 'function' ? new URLSearchParams(g.location?.search ?? '').get('fadeStrength') : null;
  const raw = g.__canalRecallFadeStrength ?? fromUrl;
  const n = raw === null || raw === undefined || raw === '' ? NaN : Number(raw);
  // Up to 2 so look review can also try stronger than the default; the player-facing range is 0..1.
  return Number.isFinite(n) ? Math.max(0, Math.min(2, n)) : 1;
}

/**
 * The player's "Distance haze" switch (preferences `distanceHaze`, default on). A global so every bundle's shared frame
 * reads the same switch; the game sets it when preferences apply (`setDistanceHaze`).
 */
export function distanceHazeOn(): boolean {
  return (globalThis as { __canalRecallDistanceHaze?: boolean }).__canalRecallDistanceHaze !== false;
}
export function setDistanceHaze(on: boolean): void {
  (globalThis as { __canalRecallDistanceHaze?: boolean }).__canalRecallDistanceHaze = !!on;
}
/** Fog range while the switch is off: out of reach, so the installed programs draw unfaded (no recompile). */
export const DEPTH_FADE_OFF_RANGE = { near: 1e7, far: 2e7 } as const;

/** The near/far multiples; `?depthFadeRange=1.2,6` (or `__canalRecallDepthFadeRange`) tunes them for look review. */
export function depthFadeMultiples(): [number, number] {
  const gl = globalThis as { __canalRecallDepthFadeRange?: string; location?: { search?: string } };
  const asked = (gl.__canalRecallDepthFadeRange ?? new URLSearchParams(gl.location?.search ?? '').get('depthFadeRange') ?? '').split(',').map(Number);
  return asked.length === 2 && asked.every(x => Number.isFinite(x) && x > 0) && asked[0] < asked[1] ? [asked[0], asked[1]] : [DEPTH_FADE_NEAR, DEPTH_FADE_FAR];
}

/** The closest start, metres; `?depthFadeMinNear=120` (or `__canalRecallDepthFadeMinNear`) tunes it for look review. */
export function depthFadeMinNear(): number {
  const gl = globalThis as { __canalRecallDepthFadeMinNear?: number | string; location?: { search?: string } };
  const n = Number(gl.__canalRecallDepthFadeMinNear ?? new URLSearchParams(gl.location?.search ?? '').get('depthFadeMinNear') ?? NaN);
  return Number.isFinite(n) && n > 0 ? n : DEPTH_FADE_MIN_NEAR_M;
}

/** The fade range, metres of eye distance, for an eye `eyeToCentreM` from the view centre. */
export function depthFadeRange(eyeToCentreM: number, multiples: readonly [number, number] = depthFadeMultiples(), minNearM = depthFadeMinNear()): { near: number; far: number } {
  const d = Number.isFinite(eyeToCentreM) && eyeToCentreM > 0 ? eyeToCentreM : 0;
  const near = Math.max(minNearM, d * multiples[0]);
  return { near, far: Math.max(near * 2, d * multiples[1]) };
}

const smooth = (a: number, b: number, x: number) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

/** The CPU twin of the fade on an output-space colour (0..1), `dist` metres from the eye. */
export function depthFadeColour(rgb: readonly [number, number, number], haze: readonly [number, number, number], dist: number, range: { near: number; far: number }, strength = depthFadeStrength()): [number, number, number] {
  const f = smooth(range.near, range.far, dist);
  const l = 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
  const de = DEPTH_FADE_DESATURATE * strength, hz = DEPTH_FADE_HAZE * strength;
  return rgb.map((c, i) => { const d = c + (l - c) * f * de; return d + (haze[i] - d) * f * hz; }) as [number, number, number];
}

/**
 * The facade detail weight (0 near, `strength` far, never past 1: beyond the cell's mean tint the blend would add
 * contrast back) at `dist` metres for a fade `range`.
 */
export function depthFadeDetail(dist: number, range: { near: number; far: number }, strength = depthFadeStrength()): number {
  const from = Math.max(DEPTH_FADE_DETAIL_FROM_M, range.near);
  return Math.min(1, strength) * smooth(from, Math.max(DEPTH_FADE_DETAIL_FULL_M, range.near + (range.far - range.near) * DEPTH_FADE_DETAIL_SPAN, from + 1), dist);
}

const g = (x: number) => (Number.isInteger(x) ? `${x}.0` : `${x}`);

/** fog_vertex measuring the eye distance of the eye-relative world. */
export const DEPTH_FADE_FOG_VERTEX = /* glsl */`#ifdef USE_FOG
	vFogDepth = length( mvPosition.xyz );
#endif`;

/** fog_fragment: desaturate, then part-way to the haze tone (`fogColor`), between fogNear and fogFar. */
export const depthFadeFogFragment = (strength = depthFadeStrength()): string => /* glsl */`#ifdef USE_FOG
	float fogFactor = smoothstep( fogNear, fogFar, vFogDepth );
	float fadeLuma = dot( gl_FragColor.rgb, vec3( 0.2126, 0.7152, 0.0722 ) );
	gl_FragColor.rgb = mix( gl_FragColor.rgb, vec3( fadeLuma ), fogFactor * ${g(DEPTH_FADE_DESATURATE * strength)} );
	gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor * ${g(DEPTH_FADE_HAZE * strength)} );
#endif`;
/** The fragment at full strength (the default). */
export const DEPTH_FADE_FOG_FRAGMENT = depthFadeFogFragment(1);

/**
 * The fog declarations, guarded: facade cell GLSL sits right after `#include <common>`, before three includes
 * fog_pars_fragment, so it declares them itself (DEPTH_FADE_DETAIL_PARS) and the chunk then skips them.
 */
const FOG_PARS = `uniform vec3 fogColor;
	varying float vFogDepth;
	#ifdef FOG_EXP2
		uniform float fogDensity;
	#else
		uniform float fogNear;
		uniform float fogFar;
	#endif`;
export const DEPTH_FADE_FOG_PARS_FRAGMENT = /* glsl */`#if defined( USE_FOG ) && ! defined( DEPTH_FADE_FOG_PARS )
	${FOG_PARS}
#endif`;
/** GLSL ahead of the facade cell functions: the fog declarations when the scene fades (USE_FOG), else nothing. */
export const DEPTH_FADE_DETAIL_PARS = /* glsl */`
#if defined( USE_FOG ) && ! defined( DEPTH_FADE_FOG_PARS )
#define DEPTH_FADE_FOG_PARS
	${FOG_PARS}
#endif
`;
/** GLSL (inside `#ifdef USE_FOG`, after DEPTH_FADE_DETAIL_PARS): the detail weight at `dist` metres. */
export const DEPTH_FADE_DETAIL_GLSL = (dist: string, strength = depthFadeStrength(), limit = drawLimitFlag()): string => {
  // With the draw limit (engine/drawLimit.ts) fogFar is packed: the gentle fade's far edge is unpacked from it.
  const far = limit ? DRAW_LIMIT_GENTLE_FAR_GLSL : 'fogFar';
  return `${g(Math.min(1, strength))} * smoothstep(max(${g(DEPTH_FADE_DETAIL_FROM_M)}, fogNear), max(max(${g(DEPTH_FADE_DETAIL_FULL_M)}, fogNear + (${far} - fogNear) * ${g(DEPTH_FADE_DETAIL_SPAN)}), max(${g(DEPTH_FADE_DETAIL_FROM_M)}, fogNear) + 1.0), ${dist})`;
};

const installed = new WeakSet<object>();
/** Swap three's fog chunks (once per three copy). Call before the first program compiles. */
export function installDepthFade(THREE: { ShaderChunk: Record<string, string> }): void {
  if (installed.has(THREE.ShaderChunk)) return;
  installed.add(THREE.ShaderChunk);
  THREE.ShaderChunk.fog_vertex = DEPTH_FADE_FOG_VERTEX;
  // `?drawLimit` (engine/drawLimit.ts, lane P2 #325): the same fade, then opaque haze at the draw limit.
  if (drawLimitFlag()) { const strength = depthFadeStrength(); THREE.ShaderChunk.fog_fragment = drawLimitFogFragment(DEPTH_FADE_DESATURATE * strength, DEPTH_FADE_HAZE * strength); }
  else THREE.ShaderChunk.fog_fragment = depthFadeFogFragment();
  THREE.ShaderChunk.fog_pars_fragment = DEPTH_FADE_FOG_PARS_FRAGMENT;
}

/** Material marker for a landmark's fog-free copy. */
export const DEPTH_FADE_OPT_OUT = 'canalRecallDepthFadeOptOut';

/** A landmark opt-out material: fog off, or (draw limit + landmarkHaze, lane P3 #328) the limit's ramp only. */
export function isDepthFadeOptOut(material: { fog?: boolean; userData?: Record<string, unknown> } | null | undefined): boolean {
  return !!material && (material.fog === false || !!material.userData?.[DEPTH_FADE_OPT_OUT]);
}

/**
 * Make `material` a landmark opt-out in place: fog off, or with `landmarkHaze` (engine/drawLimit.ts) its fog kept and
 * DEPTH_FADE_LIMIT_ONLY defined (a fresh defines object: a ShaderMaterial's may be shared with its source).
 */
export function optOutFog(material: { fog?: boolean; defines?: Record<string, unknown>; userData?: Record<string, unknown> }, limitHaze = landmarkHazeFlag()): void {
  // A material that never took fog (an unlit ShaderMaterial has no fog uniforms) stays fog-free.
  if (limitHaze && material.fog !== false) { material.defines = { ...(material.defines ?? {}), [DEPTH_FADE_LIMIT_ONLY]: '' }; }
  else material.fog = false;
  material.userData = { ...(material.userData ?? {}), [DEPTH_FADE_OPT_OUT]: true };
}

type FadeMaterial = {
  fog?: boolean; isShaderMaterial?: boolean; uniforms?: unknown; defines?: unknown; userData?: Record<string, unknown>;
  onBeforeCompile?: unknown; customProgramCacheKey?: unknown; clone(): FadeMaterial;
};
const optOutCopies = new WeakMap<object, FadeMaterial>();

/**
 * The fog-free twin of `material`, one per source material (landmarks sharing a material share its twin, and so
 * its program). The twin keeps the source's uniforms, defines and shader hooks, so a shared atlas or city-look
 * uniform still drives it. A material that already skips fog comes back as it is.
 */
export function depthFadeOptOutMaterial(material: FadeMaterial): FadeMaterial {
  if (!material || isDepthFadeOptOut(material)) return material;
  let copy = optOutCopies.get(material);
  if (!copy) {
    copy = material.clone();
    if (material.isShaderMaterial) copy.uniforms = material.uniforms;
    if (material.defines) copy.defines = material.defines;
    if (material.onBeforeCompile) copy.onBeforeCompile = material.onBeforeCompile;
    if (material.customProgramCacheKey) copy.customProgramCacheKey = material.customProgramCacheKey;
    copy.userData = { ...material.userData };
    optOutFog(copy as Parameters<typeof optOutFog>[0]);
    optOutCopies.set(material, copy);
  }
  return copy;
}

/**
 * Give every mesh under `root` the fog-free twins of its materials. Returns the meshes changed. `variantOf` resolves a
 * city-look material (shared per variant) to its `noFade` variant, so the highlight/dim swaps, which rebuild the
 * material from its variant, keep the landmark fog-free; other materials get a cloned twin.
 */
export function depthFadeOptOut(root: { traverse(fn: (o: any) => void): void }, variantOf?: (material: any) => any): number {
  const twin = (m: FadeMaterial): FadeMaterial => {
    if (isDepthFadeOptOut(m)) return m;
    const v = variantOf && m?.userData?.cityLook ? variantOf(m) : null;
    return v ?? depthFadeOptOutMaterial(m);
  };
  let meshes = 0;
  root.traverse((o: any) => {
    if (!o.isMesh || !o.material) return;
    if (Array.isArray(o.material)) {
      const next = o.material.map(twin);
      if (next.some((m: FadeMaterial, i: number) => m !== o.material[i])) { o.material = next; meshes++; }
    } else {
      const next = twin(o.material);
      if (next !== o.material) { o.material = next; meshes++; }
    }
  });
  return meshes;
}
