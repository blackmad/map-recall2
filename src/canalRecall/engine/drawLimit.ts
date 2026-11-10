// Draw limit (lane P2, #325; user 2026-11-09: "I see stuff wayyyy in the distance popping in and out"). The depth fade
// (look/depthFade.ts) only ever goes 38 % of the way to the haze, so a far tier that arrives or leaves 1.5 km out shows
// through thin haze as a block. With the limit on, the haze reaches the full horizon colour at a fixed eye distance (the
// draw limit: ~2 km on the street, further from the air), and the far ring, far shells and landmark reach clamp to it,
// so every arrival beyond the limit happens inside opaque haze: the world gets a horizon instead of an edge.
//
// The fade rides three's linear fog uniforms (fogNear, fogFar): no new uniform, so no material changes. With the limit
// on, `fogFar` carries two numbers: its integer part is the limit (metres, where the haze is opaque) and its fraction
// the gentle fade's far/near ratio (the depth fade's own curve, `packFogFar`). The fog chunk unpacks them. With the
// limit off nothing here runs and the chunks are the depth fade's, byte for byte.
//
// `?drawLimit=0` (or `window.__canalRecallDrawLimit = false`) turns it off; `?drawLimitM=` sets the street limit and
// `?drawLimitAirM=` the aerial floor, for look review.

export const DRAW_LIMIT_DEFAULT = true;
/** Street: the haze is opaque at this eye distance, metres. */
export const DRAW_LIMIT_STREET_M = 2000;
/** Street: the gentle fade starts here (the detail swap at 250-300 m sits inside it; the depth fade's own floor is 200). */
export const DRAW_LIMIT_STREET_NEAR_M = 180;
/** From the air: the limit is this multiple of the eye-to-centre distance... */
export const DRAW_LIMIT_AIR_MULT = 6;
/** ...never under this and never over this, metres. */
export const DRAW_LIMIT_AIR_MIN_M = 4000;
export const DRAW_LIMIT_AIR_MAX_M = 9000;
/** The opaque ramp: the full-haze share climbs from this fraction of the limit to the limit. */
export const DRAW_LIMIT_RAMP_FROM = 0.45;
/** The gentle fade's far/near ratio is packed in [1, 1 + RATIO_SPAN). */
export const DRAW_LIMIT_RATIO_SPAN = 8;

type G = { __canalRecallDrawLimit?: boolean | string; __canalRecallDrawLimitM?: number | string; __canalRecallDrawLimitAirM?: number | string; location?: { search?: string } };
const param = (name: string): string | null => {
  const g = globalThis as G;
  // A regex, not URLSearchParams: bundles are also evaluated in Node checks without it.
  const m = new RegExp(`[?&]${name}=([^&]*)`).exec(g.location?.search ?? '');
  return m ? decodeURIComponent(m[1]) : null;
};

export function drawLimitFlag(): boolean {
  const g = globalThis as G;
  const asked = g.__canalRecallDrawLimit ?? param('drawLimit');
  if (asked === true || asked === '1' || asked === 'true' || asked === 'on') return true;
  if (asked === false || asked === '0' || asked === 'false' || asked === 'off') return false;
  return DRAW_LIMIT_DEFAULT;
}

const num = (v: unknown): number => { const n = Number(v); return v === null || v === undefined || v === '' || !Number.isFinite(n) || n <= 0 ? NaN : n; };
export function drawLimitStreetM(): number { const n = num((globalThis as G).__canalRecallDrawLimitM ?? param('drawLimitM')); return Number.isFinite(n) ? Math.max(400, n) : DRAW_LIMIT_STREET_M; }
export function drawLimitAirMinM(): number { const n = num((globalThis as G).__canalRecallDrawLimitAirM ?? param('drawLimitAirM')); return Number.isFinite(n) ? Math.max(1000, n) : DRAW_LIMIT_AIR_MIN_M; }

/**
 * The limit, metres of eye distance, for a view: on the street a fixed `streetM`; from the air (`aerial`,
 * rendererShared/aerialView.ts) DRAW_LIMIT_AIR_MULT x the eye-to-centre distance, clamped. Integer metres (packed).
 */
export function drawLimitM(aerial: boolean, eyeToCentreM: number, streetM = drawLimitStreetM(), airMinM = drawLimitAirMinM()): number {
  if (!aerial) return Math.round(streetM);
  const d = Number.isFinite(eyeToCentreM) && eyeToCentreM > 0 ? eyeToCentreM : 0;
  return Math.round(Math.max(airMinM, Math.min(DRAW_LIMIT_AIR_MAX_M, d * DRAW_LIMIT_AIR_MULT)));
}

/**
 * The fog range with the limit on: `near` the gentle fade's start (DRAW_LIMIT_STREET_NEAR_M on the street, the depth
 * fade's own start from the air), `far` the packed limit + gentle ratio. `gentle` is the depth fade's range for the view.
 */
export function drawLimitFogRange(gentle: { near: number; far: number }, limitM: number, aerial: boolean): { near: number; far: number } {
  const near = Math.min(aerial ? gentle.near : Math.min(gentle.near, DRAW_LIMIT_STREET_NEAR_M), limitM * DRAW_LIMIT_RAMP_FROM);
  // The street keeps the depth fade's gentle far (the haze it reached by ~400 m); the ratio is from the new start.
  const ratio = Math.max(1.01, Math.min(1 + DRAW_LIMIT_RATIO_SPAN - 0.01, gentle.far / near));
  return { near, far: packFogFar(limitM, ratio) };
}

/** fogFar = limit (integer metres) + (ratio - 1) / RATIO_SPAN in [0, 1). */
export function packFogFar(limitM: number, ratio: number): number {
  const frac = Math.max(0, Math.min(0.999, (ratio - 1) / DRAW_LIMIT_RATIO_SPAN));
  return Math.round(limitM) + frac;
}
/** The inverse, as the shader does it (in float32). */
export function unpackFogFar(fogFar: number): { limitM: number; ratio: number } {
  const f = Math.fround(fogFar), limitM = Math.floor(f);
  return { limitM, ratio: 1 + (f - limitM) * DRAW_LIMIT_RATIO_SPAN };
}

const smooth = (a: number, b: number, x: number) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

/** The weights at `dist`: the gentle fade (desaturation and part haze, as the depth fade) and the opaque ramp to the limit. */
export function drawLimitWeights(dist: number, fogNear: number, fogFar: number): { gentle: number; opaque: number; gentleFar: number; limitM: number } {
  const { limitM, ratio } = unpackFogFar(fogFar), gentleFar = fogNear * ratio;
  return { gentle: smooth(fogNear, gentleFar, dist), opaque: smooth(limitM * DRAW_LIMIT_RAMP_FROM, limitM, dist), gentleFar, limitM };
}

/** The CPU twin of the fragment (output-space colour 0..1): the depth fade's two mixes, then the opaque mix. */
export function drawLimitColour(rgb: readonly [number, number, number], haze: readonly [number, number, number], dist: number, fogNear: number, fogFar: number, desaturate: number, hazeShare: number): [number, number, number] {
  const w = drawLimitWeights(dist, fogNear, fogFar);
  const l = 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
  return rgb.map((c, i) => { let d = c + (l - c) * w.gentle * desaturate; d = d + (haze[i] - d) * w.gentle * hazeShare; return d + (haze[i] - d) * w.opaque; }) as [number, number, number];
}

const g = (x: number) => (Number.isInteger(x) ? `${x}.0` : `${x}`);
/** GLSL: the gentle fade's far edge, from the packed fogFar (needs fogNear / fogFar declared). */
export const DRAW_LIMIT_GENTLE_FAR_GLSL = `(fogNear * (1.0 + fract(fogFar) * ${g(DRAW_LIMIT_RATIO_SPAN)}))`;
/** fog_fragment with the limit: `desaturate` and `haze` the depth fade's shares (strength applied). */
export const drawLimitFogFragment = (desaturate: number, haze: number): string => /* glsl */`#ifdef USE_FOG
#ifndef DEPTH_FADE_LIMIT_ONLY
	float fogFactor = smoothstep( fogNear, ${DRAW_LIMIT_GENTLE_FAR_GLSL}, vFogDepth );
	float fadeLuma = dot( gl_FragColor.rgb, vec3( 0.2126, 0.7152, 0.0722 ) );
	gl_FragColor.rgb = mix( gl_FragColor.rgb, vec3( fadeLuma ), fogFactor * ${g(desaturate)} );
	gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor * ${g(haze)} );
#endif
	float limitFar = floor( fogFar );
	gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, smoothstep( limitFar * ${g(DRAW_LIMIT_RAMP_FROM)}, limitFar, vFogDepth ) );
#endif`;

/**
 * Landmarks under the limit (lane P3, #328): a landmark's materials opt out of the depth fade (look/depthFade.ts, #161:
 * the towers players steer by stay crisp), so a landmark kept resident past the limit (residency hysteresis, out to
 * 1.25 x the 2 km reach) drew crisp in opaque haze. With this on, the opt-out keeps fog with `DEPTH_FADE_LIMIT_ONLY`
 * defined: no gentle fade (still crisp up to DRAW_LIMIT_RAMP_FROM x the limit), but the opaque ramp to the limit.
 * `?landmarkHaze=0` restores fog-free landmarks; off with the limit off.
 */
export const LANDMARK_HAZE_DEFAULT = true;
export function landmarkHazeFlag(): boolean {
  if (!drawLimitFlag()) return false;
  const asked = (globalThis as { __canalRecallLandmarkHaze?: boolean | string }).__canalRecallLandmarkHaze ?? param('landmarkHaze');
  if (asked === true || asked === '1' || asked === 'true' || asked === 'on') return true;
  if (asked === false || asked === '0' || asked === 'false' || asked === 'off') return false;
  return LANDMARK_HAZE_DEFAULT;
}
/** The define that makes a material take only the limit's opaque ramp (see landmarkHazeFlag). */
export const DEPTH_FADE_LIMIT_ONLY = 'DEPTH_FADE_LIMIT_ONLY';

/**
 * The limit in force this frame, for the other bundles (far ring, far shells, landmark reach, probes): set by the shared
 * frame each frame while the limit is on; null when off or before the first frame. `from` / `to` are eye metres.
 */
export type DrawLimitNow = { from: number; to: number; aerial: boolean; eyeToCentreM: number };
export function publishDrawLimit(now: DrawLimitNow | null): void {
  const w = globalThis as { __canalRecallDrawLimitNowValue?: DrawLimitNow | null; __canalRecallDrawLimitNow?: () => DrawLimitNow | null };
  w.__canalRecallDrawLimitNowValue = now;
  w.__canalRecallDrawLimitNow ??= () => (globalThis as { __canalRecallDrawLimitNowValue?: DrawLimitNow | null }).__canalRecallDrawLimitNowValue ?? null;
}
export function currentDrawLimit(): DrawLimitNow | null {
  return (globalThis as { __canalRecallDrawLimitNowValue?: DrawLimitNow | null }).__canalRecallDrawLimitNowValue ?? null;
}

/**
 * A ground radius (metres from the subject, e.g. the far ring's) clamped to the limit: nothing is fetched or drawn past
 * the opaque haze. `subjectToEyeM` is the eye's ground distance from the subject (the limit is measured from the eye),
 * `stepM` rounds up to the caller's planning step. Unchanged with no limit in force.
 */
export function clampToDrawLimit(radiusM: number, limit: DrawLimitNow | null, subjectToEyeM = 0, stepM = 1): number {
  if (!limit || !(radiusM > 0)) return radiusM;
  const cap = Math.ceil((limit.to + Math.max(0, subjectToEyeM)) / stepM) * stepM;
  return Math.min(radiusM, cap);
}
