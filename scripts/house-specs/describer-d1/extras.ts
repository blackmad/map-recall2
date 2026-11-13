// Describer D1 prompt v4.3 extras (D1-fix 3, item A): score the four held reads (balconies, dormers, bay window, door
// surround) per class against the author HouseSpecs (truth.ts handSpecFiles: belt lanes, pilot, block-face specs; a field
// counts only under an `author`/`reviewed` receipt, an absent key under that receipt reads as the recipe default: no
// balconies, no dormers, no bay window, no doorcase). Precision per answered class with Wilson 95 % intervals; a class may
// leave HELD_FOR_ALL_ROUTES only at precision >= 0.8 (and better than its fallback, the absent default).
//
//   node --import tsx scripts/house-specs/describer-d1/extras.ts [--answers <dir>] [--out <file.json>]
import fs from 'node:fs';
import path from 'node:path';
import { provenanceOf, type HouseSpec } from '../../../src/canalRecall/houseSpec/spec.ts';
import { wilson } from '../../../src/canalRecall/houseSpec/describerScore.ts';
import { UNKNOWN, type DescriberAnswer } from '../../../src/canalRecall/houseSpec/describer.ts';
import { handSpecFiles } from './truth.ts';
import { loadAnswers } from './score.ts';

/** The four reads as truth from an author spec (undefined = no author receipt for that field). */
export type Extras = { balconies?: number[]; dormers?: { count: number; kind: 'plain' | 'gabled' | 'none' }; bayWindow?: number[]; doorSurround?: boolean };
const GABLED = new Set(['pediment', 'pointed']);
const rowsOf = (v: any): number[] => {
  if (!v) return [];
  const list = Array.isArray(v) ? v : [v];
  return [...new Set(list.flatMap((x: any) => (Array.isArray(x?.storeys) ? x.storeys : Number.isInteger(x?.storey) ? [x.storey] : [])))].sort((a, b) => a - b);
};
export function specExtras(s: HouseSpec): Extras {
  const f0: any = s.design.fronts?.[0] ?? {}, out: Extras = {};
  if ((s.design.fronts ?? []).length !== 1) return out;
  const own = (k: string) => { const src = provenanceOf(s, `fronts/0/${k}`)?.source; return src === 'author' || src === 'reviewed'; };
  if (own('balconies')) out.balconies = [...new Set([...rowsOf(f0.balconies), ...rowsOf(f0.balconyRun)])].sort((a, b) => a - b);
  if (own('dormers')) {
    const count = Number.isInteger(f0.dormers) ? f0.dormers : 0;
    out.dormers = { count, kind: count === 0 ? 'none' : GABLED.has(f0.dormerStyle) ? 'gabled' : 'plain' };
  }
  if (own('bayWindows')) out.bayWindow = rowsOf(f0.bayWindows);
  if (own('doorSurround')) out.doorSurround = !!f0.doorSurround;
  return out;
}

/** Answer value of a class question, or undefined when not answered. */
type Q = { name: string; truth: (t: Extras) => string | undefined; read: (a: DescriberAnswer) => string | undefined };
const yes = (rows: number[] | undefined) => (rows === undefined ? undefined : rows.length ? 'yes' : 'no');
const ansRows = (v: unknown) => (Array.isArray(v) ? (v as number[]) : undefined);
export const QUESTIONS: Q[] = [
  { name: 'balconies', truth: t => yes(t.balconies), read: a => yes(ansRows(a.balconies)) },
  { name: 'balcony rows', truth: t => (t.balconies?.length ? t.balconies.join(',') : undefined), read: a => (ansRows(a.balconies)?.length ? ansRows(a.balconies)!.join(',') : undefined) },
  { name: 'dormers', truth: t => (t.dormers ? (t.dormers.count ? 'yes' : 'no') : undefined), read: a => (a.dormers && a.dormers !== UNKNOWN ? (a.dormers.count ? 'yes' : 'no') : undefined) },
  { name: 'dormer count', truth: t => (t.dormers?.count ? String(t.dormers.count) : undefined), read: a => (a.dormers && a.dormers !== UNKNOWN && a.dormers.count ? String(a.dormers.count) : undefined) },
  { name: 'dormer kind', truth: t => (t.dormers?.count ? t.dormers.kind : undefined), read: a => (a.dormers && a.dormers !== UNKNOWN && a.dormers.count ? a.dormers.kind : undefined) },
  { name: 'bay window', truth: t => yes(t.bayWindow), read: a => yes(ansRows(a.bayWindow)) },
  { name: 'bay rows', truth: t => (t.bayWindow?.length ? t.bayWindow.join(',') : undefined), read: a => (ansRows(a.bayWindow)?.length ? ansRows(a.bayWindow)!.join(',') : undefined) },
  { name: 'door surround', truth: t => (t.doorSurround === undefined ? undefined : t.doorSurround ? 'yes' : 'no'), read: a => (typeof a.doorSurround === 'boolean' ? (a.doorSurround ? 'yes' : 'no') : undefined) },
];
const r3 = (x: number) => Math.round(x * 1000) / 1000;

/** Per question: accuracy over pairs, precision of each answered class (Wilson 95 %), and whether it may ship. */
export function scoreExtras(answers: Map<string, DescriberAnswer>, truth: Map<string, Extras>) {
  return QUESTIONS.map(q => {
    let n = 0, ok = 0; const cls: Record<string, { read: number; right: number; truth: number }> = {};
    for (const [id, a] of answers) {
      const t = truth.get(id); if (!t || !a.readable) continue;
      const tv = q.truth(t), av = q.read(a);
      if (tv === undefined || av === undefined) continue;
      n++; if (tv === av) ok++;
      (cls[av] ??= { read: 0, right: 0, truth: 0 }).read++; if (tv === av) cls[av].right++;
      (cls[tv] ??= { read: 0, right: 0, truth: 0 }).truth++;
    }
    // row questions are scored as exact row sets; their classes are too many to list
    const rowQ = q.name.endsWith('rows') || q.name === 'dormer count';
    const classes = rowQ ? {} : Object.fromEntries(Object.entries(cls).map(([k, c]) => [k, { read: c.read, precision: c.read ? r3(c.right / c.read) : null, ci: c.read ? wilson(c.right, c.read).map(r3) : null, truth: c.truth, recall: c.truth ? r3(c.right / c.truth) : null, ships: !!c.read && c.right / c.read >= 0.8 }]));
    return { question: q.name, pairs: n, accuracy: n ? r3(ok / n) : null, ci: n ? wilson(ok, n).map(r3) : null, classes };
  });
}

function main() {
  const argv = process.argv.slice(2), opt = (k: string) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : undefined; };
  const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../..');
  const A = loadAnswers(opt('answers') ?? path.join(root, 'artifacts/describer-d1/answers-v43-crop'));
  const truth = new Map<string, Extras>();
  for (const { spec } of handSpecFiles(root)) if (!truth.has(spec.pandId)) truth.set(spec.pandId, specExtras(spec));
  const rows = scoreExtras(A, truth);
  const res = { answers: A.size, withTruth: [...A.keys()].filter(id => truth.has(id)).length, rows };
  if (opt('out')) fs.writeFileSync(opt('out')!, `${JSON.stringify(res, null, 1)}\n`);
  console.log(`answers ${res.answers}, with an author spec ${res.withTruth}\n| question | pairs | accuracy | 95 % CI | class: precision [CI] (read / truth) |\n|---|---|---|---|---|`);
  for (const r of rows) console.log(`| ${r.question} | ${r.pairs} | ${r.accuracy ?? '-'} | ${r.ci ? r.ci.join('-') : '-'} | ${Object.entries(r.classes).map(([k, c]: any) => `${k}: ${c.precision} [${c.ci?.join('-')}] (${c.read}/${c.truth})${c.ships ? ' ships' : ''}`).join('; ')} |`);
}
if (process.argv[1]?.endsWith('extras.ts')) main();
