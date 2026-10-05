/**
 * Photographs taken inside each neighbourhood, to fill its postcard (the postcard cuts several
 * photographs into the letters of the name).
 *
 *   NODE_USE_ENV_PROXY=1 npx tsx scripts/fetch-area-photos.ts --city amsterdam [--only Name] [--offline] [--refresh]
 *
 * Commons geosearch from one or more points inside each area (areaSearchPoints: a single centroid
 * query misses large areas and horseshoes), then licence, size and a 480px thumbnail for the files
 * that lie inside; rankAreaPhotos keeps the usable, well-spread ones.
 *
 * Everything read from Commons is kept twice: each raw response in the shared scrape store
 * (scripts/lib/scrapeStore.ts, keyed by URL), and the parts we use as two tables,
 * <db>/{geosearch,files}.jsonl (src/mapRecall/commonsStore.ts), where <db> is $COMMONS_STORE_DIR,
 * else /mnt/project-files/commons-db when that shared folder exists, else .cache/commons-db. The
 * tables hold every city; delete nothing in them. A query already in the tables is never asked again
 * unless --refresh, so reruns are free and --offline rebuilds
 * public/data/extracts/<city>/area-photos.json { areas: { name: [...] } } with no network at all.
 * API error bodies (rate limits come back as HTTP 200) are retried or reported, never stored.
 */
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { readScrape, writeScrape } from './lib/scrapeStore';
import { CommonsStore, apiError, type GeoHit } from '../src/mapRecall/commonsStore';
import { areaSearchPoints, commonsAttribution, distanceToPolygonsKm, pointInPolygons, rankAreaPhotos, type AreaPhotoFile } from '../src/mapRecall/neighborhoodGaps';

const arg = (name: string) => (process.argv.includes(name) ? process.argv[process.argv.indexOf(name) + 1] : undefined);
const cityId = arg('--city') ?? 'amsterdam';
const only = arg('--only');
const offline = process.argv.includes('--offline'), refresh = process.argv.includes('--refresh');
const directory = path.resolve(`public/data/extracts/${cityId}`);
// The tables are too large for git (about 2 KB per file with its licence and description HTML), so
// they live in the project's shared folder, which outlives cloud sessions; elsewhere set COMMONS_STORE_DIR.
const storeRoot = process.env.COMMONS_STORE_DIR ?? (existsSync('/mnt/project-files') ? '/mnt/project-files/commons-db' : path.resolve('.cache/commons-db'));
const storeDir = storeRoot;
const GEO_LIMIT = 200, MAX_INFO = 240, NEAR_KM = 0.15;

const headers: Record<string, string> = { 'User-Agent': 'MapQuestExtractBuilder/1.0 (https://github.com/blackmad/map-recall2)' };
if (process.env.WIKIMEDIA_TOKEN) headers.Authorization = `Bearer ${process.env.WIKIMEDIA_TOKEN}`;
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
let nextAt = 0, requests = 0;

async function getJson(url: URL): Promise<any> {
  if (!refresh) {
    const stored = await readScrape(url);
    if (stored) return stored.body;
  }
  if (offline) throw new Error('not in the store (offline)');
  for (let attempt = 0; attempt < 8; attempt++) {
    const start = Math.max(Date.now(), nextAt); nextAt = start + 600; await wait(start - Date.now());
    const response = await fetch(url, { headers }); requests++;
    const backoff = () => { nextAt = Math.max(nextAt, Date.now() + Math.max((Number(response.headers.get('retry-after')) || 0) * 1000, 3000 * 2 ** Math.min(attempt, 4))); };
    if (response.ok) {
      const data = JSON.parse(await response.text());
      const error = apiError(data);
      if (error?.retryable) { backoff(); continue; }
      if (error) throw new Error(`API ${error.code}: ${error.info ?? ''}`);
      await writeScrape(url, data);
      return data;
    }
    if (response.status !== 429 && response.status < 500) throw new Error(`HTTP ${response.status}`);
    backoff();
  }
  throw new Error('gave up');
}
const api = (params: Record<string, string>) => { const u = new URL('https://commons.wikimedia.org/w/api.php'); u.search = new URLSearchParams({ format: 'json', origin: '*', ...params }).toString(); return u; };

async function readOr(file: string) { try { return await readFile(file, 'utf8'); } catch { return ''; } }
const store = CommonsStore.parse(await readOr(path.join(storeDir, 'geosearch.jsonl')), await readOr(path.join(storeDir, 'files.jsonl')));
const before = { geo: store.geo.size, files: store.files.size };
async function saveStore() {
  const { geo, files } = store.serialise();
  await mkdir(storeDir, { recursive: true });
  await writeFile(path.join(storeDir, 'geosearch.jsonl'), geo); await writeFile(path.join(storeDir, 'files.jsonl'), files);
}

interface Area { name: string; geometry: [number, number][][][] }
const raw = JSON.parse(await readFile(path.join(directory, 'boundaries.json'), 'utf8')) as Area[] | { features?: Area[]; boundaries?: Area[] };
const areas = Array.isArray(raw) ? raw : raw.features ?? raw.boundaries ?? [];

const out: Record<string, Array<{ title: string; imageUrl: string; imageAttribution: string; sourceUrl: string; nearby?: true }>> = {};
try { Object.assign(out, JSON.parse(await readFile(path.join(directory, 'area-photos.json'), 'utf8')).areas); } catch { /* first run */ }
const saveOut = () => writeFile(path.join(directory, 'area-photos.json'), `${JSON.stringify({ version: 1, generatedAt: new Date().toISOString(), areas: out }, null, 1)}\n`);

/** Hits of several queries, interleaved so a capped list still samples every cell. */
function interleave(lists: GeoHit[][]): GeoHit[] {
  const seen = new Set<number>(), result: GeoHit[] = [];
  for (let i = 0; lists.some(list => i < list.length); i++) for (const list of lists) {
    const hit = list[i];
    if (hit && !seen.has(hit.pageid)) { seen.add(hit.pageid); result.push(hit); }
  }
  return result;
}

let processed = 0, failed = 0, saturated = 0;
for (const area of areas) {
  if (only && area.name !== only) continue;
  try {
    // 1. Geosearch from each search point, answered from the store when we have asked before.
    const lists: GeoHit[][] = [];
    for (const point of areaSearchPoints(area.geometry)) {
      const key = { lat: point.lat, lon: point.lon, radiusM: point.radiusM, namespace: 6, limit: GEO_LIMIT };
      let query = refresh ? undefined : store.getGeo(key);
      if (!query) {
        const data = await getJson(api({ action: 'query', list: 'geosearch', gscoord: `${point.lat}|${point.lon}`, gsradius: String(point.radiusM), gsnamespace: '6', gslimit: String(GEO_LIMIT) }));
        const hits = ((data.query?.geosearch ?? []) as GeoHit[]).map(({ pageid, title, lat, lon }) => ({ pageid, title, lat, lon }));
        query = { ...key, hits, fetchedAt: new Date().toISOString() };
        store.addGeo(query);
      }
      if (query.hits.length >= GEO_LIMIT) saturated++;
      lists.push(query.hits);
    }
    const all = interleave(lists);
    let inside = all.filter(hit => pointInPolygons([hit.lat, hit.lon], area.geometry)).slice(0, MAX_INFO);
    if (inside.length < 40) inside = all.filter(hit => distanceToPolygonsKm([hit.lat, hit.lon], area.geometry) <= NEAR_KM).slice(0, MAX_INFO);
    // 2. imageinfo for inside files the store lacks, 40 at a time.
    const missing = inside.filter(hit => refresh || !store.files.has(hit.pageid)).map(hit => hit.pageid);
    for (let i = 0; i < missing.length; i += 40) {
      const data = await getJson(api({ action: 'query', prop: 'imageinfo', iiprop: 'url|size|mime|extmetadata', iiurlwidth: '480', pageids: missing.slice(i, i + 40).join('|') }));
      const fetchedAt = new Date().toISOString();
      for (const page of Object.values<any>(data.query?.pages ?? {})) store.addImageInfoPage(page, fetchedAt);
    }
    // 3. Rank from the store alone, so --offline gives the same answer.
    const files: AreaPhotoFile[] = inside.flatMap(hit => {
      const f = store.files.get(hit.pageid);
      return f ? [{ title: f.title, url: f.url, thumbUrl: f.thumbUrl, width: f.width, height: f.height, mime: f.mime, license: f.meta.LicenseShortName, artist: f.meta.Artist, categories: f.meta.Categories, lat: hit.lat, lon: hit.lon }] : [];
    });
    // Too few inside (small islands, parks): allow photos taken just outside the boundary, flagged.
    const insidePicks = rankAreaPhotos(files, area.geometry, 8);
    const picks = insidePicks.length >= 2 ? insidePicks : rankAreaPhotos(files, area.geometry, 8, NEAR_KM);
    out[area.name] = picks.map(f => ({
      title: f.title.replace(/^File:/, '').replace(/\.jpe?g$/i, '').replace(/_/g, ' '),
      imageUrl: f.thumbUrl!, imageAttribution: commonsAttribution(f), sourceUrl: `https://commons.wikimedia.org/wiki/${encodeURIComponent(f.title.replace(/ /g, '_'))}`,
      ...(pointInPolygons([f.lat, f.lon], area.geometry) ? {} : { nearby: true }),
    }));
    console.log(`${area.name}: ${lists.length} searches, ${inside.length} candidates, ${out[area.name].length} kept`);
  } catch (error) { failed++; console.log(`${area.name}: failed (${(error as Error).message}); kept previous photos, retry next run`); }
  if (++processed % 5 === 0) { await saveStore(); await saveOut(); } // a run that dies keeps what it found
}
await saveStore(); await saveOut();
const names = [...new Set(areas.map(a => a.name))];
const thin = names.filter(n => (out[n]?.length ?? 0) < 2);
console.log(`${cityId}: ${names.length - thin.length}/${names.length} areas have 2+ photos; ${failed} failed; ${saturated} searches hit the ${GEO_LIMIT}-result cap; ${requests} requests; store +${store.geo.size - before.geo} queries, +${store.files.size - before.files} files`);
if (thin.length) console.log(`under 2 photos: ${thin.map(n => `${n} (${out[n]?.length ?? 0})`).join(', ')}`);
