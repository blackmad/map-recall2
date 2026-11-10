// Fetch the BGT terrain collections the open-ground look needs (lane open-ground-look 2026-11-10), per own-ground
// 1 km cell, from the PDOK OGC API, and cache them raw in the fetch-bgt-roads.ts format (RawRoadsCell):
//
//   npx tsx scripts/own-ground/fetch-bgt-open-ground.ts                       # every game cell, both collections
//   npx tsx scripts/own-ground/fetch-bgt-open-ground.ts --cells -3_-1,-2_0    # some cells
//   npx tsx scripts/own-ground/fetch-bgt-open-ground.ts --collection begroeidterreindeel
//   npx tsx scripts/own-ground/fetch-bgt-open-ground.ts --offline             # report the cache only
//
// Source: BGT (Kadaster / gemeente Amsterdam), CC0 1.0, https://api.pdok.nl/lv/bgt/ogc/v1/collections/<collection>.
// Cache: artifacts/own-ground/raw/bgt-open-ground/<collection>/<cell>.json.gz (not committed; archived to
// map-recall2-source-data/datasets/bgt-open-ground-20261110/). Unlike fetch-bgt-roads.ts every fysiek_voorkomen is
// kept: the erf yards and the unpaved ground are exactly what this lane classifies. ondersteunendwegdeel (verges) is
// already in the roads cache (fetch-bgt-roads.ts --collection ondersteunendwegdeel) and drawn by roads-v1.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { gzipSync, gunzipSync } from 'node:zlib';
import { paddedBounds, type RawRoadsCell, type RawWegdeel } from './fetch-bgt-roads.ts';

const API_BASE = 'https://api.pdok.nl/lv/bgt/ogc/v1/collections';
export const BGT_OPEN_GROUND_CACHE = 'artifacts/own-ground/raw/bgt-open-ground';
export const OPEN_GROUND_COLLECTIONS = ['begroeidterreindeel', 'onbegroeidterreindeel'] as const;
export type OpenGroundCollection = typeof OPEN_GROUND_COLLECTIONS[number];
export const openGroundCachePath = (key: string, c: OpenGroundCollection, root = BGT_OPEN_GROUND_CACHE): string => `${root}/${c}/${key}.json.gz`;

export function readOpenGroundRaw(key: string, c: OpenGroundCollection, root = BGT_OPEN_GROUND_CACHE): RawRoadsCell | null {
  const f = openGroundCachePath(key, c, root);
  return existsSync(f) ? JSON.parse(gunzipSync(readFileSync(f)).toString()) as RawRoadsCell : null;
}

async function getJson(url: string): Promise<any> {
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': 'map-recall-own-ground/1 (build script)' } });
      if (res.ok) return await res.json();
      if (attempt > 6 || (res.status < 500 && res.status !== 429)) throw new Error(`${res.status} ${url}`);
    } catch (e) { if (attempt > 6) throw e; }
    await new Promise(r => setTimeout(r, 2000 * (attempt + 1)));
  }
}
const r7 = (v: number) => Math.round(v * 1e7) / 1e7;

async function fetchCell(key: string, c: OpenGroundCollection, now: string): Promise<number> {
  const bbox = paddedBounds(key), features: RawWegdeel[] = [], seen = new Set<string>();
  let url: string | null = `${API_BASE}/${c}/items?f=json&limit=1000&datetime=${now}&bbox=${bbox.map(v => v.toFixed(6)).join(',')}`;
  while (url) {
    const j = await getJson(url);
    for (const f of j.features as any[]) {
      const p = f.properties ?? {};
      const id: string = p.lokaal_id ?? String(f.id);
      if (seen.has(id)) continue;
      seen.add(id);
      const polys: number[][][][] = f.geometry?.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry?.type === 'MultiPolygon' ? f.geometry.coordinates : [];
      if (!polys.length) continue;
      features.push({
        id, functie: p.functie ?? '', fv: p.fysiek_voorkomen ?? null, pfv: p.plus_fysiek_voorkomen ?? null,
        h: Number(p.relatieve_hoogteligging ?? 0), status: p.status ?? null, eind: p.eind_registratie ?? null, bh: p.bronhouder ?? null,
        g: polys.map(poly => poly.map(ring => ring.map(([x, y]: number[]) => [r7(x), r7(y)] as [number, number]))),
      });
    }
    url = (j.links as any[] | undefined)?.find(l => l.rel === 'next')?.href ?? null;
  }
  const cell: RawRoadsCell = { version: 1, key, bbox, fetched: now, features };
  const file = openGroundCachePath(key, c);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, gzipSync(JSON.stringify(cell), { level: 6 }));
  return features.length;
}

async function main(): Promise<void> {
  const arg = (n: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : null; };
  const concurrency = Math.min(6, Math.max(1, Number(arg('--concurrency') ?? 6)));
  const collections = arg('--collection') ? [arg('--collection') as OpenGroundCollection] : [...OPEN_GROUND_COLLECTIONS];
  const manifest = JSON.parse(readFileSync('public/data/extracts/amsterdam/own-ground-osm-v1/cells.json', 'utf8')) as { cells: string[] };
  const keys = arg('--cells')?.split(',').map(s => s.trim()).filter(Boolean) ?? manifest.cells;
  const now = '2026-11-10T00:00:00Z';
  const jobs = collections.flatMap(c => keys.filter(k => !existsSync(openGroundCachePath(k, c))).map(k => ({ k, c })));
  console.log(`${keys.length} cells x ${collections.length} collections, ${jobs.length} to fetch`);
  if (process.argv.includes('--offline')) return;
  let done = 0, features = 0, failed = 0;
  const t0 = Date.now();
  await Promise.all(Array.from({ length: concurrency }, async () => {
    for (let j = jobs.shift(); j; j = jobs.shift()) {
      try { const n = await fetchCell(j.k, j.c, now); features += n; } catch (e) { failed++; console.error(`${j.c} ${j.k}: ${(e as Error).message}`); }
      done++;
      if (done % 10 === 0 || !jobs.length) console.log(`${done} done, ${features} features, ${failed} failed, ${Math.round((Date.now() - t0) / 1000)} s`);
    }
  }));
  console.log(`done: ${done} (${failed} failed), ${features} features in ${Math.round((Date.now() - t0) / 1000)} s`);
  if (failed) process.exit(1);
}

if (process.argv[1]?.endsWith('fetch-bgt-open-ground.ts')) main().catch(e => { console.error(e); process.exit(1); });
