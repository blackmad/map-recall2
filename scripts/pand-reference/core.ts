/** Shared helpers for the per-pand reference feed: disk-cached, rate-limited HTTP and footprint geometry. */
import fs from 'node:fs/promises';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import { lngLatToRd, rdToLngLat } from '../../src/canalRecall/facade/rdNew.ts';

export type Rd = { x: number; y: number };
/** Panorama/API cache; `PAND_REFERENCE_CACHE` points every worktree at one shared cache (the main checkout's is ~4 GB). */
export const CACHE_DIR = path.resolve(process.env.PAND_REFERENCE_CACHE ?? '.cache/pand-reference');
export const UA = 'MapRecall-PandReference/1.0 (+https://github.com/blackmad/map-recall2; CC BY 4.0 Gemeente Amsterdam panoramas)';
const EXTRACT = path.resolve('public/data/extracts/amsterdam');

// At most 3 requests in flight, process-wide.
let active = 0; const waiting: Array<() => void> = [];
async function slot<T>(fn: () => Promise<T>): Promise<T> {
  while (active >= 3) await new Promise<void>(r => waiting.push(r));
  active++;
  try { return await fn(); } finally { active--; waiting.shift()?.(); }
}
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
/**
 * Opt-in politeness for city-scale runs (scripts/house-crops): `minGapMs` spaces the START of every network request
 * process-wide (cache hits never reach `get`), `maxAttempts` raises the retry count, and a 429 or 5xx backs off
 * exponentially (honouring Retry-After). Defaults keep the old behaviour: no spacing, 4 attempts, 400 ms * 2^i.
 */
/** `offline`: a cache miss throws instead of fetching (house:crops --offline: judge-pick re-rectification must cost no downloads) */
export const http = { offline: false, minGapMs: 0, maxAttempts: 4, userAgent: UA, requests: 0, bytes: 0, retries: 0, status429: 0, status5xx: 0, failures: 0 };
let nextStart = 0;
async function pace() {
  if (!http.minGapMs) return;
  const at = Math.max(Date.now(), nextStart); nextStart = at + http.minGapMs;
  if (at > Date.now()) await sleep(at - Date.now());
}
async function get(url: string): Promise<Buffer> {
  if (http.offline) throw new Error(`offline: cache miss ${url}`);
  let err: unknown;
  for (let i = 0; i < http.maxAttempts; i++) {
    let wait = 400 * 2 ** i;
    try {
      const bytes = await slot(async () => {
        await pace();
        http.requests++;
        const res = await fetch(url, { headers: { 'User-Agent': http.userAgent } });
        if (!res.ok) {
          if (res.status === 429) http.status429++; else if (res.status >= 500) http.status5xx++;
          const ra = Number(res.headers.get('retry-after')); if (ra > 0) wait = Math.max(wait, Math.min(ra, 120) * 1000);
          const e: any = new Error(`HTTP ${res.status} ${url}`); e.status = res.status; throw e;
        }
        const b = Buffer.from(await res.arrayBuffer()); http.bytes += b.length; return b;
      });
      return bytes;
    } catch (e: any) { err = e; if (e.status && e.status < 500 && e.status !== 429) break; }
    if (i + 1 < http.maxAttempts) { http.retries++; await sleep(wait); }
  }
  http.failures++;
  throw err;
}
const cachePath = (url: string, ext: string) => path.join(CACHE_DIR, crypto.createHash('sha1').update(url).digest('hex') + ext);
/** House:crops disk rule: when `touched` is a Set, every cached panorama .jpg read or written is recorded so the run can purge its own source panoramas afterwards. */
export const panoTracker: { touched: Set<string> | null } = { touched: null };
export async function purgeFiles(files: Iterable<string>): Promise<{ files: number; bytes: number }> {
  let n = 0, bytes = 0;
  for (const f of files) { try { bytes += (await fs.stat(f)).size; await fs.rm(f); n++; } catch { /* already gone */ } }
  return { files: n, bytes };
}
export async function cachedBytes(url: string, ext: string): Promise<Buffer> {
  const file = cachePath(url, ext);
  if (ext === '.jpg') panoTracker.touched?.add(file);
  try { return await fs.readFile(file); } catch { /* miss */ }
  const bytes = await get(url);
  await fs.mkdir(CACHE_DIR, { recursive: true });
  await fs.writeFile(file, bytes);
  return bytes;
}
export async function cachedJson<T = any>(url: string): Promise<T> { return JSON.parse((await cachedBytes(url, '.json')).toString('utf8')); }

// ---- footprints -----------------------------------------------------------------
export type Footprint = { id: string; ring: Rd[]; height: number };
const tileOf = (lng: number, lat: number) => {
  const n = 2 ** 14, x = Math.floor((lng + 180) / 360 * n);
  const s = Math.sin(lat * Math.PI / 180);
  const y = Math.floor((0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * n);
  return { x, y };
};
const tileCache = new Map<string, Footprint[]>();
export async function loadTile(x: number, y: number): Promise<Footprint[]> {
  const key = `${x}/${y}`;
  if (tileCache.has(key)) return tileCache.get(key)!;
  let out: Footprint[] = [];
  try {
    const bytes = await fs.readFile(path.join(EXTRACT, 'building-tiles/14', String(x), `${y}.geojson.gz`));
    const json = JSON.parse((bytes[0] === 0x1f ? zlib.gunzipSync(bytes) : bytes).toString('utf8'));
    out = json.features.map((f: any) => {
      const g = f.geometry, ring = g.type === 'Polygon' ? g.coordinates[0] : g.coordinates[0][0];
      return { id: String(f.properties.id), ring: ring.map((p: number[]) => lngLatToRd([p[0], p[1]])), height: Number(f.properties.height) || 0 };
    });
  } catch { /* tile outside extract */ }
  tileCache.set(key, out);
  return out;
}
export const normId = (id: string) => id.startsWith('NL.IMBAG.Pand.') ? id : `NL.IMBAG.Pand.${id}`;
/** Locate BAG pand ids by scanning the tile set text for the id (cheap enough for a handful of ids). */
export async function findPands(ids: string[]): Promise<Map<string, Footprint>> {
  // OSM building(-part) ids (w123, r123) are tile features too: kit parts drawn as OSM-only outlines (GitHub #37).
  const want = new Set(ids.map(id => /^[wr]\d+$/.test(id) ? id : normId(id)));
  const found = new Map<string, Footprint>();
  const root = path.join(EXTRACT, 'building-tiles/14');
  for (const xd of await fs.readdir(root)) for (const f of await fs.readdir(path.join(root, xd))) {
    const bytes = await fs.readFile(path.join(root, xd, f));
    const text = (bytes[0] === 0x1f ? zlib.gunzipSync(bytes) : bytes).toString('utf8');
    if (![...want].some(id => text.includes(id))) continue;
    for (const fp of await loadTile(Number(xd), Number(f.split('.')[0]))) if (want.has(fp.id)) found.set(fp.id, fp);
    if (found.size === want.size) return found;
  }
  return found;
}
export async function neighbourhood(centre: Rd): Promise<Footprint[]> {
  const [lng, lat] = rdToLngLat(centre), t = tileOf(lng, lat), all: Footprint[] = [];
  for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) all.push(...await loadTile(t.x + dx, t.y + dy));
  return all;
}
export function pointInRing(p: Rd, ring: Rd[]) {
  let yes = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++)
    if ((ring[i].y > p.y) !== (ring[j].y > p.y) && p.x < (ring[j].x - ring[i].x) * (p.y - ring[i].y) / (ring[j].y - ring[i].y) + ring[i].x) yes = !yes;
  return yes;
}

// ---- roads ------------------------------------------------------------------------
export type Seg = { a: Rd; b: Rd };
let roads: Seg[] | null = null;
export async function loadRoads(): Promise<Seg[]> {
  if (roads) return roads;
  roads = [];
  for (const file of ['streets.json', 'streets-routing.json']) {
    for (const s of JSON.parse(await fs.readFile(path.join(EXTRACT, file), 'utf8'))) {
      if (s.highway && /motorway|steps|service/.test(s.highway)) continue;
      for (const p of (s.paths ?? [s.path]) as number[][][]) {
        const pts = p.map(q => lngLatToRd([q[1], q[0]]));
        for (let i = 0; i + 1 < pts.length; i++) roads.push({ a: pts[i], b: pts[i + 1] });
      }
    }
  }
  return roads;
}
export function nearestOnSeg(p: Rd, s: Seg): { d: number; q: Rd } {
  const dx = s.b.x - s.a.x, dy = s.b.y - s.a.y, l2 = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((p.x - s.a.x) * dx + (p.y - s.a.y) * dy) / l2));
  const q = { x: s.a.x + dx * t, y: s.a.y + dy * t };
  return { d: Math.hypot(p.x - q.x, p.y - q.y), q };
}
export { lngLatToRd, rdToLngLat };
