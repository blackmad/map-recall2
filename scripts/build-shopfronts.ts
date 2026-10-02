/**
 * Shopfronts extract: which buildings have a shop, café or bar on the ground floor, and what
 * kind of shopfront it gets.
 *
 *   npx tsx scripts/build-shopfronts.ts            # fetch, write the staging file, report
 *   npx tsx scripts/build-shopfronts.ts --publish  # also publish into the versioned extract
 *   (--cache=path/to/overpass.json reuses a saved Overpass answer)
 *
 * Every OSM shop / amenity node lands on the building whose footprint contains it, or else
 * the nearest footprint edge within 8 m (a node drawn on the pavement in front). Along a busy
 * stretch, defined as 5 or more businesses within 40 m, the building between two shops is
 * usually a shop too; such buildings get a shopfront like their nearest neighbour's. Everything else is
 * marked quiet. Output: public/data/extracts/amsterdam/shopfronts.json.
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { businessColour, shopKindForTags, type ShopfrontExtract } from '../src/canalRecall/shopfronts.ts';
import { SHOP_KINDS, type ShopKind } from '../src/canalRecall/bayTextures.ts';

const BBOX = '52.28,4.75,52.43,5.05';
const STAGING = 'tmp/shopfronts/shopfronts.json', PUBLISHED = 'public/data/extracts/amsterdam/shopfronts.json';
const QUERY = `[out:json][timeout:180];(node["shop"](${BBOX});node["amenity"~"^(cafe|restaurant|bar|pub|fast_food|ice_cream|pharmacy|bank)$"](${BBOX}););out;`;
const cacheArg = process.argv.find(a => a.startsWith('--cache='))?.slice(8);

type Node = { id: number; lat: number; lon: number; tags: Record<string, string> };
async function fetchNodes(): Promise<Node[]> {
  if (cacheArg) return JSON.parse(fs.readFileSync(cacheArg, 'utf8')).elements;
  const endpoints = ['https://maps.mail.ru/osm/tools/overpass/api/interpreter', 'https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter'];
  let last: Error | null = null;
  for (let attempt = 0; attempt < 6; attempt++) {
    const endpoint = endpoints[attempt % endpoints.length];
    try {
      const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'map-recall/1.0 (Canal Recall shopfronts)' }, body: new URLSearchParams({ data: QUERY }) });
      if (!response.ok) throw new Error(`Overpass ${response.status} from ${endpoint}`);
      const json = await response.json();
      fs.mkdirSync('tmp/shopfronts', { recursive: true });
      fs.writeFileSync('tmp/shopfronts/overpass.json', JSON.stringify(json));
      return json.elements;
    } catch (error) {
      last = error as Error;
      console.warn(`  ${last.message}; retrying`);
      await new Promise(resolve => setTimeout(resolve, 3000 * (attempt + 1)));
    }
  }
  throw last ?? new Error('Overpass unavailable');
}

// Buildings in local metres, bucketed on a 50 m grid.
const LAT0 = 52.37, KX = 111_320 * Math.cos(LAT0 * Math.PI / 180), KY = 110_540, CELL = 50;
const local = (lng: number, lat: number): [number, number] => [(lng - 4.9) * KX, (lat - LAT0) * KY];
type Building = { id: string; ring: [number, number][]; cx: number; cy: number };
const buildings: Building[] = [], grid = new Map<string, Building[]>();
const root = 'public/data/extracts/amsterdam/building-tiles/14';
for (const x of fs.readdirSync(root)) for (const f of fs.readdirSync(path.join(root, x))) {
  const bytes = fs.readFileSync(path.join(root, x, f));
  for (const feature of JSON.parse((bytes[0] === 0x1f ? zlib.gunzipSync(bytes) : bytes).toString()).features) {
    const g = feature.geometry, outer = g.type === 'Polygon' ? g.coordinates[0] : g.type === 'MultiPolygon' ? g.coordinates[0][0] : null;
    if (!outer || Number(feature.properties.minHeight) > 2) continue;
    const ring = outer.map(([lng, lat]: number[]) => local(lng, lat));
    const cx = ring.reduce((s: number, p: number[]) => s + p[0], 0) / ring.length, cy = ring.reduce((s: number, p: number[]) => s + p[1], 0) / ring.length;
    const b = { id: String(feature.properties.id), ring, cx, cy };
    buildings.push(b);
    const key = `${Math.floor(cx / CELL)},${Math.floor(cy / CELL)}`;
    let list = grid.get(key); if (!list) grid.set(key, list = []); list.push(b);
  }
}
const near = (x: number, y: number) => { const gx = Math.floor(x / CELL), gy = Math.floor(y / CELL), out: Building[] = []; for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) out.push(...(grid.get(`${gx + dx},${gy + dy}`) ?? [])); return out; };
const contains = (ring: [number, number][], x: number, y: number) => { let inside = false; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) { const [xi, yi] = ring[i], [xj, yj] = ring[j]; if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside; } return inside; };
const edgeDistance = (ring: [number, number][], x: number, y: number) => { let best = Infinity; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) { const [ax, ay] = ring[j], [bx, by] = ring[i], dx = bx - ax, dy = by - ay, l = dx * dx + dy * dy || 1, t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / l)); best = Math.min(best, Math.hypot(x - ax - t * dx, y - ay - t * dy)); } return best; };

const nodes = await fetchNodes();
// The businesses the game labels on the map (branded-pois local-food, with an orientation score).
const labelled = (JSON.parse(fs.readFileSync('public/data/extracts/amsterdam/branded-pois.json', 'utf8')) as any[])
  .filter(p => p.kind === 'local-food' && Number(p.orientationScore) >= 5).map(p => ({ name: String(p.name).toLowerCase(), xy: local(p.center[1], p.center[0]), score: Number(p.orientationScore) }));
const branches = new Map<string, number>();
for (const node of nodes) { const name = node.tags?.name?.trim().toLowerCase(); if (name && shopKindForTags(node.tags)) branches.set(name, (branches.get(name) ?? 0) + 1); }
/** How much a business deserves a signature storefront; > 0 qualifies. */
const notability = (name: string, x: number, y: number) => {
  const label = labelled.find(l => l.name === name && Math.hypot(l.xy[0] - x, l.xy[1] - y) < 30);
  return (label ? label.score : 0) + ((branches.get(name) ?? 0) >= 3 ? 6 : 0);
};
const colours = new Map<string, string>(), signatures = new Map<string, { at: [number, number]; score: number }>();
const assigned = new Map<string, ShopKind>(), points: Array<{ x: number; y: number; kind: ShopKind }> = [];
let unplaced = 0, skipped = 0;
for (const node of nodes) {
  const kind = shopKindForTags(node.tags ?? {});
  if (!kind) { skipped++; continue; }
  // Upper-floor businesses (a level tag above 0) do not change the shopfront.
  if (Number(node.tags.level) > 0) { skipped++; continue; }
  const [x, y] = local(node.lon, node.lat);
  points.push({ x, y, kind });
  const candidates = near(x, y);
  let host = candidates.find(b => contains(b.ring, x, y));
  if (!host) { let best = 8; for (const b of candidates) { const d = edgeDistance(b.ring, x, y); if (d < best) { best = d; host = b; } } }
  if (!host) { unplaced++; continue; }
  // A food or café use beats a generic window when one building carries several POIs.
  const held = assigned.get(host.id);
  if (!held || held === 'shopWindow' || held === 'groundShop') assigned.set(host.id, kind);
  const name = node.tags.name?.trim();
  if (name) {
    if (!colours.has(host.id)) colours.set(host.id, businessColour(name, node.tags['brand:colour'] ?? node.tags.colour));
    const score = notability(name.toLowerCase(), x, y);
    if (score > 0 && score > (signatures.get(host.id)?.score ?? 0)) { signatures.set(host.id, { at: [Math.round(node.lon * 1e6) / 1e6, Math.round(node.lat * 1e6) / 1e6], score }); colours.set(host.id, businessColour(name, node.tags['brand:colour'] ?? node.tags.colour)); }
  }
}
const direct = assigned.size;
// Busy stretches: a building with no POI whose centre has 5+ businesses within 40 m gets its nearest one's kind.
const pointGrid = new Map<string, typeof points>();
for (const pt of points) { const key = `${Math.floor(pt.x / CELL)},${Math.floor(pt.y / CELL)}`; let l = pointGrid.get(key); if (!l) pointGrid.set(key, l = []); l.push(pt); }
let busy = 0;
for (const b of buildings) {
  if (assigned.has(b.id)) continue;
  const gx = Math.floor(b.cx / CELL), gy = Math.floor(b.cy / CELL), around: typeof points = [];
  for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (const pt of pointGrid.get(`${gx + dx},${gy + dy}`) ?? []) if (Math.hypot(pt.x - b.cx, pt.y - b.cy) < 40) around.push(pt);
  if (around.length < 5) continue;
  around.sort((p, q) => Math.hypot(p.x - b.cx, p.y - b.cy) - Math.hypot(q.x - b.cx, q.y - b.cy));
  assigned.set(b.id, around[0].kind); busy++;
}
const kinds = [...SHOP_KINDS];
const out: ShopfrontExtract = { version: 1, kinds, buildings: Object.fromEntries([...assigned].map(([id, kind]) => [id, kinds.indexOf(kind)])), colours: Object.fromEntries(colours), signatures: Object.fromEntries([...signatures].map(([id, s]) => [id, s.at])) };
const text = JSON.stringify(out);
fs.mkdirSync(path.dirname(STAGING), { recursive: true });
fs.writeFileSync(STAGING, text);
const byKind = Object.fromEntries(kinds.map(k => [k, [...assigned.values()].filter(v => v === k).length]));
console.log(`${nodes.length} POIs (${skipped} not ground-floor businesses, ${unplaced} with no building within 8 m); ${direct} buildings carry a business, ${busy} more on busy stretches, of ${buildings.length} ground buildings; ${(text.length / 1024).toFixed(0)} KB`);
console.log(byKind);
console.log(`${colours.size} buildings in their business's own colour, ${signatures.size} signature storefronts (${labelled.length} labelled businesses, ${[...branches.values()].filter(n => n >= 3).length} chains of 3+)`);
if (process.argv.includes('--publish')) { fs.writeFileSync(PUBLISHED, text); console.log(`published -> ${PUBLISHED}`); }
