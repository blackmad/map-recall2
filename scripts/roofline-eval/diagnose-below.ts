/**
 * Diagnose the worst `below` gold elevations: does the point cloud actually
 * see open space above the scan profile (3DBAG over-extrudes the wall), does
 * it just fail to see the top of the facade (occlusion/cornice shadow), or
 * is the matched 3DBAG wall segment simply the wrong one?
 *
 * Re-rasterises the cloud exactly as R1's `build-gold.ts` does (so the raster
 * is the same one the gold profile came from), draws the raw profile, the
 * cleaned profile, and 3DBAG's facade-top S(along) on top of it, and counts
 * how many raster cells with actual returns fall in the gap band between the
 * scan profile and S — the direct evidence for which explanation is right:
 * an empty band (no returns at all) means 3DBAG over-extrudes; a band full of
 * returns means either occlusion hid the true top from the profile, or the
 * matched wall is the wrong segment.
 *
 * Usage: npx tsx scripts/roofline-eval/diagnose-below.ts
 */
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { measureTile, isWellScanned, type WallMeasurement } from '../pointcloud/measure-tile.ts';
import { createPointSelector } from '../pointcloud/load-laz-tile.ts';
import { renderFacadeImage } from '../pointcloud/facade-image.ts';
import { MINIMUM_POINTS_PER_CELL } from '../pointcloud/measure-tile.ts';
import { encodePng } from '../pointcloud/png.ts';
import { buildFootprintRings, elevationSurfaceIds } from '../../src/canalRecall/facade/footprintRings.ts';
import { buildElevations } from '../../src/canalRecall/facade/elevations.ts';
import {
  canonicaliseProfile,
  cleanProfile,
  eaveHeight,
  rasteriseElevation,
  toRasterPoint,
  SAMPLE_M,
  type ElevationPlane,
  type CanonicalProfilePoint,
} from '../../src/canalRecall/facade/elevationRoofline.ts';
import { projectToWall } from '../../src/canalRecall/facade/pointCloudGeometry.ts';
import { extractFacadeWallPlanes, extractRoofPlanes } from '../../src/canalRecall/building/facadePointCloud.ts';
import { computeSection, deriveInwardNormal, FACADE_TOP_DEPTH_M, type BuildingPartSurface } from '../../src/canalRecall/facade/roofReconcile.ts';

const ROOFLINE_CACHE = process.env.ROOFLINE_CACHE || '/Users/blackmad/Code/map-recall2/.worktrees/amsterdam-facade-rebuild/.cache';
const POINTCLOUD_DIR = path.join(ROOFLINE_CACHE, 'pointcloud');
const OUT_DIR = path.resolve('review-data/roofline-gold/v1/g1/diagnose-below');
const UPWARD_SEARCH = 8;
const PIXELS_PER_METRE = 40;

const TILES = [
  { id: 'museumkwartier', file: 'filtered_2397_9705.laz' },
  { id: 'willemspark', file: 'filtered_2386_9702.laz' },
];

// The three worst `below` cases the coordinator asked about.
const TARGET_IDS = new Set([
  'museumkwartier:bag:0363100012153094:e:0klolps',
  'museumkwartier:bag:0363100012155815:e:03hwiog',
  'willemspark:bag:0363100012164118:e:1jc1owh',
]);

// --- load the 3DBAG cache, same as reconcile-gold.ts -------------------------
type CityJsonResponse = { metadata?: { transform?: { scale?: number[]; translate?: number[] } }; feature?: unknown };
const cacheFiles = (await readdir(POINTCLOUD_DIR)).filter((f) => /^3dbag-.*\.json$/.test(f));
const responsesByBuildingId = new Map<string, CityJsonResponse>();
for (const file of cacheFiles) {
  const parsed = JSON.parse(await readFile(path.join(POINTCLOUD_DIR, file), 'utf8')) as { features?: Array<CityJsonResponse & { response?: CityJsonResponse }> };
  for (const entry of parsed.features ?? []) {
    const response = entry.response ?? entry;
    const walls = extractFacadeWallPlanes(response as any);
    const id = walls[0]?.buildingId ?? null;
    if (id) responsesByBuildingId.set(id, response);
  }
}

await mkdir(OUT_DIR, { recursive: true });

type Report = {
  id: string;
  widthM: number;
  gapColumns: number;
  gapCellsExpected: number;
  gapCellsOccupied: number;
  occupiedFraction: number;
  maxGapM: number;
  medianGapM: number;
  imagePath: string;
};
const reports: Report[] = [];

for (const tile of TILES) {
  const tilePath = path.join(POINTCLOUD_DIR, tile.file);
  const measured = await measureTile(tilePath);
  const scanned = measured.measurements.filter(isWellScanned);
  const scannedBySurfaceId = new Map<string, WallMeasurement>(scanned.map((m) => [m.surfaceId, m]));
  const rings = buildFootprintRings(measured.walls);
  const selectPoints = createPointSelector(measured.tile, 5);

  for (const ring of rings) {
    if (!ring.closed) continue;
    const pandElevations = buildElevations(ring.ring, { pandId: `${tile.id}:${ring.buildingId}`, collinearToleranceDeg: 0.75 });
    for (const elevation of pandElevations) {
      const id = elevation.elevationId;
      if (!TARGET_IDS.has(id)) continue;

      const surfaceIds = elevationSurfaceIds(elevation.sourceVertexRange.vertexIndices, ring);
      const constituents = surfaceIds.map((sid) => scannedBySurfaceId.get(sid)).filter((m): m is WallMeasurement => m != null);
      if (!constituents.length) throw new Error(`${id}: no well-scanned constituent — can't reproduce the gold elevation`);

      const baseZ = Math.min(...constituents.map((m) => m.raster.frame.origin[2] + m.raster.frame.minUp));
      const topZ = Math.max(...constituents.map((m) => m.wallTopNAP));
      const plane: ElevationPlane = { start: elevation.start, end: elevation.end, baseZ, topZ };

      const margin = 0.6;
      const points = selectPoints({
        minX: Math.min(plane.start.x, plane.end.x) - margin,
        maxX: Math.max(plane.start.x, plane.end.x) + margin,
        minY: Math.min(plane.start.y, plane.end.y) - margin,
        maxY: Math.max(plane.start.y, plane.end.y) + margin,
        minZ: baseZ - margin,
        maxZ: topZ + UPWARD_SEARCH,
      });
      const rasterised = rasteriseElevation(points, plane, { cellSize: 0.05, upwardSearch: UPWARD_SEARCH });
      if (!rasterised) throw new Error(`${id}: no cloud returns — can't reproduce the gold elevation`);

      const rawProfile = canonicaliseProfile(rasterised.silhouette.profile, rasterised.raster.frame, plane, SAMPLE_M);
      const rawHeights = rawProfile.points.filter((p) => p.up != null).map((p) => p.up as number);
      const eaveEstimate = eaveHeight(rawHeights);
      const cleanedPoints: CanonicalProfilePoint[] = cleanProfile(rawProfile.points, SAMPLE_M, eaveEstimate);

      // --- 3DBAG facade-top S(along), same code path as G1 -----------------
      const buildingId = ring.buildingId;
      const response = responsesByBuildingId.get(buildingId);
      if (!response) throw new Error(`${id}: no cached 3DBAG response for ${buildingId}`);
      const walls = extractFacadeWallPlanes(response as any).filter((w) => w.buildingId === buildingId);
      const roofs = extractRoofPlanes(response as any).filter((r) => r.buildingId === buildingId);
      const bagSurfaces: BuildingPartSurface[] = [
        ...walls.map((w) => ({ id: w.surfaceId, vertices: w.vertices })),
        ...roofs.map((r) => ({ id: r.surfaceId, vertices: r.vertices })),
      ];
      const alongs = cleanedPoints.map((p) => p.along);
      const tangent = (() => {
        const dx = plane.end.x - plane.start.x;
        const dy = plane.end.y - plane.start.y;
        const len = Math.hypot(dx, dy) || 1;
        return { x: dx / len, y: dy / len };
      })();
      const inward = deriveInwardNormal(bagSurfaces, plane, tangent);
      const sFacadeTop = computeSection(bagSurfaces, plane, tangent, inward, alongs, SAMPLE_M, FACADE_TOP_DEPTH_M);
      const sPoints: CanonicalProfilePoint[] = alongs.map((along, i) => ({ along, up: sFacadeTop[i] }));

      // --- render the overlay image -----------------------------------------
      const fakeMeasurement = { raster: rasterised.raster } as unknown as WallMeasurement;
      const image = renderFacadeImage(fakeMeasurement, { pixelsPerMetre: PIXELS_PER_METRE, upwardSearch: UPWARD_SEARCH });
      const top = rasterised.raster.frame.maxUp + UPWARD_SEARCH;
      const drawPixel = (x: number, y: number, colour: readonly [number, number, number]) => {
        if (x < 0 || y < 0 || x >= image.width || y >= image.height) return;
        const offset = (y * image.width + x) * 3;
        image.rgb[offset] = colour[0];
        image.rgb[offset + 1] = colour[1];
        image.rgb[offset + 2] = colour[2];
      };
      const toPixel = (along: number, up: number) => {
        const raster = toRasterPoint(rasterised.raster.frame, plane, along, up);
        return {
          x: Math.round((raster.along - rasterised.raster.frame.minAlong) * PIXELS_PER_METRE),
          y: Math.round((top - raster.up) * PIXELS_PER_METRE),
        };
      };
      const drawLine = (profilePoints: Array<{ along: number; up: number | null }>, colour: readonly [number, number, number], thick: boolean) => {
        let previous: { x: number; y: number } | null = null;
        for (const point of profilePoints) {
          if (point.up == null) { previous = null; continue; }
          const pixel = toPixel(point.along, point.up);
          if (previous) {
            const steps = Math.max(1, Math.max(Math.abs(pixel.x - previous.x), Math.abs(pixel.y - previous.y)));
            for (let step = 0; step <= steps; step += 1) {
              const x = Math.round(previous.x + (pixel.x - previous.x) * (step / steps));
              const y = Math.round(previous.y + (pixel.y - previous.y) * (step / steps));
              drawPixel(x, y, colour);
              if (thick) drawPixel(x, y - 1, colour);
            }
          }
          previous = pixel;
        }
      };
      drawLine(rawProfile.points, [150, 158, 168], false); // grey: raw
      drawLine(cleanedPoints, [255, 209, 102], true); // yellow: cleaned scan profile
      drawLine(sPoints, [255, 64, 129], true); // magenta: 3DBAG facade-top S

      const fileName = `${id.replace(/[^A-Za-z0-9._-]+/g, '_')}.png`;
      const imagePath = path.join(OUT_DIR, fileName);
      await writeFile(imagePath, encodePng(image.width, image.height, image.rgb));

      // --- count raster cells with returns in the gap band -------------------
      // For each raster cell with at least one return, find its canonical
      // (along, up) and check whether it falls inside [profile, S] for that
      // column — i.e. is there anything the scan actually saw in the gap.
      const dx = plane.end.x - plane.start.x;
      const dy = plane.end.y - plane.start.y;
      const widthM = Math.hypot(dx, dy) || 1;
      const dirX = dx / widthM;
      const dirY = dy / widthM;
      const frame = rasterised.raster.frame;
      const canonicalAlongOfColumn = (column: number): number => {
        const rasterAlong = (column + 0.5) * rasterised.raster.cellSize + frame.minAlong;
        const worldX = frame.origin[0] + frame.u[0] * rasterAlong;
        const worldY = frame.origin[1] + frame.u[1] * rasterAlong;
        return (worldX - plane.start.x) * dirX + (worldY - plane.start.y) * dirY;
      };
      const profileAt = new Map<number, number | null>(cleanedPoints.map((p) => [p.along, p.up]));
      const sAt = new Map<number, number | null>(sPoints.map((p) => [p.along, p.up]));
      const nearestAlong = (along: number) => Math.round(along / SAMPLE_M) * SAMPLE_M;

      let gapCellsExpected = 0;
      let gapCellsOccupied = 0;
      let gapColumns = 0;
      const gapsM: number[] = [];
      for (const along of alongs) {
        const p = profileAt.get(along);
        const s = sAt.get(along);
        if (p == null || s == null || s <= p) continue;
        gapColumns += 1;
        gapsM.push(s - p);
        gapCellsExpected += Math.max(1, Math.round((s - p) / rasterised.raster.cellSize));
      }
      for (const cell of rasterised.raster.cells) {
        // Same threshold `renderFacadeImage` uses to decide a cell is drawn
        // vs. left as background — a handful of stray returns (dust, birds,
        // a distant reflection) shouldn't count as "the scan saw a wall
        // here" any more than they're visible in the image.
        if (cell.count < MINIMUM_POINTS_PER_CELL) continue;
        const canonicalAlong = canonicalAlongOfColumn(cell.column);
        const bucket = nearestAlong(canonicalAlong);
        const p = profileAt.get(bucket);
        const s = sAt.get(bucket);
        if (p == null || s == null || s <= p) continue;
        const rowUp = frame.origin[2] + rasterised.raster.bottomUp + (cell.row + 0.5) * rasterised.raster.cellSize;
        if (rowUp > p + 0.02 && rowUp < s - 0.02) gapCellsOccupied += 1;
      }
      gapsM.sort((a, b) => a - b);
      const medianGapM = gapsM.length ? gapsM[Math.floor(gapsM.length / 2)] : 0;
      const maxGapM = gapsM.length ? gapsM[gapsM.length - 1] : 0;
      const occupiedFraction = gapCellsExpected ? gapCellsOccupied / gapCellsExpected : 0;

      reports.push({ id, widthM: rawProfile.widthM, gapColumns, gapCellsExpected, gapCellsOccupied, occupiedFraction, maxGapM, medianGapM, imagePath });
    }
  }
}

process.stdout.write(`\ndiagnose-below: gap-band occupancy for the 3 worst \`below\` gold elevations\n`);
process.stdout.write(`(gap band = between the cleaned scan profile and 3DBAG facade-top S, only where S > profile)\n\n`);
for (const r of reports) {
  process.stdout.write(
    `${r.id}\n` +
      `  width ${r.widthM.toFixed(2)} m, gap present on ${r.gapColumns} of ${Math.round(r.widthM / SAMPLE_M) + 1} columns\n` +
      `  gap size: median ${r.medianGapM.toFixed(2)} m, max ${r.maxGapM.toFixed(2)} m\n` +
      `  raster cells expected in the gap band: ${r.gapCellsExpected}, actually occupied (>=1 return): ${r.gapCellsOccupied} (${(r.occupiedFraction * 100).toFixed(1)}%)\n` +
      `  image: ${r.imagePath}\n\n`,
  );
}
if (reports.length !== TARGET_IDS.size) {
  process.stdout.write(`WARNING: found ${reports.length} of ${TARGET_IDS.size} target elevations — some IDs did not reproduce.\n`);
}
