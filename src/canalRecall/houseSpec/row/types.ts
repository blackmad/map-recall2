/**
 * House rows (lane D, issue #386; docs/handoffs/house-rows-plan-20261114.md): the shared contract between the row solve
 * (lane D, `houseSpec/row/solve.ts`, `npm run house:rows`), the renderer (lane R, `houseLine/rowFront.ts`, `roofMesh.ts`)
 * and the gates and sheet (lane P, `check:rows`, `house:row-sheet`).
 *
 * The unit is the row, not the building (programme rule 1). A row is one street side, members in street order. A member
 * is a BAG pand; a pand with two house numbers that carries two house fronts (Kinkerstraat 106–108) is split into
 * fronts. A series is a run of fronts of one design; it has ONE solved design (cornice line, storeys, window cell, head
 * dressing, wall family, roof storey, extras). A front draws its series' design plus its own per-house fields (ground
 * use, door side, shop paint) and any field it overrides with a stated reason and source (face intent, two readings).
 *
 * Every solved field carries its source (`RowFieldSource`, precedence reviewed > face-intent > series-consensus >
 * single-read > period-default) and a ref. Nothing read is dropped silently: a read field that is not drawn is listed in
 * `readNotDrawn` with the reason (programme rule 3). A class disagreement between a face intent and the D1 consensus
 * is a `flags` entry, never resolved silently.
 *
 * Datum: metre heights in a series design (`corniceTopM`) are above the row's street ground, as the face intents
 * measure them (`continuity.measuredEaves`). Each front carries `groundOffsetM` (pand ground minus street ground, 3DBAG)
 * when known, and `topM` in the pand's own datum, which is what `RowFrontRecord` (rowFront.ts) takes.
 *
 * Types only, plus the small vocabularies as constants. Pure: no fs, no DOM.
 */
import type { JudgedFamily } from '../judgedColour.ts';

export const ROW_RECORD_VERSION = 1 as const;

/** Where a solved value came from, strongest first (programme brief "Row solve": precedence). */
export const ROW_FIELD_SOURCES = ['reviewed', 'face-intent', 'series-consensus', 'single-read', 'period-default'] as const;
export type RowFieldSource = (typeof ROW_FIELD_SOURCES)[number];
/** Higher wins. */
export const ROW_SOURCE_RANK: Readonly<Record<RowFieldSource, number>> = {
  reviewed: 5, 'face-intent': 4, 'series-consensus': 3, 'single-read': 2, 'period-default': 1,
};

/** One solved field: the value, its source and where to look. `votes` lists the readings a consensus counted. */
export interface RowField<T> {
  value: T;
  source: RowFieldSource;
  /** A repo path, artifact path or a short phrase (`kinker-86-110 intent.json continuity.measuredEaves`). */
  ref: string;
  /** Series consensus: each distinct read value and how many fronts read it (mode = the first). */
  votes?: Array<{ value: T; n: number }>;
  /** Metre fields: the readings the median was taken over. */
  samples?: number[];
}

// --- vocabularies -----------------------------------------------------------------------------------------------------

/** The crown of a series' front: a cornice (flat lid or roof storey behind it) or a gable family (rowFront crowns). */
export const ROW_CROWNS = ['cornice', 'neck', 'bell', 'point', 'step', 'spout'] as const;
export type RowCrownKind = (typeof ROW_CROWNS)[number];
/** The cornice moulding (intent CORNICES plus the spec-level `attic-frieze`). */
export const ROW_CORNICES = ['none', 'simple', 'bracketed', 'heavy', 'frieze', 'attic-frieze'] as const;
export type RowCorniceKind = (typeof ROW_CORNICES)[number];
/** A storey standing behind the cornice: a slate mansard face, an upright attic storey, or none (a flat lid). */
export const ROW_ROOF_STOREYS = ['mansard', 'attic', 'none'] as const;
export type RowRoofStoreyKind = (typeof ROW_ROOF_STOREYS)[number];
/** Dormers in a roof storey: `pediment` a triangular pediment top, `gabled` a small gable, `plain` a flat or box top. */
/** `ornate-pinnacle`: a tall wall dormer rising out of the front with a pediment and a finial or pinnacle (Kinkerstraat 100). */
export const ROW_DORMER_KINDS = ['pediment', 'gabled', 'plain', 'ornate-pinnacle'] as const;
export type RowDormerKind = (typeof ROW_DORMER_KINDS)[number];
/**
 * The white head dressing of a window row (the thing that makes these rows recognisable):
 *   block-course        a dotted course of white blocks alternating with brick across the front at the heads (Kinker 110–100)
 *   keystone            a white keystone on a flat brick head (strekken), Kinker 98, 96, 92
 *   segmental-tympanum  a segmental head with an ornamented stone tympanum, Kinker 94, 90, 86–88
 *   dentil-lintel       a lintel with a dentil course
 *   jack-blocks         stepped white blocks over the head (a crown of small blocks), Weteringschans 168096
 *   stone-lintel        a plain stone lintel
 *   arch-ring           a raised white arch ring with keystone over a round head
 *   none                plain brick heads
 */
export const ROW_HEAD_DRESSINGS = ['none', 'block-course', 'keystone', 'segmental-tympanum', 'dentil-lintel', 'jack-blocks', 'stone-lintel', 'arch-ring'] as const;
export type RowHeadDressing = (typeof ROW_HEAD_DRESSINGS)[number];
export const ROW_HEAD_SHAPES = ['flat', 'segmental', 'round', 'relieving'] as const;
export type RowHeadShape = (typeof ROW_HEAD_SHAPES)[number];
/** The upper window cell: tall sash/T-windows (the period default) or casements with a top light. */
export const ROW_WINDOW_KINDS = ['tall-upper', 'sash', 't-window', 'casement-toplight', 'casement'] as const;
export type RowWindowKind = (typeof ROW_WINDOW_KINDS)[number];
/** The wall material; the colour is a judged family (judgedColour.ts JUDGED_FAMILIES), never a sampled hex. */
export const ROW_WALL_MATERIALS = ['brick', 'painted-brick', 'stucco', 'stone'] as const;
export type RowWallMaterial = (typeof ROW_WALL_MATERIALS)[number];
/** Per-house fields: a front may differ from its series on these without a second reading (programme brief "Row solve"). */
export const ROW_PER_HOUSE_FIELDS = ['ground', 'doorSide', 'shopPaint', 'basement'] as const;
export type RowPerHouseField = (typeof ROW_PER_HOUSE_FIELDS)[number];

// --- the solved design ----------------------------------------------------------------------------------------------

export interface RowHeads {
  shape: RowHeadShape;
  dressing: RowHeadDressing;
  /** Upper storeys (1 = first above the ground) the dressing applies to; absent = every upper storey. */
  storeys?: number[];
}
export interface RowRoofStorey {
  kind: RowRoofStoreyKind;
  /** The roof storey's face material (mansard): slate unless read otherwise. */
  material?: 'slate' | 'tile' | 'zinc';
  /** Dormers per house front (a two-front pand gets this many per front). 0 = none. */
  dormersPerFront: number;
  dormerKind?: RowDormerKind;
  /** A hoist beam in the dormer (Weteringschans 169016). */
  hoist?: boolean;
}
export interface RowWall {
  material: RowWallMaterial;
  family: JudgedFamily;
  /** The family's tone (judgedColour.ts `variedTone(family, \`${rowId}:${family}\`)`): one tone per series, shared by the
   *  row's series of the same family. */
  hex: string;
}
/** A front's ground storey (per-house). */
/** The shopfront (pui) colour as a family, from the D1 ground/pui reading's own words; R draws it. */
export const ROW_GROUND_COLOURS = ['dark', 'light', 'green', 'red', 'white', 'timber'] as const;
export type RowGroundColour = typeof ROW_GROUND_COLOURS[number];

export interface RowGround {
  use: 'shop' | 'cafe' | 'restaurant' | 'dwelling' | 'door-only' | 'warehouse' | 'other';
  /** The residential street door, seen from the street. */
  doorSide?: 'left' | 'right' | 'centre' | 'several' | 'none';
  /** The street door as an index into the ground storey's openings, left to right as seen (D1 `doorIndex`), and their count. */
  doorIndex?: number;
  groundBays?: number;
  /** The shopfront paint as the face intent states it (a named colour or hex); never a sampled wall colour. */
  shopPaint?: string;
  /** Souterrain / stoop as read (Weteringschans). */
  /** `windows`: basement windows under a raised ground storey (no stoop read), Weteringschans 168096. */
  basement?: 'none' | 'souterrain' | 'stoop' | 'stoop-and-windows' | 'windows';
  /**
   * The shopfront colour family, source `single-read`: only when a D1 reading names a colour on the shopfront, pui or
   * shutter itself (a canopy or sign colour does not count; `painted timber` names no colour). Omitted when nothing is
   * read. Outranks `shopPaint` (the face intent's paint, which the Kinkerstraat review found wrong on 92–94, 100, 106–108).
   */
  colour?: RowField<RowGroundColour>;
}

/** The design of a series (and, as `Partial`, a front's overrides). Every field is solved with a source. */
export interface RowDesign {
  /** The cornice top above the street ground (m): the row line the wall rises to. Null = no measured or consensus line
   *  (the renderer then takes the period default lid at the series' storey height; reported). */
  corniceTopM: RowField<number | null>;
  crown: RowField<RowCrownKind>;
  cornice: RowField<RowCorniceKind>;
  /** Full street storeys below the cornice, the ground storey included once (describer convention), no souterrain,
   *  no roof storey. */
  storeys: RowField<number>;
  /** Window axes per house front on the upper storeys. */
  bays: RowField<number>;
  windows: RowField<RowWindowKind>;
  /** One head kind, or one per storey group (each entry with its `storeys`), e.g. Weteringschans 171218: stone lintels on
   *  storey 1, round heads under arch rings on storey 2. */
  heads: RowField<RowHeads | RowHeads[]>;
  /** White window joinery. */
  whiteFrames: RowField<boolean>;
  /** A plain stone sill under each window. */
  sills: RowField<boolean>;
  wall: RowField<RowWall>;
  roofStorey: RowField<RowRoofStorey>;
  /** Wall extras this series may draw: rowFront.ts ROW_FRONT_EXTRAS plus what the type or reading states. */
  extras: RowField<string[]>;
  /** Where the `row-balcony` extra stands: the storeys (0 = the ground storey, which is the bel-etage over a souterrain; 1 = the
   *  first storey above it) and the axis. Absent = the renderer's default (first upper storey, centre). */
  balcony?: RowField<{ storeys: number[]; axis: 'centre' | 'all' }>;
}
export type RowDesignKey = keyof RowDesign;

// --- members, fronts, series ------------------------------------------------------------------------------------------

/** One house front. A one-front pand has one with `id` = pandId; a two-front pand has `<pandId>#m0`, `<pandId>#m1`. */
export interface RowFront {
  id: string;
  pandId: string;
  /** "Kinkerstraat 106" (a sub-front gets its own number when the survey lists two). */
  label: string;
  numbers: number[];
  /** Sub-front of a multi-front pand: index, count and its span as fractions of the pand front, left to right as seen. */
  sub?: { index: number; of: number; a0: number; a1: number };
  widthM: number | null;
  seriesId: string;
  ground: RowGround;
  /** Fields this front draws differently from its series, each with its source (face intent, two readings). */
  overrides: Partial<RowDesign>;
  /** Pand ground minus the row's street ground (m, 3DBAG), when known; 0 is assumed and reported when not. */
  groundOffsetM?: number | null;
  /** The front's top in the pand's own datum (= series corniceTopM - groundOffsetM). */
  topM: number | null;
  /** Not staged (scaffold or netting over the upper storeys): the reason. The front still belongs to its series and
   *  draws the series design; nothing from its own reading is used. */
  readHeld?: string;
}

/** One pand of the row, street order. */
export interface RowMember {
  pandId: string;
  label: string;
  numbers: number[];
  built: number | null;
  /** BAG front width along the street (m). */
  widthM: number | null;
  /** Front ids, left to right as seen from the street. */
  fronts: string[];
}

export interface RowSeries {
  id: string;
  /** "kinker-1890-plain-brick" (face type) or a description of the run. */
  label: string;
  /** Face type id when the series came from a face intent. */
  type?: string;
  /** Front ids, street order. */
  fronts: string[];
  design: RowDesign;
}

/** A row-level flag: something the solve would not settle silently. */
export interface RowFlag {
  kind: 'class-disagreement' | 'scaffold' | 'weak-consensus' | 'no-reading' | 'extent-mismatch' | 'off-street-read' | 'reviewed';
  field?: RowDesignKey | string;
  fronts: string[];
  detail: string;
}
/** A read field not drawn (programme rule 3). */
export interface ReadNotDrawn {
  front: string;
  /** The reading's field name (describer key or face field). */
  field: string;
  value: unknown;
  reason: string;
}
/** A front's own reading overruled by its series (or by a stronger source). */
export interface Overruled {
  front: string;
  field: RowDesignKey | string;
  read: unknown;
  drawn: unknown;
  by: RowFieldSource;
  why: string;
}

export interface RowRecord {
  v: typeof ROW_RECORD_VERSION;
  /** "kinker-86-110" (face id) or "<street>-<first>-<last>". */
  id: string;
  street: string;
  side: 'even' | 'odd' | 'mixed';
  /** The face intent the row is anchored on, if any. */
  face?: string;
  /** Pands in street order (left to right as seen from the street). */
  members: RowMember[];
  fronts: RowFront[];
  series: RowSeries[];
  flags: RowFlag[];
  readNotDrawn: ReadNotDrawn[];
  overruled: Overruled[];
  /** Inputs used: file paths. */
  inputs: string[];
  solvedAt: string;
}

/** The design a front draws: its series design with its overrides on top. */
export function frontDesign(row: Pick<RowRecord, 'series'>, front: Pick<RowFront, 'seriesId' | 'overrides'>): RowDesign {
  const s = row.series.find(x => x.id === front.seriesId);
  if (!s) throw new Error(`row: no series ${front.seriesId}`);
  return { ...s.design, ...front.overrides } as RowDesign;
}
