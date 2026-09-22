import { extractFacadeWallPlanes, extractRoofPlanes, type FacadeWallPlane, type RoofPlane } from '../../src/canalRecall/building/facadePointCloud.ts';
import {
  classifyWallRaster,
  rasteriseWall,
  wallSilhouette,
  type WallRaster,
  type WallSilhouette,
} from '../../src/canalRecall/facade/pointCloudGeometry.ts';
import { createPointSelector, loadLazTile, type LazTile } from './load-laz-tile.ts';

export const UPWARD_SEARCH = 8;
export const CELL_SIZE = 0.05;
export const MAX_PLANE_DISTANCE = 0.35;
export const MINIMUM_POINTS_PER_CELL = 5;
export const MINIMUM_WALL_AREA = 6;
export const MINIMUM_WALL_HEIGHT = 2.5;
export const WELL_SCANNED = 0.5;
/** Returns per square metre below which a wall is too sparse to trust. */
export const MINIMUM_DENSITY = 250;
/** Fraction of the wall's own cells that must carry returns. */
export const MINIMUM_CELL_COVERAGE = 0.3;
export const isWellScanned = (measurement: WallMeasurement) =>
  measurement.coverage >= WELL_SCANNED && measurement.density >= MINIMUM_DENSITY && measurement.cellCoverage >= MINIMUM_CELL_COVERAGE;
export const GABLE_MARGIN = 0.3;
export const SHAPED_ROOFLINE_RANGE = 1;

export type RooflineShape = 'flat' | 'sloped' | 'shaped';

/**
 * A slanted roof rises to one end; a gable, step or dormer rises to a peak and
 * comes back down. So a *shaped* roofline is one whose highest point stands well
 * above **both** ends. Sensor noise on a slope has its peak at an end, so it is
 * not mistaken for a gable.
 */
export const classifyRoofline = (heights: readonly number[]): RooflineShape => {
  if (heights.length < 3) return 'flat';
  const range = Math.max(...heights) - Math.min(...heights);
  if (range <= SHAPED_ROOFLINE_RANGE) return 'flat';
  const peak = Math.max(...heights);
  const ends = [heights[0], heights[heights.length - 1]];
  return ends.every((end) => peak - end >= 0.5) ? 'shaped' : 'sloped';
};

export type BuildingAttributes = {
  groundNAP: number | null;
  roofNAP50: number | null;
  roofNAPMax: number | null;
  storeys: number | null;
  rmse: number | null;
};

export type WallMeasurement = {
  buildingId: string;
  surfaceId: string;
  width: number;
  height: number;
  pointCount: number;
  /** Returns per square metre of wall — a wall can be "covered" yet too sparse to trust. */
  density: number;
  /** Fraction of the wall's own cells that carry returns: is the whole wall sampled? */
  cellCoverage: number;
  coverage: number;
  planeOffset: number;
  cells: number;
  recessedCells: number;
  protrudingCells: number;
  wallTopNAP: number;
  rooflineNAP: number;
  declaredRoofNAP: number | null;
  declaredRoofMaxNAP: number | null;
  riseAboveWallTop: number;
  riseAboveDeclaredRoofMax: number | null;
  rooflineRange: number;
  rooflineShape: RooflineShape;
  shapedRoofline: boolean;
  silhouetteVertices: number;
  silhouette: Array<readonly [number, number]>;
  raster: WallRaster;
  measured: WallSilhouette;
};

export type TileMeasurement = {
  tile: LazTile;
  buildings: number;
  exteriorWalls: number;
  eligibleWalls: number;
  walls: FacadeWallPlane[];
  roofs: RoofPlane[];
  measurements: WallMeasurement[];
};

const fetchJson = async (url: string): Promise<any> => {
  const response = await fetch(url, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(30_000) });
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
  return await response.json();
};

const numberOrNull = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) ? value : null);

/** All 3DBAG pand features whose bbox intersects the tile, paged via the server's own next link. */
export const fetchBuildings = async (bounds: LazTile['bounds']) => {
  const features: any[] = [];
  const attributes = new Map<string, BuildingAttributes>();
  let url: string | null = `https://api.3dbag.nl/collections/pand/items?bbox=${Math.floor(bounds.minX)},${Math.floor(bounds.minY)},${Math.ceil(bounds.maxX)},${Math.ceil(bounds.maxY)}&limit=100`;
  while (url) {
    const payload = await fetchJson(url);
    for (const feature of payload.features ?? []) {
      features.push({ metadata: payload.metadata, feature });
      for (const object of Object.values(feature.CityObjects ?? {}) as any[]) {
        if (object.type !== 'Building') continue;
        const a = object.attributes ?? {};
        attributes.set((feature.id as string).replace(/^NL\.IMBAG\.Pand\./, 'bag:'), {
          groundNAP: numberOrNull(a.b3_h_maaiveld),
          roofNAP50: numberOrNull(a.b3_h_dak_50p),
          roofNAPMax: numberOrNull(a.b3_h_dak_max),
          storeys: numberOrNull(a.b3_bouwlagen),
          rmse: numberOrNull(a.b3_rmse_lod22),
        });
      }
    }
    url = (payload.links ?? []).find((link: any) => link.rel === 'next')?.href ?? null;
  }
  return { features, attributes };
};

const wallBounds = (wall: FacadeWallPlane, upwardSearch: number) => {
  const xs = wall.vertices.map((vertex) => vertex[0]);
  const ys = wall.vertices.map((vertex) => vertex[1]);
  const zs = wall.vertices.map((vertex) => vertex[2]);
  const pad = 0.6;
  return {
    minX: Math.min(...xs) - pad,
    maxX: Math.max(...xs) + pad,
    minY: Math.min(...ys) - pad,
    maxY: Math.max(...ys) + pad,
    minZ: Math.min(...zs) - pad,
    maxZ: Math.max(...zs) + upwardSearch,
  };
};

export const measureWall = (
  wall: FacadeWallPlane,
  selectPoints: ReturnType<typeof createPointSelector>,
  attributes: BuildingAttributes | null,
): WallMeasurement | null => {
  if (wall.vertices.length < 3) return null;
  const points = selectPoints(wallBounds(wall, UPWARD_SEARCH));
  if (points.length < 200) return null;
  const raster = rasteriseWall(points, wall, {
    cellSize: CELL_SIZE,
    maxPlaneDistance: MAX_PLANE_DISTANCE,
    upwardSearch: UPWARD_SEARCH,
  });
  if (!raster) return null;
  const classification = classifyWallRaster(raster, { minimumPointsPerCell: MINIMUM_POINTS_PER_CELL });
  const measured = wallSilhouette(raster, { minimumPointsPerCell: 2, tolerance: 0.08, minimumRun: 3, smoothWindow: 9 });
  const originNAP = raster.frame.origin[2];
  const wallTopNAP = originNAP + raster.frame.maxUp;
  const rooflineNAP = originNAP + (measured.profile.length ? Math.max(...measured.profile.map((point) => point[1])) : raster.frame.maxUp);
  const heights = measured.profile.map((point) => point[1]);
  const rooflineRange = heights.length ? Math.max(...heights) - Math.min(...heights) : 0;
  const rooflineShape = classifyRoofline(heights);
  const area = Math.max(0.5, (raster.frame.maxAlong - raster.frame.minAlong) * (raster.frame.maxUp - raster.frame.minUp));
  const wallRows = Math.max(1, Math.ceil((raster.frame.maxUp - raster.bottomUp) / raster.cellSize));
  const filled = raster.cells.filter((cell) => cell.row < wallRows && cell.count >= 2).length;
  const cellCoverage = filled / (raster.columns * wallRows);
  return {
    buildingId: wall.buildingId,
    surfaceId: wall.surfaceId,
    width: raster.frame.maxAlong - raster.frame.minAlong,
    height: raster.frame.maxUp - raster.frame.minUp,
    pointCount: raster.pointCount,
    density: raster.pointCount / area,
    cellCoverage,
    coverage: classification.coverage,
    planeOffset: raster.planeOffset,
    cells: raster.cells.length,
    recessedCells: classification.recessed.length,
    protrudingCells: classification.protruding.length,
    wallTopNAP,
    rooflineNAP,
    declaredRoofNAP: attributes?.roofNAP50 ?? null,
    declaredRoofMaxNAP: attributes?.roofNAPMax ?? null,
    riseAboveWallTop: measured.riseAboveWallTop,
    riseAboveDeclaredRoofMax: attributes?.roofNAPMax != null ? rooflineNAP - attributes.roofNAPMax : null,
    rooflineRange,
    rooflineShape,
    shapedRoofline: rooflineShape === 'shaped',
    silhouetteVertices: measured.simplified.length,
    silhouette: measured.simplified,
    raster,
    measured,
  };
};

export const measureTile = async (tilePath: string): Promise<TileMeasurement> => {
  const tile = await loadLazTile(tilePath);
  const selectPoints = createPointSelector(tile, 5);
  const { features, attributes } = await fetchBuildings(tile.bounds);
  const walls: FacadeWallPlane[] = [];
  const roofs: RoofPlane[] = [];
  for (const response of features) {
    walls.push(...extractFacadeWallPlanes(response));
    roofs.push(...extractRoofPlanes(response));
  }
  const eligible = walls.filter((wall) => wall.areaSquareMetres >= MINIMUM_WALL_AREA);
  const measurements: WallMeasurement[] = [];
  for (const wall of eligible) {
    const measurement = measureWall(wall, selectPoints, attributes.get(wall.buildingId) ?? null);
    if (!measurement || measurement.height < MINIMUM_WALL_HEIGHT) continue;
    measurements.push(measurement);
  }
  return { tile, buildings: features.length, exteriorWalls: walls.length, eligibleWalls: eligible.length, walls, roofs, measurements };
};

export const median = (values: number[]): number => {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};
