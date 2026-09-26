import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import fs from 'node:fs/promises';
import path from 'node:path';
import { buildSourceFacadeOwnerCandidate } from './source-to-owner-candidate.js';
import { stageOwnerCandidateOutput } from './staged-owner-output.js';

const digest = (bytes: Buffer | string) => createHash('sha256').update(bytes).digest('hex');

function centroid(owner: any) {
  const footprint = owner.geometry?.building?.footprint;
  const ring = footprint?.type === 'Polygon' ? footprint.coordinates[0] : footprint?.coordinates?.[0]?.[0];
  if (!ring?.length) return null;
  const points = ring.length > 1 && ring[0][0] === ring.at(-1)[0] && ring[0][1] === ring.at(-1)[1] ? ring.slice(0, -1) : ring;
  return points.reduce((sum: number[], point: number[]) => [sum[0] + point[0] / points.length, sum[1] + point[1] / points.length], [0, 0]);
}

async function contextOwners(root: string, manifest: any, target: any) {
  const centre = centroid(target), owners: any[] = [];
  if (!centre) throw Error('Case 25 footprint unavailable');
  for (const tile of manifest.tiles) {
    const bytes = await fs.readFile(path.join(root, 'public', tile.url));
    if (digest(bytes) !== tile.sha256) throw Error(`Corrupt context tile ${tile.key}`);
    for (const owner of JSON.parse(gunzipSync(bytes).toString()).owners) {
      if (owner.id === target.id) continue;
      const other = centroid(owner);
      if (other && Math.hypot(other[0] - centre[0], other[1] - centre[1]) <= 52) owners.push(owner);
    }
  }
  return owners.sort((a, b) => a.id.localeCompare(b.id));
}

export async function buildCase25FlatCandidate(root = '.') {
  const casesPath = 'public/data/facade-repair-preview/cases.json';
  const correctionPath = 'scripts/review/case25-flat-parapet-correction.json';
  const pointerPath = 'public/data/city-expansion/current.json';
  const [casesBytes, correctionBytes, pointerBytes] = await Promise.all([
    fs.readFile(path.join(root, casesPath)), fs.readFile(path.join(root, correctionPath)), fs.readFile(path.join(root, pointerPath)),
  ]);
  const pointer = JSON.parse(pointerBytes.toString());
  const manifestPath = `public/data/city-expansion/releases/${pointer.releaseId}/manifest.json`;
  const manifestBytes = await fs.readFile(path.join(root, manifestPath));
  const manifest = JSON.parse(manifestBytes.toString());
  const cases = JSON.parse(casesBytes.toString()), correction = JSON.parse(correctionBytes.toString());
  const item = cases.cases.find((entry: any) => entry.caseId === correction.caseId);
  if (!item || item.owner.id !== correction.buildingId) throw Error('Case 25 owner binding unavailable');
  const observation = item.candidateObservations?.find((entry: any) => entry.id === correction.observationId);
  if (!item.shapeFeatures?.full || !item.shapeFeatures?.ground || !observation?.images?.full || !observation?.images?.ground) throw Error('Case 25 source evidence unavailable');
  const source = (features: any, image: any) => ({ ...features, projection: { plane: image.plane, localToNAPOffsetM: .65 } });
  const result = buildSourceFacadeOwnerCandidate(item.owner, { ...correction, sources: {
    full: source(item.shapeFeatures.full, observation.images.full),
    ground: source(item.shapeFeatures.ground, observation.images.ground),
  } });
  const context = await contextOwners(root, manifest, item.owner);
  const fullImage = observation.images.full, origin = item.owner.geometry.frame.originRD;
  const sourceCameraLocal = { x: fullImage.pose.x - origin.x, y: fullImage.pose.z - .65, z: origin.y - fullImage.pose.y };
  const planeMid = { x: (fullImage.plane.start.x + fullImage.plane.end.x) / 2 - origin.x, y: 8, z: origin.y - (fullImage.plane.start.y + fullImage.plane.end.y) / 2 };
  const dx = sourceCameraLocal.x - planeMid.x, dz = sourceCameraLocal.z - planeMid.z, length = Math.hypot(dx, dz), distance = 20;
  const packet = {
    version: 1, kind: 'source-to-owner-facade-candidate', generatedAt: new Date().toISOString(),
    target: { caseId: item.caseId, buildingId: item.owner.id, address: item.address, candidateLabel: 'Candidate', scopeNote: 'Pale bands, cornice, rectangular windows and one front-only central balcony rail are shown. Its shallow projection is inferred; the return, brackets, fine ornament and masonry arches remain unresolved.', baseline: item.owner, candidate: result.owner },
    contextOwners: context,
    provenance: { ...result.provenance, source: { publicCropUrl: fullImage.publicUrl, cropSha256: fullImage.sha256, dimensions: { width: fullImage.width, height: fullImage.height }, captureDate: fullImage.date, pose: fullImage.pose, samplingPlane: fullImage.plane, localToNAPOffsetM: .65 }, sourceCameraLocal,
      streetContextFraming: { kind: 'normal-perspective-wide-street-eye-context', sourceEyeLocal: sourceCameraLocal, frontWallTargetLocal: planeMid, inferredInspectionEyeLocal: { x: planeMid.x + dx / length * distance, y: sourceCameraLocal.y, z: planeMid.z + dz / length * distance }, inferredHorizontalDistanceM: distance, assumedVerticalFovDeg: 54, targetY: planeMid.y, positionStatus: 'inferred source-side inspection position; walking-ground validity unverified', fovStatus: 'assumed', targetStatus: 'source-plane midpoint' },
      inputs: { casesJson: { path: casesPath, sha256: digest(casesBytes) }, correction: { path: correctionPath, sha256: digest(correctionBytes) }, activeReleasePointer: { path: pointerPath, sha256: digest(pointerBytes), releaseId: pointer.releaseId }, activeReleaseManifest: { path: manifestPath, sha256: digest(manifestBytes) } },
      context: { ownerCount: context.length, radiusM: 52, targetExcluded: true }, releaseActivation: 'none' },
  };
  const text = JSON.stringify(packet, null, 2) + '\n';
  const livePublicPath = 'public/canal-drive/data/case25-flat-city-preview.json';
  const codePaths = ['scripts/review/build-case25-flat-candidate.ts', 'scripts/review/source-to-owner-candidate.ts'];
  const inputBindings = [
    { path: casesPath, sha256: digest(casesBytes) }, { path: correctionPath, sha256: digest(correctionBytes) },
    { path: pointerPath, sha256: digest(pointerBytes) }, { path: manifestPath, sha256: digest(manifestBytes) },
    { path: `public${fullImage.publicUrl}`, sha256: fullImage.sha256 }, { path: `public${observation.images.ground.publicUrl}`, sha256: observation.images.ground.sha256 },
    ...await Promise.all(codePaths.map(async file => ({ path: file, sha256: digest(await fs.readFile(path.join(root, file))) }))),
  ];
  return { ...(await stageOwnerCandidateOutput({ root, caseId: 'case25', packetText: text, livePublicPath, inputBindings })), candidateGeometryRevision: result.owner.geometryRevision, contextOwners: context.length };
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) buildCase25FlatCandidate().then(value => console.log(JSON.stringify(value))).catch(error => { console.error(error); process.exitCode = 1; });
