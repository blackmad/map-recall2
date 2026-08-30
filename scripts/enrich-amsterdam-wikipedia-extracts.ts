/**
 * Backfill `wikipediaExtract` for Amsterdam landmarks and bridges.
 *
 * Most of these features only carry a Dutch article in their `wikipedia`
 * field ("nl:Blauwbrug"), but the game shows English blurbs, so the article
 * stored on the feature is usually the wrong thing to read. English is
 * resolved in two steps, because either one alone leaves gaps:
 *
 *   1. the feature's Wikidata Q-id -> its `enwiki` sitelink;
 *   2. failing that, the *Dutch article's* interwiki link to English.
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
 * Extracts are capped at 360 characters to match the blurbs already in these
 * files (written by scripts/enrich-amsterdam-wikimedia.ts) — the UI expects a
 * short paragraph, not a full lede.
 *
 * Usage: npm run enrich:amsterdam-wikipedia [-- --dry-run] [-- --limit=20]
 */
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

interface Feature {
  name: string;
  wikidata?: string;
  wikipedia?: string;
  wikipediaExtract?: string;
  wikipediaUrl?: string;
  /** Set only for non-English blurbs, so they can be told apart later. */
  wikipediaExtractLang?: string;
}

interface PageDetail {
  extract?: string;
  url?: string;
  /** Title of the English article this page links to, when it is not itself English. */
  englishTitle?: string;
}

const directory = path.resolve('public/data/extracts/amsterdam');
const files = ['landmarks.json', 'bridges.json'];
const EXTRACT_CHARS = 360;

const dryRun = process.argv.includes('--dry-run');
const limitArgument = process.argv.find((argument) => argument.startsWith('--limit='));
const limit = limitArgument ? Number(limitArgument.slice('--limit='.length)) : Infinity;

const headers = { 'User-Agent': 'map-recall2 amsterdam wikipedia extracts (https://github.com/blackmad/map-recall2)' };
const chunks = <T>(items: T[], size: number) =>
  Array.from({ length: Math.ceil(items.length / size) }, (_, index) => items.slice(index * size, (index + 1) * size));
const wait = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));

/** Retries the throttling responses the Wikimedia APIs use, then pauses so we stay a polite client. */
async function fetchJson(url: URL, attempts = 4): Promise<any> {
  for (let attempt = 0; attempt < attempts; attempt++) {
    const response = await fetch(url, { headers });
    if (response.ok) {
      const data = await response.json();
      await wait(250);
      return data;
    }
    const retryable = response.status === 429 || response.status >= 500;
    if (!retryable || attempt === attempts - 1) throw new Error(`${url.hostname}: HTTP ${response.status}`);
    await wait(Number(response.headers.get('retry-after') || 2) * 1000 * (attempt + 1));
  }
  throw new Error(`${url.hostname}: exhausted retries`);
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
      prop: withLangLinks ? 'extracts|info|langlinks' : 'extracts|info', inprop: 'url',
      exintro: '1', explaintext: '1', exchars: String(EXTRACT_CHARS), exlimit: '20',
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
      title: string; extract?: string; fullurl?: string; langlinks?: { lang: string; '*': string }[];
    }[];
    for (const page of pages) {
      const detail: PageDetail = {
        extract: page.extract,
        url: page.fullurl,
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

const pendingSet = new Set<Feature>([...partitions.values()].flat().filter((feature) => !feature.wikipediaExtract).slice(0, limit));
const pending = [...pendingSet];
process.stdout.write(`${pending.length} features without an extract\n`);

// Step 1: Q-id -> English article title. sitefilter keeps the payload small;
// entities with no English article come back with an empty sitelinks object.
const englishByQid = new Map<string, string>();
const qids = [...new Set(pending.flatMap((feature) => (feature.wikidata ? [feature.wikidata] : [])))];
for (const batch of chunks(qids, 50)) {
  const url = new URL('https://www.wikidata.org/w/api.php');
  url.search = new URLSearchParams({
    action: 'wbgetentities', format: 'json', props: 'sitelinks', sitefilter: 'enwiki', ids: batch.join('|'),
  }).toString();
  const data = await fetchJson(url);
  for (const [qid, entity] of Object.entries(data.entities || {}) as [string, { sitelinks?: Record<string, { title?: string }> }][]) {
    const title = entity.sitelinks?.enwiki?.title;
    if (title) englishByQid.set(qid, title);
  }
}
process.stdout.write(`${englishByQid.size} of ${qids.length} Q-ids have an English sitelink\n`);

// Step 2: read the stored (usually Dutch) articles — both for their own lede,
// which is the fallback, and for their interwiki link to English.
const foreignByLanguage = new Map<string, Set<string>>();
for (const feature of pending) {
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
const englishTitles = new Set(pending.flatMap((feature) => {
  const english = englishTitleFor(feature);
  return english ? [english.title] : [];
}));
const englishDetails = englishTitles.size ? await fetchPages('en', [...englishTitles], false) : new Map<string, PageDetail>();

// Step 4: write the blurbs back.
const filled = new Map<string, number>();
const viaCounts = new Map<string, number>();
const fallbackCounts = new Map<string, number>();
const unresolved: string[] = [];
for (const [file, partition] of partitions) {
  for (const feature of partition) {
    if (!pendingSet.has(feature)) continue;
    const english = englishTitleFor(feature);
    const englishExtract = english ? englishDetails.get(`en:${english.title}`) : undefined;
    const foreign = feature.wikipedia ? foreignDetails.get(feature.wikipedia) : undefined;
    if (english && englishExtract?.extract) {
      feature.wikipediaExtract = englishExtract.extract;
      // Existing entries all point at en.wikipedia when the blurb is English.
      if (englishExtract.url) feature.wikipediaUrl = englishExtract.url;
      delete feature.wikipediaExtractLang;
      viaCounts.set(english.via, (viaCounts.get(english.via) || 0) + 1);
    } else if (foreign?.extract && feature.wikipedia) {
      const { language } = splitPage(feature.wikipedia);
      feature.wikipediaExtract = foreign.extract;
      feature.wikipediaExtractLang = language;
      if (!feature.wikipediaUrl && foreign.url) feature.wikipediaUrl = foreign.url;
      fallbackCounts.set(language, (fallbackCounts.get(language) || 0) + 1);
    } else {
      const reason = !feature.wikipedia && !feature.wikidata ? 'no wikidata or wikipedia tag'
        : !feature.wikipedia ? 'wikidata only, no article on any wiki'
        : 'linked article is missing or has no intro text';
      unresolved.push(`${feature.name} [${file}] — ${reason}`);
      continue;
    }
    filled.set(file, (filled.get(file) || 0) + 1);
  }
  if (!dryRun) await writeFile(path.join(directory, file), JSON.stringify(partition));
}

process.stdout.write(`\n${dryRun ? 'DRY RUN — nothing written' : `wrote ${files.join(', ')}`}\n`);
for (const [file, count] of filled) process.stdout.write(`  ${file}: ${count} extracts added\n`);
for (const [via, count] of viaCounts) process.stdout.write(`  english via ${via}: ${count}\n`);
for (const [language, count] of fallbackCounts) process.stdout.write(`  fallback ${language}: ${count}\n`);
process.stdout.write(`  still without an extract: ${unresolved.length}\n`);
for (const line of unresolved) process.stdout.write(`    ${line}\n`);
