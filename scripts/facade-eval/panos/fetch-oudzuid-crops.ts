/**
 * Task 2 — fetch municipal panoramas and rectify them onto the published
 * point-cloud wall planes for the Oud-Zuid demo tiles.
 *
 * Input : public/data/pointcloud-facades/v1/<tile>/manifest.json (walls[] are
 *         the well-scanned walls; frame{origin,u,v,n,baseUp,wallTop} is the
 *         3DBAG wall plane).
 * Output: .cache/facade-eval/oudzuid/crops/<wall>.jpg, one crop per wall, plus
 *         .cache/facade-eval/oudzuid/manifest.json.
 *
 * Camera convention: AMSTERDAM_WORLD_ALIGNED (geographic north at image centre);
 * the published vehicle heading/pitch/roll are NOT re-applied. See
 * src/canalRecall/facade/rectify.ts.
 *
 * The pano endpoint is the same one scripts/da-costa-block/acquire.mjs uses:
 *   https://api.data.amsterdam.nl/panorama/panoramas/?near=<lng,lat>&radius=<m>
 *     &srid=4326&page_size=500&timestamp_after=<date>
 * and the full equirectangular image is 8000x4000.
 *
 * The run is resumable: API listings, panorama bytes (keyed by sha256) and crop
 * renders (keyed by a render key) are all reused when they already exist.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import jpeg from 'jpeg-js';
import {
  AMSTERDAM_WORLD_ALIGNED,
  rectifyFacade,
  type FacadePlane,
} from '../../../src/canalRecall/facade/rectify.ts';
import { lngLatToRd, rdToLngLat } from '../../../src/canalRecall/facade/rdNew.ts';
import { lensFor } from '../../da-costa-block/neighbourhood-core.ts';

const VERSION = 'facade-eval-oudzuid-crops/1';
const CAMERA = AMSTERDAM_WORLD_ALIGNED.id;
const API = 'https://api.data.amsterdam.nl/panorama/panoramas/';
const USER_AGENT = 'MapRecall-FacadeEval/1.0 (+task 2, Oud-Zuid façade crops)';

/** Both demo tiles, their published buildings, and their tile manifests. */
const TILES = [
  { id: 'museumkwartier', manifest: 'public/data/pointcloud-facades/v1/museumkwartier/manifest.json' },
  { id: 'willemspark', manifest: 'public/data/pointcloud-facades/v1/willemspark/manifest.json' },
] as const;

/** Selection parameters, deliberately the same shape as prepare-neighbourhood.ts. */
const SELECTION = {
  minStandoffM: 3,
  maxDistanceM: 52,
  maxObliquityDeg: 48,
  maxCandidatesTried: 4,
} as const;

/** Render parameters: the cached "full" strip convention (45 px/m, 1.4 MP cap). */
const RENDER = { pixelsPerMetre: 45, maxPixels: 1_400_000 } as const;

/** A crop is only accepted if it is neither blank nor mostly behind the camera. */
const CROP_GATE = { maxMissingFraction: 0.4, minLuminanceSd: 8, minMean: 5, maxMean: 250 } as const;

const arg = (name: string, fallback: string) =>
  process.argv.find((value) => value.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback;
const flag = (name: string) => process.argv.includes(`--${name}`);
const outRoot = path.resolve(arg('out', '.cache/facade-eval/oudzuid'));
const radiusM = Number(arg('radius', '170'));
const timestampAfter = arg('timestamp-after', '2019-01-01');
const limit = Number(arg('limit', '0')) || Infinity;
const onlyWall = arg('only', '');
const refreshPanos = flag('refresh-panos');
const renderConcurrency = Math.max(1, Math.min(4, Number(arg('concurrency', '3'))));

if (!Number.isFinite(radiusM) || radiusM <= 0) throw new Error('radius must be positive');

interface TileWall {
  tile: string;
  group: string;
  surfaceId: string;
  buildingId: string;
  width: number;
  height: number;
  normal: readonly [number, number, number];
  plane: FacadePlane;
  /** The published metric frame, so measured `openingRects` (along/up from origin) can be mapped into the crop. */
  frame: { origin: readonly number[]; u: readonly number[]; v: readonly number[]; n: readonly number[]; baseUp: number; wallTop: number };
}

interface PanoRecord {
  pano_id: string;
  timestamp: string;
  surface_type: string;
  heading?: number;
  pitch?: number;
  roll?: number;
  geometry: { type: string; coordinates: [number, number, number] };
  _links: { equirectangular_full: { href: string } };
}

interface Candidate {
  pano: PanoRecord;
  rd: { x: number; y: number };
  standoff: number;
  distance: number;
  obliquity: number;
  nativePixelsPerMetre: number;
  score: number;
  poseInferred: boolean;
}

const sha256 = (value: string | Uint8Array) => createHash('sha256').update(value).digest('hex');
const key = (wall: TileWall) => `${wall.tile}:${wall.surfaceId}`;

async function readJson<T>(file: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await fs.readFile(file, 'utf8')) as T;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return fallback;
    throw error;
  }
}

async function writeJsonAtomic(file: string, value: unknown) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const temporary = `${file}.${process.pid}.tmp`;
  await fs.writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`);
  await fs.rename(temporary, file);
}

/** Bounded-concurrency map. */
async function pool<T, R>(items: readonly T[], concurrency: number, run: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (true) {
      const index = next++;
      if (index >= items.length) return;
      results[index] = await run(items[index], index);
    }
  });
  await Promise.all(workers);
  return results;
}

/** Fetch with bounded retries, timeouts and Retry-After support. Polite by default. */
async function fetchRetry(url: string, { binary = false, attempts = 4 }: { binary?: boolean; attempts?: number } = {}) {
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt++) {
    let response: Response | undefined;
    try {
      response = await fetch(url, { signal: AbortSignal.timeout(120_000), headers: { 'User-Agent': USER_AGENT } });
    } catch (error) {
      lastError = error;
      if (attempt === attempts - 1) break;
      await new Promise((resolve) => setTimeout(resolve, 400 * 2 ** attempt));
      continue;
    }
    if (response.ok) return binary ? new Uint8Array(await response.arrayBuffer()) : await response.json();
    if (![408, 429, 500, 502, 503, 504].includes(response.status) || attempt === attempts - 1) {
      throw new Error(`HTTP ${response.status} ${url}`);
    }
    const retryAfter = Number(response.headers.get('retry-after'));
    const wait = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 400 * 2 ** attempt;
    await new Promise((resolve) => setTimeout(resolve, Math.min(15_000, wait)));
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

/** Read the published wall plane. start/end run so the outward normal is to the right. */
function toTileWalls(tile: string, manifest: any): TileWall[] {
  return (manifest.walls as any[]).map((wall) => {
    const [ox, oy, oz] = wall.frame.origin as [number, number, number];
    const [ux, uy] = wall.frame.u as [number, number, number];
    const half = wall.width / 2;
    const baseZ = oz + wall.frame.baseUp;
    const topZ = oz + wall.frame.wallTop;
    return {
      tile,
      group: wall.group,
      surfaceId: wall.surfaceId,
      buildingId: wall.buildingId,
      width: wall.width,
      height: wall.height,
      normal: wall.normal as [number, number, number],
      frame: {
        origin: wall.frame.origin,
        u: wall.frame.u,
        v: wall.frame.v,
        n: wall.frame.n,
        baseUp: wall.frame.baseUp,
        wallTop: wall.frame.wallTop,
      },
      plane: {
        start: { x: ox + ux * -half, y: oy + uy * -half },
        end: { x: ox + ux * half, y: oy + uy * half },
        baseZ,
        topZ,
      },
    };
  });
}

/** Load (or fetch once, then cache) the panorama listing around a tile. */
async function panoListing(tile: (typeof TILES)[number], bounds: any): Promise<{ panoramas: PanoRecord[]; meta: any }> {
  const cacheFile = path.join(outRoot, 'index', `panoramas-${tile.id}.json`);
  if (!refreshPanos) {
    const cached = await readJson<any>(cacheFile, null);
    if (cached && cached.radiusM === radiusM && cached.timestampAfter === timestampAfter) {
      return { panoramas: cached.panoramas, meta: cached.meta };
    }
  }
  const centre = rdToLngLat({ x: (bounds.minX + bounds.maxX) / 2, y: (bounds.minY + bounds.maxY) / 2 });
  const first = new URL(API);
  first.searchParams.set('near', `${centre[0]},${centre[1]}`);
  first.searchParams.set('radius', String(radiusM));
  first.searchParams.set('srid', '4326');
  first.searchParams.set('page_size', '500');
  first.searchParams.set('timestamp_after', timestampAfter);

  const panoramas: PanoRecord[] = [];
  const pageUrls: string[] = [];
  let url: string | null = first.href;
  let advertised: number | null = null;
  while (url) {
    if (pageUrls.length >= 60) throw new Error(`${tile.id}: panorama pagination safety limit`);
    const data: any = await fetchRetry(url);
    const batch: PanoRecord[] = data._embedded?.panoramas;
    if (!Array.isArray(batch)) throw new Error(`${tile.id}: missing _embedded.panoramas`);
    if (typeof data.count === 'number') advertised = data.count;
    panoramas.push(...batch);
    pageUrls.push(url);
    url = data._links?.next?.href ?? null;
    if (!batch.length && url) throw new Error(`${tile.id}: empty page with next link`);
  }
  const meta = {
    near: centre,
    radiusM,
    timestampAfter,
    pageSize: 500,
    pages: pageUrls.length,
    advertised,
    received: panoramas.length,
    fetchedAt: new Date().toISOString(),
  };
  await writeJsonAtomic(cacheFile, { version: VERSION, radiusM, timestampAfter, meta, panoramas });
  return { panoramas, meta };
}

/** Rank the panos that can actually see a wall, mirroring the existing quality score. */
function rankCandidates(wall: TileWall, panoramas: readonly PanoRecord[]): Candidate[] {
  const fromOrigin = { x: (wall.plane.start.x + wall.plane.end.x) / 2, y: (wall.plane.start.y + wall.plane.end.y) / 2 };
  const candidates: Candidate[] = [];
  for (const pano of panoramas) {
    if (pano.surface_type !== 'L') continue;
    const rd = lngLatToRd([pano.geometry.coordinates[0], pano.geometry.coordinates[1]]);
    const dx = rd.x - fromOrigin.x;
    const dy = rd.y - fromOrigin.y;
    const distance = Math.hypot(dx, dy);
    const standoff = dx * wall.normal[0] + dy * wall.normal[1];
    if (standoff < SELECTION.minStandoffM || distance > SELECTION.maxDistanceM) continue;
    const obliquity = (Math.acos(Math.min(1, standoff / distance)) * 180) / Math.PI;
    if (obliquity > SELECTION.maxObliquityDeg) continue;
    const nativePixelsPerMetre = ((8000 / (2 * Math.PI)) * Math.cos((obliquity * Math.PI) / 180)) / standoff;
    const lens = lensFor(pano, wall.plane.baseZ);
    const year = Number(pano.timestamp.slice(0, 4));
    const month = Number(pano.timestamp.slice(5, 7));
    const recent = year >= 2025 ? 1.15 : 1;
    const winter = month >= 11 || month <= 3 ? 1.4 : 1;
    const inferredPenalty = lens?.inferred ? 0.5 : 1;
    candidates.push({
      pano,
      rd,
      standoff,
      distance,
      obliquity,
      nativePixelsPerMetre,
      score: nativePixelsPerMetre * recent * winter * inferredPenalty,
      poseInferred: Boolean(lens?.inferred),
    });
  }
  return candidates.sort((a, b) => b.score - a.score);
}

const panosInFlight = new Map<string, Promise<{ file: string; sha256: string; bytes: number; reused: boolean }>>();

async function ensurePanorama(candidate: Candidate): Promise<{ file: string; sha256: string; bytes: number; reused: boolean }> {
  const id = candidate.pano.pano_id;
  const inFlight = panosInFlight.get(id);
  if (inFlight) return inFlight;
  const task = (async () => {
    const dir = path.join(outRoot, 'panoramas');
    const file = path.join(dir, `${id}.jpg`);
    const sidecar = path.join(dir, `${id}.json`);
    const url = candidate.pano._links.equirectangular_full.href;
    const existing = await readJson<any>(sidecar, null);
    if (existing && existing.url === url && existing.sha256) {
      try {
        const bytes = await fs.readFile(file);
        if (sha256(bytes) === existing.sha256) return { file, sha256: existing.sha256, bytes: bytes.length, reused: true };
      } catch {
        // fall through to download
      }
    }
    const bytes = await fetchRetry(url, { binary: true });
    const digest = sha256(bytes);
    await fs.mkdir(dir, { recursive: true });
    const temporary = `${file}.${process.pid}.tmp`;
    await fs.writeFile(temporary, bytes);
    await fs.rename(temporary, file);
    await writeJsonAtomic(sidecar, { url, sha256: digest, bytes: bytes.length, retrievedAt: new Date().toISOString() });
    return { file, sha256: digest, bytes: bytes.length, reused: false };
  })();
  panosInFlight.set(id, task);
  try {
    return await task;
  } finally {
    panosInFlight.delete(id);
  }
}

function luminanceStats(data: Uint8Array | Uint8ClampedArray, pixels: number) {
  let sum = 0;
  let sumSquares = 0;
  for (let i = 0; i < pixels; i++) {
    const value = data[i * 4] * 0.299 + data[i * 4 + 1] * 0.587 + data[i * 4 + 2] * 0.114;
    sum += value;
    sumSquares += value * value;
  }
  const mean = sum / pixels;
  return { mean, sd: Math.sqrt(Math.max(0, sumSquares / pixels - mean * mean)) };
}

const cropFileFor = (wall: TileWall) => path.join('crops', `${wall.group}.jpg`);

async function renderWall(wall: TileWall, candidate: Candidate, pano: { file: string; sha256: string }) {
  const image = jpeg.decode(await fs.readFile(pano.file), { useTArray: true, formatAsRGBA: true });
  const lens = lensFor(candidate.pano, wall.plane.baseZ)!;
  const pose = { ...lens.pose, headingDeg: 0, pitchDeg: 0, rollDeg: 0 };
  const rect = rectifyFacade(image, pose, wall.plane, { camera: AMSTERDAM_WORLD_ALIGNED, pixelsPerMetre: RENDER.pixelsPerMetre, maxPixels: RENDER.maxPixels });
  const stats = luminanceStats(rect.data, rect.width * rect.height);
  const valid =
    rect.missingFraction <= CROP_GATE.maxMissingFraction &&
    stats.sd >= CROP_GATE.minLuminanceSd &&
    stats.mean >= CROP_GATE.minMean &&
    stats.mean <= CROP_GATE.maxMean;
  return { image, lens, pose, rect, stats, valid };
}

async function main() {
  await fs.mkdir(path.join(outRoot, 'crops'), { recursive: true });
  const prior = await readJson<any>(path.join(outRoot, 'manifest.json'), null);
  const priorByWall = new Map<string, any>((prior?.walls ?? []).map((record: any) => [`${record.tile}:${record.surfaceId}`, record]));
  const priorOmitted = new Map<string, any>((prior?.omitted ?? []).map((record: any) => [`${record.tile}:${record.surfaceId}`, record]));

  const walls: TileWall[] = [];
  const listings: Record<string, any> = {};
  const boundsByTile: Record<string, any> = {};
  const listingByTile = new Map<string, PanoRecord[]>();
  for (const tile of TILES) {
    const manifest = await readJson<any>(path.resolve(tile.manifest), null);
    if (!manifest) throw new Error(`missing tile manifest ${tile.manifest}`);
    boundsByTile[tile.id] = { ...manifest.bounds };
    walls.push(...toTileWalls(tile.id, manifest));
    const listing = await panoListing(tile, manifest.bounds);
    const dates = listing.panoramas.map((pano) => pano.timestamp).sort();
    listings[tile.id] = { ...listing.meta, panoramaDateRange: dates.length ? { min: dates[0], max: dates[dates.length - 1] } : null };
    listingByTile.set(tile.id, listing.panoramas);
    console.log(`${tile.id}: ${manifest.walls.length} walls, ${listing.panoramas.length} panoramas listed (${listing.meta.pages} pages)`);
  }

  const selected = walls.filter((wall) => !onlyWall || wall.group === onlyWall || wall.surfaceId === onlyWall).slice(0, limit);
  console.log(`rectifying ${selected.length} well-scanned walls onto their published planes`);

  const records: any[] = [];
  const omitted: any[] = [];
  let downloads = 0;
  let reusedCrops = 0;

  await pool(selected, renderConcurrency, async (wall) => {
    const panoramas = listingByTile.get(wall.tile)!;
    const candidates = rankCandidates(wall, panoramas);
    const failures: string[] = [];
    if (!candidates.length) {
      omitted.push({ tile: wall.tile, buildingId: wall.buildingId, surfaceId: wall.surfaceId, wallWidthM: wall.width, reason: 'no-panorama-within-radius', candidates: 0 });
      console.log(`omit ${wall.group}: no-panorama-within-radius`);
      return;
    }
    for (const candidate of candidates.slice(0, SELECTION.maxCandidatesTried)) {
      try {
        const pano = await ensurePanorama(candidate);
        if (!pano.reused) downloads++;
        const renderKey = sha256(JSON.stringify({ version: VERSION, camera: CAMERA, render: RENDER, plane: wall.plane, panoSha256: pano.sha256 }));
        const priorRecord = priorByWall.get(key(wall));
        const cropFile = cropFileFor(wall);
        if (priorRecord && priorRecord.renderKey === renderKey && priorRecord.crop?.file === cropFile) {
          try {
            const bytes = await fs.readFile(path.join(outRoot, cropFile));
            if (sha256(bytes) === priorRecord.crop.sha256) {
              records.push({ ...priorRecord, publishedFrame: wall.frame });
              reusedCrops++;
              console.log(`reuse ${wall.group}`);
              return;
            }
          } catch {
            // re-render
          }
        }
        const { image, lens, pose, rect, stats, valid } = await renderWall(wall, candidate, pano);
        if (!valid) {
          failures.push(`candidate ${candidate.pano.pano_id} rejected (missing=${rect.missingFraction.toFixed(2)}, sd=${stats.sd.toFixed(1)})`);
          continue;
        }
        const encoded = jpeg.encode({ width: rect.width, height: rect.height, data: Buffer.from(rect.data) }, 89).data;
        const digest = sha256(encoded);
        const target = path.join(outRoot, cropFile);
        const temporary = `${target}.${process.pid}.tmp`;
        await fs.writeFile(temporary, encoded);
        await fs.rename(temporary, target);
        records.push({
          tile: wall.tile,
          buildingId: wall.buildingId,
          surfaceId: wall.surfaceId,
          elevationId: wall.surfaceId,
          group: wall.group,
          wallWidthM: wall.width,
          wallHeightM: wall.height,
          plane: wall.plane,
          publishedFrame: wall.frame,
          panoramaId: candidate.pano.pano_id,
          panoramaDate: candidate.pano.timestamp,
          panoUrl: candidate.pano._links.equirectangular_full.href,
          panoSha256: pano.sha256,
          pose,
          publishedOrientation: { headingDeg: candidate.pano.heading ?? null, pitchDeg: candidate.pano.pitch ?? null, rollDeg: candidate.pano.roll ?? null },
          poseInferred: candidate.poseInferred,
          standoff: Number(candidate.standoff.toFixed(3)),
          obliquity: Number(candidate.obliquity.toFixed(3)),
          distanceM: Number(candidate.distance.toFixed(3)),
          pixelsPerMetre: RENDER.pixelsPerMetre,
          nativePixelsPerMetre: Number(candidate.nativePixelsPerMetre.toFixed(2)),
          crop: { file: cropFile, sha256: digest, width: rect.width, height: rect.height },
          sourceDimensions: [image.width, image.height],
          missingFraction: Number(rect.missingFraction.toFixed(4)),
          luminance: { mean: Number(stats.mean.toFixed(2)), sd: Number(stats.sd.toFixed(2)) },
          renderKey,
        });
        console.log(`crop ${wall.group} ${candidate.pano.pano_id} standoff ${candidate.standoff.toFixed(1)} obliq ${candidate.obliquity.toFixed(1)}`);
        return;
      } catch (error) {
        failures.push(`candidate ${candidate.pano.pano_id}: ${String(error)}`);
      }
    }
    const reason = failures.some((entry) => /HTTP 404/.test(entry)) ? 'panorama-404' : `all-candidates-rejected: ${failures.join('; ')}`;
    omitted.push({ tile: wall.tile, buildingId: wall.buildingId, surfaceId: wall.surfaceId, wallWidthM: wall.width, candidateCount: candidates.length, candidatesTried: Math.min(candidates.length, SELECTION.maxCandidatesTried), reason });
    console.log(`omit ${wall.group}: ${reason}`);
  });

  // Any wall not visited this run (e.g. --limit) keeps its previous verdict.
  const seen = new Set([...records, ...omitted].map((record) => key(record as TileWall)));
  for (const wall of walls) {
    if (seen.has(key(wall))) continue;
    const priorRecord = priorByWall.get(key(wall));
    if (priorRecord) records.push({ ...priorRecord, publishedFrame: wall.frame });
    else {
      const priorSkip = priorOmitted.get(key(wall));
      if (priorSkip) omitted.push(priorSkip);
    }
  }

  const dateRange = (() => {
    const dates = records.map((record) => record.panoramaDate).filter(Boolean).sort();
    return dates.length ? { min: dates[0], max: dates[dates.length - 1] } : null;
  })();

  const manifest = {
    version: VERSION,
    generatedAt: new Date().toISOString(),
    camera: CAMERA,
    layout: 'one crop per wall at crops/<wall.group>.jpg; panoramas cached as panoramas/<panoId>.jpg (+ .json provenance)',
    api: { endpoint: API, imageHost: 'https://t1.data.amsterdam.nl', format: 'equirectangular 8000x4000 JPEG', timestampAfter, radiusM },
    selection: SELECTION,
    render: RENDER,
    cropGate: CROP_GATE,
    inputs: { tiles: TILES, bounds: boundsByTile, listings: listings },
    summary: {
      wallsTotal: walls.length,
      cropped: records.length,
      omitted: omitted.length,
      panoramasUsed: new Set(records.map((record) => record.panoramaId)).size,
      panoramasDownloadedThisRun: downloads,
      cropsReused: reusedCrops,
      panoramaDateRange: dateRange,
    },
    walls: records,
    omitted,
  };
  await writeJsonAtomic(path.join(outRoot, 'manifest.json'), manifest);
  console.log(
    `wrote ${records.length} crops and ${omitted.length} omissions to ${path.relative(process.cwd(), outRoot)} ` +
      `(${downloads} panoramas downloaded, ${reusedCrops} crops reused)`,
  );
  const fullCoverage = !onlyWall && limit === Infinity;
  if (fullCoverage && records.length + omitted.length !== walls.length) {
    throw new Error(`coverage mismatch: ${records.length + omitted.length}/${walls.length} well-scanned walls have a crop or an omission`);
  }
  if (!fullCoverage) console.log(`partial run: ${records.length + omitted.length}/${walls.length} walls visited; set no --limit/--only for full coverage`);
}

await main();
