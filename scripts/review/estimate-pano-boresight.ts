/** Estimate each panorama's boresight from wall edges and compare to the
 * boresight measured from the human anchors. This is the scaling check: if the
 * automatic estimate tracks the measured value, the pipeline no longer needs a
 * hand-fit table per panorama.
 *
 * STATUS: experimental, and currently unreliable. The edge objective prefers
 * spurious vertical edges (score 17-26 at its answer vs 4-9 at the measured
 * boresight). Diagnosed causes: BAG wall endpoints are often party walls with
 * weak image edges, `height` is the ridge so the projected verticals extend
 * into the sky, and window mullions provide competing vertical edges. The next
 * step is to constrain the search with the GPS track-bearing prior and use the
 * eave rather than the ridge. It is not wired into any gate.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import zlib from 'node:zlib';
import sharp from 'sharp';
import { AMSTERDAM_WORLD_ALIGNED } from '../../src/canalRecall/facade/rectify.ts';
import { edgeMaps } from '../../src/canalRecall/facade/edgeSupport.ts';
import { refineBoresight, scoreBoresight, type WallEdge } from '../../src/canalRecall/facade/wallEdgeAlign.ts';
import { wallTopNAP } from '../../src/canalRecall/facade/wallTop.ts';
import { PANO_BORESIGHTS } from '../../src/canalRecall/facade/panoCamera.ts';

const MANIFEST = '.cache/city-appearance/areas/da-costabuurt-v1/panorama-audit/b4fc23112b0593e31eb3d4ae7226adb95639120d92a75965b4f841fd274a32fd/evidence/manifest.json';
const RELEASE = 'public/data/city-expansion/releases/c4bebc1fcc1ad9622ea4972755b3eee69f037928db4573219c86d2c4e088920d';
const RAW_DIR = '.cache/city-appearance/shared-panoramas';
const WORK_WIDTH = 6000;

async function loadOwners(): Promise<Map<string, any>> {
  const releaseManifest = JSON.parse(await fs.readFile(path.join(RELEASE, 'manifest.json'), 'utf8'));
  const owners = new Map<string, any>();
  for (const tile of releaseManifest.tiles) {
    const data = JSON.parse(zlib.gunzipSync(await fs.readFile(path.join('public', tile.url))).toString());
    for (const owner of data.owners ?? []) owners.set(owner.id, owner);
  }
  return owners;
}

const owners = await loadOwners();

const manifest = JSON.parse(await fs.readFile(MANIFEST, 'utf8'));
const panos = Object.keys(PANO_BORESIGHTS);

let priors: Record<string, number> = {};
try {
  const rows = JSON.parse(await fs.readFile('review-data/pano-track-priors.json', 'utf8'));
  priors = Object.fromEntries(rows.map((r: any) => [r.panoramaId, r.priorYawDeg]));
} catch { /* priors are optional */ }

const rows: any[] = [];
for (const panoramaId of panos) {
  const records = (manifest.records ?? []).filter((r: any) => r.images?.full?.panoramaId === panoramaId);
  if (!records.length) { rows.push({ panoramaId, error: 'no records' }); continue; }
  const pose = records[0].images.full.pose;

  const walls: WallEdge[] = [];
  for (const record of records) {
    const image = record.images.full;
    if (Number(image.visibility?.hiddenFraction ?? 0) > 0) continue;
    if (Number(image.obliquity) > 60 || Number(image.standoff) < 4 || Number(image.standoff) > 40) continue;
    const ground = Number(record.groundNAP);
    const owner = owners.get(record.buildingId);
    // Use the real eave from the matched 3DBAG wall surface; fall back to 0.7 of
    // the BAG height (the ridge) so the projected vertical never reaches the sky.
    const topNAP = owner ? wallTopNAP(owner, record.wall).topNAP : ground + 0.7 * Number(record.height);
    walls.push({
      start: { x: record.wall.start.x, y: record.wall.start.y },
      end: { x: record.wall.end.x, y: record.wall.end.y },
      baseZ: ground,
      topZ: Math.max(ground + 1, Math.min(topNAP, ground + 0.95 * Number(record.height))),
    });
  }
  if (!walls.length) { rows.push({ panoramaId, error: 'no usable walls' }); continue; }

  const rawPath = `${RAW_DIR}/${panoramaId}.jpg`;
  const decoded = await sharp(rawPath).greyscale().resize({ width: WORK_WIDTH }).raw().toBuffer({ resolveWithObject: true });
  const image = { data: new Uint8Array(decoded.data), width: decoded.info.width, height: decoded.info.height };

  const prior = Number.isFinite(priors[panoramaId]) ? priors[panoramaId] : 0;
  const estimate = refineBoresight(image, pose, walls, AMSTERDAM_WORLD_ALIGNED, { yawCentreDeg: prior, yawRangeDeg: 2, pitchRangeDeg: 0.8, coarseStepDeg: 0.1, fineStepDeg: 0.025 });
  const measured = PANO_BORESIGHTS[panoramaId];
  const maps = edgeMaps(image);
  const scoreAtZero = scoreBoresight(maps, pose, walls, AMSTERDAM_WORLD_ALIGNED, 0, 0).score;
  const scoreAtMeasured = scoreBoresight(maps, pose, walls, AMSTERDAM_WORLD_ALIGNED, measured.yawDeg, measured.pitchDeg).score;
  rows.push({
    panoramaId,
    walls: walls.length,
    estimatedYawDeg: estimate.yawDeg,
    measuredYawDeg: measured.yawDeg,
    yawDeltaDeg: Number((estimate.yawDeg - measured.yawDeg).toFixed(2)),
    estimatedPitchDeg: estimate.pitchDeg,
    measuredPitchDeg: measured.pitchDeg,
    scoreAtZero: Number(scoreAtZero.toFixed(1)),
    scoreAtMeasured: Number(scoreAtMeasured.toFixed(1)),
    scoreAtEstimate: Number(estimate.score.toFixed(1)),
  });
}

console.log(JSON.stringify(rows, null, 2));
