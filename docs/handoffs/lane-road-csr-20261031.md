# Lane: the road graph as flat arrays (CSR)

Rules: `LANE-RULES.md`. Programme: `engine-programme-20261030.md` §P3
(L4 step 5). Model: opus. Port: 4543. Branch `lane/road-csr-20261031` from
`origin/main`, worktree
`/Users/blackmad/Code/map-recall2-worktrees/road-csr-20261031`
(`scripts/worktrees/new.sh lane/road-csr-20261031 <that dir> 4543`).

## Why

At ride start the road stack owns ~125 MB of the desktop main heap, the
road graph alone 54 MB, 35 MB of it the graph builder's node and edge
objects (L4's `HEAP_OWNERS=1` run, #136, 2026-10-31). The world path now
sits at 303 MB main at ride start; the next third of the heap is roads.
Gates: road-graph heap ≤ 30 MB, time to ride ≤ 4 s (today 7.5 s budget),
`npm run test:canal-car` and `npm run test:reachability` green, routes
identical.

## Shape

`src/canalRecall/routing/roadGraph.ts` builds `RoadGraph<TMetadata>` with
`RoadGraphNode { key, x, y, edges[] }` and `RoadGraphEdge { node, distance,
kind, segmentIndexes[], segmentMetadata[] }` (l.10–30), plus connectors.
Replace the storage, not the API:

- `Int32Array offsets` (nodes+1) and `Int32Array targets` (edges),
  `Float32Array x, y` (nodes), `Float32Array distance` (edges), `Uint8Array
  kind` (edges), a link→segments table (`Int32Array segOffsets`, `Int32Array
  segIndexes`), and one `metadata` array indexed by segment (shared, not
  copied per edge).
- Node keys: keep a `Map<string, number>` only if a caller needs key
  lookup; otherwise derive the key from quantised x/y on demand.
- Lightweight node and edge *views* (small objects created on access, or an
  index-based API) behind the current function signatures
  (`nearestRoadGraphNode`, `shortestRoadPaths`, `reconstructRoadPath`,
  `findRoadRoute`, `findRoadRouteToFirstReachable`), so callers move one at
  a time. Dijkstra runs on the typed arrays with a binary heap of indices.
- `buildRoadGraph` / `buildRoadGraphAsync` keep their batched build
  scheduling (`buildScheduling.ts`); the build may use temporary object
  maps but must release them (the gate is the *resident* graph).

## Callers to move (each one a commit, routes diffed before/after)

`roadGraph.ts`'s own routers; `src/canalRecall/ferry/network.ts`
`connectFerryGraph` (adds nodes and edges after the build: give CSR an
append path or build ferries into the same arrays); `src/canalRecall/
ownGround/route.ts`; `public/canal-drive/js/road-network.js`
(`edge.segmentMetadata` at l.401 and neighbours: read through a view);
`src/canalRecall/cityAppearanceRoute.ts`; `scripts/check-road-graph.ts`,
`scripts/check-transit-routing.ts`, `scripts/building-recipes/
ride-visibility.ts`, `scripts/check-canal-car.ts`, `scripts/
check-road-reachability.ts`.

## Measure

`HEAP_OWNERS=1 node scripts/motion-stutter.mjs …` with unminified bundles,
before and after (the road graph's owner line, the whole road stack, main
heap at ride start); `scripts/heap-sample.mjs` for the GC-forced numbers;
time to ride from `tests/e2e/intro-perf.spec.ts` or the ride-perf owners
script, 3 runs each. Route identity: `test:canal-car` plus a script that
plans the 20 named routes in `check-canal-car.ts` before and after and
asserts equal node sequences.

## Checks

`npm run lint`; `npm run test:canal-car`; `npm run test:reachability`;
`node --import tsx --test src/canalRecall/routing/*.test.ts
src/canalRecall/ferry/*.test.ts`; `npm run test:city-startup`; under the
lock `PW_PORT=4543 /tmp/canal-pw.sh npx playwright test start-heading
ferry-centraal-pier answered-street-name --project=desktop --workers=1
--trace off` and `intro-perf --project=desktop`.

## Hand back

The block from `LANE-RULES.md`; heap table (road graph, road stack, main)
before/after; time-to-ride 3-run medians; the route-identity result; which
bundles the integrator rebuilds (likely `build:canal-ui`/game bundles that
include routing, and `build:canal-3d`).
