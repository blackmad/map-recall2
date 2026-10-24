import type { Point, Terminal } from './network';

/**
 * The boarding edge of a ferry pier, derived from its GTFS stops.
 *
 * At Centraal the F3 and F4 stops sit 41 m apart on one quay, with four
 * berth ramps between and beside them; the rider only turned into a boat
 * within 3 m of a stop, never at the two middle ramps (user report
 * 2026-10-24, issue #54). A pier's boarding edge is therefore the shoreline
 * through all of its stops, extended a little past the outermost ones, so any
 * GVB quay with a stop on it boards along its whole berth and no quay without
 * a nearby stop ever does.
 *
 * Distances are game pixels (3 px per metre).
 */

/** Stops this close together share one quay (Centraal F3/F4: 41 m; F2 is 470 m away). */
export const PIER_CLUSTER_RADIUS = 80 * 3;
/** The edge runs this far past the outermost stop (Centraal's outer ramps end 3-4 m past F3/F4). */
export const PIER_EDGE_EXTENSION = 20 * 3;
/** How far off the stop line, either side, a rider still stands on the pier edge (middle ramps end 2.2-2.7 m off). */
export const PIER_EDGE_REACH = 6 * 3;
/** Water must lie this close ahead of the rider: the rider is at the edge, not inland of it. */
export const PIER_EDGE_WATER_AHEAD = 15 * 3;
/** Stops spanning less than this give no reliable axis; the shoreline normal decides it. */
const MIN_AXIS_SPAN = 10 * 3;
/** A stop axis this close to the shore normal is not a shoreline (stops on either side of a jetty). */
const MAX_AXIS_NORMAL_COS = Math.cos((50 * Math.PI) / 180);

export type PierEdge = {
  terminals: Terminal[];
  origin: Point;
  /** Unit vector along the quay. */
  tangent: Point;
  /** Unit vector towards the water. */
  normal: Point;
  /** Extent along `tangent` from `origin`, extension included. */
  min: number;
  max: number;
};

const dot = (a: Point, b: Point) => a.x * b.x + a.y * b.y;

/** Group terminals that share a quay (single linkage within PIER_CLUSTER_RADIUS). */
export function pierClusters(terminals: readonly Terminal[], radius = PIER_CLUSTER_RADIUS): Terminal[][] {
  const clusters: Terminal[][] = [];
  for (const t of terminals) {
    const joined = clusters.filter(c => c.some(o => Math.hypot(o.x - t.x, o.y - t.y) <= radius));
    const merged = [t, ...joined.flat()];
    for (const c of joined) clusters.splice(clusters.indexOf(c), 1);
    clusters.push(merged);
  }
  return clusters;
}

/** Circular mean of the known shore directions, or null when none is known. */
export function meanAngle(angles: readonly (number | null | undefined)[]): number | null {
  let sx = 0, sy = 0, n = 0;
  for (const a of angles) {
    if (a == null) continue;
    sx += Math.cos(a); sy += Math.sin(a); n++;
  }
  return n && Math.hypot(sx, sy) > 1e-6 ? Math.atan2(sy, sx) : null;
}

/**
 * The boarding edge of one pier. `shoreAngle` is the direction from the pier
 * towards open water (travel.ts pierShore); without it there is no edge.
 */
export function pierEdge(terminals: readonly Terminal[], shoreAngle: number | null): PierEdge | null {
  if (!terminals.length || shoreAngle == null) return null;
  const shore = { x: Math.cos(shoreAngle), y: Math.sin(shoreAngle) };
  const origin = {
    x: terminals.reduce((s, t) => s + t.x, 0) / terminals.length,
    y: terminals.reduce((s, t) => s + t.y, 0) / terminals.length,
  };
  // Shoreline perpendicular to the shore normal, unless the stops themselves
  // line up along the quay: then their principal axis is the better measure.
  let tangent = { x: -shore.y, y: shore.x };
  if (terminals.length > 1) {
    let xx = 0, xy = 0, yy = 0;
    for (const t of terminals) {
      const dx = t.x - origin.x, dy = t.y - origin.y;
      xx += dx * dx; xy += dx * dy; yy += dy * dy;
    }
    const theta = 0.5 * Math.atan2(2 * xy, xx - yy);
    const axis = { x: Math.cos(theta), y: Math.sin(theta) };
    const span = Math.max(...terminals.map(t => dot({ x: t.x - origin.x, y: t.y - origin.y }, axis)))
      - Math.min(...terminals.map(t => dot({ x: t.x - origin.x, y: t.y - origin.y }, axis)));
    if (span >= MIN_AXIS_SPAN && Math.abs(dot(axis, shore)) <= MAX_AXIS_NORMAL_COS) tangent = axis;
  }
  let normal = { x: -tangent.y, y: tangent.x };
  if (dot(normal, shore) < 0) normal = { x: -normal.x, y: -normal.y };
  const along = terminals.map(t => dot({ x: t.x - origin.x, y: t.y - origin.y }, tangent));
  return {
    terminals: [...terminals], origin, tangent, normal,
    min: Math.min(...along) - PIER_EDGE_EXTENSION,
    max: Math.max(...along) + PIER_EDGE_EXTENSION,
  };
}

/** Where `point` sits on the edge: `along` the quay and `off` it towards the water. */
export function edgeCoordinates(edge: PierEdge, point: Point): { along: number; off: number } {
  const rel = { x: point.x - edge.origin.x, y: point.y - edge.origin.y };
  return { along: dot(rel, edge.tangent), off: dot(rel, edge.normal) };
}

/** True when `point` stands on the boarding edge (within its length and reach). */
export function onPierEdge(edge: PierEdge, point: Point): boolean {
  const { along, off } = edgeCoordinates(edge, point);
  return along >= edge.min && along <= edge.max && Math.abs(off) <= PIER_EDGE_REACH;
}

/** The pier's stop nearest along the quay: the berth the rider boards at. */
export function nearestBerth(edge: PierEdge, point: Point): Terminal {
  const { along } = edgeCoordinates(edge, point);
  let best = edge.terminals[0], bestGap = Infinity;
  for (const t of edge.terminals) {
    const gap = Math.abs(edgeCoordinates(edge, t).along - along);
    if (gap < bestGap) { best = t; bestGap = gap; }
  }
  return best;
}

/** Cheap pre-check before any water probe: is `point` anywhere near this cluster? */
export function nearCluster(terminals: readonly Terminal[], point: Point): boolean {
  const limit = PIER_EDGE_EXTENSION + PIER_EDGE_REACH;
  return terminals.some(t => Math.hypot(t.x - point.x, t.y - point.y) <= limit)
    || (terminals.length > 1 && terminals.some((a, i) => terminals.slice(i + 1).some(b => {
      const dx = b.x - a.x, dy = b.y - a.y;
      const u = Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / (dx * dx + dy * dy || 1)));
      return Math.hypot(point.x - a.x - u * dx, point.y - a.y - u * dy) <= limit;
    })));
}
