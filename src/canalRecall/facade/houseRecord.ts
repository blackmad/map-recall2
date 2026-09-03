/**
 * The per-building parameter record: an Amsterdam canal house in about thirty
 * numbers, each one carrying its own provenance.
 *
 * The central rule of `AMSTERDAM_FACADE_TWIN.md`, and the one this file is
 * shaped around:
 *
 * > Derive the vocabulary, then measure each building into it. The parts
 * > library tells you how to draw a *klokgevel* once you know this house has
 * > one. It must never tell you that this house has one.
 *
 * So the vocabulary below — seven gable types, a window vocabulary, a cornice
 * vocabulary — is a set of *labels a measurement can resolve to*, and nothing
 * in this module can produce one. There is no `gableForBouwjaar`, no
 * `typicalRecordFor`, no template to instantiate. Every field arrives as a
 * {@link Measured}, which means it arrived from an observation of this
 * `pand_id` or it arrived as an honest {@link defaulted}.
 *
 * That absence is the design. A helper that guessed a gable from a
 * construction year would be the single most useful-looking function in the
 * pipeline and would quietly convert the whole canal ring into fiction.
 *
 * Storage is not the constraint here and never was: thirty numbers per
 * building is single-digit megabytes for the entire municipality, far smaller
 * than the meshes they generate. Observation is the constraint. Nothing in
 * this schema should ever be compressed away at the cost of measuring less.
 */

import { auditFields, defaulted, type EvidenceViolation, type FacadeSource, type Measured, type Observation, type SourceCompetence } from './evidence.ts';

/**
 * The gable vocabulary of the 17th–18th century canal ring.
 *
 * These are labels for what a façade *was measured to have*. Their rough dates
 * are documented on each variant because they help a reviewer notice a
 * surprise — a `trap` on a house dated 1780 deserves a second look — and for
 * no other purpose. A date may raise a question about a building. It may not
 * answer one.
 */
export type GableType =
  /** Trapgevel — stepped. Predominantly pre-1660. */
  | 'trap'
  /** Halsgevel — neck, usually with klauwstukken. Roughly 1640–1780. */
  | 'hals'
  /** Verhoogde halsgevel — a raised neck, taller and later. */
  | 'verhoogde-hals'
  /** Klokgevel — bell. Roughly 1660–1790. */
  | 'klok'
  /** Tuitgevel — spout. Long-lived, plainer, common on warehouses. */
  | 'tuit'
  /** Puntgevel — plain triangular point. The oldest and simplest. */
  | 'punt'
  /** Lijstgevel — a horizontal cornice hiding the roof. Predominantly post-1730. */
  | 'lijst';

export const GABLE_TYPES: readonly GableType[] =
  ['trap', 'hals', 'verhoogde-hals', 'klok', 'tuit', 'punt', 'lijst'];

/** Window vocabulary. `later` covers a documented post-19th-century replacement. */
export type WindowType = 'kruiskozijn' | 'schuifraam-6' | 'schuifraam-8' | 'schuifraam-plain' | 'later';

export const WINDOW_TYPES: readonly WindowType[] =
  ['kruiskozijn', 'schuifraam-6', 'schuifraam-8', 'schuifraam-plain', 'later'];

/** Sandstone ornament on and around the gable, as observed. */
export interface OrnamentSpec {
  /** Klauwstukken — the scrolled claw-pieces flanking a neck gable. */
  clawPieces: boolean;
  /** Vases, urns or finials on the gable top or shoulders. */
  vases: number;
  /** A pediment over the gable opening: triangular, segmental, or none. */
  pediment: 'triangular' | 'segmental' | 'none';
  /** Carved festoons or swags. */
  festoons: boolean;
  /** A gevelsteen — carved and often painted gable stone. */
  gableStone: boolean;
}

/** Kroonlijst and its variants, or none where the gable is not a lijstgevel. */
export interface CorniceSpec {
  kind: 'kroonlijst' | 'simple' | 'none';
  /** Projection from the wall plane, metres. */
  depthM: number;
  /** Console brackets across the width; 0 where there are none. */
  brackets: number;
}

/** Dutch brick as built: bond, colour and pointing, all measured. */
export interface BrickSpec {
  /** Kruisverband dominates the canal ring; the others appear and are recorded. */
  bond: 'kruisverband' | 'staand' | 'kettingverband' | 'wild' | 'unknown';
  /** sRGB hex sampled away from shadow and highlight, as the roof pipeline does. */
  colourHex: string;
  /** Painted brick is common and changes the reading entirely. */
  painted: boolean;
  /** Joint treatment, which drives the normal detail more than the colour does. */
  pointing: 'flush' | 'recessed' | 'weathered' | 'unknown';
}

/**
 * The ground-floor shopfront frame, as architecture.
 *
 * Deliberately tenant-neutral, per the scope contract: the frame and its
 * glazing are building fabric and are reconstructed; which shop is behind it
 * today is a lease, not a building, and is out of scope. `fascia` is the blank
 * board above the glazing — modelled as geometry, never lettered.
 */
export interface PuiSpec {
  kind: 'winkelpui' | 'residential' | 'warehouse' | 'none';
  heightM: number;
  /** Glazed bays across the shopfront. */
  bays: number;
  frame: 'painted-timber' | 'stone' | 'iron' | 'unknown';
  /** A stoep or bordes raising the entrance above the quay. */
  hasBordes: boolean;
  /** A souterrain light well and basement entrance below it. */
  hasSouterrainEntrance: boolean;
}

/**
 * Every façade parameter of one building, each with its receipt.
 *
 * Wrapping *every* field in {@link Measured} is the point. It is more verbose
 * than a plain record and it is the only version in which the assembly engine
 * cannot read a value without also being handed the question "and where did
 * this come from?".
 */
export interface CanalHouse {
  /** BAG identity, canonical. A building without one is a bug, not a building. */
  pandId: string;

  /** Measured from the BAG footprint edge; the one dimension known exactly. */
  plotWidthM: Measured<number>;
  depthM: Measured<number>;
  /** AHN-derived, above NAP. */
  eavesHeightM: Measured<number>;
  ridgeHeightM: Measured<number>;
  storeys: Measured<number>;
  hasSouterrain: Measured<boolean>;
  hasBelEtage: Measured<boolean>;

  gable: Measured<GableType>;
  gableOrnament: Measured<OrnamentSpec>;

  /** Window bays across the façade. */
  bays: Measured<number>;
  /** Bay centres across the façade, measured, not evenly divided. */
  bayOffsetsM: Measured<number[]>;
  windowType: Measured<WindowType>;
  /** Floor-to-floor heights, ground upward. Diminishing, measured not assumed. */
  storeyHeights: Measured<number[]>;
  /** Door centre offset across the façade, from the left party wall. */
  doorPositionM: Measured<number>;

  hoistBeam: Measured<boolean>;
  hoistBeamOffsetM: Measured<number | null>;
  corniceType: Measured<CorniceSpec>;
  brick: Measured<BrickSpec>;
  dressings: Measured<'sandstone' | 'painted' | 'none'>;

  /** Op de vlucht — the deliberate forward lean, degrees from vertical. */
  leanDeg: Measured<number>;
  /** Settlement sag along the ridge, metres. Measured per façade, never jittered. */
  ridgeSagM: Measured<number>;

  puiType: Measured<PuiSpec>;
}

/** The measured fields of {@link CanalHouse}, i.e. everything but `pandId`. */
export type CanalHouseFields = Omit<CanalHouse, 'pandId'>;

export const CANAL_HOUSE_FIELDS: readonly (keyof CanalHouseFields)[] = [
  'plotWidthM', 'depthM', 'eavesHeightM', 'ridgeHeightM', 'storeys',
  'hasSouterrain', 'hasBelEtage', 'gable', 'gableOrnament', 'bays',
  'bayOffsetsM', 'windowType', 'storeyHeights', 'doorPositionM', 'hoistBeam',
  'hoistBeamOffsetM', 'corniceType', 'brick', 'dressings', 'leanDeg',
  'ridgeSagM', 'puiType',
];

/**
 * A record with every field honestly unobserved.
 *
 * This is the *only* record constructor in the module, and it produces a
 * building with no façade: no gable, no bays, no openings. That is the correct
 * resting state for a building nobody has looked at, and the pipeline's job is
 * to replace these one measurement at a time rather than to start from a
 * plausible house and adjust it.
 *
 * The values carried here are structural placeholders that the renderer never
 * draws — `resolveFidelityTier` will not promote a record in this state above
 * LoD1 — not estimates of what a canal house is like.
 */
export function unobservedHouse(pandId: string): CanalHouse {
  return {
    pandId,
    plotWidthM: defaulted(0),
    depthM: defaulted(0),
    eavesHeightM: defaulted(0),
    ridgeHeightM: defaulted(0),
    storeys: defaulted(0),
    hasSouterrain: defaulted(false),
    hasBelEtage: defaulted(false),
    gable: defaulted<GableType>('punt'),
    gableOrnament: defaulted<OrnamentSpec>({ clawPieces: false, vases: 0, pediment: 'none', festoons: false, gableStone: false }),
    bays: defaulted(0),
    bayOffsetsM: defaulted<number[]>([]),
    windowType: defaulted<WindowType>('later'),
    storeyHeights: defaulted<number[]>([]),
    doorPositionM: defaulted(0),
    hoistBeam: defaulted(false),
    hoistBeamOffsetM: defaulted<number | null>(null),
    corniceType: defaulted<CorniceSpec>({ kind: 'none', depthM: 0, brackets: 0 }),
    brick: defaulted<BrickSpec>({ bond: 'unknown', colourHex: '#000000', painted: false, pointing: 'unknown' }),
    dressings: defaulted<'sandstone' | 'painted' | 'none'>('none'),
    leanDeg: defaulted(0),
    ridgeSagM: defaulted(0),
    puiType: defaulted<PuiSpec>({ kind: 'none', heightM: 0, bays: 0, frame: 'unknown', hasBordes: false, hasSouterrainEntrance: false }),
  };
}

/** The measured fields of a record, in the shape {@link auditFields} takes. */
export const fieldsOf = (house: CanalHouse): Record<string, Measured<unknown>> =>
  Object.fromEntries(CANAL_HOUSE_FIELDS.map(field => [field, house[field] as Measured<unknown>]));

/** A human review settles any field, and a default is the absence of a source. */
const ALWAYS: readonly FacadeSource[] = ['reviewed', 'default'];

/**
 * What each source is physically capable of observing, per field.
 *
 * Read this as a statement about instruments, not about accuracy. Three of the
 * entries were measured across the pilot boundary rather than assumed:
 *
 * - `3dbag` and `ahn` reconstruct massing and roof *planes* from a point cloud.
 *   They are authoritative for eaves and ridge height and carry no gable type
 *   at all: LoD2.2 reconstruction error tracks roof complexity, not failure,
 *   so a `klokgevel` attributed to 3DBAG was never in the data.
 * - `pdok-ortho` is nadir imagery. It measures roofs, and no nadir image has
 *   ever seen a wall — which is why it appears against no field of a *façade*
 *   record. Roof colour is measured by the existing appearance pipeline.
 * - `monument-text` is a written description. It routinely names the gable,
 *   the cornice, the dressings and the pui, and it never states a distance in
 *   metres, so it cannot supply bay offsets, a door position or a lean.
 *
 * `bag` is the authority on the footprint and nothing above it. `osm` carries
 * hand-mapped semantics — storey counts and structure — but not the Dutch
 * gable vocabulary, which it has no tag for.
 */
export const FIELD_SOURCES: SourceCompetence = {
  // Footprint. Measured from BAG geometry; a rectified elevation can confirm
  // the façade width, but nothing on the street can see how deep the plot runs.
  plotWidthM: ['bag', '3dbag', 'streetlevel-measured', ...ALWAYS],
  depthM: ['bag', '3dbag', ...ALWAYS],

  // Heights. AHN and the 3DBAG planes built from it; a rectified elevation
  // scaled from the known plot width measures them too.
  eavesHeightM: ['ahn', '3dbag', 'streetlevel-measured', ...ALWAYS],
  ridgeHeightM: ['ahn', '3dbag', 'streetlevel-measured', ...ALWAYS],
  ridgeSagM: ['ahn', 'streetlevel-measured', ...ALWAYS],

  storeys: ['3dbag', 'osm', 'monument-text', 'streetlevel-measured', ...ALWAYS],
  // Diminishing storey heights are a metric read off a rectified elevation.
  // AHN gives the building's total height, never how it divides internally.
  storeyHeights: ['streetlevel-measured', ...ALWAYS],
  hasSouterrain: ['osm', 'monument-text', 'streetlevel-measured', ...ALWAYS],
  hasBelEtage: ['osm', 'monument-text', 'streetlevel-measured', ...ALWAYS],

  // The façade proper. Only something that looked at the front of the building
  // — an image, or a description written by someone standing in front of it.
  gable: ['monument-text', 'streetlevel-measured', ...ALWAYS],
  gableOrnament: ['monument-text', 'streetlevel-measured', ...ALWAYS],
  corniceType: ['monument-text', 'streetlevel-measured', ...ALWAYS],
  dressings: ['monument-text', 'streetlevel-measured', ...ALWAYS],
  windowType: ['monument-text', 'streetlevel-measured', ...ALWAYS],
  puiType: ['monument-text', 'streetlevel-measured', ...ALWAYS],
  hoistBeam: ['monument-text', 'streetlevel-measured', ...ALWAYS],
  bays: ['monument-text', 'streetlevel-measured', ...ALWAYS],

  // Metric positions across the façade. A description never states these in
  // metres, so they come from a rectified image or from nothing.
  bayOffsetsM: ['streetlevel-measured', ...ALWAYS],
  doorPositionM: ['streetlevel-measured', ...ALWAYS],
  hoistBeamOffsetM: ['streetlevel-measured', ...ALWAYS],
  leanDeg: ['streetlevel-measured', ...ALWAYS],

  // Bond and pointing are visible in a description; a sampled sRGB value is not.
  brick: ['streetlevel-measured', ...ALWAYS],
};

/**
 * Audit one house: provenance, party walls, and whether each source could have
 * seen the field it supplied. The form QA-EVIDENCE runs.
 */
export const auditHouse = (
  house: CanalHouse,
  observations: ReadonlyMap<string, Observation>,
  today?: string,
): EvidenceViolation[] => auditFields(house.pandId, fieldsOf(house), observations, today, FIELD_SOURCES);

/**
 * Structural problems with a record's *values*, independent of provenance.
 *
 * Kept separate from the evidence audit on purpose: this catches a measurement
 * that is internally impossible — bay offsets outside the plot, storey heights
 * that overrun the ridge — which is usually a rectification failure rather than
 * a dishonest one. A field that is merely `defaulted` is not a problem here;
 * that is coverage, and {@link summariseCoverage} reports it.
 */
export interface RecordProblem {
  pandId: string;
  field: keyof CanalHouseFields;
  detail: string;
}

/**
 * Below this, a ridge height is a measurement error rather than a building.
 *
 * Also set from the boundary's own data rather than from the canal-house
 * stereotype. The pilot contains 26 structures whose ridge sits under 3 m —
 * outbuildings, sheds and rear annexes on footprints of 3–17 m², most with no
 * recorded use — and they are real panden that render as massing. An earlier
 * 3 m floor flagged every one of them. What is genuinely impossible is a ridge
 * at or below the building's own ground level, which two buildings report; the
 * constructor now leaves those unobserved, and this floor catches any that
 * reach the record by another route.
 */
const MIN_PLAUSIBLE_RIDGE_M = 1.5;
/**
 * A façade wider than this is a measurement error rather than a building.
 *
 * Set from the pilot boundary's own distribution, not from the canal-house
 * stereotype: median façade width is 5.7 m and the 99th percentile is 30.6 m,
 * but 13 buildings exceed 40 m and the widest is 74 m — 20th-century office
 * and institutional blocks that are genuinely that wide. An earlier 40 m cap
 * flagged all of them, which is the validator rejecting architecture rather
 * than catching errors. The invariant that actually bites is `plotWidthM <=
 * depthM` below, which holds by construction for the short side of a
 * minimum-area rectangle.
 */
const MAX_PLAUSIBLE_PLOT_WIDTH_M = 150;
/** Op de vlucht is deliberate but small; beyond this it is a measurement error. */
const MAX_PLAUSIBLE_LEAN_DEG = 8;

export function validateHouse(house: CanalHouse): RecordProblem[] {
  const problems: RecordProblem[] = [];
  const report = (field: keyof CanalHouseFields, detail: string) => problems.push({ pandId: house.pandId, field, detail });

  // Only observed values are validated. A default is a known gap, not a bad
  // measurement, and flagging it here would drown the real failures.
  const observed = <T>(field: keyof CanalHouseFields): T | null => {
    const entry = house[field] as Measured<T>;
    return entry.source === 'default' ? null : entry.value;
  };

  const width = observed<number>('plotWidthM');
  if (width !== null && (!(width > 0) || width > MAX_PLAUSIBLE_PLOT_WIDTH_M)) {
    report('plotWidthM', `${width} m is not a plausible plot width`);
  }

  // Holds by construction: `plotWidthM` is the short side of the footprint's
  // minimum-area rectangle and `depthM` the long one. A violation means the two
  // came from different footprints, or that the sides were swapped somewhere
  // upstream — and a swapped pair silently rescales the entire façade grammar,
  // because plot width is the dimension every other measurement derives from.
  const depth = observed<number>('depthM');
  if (width !== null && depth !== null && width > depth) {
    report('plotWidthM', `façade width ${width} m exceeds plot depth ${depth} m; the footprint sides look swapped`);
  }

  const eaves = observed<number>('eavesHeightM');
  const ridge = observed<number>('ridgeHeightM');
  if (ridge !== null && ridge < MIN_PLAUSIBLE_RIDGE_M) report('ridgeHeightM', `${ridge} m is below the minimum plausible ridge`);
  if (eaves !== null && ridge !== null && ridge < eaves) report('ridgeHeightM', `ridge ${ridge} m is below eaves ${eaves} m`);

  const bays = observed<number>('bays');
  const offsets = observed<number[]>('bayOffsetsM');
  if (bays !== null && offsets !== null && offsets.length !== bays) {
    report('bayOffsetsM', `${offsets.length} offsets for ${bays} bays`);
  }
  if (offsets !== null && width !== null) {
    // Bay centres are measured from the left party wall, so every one of them
    // has to land inside this building's own plot. One that does not is the
    // signature of a rectification that drifted onto the neighbour.
    const strays = offsets.filter(offset => offset < 0 || offset > width);
    if (strays.length) report('bayOffsetsM', `${strays.length} bay centre(s) outside the ${width} m plot`);
    const unsorted = offsets.some((offset, index) => index > 0 && offset < offsets[index - 1]);
    if (unsorted) report('bayOffsetsM', 'bay centres are not ordered across the façade');
  }

  const door = observed<number>('doorPositionM');
  if (door !== null && width !== null && (door < 0 || door > width)) {
    report('doorPositionM', `door at ${door} m is outside the ${width} m plot`);
  }

  const heights = observed<number[]>('storeyHeights');
  const storeys = observed<number>('storeys');
  if (heights !== null && storeys !== null && heights.length !== storeys) {
    report('storeyHeights', `${heights.length} storey heights for ${storeys} storeys`);
  }
  if (heights !== null && eaves !== null && heights.length > 0) {
    const stacked = heights.reduce((sum, height) => sum + height, 0);
    // Generous: the ground floor sits above the quay and a souterrain adds more.
    if (stacked > eaves + 6) report('storeyHeights', `storey heights total ${stacked.toFixed(1)} m against ${eaves} m eaves`);
  }

  const lean = observed<number>('leanDeg');
  if (lean !== null && Math.abs(lean) > MAX_PLAUSIBLE_LEAN_DEG) {
    report('leanDeg', `${lean}° exceeds the plausible op-de-vlucht lean`);
  }

  const hoist = observed<boolean>('hoistBeam');
  const hoistOffset = observed<number | null>('hoistBeamOffsetM');
  if (hoist === true && hoistOffset === null && house.hoistBeamOffsetM.source !== 'default') {
    report('hoistBeamOffsetM', 'a hoist beam was observed but its offset was measured as absent');
  }

  const brick = observed<BrickSpec>('brick');
  if (brick !== null && !/^#[0-9a-fA-F]{6}$/.test(brick.colourHex)) {
    report('brick', `colour ${brick.colourHex} is not an sRGB hex`);
  }

  return problems;
}
