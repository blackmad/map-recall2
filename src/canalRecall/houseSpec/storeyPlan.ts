/**
 * The storey plan of a read front (lane WG, 2026-11-13; docs/house-line.md §1 "Storey fit with a souterrain and a roof
 * storey"): what a stated storey count means against 3DBAG's wall, and whether the read count is believable at all.
 *
 * D1's pixel check (scripts/house-specs/describer-d1/pixel-check) found the stated count stretched over 3DBAG's whole wall:
 * Weteringschans 0363100012171218 (souterrain, three storeys, a slate mansard) drew 3 rows at 5.31 m, and 42 of 180 AH07
 * generic pands drew an upper pitch over 4.5 m. The fit, from the street up:
 *   souterrain   SOUTERRAIN_FACTOR of the storey pitch (blockBuilding/systems.ts SOUTERRAIN.factor, the block-face kit's own)
 *   rows         `storeys` (spec.ts STOREYS_DEFINITION: full storeys below the crown, the ground once) at one pitch,
 *                up to the eaves line
 *   roof storey  (`roofStorey` mansard|attic) above the eaves line: roof, not wall. It is drawn as one more window row only
 *                where the mesher's wall reaches over the eaves line by at least ROOF_ROW_MIN of a storey.
 * The eaves line is 3DBAG's (bag-facts eaves, the source of the register gable gate's crown rise) where the view carries it;
 * otherwise the mesher's wall top, and for a stated roof storey the rows at the period pitch decide whether the wall holds it.
 *
 * The guard: a fitted pitch outside the period's range (STOREY_PITCH_RANGE) rejects the read count for that pand. The
 * mesher then draws the style's own count (the prior) and the pand is listed for a second read (storey-guard report).
 * `?storeyGuard=0` (STOREY_GUARD=0 in Node) turns the guard off; the souterrain and roof rows stay.
 */

/** blockBuilding/systems.ts SOUTERRAIN.factor: a souterrain is 0.58 of an upper storey (not imported: that module is heavy). */
export const SOUTERRAIN_FACTOR = 0.58;
/** The wall must reach this share of a storey over the eaves line before a stated roof storey draws a window row. */
export const ROOF_ROW_MIN = 0.6;
/** An eaves line more than this far over the mesher's wall top belongs to another mass: the wall top is used. */
export const EAVES_OVER_WALL_M = 1.0;

export const ROOF_STOREYS = ['mansard', 'attic', 'none'] as const;
export type RoofStorey = typeof ROOF_STOREYS[number];

export type StoreyPeriod = 'canal' | 'c19' | 'school' | 'modern';
/**
 * Storey pitch (wall height / read storeys) per palette era (look/palette.ts PERIOD_FROM: c19 1860, school 1915, modern 1945),
 * from PR1's 1,432 read pre-1945 houses (lane/structure-priors-20261113 structure-prior.json rows, exposedM / storeys):
 * min = the 5th percentile, max = the 95th capped at 4.5 m (the integrator's period ceiling; the school tail, p95 4.89 m,
 * holds reads that missed a souterrain or roof storey), median = the period pitch. `any` (no year, or modern, 1 row) is the
 * pooled 5th percentile rounded to 2.6 m (the integrator's floor) and the 4.5 m ceiling.
 *   canal  n 182  p5 2.50  p50 3.21  p95 4.26
 *   c19    n 683  p5 2.65  p50 3.41  p95 4.09
 *   school n 567  p5 2.32  p50 3.19  p95 4.89 -> 4.5
 *   all    n 1432 p5 2.39  p50 3.34  p95 4.59
 */
export const STOREY_PITCH_RANGE: Readonly<Record<StoreyPeriod | 'any', { min: number; median: number; max: number }>> = {
  canal: { min: 2.5, median: 3.21, max: 4.26 },
  c19: { min: 2.65, median: 3.41, max: 4.09 },
  school: { min: 2.32, median: 3.19, max: 4.5 },
  modern: { min: 2.6, median: 3.34, max: 4.5 },
  any: { min: 2.6, median: 3.34, max: 4.5 },
};

export interface StoreyPlanInput {
  /** The mesher's exposed wall for the run (top - parapet - base, m). */
  wallM: number;
  /** Full storeys below the crown, ground included. */
  storeys: number;
  souterrain?: boolean;
  roofStorey?: RoofStorey;
  /** 3DBAG's eaves above the run's base (m). */
  eavesM?: number;
  period?: string;
}
export interface StoreyPlan {
  /** The fitted storey pitch (m): the guard's number. */
  pitchM: number;
  /** Souterrain height (m), 0 without one. */
  souterrainM: number;
  /** The wall reaches over the eaves line far enough to draw the stated roof storey as one more window row. */
  roofRow: boolean;
  /** Where the eaves line came from, and its height over the run's base (m). */
  lineFrom: 'eaves' | 'wall';
  lineM: number;
  range: { min: number; median: number; max: number };
  /** The pitch lies within the period range. */
  ok: boolean;
}

export const rangeFor = (period?: string) => STOREY_PITCH_RANGE[(period && period in STOREY_PITCH_RANGE ? period : 'any') as StoreyPeriod | 'any'];

/** The plan for a stated count over a wall, or null when there is nothing to fit (no wall, no storey). */
export function storeyPlan(input: StoreyPlanInput): StoreyPlan | null {
  const rows = Math.floor(input.storeys), wall = input.wallM;
  if (!(rows >= 1) || !(wall > 0)) return null;
  const range = rangeFor(input.period), s = input.souterrain ? SOUTERRAIN_FACTOR : 0;
  const roofStated = input.roofStorey === 'mansard' || input.roofStorey === 'attic';
  const eaves = input.eavesM;
  const useEaves = typeof eaves === 'number' && Number.isFinite(eaves) && eaves > 2 && eaves <= wall + EAVES_OVER_WALL_M;
  let pitch: number, roofRow = false, line = wall;
  if (useEaves) {
    line = Math.min(eaves!, wall);
    pitch = line / (rows + s);
    roofRow = roofStated && wall - line >= ROOF_ROW_MIN * pitch;
  } else {
    // No eaves: the rows at the period pitch say whether the wall holds a stated roof storey above them.
    roofRow = roofStated && wall - (rows + s) * range.median >= ROOF_ROW_MIN * range.median;
    pitch = wall / (rows + s + (roofRow ? 1 : 0));
  }
  return { pitchM: pitch, souterrainM: s * pitch, roofRow, lineFrom: useEaves ? 'eaves' : 'wall', lineM: line, range, ok: pitch >= range.min && pitch <= range.max };
}

/** Default on; `?storeyGuard=0` in the page or STOREY_GUARD=0 in Node draws a rejected count as before the guard. */
export const STOREY_GUARD_DEFAULT = true;
export function storeyGuardEnabled(search?: string | null, env?: string | null): boolean {
  const q = search ? /[?&]storeyGuard=([01])\b/.exec(search)?.[1] : undefined;
  const v = q ?? (env === '0' || env === '1' ? env : undefined);
  return v === undefined ? STOREY_GUARD_DEFAULT : v === '1';
}
let guardNow: boolean | undefined;
export function storeyGuardOn(): boolean {
  if (guardNow !== undefined) return guardNow;
  const g = globalThis as { location?: { search?: string }; process?: { env?: Record<string, string | undefined> } };
  return (guardNow = storeyGuardEnabled(g.location?.search ?? null, g.process?.env?.STOREY_GUARD ?? null));
}
/** Tests and harnesses: forget the cached flag. */
export const resetStoreyGuard = () => { guardNow = undefined; };

/** A rejected or fitted plan per pand, for the storey-guard report (the publish veto list and the second-read queue). */
export const storeyPlanProbe: { sink?: (id: string, plan: StoreyPlan, input: StoreyPlanInput) => void } = {};

/** A wall band over 3DBAG's eaves line shorter than this is left to the rows (no plain band). */
export const EAVES_BAND_MIN_M = 0.3;
/**
 * What the mesher's storey fit draws for a plan: the drawn storey count (ground cell + upper rows) and the ground cell's
 * height, or null to keep the stated count as it is (no souterrain, no roof row), or `reject` when the guard rejects it.
 *  - with a souterrain the ground cell is the souterrain (its door and windows at the street) and every stated storey,
 *    the bel-etage included, is an upper row at one pitch;
 *  - a roof row adds one upper row;
 *  - `bandM`: with 3DBAG's eaves under the wall top and no roof row, the rows stop at the eaves line and the wall over it
 *    (the frieze and cornice zone) is plain wall, the mesher's parapet band. Only when the plan changes the draw.
 */
export function storeyDraw(plan: StoreyPlan, storeys: number, guard: boolean = storeyGuardOn(), wallM?: number): 'reject' | { storeys: number; groundM?: number; bandM?: number } | null {
  if (guard && !plan.ok) return 'reject';
  const rows = Math.floor(storeys);
  if (!plan.souterrainM && !plan.roofRow) return null;
  const upper = (plan.souterrainM ? rows : rows - 1) + (plan.roofRow ? 1 : 0);
  const band = plan.lineFrom === 'eaves' && !plan.roofRow && wallM !== undefined ? wallM - plan.lineM : 0;
  return { storeys: upper + 1, ...(plan.souterrainM ? { groundM: +plan.souterrainM.toFixed(2) } : {}), ...(band >= EAVES_BAND_MIN_M ? { bandM: +band.toFixed(3) } : {}) };
}
