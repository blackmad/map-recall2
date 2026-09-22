/**
 * Publish the measured point-cloud façade demo extract.
 *
 * Measures every cached UPCP demo tile and writes one OBJ of measured facades
 * (true RD/NAP), grey massing for every other wall, and 3DBAG roofs, plus a
 * colour map and a provenance manifest, into a served, versioned directory.
 *
 * Usage: npx tsx scripts/pointcloud/publish-facade-demo.ts [--version=v1]
 */
import { mkdir, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { compileFacade } from '../../src/canalRecall/facade/facadeMeshCompiler.ts';
import { isWellScanned, measureTile } from './measure-tile.ts';
import { buildSceneObj } from './scene-obj.ts';
import { buildGallerySvg } from './gallery.ts';
import type { LazTile } from './load-laz-tile.ts';

const POINT_BUDGET = 200_000;

/** Compact binary of a downsampled tile: `PCF1`, uint32 count, Float32 xyz, Uint8 rgb. */
const encodePoints = (tile: LazTile, budget = POINT_BUDGET) => {
  const step = Math.max(1, Math.floor(tile.count / budget));
  const count = Math.ceil(tile.count / step);
  const buffer = Buffer.alloc(8 + count * 15);
  buffer.write('PCF1', 0, 'ascii');
  buffer.writeUInt32LE(count, 4);
  let offset = 8;
  let written = 0;
  for (let index = 0; index < tile.count; index += step) {
    buffer.writeFloatLE(tile.positions[index * 3], offset);
    buffer.writeFloatLE(tile.positions[index * 3 + 1], offset + 4);
    buffer.writeFloatLE(tile.positions[index * 3 + 2], offset + 8);
    offset += 12;
    written += 1;
  }
  for (let index = 0; index < tile.count; index += step) {
    buffer.writeUInt8(tile.colours ? tile.colours[index * 3] : 190, offset);
    buffer.writeUInt8(tile.colours ? tile.colours[index * 3 + 1] : 190, offset + 1);
    buffer.writeUInt8(tile.colours ? tile.colours[index * 3 + 2] : 190, offset + 2);
    offset += 3;
  }
  return { buffer, count, step };
};

const argument = (name: string) => process.argv.find((value) => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const version = argument('version') || 'v1';
const outputDir = path.resolve(argument('out') || `public/data/pointcloud-facades/${version}`);

const TILES = [
  { id: 'museumkwartier', path: '.cache/pointcloud/filtered_2397_9705.laz', label: 'Museumkwartier' },
  { id: 'willemspark', path: '.cache/pointcloud/filtered_2386_9702.laz', label: 'Willemspark' },
];

const tiles = [];
const index = [];
for (const source of TILES) {
  try {
    const measured = await measureTile(path.resolve(source.path));
    const scanned = measured.measurements.filter(isWellScanned);
    const scene = buildSceneObj(scanned, measured.roofs, measured.walls);
    const compiled = scanned.map((measurement) => compileFacade(measurement.raster, measurement.measured, { minimumPointsPerCell: 3 }));
    const walls = scanned.map((measurement, index) => {
      const mesh = compiled[index];
      const frame = measurement.raster.frame;
      return {
        group: measurement.surfaceId.replace(/[^A-Za-z0-9]+/g, '_'),
        surfaceId: measurement.surfaceId,
        buildingId: measurement.buildingId,
        width: Number(measurement.width.toFixed(2)),
        height: Number(measurement.height.toFixed(2)),
        coverage: Number(measurement.coverage.toFixed(3)),
        cellCoverage: Number(measurement.cellCoverage.toFixed(3)),
        density: Math.round(measurement.density),
        rooflineShape: measurement.rooflineShape,
        rooflineRange: Number(measurement.rooflineRange.toFixed(2)),
        storeys: mesh.storeyCount,
        bays: mesh.bayCount,
        openings: mesh.openings.length,
        gableRise: Number(mesh.gableRise.toFixed(2)),
        normal: frame.n.map((value) => Number(value.toFixed(4))),
        // The wall's metric frame, so a consumer can place the geometry in RD/NAP:
        // world = origin + u * along + v * up + n * depth.
        frame: {
          origin: frame.origin.map((value) => Number(value.toFixed(3))),
          u: frame.u.map((value) => Number(value.toFixed(4))),
          v: frame.v.map((value) => Number(value.toFixed(4))),
          n: frame.n.map((value) => Number(value.toFixed(4))),
          baseUp: Number(mesh.baseUp.toFixed(3)),
          wallTop: Number(mesh.wallTop.toFixed(3)),
        },
        openingRects: mesh.openings.map((opening) => ({
          along: Number(opening.along.toFixed(3)),
          up: Number(opening.up.toFixed(3)),
          width: Number(opening.width.toFixed(3)),
          height: Number(opening.height.toFixed(3)),
        })),
        gable: mesh.gable ? mesh.gable.map(([along, up]) => [Number(along.toFixed(3)), Number(up.toFixed(3))]) : null,
      };
    });
    const entry = {
      id: source.id,
      label: source.label,
      sha256: measured.tile.sha256,
      bytes: measured.tile.bytes,
      points: measured.tile.count,
      bounds: measured.tile.bounds,
      buildings: measured.buildings,
      exteriorWalls: measured.exteriorWalls,
      measuredWalls: measured.measurements.length,
      scannedWalls: scanned.length,
      shapedRooflines: scanned.filter((measurement) => measurement.rooflineShape === 'shaped').length,
      openings: compiled.reduce((sum, mesh) => sum + mesh.openings.length, 0),
      gables: compiled.filter((mesh) => mesh.gable).length,
      vertices: scene.obj.split('\n').filter((line) => line.startsWith('v ')).length,
      faces: scene.obj.split('\n').filter((line) => line.startsWith('f ')).length,
      groups: scene.groups,
    };
    const tileDir = path.join(outputDir, source.id);
    await mkdir(tileDir, { recursive: true });
    await writeFile(`${tileDir}/scene.obj.tmp`, scene.obj);
    await rename(`${tileDir}/scene.obj.tmp`, `${tileDir}/scene.obj`);
    await writeFile(`${tileDir}/scene-colours.json`, `${JSON.stringify(scene.colours, null, 2)}\n`);
    const encoded = encodePoints(measured.tile);
    await writeFile(`${tileDir}/points.bin`, encoded.buffer);
    const shapedWalls = scanned.filter((measurement) => measurement.rooflineShape === 'shaped');
    await writeFile(`${tileDir}/gallery.svg`, buildGallerySvg(shapedWalls, { title: `${source.label} — shaped rooflines` }));
    const withPoints = { ...entry, demoPoints: encoded.count, demoPointStep: encoded.step, walls };
    await writeFile(`${tileDir}/manifest.json`, `${JSON.stringify({ schemaVersion: 1, ...withPoints }, null, 2)}\n`);
    tiles.push(withPoints);
    index.push({ id: source.id, label: source.label, path: source.id, points: entry.points, scannedWalls: entry.scannedWalls, shapedRooflines: entry.shapedRooflines, openings: entry.openings, gables: entry.gables, demoPoints: encoded.count });
  } catch (error) {
    process.stdout.write(`skipping ${source.id}: ${(error as Error).message}\n`);
  }
}
if (!tiles.length) throw new Error('no tiles were measurable; download the demo tiles first');

const manifest = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  source: {
    name: 'Gemeente Amsterdam puntenwolk (UPCP demo tiles)',
    licence: 'open data (Gemeente Amsterdam)',
    geometry: '3DBAG LoD2.2 WallSurface and RoofSurface',
    geometryLicence: 'CC BY 4.0 — 3DBAG, TU Delft',
    crs: 'EPSG:7415 / NAP',
  },
  totals: {
    tiles: tiles.length,
    measuredWalls: tiles.reduce((sum, tile) => sum + tile.scannedWalls, 0),
    vertices: tiles.reduce((sum, tile) => sum + tile.vertices, 0),
    faces: tiles.reduce((sum, tile) => sum + tile.faces, 0),
  },
  tiles: index,
};

await mkdir(outputDir, { recursive: true });
await writeFile(`${outputDir}/index.json`, `${JSON.stringify(manifest, null, 2)}\n`);

process.stdout.write([
  `published ${tiles.length} tiles to ${outputDir}`,
  `${manifest.totals.measuredWalls} measured walls, ${manifest.totals.vertices} vertices, ${manifest.totals.faces} faces`,
  tiles.map((tile) => `  ${tile.label}: ${tile.scannedWalls} scanned, ${tile.shapedRooflines} shaped, ${tile.openings} openings, ${tile.gables} gables`).join('\n'),
].join('\n') + '\n');
