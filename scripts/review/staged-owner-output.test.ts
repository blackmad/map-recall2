import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promoteStagedOwnerOutput, stageOwnerCandidateOutput } from './staged-owner-output.js';
import { checkReviewArtifactBinding } from './check-review-artifact-binding.mjs';

const sha = (bytes: Buffer | string) => createHash('sha256').update(bytes).digest('hex');
const captures = ['source-aligned-source-100.png', 'source-aligned-baseline-source-0.png', 'source-aligned-candidate-source-0.png', 'source-aligned-candidate-source-50.png', 'candidate-oblique-no-context.png', 'wide-street-baseline-source-0.png', 'wide-street-candidate-source-0.png'];

async function reviewFixture(root: string, staged: any) {
  const put = async (file: string, bytes: string | Buffer) => { await fs.mkdir(path.dirname(path.join(root, file)), { recursive: true }); await fs.writeFile(path.join(root, file), bytes); };
  const sourcePath = 'public/evidence/source.jpg', sourceBytes = 'source';
  await put(sourcePath, sourceBytes);
  const inputs = [];
  for (const [file, bytes] of [[staged.stagePublicPath, await fs.readFile(path.join(root, staged.stagePublicPath))], ['viewer.js', Buffer.from('renderer')], ['viewer.html', Buffer.from('html')], [sourcePath, Buffer.from(sourceBytes)]] as const) {
    if (!(await fs.stat(path.join(root, file)).catch(() => null))) await put(file, bytes);
    const snapshot = `review/archive/${sha(bytes)}/${path.basename(file)}`; await put(snapshot, bytes);
    inputs.push({ path: file, sha256: sha(bytes), snapshot });
  }
  const captureRecords = [];
  for (const name of captures) { await put(`review/${name}`, name); captureRecords.push({ path: `review/${name}`, sha256: sha(name) }); }
  const manifest = { kind: 'source-to-owner-city-preview-review', caseId: 'case-22', source: { publicCropUrl: '/evidence/source.jpg', cropSha256: sha(sourceBytes) }, inputs, captures: captureRecords };
  const manifestBytes = JSON.stringify(manifest); await put('review/manifest.json', manifestBytes);
  const binding = await checkReviewArtifactBinding({ root, manifestPath: 'review/manifest.json', expectedManifestSha256: sha(manifestBytes) });
  const bindingBytes = JSON.stringify(binding) + '\n'; await put('review/binding.json', bindingBytes);
  return { binding, bindingBytes, manifest, manifestBytes };
}

test('stages without replacing live output and promotes only doubly accepted current bytes', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'owner-stage-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const put = async (file: string, bytes: string) => { await fs.mkdir(path.dirname(path.join(root, file)), { recursive: true }); await fs.writeFile(path.join(root, file), bytes); };
  const livePath = 'public/canal-drive/data/case22-gable-city-preview.json', inputPath = 'inputs/correction.json';
  const prior = '{"accepted":"prior"}\n', input = '{"bounded":true}\n', sourceSha = sha('source');
  const packet = JSON.stringify({ target: { caseId: 'case-22' }, provenance: { source: { cropSha256: sourceSha } }, candidate: 'new' }) + '\n';
  await put(livePath, prior); await put(inputPath, input);
  const staged = await stageOwnerCandidateOutput({ root, caseId: 'case22', packetText: packet, livePublicPath: livePath, inputBindings: [{ path: inputPath, sha256: sha(input) }] });
  assert.equal(await fs.readFile(path.join(root, livePath), 'utf8'), prior);
  assert.equal(await fs.readFile(path.join(root, staged.stagePath), 'utf8'), packet);

  const { bindingBytes: binding } = await reviewFixture(root, staged);
  const vote = (role: string, reviewer: string) => JSON.stringify({ kind: 'staged-owner-output-review', role, reviewer, decision: 'accept', stageManifestSha256: staged.stageManifestSha256, packetSha256: staged.packetSha256, reviewArtifactBindingSha256: sha(binding) }) + '\n';
  const rootVote = vote('root', 'root'), independentVote = vote('independent', 'luna');
  await put('review/root.json', rootVote); await put('review/independent.json', independentVote);
  const args = { root, stageManifestPath: staged.stageManifestPath, expectedStageManifestSha256: staged.stageManifestSha256, expectedLiveSha256: staged.expectedLiveSha256, reviewArtifactBinding: { path: 'review/binding.json', sha256: sha(binding) }, acceptance: { root: { path: 'review/root.json', sha256: sha(rootVote) }, independent: { path: 'review/independent.json', sha256: sha(independentVote) } } };
  const result = await promoteStagedOwnerOutput(args);
  assert.equal(await fs.readFile(path.join(root, livePath), 'utf8'), packet);
  assert.equal(await fs.readFile(path.join(root, result.priorArchivePath!), 'utf8'), prior);
  await assert.rejects(promoteStagedOwnerOutput(args), /Live packet changed/);
});

test('rejects changed inputs, stale live output, unbound review and one-person acceptance', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'owner-stage-guards-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const put = async (file: string, bytes: string) => { await fs.mkdir(path.dirname(path.join(root, file)), { recursive: true }); await fs.writeFile(path.join(root, file), bytes); };
  const livePath = 'public/canal-drive/data/case22-gable-city-preview.json';
  await put('input.json', 'input'); await put(livePath, 'live');
  const packet = JSON.stringify({ target: { caseId: 'case-22' }, provenance: { source: { cropSha256: sha('source') } } }) + '\n';
  const staged = await stageOwnerCandidateOutput({ root, caseId: 'case22', packetText: packet, livePublicPath: livePath, inputBindings: [{ path: 'input.json', sha256: sha('input') }] });
  const fixture = await reviewFixture(root, staged), binding = fixture.bindingBytes;
  const vote = (role: string, reviewer: string) => JSON.stringify({ kind: 'staged-owner-output-review', role, reviewer, decision: 'accept', stageManifestSha256: staged.stageManifestSha256, packetSha256: staged.packetSha256, reviewArtifactBindingSha256: sha(binding) });
  const rootVote = vote('root', 'same'), badIndependent = vote('independent', 'same'), independentVote = vote('independent', 'luna');
  await put('root.json', rootVote); await put('independent.json', badIndependent);
  const args = { root, stageManifestPath: staged.stageManifestPath, expectedStageManifestSha256: staged.stageManifestSha256, expectedLiveSha256: staged.expectedLiveSha256, reviewArtifactBinding: { path: 'review/binding.json', sha256: sha(binding) }, acceptance: { root: { path: 'root.json', sha256: sha(rootVote) }, independent: { path: 'independent.json', sha256: sha(badIndependent) } } };
  await assert.rejects(promoteStagedOwnerOutput(args), /Distinct root and independent/);
  await put('independent.json', independentVote);
  const acceptedArgs = { ...args, acceptance: { ...args.acceptance, independent: { path: 'independent.json', sha256: sha(independentVote) } } };
  await put('input.json', 'changed');
  await assert.rejects(promoteStagedOwnerOutput(acceptedArgs), /Staged input changed/);
  await put('input.json', 'input'); await put(livePath, 'changed');
  await assert.rejects(promoteStagedOwnerOutput(acceptedArgs), /Live packet changed/);
  await put(livePath, 'live'); await put('review/source-aligned-candidate-source-0.png', 'changed capture');
  await assert.rejects(promoteStagedOwnerOutput(acceptedArgs), /Capture mismatch/);
  await put('review/source-aligned-candidate-source-0.png', 'source-aligned-candidate-source-0.png'); await put('viewer.js', 'changed renderer');
  await assert.rejects(promoteStagedOwnerOutput(acceptedArgs), /Stale live input/);
});
