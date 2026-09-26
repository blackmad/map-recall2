/** Restartable offline review stage. It measures evidence and queues work; it never repairs or activates assets. */
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { collectProjectStatus } from './project-status.js';
import { createReviewSnapshot, planReviewSnapshot, verifyReviewSnapshot } from './review-snapshot.js';
import { buildSourceEvaluation } from '../city-appearance/quality-loop/source-evaluation.js';

const sha = (bytes: Buffer | string) => createHash('sha256').update(bytes).digest('hex');
const canonical = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(',')}}`;
  return JSON.stringify(value);
};
type Pin = { path: string; sha256: string };
async function checkPins(root: string, pins: Pin[]) {
  for (const pin of pins) if (sha(await fs.readFile(path.resolve(root, pin.path))) !== pin.sha256) throw Error(`Input changed during review: ${pin.path}`);
}
export async function runReconstructionReview(options: { root: string; write?: boolean; iouThreshold?: number }) {
  const root = path.resolve(options.root), iouThreshold = options.iouThreshold ?? .7;
  const [project, source, snapshotPlan] = await Promise.all([
    collectProjectStatus(root), buildSourceEvaluation({ root, iouThreshold }), planReviewSnapshot(root),
  ]);
  const pinned = [...Object.values(project.artifacts).flatMap(a => a.valid && a.sha256 ? [{ path: a.path, sha256: a.sha256 }] : []), ...(source.inputs.files as Pin[])];
  const versions = await Promise.all(['scripts/review/project-status.ts', 'scripts/review/review-snapshot.ts', 'scripts/review/run-reconstruction-review.ts', 'scripts/city-appearance/quality-loop/source-evaluation.ts'].map(async file => ({ path: file, sha256: sha(await fs.readFile(path.join(root, file))) })));
  const pins = [...new Map([...pinned, ...versions].map(pin => [pin.path, pin])).values()].sort((a, b) => a.path.localeCompare(b.path));
  const runId = sha(canonical({ version: 1, iouThreshold, pins, artifactStates: project.artifacts, sourceReportSha256: source.reproducibility.canonicalReportSha256, reviewSnapshotSha256: snapshotPlan.snapshotSha256 }));
  const directory = path.join(root, 'review-data/runs', runId);
  const plan = { version: 1, mode: 'offline-diagnostic' as const, runId, write: Boolean(options.write), paidCalls: 0, activationPerformed: false, repairsPerformed: 0,
    diagnostic: { iouThreshold, referenceCases: source.coverage.validReferenceCases, scorableCompleteReferences: source.coverage.scorableCompleteVisibleReferences, matchedReferences: source.summary.completeReferenceMatches, precision: null, metricRegistrationClaimed: false },
    repairQueue: source.repairQueue, snapshot: { sha256: snapshotPlan.snapshotSha256, entries: snapshotPlan.entries.length, missingBindings: snapshotPlan.missingBindings },
  };
  if (!options.write) return { ...plan, destination: path.relative(root, directory), reused: false };
  await checkPins(root, pins);
  const snapshot = await createReviewSnapshot(root);
  if (snapshot.manifest.snapshotSha256 !== snapshotPlan.snapshotSha256) throw Error('Review notes changed during collection; rerun against the new snapshot.');
  try {
    const manifest = JSON.parse(await fs.readFile(path.join(directory, 'manifest.json'), 'utf8'));
    const reportBytes = await fs.readFile(path.join(directory, 'report.json'));
    const report = JSON.parse(reportBytes.toString('utf8'));
    if (manifest.version !== 1 || manifest.runId !== runId || manifest.reportSha256 !== sha(reportBytes) || manifest.snapshotSha256 !== snapshotPlan.snapshotSha256 ||
        report.runId !== runId || canonical(report.pins) !== canonical(pins) || report.source?.reproducibility?.canonicalReportSha256 !== source.reproducibility.canonicalReportSha256 ||
        report.snapshot?.sha256 !== snapshotPlan.snapshotSha256) throw Error('Existing review run failed verification');
    const snapshotVerification = await verifyReviewSnapshot(snapshot.directory);
    if (!snapshotVerification.valid || snapshotVerification.manifest?.snapshotSha256 !== snapshotPlan.snapshotSha256) throw Error('Review snapshot failed verification');
    return { ...plan, directory, reused: true };
  } catch (error: any) { if (error.code !== 'ENOENT') throw error; }
  const stage = path.join(root, 'review-data/runs', `.staging-${randomUUID()}`);
  await fs.mkdir(stage, { recursive: true });
  try {
    const report = { ...plan, generatedAt: new Date().toISOString(), pins, project, source, snapshot: { path: path.relative(root, snapshot.directory), sha256: snapshot.manifest.snapshotSha256, missingBindings: snapshot.manifest.missingBindings } };
    const bytes = Buffer.from(`${JSON.stringify(report, null, 2)}\n`);
    await fs.writeFile(path.join(stage, 'report.json'), bytes, { flag: 'wx' });
    await fs.writeFile(path.join(stage, 'manifest.json'), `${JSON.stringify({ version: 1, runId, reportSha256: sha(bytes), snapshotSha256: snapshot.manifest.snapshotSha256 }, null, 2)}\n`, { flag: 'wx' });
    await checkPins(root, pins);
    await fs.rename(stage, directory);
    return { ...plan, directory, reused: false };
  } catch (error) { await fs.rm(stage, { recursive: true, force: true }); throw error; }
}

async function main() {
  const args = process.argv.slice(2); let root = process.cwd(), write = false, iouThreshold = .7;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--write') write = true;
    else if (args[i] === '--root' && args[i + 1] && !args[i + 1].startsWith('--')) root = args[++i];
    else if (args[i] === '--iou' && args[i + 1] && !args[i + 1].startsWith('--')) iouThreshold = Number(args[++i]);
    else if (args[i] === '--help') { console.log('Usage: npm run review:reconstruction -- [--root DIR] [--iou 0.7] [--write]\nDefault: read-only diagnostic plan. --write snapshots saved reviews and stages an immutable report; no paid inference or activation.'); return; }
    else throw Error(`Unknown or incomplete argument: ${args[i]}`);
  }
  console.log(JSON.stringify(await runReconstructionReview({ root, write, iouThreshold }), null, 2));
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) main().catch(error => { console.error(error.message); process.exitCode = 1; });
