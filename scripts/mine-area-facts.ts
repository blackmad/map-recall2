/**
 * Gather "local knowledge" candidates for neighbourhood cards into a review
 * sheet: every distinctive sentence of the area's English and Dutch articles
 * (all sections, not only lede and History), and clusters of OpenStreetMap places
 * inside its outline (synagogues, kosher shops, markets, breweries…). Mining
 * publishes nothing: a reviewer picks one fact per area and words it, citing
 * candidate sentences, into `scripts/data/area-fact-review.json` (see
 * `src/mapRecall/areaFacts.ts`). `publish` then copies the picks a person
 * approved (`approve: true`) into `neighborhood-history.json` as `localFact`,
 * the card's lead line, after checking every cited sentence is still in its
 * article.
 *
 *   npm run mine:area-facts -- [--only "Buitenveldert,De Pijp"] [--city amsterdam]
 *   npm run mine:area-facts -- publish [--city amsterdam]
 *
 * Every response goes through the durable scrape store, so reruns are offline.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { cityNamePattern, extractCityById } from '../src/mapRecall/cityExtracts';
import { pointInPolygons, type Boundary } from '../src/mapRecall/neighborhoodGaps';
import { classifyOsm, placeClusters, publishableFact, sentenceCandidates, type ArticleSource, type PlaceItem, type ReviewedFact } from '../src/mapRecall/areaFacts';
import { cachedJson } from './lib/cachedFetch';
import { coreName, isDisambiguation, mentions, sections, sentencesOf, tidy } from './fetch-neighborhood-history';

const arg = (flag: string) => (process.argv.includes(flag) ? process.argv[process.argv.indexOf(flag) + 1] : undefined);
const city = extractCityById(arg('--city') ?? 'amsterdam');
if (!city) throw new Error('unknown city');
const directory = path.resolve(`public/data/extracts/${city.id}`);
const stagingDir = path.join(directory, 'staging/area-facts');
const cityPattern = new RegExp(cityNamePattern(city));
const only = arg('--only')?.split(',').map(s => s.trim());

async function wikiQuery(lang: 'en' | 'nl', params: Record<string, string>): Promise<any> {
  const url = new URL(`https://${lang}.wikipedia.org/w/api.php`);
  url.search = new URLSearchParams({ format: 'json', formatversion: '2', redirects: '1', ...params }).toString();
  return cachedJson(url);
}

async function page(lang: 'en' | 'nl', title: string) {
  const data = await wikiQuery(lang, { action: 'query', prop: 'extracts|langlinks|pageprops', explaintext: '1', exsectionformat: 'wiki', lllang: lang === 'nl' ? 'en' : 'nl', titles: title });
  const p = data.query?.pages?.[0];
  if (!p || p.missing || !p.extract) return null;
  return { title: p.title as string, text: p.extract as string, other: p.langlinks?.[0]?.title as string | undefined, qid: p.pageprops?.wikibase_item as string | undefined };
}

const articleUrl = (lang: string, title: string) => `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`;
const fits = (text: string, name: string) => !isDisambiguation(text) && cityPattern.test(text.slice(0, 1500)) && mentions(sections(text).lede, name);

/** The area's nl and en articles: by Wikidata sitelink, then title guesses, then nl search; each side fills the other via langlinks. */
async function articlesFor(name: string, qid?: string): Promise<ArticleSource[]> {
  const titles: { en?: string; nl?: string } = {};
  if (qid) {
    const url = new URL('https://www.wikidata.org/w/api.php');
    url.search = new URLSearchParams({ action: 'wbgetentities', ids: qid, props: 'sitelinks', sitefilter: 'enwiki|nlwiki', format: 'json' }).toString();
    const entity = (await cachedJson<any>(url)).entities?.[qid];
    titles.en = entity?.sitelinks?.enwiki?.title; titles.nl = entity?.sitelinks?.nlwiki?.title;
  }
  const found: Partial<Record<'en' | 'nl', { title: string; text: string; other?: string }>> = {};
  for (const lang of ['nl', 'en'] as const) {
    const guesses = [titles[lang], `${name} (${city!.name})`, `${name} (tuinstad)`, name].filter((t): t is string => !!t);
    for (const title of guesses) {
      const p = await page(lang, title);
      if (p && fits(p.text, name)) { found[lang] = p; break; }
    }
  }
  if (!found.nl) {
    const hits = (await wikiQuery('nl', { action: 'query', list: 'search', srsearch: `${name} ${city!.name}`, srlimit: '5' })).query?.search ?? [];
    for (const hit of hits) {
      if (!hit.title.toLowerCase().replace(/[-\s]+/g, '').includes(coreName(name))) continue;
      const p = await page('nl', hit.title);
      if (p && fits(p.text, name)) { found.nl = p; break; }
    }
  }
  for (const [lang, other] of [['en', 'nl'], ['nl', 'en']] as const) {
    const linked = found[other]?.other;
    if (!found[lang] && linked) { const p = await page(lang, linked); if (p && fits(p.text, name)) found[lang] = p; }
  }
  return (['en', 'nl'] as const).flatMap(lang => found[lang] ? [{ lang, title: found[lang]!.title, url: articleUrl(lang, found[lang]!.title), text: found[lang]!.text }] : []);
}

/** OpenStreetMap places the classifier knows, inside the city's bounding box (one Overpass request, kept in the scrape store). */
async function placesInCity(boundaries: Boundary[]): Promise<PlaceItem[]> {
  let [south, west, north, east] = [90, 180, -90, -180];
  for (const b of boundaries) for (const polygon of b.geometry) for (const [lat, lng] of polygon[0]) {
    south = Math.min(south, lat); north = Math.max(north, lat); west = Math.min(west, lng); east = Math.max(east, lng);
  }
  const box = `(${south.toFixed(4)},${west.toFixed(4)},${north.toFixed(4)},${east.toFixed(4)})`;
  const selectors = ['["amenity"="place_of_worship"]', '["amenity"~"^(school|kindergarten|college)$"]["religion"]', '["diet:kosher"]', '["cuisine"]',
    '["amenity"="marketplace"]', '["craft"~"^(brewery|distillery)$"]', '["man_made"="windmill"]', '["tourism"="museum"]', '["amenity"~"^(theatre|studio)$"]', '["leisure"="garden"]["garden_type"="community"]'];
  const data = `[out:json][timeout:180];(${selectors.map(s => `nwr${s}${box};`).join('')});out center tags;`;
  const body = new URLSearchParams({ data }).toString();
  const answer = await cachedJson<{ elements: Array<{ type: string; id: number; lat?: number; lon?: number; center?: { lat: number; lon: number }; tags?: Record<string, string> }> }>(
    'https://maps.mail.ru/osm/tools/overpass/api/interpreter', { method: 'POST', body, contentType: 'application/x-www-form-urlencoded' });
  return answer.elements.flatMap(e => {
    const lat = e.lat ?? e.center?.lat, lng = e.lon ?? e.center?.lon;
    const classLabel = e.tags ? classifyOsm(e.tags) : null;
    return lat != null && lng != null && classLabel ? [{ qid: `osm:${e.type}/${e.id}`, label: e.tags?.name ?? '', classLabel, lat, lng }] : [];
  });
}

async function main() {
  const boundaries = (JSON.parse(await readFile(path.join(directory, 'boundaries.json'), 'utf8')) as Boundary[]).filter(b => b.kind !== 'municipality');
  const enriched: Array<{ name: string; wikidataId?: string }> = JSON.parse(await readFile(path.join(directory, 'neighborhoods-enriched.json'), 'utf8').catch(() => '[]'));
  const qids = new Map(enriched.map(e => [e.name, e.wikidataId]));
  const places = await placesInCity(boundaries);
  const citywide = new Map<string, number>();
  for (const p of places) citywide.set(p.classLabel, (citywide.get(p.classLabel) ?? 0) + 1);
  const sheet = [];
  const seen = new Set<string>();
  for (const hood of boundaries) {
    if (seen.has(hood.name) || (only && !only.includes(hood.name))) continue;
    seen.add(hood.name);
    const articles = await articlesFor(hood.name, qids.get(hood.name));
    const sentences = sentenceCandidates(articles, hood.name, text => sentencesOf(tidy(text))).slice(0, 25);
    const inside = places.filter(p => pointInPolygons([p.lat, p.lng], hood.geometry));
    const clusters = placeClusters(inside, citywide).filter(c => c.items.length >= 2).slice(0, 6);
    sheet.push({ name: hood.name, kind: hood.kind, articles: articles.map(a => ({ lang: a.lang, title: a.title, url: a.url })), sentences, places: clusters });
    process.stdout.write(`${hood.name}: ${articles.map(a => a.lang).join('+') || 'no article'}, ${sentences.length} sentences, ${clusters.length} place clusters\n`);
  }
  await mkdir(stagingDir, { recursive: true });
  const file = path.join(stagingDir, only ? 'candidates-sample.json' : 'candidates.json');
  await writeFile(file, `${JSON.stringify(sheet, null, 1)}\n`);
  console.log(`${sheet.length} areas → ${file}`);
}

const reviewPath = path.resolve(`scripts/data/area-fact-review${city.id === 'amsterdam' ? '' : `-${city.id}`}.json`);

async function publish() {
  const review: Record<string, ReviewedFact | string | null> = JSON.parse(await readFile(reviewPath, 'utf8'));
  // Cited articles come back from the scrape store; compared as the miner saw them (tidied).
  const texts = new Map<string, string>();
  for (const entry of Object.values(review)) {
    if (!entry || typeof entry === 'string') continue;
    for (const cite of entry.cites ?? []) {
      if (texts.has(cite.sourceUrl)) continue;
      const url = new URL(cite.sourceUrl);
      const p = await page(url.hostname.startsWith('nl.') ? 'nl' : 'en', decodeURIComponent(url.pathname.replace('/wiki/', '')).replace(/_/g, ' '));
      if (p) texts.set(cite.sourceUrl, tidy(p.text));
    }
  }
  const historyPath = path.join(directory, 'neighborhood-history.json');
  const history: { version: number; generatedAt: string; neighborhoods: Array<{ name: string; localFact?: unknown }> } =
    JSON.parse(await readFile(historyPath, 'utf8').catch(() => '{"version":1,"generatedAt":"","neighborhoods":[]}'));
  const byName = new Map(history.neighborhoods.map(e => [e.name, e]));
  let shipped = 0;
  for (const [name, entry] of Object.entries(review)) {
    if (name.startsWith('_')) continue;
    const target = byName.get(name);
    if (!entry || typeof entry === 'string') { if (target) delete target.localFact; continue; }
    const { fact, problem } = publishableFact(entry, url => texts.get(url));
    if (!fact) { if (problem !== 'not approved') console.log(`  ! ${name}: ${problem}`); continue; }
    if (target) target.localFact = fact;
    else { const created = { name, localFact: fact }; history.neighborhoods.push(created); byName.set(name, created); }
    shipped++;
  }
  history.generatedAt = new Date().toISOString();
  await writeFile(historyPath, `${JSON.stringify(history, null, 1)}\n`);
  console.log(`${shipped} local facts → ${historyPath}`);
}

void (process.argv[2] === 'publish' ? publish() : main());
