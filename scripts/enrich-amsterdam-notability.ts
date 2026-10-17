/**
 * Backfill notability fields on the Amsterdam landmark extract:
 *
 *   - `wikidataSitelinks`  — number of Wikipedia language sitelinks
 *   - `wikipediaPageviews60d` — 60-day pageviews of the linked article (nl or
 *     en page, whichever exists), filling the gap left by the older
 *     `enrich-amsterdam-wikimedia.ts` pass (which only covered ~106 of 420)
 *   - `heritage`           — Wikidata P1435 heritage-designation Q-ids
 *   - `wikidataInstanceOf` — Wikidata P31 instance-of Q-ids, used by the
 *     runtime notability scorer to weight destination kinds without OSM tags
 *
 * Polite and cached: requests are batched (50 entities / 20 pages), carry a
 * User-Agent, retry throttling responses, and reuse `cachedJsonFetch` so a
 * re-run only re-fetches what is missing.
 *
 * Writes a staging copy `landmarks.notability.staging.json` and reports
 * coverage before/after. Pass `--publish` to also write the real
 * `landmarks.json` (after review).
 *
 * Usage: node --import tsx scripts/enrich-amsterdam-notability.ts [--publish]
 *                                     [--directory=public/data/extracts/amsterdam]
 */
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { cachedJsonFetch } from './lib/cached-json-fetch.ts';

interface Feature {
  name: string;
  wikidata?: string;
  wikipedia?: string;
  wikipediaPageviews60d?: number;
  wikidataSitelinks?: number;
  heritage?: string[];
  wikidataInstanceOf?: string[];
}

const directoryArgument = process.argv.find((argument) => argument.startsWith('--directory='));
const directory = path.resolve(directoryArgument?.slice('--directory='.length) || 'public/data/extracts/amsterdam');
const publish = process.argv.includes('--publish');
const file = 'landmarks.json';

const headers = { 'User-Agent': 'map-recall2 amsterdam notability (https://github.com/blackmad/map-recall2)' };
const chunks = <T>(items: T[], size: number): T[][] =>
  Array.from({ length: Math.ceil(items.length / size) }, (_, index) => items.slice(index * size, (index + 1) * size));

async function fetchJson(url: URL, attempts = 4): Promise<any> {
  return cachedJsonFetch(url, { cacheDirectory: '.cache/wikimedia', headers, attempts, pauseMs: 250 });
}

const features = JSON.parse(await readFile(path.join(directory, file), 'utf8')) as Feature[];
const before = {
  total: features.length,
  pageviews: features.filter((feature) => feature.wikipediaPageviews60d != null).length,
  sitelinks: features.filter((feature) => feature.wikidataSitelinks != null).length,
  heritage: features.filter((feature) => feature.heritage?.length).length,
};

// Step 1: sitelinks + enwiki/nlwiki titles + P1435/P31 claims, batched.
const qids = [...new Set(features.flatMap((feature) => (feature.wikidata ? [feature.wikidata] : [])))];
const sitelinksByQid = new Map<string, number>();
const enwikiByQid = new Map<string, string>();
const nlwikiByQid = new Map<string, string>();
const heritageByQid = new Map<string, string[]>();
const instanceByQid = new Map<string, string[]>();
for (const batch of chunks(qids, 50)) {
  const url = new URL('https://www.wikidata.org/w/api.php');
  url.search = new URLSearchParams({
    action: 'wbgetentities', format: 'json', props: 'sitelinks|claims', ids: batch.join('|'), origin: '*',
  }).toString();
  const data = await fetchJson(url);
  for (const [qid, entity] of Object.entries(data.entities || {}) as [string, {
    sitelinks?: Record<string, { title?: string }>;
    claims?: Record<string, { mainsnak?: { datavalue?: { value?: { id?: string } } } }[]>;
  }][]) {
    const sitelinks = entity.sitelinks || {};
    sitelinksByQid.set(qid, Object.keys(sitelinks).length);
    if (sitelinks.enwiki?.title) enwikiByQid.set(qid, sitelinks.enwiki.title);
    if (sitelinks.nlwiki?.title) nlwikiByQid.set(qid, sitelinks.nlwiki.title);
    heritageByQid.set(qid, (entity.claims?.P1435 || []).map((claim) => claim.mainsnak?.datavalue?.value?.id).filter((id): id is string => !!id));
    instanceByQid.set(qid, (entity.claims?.P31 || []).map((claim) => claim.mainsnak?.datavalue?.value?.id).filter((id): id is string => !!id));
  }
}
const withHeritage = [...heritageByQid.values()].filter((value) => value.length).length;
process.stdout.write(`fetched ${qids.length} Q-ids (${enwikiByQid.size} enwiki, ${nlwikiByQid.size} nlwiki, ${withHeritage} with P1435)\n`);

/** nl or en page to read pageviews from, preferring the English article. */
function preferredPage(feature: Feature): { language: string; title: string } | null {
  const en = feature.wikidata && enwikiByQid.get(feature.wikidata);
  if (en) return { language: 'en', title: en };
  const nl = feature.wikidata && nlwikiByQid.get(feature.wikidata);
  if (nl) return { language: 'nl', title: nl };
  if (feature.wikipedia) {
    const separator = feature.wikipedia.indexOf(':');
    const language = separator > 0 ? feature.wikipedia.slice(0, separator) : 'en';
    const title = separator > 0 ? feature.wikipedia.slice(separator + 1) : feature.wikipedia;
    if (language === 'en' || language === 'nl') return { language, title };
  }
  return null;
}

// Step 2: pageviews for every POI with a wikipedia/wikidata link (nl or en).
const pagesByLanguage = new Map<string, Set<string>>();
for (const feature of features) {
  const page = preferredPage(feature);
  if (!page) continue;
  const titles = pagesByLanguage.get(page.language) || new Set<string>();
  titles.add(page.title);
  pagesByLanguage.set(page.language, titles);
}
const pageviewsByPage = new Map<string, number>();
for (const [language, titles] of pagesByLanguage) {
  // The Pageviews API silently drops pageviews for the later pages once a
  // batch grows past ~10 titles, which is why the older enrich pass covered so
  // few features. Keep batches small so every linked article actually gets its
  // pageviews back.
  for (const batch of chunks([...titles], 10)) {
    const url = new URL(`https://${language}.wikipedia.org/w/api.php`);
    url.search = new URLSearchParams({
      action: 'query', format: 'json', prop: 'pageviews', pvipdays: '60', redirects: '1',
      titles: batch.join('|'), origin: '*',
    }).toString();
    const data = await fetchJson(url);
    const aliases = new Map<string, string>();
    for (const item of [...(data.query?.normalized || []), ...(data.query?.redirects || [])]) aliases.set(item.from, item.to);
    for (const page of Object.values(data.query?.pages || {}) as { title: string; pageviews?: Record<string, number | null> }[]) {
      const views = Object.values(page.pageviews || {}).reduce<number>((sum, value) => sum + (value || 0), 0);
      pageviewsByPage.set(`${language}:${page.title}`, views);
      for (const [original, target] of aliases) if (target === page.title) pageviewsByPage.set(`${language}:${original}`, views);
    }
  }
}
const pageviewsRequested = [...pagesByLanguage.values()].reduce((sum, titles) => sum + titles.size, 0);
process.stdout.write(`requested pageviews for ${pageviewsRequested} pages across ${pagesByLanguage.size} languages\n`);

// Step 3: write the new fields back.
let filledPageviews = 0;
let filledSitelinks = 0;
let filledHeritage = 0;
for (const feature of features) {
  const page = preferredPage(feature);
  const views = page ? pageviewsByPage.get(`${page.language}:${page.title}`) : undefined;
  if (views != null && views > 0) {
    feature.wikipediaPageviews60d = views;
    filledPageviews++;
  } else {
    delete feature.wikipediaPageviews60d;
  }
  const links = feature.wikidata ? sitelinksByQid.get(feature.wikidata) : undefined;
  if (links != null && links > 0) {
    feature.wikidataSitelinks = links;
    filledSitelinks++;
  } else {
    delete feature.wikidataSitelinks;
  }
  const heritage = feature.wikidata ? heritageByQid.get(feature.wikidata) : undefined;
  if (heritage?.length) {
    feature.heritage = heritage;
    filledHeritage++;
  } else {
    delete feature.heritage;
  }
  const instance = feature.wikidata ? instanceByQid.get(feature.wikidata) : undefined;
  if (instance?.length) feature.wikidataInstanceOf = instance;
  else delete feature.wikidataInstanceOf;
}

const after = {
  total: features.length,
  pageviews: features.filter((feature) => feature.wikipediaPageviews60d != null).length,
  sitelinks: features.filter((feature) => feature.wikidataSitelinks != null).length,
  heritage: features.filter((feature) => feature.heritage?.length).length,
};

const staging = path.join(directory, 'landmarks.notability.staging.json');
await writeFile(staging, JSON.stringify(features));
process.stdout.write(`\ncoverage before: pageviews ${before.pageviews}/${before.total}, sitelinks ${before.sitelinks}/${before.total}, heritage ${before.heritage}/${before.total}\n`);
process.stdout.write(`coverage after : pageviews ${after.pageviews}/${after.total}, sitelinks ${after.sitelinks}/${after.total}, heritage ${after.heritage}/${after.total}\n`);
process.stdout.write(`filled ${filledPageviews} pageviews, ${filledSitelinks} sitelinks, ${filledHeritage} heritage\n`);
process.stdout.write(`wrote staging ${staging}\n`);

if (publish) {
  await writeFile(path.join(directory, file), JSON.stringify(features));
  process.stdout.write(`published ${path.join(directory, file)}\n`);
} else {
  process.stdout.write('dry run — pass --publish to write landmarks.json\n');
}
