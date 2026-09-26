import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { checkReviewArtifactBinding } from './check-review-artifact-binding.mjs';

const sha = bytes => createHash('sha256').update(bytes).digest('hex');
test('review binding rejects stale live candidates, changed captures and a different assigned manifest', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'review-binding-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const put = async (file, bytes) => {
    await fs.mkdir(path.dirname(path.join(root, file)), { recursive: true });
    await fs.writeFile(path.join(root, file), bytes);
  };
  const sourceBytes = 'source fixture';
  const source = { publicCropUrl: `/evidence/${sha(sourceBytes)}.jpg`, cropSha256: sha(sourceBytes) };
  const inputs = [];
  for (const [file, bytes] of [
    ['candidate.json', JSON.stringify({ target: { caseId: 'case-test' }, provenance: { source } })],
    ['viewer.js', 'bundle fixture'], ['viewer.html', 'html fixture'],
    [`public${source.publicCropUrl}`, sourceBytes],
  ]) {
    const snapshot = `archive/${sha(bytes)}/${path.basename(file)}`;
    await put(file, bytes); await put(snapshot, bytes);
    inputs.push({ path: file, sha256: sha(bytes), snapshot });
  }
  const captures = [];
  for (const name of ['source-aligned-source-100.png', 'source-aligned-baseline-source-0.png',
    'source-aligned-candidate-source-0.png', 'source-aligned-candidate-source-50.png',
    'candidate-oblique-no-context.png', 'wide-street-baseline-source-0.png', 'wide-street-candidate-source-0.png']) {
    await put(name, name); captures.push({ path: name, sha256: sha(name) });
  }
  const manifest = { kind: 'source-to-owner-city-preview-review', caseId: 'case-test', source, inputs, captures };
  const bytes = JSON.stringify(manifest);
  await put('manifest.json', bytes);
  const args = { root, manifestPath: 'manifest.json', expectedManifestSha256: sha(bytes) };
  assert.equal((await checkReviewArtifactBinding(args)).caseId, 'case-test');
  await assert.rejects(checkReviewArtifactBinding({ ...args, expectedManifestSha256: sha('old manifest') }), /Assigned manifest/);
  await put('candidate.json', '{}');
  await assert.rejects(checkReviewArtifactBinding(args), /Stale live input/);
  await put('candidate.json', await fs.readFile(path.join(root, inputs[0].snapshot)));
  await put(captures[2].path, 'new screenshot');
  await assert.rejects(checkReviewArtifactBinding(args), /Capture mismatch/);
  await put(captures[2].path, captures[2].path);
  await put(inputs[0].snapshot, '{}');
  await assert.rejects(checkReviewArtifactBinding(args), /Archived input mismatch/);
});
