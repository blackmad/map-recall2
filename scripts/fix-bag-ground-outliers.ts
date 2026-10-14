/**
 * Apply `trustedGroundNap` (src/canalRecall/bag3dCityJson.ts) to the published
 * building tiles without rebuilding them: every pand whose 3DBAG ground sits
 * more than GROUND_OUTLIER_M below the AHN terrain gets its height (and in the
 * BAG tiles its eaves, ridge and mid-tier descriptor) re-measured from the
 * terrain. A tile height is only replaced when it still equals the old
 * 3DBAG-derived value, so hand-set and OSM-sourced heights are left alone.
 *
 *   npx tsx scripts/fix-bag-ground-outliers.ts            # report to artifacts/bag-ground-outliers/report.json
 *   npx tsx scripts/fix-bag-ground-outliers.ts --publish  # also rewrite the affected tiles in place
 */
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { gunzipSync, gzipSync } from 'node:zlib';
import { readBagBuildings, type BagBuilding, type CityJson } from '../src/canalRecall/bag3dCityJson.ts';
import { BAG3D_VERSION } from '../src/canalRecall/bag3dTiles.ts';
import { midDescriptor, shortPandId, type PandFacts } from '../src/canalRecall/bagTiles.ts';
import { loadTerrain } from './lib/terrainField.ts';

const publish = process.argv.includes('--publish');
const ROOT = path.join('public', 'data', 'extracts', 'amsterdam');
const OUT = path.join('artifacts', 'bag-ground-outliers');
const terrainAt = loadTerrain(path.join(ROOT, 'ground-height-v1'));
if (!terrainAt) throw new Error('ground-height-v1 extract missing');

const cacheDir = path.join('.cache', '3dbag', BAG3D_VERSION, 'tiles');
const changed = new Map<string, { before: BagBuilding; after: BagBuilding }>();
for (const name of readdirSync(cacheDir).filter(n => n.endsWith('.city.json.gz')).sort()) {
  const city = JSON.parse(gunzipSync(readFileSync(path.join(cacheDir, name))).toString('utf8')) as CityJson;
  const before = new Map(readBagBuildings(city).map(b => [b.bagId, b]));
  for (const after of readBagBuildings(city, terrainAt)) {
    const old = before.get(after.bagId);
    if (old && old.groundNapM !== after.groundNapM) changed.set(after.bagId, { before: old, after });
  }
}

const round2 = (v: number | null) => (v === null ? null : Math.round(v * 100) / 100);
const round1 = (v: number | null) => (v === null ? null : Math.round(v * 10) / 10);
const factsOf = (b: BagBuilding): PandFacts => ({ heightM: b.heightM, eavesM: b.eavesM, ridgeM: b.ridgeM, roofType: b.roofType, year: b.constructionYear, storeys: b.storeys, groundAreaM2: b.groundAreaM2, partyWallAreaM2: b.partyWallAreaM2 });

type Row = { id: string; tile: string; heightBefore: number | null; heightAfter: number | null; groundBefore: number | null; groundAfter: number | null };
const patched: Row[] = [], kept: (Row & { published: unknown })[] = [];
const touched = new Set<string>();

/** Rewrite one feature line of a tile when its height is still the old 3DBAG value. */
function patchLine(line: string, dir: string, tile: string): string {
  if (!line.startsWith('{"type":"Feature"')) return line;
  const comma = line.endsWith(',');
  const feature = JSON.parse(comma ? line.slice(0, -1) : line);
  const id = String(feature.properties?.id ?? '');
  const hit = changed.get(id);
  if (!hit) return line;
  const p = feature.properties, { before, after } = hit;
  const row: Row = { id, tile: `${dir}/${tile}`, heightBefore: round2(before.heightM), heightAfter: round2(after.heightM), groundBefore: round2(before.groundNapM), groundAfter: round2(after.groundNapM) };
  if (typeof p.height !== 'number' || before.heightM === null || Math.abs(p.height - before.heightM) > 0.05 || after.heightM === null) {
    kept.push({ ...row, published: p.height });
    return line;
  }
  p.height = round2(after.heightM);
  if (dir === 'bag-tiles') {
    if ('eaves' in p || after.eavesM !== null) { if (after.eavesM !== null) p.eaves = round1(after.eavesM); else delete p.eaves; }
    if ('ridge' in p || after.ridgeM !== null) { if (after.ridgeM !== null) p.ridge = round1(after.ridgeM); else delete p.ridge; }
  }
  patched.push(row);
  touched.add(`${dir}/${tile}`);
  return JSON.stringify(feature) + (comma ? ',' : '');
}

for (const dir of ['building-tiles', 'bag-tiles']) {
  const base = path.join(ROOT, dir, '14');
  for (const x of readdirSync(base)) for (const file of readdirSync(path.join(base, x)).filter(f => f.endsWith('.geojson.gz'))) {
    const tile = `14/${x}/${file}`, full = path.join(base, x, file);
    const text = gunzipSync(readFileSync(full)).toString('utf8');
    if (![...changed.keys()].some(id => text.includes(`"${id}"`))) continue;
    const next = text.split('\n').map(line => patchLine(line, dir, tile)).join('\n');
    if (publish && next !== text) writeFileSync(full, gzipSync(next, { level: 9 }));
  }
}

// The BAG facts sidecar's descriptor (archetype, storeys, eaves, ridge) follows the same facts.
let descriptors = 0;
const factsBase = path.join(ROOT, 'bag-facts', '14');
for (const x of readdirSync(factsBase)) for (const file of readdirSync(path.join(factsBase, x))) {
  const full = path.join(factsBase, x, file), tile = JSON.parse(gunzipSync(readFileSync(full)).toString('utf8'));
  let dirty = false;
  for (const row of patched.filter(r => r.tile.startsWith('bag-tiles/'))) {
    const short = shortPandId(row.id), hit = changed.get(row.id)!;
    if (!tile.pands[short] || JSON.stringify(tile.pands[short]) !== JSON.stringify(midDescriptor(factsOf(hit.before)))) continue;
    tile.pands[short] = midDescriptor(factsOf(hit.after)); dirty = true; descriptors++;
  }
  if (dirty) { touched.add(`bag-facts/14/${x}/${file}`); if (publish) writeFileSync(full, gzipSync(JSON.stringify(tile), { level: 9 })); }
}

mkdirSync(OUT, { recursive: true });
const drop = patched.filter(r => r.tile.startsWith('building-tiles/')).map(r => (r.heightBefore ?? 0) - (r.heightAfter ?? 0)).sort((a, b) => a - b);
const report = {
  published: publish, pandsWithReplacedGround: changed.size,
  buildingTilesPatched: patched.filter(r => r.tile.startsWith('building-tiles/')).length,
  bagTilesPatched: patched.filter(r => r.tile.startsWith('bag-tiles/')).length, bagFactDescriptors: descriptors,
  keptPublishedHeight: kept.length, heightDropM: drop.length ? { min: round2(drop[0]), median: round2(drop[drop.length >> 1]), max: round2(drop[drop.length - 1]) } : null,
  files: [...touched].sort(), patched, kept,
};
writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 1) + '\n');
console.log(JSON.stringify({ ...report, patched: patched.length, kept: kept.length, files: touched.size }, null, 1));
