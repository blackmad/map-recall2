import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import fs from 'node:fs/promises';
import path from 'node:path';
import { buildSourceFacadeOwnerCandidate } from './source-to-owner-candidate.js';
import { stageOwnerCandidateOutput } from './staged-owner-output.js';

const digest = (bytes: Buffer | string) => createHash('sha256').update(bytes).digest('hex');

async function contextOwners(root: string, manifest: any, target: any) {
  const centroid = (owner: any) => { const f = owner.geometry?.building?.footprint, ring = f?.type === 'Polygon' ? f.coordinates[0] : f?.coordinates?.[0]?.[0]; if (!ring?.length) return null; const points = ring.length > 1 && ring[0][0] === ring.at(-1)[0] && ring[0][1] === ring.at(-1)[1] ? ring.slice(0, -1) : ring; return points.reduce((sum: number[], point: number[]) => [sum[0] + point[0] / points.length, sum[1] + point[1] / points.length], [0, 0]); };
  const centre = centroid(target), owners: any[] = [];
  if (!centre) throw Error('Case 22 footprint unavailable');
  for (const tile of manifest.tiles) { const bytes = await fs.readFile(path.join(root, 'public', tile.url)); if (digest(bytes) !== tile.sha256) throw Error(`Corrupt context tile ${tile.key}`); for (const owner of JSON.parse(gunzipSync(bytes).toString()).owners) { if (owner.id === target.id) continue; const other = centroid(owner); if (other && Math.hypot(other[0] - centre[0], other[1] - centre[1]) <= 52) owners.push(owner); } }
  return owners.sort((a, b) => a.id.localeCompare(b.id));
}

export async function buildCase22GableCandidate(root = '.') {
  const casesBytes = await fs.readFile(path.join(root, 'public/data/facade-repair-preview/cases.json'));
  const correctionBytes = await fs.readFile(path.join(root, 'scripts/review/case22-stepped-gable-correction.json'));
  const pointerBytes = await fs.readFile(path.join(root, 'public/data/city-expansion/current.json'));
  const pointer = JSON.parse(pointerBytes.toString()), manifestPath = `public/data/city-expansion/releases/${pointer.releaseId}/manifest.json`;
  const manifestBytes = await fs.readFile(path.join(root, manifestPath)), manifest = JSON.parse(manifestBytes.toString());
  const cases = JSON.parse(casesBytes.toString()), correction = JSON.parse(correctionBytes.toString());
  const item = cases.cases.find((entry: any) => entry.caseId === correction.caseId);
  if (!item || item.owner.id !== correction.buildingId) throw Error('Case 22 owner binding unavailable');
  const full = item.shapeFeatures?.full, ground = item.shapeFeatures?.ground;
  if (!full || !ground) throw Error('Case 22 reviewed full and ground sources unavailable');
  const observation = item.candidateObservations?.find((entry: any) => entry.id === correction.observationId);
  if (!observation?.images?.full || !observation?.images?.ground) throw Error('Case 22 source projection evidence unavailable');
  const source = (features: any, image: any) => ({ ...features, projection: { plane: image.plane, localToNAPOffsetM: .65 } });
  const result = buildSourceFacadeOwnerCandidate(item.owner, { ...correction, sources: { full: source(full, observation.images.full), ground: source(ground, observation.images.ground) } });
  const context = await contextOwners(root, manifest, item.owner);
  const fullImage = observation.images.full, origin = item.owner.geometry.frame.originRD;
  const sourceCameraLocal = { x: fullImage.pose.x - origin.x, y: fullImage.pose.z - .65, z: origin.y - fullImage.pose.y };
  const planeMid = { x: (fullImage.plane.start.x + fullImage.plane.end.x) / 2 - origin.x, y: 8, z: origin.y - (fullImage.plane.start.y + fullImage.plane.end.y) / 2 };
  const dx = sourceCameraLocal.x - planeMid.x, dz = sourceCameraLocal.z - planeMid.z, length = Math.hypot(dx, dz), distance = 20;
  const packet = {
    version: 1, kind: 'source-to-owner-facade-candidate', generatedAt: new Date().toISOString(),
    target: { caseId: item.caseId, buildingId: item.owner.id, address: item.address, scopeNote: correction.scopeNote, baseline: item.owner, candidate: result.owner }, contextOwners: context,
    provenance: { ...result.provenance, source: { publicCropUrl: fullImage.publicUrl, cropSha256: fullImage.sha256, dimensions: { width: fullImage.width, height: fullImage.height }, captureDate: fullImage.date, pose: fullImage.pose, samplingPlane: fullImage.plane, localToNAPOffsetM: .65 }, sourceCameraLocal,
      streetContextFraming: { kind: 'normal-perspective-wide-street-eye-context', sourceEyeLocal: sourceCameraLocal, frontWallTargetLocal: planeMid, inferredInspectionEyeLocal: { x: planeMid.x + dx / length * distance, y: sourceCameraLocal.y, z: planeMid.z + dz / length * distance }, inferredHorizontalDistanceM: distance, assumedVerticalFovDeg: 54, targetY: planeMid.y, positionStatus: 'inferred source-side inspection position; walking-ground validity unverified', fovStatus: 'assumed', targetStatus: 'source-plane midpoint' }, inputs: {
      casesJson: { path: 'public/data/facade-repair-preview/cases.json', sha256: digest(casesBytes) },
      correction: { path: 'scripts/review/case22-stepped-gable-correction.json', sha256: digest(correctionBytes) },
      activeReleasePointer: { path: 'public/data/city-expansion/current.json', sha256: digest(pointerBytes), releaseId: pointer.releaseId }, activeReleaseManifest: { path: manifestPath, sha256: digest(manifestBytes) },
    }, context: { ownerCount: context.length, radiusM: 52, targetExcluded: true }, releaseActivation: 'none' },
  };
  const text = JSON.stringify(packet, null, 2) + '\n';
  const livePublicPath = 'public/canal-drive/data/case22-gable-city-preview.json';
  const codePaths = ['scripts/review/build-case22-gable-candidate.ts', 'scripts/review/source-to-owner-candidate.ts'];
  const inputBindings = [
    { path: 'public/data/facade-repair-preview/cases.json', sha256: digest(casesBytes) },
    { path: 'scripts/review/case22-stepped-gable-correction.json', sha256: digest(correctionBytes) },
    { path: 'public/data/city-expansion/current.json', sha256: digest(pointerBytes) }, { path: manifestPath, sha256: digest(manifestBytes) },
    { path: `public${fullImage.publicUrl}`, sha256: fullImage.sha256 }, { path: `public${observation.images.ground.publicUrl}`, sha256: observation.images.ground.sha256 },
    ...await Promise.all(codePaths.map(async file => ({ path: file, sha256: digest(await fs.readFile(path.join(root, file))) }))),
  ];
  return { ...(await stageOwnerCandidateOutput({ root, caseId: 'case22', packetText: text, livePublicPath, inputBindings })), candidateGeometryRevision: result.owner.geometryRevision, contextOwners: context.length };
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) buildCase22GableCandidate().then(value => console.log(JSON.stringify(value))).catch(error => { console.error(error); process.exitCode = 1; });
