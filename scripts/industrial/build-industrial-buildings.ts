// The industrial table (lane industrial-kit 2026-11-10): classify every building in the extract's building tiles as
// tank / silo / shed / office / none (src/canalRecall/industrial/industrialClass.ts) from open data, and count what
// the generic grammar draws for them today.
//
//   npx tsx scripts/industrial/build-industrial-buildings.ts [--publish] [--no-draw]
//
// Inputs (fetch first):
//   .cache/industrial/ind.geojsonseq   osmium tags-filter + export -u type_id of the Amsterdam OSM extract:
//                                      man_made=storage_tank,silo,gasometer,tank; building=warehouse,industrial,hangar,
//                                      storage_tank,silo,manufacture,factory,...; landuse=industrial,port
//   .cache/industrial/bag-uses.json    scripts/industrial/fetch-bag-uses.ts (BAG WFS, gebruiksdoel per pand)
//   building-tiles, building-facts, landmark-buildings.json, kit-pands.json under the extract;
//   the buurten geojson from map-recall2-source-data (stadsdeel = first letter of the buurt code).
// Writes artifacts/industrial/staging/industrial-buildings.json and summary.json; --publish copies the table into
// the extract (public/data/extracts/amsterdam/industrial-buildings.json).
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { classifyIndustrial, ringRoundness, type IndustrialFacts, type IndustrialKind } from '../../src/canalRecall/industrial/industrialClass.ts';
import { INDUSTRIAL_FILE, type IndustrialTable } from '../../src/canalRecall/industrial/industrialTable.ts';
import { BUILDING_TYPES, shortBuildingId } from '../../src/canalRecall/buildingFacts.ts';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const EXTRACT = path.join(ROOT, 'public/data/extracts/amsterdam');
const CACHE = path.join(ROOT, '.cache/industrial');
const STAGE = path.join(ROOT, 'artifacts/industrial/staging');
const BUURTEN = process.env.MAP_RECALL_SOURCE_DATA ?? '/Users/blackmad/Code/map-recall2-source-data';
const args = new Set(process.argv.slice(2));

type Ring = number[][];
const KX = 111_320 * Math.cos(52.37 * Math.PI / 180), KY = 110_540;
const toLocal = (r: Ring) => r.map(([lng, lat]) => [lng * KX, lat * KY]);
const outerRings = (g: any): Ring[] => !g ? [] : g.type === 'Polygon' ? [g.coordinates[0]] : g.type === 'MultiPolygon' ? g.coordinates.map((p: Ring[]) => p[0]) : [];
const centroid = (r: Ring): [number, number] => { let x = 0, y = 0; const n = r.length - (r[0][0] === r[r.length - 1][0] && r[0][1] === r[r.length - 1][1] ? 1 : 0); for (let i = 0; i < n; i++) { x += r[i][0]; y += r[i][1]; } return [x / n, y / n]; };
function inRing(p: [number, number], r: Ring): boolean {
  let inside = false;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const [xi, yi] = r[i], [xj, yj] = r[j];
    if ((yi > p[1]) !== (yj > p[1]) && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
/** A bbox grid of polygons for point lookups. */
class PolyIndex<T> {
  cells = new Map<string, { rings: Ring[]; box: number[]; v: T }[]>();
  constructor(private size = 0.01) {}
  add(rings: Ring[], v: T) {
    const xs = rings.flat().map(p => p[0]), ys = rings.flat().map(p => p[1]);
    const box = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)], item = { rings, box, v };
    for (let x = Math.floor(box[0] / this.size); x <= Math.floor(box[2] / this.size); x++) for (let y = Math.floor(box[1] / this.size); y <= Math.floor(box[3] / this.size); y++) {
      const k = `${x},${y}`; (this.cells.get(k) ?? this.cells.set(k, []).get(k)!).push(item);
    }
  }
  at(p: [number, number]): T[] {
    const out: T[] = [];
    for (const it of this.cells.get(`${Math.floor(p[0] / this.size)},${Math.floor(p[1] / this.size)}`) ?? []) {
      if (p[0] < it.box[0] || p[0] > it.box[2] || p[1] < it.box[1] || p[1] > it.box[3]) continue;
      if (it.rings.some(r => inRing(p, r))) out.push(it.v);
    }
    return out;
  }
}

// ---------------------------------------------------------------- OSM
const osmByBag = new Map<string, Record<string, string>>(), osmByWay = new Map<string, Record<string, string>>();
const manMade = new PolyIndex<string>(), landuse = new PolyIndex<string>(0.02);
let osmCounts: Record<string, number> = {};
for (const line of fs.readFileSync(path.join(CACHE, 'ind.geojsonseq'), 'utf8').split('\n')) {
  const s = line.replace(/^\x1e/, '').trim();
  if (!s) continue;
  const f = JSON.parse(s), p = f.properties ?? {}, g = f.geometry;
  if (!g || (g.type !== 'Polygon' && g.type !== 'MultiPolygon')) continue;
  const rings = outerRings(g);
  if (p.building) {
    if (p['ref:bag']) osmByBag.set(String(p['ref:bag']).padStart(16, '0'), p);
    if (typeof f.id === 'string') osmByWay.set(f.id.replace(/^a/, 'w'), p);
  }
  if (p.man_made && ['storage_tank', 'silo', 'gasometer', 'tank'].includes(p.man_made)) { manMade.add(rings, p.man_made); osmCounts[`man_made=${p.man_made}`] = (osmCounts[`man_made=${p.man_made}`] ?? 0) + 1; }
  if (p.landuse === 'industrial' || p.landuse === 'port') landuse.add(rings, p.landuse);
}
// osmium's type_id ids: w123 for ways, a<2n> areas; keep the way form for building ways.

// ---------------------------------------------------------------- BAG uses, landmarks, buurten
const bag = JSON.parse(fs.readFileSync(process.argv.find(a => a.startsWith('--bag='))?.slice(6) ?? path.join(CACHE, 'bag-uses.json'), 'utf8')) as { pands: Record<string, { vbos: number; area: Record<string, number> }> };
const landmarkIds = new Set<string>();
for (const list of Object.values<string[]>(JSON.parse(fs.readFileSync(path.join(EXTRACT, 'landmark-buildings.json'), 'utf8')).buildings ?? {})) for (const id of list) landmarkIds.add(String(id));
for (const id of Object.keys(JSON.parse(fs.readFileSync(path.join(EXTRACT, 'kit-pands.json'), 'utf8')).ids ?? {})) landmarkIds.add(id);
const buurten = new PolyIndex<string>(0.02);
for (const f of JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(BUURTEN, 'datasets/gebieden-buurten-20261016/buurten.geojson.gz'))).toString()).features) buurten.add(outerRings(f.geometry), String(f.properties.code ?? ''));
const STADSDELEN: Record<string, string> = { A: 'Centrum', B: 'Westpoort', E: 'West', F: 'Nieuw-West', K: 'Zuid', M: 'Oost', N: 'Noord', T: 'Zuidoost', S: 'Weesp' };

// ---------------------------------------------------------------- buildings
const tilesDir = path.join(EXTRACT, 'building-tiles/14');
const tiles = fs.readdirSync(tilesDir).flatMap(x => fs.readdirSync(path.join(tilesDir, x)).map(y => `${x}/${y.replace('.geojson.gz', '')}`));
const pandOf = (id: string) => /NL\.IMBAG\.Pand\.(\d{16})/.exec(id)?.[1];
type Row = { id: string; tile: string; kind: IndustrialKind | null; why: string; stadsdeel: string; areaM2: number; heightM: number; at: [number, number]; year: number | null; osm?: string };
const rows: Row[] = [];
const factsCache = new Map<string, Record<string, number[]>>();
const factsFor = (tile: string) => {
  if (!factsCache.has(tile)) {
    const f = path.join(EXTRACT, `building-facts/14/${tile}.json.gz`);
    factsCache.set(tile, fs.existsSync(f) ? JSON.parse(zlib.gunzipSync(fs.readFileSync(f)).toString()).buildings ?? {} : {});
  }
  return factsCache.get(tile)!;
};
const seen = new Set<string>();
for (const tile of tiles) {
  const fc = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(tilesDir, `${tile}.geojson.gz`))).toString());
  const facts = factsFor(tile);
  for (const f of fc.features ?? []) {
    const id = String(f.properties?.id ?? '');
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const rings = outerRings(f.geometry);
    if (!rings.length) continue;
    const big = rings.reduce((a, r) => (r.length > a.length ? r : a));
    const shape = ringRoundness(toLocal(big));
    const areaM2 = rings.reduce((s, r) => s + ringRoundness(toLocal(r)).areaM2, 0);
    const at = centroid(big);
    const pand = pandOf(id);
    const osm = pand ? osmByBag.get(pand) : osmByWay.get(id);
    const row = facts[shortBuildingId(id)];
    const year = row && row[0] >= 1200 && row[0] <= 2030 ? row[0] : null;
    const typeName = row && row[1] >= 0 ? BUILDING_TYPES[row[1]] : undefined;
    const mm = manMade.at(at)[0];
    const facts2: IndustrialFacts = {
      id, heightM: Number(f.properties.height) || 0, minHeightM: Number(f.properties.minHeight) || 0, areaM2, roundness: shape.roundness, vertices: shape.vertices, year,
      osmBuilding: osm?.building ?? typeName, manMade: osm?.man_made ?? mm, industrialLand: landuse.at(at).length > 0,
      uses: pand ? bag.pands[pand]?.area : undefined, vbos: pand ? bag.pands[pand]?.vbos : undefined, landmark: landmarkIds.has(id) || (pand ? landmarkIds.has(`NL.IMBAG.Pand.${pand}`) : false),
    };
    const v = classifyIndustrial(facts2);
    const code = buurten.at(at)[0] ?? '';
    rows.push({ id, tile, kind: v.kind, why: v.why, stadsdeel: STADSDELEN[code[0]] ?? (code ? code[0] : 'outside'), areaM2: Math.round(areaM2), heightM: facts2.heightM, at: [+at[0].toFixed(6), +at[1].toFixed(6)], year, osm: [facts2.osmBuilding && `building=${facts2.osmBuilding}`, facts2.manMade && `man_made=${facts2.manMade}`].filter(Boolean).join(' ') || undefined });
  }
}

// ---------------------------------------------------------------- what the grammar draws today (optional)
type Draw = { windows: boolean; shop: boolean; largeTier: boolean; bare: boolean };
const draws = new Map<string, Draw>();
if (!args.has('--no-draw')) {
  const { gameChain, loadTile } = await import('../world/pipeline.ts');
  const { meshBuildingFor } = await import('../../src/canalRecall/threeBuildingFeatures.ts');
  const { BAY_ENTRIES } = await import('../../src/canalRecall/bayLook.ts');
  const chain = gameChain();
  const want = new Set(rows.filter(r => r.kind).map(r => r.id));
  const wantTiles = [...new Set(rows.filter(r => r.kind).map(r => r.tile))];
  for (const tile of wantTiles) {
    for (const r of await loadTile(tile, chain)) {
      const id = String(r.styled.properties.id ?? '');
      if (!want.has(id)) continue;
      const b = meshBuildingFor(r.styled as any, 'storybook');
      if (!b) continue;
      const ground = b.layers ? BAY_ENTRIES[b.layers.ground] : undefined;
      draws.set(id, { bare: !!b.bare, windows: !b.bare && !b.plainWalls, shop: !b.bare && !b.plainWalls && (!!b.shopfront || (!!ground && ground.kind !== 'ground' && ground.kind !== 'groundDoor')), largeTier: !!r.styled.properties.largeTier });
    }
  }
}

// ---------------------------------------------------------------- outputs
const kinds: IndustrialKind[] = ['tank', 'silo', 'shed', 'works', 'office'];
const byKind: Record<string, number> = {}, byStadsdeel: Record<string, Record<string, number>> = {}, drawn: Record<string, Record<string, number>> = {}, area: Record<string, number> = {};
const why: Record<string, Record<string, number>> = {};
for (const r of rows) {
  if (!r.kind) continue;
  byKind[r.kind] = (byKind[r.kind] ?? 0) + 1;
  area[r.kind] = (area[r.kind] ?? 0) + r.areaM2;
  (byStadsdeel[r.stadsdeel] ??= {})[r.kind] = (byStadsdeel[r.stadsdeel][r.kind] ?? 0) + 1;
  const reason = r.why.replace(/[\d.]+ ?(%|m2|m)/g, 'n$1').replace(/\(q n\)/, '').replace(/built n/, 'built');
  (why[r.kind] ??= {})[reason] = (why[r.kind][reason] ?? 0) + 1;
  const d = draws.get(r.id);
  if (d) {
    const k = (drawn[r.kind] ??= { total: 0, windows: 0, shopfront: 0, largeTier: 0, bare: 0 });
    k.total++; if (d.windows) k.windows++; if (d.shop) k.shopfront++; if (d.largeTier) k.largeTier++; if (d.bare) k.bare++;
  }
}
const table: IndustrialTable = { version: 1, source: 'scripts/industrial/build-industrial-buildings.ts: OSM (Geofabrik Amsterdam 2026-08-28) man_made/building/landuse + BAG WFS gebruiksdoel + building-tiles footprints', ids: Object.fromEntries(rows.filter(r => r.kind).map(r => [r.id, r.kind!])) };
fs.mkdirSync(STAGE, { recursive: true });
fs.writeFileSync(path.join(STAGE, INDUSTRIAL_FILE), JSON.stringify(table));
const misses: Record<string, number> = {};
for (const r of rows) if (!r.kind && r.stadsdeel === 'Westpoort' && r.areaM2 >= 1000) { const k = r.why.replace(/[\d.]+/g, 'n'); misses[k] = (misses[k] ?? 0) + 1; }
const summary = { westpoortLargeMisses: misses, buildings: rows.length, osm: osmCounts, byKind, areaM2: area, byStadsdeel, why, drawnToday: drawn, samples: Object.fromEntries(kinds.map(k => [k, rows.filter(r => r.kind === k).sort((a, b) => b.areaM2 - a.areaM2).slice(0, 12)])) };
fs.writeFileSync(path.join(STAGE, 'summary.json'), JSON.stringify(summary, null, 1));
fs.writeFileSync(path.join(STAGE, 'rows.json'), JSON.stringify(rows.filter(r => r.kind)));
console.log(JSON.stringify({ buildings: rows.length, byKind, areaM2: area, byStadsdeel, drawnToday: drawn }, null, 1));
if (args.has('--publish')) { fs.copyFileSync(path.join(STAGE, INDUSTRIAL_FILE), path.join(EXTRACT, INDUSTRIAL_FILE)); console.log(`published ${INDUSTRIAL_FILE}`); }
