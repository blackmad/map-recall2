// Fetch the city's open street-furniture registers into a raw cache (lane #170):
//
//   npx tsx scripts/street-furniture/fetch.ts [--concurrency 6] [--limit-cells N]
//
// Sources
//   - Underground waste containers: Gemeente Amsterdam, huishoudelijkafval
//       https://api.data.amsterdam.nl/v1/huishoudelijkafval/container/       (every container, RD coordinates)
//       https://api.data.amsterdam.nl/v1/huishoudelijkafval/containertype/   (volumeM3, UNDERGROUND / other)
//   - BGT (Basisregistratie Grootschalige Topografie), Kadaster via PDOK, CC0 1.0:
//       https://api.pdok.nl/lv/bgt/ogc/v1/collections/{paal,bak,straatmeubilair}/items
//     fetched per 1 km own-ground cell (the city box), paged by `next` links like scripts/own-ground/fetch-bgt.ts.
// Cache: artifacts/street-furniture/raw/ (not committed). build.ts reads it and writes the staging extract.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { cellBounds, elevationIndex } from '../own-ground/game-cells.ts';

export const RAW = 'artifacts/street-furniture/raw';
export const AMS = 'https://api.data.amsterdam.nl/v1/huishoudelijkafval';
export const CONTAINER_FIELDS = 'id,fractieOmschrijving,geometrie,locatieId,clusterId,typeId,status,verwijderdDp,datumPlaatsing,containerKleur';
export const BGT = 'https://api.pdok.nl/lv/bgt/ogc/v1/collections';
export const BGT_COLLECTIONS = ['paal', 'bak', 'straatmeubilair'] as const;

async function getJson(url: string): Promise<any> {
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': 'map-recall-street-furniture/1 (build script)'} });
      if (res.ok) return await res.json();
      if (attempt > 6 || (res.status < 500 && res.status !== 429)) throw new Error(`${res.status} ${url}`);
    } catch (e) { if (attempt > 6) throw e; }
    await new Promise(r => setTimeout(r, 2000 * (attempt + 1)));
  }
}

/** Every page of a data.amsterdam.nl list endpoint, cached per page. */
async function amsterdamList(name: string, fields: string | null): Promise<number> {
  const dir = `${RAW}/amsterdam/${name}`;
  mkdirSync(dir, { recursive: true });
  let next: string | null = `${AMS}/${name}/?_format=json&_pageSize=5000${fields ? `&_fields=${fields}` : ''}`;
  let page = 1, rows = 0;
  while (next) {
    if (page > 60) throw new Error(`${name}: pagination budget exceeded`);
    const file = `${dir}/page-${page}.json.gz`;
    let data: any;
    if (existsSync(file)) data = JSON.parse((await import('node:zlib')).gunzipSync(readFileSync(file)).toString());
    else { data = await getJson(next); writeFileSync(file, gzipSync(JSON.stringify(data))); }
    rows += (data._embedded?.[name] ?? []).length;
    next = data._links?.next?.href ?? null;
    if (next && !next.startsWith(`${AMS}/${name}/`)) throw new Error(`unexpected pagination host ${next}`);
    console.log(`${name}: page ${page}, ${rows} rows`);
    page++;
  }
  return rows;
}

async function bgtCell(collection: string, file: string, bbox: [number, number, number, number]): Promise<number> {
  const out: any[] = [];
  let url: string | null = `${BGT}/${collection}/items?f=json&limit=1000&bbox=${bbox.map(v => v.toFixed(6)).join(',')}`;
  while (url) {
    const j = await getJson(url);
    for (const f of j.features as any[]) out.push({ id: f.id, properties: f.properties, geometry: f.geometry });
    url = (j.links as any[]).find(l => l.rel === 'next')?.href ?? null;
  }
  writeFileSync(file, gzipSync(JSON.stringify(out)));
  return out.length;
}

async function main(): Promise<void> {
  const arg = (n: string, d: number) => { const i = process.argv.indexOf(n); return i > 0 ? Number(process.argv[i + 1]) : d; };
  const concurrency = arg('--concurrency', 6), limit = arg('--limit-cells', 1e9);
  const t0 = Date.now();
  console.log(`containers: ${await amsterdamList('container', CONTAINER_FIELDS)} rows`);
  console.log(`containertypes: ${await amsterdamList('containertype', null)} rows`);
  const index = elevationIndex();
  const manifest = JSON.parse(readFileSync('public/data/extracts/amsterdam/own-ground-osm-v1/cells.json', 'utf8')) as { cells: string[] };
  const jobs: { collection: string; file: string; bbox: [number, number, number, number] }[] = [];
  for (const collection of BGT_COLLECTIONS) {
    mkdirSync(`${RAW}/bgt/${collection}`, { recursive: true });
    for (const key of manifest.cells.slice(0, limit)) jobs.push({ collection, file: `${RAW}/bgt/${collection}/${key}.json.gz`, bbox: cellBounds(index, key) });
  }
  const todo = jobs.filter(j => !existsSync(j.file));
  console.log(`${jobs.length} BGT cell jobs, ${todo.length} to fetch`);
  let done = 0, features = 0;
  await Promise.all(Array.from({ length: concurrency }, async () => {
    for (let j = todo.shift(); j; j = todo.shift()) {
      features += await bgtCell(j.collection, j.file, j.bbox);
      if (++done % 25 === 0) console.log(`${done} cells, ${features} features, ${Math.round((Date.now() - t0) / 1000)} s, ${todo.length} left`);
    }
  }));
  console.log(`done: ${done} BGT cells, ${features} features in ${Math.round((Date.now() - t0) / 1000)} s`);
}

if (process.argv[1]?.endsWith('fetch.ts')) void main();
