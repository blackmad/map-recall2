/**
 * Backfill `wikipediaExtract` for Amsterdam landmarks, bridges, streets,
 * water, squares and parks.
 *
 * Most of these features only carry a Dutch article in their `wikipedia`
 * field ("nl:Blauwbrug"), but the game shows English blurbs, so the article
 * stored on the feature is usually the wrong thing to read. English is
 * resolved in two steps, because either one alone leaves gaps:
 *
 *   1. the feature's Wikidata Q-id -> its `enwiki` sitelink;
 *   2. failing that, the *Dutch article's* interwiki link to English. When OSM
 *      supplied only a Wikidata id, discover that Dutch article from the
 *      entity's `nlwiki` sitelink first.
 *
 * Step 2 exists because OSM sometimes tags a building item (Q42175133, the
 * Stedelijk's building) that has no English article, while the Dutch article
 * belongs to the institution item, which does. Going through the article
 * instead of the tagged Q-id recovers those (Stedelijk, De Balie, Allard
 * Pierson) — a handful, but they are the well-known places.
 *
 * Only when English has nothing do we keep the Dutch lede, tagged with
 * `wikipediaExtractLang` so a later pass can find (or translate) those.
 *
 * The UI-facing extract stays capped at 360 characters. A longer source copy
 * is retained for cacheable local fact generation without another API call.
 *
 * Usage: npm run enrich:amsterdam-wikipedia [-- --dry-run] [-- --limit=20]
 *                               [-- --files=streets.json,water.json]
 *                               [-- --directory=public/data/extracts/amsterdam]
 */
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { cachedJsonFetch } from './lib/cached-json-fetch.ts';
import { ENCYCLOPEDIA_PARTITION_FILES } from './lib/encyclopedia-extract-files.ts';
import { cityById } from '../src/canalRecall/game/cities.ts';
import { isDisambiguationExtract } from '../src/canalRecall/game/encyclopediaDisambiguation.ts';
import { resolveStreetWikipedia } from '../src/canalRecall/game/streetWikipedia.ts';

interface Feature {
  name: string;
  wikidata?: string;
  wikipedia?: string;
  wikipediaExtract?: string;
  /** Longer cached source used by the local fact generator, not rendered directly. */
  wikipediaSourceText?: string;
  wikipediaUrl?: string;
  wikipediaImageUrl?: string;
  /** Set only for non-English blurbs, so they can be told apart later. */
  wikipediaExtractLang?: string;
  /** 'wikidata-description' when the blurb is a thin English floor from Wikidata. */
  wikipediaExtractSource?: string;
}

interface PageDetail {
  extract?: string;
  url?: string;
  image?: string;
  /** Title of the English article this page links to, when it is not itself English. */
  englishTitle?: string;
}

const directoryArgument = process.argv.find((argument) => argument.startsWith('--directory='));
const directory = path.resolve(directoryArgument?.slice('--directory='.length) || 'public/data/extracts/amsterdam');
const cityId = path.basename(directory);
const cityName = cityById(cityId).name;
const filesArgument = process.argv.find((argument) => argument.startsWith('--files='));
const defaultFiles = [...ENCYCLOPEDIA_PARTITION_FILES];
const files = filesArgument
  ? filesArgument.slice('--files='.length).split(',').map((name) => name.trim()).filter(Boolean)
  : defaultFiles;
const EXTRACT_CHARS = 2400;
const DISPLAY_EXTRACT_CHARS = 360;

const dryRun = process.argv.includes('--dry-run');
const limitArgument = process.argv.find((argument) => argument.startsWith('--limit='));
const limit = limitArgument ? Number(limitArgument.slice('--limit='.length)) : Infinity;

const headers = { 'User-Agent': 'map-recall2 amsterdam wikipedia extracts (https://github.com/blackmad/map-recall2)' };
const chunks = <T>(items: T[], size: number) =>
  Array.from({ length: Math.ceil(items.length / size) }, (_, index) => items.slice(index * size, (index + 1) * size));

/** Retries the throttling responses the Wikimedia APIs use, then pauses so we stay a polite client. */
async function fetchJson(url: URL, attempts = 4): Promise<any> {
  return cachedJsonFetch(url, { cacheDirectory: '.cache/wikimedia', headers, attempts, pauseMs: 250 });
}

const splitPage = (page: string) => {
  const separator = page.indexOf(':');
  return separator > 0
    ? { language: page.slice(0, separator), title: page.slice(separator + 1) }
    : { language: 'en', title: page };
};

/**
 * Fetch intro extracts (and, off English, the interwiki link to English) for a
 * batch of titles on one wiki. Keyed "lang:Title" for every alias that led to
 * the page, since MediaWiki answers under normalised/redirect-resolved titles.
 */
async function fetchPages(language: string, titles: string[], withLangLinks: boolean): Promise<Map<string, PageDetail>> {
  const details = new Map<string, PageDetail>();
  const batches = chunks(titles, 20);
  process.stdout.write(`  fetching ${titles.length} ${language} articles in ${batches.length} batches\n`);
  for (const batch of batches) {
    const url = new URL(`https://${language}.wikipedia.org/w/api.php`);
    url.search = new URLSearchParams({
      action: 'query', format: 'json', redirects: '1', titles: batch.join('|'),
      prop: withLangLinks ? 'extracts|info|langlinks|pageimages|pageprops' : 'extracts|info|pageimages|pageprops', inprop: 'url',
      exintro: '1', explaintext: '1', exchars: String(EXTRACT_CHARS), exlimit: '20',
      piprop: 'thumbnail', pithumbsize: '640',
      ppprop: 'disambiguation',
      ...(withLangLinks ? { lllang: 'en' } : {}),
    }).toString();
    const data = await fetchJson(url);
    // MediaWiki rewrites titles (capitalisation, underscores) and follows
    // redirects, so results arrive under names we never asked for. Record the
    // answer under every alias that resolves to the page we got back.
    const aliases = new Map<string, string>();
    for (const item of [...(data.query?.normalized || []), ...(data.query?.redirects || [])] as { from: string; to: string }[]) {
      aliases.set(item.from, item.to);
    }
    const pages = Object.values(data.query?.pages || {}) as {
      title: string;
      extract?: string;
      fullurl?: string;
      thumbnail?: { source?: string };
      langlinks?: { lang: string; '*': string }[];
      pageprops?: { disambiguation?: string };
    }[];
    for (const page of pages) {
      if (page.pageprops && 'disambiguation' in page.pageprops) continue;
      if (isDisambiguationExtract(page.extract)) continue;
      const detail: PageDetail = {
        extract: page.extract,
        url: page.fullurl,
        image: page.thumbnail?.source,
        englishTitle: page.langlinks?.find((link) => link.lang === 'en')?.['*'],
      };
      details.set(`${language}:${page.title}`, detail);
      for (const from of aliases.keys()) {
        // A title can be normalised and *then* redirected, so walk the chain.
        let resolved = from;
        for (let hop = 0; hop < 3 && aliases.has(resolved); hop++) resolved = aliases.get(resolved)!;
        if (resolved === page.title) details.set(`${language}:${from}`, detail);
      }
    }
  }
  return details;
}

const partitions = new Map<string, Feature[]>();
for (const file of files) partitions.set(file, JSON.parse(await readFile(path.join(directory, file), 'utf8')));

// A prior run may have discovered the article only after the broad Wikimedia
// enrichment pass. Treat a missing thumbnail as pending too, so rerunning the
// pipeline repairs that ordering rather than preserving a permanently bare card.
const pendingSet = new Set<Feature>([...partitions.values()].flat()
  .filter((feature) => !feature.wikipediaExtract || !feature.wikipediaImageUrl || !feature.wikipediaSourceText).slice(0, limit));
const pending = [...pendingSet];
process.stdout.write(`${pending.length} features pending extract, image, or long-source enrichment\n`);

// Step 0: streets/water with no OSM wikipedia/wikidata tags. The live game used
// to look these up in the browser and showed Dutch ledes with an NL badge.
// Title discovery belongs here, with the rest of the published extract.
const titleFetch = async (url: string) => fetchJson(new URL(url));
let discoveredByTitle = 0;
const filledByTitle = new Map<string, number>();
for (const file of ['streets.json', 'water.json']) {
  if (!partitions.has(file)) continue;
  for (const feature of partitions.get(file)!) {
    if (!pendingSet.has(feature)) continue;
    if (feature.wikipedia || feature.wikidata) continue;
    const resolved = await resolveStreetWikipedia(feature.name, titleFetch, cityName);
    if (!resolved?.wikipediaExtract && !resolved?.wikipediaUrl) continue;
    if (isDisambiguationExtract(resolved.wikipediaExtract)) continue;
    if (resolved.wikipedia) feature.wikipedia = resolved.wikipedia;
    if (resolved.wikidata) feature.wikidata = resolved.wikidata;
    if (resolved.wikipediaUrl) feature.wikipediaUrl = resolved.wikipediaUrl;
    if (resolved.wikipediaExtract) {
      feature.wikipediaSourceText = resolved.wikipediaExtract;
      feature.wikipediaExtract = resolved.wikipediaExtract.slice(0, DISPLAY_EXTRACT_CHARS);
      if (resolved.wikipediaExtractLang === 'en') delete feature.wikipediaExtractLang;
      else feature.wikipediaExtractLang = resolved.wikipediaExtractLang;
    }
    pendingSet.delete(feature);
    discoveredByTitle++;
    filledByTitle.set(file, (filledByTitle.get(file) || 0) + 1);
  }
}
process.stdout.write(`${discoveredByTitle} untagged streets/water resolved by article title\n`);

// Remaining work after title discovery.
const remaining = [...pendingSet];

// Step 1: Q-id -> English and Dutch article titles. Some OSM features carry a
// Wikidata tag but no wikipedia tag (Fatih Mosque is one); without discovering
// nlwiki here they never acquire source text for the translation pass.
const englishByQid = new Map<string, string>();
const dutchByQid = new Map<string, string>();
const imageByQid = new Map<string, string>();
const qids = [...new Set(remaining.flatMap((feature) => (feature.wikidata ? [feature.wikidata] : [])))];
for (const batch of chunks(qids, 50)) {
  const url = new URL('https://www.wikidata.org/w/api.php');
  url.search = new URLSearchParams({
    // `sitefilter` accepts one site here rather than a pipe-separated set;
    // asking for all sitelinks keeps both enwiki and nlwiki available.
    action: 'wbgetentities', format: 'json', props: 'sitelinks|claims', ids: batch.join('|'),
  }).toString();
  const data = await fetchJson(url);
  for (const [qid, entity] of Object.entries(data.entities || {}) as [string, {
    sitelinks?: Record<string, { title?: string }>;
    claims?: { P18?: { mainsnak?: { datavalue?: { value?: string } } }[] };
  }][]) {
    const englishTitle = entity.sitelinks?.enwiki?.title;
    const dutchTitle = entity.sitelinks?.nlwiki?.title;
    if (englishTitle) englishByQid.set(qid, englishTitle);
    if (dutchTitle) dutchByQid.set(qid, dutchTitle);
    const image = entity.claims?.P18?.[0]?.mainsnak?.datavalue?.value;
    if (image) imageByQid.set(qid, image);
  }
}
process.stdout.write(`${englishByQid.size} of ${qids.length} Q-ids have an English sitelink\n`);
process.stdout.write(`${dutchByQid.size} of ${qids.length} Q-ids have a Dutch sitelink\n`);

let discoveredDutch = 0;
for (const feature of remaining) {
  if (feature.wikipedia || !feature.wikidata) continue;
  const title = dutchByQid.get(feature.wikidata);
  if (!title) continue;
  feature.wikipedia = `nl:${title}`;
  discoveredDutch++;
}
process.stdout.write(`${discoveredDutch} missing wikipedia tags recovered through Wikidata nlwiki\n`);

// Step 2: read the stored (usually Dutch) articles — both for their own lede,
// which is the fallback, and for their interwiki link to English.
const foreignByLanguage = new Map<string, Set<string>>();
for (const feature of remaining) {
  if (feature.wikidata && englishByQid.has(feature.wikidata)) continue;
  if (!feature.wikipedia) continue;
  const { language, title } = splitPage(feature.wikipedia);
  if (language === 'en') continue;
  const titles = foreignByLanguage.get(language) || new Set<string>();
  titles.add(title);
  foreignByLanguage.set(language, titles);
}
const foreignDetails = new Map<string, PageDetail>();
for (const [language, titles] of foreignByLanguage) {
  for (const [key, detail] of await fetchPages(language, [...titles], true)) foreignDetails.set(key, detail);
}

/** English article for a feature, from its Q-id or via its foreign article's interwiki link. */
function englishTitleFor(feature: Feature): { title: string; via: 'wikidata' | 'langlink' } | undefined {
  const fromQid = feature.wikidata ? englishByQid.get(feature.wikidata) : undefined;
  if (fromQid) return { title: fromQid, via: 'wikidata' };
  const fromArticle = feature.wikipedia ? foreignDetails.get(feature.wikipedia)?.englishTitle : undefined;
  if (fromArticle) return { title: fromArticle, via: 'langlink' };
  return undefined;
}

// Step 3: pull the English extracts for everything we managed to resolve.
const englishTitles = new Set(remaining.flatMap((feature) => {
  const english = englishTitleFor(feature);
  return english ? [english.title] : [];
}));
const englishDetails = englishTitles.size ? await fetchPages('en', [...englishTitles], false) : new Map<string, PageDetail>();

// Wikipedia's pageimages extension can omit a perfectly usable lead image.
// Wikidata P18 is the authoritative fallback, but resolve it through Commons'
// imageinfo API so cards receive a direct, canvas-safe upload.wikimedia URL.
const commonsImages = new Map<string, string>();
const neededCommonsFiles = [...new Set(remaining.flatMap((feature) => {
  const filename = feature.wikidata ? imageByQid.get(feature.wikidata) : undefined;
  return filename ? [filename] : [];
}))];
for (const batch of chunks(neededCommonsFiles, 20)) {
  const url = new URL('https://commons.wikimedia.org/w/api.php');
  url.search = new URLSearchParams({
    action: 'query', format: 'json', redirects: '1', prop: 'imageinfo', iiprop: 'url', iiurlwidth: '640',
    titles: batch.map((filename) => `File:${filename}`).join('|'),
  }).toString();
  const data = await fetchJson(url);
  for (const page of Object.values(data.query?.pages || {}) as {
    title?: string; imageinfo?: { thumburl?: string; url?: string }[];
  }[]) {
    const filename = page.title?.replace(/^File:/, '');
    const image = page.imageinfo?.[0]?.thumburl || page.imageinfo?.[0]?.url;
    if (filename && image) commonsImages.set(filename, image);
  }
}

// Step 4: write the blurbs back. Features that still have only a Q-id and no
// article get Wikidata's English description as a thin floor — better a true
// one-liner than a silent card that looked "linked" in OSM.
const filled = new Map<string, number>();
const viaCounts = new Map<string, number>();
const fallbackCounts = new Map<string, number>();
const unresolved: string[] = [];
const needsDescription: Feature[] = [];
const needsDisambiguationFollow: { feature: Feature; file: string }[] = [];
for (const [file, partition] of partitions) {
  for (const feature of partition) {
    if (!pendingSet.has(feature)) continue;
    const english = englishTitleFor(feature);
    const englishExtract = english ? englishDetails.get(`en:${english.title}`) : undefined;
    const foreign = feature.wikipedia ? foreignDetails.get(feature.wikipedia) : undefined;
    if (english && englishExtract?.extract && !isDisambiguationExtract(englishExtract.extract)) {
      feature.wikipediaSourceText = englishExtract.extract;
      feature.wikipediaExtract = englishExtract.extract.slice(0, DISPLAY_EXTRACT_CHARS);
      // Existing entries all point at en.wikipedia when the blurb is English.
      if (englishExtract.url) feature.wikipediaUrl = englishExtract.url;
      delete feature.wikipediaExtractLang;
      viaCounts.set(english.via, (viaCounts.get(english.via) || 0) + 1);
    } else if (foreign?.extract && feature.wikipedia && !isDisambiguationExtract(foreign.extract)) {
      const { language } = splitPage(feature.wikipedia);
      feature.wikipediaSourceText = foreign.extract;
      feature.wikipediaExtract = foreign.extract.slice(0, DISPLAY_EXTRACT_CHARS);
      feature.wikipediaExtractLang = language;
      if (!feature.wikipediaUrl && foreign.url) feature.wikipediaUrl = foreign.url;
      fallbackCounts.set(language, (fallbackCounts.get(language) || 0) + 1);
    } else if (
      (englishExtract?.extract && isDisambiguationExtract(englishExtract.extract))
      || (foreign?.extract && isDisambiguationExtract(foreign.extract))
      // Pageprops stripped the dab extract from the batch map, but OSM still
      // points at the list page — try `Name (City)` / dab follow before the
      // Wikidata "Wikimedia disambiguation page." floor.
      || (feature.wikipedia && !englishExtract?.extract && !foreign?.extract)
    ) {
      needsDisambiguationFollow.push({ feature, file });
      continue;
    } else if (feature.wikidata) {
      needsDescription.push(feature);
      continue;
    } else {
      const reason = !feature.wikipedia && !feature.wikidata ? 'no wikidata or wikipedia tag'
        : !feature.wikipedia ? 'wikidata only, no English or Dutch article'
        : 'linked article is missing or has no intro text';
      unresolved.push(`${feature.name} [${file}] — ${reason}`);
      continue;
    }
    const wikidataImage = feature.wikidata ? imageByQid.get(feature.wikidata) : undefined;
    const image = englishExtract?.image || foreign?.image || (wikidataImage ? commonsImages.get(wikidataImage) : undefined);
    if (image) feature.wikipediaImageUrl = image;
    filled.set(file, (filled.get(file) || 0) + 1);
  }
}

let followedDisambiguation = 0;
async function followDisambiguation(feature: Feature, file: string): Promise<boolean> {
  const resolved = await resolveStreetWikipedia(feature.name, titleFetch, cityName);
  if (!resolved?.wikipediaExtract || isDisambiguationExtract(resolved.wikipediaExtract)) {
    delete feature.wikipedia;
    delete feature.wikipediaUrl;
    delete feature.wikipediaExtract;
    delete feature.wikipediaExtractLang;
    delete feature.wikipediaExtractSource;
    delete feature.wikipediaSourceText;
    unresolved.push(`${feature.name} [${file}] — linked article is a disambiguation page`);
    return false;
  }
  if (resolved.wikipedia) feature.wikipedia = resolved.wikipedia;
  if (resolved.wikidata) feature.wikidata = resolved.wikidata;
  if (resolved.wikipediaUrl) feature.wikipediaUrl = resolved.wikipediaUrl;
  feature.wikipediaSourceText = resolved.wikipediaExtract;
  feature.wikipediaExtract = resolved.wikipediaExtract.slice(0, DISPLAY_EXTRACT_CHARS);
  delete feature.wikipediaExtractSource;
  if (resolved.wikipediaExtractLang === 'en') delete feature.wikipediaExtractLang;
  else feature.wikipediaExtractLang = resolved.wikipediaExtractLang;
  followedDisambiguation++;
  filled.set(file, (filled.get(file) || 0) + 1);
  return true;
}

for (const { feature, file } of needsDisambiguationFollow) {
  await followDisambiguation(feature, file);
}

const descriptionByQid = new Map<string, string>();
const descriptionQids = [...new Set(needsDescription.map((feature) => feature.wikidata!).filter(Boolean))];
for (const batch of chunks(descriptionQids, 50)) {
  const url = new URL('https://www.wikidata.org/w/api.php');
  url.search = new URLSearchParams({
    action: 'wbgetentities', format: 'json', props: 'descriptions', languages: 'en',
    ids: batch.join('|'), origin: '*',
  }).toString();
  const data = await fetchJson(url);
  for (const [qid, entity] of Object.entries(data.entities || {}) as [string, {
    descriptions?: { en?: { value?: string } };
  }][]) {
    const value = entity.descriptions?.en?.value;
    if (!value) continue;
    descriptionByQid.set(qid, `${value.charAt(0).toUpperCase()}${value.slice(1)}.`);
  }
}
let described = 0;
for (const [file, partition] of partitions) {
  for (const feature of partition) {
    if (!needsDescription.includes(feature)) continue;
    const description = feature.wikidata ? descriptionByQid.get(feature.wikidata) : undefined;
    if (!description || isDisambiguationExtract(description)) {
      // Wikidata sometimes describes the dab item itself as
      // "Wikimedia disambiguation page." — try a city-qualified article.
      if (file === 'streets.json' || file === 'water.json') {
        await followDisambiguation(feature, file);
      } else {
        unresolved.push(`${feature.name} [${file}] — wikidata only, no English description`);
      }
      continue;
    }
    feature.wikipediaExtract = description.slice(0, DISPLAY_EXTRACT_CHARS);
    feature.wikipediaSourceText = description;
    feature.wikipediaExtractSource = 'wikidata-description';
    delete feature.wikipediaExtractLang;
    const wikidataImage = feature.wikidata ? imageByQid.get(feature.wikidata) : undefined;
    const image = wikidataImage ? commonsImages.get(wikidataImage) : undefined;
    if (image) feature.wikipediaImageUrl = image;
    filled.set(file, (filled.get(file) || 0) + 1);
    described++;
  }
  if (!dryRun) await writeFile(path.join(directory, file), JSON.stringify(partition));
}

if (followedDisambiguation) {
  process.stdout.write(`followed ${followedDisambiguation} disambiguation pages to a city-qualified article\n`);
}

process.stdout.write(`\n${dryRun ? 'DRY RUN — nothing written' : `wrote ${files.join(', ')}`}\n`);
for (const [file, count] of filledByTitle) process.stdout.write(`  ${file}: ${count} by title discovery\n`);
for (const [file, count] of filled) process.stdout.write(`  ${file}: ${count} extracts added\n`);
for (const [via, count] of viaCounts) process.stdout.write(`  english via ${via}: ${count}\n`);
for (const [language, count] of fallbackCounts) process.stdout.write(`  fallback ${language}: ${count}\n`);
process.stdout.write(`  Wikidata descriptions: ${described}\n`);
process.stdout.write(`  still without an extract: ${unresolved.length}\n`);
for (const line of unresolved) process.stdout.write(`    ${line}\n`);
