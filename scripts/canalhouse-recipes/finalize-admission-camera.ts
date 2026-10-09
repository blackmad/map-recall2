import fs from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { rdToLngLat } from '../../src/canalRecall/facade/rdNew.ts';

type RecordData = Record<string, any>;
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

/** Add cached camera geometry without promoting source or metric acceptance. Returns a copy. */
export function finalizeAdmissionCamera<T extends RecordData>(admission: T, manifest: RecordData): T {
  const result = structuredClone(admission);
  for (const house of result.houses) {
    const sources = house.sources;
    const tier = sources.lowerReferenceTier ?? 'ground';
    if (!['full', 'ground'].includes(tier)) throw new Error(`Unsupported lowerReferenceTier: ${tier}`);
    const match = (selectedTier: string, camera: RecordData) => {
      if (!camera?.pano_id) throw new Error(`Missing ${selectedTier} recorded panorama ID`);
      const matches = (manifest.records ?? []).filter((record: RecordData) =>
        (!record.buildingId || record.buildingId === house.pandId) &&
        record.images?.[selectedTier]?.panoramaId === camera.pano_id);
      if (matches.length !== 1) throw new Error(`Expected one ${selectedTier} camera matching ${camera.pano_id}; found ${matches.length}`);
      const image = matches[0].images[selectedTier];
      if (!image.pose || Array.isArray(image.pose) || !finite(image.pose.x) || !finite(image.pose.y) || !finite(image.pose.z)) {
        throw new Error(`Invalid RD pose for ${selectedTier} camera`);
      }
      const coordinates = rdToLngLat({ x: image.pose.x, y: image.pose.y });
      if (!coordinates.every(finite) || Math.abs(coordinates[0]) > 180 || Math.abs(coordinates[1]) > 90) {
        throw new Error(`Invalid WGS84 coordinates for ${selectedTier} camera`);
      }
      for (const key of ['headingDeg', 'pitchDeg', 'fovDeg']) {
        if (!finite(image.projection?.[key])) throw new Error(`Invalid ${selectedTier} projection ${key}`);
      }
      if (!(image.projection.fovDeg > 0 && image.projection.fovDeg < 180)) throw new Error('Invalid perspective field of view');
      return {
        camera: {
          ...camera, geometry: { ...camera.geometry, type: 'Point', coordinates },
          poseFromCache: structuredClone(image.pose),
          ...(image.datum !== undefined ? { datum: image.datum } : {}),
          ...(image.heightInferred !== undefined ? { heightInferred: image.heightInferred } : {}),
          metricEligible: false,
        },
        projection: structuredClone(image.projection),
      };
    };
    const full = match('full', sources.projection?.camera);
    const lower = match(tier, sources.nearCamera);
    sources.projection = { ...sources.projection, ...full.projection, camera: full.camera };
    sources.nearCamera = lower.camera;
    sources.nearProjection = { ...sources.nearProjection, ...lower.projection };
  }
  return result;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const option = (name: string) => args[args.indexOf(name) + 1];
  const admissionPath = args.includes('--admission') ? option('--admission') : undefined;
  const manifestPath = args.includes('--manifest') ? option('--manifest') : undefined;
  if (!admissionPath || !manifestPath) throw new Error('Use --admission <json> --manifest <camera-manifest.json> [--stdout]');
  const admission = JSON.parse(await fs.readFile(admissionPath, 'utf8'));
  const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
  const output = JSON.stringify(finalizeAdmissionCamera(admission, manifest), null, 2) + '\n';
  if (args.includes('--stdout')) process.stdout.write(output);
  else {
    await fs.writeFile(admissionPath, output);
    console.log(JSON.stringify({ admission: admissionPath, houses: admission.houses.length, status: 'camera-finalized;not-metric-acceptance' }));
  }
}
