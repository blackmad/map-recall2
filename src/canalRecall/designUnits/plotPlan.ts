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
import type { RowCrown } from '../houseLine/crownProfile.js';
import type { RowCorniceDress } from '../houseSpec/row/types.js';

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

export const WHITE_HEADS = ['none', 'keystone', 'blocks', 'band'] as const;
export type WhiteHeads = (typeof WHITE_HEADS)[number];
/**
 * White window frames and sash bars by rule, no read needed (David, 2026-11-21): the D1 Ring reads say white frames on 49
 * of 56 (1860-79), 322 of 357 (1880-99) and 304 of 345 (1900-15) readable fronts. Built years, inclusive.
 */
export const WHITE_FRAME_YEARS = { from: 1860, to: 1915 } as const;
/** The kit's head dressing (houseLine/headGrammar.ts) a white head draws as, with the window shape it implies. */
export const WHITE_HEAD_DRESSING: Readonly<Record<Exclude<WhiteHeads, 'none'>, { dressing: 'keystone' | 'voussoirs' | 'stone-lintel'; shape: 'flat' | 'segmental' }>> = {
  keystone: { dressing: 'keystone', shape: 'flat' }, blocks: { dressing: 'voussoirs', shape: 'segmental' }, band: { dressing: 'stone-lintel', shape: 'flat' },
};
/** The white parts a plot draws: frames by era, heads and string courses as read. */
export function plotWhite(year: number | null | undefined, facts: PlotFacts | undefined): { frames: boolean; heads: WhiteHeads; courses: boolean } {
  return { frames: facts?.whiteFrames ?? (typeof year === 'number' && year >= WHITE_FRAME_YEARS.from && year <= WHITE_FRAME_YEARS.to), heads: facts?.whiteHeads ?? 'none', courses: !!facts?.stringCourses };
}

export const PLOT_ROOFS = ['flat', 'dormers', 'mansard', 'pointedGable', 'stepGable', 'bellGable'] as const;
export type PlotRoof = (typeof PLOT_ROOFS)[number];
export type PlotDormer = 'pediment' | 'gabled' | 'plain' | 'ornate-pinnacle';
/** `relieving` (bar-fixes 2026-11-21): a flat head under a brick relieving arch (headGrammar.ts `relieving-*`). */
export const HEAD_SHAPES = ['flat', 'segmental', 'round', 'relieving'] as const;
export type HeadShape = (typeof HEAD_SHAPES)[number];
/** A plot gable as read (ring-r2 verdicts, 2026-11-21: Admiraal De Ruijterweg "not tall enough and missing the window in
 *  the triangle"; Jan Luijkenstraat 160504/166029 "an offset triangle roof that doesn't go the whole width"). */
export interface PlotGable { riseM?: number; widthM?: number; offsetM?: number; window?: 'none' | 'square' | 'round' | 'segmental';
  /** Belt review: the canal belt's gable dress (houseLine/crownProfile.ts BELT_GABLE: claw pieces, tall neck, cap). */
  belt?: true;
  /** Belt review crown read (beltReview/plotRead.ts crownMeasures): the gable's built form in the kit's RowCrown parts
   *  (its shape, neck, shoulders, an elevated neck's rise, cap, stone, lights). Absent: the shape's stock form. */
  form?: PlotGableForm }
/** The RowCrown parts a crown read states (houseLine/crownProfile.ts RowCrown). */
export type PlotGableForm = Partial<Pick<RowCrown, 'shape' | 'neckW' | 'shoulderRise' | 'cap' | 'raiseM' | 'capM' | 'footLedge' | 'neckLights' | 'lowerLights' | 'lightHead' | 'steps' | 'stone' | 'finials'>>;
/** The default pointed-gable rise over its foot width (Admiraal De Ruijterweg: about 4.2 m on a 3.4 m foot). */
export const POINT_GABLE_RISE_PER_M = 1.1;

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
  /** White dressing at the window heads (2026-11-21, David on Rustenburgerstraat: "missing the white detailing"):
   *  `keystone` a white key on a brick arch, `blocks` white blocks fanned round the head, `band` a white lintel slab. */
  whiteHeads?: WhiteHeads;
  /** White string courses through the sills. */
  stringCourses?: boolean;
  /** White window frames as read (belt review); absent: by era (WHITE_FRAME_YEARS). */
  whiteFrames?: boolean;
  /** Round 3 (ring-r2 verdicts): the window heads' shape (the kit's head grammar arches the glass). */
  headShape?: HeadShape;
  /** Grey stone at the foot: a bluestone plinth band, or a banded stucco ground storey. */
  stone?: 'none' | 'plinth' | 'ground';
  /** Bacon courses (speklagen): over the ground storey only, or up the whole front. */
  bands?: 'none' | 'ground' | 'all';
  /** White pilasters: at the plot's two ends, or one on its axis (Commelinstraat's white centre column). */
  pilasters?: 'none' | 'corners' | 'centre';
  /** The wall colour as read (hex), where the plot differs from its family (Commelinstraat's middle house). */
  wallHex?: string;
  /** Window axes on the upper storeys as read (Bilderdijkkade 113152: two wide windows on 14.8 m). */
  bays?: number;
  /** Roof windows across the plot (Tweede Jacob van Campenstraat, Ceintuurbaan 8543: three on the roofline). */
  dormers?: number;
  /** The gable's read size, place and light. */
  gable?: PlotGable;
  /** Belt review (2026-11-21, a per-house photo read): the roof covering seen behind the cornice (absent: the row slate). */
  roofMaterial?: 'tile' | 'slate';
  /** The main cornice as read (the house rows' row-cornice kinds); absent: the dice cornice. */
  cornice?: 'simple' | 'bracketed' | 'heavy' | 'frieze' | 'attic-frieze';
  /** Belt review crown read: the cornice's parts as read (houseSpec/row/types.ts RowCorniceDress), over the kind's own. */
  corniceForm?: Pick<RowCorniceDress, 'supports' | 'supportsAt' | 'frieze' | 'centre' | 'centreShare' | 'centreRiseM' | 'centreCap' | 'centreLight'>;
  /** Belt review, measured on the crop: the cornice zone's depth (m), its foot over the top storey to the cornice's top
   *  (frieze, attic band, bed moulding and corona). The timber cornice is drawn at this depth; absent: the kind's own. */
  corniceDepthM?: number;
  /** The street door: its 0-based place among `of` ground-storey openings, left to right as seen. */
  door?: { index: number; of: number; surround?: boolean; /** Belt review: a fanlight over the door as read. */ fanlight?: boolean };
  /** Street-furniture kit parts the read names (facadeExtras.ts `hoist-beam`, `wall-anchors`), forced as stated. */
  parts?: Array<'hoist-beam' | 'wall-anchors'>;
  /** Belt review (2026-11-21, measured on the picked crop): each full storey's share of the wall under the cornice, the
   *  ground storey first (canal fronts: the ground storey tallest, the top storey lowest). Absent: an even pitch. */
  storeyShares?: number[];
  /** Belt review: an attic storey read above the top floor (low lights in a frieze under the cornice). */
  attic?: boolean;
  /** Belt review, measured on the crop: a ground window's height over a first-upper window's, and the street door's
   *  height (fanlight included) over the ground storey's. The ground openings are cut to them (a dwelling ground only). */
  groundOpenings?: { windowRatio: number; doorRatio: number; /** A basement band's share of the ground storey. */ basementRatio?: number; /** The door up a stoop, over the basement. */ raisedDoor?: true };
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
export interface SegmentRoofHint { storey?: boolean; dormer?: PlotDormer; hoist?: boolean; form?: 'mansard' | 'dormers'; roofSource?: string; ahnRiseM?: number | null;
  /** The top is a measured cornice (belt review's survey eaves): the wall stops there and a roof storey stands on it. */
  topIsCornice?: boolean }

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
  const onTop = ahnRoof || excess < ROOF_ON_TOP_SLACK_M || !!hint.topIsCornice;
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

/** The window head the kit draws for a plot: its white dressing as read, else a brick arch ring over an arched head. */
export function plotHeads(facts: PlotFacts | undefined): { dressing: string; shape: HeadShape } | null {
  const shape = facts?.headShape, white = facts?.whiteHeads ?? 'none';
  // A relieving arch over a flat head, its white key (and feet) as read; a white lintel band stays the lintel.
  // A flat head with white blocks is the block surround's keyed flat head, not an arch (Herengracht 88: "flat window heads"
  // drawn as "arched heads with keystone blocks"); a segmental head with a white band is a white ring of its arch (74).
  if (shape === 'flat' && white === 'blocks') return { dressing: 'block-surround', shape: 'flat' };
  if (shape === 'segmental' && white === 'band') return { dressing: 'arched-frame', shape: 'segmental' };
  if (shape === 'relieving' && white !== 'band') return { dressing: white === 'keystone' ? 'relieving-key' : white === 'blocks' ? 'relieving-blocks' : 'relieving-arch', shape: 'flat' };
  if (white !== 'none') { const w = WHITE_HEAD_DRESSING[white]; return { dressing: w.dressing, shape: shape === 'relieving' ? w.shape : shape ?? w.shape }; }
  return shape && shape !== 'flat' ? { dressing: 'brick-arch-ring', shape } : null;
}

/** The plot's roof windows, left to right: the read count (else one per DORMER_FRONT_M of front); a hoist sits on the
 *  middle one, the side ones plain (Tweede Jacob van Campenstraat 153395: a hoist dormer between two small lights). */
export function plotDormers(frontM: number, perM: number, facts: PlotFacts | undefined, kind: PlotDormer, hoist: boolean): Array<{ a: number; kind: PlotDormer; hoist?: true }> {
  // A read of no roof windows (dormers 0, belt review) draws none; unread (absent) keeps one per front.
  if (facts?.dormers === 0) return [];
  const n = facts?.dormers && facts.dormers >= 1 ? Math.min(5, Math.round(facts.dormers)) : Math.max(1, Math.round(frontM / perM));
  const read = !!facts?.dormers, mid = (n - 1) / 2;
  return Array.from({ length: n }, (_, i) => {
    const lead = !read || n < 3 || i === mid || (n % 2 === 0 && Math.abs(i - mid) === 0.5 && i < mid);
    return { a: +((i + 0.5) / n).toFixed(3), kind: lead ? kind : 'plain', ...(hoist && lead ? { hoist: true as const } : {}) };
  });
}

/** Plots that read alike draw alike (ring-r2, Ruyschstraat: "they're all basically identical except one of the roofs"):
 *  the facts that shape a front, without their sources. */
export function plotLook(f: PlotFacts | undefined): string {
  if (!f) return '';
  const { src: _s, roofSrc: _r, ...rest } = f;
  return JSON.stringify(Object.keys(rest).sort().map(k => [k, (rest as Record<string, unknown>)[k]]));
}
