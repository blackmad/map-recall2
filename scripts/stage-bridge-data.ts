/**
 * Stage the finished bridge data: a smaller `bridges.json`, official
 * spellings, the sourced cards for names no register carries, and the
 * reviewed English ledes.
 *
 *   public/data/extracts/<city>/staging/bridge-data/
 *     bridges.json              the shipped file
 *     manifest.json             bridges partition bytes updated
 *     bridge-data-report.json   bytes before/after, every change by name
 *
 * What it does to the published bridges.json, in order:
 *   1. build-only fields (`src/canalRecall/extractSidecar.ts`: the 2,400-char
 *      `wikipediaSourceText`, the Dutch `wikipediaExtractOriginal`, the
 *      prominence inputs) move to `scripts/data/extract-sidecars/<city>/bridges.json`;
 *      the enrich/translate/scrub passes read them back from there;
 *   2. `displayName` from `scripts/data/bridge-display-names.json` (the BAG
 *      spelling where OSM's differs: "Katten brug" is shown as Kattenbrug);
 *   3. cards from `scripts/data/bridge-card-overrides.json` (sourced, for
 *      bridges whose OSM name is a former unofficial name);
 *   4. each translated lede set to its reviewed entry in
 *      `scripts/english-translations.json` (keyed by the Dutch source's hash).
 *
 *   npx tsx scripts/stage-bridge-data.ts
 *   npx tsx scripts/stage-bridge-data.ts --publish
 *
 * `--publish` copies the staged bridges.json and manifest.json into the
 * extract, and refuses if the published bridges.json changed since staging.
 */
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import { isBridgeSpelling } from '../src/canalRecall/bridgeDisplayNames';
import { readPartition, shipPartition } from './lib/extract-sidecar';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const argument = (name: string) => process.argv.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const extractDir = resolve(root, argument('directory') || 'public/data/extracts/amsterdam');
const stagingDir = resolve(extractDir, 'staging/bridge-data');
const rel = (file: string) => relative(root, file);
const sha = (file: string) => createHash('sha256').update(readFileSync(file)).digest('hex');
const bridgesPath = resolve(extractDir, 'bridges.json');
const reportPath = resolve(stagingDir, 'bridge-data-report.json');

if (process.argv.includes('--publish')) {
  if (!existsSync(reportPath)) throw new Error(`Nothing staged: run without --publish first (${rel(reportPath)})`);
  const staged = JSON.parse(readFileSync(reportPath, 'utf8')) as { sourceBridgesSha256: string };
  if (sha(bridgesPath) !== staged.sourceBridgesSha256) throw new Error('The published bridges.json changed since staging; re-run without --publish.');
  for (const file of ['bridges.json', 'manifest.json']) {
    copyFileSync(resolve(stagingDir, file), resolve(extractDir, file));
    console.log(`Published ${rel(resolve(extractDir, file))}`);
  }
  process.exit(0);
}

interface Bridge {
  id: string;
  name: string;
  displayName?: string;
  wikipediaUrl?: string;
  wikipediaExtract?: string;
  wikipediaExtractLang?: string;
  wikipediaExtractSource?: string;
  wikipediaExtractOriginal?: string;
  wikipediaExtractOriginalLang?: string;
  wikipediaImageUrl?: string;
  [field: string]: unknown;
}
const manifest = JSON.parse(readFileSync(resolve(extractDir, 'manifest.json'), 'utf8'));
const cityId = String(manifest.cityId || 'amsterdam');
const publishedText = readFileSync(bridgesPath, 'utf8');
const bridges = readPartition<Bridge>(extractDir, 'bridges.json', cityId);
const byName = new Map(bridges.map(bridge => [bridge.name, bridge]));

// ---- 2. Official spellings ----
const displayTable = JSON.parse(readFileSync(resolve(root, 'scripts/data/bridge-display-names.json'), 'utf8')) as {
  rows: Array<{ id: string; name: string; displayName: string; source: string; ref: string }>;
};
const displayNames: Array<{ name: string; displayName: string; source: string }> = [];
for (const row of displayTable.rows) {
  const bridge = byName.get(row.name);
  if (!bridge || bridge.id !== row.id) throw new Error(`display name for ${row.name} (${row.id}) matches no published bridge`);
  if (!isBridgeSpelling(row.name, row.displayName)) throw new Error(`${row.displayName} is not a spelling of ${row.name}`);
  bridge.displayName = row.displayName;
  displayNames.push({ name: row.name, displayName: row.displayName, source: `${row.source} ${row.ref}` });
}

// ---- 3. Sourced cards ----
const overrides = JSON.parse(readFileSync(resolve(root, 'scripts/data/bridge-card-overrides.json'), 'utf8')) as {
  cards: Array<{ name: string; nl: string; en: string; wikipediaUrl: string; wikipediaImageUrl?: string; sources: string[] }>;
};
const cards: string[] = [];
for (const card of overrides.cards) {
  const bridge = byName.get(card.name);
  if (!bridge) throw new Error(`card for ${card.name} matches no published bridge`);
  if (!card.sources?.length) throw new Error(`card for ${card.name} has no source`);
  if (bridge.wikipediaExtract && bridge.wikipediaUrl !== card.wikipediaUrl) throw new Error(`${card.name} already has a card (${bridge.wikipediaUrl})`);
  Object.assign(bridge, {
    wikipediaUrl: card.wikipediaUrl,
    wikipediaExtract: card.en,
    wikipediaExtractSource: 'translated',
    wikipediaExtractOriginal: card.nl,
    wikipediaExtractOriginalLang: 'nl',
    ...(card.wikipediaImageUrl ? { wikipediaImageUrl: card.wikipediaImageUrl } : {}),
  });
  delete bridge.wikipediaExtractLang;
  cards.push(card.name);
}

// ---- 4. Reviewed ledes ----
const hash = (text: string) => createHash('sha1').update(text).digest('hex').slice(0, 12);
const translations = new Map((JSON.parse(readFileSync(resolve(root, 'scripts/english-translations.json'), 'utf8')) as Array<{ hash: string; en: string }>)
  .map(entry => [entry.hash, entry.en]));
const ledes: Array<{ name: string; before: string; after: string }> = [];
for (const bridge of bridges) {
  if (bridge.wikipediaExtractSource !== 'translated' || !bridge.wikipediaExtractOriginal || cards.includes(bridge.name)) continue;
  const reviewed = translations.get(hash(bridge.wikipediaExtractOriginal));
  if (!reviewed || reviewed === bridge.wikipediaExtract) continue;
  ledes.push({ name: bridge.name, before: bridge.wikipediaExtract || '', after: reviewed });
  bridge.wikipediaExtract = reviewed;
}

// ---- 1. Ship without the build-only fields ----
mkdirSync(stagingDir, { recursive: true });
const shipped = shipPartition('bridges.json', bridges, cityId);
writeFileSync(resolve(stagingDir, 'bridges.json'), shipped);
manifest.partitions.bridges = { ...manifest.partitions.bridges, bytes: Buffer.byteLength(shipped) };
writeFileSync(resolve(stagingDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);

const size = (text: string) => ({ raw: Buffer.byteLength(text), gzip: gzipSync(text, { level: 9 }).length });
const before = size(publishedText);
const after = size(shipped);
const report = {
  generatedAt: new Date().toISOString(),
  sourceBridgesSha256: sha(bridgesPath),
  bytes: { before, after },
  bridges: bridges.length,
  displayNames,
  cards,
  ledesChanged: ledes.length,
  ledes,
};
writeFileSync(reportPath, `${JSON.stringify(report, null, 1)}\n`);
const kb = (bytes: number) => `${(bytes / 1024).toFixed(0)} KB`;
console.log(`bridges.json: ${kb(before.raw)} → ${kb(after.raw)} raw, ${kb(before.gzip)} → ${kb(after.gzip)} gzipped (${bridges.length} bridges)`);
console.log(`Display names: ${displayNames.length}`);
for (const row of displayNames) console.log(`  ${row.name} → ${row.displayName} (${row.source})`);
console.log(`Cards added: ${cards.length} (${cards.join(', ')})`);
console.log(`Ledes changed: ${ledes.length}`);
console.log(`\nStaged in ${rel(stagingDir)}; review, then re-run with --publish.`);
