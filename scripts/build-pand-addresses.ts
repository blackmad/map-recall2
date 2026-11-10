/**
 * Build `pand-addresses-v1` (lane C2, #368): the BAG address of every pand, for building cards.
 *
 * Source: PDOK's open BAG WFS (CC0), `bag:verblijfsobject` (hoofdadres: street, number, letter, `pandidentificatie`).
 * Each z14 building-facts tile's box is paged (cached under `.cache/pand-addresses/`, so a rerun costs nothing), the
 * verblijfsobjecten still standing are grouped per pand and street (`src/canalRecall/pandAddress.ts`), and each pand is
 * written into the tile its verblijfsobjecten centre on, as `{ version: 1, pands: { P<id>: [[street, "55–65"], ...] } }`.
 *
 * Writes into `public/data/extracts/amsterdam/staging/pand-addresses-v1/`, a coverage report beside it and, with
 * `--against=<dir>` or the published tile ids, the share of drawn pands that carry an address. It never publishes;
 * the integrator copies the staging directory to `pand-addresses-v1/` after review.
 *
 * Usage: node --import tsx scripts/build-pand-addresses.ts [--limit=3] [--help]   (no npm script yet: package.json is the integrator's)
 */
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { gunzipSync, gzipSync } from 'node:zlib';
import { PAND_ADDRESS_VERSION, pandAddressOf, type AddressRow, type PandAddressTile } from '../src/canalRecall/pandAddress.ts';
import { shortBuildingId } from '../src/canalRecall/buildingFacts.ts';

const HELP = `build-pand-addresses: BAG addresses per pand, cut into the z14 building-facts tiles.
  --limit=N        only the first N tiles (a quick look)
  --out=DIR        staging directory (default public/data/extracts/amsterdam/staging/pand-addresses-v1)
  --cache=DIR      WFS page cache (default .cache/pand-addresses)
Never publishes: the integrator copies the staging directory to public/data/extracts/amsterdam/pand-addresses-v1/.`;
if (process.argv.includes('--help')) { console.log(HELP); process.exit(0); }
const arg = (name: string) => process.argv.find(a => a.startsWith(`--${name}=`))?.slice(name.length + 3);

const extracts = path.resolve('public/data/extracts/amsterdam');
const outDir = path.resolve(arg('out') ?? path.join(extracts, 'staging/pand-addresses-v1'));
const cacheDir = path.resolve(arg('cache') ?? '.cache/pand-addresses');
const limit = Number(arg('limit') ?? Infinity);
const WFS = 'https://service.pdok.nl/lv/bag/wfs/v2_0';
const PAGE = 1000, PAGING_LIMIT = 45000;
/** Verblijfsobjecten that do not stand (or never did) say nothing about the building today. */
const GONE = /niet gerealiseerd|ingetrokken|ten onrechte|buiten gebruik/i;

const tileBox = (x: number, y: number) => {
  const n = 2 ** 14, lat = (ty: number) => Math.atan(Math.sinh(Math.PI * (1 - 2 * ty / n))) * 180 / Math.PI;
  return { minLat: lat(y + 1), maxLat: lat(y), minLon: x / n * 360 - 180, maxLon: (x + 1) / n * 360 - 180 };
};
type Box = ReturnType<typeof tileBox>;

async function getJson(url: string, file: string): Promise<any> {
  if (existsSync(file)) return JSON.parse(await readFile(file, 'utf8'));
  for (let attempt = 0; attempt < 6; attempt++) {
    try {
      const response = await fetch(url);
      if (response.ok) { const json = await response.json(); await mkdir(path.dirname(file), { recursive: true }); await writeFile(file, JSON.stringify(json)); return json; }
    } catch { /* retry */ }
    await new Promise(r => setTimeout(r, 2000 * (attempt + 1)));
  }
  throw new Error(`PDOK request failed: ${url}`);
}

const query = (box: Box, extra: Record<string, string>) => `${WFS}?${new URLSearchParams({
  service: 'WFS', version: '2.0.0', request: 'GetFeature', typeNames: 'bag:verblijfsobject', sortBy: 'identificatie',
  bbox: `${box.minLat},${box.minLon},${box.maxLat},${box.maxLon},urn:ogc:def:crs:EPSG::4326`, ...extra })}`;

/** numberMatched of a box (the JSON output carries none, the XML hits answer does). */
async function countIn(box: Box, key: string): Promise<number> {
  const file = path.join(cacheDir, `${key}-hits.txt`);
  let text = existsSync(file) ? await readFile(file, 'utf8') : '';
  for (let attempt = 0; attempt < 6 && !text; attempt++) {
    try { const r = await fetch(query(box, { resultType: 'hits' })); if (r.ok) text = await r.text(); } catch { /* retry */ }
    if (!text) await new Promise(r => setTimeout(r, 2000 * (attempt + 1)));
  }
  const n = Number(/numberMatched="(\d+)"/.exec(text)?.[1]);
  if (!Number.isFinite(n)) throw new Error(`no numberMatched for ${key}`);
  await mkdir(cacheDir, { recursive: true }); await writeFile(file, text);
  return n;
}

interface Vbo { id: string; pand: string; row: AddressRow; lng: number; lat: number }

/** Every verblijfsobject in a box; a box with more than the paging limit is quartered. */
async function fetchBox(box: Box, key: string): Promise<Vbo[]> {
  const matched = await countIn(box, key);
  if (matched > PAGING_LIMIT) {
    const midLat = (box.minLat + box.maxLat) / 2, midLon = (box.minLon + box.maxLon) / 2;
    const parts: Box[] = [
      { ...box, maxLat: midLat, maxLon: midLon }, { ...box, maxLat: midLat, minLon: midLon },
      { ...box, minLat: midLat, maxLon: midLon }, { ...box, minLat: midLat, minLon: midLon },
    ];
    return (await Promise.all(parts.map((p, i) => fetchBox(p, `${key}-${i}`)))).flat();
  }
  const out: Vbo[] = [];
  for (let start = 0; start < matched; start += PAGE) {
    const json = await getJson(query(box, { outputFormat: 'application/json', count: String(PAGE), startIndex: String(start) }), path.join(cacheDir, `${key}-${start}.json`));
    for (const f of json.features ?? []) {
      const p = f.properties ?? {};
      if (!p.pandidentificatie || GONE.test(String(p.status ?? ''))) continue;
      out.push({ id: String(p.identificatie), pand: String(p.pandidentificatie), lng: 0, lat: 0,
        row: { street: String(p.openbare_ruimte ?? ''), n: Number(p.huisnummer), letter: p.huisletter ? String(p.huisletter) : null },
        // RD coordinates; only used to place the pand in a tile, so the tile box centre of the query is enough.
      });
    }
    if ((json.features ?? []).length < PAGE) break;
  }
  return out;
}

// Which tiles exist: the building-facts tiles, so a click's 3x3 neighbourhood finds the addresses beside its facts.
const factRoot = path.join(extracts, 'building-facts/14');
const tiles: Array<{ x: number; y: number }> = [];
for (const x of await readdir(factRoot)) for (const f of await readdir(path.join(factRoot, x))) {
  if (f.endsWith('.json.gz')) tiles.push({ x: Number(x), y: Number(f.split('.')[0]) });
}
tiles.sort((a, b) => a.x - b.x || a.y - b.y);
const todo = tiles.slice(0, limit);
console.log(`${todo.length} tiles; cache ${cacheDir}`);

// The tile a pand belongs to is the one where it was fetched with most of its verblijfsobjecten; a pand seen in two
// neighbouring boxes is merged once by verblijfsobject id.
const byPand = new Map<string, { rows: Map<string, AddressRow>; tile: Map<string, number> }>();
let vbos = 0;
for (const [i, { x, y }] of todo.entries()) {
  const found = await fetchBox(tileBox(x, y), `${x}-${y}`);
  for (const v of found) {
    const entry = byPand.get(v.pand) ?? { rows: new Map(), tile: new Map() };
    if (!entry.rows.has(v.id)) vbos++;
    entry.rows.set(v.id, v.row);
    entry.tile.set(`${x}/${y}`, (entry.tile.get(`${x}/${y}`) ?? 0) + 1);
    byPand.set(v.pand, entry);
  }
  process.stdout.write(`\r${i + 1}/${todo.length} tiles, ${vbos} verblijfsobjecten, ${byPand.size} pands`);
}
console.log();

const out = new Map<string, PandAddressTile>();
let withAddress = 0, multiStreet = 0, noStreet = 0;
for (const [pand, entry] of byPand) {
  const address = pandAddressOf([...entry.rows.values()]);
  if (!address.length) { noStreet++; continue; }
  withAddress++;
  if (address.length > 1) multiStreet++;
  const tile = [...entry.tile.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0][0];
  const file = out.get(tile) ?? { version: 1, pands: {} };
  file.pands[shortBuildingId(`NL.IMBAG.Pand.${pand}`)] = address;
  out.set(tile, file);
}

await rm(outDir, { recursive: true, force: true });
let bytes = 0;
for (const [tile, file] of out) {
  const [x, y] = tile.split('/');
  const dir = path.join(outDir, '14', x);
  await mkdir(dir, { recursive: true });
  const gz = gzipSync(JSON.stringify(file));
  bytes += gz.length;
  await writeFile(path.join(dir, `${y}.json.gz`), gz);
}

// Coverage against the pands the map draws: every id in the building tiles.
let drawn = 0, drawnWithAddress = 0;
const placed = new Set<string>();
for (const file of out.values()) for (const id of Object.keys(file.pands)) placed.add(id);
const tileRoot = path.join(extracts, 'building-tiles/14');
for (const x of await readdir(tileRoot)) for (const f of await readdir(path.join(tileRoot, x))) {
  if (!f.endsWith('.geojson.gz')) continue;
  const collection = JSON.parse(gunzipSync(await readFile(path.join(tileRoot, x, f))).toString('utf8'));
  for (const feature of collection.features) {
    const id = feature.properties?.id;
    if (!id) continue;
    drawn++; if (placed.has(shortBuildingId(String(id)))) drawnWithAddress++;
  }
}
const report = {
  version: PAND_ADDRESS_VERSION, source: `${WFS} bag:verblijfsobject (hoofdadres), PDOK BAG, CC0`, builtAt: new Date().toISOString(),
  tilesQueried: todo.length, tilesWritten: out.size, bytesGzip: bytes, verblijfsobjecten: vbos,
  pandsWithVerblijfsobject: byPand.size, pandsWithAddress: withAddress, pandsWithoutUsableAddress: noStreet,
  coverageOfPandsWithVerblijfsobject: Number((withAddress / Math.max(byPand.size, 1)).toFixed(4)),
  pandsOnSeveralStreets: multiStreet,
  drawnBuildings: drawn, drawnBuildingsWithAddress: drawnWithAddress,
  coverageOfDrawnBuildings: Number((drawnWithAddress / Math.max(drawn, 1)).toFixed(4)),
  limitations: ['hoofdadres only: nevenadressen (a corner pand\'s second street) are not in the verblijfsobject layer', 'tiles follow the building-facts tiles'],
  note: 'staged, not published: the integrator copies this directory to pand-addresses-v1/ after review',
};
await writeFile(path.join(outDir, 'coverage.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
