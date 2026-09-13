import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { assignBoxes, buildSourceEvaluation } from './source-evaluation.ts';

const hash = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');
const opening = (id: string, bounds: [number, number, number, number], extra = {}) => ({ id, kind: 'window', head: 'rectangular', bounds, visible: true, boundsMeaning: 'complete-assembly-outline', ...extra });

async function fixture(options: { analyses?: any[]; refs?: any[]; features?: any[]; manifestCases?: any[] } = {}) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'source-evaluation-'));
  const image = Buffer.from('source-image');
  const cropSha256 = hash(image);
  await fs.mkdir(path.join(root, 'images'), { recursive: true });
  await fs.writeFile(path.join(root, 'images', 'ground.jpg'), image);
  const ref = { caseId: 'case-1', observationId: 'obs-1', buildingId: 'building-1', tier: 'ground', cropSha256, captureDate: '2025-01-01Z', imageDimensions: { width: 100, height: 100 }, openings: [opening('reference', [10, 10, 40, 50])] };
  const analysis = { key: 'analysis-1', status: 'complete', source: { cropSha256, width: 100, height: 100 }, proposal: { openingsComplete: true, features: options.features ?? [opening('prediction', [10, 10, 40, 50])] } };
  const manifestCase = { observationId: 'obs-1', buildingId: 'building-1', sources: { ground: { cropSha256, captureDate: '2025-01-01Z', width: 100, height: 100, path: '../images/ground.jpg' } } };
  const files = { reference: 'reference.json', analysis: 'analysis.json', manifest: 'manifests/manifest.json' };
  await fs.mkdir(path.join(root, 'manifests'), { recursive: true });
  await fs.writeFile(path.join(root, files.reference), JSON.stringify({ scope: 'agent inspected', entries: options.refs ?? [ref] }));
  await fs.writeFile(path.join(root, files.analysis), JSON.stringify({ results: options.analyses ?? [analysis] }));
  await fs.writeFile(path.join(root, files.manifest), JSON.stringify({ cases: options.manifestCases ?? [manifestCase] }));
  return { root, files, ref, analysis, manifestCase };
}

test('one-to-one assignment prevents duplicate predictions from inflating recall', () => {
  const refs = [opening('a', [0, 0, 10, 10]), opening('b', [20, 0, 30, 10])];
  const predictions = [opening('p1', [0, 0, 10, 10]), opening('p2', [0, 0, 10, 10])];
  assert.equal(assignBoxes(refs, predictions, 0.5).length, 1);
});

test('exact crop identity never silently selects ambiguous completed analyses', async () => {
  const f = await fixture();
  const duplicate = { ...f.analysis, key: 'analysis-2' };
  await fs.writeFile(path.join(f.root, f.files.analysis), JSON.stringify({ results: [f.analysis, duplicate] }));
  const report = await buildSourceEvaluation({ root: f.root, referencePath: f.files.reference, analysisPath: f.files.analysis, manifestPaths: [f.files.manifest] });
  assert.equal(report.cases[0].analysis.outcome, 'ambiguous');
  assert.equal(report.cases[0].matches.length, 0);
  assert.equal(report.cases[0].misses.length, 1);
});

test('identity leakage is blocked even when crop hash and dimensions match', async () => {
  const f = await fixture();
  await fs.writeFile(path.join(f.root, f.files.manifest), JSON.stringify({ cases: [{ ...f.manifestCase, buildingId: 'other-building' }] }));
  const report = await buildSourceEvaluation({ root: f.root, referencePath: f.files.reference, analysisPath: f.files.analysis, manifestPaths: [f.files.manifest] });
  assert.equal(report.cases[0].analysis.outcome, 'identity-mismatch');
  assert.equal(report.cases[0].status, 'abstained');
});

test('partial visible extents are ignored and suppress overall precision claims', async () => {
  const f = await fixture();
  const partial = opening('partial', [60, 10, 90, 60], { visible: false, boundsMeaning: 'visible-extent-only-not-complete-box' });
  await fs.writeFile(path.join(f.root, f.files.reference), JSON.stringify({ entries: [{ ...f.ref, openings: [f.ref.openings[0], partial] }] }));
  const report = await buildSourceEvaluation({ root: f.root, referencePath: f.files.reference, analysisPath: f.files.analysis, manifestPaths: [f.files.manifest] });
  assert.equal(report.coverage.partialVisibleExtentsIgnored, 1);
  assert.equal(report.cases[0].denominators.completeVisibleReferences, 1);
  assert.equal(report.aggregateDiagnostics.precision, null);
  assert.ok(report.repairQueue.some((item: any) => item.category === 'annotation-needed'));
});

test('missing analysis is an abstention and a visible complete reference miss', async () => {
  const f = await fixture({ analyses: [] });
  const report = await buildSourceEvaluation({ root: f.root, referencePath: f.files.reference, analysisPath: f.files.analysis, manifestPaths: [f.files.manifest] });
  assert.equal(report.cases[0].analysis.outcome, 'missing');
  assert.deepEqual(report.cases[0].misses, ['reference']);
  assert.equal(report.cases[0].diagnostics.localizationRecall, 0);
});

test('reruns are reproducible and missing source bytes stay explicit', async () => {
  const f = await fixture();
  await fs.unlink(path.join(f.root, 'images', 'ground.jpg'));
  const first = await buildSourceEvaluation({ root: f.root, referencePath: f.files.reference, analysisPath: f.files.analysis, manifestPaths: [f.files.manifest] });
  const second = await buildSourceEvaluation({ root: f.root, referencePath: f.files.reference, analysisPath: f.files.analysis, manifestPaths: [f.files.manifest] });
  assert.equal(first.reproducibility.canonicalReportSha256, second.reproducibility.canonicalReportSha256);
  assert.equal(first.cases[0].binding.status, 'missing-image');
  assert.equal(first.cases[0].analysis.outcome, 'identity-mismatch');
});
