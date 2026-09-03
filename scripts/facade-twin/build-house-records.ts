/**
 * Build per-building CanalHouse records from a survey area's reconnaissance.
 *
 * Reads that area's `recon.json`, produces one parameter record and its
 * observation registry per building, audits every one of them, and writes the
 * result plus a coverage report back to staging.
 *
 * Nothing here invents a façade. Footprint and massing are populated; every
 * façade field stays defaulted until an image or a heritage description
 * observes it, and the coverage report says exactly how much of the boundary
 * that leaves unobserved.
 *
 * Usage: npx tsx scripts/facade-twin/build-house-records.ts [--area=<areaId>]
 */
import { readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  applyHeritageEvidence, buildRecordFromRecon, summariseReconBuild,
  type BuildRecordInput, type BuiltRecord, type SourceDescriptor,
} from '../../src/canalRecall/facade/buildRecord.ts';
import { summariseCoverage, type Observation } from '../../src/canalRecall/facade/evidence.ts';
import { auditHouse, fieldsOf, validateHouse } from '../../src/canalRecall/facade/houseRecord.ts';
import { classifyObservationTier, evidenceCeiling } from '../../src/canalRecall/facade/observationTier.ts';
import type { HeritageRecord, MassingRecord, RegistryBuilding } from '../../src/canalRecall/facade/sources.ts';

const argument = (name: string) =>
  process.argv.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const areaId = argument('area') || 'amsterdam-grachtengordel-west';

const directory = path.resolve('public/data/extracts/amsterdam/staging/facade-twin', areaId);
const reconFile = path.join(directory, 'recon.json');
const outputFile = path.join(directory, 'house-records.json');
const reportFile = path.join(directory, 'house-records-coverage.json');

interface ReconFile {
  metadata: {
    generatedAt: string;
    area: { areaId: string; name: string };
    sources: Record<string, { id?: string; name?: string; license?: string; vintage?: string; recordUrlTemplate?: string } | undefined>;
  };
  buildings: RegistryBuilding[];
  massing: MassingRecord[];
  heritage: HeritageRecord[];
}

const recon = JSON.parse(await readFile(reconFile, 'utf8')) as ReconFile;

const descriptor = (key: string, fallbackId: string): SourceDescriptor => {
  const source = recon.metadata.sources?.[key];
  return {
    id: source?.id ?? fallbackId,
    license: source?.license ?? null,
    vintage: source?.vintage ?? null,
    recordUrlTemplate: source?.recordUrlTemplate ?? null,
  };
};

const registry = descriptor('registry', 'registry');
const massingSource = descriptor('massing', 'massing');
const heritageSource = descriptor('heritage', 'heritage');

const massingByBuilding = new Map(recon.massing.map(row => [row.buildingId, row]));
// The registry's read date. Every registry-sourced field is dated by it, so the
// ledger says when the footprint was true rather than when this script ran.
const registryReadAt = recon.metadata.generatedAt.slice(0, 10);

const rows: BuildRecordInput[] = recon.buildings.map(building => ({
  building,
  massing: massingByBuilding.get(building.buildingId),
  registryReadAt,
  registry,
  massingSource,
}));

const built: BuiltRecord[] = rows.map(buildRecordFromRecon);

// A heritage description is the only façade evidence available before imagery,
// and it reaches 636 of these buildings. Applied after massing so the gable
// lands on a record that already has its footprint and silhouette.
const heritageByBuilding = new Map<string, HeritageRecord[]>();
for (const record of recon.heritage ?? []) {
  if (!record.buildingId) continue;
  const bucket = heritageByBuilding.get(record.buildingId);
  if (bucket) bucket.push(record);
  else heritageByBuilding.set(record.buildingId, [record]);
}

const heritageApplied = new Map<string, number>();
for (const entry of built) {
  const records = heritageByBuilding.get(entry.house.pandId);
  if (!records) continue;
  const evidence = applyHeritageEvidence(entry.house, records, registryReadAt, heritageSource);
  entry.observations.push(...evidence.observations);
  entry.notes.push(...evidence.notes);
  for (const field of evidence.applied) heritageApplied.set(field, (heritageApplied.get(field) ?? 0) + 1);
}

// Audit every record against its own observations. A violation here is a bug in
// the constructor, not a data problem, so it fails the build rather than being
// reported as a coverage number.
const observations = new Map<string, Observation>();
for (const entry of built) for (const observation of entry.observations) observations.set(observation.id, observation);

const violations = built.flatMap(entry => auditHouse(entry.house, observations, registryReadAt));
const problems = built.flatMap(entry => validateHouse(entry.house));

// Where the evidence ladder actually leaves this area today: reconnaissance is
// registry and survey only, so no building can rise above AERIAL ONLY.
const tiers = new Map<string, number>();
for (const entry of built) {
  const own = entry.observations.filter(observation => observation.pandId === entry.house.pandId);
  const tier = classifyObservationTier(own, 'front');
  const key = `${tier} → ${evidenceCeiling(tier, false)}`;
  tiers.set(key, (tiers.get(key) ?? 0) + 1);
}

const summary = summariseReconBuild(rows, built);
const coverage = summariseCoverage(built.map(entry => fieldsOf(entry.house)));

const report = {
  metadata: {
    generatedAt: new Date().toISOString(),
    generator: 'scripts/facade-twin/build-house-records.ts',
    area: recon.metadata.area,
    reconGeneratedAt: recon.metadata.generatedAt,
    registryReadAt,
    sources: { registry, massing: massingSource },
    note: 'Footprint and massing only. Every façade field is defaulted until a street-level or heritage observation exists; that is coverage, not a defect.',
  },
  summary,
  heritage: {
    buildingsWithRecord: heritageByBuilding.size,
    fieldsApplied: Object.fromEntries(heritageApplied),
  },
  observationTiers: Object.fromEntries([...tiers.entries()].sort((a, b) => b[1] - a[1])),
  evidenceViolations: violations.length,
  recordProblems: problems.slice(0, 50),
  recordProblemCount: problems.length,
  coverage,
  notes: built.flatMap(entry => entry.notes.map(note => `${entry.house.pandId}: ${note}`)).slice(0, 200),
};

const write = async (file: string, value: unknown, pretty: boolean) => {
  const temporary = `${file}.tmp`;
  await writeFile(temporary, JSON.stringify(value, null, pretty ? 2 : 0));
  await rename(temporary, file);
};

await write(outputFile, {
  metadata: report.metadata,
  observations: [...observations.values()],
  houses: built.map(entry => entry.house),
}, false);
await write(reportFile, report, true);

const percent = (part: number, whole: number) => whole === 0 ? '0.0' : ((part / whole) * 100).toFixed(1);

process.stdout.write(`${recon.metadata.area.name} — built ${summary.buildings} CanalHouse records from reconnaissance\n`);
process.stdout.write(`  massing match      ${summary.withMassing} (${percent(summary.withMassing, summary.buildings)}%), ${summary.withoutMassing} without\n`);
process.stdout.write(`  eaves / ridge      ${summary.withEaves} / ${summary.withRidge}\n`);
process.stdout.write(`  inverted heights   ${summary.invertedHeights} (${percent(summary.invertedHeights, summary.buildings)}%) — ridge kept as a lower bound, eaves left unobserved\n`);
process.stdout.write(`  impossible heights ${summary.impossibleHeights} — ridge at or below its own ground level, both heights left unobserved\n`);
process.stdout.write(`  storeys            ${summary.withStoreys} (${percent(summary.withStoreys, summary.buildings)}%)\n`);
process.stdout.write(`  year unknown       ${summary.unknownConstructionYear} (${percent(summary.unknownConstructionYear, summary.buildings)}%)\n`);
process.stdout.write(`  mean ridge conf.   ${summary.meanHeightConfidence}\n`);
process.stdout.write(`  heritage records   ${heritageByBuilding.size} buildings; applied ${JSON.stringify(Object.fromEntries(heritageApplied))}\n`);
process.stdout.write(`  observation tiers  ${JSON.stringify(report.observationTiers)}\n`);

const unobserved = coverage.filter(entry => entry.share === 0);
process.stdout.write(`  façade fields at 0% coverage: ${unobserved.length} of ${coverage.length}\n    ${unobserved.map(entry => entry.field).join(', ')}\n`);

// A record problem is a finding about the *sources* — an inconsistent
// measurement that belongs in the review queue — so it is reported and shipped
// with the extract. An evidence violation is a bug in this constructor: a value
// with no observation behind it, or one citing a neighbour's. That is never
// data, and it fails the build.
if (problems.length) {
  process.stdout.write(`\n${problems.length} record problem(s) flagged for review; first 5:\n`);
  for (const problem of problems.slice(0, 5)) {
    process.stdout.write(`  ${problem.pandId} ${problem.field}: ${problem.detail}\n`);
  }
}

if (violations.length) {
  process.stderr.write(`\n${violations.length} evidence violation(s) — this is a constructor bug, not a data problem; first 5:\n`);
  for (const violation of violations.slice(0, 5)) {
    process.stderr.write(`  ${violation.pandId} ${violation.field} ${violation.code}: ${violation.detail}\n`);
  }
  process.exit(1);
}
process.stdout.write(`\nWrote ${path.relative(process.cwd(), outputFile)} and its coverage report.\n`);
