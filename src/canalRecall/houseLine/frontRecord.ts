/**
 * Front records: one measured street front per pand, the data the ordinary renderer (mesher and roof planner) draws a
 * block from. First table: `data/front-records/haarlemmerdijk-block.json` (lane 2 of the Haarlemmerdijk single-goal
 * plan, 2026-11-13), built by `scripts/front-records/build-haarlemmerdijk-block.ts` from the reads in
 * `data/front-records/haarlemmerdijk-block.reads.json`.
 *
 * Datum. Every height (`*M`) is metres above the street ground of the pand's block face (`streetGroundNAP`: the
 * block-face strip's `groundNAP`, row 0 m of the strip the reads were taken on), the 3DBAG values included. The pand's own
 * 3DBAG ground (`groundNAP`, `b3_h_maaiveld`) is not a street level on the dijk: it swings from 0.6 to 2.5 m NAP between
 * neighbours (the rear yards fall away), so heights above it would put rows a metre off. To get a height above the pand's
 * own ground (the datum of HouseSpec `eavesHeight` and `facts.measuredEavesM`): `value + streetGroundNAP - groundNAP`.
 *
 * Nothing here is invented: a field no read states is null. A house with confidence `low`, or with no measured front
 * top, carries `fallback: 'row-line'`: draw it with its measured neighbours' row line and a plain cornice.
 */

/** The crown over the street front. `point` (a plain triangular gable) and `flat-parapet` are named because the dijk has
 * several; `other` covers raised ornate attics, tower fronts and anything a read could not place. */
export const CROWN_FAMILIES = [
  'neck', 'bell', 'step', 'spout', 'point', 'straight-cornice', 'raised-dormer-hoist', 'flat-parapet', 'other',
] as const;
export type CrownFamily = typeof CROWN_FAMILIES[number];

/** What the front top height is the top of. */
export const FRONT_TOP_KINDS = [
  'cornice-top', // the top of a cornice or of a frieze-and-cornice band (straight-cornice fronts)
  'parapet-top', // the top of a flat parapet or balustrade
  'gable-foot', // where a gable (neck, bell, step, spout, point) leaves the full-width wall: the shoulders / scroll tops
] as const;
export type FrontTopKind = typeof FRONT_TOP_KINDS[number];

export type Confidence = 'high' | 'medium' | 'low';

export interface Crown {
  family: CrownFamily | null;
  /** Width of the crown piece at its foot (gable at the shoulders), metres. */
  widthM: number | null;
  /** Width of the neck or of the top of the crown piece (neck, bell cap), metres. */
  neckWidthM: number | null;
  /** Height of the shoulders above ground (the gable foot); equals `frontTopM` for gables. */
  shoulderM: number | null;
  /** Top of the crown body (neck cap, bell cap, apex, dormer roof) above ground, without thin finials. */
  topM: number | null;
  /** Top of a finial, crest, weathervane or spire above ground, when read. */
  ornamentTopM: number | null;
  /** A dormer or crown piece standing on a straight cornice: kind and top. */
  dormer: { kind: 'lantern' | 'pediment' | 'crowned' | 'box' | 'spire' | 'set-back'; topM: number | null } | null;
  /** Number of attic lights in the gable or crown, when read. */
  atticWindows: number | null;
  /** A hoist beam or hoist door seen in the crown. null = not read. */
  hoist: boolean | null;
  /** Free text: what the read saw (frieze, scrolls, white blocks). */
  note: string | null;
}

/** One upper storey's window row: sill and head above ground. */
export interface Row { sillM: number; headM: number }

export interface Colour {
  /** Hex colour, or null when only a word is known. */
  hex: string | null;
  /** The word a read used (dark grey-brown brick, cream, white). */
  word: string | null;
  ref: string | null;
}

export const WALL_FINISHES = ['brick', 'painted-brick', 'plaster', 'stone'] as const;
export type WallFinish = typeof WALL_FINISHES[number];
/**
 * Where a wall colour comes from. `reviewed` is the HouseSpec source label the pale-warm guard skips
 * (`reviewedWallSource`, lane WC, lane/wall-exposure-20261113): a strip measurement a Claude read checked against the
 * photo (the read's word and the measured lightness agree). `strip-measured`: the measurement alone.
 */
export type WallSource = 'reviewed' | 'strip-measured';

/** The wall: colour measured on the strip with the capture's exposure taken out (lane WC option (c)), and its finish. */
export interface WallColour extends Colour {
  /** Spandrel median before the exposure gain. */
  rawHex: string | null;
  /** The exposure gain applied in linear light (target 0.23 / sqrt(white95 x scene median), clamped 0.8..3). */
  gain: number | null;
  finish: WallFinish | null;
  /** Where the finish comes from: a read's word, or the lightness rule (OKLab L >= 0.66 and chroma < 0.06 = plaster). */
  finishFrom: 'read' | 'lightness' | null;
  source: WallSource | null;
  confidence: Confidence;
}

export interface ThreeDBag {
  /** All moved to the street datum. 3DBAG front eaves: the 10th percentile of the roof edge over the street front (`facts.fronts[].eavesM`). */
  frontEavesM: number | null;
  roofMinM: number | null;
  dak50pM: number | null;
  dak70pM: number | null;
  roofMaxM: number | null;
}

export interface Source { field: string; ref: string; kind: SourceKind }
export type SourceKind =
  | 'lane2-strip-read' // this lane's gridded read of the block-face strip (a Claude read of an open-data panorama strip)
  | 'reviewer-strip-read' // an earlier lane's gridded strip read (review pins and hold reasons in scripts/block-face/buurten)
  | 'strip-measure' // a machine measurement on the strip (auto-place.json strip.wallRaw)
  | '3dbag' | 'bag' | 'hand-spec';

export interface Conflict {
  field: string;
  /** The value this record keeps, and where it comes from. */
  kept: { value: unknown; ref: string };
  /** The disagreeing value and its source. */
  other: { value: unknown; ref: string };
  note: string;
}

export interface FrontRecord {
  pandId: string;
  address: string | null;
  street: string;
  /** Block-face id the pand belongs to (scripts/block-face/faces/<face>). */
  face: string;
  side: 'even' | 'odd' | null;
  builtYear: number | null;
  /** BAG frontage width on the street, metres. */
  bagWidthM: number | null;
  /** Street ground of the block face, NAP metres (strip.json groundNAP): the datum of every `*M` height. */
  /** Always 'street': every `*M` height in this record is above `streetGroundNAP`. Use `heightAbovePandGround` for the
   * pand's own ground (HouseSpec eavesHeight, facts.measuredEavesM). */
  datum: 'street';
  streetGroundNAP: number;
  /** The pand's own 3DBAG ground (b3_h_maaiveld), NAP metres. */
  groundNAP: number | null;
  /** Measured top of the street front's full-width wall (see `frontTopKind`), above ground. */
  frontTopM: number | null;
  frontTopKind: FrontTopKind | null;
  threeDBag: ThreeDBag;
  crown: Crown;
  /** Full street-facing storeys (HouseSpec STOREYS_DEFINITION: no souterrain, no attic in the crown). */
  storeys: number | null;
  /** Top of the ground (shop) storey: the fascia or shop cornice top. */
  groundStoreyTopM: number | null;
  /** Upper-storey window rows, bottom to top. Empty = not measured. */
  rows: Row[];
  /** Window axes on the first upper storey (per-storey differences go in `notes`). */
  bays: number | null;
  wall: WallColour;
  trim: Colour;
  sources: Source[];
  confidence: Confidence;
  /** Present when the renderer should not trust this record's numbers: use the neighbours' row line and a plain cornice. */
  fallback?: 'row-line';
  /** True when no measured read exists for this pand in the repository (no strip read, no reviewer read). */
  nothingLocal: boolean;
  conflicts: Conflict[];
  notes: string[];
  /**
   * Present when one BAG pand carries several street fronts (separate houses on one plot, a corner wing, a cinema next to a
   * house). Left to right along the strip; the record's own numbers are then the pand as a whole (usually low with
   * fallback) and a renderer draws each sub-front instead.
   */
  fronts?: SubFront[];
  /** The traced openings, bands and outline of the front (single-front pands; sub-fronts carry their own). */
  trace?: FrontTrace;
}

/** The measured fields of one street front, shared by a record and its sub-fronts. */
export type FrontFields = Pick<FrontRecord, 'frontTopM' | 'frontTopKind' | 'crown' | 'storeys' | 'groundStoreyTopM' | 'rows' | 'bays' | 'wall'
  | 'trim' | 'sources' | 'confidence' | 'fallback' | 'conflicts' | 'notes' | 'trace'>;

export const OPENING_KINDS = ['single-sash', 'two-light', 'paired', 'french-door', 'oriel', 'door', 'shop', 'attic', 'other'] as const;
export type OpeningKind = typeof OPENING_KINDS[number];
/**
 * One traced opening, a rectangle on the front. `x`/`w` are metres along the pand's strip span (the same frame as
 * SubFront.from/to: 0 = the span's left end, photo registration removed); `y` is the sill (or threshold) height above the
 * street and `h` the opening height to the head (to the top of an arch).
 */
export interface Opening {
  x: number; w: number; y: number; h: number;
  kind: OpeningKind;
  head: 'flat' | 'segmental' | 'round' | 'pointed' | null;
  /** Pane layout as read, e.g. '2-over-2', '6-over-6', '1' (single pane), 'transom+2'; null = not readable. */
  panes: string | null;
  frame: 'white' | 'dark' | 'timber' | null;
  surround: 'none' | 'plain' | 'eared' | 'arched' | null;
  shutters: boolean | null;
}
export interface Band { kind: 'cornice' | 'frieze' | 'string' | 'fascia' | 'plinth'; bottomM: number; topM: number; colour: string | null }
/**
 * The traced front: every opening as a rectangle, grouped per storey (index 0 = the ground storey: shop openings and the
 * door), the band heights, the shop band and its fascia colour, and the outline. A low-confidence trace is not drawn:
 * the renderer keeps its regular grid from the counts.
 */
export interface FrontTrace {
  storeys: Opening[][];
  /** Top of the shop band (the fascia over the shop windows), above the street. */
  shopBandTopM: number | null;
  /** The ground-floor fascia colour from the photo's shop band, muted toward the wall (hex), with its word. */
  fascia: { hex: string | null; word: string | null } | null;
  /** The cornice line (top of the main cornice) above the street; null where the front has none. */
  corniceM: number | null;
  bands: Band[];
  /** Window surround colour as a word ('white', 'cream', 'stone'), where the read is reliable. */
  surroundColour: string | null;
  /** The front's outline from the bottom-left corner, clockwise, ending at the bottom-right: [x along span, height] metres. */
  outline: [number, number][];
  source: Source;
  confidence: Confidence;
  notes: string[];
}

/**
 * One front of a multi-front pand. `from`/`to` are metres along the pand's street edge in the strip's frame: 0 = the left
 * end of the pand's span on the block-face strip (strip.json spans[].px[0]), increasing left to right as the strip runs,
 * with the face's photo registration taken out, so the split sits where the party wall stands relative to the BAG span.
 */
export interface SubFront extends FrontFields {
  from: number;
  to: number;
  /** The BAG verblijfsobject house number(s) this front carries, where the numbering makes it clear; evidence, not proof. */
  addresses: string[];
}

export interface FrontRecordTable {
  schemaVersion: 1;
  id: string;
  generatedBy: string;
  generatedAt: string;
  datum: string;
  /** How the strip heights were checked against 3DBAG flat roofs, and other table-wide notes. */
  notes: string[];
  records: FrontRecord[];
}

/** A record height (street datum) on the pand's own 3DBAG ground: what HouseSpec `eavesHeight` and the recipe facts use. */
export function heightAbovePandGround(r: Pick<FrontRecord, 'streetGroundNAP' | 'groundNAP'>, streetM: number): number {
  return Math.round((streetM + r.streetGroundNAP - (r.groundNAP ?? r.streetGroundNAP)) * 100) / 100;
}
/** The inverse: a height above the pand's own ground moved to the street datum. */
export function heightAboveStreet(r: Pick<FrontRecord, 'streetGroundNAP' | 'groundNAP'>, pandM: number): number {
  return Math.round((pandM - r.streetGroundNAP + (r.groundNAP ?? r.streetGroundNAP)) * 100) / 100;
}

const HEX = /^#[0-9a-f]{6}$/i;
const finite = (v: unknown) => typeof v === 'number' && Number.isFinite(v);
const height = (v: unknown) => v === null || (finite(v) && (v as number) >= 0 && (v as number) <= 40);

/** Problems with one record, as readable lines; empty = valid. */
export function frontRecordProblems(r: FrontRecord): string[] {
  const p: string[] = [], at = r.pandId || '?';
  if (!/^\d{16}$/.test(r.pandId)) p.push(`${at}: pandId is not 16 digits`);
  if (!finite(r.streetGroundNAP)) p.push(`${at}: streetGroundNAP missing`);
  for (const k of ['frontTopM', 'groundStoreyTopM'] as const) if (!height(r[k])) p.push(`${at}: ${k} out of range`);
  for (const [k, v] of Object.entries(r.threeDBag)) if (!(v === null || finite(v))) p.push(`${at}: threeDBag.${k} not a number`);
  if (r.frontTopKind !== null && !FRONT_TOP_KINDS.includes(r.frontTopKind)) p.push(`${at}: frontTopKind ${r.frontTopKind}`);
  if ((r.frontTopM === null) !== (r.frontTopKind === null)) p.push(`${at}: frontTopM and frontTopKind must both be set or both null`);
  const c = r.crown;
  if (c.family !== null && !CROWN_FAMILIES.includes(c.family)) p.push(`${at}: crown.family ${c.family}`);
  for (const k of ['widthM', 'neckWidthM', 'shoulderM', 'topM', 'ornamentTopM'] as const) if (!height(c[k])) p.push(`${at}: crown.${k} out of range`);
  if (c.topM !== null && r.frontTopM !== null && c.topM < r.frontTopM - 0.05) p.push(`${at}: crown.topM ${c.topM} below frontTopM ${r.frontTopM}`);
  if (c.ornamentTopM !== null && c.topM !== null && c.ornamentTopM < c.topM - 0.05) p.push(`${at}: crown.ornamentTopM below crown.topM`);
  if (c.dormer && c.dormer.topM !== null && r.frontTopM !== null && c.dormer.topM < r.frontTopM) p.push(`${at}: dormer top below the front top`);
  let last = r.groundStoreyTopM ?? 0;
  r.rows.forEach((row, i) => {
    if (!finite(row.sillM) || !finite(row.headM) || row.headM <= row.sillM) p.push(`${at}: rows[${i}] head must be above sill`);
    if (row.sillM < last - 0.3) p.push(`${at}: rows[${i}] sill ${row.sillM} below the row or storey under it (${last})`);
    last = row.headM;
  });
  if (r.frontTopM !== null && r.rows.length && r.rows.at(-1)!.headM > r.frontTopM + 0.05 && c.family !== 'point' && c.family !== 'other')
    p.push(`${at}: top row head ${r.rows.at(-1)!.headM} above the front top ${r.frontTopM}`);
  if (r.storeys !== null && (!Number.isInteger(r.storeys) || r.storeys < 1 || r.storeys > 8)) p.push(`${at}: storeys ${r.storeys}`);
  if (r.storeys !== null && r.rows.length && r.rows.length !== r.storeys - 1) p.push(`${at}: ${r.rows.length} rows for ${r.storeys} storeys (rows count upper storeys)`);
  if (r.bays !== null && (!Number.isInteger(r.bays) || r.bays < 1 || r.bays > 8)) p.push(`${at}: bays ${r.bays}`);
  for (const k of ['wall', 'trim'] as const) if (r[k].hex !== null && !HEX.test(r[k].hex!)) p.push(`${at}: ${k}.hex ${r[k].hex}`);
  if (r.datum !== 'street') p.push(`${at}: datum must be 'street'`);
  if (r.wall.finish !== null && !WALL_FINISHES.includes(r.wall.finish)) p.push(`${at}: wall.finish ${r.wall.finish}`);
  if (r.wall.source === 'reviewed' && (r.wall.hex === null || r.wall.confidence === 'low')) p.push(`${at}: a reviewed wall needs a hex and medium or high confidence`);
  if (!['high', 'medium', 'low'].includes(r.confidence)) p.push(`${at}: confidence ${r.confidence}`);
  const wantsFallback = r.confidence === 'low' || r.frontTopM === null;
  if (wantsFallback && r.fallback !== 'row-line') p.push(`${at}: low confidence or no front top needs fallback: 'row-line'`);
  if (!wantsFallback && r.fallback !== undefined) p.push(`${at}: fallback set on a measured record`);
  if (r.nothingLocal && (r.frontTopM !== null || r.rows.length || r.confidence !== 'low')) p.push(`${at}: nothingLocal with measured values`);
  if (r.frontTopM !== null && !r.sources.some(s => s.field === 'frontTopM')) p.push(`${at}: frontTopM has no source`);
  if (r.crown.family !== null && !r.sources.some(s => s.field === 'crown.family')) p.push(`${at}: crown.family has no source`);
  if (r.trace) p.push(...traceProblems(r.trace, r.storeys).map(x => `${at}: trace ${x}`));
  if (r.fronts) {
    if (r.fronts.length < 2) p.push(`${at}: fronts needs two or more sub-fronts`);
    r.fronts.forEach((f, i) => {
      const fa = `${at}#${i}`;
      if (i === 0 && Math.abs(f.from) > 0.01) p.push(`${fa}: the first sub-front must start at 0`);
      if (i > 0 && Math.abs(f.from - r.fronts![i - 1].to) > 0.01) p.push(`${fa}: from ${f.from} does not meet the previous to ${r.fronts![i - 1].to}`);
      if (!(f.to - f.from >= 1.5)) p.push(`${fa}: narrower than 1.5 m (${f.from}-${f.to})`);
      if (r.bagWidthM !== null && f.to > r.bagWidthM + 1.5) p.push(`${fa}: to ${f.to} runs past the pand width ${r.bagWidthM}`);
      p.push(...frontRecordProblems({...r, fallback: undefined, ...f, nothingLocal: false, fronts: undefined}).map(x => x.replace(at, fa)));
    });
  }
  return p;
}

function traceProblems(t: FrontTrace, storeys: number | null): string[] {
  const p: string[] = [];
  if (!['high', 'medium', 'low'].includes(t.confidence)) p.push(`confidence ${t.confidence}`);
  if (storeys !== null && t.storeys.length !== storeys) p.push(`${t.storeys.length} traced storeys for ${storeys} storeys`);
  t.storeys.forEach((row, i) => row.forEach((o, j) => {
    const at = `storeys[${i}][${j}]`;
    if (!OPENING_KINDS.includes(o.kind)) p.push(`${at} kind ${o.kind}`);
    if (![o.x, o.w, o.y, o.h].every(finite) || o.w <= 0 || o.h <= 0 || o.y < -0.1 || o.y + o.h > 40) p.push(`${at} rectangle out of range`);
  }));
  if (t.outline.length < 3 || !t.outline.every(q => q.length === 2 && q.every(finite))) p.push('outline needs three or more [x, y] points');
  if (t.fascia?.hex && !HEX.test(t.fascia.hex)) p.push(`fascia.hex ${t.fascia.hex}`);
  for (const b of t.bands) if (!(b.topM > b.bottomM)) p.push(`band ${b.kind} top must be above bottom`);
  return p;
}

export function frontTableProblems(t: FrontRecordTable): string[] {
  const p: string[] = [];
  if (t.schemaVersion !== 1) p.push('schemaVersion must be 1');
  const seen = new Set<string>();
  for (const r of t.records) {
    if (seen.has(r.pandId)) p.push(`${r.pandId}: duplicate`);
    seen.add(r.pandId);
    p.push(...frontRecordProblems(r));
  }
  return p;
}
