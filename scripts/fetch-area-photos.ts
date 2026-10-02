/**
 * Photographs taken inside each neighbourhood, to fill its postcard (the postcard cuts several
 * photographs into the letters of the name).
 *
 *   NODE_USE_ENV_PROXY=1 npx tsx scripts/fetch-area-photos.ts --city amsterdam [--refresh]
 *
 * Commons geosearch around each area's centre (radius from its bounds, capped at the API's 10 km),
 * with coordinates, licence and a 480px thumbnail in one request; rankAreaPhotos keeps the usable,
 * well-spread ones. Output: public/data/extracts/<city>/area-photos.json { areas: { name: [...] } }.
 */
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { centroidOf, commonsAttribution, distanceKm, pointInPolygons, rankAreaPhotos, type AreaPhotoFile } from '../src/mapRecall/neighborhoodGaps';

const cityId = process.argv.includes('--city') ? process.argv[process.argv.indexOf('--city') + 1] : 'amsterdam';
const directory = path.resolve(`public/data/extracts/${cityId}`);
const cacheDir = path.join(directory, 'staging/area-photos/cache');
const headers: Record<string, string> = { 'User-Agent': 'MapQuestExtractBuilder/1.0 (https://github.com/blackmad/map-recall2)' };
if (process.env.WIKIMEDIA_TOKEN) headers.Authorization = `Bearer ${process.env.WIKIMEDIA_TOKEN}`;
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
let nextAt = 0;

async function getJson(url: URL): Promise<any> {
  const file = path.join(cacheDir, `${createHash('sha1').update(url.toString()).digest('hex')}.json`);
  if (!process.argv.includes('--refresh')) { try { return JSON.parse(await readFile(file, 'utf8')); } catch { /* not cached */ } }
  for (let attempt = 0; attempt < 8; attempt++) {
    const start = Math.max(Date.now(), nextAt); nextAt = start + 600; await wait(start - Date.now());
    const response = await fetch(url, { headers });
    if (response.ok) {
      const data = JSON.parse(await response.text());
      await mkdir(cacheDir, { recursive: true }); await writeFile(file, JSON.stringify(data));
      return data;
    }
    if (response.status !== 429 && response.status < 500) throw new Error(`HTTP ${response.status}`);
    nextAt = Math.max(nextAt, Date.now() + Math.max((Number(response.headers.get('retry-after')) || 0) * 1000, 3000 * 2 ** Math.min(attempt, 4)));
  }
  throw new Error('gave up');
}

interface Area { name: string; geometry: [number, number][][][]; bounds: { minlat: number; minlon: number; maxlat: number; maxlon: number } }
const raw = JSON.parse(await readFile(path.join(directory, 'boundaries.json'), 'utf8')) as Area[] | { features?: Area[]; boundaries?: Area[] };
const areas = Array.isArray(raw) ? raw : raw.features ?? raw.boundaries ?? [];
const only = process.argv.includes('--only') ? process.argv[process.argv.indexOf('--only') + 1] : undefined;

const out: Record<string, Array<{ title: string; imageUrl: string; imageAttribution: string; sourceUrl: string }>> = {};
try { Object.assign(out, JSON.parse(await readFile(path.join(directory, 'area-photos.json'), 'utf8')).areas); } catch { /* first run */ }

for (const area of areas) {
  if (only && area.name !== only) continue;
  if (out[area.name] && !process.argv.includes('--refresh')) continue;
  const [lat, lon] = centroidOf(area.geometry);
  const b = area.bounds;
  const radius = Math.round(Math.min(10000, Math.max(300, 1000 * distanceKm([b.minlat, b.minlon], [b.maxlat, b.maxlon]) / 2)));
  const api = (params: Record<string, string>) => { const u = new URL('https://commons.wikimedia.org/w/api.php'); u.search = new URLSearchParams({ format: 'json', origin: '*', ...params }).toString(); return u; };
  try {
    // 1. Every file geotagged near the centre (with its own coordinates), kept if it lies inside the area.
    const near = await getJson(api({ action: 'query', list: 'geosearch', gscoord: `${lat}|${lon}`, gsradius: String(radius), gsnamespace: '6', gslimit: '200' }));
    const inside = ((near.query?.geosearch ?? []) as Array<{ pageid: number; lat: number; lon: number }>).filter(g => pointInPolygons([g.lat, g.lon], area.geometry));
    const spot = new Map(inside.map(g => [g.pageid, g]));
    // 2. Licence, size and a thumbnail for those, 40 at a time.
    const files: AreaPhotoFile[] = [];
    for (let i = 0; i < inside.length && i < 120; i += 40) {
      const data = await getJson(api({ action: 'query', prop: 'imageinfo', iiprop: 'url|size|mime|extmetadata', iiurlwidth: '480', pageids: inside.slice(i, i + 40).map(g => g.pageid).join('|') }));
      for (const page of Object.values<any>(data.query?.pages ?? {})) {
        const info = page.imageinfo?.[0]; const at = spot.get(page.pageid);
        if (!info || !at) continue;
        const meta = info.extmetadata ?? {};
        files.push({ title: page.title, url: info.url, thumbUrl: info.thumburl, width: info.width, height: info.height, mime: info.mime, license: meta.LicenseShortName?.value, artist: meta.Artist?.value, lat: at.lat, lon: at.lon });
      }
    }
    out[area.name] = rankAreaPhotos(files, area.geometry, 8).map(f => ({
      title: f.title.replace(/^File:/, '').replace(/\.jpe?g$/i, '').replace(/_/g, ' '),
      imageUrl: f.thumbUrl!, imageAttribution: commonsAttribution(f), sourceUrl: `https://commons.wikimedia.org/wiki/${encodeURIComponent(f.title.replace(/ /g, '_'))}`,
    }));
    console.log(`${area.name}: ${files.length} nearby, ${out[area.name].length} kept`);
  } catch (error) { console.log(`${area.name}: failed (${(error as Error).message}); retry next run`); }
}
await writeFile(path.join(directory, 'area-photos.json'), `${JSON.stringify({ version: 1, generatedAt: new Date().toISOString(), areas: out }, null, 1)}\n`);
console.log(`${cityId}: ${Object.values(out).filter(photos => photos.length).length}/${areas.length} areas have photos`);
