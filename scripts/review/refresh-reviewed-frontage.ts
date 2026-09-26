/**
 * Targeted republish for a reviewed case whose metric candidate was recovered by
 * the registered-frontage fallback.
 *
 * A full `build-facade-preview` rebuild is unsafe: the packet carries delivered
 * corrections that live outside that builder (case-08's declared wall colour),
 * and unrelated cases would churn. So this refreshes only the affected case's
 * candidate fields through the shared `buildCaseCandidate` path, keeping every
 * other case byte-identical, and republishes through the immutable
 * `publishPreviewRevision` helper.
 *
 * Idempotent: `--dry-run` reports `already-current` once the packet matches.
 *
 * Run: npx tsx scripts/review/refresh-reviewed-frontage.ts [--case=case-09] [--dry-run]
 */
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import { buildCaseCandidate } from './case-candidate.ts';
import { publishPreviewRevision } from './publish-preview-revision.ts';

const flag = (name: string) => process.argv.find((value) => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const caseId = flag('case') ?? 'case-09';
const dryRun = process.argv.includes('--dry-run');
const CASES = 'public/data/facade-repair-preview/cases.json';
const sha = (bytes: Buffer) => crypto.createHash('sha256').update(bytes).digest('hex');
const read = async (path: string) => JSON.parse(await fs.readFile(path, 'utf8'));

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
const floorRows = await read('scripts/review/floor-row-corrections.json');
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

const changed = Object.keys(fields).filter((key) => JSON.stringify(entry[key]) !== JSON.stringify(fields[key]));
if (changed.length === 0) {
  console.log(JSON.stringify({ status: 'already-current', caseId, patches: candidate.patches.length, counts: fields.counts }, null, 2));
  process.exit(0);
}

const next = structuredClone(packet);
const nextEntry = next.cases.find((row: any) => row.caseId === caseId);
Object.assign(nextEntry, fields);
const proposed = Buffer.from(JSON.stringify(next));

if (dryRun) {
  console.log(JSON.stringify({ status: 'would-publish', caseId, changed, patches: candidate.patches.length, counts: fields.counts }, null, 2));
  process.exit(0);
}

const result = await publishPreviewRevision(process.cwd(), sha(packetBytes), proposed);
console.log(JSON.stringify({ status: 'published', caseId, changed, patches: candidate.patches.length, counts: fields.counts, ...result }, null, 2));
