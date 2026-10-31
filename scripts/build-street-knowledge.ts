/**
 * Build `street-knowledge.json` from the streets and water partitions that
 * already carry an encyclopedia blurb or URL.
 *
 * The curated sidecar used to drift from `streets.json` / `water.json` (and
 * once taught the wrong place). The game index prefers the partition extracts
 * anyway; this file stays as a compact legacy list generated in the same
 * refresh as those extracts so nothing ships a second, hand-edited truth.
 *
 * Usage: tsx scripts/build-street-knowledge.ts [extract-directory]
 */
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';

const directory = path.resolve(process.argv[2] || 'public/data/extracts/amsterdam');

type Feature = {
  id?: string;
  name: string;
  type?: string;
  wikidata?: string;
  wikipedia?: string;
  wikipediaUrl?: string;
  wikipediaExtract?: string;
  wikipediaExtractLang?: string;
  wikipediaExtractSource?: string;
  wikipediaExtractOriginal?: string;
  wikipediaExtractOriginalLang?: string;
};

const eligible = (feature: Feature) => !!(feature.wikipediaUrl || feature.wikipediaExtract);

const toEntry = (feature: Feature, type: 'street' | 'water') => {
  const entry: Feature & { type: 'street' | 'water' } = {
    id: feature.id,
    name: feature.name,
    type,
  };
  if (feature.wikidata) entry.wikidata = feature.wikidata;
  if (feature.wikipedia) entry.wikipedia = feature.wikipedia;
  if (feature.wikipediaUrl) entry.wikipediaUrl = feature.wikipediaUrl;
  if (feature.wikipediaExtract) entry.wikipediaExtract = feature.wikipediaExtract;
  if (feature.wikipediaExtractLang) entry.wikipediaExtractLang = feature.wikipediaExtractLang;
  if (feature.wikipediaExtractSource) entry.wikipediaExtractSource = feature.wikipediaExtractSource;
  if (feature.wikipediaExtractOriginal) entry.wikipediaExtractOriginal = feature.wikipediaExtractOriginal;
  if (feature.wikipediaExtractOriginalLang) {
    entry.wikipediaExtractOriginalLang = feature.wikipediaExtractOriginalLang;
  }
  return entry;
};

const streets = JSON.parse(await readFile(path.join(directory, 'streets.json'), 'utf8')) as Feature[];
const waters = JSON.parse(await readFile(path.join(directory, 'water.json'), 'utf8')) as Feature[];

// Street and square articles found by Wikidata coordinates + routable name
// (`build-street-articles.ts`): the streets the 500-street quiz pool left
// without a card. The partitions win where both name a street.
interface StreetArticle {
  name: string; wikidata: string; title: string; url: string; imageUrl: string | null;
  extract: string; extractLang: string; extractSource: string; original?: string; originalLang?: string;
}
const articleFile = path.resolve('scripts/data/amsterdam-street-articles.json');
const streetArticles = path.basename(directory) === 'amsterdam'
  ? await readFile(articleFile, 'utf8').then(text => (JSON.parse(text) as { articles: StreetArticle[] }).articles, () => [] as StreetArticle[])
  : [];
const normalise = (name: string) => name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
const carded = new Set([...streets, ...waters].filter(eligible).map(feature => normalise(feature.name)));
const articleEntries = streetArticles.filter(article => !carded.has(normalise(article.name))).map(article => {
  const entry: Feature & { type: 'street'; wikipediaImageUrl?: string } = {
    id: `article_streets_${createHash('sha1').update(article.name).digest('hex').slice(0, 10)}`,
    name: article.name, type: 'street', wikidata: article.wikidata,
    wikipedia: `${article.url.includes('//en.') ? 'en' : 'nl'}:${article.title}`, wikipediaUrl: article.url, wikipediaExtract: article.extract,
  };
  if (article.extractLang !== 'en') entry.wikipediaExtractLang = article.extractLang;
  if (article.extractSource !== 'wikipedia-en') entry.wikipediaExtractSource = article.extractSource;
  if (article.original) { entry.wikipediaExtractOriginal = article.original; entry.wikipediaExtractOriginalLang = article.originalLang; }
  if (article.imageUrl) entry.wikipediaImageUrl = article.imageUrl;
  return entry;
});

const entries = [
  ...streets.filter(eligible).map((feature) => toEntry(feature, 'street')),
  ...waters.filter(eligible).map((feature) => toEntry(feature, 'water')),
  ...articleEntries,
].sort((a, b) => a.name.localeCompare(b.name) || a.type.localeCompare(b.type));
process.stdout.write(`${articleEntries.length} street/square article entries added (${streetArticles.length - articleEntries.length} already carded by the partitions)\n`);

const output = path.join(directory, 'street-knowledge.json');
await writeFile(output, `${JSON.stringify(entries)}\n`);
process.stdout.write(
  `Wrote ${entries.length} street-knowledge entries `
  + `(${streets.filter(eligible).length} streets + ${waters.filter(eligible).length} water) to ${output}\n`,
);
