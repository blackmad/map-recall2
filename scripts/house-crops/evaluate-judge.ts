/**
 * H4c: validate the Jev judge against the hand labels. Positive class = good (marginal counts as not good).
 *   node --import tsx scripts/house-crops/evaluate-judge.ts --buurt AB07 [--threshold t]
 * Prints: AUC of the score for good, a threshold table (judge alone and hard flags + judge), the threshold chosen as the lowest
 * with precision >= 0.9 on the hard-flag survivors, a split-half check (choose on one half, measure on the other), and the 20
 * crops where the decision and the label disagree most (written to artifacts/house-crops/<code>-disagree.json for the sheet).
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { manifestPath, type Manifest } from './manifest.ts';
import { labelsPath, type Label } from './evaluate.ts';
import { judgePath, quality, type JudgeRecord } from './judge.ts';
import { usability, hardPass, JUDGE_GOOD } from './flags.ts';

export type Row = { id: string; label: Label['label']; good: boolean; score: number; hard: boolean; usable: boolean };

export function rowsFrom(m: Manifest, labels: Record<string, Label>, judge: Record<string, JudgeRecord>): Row[] {
  return Object.entries(labels).flatMap(([id, l]) => {
    const e = m.pands[id], j = judge[id];
    if (!e || e.status !== 'ok' || JSON.stringify(e.panoIds) !== JSON.stringify(l.panoIds) || !j || JSON.stringify(j.panoIds) !== JSON.stringify(l.panoIds)) return [];
    const u = usability(e.flags!);
    return [{ id, label: l.label, good: l.label === 'good', score: quality(j), hard: hardPass(u.reasons), usable: u.usable }];
  });
}
export function auc(rows: Row[]): number {
  const pos = rows.filter(r => r.good), neg = rows.filter(r => !r.good);
  let w = 0; for (const p of pos) for (const n of neg) w += p.score > n.score ? 1 : p.score === n.score ? 0.5 : 0;
  return w / Math.max(1, pos.length * neg.length);
}
export function stats(rows: Row[], pick: (r: Row) => boolean) {
  const sel = rows.filter(pick), tp = sel.filter(r => r.good).length, pos = rows.filter(r => r.good).length;
  return { n: sel.length, tp, precision: sel.length ? tp / sel.length : NaN, recall: pos ? tp / pos : NaN };
}
/** Lowest threshold (from the observed scores) whose precision on `rows` is >= target and that keeps at least `minN` picks. */
export function chooseThreshold(rows: Row[], useHard: boolean, target = 0.9, minN = 5): number | null {
  const ts = [...new Set(rows.map(r => r.score))].sort((a, b) => a - b);
  for (const t of ts) { const s = stats(rows, r => r.score >= t && (!useHard || r.hard)); if (s.n >= minN && s.precision >= target) return t; }
  return null;
}
const f = (v: number) => (Number.isFinite(v) ? v.toFixed(3) : 'n/a');

if (process.argv[1]?.endsWith('house-crops/evaluate-judge.ts')) {
  const code = process.argv[process.argv.indexOf('--buurt') + 1];
  const m: Manifest = JSON.parse(await fs.readFile(manifestPath(code), 'utf8')), labels = JSON.parse(await fs.readFile(labelsPath(code), 'utf8')), judge = JSON.parse(await fs.readFile(judgePath(code), 'utf8'));
  const rows = rowsFrom(m, labels, judge), good = rows.filter(r => r.good).length;
  console.log(`labelled and judged: ${rows.length} (good ${good}); AUC of the judge score for good: ${f(auc(rows))}; AUC among hard-flag survivors: ${f(auc(rows.filter(r => r.hard)))}`);
  console.log(`baseline usable flag: ${JSON.stringify(stats(rows, r => r.usable))}; hard flags alone: ${JSON.stringify(stats(rows, r => r.hard))}`);
  console.log('\n| threshold | judge alone: picks / precision / recall | hard flags + judge: picks / precision / recall |\n|---|---|---|');
  for (const t of [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7]) { const a = stats(rows, r => r.score >= t), b = stats(rows, r => r.hard && r.score >= t); console.log(`| ${t} | ${a.n} / ${f(a.precision)} / ${f(a.recall)} | ${b.n} / ${f(b.precision)} / ${f(b.recall)} |`); }
  const t = Number(process.argv.includes('--threshold') ? process.argv[process.argv.indexOf('--threshold') + 1] : JUDGE_GOOD);
  console.log(`\nthreshold ${t} (JUDGE_GOOD); lowest in-sample threshold with hard-flag precision >= 0.9: ${chooseThreshold(rows, true)}`);
  if (Number.isFinite(t)) {
    const s = stats(rows, r => r.hard && r.score >= t);
    console.log(`at ${t}: picks ${s.n}, precision ${f(s.precision)} (${s.tp}/${s.n}), recall ${f(s.recall)} (${s.tp}/${good})`);
    // split-half: ids sorted, alternate halves
    const sorted = [...rows].sort((a, b) => a.id.localeCompare(b.id)), A = sorted.filter((_, i) => i % 2 === 0), B = sorted.filter((_, i) => i % 2 === 1);
    for (const [tr, te, name] of [[A, B, 'A->B'], [B, A, 'B->A']] as const) { const tt = chooseThreshold(tr, true); if (tt === null) { console.log(`split ${name}: no threshold reaches 0.9`); continue; } const s2 = stats(te, r => r.hard && r.score >= tt); console.log(`split ${name}: threshold ${tt} -> held-out picks ${s2.n}, precision ${f(s2.precision)}, recall ${f(s2.recall)}`); }
    // every false positive first (the judge said good, the label did not: these cost precision), then the false negatives with the lowest scores
    const wrong = rows.map(r => ({ ...r, picked: r.hard && r.score >= t })).filter(r => r.picked !== r.good);
    const dis = [...wrong.filter(r => r.picked).sort((a, b) => b.score - a.score), ...wrong.filter(r => !r.picked).sort((a, b) => a.score - b.score)].slice(0, 20);
    await fs.mkdir('artifacts/house-crops', { recursive: true });
    await fs.writeFile(path.join('artifacts/house-crops', `${code}-disagree.json`), JSON.stringify(dis, null, 1));
    console.log(`disagreements (judge decision vs label): ${rows.filter(r => (r.hard && r.score >= t) !== r.good).length} of ${rows.length}; 20 largest written`);
  }
}
