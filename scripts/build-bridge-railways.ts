/**
 * Mark which published bridges carry a railway, and which carry a road.
 *
 * "Gooilijn", "Oude Lijn" and "Westelijke Ringspoorbaan" are railway *lines*,
 * not bridges, and the game was asking about their viaducts one span at a time
 * — 17 separate questions for the Westelijke Ringspoorbaan. Cycling under a
 * viaduct is not a bridge you can name, so the question has no answer a player
 * could learn.
 *
 * Nothing in the extract distinguished the two: 212 of 300 bridges carry no
 * `highway` tag at all, the Hoge Sluis and Magere Brug among them, so absence
 * of a road class proves nothing. This pass sources the missing tag from OSM
 * once and bakes it into the extract, so the runtime stays offline.
 *
 * Name matching alone is not enough — OSM has railway bridges named
 * "Keizersgracht" and "Prinsengracht", after the water they cross, and those
 * names are also real canal-ring road bridges. So a published bridge is matched
 * to OSM ways by name *and* proximity to its own crossings, and a bridge that
 * matches both a railway and a road way keeps its question: plenty of
 * Amsterdam bridges carry trams, trains and traffic together.
 *
 *   npx tsx scripts/build-bridge-railways.ts
 *   npx tsx scripts/build-bridge-railways.ts --publish
 *   npx tsx scripts/build-bridge-railways.ts --directory=public/data/extracts/utrecht
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { BridgeCrossingIndex } from '../src/canalRecall/bridgeCrossings';
import { metresBetween } from '../src/canalRecall/bridgeDistractors';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const directoryArgument = process.argv.find((argument) => argument.startsWith('--directory='));
const extractDir = resolve(root, directoryArgument?.slice('--directory='.length) || 'public/data/extracts/amsterdam');
const publishedPath = resolve(extractDir, 'bridges.json');
const stagingPath = resolve(extractDir, 'staging/bridges.json');
/** The Overpass answer is cached so a re-run is offline and reproducible. */
const cachePath = resolve(extractDir, 'staging/osm-bridge-ways.json');

/**
 * Ask Overpass about the city this extract actually covers, taken from its own
 * municipality boundary rather than a second constant. The hand-written
 * Amsterdam box stopped at longitude 5.02 while the municipality reaches 5.108,
 * so bridges out past Zeeburg were never offered a railway tag at all and kept
 * their question by default — the failure this pass exists to prevent.
 */
function boundingBox(): string {
  const areas = JSON.parse(readFileSync(resolve(extractDir, 'boundaries.json'), 'utf8')) as
    Array<{ kind?: string; bounds?: { minlat: number; minlon: number; maxlat: number; maxlon: number } }>;
  const bounds = areas.find((area) => area.kind === 'municipality')?.bounds;
  if (!bounds) throw new Error(`No municipality boundary in ${extractDir}/boundaries.json`);
  // A span may sit just outside the administrative line it crosses.
  const margin = 0.01;
  return [bounds.minlat - margin, bounds.minlon - margin, bounds.maxlat + margin, bounds.maxlon + margin]
    .map((value) => value.toFixed(4)).join(',');
}

const BBOX = boundingBox();
/** A span and its OSM way should agree closely; this is slack, not a search. */
const MATCH_METRES = 250;

interface BridgeFeature {
  id: string;
  name: string;
  center: [number, number];
  carriesRailway?: boolean;
  carriesRoad?: boolean;
  [key: string]: unknown;
}
interface OsmWay {
  id: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

function normalise(value: string): string {
  return value.normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

async function loadOsmBridgeWays(): Promise<OsmWay[]> {
  if (existsSync(cachePath)) {
    console.log(`Using cached OSM answer: ${cachePath.replace(`${root}/`, '')}`);
    return JSON.parse(readFileSync(cachePath, 'utf8')).elements as OsmWay[];
  }
  const query = `[out:json][timeout:120];way["bridge"]["name"](${BBOX});out tags center;`;
  console.log(`Querying Overpass for named bridge ways in ${BBOX}…`);
  // Overpass answers 406 to a client that does not identify itself.
  const response = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'map-recall/1.0 (Canal Recall extract builder)',
    },
    body: new URLSearchParams({ data: query }),
  });
  if (!response.ok) throw new Error(`Overpass returned ${response.status}`);
  const payload = await response.json();
  mkdirSync(dirname(cachePath), { recursive: true });
  writeFileSync(cachePath, JSON.stringify(payload));
  return payload.elements as OsmWay[];
}

const bridges = JSON.parse(readFileSync(publishedPath, 'utf8')) as BridgeFeature[];
const crossings = JSON.parse(
  readFileSync(resolve(extractDir, 'bridge-crossings.json'), 'utf8'),
) as BridgeCrossingIndex;
const ways = await loadOsmBridgeWays();

const byName = new Map<string, OsmWay[]>();
for (const way of ways) {
  const name = way.tags?.name;
  if (!name || !way.center) continue;
  const key = normalise(name);
  if (!byName.has(key)) byName.set(key, []);
  byName.get(key)!.push(way);
}
console.log(`OSM named bridge ways: ${ways.length} (${byName.size} distinct names)`);

let rail = 0, road = 0, both = 0, unmatched = 0;
const railOnly: BridgeFeature[] = [];
for (const bridge of bridges) {
  const candidates = byName.get(normalise(bridge.name || '')) ?? [];
  // Compare against every crossing this bridge resolves into, not just its
  // centroid: a name like IJburglaan is five crossings kilometres apart.
  const points: Array<[number, number]> = [
    bridge.center,
    ...(crossings.bridges[bridge.id] ?? []).map((crossing) => crossing.center as [number, number]),
  ];
  const near = candidates.filter((way) => points.some(
    (point) => metresBetween(point, [way.center!.lat, way.center!.lon]) <= MATCH_METRES,
  ));
  if (near.length === 0) { unmatched++; continue; }
  const carriesRailway = near.some((way) => !!way.tags?.railway);
  const carriesRoad = near.some((way) => !!way.tags?.highway);
  bridge.carriesRailway = carriesRailway;
  bridge.carriesRoad = carriesRoad;
  if (carriesRailway && carriesRoad) both++;
  else if (carriesRailway) { rail++; railOnly.push(bridge); }
  else if (carriesRoad) road++;
}

const crossingsOf = (bridge: BridgeFeature) => (crossings.bridges[bridge.id] ?? []).length;
const silenced = railOnly.reduce((sum, bridge) => sum + crossingsOf(bridge), 0);
console.log('');
console.log(`Bridges:                 ${bridges.length}`);
console.log(`  railway only:          ${rail}  (${silenced} crossings will stop being asked)`);
console.log(`  road only:             ${road}`);
console.log(`  both road and rail:    ${both}  (still asked — trams and trains share plenty of bridges)`);
console.log(`  no OSM match:          ${unmatched}  (left alone)`);
console.log('');
console.log('Railway-only bridges, by how many questions they were generating:');
for (const bridge of railOnly.sort((a, b) => crossingsOf(b) - crossingsOf(a)).slice(0, 12)) {
  console.log(`  ${String(crossingsOf(bridge)).padStart(3)} × ${bridge.name}`);
}

const target = process.argv.includes('--publish') ? publishedPath : stagingPath;
mkdirSync(dirname(target), { recursive: true });
writeFileSync(target, JSON.stringify(bridges));
console.log('');
console.log(`Wrote ${target.replace(`${root}/`, '')}`);
if (target === stagingPath) console.log('Review, then re-run with --publish.');
