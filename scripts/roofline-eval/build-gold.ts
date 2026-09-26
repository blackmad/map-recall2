/**
 * R1: gold roofline profiles, measured from the point cloud.
 *
 * Rebuilds wall measurements the way `measure-tile.ts` does (reused, not
 * forked), merges the well-scanned walls of each pand into elevations with
 * `buildElevations`, rasterises the cloud fresh against each elevation's own
 * plane, cleans the resampled silhouette (closes narrow coverage holes,
 * rejects narrow spikes, drops deep holes below the eave), and writes the
 * §3-frame profile plus an overlay PNG per elevation and a contact sheet.
 *
 * Usage: npx tsx scripts/roofline-eval/build-gold.ts
 * Reads tiles from `$ROOFLINE_CACHE/pointcloud/*.laz` (default: the
 * amsterdam-facade-rebuild worktree's `.cache`).
 */
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { classifyRoofline, isWellScanned, measureTile, SHAPED_ROOFLINE_RANGE, type WallMeasurement } from '../pointcloud/measure-tile.ts';
import { createPointSelector } from '../pointcloud/load-laz-tile.ts';
import { renderFacadeImage } from '../pointcloud/facade-image.ts';
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
  CLOSING_WIDTH_M,
  SPIKE_WIDTH_M,
  SPIKE_HEIGHT_M,
  HOLE_DEPTH_BELOW_EAVE_M,
  type ElevationPlane,
  type CanonicalProfilePoint,
} from '../../src/canalRecall/facade/elevationRoofline.ts';

const ROOFLINE_CACHE = process.env.ROOFLINE_CACHE || '/Users/blackmad/Code/map-recall2/.worktrees/amsterdam-facade-rebuild/.cache';
const POINTCLOUD_DIR = path.join(ROOFLINE_CACHE, 'pointcloud');
const OUT_DIR = path.resolve('review-data/roofline-gold/v1');
const OVERLAY_DIR = path.join(OUT_DIR, 'overlays');
const UPWARD_SEARCH = 8;
const MIN_WIDTH_M = 2.5;
const MIN_COVERAGE = 0.7;
const PIXELS_PER_METRE = 40;

const TILES = [
  { id: 'museumkwartier', file: 'filtered_2397_9705.laz', label: 'Museumkwartier' },
  { id: 'willemspark', file: 'filtered_2386_9702.laz', label: 'Willemspark' },
];

type ElevationRecord = {
  id: string;
  tile: string;
  buildingId: string;
  widthM: number;
  plane: { start: { x: number; y: number }; end: { x: number; y: number }; baseZ: number; topZ: number };
  surfaceIds: string[];
  /** Cleaned: closed dips, rejected spikes, deep holes nulled. This is the profile to score against. */
  profile: Array<{ along: number; up: number | null }>;
  /** Resampled straight off the cloud, no cleaning — kept so cleaning is auditable. */
  rawProfile: Array<{ along: number; up: number | null }>;
  shape: string;
  peakUp: number;
  eaveUp: number;
  /** Coverage of the cleaned profile (the gate is applied to this, not the raw coverage). */
  coverage: number;
  rawCoverage: number;
  spotCheck: 'pending';
};

const dropped: Array<{ tile: string; buildingId: string; elevationId?: string; reason: string }> = [];
const elevations: ElevationRecord[] = [];
const perTileCounts: Array<{ id: string; wallsScanned: number; elevationsMerged: number; elevationsKept: number; shaped: number }> = [];
const overlays: Array<{ id: string; tile: string; widthM: number; shape: string; coverage: number; png: Buffer }> = [];

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
      const rawProfile = canonicaliseProfile(rasterised.silhouette.profile, rasterised.raster.frame, plane, SAMPLE_M);
      if (rawProfile.widthM < MIN_WIDTH_M) {
        dropped.push({ tile: tile.id, buildingId: ring.buildingId, elevationId: elevation.elevationId, reason: `too narrow (${rawProfile.widthM.toFixed(2)} m < ${MIN_WIDTH_M} m)` });
        continue;
      }

      const rawHeights = rawProfile.points.filter((point) => point.up != null).map((point) => point.up as number);
      const eaveEstimate = eaveHeight(rawHeights);
      const cleanedPoints: CanonicalProfilePoint[] = cleanProfile(rawProfile.points, SAMPLE_M, eaveEstimate);
      const cleanedCoverage = cleanedPoints.length ? cleanedPoints.filter((point) => point.up != null).length / cleanedPoints.length : 0;

      if (cleanedCoverage < MIN_COVERAGE) {
        dropped.push({ tile: tile.id, buildingId: ring.buildingId, elevationId: elevation.elevationId, reason: `cleaned coverage ${(cleanedCoverage * 100).toFixed(0)}% below ${MIN_COVERAGE * 100}% (raw was ${(rawProfile.coverage * 100).toFixed(0)}%)` });
        continue;
      }

      const heights = cleanedPoints.filter((point) => point.up != null).map((point) => point.up as number);
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
        widthM: Number(rawProfile.widthM.toFixed(2)),
        plane: {
          start: { x: Number(plane.start.x.toFixed(3)), y: Number(plane.start.y.toFixed(3)) },
          end: { x: Number(plane.end.x.toFixed(3)), y: Number(plane.end.y.toFixed(3)) },
          baseZ: Number(plane.baseZ.toFixed(3)),
          topZ: Number(plane.topZ.toFixed(3)),
        },
        surfaceIds,
        profile: cleanedPoints.map((point) => ({ along: Number(point.along.toFixed(2)), up: point.up == null ? null : Number(point.up.toFixed(3)) })),
        rawProfile: rawProfile.points.map((point) => ({ along: Number(point.along.toFixed(2)), up: point.up == null ? null : Number(point.up.toFixed(3)) })),
        shape,
        peakUp: Number(peakUp.toFixed(3)),
        eaveUp: Number(eaveUp.toFixed(3)),
        coverage: Number(cleanedCoverage.toFixed(3)),
        rawCoverage: Number(rawProfile.coverage.toFixed(3)),
        spotCheck: 'pending',
      });

      // Overlay: the point-cloud elevation image with the raw profile (thin
      // grey) underneath and the cleaned profile (yellow) drawn on top, so a
      // reviewer can see exactly what cleaning changed.
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
      drawLine(rawProfile.points, [150, 158, 168], false);
      drawLine(cleanedPoints, [255, 209, 102], true);

      await mkdir(OVERLAY_DIR, { recursive: true });
      const overlayPng = encodePng(image.width, image.height, image.rgb);
      const fileName = `${id.replace(/[^A-Za-z0-9._-]+/g, '_')}.png`;
      await writeFile(path.join(OVERLAY_DIR, fileName), overlayPng);
      overlays.push({ id, tile: tile.id, widthM: rawProfile.widthM, shape, coverage: cleanedCoverage, png: overlayPng });
    }
  }

  perTileCounts.push({ id: tile.id, wallsScanned: scanned.length, elevationsMerged, elevationsKept, shaped });
}

const totalWallsScanned = perTileCounts.reduce((sum, tile) => sum + tile.wallsScanned, 0);
const totalElevationsMerged = perTileCounts.reduce((sum, tile) => sum + tile.elevationsMerged, 0);
const totalElevationsKept = perTileCounts.reduce((sum, tile) => sum + tile.elevationsKept, 0);
const totalShaped = perTileCounts.reduce((sum, tile) => sum + tile.shaped, 0);

const output = {
  schemaVersion: 2,
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
  cleaning: {
    note: 'profile is rawProfile after: (1) morphological closing of dips/holes, (2) narrow-spike rejection, (3) nulling columns below eaveUp - holeDepthBelowEaveM. The >=70% coverage gate is applied to the cleaned profile.',
    closingWidthM: CLOSING_WIDTH_M,
    spikeWidthM: SPIKE_WIDTH_M,
    spikeHeightM: SPIKE_HEIGHT_M,
    holeDepthBelowEaveM: HOLE_DEPTH_BELOW_EAVE_M,
  },
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

// Contact sheet: every elevation's overlay, thumbnailed into a grid with a label bar.
if (overlays.length) {
  const cellWidth = 190;
  const cellImageHeight = 260;
  const labelHeight = 34;
  const cellHeight = cellImageHeight + labelHeight;
  const columns = Math.min(7, overlays.length);
  const rows = Math.ceil(overlays.length / columns);
  const escapeXml = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  const composites: sharp.OverlayOptions[] = [];
  for (const [index, overlay] of overlays.entries()) {
    const column = index % columns;
    const row = Math.floor(index / columns);
    const left = column * cellWidth;
    const top = row * cellHeight;
    const thumbnail = await sharp(overlay.png)
      .resize(cellWidth, cellImageHeight, { fit: 'contain', background: '#0b0f14' })
      .png()
      .toBuffer();
    composites.push({ input: thumbnail, left, top });
    const shortId = overlay.id.split(':').slice(1).join(':');
    const labelSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${cellWidth}" height="${labelHeight}">
      <rect width="100%" height="100%" fill="#12161c"/>
      <text x="4" y="13" fill="#e8edf2" font-family="monospace" font-size="9">${escapeXml(`${overlay.tile === 'museumkwartier' ? 'MK' : 'WP'} ${shortId}`)}</text>
      <text x="4" y="26" fill="#93a1b1" font-family="monospace" font-size="9">${overlay.widthM.toFixed(1)}m ${overlay.shape} ${(overlay.coverage * 100).toFixed(0)}%</text>
    </svg>`;
    const labelPng = await sharp(Buffer.from(labelSvg)).png().toBuffer();
    composites.push({ input: labelPng, left, top: top + cellImageHeight });
  }
  const sheet = await sharp({ create: { width: columns * cellWidth, height: rows * cellHeight, channels: 3, background: '#05070a' } })
    .composite(composites)
    .png()
    .toBuffer();
  await writeFile(path.join(OVERLAY_DIR, '_sheet.png'), sheet);
}

process.stdout.write([
  `wrote ${elevations.length} elevations to ${path.join(OUT_DIR, 'measured.json')}`,
  `walls (scanned) -> elevations (merged, any-scanned-constituent) -> elevations (kept: >=${MIN_WIDTH_M}m wide, cleaned coverage >=${MIN_COVERAGE * 100}%):`,
  `  total: ${totalWallsScanned} -> ${totalElevationsMerged} -> ${totalElevationsKept}, shaped: ${totalShaped}`,
  ...perTileCounts.map((tile) => `  ${tile.id}: ${tile.wallsScanned} -> ${tile.elevationsMerged} -> ${tile.elevationsKept}, shaped: ${tile.shaped}`),
  `dropped: ${dropped.length}`,
  `contact sheet: ${path.join(OVERLAY_DIR, '_sheet.png')}`,
  `sha256: ${sha256}`,
].join('\n') + '\n');
