import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import {mergeOpenings} from './openingMerge.ts';
import {adjudicateOpeningProposals, type OpeningCandidate, type OpeningLane} from './openingProposalAdjudication.ts';

const cropSha256 = 'a'.repeat(64);
const wall = {widthM: 8, heightM: 12, cropSha256};
const candidate = (id: string, kind: OpeningCandidate['kind'], along: number, up: number,
  extra: Partial<OpeningCandidate> = {}): OpeningCandidate => ({
  id, kind, along, up, width: 1, height: 2, evidence: 'model-proposal', cropSha256, ...extra,
});
const review = (lanes: OpeningLane[]) => adjudicateOpeningProposals(wall, lanes, {mode: 'evidence-aware'});

test('legacy mode returns the unchanged D1 union even for a contested doorway', () => {
  const lanes = [
    {name: 'rfdetr', candidates: [candidate('w', 'window', 1, 0, {score: .99})]},
    {name: 'rsjek', candidates: [candidate('d', 'door', 1, 0, {score: .2})]},
  ];
  const result = adjudicateOpeningProposals(wall, lanes);
  const expected = mergeOpenings(lanes.map(lane => ({name: lane.name, boxes: lane.candidates})));
  assert.deepEqual(result.legacyUnion, expected);
  assert.equal(result.legacyUnion?.length, 1);
  assert.equal(result.legacyUnion?.[0].kind, 'door');
  assert.deepEqual(result.proposals, []);
});

test('opt-in mode keeps ambiguous door and window evidence for review', () => {
  const result = review([
    {name: 'rfdetr', candidates: [candidate('w', 'window', 1, 0, {score: .99})]},
    {name: 'rsjek', candidates: [candidate('d', 'door', 1, 0, {score: .2})]},
  ]);
  assert.equal(result.proposals.length, 2);
  assert.equal(result.conflicts.length, 1);
  assert.ok(result.proposals.every(proposal => proposal.status === 'needs-review'));
  assert.ok(result.proposals.every(proposal => proposal.sources.length === 1));
});

test('rejects malformed and out-of-wall boxes, unknown classes and wrong crop bindings', () => {
  const result = review([{name: 'lane', candidates: [
    candidate('valid', 'window', 1, 1),
    candidate('negative', 'window', -.01, 1),
    candidate('beyond', 'door', 7.5, 1),
    candidate('nan', 'window', Number.NaN, 1),
    candidate('zero', 'window', 1, 1, {width: 0}),
    candidate('wrong-crop', 'door', 2, 0, {cropSha256: 'b'.repeat(64)}),
    candidate('shop', 'other', 4, 1),
  ]}]);
  assert.deepEqual(result.proposals.map(proposal => proposal.id), ['lane:valid']);
  assert.deepEqual(result.rejected.map(rejection => rejection.reason), [
    'outside-wall', 'outside-wall', 'invalid-box', 'invalid-box', 'different-source-crop', 'non-opening-class',
  ]);
});

test('deduplicates agreement without comparing cross-model scores', () => {
  const first = review([
    {name: 'rfdetr', candidates: [candidate('w1', 'window', 1, 3, {score: .99})]},
    {name: 'rsjek', candidates: [candidate('w2', 'window', 1.1, 3, {score: .12})]},
  ]);
  const second = review([
    {name: 'rsjek', candidates: [candidate('w2', 'window', 1.1, 3, {score: .99})]},
    {name: 'rfdetr', candidates: [candidate('w1', 'window', 1, 3, {score: .12})]},
  ]);
  assert.equal(first.proposals.length, 1);
  assert.deepEqual(first.proposals[0].box, second.proposals[0].box);
  assert.deepEqual(first.proposals[0].sources.map(source => source.lane), ['rfdetr', 'rsjek']);
});

test('observed, model, and procedural evidence remain distinct', () => {
  const result = review([
    {name: 'procedural', candidates: [candidate('p', 'window', 1.05, 3, {evidence: 'procedural-inference'})]},
    {name: 'model', candidates: [candidate('m', 'window', 1.1, 3)]},
    {name: 'inspection', candidates: [candidate('o', 'window', 1, 3, {evidence: 'source-observed', observationId: 'audit-1'})]},
    {name: 'bad-inspection', candidates: [candidate('x', 'window', 5, 3, {evidence: 'source-observed'})]},
  ]);
  assert.equal(result.proposals.length, 1);
  assert.equal(result.proposals[0].evidence, 'source-observed');
  assert.deepEqual(result.proposals[0].box, {along: 1, up: 3, width: 1, height: 2});
  assert.deepEqual(result.proposals[0].sources.map(source => source.evidence),
    ['source-observed', 'model-proposal', 'procedural-inference']);
  assert.equal(result.rejected[0].reason, 'unbound-observation');
});

test('real R0 prediction contract adapts without changing the default union', () => {
  const rfdetr = JSON.parse(fs.readFileSync('public/data/facade-model-eval/v1/predictions/rfdetr-R0.json', 'utf8'));
  const rsjek = JSON.parse(fs.readFileSync('public/data/facade-model-eval/v1/predictions/rsjek-R0.json', 'utf8'));
  const a = rfdetr.records[0];
  const b = rsjek.records.find((record: any) => record.elevationId === a.elevationId);
  assert.ok(b, 'pinned R0 wall exists in both lanes');
  const lanes = [a, b].map((record, index) => ({name: index ? 'rsjek' : 'rfdetr', candidates: record.boxes.map((box: any, boxIndex: number) => ({
    id: String(boxIndex), kind: box.kind, along: box.along, up: box.up, width: box.widthM,
    height: box.heightM, score: box.score, evidence: 'model-proposal' as const,
  }))}));
  const result = adjudicateOpeningProposals({widthM: a.wallWidthM, heightM: a.wallHeightM}, lanes);
  assert.deepEqual(result.legacyUnion, mergeOpenings(lanes.map(lane => ({name: lane.name, boxes: lane.candidates}))));
  const reviewed = adjudicateOpeningProposals({widthM: a.wallWidthM, heightM: a.wallHeightM}, lanes, {mode: 'evidence-aware'});
  assert.ok(reviewed.proposals.length > 0);
  assert.ok(reviewed.rejected.every(rejection => rejection.reason !== 'invalid-box'));
  assert.ok(reviewed.proposals.every(proposal => proposal.reasons.includes('wall-crop-unverified')));
});
