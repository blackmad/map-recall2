/**
 * Measured period walls with row coherence, behind `?walls=measured` (lane measured-period-walls, 2026-10-24).
 *
 * Why: the user, on a Nassaukade screenshot where 1860-1914 rows read red, orange, cream, buff and ochre: "I'm pretty
 * sure in real life these buildings are basically all the same color". Unmeasured buildings took `PERIOD_WALLS` (a
 * guessed list, the c19 one about half cream/buff/ochre stucco) hash-picked per building, so neighbours in one
 * uniform row differed. Here:
 *  - the lists are measured (measuredPeriodWalls.ts, scripts/look/measure-period-walls.ts: panorama crops of ordinary
 *    pands per period, read with the kit facts' crop reading, lifted by kitFacts.measuredWallDisplay);
 *  - a row (pands sharing a party wall, BAG years within ROW_YEAR_GAP; wallRows.ts, stamped offline into the
 *    building-facts tiles' `rows`) shares one base tone with a small per-building variation;
 *  - a building leaves its row's tone with probability ROW_BREAK (a repainted or rebuilt front), drawing again from
 *    the same measured list, so painted fronts stay at their measured share, never 1 in 3.
 * Pure: no DOM. Off by default; buildings with measured colours (chunks, recipes, kits, accepted readings) never
 * consult it.
 */
import { masonryFamily } from '../facade/cropWallColour.js';
import { rgbToLab } from './brickTone.js';
import { PERIOD_WALLS, hexToRgb, hslToRgb, periodForYear, rgbToHex, rgbToHsl, type Period } from './palette.js';
import { MEASURED_PERIOD_WALL_LISTS } from './measuredPeriodWalls.js';

/**
 * How a measured (normalised raw) wall reading is reported: brick, dull brick, buff brick, light paint/render, grey
 * render/concrete. `brick-dull` is what masonryFamily calls render (C* < 8) but reads warm (Lab hue 20-100) and dark
 * (L* < 60): the measured sample showed these are the dark brown brick fronts of overcast panoramas (median L* 35,
 * C* 5.6, hue 55-75 in every period), not painted fronts; the school fallback palettes read the same (#4d423c..).
 */
export type WallClass = 'brick' | 'brick-dull' | 'buff' | 'render-light' | 'render-grey';
export function wallClassOf(rgb: readonly number[]): WallClass {
  const family = masonryFamily(rgb);
  if (family === 'brick' || family === 'buff') return family;
  const [L, a, b] = rgbToLab([rgb[0], rgb[1], rgb[2]]), C = Math.hypot(a, b), h = ((Math.atan2(b, a) * 180) / Math.PI + 360) % 360;
  if (L >= 60) return 'render-light';
  return C >= 3 && h >= 20 && h <= 100 ? 'brick-dull' : 'render-grey';
}

/** `?walls=measured`, or `globalThis.CANAL_MEASURED_WALLS === true` (a window flag for strips and the console). */
export function measuredWallsEnabled(search: string = typeof location !== 'undefined' ? location.search : '', scope: unknown = globalThis): boolean {
  if (new URLSearchParams(search).get('walls') === 'measured') return true;
  return (scope as { CANAL_MEASURED_WALLS?: unknown } | null)?.CANAL_MEASURED_WALLS === true;
}

/** Share of a row's buildings that leave its tone (draw their own measured colour). */
export const ROW_BREAK = 0.12;
/** Per-building variation around the row tone: HSL lightness steps and hue steps (degrees). */
export const ROW_JITTER = { l: [-0.02, -0.01, 0, 0.01, 0.02], h: [-2, 0, 2] } as const;

const fnv = (s: string) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };

/** One building's small variation around its row's tone. */
export function jitterTone(hex: string, seed: number): string {
  const [h, s, l] = rgbToHsl(hexToRgb(hex));
  const dl = ROW_JITTER.l[seed % ROW_JITTER.l.length], dh = ROW_JITTER.h[(seed >>> 8) % ROW_JITTER.h.length];
  return rgbToHex(hslToRgb([(h + dh + 360) % 360, s, Math.max(0, Math.min(1, l + dl))]));
}

/**
 * The measured wall of an unmeasured building: its period's measured list, picked by its row (`rowSeed`, from the
 * building-facts tile) with a small per-building variation, or by its own id when it stands alone or breaks the row.
 */
export function measuredPeriodWall(id: string, period: Period, rowSeed?: string | null, lists: Readonly<Record<Period, readonly string[] | null>> = MEASURED_PERIOD_WALL_LISTS): string {
  // A period with too few measured pands keeps the guessed photo list, but still row by row.
  const list = lists[period] ?? PERIOD_WALLS.photo[period]!, own = fnv(id);
  const breaks = (own % 1000) / 1000 < ROW_BREAK;
  if (!rowSeed || breaks) return list[fnv(`${id}:own`) % list.length];
  return jitterTone(list[fnv(rowSeed) % list.length], own >>> 10);
}

/** The same for a building-facts row: null without a plausible year (those keep the period prior). */
export function measuredWallForYear(id: string, year: number | null | undefined, rowSeed?: string | null): string | null {
  return typeof year === 'number' && Number.isFinite(year) ? measuredPeriodWall(id, periodForYear(year), rowSeed) : null;
}
