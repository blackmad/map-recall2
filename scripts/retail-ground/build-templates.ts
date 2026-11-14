/**
 * Shopfront templates (lane retail-ground-20261114): host every OSM shop/amenity node that asks for a template
 * (src/canalRecall/retailTemplates.ts templateForTags) on its pand, as build-shopfronts.ts hosts shops
 * (shopGate.ts hostForPoi, the BAG gate), count each template city-wide, in the centre (inside the Singelgracht
 * polygon below) and in the ring (within RING_KM of the Dam), and stage the extract.
 *
 *   node --import tsx scripts/retail-ground/build-templates.ts [--cache=.cache/retail-ground/overpass.json] [--samples=10]
 *   [--publish]
 *
 * Output: data/retail-ground/shop-templates.json (staged, reviewed) and, with --publish (the integrator's), the
 * browser copy public/data/extracts/amsterdam/shop-templates.json. Without --cache it fetches Overpass (the request
 * names the repo URL as contact) and writes the answer to .cache/retail-ground/overpass.json.
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { hostForPoi, type BagUsesTable } from '../../src/canalRecall/shopGate.ts';
import { hostOnFront, ringEdges, insideRing as insideRingOf } from '../../src/canalRecall/retailHosting.ts';
import { FRONT_HIGHWAYS, SegmentGrid, streetDistance } from '../../src/canalRecall/streetFronts.ts';
import { RETAIL_TEMPLATES, TEMPLATE_LOOKS, signWord, templateForTags, type RetailTemplate } from '../../src/canalRecall/retailTemplates.ts';
import { insideCentre, RING_KM, DAM } from '../../src/canalRecall/retailArea.ts';

const arg = (n: string) => process.argv.find(a => a.startsWith(`--${n}=`))?.slice(n.length + 3);
const CACHE = arg('cache') ?? '.cache/retail-ground/overpass.json';
const STAGING = 'data/retail-ground/shop-templates.json', PUBLISHED = 'public/data/extracts/amsterdam/shop-templates.json';
const BBOX = '52.28,4.75,52.43,5.05';
const QUERY = `[out:json][timeout:180];(node["shop"](${BBOX});node["amenity"~"^(cafe|restaurant|bar|pub|fast_food|ice_cream|pharmacy|bank)$"](${BBOX}););out;`;

type Node = { id: number; lat: number; lon: number; tags?: Record<string, string> };
async function nodes(): Promise<Node[]> {
  if (fs.existsSync(CACHE)) return JSON.parse(fs.readFileSync(CACHE, 'utf8')).elements;
  const r = await fetch('https://overpass-api.de/api/interpreter', { method: 'POST', body: new URLSearchParams({ data: QUERY }), headers: { 'User-Agent': 'map-recall2 retail-ground (https://github.com/blackmad/map-recall2)' } });
  const json = await r.json();
  fs.mkdirSync(path.dirname(CACHE), { recursive: true }); fs.writeFileSync(CACHE, JSON.stringify(json));
  return json.elements;
}

const LAT0 = 52.37, KX = 111_320 * Math.cos(LAT0 * Math.PI / 180), KY = 110_540, CELL = 50;
const local = (lng: number, lat: number): [number, number] => [(lng - 4.9) * KX, (lat - LAT0) * KY];
type Building = { id: string; ring: [number, number][]; cx: number; cy: number; owner: number };
const wallSegs: number[] = [], wallOwners: number[] = [];
let owners = 0;
const grid = new Map<string, Building[]>();
const root = 'public/data/extracts/amsterdam/building-tiles/14';
for (const x of fs.readdirSync(root)) for (const f of fs.readdirSync(path.join(root, x))) {
  const bytes = fs.readFileSync(path.join(root, x, f));
  for (const feature of JSON.parse((bytes[0] === 0x1f ? zlib.gunzipSync(bytes) : bytes).toString()).features) {
    const g = feature.geometry, outer = g.type === 'Polygon' ? g.coordinates[0] : g.type === 'MultiPolygon' ? g.coordinates[0][0] : null;
    if (!outer || Number(feature.properties.minHeight) > 2) continue;
    const ring = outer.map(([lng, lat]: number[]) => local(lng, lat));
    const cx = ring.reduce((s: number, p: number[]) => s + p[0], 0) / ring.length, cy = ring.reduce((s: number, p: number[]) => s + p[1], 0) / ring.length;
    const key = `${Math.floor(cx / CELL)},${Math.floor(cy / CELL)}`;
    const owner = owners++;
    for (const e of ringEdges(ring)) { wallSegs.push(e.x0, e.y0, e.x1, e.y1); wallOwners.push(owner); }
    let list = grid.get(key); if (!list) grid.set(key, list = []); list.push({ id: String(feature.properties.id), ring, cx, cy, owner });
  }
}
// Street-facing walls as the mesher decides them (streetFronts.ts): a FRONT_HIGHWAYS way within reach, unobstructed.
const streetSegs: number[] = [];
for (const w of JSON.parse(fs.readFileSync('public/data/extracts/amsterdam/streets-routing.json', 'utf8')) as Array<{ highway?: string; path: [number, number][] }>) {
  if (w.highway && !FRONT_HIGHWAYS.has(w.highway)) continue;
  for (let i = 1; i < w.path.length; i++) { const a = local(w.path[i - 1][1], w.path[i - 1][0]), b = local(w.path[i][1], w.path[i][0]); streetSegs.push(a[0], a[1], b[0], b[1]); }
}
const streets = new SegmentGrid(Float32Array.from(streetSegs)), walls = new SegmentGrid(Float32Array.from(wallSegs), 25, Int32Array.from(wallOwners));
const facing = (c: { owner?: number }, e: ReturnType<typeof ringEdges>[number]) => streetDistance(e, streets, walls, (c as Building).owner) < Infinity;
// Not a party wall: no other footprint's wall within 1 m straight in front of its middle.
const open = (c: { owner?: number }, e: ReturnType<typeof ringEdges>[number]) => walls.firstHit((e.x0 + e.x1) / 2 - e.nx * 0.05, (e.y0 + e.y1) / 2 - e.ny * 0.05, e.nx, e.ny, 1.05, (c as Building).owner) === Infinity;
const near = (x: number, y: number) => { const gx = Math.floor(x / CELL), gy = Math.floor(y / CELL), out: Building[] = []; for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) out.push(...(grid.get(`${gx + dx},${gy + dy}`) ?? [])); return out; };
const bagUses = (JSON.parse(fs.readFileSync('.cache/industrial/bag-uses.json', 'utf8')) as { pands: BagUsesTable }).pands;
const bagKey = (id: string) => id.replace(/^NL\.IMBAG\.Pand\./, '');

// `--explain=<osm node id>,...`: every footprint within 30 m of the node, with its distance, BAG uses and the host picked.
const explain = new Set((arg('explain') ?? '').split(',').filter(Boolean));
const placed = new Map<string, { t: RetailTemplate; at: [number, number]; front: 'street' | 'nearest'; name: string; tags: string; centre: boolean; ring: boolean }>();
const pois: Record<string, number> = {}, unhosted: Record<string, number> = {}, moved = { host: 0, nearest: 0, lost: 0, gained: 0 };
for (const n of await nodes()) {
  const tags = n.tags ?? {};
  if (Number(tags.level) > 0) continue;
  const t = templateForTags(tags);
  if (!t) continue;
  pois[t] = (pois[t] ?? 0) + 1;
  const [x, y] = local(n.lon, n.lat);
  const hit = hostOnFront(near(x, y), x, y, id => bagUses[bagKey(id)], facing, open);
  if (explain.has(String(n.id))) {
    console.log(`explain ${n.id} ${tags.name ?? ''} -> ${t} host ${hit ? `${bagKey(hit.id)} ${hit.inside ? 'inside' : 'outside'}, ${hit.front} front ${hit.distanceM.toFixed(1)} m` : 'none'}`);
    for (const c of near(x, y).map(c => ({ c, d: edgeDistM(c.ring, x, y) })).filter(v => v.d < 30).sort((a, b) => a.d - b.d)) {
      console.log(`  ${bagKey(c.c.id)} ${c.d.toFixed(1)} m ${JSON.stringify(bagUses[bagKey(c.c.id)] ?? null)}`);
      if (c.d < 8) for (const e of ringEdges(c.c.ring)) { const d = Math.hypot(...[0, 0]) + edgeDistM([[e.x0, e.y0], [e.x1, e.y1]], x, y); if (d < 12) console.log(`    wall ${e.len.toFixed(1)} m at ${d.toFixed(1)} m: street ${facing(c.c, e)} open ${open(c.c, e)}`); }
    }
  }
  const old = hostForPoi(near(x, y), x, y, id => bagUses[bagKey(id)]);
  if (old && !hit) moved.lost++; else if (!old && hit) moved.gained++; else if (old && hit && old.id !== hit.id) moved.host++;
  if (hit?.front === 'nearest') moved.nearest++;
  if (!hit) { unhosted[t] = (unhosted[t] ?? 0) + 1; continue; }
  // A chain outranks a type on one pand (an AH with a bar upstairs mapped at street level stays the AH).
  const held = placed.get(hit.id);
  if (held && RETAIL_TEMPLATES.indexOf(held.t) <= RETAIL_TEMPLATES.indexOf(t)) continue;
  const ring = Math.hypot((n.lon - DAM[0]) * KX, (n.lat - DAM[1]) * KY) / 1000 <= RING_KM;
  placed.set(hit.id, { t, at: [Math.round(n.lon * 1e6) / 1e6, Math.round(n.lat * 1e6) / 1e6], front: hit.front, name: tags.name ?? '', tags: Object.entries(tags).filter(([k]) => /^(shop|amenity|cuisine|brand|name|addr:street|addr:housenumber|bar|origin)$/.test(k)).map(([k, v]) => `${k}=${v}`).join(' '), centre: insideCentre(n.lon, n.lat), ring });
}

const rows = RETAIL_TEMPLATES.map(t => {
  const all = [...placed.values()].filter(p => p.t === t);
  return { t, pois: pois[t] ?? 0, unhosted: unhosted[t] ?? 0, pands: all.length, ring: all.filter(p => p.ring).length, centre: all.filter(p => p.centre).length };
});
console.log('template        POIs  unhosted  pands  ring(<=' + RING_KM + 'km Dam)  centre(Singelgracht)');
for (const r of rows) console.log(`${r.t.padEnd(14)} ${String(r.pois).padStart(5)} ${String(r.unhosted).padStart(9)} ${String(r.pands).padStart(6)} ${String(r.ring).padStart(8)} ${String(r.centre).padStart(8)}`);
// The named hosting regressions (retailGround.test.ts): each node's candidates within 30 m, rings in local metres
// around the node, and each wall's street/open reading, so the test runs hostOnFront without the city.
const REGRESSIONS: Record<string, string> = { '2809217417': 'Kinkerstraat 252-H, MapFour (bike)', '2809219299': 'Kinkerstraat 288, Cycle (bike)', '5198582619': 'Nieuwe Hemweg 11, AH to go at a BP station: its front, not the car wash' };
if (process.argv.includes('--fixture')) {
  const cases = [];
  for (const n of await nodes()) {
    if (!REGRESSIONS[String(n.id)]) continue;
    const [x, y] = local(n.lon, n.lat), cands = near(x, y).filter(c => edgeDistM(c.ring, x, y) < 30 || insideRingOf(c.ring, x, y));
    const hit = hostOnFront(cands, x, y, id => bagUses[bagKey(id)], facing, open);
    cases.push({ node: n.id, what: REGRESSIONS[String(n.id)], expect: hit && { pand: bagKey(hit.id), front: hit.front },
      candidates: cands.map(c => ({ id: bagKey(c.id), uses: bagUses[bagKey(c.id)] ?? null, ring: c.ring.map(([px, py]) => [+(px - x).toFixed(2), +(py - y).toFixed(2)]), street: ringEdges(c.ring).map(e => facing(c, e)), open: ringEdges(c.ring).map(e => open(c, e)) })) });
  }
  fs.writeFileSync('data/retail-ground/hosting-regressions.json', JSON.stringify({ note: 'scripts/retail-ground/build-templates.ts --fixture; node at the origin, metres east/north', cases }, null, 1));
  console.log(`fixture: ${cases.length} regressions -> data/retail-ground/hosting-regressions.json`);
}
console.log(`hosting vs shopGate.hostForPoi: ${moved.host} on another pand, ${moved.lost} dropped, ${moved.gained} gained; ${moved.nearest} fronts on the node's nearest open wall (no street wall within ${6} m)`);
const samples = Number(arg('samples') ?? 0);
if (samples) {
  let seed = 7; const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  for (const t of RETAIL_TEMPLATES) {
    const all = [...placed].filter(([, p]) => p.t === t), pick = all.map(v => [rnd(), v] as const).sort((a, b) => a[0] - b[0]).slice(0, samples).map(v => v[1]);
    for (const [id, p] of pick) console.log(`sample ${t} ${bagKey(id)} ${p.at.join(',')} ${p.tags}`);
  }
}
const out = { version: 1, source: '© OpenStreetMap contributors (ODbL), Overpass ' + new Date(fs.statSync(CACHE).mtime).toISOString().slice(0, 10), templates: [...RETAIL_TEMPLATES], buildings: Object.fromEntries([...placed].sort().map(([id, p]) => [id, [RETAIL_TEMPLATES.indexOf(p.t), p.at[0], p.at[1], ...(TEMPLATE_LOOKS[p.t].word === 'name' && signWord(p.name) ? [signWord(p.name)] : p.front === 'nearest' ? [''] : []), ...(p.front === 'nearest' ? [1] : [])]])) };
fs.mkdirSync(path.dirname(STAGING), { recursive: true });
fs.writeFileSync(STAGING, JSON.stringify(out));
console.log(`staged ${placed.size} pands -> ${STAGING} (${(fs.statSync(STAGING).size / 1024).toFixed(0)} KB)`);
if (process.argv.includes('--publish')) { fs.copyFileSync(STAGING, PUBLISHED); console.log(`published -> ${PUBLISHED}`); }

function edgeDistM(ring: [number, number][], x: number, y: number): number {
  let best = Infinity;
  for (let i = 0; i + 1 < ring.length; i++) { const [ax, ay] = ring[i], [bx, by] = ring[i + 1], dx = bx - ax, dy = by - ay, l = dx * dx + dy * dy, t = l ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / l)) : 0; best = Math.min(best, Math.hypot(x - ax - dx * t, y - ay - dy * t)); }
  return best;
}
