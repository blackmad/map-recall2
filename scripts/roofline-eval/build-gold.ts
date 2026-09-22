/**
 * R1: gold roofline profiles, measured from the point cloud.
 *
 * Rebuilds wall measurements the way `measure-tile.ts` does (reused, not
 * forked), merges the well-scanned walls of each pand into elevations with
 * `buildElevations`, rasterises the cloud fresh against each elevation's own
 * plane, and writes the §3-frame profile plus an overlay PNG per elevation.
 *
 * Usage: npx tsx scripts/roofline-eval/build-gold.ts
 * Reads tiles from `$ROOFLINE_CACHE/pointcloud/*.laz` (default: the
 * amsterdam-facade-rebuild worktree's `.cache`).
 */
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { classifyRoofline, isWellScanned, measureTile, SHAPED_ROOFLINE_RANGE, type WallMeasurement } from '../pointcloud/measure-tile.ts';
import { createPointSelector } from '../pointcloud/load-laz-tile.ts';
import { renderFacadeImage } from '../pointcloud/facade-image.ts';
import { encodePng } from '../pointcloud/png.ts';
import { buildFootprintRings, elevationSurfaceIds, type FootprintRing } from '../../src/canalRecall/facade/footprintRings.ts';
import { buildElevations, type Elevation } from '../../src/canalRecall/facade/elevations.ts';
import {
  canonicaliseProfile,
  rasteriseElevation,
  toRasterPoint,
  SAMPLE_M,
  type ElevationPlane,
} from '../../src/canalRecall/facade/elevationRoofline.ts';

const ROOFLINE_CACHE = process.env.ROOFLINE_CACHE || '/Users/blackmad/Code/map-recall2/.worktrees/amsterdam-facade-rebuild/.cache';
const POINTCLOUD_DIR = path.join(ROOFLINE_CACHE, 'pointcloud');
const OUT_DIR = path.resolve('review-data/roofline-gold/v1');
const OVERLAY_DIR = path.join(OUT_DIR, 'overlays');
const UPWARD_SEARCH = 8;
const MIN_WIDTH_M = 2.5;
const MIN_COVERAGE = 0.7;

const TILES = [
  { id: 'museumkwartier', file: 'filtered_2397_9705.laz', label: 'Museumkwartier' },
  { id: 'willemspark', file: 'filtered_2386_9702.laz', label: 'Willemspark' },
];

const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};

/** Median of the outer 1/8 of non-null heights on each side, matching gable.ts's "eaves" convention. */
const eaveHeight = (heights: number[]): number => {
  if (!heights.length) return NaN;
  const span = Math.max(1, Math.floor(heights.length / 8));
  return median([...heights.slice(0, span), ...heights.slice(-span)]);
};

type ElevationRecord = {
  id: string;
  tile: string;
  buildingId: string;
  widthM: number;
  plane: { start: { x: number; y: number }; end: { x: number; y: number }; baseZ: number; topZ: number };
  surfaceIds: string[];
  profile: Array<{ along: number; up: number | null }>;
  shape: string;
  peakUp: number;
  eaveUp: number;
  coverage: number;
  spotCheck: 'pending';
};

const dropped: Array<{ tile: string; buildingId: string; elevationId?: string; reason: string }> = [];
const elevations: ElevationRecord[] = [];
const perTileCounts: Array<{ id: string; wallsScanned: number; elevationsMerged: number; elevationsKept: number; shaped: number }> = [];

for (const tile of TILES) {
  const tilePath = path.join(POINTCLOUD_DIR, tile.file);
  const measured = await measureTile(tilePath);
  const scanned = measured.measurements.filter(isWellScanned);
  const scannedBySurfaceId = new Map<string, WallMeasurement>(scanned.map((measurement) => [measurement.surfaceId, measurement]));

  const rings = buildFootprintRings(measured.walls);
  const selectPoints = createPointSelector(measured.tile, 5);

  let elevationsMerged = 0;
  let elevationsKept = 0;
  let shaped = 0;

  for (const ring of rings) {
    if (!ring.closed) {
      dropped.push({ tile: tile.id, buildingId: ring.buildingId, reason: `footprint did not close into a single cycle (${ring.ring.length} vertices from ${ring.edgeSurfaceIds.length} edges)` });
      continue;
    }
    const pandElevations = buildElevations(ring.ring, { pandId: `${tile.id}:${ring.buildingId}`, collinearToleranceDeg: 0.75 });
    for (const elevation of pandElevations) {
      const surfaceIds = elevationSurfaceIds(elevation.sourceVertexRange.vertexIndices, ring);
      const constituents = surfaceIds.map((id) => scannedBySurfaceId.get(id)).filter((m): m is WallMeasurement => m != null);
      if (!constituents.length) continue; // no well-scanned wall contributes to this elevation
      elevationsMerged += 1;

      const baseZ = Math.min(...constituents.map((m) => m.raster.frame.origin[2] + m.raster.frame.minUp));
      const topZ = Math.max(...constituents.map((m) => m.wallTopNAP));
      const plane: ElevationPlane = { start: elevation.start, end: elevation.end, baseZ, topZ };

      const margin = 0.6;
      const dx = plane.end.x - plane.start.x;
      const dy = plane.end.y - plane.start.y;
      const points = selectPoints({
        minX: Math.min(plane.start.x, plane.end.x) - margin,
        maxX: Math.max(plane.start.x, plane.end.x) + margin,
        minY: Math.min(plane.start.y, plane.end.y) - margin,
        maxY: Math.max(plane.start.y, plane.end.y) + margin,
        minZ: baseZ - margin,
        maxZ: topZ + UPWARD_SEARCH,
      });
      const rasterised = rasteriseElevation(points, plane, { cellSize: 0.05, upwardSearch: UPWARD_SEARCH });
      if (!rasterised) {
        dropped.push({ tile: tile.id, buildingId: ring.buildingId, elevationId: elevation.elevationId, reason: 'no cloud returns in the elevation slab' });
        continue;
      }
      const profile = canonicaliseProfile(rasterised.silhouette.profile, rasterised.raster.frame, plane, SAMPLE_M);
      if (profile.widthM < MIN_WIDTH_M) {
        dropped.push({ tile: tile.id, buildingId: ring.buildingId, elevationId: elevation.elevationId, reason: `too narrow (${profile.widthM.toFixed(2)} m < ${MIN_WIDTH_M} m)` });
        continue;
      }
      if (profile.coverage < MIN_COVERAGE) {
        dropped.push({ tile: tile.id, buildingId: ring.buildingId, elevationId: elevation.elevationId, reason: `coverage ${(profile.coverage * 100).toFixed(0)}% below ${MIN_COVERAGE * 100}%` });
        continue;
      }

      const heights = profile.points.filter((point) => point.up != null).map((point) => point.up as number);
      const shape = classifyRoofline(heights);
      const peakUp = Math.max(...heights);
      const eaveUp = eaveHeight(heights);
      if (shape === 'shaped') shaped += 1;
      elevationsKept += 1;

      const id = elevation.elevationId;
      elevations.push({
        id,
        tile: tile.id,
        buildingId: ring.buildingId,
        widthM: Number(profile.widthM.toFixed(2)),
        plane: {
          start: { x: Number(plane.start.x.toFixed(3)), y: Number(plane.start.y.toFixed(3)) },
          end: { x: Number(plane.end.x.toFixed(3)), y: Number(plane.end.y.toFixed(3)) },
          baseZ: Number(plane.baseZ.toFixed(3)),
          topZ: Number(plane.topZ.toFixed(3)),
        },
        surfaceIds,
        profile: profile.points.map((point) => ({ along: Number(point.along.toFixed(2)), up: point.up == null ? null : Number(point.up.toFixed(3)) })),
        shape,
        peakUp: Number(peakUp.toFixed(3)),
        eaveUp: Number(eaveUp.toFixed(3)),
        coverage: Number(profile.coverage.toFixed(3)),
        spotCheck: 'pending',
      });

      // Overlay: the point-cloud elevation image with the profile drawn on it.
      const fakeMeasurement = { raster: rasterised.raster } as unknown as WallMeasurement;
      const image = renderFacadeImage(fakeMeasurement, { pixelsPerMetre: 40, upwardSearch: UPWARD_SEARCH });
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
          x: Math.round((raster.along - rasterised.raster.frame.minAlong) * 40),
          y: Math.round((top - raster.up) * 40),
        };
      };
      let previous: { x: number; y: number } | null = null;
      for (const point of profile.points) {
        if (point.up == null) { previous = null; continue; }
        const pixel = toPixel(point.along, point.up);
        if (previous) {
          const steps = Math.max(1, Math.max(Math.abs(pixel.x - previous.x), Math.abs(pixel.y - previous.y)));
          for (let step = 0; step <= steps; step += 1) {
            const x = Math.round(previous.x + (pixel.x - previous.x) * (step / steps));
            const y = Math.round(previous.y + (pixel.y - previous.y) * (step / steps));
            drawPixel(x, y, [255, 209, 102]);
            drawPixel(x, y - 1, [255, 209, 102]);
          }
        }
        previous = pixel;
      }
      await mkdir(OVERLAY_DIR, { recursive: true });
      const overlayPng = encodePng(image.width, image.height, image.rgb);
      await writeFile(path.join(OVERLAY_DIR, `${id.replace(/[^A-Za-z0-9._-]+/g, '_')}.png`), overlayPng);
    }
  }

  perTileCounts.push({ id: tile.id, wallsScanned: scanned.length, elevationsMerged, elevationsKept, shaped });
}

const totalWallsScanned = perTileCounts.reduce((sum, tile) => sum + tile.wallsScanned, 0);
const totalElevationsMerged = perTileCounts.reduce((sum, tile) => sum + tile.elevationsMerged, 0);
const totalElevationsKept = perTileCounts.reduce((sum, tile) => sum + tile.elevationsKept, 0);
const totalShaped = perTileCounts.reduce((sum, tile) => sum + tile.shaped, 0);

const output = {
  schemaVersion: 1,
  kind: 'roofline-gold/measured',
  generatedAt: new Date().toISOString(),
  frame: `along = metres from plane.start towards plane.end; up = absolute NAP metres; sampled every ${SAMPLE_M} m; null = missing column`,
  source: {
    tiles: TILES.map((tile) => ({ id: tile.id, label: tile.label, path: path.join(POINTCLOUD_DIR, tile.file) })),
    shapedRule: `peak >= 0.5 m above both ends (classifyRoofline in scripts/pointcloud/measure-tile.ts); range <= ${SHAPED_ROOFLINE_RANGE} m is flat`,
  },
  sampleM: SAMPLE_M,
  minWidthM: MIN_WIDTH_M,
  minCoverage: MIN_COVERAGE,
  counts: {
    perTile: perTileCounts,
    totalWallsScanned,
    totalElevationsMerged,
    totalElevationsKept,
    totalShaped,
    dropped: dropped.length,
  },
  elevations,
  dropped,
};

await mkdir(OUT_DIR, { recursive: true });
const json = `${JSON.stringify(output, null, 2)}\n`;
await writeFile(path.join(OUT_DIR, 'measured.json'), json);
const sha256 = createHash('sha256').update(json).digest('hex');
await writeFile(path.join(OUT_DIR, 'measured.sha256'), `${sha256}\n`);

process.stdout.write([
  `wrote ${elevations.length} elevations to ${path.join(OUT_DIR, 'measured.json')}`,
  `walls (scanned) -> elevations (merged, any-scanned-constituent) -> elevations (kept: >=${MIN_WIDTH_M}m, >=${MIN_COVERAGE * 100}% coverage):`,
  `  total: ${totalWallsScanned} -> ${totalElevationsMerged} -> ${totalElevationsKept}, shaped: ${totalShaped}`,
  ...perTileCounts.map((tile) => `  ${tile.id}: ${tile.wallsScanned} -> ${tile.elevationsMerged} -> ${tile.elevationsKept}, shaped: ${tile.shaped}`),
  `dropped: ${dropped.length}`,
  `sha256: ${sha256}`,
].join('\n') + '\n');
