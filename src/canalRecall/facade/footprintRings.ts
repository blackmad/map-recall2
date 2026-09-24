/**
 * Reconstruct a pand's footprint ring from its 3DBAG LoD2.2 WallSurfaces.
 *
 * `buildElevations` merges collinear wall edges of an ordered footprint ring
 * into elevations, but the point-cloud pipeline only has the individual
 * `FacadeWallPlane` quads extracted from CityJSONFeatures — there is no
 * pre-built ring. This module derives one directly from the wall geometry
 * (each qualifying WallSurface is exactly one footprint edge) by chaining
 * shared endpoints, so R1 can reuse `buildElevations` unmodified instead of
 * writing a second merge routine.
 */
import type { FacadeWallPlane } from '../building/facadePointCloud.ts';
import type { ProjectedPoint } from './sources.ts';
import { wallMetricFrame } from './pointCloudGeometry.ts';

export interface FootprintRing {
  buildingId: string;
  /** Ring vertices in walk order; not closed (last point implicitly joins the first). */
  ring: ProjectedPoint[];
  /** `edgeSurfaceIds[i]` is the wall whose footprint edge runs `ring[i] -> ring[(i+1) % ring.length]`. */
  edgeSurfaceIds: string[];
  /** False when the wall endpoints didn't close into a single simple cycle (topology anomaly). */
  closed: boolean;
}

/** The wall's horizontal footprint edge: its own frame's `minAlong`/`maxAlong` ends, projected to (x, y). */
export function wallFootprintEdge(wall: Pick<FacadeWallPlane, 'vertices' | 'normal'>): { start: ProjectedPoint; end: ProjectedPoint } | null {
  const frame = wallMetricFrame(wall);
  if (!frame) return null;
  const at = (along: number): ProjectedPoint => ({
    x: frame.origin[0] + frame.u[0] * along,
    y: frame.origin[1] + frame.u[1] * along,
  });
  return { start: at(frame.minAlong), end: at(frame.maxAlong) };
}

const quantise = (point: ProjectedPoint, toleranceM: number) => {
  const grid = toleranceM;
  return `${Math.round(point.x / grid)},${Math.round(point.y / grid)}`;
};

/**
 * Group walls by pand and chain each pand's footprint edges into a ring.
 *
 * Endpoints within `toleranceM` are treated as the same node. A pand whose
 * exterior walls don't close into one simple cycle (a degree != 2 endpoint,
 * or several disjoint loops) still returns its ring(s); rings that didn't
 * close are flagged so a caller can skip or report them rather than merge
 * across a fabricated edge.
 */
export function buildFootprintRings(walls: readonly FacadeWallPlane[], toleranceM = 0.05): FootprintRing[] {
  const byBuilding = new Map<string, FacadeWallPlane[]>();
  for (const wall of walls) {
    const list = byBuilding.get(wall.buildingId) ?? [];
    list.push(wall);
    byBuilding.set(wall.buildingId, list);
  }

  const rings: FootprintRing[] = [];
  for (const [buildingId, buildingWalls] of byBuilding) {
    type Edge = { surfaceId: string; a: string; b: string; pointA: ProjectedPoint; pointB: ProjectedPoint };
    const edges: Edge[] = [];
    for (const wall of buildingWalls) {
      const edge = wallFootprintEdge(wall);
      if (!edge) continue;
      edges.push({
        surfaceId: wall.surfaceId,
        a: quantise(edge.start, toleranceM),
        b: quantise(edge.end, toleranceM),
        pointA: edge.start,
        pointB: edge.end,
      });
    }
    if (!edges.length) continue;

    const adjacency = new Map<string, Array<{ edgeIndex: number; other: string }>>();
    const nodePoint = new Map<string, ProjectedPoint>();
    edges.forEach((edge, edgeIndex) => {
      nodePoint.set(edge.a, edge.pointA);
      nodePoint.set(edge.b, edge.pointB);
      (adjacency.get(edge.a) ?? adjacency.set(edge.a, []).get(edge.a)!).push({ edgeIndex, other: edge.b });
      (adjacency.get(edge.b) ?? adjacency.set(edge.b, []).get(edge.b)!).push({ edgeIndex, other: edge.a });
    });

    const visited = new Array(edges.length).fill(false);
    for (let startEdgeIndex = 0; startEdgeIndex < edges.length; startEdgeIndex += 1) {
      if (visited[startEdgeIndex]) continue;
      const startNode = edges[startEdgeIndex].a;
      const ring: ProjectedPoint[] = [nodePoint.get(startNode)!];
      const edgeSurfaceIds: string[] = [];
      let currentNode = startNode;
      let currentEdgeIndex = startEdgeIndex;
      let closed = false;
      for (let guard = 0; guard < edges.length + 1; guard += 1) {
        const edge = edges[currentEdgeIndex];
        visited[currentEdgeIndex] = true;
        edgeSurfaceIds.push(edge.surfaceId);
        const nextNode = edge.a === currentNode ? edge.b : edge.a;
        if (nextNode === startNode) { closed = true; break; }
        ring.push(nodePoint.get(nextNode)!);
        const options = (adjacency.get(nextNode) ?? []).filter((option) => !visited[option.edgeIndex]);
        if (!options.length) { currentNode = nextNode; break; }
        currentNode = nextNode;
        currentEdgeIndex = options[0].edgeIndex;
      }
      rings.push({ buildingId, ring, edgeSurfaceIds, closed });
    }
  }
  return rings;
}

/**
 * Map an `Elevation.sourceVertexRange.vertexIndices` run (original footprint
 * array indices, in walk order) back to the wall surfaceIds it was built
 * from, using the ring's own edge list. Works regardless of any reversal or
 * rotation `buildElevations` applied internally, because it looks up each
 * consecutive pair by cyclic adjacency in the *original* ring, not by the
 * direction the pair appears in.
 */
export function elevationSurfaceIds(vertexIndices: readonly number[], ring: FootprintRing): string[] {
  const n = ring.ring.length;
  const edgeOf = new Map<string, string>();
  ring.edgeSurfaceIds.forEach((surfaceId, index) => {
    const next = (index + 1) % n;
    edgeOf.set(`${index}:${next}`, surfaceId);
    edgeOf.set(`${next}:${index}`, surfaceId);
  });
  const ids: string[] = [];
  for (let i = 0; i < vertexIndices.length - 1; i += 1) {
    const surfaceId = edgeOf.get(`${vertexIndices[i]}:${vertexIndices[i + 1]}`);
    if (surfaceId && !ids.includes(surfaceId)) ids.push(surfaceId);
  }
  return ids;
}
