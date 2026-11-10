/**
 * Automatic placement of library house types on a block face (buurt generator, 2026-10-16).
 *
 * The per-face path has an author read every pand off the strip and write its placement. This module writes the
 * placements from evidence instead:
 *   1. every pand of the face is scored against every type of a district library by its `match` rule: BAG build year
 *      and frontage width (vetoes), 3DBAG eaves, bouwlagen and roof rise, and the strip's measured wall colour, stucco
 *      share, painted-band rows and window columns (blockFace/stripPalette.ts, buildingRecipe/measureFacade.ts);
 *   2. the best type over `minScore` (and `margin` ahead of the runner-up, else the tie is reported) is placed with the
 *      bay count its width rule and the measured columns give, the 3DBAG storey count when the type allows it, the door
 *      side read off the ground band, the pand's measured brick, and a shopfront from BAG/OSM when the ground trades;
 *   3. a pand that matches nothing, has no usable photo, or (after compiling) fails the likeness gate is HELD: it stays
 *      out of the face, with the reason, and the city tier keeps drawing it. Contiguous runs of placed pands become
 *      the faces that compile (a block face needs two houses).
 * Row coherence (blockFace/rowCoherence.ts) then runs at compile time on the consecutive same-type placements.
 *
 * Pure: no filesystem. scripts/block-face/auto-place.ts gathers the evidence and writes the intents.
 */
import type {HousePlacement, HouseTypeIntent} from './houseType.ts';
import type {BlockFaceHouse, BlockFaceIntent, GroundFloorUse, RhythmSpec} from './intent.ts';
import type {StripPalette} from './stripPalette.ts';
import {skylineBounded, type SkyBound, type Skyline} from './stripSkyline.ts';
import type {StripStructure} from './stripStructure.ts';
import {rgbToLab, type FrontClass, type Rgb} from '../buildingRecipe/measureFacade.ts';
import type {FrontBump} from './bayOutline.ts';
import type {ShopfrontIntent} from '../buildingRecipe/intent.ts';
import {materialVetoes, stripWallMaterial} from './wallMaterial.ts';

/** How a library type is recognised (`match` in scripts/block-face/types/<district>/<id>.json). */
export interface TypeMatchRule {
  /** BAG/3DBAG build years (inclusive); outside by more than `yearSlack` vetoes the type. */
  years: [number, number];
  yearSlack?: number;
  /** 3DBAG eaves of the street front (m). */
  eavesM?: [number, number];
  /** 3DBAG bouwlagen the type is seen with. */
  storeys3dbag?: number[];
  /** Roof rise over the eaves (3DBAG roof max - eaves): `flat` under 1.5 m, `pitched` over. */
  roof?: 'flat' | 'pitched';
  /** Window bays by frontage width: the first entry whose `maxWidthM` holds the width. Default: the type's body bays. */
  baysByWidth?: {maxWidthM: number; bays: number}[];
  /** Measured strip wall colour: Lab distance to `hex` within `maxDE` scores 1, within twice that 0.5. */
  wall?: {hex: string; maxDE: number};
  /** The strip reads a painted/stucco wall (stripPalette `stucco`). */
  stucco?: boolean;
  /** The strip shows painted band rows on the piers (two or more band runs). */
  bands?: boolean;
  /**
   * Crown variant by the strip skyline (blockFace/stripSkyline.ts): the first variant whose ranges hold the measured
   * crown (`none: true` = no crown over the eaves); unread or unmatched keeps the type's first crown.
   */
  /** The type is drawn with its house door on this side; a pand whose door reads on the other side is mirrored (pairs). */
  mirrorForDoor?: 'left' | 'right';
  /**
   * `false`: the strip's wall reading is not the brick, so placed pands keep the type palette (no measuredPalette).
   * Zaanhof 1919: half of every front is white render over the brick and the 2021 strips are sunlit past the trim
   * white point (the readings came out #eac495-#fffcd6 for a red-brown brick).
   */
  measuredWall?: false;
  /**
   * Doors pair across the party wall whatever the neighbour's type (`fillPairs`): a pand whose door was not read takes
   * the side that meets a placed neighbour of any type whose door side is known (read, or set by its accent/BAG bay).
   * Rivierenbuurt 1934 portiek rows: a flat front's door meets the door of the erker house beside it.
   */
  doorsPairAcross?: boolean;
  /**
   * The type is drawn with its light accent mass (a white bay stack) on this side; the strip's upper-storey accent
   * asymmetry is then a criterion (an even front scores 0) and a pand whose accent reads on the other side is mirrored.
   */
  mirrorForAccent?: 'left' | 'right';
  /**
   * Range of the upper storeys' light-accent share (StripEvidence.accentShare): the white bay stacks of Hasebroekstraat
   * 56-70 read 0.37-0.56 on the 2024-12-11 strip, the green-tile fronts of 90-98 on the same strip 0.07-0.25. Exposure
   * dependent (a dark 2022 strip reads 0 everywhere), so it is a weighted criterion, never a veto.
   */
  accentShare?: [number, number];
  /**
   * The type has no balconies: a strip that reads balconies (blockFace/stripStructure.ts: a dark open axis without
   * brick spandrels, or stacked balcony slabs) VETOES it. Jan Hanzenstraat 49-51, Ten Katestraat 29-31 and Bellamystraat
   * 18-20 took the green-tile and two-axis types without it.
   */
  balconies?: false;
  /**
   * Range of the widest light bay (stripStructure.ts `bayWidthM`, read relative to the pand's own wall, so it holds on
   * dark and washed-out strips alike): the tile-bay oriels read 2.0-2.3 m, plain window columns at most 1.3 m.
   */
  bayWidthM?: [number, number];
  /**
   * The BAG outline carries a bay in front of the facade line (blockFace/bayOutline.ts `frontBump`, PandEvidence
   * `bagBay`): true for an erker type, false for a flat front. A weighted criterion (3), not a veto: BAG can miss an erker.
   * Rivierenbuurt 1934 rows: the brick-panelled erkers read no light bay on the strip, but BAG draws every one of them.
   */
  bagBay?: boolean;
  /** Range of |bay centre - 0.5| (share of the front): Boterdiepstraat's side erkers 0.18-0.19, Eemsstraat's 0.06-0.10. */
  bagBayOffset?: [number, number];
  crowns?: Record<string, CrownRule & {alt?: CrownRule}>;
  /**
   * The crown is a criterion (weight 3), not only the variant choice: a strip skyline read under clean sky scores 1
   * when one of `crowns` holds it (a `none` rule holds a front without a crown), else 0; unread scores nothing.
   * Jordaan (#113): gable houses and cornice houses share the build years (BAG dates many 17th-18th c. gables to
   * 1775-1865 rebuilds) and frontages, so only the skyline tells a neck or bell gable from a cornice front.
   * Absent = no criterion, byte-identical.
   */
  crownMatch?: true;
  /**
   * With `crownMatch`: a skyline read under clean sky that is sky-bounded (`skylineBounded`) and fits none of `crowns`
   * VETOES the type instead of only scoring 0 (Jordaan, #113 round 2: a neck-gable skyline scored a cornice house 0 on
   * one criterion of seven and still placed it). Unread or unbounded skylines veto nothing. Absent = byte-identical.
   */
  crownStrict?: true;
  /**
   * The strip's wall material vetoes (wallMaterial.ts): grey render over a type without `stucco: true`, near-black paint
   * over a type without `blackPaint: true`. Absent = byte-identical (`stucco` stays a weighted criterion).
   */
  materialVeto?: true;
  /** The type is drawn painted black (the black-paint wall material does not veto it). */
  blackPaint?: true;
  /**
   * The crown a pand of this type takes when its strip skyline is no evidence (2026-11-01, #152): unread, matching no
   * variant, or not sky-bounded (`skylineBounded`: it stands over the pand's 3DBAG roof max, ends on foliage, or is a
   * narrow mass at one party wall). The note then says "crown from type". Transvaalbuurt 1908-1914 rows: bare branches
   * over every 2023 strip read 15.5-18.4 m skylines and the unread fallback (the first crown, a point gable) drew gables
   * on the flat fronts of Smitstraat 36-38, Transvaalstraat 54-56 and Laing's Nekstraat 36-38. Absent = the skyline
   * picks whenever read and the first crown otherwise, byte-identical.
   */
  crownFromType?: string;
  /**
   * The cornice line of the type's rows, measured on its exemplar strips (m over the pavement; Helmersbuurt 1893-1901:
   * Eerste Helmersstraat 217-229 at 10.8 m, where 3DBAG/PDOK eaves read the mansard top at 10.9-13.4 m). Set, the eaves
   * criterion compares the strip skyline (when read under clean sky) with it instead of 3DBAG's eaves (unread: no
   * criterion), the storey count is the type's, and a placed pand is drawn at its own skyline eaves when read within
   * FRONT_EAVES.tolM of this line, else at this line (`frontEavesFor`; the run face's `continuity.measuredEaves`).
   * Absent = 3DBAG eaves, byte-identical.
   */
  frontEavesM?: number;
  /**
   * With `frontEavesM`: keep the 3DBAG roof (no `frontRoof` re-pitch) although the line is under 3DBAG's eaves. A one-storey
   * cottage under a long tiled roof (Vogelbuurt-Noord 1918, gutter 3.2 m, 3DBAG eaves a mean of 4.1-4.8 m over the slope)
   * has no attic band to re-pitch; its survey roof already stands at the gutter on the facade. Absent = byte-identical.
   */
  keepSurveyRoof?: boolean;
  /**
   * With `frontEavesM`: do not score the strip skyline against the line. Where the skyline is a gable apex or a dormer top
   * (Vogelbuurt 1921 rows: crow-stepped gable ends 12.6 m, flat dormers 7.3 m over a 6.4 m cornice) it reads 8-13 m on
   * the same design, so it is no evidence of the cornice; 3DBAG eaves are not compared either, the house is drawn at the
   * line. Absent = scored, byte-identical.
   */
  frontEavesUnscored?: boolean;
  /**
   * With `frontEavesM`: the top of a wall dormer that spans most of the front, where the strip skyline reads it instead
   * of the cornice (Derde Helmersstraat 54-64: crenellated wall dormers over two of three axes, skyline 17.4-18.2 m
   * over a 14.3 m cornice). A skyline near it scores like one near the cornice line; the house is drawn at the line.
   */
  frontSkylineM?: number;
  /**
   * How the frontage is judged. Absent: the pand is one house, and a width outside the type's `fit.widthM` by more than
   * AUTO_PLACE.widthSlackM vetoes the type (Bellamy 1904-1937). `stair-block`: the pand is a BAG stair block, and one
   * design runs over blocks of very different widths (Transvaalbuurt 1921-1923 portiek rows: Schalk Burgerstraat 2-140
   * 5.2-10 m, Albert Luthulistraat 21-41 5.2-12.4 m for one front). The width then vetoes only outside `widthM`, and
   * what identifies the design vetoes instead: the storey count (3DBAG eaves over the type's storey pitch, rounded,
   * must be one of `storeys`) and, when the strip reads window columns, the axis pitch (width / columns within
   * `axisPitchM`). Absent = the house rule, byte-identical.
   */
  frontage?: StairBlockFrontage;
  /**
   * A placed pand of this type that is a run of one (held or unplaced neighbours, or the face end on both sides) stands
   * on its own as a one-house face when its BAG frontage is at least `minWidthM` (`placedRuns`, `lonePandReason`). For
   * stair-block rows, where a BAG pand is a whole stair block of one design (Transvaalbuurt 1908-1914 and 1921-1923:
   * 57 pands held as lone runs in round 3, #156). Narrower pands keep the rule: a 4-5 m pand alone is more often a
   * misread than a house. Absent = a run of one is held, byte-identical (Bellamy and every other library).
   */
  lonePand?: {minWidthM: number};
  /**
   * Window columns the strip reads per axis, [min, max]. A wide multi-light window (a centre light between side lights
   * under a top light, Haarlemmerdijk 129-133A) reads its mullions as two to four columns, so two axes read 5-7
   * (`measureFacade` columns): within `bays` x this range the columns criterion scores 1. Absent = one column per axis,
   * byte-identical.
   */
  columnsPerBay?: [number, number];
  note?: string;
}

/** The columns criterion: strip window columns against the type's bays (`match.columnsPerBay` for multi-light windows). */
export function columnsCriterion(cols: number, want: number, perBay?: [number, number]): Criterion {
  if (perBay && cols >= want * perBay[0] && cols <= want * perBay[1]) return {key: 'columns', weight: W.columns, score: 1, note: `strip columns ${cols} vs ${want} bays of ${perBay.join('-')} lights`};
  return {key: 'columns', weight: W.columns, score: cols === want ? 1 : Math.abs(cols - want) === 1 ? 0.4 : 0, note: `strip columns ${cols} vs ${want} bays`};
}

/** `match.frontage` of a portiek type (TypeMatchRule.frontage). */
export interface StairBlockFrontage {
  mode: 'stair-block';
  /** Stair-block widths the design is seen at (m); outside vetoes (a 27 m corner block, a 4 m passage). */
  widthM: [number, number];
  /** Storeys of the front: round(3DBAG eaves / storeyPitch) outside this list vetoes. */
  storeys: number[];
  /** Window-axis pitch (m): pand width over the strip's upper window columns, when read, outside this range vetoes. */
  axisPitchM: [number, number];
}

/** The frontage vetoes of a type for one pand (`match.frontage`, else the house fit width). */
export function frontageVetoes(t: MatchableType, ev: PandEvidence): string[] {
  const f = t.match?.frontage;
  if (!f) {
    const fw = t.fit?.widthM;
    return fw && (ev.widthM < fw[0] - AUTO_PLACE.widthSlackM || ev.widthM > fw[1] + AUTO_PLACE.widthSlackM) ? [`frontage ${ev.widthM} m, type ${fw.join('-')} m`] : [];
  }
  const veto: string[] = [];
  if (ev.widthM < f.widthM[0] || ev.widthM > f.widthM[1]) veto.push(`stair block ${ev.widthM} m, type ${f.widthM.join('-')} m`);
  const p = storeyPitch(t), n = Math.round(ev.eavesM / p);
  if (!f.storeys.includes(n)) veto.push(`3DBAG eaves ${r2(ev.eavesM)} m = ${n} storeys of the type's ${r2(p)} m, type ${f.storeys.join('/')}`);
  const cols = ev.strip?.columns;
  if (cols) {
    const pitch = ev.widthM / cols;
    if (pitch < f.axisPitchM[0] || pitch > f.axisPitchM[1]) veto.push(`axis pitch ${r2(pitch)} m (${cols} strip columns over ${ev.widthM} m), type ${f.axisPitchM.join('-')} m`);
  }
  return veto;
}

export const FRONT_EAVES = {tolM: 1.0} as const;

/** The eaves a `frontEavesM` type draws on this pand: its own skyline cornice when read near the type's line, else the line. */
export function frontEavesFor(t: MatchableType, ev: PandEvidence): {eavesM: number; source: 'skyline' | 'type'} | null {
  const line = t.match?.frontEavesM;
  if (line === undefined) return null;
  const sky = ev.strip?.skyline;
  if (sky && sky.confidence >= SKYLINE_MIN_CONFIDENCE && Math.abs(sky.eavesM - line) <= FRONT_EAVES.tolM) return {eavesM: r2(sky.eavesM), source: 'skyline'};
  return {eavesM: line, source: 'type'};
}

/** Skyline ranges of a crown variant; `alt` is a second accepted range set (either matches). */
export interface CrownRule { none?: boolean; riseM?: [number, number]; topWidthM?: [number, number]; widthM?: [number, number] }

/** A library type with its match rule (typeLibrary.ts LibraryHouseType plus `match`). */
export type MatchableType = HouseTypeIntent & {match?: TypeMatchRule};

export interface StripEvidence {
  date: string;
  /** strip.json span pixels, for citations */
  px: [number, number];
  palette: StripPalette;
  /** The wall colour normalised by the light trim (measureFacade `wall.hex`): exposure-independent, what the likeness gate compares. */
  wall: string | null;
  /** `rowExposure` only: the pand's own trim-normalised wall before the row's gain replaced it. */
  wallOwnGain?: string;
  skyline: Skyline | null;
  /** What ends the skyline's columns (stripSkyline.ts `measureSkyBound`); read by types with `match.crownFromType`. */
  skyBound?: SkyBound;
  /** Body-band shares that are no evidence: the strip's grey placeholder and foliage. */
  voidShare: number; foliageShare: number;
  /** The strip evidence gate (stripEvidence.ts, #120): does the span show the front (sky over the roof in most columns)?
   * Absent when the gate was not run; a failing gate holds the pand before the type match and the likeness score. */
  frontEvidence?: {pass: boolean; reasons: string[]; skyCols: number};
  /** Window columns over the upper storeys (measureFacade on the span), null when unread. */
  columns: number | null;
  /** measureFacade's front class of the span (punched, ribbon, ...); undefined when unread. */
  frontClass?: FrontClass;
  /** Door side read off the ground band (the dark tall opening nearest a party wall), null when unread. */
  doorSide: 'left' | 'right' | null;
  /** The half of the upper storeys holding clearly more light accent pixels (ratio >= 1.6), null when even. */
  accentSide?: 'left' | 'right' | null;
  /** Share of the upper storeys' (6.5 m .. eaves - 0.5 m) non-placeholder pixels that are light accent (white bays, frames). */
  accentShare?: number;
  /** Exposure-normalised structure of the upper body (blockFace/stripStructure.ts): bays, open axes, balconies. */
  structure?: StripStructure | null;
}

export interface PandEvidence {
  pandId: string;
  address: string;
  builtYear: number | null;
  widthM: number;
  eavesM: number;
  /** The 3DBAG/PDOK eaves when a reviewer's eaves pin replaced `eavesM` (reviewEaves.ts); absent = `eavesM` is the survey's. */
  surveyEavesM?: number;
  roofMaxM: number;
  storeys3dbag: number | null;
  /** BAG gebruiksdoel of the ground units, and the OSM businesses assigned to the pand (blockFace/uses.ts). */
  groundUses: string[];
  osm: {type: string; id: number; name?: string; category?: string}[];
  strip?: StripEvidence;
  /** The bay of the pand's BAG outline in front of its facade line (`frontBump` of the discovered front), null when straight; undefined = not read. */
  bagBay?: FrontBump | null;
}

export interface Criterion { key: string; score: number | null; weight: number; note: string }
export interface TypeScore { typeId: string; score: number; veto: string[]; criteria: Criterion[] }

export const AUTO_PLACE = {
  /** A placement needs this weighted score (0..1). */
  minScore: 0.7,
  /** A runner-up within this of the winner is reported as a tie. */
  margin: 0.05,
  /** Body pixels that are placeholder grey or foliage beyond this: no photo evidence. */
  maxVoid: 0.35, maxFoliage: 0.3,
  yearSlack: 2,
  /** Frontage beyond the type's fit by more than this vetoes it (house types; `match.frontage` stair blocks judge otherwise). */
  widthSlackM: 0.4,
  flatRoofRiseM: 1.5,
} as const;

const W = {eaves: 2, storeys: 1, roof: 1, wall: 2, stucco: 2, bands: 1, columns: 1.5} as const;
const hexRgb = (h: string): Rgb => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)) as Rgb;
export const deltaE = (a: string, b: string) => { const p = rgbToLab(hexRgb(a)), q = rgbToLab(hexRgb(b)); return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]); };
const r2 = (v: number) => +v.toFixed(2);

/** The bay count a type gives a pand of this width (its width rule, else the body's). */
export function baysFor(t: MatchableType, widthM: number): number {
  const rule = t.match?.baysByWidth?.find(b => widthM <= b.maxWidthM);
  if (rule) return rule.bays;
  return typeof t.body.bays === 'number' ? t.body.bays : Math.max(...t.body.bays);
}

/** The type's storey pitch: the middle of its eaves range over its body storeys (3.35 m on the 1904 rows). */
export const storeyPitch = (t: MatchableType) => t.match?.eavesM ? (t.match.eavesM[0] + t.match.eavesM[1]) / 2 / t.body.storeys : 3.3;
/** The storey count of the type's fit whose pitch over the eaves is closest to the type's (Hasebroekstraat 1-37: 16.5 m = 5 storeys). */
export function storeysFor(t: MatchableType, eavesM: number): number {
  const options = t.fit?.storeys?.length ? t.fit.storeys : [t.body.storeys], p = storeyPitch(t);
  return options.reduce((best, s) => Math.abs(eavesM / s - p) < Math.abs(eavesM / best - p) ? s : best, t.body.storeys);
}

/**
 * The side of a pand's one-sided light mass: the bay's centre when the structure reads a bay of 1.5 m or more (exposure
 * independent), else the strip's accent-pixel asymmetry.
 */
export function accentSideOf(s: StripEvidence): 'left' | 'right' | null {
  const b = s.structure;
  if (b && b.bayWidthM >= 1.5 && b.bayCentre !== null && Math.abs(b.bayCentre - 0.5) >= 0.1) return b.bayCentre < 0.5 ? 'left' : 'right';
  return s.accentSide ?? null;
}

/** Score one type for one pand. A veto (year, width) makes the score 0. */
export function scoreType(t: MatchableType, ev: PandEvidence): TypeScore {
  const m = t.match, veto: string[] = [], criteria: Criterion[] = [];
  if (!m) return {typeId: t.id, score: 0, veto: ['type has no match rule'], criteria};
  const slack = m.yearSlack ?? AUTO_PLACE.yearSlack;
  if (ev.builtYear === null) veto.push('no build year');
  else if (ev.builtYear < m.years[0] - slack || ev.builtYear > m.years[1] + slack) veto.push(`built ${ev.builtYear}, type ${m.years.join('-')}`);
  veto.push(...frontageVetoes(t, ev));
  if (m.frontEavesM !== undefined && m.frontEavesUnscored) { /* drawn at the line, not scored */ }
  else if (m.frontEavesM !== undefined) {
    const sky = ev.strip?.skyline, read = sky && sky.confidence >= SKYLINE_MIN_CONFIDENCE ? sky.eavesM : null;
    const off = read === null ? null : Math.min(Math.abs(read - m.frontEavesM), m.frontSkylineM === undefined ? Infinity : Math.abs(read - m.frontSkylineM));
    criteria.push({key: 'eaves', weight: W.eaves, score: off === null ? null : off <= 0.5 ? 1 : off <= 1 ? 0.5 : 0, note: read === null ? `strip cornice unread (type line ${m.frontEavesM} m; 3DBAG ${r2(ev.eavesM)} m not compared)` : `strip cornice ${r2(read)} m vs the type's ${m.frontEavesM} m${m.frontSkylineM === undefined ? '' : ` (wall-dormer skyline ${m.frontSkylineM} m)`}`});
  } else if (m.eavesM) {
    // The eaves over the storey count the type would draw (its fit) against the type's own storey pitch: a 5-storey
    // member of a 4-storey type's row (Hasebroekstraat 1-37 at 16.5 m beside 4-36 at 13.2 m) is the same design.
    const s = storeysFor(t, ev.eavesM), p = storeyPitch(t), off = Math.abs(ev.eavesM / s - p) / p;
    criteria.push({key: 'eaves', weight: W.eaves, score: off <= 0.08 ? 1 : off <= 0.15 ? 0.5 : 0, note: `3DBAG eaves ${r2(ev.eavesM)} m = ${s} storeys of ${r2(ev.eavesM / s)} m vs the type's ${r2(p)} m`});
  }
  if (m.storeys3dbag) criteria.push({key: 'storeys', weight: W.storeys, score: !ev.storeys3dbag ? null : m.storeys3dbag.includes(ev.storeys3dbag) ? 1 : 0, note: `3DBAG bouwlagen ${ev.storeys3dbag ?? '-'} vs ${m.storeys3dbag.join('/')}`});
  if (m.roof) {
    const rise = ev.roofMaxM - ev.eavesM, form = rise < AUTO_PLACE.flatRoofRiseM ? 'flat' : 'pitched';
    criteria.push({key: 'roof', weight: W.roof, score: form === m.roof ? 1 : 0, note: `roof rise ${r2(rise)} m (${form}) vs ${m.roof}`});
  }
  const s = ev.strip, usable = s && s.voidShare <= AUTO_PLACE.maxVoid && s.foliageShare <= AUTO_PLACE.maxFoliage;
  if (m.wall) {
    const wall = usable ? s!.wall : null, d = wall ? deltaE(wall, m.wall.hex) : null;
    criteria.push({key: 'wall', weight: W.wall, score: d === null ? null : d <= m.wall.maxDE ? 1 : d <= 2 * m.wall.maxDE ? 0.5 : 0, note: d === null ? 'no strip wall' : `strip wall ${wall} dE ${d.toFixed(1)} to ${m.wall.hex} (<= ${m.wall.maxDE})`});
  }
  if (m.stucco !== undefined) criteria.push({key: 'stucco', weight: W.stucco, score: usable ? (s!.palette.stucco === m.stucco ? 1 : 0) : null, note: usable ? `strip accent share ${s!.palette.shares.accent} (${s!.palette.stucco ? 'stucco' : 'brick'})` : 'no strip'});
  if (m.bands !== undefined) {
    const runs = usable ? s!.palette.bandRunsM.length : null;
    criteria.push({key: 'bands', weight: W.bands, score: runs === null ? null : (runs >= 2) === m.bands ? 1 : 0, note: runs === null ? 'no strip' : `${runs} painted band runs`});
  }
  const st = usable ? s!.structure ?? null : null;
  if (m.balconies === false && st?.balconies) veto.push(`strip shows balconies (${st.balconyWhy})`);
  if (m.bagBay !== undefined && ev.bagBay !== undefined) {
    const off = ev.bagBay ? Math.abs(ev.bagBay.centre - 0.5) : null, offOk = !m.bagBayOffset || (off !== null && off >= m.bagBayOffset[0] && off <= m.bagBayOffset[1]);
    criteria.push({key: 'bag-bay', weight: 3, score: !!ev.bagBay === m.bagBay && (!m.bagBay || offOk) ? 1 : 0,
      note: ev.bagBay ? `BAG outline bay ${ev.bagBay.fromM}-${ev.bagBay.toM} m, ${ev.bagBay.depthM} m deep, centre ${ev.bagBay.centre}` : 'BAG outline straight'});
  }
  if (m.bayWidthM) criteria.push({key: 'bay', weight: 3, score: st ? (st.bayWidthM >= m.bayWidthM[0] && st.bayWidthM <= m.bayWidthM[1] ? 1 : 0) : null, note: st ? `widest light bay ${st.bayWidthM} m vs ${m.bayWidthM.join('-')} m` : 'no strip structure'});
  if (m.accentShare) criteria.push({key: 'accent-share', weight: 2, score: usable && s!.accentShare !== undefined ? (s!.accentShare >= m.accentShare[0] && s!.accentShare <= m.accentShare[1] ? 1 : 0) : null, note: usable ? `upper accent share ${s!.accentShare ?? '-'} vs ${m.accentShare.join('-')}` : 'no strip'});
  if (m.mirrorForAccent) { const side = usable ? accentSideOf(s!) : null; criteria.push({key: 'accent-side', weight: 2, score: usable ? (side ? 1 : 0) : null, note: usable ? `upper accent ${side ?? 'even'} (type: one-sided)` : 'no strip'}); }
  if (m.crownMatch && m.crowns) {
    const sky = usable ? s!.skyline : null, read = !!sky && sky.confidence >= SKYLINE_MIN_CONFIDENCE, hit = read ? crownRuleFor(t, sky!.crown) : null;
    criteria.push({key: 'crown', weight: 3, score: read ? (hit ? 1 : 0) : null, note: read ? `skyline ${sky!.crown ? `crown rise ${sky!.crown.riseM} m, top ${sky!.crown.topWidthM} m` : 'no crown'} ${hit ? `fits ${hit}` : 'fits no crown of the type'}` : 'skyline unread'});
  }
  if (m.crownStrict && m.crowns && usable) {
    const sky = s!.skyline;
    if (sky && sky.confidence >= SKYLINE_MIN_CONFIDENCE && skylineBounded(sky, s!.skyBound, ev.roofMaxM).ok && !crownRuleFor(t, sky.crown))
      veto.push(`skyline ${sky.crown ? `crown rise ${sky.crown.riseM} m, top ${sky.crown.topWidthM} m` : 'no crown'} fits no crown of the type`);
  }
  if (m.materialVeto && usable) veto.push(...materialVetoes(m, stripWallMaterial({stucco: s!.palette.stucco, wall: s!.wall})));
  const want = baysFor(t, ev.widthM);
  if (usable && s!.columns !== null) criteria.push(columnsCriterion(s!.columns, want, m.columnsPerBay));
  const scored = criteria.filter(c => c.score !== null), wsum = scored.reduce((a, c) => a + c.weight, 0);
  const score = veto.length ? 0 : wsum ? scored.reduce((a, c) => a + c.weight * c.score!, 0) / wsum : 0;
  return {typeId: t.id, score: r2(score), veto, criteria};
}

/**
 * OSM street furniture matched to a frontage: a bench or a litter bin on the pavement is not a business in the pand.
 * De la Reijstraat 28B (2026-11-01, #154): an `amenity=bench` 5.6 m out made the house `services` and gave it a shop
 * front, which a type with a ground-storey oriel cannot carry. #157 added the rest of the pavement set: a public bookcase
 * (Hasebroekstraat 28 drew a bar front: `amenity=pub` was matched as a prefix of `amenity=public_bookcase`; the use
 * patterns are anchored now), a fountain, a give box, a bicycle repair stand.
 */
export const STREET_FURNITURE = /^amenity=(bench|waste_basket|waste_disposal|recycling|bicycle_parking|motorcycle_parking|parking|parking_entrance|parking_space|post_box|vending_machine|drinking_water|telephone|clock|charging_station|bicycle_rental|bicycle_repair_station|shelter|toilets|grit_bin|letter_box|public_bookcase|give_box|fountain)$/;
/**
 * The OSM category of a business node or way matched to a pand (scripts/block-face/auto-place.ts evidence): the first
 * of shop, amenity, craft, office and healthcare.
 */
export function osmCategory(tags: Record<string, string | undefined>): string | undefined {
  return tags.shop ? `shop=${tags.shop}` : tags.amenity ? `amenity=${tags.amenity}` : tags.craft ? `craft=${tags.craft}` : tags.office ? `office=${tags.office}` : tags.healthcare ? `healthcare=${tags.healthcare}` : undefined;
}
/** Ground use of a pand from BAG and OSM (no photo reading: the agreement says so). */
export function groundUse(ev: PandEvidence, photoDate: string): GroundFloorUse {
  const osm = ev.osm.filter(o => !o.category || !STREET_FURNITURE.test(o.category));
  const biz = osm.find(o => o.category && !/^office=/.test(o.category)) ?? osm[0];
  const bagTrade = ev.groundUses.some(u => /winkel|bijeenkomst|horeca/.test(u));
  const use: GroundFloorUse['use'] = biz?.category ? (/^amenity=(restaurant|fast_food)$/.test(biz.category) ? 'restaurant' : /^amenity=cafe$/.test(biz.category) ? 'cafe' : /^amenity=(bar|pub)$/.test(biz.category) ? 'bar' : /^shop=/.test(biz.category) ? 'shop' : /^office=/.test(biz.category) ? 'office' : 'services')
    : bagTrade ? 'shop' : ev.groundUses.some(u => /kantoor/.test(u)) ? 'office' : 'residential';
  return {use, ...(biz?.name ? {name: biz.name} : {}), ...(biz?.category ? {category: biz.category} : {}), ...(biz ? {osm: {type: biz.type, id: biz.id, ...(biz.name ? {name: biz.name} : {})}} : {}),
    bag: ev.groundUses, photoDate, agreement: biz ? 'osm-only' : 'bag-only', note: 'auto-place: BAG gebruiksdoel and OSM, not read off the photo'};
}

export interface Placed {
  pandId: string; typeId: string; score: number; runnerUp?: {typeId: string; score: number};
  house: BlockFaceHouse; notes: string[];
}
/** `review`: held after a person reviewed the run's strip sheet (buurten/<buurt>-review-holds.json). */
export interface Held { pandId: string; address: string; stage: 'match' | 'evidence' | 'likeness' | 'run' | 'review' | 'installed'; reason: string; best?: TypeScore }
export type Decision = ({kind: 'placed'} & Placed) | ({kind: 'held'} & Held);

/** The shop ground of an auto-placed trading pand: the measured fascia colour, a residential door on the door side. */
export function autoShopfront(ev: PandEvidence, use: GroundFloorUse): ShopfrontIntent {
  const fascia = ev.strip?.palette.fascia ?? '#3a3a3a';
  return {colour: fascia, fascia: true, ...(use.name ? {name: use.name} : {}), entrance: 'centre', glazing: 'split', stallriser: 'low',
    ...(ev.widthM >= 5 ? {residentialDoor: {side: ev.strip?.doorSide ?? 'left', colour: '#2a2a2a'}} : {}),
    evidence: `auto-place: ${use.agreement} (${[...use.bag ?? [], use.category].filter(Boolean).join(', ')}); fascia colour measured on the strip ${ev.strip?.date ?? '-'} span ${ev.strip?.px.join('-') ?? '-'}`};
}

/** Decide one pand: the best type over the threshold, or a hold with the reason. */
export function decidePand(types: MatchableType[], ev: PandEvidence, slug: string, photoDate: string): Decision {
  const s = ev.strip;
  if (!s) return {kind: 'held', pandId: ev.pandId, address: ev.address, stage: 'evidence', reason: 'no strip span (no panorama covers the front)'};
  if (s.voidShare > AUTO_PLACE.maxVoid) return {kind: 'held', pandId: ev.pandId, address: ev.address, stage: 'evidence', reason: `strip ${Math.round(s.voidShare * 100)} % without panorama data`};
  if (s.frontEvidence && !s.frontEvidence.pass) return {kind: 'held', pandId: ev.pandId, address: ev.address, stage: 'evidence', reason: `no front on the strip: ${s.frontEvidence.reasons.join('; ')}`};
  const ranked = types.map(t => scoreType(t, ev)).sort((a, b) => b.score - a.score);
  const best = ranked[0], second = ranked[1];
  if (!best || best.score < AUTO_PLACE.minScore) {
    const why = !best ? 'no types' : best.veto.length ? `every type vetoed (best ${best.typeId}: ${best.veto.join('; ')})` : `best ${best.typeId} scores ${best.score} < ${AUTO_PLACE.minScore} (${best.criteria.filter(c => c.score !== null && c.score < 1).map(c => c.note).join('; ')})`;
    return {kind: 'held', pandId: ev.pandId, address: ev.address, stage: 'match', reason: why, best};
  }
  const t = types.find(x => x.id === best.typeId)!;
  const notes: string[] = [];
  if (second && second.score > 0 && best.score - second.score < AUTO_PLACE.margin) notes.push(`near tie with ${second.typeId} (${second.score})`);
  const use = groundUse(ev, photoDate);
  const trading = !['residential', 'office', 'vacant'].includes(use.use);
  const bays = baysFor(t, ev.widthM), bodyBays = typeof t.body.bays === 'number' ? t.body.bays : undefined;
  const placement: HousePlacement = {type: t.id};
  if (bodyBays !== undefined && bays !== bodyBays) placement.overrides = {bays};
  // Storeys from the eaves, not 3DBAG bouwlagen (it counts the attic: 5 on the 4-storey Hasebroekstraat 4-36).
  const storeys = t.match?.frontEavesM !== undefined ? t.body.storeys : storeysFor(t, ev.eavesM);
  if (storeys !== t.body.storeys) { placement.storeys = storeys; notes.push(`storeys ${storeys}: eaves ${ev.eavesM} m at the type's ${storeyPitch(t).toFixed(2)} m pitch`); }
  // Door side: the type's grounds are authored door-left / door-right; the measured side picks one, unread keeps the first.
  const grounds = Object.keys(t.grounds ?? {});
  if (trading) placement.ground = {shopfront: autoShopfront(ev, use)};
  // A bay in the BAG outline gives the accent side outright (it does not depend on the strip's exposure).
  const bagSide = ev.bagBay && Math.abs(ev.bagBay.centre - 0.5) >= 0.1 ? (ev.bagBay.centre < 0.5 ? 'left' : 'right') : null;
  const aSide = bagSide ?? accentSideOf(s);
  if (t.match?.mirrorForAccent && aSide) { if (aSide !== t.match.mirrorForAccent) placement.mirror = true; notes.push(`accent ${aSide}${placement.mirror ? ': mirrored' : ''}`); }
  else if (t.match?.mirrorForDoor) { if (s.doorSide && s.doorSide !== t.match.mirrorForDoor) placement.mirror = true; notes.push(`door ${s.doorSide ?? 'unread'}${placement.mirror ? ': mirrored' : ''}`); }
  else if (!trading && s.doorSide && grounds.includes(`door-${s.doorSide}`)) placement.ground = `door-${s.doorSide}`;
  if (s.wall && !s.palette.stucco && s.foliageShare <= AUTO_PLACE.maxFoliage && t.match?.measuredWall !== false) placement.measuredPalette = {brick: s.wall, evidence: `strip ${s.date} span ${s.px.join('-')}: ${s.wallOwnGain ? `raw wall at the row's trim gain (autoPlace.ts rowExposure; own gain ${s.wallOwnGain})` : 'trim-normalised wall (buildingRecipe/measureFacade.ts)'}`};
  const crown = crownFor(t, s.skyline, {roofMaxM: ev.roofMaxM, skyBound: s.skyBound});
  if (crown.name !== Object.keys(t.crowns)[0]) placement.crown = crown.name;
  notes.push(crown.why);
  const rhythm: Partial<RhythmSpec> = {citation: `auto-place: ${t.id} scored ${best.score} on ${best.criteria.map(c => `${c.key} ${c.score ?? '-'}`).join(', ')}; strip ${s.date} span ${s.px.join('-')}`};
  return {kind: 'placed', pandId: ev.pandId, typeId: t.id, score: best.score, ...(second ? {runnerUp: {typeId: second.typeId, score: second.score}} : {}), notes,
    house: {pandId: ev.pandId, slug, address: ev.address, type: placement, groundFloor: use, rhythm: rhythm as RhythmSpec}};
}

export const SKYLINE_MIN_CONFIDENCE = 0.6;

/** The crown variant the skyline reads (`match.crowns`), else the type's first. */
/** The first crown rule of the type (with a crown drawn for it) that holds this skyline crown (null = no crown), or null. */
export function crownRuleFor(t: MatchableType, c: Skyline['crown']): string | null {
  const inR = (v: number, r?: [number, number]) => !r || (v >= r[0] && v <= r[1]);
  const fits = (q: CrownRule) => !!c && inR(c.riseM, q.riseM) && inR(c.topWidthM, q.topWidthM) && inR(c.widthM, q.widthM);
  for (const [name, r] of Object.entries(t.match?.crowns ?? {})) if (t.crowns[name] && (r.none ? !c : fits(r) || (!!r.alt && fits(r.alt)))) return name;
  return null;
}

export function crownFor(t: MatchableType, sky: Skyline | null, pand?: {roofMaxM: number; skyBound?: SkyBound}): {name: string; why: string} {
  const first = Object.keys(t.crowns)[0], rules = t.match?.crowns;
  if (!rules) return {name: first, why: `crown ${first} (type default)`};
  // match.crownFromType: a skyline that is no evidence gives the type's crown, not the first variant.
  const typed = t.match?.crownFromType !== undefined && t.crowns[t.match.crownFromType] ? t.match.crownFromType : null;
  const fallback = (why: string) => typed ? {name: typed, why: `crown ${typed}: crown from type (${why})`} : {name: first, why: `crown ${first}: ${why}`};
  if (!sky || sky.confidence < SKYLINE_MIN_CONFIDENCE) return fallback(`skyline unread (confidence ${sky?.confidence ?? 0})`);
  if (typed && pand) {
    const b = skylineBounded(sky, pand.skyBound, pand.roofMaxM);
    if (!b.ok) return fallback(`skyline not sky-bounded: ${b.why}`);
  }
  const c = sky.crown, inR = (v: number, r?: [number, number]) => !r || (v >= r[0] && v <= r[1]);
  for (const [name, r] of Object.entries(rules)) {
    if (!t.crowns[name]) continue;
    const fits = (q: CrownRule) => !!c && inR(c.riseM, q.riseM) && inR(c.topWidthM, q.topWidthM) && inR(c.widthM, q.widthM);
    if (r.none ? !c : fits(r) || (!!r.alt && fits(r.alt))) return {name, why: `crown ${name}: skyline ${c ? `rise ${c.riseM} m, width ${c.widthM} m, top ${c.topWidthM} m` : 'no crown over the eaves'}`};
  }
  return fallback(`skyline ${c ? `rise ${c.riseM} m, width ${c.widthM} m, top ${c.topWidthM} m` : 'no crown'} matches no variant`);
}

/**
 * One exposure for a row (auto-place `--row-exposure`). The trim normalisation of each pand's wall (measureFacade: the
 * p97 light cells to 215/255) takes whatever is lightest in that pand for white, so on one strip of one brick the gain
 * follows the house type, not the light: Hoendiepstraat 5-35 (2023-01-03) 1.26-1.36 under the white attic storey and
 * 0.82-0.88 where a van or a tree covers it; Eemsstraat 6-36 1.35 at the white-framed erkers, 0.93 at the flat fronts.
 * Here every unpainted pand with both readings takes its raw strip wall (stripPalette `wall`) times the median gain of
 * the face, per channel, so a row keeps the differences in its bricks and loses those of its trim. Returns the gain, or
 * null (nothing changed) with fewer than four such pands.
 */
export function rowExposure(evs: PandEvidence[], given?: [number, number, number]): [number, number, number] | null {
  const use = evs.filter(e => e.strip?.wall && e.strip.palette.wall && !e.strip.palette.stucco);
  if (!given && use.length < 4) return null;
  const gain = given ?? medianGain(trimGains(evs));
  for (const e of use) {
    const r = hexRgb(e.strip!.palette.wall!), hex = '#' + r.map((v, c) => Math.min(255, Math.round(v * gain[c])).toString(16).padStart(2, '0')).join('');
    e.strip!.wallOwnGain = e.strip!.wall!; e.strip!.wall = hex;
  }
  return gain;
}
/** Per pand (unpainted, both readings): the trim normalisation's gain per channel, trim-normalised wall over raw strip wall. */
export function trimGains(evs: PandEvidence[]): number[][] {
  return evs.filter(e => e.strip?.wall && e.strip.palette.wall && !e.strip.palette.stucco)
    .map(e => { const w = hexRgb(e.strip!.wall!), r = hexRgb(e.strip!.palette.wall!); return w.map((v, c) => v / Math.max(1, r[c])); });
}
/**
 * The median per channel of many pands' gains. `--row-exposure=date` pools every face of the run photographed on one
 * day: one light, one exposure (Hoendiepstraat 5-35's own median, 1.33, is its white attic storey; the other faces of
 * 2023-01-03, Eemsstraat and Hoendiepstraat 2-60, read 0.94).
 */
export function medianGain(gains: number[][]): [number, number, number] {
  const median = (xs: number[]) => { const q = [...xs].sort((x, y) => x - y), m = q.length >> 1; return q.length % 2 ? q[m] : (q[m - 1] + q[m]) / 2; };
  return [0, 1, 2].map(c => +median(gains.map(g => g[c])).toFixed(3)) as [number, number, number];
}

/**
 * Row coherence for the BAG erker (Rivierenbuurt 1934 rows). Two rules; the presence of a BAG erker outline is a fact
 * they never override, its offset along the front is not:
 *
 * 1. Between two of a kind. The types of a street side tell their erker apart by its place in the BAG outline
 *    (`match.bagBayOffset`), and BAG digitises the same erker 0.05-0.15 of the front apart from house to house
 *    (Boterdiepstraat 25: 0.75 among 0.65s), so a lone pand lands on a neighbour row's type. A placed pand between two
 *    placed neighbours of one other type (across at most one held pand on each side: Hoendiepstraat 13 beside the held
 *    11), drawn the same way round, takes their type and side. A pand BAG draws with an erker never becomes a type
 *    without one.
 * 2. The rhythm. The rows repeat every four houses (erker pair, then flat pair). A placed pand takes the type and side
 *    of the houses four along when those of them that BAG draws with an erker agree and at least one does: BAG misses
 *    some erkers the photo shows (Eemsstraat 22 and 14, Boterdiepstraat 50) and puts others off their row's place
 *    (Hoendiepstraat 8: 0.25 among 0.31s). Again an erker in BAG is never dropped.
 *
 * The adopted type is scored with the reference house's BAG bay (the row's erker place), so it places on the same
 * evidence as its neighbours. Returns the pands changed.
 */
export function rowCoherence(decisions: Decision[], types: MatchableType[], evs: PandEvidence[], photoDate: string): string[] {
  const changed: string[] = [];
  type P = {kind: 'placed'} & Placed;
  const placedAt = (j: number) => j >= 0 && j < decisions.length && decisions[j].kind === 'placed' ? decisions[j] as P : null;
  const adopt = (k: number, t: MatchableType, ref: number, why: string) => {
    const d = decisions[k] as P, r = decisions[ref] as P, bay = evs[k].bagBay, mirror = !!r.house.type?.mirror;
    let nd = decidePand([t], {...evs[k], bagBay: evs[ref].bagBay ?? bay}, d.house.slug, photoDate);
    if (nd.kind !== 'placed') {
      const {bagBay: _bay, bagBayOffset: _offset, ...rest} = t.match!;
      nd = decidePand([{...t, match: rest} as MatchableType], evs[k], d.house.slug, photoDate);
    }
    if (nd.kind !== 'placed') return;
    if (mirror) nd.house.type!.mirror = true; else delete nd.house.type!.mirror;
    nd.notes = [...nd.notes.filter(x => !/^(accent|door) |^bag-bay /.test(x)), `row coherence: ${why}, was ${d.typeId}${d.house.type?.mirror ? ' (mirrored)' : ''}${bay ? ` (BAG bay centre ${bay.centre})` : ' (no BAG bay)'}`];
    decisions[k] = nd; changed.push(d.pandId);
  };
  const same = (x: P, y: P) => x.typeId === y.typeId && !!x.house.type?.mirror === !!y.house.type?.mirror;
  const keepsBay = (k: number, t: MatchableType | undefined) => !!t?.match && t.match.bagBay !== undefined && !(evs[k].bagBay && !t.match.bagBay);
  for (let k = 1; k + 1 < decisions.length; k++) {
    const d = placedAt(k);
    const ia = placedAt(k - 1) ? k - 1 : decisions[k - 1].kind === 'held' && placedAt(k - 2) ? k - 2 : -1;
    const ib = placedAt(k + 1) ? k + 1 : decisions[k + 1].kind === 'held' && placedAt(k + 2) ? k + 2 : -1;
    if (!d || ia < 0 || ib < 0) continue;
    const a = decisions[ia] as P, b = decisions[ib] as P;
    if (!same(a, b) || a.typeId === d.typeId) continue;
    const t = types.find(x => x.id === a.typeId);
    if (!keepsBay(k, t)) continue;
    adopt(k, t!, ia, `between two ${t!.id}${a.house.type?.mirror ? ' (mirrored)' : ''} houses`);
  }
  for (let k = 0; k < decisions.length; k++) {
    const d = placedAt(k);
    if (!d || evs[k].bagBay === undefined || changed.includes(d.pandId)) continue;
    const at = [k - 4, k + 4].filter(j => placedAt(j) && evs[j].bagBay), anchors = at.map(j => decisions[j] as P);
    if (!anchors.length || anchors.some(x => !same(x, anchors[0])) || same(anchors[0], d)) continue;
    // A pand with its own BAG erker is moved only on a confirmed rhythm: two anchors, or one whose own house four further
    // on agrees with it (Hoendiepstraat 16 and 24 for 8), never on one house at the end of a face.
    const confirmed = at.length === 2 || at.some(j => { const far = placedAt(2 * j - k); return !!far && !!evs[2 * j - k].bagBay && same(far, decisions[j] as P); });
    if (evs[k].bagBay && !confirmed) continue;
    const t = types.find(x => x.id === anchors[0].typeId);
    if (!t?.match?.bagBay || !keepsBay(k, t)) continue;
    adopt(k, t, at[0], `the row repeats every four houses: ${anchors.map(x => x.pandId.slice(-6)).join(' and ')} (BAG erker) are ${t.id}${anchors[0].house.type?.mirror ? ' (mirrored)' : ''}`);
  }
  return changed;
}

/**
 * Mirrored pairs (`match.mirrorForDoor`): a pand whose door was not read takes the opposite of a same-type neighbour
 * whose door was (the doors of a pair meet at one party wall, so neighbours alternate).
 */
export function fillPairs(decisions: Decision[], types: MatchableType[]): number {
  let filled = 0;
  for (let sweep = 0, before = -1; sweep < 4 && filled !== before; sweep++) { before = filled; for (let k = 0; k < decisions.length; k++) {
    const d = decisions[k];
    if (d.kind !== 'placed' || !d.notes.includes('door unread') || !types.find(t => t.id === d.typeId)?.match?.mirrorForDoor) continue;
    const t = types.find(x => x.id === d.typeId)!;
    if (sweep > 0 && !t.match?.doorsPairAcross) continue; // later sweeps chain cross-type pairs only (same-type pairing is one forward pass)
    if (t.match?.doorsPairAcross) {
      // The neighbour's door side: its authored door ground, flipped when mirrored; known unless its own door is unread.
      const sideOf = (x: Decision | undefined): 'left' | 'right' | null => {
        if (x?.kind !== 'placed' || x.notes.includes('door unread')) return null;
        const g = typeof x.house.type?.ground === 'string' ? x.house.type.ground : Object.keys(types.find(y => y.id === x.typeId)?.grounds ?? {})[0];
        const s = g === 'door-left' ? 'left' : g === 'door-right' ? 'right' : null;
        return s && x.house.type?.mirror ? (s === 'left' ? 'right' : 'left') : s;
      };
      const left = sideOf(decisions[k - 1]), right = sideOf(decisions[k + 1]);
      const want = left === 'right' ? 'left' : right === 'left' ? 'right' : left === 'left' ? 'right' : right === 'right' ? 'left' : null;
      if (!want) continue;
      if (want !== t.match.mirrorForDoor) d.house.type!.mirror = true; else delete d.house.type!.mirror;
      const mate = left ? decisions[k - 1] as Placed : decisions[k + 1] as Placed;
      d.notes[d.notes.indexOf('door unread')] = `door unread: ${d.house.type!.mirror ? 'mirrored' : 'as drawn'}, paired with ${mate.pandId.slice(-6)}'s door`;
      filled++;
      continue;
    }
    const mate = [decisions[k - 1], decisions[k + 1]].find(x => x?.kind === 'placed' && x.typeId === d.typeId && !x.notes.includes('door unread')) as Placed | undefined;
    if (!mate) continue;
    if (!mate.house.type!.mirror) d.house.type!.mirror = true; else delete d.house.type!.mirror;
    d.notes[d.notes.indexOf('door unread')] = `door unread: ${d.house.type!.mirror ? 'mirrored' : 'as drawn'}, the opposite of ${mate.pandId.slice(-6)}`;
    filled++;
  } }
  return filled;
}

/**
 * The placement gate of one auto-placed pand over its structural likeness (blockFace/stripLikeness.ts: body NCC of the
 * photo strip against the model render): under `minNcc` the type is wrong for the photo (held); no score (too little
 * usable photo) is no evidence.
 */
export function placementGate(l: {ncc: number | null; abstain: string | null}, minNcc = 0.15): {gate: 'pass' | 'hold' | 'no-evidence'} {
  return {gate: l.ncc === null ? 'no-evidence' : l.ncc < minNcc ? 'hold' : 'pass'};
}

/**
 * Era guard (#113, 2026-10-29): a pand whose strip reads RIBBON windows (measureFacade `frontClass`: horizontal glazing
 * runs, or windows over 85 % of the bay) is not a punched-window 19th-century row. The pand that reads ribbon is held
 * when its type ends before RIBBON_GUARD.maxTypeYear; its contiguous same-build-year row is held with it only when ribbon
 * reads on at least RIBBON_GUARD.rowShare of the row's usable strips. Calibration on the #103/#113 batch strips: ribbon
 * read on 0 of 45 installed pands, and on 2 of 5 of Gerard Doustraat 1-7 (dou-1-7-r1: wide three-light windows drawn as
 * narrow arched ones) and 1 of 5 of Govert Flinckstraat 265-287 (flinck-265-287-r1: an interwar ribbon block drawn as
 * an 1889 row), both held at review. Per pand since 2026-11-01 (#152): one wide three-light front in a 1911 row
 * (Transvaalstraat 33 of 7-41, 1 of 12; Pretoriusstraat 82 of 72-96, 1 of 9) held the whole row.
 * Returns the pands held.
 */
export const RIBBON_GUARD = {maxTypeYear: 1914, rowShare: 0.2} as const;
export function ribbonRowHolds(decisions: Decision[], types: MatchableType[], evs: PandEvidence[]): string[] {
  const held: string[] = [];
  const usable = (e: PandEvidence) => !!e.strip && e.strip.voidShare <= AUTO_PLACE.maxVoid && e.strip.foliageShare <= AUTO_PLACE.maxFoliage;
  const ribbon = (e: PandEvidence) => usable(e) && e.strip!.frontClass === 'ribbon' && e.builtYear !== null;
  const hold = (j: number, k: number, year: number | null) => {
    const d = decisions[j];
    if (d.kind !== 'placed') return;
    const t = types.find(x => x.id === d.typeId);
    if (!t?.match || t.match.years[1] > RIBBON_GUARD.maxTypeYear) return;
    decisions[j] = {kind: 'held', pandId: d.pandId, address: d.house.address, stage: 'match',
      reason: `era guard: ${j === k ? 'the strip reads' : `${evs[k].address} (same ${year} row) reads`} ribbon windows; ${d.typeId} is a punched-window type`};
    held.push(d.pandId);
  };
  for (let k = 0; k < evs.length; k++) {
    if (!ribbon(evs[k])) continue;
    const year = evs[k].builtYear;
    let a = k, b = k;
    while (a > 0 && evs[a - 1].builtYear === year) a--;
    while (b + 1 < evs.length && evs[b + 1].builtYear === year) b++;
    const row = evs.slice(a, b + 1), seen = row.filter(usable).length, reads = row.filter(ribbon).length;
    if (seen && reads / seen >= RIBBON_GUARD.rowShare) { for (let j = a; j <= b; j++) hold(j, k, year); }
    else hold(k, k, year);
  }
  return held;
}

/**
 * Why a placed pand may stand alone as a one-house face (`TypeMatchRule.lonePand`), or null: its type opts in and its
 * BAG frontage reaches the type's `minWidthM`.
 */
export function lonePandReason(t: Pick<MatchableType, 'id' | 'match'> | undefined, widthM: number | undefined): string | null {
  const min = t?.match?.lonePand?.minWidthM;
  if (min === undefined || widthM === undefined || !(widthM >= min)) return null;
  return `a stair block on its own: ${t!.id} opts in to one-house faces from ${min} m (frontage ${r2(widthM)} m)`;
}

/**
 * Contiguous runs of placed pands (street order); a run of one cannot be a face and is held, unless `lone` gives a
 * reason it stands on its own (`lonePandReason`; absent = every run of one is held, byte-identical).
 */
export function placedRuns(decisions: Decision[], lone?: (p: Placed) => string | null): {runs: Placed[][]; orphans: Held[]} {
  const runs: Placed[][] = [], orphans: Held[] = [];
  let cur: Placed[] = [];
  const flush = () => {
    if (cur.length >= 2) runs.push(cur);
    else for (const p of cur) {
      const why = lone?.(p);
      if (why) { if (!p.notes.includes(`lone pand: ${why}`)) p.notes.push(`lone pand: ${why}`); runs.push([p]); }
      else orphans.push({pandId: p.pandId, address: p.house.address, stage: 'run', reason: 'a single placed pand between held neighbours or the face end: a block face needs two houses'});
    }
    cur = [];
  };
  for (const d of decisions) { if (d.kind === 'placed') cur.push(d); else flush(); }
  flush();
  return {runs, orphans};
}

/** The face intent of one run. */
export function runIntent(o: {id: string; street: string; stripDate: string; stripImage: string; types: string[]; run: Placed[]; note: string}): BlockFaceIntent {
  const used = [...new Set(o.run.map(p => p.typeId))];
  return {schemaVersion: 1, kind: 'block-face', id: o.id, street: o.street,
    sources: [{id: `strip-${o.stripDate}`, kind: 'street-panorama', capturedAt: o.stripDate, image: o.stripImage, license: 'Gemeente Amsterdam panorama, CC BY 4.0'} as BlockFaceIntent['sources'][number]],
    authoring: {author: 'auto-place (blockFace/autoPlace.ts)', passes: 1, note: o.note},
    types: o.types.filter(t => used.includes(t)),
    houses: o.run.map(p => p.house),
    continuity: {streetLevel: 'shared', corniceGroups: [], identical: [], partyClip: true,
      roof: {source: 'recipe', pitchDeg: 30, evidence: 'auto-place: low attic behind the cornice; the strips show sky over the cornices of the type rows'},
      // A run of one exists only when its type opted in (placedRuns `lone`); its note names why.
      ...(o.run.length === 1 ? {lonePand: {evidence: o.run[0].notes.find(n => n.startsWith('lone pand: '))?.slice(11) ?? 'a stair block on its own'}} : {})}};
}

/** A run directory of a face (`<face>` or `<face>-r<k>`, a batch trim `-t` included) and whether a chunk installs it. */
export interface ExistingRun { id: string; pands: readonly string[]; installed: boolean }

/** Run ids of `faceId` that `chunks.json` installs (`chunk-face-<run>`). */
export function installedRunIds(faceId: string, chunkIds: readonly string[]): string[] {
  const esc = faceId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), re = new RegExp(`^chunk-face-(${esc}(?:-r\\d+)?(?:-t)?)$`);
  return chunkIds.flatMap(c => { const m = re.exec(c); return m ? [m[1]] : []; });
}

/**
 * Installed runs a re-run keeps (#157 fix 2): every run with an installed chunk unless `--replace=<run>` names it. A
 * buurt-wide `auto-place --review` re-run used to renumber runs and overwrite installed intents (round 4 restored
 * retief-45-75-r1, pretorius-71-95-r1/r2 and pretorius-72-120-r1 from HEAD by hand; one re-run deleted pretorius-72-120-r1).
 * Their pands are held at stage `installed` and their directories are never written or removed.
 */
export function frozenRuns(existing: readonly ExistingRun[], replace: ReadonlySet<string>): ExistingRun[] {
  return existing.filter(r => r.installed && !replace.has(r.id));
}

/**
 * Ids for the runs of a (re-)placement. Without frozen runs or replacements: the face itself for one run of every member,
 * else `<face>-r1..k` in order (the numbering auto-place always used). With frozen runs: a frozen id is never given out;
 * a run that re-places a `--replace` run keeps that run's id (the one it overlaps most); every other run takes the
 * next free number, so an installed run directory is never renumbered or overwritten.
 */
export function assignRunIds(faceId: string, memberCount: number, runs: readonly (readonly string[])[], existing: readonly ExistingRun[], replace: ReadonlySet<string>): string[] {
  const frozen = frozenRuns(existing, replace), replaced = existing.filter(r => r.installed && replace.has(r.id));
  if (!frozen.length && !replaced.length) return runs.map((run, k) => runs.length === 1 && run.length === memberCount ? faceId : `${faceId}-r${k + 1}`);
  const used = new Set(frozen.map(r => r.id)), ids: (string | null)[] = runs.map(() => null);
  // Replaced runs first: each goes to the new run that shares most pands with it.
  for (const r of replaced) {
    let best = -1, overlap = 0;
    for (const [k, run] of runs.entries()) { const o = run.filter(p => r.pands.includes(p)).length; if (ids[k] === null && o > overlap) { best = k; overlap = o; } }
    if (best >= 0 && !used.has(r.id)) { ids[best] = r.id; used.add(r.id); }
  }
  let next = 1;
  return ids.map(id => {
    if (id) return id;
    while (used.has(`${faceId}-r${next}`)) next++;
    const out = `${faceId}-r${next}`; used.add(out); return out;
  });
}
