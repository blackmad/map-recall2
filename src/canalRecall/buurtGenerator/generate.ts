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
import { ROW_RECORD_VERSION, type ReadNotDrawn, type RowCorniceKind, type RowCrownKind, type RowDesign, type RowField, type RowFront, type RowHeads, type RowLimit, type RowMember, type RowRecord, type RowRoofStorey, type RowSeries, type RowWallMaterial, type RowWindowKind } from '../houseSpec/row/types.ts';
import { districtRows, type GenPand, type GenRow, type GenSeries, type GenStreet, type RowsResult } from './rows.ts';
import { erkersOnCells, type BuurtKitFront } from './kit/frontKit.ts';

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
  /** The orthophoto roof slots (roof-facts) this variant draws for, by the series' majority reading. */
  slots?: string[];
  /** Broad flat eaves over the street front, this overhang (m). */
  eavesM?: number }
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
  /** A second pitched variant (round 4): a series whose orthophoto roof is one of its `slots` draws it instead. */
  pitchedEaves?: DistrictPitchedRoof;
  /** Per row (generator row id), what a photo of it states: `pierPhase` 0 puts the first pier after the row's first
   *  member, 1 (the default: a block starts at the row's first member) after its second. */
  rowNotes?: Record<string, { pierPhase: 0 | 1; evidence: string }>;
  notDrawn: Array<{ component: string; what: string }>;
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
  const slot = seriesSlot(s);
  return lib.pitchedEaves && slot && lib.pitchedEaves.slots?.includes(slot) ? lib.pitchedEaves : lib.pitched;
}
/** A series' roof rise (median 3DBAG ridge - eaves of its members, m), when the district's pitched roof applies to it; else null. */
export function pitchedRiseOf(lib: DistrictLibrary, s: GenSeries): number | null {
  if (!lib.pitched) return null;
  const rise = median(s.members.flatMap(m => m.pand.eavesM !== null && m.pand.ridgeM !== null ? [m.pand.ridgeM - m.pand.eavesM] : []));
  return rise !== null && rise >= lib.pitched.minRiseM ? +Math.min(lib.pitched.maxRiseM, rise).toFixed(2) : null;
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
    wall: f({ material: d.wall.material, family: d.wall.family, hex: d.wall.hex ?? variedTone(d.wall.family, `${rowId}:${d.wall.family}`) }, d.wall.hex ? `measured brick ${d.wall.hex} (${d.wall.evidence ?? 'district photos'})` : ''),
    roofStorey: riseM !== null && pv
      ? f<RowRoofStorey>({ kind: 'mansard', material: pv.material, dormersPerFront: pv.dormersPerFront, dormerKind: pv.dormerKind, ...(pv.hoist ? { hoist: true } : {}) },
        `pitched roof: median 3DBAG rise ${riseM} m >= ${lib.pitched!.minRiseM} m (${pv.evidence}); drawn as the row mansard at ${pv.pitchDeg} deg under buurtKit`)
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
    const bays = baysFor(widths[widths.length >> 1], lib.design);
    const seriesId = s.id;
    const design = seriesDesign(lib, fam, s, row.id, bays);
    series.push({ id: seriesId, label: `${fam.label}, built ${s.year ?? '?'}`, type: fam.id, fronts: s.members.map(m => pandNumber(m.pand.id)), design });
    for (const m of s.members) {
      const pid = pandNumber(m.pand.id);
      members.push({ pandId: pid, label: `${row.street} (${pid.slice(-6)})`, numbers: [], built: m.pand.year, widthM: m.front.lengthM, fronts: [pid] });
      fronts.push({ id: pid, pandId: pid, label: `${row.street} (${pid.slice(-6)})`, numbers: [], widthM: m.front.lengthM, seriesId, ground: { use: 'other' }, overrides: {}, groundOffsetM: 0, topM: s.eavesM });
      const e = m.pand.eavesM, r = m.pand.ridgeM;
      if (s.clamped.includes(m.pand.id) && e !== null) readNotDrawn.push({ front: pid, field: '3dbag-eaves', value: e, reason: `clamped to the series line ${s.eavesM} m (row coherence: a lone step over 0.8 m)` });
      if (e !== null && r !== null && r - e > 1 && pitchedRiseOf(lib, s) === null) readNotDrawn.push({ front: pid, field: '3dbag-roof-rise', value: +(r - e).toFixed(2), reason: `under the district's pitched-roof rise (${lib.pitched?.minRiseM ?? '-'} m series median): flat lid at the series line` });
    }
  }
  flush();
  return out;
}

/**
 * The district: rows from the undescribed pands (`described` ids never enter a row; they only break one), each series
 * designed from the library. `records` are the renderer's front records (`ROW_FRONT_RECORDS`, `{records}` shape).
 */
export function generateDistrict(lib: DistrictLibrary, pands: readonly GenPand[], streets: readonly GenStreet[], described: ReadonlySet<string>, at: string): GenResult {
  const skipped: GenResult['skipped'] = [];
  const free = pands.filter(p => { const d = described.has(pandNumber(p.id)); if (d) skipped.push({ id: pandNumber(p.id), reason: 'described' }); return !d; });
  const res: RowsResult = districtRows(free, streets);
  for (const u of res.unplaced) skipped.push({ id: pandNumber(u.id), reason: u.reason });
  const rows = res.rows.flatMap(r => rowRecordOf(lib, r, at, skipped));
  const drawn = new Set(rows.flatMap(r => r.members.map(m => m.pandId)));
  const fronts: GenResult['fronts'] = {};
  const kits = new Map<string, BuurtKitFront>();
  for (const r of res.rows) for (const s of r.series) {
    const rise = pitchedRiseOf(lib, s);
    const fam = s.eavesM === null ? null : familyFor(lib, storeysFor(s.eavesM, lib.design));
    const widths = s.members.map(m => m.front.lengthM).sort((a, b) => a - b), bays = baysFor(widths[widths.length >> 1], lib.design);
    const pv = pitchedVariantOf(lib, s), roofHex = pv?.roofHex;
    // Blocks of two pands (family kit `piers`): the pier at every other party wall, phased by the row's photo if one
    // states it, else a block starting at the row's first member.
    const phase = lib.rowNotes?.[r.id]?.pierPhase ?? 1, pierAfter = (j: number) => ((j - phase) % 2 + 2) % 2 === 0;
    for (const m of s.members) {
      const pid = pandNumber(m.pand.id);
      if (!drawn.has(pid)) continue;
      fronts[pid] = { street: m.front.street, a: m.front.aLngLat, b: m.front.bLngLat, lengthM: +m.front.lengthM.toFixed(2) };
      const r6 = (q: readonly [number, number]): [number, number] => [+q[0].toFixed(8), +q[1].toFixed(8)];
      const i = r.members.indexOf(m), joins = { ...(i > 0 && drawn.has(pandNumber(r.members[i - 1].pand.id)) ? { left: true } : {}), ...(i < r.members.length - 1 && drawn.has(pandNumber(r.members[i + 1].pand.id)) ? { right: true } : {}) };
      // Erkers on the series' cells (frontKit.ts erkersOnCells): the series draws `bays` cells on every member.
      kits.set(pid, { frontLine: [r6(m.front.lineA), r6(m.front.lineB)], erkers: erkersOnCells(m.front.erkers, bays, m.front.lengthM),
        ...(rise !== null && pv ? { roof: { pitchDeg: pv.pitchDeg, riseM: rise, ...(roofHex ? { roofHex } : {}), ...(pv.dormersPerFront === 0 ? { dormers: false as const } : {}), ...(pv.eavesM ? { eavesM: pv.eavesM } : {}) } } : {}),
        ...(fam?.kit?.rhythm ? { rhythm: true as const } : {}),
        ...(fam?.kit?.piers && (joins.left || joins.right) ? { sides: { ...(joins.left ? { left: pierAfter(i - 1) ? 'pier' as const : 'pair' as const } : {}), ...(joins.right ? { right: pierAfter(i) ? 'pier' as const : 'pair' as const } : {}) } } : {}),
        ...(fam?.kit?.sash ? { sash: fam.kit.sash.value } : {}), ...(fam?.kit?.ribbon ? { ribbon: true as const } : {}),
        ...(rise === null && (fam?.kit?.ribbon || m.front.erkers.length) && (fam?.design?.wall?.hex ?? lib.design.wall.hex) ? { copingHex: fam?.design?.wall?.hex ?? lib.design.wall.hex } : {}),
        ...(joins.left || joins.right ? { joins } : {}) });
    }
  }
  const families: GenResult['families'] = {};
  for (const r of rows) for (const s of r.series) { const f = families[s.type!] ??= { series: 0, pands: 0 }; f.series++; f.pands += s.fronts.length; }
  const records = rows.flatMap(r => rowFrontsWithSeries(r)).map(rec => kits.has(rec.pandId) ? { ...rec, buurtKit: kits.get(rec.pandId)! } : rec);
  return { rows, records, skipped, families, fronts };
}
