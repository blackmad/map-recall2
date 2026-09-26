/** Build the control-point task for the pano anchor tool.
 *
 * Anchors are the two endpoints of the photographed frontage wall, at mid-wall
 * height so they sit on the visible vertical edge above street clutter. The
 * frontage is the canonical BAG elevation the crop was made from, so its ends
 * are on the camera-facing wall rather than an occluded rear corner. Each world
 * point is predicted into the raw equirectangular panorama through the shared
 * camera model. The human accepts or corrects the predicted pixel; that
 * independent world<->pixel correspondence is what the registration gate has
 * been missing. This script asserts no measured pixel.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { AMSTERDAM_WORLD_ALIGNED, worldToEquirectangularPixel } from '../../src/canalRecall/facade/rectify.ts';

const MANIFEST = '.cache/city-appearance/areas/da-costabuurt-v1/panorama-audit/b4fc23112b0593e31eb3d4ae7226adb95639120d92a75965b4f841fd274a32fd/evidence/manifest.json';
const RELEASE = 'public/data/city-expansion/releases/c4bebc1fcc1ad9622ea4972755b3eee69f037928db4573219c86d2c4e088920d';
const RAW_DIR = '.cache/city-appearance/shared-panoramas';
const OUT = process.argv.find((value) => value.startsWith('--out='))?.slice('--out='.length) ?? 'public/canal-drive/data/pano-anchor-task.json';
/** `--auto=N` picks N high-quality panoramas automatically instead of the defaults. */
const AUTO = Number(process.argv.find((value) => value.startsWith('--auto='))?.slice('--auto='.length) ?? 0);

const DEFAULT_PANOS = [
  { panoramaId: 'TMX7316010203-003006_pano_0003_000165', usedFor: 'fit' as const },
  { panoramaId: 'b_20241129_0829_Track29_Sphere_00016', usedFor: 'fit' as const },
  { panoramaId: 'TMX7316010203-002928_pano_0012_000070', usedFor: 'holdout' as const },
];
const MAX_MARKERS_PER_PANO = 6;
const MAX_MARKERS_PER_BUILDING = 2;
const MID_HEIGHT_FRACTION = 0.5;
const MAX_OBLIQUITY_DEG = 60;
const MIN_STANDOFF_M = 4;
const MAX_STANDOFF_M = 40;

interface Marker {
  id: string;
  label: string;
  kind: 'wall-end';
  buildingId: string;
  address: string;
  wallElevationId: string;
  world: { x: number; y: number; z: number; datum: 'NAP' };
  predicted: [number, number];
  standoffM: number;
  obliquityDeg: number;
  footprint: number[][];
  wall: number[][];
}

const round = (value: number, digits = 4) => Number(value.toFixed(digits));

async function loadOwners(): Promise<Map<string, any>> {
  const manifest = JSON.parse(await fs.readFile(path.join(RELEASE, 'manifest.json'), 'utf8'));
  const owners = new Map<string, any>();
  for (const tile of manifest.tiles) {
    const data = JSON.parse(zlib.gunzipSync(await fs.readFile(path.join('public', tile.url))).toString());
    for (const owner of data.owners ?? []) owners.set(owner.id, owner);
  }
  return owners;
}

/** Pick high-quality multi-wall panoramas, spread across missions. */
function autoSelectPanos(byPano: Map<string, any[]>, count: number): { panoramaId: string; usedFor: 'fit' | 'holdout' }[] {
  const scored: { panoramaId: string; score: number; mission: string }[] = [];
  for (const [panoramaId, group] of byPano) {
    let usable = 0, obliquitySum = 0;
    for (const record of group) {
      const image = record.images.full;
      const hidden = Number(image.visibility?.hiddenFraction ?? 0);
      const obliquity = Number(image.obliquity), standoff = Number(image.standoff);
      if (hidden > 0 || obliquity > 45 || standoff < 4 || standoff > 30) continue;
      usable += 1; obliquitySum += obliquity;
    }
    if (usable < 2) continue;
    const month = new Date(group[0].images.full.date).getUTCMonth() + 1;
    const leafOff = month >= 11 || month <= 3 ? 1.2 : 1;
    scored.push({ panoramaId, score: usable * leafOff / (1 + obliquitySum / usable / 90), mission: panoramaId.split('_')[0] });
  }
  scored.sort((a, b) => b.score - a.score || a.panoramaId.localeCompare(b.panoramaId));
  const picked: { panoramaId: string; usedFor: 'fit' | 'holdout' }[] = [];
  const perMission = new Map<string, number>();
  for (const entry of scored) {
    if (picked.length >= count) break;
    const used = perMission.get(entry.mission) ?? 0;
    if (used >= 3) continue;
    perMission.set(entry.mission, used + 1);
    picked.push({ panoramaId: entry.panoramaId, usedFor: 'fit' });
  }
  if (picked.length) picked[picked.length - 1].usedFor = 'holdout';
  return picked;
}

async function build() {  const manifest = JSON.parse(await fs.readFile(MANIFEST, 'utf8'));
  const records: any[] = manifest.records ?? [];
  const owners = await loadOwners();

  const byPano = new Map<string, any[]>();
  for (const record of records) {
    const panoId = record.images?.full?.panoramaId;
    if (!panoId) continue;
    if (!byPano.has(panoId)) byPano.set(panoId, []);
    byPano.get(panoId)!.push(record);
  }

  const panos: any[] = [];
  const missing: string[] = [];
  const selected = AUTO > 0 ? autoSelectPanos(byPano, AUTO) : DEFAULT_PANOS;
  for (const { panoramaId, usedFor } of selected) {
    try { await fs.access(path.join(RAW_DIR, `${panoramaId}.jpg`)); } catch { missing.push(panoramaId); continue; }
    const group = byPano.get(panoramaId) ?? [];
    if (!group.length) { missing.push(`${panoramaId} (no records)`); continue; }
    const image = group[0].images.full;
    const pose = image.pose;
    const dimensions = { width: image.sourceDimensions[0], height: image.sourceDimensions[1] };

    const byBuilding = new Map<string, any>();
    for (const record of group) {
      const existing = byBuilding.get(record.buildingId);
      if (!existing || Number(record.images.full.obliquity) < Number(existing.images.full.obliquity)) byBuilding.set(record.buildingId, record);
    }

    type Candidate = { world: { x: number; y: number; z: number }; predicted: [number, number]; record: any; standoff: number; obliquity: number; footprint: number[][]; wall: number[][] };
    const candidates: Candidate[] = [];
    for (const record of byBuilding.values()) {
      const image = record.images.full;
      const standoff = Number(image.standoff);
      const obliquity = Number(image.obliquity);
      const hidden = Number(image.visibility?.hiddenFraction ?? 0);
      if (hidden > 0 || obliquity > MAX_OBLIQUITY_DEG || standoff < MIN_STANDOFF_M || standoff > MAX_STANDOFF_M) continue;
      const owner = owners.get(record.buildingId);
      if (!owner) continue;
      const origin = owner.geometry.frame.originRD;
      const footprintGeometry = owner.geometry.building.footprint;
      const polygons = footprintGeometry?.type === 'Polygon' ? [footprintGeometry.coordinates] : footprintGeometry?.coordinates ?? [];
      const rings: number[][][] = [];
      for (const polygon of polygons) for (const ring of polygon.slice(0, 1)) rings.push(ring);
      const footprint = (rings[0] ?? []).map(([lx, lz]) => [round(origin.x + lx, 2), round(origin.y - lz, 2)]);
      const groundNAP = Number(owner.geometry.building.groundNAP ?? record.groundNAP);
      const height = Number(owner.geometry.building.height ?? record.height);
      const z = groundNAP + height * MID_HEIGHT_FRACTION;
      const wall = record.wall;
      const wallSegment = [[round(wall.start.x, 2), round(wall.start.y, 2)], [round(wall.end.x, 2), round(wall.end.y, 2)]];
      for (const point of [wall.start, wall.end]) {
        const world = { x: point.x, y: point.y, z };
        const predicted = worldToEquirectangularPixel(world, pose, dimensions, AMSTERDAM_WORLD_ALIGNED);
        if (!(predicted[0] >= 0 && predicted[0] < dimensions.width && predicted[1] >= 0 && predicted[1] < dimensions.height)) continue;
        candidates.push({ world, predicted, record, standoff, obliquity, footprint, wall: wallSegment });
      }
    }

    candidates.sort((a, b) => a.obliquity - b.obliquity || a.standoff - b.standoff);
    // Adjacent buildings share a party-wall endpoint; ask for that corner once.
    const deduped: Candidate[] = [];
    for (const candidate of candidates) {
      if (deduped.some((other) => Math.hypot(other.world.x - candidate.world.x, other.world.y - candidate.world.y) < 0.5)) continue;
      deduped.push(candidate);
    }
    const chosen: Candidate[] = [];
    const perBuilding = new Map<string, number>();
    for (const candidate of deduped) {
      if (chosen.length >= MAX_MARKERS_PER_PANO) break;
      const count = perBuilding.get(candidate.record.buildingId) ?? 0;
      if (count >= MAX_MARKERS_PER_BUILDING) continue;
      perBuilding.set(candidate.record.buildingId, count + 1);
      chosen.push(candidate);
    }

    const markers: Marker[] = chosen.map((candidate, index) => ({
      id: `${panoramaId}#${index}`,
      kind: 'wall-end',
      label: `${candidate.record.address} · wall end @ ${(candidate.world.z - Number(candidate.record.groundNAP)).toFixed(1)} m`,
      buildingId: candidate.record.buildingId,
      address: candidate.record.address,
      wallElevationId: candidate.record.elevationId,
      world: { x: round(candidate.world.x), y: round(candidate.world.y), z: round(candidate.world.z), datum: 'NAP' },
      predicted: [round(candidate.predicted[0], 1), round(candidate.predicted[1], 1)],
      standoffM: round(candidate.standoff, 2),
      obliquityDeg: round(candidate.obliquity, 1),
      footprint: candidate.footprint,
      wall: candidate.wall,
    }));

    panos.push({
      panoramaId, usedFor, date: image.date, mission: panoramaId.split('_')[0],
      imageUrl: `/api/pano-anchor/pano/${encodeURIComponent(panoramaId)}`,
      width: dimensions.width, height: dimensions.height, pose, datum: image.datum,
      camera: { x: round(pose.x, 2), y: round(pose.y, 2) },
      cameraModelId: AMSTERDAM_WORLD_ALIGNED.id, markers,
    });
  }

  const task = {
    version: 1, kind: 'pano-anchor-task', cameraModelId: AMSTERDAM_WORLD_ALIGNED.id,
    generatedAt: new Date().toISOString(), sourceManifest: MANIFEST,
    instruction: 'Press Enter if the marker already sits on the building corner; drag or arrow-key to correct; S to skip.',
    panos,
  };
  await fs.mkdir(path.dirname(OUT), { recursive: true });
  await fs.writeFile(OUT, JSON.stringify(task, null, 2) + '\n');
  console.log(JSON.stringify({ output: OUT, panos: panos.length, markers: panos.reduce((n, p) => n + p.markers.length, 0), missing }, null, 2));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await build();
