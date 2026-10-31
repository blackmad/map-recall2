/**
 * Wikipedia articles for ordinary buildings → `building-articles/14/x/y.json.gz`.
 *
 * Two ways an article reaches a footprint, both from data we already hold:
 *   osm-tag  the building way/relation carries `wikipedia=` or `wikidata=`
 *            (Emerald Empire, r3679879: an apartment ring, so never a landmark);
 *   point    a Wikidata item of a building class whose coordinates fall inside
 *            the footprint (Koepelkerk: the tag sits on nothing we draw).
 * The footprint is joined to the streamed pand(s) exactly as landmarks and
 * facts are (`lib/landmarkBuildings.ts`); a pand a landmark already lights up
 * is left to the landmark card.
 *
 * Text: the English article when one exists (sitelink or the Dutch article's
 * interwiki), else the Dutch lede tagged `nl`, replaced by a reviewed English
 * translation from `scripts/english-translations.json` when the hash matches
 * (`building-articles-translation-batch.ts` fills that cache). The original
 * and its language stay in the master file for provenance.
 *
 * Writes the master `scripts/data/amsterdam-building-articles.json`, the
 * staging tiles and a report; `--publish` replaces `building-articles/`.
 *
 * Usage: npm run build:building-articles [-- --publish] [-- --offline]
 */
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, readFile, readdir, rename, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createInterface } from 'node:readline';
import { gunzipSync, gzipSync } from 'node:zlib';
import { BuildingGrid, pointInRing, ringCentroid, tileIdsDrawing, type OsmBuilding, type Ring } from './lib/landmarkBuildings.ts';
import { articleTitle, loadWikidataArticlesBox, type WikidataArticleItem } from './lib/wikidata-articles-box.ts';
import { fetchWikipediaPages, pageLanguage, pageTitle, type WikipediaPage } from './lib/wikipedia-pages.ts';
import { factTileOf, shortBuildingId } from '../src/canalRecall/buildingFacts.ts';
import {
  BUILDING_ARTICLE_VERSION, clipExtract, isBuildingClass, parseWikipediaTag, pickArticle,
  type BuildingArticle, type BuildingArticleIndex, type BuildingArticleTile,
} from '../src/canalRecall/buildingArticles.ts';

const directory = path.resolve('public/data/extracts/amsterdam');
const buildingsSeq = path.resolve('.cache/osm-source/derived/amsterdam-buildings.geojsonseq');
const masterFile = path.resolve('scripts/data/amsterdam-building-articles.json');
const translationsFile = path.resolve('scripts/english-translations.json');
const offline = process.argv.includes('--offline');
if (!await stat(buildingsSeq).catch(() => null)) throw new Error('Run `npm run resolve:landmark-buildings` first.');

// ---- What the tiles draw, and which pands a landmark already claims ----
const tileIds = new Set<string>();
// Drawn pands by centroid, for an OSM footprint without `ref:bag` whose pand
// the tiles draw under a BAG id (200 article footprints had no tile id).
const pandCentroids = new Map<string, Array<{ id: string; lng: number; lat: number }>>();
const centroidCell = (lng: number, lat: number) => `${Math.floor(lng * 1000)}:${Math.floor(lat * 2000)}`;
const tileRoot = path.join(directory, 'building-tiles', '14');
for (const x of await readdir(tileRoot)) {
  for (const file of await readdir(path.join(tileRoot, x))) {
    if (!file.endsWith('.geojson.gz')) continue;
    const collection = JSON.parse(gunzipSync(await readFile(path.join(tileRoot, x, file))).toString('utf8'));
    for (const feature of collection.features) {
      const id = feature.properties?.id;
      if (!id) continue;
      tileIds.add(String(id));
      const ring: Ring | undefined = feature.geometry?.type === 'Polygon' ? feature.geometry.coordinates[0]
        : feature.geometry?.type === 'MultiPolygon' ? feature.geometry.coordinates[0]?.[0] : undefined;
      if (!ring?.length) continue;
      const [lng, lat] = ringCentroid(ring);
      const key = centroidCell(lng, lat);
      (pandCentroids.get(key) ?? pandCentroids.set(key, []).get(key)!).push({ id: String(id), lng, lat });
    }
  }
}
/** Drawn pands standing inside an OSM footprint the tiles do not know by id. */
function pandsInside(building: OsmBuilding): string[] {
  const outer = building.rings[0];
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [x, y] of outer) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
  const found: string[] = [];
  for (let cx = Math.floor(minX * 1000); cx <= Math.floor(maxX * 1000); cx++) for (let cy = Math.floor(minY * 2000); cy <= Math.floor(maxY * 2000); cy++) {
    for (const pand of pandCentroids.get(`${cx}:${cy}`) ?? []) {
      if (pand.lng >= minX && pand.lng <= maxX && pand.lat >= minY && pand.lat <= maxY && pointInRing(pand.lng, pand.lat, outer)) found.push(pand.id);
    }
  }
  return found;
}
const landmarkJoin = JSON.parse(await readFile(path.join(directory, 'landmark-buildings.json'), 'utf8')) as { buildings: Record<string, string[]> };
const landmarkPands = new Set(Object.values(landmarkJoin.buildings).flat());

// ---- Candidates from the building export ----
const items = await loadWikidataArticlesBox(directory);
const pointItems = [...items.values()].filter(item => isBuildingClass(item.classes));
const cellOf = (lng: number, lat: number) => `${Math.floor(lng * 500)}:${Math.floor(lat * 1000)}`;
const pointGrid = new Map<string, WikidataArticleItem[]>();
for (const item of pointItems) { const key = cellOf(item.lng, item.lat); (pointGrid.get(key) ?? pointGrid.set(key, []).get(key)!).push(item); }

interface Candidate {
  how: 'osm-tag' | 'point';
  sitelinks: number;
  hasEnglish: boolean;
  wikidata: string | null;
  /** Article to read, "lang:Title". */
  page: string;
  englishPage: string | null;
  label: string;
}
interface Footprint { building: OsmBuilding; name: string | null; candidates: Candidate[]; lng: number; lat: number }

const grid = new BuildingGrid();
const footprints: Footprint[] = [];
let scanned = 0;
for await (const raw of createInterface({ input: createReadStream(buildingsSeq) })) {
  const line = raw.replace(/^\x1e/, ''); if (!line) continue;
  const feature = JSON.parse(line);
  const props = (feature.properties || {}) as Record<string, string>;
  if (!props.building && !props['building:part']) continue;
  const polygons: Ring[][] = feature.geometry.type === 'Polygon' ? [feature.geometry.coordinates]
    : feature.geometry.type === 'MultiPolygon' ? feature.geometry.coordinates : [];
  if (!polygons.length) continue;
  const osmId = `${props['@type'] === 'relation' ? 'r' : 'w'}${props['@id']}`;
  const building: OsmBuilding = {
    osmId, refBag: props['ref:bag'] ?? null, wikidata: props.wikidata ?? null,
    part: !props.building && !!props['building:part'], rings: polygons.map(polygon => polygon[0]),
  };
  grid.add(building);
  if (building.part) continue;
  scanned++;
  const candidates: Candidate[] = [];
  const tagged = parseWikipediaTag(props.wikipedia);
  const taggedItem = props.wikidata ? items.get(props.wikidata.trim()) ?? null : null;
  if (tagged || taggedItem) {
    const nlPage = taggedItem?.nl ? `nl:${articleTitle(taggedItem.nl)}` : tagged && tagged.lang === 'nl' ? `nl:${tagged.title}` : null;
    const enPage = taggedItem?.en ? `en:${articleTitle(taggedItem.en)}` : tagged && tagged.lang === 'en' ? `en:${tagged.title}` : null;
    const page = enPage ?? nlPage ?? (tagged ? `${tagged.lang}:${tagged.title}` : null);
    if (page) {
      candidates.push({
        how: 'osm-tag', sitelinks: taggedItem?.sitelinks ?? 1, hasEnglish: !!enPage, wikidata: props.wikidata?.trim() ?? taggedItem?.q ?? null,
        page, englishPage: enPage, label: taggedItem?.label ?? props.name ?? (tagged?.title ?? ''),
      });
    }
  }
  // Wikidata points inside the outer ring, unless the footprint names another item.
  const outer = building.rings[0];
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [x, y] of outer) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
  for (let cx = Math.floor(minX * 500); cx <= Math.floor(maxX * 500); cx++) for (let cy = Math.floor(minY * 1000); cy <= Math.floor(maxY * 1000); cy++) {
    for (const item of pointGrid.get(`${cx}:${cy}`) ?? []) {
      if (item.lng < minX || item.lng > maxX || item.lat < minY || item.lat > maxY || !pointInRing(item.lng, item.lat, outer)) continue;
      if (building.wikidata && building.wikidata !== item.q) continue;
      if (candidates.some(c => c.wikidata === item.q)) continue;
      candidates.push({
        how: 'point', sitelinks: item.sitelinks, hasEnglish: !!item.en, wikidata: item.q,
        page: item.en ? `en:${articleTitle(item.en)}` : `nl:${articleTitle(item.nl)}`, englishPage: item.en ? `en:${articleTitle(item.en)}` : null, label: item.label,
      });
    }
  }
  if (!candidates.length) continue;
  const [lng, lat] = ringCentroid(outer);
  footprints.push({ building, name: props.name ?? null, candidates, lng, lat });
}
process.stdout.write(`${scanned} buildings scanned; ${footprints.length} footprints with an article candidate\n`);

// ---- One article per footprint, joined to the pands the tiles draw ----
interface Placed extends Footprint { chosen: Candidate; pands: string[] }
const placed: Placed[] = [];
const claimed = new Set<string>();
let leftToLandmark = 0, noTile = 0, viaCentroid = 0;
const untiled: Array<{ osmId: string; name: string | null; label: string; lng: number; lat: number }> = [];
for (const footprint of footprints.sort((a, b) => a.building.osmId.localeCompare(b.building.osmId))) {
  const chosen = pickArticle(footprint.candidates)!;
  const drawn = tileIdsDrawing(footprint.building, grid, tileIds);
  const ids = (drawn.length ? drawn : pandsInside(footprint.building)).filter(id => !claimed.has(id));
  if (!drawn.length && ids.length) viaCentroid++;
  if (!ids.length) { noTile++; untiled.push({ osmId: footprint.building.osmId, name: footprint.name, label: chosen.label, lng: footprint.lng, lat: footprint.lat }); continue; }
  if (ids.every(id => landmarkPands.has(id))) { leftToLandmark++; continue; }
  const pands = ids.filter(id => !landmarkPands.has(id));
  for (const id of pands) claimed.add(id);
  placed.push({ ...footprint, chosen, pands });
}
process.stdout.write(`${placed.length} footprints placed on ${claimed.size} pands (${viaCentroid} via pands standing inside the footprint); ${leftToLandmark} left to a landmark card; ${noTile} not drawn by the tiles\n`);
await mkdir(path.join(directory, 'staging'), { recursive: true });
await writeFile(path.join(directory, 'staging', 'building-articles-untiled.json'), JSON.stringify(untiled, null, 1));

// ---- Article text ----
const fetchPages = (language: string, titles: string[]) => fetchWikipediaPages(language, titles, { offline });
const titleOf = pageTitle;
const langOf = pageLanguage;
const nlTitles = placed.map(p => p.chosen.page).filter(page => langOf(page) === 'nl').map(titleOf);
const nlPages = await fetchPages('nl', nlTitles);
// A Dutch article may link an English one the box query did not know about.
const enTitles = [
  ...placed.map(p => p.chosen.englishPage).filter((page): page is string => !!page).map(titleOf),
  ...nlTitles.map(title => nlPages.get(title)?.englishTitle).filter((title): title is string => !!title),
];
const enPages = await fetchPages('en', enTitles);
process.stdout.write(`articles read: ${nlPages.size} nl, ${enPages.size} en\n`);

const translations = new Map<string, string>();
for (const entry of JSON.parse(await readFile(translationsFile, 'utf8').catch(() => '[]')) as Array<{ hash: string; en: string }>) translations.set(entry.hash, entry.en);
const sourceHash = (text: string) => createHash('sha1').update(text).digest('hex').slice(0, 12);

interface MasterRecord {
  pands: string[]; osmId: string; osmName: string | null; wikidata: string | null; how: 'osm-tag' | 'point'; sitelinks: number;
  name: string; title: string; url: string; imageUrl: string | null; lng: number; lat: number;
  extract: string; extractLang: string; extractSource: 'wikipedia-en' | 'translated' | 'wikipedia-nl';
  original?: string; originalLang?: string; sourceText: string;
}
const records: MasterRecord[] = [];
let noText = 0;
for (const entry of placed) {
  const page = entry.chosen.page;
  let detail: WikipediaPage | undefined;
  let lang = langOf(page);
  if (lang === 'en') detail = enPages.get(titleOf(page));
  else {
    const dutch = nlPages.get(titleOf(page));
    const english = entry.chosen.englishPage ? enPages.get(titleOf(entry.chosen.englishPage)) : dutch?.englishTitle ? enPages.get(dutch.englishTitle) : undefined;
    if (english?.extract) { detail = english; lang = 'en'; if (!detail.image) detail = { ...detail, image: dutch?.image }; }
    else detail = dutch;
  }
  if (!detail?.extract || !detail.url) { noText++; continue; }
  const source = detail.extract.replace(/\s+/g, ' ').trim();
  const display = clipExtract(source);
  const record: MasterRecord = {
    pands: entry.pands, osmId: entry.building.osmId, osmName: entry.name, wikidata: entry.chosen.wikidata, how: entry.chosen.how, sitelinks: entry.chosen.sitelinks,
    name: entry.chosen.label || detail.title, title: detail.title, url: detail.url, imageUrl: detail.image ?? null, lng: entry.lng, lat: entry.lat,
    extract: display, extractLang: lang, extractSource: lang === 'en' ? 'wikipedia-en' : 'wikipedia-nl', sourceText: source,
  };
  if (lang !== 'en') {
    const english = translations.get(sourceHash(display));
    if (english) Object.assign(record, { extract: english, extractLang: 'en', extractSource: 'translated', original: display, originalLang: lang });
  }
  records.push(record);
}
records.sort((a, b) => b.sitelinks - a.sitelinks || a.title.localeCompare(b.title));
await mkdir(path.dirname(masterFile), { recursive: true });
await writeFile(masterFile, `${JSON.stringify({ version: BUILDING_ARTICLE_VERSION, generated: new Date().toISOString().slice(0, 10), articles: records }, null, 1)}\n`);

// ---- Tiles, keyed like the fact tiles ----
const tiles = new Map<string, BuildingArticleTile>();
for (const record of records) {
  const { x, y } = factTileOf(record.lng, record.lat);
  const key = `${x}/${y}`;
  const tile = tiles.get(key) ?? tiles.set(key, { version: BUILDING_ARTICLE_VERSION, buildings: {} }).get(key)!;
  const article: BuildingArticle = { t: record.title, u: record.url, e: record.extract };
  if (record.extractLang !== 'en') article.l = record.extractLang;
  if (record.imageUrl) article.i = record.imageUrl;
  if (record.wikidata) article.q = record.wikidata;
  for (const pand of record.pands) tile.buildings[shortBuildingId(pand)] = article;
}
const staging = path.join(directory, 'staging/building-articles');
await rm(staging, { recursive: true, force: true });
let bytes = 0;
for (const [key, tile] of tiles) {
  const [x, y] = key.split('/');
  await mkdir(path.join(staging, '14', x), { recursive: true });
  const gz = gzipSync(JSON.stringify(tile), { level: 9 });
  bytes += gz.length;
  await writeFile(path.join(staging, '14', x, `${y}.json.gz`), gz);
}
const index: BuildingArticleIndex = { version: BUILDING_ARTICLE_VERSION, tiles: [...tiles.keys()].sort() };
await writeFile(path.join(staging, '14', 'index.json'), JSON.stringify(index));

const byHow = { 'osm-tag': 0, point: 0 };
const bySource = { 'wikipedia-en': 0, translated: 0, 'wikipedia-nl': 0 };
for (const record of records) { byHow[record.how]++; bySource[record.extractSource]++; }
const report = {
  generated: new Date().toISOString(), scanned, footprintsWithCandidates: footprints.length, placed: placed.length, leftToLandmark, noTile, noText,
  articles: records.length, pands: records.reduce((n, r) => n + r.pands.length, 0), viaCentroid, byHow, bySource, tiles: tiles.size, gzippedKb: Math.round(bytes / 1024),
  pendingTranslation: records.filter(r => r.extractLang !== 'en').length,
};
await writeFile(path.join(directory, 'staging', 'building-articles-report.json'), JSON.stringify(report, null, 2));
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);

if (process.argv.includes('--publish')) {
  const published = path.join(directory, 'building-articles');
  await rm(published, { recursive: true, force: true });
  await rename(staging, published);
  process.stdout.write('published → building-articles/\n');
}
