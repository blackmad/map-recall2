/**
 * Publish a declared source-bound roof coverage correction into the review
 * packet for any covered case whose stored full study does not yet carry it.
 *
 * Why this exists: `roof-coverage-corrections.json` declares pixel-inspected
 * roof silhouettes and roof fields (case-01/04/09/27). `build-facade-preview.ts`
 * applies them, but a full rebuild is unsafe here (several cases carry
 * shape-study post-processing and delivered corrections that live outside that
 * builder). So this script recomputes only a missing study from the packet's own
 * stored `shapeFeatures.full`, through the same `prepareRoofCoverageStudy` /
 * `applyRoofCoverageStudy` path the builder uses.
 *
 * It is idempotent: a case whose stored study already carries a
 * `sourceSilhouette` is skipped, and any previously delivered `full:review:*`
 * feature is stripped before re-application so it cannot double-add.
 *
 * The revision is published through the existing immutable `publishPreviewRevision`
 * helper, which archives the prior bytes and retains every case ID. It never
 * touches `current.json`, a release, notes or the spend journal.
 *
 * Run: npx tsx scripts/review/refresh-reviewed-roof-coverage.ts [--dry-run]
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { compileSourceShapePreview } from './source-shape-preview.ts';
import { applyRoofCoverageStudy, prepareRoofCoverageStudy } from './roof-coverage-corrections.ts';
import { publishPreviewRevision } from './publish-preview-revision.ts';
import reviewData from './roof-coverage-corrections.json' with { type: 'json' };

const CASES = 'public/data/facade-repair-preview/cases.json';
const OUT = 'review-data/roof-coverage-refresh.json';

const read = (file: string) => JSON.parse(fs.readFileSync(file, 'utf8'));
const currentBytes = fs.readFileSync(CASES);
const current = JSON.parse(currentBytes.toString('utf8'));
const proposed = JSON.parse(currentBytes.toString('utf8'));

const refreshed: any[] = [];
const skipped: any[] = [];

for (const review of (reviewData as any).cases) {
  const entry = proposed.cases.find((row: any) => row.caseId === review.caseId);
  if (!entry) { skipped.push({ caseId: review.caseId, reason: 'no packet entry' }); continue; }
  const input = entry.shapeFeatures?.full;
  if (!input) { skipped.push({ caseId: review.caseId, reason: 'no full shape features' }); continue; }
  if (entry.shapeStudy?.full?.sourceSilhouette) { skipped.push({ caseId: review.caseId, reason: 'already-current' }); continue; }
  if (input.cropSha256 !== review.source.sha256 || input.captureDate !== review.source.captureDate) {
    skipped.push({ caseId: review.caseId, reason: 'stale source' });
    continue;
  }
  const addIds = new Set(review.add.map((feature: any) => feature.id));
  input.features = input.features.filter((feature: any) => !addIds.has(feature.id));
  const prepared = prepareRoofCoverageStudy(review.caseId, input);
  entry.shapeFeatures.full = prepared.input;
  const study = applyRoofCoverageStudy(compileSourceShapePreview(prepared.input as any), prepared);
  entry.shapeStudy.full = study;
  entry.roofReview = { status: 'source-outline-reviewed', uncertainty: prepared.occlusionUncertainty };
  refreshed.push({
    caseId: review.caseId,
    reviewFeatures: review.add.map((feature: any) => feature.id),
    silhouettePoints: review.silhouettePolygonPx.length,
    patches: study.patches.length,
  });
}

assert.equal(proposed.cases.length, current.cases.length, 'case count changed');
assert.deepEqual(
  proposed.cases.map((entry: any) => entry.caseId),
  current.cases.map((entry: any) => entry.caseId),
  'case IDs changed',
);

const report = {
  version: 1,
  kind: 'reviewed-roof-coverage-refresh',
  generatedAt: new Date().toISOString(),
  sourcePacket: { path: CASES, sha256: createHash('sha256').update(currentBytes).digest('hex') },
  refreshed,
  skipped,
  note: 'Targeted roof-coverage revision through publishPreviewRevision. Metric patches, frames, owners and every other case are left byte-identical; prior packet bytes are archived by the publisher.',
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
