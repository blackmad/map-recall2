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
 * The register is not a reliable text: `docs/amsterdam-street-name-register-errors.md`
 * records where it is filed under the wrong name, is a fragment, stops
 * mid-sentence or states something false. For every name that document does not
 * mark "kept", the Dutch column is withheld, so Dutch mode falls back to the
 * corrected English card instead of printing a sentence we know to be wrong
 * (scripts/dutch-street-origin-corrections.json, derived from that document).
 *
 * Usage: npm run add:dutch-street-origins [-- --check]
 */
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

interface CachedTranslation { name: string; hash?: string; en?: string; nl?: string; source?: string }
interface PublishedOrigin { name: string; kind: string; en: string; nl?: string; bagId?: string }

const directory = path.resolve('public/data/extracts/amsterdam');
const publishedFile = path.join(directory, 'street-name-origins.json');
const cacheFile = path.resolve('scripts/street-name-origin-translations.json');
const check = process.argv.includes('--check');

const published = JSON.parse(await readFile(publishedFile, 'utf8')) as { origins: PublishedOrigin[] } & Record<string, unknown>;
const cache = JSON.parse(await readFile(cacheFile, 'utf8')) as CachedTranslation[];
const correctionsFile = path.resolve('scripts/dutch-street-origin-corrections.json');
const corrections = JSON.parse(await readFile(correctionsFile, 'utf8')) as {
  source: string;
  withheldNl: Record<string, { handling?: string }>;
  corrections?: Record<string, { replace?: Array<[string, string]>; note?: string }>;
  /** A whole Dutch sentence composed from another register record, with its source. */
  nlOverrides?: Record<string, { nl: string; source: string }>;
};
/**
 * Targeted Dutch fixes for names where the register's fault is a wrong token
 * (a date, a name, a country). The pairs come from the error register's own
 * quoted Dutch, so a replacement that no longer occurs means the register text
 * changed under us and the build stops rather than shipping either version.
 */
function applyDutchCorrections(name: string, dutch: string): string {
  // The register writes "..", " ." and similar; a card prints one full stop.
  let text = dutch.replace(/\s+\.\s*$/, '.').replace(/\.\.\s*$/, '.');
  const entry = corrections.corrections?.[name];
  if (!entry?.replace?.length) return text;
  for (const [find, replacement] of entry.replace) {
    if (!text.includes(find)) {
      throw new Error(`${name}: correction target not found in the register text: ${JSON.stringify(find)}`);
    }
    text = text.replace(find, replacement);
  }
  return text;
}

const hashOf = (row: CachedTranslation): string => createHash('sha1').update(`${row.name}\u0000${row.nl}`).digest('hex').slice(0, 12);

// One Dutch sentence per name; the cache can hold several rows for a name when
// the register text changed between fetches. The verified row wins.
const dutchByName = new Map<string, string>();
/** Spelling variants: "Katten brug" in the extract against "Kattenbrug" in the register. */
const normaliseName = (name: string) => name.toLocaleLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
const dutchByNormalised = new Map<string, string>();
let unverified = 0;
for (const row of cache) {
  if (!row.name || !row.nl) continue;
  if (row.hash && hashOf(row) !== row.hash) { unverified += 1; continue; }
  const existing = dutchByName.get(row.name);
  // Prefer the longest, which is the complete sentence rather than a fragment.
  if (!existing || row.nl.length > existing.length) {
    dutchByName.set(row.name, row.nl);
    dutchByNormalised.set(normaliseName(row.name), row.nl);
  }
}

/**
 * The register itself, for names the translation cache never covered (mostly
 * bridges whose extract spelling differs). Cached under staging, so a rerun
 * does not re-ask, and only consulted when the name is not withheld.
 */
const bagCacheFile = path.join(directory, 'staging', 'bag-dutch-origins.json');
let bagCache: Record<string, string> = {};
try { bagCache = JSON.parse(await readFile(bagCacheFile, 'utf8')) as Record<string, string>; } catch { /* first run */ }
async function bagDutch(name: string, bagId: string | undefined): Promise<string | undefined> {
  if (!bagId) return undefined;
  if (bagCache[bagId] !== undefined) return bagCache[bagId] || undefined;
  try {
    const response = await fetch(`https://api.data.amsterdam.nl/v1/bag/openbareruimtes/${bagId}/`, {
      headers: { 'user-agent': 'CanalRecall/1.0 (Dutch trivia sources)' },
    });
    if (!response.ok) return undefined;
    const body = await response.json() as { beschrijvingNaam?: string };
    const text = (body.beschrijvingNaam || '').trim();
    bagCache[bagId] = text;
    await new Promise((resolve) => setTimeout(resolve, 800));
    return text || undefined;
  } catch {
    return undefined; // transient: retried next run
  }
}

let added = 0;
let kept = 0;
let withheld = 0;
const missing: string[] = [];
for (const origin of published.origins) {
  // A name the error register does not mark "kept" must not show its Dutch.
  if (corrections.withheldNl[origin.name]) {
    if (origin.nl) { delete origin.nl; added += 1; }
    withheld += 1;
    continue;
  }
  const override = corrections.nlOverrides?.[origin.name];
  const cached = dutchByName.get(origin.name) ?? dutchByNormalised.get(normaliseName(origin.name));
  if (override) {
    if (origin.nl === override.nl) kept += 1; else added += 1;
    origin.nl = override.nl;
    continue;
  }
  if (!cached) {
    const fetched = await bagDutch(origin.name, origin.bagId);
    if (!fetched) { missing.push(origin.name); continue; }
    origin.nl = applyDutchCorrections(origin.name, fetched);
    added += 1;
    continue;
  }
  const dutch = applyDutchCorrections(origin.name, cached);
  if (origin.nl === dutch) kept += 1;
  else added += 1;
  origin.nl = dutch;
}

const covered = published.origins.filter(origin => origin.nl).length;
const report = `${check ? 'check' : 'write'}: ${covered}/${published.origins.length} origins have Dutch`
  + ` (${added} added, ${kept} unchanged, ${withheld} withheld as documented register errors,`
  + ` ${missing.length} without a cached Dutch source`
  + `${unverified ? `, ${unverified} cache rows failed their hash` : ''})`;

try {
  await mkdir(path.dirname(bagCacheFile), { recursive: true });
  await writeFile(bagCacheFile, `${JSON.stringify(bagCache, null, 1)}\n`);
} catch { /* staging is optional */ }
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
