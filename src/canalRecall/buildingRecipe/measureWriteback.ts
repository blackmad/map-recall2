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
 * - `glazedPlinth`: a ground band glazed far above the upper storeys (OBA Buitenveldert walls[4], 100 % vs 0-44 %)
 *   proposes a `plinth` on storey 0; loggias are never proposed (their shadowed returns read as glazing or as wall
 *   depending on the light, so deep loggias stay hand intents).
 * - `windowGroupProposal`: the photo grid folds two to four alike windows into one bay (measureFacade `windowGroupOf`,
 *   `window.perBay`: Stadhouderskade 111's paired sashes, Overtoom 283) proposes `windowGroup: {count}` on a punched
 *   group, so the model draws the pair instead of one wide window per bay (factory acceptance, 2026-10-24).
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

type Win = {w: number; h: number; sill: number; aspect?: number; shape?: string; perBay?: number} | null | undefined;
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

/** Glazed plinth evidence: the ground band's not-wall share at least this ... */
export const PLINTH_MIN_GROUND = 0.7;
/** ... and this far above the mean of the measured upper storeys. */
export const PLINTH_MIN_LIFT = 0.3;
export interface PlinthInputs {
  /** measured not-wall share of the ground band (`measured.ground`) */
  ground: number | null | undefined;
  /** measured not-wall share per storey band (`measured.storeyGlazing`, ground first; nulls where no band was read) */
  storeyGlazing: readonly (number | null)[] | null | undefined;
  glass: string | null | undefined; wall: string;
  usable: number; foliage: number; washedOut: number;
}
/**
 * A glazed plinth proposal (`plinth: {lights}` on the ground) or why not. The ground band must be glazed
 * (>= PLINTH_MIN_GROUND), clearly more than the upper storeys (>= PLINTH_MIN_LIFT over their mean; a group with no
 * measured upper storey is a one-storey front and has nothing to stand out from), the crop clean by the likeness
 * thresholds and the not-wall cells glass (`glassReadsAsGlass`): dark paint, cars and shade otherwise read as a
 * glazed ground. Lights are a measurement the crop does not give reliably, so the proposal takes 2 per bay (the
 * shopfront default); a hand intent refines them.
 */
export function glazedPlinth(m: PlinthInputs): {plinth: {lights: number; sill: number; h: number} | null; why: string[]} {
  const why: string[] = [];
  const uppers = (m.storeyGlazing ?? []).slice(1).filter((v): v is number => typeof v === 'number');
  if (m.ground == null) why.push('no ground band measured');
  else if (m.ground < PLINTH_MIN_GROUND) why.push(`ground band ${Math.round(m.ground * 100)} % < ${PLINTH_MIN_GROUND * 100} %`);
  if (!uppers.length) why.push('no upper storey measured');
  const mean = uppers.length ? uppers.reduce((a, b) => a + b, 0) / uppers.length : 0;
  if (m.ground != null && uppers.length && m.ground - mean < PLINTH_MIN_LIFT) why.push(`ground band ${Math.round(m.ground * 100)} % not ${PLINTH_MIN_LIFT * 100} points over the upper storeys (${Math.round(mean * 100)} %)`);
  if (m.usable < LIKENESS.minUsable) why.push(`usable ${Math.round(m.usable * 100)} % < ${LIKENESS.minUsable * 100} %`);
  if (m.foliage > LIKENESS.maxFoliage) why.push(`foliage ${Math.round(m.foliage * 100)} % > ${LIKENESS.maxFoliage * 100} %`);
  if (m.washedOut > LIKENESS.maxWashedOut) why.push(`washed out ${Math.round(m.washedOut * 100)} % > ${LIKENESS.maxWashedOut * 100} %`);
  if (!glassReadsAsGlass(m.glass, m.wall)) why.push(`not-wall ${m.glass ?? 'none'} does not read as glass on ${m.wall}`);
  return {plinth: why.length ? null : {lights: 2, sill: 0.04, h: 0.84}, why};
}

/** The systems whose windows the kit can group (largeIntent.ts `windowGroup`). */
export const WINDOW_GROUP_SYSTEMS: readonly LargeSystemName[] = ['brick-bay-grid', 'plinth-shopfronts'];
export interface WindowGroupInputs {
  /** the window the bays come from (`photoBays(...).window`): `perBay` = alike windows folded into one bay */
  window: Win;
  system: LargeSystemName;
  usable: number; foliage: number; washedOut: number;
}
/**
 * A grouped-window proposal (`windowGroup: {count}`, 2..4 windows per bay, every upper storey, the kit's default gap)
 * or why not: the photo window must carry `perBay` >= 2, the group's system must group windows, and the crop must be
 * clean by the likeness abstain thresholds (a tree trunk or a downpipe between two halves of one window otherwise
 * reads as a pair). The gap is not written: the fold gives each window's width, not the pier between them reliably.
 */
export function windowGroupProposal(m: WindowGroupInputs): {windowGroup: {count: number} | null; why: string[]} {
  const why: string[] = [], n = m.window?.perBay ?? 1;
  if (n < 2) why.push('one window per bay');
  else if (n > 4) why.push(`${n} windows per bay > 4`);
  if (!WINDOW_GROUP_SYSTEMS.includes(m.system)) why.push(`${m.system} windows are not grouped`);
  if (m.usable < LIKENESS.minUsable) why.push(`usable ${Math.round(m.usable * 100)} % < ${LIKENESS.minUsable * 100} %`);
  if (m.foliage > LIKENESS.maxFoliage) why.push(`foliage ${Math.round(m.foliage * 100)} % > ${LIKENESS.maxFoliage * 100} %`);
  if (m.washedOut > LIKENESS.maxWashedOut) why.push(`washed out ${Math.round(m.washedOut * 100)} % > ${LIKENESS.maxWashedOut * 100} %`);
  return {windowGroup: why.length ? null : {count: n}, why};
}
