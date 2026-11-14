// Fetch Amsterdam's horeca exploitation permits (with their permitted terrace polygons) into a raw cache.
//
//   npx tsx scripts/terraces/fetch.ts [--refresh]
//
// Source: Gemeente Amsterdam, "Horeca exploitatievergunningen" (dataset horeca, table exploitatievergunning),
//   https://api.data.amsterdam.nl/v1/horeca/exploitatievergunning/?_format=json&_pageSize=1000 (paged by `next` links).
//   Licence CC-BY 4.0, Gemeente Amsterdam (https://api.data.amsterdam.nl/v1/docs/datasets/horeca.html).
// Each row: zaaknaam, zaakCategorie, statusVergunning, begindatum/einddatum, the terrace opening hours (oTijdenTerras*),
// `locatie` (RD point) and `terrasgeometrie` (an RD MultiPolygon of the permitted terrace), plus temporary-terrace fields.
// Cache: artifacts/terraces/raw/<YYYY-MM-DD>/page-N.json.gz (not committed). build.ts reads the newest day.
// Polite: one request at a time, 1.5 s apart, retries back off; the repo URL as contact (never a personal address).
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { gunzipSync, gzipSync } from 'node:zlib';

export const RAW = 'artifacts/terraces/raw';
export const API = 'https://api.data.amsterdam.nl/v1/horeca/exploitatievergunning/';
export const FIRST_PAGE = `${API}?_format=json&_pageSize=1000`;
export const USER_AGENT = 'MapRecall/1.0 (+https://github.com/blackmad/map-recall2)';
export const TABLE = 'exploitatievergunning';

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function getJson(url: string): Promise<any> {
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT} });
      if (res.ok) return await res.json();
      if (attempt > 5 || (res.status < 500 && res.status !== 429)) throw new Error(`${res.status} ${url}`);
    } catch (e) { if (attempt > 5) throw e; }
    await sleep(3000 * (attempt + 1));
  }
}

export async function fetchPermits(day: string, refresh = false): Promise<number> {
  const dir = `${RAW}/${day}`;
  mkdirSync(dir, { recursive: true });
  let next: string | null = FIRST_PAGE, page = 1, rows = 0;
  while (next) {
    if (page > 40) throw new Error('pagination budget exceeded');
    const file = `${dir}/page-${page}.json.gz`;
    let data: any;
    if (!refresh && existsSync(file)) data = JSON.parse(gunzipSync(readFileSync(file)).toString());
    else { data = await getJson(next); writeFileSync(file, gzipSync(JSON.stringify(data))); await sleep(1500); }
    rows += (data._embedded?.[TABLE] ?? []).length;
    next = data._links?.next?.href ?? null;
    if (next && !next.startsWith(API)) throw new Error(`unexpected pagination host ${next}`);
    console.log(`page ${page}: ${rows} rows`);
    page++;
  }
  return rows;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const day = new Date().toISOString().slice(0, 10);
  const rows = await fetchPermits(day, process.argv.includes('--refresh'));
  console.log(`${rows} permits cached under ${RAW}/${day}`);
}
