/**
 * Named regression for the reviewed opening-frame clearance on case-05.
 *
 * Why this exists: the 25-case review's case-05 Lauriergracht 67/69 was filed
 * "roof too high into the sky, windows opverlapping too much, no door". The
 * overlap is real and measured: the extraction places the narrow window b3 and
 * the wide bay b4 1.9 px apart, and the default .14 m frame border makes each
 * frame cross the other, so the pair reads as one blob in the source-shape
 * study (the repair-preview's default view). `frameClearancePx` is an opt-in,
 * per-feature reviewed clearance; the compiler caps the frame to it (and never
 * past the nearest same-row opening). `opening-frame-corrections.json` declares
 * the measured 1.9 px on b3/b4 for rows 1-3, and
 * `refresh-reviewed-opening-frames.ts` republished only case-05's stored
 * `shapeFeatures.full` and `shapeStudy.full`.
 *
 * Run: npx tsx scripts/review/check-reviewed-opening-frames.ts
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { compileSourceShapePreview } from './source-shape-preview.ts';
import { applyOpeningFrameCorrections } from '../../src/canalRecall/facade/openingFrameCorrections.ts';
import corrections from './opening-frame-corrections.json' with { type: 'json' };

const packet = JSON.parse(fs.readFileSync('public/data/facade-repair-preview/cases.json', 'utf8'));
const entry = packet.cases.find((item: any) => item.caseId === 'case-05');
assert.ok(entry, 'case-05 missing from the review packet');

const correction = (corrections as any).cases['case-05'].full;
const declaredIds = correction.clearances.map((row: any) => row.featureId);
assert.deepEqual(
  [...declaredIds].sort(),
  ['full:window-r1-b3', 'full:window-r1-b4', 'full:window-r2-b3', 'full:window-r2-b4', 'full:window-r3-b3', 'full:window-r3-b4'],
  'the declared case-05 clearances changed',
);
assert.ok(correction.clearances.every((row: any) => row.clearancePx === 1.9), 'the measured 1.9 px gap changed');

// 1. The delivered packet stores the corrected features and a study that a
// fresh compile reproduces exactly.
const input = entry.shapeFeatures.full;
const carried = input.features.filter((feature: any) => feature.frameClearancePx !== undefined).map((feature: any) => feature.id).sort();
assert.deepEqual(carried, [...declaredIds].sort(), 'the stored full features do not carry exactly the declared clearances');
const fresh = compileSourceShapePreview({ width: input.width, height: input.height, cropSha256: input.cropSha256, captureDate: input.captureDate, features: input.features });
assert.deepEqual(fresh.patches, entry.shapeStudy.full.patches, 'a fresh corrected compile must reproduce the delivered study');

// 2. The correction is opt-in: only case-05 declares the field anywhere.
for (const item of packet.cases) {
  for (const tier of ['full', 'ground']) {
    for (const feature of item.shapeFeatures?.[tier]?.features ?? []) {
      if (feature.frameClearancePx === undefined) continue;
      assert.equal(item.caseId, 'case-05', `unexpected frameClearancePx on ${item.caseId}/${tier}/${feature.id}`);
      assert.equal(tier, 'full', `unexpected frameClearancePx on ${item.caseId}/${tier}/${feature.id}`);
    }
  }
}

// 3. In the delivered study the narrow window's frame no longer crosses the bay.
const frame = entry.shapeStudy.full.frame;
const along = (point: [number, number, number]) => (point[0] - frame.a[0]) * frame.u[0] + (point[2] - frame.a[1]) * frame.u[1];
const extent = (featureId: string) => {
  const points = entry.shapeStudy.full.patches.filter((patch: any) => patch.featureId.endsWith(featureId))
    .flatMap((patch: any) => { const out: number[] = []; for (let i = 0; i < patch.triangles.length; i += 3) out.push(along([patch.triangles[i], patch.triangles[i + 1], patch.triangles[i + 2]])); return out; });
  assert.ok(points.length, `${featureId} emitted no study patches`);
  return [Math.min(...points), Math.max(...points)] as [number, number];
};
for (const row of [1, 2, 3]) {
  const b3 = extent(`full:window-r${row}-b3`), b4 = extent(`full:window-r${row}-b4`);
  assert.ok(b3[1] <= b4[0] + 1e-9 || b4[1] <= b3[0] + 1e-9, `row ${row}: capped frames still overlap (${b3} vs ${b4})`);
}

// 4. Removing the declaration restores the default border, proving the field is
// what drives the cap (a fresh default study overlaps the same pair).
const plain = compileSourceShapePreview({
  width: input.width, height: input.height, cropSha256: input.cropSha256, captureDate: input.captureDate,
  features: input.features.map(({ frameClearancePx, ...feature }: any) => feature),
});
const plainExtent = (featureId: string) => {
  const points = plain.patches.filter((patch: any) => patch.featureId.endsWith(featureId))
    .flatMap((patch: any) => { const out: number[] = []; for (let i = 0; i < patch.triangles.length; i += 3) out.push(along([patch.triangles[i], patch.triangles[i + 1], patch.triangles[i + 2]])); return out; });
  return [Math.min(...points), Math.max(...points)] as [number, number];
};
const p3 = plainExtent('full:window-r1-b3'), p4 = plainExtent('full:window-r1-b4');
assert.ok(!(p3[1] <= p4[0] + 1e-9 || p4[1] <= p3[0] + 1e-9), 'the undeclared default study must still overlap row 1');

// 5. The metric candidate is deliberately untouched: it carries no clearance and
// its frames are the uncorrected default, so the game-facing residual is visible.
for (const feature of entry.candidateObservations?.[0]?.facadeDescription?.sources?.full?.features ?? [])
  assert.equal(feature.frameClearancePx, undefined, 'the metric candidate must not carry a study clearance');

// 6. The applier fails closed on a stale source.
const stub = declaredIds.map((id: string) => ({ id, bounds: [0, 0, 10, 10], kind: 'window', disposition: 'machine-observed-unreviewed' })) as any;
const applied = applyOpeningFrameCorrections(correction, { features: stub, cropSha256: input.cropSha256, captureDate: input.captureDate });
assert.ok(applied.every((feature: any) => feature.frameClearancePx === 1.9), 'the applier must set the declared clearance');
assert.throws(() => applyOpeningFrameCorrections(correction, { features: [], cropSha256: 'f'.repeat(64), captureDate: input.captureDate }), /Stale opening-frame correction/);

console.log('Reviewed opening-frame regression passed: case-05 carries the measured 1.9 px clearance on b3/b4, the delivered study is non-overlapping and reproducible, the field is opt-in, and the metric candidate is untouched.');
