/**
 * Make every building-type instance pand a feature of the BAG tiles.
 *
 * `build-lod1-city` lets a hand-mapped OSM way stand in for a pand (tier 2); the tile then carries the OSM id
 * (`w274854743`) and no pand key, so `NL.IMBAG.Pand.<pand>` — the id the building-type runtime suppresses —
 * names nothing and the OSM extrusion is drawn under the garage GLB. `check-covers` reports those as
 * "instance pand not in the tiles" (5 in Nieuw-West, area nwc8, 2026-10-13).
 *
 * For each such pand this finds the OSM-only tile feature that is the same building (footprint mutual share
 * >= OSM_MATCH_SHARE against the 3DBAG footprint) and re-keys it: `id` becomes the pand id, the old id moves to
 * `osm`. Geometry and heights are untouched. Idempotent; patches the tile files in place. Re-run after
 * `npm run build:bag-tiles` (the base tiles still carry the OSM ids).
 *
 * Usage: tsx scripts/reconcile-building-type-pands.ts [--tiles=public/data/extracts/amsterdam/bag-tiles/14]
 *          [--cache=.cache/3dbag] [--dry]
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { readBagBuildings, type CityJson } from '../src/canalRecall/bag3dCityJson';
import { OSM_MATCH_SHARE, fullPandId, isPandId, mutualShare } from '../src/canalRecall/bagTiles';
import { outerRings } from '../src/canalRecall/bagPandIndex';
import { loadBagTiles } from './lib/bagTileIndex';
import { ROOT, buildingTypesPlaced } from './lib/placedFootprints';

const flag = (name: string): string | undefined => process.argv.find(a => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const dry = process.argv.includes('--dry');
const tilesDir = flag('tiles') ?? path.join(ROOT, 'public/data/extracts/amsterdam/bag-tiles/14');
const cacheRoot = flag('cache') ?? ['.cache/3dbag', '../../../.cache/3dbag'].map(p => path.resolve(ROOT, p)).find(fs.existsSync)!;

const index = loadBagTiles(tilesDir);
const missing = new Map(buildingTypesPlaced().map(p => [[...p.suppress][0], p.centre as [number, number]]).filter(([id]) => !index.pands.has(id as string)) as [string, [number, number]][]);
console.log(`building-type pands not in the tiles: ${missing.size}`);
if (!missing.size) process.exit(0);

// Footprints from the cached 3DBAG CityJSON tiles.
const rings = new Map<string, [number, number][][]>();
const versions = fs.readdirSync(cacheRoot).filter(n => fs.existsSync(path.join(cacheRoot, n, 'tiles')));
for (const version of versions) {
  const dir = path.join(cacheRoot, version, 'tiles');
  for (const name of fs.readdirSync(dir).filter(n => n.endsWith('.city.json.gz'))) {
    const buf = zlib.gunzipSync(fs.readFileSync(path.join(dir, name)));
    if (![...missing.keys()].some(id => buf.includes(id.slice(14)))) continue;
    for (const b of readBagBuildings(JSON.parse(buf.toString('utf8')) as CityJson)) if (missing.has(b.bagId)) rings.set(b.bagId, b.rings);
  }
}

const tileOf = (lng: number, lat: number, z = 14): [number, number] => {
  const n = 2 ** z;
  return [Math.floor((lng + 180) / 360 * n), Math.floor((1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * n)];
};
let patched = 0;
for (const [pand, [lng, lat]] of missing) {
  const fp = rings.get(pand);
  if (!fp) { console.log(`  ${pand}: no 3DBAG footprint in the cache`); continue; }
  const [x, y] = tileOf(lng, lat);
  const file = path.join(tilesDir, String(x), `${y}.geojson.gz`);
  const collection = JSON.parse(zlib.gunzipSync(fs.readFileSync(file)).toString('utf8')) as { features: { properties: Record<string, unknown>; geometry: any }[] };
  let best: { feature: (typeof collection.features)[number]; share: number } | null = null;
  for (const feature of collection.features) {
    const id = String(feature.properties.id ?? '');
    if (isPandId(id)) continue;
    const share = mutualShare(fp, outerRings(feature.geometry));
    if (share >= OSM_MATCH_SHARE && (!best || share > best.share)) best = { feature, share };
  }
  if (!best) { console.log(`  ${pand}: no OSM-only feature matches in ${x}/${y}`); continue; }
  const old = String(best.feature.properties.id);
  console.log(`  ${pand}: ${old} (share ${best.share.toFixed(2)}, height ${best.feature.properties.height}) -> ${fullPandId(pand)} in ${x}/${y}`);
  best.feature.properties.id = fullPandId(pand);
  best.feature.properties.osm = [...new Set([...(Array.isArray(best.feature.properties.osm) ? best.feature.properties.osm as string[] : []), old])];
  patched++;
  if (!dry) fs.writeFileSync(file, zlib.gzipSync(`{"type":"FeatureCollection","features":[\n${collection.features.map(f => JSON.stringify(f)).join(',\n')}\n]}\n`));
}
console.log(`${dry ? 'would patch' : 'patched'} ${patched} of ${missing.size}`);
