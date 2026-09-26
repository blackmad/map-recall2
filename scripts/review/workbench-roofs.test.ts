import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import test from 'node:test';
import { buildRoofReviewQueue, summarizeWorkbenchRoof } from './workbench-roofs.ts';

const source = { sha256: 'a'.repeat(64), width: 200, height: 500, captureDate: '2025-01-01Z', url: '/source.jpg' };
const roof = { type: 'roof' };

test('preserved roof planes stay distinct from an unreviewed frontal silhouette', () => {
  const summary = summarizeWorkbenchRoof({ caseId: 'case-02', owner: { id: 'b2', geometry: { building: { surfaces: [roof, roof] } } }, source: { full: source }, roofReview: { status: 'source-outline-not-reviewed' } });
  assert.deepEqual(summary.roof3D, { status: 'preserved-source-surfaces', surfaceCount: 2 });
  assert.equal(summary.frontalSilhouette.status, 'not-reviewed'); assert.equal(summary.priority.level, 'high');
  assert.equal(summary.dormers.status, 'not-established');
});

test('reviewed dormer and occlusion remain explicit without a metric claim', () => {
  const summary = summarizeWorkbenchRoof({ caseId: 'case-01', owner: { geometry: { building: { surfaces: [roof] } } }, source: { full: source }, roofReview: { status: 'source-outline-reviewed', uncertainty: 'Tree branches obscure the left edge.' }, shapeFeatures: { full: { features: [{ id: 'full:review:dormer', kind: 'window', disposition: 'agent-inspected' }] } } });
  assert.equal(summary.status, 'reviewed-with-limits'); assert.equal(summary.priority.level, 'medium');
  assert.deepEqual(summary.dormers, { status: 'agent-reviewed-present', count: 1 });
  assert.deepEqual(summary.occlusion, { status: 'limited', detail: 'Tree branches obscure the left edge.' });
  assert.match(summary.checklist.at(-1)!, /do not claim metric registration/);
});

test('missing full source and roof surfaces rank before ordinary unreviewed cases', () => {
  const queue = buildRoofReviewQueue([
    { caseId: 'case-02', owner: { geometry: { building: { surfaces: [roof] } } }, source: { full: source }, roofReview: { status: 'source-outline-not-reviewed' } },
    { caseId: 'case-26', owner: { geometry: { building: { surfaces: [] } } }, source: {} },
  ]);
  assert.equal(queue[0].caseId, 'case-26'); assert.equal(queue[0].status, 'blocked');
});

test('real preview cases preserve reviewed and missing-geometry distinctions', async () => {
  const evidenceRoot = process.cwd();
  const data = JSON.parse(await fs.readFile(`${evidenceRoot}/public/data/facade-repair-preview/cases.json`, 'utf8'));
  const summaries = buildRoofReviewQueue(data.cases);
  assert.equal(summaries.length, 28);
  const one = summaries.find(value => value.caseId === 'case-01')!;
  assert.equal(one.frontalSilhouette.status, 'agent-reviewed-source-outline'); assert.equal(one.dormers.status, 'agent-reviewed-present'); assert.equal(one.occlusion.status, 'limited');
  const twenty = summaries.find(value => value.caseId === 'case-20')!;
  assert.equal(twenty.dormers.status, 'agent-reviewed-present'); assert.equal(twenty.roof3D.status, 'preserved-source-surfaces');
  const twentySix = summaries.find(value => value.caseId === 'case-26')!;
  assert.equal(twentySix.roof3D.status, 'absent-or-unreported'); assert.equal(twentySix.priority.level, 'critical');
});
