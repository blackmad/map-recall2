/**
 * Test A (canal-belt `below` follow-up): run G1's facade-top reconciler over
 * the A2 photo rooflines instead of the Oud-Zuid scan, to check whether the
 * Museumkwartier/Willemspark `below` finding generalises to the canal belt.
 *
 * Confound to keep in view (stated again in the report): A2's photo heights
 * come from the panorama camera model and can carry their own vertical bias
 * — A2 has already found ~1.2 m offsets *between views* on one wall while
 * adding per-view bias alignment. A systematic photo bias would show up here
 * as a roughly constant signed offset across every wall; genuine 3DBAG
 * over-extrusion should be lumpy — large on some walls, ~0 on others — the
 * same shape the Oud-Zuid scan showed.
 *
 * Inputs (read-only, not owned by this task):
 *   $ROOFLINE_CACHE/roofline-eval/strip-profiles/<pandId>.json  (A2, 89 walls)
 *   $ROOFLINE_CACHE/roofline-eval/3dbag/3dbag-strips.json       (A3)
 *
 * Usage: npx tsx scripts/roofline-eval/reconcile-canal-belt-photos.ts
 */
import { readdir, readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { extractFacadeWallPlanes, extractRoofPlanes, type FacadeWallPlane } from '../../src/canalRecall/building/facadePointCloud.ts';
import { matchWallSurface, type A0WallFrame } from '../../src/canalRecall/facade/wallSurfaceMatch.ts';
import { reconcile, FACADE_TOP_DEPTH_M, type BuildingPartSurface, type ProfileSample, type Relation } from '../../src/canalRecall/facade/roofReconcile.ts';

const ROOFLINE_CACHE = process.env.ROOFLINE_CACHE || '/Users/blackmad/Code/map-recall2/.worktrees/amsterdam-facade-rebuild/.cache';
const STRIP_PROFILES_DIR = path.join(ROOFLINE_CACHE, 'roofline-eval', 'strip-profiles');
const BAG_CACHE_PATH = path.join(ROOFLINE_CACHE, 'roofline-eval', '3dbag', '3dbag-strips.json');
const OUT_DIR = path.resolve('review-data/roofline-gold/v1/g1/canal-belt');

type StripWall = {
  pandId: string;
  address?: string;
  wall: { start: [number, number]; end: [number, number] };
  consensus: Array<[number, number | null]>;
  viewBiasM?: unknown;
  shape?: string;
};

const stripFiles = (await readdir(STRIP_PROFILES_DIR)).filter((f) => /^\d+\.json$/.test(f));
const strips: StripWall[] = [];
let anyViewBias = false;
for (const file of stripFiles) {
  const parsed = JSON.parse(await readFile(path.join(STRIP_PROFILES_DIR, file), 'utf8')) as StripWall;
  strips.push(parsed);
  if (parsed.viewBiasM !== undefined) anyViewBias = true;
}
process.stdout.write(`Test A — canal-belt photo rooflines vs. 3DBAG facade-top\n`);
process.stdout.write(`  ${strips.length} strip-profiles walls from ${STRIP_PROFILES_DIR}\n`);
process.stdout.write(`  viewBiasM field present on any wall: ${anyViewBias ? 'YES — A2 has landed per-view bias alignment; re-run and compare' : 'no — A2 has not landed per-view bias alignment yet; absolute photo heights are unadjusted'}\n`);

const bagCache = JSON.parse(await readFile(BAG_CACHE_PATH, 'utf8')) as { features: Array<{ pandId: string; response: any }> };
const bagByPandId = new Map(bagCache.features.map((f) => [f.pandId, f.response]));
process.stdout.write(`  ${bagByPandId.size} cached 3DBAG buildings from ${BAG_CACHE_PATH}\n\n`);

type Row = {
  pandId: string;
  address: string;
  wallMatch: string;
  counts: Record<Relation, number>;
  resolvedColumns: number;
  medianDiffM: number | null;
  meanDiffM: number | null;
};

const relationOrder: Relation[] = ['agree', 'rises', 'below', 'unknown'];
const rows: Row[] = [];
let missingBag = 0;

for (const strip of strips) {
  const response = bagByPandId.get(strip.pandId);
  if (!response) {
    missingBag += 1;
    continue;
  }
  const buildingId = `bag:${strip.pandId}`;
  const walls: FacadeWallPlane[] = extractFacadeWallPlanes(response).filter((w) => w.buildingId === buildingId);
  const roofs = extractRoofPlanes(response).filter((r) => r.buildingId === buildingId);
  if (walls.length === 0) continue;

  const surfaces: BuildingPartSurface[] = [
    ...walls.map((w) => ({ id: w.surfaceId, vertices: w.vertices })),
    ...roofs.map((r) => ({ id: r.surfaceId, vertices: r.vertices })),
  ];

  // Premise check, same discipline as G1's gold run: does this plane actually
  // sit on a 3DBAG wall? Soft (reported, not a hard stop) because, unlike
  // R1's gold, the strip cutter's plane is its own rectified cut and may
  // legitimately span more than one WallSurface (a zigzag facade, as several
  // Oud-Zuid elevations already were).
  const frame: A0WallFrame = {
    pandId: strip.pandId,
    start: { x: strip.wall.start[0], y: strip.wall.start[1] },
    end: { x: strip.wall.end[0], y: strip.wall.end[1] },
  };
  const match = matchWallSurface(frame, walls);

  const profile: ProfileSample[] = strip.consensus.map(([along, up]) => ({ along, up }));
  const result = reconcile({
    buildingId,
    surfaces,
    plane: { start: frame.start, end: frame.end },
    profile,
    sampleM: 0.1,
    sectionDepthM: FACADE_TOP_DEPTH_M,
    gable: null,
  });

  const counts: Record<Relation, number> = { agree: 0, rises: 0, below: 0, unknown: 0 };
  for (const span of result.relationSpans) {
    const columns = Math.round((span.toAlong - span.fromAlong) / 0.1) + 1;
    counts[span.relation] += columns;
  }

  const diffs: number[] = [];
  for (let i = 0; i < profile.length; i += 1) {
    const p = profile[i].up;
    const s = result.section[i]?.up;
    if (p == null || s == null) continue;
    diffs.push(p - s);
  }
  diffs.sort((a, b) => a - b);
  const medianDiffM = diffs.length ? diffs[Math.floor(diffs.length / 2)] : null;
  const meanDiffM = diffs.length ? diffs.reduce((a, b) => a + b, 0) / diffs.length : null;

  rows.push({
    pandId: strip.pandId,
    address: strip.address ?? '',
    wallMatch: match.relation,
    counts,
    resolvedColumns: diffs.length,
    medianDiffM,
    meanDiffM,
  });
}

// --- report: relation table --------------------------------------------------
process.stdout.write(`${'pandId'.padEnd(18)} ${'address'.padEnd(28)} ${'wallMatch'.padEnd(10)} ${relationOrder.map((r) => r.padStart(7)).join(' ')} ${'medianDiffM'.padStart(12)} ${'meanDiffM'.padStart(10)}\n`);
const totals: Record<Relation, number> = { agree: 0, rises: 0, below: 0, unknown: 0 };
let matchCount = 0;
for (const row of rows) {
  for (const r of relationOrder) totals[r] += row.counts[r];
  if (row.wallMatch === 'match') matchCount += 1;
  process.stdout.write(
    `${row.pandId.padEnd(18)} ${row.address.slice(0, 28).padEnd(28)} ${row.wallMatch.padEnd(10)} ${relationOrder.map((r) => String(row.counts[r]).padStart(7)).join(' ')} ${(row.medianDiffM == null ? 'n/a' : row.medianDiffM.toFixed(2)).padStart(12)} ${(row.meanDiffM == null ? 'n/a' : row.meanDiffM.toFixed(2)).padStart(10)}\n`,
  );
}
process.stdout.write(`${'TOTAL'.padEnd(18)} ${''.padEnd(28)} ${`${matchCount}/${rows.length} match`.padEnd(10)} ${relationOrder.map((r) => String(totals[r]).padStart(7)).join(' ')}\n`);
if (missingBag > 0) process.stdout.write(`\n${missingBag} strip walls had no cached 3DBAG response and were skipped.\n`);

// --- distribution of per-wall median diffs ------------------------------------
const medians = rows.map((r) => r.medianDiffM).filter((v): v is number => v != null);
medians.sort((a, b) => a - b);
const mean = medians.reduce((a, b) => a + b, 0) / (medians.length || 1);
const variance = medians.reduce((sum, v) => sum + (v - mean) ** 2, 0) / (medians.length || 1);
const stddev = Math.sqrt(variance);
const quantile = (q: number) => medians[Math.min(medians.length - 1, Math.max(0, Math.round(q * (medians.length - 1))))];
const buckets = [
  { label: '<= -1.0 m (photo well below 3DBAG)', test: (v: number) => v <= -1.0 },
  { label: '-1.0..-0.3 m', test: (v: number) => v > -1.0 && v <= -0.3 },
  { label: '-0.3..0.3 m (roughly agree)', test: (v: number) => v > -0.3 && v <= 0.3 },
  { label: '0.3..1.0 m', test: (v: number) => v > 0.3 && v <= 1.0 },
  { label: '> 1.0 m (photo well above 3DBAG)', test: (v: number) => v > 1.0 },
];
process.stdout.write(`\ndistribution of per-wall median(photo - 3DBAG facade-top), n = ${medians.length} walls:\n`);
process.stdout.write(`  mean ${mean.toFixed(2)} m, stddev ${stddev.toFixed(2)} m, median ${quantile(0.5).toFixed(2)} m, p10 ${quantile(0.1).toFixed(2)} m, p90 ${quantile(0.9).toFixed(2)} m\n`);
for (const bucket of buckets) {
  const n = medians.filter(bucket.test).length;
  process.stdout.write(`  ${bucket.label.padEnd(38)} ${n} walls (${((n / medians.length) * 100).toFixed(0)}%)\n`);
}

await mkdir(OUT_DIR, { recursive: true });
await writeFile(
  path.join(OUT_DIR, 'test-a-photo-vs-3dbag.json'),
  `${JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      source: { stripProfiles: STRIP_PROFILES_DIR, bagCache: BAG_CACHE_PATH },
      anyViewBiasMField: anyViewBias,
      sectionDepthM: FACADE_TOP_DEPTH_M,
      totals,
      matchCount,
      wallCount: rows.length,
      distribution: { mean, stddev, median: quantile(0.5), p10: quantile(0.1), p90: quantile(0.9) },
      rows,
    },
    null,
    2,
  )}\n`,
);
process.stdout.write(`\nwrote ${path.join(OUT_DIR, 'test-a-photo-vs-3dbag.json')}\n`);
