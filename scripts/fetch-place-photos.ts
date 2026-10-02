/**
 * One lead photograph per landmark that has a Wikipedia article, for the answer card's place strip.
 *
 *   NODE_USE_ENV_PROXY=1 npx tsx scripts/fetch-place-photos.ts --city amsterdam [--refresh]
 *
 * Reads <city>/landmarks.json, parks.json and squares.json (the `wikipedia: "nl:Title"` field), asks the article's page image
 * (pageimages, batches of 50), then Commons for its licence and author (batches of 40). Only
 * photographs (JPEG) with a known licence ship; output is public/data/extracts/<city>/place-photos.json,
 * keyed by landmark name. Responses are cached under staging/place-photos/cache, so reruns are free.
 */
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { commonsAttribution, type CommonsFile } from '../src/mapRecall/neighborhoodGaps';

const cityId = process.argv.includes('--city') ? process.argv[process.argv.indexOf('--city') + 1] : 'amsterdam';
const directory = path.resolve(`public/data/extracts/${cityId}`);
const cacheDir = path.join(directory, 'staging/place-photos/cache');
const headers: Record<string, string> = { 'User-Agent': 'MapQuestExtractBuilder/1.0 (https://github.com/blackmad/map-recall2)' };
if (process.env.WIKIMEDIA_TOKEN) headers.Authorization = `Bearer ${process.env.WIKIMEDIA_TOKEN}`;
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
let nextAt = 0;

const api = (host: string, params: Record<string, string>) => { const u = new URL(`https://${host}/w/api.php`); u.search = new URLSearchParams({ format: 'json', origin: '*', ...params }).toString(); return u; };

async function getJson(url: URL): Promise<any> {
  const file = path.join(cacheDir, `${createHash('sha1').update(url.toString()).digest('hex')}.json`);
  if (!process.argv.includes('--refresh')) { try { return JSON.parse(await readFile(file, 'utf8')); } catch { /* not cached */ } }
  for (let attempt = 0; attempt < 8; attempt++) {
    const start = Math.max(Date.now(), nextAt); nextAt = start + 500; await wait(start - Date.now());
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

interface Landmark { name: string; wikipedia?: string }
const readPlaces = async (file: string): Promise<Landmark[]> => {
  try { const data = JSON.parse(await readFile(path.join(directory, file), 'utf8')) as Landmark[] | { features: Landmark[] }; return Array.isArray(data) ? data : data.features; } catch { return []; }
};
// Landmarks, parks and squares: everything an area card can call a notable place.
const items = [...await readPlaces('landmarks.json'), ...await readPlaces('parks.json'), ...await readPlaces('squares.json')]
  .filter((l, index, all) => l.wikipedia && /^(nl|en):/.test(l.wikipedia) && all.findIndex(o => o.name === l.name) === index);

// 1. article → lead image file name
const fileOf = new Map<string, string>(); // landmark name -> "File:…"
for (const lang of ['nl', 'en'] as const) {
  const mine = items.filter(l => l.wikipedia!.startsWith(`${lang}:`));
  for (let i = 0; i < mine.length; i += 50) {
    const batch = mine.slice(i, i + 50);
    const titles = batch.map(l => l.wikipedia!.slice(3));
    const data = await getJson(api(`${lang}.wikipedia.org`, { action: 'query', prop: 'pageimages', piprop: 'name', redirects: '1', titles: titles.join('|') }));
    const q = data.query ?? {};
    // Map requested title -> normalized -> redirected -> page
    const alias = new Map<string, string>();
    for (const n of q.normalized ?? []) alias.set(n.from, n.to);
    for (const r of q.redirects ?? []) alias.set(r.from, r.to);
    const resolve = (t: string) => { let cur = t; for (let k = 0; k < 4 && alias.has(cur); k++) cur = alias.get(cur)!; return cur; };
    const pages = new Map<string, string>();
    for (const page of Object.values<any>(q.pages ?? {})) if (page.pageimage) pages.set(page.title, `File:${page.pageimage}`);
    for (const l of batch) { const f = pages.get(resolve(l.wikipedia!.slice(3))); if (f && !fileOf.has(l.name)) fileOf.set(l.name, f); }
  }
}

// 2. file → licence, author, 480px thumbnail
const files = [...new Set(fileOf.values())];
const info = new Map<string, CommonsFile>();
for (let i = 0; i < files.length; i += 40) {
  const data = await getJson(api('commons.wikimedia.org', { action: 'query', prop: 'imageinfo', iiprop: 'url|size|mime|extmetadata', iiurlwidth: '480', titles: files.slice(i, i + 40).join('|') }));
  const alias = new Map<string, string>(); for (const n of data.query?.normalized ?? []) alias.set(n.to, n.from);
  for (const page of Object.values<any>(data.query?.pages ?? {})) {
    const ii = page.imageinfo?.[0]; if (!ii) continue;
    const meta = ii.extmetadata ?? {};
    info.set(alias.get(page.title) ?? page.title, { title: page.title, url: ii.url, thumbUrl: ii.thumburl, width: ii.width, height: ii.height, mime: ii.mime, license: meta.LicenseShortName?.value, artist: meta.Artist?.value });
  }
}

const places: Record<string, { imageUrl: string; imageAttribution: string; sourceUrl: string }> = {};
for (const [name, file] of fileOf) {
  const f = info.get(file) ?? info.get(file.replace(/_/g, ' '));
  if (!f || f.mime !== 'image/jpeg' || !f.license || !f.thumbUrl || f.width < f.height * 0.9) continue; // photographs, landscape-ish, licensed
  places[name] = { imageUrl: f.thumbUrl, imageAttribution: commonsAttribution(f), sourceUrl: `https://commons.wikimedia.org/wiki/${encodeURIComponent(f.title.replace(/ /g, '_'))}` };
}
await writeFile(path.join(directory, 'place-photos.json'), `${JSON.stringify({ version: 1, generatedAt: new Date().toISOString(), places }, null, 1)}\n`);
console.log(`${cityId}: ${Object.keys(places).length} place photos from ${items.length} landmarks with articles (${fileOf.size} had a lead image)`);
