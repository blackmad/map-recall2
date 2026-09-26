import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test, { after } from 'node:test';
import { createHash } from 'node:crypto';
import { createReviewSnapshot, planReviewSnapshot, restoreReviewSnapshot, verifyReviewSnapshot } from './review-snapshot';

const roots: string[] = [];
after(async () => { for (const root of roots) await fs.rm(root, { recursive: true, force: true }); });
const sha = (b: string) => createHash('sha256').update(b).digest('hex');
async function setup() {
  const root = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'review-snapshot-'))); roots.push(root);
  const write = async (file: string, value: string | object) => {
    await fs.mkdir(path.dirname(path.join(root, file)), { recursive: true });
    await fs.writeFile(path.join(root, file), typeof value === 'string' ? value : JSON.stringify(value));
  };
  await write('.cache/city-appearance/review-notes/a.json', '{"text":"literal bytes \\u00e9"}\n');
  await write('public/data/city-expansion/current.json', { releaseId: 'r' });
  await write('scripts/review/thousand-building-candidate-report.json', { stagedReleaseId: 's' });
  return { root, write };
}

test('snapshot preserves exact bytes, verifies and restores only into an empty directory', async () => {
  const { root } = await setup(), made = await createReviewSnapshot(root);
  assert.equal((await verifyReviewSnapshot(made.directory)).valid, true);
  assert.equal((await createReviewSnapshot(root)).directory, made.directory);
  const out = path.join(root, 'restored'); await restoreReviewSnapshot(made.directory, out);
  assert.equal(await fs.readFile(path.join(out, '.cache/city-appearance/review-notes/a.json'), 'utf8'), '{"text":"literal bytes \\u00e9"}\n');
  await assert.rejects(restoreReviewSnapshot(made.directory, out), /empty/);
  await assert.rejects(createReviewSnapshot(root, '.cache/bad'), /outside/);
  await assert.rejects(createReviewSnapshot(root, 'public/bad'), /outside/);
});

test('payload corruption and missing-binding metadata tampering independently fail verification', async () => {
  const { root } = await setup(), made = await createReviewSnapshot(root);
  const file = path.join(made.directory, 'manifest.json'), original = await fs.readFile(file);
  const manifest = JSON.parse(original.toString()); manifest.missingBindings = ['tampered'];
  await fs.writeFile(file, JSON.stringify(manifest)); assert.equal((await verifyReviewSnapshot(made.directory)).valid, false);
  await fs.writeFile(file, original); assert.equal((await verifyReviewSnapshot(made.directory)).valid, true);
  await fs.writeFile(path.join(made.directory, 'files/.cache/city-appearance/review-notes/a.json'), 'corrupt');
  assert.equal((await verifyReviewSnapshot(made.directory)).valid, false);
  await assert.rejects(createReviewSnapshot(root), /exists/);
});

test('symlink source folders, snapshot files roots and destinations are rejected', async () => {
  const { root } = await setup(), made = await createReviewSnapshot(root);
  const files = path.join(made.directory, 'files'), moved = path.join(root, 'moved-files');
  await fs.rename(files, moved); await fs.symlink(moved, files, 'dir');
  assert.equal((await verifyReviewSnapshot(made.directory)).valid, false);
  await fs.unlink(files); await fs.rename(moved, files);
  const empty = path.join(root, 'empty'), linked = path.join(root, 'linked');
  await fs.mkdir(empty); await fs.symlink(empty, linked, 'dir');
  await assert.rejects(restoreReviewSnapshot(made.directory, linked), /symlink/);
  await assert.rejects(createReviewSnapshot(root, path.join(linked, 'snapshot')), /symlink/);
  const source = path.join(root, '.cache/city-appearance/review-notes'), elsewhere = path.join(root, 'elsewhere');
  await fs.rename(source, elsewhere); await fs.symlink(elsewhere, source, 'dir');
  await assert.rejects(planReviewSnapshot(root), /symlink/);
});

test('district binding uses release ID and packet hash; invalid identity stays missing', async () => {
  const { root, write } = await setup(), releaseId = 'a'.repeat(64), bytes = '{"cases":[]}\n';
  await write(`public/data/city-expansion/evaluations/${releaseId}/comparison-packet.json`, bytes);
  await write('.cache/city-appearance/review-notes/a.json', { releaseId, packetSha256: sha(bytes) });
  let plan = await planReviewSnapshot(root);
  assert.ok(plan.entries.some(e => e.path.endsWith(`${releaseId}/comparison-packet.json`)));
  await write('.cache/city-appearance/review-notes/a.json', { releaseId: '../../outside', packetSha256: sha(bytes) });
  plan = await planReviewSnapshot(root);
  assert.ok(plan.missingBindings.some(m => m.includes('releaseId')));
  assert.ok(!plan.entries.some(e => e.path.endsWith('comparison-packet.json')));
});

test('router labels retain only the matching allowlisted manifest', async () => {
  const { root, write } = await setup(), datasetId = 'b'.repeat(64), prefix = '.cache/facade-rebuild/router-review';
  const manifest = { schemaVersion: 1, datasetId, generatedAt: '2026-09-13', tasks: [], items: [], attribution: [], note: '' };
  await write(`${prefix}/labels.json`, { datasetId, labels: {} }); await write(`${prefix}/manifest.json`, manifest);
  const good = await planReviewSnapshot(root); assert.ok(good.entries.some(e => e.path === `${prefix}/manifest.json`));
  await write(`${prefix}/manifest.json`, { ...manifest, datasetId: 'c'.repeat(64) });
  const mismatch = await planReviewSnapshot(root); assert.ok(!mismatch.entries.some(e => e.path === `${prefix}/manifest.json`));
  assert.ok(mismatch.missingBindings.some(m => m.includes('datasetId')));
  await write(`${prefix}/manifest.json`, { ...manifest, accessToken: 'do-not-archive' });
  assert.ok(!(await planReviewSnapshot(root)).entries.some(e => e.path === `${prefix}/manifest.json`));
});
