import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { publishPreviewRevision } from './publish-preview-revision';
import { planReviewSnapshot } from './review-snapshot';

const sha = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');

async function fixture() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'preview-revision-'));
  const cases = path.join(root, 'public/data/facade-repair-preview/cases.json');
  await fs.mkdir(path.dirname(cases), { recursive: true });
  const current = Buffer.from('{"version":1,"previewOnly":true,"cases":[{"caseId":"case-24"}]}\n');
  await fs.writeFile(cases, current);
  return { root, cases, current };
}

test('archives exact current and proposed packets then atomically publishes', async t => {
  const { root, cases, current } = await fixture(); t.after(() => fs.rm(root, { recursive: true, force: true }));
  const proposed = Buffer.from('{"version":1,"previewOnly":true,"cases":[{"caseId":"case-24","roof":"triangular-gable"}]}\n');
  const result = await publishPreviewRevision(root, sha(current), proposed);
  assert.equal(result.currentSha256, sha(current)); assert.equal(result.proposedSha256, sha(proposed));
  assert.deepEqual(await fs.readFile(cases), proposed);
  assert.deepEqual(await fs.readFile(path.join(root, 'public/data/facade-repair-preview/revisions', `${sha(current)}.json`)), current);
  assert.deepEqual(await fs.readFile(path.join(root, 'public/data/facade-repair-preview/revisions', `${sha(proposed)}.json`)), proposed);
  const second = await publishPreviewRevision(root, sha(proposed), proposed);
  assert.equal(second.currentArchived, false); assert.equal(second.proposedArchived, false);
});

test('refuses stale expected SHA and corrupt immutable archive', async t => {
  const { root, cases, current } = await fixture(); t.after(() => fs.rm(root, { recursive: true, force: true }));
  const proposed = Buffer.from('{"version":1,"previewOnly":true,"cases":[{"caseId":"case-24"}]}\n'), old = Buffer.from('bad');
  await assert.rejects(publishPreviewRevision(root, '0'.repeat(64), proposed), /changed/);
  const rev = path.join(root, 'public/data/facade-repair-preview/revisions'); await fs.mkdir(rev, { recursive: true });
  await fs.writeFile(path.join(rev, `${sha(current)}.json`), old);
  await assert.rejects(publishPreviewRevision(root, sha(current), proposed), /corrupt or conflicting/);
  assert.deepEqual(await fs.readFile(cases), current);
});

test('snapshot resolves a note bound to an archived prior packet', async t => {
  const { root, current } = await fixture(); t.after(() => fs.rm(root, { recursive: true, force: true }));
  const prior = Buffer.from('{"version":1,"previewOnly":true,"cases":[{"caseId":"case-24","old":true}]}\n');
  const priorSha = sha(prior); const rev = path.join(root, 'public/data/facade-repair-preview/revisions');
  await fs.mkdir(path.join(root, '.cache/city-appearance/repair-preview-notes'), { recursive: true }); await fs.mkdir(rev, { recursive: true });
  await fs.writeFile(path.join(rev, `${priorSha}.json`), prior);
  await fs.writeFile(path.join(root, '.cache/city-appearance/repair-preview-notes', 'prior.json'), JSON.stringify({ packetSha256: priorSha }));
  const plan = await planReviewSnapshot(root);
  assert.ok(plan.entries.some(entry => entry.path.endsWith(`/revisions/${priorSha}.json`)));
  assert.ok(!plan.missingBindings.some(message => message.includes('prior.json')));
  assert.equal(sha(current), sha(await fs.readFile(path.join(root, 'public/data/facade-repair-preview/cases.json'))));
});

test('cooperative lock permits exactly one competing publication', async t => {
  const { root, current } = await fixture(); t.after(() => fs.rm(root, { recursive: true, force: true }));
  const proposed = Buffer.from('{"version":1,"previewOnly":true,"cases":[{"caseId":"case-24","winner":true}]}\n');
  const results = await Promise.allSettled([
    publishPreviewRevision(root, sha(current), proposed),
    publishPreviewRevision(root, sha(current), proposed),
  ]);
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
  assert.equal(results.filter(result => result.status === 'rejected' && /already in progress/.test(String((result as PromiseRejectedResult).reason))).length, 1);
});
