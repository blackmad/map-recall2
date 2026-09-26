import assert from 'node:assert/strict';
import { buildComparisonPacket, synchronizeComparison } from './build-source-render-comparison-packet.mjs';

const source = (id, district, signText = '', extra = {}) => ({
  id, buildingId: `building-${id}`, renderBuildingId: `building-${id}`, district,
  evidenceKey: `evidence-${id}`, derivationKey: `derivation-${id}`,
  images: { ground: { panoramaId: `pano-${id}`, date: '2026-09-01', sha256: 'a'.repeat(64), panoramaSha256: 'b'.repeat(64) } },
  effectiveProposal: { shopfront: signText ? 'yes' : extra.negative ? 'no' : 'unknown' },
  machineRoutingProposal: { signText, signTextEligible: signText ? 'yes' : extra.negative ? 'no' : 'unknown', groundType: extra.negative ? 'residential' : 'unknown' },
  ...extra,
});

const records = [source('positive', 'Da Costabuurt', 'DORUS'), source('negative', 'Jordaan', '', { negative: true }), source('unknown', 'Jordaan')];
const render = [{ ...records[0] }, { ...records[1], evidenceKey: 'stale' }];
assert.equal(synchronizeComparison(records[0], render[0]).synchronized, true);
assert.equal(synchronizeComparison(records[1], render[1]).reason, 'source-render-identity-or-capture-mismatch');
const packet = buildComparisonPacket(records, { renderRecords: render, limit: 30, seed: 'fixture' });
assert.equal(packet.cases.length, 3);
assert.equal(packet.humanReviewSeparate, true);
assert.deepEqual(packet.summary.classes, { positive: 1, negative: 1, unknown: 1 });
assert.deepEqual(packet.summary.districts, ['Da Costabuurt', 'Jordaan']);
assert.equal(packet.cases.find(item => item.label === 'positive').comparison.synchronized, true);
assert.equal(packet.cases.find(item => item.label === 'negative').comparison.synchronized, false);
assert.equal(buildComparisonPacket(records, { seed: 'fixture' }).cases.map(item => item.caseId).join(','), packet.cases.map(item => item.caseId).join(','));
console.log('Source/render comparison packet checks passed: identity, capture date, tier, omissions, class/district stratification and separate human review state.');
