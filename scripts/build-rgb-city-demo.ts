/** Publish the review-only RGB DSM roof experiment as a compact interactive demo. */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import proj4 from 'proj4';
import type { RgbPoint, RoofPlane } from '../src/canalRecall/building/facadePointCloud.ts';

const arg = (name: string) => process.argv.find((value) => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const root = path.resolve(arg('root') || '.cache/rgb-city-demo');
const outputDirectory = path.resolve(arg('output') || 'public/data/rgb-city-demo');
const coveragePath = path.resolve(arg('coverage') || '.cache/3dbag-appearance/amsterdam-coverage.json');
proj4.defs('EPSG:28992', '+proj=sterea +lat_0=52.15616055555556 +lon_0=5.38763888888889 +k=0.9999079 +x_0=155000 +y_0=463000 +ellps=bessel +units=m +no_defs +towgs84=565.4171,50.3319,465.5524,-0.398957,0.343988,-1.8774,4.0725');

type Proposal = {
  buildingId: string; surfaceId: string; status: string; reason: string | null;
  orthophotoColour: string | null; crossSourceRgbDistance: number | null;
  pointCloudMeasurement: { status: string; hex?: string; sampleCount: number; coverage: number; dispersion?: number; planeOffsetMetres?: number };
  previewPoints?: RgbPoint[];
};
const surfaces = JSON.parse(await readFile(path.join(root, 'panorama/facade-wall-planes.json'), 'utf8')) as {
  buildings: Array<{ buildingId: string; roofs: RoofPlane[] }>;
};
const measurements = JSON.parse(await readFile(path.join(root, 'roof-point-cloud-colour-proposals.json'), 'utf8')) as {
  source: Record<string, unknown>; tileHashes: unknown[]; policy: Record<string, unknown>; proposals: Proposal[];
};
const coverage = await readFile(coveragePath, 'utf8').then((value) => JSON.parse(value) as { counts?: { buildings?: number } }).catch(() => ({ counts: { buildings: 42_534 } }));
const roofs = new Map(surfaces.buildings.flatMap((building) => building.roofs.map((roof) => [roof.surfaceId, roof] as const)));
const features = measurements.proposals.flatMap((proposal) => {
  const roof = roofs.get(proposal.surfaceId);
  if (!roof) return [];
  const coordinates = roof.vertices.map(([x, y]) => proj4('EPSG:28992', 'EPSG:4326', [x, y]) as [number, number]);
  if (coordinates.length < 3) return [];
  const closed = [...coordinates, coordinates[0]];
  const height = roof.vertices.reduce((sum, point) => sum + point[2], 0) / roof.vertices.length;
  return [{
    type: 'Feature',
    geometry: { type: 'Polygon', coordinates: [closed] },
    properties: {
      buildingId: proposal.buildingId, surfaceId: proposal.surfaceId,
      status: proposal.status, reason: proposal.reason,
      pointColour: proposal.pointCloudMeasurement.hex || null,
      orthophotoColour: proposal.orthophotoColour,
      rgbDistance: proposal.crossSourceRgbDistance,
      sampleCount: proposal.pointCloudMeasurement.sampleCount,
      coverage: Number(proposal.pointCloudMeasurement.coverage.toFixed(3)),
      dispersion: proposal.pointCloudMeasurement.dispersion == null ? null : Number(proposal.pointCloudMeasurement.dispersion.toFixed(2)),
      planeOffsetMetres: proposal.pointCloudMeasurement.planeOffsetMetres == null ? null : Number(proposal.pointCloudMeasurement.planeOffsetMetres.toFixed(2)),
      roofHeight: Number(height.toFixed(2)),
      reviewStatus: 'machine-proposal', acceptedForNow: false,
    },
  }];
});
const proposed = measurements.proposals.filter((proposal) => proposal.status === 'proposed');
const pointFeatures = measurements.proposals.flatMap((proposal) => (proposal.previewPoints || []).map((point) => {
  const [longitude, latitude] = proj4('EPSG:28992', 'EPSG:4326', [point.x, point.y]) as [number, number];
  return { type: 'Feature', geometry: { type: 'Point', coordinates: [longitude, latitude] }, properties: { surfaceId: proposal.surfaceId, buildingId: proposal.buildingId, height: Number(point.z.toFixed(2)), colour: `rgb(${point.red},${point.green},${point.blue})` } };
}));
const summary = {
  schemaVersion: 1, generatedAt: new Date().toISOString(),
  title: 'Amsterdam RGB point-cloud roof demo',
  candidateCityBuildings: coverage.counts?.buildings || null,
  sampledBuildings: surfaces.buildings.length,
  buildingsWithAgreedRgb: new Set(proposed.map((proposal) => proposal.buildingId)).size,
  semanticRoofPlanes: measurements.proposals.length,
  independentlyAgreedPlanes: proposed.length,
  rejectedPlanes: measurements.proposals.length - proposed.length,
  pointCloudTiles: measurements.tileHashes.length,
  source: measurements.source, policy: measurements.policy,
  caveat: 'RGB DSM observes roofs/top surfaces, not vertical façades. All highlighted planes remain machine proposals.',
};
await mkdir(outputDirectory, { recursive: true });
await writeFile(path.join(outputDirectory, 'roof-planes.geojson'), JSON.stringify({ type: 'FeatureCollection', features }));
await writeFile(path.join(outputDirectory, 'point-cloud-preview.geojson'), JSON.stringify({ type: 'FeatureCollection', features: pointFeatures }));
await writeFile(path.join(outputDirectory, 'summary.json'), `${JSON.stringify(summary, null, 2)}\n`);
process.stdout.write(`Built RGB demo: ${summary.independentlyAgreedPlanes}/${summary.semanticRoofPlanes} planes on ${summary.buildingsWithAgreedRgb}/${summary.sampledBuildings} buildings agree.\n`);
