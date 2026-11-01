import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { appendRoadGraph, buildRoadGraph, findRoadRoute, shortestRoadPaths, type RoadGraph } from './roadGraph.ts';
import { buildRoadSpatialIndex, roadsNear } from './roadSurface.ts';
import {
  ROAD_WORLD_CACHE_VERSION, packRoadWorld, roadSegmentsFingerprint, unpackRoadWorld, type PackedRoadWorld,
} from './roadWorldCache.ts';

type Meta = { segmentIndex: number; name: string; wayId: string };
// A plus whose side arm stops short of the through street (stitched), a merged near-end, an island, and a ferry
// link appended afterwards (extra keys, link metadata), as road-network.js builds them.
const segments = [
  { points: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 200, y: 0 }], width: 18, name: 'through', wayId: 'w1', type: 'residential' },
  { points: [{ x: 50, y: 4 }, { x: 50, y: 80 }], width: 13, name: 'side', wayId: 'w2', type: 'service' },
  { points: [{ x: 202, y: 1 }, { x: 260, y: 40 }], width: 9, name: 'near end', wayId: 'w3', type: 'cycleway' },
  { points: [{ x: 300, y: 0 }, { x: 340, y: 0 }], width: 18, name: 'island', wayId: 'w4', type: 'residential' },
];
const metadata: Meta[] = segments.map((s, segmentIndex) => ({ segmentIndex, name: s.name, wayId: s.wayId }));
const routing = segments.map((s, i) => ({ points: s.points, width: s.width, metadata: metadata[i] }));

function build(): { graph: RoadGraph<Meta>; surface: ReturnType<typeof buildRoadSpatialIndex> } {
  const street = buildRoadGraph<Meta>(routing, { mergeSize: 6, junctionStitchRadius: 6 });
  const n = street.storage.nodeCount;
  const graph = appendRoadGraph(street, {
    nodes: [{ x: 320, y: -60, key: 'ferry:9:0' }],
    links: [{ a: n - 1, b: n, segmentIndex: 3, metadata: { segmentIndex: 3, name: '', wayId: 'ferry' } }],
  });
  return { graph, surface: buildRoadSpatialIndex(segments, 100, graph.connectors) };
}

const fingerprint = roadSegmentsFingerprint(segments);
const roundTrip = (record: PackedRoadWorld) => structuredClone(record);

test('a stored build restores to the same graph, routes and surface queries', () => {
  const { graph, surface } = build();
  const record = roundTrip(packRoadWorld(graph, surface, fingerprint, segments));
  const restored = unpackRoadWorld(record, fingerprint, metadata, segments);
  assert.ok(restored, 'restores');
  const nodesOf = (g: RoadGraph<Meta>) => g.allNodes.map(n => [n.key, n.x, n.y, n.edges.map(e => [e.node.key, e.distance, e.kind, e.segmentIndexes, e.segmentMetadata])]);
  assert.deepEqual(nodesOf(restored.graph), nodesOf(graph));
  assert.deepEqual(restored.graph.connectors, graph.connectors);
  for (const [a, b] of [[{ x: 0, y: 0 }, { x: 50, y: 80 }], [{ x: 0, y: 0 }, { x: 260, y: 40 }], [{ x: 340, y: 0 }, { x: 320, y: -60 }]]) {
    assert.deepEqual(findRoadRoute(restored.graph, a, b), findRoadRoute(graph, a, b));
  }
  const start = restored.graph.allNodes[0];
  assert.deepEqual([...shortestRoadPaths(restored.graph, start)!.dist], [...shortestRoadPaths(graph, graph.allNodes[0])!.dist]);
  // A connector that starts on a way's own point (a stitched end; a ferry terminal with its stop's fields) gets
  // that same object back.
  const shared = graph.connectors.map(c => segments.some(s => s.points.includes(c.a)));
  assert.ok(shared.some(Boolean), 'fixture: a connector starts on a way point');
  graph.connectors.forEach((c, k) => { if (shared[k]) assert.equal(restored.graph.connectors[k].a, c.a); });
  for (const [x, y] of [[0, 0], [50, 40], [201, 0], [330, 5], [-500, -500]]) {
    assert.deepEqual(roadsNear(restored.surface, x, y, 1), roadsNear(surface, x, y, 1));
  }
});

test('the fingerprint covers every field either build reads', () => {
  const change = (f: (s: typeof segments) => void) => { const copy = structuredClone(segments); f(copy); return roadSegmentsFingerprint(copy); };
  assert.equal(roadSegmentsFingerprint(structuredClone(segments)), fingerprint);
  assert.notEqual(change(s => { s[1].points[0].x += 1e-9; }), fingerprint);
  assert.notEqual(change(s => { s[1].width = 14; }), fingerprint);
  assert.notEqual(change(s => { s[2].name = 'other'; }), fingerprint);
  assert.notEqual(change(s => { s[2].wayId = 'w9'; }), fingerprint);
  assert.notEqual(change(s => { s[3].type = 'ferry'; }), fingerprint);
  assert.notEqual(change(s => { s.pop(); }), fingerprint);
  assert.notEqual(change(s => { (s[0] as { ferryLink?: { id: string } }).ferryLink = { id: 'F3' }; }), fingerprint);
});

test('a record for other segments, another version or with broken arrays is refused, never thrown', () => {
  const { graph, surface } = build();
  const good = () => roundTrip(packRoadWorld(graph, surface, fingerprint, segments));
  assert.equal(unpackRoadWorld(good(), 'ffffffffffffffff', metadata, segments), null, 'fingerprint');
  assert.equal(unpackRoadWorld({ ...good(), version: ROAD_WORLD_CACHE_VERSION + 1 }, fingerprint, metadata, segments), null, 'version');
  assert.equal(unpackRoadWorld(good(), fingerprint, metadata.slice(1), segments.slice(1)), null, 'segment count');
  for (const value of [null, undefined, 7, 'x', {}, { version: ROAD_WORLD_CACHE_VERSION, fingerprint }]) {
    assert.equal(unpackRoadWorld(value, fingerprint, metadata, segments), null, `junk ${JSON.stringify(value)}`);
  }
  const broken: [string, (r: PackedRoadWorld) => void][] = [
    ['short x', r => { r.graph.x = r.graph.x.slice(1); }],
    ['target out of range', r => { r.graph.targets[0] = r.graph.nodeCount; }],
    ['offsets decrease', r => { r.graph.offsets[1] = r.graph.offsets[2] + 1; }],
    ['offsets end', r => { r.graph.offsets[r.graph.offsets.length - 1] -= 1; }],
    ['edge link out of range', r => { r.graph.edgeLink[0] = -1; }],
    ['link segment out of range', r => { r.graph.linkSegIndexes[0] = segments.length; }],
    ['extra key missing', r => { r.graph.extraKeys.clear(); }],
    ['connector ends', r => { r.graph.connectorEnds = r.graph.connectorEnds.slice(1); }],
    ['typed array swapped for a list', r => { (r.graph as unknown as { y: number[] }).y = [...r.graph.y]; }],
    ['cell keys unsorted', r => { r.surface.keys.reverse(); }],
    ['cell span id out of range', r => { r.surface.ids[0] = r.surface.spanSeg.length; }],
    ['span point past its way', r => { r.surface.spanPt[0] = 99; }],
    ['span connector missing', r => { r.surface.spanPt[0] = -1 - r.graph.connectorSeg.length; }],
  ];
  for (const [what, breakIt] of broken) {
    const record = good();
    breakIt(record);
    assert.equal(unpackRoadWorld(record, fingerprint, metadata, segments), null, what);
  }
});

// What the builds output, for ROAD_WORLD_CACHE_VERSION. If this fails, the graph or surface build now outputs
// something else: a device would restore a stale build from its cache. Bump ROAD_WORLD_CACHE_VERSION and record
// the new hash here, together.
const PACKED_HASH_FOR_VERSION: Record<number, string> = {
  1: 'cc45a310b19dda72',
};

test('the cache version is bumped whenever the builds change their output', () => {
  const { graph, surface } = build();
  const r = packRoadWorld(graph, surface, fingerprint, segments);
  const plain = (v: unknown): unknown => (ArrayBuffer.isView(v) ? Array.from(v as unknown as ArrayLike<number>)
    : v instanceof Map ? [...v].map(([k, x]) => [k, plain(x)])
      : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, plain(x)])) : v);
  const hash = createHash('sha256').update(JSON.stringify(plain({ graph: r.graph, surface: r.surface }))).digest('hex').slice(0, 16);
  assert.equal(hash, PACKED_HASH_FOR_VERSION[ROAD_WORLD_CACHE_VERSION], `packed fixture hash ${hash}`);
});

test('no IndexedDB (node, a locked-down browser) is a miss, not an error', async () => {
  const { readRoadWorld, writeRoadWorld, clearRoadWorlds } = await import('./roadWorldCache.ts');
  assert.equal((globalThis as { indexedDB?: unknown }).indexedDB, undefined);
  const { graph, surface } = build();
  assert.equal(await readRoadWorld('k'), null);
  assert.equal(await writeRoadWorld('k', packRoadWorld(graph, surface, fingerprint, segments)), false);
  assert.equal(await clearRoadWorlds(), false);
});
