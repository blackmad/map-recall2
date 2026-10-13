/** Shared helpers for the per-pand reference feed: disk-cached, rate-limited HTTP and footprint geometry. */
import fs from 'node:fs/promises';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import { lngLatToRd, rdToLngLat } from '../../src/canalRecall/facade/rdNew.ts';

export type Rd = { x: number; y: number };
export const CACHE_DIR = path.resolve('.cache/pand-reference');
export const UA = 'MapRecall-PandReference/1.0 (+CC BY 4.0 Gemeente Amsterdam panoramas)';
const EXTRACT = path.resolve('public/data/extracts/amsterdam');

// At most 3 requests in flight, process-wide.
let active = 0; const waiting: Array<() => void> = [];
async function slot<T>(fn: () => Promise<T>): Promise<T> {
  while (active >= 3) await new Promise<void>(r => waiting.push(r));
  active++;
  try { return await fn(); } finally { active--; waiting.shift()?.(); }
}
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
async function get(url: string): Promise<Buffer> {
  let err: unknown;
  for (let i = 0; i < 4; i++) {
    try {
      const bytes = await slot(async () => {
        const res = await fetch(url, { headers: { 'User-Agent': UA } });
        if (!res.ok) { const e: any = new Error(`HTTP ${res.status} ${url}`); e.status = res.status; throw e; }
        return Buffer.from(await res.arrayBuffer());
      });
      return bytes;
    } catch (e: any) { err = e; if (e.status && e.status < 500 && e.status !== 429) break; }
    await sleep(400 * 2 ** i);
  }
  throw err;
}
const cachePath = (url: string, ext: string) => path.join(CACHE_DIR, crypto.createHash('sha1').update(url).digest('hex') + ext);
export async function cachedBytes(url: string, ext: string): Promise<Buffer> {
  const file = cachePath(url, ext);
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
  const want = new Set(ids.map(normId));
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
