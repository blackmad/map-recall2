import assert from 'node:assert/strict';
import type { FacadeWallPlane } from '../building/facadePointCloud.ts';
import { rasteriseWall, wallSilhouette, type CloudPoint } from './pointCloudGeometry.ts';
import { clusterCells, compileFacade, groupIntoColumns, groupIntoRows, subtractRects } from './facadeMeshCompiler.ts';

let checks = 0;
const check = (condition: boolean, label: string) => {
  checks += 1;
  assert.ok(condition, label);
};

type Wall = Pick<FacadeWallPlane, 'vertices' | 'normal'>;
const wall: Wall = { vertices: [[0, 0, 0], [0, 10, 0], [0, 10, 8], [0, 0, 8]], normal: [1, 0, 0] };

const points: CloudPoint[] = [];
const inWindow = (y: number, z: number) => y >= 3 && y <= 5 && z >= 2 && z <= 5;
const inCornice = (z: number) => z >= 7.6;
for (let y = 0.025; y < 10; y += 0.05) {
  for (let z = 0.025; z < 8; z += 0.05) {
    if (inWindow(y, z) || inCornice(z)) continue;
    points.push({ x: 0, y, z });
  }
}
for (let y = 3; y <= 5; y += 0.05) for (let z = 2; z <= 5; z += 0.05) points.push({ x: -0.25, y, z });
for (let y = 0.025; y < 10; y += 0.05) for (let z = 7.6; z < 8; z += 0.05) points.push({ x: 0.15, y, z });
for (let y = 4; y <= 6; y += 0.05) for (let z = 8; z <= 11; z += 0.05) points.push({ x: 0, y, z });

const raster = rasteriseWall(points, wall, { cellSize: 0.1 });
check(raster !== null, 'raster built');
const silhouette = wallSilhouette(raster!, { minimumPointsPerCell: 2, tolerance: 0.05, minimumRun: 3, smoothWindow: 5 });
const mesh = compileFacade(raster!, silhouette, { minimumPointsPerCell: 3 });

check(mesh.width > 9.9 && mesh.width < 10.1, `mesh width is the wall width, got ${mesh.width.toFixed(2)}`);
check(Math.abs(mesh.height - 8) < 0.2, `mesh height is the wall height, got ${mesh.height.toFixed(2)}`);
check(mesh.openings.length === 1, `one opening found, got ${mesh.openings.length}`);
const opening = mesh.openings[0];
check(Math.abs(opening.width - 2) < 0.25, `opening width ~2 m, got ${opening.width.toFixed(2)}`);
check(Math.abs(opening.height - 3) < 0.25, `opening height ~3 m, got ${opening.height.toFixed(2)}`);
check(opening.along > -2.4 && opening.along < -1.6, `opening starts near y=3, got along ${opening.along.toFixed(2)}`);
check(mesh.protrusions.length === 1, `one protrusion found, got ${mesh.protrusions.length}`);
check(mesh.gable !== null, 'gable compiled');
check(mesh.gableRise > 2.5 && mesh.gableRise < 3.5, `gable rises ~3 m, got ${mesh.gableRise.toFixed(2)}`);
check((mesh.gable?.length ?? 0) >= 4, 'gable polygon closes with its base');
check(mesh.gable![0][1] === mesh.wallTop && mesh.gable![mesh.gable!.length - 1][1] === mesh.wallTop, 'gable base sits on the wall top');

// The wall panels are a hole-free tiling: area is the wall minus the openings.
const area = (rect: { width: number; height: number }) => rect.width * rect.height;
const panelArea = mesh.panels.reduce((sum, rect) => sum + area(rect), 0);
const openingArea = mesh.openings.reduce((sum, rect) => sum + area(rect), 0);
check(Math.abs(panelArea + openingArea - mesh.width * mesh.height) < 0.05, `panels + openings tile the wall, got ${panelArea.toFixed(2)}+${openingArea.toFixed(2)} vs ${(mesh.width * mesh.height).toFixed(2)}`);
check(mesh.panels.every((rect) => rect.width > 0 && rect.height > 0), 'no degenerate panels');

// Rectangle subtraction keeps the area and never overlaps a hole.
const base = { along: 0, up: 0, width: 10, height: 10, kind: 'wall' as const };
const hole = { along: 3, up: 2, width: 2, height: 3, kind: 'opening' as const };
const subtracted = subtractRects(base, [hole]);
check(subtracted.length === 4, `one hole splits into four panels, got ${subtracted.length}`);
check(Math.abs(subtracted.reduce((sum, rect) => sum + area(rect), 0) - (100 - 6)) < 1e-9, 'subtraction preserves area');
check(subtracted.every((rect) => rect.along >= 0 && rect.up >= 0 && rect.along + rect.width <= 10 && rect.up + rect.height <= 10), 'panels stay inside the wall');
const overlapping = subtractRects(base, [hole, { along: 4, up: 3, width: 3, height: 3, kind: 'opening' as const }]);
check(overlapping.every((rect) => rect.width > 0 && rect.height > 0), 'overlapping holes still tile cleanly');

// 2 x 3 opening grid groups into two storeys and three bays.
const grid = [] as Array<{ along: number; up: number; width: number; height: number; kind: 'opening' }>;
for (const up of [0, 4]) for (const along of [0, 3, 6]) grid.push({ along, up, width: 1, height: 1, kind: 'opening' });
check(groupIntoRows(grid).length === 2, `2 storeys, got ${groupIntoRows(grid).length}`);
check(groupIntoColumns(grid).length === 3, `3 bays, got ${groupIntoColumns(grid).length}`);
check(groupIntoRows(grid).every((row) => row.length === 3), 'each storey holds three bays');
check(mesh.storeyCount === 1 && mesh.bayCount === 1, 'the single-window wall is one storey and one bay');

// Two windows separated by a thin pier must not merge into one opening.
const twin: CloudPoint[] = [];
const inTwin = (y: number, z: number) => z >= 3 && z <= 6 && ((y >= 2 && y <= 3.6) || (y >= 4.0 && y <= 5.6));
for (let y = 0.025; y < 8; y += 0.05) {
  for (let z = 0.025; z < 9; z += 0.05) {
    if (inTwin(y, z)) continue;
    twin.push({ x: 0, y, z });
  }
}
for (let y = 2; y <= 3.6; y += 0.05) for (let z = 3; z <= 6; z += 0.05) twin.push({ x: -0.25, y, z });
for (let y = 4.0; y <= 5.6; y += 0.05) for (let z = 3; z <= 6; z += 0.05) twin.push({ x: -0.25, y, z });
const twinWall: Wall = { vertices: [[0, 0, 0], [0, 8, 0], [0, 8, 9], [0, 0, 9]], normal: [1, 0, 0] };
const twinRaster = rasteriseWall(twin, twinWall, { cellSize: 0.1 })!;
const twinMesh = compileFacade(twinRaster, wallSilhouette(twinRaster, { minimumPointsPerCell: 2, minimumRun: 3, smoothWindow: 5 }), { minimumPointsPerCell: 3 });
check(twinMesh.openings.length === 2, `a 0.4 m pier splits two windows, got ${twinMesh.openings.length}`);
check(twinMesh.openings.every((opening) => opening.width < 2.2), 'each split window keeps its own width');

// A flat-topped wall compiles no gable.
const flat = points.filter((point) => point.z <= 8);
const flatRaster = rasteriseWall(flat, wall, { cellSize: 0.1 })!;
const flatMesh = compileFacade(flatRaster, wallSilhouette(flatRaster, { minimumPointsPerCell: 2, minimumRun: 3, smoothWindow: 5 }), { minimumPointsPerCell: 3 });
check(flatMesh.gable === null, 'flat wall has no gable');

// 8-neighbour clustering joins a diagonal step into one opening.
const diagonal = clusterCells([
  { column: 0, row: 0, count: 5, meanDepth: -0.2, minDepth: -0.2, maxDepth: -0.2, height: 0, rgb: null },
  { column: 1, row: 1, count: 5, meanDepth: -0.2, minDepth: -0.2, maxDepth: -0.2, height: 0, rgb: null },
], { columns: 4 });
check(diagonal.length === 1, 'diagonal cells cluster together');
const separated = clusterCells([
  { column: 0, row: 0, count: 5, meanDepth: -0.2, minDepth: -0.2, maxDepth: -0.2, height: 0, rgb: null },
  { column: 3, row: 3, count: 5, meanDepth: -0.2, minDepth: -0.2, maxDepth: -0.2, height: 0, rgb: null },
], { columns: 4 });
check(separated.length === 2, 'distant cells stay separate');

process.stdout.write(`Façade mesh compiler checks passed (${checks} assertions).\n`);
