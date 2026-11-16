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
import { GABLED_CROWNS, frontTopM, segmentOf, usableDonor, type BeltDonor, type LookDistrict } from '../../src/canalRecall/beltLook/donors.ts';
import { rowFrontsWithSeries } from '../../src/canalRecall/houseLine/rowSeries.ts';
import { toRowCheck } from '../../src/canalRecall/houseSpec/row/check.ts';
import type { DescriberAnswer } from '../../src/canalRecall/houseSpec/describer.ts';
import { modernBehindRegister } from '../../src/canalRecall/beltLook/roofSignals.ts';
import { drawRowWalls, isBrickFamily, measuredWeights, periodOf, streetFamily, type WallDrawConfig, type WallDrawn, type WeightEvidence, type Weights } from '../../src/canalRecall/beltLook/wallDraw.ts';
import { strongPhoto, photoFinish, photoCrown, PHOTO_FINISH_MIN, PHOTO_CROWN_MIN, type PhotoCrown } from '../../src/canalRecall/beltLook/generate.ts';
import { describerDarkPhrase } from '../../src/canalRecall/houseSpec/darkFinish.ts';
import { describerColourWord, judgeFront, lchOf, type JudgedFamily } from '../../src/canalRecall/houseSpec/judgedColour.ts';

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
  for (const f of ['cuts/cuts.json', 'cuts-ah07/cuts.json', 'ring-20261114/cuts/cuts.json']) if (fs.existsSync(path.join(root, f))) for (const r of JSON.parse(fs.readFileSync(path.join(root, f), 'utf8')).rows ?? []) cuts.set(r.pandId, r);
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

/** A photo read that overrules a register gable: a cornice or plain parapet read at PHOTO_OVER_REGISTER_CC. */
export const PHOTO_OVER_REGISTER_CC = 0.75;
export function photoOverRegisterGable(registerCrown: string | undefined, r: Partial<PhotoCrown> | undefined): boolean {
  return !!registerCrown && GABLED_CROWNS.has(registerCrown) && !!r && typeof r.cc === 'number' && r.cc >= PHOTO_OVER_REGISTER_CC && (r.crown === 'cornice' || r.crown === 'flat');
}

/** Round 8: a weak gable read's floor, and the AHN band spread (p90 - p50, m) that lifts it to the bar. */
export const WEAK_GABLE_MIN = 0.6, AHN_GABLE_SPREAD_M = 2.5;
/** The v3 dress field's confidence that states the upper windows' dressing (round 7). */
export const PHOTO_DRESS_MIN = 0.7;
/** The v3 dress words the row line can draw, in the describer's windowSurround words (row/solve.ts DRESSING_OF). */
export const PHOTO_DRESS_SURROUND: Readonly<Record<string, string>> = { none: 'none', 'stone-lintel': 'stone-lintel', keystone: 'keystone', 'block-course': 'block-dressings', 'block-surround': 'block-surround', 'arch-ring': 'arch-ring', bands: 'speklagen' };
/** The v3 roof field's confidence that states a roof storey (round 7). */
export const PHOTO_ROOF_READ_MIN = 0.6;
/** The photo confidence a roof in view needs to evidence a measured roof storey (round 6). */
export const PHOTO_ROOF_MIN = 0.6;
/** A weak photo read (round 6): counted by a run only when WEAK_RUN_MIN of them mostly agree (wallDraw.ts run-weak). */
export const WEAK_PHOTO_MIN = 0.55;
/** Confident brick reads a street needs for its own mix (round 6), and a district period for the district mix. */
export const STREET_MIX_MIN = 4, DISTRICT_MIX_MIN = 12;
/**
 * The draw's weights from the confident photo reads (round 6: round 5's fallback drew the judged prior, 45 % red-brown and
 * 15 % orange, where the photos read brown and dark): brick families only, per period; a period with fewer than `min`
 * reads keeps the fallback's weights.
 */
export function photoMix(reads: ReadonlyArray<{ year: number | null; family: JudgedFamily }>, fallback: { before1860: Weights; from1860: Weights }, min: number): { before1860: Weights; from1860: Weights; n: { before1860: number; from1860: number } } {
  const out = { before1860: fallback.before1860, from1860: fallback.from1860, n: { before1860: 0, from1860: 0 } };
  for (const per of ['before1860', 'from1860'] as const) {
    const c: Weights = {};
    for (const r of reads) if (periodOf(r.year) === per && isBrickFamily(r.family)) { c[r.family] = (c[r.family] ?? 0) + 1; out.n[per]++; }
    if (out.n[per] >= min) out[per] = Object.fromEntries(Object.entries(c).map(([f, n]) => [f, +((n as number) / out.n[per]).toFixed(3)])) as Weights;
  }
  return out;
}

/**
 * A district's gable foot pitch (round 6): the p25 of AHN cornice tops (band p90) over the photo's storeys on confident
 * cornice and flat reads (a souterrain 0.58 of a storey). Measured 3.43 m (Jordaan), 3.28 (Nieuwmarkt), 3.61 (De
 * Weteringschans) against the belt's 2.8; null under `min` reads.
 */
export function gableFootPitch(reads: Iterable<[string, Partial<PhotoCrown>]>, ahn: ReadonlyMap<string, AhnFront>, min = 30): { pitch: number; n: number } | null {
  const ps: number[] = [];
  for (const [pid, r] of reads) {
    const a = ahn.get(pid);
    if (!a || (r.crown !== 'cornice' && r.crown !== 'flat') || !((r.cc ?? 0) >= 0.7) || !((r.sc ?? 0) >= 0.7) || !r.full) continue;
    ps.push(a.p90 / (r.full + (r.souterrain ? 0.58 : 0)));
  }
  if (ps.length < min) return null;
  ps.sort((x, y) => x - y);
  return { pitch: +ps[Math.floor(0.25 * (ps.length - 1))].toFixed(2), n: ps.length };
}

/** The photo colour reader's families (artifacts/centrum-looks/photo/reader-prompt.md) as the judged palette's. */
export const PHOTO_FAMILY: Record<string, JudgedFamily> = {
  'dark-grey-brick': 'dark-grey-brick', 'purple-brown-brick': 'purple-brown-brick', 'brown-brick': 'brown-brick', 'red-brown-brick': 'red-brown-brick',
  'orange-red-brick': 'orange-red-brick', 'buff-brick': 'buff-brick', 'white-paint': 'painted-white', 'cream-paint': 'cream-render',
  'pale-grey': 'pale-grey-stucco', 'dark-paint': 'painted-black',
};
export interface PhotoRead { finish: string; family: string; confidence: number; reader: string }
/** A photo read's family when it may stand: confident, a family the palette has, and the register silent on the finish. */
export function photoFamily(r: PhotoRead | undefined, registerFinish: string | undefined): JudgedFamily | undefined {
  if (!r || !(r.confidence >= PHOTO_FINISH_MIN)) return undefined;
  // Round 5: a register that states brick says nothing of its colour; a brick family read on the photo stands under it
  // (Lindengracht 172512, red brick read at 0.85, drawn the run's brown). A painted, plaster or stone register stands.
  if (registerFinish && !(BRICK_FINISHES.has(registerFinish) && r.family.endsWith('-brick'))) return undefined;
  return PHOTO_FAMILY[r.family];
}
const BRICK_FINISHES: ReadonlySet<string> = new Set(['brick', 'ornamentalBrick']);
/**
 * Round 8 (De Weteringschans Prinsengracht 168251-179166, near-black brick drawn purple-brown and judged red-brown): a weak
 * purple-brown read whose own cut samples dark and neutral (OKLCh C < 0.008, L < 0.37) is dark-grey brick. Measured on the
 * cuts: that sample holds for 38 % of confident dark-grey reads, 19 % of confident purple-brown, 4 % of brown.
 */
export const DARK_NEUTRAL = { maxC: 0.008, maxL: 0.37 } as const;
export function darkNeutralCut(hex: string | undefined): boolean {
  const l = hex ? lchOf(hex) : null;
  return !!l && l.C < DARK_NEUTRAL.maxC && l.L < DARK_NEUTRAL.maxL;
}
/** Round 7: two photo reads that both see bare brick (v2 at WEAK_PHOTO_MIN, and v1 or a later capture) over a register's plaster or paint. */
export function photoOverRegisterFinish(registerFinish: string | undefined, r: PhotoRead | undefined): boolean {
  if (!registerFinish || BRICK_FINISHES.has(registerFinish) || !r) return false;
  const x = r as PhotoRead & { v1?: { family: string; confidence: number }; second?: PhotoRead; capture3?: PhotoRead };
  const brick = (f: { family?: string; confidence?: number; finish?: string } | undefined) => !!f && (f.confidence ?? 0) >= WEAK_PHOTO_MIN && !!f.family?.endsWith('-brick') && (f.finish === undefined || f.finish === 'brick');
  return brick(x) && [x.v1, x.second, x.capture3].some(brick);
}
export const loadPhotoReads = (id: string, file?: string): Map<string, PhotoRead> => {
  const f = file ?? [`artifacts/centrum-looks/photo/${id}-photo-reads.json`, `data/buurt-generators/${id}/photo-reads.json`].find(x => fs.existsSync(x));
  return new Map(f && fs.existsSync(f) ? Object.entries<PhotoRead>(JSON.parse(fs.readFileSync(f, 'utf8')).reads ?? {}) : []);
};

/** A read's judged family (judgeFront, absolute mode: its own cut sample read as measured, as the belt reads are). */
export function readFamily(pid: string, r: BeltRead, year: number | null): JudgedFamily {
  const a = r.answer as DescriberAnswer & { pale?: boolean; notes?: string };
  return judgeFront({ pandId: pid, readable: a.readable, finish: a.finish, pale: a.pale, notes: a.notes ?? null, year, sample: r.sample, absolute: true }).family;
}

/**
 * The district's wall evidence (centrum-looks round 3): the period weights measured from its own reads (wallDraw.ts
 * measuredWeights, pooled with the config's prior: its own weights, or another district's measured ones) and each
 * street's family where its own reads agree (wallDraw.ts streetFamily; the belt tranche's reads count on the streets
 * they stand on).
 */
export function wallEvidence(look: LookDistrictFile, own: ReadonlyMap<string, BeltRead>, all: ReadonlyMap<string, BeltRead>, streetOf: ReadonlyMap<string, string>, years: ReadonlyMap<string, number | null>, prior?: { before1860: any; from1860: any }) {
  const cfg = look.wallDraw!;
  const ev: WeightEvidence[] = [...own].map(([pid, r]) => ({ year: years.get(pid) ?? null, family: readFamily(pid, r, years.get(pid) ?? null) }));
  const weights = measuredWeights(ev, prior ?? { before1860: cfg.before1860, from1860: cfg.from1860 }, cfg.priorN ?? 8);
  const byStreet = new Map<string, JudgedFamily[]>();
  for (const [pid, r] of all) { const st = streetOf.get(pid); if (st) (byStreet.get(st) ?? byStreet.set(st, []).get(st)!).push(readFamily(pid, r, years.get(pid) ?? null)); }
  const streets = new Map<string, JudgedFamily>();
  for (const [st, fs] of byStreet) { const f = streetFamily(fs); if (f) streets.set(st, f); }
  return { weights, streets, reads: ev.length };
}

/**
 * The district's walls drawn run by run (wallDraw.ts) over the solved records, row by row in street order: a front is
 * free when its read (own or donor) is unpainted brick, not pale, with no colour or dark word, and nothing states its
 * finish or colour; its sample is the pand's own (a strong W1 photo sample, else its own read's cut), never a donor's.
 */
export function drawWalls(records: any[], prov: Record<string, any>, reads: ReadonlyMap<string, BeltRead>, donors: readonly BeltDonor[], stated: ReturnType<typeof statedPands>, cfg: WallDrawConfig, years: ReadonlyMap<string, number | null>, streetFamilyOf: ReadonlyMap<string, JudgedFamily> = new Map(), photo: ReadonlyMap<string, PhotoRead> = new Map(), registerFinish: ReadonlyMap<string, string> = new Map(), streetOfPand: ReadonlyMap<string, string> = new Map(), streetWeights: ReadonlyMap<string, WallDrawConfig> = new Map()) {
  const donorById = new Map(donors.map(d => [d.pandId, d]));
  const byRow = new Map<string, any[]>();
  for (const r of records) { const k = String(r.series?.id ?? '').split('/')[0]; (byRow.get(k) ?? byRow.set(k, []).get(k)!).push(r); }
  const tally: Record<string, number> = {}, seriesFamily = new Map<string, WallDrawn>();
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
      const st = streetFamilyOf.get(pid), pr = photo.get(pid), pf = sd?.specHex ? undefined : photoFamily(pr, registerFinish.get(pid));
      const wk0 = pf || sd?.specHex || !pr || !(pr.confidence >= WEAK_PHOTO_MIN) ? undefined : photoFamily({ ...pr, confidence: PHOTO_FINISH_MIN }, registerFinish.get(pid));
      const wk = wk0 === 'purple-brown-brick' && darkNeutralCut((pr as { cutHex?: string }).cutHex) ? 'dark-grey-brick' as JudgedFamily : wk0;
      return { pandId: pid, year: sd?.year ?? years.get(pid) ?? null, free, brickOnly: ownRead, series: r.series?.id as string | undefined, ...(sample ? { sample } : {}), ...(st ? { streetFamily: st } : {}),
        ...(pf ? { photo: pf, photoStucco: pr!.finish === 'stucco' } : {}), ...(wk ? { weakPhoto: wk } : {}) };
    });
    const street = streetOfPand.get(fronts[0]?.pandId), rowCfg = (street && streetWeights.get(street)) ?? cfg;
    drawRowWalls(fronts, rowCfg, seriesFamily).forEach((w, i) => {
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
  // The photo colour reader (round 4; scripts/centrum-looks/photo-reads.ts): as the belt's finish reader (lane D round 9),
  // a confident read states the finish where the register is silent; its family goes to the wall draw (drawWalls).
  const registerFinish = new Map<string, string>([...stated].flatMap(([k, v]) => (v.finish ? [[k, v.finish] as [string, string]] : [])));
  const photo = process.argv.includes('--no-photo') ? new Map<string, PhotoRead>() : loadPhotoReads(id, arg('photo-reads'));
  let photoCrowns = 0, photoRoofStoreys = 0, gablesBySpread = 0;
  const ahnEarlyFile = arg('ahn') ?? [`artifacts/buurt-generators/${id}-ahn/fronts.json`, `data/buurt-generators/${id}/ahn-fronts.json`].find(f => fs.existsSync(f)) ?? '';
  const ahnEarly = new Map<string, AhnFront>(!process.argv.includes('--no-ahn') && fs.existsSync(ahnEarlyFile) ? Object.entries(JSON.parse(fs.readFileSync(ahnEarlyFile, 'utf8')).fronts) : []);
  const dressTally: Record<string, number> = {};
  const registerGablesDropped: string[] = [], registerFinishesDropped: string[] = [];
  for (const [pid, r] of photo) {
    const cur = stated.get(pid) ?? {}, fin = cur.finish ? undefined : photoFinish(r.finish === 'unclear' ? undefined : r as never);
    // Round 5: lane D's crown reader's fields, read by the v2 reader on the same cut (photoCrown: a gabled crown where the
    // register is silent, a tall cornice, the storey count; each at PHOTO_CROWN_MIN).
    // Round 8 (Kloveniersburgwal 177789: a step gable read at 0.65 on a third capture, not visible on two others, over an
    // AHN band from 18.1 to 21.2 m; drawn an 18 m cornice, the photo ~21): a weak gable (>= WEAK_GABLE_MIN) over an AHN
    // front band spread of AHN_GABLE_SPREAD_M stands at the bar (the spread: 46 % of confident gables, 14 % of cornices).
    const r0 = typeof (r as Partial<PhotoCrown>).cc === 'number' ? r as unknown as PhotoCrown : undefined, a0 = ahnEarly.get(pid);
    const rc = r0 && r0.cc < PHOTO_CROWN_MIN && r0.cc >= WEAK_GABLE_MIN && GABLED_CROWNS.has(r0.crown) && a0 && a0.p90 - a0.p50 >= AHN_GABLE_SPREAD_M ? { ...r0, cc: PHOTO_CROWN_MIN } : r0;
    if (rc !== r0) gablesBySpread++;
    const pc = photoCrown(rc), crown = !cur.crown && pc.crown ? pc.crown : undefined;
    if (crown) photoCrowns++;
    // A register gable the photo confidently reads as a cornice or a plain parapet is a front that changed (round 4 judges:
    // gables invented on flat-cornice rows; 43 donor fronts drawn gabled under a photo cornice, checked by eye on 8).
    if (photoOverRegisterGable(cur.crown, r as unknown as PhotoCrown)) { const { crown: _gone, ...rest } = cur; stated.set(pid, rest); registerGablesDropped.push(pid); }
    // Round 7 (Kloveniersburgwal 177790: the register's 1850 plaster drawn pale grey over a brown brick front): a plaster or
    // paint register finish yields where two photo reads (v2 and v1, or a second capture) both see bare brick (each >= WEAK_PHOTO_MIN).
    if (photoOverRegisterFinish(stated.get(pid)?.finish, r)) { const { finish: _f, ...rest } = stated.get(pid)!; stated.set(pid, rest); registerFinish.delete(pid); registerFinishesDropped.push(pid); }
    const now = stated.get(pid) ?? {};
    // Round 6: a roof in view on the photo (mansard or pitched eaves read at PHOTO_ROOF_MIN): the evidence a measured roof storey needs.
    const roof = typeof (r as Partial<PhotoCrown>).cc === 'number' && (r as unknown as PhotoCrown).cc >= PHOTO_ROOF_MIN && ['mansard', 'pitched-eaves'].includes((r as unknown as PhotoCrown).crown);
    // Round 7: the v3 re-read's roof in view (rc >= PHOTO_ROOF_READ_MIN) states a roof storey as the register's dakkapel
    // does (Marnixplein 168300-174907, a continuous pantile roof with dormers, drawn with none); a mansard read keeps the
    // kit's mansard face over lane D's pitched hip (Westeinde 171768-178343, read mansard at 0.7-0.85, drawn as hips).
    const rr = r as unknown as PhotoCrown & { roof?: string; rc?: number }, roofRead = typeof rr.rc === 'number' && rr.rc >= PHOTO_ROOF_READ_MIN ? rr.roof : undefined;
    const gabledNow = GABLED_CROWNS.has(String(crown ?? now.crown));
    const roofInView = !gabledNow && !!roofRead && /^(dormers|pitched|mansard)/.test(roofRead);
    const mansard = !gabledNow && ((rr.crown === 'mansard' && rr.cc >= PHOTO_CROWN_MIN) || roofRead === 'mansard');
    const tile = roofInView && /-tile$/.test(roofRead!);
    if (roofInView) photoRoofStoreys++;
    // Round 7: the photo's window dressing (v3 `dress`, dc >= PHOTO_DRESS_MIN) where the kit's row line can draw it;
    // round 8: block-surround and arch-ring reach the row heads (row/solve.ts DRESSING_OF); bands are the row's speklagen extra (BAND_EXTRAS).
    const rd = r as unknown as { dress?: string; dc?: number }, dress = typeof rd.dc === 'number' && rd.dc >= PHOTO_DRESS_MIN && rd.dress ? PHOTO_DRESS_SURROUND[rd.dress] : undefined;
    if (rd.dress && typeof rd.dc === 'number' && rd.dc >= PHOTO_DRESS_MIN) dressTally[rd.dress] = (dressTally[rd.dress] ?? 0) + 1;
    if (fin || crown || pc.tallCornice || pc.storeys || roof || roofInView || mansard || dress) stated.set(pid, { ...now, ...(dress ? { photoDress: dress } : {}), ...(roof || roofInView ? { photoRoof: true } : {}),
      ...(roofInView ? { roofStorey: true } : {}), ...(mansard ? { mansard: true } : {}), ...(tile ? { roofMaterial: 'tile' as const } : {}), ...(fin ? { finish: fin } : {}), ...(crown ? { crown } : {}),
      ...(pc.tallCornice ? { tallCornice: pc.tallCornice } : {}), ...(pc.storeys ? { photoStoreys: pc.storeys } : {}), ...(pc.souterrain !== undefined ? { photoSouterrain: pc.souterrain } : {}) });
  }
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
  const gfp = gableFootPitch([...photo] as [string, Partial<PhotoCrown>][], ahn);
  if (gfp && look.gableFootPitchM === undefined) look.gableFootPitchM = gfp.pitch;
  const res = generateBelt(pands, streets, described, reads, donors, at, stated, ahn, look);
  const records = res.rows.flatMap(r => rowFrontsWithSeries(r));
  let walls: Record<string, number> | null = null, wallWeights: unknown = null;
  if (look.wallDraw) {
    const years = new Map(pands.map(p => { const k = p.id.replace(/^NL\.IMBAG\.Pand\./, ''); return [k, stated.get(k)?.year ?? p.year ?? null] as [string, number | null]; }));
    const streetOf = new Map<string, string>();
    for (const r of districtRows(pands, streets, { singles: true }).rows) for (const m of r.members) streetOf.set(m.pand.id.replace(/^NL\.IMBAG\.Pand\./, ''), m.front.street);
    // The prior: the config's own weights, or another district's measured ones (Nieuwmarkt/Lastage has 9 reads: the Jordaan's).
    let prior: { before1860: any; from1860: any } | undefined;
    const pId = look.wallDraw.prior;
    if (pId && pId !== 'own' && pId !== id) {
      const pl = loadLookDistrict(pId), pp = districtPands({ buurten: pl.buurten } as DistrictLibrary), pr = districtReads(pl, pp, streets);
      const py = new Map(pp.map(p => { const k = p.id.replace(/^NL\.IMBAG\.Pand\./, ''); return [k, stated.get(k)?.year ?? p.year ?? null] as [string, number | null]; }));
      prior = wallEvidence(pl, pr.reads, pr.reads, new Map(), py).weights;
    }
    const ev = wallEvidence(look, own.reads, reads, streetOf, years, prior);
    // measure: false keeps the config's judged weights (the Jordaan: its cut samples are underexposed and read dark, the
    // round-1 fault); the street families still come from the reads.
    const measure = look.wallDraw.measure !== false;
    const cfg = measure ? { ...look.wallDraw, before1860: ev.weights.before1860, from1860: ev.weights.from1860 } : look.wallDraw;
    const sf = new Map<string, JudgedFamily>();
    for (const [pid, st] of streetOf) { const f = ev.streets.get(st); if (f) sf.set(pid, f); }
    // Round 6: the draw takes the confident photo reads' brick mix, the street's own where it has STREET_MIX_MIN.
    const confident = [...photo].flatMap(([pid, r]) => { const f = photoFamily(r, registerFinish.get(pid)); return f ? [{ pid, year: years.get(pid) ?? null, family: f }] : []; });
    const dm = photoMix(confident, cfg, DISTRICT_MIX_MIN), dcfg: WallDrawConfig = { ...cfg, before1860: dm.before1860, from1860: dm.from1860 };
    const byStreetReads = new Map<string, typeof confident>();
    for (const c of confident) { const st = streetOf.get(c.pid); if (st) (byStreetReads.get(st) ?? byStreetReads.set(st, []).get(st)!).push(c); }
    const streetWeights = new Map<string, WallDrawConfig>();
    for (const [st, rs] of byStreetReads) { const m = photoMix(rs, dm, STREET_MIX_MIN); if (m.n.before1860 >= STREET_MIX_MIN || m.n.from1860 >= STREET_MIX_MIN) streetWeights.set(st, { ...dcfg, before1860: m.before1860, from1860: m.from1860 }); }
    walls = drawWalls(records, res.provenance, reads, donors, stated, dcfg, years, sf, photo, registerFinish, streetOf, streetWeights);
    wallWeights = { photoReads: photo.size, measure, prior: pId ?? 'own', reads: ev.reads, measured: ev.weights, photoMix: dm, photoMixStreets: streetWeights.size, drawn: { before1860: dcfg.before1860, from1860: dcfg.from1860 }, streets: Object.fromEntries([...ev.streets].sort()) };
  }
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
  const report = { at, district: id, buurten: look.buurten, pitchM: look.pitchM, foreignDonor: look.foreignDonor, ahnFronts: ahn.size, overSpecs, photoCrowns, gablesBySpread, photoRoofStoreys, photoDress: dressTally, registerGablesDropped: registerGablesDropped.length, registerFinishesDropped, gableFootPitch: gfp, statedPhotoStoreys: [...stated.values()].filter(v => v.photoStoreys).length, specOnlyRedrawn: drawn.filter(p => specOnly.has(p)).length,
    pands: pands.length, described: res.skipped.filter(s => s.reason === 'described').length - laterPeriod.size, laterPeriod: laterPeriod.size, maxYear: look.maxYear ?? null, drawn: drawn.length, ownRead: ownN, donorRead: drawn.length - ownN, donorDistrict,
    ownDonors: own.donors.length, beltDonors: belt.donors.length, rows: res.rows.length, records: records.length, skipped: bySkip, bySegment: bySeg, crowns, storeys, findings,
    statedCrown: drawn.filter(p => stated.get(p)?.crown).length, modernBehindRegister: Object.keys(modern).length, walls, wallWeights, ms: Date.now() - t0 };
  fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify({ ...report, skippedList: res.skipped, laterPeriodList: [...laterPeriod].sort(), modernList: modern }, null, 1));
  console.log(JSON.stringify(report, null, 1));
}
if (process.argv[1]?.endsWith('centrum-looks/generate.ts')) await main();
