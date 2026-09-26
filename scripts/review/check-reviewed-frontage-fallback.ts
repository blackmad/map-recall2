/**
 * Named regression for the 2026-09-21 case-09 registered-frontage delivery.
 *
 * The 25-case review flagged case-09 Rozengracht 228 as "missing door". Rendering
 * showed something worse: the metric candidate was a completely blank monolith.
 * The release bound no wall surface, and every 3DBAG wall at the frontage is a
 * sliver, skewed or non-planar, so `facadeWallFrame` had nothing to draw on and
 * the preview abstained (`No usable published facade surface`). The registered
 * observation frontage is exactly coplanar with the crop plane, so it is the
 * only defensible drawing plane.
 *
 * `registeredFrontageWallSurface` + `buildCaseCandidate` now build a synthetic
 * rectangle along that registered frontage when no surface supplies a usable
 * frame, and `refresh-reviewed-frontage.ts` republished only case-09's candidate
 * (packet `297054a…` -> `4d57571…`).
 *
 * The same fallback now also covers case-30 Rozengracht 212, the owner's
 * explicit framing ask ("registration slightly off; we could have inferred the
 * right fit"). Its 4.43 m frontage is fragmented into skewed pieces whose only
 * overlap-passing surface (#4) is 0.71 m off the crop plane, so the compiler
 * abstained and the candidate was a blank monolith. The registered frontage is
 * exactly coplanar with the crop plane (0.0000 m), so when every usable declared
 * frame is non-coplanar (> the compiler's own 0.18 m guard) the builder draws on
 * the registered frontage instead. `refresh-reviewed-frontage.ts` republished
 * only case-30 (packet `4d57571…` -> `dd1fd2e…`).
 *
 * This pins both delivered candidates, that a rebuild reproduces them, and the
 * threshold boundary: case-23 (declared frame short of the frontage by 1.38 m,
 * below the coverage gap threshold) keeps its declared surface, so the fallback
 * does not silently replace a coplanar declared frame that still spans the
 * frontage. (case-19, formerly the boundary case, is now recovered by the
 * coverage-gap rule - see `check-reviewed-frontage-coverage.ts`.)
 *
 * Run: npx tsx scripts/review/check-reviewed-frontage-fallback.ts
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import { facadeWallFrame } from '../../src/canalRecall/cityAppearanceFacadeRecipes.ts';
import { buildCaseCandidate } from './case-candidate.ts';

const CASES = 'public/data/facade-repair-preview/cases.json';
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

// --- 1. case-09 renders instead of abstaining -----------------------------
{
  const entry = caseById('case-09');
  assert.ok((entry.patches ?? []).length > 0, 'case-09 must compile observed patches, not a blank monolith');
  assert.equal(entry.counts.door, 1, 'case-09 must recover its missing door');
  assert.equal(entry.counts.window, 11, 'case-09 window count changed');
  assert.equal(entry.counts.material, 2, 'case-09 material count changed');
  assert.ok(!(entry.omissions ?? []).includes('No usable published facade surface'), 'case-09 must no longer abstain');
  assert.match(entry.status, /2\/2 image tiers analyzed/, 'case-09 must analyze both tiers');
}

// --- 2. case-09 draws on the registered frontage --------------------------
{
  const { original } = ownerFor('case-09');
  const entry = caseById('case-09');
  const frame = entry.frame;
  assert.ok(frame, 'case-09 must carry a render frame');
  const frontage = Math.hypot(original.localEnd[0] - original.localStart[0], original.localEnd[1] - original.localStart[1]);
  near(frame.width, frontage, 0.01, 'case-09 frame width');
  near(frame.a[0], original.localStart[0], 0.01, 'case-09 frame start x');
  near(frame.a[1], original.localStart[1], 0.01, 'case-09 frame start z');
  const ux = (original.localEnd[0] - original.localStart[0]) / frontage, uz = (original.localEnd[1] - original.localStart[1]) / frontage;
  near(frame.u[0], ux, 0.01, 'case-09 frame direction x');
  near(frame.u[1], uz, 0.01, 'case-09 frame direction z');
}

// --- 3. The registered frontage is coplanar with the crop plane while no
//        published wall surface is, which is why the fallback is needed. ---
{
  const { owner, original } = ownerFor('case-09');
  const origin = owner.geometry.frame.originRD;
  const local = (p: any) => [p.x - origin.x, origin.y - p.y];
  const s = original.localStart, e = original.localEnd;
  const frontage = Math.hypot(e[0] - s[0], e[1] - s[1]);
  const ux = (e[0] - s[0]) / frontage, uz = (e[1] - s[1]) / frontage;
  const offFrontage = (p: number[]) => Math.abs((p[0] - s[0]) * uz - (p[1] - s[1]) * ux);
  for (const tier of ['full', 'ground']) {
    const plane = original.images[tier].plane;
    const left = local(plane.start), right = local(plane.end);
    assert.ok(Math.max(offFrontage(left), offFrontage(right)) < 0.01, `case-09 ${tier} plane must be coplanar with the registered frontage`);
  }
  const usable = owner.geometry.building.surfaces
    .map((surface: any, index: number) => ({ surface, index }))
    .filter(({ surface }: any) => surface.type === 'wall')
    .filter(({ surface }: any) => facadeWallFrame(surface, owner, [owner]));
  assert.ok(usable.length > 0, 'case-09 has some usable surfaces, just none that cover the frontage');
  // The declared surface is a sliver, so the declared indices give no frame.
  const declared = original.renderSurfaceIndices?.length ? original.renderSurfaceIndices : (regressionFor('case-09').binding.surfaceIndices ?? []);
  for (const index of declared) {
    assert.equal(facadeWallFrame(owner.geometry.building.surfaces[index], owner, [owner]), null, `case-09 declared surface #${index} must be unusable`);
  }
  // No surface is both coplanar with the frontage and overlapping it.
  const matches = owner.geometry.building.surfaces.flatMap((surface: any, index: number) => {
    if (surface.type !== 'wall') return [];
    const points = surface.rings[0];
    const dist = points.map((p: number[]) => Math.abs((p[0] - s[0]) * uz - (p[2] - s[1]) * ux));
    const along = points.map((p: number[]) => (p[0] - s[0]) * ux + (p[2] - s[1]) * uz);
    const overlap = Math.min(frontage, Math.max(...along)) - Math.max(0, Math.min(...along));
    return Math.max(...dist) < 0.8 && overlap > Math.min(2, frontage * 0.5) ? [index] : [];
  });
  assert.deepEqual(matches, [], 'case-09 must have no wall surface covering the registered frontage');
}

// --- 4. The stored candidates are exactly fresh shared-builder compiles ----
{
  const cache = JSON.parse(fs.readFileSync('.cache/city-appearance/fidelity-extraction/analysis-results.json', 'utf8'));
  const index = JSON.parse(fs.readFileSync('.cache/city-appearance/fidelity-extraction/development-analysis-index.json', 'utf8'));
  const manifest = fs.readFileSync('scripts/review/facade-regression-analysis-manifest.json');
  assert.equal(index.manifestSha256, crypto.createHash('sha256').update(manifest).digest('hex'), 'stale analysis manifest');
  const keys = new Set(index.cases.map((row: any) => row.key));
  const complete = cache.results.filter((row: any) => keys.has(row.key) && row.status === 'complete' && row.proposal);
  for (const caseId of ['case-09', 'case-30']) {
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
      floorRows: JSON.parse(fs.readFileSync('scripts/review/floor-row-corrections.json', 'utf8')),
    });
    const entry = caseById(caseId);
    assert.equal(JSON.stringify(entry.candidateObservations), JSON.stringify(fresh.candidateObservations), `${caseId} candidate out of sync; re-run scripts/review/refresh-reviewed-frontage.ts --case=${caseId}`);
    assert.equal(JSON.stringify(entry.patches), JSON.stringify(fresh.patches), `${caseId} patches out of sync`);
    assert.equal(JSON.stringify(entry.frame), JSON.stringify(fresh.frame), `${caseId} frame out of sync`);
    assert.equal(JSON.stringify(entry.omissions), JSON.stringify(fresh.omissions), `${caseId} omissions out of sync`);
  }
}

// --- 5. case-30 recovers on its registered frontage instead of abstaining --
{
  const entry = caseById('case-30');
  assert.ok(entry.patches.length > 0, 'case-30 must compile observed patches, not a blank monolith');
  assert.deepEqual(entry.counts, { door: 5, window: 8, awning: 0, material: 3 }, 'case-30 recovered counts changed');
  assert.ok(!(entry.omissions ?? []).some((value: string) => /noncoplanar source abstained/.test(value)), 'case-30 must no longer abstain as non-coplanar');
  assert.match(entry.status, /2\/2 image tiers analyzed/, 'case-30 must analyze both tiers');
  const { original } = ownerFor('case-30');
  const frontage = Math.hypot(original.localEnd[0] - original.localStart[0], original.localEnd[1] - original.localStart[1]);
  near(frontage, 4.43, 0.02, 'case-30 registered frontage');
  near(entry.frame.width, frontage, 0.01, 'case-30 frame width');
  near(entry.frame.a[0], original.localStart[0], 0.01, 'case-30 frame start x');
  near(entry.frame.a[1], original.localStart[1], 0.01, 'case-30 frame start z');
  // The registered frontage is coplanar with the crop plane even though the
  // only overlap-passing declared surface (#4) is not.
  const origin = ownerFor('case-30').owner.geometry.frame.originRD;
  const local = (p: any) => [p.x - origin.x, origin.y - p.y];
  const s = original.localStart, e = original.localEnd;
  const ux = (e[0] - s[0]) / frontage, uz = (e[1] - s[1]) / frontage;
  const offFrontage = (p: number[]) => Math.abs((p[0] - s[0]) * uz - (p[1] - s[1]) * ux);
  for (const tier of ['full', 'ground']) {
    const plane = original.images[tier].plane;
    assert.ok(Math.max(offFrontage(local(plane.start)), offFrontage(local(plane.end))) < 0.01, `case-30 ${tier} plane must be coplanar with the registered frontage`);
  }
  const four = ownerFor('case-30').owner.geometry.building.surfaces[4];
  const frameFour = facadeWallFrame(four, ownerFor('case-30').owner, [ownerFor('case-30').owner]);
  assert.ok(frameFour, 'case-30 declared surface #4 must stay usable');
  const offFour = (p: number[]) => Math.abs((p[0] - frameFour!.a[0]) * frameFour!.u[1] - (p[1] - frameFour!.a[1]) * frameFour!.u[0]);
  const plane = original.images.full.plane;
  assert.ok(
    Math.max(offFour(local(plane.start)), offFour(local(plane.end))) > 0.18,
    'case-30 declared surface #4 must stay non-coplanar (the reason the fallback fires)',
  );
}

// --- 6. The fallback stays off for a declared frame inside the coverage guard --
{
  const entry = caseById('case-23');
  const { original } = ownerFor('case-23');
  const frontage = Math.hypot(original.localEnd[0] - original.localStart[0], original.localEnd[1] - original.localStart[1]);
  assert.ok(entry.frame.width < frontage - 1, 'case-23 must keep its declared surface frame, not the registered frontage');
  assert.ok(Math.abs(entry.frame.a[0] - original.localStart[0]) > 0.5, 'case-23 frame must not sit on the registered frontage start');
}

console.log('Reviewed frontage fallback passed: case-09 and case-30 draw on their registered frontages (door recovered, blank monolith recovered) and are reproducible; a declared frame below the coverage-gap threshold (case-23) still wins.');
