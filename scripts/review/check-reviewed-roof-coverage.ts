/**
 * Named regression for the 2026-09-21 case-27 roof-coverage delivery.
 *
 * The 25-case review grouped case-19/27 as "missing roof". `case-27`
 * De Clercqstraat 79 is the one with a legible full source; the review packet's
 * stored full source-shape study painted the roof as brick and had no roof
 * silhouette. `roof-coverage-corrections.json` now declares a pixel-inspected
 * silhouette (left slope, ridge, two chimney stacks) plus a dark roof field, and
 * `refresh-reviewed-roof-coverage.ts` republished the study through the same
 * `prepareRoofCoverageStudy` path `build-facade-preview.ts` uses.
 *
 * `case-21` Lauriergracht 50 is the second delivered leg (2026-09-21, pass 18):
 * the review's "missing roof" on a bell-gabled building whose stored study was a
 * flat-topped brick rectangle. The same coverage lane now carries a
 * pixel-inspected bell-gable outline plus cream pediment/volute fields.
 *
 * This pins that each delivered study is exactly a fresh coverage compile from
 * the packet's own stored features (so a rebuild would not lose it), that the
 * silhouette and reviewed fields are present, and that no roof opening was
 * invented. case-19 stays parked: its source is too occluded/ambiguous for a
 * defensible silhouette, so it must remain `source-outline-not-reviewed`.
 *
 * Run: npx tsx scripts/review/check-reviewed-roof-coverage.ts
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { compileSourceShapePreview } from './source-shape-preview.ts';
import { applyRoofCoverageStudy, prepareRoofCoverageStudy } from './roof-coverage-corrections.ts';
import reviewData from './roof-coverage-corrections.json' with { type: 'json' };

const CASES = 'public/data/facade-repair-preview/cases.json';
const OUT = 'review-data/case-roof-coverage.json';

const bytes = fs.readFileSync(CASES);
const packet = JSON.parse(bytes.toString('utf8'));
const caseById = (id: string) => {
  const entry = packet.cases.find((row: any) => row.caseId === id);
  assert.ok(entry, `${id} missing from the review packet`);
  return entry;
};
const reviewFor = (id: string) => {
  const review = (reviewData as any).cases.find((row: any) => row.caseId === id);
  assert.ok(review, `${id} missing from roof-coverage-corrections.json`);
  return review;
};

// Every declared correction must still be delivered with a roof silhouette and
// its reviewed features, so the coverage lane cannot silently drop a case.
for (const review of (reviewData as any).cases) {
  const entry = caseById(review.caseId);
  const input = entry.shapeFeatures?.full;
  assert.ok(input, `${review.caseId} must carry stored full shape features`);
  const stored = entry.shapeStudy?.full;
  assert.ok(stored?.sourceSilhouette, `${review.caseId} must carry a delivered roof silhouette`);
  const ids = new Set(input.features.filter((feature: any) => feature.id.startsWith('full:review:')).map((feature: any) => feature.id));
  for (const feature of review.add) assert.ok(ids.has(feature.id), `${review.caseId} lost reviewed feature ${feature.id}`);
}

// case-27 has no other shape-study post-processing, so its delivered study must
// be exactly a fresh coverage compile from its own stored features. This is what
// makes the revision durable across a packet rebuild rather than a one-off edit.
{
  const review = reviewFor('case-27');
  const entry = caseById('case-27');
  const input = entry.shapeFeatures.full;
  const addIds = new Set(review.add.map((feature: any) => feature.id));
  const freshInput = { ...input, features: input.features.filter((feature: any) => !addIds.has(feature.id)) };
  const prepared = prepareRoofCoverageStudy('case-27', freshInput);
  const fresh = applyRoofCoverageStudy(compileSourceShapePreview(prepared.input as any), prepared);
  assert.equal(
    JSON.stringify(entry.shapeStudy.full),
    JSON.stringify(fresh),
    'case-27 stored full study is out of sync; re-run scripts/review/refresh-reviewed-roof-coverage.ts',
  );
}

// case-27: the delivered roof must be the declared source-bound silhouette,
// field and stacks, and must not invent an opening the source does not show.
{
  const entry = caseById('case-27');
  const study = entry.shapeStudy.full;
  const reviewFeatures = (study.patches ?? [])
    .filter((patch: any) => patch.featureId.includes(':review:'))
    .map((patch: any) => patch.featureId.split(':review:').at(-1));
  assert.deepEqual(
    [...new Set(reviewFeatures)].sort(),
    ['left-chimney', 'right-chimney', 'roof-field'],
    'case-27 review features changed',
  );
  const materialColours = new Set(
    (study.patches ?? [])
      .filter((patch: any) => patch.featureId.includes(':review:'))
      .map((patch: any) => patch.colour),
  );
  assert.ok(materialColours.has('#3f3f3d'), 'case-27 roof field must paint the declared dark roof #3f3f3d');
  assert.equal(study.sourceSilhouette.polygonPx.length, reviewFor('case-27').silhouettePolygonPx.length + 2, 'case-27 silhouette closure changed');
  assert.equal(study.sourceSilhouette.polygonPx.at(-2)[0], 906, 'case-27 right edge moved');
  assert.equal(study.sourceSilhouette.polygonPx.at(-1)[0], 267, 'case-27 left edge moved');
  assert.ok(
    (study.patches ?? []).every((patch: any) => !/review:.*(window|dormer|door)/.test(patch.featureId)),
    'case-27 must not invent a roof opening',
  );
  assert.equal(entry.roofReview.status, 'source-outline-reviewed', 'case-27 must report its roof as reviewed');
  assert.match(entry.roofReview.uncertainty, /pole|wire|neighbour/i);
}

// case-21 (pass 18) has no other shape-study post-processing, so its delivered
// study must also be exactly a fresh coverage compile from its own stored
// features, and it must carry the declared bell-gable outline and cream fields.
{
  const review = reviewFor('case-21');
  const entry = caseById('case-21');
  const input = entry.shapeFeatures.full;
  const addIds = new Set(review.add.map((feature: any) => feature.id));
  const freshInput = { ...input, features: input.features.filter((feature: any) => !addIds.has(feature.id)) };
  const prepared = prepareRoofCoverageStudy('case-21', freshInput);
  const fresh = applyRoofCoverageStudy(compileSourceShapePreview(prepared.input as any), prepared);
  assert.equal(
    JSON.stringify(entry.shapeStudy.full),
    JSON.stringify(fresh),
    'case-21 stored full study is out of sync; re-run scripts/review/refresh-reviewed-roof-coverage.ts',
  );
  const study = entry.shapeStudy.full;
  const reviewFeatures = [...new Set((study.patches ?? [])
    .filter((patch: any) => patch.featureId.includes(':review:'))
    .map((patch: any) => patch.featureId.split(':review:').at(-1)))].sort();
  assert.deepEqual(reviewFeatures, ['gable-pediment', 'left-volute', 'right-volute'], 'case-21 review features changed');
  const materialColours = new Set((study.patches ?? [])
    .filter((patch: any) => patch.featureId.includes(':review:'))
    .map((patch: any) => patch.colour));
  for (const colour of ['#ded0a8', '#e6d7b0', '#d3c69c']) {
    assert.ok(materialColours.has(colour), `case-21 must paint its declared cream field ${colour}`);
  }
  assert.equal(study.sourceSilhouette.polygonPx.length, review.silhouettePolygonPx.length + 2, 'case-21 silhouette closure changed');
  assert.equal(study.sourceSilhouette.polygonPx.at(-2)[0], review.silhouettePolygonPx.at(-1)[0], 'case-21 right edge moved');
  assert.equal(study.sourceSilhouette.polygonPx.at(-1)[0], review.silhouettePolygonPx[0][0], 'case-21 left edge moved');
  assert.ok(
    (study.patches ?? []).every((patch: any) => !/review:.*(window|dormer|door)/.test(patch.featureId)),
    'case-21 must not invent a roof opening',
  );
  assert.equal(entry.roofReview.status, 'source-outline-reviewed', 'case-21 must report its roof as reviewed');
  assert.match(entry.roofReview.uncertainty, /neighbour|cast shadow|crest/i);
}

// case-19 stays parked: its source has no defensible silhouette.
{
  const entry = caseById('case-19');
  assert.equal(entry.roofReview?.status, 'source-outline-not-reviewed', 'case-19 must stay unreviewed');
  assert.equal(entry.shapeStudy?.full?.sourceSilhouette, undefined, 'case-19 must not carry a roof silhouette');
}

fs.writeFileSync(
  OUT,
  JSON.stringify(
    {
      version: 1,
      kind: 'case-roof-coverage',
      generatedAt: new Date().toISOString(),
      packet: { path: CASES, sha256: createHash('sha256').update(bytes).digest('hex') },
      delivered: (reviewData as any).cases.map((review: any) => ({
        caseId: review.caseId,
        silhouettePoints: caseById(review.caseId).shapeStudy.full.sourceSilhouette.polygonPx.length,
        patches: caseById(review.caseId).shapeStudy.full.patches.length,
      })),
      parked: { 'case-19': 'source roof occluded/ambiguous; no defensible silhouette' },
    },
    null,
    2,
  ) + '\n',
);

console.log(
  `Reviewed roof coverage: ${(reviewData as any).cases.length} declared corrections delivered with silhouettes and reviewed features; ` +
    `case-27 is a fresh compile (${caseById('case-27').shapeStudy.full.patches.length} patches, #3f3f3d, two stacks); ` +
    `case-21 is a fresh compile (${caseById('case-21').shapeStudy.full.patches.length} patches, cream gable fields); case-19 stays parked.`,
);
