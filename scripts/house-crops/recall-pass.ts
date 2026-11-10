/**
 * H5 step 0b: the judge recall pass, v1 prompt against v2 on the corrected hand labels.
 *
 *   node --import tsx scripts/house-crops/recall-pass.ts --buurt AB07
 *
 * Two label pools: (a) the 150 labelled H4b crops (labels/<code>.json, judge store judge/<code>[.v2].json) and (b) every other crop with
 * a hand label (labels/<code>-picks.json: the 78 v1-picked year crops) scored from the year caches judge/<code>-years[.v2].json. For each
 * score (v1, v2, their mean) it prints AUC, the lowest threshold with hard-flag precision >= 0.9 (in sample), what that threshold gives
 * on each half when chosen on the other half (alternate sorted ids), and the precision/recall of the pooled crops at fixed thresholds.
 * Pure arithmetic over committed files; no network.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { manifestPath, type Manifest } from './manifest.ts';
import { labelsPath, type Label } from './evaluate.ts';
import { judgePath, quality, type JudgeRecord } from './judge.ts';
import { usability, hardPass } from './flags.ts';

export type Row = { key: string; good: boolean; hard: boolean; s: Record<string, number> };
type Stat = { n: number; precision: number; recall: number };
const st = (rows: Row[], k: string, t: number): Stat => { const sel = rows.filter(r => r.hard && r.s[k] >= t), tp = sel.filter(r => r.good).length, pos = rows.filter(r => r.good).length; return { n: sel.length, precision: sel.length ? tp / sel.length : NaN, recall: pos ? tp / pos : NaN }; };
export function lowestThreshold(rows: Row[], k: string, target = 0.9, minN = 5): number | null {
  for (const t of [...new Set(rows.map(r => r.s[k]))].sort((a, b) => a - b)) { const s = st(rows, k, t); if (s.n >= minN && s.precision >= target) return t; }
  return null;
}
export function auc(rows: Row[], k: string): number {
  const pos = rows.filter(r => r.good), neg = rows.filter(r => !r.good); let w = 0;
  for (const p of pos) for (const n of neg) w += p.s[k] > n.s[k] ? 1 : p.s[k] === n.s[k] ? 0.5 : 0;
  return w / Math.max(1, pos.length * neg.length);
}
const f = (v: number) => (Number.isFinite(v) ? v.toFixed(3) : 'n/a');
const same = (a: string[], b: string[]) => [...a].sort().join() === [...b].sort().join();
const read = <T>(p: string, d: T): Promise<T> => fs.readFile(p, 'utf8').then(JSON.parse).catch(() => d);

if (process.argv[1]?.endsWith('house-crops/recall-pass.ts')) {
  const code = process.argv[process.argv.indexOf('--buurt') + 1];
  const J = path.resolve('scripts/house-crops/judge');
  const m: Manifest = await read(manifestPath(code), null as never), labels: Record<string, Label> = await read(labelsPath(code), {});
  const v1: Record<string, JudgeRecord> = await read(judgePath(code, 'v1'), {}), v2: Record<string, JudgeRecord> = await read(judgePath(code, 'v2'), {});
  const rows: Row[] = [];
  for (const [id, l] of Object.entries(labels)) {
    const a = v1[id], b = v2[id], e = m.pands[id];
    if (!a || !b || !e?.flags || !same(a.panoIds, l.panoIds) || !same(b.panoIds, l.panoIds)) continue;
    const qa = quality(a), qb = quality(b);
    rows.push({ key: id, good: l.label === 'good', hard: hardPass(usability(e.flags).reasons), s: { v1: qa, v2: qb, mean: (qa + qb) / 2 } });
  }
  rows.sort((x, y) => x.key.localeCompare(y.key));
  console.log(`corrected labels: ${rows.length} judged under both prompts, good ${rows.filter(r => r.good).length}`);
  console.log('\n| score | AUC | in-sample t (p>=0.9) | picks / precision / recall | A->B held-out | B->A held-out |\n|---|---|---|---|---|---|');
  for (const k of ['v1', 'v2', 'mean']) {
    const t = lowestThreshold(rows, k), s = t === null ? null : st(rows, k, t);
    const A = rows.filter((_, i) => i % 2 === 0), B = rows.filter((_, i) => i % 2 === 1);
    const held = (tr: Row[], te: Row[]) => { const tt = lowestThreshold(tr, k); if (tt === null) return 'no threshold'; const x = st(te, k, tt); return `t ${f(tt)}: ${x.n} picks, p ${f(x.precision)}, r ${f(x.recall)}`; };
    console.log(`| ${k} | ${f(auc(rows, k))} | ${t === null ? 'none' : f(t)} | ${s ? `${s.n} / ${f(s.precision)} / ${f(s.recall)}` : '-'} | ${held(A, B)} | ${held(B, A)} |`);
  }
  // Pool b: year crops with a hand label (labels/<code>-picks.json) join the pool, scored from the year caches.
  const extra: Record<string, Label> = await read(path.join(path.dirname(labelsPath(code)), `${code}-picks.json`), {});
  const y1: Record<string, { score: number; occluded: number }> = await read(path.join(J, `${code}-years.json`), {}), y2: Record<string, { score: number; occluded: number }> = await read(path.join(J, `${code}-years.v2.json`), {});
  const picks: { pandId: string; cands: { year: number; panoIds: string[]; hard: boolean }[] }[] = (await read(path.join(J, `${code}-picks.json`), { picks: [] })).picks;
  const pool: Row[] = [...rows];
  for (const p of picks) {
    const l = extra[p.pandId]; if (!l) continue;
    const c = p.cands.find(x => same(x.panoIds, l.panoIds)); if (!c) continue;
    const k = `${p.pandId}/${c.year}/${c.panoIds.join('+')}`, a = y1[k], b = y2[k]; if (!a || !b) continue;
    const qa = quality(a), qb = quality(b);
    pool.push({ key: `${p.pandId}/${c.year}`, good: l.label === 'good', hard: c.hard, s: { v1: qa, v2: qb, mean: (qa + qb) / 2 } });
  }
  console.log(`\npool of ${pool.length} labelled crops (${pool.length - rows.length} labelled year picks):`);
  console.log('| score | AUC | t | picks / precision / recall |\n|---|---|---|---|');
  for (const k of ['v1', 'v2', 'mean']) for (const t of k === 'v1' ? [0.3, 0.4, 0.5] : k === 'v2' ? [0.55, 0.65, 0.7, 0.75] : [0.4, 0.5, 0.6]) { const s = st(pool, k, t); console.log(`| ${k} | ${f(auc(pool, k))} | ${t} | ${s.n} / ${f(s.precision)} / ${f(s.recall)} |`); }
}
