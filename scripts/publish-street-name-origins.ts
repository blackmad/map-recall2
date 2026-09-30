/**
 * Publish reviewed street-name origins into the Amsterdam extract.
 *
 * Reads `staging/street-name-origins.json` (fetched by
 * `fetch-street-name-origins.ts`, English added by
 * `translate-street-name-origins.ts`) and writes `street-name-origins.json`:
 * one English origin per name the game can ask, spelled as the extract spells
 * it so the runtime joins on its own names. The BAG id travels along so a
 * correction can be traced back to the register entry; the Dutch original and
 * its provenance stay in the committed staging file rather than doubling what
 * every ride downloads.
 *
 * Usage: npm run publish:street-name-origins [-- --dry-run]
 */
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { trimToSentence } from './lib/translation.ts';
import { indexOrigins, nameGenericOrigin, originFor, repairOriginTranslation, WITHHELD_ORIGINS, withoutCrossReference, type NameOrigin } from './lib/streetNameOrigins.ts';

const directory = path.resolve('public/data/extracts/amsterdam');
const staged = JSON.parse(await readFile(path.join(directory, 'staging/street-name-origins.json'), 'utf8')) as {
  source: Record<string, string>;
  origins: NameOrigin[];
};
const index = indexOrigins(staged.origins);
// Reviewed meanings of name stems, for origins that only name the class.
const { stems } = JSON.parse(await readFile(path.resolve('scripts/data/street-name-stems.json'), 'utf8')) as { stems: Record<string, string> };

// The language-model translation (`translate-street-name-origins-llm.ts`),
// keyed like the `trn` cache by name + Dutch, replaces the `trn` English
// wherever it has an entry. `--trn` publishes the old English instead.
const llmHash = (origin: NameOrigin) => createHash('sha1').update(`${origin.name}\u0000${origin.nl}`).digest('hex').slice(0, 12);
let llm = new Map<string, string>();
if (!process.argv.includes('--trn')) {
  try {
    const entries = JSON.parse(await readFile(path.resolve('scripts/street-name-origin-translations-llm.json'), 'utf8')) as Array<{ hash: string; en: string }>;
    llm = new Map(entries.map(entry => [entry.hash, entry.en]));
  } catch { /* no LLM pass yet */ }
}
let fromLlm = 0;
const englishOf = (origin: NameOrigin): string => {
  const better = origin.nl ? llm.get(llmHash(origin)) : undefined;
  // Cut like the trn pass (MAX_ORIGIN_CHARS there): whole sentences, 700 characters.
  if (better) { fromLlm++; return trimToSentence(better, 700); }
  return origin.en ?? '';
};

interface PublishedOrigin { name: string; kind: 'street' | 'water' | 'bridge'; en: string; bagId: string }
const published = new Map<string, PublishedOrigin>();
const report: string[] = [];
for (const [file, kind] of [['streets-routing.json', 'street'], ['streets.json', 'street'], ['water.json', 'water'], ['bridges.json', 'bridge']] as const) {
  const data = JSON.parse(await readFile(path.join(directory, file), 'utf8'));
  const names = [...new Set(((Array.isArray(data) ? data : data.features) as Array<{ name?: string }>).map(feature => feature.name).filter((name): name is string => !!name))];
  let explained = 0, english = 0;
  for (const name of names) {
    const origin = originFor(index, name, kind);
    if (!origin || WITHHELD_ORIGINS[name]) continue;
    explained++;
    if (!englishOf(origin)) continue;
    english++;
    const card = englishFor(name, origin, kind);
    if (!card) continue;
    published.set(`${kind}\u0000${name}`, { name, kind, en: card, bagId: origin.bagId });
  }
  report.push(`  ${file}: ${names.length} names, ${explained} explained, ${english} with English`);
}

/** The card text for an origin; "See Rozengracht." borrows the Rozengracht's
 *  text, once, and a reference that leads nowhere publishes nothing. */
function englishFor(name: string, origin: NameOrigin, kind: 'street' | 'water' | 'bridge', depth = 0): string {
  const repaired = repairOriginTranslation(origin.nl, englishOf(origin));
  const { text, see } = withoutCrossReference(repaired);
  if (see) {
    const target = depth === 0 ? originFor(index, see, kind) ?? originFor(index, see, kind === 'street' ? 'water' : 'street') : null;
    return target && englishOf(target) && target.name !== name ? englishFor(target.name, target, kind, depth + 1) : '';
  }
  return nameGenericOrigin(name, text, stems);
}

const origins = [...published.values()].sort((a, b) => a.kind.localeCompare(b.kind) || a.name.localeCompare(b.name, 'nl'));
const output = { version: 1, source: staged.source, origins };
if (!process.argv.includes('--dry-run')) {
  await writeFile(path.join(directory, 'street-name-origins.json'), `${JSON.stringify(output)}\n`);
}
process.stdout.write(`${process.argv.includes('--dry-run') ? 'DRY RUN — would publish' : 'published'} ${origins.length} origins`
  + ` → public/data/extracts/amsterdam/street-name-origins.json (${(JSON.stringify(output).length / 1024).toFixed(0)} KB)\n${report.join('\n')}\n`
  + `  English from the language-model pass for ${fromLlm} lookups; the rest from trn\n`);
