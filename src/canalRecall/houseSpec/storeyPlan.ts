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
 *   roof storey  above the eaves line: roof, not wall. A mansard is roof and a cornice crown has no window row above it
 *                (BK's bake-off, 2026-11-13: 168043 drew 4 rows, 168042/171192/168096 5, for 3 read storeys under a
 *                cornice or mansard): the wall over the line is a plain band. Only a stated `attic` storey (an upright
 *                top storey with windows in the wall plane) draws one more window row, where the wall holds
 *                ROOF_ROW_MIN of a storey over the line (or, without eaves, over the rows at the period pitch).
 * The eaves line is 3DBAG's (bag-facts eaves, the source of the register gable gate's crown rise) where the view carries it
 * and it lies within one period storey under the mesher's wall top;
 * otherwise the mesher's wall top, and for a stated roof storey the rows at the period pitch decide whether the wall holds it.
 *
 * The guard: a fitted pitch outside the period's range (STOREY_PITCH_RANGE) rejects the read count for that pand. The
 * mesher then draws the style's own count (the prior) and the pand is listed for a second read (storey-guard report).
 * `?storeyGuard=0` (STOREY_GUARD=0 in Node) turns the whole plan off (guard, souterrain, roof row, tall ground, eaves band):
 * the mesher then draws H9/H11's fit, byte-identical to main.
 */

/** blockBuilding/systems.ts SOUTERRAIN.factor: a souterrain is 0.58 of an upper storey (not imported: that module is heavy). */
export const SOUTERRAIN_FACTOR = 0.58;
/** The wall must reach this share of a storey over the eaves line before a stated attic storey draws a window row. */
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
  /** The front is crowned by a cornice (fronts/0/gable `cornice`, read from the street): no window row above the rows. */
  crown?: 'cornice';
}
export interface StoreyPlan {
  /** The fitted storey pitch (m): the guard's number. */
  pitchM: number;
  /** Souterrain height (m), 0 without one. */
  souterrainM: number;
  /** A stated attic storey drawn as one more window row (the wall reaches far enough over the line to hold it). */
  roofRow: boolean;
  /** Where the eaves line came from, and its height over the run's base (m). */
  lineFrom: 'eaves' | 'wall';
  lineM: number;
  range: { min: number; median: number; max: number };
  /** The pitch lies within the period range (after the tall-ground retry). */
  ok: boolean;
  /** The retry that brought a too-tall pitch into range: the ground row at TALL_GROUND_RATIO of the upper pitch; `groundM`
   *  is that ground row (m). Absent when the plain pitch passed or failed. */
  tallGround?: { groundM: number };
  /** A roof-crowned front (mansard or cornice) whose rows would not fit the wall even with a tall ground: the rows drawn
   *  at the period's top pitch over a tall ground, the wall over them a plain band of at most one period storey. */
  capped?: true;
  /** 3DBAG's eaves was stated but lay outside the window (reject cause c). */
  eavesIgnored: boolean;
}

/**
 * A tall ground storey (a shop or bel-etage) under diminishing upper storeys makes one shared pitch read too tall. Before a
 * too-tall pitch is rejected the fit retries with the ground row this many upper pitches tall: the 25th percentile of the
 * ground / mean-upper ratio of the 180 hand-measured fronts without a souterrain that state storeyHeights
 * (scripts/house-specs/specs, building-recipes houses, block-face faces; median 1.48, p10 1.10, p25 1.29, p75 1.64),
 * the low end so a rescue never draws a ground storey taller than most measured ones. The integrator's band was 1.2-1.4.
 */
export const TALL_GROUND_RATIO = 1.29;

export const rangeFor = (period?: string) => STOREY_PITCH_RANGE[(period && period in STOREY_PITCH_RANGE ? period : 'any') as StoreyPeriod | 'any'];

/** The plan for a stated count over a wall, or null when there is nothing to fit (no wall, no storey). */
export function storeyPlan(input: StoreyPlanInput): StoreyPlan | null {
  const rows = Math.floor(input.storeys), wall = input.wallM;
  if (!(rows >= 1) || !(wall > 0)) return null;
  const range = rangeFor(input.period), s = input.souterrain ? SOUTERRAIN_FACTOR : 0;
  const attic = input.roofStorey === 'attic', roofCrown = input.roofStorey === 'mansard' || input.crown === 'cornice';
  const eaves = input.eavesM;
  // 3DBAG's eaves is the pand's lowest roof edge: a rear annex or a dormer cheek puts it far below the front's. It counts
  // only within one period storey (range.max) under the wall top (AH07: 71 of 155 stated counts read as 0.5-2.5 m
  // pitches against such eaves before this window, 1 after). The spec build drops most of them first (frontEavesM).
  const useEaves = typeof eaves === 'number' && Number.isFinite(eaves) && eaves >= wall - range.max && eaves <= wall + EAVES_OVER_WALL_M;
  let pitch: number, roofRow = false, line = wall;
  if (useEaves) {
    line = Math.min(eaves!, wall);
    pitch = line / (rows + s);
    // 3DBAG's roof starts at the eaves line; the wall over it is roof (a mansard face, a cornice frieze): a plain band,
    // except a stated attic storey that the wall holds.
    roofRow = attic && wall - line >= ROOF_ROW_MIN * pitch;
  } else {
    // No eaves: the rows at the period pitch say whether the wall holds a stated attic storey above them.
    roofRow = attic && wall - (rows + s) * range.median >= ROOF_ROW_MIN * range.median;
    pitch = wall / (rows + s + (roofRow ? 1 : 0));
  }
  const eavesIgnored = typeof eaves === 'number' && Number.isFinite(eaves) && eaves > 0 && !useEaves;
  const lineFrom = useEaves ? 'eaves' as const : 'wall' as const;
  const inRange = (v: number) => v >= range.min && v <= range.max;
  if (!inRange(pitch) && pitch > range.max && rows >= 2) {
    // (b) a tall ground row: the stated rows over a ground TALL_GROUND_RATIO of the upper pitch.
    const units = rows - 1 + TALL_GROUND_RATIO + s + (roofRow ? 1 : 0);
    const upper = line / units;
    if (inRange(upper)) return { pitchM: upper, souterrainM: s * upper, roofRow, lineFrom, lineM: line, range, ok: true, tallGround: { groundM: TALL_GROUND_RATIO * upper }, eavesIgnored };
    // A cornice or mansard crown has no window row above the read rows: the rows at the period's top pitch over a tall
    // ground, the rest of the wall a plain band, when that band is at most one period storey (more is a missed storey).
    if (roofCrown && !roofRow && line - units * range.max <= range.median) {
      const top = units * range.max;
      return { pitchM: range.max, souterrainM: s * range.max, roofRow, lineFrom, lineM: top, range, ok: true, tallGround: { groundM: TALL_GROUND_RATIO * range.max }, capped: true, eavesIgnored };
    }
  }
  return { pitchM: pitch, souterrainM: s * pitch, roofRow, lineFrom, lineM: line, range, ok: inRange(pitch), eavesIgnored };
}

/**
 * The front's eaves from bag-facts (spec build, lane WG). bag-facts eaves is 3DBAG's `b3_h_dak_min` minus ground: the
 * pand's LOWEST roof point, which on a deep canal-belt lot is often a rear annex or kitchen wing, not the street front's
 * eaves. Weteringschans 168042, 171192 and 185507 carry 6.3 m (a 6 m rear lean-to; their street mansard or flat roof
 * starts at 14.1-16.9 m in 3DBAG's LoD2.2 surfaces), 168043 and 168096 10.0 and 9.8 m (a flat rear roof). The eaves
 * counts as the front's only where the pand's roof height (the building tile's `height`, 3DBAG's 70th percentile) lies at
 * most one roof storey over it (FRONT_EAVES_RISE_M; a mansard or attic face), or, under a ridge, within
 * FRONT_EAVES_PITCHED_SHARE of the eaves-to-ridge rise (the 70th percentile of a pitched roof sits part way up it).
 */
export const FRONT_EAVES_RISE_M = 4.5;
export const FRONT_EAVES_PITCHED_SHARE = 0.75;
export function frontEavesM(facts: { eavesM: number | null; ridgeM: number | null; heightM: number | null }): number | null {
  const { eavesM, ridgeM, heightM } = facts;
  if (eavesM === null || !(eavesM > 0)) return null;
  if (heightM === null || !(heightM > 0)) return eavesM;
  const over = heightM - eavesM;
  if (over <= FRONT_EAVES_RISE_M) return eavesM;
  return ridgeM !== null && ridgeM > eavesM && over <= FRONT_EAVES_PITCHED_SHARE * (ridgeM - eavesM) ? eavesM : null;
}

/** Default on; `?storeyGuard=0` in the page or STOREY_GUARD=0 in Node turns the storey plan off (the fit before lane WG). */
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

/**
 * The prior a rejected count falls back to (the integrator's ruling, 2026-11-13): PR1's structure prior
 * (houseSpec/structurePrior.ts) sets `storeys` here when its storeys ship (`?structurePrior=storeys|all`); unset, a
 * rejected run draws the style's own count (today's). The mesher calls it once per rejected ground-level street run.
 */
export const storeyRejectPrior: { storeys?: (building: { id: string; structurePrior?: { year: number; lng: number; lat: number } }, run: { exposedM: number; widthM: number; base: number; streetRun: boolean }) => number | null | undefined } = {};

/** A rejected or fitted plan per pand, for the storey-guard report (the publish veto list and the second-read queue). */
export const storeyPlanProbe: { sink?: (id: string, plan: StoreyPlan, input: StoreyPlanInput) => void } = {};

/** A wall band over 3DBAG's eaves line shorter than this is left to the rows (no plain band). */
export const EAVES_BAND_MIN_M = 0.3;
/**
 * What the mesher's storey fit draws for a plan: the drawn storey count (ground cell + upper rows) and the ground cell's
 * height, or null to keep the stated count as it is (no souterrain, no roof row), or `reject` when the guard rejects it.
 *  - with a souterrain the ground cell is the souterrain (its door and windows at the street) and every stated storey,
 *    the bel-etage included, is an upper row at one pitch;
 *  - an attic row adds one upper row;
 *  - a tall-ground rescue draws the stated count with its ground row at `tallGround.groundM`;
 *  - `bandM`: with the rows' line (3DBAG's eaves, or a capped fit's top) 0.3 m or more under the wall top and no attic
 *    row, the rows stop at the line and the wall over it (the frieze, cornice or mansard zone) is plain wall, the
 *    mesher's parapet band.
 */
export function storeyDraw(plan: StoreyPlan, storeys: number, guard: boolean = storeyGuardOn(), wallM?: number): 'reject' | { storeys: number; groundM?: number; souterrain?: true; bandM?: number } | null {
  if (guard && !plan.ok) return 'reject';
  const rows = Math.floor(storeys);
  const band = !plan.roofRow && wallM !== undefined ? wallM - plan.lineM : 0;
  if (!plan.souterrainM && !plan.roofRow && !plan.tallGround && band < EAVES_BAND_MIN_M) return null;
  const upper = (plan.souterrainM ? rows : rows - 1) + (plan.roofRow ? 1 : 0);
  const groundM = plan.souterrainM ? plan.souterrainM : plan.tallGround?.groundM;
  return { storeys: upper + 1, ...(groundM ? { groundM: +groundM.toFixed(2) } : {}), ...(plan.souterrainM ? { souterrain: true } : {}), ...(band >= EAVES_BAND_MIN_M ? { bandM: +band.toFixed(3) } : {}) };
}
