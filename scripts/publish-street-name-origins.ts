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
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { indexOrigins, originFor, type NameOrigin } from './lib/streetNameOrigins.ts';

const directory = path.resolve('public/data/extracts/amsterdam');
const staged = JSON.parse(await readFile(path.join(directory, 'staging/street-name-origins.json'), 'utf8')) as {
  source: Record<string, string>;
  origins: NameOrigin[];
};
const index = indexOrigins(staged.origins);

interface PublishedOrigin { name: string; kind: 'street' | 'water' | 'bridge'; en: string; bagId: string }
const published = new Map<string, PublishedOrigin>();
const report: string[] = [];
for (const [file, kind] of [['streets-routing.json', 'street'], ['streets.json', 'street'], ['water.json', 'water'], ['bridges.json', 'bridge']] as const) {
  const data = JSON.parse(await readFile(path.join(directory, file), 'utf8'));
  const names = [...new Set(((Array.isArray(data) ? data : data.features) as Array<{ name?: string }>).map(feature => feature.name).filter((name): name is string => !!name))];
  let explained = 0, english = 0;
  for (const name of names) {
    const origin = originFor(index, name, kind);
    if (!origin) continue;
    explained++;
    if (!origin.en) continue;
    english++;
    published.set(`${kind}\u0000${name}`, { name, kind, en: origin.en, bagId: origin.bagId });
  }
  report.push(`  ${file}: ${names.length} names, ${explained} explained, ${english} with English`);
}

const origins = [...published.values()].sort((a, b) => a.kind.localeCompare(b.kind) || a.name.localeCompare(b.name, 'nl'));
const output = { version: 1, source: staged.source, origins };
if (!process.argv.includes('--dry-run')) {
  await writeFile(path.join(directory, 'street-name-origins.json'), `${JSON.stringify(output)}\n`);
}
process.stdout.write(`${process.argv.includes('--dry-run') ? 'DRY RUN — would publish' : 'published'} ${origins.length} origins`
  + ` → public/data/extracts/amsterdam/street-name-origins.json (${(JSON.stringify(output).length / 1024).toFixed(0)} KB)\n${report.join('\n')}\n`);
