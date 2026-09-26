/** Verify the exact capture set assigned to a critic. This is not visual acceptance. */
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const requiredCaptures = [
  'source-aligned-source-100.png', 'source-aligned-baseline-source-0.png',
  'source-aligned-candidate-source-0.png', 'source-aligned-candidate-source-50.png',
  'candidate-oblique-no-context.png', 'wide-street-baseline-source-0.png',
  'wide-street-candidate-source-0.png',
];

export async function checkReviewArtifactBinding({ root = '.', manifestPath, expectedManifestSha256 }) {
  if (!/^[a-f0-9]{64}$/.test(expectedManifestSha256 ?? '')) throw Error('An independently supplied expected manifest SHA256 is required');
  const read = file => fs.readFile(path.resolve(root, file));
  const bytes = await read(manifestPath);
  if (digest(bytes) !== expectedManifestSha256) throw Error('Assigned manifest SHA256 mismatch');
  const manifest = JSON.parse(bytes);
  if (manifest.kind !== 'source-to-owner-city-preview-review') throw Error('Unsupported capture manifest');
  if (!Array.isArray(manifest.inputs) || manifest.inputs.length < 4) throw Error('Missing pinned inputs');
  if (!Array.isArray(manifest.captures) || manifest.captures.length !== requiredCaptures.length) throw Error('Incomplete capture set');
  for (const name of requiredCaptures) {
    if (manifest.captures.filter(item => path.basename(item.path) === name).length !== 1) throw Error(`Missing or duplicate capture: ${name}`);
  }
  for (const input of manifest.inputs) {
    if (!input.snapshot || digest(await read(input.snapshot)) !== input.sha256) throw Error(`Archived input mismatch: ${input.path}`);
    if (digest(await read(input.path)) !== input.sha256) throw Error(`Stale live input: ${input.path}`);
  }
  for (const capture of manifest.captures) {
    if (digest(await read(capture.path)) !== capture.sha256) throw Error(`Capture mismatch: ${capture.path}`);
  }
  const source = manifest.inputs.find(input => input.path === `public${manifest.source?.publicCropUrl}`);
  if (!source || source.sha256 !== manifest.source.cropSha256) throw Error('Source binding mismatch');
  const packets = manifest.inputs.filter(input => input.path.endsWith('.json'));
  if (packets.length !== 1) throw Error('Expected one pinned candidate packet');
  const packet = JSON.parse(await read(packets[0].snapshot));
  if (packet.target?.caseId !== manifest.caseId || packet.provenance?.source?.cropSha256 !== source.sha256) throw Error('Packet case/source mismatch');
  return {
    kind: 'review-artifact-binding', version: 1, checkedAt: new Date().toISOString(),
    manifestPath, manifestSha256: expectedManifestSha256, caseId: manifest.caseId,
    packetSha256: packets[0].sha256, sourceSha256: source.sha256,
    inputs: manifest.inputs, captures: manifest.captures,
    status: 'current-inputs-and-archived-captures-match',
    limitation: 'Byte binding only. The critic must inspect these images; this does not certify visual fidelity.',
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const [manifestPath, expectedManifestSha256] = process.argv.slice(2);
  checkReviewArtifactBinding({ manifestPath, expectedManifestSha256 })
    .then(result => console.log(JSON.stringify(result, null, 2)))
    .catch(error => { console.error(error.message); process.exitCode = 1; });
}
