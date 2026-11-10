// Lighting hierarchy (#161 lever 6, `?lightHier=1`, default off): a calmer frame has one clear key and a quieter fill.
// The sky/street bounce (the hemisphere term) drops LIGHT_HIER_AMBIENT of its strength and a cast shadow removes more of
// the sun (shadow fill 0.5 -> 0.38), so the sunlit side of a street reads as the subject and its shaded side steps back.
// The sun's own intensity and colour are untouched: the sunny rig solves the exposure so a measured wall facing the sun
// draws its measured colour, and that is evidence this flag must not move.

import type { LightRigOptions } from './lightRig';

export const LIGHT_HIER_AMBIENT = 0.85;
export const LIGHT_HIER_SHADOW = 0.62;

export function lightHierarchyFlag(search?: string): boolean {
  const g = globalThis as { __canalRecallLightHier?: boolean | string; location?: { search?: string } };
  const asked = g.__canalRecallLightHier ?? new URLSearchParams(search ?? g.location?.search ?? '').get('lightHier');
  return asked === true || asked === '1' || asked === 'true' || asked === 'on';
}

export function withLightHierarchy<T extends Required<LightRigOptions>>(rig: T): T {
  return { ...rig, skyIntensity: rig.skyIntensity * LIGHT_HIER_AMBIENT, shadowIntensity: Math.max(rig.shadowIntensity, LIGHT_HIER_SHADOW) };
}
