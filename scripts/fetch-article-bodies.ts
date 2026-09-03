/**
 * Cache whole English Wikipedia articles for the features that have one.
 *
 * `enrich-amsterdam-wikipedia.ts` already resolves each feature to an English
 * article and stores the *intro*, capped at ~1,200 characters. That intro is
 * what the landmark card shows, and it is also the only thing the fact
 * generator ever had to work from — which is why generated "facts" kept coming
 * back as the card's own sentence in different words. An intro exists to
 * define a subject; the memorable material is under == Etymology ==,
 * == History == and == In popular culture ==.
 *
 * So this pass fetches the same articles again without `exintro`, and caches
 * the plaintext under `.cache/wikipedia-articles/`. Nothing is written into
 * the extracts: whole articles are far too large to ship, and the generator is
 * the only consumer. The cache is keyed by article title, so re-running is
 * free and the generator can be re-run offline.
 *
 * Usage: npm run facts:articles [-- --directory=… --limit=50 --refresh]
 */
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { splitArticleSections, selectSourcePassages } from '../src/canalRecall/facts/articleSections.ts';

interface Feature {
  name: string;
  wikipedia?: string;
  wikipediaUrl?: string;
  wikipediaExtract?: string;
  wikipediaExtractLang?: string;
}

/** A cached article, as the generator reads it back. */
export interface CachedArticle {
  /** `en` or `nl` — carried through onto every fact, because a fact drawn
   *  from a Dutch article was translated by a small local model and is worth
   *  reviewing separately from one that was merely summarised. */
  lang: string;
  title: string;
  url: string;
  /** Plaintext of the whole article, headings included as `== Title ==`. */
  text: string;
  retrievedAt: string;
}

/** Which wiki a feature's article lives on. */
export interface ArticleReference { lang: string; title: string; }

const argument = (name: string) =>
  process.argv.find((value) => value.startsWith(`--${name}=`))?.slice(name.length + 3);

const directory = path.resolve(argument('directory') || 'public/data/extracts/amsterdam');
const limit = Number(argument('limit') || Infinity);
const refresh = process.argv.includes('--refresh');
const cacheDirectory = path.resolve('.cache/wikipedia-articles');

/** Every extract file that carries features with English articles. */
const FILES = [
  'landmarks.json', 'bridges.json', 'squares.json', 'parks.json',
  'streets.json', 'water.json',
];

const headers = {
  'User-Agent': 'map-recall2 fact pipeline (https://github.com/blackmad/map-recall2)',
};

const wait = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));

/** Filenames must survive titles with slashes and non-ASCII characters. */
const cacheName = (reference: ArticleReference) =>
  `${reference.lang}.${encodeURIComponent(reference.title).replace(/\*/g, '%2A')}.json`;

/** Wikis worth mining. English first when a feature has both. */
const LANGUAGES = ['en', 'nl'];

/**
 * Which article to mine for a feature.
 *
 * English is preferred, but only 18 of Amsterdam's 300 mapped bridges have an
 * English article at all — the rest are Dutch-only, and skipping them would
 * leave the single largest family of features in the game with nothing to say.
 * Their cards are already English: `translate-extracts-to-english.ts` renders
 * the Dutch lede, keeping `wikipediaSourceText` and its language beside it.
 * Mining the Dutch body for English facts is the same operation one level
 * deeper, so it is done here and marked, not avoided.
 */
export function articleReference(feature: Feature): ArticleReference | null {
  const url = feature.wikipediaUrl || '';
  const match = /^https?:\/\/(\w+)\.wikipedia\.org\/wiki\/(.+)$/.exec(url);
  if (match && LANGUAGES.includes(match[1])) {
    return { lang: match[1], title: decodeURIComponent(match[2]).replace(/_/g, ' ') };
  }
  const tag = feature.wikipedia || '';
  const separator = tag.indexOf(':');
  if (separator > 0 && LANGUAGES.includes(tag.slice(0, separator))) {
    return { lang: tag.slice(0, separator), title: tag.slice(separator + 1) };
  }
  return null;
}

const chunks = <T>(items: T[], size: number) =>
  Array.from({ length: Math.ceil(items.length / size) }, (_, index) => items.slice(index * size, (index + 1) * size));

/**
 * Fetch full plaintext for up to 20 titles at a time. `exlimit=20` only
 * returns full extracts for one page per request when `exintro` is off — the
 * API silently truncates the rest — so full articles are requested one title
 * per call, politely spaced.
 */
async function fetchArticle(reference: ArticleReference): Promise<CachedArticle | null> {
  const url = new URL(`https://${reference.lang}.wikipedia.org/w/api.php`);
  url.search = new URLSearchParams({
    action: 'query', format: 'json', redirects: '1', titles: reference.title,
    prop: 'extracts|info', inprop: 'url', explaintext: '1', exlimit: '1',
  }).toString();
  for (let attempt = 0; attempt < 4; attempt++) {
    const response = await fetch(url, { headers });
    if (response.ok) {
      const data = await response.json() as {
        query?: { pages?: Record<string, { title: string; extract?: string; fullurl?: string; missing?: string }> };
      };
      const page = Object.values(data.query?.pages || {})[0];
      if (!page || page.missing !== undefined || !page.extract) return null;
      await wait(200);
      return {
        lang: reference.lang,
        title: page.title,
        url: page.fullurl || `https://${reference.lang}.wikipedia.org/wiki/${encodeURIComponent(page.title)}`,
        text: page.extract,
        retrievedAt: new Date().toISOString().slice(0, 10),
      };
    }
    if (response.status !== 429 && response.status < 500) throw new Error(`Wikipedia HTTP ${response.status}`);
    await wait(Number(response.headers.get('retry-after') || 2) * 1000 * (attempt + 1));
  }
  throw new Error(`Wikipedia: exhausted retries for ${reference.title}`);
}

/** Read one cached article back, for the generator. */
export async function readCachedArticle(reference: ArticleReference): Promise<CachedArticle | null> {
  try {
    return JSON.parse(await readFile(path.join(cacheDirectory, cacheName(reference)), 'utf8')) as CachedArticle;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw error;
  }
}

if (import.meta.filename === process.argv[1]) {
  await mkdir(cacheDirectory, { recursive: true });
  const existing = new Set(await readdir(cacheDirectory).catch(() => [] as string[]));

  const wanted = new Map<string, ArticleReference>();  // cache name -> article
  for (const file of FILES) {
    let features: Feature[];
    try {
      features = JSON.parse(await readFile(path.join(directory, file), 'utf8')) as Feature[];
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      continue;
    }
    for (const feature of features) {
      const reference = articleReference(feature);
      if (reference) wanted.set(cacheName(reference), reference);
    }
  }

  const pending = [...wanted.entries()]
    .filter(([name]) => refresh || !existing.has(name))
    .slice(0, limit);
  const byLanguage = new Map<string, number>();
  for (const reference of wanted.values()) {
    byLanguage.set(reference.lang, (byLanguage.get(reference.lang) || 0) + 1);
  }
  process.stdout.write(`${wanted.size} articles referenced (${[...byLanguage]
    .map(([lang, count]) => `${lang} ${count}`).join(', ')}); ${pending.length} to fetch\n`);

  let fetched = 0;
  let missing = 0;
  for (const [index, [name, reference]] of pending.entries()) {
    const article = await fetchArticle(reference).catch((error) => {
      process.stdout.write(`  ! ${reference.lang}:${reference.title}: ${(error as Error).message}\n`);
      return null;
    });
    if (!article) { missing++; continue; }
    await writeFile(path.join(cacheDirectory, name), JSON.stringify(article));
    fetched++;
    if ((index + 1) % 25 === 0) process.stdout.write(`  ${index + 1}/${pending.length}…\n`);
  }
  process.stdout.write(`Cached ${fetched} articles, ${missing} unavailable\n`);

  // Report what the generator will actually have to work with, because the
  // interesting number is not how many articles exist but how many carry a
  // section worth mining. An article that is nothing but a lede is one the
  // fact pipeline cannot improve on.
  let mineable = 0;
  let passages = 0;
  const sectionCounts = new Map<string, number>();
  for (const reference of wanted.values()) {
    const article = await readCachedArticle(reference);
    if (!article) continue;
    const selected = selectSourcePassages(splitArticleSections(article.text));
    if (!selected.length) continue;
    mineable++;
    passages += selected.length;
    for (const passage of selected) {
      const key = passage.section || '(lede)';
      sectionCounts.set(key, (sectionCounts.get(key) || 0) + 1);
    }
  }
  process.stdout.write(`${mineable} articles carry a mineable section; ${passages} passages total\n`);
  const top = [...sectionCounts].sort((a, b) => b[1] - a[1]).slice(0, 12);
  for (const [section, count] of top) process.stdout.write(`  ${String(count).padStart(4)}  ${section}\n`);
}
