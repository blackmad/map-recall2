import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { StreetFeature } from '../src/types.ts';
import { cachedJsonFetch } from './lib/cached-json-fetch.ts';
import { ENCYCLOPEDIA_PARTITION_FILES } from './lib/encyclopedia-extract-files.ts';

const directoryArgument = process.argv.find((argument) => argument.startsWith('--directory='));
const directory = path.resolve(directoryArgument?.slice('--directory='.length) || 'public/data/extracts/amsterdam');
const files = [...ENCYCLOPEDIA_PARTITION_FILES];
const partitions = new Map<string, StreetFeature[]>();
for (const file of files) partitions.set(file, JSON.parse(await readFile(path.join(directory, file), 'utf8')));
const features = [...partitions.values()].flat();
const headers = { 'User-Agent': 'MapQuestExtractBuilder/1.0 (https://github.com/blackmad/map-recall2)' };
const chunks = <T>(items: T[], size: number) => Array.from({ length: Math.ceil(items.length / size) }, (_, index) => items.slice(index * size, (index + 1) * size));
async function fetchJson(url: URL, attempts = 4): Promise<any> {
  return cachedJsonFetch(url, { cacheDirectory: '.cache/wikimedia', headers, attempts, pauseMs: 250 });
}

const sitelinks = new Map<string, number>();
const englishTitles = new Map<string, string>();
const qids = [...new Set(features.flatMap(({ wikidata }) => wikidata ? [wikidata] : []))];
for (const batch of chunks(qids, 50)) {
  const url = new URL('https://www.wikidata.org/w/api.php');
  url.search = new URLSearchParams({ action: 'wbgetentities', format: 'json', props: 'sitelinks', ids: batch.join('|'), origin: '*' }).toString();
  const data = await fetchJson(url);
  for (const [qid, entity] of Object.entries(data.entities || {}) as [string, { sitelinks?: Record<string, { title?: string }> }][]) {
    sitelinks.set(qid, Object.keys(entity.sitelinks || {}).length);
    const englishTitle = entity.sitelinks?.enwiki?.title;
    if (englishTitle) englishTitles.set(qid, englishTitle);
  }
}

const pageviews = new Map<string, number>();
const pageDetails = new Map<string, { extract?: string; url?: string; image?: string }>();
const pagesByLanguage = new Map<string, Set<string>>();
for (const feature of features) {
  const preferredPage = (feature.wikidata && englishTitles.get(feature.wikidata))
    ? `en:${englishTitles.get(feature.wikidata)}`
    : feature.wikipedia;
  if (!preferredPage) continue;
  const separator = preferredPage.indexOf(':');
  const language = separator > 0 ? preferredPage.slice(0, separator) : 'en';
  const title = separator > 0 ? preferredPage.slice(separator + 1) : preferredPage;
  const pages = pagesByLanguage.get(language) || new Set<string>();
  pages.add(title);
  pagesByLanguage.set(language, pages);
}
for (const [language, titles] of pagesByLanguage) {
  for (const batch of chunks([...titles], 20)) {
    const url = new URL(`https://${language}.wikipedia.org/w/api.php`);
    url.search = new URLSearchParams({
      action: 'query', format: 'json', prop: 'pageviews|extracts|pageimages|info', pvipdays: '60', redirects: '1',
      exintro: '1', explaintext: '1', exchars: '360', piprop: 'thumbnail', pithumbsize: '640', inprop: 'url',
      titles: batch.join('|'), origin: '*',
    }).toString();
    const data = await fetchJson(url);
    const aliases = new Map<string, string>();
    for (const item of [...(data.query?.normalized || []), ...(data.query?.redirects || [])]) aliases.set(item.from, item.to);
    for (const page of Object.values(data.query?.pages || {}) as Array<{ title: string; pageviews?: Record<string, number | null>; extract?: string; fullurl?: string; thumbnail?: { source?: string } }>) {
      const views = Object.values(page.pageviews || {}).reduce<number>((sum, value) => sum + (value || 0), 0);
      pageviews.set(`${language}:${page.title}`, views);
      pageDetails.set(`${language}:${page.title}`, { extract: page.extract, url: page.fullurl, image: page.thumbnail?.source });
      for (const [original, target] of aliases) if (target === page.title) {
        pageviews.set(`${language}:${original}`, views);
        pageDetails.set(`${language}:${original}`, { extract: page.extract, url: page.fullurl, image: page.thumbnail?.source });
      }
    }
  }
}

for (const [file, partition] of partitions) {
  for (const feature of partition) {
    const preferredPage = (feature.wikidata && englishTitles.get(feature.wikidata))
      ? `en:${englishTitles.get(feature.wikidata)}`
      : feature.wikipedia;
    const views = preferredPage ? pageviews.get(preferredPage) || 0 : 0;
    const links = feature.wikidata ? sitelinks.get(feature.wikidata) || 0 : 0;
    const details = preferredPage ? pageDetails.get(preferredPage) : undefined;
    const score = Math.round(Math.log10(views + 1) * 18 + Math.log2(links + 1) * 12);
    feature.prominenceScore = (feature.prominenceScore || 0) - (feature.encyclopediaScore || 0) + score;
    feature.wikipediaPageviews60d = views || undefined;
    feature.wikidataSitelinks = links || undefined;
    feature.encyclopediaScore = score || undefined;
    // Keep the intro even when the tagged article is Dutch. Dropping it used
    // to leave streets as a Wikipedia URL with no card text, and the English
    // translation pass had nothing to work from. Tag the language so a later
    // pass can replace Dutch without guessing.
    if (details?.extract) {
      feature.wikipediaExtract = details.extract;
      const language = preferredPage && preferredPage.includes(':')
        ? preferredPage.slice(0, preferredPage.indexOf(':'))
        : 'en';
      if (language && language !== 'en') feature.wikipediaExtractLang = language;
      else delete feature.wikipediaExtractLang;
    }
    feature.wikipediaUrl = details?.url;
    feature.wikipediaImageUrl = details?.image;
  }
  partition.sort((a, b) => (b.prominenceScore || 0) - (a.prominenceScore || 0));
  await writeFile(path.join(directory, file), JSON.stringify(partition));
}

const water = partitions.get('water.json') || [];
process.stdout.write(`${JSON.stringify(water.filter(({ wikipedia, wikidata }) => wikipedia || wikidata).slice(0, 30).map((feature) => ({ name: feature.name, score: feature.encyclopediaScore, views60d: feature.wikipediaPageviews60d || 0, sitelinks: feature.wikidataSitelinks || 0 })), null, 2)}\n`);
