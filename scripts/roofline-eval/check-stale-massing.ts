/**
 * Measurement, not a pipeline change: tests the coordinator's "stale
 * massing" hypothesis for A2's +3.2 m median offset against 3DBAG's own
 * `b3_h_dak_max`.
 *
 * `strips-roofline-v2`'s `bottomNap`/`topNap` were derived (in
 * `build-strip-set.ts`, over in the building-twin worktree) from
 * `recon.json`'s `massing` array: `top = max(ridgeHeight, eavesHeight,
 * ground + 8)`, `topNap = top + headroomM`. A0's own report found the 90
 * canal-belt panden's massing came from the SUPERSEDED `measured-facades.json`
 * snapshot (2180 facades) rather than the current one (422) -- so that `top`
 * may not match current 3DBAG's `b3_h_dak_max` at all, independent of any
 * camera-model error.
 *
 * This script does NOT re-render or re-segment anything. It:
 *   1. Recovers each wall's `topZ_used` (= frame.topNap - headroomM) and
 *      `groundZ_used` (= frame.bottomNap + 0.8) from the v2 manifest, and
 *      compares them to the SAME wall's `b3_h_maaiveld`/`b3_h_dak_max` in the
 *      A3 3DBAG cache (the same cache `extract-strip-rooflines.ts` already
 *      reads `b3_h_dak_max` from for `roofMaxNapFor`).
 *   2. Re-derives what each wall's `medianOffsetVs3dbagMaxAfterAlignmentM`
 *      (already in `strip-profiles-report.json`, and ALREADY computed
 *      against the correct, current `b3_h_dak_max`) would be if the strip
 *      had used the CURRENT topZ instead of the stale one: a uniform shift
 *      of the consensus `up` values by `-topDiff` (pure re-mapping, no
 *      re-render -- see the derivation in the report), where
 *      `topDiff = topZ_used - b3_h_dak_max` is exactly what step 1 measured.
 *      Algebraically: correctedOffset = originalOffset - topDiff.
 *   3. Reports the Pearson correlation between `topDiff` and the ORIGINAL
 *      offset across the 89 walls: strong + corrected offset near zero
 *      confirms the theory; weak kills it.
 *
 * Run: npx tsx scripts/roofline-eval/check-stale-massing.ts
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const buildingTwinCache = '/Users/blackmad/Code/map-recall2/.worktrees/amsterdam-building-twin/.cache/facade-twin';
const stripsDir = path.join(buildingTwinCache, 'strips-roofline-v2');
const cacheRoot = '/Users/blackmad/Code/map-recall2/.worktrees/amsterdam-facade-rebuild/.cache';
const threeDBagCachePath = path.join(cacheRoot, 'roofline-eval/3dbag/3dbag-strips.json');
const reportPath = path.join(cacheRoot, 'roofline-eval/strip-profiles-report.json');

interface ManifestStrip { pandId: string; frame: { bottomNap: number; topNap: number } }
interface Manifest { metadata: { headroomM: number }; strips: ManifestStrip[] }
const manifest = JSON.parse(await readFile(path.join(stripsDir, 'manifest.json'), 'utf8')) as Manifest;
const headroomM = manifest.metadata.headroomM;

interface ThreeDBagCache { features: Array<{ pandId: string; response: unknown }> }
const threeDBagCache = JSON.parse(await readFile(threeDBagCachePath, 'utf8')) as ThreeDBagCache;
const threeDBagByPand = new Map<string, unknown>(threeDBagCache.features.map(f => [f.pandId, f.response]));

function buildingAttributes(pandId: string): { groundNap: number | null; roofMaxNap: number | null } {
  const response = threeDBagByPand.get(pandId) as { feature?: { CityObjects?: Record<string, { type?: string; attributes?: Record<string, unknown> }> } } | undefined;
  const cityObjects = response?.feature?.CityObjects ?? {};
  for (const object of Object.values(cityObjects)) {
    if (object.type !== 'Building') continue;
    const ground = object.attributes?.b3_h_maaiveld;
    const roofMax = object.attributes?.b3_h_dak_max;
    return {
      groundNap: typeof ground === 'number' && Number.isFinite(ground) ? ground : null,
      roofMaxNap: typeof roofMax === 'number' && Number.isFinite(roofMax) ? roofMax : null,
    };
  }
  return { groundNap: null, roofMaxNap: null };
}

interface ReportWall { pandId: string; address: string | null; medianOffsetVs3dbagMaxAfterAlignmentM: number | null }
interface Report { wallReports: ReportWall[] }
const report = JSON.parse(await readFile(reportPath, 'utf8')) as Report;
const offsetByPand = new Map(report.wallReports.map(w => [w.pandId, w.medianOffsetVs3dbagMaxAfterAlignmentM]));

const byPand = new Map<string, ManifestStrip>();
for (const s of manifest.strips) if (!byPand.has(s.pandId)) byPand.set(s.pandId, s);

interface Row {
  pandId: string; groundUsed: number; topUsed: number;
  groundCurrent: number | null; roofMaxCurrent: number | null;
  groundDiff: number | null; topDiff: number | null;
  originalOffset: number | null; correctedOffset: number | null;
}
const rows: Row[] = [];
for (const [pandId, strip] of byPand) {
  const groundUsed = strip.frame.bottomNap + 0.8;
  const topUsed = strip.frame.topNap - headroomM;
  const { groundNap, roofMaxNap } = buildingAttributes(pandId);
  const groundDiff = groundNap !== null ? groundUsed - groundNap : null;
  const topDiff = roofMaxNap !== null ? topUsed - roofMaxNap : null;
  const originalOffset = offsetByPand.get(pandId) ?? null;
  const correctedOffset = originalOffset !== null && topDiff !== null ? Math.round((originalOffset - topDiff) * 1000) / 1000 : null;
  rows.push({ pandId, groundUsed, topUsed, groundCurrent: groundNap, roofMaxCurrent: roofMaxNap, groundDiff, topDiff, originalOffset, correctedOffset });
}
rows.sort((a, b) => a.pandId < b.pandId ? -1 : 1);

const median = (values: number[]): number | null => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  return n % 2 === 1 ? sorted[(n - 1) / 2] : (sorted[n / 2 - 1] + sorted[n / 2]) / 2;
};
const summary = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  const q = (p: number) => sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(p * (sorted.length - 1)))] : null;
  return { n: sorted.length, min: sorted[0] ?? null, p10: q(0.1), median: median(sorted), p90: q(0.9), max: sorted[sorted.length - 1] ?? null };
};

function pearson(xs: number[], ys: number[]): number | null {
  const n = xs.length;
  if (n < 2) return null;
  const mx = xs.reduce((a, b) => a + b, 0) / n, my = ys.reduce((a, b) => a + b, 0) / n;
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) { const dx = xs[i] - mx, dy = ys[i] - my; sxy += dx * dy; sxx += dx * dx; syy += dy * dy; }
  if (sxx === 0 || syy === 0) return null;
  return sxy / Math.sqrt(sxx * syy);
}

const groundDiffs = rows.map(r => r.groundDiff).filter((v): v is number => v !== null);
const topDiffs = rows.map(r => r.topDiff).filter((v): v is number => v !== null);
const originalOffsets = rows.filter(r => r.originalOffset !== null && r.topDiff !== null);
const correlationPairs = originalOffsets.map(r => [r.topDiff!, r.originalOffset!] as const);
const correlation = pearson(correlationPairs.map(p => p[0]), correlationPairs.map(p => p[1]));
const correctedOffsets = rows.map(r => r.correctedOffset).filter((v): v is number => v !== null);

console.log(`Walls: ${rows.length} total, ${rows.filter(r => r.groundCurrent === null).length} with no 3DBAG match (ground), ${rows.filter(r => r.roofMaxCurrent === null).length} with no 3DBAG match (roof max)`);
console.log(`groundZ_used - b3_h_maaiveld (m): ${JSON.stringify(summary(groundDiffs))}`);
console.log(`topZ_used - b3_h_dak_max (m):     ${JSON.stringify(summary(topDiffs))}`);
console.log(`ORIGINAL medianOffsetVs3dbagMaxAfterAlignmentM (m, n=${originalOffsets.length}): ${JSON.stringify(summary(originalOffsets.map(r => r.originalOffset!)))}`);
console.log(`CORRECTED offset (= original - topDiff) (m, n=${correctedOffsets.length}): ${JSON.stringify(summary(correctedOffsets))}`);
console.log(`Pearson correlation(topDiff, originalOffset) across ${correlationPairs.length} walls: ${correlation?.toFixed(3) ?? 'n/a'}`);
console.log('');
console.log('pandId, groundUsed, groundCurrent, groundDiff, topUsed, roofMaxCurrent, topDiff, originalOffset, correctedOffset');
for (const r of rows) {
  console.log([r.pandId, r.groundUsed.toFixed(2), r.groundCurrent?.toFixed(2) ?? 'n/a', r.groundDiff?.toFixed(2) ?? 'n/a',
    r.topUsed.toFixed(2), r.roofMaxCurrent?.toFixed(2) ?? 'n/a', r.topDiff?.toFixed(2) ?? 'n/a',
    r.originalOffset?.toFixed(2) ?? 'n/a', r.correctedOffset?.toFixed(2) ?? 'n/a'].join(', '));
}
