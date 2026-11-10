import { readFileSync } from 'node:fs';
import path from 'node:path';
// The routing graph Today's ride snaps its pool to (#279), built exactly as
// the browser builds it (scripts/check-road-reachability.ts): the street
// extract the game loads, motor-only roads dropped, ways Douglas-Peucker
// simplified, merged on the 18 px grid and stitched at 10 px. A snap node is in
// the largest component, every way through it is unnamed and avoidable kinds
// (steps, platforms) are excluded, and no named way passes within
// NAMED_CLEARANCE_M: the road-name probe claims a name up to its half width +
// 20 px (roadSurface.ts NAME_WIDTH_SLACK), under 19 m for the widest street.
// Shared by build-pool.ts and dailyRidePool.test.ts.
import { isMotorOnlyHighway, motorOnlyNames } from '../../src/canalRecall/routing/bikeAccess.ts';
import { loadRoutingFeatures, routingSource } from '../lib/routingFeatures.ts';
import { buildRoadGraph, nearestRoadGraphNode, shortestRoadPaths } from '../../src/canalRecall/routing/roadGraph.ts';
import { connectFerryGraph, ferrySegments, type Segment as FerrySegment } from '../../src/canalRecall/ferry/network.ts';
import type { TransitNetwork } from '../../src/canalRecall/transit/network.ts';

/** Playable half-widths, px (constants.js ROAD_WIDTHS), as the runtime hands them to the graph builder. */
const ROAD_WIDTHS: Record<string, number> = {
  motorway: 55, motorway_link: 45, trunk: 50, trunk_link: 40, primary: 30, primary_link: 24, secondary: 26, secondary_link: 22,
  tertiary: 21, tertiary_link: 18, residential: 18, unclassified: 17, living_street: 16, service: 13, busway: 18,
  cycleway: 9, pedestrian: 14, footway: 7, path: 8, ferry: 34,
};

const PIXELS_PER_METER = 3;
const SIMPLIFICATION_TOLERANCE = 0.00003;
const MERGE_SIZE = 18;
const STITCH_RADIUS = 10;
export const NAMED_CLEARANCE_M = 20;
/** Highways a ride should not start or end on. */
const AVOID_HIGHWAYS = new Set(['steps', 'corridor', 'elevator', 'platform', 'bridleway', 'construction', 'proposed']);

export type LatLon = [number, number];
type Feature = { id: string; name?: string; path?: LatLon[]; paths?: LatLon[][]; highway?: string };
type Point = { x: number; y: number };

export async function loadSnapGraph(directory: string, bridgeNames: ReadonlySet<string> = new Set()) {
  const features = await loadRoutingFeatures<Feature>(directory);
  // ---- projection, as osm-loader.js ----
  const centreLat = 52.372851, centreLng = 4.8936;
  const mLat = 111320, mLng = 111320 * Math.cos(centreLat * Math.PI / 180);
  const project = ([lat, lon]: LatLon): Point => ({ x: (lon - centreLng) * mLng * PIXELS_PER_METER, y: -(lat - centreLat) * mLat * PIXELS_PER_METER });
  const unproject = (p: Point): LatLon => [centreLat - p.y / (mLat * PIXELS_PER_METER), centreLng + p.x / (mLng * PIXELS_PER_METER)];

  function perpendicularDist(p: Point, a: Point, b: Point): number {
    const dx = b.x - a.x, dy = b.y - a.y, l2 = dx * dx + dy * dy;
    if (l2 === 0) return Math.hypot(p.x - a.x, p.y - a.y);
    const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2));
    return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
  }
  function simplify(points: Point[], tolerance: number, depth = 0): Point[] {
    if (points.length <= 2 || depth > 50) return points;
    let maxDist = 0, maxIndex = 0;
    const first = points[0]!, last = points[points.length - 1]!;
    for (let i = 1; i < points.length - 1; i++) {
      const d = perpendicularDist(points[i]!, first, last);
      if (d > maxDist) { maxDist = d; maxIndex = i; }
    }
    if (maxDist > tolerance) {
      return simplify(points.slice(0, maxIndex + 1), tolerance, depth + 1).slice(0, -1).concat(simplify(points.slice(maxIndex), tolerance, depth + 1));
    }
    return [first, last];
  }

  // ---- the live routing graph (check-road-reachability.ts) ----
  type Segment = { name: string; highway: string; wayId: string; points: Point[] };
  const motorNames = motorOnlyNames(features as Parameters<typeof motorOnlyNames>[0]);
  const tolerancePx = SIMPLIFICATION_TOLERANCE * mLat * PIXELS_PER_METER;
  const segments: Segment[] = [];
  for (const feature of features) {
    if (isMotorOnlyHighway(feature.highway) || (feature.name !== undefined && motorNames.has(feature.name))) continue;
    const paths = feature.paths || (feature.path ? [feature.path] : []);
    paths.forEach((line, index) => {
      if (!line || line.length < 2) return;
      const first = line[0]!, last = line[line.length - 1]!;
      if (line.length > 3 && first[0] === last[0] && first[1] === last[1]) return;
      const points = simplify(line.map(project), tolerancePx);
      if (points.length >= 2) segments.push({ name: feature.name || '', highway: feature.highway || '', wayId: `${feature.id}:${index}`, points });
    });
  }

  type Node = { key: string; x: number; y: number; edges: Node[]; ways: Set<Segment> };
  const nodes = new Map<string, Node>();
  const nodeKey = (p: Point) => `${Math.round(p.x / MERGE_SIZE)},${Math.round(p.y / MERGE_SIZE)}`;
  for (const segment of segments) {
    for (let i = 1; i < segment.points.length; i++) {
      const ends = [segment.points[i - 1]!, segment.points[i]!].map((p) => {
        const key = nodeKey(p);
        let node = nodes.get(key);
        if (!node) { node = { key, x: p.x, y: p.y, edges: [], ways: new Set() }; nodes.set(key, node); }
        node.ways.add(segment);
        return node;
      });
      const [a, b] = ends as [Node, Node];
      if (a !== b) { a.edges.push(b); b.edges.push(a); }
    }
  }
  // Edge buckets, for the 10 px stitch and the named-clearance test.
  const CELL = 90;
  type Edge = { a: Node; b: Node; segment: Segment };
  const buckets = new Map<string, Edge[]>();
  for (const segment of segments) {
    for (let i = 1; i < segment.points.length; i++) {
      const a = nodes.get(nodeKey(segment.points[i - 1]!))!, b = nodes.get(nodeKey(segment.points[i]!))!;
      const edge = { a, b, segment };
      for (let gx = Math.floor(Math.min(a.x, b.x) / CELL); gx <= Math.floor(Math.max(a.x, b.x) / CELL); gx++) {
        for (let gy = Math.floor(Math.min(a.y, b.y) / CELL); gy <= Math.floor(Math.max(a.y, b.y) / CELL); gy++) {
          const key = `${gx},${gy}`;
          (buckets.get(key) || buckets.set(key, []).get(key)!).push(edge);
        }
      }
    }
  }
  const edgesNear = (p: Point, radius: number): Edge[] => {
    const out = new Set<Edge>();
    for (let gx = Math.floor((p.x - radius) / CELL); gx <= Math.floor((p.x + radius) / CELL); gx++) {
      for (let gy = Math.floor((p.y - radius) / CELL); gy <= Math.floor((p.y + radius) / CELL); gy++) {
        for (const edge of buckets.get(`${gx},${gy}`) || []) out.add(edge);
      }
    }
    return [...out];
  };
  for (const segment of segments) {
    for (const end of [segment.points[0]!, segment.points[segment.points.length - 1]!]) {
      const from = nodes.get(nodeKey(end));
      if (!from) continue;
      for (const { a, b } of edgesNear(end, STITCH_RADIUS)) {
        if (a === from || b === from) continue;
        if (a.ways.has(segment) && b.ways.has(segment)) continue;
        const abx = b.x - a.x, aby = b.y - a.y, l2 = abx * abx + aby * aby || 1;
        const t = Math.max(0, Math.min(1, ((end.x - a.x) * abx + (end.y - a.y) * aby) / l2));
        if (Math.hypot(end.x - (a.x + t * abx), end.y - (a.y + t * aby)) > STITCH_RADIUS) continue;
        const target: Node = t < 0.5 ? a : b;
        if (target === from) continue;
        from.edges.push(target); target.edges.push(from);
      }
    }
  }
  // Largest component.
  const componentOf = new Map<Node, number>();
  const sizes: number[] = [];
  for (const node of nodes.values()) {
    if (componentOf.has(node)) continue;
    const id = sizes.length, stack = [node];
    componentOf.set(node, id);
    let size = 0;
    while (stack.length) {
      const current = stack.pop()!;
      size++;
      for (const next of current.edges) if (!componentOf.has(next)) { componentOf.set(next, id); stack.push(next); }
    }
    sizes.push(size);
  }
  const mainComponent = sizes.indexOf(Math.max(...sizes));

  // Qualifying snap nodes.
  const clearancePx = NAMED_CLEARANCE_M * PIXELS_PER_METER;
  const snapNodes: Node[] = [];
  for (const node of nodes.values()) {
    if (componentOf.get(node) !== mainComponent) continue;
    if ([...node.ways].some(way => way.name || AVOID_HIGHWAYS.has(way.highway))) continue;
    const namedNear = edgesNear(node, clearancePx).some(({ a, b, segment }) => segment.name && perpendicularDist(node, a, b) < clearancePx);
    if (!namedNear) snapNodes.push(node);
  }
  // Finish nodes (#279 ruling): any routable node, named ways allowed, avoided highways and bridge decks
  // excluded. A named finish reveals nothing: the HUD withholds the name under the rider, questions stop
  // at arrival, and every card names the buurt.
  const finishNodes: Node[] = [];
  for (const node of nodes.values()) {
    if (componentOf.get(node) !== mainComponent) continue;
    if ([...node.ways].some(way => AVOID_HIGHWAYS.has(way.highway) || (way.name && (bridgeNames.has(way.name.toLowerCase()) || /brug\b/i.test(way.name))))) continue;
    finishNodes.push(node);
  }
  const gridOf = (list: Node[]) => {
    const grid = new Map<string, Node[]>();
    for (const node of list) {
      const key = `${Math.floor(node.x / CELL)},${Math.floor(node.y / CELL)}`;
      (grid.get(key) || grid.set(key, []).get(key)!).push(node);
    }
    return grid;
  };
  const snapGrid = gridOf(snapNodes), finishGrid = gridOf(finishNodes);
  const nearestIn = (grid: Map<string, Node[]>) => (p: Point, maxM: number, accept: (latLon: LatLon) => boolean = () => true): { node: Node; metres: number } | null => {
    const radius = maxM * PIXELS_PER_METER;
    let best: { node: Node; metres: number } | null = null;
    for (let gx = Math.floor((p.x - radius) / CELL); gx <= Math.floor((p.x + radius) / CELL); gx++) {
      for (let gy = Math.floor((p.y - radius) / CELL); gy <= Math.floor((p.y + radius) / CELL); gy++) {
        for (const node of grid.get(`${gx},${gy}`) || []) {
          const metres = Math.hypot(node.x - p.x, node.y - p.y) / PIXELS_PER_METER;
          if (metres > maxM || (best && metres >= best.metres) || !accept(unproject(node))) continue;
          best = { node, metres };
        }
      }
    }
    return best;
  };
  const nearestSnap = nearestIn(snapGrid);
  const nearestFinish = nearestIn(finishGrid);
  const finishSet = new Set(finishNodes);
  /** Names of the ways through a graph node at a point ([] when unnamed or not a node). */
  const namesAt = (latLon: LatLon): string[] => {
    const node = nodes.get(nodeKey(project(latLon)));
    return node ? [...new Set([...node.ways].map(way => way.name).filter(Boolean))] : [];
  };
  /**
   * Shortest ride in metres from one place to each target over this graph (Dijkstra on edge length).
   * The game's planner allows a small learning detour on top (maxDetourRatio 0.12), so this is the
   * floor of the planned route; Today's ride uses it for its card distance and length bounds (#279).
   */
  // Route lengths come from the game's own graph code (#279), so the card matches the planned ride:
  // the same segments, plus the IJ ferries and their terminal accesses (ferry/network.ts
  // ferrySegments), through routing/roadGraph.ts buildRoadGraph with the runtime's merge (18 px) and
  // junction stitch (10 px), then connectFerryGraph — road-network.js `_routingGraph`.
  type GameSegment = FerrySegment;
  const land: GameSegment[] = segments.map(seg => ({ points: seg.points, width: ROAD_WIDTHS[seg.highway] ?? 32, type: seg.highway || 'road', name: seg.name }));
  let withFerries: GameSegment[] = land;
  try {
    const network = JSON.parse(readFileSync(path.join(directory, 'transit-network.json'), 'utf8')) as TransitNetwork;
    withFerries = [...land, ...ferrySegments(network, land, (lat, lng) => project([lat, lng]))];
  } catch { /* no transit extract: streets only */ }
  const ferryLegs = withFerries.filter(seg => seg.type === 'ferry').length;
  const gameGraph = connectFerryGraph(buildRoadGraph(
    withFerries.map(seg => ({ points: seg.type === 'ferry' ? [] : seg.points, width: seg.width, metadata: null })),
    { mergeSize: MERGE_SIZE, junctionStitchRadius: STITCH_RADIUS },
  ), withFerries);
  /** Shortest ride, metres, from one place to each target over the game's routing graph (plain length cost). */
  const routeMetres = (from: LatLon, targets: readonly LatLon[]): Array<number | null> => {
    const tree = shortestRoadPaths(gameGraph, project(from));
    if (!tree) return targets.map(() => null);
    return targets.map((t) => {
      const node = nearestRoadGraphNode(gameGraph, project(t));
      const d = node ? tree.dist[node.index] : undefined;
      return d === undefined || !Number.isFinite(d) ? null : d / PIXELS_PER_METER;
    });
  };
  /** Why a point is not a valid finish ('' when it is). */
  const whyNotFinish = (latLon: LatLon): string => {
    const node = nodes.get(nodeKey(project(latLon)));
    if (!node || Math.hypot(node.x - project(latLon).x, node.y - project(latLon).y) > 1) return 'not a graph node';
    if (componentOf.get(node) !== mainComponent) return 'not in the largest component';
    return finishSet.has(node) ? '' : 'an avoided highway or a bridge deck';
  };

  /** Why a point is not a valid ride end, or '' when it is a snap node. */
  const whyNotSnap = (latLon: LatLon): string => {
    const node = nodes.get(nodeKey(project(latLon)));
    if (!node || Math.hypot(node.x - project(latLon).x, node.y - project(latLon).y) > 1) return 'not a graph node';
    if (componentOf.get(node) !== mainComponent) return 'not in the largest component';
    const named = [...node.ways].find(way => way.name);
    if (named) return `on a named way (${named.name})`;
    if (!snapNodes.includes(node)) return 'a named way within the clearance, or an avoided highway';
    return '';
  };
  return {
    features, source: routingSource(), nodeCount: nodes.size, mainSize: sizes[mainComponent]!, snapCount: snapNodes.length,
    finishCount: finishNodes.length, ferryLegs,
    project, unproject, nearestSnap, nearestFinish, whyNotSnap, whyNotFinish, namesAt, routeMetres,
  };
}
