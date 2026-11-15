/**
 * District look for a Centrum wijk outside the canal belt (centrum-looks lane, 2026-11-15): lane D's belt look
 * (src/canalRecall/beltLook) run over another district's buurten with that district's config
 * (src/canalRecall/beltLook/districts/<district>.json: canals, storey pitch band measured on its own reads, the cost of a
 * donor from another district). Donors are the district's own D1 reads (the first D1 tranche, `answers/`) tagged with the
 * district, plus the belt tranche's kept reads tagged `belt`; a pand's own read draws it. Stages
 * artifacts/buurt-generators/<district>/ in the buurt generator's layout, so scripts/buurt-generators/sheet.ts
 * --district=<district> draws its sheets. Never publishes.
 *
 *   node --import tsx scripts/centrum-looks/generate.ts --district=jordaan [--check] [--no-over-specs] [--no-ahn] [--out=...]
 *
 * Like the belt look's --over-specs (its staged run), a pand whose only description is a published per-house HouseSpec is
 * drawn by the look; its register facts still state its crown, year, finish, storeys and elements.
 */
import fs from 'node:fs';
import path from 'node:path';
import { districtPands, namedStreets, describedPands } from '../buurt-generators/generate.ts';
import { beltReads, laneDRowPands, specOnlyPands, statedPands } from '../belt-look/generate.ts';
import type { DistrictLibrary } from '../../src/canalRecall/buurtGenerator/generate.ts';
import { districtRows } from '../../src/canalRecall/buurtGenerator/rows.ts';
import { generateBelt, type BeltRead } from '../../src/canalRecall/beltLook/generate.ts';
import type { AhnFront } from '../../src/canalRecall/beltLook/ahnFront.ts';
import { frontTopM, segmentOf, usableDonor, type BeltDonor, type LookDistrict } from '../../src/canalRecall/beltLook/donors.ts';
import { rowFrontsWithSeries } from '../../src/canalRecall/houseLine/rowSeries.ts';
import { toRowCheck } from '../../src/canalRecall/houseSpec/row/check.ts';
import type { DescriberAnswer } from '../../src/canalRecall/houseSpec/describer.ts';
import { modernBehindRegister } from '../../src/canalRecall/beltLook/roofSignals.ts';
import { drawRowWalls, type WallDrawConfig } from '../../src/canalRecall/beltLook/wallDraw.ts';
import { strongPhoto } from '../../src/canalRecall/beltLook/generate.ts';
import { describerDarkPhrase } from '../../src/canalRecall/houseSpec/darkFinish.ts';
import { describerColourWord } from '../../src/canalRecall/houseSpec/judgedColour.ts';

const arg = (n: string) => process.argv.find(a => a.startsWith(`--${n}=`))?.slice(n.length + 3);
const ROWS = 'scripts/house-specs/rows/rows.json';

export interface LookDistrictFile extends LookDistrict { buurten: string[]; readDirs: string[]; maxYear?: number; measured?: unknown; note?: string; wallDraw?: WallDrawConfig }
export const loadLookDistrict = (id: string): LookDistrictFile => JSON.parse(fs.readFileSync(`src/canalRecall/beltLook/districts/${id}.json`, 'utf8'));

/**
 * The district's own D1 reads as donors: a read pand in the district, its front (length and street) from the buurt
 * generator's rows over all the district's pands, its height the 3DBAG front top (frontTopM), its year BAG's, its wall
 * sample the first-tranche cut's when one was cut.
 */
export function districtReads(look: LookDistrictFile, pands: ReturnType<typeof districtPands>, streets: ReturnType<typeof namedStreets>) {
  const root = process.env.ROW_D1_ROOT ?? JSON.parse(fs.readFileSync(ROWS, 'utf8')).d1Root;
  const byId = new Map(pands.map(p => [p.id.replace(/^NL\.IMBAG\.Pand\./, ''), p]));
  const front = new Map<string, { street: string; lengthM: number }>();
  for (const r of districtRows(pands, streets, { singles: true }).rows) for (const m of r.members) front.set(m.pand.id.replace(/^NL\.IMBAG\.Pand\./, ''), { street: m.front.street, lengthM: m.front.lengthM });
  const cuts = new Map<string, any>();
  for (const f of ['cuts/cuts.json']) if (fs.existsSync(path.join(root, f))) for (const r of JSON.parse(fs.readFileSync(path.join(root, f), 'utf8')).rows ?? []) cuts.set(r.pandId, r);
  const reads = new Map<string, BeltRead>(), donors: BeltDonor[] = [];
  for (const dir of look.readDirs) {
    const d = path.join(root, dir);
    for (const f of fs.readdirSync(d).filter(x => x.endsWith('.json')).sort()) {
      const a = JSON.parse(fs.readFileSync(path.join(d, f), 'utf8')) as DescriberAnswer, pid = a.pandId, p = byId.get(pid), fr = front.get(pid);
      if (!p || !fr || a.readable === false || reads.has(pid)) continue;
      const cut = cuts.get(pid), sample: string | undefined = cut?.w1?.hex ?? cut?.wallHex;
      reads.set(pid, { answer: a, ...(sample ? { sample } : {}), ref: `${dir}/${pid}.json` });
      const h = frontTopM(p.eavesM, p.heightM, p.ridgeM);
      if (usableDonor(a) && fr.lengthM > 2 && h !== null && h > 3)
        donors.push({ pandId: pid, street: fr.street, year: p.year ?? null, widthM: +fr.lengthM.toFixed(2), heightM: +h.toFixed(2), answer: a, ...(sample ? { sample } : {}), district: look.id });
    }
  }
  return { reads, donors };
}

/**
 * The district's brick drawn house by house (wallDraw.ts) over the solved records, row by row in street order: a front is
 * free when its read (own or donor) is unpainted brick, not pale, with no colour or dark word, and nothing states its
 * finish or colour; its sample is the pand's own (a strong W1 photo sample, else its own read's cut), never a donor's.
 */
export function drawWalls(records: any[], prov: Record<string, any>, reads: ReadonlyMap<string, BeltRead>, donors: readonly BeltDonor[], stated: ReturnType<typeof statedPands>, cfg: WallDrawConfig, years: ReadonlyMap<string, number | null>) {
  const donorById = new Map(donors.map(d => [d.pandId, d]));
  const byRow = new Map<string, any[]>();
  for (const r of records) { const k = String(r.series?.id ?? '').split('/')[0]; (byRow.get(k) ?? byRow.set(k, []).get(k)!).push(r); }
  const tally: Record<string, number> = {};
  for (const rs of byRow.values()) {
    const fronts = rs.map(r => {
      const pid = r.pandId as string, pv = prov[pid], sd = stated.get(pid);
      const a: DescriberAnswer | undefined = pv && 'own' in pv ? reads.get(pid)?.answer : pv && 'donor' in pv ? donorById.get(pv.donor)?.answer : undefined;
      // A donor's words describe the donor's front (and often its neighbours'), not this one: only an own read's words count.
      const ownRead = !!pv && 'own' in pv;
      // A donor-filled front drawn as brick has no colour evidence of its own (the series brick came from cut samples); an
      // own read must have seen unpainted, not pale brick with no colour or dark word. A register brick finish is no colour.
      const ownOk = !ownRead || (!!a && a.finish === 'brick' && (a as { pale?: boolean }).pale !== true && !describerDarkPhrase(a as never) && !describerColourWord(a as never));
      const free = !!a && r.wall?.finish === 'brick' && ownOk && (!sd?.finish || sd.finish === 'brick') && !sd?.specHex;
      const sample = strongPhoto(sd?.photo) ? sd!.photo!.hex : reads.get(pid)?.sample;
      return { pandId: pid, year: sd?.year ?? years.get(pid) ?? null, free, brickOnly: !!pv && 'own' in pv, ...(sample ? { sample } : {}) };
    });
    drawRowWalls(fronts, cfg).forEach((w, i) => {
      if (!w) { tally.kept = (tally.kept ?? 0) + 1; return; }
      const r = rs[i];
      r.wall = { ...r.wall, hex: w.hex, finish: w.material };
      r.sources = { ...r.sources, wall: `judged ${w.family} (centrum looks wall draw, src/canalRecall/beltLook/wallDraw.ts: ${w.by}, ${w.why})` };
      tally[`${w.by} ${w.family}`] = (tally[`${w.by} ${w.family}`] ?? 0) + 1;
    });
  }
  return tally;
}

async function main() {
  const id = arg('district') ?? 'jordaan', look = loadLookDistrict(id);
  const out = arg('out') ?? `artifacts/buurt-generators/${id}`, at = new Date().toISOString().slice(0, 10), t0 = Date.now();
  const pands = districtPands({ buurten: look.buurten } as DistrictLibrary), streets = namedStreets();
  const described = describedPands(), rowsD = laneDRowPands();
  const overSpecs = !process.argv.includes('--no-over-specs'), specOnly = overSpecs ? specOnlyPands() : new Set<string>();
  for (const s of specOnly) described.delete(s);
  for (const s of rowsD) described.add(s);
  const stated = statedPands();
  // Later periods stay with today and the buurt generator: a pand built after maxYear (BAG; an earlier register facade
  // year keeps it) breaks rows like a described pand.
  const laterPeriod = new Set<string>(), modern: Record<string, string> = {};
  const ahnFile = arg('ahn') ?? [`artifacts/buurt-generators/${id}-ahn/fronts.json`, `data/buurt-generators/${id}/ahn-fronts.json`].find(f => fs.existsSync(f)) ?? '';
  const ahn = new Map<string, AhnFront>(!process.argv.includes('--no-ahn') && fs.existsSync(ahnFile) ? Object.entries(JSON.parse(fs.readFileSync(ahnFile, 'utf8')).fronts) : []);
  if (look.maxYear) for (const p of pands) {
    const pid = p.id.replace(/^NL\.IMBAG\.Pand\./, ''), y = stated.get(pid)?.year ?? p.year;
    // roofSignals.ts: BAG's later year stands over a register's older one when the measured roof is flat (Boomstraat 172664).
    const mb = look.flatTopNoGable ? modernBehindRegister(p, stated.get(pid)?.year, look.maxYear, ahn.get(pid)) : null;
    if (mb) modern[pid] = mb;
    if (((y !== null && y > look.maxYear) || mb) && !described.has(pid)) { laterPeriod.add(pid); described.add(pid); }
  }
  const own = districtReads(look, pands, streets);
  const belt = beltReads();
  const donors = [...own.donors, ...belt.donors.map(d => ({ ...d, district: 'belt' }))];
  const reads = new Map<string, BeltRead>([...belt.reads, ...own.reads]);
  const res = generateBelt(pands, streets, described, reads, donors, at, stated, ahn, look);
  const records = res.rows.flatMap(r => rowFrontsWithSeries(r));
  const walls = look.wallDraw ? drawWalls(records, res.provenance, reads, donors, stated, look.wallDraw, new Map(pands.map(p => [p.id.replace(/^NL\.IMBAG\.Pand\./, ''), p.year]))) : null;
  fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(path.join(out, 'row-front.json'), JSON.stringify({ version: 1, district: id, generatedAt: at, records }));
  fs.writeFileSync(path.join(out, 'rows.json'), JSON.stringify({ district: id, rows: res.rows }));
  fs.writeFileSync(path.join(out, 'fronts.json'), JSON.stringify({ district: id, fronts: res.fronts }));
  fs.writeFileSync(path.join(out, 'provenance.json'), JSON.stringify(res.provenance));
  let findings = 0;
  if (process.argv.includes('--check')) {
    fs.mkdirSync(path.join(out, 'check'), { recursive: true });
    for (const r of res.rows) { const c = toRowCheck(r, {}, new Set()); findings += (c as { findings?: unknown[] }).findings?.length ?? 0; fs.writeFileSync(path.join(out, 'check', `${r.id}.row-check.json`), JSON.stringify(c)); }
  }
  const bySkip: Record<string, number> = {};
  for (const s of res.skipped) bySkip[s.reason] = (bySkip[s.reason] ?? 0) + 1;
  const drawn = Object.keys(res.provenance), ownN = drawn.filter(p => 'own' in res.provenance[p]).length;
  const donorDistrict: Record<string, number> = {};
  const dd = new Map(donors.map(d => [d.pandId, d.district ?? '?']));
  for (const p of drawn) { const v = res.provenance[p]; if ('donor' in v) donorDistrict[dd.get(v.donor) ?? '?'] = (donorDistrict[dd.get(v.donor) ?? '?'] ?? 0) + 1; }
  const bySeg: Record<string, number> = {}, crowns: Record<string, number> = {}, storeys: Record<string, number> = {};
  for (const r of res.rows) {
    bySeg[segmentOf(r.street, look.canals)] = (bySeg[segmentOf(r.street, look.canals)] ?? 0) + r.members.length;
    for (const f of r.fronts) {
      const s = r.series.find(x => x.id === f.seriesId)!, o = f.overrides as any;
      const c = o?.crown?.value ?? s.design.crown.value; crowns[c] = (crowns[c] ?? 0) + 1;
      const st = o?.storeys?.value ?? s.design.storeys?.value; storeys[st] = (storeys[st] ?? 0) + 1;
    }
  }
  const report = { at, district: id, buurten: look.buurten, pitchM: look.pitchM, foreignDonor: look.foreignDonor, ahnFronts: ahn.size, overSpecs, specOnlyRedrawn: drawn.filter(p => specOnly.has(p)).length,
    pands: pands.length, described: res.skipped.filter(s => s.reason === 'described').length - laterPeriod.size, laterPeriod: laterPeriod.size, maxYear: look.maxYear ?? null, drawn: drawn.length, ownRead: ownN, donorRead: drawn.length - ownN, donorDistrict,
    ownDonors: own.donors.length, beltDonors: belt.donors.length, rows: res.rows.length, records: records.length, skipped: bySkip, bySegment: bySeg, crowns, storeys, findings,
    statedCrown: drawn.filter(p => stated.get(p)?.crown).length, modernBehindRegister: Object.keys(modern).length, walls, ms: Date.now() - t0 };
  fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify({ ...report, skippedList: res.skipped, laterPeriodList: [...laterPeriod].sort(), modernList: modern }, null, 1));
  console.log(JSON.stringify(report, null, 1));
}
if (process.argv[1]?.endsWith('centrum-looks/generate.ts')) await main();
