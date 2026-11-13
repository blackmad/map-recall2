// Benchmark-v1 label adjudication (D1 step 1c (d)): every disagreement between a describer answer set and the benchmark-v1 labels on
// storeys, bays (upper columns), crown, head, bands and finish gets a third, blind read on the benchmark pose photo; where two of the
// three agree the label takes that value, else the field is marked undecidable and excluded.
//
//   node --import tsx scripts/house-specs/describer-d1/adjudicate.ts queue [--answers <dir>]    write artifacts/describer-d1/adjudicate/queue.json + images
//   echo '{...}' | node --import tsx scripts/house-specs/describer-d1/adjudicate.ts write <pandId> --reader "..."   one third read
//   node --import tsx scripts/house-specs/describer-d1/adjudicate.ts list <from>:<to>                 the blind reader's list
//   node --import tsx scripts/house-specs/describer-d1/adjudicate.ts merge                      write scripts/house-line/benchmark/benchmark-v1-adjudicated.json
//
// The third reader is asked only the disputed fields, in the labels.md vocabulary, and sees neither the label nor the answer.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { readingOf } from '../../../src/canalRecall/houseSpec/describerScore.ts';
import { benchmarkReading } from './truth.ts';
import { loadAnswers } from './score.ts';
import { cutToWall } from './sample.ts';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../..');
const OUT = path.join(ROOT, 'artifacts/describer-d1/adjudicate');
const BENCH = path.join(ROOT, 'scripts/house-line/benchmark/benchmark-v1.json');
const ADJ = path.join(ROOT, 'scripts/house-line/benchmark/benchmark-v1-adjudicated.json');
const SD = process.env.MAP_RECALL_SOURCE_DATA ?? '/Users/blackmad/Code/map-recall2-source-data';
const BENCH_REF = 'refs/heads/lane/facade-f4-benchmark-20261112';
export const ADJ_FIELDS = ['storeys', 'bays', 'crown', 'head', 'bands', 'finish'] as const;
type F = (typeof ADJ_FIELDS)[number];
const json = <T = any>(p: string): T => JSON.parse(fs.readFileSync(p, 'utf8'));

/** A describer reading / a third read, in the labels.md vocabulary of each field. */
export function toLabelVocab(f: F, v: unknown): string | number | boolean | undefined {
  if (v === undefined || v === null || v === 'unknown' || v === 'not-visible') return undefined;
  if (f === 'finish') return v === 'stucco' ? 'render' : (v as string);
  if (f === 'head') return v === 'relieving' ? 'flat' : (v as string);
  return v as string | number | boolean;
}
/** The label value of field f (labels.md vocabulary; bays = the max of the upper columns). */
export function labelValue(labels: any, f: F): string | number | boolean | undefined {
  if (!labels) return undefined;
  if (f === 'storeys') return labels.storeys ?? undefined;
  if (f === 'bays') return Array.isArray(labels.columns) && labels.columns.length > 1 ? Math.max(...labels.columns.slice(1)) : undefined;
  if (f === 'crown') return labels.crown === 'unknown' || labels.crown === 'other' ? undefined : labels.crown;
  if (f === 'head') return labels.windowHead === 'unknown' ? undefined : labels.windowHead;
  if (f === 'bands') return labels.whiteAccents ? !!labels.whiteAccents.bands : undefined;
  if (f === 'finish') return labels.finish === 'mixed' ? undefined : labels.finish;
}

/** Two of three: the value two reads share, else null (undecidable). */
export function twoOfThree(label: unknown, describer: unknown, third: unknown): { value: unknown; by: 'label' | 'describer' | 'both' } | null {
  if (third === undefined) return null;
  if (third === label) return { value: label, by: third === describer ? 'both' : 'label' };
  if (third === describer) return { value: describer, by: 'describer' };
  return null;
}

async function queue(answersDir: string) {
  const answers = loadAnswers(answersDir), bench = json(BENCH);
  fs.mkdirSync(path.join(OUT, 'images'), { recursive: true });
  const rows: { pandId: string; fields: F[]; describer: Record<string, unknown>; image: string }[] = [];
  for (const p of bench.pands) {
    if (!p.readable) continue;
    const a = answers.get(p.pandId); if (!a) continue;
    const ra = readingOf(a) as Record<string, unknown>;
    const fields: F[] = [], describer: Record<string, unknown> = {};
    for (const f of ADJ_FIELDS) {
      const lv = labelValue(p.labels, f), dv = toLabelVocab(f, ra[f]);
      if (lv === undefined || dv === undefined) continue;
      if (lv !== dv) { fields.push(f); describer[f] = dv; }
    }
    if (!fields.length) continue;
    const image = path.join(OUT, 'images', `${p.pandId}.jpg`);
    if (!fs.existsSync(image)) {
      const rel = `experiments/facade-benchmark/round-0/frames/${p.pandId}`;
      const photo = execFileSync('/usr/bin/git', ['-C', SD, 'show', `${BENCH_REF}:${rel}/photo.jpg`], { maxBuffer: 64 << 20 });
      const pose = JSON.parse(execFileSync('/usr/bin/git', ['-C', SD, 'show', `${BENCH_REF}:${rel}/pose.json`], { encoding: 'utf8' }));
      fs.writeFileSync(image, await cutToWall(photo, pose));
    }
    rows.push({ pandId: p.pandId, fields, describer, image });
  }
  fs.writeFileSync(path.join(OUT, 'queue.json'), `${JSON.stringify({ v: 1, answers: path.relative(ROOT, answersDir), n: rows.length, cells: rows.reduce((s, r) => s + r.fields.length, 0), rows }, null, 1)}\n`);
  console.log(`queue: ${rows.length} pands, ${rows.reduce((s, r) => s + r.fields.length, 0)} disputed fields`);
}

const VOCAB: Record<F, string> = {
  storeys: 'integer', bays: 'integer', crown: 'step|neck|bell|spout|point|cornice|flat|mansard|pitched-eaves|other',
  head: 'flat|segmental|round|pointed|mixed', bands: 'boolean', finish: 'brick|painted-brick|render|stone|mixed',
};
function write(pandId: string, reader: string) {
  const q = json(path.join(OUT, 'queue.json')).rows.find((r: any) => r.pandId === pandId);
  if (!q) { console.error(`${pandId} not in the queue`); process.exit(2); }
  const body = JSON.parse(fs.readFileSync(0, 'utf8'));
  const p: string[] = [];
  for (const f of q.fields as F[]) {
    const v = body[f];
    if (v === 'unknown') continue;
    if (v === undefined) p.push(`${f}: missing (give ${VOCAB[f]} or "unknown")`);
    else if (VOCAB[f] === 'integer' ? !Number.isInteger(v) : VOCAB[f] === 'boolean' ? typeof v !== 'boolean' : !VOCAB[f].split('|').includes(v)) p.push(`${f}: ${JSON.stringify(v)} not ${VOCAB[f]}`);
  }
  if (p.length) { console.error(p.join('\n')); process.exit(1); }
  fs.mkdirSync(path.join(OUT, 'third'), { recursive: true });
  fs.writeFileSync(path.join(OUT, 'third', `${pandId}.json`), `${JSON.stringify({ pandId, reader, ...Object.fromEntries((q.fields as F[]).map(f => [f, body[f]])), notes: body.notes }, null, 1)}\n`);
  console.log(`ok ${pandId}`);
}

function merge() {
  const q = json(path.join(OUT, 'queue.json')), bench = json(BENCH);
  const out = JSON.parse(JSON.stringify(bench));
  out.adjudication = { date: new Date().toISOString().slice(0, 10), lane: 'D1 step 1c', rule: 'describer (D1 opus, prompt v1) vs label disagreements on storeys, bays, crown, head, bands, finish; a blind third read on the pose photo; two of three fix the label, else the field is undecidable (labels.<field> excluded via adjudicated.undecidable)', answers: q.answers };
  const tally: Record<string, Record<string, number>> = {};
  for (const r of q.rows) {
    const third = (() => { try { return json(path.join(OUT, 'third', `${r.pandId}.json`)); } catch { return null; } })();
    const p = out.pands.find((x: any) => x.pandId === r.pandId);
    const adj: any = (p.adjudicated ??= { changed: {}, kept: [], undecidable: [] });
    for (const f of r.fields as F[]) {
      const t = (tally[f] ??= { label: 0, describer: 0, undecidable: 0 });
      const lv = labelValue(p.labels, f), tv = third ? toLabelVocab(f, third[f]) : undefined;
      const res = twoOfThree(lv, r.describer[f], tv);
      if (!res) { adj.undecidable.push(f); t.undecidable++; continue; }
      if (res.by === 'label') { adj.kept.push(f); t.label++; continue; }
      t.describer++;
      adj.changed[f] = { from: lv, to: res.value };
      if (f === 'storeys') p.labels.storeys = res.value;
      else if (f === 'bays') p.labels.columns = [p.labels.columns[0], ...p.labels.columns.slice(1).map(() => res.value)];
      else if (f === 'crown') p.labels.crown = res.value;
      else if (f === 'head') p.labels.windowHead = res.value;
      else if (f === 'bands') p.labels.whiteAccents = { ...p.labels.whiteAccents, bands: res.value };
      else if (f === 'finish') p.labels.finish = res.value;
    }
  }
  out.adjudication.tally = tally;
  fs.writeFileSync(ADJ, `${JSON.stringify(out, null, 1)}\n`);
  console.log(JSON.stringify(tally));
}

/** benchmark-v1-adjudicated labels with undecidable fields removed (for truth.ts). */
export function adjudicatedPands(): any[] {
  const d = json(ADJ);
  return d.pands.map((p: any) => {
    const und: string[] = p.adjudicated?.undecidable ?? [];
    if (!und.length || !p.labels) return p;
    const L = { ...p.labels };
    if (und.includes('storeys')) delete L.storeys;
    if (und.includes('bays')) delete L.columns;
    if (und.includes('crown')) L.crown = 'unknown';
    if (und.includes('head')) L.windowHead = 'unknown';
    if (und.includes('bands')) L.whiteAccents = { ...L.whiteAccents, bands: undefined };
    if (und.includes('finish')) L.finish = 'mixed';
    return { ...p, labels: L };
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [cmd, id] = process.argv.slice(2);
  const opt = (n: string) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? process.argv[i + 1] : undefined; };
  if (cmd === 'queue') await queue(opt('answers') ?? path.join(ROOT, 'artifacts/describer-d1/answers'));
  else if (cmd === 'write') write(id, opt('reader') ?? 'adjudicator');
  else if (cmd === 'merge') merge();
  else if (cmd === 'list') { // the blind reader's view: pand, image, fields to read (no label, no answer)
    const [a, b] = (id ?? '0:9999').split(':').map(Number);
    for (const r of json(path.join(OUT, 'queue.json')).rows.slice(a, b)) console.log(`${r.pandId} ${r.image} ${r.fields.join(',')}`);
  }
  else console.log('adjudicate.ts queue | write <pandId> | merge');
}
