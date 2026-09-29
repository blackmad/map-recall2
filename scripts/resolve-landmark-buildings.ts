/**
 * Resolve every landmark to the streamed building(s) it is about, exactly, from
 * the local OSM extract. The rules are in `lib/landmarkBuildings.ts`.
 *
 * Writes `staging/landmark-buildings.json` with how each landmark resolved and
 * a coverage report; `--publish` also writes `landmark-buildings.json`, which
 * the runtime loads to light up a card's building by id instead of guessing
 * from distance.
 *
 * Needs `osmium` and `.cache/osm-source/Amsterdam.osm.pbf` (see
 * `refresh-city-extract.sh`).
 *
 * Usage: npm run resolve:landmark-buildings [-- --publish]
 */
import { execFile } from 'node:child_process';
import { createReadStream } from 'node:fs';
import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createInterface } from 'node:readline';
import { promisify } from 'node:util';
import { gunzipSync } from 'node:zlib';
import {
  BuildingGrid, resolveLandmarkBuildings, type LandmarkSource, type OsmBuilding, type Ring,
} from './lib/landmarkBuildings.ts';

const run = promisify(execFile);
const directory = path.resolve('public/data/extracts/amsterdam');
const pbf = path.resolve('.cache/osm-source/Amsterdam.osm.pbf');
const work = path.resolve('.cache/osm-source/derived');
await mkdir(work, { recursive: true });

// Building ways and relations with their tags, re-derived when the PBF changes.
const buildingsPbf = path.join(work, 'amsterdam-buildings.osm.pbf');
const buildingsSeq = path.join(work, 'amsterdam-buildings.geojsonseq');
const namedPbf = path.join(work, 'amsterdam-named-nodes.osm.pbf');
const namedSeq = path.join(work, 'amsterdam-named-nodes.geojsonseq');
const pbfTime = (await stat(pbf)).mtimeMs;
const stale = async (file: string) => stat(file).then(s => s.mtimeMs < pbfTime, () => true);
if (await stale(buildingsSeq)) {
  await run('osmium', ['tags-filter', '-O', pbf, 'wr/building', 'wr/building:part', '-o', buildingsPbf]);
  await run('osmium', ['export', '-O', buildingsPbf, '--attributes=type,id', '--geometry-types=polygon', '-f', 'geojsonseq', '-o', buildingsSeq]);
}
if (await stale(namedSeq)) {
  await run('osmium', ['tags-filter', '-O', '-R', pbf, 'n/name', '-o', namedPbf]);
  await run('osmium', ['export', '-O', namedPbf, '--geometry-types=point', '-f', 'geojsonseq', '-o', namedSeq]);
}

// Every id the building tiles carry.
const tileIds = new Set<string>();
const tileRoot = path.join(directory, 'building-tiles');
for (const x of await readdir(path.join(tileRoot, '14'))) {
  for (const file of await readdir(path.join(tileRoot, '14', x))) {
    if (!file.endsWith('.geojson.gz')) continue;
    const collection = JSON.parse(gunzipSync(await readFile(path.join(tileRoot, '14', x, file))).toString('utf8'));
    for (const feature of collection.features) if (feature.properties?.id) tileIds.add(String(feature.properties.id));
  }
}

const grid = new BuildingGrid();
const lines = createInterface({ input: createReadStream(buildingsSeq) });
for await (const raw of lines) {
  const line = raw.replace(/^\x1e/, '');
  if (!line) continue;
  const feature = JSON.parse(line);
  const polygons: Ring[][] = feature.geometry.type === 'Polygon' ? [feature.geometry.coordinates]
    : feature.geometry.type === 'MultiPolygon' ? feature.geometry.coordinates : [];
  if (!polygons.length) continue;
  // Untagged member ways of a building relation come out as areas too.
  if (!feature.properties?.building && !feature.properties?.['building:part']) continue;
  // Only the outer rings matter here; the first is used for containment.
  const building: OsmBuilding = {
    osmId: `${feature.properties['@type'] === 'relation' ? 'r' : 'w'}${feature.properties['@id']}`,
    refBag: feature.properties?.['ref:bag'] ?? null,
    wikidata: feature.properties?.wikidata ?? null,
    part: !feature.properties?.building && !!feature.properties?.['building:part'],
    rings: polygons.map(polygon => polygon[0]),
  };
  grid.add(building);
}

// Landmarks. The extract keeps geometry, name and Wikidata but not the OSM id,
// so a node landmark's tags are found by name near its point.
interface LandmarkFeature {
  id: string; name: string; osmName?: string; wikidata?: string;
  center?: [number, number]; path?: Array<[number, number]>; paths?: Array<Array<[number, number]>>;
}
const landmarkFile = JSON.parse(await readFile(path.join(directory, 'landmarks.json'), 'utf8'));
const landmarks = (Array.isArray(landmarkFile) ? landmarkFile : landmarkFile.features) as LandmarkFeature[];
const outlineOf = (landmark: LandmarkFeature): Ring[] =>
  (landmark.paths || (landmark.path ? [landmark.path] : []))
    .filter(ring => ring.length > 3)
    .map(ring => ring.map(([lat, lng]) => [lng, lat] as [number, number]));
const key = (name: string) => name.normalize('NFC').toLocaleLowerCase('nl').replace(/\s+/g, ' ').trim();
const wantedNames = new Set(landmarks.flatMap(landmark => [landmark.name, landmark.osmName].filter((n): n is string => !!n).map(key)));
const wantedItems = new Set(landmarks.map(landmark => landmark.wikidata).filter((q): q is string => !!q));
const namedNodes = new Map<string, Array<{ lng: number; lat: number; tags: Record<string, string> }>>();
for await (const raw of createInterface({ input: createReadStream(namedSeq) })) {
  const line = raw.replace(/^\x1e/, '');
  if (!line) continue;
  const feature = JSON.parse(line);
  const name = feature.properties?.name;
  const wikidata = feature.properties?.wikidata;
  // English landmark names ("Dutch Resistance Museum") miss the Dutch node
  // name, so a node is also found by its Wikidata item.
  const keys = [name && wantedNames.has(key(name)) ? key(name) : null, wikidata && wantedItems.has(wikidata) ? wikidata : null]
    .filter((k): k is string => !!k);
  const [lng, lat] = feature.geometry.coordinates;
  for (const k of keys) (namedNodes.get(k) ?? namedNodes.set(k, []).get(k)!).push({ lng, lat, tags: feature.properties });
}
/** Metres a named node may be from the landmark's point to be its node. */
const NODE_MATCH_METRES = 30;
function nodeFor(landmark: LandmarkFeature, lng: number, lat: number): { lng: number; lat: number; tags: Record<string, string> } | null {
  let best: { lng: number; lat: number; tags: Record<string, string> } | null = null, bestMetres = NODE_MATCH_METRES;
  for (const k of [landmark.wikidata, landmark.osmName && key(landmark.osmName), key(landmark.name)]) {
    for (const node of k ? namedNodes.get(k) ?? [] : []) {
      const metres = Math.hypot((node.lng - lng) * 111_320 * Math.cos(lat * Math.PI / 180), (node.lat - lat) * 110_540);
      if (metres < bestMetres) { best = node; bestMetres = metres; }
    }
  }
  return best;
}

const results: Array<{ id: string; name: string; buildingIds: string[]; how: string }> = [];
const counts: Record<string, number> = {};
for (const landmark of landmarks) {
  const center = landmark.center || landmark.path?.[0];
  if (!center) continue;
  const outline = outlineOf(landmark);
  // The extract's point can sit a few metres from the OSM node (a merged
  // feature's centre); the node is where the mapper put the place.
  const node = outline.length ? null : nodeFor(landmark, center[1], center[0]);
  const source: LandmarkSource = {
    id: landmark.id,
    wikidata: landmark.wikidata || null,
    point: node ? [node.lng, node.lat] : [center[1], center[0]],
    outline,
    nodeTags: node?.tags ?? null,
  };
  const match = resolveLandmarkBuildings(source, grid, tileIds);
  counts[match.how] = (counts[match.how] || 0) + 1;
  results.push({ id: landmark.id, name: landmark.name, ...match });
}

const staged = { version: 1, generated: new Date().toISOString().slice(0, 10), counts, landmarks: results };
await mkdir(path.join(directory, 'staging'), { recursive: true });
await writeFile(path.join(directory, 'staging/landmark-buildings.json'), `${JSON.stringify(staged, null, 1)}\n`);
process.stdout.write(`${results.length} landmarks, ${tileIds.size} tile buildings, ${grid.byOsmId.size} OSM buildings\n`);
for (const [how, count] of Object.entries(counts).sort((a, b) => b[1] - a[1])) process.stdout.write(`  ${how}: ${count}\n`);

if (process.argv.includes('--publish')) {
  const published = {
    version: 1,
    source: 'OSM building ways (ref:bag) joined to the building tiles; scripts/resolve-landmark-buildings.ts',
    buildings: Object.fromEntries(results.filter(result => result.buildingIds.length).map(result => [result.id, result.buildingIds])),
  };
  await writeFile(path.join(directory, 'landmark-buildings.json'), `${JSON.stringify(published)}\n`);
  process.stdout.write(`published ${Object.keys(published.buildings).length} → landmark-buildings.json\n`);
}
