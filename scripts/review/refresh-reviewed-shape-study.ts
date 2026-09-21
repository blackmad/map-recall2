/**
 * Refresh stale source-shape studies in the review packet from their own stored
 * `shapeFeatures`, through the current (accent-guarded) facade compiler.
 *
 * Why this exists: the whole-facade trim guard in `cityAppearanceFacadeRecipes.ts`
 * (2026-09-21) stops a trim region covering >=60% of the crop from repainting the
 * wall. `build-facade-preview.ts` applies that guard, but the delivered packet was
 * built before it, so case-14 Elandsgracht 19 still paints its full wall white in
 * the source-aligned / workbench view even though the metric candidate is correct.
 *
 * This is a **targeted packet revision**, not a full regeneration. A full
 * `build-facade-preview` rebuild is unsafe here: several cases carry shape-study
 * post-processing (roof studies, coverage roofs, source-geometry corrections,
 * entrance assemblies) and some delivered corrections (case-30 glazed doors)
 * live outside that builder's fixtures. So this script only recomputes cases
 * that (a) have a stored, eligible `shapeFeatures` tier, (b) have no shape-study
 * post-processing, and (c) actually carry a >=60% trim feature. Today that is
 * case-14 full only; every other stored study is left byte-identical.
 *
 * The revision is published through the existing immutable `publishPreviewRevision`
 * helper, which archives the prior bytes and retains every case ID. It never
 * touches `current.json`, a release, notes or the spend journal.
 *
 * Run: npx tsx scripts/review/refresh-reviewed-shape-study.ts [--dry-run]
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { compileSourceShapePreview } from './source-shape-preview.ts';
import { publishPreviewRevision } from './publish-preview-revision.ts';

const CASES = 'public/data/facade-repair-preview/cases.json';
const OUT = 'review-data/shape-study-refresh.json';
const TRIM = new Set(['accent', 'band', 'surround', 'plinth']);
const COVERAGE_CASES = new Set(['case-01', 'case-04', 'case-09', 'case-27']);

const read = (file: string) => JSON.parse(fs.readFileSync(file, 'utf8'));
const nextSource = read('scripts/review/next-stage-source-review.json');
const sourceGeometry = read('scripts/review/source-geometry-corrections.json');
const spatial = read('scripts/review/spatial-source-corrections.json');

const currentBytes = fs.readFileSync(CASES);
const current = JSON.parse(currentBytes.toString('utf8'));

/** A case tier is eligible only when `build-facade-preview` would not add
 * post-processing on top of `compileSourceShapePreview` for it. */
function shapeStudyExtras(caseId: string, tier: string): string[] {
  const extras: string[] = [];
  if (nextSource.cases.some((row: any) => row.caseId === caseId && row.roofStudy)) extras.push('roof-study');
  if (COVERAGE_CASES.has(caseId)) extras.push('coverage-roof');
  if (sourceGeometry.cases.some((row: any) => row.caseId === caseId)) extras.push('source-geometry');
  if (spatial.cases?.[caseId]?.[tier]?.entranceAssemblies) extras.push('entrance-assemblies');
  return extras;
}

/** The whole-crop trim features whose paint the current guard suppresses. */
function wholeCropTrim(features: any[], width: number, height: number) {
  return (features ?? []).filter((feature: any) => {
    if (feature.kind !== 'material' || !TRIM.has(feature.region)) return false;
    if (!Array.isArray(feature.bounds) || feature.bounds.length !== 4) return false;
    const [left, top, right, bottom] = feature.bounds;
    return Math.max(0, right - left) * Math.max(0, bottom - top) / (width * height) >= 0.6;
  });
}

const refreshed: any[] = [];
const skipped: any[] = [];
const proposed = JSON.parse(currentBytes.toString('utf8'));

for (const entry of proposed.cases) {
  for (const tier of ['full', 'ground'] as const) {
    const input = entry.shapeFeatures?.[tier];
    if (!input) continue;
    const trims = wholeCropTrim(input.features, input.width, input.height);
    if (!trims.length) continue;
    const extras = shapeStudyExtras(entry.caseId, tier);
    if (extras.length) { skipped.push({ caseId: entry.caseId, tier, reason: 'shape-study post-processing', extras, trims: trims.map((t: any) => t.id) }); continue; }
    assert.ok(entry.shapeStudy?.[tier], `${entry.caseId}/${tier}: expected a stored shape study`);
    const fresh = compileSourceShapePreview({ width: input.width, height: input.height, cropSha256: input.cropSha256, captureDate: input.captureDate, features: input.features });
    // The whole-crop feature stays in `shapeFeatures`; the guard suppresses its
    // patch at compile time. Once the stored study already equals a fresh
    // guarded compile there is nothing to publish, so leave the packet untouched.
    if (JSON.stringify(fresh) === JSON.stringify(entry.shapeStudy[tier])) {
      skipped.push({ caseId: entry.caseId, tier, reason: 'already-current', trims: trims.map((trim: any) => trim.id) });
      continue;
    }
    const colourCounts = (study: any) => {
      const counts = new Map<string, number>();
      for (const patch of study.patches ?? []) counts.set(`${patch.featureKind}:${patch.colour}`, (counts.get(`${patch.featureKind}:${patch.colour}`) ?? 0) + 1);
      return counts;
    };
    const before = colourCounts(entry.shapeStudy[tier]);
    const after = colourCounts(fresh);
    // The only permitted change is that whole-crop trim colours lose patches.
    const trimColours = new Set(trims.map((trim: any) => trim.colour));
    for (const [key, count] of before) {
      const colour = key.slice(key.lastIndexOf(':') + 1);
      const next = after.get(key) ?? 0;
      if (trimColours.has(colour)) assert.ok(next <= count, `${entry.caseId}/${tier}: whole-crop trim ${key} gained patches`);
      else assert.equal(next, count, `${entry.caseId}/${tier}: unexpected patch-count change for ${key} (${next} != ${count})`);
    }
    // A colour that only appeared because the whole-crop trim was skipped must
    // not be dropped by the guard; every post-refresh patch key must be a
    // subset of the stored study.
    for (const [key, count] of after) assert.ok(before.has(key) && before.get(key) === count, `${entry.caseId}/${tier}: fresh study added ${key}`);
    const beforePatches = (entry.shapeStudy[tier].patches ?? []).length;
    const beforeColours = [...new Set((entry.shapeStudy[tier].patches ?? []).map((patch: any) => patch.colour))].sort();
    const afterColours = [...new Set((fresh.patches ?? []).map((patch: any) => patch.colour))].sort();
    entry.shapeStudy[tier] = fresh;
    refreshed.push({ caseId: entry.caseId, tier, beforePatches, afterPatches: fresh.patches.length, removedTrimIds: trims.map((trim: any) => trim.id), beforeColours, afterColours });
  }
}

assert.equal(proposed.cases.length, current.cases.length, 'case count changed');
assert.deepEqual(
  proposed.cases.map((entry: any) => entry.caseId),
  current.cases.map((entry: any) => entry.caseId),
  'case IDs changed',
);

const report = {
  version: 1,
  kind: 'reviewed-shape-study-refresh',
  generatedAt: new Date().toISOString(),
  sourcePacket: { path: CASES, sha256: createHash('sha256').update(currentBytes).digest('hex') },
  refreshed,
  skipped,
  note: 'Targeted shape-study revision through publishPreviewRevision. Metric patches, frames, owners and every other case are left byte-identical; prior packet bytes are archived by the publisher.',
};

if (process.argv.includes('--dry-run')) {
  console.log(JSON.stringify({ mode: 'dry-run', refreshed, skipped }, null, 2));
} else {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  if (!refreshed.length) {
    console.log(JSON.stringify({ mode: 'noop', refreshed: [], skipped }, null, 2));
  } else {
    const expected = createHash('sha256').update(currentBytes).digest('hex');
    const published = await publishPreviewRevision(process.cwd(), expected, Buffer.from(JSON.stringify(proposed)));
    fs.writeFileSync(OUT, JSON.stringify({ ...report, published }, null, 2) + '\n');
    console.log(JSON.stringify({ mode: 'published', refreshed, skipped, published }, null, 2));
  }
}
