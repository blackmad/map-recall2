/**
 * Refresh a reviewed case whose full-tier extraction missed a declared
 * ground-floor element, using the source-geometry correction path.
 *
 * Why this exists: `source-geometry-corrections.json` is applied by
 * `build-facade-preview.ts`, but a full rebuild is unsafe here (several cases
 * carry shape-study post-processing and delivered corrections that live outside
 * that builder). So this script recomputes only the named case's `shapeFeatures`
 * + `shapeStudy` tiers through `stageSourceGeometryPacket`, which is a
 * deterministic, source-hash-validated, idempotent transform. Every other case
 * is asserted byte-identical.
 *
 * It is idempotent: once the stored features and study carry the correction
 * there is nothing to publish.
 *
 * The revision is published through the existing immutable `publishPreviewRevision`
 * helper, which archives the prior bytes and retains every case ID. It never
 * touches `current.json`, a release, notes or the spend journal.
 *
 * Run: npx tsx scripts/review/refresh-reviewed-source-geometry.ts [--case=case-05] [--dry-run]
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { stageSourceGeometryPacket } from './source-geometry-corrections.ts';
import { publishPreviewRevision } from './publish-preview-revision.ts';
import reviewData from './source-geometry-corrections.json' with { type: 'json' };

const flag = (name: string) => process.argv.find((value) => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const caseId = flag('case') ?? 'case-05';
const dryRun = process.argv.includes('--dry-run');
const CASES = 'public/data/facade-repair-preview/cases.json';
const OUT = 'review-data/source-geometry-refresh.json';
const sha = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');

const currentBytes = fs.readFileSync(CASES);
const current = JSON.parse(currentBytes.toString('utf8'));
const selected = (reviewData as any).cases.filter((correction: any) => correction.caseId === caseId);
assert.ok(selected.length, `${caseId} has no source-geometry correction`);

const staged = stageSourceGeometryPacket(JSON.parse(currentBytes.toString('utf8')), selected as any);
for (const record of current.cases) {
  if (record.caseId === caseId) continue;
  assert.deepEqual(
    record,
    staged.cases.find((row: any) => row.caseId === record.caseId),
    `unrelated case changed: ${record.caseId}`,
  );
}

const proposed = Buffer.from(JSON.stringify(staged));
const changed = !proposed.equals(currentBytes);
const fields = Object.keys(selected[0].replace ?? {});
const added = (selected[0].add ?? []).map((feature: any) => feature.id);

if (!changed) {
  console.log(JSON.stringify({ status: 'already-current', caseId, added, replaced: fields }, null, 2));
  process.exit(0);
}
if (dryRun) {
  console.log(JSON.stringify({ status: 'would-publish', caseId, added, replaced: fields }, null, 2));
  process.exit(0);
}

const result = await publishPreviewRevision(process.cwd(), sha(currentBytes), proposed);
const report = {
  version: 1,
  kind: 'reviewed-source-geometry-refresh',
  generatedAt: new Date().toISOString(),
  sourcePacket: { path: CASES, sha256: sha(currentBytes) },
  caseId,
  addedFeatures: added,
  replacedFeatures: fields,
  source: selected[0].source,
  note: 'A reviewed source-bound full-tier correction is applied through stageSourceGeometryPacket. Metric patches, owner geometry and every other case are left byte-identical; prior packet bytes are archived by the publisher.',
  published: result,
};
fs.mkdirSync('review-data', { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ status: 'published', ...report }, null, 2));
