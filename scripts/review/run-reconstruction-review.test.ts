import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { runReconstructionReview } from './run-reconstruction-review.ts';

const sha = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');
async function fixture() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'reconstruction-review-'));
  const image = Buffer.from('image-v1'), cropSha256 = sha(image);
  const write = async (name: string, value: string | object) => {
    const file = path.join(root, name); await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, typeof value === 'string' ? value : JSON.stringify(value));
  };
  await write('evidence/ground.jpg', image.toString());
  await write('scripts/city-appearance/fidelity/independent-reference-measurements.json', {
    version: 1, disposition: 'independent-source-annotations', status: 'partial-ground-tier-reference; not-full-facade-certification',
    coordinateConvention: 'source-image pixels, pixel edges; opening bounds include the assembly perimeter', scope: 'fixture development reference', entries: [{
      caseId: 'case-1', observationId: 'obs-1', buildingId: 'building-1', tier: 'ground', cropSha256, captureDate: '2025-01-01Z',
      imageDimensions: { width: 100, height: 100 }, disposition: 'agent-inspected', inspectionMethod: 'fixture inspection',
      openings: [{ id: 'window-1', kind: 'window', head: 'rectangular', bounds: [10, 10, 40, 60], visible: true, boundsMeaning: 'complete-assembly-outline' }],
    }],
  });
  await write('.cache/city-appearance/fidelity-extraction/analysis-results.json', { results: [{ key: 'analysis-1', status: 'complete', source: { cropSha256, width: 100, height: 100 }, proposal: { openingsComplete: true, features: [{ id: 'prediction-1', kind: 'window', head: 'rectangular', bounds: [10, 10, 40, 60] }] } }] });
  await write('scripts/city-appearance/fidelity/active-development-manifest.json', { cases: [{ observationId: 'obs-1', buildingId: 'building-1', sources: { ground: { cropSha256, captureDate: '2025-01-01Z', width: 100, height: 100, path: '../../../evidence/ground.jpg' } } }] });
  for (const file of ['scripts/review/project-status.ts', 'scripts/review/review-snapshot.ts', 'scripts/review/run-reconstruction-review.ts', 'scripts/city-appearance/quality-loop/source-evaluation.ts']) await write(file, `fixture ${file}\n`);
  return { root, imagePath: path.join(root, 'evidence/ground.jpg') };
}

test('default plan is read-only and describes the deterministic destination', async () => {
  const { root } = await fixture();
  const plan = await runReconstructionReview({ root });
  assert.equal(plan.write, false); assert.equal(plan.paidCalls, 0); assert.equal(plan.activationPerformed, false);
  await assert.rejects(fs.access(path.join(root, 'review-data')), /ENOENT/);
});

test('write stages immutable report and snapshot, then identical rerun reuses it', async () => {
  const { root } = await fixture();
  const first = await runReconstructionReview({ root, write: true });
  if (!('directory' in first)) assert.fail('write run must return a directory');
  assert.equal(first.reused, false);
  const report = JSON.parse(await fs.readFile(path.join(first.directory!, 'report.json'), 'utf8'));
  assert.equal(report.runId, first.runId); assert.equal(report.source.summary.completeReferenceMatches, 1);
  const second = await runReconstructionReview({ root, write: true });
  assert.equal(second.runId, first.runId); assert.equal(second.reused, true);
});

test('changed source image bytes produce a new run identity', async () => {
  const { root, imagePath } = await fixture();
  const first = await runReconstructionReview({ root });
  await fs.writeFile(imagePath, 'image-v2');
  const second = await runReconstructionReview({ root });
  assert.notEqual(second.runId, first.runId);
});

test('corrupt existing report is refused rather than silently reused', async () => {
  const { root } = await fixture();
  const first = await runReconstructionReview({ root, write: true });
  if (!('directory' in first)) assert.fail('write run must return a directory');
  await fs.writeFile(path.join(first.directory!, 'report.json'), '{}\n');
  await assert.rejects(runReconstructionReview({ root, write: true }), /failed verification/);
});

test('missing and invalid project artifacts remain explicit report status', async () => {
  const { root } = await fixture();
  await fs.mkdir(path.join(root, 'public/data/city-expansion'), { recursive: true });
  await fs.writeFile(path.join(root, 'public/data/city-expansion/current.json'), '{broken');
  const run = await runReconstructionReview({ root, write: true });
  if (!('directory' in run)) assert.fail('write run must return a directory');
  const report = JSON.parse(await fs.readFile(path.join(run.directory!, 'report.json'), 'utf8'));
  assert.deepEqual(report.project.artifacts.current, { path: 'public/data/city-expansion/current.json', present: true, valid: false, sha256: sha(Buffer.from('{broken')), error: 'invalid JSON' });
  assert.equal(report.project.artifacts.candidate.present, false);
  assert.equal(report.project.artifacts.candidate.error, 'missing');
});
