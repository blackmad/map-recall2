// Toon front palette retune (#161 toon step 2 open question: "the loud lavender, teal and yellow fronts read random at
// chase-cam distance"). Under `?look=toon` the Cartoon buildings palette (look/palette.ts CARTOON_WALLS, the
// ILLUSTRATED wall/accent sets, the cartoon ground-floor paints) is replaced by Amsterdam's own front colours: brick
// reds, oxblood, dark green, black, cream and buff. Chroma is left to the toon pass (+45 % where colour exists), so the
// result stays bold but the hues are ones a player has seen on a real street. Bold signal colours (sign yellow, door
// blue) remain only as small accents. `?toonFronts=candy` restores the old palette under toon; the default look and the
// plain Cartoon buildings look (`?buildings3d=cartoon` without toon) are untouched.

import { toonLookFlag } from '../engine/toonLook';

export const TOON_FRONT_BRICK = ['#a8503a', '#9a4a38', '#8c4632', '#b05a40', '#7a3b2c'] as const;
export const TOON_FRONT_DARK = ['#2b2d2c', '#2f4a3a', '#5a2a26', '#25344a'] as const;
export const TOON_FRONT_LIGHT = ['#e8dfc9', '#f1eee6', '#d3b184', '#e2d5ba'] as const;

/** Wall sets: brick weighted the way the streets are, a little dark paint, cream and buff. */
export const TOON_WALLS: readonly string[] = [
  TOON_FRONT_BRICK[0], TOON_FRONT_BRICK[0], TOON_FRONT_BRICK[1], TOON_FRONT_BRICK[2], TOON_FRONT_BRICK[3], TOON_FRONT_BRICK[4],
  TOON_FRONT_DARK[0], TOON_FRONT_DARK[1], TOON_FRONT_DARK[2], TOON_FRONT_LIGHT[0], TOON_FRONT_LIGHT[2],
];
export const TOON_ACCENTS: readonly string[] = ['#2f4a3a', '#25344a', '#5a2a26', '#2b2d2c', '#e0a526'];

export const TOON_PERIOD_WALLS = {
  canal: [TOON_FRONT_BRICK[4], TOON_FRONT_BRICK[4], TOON_FRONT_BRICK[1], TOON_FRONT_BRICK[2], TOON_FRONT_DARK[0], TOON_FRONT_DARK[1], TOON_FRONT_LIGHT[0]],
  c19: [TOON_FRONT_BRICK[0], TOON_FRONT_BRICK[3], TOON_FRONT_BRICK[1], TOON_FRONT_LIGHT[3], TOON_FRONT_LIGHT[2], TOON_FRONT_LIGHT[0]],
  school: [TOON_FRONT_BRICK[2], TOON_FRONT_BRICK[4], TOON_FRONT_BRICK[1], TOON_FRONT_BRICK[3]],
} as const;
export const TOON_GROUND_PAINTS: readonly string[] = ['#f1eee6', '#f1eee6', '#f1eee6', '#e8dfc9', '#e8dfc9', '#2b2d2c', '#2f4a3a', '#5a2a26', '#25344a', '#8b8f8c'];

/** Active under `?look=toon` unless `?toonFronts=candy` (or `__canalRecallToonFronts = 'candy'`) asks for the old palette. */
export function toonFrontsActive(): boolean {
  if (!toonLookFlag()) return false;
  const g = globalThis as { __canalRecallToonFronts?: string; location?: { search?: string } };
  return (g.__canalRecallToonFronts ?? (typeof URLSearchParams === 'function' ? new URLSearchParams(g.location?.search ?? '').get('toonFronts') : null)) !== 'candy';
}
