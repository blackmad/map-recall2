/**
 * house:rows scores (lane D, #386): D1 series consensus against the face intents, per field, on one street's typed
 * faces (default Kinkerstraat: 22 faces with an intent, 208 pands). This replaces single-house precision as the staging
 * gate (programme brief "Scores").
 *
 *   node --import tsx scripts/house-specs/rows/scores.ts [--street kinkerstraat] [--answers <dir>] [--out <json>]
 *
 * Per face: the row is solved twice, with the face (the truth) and without it (reads only: series from read signatures,
 * mode and median per series). For every pand with a D1 reading and a face statement, each field scores 1 when the
 * read-only series value is the face's class (houseSpec/row/solve.ts `compatible`), and the single read is scored the same
 * way beside it. Writes artifacts/house-rows/scores-<street>.json and prints the table.
 */
import fs from 'node:fs';
import path from 'node:path';
import { REPO, type RowDef } from './rowDefs.ts';
import { loadRow } from './house-rows.ts';
import { solveRow, readValues, compatible, headsList, type FaceFront } from '../../../src/canalRecall/houseSpec/row/solve.ts';
import { frontDesign, type RowDesign } from '../../../src/canalRecall/houseSpec/row/types.ts';

const argv = process.argv.slice(2);
const arg = (k: string) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : undefined; };
const street = arg('street') ?? 'kinkerstraat';
const D1_ROOT = process.env.ROW_D1_ROOT ?? JSON.parse(fs.readFileSync(path.join(REPO, 'scripts/house-specs/rows/rows.json'), 'utf8')).d1Root;
// Comma list, first found wins (round 2: the ring tranche, then the earlier street tranche, as rows.json states it).
const answersDirs = (arg('answers') ?? ['ring-20261114/answers', 'answers'].map(d => path.join(D1_ROOT, d)).join(',')).split(',').map(d => path.resolve(d));
const answersDir = answersDirs[0];
const survey = JSON.parse(fs.readFileSync(path.join(REPO, 'scripts/street-surveys/streets', `${street}.json`), 'utf8'));

type Field = 'crown' | 'cornice' | 'storeys' | 'bays' | 'windows' | 'heads' | 'wallFamily' | 'dormers' | 'dormerKind' | 'roofStorey';
const FIELDS: Field[] = ['crown', 'cornice', 'storeys', 'bays', 'windows', 'heads', 'wallFamily', 'roofStorey', 'dormers', 'dormerKind'];
const faceVal = (f: FaceFront, k: Field): unknown => k === 'wallFamily' ? f.wallFamily : k === 'dormers' ? (f.dormers ?? 0) > 0 : k === 'dormerKind' ? f.dormerKind : k === 'heads' ? f.heads?.dressing : k === 'roofStorey' ? f.roofKind : (f as Record<string, unknown>)[k];
const rowVal = (d: RowDesign, k: Field): unknown => k === 'wallFamily' ? d.wall.value.family : k === 'dormers' ? d.roofStorey.value.dormersPerFront > 0 : k === 'dormerKind' ? d.roofStorey.value.dormerKind
  : k === 'heads' ? headsList(d.heads.value)[0]?.dressing : k === 'roofStorey' ? d.roofStorey.value.kind : (d[k as keyof RowDesign]?.value);
const readVal = (r: ReturnType<typeof readValues>, k: Field, n: number): unknown => k === 'wallFamily' ? (r.wall as { family?: string } | undefined)?.family : k === 'dormers' ? (r.dormers ? r.dormers.count > 0 : undefined)
  : k === 'dormerKind' ? r.dormers?.kind : k === 'heads' ? headsList(r.heads as never)[0]?.dressing : k === 'roofStorey' ? r.roofKind : k === 'bays' && r.bays ? Math.round((r.bays as number) / n) : r[k as keyof typeof r];
const cf = (k: Field) => k === 'heads' ? 'headsDressing' : k;
const same = (k: Field, a: unknown, b: unknown) => k === 'heads' ? compatible('heads', { dressing: a }, { dressing: b }) : compatible(cf(k), a, b);

const tally: Record<Field, { n: number; series: number; single: number; seriesStated: number }> = Object.fromEntries(FIELDS.map(f => [f, { n: 0, series: 0, single: 0, seriesStated: 0 }])) as never;
const misses: Array<{ face: string; pandId: string; field: Field; face_: unknown; series: unknown; single: unknown; source: string }> = [];
let faces = 0, pands = 0, read = 0;
const perFace: Record<string, { pands: number; read: number; n: number; series: number; single: number }> = {};
for (const fc of survey.faces as Array<{ id: string; members: string[] }>) {
  const dir = path.join(REPO, 'scripts/block-face/faces', fc.id);
  if (!fs.existsSync(path.join(dir, 'intent.json'))) continue;
  const intent = JSON.parse(fs.readFileSync(path.join(dir, 'intent.json'), 'utf8'));
  const def: RowDef = { id: fc.id, title: `${survey.street} ${fc.id}`, face: fc.id, members: intent.houses.map((h: { pandId: string; address?: string }) => ({ pandId: h.pandId, label: h.address ?? h.pandId, widthM: 0 })),
    cutsDir: path.join(answersDir, '../cuts'), answersDir, answersDirs, cutsDirs: answersDirs.map(d => path.join(d, '../cuts')) };
  const l = loadRow(def, '2026-11-14', street);
  faces++; pands += l.input.members.length;
  const ft = (perFace[fc.id] ??= { pands: l.input.members.length, read: 0, n: 0, series: 0, single: 0 });
  const readOnly = solveRow({ ...l.input, face: undefined, members: l.input.members.map(m => ({ ...m, face: undefined })) });
  for (const m of l.input.members) {
    if (!m.read || !m.face?.length) continue;
    const front = readOnly.fronts.find(f => f.pandId === m.pandId)!;
    if (front.readHeld) continue;
    read++; ft.read++;
    const d = frontDesign(readOnly, front);
    const rv = readValues(m.read, m.built);
    const n = readOnly.members.find(x => x.pandId === m.pandId)!.fronts.length;
    for (const k of FIELDS) {
      const truth = faceVal(m.face[0], k);
      if (truth === undefined) continue;
      const t = tally[k]; t.n++;
      const sv = rowVal(d, k), single = readVal(rv, k, Math.max(n, m.face.length));
      const src = k === 'wallFamily' ? d.wall.source : k === 'dormers' || k === 'dormerKind' || k === 'roofStorey' ? d.roofStorey.source : d[k as keyof RowDesign]?.source ?? '-';
      if (src === 'series-consensus' || src === 'single-read') t.seriesStated++;
      ft.n++; if (single !== undefined && same(k, truth, single)) ft.single++;
      if (sv !== undefined && same(k, truth, sv)) { t.series++; ft.series++; } else misses.push({ face: fc.id, pandId: m.pandId, field: k, face_: truth, series: sv, single, source: src });
      if (single !== undefined && same(k, truth, single)) t.single++;
    }
  }
}
const pct = (a: number, b: number) => b ? `${Math.round(a / b * 1000) / 10}%` : '-';
const out = { street, faces, pands, read, answersDirs, perFace: Object.fromEntries(Object.entries(perFace).map(([k, v]) => [k, { ...v, seriesAgree: v.n ? v.series / v.n : null, singleAgree: v.n ? v.single / v.n : null }])), fields: Object.fromEntries(FIELDS.map(k => [k, { ...tally[k], seriesAgree: tally[k].n ? tally[k].series / tally[k].n : null, singleAgree: tally[k].n ? tally[k].single / tally[k].n : null }])), misses };
const file = arg('out') ?? path.join(REPO, `artifacts/house-rows/scores-${street}.json`);
fs.mkdirSync(path.dirname(file), { recursive: true });
fs.writeFileSync(file, JSON.stringify(out, null, 1) + '\n');
console.log(`${survey.street}: ${faces} faces with an intent, ${pands} pands, ${read} with a usable D1 reading -> ${path.relative(REPO, file)}`);
console.log('| field | compared | series consensus agrees | single read agrees | series value from reads |');
console.log('|---|---|---|---|---|');
for (const k of FIELDS) { const t = tally[k]; console.log(`| ${k} | ${t.n} | ${pct(t.series, t.n)} | ${pct(t.single, t.n)} | ${pct(t.seriesStated, t.n)} |`); }
console.log('\n| face | pands | with a read | fields compared | series agrees | single read agrees |');
console.log('|---|---|---|---|---|---|');
for (const [k, v] of Object.entries(perFace)) console.log(`| ${k} | ${v.pands} | ${v.read} | ${v.n} | ${pct(v.series, v.n)} | ${pct(v.single, v.n)} |`);
