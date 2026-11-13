/**
 * Lane PR1: the benchmark's hand labels as structure truths, and the exact-match score with a 95 % Wilson interval.
 */
import fs from 'node:fs';
import path from 'node:path';
import { crownFamily } from './probe.ts';

export const BENCHMARK = 'scripts/house-line/benchmark/benchmark-v1.json';

export type StructureTruth = { pandId: string; group: string; storeys: number | null; columns: number | null; crown: string | null; oneFront: boolean; confidence: string };

/** The upper storeys' window columns: the most common count over storeys 2..n (ground storey excluded; its doors and
 *  shop bays are not the window grid). Ties go to the higher storeys' count (read first from the top). */
export function upperColumns(columns: readonly number[] | undefined): number | null {
  if (!columns || columns.length < 2) return null;
  const up = columns.slice(1).filter(n => Number.isInteger(n) && n > 0);
  if (!up.length) return null;
  const count = new Map<number, number>();
  for (const n of up) count.set(n, (count.get(n) ?? 0) + 1);
  let best = up[up.length - 1], bestN = 0;
  for (const n of [...up].reverse()) if ((count.get(n) ?? 0) > bestN) { best = n; bestN = count.get(n)!; }
  return best;
}

export function benchmarkTruths(root: string, file = BENCHMARK): StructureTruth[] {
  const d = JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
  return (d.pands as any[]).filter(p => p.readable && p.labels).map(p => {
    const l = p.labels;
    const crown = typeof l.crown === 'string' && l.crown !== 'unknown' && l.crown !== 'other' ? l.crown : null;
    return { pandId: String(p.pandId), group: String(p.group ?? ''), storeys: Number.isInteger(l.storeys) && l.storeys > 0 ? l.storeys : null, columns: upperColumns(l.columns), crown, oneFront: l.oneFront !== false, confidence: String(l.confidence ?? '') };
  });
}

/** Wilson 95 % interval for k of n. */
export function wilson(k: number, n: number): [number, number] {
  if (!n) return [0, 0];
  const z = 1.96, p = k / n, d = 1 + z * z / n, c = p + z * z / (2 * n), w = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n));
  return [(c - w) / d, (c + w) / d];
}
export type Score = { n: number; k: number; rate: number; ci: [number, number]; within1?: number };
export function score(pairs: readonly [number | string | null | undefined, number | string | null | undefined][], within = false): Score {
  const ok = pairs.filter(([a, b]) => a !== null && a !== undefined && b !== null && b !== undefined);
  const k = ok.filter(([a, b]) => a === b).length;
  const s: Score = { n: ok.length, k, rate: ok.length ? k / ok.length : 0, ci: wilson(k, ok.length) };
  if (within) s.within1 = ok.length ? ok.filter(([a, b]) => Math.abs(Number(a) - Number(b)) <= 1).length / ok.length : 0;
  return s;
}
export const pct = (x: number) => `${(100 * x).toFixed(1)} %`;
export const fmt = (s: Score) => `${s.k}/${s.n} = ${pct(s.rate)} [${pct(s.ci[0])}, ${pct(s.ci[1])}]${s.within1 !== undefined ? `, ±1 ${pct(s.within1)}` : ''}`;
export { crownFamily };
