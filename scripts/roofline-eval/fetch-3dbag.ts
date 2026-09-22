/**
 * Cache 3DBAG LoD2.2 CityJSONFeatures for the A0 canal-belt strip buildings.
 *
 * Task A3. The strips are cut from 3DBAG wall planes, so every wall in the A0
 * manifest already names the pand it came from; there is no spatial matching to
 * do. What is needed is the geometry itself, offline and version-pinned, so the
 * reconciliation step (G1) and every later re-run answer to a fixed 3DBAG
 * release instead of to whatever the API serves that afternoon.
 *
 * This follows the T3 cache pattern (`scripts/pointcloud/measure-tile.ts`):
 * a warm cache is read in preference to the network, the 3DBAG release travels
 * with it, and `--refresh` is the only thing that refetches. The one difference
 * is the key — T3 keys by tile bbox because it fetches by bbox, while this
 * fetches one pand at a time so it keys by the pand set.
 *
 * The wall-endpoint check needs the A0 manifest, which may not exist yet. It is
 * optional here: pass `--manifest=<A0 manifest.json>` and any record carrying
 * `start`/`end` is measured against that pand's `WallSurface`s with
 * `matchWallSurface` (offset ≤ 0.5 m, angle ≤ 5°). Mismatches are written to
 * `wall-match.json` marked `excluded`; with the fetch-only manifest the check is
 * skipped and only the cache is written.
 *
 * Outputs (all under `$ROOFLINE_CACHE/roofline-eval/3dbag/`):
 *   3dbag-strips.json   the cache: pinned release + one entry per pand
 *   wall-match.json     only when the manifest carries wall endpoints
 *   overlay-plan.png    a plan view of a few fetched buildings
 *
 * Usage:
 *   node --import tsx scripts/roofline-eval/fetch-3dbag.ts
 *   node --import tsx scripts/roofline-eval/fetch-3dbag.ts --refresh
 *   node --import tsx scripts/roofline-eval/fetch-3dbag.ts \
 *     --manifest=.cache/facade-twin/strips-roofline-v1/manifest.json
 */
import { createHash } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { extractFacadeWallPlanes } from '../../src/canalRecall/building/facadePointCloud.ts';
import {
  matchWallSurface,
  WALL_ANGLE_TOLERANCE_DEG,
  WALL_OFFSET_TOLERANCE_M,
  type A0WallFrame,
  type WallSurfaceMatch,
} from '../../src/canalRecall/facade/wallSurfaceMatch.ts';
import { encodePng } from '../pointcloud/png.ts';

/** Task A3 writes into the shared roofline cache, not into this worktree. */
const DEFAULT_ROOFLINE_CACHE = '/Users/blackmad/Code/map-recall2/.worktrees/amsterdam-facade-rebuild/.cache';
/** The set of pand IDs A0 re-cuts, so the cache can be warmed before A0 lands. */
const DEFAULT_MANIFEST = '/Users/blackmad/Code/map-recall2/.worktrees/amsterdam-building-twin/.cache/facade-twin/strips-confident/manifest.json';
const COLLECTION_URL = 'https://api.3dbag.nl/collections/pand';
const USER_AGENT = 'MapRecallRooflineA3/1.0 (+https://github.com/blackmad/map-recall)';
const SCHEMA_VERSION = 1;
const CRS = 'EPSG:28992';
const FETCH_ATTEMPTS = 4;

const arg = (name: string): string | undefined =>
  process.argv.find((value) => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const has = (name: string): boolean => process.argv.includes(`--${name}`);
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const manifestPath = arg('manifest') ?? DEFAULT_MANIFEST;
const cacheRoot = process.env.ROOFLINE_CACHE || DEFAULT_ROOFLINE_CACHE;
const outDir = arg('out') ?? path.join(cacheRoot, 'roofline-eval', '3dbag');
const refresh = has('refresh');
const concurrency = Math.max(1, Number(arg('concurrency') ?? 6));
const overlayBuildings = Math.max(1, Number(arg('overlay') ?? 6));

type ProjectedPoint = { x: number; y: number };

type ThreeDBagVersion = {
  api: string | null;
  collection: string | null;
  collectionUrl: string;
  fetchedAt: string;
  fromCache: boolean;
};

type CachedFeature = { pandId: string; sha256: string; response: any };

type CacheFile = {
  schemaVersion: number;
  generatedAt: string;
  crs: string;
  bbox: [number, number, number, number] | null;
  threeDBag: ThreeDBagVersion;
  requestedPandIds: string[];
  features: CachedFeature[];
  missing: string[];
};

type StripRecord = {
  pandId?: unknown;
  file?: unknown;
  address?: unknown;
  elevationId?: unknown;
  start?: unknown;
  end?: unknown;
  bottomNap?: unknown;
  topNap?: unknown;
  leftEdge?: unknown;
};

const sha256 = (text: string): string => createHash('sha256').update(text).digest('hex');
const finiteOrNull = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null;

const toPoint = (value: unknown): ProjectedPoint | null => {
  if (Array.isArray(value) && value.length >= 2) {
    const [x, y] = value;
    if (typeof x === 'number' && Number.isFinite(x) && typeof y === 'number' && Number.isFinite(y)) return { x, y };
  }
  if (value && typeof value === 'object') {
    const { x, y } = value as { x?: unknown; y?: unknown };
    if (typeof x === 'number' && Number.isFinite(x) && typeof y === 'number' && Number.isFinite(y)) return { x, y };
  }
  return null;
};

/** Adapt one manifest record to the typed wall frame the matcher takes. */
const wallFrameOf = (record: StripRecord): A0WallFrame | null => {
  const start = toPoint(record.start);
  const end = toPoint(record.end);
  if (!start || !end || typeof record.pandId !== 'string' || !record.pandId) return null;
  const leftEdge = record.leftEdge === 'start' || record.leftEdge === 'end' ? record.leftEdge : null;
  return {
    pandId: record.pandId,
    start,
    end,
    bottomNap: finiteOrNull(record.bottomNap),
    topNap: finiteOrNull(record.topNap),
    leftEdge,
  };
};

const idOf = (response: any): string | null => {
  const id = response?.feature?.id;
  return typeof id === 'string' ? id.replace(/^NL\.IMBAG\.Pand\./, '') : null;
};

async function fetchJson(url: string, attempts = FETCH_ATTEMPTS): Promise<any> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const response = await fetch(url, {
        headers: { Accept: 'application/json', 'User-Agent': USER_AGENT },
        signal: AbortSignal.timeout(30_000),
      });
      if (response.ok) return await response.json();
      const error = new Error(`HTTP ${response.status}`);
      if (response.status < 500 && response.status !== 429) throw error;
      lastError = error;
    } catch (error) {
      lastError = error;
    }
    if (attempt < attempts) await sleep(500 * 2 ** attempt);
  }
  throw new Error(`${url}: ${lastError instanceof Error ? lastError.message : String(lastError)}`);
}

/** One pand, or `missing` for a 404 that will not be fixed by retrying. */
async function fetchItem(pandId: string): Promise<{ response: any } | { missing: true }> {
  const url = `${COLLECTION_URL}/items/NL.IMBAG.Pand.${pandId}`;
  let lastError: unknown;
  for (let attempt = 1; attempt <= FETCH_ATTEMPTS; attempt++) {
    try {
      const response = await fetch(url, {
        headers: { Accept: 'application/json', 'User-Agent': USER_AGENT },
        signal: AbortSignal.timeout(30_000),
      });
      if (response.status === 404) return { missing: true };
      if (response.ok) return { response: await response.json() };
      const error = new Error(`HTTP ${response.status}`);
      if (response.status < 500 && response.status !== 429) throw error;
      lastError = error;
    } catch (error) {
      lastError = error;
    }
    if (attempt < FETCH_ATTEMPTS) await sleep(500 * 2 ** attempt);
  }
  throw new Error(`${url}: ${lastError instanceof Error ? lastError.message : String(lastError)}`);
}

async function pooled<T>(items: T[], limit: number, worker: (item: T) => Promise<void>): Promise<void> {
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const index = next++;
        await worker(items[index]);
      }
    }),
  );
}

/** Geometry bbox of the cached features, in RD metres, with the CityJSON transform applied. */
function geometryBbox(features: CachedFeature[]): [number, number, number, number] | null {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const { response } of features) {
    const transform = response?.metadata?.transform;
    const vertices = response?.feature?.vertices;
    if (!transform?.scale || !transform?.translate || !Array.isArray(vertices)) continue;
    for (const vertex of vertices) {
      const x = vertex[0] * transform.scale[0] + transform.translate[0];
      const y = vertex[1] * transform.scale[1] + transform.translate[1];
      minX = Math.min(minX, x); minY = Math.min(minY, y);
      maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
    }
  }
  return Number.isFinite(minX) ? [minX, minY, maxX, maxY] : null;
}

// --- manifest ----------------------------------------------------------------
const manifest = JSON.parse(await readFile(path.resolve(manifestPath), 'utf8')) as { strips?: StripRecord[] };
const strips = Array.isArray(manifest?.strips) ? manifest.strips : [];
if (strips.length === 0) throw new Error(`${manifestPath}: no strips[] to take pand IDs from`);
const pandIds = [...new Set(strips.map((strip) => strip.pandId).filter((id): id is string => typeof id === 'string' && id.length > 0))].sort();
if (pandIds.length === 0) throw new Error(`${manifestPath}: strips[] carries no pandId`);

// --- cache -------------------------------------------------------------------
await mkdir(outDir, { recursive: true });
const cacheFile = path.join(outDir, '3dbag-strips.json');
let cache: CacheFile | null = null;
if (!refresh) {
  try {
    const parsed = JSON.parse(await readFile(cacheFile, 'utf8')) as CacheFile;
    if (parsed?.schemaVersion === SCHEMA_VERSION && Array.isArray(parsed.features)) cache = parsed;
  } catch {
    // No usable cache: fetch from scratch.
  }
}
const cachedById = new Map<string, any>();
for (const entry of cache?.features ?? []) {
  const pandId = entry.pandId ?? idOf(entry.response);
  if (pandId) cachedById.set(pandId, entry.response);
}
const missing = new Set<string>(cache?.missing ?? []);
for (const pandId of cachedById.keys()) missing.delete(pandId);

let threeDBag: ThreeDBagVersion;
if (cache?.threeDBag && !refresh) {
  threeDBag = { ...cache.threeDBag, fromCache: true };
} else {
  const collection = await fetchJson(COLLECTION_URL);
  const version = collection?.version ?? {};
  threeDBag = {
    api: typeof version.api === 'string' ? version.api : null,
    collection: typeof version.collection === 'string' ? version.collection : null,
    collectionUrl: COLLECTION_URL,
    fetchedAt: new Date().toISOString(),
    fromCache: false,
  };
}

const toFetch = pandIds.filter((pandId) => refresh || !cachedById.has(pandId));
process.stdout.write(`3DBAG strip cache — ${pandIds.length} pand IDs from ${manifestPath}\n`);
process.stdout.write(`  release   ${threeDBag.collection ?? 'unknown'} (api ${threeDBag.api ?? 'unknown'})${cache ? ', from cache' : ''}\n`);
process.stdout.write(`  have ${cachedById.size}, fetch ${toFetch.length}${missing.size ? `, known missing ${missing.size}` : ''}\n`);

let fetched = 0;
let done = 0;
const failures: string[] = [];
await pooled(toFetch, concurrency, async (pandId) => {
  try {
    const result = await fetchItem(pandId);
    if ('missing' in result) {
      missing.add(pandId);
    } else {
      cachedById.set(pandId, result.response);
      missing.delete(pandId);
      fetched++;
    }
  } catch (error) {
    failures.push(`${pandId}: ${error instanceof Error ? error.message : String(error)}`);
  }
  done++;
  if (done % 10 === 0 || done === toFetch.length) process.stdout.write(`  ${done}/${toFetch.length} fetched\n`);
});

const features: CachedFeature[] = [...cachedById.entries()]
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([pandId, response]) => ({ pandId, sha256: sha256(JSON.stringify(response)), response }));
const nextCache: CacheFile = {
  schemaVersion: SCHEMA_VERSION,
  generatedAt: new Date().toISOString(),
  crs: CRS,
  bbox: geometryBbox(features),
  threeDBag: { ...threeDBag, fromCache: false },
  requestedPandIds: pandIds,
  features,
  missing: [...missing].sort(),
};
await writeFile(`${cacheFile}.tmp`, `${JSON.stringify(nextCache)}\n`);
await rename(`${cacheFile}.tmp`, cacheFile);

process.stdout.write(`\n  fetched ${fetched}, cached total ${features.length}, missing ${missing.size}\n`);
process.stdout.write(`  bbox ${nextCache.bbox ? nextCache.bbox.map((value) => value.toFixed(1)).join(', ') : 'none'} (${CRS})\n`);
process.stdout.write(`  wrote ${cacheFile}\n`);

// --- optional wall-endpoint check (needs the A0 manifest) --------------------
type CheckedWall = WallSurfaceMatch & {
  pandId: string;
  file: string | null;
  address: string | null;
  elevationId: string | null;
};

const wallRecords = strips.map((strip) => ({ strip, frame: wallFrameOf(strip) })).filter((entry): entry is { strip: StripRecord; frame: A0WallFrame } => entry.frame !== null);
if (wallRecords.length === 0) {
  process.stdout.write('\nmanifest has no wall endpoints (start/end); fetch-only — the A0 check was not run.\n');
} else {
  const checked: CheckedWall[] = wallRecords.map(({ strip, frame }) => {
    const response = cachedById.get(frame.pandId);
    const surfaces = response ? extractFacadeWallPlanes(response) : [];
    const match = matchWallSurface(frame, surfaces);
    return {
      pandId: frame.pandId,
      file: typeof strip.file === 'string' ? strip.file : null,
      address: typeof strip.address === 'string' ? strip.address : null,
      elevationId: typeof strip.elevationId === 'string' ? strip.elevationId : null,
      ...match,
    };
  });
  const excluded = checked.filter((wall) => wall.excluded);
  const matchFile = path.join(outDir, 'wall-match.json');
  await writeFile(`${matchFile}.tmp`, `${JSON.stringify({
    schemaVersion: SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    threeDBag: { api: threeDBag.api, collection: threeDBag.collection, collectionUrl: threeDBag.collectionUrl, fetchedAt: threeDBag.fetchedAt },
    source: { manifest: path.resolve(manifestPath) },
    thresholds: { offsetM: WALL_OFFSET_TOLERANCE_M, angleDeg: WALL_ANGLE_TOLERANCE_DEG },
    summary: { walls: checked.length, matched: checked.length - excluded.length, excluded: excluded.length },
    matched: checked.filter((wall) => !wall.excluded),
    excluded,
    walls: checked,
  }, null, 2)}\n`);
  await rename(`${matchFile}.tmp`, matchFile);
  process.stdout.write(`\n  wall-endpoint check: ${checked.length} walls, ${checked.length - excluded.length} matched, ${excluded.length} excluded\n`);
  for (const wall of excluded) process.stdout.write(`    exclude ${wall.pandId} ${wall.file ?? ''} — ${wall.relation} (offset ${wall.offsetM?.toFixed(2) ?? '?'} m, angle ${wall.angleDeg?.toFixed(2) ?? '?'}°)\n`);
  process.stdout.write(`  wrote ${matchFile}\n`);
}

// --- overlay: a plan view of a few fetched buildings -------------------------
const centroids = new Map<string, ProjectedPoint>();
for (const [pandId, response] of cachedById) {
  const walls = extractFacadeWallPlanes(response);
  if (walls.length === 0) continue;
  let sumX = 0, sumY = 0, count = 0;
  for (const wall of walls) for (const vertex of wall.vertices) { sumX += vertex[0]; sumY += vertex[1]; count++; }
  if (count) centroids.set(pandId, { x: sumX / count, y: sumY / count });
}
const chosen = [...centroids.keys()].sort();
let overlayPandIds: string[] = [];
if (chosen.length > 0) {
  const distance = (a: ProjectedPoint, b: ProjectedPoint) => Math.hypot(a.x - b.x, a.y - b.y);
  // Seed on the densest neighbourhood so the plan view is a legible cluster
  // rather than six buildings scattered across the canal belt.
  const seed = chosen
    .map((id) => ({ id, neighbours: chosen.filter((other) => other !== id && distance(centroids.get(id)!, centroids.get(other)!) <= 250).length }))
    .sort((a, b) => b.neighbours - a.neighbours || a.id.localeCompare(b.id))[0].id;
  const origin = centroids.get(seed)!;
  overlayPandIds = [...chosen]
    .sort((a, b) => distance(centroids.get(a)!, origin) - distance(centroids.get(b)!, origin) || a.localeCompare(b))
    .slice(0, Math.min(overlayBuildings, chosen.length));
}

if (overlayPandIds.length > 0) {
  const width = 900;
  const height = 900;
  const rgb = new Uint8Array(width * height * 3).fill(246);
  const palette: Array<[number, number, number]> = [
    [31, 119, 180], [214, 39, 40], [44, 160, 44], [255, 127, 14], [148, 103, 189], [23, 190, 207], [227, 119, 194], [188, 189, 34],
  ];
  const plans = overlayPandIds.map((pandId) => ({ pandId, walls: extractFacadeWallPlanes(cachedById.get(pandId)) }));
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const { walls } of plans) for (const wall of walls) for (const vertex of wall.vertices) {
    minX = Math.min(minX, vertex[0]); minY = Math.min(minY, vertex[1]);
    maxX = Math.max(maxX, vertex[0]); maxY = Math.max(maxY, vertex[1]);
  }
  const padding = 40;
  const scale = Math.min((width - padding * 2) / Math.max(1, maxX - minX), (height - padding * 2) / Math.max(1, maxY - minY));
  const toPixel = (vertex: readonly number[]): [number, number] => [
    Math.round(padding + (vertex[0] - minX) * scale),
    Math.round(height - padding - (vertex[1] - minY) * scale),
  ];
  const setPixel = (x: number, y: number, colour: [number, number, number]) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const offset = (y * width + x) * 3;
    rgb[offset] = colour[0]; rgb[offset + 1] = colour[1]; rgb[offset + 2] = colour[2];
  };
  const drawLine = (x0: number, y0: number, x1: number, y1: number, colour: [number, number, number]) => {
    let x = x0, y = y0;
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
    const stepX = x0 < x1 ? 1 : -1, stepY = y0 < y1 ? 1 : -1;
    let error = dx + dy;
    for (;;) {
      setPixel(x, y, colour);
      setPixel(x + 1, y, colour);
      setPixel(x, y + 1, colour);
      if (x === x1 && y === y1) break;
      const doubled = 2 * error;
      if (doubled >= dy) { error += dy; x += stepX; }
      if (doubled <= dx) { error += dx; y += stepY; }
    }
  };
  plans.forEach(({ walls }, index) => {
    const colour = palette[index % palette.length];
    for (const wall of walls) {
      for (let i = 0; i < wall.vertices.length; i++) {
        const [x0, y0] = toPixel(wall.vertices[i]);
        const [x1, y1] = toPixel(wall.vertices[(i + 1) % wall.vertices.length]);
        drawLine(x0, y0, x1, y1, colour);
      }
      const [cx, cy] = toPixel([wall.vertices.reduce((sum, vertex) => sum + vertex[0], 0) / wall.vertices.length, wall.vertices.reduce((sum, vertex) => sum + vertex[1], 0) / wall.vertices.length]);
      drawLine(cx - 3, cy, cx + 3, cy, [20, 20, 20]);
      drawLine(cx, cy - 3, cx, cy + 3, [20, 20, 20]);
    }
  });
  const overlayFile = path.join(outDir, 'overlay-plan.png');
  await writeFile(overlayFile, encodePng(width, height, rgb));
  process.stdout.write(`\n  overlay plan view of ${overlayPandIds.length} buildings: ${overlayPandIds.join(', ')}\n`);
  process.stdout.write(`  wrote ${overlayFile}\n`);
}

if (failures.length > 0) {
  process.stdout.write(`\n  ${failures.length} fetch failures:\n    ${failures.slice(0, 10).join('\n    ')}\n`);
  process.exitCode = 1;
}
