// The city as build-templates.ts hosts shops on it (round 7: shared with second-sources.ts): the OSM shop/amenity
// nodes (Overpass, cached), the ground footprints from the building tiles in local metres, the street-facing and
// open-wall tests and the BAG uses. Loading it reads every building tile (a few seconds).
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { type BagUsesTable } from '../../src/canalRecall/shopGate.ts';
import { ringEdges } from '../../src/canalRecall/retailHosting.ts';
import { FRONT_HIGHWAYS, SegmentGrid, streetDistance } from '../../src/canalRecall/streetFronts.ts';

const arg = (n: string) => process.argv.find(a => a.startsWith(`--${n}=`))?.slice(n.length + 3);
export const CACHE = arg('cache') ?? '.cache/retail-ground/overpass.json';
const BBOX = '52.28,4.75,52.43,5.05';
const QUERY = `[out:json][timeout:180];(node["shop"](${BBOX});node["amenity"~"^(cafe|restaurant|bar|pub|fast_food|ice_cream|pharmacy|bank)$"](${BBOX}););out;`;

export type Node = { id: number; lat: number; lon: number; tags?: Record<string, string> };
export async function nodes(): Promise<Node[]> {
  if (fs.existsSync(CACHE)) return JSON.parse(fs.readFileSync(CACHE, 'utf8')).elements;
  const r = await fetch('https://overpass-api.de/api/interpreter', { method: 'POST', body: new URLSearchParams({ data: QUERY }), headers: { 'User-Agent': 'map-recall2 retail-ground (https://github.com/blackmad/map-recall2)' } });
  const json = await r.json();
  fs.mkdirSync(path.dirname(CACHE), { recursive: true }); fs.writeFileSync(CACHE, JSON.stringify(json));
  return json.elements;
}

export const LAT0 = 52.37, KX = 111_320 * Math.cos(LAT0 * Math.PI / 180), KY = 110_540, CELL = 50;
export const local = (lng: number, lat: number): [number, number] => [(lng - 4.9) * KX, (lat - LAT0) * KY];
export type Building = { id: string; ring: [number, number][]; cx: number; cy: number; owner: number };
const wallSegs: number[] = [], wallOwners: number[] = [];
let owners = 0;
export const grid = new Map<string, Building[]>();
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
export const streets = new SegmentGrid(Float32Array.from(streetSegs)), walls = new SegmentGrid(Float32Array.from(wallSegs), 25, Int32Array.from(wallOwners));
export const facing = (c: { owner?: number }, e: ReturnType<typeof ringEdges>[number]) => streetDistance(e, streets, walls, (c as Building).owner) < Infinity;
// Not a party wall: no other footprint's wall within 1 m straight in front of its middle.
export const open = (c: { owner?: number }, e: ReturnType<typeof ringEdges>[number]) => walls.firstHit((e.x0 + e.x1) / 2 - e.nx * 0.05, (e.y0 + e.y1) / 2 - e.ny * 0.05, e.nx, e.ny, 1.05, (c as Building).owner) === Infinity;
export const near = (x: number, y: number) => { const gx = Math.floor(x / CELL), gy = Math.floor(y / CELL), out: Building[] = []; for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) out.push(...(grid.get(`${gx + dx},${gy + dy}`) ?? [])); return out; };
export const bagUses = (JSON.parse(fs.readFileSync('.cache/industrial/bag-uses.json', 'utf8')) as { pands: BagUsesTable }).pands;
export const bagKey = (id: string) => id.replace(/^NL\.IMBAG\.Pand\./, '');
