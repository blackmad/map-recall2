/**
 * Belt look generator (lane D, 2026-11-15): every undescribed canal-belt pand as a house-rows front. The street-side rows
 * and their front lines are the buurt generator's (`buurtGenerator/rows.ts`: party-wall rows on one front street, from BAG
 * footprints and OSM names; a lone pand between described ones is a one-member row); each member takes its own D1 read when the belt tranche read it, else its donor's read fitted
 * to it (`donors.ts`); the row is then solved by lane D's row solve as any belt row is (series, the belt gable rises and
 * dress, the 3DBAG ridge, canal windows), so the belt kit (BELT_GABLE outlines, lane R's stone and stoops) draws them; a
 * 1700s neck or bell series then takes the period's gable stone (carved claws, dark hood, neck carving: `stone.ts`), an
 * 1800s cornice series a painted timber cornice (`cornice.ts`). A member's year is the register's facade year when stated.
 *
 * Provenance: a field the solve takes from a donor's read is not a read of this house. Every such field is relabelled
 * `period-default` with a ref naming the belt look and the donor, so the spec emit and `check:rows` never mistake it for a
 * reading. A pand's own read keeps its sources. Described pands (published specs and records, models, building types, the
 * lane D rows) never enter a row: they only break one, and their records stay on top. Pure: no fs, no DOM.
 */
import type { DescriberAnswer } from '../houseSpec/describer.ts';
import { solveRow, type MemberInput, type RowInput } from '../houseSpec/row/solve.ts';
import type { RowDesign, RowField, RowRecord } from '../houseSpec/row/types.ts';
import { districtRows, type GenPand, type GenRow, type GenStreet } from '../buurtGenerator/rows.ts';
import { donorFor, fittedRead, frontTopM, gableable, type BeltDonor, type BeltTarget } from './donors.ts';
import { dressBeltStone } from './stone.ts';
import { dressBeltCornice } from './cornice.ts';

export interface BeltRead { answer: DescriberAnswer; sample?: string; ref: string }
/** What a published source states for a pand (the monument register via house-specs): its crown and facade year. */
export interface BeltStated { crown?: string; year?: number; shop?: boolean }
export interface BeltGenResult {
  rows: RowRecord[];
  /** Per drawn pand, where its design came from. */
  provenance: Record<string, { own: true; ref: string } | { donor: string; distance: number; rank: number; of: number }>;
  skipped: Array<{ id: string; reason: 'described' | 'no-front' | 'single' | 'minor' | 'no-donor' }>;
  fronts: Record<string, { street: string; a: readonly [number, number]; b: readonly [number, number]; lengthM: number }>;
}

const pandNumber = (id: string) => id.replace(/^NL\.IMBAG\.Pand\./, '');
export const BELT_LOOK_REF = 'belt look (lane D 2026-11-15, src/canalRecall/beltLook)';

/** A generator row as a row-solve input: own reads where read, donors' fitted reads elsewhere. */
export function beltRowInput(row: GenRow, reads: ReadonlyMap<string, BeltRead>, donors: readonly BeltDonor[], at: string, prov: BeltGenResult['provenance'], stated: ReadonlyMap<string, BeltStated> = new Map()): RowInput | null {
  const members: MemberInput[] = [];
  for (const m of row.members) {
    // The front's top (frontTopM: 3DBAG's eaves is often a rear eave under the street cornice).
    const pid = pandNumber(m.pand.id), eaves = frontTopM(m.pand.eavesM, m.pand.heightM, m.pand.ridgeM), ridge = m.pand.ridgeM;
    const sd = stated.get(pid);
    const t: BeltTarget = { pandId: pid, street: row.street, year: sd?.year ?? m.pand.year, widthM: m.front.lengthM, eavesM: eaves, ridgeM: ridge, roofCode: m.pand.roofCode ?? null, ...(sd?.crown ? { statedCrown: sd.crown } : {}), ...(sd?.shop ? { shop: true } : {}) };
    const own = reads.get(pid);
    let read: DescriberAnswer, sample: string | undefined, readRef: string;
    if (own) { read = own.answer; sample = own.sample; readRef = own.ref; prov[pid] = { own: true, ref: own.ref }; }
    else {
      const d = donorFor(t, donors);
      if (!d) return null;
      read = fittedRead(t, d.donor); sample = d.donor.sample; readRef = `${BELT_LOOK_REF}: donor ${d.donor.pandId}`;
      prov[pid] = { donor: d.donor.pandId, distance: d.distance, rank: d.rank, of: d.of };
    }
    members.push({ pandId: pid, label: `${row.street} (${pid.slice(-6)})`, numbers: [], built: t.year, widthM: +m.front.lengthM.toFixed(2),
      eaves3dbag: eaves, height3dbag: eaves, ...(ridge !== null && gableable(t) ? { ridge3dbag: +ridge.toFixed(2) } : {}),
      read, readRef, ...(sample ? { wallSample: sample } : {}) });
  }
  return { id: `belt-${row.id}`, canalWindows: true, street: row.street, side: 'mixed', members, inputs: [BELT_LOOK_REF, 'public/data/extracts/amsterdam/bag-tiles/14', 'public/data/extracts/amsterdam/streets-routing.json'], solvedAt: at };
}

/** A field the solve drew from a donor (its ref cites a donor-filled member) becomes `period-default` under the belt look. */
export function relabelDonorFields(row: RowRecord, donorFilled: ReadonlySet<string>): RowRecord {
  const cites = (ref: string | undefined) => !!ref && [...donorFilled].some(id => ref.includes(id));
  const fix = (f: RowField<unknown> | undefined, onlyDonors: boolean) => {
    if (!f || f.source === 'reviewed' || f.source === 'period-default') return;
    if (onlyDonors || cites(f.ref)) { f.source = 'period-default'; f.ref = `${BELT_LOOK_REF}: ${f.ref ?? ''}`; }
  };
  for (const s of row.series) {
    const only = s.fronts.every(id => donorFilled.has(id.split('#')[0]));
    for (const v of Object.values(s.design as unknown as Record<string, RowField<unknown> | undefined>)) fix(v, only);
  }
  for (const f of row.fronts) {
    const only = donorFilled.has(f.pandId);
    for (const v of Object.values((f.overrides ?? {}) as Partial<Record<keyof RowDesign, RowField<unknown>>>)) fix(v, only);
    for (const v of Object.values(f.ground ?? {})) if (v && typeof v === 'object' && 'source' in (v as object)) fix(v as RowField<unknown>, only);
  }
  return row;
}

/**
 * The belt: rows from the undescribed pands, each solved as a belt row. `reads` are the belt tranche's own reads (pand ->
 * read); `donors` the usable reads the look draws from.
 */
export function generateBelt(pands: readonly GenPand[], streets: readonly GenStreet[], described: ReadonlySet<string>, reads: ReadonlyMap<string, BeltRead>, donors: readonly BeltDonor[], at: string, stated: ReadonlyMap<string, BeltStated> = new Map()): BeltGenResult {
  const skipped: BeltGenResult['skipped'] = [], provenance: BeltGenResult['provenance'] = {}, fronts: BeltGenResult['fronts'] = {};
  const free = pands.filter(p => { const d = described.has(pandNumber(p.id)); if (d) skipped.push({ id: pandNumber(p.id), reason: 'described' }); return !d; });
  const res = districtRows(free, streets, { singles: true });
  for (const u of res.unplaced) skipped.push({ id: pandNumber(u.id), reason: u.reason });
  const rows: RowRecord[] = [];
  for (const r of res.rows) {
    const input = beltRowInput(r, reads, donors, at, provenance, stated);
    if (!input) { for (const m of r.members) skipped.push({ id: pandNumber(m.pand.id), reason: 'no-donor' }); continue; }
    const donorFilled = new Set(input.members.filter(m => 'donor' in provenance[m.pandId]).map(m => m.pandId));
    rows.push(dressBeltCornice(dressBeltStone(relabelDonorFields(solveRow(input), donorFilled), BELT_LOOK_REF), BELT_LOOK_REF));
    for (const m of r.members) fronts[pandNumber(m.pand.id)] = { street: m.front.street, a: m.front.aLngLat, b: m.front.bLngLat, lengthM: +m.front.lengthM.toFixed(2) };
  }
  return { rows, provenance, skipped, fronts };
}
