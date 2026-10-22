/**
 * Add the register's Dutch wording to `street-name-origins.json`.
 *
 * The published file carries only the English card text, because the ride used
 * to speak one language. Dutch mode needs the source sentence as well: the BAG
 * register is a Dutch municipal register, so its text is the primary source and
 * the English is the translation — not the other way round.
 *
 * `scripts/street-name-origin-translations.json` is the committed `trn` cache
 * of that register text (name + Dutch + English), where the Dutch column is the
 * register's own sentence. This script joins the two by name and appends `nl`,
 * verifying the cache row's content hash so a hand-edited or stale row cannot
 * attach the wrong text.
 *
 * Idempotent: re-running replaces `nl` rather than appending. Names the cache
 * does not cover keep English-only cards (the card still names its source).
 *
 * Usage: npm run add:dutch-street-origins [-- --check]
 */
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

interface CachedTranslation { name: string; hash?: string; en?: string; nl?: string; source?: string }
interface PublishedOrigin { name: string; kind: string; en: string; nl?: string; bagId?: string }

const directory = path.resolve('public/data/extracts/amsterdam');
const publishedFile = path.join(directory, 'street-name-origins.json');
const cacheFile = path.resolve('scripts/street-name-origin-translations.json');
const check = process.argv.includes('--check');

const published = JSON.parse(await readFile(publishedFile, 'utf8')) as { origins: PublishedOrigin[] } & Record<string, unknown>;
const cache = JSON.parse(await readFile(cacheFile, 'utf8')) as CachedTranslation[];

const hashOf = (row: CachedTranslation): string => createHash('sha1').update(`${row.name}\u0000${row.nl}`).digest('hex').slice(0, 12);

// One Dutch sentence per name; the cache can hold several rows for a name when
// the register text changed between fetches. The verified row wins.
const dutchByName = new Map<string, string>();
let unverified = 0;
for (const row of cache) {
  if (!row.name || !row.nl) continue;
  if (row.hash && hashOf(row) !== row.hash) { unverified += 1; continue; }
  const existing = dutchByName.get(row.name);
  // Prefer the longest, which is the complete sentence rather than a fragment.
  if (!existing || row.nl.length > existing.length) dutchByName.set(row.name, row.nl);
}

let added = 0;
let kept = 0;
const missing: string[] = [];
for (const origin of published.origins) {
  const dutch = dutchByName.get(origin.name);
  if (!dutch) { missing.push(origin.name); continue; }
  if (origin.nl === dutch) kept += 1;
  else added += 1;
  origin.nl = dutch;
}

const covered = published.origins.filter(origin => origin.nl).length;
const report = `${check ? 'check' : 'write'}: ${covered}/${published.origins.length} origins have Dutch`
  + ` (${added} added, ${kept} unchanged, ${missing.length} without a cached Dutch source`
  + `${unverified ? `, ${unverified} cache rows failed their hash` : ''})`;

if (check) {
  console.log(report);
  // In check mode, a file that is behind the cache is a build failure so the
  // Dutch column cannot silently rot after a cache refresh.
  if (added > 0) process.exitCode = 1;
} else {
  await writeFile(publishedFile, `${JSON.stringify(published)}\n`);
  console.log(report);
  console.log(`→ ${path.relative(process.cwd(), publishedFile)} (${(JSON.stringify(published).length / 1024).toFixed(0)} KB)`);
}
