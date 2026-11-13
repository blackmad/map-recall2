// Describer D1 scorer: per-field accuracy of a describer answer set against the truth sets, or per-field agreement of two answer sets
// (the P3a photo-vs-game comparison, or opus vs sonnet).
//
//   node --import tsx scripts/house-specs/describer-d1/score.ts [--answers <dir>] [--out <file>]           answers vs truth
//   node --import tsx scripts/house-specs/describer-d1/score.ts --answers <dirA> --b <dirB> [--out <file>] answers A vs answers B
//
// Truth (truth.ts): benchmark-v1 labels, hand set v1 reader A, author hand specs; a pand-field is pooled once, by the first truth
// that states it (benchmark > hand-set > hand-spec). Columns: all images, gate-pass crops, gate-fail crops, pose photos. Coverage =
// the share of truth-stated pand-fields the describer answered (not `not-visible`). Accuracy is over the answered ones (Wilson 95 %).
// Writes per field, per set, per column, confusions, the pale/painted wall subsets and per-house cells to --out (default
// artifacts/describer-d1/scores.json) and prints the markdown table.
import fs from 'node:fs';
import path from 'node:path';
import { UNKNOWN, validateAnswer, type DescriberAnswer } from '../../../src/canalRecall/houseSpec/describer.ts';
import { SCORE_FIELDS, compare, confusion, readingOf, tabulate, type Cell, type Reading, type ScoreField } from '../../../src/canalRecall/houseSpec/describerScore.ts';
import { loadTruth } from './truth.ts';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../..');
const TRUTH_ORDER = ['benchmark', 'hand-set', 'hand-spec'] as const;
const CONFUSE: ScoreField[] = ['crown', 'windowFamily', 'head', 'wallFamily', 'finish', 'doorBay', 'shop', 'bands', 'surrounds'];
const PALE = new Set(['white', 'buff', 'grey']);

export function loadAnswers(dir: string): Map<string, DescriberAnswer> {
  const m = new Map<string, DescriberAnswer>();
  for (const f of fs.readdirSync(dir).filter(f => /^\d{16}\.json$/.test(f))) { const a = validateAnswer(JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'))); m.set(a.pandId, a); }
  return m;
}

/** The image column of an answer: gate-pass / gate-fail crop, or a photo/render. */
export const columnOf = (a: DescriberAnswer): string => a.image.kind === 'crop' ? (a.image.gate === 'fail' ? 'crop-gate-fail' : 'crop-gate-pass') : a.image.kind;

/** One truth Reading per pand: each field from the first set (TRUTH_ORDER) that states it. */
export function pooledTruth(sets: Map<string, Reading>): Reading | null {
  let out: Reading | null = null;
  for (const s of TRUTH_ORDER) {
    const r = sets.get(s);
    if (!r || r.scorable === false) continue;
    out ??= { pandId: r.pandId, scorable: true };
    for (const [k, v] of Object.entries(r)) if (!(k in out) && v !== undefined) (out as any)[k] = v;
  }
  return out;
}

/** Coverage per field: of the truth-stated fields, the share the answer did not leave not-visible. */
export function coverage(pairs: { a: DescriberAnswer; t: Reading }[], fields: readonly ScoreField[] = SCORE_FIELDS) {
  return Object.fromEntries(fields.map(f => {
    const base = f.replace('±1', '') as keyof Reading;
    const stated = pairs.filter(p => p.t[base] !== undefined && p.a.readable !== undefined);
    const answered = stated.filter(p => (readingOf(p.a) as any)[base] !== undefined);
    return [f, { stated: stated.length, answered: answered.length, share: stated.length ? +(answered.length / stated.length).toFixed(3) : null }];
  }));
}

function table(title: string, cells: Cell[], cov?: Record<string, { share: number | null }>): string {
  const rows = tabulate(cells).filter(r => r.n > 0);
  return [`### ${title}`, '', '| field | acc | n | 95 % CI | coverage | >= 0.8 |', '|---|---|---|---|---|---|',
    ...rows.map(r => `| ${r.field} | ${r.acc} | ${r.n} | ${r.lo}-${r.hi} | ${cov?.[r.field]?.share ?? ''} | ${r.pass ? 'yes' : 'no'} |`), ''].join('\n');
}

function main() {
  const argv = process.argv.slice(2);
  const opt = (n: string) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : undefined; };
  const A = loadAnswers(opt('answers') ?? path.join(ROOT, 'artifacts/describer-d1/answers'));
  const out = opt('out') ?? path.join(ROOT, 'artifacts/describer-d1', opt('b') ? 'agreement.json' : 'scores.json');
  const md: string[] = [];
  if (opt('b')) {
    const B = loadAnswers(opt('b')!);
    const perHouse: Record<string, Cell[]> = {}, cells: Cell[] = [];
    for (const [id, a] of A) { const b = B.get(id); if (!b) continue; const c = compare(readingOf(a), readingOf(b)); perHouse[id] = c; cells.push(...c); }
    md.push(table(`agreement ${path.basename(opt('answers') ?? 'answers')} vs ${path.basename(opt('b')!)} (${Object.keys(perHouse).length} pands)`, cells));
    fs.writeFileSync(out, `${JSON.stringify({ v: 1, mode: 'a-vs-b', fields: tabulate(cells), confusions: Object.fromEntries(CONFUSE.map(f => [f, confusion(cells, f)])), perHouse }, null, 1)}\n`);
    console.log(md.join('\n'));
    return;
  }
  const truth = loadTruth(ROOT);
  const perHouse: Record<string, { column: string; sets: string[]; cells: Cell[] }> = {};
  const bySet: Record<string, Cell[]> = {}, byColumn: Record<string, Cell[]> = {}, pooled: Cell[] = [];
  const pairs: { a: DescriberAnswer; t: Reading; column: string }[] = [];
  for (const [id, a] of A) {
    const sets = truth.get(id);
    if (!sets) continue;
    const ra = readingOf(a);
    for (const [s, t] of sets) if (t.scorable !== false) (bySet[s] ??= []).push(...compare(ra, t));
    const t = pooledTruth(sets);
    if (!t) continue;
    const c = compare(ra, t), col = columnOf(a);
    pooled.push(...c); (byColumn[col] ??= []).push(...c);
    pairs.push({ a, t, column: col });
    perHouse[id] = { column: col, sets: [...sets.keys()], cells: c };
  }
  const cov = coverage(pairs);
  md.push(table(`pooled truth (${pairs.length} pands)`, pooled, cov));
  for (const [col, cs] of Object.entries(byColumn)) md.push(table(`column ${col} (${pairs.filter(p => p.column === col).length} pands)`, cs, coverage(pairs.filter(p => p.column === col))));
  for (const [s, cs] of Object.entries(bySet)) md.push(table(`truth set ${s}`, cs));
  // pale and painted walls (the wall-colour line): wallFamily and finish on the subsets
  const truthPale = (t: Reading) => { const w = t.wallFamily; return w !== undefined && (Array.isArray(w) ? w : [w]).some(x => PALE.has(String(x))); };
  const truthPainted = (t: Reading) => t.finish === 'painted-brick' || t.finish === 'stucco';
  const sub = (pred: (t: Reading) => boolean) => pairs.filter(p => pred(p.t)).flatMap(p => compare(readingOf(p.a), p.t, ['wallFamily', 'finish']));
  const subsets = { pale: sub(truthPale), notPale: sub(t => t.wallFamily !== undefined && !truthPale(t)), painted: sub(truthPainted), bareBrick: sub(t => t.finish === 'brick') };
  for (const [k, cs] of Object.entries(subsets)) md.push(table(`wall subset ${k}`, cs));
  const confusions = Object.fromEntries(CONFUSE.map(f => [f, confusion(pooled, f)]));
  fs.writeFileSync(out, `${JSON.stringify({ v: 1, mode: 'vs-truth', pands: pairs.length, fields: tabulate(pooled), coverage: cov,
    byColumn: Object.fromEntries(Object.entries(byColumn).map(([k, cs]) => [k, tabulate(cs)])),
    bySet: Object.fromEntries(Object.entries(bySet).map(([k, cs]) => [k, tabulate(cs)])),
    subsets: Object.fromEntries(Object.entries(subsets).map(([k, cs]) => [k, tabulate(cs, 0.8, ['wallFamily', 'finish'])])),
    confusions, perHouse }, null, 1)}\n`);
  md.push('### confusions (truth -> answer)', '', '```', ...CONFUSE.map(f => `${f}: ${JSON.stringify(confusions[f])}`), '```');
  console.log(md.join('\n'));
}

export { UNKNOWN };
if (import.meta.url === `file://${process.argv[1]}`) main();
