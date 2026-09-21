/**
 * Named regression for the 2026-09-21 registered-frontage coverage gap delivery.
 *
 * The 25-case review flagged case-02 De Clercqstraat 20/22 as "missing business
 * window". Rendering showed the metric candidate drew only the left half of the
 * building: the release bound a single 3DBAG wall surface 5.10 m long while the
 * registered frontage is 8.09 m. The crop plane spans the registered frontage, so
 * the door and the right window column fell off the frame and were clipped. The
 * same pattern (a coplanar declared frame that does not span the frontage) hit
 * case-13, case-19, case-22 and case-29.
 *
 * `buildCaseCandidate` already draws on the registered frontage when no declared
 * frame is usable. It now also measures the union coverage of the declared
 * frames along the crop-plane axis and uses the registered frontage when the
 * uncovered gap exceeds a material threshold (max(1.5 m, 15% of the frontage)).
 * Below that threshold a coplanar declared frame still owns the frontage, so
 * crop-margin rounding does not switch planes.
 *
 * This pins: the exact coverage gaps and switch set, that the five recovered
 * candidates are fresh shared-builder compiles, that their frames span the
 * registered frontage, and that the sub-threshold cases stay on their declared
 * surfaces.
 *
 * Run: npx tsx scripts/review/check-reviewed-frontage-coverage.ts
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import { facadeWallFrame } from '../../src/canalRecall/cityAppearanceFacadeRecipes.ts';
import { buildCaseCandidate } from './case-candidate.ts';

const CASES = 'public/data/facade-repair-preview/cases.json';
const OUT = 'review-data/case-frontage-coverage.json';
const packetBytes = fs.readFileSync(CASES);
const packet = JSON.parse(packetBytes.toString('utf8'));
const caseById = (id: string) => {
  const entry = packet.cases.find((row: any) => row.caseId === id);
  assert.ok(entry, `${id} missing from the review packet`);
  return entry;
};
const regressions = JSON.parse(fs.readFileSync('scripts/review/facade-regressions.json', 'utf8'));
const regressionFor = (id: string) => {
  const entry = regressions.cases.find((row: any) => row.caseId === id);
  assert.ok(entry, `${id} missing from facade-regressions.json`);
  return entry;
};
const ownerFor = (id: string) => {
  const c = regressionFor(id);
  const tile = JSON.parse(gunzipSync(fs.readFileSync(c.binding.tile.path)).toString());
  const owner = tile.owners.find((row: any) => row.id === c.binding.buildingId);
  const original = owner.observations.find((row: any) => row.id === c.binding.observationId).payload;
  return { c, owner, original };
};
const near = (actual: number, expected: number, tolerance: number, label: string) =>
  assert.ok(Math.abs(actual - expected) <= tolerance, `${label}: expected ${expected} +/- ${tolerance}, got ${actual}`);

/** Mirror of the builder's declared-frontage coverage measurement. */
function coverage(owner: any, original: any, bindingSurfaceIndices: number[] | undefined) {
  const declaredIndices: number[] = original.renderSurfaceIndices?.length ? original.renderSurfaceIndices : (bindingSurfaceIndices ?? []);
  const offset = ((frame: any) => {
    let max = 0;
    const origin = owner.geometry.frame.originRD;
    for (const tier of ['full', 'ground']) {
      const plane = original.images?.[tier]?.plane;
      if (!plane) continue;
      for (const point of [plane.start, plane.end]) {
        const local = [point.x - origin.x, origin.y - point.y];
        max = Math.max(max, Math.abs((local[0] - frame.a[0]) * frame.u[1] - (local[1] - frame.a[1]) * frame.u[0]));
      }
    }
    return max;
  });
  const targets = declaredIndices.flatMap((index: number) => {
    const surface = owner.geometry.building.surfaces[index];
    if (!surface) return [];
    const frame = facadeWallFrame(surface, owner, [owner]);
    return frame ? [{ index, frame, off: offset(frame) }] : [];
  });
  const plane = original.images?.full?.plane ?? original.images?.ground?.plane;
  let length = 0;
  let gap = Infinity;
  if (plane && targets.length) {
    const origin = owner.geometry.frame.originRD;
    const start = [plane.start.x - origin.x, origin.y - plane.start.y];
    const end = [plane.end.x - origin.x, origin.y - plane.end.y];
    const dx = end[0] - start[0], dz = end[1] - start[1];
    length = Math.hypot(dx, dz);
    if (length > 0) {
      const ux = dx / length, uz = dz / length;
      const project = (point: number[]) => (point[0] - start[0]) * ux + (point[1] - start[1]) * uz;
      const intervals = targets.map((target: any) => {
        const a = project(target.frame.a);
        const b = project([target.frame.a[0] + target.frame.u[0] * target.frame.width, target.frame.a[1] + target.frame.u[1] * target.frame.width]);
        return [Math.min(a, b), Math.max(a, b)] as [number, number];
      }).sort((left: number[], right: number[]) => left[0] - right[0]);
      let covered = 0, cursor = 0;
      for (const [a, b] of intervals) {
        const lo = Math.max(a, cursor), hi = Math.min(b, length);
        if (hi > lo) covered += hi - lo;
        cursor = Math.max(cursor, b);
      }
      gap = Math.max(0, length - covered);
    }
  }
  return { declaredIndices, targets, length, gap, threshold: Math.max(1.5, 0.15 * length), minOffset: targets.length ? Math.min(...targets.map((target: any) => target.off)) : Infinity };
}

// Measured 2026-09-21: the five cases whose declared surfaces leave a material
// gap and now draw on the registered frontage. case-09/case-30 already switched
// under the earlier non-coplanar rule.
const SWITCHED: Record<string, number> = { 'case-02': 3.31, 'case-13': 2.94, 'case-19': 2.21, 'case-22': 4.00, 'case-29': 2.04 };
const ALREADY = ['case-09', 'case-30'];
// Sub-threshold cases: a real but small gap keeps the declared surface frame.
const KEEP_DECLARED: Record<string, number> = { 'case-05': 0.93, 'case-15': 1.75, 'case-23': 2.23, 'case-27': 2.38 };

for (const id of Object.keys(SWITCHED)) {
  const { owner, original } = ownerFor(id);
  const measured = coverage(owner, original, regressionFor(id).binding?.surfaceIndices);
  near(measured.gap, SWITCHED[id], 0.03, `${id} coverage gap`);
  assert.ok(measured.gap > measured.threshold, `${id} must exceed its coverage threshold and switch`);
  const frontage = Math.hypot(original.localEnd[0] - original.localStart[0], original.localEnd[1] - original.localStart[1]);
  const entry = caseById(id);
  assert.ok(entry.frame, `${id} must carry a render frame`);
  near(entry.frame.width, frontage, 0.02, `${id} frame must span the registered frontage`);
  // `wallAxis` may orient the synthetic ring either way, so accept either end.
  const frameEnd = [entry.frame.a[0] + entry.frame.u[0] * entry.frame.width, entry.frame.a[1] + entry.frame.u[1] * entry.frame.width];
  const forward = Math.abs(entry.frame.a[0] - original.localStart[0]) < 0.02 && Math.abs(entry.frame.a[1] - original.localStart[1]) < 0.02
    && Math.abs(frameEnd[0] - original.localEnd[0]) < 0.02 && Math.abs(frameEnd[1] - original.localEnd[1]) < 0.02;
  const reverse = Math.abs(entry.frame.a[0] - original.localEnd[0]) < 0.02 && Math.abs(entry.frame.a[1] - original.localEnd[1]) < 0.02
    && Math.abs(frameEnd[0] - original.localStart[0]) < 0.02 && Math.abs(frameEnd[1] - original.localStart[1]) < 0.02;
  assert.ok(forward || reverse, `${id} frame must run along the registered frontage line`);
  assert.ok((entry.patches ?? []).length > 0, `${id} must compile observed patches`);
  assert.ok(!(entry.omissions ?? []).includes('No usable published facade surface'), `${id} must not abstain`);
}

for (const id of ALREADY) {
  const entry = caseById(id);
  assert.ok(entry.frame, `${id} must carry a render frame`);
}

// Sub-threshold cases keep their declared surface: the frame is shorter than the
// registered frontage and does not start on the frontage line.
for (const id of Object.keys(KEEP_DECLARED)) {
  const { owner, original } = ownerFor(id);
  const measured = coverage(owner, original, regressionFor(id).binding?.surfaceIndices);
  near(measured.gap, KEEP_DECLARED[id], 0.03, `${id} coverage gap`);
  assert.ok(measured.gap <= measured.threshold, `${id} must stay below its coverage threshold`);
  const frontage = Math.hypot(original.localEnd[0] - original.localStart[0], original.localEnd[1] - original.localStart[1]);
  const entry = caseById(id);
  assert.ok(entry.frame.width < frontage - 0.5, `${id} must keep its declared surface frame`);
}

// case-02, the owner's flagged "missing business window" case, recovers the
// right window column and the entrance instead of clipping them.
{
  const entry = caseById('case-02');
  assert.deepEqual(entry.counts, { door: 1, window: 7, awning: 1, material: 3 }, 'case-02 recovered counts changed');
  const kinds = new Set((entry.patches ?? []).map((patch: any) => patch.featureKind));
  assert.ok(kinds.has('observed-door'), 'case-02 must recover its storefront entrance');
  const reviewIds = (entry.patches ?? []).filter((patch: any) => patch.featureId.includes('ground:door-01'));
  assert.ok(reviewIds.length > 0, 'case-02 must draw its registered ground door');
}

// The stored candidates are exactly fresh shared-builder compiles, so the
// delivery is durable across a targeted refresh rather than a one-off edit.
{
  const cache = JSON.parse(fs.readFileSync('.cache/city-appearance/fidelity-extraction/analysis-results.json', 'utf8'));
  const index = JSON.parse(fs.readFileSync('.cache/city-appearance/fidelity-extraction/development-analysis-index.json', 'utf8'));
  const manifest = fs.readFileSync('scripts/review/facade-regression-analysis-manifest.json');
  assert.equal(index.manifestSha256, crypto.createHash('sha256').update(manifest).digest('hex'), 'stale analysis manifest');
  const keys = new Set(index.cases.map((row: any) => row.key));
  const complete = cache.results.filter((row: any) => keys.has(row.key) && row.status === 'complete' && row.proposal);
  for (const caseId of Object.keys(SWITCHED)) {
    const { c, owner, original } = ownerFor(caseId);
    const fresh = buildCaseCandidate({
      caseId,
      owner,
      original,
      bindingSurfaceIndices: c.binding?.surfaceIndices,
      complete,
      references: JSON.parse(fs.readFileSync('scripts/review/window-shape-reference.json', 'utf8')),
      corrections: JSON.parse(fs.readFileSync('scripts/review/development-photo-corrections.json', 'utf8')),
      spatial: JSON.parse(fs.readFileSync('scripts/review/spatial-source-corrections.json', 'utf8')),
      signReferences: JSON.parse(fs.readFileSync('scripts/review/roof-sign-corrections.json', 'utf8')),
      retailReview: JSON.parse(fs.readFileSync('scripts/review/retail-priority-source-review.json', 'utf8')),
    });
    const entry = caseById(caseId);
    assert.equal(JSON.stringify(entry.candidateObservations), JSON.stringify(fresh.candidateObservations), `${caseId} candidate out of sync; re-run scripts/review/refresh-reviewed-frontage.ts --case=${caseId}`);
    assert.equal(JSON.stringify(entry.patches), JSON.stringify(fresh.patches), `${caseId} patches out of sync`);
    assert.equal(JSON.stringify(entry.frame), JSON.stringify(fresh.frame), `${caseId} frame out of sync`);
    assert.equal(JSON.stringify(entry.omissions), JSON.stringify(fresh.omissions), `${caseId} omissions out of sync`);
  }
}

fs.writeFileSync(
  OUT,
  JSON.stringify(
    {
      version: 1,
      kind: 'case-frontage-coverage',
      generatedAt: new Date().toISOString(),
      packet: { path: CASES, sha256: crypto.createHash('sha256').update(packetBytes).digest('hex') },
      threshold: 'max(1.5 m, 15% of the crop-plane length)',
      switched: Object.fromEntries(Object.entries(SWITCHED).map(([id, gap]) => [id, { gapM: gap }])),
      alreadySwitched: ALREADY,
      keptDeclared: Object.fromEntries(Object.entries(KEEP_DECLARED).map(([id, gap]) => [id, { gapM: gap }])),
    },
    null,
    2,
  ) + '\n',
);

console.log(
  `Reviewed frontage coverage passed: ${Object.keys(SWITCHED).length} material-gap candidates draw on their registered frontages ` +
    `(case-02 recovers its entrance and right window column); ${Object.keys(KEEP_DECLARED).length} sub-threshold cases keep their declared surfaces.`,
);
