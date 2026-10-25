/**
 * Painted white trim of the building types (#78): window frames, door surrounds, sills, fascias, white bands, white doors
 * and railings.
 *
 * Why: the specs record the trim as near-white hexes (#efede6, #f2f0e8, #f0eee6 ...), but the generator routed them
 * through slots that turned them beige. A white `accent` went to the stone slot: `cityStoneTint` mixes it 45 % into the
 * city's sandstone #cfc8b8 (#efede6 -> #e1dcd1), and the stone cell's mean 228/255 darkens it again (the game drew it at
 * ~201 sRGB, r/b 1.08). A white `frame` went to the frame slot: `cityFrameTint` mixes it 75 % into the city's cream
 * #f1ede2 (r/b 1.06), which the sunny rig's warm key draws at (250, 237, 214) on a sun-facing wall. A white `column`
 * (fascia, bands) kept its stucco grain. The street photos show the trim neutral.
 *
 * What: a palette colour that is painted white (`isPaintedWhite`) is drawn as the measured `TRIM_WHITE` on the `paint`
 * slot (look/palette.ts: paint keeps its authored colour in every look path, on the flat white cell), or on the door slot
 * for doors and railings (the door cell keeps its plank lines; `cityDoorTint` also keeps the authored colour). Every
 * other colour keeps its slot and tint, so a spec without painted whites generates exactly as before.
 */
import {type MaterialKey} from './mesh.ts';

/**
 * The measured trim white, sRGB.
 *
 * Hue: the light-trim whites of street crops are neutral. The medians are r/b 0.99 and g/b 1.00 over the 213 house
 * crops (scripts/building-recipes/houses/<house>/measured.json `normalisation.ref`), r/b 0.98 and g/b 1.00 over the 99
 * sunlit building-type crops (.cache/building-types/sunlit), and r/b 1.02 and g/b 1.02 over 24 evidence crops of nn-row,
 * th-gk-row, nw-ee-buff-row, nn-cottage and nn-band. So the white is grey-neutral.
 *
 * Level: the brightest neutral white that every trim face keeps under clipping in the sunny look. The sunny rig (look/
 * sunny.ts SUNNY_LIGHT) gives a level face (sill and hood tops, band tops) a per-channel irradiance of (1.116, 1.116,
 * 1.111) and a wall facing the sun (1.086, 0.987, 0.876). At #ebebeb these draw 247 and (244, 236, 223); a wall in shade
 * draws ~(178, 182, 185). #eeeeee drew sill tops at 250. This is also about the level the city draws white render at:
 * cityStuccoTint(#ffffff) on the stucco cell is ~237. The exposure is unchanged.
 */
export const TRIM_WHITE = '#ebebeb';

/** Lightest HSL lightness and largest RGB spread (max - min channel, 0-255) of a colour taken as painted white. */
export const PAINTED_WHITE_MIN_L = 0.88;
export const PAINTED_WHITE_MAX_SPREAD = 16;

/**
 * True when an authored palette colour is painted white trim rather than cream render, buff concrete or a coloured
 * paint. Spec whites are L 0.88-0.95 with a spread of 4-16. Creams (#e9e3d2, #ece6d6, #efe9da, #e4dfd0) have a spread of
 * 20 or more, or L under 0.88, and keep their slot.
 */
export function isPaintedWhite(hex: string): boolean {
  if (!/^#[0-9a-f]{6}$/i.test(hex)) return false;
  const c = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
  const max = Math.max(...c), min = Math.min(...c), l = (max + min) / 2 / 255;
  return l >= PAINTED_WHITE_MIN_L && max - min <= PAINTED_WHITE_MAX_SPREAD;
}

/** Palette keys whose white is the trim white, and the slot each draws on. */
export const WHITE_TRIM_SLOT = {frame: 'paint', accent: 'paint', column: 'paint', door: 'door', rail: 'door'} as const;
export type WhiteTrimKey = keyof typeof WHITE_TRIM_SLOT;

/** The material key of a palette colour: the trim white when it is painted white, else `fallback` (the slot it always had). */
export function trimKey(name: WhiteTrimKey, hex: string, fallback: MaterialKey): MaterialKey {
  return isPaintedWhite(hex) ? {slot: WHITE_TRIM_SLOT[name], tint: TRIM_WHITE} : fallback;
}

/** The palette keys `generate` reads for the five trim colours, with the slot each had before #78. */
const BEFORE_SLOT: Record<WhiteTrimKey, MaterialKey['slot']> = {frame: 'frame', accent: 'stone', column: 'stucco', door: 'door', rail: 'door'};

type Tinted = {slot: string; tint: string; measured?: boolean};
interface TrimPalette { frame: string; accent: string; column: string; door: string; rail: string; wall: Tinted; plinth?: Tinted; gable?: Tinted; roof: Tinted }

/**
 * Material-only re-export of units generated before #78 (regen-units.ts --white-only): for one variant palette, the
 * published material id (`slot|tint`, mesh.ts materialId) of each painted-white trim colour and the key `generate` now
 * gives it. `conflicts` lists published ids that a wall, plinth, gable or roof also used: those primitives mix trim and
 * wall, so a material swap would repaint the wall and the unit needs a full regeneration instead.
 */
export function whiteTrimRemap(p: TrimPalette): {remap: Map<string, MaterialKey>; conflicts: string[]} {
  const remap = new Map<string, MaterialKey>();
  for (const name of Object.keys(WHITE_TRIM_SLOT) as WhiteTrimKey[]) {
    const hex = p[name];
    if (isPaintedWhite(hex)) remap.set(`${BEFORE_SLOT[name]}|${hex}`, {slot: WHITE_TRIM_SLOT[name], tint: TRIM_WHITE});
  }
  const walls = [p.wall, p.plinth, p.gable, p.roof].filter((t): t is Tinted => !!t).map(t => `${t.slot}|${t.tint}${t.measured ? '|measured' : ''}`);
  return {remap, conflicts: walls.filter(id => remap.has(id))};
}
