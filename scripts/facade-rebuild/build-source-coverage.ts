/** Rectify wider, pose-bound coverage for the two photo-lab source audits. */
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import jpeg from 'jpeg-js';
import { buildElevations, inFrontOf, obliquityDeg, standoffM } from '../../src/canalRecall/facade/elevations.ts';
import { rectifyFacade, type EquirectangularImage } from '../../src/canalRecall/facade/rectify.ts';
import { GEOID_SEPARATION_M } from '../../src/canalRecall/facade/sources/amsterdamPanorama.ts';
import { RD_NEW } from '../../src/canalRecall/facade/sources/netherlands.ts';

const arg = (name: string) => process.argv.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const root = path.resolve('.cache/facade-rebuild/raw/v1');
const input = path.resolve(arg('input') ?? 'public/canal-drive/facade-photo-review/local/pilot-01/manifest.json');
const output = path.resolve(arg('out') ?? '.cache/facade-rebuild/reports/source-coverage-2026-09-06');
const panoramaCache = path.resolve('.cache/facade-rebuild/source-coverage/panoramas');
const targets = new Set(['Herengracht 219', 'Herengracht 242']);
const sha = (bytes: Uint8Array | Buffer) => createHash('sha256').update(bytes).digest('hex');
const angularDifference = (left: number, right: number) => {
  const difference = Math.abs(left - right) % 360;
  return Math.min(difference, 360 - difference);
};

const [manifestBytes, registryBytes, panoramaBytes, massingBytes] = await Promise.all([
  readFile(input), readFile(path.join(root, 'amsterdam-grachtengordel-west-registry.json')),
  readFile(path.join(root, 'amsterdam-grachtengordel-west-panoramas.json')),
  readFile(path.join(root, 'amsterdam-grachtengordel-west-massing.json')),
]);
const manifest = JSON.parse(manifestBytes.toString());
const registry = JSON.parse(registryBytes.toString()).data;
const panoramas = JSON.parse(panoramaBytes.toString()).data;
const massing = new Map(JSON.parse(massingBytes.toString()).data.map((entry: any) => [entry.buildingId, entry]));
await mkdir(output, { recursive: true });
await mkdir(panoramaCache, { recursive: true });

const results = [];
for (const record of manifest.records.filter((entry: any) => targets.has(entry.source?.address))) {
  const source = record.source;
  const panorama = panoramas.find((entry: any) => entry.panoramaId === source.panoramaId);
  const registered = registry.find((entry: any) => entry.buildingId === source.pandId);
  const mass: any = massing.get(source.pandId);
  if (!panorama || !registered || !mass || mass.insufficientInput || !mass.geometryValid)
    throw new Error(`Missing supported source geometry for ${source.address}`);
  const camera = RD_NEW.fromLngLat(panorama.lngLat);
  const walls = buildElevations(registered.footprintLngLat.map((point: [number, number]) => RD_NEW.fromLngLat(point)), { pandId: source.pandId });
  const candidates = walls.filter(wall => inFrontOf(wall, camera));
  const wall = candidates.sort((left, right) =>
    angularDifference(left.facingDeg, source.wallFacingDeg) - angularDifference(right.facingDeg, source.wallFacingDeg)
    || Math.abs(left.lengthM - source.wallWidthM) - Math.abs(right.lengthM - source.wallWidthM))[0];
  if (!wall || angularDifference(wall.facingDeg, source.wallFacingDeg) > 2) throw new Error(`Could not reproduce source wall for ${source.address}`);

  const panoramaPath = path.join(panoramaCache, `${panorama.panoramaId}.jpg`);
  let bytes: Buffer;
  try { bytes = await readFile(panoramaPath); }
  catch {
    const response = await fetch(panorama.imageUrl, { headers: { 'User-Agent': 'MapRecallFacadeCoverage/1.0' }, signal: AbortSignal.timeout(120_000) });
    if (!response.ok) throw new Error(`${source.address} panorama: HTTP ${response.status}`);
    bytes = Buffer.from(await response.arrayBuffer());
    await writeFile(panoramaPath, bytes);
  }
  const decoded = jpeg.decode(bytes, { useTArray: true, formatAsRGBA: true });
  const image: EquirectangularImage = { width: decoded.width, height: decoded.height, data: decoded.data };
  const rectified = rectifyFacade(image, {
    x: camera.x, y: camera.y, z: panorama.cameraHeight - GEOID_SEPARATION_M,
    headingDeg: panorama.headingDeg, pitchDeg: panorama.pitchDeg, rollDeg: panorama.rollDeg,
  }, { start: wall.start, end: wall.end, baseZ: mass.groundLevel - 1.5, topZ: mass.ridgeHeight + 1.5 },
  { pixelsPerMetre: 70, yaw: 'centre' });
  if (rectified.missingFraction > 0) throw new Error(`${source.address} wider rectification contains missing-height pixels`);
  const encoded = jpeg.encode({ width: rectified.width, height: rectified.height, data: Buffer.from(rectified.data) }, 90).data;
  const file = `${record.id}.wider-source.jpg`;
  await writeFile(path.join(output, file), encoded);
  const sourceRelativeTopM = record.frame.topM;
  const sourceRelativeBottomM = sourceRelativeTopM - record.height * record.frame.metresPerPixelY;
  const cameraAboveGroundM = panorama.cameraHeight - GEOID_SEPARATION_M - mass.groundLevel;
  const poseHeightStatus = cameraAboveGroundM >= .25 && cameraAboveGroundM <= 4 ? 'plausible' : 'outlier';
  results.push({
    address: source.address, pandId: source.pandId, panoramaId: panorama.panoramaId,
    capturedAt: panorama.capturedAt, imageUrl: panorama.imageUrl,
    sourceManifestSha256: sha(manifestBytes), sourceStripSha256: record.sourceSha256,
    panoramaSha256: sha(bytes), rectifiedSha256: sha(encoded), file,
    cameraPose: { lngLat: panorama.lngLat, cameraHeightEllipsoidM: panorama.cameraHeight,
      cameraHeightNapM: panorama.cameraHeight - GEOID_SEPARATION_M, headingDeg: panorama.headingDeg,
      pitchDeg: panorama.pitchDeg, rollDeg: panorama.rollDeg, cameraAboveGroundM, poseHeightStatus,
      note: poseHeightStatus === 'outlier'
        ? 'Published height falls outside the bounded street-camera range; this rectification diagnoses coverage but cannot certify vertical registration.'
        : 'Published pose height is within the bounded street-camera range; registration still requires image review.' },
    wall: { elevationId: wall.elevationId, facingDeg: wall.facingDeg, widthM: wall.lengthM,
      standoffM: standoffM(wall, camera), obliquityDeg: obliquityDeg(wall, camera) },
    verticalCoverage: {
      originalStripRelativeToGroundM: [sourceRelativeBottomM, sourceRelativeTopM],
      widerRectificationNapM: [mass.groundLevel - 1.5, mass.ridgeHeight + 1.5],
      eavesNapM: mass.eavesHeight, ridgeNapM: mass.ridgeHeight,
      sourceTouchesTopOpening: record.openings.some((opening: any) => opening.box[1] <= 3),
      sourceTouchesBottomOpening: record.openings.some((opening: any) => opening.box[3] >= record.height - 3),
      note: 'Touching openings prove the original strip clips architectural evidence; the wider rectangle is bound to the exact published pose and BAG wall but remains unreviewed registration.'
    },
    image: { width: rectified.width, height: rectified.height, pixelsPerMetre: rectified.pixelsPerMetre,
      missingFraction: rectified.missingFraction },
    massing: { source: '3DBAG/AHN3', groundNapM: mass.groundLevel, eavesNapM: mass.eavesHeight,
      ridgeNapM: mass.ridgeHeight, roofForm: mass.roofForm, reconstructionErrorM: mass.reconstructionError },
    disposition: poseHeightStatus === 'outlier'
      ? 'Coverage diagnostic only; reject vertical registration until the panorama height is repaired from a supported source.'
      : 'Coverage diagnostic only; roof type and basement ownership require visual review of this rectification.'
  });
  console.log(`${source.address}: ${rectified.width}×${rectified.height}, pano ${sha(bytes).slice(0, 12)}, rectified ${sha(encoded).slice(0, 12)}`);
}
await writeFile(path.join(output, 'report.json'), JSON.stringify({
  generatedAt: new Date().toISOString(),
  attribution: '© Gemeente Amsterdam, Kernregistratie Panoramabeelden (CC BY 4.0)',
  inputs: { manifest: input, manifestSha256: sha(manifestBytes), registrySha256: sha(registryBytes),
    panoramasSha256: sha(panoramaBytes), massingSha256: sha(massingBytes) },
  records: results,
  acceptance: 'None. Exact-pose source coverage diagnostics; no identity, registration, or feature acceptance.'
}, null, 2) + '\n');
console.log(output);
