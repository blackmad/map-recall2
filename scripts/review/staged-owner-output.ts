import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { checkReviewArtifactBinding } from './check-review-artifact-binding.mjs';

const sha256 = (bytes: Buffer | string) => createHash('sha256').update(bytes).digest('hex');
const SHA256 = /^[a-f0-9]{64}$/;

export type StagedInputBinding = { path: string; sha256: string; snapshot?: string };

export type OwnerOutputStageManifest = {
  version: 1;
  kind: 'staged-owner-output';
  caseId: string;
  packetPath: string;
  stagePublicPath: string;
  packetSha256: string;
  livePublicPath: string;
  expectedLiveSha256: string | null;
  inputBindings: StagedInputBinding[];
};

const LIVE_PATHS: Record<string, string> = {
  case20: 'public/canal-drive/data/case20-dormer-city-preview.json',
  case22: 'public/canal-drive/data/case22-gable-city-preview.json',
  case25: 'public/canal-drive/data/case25-flat-city-preview.json',
  case30: 'public/canal-drive/data/case30-glazed-balcony-door-preview.json',
};

function relativeSafe(file: string, label: string) {
  if (path.isAbsolute(file) || file.split(/[\\/]/).includes('..')) throw Error(`${label} must be a root-relative path`);
  return file;
}

async function readIfPresent(file: string) {
  try { return await fs.readFile(file); } catch (error: any) { if (error?.code === 'ENOENT') return null; throw error; }
}

async function writeImmutable(file: string, bytes: Buffer | string) {
  const prior = await readIfPresent(file);
  if (prior && !prior.equals(Buffer.from(bytes))) throw Error(`Immutable staged output differs: ${file}`);
  if (!prior) { await fs.mkdir(path.dirname(file), { recursive: true }); await fs.writeFile(file, bytes, { flag: 'wx' }); }
}

export async function stageOwnerCandidateOutput({
  root = '.', caseId, packetText, livePublicPath, inputBindings,
}: {
  root?: string; caseId: string; packetText: string; livePublicPath: string; inputBindings: StagedInputBinding[];
}) {
  if (!/^[a-zA-Z0-9_-]+$/.test(caseId)) throw Error('Invalid staged case id');
  relativeSafe(livePublicPath, 'Live public path');
  if (LIVE_PATHS[caseId] !== livePublicPath) throw Error('Live public path is not the pinned cohort destination');
  if (!packetText.endsWith('\n')) throw Error('Candidate packet must use canonical trailing newline');
  const bindings = [...inputBindings].sort((a, b) => a.path.localeCompare(b.path));
  if (bindings.length === 0 || new Set(bindings.map(item => item.path)).size !== bindings.length) throw Error('Unique staged input bindings are required');
  const inputBytes = new Map<string, Buffer>();
  for (const input of bindings) {
    relativeSafe(input.path, 'Input path');
    const bytes = await fs.readFile(path.resolve(root, input.path));
    if (!SHA256.test(input.sha256) || sha256(bytes) !== input.sha256) throw Error(`Staged input hash mismatch: ${input.path}`);
    inputBytes.set(input.path, bytes);
  }
  const packetSha256 = sha256(packetText);
  const stageDirectory = `review-data/staged-owner-output/${caseId}/${packetSha256}`;
  const packetPath = `${stageDirectory}/packet.json`;
  const stagePublicPath = `public/canal-drive/data/staged-owner-output/${caseId}/${packetSha256}/packet.json`;
  const liveBytes = await readIfPresent(path.resolve(root, livePublicPath));
  const archivedBindings = bindings.map(input => ({ ...input, snapshot: `review-data/staged-owner-output/inputs/${input.sha256}/${path.basename(input.path)}` }));
  const manifest: OwnerOutputStageManifest = {
    version: 1, kind: 'staged-owner-output', caseId, packetPath, stagePublicPath, packetSha256, livePublicPath,
    expectedLiveSha256: liveBytes ? sha256(liveBytes) : null,
    inputBindings: archivedBindings,
  };
  const manifestText = JSON.stringify(manifest, null, 2) + '\n';
  const stageManifestPath = `${stageDirectory}/stage.json`;
  await writeImmutable(path.resolve(root, packetPath), packetText);
  await writeImmutable(path.resolve(root, stagePublicPath), packetText);
  for (const input of archivedBindings) await writeImmutable(path.resolve(root, input.snapshot!), inputBytes.get(input.path)!);
  await writeImmutable(path.resolve(root, stageManifestPath), manifestText);
  return { stagePath: packetPath, stagePublicPath, stageManifestPath, stageManifestSha256: sha256(manifestText), packetSha256, livePublicPath, expectedLiveSha256: manifest.expectedLiveSha256, activated: false };
}

export async function promoteStagedOwnerOutput({
  root = '.', stageManifestPath, expectedStageManifestSha256, expectedLiveSha256,
  reviewArtifactBinding, acceptance,
}: {
  root?: string; stageManifestPath: string; expectedStageManifestSha256: string; expectedLiveSha256: string | null;
  reviewArtifactBinding: { path: string; sha256: string };
  acceptance: { root: { path: string; sha256: string }; independent: { path: string; sha256: string } };
}) {
  if (!SHA256.test(expectedStageManifestSha256)) throw Error('Expected staged manifest SHA256 is required');
  relativeSafe(stageManifestPath, 'Stage manifest path');
  const manifestBytes = await fs.readFile(path.resolve(root, stageManifestPath));
  if (sha256(manifestBytes) !== expectedStageManifestSha256) throw Error('Staged manifest SHA256 mismatch');
  const manifest = JSON.parse(manifestBytes.toString()) as OwnerOutputStageManifest;
  if (manifest.kind !== 'staged-owner-output' || manifest.version !== 1) throw Error('Unsupported staged owner output');
  if (LIVE_PATHS[manifest.caseId] !== manifest.livePublicPath) throw Error('Stage destination is not the pinned cohort live path');
  if (manifest.expectedLiveSha256 !== expectedLiveSha256) throw Error('Expected live SHA256 is not bound to this stage');
  const packetBytes = await fs.readFile(path.resolve(root, relativeSafe(manifest.packetPath, 'Staged packet path')));
  if (sha256(packetBytes) !== manifest.packetSha256) throw Error('Staged packet hash mismatch');
  const packet = JSON.parse(packetBytes.toString());
  if (packet.target?.caseId !== manifest.caseId.replace(/^case(?=\d)/, 'case-')) throw Error('Staged packet case binding mismatch');
  if (sha256(await fs.readFile(path.resolve(root, relativeSafe(manifest.stagePublicPath, 'Staged public packet path')))) !== manifest.packetSha256) throw Error('Staged public packet hash mismatch');
  for (const input of manifest.inputBindings) {
    if (!input.snapshot || sha256(await fs.readFile(path.resolve(root, relativeSafe(input.snapshot, 'Input snapshot path')))) !== input.sha256) throw Error(`Archived staged input changed: ${input.path}`);
    if (sha256(await fs.readFile(path.resolve(root, relativeSafe(input.path, 'Input path')))) !== input.sha256) throw Error(`Staged input changed: ${input.path}`);
  }
  const livePath = path.resolve(root, relativeSafe(manifest.livePublicPath, 'Live public path'));
  let liveBytes = await readIfPresent(livePath);
  let liveSha = liveBytes ? sha256(liveBytes) : null;
  if (liveSha !== expectedLiveSha256) throw Error('Live packet changed since staging');

  for (const record of [reviewArtifactBinding, acceptance.root, acceptance.independent]) {
    relativeSafe(record.path, 'Review record path');
    if (!SHA256.test(record.sha256) || sha256(await fs.readFile(path.resolve(root, record.path))) !== record.sha256) throw Error(`Review record hash mismatch: ${record.path}`);
  }
  const binding = JSON.parse(await fs.readFile(path.resolve(root, reviewArtifactBinding.path), 'utf8'));
  if (binding.kind !== 'review-artifact-binding' || binding.packetSha256 !== manifest.packetSha256 || binding.status !== 'current-inputs-and-archived-captures-match') throw Error('Review artifact binding does not certify this staged packet');
  const freshBinding = await checkReviewArtifactBinding({ root, manifestPath: binding.manifestPath, expectedManifestSha256: binding.manifestSha256 });
  if (freshBinding.packetSha256 !== manifest.packetSha256 || freshBinding.sourceSha256 !== binding.sourceSha256) throw Error('Fresh review artifact verification does not match this staged packet');
  const rootVote = JSON.parse(await fs.readFile(path.resolve(root, acceptance.root.path), 'utf8'));
  const independentVote = JSON.parse(await fs.readFile(path.resolve(root, acceptance.independent.path), 'utf8'));
  for (const [role, vote] of [['root', rootVote], ['independent', independentVote]] as const) {
    if (vote.kind !== 'staged-owner-output-review' || vote.role !== role || vote.decision !== 'accept' || !vote.reviewer || vote.stageManifestSha256 !== expectedStageManifestSha256 || vote.packetSha256 !== manifest.packetSha256 || vote.reviewArtifactBindingSha256 !== reviewArtifactBinding.sha256) throw Error(`${role} acceptance is not bound to this stage and review artifact`);
  }
  if (rootVote.reviewer === independentVote.reviewer) throw Error('Distinct root and independent reviewers are required');

  await fs.mkdir(path.dirname(livePath), { recursive: true });
  const lock = `${livePath}.promotion.lock`;
  const lockHandle = await fs.open(lock, 'wx').catch(() => { throw Error('Another promotion is in progress'); });
  let temporary: string | null = null;
  try {
    liveBytes = await readIfPresent(livePath); liveSha = liveBytes ? sha256(liveBytes) : null;
    if (liveSha !== expectedLiveSha256) throw Error('Live packet changed before atomic promotion');
    let priorArchivePath: string | null = null;
    if (liveBytes) {
      priorArchivePath = `review-data/staged-owner-output/prior/${manifest.caseId}/${liveSha}/packet.json`;
      await writeImmutable(path.resolve(root, priorArchivePath), liveBytes);
    }
    temporary = `${livePath}.promote-${process.pid}-${Date.now()}`;
    await fs.writeFile(temporary, packetBytes, { flag: 'wx' });
    await fs.rename(temporary, livePath); temporary = null;
    return { promoted: true, livePublicPath: manifest.livePublicPath, packetSha256: manifest.packetSha256, priorSha256: liveSha, priorArchivePath };
  } finally {
    await lockHandle.close();
    if (temporary) await fs.rm(temporary, { force: true });
    await fs.rm(lock, { force: true });
  }
}
