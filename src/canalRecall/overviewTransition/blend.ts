// The flat overview → shaded city transition as one curve (pure).
//
// Before (2026-10-16, user "the transition from the map-colored flat overview to our shaded city is jarring"):
// at map zoom 15 the own ground appeared, the basemap flipped from the map's white streets and light-blue water
// to the own-ground palette, and the sun's shadows switched on, all in one frame (scripted zoom over the
// Westerstraat: ΔL −80, 74 % of pixels moved by more than ΔE 20 between two 100 ms frames).
//
// Now one blend `b` (0 = flat overview, 1 = shaded city) drives everything that used to switch: the own ground
// dissolves in (screen-door dither), cast shadows ramp their intensity, the three.js buildings emerge, all from
// zoom 14 to 15.6 on a smoothstep. The basemap keeps the own-ground palette at every zoom, so the flat overview is
// already in the city's colours and the blend only adds relief, texture and light.
//
// `?transition=0` (or `window.__canalRecallTransition = false`) gives the old hard switches for A/B.

export const TRANSITION_DEFAULT = true;
/** Map zoom where the city starts to show (b = 0 below) and where it is complete (b = 1 above). */
export const BLEND_START_ZOOM = 14;
export const BLEND_END_ZOOM = 15.6;
/** The city is drawn once b rises above ON and stops once it falls below OFF (never flickers on a jittering zoom). */
export const BLEND_ON = 0.02;
export const BLEND_OFF = 0.005;

/** Whether the continuous transition is on (default) or the old hard switches (`?transition=0`). */
export function transitionOn(search?: string): boolean {
  const g = globalThis as { __canalRecallTransition?: unknown; location?: { search?: string } };
  if (typeof g.__canalRecallTransition === 'boolean') return g.__canalRecallTransition;
  const m = /[?&]transition=([^&]*)/.exec(search ?? g.location?.search ?? '');
  if (m && /^(0|false|off)$/.test(m[1])) return false;
  if (m && /^(1|true|on)$/.test(m[1])) return true;
  return TRANSITION_DEFAULT;
}

const smoothstep = (t: number) => { const x = Math.max(0, Math.min(1, t)); return x * x * (3 - 2 * x); };

/** The blend at a map zoom: 0 at and below BLEND_START_ZOOM, 1 at and above BLEND_END_ZOOM, smoothstep between. */
export function blendAtZoom(zoom: number, start = BLEND_START_ZOOM, end = BLEND_END_ZOOM): number {
  if (!Number.isFinite(zoom)) return 0;
  return smoothstep((zoom - start) / (end - start));
}

/**
 * The blend with a hysteresis on whether the city is drawn at all. `value` is the curve itself (continuous, so it
 * cannot pop); `active` turns on above BLEND_ON and off below BLEND_OFF, and while inactive `value` reads 0.
 */
export class OverviewBlend {
  active = false;
  value = 0;
  private raw = 0;
  constructor(readonly start = BLEND_START_ZOOM, readonly end = BLEND_END_ZOOM) {}
  update(zoom: number): number {
    this.raw = blendAtZoom(zoom, this.start, this.end);
    if (!this.active && this.raw > BLEND_ON) this.active = true;
    else if (this.active && this.raw < BLEND_OFF) this.active = false;
    this.value = this.active ? this.raw : 0;
    return this.value;
  }
}

/** The share of the window over which a surface becomes present (dithered in) while it still wears the flat colour. */
export const PRESENCE_SPAN = 0.4;
/** Presence (screen-door coverage) at blend `b`: full by PRESENCE_SPAN; the colour then carries the rest of the blend. */
export function presenceOf(b: number): number { return Math.max(0, Math.min(1, b / PRESENCE_SPAN)); }

/** The legacy hard switch (`?transition=0`): the city is all or nothing at `minZoom`. */
export function legacyBlend(zoom: number, minZoom = 15): number { return zoom >= minZoom ? 1 : 0; }

/** GLSL: discard a fragment of a surface at blend `b` (screen-door dither, the cell arrival's hash). */
export const DITHER_DISCARD_GLSL = (uniform: string) =>
  `if (${uniform} < 1.0 && fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) >= ${uniform}) discard;`;
