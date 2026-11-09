/**
 * Street-side art → `street-art.json` (`src/canalRecall/streetArt.ts`).
 *
 * Two sources, joined: OSM `tourism=artwork` nodes/areas with a name from the
 * cached places export (labels and the plinth position), and Wikidata items
 * of sculpture/statue/mural/memorial/fountain classes with a Dutch or English
 * article inside the Amsterdam box (`lib/wikidata-articles-box.ts`), matched
 * to an OSM artwork by its `wikidata` tag or by standing within
 * MATCH_METRES of it, else added as their own point. Only points inside the
 * streamed building tiles ship. Article text as for building articles
 * (English article, else the Dutch lede through the translation cache;
 * `building-articles-translation-batch.ts --master=scripts/data/amsterdam-street-art.json`).
 *
 * Usage: npm run build:street-art [-- --offline]
 */
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createInterface } from 'node:readline';
import { articleTitle, loadWikidataArticlesBox, type WikidataArticleItem } from './lib/wikidata-articles-box.ts';
import { cachedJsonFetch } from './lib/cached-json-fetch.ts';
import { fetchWikipediaPages, pageLanguage, pageTitle, type WikipediaPage } from './lib/wikipedia-pages.ts';
import { ringCentroid } from './lib/landmarkBuildings.ts';
import { clipExtract } from '../src/canalRecall/buildingArticles.ts';
import { STREET_ART_VERSION, streetArtKind, type StreetArtFile, type StreetArtKind, type StreetArtPoint } from '../src/canalRecall/streetArt.ts';

const directory = path.resolve('public/data/extracts/amsterdam');
const masterFile = path.resolve('scripts/data/amsterdam-street-art.json');
const translationsFile = path.resolve('scripts/english-translations.json');
const offline = process.argv.includes('--offline');
/** `--staging`: write the points, master and report under staging/ instead of the published paths (lane rule: the integrator publishes). */
const staging = process.argv.includes('--staging');
const outDirectory = staging ? path.join(directory, 'staging') : directory;
const outMaster = staging ? path.join(outDirectory, 'street-art-master.json') : masterFile;
/** A Wikidata point this close to an OSM artwork is that artwork. */
const MATCH_METRES = 25;
const ART_CLASS_RE = /sculpture|statue|mural|memorial|monument|work of art|fountain|bust|relief|street art|installation|public art|obelisk|commemorative|war memorial/i;
const EXCLUDE_RE = /building|house|church|bridge|street|square|park\b|cemetery|event|organization|museum|painting \(|lithograph|print|drawing|manuscript|film|album|song/i;

// Streamed tile coverage (z14), as the POI builders use it.
const tiles = new Set<string>();
for (const x of await readdir(path.join(directory, 'building-tiles', '14'))) {
  for (const file of await readdir(path.join(directory, 'building-tiles', '14', x))) if (file.endsWith('.geojson.gz')) tiles.add(`${x}/${file.split('.')[0]}`);
}
const covered = (lng: number, lat: number) => {
  const n = 2 ** 14;
  return tiles.has(`${Math.floor((lng + 180) / 360 * n)}/${Math.floor((1 - Math.asinh(Math.tan(lat * Math.PI / 180)) / Math.PI) / 2 * n)}`);
};
const metres = (aLng: number, aLat: number, bLng: number, bLat: number) => Math.hypot((aLng - bLng) * 111_320 * Math.cos(aLat * Math.PI / 180), (aLat - bLat) * 110_540);

// ---- OSM artworks ----
interface OsmArt { id: string; name: string; lng: number; lat: number; kind: StreetArtKind; artist?: string; year?: string; wikidata?: string; wikipedia?: string }
const osmArt: OsmArt[] = [];
for await (const raw of createInterface({ input: createReadStream('.cache/osm-source/derived/amsterdam-places.geojsonseq') })) {
  const line = raw.replace(/^\x1e/, ''); if (!line.trim()) continue;
  const feature = JSON.parse(line); const tags = (feature.properties ?? {}) as Record<string, string>;
  if (tags.tourism !== 'artwork' && !/^(memorial|monument)$/.test(tags.historic ?? '')) continue;
  const name = (tags.name ?? tags['name:en'] ?? '').trim(); if (name.length < 2) continue;
  const g = feature.geometry;
  const [lng, lat]: [number, number] = g.type === 'Point' ? g.coordinates : g.type === 'Polygon' ? ringCentroid(g.coordinates[0]) : g.type === 'MultiPolygon' ? ringCentroid(g.coordinates[0][0]) : [NaN, NaN];
  if (!Number.isFinite(lng) || !covered(lng, lat)) continue;
  const id = `${String(tags['@type'])[0]}${tags['@id']}`; if (!/^[nwr]\d+$/.test(id)) continue;
  const year = (tags.start_date ?? tags.year ?? '').slice(0, 4);
  osmArt.push({
    id, name, lng, lat, kind: streetArtKind(tags.artwork_type ?? tags.historic ?? tags.memorial),
    artist: tags.artist_name?.split(';')[0].trim() || undefined, year: /^\d{4}$/.test(year) ? year : undefined,
    wikidata: tags.wikidata?.trim() || undefined, wikipedia: tags.wikipedia?.trim() || undefined,
  });
}
process.stdout.write(`${osmArt.length} named OSM artworks and memorials inside the tiles\n`);

// ---- Wikidata art, joined ----
const items = await loadWikidataArticlesBox(directory);
const artItems = [...items.values()].filter(item => ART_CLASS_RE.test(item.classes.join('|')) && !EXCLUDE_RE.test(item.classes.join('|')) && covered(item.lng, item.lat));
const byQ = new Map(osmArt.filter(a => a.wikidata).map(a => [a.wikidata!, a]));
interface Joined { osm: OsmArt | null; item: WikidataArticleItem | null }
const joined: Joined[] = osmArt.map(osm => ({ osm, item: osm.wikidata ? items.get(osm.wikidata) ?? null : null }));
let byTag = joined.filter(j => j.item).length, byDistance = 0, standalone = 0;
const claimed = new Set(joined.filter(j => j.item).map(j => j.item!.q));
for (const item of artItems) {
  if (claimed.has(item.q)) continue;
  if (byQ.has(item.q)) continue;
  let best: Joined | null = null, bestD = MATCH_METRES;
  for (const j of joined) {
    if (j.item || !j.osm) continue;
    const d = metres(item.lng, item.lat, j.osm.lng, j.osm.lat);
    if (d < bestD) { best = j; bestD = d; }
  }
  if (best) { best.item = item; byDistance++; }
  else { joined.push({ osm: null, item }); standalone++; }
  claimed.add(item.q);
}
process.stdout.write(`${artItems.length} Wikidata art items with an article inside the tiles: ${byTag} by OSM tag, ${byDistance} by distance, ${standalone} with no OSM artwork\n`);

// ---- Text ----
const page = (j: Joined) => j.item ? (j.item.en ? `en:${articleTitle(j.item.en)}` : `nl:${articleTitle(j.item.nl)}`) : j.osm?.wikipedia ?? null;
const withPage = joined.filter(j => page(j));
const nlPages = await fetchWikipediaPages('nl', withPage.map(page).filter((p): p is string => !!p && pageLanguage(p) === 'nl').map(pageTitle), { offline });
const enTitles = [
  ...withPage.map(page).filter((p): p is string => !!p && pageLanguage(p) === 'en').map(pageTitle),
  ...[...nlPages.values()].map(p => p.englishTitle).filter((t): t is string => !!t),
];
const enPages = await fetchWikipediaPages('en', enTitles, { offline });
const translations = new Map<string, string>();
for (const entry of JSON.parse(await readFile(translationsFile, 'utf8').catch(() => '[]')) as Array<{ hash: string; en: string }>) translations.set(entry.hash, entry.en);
const sourceHash = (text: string) => createHash('sha1').update(text).digest('hex').slice(0, 12);

interface MasterRecord {
  id: string; name: string; kind: StreetArtKind; lng: number; lat: number; artist?: string; year?: string; wikidata?: string; how: 'osm-tag' | 'distance' | 'wikidata-only' | 'osm-only';
  series?: { title: string; n: number; m: number }; title?: string; url?: string; imageUrl?: string | null; extract?: string; extractLang?: string; extractSource?: 'wikipedia-en' | 'translated' | 'wikipedia-nl'; original?: string; originalLang?: string; sourceText?: string; sitelinks?: number;
}
const records: MasterRecord[] = [];
const bySource = { 'wikipedia-en': 0, translated: 0, 'wikipedia-nl': 0, none: 0 };
for (const j of joined) {
  const name = j.osm?.name ?? j.item!.label;
  const record: MasterRecord = {
    id: j.osm?.id ?? j.item!.q, name, kind: j.osm?.kind ?? streetArtKind(j.item!.classes.join(' ')), lng: j.osm?.lng ?? j.item!.lng, lat: j.osm?.lat ?? j.item!.lat,
    artist: j.osm?.artist, year: j.osm?.year, wikidata: j.item?.q ?? j.osm?.wikidata, sitelinks: j.item?.sitelinks,
    how: j.osm && j.item ? (j.osm.wikidata === j.item.q ? 'osm-tag' : 'distance') : j.item ? 'wikidata-only' : 'osm-only',
  };
  const p = page(j);
  if (p) {
    let detail: WikipediaPage | undefined; let lang = pageLanguage(p);
    if (lang === 'en') detail = enPages.get(pageTitle(p));
    else {
      const dutch = nlPages.get(pageTitle(p));
      const english = dutch?.englishTitle ? enPages.get(dutch.englishTitle) : undefined;
      if (english?.extract) { detail = { ...english, image: english.image ?? dutch?.image }; lang = 'en'; } else detail = dutch;
    }
    if (detail?.extract && detail.url) {
      const source = detail.extract.replace(/\s+/g, ' ').trim();
      const display = clipExtract(source);
      Object.assign(record, { title: detail.title, url: detail.url, imageUrl: detail.image ?? null, extract: display, extractLang: lang, extractSource: lang === 'en' ? 'wikipedia-en' : 'wikipedia-nl', sourceText: source });
      if (lang !== 'en') {
        const english = translations.get(sourceHash(display));
        if (english) Object.assign(record, { extract: english, extractLang: 'en', extractSource: 'translated', original: display, originalLang: lang });
      }
    }
  }
  bySource[record.extractSource ?? 'none']++;
  records.push(record);
}
// ---- Series fallback (lane D1, 2026-11-09) ----
// A piece named "<Series> N/M" with no article of its own is looked up on nl.wikipedia by the
// "(<Series> N)" title pattern (cached; search results are kept in scripts/data/street-art-series-lookups.json so
// an offline rebuild repeats them), else takes the series article's text, flagged as series-level.
const SERIES_RE = /^(.+?)\s+(\d+)\s*\/\s*(\d+)$/;
const lookupFile = path.resolve('scripts/data/street-art-series-lookups.json');
const lookups: Record<string, string | null> = JSON.parse(await readFile(lookupFile, 'utf8').catch(() => '{}'));
const seriesReport = { series: new Set<string>(), pieces: 0, ownArticle: 0, seriesText: 0, noSeriesArticle: 0 };
const seriesOf = (r: MasterRecord) => { const m = SERIES_RE.exec(r.name); return m ? { name: m[1].trim(), n: Number(m[2]), m: Number(m[3]) } : null; };
const seriesArticle = new Map<string, MasterRecord>();
for (const r of records) if (r.extract && r.url && !seriesOf(r)) seriesArticle.set(r.name.toLowerCase(), r);
const titleHits = async (series: string, n: number): Promise<string | null> => {
  const key = `${series} ${n}`;
  if (key in lookups) return lookups[key];
  if (offline) return null;
  const url = new URL('https://nl.wikipedia.org/w/api.php');
  url.search = new URLSearchParams({ action: 'query', format: 'json', list: 'search', srsearch: `"${series} ${n}"`, srlimit: '5', srnamespace: '0' }).toString();
  let title: string | null = null;
  try {
    const data = await cachedJsonFetch(url, { cacheDirectory: '.cache/wikimedia', headers: { 'User-Agent': 'map-recall2 encyclopedia articles (https://github.com/blackmad/map-recall2)' }, attempts: 3, pauseMs: 200 });
    const exact = new RegExp(`\\(\\s*${series.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s+${n}\\s*\\)$`, 'i');
    title = (data.query?.search ?? []).map((h: { title: string }) => h.title).find((t: string) => exact.test(t)) ?? null;
  } catch { return null; } // a failed fetch is not an answer: leave it out of the cache file
  lookups[key] = title;
  return title;
};
for (const r of records) {
  const info = seriesOf(r); if (!info) continue;
  seriesReport.series.add(info.name); seriesReport.pieces++;
  if (r.extract && r.url) { seriesReport.ownArticle++; continue; }
  const own = await titleHits(info.name, info.n);
  if (own) {
    const pages = await fetchWikipediaPages('nl', [own], { offline });
    const dutch = pages.get(own);
    const english = dutch?.englishTitle ? (await fetchWikipediaPages('en', [dutch.englishTitle], { offline })).get(dutch.englishTitle) : undefined;
    const detail = english?.extract ? { ...english, image: english.image ?? dutch?.image } : dutch;
    const lang = english?.extract ? 'en' : 'nl';
    if (detail?.extract && detail.url) {
      const source = detail.extract.replace(/\s+/g, ' ').trim(), display = clipExtract(source);
      Object.assign(r, { title: detail.title, url: detail.url, imageUrl: detail.image ?? null, extract: display, extractLang: lang, extractSource: lang === 'en' ? 'wikipedia-en' : 'wikipedia-nl', sourceText: source });
      if (lang !== 'en') { const english2 = translations.get(sourceHash(display)); if (english2) Object.assign(r, { extract: english2, extractLang: 'en', extractSource: 'translated', original: display, originalLang: lang }); }
      seriesReport.ownArticle++; continue;
    }
  }
  const parent = seriesArticle.get(info.name.toLowerCase());
  if (parent) {
    Object.assign(r, { title: undefined, url: parent.url, imageUrl: parent.imageUrl, extract: parent.extract, extractLang: parent.extractLang, extractSource: parent.extractSource, series: { title: parent.title ?? parent.name, n: info.n, m: info.m } });
    seriesReport.seriesText++;
  } else seriesReport.noSeriesArticle++;
}
await mkdir(path.dirname(lookupFile), { recursive: true });
await writeFile(lookupFile, `${JSON.stringify(lookups, null, 1)}\n`);

records.sort((a, b) => (b.sitelinks ?? 0) - (a.sitelinks ?? 0) || a.name.localeCompare(b.name));
await mkdir(path.dirname(outMaster), { recursive: true });
await writeFile(outMaster, `${JSON.stringify({ version: STREET_ART_VERSION, generated: new Date().toISOString().slice(0, 10), articles: records }, null, 1)}\n`);

const points: StreetArtPoint[] = records.map(r => {
  const point: StreetArtPoint = { id: r.id, name: r.name, lng: Math.round(r.lng * 1e6) / 1e6, lat: Math.round(r.lat * 1e6) / 1e6, k: r.kind };
  if (r.artist) point.a = r.artist;
  if (r.year) point.y = r.year;
  if (r.series && r.extract) { point.s = r.series.title; point.n = r.series.n; point.m = r.series.m; point.e = r.extract; if (r.url) point.u = r.url; if (r.extractLang !== 'en') point.l = r.extractLang; if (r.imageUrl) point.i = r.imageUrl; }
  else if (r.extract && r.url) { point.t = r.title; point.u = r.url; point.e = r.extract; if (r.extractLang !== 'en') point.l = r.extractLang; if (r.imageUrl) point.i = r.imageUrl; }
  if (r.wikidata) point.q = r.wikidata;
  return point;
});
const file: StreetArtFile = { version: STREET_ART_VERSION, source: '© OpenStreetMap contributors (ODbL); Wikidata (CC0); Wikipedia (CC BY-SA)', points };
await mkdir(outDirectory, { recursive: true });
await writeFile(path.join(outDirectory, staging ? 'street-art.staged.json' : 'street-art.json'), JSON.stringify(file));
const report = { series: { names: [...seriesReport.series], pieces: seriesReport.pieces, ownArticle: seriesReport.ownArticle, seriesText: seriesReport.seriesText, noSeriesArticle: seriesReport.noSeriesArticle }, generated: new Date().toISOString(), osmArt: osmArt.length, wikidataArt: artItems.length, byTag, byDistance, standalone, points: points.length, withArticle: points.filter(p => p.e).length, bySource, pendingTranslation: bySource['wikipedia-nl'], bytes: JSON.stringify(file).length };
await writeFile(path.join(directory, 'staging', staging ? 'street-art-series-report.json' : 'street-art-report.json'), JSON.stringify(report, null, 2));
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
