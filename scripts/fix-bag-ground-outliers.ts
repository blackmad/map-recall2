/**
 * Put the published building tiles on the terrain rule (`pandGroundNap` in
 * src/canalRecall/bag3dCityJson.ts) without the OSM merge: every pand whose
 * published height is still a 3DBAG-derived value gets the rule's height (and in
 * the BAG tiles its eaves, ridge and mid-tier descriptor). "3DBAG-derived" is
 * either 3DBAG's own ground or the first, under-footprint-only rule that
 * patched 410 pands on 2026-10-14 (the terrain under the footprint alone, which
 * also re-measured 98 pands on split-level ground: decks, dikes, quays). A
 * published height that matches neither is hand-set or OSM-sourced and is left.
 *
 * The building tiles are a product of the OSM merge (build-lod1-city.ts needs
 * buildings-osm.geojson); this is the part of that rebuild the ground rule
 * touches. The BAG tiles and facts sidecars are rebuilt whole by
 * `build-bag-buildings.ts --tiles --base=<these building tiles>`.
 *
 *   npx tsx scripts/fix-bag-ground-outliers.ts                    # report to artifacts/bag-ground-outliers/report.json
 *   npx tsx scripts/fix-bag-ground-outliers.ts --out=<dir>        # also write the full z14 trees under <dir> (staging)
 *   npx tsx scripts/fix-bag-ground-outliers.ts --publish          # rewrite the affected published tiles in place
 */
import { cpSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { gunzipSync, gzipSync } from 'node:zlib';
import { bagHeightM, readBagBuildings, sampleTerrain, trustedGroundNap, type BagBuilding, type CityJson } from '../src/canalRecall/bag3dCityJson.ts';
import { BAG3D_VERSION } from '../src/canalRecall/bag3dTiles.ts';
import { midDescriptor, shortPandId, type PandFacts } from '../src/canalRecall/bagTiles.ts';
import { loadTerrain } from './lib/terrainField.ts';

const publish = process.argv.includes('--publish');
const outDir = process.argv.find(a => a.startsWith('--out='))?.slice(6);
const ROOT = path.join('public', 'data', 'extracts', 'amsterdam');
const REPORT = path.join('artifacts', 'bag-ground-outliers');
const terrainAt = loadTerrain(path.join(ROOT, 'ground-height-v1'));
if (!terrainAt) throw new Error('ground-height-v1 extract missing');

type Values = { heightM: number | null; eavesM: number | null; ridgeM: number | null };
type Pand = { rule: BagBuilding; raw: BagBuilding; underOnly: Values; source: 'terrain' | '3dbag' };
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

/** Heights under the superseded under-footprint-only rule: `trustedGroundNap` given the bare terrain number. */
function underOnlyValues(attributes: Record<string, unknown>, under: number | null): Values {
  const ground = trustedGroundNap(attributes, under).groundNapM;
  const roofMin = num(attributes.b3_h_dak_min), ridge = num(attributes.b3_h_nok);
  return {
    heightM: bagHeightM(attributes, under).heightM,
    eavesM: roofMin !== null && ground !== null && roofMin - ground > 0 ? roofMin - ground : null,
    ridgeM: ridge !== null && ground !== null && ridge - ground > 0 ? ridge - ground : null,
  };
}

const cacheDir = path.join('.cache', '3dbag', BAG3D_VERSION, 'tiles');
const pands = new Map<string, Pand>();
for (const name of readdirSync(cacheDir).filter(n => n.endsWith('.city.json.gz')).sort()) {
  const city = JSON.parse(gunzipSync(readFileSync(path.join(cacheDir, name))).toString('utf8')) as CityJson;
  const raw = new Map(readBagBuildings(city).map(b => [b.bagId, b]));
  const { scale, translate } = city.transform;
  const objects = new Map(Object.values(city.CityObjects).filter(o => o.type === 'Building').map(o => [String(o.attributes?.identificatie ?? ''), o]));
  for (const rule of readBagBuildings(city, terrainAt)) {
    const before = raw.get(rule.bagId), object = objects.get(rule.bagId);
    if (!before || !object) continue;
    const lod0 = object.geometry?.find(g => g.lod === '0' && g.type === 'MultiSurface');
    const ring = ((lod0?.boundaries as number[][][] | undefined)?.[0]?.[0] ?? []).map(i => city.vertices[i]).map(v => [v[0] * scale[0] + translate[0], v[1] * scale[1] + translate[1]]);
    const under = ring.length ? sampleTerrain(terrainAt, ring).underNapM : null;
    const underOnly = underOnlyValues(object.attributes ?? {}, under);
    if (rule.heightM === before.heightM && underOnly.heightM === before.heightM && rule.groundNapM === before.groundNapM) continue;
    pands.set(rule.bagId, { rule, raw: before, underOnly, source: rule.groundNapM !== before.groundNapM ? 'terrain' : '3dbag' });
  }
}

const round2 = (v: number | null) => (v === null ? null : Math.round(v * 100) / 100);
const round1 = (v: number | null) => (v === null ? null : Math.round(v * 10) / 10);
const factsOf = (b: BagBuilding, v: Values = b): PandFacts => ({ heightM: v.heightM, eavesM: v.eavesM, ridgeM: v.ridgeM, roofType: b.roofType, year: b.constructionYear, storeys: b.storeys, groundAreaM2: b.groundAreaM2, partyWallAreaM2: b.partyWallAreaM2 });
const near = (a: unknown, b: number | null) => typeof a === 'number' && b !== null && Math.abs(a - b) <= 0.05;

type Row = { id: string; tile: string; heightBefore: number; heightAfter: number | null; was: 'raw' | 'under-only'; ground: 'terrain' | '3dbag' };
const patched: Row[] = [], kept: { id: string; tile: string; published: unknown; rule: number | null }[] = [];
const touched = new Set<string>();

/** Re-measure one feature in place when its height is still a 3DBAG-derived value other than the rule's; true when changed. */
function patchFeature(feature: { properties?: Record<string, any> }, dir: string, tile: string): boolean {
  const id = String(feature.properties?.id ?? '');
  const hit = pands.get(id);
  if (!hit) return false;
  const p = feature.properties!, after = hit.rule;
  if (after.heightM === null || near(p.height, round2(after.heightM))) return false;
  const was = near(p.height, round2(hit.raw.heightM)) ? 'raw' : near(p.height, round2(hit.underOnly.heightM)) ? 'under-only' : null;
  if (!was) { kept.push({ id, tile: `${dir}/${tile}`, published: p.height, rule: round2(after.heightM) }); return false; }
  patched.push({ id, tile: `${dir}/${tile}`, heightBefore: p.height, heightAfter: round2(after.heightM), was, ground: hit.source });
  p.height = round2(after.heightM);
  if (dir === 'bag-tiles') {
    if (after.eavesM !== null) p.eaves = round1(after.eavesM); else delete p.eaves;
    if (after.ridgeM !== null) p.ridge = round1(after.ridgeM); else delete p.ridge;
  }
  touched.add(`${dir}/${tile}`);
  return true;
}

/**
 * Patch a tile keeping its byte layout: most tiles hold one feature per line, but some are one compact JSON value
 * (building-tiles 8412/5383 and 8413/5383, which the first patch skipped for that reason).
 */
function patchTile(text: string, dir: string, tile: string): string {
  const lines = text.split('\n');
  if (lines.some(line => line.startsWith('{"type":"Feature"'))) return lines.map(line => {
    if (!line.startsWith('{"type":"Feature"')) return line;
    const comma = line.endsWith(',');
    const feature = JSON.parse(comma ? line.slice(0, -1) : line);
    return patchFeature(feature, dir, tile) ? JSON.stringify(feature) + (comma ? ',' : '') : line;
  }).join('\n');
  const collection = JSON.parse(text), tail = text.endsWith('\n') ? '\n' : '';
  if (JSON.stringify(collection) + tail !== text) throw Error(`${dir}/${tile}: neither line-per-feature nor compact JSON`);
  let dirty = false;
  for (const feature of collection.features) dirty = patchFeature(feature, dir, tile) || dirty;
  return dirty ? JSON.stringify(collection) + tail : text;
}

const write = (rel: string, bytes: Buffer) => {
  if (outDir) { mkdirSync(path.dirname(path.join(outDir, rel)), { recursive: true }); writeFileSync(path.join(outDir, rel), bytes); }
  if (publish) writeFileSync(path.join(ROOT, rel), bytes);
};
if (outDir) for (const dir of ['building-tiles', 'bag-tiles', 'bag-facts']) cpSync(path.join(ROOT, dir, '14'), path.join(outDir, dir, '14'), { recursive: true });

for (const dir of ['building-tiles', 'bag-tiles']) {
  const base = path.join(ROOT, dir, '14');
  for (const x of readdirSync(base)) for (const file of readdirSync(path.join(base, x)).filter(f => f.endsWith('.geojson.gz'))) {
    const tile = `14/${x}/${file}`;
    const text = gunzipSync(readFileSync(path.join(base, x, file))).toString('utf8');
    if (![...pands.keys()].some(id => text.includes(`"${id}"`))) continue;
    const next = patchTile(text, dir, tile);
    if (next !== text) write(path.join(dir, tile), gzipSync(next, { level: 9 }));
  }
}

// The BAG facts sidecar's descriptor (archetype, storeys, eaves, ridge) follows the same facts.
let descriptors = 0;
const factsBase = path.join(ROOT, 'bag-facts', '14');
const patchedBag = new Set(patched.filter(r => r.tile.startsWith('bag-tiles/')).map(r => r.id));
for (const x of readdirSync(factsBase)) for (const file of readdirSync(path.join(factsBase, x))) {
  const tile = JSON.parse(gunzipSync(readFileSync(path.join(factsBase, x, file))).toString('utf8'));
  let dirty = false;
  for (const id of patchedBag) {
    const short = shortPandId(id), hit = pands.get(id)!, now = JSON.stringify(tile.pands[short]);
    if (!tile.pands[short] || now === JSON.stringify(midDescriptor(factsOf(hit.rule)))) continue;
    if (now !== JSON.stringify(midDescriptor(factsOf(hit.raw))) && now !== JSON.stringify(midDescriptor(factsOf(hit.raw, hit.underOnly)))) continue;
    tile.pands[short] = midDescriptor(factsOf(hit.rule)); dirty = true; descriptors++;
  }
  if (dirty) { touched.add(`bag-facts/14/${x}/${file}`); write(path.join('bag-facts', '14', x, file), gzipSync(JSON.stringify(tile), { level: 9 })); }
}

mkdirSync(REPORT, { recursive: true });
const delta = (rows: Row[]) => { const d = rows.map(r => (r.heightAfter ?? 0) - r.heightBefore).sort((a, b) => a - b); return d.length ? { n: d.length, min: round2(d[0]), median: round2(d[d.length >> 1]), max: round2(d[d.length - 1]) } : null; };
const bt = patched.filter(r => r.tile.startsWith('building-tiles/'));
const report = {
  published: publish, out: outDir ?? null,
  pandsOnTerrainGround: [...pands.values()].filter(p => p.source === 'terrain').length,
  pandsUnderOnlyReverted: [...pands.values()].filter(p => p.source === '3dbag').length,
  buildingTiles: { fromRaw: delta(bt.filter(r => r.was === 'raw')), fromUnderOnly: delta(bt.filter(r => r.was === 'under-only' && r.ground === 'terrain')), revertedToRaw: delta(bt.filter(r => r.ground === '3dbag')) },
  bagTilesPatched: patched.filter(r => r.tile.startsWith('bag-tiles/')).length, bagFactDescriptors: descriptors,
  keptPublishedHeight: kept.length, files: [...touched].sort(), patched, kept,
};
writeFileSync(path.join(REPORT, 'report.json'), JSON.stringify(report, null, 1) + '\n');
console.log(JSON.stringify({ ...report, patched: patched.length, kept: kept.length, files: touched.size }, null, 1));
