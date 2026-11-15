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
import { donorFor, fittedRead, frontTopM, gableable, GABLED_CROWNS, stripRoofStorey, type BeltDonor, type BeltTarget } from './donors.ts';
import { MANSARD_RISE } from '../houseLine/rowFront.ts';
import type { RowGable } from '../houseSpec/row/types.ts';
import { dressBeltStone } from './stone.ts';
import { dressBeltCornice } from './cornice.ts';
import { brickFromSample, lchOf } from '../houseSpec/judgedColour.ts';

export interface BeltRead { answer: DescriberAnswer; sample?: string; ref: string }
/** What a published source states for a pand (the monument register via house-specs): its crown and facade year. */
export interface BeltStated { crown?: string; year?: number; shop?: boolean; finish?: BeltTarget['finish']; storeys?: number; stoop?: boolean; roofStorey?: boolean; warehouse?: boolean; elements?: string[] }
export interface BeltGenResult {
  rows: RowRecord[];
  /** Per drawn pand, where its design came from. */
  provenance: Record<string, { own: true; ref: string } | { donor: string; distance: number; rank: number; of: number }>;
  skipped: Array<{ id: string; reason: 'described' | 'no-front' | 'single' | 'minor' | 'no-donor' }>;
  fronts: Record<string, { street: string; a: readonly [number, number]; b: readonly [number, number]; lengthM: number }>;
}

/** The donor's measured wall when it is a brick colour to lend: a plain brick front, its sample not a buff brick. */
export function brickDonorSample(d: Pick<BeltDonor, 'answer' | 'sample'>): string | undefined {
  const a = d.answer as { finish?: string; pale?: boolean };
  if (!d.sample || a.finish !== 'brick' || a.pale) return undefined;
  return brickFromSample(lchOf(d.sample)) === 'buff-brick' ? undefined : d.sample;
}

const pandNumber = (id: string) => id.replace(/^NL\.IMBAG\.Pand\./, '');
/**
 * A front's wall top over the street: a gabled front stands at the front top (its gable rises to the ridge); a cornice
 * front at 3DBAG's representative height, or, under a roof storey (stated, or its own read's mansard), that height less
 * the kit's mansard rise, never under the eaves (held-out round 5: Molenpad 174768, a cornice front with a register dormer,
 * stood at 14.1 m with a mansard on top against about 10 m in the photo).
 */
export function corniceLine(read: { crown?: unknown; storeyParts?: { roof?: unknown } }, t: Pick<BeltTarget, 'heightM' | 'roofStorey'>, eaves: number | null, rawEaves: number | null = eaves): number | null {
  if (GABLED_CROWNS.has(String(read.crown)) || t.heightM == null || eaves === null) return eaves;
  const roof = t.roofStorey || read.crown === 'mansard' || read.storeyParts?.roof === 'mansard' || read.storeyParts?.roof === 'attic' || read.storeyParts?.roof === 'dormers';
  // Under a roof storey the front top (frontTopM, which lifts a low 3DBAG eave to the height) is the height less the
  // mansard, never under 3DBAG's own eaves.
  if (roof) return +Math.max(rawEaves ?? eaves, Math.min(eaves, t.heightM - MANSARD_RISE.period)).toFixed(2);
  return t.heightM > eaves ? +t.heightM.toFixed(2) : eaves;
}
/** A register-stated roof storey over a donor read with none: one plain dormer in a roof storey (the register's dakkapel). */
export function statedDormer(a: DescriberAnswer): DescriberAnswer {
  const ar = a as { storeyParts?: { roof?: string }; dormers?: unknown; crown?: string };
  if (GABLED_CROWNS.has(String(ar.crown)) || (ar.dormers && typeof ar.dormers === 'object' && (ar.dormers as { count?: number }).count)) return a;
  if (ar.storeyParts?.roof === 'mansard' || ar.storeyParts?.roof === 'attic') return a;
  ar.dormers = { count: 1, kind: 'plain' };
  if (ar.storeyParts) ar.storeyParts.roof = 'dormers';
  return a;
}
export const BELT_LOOK_REF = 'belt look (lane D 2026-11-15, src/canalRecall/beltLook)';

/** A generator row as a row-solve input: own reads where read, donors' fitted reads elsewhere. */
export function beltRowInput(row: GenRow, reads: ReadonlyMap<string, BeltRead>, donors: readonly BeltDonor[], at: string, prov: BeltGenResult['provenance'], stated: ReadonlyMap<string, BeltStated> = new Map()): RowInput | null {
  const members: MemberInput[] = [];
  for (const m of row.members) {
    // The front's top (frontTopM: 3DBAG's eaves is often a rear eave under the street cornice).
    const pid = pandNumber(m.pand.id), eaves = frontTopM(m.pand.eavesM, m.pand.heightM, m.pand.ridgeM), ridge = m.pand.ridgeM;
    const sd = stated.get(pid);
    const t: BeltTarget = { pandId: pid, street: row.street, year: sd?.year ?? m.pand.year, widthM: m.front.lengthM, eavesM: eaves, ridgeM: ridge, roofCode: m.pand.roofCode ?? null, heightM: m.pand.heightM ?? null,
      ...(sd?.crown ? { statedCrown: sd.crown } : {}), ...(sd?.shop ? { shop: true } : {}), ...(sd?.finish ? { finish: sd.finish } : {}), ...(sd?.storeys ? { storeys: sd.storeys } : {}), ...(sd?.stoop ? { stoop: true } : {}), ...(sd?.roofStorey ? { roofStorey: true } : {}), ...(sd?.warehouse ? { warehouse: true } : {}), ...(sd?.elements?.length ? { elements: sd.elements } : {}) };
    const own = reads.get(pid);
    let read: DescriberAnswer, sample: string | undefined, readRef: string;
    // A pand's own read keeps a roof storey it saw as one (a mansard or attic roof part); dormers read over a cornice with
    // the roof part unseen, none or only dormers are not a mansard front unless the register states one (held-out round 5:
    // Keizersgracht 176027-176028 and 165044 drew whole slate mansards from one dormer each).
    if (own) { read = t.roofStorey ? own.answer : stripRoofStorey(structuredClone(own.answer), true); sample = own.sample; readRef = own.ref; prov[pid] = { own: true, ref: own.ref }; }
    else {
      const d = donorFor(t, donors);
      if (!d) return null;
      // A cornice front stands at 3DBAG's representative height (its storeys fitted to it); a gable's foot stays at the
      // front top, the gable rising to the ridge.
      const corniceTop = !GABLED_CROWNS.has(String(t.statedCrown ?? d.donor.answer.crown)) && t.heightM != null && eaves !== null ? corniceLine({ crown: 'cornice' }, t, eaves, m.pand.eavesM) : null;
      read = fittedRead(corniceTop !== null ? { ...t, eavesM: corniceTop } : t, d.donor);
      if (t.roofStorey) read = statedDormer(read);
      readRef = `${BELT_LOOK_REF}: donor ${d.donor.pandId}`;
      // A stated plaster or stone front is judged pale from its finish, not the donor's brick sample.
      // A donor's sample is a brick colour only when the donor is a brick front and the sample is not a buff (tan) brick;
      // otherwise the solve takes the neighbours' family (round 4: tan and pale fronts over dark brick rows).
      sample = t.finish === 'plaster' || t.finish === 'stone' ? undefined : brickDonorSample(d.donor);
      prov[pid] = { donor: d.donor.pandId, distance: d.distance, rank: d.rank, of: d.of };
    }
    const top = corniceLine(read, t, eaves, m.pand.eavesM);
    members.push({ pandId: pid, label: `${row.street} (${pid.slice(-6)})`, numbers: [], built: t.year, widthM: +m.front.lengthM.toFixed(2),
      eaves3dbag: top, height3dbag: top, ...(ridge !== null && gableable(t) ? { ridge3dbag: +ridge.toFixed(2) } : {}),
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
    const elements = new Map(input.members.map(m => [m.pandId, stated.get(m.pandId)?.elements ?? []]));
    const dressed = dressBeltCornice(dressBeltStone(relabelDonorFields(solveRow(input), donorFilled), BELT_LOOK_REF, elements), BELT_LOOK_REF);
    rows.push(warehouseFronts(measuredGables(dressed, input, donorFilled), stated));
    for (const m of r.members) fronts[pandNumber(m.pand.id)] = { street: m.front.street, a: m.front.aLngLat, b: m.front.bLngLat, lengthM: +m.front.lengthM.toFixed(2) };
  }
  return { rows, provenance, skipped, fronts };
}

/** A donor-filled gable's measured rise: the 3DBAG ridge less the front top, held to this band (m). */
export const MEASURED_GABLE_RISE = { min: 2, max: 7 } as const;
/**
 * A donor-filled gabled front with a 3DBAG ridge and front top whose gap is a gable's (MEASURED_GABLE_RISE): its gable rises
 * from the measured front top to the ridge instead of the family's rise hung from the ridge (held-out round 5:
 * Driekoningenstraat 167637, a register point gable over 13.7 m eaves, drawn with its foot at 12.1 m). A read or reviewed
 * rise stays.
 */
export function measuredGables(row: RowRecord, input: RowInput, donorFilled: ReadonlySet<string>): RowRecord {
  for (const f of row.fronts) {
    if (f.sub || !donorFilled.has(f.pandId)) continue;
    const s = row.series.find(x => x.id === f.seriesId), m = input.members.find(x => x.pandId === f.pandId);
    const fo = f.overrides as { gable?: RowField<RowGable>; corniceTopM?: RowField<number | null>; crown?: RowField<string> };
    const g = fo.gable ?? s?.design.gable;
    if (!s || !m || !g?.value || g.source === 'reviewed' || !GABLED_CROWNS.has(String(fo.crown?.value ?? s.design.crown.value))) continue;
    if (!/no gable read/.test(g.ref ?? '')) continue;
    const foot = m.eaves3dbag, ridge = m.ridge3dbag;
    if (foot == null || ridge == null) continue;
    const rise = +(ridge - foot).toFixed(2);
    if (rise < MEASURED_GABLE_RISE.min || rise > MEASURED_GABLE_RISE.max) continue;
    fo.gable = { value: { ...g.value, riseM: rise }, source: 'period-default', ref: `${g.ref ?? ''}; ${BELT_LOOK_REF}: rise measured, 3DBAG ridge ${ridge} m less the front top ${foot} m` };
    fo.corniceTopM = { value: foot, source: 'period-default', ref: `${BELT_LOOK_REF}: the gable's foot at the measured front top (3DBAG), its apex on the ridge ${ridge} m` };
    f.topM = +(foot - (f.groundOffsetM ?? 0)).toFixed(2);
  }
  return row;
}

/** The warehouse parts a series draws: the loading doors stacked up the middle axis with their shutters, and the hoist. */
export const WAREHOUSE_EXTRAS = ['warehouse-shutters', 'hoist-beam'] as const;
/**
 * Warehouses as their own type (the register's pakhuis): a warehouse pand's front draws the loading-door axis and the hoist
 * beam; a pand whose register names a hoist beam draws the beam. Per front (a series may hold a warehouse beside a house of
 * the same outline); a reviewed extras list stays.
 */
export function warehouseFronts(row: RowRecord, stated: ReadonlyMap<string, BeltStated>): RowRecord {
  for (const f of row.fronts) {
    const sd = stated.get(f.pandId), s = row.series.find(x => x.id === f.seriesId);
    const add = [...(sd?.warehouse ? WAREHOUSE_EXTRAS : []), ...(sd?.elements?.includes('hoistBeam') ? ['hoist-beam'] : [])];
    const fo = f.overrides as { extras?: RowField<string[]> };
    const base = fo.extras ?? s?.design.extras;
    if (!add.length || base?.source === 'reviewed') continue;
    const cur = base?.value ?? [], more = [...new Set(add)].filter(x => !cur.includes(x));
    if (!more.length) continue;
    fo.extras = { value: [...cur, ...more], source: 'period-default', ref: `${base?.ref ?? ''}; ${BELT_LOOK_REF}: ${more.join(', ')} from the monument register (${sd?.warehouse ? 'pakhuis' : 'hoist beam'})` };
  }
  return row;
}
