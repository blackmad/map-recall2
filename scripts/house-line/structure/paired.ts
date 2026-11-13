/**
 * Lane PR1: a paired before/after of one field (storeys or columns) over the same pands, with McNemar's exact test on the
 * discordant pairs. Takes two baseline.ts --json outputs (off and on) and, optionally, another label file to score both
 * against (D1's benchmark-v1-adjudicated.json when it lands).
 *
 *   node --import tsx scripts/house-line/structure/paired.ts --off artifacts/structure-priors/score-0.json \
 *     --on artifacts/structure-priors/score-all.json [--labels <benchmark.json>] [--field storeys|columns] [--json out.json]
 *
 * Rows: the "unspecified" generic pands (no spec storeys or bays, no recipe; baseline.ts) and all generic pands, overall
 * and by build-year family. Cells: wrong→right, right→wrong, right both, wrong both; p = two-sided exact binomial on
 * b = wrong→right against c = right→wrong (McNemar).
 */
import fs from 'node:fs';
import { benchmarkTruths, type StructureTruth } from './labels.ts';
import { REPO_ROOT } from '../../house-preview/nodeDom.ts';
import type { ProbeRecord } from './probe.ts';

type Row = { truth: StructureTruth; probe: ProbeRecord | null };
const args = process.argv.slice(2);
const opt = (k: string) => (args.includes(k) ? args[args.indexOf(k) + 1] : undefined);

/** Two-sided exact McNemar p: P(X <= min(b, c)) * 2 for X ~ Bin(b + c, 1/2), capped at 1. */
export function mcnemarExact(b: number, c: number): number {
  const n = b + c, k = Math.min(b, c);
  if (!n) return 1;
  let p = 0, term = Math.pow(0.5, n);
  for (let i = 0; i <= k; i++) { p += term; term = term * (n - i) / (i + 1); }
  return Math.min(1, 2 * p);
}

export type Paired = { n: number; wrongToRight: number; rightToWrong: number; rightBoth: number; wrongBoth: number; offRate: number; onRate: number; p: number };
export function paired(pairs: readonly { truth: number; off: number; on: number }[]): Paired {
  let b = 0, c = 0, rr = 0, ww = 0;
  for (const { truth, off, on } of pairs) {
    const a = off === truth, z = on === truth;
    if (!a && z) b++; else if (a && !z) c++; else if (a) rr++; else ww++;
  }
  const n = pairs.length;
  return { n, wrongToRight: b, rightToWrong: c, rightBoth: rr, wrongBoth: ww, offRate: n ? (rr + c) / n : 0, onRate: n ? (rr + b) / n : 0, p: mcnemarExact(b, c) };
}

const FAMILIES: [string, (y: number) => boolean][] = [['all years', () => true], ['before 1800', y => y < 1800], ['1800–1879', y => y >= 1800 && y < 1880], ['1880–1919', y => y >= 1880 && y < 1920], ['1920–1944', y => y >= 1920 && y < 1945]];

if (import.meta.url === `file://${process.argv[1]}`) {
  const field = (opt('--field') ?? 'storeys') as 'storeys' | 'columns';
  const load = (f: string) => new Map((JSON.parse(fs.readFileSync(f, 'utf8')).rows as Row[]).map(r => [r.truth.pandId, r]));
  const off = load(opt('--off')!), on = load(opt('--on')!);
  const labels = opt('--labels');
  const truths = labels ? benchmarkTruths(REPO_ROOT, labels) : [...off.values()].map(r => r.truth);
  const unspec = (r: ProbeRecord) => !r.spec?.storeys && !r.spec?.bays && !r.drawn?.recipe;
  const out: Record<string, Record<string, Paired>> = {};
  for (const [set, keep] of [['unspecified', unspec], ['generic (all)', () => true]] as const) {
    out[set] = {};
    for (const [fam, inFam] of FAMILIES) {
      const pairs = truths.flatMap(t => {
        const a = off.get(t.pandId)?.probe, b = on.get(t.pandId)?.probe, truth = t[field];
        if (!a?.drawn || !b?.drawn || a.route !== 'generic' || truth == null || !keep(a) || !inFam(a.year ?? -1)) return [];
        return [{ truth, off: a.drawn[field], on: b.drawn[field] }];
      });
      out[set][fam] = paired(pairs);
    }
  }
  console.log(`${field}, labels ${labels ?? 'the off file\'s'}; off ${opt('--off')} vs on ${opt('--on')}`);
  for (const [set, rows] of Object.entries(out)) {
    console.log(`\n${set}\n  family        n   off     on    wrong→right right→wrong right both wrong both  McNemar p`);
    for (const [fam, r] of Object.entries(rows)) console.log(`  ${fam.padEnd(12)} ${String(r.n).padStart(3)}  ${(100 * r.offRate).toFixed(1).padStart(5)} %  ${(100 * r.onRate).toFixed(1).padStart(5)} %  ${String(r.wrongToRight).padStart(6)}  ${String(r.rightToWrong).padStart(11)}  ${String(r.rightBoth).padStart(10)}  ${String(r.wrongBoth).padStart(9)}  ${r.p < 0.001 ? '<0.001' : r.p.toFixed(3)}`);
  }
  if (opt('--json')) fs.writeFileSync(opt('--json')!, JSON.stringify({ field, labels: labels ?? null, off: opt('--off'), on: opt('--on'), out }, null, 1));
}
