/**
 * Publish a city's translated street-name origins into its extract.
 *
 *   npx tsx scripts/publish-city-street-name-origins.ts --city=rotterdam [--dry-run]
 *
 * Reads `<extract>/staging/street-name-origins.json` (fetch-city-… then
 * translate-city-…) and `scripts/data/street-name-origins-review.<city>.json`,
 * the human spot-check: which entries were read against the Dutch, corrected
 * English for the ones that were wrong, and names withheld with a reason.
 * Publishing refuses to run without a spot-check of at least 100 entries.
 *
 * Writes `<extract>/street-name-origins.json` in the Amsterdam shape
 * ({version, source:{url, field, retrievedAt, licence}, origins:[{name, kind,
 * en}]}) plus, per entry, `sourceUrl` (the register record) and `enSource`
 * (which translator, or 'reviewed' for a hand correction).
 *
 * Staging is not committed, so the English is also written to
 * `scripts/data/street-name-origin-translations.<city>.json`, keyed by name and
 * a hash of the Dutch; the fetcher reads it back, so a re-fetch never repeats
 * a translation whose source is unchanged.
 */
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { trimToSentence } from './lib/translation.ts';
import { dutchHash, refusalReason, repairCityOriginTranslation, type StagedCityOrigin } from './lib/cityStreetNameOrigins.ts';

const city = process.argv.find((arg) => arg.startsWith('--city='))?.slice('--city='.length);
if (!city) throw new Error('--city=<id> is required');
const dryRun = process.argv.includes('--dry-run');
const directory = path.resolve(`public/data/extracts/${city}`);
const staged = JSON.parse(await readFile(path.join(directory, 'staging/street-name-origins.json'), 'utf8')) as {
  source: { url: string; field: string; retrievedAt: string; licence: string };
  origins: StagedCityOrigin[];
};

interface Review {
  spotChecked: string[];
  corrections: Record<string, { from: string; en: string }>;
  withheld: Record<string, string>;
}
const reviewPath = path.resolve(`scripts/data/street-name-origins-review.${city}.json`);
const review = JSON.parse(await readFile(reviewPath, 'utf8')) as Review;
if (review.spotChecked.length < 100) throw new Error(`${reviewPath}: spot-check at least 100 entries before publishing (have ${review.spotChecked.length})`);

interface PublishedOrigin { name: string; kind: 'street' | 'water' | 'bridge'; en: string; sourceUrl: string; enSource: string }
const origins: PublishedOrigin[] = [];
const problems: string[] = [];
let corrected = 0, untranslated = 0, refused = 0;
const refusedNow: string[] = [];
for (const origin of staged.origins) {
  const key = `${origin.kind}:${origin.name}`;
  if (review.withheld[key] || review.withheld[origin.name]) continue;
  const correction = review.corrections[key] ?? review.corrections[origin.name];
  if (correction) {
    if (!origin.nl.startsWith(correction.from)) { problems.push(`${key}: source changed since the correction`); continue; }
    origins.push({ name: origin.name, kind: origin.kind, en: correction.en, sourceUrl: origin.sourceUrl, enSource: 'reviewed' });
    corrected++;
    continue;
  }
  if (origin.refused) { refused++; continue; }
  if (!origin.en) { untranslated++; continue; }
  const en = trimToSentence(repairCityOriginTranslation(origin.nl, origin.en), 700);
  // The guard runs again at publish, so a check added after an entry was
  // translated (the kept-Dutch-word test) still applies to it.
  const late = refusalReason(origin.nl, origin.en, origin.name);
  if (late) { refused++; refusedNow.push(`${origin.name}: ${late}`); continue; }
  origins.push({ name: origin.name, kind: origin.kind, en, sourceUrl: origin.sourceUrl, enSource: origin.enSource ?? 'unknown' });
}
for (const name of Object.keys(review.corrections)) {
  if (!staged.origins.some((origin) => `${origin.kind}:${origin.name}` === name || origin.name === name)) problems.push(`correction for ${name} matches no staged origin`);
}

const output = { version: 1, source: staged.source, origins };
const cache = staged.origins.filter((origin) => origin.en)
  .map((origin) => ({ name: origin.name, hash: dutchHash(origin.nl), en: origin.en!, enSource: origin.enSource ?? 'unknown' }))
  .sort((a, b) => a.name.localeCompare(b.name, 'nl') || a.hash.localeCompare(b.hash));
if (!dryRun) {
  await writeFile(path.join(directory, 'street-name-origins.json'), `${JSON.stringify(output)}\n`);
  await writeFile(path.resolve(`scripts/data/street-name-origin-translations.${city}.json`), `${JSON.stringify(cache, null, 0).replace(/\},\{/g, '},\n{')}\n`);
}
for (const problem of problems) process.stdout.write(`  ! ${problem}\n`);
if (process.argv.includes('--verbose')) for (const line of refusedNow) process.stdout.write(`  refused at publish: ${line}\n`);
process.stdout.write(`${dryRun ? 'DRY RUN — would publish' : 'published'} ${origins.length} origins → ${path.relative(process.cwd(), path.join(directory, 'street-name-origins.json'))}`
  + ` (${(JSON.stringify(output).length / 1024).toFixed(0)} KB); ${corrected} hand corrections, ${refused} refused by the guard, ${untranslated} not yet translated,`
  + ` ${Object.keys(review.withheld).length} withheld, spot-checked ${review.spotChecked.length}\n`);
