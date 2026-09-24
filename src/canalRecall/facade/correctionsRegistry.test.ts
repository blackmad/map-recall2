import assert from 'node:assert/strict';
import {
  correctionsByCase,
  loadCorrections,
  mergeCorrections,
  validateCorrection,
  type CorrectionRecord,
} from './correctionsRegistry.ts';

// --- Missing buildingId is rejected and named in the error list.
const missingBuilding = validateCorrection({ caseId: 'case-1', observationId: 'o1' });
assert.equal(missingBuilding.ok, false);
assert.ok(
  !missingBuilding.ok && missingBuilding.errors.some((error) => error.includes('buildingId')),
  'missing buildingId must be reported',
);

// --- A minimal valid record is accepted.
const minimal = validateCorrection({ caseId: 'case-1', buildingId: 'b1', observationId: 'o1' });
assert.ok(minimal.ok, 'minimal record must validate');
assert.equal(minimal.record.caseId, 'case-1');

// --- Non-array id arrays and non-object entries are rejected.
const badArrays = validateCorrection({ caseId: 'case-1', buildingId: 'b1', observationId: 'o1', sourceFeatureOverrides: {} });
assert.ok(!badArrays.ok && badArrays.errors.some((error) => error.includes('sourceFeatureOverrides')), 'non-array overrides must fail');
const badElement = validateCorrection({ caseId: 'case-1', buildingId: 'b1', observationId: 'o1', componentSurfaces: [{}] });
assert.ok(!badElement.ok && badElement.errors.some((error) => error.includes('componentSurfaces[0].name')), 'missing surface name must fail');

// --- Duplicate building|observation keys are reported, first record kept.
const first: CorrectionRecord = { id: 'a', caseId: 'case-1', buildingId: 'b1', observationId: 'o1' };
const second: CorrectionRecord = { id: 'b', caseId: 'case-1', buildingId: 'b1', observationId: 'o1' };
const merged = mergeCorrections([first, second]);
assert.equal(merged.records.length, 1, 'duplicate key must collapse to one record');
assert.equal(merged.records[0].id, 'a', 'first record wins');
assert.equal(merged.conflicts.length, 1, 'one conflict reported');
assert.equal(merged.conflicts[0].key, 'b1|o1');
assert.deepEqual(merged.conflicts[0].ids, ['a', 'b']);

// --- mergeCorrections output is sorted by caseId.
const sorted = mergeCorrections([
  { id: 'z', caseId: 'case-2', buildingId: 'b2', observationId: 'o2' },
  { id: 'a', caseId: 'case-1', buildingId: 'b1', observationId: 'o1' },
]).records;
assert.deepEqual(sorted.map((record) => record.caseId), ['case-1', 'case-2']);

// --- correctionsByCase groups deterministically (caseId order, then id).
const grouped = correctionsByCase([
  { id: 'z', caseId: 'case-2', buildingId: 'b2', observationId: 'o2' },
  { id: 'b', caseId: 'case-1', buildingId: 'b3', observationId: 'o3' },
  { id: 'a', caseId: 'case-1', buildingId: 'b1', observationId: 'o1' },
]);
assert.deepEqual(Object.keys(grouped), ['case-1', 'case-2']);
assert.deepEqual(grouped['case-1'].map((record) => record.id), ['a', 'b']);

// --- The real review studies load and every loaded record validates.
const loaded = await loadCorrections();
assert.ok(loaded.length >= 4, `expected at least 4 records, got ${loaded.length}`);
for (const record of loaded) {
  const result = validateCorrection(record);
  assert.ok(result.ok, `loaded record ${record.id ?? record.caseId} must validate`);
}
const caseIds = new Set(loaded.map((record) => record.caseId));
for (const caseId of ['case-20', 'case-22', 'case-25', 'case-30']) {
  assert.ok(caseIds.has(caseId), `expected loaded case ${caseId}`);
}
const sourceBundle = loaded.find((record) => record.caseId === 'case-25' && record.replace !== undefined);
assert.ok(sourceBundle, 'case25 source-corrections bundle must load as a record');

console.log(
  `corrections registry: validated ${loaded.length} record(s) across ${caseIds.size} case(s); ` +
    `merge kept 1 with ${merged.conflicts.length} conflict(s); grouping deterministic.`,
);
