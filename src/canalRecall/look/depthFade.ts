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
// `?depthFade=1` turns it on, `?depthFade=0` off (or `__canalRecallDepthFade` before load); default off until the
// look review (DEPTH_FADE_DEFAULT). Off, nothing is installed and every program is as before.

export const DEPTH_FADE_DEFAULT = false;
/** The fade starts at this multiple of the eye-to-centre distance... */
export const DEPTH_FADE_NEAR = 0.8;
/** ...and is full at this multiple. */
export const DEPTH_FADE_FAR = 3.5;
/** Never fade closer than this, metres: the street ahead stays exactly as drawn. */
export const DEPTH_FADE_MIN_NEAR_M = 80;
/** At full fade: share of the saturation removed... */
export const DEPTH_FADE_DESATURATE = 0.7;
/** ...and the share of the way to the haze tone (the rest of the contrast survives: not a fog to one colour). */
export const DEPTH_FADE_HAZE = 0.55;
/**
 * Facade cell detail (panes, trim) blends to the cell's mean tint from the later of 150 m and the fade's start, and is
 * gone at the later of 320 m and 40 % of the way to the fade's end: the chase cam keeps the street's windows, a high
 * camera's whole frame does not lose them at once.
 */
export const DEPTH_FADE_DETAIL_FROM_M = 150;
export const DEPTH_FADE_DETAIL_FULL_M = 320;
export const DEPTH_FADE_DETAIL_SPAN = 0.4;

export function depthFadeFlag(): boolean {
  const g = globalThis as { __canalRecallDepthFade?: boolean | string; location?: { search?: string } };
  const asked = g.__canalRecallDepthFade ?? new URLSearchParams(g.location?.search ?? '').get('depthFade');
  if (asked === true || asked === '1' || asked === 'true' || asked === 'on') return true;
  if (asked === false || asked === '0' || asked === 'false' || asked === 'off') return false;
  return DEPTH_FADE_DEFAULT;
}

/** The near/far multiples; `?depthFadeRange=1.2,6` (or `__canalRecallDepthFadeRange`) tunes them for look review. */
export function depthFadeMultiples(): [number, number] {
  const gl = globalThis as { __canalRecallDepthFadeRange?: string; location?: { search?: string } };
  const asked = (gl.__canalRecallDepthFadeRange ?? new URLSearchParams(gl.location?.search ?? '').get('depthFadeRange') ?? '').split(',').map(Number);
  return asked.length === 2 && asked.every(x => Number.isFinite(x) && x > 0) && asked[0] < asked[1] ? [asked[0], asked[1]] : [DEPTH_FADE_NEAR, DEPTH_FADE_FAR];
}

/** The fade range, metres of eye distance, for an eye `eyeToCentreM` from the view centre. */
export function depthFadeRange(eyeToCentreM: number, multiples: readonly [number, number] = depthFadeMultiples()): { near: number; far: number } {
  const d = Number.isFinite(eyeToCentreM) && eyeToCentreM > 0 ? eyeToCentreM : 0;
  const near = Math.max(DEPTH_FADE_MIN_NEAR_M, d * multiples[0]);
  return { near, far: Math.max(near * 2, d * multiples[1]) };
}

const smooth = (a: number, b: number, x: number) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

/** The CPU twin of the fade on an output-space colour (0..1), `dist` metres from the eye. */
export function depthFadeColour(rgb: readonly [number, number, number], haze: readonly [number, number, number], dist: number, range: { near: number; far: number }): [number, number, number] {
  const f = smooth(range.near, range.far, dist);
  const l = 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
  return rgb.map((c, i) => { const d = c + (l - c) * f * DEPTH_FADE_DESATURATE; return d + (haze[i] - d) * f * DEPTH_FADE_HAZE; }) as [number, number, number];
}

/** The facade detail weight (0 near, 1 far) at `dist` metres for a fade `range`. */
export function depthFadeDetail(dist: number, range: { near: number; far: number }): number {
  const from = Math.max(DEPTH_FADE_DETAIL_FROM_M, range.near);
  return smooth(from, Math.max(DEPTH_FADE_DETAIL_FULL_M, range.near + (range.far - range.near) * DEPTH_FADE_DETAIL_SPAN, from + 1), dist);
}

const g = (x: number) => (Number.isInteger(x) ? `${x}.0` : `${x}`);

/** fog_vertex measuring the eye distance of the eye-relative world. */
export const DEPTH_FADE_FOG_VERTEX = /* glsl */`#ifdef USE_FOG
	vFogDepth = length( mvPosition.xyz );
#endif`;

/** fog_fragment: desaturate, then part-way to the haze tone (`fogColor`), between fogNear and fogFar. */
export const DEPTH_FADE_FOG_FRAGMENT = /* glsl */`#ifdef USE_FOG
	float fogFactor = smoothstep( fogNear, fogFar, vFogDepth );
	float fadeLuma = dot( gl_FragColor.rgb, vec3( 0.2126, 0.7152, 0.0722 ) );
	gl_FragColor.rgb = mix( gl_FragColor.rgb, vec3( fadeLuma ), fogFactor * ${g(DEPTH_FADE_DESATURATE)} );
	gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor * ${g(DEPTH_FADE_HAZE)} );
#endif`;

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
export const DEPTH_FADE_DETAIL_GLSL = (dist: string): string => `smoothstep(max(${g(DEPTH_FADE_DETAIL_FROM_M)}, fogNear), max(max(${g(DEPTH_FADE_DETAIL_FULL_M)}, fogNear + (fogFar - fogNear) * ${g(DEPTH_FADE_DETAIL_SPAN)}), max(${g(DEPTH_FADE_DETAIL_FROM_M)}, fogNear) + 1.0), ${dist})`;

const installed = new WeakSet<object>();
/** Swap three's fog chunks (once per three copy). Call before the first program compiles. */
export function installDepthFade(THREE: { ShaderChunk: Record<string, string> }): void {
  if (installed.has(THREE.ShaderChunk)) return;
  installed.add(THREE.ShaderChunk);
  THREE.ShaderChunk.fog_vertex = DEPTH_FADE_FOG_VERTEX;
  THREE.ShaderChunk.fog_fragment = DEPTH_FADE_FOG_FRAGMENT;
  THREE.ShaderChunk.fog_pars_fragment = DEPTH_FADE_FOG_PARS_FRAGMENT;
}
