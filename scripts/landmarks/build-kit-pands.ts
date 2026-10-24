/**
 * Locate every landmark kit's OSM-only parts and join each to its BAG pand (GitHub #37, kit review round 3).
 *
 *   node --max-old-space-size=8192 --import tsx scripts/landmarks/build-kit-pands.ts [--publish]
 *
 * Kit parts that are BAG pands (or OSM aliases of one) already resolve through the base tiles. The rest are OSM-only
 * features in bag-tiles/14: this reads their outline and z14 tile there, then the 3DBAG CityJSON cache
 * (.cache/3dbag/<version>/tiles) for the pands under them (src/canalRecall/kitPands.ts pickKitPand); a part outside the
 * cached 3DBAG (schools in Zaanstad, Haarlemmermeer, Landsmeer) falls back to the cached BAG WFS z16 tiles
 * (.cache/bag-wfs, written by scripts/survey-bag-gaps.ts), loaded only for the tiles round such a part. Writes a
 * staging file and a report; --publish writes public/data/extracts/amsterdam/kit-pands.json, which
 * scripts/landmarks/kit-sheets.ts reads for the sheet location and the photo pand.
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { KITS, kitIds } from '../../src/canalRecall/landmarkKits.ts';
import { addFeatures, emptyIndex, nearbyPands, outerRings, resolveSuppressed } from '../../src/canalRecall/bagPandIndex.ts';
import { BAG3D_VERSION } from '../../src/canalRecall/bag3dTiles.ts';
import { readBagBuildings, type CityJson } from '../../src/canalRecall/bag3dCityJson.ts';
import { ringCentroid, type Ring } from '../../src/canalRecall/buildingLadder.ts';
import { pickKitPand } from '../../src/canalRecall/kitPands.ts';

const ROOT = path.resolve(import.meta.dirname, '../..');
const EXTRACTS = path.join(ROOT, 'public/data/extracts/amsterdam');
const OUT = path.join(EXTRACTS, 'kit-pands.json');
const STAGING = path.join(ROOT, 'tmp/kit-pands/kit-pands.staging.json');
const r6 = (v: number) => Math.round(v * 1e6) / 1e6;

// 1. Base tiles: the pand index (what already resolves) and the OSM-only outlines with their tile.
const tileIndex = emptyIndex();
const osmOnly = new Map<string, { rings: Ring[]; tile: string }>();
const tilesDir = path.join(EXTRACTS, 'bag-tiles/14');
for (const x of fs.readdirSync(tilesDir).filter(n => /^\d+$/.test(n))) {
  for (const file of fs.readdirSync(path.join(tilesDir, x)).filter(n => n.endsWith('.geojson.gz'))) {
    const features = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(tilesDir, x, file))).toString('utf8')).features;
    addFeatures(tileIndex, features);
    for (const f of features) {
      const id = String(f.properties?.id ?? '');
      if (id && !id.startsWith('NL.') && !osmOnly.has(id)) osmOnly.set(id, { rings: outerRings(f.geometry), tile: `${x}/${file.replace('.geojson.gz', '')}` });
    }
  }
}

// 2. The OSM-only parts the kits use.
const wanted = new Map<string, string[]>(); // osm id -> kit names
const unlocated: string[] = [];
for (const kit of KITS) {
  const r = resolveSuppressed(tileIndex, kitIds(kit));
  for (const id of r.osmOnly) wanted.set(id, [...(wanted.get(id) ?? []), kit.name]);
  for (const id of r.unresolved) unlocated.push(`${kit.name}: ${id}`);
}
let w = Infinity, s = Infinity, e = -Infinity, n = -Infinity;
for (const id of wanted.keys()) for (const ring of osmOnly.get(id)!.rings) for (const [x, y] of ring) { w = Math.min(w, x); e = Math.max(e, x); s = Math.min(s, y); n = Math.max(n, y); }

// 3. 3DBAG footprints over the parts' extent.
const bag = emptyIndex();
const cache = path.join(ROOT, '.cache/3dbag', BAG3D_VERSION, 'tiles');
let bagCount = 0;
for (const name of fs.readdirSync(cache).filter(f => f.endsWith('.city.json.gz')).sort()) {
  const city = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(cache, name))).toString('utf8')) as CityJson;
  const features = readBagBuildings(city).filter(b => b.rings[0]?.some(([x, y]) => x > w - 0.001 && x < e + 0.001 && y > s - 0.001 && y < n + 0.001))
    .map(b => ({ properties: { id: b.bagId }, geometry: { type: 'Polygon', coordinates: [b.rings[0]] } }));
  bagCount += features.length;
  addFeatures(bag, features);
}

// 4. Join.
type Entry = { tile: string; centre: [number, number]; areaM2: number; pand: string | null; source?: '3dbag' | 'bag-wfs'; share?: number; pandShare?: number; others?: string[]; kits: string[] };
const wfsDir = path.join(ROOT, '.cache/bag-wfs'), wfs = emptyIndex(), wfsLoaded = new Set<string>();
const wfsAround = (x: number, y: number) => {
  const n = 2 ** 16, tx = Math.floor((x + 180) / 360 * n), ty = Math.floor((1 - Math.asinh(Math.tan(y * Math.PI / 180)) / Math.PI) / 2 * n);
  for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
    const file = path.join(wfsDir, `16-${tx + dx}-${ty + dy}.json.gz`);
    if (wfsLoaded.has(file) || !fs.existsSync(file)) continue;
    wfsLoaded.add(file);
    const features = JSON.parse(zlib.gunzipSync(fs.readFileSync(file)).toString('utf8')) as { properties: { identificatie: string }; geometry: { type: string; coordinates: unknown } }[];
    addFeatures(wfs, features.filter(f => f.geometry?.type === 'Polygon').map(f => ({ properties: { id: `NL.IMBAG.Pand.${f.properties.identificatie}` }, geometry: f.geometry })));
  }
};
const ids: Record<string, Entry> = {};
let matched = 0;
for (const [id, kits] of [...wanted].sort(([a], [b]) => a.localeCompare(b))) {
  const { rings, tile } = osmOnly.get(id)!;
  const [cx, cy] = ringCentroid(rings[0]);
  let pw = Infinity, ps = Infinity, pe = -Infinity, pn = -Infinity;
  for (const [x, y] of rings[0]) { pw = Math.min(pw, x); pe = Math.max(pe, x); ps = Math.min(ps, y); pn = Math.max(pn, y); }
  const box = { w: pw, s: ps, e: pe, n: pn }, short = (p: { id: string; rings: Ring[] }) => ({ pand: p.id.replace('NL.IMBAG.Pand.', ''), rings: p.rings });
  let match = pickKitPand(rings, nearbyPands(bag, box).map(short)), source: Entry['source'] = '3dbag';
  if (!match) { wfsAround(cx, cy); match = pickKitPand(rings, nearbyPands(wfs, box).map(short)); source = 'bag-wfs'; }
  if (match) matched++;
  const kx = 111_320 * Math.cos(cy * Math.PI / 180), ky = 110_540;
  let area = 0;
  for (let i = 0, ring = rings[0], j = ring.length - 1; i < ring.length; j = i++) area += (ring[j][0] * kx) * (ring[i][1] * ky) - (ring[i][0] * kx) * (ring[j][1] * ky);
  ids[id] = { tile, centre: [r6(cx), r6(cy)], areaM2: Math.round(Math.abs(area / 2)), pand: match?.pand ?? null, ...(match ? { source, share: match.share, pandShare: match.pandShare, ...(match.others.length ? { others: match.others } : {}) } : {}), kits };
}
const out = { version: 1, source: 'scripts/landmarks/build-kit-pands.ts: OSM-only kit parts in bag-tiles/14 joined to 3DBAG ' + BAG3D_VERSION, ids, unlocated };
fs.mkdirSync(path.dirname(STAGING), { recursive: true });
fs.writeFileSync(STAGING, JSON.stringify(out, null, 1) + '\n');
console.log(`3DBAG pands in extent ${bagCount}; OSM-only kit parts ${wanted.size}, joined to a pand ${matched}, no pand ${wanted.size - matched}; ids in no tile ${unlocated.length}`);
for (const [id, v] of Object.entries(ids)) if (!v.pand) console.log(`  no pand: ${id} (${v.kits.join(', ')}) at ${v.centre.join(',')}`);
if (process.argv.includes('--publish')) { fs.writeFileSync(OUT, JSON.stringify(out) + '\n'); console.log(`published ${path.relative(ROOT, OUT)}`); }
else console.log(`staged ${path.relative(ROOT, STAGING)} (use --publish to write ${path.relative(ROOT, OUT)})`);
