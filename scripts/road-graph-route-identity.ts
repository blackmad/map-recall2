/**
 * Route identity across road-graph storage changes (issue #136, L4 step 5).
 *
 * Builds the whole-city routing graph the way the game does (every
 * streets-routing.json way through `buildRoadSegments`, mergeSize 18, stitch
 * radius 10, land only, ferries connected afterwards by `connectFerryGraph`)
 * and records, through the public API only:
 *   - the graph: node order and positions, each node's edges in order
 *     (target, distance, kind, segment indexes, segment metadata), connectors;
 *   - 20 named routes between consecutive streets of check-canal-car.ts's named
 *     regressions, plus seeded random pairs, each planned by findRoadRoute,
 *     findRoadRoute with an edge cost, planLearningRoadRoute (mastery, home
 *     bias, review due names, via stretch) and findRoadRouteToFirstReachable;
 *   - full shortest-path trees from a few starts (distance per node, in order);
 *   - ferry crossings over the IJ.
 *
 *   node --import tsx scripts/road-graph-route-identity.ts --out=a.json [--graph=<roadGraph.ts>] [--ferry=<network.ts>]
 *   node --import tsx scripts/road-graph-route-identity.ts --compare=a.json   (exit 1 on any difference)
 *
 * `--graph`/`--ferry` point at another copy of the modules (e.g. main's,
 * frozen in a scratch dir) so one snapshot can be taken before a change.
 */
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { buildRoadSegments, projectToWorld, type OsmWay } from '../src/canalRecall/osm/roadProjection';
import type { TransitNetwork } from '../src/canalRecall/transit/network';

const arg = (name: string) => process.argv.find(a => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const load = async (file: string | undefined, fallback: string) =>
  import(pathToFileURL(path.resolve(file ?? fallback)).href);
const G = await load(arg('graph'), 'src/canalRecall/routing/roadGraph.ts');
const F = await load(arg('ferry'), 'src/canalRecall/ferry/network.ts');

type Point = { x: number; y: number };
type RoutingStreet = { name: string; highway?: string; path?: [number, number][]; paths?: [number, number][][] };
const routing = JSON.parse(readFileSync('public/data/extracts/amsterdam/streets-routing.json', 'utf8')) as RoutingStreet[];
const network = JSON.parse(readFileSync('public/data/extracts/amsterdam/transit-network.json', 'utf8')) as TransitNetwork;

// osm-loader.js widths (as check-canal-car.ts's plaza world).
const ROAD_WIDTHS: Record<string, number> = {
  primary: 30, secondary: 26, tertiary: 21, residential: 18, unclassified: 17, living_street: 16,
  service: 13, busway: 18, cycleway: 9, pedestrian: 14, footway: 7, path: 8,
};
const centre = { lat: 52.3731, lon: 4.8932 };
const ways: OsmWay[] = [];
routing.forEach((street, streetIndex) => (street.paths ?? (street.path ? [street.path] : [])).forEach((p, pathIndex) => {
  if (p.length < 2) return;
  if (p.length > 3 && p[0][0] === p.at(-1)![0] && p[0][1] === p.at(-1)![1]) return;
  const highway = street.highway || 'residential';
  ways.push({ id: `${streetIndex}:${pathIndex}`, nodes: p.map(([lat, lon]) => ({ lat, lon })), tags: { name: street.name, highway }, highway } as unknown as OsmWay);
}));
const built = buildRoadSegments(ways, centre, { simplificationToleranceDegrees: 0.00003, roadWidths: ROAD_WIDTHS, defaultRoadWidth: 32 });
const toWorld = (lat: number, lon: number): Point => {
  const p = projectToWorld({ lat, lon }, centre);
  return { x: p.x + built.offset.x, y: p.y + built.offset.y };
};
const land = built.segments.map(s => ({ points: s.points, width: s.width || 0, type: (s as { type?: string }).type || 'residential', name: s.name || '' }));
const segments = [...land, ...F.ferrySegments(network, land, toWorld)];
// road-network.js: routingSegmentsOf(landOnly(segments)), then connectFerries.
const routingSegments = segments.map((segment, segmentIndex) => ({
  points: segment.type === 'ferry' ? [] : segment.points,
  width: segment.width || 0,
  metadata: { segmentIndex, name: segment.name || '', wayId: '' },
}));
const t0 = performance.now();
const graph = F.connectFerryGraph(G.buildRoadGraph(routingSegments, { mergeSize: 18, junctionStitchRadius: 10 }), segments);
const buildMs = performance.now() - t0;

const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex').slice(0, 16);
const nodes = graph.allNodes as { key: string; x: number; y: number; edges: { node: Point & { key: string }; distance: number; kind: string; segmentIndexes: number[]; segmentMetadata: unknown[] }[] }[];
const order = new Map(nodes.map((n, i) => [n.key, i]));
const structure = hash(nodes.map(n => [n.x, n.y, n.edges.map(e => [order.get(e.node.key), e.distance, e.kind, e.segmentIndexes, e.segmentMetadata])]));
const connectors = hash(graph.connectors);

const pointsFor = (name: string) => routing.filter(s => s.name === name).flatMap(s => s.paths ?? (s.path ? [s.path] : [])).flat();
const NAMED = ['Da Costakade', 'De Clercqstraat', 'De Wittenkade', 'Frederiksplein', 'Herenstraat', 'Huidenstraat',
  'Jacob van Lennepstraat', 'Keizersgracht', 'Kinkerstraat', 'Leidsestraat', 'Niek Engelschmanbrug', 'Noordsche Compagniebrug',
  'Potgieterstraat', 'Prinsengracht', 'Raadhuisstraat', 'Rozengracht', 'Staatsliedenbrug', 'Utrechtsestraat',
  'Van Limburg Stirumstraat', 'Vingboomsbrug', 'Da Costakade'];
const named = NAMED.map(name => { const p = pointsFor(name); const [lat, lon] = p[Math.floor(p.length / 2)]; return { name, p: toWorld(lat, lon) }; });
const pairs: { label: string; a: Point; b: Point }[] = [];
for (let i = 1; i < named.length; i++) pairs.push({ label: `${named[i - 1].name} -> ${named[i].name}`, a: named[i - 1].p, b: named[i].p });
let seed = 0x5eed;
const rand = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32; };
const random = Number(arg('random') ?? 40);
for (let i = 0; i < random; i++) {
  const a = nodes[Math.floor(rand() * nodes.length)], b = nodes[Math.floor(rand() * nodes.length)];
  pairs.push({ label: `random ${i}`, a: { x: a.x + 3, y: a.y - 2 }, b: { x: b.x - 2, y: b.y + 3 } });
}
// Over the IJ: Centraal's piers to Buiksloterweg and NDSM (the ferry links).
const ferryEnds = segments.filter(s => s.type === 'ferry-access').map(s => s.points[0]);
for (let i = 1; i < ferryEnds.length; i++) pairs.push({ label: `ferry ${i}`, a: ferryEnds[0], b: ferryEnds[i] });

const namesOf = (edge: { segmentMetadata: ({ name?: string } | undefined)[] }) => edge.segmentMetadata.map(m => m?.name).filter(Boolean) as string[];
const mastery = (name: string) => (name.length % 5) / 4; // deterministic, spread over 0..1
const due = new Set(['Keizersgracht', 'Prinsengracht', 'Rozengracht', 'Kinkerstraat']);
const costFn = ({ edge, distance, from, to }: { edge: never; distance: number; from: Point; to: Point }) =>
  distance * (1 + 0.18 * Math.max(0, ...namesOf(edge).map(mastery)) + (Math.abs(from.x - to.x) > Math.abs(from.y - to.y) ? 0.05 : 0));
const round = (path: Point[] | undefined) => path?.map(p => [p.x, p.y]);
const results = pairs.map(({ label, a, b }, index) => {
  const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  const plan = G.planLearningRoadRoute(graph, a, b, {
    masteryForName: mastery, namesForEdge: namesOf, familiarityPenalty: 0.18, maxDetourRatio: 0.12,
    homeBias: index % 2 ? { x: mid.x, y: mid.y, radius: 600 } : undefined,
    dueNames: index % 3 === 0 ? due : undefined,
    via: index % 4 === 0 ? [[mid, { x: mid.x + 40, y: mid.y + 10 }]] : undefined,
  });
  const reach = G.findRoadRouteToFirstReachable(graph, a, [b, mid, a], index % 2 ? costFn : undefined);
  return {
    label,
    plain: round(G.findRoadRoute(graph, a, b)),
    costed: round(G.findRoadRoute(graph, a, b, costFn)),
    learning: plan && { ...plan, path: round(plan.path) },
    reach: reach && { index: reach.index, path: round(reach.path) },
  };
});
const trees = [named[0].p, named[7].p, ferryEnds[0]].map(start => {
  const tree = G.shortestRoadPaths(graph, start);
  return hash(nodes.map(n => [tree.distances.get(n.key) ?? null, order.get(tree.previous.get(n.key)?.key) ?? null]));
});
const nearest = hash(pairs.flatMap(p => [p.a, p.b]).map(p => order.get(G.nearestRoadGraphNode(graph, p)?.key)));

const snapshot = {
  nodes: nodes.length,
  directedEdges: nodes.reduce((sum, n) => sum + n.edges.length, 0),
  connectorCount: graph.connectors.length,
  structure, connectors, trees, nearest,
  routes: results,
};
console.log(`graph ${snapshot.nodes} nodes, ${snapshot.directedEdges} directed edges, ${snapshot.connectorCount} connectors, built in ${buildMs.toFixed(0)} ms; ${results.length} route pairs`);
const out = arg('out');
if (out) writeFileSync(out, JSON.stringify(snapshot));
const compare = arg('compare');
if (compare) {
  const before = JSON.parse(readFileSync(compare, 'utf8'));
  let diffs = 0;
  for (const key of ['nodes', 'directedEdges', 'connectorCount', 'structure', 'connectors', 'trees', 'nearest'] as const) {
    if (JSON.stringify(before[key]) !== JSON.stringify(snapshot[key])) { diffs++; console.log(`DIFF ${key}: ${JSON.stringify(before[key])} -> ${JSON.stringify(snapshot[key])}`); }
  }
  results.forEach((route, i) => {
    if (JSON.stringify(before.routes[i]) !== JSON.stringify(route)) { diffs++; console.log(`DIFF route ${route.label}`); }
  });
  const ridden = results.filter(r => (r.plain?.length ?? 0) > 1).length;
  console.log(diffs ? `${diffs} differences` : `identical: graph structure, connectors, ${trees.length} full trees, ${results.length} pairs × 4 planners (${ridden} with a plain route)`);
  if (diffs) process.exit(1);
}
