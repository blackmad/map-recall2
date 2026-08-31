/**
 * Compile the cached 3DBAG CityJSON into one complete building table.
 *
 * This is the data half of Phase 1 in BUILDING_RENDERER_DESIGN.md: every pand
 * in the drivable city, with its real footprint and an AHN-measured height,
 * keyed by BAG id so appearance can be attached by identity later.
 *
 * What it replaces is worth stating plainly. The game ships 10,578 Amsterdam
 * buildings that carry any appearance tag, and heights that are the OSM
 * `height` tag where it exists and `levels * 3` or a flat 9 m where it does
 * not — so most of the skyline is invented. Every height here is measured.
 *
 * Output goes to a staging path and is not published into the versioned
 * extract by this script. It reports coverage and the diff against what ships
 * today so that promotion is a decision someone makes, not a side effect.
 *
 * Usage:
 *   npm run build:bag-buildings                 # amsterdam, from the cache
 *   npm run build:bag-buildings -- --limit=20   # first 20 tiles, for a quick look
 */

import { createWriteStream } from 'node:fs';
import { mkdir, readFile, readdir, stat } from 'node:fs/promises';
import { once } from 'node:events';
import path from 'node:path';
import { gunzipSync } from 'node:zlib';
import { BAG3D_VERSION } from '../src/canalRecall/bag3dTiles.js';
import { readBagBuildings, type BagBuilding, type BagHeightSource, type CityJson } from '../src/canalRecall/bag3dCityJson.js';

const flag = (name: string): string | undefined =>
  process.argv.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3);

const city = flag('city') ?? 'amsterdam';
const limit = Number(flag('limit') ?? Infinity);
const cacheDir = path.join('.cache', '3dbag', BAG3D_VERSION, 'tiles');
const stagingDir = path.join('public', 'data', 'extracts', city, 'staging');
const outputFile = path.join(stagingDir, 'bag-buildings.geojson');
const reportFile = path.join(stagingDir, 'bag-buildings.report.json');

/** Six decimals is about 7 cm here — finer than the footprints themselves. */
const round6 = (value: number): number => Math.round(value * 1e6) / 1e6;
const round2 = (value: number | null): number | null => (value === null ? null : Math.round(value * 100) / 100);

const tiles = (await readdir(cacheDir).catch(() => [] as string[])).filter(name => name.endsWith('.city.json.gz')).sort();
if (tiles.length === 0) {
  process.stderr.write(`no cached tiles in ${cacheDir} — run \`npm run fetch:3dbag\` first\n`);
  process.exit(1);
}

await mkdir(stagingDir, { recursive: true });
const output = createWriteStream(outputFile);
const write = async (chunk: string): Promise<void> => {
  if (!output.write(chunk)) await once(output, 'drain');
};

// --- tallies -----------------------------------------------------------------
const seen = new Set<string>();
const heightSources = new Map<BagHeightSource, number>();
const roofTypes = new Map<string, number>();
const statuses = new Map<string, number>();
const heights: number[] = [];
let duplicates = 0;
let noFootprint = 0;
let terraced = 0;
let withYear = 0;
let withRmse = 0;
let compressedBytes = 0;

const bump = <K>(counter: Map<K, number>, key: K): void => { counter.set(key, (counter.get(key) ?? 0) + 1); };

const asFeature = (building: BagBuilding): string => {
  const rings = building.rings.map(ring => ring.map(([lng, lat]) => [round6(lng), round6(lat)]));
  return JSON.stringify({
    type: 'Feature',
    properties: {
      bagId: building.bagId,
      height: round2(building.heightM),
      heightSource: building.heightSource,
      groundNap: round2(building.groundNapM),
      ridge: round2(building.ridgeM),
      roofType: building.roofType,
      year: building.constructionYear,
      storeys: building.storeys,
      partyWallArea: round2(building.partyWallAreaM2),
      groundArea: round2(building.groundAreaM2),
      rmseLod22: building.rmseLod22 === null ? null : Math.round(building.rmseLod22 * 1000) / 1000,
      status: building.status
    },
    // One surface is a Polygon; a pand split across several is a MultiPolygon.
    // Holes are not distinguished from separate surfaces at LoD0 in this
    // source, so each ring becomes its own polygon rather than guessing.
    geometry: rings.length === 1
      ? { type: 'Polygon', coordinates: rings }
      : { type: 'MultiPolygon', coordinates: rings.map(ring => [ring]) }
  });
};

await write('{"type":"FeatureCollection","features":[\n');
let written = 0;
let tileNumber = 0;
for (const name of tiles.slice(0, Number.isFinite(limit) ? limit : undefined)) {
  const file = path.join(cacheDir, name);
  compressedBytes += (await stat(file)).size;
  const tile = JSON.parse(gunzipSync(await readFile(file)).toString('utf8')) as CityJson;
  for (const building of readBagBuildings(tile)) {
    if (building.rings.length === 0) { noFootprint++; continue; }
    // 3DBAG assigns a pand to one tile, but a run over a re-tiled vintage
    // should not silently emit a building twice.
    if (seen.has(building.bagId)) { duplicates++; continue; }
    seen.add(building.bagId);

    bump(heightSources, building.heightSource);
    if (building.roofType) bump(roofTypes, building.roofType);
    if (building.status) bump(statuses, building.status);
    if (building.heightM !== null) heights.push(building.heightM);
    if ((building.partyWallAreaM2 ?? 0) > 0) terraced++;
    if (building.constructionYear !== null) withYear++;
    if (building.rmseLod22 !== null) withRmse++;

    await write(`${written === 0 ? '' : ',\n'}${asFeature(building)}`);
    written++;
  }
  tileNumber++;
  if (tileNumber % 25 === 0) process.stdout.write(`  ${tileNumber}/${tiles.length} tiles, ${written} buildings\n`);
}
await write('\n]}\n');
output.end();
await once(output, 'finish');

// --- what shipped before -----------------------------------------------------
const shippedFile = path.join('public', 'data', 'extracts', city, 'buildings-colored.geojson');
const shipped = await readFile(shippedFile, 'utf8').then(
  raw => (JSON.parse(raw) as { features: unknown[] }).features.length,
  () => null
);

const median = (values: number[]): number => (values.length === 0 ? 0 : [...values].sort((a, b) => a - b)[values.length >> 1]);
const share = (count: number): string => `${count} (${Math.round((count / written) * 100)}%)`;
const bytes = (await stat(outputFile)).size;

const report = {
  version: BAG3D_VERSION,
  city,
  generatedAt: new Date().toISOString(),
  tiles: tileNumber,
  buildings: written,
  duplicates,
  withoutFootprint: noFootprint,
  heightSources: Object.fromEntries(heightSources),
  medianHeightM: Math.round(median(heights) * 100) / 100,
  roofTypes: Object.fromEntries(roofTypes),
  statuses: Object.fromEntries(statuses),
  terraced,
  withConstructionYear: withYear,
  withRmseLod22: withRmse,
  shippedColoredBuildings: shipped,
  compressedSourceBytes: compressedBytes,
  outputBytes: bytes
};
await import('node:fs/promises').then(fs => fs.writeFile(reportFile, `${JSON.stringify(report, null, 2)}\n`));

process.stdout.write(`\n3DBAG ${BAG3D_VERSION} -> ${outputFile}\n`);
process.stdout.write(`  tiles          ${tileNumber} (${(compressedBytes / 1e6).toFixed(0)} MB gzipped source)\n`);
process.stdout.write(`  buildings      ${written}${duplicates ? `, ${duplicates} duplicate ids skipped` : ''}\n`);
process.stdout.write(`  height source  ${[...heightSources].map(([source, count]) => `${source} ${share(count)}`).join(', ')}\n`);
process.stdout.write(`  median height  ${report.medianHeightM} m\n`);
process.stdout.write(`  roof types     ${[...roofTypes].map(([type, count]) => `${type} ${count}`).join(', ')}\n`);
process.stdout.write(`  terraced       ${share(terraced)} share a party wall\n`);
process.stdout.write(`  build year     ${share(withYear)}\n`);
process.stdout.write(`  output         ${(bytes / 1e6).toFixed(1)} MB\n`);
if (shipped !== null) {
  process.stdout.write(`\n  ships today    ${shipped} buildings with appearance tags\n`);
  process.stdout.write(`  this staging   ${written} buildings, every height measured — ${(written / shipped).toFixed(1)}x coverage\n`);
}
process.stdout.write('\nStaging only. Review the report before publishing into the versioned extract.\n');
