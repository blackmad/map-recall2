import { simplifyPolyline, type WallRaster, type WallRasterCell, type WallSilhouette } from './pointCloudGeometry.ts';

export interface FacadeRect {
  along: number;
  up: number;
  width: number;
  height: number;
  kind: 'opening' | 'protrusion' | 'wall';
}

export interface FacadeMesh {
  width: number;
  height: number;
  baseUp: number;
  wallTop: number;
  /** The wall minus the openings: a hole-free tiling, ready to triangulate. */
  panels: FacadeRect[];
  openings: FacadeRect[];
  protrusions: FacadeRect[];
  /** Openings grouped into horizontal storeys and vertical bays. */
  storeys: FacadeRect[][];
  bays: FacadeRect[][];
  storeyCount: number;
  bayCount: number;
  /** Closed (along, up) polygon of the measured gable above the wall top, or null. */
  gable: Array<readonly [number, number]> | null;
  gableRise: number;
  cellSize: number;
}

export interface FacadeMeshOptions {
  minimumOpeningArea?: number;
  minimumOpeningWidth?: number;
  minimumOpeningHeight?: number;
  minimumProtrusionArea?: number;
  minimumGableRise?: number;
  minimumPointsPerCell?: number;
  /**
   * Metres a cell must sit behind the wall face to be a reveal. The depth
   * histogram is bimodal — wall returns near zero, true recesses 0.3 m back —
   * so a small threshold like 0.12 reads the whole wall as recessed.
   */
  minimumRecessDepth?: number;
}

type Cluster = { cells: WallRasterCell[]; minColumn: number; maxColumn: number; minRow: number; maxRow: number };

const median = (values: readonly number[]): number => {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};

/** Connected components (8-neighbour) of cells, over the raster's own grid. */
export function clusterCells(cells: readonly WallRasterCell[], raster: Pick<WallRaster, 'columns'>): Cluster[] {
  const byIndex = new Map<number, WallRasterCell>();
  for (const cell of cells) byIndex.set(cell.row * raster.columns + cell.column, cell);
  const visited = new Set<number>();
  const clusters: Cluster[] = [];
  for (const [start, startCell] of byIndex) {
    if (visited.has(start)) continue;
    visited.add(start);
    const queue = [startCell];
    const cluster: Cluster = { cells: [], minColumn: startCell.column, maxColumn: startCell.column, minRow: startCell.row, maxRow: startCell.row };
    while (queue.length) {
      const cell = queue.pop()!;
      cluster.cells.push(cell);
      cluster.minColumn = Math.min(cluster.minColumn, cell.column);
      cluster.maxColumn = Math.max(cluster.maxColumn, cell.column);
      cluster.minRow = Math.min(cluster.minRow, cell.row);
      cluster.maxRow = Math.max(cluster.maxRow, cell.row);
      for (let dr = -1; dr <= 1; dr += 1) {
        for (let dc = -1; dc <= 1; dc += 1) {
          if (dr === 0 && dc === 0) continue;
          const index = (cell.row + dr) * raster.columns + (cell.column + dc);
          if (visited.has(index) || !byIndex.has(index)) continue;
          visited.add(index);
          queue.push(byIndex.get(index)!);
        }
      }
    }
    clusters.push(cluster);
  }
  return clusters;
}

const runsOf = (coverage: readonly number[], threshold: number): Array<[number, number]> => {
  const runs: Array<[number, number]> = [];
  let start = -1;
  for (let index = 0; index <= coverage.length; index += 1) {
    const on = index < coverage.length && coverage[index] >= threshold;
    if (on && start < 0) start = index;
    if (!on && start >= 0) { runs.push([start, index - 1]); start = -1; }
  }
  return runs;
};

/**
 * Split a connected region into tight rectangles at low-coverage piers and
 * spandrels. A bounding box alone merges two windows separated by a thin pier
 * into one box; here a column that is mostly *wall* splits the region. Coverage
 * is measured against the solid returns, not the box, so an occlusion gap does
 * not break a real opening.
 */
const refineCluster = (
  cluster: Cluster,
  raster: WallRaster,
  member: ReadonlySet<number>,
  solid: ReadonlySet<number>,
  options: { columnCoverage?: number; rowCoverage?: number } = {},
): Array<{ along: number; up: number; width: number; height: number }> => {
  const columnCoverage = options.columnCoverage ?? 0.5;
  const rowCoverage = options.rowCoverage ?? 0.5;
  const width = cluster.maxColumn - cluster.minColumn + 1;
  const height = cluster.maxRow - cluster.minRow + 1;
  if (width <= 0 || height <= 0) return [];
  const fill = (index: number, rows: readonly number[], columns: readonly number[]) => {
    let present = 0;
    let members = 0;
    for (const row of rows) {
      for (const column of columns) {
        const key = row * raster.columns + column;
        if (!solid.has(key)) continue;
        present += 1;
        if (member.has(key)) members += 1;
      }
    }
    return present ? members / present : 0;
  };
  const rows = Array.from({ length: height }, (_, index) => cluster.minRow + index);
  const columns = Array.from({ length: width }, (_, index) => cluster.minColumn + index);
  const columnFill = columns.map((column) => fill(column, rows, [column]));
  const rects: Array<{ along: number; up: number; width: number; height: number }> = [];
  for (const [firstColumn, lastColumn] of runsOf(columnFill, columnCoverage)) {
    const span = columns.slice(firstColumn, lastColumn + 1);
    const rowFill = rows.map((row) => fill(row, [row], span));
    for (const [firstRow, lastRow] of runsOf(rowFill, rowCoverage)) {
      rects.push({
        along: (cluster.minColumn + firstColumn) * raster.cellSize + raster.frame.minAlong,
        up: (cluster.minRow + firstRow) * raster.cellSize + raster.bottomUp,
        width: (lastColumn - firstColumn + 1) * raster.cellSize,
        height: (lastRow - firstRow + 1) * raster.cellSize,
      });
    }
  }
  return rects;
};

/**
 * Snap opening rectangles onto a common grid. A real façade repeats one window
 * size along a storey line and one bay width down a column; the measured boxes
 * are close but jittered by noise. Grouping into storeys and bays and adopting
 * each group's median size turns a ragged set of boxes into a readable façade.
 */
export const regulariseOpenings = (openings: readonly FacadeRect[]): FacadeRect[] => {
  if (!openings.length) return [];
  const rows = groupIntoRows(openings, 0.4);
  const columns = groupIntoColumns(openings, 0.4);
  const upByOpening = new Map<FacadeRect, { up: number; height: number }>();
  const alongByOpening = new Map<FacadeRect, { along: number; width: number }>();
  for (const row of rows) {
    const up = median(row.map((rect) => rect.up + rect.height));
    const height = median(row.map((rect) => rect.height));
    for (const rect of row) upByOpening.set(rect, { up: up - height, height });
  }
  for (const column of columns) {
    const along = median(column.map((rect) => rect.along + rect.width / 2));
    const width = median(column.map((rect) => rect.width));
    for (const rect of column) alongByOpening.set(rect, { along: along - width / 2, width });
  }
  return openings.map((rect) => {
    const vertical = upByOpening.get(rect);
    const horizontal = alongByOpening.get(rect);
    return {
      along: horizontal ? horizontal.along : rect.along,
      up: vertical ? vertical.up : rect.up,
      width: horizontal ? horizontal.width : rect.width,
      height: vertical ? vertical.height : rect.height,
      kind: 'opening',
    };
  });
};

const rectsOf = (
  cells: readonly WallRasterCell[],
  solid: readonly WallRasterCell[],
  raster: WallRaster,
  kind: FacadeRect['kind'],
  keep: (rect: FacadeRect) => boolean,
  options: { columnCoverage?: number; rowCoverage?: number } = {},
) => {
  const member = new Set(cells.map((cell) => cell.row * raster.columns + cell.column));
  const solidSet = new Set(solid.map((cell) => cell.row * raster.columns + cell.column));
  const rects: FacadeRect[] = [];
  for (const cluster of clusterCells(cells, raster)) {
    for (const rect of refineCluster(cluster, raster, member, solidSet, options)) {
      const withKind: FacadeRect = { ...rect, kind };
      if (keep(withKind)) rects.push(withKind);
    }
  }
  return rects;
};

/**
 * Subtract holes from a rectangle, returning a hole-free tiling. Each hole is
 * removed as a left strip, a right strip, and the two middle pieces above and
 * below it, so the result never overlaps and never leaves a gap.
 */
export function subtractRects(base: FacadeRect, holes: readonly FacadeRect[]): FacadeRect[] {
  let rects: FacadeRect[] = [base];
  for (const hole of holes) {
    const next: FacadeRect[] = [];
    for (const rect of rects) {
      const left = Math.max(rect.along, hole.along);
      const right = Math.min(rect.along + rect.width, hole.along + hole.width);
      const bottom = Math.max(rect.up, hole.up);
      const top = Math.min(rect.up + rect.height, hole.up + hole.height);
      if (right <= left || top <= bottom) { next.push(rect); continue; }
      if (hole.along > rect.along) next.push({ along: rect.along, up: rect.up, width: hole.along - rect.along, height: rect.height, kind: 'wall' });
      const rectRight = rect.along + rect.width;
      const holeRight = hole.along + hole.width;
      if (holeRight < rectRight) next.push({ along: holeRight, up: rect.up, width: rectRight - holeRight, height: rect.height, kind: 'wall' });
      if (hole.up > rect.up) next.push({ along: left, up: rect.up, width: right - left, height: hole.up - rect.up, kind: 'wall' });
      const rectTop = rect.up + rect.height;
      const holeTop = hole.up + hole.height;
      if (holeTop < rectTop) next.push({ along: left, up: holeTop, width: right - left, height: rectTop - holeTop, kind: 'wall' });
    }
    rects = next;
  }
  return rects.filter((rect) => rect.width > 1e-6 && rect.height > 1e-6);
}

/**
 * Group rectangles into rows by vertical overlap and columns by horizontal
 * overlap: a façade's storeys and bays. Input need not be sorted.
 */
export function groupIntoRows(rects: readonly FacadeRect[], overlapFraction = 0.5): FacadeRect[][] {
  return groupRects(rects, (rect) => [rect.up, rect.up + rect.height], overlapFraction);
}

export function groupIntoColumns(rects: readonly FacadeRect[], overlapFraction = 0.5): FacadeRect[][] {
  return groupRects(rects, (rect) => [rect.along, rect.along + rect.width], overlapFraction);
}

const groupRects = (rects: readonly FacadeRect[], span: (rect: FacadeRect) => [number, number], overlapFraction: number): FacadeRect[][] => {
  const sorted = [...rects].sort((a, b) => span(a)[0] - span(b)[0]);
  const groups: Array<{ min: number; max: number; items: FacadeRect[] }> = [];
  for (const rect of sorted) {
    const [low, high] = span(rect);
    const group = groups.find((candidate) => {
      const overlap = Math.min(candidate.max, high) - Math.max(candidate.min, low);
      const smaller = Math.min(candidate.max - candidate.min, high - low);
      return smaller > 0 && overlap >= smaller * overlapFraction;
    });
    if (group) {
      group.items.push(rect);
      group.min = Math.min(group.min, low);
      group.max = Math.max(group.max, high);
    } else {
      groups.push({ min: low, max: high, items: [rect] });
    }
  }
  return groups.sort((a, b) => a.min - b.min).map((group) => group.items);
};

/**
 * Compile a measured wall into low-poly primitives: the wall rectangle, its
 * opening recesses, its protrusions and the measured gable polygon. Everything
 * is in the wall's metric frame, in metres.
 */
export function compileFacade(raster: WallRaster, silhouette: WallSilhouette, options: FacadeMeshOptions = {}): FacadeMesh {
  const minimumOpeningArea = options.minimumOpeningArea ?? 0.25;
  const minimumOpeningWidth = options.minimumOpeningWidth ?? 0.25;
  const minimumOpeningHeight = options.minimumOpeningHeight ?? 0.25;
  const minimumProtrusionArea = options.minimumProtrusionArea ?? 0.1;
  const minimumGableRise = options.minimumGableRise ?? 0.3;
  const minimumPointsPerCell = options.minimumPointsPerCell ?? 3;
  const minimumRecessDepth = options.minimumRecessDepth ?? 0.25;

  const solid = raster.cells.filter((cell) => cell.count >= minimumPointsPerCell);
  const rawOpenings = rectsOf(
    solid.filter((cell) => cell.meanDepth <= -minimumRecessDepth),
    solid,
    raster,
    'opening',
    (rect) => rect.width * rect.height >= minimumOpeningArea && rect.width >= minimumOpeningWidth && rect.height >= minimumOpeningHeight,
    { columnCoverage: 0.5, rowCoverage: 0.5 },
  );
  const openings = regulariseOpenings(rawOpenings);
  const protrusions = rectsOf(
    solid.filter((cell) => cell.meanDepth >= 0.08),
    solid,
    raster,
    'protrusion',
    (rect) => rect.width * rect.height >= minimumProtrusionArea,
    { columnCoverage: 0.6, rowCoverage: 0.6 },
  );

  const wallTop = raster.frame.maxUp;
  const above = silhouette.profile.filter((point) => point[1] > wallTop + 0.02);
  let gable: Array<readonly [number, number]> | null = null;
  let gableRise = 0;
  if (above.length >= 2) {
    const peak = Math.max(...above.map((point) => point[1]));
    gableRise = peak - wallTop;
    if (gableRise >= minimumGableRise) {
      // Simplify the traced envelope: the silhouette is measured at 5 cm, but a
      // mesh wants the few vertices that carry the shape, not the sensor noise.
      const simplified = simplifyPolyline(above, 0.12);
      const first = simplified[0];
      const last = simplified[simplified.length - 1];
      gable = [[first[0], wallTop], ...simplified, [last[0], wallTop]];
    }
  }

  const storeys = groupIntoRows(openings);
  const bays = groupIntoColumns(openings);

  return {
    width: raster.frame.maxAlong - raster.frame.minAlong,
    height: wallTop - raster.frame.minUp,
    baseUp: raster.frame.minUp,
    wallTop,
    panels: subtractRects(
      { along: raster.frame.minAlong, up: raster.frame.minUp, width: raster.frame.maxAlong - raster.frame.minAlong, height: wallTop - raster.frame.minUp, kind: 'wall' },
      openings,
    ),
    openings,
    protrusions,
    storeys,
    bays,
    storeyCount: storeys.length,
    bayCount: bays.length,
    gable,
    gableRise,
    cellSize: raster.cellSize,
  };
}
