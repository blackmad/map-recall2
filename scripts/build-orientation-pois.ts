/**
 * The game's own POI layer, from the local OSM extract.
 *
 * Classifies named places with `src/canalRecall/poiCatalog.ts`, keeps those
 * inside the streamed building tiles, drops what another layer already draws
 * (Albert Heijn's brand icons; landmarks' own dots), and records which roofline each label belongs on: the height of the
 * streamed building the place is in, joined exactly as landmarks are
 * (`lib/landmarkBuildings.ts`).
 *
 * Writes `staging/orientation-pois.json` and a report; `--publish` writes the
 * compact `orientation-pois.json` the map loads.
 *
 * Usage: npm run build:orientation-pois [-- --publish]
 */
import { execFile } from 'node:child_process';
import { createReadStream } from 'node:fs';
import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createInterface } from 'node:readline';
import { promisify } from 'node:util';
import { gunzipSync } from 'node:zlib';
import { BuildingGrid, pointInRing, ringCentroid, tileIdsDrawing, type OsmBuilding, type Ring } from './lib/landmarkBuildings.ts';
import { classifyPoi, heightBand, POI_CATEGORIES, rankPoi, type HeightBand, type PoiCategory } from '../src/canalRecall/poiCatalog.ts';

const run = promisify(execFile);
const directory = path.resolve('public/data/extracts/amsterdam');
const pbf = path.resolve('.cache/osm-source/Amsterdam.osm.pbf');
const work = path.resolve('.cache/osm-source/derived');
await mkdir(work, { recursive: true });
const pbfTime = (await stat(pbf)).mtimeMs;
const stale = async (file: string) => stat(file).then(s => s.mtimeMs < pbfTime, () => true);

const buildingsSeq = path.join(work, 'amsterdam-buildings.geojsonseq');
if (await stale(buildingsSeq)) throw new Error('Run `npm run resolve:landmark-buildings` first; it derives the building export.');
const placesPbf = path.join(work, 'amsterdam-places.osm.pbf');
const placesSeq = path.join(work, 'amsterdam-places.geojsonseq');
if (await stale(placesSeq)) {
  await run('osmium', ['tags-filter', '-O', pbf, 'nwr/amenity', 'nwr/shop', 'nwr/tourism', 'nwr/leisure', '-o', placesPbf]);
  await run('osmium', ['export', '-O', placesPbf, '--attributes=type,id', '-f', 'geojsonseq', '-o', placesSeq]);
}

// Tile coverage and building heights.
const heights = new Map<string, number>();
const tiles = new Set<string>();
const tileRoot = path.join(directory, 'building-tiles', '14');
for (const x of await readdir(tileRoot)) {
  for (const file of await readdir(path.join(tileRoot, x))) {
    if (!file.endsWith('.geojson.gz')) continue;
    tiles.add(`${x}/${file.split('.')[0]}`);
    const collection = JSON.parse(gunzipSync(await readFile(path.join(tileRoot, x, file))).toString('utf8'));
    for (const feature of collection.features) {
      const id = feature.properties?.id;
      if (id) heights.set(String(id), Math.max(heights.get(String(id)) ?? 0, Number(feature.properties.height) || 0));
    }
  }
}
const tileOf = (lng: number, lat: number) => {
  const n = 2 ** 14;
  const x = Math.floor((lng + 180) / 360 * n);
  const y = Math.floor((1 - Math.asinh(Math.tan(lat * Math.PI / 180)) / Math.PI) / 2 * n);
  return `${x}/${y}`;
};
const tileIds = new Set(heights.keys());

const grid = new BuildingGrid();
for await (const raw of createInterface({ input: createReadStream(buildingsSeq) })) {
  const line = raw.replace(/^\x1e/, '');
  if (!line) continue;
  const feature = JSON.parse(line);
  const props = feature.properties || {};
  if (!props.building && !props['building:part']) continue;
  const polygons: Ring[][] = feature.geometry.type === 'Polygon' ? [feature.geometry.coordinates]
    : feature.geometry.type === 'MultiPolygon' ? feature.geometry.coordinates : [];
  if (!polygons.length) continue;
  grid.add({
    osmId: `${props['@type'] === 'relation' ? 'r' : 'w'}${props['@id']}`,
    refBag: props['ref:bag'] ?? null, wikidata: props.wikidata ?? null,
    part: !props.building && !!props['building:part'],
    rings: polygons.map(polygon => polygon[0]),
  });
}

/** The height of the streamed building a point is in, or null outdoors. */
function heightAt(lng: number, lat: number): number | null {
  const containing = grid.near(lng, lat).filter(b => !b.part && pointInRing(lng, lat, b.rings[0]));
  for (const building of containing) {
    const ids = tileIdsDrawing(building, grid, tileIds);
    if (ids.length) return Math.max(...ids.map(id => heights.get(id) ?? 0));
  }
  return null;
}

// What other layers draw already.
const key = (name: string) => name.normalize('NFC').toLocaleLowerCase('nl').replace(/\s+/g, ' ').trim();
const metres = (a: [number, number], b: [number, number]) =>
  Math.hypot((a[0] - b[0]) * 111_320 * Math.cos(a[1] * Math.PI / 180), (a[1] - b[1]) * 110_540);
const drawn = new Map<string, Array<[number, number]>>();
const remember = (name: string, lng: number, lat: number) =>
  (drawn.get(key(name)) ?? drawn.set(key(name), []).get(key(name))!).push([lng, lat]);
// Only the branded ones: those draw with their icon by default. The
// `local-food` names show only with every label on, so ours carry them.
for (const poi of JSON.parse(await readFile(path.join(directory, 'branded-pois.json'), 'utf8')) as Array<{ name: string; kind: string; center: [number, number] }>) {
  if (poi.kind !== 'local-food') remember(poi.name, poi.center[1], poi.center[0]);
}
const landmarkFile = JSON.parse(await readFile(path.join(directory, 'landmarks.json'), 'utf8'));
const landmarkItems = new Set<string>();
for (const landmark of (Array.isArray(landmarkFile) ? landmarkFile : landmarkFile.features) as Array<{ name: string; osmName?: string; wikidata?: string; center?: [number, number] }>) {
  if (landmark.wikidata) landmarkItems.add(landmark.wikidata);
  if (!landmark.center) continue;
  for (const name of [landmark.name, landmark.osmName]) if (name) remember(name, landmark.center[1], landmark.center[0]);
}
const DUPLICATE_METRES = 120;

interface Poi { name: string; lng: number; lat: number; category: PoiCategory; rank: number; band: HeightBand; osm: string }
const pois: Poi[] = [];
const dropped: Record<string, number> = { unclassified: 0, outside: 0, duplicate: 0 };
for await (const raw of createInterface({ input: createReadStream(placesSeq) })) {
  const line = raw.replace(/^\x1e/, '');
  if (!line) continue;
  const feature = JSON.parse(line);
  const tags = feature.properties || {};
  const poiClass = classifyPoi(tags);
  if (!poiClass) { dropped.unclassified++; continue; }
  const geometry = feature.geometry;
  let lng: number, lat: number;
  if (geometry.type === 'Point') [lng, lat] = geometry.coordinates;
  else if (geometry.type === 'Polygon') [lng, lat] = ringCentroid(geometry.coordinates[0]);
  else if (geometry.type === 'MultiPolygon') [lng, lat] = ringCentroid(geometry.coordinates[0][0]);
  else continue;
  if (!tiles.has(tileOf(lng, lat))) { dropped.outside++; continue; }
  if ((tags.wikidata && landmarkItems.has(tags.wikidata))
    || (drawn.get(key(tags.name)) ?? []).some(point => metres(point, [lng, lat]) < DUPLICATE_METRES)) {
    dropped.duplicate++; continue;
  }
  // Parks and markets are outdoors: their label stays on the ground.
  const outdoors = poiClass.category === 'leisure' || poiClass.category === 'market';
  pois.push({
    name: tags.name, lng: Math.round(lng * 1e6) / 1e6, lat: Math.round(lat * 1e6) / 1e6,
    category: poiClass.category,
    rank: rankPoi(tags, poiClass, geometry.type !== 'Point'),
    band: outdoors ? 'ground' : heightBand(heightAt(lng, lat)),
    osm: `${tags['@type']?.[0] ?? ''}${tags['@id'] ?? ''}`,
  });
}

// The same place mapped as a node and as its building: keep the higher rank.
pois.sort((a, b) => b.rank - a.rank || a.osm.localeCompare(b.osm));
const kept: Poi[] = [];
const seen = new Map<string, Array<[number, number]>>();
for (const poi of pois) {
  const near = seen.get(key(poi.name)) ?? [];
  if (near.some(point => metres(point, [poi.lng, poi.lat]) < DUPLICATE_METRES)) { dropped.duplicate++; continue; }
  near.push([poi.lng, poi.lat]); seen.set(key(poi.name), near);
  kept.push(poi);
}

const byCategory: Record<string, number> = {}, byBand: Record<string, number> = {};
for (const poi of kept) { byCategory[poi.category] = (byCategory[poi.category] || 0) + 1; byBand[poi.band] = (byBand[poi.band] || 0) + 1; }
await writeFile(path.join(directory, 'staging/orientation-pois.json'),
  `${JSON.stringify({ generated: new Date().toISOString().slice(0, 10), byCategory, byBand, dropped, pois: kept }, null, 1)}\n`);
process.stdout.write(`${kept.length} POIs; dropped ${JSON.stringify(dropped)}\n  by category ${JSON.stringify(byCategory)}\n  by band ${JSON.stringify(byBand)}\n`);

if (process.argv.includes('--publish')) {
  const bands: HeightBand[] = ['ground', 'low', 'mid', 'high'];
  const published = {
    version: 1,
    source: '© OpenStreetMap contributors (ODbL); scripts/build-orientation-pois.ts',
    categories: POI_CATEGORIES,
    bands,
    // [name, lng, lat, category index, rank, band index]
    pois: kept.map(poi => [poi.name, poi.lng, poi.lat, POI_CATEGORIES.indexOf(poi.category), poi.rank, bands.indexOf(poi.band)]),
  };
  const text = `${JSON.stringify(published)}\n`;
  await writeFile(path.join(directory, 'orientation-pois.json'), text);
  process.stdout.write(`published → orientation-pois.json (${(text.length / 1024).toFixed(0)} KB)\n`);
}
