// Ground palette variants for the own ground (`?groundLook=measured|bright|legacy-ish`), colour only (pure).
//
// The user's "city too dark" (2026-10-14) after the light lane's flat-ground gain: own ground drew road 99 /
// pavement 150 / water 105 against the legacy basemap's 234 / 246 / 187 at the Singelgracht boat spot, and the
// gap is palette. Three candidates sit beside today's palette (`default`, unchanged until the user picks one);
// docs/ground-tones-20261014.md has the measurements and the frames.
//
//   measured    PDOK 8 cm orthophoto, dehazed, sunlit medians (scripts/own-ground/measure-ground-tones.ts) over
//               the Singelgracht, Houtmankade and Prinsengracht: asphalt, pavement and cycle red all sit at luma
//               ~165 from above, klinker ~148, so the legend there is hue, not lightness. Legend floor: klinker
//               and cycle chroma raised (cycle along the panoramas' red hue, 26–30°) until asphalt, klinker and
//               cycle are ΔE76 ≥ 20 apart; luma kept. Water is the nadir median (dark, near-neutral).
//   bright      measured hues, road at luma 130 and pavement 175; klinker and cycle keep their measured ratio to
//               the road; a lighter grey-green canal (luma 118).
//   legacy-ish  toward the legacy basemap's near-white streets: road 200, pavement 215, pale grey-green water 170;
//               land, squares and paving lifted with it so a pavement is not brighter than the square it meets.
//
// Only ground surfaces change: facades, roofs, trees, hedges, furniture, bollards, rails and lane paint keep
// their colours, and the materials are the same (no perf difference: a variant is a different base colour).

import { GROUND_TONES, STREET_GROUND, type RGB } from '../look/palette.js';

export type GroundLook = 'default' | 'measured' | 'bright' | 'legacy-ish';
export const GROUND_LOOKS: readonly GroundLook[] = ['default', 'measured', 'bright', 'legacy-ish'];

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

/** The look from the page: `?groundLook=` or `window.__canalRecallGroundLook`; anything else is `default`. */
export function groundLookFrom(search?: string): GroundLook {
  const g = globalThis as { __canalRecallGroundLook?: string; location?: { search?: string } };
  const m = /[?&]groundLook=([\w-]+)/.exec(search ?? g.location?.search ?? '');
  const v = m?.[1] ?? g.__canalRecallGroundLook;
  return (GROUND_LOOKS as readonly string[]).includes(v ?? '') ? v as GroundLook : 'default';
}

const hex = (c: RGB) => '#' + c.map(v => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');
/** A joint the same fraction of its base as today's (klinker 0.62, pavement 0.72), so mortar stays proportionate. */
const joint = (c: RGB, k: number) => hex([c[0] * k, c[1] * k, c[2] * k]);

/** Per-look street and surface tones (sRGB). `default` is today's palette, untouched. */
export const GROUND_LOOK_TONES: Readonly<Record<Exclude<GroundLook, 'default'>, {
  asphalt: RGB; cycle: RGB; klinker: RGB; pavement: RGB; water: RGB; kerb?: string;
  land?: RGB; paving?: RGB; square?: RGB; parking: RGB; parkPath: RGB;
}>> = {
  measured: {
    asphalt: [168, 166, 157], pavement: [172, 164, 151], klinker: [172, 133, 108], cycle: [242, 145, 142],
    water: [50, 55, 55], land: [172, 164, 151], paving: [176, 168, 155], square: [180, 172, 158], parking: [160, 158, 151], parkPath: [174, 172, 164],
  },
  bright: {
    asphalt: [132, 130, 124], pavement: [183, 174, 161], klinker: [138, 101, 78], cycle: [204, 107, 106],
    water: [104, 122, 114], land: [185, 174, 156], paving: [194, 184, 167], square: [198, 187, 169], parking: [126, 125, 120], parkPath: [142, 140, 134],
  },
  'legacy-ish': {
    asphalt: [202, 200, 193], pavement: [222, 214, 202], klinker: [199, 159, 134], cycle: [255, 167, 163],
    water: [154, 175, 167], kerb: '#e6e2d9', land: [200, 190, 172], paving: [214, 204, 188], square: [218, 208, 190],
    parking: [192, 191, 185], parkPath: [206, 204, 197],
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
