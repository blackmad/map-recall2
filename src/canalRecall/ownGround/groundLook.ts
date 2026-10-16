// The own ground's palette, colour only (pure).
//
// The user's "city too dark" (2026-10-14) after the light lane's flat-ground gain: own ground drew road 99 /
// pavement 150 / water 105 against the legacy basemap's 234 / 246 / 187 at the Singelgracht boat spot, and the
// gap is palette. docs/ground-tones-20261014.md has the measurements and the frames. The user picked `bright`;
// the `measured` and `legacy-ish` candidates and the `?groundLook=` flag were deleted 2026-10-16 (HISTORY).
//
//   default     palette.ts as it is (the base the bright look patches; unit tests and the far-ring fallback).
//   bright      measured hues (PDOK 8 cm orthophoto, dehazed sunlit medians), road at luma 130 and pavement 175;
//               klinker and cycle keep their measured ratio to the road; a sunny canal blue, 4f86a3 at luma ~123
//               (user 2026-10-16: "just pick a good blue").
//
// Only ground surfaces change: facades, roofs, trees, hedges, furniture, bollards, rails and lane paint keep
// their colours, and the materials are the same.

import { GROUND_TONES, STREET_GROUND, type RGB } from '../look/palette.js';

export type GroundLook = 'default' | 'bright';

export interface StreetGroundPalette {
  asphalt: { base: RGB };
  cycle: { base: RGB };
  klinker: { base: RGB; joint: string };
  pavement: { base: RGB; joint: string };
  kerb: string; paint: string; rail: string; bollard: string;
}
/** A palette.ts table with its literal hex strings widened, so a look can put its own there. */
type Widen<T> = T extends string ? string : T extends RGB ? RGB : { readonly [K in keyof T]: Widen<T[K]> };
export type GroundTonesPalette = Widen<typeof GROUND_TONES>;
export interface GroundPalette { street: StreetGroundPalette; tones: GroundTonesPalette }

/** The look the game ships with (user 2026-10-14, "city too dark": `bright`). */
export const GROUND_LOOK_DEFAULT: GroundLook = 'bright';

const hex = (c: RGB) => '#' + c.map(v => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');
/** A joint the same fraction of its base as today's (klinker 0.62, pavement 0.72), so mortar stays proportionate. */
const joint = (c: RGB, k: number) => hex([c[0] * k, c[1] * k, c[2] * k]);

/** Per-look street and surface tones (sRGB). `default` is today's palette, untouched. */
export const GROUND_LOOK_TONES: Readonly<Record<Exclude<GroundLook, 'default'>, {
  asphalt: RGB; cycle: RGB; klinker: RGB; pavement: RGB; water: RGB; kerb?: string;
  land?: RGB; paving?: RGB; square?: RGB; parking: RGB; parkPath: RGB;
}>> = {
  bright: {
    asphalt: [132, 130, 124], pavement: [183, 174, 161], klinker: [138, 101, 78], cycle: [204, 107, 106],
    water: [79, 134, 163], land: [185, 174, 156], paving: [194, 184, 167], square: [198, 187, 169], parking: [126, 125, 120], parkPath: [142, 140, 134],
  },
};

const cache = new Map<GroundLook, GroundPalette>();
/** The street and surface palette of a look (`default` returns the palette.ts objects themselves). */
export function groundPalette(look: GroundLook = 'default'): GroundPalette {
  if (look === 'default') return { street: STREET_GROUND, tones: GROUND_TONES };
  const hit = cache.get(look); if (hit) return hit;
  const t = GROUND_LOOK_TONES[look], G = GROUND_TONES;
  const water = hex(t.water);
  const out: GroundPalette = {
    street: {
      ...STREET_GROUND,
      asphalt: { base: t.asphalt }, cycle: { base: t.cycle },
      klinker: { base: t.klinker, joint: joint(t.klinker, 0.62) },
      pavement: { base: t.pavement, joint: joint(t.pavement, 0.72) },
      kerb: t.kerb ?? STREET_GROUND.kerb,
    },
    tones: {
      ...G,
      land: t.land ? { base: t.land, joint: joint(t.land, 0.79) } : G.land,
      paving: t.paving ? { base: t.paving, joint: joint(t.paving, 0.78) } : G.paving,
      square: t.square ? { base: t.square, joint: joint(t.square, 0.79) } : G.square,
      parking: t.parking, parkPath: t.parkPath, water, pond: water,
      kerb: t.kerb ?? G.kerb,
    },
  };
  cache.set(look, out);
  return out;
}
