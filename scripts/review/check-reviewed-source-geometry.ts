/**
 * Named regression for the 2026-09-21 case-05 full-tier entrance delivery.
 *
 * The 25-case review grouped case-05 Lauriergracht 67/69 as "missing-door"
 * ("no door"). Its stored full source-shape study painted all three ground
 * windows but no entrance, because the extraction never returned one for the
 * 2023 full crop. The clearer 2025 ground crop confirms a central recessed
 * entrance between the two ground-window banks; `source-geometry-corrections.json`
 * now declares that measured recess position and `refresh-reviewed-source-geometry.ts`
 * republished the study through the same `stageSourceGeometryPacket` path
 * `build-facade-preview.ts` uses.
 *
 * This pins that the delivered study is exactly a fresh, source-bound correction
 * compile from the packet's own stored features (so a rebuild would not lose
 * it), that the door patch is present with the declared colours, that no other
 * case or tier moved, and that the correction fails closed on a stale source.
 *
 * Run: npx tsx scripts/review/check-reviewed-source-geometry.ts
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { prepareSourceGeometryCorrection, stageSourceGeometryPacket } from './source-geometry-corrections.ts';
import reviewData from './source-geometry-corrections.json' with { type: 'json' };

const CASES = 'public/data/facade-repair-preview/cases.json';
const CASE_ID = 'case-05';

const packet = JSON.parse(fs.readFileSync(CASES, 'utf8'));
const review = (reviewData as any).cases.find((row: any) => row.caseId === CASE_ID);
assert.ok(review, `${CASE_ID} missing from source-geometry-corrections.json`);
assert.equal(review.tier, 'full', 'case-05 correction must target the full tier');

const entry = packet.cases.find((row: any) => row.caseId === CASE_ID);
assert.ok(entry, `${CASE_ID} missing from the review packet`);
const input = entry.shapeFeatures?.full;
const study = entry.shapeStudy?.full;
assert.ok(input && study, `${CASE_ID}/full must carry stored features and a study`);

// The correction is bound to the dated source it was inspected from.
assert.equal(input.cropSha256, review.source.sha256, 'case-05 full crop is not the reviewed source');
assert.equal(input.captureDate, review.source.captureDate, 'case-05 full capture date drifted');
assert.equal(input.width, review.source.width, 'case-05 full crop width drifted');
assert.equal(input.height, review.source.height, 'case-05 full crop height drifted');

const addedIds = (review.add ?? []).map((feature: any) => feature.id);
assert.ok(addedIds.length > 0, 'case-05 correction declares no added feature');
assert.deepEqual(addedIds, ['full:review:entrance-door'], 'case-05 added feature changed');
for (const id of addedIds) assert.ok(input.features.some((feature: any) => feature.id === id), `case-05 lost ${id}`);

// The delivered door is the declared source-bound feature, painted with the
// declared leaf and frame colours, and the ground count moved from 0 to 1.
const doorPatches = (study.patches ?? []).filter(
  (patch: any) => patch.featureKind === 'observed-door' && patch.featureId.includes('full:review:entrance-door'),
);
assert.ok(doorPatches.length > 0, 'case-05 has no delivered entrance-door patch');
assert.ok(doorPatches.some((patch: any) => patch.colour === '#38271f'), 'case-05 door leaf colour changed');
assert.ok(doorPatches.some((patch: any) => patch.colour === '#312d29'), 'case-05 door frame colour changed');
assert.equal(study.counts?.door, 1, 'case-05 full study must report exactly one door');
assert.equal(study.counts?.window, 15, 'case-05 window count must be unchanged');

// A rebuild must reproduce the delivered study exactly from the packet's own
// features (strip the reviewed additions, re-apply the correction).
const stripped = {
  ...input,
  features: input.features.filter((feature: any) => !addedIds.includes(feature.id)),
};
const synthetic = {
  previewOnly: true,
  cases: [{ caseId: CASE_ID, shapeFeatures: { full: stripped }, shapeStudy: { full: study } }],
};
const staged = stageSourceGeometryPacket(synthetic as any, [review]);
assert.deepEqual(staged.cases[0].shapeFeatures.full, input, 'case-05 features are out of sync; re-run refresh-reviewed-source-geometry.ts');
assert.deepEqual(staged.cases[0].shapeStudy.full, study, 'case-05 study is out of sync; re-run refresh-reviewed-source-geometry.ts');

// Applying the correction to the whole packet must leave every other case and
// the ground tier byte-identical.
const stagedAll = stageSourceGeometryPacket(packet, [review]);
for (const record of packet.cases) {
  if (record.caseId === CASE_ID) continue;
  assert.deepEqual(record, stagedAll.cases.find((row: any) => row.caseId === record.caseId), `unrelated case changed: ${record.caseId}`);
}
assert.deepEqual(
  stagedAll.cases.find((row: any) => row.caseId === CASE_ID).shapeFeatures.ground,
  entry.shapeFeatures.ground,
  'case-05 ground tier changed',
);

// Fail closed when the correction is applied to a different source.
assert.throws(
  () => prepareSourceGeometryCorrection(CASE_ID, 'full', { ...input, cropSha256: '0'.repeat(64) }, (reviewData as any).cases),
  /Stale source geometry correction/,
  'case-05 correction must reject a stale source',
);

console.log('case-05 Lauriergracht 67/69 full-tier entrance door is delivered and reproduces.');
