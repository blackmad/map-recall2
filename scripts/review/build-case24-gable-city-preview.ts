/** Build a read-only, local preview of an approximate gable in the shared city renderer.
 * This deliberately emits a separate preview packet: it never writes a release tile or
 * the active release pointer. */
import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import fs from 'node:fs/promises';
import path from 'node:path';
import { buildBuildingGableCandidate } from './building-gable-candidate.js';

const digest = (bytes: Buffer | string) => createHash('sha256').update(bytes).digest('hex');
const ROOT = path.resolve('.');
const read = async (file: string) => {
  const bytes = await fs.readFile(path.join(ROOT, file));
  return { value: JSON.parse(bytes.toString()), sha256: digest(bytes) };
};

/** The neighbourhood comes from the existing immutable release only for spatial context.
 * The target itself is excluded because the comparison packet binds a separate cached
 * LoD2.2 owner revision. */
async function nearbyReleaseOwners(manifest: any, target: any) {
  const centroid = (owner: any) => {
    const footprint = owner.geometry?.building?.footprint;
    const polygon = footprint?.type === 'Polygon' ? footprint.coordinates[0] : footprint?.coordinates?.[0]?.[0];
    if (!Array.isArray(polygon) || !polygon.length) return null;
    const unique = polygon.length > 1 && polygon[0][0] === polygon.at(-1)[0] && polygon[0][1] === polygon.at(-1)[1] ? polygon.slice(0, -1) : polygon;
    return unique.reduce((sum: [number, number], point: [number, number]) => [sum[0] + point[0] / unique.length, sum[1] + point[1] / unique.length], [0, 0]);
  };
  const targetCentroid = centroid(target);
  if (!targetCentroid) throw Error('Case 24 target footprint unavailable');
  const owners: any[] = [];
  for (const tile of manifest.tiles) {
    const bytes = await fs.readFile(path.join(ROOT, 'public', tile.url));
    if (digest(bytes) !== tile.sha256) throw Error(`Corrupt active context tile ${tile.key}`);
    const payload = JSON.parse(gunzipSync(bytes).toString());
    for (const owner of payload.owners) {
      if (owner.id === target.id) continue;
      const otherCentroid = centroid(owner);
      if (otherCentroid && Math.hypot(otherCentroid[0] - targetCentroid[0], otherCentroid[1] - targetCentroid[1]) <= 52) owners.push(owner);
    }
  }
  return owners.sort((a, b) => a.id.localeCompare(b.id));
}

export async function buildCase24GableCityPreview() {
  const cases = await read('public/data/facade-repair-preview/cases.json');
  const comparison = await read('review-data/building-source-comparison/case-24.json');
  const pointer = await read('public/data/city-expansion/current.json');
  const manifestPath = `public/data/city-expansion/releases/${pointer.value.releaseId}/manifest.json`;
  const manifest = await read(manifestPath);
  const baseline = cases.value.cases.find((item: any) => item.caseId === 'case-24')?.owner;
  const sourceCase = cases.value.cases.find((item: any) => item.caseId === 'case-24');
  if (!baseline || !sourceCase?.shapeFeatures?.full) throw Error('Case 24 baseline owner or reviewed source windows unavailable');
  if (comparison.value.inputs.casesJson.sha256 !== cases.sha256) throw Error('Comparison is not bound to current case packet');
  const reviewedWindows = sourceCase.shapeFeatures.full;
  if (reviewedWindows.cropSha256 !== comparison.value.source.cropSha256 || reviewedWindows.width !== comparison.value.source.dimensions.width || reviewedWindows.height !== comparison.value.source.dimensions.height) throw Error('Reviewed source windows do not bind the comparison crop');
  const candidate = buildBuildingGableCandidate(baseline, comparison.value, { sourceWindowEvidence: reviewedWindows });
  const contextOwners = await nearbyReleaseOwners(manifest.value, baseline);
  if (contextOwners.length < 2) throw Error('Insufficient active-release context around case 24');
  const packet = {
    version: 1,
    kind: 'case-24-approximate-gable-city-preview',
    generatedAt: new Date().toISOString(),
    target: { caseId: 'case-24', buildingId: baseline.id, address: 'Da Costakade 113', baseline, candidate: candidate.owner },
    contextOwners,
    provenance: {
      ...candidate.provenance,
      inputs: {
        casesJson: { path: 'public/data/facade-repair-preview/cases.json', sha256: cases.sha256 },
        comparison: { path: 'review-data/building-source-comparison/case-24.json', sha256: comparison.sha256 },
        activeReleasePointer: { path: 'public/data/city-expansion/current.json', sha256: pointer.sha256, releaseId: pointer.value.releaseId },
        activeReleaseManifest: { path: manifestPath, sha256: manifest.sha256 },
      },
      context: { ownerCount: contextOwners.length, radiusM: 52, targetExcludedBecauseGeometryRevisionDiffers: true },
      // Same planar side as the dated crop's camera, retained only to make the
      // review camera face the observed wall. This does not fit the camera.
      sourceCameraLocal: {
        x: comparison.value.source.pose.x - baseline.geometry.frame.originRD.x,
        y: comparison.value.source.pose.z - comparison.value.source.localToNAPOffsetM,
        z: baseline.geometry.frame.originRD.y - comparison.value.source.pose.y,
      },
      streetContextFraming: (() => {
        const sourceEyeLocal = {
          x: comparison.value.source.pose.x - baseline.geometry.frame.originRD.x,
          y: comparison.value.source.pose.z - comparison.value.source.localToNAPOffsetM,
          z: baseline.geometry.frame.originRD.y - comparison.value.source.pose.y,
        };
        const plane = comparison.value.source.samplingPlane;
        const frontWallTargetLocal = {
          x: (plane.start.x + plane.end.x) / 2 - baseline.geometry.frame.originRD.x,
          y: 7.5,
          z: baseline.geometry.frame.originRD.y - (plane.start.y + plane.end.y) / 2,
        };
        const outwardX = sourceEyeLocal.x - frontWallTargetLocal.x, outwardZ = sourceEyeLocal.z - frontWallTargetLocal.z;
        const inferredHorizontalDistanceM = 20;
        const length = Math.hypot(outwardX, outwardZ);
        if (!(length > 0)) throw Error('Case 24 source eye does not establish a front-wall inspection side');
        return {
        kind: 'normal-perspective-wide-street-eye-context',
        sourceEyeEvidence: 'stored source pose establishes the facade side and local y only; local vertical datum remains unverified',
        sourceEyeLocal,
        frontWallTargetLocal,
        inferredInspectionEyeLocal: { x: frontWallTargetLocal.x + outwardX / length * inferredHorizontalDistanceM, y: sourceEyeLocal.y, z: frontWallTargetLocal.z + outwardZ / length * inferredHorizontalDistanceM },
        inferredHorizontalDistanceM,
        positionStatus: 'inferred source-side inspection position, not the recorded photo camera; walking-ground validity is unverified',
        assumedVerticalFovDeg: 54,
        fovStatus: 'assumed for a wide normal-perspective context framing; not inferred or registered from the portrait crop',
        targetY: frontWallTargetLocal.y,
        targetStatus: 'stable observed-front-wall midpoint target; identical for baseline and candidate',
        };
      })(),
      source: {
        publicCropUrl: comparison.value.source.publicCropUrl,
        cropSha256: comparison.value.source.cropSha256,
        dimensions: comparison.value.source.dimensions,
        captureDate: comparison.value.source.captureDate,
        sharedReviewViewport: { width: comparison.value.source.dimensions.width, height: comparison.value.source.dimensions.height, sourceOpacityOptions: [0, 50, 100] },
        registration: comparison.value.registration,
        samplingPlaneLocal: {
          start: { x: comparison.value.source.samplingPlane.start.x - baseline.geometry.frame.originRD.x, y: comparison.value.source.samplingPlane.baseZ - comparison.value.source.localToNAPOffsetM, z: baseline.geometry.frame.originRD.y - comparison.value.source.samplingPlane.start.y },
          end: { x: comparison.value.source.samplingPlane.end.x - baseline.geometry.frame.originRD.x, y: comparison.value.source.samplingPlane.baseZ - comparison.value.source.localToNAPOffsetM, z: baseline.geometry.frame.originRD.y - comparison.value.source.samplingPlane.end.y },
          topY: comparison.value.source.samplingPlane.topZ - comparison.value.source.localToNAPOffsetM,
        },
      },
      releaseActivation: 'none',
      explicitAssumptions: [
        'The source-pixel outline is projected to the selected LoD2.2 front wall plane.',
        `The new front roof cap extends ${candidate.provenance.assumedCapDepthM} m inward from that plane.`,
        'At that assumed depth, the front facets join a clipped boundary of the retained LoD2.2 roof. This topology-derived closure is preview-only and is not source registered.',
      ],
    },
  };
  const text = JSON.stringify(packet, null, 2) + '\n';
  const reviewPath = path.join(ROOT, 'review-data/case24-gable-city-preview/packet.json');
  const publicPath = path.join(ROOT, 'public/canal-drive/data/case24-gable-city-preview.json');
  await fs.mkdir(path.dirname(reviewPath), { recursive: true });
  await fs.mkdir(path.dirname(publicPath), { recursive: true });
  await fs.writeFile(reviewPath, text); await fs.writeFile(publicPath, text);
  return { reviewPath, publicPath, candidateGeometryRevision: candidate.owner.geometryRevision, contextOwners: contextOwners.length, activated: false };
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  buildCase24GableCityPreview().then(value => console.log(JSON.stringify(value))).catch(error => { console.error(error); process.exitCode = 1; });
}
