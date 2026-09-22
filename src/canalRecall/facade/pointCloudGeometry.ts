import type { FacadeWallPlane } from '../building/facadePointCloud.ts';

export type Vec3 = readonly [number, number, number];

export interface CloudPoint {
  x: number;
  y: number;
  z: number;
  red?: number;
  green?: number;
  blue?: number;
  intensity?: number;
}

export interface WallMetricFrame {
  origin: Vec3;
  u: Vec3;
  v: Vec3;
  n: Vec3;
  minAlong: number;
  maxAlong: number;
  minUp: number;
  maxUp: number;
}

export interface WallRasterCell {
  column: number;
  row: number;
  count: number;
  meanDepth: number;
  minDepth: number;
  maxDepth: number;
  height: number;
  rgb: readonly [number, number, number] | null;
}

export interface WallRaster {
  frame: WallMetricFrame;
  cellSize: number;
  columns: number;
  rows: number;
  /** NAP-relative `up` of row 0's lower edge, so row <-> up is invertible. */
  bottomUp: number;
  planeOffset: number;
  pointCount: number;
  cells: WallRasterCell[];
  byIndex: Map<number, WallRasterCell>;
}

export interface WallRasterOptions {
  cellSize?: number;
  maxPlaneDistance?: number;
  planeOffsetBinWidth?: number;
  marginAlong?: number;
  marginUp?: number;
  /** Metres above the declared wall top to keep sampling, so a gable is included. */
  upwardSearch?: number;
  maximumCells?: number;
}

const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const subtract = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const magnitude = (value: Vec3) => Math.hypot(value[0], value[1], value[2]);
const normalize = (value: Vec3): Vec3 => {
  const length = magnitude(value);
  return length > 1e-9 ? [value[0] / length, value[1] / length, value[2] / length] : [0, 0, 0];
};

/**
 * Build the metric frame a wall is measured in: `u` horizontal along the wall,
 * `v` vertical (NAP up), `n` outward. Works for a wall polygon in any RD/NAP
 * coordinates; a wall whose normal is vertical (a roof) is rejected.
 */
export function wallMetricFrame(wall: Pick<FacadeWallPlane, 'vertices' | 'normal'>): WallMetricFrame | null {
  if (wall.vertices.length < 3) return null;
  const horizontalNormal = normalize([wall.normal[0], wall.normal[1], 0]);
  if (magnitude(horizontalNormal) < 0.5) return null;
  const v: Vec3 = [0, 0, 1];
  let u = normalize(cross(v, horizontalNormal));
  if (magnitude(u) < 0.5) return null;
  const centroid: Vec3 = wall.vertices.reduce(
    (sum, vertex) => [sum[0] + vertex[0] / wall.vertices.length, sum[1] + vertex[1] / wall.vertices.length, sum[2] + vertex[2] / wall.vertices.length],
    [0, 0, 0] as Vec3,
  );
  const along = wall.vertices.map((vertex) => dot(subtract(vertex, centroid), u));
  const up = wall.vertices.map((vertex) => dot(subtract(vertex, centroid), v));
  // Keep `u` pointing from the lower to the higher edge so column order is stable.
  if (along[along.indexOf(Math.max(...along))] < along[along.indexOf(Math.min(...along))]) u = [-u[0], -u[1], -u[2]];
  const orientedAlong = wall.vertices.map((vertex) => dot(subtract(vertex, centroid), u));
  return {
    origin: centroid,
    u,
    v,
    n: horizontalNormal,
    minAlong: Math.min(...orientedAlong),
    maxAlong: Math.max(...orientedAlong),
    minUp: Math.min(...up),
    maxUp: Math.max(...up),
  };
}

export function projectToWall(frame: WallMetricFrame, point: Pick<CloudPoint, 'x' | 'y' | 'z'>) {
  const offset = subtract([point.x, point.y, point.z], frame.origin);
  return { along: dot(offset, frame.u), up: dot(offset, frame.v), depth: dot(offset, frame.n) };
}

const modalBin = (values: readonly number[], binWidth: number) => {
  const bins = new Map<number, number>();
  for (const value of values) {
    const bin = Math.round(value / binWidth);
    bins.set(bin, (bins.get(bin) || 0) + 1);
  }
  let best = 0;
  let bestCount = -1;
  for (const [bin, count] of bins) {
    if (count > bestCount || (count === bestCount && Math.abs(bin) < Math.abs(best))) {
      best = bin;
      bestCount = count;
    }
  }
  return best * binWidth;
};

const median = (values: readonly number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};

/**
 * Project cloud points inside a wall's slab onto a (along, up) grid and record,
 * per cell, how far in front of the wall face the returns sit. Positive depth is
 * outward (a protrusion); negative is recessed (a reveal or opening).
 */
export function rasteriseWall(
  points: readonly CloudPoint[],
  wall: Pick<FacadeWallPlane, 'vertices' | 'normal'>,
  options: WallRasterOptions = {},
): WallRaster | null {
  const frame = wallMetricFrame(wall);
  if (!frame) return null;
  const cellSize = options.cellSize ?? 0.05;
  const maxPlaneDistance = options.maxPlaneDistance ?? 0.35;
  const binWidth = options.planeOffsetBinWidth ?? 0.05;
  const marginAlong = options.marginAlong ?? 0.30;
  const marginUp = options.marginUp ?? 0.30;
  const upwardSearch = options.upwardSearch ?? 8;
  const maximumCells = options.maximumCells ?? 4096;
  const topLimit = frame.maxUp + upwardSearch;
  const bottomLimit = frame.minUp - marginUp;

  const slab: Array<{ along: number; up: number; depth: number; red?: number; green?: number; blue?: number }> = [];
  const depths: number[] = [];
  for (const point of points) {
    const { along, up, depth } = projectToWall(frame, point);
    if (along < frame.minAlong - marginAlong || along > frame.maxAlong + marginAlong) continue;
    if (up < bottomLimit || up > topLimit) continue;
    if (Math.abs(depth) > maxPlaneDistance) continue;
    slab.push({ along, up, depth, red: point.red, green: point.green, blue: point.blue });
    depths.push(depth);
  }
  if (slab.length === 0) return null;
  const planeOffset = modalBin(depths, binWidth);

  const columns = Math.max(1, Math.ceil((frame.maxAlong - frame.minAlong) / cellSize));
  const rows = Math.max(1, Math.ceil((topLimit - bottomLimit) / cellSize));
  if (columns > maximumCells || rows > maximumCells) return null;

  const byIndex = new Map<number, WallRasterCell>();
  const sums = new Map<number, { count: number; sumDepth: number; minDepth: number; maxDepth: number; height: number; r: number; g: number; b: number; rgb: number }>();
  for (const sample of slab) {
    // The margin band is kept only to place the plane offset (modalBin). A point
    // outside the wall's own along extent is a coplanar neighbour's return, and
    // clamping it into the edge column would raise this wall's roofline.
    if (sample.along < frame.minAlong || sample.along > frame.maxAlong) continue;
    const column = Math.min(columns - 1, Math.max(0, Math.floor((sample.along - frame.minAlong) / cellSize)));
    const row = Math.min(rows - 1, Math.max(0, Math.floor((sample.up - bottomLimit) / cellSize)));
    const index = row * columns + column;
    const relative = sample.depth - planeOffset;
    const accumulator = sums.get(index) || { count: 0, sumDepth: 0, minDepth: relative, maxDepth: relative, height: sample.up, r: 0, g: 0, b: 0, rgb: 0 };
    accumulator.count += 1;
    accumulator.sumDepth += relative;
    accumulator.minDepth = Math.min(accumulator.minDepth, relative);
    accumulator.maxDepth = Math.max(accumulator.maxDepth, relative);
    accumulator.height = Math.max(accumulator.height, sample.up);
    if (typeof sample.red === 'number' && typeof sample.green === 'number' && typeof sample.blue === 'number') {
      accumulator.r += sample.red;
      accumulator.g += sample.green;
      accumulator.b += sample.blue;
      accumulator.rgb += 1;
    }
    sums.set(index, accumulator);
  }
  for (const [index, accumulator] of sums) {
    const cell: WallRasterCell = {
      column: index % columns,
      row: Math.floor(index / columns),
      count: accumulator.count,
      meanDepth: accumulator.sumDepth / accumulator.count,
      minDepth: accumulator.minDepth,
      maxDepth: accumulator.maxDepth,
      height: accumulator.height,
      rgb: accumulator.rgb
        ? [Math.round(accumulator.r / accumulator.rgb), Math.round(accumulator.g / accumulator.rgb), Math.round(accumulator.b / accumulator.rgb)]
        : null,
    };
    byIndex.set(index, cell);
  }
  const cells = [...byIndex.values()].sort((a, b) => a.row - b.row || a.column - b.column);
  return { frame, cellSize, columns, rows, bottomUp: bottomLimit, planeOffset, pointCount: slab.length, cells, byIndex };
}

export type WallElement = 'wall' | 'recessed' | 'protruding';

export interface WallRasterClassification {
  wall: WallRasterCell[];
  recessed: WallRasterCell[];
  protruding: WallRasterCell[];
  /** Fraction of wall-face columns that carry at least one return. */
  coverage: number;
}

export interface WallClassificationOptions {
  minimumPointsPerCell?: number;
  recessDepth?: number;
  protrusionDepth?: number;
  faceDepth?: number;
}

/** Classify raster cells by geometry alone: plane, recessed reveal, or protrusion. */
export function classifyWallRaster(raster: WallRaster, options: WallClassificationOptions = {}): WallRasterClassification {
  const minimumPointsPerCell = options.minimumPointsPerCell ?? 3;
  const recessDepth = options.recessDepth ?? 0.12;
  const protrusionDepth = options.protrusionDepth ?? 0.08;
  const faceDepth = options.faceDepth ?? 0.12;
  const wall: WallRasterCell[] = [];
  const recessed: WallRasterCell[] = [];
  const protruding: WallRasterCell[] = [];
  for (const cell of raster.cells) {
    if (cell.count < minimumPointsPerCell) continue;
    if (cell.meanDepth <= -recessDepth) recessed.push(cell);
    else if (cell.meanDepth >= protrusionDepth) protruding.push(cell);
    else if (Math.abs(cell.meanDepth) <= faceDepth) wall.push(cell);
  }
  const occupiedColumns = new Set(raster.cells.filter((cell) => cell.count >= minimumPointsPerCell).map((cell) => cell.column));
  return { wall, recessed, protruding, coverage: occupiedColumns.size / raster.columns };
}

export interface WallSilhouette {
  /** Per-column top envelope before smoothing, in (along, up) metres from the wall origin. */
  rawProfile: Array<readonly [number, number]>;
  /** Spatially median-filtered envelope: a gable is a coherent shape, a spike is not. */
  profile: Array<readonly [number, number]>;
  simplified: Array<readonly [number, number]>;
  /** Metres the measured top rises above the declared wall top, or 0. */
  riseAboveWallTop: number;
}

/** Median of the values within `half` columns, ignoring empty columns. */
const spatialMedian = (tops: ReadonlyArray<number | null>, index: number, half: number) => {
  const window: number[] = [];
  for (let offset = -half; offset <= half; offset += 1) {
    const value = tops[index + offset];
    if (value != null) window.push(value);
  }
  return window.length ? median(window) : null;
};

/** Per-column top envelope of the raster: the measured roofline across the wall. */
export function wallSilhouette(raster: WallRaster, options: { minimumPointsPerCell?: number; tolerance?: number; minimumRun?: number; smoothWindow?: number } = {}): WallSilhouette {
  const minimumPointsPerCell = options.minimumPointsPerCell ?? 2;
  const tolerance = options.tolerance ?? 0.06;
  const minimumRun = options.minimumRun ?? 3;
  const smoothWindow = options.smoothWindow ?? 9;
  const columns = new Map<number, Map<number, WallRasterCell>>();
  for (const cell of raster.cells) {
    if (cell.count < minimumPointsPerCell) continue;
    const rows = columns.get(cell.column) || new Map<number, WallRasterCell>();
    rows.set(cell.row, cell);
    columns.set(cell.column, rows);
  }
  const tops: Array<number | null> = new Array(raster.columns).fill(null);
  for (const [column, rows] of columns) {
    // The top of a real façade is supported by returns below it; an isolated
    // return (a wire, a bird, a stray neighbour point) is not the roofline.
    let top = -1;
    for (let row = raster.rows - 1; row >= minimumRun - 1; row -= 1) {
      let run = 0;
      for (let step = 0; step < minimumRun; step += 1) if (rows.has(row - step)) run += 1;
      if (run === minimumRun) { top = row; break; }
    }
    if (top < 0) continue;
    let height = -Infinity;
    for (let step = 0; step < minimumRun; step += 1) height = Math.max(height, rows.get(top - step)!.height);
    tops[column] = height;
  }
  const toPoint = (column: number, height: number) => [(column + 0.5) * raster.cellSize + raster.frame.minAlong, height] as const;
  const rawProfile: Array<readonly [number, number]> = [];
  for (let column = 0; column < raster.columns; column += 1) if (tops[column] != null) rawProfile.push(toPoint(column, tops[column] as number));
  const half = Math.max(0, Math.floor(smoothWindow / 2));
  const profile: Array<readonly [number, number]> = [];
  for (let column = 0; column < raster.columns; column += 1) {
    if (tops[column] == null) continue;
    const smoothed = spatialMedian(tops, column, half);
    if (smoothed != null) profile.push(toPoint(column, smoothed));
  }
  const simplified = simplifyPolyline(profile, tolerance);
  const measuredTop = profile.length ? Math.max(...profile.map((point) => point[1])) : raster.frame.minUp;
  const declaredTop = raster.frame.maxUp;
  return { rawProfile, profile, simplified, riseAboveWallTop: Math.max(0, measuredTop - declaredTop) };
}

/** Douglas–Peucker simplification of an ordered 2-D polyline. */
export function simplifyPolyline(points: readonly (readonly [number, number])[], tolerance: number): Array<readonly [number, number]> {
  if (points.length <= 2) return points.map((point) => [point[0], point[1]] as const);
  const first = points[0];
  const last = points[points.length - 1];
  const dx = last[0] - first[0];
  const dy = last[1] - first[1];
  const length = Math.hypot(dx, dy);
  let maximumDistance = -1;
  let index = 0;
  for (let i = 1; i < points.length - 1; i += 1) {
    const distance = length < 1e-9
      ? Math.hypot(points[i][0] - first[0], points[i][1] - first[1])
      : Math.abs(dy * points[i][0] - dx * points[i][1] + last[0] * first[1] - last[1] * first[0]) / length;
    if (distance > maximumDistance) {
      maximumDistance = distance;
      index = i;
    }
  }
  if (maximumDistance <= tolerance) return [[first[0], first[1]], [last[0], last[1]]];
  const left = simplifyPolyline(points.slice(0, index + 1), tolerance);
  const right = simplifyPolyline(points.slice(index), tolerance);
  return [...left.slice(0, -1), ...right];
}

/** Mean depth per column, useful for locating vertical bays and piers. */
export function columnDepthProfile(raster: WallRaster): number[] {
  const sums = new Array<number>(raster.columns).fill(0);
  const counts = new Array<number>(raster.columns).fill(0);
  for (const cell of raster.cells) {
    sums[cell.column] += cell.meanDepth;
    counts[cell.column] += 1;
  }
  return sums.map((sum, column) => (counts[column] ? sum / counts[column] : Number.NaN));
}

/** Median height per row, useful for locating storey bands and the eaves. */
export function rowHeightProfile(raster: WallRaster): Array<number | null> {
  const values: number[][] = Array.from({ length: raster.rows }, () => []);
  for (const cell of raster.cells) values[cell.row].push(cell.height);
  return values.map((row) => (row.length ? median(row) : null));
}
