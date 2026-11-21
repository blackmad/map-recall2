/**
 * Belt review (canal-belt "human in the loop" programme, plan R1): the shared file formats of one block face under review.
 *
 * Everything lives in COMMITTED files under `review-data/belt-review/<faceId>/` (never `.cache/`, which the sweep deletes):
 *
 *   face.json         the block face: street, side, pands left to right                      (integrator / lane B writes)
 *   candidates.json   up to 6 rectified photo candidates per pand, plus the automatic pick    (lane B writes)
 *   description.json  per pand: readable fields (fields.ts DESC_FIELDS), a source per field    (lane C writes)
 *   picks.json        David's photo per pand, or "none usable"                               (the page writes)
 *   edits.json        per pand field patches on the description, keyed by spec field path    (page + Claude write)
 *   grouping.json     design units and sameAs / basedOn links                                (page + Claude write)
 *   pins.json         stage-4 pins with their threads                                        (page + Claude write)
 *   state.json        stage pointer and status; status `with-claude` is "Send to Claude"     (page + Claude write)
 *   ledger.json       minutes, tokens, failures per stage                                    (page + Claude write)
 *
 * Concurrency: every writable doc has a top-level `revision` (bumped on every write, so a watcher can tell it changed) and
 * every entry of an entry doc (picks, edits, pins) has its own `revision`. A writer sends the revision it last saw and the
 * server refuses a stale one with 409, so David's tab and a Claude-side command never silently overwrite each other.
 * Claude-side commands that write these files directly must take the `<file>.lock` (see store.ts `lockedJson`) and bump
 * both revisions the same way.
 *
 * Compare rounds (`review-data/belt-review/rounds.json` + `rounds/<roundId>/verdicts.json`) share the page: per block,
 * layers flipped with Q/W/E/R and a better/same/worse verdict with a note.
 */

export const BELT_REVIEW_SCHEMA = 1 as const;

/** The four checks, in order; each is confirmed before the next opens. */
export const STAGES = [1, 2, 3, 4] as const;
export type Stage = typeof STAGES[number];
export const STAGE_TITLES: Record<Stage, string> = {
  1: 'Is this crop right?',
  2: 'Does each render look like its photo?',
  3: 'Does it join another building or match a neighbour?',
  4: 'Does the block hold up in the game? Resolve the last pins and accept.',
};

export const STAGE_SHORT: Record<Stage, string> = { 1: 'Crop', 2: 'Likeness', 3: 'Grouping', 4: 'In game' };

export const FACE_STATUSES =['with-david', 'with-claude', 'accepted'] as const;
export type FaceStatus = typeof FACE_STATUSES[number];

// ---------------------------------------------------------------------------------------------------------------- face.json

export interface FacePand {
  /** BAG pand identificatie, 16 digits, no `NL.IMBAG.Pand.` prefix. */
  pandId: string;
  /** Display address, e.g. `Herengracht 12`. */
  address: string;
  /** Left to right as seen from the street, 0-based. */
  order: number;
  /** Frontage width in metres when known (row layout; the render scale is fixed per face). */
  widthM?: number;
  /** House numbers on this pand (lane B); more than one may mean BAG lumps separate houses into one pand. */
  numbers?: number[];
}

export interface FaceFile {
  schemaVersion?: 1;
  faceId: string;
  street: string;
  /** `odd` / `even` / a compass side; free text, shown as is. */
  side: string;
  pands: FacePand[];
  /** Fixed render scale for this face (R2), so photo and drawing line up. Default 50 px/m (the crop scale). */
  pxPerM?: number;
  /** A test or demo face; listed last and marked in the page. */
  fixture?: boolean;
  /** Free text shown under the title. */
  note?: string;
}

// ---------------------------------------------------------------------------------------------------------- candidates.json

export const CANDIDATE_SOURCES = ['wall', 'strip'] as const;
/** `wall`: a rectified crop of this pand's wall. `strip`: a slice of the block-face strip (narrow streets; weaker evidence). */
export type CandidateSource = typeof CANDIDATE_SOURCES[number];

export interface PhotoCandidate {
  /** Unique within the pand, stable across regenerations (e.g. `2022-TMX7316010203-002548_pano_0000_000615`). */
  id: string;
  /** Exactly one of `url` (absolute http(s)) or `file` (relative to BELT_REVIEW_IMAGE_ROOT, else to the face directory). */
  url?: string;
  file?: string;
  year: number;
  /** 1–12; null when unknown. */
  month: number | null;
  /** Camera to wall, metres; null when unknown. */
  distM: number | null;
  /** Angle between the camera ray and the wall normal, degrees (0 = square on); null when unknown. */
  obliquityDeg: number | null;
  source: CandidateSource;
  /** Quality flag codes as `scripts/house-crops/flags.ts` names them (`occluder`, `foliage`, `oblique`, `washed-out`…); empty = clean. */
  flags: string[];
  /** The automatic judge's read, when one ran (scripts/house-crops/judge.ts). */
  judge?: { score: number; verdict?: string; by?: string };
  pano: { id: string; date: string };
  /** Pixel size and scale of the crop, when known (lets the page lay photos out at one scale). */
  widthPx?: number;
  heightPx?: number;
  pxPerM?: number;
  /** One line for the page, e.g. "tram mast in front of bay 2". */
  note?: string;
  /** The BAG front's span inside the image, pixels [x0, x1] (lane B crops with a margin each side). Absent: no edge lines. */
  pandSpanPx?: [number, number];
  /** The margin cropped each side of the BAG span, metres. */
  marginM?: number;
}

export interface PandCandidates {
  pandId: string;
  /** At most 6, best first. */
  candidates: PhotoCandidate[];
  /** The automatic pick's candidate id; null = the picker found nothing usable. */
  autoPick: string | null;
}

export interface CandidatesFile {
  schemaVersion?: 1;
  faceId?: string;
  generatedAt?: string;
  pands: PandCandidates[];
}

// -------------------------------------------------------------------------------------------------------- description.json

/**
 * The format lane C writes (scripts/belt-review/describe.ts, beltReview/description.ts on lane/belt-review-library-20261120):
 * per pand, readable fields in the DESC_FIELDS vocabulary (fields.ts), each the winning statement with its source.
 * Sources, strongest first: reviewed > face-intent > photo-read > own-read > register > survey > based-on > donor > period-default.
 */
export interface DescFieldValue {
  value: unknown;
  source: string;
  confidence: number;
  ref: string;
  /** Other sources' values that disagree with the winner. */
  others?: Array<{ value: unknown; source: string; ref: string }>;
  /** Sources that state the same value. */
  agree?: string[];
}

export interface DesignUnitRef {
  id: string;
  /** `ordekaart` (city open data, one polygon per building as designed) or another grouping source. */
  source: string;
  share?: number;
  orde?: string | null;
  year?: number | null;
  architect?: string | null;
  /** The face's pands in the same unit. */
  faceMembers?: string[];
}

/** A field the kit cannot draw (lane C kitCannotDraw): `gapId` points into review-data/belt-review/kit-gaps.json. */
export interface KitCannotDraw { field: string; value?: unknown; drawnAs?: unknown; why: string; gapId?: string }

export interface PandDescription {
  pandId: string;
  address?: string;
  order?: number;
  fields: Partial<Record<string, DescFieldValue>>;
  /** Fields no source states. */
  missing?: string[];
  group?: { unit?: DesignUnitRef | null; basedOn?: { pandId: string; overrides?: Record<string, unknown> } | null };
  kitCannotDraw?: KitCannotDraw[];
  /** Which spec parts fed the description (`published`, `face-intent`…). */
  specParts?: string[];
  counts?: Record<string, unknown>;
}

export interface DescriptionFile {
  version?: number;
  faceId?: string;
  street?: string;
  side?: string;
  generatedAt?: string;
  counts?: Record<string, unknown>;
  pands: PandDescription[];
}

// ------------------------------------------------------------------------------------------------------- writable docs

export type Actor = 'david' | 'claude';

/** Common header of every writable doc. `revision` 0 = the file does not exist yet. */
export interface DocHeader { schemaVersion: 1; faceId: string; revision: number; updatedAt: string | null }

export interface Entry { revision: number; at: string; by: Actor }

/** picks.json: David's photo per pand. `candidateId: null` = none usable. */
export interface Pick extends Entry {
  candidateId: string | null; /** the automatic pick when David chose (for the ledger) */ autoPick: string | null; note?: string;
  /** Where the facade really starts and ends in the picked image, pixels, when David dragged the edges off the BAG span. */
  facadeSpanPx?: [number, number];
  /** The same in metres from the BAG span start (negative = left of it); the durable value later stages crop and register by. */
  facadeSpanM?: [number, number];
  /** The facade split into separate houses (BAG registers them as one pand), metres from the BAG span start, left to
   *  right, contiguous, covering the facade span. Two or more; absent = one house. */
  houses?: Array<{ fromM: number; toM: number; label?: string }>;
}
export interface PicksFile extends DocHeader { picks: Record<string, Pick> }

/** edits.json: per pand, field patches keyed by description field (`crown`, `storeys`; fields.ts DESC_FIELDS) or by a
 *  spec path (`fronts/0/gable`) for a fix the fields do not cover. `{reset: true}` drops an edit. */
export interface FieldEdit { value: unknown; note?: string }
export interface PandEdits extends Entry { fields: Record<string, FieldEdit> }
export interface EditsFile extends DocHeader { edits: Record<string, PandEdits> }

/** grouping.json: design units and links. An empty `units` list means "as described" (description.json group.unit). */
export const GROUPING_LINK_KINDS = ['sameAs', 'basedOn'] as const;
export type GroupingLinkKind = typeof GROUPING_LINK_KINDS[number];
export interface GroupingUnit { id: string; pandIds: string[]; source: string; ordekaartId?: string; note?: string }
export interface GroupingLink { pandId: string; kind: GroupingLinkKind; target: string; overrides?: Record<string, unknown>; by: Actor; at: string }
/** Stage 3 pair answers, keyed `${left}|${right}` (neighbours in face order): separate houses, same design (twin), one building. */
export const PAIR_ANSWERS = ['separate', 'twin', 'one', 'unsure'] as const;
export type PairAnswer = typeof PAIR_ANSWERS[number];
export interface GroupingFile extends DocHeader { units: GroupingUnit[]; links: GroupingLink[]; pairs?: Record<string, { answer: PairAnswer; by: Actor; at: string }> }

/** pins.json: stage-4 pins. Coordinates are 0…1 on the image they were dropped on. */
export const PIN_TAGS = ['grouping', 'height-roofline', 'gable-crown', 'windows', 'wall-colour-material', 'white-accents', 'ground-floor-door-stoop', 'missing-ornament', 'other',
  'roof', 'storeys', 'colour', 'ground-floor', 'door-stoop', 'white-detail'] as const;
/** The tags the stage 2 focus view offers (in key order 1–8); the older ones stay valid for pins already filed. */
export const FOCUS_PIN_TAGS = ['roof', 'storeys', 'windows', 'colour', 'ground-floor', 'door-stoop', 'white-detail', 'other'] as const;
export type PinTag = typeof PIN_TAGS[number];
export const PIN_TAG_LABELS: Record<PinTag, string> = {
  'grouping': 'Grouping', 'height-roofline': 'Height / roofline', 'gable-crown': 'Gable / crown', 'windows': 'Windows',
  'wall-colour-material': 'Wall colour / material', 'white-accents': 'White accents', 'ground-floor-door-stoop': 'Ground floor / door / stoop',
  'missing-ornament': 'Missing ornament', 'other': 'Other',
  'roof': 'Roof', 'storeys': 'Storeys', 'colour': 'Colour', 'ground-floor': 'Ground floor', 'door-stoop': 'Door / stoop', 'white-detail': 'White detail',
};
export const PIN_KINDS = ['local', 'rule', 'kit-gap', 'data'] as const;
export type PinKind = typeof PIN_KINDS[number];
export const PIN_STATUSES = ['open', 'fixed', 'resolved', 'reopened'] as const;
/** `open` (new), `fixed` (Claude says done, David to check), `resolved` (David agrees), `reopened` (David disagrees). */
export type PinStatus = typeof PIN_STATUSES[number];
/** `photo` / `render`: one house; `row-photo` / `row-render`: the row strips (pandId = the house under the pin). */
export const PIN_TARGETS = ['photo', 'render', 'row-photo', 'row-render'] as const;
export type PinTarget = typeof PIN_TARGETS[number];
export interface PinMessage { at: string; by: Actor; text: string }
export interface Pin extends Entry {
  id: string;
  /** The house under the pin; null for a row pin that is not on one house. */
  pandId: string | null;
  target: PinTarget;
  x: number;
  y: number;
  tag: PinTag;
  note: string;
  status: PinStatus;
  /** Set by Claude when it sorts the pin (plan step 4). */
  kind?: PinKind;
  thread: PinMessage[];
  createdAt: string;
  /** The fix pass the pin was made in (state.passes at creation). */
  pass: number;
}
export interface PinsFile extends DocHeader { pins: Record<string, Pin> }

/** state.json. Writing status `with-claude` is the "Send to Claude" signal the integrator's Monitor watches. */
export interface StateEvent { at: string; by: Actor; action: StateAction; stage: Stage }
export const STATE_ACTIONS = ['confirm-stage', 'reopen-stage', 'send-to-claude', 'return-to-david', 'accept', 'reopen-block'] as const;
export type StateAction = typeof STATE_ACTIONS[number];
export interface StateFile extends DocHeader {
  /** The open stage: stages below it are confirmed. */
  stage: Stage;
  status: FaceStatus;
  /** ISO time each stage was last confirmed. */
  confirmed: Partial<Record<string, string>>;
  /** Number of times the block went to Claude. */
  passes: number;
  events: StateEvent[];
}

/** ledger.json (plan "Ledger"). `david` and the derived sections are written by the server; `claude` by the integrator. */
export interface LedgerFile extends DocHeader {
  david: { activeSeconds: number; byStage: Record<string, number>; /** stage 2 seconds per house (the house in view) */ byHouse?: Record<string, number> };
  claude: { tokens: number; passes: Array<{ at: string; tokens: number; note?: string }> };
  photos: { pands: number; picked: number; agreedWithAuto: number; overridden: number; noneUsable: number; spanCorrected?: number; pandSplits?: number };
  fields: { fromLibrary: number; fromNewRead: number; edited: number };
  pins: { total: number; open: number; byTag: Record<string, number>; byKind: Record<string, number> };
  /** Stage 2 marks: G/W/? per pass (every mark ever made, by the pass it was made in) and now. */
  marks?: { byPass: Record<string, { good: number; wrong: number; unsure: number }>; now: { good: number; wrong: number; unsure: number } };
  /** Failures per stage: 1 picks overriding the auto pick or none usable, 2 pands with field edits, 3 grouping changes, 4 pins. */
  stageFailures: Record<string, number>;
  reopens: Record<string, number>;
  passes: number;
  acceptedAt: string | null;
}

/** marks.json (stage 2): David's at-a-glance verdict per house on the photo-over-render row. `hash` is the render he
 *  judged; when Claude re-renders the house (another hash) the mark reads "changed, recheck" and no longer counts. */
export const MARKS = ['good', 'wrong', 'unsure'] as const;
export type MarkValue = typeof MARKS[number];
export interface Mark extends Entry { mark: MarkValue; note?: string; /** For a wrong mark: what is most wrong (FOCUS_PIN_TAGS). */ tags?: string[]; hash: string | null; pass: number; history: Array<{ pass: number; mark: MarkValue; at: string }> }
export interface MarksFile extends DocHeader { marks: Record<string, Mark> }

export type DocName = 'picks' | 'edits' | 'grouping' | 'pins' | 'marks' | 'state' | 'ledger';
export type EntryDocName = 'picks' | 'edits' | 'pins' | 'marks';

/** Everything the page needs for one face, as GET /api/belt-review/faces/:faceId returns it. */
export interface FaceBundle {
  token: string;
  face: FaceFile;
  candidates: CandidatesFile | null;
  description: DescriptionFile | null;
  picks: PicksFile;
  edits: EditsFile;
  grouping: GroupingFile;
  pins: PinsFile;
  marks: MarksFile;
  state: StateFile;
  ledger: LedgerFile;
}

export interface FaceSummary { faceId: string; street: string; side: string; pands: number; fixture: boolean; stage: Stage; status: FaceStatus; updatedAt: string | null; candidates: boolean; description: boolean }

// ---------------------------------------------------------------------------------------------------------- compare rounds

/** review-data/belt-review/rounds.json */
export interface RoundsConfig { rounds: Array<{ id: string; title: string; root: string; note?: string }> }

export const VERDICTS = ['better', 'same', 'worse'] as const;
export type Verdict = typeof VERDICTS[number];
export interface BlockVerdict { verdict: Verdict | null; note: string; revision: number; at: string }
export interface VerdictsFile { schemaVersion: 1; roundId: string; revision: number; updatedAt: string | null; verdicts: Record<string, BlockVerdict> }

export interface RoundLayer { name: string; url: string; caption?: string }
/** A house's slice of the photo row, in photo-row pixels (layers share its px/m and left edge). From `photo-row.json`. */
export interface RowBoundary { x0: number; x1: number; pandId?: string; address?: string }
export interface RoundBlock { key: string; title: string; street?: string; note?: string; layers: RoundLayer[]; photos: RoundLayer[]; boundaries?: RowBoundary[] }
export interface RoundBundle { token: string; id: string; title: string; root: string; exists: boolean; blocks: RoundBlock[]; verdicts: VerdictsFile }

// ---------------------------------------------------------------------------------------------------------- initial docs

const header = (faceId: string): DocHeader => ({ schemaVersion: 1, faceId, revision: 0, updatedAt: null });
export const initialDocs = {
  picks: (faceId: string): PicksFile => ({ ...header(faceId), picks: {} }),
  edits: (faceId: string): EditsFile => ({ ...header(faceId), edits: {} }),
  grouping: (faceId: string): GroupingFile => ({ ...header(faceId), units: [], links: [] }),
  marks: (faceId: string): MarksFile => ({ ...header(faceId), marks: {} }),
  pins: (faceId: string): PinsFile => ({ ...header(faceId), pins: {} }),
  state: (faceId: string): StateFile => ({ ...header(faceId), stage: 1, status: 'with-david', confirmed: {}, passes: 0, events: [] }),
  ledger: (faceId: string): LedgerFile => ({
    ...header(faceId),
    david: { activeSeconds: 0, byStage: {} },
    claude: { tokens: 0, passes: [] },
    photos: { pands: 0, picked: 0, agreedWithAuto: 0, overridden: 0, noneUsable: 0, spanCorrected: 0, pandSplits: 0 },
    fields: { fromLibrary: 0, fromNewRead: 0, edited: 0 },
    pins: { total: 0, open: 0, byTag: {}, byKind: {} },
    stageFailures: {}, reopens: {}, passes: 0, acceptedAt: null,
  }),
} satisfies Record<DocName, (faceId: string) => DocHeader>;
export const initialVerdicts = (roundId: string): VerdictsFile => ({ schemaVersion: 1, roundId, revision: 0, updatedAt: null, verdicts: {} });

/** Face and round ids: lowercase slug, optionally with a leading underscore for fixtures. */
export const ID_PATTERN = /^_?[a-z0-9][a-z0-9-]{0,80}$/;
export const PAND_PATTERN = /^\d{16}$/;
export const ENTRY_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,120}$/;
