// The fallback a D1 class must beat (integrator ruling on step 1c): per pand, what the game draws today (PR1's layout probe:
// the roof planner's crown) and PR1's kNN prior (the modal read value of the k read houses nearest in build year and place,
// held out 60 m round every scored pand, k 15, year/30, dist/1000 as crown.ts) for crown, window head and surrounds.
// Runs against a PR1 checkout (lane/structure-priors-20261113), read only; cornice and the drawn head/surrounds are not probed.
//
//   node --import tsx scripts/house-specs/describer-d1/fallback.ts --pr1 <structure-priors worktree> --ids <ids.txt> --out <fallback.json>
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2), opt = (k: string) => (args.includes(`--${k}`) ? args[args.indexOf(`--${k}`) + 1] : undefined);
const PR1 = opt('pr1') ?? '/Users/blackmad/Code/map-recall2-worktrees/structure-priors-20261113';
const ids = fs.readFileSync(opt('ids')!, 'utf8').split(/\s+/).filter(Boolean);
const ds = await import(path.join(PR1, 'scripts/house-line/structure/dataset.ts'));
const probes: Record<string, any> = JSON.parse(fs.readFileSync(path.join(PR1, 'artifacts/structure-priors/probe-cache.json'), 'utf8'));
const KX = 111_320 * Math.cos(52.37 * Math.PI / 180), KY = 110_540, HOLDOUT_M = 60, K = 15, YS = 30, DS = 1000;
const reads = [...ds.faceReadings(PR1), ...ds.specReadings(PR1)] as any[];
const dist = (a: number[], b: number[]) => Math.hypot((a[0] - b[0]) * KX, (a[1] - b[1]) * KY);
const scored = ids.map(id => probes[id]).filter(p => p?.at);
const train = reads.map(r => ({ r, p: probes[r.pandId] })).filter(x => x.p?.at && x.p.year !== null && !ids.includes(x.r.pandId)
  && !scored.some(b => dist(b.at, x.p.at) <= HOLDOUT_M));
function knn(p: any, field: string): unknown {
  if (!p?.at || p.year === null) return null;
  const near = train.filter(t => t.r[field] !== undefined).map(t => ({ v: t.r[field], d: Math.abs(t.p.year - p.year) / YS + dist(t.p.at, p.at) / DS }))
    .sort((a, b) => a.d - b.d).slice(0, K);
  const c = new Map<string, number>(); let best: unknown = null, n = 0;
  for (const { v } of near) { const m = (c.get(String(v)) ?? 0) + 1; c.set(String(v), m); if (m > n) { n = m; best = v; } }
  return best;
}
const out: Record<string, unknown> = {};
for (const id of ids) {
  const p = probes[id];
  out[id] = { route: p?.route ?? null, todayCrown: p?.crown ?? null, knnCrown: knn(p, 'crown'), knnHead: knn(p, 'windowHead'), knnSurrounds: knn(p, 'surrounds') };
}
fs.writeFileSync(opt('out')!, `${JSON.stringify({ v: 1, pr1: PR1, k: K, yearScale: YS, distScale: DS, holdoutM: HOLDOUT_M, train: train.length, pands: out }, null, 1)}\n`);
console.log(`fallback: ${ids.length} pands, ${scored.length} probed, ${train.length} training reads`);
