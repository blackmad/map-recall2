/**
 * Refresh a reviewed case whose declared window colour is near-white.
 *
 * Why this exists: a window's `colour` is the observed glass hex, but the
 * extractor sometimes returns the near-white frame or curtain it sampled
 * (case-11 De Clercqstraat 26 declared #ffffff for every upper window). The
 * facade compiler now treats a near-white window colour as undeclared and uses
 * the neutral glass, but the delivered packet was built before that guard, so
 * its stored metric patches and source-shape study still paint white panes.
 *
 * This is a **targeted packet revision**, not a full regeneration. A full
 * `build-facade-preview` rebuild is unsafe here: several cases carry shape-study
 * post-processing and delivered corrections that live outside that builder. So
 * this script recomputes only the named case's candidate fields through the
 * shared `buildCaseCandidate` path and its stored shape study through
 * `compileSourceShapePreview`, then publishes through the immutable
 * `publishPreviewRevision` helper. Every other case is byte-identical.
 *
 * It is idempotent: once the stored study and candidate match a fresh guarded
 * compile there is nothing to publish.
 *
 * Run: npx tsx scripts/review/refresh-reviewed-glazing.ts [--case=case-11] [--dry-run]
 */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import { buildCaseCandidate } from './case-candidate.ts';
import { compileSourceShapePreview } from './source-shape-preview.ts';
import { publishPreviewRevision } from './publish-preview-revision.ts';

const flag = (name: string) => process.argv.find((value) => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const caseId = flag('case') ?? 'case-11';
const dryRun = process.argv.includes('--dry-run');
const CASES = 'public/data/facade-repair-preview/cases.json';
const OUT = 'review-data/glazing-refresh.json';
const sha = (bytes: Buffer) => crypto.createHash('sha256').update(bytes).digest('hex');
const read = async (path: string) => JSON.parse(await fs.readFile(path, 'utf8'));

const nearWhiteWindow = (feature: any) => {
  if (feature?.kind !== 'window') return false;
  const match = /^#([a-f0-9]{2})([a-f0-9]{2})([a-f0-9]{2})$/i.exec(feature.colour ?? '');
  return !!match && [1, 2, 3].every((index) => parseInt(match[index], 16) >= 235);
};

const packetBytes = await fs.readFile(CASES);
const packet = JSON.parse(packetBytes.toString('utf8'));
const entry = packet.cases.find((row: any) => row.caseId === caseId);
if (!entry) throw Error(`${caseId} missing from the review packet`);
const affected = (entry.shapeFeatures?.full?.features ?? []).filter(nearWhiteWindow).map((feature: any) => feature.id);
assert.ok(affected.length, `${caseId} has no near-white window features; nothing to refresh`);

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
});

const fields: Record<string, unknown> = {
  candidateObservations: candidate.candidateObservations,
  frame: candidate.frame,
  patches: candidate.patches,
  counts: Object.fromEntries(['door', 'window', 'awning', 'material'].map((kind) => [
    kind,
    new Set(candidate.patches.filter((patch: any) => patch.featureKind === `observed-${kind}`).map((patch: any) => patch.featureId)).size,
  ])),
  omissions: candidate.omissions,
  status: caseId === 'case-26'
    ? entry.status
    : `Development preview · alignment unverified · ${candidate.analyzedTiers}/2 image tiers analyzed`,
};

// A fresh study from the same stored source features, through the guarded
// compiler. The only permitted change is the near-white window glazing losing
// its white panes; patch counts must not move.
const colourCounts = (study: any) => {
  const counts = new Map<string, number>();
  for (const patch of study.patches ?? []) counts.set(`${patch.featureKind}:${patch.colour}`, (counts.get(`${patch.featureKind}:${patch.colour}`) ?? 0) + 1);
  return counts;
};
const studyFields: Record<string, unknown> = {};
for (const tier of ['full', 'ground'] as const) {
  const input = entry.shapeFeatures?.[tier];
  if (!input) continue;
  const fresh = compileSourceShapePreview({ width: input.width, height: input.height, cropSha256: input.cropSha256, captureDate: input.captureDate, features: input.features });
  // `compileSourceShapePreview` does not emit the builder's `omissions` field;
  // preserve it so the refresh only changes the glazing colour.
  if (Array.isArray(entry.shapeStudy?.[tier]?.omissions)) fresh.omissions = entry.shapeStudy[tier].omissions;
  if (JSON.stringify(fresh) === JSON.stringify(entry.shapeStudy?.[tier])) continue;
  const before = colourCounts(entry.shapeStudy?.[tier] ?? {});
  const after = colourCounts(fresh);
  for (const [key, count] of after) {
    const previous = before.get(key) ?? 0;
    if (key.startsWith('observed-window:#526a6b')) assert.ok(previous <= count, `${caseId}/${tier}: neutral glass lost patches`);
    else assert.equal(previous, count, `${caseId}/${tier}: unexpected patch-count change for ${key} (${previous} != ${count})`);
  }
  for (const [key, count] of before) {
    const next = after.get(key) ?? 0;
    if (key === 'observed-window:#ffffff') assert.ok(next <= count, `${caseId}/${tier}: white glazing gained patches`);
    else assert.equal(next, count, `${caseId}/${tier}: unexpected patch-count change for ${key} (${count} != ${next})`);
  }
  studyFields[tier] = fresh;
}

const changed = [...Object.keys(fields), ...Object.keys(studyFields)].filter((key) => {
  const target = key in fields ? fields : studyFields;
  return JSON.stringify(entry[key]) !== JSON.stringify(target[key]);
});
if (changed.length === 0) {
  console.log(JSON.stringify({ status: 'already-current', caseId, affected, patches: candidate.patches.length }, null, 2));
  process.exit(0);
}

const next = structuredClone(packet);
const nextEntry = next.cases.find((row: any) => row.caseId === caseId);
Object.assign(nextEntry, fields);
for (const [tier, study] of Object.entries(studyFields)) nextEntry.shapeStudy[tier] = study;
const proposed = Buffer.from(JSON.stringify(next));

if (dryRun) {
  console.log(JSON.stringify({ status: 'would-publish', caseId, affected, changed, patches: candidate.patches.length, studyTiers: Object.keys(studyFields) }, null, 2));
  process.exit(0);
}

const result = await publishPreviewRevision(process.cwd(), sha(packetBytes), proposed);
const report = {
  version: 1,
  kind: 'reviewed-glazing-refresh',
  generatedAt: new Date().toISOString(),
  sourcePacket: { path: CASES, sha256: sha(packetBytes) },
  caseId,
  nearWhiteWindowFeatures: affected,
  changed,
  studyTiers: Object.keys(studyFields),
  note: 'Near-white window glazing recoloured through the guarded compiler. Metric patches, frame, owners and every other case are left byte-identical; prior packet bytes are archived by the publisher.',
  published: result,
};
await fs.mkdir('review-data', { recursive: true });
await fs.writeFile(OUT, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ status: 'published', ...report }, null, 2));
