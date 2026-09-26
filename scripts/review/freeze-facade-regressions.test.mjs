import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const run = promisify(execFile), root = process.cwd();
const release = 'c4bebc1fcc1ad9622ea4972755b3eee69f037928db4573219c86d2c4e088920d';
const script = 'scripts/review/freeze-facade-regressions.mjs';

test('freezes all exact user notes, published bindings and held-out exclusions deterministically', async () => {
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'facade-regression-freeze-'));
  const output = path.join(temporary, 'regressions.json'), exclusions = path.join(temporary, 'exclusions.json'), analysis = path.join(temporary, 'analysis.json');
  await run(process.execPath, ['--import', 'tsx', script, `--release=${release}`, `--out=${output}`, `--exclusions-out=${exclusions}`, `--analysis-out=${analysis}`], { cwd: root });
  const [generated, committed, excluded, committedExcluded, analysisManifest] = await Promise.all([
    fs.readFile(output, 'utf8').then(JSON.parse), fs.readFile('scripts/review/facade-regressions.json', 'utf8').then(JSON.parse),
    fs.readFile(exclusions, 'utf8').then(JSON.parse), fs.readFile('scripts/review/facade-regression-heldout-exclusions.json', 'utf8').then(JSON.parse),
    fs.readFile(analysis, 'utf8').then(JSON.parse),
  ]);
  assert.deepEqual(generated, committed);
  assert.deepEqual(excluded, committedExcluded);
  assert.equal(generated.cases.length, 28);
  assert.ok(generated.cases.every(item => item.userNote.origin === 'user-entered-review' && item.assertions.length > 0 && item.pixelReferenceAnnotations === null));
  assert.ok(generated.cases.filter(item => item.assertions.some(assertion => assertion.expected?.feature === 'door')).every(item => item.assertions.some(assertion => assertion.expected.minimum > 0)));
  assert.equal(generated.cases.find(item => item.caseId === 'case-13').assertions.find(assertion => assertion.id === 'upper-window-columns').expected.upperColumns, 3);
  const ambiguous = generated.cases.find(item => item.caseId === 'case-26');
  assert.deepEqual(ambiguous.assertions, [{ id: 'source-ambiguity', kind: 'source-ambiguity', expected: { status: 'requires-clarification', prohibitsFeatureInference: true }, source: 'user-note' }]);
  assert.equal(ambiguous.baselineRenderedFeatureCoverage.measurementStatus, 'source-ambiguous-not-measurable');
  assert.deepEqual(excluded.actualOverlaps.map(item => item.observationId), ['0363100012165927_e_0xxqmsr']);
  assert.equal(excluded.retainedHeldoutObservationIds.length, 29);
  assert.equal(analysisManifest.analysisOnly, true);
  assert.equal(analysisManifest.cases.length, 28);
  assert.equal(analysisManifest.cases.flatMap(item => Object.values(item.sources)).length, 56);
  assert.match(analysisManifest.cases.find(item => item.id === 'case-26').analysisExcludedReason, /source ambiguity/i);
  assert.deepEqual(analysisManifest.analysisPriority, ['case-04:ground', 'case-11:ground', 'case-19:ground', 'case-22:ground', 'case-25:ground', 'case-30:ground']);
});

test('refuses notes that are no longer ready or bound to the packet', async () => {
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'facade-regression-stale-'));
  const original = JSON.parse(await fs.readFile(`.cache/city-appearance/review-notes/${release}.json`, 'utf8'));
  original.packetSha256 = '0'.repeat(64);
  const notes = path.join(temporary, 'notes.json');
  await fs.writeFile(notes, JSON.stringify(original));
  await assert.rejects(run(process.execPath, ['--import', 'tsx', script, `--release=${release}`, `--notes=${notes}`, `--out=${path.join(temporary, 'out.json')}`, `--exclusions-out=${path.join(temporary, 'exclusions.json')}`], { cwd: root }), /Review packet changed/);
});
