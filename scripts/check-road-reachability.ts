// Reachability harness for the driving network.
//
// Reproduces exactly what the browser does — OSMLoader.fetchRoads →
// buildRoadSegments (Douglas-Peucker) → RoadNetwork._routingGraph (endpoint
// merge) — and reports how many separate components the routing graph falls
// into. A route between two components cannot be planned, and a player who
// drives into a small component is stuck as far as the game is concerned.
//
// Run: npm run test:reachability
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const PIXELS_PER_METER = 3;
const SIMPLIFICATION_TOLERANCE = 0.00003; // degrees, as constants.js
const MERGE_SIZE = 18; // px, as RoadNetwork._routingGraph

type LatLon = [number, number];
type Feature = { id: string; name?: string; path?: LatLon[]; paths?: LatLon[][]; highway?: string; type?: string };
type Point = { x: number; y: number };
type Segment = { name: string; wayId: string; points: Point[] };

const directory = path.resolve('public/data/extracts/amsterdam');
const features: Feature[] = JSON.parse(await readFile(path.join(directory, 'streets-routing.json'), 'utf8'));

// ---- osm-loader.js: fetchRoads (car) ----
type Way = { id: string; name: string; nodes: LatLon[] };
const ways: Way[] = [];
let closedRings = 0;
for (const feature of features) {
  const paths = feature.paths || (feature.path ? [feature.path] : []);
  for (let index = 0; index < paths.length; index++) {
    const line = paths[index];
    if (!line || line.length < 2) continue;
    const first = line[0], last = line[line.length - 1];
    if (line.length > 3 && first[0] === last[0] && first[1] === last[1]) { closedRings++; continue; }
    ways.push({ id: `${feature.id}:${index}`, name: feature.name || '', nodes: line });
  }
}

// ---- osm-loader.js: buildRoadSegments ----
const centreLat = 52.372851, centreLng = 4.8936;
const metersPerDegreeLat = 111320;
const metersPerDegreeLng = 111320 * Math.cos(centreLat * Math.PI / 180);
const project = ([lat, lon]: LatLon): Point => ({
  x: (lon - centreLng) * metersPerDegreeLng * PIXELS_PER_METER,
  y: -(lat - centreLat) * metersPerDegreeLat * PIXELS_PER_METER,
});

function perpendicularDist(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x, dy = b.y - a.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lengthSquared));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}
function simplify(points: Point[], tolerance: number, depth = 0): Point[] {
  if (points.length <= 2 || depth > 50) return points;
  let maxDist = 0, maxIndex = 0;
  const first = points[0], last = points[points.length - 1];
  for (let i = 1; i < points.length - 1; i++) {
    const d = perpendicularDist(points[i], first, last);
    if (d > maxDist) { maxDist = d; maxIndex = i; }
  }
  if (maxDist > tolerance) {
    return simplify(points.slice(0, maxIndex + 1), tolerance, depth + 1).slice(0, -1)
      .concat(simplify(points.slice(maxIndex), tolerance, depth + 1));
  }
  return [first, last];
}

const tolerancePx = SIMPLIFICATION_TOLERANCE * metersPerDegreeLat * PIXELS_PER_METER;
const buildSegments = (simplifyGeometry: boolean): Segment[] => ways.flatMap((way) => {
  const points = way.nodes.map(project);
  const geometry = simplifyGeometry ? simplify(points, tolerancePx) : points;
  return geometry.length >= 2 ? [{ name: way.name, wayId: way.id, points: geometry }] : [];
});

// ---- road-network.js: _routingGraph + components ----
type Node = { key: string; x: number; y: number; edges: Node[]; segments: Set<string> };
function buildGraph(segments: Segment[], mergeSize = MERGE_SIZE) {
  const nodes = new Map<string, Node>();
  const nodeFor = (point: Point, wayId: string): Node => {
    const key = `${Math.round(point.x / mergeSize)},${Math.round(point.y / mergeSize)}`;
    let node = nodes.get(key);
    if (!node) { node = { key, x: point.x, y: point.y, edges: [], segments: new Set() }; nodes.set(key, node); }
    node.segments.add(wayId);
    return node;
  };
  for (const segment of segments) {
    for (let i = 1; i < segment.points.length; i++) {
      const a = nodeFor(segment.points[i - 1], segment.wayId);
      const b = nodeFor(segment.points[i], segment.wayId);
      if (a === b) continue;
      a.edges.push(b);
      b.edges.push(a);
    }
  }
  return nodes;
}

function components(nodes: Map<string, Node>) {
  const seen = new Set<string>();
  const found: Node[][] = [];
  for (const node of nodes.values()) {
    if (seen.has(node.key)) continue;
    const stack = [node], group: Node[] = [];
    seen.add(node.key);
    while (stack.length) {
      const current = stack.pop()!;
      group.push(current);
      for (const next of current.edges) {
        if (seen.has(next.key)) continue;
        seen.add(next.key);
        stack.push(next);
      }
    }
    found.push(group);
  }
  return found.sort((a, b) => b.length - a.length);
}

const report = (label: string, segments: Segment[], mergeSize = MERGE_SIZE) => {
  const nodes = buildGraph(segments, mergeSize);
  const groups = components(nodes);
  const largest = groups[0]?.length || 0;
  const stranded = nodes.size - largest;
  const names = new Set<string>();
  for (const group of groups.slice(1)) for (const node of group) for (const wayId of node.segments) names.add(wayId);
  console.log(`${label}: ${nodes.size} nodes, ${groups.length} components, largest ${largest} (${(100 * largest / nodes.size).toFixed(1)}%), stranded ${stranded}`);
  return { nodes, groups, stranded, strandedWays: names };
};

console.log(`streets-routing.json: ${features.length} features, ${ways.length} open paths (${closedRings} closed rings skipped)`);
const simplified = buildSegments(true);
const raw = buildSegments(false);
console.log(`geometry: ${raw.reduce((n, s) => n + s.points.length, 0)} points raw → ${simplified.reduce((n, s) => n + s.points.length, 0)} after simplification`);

const live = report('vertex-sharing only (pre-fix)', simplified);
const unsimplified = report('no simplification            ', raw);

// Which junctions does simplification destroy? A junction is an OSM coordinate
// shared by two or more different ways; if simplification drops it from one of
// them, that way loses its only connection at that point.
const occurrences = new Map<string, Set<string>>();
for (const way of ways) {
  for (const node of way.nodes) {
    const key = `${node[0].toFixed(7)},${node[1].toFixed(7)}`;
    (occurrences.get(key) || occurrences.set(key, new Set()).get(key)!).add(way.id);
  }
}
const junctionKeys = new Set([...occurrences].filter(([, wayIds]) => wayIds.size > 1).map(([key]) => key));
let keptJunctions = 0, droppedJunctions = 0;
for (const way of ways) {
  const points = way.nodes.map(project);
  const kept = new Set(simplify(points, tolerancePx).map((p) => `${p.x},${p.y}`));
  for (let i = 0; i < way.nodes.length; i++) {
    const key = `${way.nodes[i][0].toFixed(7)},${way.nodes[i][1].toFixed(7)}`;
    if (!junctionKeys.has(key)) continue;
    if (kept.has(`${points[i].x},${points[i].y}`)) keptJunctions++;
    else droppedJunctions++;
  }
}
console.log(`junction vertices: ${keptJunctions} kept, ${droppedJunctions} dropped by simplification (${(100 * droppedJunctions / (keptJunctions + droppedJunctions)).toFixed(1)}%)`);

// ---- Candidate fixes ----
// (1) merge near-coincident nodes even when they straddle a grid cell edge, and
// (2) stitch a way's endpoint to any edge that passes within `radius` px of it —
// the T-junction case OSM models with an interior node that simplification, or
// a slightly-off separate mapping, removes.
type Stitched = { nodes: Map<string, Node>; links: number };
function stitch(segments: Segment[], radius: number): Stitched {
  const nodes = buildGraph(segments, MERGE_SIZE);
  // Spatial index of graph edges.
  const cell = 40;
  const buckets = new Map<string, Array<[Node, Node]>>();
  const seenEdge = new Set<string>();
  for (const node of nodes.values()) {
    for (const other of node.edges) {
      const id = node.key < other.key ? `${node.key}|${other.key}` : `${other.key}|${node.key}`;
      if (seenEdge.has(id)) continue;
      seenEdge.add(id);
      const minX = Math.min(node.x, other.x), maxX = Math.max(node.x, other.x);
      const minY = Math.min(node.y, other.y), maxY = Math.max(node.y, other.y);
      for (let gx = Math.floor((minX - radius) / cell); gx <= Math.floor((maxX + radius) / cell); gx++) {
        for (let gy = Math.floor((minY - radius) / cell); gy <= Math.floor((maxY + radius) / cell); gy++) {
          const key = `${gx},${gy}`;
          const bucket = buckets.get(key) || [];
          bucket.push([node, other]);
          buckets.set(key, bucket);
        }
      }
    }
  }
  const nodeAt = (point: Point) => nodes.get(`${Math.round(point.x / MERGE_SIZE)},${Math.round(point.y / MERGE_SIZE)}`);
  let links = 0;
  for (const segment of segments) {
    for (const end of [segment.points[0], segment.points[segment.points.length - 1]]) {
      const from = nodeAt(end);
      if (!from) continue;
      const gx = Math.floor(end.x / cell), gy = Math.floor(end.y / cell);
      const near = buckets.get(`${gx},${gy}`) || [];
      for (const [a, b] of near) {
        if (a === from || b === from) continue;
        if (a.segments.has(segment.wayId) && b.segments.has(segment.wayId)) continue;
        const abx = b.x - a.x, aby = b.y - a.y;
        const lengthSquared = abx * abx + aby * aby || 1;
        const t = Math.max(0, Math.min(1, ((end.x - a.x) * abx + (end.y - a.y) * aby) / lengthSquared));
        const distance = Math.hypot(end.x - (a.x + t * abx), end.y - (a.y + t * aby));
        if (distance > radius) continue;
        const target = t < 0.5 ? a : b;
        if (target === from) continue;
        from.edges.push(target);
        target.edges.push(from);
        links++;
      }
    }
  }
  return { nodes, links };
}

// The runtime stitches at JUNCTION_STITCH_RADIUS (10 px); the sweep shows what
// the choice of radius buys and what it would cost to go wider.
for (const radius of [10, 8, 14, 20, 28]) {
  const { nodes, links } = stitch(simplified, radius);
  const groups = components(nodes);
  const largest = groups[0]?.length || 0;
  console.log(`${radius === 10 ? 'live graph, stitched @10px' : `  sweep, stitched @${String(radius).padStart(2)}px`}: ${links} new links, ${groups.length} components, largest ${(100 * largest / nodes.size).toFixed(1)}%`);
}
{
  const { nodes, links } = stitch(raw, 14);
  const groups = components(nodes);
  const largest = groups[0]?.length || 0;
  console.log(`stitched @14px, no simplification: ${links} new links, ${groups.length} components, largest ${(100 * largest / nodes.size).toFixed(1)}%`);
}

// Biggest stranded islands, named, so they can be checked on a map.
console.log('\nlargest stranded islands (vertex-sharing graph):');
for (const group of live.groups.slice(1, 11)) {
  const names = new Set<string>();
  for (const node of group) for (const wayId of node.segments) names.add(ways.find((w) => w.id === wayId)?.name || wayId);
  const centre = group.reduce((sum, node) => ({ x: sum.x + node.x / group.length, y: sum.y + node.y / group.length }), { x: 0, y: 0 });
  const lat = centreLat - centre.y / (metersPerDegreeLat * PIXELS_PER_METER);
  const lon = centreLng + centre.x / (metersPerDegreeLng * PIXELS_PER_METER);
  console.log(`  ${String(group.length).padStart(4)} nodes @ ${lat.toFixed(5)},${lon.toFixed(5)} — ${[...names].slice(0, 5).join(', ')}`);
}
console.log(`\nunsimplified reference: ${unsimplified.groups.length} components`);
