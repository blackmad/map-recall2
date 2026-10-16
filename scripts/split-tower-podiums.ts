/**
 * Put the published building tiles on the tower-podium rule
 * (`splitTowerPodium` in src/canalRecall/towerPodium.ts) without the OSM merge.
 *
 * A pand that `bagHeightM` raised to its ridge (`ridge-tower`) and whose
 * 3DBAG LoD1.3 parts place the tower on part of the footprint is drawn as two
 * features: the pand itself at the podium height (70p) over its whole
 * footprint, and `tower:<pand id>` (with `pand`) over the tower's own faces,
 * from the podium roof to the ridge. Named regression: Hotelschool The Hague,
 * Jan Evertsenstraat 171-175 (NL.IMBAG.Pand.0363100012148630), a 72 m slab
 * over 14,270 m² that is a ~13 m front with a 1,243 m² tower behind it.
 *
 * Only features whose published height is still the ridge-tower height are
 * touched; anything else was hand-set or OSM-sourced and is reported as kept.
 * Pands an installed model, kit, building type or recipe tile names keep one
 * feature (`modelOwnedPands`): the runtime hides by exact id and would leave
 * the tower standing under the model.
 *
 *   npx tsx scripts/split-tower-podiums.ts                         # report only (artifacts/tower-podium/report.json)
 *   npx tsx scripts/split-tower-podiums.ts --out=artifacts/tower-podium/staging   # full z14 trees under <dir>
 *   npx tsx scripts/split-tower-podiums.ts --publish               # rewrite the affected published tiles in place
 */
import { cpSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { gunzipSync, gzipSync } from 'node:zlib';
import { readBagBuildings, type BagBuilding, type CityJson } from '../src/canalRecall/bag3dCityJson.ts';
import { BAG3D_VERSION } from '../src/canalRecall/bag3dTiles.ts';
import { midDescriptor, shortPandId, type PandFacts } from '../src/canalRecall/bagTiles.ts';
import { towerTileFeature } from '../src/canalRecall/towerPodium.ts';
import { loadTerrain } from './lib/terrainField.ts';
import { modelOwnedPands } from './lib/towerPodiumOwners.ts';

const publish = process.argv.includes('--publish');
const outDir = process.argv.find(a => a.startsWith('--out='))?.slice(6);
const ROOT = path.join('public', 'data', 'extracts', 'amsterdam');
const REPORT = path.join('artifacts', 'tower-podium');
const terrainAt = loadTerrain(path.join(ROOT, 'ground-height-v1'));
if (!terrainAt) throw new Error('ground-height-v1 extract missing');

const cacheDir = path.join('.cache', '3dbag', BAG3D_VERSION, 'tiles');
const split = new Map<string, BagBuilding>();
const unsplit: { id: string; source: string; height: number | null }[] = [];
for (const name of readdirSync(cacheDir).filter(n => n.endsWith('.city.json.gz')).sort()) {
  const city = JSON.parse(gunzipSync(readFileSync(path.join(cacheDir, name))).toString('utf8')) as CityJson;
  for (const building of readBagBuildings(city, terrainAt)) {
    if (building.tower) split.set(building.bagId, building);
    else if (building.heightSource === 'ridge-tower') unsplit.push({ id: building.bagId, source: name, height: building.heightM });
  }
}
const owned = modelOwnedPands(split.keys());
for (const id of owned.keys()) split.delete(id);

const round2 = (v: number) => Math.round(v * 100) / 100;
const near = (a: unknown, b: number) => typeof a === 'number' && Math.abs(a - b) <= 0.05;
const factsOf = (b: BagBuilding, heightM: number | null): PandFacts => ({ heightM, eavesM: b.eavesM, ridgeM: b.ridgeM, roofType: b.roofType, year: b.constructionYear, storeys: b.storeys, groundAreaM2: b.groundAreaM2, partyWallAreaM2: b.partyWallAreaM2 });

type Row = { id: string; tile: string; heightBefore: number; podium: number; tower: number; towerAreaM2: number; tallShare: number };
const patched: Row[] = [], kept: { id: string; tile: string; published: unknown; ridge: number }[] = [];
const touched = new Set<string>();
let bytesBefore = 0, bytesAfter = 0, rawBefore = 0, rawAfter = 0, gzipBeforeSameLevel = 0;

type Feature = { type: 'Feature'; properties: Record<string, any>; geometry: unknown };
/** The features to write for one published feature: itself, or the podium and its tower. */
function splitFeature(feature: Feature, dir: string, tile: string): Feature[] | null {
  const id = String(feature.properties?.id ?? '');
  const hit = split.get(id);
  if (!hit?.tower) return null;
  const p = feature.properties;
  if (!near(p.height, round2(hit.tower.heightM))) { kept.push({ id, tile: `${dir}/${tile}`, published: p.height, ridge: round2(hit.tower.heightM) }); return null; }
  patched.push({ id, tile: `${dir}/${tile}`, heightBefore: p.height, podium: round2(hit.tower.minHeightM), tower: round2(hit.tower.heightM), towerAreaM2: Math.round(hit.tower.areaM2), tallShare: round2(hit.tower.tallShare) });
  p.height = round2(hit.tower.minHeightM);
  const tower = towerTileFeature(id, hit.tower);
  // The BAG tiles' facts (eaves, ridge, roof, year, osm) stay on the pand; the tower carries only what draws it.
  touched.add(`${dir}/${tile}`);
  return [feature, tower as Feature];
}

/** Patch a tile keeping its byte layout (one feature per line, or one compact JSON value). */
function patchTile(text: string, dir: string, tile: string): string {
  const lines = text.split('\n');
  if (lines.some(line => line.startsWith('{"type":"Feature"'))) return lines.map(line => {
    if (!line.startsWith('{"type":"Feature"')) return line;
    const comma = line.endsWith(',');
    const out = splitFeature(JSON.parse(comma ? line.slice(0, -1) : line), dir, tile);
    return out ? out.map(f => JSON.stringify(f)).join(',\n') + (comma ? ',' : '') : line;
  }).join('\n');
  const collection = JSON.parse(text) as { features: Feature[] }, tail = text.endsWith('\n') ? '\n' : '';
  if (JSON.stringify(collection) + tail !== text) throw Error(`${dir}/${tile}: neither line-per-feature nor compact JSON`);
  let dirty = false;
  collection.features = collection.features.flatMap(feature => { const out = splitFeature(feature, dir, tile); if (out) dirty = true; return out ?? [feature]; });
  return dirty ? JSON.stringify(collection) + tail : text;
}

const write = (rel: string, bytes: Buffer) => {
  if (outDir) { mkdirSync(path.dirname(path.join(outDir, rel)), { recursive: true }); writeFileSync(path.join(outDir, rel), bytes); }
  if (publish) writeFileSync(path.join(ROOT, rel), bytes);
};
if (outDir) for (const dir of ['building-tiles', 'bag-tiles', 'bag-facts']) cpSync(path.join(ROOT, dir, '14'), path.join(outDir, dir, '14'), { recursive: true });

const indexDelta: Record<string, number> = {};
for (const dir of ['building-tiles', 'bag-tiles']) {
  const base = path.join(ROOT, dir, '14');
  for (const x of readdirSync(base)) for (const file of readdirSync(path.join(base, x)).filter(f => f.endsWith('.geojson.gz'))) {
    const tile = `14/${x}/${file}`;
    const raw = readFileSync(path.join(base, x, file));
    const text = gunzipSync(raw).toString('utf8');
    if (![...split.keys()].some(id => text.includes(`"${id}"`))) continue;
    const before = patched.length;
    const next = patchTile(text, dir, tile);
    if (next === text) continue;
    const gz = gzipSync(next, { level: 9 });
    bytesBefore += raw.byteLength; bytesAfter += gz.byteLength;
    rawBefore += Buffer.byteLength(text); rawAfter += Buffer.byteLength(next); gzipBeforeSameLevel += gzipSync(text, { level: 9 }).byteLength;
    indexDelta[dir] = (indexDelta[dir] ?? 0) + (patched.length - before);
    write(path.join(dir, tile), gz);
  }
}

// Each tile tree's index counts features; every split adds one.
for (const dir of ['building-tiles', 'bag-tiles']) {
  const file = path.join(dir, 'index-z14.json');
  const index = JSON.parse(readFileSync(path.join(ROOT, file), 'utf8')) as { features?: number };
  if (typeof index.features !== 'number' || !indexDelta[dir]) continue;
  index.features += indexDelta[dir];
  const raw = readFileSync(path.join(ROOT, file), 'utf8');
  const indent = raw.startsWith('{\n  "') ? 2 : 1;
  write(file, Buffer.from(`${JSON.stringify(index, null, indent)}\n`));
}

// The mid-tier descriptor follows the pand's height where it read the ridge-tower height.
let descriptors = 0;
const factsBase = path.join(ROOT, 'bag-facts', '14');
for (const x of readdirSync(factsBase)) for (const file of readdirSync(path.join(factsBase, x))) {
  const tile = JSON.parse(gunzipSync(readFileSync(path.join(factsBase, x, file))).toString('utf8'));
  let dirty = false;
  for (const row of patched.filter(r => r.tile.startsWith('bag-tiles/'))) {
    const short = shortPandId(row.id), hit = split.get(row.id)!;
    if (!tile.pands[short]) continue;
    const before = JSON.stringify(midDescriptor(factsOf(hit, hit.tower!.heightM))), after = midDescriptor(factsOf(hit, hit.tower!.minHeightM));
    if (JSON.stringify(tile.pands[short]) !== before || before === JSON.stringify(after)) continue;
    tile.pands[short] = after; dirty = true; descriptors++;
  }
  if (dirty) { touched.add(`bag-facts/14/${x}/${file}`); write(path.join('bag-facts', '14', x, file), gzipSync(JSON.stringify(tile), { level: 9 })); }
}

mkdirSync(REPORT, { recursive: true });
const bt = patched.filter(r => r.tile.startsWith('building-tiles/'));
const quantiles = (values: number[]) => { const s = [...values].sort((a, b) => a - b); const q = (p: number) => s[Math.min(s.length - 1, Math.floor(s.length * p))]; return s.length ? { n: s.length, p10: q(0.1), median: q(0.5), p90: q(0.9), max: s[s.length - 1] } : null; };
const report = {
  published: publish, out: outDir ?? null,
  pandsSplitByRule: split.size + owned.size,
  pandsOwnedByModels: Object.fromEntries(owned),
  ridgeTowerKept: unsplit,
  buildingTilesSplit: bt.length, bagTilesSplit: patched.length - bt.length, bagFactDescriptors: descriptors,
  towerFeaturesAdded: patched.length,
  tallShare: quantiles(bt.map(r => r.tallShare)), podiumM: quantiles(bt.map(r => r.podium)), towerM: quantiles(bt.map(r => r.tower)), towerAreaM2: quantiles(bt.map(r => r.towerAreaM2)),
  // Published tiles were gzipped at the default level; the patch writes level 9, so the like-for-like delta is `gzipDeltaSameLevel`.
  gzipBytes: { before: bytesBefore, after: bytesAfter, delta: bytesAfter - bytesBefore, gzipDeltaSameLevel: bytesAfter - gzipBeforeSameLevel },
  rawBytes: { before: rawBefore, after: rawAfter, delta: rawAfter - rawBefore },
  pandsNotInTiles: [...split.keys()].filter(id => !patched.some(r => r.id === id)),
  keptPublishedHeight: kept.length, files: [...touched].sort(), patched, kept,
};
writeFileSync(path.join(REPORT, 'report.json'), JSON.stringify(report, null, 1) + '\n');
console.log(JSON.stringify({ ...report, patched: patched.length, kept, files: touched.size, ridgeTowerKept: unsplit.length }, null, 1));
