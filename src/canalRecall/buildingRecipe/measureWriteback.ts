/**
 * Decisions `measure.ts --write` makes when it puts a photo measurement into a large intent's wall group (factory
 * batch 1 review, 2026-10-24). Pure and typed so the rules are tested without a renderer:
 *
 * - `cropPredatesBuilding`: a crop taken in or before the BAG construction year shows a site, scaffolding or the
 *   building before it (OBA Postjesweg 2018 crops of a 2019 building, Stadsloket Nieuw-West 2021-22 of 2022): no
 *   evidence for anything.
 * - `curtainEvidence`: a `curtain` front class (>= 68 % not-wall) only switches a group to `curtain-wall` when the
 *   crop is clean by the likeness abstain thresholds (`LIKENESS.minUsable`, `maxFoliage`, `maxWashedOut`) and its
 *   not-wall cells read as glass (`glassReadsAsGlass`); bare branches, cars and dark paint otherwise count as glazing
 *   (OBA Slotermeer walls[1], Molenwijk walls[0], Buitenveldert walls[3]).
 * - `photoBays`: the bay count and window shape come from the photo grid the likeness gate judges (the shifted photo on
 *   the panel's own box), not from the padded measurement, when that grid found a rhythm; the two disagree on mullion
 *   pitch vs bay pitch (OBA IJburg walls[3] 53 vs 10, Metis Montessori 5 vs 29).
 * - `majoritySystem`: the system a rejected curtain group falls back to.
 */
import {LIKENESS} from './likeness.ts';
import {rgbToLab} from './measureFacade.ts';
import type {LargeSystemName} from '../blockBuilding/systems.ts';

/** measure.ts's glass test (since 2026-10-14): glass is at least this many L* darker than the wall ... */
export const GLASS_MIN_DL = 10;
/** ... and nearly neutral (Lab chroma under this). */
export const GLASS_MAX_CHROMA = 15;

const lab = (h: string) => rgbToLab([1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)) as [number, number, number]);

/** The measured not-wall colour reads as glass against the wall: darker by GLASS_MIN_DL L* and chroma under GLASS_MAX_CHROMA. */
export function glassReadsAsGlass(glass: string | null | undefined, wall: string): boolean {
  if (!glass) return false;
  const gl = lab(glass), wl = lab(wall);
  return gl[0] <= wl[0] - GLASS_MIN_DL && Math.hypot(gl[1], gl[2]) < GLASS_MAX_CHROMA;
}

/** A crop dated in or before the building's construction year (BAG `oorspronkelijkbouwjaar`, the completion year). */
export function cropPredatesBuilding(capturedAt: string | null | undefined, builtYear: number | null | undefined): boolean {
  const y = Number(capturedAt?.slice(0, 4));
  return builtYear != null && Number.isFinite(builtYear) && Number.isFinite(y) && y > 0 && y <= builtYear;
}

export interface CurtainInputs {
  glass: string | null; wall: string;
  /** usable share of the padded measurement and of the likeness window (upper cells) */
  usable: number; likenessUsable: number;
  foliage: number; washedOut: number;
}
/** Why a curtain class is not trusted (empty = trusted), with the likeness thresholds it uses. */
export function curtainEvidence(m: CurtainInputs): string[] {
  const why: string[] = [];
  const u = Math.min(m.usable, m.likenessUsable);
  if (u < LIKENESS.minUsable) why.push(`usable ${Math.round(u * 100)} % < ${LIKENESS.minUsable * 100} %`);
  if (m.foliage > LIKENESS.maxFoliage) why.push(`foliage ${Math.round(m.foliage * 100)} % > ${LIKENESS.maxFoliage * 100} %`);
  if (m.washedOut > LIKENESS.maxWashedOut) why.push(`washed out ${Math.round(m.washedOut * 100)} % > ${LIKENESS.maxWashedOut * 100} %`);
  if (!glassReadsAsGlass(m.glass, m.wall)) why.push(`not-wall ${m.glass ?? 'none'} does not read as glass on ${m.wall} (>= ${GLASS_MIN_DL} L* darker, chroma < ${GLASS_MAX_CHROMA})`);
  return why;
}

type Win = {w: number; h: number; sill: number; aspect?: number; shape?: string} | null | undefined;
/**
 * Bays and window from the photo: the likeness grid's column count and folded window when it has a column count, else
 * the padded measurement's. `source` says which.
 */
export function photoBays(a: {measuredBays: number | null; measuredWindow: Win; gridColumns: number | null; gridWindow: Win}): {bays: number | null; window: Win; source: 'grid' | 'measurement'} {
  if (a.gridColumns !== null && a.gridColumns > 0) return {bays: a.gridColumns, window: a.gridWindow ?? (a.measuredBays === a.gridColumns ? a.measuredWindow : null), source: 'grid'};
  return {bays: a.measuredBays, window: a.measuredWindow, source: 'measurement'};
}

/**
 * The building's majority measured system: the area-weighted most common system among the trusted groups' proposals
 * (ties: the larger single area, then the kit default `brick-bay-grid`); `fallback` when no group is trusted.
 */
export function majoritySystem(rows: readonly {system: LargeSystemName; areaM2: number}[], fallback: LargeSystemName): LargeSystemName {
  const by = new Map<LargeSystemName, {a: number; max: number}>();
  for (const r of rows) { const e = by.get(r.system) ?? {a: 0, max: 0}; e.a += r.areaM2; e.max = Math.max(e.max, r.areaM2); by.set(r.system, e); }
  const best = [...by].sort((x, y) => y[1].a - x[1].a || y[1].max - x[1].max || Number(y[0] === 'brick-bay-grid') - Number(x[0] === 'brick-bay-grid'))[0];
  return best ? best[0] : fallback;
}
