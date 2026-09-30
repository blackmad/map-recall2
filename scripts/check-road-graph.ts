import assert from 'node:assert/strict';
import {
  buildRoadGraph,
  findRoadRoute,
  findRoadRouteToFirstReachable,
  planLearningRoadRoute,
  type RoadGraphEdge,
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

// Review rides: a due name is the point of the ride. The familiarity penalty
// used to push a review ride off the very (familiar, due) street it was
// chosen to review.
{
  // 'familiar' is due and slightly longer than the new street beside it.
  const reviewSegments: RoadGraphSegment<Street>[] = [
    { metadata: { id: 'novel' }, points: [{ x: 0, y: 0 }, { x: 20, y: 0 }] },
    { metadata: { id: 'familiar' }, points: [{ x: 0, y: 0 }, { x: 10, y: 5 }, { x: 20, y: 0 }] },
  ];
  const reviewGraph = buildRoadGraph(reviewSegments, { mergeSize: 1, junctionStitchRadius: 0 });
  const names = (edge: RoadGraphEdge<Street>) => edge.segmentMetadata.flatMap((street) => street?.id ?? []);
  const plain = planLearningRoadRoute(reviewGraph, { x: 0, y: 0 }, { x: 20, y: 0 }, {
    masteryForName: (name) => name === 'familiar' ? 1 : 0, namesForEdge: names,
  });
  assert.deepEqual(plain?.dueNamesOnPath, [], 'no review: nothing is due');
  assert.ok(plain?.path.every((point) => point.y === 0), 'an ordinary ride takes the new street');
  const review = planLearningRoadRoute(reviewGraph, { x: 0, y: 0 }, { x: 20, y: 0 }, {
    masteryForName: (name) => name === 'familiar' ? 1 : 0, namesForEdge: names,
    dueNames: new Set(['familiar']),
  });
  assert.deepEqual(review?.dueNamesOnPath, ['familiar'], 'a review ride rides the due street');
  assert.ok((review?.detourRatio ?? 1) <= 0.25);
  // Beyond the review cap, the shortest path stands and says what it passes.
  const far = planLearningRoadRoute(buildRoadGraph([
    { metadata: { id: 'novel' }, points: [{ x: 0, y: 0 }, { x: 20, y: 0 }] },
    { metadata: { id: 'familiar' }, points: [{ x: 0, y: 0 }, { x: 10, y: 15 }, { x: 20, y: 0 }] },
  ], { mergeSize: 1, junctionStitchRadius: 0 }), { x: 0, y: 0 }, { x: 20, y: 0 }, {
    masteryForName: () => 0, namesForEdge: names, dueNames: new Set(['familiar']),
  });
  assert.deepEqual(far?.dueNamesOnPath, [], 'a review never costs more than the cap');
}

// Review via: a due street off every landmark line is ridden through, within
// a cap, and never as an out-and-back into a dead end.
{
  const names = (edge: RoadGraphEdge<Street>) => edge.segmentMetadata.flatMap((street) => street?.id ?? []);
  const ladder = buildRoadGraph([
    { metadata: { id: 'direct' }, points: [{ x: 0, y: 0 }, { x: 40, y: 0 }] },
    { metadata: { id: 'loop' }, points: [{ x: 0, y: 0 }, { x: 10, y: 10 }, { x: 30, y: 10 }, { x: 40, y: 0 }] },
    { metadata: { id: 'stub' }, points: [{ x: 40, y: 0 }, { x: 40, y: 10 }] },
  ], { mergeSize: 1, junctionStitchRadius: 0 });
  const base = { masteryForName: () => 0, namesForEdge: names, dueNames: new Set(['stub']) };
  const plain = planLearningRoadRoute(ladder, { x: 0, y: 0 }, { x: 40, y: 0 }, base);
  assert.ok(plain?.path.every((point) => point.y === 0), 'without a via the direct street wins');
  const through = planLearningRoadRoute(ladder, { x: 0, y: 0 }, { x: 40, y: 0 }, { ...base, via: { x: 20, y: 10 } });
  assert.equal(through?.viaUsed, true, 'the loop is ridden through its middle');
  assert.ok(through?.path.some((point) => point.y === 10), 'through the via');
  assert.ok((through?.detourRatio ?? 1) <= 0.4, `within the via cap: ${through?.detourRatio}`);
  const capped = planLearningRoadRoute(ladder, { x: 0, y: 0 }, { x: 40, y: 0 }, { ...base, via: { x: 20, y: 10 }, viaDetourRatio: 0.1 });
  assert.ok(!capped?.viaUsed, 'a via past the cap leaves the direct ride');
  const deadEnd = planLearningRoadRoute(ladder, { x: 0, y: 0 }, { x: 40, y: 0 }, { ...base, via: { x: 40, y: 10 }, viaDetourRatio: 5 });
  assert.ok(!deadEnd?.viaUsed, 'a via up a dead end is not ridden out and back');
  // Touching a point lets the ride arrive and turn back when the finish lies
  // behind it; a stretch of the street is ridden along, in whichever
  // direction leads on.
  const hoop = buildRoadGraph([
    { metadata: { id: 'direct' }, points: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 30, y: 0 }, { x: 40, y: 0 }] },
    { metadata: { id: 'hoop' }, points: [{ x: 30, y: 0 }, { x: 30, y: 5 }, { x: 10, y: 8 }, { x: 10, y: 0 }] },
  ], { mergeSize: 1, junctionStitchRadius: 0 });
  const touched = planLearningRoadRoute(hoop, { x: 0, y: 0 }, { x: 40, y: 0 }, { ...base, via: { x: 30, y: 5 } });
  assert.ok(!touched?.viaUsed, 'a point beside the finish is reached and ridden back from');
  const along = planLearningRoadRoute(hoop, { x: 0, y: 0 }, { x: 40, y: 0 }, { ...base, via: [{ x: 30, y: 5 }, { x: 10, y: 8 }] });
  assert.equal(along?.viaUsed, true, 'the stretch is ridden along');
  assert.deepEqual(along?.path.map(({ x, y }) => `${x},${y}`), ['0,0', '10,0', '10,8', '30,5', '30,0', '40,0'], 'in the direction that leads on');
  const listed = planLearningRoadRoute(hoop, { x: 0, y: 0 }, { x: 40, y: 0 }, {
    ...base, via: [[{ x: 30, y: 5 }, { x: 30, y: 0 }], [{ x: 10, y: 8 }, { x: 30, y: 5 }]],
  });
  assert.deepEqual(listed?.viaStretch, [{ x: 10, y: 8 }, { x: 30, y: 5 }], 'a list is tried in turn; the stub that turns back is passed over');
  assert.equal(planLearningRoadRoute(hoop, { x: 0, y: 0 }, { x: 40, y: 0 }, { ...base, via: [] })?.viaUsed, undefined, 'an empty list is no via');
  const spur = buildRoadGraph([
    { metadata: { id: 'direct' }, points: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 30, y: 0 }, { x: 40, y: 0 }] },
    { metadata: { id: 'hoop' }, points: [{ x: 30, y: 0 }, { x: 30, y: 5 }, { x: 10, y: 8 }, { x: 10, y: 0 }] },
    { metadata: { id: 'spur' }, points: [{ x: 30, y: 5 }, { x: 34, y: 9 }] },
  ], { mergeSize: 1, junctionStitchRadius: 0 });
  const spurred = planLearningRoadRoute(spur, { x: 0, y: 0 }, { x: 40, y: 0 }, {
    ...base, viaTries: 1, via: [[{ x: 30, y: 5 }, { x: 34, y: 9 }], [{ x: 10, y: 8 }, { x: 30, y: 5 }]],
  });
  assert.deepEqual(spurred?.viaStretch, [{ x: 10, y: 8 }, { x: 30, y: 5 }], 'a dead-end stretch does not use up a try');
  const lollipop = buildRoadGraph([
    { metadata: { id: 'direct' }, points: [{ x: 0, y: 0 }, { x: 40, y: 0 }] },
    { metadata: { id: 'stem' }, points: [{ x: 20, y: 0 }, { x: 20, y: 10 }] },
    { metadata: { id: 'ring' }, points: [{ x: 20, y: 10 }, { x: 15, y: 15 }, { x: 20, y: 20 }, { x: 25, y: 15 }, { x: 20, y: 10 }] },
  ], { mergeSize: 1, junctionStitchRadius: 0 });
  const round = planLearningRoadRoute(lollipop, { x: 0, y: 0 }, { x: 40, y: 0 }, { ...base, via: { x: 20, y: 20 }, viaDetourRatio: 5 });
  assert.ok(!round?.viaUsed, 'nor round a lollipop back down its stem');
}

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
