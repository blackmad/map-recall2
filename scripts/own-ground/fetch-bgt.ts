// Fetch BGT wegdeel polygons (road surfaces) for every cell of the own-ground
// OSM manifest from the PDOK OGC API and cache them, trimmed, per 500 m tile:
//
//   npx tsx scripts/own-ground/fetch-bgt.ts [--concurrency 6] [--limit-cells N]
//
// Source: BGT (Basisregistratie Grootschalige Topografie), Kadaster, via PDOK
//   https://api.pdok.nl/lv/bgt/ogc/v1/collections/wegdeel  (licence CC0 1.0)
// Cache: artifacts/own-ground/raw/bgt/<cx>_<cy>_<q>.json.gz (not committed).
// build-bgt-widths.ts reads the cache. The API pages with `next` links (no
// offset), so parallelism is across tiles, not pages.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { cellBounds, elevationIndex } from './game-cells.ts';

const API = 'https://api.pdok.nl/lv/bgt/ogc/v1/collections/wegdeel/items';
export const BGT_CACHE = 'artifacts/own-ground/raw/bgt';
const PAD_DEG = [0.0007, 0.0004]; // ~50 m
/** Functies the width reader uses; the rest (parkeervlak is kept to tell lay-bys from carriageway) is dropped. */
export const KEEP_FUNCTIE = /^(rijbaan|woonerf|voetpad|fietspad|voetgangersgebied|parkeervlak|inrit|overweg|OV-baan)/;

export interface BgtFeature { f: string; h: number; r: [number, number][][] }

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

async function fetchTile(file: string, bbox: [number, number, number, number]): Promise<number> {
  const out: BgtFeature[] = [];
  let url: string | null = `${API}?f=json&limit=1000&bbox=${bbox.map(v => v.toFixed(6)).join(',')}`;
  while (url) {
    const j = await getJson(url);
    for (const f of j.features as any[]) {
      const p = f.properties;
      if (p.status && p.status !== 'bestaand') continue;
      if (!KEEP_FUNCTIE.test(p.functie ?? '')) continue;
      const polys: number[][][][] = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
      for (const poly of polys) out.push({ f: p.functie, h: p.relatieve_hoogteligging ?? 0, r: poly.map(ring => ring.map(([x, y]: number[]) => [r7(x), r7(y)] as [number, number])) });
    }
    url = (j.links as any[]).find(l => l.rel === 'next')?.href ?? null;
  }
  writeFileSync(file, gzipSync(JSON.stringify(out)));
  return out.length;
}

async function main(): Promise<void> {
  mkdirSync(BGT_CACHE, { recursive: true });
  const arg = (n: string, d: number) => { const i = process.argv.indexOf(n); return i > 0 ? Number(process.argv[i + 1]) : d; };
  const concurrency = arg('--concurrency', 6), limit = arg('--limit-cells', 1e9);
  const index = elevationIndex();
  const manifest = JSON.parse(readFileSync('public/data/extracts/amsterdam/own-ground-osm-v1/cells.json', 'utf8')) as { cells: string[] };
  const jobs: { file: string; bbox: [number, number, number, number] }[] = [];
  for (const key of manifest.cells.slice(0, limit)) {
    const [x0, y0, x1, y1] = cellBounds(index, key), mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
    [[x0, y0, mx, my], [mx, y0, x1, my], [x0, my, mx, y1], [mx, my, x1, y1]].forEach((b, q) => {
      jobs.push({ file: `${BGT_CACHE}/${key}_${q}.json.gz`, bbox: [b[0] - PAD_DEG[0], b[1] - PAD_DEG[1], b[2] + PAD_DEG[0], b[3] + PAD_DEG[1]] });
    });
  }
  const todo = jobs.filter(j => !existsSync(j.file));
  console.log(`${jobs.length} tiles, ${todo.length} to fetch`);
  let done = 0, features = 0;
  const t0 = Date.now();
  await Promise.all(Array.from({ length: concurrency }, async () => {
    for (let j = todo.shift(); j; j = todo.shift()) {
      features += await fetchTile(j.file, j.bbox);
      if (++done % 10 === 0) console.log(`${done} tiles, ${features} features, ${Math.round((Date.now() - t0) / 1000)} s, ${todo.length} left`);
    }
  }));
  console.log(`done: ${done} tiles, ${features} features in ${Math.round((Date.now() - t0) / 1000)} s`);
}

if (process.argv[1]?.endsWith('fetch-bgt.ts')) void main();
