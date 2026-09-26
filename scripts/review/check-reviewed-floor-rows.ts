/**
 * Named regression for the 2026-09-21 case-12 inferred upper-floor row.
 *
 * The 25-case review flagged case-12 (with case-13/16/17) as "missing inferred
 * first floor". Re-reading the crops showed only case-12 is a real whole-row
 * miss: the extractor reported `openingsComplete: true` for Rozengracht 160
 * while returning one of the two clear upper window rows below the gable
 * (`full:window-2/3/4`, glass y164-230), so the second row (y279-343) rendered
 * as blank masonry. A generic gap-based inference rule was measured and
 * rejected: a same-size gap appears on case-08 (accepted by the owner) and
 * case-11 (a delivered storefront case), so the row is reconciled per case from
 * the observed rhythm.
 *
 * The row is declared in `scripts/review/floor-row-corrections.json` and applied
 * by `applyFloorRowCorrections`, which fails closed unless the anchor-to-ground
 * gap is larger than one storey and the measured row sits between the anchor row
 * and the ground band. `refresh-reviewed-floor-rows.ts` republished only case-12
 * (packet `924bece7…` -> `cf5b0da4…`).
 *
 * This pins the delivered row, that a fresh shared-builder compile reproduces it,
 * that the module rejects stale/overreaching corrections, and that no other
 * reviewed case gained an inferred row.
 *
 * Run: npx tsx scripts/review/check-reviewed-floor-rows.ts
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import { applyFloorRowCorrections } from '../../src/canalRecall/facade/floorRowCorrections.ts';
import { buildCaseCandidate } from './case-candidate.ts';

const CASES = 'public/data/facade-repair-preview/cases.json';
const packetBytes = fs.readFileSync(CASES);
const packet = JSON.parse(packetBytes.toString('utf8'));
const caseById = (id: string) => {
  const entry = packet.cases.find((row: any) => row.caseId === id);
  assert.ok(entry, `${id} missing from the review packet`);
  return entry;
};
const floorRows = JSON.parse(fs.readFileSync('scripts/review/floor-row-corrections.json', 'utf8'));
const regressions = JSON.parse(fs.readFileSync('scripts/review/facade-regressions.json', 'utf8'));
const ownerFor = (id: string) => {
  const c = regressions.cases.find((row: any) => row.caseId === id);
  assert.ok(c, `${id} missing from facade-regressions.json`);
  const tile = JSON.parse(gunzipSync(fs.readFileSync(c.binding.tile.path)).toString());
  const owner = tile.owners.find((row: any) => row.id === c.binding.buildingId);
  const original = owner.observations.find((row: any) => row.id === c.binding.observationId).payload;
  return { c, owner, original };
};
const INFERRED_IDS = ['full:inferred:row-1:bay-1', 'full:inferred:row-1:bay-2', 'full:inferred:row-1:bay-3'];

// --- 1. The declared correction is the measured one -----------------------
{
  const correction = floorRows.cases?.['case-12']?.full;
  assert.ok(correction, 'case-12/full floor-row correction missing');
  assert.equal(correction.source.cropSha256, '2a78e9b4fdb0d8fda52198952942c456722872a43abdf165b06204bdbed6e660', 'case-12 correction crop binding changed');
  assert.deepEqual(correction.anchorRowIds, ['full:window-2', 'full:window-3', 'full:window-4'], 'case-12 anchor row changed');
  assert.equal(correction.pitchPx, 80, 'case-12 observed pitch changed');
  assert.equal(correction.groundBandTopPx, 385.065, 'case-12 ground-band top changed');
  assert.deepEqual(correction.inferred.map((row: any) => row.bounds), [[48, 279, 96, 343], [132, 279, 180, 343], [215, 279, 262, 343]], 'case-12 inferred bounds changed');
}

// --- 2. The delivered packet carries the reconciled row -------------------
{
  const entry = caseById('case-12');
  const features = entry.shapeFeatures.full.features.filter((feature: any) => INFERRED_IDS.includes(feature.id));
  assert.equal(features.length, 3, 'case-12 must carry three inferred row features');
  for (const feature of features) {
    assert.equal(feature.kind, 'window', `${feature.id} must be a window`);
    assert.equal(feature.disposition, 'agent-inspected', `${feature.id} disposition changed`);
    assert.equal(feature.inference, 'observed-row-rhythm', `${feature.id} provenance changed`);
    assert.equal(feature.head, 'rectangular', `${feature.id} head changed`);
  }
  assert.equal(entry.shapeStudy.full.counts.window, 9, 'case-12 study window count must include the inferred row');
  const studyIds = new Set(entry.shapeStudy.full.patches.filter((patch: any) => patch.featureKind === 'observed-window').map((patch: any) => patch.featureId));
  for (const id of INFERRED_IDS) assert.ok([...studyIds].some((featureId: any) => featureId.endsWith(id)), `case-12 study missing ${id}`);
  const candidateIds = new Set(entry.patches.filter((patch: any) => patch.featureKind === 'observed-window').map((patch: any) => patch.featureId));
  for (const id of INFERRED_IDS) assert.ok([...candidateIds].some((featureId: any) => featureId.endsWith(id)), `case-12 candidate missing ${id}`);
}

// --- 3. A fresh shared-builder compile reproduces the delivered case ------
{
  const { c, owner, original } = ownerFor('case-12');
  const cache = JSON.parse(fs.readFileSync('.cache/city-appearance/fidelity-extraction/analysis-results.json', 'utf8'));
  const index = JSON.parse(fs.readFileSync('.cache/city-appearance/fidelity-extraction/development-analysis-index.json', 'utf8'));
  const manifest = fs.readFileSync('scripts/review/facade-regression-analysis-manifest.json');
  assert.equal(index.manifestSha256, crypto.createHash('sha256').update(manifest).digest('hex'), 'stale analysis manifest');
  const keys = new Set(index.cases.map((row: any) => row.key));
  const complete = cache.results.filter((row: any) => keys.has(row.key) && row.status === 'complete' && row.proposal);
  const fresh = buildCaseCandidate({
    caseId: 'case-12',
    owner,
    original,
    bindingSurfaceIndices: c.binding?.surfaceIndices,
    complete,
    references: JSON.parse(fs.readFileSync('scripts/review/window-shape-reference.json', 'utf8')),
    corrections: JSON.parse(fs.readFileSync('scripts/review/development-photo-corrections.json', 'utf8')),
    spatial: JSON.parse(fs.readFileSync('scripts/review/spatial-source-corrections.json', 'utf8')),
    signReferences: JSON.parse(fs.readFileSync('scripts/review/roof-sign-corrections.json', 'utf8')),
    retailReview: JSON.parse(fs.readFileSync('scripts/review/retail-priority-source-review.json', 'utf8')),
    floorRows,
  });
  const entry = caseById('case-12');
  assert.equal(JSON.stringify(entry.candidateObservations), JSON.stringify(fresh.candidateObservations), 'case-12 candidate out of sync; re-run scripts/review/refresh-reviewed-floor-rows.ts');
  assert.equal(JSON.stringify(entry.patches), JSON.stringify(fresh.patches), 'case-12 patches out of sync');
  assert.equal(JSON.stringify(entry.shapeFeatures), JSON.stringify(fresh.shapeFeatures), 'case-12 shapeFeatures out of sync');
}

// --- 4. The correction fails closed on stale or overreaching input --------
{
  const correction = floorRows.cases['case-12'].full;
  const base = {
    features: [
      { id: 'full:window-2', kind: 'window', bounds: [82.9, 164.2, 120.6, 229.8], disposition: 'machine-observed-unreviewed' },
      { id: 'full:window-3', kind: 'window', bounds: [123, 164, 164, 230], disposition: 'machine-observed-unreviewed' },
      { id: 'full:window-4', kind: 'window', bounds: [167, 164, 205, 230], disposition: 'machine-observed-unreviewed' },
    ],
  };
  const input = { features: base.features as any[], cropSha256: correction.source.cropSha256, captureDate: correction.source.captureDate };
  const applied = applyFloorRowCorrections(correction, input);
  assert.equal(applied.length, 6, 'correction must append three rows');
  // Idempotent: re-applying does not duplicate.
  assert.equal(applyFloorRowCorrections(correction, { ...input, features: applied }).length, 6, 'correction is not idempotent');
  assert.throws(() => applyFloorRowCorrections(correction, { ...input, cropSha256: '0'.repeat(64) }), /Stale floor-row correction/, 'stale crop must fail closed');
  assert.throws(() => applyFloorRowCorrections(correction, { ...input, features: base.features.slice(1) as any[] }), /anchor row is missing/, 'missing anchor must fail closed');
  // A row whose bottom reaches the ground band is rejected.
  assert.throws(
    () => applyFloorRowCorrections({ ...correction, inferred: [{ id: 'x', kind: 'window', bounds: [48, 379, 96, 400] }] } as any, input),
    /does not fit the measured gap/,
    'a row inside the ground band must fail closed',
  );
  // A gap no larger than one storey is not a missing floor.
  assert.throws(
    () => applyFloorRowCorrections({ ...correction, groundBandTopPx: 300 } as any, input),
    /not larger than one storey/,
    'a sub-storey gap must not be treated as a missing row',
  );
}

// --- 5. No other reviewed case gained an inferred row ---------------------
{
  for (const entry of packet.cases) {
    if (entry.caseId === 'case-12') continue;
    for (const tier of ['full', 'ground']) {
      const features = entry.shapeFeatures?.[tier]?.features ?? [];
      const leaked = features.filter((feature: any) => feature.inference === 'observed-row-rhythm');
      assert.equal(leaked.length, 0, `${entry.caseId}/${tier} carries an unexpected inferred floor row`);
    }
  }
}

console.log(
  'Reviewed floor-row regression passed: case-12 draws its measured second upper row on the observed rhythm; a fresh shared-builder compile reproduces it; stale, sub-storey and ground-band corrections fail closed; no other case gained a row.',
);
