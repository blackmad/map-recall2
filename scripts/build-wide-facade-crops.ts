/** Select useful-distance panoramas and build wider, full-façade review crops. */
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import jpeg from 'jpeg-js';
import {
  distanceMetres, rankFacadeViews, selectDistinctFacadeViews,
  type FacadePanoramaCandidate, type LonLat,
} from '../src/canalRecall/building/facadeView.ts';

type ApiPanorama = { pano_id: string; timestamp: string; geometry: { coordinates: [number, number, number] }; surface_type: string; _links: { self: { href: string } } };
type Item = { buildingId: string; centre: [number, number]; heading?: number; panoId?: string; observedAt?: string; panoramaImage?: string; panoramaMetadata?: { heading?: number; geometry?: { coordinates?: [number, number, number] } } };
type Crop = { schemaVersion: 2; buildingId: string; viewRank: number; image: string; target: LonLat; panoId: string | null; observedAt: string | null; camera: LonLat | null; cameraDistanceMetres: number | null; heading: number; fov: number; sourceUrl?: string; method: string };
type Rejection = { buildingId: string; reason: string; attemptedAt: string };
type OutputManifest = { schemaVersion: 2; generatedAt: string; sourceManifest: string; policy: Record<string, unknown>; crops: Crop[]; rejections: Rejection[] };

const arg = (name: string) => process.argv.find((value) => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const root = path.resolve(arg('root') || '.cache/building-enrichment/panorama');
const limit = Math.max(1, Number(arg('limit') || 25));
const radius = Math.max(20, Number(arg('radius') || 45));
const mission = arg('mission') || '2025';
const viewsPerBuilding = Math.max(1, Number(arg('views-per-building') || 3));
const offline = process.argv.includes('--offline');
const sourceManifest = path.join(root, 'manifest.json');
const outputFile = path.join(root, 'wide-crop-manifest.json');
const imageDirectory = path.join(root, 'wide-images');
const input = JSON.parse(await readFile(sourceManifest, 'utf8')) as { items: Item[] };
await mkdir(imageDirectory, { recursive: true });

let prior: Partial<OutputManifest> = {};
try { prior = JSON.parse(await readFile(outputFile, 'utf8')) as Partial<OutputManifest>; } catch { /* first run */ }
const crops = (prior.crops || []) as Crop[];
const rejections = (prior.rejections || []) as Rejection[];
const cropCounts = new Map<string, number>();
for (const crop of crops) cropCounts.set(crop.buildingId, (cropCounts.get(crop.buildingId) || 0) + 1);
const candidates = input.items.filter((item) => (cropCounts.get(item.buildingId) || 0) < viewsPerBuilding).slice(0, limit);
const wait = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function fetchWithRetry(url: string, accept: string): Promise<Response> {
  let error: unknown;
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const response = await fetch(url, { headers: { Accept: accept, 'User-Agent': 'MapRecallFacadeCrop/2.0' } });
      if (response.ok) return response;
      error = new Error(`HTTP ${response.status}: ${url}`);
      if (response.status < 500 && response.status !== 429) break;
    } catch (caught) { error = caught; }
    await wait(400 * 2 ** attempt);
  }
  throw error;
}

async function writeManifest(): Promise<void> {
  const manifest: OutputManifest = {
    schemaVersion: 2,
    generatedAt: new Date().toISOString(),
    sourceManifest: path.relative(process.cwd(), sourceManifest),
    policy: { mode: offline ? 'offline' : 'api', mission, minDistanceMetres: 8, idealDistanceMetres: 22, maxDistanceMetres: radius, viewsPerBuilding, minimumCameraSeparationMetres: 5, selection: 'distance-to-22m, newest, pano-id' },
    crops,
    rejections,
  };
  const temporary = `${outputFile}.tmp`;
  await writeFile(temporary, JSON.stringify(manifest, null, 2));
  await rename(temporary, outputFile);
}

async function offlineWideCrop(item: Item): Promise<Crop> {
  if (!item.panoramaImage || item.heading === undefined) throw new Error('no-cached-equirectangular-source');
  const source = jpeg.decode(await readFile(path.join(root, item.panoramaImage)), { useTArray: true });
  const width = 1600, height = 1000, data = Buffer.alloc(width * height * 4);
  const horizontal = 100 * Math.PI / 180;
  const vertical = 2 * Math.atan(Math.tan(horizontal / 2) / (width / height));
  const sourceHeading = Number(item.panoramaMetadata?.heading || 0);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const nx = 2 * (x + 0.5) / width - 1, ny = 2 * (y + 0.5) / height - 1;
      const yaw = Math.atan(nx * Math.tan(horizontal / 2)), pitch = Math.atan(-ny * Math.tan(vertical / 2));
      const worldYaw = item.heading + yaw * 180 / Math.PI;
      const sx = Math.floor((((0.5 + (worldYaw - sourceHeading) / 360) % 1 + 1) % 1) * source.width);
      const sy = Math.max(0, Math.min(source.height - 1, Math.floor((0.5 - pitch / Math.PI) * source.height)));
      const from = (sy * source.width + sx) * 4, to = (y * width + x) * 4;
      data[to] = source.data[from]; data[to + 1] = source.data[from + 1]; data[to + 2] = source.data[from + 2]; data[to + 3] = 255;
    }
  }
  const name = `${item.buildingId.replaceAll(/[^a-zA-Z0-9_-]/g, '_')}.jpg`;
  await writeFile(path.join(imageDirectory, name), jpeg.encode({ data, width, height }, 88).data);
  const coordinates = item.panoramaMetadata?.geometry?.coordinates;
  const camera: LonLat | null = coordinates ? [coordinates[0], coordinates[1]] : null;
  return { schemaVersion: 2, buildingId: item.buildingId, viewRank: 1, image: `wide-images/${name}`, target: item.centre, panoId: item.panoId || null, observedAt: item.observedAt || null, camera, cameraDistanceMetres: camera ? Number(distanceMetres(camera, item.centre).toFixed(1)) : null, heading: item.heading, fov: 100, method: 'offline-cached-equirectangular-wide-v2' };
}

for (let index = 0; index < candidates.length; index++) {
  const item = candidates[index];
  try {
    let crop: Crop;
    if (offline) {
      crop = await offlineWideCrop(item);
    } else {
      const [lon, lat] = item.centre;
      const url = new URL('https://api.data.amsterdam.nl/panorama/panoramas/');
      url.search = new URLSearchParams({ near: `${lon},${lat}`, radius: String(radius), srid: '4326', page_size: '200', tags: `mission-${mission}` }).toString();
      // This DSO endpoint returns JSON but responds 406 to a strict
      // `Accept: application/json`; its default representation is the API.
      const response = await fetchWithRetry(url.toString(), '*/*');
      if (!response.headers.get('content-type')?.includes('json')) throw new Error('panorama-search-returned-non-json');
      const nearby = await response.json() as { _embedded?: { panoramas?: ApiPanorama[] } };
      const panoramaById = new Map((nearby._embedded?.panoramas || []).map((panorama) => [panorama.pano_id, panorama]));
      const apiCandidates: FacadePanoramaCandidate[] = [...panoramaById.values()].map((panorama) => ({ panoId: panorama.pano_id, observedAt: panorama.timestamp, camera: [panorama.geometry.coordinates[0], panorama.geometry.coordinates[1]], surfaceType: panorama.surface_type }));
      const existing = new Set(crops.filter((entry) => entry.buildingId === item.buildingId).map((entry) => entry.panoId));
      const chosenViews = selectDistinctFacadeViews(
        rankFacadeViews(apiCandidates, item.centre, { minDistanceMetres: 8, idealDistanceMetres: 22, maxDistanceMetres: radius })
          .filter((view) => !existing.has(view.panoId)),
        Math.max(1, viewsPerBuilding - (cropCounts.get(item.buildingId) || 0)),
      );
      if (!chosenViews.length) throw new Error(`no-useful-distance-${mission}-land-panorama`);
      const created: Crop[] = [];
      for (let viewIndex = 0; viewIndex < chosenViews.length; viewIndex++) {
        const chosen = chosenViews[viewIndex];
        const viewRank = (cropCounts.get(item.buildingId) || 0) + viewIndex + 1;
        const thumbnail = new URL(`https://api.data.amsterdam.nl/panorama/thumbnail/${encodeURIComponent(chosen.panoId)}/`);
        thumbnail.search = new URLSearchParams({ width: '1600', fov: String(chosen.fieldOfView), horizon: '.43', aspect: '1.6', heading: chosen.targetHeading.toFixed(2) }).toString();
        const imageResponse = await fetchWithRetry(thumbnail.toString(), 'image/*');
        if (!imageResponse.headers.get('content-type')?.startsWith('image/')) throw new Error('thumbnail-returned-non-image');
        const name = `${item.buildingId.replaceAll(/[^a-zA-Z0-9_-]/g, '_')}_${viewRank}.jpg`;
        await writeFile(path.join(imageDirectory, name), Buffer.from(await imageResponse.arrayBuffer()));
        created.push({ schemaVersion: 2, buildingId: item.buildingId, viewRank, image: `wide-images/${name}`, target: item.centre, panoId: chosen.panoId, observedAt: chosen.observedAt, camera: chosen.camera, cameraDistanceMetres: Number(chosen.distanceMetres.toFixed(1)), heading: Number(chosen.targetHeading.toFixed(1)), fov: chosen.fieldOfView, sourceUrl: panoramaById.get(chosen.panoId)?._links.self.href, method: 'useful-distance-current-panorama-v2' });
      }
      crops.push(...created.slice(0, -1));
      crop = created.at(-1)!;
    }
    crops.push(crop);
    const previousRejection = rejections.findIndex((entry) => entry.buildingId === item.buildingId);
    if (previousRejection >= 0) rejections.splice(previousRejection, 1);
    await writeManifest();
    const count = crops.filter((entry) => entry.buildingId === item.buildingId).length;
    process.stdout.write(`${index + 1}/${candidates.length} ${item.buildingId} → ${count} views; last ${crop.cameraDistanceMetres ?? '?'}m, ${crop.fov}°\n`);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    const previous = rejections.findIndex((entry) => entry.buildingId === item.buildingId);
    const rejection = { buildingId: item.buildingId, reason, attemptedAt: new Date().toISOString() };
    if (previous >= 0) rejections[previous] = rejection; else rejections.push(rejection);
    await writeManifest();
    process.stderr.write(`${item.buildingId}: ${reason}\n`);
  }
}
process.stdout.write(`Wrote ${crops.length} wide façade crops; ${rejections.length} rejected\n`);
