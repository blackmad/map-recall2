import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';

const CASES = 'public/data/facade-repair-preview/cases.json';
const REVISIONS = 'public/data/facade-repair-preview/revisions';
const HEX = /^[a-f0-9]{64}$/;

const digest = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');
const absolute = (root: string, rel: string) => path.resolve(root, rel);

async function archiveExact(file: string, expected: string, bytes: Buffer) {
  if (digest(bytes) !== expected) throw Error(`archive bytes do not match ${expected}`);
  try {
    const prior = await fs.readFile(file);
    if (digest(prior) !== expected || !prior.equals(bytes)) throw Error(`corrupt or conflicting revision archive: ${file}`);
    return false;
  } catch (error: any) {
    if (error?.code !== 'ENOENT') throw error;
  }
  await fs.writeFile(file, bytes, { flag: 'wx', mode: 0o644 });
  return true;
}

function validatePreviewPacket(bytes: Buffer, current: Buffer) {
  let proposed: any, active: any;
  try { proposed = JSON.parse(bytes.toString('utf8')); active = JSON.parse(current.toString('utf8')); }
  catch { throw Error('proposed preview packet is not valid JSON'); }
  if (!proposed || typeof proposed !== 'object' || proposed.previewOnly !== true || !Array.isArray(proposed.cases) || proposed.cases.length === 0)
    throw Error('proposed preview packet must be a non-empty previewOnly packet');
  if (!active || !Array.isArray(active.cases) || active.cases.length === 0)
    throw Error('current preview packet is missing case IDs');
  const ids = (packet: any) => packet.cases.map((item: any) => item?.caseId).filter((id: any) => typeof id === 'string' && id.length > 0);
  const proposedIds = ids(proposed), activeIds = ids(active);
  if (proposedIds.length !== proposed.cases.length || new Set(proposedIds).size !== proposedIds.length)
    throw Error('proposed preview packet has missing or duplicate case IDs');
  if (activeIds.length !== active.cases.length || new Set(activeIds).size !== activeIds.length || activeIds.length !== proposedIds.length || activeIds.some((id: string) => !proposedIds.includes(id)))
    throw Error('proposed preview packet must retain every current case ID');
}

export interface PublishedPreviewRevision {
  currentSha256: string;
  proposedSha256: string;
  currentArchived: boolean;
  proposedArchived: boolean;
  casesPath: string;
}

/**
 * Publish a candidate packet only when the caller's expected packet is still
 * current. Both byte-identical packets are retained in an immutable archive.
 * This helper never edits notes, checks, provenance, or an active release.
 */
export async function publishPreviewRevision(root: string, expectedCurrentSha256: string, proposed: Buffer | string): Promise<PublishedPreviewRevision> {
  if (!HEX.test(expectedCurrentSha256)) throw Error('invalid expected current preview SHA-256');
  root = path.resolve(root);
  const casesPath = absolute(root, CASES), revisionDir = absolute(root, REVISIONS);
  const lockPath = `${casesPath}.publish.lock`;
  let lock: import('node:fs/promises').FileHandle | undefined;
  try { lock = await fs.open(lockPath, 'wx'); }
  catch (error: any) { if (error?.code === 'EEXIST') throw Error('preview publication already in progress'); throw error; }
  try {
    const current = await fs.readFile(casesPath);
    const currentSha256 = digest(current);
    if (currentSha256 !== expectedCurrentSha256) throw Error(`current preview changed: expected ${expectedCurrentSha256}, found ${currentSha256}`);
    const proposedBytes = Buffer.isBuffer(proposed) ? Buffer.from(proposed) : await fs.readFile(path.resolve(proposed));
    validatePreviewPacket(proposedBytes, current);
    const proposedSha256 = digest(proposedBytes);
    await fs.mkdir(revisionDir, { recursive: true });
    const currentArchived = await archiveExact(path.join(revisionDir, `${currentSha256}.json`), currentSha256, current);
    const proposedArchived = await archiveExact(path.join(revisionDir, `${proposedSha256}.json`), proposedSha256, proposedBytes);
    const temporary = path.join(path.dirname(casesPath), `.cases-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}.tmp`);
    try {
      await fs.writeFile(temporary, proposedBytes, { flag: 'wx', mode: 0o644 });
      const currentAgain = await fs.readFile(casesPath);
      if (digest(currentAgain) !== expectedCurrentSha256) throw Error('current preview changed while staging; refusing publication');
      await fs.rename(temporary, casesPath);
    } catch (error) {
      await fs.rm(temporary, { force: true });
      throw error;
    }
    return { currentSha256, proposedSha256, currentArchived, proposedArchived, casesPath };
  } finally {
    await lock.close();
    await fs.rm(lockPath, { force: true });
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [root = process.cwd(), expected, proposed] = process.argv.slice(2);
  if (!expected || !proposed) throw Error('usage: publish-preview-revision <root> <expected-sha256> <proposed-json-path>');
  publishPreviewRevision(root, expected, proposed).then(result => console.log(JSON.stringify(result, null, 2))).catch(error => { console.error(error.message); process.exitCode = 1; });
}
