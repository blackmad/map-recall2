/**
 * Hand-off for translating the Dutch building-article ledes in a Claude Code
 * session (or a haiku batch agent), the way `origin-translation-batch.ts`
 * does for street-name origins. Results land in the shared reviewed cache
 * `scripts/english-translations.json`, keyed by the hash of the exact Dutch
 * text, which `build-building-articles.ts` applies on its next run.
 *
 *   npx tsx scripts/building-articles-translation-batch.ts next [--count=40] [--out=dir]
 *     writes batch-NN.json files of {"id","name","nl"} still missing an English
 *   npx tsx scripts/building-articles-translation-batch.ts ingest <file.json> … [--force]
 *     reads [{"id","en"}], checks each (years kept, the place not renamed,
 *     ≤360 chars) and appends the good ones to the cache. `--force` waives
 *     the rename and year checks for a reviewed file: an article titled
 *     "Raadhuis van Ransdorp" is rightly "the town hall of Ransdorp" in the
 *     lede, since the card's title stays the Dutch article name.
 *   npx tsx scripts/building-articles-translation-batch.ts status
 */
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { droppedProperNames, trimToSentence } from './lib/translation.ts';

const argument = (name: string) => process.argv.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const masterFile = path.resolve('scripts/data/amsterdam-building-articles.json');
const cacheFile = path.resolve('scripts/english-translations.json');
const sha = (text: string) => createHash('sha1').update(text).digest('hex').slice(0, 12);

interface MasterRecord { name: string; title: string; extract: string; extractLang: string; original?: string; originalLang?: string }
interface CachedTranslation { name: string; lang: string; hash: string; en: string }
const master = JSON.parse(await readFile(masterFile, 'utf8')) as { articles: MasterRecord[] };
const cache = JSON.parse(await readFile(cacheFile, 'utf8').catch(() => '[]')) as CachedTranslation[];
const done = new Set(cache.map(entry => entry.hash));

const groups = new Map<string, { id: string; name: string; nl: string }>();
for (const record of master.articles) {
  const dutch = record.extractLang === 'nl' ? record.extract : record.originalLang === 'nl' ? record.original : null;
  if (!dutch) continue;
  const id = sha(dutch);
  if (!groups.has(id)) groups.set(id, { id, name: record.title, nl: dutch });
}
const pending = [...groups.values()].filter(group => !done.has(group.id));
const keepsNumbers = (nl: string, en: string) => {
  const english = new Set(en.match(/\d{3,4}/g) ?? []);
  return (nl.match(/\d{3,4}/g) ?? []).every(value => english.has(value));
};

const command = process.argv[2];
if (command === 'next') {
  const count = Number(argument('count') || 40);
  const out = path.resolve(argument('out') || 'public/data/extracts/amsterdam/staging/translation-batches');
  await mkdir(out, { recursive: true });
  let n = 0;
  for (let i = 0; i < pending.length; i += count) {
    const file = path.join(out, `batch-${String(++n).padStart(2, '0')}.json`);
    await writeFile(file, `${JSON.stringify(pending.slice(i, i + count), null, 1)}\n`);
  }
  process.stdout.write(`${pending.length} Dutch ledes pending in ${n} batch files under ${path.relative(process.cwd(), out)}\n`);
} else if (command === 'ingest') {
  const files = process.argv.slice(3).filter(file => !file.startsWith('--'));
  const force = process.argv.includes('--force');
  let added = 0;
  const problems: string[] = [];
  for (const file of files) {
    const results = JSON.parse(await readFile(file, 'utf8')) as Array<{ id: string; en: string }>;
    for (const { id, en } of results) {
      const group = groups.get(id);
      if (!group) { problems.push(`${path.basename(file)}: unknown id ${id}`); continue; }
      if (done.has(id)) continue;
      // Typographic dashes and quotes break the name check against the Dutch
      // ("Weteringschans 219–223", "Zon’s Hofje"); the names are hyphenated.
      const english = trimToSentence(en.replace(/\s+/g, ' ').replace(/[\u2018\u2019]/g, "'").replace(/(\d)\s*[\u2013\u2014]\s*(\d)/g, '$1-$2').trim());
      if (!english) { problems.push(`${group.name}: empty`); continue; }
      if (!force && !keepsNumbers(group.nl, english)) { problems.push(`${group.name}: a year went missing`); continue; }
      const dropped = force ? [] : droppedProperNames(group.nl, english, [group.name]);
      if (dropped.length) { problems.push(`${group.name}: renamed (${dropped.join(', ')})`); continue; }
      if (/^(here is|the translation|translation:)/i.test(english)) { problems.push(`${group.name}: commentary`); continue; }
      cache.push({ name: group.name, lang: 'nl', hash: id, en: english });
      done.add(id);
      added++;
    }
  }
  await writeFile(cacheFile, `${JSON.stringify(cache, null, 2)}\n`);
  process.stdout.write(`ingested ${added}; ${problems.length} refused\n${problems.map(p => `  ${p}`).join('\n')}${problems.length ? '\n' : ''}`);
} else {
  process.stdout.write(`${groups.size} distinct Dutch ledes, ${groups.size - pending.length} translated, ${pending.length} pending\n`);
}
