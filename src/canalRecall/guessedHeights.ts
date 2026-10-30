/**
 * Which source sets the height of an OSM-only outline that OSM gives no
 * height or levels (`osmHeightGuessed`, bagGaps.ts), instead of the 9 m
 * default (2026-10-30). In order:
 *
 * - OSM dates it in or after the newest flight's year: the guess stays (the
 *   new-build rules). OSM's start_date is BAG's bouwjaar, often set at the
 *   permit: 359 outlines dated 2023 and 250 dated 2022 were building sites
 *   in the 2023 flight. Where OSM has no date, the BAG pand under the
 *   outline gives it (`bag`); a pand only permitted or under construction is
 *   newer than any flight. The Martin and The Robin (Amstelkwartier, BAG
 *   2022) were sites in both flights.
 * - `building=houseboat`: AHN's ground around one is the quay, not the water,
 *   so it reads ~1 m; a houseboat is a small building (SMALL_HEIGHT_M).
 * - AHN4 (2020) for outlines built by 2019, AHN5 (2023) otherwise or where
 *   AHN4 sees no roof: The Robin and The Martin (Amstelkwartier) were a
 *   building site in 2020 and are 18 m in 2023.
 * - A footprint under SMALL_AREA_M2 reading taller than SMALL_TALL_M is
 *   someone else's roof, not its own: a 16 m2 shed of 2017 under a 45 m
 *   tower of 2022, cabinets in new blocks. It keeps its guess rather than
 *   standing as a thin column.
 * - A mixed AHN5 reading (ridge MIXED_RIDGE_M over p70) is a building going
 *   up, not a roof: the guess stays.
 * - Neither flight sees 2 m of roof over an outline OSM does not date after
 *   2019: a low slab at the measured ridge, at least LOW_MIN_M. Settling
 *   tanks, bunkers, switch cabinets and garage entrances stood as 9 m boxes.
 *   A newer outline AHN5 sees flat keeps its guess (a site in the flight).
 */
import { MAX_FILL_YEAR, MIN_FILL_HEIGHT_M, MIXED_RIDGE_M, type AhnHeights } from './bagGaps';
import { SMALL_AREA_M2, SMALL_HEIGHT_M } from './newBuildGaps';

export const AHN4_FLIGHT_YEAR = MAX_FILL_YEAR + 1;
/** The lowest a measured-low outline is drawn: a kerb-high slab, still a building in the tiles. */
export const LOW_MIN_M = 1;
/** The tallest a small footprint (< SMALL_AREA_M2) may read and still be its own roof. */
export const SMALL_TALL_M = 6;

/** BAG pand statuses of a building that stands (anything else is permitted, going up, or gone). */
const STANDING = new Set(['Pand in gebruik', 'Pand in gebruik (niet ingemeten)', 'Verbouwing pand']);
/** The year to judge an outline by: OSM start_date, else the BAG pand under it; Infinity when BAG has it going up. */
export function builtYear(tags: Record<string, unknown>, bag: { bouwjaar?: number; status?: string } | null): number {
  const osm = Number.parseInt(String(tags.start_date ?? ''), 10);
  if (Number.isFinite(osm)) return osm;
  if (bag?.status && !STANDING.has(bag.status)) return Infinity;
  return bag?.bouwjaar ?? Number.NaN;
}

export type GuessSource = 'ahn4' | 'ahn5' | 'houseboat' | 'low';
export interface GuessedHeight { height: number; eaves?: number; ridge?: number; source: GuessSource }

const r2 = (v: number) => Math.round(v * 100) / 100;
const fromAhn = (h: AhnHeights, source: GuessSource): GuessedHeight => ({
  height: h.height, ...(h.eaves >= MIN_FILL_HEIGHT_M ? { eaves: h.eaves } : {}), ...(h.ridge > h.height ? { ridge: r2(h.ridge) } : {}), source,
});

/** null: keep the guess (built after the newest flight, or no flight has samples). */
export function chooseGuessedHeight(input: {
  tags: Record<string, unknown>; built: number; areaM2: number; ahn4: AhnHeights | null; ahn5: AhnHeights | null; ahn5Year: number;
}): GuessedHeight | null {
  const built = input.built;
  if (built >= input.ahn5Year) return null;
  if (input.tags.building === 'houseboat') return { height: SMALL_HEIGHT_M, source: 'houseboat' };
  const tall = (h: AhnHeights | null): h is AhnHeights => !!h && h.height >= MIN_FILL_HEIGHT_M;
  const overhung = (h: AhnHeights | null) => input.areaM2 < SMALL_AREA_M2 && !!h && h.height > SMALL_TALL_M;
  if (overhung(built >= AHN4_FLIGHT_YEAR ? null : input.ahn4) || (!tall(input.ahn4) && overhung(input.ahn5))) return null;
  if (!(built >= AHN4_FLIGHT_YEAR) && tall(input.ahn4)) return fromAhn(input.ahn4, 'ahn4');
  if (input.ahn5 && input.ahn5.ridge - input.ahn5.height >= MIXED_RIDGE_M) return null;
  if (tall(input.ahn5)) return fromAhn(input.ahn5, 'ahn5');
  if (built >= AHN4_FLIGHT_YEAR) return null;
  const seen = input.ahn5 ?? input.ahn4;
  if (!seen) return null;
  return { height: r2(Math.min(MIN_FILL_HEIGHT_M, Math.max(LOW_MIN_M, seen.ridge))), source: 'low' };
}
