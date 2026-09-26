import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { routingBindingDisposition } from './routing-result-bindings.mjs';
import { collectReusableRoutingIds } from './collect-routing-reuse.mjs';

const sha = value => crypto.createHash('sha256').update(value).digest('hex');
const root = await fs.mkdtemp(path.join(os.tmpdir(), 'routing-binding-'));
const bytes = { full: Buffer.from('full crop'), ground: Buffer.from('ground crop') };
const record = { id: 'frontage-1', buildingId: 'bag-1', images: {
  full: { file: 'source-full.jpg', sha256: sha(bytes.full) }, ground: { file: 'source-ground.jpg', sha256: sha(bytes.ground) },
} };
const manifest = { records: [record] }, manifestBytes = Buffer.from(JSON.stringify(manifest)), manifestHash = sha(manifestBytes);
const input = { id: record.id, buildingId: record.buildingId, images: {
  full: { file: 'compact-full.jpg', sourceSha256: record.images.full.sha256, sha256: sha(bytes.full) },
  ground: { file: 'compact-ground.jpg', sourceSha256: record.images.ground.sha256, sha256: sha(bytes.ground) },
} };
const result = { id: record.id, buildingId: record.buildingId, status: 'ok', requestImages: [
  { kind: 'full', sha256: input.images.full.sha256 }, { kind: 'ground', sha256: input.images.ground.sha256 },
], proposal: { family: 'historic-narrow' } };
const inputs = { inputSetHash: 'old-input', manifestSha256: manifestHash, items: [input] };
const report = { inputSetHash: 'old-input', results: [result] };

assert.equal(routingBindingDisposition(record, result, inputs, report, manifestHash), 'bound');
assert.equal(routingBindingDisposition(record, result, { ...inputs, inputSetHash: 'changed-request' }, report, manifestHash), 'stale-input-manifest');
assert.equal(routingBindingDisposition(record, { ...result, requestImages: [{ kind: 'full', sha256: 'wrong' }, result.requestImages[1]] }, inputs, report, manifestHash), 'crop-binding-mismatch');
assert.equal('signText' in result.proposal, false, 'legacy routing proposals do not imply a literal sign observation');

async function writeSet(area, selection, inputSet, { valid = true, sourceManifest = true, duplicate = false } = {}) {
  const base = path.join(root, area, 'panorama-audit', selection), evidence = path.join(base, 'evidence');
  await fs.mkdir(path.join(evidence, 'images'), { recursive: true });
  await fs.writeFile(path.join(evidence, 'manifest.json'), manifestBytes);
  for (const image of Object.values(record.images)) await fs.writeFile(path.join(evidence, 'images', image.file), bytes[image.file.includes('full') ? 'full' : 'ground']);
  await fs.writeFile(path.join(base, 'automated-preflight.json'), JSON.stringify({ manifestSha256: sourceManifest ? manifestHash : 'bad-manifest' }));
  const dir = path.join(base, 'routing-inputs', inputSet); await fs.mkdir(path.join(dir, 'images'), { recursive: true });
  for (const image of Object.values(input.images)) await fs.writeFile(path.join(dir, 'images', image.file), bytes[image.file.includes('full') ? 'full' : 'ground']);
  const localInputs = { ...inputs, inputSetHash: inputSet };
  const localResult = valid ? result : { ...result, requestImages: [{ kind: 'full', sha256: 'changed-crop' }, result.requestImages[1]] };
  await fs.writeFile(path.join(dir, 'manifest.json'), JSON.stringify(localInputs));
  await fs.mkdir(path.join(dir, 'machine-routing'), { recursive: true });
  await fs.writeFile(path.join(dir, 'machine-routing', 'results.json'), JSON.stringify({ inputSetHash: inputSet, results: duplicate ? [localResult, localResult] : [localResult] }));
}

await writeSet('area-a', 'selection-valid', 'old-input', { duplicate: true });
await writeSet('area-a', 'selection-bad-manifest', 'bad-manifest', { sourceManifest: false });
await writeSet('area-b', 'selection-changed-crop', 'changed-crop', { valid: false });
await writeSet('area-b', 'selection-current', 'current-input');
assert.deepEqual(await collectReusableRoutingIds('current-input', root), ['frontage-1'], 'only byte- and identity-bound, non-current records are reusable; duplicates dedupe');
await fs.rm(root, { recursive: true, force: true });
console.log('Routing result bindings: exact request/source binding, stale and corrupt isolation, legacy signs, duplicate dedupe and current-input exclusion passed.');
