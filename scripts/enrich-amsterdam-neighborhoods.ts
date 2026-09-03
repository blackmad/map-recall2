import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { commonsFileTitle, resolveCommonsThumbnails } from './resolve-commons-thumbnails';

interface Boundary {
  id: number;
  name: string;
  kind: string;
  adminLevel: number;
  geometry: [number, number][][][];
  bounds: { minlat: number; minlon: number; maxlat: number; maxlon: number };
}

interface WikidataNeighborhood {
  qid: string;
  label: string;
  description?: string;
  imageUrl?: string;
  articleTitle?: string;
}

interface NeighborhoodEnriched {
  name: string;
  wikidataId?: string;
  wikipediaExtract?: string;
  imageUrl?: string;
  imageAttribution?: string;
}

const directory = path.resolve('public/data/extracts/amsterdam');

/** Municipal boundary diagrams from Wikipedia are not postcard photographs. */
function isLocatorMapImage(url: string): boolean {
  return /Map[_-]NL[_-]|Map_-_NL[_-]|\/Map_NL_|locator.?map|_kaart\./i.test(url);
}

function acceptPhotoUrl(url: string | undefined): string | undefined {
  if (!url || isLocatorMapImage(url)) return undefined;
  return url.replace('http://', 'https://');
}
const headers = { 'User-Agent': 'MapQuestExtractBuilder/1.0 (https://github.com/blackmad/map-recall2)' };
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchJson(url: string | URL, init?: RequestInit, attempts = 4): Promise<any> {
  for (let attempt = 0; attempt < attempts; attempt++) {
    const response = await fetch(url, { headers, ...init });
    if (response.ok) {
      await wait(300);
      return response.json();
    }
    if (response.status !== 429 || attempt === attempts - 1) throw new Error(`HTTP ${response.status} from ${typeof url === 'string' ? url.slice(0, 80) : url.hostname}`);
    await wait(Number(response.headers.get('retry-after') || 2) * 1000 * (attempt + 1));
  }
}

// Step 1: Bulk-fetch all Amsterdam neighborhood entities via SPARQL
const sparql = `SELECT ?item ?itemLabel ?itemDescription ?image ?articleTitle WHERE {
  VALUES ?type { wd:Q123705 wd:Q253019 wd:Q1529997 wd:Q3257686 wd:Q15715406 }
  ?item wdt:P31 ?type .
  ?item wdt:P131 wd:Q9899 .
  OPTIONAL { ?item wdt:P18 ?image }
  OPTIONAL {
    ?article schema:about ?item ;
             schema:isPartOf <https://en.wikipedia.org/> ;
             schema:name ?articleTitle .
  }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en,nl" }
}`;

console.log('Querying Wikidata SPARQL for Amsterdam neighborhoods...');
const sparqlUrl = new URL('https://query.wikidata.org/sparql');
sparqlUrl.search = new URLSearchParams({ format: 'json', query: sparql }).toString();
const sparqlData = await fetchJson(sparqlUrl);
const bindings = sparqlData.results.bindings as Record<string, { value: string }>[];

const wikidataIndex = new Map<string, WikidataNeighborhood>();
for (const row of bindings) {
  const qid = row.item.value.split('/').pop()!;
  const label = row.itemLabel?.value || '';
  const existing = wikidataIndex.get(label.toLowerCase());
  if (existing) continue;
  wikidataIndex.set(label.toLowerCase(), {
    qid,
    label,
    description: row.itemDescription?.value,
    imageUrl: row.image?.value,
    articleTitle: row.articleTitle?.value,
  });
}
console.log(`Found ${wikidataIndex.size} unique Wikidata neighborhood entities`);

// Step 2: Match our boundaries against the Wikidata index
const boundaries: Boundary[] = JSON.parse(await readFile(path.join(directory, 'boundaries.json'), 'utf8'));
const neighborhoodKinds = new Set(['neighbourhood', 'quarter', 'suburb']);
const neighborhoods = [...new Map(
  boundaries
    .filter((boundary) => neighborhoodKinds.has(boundary.kind))
    .map((boundary) => [boundary.name, boundary]),
).values()];
console.log(`Matching ${neighborhoods.length} local neighborhoods, quarters, and districts...`);

const normalize = (s: string) => s.toLowerCase().replace(/-/g, ' ').replace(/buurt$/, '').replace(/eiland$/, '').trim();

function findMatch(name: string): WikidataNeighborhood | undefined {
  const exact = wikidataIndex.get(name.toLowerCase());
  if (exact) return exact;
  const normalized = normalize(name);
  for (const [key, value] of wikidataIndex) {
    if (normalize(key) === normalized) return value;
  }
  return undefined;
}

// Step 3: Fetch Wikipedia extracts for matched neighborhoods
const results: NeighborhoodEnriched[] = [];
const titlesToFetch = new Map<string, string[]>();

for (const hood of neighborhoods) {
  const match = findMatch(hood.name);
  const entry: NeighborhoodEnriched = { name: hood.name };

  if (match) {
    entry.wikidataId = match.qid;
    if (match.imageUrl) {
      // Resolved to a direct upload.wikimedia.org thumbnail below; the
      // Special:FilePath redirect is not CORS-safe for canvas rendering.
      // Locator maps (Map_NL_-_Amsterdam_-…) are rejected: they are diagrams,
      // not photographs, and the postcard already borrows a parent photo.
      const photo = acceptPhotoUrl(match.imageUrl);
      if (photo) {
        entry.imageUrl = photo;
        const filename = decodeURIComponent(match.imageUrl.split('/').pop() || '');
        entry.imageAttribution = `Wikimedia Commons: ${filename}`;
      }
    }
    if (match.articleTitle) {
      const existing = titlesToFetch.get(match.articleTitle) || [];
      existing.push(hood.name);
      titlesToFetch.set(match.articleTitle, existing);
    }
  }
  results.push(entry);
}

const chunks = <T>(items: T[], size: number) => Array.from({ length: Math.ceil(items.length / size) }, (_, i) => items.slice(i * size, (i + 1) * size));
const extractsByTitle = new Map<string, { extract?: string; thumbnail?: string }>();

for (const batch of chunks([...titlesToFetch.keys()], 20)) {
  const url = new URL('https://en.wikipedia.org/w/api.php');
  url.search = new URLSearchParams({
    action: 'query', format: 'json', prop: 'extracts|pageimages',
    exintro: '1', explaintext: '1', exchars: '360',
    piprop: 'thumbnail', pithumbsize: '400',
    titles: batch.join('|'), origin: '*', redirects: '1',
  }).toString();
  const data = await fetchJson(url);
  for (const page of Object.values(data.query?.pages || {}) as any[]) {
    if (page.missing) continue;
    extractsByTitle.set(page.title, {
      extract: page.extract,
      thumbnail: page.thumbnail?.source,
    });
  }
}

// Merge extracts back
for (const entry of results) {
  const match = findMatch(entry.name);
  if (!match?.articleTitle) continue;
  const wiki = extractsByTitle.get(match.articleTitle);
  if (wiki) {
    entry.wikipediaExtract = wiki.extract;
    if (!entry.imageUrl && wiki.thumbnail) {
      const photo = acceptPhotoUrl(wiki.thumbnail);
      if (photo) {
        entry.imageUrl = photo;
        entry.imageAttribution = 'Wikipedia thumbnail';
      }
    }
  }
}

// Step 4: Also try Dutch Wikipedia for neighborhoods without English articles
const missingExtract = results.filter((r) => r.wikidataId && !r.wikipediaExtract);
if (missingExtract.length > 0) {
  console.log(`Trying Dutch Wikipedia for ${missingExtract.length} neighborhoods without English articles...`);
  const qids = missingExtract.map((r) => r.wikidataId!);
  for (const batch of chunks(qids, 50)) {
    const url = new URL('https://www.wikidata.org/w/api.php');
    url.search = new URLSearchParams({
      action: 'wbgetentities', format: 'json', ids: batch.join('|'),
      props: 'sitelinks', origin: '*',
    }).toString();
    const data = await fetchJson(url);
    const nlTitles = new Map<string, string>();
    for (const [qid, entity] of Object.entries(data.entities || {}) as [string, any][]) {
      const nlTitle = entity?.sitelinks?.nlwiki?.title;
      if (nlTitle) nlTitles.set(qid, nlTitle);
    }
    const nlBatches = chunks([...nlTitles.values()], 20);
    for (const nlBatch of nlBatches) {
      const wikiUrl = new URL('https://nl.wikipedia.org/w/api.php');
      wikiUrl.search = new URLSearchParams({
        action: 'query', format: 'json', prop: 'extracts|pageimages',
        exintro: '1', explaintext: '1', exchars: '360',
        piprop: 'thumbnail', pithumbsize: '400',
        titles: nlBatch.join('|'), origin: '*', redirects: '1',
      }).toString();
      const wikiData = await fetchJson(wikiUrl);
      for (const page of Object.values(wikiData.query?.pages || {}) as any[]) {
        if (page.missing) continue;
        for (const [qid, nlTitle] of nlTitles) {
          if (nlTitle !== page.title) continue;
          const entry = missingExtract.find((r) => r.wikidataId === qid);
          if (entry && !entry.wikipediaExtract) {
            entry.wikipediaExtract = page.extract;
            if (!entry.imageUrl && page.thumbnail?.source) {
              const photo = acceptPhotoUrl(page.thumbnail.source);
              if (photo) {
                entry.imageUrl = photo;
                entry.imageAttribution = 'Wikipedia thumbnail (nl)';
              }
            }
          }
        }
      }
    }
  }
}

// Wikidata gives Special:FilePath URLs, which 302-redirect to
// upload.wikimedia.org. Only the target sends CORS headers, so the postcard
// renderer (which draws into a canvas and therefore needs crossOrigin) cannot
// use the redirect form. Store the resolved thumbnail instead.
const withRedirectUrls = results.filter(entry => entry.imageUrl && commonsFileTitle(entry.imageUrl));
if (withRedirectUrls.length > 0) {
  const thumbnails = await resolveCommonsThumbnails(
    withRedirectUrls.map(entry => commonsFileTitle(entry.imageUrl!)!), 400,
  );
  let resolvedCount = 0;
  for (const entry of withRedirectUrls) {
    const thumbnail = thumbnails.get(commonsFileTitle(entry.imageUrl!)!);
    if (thumbnail) { entry.imageUrl = thumbnail; resolvedCount++; }
  }
  console.log(`Resolved ${resolvedCount}/${withRedirectUrls.length} Commons thumbnails`);
}

const outputPath = path.join(directory, 'neighborhoods-enriched.json');
await writeFile(outputPath, JSON.stringify(results, null, 2));

for (const entry of results) {
  const status = [
    entry.wikidataId ? 'wikidata' : null,
    entry.wikipediaExtract ? 'extract' : null,
    entry.imageUrl ? 'image' : null,
  ].filter(Boolean).join('+') || 'none';
  console.log(`  ${entry.name}: ${status}`);
}

const withImage = results.filter((r) => r.imageUrl).length;
const withExtract = results.filter((r) => r.wikipediaExtract).length;
const withWikidata = results.filter((r) => r.wikidataId).length;
console.log(`\nWrote ${results.length} neighborhoods to ${outputPath}`);
console.log(`Coverage: ${withWikidata} with Wikidata ID, ${withExtract} with extracts, ${withImage} with images`);
