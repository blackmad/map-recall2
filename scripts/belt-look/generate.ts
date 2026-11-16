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
import { beltRaisedDoorStoops, generateBelt, paleBlockWalls, photoCorniceOf, photoColourWalls, photoCrown, photoFinish, PHOTO_ROOF_MIN, registerRoofStorey, specPhotoDisagree, type BeltPhoto, type BeltRead, type BeltStated, type PhotoColour } from '../../src/canalRecall/beltLook/generate.ts';
import type { AhnFront } from '../../src/canalRecall/beltLook/ahnFront.ts';
import { usableDonor, segmentOf, type BeltDonor } from '../../src/canalRecall/beltLook/donors.ts';
import { rowFrontsWithSeries } from '../../src/canalRecall/houseLine/rowSeries.ts';
import { toRowCheck } from '../../src/canalRecall/houseSpec/row/check.ts';
import type { DescriberAnswer } from '../../src/canalRecall/houseSpec/describer.ts';

export const BELT_BUURTEN = ['AC01', 'AC02', 'AC03', 'AC04', 'AG01', 'AG02', 'AG03', 'AG04', 'AG05', 'AG06'];
const arg = (n: string) => process.argv.find(a => a.startsWith(`--${n}=`))?.slice(n.length + 3);
const ROWS = 'scripts/house-specs/rows/rows.json';

/** The belt tranche: its kept reads, the cuts' widths, heights and wall samples, and BAG's street and year per pand. */
export function beltReads(): { reads: Map<string, BeltRead>; donors: BeltDonor[]; root: string; photo: Map<string, BeltPhoto> } {
  const root = path.join(process.env.ROW_D1_ROOT ?? JSON.parse(fs.readFileSync(ROWS, 'utf8')).d1Root, 'belt-20261114');
  const select = new Map<string, { street: string; year: number }>((JSON.parse(fs.readFileSync(path.join(root, 'belt-select.json'), 'utf8')).rows as any[]).map(r => [r.pandId, { street: r.street, year: r.year }]));
  const cuts = new Map<string, any>((JSON.parse(fs.readFileSync(path.join(root, 'cuts/cuts.json'), 'utf8')).rows as any[]).map(r => [r.pandId, r]));
  const reads = new Map<string, BeltRead>(), donors: BeltDonor[] = [];
  // Every cut's wall sample (lane W1 on the pinned capture), an unreadable read's too: the photo's wall colour.
  const photo = new Map<string, BeltPhoto>();
  for (const [pid, c] of cuts) if (c.w1?.hex && typeof c.w1.n === 'number') photo.set(pid, { hex: c.w1.hex, L: c.w1.L, C: c.w1.C, h: c.w1.h, n: c.w1.n });
  const dir = path.join(root, 'answers-kept');
  for (const f of fs.readdirSync(dir).filter(x => x.endsWith('.json')).sort()) {
    const a = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')) as DescriberAnswer, pid = a.pandId, cut = cuts.get(pid), sel = select.get(pid);
    if (!cut || !sel || a.readable === false) continue;
    const sample: string | undefined = cut.w1?.hex ?? cut.wallHex;
    reads.set(pid, { answer: a, ...(sample ? { sample } : {}), ref: `belt-20261114/answers-kept/${pid}.json` });
    if (usableDonor(a) && cut.wallLenM > 2 && cut.wall?.heightM > 3)
      donors.push({ pandId: pid, street: sel.street, year: sel.year ?? null, widthM: cut.wallLenM, heightM: cut.wall.heightM, answer: a, ...(sample ? { sample } : {}) });
  }
  return { reads, donors, root, photo };
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
/** The register's pui terms that name a shop (winkelpui, bedrijfspui). A plain `pui` or `onderpui` is the ground storey's
 *  front of any house, not a shop (held-out round 6: Prinsengracht 182459, a register "pui" drawn as a three-bay
 *  shopfront over its souterrain windows); a shop otherwise needs the extract's shopfront layer (POIs). */
export const SHOP_PUI = /winkel|bedrijf/i;
export function statedPands(): Map<string, BeltStated> {
  const out = new Map<string, BeltStated>(), dir = 'public/data/extracts/amsterdam/house-specs/14';
  for (const x of fs.readdirSync(dir)) for (const f of fs.readdirSync(path.join(dir, x))) {
    const buf = fs.readFileSync(path.join(dir, x, f));
    for (const [id, b] of Object.entries<any>(JSON.parse((f.endsWith('.gz') ? zlib.gunzipSync(buf) : buf).toString('utf8')).buildings ?? {})) {
      const crown = b?.d?.fronts?.[0]?.gable, year = b?.x?.facadeYear ?? b?.v?.year, rs = b?.d?.fronts?.[0]?.roofStorey;
      const specHex = typeof b?.d?.palette?.brick === 'string' && /^#[0-9a-f]{6}$/i.test(b.d.palette.brick) ? b.d.palette.brick as string : undefined;
      const roofStorey = rs === 'mansard' || rs === 'attic';
      if (typeof crown === 'string' || typeof year === 'number' || roofStorey || specHex) out.set(id.replace(/^NL\.IMBAG\.Pand\./, ''), { ...(typeof crown === 'string' ? { crown } : {}), ...(typeof year === 'number' ? { year } : {}), ...(roofStorey ? { roofStorey } : {}), ...(rs === 'mansard' ? { mansard: true } : {}), ...(specHex ? { specHex } : {}) });
    }
  }
  // The monument register's parsed facts (monument-facts.json): its gable where house-specs states none, the facade finish,
  // storeys, a stoop and a shopfront. The register's `plain` gable is left unstated (its kind is not named).
  const CROWN: Record<string, string> = { cornice: 'cornice', neck: 'neck', bell: 'bell', step: 'step', spout: 'spout', raisedNeck: 'raised-neck' };
  for (const [id, f] of Object.entries<any>(JSON.parse(fs.readFileSync('public/data/extracts/amsterdam/monument-facts.json', 'utf8')).buildings ?? {})) {
    const k = id.replace(/^NL\.IMBAG\.Pand\./, ''), cur = out.get(k) ?? {}, els = new Set<string>((f.elements ?? []).map((e: any) => e.key));
    const crown = cur.crown ?? CROWN[f.gable], year = cur.year ?? f.facadeDate?.from ?? f.coreDate?.from;
    out.set(k, { ...cur, ...(crown ? { crown } : {}), ...(typeof year === 'number' ? { year } : {}), ...(typeof f.finish === 'string' ? { finish: f.finish } : {}),
      ...(Number.isInteger(f.storeys) && f.storeys > 0 ? { storeys: f.storeys } : {}), ...(els.has('stoop') ? { stoop: true } : {}), ...((f.elements ?? []).some((e: any) => e.key === 'shopfront' && SHOP_PUI.test(String(e.term ?? ''))) ? { shop: true } : {}), ...(registerRoofStorey([...els]) ? { roofStorey: true } : {}),
      ...(f.type?.key === 'warehouse' ? { warehouse: true } : {}), ...(els.size ? { elements: [...els].sort() } : {}) });
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
  const { reads, donors, photo } = beltReads();
  const stated = statedPands();
  for (const [pid, ph] of photo) stated.set(pid, { ...(stated.get(pid) ?? {}), photo: ph });
  // The photo finish reader (round 9; scripts/belt-look/photo-reads.ts): the finish where the register is silent, and the
  // wall sample of the cuts fetched for fronts the D1 tranche had none of.
  let photoCrowns = 0;
  const photoReads = arg('photo-reads') ?? ['artifacts/buurt-generators/belt-photo/photo-reads.json', 'data/buurt-generators/belt/photo-reads.json'].find(f => fs.existsSync(f)) ?? '';
  if (photoReads && fs.existsSync(photoReads)) for (const [pid, r] of Object.entries<any>(JSON.parse(fs.readFileSync(photoReads, 'utf8')).reads ?? {})) {
    const cur = stated.get(pid) ?? {}, fin = cur.finish ? undefined : photoFinish(r.finish ? r : undefined);
    // The photo colour reader (round 11): the wall's family where the register states no finish (photoColourWalls).
    const colour = !cur.finish && r.colour && typeof r.colour.confidence === 'number' ? r.colour as PhotoColour : undefined;
    const ph = !cur.photo && r.w1?.hex && typeof r.w1.n === 'number' ? { hex: r.w1.hex, L: r.w1.L, C: r.w1.C, h: r.w1.h, n: r.w1.n } : undefined;
    // The photo crown reader (round 10): a gabled crown where the register states none, a tall cornice, the storey count.
    const pc = photoCrown(typeof r.cc === 'number' ? r : undefined), crown = !cur.crown && pc.crown ? pc.crown : undefined;
    if (crown) photoCrowns++;
    // Round 12: a roof in view on the photo (mansard or pitched eaves at PHOTO_ROOF_MIN), the evidence BELT_LOOK's measured
    // roof storey needs (roofStoreyNeedsPhoto).
    const roof = typeof r.cc === 'number' && r.cc >= PHOTO_ROOF_MIN && ['mansard', 'pitched-eaves'].includes(r.crown);
    // Round 13: the photo's cornice over an own read's gable (two captures, or the gable-or-dormer check).
    const pcor = photoCorniceOf(r);
    if (fin || ph || crown || pc.tallCornice || pc.storeys || colour || roof || pcor) stated.set(pid, { ...cur, ...(roof ? { photoRoof: true } : {}), ...(pcor ? { photoCornice: pcor } : {}), ...(fin ? { finish: fin } : {}), ...(ph ? { photo: ph } : {}), ...(crown ? { crown } : {}), ...(colour ? { photoColour: colour } : {}),
      ...(pc.tallCornice ? { tallCornice: pc.tallCornice } : {}), ...(pc.storeys ? { photoStoreys: pc.storeys } : {}), ...(pc.souterrain !== undefined ? { photoSouterrain: pc.souterrain } : {}) });
  }
  // Measured AHN street fronts (scripts/belt-look/ahn-fronts.ts, staged); --no-ahn draws from 3DBAG alone.
  const ahnFile = arg('ahn') ?? ['artifacts/buurt-generators/belt-ahn/fronts.json', 'data/buurt-generators/belt/ahn-fronts.json'].find(f => fs.existsSync(f)) ?? '';
  const ahn = new Map<string, AhnFront>(!process.argv.includes('--no-ahn') && fs.existsSync(ahnFile) ? Object.entries(JSON.parse(fs.readFileSync(ahnFile, 'utf8')).fronts) : []);
  const res = generateBelt(pands, streets, described, reads, donors, at, stated, ahn);
  const records = res.rows.flatMap(r => rowFrontsWithSeries(r));
  const photoColours = photoColourWalls(records, stated);
  const paleBlockFronts = paleBlockWalls(records, res.paleBlocks ?? []);
  const raisedDoorStoops = beltRaisedDoorStoops(records);
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
  // A spec's wall colour against a strong photo read: flagged, never overridden (round 8: the belt look keeps the spec's).
  const specColourFlags = Object.keys(res.provenance).map(id => ({ id, f: specPhotoDisagree(stated.get(id)) })).filter(x => x.f).map(x => ({ pandId: x.id, ...x.f! }));
  fs.writeFileSync(path.join(out, 'spec-colour-flags.json'), JSON.stringify(specColourFlags, null, 1));
  const report = { at, specColourFlags: specColourFlags.length, buurten: BELT_BUURTEN, ahnFronts: ahn.size, overSpecs, specOnlyRedrawn: Object.keys(res.provenance).filter(id => specOnly.has(id)).length, pands: pands.length, described: res.skipped.filter(s => s.reason === 'described').length, laneDRowPands: [...rowsD].filter(id => pands.some(p => p.id.endsWith(id))).length,
    drawn: drawn.length, ownRead: own, donorRead: drawn.length - own, rows: res.rows.length, records: records.length, donors: donors.length, skipped: bySkip, bySegment: bySeg, crowns, findings, photoCrowns, photoColours, paleBlocks: (res.paleBlocks ?? []).length, paleBlockFronts, raisedDoorStoops, photoCornices: [...stated.values()].filter(v => v.photoCornice).length, photoRoofs: [...stated.values()].filter(v => v.photoRoof).length, roofStoreys: records.filter(r => r.series?.roofStorey && r.series.roofStorey.kind !== "none").length, statedCrown: Object.keys(res.provenance).filter(id => stated.get(id)?.crown).length, ms: Date.now() - t0 };
  fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify({ ...report, skippedList: res.skipped }, null, 1));
  console.log(JSON.stringify(report, null, 1));
}
if (process.argv[1]?.endsWith('belt-look/generate.ts')) await main();
