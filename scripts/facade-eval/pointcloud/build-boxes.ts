/**
 * Turn DGCNN per-point façade labels into opening boxes in the wall-metric
 * frame, for the frozen measured gold set.
 *
 * Reuse, not reimplementation:
 *   - the tile is decoded by `scripts/pointcloud/load-laz-tile.ts`;
 *   - the wall frame and raster come from
 *     `src/canalRecall/facade/pointCloudGeometry.ts` (`wallMetricFrame`,
 *     `rasteriseWall`, `projectToWall`, `wallSilhouette`);
 *   - the opening clustering/refinement/regularisation comes from
 *     `src/canalRecall/facade/facadeMeshCompiler.ts` (`compileFacade`).
 *
 * The only swap versus the measured pipeline is the opening *mask*: instead of
 * `classifyWallRaster`'s depth heuristic (`meanDepth <= -0.25 m`), we feed
 * `rasteriseWall` only the points the model predicted as `window`/`door`
 * (LoFG3) or `opening` (LoFG2). Every solid cell is therefore a model opening,
 * and `compileFacade` is called with `minimumRecessDepth` set far negative so
 * its own depth test passes every cell. Its `clusterCells` -> `refineCluster`
 * -> `regulariseOpenings` path then produces the boxes.
 *
 * Boxes are converted from the raster's centroid-relative frame to the shared
 * crop frame the lanes use: `along` = metres from `plane.start`, `up` = metres
 * above `plane.baseZ` (see scripts/facade-eval/build-gold-set.ts).
 *
 * Usage:
 *   npx tsx scripts/facade-eval/pointcloud/build-boxes.ts \
 *     --tile=.cache/pointcloud/filtered_2397_9705.laz \
 *     --preds=.cache/facade-eval/dgcnn/preds/filtered_2397_9705.lofg3.npy \
 *     --lofg=lofg3 --tile-name=museumkwartier \
 *     --out=.cache/facade-eval/dgcnn-oudzuid-lofg3.json
 */
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  projectToWall,
  rasteriseWall,
  wallMetricFrame,
  wallSilhouette,
  type WallMetricFrame,
} from '../../../src/canalRecall/facade/pointCloudGeometry.ts';
import { compileFacade } from '../../../src/canalRecall/facade/facadeMeshCompiler.ts';
import type { FacadeWallPlane, Point3 } from '../../../src/canalRecall/building/facadePointCloud.ts';
import { loadLazTile } from '../../pointcloud/load-laz-tile.ts';

type Plane = { start: { x: number; y: number }; end: { x: number; y: number }; baseZ: number; topZ: number };
type GoldOpening = { along: number; up: number; width: number; height: number };
type GoldWall = {
  tile: string;
  buildingId: string;
  surfaceId: string;
  group: string;
  wallWidthM: number;
  wallHeightM: number;
  plane: Plane;
  crop: { file: string; sha256: string; width: number; height: number };
  pixelsPerMetre: number;
  openings: GoldOpening[];
};

const argument = (name: string) =>
  process.argv.find((value) => value.startsWith(`--${name}=`))?.slice(name.length + 3);

interface Npy {
  descr: string;
  shape: number[];
  data: ArrayBuffer;
}

const readNpy = (buffer: Buffer): Npy => {
  if (buffer.toString('latin1', 0, 6) !== '\x93NUMPY') throw new Error('not a .npy file');
  const major = buffer.readUInt8(6);
  const headerLength = major === 1 ? buffer.readUInt16LE(8) : buffer.readUInt32LE(8);
  const headerStart = major === 1 ? 10 : 12;
  const header = buffer.toString('latin1', headerStart, headerStart + headerLength);
  const descr = /'descr':\s*'([^']+)'/.exec(header)?.[1] ?? '';
  const shape = (/\(([^)]*)\)/.exec(header)?.[1] ?? '')
    .split(',')
    .map((value) => Number(value.trim()))
    .filter((value) => Number.isFinite(value));
  const dataStart = headerStart + headerLength;
  return { descr, shape, data: buffer.buffer.slice(buffer.byteOffset + dataStart, buffer.byteOffset + buffer.byteLength) };
};

const HALF = (value: number) => {
  const sign = value & 0x8000 ? -1 : 1;
  const exponent = (value & 0x7c00) >> 10;
  const fraction = value & 0x03ff;
  if (exponent === 0) return sign * 2 ** -14 * (fraction / 1024);
  if (exponent === 31) return fraction ? NaN : sign * Infinity;
  return sign * 2 ** (exponent - 15) * (1 + fraction / 1024);
};

const readFloat16 = (npy: Npy): Float32Array => {
  const raw = new Uint16Array(npy.data);
  const out = new Float32Array(raw.length);
  for (let index = 0; index < raw.length; index += 1) out[index] = HALF(raw[index]);
  return out;
};

const readUint8 = (npy: Npy): Uint8Array => new Uint8Array(npy.data);

const dot2 = (ax: number, ay: number, bx: number, by: number) => ax * bx + ay * by;

/** A synthetic wall polygon from the crop plane, so `wallMetricFrame` accepts it. */
const wallFromPlane = (wall: GoldWall): FacadeWallPlane => {
  const { start, end, baseZ, topZ } = wall.plane;
  const length = Math.hypot(end.x - start.x, end.y - start.y) || 1;
  const ux = (end.x - start.x) / length;
  const uy = (end.y - start.y) / length;
  const vertices: Point3[] = [
    [start.x, start.y, baseZ],
    [end.x, end.y, baseZ],
    [end.x, end.y, topZ],
    [start.x, start.y, topZ],
  ];
  return {
    buildingId: wall.buildingId,
    surfaceId: wall.surfaceId,
    exterior: true,
    vertices,
    normal: [uy, -ux, 0],
    areaSquareMetres: length * (topZ - baseZ),
  };
};

/**
 * Raster-frame (along, up) -> crop-frame (along, up):
 *   - along: project the raster-frame XY point onto the plane.start->end axis;
 *   - up: NAP height minus plane.baseZ.
 */
const convertBox = (frame: WallMetricFrame, plane: Plane, cropUx: number, cropUy: number, rect: { along: number; up: number; width: number; height: number }) => {
  const toCropAlong = (along: number) => {
    const x = frame.origin[0] + frame.u[0] * along;
    const y = frame.origin[1] + frame.u[1] * along;
    return dot2(x - plane.start.x, y - plane.start.y, cropUx, cropUy);
  };
  const alongA = toCropAlong(rect.along);
  const alongB = toCropAlong(rect.along + rect.width);
  const along = Math.min(alongA, alongB);
  const width = Math.abs(alongB - alongA);
  const up = frame.origin[2] + rect.up - plane.baseZ;
  return { along, up, width, height: rect.height };
};

const median = (values: number[]): number => {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};

interface TileJob { name: string; laz: string; preds: string }

const buildWallRecord = (
  wall: GoldWall,
  tile: Awaited<ReturnType<typeof loadLazTile>>,
  labels: Uint8Array,
  confidence: Float32Array,
  openingPointIndices: number[],
  openingClasses: number[],
  doorClass: number,
  cropsDir: string,
) => {
  const facadeWall = wallFromPlane(wall);
  const frame = wallMetricFrame(facadeWall);
  const length = Math.hypot(wall.plane.end.x - wall.plane.start.x, wall.plane.end.y - wall.plane.start.y) || 1;
  const cropUx = (wall.plane.end.x - wall.plane.start.x) / length;
  const cropUy = (wall.plane.end.y - wall.plane.start.y) / length;

  const record = {
    buildingId: wall.buildingId,
    elevationId: wall.surfaceId,
    surfaceId: wall.surfaceId,
    wallWidthM: Number(wall.wallWidthM.toFixed(4)),
    wallHeightM: Number(wall.wallHeightM.toFixed(4)),
    cropFile: path.join(cropsDir, path.basename(wall.crop.file)),
    cropWidthPx: wall.crop.width,
    cropHeightPx: wall.crop.height,
    pixelsPerMetre: wall.pixelsPerMetre,
    tiles: 1,
    boxes: [] as Array<{ kind: string; score: number; along: number; up: number; widthM: number; heightM: number }>,
  };
  if (!frame) return record;

  // Opening points near this wall. `rasteriseWall` does the slab filtering.
  const dx = Math.max(0.75, wall.wallWidthM / 2 + 0.5);
  const z0 = Math.min(wall.plane.baseZ, wall.plane.topZ) - 0.5;
  const z1 = Math.max(wall.plane.baseZ, wall.plane.topZ) + 0.5;
  const cx = (wall.plane.start.x + wall.plane.end.x) / 2;
  const cy = (wall.plane.start.y + wall.plane.end.y) / 2;
  const points: Array<{ x: number; y: number; z: number; confidence: number; door: boolean }> = [];
  for (const index of openingPointIndices) {
    const x = tile.positions[index * 3];
    const y = tile.positions[index * 3 + 1];
    const z = tile.positions[index * 3 + 2];
    if (Math.abs(x - cx) > dx || Math.abs(y - cy) > dx) continue;
    if (z < z0 || z > z1) continue;
    points.push({ x, y, z, confidence: confidence[index], door: doorClass >= 0 && labels[index] === doorClass });
  }
  if (points.length < 1) return record;

  const raster = rasteriseWall(points, facadeWall, {
    cellSize: 0.05,
    maxPlaneDistance: 0.6,
    upwardSearch: 0.1,
    marginAlong: 0.15,
    marginUp: 0.15,
  });
  if (!raster) return record;
  const silhouette = wallSilhouette(raster, { minimumPointsPerCell: 1, tolerance: 0.08, minimumRun: 2, smoothWindow: 3 });
  // Every solid cell is a model opening: push the recess threshold far negative.
  const mesh = compileFacade(raster, silhouette, {
    minimumRecessDepth: -1_000_000,
    minimumPointsPerCell: 1,
    minimumOpeningArea: 0.02,
    minimumOpeningWidth: 0.12,
    minimumOpeningHeight: 0.12,
    minimumProtrusionArea: 1e9,
    minimumGableRise: 1e9,
  });

  // `regulariseOpenings` snaps raw rects onto a shared storey/bay grid, so
  // several source clusters can land on one box. Deduplicate before scoring.
  const openings: typeof mesh.openings = [];
  const seen = new Set<string>();
  for (const rect of mesh.openings) {
    const key = [rect.along, rect.up, rect.width, rect.height].map((value) => value.toFixed(4)).join(',');
    if (seen.has(key)) continue;
    seen.add(key);
    openings.push(rect);
  }

  // Per-box score/kind from the opening points that fall inside the box.
  const scores: number[][] = openings.map(() => []);
  const doors: number[] = openings.map(() => 0);
  for (const point of points) {
    const projection = projectToWall(frame, point);
    for (let b = 0; b < openings.length; b += 1) {
      const rect = openings[b];
      if (projection.along >= rect.along && projection.along <= rect.along + rect.width
        && projection.up >= rect.up && projection.up <= rect.up + rect.height) {
        scores[b].push(point.confidence);
        if (point.door) doors[b] += 1;
      }
    }
  }
  record.boxes = openings.map((rect, b) => {
    const converted = convertBox(frame, wall.plane, cropUx, cropUy, rect);
    return {
      kind: doors[b] > scores[b].length / 2 ? 'door' : 'window',
      score: Number(median(scores[b]).toFixed(4)),
      along: Number(converted.along.toFixed(4)),
      up: Number(converted.up.toFixed(4)),
      widthM: Number(converted.width.toFixed(4)),
      heightM: Number(converted.height.toFixed(4)),
    };
  });
  return record;
};

const main = async () => {
  const lofg = argument('lofg') || 'lofg3';
  const outPath = path.resolve(argument('out') || `.cache/facade-eval/dgcnn-oudzuid-${lofg}.json`);
  const goldPath = path.resolve(argument('gold') || 'public/data/facade-model-eval/v1/measured.json');
  const cropsDir = path.resolve(argument('crops') || 'public/data/facade-model-eval/v1/crops');
  const openingClasses = (argument('opening-classes') || (lofg === 'lofg2' ? '1' : '1,2'))
    .split(',').map(Number);
  const doorClass = lofg === 'lofg2' ? -1 : 2;

  const tilesArg = argument('tiles');
  const jobs: TileJob[] = tilesArg
    ? tilesArg.split(',').map((entry) => {
      const [name, laz, preds] = entry.split(':');
      return { name, laz: path.resolve(laz), preds: path.resolve(preds) };
    })
    : [{
      name: argument('tile-name') || path.basename(argument('tile') || 'filtered_2397_9705').replace(/\.laz$/, ''),
      laz: path.resolve(argument('tile') || ''),
      preds: path.resolve(argument('preds') || ''),
    }];

  const gold = JSON.parse(await readFile(goldPath, 'utf8')) as { walls: GoldWall[] };
  const records: ReturnType<typeof buildWallRecord>[] = [];
  for (const job of jobs) {
    const walls = gold.walls.filter((wall) => wall.tile === job.name);
    if (!walls.length) throw new Error(`no gold walls for tile "${job.name}"`);
    const tile = await loadLazTile(job.laz);
    const labels = readUint8(readNpy(await readFile(job.preds)));
    // Confidence is optional: the DGCNN lane writes `<preds>.conf.npy`, the PTv1
    // lane does not. A missing file becomes a constant, which only affects the
    // reported per-box score, never which points are openings.
    let confidence: Float32Array;
    try {
      confidence = readFloat16(readNpy(await readFile(`${job.preds}.conf.npy`)));
    } catch {
      confidence = new Float32Array(labels.length).fill(1);
    }
    if (labels.length !== tile.count) {
      throw new Error(`prediction length ${labels.length} != tile points ${tile.count} for ${job.name}`);
    }
    const openingPointIndices: number[] = [];
    for (let index = 0; index < labels.length; index += 1) {
      if (openingClasses.includes(labels[index])) openingPointIndices.push(index);
    }
    process.stdout.write(`tile ${job.name}: ${tile.count.toLocaleString()} points, ${openingPointIndices.length} opening-labelled\n`);
    for (const wall of walls) {
      records.push(buildWallRecord(wall, tile, labels, confidence, openingPointIndices, openingClasses, doorClass, cropsDir));
    }
  }

  const payload = {
    schemaVersion: 1,
    lane: 'dgcnn',
    model: `UnderOneFacade/DGCNN (${lofg}, xyz; UnderOneFacade ECCV'26 weights on Google Drive folder 1HFn20b8olrwabYFvEl6-W9NYIYrPjozK)`,
    setting: 'pointcloud',
    note: 'Opening mask is DGCNN window/door points projected onto the wall plane; no image crop was read.',
    openingClasses,
    records,
  };
  await writeFile(outPath, `${JSON.stringify(payload, null, 2)}\n`);
  const withBoxes = records.filter((record) => record.boxes.length > 0).length;
  const boxes = records.reduce((sum, record) => sum + record.boxes.length, 0);
  process.stdout.write([
    `walls ${records.length}, walls with boxes ${withBoxes}, boxes ${boxes}`,
    `wrote ${outPath}`,
  ].join('\n') + '\n');
};

await main();
