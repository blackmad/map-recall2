/**
 * Per-house components of a large-tier row split (`walls[].houses[]`, lane large-kit-gaps-20261121). The kit-vs-hand
 * test on Valkenburgerstraat 69-165 (2026-11-20) needed five fronts on one 3DBAG wall plane, a dark ribbon-brick front
 * beside a white glazed stack and punched mauve fronts, and `houses` could only split the wall colour and window shape.
 * Here a house also carries its own window preset, sills, blank storeys, ribbon storeys, per-bay windows, brick storeys,
 * ground and wall material, bays and storeys counted within the house. Absent: the group's, byte-identical.
 *
 * Validation reuses the group validator on a stand-in wall (`houseAsWall`), so a house field obeys exactly the rules
 * of the group field of the same name. The fit (`houseSystemFit`) returns the SystemFit fields a house replaces.
 */
import type {LargeHouseIntent, LargeWallIntent} from './intent.ts';
import type {RibbonStoreyFit} from '../blockBuilding/ribbonStoreys.ts';
import type {SystemFit} from '../blockBuilding/systems.ts';

/** The house fields that are group components re-scoped to one house. */
export const HOUSE_COMPONENT_KEYS = ['windows', 'sills', 'blankStoreys', 'ribbonStoreys', 'bayWindows', 'brickStoreys', 'ground', 'residential', 'wallMaterial'] as const;
export const HOUSE_GROUNDS = ['system', 'residential', 'plinth-shopfronts', 'blank'] as const;

/**
 * True when the house has a field of its own whose `bays` / `pattern` count from the house's left bay: per-bay windows,
 * a residential ground pattern, ribbon storeys, loggias or balconies with `bays`. Compose numbers a row split's cells
 * across the whole row, so before this the house read its cycles at `bayOffset + b`: a house after a 1-bay house drew its
 * pattern one bay late, and a wide window (w > 1) meant for its first bays fell on its last bay, past the panel end, and
 * was skipped (Bos en Lommerplein, kit batch 8504, 2026-11-21). Such a house now reads its cycles at its own bay.
 */
export const houseCountsOwnBays = (h: LargeHouseIntent) => !!(h.bayWindows || h.residential?.pattern || h.ribbonStoreys?.some(r => r.bays)
  || h.loggias?.bays || h.balconies?.bays);

/** True when the house sets any per-house component (the stand-in wall is only validated then). */
export const hasHouseComponents = (h: LargeHouseIntent) => HOUSE_COMPONENT_KEYS.some(k => h[k] !== undefined);

/**
 * The stand-in wall a house's components are validated as: the group's system and the house's bays and storeys, with the
 * group's side light (a bay window's `light` needs it) and the house's own fields. No houses (so no recursion).
 */
export function houseAsWall(w: LargeWallIntent, h: LargeHouseIntent): LargeWallIntent {
  const out: LargeWallIntent = {wallSurfaces: w.wallSurfaces, system: w.system, ...(h.bays !== undefined ? {baysPerStorey: h.bays} : {}),
    ...(h.storeys !== undefined ? {storeys: h.storeys} : w.storeys !== undefined ? {storeys: w.storeys} : {}), ...(w.sideLight ? {sideLight: w.sideLight} : {}),
    ...(h.ground !== undefined ? {ground: h.ground} : w.ground !== undefined ? {ground: w.ground} : {})};
  for (const k of HOUSE_COMPONENT_KEYS) if (h[k] !== undefined && k !== 'ground') (out as unknown as Record<string, unknown>)[k] = h[k];
  return out;
}

/** Context the fit hands over per house: its storey heights, its slots, and the group's palette to add slots to. */
export interface HouseFitContext {
  group: number; house: number; heights: number[]; frameSlot: string; palette: Record<string, string>; swatch: (c: string) => string;
}

/** The SystemFit fields the house replaces (empty for a house without components, so the spread is byte-identical). */
export function houseSystemFit(h: LargeHouseIntent, ctx: HouseFitContext): Partial<SystemFit> {
  const out: Partial<SystemFit> = {}, {group: gi, house: k, heights, palette, swatch} = ctx, r3 = (v: number) => +v.toFixed(3);
  if (h.windows !== undefined) out.windows = h.windows;
  if (h.sills !== undefined) out.sills = h.sills;
  if (h.blankStoreys) out.blankStoreys = [...h.blankStoreys];
  if (h.ground !== undefined) out.ground = h.ground;
  if (h.residential) out.residential = {pattern: [...h.residential.pattern], ...(h.residential.doors ? {doorSlot: (palette[`door@rg${gi}h${k}`] = swatch(h.residential.doors), `door@rg${gi}h${k}`)} : {})};
  if (h.ribbonStoreys) {
    out.ribbonStoreys = h.ribbonStoreys.map((r, j): RibbonStoreyFit => {
      const tag = `${gi}h${k}k${j}`, frame = r.frame ? `frame@rs${tag}` : ctx.frameSlot;
      if (r.frame) palette[frame] = swatch(r.frame);
      const spandrel = r.spandrel ? `spandrel@rs${tag}` : undefined, head = r.head ? `spandrel@rh${tag}` : undefined;
      if (spandrel) palette[spandrel] = swatch(r.spandrel!.colour);
      if (head) palette[head] = swatch(r.head!.colour);
      return {storeys: r.storeys.filter(q => q < heights.length), ...(r.bays ? {bays: [...r.bays]} : {}), sill: r.sill, h: r.h, lights: r.lights, ...(r.rows ? {rows: [...r.rows]} : {}),
        ...(spandrel ? {spandrel: {h: r.spandrel!.h, slot: spandrel}} : {}), ...(head ? {head: {h: r.head!.h, slot: head}} : {}), frame};
    });
  }
  if (h.bayWindows) {
    out.bayWindows = h.bayWindows.map(e => {
      const storeys = e.storeys.filter(q => q < heights.length), sh = heights[storeys[0] ?? 0] ?? heights[0];
      return {storeys, pattern: e.pattern.map(b => ({w: b.w, ...(b.at !== undefined ? {at: b.at} : {}), ...(b.h !== undefined ? {h: b.h} : {}), ...(b.light !== undefined ? {light: b.light} : {}), ...(b.door ? {door: true} : {}),
        ...(b.sill !== undefined ? {sillM: r3(b.sill * sh)} : {})}))};
    });
  }
  return out;
}
