/**
 * Lane PR1: would a crown prior help? Offline only (not wired: the crown is the roof planner's, from 3DBAG and the
 * register; docs/house-line.md §1 "Not wired"). The modal read crown (intent `gable`) of the k read houses nearest in
 * build year and place, against what the planner draws today, on the held-out benchmark labels.
 *
 *   node --import tsx scripts/house-line/structure/crown.ts [--labels benchmark.json]
 */
import { REPO_ROOT } from '../../house-preview/nodeDom.ts';
import { probeAll } from './baseline.ts';
import { faceReadings, specReadings, type Reading } from './dataset.ts';
import { benchmarkTruths, crownFamily, fmt, score } from './labels.ts';

const args = process.argv.slice(2), opt = (k: string) => (args.includes(k) ? args[args.indexOf(k) + 1] : undefined);
const KX = 111_320 * Math.cos(52.37 * Math.PI / 180), KY = 110_540, HOLDOUT_M = 60;
const truths = benchmarkTruths(REPO_ROOT, opt('--labels'));
const reads = new Map<string, Reading>();
for (const r of [...faceReadings(REPO_ROOT), ...specReadings(REPO_ROOT)]) if (r.crown) reads.set(r.pandId, r);
const probes = await probeAll([...new Set([...reads.keys(), ...truths.map(t => t.pandId)])], 'artifacts/structure-priors/probe-cache.json');
const bench = truths.map(t => probes.get(t.pandId)).filter(p => p?.at);
const ids = new Set(truths.map(t => t.pandId));
const train = [...reads.values()].map(r => ({ r, p: probes.get(r.pandId)! })).filter(x => !ids.has(x.r.pandId) && x.p?.at && x.p.year !== null && !bench.some(b => Math.hypot((b!.at![0] - x.p.at![0]) * KX, (b!.at![1] - x.p.at![1]) * KY) <= HOLDOUT_M));
const test = truths.map(tr => ({ tr, p: probes.get(tr.pandId)! })).filter(x => x.p?.route === 'generic' && x.p.drawn && !x.p.spec?.storeys && !x.p.spec?.bays && !x.p.drawn.recipe && x.tr.crown && x.p.year !== null);
console.log(`crown training ${train.length} read crowns; held-out ${test.length}`);
for (const k of [7, 15, 25]) for (const ys of [10, 30]) for (const ds of [200, 1000]) {
  const guess = (x: typeof test[number]) => {
    const near = train.map(t => ({ c: t.r.crown!, d: Math.abs(t.p.year! - x.p.year!) / ys + Math.hypot((t.p.at![0] - x.p.at![0]) * KX, (t.p.at![1] - x.p.at![1]) * KY) / ds })).sort((a, b) => a.d - b.d).slice(0, k);
    const c = new Map<string, number>(); let best = near[0]?.c, n = 0;
    for (const { c: v } of near) { const m = (c.get(v) ?? 0) + 1; c.set(v, m); if (m > n) { n = m; best = v; } }
    return best;
  };
  console.log(`k ${k} year/${ys} dist/${ds}: crown ${fmt(score(test.map(x => [x.tr.crown, guess(x)])))}; family ${fmt(score(test.map(x => [crownFamily(x.tr.crown), crownFamily(guess(x))])))}`);
}
console.log(`today: crown ${fmt(score(test.map(x => [x.tr.crown, x.p.crown])))}; family ${fmt(score(test.map(x => [crownFamily(x.tr.crown), crownFamily(x.p.crown)])))}`);
