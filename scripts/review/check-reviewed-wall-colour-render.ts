/**
 * Named regression for the case-08 declared wall-colour delivery.
 *
 * Why this exists: the 21 Sep review's colour/material group is case-08/14.
 * case-14's stored study is refreshed by `refresh-reviewed-shape-study.ts`.
 * case-08 Rozengracht 251 declares an `upper-wall` `brick` material with no
 * colour, so the compiler emits no material patch and the workbench shows the
 * neutral render base. `wall-colour-corrections.json` declares the source-bound
 * colour and `refresh-reviewed-wall-colour.ts` applies it to the packet's
 * source-shape study only.
 *
 * This check pins, for the delivered packet:
 *   - the extraction still has no colour on the case-08 upper wall (the gap is
 *     preserved; a future extraction that supplies it must be noticed),
 *   - the declared correction matches the packet source,
 *   - the stored study is exactly a fresh compile of the declared correction,
 *   - the declared brick and cornice colours actually paint.
 *
 * Run: npx tsx scripts/review/check-reviewed-wall-colour-render.ts
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { compileSourceShapePreview } from './source-shape-preview.ts';
import { applySourceAssemblies } from './apply-source-assemblies.ts';
import corrections from './wall-colour-corrections.json' with { type: 'json' };

const CASES = 'public/data/facade-repair-preview/cases.json';
const spatial = JSON.parse(fs.readFileSync('scripts/review/spatial-source-corrections.json', 'utf8'));
const data = JSON.parse(fs.readFileSync(CASES, 'utf8'));

const caseById = (id: string) => {
  const entry = data.cases.find((item: any) => item.caseId === id);
  assert.ok(entry, `${id} missing from the review packet`);
  return entry;
};

const correctedFeatures = (features: any[], declared: any[]) => {
  const byId = new Map(declared.map((feature: any) => [feature.id, feature]));
  return features.map((feature: any) => {
    const override = byId.get(feature.id);
    return override ? { ...feature, colour: override.colour } : feature;
  });
};

for (const review of (corrections as any).cases) {
  const entry = caseById(review.caseId);
  const input = entry.shapeFeatures?.full;
  assert.ok(input, `${review.caseId} must carry full shape features`);
  assert.equal(input.cropSha256, review.source.sha256, `${review.caseId} declared source sha drifted`);
  assert.equal(input.captureDate, review.source.captureDate, `${review.caseId} declared source date drifted`);

  // The extraction gap must survive: the correction is a declared observation,
  // not a rewrite of the stored extraction material.
  const brick = input.features.find((feature: any) => feature.id === 'full:mat-brick');
  assert.ok(brick, 'case-08 must declare the whole-crop upper-wall brick material');
  assert.equal(brick.region, 'upper-wall', 'case-08 brick region changed');
  assert.equal(brick.material, 'brick', 'case-08 brick material changed');
  assert.equal(brick.colour, undefined, 'case-08 extraction is expected to still miss its wall colour');

  const correctedInput = { ...input, features: correctedFeatures(input.features, review.features) };
  const fresh = applySourceAssemblies(
    compileSourceShapePreview(correctedInput),
    correctedInput,
    spatial.cases?.[review.caseId]?.full?.entranceAssemblies,
  );
  assert.deepEqual(
    JSON.parse(JSON.stringify(entry.shapeStudy.full)),
    JSON.parse(JSON.stringify(fresh)),
    `${review.caseId} stored study is not a fresh compile of the declared correction`,
  );

  const materialPatches = (entry.shapeStudy.full.patches ?? []).filter((patch: any) => patch.featureKind === 'observed-material');
  const painted = new Set(materialPatches.map((patch: any) => patch.colour));
  for (const feature of review.features) {
    assert.ok(
      painted.has(feature.colour),
      `${review.caseId} declared ${feature.id} colour ${feature.colour} is not painted in the delivered study`,
    );
  }

  const marker = entry.wallColourReview;
  assert.ok(marker, `${review.caseId} must carry a wallColourReview marker`);
  assert.equal(marker.status, 'declared-source-colour', `${review.caseId} marker status changed`);
  assert.equal(marker.sourceSha256, review.source.sha256, `${review.caseId} marker source sha drifted`);
  assert.deepEqual(marker.featureIds, review.features.map((feature: any) => feature.id), 'marker feature ids changed');
  const markerColours: Record<string, string> = {};
  for (const feature of review.features) markerColours[feature.id] = feature.colour;
  assert.deepEqual(marker.colours, markerColours, 'marker colours changed');
}

// case-14 is delivered by the compiler guard and its own refresh; it must never
// acquire a declared colour correction.
assert.ok(
  !(corrections as any).cases.some((review: any) => review.caseId === 'case-14'),
  'case-14 must stay a compiler-guard delivery, not a declared colour correction',
);

const declared = (corrections as any).cases.map((review: any) => review.caseId).join('/');
console.log(`Reviewed wall-colour render regression passed: ${declared} paints its declared source colours while the extraction gap is preserved.`);
