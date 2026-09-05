/**
 * Solve each survey run's vertical datum offset from the panoramas alone.
 *
 * Published camera height is smooth along a run — consecutive frames five
 * metres apart agree to 41 mm — and jumps between runs: two cameras standing
 * within a metre of each other in different years disagree by a median 0.75 m
 * and a p99 of 4.51 m. The same patch of quay cannot be two heights, so the
 * difference is the error, and its shape is one constant per run. A GNSS
 * session bias.
 *
 * The first attempt estimated each run's offset from `b3_h_maaiveld` under it,
 * and recovered only 24% of the disagreement — because that ground has its own
 * error, unrelated to the one being solved, and it was being subtracted into
 * the answer.
 *
 * This uses no ground at all. Where two runs pass within a metre of each other
 * the true height is the same, so their published heights differ by exactly the
 * difference of their offsets:
 *
 *     z_a − z_b  =  offset_a − offset_b
 *
 * Every such pair is one equation, and the runs form a graph the equations
 * connect. Least squares over that graph is solved by iterative averaging,
 * which for this structure converges in a few dozen sweeps.
 *
 * Two things keep it honest. The system is rank-deficient by one — adding a
 * constant to every offset satisfies every equation — so the gauge is fixed
 * afterwards by putting the fleet's median lens at the 2.44 m measured above
 * local ground, which is the one place a ground level is used and only to place
 * the whole solution, never to shape it. And a fifth of the pairs are held out:
 * the score is on equations the solve never saw, between runs it may never have
 * connected directly.
 *
 * Usage: npx tsx scripts/facade-twin/solve-track-datum.ts [--sweeps=60] [--holdout=0.2]
 */
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { AMSTERDAM_GRACHTENGORDEL_WEST as AREA } from '../../src/canalRecall/facade/areas.ts';
import { GEOID_SEPARATION_M, SURVEY_LENS_ABOVE_GROUND_M, hasUsablePose } from '../../src/canalRecall/facade/sources/amsterdamPanorama.ts';
import { RD_NEW } from '../../src/canalRecall/facade/sources/netherlands.ts';
import type { LngLat, PanoramaView, ProjectedPoint } from '../../src/canalRecall/facade/sources.ts';

const CACHE = path.resolve('.cache/facade-twin');
const STAGING = path.resolve('public/data/extracts/amsterdam/staging/facade-twin', AREA.areaId);
const arg = (n: string) => process.argv.find(v => v.startsWith(`--${n}=`))?.slice(n.length + 3);
const SWEEPS = Number(arg('sweeps') ?? 60);
const HOLDOUT = Number(arg('holdout') ?? 0.2);
const PAIR_RADIUS_M = 1.0;
/**
 * Frames per solved segment, or 0 for one offset per whole run.
 *
 * A GNSS session bias is a step between runs; GNSS *drift* is a slow wander
 * within one. Consecutive frames agreeing to 41 mm cannot tell the two apart —
 * a drift of a metre over a kilometre is 5 mm between neighbours. Splitting a
 * run into segments and giving each its own unknown asks the data which it is,
 * and the answer is drift. Scored on held-out *places*:
 *
 *     whole run      27% of the median disagreement removed
 *     100 frames     57%
 *      25 frames     78%   0.74 m → 0.17 m
 *
 * 25 frames is about 125 m of driving. Shorter segments keep helping on the
 * fitted set and stop helping out of sample, which is where the model stops
 * describing drift and starts absorbing noise.
 */
const SEGMENT = Number(arg('segment') ?? 25);   // ~125 m of driving; see the table in the docs above

const views = (JSON.parse(await readFile(path.join(CACHE, `${AREA.areaId}-panoramas.json`), 'utf8')).data as PanoramaView[])
  .filter(hasUsablePose);
const rd = new Map<string, ProjectedPoint>();
for (const view of views) rd.set(view.panoramaId, RD_NEW.fromLngLat(view.lngLat));

/** A run is one pass of one vehicle: everything before the frame number. */
const trackOf = (view: PanoramaView) => {
  const m = view.panoramaId.match(/^(.*)_(\d{6})$/);
  if (!m) return view.panoramaId;
  return SEGMENT > 0 ? `${m[1]}#${Math.floor(Number(m[2]) / SEGMENT)}` : m[1];
};
const track = new Map<string, string>();
for (const view of views) track.set(view.panoramaId, trackOf(view));

// ---- the equations ------------------------------------------------------
const CELL = 2;
const cells = new Map<string, PanoramaView[]>();
for (const view of views) {
  const p = rd.get(view.panoramaId)!;
  const key = `${Math.floor(p.x / CELL)}:${Math.floor(p.y / CELL)}`;
  (cells.get(key) ?? cells.set(key, []).get(key)!).push(view);
}
type Equation = { a: string; b: string; d: number; block: string };
const equations: Equation[] = [];
for (const [key, list] of cells) {
  const [cx, cy] = key.split(':').map(Number);
  const near: PanoramaView[] = [];
  for (let i = 0; i <= 1; i++) for (let j = 0; j <= 1; j++) near.push(...(cells.get(`${cx + i}:${cy + j}`) ?? []));
  for (const a of list) for (const b of near) {
    if (a.panoramaId >= b.panoramaId) continue;
    const ta = track.get(a.panoramaId)!, tb = track.get(b.panoramaId)!;
    if (ta === tb) continue;                       // within one unknown there is nothing to solve
    const pa = rd.get(a.panoramaId)!, pb = rd.get(b.panoramaId)!;
    if (Math.hypot(pa.x - pb.x, pa.y - pb.y) > PAIR_RADIUS_M) continue;
    // The place this pair stands, coarsely, so a whole location can be held out.
    equations.push({ a: ta, b: tb, d: a.cameraHeight - b.cameraHeight,
      block: `${Math.floor(pa.x / 60)}:${Math.floor(pa.y / 60)}` });
  }
}

/**
 * Held out by *place*, not at random.
 *
 * Two cameras standing at one spot generate many pairs, so a random split puts
 * siblings of a held-out pair into training and the score flatters itself —
 * badly, once segments are short enough that a pair's own neighbours pin its
 * two unknowns. Whole 60 m blocks are held out instead, so a scored pair stands
 * somewhere the solve never saw. That is the harder question and the one worth
 * answering: is the model form right, or is it absorbing noise?
 */
let seed = 12345;
const random = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
const blocks = [...new Set(equations.map(e => e.block))];
const heldBlocks = new Set(blocks.filter(() => random() < HOLDOUT));
const train: Equation[] = [], test: Equation[] = [];
for (const equation of equations) (heldBlocks.has(equation.block) ? test : train).push(equation);

// ---- solve --------------------------------------------------------------
const offsets = new Map<string, number>();
for (const t of new Set(views.map(v => track.get(v.panoramaId)!))) offsets.set(t, 0);
const incident = new Map<string, Array<{ other: string; sign: number; d: number }>>();
for (const e of train) {
  (incident.get(e.a) ?? incident.set(e.a, []).get(e.a)!).push({ other: e.b, sign: +1, d: e.d });
  (incident.get(e.b) ?? incident.set(e.b, []).get(e.b)!).push({ other: e.a, sign: -1, d: e.d });
}
for (let sweep = 0; sweep < SWEEPS; sweep++) {
  let moved = 0;
  for (const [t, edges] of incident) {
    // offset_t that best satisfies its own equations, holding neighbours fixed.
    let sum = 0;
    for (const edge of edges) sum += offsets.get(edge.other)! + edge.sign * edge.d;
    const next = sum / edges.length;
    moved = Math.max(moved, Math.abs(next - offsets.get(t)!));
    offsets.set(t, next);
  }
  if (moved < 1e-4) break;
}

// ---- gauge: place the whole solution, never shape it --------------------
const recon = JSON.parse(await readFile(path.join(STAGING, 'recon.json'), 'utf8'));
const registry = JSON.parse(await readFile(path.join(CACHE, `${AREA.areaId}-registry.json`), 'utf8')).data as
  Array<{ buildingId: string; footprintLngLat: LngLat[] }>;
const groundOf = new Map<string, number>();
for (const m of recon.massing) if (Number.isFinite(m.groundLevel)) groundOf.set(m.buildingId, m.groundLevel);
const centroids: Array<{ x: number; y: number; g: number }> = [];
const seenB = new Set<string>();
for (const e of registry) {
  if (seenB.has(e.buildingId) || !groundOf.has(e.buildingId)) continue;
  seenB.add(e.buildingId);
  const ring = e.footprintLngLat.map(p => RD_NEW.fromLngLat(p));
  centroids.push({ x: ring.reduce((s, p) => s + p.x, 0) / ring.length,
    y: ring.reduce((s, p) => s + p.y, 0) / ring.length, g: groundOf.get(e.buildingId)! });
}
const gcell = new Map<string, typeof centroids>();
for (const c of centroids) { const k = `${Math.floor(c.x / 40)}:${Math.floor(c.y / 40)}`; (gcell.get(k) ?? gcell.set(k, []).get(k)!).push(c); }
const nearestGround = (x: number, y: number) => {
  const cx = Math.floor(x / 40), cy = Math.floor(y / 40);
  let best = Infinity, g: number | null = null;
  for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++)
    for (const c of gcell.get(`${cx + i}:${cy + j}`) ?? []) {
      const d = Math.hypot(c.x - x, c.y - y);
      if (d < best) { best = d; g = c.g; }
    }
  return best < 45 ? g : null;
};
const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
const above: number[] = [];
for (const view of views) {
  const p = rd.get(view.panoramaId)!;
  const g = nearestGround(p.x, p.y);
  if (g === null) continue;
  above.push(view.cameraHeight - offsets.get(track.get(view.panoramaId)!)! - GEOID_SEPARATION_M - g);
}
const gauge = median(above) - SURVEY_LENS_ABOVE_GROUND_M;
for (const [t, o] of offsets) offsets.set(t, o + gauge);

// ---- score, on equations the solve never saw ---------------------------
const score = (set: Equation[]) => {
  const before = set.map(e => Math.abs(e.d));
  const after = set.map(e => Math.abs(e.d - (offsets.get(e.a)! - offsets.get(e.b)!)));
  const q = (xs: number[], p: number) => [...xs].sort((a, b) => a - b)[Math.floor(p * (xs.length - 1))];
  return { n: set.length, beforeMedian: q(before, 0.5), afterMedian: q(after, 0.5),
    beforeP90: q(before, 0.9), afterP90: q(after, 0.9) };
};
// A held-out pair whose segments the solve never constrained is not a test of
// the model, only of coverage; those are reported separately rather than mixed in.
const constrained = new Set(train.flatMap(e => [e.a, e.b]));
const testable = test.filter(e => constrained.has(e.a) && constrained.has(e.b));
const held = score(testable), fitted = score(train);
console.log(`  ${test.length - testable.length} held-out pairs skipped: a segment seen nowhere else`);
console.log(`${equations.length} co-located cross-run pairs over ${offsets.size} runs`);
console.log(`  ${train.length} fitted, ${test.length} held out\n`);
for (const [name, s] of [['fitted', fitted], ['HELD OUT', held]] as const) {
  console.log(`  ${name.padEnd(9)} |Δz| median ${s.beforeMedian.toFixed(2)} → ${s.afterMedian.toFixed(2)} m`
    + `   p90 ${s.beforeP90.toFixed(2)} → ${s.afterP90.toFixed(2)} m`
    + `   (${Math.round(100 * (1 - s.afterMedian / s.beforeMedian))}% of the median removed)`);
}
const applied = [...offsets.values()].sort((a, b) => a - b);
const q = (p: number) => applied[Math.floor(p * (applied.length - 1))];
console.log(`\n  offsets  p05 ${q(0.05).toFixed(2)}  median ${q(0.5).toFixed(2)}  p95 ${q(0.95).toFixed(2)} m`);
const lens = above.map(a => a - gauge).sort((a, b) => a - b);
console.log(`  lens above local ground after correction:`
  + `  p05 ${lens[Math.floor(0.05 * lens.length)].toFixed(2)}`
  + `  median ${lens[Math.floor(0.5 * lens.length)].toFixed(2)}`
  + `  p95 ${lens[Math.floor(0.95 * lens.length)].toFixed(2)} m`);

const out = path.join(CACHE, 'track-datum.json');
await writeFile(out, JSON.stringify({
  metadata: {
    generatedAt: new Date().toISOString(),
    generator: 'scripts/facade-twin/solve-track-datum.ts',
    area: AREA.areaId, pairRadiusM: PAIR_RADIUS_M, sweeps: SWEEPS, holdout: HOLDOUT, segmentFrames: SEGMENT,
    gaugeLensAboveGroundM: SURVEY_LENS_ABOVE_GROUND_M,
    note: 'Subtract offsetM from a frame\'s published cameraHeight before the geoid separation. '
      + 'Solved from co-located frames of different runs; scored on held-out pairs.',
  },
  score: { heldOut: held, fitted },
  offsets: Object.fromEntries([...offsets].sort()),
}, null, 1));
console.log(`\n→ ${path.relative(process.cwd(), out)}`);
