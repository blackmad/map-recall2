// Fetch BGT `scheiding_lijn` and `scheiding_vlak` (walls, fences, quay walls, sheet piling) per own-ground 1 km cell
// from the PDOK OGC API, for the BGT plaza build (lane bgt-plazas-20261110): a plaza is cut where a fence or wall crosses
// it, so the paving behind a schoolyard fence or a garden wall never joins the paving in front of it.
//
//   npx tsx scripts/routing/fetch-bgt-barriers.ts                 # every game cell
//   npx tsx scripts/routing/fetch-bgt-barriers.ts --cells -3_-1   # some cells
//
// Source: BGT (Kadaster, CC0 1.0) via https://api.pdok.nl/lv/bgt/ogc/v1/collections/scheiding_lijn and scheiding_vlak.
// Cache: artifacts/own-ground/raw/bgt-roads/scheiding/<cell>.json.gz (not committed; archived to
// map-recall2-source-data/datasets/bgt-plazas-20261110/).
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { gunzipSync, gzipSync } from 'node:zlib';
import { BGT_ROADS_CACHE, paddedBounds } from '../own-ground/fetch-bgt-roads.ts';

const API_BASE = 'https://api.pdok.nl/lv/bgt/ogc/v1/collections';

/** One scheiding as cached: lines (scheiding_lijn) or polygon outer rings (scheiding_vlak), [lng, lat] at 1e-7°. */
export interface RawScheiding {
  id: string;
  /** muur, hek, kademuur, damwand, geluidsscherm, walbescherming, ... */
  type: string;
  h: number;
  lines: [number, number][][];
}

export interface RawScheidingCell { version: 1; key: string; bbox: [number, number, number, number]; fetched: string; features: RawScheiding[] }

export const scheidingCachePath = (key: string): string => `${BGT_ROADS_CACHE}/scheiding/${key}.json.gz`;

export function readScheidingCell(key: string): RawScheidingCell | null {
  const file = scheidingCachePath(key);
  if (!existsSync(file)) return null;
  return JSON.parse(gunzipSync(readFileSync(file)).toString()) as RawScheidingCell;
}

async function getJson(url: string): Promise<any> {
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': 'map-recall-own-ground/1 (plaza build script)' } });
      if (res.ok) return await res.json();
      if (attempt > 6 || (res.status < 500 && res.status !== 429)) throw new Error(`${res.status} ${url}`);
    } catch (e) { if (attempt > 6) throw e; }
    await new Promise(r => setTimeout(r, 2000 * (attempt + 1)));
  }
}

const r7 = (v: number) => Math.round(v * 1e7) / 1e7;

function linesOf(geometry: any): [number, number][][] {
  const ring = (r: number[][]) => r.map(([x, y]) => [r7(x), r7(y)] as [number, number]);
  switch (geometry?.type) {
    case 'LineString': return [ring(geometry.coordinates)];
    case 'MultiLineString': return geometry.coordinates.map(ring);
    case 'Polygon': return geometry.coordinates.map(ring);
    case 'MultiPolygon': return geometry.coordinates.flatMap((p: number[][][]) => p.map(ring));
    default: return [];
  }
}

export async function fetchScheidingCell(key: string, bbox: [number, number, number, number], now: string): Promise<RawScheidingCell> {
  const features: RawScheiding[] = [];
  const seen = new Set<string>();
  for (const collection of ['scheiding_lijn', 'scheiding_vlak']) {
    let url: string | null = `${API_BASE}/${collection}/items?f=json&limit=1000&datetime=${now}&bbox=${bbox.map(v => v.toFixed(6)).join(',')}`;
    while (url) {
      const j = await getJson(url);
      for (const f of j.features as any[]) {
        const p = f.properties ?? {};
        const id: string = p.lokaal_id ?? String(f.id);
        if (seen.has(id) || p.eind_registratie) continue;
        seen.add(id);
        const lines = linesOf(f.geometry);
        if (lines.length) features.push({ id, type: p.type ?? '', h: Number(p.relatieve_hoogteligging ?? 0), lines });
      }
      url = (j.links as any[] | undefined)?.find(l => l.rel === 'next')?.href ?? null;
    }
  }
  const cell: RawScheidingCell = { version: 1, key, bbox, fetched: now, features };
  const file = scheidingCachePath(key);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, gzipSync(JSON.stringify(cell), { level: 6 }));
  return cell;
}

async function main(): Promise<void> {
  const arg = (n: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : null; };
  const manifest = JSON.parse(readFileSync('public/data/extracts/amsterdam/own-ground-osm-v1/cells.json', 'utf8')) as { cells: string[] };
  const keys = arg('--cells')?.split(',').map(s => s.trim()).filter(Boolean) ?? manifest.cells;
  const now = new Date().toISOString().slice(0, 10) + 'T00:00:00Z';
  const queue = keys.filter(k => !existsSync(scheidingCachePath(k)));
  console.log(`${keys.length} cells, ${queue.length} to fetch`);
  let done = 0, features = 0, failed = 0;
  await Promise.all(Array.from({ length: 6 }, async () => {
    for (let k = queue.shift(); k; k = queue.shift()) {
      try { features += (await fetchScheidingCell(k, paddedBounds(k), now)).features.length; } catch (e) { failed++; console.error(`${k}: ${(e as Error).message}`); }
      if (++done % 10 === 0 || !queue.length) console.log(`${done} cells, ${features} features`);
    }
  }));
  console.log(`done: ${done} cells (${failed} failed), ${features} features`);
  if (failed) process.exit(1);
}

if (process.argv[1]?.endsWith('fetch-bgt-barriers.ts')) main().catch(e => { console.error(e); process.exit(1); });
