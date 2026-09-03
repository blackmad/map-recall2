/**
 * Does the hosted 3DBAG tileset carry a BAG identity per building?
 *
 * This was the blocking question in BUILDING_RENDERER_DESIGN.md Phase 0a. If
 * the tiles the game already streams resolve each feature to a `pand_id`, then
 * measured roof colour can be joined onto government geometry at runtime and
 * an offline mesh compiler becomes an optimisation rather than a prerequisite.
 * If they do not, the compiler has to consume CityJSON and the plan gets much
 * larger.
 *
 * Measured on 2026-08-31 against v20250903, over the Rijksmuseum: yes, and
 * with more than identity — construction year, AHN ground and ridge heights,
 * per-building reconstruction error and shared-wall area all travel with it.
 *
 * The script stays in the tree because it is also the regression check for
 * that answer. 3DBAG republishes independently of this repository, and a
 * republish that dropped `identificatie` or renamed the height fields would
 * silently strand the join. Run it when bumping BAG3D_VERSION.
 *
 * Usage:
 *   npm run probe:3dbag [-- --at=4.8852,52.3600] [--json]
 */

import assert from 'node:assert/strict';
import { BAG3D_LOD22_BASE, BAG3D_VERSION, findTilesAt, lod1HeightM, readBag3dBuildings, ridgeHeightM } from '../src/canalRecall/bag3dTiles.js';

const argument = (name: string) => process.argv.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const [lng, lat] = (argument('at') ?? '4.8852,52.3600').split(',').map(Number);
const asJson = process.argv.includes('--json');
assert.ok(Number.isFinite(lng) && Number.isFinite(lat), 'usage: --at=<lng>,<lat>');

const fetchJson = async (url: string): Promise<unknown> => {
  const response = await fetch(url, { headers: { 'User-Agent': 'MapRecall3dbagProbe/1.0' } });
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
  return await response.json();
};

const tiles = await findTilesAt(lng, lat, fetchJson, BAG3D_LOD22_BASE);
assert.ok(tiles.length > 0, `no 3DBAG tile covers ${lng},${lat} — is the position inside the Netherlands?`);

const tileUrl = tiles[0];
const response = await fetch(tileUrl, { headers: { 'User-Agent': 'MapRecall3dbagProbe/1.0' } });
assert.ok(response.ok, `HTTP ${response.status} for ${tileUrl}`);
const bytes = new Uint8Array(await response.arrayBuffer());
const buildings = readBag3dBuildings(bytes);

// --- the Phase 0a question, as assertions -----------------------------------
const withId = buildings.filter(building => /^NL\.IMBAG\.Pand\.\d+$/.test(building.bagId));
assert.equal(withId.length, buildings.length, `every feature carries a BAG pand id (${withId.length}/${buildings.length} did)`);
assert.equal(new Set(buildings.map(b => b.bagId)).size, buildings.length, 'BAG ids are unique within a tile');

const heights = buildings.map(lod1HeightM);
const measured = heights.filter(height => height.source !== 'none');
// Not every building: a tile over Amsterdam Noord had 1 of 3,475 with neither a
// reconstructed volume nor a ridge. That residue is why `source: 'none'` exists
// and why the caller still needs an OSM height fallback — but it must stay a
// rounding error, not a tier the city leans on.
assert.ok(
  measured.length >= buildings.length * 0.99,
  `nearly every building gets a measured LoD1 height (${measured.length}/${buildings.length})`
);
assert.ok(buildings.some(b => b.constructionYear !== null), 'construction year is present for the age prior');
assert.ok(buildings.some(b => b.rmseLod22 !== null), 'per-building LoD2.2 reconstruction error is present');

// --- what the tile actually contains ----------------------------------------
const share = (count: number) => `${count}/${buildings.length} (${Math.round((count / buildings.length) * 100)}%)`;
const median = (values: number[]) => [...values].sort((a, b) => a - b)[values.length >> 1];
const terraced = buildings.filter(b => (b.partyWallAreaM2 ?? 0) > 0);
const ridges = buildings.map(ridgeHeightM).filter((height): height is number => height !== null);
const bySource = new Map<string, number>();
for (const { source } of heights) bySource.set(source, (bySource.get(source) ?? 0) + 1);
const years = buildings.map(b => b.constructionYear).filter((year): year is number => year !== null);
const rmse = buildings.map(b => b.rmseLod22).filter((value): value is number => value !== null);
const roofTypes = [...new Set(buildings.map(b => b.roofType))].sort();

if (asJson) {
  process.stdout.write(`${JSON.stringify({ version: BAG3D_VERSION, tileUrl, buildings }, null, 2)}\n`);
} else {
  process.stdout.write(`3DBAG ${BAG3D_VERSION} at ${lng},${lat}\n`);
  process.stdout.write(`  tile           ${tileUrl.replace(BAG3D_LOD22_BASE, '')} (${(bytes.byteLength / 1024).toFixed(0)} KB, ${buildings.length} buildings)\n`);
  process.stdout.write(`  BAG identity   ${share(withId.length)}, all unique\n`);
  process.stdout.write(`  LoD1 height    ${share(measured.length)}, median ${median(measured.map(h => h.heightM!)).toFixed(1)} m\n`);
  process.stdout.write(`    by source    ${[...bySource].map(([source, count]) => `${source} ${count}`).join(', ')}\n`);
  if (bySource.get('none')) process.stdout.write(`    unmeasured   ${bySource.get('none')} need an OSM height fallback\n`);
  process.stdout.write(`  ridge height   ${share(ridges.length)} — flat roofs have none, so this cannot be the extrusion height\n`);
  process.stdout.write(`  build year     ${share(years.length)}, ${Math.min(...years)}–${Math.max(...years)}\n`);
  process.stdout.write(`  rmse lod2.2    ${share(rmse.length)}, median ${median(rmse).toFixed(2)} m\n`);
  process.stdout.write(`  terraced       ${share(terraced.length)} share a party wall\n`);
  process.stdout.write(`  roof types     ${roofTypes.join(', ')}\n`);
  process.stdout.write('\nPhase 0a answered: appearance can be joined to government geometry by BAG id.\n');
}
