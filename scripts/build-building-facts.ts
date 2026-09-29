/**
 * Per-tile building facts for clicked buildings (`src/canalRecall/buildingFacts.ts`).
 *
 * From the OSM building export (`resolve:landmark-buildings` derives it):
 * construction year (`start_date`, from BAG), a type worth naming, and a
 * heritage listing, keyed by the same ids as the building tiles and cut into
 * the same z14 tiles, so a click looks its building up in the tile it loaded.
 *
 * Writes into `staging/building-facts/`; `--publish` replaces
 * `building-facts/`.
 *
 * Usage: npm run build:building-facts [-- --publish]
 */
import { createReadStream } from 'node:fs';
import { mkdir, readFile, readdir, rm, stat, writeFile, rename } from 'node:fs/promises';
import path from 'node:path';
import { createInterface } from 'node:readline';
import { gunzipSync, gzipSync } from 'node:zlib';
import { BuildingGrid, ringCentroid, tileIdsDrawing, type Ring } from './lib/landmarkBuildings.ts';
import {
  BUILDING_TYPES, factTileOf, heritageLevel, shortBuildingId, yearFromStartDate,
  type BuildingFactRow, type BuildingFactTile, type BuildingType,
} from '../src/canalRecall/buildingFacts.ts';

const directory = path.resolve('public/data/extracts/amsterdam');
const buildingsSeq = path.resolve('.cache/osm-source/derived/amsterdam-buildings.geojsonseq');
if (!await stat(buildingsSeq).catch(() => null)) throw new Error('Run `npm run resolve:landmark-buildings` first.');

// Which ids the tiles draw, and where.
const tileIds = new Set<string>();
const tileRoot = path.join(directory, 'building-tiles', '14');
for (const x of await readdir(tileRoot)) {
  for (const file of await readdir(path.join(tileRoot, x))) {
    if (!file.endsWith('.geojson.gz')) continue;
    const collection = JSON.parse(gunzipSync(await readFile(path.join(tileRoot, x, file))).toString('utf8'));
    for (const feature of collection.features) if (feature.properties?.id) tileIds.add(String(feature.properties.id));
  }
}

const grid = new BuildingGrid();
const facts: Array<{ osmId: string; row: BuildingFactRow; lng: number; lat: number }> = [];
for await (const raw of createInterface({ input: createReadStream(buildingsSeq) })) {
  const line = raw.replace(/^\x1e/, '');
  if (!line) continue;
  const feature = JSON.parse(line);
  const props = feature.properties || {};
  if (!props.building && !props['building:part']) continue;
  const polygons: Ring[][] = feature.geometry.type === 'Polygon' ? [feature.geometry.coordinates]
    : feature.geometry.type === 'MultiPolygon' ? feature.geometry.coordinates : [];
  if (!polygons.length) continue;
  const osmId = `${props['@type'] === 'relation' ? 'r' : 'w'}${props['@id']}`;
  const building = {
    osmId, refBag: props['ref:bag'] ?? null, wikidata: null,
    part: !props.building && !!props['building:part'], rings: polygons.map(polygon => polygon[0]),
  };
  grid.add(building);
  if (building.part) continue;
  const year = yearFromStartDate(props.start_date);
  const typeIndex = BUILDING_TYPES.indexOf(props.building as BuildingType);
  const heritage = heritageLevel(props);
  if (!year && typeIndex < 0 && !heritage) continue;
  const [lng, lat] = ringCentroid(building.rings[0]);
  facts.push({ osmId, row: [year ?? 0, typeIndex, heritage], lng, lat });
}

const tiles = new Map<string, BuildingFactTile>();
let placed = 0;
for (const fact of facts) {
  const building = grid.byOsmId.get(fact.osmId)!;
  const ids = tileIdsDrawing(building, grid, tileIds);
  if (!ids.length) continue;
  const { x, y } = factTileOf(fact.lng, fact.lat);
  const key = `${x}/${y}`;
  const tile = tiles.get(key) ?? tiles.set(key, { version: 1, buildings: {} }).get(key)!;
  for (const id of ids) tile.buildings[shortBuildingId(id)] = fact.row;
  placed += ids.length;
}

const staging = path.join(directory, 'staging/building-facts');
await rm(staging, { recursive: true, force: true });
let bytes = 0;
for (const [key, tile] of tiles) {
  const [x, y] = key.split('/');
  await mkdir(path.join(staging, '14', x), { recursive: true });
  const gz = gzipSync(JSON.stringify(tile), { level: 9 });
  bytes += gz.length;
  await writeFile(path.join(staging, '14', x, `${y}.json.gz`), gz);
}
const withYear = facts.filter(fact => fact.row[0]).length;
process.stdout.write(`${facts.length} OSM buildings with facts (${withYear} dated); ${placed} tile buildings in ${tiles.size} tiles, ${(bytes / 1024 / 1024).toFixed(1)} MB gzipped\n`);

if (process.argv.includes('--publish')) {
  const published = path.join(directory, 'building-facts');
  await rm(published, { recursive: true, force: true });
  await rename(staging, published);
  process.stdout.write('published → building-facts/\n');
}
