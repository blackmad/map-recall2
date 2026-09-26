/**
 * Refresh a reviewed case whose extraction missed a whole upper-floor row.
 *
 * Why this exists: the source-space extractor reported `openingsComplete: true`
 * for case-12 Rozengracht 160 while returning only one of the two clear upper
 * window rows, so the blank wall below the gable rendered as masonry. The
 * compiler never invents architecture inside a described tier, so the row is
 * reconciled against the observed rhythm by a reviewed source-bound correction
 * (`floor-row-corrections.json`) rather than by a global inference rule.
 *
 * This is a **targeted packet revision**, not a full `build-facade-preview`
 * rebuild (several cases carry shape-study post-processing delivered outside
 * that builder). It recomputes only the named case's candidate fields through
 * the shared `buildCaseCandidate` path, its `shapeFeatures`, and its source-shape
 * studies through the same `applySourceAssemblies(compileSourceShapePreview(...))`
 * sequence the builder uses. Every other case is byte-identical.
 *
 * It is idempotent: once the stored features and study carry the inferred rows
 * there is nothing to publish.
 *
 * Run: npx tsx scripts/review/refresh-reviewed-floor-rows.ts [--case=case-12] [--dry-run]
 */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import { buildCaseCandidate } from './case-candidate.ts';
import { compileSourceShapePreview } from './source-shape-preview.ts';
import { applySourceAssemblies } from './apply-source-assemblies.ts';
import { publishPreviewRevision } from './publish-preview-revision.ts';

const flag = (name: string) => process.argv.find((value) => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const caseId = flag('case') ?? 'case-12';
const dryRun = process.argv.includes('--dry-run');
const CASES = 'public/data/facade-repair-preview/cases.json';
const OUT = 'review-data/floor-row-refresh.json';
const sha = (bytes: Buffer) => crypto.createHash('sha256').update(bytes).digest('hex');
const read = async (path: string) => JSON.parse(await fs.readFile(path, 'utf8'));

const floorRows = await read('scripts/review/floor-row-corrections.json');
const correction = floorRows.cases?.[caseId];
assert.ok(correction, `${caseId} has no floor-row correction`);
const inferredIds = new Set<string>(Object.values(correction).flatMap((tier: any) => (tier?.inferred ?? []).map((row: any) => row.id)));
assert.ok(inferredIds.size, `${caseId} correction declares no inferred rows`);

const packetBytes = await fs.readFile(CASES);
const packet = JSON.parse(packetBytes.toString('utf8'));
const entry = packet.cases.find((row: any) => row.caseId === caseId);
if (!entry) throw Error(`${caseId} missing from the review packet`);

const regressions = await read('scripts/review/facade-regressions.json');
const c = regressions.cases.find((row: any) => row.caseId === caseId);
if (!c) throw Error(`${caseId} missing from facade-regressions.json`);
const references = await read('scripts/review/window-shape-reference.json');
const corrections = await read('scripts/review/development-photo-corrections.json');
const spatial = await read('scripts/review/spatial-source-corrections.json');
const signReferences = await read('scripts/review/roof-sign-corrections.json');
const retailReview = await read('scripts/review/retail-priority-source-review.json');
const cache = await read('.cache/city-appearance/fidelity-extraction/analysis-results.json');
const index = await read('.cache/city-appearance/fidelity-extraction/development-analysis-index.json');
const manifest = await fs.readFile('scripts/review/facade-regression-analysis-manifest.json');
if (index.manifestSha256 !== sha(manifest)) throw Error('Stale analysis manifest');
const currentKeys = new Set(index.cases.map((row: any) => row.key));
const complete = cache.results.filter((row: any) => currentKeys.has(row.key) && row.status === 'complete' && row.proposal);

const tile = JSON.parse(gunzipSync(await fs.readFile(c.binding.tile.path)).toString());
const owner = tile.owners.find((row: any) => row.id === c.binding.buildingId);
const original = owner.observations.find((row: any) => row.id === c.binding.observationId).payload;
const candidate = buildCaseCandidate({
  caseId,
  owner,
  original,
  bindingSurfaceIndices: c.binding?.surfaceIndices,
  complete,
  references,
  corrections,
  spatial,
  signReferences,
  retailReview,
  floorRows,
});

const fields: Record<string, unknown> = {
  candidateObservations: candidate.candidateObservations,
  frame: candidate.frame,
  shapeFeatures: candidate.shapeFeatures,
  patches: candidate.patches,
  counts: Object.fromEntries(['door', 'window', 'awning', 'material'].map((kind) => [
    kind,
    new Set(candidate.patches.filter((patch: any) => patch.featureKind === `observed-${kind}`).map((patch: any) => patch.featureId)).size,
  ])),
  omissions: candidate.omissions,
  status: `Development preview · alignment unverified · ${candidate.analyzedTiers}/2 image tiers analyzed`,
};

// Rebuild only the tiers that carry a correction, exactly as the builder does,
// so delivered post-processing on other tiers is never dropped.
const isInferred = (featureId: string) => [...inferredIds].some((inferred) => featureId.endsWith(inferred));
const strip = (patches: any[]) => patches.filter((patch) => !isInferred(patch.featureId));
const studyFields: Record<string, unknown> = {};
for (const tier of Object.keys(correction)) {
  const input = candidate.shapeFeatures?.[tier];
  if (!input) continue;
  const fresh = applySourceAssemblies(
    compileSourceShapePreview({ width: input.width, height: input.height, cropSha256: input.cropSha256, captureDate: input.captureDate, features: input.features }),
    input,
    spatial.cases?.[caseId]?.[tier]?.entranceAssemblies,
  );
  const before = entry.shapeStudy?.[tier];
  // Idempotency: the stored tier may already carry the inferred rows, so every
  // comparison strips them first and re-adds the declared count.
  const storedStripped = strip(before?.patches ?? []);
  assert.deepEqual(strip(fresh.patches ?? []), storedStripped, `${caseId}/${tier}: existing study patches changed`);
  const inferredPatches = (fresh.patches ?? []).filter((patch: any) => isInferred(patch.featureId));
  assert.equal(new Set(inferredPatches.map((patch: any) => patch.featureId)).size, correction[tier].inferred.length, `${caseId}/${tier}: inferred-row feature count changed`);
  assert.ok(inferredPatches.length > 0, `${caseId}/${tier}: fresh study has no inferred-row patches`);
  for (const kind of ['door', 'awning', 'material', 'fascia'])
    assert.equal(fresh.counts[kind] ?? 0, before?.counts?.[kind] ?? 0, `${caseId}/${tier}: unexpected ${kind} change`);
  studyFields[tier] = fresh;
}

const changed = [
  ...Object.keys(fields).filter((key) => JSON.stringify(entry[key]) !== JSON.stringify(fields[key])),
  ...Object.keys(studyFields).filter((tier) => JSON.stringify(entry.shapeStudy?.[tier]) !== JSON.stringify(studyFields[tier])),
];
if (changed.length === 0) {
  console.log(JSON.stringify({ status: 'already-current', caseId, inferred: [...inferredIds], patches: candidate.patches.length }, null, 2));
  process.exit(0);
}

const next = structuredClone(packet);
const nextEntry = next.cases.find((row: any) => row.caseId === caseId);
Object.assign(nextEntry, fields);
for (const [tier, study] of Object.entries(studyFields)) nextEntry.shapeStudy[tier] = study;
const proposed = Buffer.from(JSON.stringify(next));

if (dryRun) {
  console.log(JSON.stringify({ status: 'would-publish', caseId, inferred: [...inferredIds], changed, patches: candidate.patches.length, studyTiers: Object.keys(studyFields) }, null, 2));
  process.exit(0);
}

const result = await publishPreviewRevision(process.cwd(), sha(packetBytes), proposed);
const report = {
  version: 1,
  kind: 'reviewed-floor-row-refresh',
  generatedAt: new Date().toISOString(),
  sourcePacket: { path: CASES, sha256: sha(packetBytes) },
  caseId,
  inferredRowFeatures: [...inferredIds],
  changed,
  studyTiers: Object.keys(studyFields),
  note: 'A measured source-bound inferred upper-floor row is added through the reviewed correction path. Metric patches, owner geometry and every other case are left byte-identical; prior packet bytes are archived by the publisher.',
  published: result,
};
await fs.mkdir('review-data', { recursive: true });
await fs.writeFile(OUT, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ status: 'published', ...report }, null, 2));
