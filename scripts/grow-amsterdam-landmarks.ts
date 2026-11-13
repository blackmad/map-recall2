/**
 * Grow the Amsterdam landmark extract without rebuilding the whole extract.
 *
 * `build-amsterdam-extract.ts` kept the top 420 landmarks by a prominence that
 * gave +200 for merely carrying an OSM wikidata/wikipedia tag, so a local
 * mosque with 250 views in 60 days outranked the Westerkerk and famous places
 * (Magere Brug's neighbours, Schreierstoren, Stopera …) fell off the cut.
 * This script re-reads only the landmark-class OSM features from the cached
 * BBBike PBF (the same tags-filter classes as `refresh-city-extract.sh`,
 * which are a superset of `src/utils/osm.ts`'s landmarks Overpass branch),
 * classifies and names them exactly as the extract build does — so ids,
 * hashed from `category:name`, stay stable — enriches every Wikidata-linked
 * candidate (sitelinks, pageviews, English intro, image, P31, P1435, P361),
 * and admits the ones that clear `LANDMARK_NOTABILITY_FLOOR`.
 *
 * Writes `landmarks.grow.staging.json` and a report; `--publish` writes the
 * real `landmarks.json` (existing features keep every field; they only gain
 * `wikidataPartOf`). Re-runs are cheap: Wikimedia responses are cached in
 * `.cache/wikimedia`.
 *
 * Inputs (export them once from the cached PBF):
 *   osmium tags-filter .cache/osm-source/Amsterdam.osm.pbf \
 *     nwr/tourism=attraction,museum,viewpoint,monument,gallery,zoo nwr/historic \
 *     nwr/amenity=theatre,arts_centre,community_centre,townhall,place_of_worship,cinema,library,university,college,music_venue \
 *     -o lm.osm.pbf && osmium export lm.osm.pbf -o lm.geojson
 *   osmium tags-filter .cache/osm-source/Amsterdam.osm.pbf r/name=Amsterdam -o b.osm.pbf && osmium export b.osm.pbf -o b.geojson
 *
 * Usage: node --import tsx scripts/grow-amsterdam-landmarks.ts <lm.geojson> <b.geojson> [--directory=…] [--publish]
 *
 * `refresh-city-extract.sh` runs it on a full refresh (its features.geojson
 * holds the same landmark classes), so a rebuilt extract keeps these places.
 */
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { classify, extractName } from './lib/extractNaming.ts';
import { findMunicipality } from './lib/municipality.ts';
import { cachedJsonFetch } from './lib/cached-json-fetch.ts';
import { pickNearestDistractors } from '../src/canalRecall/bridgeDistractors.ts';
import { isAList } from '../src/canalRecall/game/poiNotability.ts';
import { normaliseAnswer } from '../src/canalRecall/answerPath.ts';
import { mergeManualPoiFeatures } from '../src/canalRecall/game/manualPoiCatalog.ts';
import { namesAlike, SAME_BUILDING_KM } from '../src/canalRecall/game/destinationDedupe.ts';
import { LANDMARK_NOTABILITY_FLOOR, landmarkNotability, admitLandmarkCandidate } from '../src/canalRecall/game/landmarkSelection.ts';

type Position = [number, number];
interface GeoJsonFeature {
  geometry: { type: string; coordinates: unknown } | null;
  properties: Record<string, string | undefined>;
}
type Feature = Record<string, any> & { id: string; name: string; center: [number, number] };

const [landmarkFile, boundaryFile] = process.argv.slice(2).filter(arg => !arg.startsWith('--'));
if (!landmarkFile || !boundaryFile) throw new Error('usage: grow-amsterdam-landmarks.ts <lm.geojson> <b.geojson> [--publish]');
const publish = process.argv.includes('--publish');
const directory = path.resolve(process.argv.find(arg => arg.startsWith('--directory='))?.slice('--directory='.length) || 'public/data/extracts/amsterdam');
const headers = { 'User-Agent': 'MapRecallExtractBuilder/1.0 (https://github.com/blackmad/map-recall2)' };
const fetchJson = (url: URL) => cachedJsonFetch(url, { cacheDirectory: '.cache/wikimedia', headers, attempts: 4, pauseMs: 250 });
const chunks = <T>(items: T[], size: number) => Array.from({ length: Math.ceil(items.length / size) }, (_, i) => items.slice(i * size, (i + 1) * size));

// --- identical to build-amsterdam-extract.ts ---------------------------------
function stableStringHash(value: string): number {
  return [...value].reduce((hash, char) => ((hash * 31) + char.charCodeAt(0)) | 0, 17);
}
const distance = (a: [number, number], b: [number, number]) => {
  const latScale = 111_320;
  const lonScale = latScale * Math.cos(((a[0] + b[0]) / 2) * Math.PI / 180);
  return Math.hypot((a[0] - b[0]) * latScale, (a[1] - b[1]) * lonScale);
};
function simplify(points: [number, number][], tolerance = 3): [number, number][] {
  if (points.length <= 2) return points;
  const first = points[0], last = points[points.length - 1];
  let furthest = 0, furthestIndex = 0;
  for (let index = 1; index < points.length - 1; index++) {
    const a = distance(first, points[index]), b = distance(points[index], last), c = distance(first, last);
    const area = Math.max(0, (a + b + c) * (-a + b + c) * (a - b + c) * (a + b - c));
    const perpendicular = c > 0 ? Math.sqrt(area) / c : a;
    if (perpendicular > furthest) [furthest, furthestIndex] = [perpendicular, index];
  }
  if (furthest <= tolerance) return [first, last];
  return [...simplify(points.slice(0, furthestIndex + 1), tolerance).slice(0, -1), ...simplify(points.slice(furthestIndex), tolerance)];
}
const quantise = ([lat, lon]: [number, number]): [number, number] => [Math.round(lat * 1e6) / 1e6, Math.round(lon * 1e6) / 1e6];
function pathsFromGeometry(feature: GeoJsonFeature): [number, number][][] {
  const geometry = feature.geometry;
  if (!geometry || geometry.type === 'Point') return [];
  const convert = (positions: Position[]) => positions.map(([lon, lat]) => quantise([lat, lon]));
  if (geometry.type === 'LineString') return [convert(geometry.coordinates as Position[])];
  if (geometry.type === 'MultiLineString' || geometry.type === 'Polygon') return (geometry.coordinates as Position[][]).map(convert);
  if (geometry.type === 'MultiPolygon') return (geometry.coordinates as Position[][][]).flatMap(polygon => polygon.slice(0, 1).map(convert));
  return [];
}
function pointInRing([lat, lon]: [number, number], ring: Position[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > lat) !== (yj > lat) && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
const CIVIC_CLASS_SCORE: Record<string, number> = {
  university: 60, library: 50, cinema: 45, music_venue: 45, theatre: 40, arts_centre: 30, community_centre: 25, marketplace: 35,
};

// --- candidates ---------------------------------------------------------------
const source = JSON.parse(await readFile(landmarkFile, 'utf8')) as { features: GeoJsonFeature[] };
const boundaries = JSON.parse(await readFile(boundaryFile, 'utf8')) as { features: GeoJsonFeature[] };
const municipality = findMunicipality(boundaries.features as any, 'Amsterdam') as GeoJsonFeature | undefined;
if (!municipality?.geometry) throw new Error('Amsterdam municipality polygon not found');
const polygons = (municipality.geometry.type === 'Polygon'
  ? [municipality.geometry.coordinates] : municipality.geometry.coordinates) as Position[][][];
const inCity = (point: [number, number]) => polygons.some(polygon => pointInRing(point, polygon[0]) && !polygon.slice(1).some(hole => pointInRing(point, hole)));

interface Candidate { feature: Feature; paths: [number, number][][]; score: number; osmType: string }
const grouped = new Map<string, Candidate>();
for (const item of source.features) {
  const tags = item.properties || {};
  const classification = classify(tags);
  if (classification?.category !== 'landmarks' || !item.geometry) continue;
  const paths = pathsFromGeometry(item).filter(line => line.length > 1);
  let pointCenter: [number, number] | undefined;
  if (item.geometry.type === 'Point') {
    const [lon, lat] = item.geometry.coordinates as Position;
    pointCenter = [lat, lon];
  }
  const candidateCenter = pointCenter || paths[0]?.[Math.floor(paths[0].length / 2)];
  if (!candidateCenter) continue;
  const center = inCity(candidateCenter) ? candidateCenter : paths.flat().find(inCity);
  if (!center) continue;
  const name = extractName(tags, 'landmarks').trim();
  if (!name) continue;
  const key = `landmarks:${name.toLocaleLowerCase()}`;
  const mappedLength = paths.reduce((total, line) => total + line.slice(1).reduce((sum, point, index) => sum + distance(line[index], point), 0), 0);
  const score = Math.round((tags.wikidata ? 120 : 0) + (tags.wikipedia ? 80 : 0) + (CIVIC_CLASS_SCORE[tags.amenity || ''] || 0)
    + Math.log10(Math.max(10, mappedLength)) * 12);
  const existing = grouped.get(key);
  if (existing) {
    existing.paths.push(...paths);
    existing.score = Math.max(existing.score, score);
    existing.feature.wikidata ||= tags.wikidata;
    existing.feature.wikipedia ||= tags.wikipedia;
    continue;
  }
  grouped.set(key, {
    paths, score, osmType: item.geometry.type,
    feature: {
      id: `extract_landmarks_${Math.abs(stableStringHash(key))}`,
      name, type: classification.type, cityId: 'amsterdam', center,
      radius: pointCenter ? 70 : undefined, funFact: '', clues: [], distractors: [],
      wikidata: tags.wikidata, wikipedia: tags.wikipedia,
      // OSM tags the notability scorer reads; dropped before publishing.
      _tourism: tags.tourism, _amenity: tags.amenity, _historic: tags.historic,
    },
  });
}

const existing = JSON.parse(await readFile(path.join(directory, 'landmarks.json'), 'utf8')) as Feature[];
const existingIds = new Set(existing.map(feature => feature.id));
const candidateIds = new Set([...grouped.values()].map(c => c.feature.id));
const extractIds = existing.filter(f => f.id.startsWith('extract_landmarks_'));
const missingIds = extractIds.filter(f => !candidateIds.has(f.id));
process.stdout.write(`OSM landmark candidates ${grouped.size}; existing ${existing.length} (${extractIds.length} extract ids, `
  + `${extractIds.length - missingIds.length} reproduced by id)\n`);
if (missingIds.length) process.stdout.write(`  not reproduced (kept as they are): ${missingIds.map(f => f.name).join(', ')}\n`);
const taggedOutside = [...grouped.values()].filter(c => !existingIds.has(c.feature.id) && c.feature.wikidata);
process.stdout.write(`OSM-tagged (wikidata) landmark candidates outside the extract: ${taggedOutside.length} `
  + '(the 420 cap only ever cut untagged features, which carry no article and are never destinations)\n');

// --- Wikidata candidates --------------------------------------------------------
// The places OSM does not link to Wikidata: notable items within 8 km of the
// centre whose class is a building, museum, monument, place of worship,
// attraction, gallery, theatre, library, zoo or opera house — never a
// station, street, square, bridge, waterway or neighbourhood (those are other
// categories or quiz answers; see the report's notes).
const SPARQL = 'https://query.wikidata.org/sparql';
const sparql = async (query: string) => {
  const url = new URL(SPARQL);
  url.search = new URLSearchParams({ query, format: 'json' }).toString();
  return (await fetchJson(url)).results.bindings as Array<Record<string, { value: string }>>;
};
const point = (wkt: string): [number, number] => {
  const [lon, lat] = wkt.replace(/^Point\(|\)$/g, '').split(' ').map(Number);
  return [lat, lon];
};
const notableRows = await sparql(`SELECT DISTINCT ?item ?coord WHERE {
  SERVICE wikibase:around { ?item wdt:P625 ?coord. bd:serviceParam wikibase:center "Point(4.8936 52.372851)"^^geo:wktLiteral. bd:serviceParam wikibase:radius "8". }
  ?item wikibase:sitelinks ?links. FILTER(?links >= 3)
  ?enwiki schema:about ?item; schema:isPartOf <https://en.wikipedia.org/>.
  ?item wdt:P31/wdt:P279* ?root.
  VALUES ?root { wd:Q811979 wd:Q33506 wd:Q4989906 wd:Q570116 wd:Q1007870 wd:Q16970 wd:Q860861 wd:Q43501 wd:Q24354 wd:Q153562 wd:Q7075 }
  MINUS { ?item wdt:P31/wdt:P279* ?bad. VALUES ?bad { wd:Q55488 wd:Q928830 wd:Q79007 wd:Q174782 wd:Q12280 wd:Q123705 wd:Q34442 wd:Q4022 wd:Q3305213 wd:Q1190554 wd:Q44782 wd:Q57821 wd:Q1656682 } }
}`);
// Every sitelinked item nearby, for giving modelled entries without a QID theirs.
const allRows = await sparql(`SELECT DISTINCT ?item ?coord ?label ?nl WHERE {
  SERVICE wikibase:around { ?item wdt:P625 ?coord. bd:serviceParam wikibase:center "Point(4.8936 52.372851)"^^geo:wktLiteral. bd:serviceParam wikibase:radius "12". }
  ?item wikibase:sitelinks ?links. FILTER(?links >= 1)
  OPTIONAL { ?item rdfs:label ?label FILTER(LANG(?label)="en") }
  OPTIONAL { ?item rdfs:label ?nl FILTER(LANG(?nl)="nl") }
}`);
const qidOf = (row: Record<string, { value: string }>) => row.item.value.split('/').pop() as string;
const nearby = new Map<string, { qid: string; center: [number, number]; names: string[] }>();
for (const row of allRows) {
  const qid = qidOf(row);
  const entry = nearby.get(qid) ?? { qid, center: point(row.coord.value), names: [] };
  for (const name of [row.label?.value, row.nl?.value]) if (name && !entry.names.includes(name)) entry.names.push(name);
  nearby.set(qid, entry);
}
const merged = mergeManualPoiFeatures(existing as any, 'amsterdam') as unknown as Feature[];
const knownQids = new Set(merged.flatMap(f => (f.wikidata ? [f.wikidata] : [])));
const kmTo = (a: [number, number], b: readonly number[]) => distance(a, [b[0], b[1]]) / 1000;

// Backfill: a modelled entry with no QID takes the sitelinked item that stands
// within 80 m under a like name (Wikidata coordinates, OSM-independent).
/** Reviewed 2026-11-13: like-named items that are not the place. */
const BACKFILL_REJECT: Record<string, string> = {
  Q56641046: 'the fence of De Nederlandsche Bank, not the bank',
  Q1854398: 'Johnny Jordaanplein is the square, not the statue group',
};
/** Reviewed 2026-11-13: notable items that are not places to ride to. */
const CANDIDATE_REJECT: Record<string, string> = {
  Q4271952: 'NAP marker inside the Stopera passage; the Stopera is the destination',
};
const backfill: Record<string, { wikidata: string; name: string; metres: number; matched: string }> = {};
for (const feature of merged) {
  if (feature.wikidata || !feature.manualPoi) continue;
  const centre = (feature.routeCenter ?? feature.center) as [number, number];
  // Same normalised name beats a looser match; then the nearer.
  let best: { qid: string; metres: number; exact: boolean } | null = null;
  const own = normaliseAnswer(feature.name);
  for (const item of nearby.values()) {
    const km = kmTo(item.center, centre);
    if (km > SAME_BUILDING_KM || knownQids.has(item.qid) || BACKFILL_REJECT[item.qid]) continue;
    if (!item.names.some(name => namesAlike(name, feature.name))) continue;
    const exact = item.names.some(name => normaliseAnswer(name) === own);
    const metres = Math.round(km * 1000);
    if (!best || (exact && !best.exact) || (exact === best.exact && metres < best.metres)) best = { qid: item.qid, metres, exact };
  }
  if (best) backfill[feature.id] = { wikidata: best.qid, name: feature.name, metres: best.metres, matched: nearby.get(best.qid)?.names.join(' / ') ?? '' };
}
process.stdout.write(`manual entries without a QID: ${merged.filter(f => f.manualPoi && !f.wikidata).length}; `
  + `backfilled by a like-named Wikidata item within 80 m: ${Object.keys(backfill).length}\n`);

const fresh: Candidate[] = [];
const skippedAsTwin: string[] = [];
for (const row of notableRows) {
  const qid = qidOf(row);
  if (CANDIDATE_REJECT[qid] || knownQids.has(qid) || Object.values(backfill).some(b => b.wikidata === qid) || fresh.some(c => c.feature.wikidata === qid)) continue;
  const centre = point(row.coord.value);
  if (!inCity(centre)) continue;
  const names = nearby.get(qid)?.names ?? [];
  const label = names[0];
  if (!label) continue;
  // An existing destination under another name in the same building is a twin, not a new place.
  const twin = merged.find(f => kmTo(centre, (f.routeCenter ?? f.center) as number[]) <= SAME_BUILDING_KM && names.some(n => namesAlike(n, f.name)));
  if (twin) { skippedAsTwin.push(`${label} ~ ${twin.name}`); continue; }
  // The OSM feature for it, when OSM maps it without the link: geometry, tags and a stable id.
  const osm = [...grouped.values()].find(c => !existingIds.has(c.feature.id) && !c.feature.wikidata
    && kmTo(centre, c.feature.center) <= SAME_BUILDING_KM && names.some(n => namesAlike(n, c.feature.name)));
  if (osm) {
    osm.feature.wikidata = qid;
    fresh.push(osm);
    continue;
  }
  const key = `landmarks:${label.toLocaleLowerCase()}`;
  fresh.push({
    paths: [], score: 0, osmType: 'wikidata',
    feature: {
      id: `extract_landmarks_${Math.abs(stableStringHash(key))}`, name: label, type: 'landmark', cityId: 'amsterdam',
      center: centre, radius: 70, funFact: '', clues: [], distractors: [], wikidata: qid,
    },
  });
}
process.stdout.write(`Wikidata notable building-class items in the city: ${notableRows.length}; new candidates ${fresh.length} `
  + `(${fresh.filter(c => c.osmType !== 'wikidata').length} matched to an unlinked OSM feature); twins skipped ${skippedAsTwin.length}\n`);

// --- enrichment ---------------------------------------------------------------
interface Entity { sitelinks: number; enwiki?: string; nlwiki?: string; heritage: string[]; instanceOf: string[]; partOf: string[]; label?: string }
const entities = new Map<string, Entity>();
const qids = [...new Set([...fresh.map(c => c.feature.wikidata as string), ...existing.flatMap(f => f.wikidata ? [f.wikidata] : []), ...Object.values(backfill).map(b => b.wikidata)])];
const claimIds = (claims: any[] | undefined) => (claims || []).map(c => c.mainsnak?.datavalue?.value?.id).filter((id: unknown): id is string => typeof id === 'string');
for (const batch of chunks(qids, 50)) {
  const url = new URL('https://www.wikidata.org/w/api.php');
  url.search = new URLSearchParams({ action: 'wbgetentities', format: 'json', props: 'sitelinks|claims|labels', languages: 'en', ids: batch.join('|'), origin: '*' }).toString();
  const data = await fetchJson(url);
  for (const [qid, entity] of Object.entries(data.entities || {}) as [string, any][]) {
    const links = entity.sitelinks || {};
    entities.set(qid, {
      sitelinks: Object.keys(links).length, enwiki: links.enwiki?.title, nlwiki: links.nlwiki?.title,
      heritage: claimIds(entity.claims?.P1435), instanceOf: claimIds(entity.claims?.P31), partOf: claimIds(entity.claims?.P361),
      label: entity.labels?.en?.value,
    });
  }
}

interface Page { views: number; extract?: string; url?: string; image?: string }
const pages = new Map<string, Page>();
async function fetchPages(language: string, titles: string[]): Promise<void> {
  for (const batch of chunks(titles, 10)) {
    const url = new URL(`https://${language}.wikipedia.org/w/api.php`);
    url.search = new URLSearchParams({
      action: 'query', format: 'json', prop: 'pageviews|extracts|pageimages|info', pvipdays: '60', redirects: '1',
      exintro: '1', explaintext: '1', exchars: '360', piprop: 'thumbnail', pithumbsize: '640', inprop: 'url',
      titles: batch.join('|'), origin: '*',
    }).toString();
    const data = await fetchJson(url);
    const aliases = new Map<string, string>();
    for (const item of [...(data.query?.normalized || []), ...(data.query?.redirects || [])]) aliases.set(item.from, item.to);
    for (const page of Object.values(data.query?.pages || {}) as any[]) {
      const views = Object.values(page.pageviews || {}).reduce<number>((sum, value) => sum + ((value as number) || 0), 0);
      const record = { views, extract: page.extract, url: page.fullurl, image: page.thumbnail?.source };
      pages.set(`${language}:${page.title}`, record);
      for (const [original, target] of aliases) if (target === page.title) pages.set(`${language}:${original}`, record);
    }
  }
}
const enTitles = [...new Set([...fresh.map(c => entities.get(c.feature.wikidata)?.enwiki), ...Object.values(backfill).map(b => entities.get(b.wikidata)?.enwiki)]
  .filter((t): t is string => !!t))];
await fetchPages('en', enTitles);

const added: Feature[] = [];
const rejected: Array<{ name: string; reason: string; score: number }> = [];
for (const candidate of fresh) {
  const feature = candidate.feature;
  const entity = entities.get(feature.wikidata);
  const page = entity?.enwiki ? pages.get(`en:${entity.enwiki}`) : undefined;
  if (entity) {
    if (entity.sitelinks) feature.wikidataSitelinks = entity.sitelinks;
    if (entity.heritage.length) feature.heritage = entity.heritage;
    if (entity.instanceOf.length) feature.wikidataInstanceOf = entity.instanceOf;
    if (entity.partOf.length) feature.wikidataPartOf = entity.partOf;
  }
  if (page) {
    if (page.views) feature.wikipediaPageviews60d = page.views;
    if (page.extract) { feature.wikipediaExtract = page.extract; feature.wikipediaExtractSource = 'wikipedia'; }
    if (page.url) feature.wikipediaUrl = page.url;
    if (page.image) feature.wikipediaImageUrl = page.image;
  }
  const score = landmarkNotability({ ...feature, tourism: feature._tourism, amenity: feature._amenity, historic: feature._historic });
  const verdict = admitLandmarkCandidate({ ...feature, notability: score, hasEnglishArticle: !!page?.extract });
  if (!verdict.admit) { rejected.push({ name: feature.name, reason: verdict.reason, score }); continue; }
  const lines = candidate.paths.map(line => simplify(line)).filter(line => line.length > 1);
  const encyclopediaScore = Math.round(Math.log10((page?.views || 0) + 1) * 18 + Math.log2((entity?.sitelinks || 0) + 1) * 12);
  const prominenceScore = candidate.score + encyclopediaScore;
  const out: Feature = { ...feature };
  delete out._tourism; delete out._amenity; delete out._historic;
  if (out.radius === undefined) delete out.radius;
  if (!out.wikipedia) delete out.wikipedia;
  Object.assign(out, {
    difficulty: prominenceScore >= 140 ? 'easy' : prominenceScore >= 70 ? 'medium' : 'hard',
    prominenceScore, encyclopediaScore: encyclopediaScore || undefined,
    ...(lines.length ? { path: lines[0], ...(lines.length > 1 ? { paths: lines } : {}) } : {}),
  });
  added.push(out);
}

// P361 on existing features too, so complex parts (Westertoren of the
// Westerkerk) can be folded into their main destination at pool build time.
let partOfFilled = 0;
const grown = existing.map(feature => {
  const partOf = feature.wikidata ? entities.get(feature.wikidata)?.partOf : undefined;
  if (!partOf?.length) return feature;
  partOfFilled++;
  return { ...feature, wikidataPartOf: partOf };
});
const pool = [...grown, ...added];
const distractorPool = pool.map(f => ({ id: f.id, name: f.name, center: f.center as [number, number] }));
for (const feature of added) {
  feature.distractors = pickNearestDistractors({ id: feature.id, name: feature.name, center: feature.center as [number, number] }, distractorPool);
}

// Fame for the backfilled modelled entries, keyed on their landmark id.
const manualWikidata: Record<string, Record<string, unknown>> = {};
for (const [id, entry] of Object.entries(backfill).sort(([a], [b]) => a.localeCompare(b))) {
  const entity = entities.get(entry.wikidata);
  const page = entity?.enwiki ? pages.get(`en:${entity.enwiki}`) : undefined;
  manualWikidata[id] = {
    name: entry.name, wikidata: entry.wikidata, wikidataName: entry.matched, matchMetres: entry.metres,
    ...(entity?.sitelinks ? { wikidataSitelinks: entity.sitelinks } : {}),
    ...(page?.views ? { wikipediaPageviews60d: page.views } : {}),
    ...(entity?.heritage.length ? { heritage: entity.heritage } : {}),
    ...(entity?.instanceOf.length ? { wikidataInstanceOf: entity.instanceOf } : {}),
    ...(page?.url ? { wikipediaUrl: page.url } : {}),
  };
}

// --- report -------------------------------------------------------------------
const byKind = new Map<string, number>();
for (const feature of added) {
  const kind = feature.type === 'museum' ? 'museum' : (feature.wikidataInstanceOf?.[0] ?? feature.type);
  byKind.set(kind, (byKind.get(kind) || 0) + 1);
}
const scored = added.map(f => ({ f, s: landmarkNotability(f) })).sort((a, b) => b.s - a.s);
const json = JSON.stringify(pool);
const report = [
  `admitted ${added.length} new landmarks (floor ${LANDMARK_NOTABILITY_FLOOR}); rejected ${rejected.length}`,
  `rejections by reason: ${JSON.stringify(Object.fromEntries([...new Set(rejected.map(r => r.reason))].map(r => [r, rejected.filter(x => x.reason === r).length])))}`,
  `P361 part-of filled on ${partOfFilled} existing features`,
  `manual QID backfill: ${Object.keys(manualWikidata).length}`,
  ...Object.entries(manualWikidata).map(([id, m]) => `  ${m.name} [${id}] -> ${m.wikidata} ${m.wikidataName} (${m.matchMetres} m)`),
  `twins skipped: ${skippedAsTwin.join('; ')}`,
  `landmarks.json ${existing.length} -> ${pool.length} features, ${(Buffer.byteLength(json) / 1024).toFixed(0)} kB raw`,
  `added by first P31 / type: ${JSON.stringify(Object.fromEntries([...byKind].sort((a, b) => b[1] - a[1])))}`,
  'added (notability):',
  ...scored.map(({ f, s }) => `  ${s.toFixed(1).padStart(5)} ${isAList(f) ? 'A ' : '  '}${f.name} [${f.wikidata}] ${f.wikipediaPageviews60d ?? 0} views, ${f.wikidataSitelinks ?? 0} sitelinks`),
  'best rejected:',
  ...rejected.sort((a, b) => b.score - a.score).slice(0, 25).map(r => `  ${r.score.toFixed(1).padStart(5)} ${r.name}: ${r.reason}`),
];
process.stdout.write(`${report.join('\n')}\n`);
await writeFile(path.join(directory, 'landmarks.grow.staging.json'), json);
const manualFile = path.resolve('src/canalRecall/game/manual-poi-wikidata.json');
await writeFile(publish ? manualFile : manualFile.replace(/\.json$/, '.staging.json'), `${JSON.stringify(manualWikidata, null, 2)}\n`);
await writeFile(path.resolve('artifacts/landmarks-grow-report.txt'), `${report.join('\n')}\n`).catch(() => {});
if (publish) {
  await writeFile(path.join(directory, 'landmarks.json'), json);
  process.stdout.write('published landmarks.json\n');
} else process.stdout.write('dry run: staging written to landmarks.grow.staging.json; pass --publish after review\n');
