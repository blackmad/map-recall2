// D1-fix row convention check: the staged storeys are rows below the crown with the ground row included, whatever the ground is.
// Scores the staged storeys of describer answer sets on the adjudicated benchmark-v1 labels pooled with hand set v1 and author
// hand specs (score.ts truth, benchmark first), exact and within one with Wilson 95 % intervals, overall and per ground kind
// (describer.ts groundKindOf), before (stage 69b0c49: the answer's storeys) and after (stage.ts stageOne now), and counts the
// row-consistency problems (columns rows vs storeys) that a ground left out of the count would raise.
//
//   node --import tsx scripts/house-specs/describer-d1/rows.ts [--answers <dir>,<dir>...] [--out <json>]
import fs from 'node:fs';
import path from 'node:path';
import { GROUND_KINDS, groundKindOf, rowProblems, UNKNOWN, type DescriberAnswer } from '../../../src/canalRecall/houseSpec/describer.ts';
import { wilson, type Reading } from '../../../src/canalRecall/houseSpec/describerScore.ts';
import { loadAnswers, pooledTruth } from './score.ts';
import { loadTruth } from './truth.ts';
import { adjudicatedPands } from './adjudicate.ts';
import { stageOne } from './stage.ts';

type Pair = { id: string; kind: string; truth: number; set: string; before: number; after: number | undefined };
export type RowStat = { n: number; exact: number; exactCI: [number, number]; within1: number; within1CI: [number, number]; under: number; over: number };

export function rowStat(pairs: { truth: number; read: number | undefined }[]): RowStat {
  const p = pairs.filter(x => x.read !== undefined) as { truth: number; read: number }[];
  const ex = p.filter(x => x.read === x.truth).length, w1 = p.filter(x => Math.abs(x.read - x.truth) <= 1).length;
  return { n: p.length, exact: +(ex / Math.max(1, p.length)).toFixed(3), exactCI: wilson(ex, p.length), within1: +(w1 / Math.max(1, p.length)).toFixed(3), within1CI: wilson(w1, p.length),
    under: p.filter(x => x.read < x.truth).length, over: p.filter(x => x.read > x.truth).length };
}

/** The pand-storey pairs an answer set can be scored on (readable single fronts, an answered count, a truth count). */
export function rowPairs(A: Map<string, DescriberAnswer>, truth: Map<string, Map<string, Reading>>): Pair[] {
  const out: Pair[] = [];
  for (const [id, a] of A) {
    const sets = truth.get(id); if (!sets || !a.readable || a.extent === 'multi' || !Number.isInteger(a.storeys)) continue;
    const t = pooledTruth(sets); if (!t || typeof t.storeys !== 'number') continue;
    const set = ['benchmark', 'hand-set', 'hand-spec'].find(s => (sets.get(s) as Reading | undefined)?.storeys !== undefined) ?? '?';
    const after = stageOne(a, null, null).design.fronts?.[0]?.storeys as number | undefined;
    out.push({ id, kind: String(groundKindOf(a)), truth: t.storeys, set, before: a.storeys as number, after });
  }
  return out;
}

function main() {
  const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../..');
  const D = path.join(ROOT, 'artifacts/describer-d1');
  const args = process.argv.slice(2), opt = (k: string) => (args.includes(`--${k}`) ? args[args.indexOf(`--${k}`) + 1] : undefined);
  const dirs = (opt('answers') ?? 'answers-v4-crop,answers-v4-cut,answers-v4-crop-sonnet').split(',');
  const truth = loadTruth(ROOT, adjudicatedPands());
  const report: Record<string, unknown> = {};
  const md: string[] = [];
  for (const d of dirs) {
    const A = loadAnswers(path.isAbsolute(d) ? d : path.join(D, d));
    const pairs = rowPairs(A, truth);
    const rowIssues = [...A.values()].filter(a => rowProblems(a).length).map(a => a.pandId);
    const by = (f: (p: Pair) => boolean) => ({ before: rowStat(pairs.filter(f).map(p => ({ truth: p.truth, read: p.before }))), after: rowStat(pairs.filter(f).map(p => ({ truth: p.truth, read: p.after }))) });
    const groups: Record<string, ReturnType<typeof by>> = { all: by(() => true), benchmark: by(p => p.set === 'benchmark') };
    for (const k of [...GROUND_KINDS, UNKNOWN]) groups[`ground ${k}`] = by(p => p.kind === k);
    report[d] = { pairs: pairs.length, rowIssues, groups };
    md.push(`### ${d}: ${pairs.length} pands scored; answers whose columns rows differ from storeys: ${rowIssues.length}${rowIssues.length ? ` (${rowIssues.join(', ')})` : ''}`, '',
      '| subset | n | exact before | exact after | 95 % CI after | within 1 after | under / over after |', '|---|---|---|---|---|---|---|',
      ...Object.entries(groups).filter(([, g]) => g.after.n).map(([k, g]) => `| ${k} | ${g.after.n} | ${g.before.exact} | ${g.after.exact} | ${g.after.exactCI.join('-')} | ${g.after.within1} | ${g.after.under} / ${g.after.over} |`), '');
  }
  fs.writeFileSync(opt('out') ?? path.join(D, 'rows-convention.json'), `${JSON.stringify({ v: 1, report }, null, 1)}\n`);
  console.log(md.join('\n'));
}
if (import.meta.url === `file://${process.argv[1]}`) main();
