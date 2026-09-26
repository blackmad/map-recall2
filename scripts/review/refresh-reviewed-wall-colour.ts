/**
 * Publish declared source-bound wall-colour corrections into the review packet.
 *
 * Why this exists: the 21 Sep review's colour/material group is case-08/14.
 * case-14 is fixed in the compiler (whole-facade accent guard) and its stored
 * study was refreshed. case-08 Rozengracht 251 declares an `upper-wall`
 * `brick` material with **no colour**, so `compileFacadePatches` emits no
 * material patch at all and the workbench paints the neutral render base
 * (#d7d0c7) instead of the dark brick of the 2025 source. Supplying the colour
 * silently in the compiler would treat a sampled value as an accepted
 * material; instead `wall-colour-corrections.json` declares the observation
 * and this script applies it to the review packet's source-shape study only.
 *
 * The stored `shapeFeatures` are **not** mutated, so the extraction gap stays
 * visible to `check-reviewed-wall-colour.ts` and a future extraction that
 * supplies the colour is still noticed. The corrected compile is reproducible
 * from the declared file plus the stored features.
 *
 * Published through the existing immutable `publishPreviewRevision` helper; it
 * never touches `current.json`, a release, notes or the spend journal.
 *
 * Run: npx tsx scripts/review/refresh-reviewed-wall-colour.ts [--dry-run]
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { compileSourceShapePreview } from './source-shape-preview.ts';
import { applySourceAssemblies } from './apply-source-assemblies.ts';
import { publishPreviewRevision } from './publish-preview-revision.ts';
import corrections from './wall-colour-corrections.json' with { type: 'json' };

const CASES = 'public/data/facade-repair-preview/cases.json';
const OUT = 'review-data/wall-colour-refresh.json';

const read = (file: string) => JSON.parse(fs.readFileSync(file, 'utf8'));
const spatial = read('scripts/review/spatial-source-corrections.json');

/** The corrected features clone for a case/tier: only the declared feature
 * colours are set; every other field is the packet's own stored feature. */
function correctedFeatures(features: any[], declared: any[]): any[] {
  const byId = new Map(declared.map((feature: any) => [feature.id, feature]));
  return features.map((feature: any) => {
    const override = byId.get(feature.id);
    return override ? { ...feature, colour: override.colour } : feature;
  });
}

/** The exact path `build-facade-preview` uses to turn stored features into a
 * delivered shape study. `case-08` carries no entrance assemblies, but keep the
 * spatial hook so the helper stays identical to the builder. */
function compileStudy(input: any, caseId: string, tier: string) {
  const study = applySourceAssemblies(
    compileSourceShapePreview(input),
    input,
    spatial.cases?.[caseId]?.[tier]?.entranceAssemblies,
  );
  return study;
}

const currentBytes = fs.readFileSync(CASES);
const current = JSON.parse(currentBytes.toString('utf8'));
const proposed = JSON.parse(currentBytes.toString('utf8'));

const refreshed: any[] = [];
const skipped: any[] = [];

for (const review of (corrections as any).cases) {
  const entry = proposed.cases.find((row: any) => row.caseId === review.caseId);
  if (!entry) { skipped.push({ caseId: review.caseId, reason: 'no packet entry' }); continue; }
  const input = entry.shapeFeatures?.full;
  if (!input) { skipped.push({ caseId: review.caseId, reason: 'no full shape features' }); continue; }
  if (input.cropSha256 !== review.source.sha256 || input.captureDate !== review.source.captureDate) {
    skipped.push({ caseId: review.caseId, reason: 'stale source' });
    continue;
  }
  const missing = review.features.filter((feature: any) => !input.features.some((stored: any) => stored.id === feature.id));
  if (missing.length) {
    skipped.push({ caseId: review.caseId, reason: `declared feature not in stored features: ${missing.map((feature: any) => feature.id).join(', ')}` });
    continue;
  }
  const correctedInput = { ...input, features: correctedFeatures(input.features, review.features) };
  const fresh = compileStudy(correctedInput, review.caseId, 'full');
  const marker = {
    status: 'declared-source-colour',
    state: review.observation.state,
    basis: review.observation.basis,
    sourceSha256: review.source.sha256,
    featureIds: review.features.map((feature: any) => feature.id),
    colours: Object.fromEntries(review.features.map((feature: any) => [feature.id, feature.colour])),
  };
  // In the stored packet the corrected study is compared against a study
  // recompiled from the same stored features through the same path. Because
  // the correction is applied at compile time (not stored in `shapeFeatures`),
  // equality means this case's stored study is already the declared render.
  if (JSON.stringify(fresh) === JSON.stringify(entry.shapeStudy?.full) && JSON.stringify(marker) === JSON.stringify(entry.wallColourReview)) {
    skipped.push({ caseId: review.caseId, reason: 'already-current' });
    continue;
  }
  const beforeMaterials = (entry.shapeStudy?.full?.patches ?? []).filter((patch: any) => patch.featureKind === 'observed-material').length;
  entry.shapeStudy.full = fresh;
  entry.wallColourReview = marker;
  refreshed.push({
    caseId: review.caseId,
    declaredFeatureIds: marker.featureIds,
    colours: marker.colours,
    beforeMaterials,
    afterMaterials: fresh.patches.filter((patch: any) => patch.featureKind === 'observed-material').length,
    afterColours: [...new Set(fresh.patches.map((patch: any) => patch.colour))].sort(),
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
  kind: 'reviewed-wall-colour-refresh',
  generatedAt: new Date().toISOString(),
  sourcePacket: { path: CASES, sha256: createHash('sha256').update(currentBytes).digest('hex') },
  refreshed,
  skipped,
  note: 'Targeted source-shape-study revision through publishPreviewRevision. Only the declared colour corrections are applied, and only to the delivered study; stored shapeFeatures, metric patches, frames, owners and every other case are left byte-identical. Prior packet bytes are archived by the publisher.',
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
