/**
 * Shop anchors (lane shop-band-ground-20261121, `?shopRun=1`, src/canalRecall/shopRun.ts): for every shop pand in the
 * published shopfronts extract, the [lng, lat] points of the ground-floor OSM businesses hosted on it, by the same rule
 * scripts/build-shopfronts.ts uses (shopGate.ts hostForPoi, level > 0 and trade businesses on non-shop pands skipped).
 * The mesher keeps the shop ground storey on the wall runs these points pick and draws the quiet ground on the rest.
 *
 *   node --import tsx scripts/retail-ground/build-shop-anchors.ts --cache=.cache/retail-ground/overpass.json
 *   node --import tsx scripts/retail-ground/build-shop-anchors.ts --cache=... --publish
 *   (--vbo=.cache/retail-ground/vbo: also BAG shop/horeca verblijfsobject points; --vbo-fetch first fills the cache for
 *   shop pands it does not cover;
 *   --bag=path/to/bag-uses.json: the BAG use table, default .cache/industrial/bag-uses.json)
 *
 * Stages tmp/shop-anchors/shop-anchors.json and prints coverage; --publish also writes
 * public/data/extracts/amsterdam/shop-anchors.json. Without --cache it fetches Overpass (repo URL as contact).
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { shopKindForTags, type ShopfrontExtract } from '../../src/canalRecall/shopfronts.ts';
import { bagAllowsShop, hostForPoi, isTradeBusiness, type BagUsesTable } from '../../src/canalRecall/shopGate.ts';
import type { ShopAnchorExtract } from '../../src/canalRecall/shopRun.ts';
import { insideRing } from '../../src/canalRecall/retailHosting.ts';

const ROOT = path.resolve(import.meta.dirname, '../..');
const STAGING = path.join(ROOT, 'tmp/shop-anchors/shop-anchors.json'), PUBLISHED = path.join(ROOT, 'public/data/extracts/amsterdam/shop-anchors.json');
const BBOX = '52.28,4.75,52.43,5.05';
const QUERY = `[out:json][timeout:180];(node["shop"](${BBOX});node["amenity"~"^(cafe|restaurant|bar|pub|fast_food|ice_cream|pharmacy|bank)$"](${BBOX}););out;`;
const cacheArg = process.argv.find(a => a.startsWith('--cache='))?.slice(8);
type Node = { id: number; lat: number; lon: number; tags: Record<string, string> };
async function fetchNodes(): Promise<{ nodes: Node[]; stamp: string }> {
  if (cacheArg) { const j = JSON.parse(fs.readFileSync(path.resolve(cacheArg), 'utf8')); return { nodes: j.elements, stamp: `${path.basename(cacheArg)} ${j.osm3s?.timestamp_osm_base ?? ''}`.trim() }; }
  const r = await fetch('https://overpass-api.de/api/interpreter', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'map-recall2 shop anchors (https://github.com/blackmad/map-recall2)' }, body: new URLSearchParams({ data: QUERY }) });
  if (!r.ok) throw new Error(`Overpass ${r.status}`);
  const j = await r.json();
  return { nodes: j.elements, stamp: `overpass ${j.osm3s?.timestamp_osm_base ?? ''}`.trim() };
}

const LAT0 = 52.37, KX = 111_320 * Math.cos(LAT0 * Math.PI / 180), KY = 110_540, CELL = 50;
const local = (lng: number, lat: number): [number, number] => [(lng - 4.9) * KX, (lat - LAT0) * KY];
type Building = { id: string; ring: [number, number][] };
const grid = new Map<string, Building[]>();
const tiles = path.join(ROOT, 'public/data/extracts/amsterdam/building-tiles/14');
for (const x of fs.readdirSync(tiles)) for (const f of fs.readdirSync(path.join(tiles, x))) {
  const bytes = fs.readFileSync(path.join(tiles, x, f));
  for (const feature of JSON.parse((bytes[0] === 0x1f ? zlib.gunzipSync(bytes) : bytes).toString()).features) {
    const g = feature.geometry, outer = g.type === 'Polygon' ? g.coordinates[0] : g.type === 'MultiPolygon' ? g.coordinates[0][0] : null;
    if (!outer || Number(feature.properties.minHeight) > 2) continue;
    const ring = outer.map(([lng, lat]: number[]) => local(lng, lat));
    const cx = ring.reduce((s: number, p: number[]) => s + p[0], 0) / ring.length, cy = ring.reduce((s: number, p: number[]) => s + p[1], 0) / ring.length;
    const key = `${Math.floor(cx / CELL)},${Math.floor(cy / CELL)}`;
    let list = grid.get(key); if (!list) grid.set(key, list = []); list.push({ id: String(feature.properties.id), ring });
  }
}
const near = (x: number, y: number) => { const gx = Math.floor(x / CELL), gy = Math.floor(y / CELL), out: Building[] = []; for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) out.push(...(grid.get(`${gx + dx},${gy + dy}`) ?? [])); return out; };

const { nodes, stamp } = await fetchNodes();
const bagUses = (JSON.parse(fs.readFileSync(path.resolve(process.argv.find(a => a.startsWith('--bag='))?.slice(6) ?? path.join(ROOT, '.cache/industrial/bag-uses.json')), 'utf8')) as { pands: BagUsesTable }).pands;
const bagKey = (id: string) => id.replace(/^NL\.IMBAG\.Pand\./, '');
const shops = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/data/extracts/amsterdam/shopfronts.json'), 'utf8')) as ShopfrontExtract;
const anchors = new Map<string, Array<[number, number]>>();
let hosted = 0, offShop = 0;
for (const node of nodes) {
  if (node.type !== undefined && (node as { type?: string }).type !== 'node') continue;
  const tags = node.tags ?? {};
  if (!shopKindForTags(tags) || Number(tags.level) > 0) continue;
  const [x, y] = local(node.lon, node.lat);
  const hit = hostForPoi(near(x, y), x, y, id => bagUses[bagKey(id)], true);
  if (!hit) continue;
  if (isTradeBusiness(tags) && !bagAllowsShop(bagUses[bagKey(hit.id)])) continue;
  hosted++;
  if (shops.buildings[hit.id] === undefined) { offShop++; continue; }
  let list = anchors.get(hit.id); if (!list) anchors.set(hit.id, list = []);
  const at: [number, number] = [Math.round(node.lon * 1e6) / 1e6, Math.round(node.lat * 1e6) / 1e6];
  if (!list.some(p => p[0] === at[0] && p[1] === at[1])) list.push(at);
}
// Round 2 (coordinator 2026-11-21): every BAG verblijfsobject with a shop (winkelfunctie) or horeca (bijeenkomstfunctie)
// use whose address point lies in a shop pand is an anchor too, so a street run faced by a registered shop unit keeps its
// shopfront even when OSM has no node there. --vbo=<dir>: the retail-ground PDOK cache (.cache/retail-ground/vbo, one
// {vbos: [{use, at}]} file per bbox); absent, OSM only.
const vboDir = process.argv.find(a => a.startsWith('--vbo='))?.slice(6);
// --vbo-fetch: first fetch (PDOK BAG OGC API v2, CC0; cached in --vbo as pand_<id>.json) the verblijfsobjecten of every shop
// pand with no cached point inside it, over the pand's bounding box. The retail-ground cache only covers template POIs.
if (vboDir && process.argv.includes('--vbo-fetch')) {
  const dir = path.resolve(vboDir), cached: Array<[number, number]> = [];
  for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.json'))) for (const v of (JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')).vbos ?? []) as Array<{ at?: [number, number] }>) if (v.at) cached.push(local(v.at[0], v.at[1]));
  const cgrid = new Map<string, Array<[number, number]>>();
  for (const p of cached) { const k = `${Math.floor(p[0] / CELL)},${Math.floor(p[1] / CELL)}`; let l = cgrid.get(k); if (!l) cgrid.set(k, l = []); l.push(p); }
  const ringOf = new Map<string, [number, number][]>();
  for (const list of grid.values()) for (const b of list) if (shops.buildings[b.id] !== undefined) ringOf.set(b.id, b.ring);
  const todo = [...ringOf].filter(([, ring]) => !ring.some(([x, y]) => { for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (const p of cgrid.get(`${Math.floor(x / CELL) + dx},${Math.floor(y / CELL) + dy}`) ?? []) if (insideRing(ring, p[0], p[1])) return true; return false; }));
  let fetched = 0, failed = 0;
  for (const [id, ring] of todo) {
    const file = path.join(dir, `pand_${bagKey(id)}.json`);
    if (fs.existsSync(file)) continue;
    const xs = ring.map(p => p[0]), ys = ring.map(p => p[1]), lng = (x: number) => (x / KX + 4.9).toFixed(6), lat = (y: number) => (y / KY + LAT0).toFixed(6);
    const url = `https://api.pdok.nl/kadaster/bag/ogc/v2/collections/verblijfsobject/items?f=json&limit=1000&bbox=${lng(Math.min(...xs))},${lat(Math.min(...ys))},${lng(Math.max(...xs))},${lat(Math.max(...ys))}`;
    try {
      const res = await fetch(url, { headers: { 'User-Agent': 'map-recall2 shop anchors (https://github.com/blackmad/map-recall2)' } });
      if (res.status === 429 || res.status >= 500) { console.log(`  PDOK ${res.status}: stopping; re-run to resume from the cache`); failed++; break; }
      if (!res.ok) { failed++; continue; }
      const j = await res.json() as { features: Array<{ properties: Record<string, unknown>; geometry: { coordinates: [number, number] } }> };
      fs.writeFileSync(file, JSON.stringify({ url, fetched: new Date().toISOString().slice(0, 10), vbos: j.features.map(f => ({ use: String(f.properties.gebruiksdoel ?? ''), m2: Number(f.properties.oppervlakte ?? 0), at: [+f.geometry.coordinates[0].toFixed(7), +f.geometry.coordinates[1].toFixed(7)] })) }));
      if (++fetched % 200 === 0) console.log(`  fetched ${fetched} of ${todo.length}`);
      await new Promise(r => setTimeout(r, 150)); // polite: about six requests a second, one at a time
    } catch { failed++; }
  }
  console.log(`BAG fetch: ${todo.length} shop pands had no cached verblijfsobject; ${fetched} fetched, ${failed} failed`);
}
let vboAdded = 0, vboPands = new Set<string>();
if (vboDir) {
  const seen = new Set<string>();
  for (const f of fs.readdirSync(path.resolve(vboDir)).filter(f => f.endsWith('.json'))) {
    for (const v of (JSON.parse(fs.readFileSync(path.join(path.resolve(vboDir), f), 'utf8')).vbos ?? []) as Array<{ use?: string; at?: [number, number] }>) {
      if (!v.at || !/winkelfunctie|bijeenkomstfunctie/.test(v.use ?? '')) continue;
      const at: [number, number] = [Math.round(v.at[0] * 1e6) / 1e6, Math.round(v.at[1] * 1e6) / 1e6], k = at.join(',');
      if (seen.has(k)) continue; seen.add(k);
      const [x, y] = local(at[0], at[1]);
      const host = near(x, y).find(b => shops.buildings[b.id] !== undefined && insideRing(b.ring, x, y));
      if (!host) continue;
      let list = anchors.get(host.id); if (!list) anchors.set(host.id, list = []);
      if (list.some(p => Math.hypot(p[0] - at[0], p[1] - at[1]) < 2e-6)) continue;
      list.push(at); vboAdded++; vboPands.add(host.id);
    }
  }
  console.log(`BAG verblijfsobjecten (shop/horeca): ${seen.size} points, ${vboAdded} anchors added on ${vboPands.size} shop pands`);
}
const out: ShopAnchorExtract = { version: 1, source: `OSM shop/amenity nodes (${stamp}), hosted by shopGate.hostForPoi${vboDir ? '; BAG verblijfsobjecten with winkel/horeca use (PDOK BAG OGC, retail-ground cache)' : ''}`, buildings: Object.fromEntries([...anchors].sort(([a], [b]) => a < b ? -1 : 1)) };
const text = JSON.stringify(out);
fs.mkdirSync(path.dirname(STAGING), { recursive: true });
fs.writeFileSync(STAGING, text);
const shopIds = Object.keys(shops.buildings);
const multi = [...anchors.values()].filter(l => l.length > 1).length;
console.log(`${nodes.length} nodes, ${hosted} hosted (${offShop} on pands the shopfronts extract has no shop for); ${anchors.size} of ${shopIds.length} shop pands anchored (${multi} with 2+ points), ${shopIds.length - shopIds.filter(id => anchors.has(id)).length} without; ${(text.length / 1024).toFixed(0)} KB -> ${path.relative(ROOT, STAGING)}`);
if (process.argv.includes('--publish')) { fs.writeFileSync(PUBLISHED, text); console.log(`published -> ${path.relative(ROOT, PUBLISHED)}`); }
