import assert from 'node:assert/strict';
import {
  buildRoadGraph,
  findRoadRoute,
  findRoadRouteToFirstReachable,
  planLearningRoadRoute,
  type RoadGraphSegment,
} from '../src/canalRecall/routing/roadGraph';

type Street = { id: 'familiar' | 'novel' | 'connector' | 'island' };
const segments: RoadGraphSegment<Street>[] = [
  { metadata: { id: 'familiar' }, points: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 20, y: 0 }] },
  { metadata: { id: 'novel' }, points: [{ x: 0, y: 0 }, { x: 0, y: 10 }, { x: 20, y: 0 }] },
  { metadata: { id: 'island' }, points: [{ x: 100, y: 100 }, { x: 110, y: 100 }] },
];
const graph = buildRoadGraph(segments, { mergeSize: 1, junctionStitchRadius: 0 });

assert.deepEqual(
  findRoadRoute(graph, { x: 0, y: 0 }, { x: 20, y: 0 }),
  [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 20, y: 0 }],
  'default edge cost remains geometric distance',
);

const boundedSegments: RoadGraphSegment<Street>[] = [
  { metadata: { id: 'familiar' }, points: [{ x: 0, y: 0 }, { x: 20, y: 0 }] },
  { metadata: { id: 'novel' }, points: [{ x: 0, y: 0 }, { x: 10, y: 4 }, { x: 20, y: 0 }] },
];
const boundedGraph = buildRoadGraph(boundedSegments, { mergeSize: 1, junctionStitchRadius: 0 });
const learningPlan = planLearningRoadRoute(boundedGraph, { x: 0, y: 0 }, { x: 20, y: 0 }, {
  masteryForName: (name) => name === 'familiar' ? 1 : 0,
  namesForEdge: (edge) => edge.segmentMetadata.flatMap((street) => street?.id ?? []),
});
assert.equal(learningPlan?.usedLearningBias, true, 'a small detour prefers unfamiliar streets');
assert.ok((learningPlan?.detourRatio ?? 1) > 0 && (learningPlan?.detourRatio ?? 1) < 0.12);
assert.equal(learningPlan?.expectedNovelty, 1, 'novelty is measured by physical distance');

const cappedPlan = planLearningRoadRoute(graph, { x: 0, y: 0 }, { x: 20, y: 0 }, {
  familiarityPenalty: 2,
  maxDetourRatio: 0.12,
  masteryForName: (name) => name === 'familiar' ? 1 : 0,
  namesForEdge: (edge) => edge.segmentMetadata.flatMap((street) => street?.id ?? []),
});
assert.equal(cappedPlan?.usedLearningBias, false, 'an attractive but long unfamiliar route is rejected');
assert.deepEqual(cappedPlan?.path, [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 20, y: 0 }]);

// Soft home-ring bias: the outer corridor costs more, so the path hugs home.
const ringSegments: RoadGraphSegment<Street>[] = [
  { metadata: { id: 'familiar' }, points: [{ x: 0, y: 0 }, { x: 20, y: 0 }] }, // through home
  { metadata: { id: 'novel' }, points: [{ x: 0, y: 0 }, { x: 10, y: 30 }, { x: 20, y: 0 }] }, // swings far out
];
const ringGraph = buildRoadGraph(ringSegments, { mergeSize: 1, junctionStitchRadius: 0 });
const ringPlan = planLearningRoadRoute(ringGraph, { x: 0, y: 0 }, { x: 20, y: 0 }, {
  masteryForName: () => 0,
  namesForEdge: (edge) => edge.segmentMetadata.flatMap((street) => street?.id ?? []),
  homeBias: { x: 10, y: 0, radius: 8, outsidePenalty: 2 },
  maxDetourRatio: 0.5,
});
assert.ok(ringPlan, 'home bias still finds a path');
assert.ok(
  (ringPlan?.path.every((point) => Math.abs(point.y) < 1) ?? false),
  'home bias prefers the corridor through the ring over a far swing',
);

const noBiasSame = planLearningRoadRoute(ringGraph, { x: 0, y: 0 }, { x: 20, y: 0 }, {
  masteryForName: () => 0,
  namesForEdge: (edge) => edge.segmentMetadata.flatMap((street) => street?.id ?? []),
});
assert.ok(noBiasSame, 'omitting homeBias keeps planning working');

const noveltyRoute = findRoadRoute(
  graph,
  { x: 0, y: 0 },
  { x: 20, y: 0 },
  ({ edge, distance }) => distance + (edge.segmentMetadata.some((street) => street?.id === 'familiar') ? 20 : 0),
);
assert.deepEqual(
  noveltyRoute,
  [{ x: 0, y: 0 }, { x: 0, y: 10 }, { x: 20, y: 0 }],
  'an injected familiarity penalty can prefer a reasonable novel route',
);

const firstReachable = findRoadRouteToFirstReachable(
  graph,
  { x: 0, y: 0 },
  [{ x: 110, y: 100 }, { x: 20, y: 0 }],
);
assert.equal(firstReachable?.index, 1, 'candidate selection skips disconnected destinations');
assert.deepEqual(firstReachable?.path.at(-1), { x: 20, y: 0 });

const tJunction: RoadGraphSegment<Street>[] = [
  { metadata: { id: 'connector' }, points: [{ x: 0, y: 0 }, { x: 100, y: 0 }] },
  { metadata: { id: 'novel' }, points: [{ x: 50, y: 8 }, { x: 50, y: 50 }] },
];
const unstitched = buildRoadGraph(tJunction, { mergeSize: 1, junctionStitchRadius: 7 });
assert.deepEqual(
  findRoadRoute(unstitched, { x: 50, y: 50 }, { x: 100, y: 0 }),
  [],
  'a visible but separated T-junction is unreachable outside the stitch radius',
);
const stitched = buildRoadGraph(tJunction, { mergeSize: 18, junctionStitchRadius: 8 });
assert.deepEqual(
  findRoadRoute(stitched, { x: 50, y: 50 }, { x: 100, y: 0 }),
  [{ x: 50, y: 50 }, { x: 50, y: 8 }, { x: 50, y: 0 }, { x: 100, y: 0 }],
  'a Westermarkt-style T-junction joins at its centreline projection instead of cutting the corner',
);

assert.throws(
  () => findRoadRoute(graph, { x: 0, y: 0 }, { x: 20, y: 0 }, () => -1),
  /non-negative/,
  'negative novelty costs cannot invalidate Dijkstra',
);

process.stdout.write('Road graph checks passed (distance routing, injectable novelty cost, reachability, T-junction stitching).\n');
