import assert from 'node:assert/strict';
import type { FacadeWallPlane } from '../building/facadePointCloud.ts';
import { buildElevations } from './elevations.ts';
import { buildFootprintRings, elevationSurfaceIds } from './footprintRings.ts';
import { canonicaliseProfile, rasteriseElevation, type ElevationPlane } from './elevationRoofline.ts';
import type { CloudPoint } from './pointCloudGeometry.ts';

let checks = 0;
const check = (condition: boolean, label: string) => {
  checks += 1;
  assert.ok(condition, label);
};

const quad = (
  buildingId: string,
  surfaceId: string,
  start: readonly [number, number],
  end: readonly [number, number],
  normal: readonly [number, number, number],
  baseZ = 0,
  topZ = 6,
): FacadeWallPlane => ({
  buildingId,
  surfaceId,
  exterior: true,
  normal,
  vertices: [
    [start[0], start[1], baseZ],
    [end[0], end[1], baseZ],
    [end[0], end[1], topZ],
    [start[0], start[1], topZ],
  ],
  areaSquareMetres: Math.hypot(end[0] - start[0], end[1] - start[1]) * (topZ - baseZ),
});

// A simple 5-sided rectangular footprint: two collinear front segments (A, B)
// that should merge into one elevation, plus three other walls that should not.
const walls: FacadeWallPlane[] = [
  quad('pand-1', 'wall-A', [0, 0], [4, 0], [0, -1, 0]),
  quad('pand-1', 'wall-B', [4, 0], [8, 0], [0, -1, 0]),
  quad('pand-1', 'wall-C', [8, 0], [8, 5], [1, 0, 0]),
  quad('pand-1', 'wall-D', [8, 5], [0, 5], [0, 1, 0]),
  quad('pand-1', 'wall-E', [0, 5], [0, 0], [-1, 0, 0]),
];

// 1. Footprint reconstruction: the five walls close into one ring, in order.
const rings = buildFootprintRings(walls);
check(rings.length === 1, `one ring reconstructed, got ${rings.length}`);
const ring = rings[0];
check(ring.closed, 'the ring closed into a single cycle');
check(ring.ring.length === 5, `ring has 5 vertices, got ${ring.ring.length}`);
check(ring.edgeSurfaceIds.length === 5, 'five edges recorded');

// 2. Elevation merge: A and B are collinear and adjacent, so they merge into
// one elevation spanning the full 8 m front; C, D, E stay separate.
const elevations = buildElevations(ring.ring, { pandId: 'pand-1' });
check(elevations.length === 4, `4 elevations from 5 walls (A+B merged), got ${elevations.length}`);
const front = elevations.find((elevation) => Math.abs(elevation.lengthM - 8) < 1e-6);
check(front !== undefined, 'the merged 8 m front elevation exists');
const frontSurfaceIds = elevationSurfaceIds(front!.sourceVertexRange.vertexIndices, ring);
check(
  frontSurfaceIds.length === 2 && frontSurfaceIds.includes('wall-A') && frontSurfaceIds.includes('wall-B'),
  `merged elevation keeps both source walls, got ${JSON.stringify(frontSurfaceIds)}`,
);
const others = elevations.filter((elevation) => elevation !== front);
check(others.every((elevation) => elevationSurfaceIds(elevation.sourceVertexRange.vertexIndices, ring).length === 1), 'unmerged elevations keep exactly one wall each');

// 3. Profile frame: a step-gable point cloud rasterised against the merged
// front's own plane recovers the step, in canonical (along-from-start, absolute-NAP) form.
const plane: ElevationPlane = { start: { x: 0, y: 0 }, end: { x: 8, y: 0 }, baseZ: 0, topZ: 6 };
const points: CloudPoint[] = [];
const inStep = (x: number) => x >= 3 && x <= 5;
for (let x = 0.05; x < 8; x += 0.05) {
  for (let z = 0.05; z < 6; z += 0.05) points.push({ x, y: -0.02, z });
  const topZ = inStep(x) ? 8 : 6;
  for (let z = 6; z <= topZ; z += 0.05) points.push({ x, y: -0.02, z });
}

const rasterised = rasteriseElevation(points, plane, { cellSize: 0.1 });
check(rasterised !== null, 'elevation raster built');
const profile = canonicaliseProfile(rasterised!.silhouette.profile, rasterised!.raster.frame, plane, 0.1);
check(Math.abs(profile.widthM - 8) < 1e-6, `canonical width is the plane length, got ${profile.widthM}`);
check(profile.points[0].along === 0 && Math.abs(profile.points.at(-1)!.along - 8) < 0.11, 'along runs from plane.start (0) to plane.end (width)');
check(profile.coverage > 0.7, `coverage is high on a fully-sampled synthetic wall, got ${profile.coverage.toFixed(2)}`);

const nearStart = profile.points.find((point) => point.along >= 0.5 && point.along <= 1)?.up;
const nearCentre = profile.points.find((point) => point.along >= 3.8 && point.along <= 4.2)?.up;
const nearEnd = profile.points.find((point) => point.along >= 7 && point.along <= 7.5)?.up;
check(nearStart != null && Math.abs(nearStart - 6) < 0.3, `flank near start reads ~6 m absolute NAP, got ${nearStart}`);
check(nearEnd != null && Math.abs(nearEnd - 6) < 0.3, `flank near end reads ~6 m absolute NAP, got ${nearEnd}`);
check(nearCentre != null && nearCentre > 7.3, `step centre reads well above the flanks, got ${nearCentre}`);

process.stdout.write(`Elevation roofline checks passed (${checks} assertions).\n`);
