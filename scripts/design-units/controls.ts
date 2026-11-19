/**
 * Design units, phase 0 gate: agreement of the staged index with groupings we already trust.
 *
 *   node --import tsx scripts/design-units/controls.ts [--same-building <file>[,<file>]]
 *
 *   1. The published row fronts David liked (public/data/front-records/row-front.json: Rivierenbuurt, Apollo/Stadion,
 *      Kinkerstraat; the positive control). A unit that holds two series drawn differently (storeys, crown family, or an
 *      eaves step over 0.8 m) contradicts them; a series spread over units of different architects is a softer
 *      disagreement (the look flattened designs, or the layer over-splits); a series over units of one architect and
 *      year is a repeated design (family), consistent.
 *   2. Face intents (scripts/block-face/faces/<face>/intent.json): corniceGroups, identical, sameAs.
 *   3. The Centrum lane's photo-confirmed same-building runs (lane/centrum-looks-20261115 data/buurt-generators/<d>/
 *      same-building.json, opus reads at >= 0.6): `one` runs should share a unit; `separate` runs should not.
 *
 * Reads artifacts/design-units/staging/design-units.json; writes artifacts/design-units/staging/controls.json.
 */
import fs from 'node:fs';
import path from 'node:path';
import type { DesignUnit } from '../../src/canalRecall/designUnits/types.ts';

const ROOT = path.resolve(import.meta.dirname, '../..');
const STAGING = path.join(ROOT, 'artifacts/design-units/staging');
const idx = JSON.parse(fs.readFileSync(path.join(STAGING, 'design-units.json'), 'utf8')) as { units: DesignUnit[] };
const unitOf = new Map<string, DesignUnit>();
for (const u of idx.units) for (const m of u.members) unitOf.set(m, u);
const norm = (s: string) => s.replace(/^NL\.IMBAG\.Pand\./, '');
const inObj = (p: string) => !!unitOf.get(p)?.object;
const pct = (a: number, b: number) => (b ? `${(100 * a / b).toFixed(1)}%` : 'n/a');

// --- 1. published row fronts ---------------------------------------------------------------------------------------
type Rec = { pandId: string; storeys?: number; eavesM?: number; crown?: { family?: string }; series?: { id: string }; buurtKit?: unknown; sources?: { record?: string } };
const recs = (JSON.parse(fs.readFileSync(path.join(ROOT, 'public/data/front-records/row-front.json'), 'utf8')).records as Rec[]).filter(r => r.series?.id);
const recOf = new Map(recs.map(r => [norm(r.pandId), r]));
const inRing = recs.filter(r => unitOf.has(norm(r.pandId)));
const seriesOfP = (p: string) => recOf.get(p)!.series!.id;
const drawnDiffer = (a: Rec, b: Rec) => (a.storeys ?? -1) !== (b.storeys ?? -1) || (a.crown?.family ?? '') !== (b.crown?.family ?? '') || Math.abs((a.eavesM ?? 0) - (b.eavesM ?? 0)) > 0.8;
// Units holding >= 2 published members.
let unitsWithRecs = 0, unitsMultiSeries = 0, unitsContradict = 0, pandsInContradict = 0;
const contradictions: Array<{ unit: string; series: string[]; members: number; why: string }> = [];
const byUnit = new Map<string, string[]>();
for (const r of inRing) { const p = norm(r.pandId), u = unitOf.get(p)!; if (!u.object) continue; (byUnit.get(u.id) ?? byUnit.set(u.id, []).get(u.id)!).push(p); }
for (const [uid, ps] of byUnit) {
  if (ps.length < 2) continue;
  unitsWithRecs++;
  const ser = [...new Set(ps.map(seriesOfP))];
  if (ser.length < 2) continue;
  unitsMultiSeries++;
  // Contradiction: two members in the unit drawn as different designs.
  const reps = ser.map(s => recOf.get(ps.find(p => seriesOfP(p) === s)!)!);
  const differ = reps.some((a, i) => reps.slice(i + 1).some(b => drawnDiffer(a, b)));
  if (differ) {
    unitsContradict++; pandsInContradict += ps.length;
    const why = reps.map(r => `${r.series!.id.split(':').pop()} ${r.storeys}st ${r.crown?.family} ${r.eavesM}m`).join(' | ');
    contradictions.push({ unit: uid, series: ser, members: ps.length, why });
  }
}
// Series with >= 2 members, all in objects.
let seriesN = 0, seriesOneUnit = 0, seriesFamily = 0, seriesArchitects = 0, seriesPartlyInferred = 0;
const seriesSplits: Array<{ series: string; units: string[]; architects: string[] }> = [];
const bySeries = new Map<string, string[]>();
for (const r of inRing) (bySeries.get(r.series!.id) ?? bySeries.set(r.series!.id, []).get(r.series!.id)!).push(norm(r.pandId));
for (const [sid, ps] of bySeries) {
  if (ps.length < 2) continue;
  if (!ps.every(inObj)) { seriesPartlyInferred++; continue; }
  seriesN++;
  const us = [...new Set(ps.map(p => unitOf.get(p)!))];
  if (us.length === 1) { seriesOneUnit++; continue; }
  const arch = [...new Set(us.map(u => `${u.object!.architectNr ?? '?'}`))];
  const fam = new Set(us.map(u => `${u.object!.architectNr ?? '?'}/${u.object!.year ?? '?'}`));
  if (fam.size === 1 && !arch.includes('?')) seriesFamily++;
  else { seriesArchitects++; seriesSplits.push({ series: sid, units: us.map(u => u.id), architects: us.map(u => u.object!.architect ?? '?') }); }
}
const pub = {
  records: recs.length, inRing: inRing.length, inRingInObject: inRing.filter(r => inObj(norm(r.pandId))).length,
  unitsWithTwoOrMoreRecords: unitsWithRecs, unitsSpanningSeries: unitsMultiSeries, unitsContradicting: unitsContradict, pandsInContradictingUnits: pandsInContradict,
  pandsInUnitsWithRecords: [...byUnit.values()].filter(ps => ps.length >= 2).reduce((t, ps) => t + ps.length, 0),
  seriesTwoPlusAllInObjects: seriesN, seriesInOneUnit: seriesOneUnit, seriesOverOneFamily: seriesFamily, seriesOverSeveralArchitects: seriesArchitects, seriesPartlyOutsideObjects: seriesPartlyInferred,
  contradictionSamples: contradictions.slice(0, 25), seriesSplitSamples: seriesSplits.slice(0, 15),
};

// --- 2. face intents -----------------------------------------------------------------------------------------------
const FACES = path.join(ROOT, 'scripts/block-face/faces');
const groupsBy: Record<string, { n: number; oneUnit: number; allInObject: number; sameFamily: number; unknown: number }> = {};
const tally = (kind: string, ps: string[]) => {
  const g = (groupsBy[kind] ??= { n: 0, oneUnit: 0, allInObject: 0, sameFamily: 0, unknown: 0 });
  const us = ps.map(p => unitOf.get(norm(p)));
  if (us.some(u => !u)) { g.unknown++; return; }
  g.n++;
  if (ps.every(p => inObj(norm(p)))) g.allInObject++;
  if (new Set(us.map(u => u!.id)).size === 1) g.oneUnit++;
  else if (new Set(us.map(u => u!.object ? `${u!.object.architectNr ?? '?'}/${u!.object.year ?? '?'}` : 'x')).size === 1 && us.every(u => u!.object?.architectNr)) g.sameFamily++;
};
for (const face of fs.readdirSync(FACES)) {
  const f = path.join(FACES, face, 'intent.json'); if (!fs.existsSync(f)) continue;
  const d = JSON.parse(fs.readFileSync(f, 'utf8'));
  for (const g of d.continuity?.corniceGroups ?? []) tally('corniceGroups', g.pands);
  for (const g of d.continuity?.identical ?? []) tally('identical', g.pands);
  for (const h of d.houses ?? []) if (h.sameAs) tally('sameAs', [h.pandId, h.sameAs]);
}

// --- 3. same-building runs -----------------------------------------------------------------------------------------
const sbArg = process.argv.indexOf('--same-building');
const sbFiles = sbArg >= 0 ? process.argv[sbArg + 1].split(',') : [];
const sb = { one: { n: 0, oneUnit: 0, split: 0, uncovered: 0, partlyInferred: 0 }, separate: { n: 0, oneUnit: 0, split: 0, uncovered: 0, partlyInferred: 0 }, samplesDisagree: [] as string[] };
for (const file of sbFiles) for (const r of (JSON.parse(fs.readFileSync(file, 'utf8')).runs as Array<{ pids: string[]; answer: string; confidence?: number }>)) {
  if ((r.confidence ?? 0) < 0.6 || (r.answer !== 'one' && r.answer !== 'separate')) continue;
  const t = sb[r.answer as 'one' | 'separate'];
  const us = r.pids.map(p => unitOf.get(norm(p)));
  if (us.some(u => !u)) { t.uncovered++; continue; }
  t.n++;
  if (!r.pids.every(p => inObj(norm(p)))) t.partlyInferred++;
  const one = new Set(us.map(u => u!.id)).size === 1;
  if (one) t.oneUnit++; else t.split++;
  if ((r.answer === 'one') !== one && sb.samplesDisagree.length < 20) sb.samplesDisagree.push(`${path.basename(file)} ${r.answer}: ${r.pids.map(p => `${norm(p).slice(-6)}→${unitOf.get(norm(p))!.id.replace(/^0363100012/, '')}`).join(' ')}`);
}

const out = { publishedRows: pub, faceIntents: groupsBy, sameBuilding: sb };
fs.writeFileSync(path.join(STAGING, 'controls.json'), JSON.stringify(out, null, 1));
console.log(JSON.stringify(out, null, 1));
console.log(`published: ${pct(pub.inRingInObject, pub.inRing)} of ring records in an object; contradicting units ${pub.unitsContradicting}/${pub.unitsWithTwoOrMoreRecords} (${pct(pub.pandsInContradictingUnits, pub.pandsInUnitsWithRecords)} of their pands)`);
