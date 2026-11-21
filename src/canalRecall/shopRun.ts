// Shop runs (lane shop-band-ground-20261121, `?shopRun=1`, SHOP_RUN=1 in Node; default off).
//
// The ordinary mesher painted a shop pand's shop ground storey on every exposed wall run, so one shop (Roche Bobois in
// Valkenburgerstraat 69-165, pand 0363100012185504) wrapped a red-fascia shop band right round a housing block,
// residential sides included. With the flag on, only the runs that hold a shop keep the shop ground; the others draw the
// quiet residential ground the same building would draw without a shop.
//
// Which runs hold a shop: every anchor point the pand carries (its OSM and BAG ground-floor businesses, `shop-anchors.json`,
// plus the template, chain and signature points already stamped) picks
//   1. the street run nearest it, unless some other run is nearer by more than NEAREST_MARGIN_M (a node by a forecourt
//      or courtyard entrance), then that run; a point more than FRONT_SNAP_M from every wall keeps the nearest street run;
//   2. every other street run within CORNER_REACH_M (a corner shop keeps both street faces), or within NEAREST_MARGIN_M
//      of the nearest street run's distance while no farther than TIE_REACH_M: a point about as far from two streets
//      is a corner unit fronting both (Brasserie Keyzer, Van Baerlestraat 96, pand 0363100012164883: its BAG horeca
//      point is 6.2 m from one street run and 7.0 m from the Van Baerlestraat run).
// Anchors are OSM ground-floor businesses and (round 2) BAG verblijfsobjecten with a winkel or horeca use, so a street
// run faced by a registered shop unit keeps its shopfront when OSM has no node there. Round 3: any ground-floor
// non-residential BAG unit (office, school, clinic ...; bagUnitAnchors below) is an anchor too.
// A shop pand with no anchor (a busy-stretch guess, scripts/build-shopfronts.ts) keeps the shop on its street runs and
// loses it on back and courtyard runs. A pand with one run, or no street run, is unchanged.
//
// Off: no anchor extract is fetched or stamped, nothing here is called, and every chunk is byte-identical.
import { FRONT_SNAP_M, NEAREST_MARGIN_M, segDist } from './retailHosting.js';

/** A street run within this distance of an anchor keeps the shop too: the corner shop's other face (m). */
export const CORNER_REACH_M = 6;
/** A street run about as near a point as the nearest street run keeps the shop up to this distance (m). */
export const TIE_REACH_M = 10;

export const SHOP_RUN_DEFAULT = false;
export function shopRunEnabled(search?: string | null, env?: string | null): boolean {
  const q = search ? /[?&]shopRun=([01])\b/.exec(search)?.[1] : undefined;
  const v = q ?? (env === '0' || env === '1' ? env : undefined);
  return v === undefined ? SHOP_RUN_DEFAULT : v === '1';
}
let cached: boolean | undefined;
/** The flag for this page or process (a test may set `__canalRecallShopRun`). */
export function shopRunOn(): boolean {
  const g = globalThis as { __canalRecallShopRun?: boolean; location?: { search?: string }; process?: { env?: Record<string, string | undefined> } };
  if (typeof g.__canalRecallShopRun === 'boolean') return g.__canalRecallShopRun;
  return (cached ??= shopRunEnabled(g.location?.search ?? null, g.process?.env?.SHOP_RUN ?? null));
}

/** shop-anchors.json: pand id -> the [lng, lat] points of the ground-floor businesses hosted on it (build-shop-anchors.ts). */
export type ShopAnchorExtract = { version: 1; source?: string; buildings: Record<string, Array<[number, number]>> };
let anchors: ShopAnchorExtract | null = null;
/** Install the anchor extract (only the flag's loaders call this); null removes it. */
export function setShopAnchors(data: ShopAnchorExtract | null): void {
  anchors = data && data.buildings && typeof data.buildings === 'object' ? data : null;
}
/** The anchors of a pand from the installed extract, or undefined. */
export function shopAnchorsFor(id: string): Array<[number, number]> | undefined {
  const list = anchors?.buildings[id];
  return Array.isArray(list) && list.length ? list : undefined;
}

/**
 * Round 3 (coordinator 2026-11-21, loss at Zakslootje / Brandewijnsteeg, 0363100012182300): which BAG verblijfsobjecten
 * anchor a shop run. A glazed ground front is as often an office, school, clinic or studio as a shop, so every
 * non-residential gebruiksdoel counts, not only winkel and horeca (bijeenkomst):
 *  - shop and horeca uses count as in round 2, also when the unit is a dwelling too;
 *  - the other non-residential uses (kantoor, onderwijs, gezondheidszorg, sport, cel, industrie, logies) count only when
 *    the unit is not also a woonfunctie (a registered home office or atelier-at-home has no glazed front);
 *  - woonfunctie alone and "overige gebruiksfunctie" (bergingen, parking) never count.
 * BAG carries no storey (neither the PDOK verblijfsobject nor the nummeraanduiding), so the ground floor is read from
 * the Amsterdam toevoeging: one that starts with a storey number 1+ ("1", "2", "3V", "1A", "01") is an upper-floor
 * unit and does not count; none, "H" (huis), "O", "HL", "0" and the rest are taken as ground floor.
 */
export const BAG_SHOP_USES = ['winkelfunctie', 'bijeenkomstfunctie'] as const;
export const BAG_FRONT_USES = ['kantoorfunctie', 'onderwijsfunctie', 'gezondheidszorgfunctie', 'sportfunctie', 'celfunctie', 'industriefunctie', 'logiesfunctie'] as const;
/** True when a BAG toevoeging names an upper storey (1 and up). */
export function upperFloorToevoeging(add?: string | null): boolean {
  return typeof add === 'string' && /^0*[1-9]/.test(add.trim());
}
/** True when a BAG verblijfsobject (gebruiksdoel, comma-separated, and toevoeging) anchors a shop run; see above. */
export function bagUnitAnchors(use: string | null | undefined, add?: string | null): boolean {
  if (!use || upperFloorToevoeging(add)) return false;
  const uses = use.split(',').map(u => u.trim());
  if (uses.some(u => (BAG_SHOP_USES as readonly string[]).includes(u))) return true;
  return !uses.includes('woonfunctie') && uses.some(u => (BAG_FRONT_USES as readonly string[]).includes(u));
}

/** A wall run in local metres: its walls as [x0, y0, x1, y1], and whether any of them faces a street. */
export type ShopRunGeom = { segs: ReadonlyArray<readonly [number, number, number, number]>; street: boolean };

const runDist = (run: ShopRunGeom, x: number, y: number) => run.segs.reduce((d, s) => Math.min(d, segDist(s[0], s[1], s[2], s[3], x, y)), Infinity);

/**
 * Which runs hold a shop (true) and which draw the quiet ground (false), for anchor points in the same local metres.
 * Pure; see the header for the rule.
 */
export function shopRunsFor(runs: readonly ShopRunGeom[], points: ReadonlyArray<readonly [number, number]>): boolean[] {
  if (runs.length <= 1 || !runs.some(r => r.street)) return runs.map(() => true);
  if (!points.length) return runs.map(r => r.street);
  const keep = runs.map(() => false);
  for (const [x, y] of points) {
    const d = runs.map(r => runDist(r, x, y));
    let all = -1, street = -1;
    d.forEach((v, i) => { if (all < 0 || v < d[all]) all = i; if (runs[i].street && (street < 0 || v < d[street])) street = i; });
    // A node more than FRONT_SNAP_M from every wall (deep in a large footprint: a supermarket in a block) keeps the
    // street run nearest it, as retailHosting.ts rule 4 does.
    const fronts = street >= 0 && (d[street] <= d[all] + NEAREST_MARGIN_M || d[all] > FRONT_SNAP_M);
    keep[fronts ? street : all] = true;
    // The tie reach only for a point that fronts a street (not one by a forecourt or courtyard wall).
    const tie = fronts ? Math.min(d[street] + NEAREST_MARGIN_M, TIE_REACH_M) : -1;
    d.forEach((v, i) => { if (runs[i].street && (v <= CORNER_REACH_M || v <= tie)) keep[i] = true; });
  }
  return keep;
}
