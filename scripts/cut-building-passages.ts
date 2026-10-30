/**
 * Cut the roads that pass through buildings at street level out of the city
 * tiles (src/canalRecall/buildingPassages.ts): every ridden OSM way tagged
 * `tunnel=building_passage` or `covered=yes`, through every tile feature that
 * stands on the ground, becomes ground pieces either side and a deck over the
 * strip (`passage:<id>:<i>` features, the original id in `pand`).
 *
 * Jan van Zutphenstraat runs under the north ends of four towers; the towers
 * are their OSM outlines at their AHN height (measure-guessed-heights.ts).
 *
 *   node --import tsx scripts/cut-building-passages.ts           # stage scripts/data/passages/, report
 *   node --import tsx scripts/cut-building-passages.ts --write   # also replace the features in building-tiles and bag-tiles
 *   node --import tsx scripts/cut-building-passages.ts --check   # exit 1 unless the staged pieces are in both tile sets
 *
 * The ways come from the OSM cache (.cache/osm-source/Amsterdam.osm.pbf, osmium)
 * and are staged in scripts/data/passages/passage-ways.geojson, so --write and
 * --check run without it. Buildings a placed model hides (covers.json) are left
 * whole: the model draws them. Re-run --write after a full tile rebuild.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import type { MultiPolygon } from 'polygon-clipping';
import { isPassageRoad, passageClearanceM, passagePieces, passageWidthM, RIDDEN_HIGHWAYS, roadStrip, type PassageStrip } from '../src/canalRecall/buildingPassages';
import { centrelineInsideM } from '../src/canalRecall/undergroundBuildings';
import { fullPandId } from '../src/canalRecall/bagTiles';
import { tileFor, tileKey } from '../src/canalRecall/slippyTiles';

type LngLat = [number, number];
type Feature = { type: 'Feature'; properties: Record<string, unknown>; geometry: { type: string; coordinates: unknown } };
const write = process.argv.includes('--write'), check = process.argv.includes('--check');
const ROOT = path.join('public', 'data', 'extracts', 'amsterdam');
const STAGE = path.join('scripts', 'data', 'passages');
const WAYS = path.join(STAGE, 'passage-ways.geojson'), PIECES = path.join(STAGE, 'passage-pieces.geojson');
// The whole features a --write replaced, so a re-run cuts them again instead of finding nothing to cut.
const ORIGINALS = path.join(STAGE, 'passage-originals.geojson');
/** bag-tiles keys building-tiles does not carry. */
const BAG_ONLY = new Set(['eaves', 'ridge', 'roof', 'year', 'osm', 'replaces']);
const PBF = path.join('.cache', 'osm-source', 'Amsterdam.osm.pbf');
/** A way counts as passing through a feature when this much of it runs this far inside. */
const MIN_INSIDE_M = 2, INSIDE_INSET_M = 0.5;
/** Features already lifted this far are ridden under as they are. */
const RIDE_UNDER_M = 2.5;
const r6 = (v: number) => Math.round(v * 1e6) / 1e6;
const tilePath = (dir: string, key: string) => path.join(ROOT, dir, `${key}.geojson.gz`);
const readTile = (file: string): { features: Feature[] } => JSON.parse(zlib.gunzipSync(fs.readFileSync(file)).toString());
const writeTile = (file: string, features: Feature[]) => fs.writeFileSync(file, zlib.gzipSync(`{"type":"FeatureCollection","features":[\n${features.map(f => JSON.stringify(f)).join(',\n')}\n]}\n`));
const polygonsOf = (g: Feature['geometry']): MultiPolygon => (g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : []) as MultiPolygon;
const centreOf = (mp: MultiPolygon): LngLat => { const r = mp[0][0]; return [r.reduce((a, p) => a + p[0], 0) / r.length, r.reduce((a, p) => a + p[1], 0) / r.length]; };

// ---- ways ------------------------------------------------------------------------------------------------------
if (!check && fs.existsSync(PBF)) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'passages-'));
  execFileSync('osmium', ['tags-filter', '-O', '-o', path.join(tmp, 'p.osm.pbf'), PBF, 'w/tunnel=building_passage', 'w/covered=yes']);
  execFileSync('osmium', ['export', '-O', '-f', 'geojsonseq', '-o', path.join(tmp, 'p.geojsonseq'), path.join(tmp, 'p.osm.pbf')]);
  const ways: Feature[] = [];
  for (const raw of fs.readFileSync(path.join(tmp, 'p.geojsonseq'), 'utf8').split('\n')) {
    if (!raw.trim()) continue;
    const f = JSON.parse(raw.replace(/^\u001e/, '')) as Feature & { id?: string };
    if (f.geometry?.type !== 'LineString' || !RIDDEN_HIGHWAYS.has(String(f.properties.highway)) || !isPassageRoad(f.properties)) continue;
    const keep = Object.fromEntries(['highway', 'name', 'tunnel', 'covered', 'width', 'est_width', 'layer'].flatMap(k => f.properties[k] !== undefined ? [[k, f.properties[k]]] : []));
    ways.push({ type: 'Feature', properties: { id: String(f.id ?? ''), ...keep }, geometry: { type: 'LineString', coordinates: (f.geometry.coordinates as LngLat[]).map(([x, y]) => [r6(x), r6(y)]) } });
  }
  fs.rmSync(tmp, { recursive: true, force: true });
  fs.mkdirSync(STAGE, { recursive: true });
  fs.writeFileSync(WAYS, `{"type":"FeatureCollection","features":[\n${ways.map(f => JSON.stringify(f)).join(',\n')}\n]}\n`);
}

if (check) {
  const pieces = (JSON.parse(fs.readFileSync(PIECES, 'utf8')) as { features: Feature[] }).features;
  const want = new Map<string, Set<string>>();
  for (const p of pieces) { const k = tileKey(tileFor(...centreOf(polygonsOf(p.geometry)), 14)); if (!want.has(k)) want.set(k, new Set()); want.get(k)!.add(String(p.properties.id)); }
  const cut = new Set(pieces.map(p => String(p.properties.pand)));
  const problems: string[] = [];
  for (const dir of ['bag-tiles', 'building-tiles']) for (const [key, ids] of want) {
    const features = readTile(tilePath(dir, key)).features, have = new Set(features.map(f => String(f.properties.id)));
    for (const id of ids) if (!have.has(id)) problems.push(`${dir}/${key}: ${id} missing`);
    for (const f of features) if (cut.has(String(f.properties.id))) problems.push(`${dir}/${key}: ${f.properties.id} still drawn whole over its passage`);
  }
  // Named sites (2026-10-30): each building is cut, with a deck over its passage, at its measured height.
  const NAMED: { id: string; place: string; minTop: number; maxTop: number }[] = [
    { id: 'w1313016958', place: 'Jan van Zutphenstraat tower (north end over the path)', minTop: 30, maxTop: 40 },
    { id: 'w280838829', place: 'Motorwal flats over the street', minTop: 9, maxTop: 15 },
    { id: 'w478502467', place: 'Berchvliet shops over the street', minTop: 15, maxTop: 20 },
  ];
  for (const n of NAMED) {
    const mine = pieces.filter(p => p.properties.pand === n.id), deck = mine.find(p => Number(p.properties.minHeight) > 0);
    if (!deck) problems.push(`${n.place}: ${n.id} has no deck over its passage`);
    else if (Number(deck.properties.height) < n.minTop || Number(deck.properties.height) > n.maxTop) problems.push(`${n.place}: top ${deck.properties.height} m outside ${n.minTop}-${n.maxTop}`);
  }
  console.log(`building passages: ${pieces.length} pieces of ${cut.size} buildings; ${problems.length} problems`);
  for (const p of problems.slice(0, 20)) console.log(`  ${p}`);
  process.exit(problems.length ? 1 : 0);
}

const ways = (JSON.parse(fs.readFileSync(WAYS, 'utf8')) as { features: Feature[] }).features;
const CELL = 0.002, grid = new Map<string, Feature[]>();
for (const w of ways) {
  const line = w.geometry.coordinates as LngLat[];
  const xs = line.map(p => p[0]), ys = line.map(p => p[1]);
  for (let x = Math.floor(Math.min(...xs) / CELL); x <= Math.floor(Math.max(...xs) / CELL); x++)
    for (let y = Math.floor(Math.min(...ys) / CELL); y <= Math.floor(Math.max(...ys) / CELL); y++) { const k = `${x},${y}`; if (!grid.has(k)) grid.set(k, []); grid.get(k)!.push(w); }
}
const waysThrough = (mp: MultiPolygon): Feature[] => {
  let w = Infinity, s = Infinity, e = -Infinity, n = -Infinity;
  for (const poly of mp) for (const [x, y] of poly[0]) { w = Math.min(w, x); e = Math.max(e, x); s = Math.min(s, y); n = Math.max(n, y); }
  const near = new Set<Feature>();
  for (let x = Math.floor(w / CELL); x <= Math.floor(e / CELL); x++) for (let y = Math.floor(s / CELL); y <= Math.floor(n / CELL); y++) for (const f of grid.get(`${x},${y}`) ?? []) near.add(f);
  return [...near].filter(f => {
    const line = f.geometry.coordinates as LngLat[], segs: [LngLat, LngLat][] = [];
    for (let i = 1; i < line.length; i++) segs.push([line[i - 1], line[i]]);
    return centrelineInsideM(mp as never, segs, INSIDE_INSET_M) >= MIN_INSIDE_M;
  });
};

// ---- what models hide ------------------------------------------------------------------------------------------
const covers = JSON.parse(fs.readFileSync(path.join('public', 'canal-drive', 'models', 'covers.json'), 'utf8')) as { models: Record<string, { p: string[]; o?: string[] }> };
const hidden = new Set<string>();
for (const m of Object.values(covers.models)) { for (const p of m.p) hidden.add(fullPandId(p)); for (const o of m.o ?? []) hidden.add(o); }

// ---- cut -------------------------------------------------------------------------------------------------------
const stripsFor = (through: Feature[]): PassageStrip[] => through.map(w => ({ strip: roadStrip(w.geometry.coordinates as LngLat[], passageWidthM(w.properties)), clearanceM: passageClearanceM(w.properties) }));
const pieces: Feature[] = [], report: Record<string, unknown>[] = [];
function cut(original: Feature, mp: MultiPolygon, through: Feature[]) {
  const id = String(original.properties.id), height = Number(original.properties.height ?? 0);
  const parts = passagePieces(mp, height, stripsFor(through));
  const { id: _id, minHeight: _min, ...rest } = original.properties;
  parts.forEach((p, i) => pieces.push({
    type: 'Feature',
    properties: { id: `passage:${id}:${i}`, pand: id, ...rest, minHeight: p.minHeight, passage: true },
    geometry: { type: 'Polygon', coordinates: p.polygon.map(ring => ring.map(([x, y]) => [r6(x), r6(y)])) },
  }));
  report.push({ id, height, ways: through.map(w => `${w.properties.name ?? w.properties.highway}`), ground: parts.filter(p => !p.deck).length, decks: parts.filter(p => p.deck).length });
}

const index = JSON.parse(fs.readFileSync(path.join(ROOT, 'bag-tiles', 'index-z14.json'), 'utf8')) as { tileList: string[] };
const seen = new Set<string>();
let skippedHidden = 0;
const originals = new Map<string, Feature>();
if (fs.existsSync(ORIGINALS)) for (const f of (JSON.parse(fs.readFileSync(ORIGINALS, 'utf8')) as { features: Feature[] }).features) originals.set(String(f.properties.id), f);
for (const key of index.tileList) {
  for (const f of readTile(tilePath('bag-tiles', key)).features) {
    const id = String(f.properties.id ?? '');
    if (seen.has(id) || id.startsWith('passage:') || id.startsWith('part:') || Number(f.properties.minHeight ?? 0) >= RIDE_UNDER_M) continue;
    const mp = polygonsOf(f.geometry);
    if (!mp.length) continue;
    const through = waysThrough(mp);
    if (!through.length) continue;
    seen.add(id);
    if (hidden.has(id)) { skippedHidden++; continue; }
    originals.set(id, f);
    cut(f, mp, through);
  }
}
for (const [id, f] of originals) {
  if (seen.has(id)) continue;
  const mp = polygonsOf(f.geometry), through = waysThrough(mp);
  seen.add(id);
  if (!through.length || hidden.has(id)) continue;
  cut(f, mp, through);
}
fs.writeFileSync(PIECES, `{"type":"FeatureCollection","features":[\n${pieces.map(f => JSON.stringify(f)).join(',\n')}\n]}\n`);
const cutIds = new Set(pieces.map(p => String(p.properties.pand)));
console.log(`passage ways: ${ways.length}; buildings cut: ${cutIds.size} (${pieces.length} pieces, ${pieces.filter(p => p.properties.minHeight !== 0).length} decks); left whole under a model: ${skippedHidden}`);
fs.writeFileSync(path.join(STAGE, 'report.json'), `${JSON.stringify(report, null, 1)}\n`);

// ---- write -----------------------------------------------------------------------------------------------------
if (write) {
  const byTile = new Map<string, Feature[]>();
  for (const p of pieces) { const k = tileKey(tileFor(...centreOf(polygonsOf(p.geometry)), 14)); if (!byTile.has(k)) byTile.set(k, []); byTile.get(k)!.push(p); }
  const drop = cutIds;
  fs.writeFileSync(ORIGINALS, `{"type":"FeatureCollection","features":[\n${[...originals.values()].filter(f => cutIds.has(String(f.properties.id))).map(f => JSON.stringify(f)).join(',\n')}\n]}\n`);
  for (const dir of ['building-tiles', 'bag-tiles']) {
    let delta = 0, tiles = 0;
    for (const key of index.tileList) {
      const file = tilePath(dir, key);
      if (!fs.existsSync(file)) continue;
      const tile = readTile(file), adds = byTile.get(key) ?? [];
      const kept = tile.features.filter(f => !drop.has(String(f.properties.id)) && !String(f.properties.id).startsWith('passage:'));
      if (kept.length === tile.features.length && !adds.length) continue;
      // building-tiles carries only the drawing keys; bag-tiles keeps the rest.
      const added = dir === 'building-tiles'
        ? adds.map(f => ({ ...f, properties: Object.fromEntries(Object.entries(f.properties).filter(([k]) => !BAG_ONLY.has(k))) }))
        : adds;
      delta += kept.length + added.length - tile.features.length; tiles++;
      writeTile(file, [...kept, ...added]);
    }
    const indexFile = path.join(ROOT, dir, 'index-z14.json');
    fs.writeFileSync(indexFile, fs.readFileSync(indexFile, 'utf8').replace(/"features": (\d+),/, (_, n) => `"features": ${Number(n) + delta},`));
    console.log(`${dir}: ${delta >= 0 ? '+' : ''}${delta} features in ${tiles} tiles`);
  }
}
