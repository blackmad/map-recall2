import assert from 'node:assert/strict';
import type { FacadeWallPlane } from '../building/facadePointCloud.ts';
import {
  classifyWallRaster,
  projectToWall,
  rasteriseWall,
  simplifyPolyline,
  wallMetricFrame,
  wallSilhouette,
  type CloudPoint,
} from './pointCloudGeometry.ts';

let checks = 0;
const check = (condition: boolean, label: string) => {
  checks += 1;
  assert.ok(condition, label);
};

type Wall = Pick<FacadeWallPlane, 'vertices' | 'normal'>;
const wall: Wall = { vertices: [[0, 0, 0], [0, 10, 0], [0, 10, 8], [0, 0, 8]], normal: [1, 0, 0] };

// 1. The metric frame is horizontal along the wall, vertical in NAP, outward on the normal.
const frame = wallMetricFrame(wall);
check(frame !== null, 'wall frame exists');
assert.deepEqual(frame!.u.map((value) => Math.round(value)), [0, 1, 0]);
assert.deepEqual(frame!.v.map((value) => Math.round(value)), [0, 0, 1]);
assert.deepEqual(frame!.n.map((value) => Math.round(value)), [1, 0, 0]);
check(Math.abs(frame!.minAlong + 5) < 1e-9 && Math.abs(frame!.maxAlong - 5) < 1e-9, 'along bounds');
check(Math.abs(frame!.minUp + 4) < 1e-9 && Math.abs(frame!.maxUp - 4) < 1e-9, 'up bounds');

// 2. A roof (vertical normal) is rejected rather than rasterised as a wall.
check(wallMetricFrame({ vertices: [[0, 0, 0], [1, 0, 0], [1, 1, 1]], normal: [0, 0, 1] } as Wall) === null, 'roof rejected');

// 3. Projection recovers along/up/depth in metres.
const projected = projectToWall(frame!, { x: 0.2, y: 7, z: 5 });
check(Math.abs(projected.along - 2) < 1e-9 && Math.abs(projected.up - 1) < 1e-9 && Math.abs(projected.depth - 0.2) < 1e-9, 'projection');

// Synthetic façade: dense wall face, a recessed window, a protruding cornice, a gable.
// Sampling is denser than the 0.1 m cell so each cell holds several returns, as an
// MLS wall does at 1,000–2,500 pts/m².
const points: CloudPoint[] = [];
const inWindow = (y: number, z: number) => y >= 3 && y <= 5 && z >= 2 && z <= 5;
const inCornice = (z: number) => z >= 7.6;
for (let y = 0.025; y < 10; y += 0.05) {
  for (let z = 0.025; z < 8; z += 0.05) {
    if (inWindow(y, z) || inCornice(z)) continue;
    points.push({ x: 0, y, z, red: 154, green: 82, blue: 55 });
  }
}
for (let y = 3; y <= 5; y += 0.05) {
  for (let z = 2; z <= 5; z += 0.05) points.push({ x: -0.2, y, z, red: 90, green: 110, blue: 130 });
}
for (let y = 0.025; y < 10; y += 0.05) {
  for (let z = 7.6; z < 8; z += 0.05) points.push({ x: 0.15, y, z, red: 220, green: 220, blue: 210 });
}
for (let y = 4; y <= 6; y += 0.05) {
  for (let z = 8; z <= 11; z += 0.05) points.push({ x: 0, y, z, red: 154, green: 82, blue: 55 });
}

const raster = rasteriseWall(points, wall, { cellSize: 0.1 });
check(raster !== null, 'raster built');
check(Math.abs(raster!.planeOffset) < 0.02, `modal plane offset near zero, got ${raster!.planeOffset}`);
check(raster!.pointCount > 30_000, `slab keeps the wall returns, got ${raster!.pointCount}`);
check(raster!.rows > 100, 'raster rows include the upward gable search');

const classified = classifyWallRaster(raster!, { minimumPointsPerCell: 3 });
check(classified.wall.length > 0, 'plane cells classified');
check(classified.recessed.length > 0, 'window reveal classified as recessed');
check(classified.protruding.length > 0, 'cornice classified as protruding');
check(classified.coverage > 0.8, `wall face coverage, got ${classified.coverage.toFixed(2)}`);

const silhouette = wallSilhouette(raster!, { minimumPointsPerCell: 2, tolerance: 0.05 });
check(Math.abs(silhouette.riseAboveWallTop - 3) < 0.35, `gable rises ~3 m above the declared top, got ${silhouette.riseAboveWallTop.toFixed(2)}`);
check(silhouette.simplified.length >= 2, 'simplified silhouette has vertices');

// 4. The recessed window sits in the expected (along, up) band.
const recessedAlong = classified.recessed.map((cell) => cell.column * raster!.cellSize + frame!.minAlong);
check(Math.min(...recessedAlong) > -2.5 && Math.max(...recessedAlong) < 0.5, 'window reveal lands at y 3..5');

// 5. Douglas–Peucker collapses dense collinear runs but keeps a real step.
const step: Array<readonly [number, number]> = [];
for (let i = 0; i <= 20; i += 1) step.push([i * 0.05, 0]);
for (let i = 1; i <= 20; i += 1) step.push([1 + i * 0.05, 1]);
const simplified = simplifyPolyline(step, 0.05);
check(simplified.length === 4, `step simplifies to 4 corners, got ${simplified.length}`);
check(Math.abs(simplified[1][0] - 1) < 0.06 && Math.abs(simplified[1][1]) < 1e-9, 'lower step corner located');
check(Math.abs(simplified[2][1] - 1) < 1e-9, 'upper step corner located');
check(simplifyPolyline([[0, 0], [1, 0], [2, 0]], 0.05).length === 2, 'collinear points collapse');

// 6. An isolated tall spike (a wire, a bird, a neighbour) is not a roofline.
const flat: CloudPoint[] = [];
for (let y = 0.025; y < 10; y += 0.05) for (let z = 0.025; z < 8; z += 0.05) flat.push({ x: 0, y, z });
for (let z = 8; z <= 12; z += 0.05) flat.push({ x: 0, y: 5, z });
const flatRaster = rasteriseWall(flat, wall, { cellSize: 0.1 });
check(flatRaster !== null, 'flat raster built');
const flatSilhouette = wallSilhouette(flatRaster!, { minimumPointsPerCell: 2, tolerance: 0.05, minimumRun: 3, smoothWindow: 9 });
check(flatSilhouette.riseAboveWallTop < 0.5, `spike rejected by smoothing, got ${flatSilhouette.riseAboveWallTop.toFixed(2)}`);
check(flatSilhouette.rawProfile.some((point) => point[1] > 7), 'the raw envelope still records the spike');

process.stdout.write(`Point-cloud geometry checks passed (${checks} assertions).\n`);
