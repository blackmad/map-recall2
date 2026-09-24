/**
 * A5: Oud-Zuid views WITH HEADROOM, cut per gold ELEVATION plane (not per
 * 3DBAG wall — R1's gold elevations already merge collinear walls, so
 * cutting per-wall would split what R1 scored as one profile).
 *
 * `fetch-oudzuid-crops.ts` (task 2) rectifies onto each published wall's own
 * `topZ = oz + wall.frame.wallTop`, which stops exactly at the roof and
 * cuts off any gable (the same bug A0 fixed for the canal-belt strips). This
 * script reuses its panorama listing/candidate-ranking/rectification
 * machinery, but:
 *   - selects up to 3 panoramas per elevation, from >=2 capture positions
 *     >=3 m apart (mirrors A0's `--views-per-wall`), not just the best one;
 *   - cuts each view to the ELEVATION's own plane (from the R1 gold, so
 *     `along` is pixel-identical to the gold profile's own frame — no
 *     re-interpolation error), extended by `--headroom-m` (default 6) above
 *     `topZ`;
 *   - writes a manifest in the SAME shape `extract-strip-rooflines.ts`
 *     already consumes (`{ metadata, strips: [{file, pandId, address,
 *     panoramaId, capturedAt, sourceMeanLuma, roofBandPixelsPerMetre,
 *     leafOff, topZ, frame}] }`), with `pandId` set to the elevation id so
 *     the existing per-wall grouping/consensus logic groups by elevation.
 *
 * Gold input: `review-data/roofline-gold/v1/measured.json`, read from branch
 * `feat/roofline-r1` via `git show` (not merged into this worktree) and
 * cached locally for provenance. Cached panoramas/crops live under
 * `.cache/facade-eval/oudzuid/` (task 2's own cache); this script reads that
 * cache and writes into a NEW subdirectory so task 2's own crops are
 * untouched.
 *
 * Run: npx tsx scripts/facade-eval/panos/fetch-oudzuid-elevation-crops.ts
 *   [--headroom-m=6] [--out=DIR] [--only=<elevationId>]
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import jpeg from 'jpeg-js';
import {
  AMSTERDAM_WORLD_ALIGNED,
  rectifyFacade,
  type FacadePlane,
} from '../../../src/canalRecall/facade/rectify.ts';
import { lngLatToRd, rdToLngLat } from '../../../src/canalRecall/facade/rdNew.ts';
import { lensFor } from '../../da-costa-block/neighbourhood-core.ts';
import { stripFrame } from '../../../src/canalRecall/facade/stripFrame.ts';

const VERSION = 'roofline-a5-elevation-crops/1';
const CAMERA = AMSTERDAM_WORLD_ALIGNED.id;
const API = 'https://api.data.amsterdam.nl/panorama/panoramas/';
const USER_AGENT = 'MapRecall-FacadeEval/1.0 (+A5, Oud-Zuid roofline elevation crops)';
const REPO_ROOT = '/Users/blackmad/Code/map-recall2/.worktrees/roofline-a2';
const OUDZUID_CACHE = '/Users/blackmad/Code/map-recall2/.worktrees/amsterdam-facade-rebuild/.cache/facade-eval/oudzuid';

const TILES = [
  { id: 'museumkwartier', manifest: 'public/data/pointcloud-facades/v1/museumkwartier/manifest.json' },
  { id: 'willemspark', manifest: 'public/data/pointcloud-facades/v1/willemspark/manifest.json' },
] as const;

const SELECTION = { minStandoffM: 3, maxDistanceM: 52, maxObliquityDeg: 48, maxCandidatesTried: 6 } as const;
const RENDER = { pixelsPerMetre: 45, maxPixels: 1_400_000 } as const;
const CROP_GATE = { maxMissingFraction: 0.4, minLuminanceSd: 8, minMean: 5, maxMean: 250 } as const;
const VIEWS_PER_ELEVATION = 3;
const MIN_CAPTURE_SEPARATION_M = 3;

const arg = (name: string, fallback: string) =>
  process.argv.find(v => v.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback;
// Default matches the coordinator's instruction: write into the SAME cache
// task 2's own crops live in, under a new subdirectory -- not this worktree's
// own .cache (which isn't shared, per CLAUDE.md's "the cache isn't copied
// into new worktrees" rule).
const outRoot = path.resolve(arg('out', path.join(OUDZUID_CACHE, 'elevation-views-v1')));
const headroomM = Number(arg('headroom-m', '6'));
const onlyElevation = arg('only', '');
const timestampAfter = arg('timestamp-after', '2019-01-01');
const radiusM = 170;

if (!Number.isFinite(headroomM) || headroomM < 0) throw new Error('headroom-m must be >= 0');

const sha256 = (v: string | Uint8Array) => createHash('sha256').update(v).digest('hex');

async function readJson<T>(file: string, fallback: T): Promise<T> {
  try { return JSON.parse(await fs.readFile(file, 'utf8')) as T; }
  catch (e) { if ((e as NodeJS.ErrnoException).code === 'ENOENT') return fallback; throw e; }
}
async function writeJsonAtomic(file: string, value: unknown) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  await fs.writeFile(tmp, `${JSON.stringify(value, null, 2)}\n`);
  await fs.rename(tmp, file);
}
async function pool<T, R>(items: readonly T[], concurrency: number, run: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (true) { const i = next++; if (i >= items.length) return; results[i] = await run(items[i]); }
  }));
  return results;
}
async function fetchRetry(url: string, { binary = false, attempts = 4 }: { binary?: boolean; attempts?: number } = {}) {
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt++) {
    let response: Response | undefined;
    try { response = await fetch(url, { signal: AbortSignal.timeout(120_000), headers: { 'User-Agent': USER_AGENT } }); }
    catch (e) { lastError = e; if (attempt === attempts - 1) break; await new Promise(r => setTimeout(r, 400 * 2 ** attempt)); continue; }
    if (response.ok) return binary ? new Uint8Array(await response.arrayBuffer()) : await response.json();
    if (![408, 429, 500, 502, 503, 504].includes(response.status) || attempt === attempts - 1) throw new Error(`HTTP ${response.status} ${url}`);
    const retryAfter = Number(response.headers.get('retry-after'));
    await new Promise(r => setTimeout(r, Math.min(15_000, Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 400 * 2 ** attempt)));
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

interface GoldElevation {
  id: string; tile: string; buildingId: string; widthM: number;
  plane: { start: { x: number; y: number }; end: { x: number; y: number }; baseZ: number; topZ: number };
  surfaceIds: string[]; shape: string;
}
interface PanoRecord {
  pano_id: string; timestamp: string; surface_type: string;
  heading?: number; pitch?: number; roll?: number;
  geometry: { type: string; coordinates: [number, number, number] };
  _links: { equirectangular_full: { href: string } };
}
interface Candidate {
  pano: PanoRecord; rd: { x: number; y: number }; standoff: number; distance: number;
  obliquity: number; nativePixelsPerMetre: number; score: number; poseInferred: boolean;
}

/** `right(u) = (u.y, -u.x)` for a start->end direction `u` -- verified against a published wall's own `normal`/`frame.u`. */
function outwardNormal(start: { x: number; y: number }, end: { x: number; y: number }): [number, number] {
  const dx = end.x - start.x, dy = end.y - start.y;
  const len = Math.hypot(dx, dy) || 1;
  return [dy / len, -dx / len];
}

async function panoListing(tileId: string, bounds: { minX: number; minY: number; maxX: number; maxY: number }): Promise<PanoRecord[]> {
  const cacheFile = path.join(OUDZUID_CACHE, 'index', `panoramas-${tileId}.json`);
  const cached = await readJson<any>(cacheFile, null);
  if (cached && cached.radiusM === radiusM && cached.timestampAfter === timestampAfter) return cached.panoramas;
  const centre = rdToLngLat({ x: (bounds.minX + bounds.maxX) / 2, y: (bounds.minY + bounds.maxY) / 2 });
  const first = new URL(API);
  first.searchParams.set('near', `${centre[0]},${centre[1]}`);
  first.searchParams.set('radius', String(radiusM));
  first.searchParams.set('srid', '4326');
  first.searchParams.set('page_size', '500');
  first.searchParams.set('timestamp_after', timestampAfter);
  const panoramas: PanoRecord[] = [];
  let url: string | null = first.href;
  let pages = 0;
  while (url) {
    if (pages++ >= 60) throw new Error(`${tileId}: panorama pagination safety limit`);
    const data: any = await fetchRetry(url);
    const batch: PanoRecord[] = data._embedded?.panoramas;
    if (!Array.isArray(batch)) throw new Error(`${tileId}: missing _embedded.panoramas`);
    panoramas.push(...batch);
    url = data._links?.next?.href ?? null;
  }
  await writeJsonAtomic(cacheFile, { version: VERSION, radiusM, timestampAfter, panoramas });
  return panoramas;
}

function rankCandidates(centre: { x: number; y: number }, normal: [number, number], panoramas: readonly PanoRecord[], baseZ: number): Candidate[] {
  const candidates: Candidate[] = [];
  for (const pano of panoramas) {
    if (pano.surface_type !== 'L') continue;
    const rd = lngLatToRd([pano.geometry.coordinates[0], pano.geometry.coordinates[1]]);
    const dx = rd.x - centre.x, dy = rd.y - centre.y;
    const distance = Math.hypot(dx, dy);
    const standoff = dx * normal[0] + dy * normal[1];
    if (standoff < SELECTION.minStandoffM || distance > SELECTION.maxDistanceM) continue;
    const obliquity = (Math.acos(Math.min(1, standoff / distance)) * 180) / Math.PI;
    if (obliquity > SELECTION.maxObliquityDeg) continue;
    const nativePixelsPerMetre = ((8000 / (2 * Math.PI)) * Math.cos((obliquity * Math.PI) / 180)) / standoff;
    const lens = lensFor(pano, baseZ);
    const year = Number(pano.timestamp.slice(0, 4));
    const month = Number(pano.timestamp.slice(5, 7));
    const recent = year >= 2025 ? 1.15 : 1;
    const winter = month >= 11 || month <= 3 ? 1.4 : 1;
    const inferredPenalty = lens?.inferred ? 0.5 : 1;
    candidates.push({ pano, rd, standoff, distance, obliquity, nativePixelsPerMetre, score: nativePixelsPerMetre * recent * winter * inferredPenalty, poseInferred: Boolean(lens?.inferred) });
  }
  return candidates.sort((a, b) => b.score - a.score);
}

/** Greedily keep up to VIEWS_PER_ELEVATION candidates, each >= MIN_CAPTURE_SEPARATION_M from every already-kept one. */
function pickDiverseViews(sorted: Candidate[]): Candidate[] {
  const kept: Candidate[] = [];
  for (const c of sorted) {
    if (kept.length >= VIEWS_PER_ELEVATION) break;
    if (kept.every(k => Math.hypot(k.rd.x - c.rd.x, k.rd.y - c.rd.y) >= MIN_CAPTURE_SEPARATION_M)) kept.push(c);
  }
  return kept;
}

const panosInFlight = new Map<string, Promise<{ file: string; sha256: string }>>();
async function ensurePanorama(candidate: Candidate): Promise<{ file: string; sha256: string }> {
  const id = candidate.pano.pano_id;
  const inFlight = panosInFlight.get(id);
  if (inFlight) return inFlight;
  const task = (async () => {
    const dir = path.join(OUDZUID_CACHE, 'panoramas');
    const file = path.join(dir, `${id}.jpg`);
    const sidecar = path.join(dir, `${id}.json`);
    const url = candidate.pano._links.equirectangular_full.href;
    const existing = await readJson<any>(sidecar, null);
    if (existing?.url === url && existing?.sha256) {
      try { const bytes = await fs.readFile(file); if (sha256(bytes) === existing.sha256) return { file, sha256: existing.sha256 }; }
      catch { /* re-download */ }
    }
    const bytes = await fetchRetry(url, { binary: true }) as Uint8Array;
    const digest = sha256(bytes);
    await fs.mkdir(dir, { recursive: true });
    const tmp = `${file}.${process.pid}.tmp`;
    await fs.writeFile(tmp, bytes);
    await fs.rename(tmp, file);
    await writeJsonAtomic(sidecar, { url, sha256: digest, retrievedAt: new Date().toISOString() });
    return { file, sha256: digest };
  })();
  panosInFlight.set(id, task);
  try { return await task; } finally { panosInFlight.delete(id); }
}

function luminanceStats(data: Uint8Array | Uint8ClampedArray, pixels: number) {
  let sum = 0, sumSquares = 0;
  for (let i = 0; i < pixels; i++) {
    const v = data[i * 4] * 0.299 + data[i * 4 + 1] * 0.587 + data[i * 4 + 2] * 0.114;
    sum += v; sumSquares += v * v;
  }
  const mean = sum / pixels;
  return { mean, sd: Math.sqrt(Math.max(0, sumSquares / pixels - mean * mean)) };
}

async function main() {
  // Gold from feat/roofline-r1 (unmerged); cached locally for provenance.
  const goldCachePath = path.join(outRoot, 'gold-measured.json');
  let goldRaw: string;
  try {
    goldRaw = execFileSync('/usr/bin/git', ['show', 'feat/roofline-r1:review-data/roofline-gold/v1/measured.json'], { cwd: REPO_ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  } catch (e) {
    throw new Error(`could not read gold measured.json from feat/roofline-r1: ${String(e)}`);
  }
  await fs.mkdir(outRoot, { recursive: true });
  await fs.writeFile(goldCachePath, goldRaw);
  const gold = JSON.parse(goldRaw) as { elevations: GoldElevation[] };
  const elevations = gold.elevations.filter(e => !onlyElevation || e.id === onlyElevation);
  console.log(`gold: ${gold.elevations.length} elevations (${elevations.length} selected)`);

  const tileBounds: Record<string, any> = {};
  const listingByTile = new Map<string, PanoRecord[]>();
  for (const tile of TILES) {
    const manifest = await readJson<any>(path.resolve(REPO_ROOT, tile.manifest), null);
    if (!manifest) throw new Error(`missing tile manifest ${tile.manifest}`);
    tileBounds[tile.id] = manifest.bounds;
    listingByTile.set(tile.id, await panoListing(tile.id, manifest.bounds));
    console.log(`${tile.id}: ${listingByTile.get(tile.id)!.length} panoramas listed`);
  }

  // Crops go FLAT in outRoot (not a subdirectory) -- segment.py and
  // extract-strip-rooflines.ts's loadLuma/loadMask both join `stripsDir` with
  // the manifest's bare `file` name, matching the A0 strip cutter's own layout.
  await fs.mkdir(outRoot, { recursive: true });
  const strips: any[] = [];
  const omitted: any[] = [];

  await pool(elevations, 3, async (elevation) => {
    const { start, end, baseZ, topZ } = elevation.plane;
    const normal = outwardNormal(start, end);
    const centre = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };
    const panoramas = listingByTile.get(elevation.tile) ?? [];
    const ranked = rankCandidates(centre, normal, panoramas, baseZ);
    if (!ranked.length) {
      omitted.push({ elevationId: elevation.id, reason: 'no-panorama-within-radius' });
      console.log(`omit ${elevation.id}: no-panorama-within-radius`);
      return;
    }
    const chosen = pickDiverseViews(ranked);
    if (chosen.length < 2 && ranked.length > 1) {
      // Fall back to top-2 by score even if closer than the separation rule,
      // rather than shipping a single-view elevation when panoramas exist.
      chosen.length = 0;
      chosen.push(...ranked.slice(0, Math.min(VIEWS_PER_ELEVATION, ranked.length)));
    }
    const plane: FacadePlane = { start, end, baseZ, topZ: topZ + headroomM };
    let viewIndex = 0;
    for (const candidate of chosen) {
      viewIndex++;
      try {
        const pano = await ensurePanorama(candidate);
        const lens = lensFor(candidate.pano, baseZ)!;
        const pose = { ...lens.pose, headingDeg: 0, pitchDeg: 0, rollDeg: 0 };
        const image = jpeg.decode(await fs.readFile(pano.file), { useTArray: true, formatAsRGBA: true });
        const rect = rectifyFacade(image, pose, plane, { camera: AMSTERDAM_WORLD_ALIGNED, pixelsPerMetre: RENDER.pixelsPerMetre, maxPixels: RENDER.maxPixels });
        const stats = luminanceStats(rect.data, rect.width * rect.height);
        const valid = rect.missingFraction <= CROP_GATE.maxMissingFraction && stats.sd >= CROP_GATE.minLuminanceSd && stats.mean >= CROP_GATE.minMean && stats.mean <= CROP_GATE.maxMean;
        if (!valid) {
          omitted.push({ elevationId: elevation.id, panoramaId: candidate.pano.pano_id, reason: `rejected (missing=${rect.missingFraction.toFixed(2)}, sd=${stats.sd.toFixed(1)}, mean=${stats.mean.toFixed(1)})` });
          console.log(`omit ${elevation.id} view${viewIndex} ${candidate.pano.pano_id}: crop gate`);
          continue;
        }
        const encoded = jpeg.encode({ width: rect.width, height: rect.height, data: Buffer.from(rect.data) }, 89).data;
        const fileName = `${elevation.id.replace(/[/:]/g, '_')}__${candidate.pano.pano_id}.jpg`;
        await fs.writeFile(path.join(outRoot, fileName), encoded);
        // sourceMeanLuma over the rendered crop itself (matches how the strip
        // cutter's own manifest field is used downstream: an underexposed-view flag).
        const frame = stripFrame({
          wallStart: start, wallEnd: end, bottomNap: baseZ, topNap: topZ + headroomM,
          marginFactor: 1, requestedPixelsPerMetre: RENDER.pixelsPerMetre,
          renderedWidth: rect.width, renderedHeight: rect.height,
        });
        strips.push({
          file: fileName,
          pandId: elevation.id, // group by ELEVATION, not by 3DBAG pand -- see module doc
          address: `${elevation.buildingId} (${elevation.tile})`,
          panoramaId: candidate.pano.pano_id,
          capturedAt: candidate.pano.timestamp,
          sourceMeanLuma: Math.round(stats.mean * 100) / 100,
          roofBandPixelsPerMetre: RENDER.pixelsPerMetre,
          leafOff: (() => { const m = Number(candidate.pano.timestamp.slice(5, 7)); return m >= 11 || m <= 3; })(),
          topZ: topZ, // the SCAN's own topZ (no headroom) -- matches ManifestStrip.topZ's role as a 3DBAG-max fallback elsewhere; unused for A5 scoring, kept for schema compatibility
          frame,
          obliquityDeg: Number(candidate.obliquity.toFixed(2)),
          standoffM: Number(candidate.standoff.toFixed(2)),
          sourcePixelsPerMetre: Number(candidate.nativePixelsPerMetre.toFixed(2)),
          renderedPixelsPerMetre: RENDER.pixelsPerMetre,
          poseInferred: candidate.poseInferred,
        });
        console.log(`crop ${elevation.id} view${viewIndex} ${candidate.pano.pano_id} standoff=${candidate.standoff.toFixed(1)} obliq=${candidate.obliquity.toFixed(1)} ${rect.width}x${rect.height}`);
      } catch (error) {
        omitted.push({ elevationId: elevation.id, panoramaId: candidate.pano.pano_id, reason: String(error) });
        console.log(`omit ${elevation.id} view${viewIndex} ${candidate.pano.pano_id}: ${String(error)}`);
      }
    }
  });

  const byElevation = new Map<string, number>();
  for (const s of strips) byElevation.set(s.pandId, (byElevation.get(s.pandId) ?? 0) + 1);
  const manifest = {
    metadata: {
      version: VERSION, generatedAt: new Date().toISOString(), camera: CAMERA,
      headroomM, viewsPerElevation: VIEWS_PER_ELEVATION, minCaptureSeparationM: MIN_CAPTURE_SEPARATION_M,
      selection: SELECTION, render: RENDER, cropGate: CROP_GATE,
      goldCachePath, goldSource: 'feat/roofline-r1:review-data/roofline-gold/v1/measured.json',
      elevationsTotal: elevations.length,
      elevationsWithAnyView: byElevation.size,
      elevationsWithAtLeast2Views: [...byElevation.values()].filter(n => n >= 2).length,
      stripsWritten: strips.length,
      omitted: omitted.length,
    },
    strips,
    omitted,
  };
  await writeJsonAtomic(path.join(outRoot, 'manifest.json'), manifest);
  console.log(`wrote ${strips.length} crops across ${byElevation.size}/${elevations.length} elevations (${[...byElevation.values()].filter(n => n >= 2).length} with >=2 views) to ${outRoot}`);
  console.log(`${omitted.length} omissions`);
}

await main();
