// Fetch BGT `wegdeel` polygons (the municipality's surveyed road partition) per
// own-ground 1 km cell from the PDOK OGC API and cache them raw, with the
// attributes the roads-v1 build needs (roads data lane, 2026-10-16):
//
//   npx tsx scripts/own-ground/fetch-bgt-roads.ts                      # every game cell
//   npx tsx scripts/own-ground/fetch-bgt-roads.ts --cells -3_-1,-2_0   # some cells
//   npx tsx scripts/own-ground/fetch-bgt-roads.ts --offline            # report the cache only
//   npx tsx scripts/own-ground/fetch-bgt-roads.ts --concurrency 4      # default 6 (the API's polite ceiling)
//   npx tsx scripts/own-ground/fetch-bgt-roads.ts --collection ondersteunendwegdeel   # verges, islands (R1, 2026-10-23)
//   npx tsx scripts/own-ground/fetch-bgt-roads.ts --collection onbegroeidterreindeel  # paved squares, verhard only
//
// Source: BGT (Basisregistratie Grootschalige Topografie), Kadaster, via PDOK
//   https://api.pdok.nl/lv/bgt/ogc/v1/collections/wegdeel  (licence CC0 1.0)
// Cache: artifacts/own-ground/raw/bgt-roads/<cell>.json.gz (not committed; archived to
// map-recall2-source-data/datasets/bgt-roads-20261016/). One file per cell, the cell's
// lng/lat bounds padded 30 m so kerb runs and cover tests work up to the cell edge.
// The API pages with `next` cursors (no offset), so parallelism is across cells, not pages.
//
// fetch-bgt.ts (2026-10-13) kept only {functie, h, rings} per quarter tile; this cache
// keeps `lokaal_id` (dedupe across cell pads), `fysiek_voorkomen` (the mesh), status and
// registration end, and the bronhouder (kerb matching across its borders), for every
// functie, so the build decides what to keep.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { gunzipSync, gzipSync } from 'node:zlib';
import { cellBounds, elevationIndex } from './game-cells.ts';

const API_BASE = 'https://api.pdok.nl/lv/bgt/ogc/v1/collections';
export const BGT_ROADS_CACHE = 'artifacts/own-ground/raw/bgt-roads';
/**
 * The collections a cell can be fetched from (roads lane R1, 2026-10-23): `wegdeel` is the roads-v1 base and keeps the
 * cache root (the archive's 2026-10-16 pull); the verges, islands and paved squares go to a subdirectory each.
 * onbegroeidterreindeel keeps the verhard classes only (open and closed paving, half paved): the `erf` yards and the
 * unpaved ground are not roads, and the 6,500-feature `erf` cells would be most of the bytes.
 */
export const BGT_ROAD_COLLECTIONS = ['wegdeel', 'ondersteunendwegdeel', 'onbegroeidterreindeel'] as const;
export type BgtRoadCollection = typeof BGT_ROAD_COLLECTIONS[number];
const KEEP_FYSIEK: Partial<Record<BgtRoadCollection, RegExp>> = { onbegroeidterreindeel: /^(gesloten verharding|open verharding|half verhard)$/ };
export const cachePathOf = (key: string, collection: BgtRoadCollection = 'wegdeel'): string =>
  collection === 'wegdeel' ? `${BGT_ROADS_CACHE}/${key}.json.gz` : `${BGT_ROADS_CACHE}/${collection}/${key}.json.gz`;
/** ~30 m in degrees at Amsterdam (lng, lat). */
export const PAD_DEG: [number, number] = [0.00044, 0.00027];

/** One wegdeel as cached: polygons as rings of [lng, lat] rounded to 1e-7 degrees (~1 cm). */
export interface RawWegdeel {
  /** BGT lokaal_id (bronhouder-prefixed, unique). */
  id: string;
  functie: string;
  /** fysiek_voorkomen: gesloten verharding, open verharding, half verhard, onverhard, transitie, ... */
  fv: string | null;
  /** plus_fysiek_voorkomen (asfalt, betonstraatstenen, tegels, ...), when the bronhouder filled it. */
  pfv: string | null;
  /** relatieve_hoogteligging: 0 ground, ≥ 1 bridge / viaduct deck, < 0 tunnel. */
  h: number;
  status: string | null;
  /** eind_registratie, null while current. */
  eind: string | null;
  /** bronhouder code (G0363 = gemeente Amsterdam). */
  bh: string | null;
  /** Polygons (MultiPolygon list), each a list of rings, outer first. */
  g: [number, number][][][];
}

export interface RawRoadsCell { version: 1; key: string; bbox: [number, number, number, number]; fetched: string; features: RawWegdeel[] }

export function readRawRoadsCell(key: string, collection: BgtRoadCollection = 'wegdeel'): RawRoadsCell | null {
  const file = cachePathOf(key, collection);
  if (!existsSync(file)) return null;
  return JSON.parse(gunzipSync(readFileSync(file)).toString()) as RawRoadsCell;
}

async function getJson(url: string): Promise<any> {
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': 'map-recall-own-ground/1 (roads build script)' } });
      if (res.ok) return await res.json();
      if (attempt > 6 || (res.status < 500 && res.status !== 429)) throw new Error(`${res.status} ${url}`);
    } catch (e) { if (attempt > 6) throw e; }
    await new Promise(r => setTimeout(r, 2000 * (attempt + 1)));
  }
}

const r7 = (v: number) => Math.round(v * 1e7) / 1e7;

/** Fetch one cell (all current features of the collection, every functie) and cache it. */
export async function fetchRoadsCell(key: string, bbox: [number, number, number, number], now: string, collection: BgtRoadCollection = 'wegdeel'): Promise<RawRoadsCell> {
  const features: RawWegdeel[] = [];
  const seen = new Set<string>();
  const keep = KEEP_FYSIEK[collection];
  let url: string | null = `${API_BASE}/${collection}/items?f=json&limit=1000&datetime=${now}&bbox=${bbox.map(v => v.toFixed(6)).join(',')}`;
  while (url) {
    const j = await getJson(url);
    for (const f of j.features as any[]) {
      const p = f.properties ?? {};
      const id: string = p.lokaal_id ?? String(f.id);
      if (seen.has(id)) continue;
      seen.add(id);
      const polys: number[][][][] = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.type === 'MultiPolygon' ? f.geometry.coordinates : [];
      if (!polys.length) continue;
      if (keep && !keep.test(p.fysiek_voorkomen ?? '')) continue;
      features.push({
        id, functie: p.functie ?? '', fv: p.fysiek_voorkomen ?? null, pfv: p.plus_fysiek_voorkomen ?? null,
        h: Number(p.relatieve_hoogteligging ?? 0), status: p.status ?? null, eind: p.eind_registratie ?? null, bh: p.bronhouder ?? null,
        g: polys.map(poly => poly.map(ring => ring.map(([x, y]: number[]) => [r7(x), r7(y)] as [number, number]))),
      });
    }
    url = (j.links as any[] | undefined)?.find(l => l.rel === 'next')?.href ?? null;
  }
  const cell: RawRoadsCell = { version: 1, key, bbox, fetched: now, features };
  const file = cachePathOf(key, collection);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, gzipSync(JSON.stringify(cell), { level: 6 }));
  return cell;
}

export function paddedBounds(key: string): [number, number, number, number] {
  const [x0, y0, x1, y1] = cellBounds(elevationIndex(), key);
  return [x0 - PAD_DEG[0], y0 - PAD_DEG[1], x1 + PAD_DEG[0], y1 + PAD_DEG[1]];
}

async function main(): Promise<void> {
  const arg = (n: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : null; };
  const concurrency = Math.min(6, Math.max(1, Number(arg('--concurrency') ?? 6)));
  const offline = process.argv.includes('--offline');
  const collection = (arg('--collection') ?? 'wegdeel') as BgtRoadCollection;
  if (!BGT_ROAD_COLLECTIONS.includes(collection)) throw new Error(`--collection: ${collection} is not one of ${BGT_ROAD_COLLECTIONS.join(', ')}`);
  const manifest = JSON.parse(readFileSync('public/data/extracts/amsterdam/own-ground-osm-v1/cells.json', 'utf8')) as { cells: string[] };
  const only = arg('--cells')?.split(',').map(s => s.trim()).filter(Boolean);
  const keys = only ?? manifest.cells;
  for (const k of keys) if (!manifest.cells.includes(k)) console.warn(`warning: ${k} is not a game cell`);
  const now = new Date().toISOString().slice(0, 10) + 'T00:00:00Z';
  const todo = keys.filter(k => !existsSync(cachePathOf(k, collection)));
  console.log(`${keys.length} cells, ${keys.length - todo.length} cached, ${todo.length} to fetch${offline ? ' (offline: skipped)' : ''}`);
  if (offline) {
    let features = 0;
    for (const k of keys) features += readRawRoadsCell(k, collection)?.features.length ?? 0;
    console.log(`${features} cached features`);
    return;
  }
  let done = 0, features = 0, failed = 0;
  const t0 = Date.now();
  const queue = [...todo];
  await Promise.all(Array.from({ length: concurrency }, async () => {
    for (let k = queue.shift(); k; k = queue.shift()) {
      try {
        const c = await fetchRoadsCell(k, paddedBounds(k), now, collection);
        features += c.features.length;
      } catch (e) {
        failed++;
        console.error(`${k}: ${(e as Error).message}`);
      }
      done++;
      if (done % 5 === 0 || !queue.length) console.log(`${done}/${todo.length} cells, ${features} features, ${Math.round((Date.now() - t0) / 1000)} s`);
    }
  }));
  console.log(`done: ${done} cells (${failed} failed), ${features} features in ${Math.round((Date.now() - t0) / 1000)} s`);
  if (failed) process.exit(1);
}

if (process.argv[1]?.endsWith('fetch-bgt-roads.ts')) main().catch(e => { console.error(e); process.exit(1); });
