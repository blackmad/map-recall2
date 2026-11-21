/**
 * Design units, the plot plan (2026-11-21, David on Tweede Jacob van Campenstraat 9051: "we're getting the story count
 * wrong"; on Admiraal De Ruijterweg 14817: "we missed the pointy ones"; "the ground floors are very non-representative").
 *
 * One plot of a pre-1940 Ring segment: how many storeys, where the wall stops, where the roof storey stands, which roof
 * element crowns the plot, the ground use, the balconies. Pure: the renderer (draw.ts withDesignUnitRoof) turns it into
 * the generic mesher's properties.
 *
 *   - Storeys: the plot's read (gate photo rows, else the D1 reads), else PLOT_DEFAULT_STOREYS. The count never comes
 *     from the measured top divided by a storey height: 72 of the 78 photo-read gate plots have 4 full storeys over
 *     measured tops from 12.3 to 19.7 m, and the eaves formula round((top - ground) / 3.1) + 1 matched 7 of 78.
 *   - The measured top (AHN front-band p90) is the cornice on some rows and the roof storey's top on others: the front
 *     mansard or roof slope stands inside the 1.5 m band. The plot fit decides: with the count at the era pitch
 *     (ERA_GROUND_M, ERA_UPPER_M) the wall needs `need` metres; a top less than ROOF_ON_TOP_SLACK_M over that is the
 *     cornice (the roof storey goes on top, ROOF_ON_TOP_RISE_M, set back), more is a roof storey inside the top, its rise
 *     the excess clamped to [ROOF_INSIDE_MIN_M, ROOF_INSIDE_MAX_M] (Rustenburgerstraat 1.2 m, matching the photo-row
 *     registration; Admiraal De Ruijterweg 3 m).
 *   - An AHN roof storey (roofRiseM >= 1.8 over the front) always stands on top at its measured rise.
 */

/** The ground storey of an 1870-1920 Ring house (m): 3.6-4.0 in the photo rows. */
export const ERA_GROUND_M = 3.8;
/** An upper storey of the same houses (m), the pitch the fit uses before the mesher scales to the wall. */
export const ERA_UPPER_M = 3.3;
/** A souterrain under a raised ground floor adds this to the ground storey (m). */
export const SOUTERRAIN_M = 1.2;
/** The default count: 72 of 78 photo-read gate plots, 691 of 1,001 D1 Ring reads with a count. */
export const PLOT_DEFAULT_STOREYS = 4;
/** A roof storey stood on the cornice: its rise (m), set back behind the front. */
export const ROOF_ON_TOP_RISE_M = 2.8;
/** A top at most this far over the wall the count needs is the cornice (m). */
export const ROOF_ON_TOP_SLACK_M = 0.6;
export const ROOF_INSIDE_MIN_M = 1.2;
export const ROOF_INSIDE_MAX_M = 3.0;
/** An upper storey outside this range (m) moves the default count by one (a 12 m top is 3 storeys, a 22 m one 5). */
export const UPPER_RANGE_M = { min: 2.6, max: 4.4 } as const;

export const PLOT_ROOFS = ['flat', 'dormers', 'mansard', 'pointedGable', 'stepGable', 'bellGable'] as const;
export type PlotRoof = (typeof PLOT_ROOFS)[number];
export type PlotDormer = 'pediment' | 'gabled' | 'plain';

/** What is known about one plot (build-segments `plots`), each field from its source. */
export interface PlotFacts {
  storeys?: number;
  ground?: 'shop' | 'dwelling';
  souterrain?: boolean;
  roof?: PlotRoof;
  dormer?: PlotDormer;
  hoist?: boolean;
  /** Upper storeys with a balcony, 1 = the first upper. */
  balconies?: number[];
  /** Where the facts came from: the gate photo rows, the D1 reads, or (roof only) the segment's mirror symmetry. */
  src: 'photo' | 'reads';
  roofSrc?: 'photo' | 'reads' | 'pattern';
}

export interface PlotPlan {
  storeys: number;
  storeysSrc: 'photo' | 'reads' | 'default';
  groundM: number;
  /** The wall's top (m over the ground): the cornice. */
  wallM: number;
  /** 'onTop': the roof storey stands over the measured top; 'inside': inside it; 'none': a flat top or a gable. */
  rule: 'onTop' | 'inside' | 'none';
  roof: PlotRoof;
  roofSrc: 'photo' | 'reads' | 'pattern' | 'segment' | 'default';
  /** The roof storey's rise over the wall (m); 0 for a flat top, the planner's for a gable. */
  riseM: number;
  dormer: PlotDormer;
  hoist: boolean;
  souterrain: boolean;
  ground?: 'shop' | 'dwelling';
  balconies: number[];
}

/** The segment's own roof statement for a plot with no roof fact (segments.ts `roofEvidence`, AHN `roofRiseM`). */
export interface SegmentRoofHint { storey?: boolean; dormer?: PlotDormer; hoist?: boolean; form?: 'mansard' | 'dormers'; roofSource?: string; ahnRiseM?: number | null }

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** The default count for a top: PLOT_DEFAULT_STOREYS unless its uppers would fall outside UPPER_RANGE_M either way. */
export function defaultStoreys(topM: number, groundM: number): number {
  let n = PLOT_DEFAULT_STOREYS;
  // Lowest plausible: the roof storey on top (the whole top is wall); highest: the most a roof storey can take inside.
  if ((topM - groundM) / (n - 1) < UPPER_RANGE_M.min) n--;
  else if ((topM - ROOF_INSIDE_MAX_M - groundM) / (n - 1) > UPPER_RANGE_M.max) n++;
  return Math.max(2, n);
}

export function plotPlan(topM: number, facts: PlotFacts | undefined, hint: SegmentRoofHint): PlotPlan {
  const souterrain = !!facts?.souterrain, groundM = ERA_GROUND_M + (souterrain ? SOUTERRAIN_M : 0);
  const storeys = facts?.storeys && facts.storeys >= 2 ? Math.round(facts.storeys) : defaultStoreys(topM, groundM);
  const storeysSrc = facts?.storeys ? facts.src : 'default';
  const segRoof: PlotRoof = hint.storey === false ? 'flat' : hint.form === 'mansard' ? 'mansard' : 'dormers';
  const roof = facts?.roof ?? segRoof;
  const roofSrc = facts?.roof ? (facts.roofSrc ?? facts.src) : hint.roofSource === 'default' || hint.roofSource === undefined ? 'default' : 'segment';
  const dormer = facts?.dormer ?? hint.dormer ?? 'pediment', hoist = facts?.hoist ?? !!hint.hoist;
  const base = { storeys, storeysSrc, groundM, roof, roofSrc, dormer, hoist, souterrain, balconies: facts?.balconies ?? [], ...(facts?.ground ? { ground: facts.ground } : {}) } as const;
  const need = groundM + (storeys - 1) * ERA_UPPER_M, excess = topM - need;
  const ahnRoof = typeof hint.ahnRiseM === 'number' && hint.ahnRiseM >= 1.8;
  // The cornice line: the measured top, or under it by the roof storey standing inside the top.
  const onTop = ahnRoof || excess < ROOF_ON_TOP_SLACK_M;
  const inside = onTop ? 0 : clamp(excess, ROOF_INSIDE_MIN_M, ROOF_INSIDE_MAX_M);
  if (roof === 'flat') return { ...base, wallM: topM, rule: 'none', riseM: 0 };
  const wallM = +(topM - inside).toFixed(3);
  // A gable stands on the cornice line its neighbours keep; the roof planner sets its rise.
  if (roof === 'pointedGable' || roof === 'stepGable' || roof === 'bellGable') return { ...base, wallM, rule: 'none', riseM: 0 };
  const riseM = onTop ? (ahnRoof ? clamp(hint.ahnRiseM!, 2.4, 4) : ROOF_ON_TOP_RISE_M) : inside;
  return { ...base, wallM, rule: onTop ? 'onTop' : 'inside', riseM: +riseM.toFixed(3) };
}

/** The roof planner's gable shape for a plot gable (roofMesh.ts GABLE_SHAPES). */
export const PLOT_GABLE_SHAPE: Readonly<Partial<Record<PlotRoof, 'plain' | 'step' | 'bell'>>> = { pointedGable: 'plain', stepGable: 'step', bellGable: 'bell' };

/**
 * A segment's roof sequence, one letter per plot left to right (A = the first element seen, B the next...), and its
 * mirror-symmetry fill: a plot with no roof fact takes its mirror plot's (i <-> n-1-i) when that one is read. Most rows
 * are composed symmetrically (A B A A B A on Admiraal De Ruijterweg).
 */
export function fillRoofPattern(order: string[], plots: Record<string, PlotFacts>): { filled: string[]; pattern: string } {
  const filled: string[] = [];
  for (let i = 0; i < order.length; i++) {
    const id = order[i], mirror = plots[order[order.length - 1 - i]];
    if (!plots[id]?.roof && mirror?.roof && order.length - 1 - i !== i) {
      plots[id] = { ...(plots[id] ?? { src: mirror.src }), roof: mirror.roof, ...(mirror.dormer && !plots[id]?.dormer ? { dormer: mirror.dormer } : {}), roofSrc: 'pattern' };
      filled.push(id);
    }
  }
  const letters = new Map<string, string>();
  const pattern = order.map(id => { const r = plots[id]?.roof; if (!r) return '.'; if (!letters.has(r)) letters.set(r, String.fromCharCode(65 + letters.size)); return letters.get(r)!; }).join('');
  return { filled, pattern };
}
