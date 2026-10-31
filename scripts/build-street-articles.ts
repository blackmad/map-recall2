/**
 * Wikipedia articles for streets and squares the rider can be on but that
 * carry no encyclopedia card.
 *
 * `street-knowledge.json` is generated from `streets.json`, the 500-street
 * quiz pool, so a short famous street with no OSM `wikipedia` tag (Zeedijk,
 * Waterlooplein, Sarphatistraat) never got a card: 713 Dutch Wikipedia
 * articles about Amsterdam streets and squares matched a routable street
 * name with nothing shown (audit 2026-10-31). This joins the Wikidata box
 * (`lib/wikidata-articles-box.ts`) to `streets-routing.json` and
 * `squares.json` by normalised name, keeping only items whose coordinates
 * lie within STREET_MATCH_METRES of that street's geometry, so a Kerkstraat
 * in Weesp does not become Amsterdam's.
 *
 * Text as for building articles: English article when one exists, else the
 * Dutch lede, clipped at a sentence end, translated through the shared cache
 * (`building-articles-translation-batch.ts --master=…`). Writes the master
 * `scripts/data/amsterdam-street-articles.json`; `build-street-knowledge.ts`
 * merges it into `street-knowledge.json`.
 *
 * Usage: npm run build:street-articles [-- --offline]
 */
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { articleTitle, loadWikidataArticlesBox, type WikidataArticleItem } from './lib/wikidata-articles-box.ts';
import { fetchWikipediaPages, pageLanguage, pageTitle, type WikipediaPage } from './lib/wikipedia-pages.ts';
import { clipExtract } from '../src/canalRecall/buildingArticles.ts';

const directory = path.resolve('public/data/extracts/amsterdam');
const masterFile = path.resolve('scripts/data/amsterdam-street-articles.json');
const translationsFile = path.resolve('scripts/english-translations.json');
const offline = process.argv.includes('--offline');
/** How far a street article's point may sit from the street's mapped geometry. */
export const STREET_MATCH_METRES = 250;

const STREET_CLASS_RE = /\bstreet\b|avenue|boulevard|\broad\b|alley|\blane\b|quay|embankment|square|plaza|promenade|dike|dyke|dijk|gracht|passage|footpath|cycle path|thoroughfare|pedestrian/i;
// A street item often also carries a district or levee class (Zeedijk: street,
// levee, neighbourhood, Chinatown); only a class that makes it not-a-street
// at all disqualifies it.
const EXCLUDE_RE = /event|discipline|race|competition|bridge|tunnel|station|building|house|church|cemetery|metro line|tram line/i;
const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s*\([^)]*\)\s*/g, ' ').replace(/[^a-z0-9]+/g, ' ').trim();

// ---- Where the game can be: routable street names with their geometry ----
type LatLng = [number, number];
interface Place { name: string; kind: 'street' | 'square'; points: LatLng[] }
const places = new Map<string, Place>();
const addPlace = (name: string, kind: 'street' | 'square', points: LatLng[]) => {
  const key = norm(name);
  if (!key || !points.length) return;
  const place = places.get(key) ?? places.set(key, { name, kind, points: [] }).get(key)!;
  place.points.push(...points);
};
const routing = JSON.parse(await readFile(path.join(directory, 'streets-routing.json'), 'utf8')) as Array<{ name: string; path: LatLng[]; paths?: LatLng[][] }>;
for (const way of routing) if (way.name) addPlace(way.name, 'street', (way.paths ?? [way.path]).flat());
const squares = JSON.parse(await readFile(path.join(directory, 'squares.json'), 'utf8')) as Array<{ name: string; center: LatLng; path?: LatLng[] }>;
for (const square of squares) addPlace(square.name, 'square', square.path ?? [square.center]);
// Streets that already have a card (streets.json / water.json / knowledge) are not re-sourced.
const knowledge = JSON.parse(await readFile(path.join(directory, 'street-knowledge.json'), 'utf8')) as Array<{ name: string; type?: string; wikipediaExtract?: string; wikipediaUrl?: string; id?: string }>;
const covered = new Set(knowledge.filter(e => (e.wikipediaExtract || e.wikipediaUrl) && !String(e.id ?? '').startsWith('article_streets_')).map(e => norm(e.name)));
const water = JSON.parse(await readFile(path.join(directory, 'water.json'), 'utf8')) as Array<{ name: string }>;
const waterNames = new Set(water.map(w => norm(w.name)));

const metres = (a: LatLng, b: LatLng) => {
  const kx = 111_320 * Math.cos(a[0] * Math.PI / 180), ky = 110_540;
  return Math.hypot((a[1] - b[1]) * kx, (a[0] - b[0]) * ky);
};
const nearest = (point: LatLng, place: Place) => place.points.reduce((best, p) => Math.min(best, metres(point, p)), Infinity);

// ---- Candidates ----
interface Candidate { item: WikidataArticleItem; place: Place; distance: number; page: string; englishPage: string | null }
const items = await loadWikidataArticlesBox(directory);
const candidates = new Map<string, Candidate>();
let classMiss = 0, nameMiss = 0, farAway = 0, alreadyCovered = 0;
for (const item of items.values()) {
  const classes = item.classes.join('|');
  if (!STREET_CLASS_RE.test(classes) || EXCLUDE_RE.test(classes)) { classMiss++; continue; }
  const names = [...new Set([norm(item.label), norm(articleTitle(item.nl)), norm(articleTitle(item.en))].filter(Boolean))];
  const place = names.map(n => places.get(n)).find(Boolean);
  if (!place) { nameMiss++; continue; }
  const key = norm(place.name);
  if (covered.has(key) || waterNames.has(key)) { alreadyCovered++; continue; }
  const distance = nearest([item.lat, item.lng], place);
  if (distance > STREET_MATCH_METRES) { farAway++; continue; }
  const page = item.en ? `en:${articleTitle(item.en)}` : `nl:${articleTitle(item.nl)}`;
  const candidate: Candidate = { item, place, distance, page, englishPage: item.en ? `en:${articleTitle(item.en)}` : null };
  const existing = candidates.get(key);
  if (!existing || item.sitelinks > existing.item.sitelinks) candidates.set(key, candidate);
}
process.stdout.write(`${items.size} located items; ${candidates.size} street/square articles matched a routable name within ${STREET_MATCH_METRES} m `
  + `(${classMiss} other classes, ${nameMiss} no such street, ${alreadyCovered} already carded, ${farAway} too far)\n`);

// ---- Text ----
const list = [...candidates.values()];
const nlPages = await fetchWikipediaPages('nl', list.filter(c => pageLanguage(c.page) === 'nl').map(c => pageTitle(c.page)), { offline });
const enTitles = [
  ...list.map(c => c.englishPage).filter((p): p is string => !!p).map(pageTitle),
  ...[...nlPages.values()].map(p => p.englishTitle).filter((t): t is string => !!t),
];
const enPages = await fetchWikipediaPages('en', enTitles, { offline });
process.stdout.write(`articles read: ${nlPages.size} nl, ${enPages.size} en\n`);

const translations = new Map<string, string>();
for (const entry of JSON.parse(await readFile(translationsFile, 'utf8').catch(() => '[]')) as Array<{ hash: string; en: string }>) translations.set(entry.hash, entry.en);
const sourceHash = (text: string) => createHash('sha1').update(text).digest('hex').slice(0, 12);

export interface StreetArticleRecord {
  /** The street as the routing graph spells it: the card's lookup key. */
  name: string;
  kind: 'street' | 'square';
  wikidata: string;
  sitelinks: number;
  title: string;
  url: string;
  imageUrl: string | null;
  lng: number;
  lat: number;
  distanceM: number;
  extract: string;
  extractLang: string;
  extractSource: 'wikipedia-en' | 'translated' | 'wikipedia-nl';
  original?: string;
  originalLang?: string;
  sourceText: string;
}
const records: StreetArticleRecord[] = [];
let noText = 0;
for (const candidate of list) {
  let detail: WikipediaPage | undefined;
  let lang = pageLanguage(candidate.page);
  if (lang === 'en') detail = enPages.get(pageTitle(candidate.page));
  else {
    const dutch = nlPages.get(pageTitle(candidate.page));
    const english = dutch?.englishTitle ? enPages.get(dutch.englishTitle) : undefined;
    if (english?.extract) { detail = { ...english, image: english.image ?? dutch?.image }; lang = 'en'; }
    else detail = dutch;
  }
  if (!detail?.extract || !detail.url) { noText++; continue; }
  const source = detail.extract.replace(/\s+/g, ' ').trim();
  const display = clipExtract(source);
  const record: StreetArticleRecord = {
    name: candidate.place.name, kind: candidate.place.kind, wikidata: candidate.item.q, sitelinks: candidate.item.sitelinks,
    title: detail.title, url: detail.url, imageUrl: detail.image ?? null, lng: candidate.item.lng, lat: candidate.item.lat, distanceM: Math.round(candidate.distance),
    extract: display, extractLang: lang, extractSource: lang === 'en' ? 'wikipedia-en' : 'wikipedia-nl', sourceText: source,
  };
  if (lang !== 'en') {
    const english = translations.get(sourceHash(display));
    if (english) Object.assign(record, { extract: english, extractLang: 'en', extractSource: 'translated', original: display, originalLang: lang });
  }
  records.push(record);
}
records.sort((a, b) => b.sitelinks - a.sitelinks || a.name.localeCompare(b.name));
await mkdir(path.dirname(masterFile), { recursive: true });
await writeFile(masterFile, `${JSON.stringify({ version: 1, generated: new Date().toISOString().slice(0, 10), articles: records }, null, 1)}\n`);
const bySource = { 'wikipedia-en': 0, translated: 0, 'wikipedia-nl': 0 };
for (const r of records) bySource[r.extractSource]++;
const report = { generated: new Date().toISOString(), matched: candidates.size, noText, articles: records.length, squares: records.filter(r => r.kind === 'square').length, bySource, pendingTranslation: bySource['wikipedia-nl'] };
await writeFile(path.join(directory, 'staging', 'street-articles-report.json'), JSON.stringify(report, null, 2));
process.stdout.write(`${JSON.stringify(report, null, 2)}\nwrote ${path.relative(process.cwd(), masterFile)}; now run build:street-knowledge\n`);
