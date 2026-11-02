// Ground-marking fade (#161 design note lever 2, "make the chase-cam frame less busy"). Beyond ~120 m the road paint
// (centre lines, lane lines, zebra crossings: ground layer `paint`) and the red cycle-path surface (`cycle`) blend into
// the carriageway asphalt they sit on, so the far ground stops reading as a web of thin high-contrast lines. Kerbs and
// bollards are not touched (they already drop out at 150 m).
//
// The blend is on the surface colour (`diffuseColor`, before lighting), so a faded line is lit like the asphalt
// around it. The start scales with the camera like the depth fade (look/depthFade.ts): never closer than 120 m and not
// before the depth fade's own start, so a high camera's whole frame does not lose its markings and the near field is
// pixel-unchanged (the weight is exactly 0 closer than the start).
//
// Every ground program carries the edit when the flag is on (one program per kind, as before: a layer that is not a
// marking has strength 0), so the program count does not change. The range lives in uniforms shared through a global,
// because the shared frame (engine bundle) sets them and the ground (own-ground bundle) reads them.
//
// On by default for every look after the #161 look review (the far red strands are chroma edges, the horizon's
// "spaghetti"); `?markingFade=0` (or `__canalRecallMarkingFade = false` before load) turns it off, and then the
// ground's shaders are exactly as before.

import { depthFadeRange } from './depthFade.js';

export const MARKING_FADE_DEFAULT = true;
/** The fade never starts closer than this, metres... */
export const MARKING_FADE_FROM_M = 120;
/** ...and is full this far past its start. */
export const MARKING_FADE_SPAN_M = 100;
/** How far each marking layer goes toward the asphalt: paint all the way, the cycle network keeps a hint of red. */
export const MARKING_FADE_STRENGTH: Readonly<Record<'paint' | 'cycle', number>> = { paint: 1, cycle: 0.7 };

export function markingFadeFlag(): boolean {
  const g = globalThis as { __canalRecallMarkingFade?: boolean | string; location?: { search?: string } };
  const asked = g.__canalRecallMarkingFade ?? new URLSearchParams(g.location?.search ?? '').get('markingFade');
  if (asked === true || asked === '1' || asked === 'true' || asked === 'on') return true;
  if (asked === false || asked === '0' || asked === 'false' || asked === 'off') return false;
  return MARKING_FADE_DEFAULT;
}

/** The fade range, metres of eye distance, for an eye `eyeToCentreM` from the view centre. */
export function markingFadeRange(eyeToCentreM: number, multiples?: readonly [number, number]): { from: number; to: number } {
  const from = Math.max(MARKING_FADE_FROM_M, depthFadeRange(eyeToCentreM, multiples).near);
  return { from, to: from + MARKING_FADE_SPAN_M };
}

/** The weight (0 near, `strength` far) a marking moves toward the asphalt at `dist` metres. */
export function markingFadeWeight(dist: number, range: { from: number; to: number }, strength: number): number {
  const t = Math.max(0, Math.min(1, (dist - range.from) / (range.to - range.from)));
  return strength * t * t * (3 - 2 * t);
}

export type MarkingFadeUniforms = { ownMarkFrom: { value: number }; ownMarkTo: { value: number } };
/** The range uniforms every ground program shares (one object per page; starts out of reach). */
export function markingFadeUniforms(): MarkingFadeUniforms {
  const g = globalThis as { __canalRecallMarkingFadeUniforms?: MarkingFadeUniforms };
  return g.__canalRecallMarkingFadeUniforms ??= { ownMarkFrom: { value: 1e9 }, ownMarkTo: { value: 2e9 } };
}

/** Vertex edit (after `#include <project_vertex>`): the eye distance (the shared frame's world is eye-relative). */
export const MARKING_FADE_VERTEX = '\nvOwnEyeDist = length(mvPosition.xyz);';
export const MARKING_FADE_VERTEX_PARS = '\nvarying float vOwnEyeDist;';
export const MARKING_FADE_FRAGMENT_PARS = '\nvarying float vOwnEyeDist;\nuniform vec3 ownMarkTone;\nuniform float ownMarkStrength;\nuniform float ownMarkFrom;\nuniform float ownMarkTo;';
/** Fragment edit (after `#include <color_fragment>`): the surface colour toward the asphalt's. */
export const MARKING_FADE_FRAGMENT = '\nif (ownMarkStrength > 0.0) diffuseColor.rgb = mix(diffuseColor.rgb, ownMarkTone, ownMarkStrength * smoothstep(ownMarkFrom, ownMarkTo, vOwnEyeDist));';
