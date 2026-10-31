import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  appendRoadGraph, buildRoadGraph, findRoadRoute, nearestRoadGraphNode, reconstructRoadPath, roadGraphEdgeBetween,
  roadGraphNodeAt, shortestRoadPaths, type RoadGraphNode,
} from './roadGraph.ts';

type Meta = { name: string };
// A plus sign whose west arm ends 4 px short of the through street (stitched
// at a junction projection), and a separate island to the east.
const segments = [
  { points: [{ x: 0, y: 0 }, { x: 100, y: 0 }], metadata: { name: 'through' } },
  { points: [{ x: 50, y: 4 }, { x: 50, y: 80 }], metadata: { name: 'side' } },
  { points: [{ x: 300, y: 0 }, { x: 340, y: 0 }], metadata: { name: 'island' } },
];
const graph = buildRoadGraph<Meta>(segments, { mergeSize: 1, junctionStitchRadius: 6 });

test('node views are cached: one object per node, wherever it is reached from', () => {
  const start = nearestRoadGraphNode(graph, { x: 0, y: 0 })!;
  const [edge] = start.edges;
  assert.equal(edge.node, nearestRoadGraphNode(graph, edge.node));
  assert.equal(roadGraphNodeAt(graph, start.index), start);
  assert.equal(graph.allNodes[start.index], start);
  assert.equal(graph.nodes.get(start.key), start);
  assert.equal(graph.nodes.size, graph.storage.nodeCount);
});

test('every key resolves back to its node, including junction projections', () => {
  const keys = graph.allNodes.map((node) => node.key);
  assert.ok(keys.some((key) => key.startsWith('junction:')), 'fixture: the side street is stitched at a projection');
  assert.equal(new Set(keys).size, keys.length);
  for (const node of graph.allNodes) assert.equal(graph.nodes.get(node.key), node);
  assert.equal(graph.nodes.get('9999,9999'), undefined);
  assert.equal(graph.nodes.get('junction:0'), undefined, 'a quantised node is not a junction');
});

test('edges report their link: distance, kind, segments and shared metadata', () => {
  const junction = graph.allNodes.find((node) => node.key.startsWith('junction:'))!;
  const kinds = junction.edges.map((edge) => edge.kind).sort();
  assert.deepEqual(kinds, ['centreline', 'centreline', 'junction-stitch']);
  const stitch = junction.edges.find((edge) => edge.kind === 'junction-stitch')!;
  assert.deepEqual(stitch.segmentIndexes, [0]);
  assert.equal(stitch.segmentMetadata[0], segments[0].metadata, 'metadata is the segment\'s own object, not a copy');
  const back = roadGraphEdgeBetween(graph, stitch.node, junction)!;
  assert.equal(back.distance, stitch.distance);
  assert.equal(roadGraphEdgeBetween(graph, junction, nearestRoadGraphNode(graph, { x: 320, y: 0 })!), undefined);
});

test('shortest-path trees answer by key and by index alike', () => {
  const tree = shortestRoadPaths(graph, { x: 0, y: 0 })!;
  const end = nearestRoadGraphNode(graph, { x: 50, y: 80 })!;
  const island = nearestRoadGraphNode(graph, { x: 340, y: 0 })!;
  assert.equal(tree.distances.get(end.key), tree.dist[end.index]);
  assert.equal(tree.distances.has(island.key), false);
  assert.equal(tree.dist[island.index], Infinity);
  assert.equal(tree.previous.has(tree.start.key), false);
  const viaArrays = reconstructRoadPath(tree.previous, end);
  const viaMap = reconstructRoadPath(new Map<string, RoadGraphNode<Meta>>(tree.previous), end);
  assert.deepEqual(viaMap, viaArrays);
  assert.deepEqual(viaArrays, findRoadRoute(graph, { x: 0, y: 0 }, { x: 50, y: 80 }));
  assert.equal(tree.distances.size, graph.storage.nodeCount - 2);
});

test('edge-cost callbacks see the edge being relaxed', () => {
  const seen: string[] = [];
  findRoadRoute(graph, { x: 0, y: 0 }, { x: 100, y: 0 }, ({ edge, from, to, distance }) => {
    assert.equal(edge.node.x, to.x);
    assert.equal(distance, Math.hypot(from.x - to.x, from.y - to.y));
    seen.push(`${edge.kind}:${edge.segmentMetadata.map((meta) => meta?.name)}`);
    return distance;
  });
  assert.ok(seen.includes('centreline:through'));
});

test('appendRoadGraph adds nodes and links after the existing ones and leaves the original alone', () => {
  const before = graph.storage.offsets.slice();
  const east = nearestRoadGraphNode(graph, { x: 100, y: 0 })!;
  const island = nearestRoadGraphNode(graph, { x: 300, y: 0 })!;
  const crossing = { name: '', ferryId: 'X' } as unknown as Meta;
  const n = graph.storage.nodeCount;
  const joined = appendRoadGraph(graph, {
    nodes: [{ x: 200, y: 50, key: 'ferry:9:0' }],
    links: [{ a: east.index, b: n, segmentIndex: 9, metadata: crossing }, { a: n, b: island.index, segmentIndex: 9, metadata: crossing }],
  });
  assert.deepEqual(graph.storage.offsets, before);
  assert.equal(joined.storage.nodeCount, n + 1);
  const pier = joined.nodes.get('ferry:9:0')!;
  assert.equal(pier.index, n);
  const joinedEast = roadGraphNodeAt(joined, east.index);
  assert.deepEqual(joinedEast.edges.slice(0, -1).map((edge) => edge.node.index), east.edges.map((edge) => edge.node.index));
  assert.equal(joinedEast.edges.at(-1)!.node, pier);
  assert.equal(joinedEast.edges.at(-1)!.segmentMetadata[0], crossing);
  assert.equal(findRoadRoute(graph, { x: 0, y: 0 }, { x: 340, y: 0 }).length, 0);
  assert.deepEqual(findRoadRoute(joined, { x: 0, y: 0 }, { x: 340, y: 0 }).slice(-3),
    [{ x: 200, y: 50 }, { x: 300, y: 0 }, { x: 340, y: 0 }]);
});
