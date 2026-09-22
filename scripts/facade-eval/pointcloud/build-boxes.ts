/**
 * Turn PTv1 point-cloud predictions into opening boxes in the wall-metric frame.
 *
 * PTv1 predicts a class per point. We treat predicted `window` and `door` points
 * as the opening mask (instead of the depth heuristic `compileFacade` uses),
 * rasterise them on the wall's own metric grid with `rasteriseWall` /
 * `clusterCells` / `regulariseOpenings`, and emit the shared lane JSON contract.
 * Boxes are in the crop frame: `along` = metres from `plane.start` (0 at the
 * low-`u` edge), `up` = metres above `plane.baseZ`.
 *
 * The wall frames are rebuilt from the gold planes with `wallMetricFrame` so
 * they are identical to the measured pipeline's frame for the same wall.
 *
 * Usage:
 *   npx tsx scripts/facade-eval/pointcloud/build-boxes.ts \
 *     [--gold=public/data/facade-model-eval/v1/measured.json] \
 *     [--labels=.cache/underonefacade/preds] [--out=...]
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { readFileSync } from 'node:fs';
import { wallMetricFrame, type CloudPoint, type Vec3 } from '../../../src/canalRecall/facade/pointCloudGeometry.ts';
import { clusterCells, regulariseOpenings, type FacadeRect } from '../../../src/canalRecall/facade/facadeMeshCompiler.ts';
import { loadLazTile } from '../../pointcloud/load-laz-tile.ts';

// LoFG3 class names (config.yaml labels.lofg3.names).
const OPENING_CLASSES = new Set([1, 2]); // window, door

const CELL_SIZE = 0.05;
const MIN_POINTS_PER_CELL = 3;
const OPENING_POINT_FRACTION = 0.5;
const MINIMUM_OPENING_AREA = 0.25;
const MINIMUM_OPENING_WIDTH = 0.25;
const MINIMUM_OPENING_HEIGHT = 0.25;

const TILES = [
  { id: 'museumkwartier', laz: '.cache/pointcloud/filtered_2397_9705.laz', labels: 'filtered_2397_9705.pred.npy' },
  { id: 'willemspark', laz: '.cache/pointcloud/filtered_2386_9702.laz', labels: 'filtered_2386_9702.pred.npy' },
];

interface GoldWall {
  tile: string;
  buildingId: string;
  surfaceId: string;
  group: string;
  wallWidthM: number;
  wallHeightM: number;
  plane: { start: { x: number; y: number }; end: { x: number; y: number }; baseZ: number; topZ: number };
  crop: { file: string; width: number; height: number; sha256: string };
  pixelsPerMetre: number;
}

const argument = (name: string) => process.argv.find((value) => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const goldPath = path.resolve(argument('gold') || 'public/data/facade-model-eval/v1/measured.json');
const labelsDir = path.resolve(argument('labels') || '.cache/underonefacade/preds');
const outPath = path.resolve(argument('out') || 'review-data/facade-model-eval/ptv1-R0.json');

const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];

/** NumPy v1.0 reader for the little-endian int8 arrays the inference writes. */
export const readNpyInt8 = (bytes: Buffer): Int8Array => {
  const magic = bytes.subarray(0, 6).toString('latin1');
  if (magic !== '\x93NUMPY') throw new Error(`not a .npy file (magic ${JSON.stringify(magic)})`);
  const major = bytes[6];
  const headerLength = major === 1 ? bytes.readUInt16LE(8) : bytes.readUInt32LE(8);
  const headerOffset = major === 1 ? 10 : 12;
  const header = bytes.subarray(headerOffset, headerOffset + headerLength).toString('latin1');
  if (!header.includes("'|i1'")) {
    throw new Error(`expected int8 ('|i1') payload, got: ${header.slice(0, 120)}`);
  }
  return new Int8Array(bytes.buffer, bytes.byteOffset + headerOffset + headerLength, bytes.length - headerOffset - headerLength);
};

/** Rebuild the wall's frame from its gold plane, matching the measured pipeline. */
export const planeFrame = (plane: GoldWall['plane']) => {
  const start: Vec3 = [plane.start.x, plane.start.y, plane.baseZ];
  const end: Vec3 = [plane.end.x, plane.end.y, plane.baseZ];
  const topZ = plane.topZ;
  const vertices: Vec3[] = [start, end, [end[0], end[1], topZ], [start[0], start[1], topZ]];
  const edge = sub(end, start);
  const horizontal = Math.hypot(edge[0], edge[1]) || 1;
  const normal: Vec3 = [-edge[1] / horizontal, edge[0] / horizontal, 0];
  return wallMetricFrame({ vertices, normal });
};

/**
 * Rasterise model-predicted opening points onto the wall grid and cluster them
 * into rectangles. A cell is solid with enough returns; a cell is an opening
 * when a majority of its points are predicted window/door.
 */
export const buildOpeningBoxes = (
  frame: NonNullable<ReturnType<typeof wallMetricFrame>>,
  points: readonly CloudPoint[],
  labels: readonly number[],
): { boxes: FacadeRect[]; openingPoints: number } => {
  const topLimit = frame.maxUp + 0.3;
  const bottomLimit = frame.minUp - 0.3;
  const columns = Math.max(1, Math.ceil((frame.maxAlong - frame.minAlong) / CELL_SIZE));
  const rows = Math.max(1, Math.ceil((topLimit - bottomLimit) / CELL_SIZE));
  const accumulate = new Map<number, { count: number; opening: number; height: number }>();
  let openingPoints = 0;
  for (let index = 0; index < points.length; index += 1) {
    const point = points[index];
    const offset = sub([point.x, point.y, point.z], frame.origin);
    const along = dot(offset, frame.u);
    if (along < frame.minAlong || along > frame.maxAlong) continue;
    const up = dot(offset, frame.v);
    if (up < bottomLimit || up > topLimit) continue;
    const column = Math.min(columns - 1, Math.max(0, Math.floor((along - frame.minAlong) / CELL_SIZE)));
    const row = Math.min(rows - 1, Math.max(0, Math.floor((up - bottomLimit) / CELL_SIZE)));
    const key = row * columns + column;
    const accumulator = accumulate.get(key) || { count: 0, opening: 0, height: up };
    accumulator.count += 1;
    if (OPENING_CLASSES.has(labels[index])) {
      accumulator.opening += 1;
      openingPoints += 1;
    }
    accumulator.height = Math.max(accumulator.height, up);
    accumulate.set(key, accumulator);
  }
  const cells = [...accumulate.entries()].map(([key, accumulator]) => ({
    column: key % columns,
    row: Math.floor(key / columns),
    count: accumulator.count,
    meanDepth: 0,
    minDepth: 0,
    maxDepth: 0,
    height: accumulator.height,
    rgb: null,
  }));
  const openings = cells.filter((cell) => {
    if (cell.count < MIN_POINTS_PER_CELL) return false;
    const accumulator = accumulate.get(cell.row * columns + cell.column)!;
    return accumulator.opening / accumulator.count >= OPENING_POINT_FRACTION;
  });
  const raster = { frame, cellSize: CELL_SIZE, columns, rows, bottomUp: bottomLimit, planeOffset: 0, pointCount: points.length, cells, byIndex: new Map() };
  const rects: FacadeRect[] = [];
  for (const cluster of clusterCells(openings, raster)) {
    const along = cluster.minColumn * CELL_SIZE + frame.minAlong;
    const up = cluster.minRow * CELL_SIZE + bottomLimit;
    const width = (cluster.maxColumn - cluster.minColumn + 1) * CELL_SIZE;
    const height = (cluster.maxRow - cluster.minRow + 1) * CELL_SIZE;
    if (width * height < MINIMUM_OPENING_AREA || width < MINIMUM_OPENING_WIDTH || height < MINIMUM_OPENING_HEIGHT) continue;
    rects.push({ along, up, width, height, kind: 'opening' });
  }
  return { boxes: regulariseOpenings(rects), openingPoints };
};

export const buildRecords = async (goldWalls: readonly GoldWall[], labelsFor: (tile: string) => Int8Array, tileFor: (tile: string) => { count: number; positions: Float64Array }) => {
  const records: any[] = [];
  for (const wall of goldWalls) {
    const labels = labelsFor(wall.tile);
    const tile = tileFor(wall.tile);
    const frame = planeFrame(wall.plane);
    if (!frame) continue;
    const { start, end } = wall.plane;
    const pad = 0.6;
    const minX = Math.min(start.x, end.x) - pad;
    const maxX = Math.max(start.x, end.x) + pad;
    const minY = Math.min(start.y, end.y) - pad;
    const maxY = Math.max(start.y, end.y) + pad;
    const points: CloudPoint[] = [];
    const pointLabels: number[] = [];
    for (let index = 0; index < tile.count; index += 1) {
      const x = tile.positions[index * 3];
      const y = tile.positions[index * 3 + 1];
      if (x < minX || x > maxX || y < minY || y > maxY) continue;
      const z = tile.positions[index * 3 + 2];
      if (z < wall.plane.baseZ - 0.6 || z > wall.plane.topZ + 0.6) continue;
      points.push({ x, y, z });
      pointLabels.push(labels[index]);
    }
    const { boxes, openingPoints } = buildOpeningBoxes(frame, points, pointLabels);
    records.push({
      buildingId: wall.buildingId,
      elevationId: wall.surfaceId,
      surfaceId: wall.group,
      wallWidthM: wall.wallWidthM,
      wallHeightM: wall.wallHeightM,
      cropFile: wall.crop.file,
      cropWidthPx: wall.crop.width,
      cropHeightPx: wall.crop.height,
      pixelsPerMetre: wall.pixelsPerMetre,
      tiles: 1,
      predictedPoints: points.length,
      predictedOpeningPoints: openingPoints,
      boxes: boxes.map((box) => ({
        kind: 'window',
        score: 1,
        along: Number(box.along.toFixed(3)),
        up: Number(box.up.toFixed(3)),
        widthM: Number(box.width.toFixed(3)),
        heightM: Number(box.height.toFixed(3)),
      })),
    });
  }
  return records;
};

const main = async () => {
  const gold = JSON.parse(await readFile(goldPath, 'utf8')) as { walls: GoldWall[] };
  const labelCache = new Map<string, Int8Array>();
  const tileCache = new Map<string, { count: number; positions: Float64Array }>();

  // Load tiles once.
  for (const entry of TILES) {
    const loaded = await loadLazTile(path.resolve(entry.laz));
    tileCache.set(entry.id, { count: loaded.count, positions: loaded.positions });
    const bytes = readFileSync(path.join(labelsDir, entry.labels));
    labelCache.set(entry.id, readNpyInt8(bytes));
  }

  const records = await buildRecords(gold.walls, (tile) => labelCache.get(tile)!, (tile) => tileCache.get(tile)!);
  const wallsWithBoxes = records.filter((record) => record.boxes.length > 0).length;
  const payload = {
    schemaVersion: 1,
    lane: 'ptv1',
    model: 'UnderOneFacade PTv1 (Point Transformer v1), PT_lofg3_xyz.pth',
    setting: 'R0',
    agreement: 'predicted window/door points -> opening cells -> connected components -> regularised rectangles',
    boxConvention: 'axis-aligned wall-metre box: along is the min edge in metres from plane.start; up is the min edge in metres above plane.baseZ.',
    count: records.length,
    wallsWithBoxes,
    totalBoxes: records.reduce((sum, record) => sum + record.boxes.length, 0),
    records,
  };
  await mkdir(path.dirname(outPath), { recursive: true });
  await writeFile(outPath, `${JSON.stringify(payload, null, 2)}\n`);
  process.stdout.write(`ptv1: ${records.length} walls, ${wallsWithBoxes} with boxes, ${payload.totalBoxes} boxes -> ${outPath}\n`);
};

if (import.meta.url === `file://${process.argv[1]}`) await main();
