import assert from 'node:assert/strict';
import { buildSampleCompositionAudit, classifyDevelopmentCase } from './sample-composition-audit.ts';

const audit = buildSampleCompositionAudit();
assert.equal(audit.composition.totalEntries, 30);
assert.equal(audit.composition.developmentEntries, 28);
assert.deepEqual(audit.composition.sourceInspectedCounts, { retail: 9, residential: 1, mixed: 0, unknown: 20 });
assert.deepEqual(audit.activeCurrentPass.sourceInspectedCounts, { retail: 3, unknown: 1 });
assert.equal(audit.activeCurrentPass.compositionEvidenceComplete, false);
assert.deepEqual(audit.activeCurrentPass.detailCoverage, { recess: true, awning: true, sign: true });
assert.equal(audit.activeCurrentPass.cases.find((item) => item.id === 'case-18')?.typologyEvidenceStatus, 'unconfirmed');
assert.deepEqual(audit.proposedFutureCasePriority.cases.map((item) => item.id), ['case-05']);
assert.deepEqual(audit.namedCompatibilityCoverageChecks.cases.map((item) => item.id), ['named:Fuoco Vivo', 'named:Engels Verf']);
assert.equal(audit.heldoutRisk.activeAndProposedHeldoutOverlapCount, 0);
assert.equal(audit.heldoutRisk.retainedAfterExistingExclusions, 29);
assert.deepEqual(audit.heldoutRisk.namedBuildingIdsRequiringDevelopmentExclusionBeforeUse.sort(), [
  '0363100012159182', '0363100012174146', '0363100012174549',
]);

const streetNameTrap: any = {
  caseId: 'case-uninspected',
  address: 'Retail Shop House 10',
  owner: { id: 'building-x' },
  source: {},
};
assert.equal(classifyDevelopmentCase(streetNameTrap).sourceInspectedTypology, 'unknown', 'street label must not infer typology');

const staleCase: any = {
  caseId: 'case-21',
  address: 'Lauriergracht 50',
  owner: { id: '0363100012173919' },
  source: { ground: { sha256: '0'.repeat(64), captureDate: '2025-07-03T09:50:55Z' } },
};
assert.throws(() => classifyDevelopmentCase(staleCase), /source-binding-mismatch/, 'stale source cannot inherit an inspected typology');

assert.equal(audit.paidCalls, 0);
console.log('Sample composition audit: source-bound typology, priority mix and held-out risk verified.');
