/**
 * Download the 3DBAG CityJSON tiles covering a city, once, into a local cache.
 *
 * Phase 1 of BUILDING_RENDERER_DESIGN.md needs a footprint for every pand, and
 * the hosted 3D Tiles do not carry one — their geometry is meshopt-compressed
 * mesh with no ground polygon. CityJSON has the footprint (the LoD0
 * MultiSurface) plus all 62 attributes, but 3DBAG's OGC API serves it 100
 * features at a time, which is a few thousand requests for one city.
 *
 * The bulk path is `tile_index.fgb`: 290 tiles cover drivable Amsterdam, about
 * 320 MB gzipped, and the index publishes a SHA-256 for each so a cache can be
 * trusted rather than re-fetched. That is a one-time cost paid offline.
 *
 * The cache is deliberately outside the repository. These are large, they are
 * reproducible from a pinned version and a checksum, and the thing worth
 * committing is the compact building table built from them, not the source.
 *
 * Usage:
 *   npm run fetch:3dbag                      # drivable Amsterdam
 *   npm run fetch:3dbag -- --dry-run         # what it would fetch, and how big
 *   npm run fetch:3dbag -- --bbox=4.8,52.3,4.95,52.4
 *   npm run fetch:3dbag -- --city=utrecht --concurrency=2
 */

import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { BAG3D_VERSION } from '../src/canalRecall/bag3dTiles.js';
import { overlappingPairs, readTileIndex, tilesForBbox, type Bag3dTile } from '../src/canalRecall/bag3dTileIndex.js';

const TILE_INDEX_URL = `https://data.3dbag.nl/${BAG3D_VERSION}/tile_index.fgb`;
const CACHE_ROOT = path.join('.cache', '3dbag', BAG3D_VERSION);
const USER_AGENT = 'MapRecallBuildingCompiler/1.0 (+https://github.com/blackmad/map-recall)';

const flag = (name: string): string | undefined =>
  process.argv.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const has = (name: string): boolean => process.argv.includes(`--${name}`);

const city = flag('city') ?? 'amsterdam';
const marginM = Number(flag('margin') ?? 500);
const concurrency = Math.max(1, Number(flag('concurrency') ?? 4));
const dryRun = has('dry-run');

type Bbox = { west: number; south: number; east: number; north: number };

/**
 * The area a city needs buildings for: everywhere it can drive.
 *
 * Taken from the routing extract rather than written down, so that widening
 * the drivable area cannot silently leave a rim of the map without buildings.
 * A literal `--bbox` overrides it for probing a single neighbourhood.
 */
async function drivableBbox(cityId: string): Promise<Bbox> {
  const literal = flag('bbox');
  if (literal) {
    const [west, south, east, north] = literal.split(',').map(Number);
    if (![west, south, east, north].every(Number.isFinite)) throw new Error('--bbox needs west,south,east,north');
    return { west, south, east, north };
  }
  const file = path.join('public', 'data', 'extracts', cityId, 'streets-routing.json');
  const routing = JSON.parse(await readFile(file, 'utf8')) as Record<string, { path?: [number, number][]; paths?: [number, number][][] }>;
  const bbox: Bbox = { west: 180, south: 90, east: -180, north: -90 };
  let points = 0;
  for (const street of Object.values(routing)) {
    for (const line of street.paths ?? (street.path ? [street.path] : [])) {
      for (const [lat, lng] of line) {
        points++;
        bbox.west = Math.min(bbox.west, lng);
        bbox.east = Math.max(bbox.east, lng);
        bbox.south = Math.min(bbox.south, lat);
        bbox.north = Math.max(bbox.north, lat);
      }
    }
  }
  if (points === 0) throw new Error(`${file} has no route geometry to bound`);
  return bbox;
}

const sha256 = (bytes: Uint8Array): string => createHash('sha256').update(bytes).digest('hex');
const megabytes = (bytes: number): string => `${(bytes / 1e6).toFixed(1)} MB`;

async function download(url: string, attempts = 3): Promise<Uint8Array> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return new Uint8Array(await response.arrayBuffer());
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await new Promise(resolve => setTimeout(resolve, 500 * 2 ** attempt));
    }
  }
  throw new Error(`${url}: ${lastError instanceof Error ? lastError.message : String(lastError)}`);
}

/** Fetch a file unless the cache already holds it with the published checksum. */
async function cached(file: string, url: string, expectedSha256: string): Promise<{ bytes: number; fetched: boolean }> {
  const existing = await readFile(file).catch(() => null);
  if (existing && (!expectedSha256 || sha256(existing) === expectedSha256)) {
    return { bytes: existing.byteLength, fetched: false };
  }
  const bytes = await download(url);
  // A tile that does not match its published hash is a corrupt transfer or a
  // republished vintage; either way, writing it would poison every later run.
  if (expectedSha256 && sha256(bytes) !== expectedSha256) {
    throw new Error(`${url}: checksum mismatch against the tile index — is BAG3D_VERSION stale?`);
  }
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, bytes);
  return { bytes: bytes.byteLength, fetched: true };
}

/** Run `worker` over `items`, at most `limit` at a time, in order. */
async function pooled<T>(items: T[], limit: number, worker: (item: T, index: number) => Promise<void>): Promise<void> {
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const index = next++;
        await worker(items[index], index);
      }
    })
  );
}

const tilePath = (tile: Bag3dTile): string => path.join(CACHE_ROOT, 'tiles', `${tile.tileId.replace(/\//g, '-')}.city.json.gz`);

// --- select ------------------------------------------------------------------
await mkdir(CACHE_ROOT, { recursive: true });
const indexFile = path.join(CACHE_ROOT, 'tile_index.fgb');
if (!(await stat(indexFile).catch(() => null))) {
  process.stdout.write(`fetching tile index ${BAG3D_VERSION}\n`);
  await writeFile(indexFile, await download(TILE_INDEX_URL));
}
const allTiles = readTileIndex(await readFile(indexFile));
const bbox = await drivableBbox(city);
const tiles = tilesForBbox(allTiles, bbox, marginM);

const overlaps = overlappingPairs(tiles);
if (overlaps.length > 0) {
  // Every building would be counted once per level. Better to stop than to
  // publish a city with duplicated, z-fighting geometry.
  throw new Error(
    `the tile index is no longer leaf-only: ${overlaps.length} overlapping pairs, e.g. ${overlaps[0].join(' / ')}. ` +
    'Tile selection must walk the tree instead of filtering by bounds.'
  );
}

const byLevel = new Map<number, number>();
for (const tile of tiles) byLevel.set(tile.level, (byLevel.get(tile.level) ?? 0) + 1);
process.stdout.write(`3DBAG ${BAG3D_VERSION} for ${city}\n`);
process.stdout.write(`  area      ${[bbox.west, bbox.south, bbox.east, bbox.north].map(v => v.toFixed(4)).join(', ')} +${marginM} m\n`);
process.stdout.write(`  tiles     ${tiles.length} of ${allTiles.length}, no overlaps\n`);
process.stdout.write(`  levels    ${[...byLevel].sort((a, b) => a[0] - b[0]).map(([level, count]) => `L${level}:${count}`).join('  ')}\n`);

if (dryRun) {
  const onDisk = await readdir(path.join(CACHE_ROOT, 'tiles')).catch(() => [] as string[]);
  process.stdout.write(`  cached    ${onDisk.length} tiles already on disk\n`);
  process.stdout.write('\ndry run: nothing downloaded\n');
  process.exit(0);
}

// --- fetch -------------------------------------------------------------------
let fetched = 0;
let reused = 0;
let bytes = 0;
let done = 0;
const failures: string[] = [];

await pooled(tiles, concurrency, async tile => {
  try {
    const result = await cached(tilePath(tile), tile.cityJsonUrl, tile.cityJsonSha256);
    bytes += result.bytes;
    if (result.fetched) fetched++;
    else reused++;
  } catch (error) {
    failures.push(`${tile.tileId}: ${error instanceof Error ? error.message : String(error)}`);
  }
  done++;
  if (done % 20 === 0 || done === tiles.length) {
    process.stdout.write(`  ${String(done).padStart(4)}/${tiles.length} tiles  ${megabytes(bytes)}\n`);
  }
});

process.stdout.write(`\n  downloaded ${fetched}, reused ${reused}, ${megabytes(bytes)} in ${CACHE_ROOT}/tiles\n`);
if (failures.length > 0) {
  process.stdout.write(`  failed ${failures.length}:\n    ${failures.slice(0, 10).join('\n    ')}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write('  every selected tile is present and matches its published checksum\n');
}
