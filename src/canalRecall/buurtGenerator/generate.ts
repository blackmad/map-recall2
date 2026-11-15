/**
 * Buurt generator (docs/handoffs/buurt-generators-20261115.md): a district's undescribed street-side rows as house-rows
 * records. Each series takes the district design its family states (storeys from the series' eaves line, the window
 * cell, wall family and crown measured for the district); the row and its fronts are lane D's RowRecord
 * (houseSpec/row/types.ts), joined to the renderer's records by lane R's `rowFrontsWithSeries` (houseLine/rowSeries.ts),
 * so the row renderer, `check:rows` and the HouseSpec emit read them unchanged. Pure: no fs, no DOM.
 *
 * Every field is source `period-default` with a ref to the district library and its evidence: the district design is the
 * series' stated value, never a per-pand pick. What the generator reads and does not draw (3DBAG roof rises, clamped
 * eaves) is listed in `readNotDrawn`; what the kit cannot say is the library's `notDrawn`, copied into `schemaLimits`.
 */
import { variedTone, type JudgedFamily } from '../houseSpec/judgedColour.ts';
import { rowFrontsWithSeries } from '../houseLine/rowSeries.ts';
import type { RowFrontRecord } from '../houseLine/rowFront.ts';
import { ROW_RECORD_VERSION, type Overruled, type ReadNotDrawn, type RowCorniceKind, type RowCrownKind, type RowDesign, type RowField, type RowFront, type RowHeads, type RowLimit, type RowMember, type RowRecord, type RowRoofStorey, type RowSeries, type RowWallMaterial, type RowWindowKind } from '../houseSpec/row/types.ts';
import { districtRows, ROW_EAVES_STEP_M, type GenPand, type GenRow, type GenSeries, type GenStreet, type RowsResult } from './rows.ts';
import { erkersOnCells, kitAtticOf, kitEavesOf, raisedOf, type BuurtEntry, type BuurtErker, type BuurtKitFront } from './kit/frontKit.ts';

export interface DistrictDesign {
  groundM: number;
  storeyM: number;
  axisM: number;
  windowShare: number;
  windows: RowWindowKind;
  whiteFrames: boolean;
  heads: RowHeads;
  sills: boolean;
  cornice: RowCorniceKind;
  crown: RowCrownKind;
  /** `hex`: the brick measured from the district's cached panoramas (calibrated through the renderer); absent, the family's varied tone. */
  wall: { material: RowWallMaterial; family: JudgedFamily; hex?: string; evidence?: string };
  roofStorey: RowRoofStorey;
  extras: string[];
}
/** What a family's rows show that the house-rows vocabulary has no field for, drawn by the buurt kit (frontKit.ts), with the photo that states it. */
export interface DistrictFamilyKit {
  ribbon?: { evidence: string }; sash?: { value: 'paired-transom'; evidence: string };
  /** Blocks of two pands: a brick pier with a chimney stack at every other party wall, the stair's pair at the others. */
  piers?: { evidence: string };
  /** The upper storeys' window rhythm, singles on the pier side and the stair pair at the middle wall (roofKit drawRhythm). */
  rhythm?: { evidence: string };
}
export interface DistrictFamily { id: string; storeys: number; label: string; design?: Partial<DistrictDesign>; kit?: DistrictFamilyKit }
/** The district's pitched roof: a series whose median 3DBAG rise (ridge - eaves) is at least `minRiseM` draws it. */
export interface DistrictPitchedRoof { minRiseM: number; maxRiseM: number; pitchDeg: number; material: 'tile' | 'slate'; dormersPerFront: number; dormerKind: 'plain' | 'gabled'; hoist: boolean; evidence: string;
  /** The tiles' tone measured on the cached panorama (round 3): the kit's roof hex. */
  roofHex?: string; roofHexEvidence?: string;
  /** Broad flat eaves over the street front, this overhang (m). */
  eavesM?: number;
  /** false: the eaves have no lattice frieze under the slab (Apollo's broad flat eaves). */
  eavesFrieze?: false;
  /** Per orthophoto slot (roof-facts), what the photos of that slot show (round 5: `slate` reads dark glazed tiles). */
  slotLooks?: Record<string, { material: 'tile' | 'slate'; roofHex: string; evidence: string }>;
  /** true: the pitched roof is drawn only on a street whose note measures it (`roof: 'pitched'`): the district's 3DBAG
   *  roof type reads `slanted` on blocks the street sees as flat (round 7, Apollo). */
  streetNoteOnly?: true;
  /** The drawn rise's cap (m; round 8): the roof as the street sees it over the eaves, measured on the district's photos.
   *  3DBAG's rise (ridge - eaves) only gates the roof; drawn at full height the roof stood far taller than any photo. */
  capRiseM?: number; capRiseEvidence?: string }
export interface DistrictLibrary {
  district: string;
  title: string;
  buurten: string[];
  /** Build years the district design covers (inclusive). */
  years: [number, number];
  evidence: string[];
  design: DistrictDesign;
  families: DistrictFamily[];
  pitched?: DistrictPitchedRoof;
  /** A second pitched variant (round 4): the broad-eaves roof, drawn only on a street whose note measures it (round 5:
   *  the orthophoto slot alone did not hold, see the plan doc's slate sample). */
  pitchedEaves?: DistrictPitchedRoof;
  /** Per street, what its photos measure (round 5): `eaves` draws `pitchedEaves` on its pitched series; `erkerBands`
   *  draws its erkers' windows as continuous white bands. */
  streetNotes?: Record<string, { eaves?: true; erkerBands?: true;
    /** Round 12 (lane R): the street's erkers are white-painted timber bay fronts (frontKit.ts BuurtErker.front). */ erkerFront?: 'timber'; /** The roof form the street's photos show (round 7). */ roof?: 'pitched' | 'flat';
    /** The roof's seen rise over the eaves on the street's photo (m; round 8): the drawn rise there. */ riseM?: number; evidence: string }>;
  /** A flat series' top (round 7, Apollo): the broad eaves slab over the street front, no frieze. */
  flatEaves?: { eavesM: number; frieze?: false; evidence: string };
  /** Per row (generator row id), what a photo of it states: `pierPhase` 0 puts the first pier after the row's first
   *  member, 1 (the default: a block starts at the row's first member) after its second; `wall` the row's own measured
   *  brick, which wins over the district's (series photo > district pool); `loggias` the members (last six digits of
   *  the pand id) whose upper storeys are loggias between the erkers. */
  rowNotes?: Record<string, { pierPhase?: 0 | 1; wall?: { hex: string; evidence: string };
    /** Round 11: the wall family the row's photo states, over a measured brick the photo contradicts (Stadionkade 063989:
     *  dark grey-brown brick where the panorama vote read a light tan); drawn at the family's varied tone. */
    wallFamily?: { family: JudgedFamily; evidence: string }; roof?: { hex: string; evidence: string }; axisM?: number; loggias?: string[];
    /** The series line the photo measures (m; round 7: Achillesstraat's fifth storey stands over 3DBAG's eaves). */
    topM?: number;
    /** The entrances, member by member along the row (left to right as seen), the list repeating (round 7). */
    entries?: BuurtEntry[];
    /** Round 12 (lane R): the row's erkers are white timber fronts; `erkers` the bays the row's photo shows, per member
     *  (last six digits of the pand id), in place of BAG's (Stadionkade: BAG draws none, the photo stacked bay columns,
     *  corner oriels and one-storey white oriels). */
    erkerFront?: 'timber'; erkers?: Record<string, BuurtErker[]>;
    /** Round 13 (lane R's kit, emitted here): the row's flat eaves slab as its photo shows it (frontKit KitEaves:
     *  `fasciaM`, `lid`), over the district's `flatEaves`; drawn on flat series only. */
    eaves?: { overhangM?: number; fasciaM?: number; lid?: true; frieze?: false };
    /** Round 13: the top storey as the white attic band (frontKit KitAttic; Stadionkade, Europaplein); replaces `ribbon`. */
    attic?: { heightM?: number; pitchM?: number };
    /** Round 13: raised brick parts over the line per member (last six digits; frontKit KitRaised): towers, parapets,
     *  piers and fins (`outM`), drawn with the series coping. */
    raised?: Record<string, { a0: number; a1: number; riseM: number; outM?: number }[]>;
    evidence: string }>;
  notDrawn: Array<{ component: string; what: string }>;
  /** Round 9: the per-row measurements (`districts/measured/<district>.json`, staged by scripts/buurt-generators/
   *  measure-walls.ts and measure-roofs.ts), under the row and street notes and over the family and district. */
  measured?: DistrictMeasured;
}
/** Round 9 measurements: `walls` per generator row id (street-firstPand), `roofs` per pand (AHN4 DSM, measure.ts roofFormOf). */
export interface DistrictMeasured {
  walls?: Record<string, { hex: string; n: number; of: number; dates: number; reads: Array<{ pano: string; date: string; hex: string }> }>;
  roofs?: Record<string, { form: 'flat' | 'pitched' | 'hidden-pitch' | 'gable-street' | 'unclear'; frontRiseM: number; eavesM?: number; ridgeM?: number; why: string }>;
  rowRoofs?: Record<string, { form: string; hipped: { start: boolean; end: boolean } }>;
  /** Round 10: per row, each kit erker (`<pandId>:<index>`) and the finish its panoramas read (measure.ts erkerFinishOf,
   *  then the row's consensus for unread ones): `white` is the white-framed lights running corner to corner. */
  erkers?: Record<string, Record<string, { finish: 'white' | 'brick' | null; read: boolean; reads: string[] }>>;
}

/** Why a pand of the district is not drawn by the generator. */
export type GenSkip = 'described' | 'minor' | 'no-front' | 'single' | 'off-years' | 'off-storeys' | 'no-eaves';
export interface GenResult {
  rows: RowRecord[];
  records: RowFrontRecord[];
  skipped: Array<{ id: string; reason: GenSkip; detail?: string }>;
  /** Series and pands per family. */
  families: Record<string, { series: number; pands: number }>;
  /** Each drawn front's line (lng/lat, left to right as seen from the street): the sheet rectifies the photo on it. */
  fronts: Record<string, { street: string; a: readonly [number, number]; b: readonly [number, number]; lengthM: number }>;
}

/** The storey count a series line holds under the district's ground and upper pitch. */
export function storeysFor(eavesM: number, d: Pick<DistrictDesign, 'groundM' | 'storeyM'>): number {
  return Math.max(1, Math.round((eavesM - d.groundM) / d.storeyM) + 1);
}
/** Window axes on a front of this width at the district's axis pitch (at least two). */
export function baysFor(widthM: number, d: Pick<DistrictDesign, 'axisM'>): number {
  return Math.max(2, Math.round(widthM / d.axisM));
}

const pandNumber = (id: string) => id.replace(/^NL\.IMBAG\.Pand\./, '');
const median = (xs: number[]) => { const v = [...xs].sort((a, b) => a - b); return v.length ? (v.length % 2 ? v[v.length >> 1] : (v[v.length / 2 - 1] + v[v.length / 2]) / 2) : null; };

/** The series' orthophoto roof reading: its members' majority slot (roof-facts), or null when none is read. */
export function seriesSlot(s: GenSeries): string | null {
  const n = new Map<string, number>();
  for (const m of s.members) if (m.pand.roofSlot) n.set(m.pand.roofSlot, (n.get(m.pand.roofSlot) ?? 0) + 1);
  return [...n.entries()].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))[0]?.[0] ?? null;
}
/** The pitched variant a series draws: the eaves variant when its orthophoto slot is one of that variant's, else the
 *  district's pitched roof. The rise test (`pitchedRiseOf`) decides whether it is pitched at all. */
export function pitchedVariantOf(lib: DistrictLibrary, s: GenSeries): DistrictPitchedRoof | null {
  if (!lib.pitched) return null;
  const street = s.members[0]?.front.street;
  if (lib.pitchedEaves && street && lib.streetNotes?.[street]?.eaves) return lib.pitchedEaves;
  const slot = seriesSlot(s), look = slot ? lib.pitched.slotLooks?.[slot] : undefined;
  return look ? { ...lib.pitched, material: look.material, roofHex: look.roofHex, evidence: `${lib.pitched.evidence}; orthophoto ${slot}: ${look.evidence}` } : lib.pitched;
}
/** The window axis a row draws: its own photo's (row note), else the district's. */
export const axisOf = (lib: DistrictLibrary, rowId: string): Pick<DistrictDesign, 'axisM'> => ({ axisM: lib.rowNotes?.[rowId]?.axisM ?? lib.design.axisM });
/** The series wall hex: the row's own photo (row note: a hex, else a stated family), then the row's measured brick (round 9, panoramas voted across
 *  captures), over the family's and the district's pool. */
export function wallHexOf(lib: DistrictLibrary, fam: DistrictFamily | null, rowId: string): { hex?: string; evidence?: string; family?: JudgedFamily } {
  const own = lib.rowNotes?.[rowId]?.wall;
  if (own) return { hex: own.hex, evidence: `the row's own photo: ${own.evidence}` };
  const stated = lib.rowNotes?.[rowId]?.wallFamily;
  if (stated) return { hex: variedTone(stated.family, `${rowId}:${stated.family}`), family: stated.family, evidence: `the row's own photo states ${stated.family}: ${stated.evidence}` };
  const m = lib.measured?.walls?.[rowId];
  if (m) return { hex: m.hex, evidence: `the row's panoramas: ${m.n} of ${m.of} reads agree (${m.dates} capture date${m.dates === 1 ? '' : 's'}; ${m.reads.map(r => `${r.pano} ${r.date} ${r.hex}`).join(', ')})` };
  const d = { ...lib.design.wall, ...fam?.design?.wall };
  return d.hex ? { hex: d.hex, evidence: d.evidence } : {};
}
/** 3DBAG's roof type of the series, its members' majority (`roofCode`: 1 flat, 2 several flats, 3 slanted); null unread. */
export function seriesRoofCode(s: GenSeries): number | null {
  const n = new Map<number, number>();
  for (const m of s.members) if (m.pand.roofCode) n.set(m.pand.roofCode, (n.get(m.pand.roofCode) ?? 0) + 1);
  return [...n.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0]?.[0] ?? null;
}
/** Why the district's pitched roof is not drawn on a series whose rise would carry it (round 7); null: the gate passes.
 *  The roof form must be measured: a street note's `roof` wins (the photo), then AHN4's form at the front (round 9,
 *  measuredRoofOf); else 3DBAG's roof type must read slanted, and a
 *  `streetNoteOnly` district asks for the note. */
export function pitchGate(lib: DistrictLibrary, s: GenSeries): string | null {
  const note = lib.streetNotes?.[s.members[0]?.front.street ?? '']?.roof;
  if (note === 'flat') return 'the street note measures a flat top';
  if (note === 'pitched') return null;
  const seen = measuredRoofOf(lib, s);
  if (seen === 'flat') return 'AHN4 measures a flat top at the front';
  if (seen === 'pitched') return null;
  if (lib.pitched?.streetNoteOnly) return `no street note measures a pitched roof (${lib.district}: 3DBAG reads slanted on blocks the street sees flat)`;
  const code = seriesRoofCode(s);
  return code !== null && code !== 3 ? `3DBAG roof type ${code === 1 ? 'flat' : 'several flats'}` : null;
}
/** Round 9: the roof form the series' members show the street in AHN4 (`measured.roofs`): pitched or flat when at least
 *  `ROOF_MAJORITY` of the members read clearly agree and at least half the members read clearly; else null (unread). */
export const ROOF_MAJORITY = 0.6;
export function measuredRoofOf(lib: DistrictLibrary, s: GenSeries): 'pitched' | 'flat' | null {
  const roofs = lib.measured?.roofs; if (!roofs) return null;
  // A pitch hidden over the eaves (measure.ts `hidden-pitch`) is a flat top to the street.
  const forms = s.members.map(m => { const f = roofs[pandNumber(m.pand.id)]?.form; return f === 'hidden-pitch' ? 'flat' : f; }).filter((f): f is 'pitched' | 'flat' => f === 'pitched' || f === 'flat');
  if (!forms.length || forms.length < s.members.length / 2) return null;
  const p = forms.filter(f => f === 'pitched').length / forms.length;
  return p >= ROOF_MAJORITY ? 'pitched' : 1 - p >= ROOF_MAJORITY ? 'flat' : null;
}
/** A series' 3DBAG roof rise (median ridge - eaves of its members, m); null when unread. */
export const bagRiseOf = (s: GenSeries): number | null => median(s.members.flatMap(m => m.pand.eavesM !== null && m.pand.ridgeM !== null ? [m.pand.ridgeM - m.pand.eavesM] : []));
/** A series' drawn roof rise (m), when the district's pitched roof applies to it (3DBAG's rise at least `minRiseM` and the
 *  gate passes); else null. Drawn (round 8): the street note's seen rise, else the variant's or district's cap, never
 *  over 3DBAG's rise or `maxRiseM`. */
export function pitchedRiseOf(lib: DistrictLibrary, s: GenSeries): number | null {
  if (!lib.pitched || pitchGate(lib, s) !== null) return null;
  const rise = bagRiseOf(s);
  if (rise === null || rise < lib.pitched.minRiseM) return null;
  const seen = lib.streetNotes?.[s.members[0]?.front.street ?? '']?.riseM, cap = pitchedVariantOf(lib, s)?.capRiseM ?? lib.pitched.capRiseM;
  return +Math.min(lib.pitched.maxRiseM, rise, seen ?? cap ?? Infinity).toFixed(2);
}
/**
 * Round 10: the rise AHN4 measures over a series that reads pitched (`measuredRoofOf`), the median `frontRiseM` of its
 * pitched members; null when unread. The district caps (Apollo 1.3 m, Rivierenbuurt 1.0 m) were the tile seen on a
 * photo rectified onto the wall plane, and a roof leaning back from the wall is foreshortened there: 3 m of 62-degree
 * tiles behind a 14 m eaves line project to about 1 m from a camera 10 m off the front, 2 m from one 25 m off
 * (Beethovenstraat 145103, round 9 held-out: "the dark grey hipped roof shows as a thin strip"; AHN reads 4.1 m).
 * Not drawn (round 10 held-out A/B): drawing it lost Olympiaplein, Apollolaan and Argonautenstraat to the capped
 * round 9 ("a huge red tiled roof the photo does not have"), on sheets that are elevations, not the street camera; the
 * cap stands until the roof is judged on in-game frames. Kept for that judgement and for the evidence text.
 */
export function measuredRiseOf(lib: DistrictLibrary, s: GenSeries): number | null {
  const roofs = lib.measured?.roofs;
  if (!roofs || measuredRoofOf(lib, s) !== 'pitched') return null;
  return median(s.members.flatMap(m => { const r = roofs[pandNumber(m.pand.id)]; return r?.form === 'pitched' && r.frontRiseM > 0 ? [r.frontRiseM] : []; }));
}

/** One series' design: the family's design over the district's, every field `period-default` with its ref. */
export function seriesDesign(lib: DistrictLibrary, fam: DistrictFamily, s: GenSeries, rowId: string, bays: number, riseM: number | null = pitchedRiseOf(lib, s)): RowDesign {
  const d = { ...lib.design, ...fam.design };
  const pv = pitchedVariantOf(lib, s);
  const ref = `buurt-generator ${lib.district} ${fam.id}`;
  const f = <T>(value: T, why = ''): RowField<T> => ({ value, source: 'period-default', ref: why ? `${ref}: ${why}` : ref });
  const design: RowDesign & { windowShare: RowField<number> } = {
    corniceTopM: f<number | null>(s.eavesM, `series line = median 3DBAG eaves of ${s.members.length} members`),
    crown: f(d.crown), cornice: f(d.cornice),
    storeys: f(fam.storeys, `${s.eavesM} m line over a ${d.groundM} m ground and ${d.storeyM} m storeys`),
    bays: f(bays, `median front ${(s.members.map(m => m.front.lengthM).sort((a, b) => a - b)[s.members.length >> 1]).toFixed(1)} m at ${d.axisM} m axes`),
    windows: f(d.windows), heads: f<RowHeads | RowHeads[]>(d.heads), whiteFrames: f(d.whiteFrames), sills: f(d.sills),
    wall: ((w) => f({ material: d.wall.material, family: w.family ?? d.wall.family, hex: w.hex ?? variedTone(d.wall.family, `${rowId}:${d.wall.family}`) }, w.family ? `${w.family} ${w.hex} (${w.evidence})` : w.hex ? `measured brick ${w.hex} (${w.evidence ?? 'district photos'})` : ''))(wallHexOf(lib, fam, rowId)),
    roofStorey: riseM !== null && pv
      ? f<RowRoofStorey>({ kind: 'mansard', material: pv.material, dormersPerFront: pv.dormersPerFront, dormerKind: pv.dormerKind, ...(pv.hoist ? { hoist: true } : {}) },
        `pitched roof: 3DBAG rise ${bagRiseOf(s)} m >= ${lib.pitched!.minRiseM} m, drawn at ${lib.streetNotes?.[s.members[0]?.front.street ?? '']?.riseM !== undefined ? 'the street note\'s seen rise' : 'the district\'s seen-rise cap'} ${riseM} m${measuredRiseOf(lib, s) !== null ? ` (AHN4 front rise ${measuredRiseOf(lib, s)} m)` : ''} (${pv.evidence}); drawn as the row mansard at ${pv.pitchDeg} deg under buurtKit`)
      : f(d.roofStorey),
    extras: f(d.extras),
    windowShare: f(d.windowShare),
  };
  return design;
}

function familyFor(lib: DistrictLibrary, storeys: number): DistrictFamily | null {
  return lib.families.find(x => x.storeys === storeys) ?? null;
}

/** A generator row (rows.ts) as lane D's RowRecord, its series designed from the library; members off the library are cut out. */
export function rowRecordOf(lib: DistrictLibrary, row: GenRow, at: string, skipped: GenResult['skipped']): RowRecord[] {
  const out: RowRecord[] = [];
  // A series the library cannot design splits the row: each run of designed series is its own record.
  let members: RowMember[] = [], fronts: RowFront[] = [], series: RowSeries[] = [], readNotDrawn: ReadNotDrawn[] = [];
  const flush = () => {
    if (members.length >= 2) {
      const id = `${row.id}-${members[0].pandId.slice(-6)}`;
      out.push({ v: ROW_RECORD_VERSION, id, street: row.street, side: 'mixed', members, fronts, series, flags: [], readNotDrawn, overruled: [], inputs: [`src/canalRecall/buurtGenerator/districts/${lib.district}.json`, 'public/data/extracts/amsterdam/bag-tiles/14', 'public/data/extracts/amsterdam/streets-routing.json'], solvedAt: at,
        schemaLimits: fronts.flatMap(fr => lib.notDrawn.map((l): RowLimit => ({ front: fr.id, component: l.component, what: l.what, ref: `buurt-generator ${lib.district}` }))) });
    } else for (const m of members) skipped.push({ id: m.pandId, reason: 'single', detail: 'its designed run is one pand' });
    members = []; fronts = []; series = []; readNotDrawn = [];
  };
  for (const s of row.series) {
    const years = s.members.map(m => m.pand.year).filter((y): y is number => y !== null);
    const off = (reason: GenSkip, detail: string) => { flush(); for (const m of s.members) skipped.push({ id: pandNumber(m.pand.id), reason, detail }); };
    if (s.eavesM === null) { off('no-eaves', 'no 3DBAG eaves on the series'); continue; }
    if (!years.length || years.some(y => y < lib.years[0] || y > lib.years[1])) { off('off-years', `built ${[...new Set(years)].join('/') || '?'}`); continue; }
    const storeys = storeysFor(s.eavesM, lib.design), fam = familyFor(lib, storeys);
    if (!fam) { off('off-storeys', `${storeys} storeys at ${s.eavesM} m`); continue; }
    const widths = s.members.map(m => m.front.lengthM).sort((a, b) => a - b);
    const bays = baysFor(widths[widths.length >> 1], axisOf(lib, row.id));
    const seriesId = s.id;
    const design = seriesDesign(lib, fam, s, row.id, bays);
    series.push({ id: seriesId, label: `${fam.label}, built ${s.year ?? '?'}`, type: fam.id, fronts: s.members.map(m => pandNumber(m.pand.id)), design });
    for (const m of s.members) {
      const pid = pandNumber(m.pand.id);
      members.push({ pandId: pid, label: `${row.street} (${pid.slice(-6)})`, numbers: [], built: m.pand.year, widthM: m.front.lengthM, fronts: [pid] });
      fronts.push({ id: pid, pandId: pid, label: `${row.street} (${pid.slice(-6)})`, numbers: [], widthM: m.front.lengthM, seriesId, ground: { use: 'other' }, overrides: {}, groundOffsetM: 0, topM: s.eavesM });
      const e = m.pand.eavesM, r = m.pand.ridgeM;
      if (s.clamped.includes(m.pand.id) && e !== null) readNotDrawn.push({ front: pid, field: '3dbag-eaves', value: e, reason: `clamped to the series line ${s.eavesM} m (row coherence: a lone step over 0.8 m)` });
      const gate = lib.pitched ? pitchGate(lib, s) : null, drawn = pitchedRiseOf(lib, s);
      // Round 9: a street note that AHN4 contradicts still wins (the photo); the disagreement is logged per front.
      const noted = lib.streetNotes?.[row.street]?.roof, seen = measuredRoofOf(lib, s);
      if (noted && seen && noted !== seen) readNotDrawn.push({ front: pid, field: 'ahn-roof-form', value: lib.measured?.roofs?.[pid]?.form ?? seen, reason: `AHN4 reads the series ${seen}; the street note's ${noted} (the photo) wins` });
      if (e !== null && r !== null && drawn !== null && r - e > drawn + 0.3) readNotDrawn.push({ front: pid, field: '3dbag-roof-rise', value: +(r - e).toFixed(2), reason: `drawn at the seen rise ${drawn} m (${lib.streetNotes?.[row.street]?.riseM !== undefined ? 'street note' : 'district cap'}): the roof as the street sees it over the eaves` });
      if (e !== null && r !== null && r - e > 1 && pitchedRiseOf(lib, s) === null) readNotDrawn.push({ front: pid, field: '3dbag-roof-rise', value: +(r - e).toFixed(2), reason: gate ? `${gate}: flat top at the series line${lib.flatEaves ? ' under the broad eaves' : ''}` : `under the district's pitched-roof rise (${lib.pitched?.minRiseM ?? '-'} m series median): flat lid at the series line` });
    }
  }
  flush();
  return out;
}

/**
 * Round 10 (block coherence, David on Hunzestraat 120343: "one continuous long building with consistent roof line and
 * floors"). Adjacent series of one row from the same period (`BLOCK_YEARS`) whose 3DBAG lines step by more than
 * `ROW_EAVES_STEP_M` while AHN4 at the street front does not (each side's median front height, `measured.roofs[].eavesM`,
 * within the step of the other's) are one block: every series of the chain draws one line, the chain's series line
 * nearest its AHN front median. 3DBAG's eaves are a roof-surface percentile over the whole pand, so a low rear part drags
 * a front down: Hunzestraat 074339 and 111890 read 6.2 and 6.3 m (a 9.35 m, three-storey series) where AHN reads 12.14
 * and 12.17 m at the front, as do their 12 m neighbours. A step AHN confirms, or a side AHN does not read, stands.
 * Returns the rows and, per pand, the line it was clamped from.
 */
export const BLOCK_YEARS = 5;
/** Round 11: AHN4's flat front over 3DBAG's line by more than `minM` (63 flat series in both districts read a storey,
 *  > 2 m, over it; 137 agree within 0.8 m), on `share` of the members and at least `minReads`. */
export const AHN_RAISE = { minM: 1.5, share: 0.6, minReads: 2 } as const;
/** Round 11: the least AHN4 step kept as real between same-period series (blockLines realStep). */
export const REAL_STEP = { minM: 0.3 } as const;
export function blockLines(lib: DistrictLibrary, rows: readonly GenRow[]): { rows: GenRow[]; clamped: Map<string, { read: number; drawn: number; why: string }> } {
  const roofs = lib.measured?.roofs, clamped = new Map<string, { read: number; drawn: number; why: string }>();
  if (!roofs) return { rows: [...rows], clamped };
  // Round 11: only flat fronts' AHN heights are eaves; on a pitched or mansard front AHN's front height sits up the roof
  // face (Leonardostraat 077281: three storeys under tile at 9.9 m were lifted to AHN's 11.1 m and drawn as four).
  const readsOf = (sr: GenSeries) => sr.members.flatMap(m => { const r = roofs[pandNumber(m.pand.id)]; return r && r.form === 'flat' && typeof r.eavesM === 'number' && r.eavesM > 2 ? [r.eavesM] : []; });
  const frontOf = (sr: GenSeries) => median(readsOf(sr));
  return { rows: rows.map(row => {
    // Round 11 (Kuinderstraat 067158: five storeys under a deep eaves slab at ~16 m, drawn 4 at 13 m): a series AHN4
    // reads flat at the front a storey over its 3DBAG line, its members agreeing, draws AHN's line (AHN_RAISE).
    const S0 = row.series.map(sr => {
      const v = readsOf(sr), forms = sr.members.map(m => roofs[pandNumber(m.pand.id)]?.form), h = median(v);
      if (sr.eavesM === null || h === null || v.length < Math.max(AHN_RAISE.minReads, sr.members.length * AHN_RAISE.share) || forms.filter(f => f === 'flat').length < sr.members.length * AHN_RAISE.share) return sr;
      if (h - sr.eavesM <= AHN_RAISE.minM || Math.max(...v) - Math.min(...v) > ROW_EAVES_STEP_M) return sr;
      const line = Math.round(h * 20) / 20;
      if (!familyFor(lib, storeysFor(line, lib.design))) return sr; // the district designs no family that tall: keep the line
      for (const m of sr.members) clamped.set(pandNumber(m.pand.id), { read: sr.eavesM, drawn: line, why: `AHN4 reads the flat front at ${h.toFixed(2)} m on ${v.length} of ${sr.members.length} members (spread ${(Math.max(...v) - Math.min(...v)).toFixed(2)} m), ${(h - sr.eavesM).toFixed(2)} m over 3DBAG's ${sr.eavesM} m line, blockLines AHN_RAISE` });
      return { ...sr, eavesM: line, clamped: sr.members.map(m => m.pand.id) };
    });
    // A raised line within the step of a same-period neighbour's (unraised) line is that line: one eaves (Hunzestraat
    // 074339/111890: AHN 12.15 m beside the block's 12 m).
    const S = S0.map((sr, k) => {
      if (sr === row.series[k] || sr.eavesM === null) return sr;
      const nb = [S0[k - 1], S0[k + 1]].find(n => n && n === row.series[S0.indexOf(n)] && n.eavesM !== null && Math.abs(n.eavesM - sr.eavesM!) <= ROW_EAVES_STEP_M && n.year !== null && sr.year !== null && Math.abs(n.year - sr.year) <= BLOCK_YEARS);
      if (!nb) return sr;
      for (const m of sr.members) { const c = clamped.get(pandNumber(m.pand.id)); if (c) clamped.set(pandNumber(m.pand.id), { ...c, drawn: nb.eavesM!, why: `${c.why}; at the neighbour series' ${nb.eavesM} m line (one eaves)` }); }
      return { ...sr, eavesM: nb.eavesM };
    });
    const ahn = S.map(frontOf);
    // Round 11 (Pieter Lastmankade 115143: a real parapet step hidden): a small AHN step that agrees with 3DBAG's in sign,
    // at least REAL_STEP.minM, every read of the higher series over the lower's median, is a step, not an outlier.
    const realStep = (a: GenSeries, b: GenSeries) => {
      const va = readsOf(a), vb = readsOf(b), ma = median(va), mb = median(vb);
      if (ma === null || mb === null || a.eavesM === null || b.eavesM === null || Math.sign(mb - ma) !== Math.sign(b.eavesM - a.eavesM) || Math.abs(mb - ma) < REAL_STEP.minM) return false;
      return mb > ma ? vb.every(x => x > ma) : va.every(x => x > mb);
    };
    const joins = S.map((sr, k) => {
      if (k === 0) return false;
      const a = S[k - 1], la = a.eavesM, lb = sr.eavesM, ha = ahn[k - 1], hb = ahn[k];
      return la !== null && lb !== null && Math.abs(la - lb) > ROW_EAVES_STEP_M && a.year !== null && sr.year !== null && Math.abs(a.year - sr.year) <= BLOCK_YEARS
        && ha !== null && hb !== null && Math.abs(ha - hb) <= ROW_EAVES_STEP_M && !realStep(a, sr);
    });
    const raised = S.some((sr, k) => sr !== row.series[k]);
    if (!joins.some(Boolean)) return raised ? { ...row, series: S } : row;
    const out = [...S];
    for (let k0 = 0; k0 < S.length;) {
      let k1 = k0; while (k1 + 1 < S.length && joins[k1 + 1]) k1++;
      if (k1 > k0) {
        const chain = S.slice(k0, k1 + 1), h = median(chain.flatMap(sr => { const v = frontOf(sr); return v === null ? [] : sr.members.map(() => v); }))!;
        const line = chain.map(sr => sr.eavesM!).sort((x, y) => Math.abs(x - h) - Math.abs(y - h))[0];
        for (let k = k0; k <= k1; k++) if (S[k].eavesM !== line) {
          for (const m of S[k].members) clamped.set(pandNumber(m.pand.id), { read: S[k].eavesM!, drawn: line, why: `one block with its neighbours: AHN4 reads the fronts at ${h.toFixed(2)} m on both sides of the 3DBAG step (${S[k].eavesM} m against ${line} m), blockLines` });
          out[k] = { ...S[k], eavesM: line, clamped: S[k].members.map(m => m.pand.id) };
        }
      }
      k0 = k1 + 1;
    }
    return { ...row, series: out };
  }), clamped };
}

/**
 * The district: rows from the undescribed pands (`described` ids never enter a row; they only break one), each series
 * designed from the library. `records` are the renderer's front records (`ROW_FRONT_RECORDS`, `{records}` shape).
 */
export function generateDistrict(lib: DistrictLibrary, pands: readonly GenPand[], streets: readonly GenStreet[], described: ReadonlySet<string>, at: string): GenResult {
  const skipped: GenResult['skipped'] = [];
  const free = pands.filter(p => { const d = described.has(pandNumber(p.id)); if (d) skipped.push({ id: pandNumber(p.id), reason: 'described' }); return !d; });
  const resD: RowsResult = districtRows(free, streets), block = blockLines(lib, resD.rows);
  const res0: RowsResult = { ...resD, rows: block.rows }, eavesOverruled = block.clamped;
  // A row whose photo measures its line (row note `topM`) draws every series at it.
  const res: RowsResult = { ...res0, rows: res0.rows.map(r => { const t = lib.rowNotes?.[r.id]?.topM; return t ? { ...r, series: r.series.map(s => ({ ...s, eavesM: t, clamped: [] })) } : r; }) };
  for (const u of res.unplaced) skipped.push({ id: pandNumber(u.id), reason: u.reason });
  const rows = res.rows.flatMap(r => rowRecordOf(lib, r, at, skipped)).map(rec => {
    const ov: Overruled[] = rec.members.flatMap(m => { const o = eavesOverruled.get(m.pandId); return o ? [{ front: m.pandId, field: 'corniceTopM', read: o.read, drawn: o.drawn, by: 'series-consensus' as const, why: o.why }] : []; });
    return ov.length ? { ...rec, overruled: [...rec.overruled, ...ov] } : rec;
  });
  const drawn = new Set(rows.flatMap(r => r.members.map(m => m.pandId)));
  const fronts: GenResult['fronts'] = {};
  const kits = new Map<string, BuurtKitFront>();
  for (const r of res.rows) for (const s of r.series) {
    const rise = pitchedRiseOf(lib, s);
    const fam = s.eavesM === null ? null : familyFor(lib, storeysFor(s.eavesM, lib.design));
    const widths = s.members.map(m => m.front.lengthM).sort((a, b) => a - b), bays = baysFor(widths[widths.length >> 1], axisOf(lib, r.id));
    const pv = pitchedVariantOf(lib, s), roofHex = lib.rowNotes?.[r.id]?.roof?.hex ?? pv?.roofHex;
    // Blocks of two pands (family kit `piers`): the pier at every other party wall, phased by the row's photo if one
    // states it, else a block starting at the row's first member.
    const note = lib.rowNotes?.[r.id], phase = note?.pierPhase ?? 1, pierAfter = (j: number) => ((j - phase) % 2 + 2) % 2 === 0;
    // Erker bands: the street's photo says so (round 5), or the row's panoramas read its erkers white (round 10: the
    // judges' "white wrap-around oriels", Kuinderstraat 067158 reads 0.45-0.56 white over the wall's 0.20-0.23).
    const mErk = lib.measured?.erkers?.[r.id], whiteErker = (pid: string) => !!mErk && Object.entries(mErk).some(([k, v]) => k.startsWith(`${pid}:`) && v.finish === 'white');
    const bands = !!lib.streetNotes?.[r.street]?.erkerBands, coping = wallHexOf(lib, fam, r.id).hex;
    // Round 12: a timber note dresses the row's erkers; a row note's own erkers replace BAG's on that member.
    const timber = (note?.erkerFront ?? lib.streetNotes?.[r.street]?.erkerFront) === 'timber';
    const erkersFor = (pid: string, bag: BuurtErker[]): BuurtErker[] => {
      const own = note?.erkers?.[pid.slice(-6)], list = own ? own.map(x => ({ ...x })) : bag;
      return timber ? list.map(x => x.front ? x : { ...x, front: 'timber' as const }) : list;
    };
    const ents = note?.entries ?? [], entryAt = (i: number): BuurtEntry | null => ents.length ? { ...ents[i % ents.length], cells: bays } : null;
    // Round 10: the flat series' coping is the series', not the member's: when any drawn member hangs something on its
    // front (ribbon, erkers, eaves, entrance), every member draws it, so the roof line runs through (David on
    // Hunzestraat: the erker members' coping stood 0.55 m over their neighbours').
    // Round 13: the row note's eaves slab, attic band and raised parts (lane R's kit), validated by the kit's own readers.
    const noteEaves = note?.eaves ? kitEavesOf({ overhangM: note.eaves.overhangM ?? lib.flatEaves?.eavesM ?? 0.6, frieze: note.eaves.frieze ?? lib.flatEaves?.frieze, fasciaM: note.eaves.fasciaM, lid: note.eaves.lid }) : null;
    const attic = note?.attic ? kitAtticOf(note.attic) : null, raisedFor = (pid: string) => raisedOf(note?.raised?.[pid.slice(-6)]);
    const seriesCoping = s.members.some(mm => drawn.has(pandNumber(mm.pand.id)) && (fam?.kit?.ribbon || mm.front.erkers.length || note?.erkers?.[pandNumber(mm.pand.id).slice(-6)]?.length || lib.flatEaves || noteEaves || attic || raisedFor(pandNumber(mm.pand.id)).length || entryAt(r.members.indexOf(mm))));
    for (const m of s.members) {
      const pid = pandNumber(m.pand.id);
      if (!drawn.has(pid)) continue;
      fronts[pid] = { street: m.front.street, a: m.front.aLngLat, b: m.front.bLngLat, lengthM: +m.front.lengthM.toFixed(2) };
      const r6 = (q: readonly [number, number]): [number, number] => [+q[0].toFixed(8), +q[1].toFixed(8)];
      const i = r.members.indexOf(m), joins = { ...(i > 0 && drawn.has(pandNumber(r.members[i - 1].pand.id)) ? { left: true } : {}), ...(i < r.members.length - 1 && drawn.has(pandNumber(r.members[i + 1].pand.id)) ? { right: true } : {}) };
      // Erkers on the series' cells (frontKit.ts erkersOnCells): the series draws `bays` cells on every member.
      const erkers = erkersFor(pid, erkersOnCells(m.front.erkers, bays, m.front.lengthM, fam?.design?.windowShare ?? lib.design.windowShare));
      kits.set(pid, { frontLine: [r6(m.front.lineA), r6(m.front.lineB)], erkers,
        ...(rise !== null && pv ? { roof: { pitchDeg: pv.pitchDeg, riseM: rise, ...(roofHex ? { roofHex } : {}), ...(pv.dormersPerFront === 0 ? { dormers: false as const } : {}), ...(pv.eavesM ? { eavesM: pv.eavesM, ...(pv.eavesFrieze === false ? { eavesFrieze: false as const } : {}) } : {}) } } : {}),
        ...(fam?.kit?.rhythm ? { rhythm: true as const } : {}),
        ...(fam?.kit?.piers && (joins.left || joins.right) ? { sides: { ...(joins.left ? { left: pierAfter(i - 1) ? 'pier' as const : 'pair' as const } : {}), ...(joins.right ? { right: pierAfter(i) ? 'pier' as const : 'pair' as const } : {}) } } : {}),
        ...(fam?.kit?.sash ? { sash: fam.kit.sash.value } : {}), ...(fam?.kit?.ribbon && !(rise === null && attic) ? { ribbon: true as const } : {}),
        ...(rise === null && attic ? { attic } : {}), ...(rise === null && raisedFor(pid).length ? { raised: raisedFor(pid) } : {}),
        ...((bands || whiteErker(pid)) && (m.front.erkers.length || note?.erkers?.[pid.slice(-6)]?.length) ? { erkerBands: true as const } : {}), ...(note?.loggias?.includes(pid.slice(-6)) ? { loggias: true as const } : {}),
        ...(rise === null && seriesCoping && coping ? { copingHex: coping } : {}),
        ...(rise === null && noteEaves ? { eaves: noteEaves } : rise === null && lib.flatEaves ? { eaves: { overhangM: lib.flatEaves.eavesM, ...(lib.flatEaves.frieze === false ? { frieze: false as const } : {}) } } : {}),
        ...(entryAt(i) ? { entries: [entryAt(i)!] } : {}),
        ...(joins.left || joins.right ? { joins } : {}) });
    }
  }
  const families: GenResult['families'] = {};
  for (const r of rows) for (const s of r.series) { const f = families[s.type!] ??= { series: 0, pands: 0 }; f.series++; f.pands += s.fronts.length; }
  const records = rows.flatMap(r => rowFrontsWithSeries(r)).map(rec => kits.has(rec.pandId) ? { ...rec, buurtKit: kits.get(rec.pandId)! } : rec);
  return { rows, records, skipped, families, fronts };
}
