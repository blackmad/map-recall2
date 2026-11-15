/**
 * Belt look generator (lane D, 2026-11-15; src/canalRecall/beltLook): stage every undescribed pand of the canal belt
 * (Grachtengordel-West AC01-AC04 and -Zuid AG01-AG06) as house-rows front records, from the belt D1 tranche's reads (own
 * read, or the nearest read house's as its donor). Stages artifacts/buurt-generators/belt/ in the buurt generator's
 * layout (row-front.json, rows.json, fronts.json, check/, report.json), so its sheet tool reads it. Never publishes.
 *
 *   node --import tsx scripts/belt-look/generate.ts [--check] [--over-specs] [--out=artifacts/buurt-generators/belt]
 *
 * --over-specs: a pand whose only description is a published per-house HouseSpec (the extract's house-specs tiles) is drawn
 * by the look too (1,699 of the belt's 3,466 pands, 2026-11-15); models, building types, published row records and lane D's
 * rows stay described. Without it those specs are kept and the look covers only the undescribed rest.
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { districtPands, namedStreets, describedPands } from '../buurt-generators/generate.ts';
import type { DistrictLibrary } from '../../src/canalRecall/buurtGenerator/generate.ts';
import { generateBelt, type BeltRead, type BeltStated } from '../../src/canalRecall/beltLook/generate.ts';
import { usableDonor, segmentOf, type BeltDonor } from '../../src/canalRecall/beltLook/donors.ts';
import { rowFrontsWithSeries } from '../../src/canalRecall/houseLine/rowSeries.ts';
import { toRowCheck } from '../../src/canalRecall/houseSpec/row/check.ts';
import type { DescriberAnswer } from '../../src/canalRecall/houseSpec/describer.ts';

export const BELT_BUURTEN = ['AC01', 'AC02', 'AC03', 'AC04', 'AG01', 'AG02', 'AG03', 'AG04', 'AG05', 'AG06'];
const arg = (n: string) => process.argv.find(a => a.startsWith(`--${n}=`))?.slice(n.length + 3);
const ROWS = 'scripts/house-specs/rows/rows.json';

/** The belt tranche: its kept reads, the cuts' widths, heights and wall samples, and BAG's street and year per pand. */
export function beltReads(): { reads: Map<string, BeltRead>; donors: BeltDonor[]; root: string } {
  const root = path.join(process.env.ROW_D1_ROOT ?? JSON.parse(fs.readFileSync(ROWS, 'utf8')).d1Root, 'belt-20261114');
  const select = new Map<string, { street: string; year: number }>((JSON.parse(fs.readFileSync(path.join(root, 'belt-select.json'), 'utf8')).rows as any[]).map(r => [r.pandId, { street: r.street, year: r.year }]));
  const cuts = new Map<string, any>((JSON.parse(fs.readFileSync(path.join(root, 'cuts/cuts.json'), 'utf8')).rows as any[]).map(r => [r.pandId, r]));
  const reads = new Map<string, BeltRead>(), donors: BeltDonor[] = [];
  const dir = path.join(root, 'answers-kept');
  for (const f of fs.readdirSync(dir).filter(x => x.endsWith('.json')).sort()) {
    const a = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')) as DescriberAnswer, pid = a.pandId, cut = cuts.get(pid), sel = select.get(pid);
    if (!cut || !sel || a.readable === false) continue;
    const sample: string | undefined = cut.w1?.hex ?? cut.wallHex;
    reads.set(pid, { answer: a, ...(sample ? { sample } : {}), ref: `belt-20261114/answers-kept/${pid}.json` });
    if (usableDonor(a) && cut.wallLenM > 2 && cut.wall?.heightM > 3)
      donors.push({ pandId: pid, street: sel.street, year: sel.year ?? null, widthM: cut.wallLenM, heightM: cut.wall.heightM, answer: a, ...(sample ? { sample } : {}) });
  }
  return { reads, donors, root };
}

/** Pands whose only description is a published per-house HouseSpec (no model, building type or row record). */
export function specOnlyPands(): Set<string> {
  const norm = (x: string) => x.replace(/^NL\.IMBAG\.Pand\./, '');
  const spec = new Set<string>(), dir = 'public/data/extracts/amsterdam/house-specs/14';
  for (const x of fs.readdirSync(dir)) for (const f of fs.readdirSync(path.join(dir, x))) {
    const buf = fs.readFileSync(path.join(dir, x, f));
    for (const id of Object.keys(JSON.parse((f.endsWith('.gz') ? zlib.gunzipSync(buf) : buf).toString('utf8')).buildings ?? {})) spec.add(norm(id));
  }
  for (const r of JSON.parse(fs.readFileSync('public/data/front-records/row-front.json', 'utf8')).records ?? []) spec.delete(norm(String(r.pandId)));
  const covers = JSON.parse(fs.readFileSync('public/canal-drive/models/covers.json', 'utf8'));
  for (const m of Object.values<any>(covers.models ?? {})) for (const id of m.p ?? []) spec.delete(norm(id));
  for (const id of covers.buildingTypes ?? []) spec.delete(norm(id));
  return spec;
}

/** What the published house-specs state per pand (the monument register's current gable and facade year), and its shop. */
export function statedPands(): Map<string, BeltStated> {
  const out = new Map<string, BeltStated>(), dir = 'public/data/extracts/amsterdam/house-specs/14';
  for (const x of fs.readdirSync(dir)) for (const f of fs.readdirSync(path.join(dir, x))) {
    const buf = fs.readFileSync(path.join(dir, x, f));
    for (const [id, b] of Object.entries<any>(JSON.parse((f.endsWith('.gz') ? zlib.gunzipSync(buf) : buf).toString('utf8')).buildings ?? {})) {
      const crown = b?.d?.fronts?.[0]?.gable, year = b?.x?.facadeYear ?? b?.v?.year, rs = b?.d?.fronts?.[0]?.roofStorey;
      const roofStorey = rs === 'mansard' || rs === 'attic';
      if (typeof crown === 'string' || typeof year === 'number' || roofStorey) out.set(id.replace(/^NL\.IMBAG\.Pand\./, ''), { ...(typeof crown === 'string' ? { crown } : {}), ...(typeof year === 'number' ? { year } : {}), ...(roofStorey ? { roofStorey } : {}) });
    }
  }
  // The monument register's parsed facts (monument-facts.json): its gable where house-specs states none, the facade finish,
  // storeys, a stoop and a shopfront. The register's `plain` gable is left unstated (its kind is not named).
  const CROWN: Record<string, string> = { cornice: 'cornice', neck: 'neck', bell: 'bell', step: 'step', spout: 'spout', raisedNeck: 'raised-neck' };
  for (const [id, f] of Object.entries<any>(JSON.parse(fs.readFileSync('public/data/extracts/amsterdam/monument-facts.json', 'utf8')).buildings ?? {})) {
    const k = id.replace(/^NL\.IMBAG\.Pand\./, ''), cur = out.get(k) ?? {}, els = new Set<string>((f.elements ?? []).map((e: any) => e.key));
    const crown = cur.crown ?? CROWN[f.gable], year = cur.year ?? f.facadeDate?.from ?? f.coreDate?.from;
    out.set(k, { ...cur, ...(crown ? { crown } : {}), ...(typeof year === 'number' ? { year } : {}), ...(typeof f.finish === 'string' ? { finish: f.finish } : {}),
      ...(Number.isInteger(f.storeys) && f.storeys > 0 ? { storeys: f.storeys } : {}), ...(els.has('stoop') ? { stoop: true } : {}), ...(els.has('shopfront') ? { shop: true } : {}), ...(els.has('dormer') || els.has('attic') ? { roofStorey: true } : {}) });
  }
  // Shop ground storeys: the extract's shopfronts.json (the game's own shopfront layer).
  for (const id of Object.keys(JSON.parse(fs.readFileSync('public/data/extracts/amsterdam/shopfronts.json', 'utf8')).buildings ?? {})) {
    const k = id.replace(/^NL\.IMBAG\.Pand\./, ''); out.set(k, { ...(out.get(k) ?? {}), shop: true });
  }
  return out;
}

/** Lane D's row members: their row records draw them (the look stays under them). */
export function laneDRowPands(): Set<string> {
  const raw = JSON.parse(fs.readFileSync(ROWS, 'utf8'));
  return new Set(Object.values<any>(raw.rows).flatMap(r => (r.members ?? []).map((m: any) => m.pandId)));
}

async function main() {
  const out = arg('out') ?? 'artifacts/buurt-generators/belt', at = new Date().toISOString().slice(0, 10);
  const t0 = Date.now();
  const pands = districtPands({ buurten: BELT_BUURTEN } as DistrictLibrary), streets = namedStreets();
  const described = describedPands(), rowsD = laneDRowPands();
  const overSpecs = process.argv.includes('--over-specs'), specOnly = overSpecs ? specOnlyPands() : new Set<string>();
  for (const id of specOnly) described.delete(id);
  for (const id of rowsD) described.add(id);
  const { reads, donors } = beltReads();
  const stated = statedPands();
  const res = generateBelt(pands, streets, described, reads, donors, at, stated);
  const records = res.rows.flatMap(r => rowFrontsWithSeries(r));
  fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(path.join(out, 'row-front.json'), JSON.stringify({ version: 1, district: 'belt', generatedAt: at, records }));
  fs.writeFileSync(path.join(out, 'rows.json'), JSON.stringify({ district: 'belt', rows: res.rows }));
  fs.writeFileSync(path.join(out, 'fronts.json'), JSON.stringify({ district: 'belt', fronts: res.fronts }));
  fs.writeFileSync(path.join(out, 'provenance.json'), JSON.stringify(res.provenance));
  let findings = 0;
  if (process.argv.includes('--check')) {
    fs.mkdirSync(path.join(out, 'check'), { recursive: true });
    for (const r of res.rows) { const c = toRowCheck(r, {}, new Set()); findings += (c as { findings?: unknown[] }).findings?.length ?? 0; fs.writeFileSync(path.join(out, 'check', `${r.id}.row-check.json`), JSON.stringify(c)); }
  }
  const bySkip: Record<string, number> = {};
  for (const s of res.skipped) bySkip[s.reason] = (bySkip[s.reason] ?? 0) + 1;
  const drawn = Object.keys(res.provenance), own = drawn.filter(id => 'own' in res.provenance[id]).length;
  const bySeg: Record<string, number> = {};
  for (const r of res.rows) bySeg[segmentOf(r.street)] = (bySeg[segmentOf(r.street)] ?? 0) + r.members.length;
  const crowns: Record<string, number> = {};
  for (const r of res.rows) for (const f of r.fronts) { const s = r.series.find(x => x.id === f.seriesId)!; const c = (f.overrides as any)?.crown?.value ?? s.design.crown.value; crowns[c] = (crowns[c] ?? 0) + 1; }
  const report = { at, buurten: BELT_BUURTEN, overSpecs, specOnlyRedrawn: Object.keys(res.provenance).filter(id => specOnly.has(id)).length, pands: pands.length, described: res.skipped.filter(s => s.reason === 'described').length, laneDRowPands: [...rowsD].filter(id => pands.some(p => p.id.endsWith(id))).length,
    drawn: drawn.length, ownRead: own, donorRead: drawn.length - own, rows: res.rows.length, records: records.length, donors: donors.length, skipped: bySkip, bySegment: bySeg, crowns, findings, statedCrown: Object.keys(res.provenance).filter(id => stated.get(id)?.crown).length, ms: Date.now() - t0 };
  fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify({ ...report, skippedList: res.skipped }, null, 1));
  console.log(JSON.stringify(report, null, 1));
}
if (process.argv[1]?.endsWith('belt-look/generate.ts')) await main();
