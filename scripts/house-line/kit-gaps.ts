/**
 * house:kit-gaps (lane F4, #379): the critic's gap histogram as the ranked kit-gap queue.
 *
 *   node --import tsx scripts/house-line/kit-gaps.ts [--round N] [--out artifacts/kit-gaps/critic-queue.json] [--md <file>]
 *
 * Reads artifacts/critic/round-N/{histogram.json, answers.json} (default: the latest scored round) and the benchmark's hand
 * labels, and ranks the gap terms by severity sum (then count). Each row names the renderer feature that closes it (the
 * vocabulary's owner: an F1/F2 facade-programme feature), how often and how badly the critic named it, where (per group),
 * three example pairs with their pands, and what the photos show for that field across the pairs that named it (from the
 * hand labels): the spec the feature must draw. One fix to the top row improves every pand that shares it; this replaces
 * per-pand acceptance for generic-path pands (docs/plans/facade-programme-20261112.md, F4).
 *
 * The block-face schemaLimits sightings (lane H6, `scripts/house-specs/kit-gaps.ts` on its branch) are a second, slower
 * source of the same queue; this one is measured on the benchmark every round.
 */
import fs from 'node:fs';
import path from 'node:path';
import { GAP_TERMS, type GapId } from '../../src/canalRecall/houseSpec/critic/vocabulary.ts';
import type { HistogramRow } from '../../src/canalRecall/houseSpec/critic/score.ts';

const arg = (n: string) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? process.argv[i + 1] : undefined; };
const CRITIC = 'artifacts/critic', BENCH = 'scripts/house-line/benchmark/benchmark-v1.json';

export interface QueueRow { rank: number; gap: GapId; text: string; owner: string | null; count: number; share: number; severitySum: number; bySeverity: Record<string, number>; byGroup: Record<string, number>; photoSays: Record<string, number>; examples: Array<{ pair: string; pandId: string; address: string; note: string }> }

/** What the hand labels say for a gap's field, counted over the pands the critic named it on. */
export function photoSays(gap: GapId, labels: Array<Record<string, any> | undefined>): Record<string, number> {
  const field = GAP_TERMS.find(t => t.id === gap)?.label;
  const out: Record<string, number> = {};
  const add = (k: string) => { out[k] = (out[k] ?? 0) + 1; };
  for (const l of labels) {
    if (!l || !field) continue;
    const v = l[field];
    if (field === 'whiteAccents' && v) { const on = Object.entries(v).filter(([, b]) => b).map(([k]) => k); add(on.length ? on.join('+') : 'none'); }
    else if (field === 'wallTone' && v) add(`${v.family} ${v.darkness}`);
    else if (field === 'columns' && Array.isArray(v)) add(v.slice(1).length ? `${Math.max(...v.slice(1))} upper` : `${v[0]} ground`);
    else if (v !== undefined) add(String(v));
  }
  return Object.fromEntries(Object.entries(out).sort((a, b) => b[1] - a[1]));
}

export function buildQueue(hist: HistogramRow[], answers: any[], bench: any): QueueRow[] {
  const byPand = new Map<string, any>(bench.pands.map((p: any) => [p.pandId, p]));
  const answered = answers.length || 1;
  return hist.filter(r => r.gap !== 'none').map((r, i) => {
    const mine = answers.filter(a => a.gap === r.gap).sort((a, b) => (b.severity ?? 0) - (a.severity ?? 0));
    return {
      rank: i + 1, gap: r.gap, text: r.text, owner: r.owner, count: r.count, share: +(r.count / answered).toFixed(3), severitySum: r.severitySum, bySeverity: r.bySeverity, byGroup: r.byGroup,
      photoSays: photoSays(r.gap, mine.map(a => byPand.get(a.pandId)?.labels)),
      examples: mine.slice(0, 3).map(a => ({ pair: a.pair, pandId: a.pandId, address: byPand.get(a.pandId)?.addresses?.[0] ?? '?', note: a.note })),
    };
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const rounds = fs.existsSync(CRITIC) ? fs.readdirSync(CRITIC).filter(d => /^round-\d+$/.test(d) && fs.existsSync(path.join(CRITIC, d, 'histogram.json'))).map(d => Number(d.slice(6))).sort((a, b) => a - b) : [];
  const round = arg('round') !== undefined ? Number(arg('round')) : rounds.at(-1);
  if (round === undefined) { console.error('no scored critic round under artifacts/critic (run house:critic score first)'); process.exit(2); }
  const dir = path.join(CRITIC, `round-${round}`);
  const { histogram } = JSON.parse(fs.readFileSync(path.join(dir, 'histogram.json'), 'utf8'));
  const answers = JSON.parse(fs.readFileSync(path.join(dir, 'answers.json'), 'utf8'));
  const queue = buildQueue(histogram, answers, JSON.parse(fs.readFileSync(BENCH, 'utf8')));
  const out = arg('out') ?? 'artifacts/kit-gaps/critic-queue.json';
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify({ round, source: dir, answered: answers.length, none: histogram.find((r: HistogramRow) => r.gap === 'none')?.count ?? 0, queue }, null, 1));
  const md = [`| # | Gap | Pairs | Severity sum (1/2/3) | Feature that closes it | What the photos show | Groups |`, `|---|---|---|---|---|---|---|`,
    ...queue.map(q => `| ${q.rank} | ${q.text} | ${q.count} (${(q.share * 100).toFixed(0)} %) | ${q.severitySum} (${q.bySeverity[1]}/${q.bySeverity[2]}/${q.bySeverity[3]}) | ${q.owner ?? '-'} | ${Object.entries(q.photoSays).slice(0, 3).map(([k, n]) => `${k} ${n}`).join(', ') || '-'} | ${Object.entries(q.byGroup).sort((a, b) => b[1] - a[1]).map(([g, n]) => `${g} ${n}`).join(', ')} |`)].join('\n');
  if (arg('md')) fs.writeFileSync(arg('md')!, md + '\n');
  console.log(`kit-gap queue from critic round ${round} (${answers.length} answers) -> ${out}\n\n${md}`);
}
