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
export const ROW_HEAD_DRESSINGS = ['none', 'block-course', 'keystone', 'segmental-tympanum', 'dentil-lintel', 'jack-blocks', 'stone-lintel', 'arch-ring', 'block-surround', 'tablet',
  // Lane R round 23 (De Pijp heads list), appended: alternating white voussoirs, white corner blocks, a moulded white surround
  // with a cornice hood, a patterned brick band at the heads, an ornamental brick arch ring (headGrammar.ts, facadeOrnaments brickBand).
  'voussoirs', 'corner-blocks', 'moulded-hood', 'brick-band', 'brick-arch-ring'] as const;
/** `tablet`: a light stone tablet in the brick over each window (Herengracht 175404); with the `relieving` shape, over a
 *  brick relieving arch. */
/** `block-surround`: white blocks framing the whole window, alternating quoins up both jambs with a keyed head (Kinkerstraat 100, reviewed). */
export type RowHeadDressing = (typeof ROW_HEAD_DRESSINGS)[number];
export const ROW_HEAD_SHAPES = ['flat', 'segmental', 'round', 'relieving'] as const;
export type RowHeadShape = (typeof ROW_HEAD_SHAPES)[number];
/** A stated erker: `storeys` in reader rows (ground = 0), `kind` its plan, `roofBalcony` a railing on its roof. */
/** `width: 'full'`: across the whole front; `side`: over that side's axis as seen (absent: the centre bay). */
export interface RowBayWindow { storeys: number[]; kind: 'box' | 'canted'; roofBalcony?: true; width?: 'full'; side?: 'left' | 'right' }
/** The upper window cell: tall sash/T-windows (the period default) or casements with a top light. */
/** `cross`: a cross window (kruiskozijn), a mullion and a transom a third down (Herengracht 27). */
export const ROW_WINDOW_KINDS = ['tall-upper', 'sash', 't-window', 'casement-toplight', 'casement', 'sash-8-over-8', 'sash-small-panes', 'cross'] as const;
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
  /** The mansard's rise over the cornice line as read (m; absent: the renderer's period default). */
  riseM?: number;
  /** The dormers stand in a pitched (hipped) roof behind the cornice, not on a mansard face (rowFront `pitched`; lane D
   *  round 8: a register dakkapel showed from the street as a dormer in a tiled roof in 13 of 19 belt cuts, never as a
   *  mansard). Absent: a mansard, as before. */
  pitched?: boolean;
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
  /** The stoop's flight as seen (house rows stoops, Herengracht 130, 148): `straight` out to the pavement, `side` one flight
   *  along the wall, `double` two flights along the wall from a landing at the door. Stated on a `windows` basement it draws
   *  the flight the raised door needs (148). Absent: the straight flight between stone cheeks, or none on `windows`. */
  stoopForm?: 'straight' | 'side' | 'double';
  /** The stoop has a black iron railing (Herengracht 130). Absent: stone cheek walls only. */
  stoopRailing?: boolean;
  /** The stoop door's doorcase as seen (Herengracht 130): stone or painted timber pilasters, an entablature (absent `top`)
   *  or a pediment over it, a fanlight over the leaf (absent: true). Absent: the plain white frame. */
  doorcase?: RowDoorcase;
  /**
   * The shopfront colour family, source `single-read`: only when a D1 reading names a colour on the shopfront, pui or
   * shutter itself (a canopy or sign colour does not count; `painted timber` names no colour). Omitted when nothing is
   * read. Outranks `shopPaint` (the face intent's paint, which the Kinkerstraat review found wrong on 92–94, 100, 106–108).
   */
  colour?: RowField<RowGroundColour>;
  /**
   * Separate shop units across the ground. 1 when the reading describes one shopfront (`a ... shopfront` with its
   * door and window, Weteringschans 168042): drawn as one unit, not split by width. Absent: the renderer's own split.
   */
  shopUnits?: RowField<number>;
  /** Ground openings with an arched head, by index of `groundBays` as seen (Herengracht 27's arched ground window): the
   *  glass follows the arch. Over a souterrain the ground openings are the bel-etage's. Absent: none. */
  archedOpenings?: { index: number[]; shape?: 'segmental' | 'round' };
  /** The basement storey's front as read (Herengracht 25-29, 0363100012175402): a stone plinth facing (a named colour or
   *  hex, absent grey) with arched doorways at these indices of `groundBays` as seen, round or segmental (absent round).
   *  Drawn on a souterrain or basement-windows front. Absent: the basement as today. */
  basementFront?: { plinth?: string; doors?: number[]; head?: 'round' | 'segmental' };
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
  /** A white timber erker (bay window) on consoles over the centre bay (lane R round 24, lane D's `bay-window` kit gap):
   *  the storeys it covers as the reader counts rows (0 = the ground storey, 1 = the first above it), its plan (a box,
   *  or canted sides) and a balcony railing on its roof when the reading says so. Absent: no erker. */
  bayWindow?: RowField<RowBayWindow>;
  /** A gabled crown's outline as read on the photo (`crown` step, neck, bell or point): its rise over the cornice line
   *  (m), the step count of a step gable, the attic lights in it and the neck (or top tread) width. Absent: the crown
   *  kind alone, which draws no gable over the row line. */
  gable?: RowField<RowGable>;
  /** Upper windows' glass height per storey as read (m), lowest first: every storey that draws upper windows (over a
   *  souterrain the bel-etage is the first). The storeys share the wall by these heights (tall lower storeys). Absent: one
   *  window height on an even storey grid. */
  windowHeights?: RowField<number[]>;
  /** The window joinery as drawn (house rows round 5): white frames and glazing bars of the series' window kind over every
   *  upper window. Absent: the preset's painted window (today). */
  glazing?: RowField<RowGlazing>;
  /** The ground storey's own facing (stucco, stone) under the wall above: a front override for one house, or the series'.
   *  Absent: the ground storey is the wall (today). */
  groundWall?: RowField<RowGroundWall>;
  /** A flat-top front's timber cornice as read (Herengracht 158, 164, 174, 209, 248): its paint, what carries the corona,
   *  its frieze, and a stated centre over it. Absent: the `cornice` kind as drawn today. */
  corniceDress?: RowField<RowCorniceDress>;
  /** A raised centre piece standing on a cornice front (Herengracht 159: a white attic with a segmental cap over the
   *  balustrade): its rise over the cornice line (m), its top's kind as the crown piece draws it, and its width. Drawn
   *  through rowFront's crown.piece. Absent: none. */
  crownPiece?: RowField<{ riseM: number; kind: string; widthM?: number }>;
}
/** An 1800s timber cornice (RowDesign.corniceDress). Every part is drawn only as stated. */
export interface RowCorniceDress {
  /** The cornice's paint: a hex, or `white`, `cream`, `grey`; absent white. */
  paint?: string;
  /** Under the corona: `modillions` (small blocks at a close pitch), `consoles` (tall brackets over the piers), `dentils`,
   *  or `none`. Absent: none. */
  supports?: 'modillions' | 'consoles' | 'dentils' | 'none';
  /** The frieze under it: `plain` a painted board, `attic-lights` a low light over each window axis in a painted board,
   *  `panels` sunk panels in a painted board. Absent: the wall's brick. */
  frieze?: 'plain' | 'attic-lights' | 'panels';
  /** On the cornice: a `pediment` or a `segmental` cap over the centre, or a `balustrade`. Absent: none. */
  centre?: 'pediment' | 'segmental' | 'balustrade';
  /** The centre's width as a share of the front (absent: 0.5 for a cap, the whole front for a balustrade). */
  centreShare?: number;
  /** The whole cornice's size against the 1800s timber one (corona, bed, frieze, supports, projections), for the deep
   *  stucco and stone cornices of the belt (Herengracht 32, 40, 48: about 1.5 m against 0.9 m). Absent: 1. */
  scale?: number;
}
/** A canal window's joinery (RowDesign.glazing): the white frame's width round the glass, the glazing bars' width, and the
 *  panes per sash for the sash kinds (sash-8-over-8: 8; sash-small-panes: 12; absent: the kind's own). */
/** A ground storey faced apart from the wall above (Herengracht 12: white stucco with a scrolled top under brown brick). */
export interface RowGroundWall {
  material: 'stucco' | 'stone' | 'render' | 'brick';
  /** The facing's colour: a hex, or a named colour (white, cream, grey, sandstone). Absent: the material's own. */
  colour?: string;
  /** Its top: a plain edge, a moulded ledge, or a ledge with scrolled ends. Absent: a ledge. */
  top?: 'plain' | 'ledge' | 'scrolled';
}

export interface RowGlazing {
  frameM?: number;
  barM?: number;
  panes?: number;
}
/** A gabled crown's outline (RowDesign.gable): symmetric, standing on the series line. */
export interface RowGable {
  riseM: number; steps?: number; attic?: number; neckWidthM?: number;
  /** Neck or bell: the neck's cap as read (a curved pediment is `segmental`; absent: the kit's stock). */
  cap?: 'pediment' | 'segmental' | 'rounded' | 'flat';
  /** White stone finials on the steps' corners (step) or the shoulders' feet (neck, bell, spout). */
  finials?: boolean;
  /** Step gable: the lowest tread on each side is a sloped shoulder from the foot to the first riser's top (Kinkerstraat 67). */
  shoulder?: 'sloped';
  /** Neck or bell: the upright neck's height over the shoulders' top, cap included (m; absent: the kit's stock). */
  neckOverM?: number;
  /** The attic light's head (absent: square). */
  atticHead?: 'round' | 'segmental';
  /** A small round-headed light high in the neck over the attic light, as the photo shows one (Herengracht 39, 57, 71, 73;
   *  not 31, 37, 59, 61, 63): stated per house, never a default (blind gable review 3, 2026-11-15). */
  upperLight?: boolean;
  /** The gable's white sandstone as built (house rows gable round): copings with thickness along the outline and the
   *  treads, scrolled shoulder pieces (klauwstukken) beside a neck or bell, the cap or crest on top. Absent: today's flat
   *  white edge. */
  stone?: RowGableStone;
  /** `belt`: the canal belt's gable dress (houseLine/crownProfile.ts BELT_GABLE): a tall neck on low white claw pieces with a
   *  band at its foot and an overhanging cap moulding, a bell with a narrower moulded crest and a crest ornament, finer
   *  step treads with a crest finial, a short capped spout top. Absent: the kit's stock outlines (byte-identical). */
  dress?: 'belt';
}
export interface RowGableStone {
  /** Coping width along the outline (m; absent 0.2). */
  copingM?: number;
  /** Neck or bell: scrolled shoulder pieces (klauwstukken) filling beside the neck (absent: true); `carved`: a taller carved
   *  scroll standing above the shoulder line against the neck. */
  claws?: boolean | 'carved';
  /** The neck's cap as a solid hood over a cornice: `dark` (a painted dark green-grey) or a hex. Absent: a stone hood moulding. */
  hood?: 'dark' | string;
  /** Carving in the neck between its light and the cap: a framed panel, a cartouche, or an oeil-de-boeuf. Absent: none. */
  neck?: 'panel' | 'cartouche' | 'oculus';
  /** Carving in the cap's tympanum (no hood): a `shell` of fluting from the springing, or a `carved` field with a
   *  cartouche and leaves. Absent: the tympanum stays brick. */
  cap?: 'shell' | 'carved';
  /** The cap on top: a pediment, a segmental hood, or a carved crest (absent: the gable's `cap`, else the kit's stock). */
  crest?: 'pediment' | 'segmental' | 'crest';
  /** Neck: a carved festoon hung across the neck under the cap, its ends dropping down the neck's sides (Herengracht
   *  0363100012176326). Stated, it takes the neck's carving space (it replaces `neck`). Absent: none. */
  festoon?: boolean;
  /** Neck or bell: an oval cartouche in a carved frame on each shoulder, in the brick under the claws (0363100012176326).
   *  Absent: none. */
  shoulders?: 'oval';
}
export interface RowDoorcase {
  material: 'stone' | 'timber'; top?: 'entablature' | 'pediment' | 'segmental';
  /** The fanlight: absent or true plain bars, `diamond` a lozenge in its frame (Herengracht 144), `oval` an oval ring
   *  with a small lozenge inside, `oval-spoked` the ring with four short spokes to the frame, false none. */
  fanlight?: boolean | 'diamond' | 'oval' | 'oval-spoked';
  /** `ground`: one pilastered frame over the whole ground storey, the door and the windows beside it under one
   *  entablature (Herengracht 142's shop surround). `frame`: a white timber frame of tall openings over the whole ground
   *  storey, posts between the door and every window and an entresol rail across them with a light over each opening
   *  (0363100012176327); it replaces the door's own case. Absent: the door's own case. */
  span?: 'ground' | 'frame';
  /** `frame`: the entresol rail's height as a share of the frame (absent 0.58; 0.5 with two tiers). */
  entresol?: number;
  /** `frame`: two tall glazed tiers filling the storey up to under the next storey's sills (Herengracht 279), the rail at
   *  mid height. Absent: the frame stops over the openings with a low entresol. */
  tiers?: 2;
  /** The leaf's paint: `black` (near-black, the belt's usual door) or a hex. Absent: the kit's brown. */
  door?: 'black' | string;
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
  /** Its top was not read (no cut, an unreadable or held reading, or a reviewed unusable cut) in a row of measured cuts: it
   *  draws the neighbours' series line with no roof form, and the sheet prints it as unread. The reason. */
  topUnread?: string;
  /** The pand's read describes another of its fronts only (a multi-front capture, `MemberInput.readFront`): nothing of it is drawn here. */
  readElsewhere?: string;
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
  /** A pand an installed face chunk of another street owns whole (its roof, its other street): the row draws only its wall
   *  on this street, on `edge`, and the chunk's `rowFront` variant leaves that wall out (scripts/house-specs/rows/wall-only.json). */
  wallOnly?: RowWallOnly;
}

/** The row's wall of a chunk-owned pand: the chunk (chunks.json id) and the BAG edge on this street, [lng, lat], left to right as seen. */
export interface RowWallOnly {
  chunk: string;
  edge: [[number, number], [number, number]];
  /** The edge in RD New metres, as measured (the BAG footprint), left to right. */
  edgeRD?: [[number, number], [number, number]];
  ref?: string;
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
  kind: 'class-disagreement' | 'scaffold' | 'weak-consensus' | 'no-reading' | 'extent-mismatch' | 'off-street-read' | 'reviewed' | 'reread';
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

/** What the kit cannot say about a front (scripts/house-specs/rows/limits.json): a known difference from the photo. */
export interface RowLimit { front: string; component: string; what: string; ref: string }

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
  /** Known differences the kit cannot say, per front. */
  schemaLimits?: RowLimit[];
}

/** The design a front draws: its series design with its overrides on top. */
export function frontDesign(row: Pick<RowRecord, 'series'>, front: Pick<RowFront, 'seriesId' | 'overrides'>): RowDesign {
  const s = row.series.find(x => x.id === front.seriesId);
  if (!s) throw new Error(`row: no series ${front.seriesId}`);
  return { ...s.design, ...front.overrides } as RowDesign;
}
