/**
 * Publish declared opening-frame clearances into the review packet's stored
 * source-shape studies.
 *
 * Why this exists: `opening-frame-corrections.json` declares, per reviewed
 * opening, the measured same-row glazing gap so the compiler draws a frame that
 * meets its neighbour instead of crossing it (case-05 Lauriergracht 67/69's
 * 1.9 px narrow-window/bay gap). `build-facade-preview.ts` applies the
 * correction through the shared builder, but the delivered packet was built
 * before it, so the stored study still paints overlapping frames.
 *
 * This is a **targeted packet revision**, not a full regeneration: a full
 * rebuild churns every case and drops delivered corrections that live outside
 * that builder. It recomputes only the named case/tier's stored shape study from
 * its own stored `shapeFeatures`, through the same guarded compiler, and writes
 * the corrected features back so a fresh compile reproduces them. It asserts the
 * only changes are the named features' frame geometry (patch count and every
 * colour key are conserved), and it is idempotent.
 *
 * The revision is published through the immutable `publishPreviewRevision`
 * helper, which archives the prior bytes. It never touches `current.json`, a
 * release, notes or the spend journal.
 *
 * Run: npx tsx scripts/review/refresh-reviewed-opening-frames.ts [--dry-run]
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { compileSourceShapePreview } from './source-shape-preview.ts';
import { publishPreviewRevision } from './publish-preview-revision.ts';
import { applyOpeningFrameCorrections } from '../../src/canalRecall/facade/openingFrameCorrections.ts';
import corrections from './opening-frame-corrections.json' with { type: 'json' };

const CASES = 'public/data/facade-repair-preview/cases.json';
const OUT = 'review-data/opening-frame-refresh.json';
const read = (file: string) => JSON.parse(fs.readFileSync(file, 'utf8'));

// A stored study carrying post-processing the plain compiler does not reproduce
// must be left byte-identical (see refresh-reviewed-shape-study.ts).
const nextSource = read('scripts/review/next-stage-source-review.json');
const sourceGeometry = read('scripts/review/source-geometry-corrections.json');
const COVERAGE_CASES = new Set(['case-01', 'case-04', 'case-09', 'case-27']);
const postProcessing = (caseId: string, tier: string) => [
  nextSource.cases.some((row: any) => row.caseId === caseId && row.roofStudy) ? 'roof-study' : null,
  COVERAGE_CASES.has(caseId) ? 'coverage-roof' : null,
  sourceGeometry.cases.some((row: any) => row.caseId === caseId) ? 'source-geometry' : null,
  read('scripts/review/spatial-source-corrections.json').cases?.[caseId]?.[tier]?.entranceAssemblies ? 'entrance-assemblies' : null,
].filter(Boolean);

const currentBytes = fs.readFileSync(CASES);
const current = JSON.parse(currentBytes.toString('utf8'));
const proposed = JSON.parse(currentBytes.toString('utf8'));
const refreshed: any[] = [];
const skipped: any[] = [];

for (const [caseId, tiers] of Object.entries((corrections as any).cases)) {
  for (const tier of ['full', 'ground'] as const) {
    const correction = (tiers as any)[tier];
    if (!correction) continue;
    const entry = proposed.cases.find((row: any) => row.caseId === caseId);
    if (!entry) { skipped.push({ caseId, tier, reason: 'no packet entry' }); continue; }
    const input = entry.shapeFeatures?.[tier];
    if (!input) { skipped.push({ caseId, tier, reason: 'no stored shape features' }); continue; }
    const extras = postProcessing(caseId, tier);
    if (extras.length) { skipped.push({ caseId, tier, reason: 'shape-study post-processing', extras }); continue; }
    const corrected = applyOpeningFrameCorrections(correction, { features: input.features, cropSha256: input.cropSha256, captureDate: input.captureDate });
    const fresh = compileSourceShapePreview({ width: input.width, height: input.height, cropSha256: input.cropSha256, captureDate: input.captureDate, features: corrected });
    if (Array.isArray(entry.shapeStudy?.[tier]?.omissions)) fresh.omissions = entry.shapeStudy[tier].omissions;

    const featureChanged = JSON.stringify(corrected) !== JSON.stringify(input.features);
    const studyChanged = JSON.stringify(fresh) !== JSON.stringify(entry.shapeStudy?.[tier]);
    if (!featureChanged && !studyChanged) { skipped.push({ caseId, tier, reason: 'already-current' }); continue; }

    const targetIds = correction.clearances.map((c: any) => c.featureId as string);
    const isTarget = (featureId: string) => targetIds.some((id) => featureId === id || featureId.endsWith(`:${id}`));
    const colourCounts = (study: any) => {
      const counts = new Map<string, number>();
      for (const patch of study?.patches ?? []) counts.set(`${patch.featureKind}:${patch.colour}`, (counts.get(`${patch.featureKind}:${patch.colour}`) ?? 0) + 1);
      return counts;
    };
    const before = colourCounts(entry.shapeStudy[tier]);
    const after = colourCounts(fresh);
    for (const key of new Set([...before.keys(), ...after.keys()]))
      assert.equal(before.get(key) ?? 0, after.get(key) ?? 0, `${caseId}/${tier}: patch-count change for ${key}`);
    assert.equal(entry.shapeStudy[tier].patches.length, fresh.patches.length, `${caseId}/${tier}: patch total changed`);
    // Only the named features may move, and only by shrinking their frames.
    const beforeBbox = new Map<string, number[]>();
    const afterBbox = new Map<string, number[]>();
    const bbox = (study: any, map: Map<string, number[]>) => {
      for (const patch of study.patches) {
        const current = map.get(patch.featureId) ?? [Infinity, Infinity, -Infinity, -Infinity];
        for (let i = 0; i < patch.triangles.length; i += 3) {
          current[0] = Math.min(current[0], patch.triangles[i]); current[1] = Math.min(current[1], patch.triangles[i + 1]);
          current[2] = Math.max(current[2], patch.triangles[i]); current[3] = Math.max(current[3], patch.triangles[i + 1]);
        }
        map.set(patch.featureId, current);
      }
    };
    bbox(entry.shapeStudy[tier], beforeBbox);
    bbox(fresh, afterBbox);
    for (const featureId of new Set([...beforeBbox.keys(), ...afterBbox.keys()])) {
      const a = beforeBbox.get(featureId), b = afterBbox.get(featureId);
      if (!a || !b || JSON.stringify(a) === JSON.stringify(b)) continue;
      assert.ok(isTarget(featureId), `${caseId}/${tier}: unexpected feature ${featureId} moved`);
    }

    entry.shapeFeatures[tier] = { ...input, features: corrected };
    entry.shapeStudy[tier] = fresh;
    refreshed.push({ caseId, tier, clearances: correction.clearances.map((c: any) => c.featureId), patches: fresh.patches.length });
  }
}

assert.deepEqual(proposed.cases.map((e: any) => e.caseId), current.cases.map((e: any) => e.caseId), 'case IDs changed');

const report = {
  version: 1,
  kind: 'reviewed-opening-frame-refresh',
  generatedAt: new Date().toISOString(),
  sourcePacket: { path: CASES, sha256: createHash('sha256').update(currentBytes).digest('hex') },
  refreshed,
  skipped,
  note: 'Targeted source-shape-study revision through publishPreviewRevision. Metric patches, frames, owners and every other case are left byte-identical; prior packet bytes are archived by the publisher.',
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
