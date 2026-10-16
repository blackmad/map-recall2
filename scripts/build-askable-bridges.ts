/**
 * Make every routed, bridge-named deck askable by the bridge question.
 *
 * `bridges.json` is the extract generator's top 300 bridges by prominence, all
 * of them Wikidata-linked; the 124 bridge names on routed ways it cut were
 * taught by no question once `bridgeStreetName.ts` stopped asking them as
 * streets. This adds them (`src/canalRecall/askableBridges.ts` has the rule),
 * keeping every existing entry and id, and rebuilds everything keyed on the
 * bridge ids from the same file, in a staging copy of the extract:
 *
 *   public/data/extracts/<city>/staging/askable-bridges/
 *     bridges.json          existing 300 unchanged except distractors, plus the new decks
 *     bridge-crossings.json rebuilt (build-bridge-crossings.ts)
 *     bridge-register.json  rebuilt (build-bridge-register.ts)
 *     manifest.json         bridges partition count updated
 *     askable-bridges-report.json  coverage, exclusions and the diff
 *
 * The staging copy is promoted only with `--publish`, which refuses to run if
 * the published bridges.json changed since staging.
 *
 *   npx tsx scripts/build-askable-bridges.ts
 *   npx tsx scripts/build-askable-bridges.ts --publish
 *
 * Railway flags (`build-bridge-railways.ts`) need an Overpass round trip and
 * are left as published: every added deck is a routed (highway-tagged) way,
 * so none is railway-only, and the runtime keeps a bridge without the flags.
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { supplementBridges, type RoutingWay } from '../src/canalRecall/askableBridges';
import { pickNearestDistractors } from '../src/canalRecall/bridgeDistractors';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const directoryArgument = process.argv.find((argument) => argument.startsWith('--directory='));
const extractDir = resolve(root, directoryArgument?.slice('--directory='.length) || 'public/data/extracts/amsterdam');
const stagingDir = resolve(extractDir, 'staging/askable-bridges');
const publish = process.argv.includes('--publish');
const PUBLISHED_FILES = ['bridges.json', 'bridge-crossings.json', 'bridge-register.json', 'manifest.json'];
const rel = (file: string) => relative(root, file);
const sha = (file: string) => createHash('sha256').update(readFileSync(file)).digest('hex');

if (publish) {
  const reportPath = resolve(stagingDir, 'askable-bridges-report.json');
  if (!existsSync(reportPath)) throw new Error(`Nothing staged: run without --publish first (${rel(reportPath)})`);
  const report = JSON.parse(readFileSync(reportPath, 'utf8')) as { sourceBridgesSha256: string };
  if (sha(resolve(extractDir, 'bridges.json')) !== report.sourceBridgesSha256) {
    throw new Error('The published bridges.json changed since staging; re-run without --publish.');
  }
  for (const file of PUBLISHED_FILES) {
    copyFileSync(resolve(stagingDir, file), resolve(extractDir, file));
    console.log(`Published ${rel(resolve(extractDir, file))}`);
  }
  process.exit(0);
}

type Bridge = { id: string; name: string; center: [number, number]; distractors?: string[]; [key: string]: unknown };
const bridgesPath = resolve(extractDir, 'bridges.json');
const published = JSON.parse(readFileSync(bridgesPath, 'utf8')) as Bridge[];
const routing = JSON.parse(readFileSync(resolve(extractDir, 'streets-routing.json'), 'utf8')) as RoutingWay[];
const manifest = JSON.parse(readFileSync(resolve(extractDir, 'manifest.json'), 'utf8'));
const cityId = String(manifest.cityId || 'amsterdam');

// The register's names are the official spellings (Heiligewegsluis, not
// Heiligewegssluis) when OSM maps one bridge under two.
const registerPath = resolve(root, 'scripts/data/amsterdam-bridge-register.json');
const officialNames = new Set(existsSync(registerPath) && cityId === 'amsterdam'
  ? (JSON.parse(readFileSync(registerPath, 'utf8')) as { bridges: Array<[string, string]> }).bridges.map((row) => (row[1] || '').trim()).filter(Boolean)
  : []);
const result = supplementBridges(published, routing, cityId, { officialNames });
// First-pass distractors: the nearest bridges of any kind. The distractor
// builder below refines every bridge with the water it crosses.
const pool = [...published, ...result.added].map(({ id, name, center }) => ({ id, name, center }));
for (const feature of result.added) feature.distractors = pickNearestDistractors(feature, pool);
const staged = [...published, ...result.added];

mkdirSync(stagingDir, { recursive: true });
writeFileSync(resolve(stagingDir, 'bridges.json'), JSON.stringify(staged));
// The builders read these from the directory they are pointed at.
for (const file of ['water.json', 'boundaries.json', 'bridge-crossings.json', 'bridge-register.json']) {
  copyFileSync(resolve(extractDir, file), resolve(stagingDir, file));
}
manifest.partitions.bridges = {
  ...manifest.partitions.bridges,
  count: staged.length,
  bytes: Buffer.byteLength(JSON.stringify(staged)),
};
writeFileSync(resolve(stagingDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);

const run = (script: string, ...args: string[]) => {
  console.log(`\n$ tsx ${script} ${args.join(' ')}`);
  execFileSync(process.execPath, ['--import', 'tsx', resolve(root, script), ...args], { cwd: root, stdio: 'inherit' });
};
// Everything keyed on bridge ids is rebuilt from this bridges.json, in this
// directory (refresh-city-extract.sh: a skipped rebuild orphaned 229 crossings).
run('scripts/build-bridge-crossings.ts', `--directory=${stagingDir}`, '--publish');
run('scripts/build-bridge-distractors.ts', `--directory=${stagingDir}`, '--publish');
run('scripts/build-bridge-register.ts', `--directory=${stagingDir}`, '--publish');
// The distractor builder rewrote bridges.json; keep the manifest's byte count honest.
manifest.partitions.bridges.bytes = Buffer.byteLength(readFileSync(resolve(stagingDir, 'bridges.json')));
writeFileSync(resolve(stagingDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);

// ---- Diff against what is published ----
const after = JSON.parse(readFileSync(resolve(stagingDir, 'bridges.json'), 'utf8')) as Bridge[];
const afterById = new Map(after.map((bridge) => [bridge.id, bridge]));
const lostIds = published.filter((bridge) => !afterById.has(bridge.id)).map((bridge) => bridge.name);
const fieldChanges = new Map<string, number>();
for (const before of published) {
  const now = afterById.get(before.id)!;
  for (const key of new Set([...Object.keys(before), ...Object.keys(now)])) {
    if (JSON.stringify(before[key]) !== JSON.stringify(now[key])) fieldChanges.set(key, (fieldChanges.get(key) || 0) + 1);
  }
}
type Crossings = { bridges: Record<string, unknown[]> };
const crossingsBefore = JSON.parse(readFileSync(resolve(extractDir, 'bridge-crossings.json'), 'utf8')) as Crossings;
const crossingsAfter = JSON.parse(readFileSync(resolve(stagingDir, 'bridge-crossings.json'), 'utf8')) as Crossings;
const crossingsChanged = Object.keys(crossingsBefore.bridges)
  .filter((id) => JSON.stringify(crossingsBefore.bridges[id]) !== JSON.stringify(crossingsAfter.bridges[id]));
const addedWithCrossings = result.added.filter((feature) => crossingsAfter.bridges[feature.id]?.length).length;
const addedWithWater = result.added.filter((feature) => (crossingsAfter.bridges[feature.id] as Array<{ waterway?: string | null }> | undefined)
  ?.some((crossing) => crossing.waterway)).length;
type Register = { bridges: Record<string, unknown> };
const registerBefore = JSON.parse(readFileSync(resolve(extractDir, 'bridge-register.json'), 'utf8')) as Register;
const registerAfter = JSON.parse(readFileSync(resolve(stagingDir, 'bridge-register.json'), 'utf8')) as Register;
const registerChanged = Object.keys(registerBefore.bridges)
  .filter((name) => JSON.stringify(registerBefore.bridges[name]) !== JSON.stringify(registerAfter.bridges[name]));
const addedDescribed = result.added.filter((feature) => registerAfter.bridges[feature.name]).length;

const report = {
  generatedAt: new Date().toISOString(),
  sourceBridgesSha256: sha(bridgesPath),
  routedBridgeNames: result.routedNames,
  alreadyAskable: result.alreadyAskable.length,
  added: result.added.length,
  excluded: result.excluded,
  bridgesBefore: published.length,
  bridgesAfter: after.length,
  existingIdsLost: lostIds,
  existingFieldChanges: Object.fromEntries(fieldChanges),
  crossings: {
    existingChanged: crossingsChanged.length,
    existingDropped: Object.keys(crossingsBefore.bridges).filter((id) => !crossingsAfter.bridges[id]).length,
    addedWithCrossings,
    addedWithWater,
    nonBridgeKeys: Object.keys(crossingsAfter.bridges).filter((id) => !afterById.has(id)).length,
  },
  register: { existingChanged: registerChanged.length, addedDescribed },
  addedNames: result.added.map((feature) => feature.name),
};
writeFileSync(resolve(stagingDir, 'askable-bridges-report.json'), `${JSON.stringify(report, null, 2)}\n`);

console.log('\n---- Askable bridges ----');
console.log(`Routed bridge names:     ${result.routedNames}`);
console.log(`Already askable:         ${result.alreadyAskable.length}`);
console.log(`Added:                   ${result.added.length}`);
console.log(`Excluded:                ${result.excluded.length}`);
for (const decision of result.excluded) {
  console.log(`  ${decision.name}: ${decision.reason} (longest deck ${decision.longestDeckMetres} m)`);
}
console.log(`Bridges:                 ${published.length} → ${after.length}`);
console.log(`Existing ids lost:       ${lostIds.length}${lostIds.length ? ` (${lostIds.join(', ')})` : ''}`);
console.log(`Existing fields changed: ${JSON.stringify(Object.fromEntries(fieldChanges))}`);
console.log(`Crossings (existing):    ${crossingsChanged.length} changed, ${report.crossings.existingDropped} dropped`);
console.log(`Crossings (added):       ${addedWithCrossings} of ${result.added.length} cross mapped water, ${addedWithWater} with the water named`);
console.log(`Register (existing):     ${registerChanged.length} changed; added described: ${addedDescribed}`);
console.log(`\nStaged in ${rel(stagingDir)}; review, then re-run with --publish.`);
if (lostIds.length || report.crossings.existingDropped || report.crossings.nonBridgeKeys) process.exit(1);
