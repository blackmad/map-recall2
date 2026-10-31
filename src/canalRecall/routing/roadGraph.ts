import { finishBatchedBuild, type BuildScheduling } from '../buildScheduling.ts';
export type RoadGraphPoint = Readonly<{ x: number; y: number }>;

export type RoadGraphSegment<TMetadata = unknown> = Readonly<{
  points: readonly RoadGraphPoint[];
  width?: number;
  metadata?: TMetadata;
}>;

/**
 * A node of the graph, as a view over the flat storage (`RoadGraphStorage`).
 * Views handed out by `nearestRoadGraphNode`, `edges[].node`, `allNodes` and
 * `nodes` are cached per index, so the same node is always the same object.
 */
export type RoadGraphNode<TMetadata = unknown> = {
  readonly key: string;
  readonly x: number;
  readonly y: number;
  /** Position in `RoadGraphStorage` (build order). */
  readonly index: number;
  /** A fresh array of edge views on each read. */
  readonly edges: readonly RoadGraphEdge<TMetadata>[];
};

export type RoadGraphEdge<TMetadata = unknown> = {
  readonly node: RoadGraphNode<TMetadata>;
  readonly distance: number;
  readonly kind: 'centreline' | 'junction-stitch';
  /** All source segments represented by this link, in input order. */
  readonly segmentIndexes: readonly number[];
  readonly segmentMetadata: readonly (TMetadata | undefined)[];
};

/**
 * A piece of the graph that no centreline covers: an endpoint merged onto a
 * node a few metres away, or a side street stitched onto a through street.
 * The router plans across these, so the road surface must be rideable there
 * too (see `buildRoadSpatialIndex`'s `connectors`).
 */
export type RoadGraphConnector = Readonly<{
  a: RoadGraphPoint;
  b: RoadGraphPoint;
  segmentIndex: number;
}>;

/**
 * The graph as flat arrays (compressed sparse rows), issue #136: the object
 * graph (a node object, an edge object per direction and a key string per
 * node) held 35 MB of the desktop main heap at ride start; this holds the
 * same topology in typed arrays. A *link* is one undirected edge; its two
 * directed edges share its distance, kind and segment list.
 *
 * Node `i`'s edges are `targets[offsets[i] .. offsets[i + 1])`, in the order
 * the object graph pushed them, so Dijkstra's tie-breaking is unchanged.
 */
export type RoadGraphStorage<TMetadata = unknown> = {
  readonly mergeSize: number;
  readonly nodeCount: number;
  readonly x: Float64Array;
  readonly y: Float64Array;
  /** 0: key is the quantised x/y (`"qx,qy"`), 1: `junction:<index>`, 2: `extraKeys`. */
  readonly keyKind: Uint8Array;
  readonly extraKeys: ReadonlyMap<number, string>;
  readonly offsets: Int32Array;
  readonly targets: Int32Array;
  /** The link each directed edge belongs to. */
  readonly edgeLink: Int32Array;
  readonly linkDistance: Float64Array;
  /** Index into `EDGE_KINDS`. */
  readonly linkKind: Uint8Array;
  /** Link `l`'s segments are `linkSegIndexes[linkSegOffsets[l] .. linkSegOffsets[l + 1])`. */
  readonly linkSegOffsets: Int32Array;
  readonly linkSegIndexes: Int32Array;
  /** Segment metadata by segment index, shared by every link of that segment. */
  readonly metadata: readonly (TMetadata | undefined)[];
  /** Appended links (`appendRoadGraph`) carry their own metadata, by link. */
  readonly linkMetadata: ReadonlyMap<number, TMetadata | undefined>;
  /** Node views handed out so far (identity), and the key lookup table, built on first use. */
  views: Map<number, RoadGraphNode<TMetadata>>;
  keyTable: Int32Array | null;
};

export type RoadGraph<TMetadata = unknown> = Readonly<{
  /** Key lookup over the storage; no resident string map. */
  nodes: ReadonlyMap<string, RoadGraphNode<TMetadata>>;
  /** Every node as a view, in build order. Creates a view per node: tests and diagnostics, not the runtime. */
  allNodes: readonly RoadGraphNode<TMetadata>[];
  connectors: readonly RoadGraphConnector[];
  storage: RoadGraphStorage<TMetadata>;
}>;

export type RoadGraphBuildOptions = Readonly<{
  /** Quantization used to merge nearly coincident OSM vertices. */
  mergeSize?: number;
  /** Maximum distance for restoring a simplified-away T-junction. */
  junctionStitchRadius?: number;
  /** Spatial-index cell size used only while constructing the graph. */
  gridCellSize?: number;
  /** Extra spatial-index padding around a centreline, matching the runtime. */
  gridPadding?: number;
}>;

/**
 * `edge`, `from` and `to` are cursors over the storage, reused for every
 * edge: read them inside the call, do not keep them.
 */
export type RoadGraphEdgeCost<TMetadata = unknown> = (context: Readonly<{
  edge: RoadGraphEdge<TMetadata>;
  from: RoadGraphNode<TMetadata>;
  to: RoadGraphNode<TMetadata>;
  /** Geometric edge length and the cost used when no callback is supplied. */
  distance: number;
}>) => number;

export type LearningRouteOptions<TMetadata = unknown> = Readonly<{
  /** 0..1 familiarity for a named feature; absent names are new. */
  masteryForName(name: string): number;
  namesForEdge(edge: RoadGraphEdge<TMetadata>): readonly string[];
  /** Maximum cost added to a fully mastered edge. Defaults to 18%. */
  familiarityPenalty?: number;
  /** Maximum extra physical distance accepted. Defaults to 12%. */
  maxDetourRatio?: number;
  /**
   * Soft home-ring bias: edges whose midpoint sits outside `radius` (world px)
   * pay up to `outsidePenalty` extra (default 25%). Omitted = no geo bias.
   */
  homeBias?: Readonly<{
    x: number;
    y: number;
    radius: number;
    outsidePenalty?: number;
  }>;
  /**
   * A review ride: names due for review. Their edges are discounted by
   * `dueDiscount` (default 35%) instead of paying the familiarity penalty,
   * which would otherwise steer a review ride away from exactly the streets
   * it was chosen to review. The detour cap widens to `reviewDetourRatio`
   * (default 25%) when any are given.
   */
  dueNames?: ReadonlySet<string>;
  dueDiscount?: number;
  reviewDetourRatio?: number;
  /**
   * A review ride's waypoint: a due street that no line between two landmarks
   * passes. The ride is planned start → via → finish and kept only if it is at
   * most `viaDetourRatio` (default 40%) longer than the shortest direct ride,
   * and does not turn back on itself at the via (a cul-de-sac). Otherwise the
   * direct plan stands. A pair of points is a stretch of street to ride
   * along, in either direction: touching a single point lets the ride arrive
   * and turn straight back when the finish lies behind it. A list of
   * stretches is tried in order, and the first that can be ridden is kept.
   */
  via?: RoadGraphPoint | ViaStretch | readonly ViaStretch[];
  viaDetourRatio?: number;
  /** Stretches planned at most, after those ending in a dead end are
   *  dropped (default 3): each try plans three legs per direction. */
  viaTries?: number;
}>;

/** Two points on one street, ridden from one to the other in either order. */
export type ViaStretch = readonly [RoadGraphPoint, RoadGraphPoint];

export type LearningRoutePlan = Readonly<{
  path: readonly RoadGraphPoint[];
  /** Fraction of physical route distance on names below 50% mastery. */
  expectedNovelty: number;
  physicalDistance: number;
  shortestDistance: number;
  detourRatio: number;
  usedLearningBias: boolean;
  /** Due names the chosen path rides along (review rides; empty otherwise). */
  dueNamesOnPath: readonly string[];
  /** True when the path goes through `options.via`. */
  viaUsed?: boolean;
  /** The stretch ridden, in riding order, when `via` offered stretches. */
  viaStretch?: ViaStretch;
}>;

export type ShortestPathOptions<TMetadata = unknown> = Readonly<{
  stopAt?: RoadGraphNode<TMetadata> | null;
  /**
   * Supplies the complete non-negative edge cost. Returning `distance`
   * preserves normal shortest-distance routing; callers can add a bounded
   * familiarity penalty without teaching the graph about player state.
   */
  edgeCost?: RoadGraphEdgeCost<TMetadata>;
}>;

export type ShortestPathTree<TMetadata = unknown> = Readonly<{
  start: RoadGraphNode<TMetadata>;
  distances: ReadonlyMap<string, number>;
  previous: ReadonlyMap<string, RoadGraphNode<TMetadata>>;
  /** The same tree by node index: cost (Infinity when unreached) and predecessor (-1 for none). */
  dist: Float64Array;
  prev: Int32Array;
}>;


const DEFAULT_MERGE_SIZE = 18;
const DEFAULT_STITCH_RADIUS = 10;
const DEFAULT_GRID_CELL_SIZE = 100;
const DEFAULT_GRID_PADDING = 10;
const EDGE_KINDS = ['centreline', 'junction-stitch'] as const;
const KIND_CENTRELINE = 0;
const KIND_STITCH = 1;

const distanceBetween = (a: RoadGraphPoint, b: RoadGraphPoint): number =>
  Math.hypot(a.x - b.x, a.y - b.y);

const closestPointOnSegment = (point: RoadGraphPoint, a: RoadGraphPoint, b: RoadGraphPoint) => {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const lengthSquared = abx * abx + aby * aby;
  if (lengthSquared === 0) return { x: a.x, y: a.y, distance: distanceBetween(point, a) };
  const t = Math.max(0, Math.min(1, ((point.x - a.x) * abx + (point.y - a.y) * aby) / lengthSquared));
  const x = a.x + abx * t;
  const y = a.y + aby * t;
  return { x, y, distance: Math.hypot(point.x - x, point.y - y) };
};

type IndexedSpan = Readonly<{
  a: RoadGraphPoint;
  b: RoadGraphPoint;
  segmentIndex: number;
  /** Position in build order, for de-duplicating spans that sit in several grid cells. */
  id: number;
}>;

/**
 * Integer grid coordinates as one exact number key: string keys (`"x,y"`) cost
 * a string per lookup, and the build looks up two per span and nine cells per
 * endpoint (time to ride, #136). Out of range falls back to the string.
 */
const CELL_LIMIT = 2 ** 25;
const cellKey = (gx: number, gy: number): number | string =>
  Math.abs(gx) < CELL_LIMIT && Math.abs(gy) < CELL_LIMIT ? (gx + CELL_LIMIT) * 2 ** 26 + (gy + CELL_LIMIT) : `${gx},${gy}`;

/**
 * The graph under construction: plain arrays that grow, released when the
 * build returns. Node `i`'s adjacency is `adjacency[i]` as flat
 * `[neighbour, link, neighbour, link, ...]` pairs in push order.
 */
type GraphBuilder = {
  x: number[];
  y: number[];
  keyKind: number[];
  extraKeys: Map<number, string>;
  adjacency: number[][];
  linkDistance: number[];
  linkKind: number[];
  /** A link's first segment, and any further ones (rare) in input order. */
  linkSeg0: number[];
  linkSegMore: Map<number, number[]>;
};

const newBuilder = (): GraphBuilder => ({
  x: [], y: [], keyKind: [], extraKeys: new Map(), adjacency: [],
  linkDistance: [], linkKind: [], linkSeg0: [], linkSegMore: new Map(),
});

const builderAddNode = (builder: GraphBuilder, x: number, y: number, keyKind: number): number => {
  const index = builder.x.length;
  builder.x.push(x);
  builder.y.push(y);
  builder.keyKind.push(keyKind);
  builder.adjacency.push([]);
  return index;
};

const builderAddLink = (builder: GraphBuilder, a: number, b: number, distance: number, kind: number, segmentIndex: number): void => {
  const link = builder.linkDistance.length;
  builder.linkDistance.push(distance);
  builder.linkKind.push(kind);
  builder.linkSeg0.push(segmentIndex);
  builder.adjacency[a].push(b, link);
  builder.adjacency[b].push(a, link);
};

/** The storage of a finished build, in node (and per-node edge) order. */
function freezeBuilder<TMetadata>(builder: GraphBuilder, mergeSize: number, metadata: readonly (TMetadata | undefined)[]): RoadGraphStorage<TMetadata> {
  const nodeCount = builder.x.length;
  const offsets = new Int32Array(nodeCount + 1);
  for (let i = 0; i < nodeCount; i++) offsets[i + 1] = offsets[i] + builder.adjacency[i].length / 2;
  const targets = new Int32Array(offsets[nodeCount]);
  const edgeLink = new Int32Array(offsets[nodeCount]);
  for (let i = 0; i < nodeCount; i++) {
    const pairs = builder.adjacency[i];
    for (let k = 0, e = offsets[i]; k < pairs.length; k += 2, e++) {
      targets[e] = pairs[k];
      edgeLink[e] = pairs[k + 1];
    }
  }
  const linkCount = builder.linkDistance.length;
  const linkSegOffsets = new Int32Array(linkCount + 1);
  for (let l = 0; l < linkCount; l++) linkSegOffsets[l + 1] = linkSegOffsets[l] + 1 + (builder.linkSegMore.get(l)?.length ?? 0);
  const linkSegIndexes = new Int32Array(linkSegOffsets[linkCount]);
  for (let l = 0; l < linkCount; l++) {
    let at = linkSegOffsets[l];
    linkSegIndexes[at++] = builder.linkSeg0[l];
    for (const more of builder.linkSegMore.get(l) ?? []) linkSegIndexes[at++] = more;
  }
  return {
    mergeSize, nodeCount,
    x: Float64Array.from(builder.x),
    y: Float64Array.from(builder.y),
    keyKind: Uint8Array.from(builder.keyKind),
    extraKeys: builder.extraKeys,
    offsets, targets, edgeLink,
    linkDistance: Float64Array.from(builder.linkDistance),
    linkKind: Uint8Array.from(builder.linkKind),
    linkSegOffsets, linkSegIndexes,
    metadata,
    linkMetadata: new Map(),
    views: new Map(),
    keyTable: null,
  };
}

/** Build the topology shared by every route query against one road network. */
function* roadGraphStages<TMetadata>(
  segments: readonly RoadGraphSegment<TMetadata>[],
  options: RoadGraphBuildOptions,
): Generator<void, RoadGraph<TMetadata>> {
  const mergeSize = options.mergeSize ?? DEFAULT_MERGE_SIZE;
  const junctionStitchRadius = options.junctionStitchRadius ?? DEFAULT_STITCH_RADIUS;
  const gridCellSize = options.gridCellSize ?? DEFAULT_GRID_CELL_SIZE;
  const gridPadding = options.gridPadding ?? DEFAULT_GRID_PADDING;
  if (!(mergeSize > 0) || !(junctionStitchRadius >= 0) || !(gridCellSize > 0) || !(gridPadding >= 0)) {
    throw new RangeError('Road graph dimensions must be finite and non-negative');
  }

  const builder = newBuilder();
  const { x: xs, y: ys, adjacency } = builder;
  const nodeIndex = new Map<number | string, number>();
  const connectors: RoadGraphConnector[] = [];
  // Below this a merge is the same vertex; above it the gap is rideable only
  // through a connector span.
  const CONNECTOR_MIN = 0.5;
  const spanGrid = new Map<number | string, IndexedSpan[]>();
  let spanCount = 0;
  // Junction projections use string keys ('junction:...'), so they never meet these.
  const keyFor = (point: RoadGraphPoint): number | string =>
    cellKey(Math.round(point.x / mergeSize), Math.round(point.y / mergeSize));
  const nodeFor = (point: RoadGraphPoint, segmentIndex = -1): number => {
    const key = keyFor(point);
    let node = nodeIndex.get(key);
    if (node === undefined) {
      node = builderAddNode(builder, point.x, point.y, 0);
      nodeIndex.set(key, node);
    } else if (segmentIndex >= 0 && Math.hypot(point.x - xs[node], point.y - ys[node]) > CONNECTOR_MIN) {
      // Merged onto another way's vertex up to a cell diagonal away (25 px at
      // mergeSize 18): the route jumps the gap, so the surface must span it.
      connectors.push({ a: point, b: { x: xs[node], y: ys[node] }, segmentIndex });
    }
    return node;
  };
  const projectionNodeFor = (point: RoadGraphPoint, span: IndexedSpan): number => {
    // A junction projection must retain its exact place on the through
    // centreline. Reusing the normal quantized node can merge it with the side
    // street endpoint we are trying to connect, putting the "junction" several
    // metres off the through road and recreating the diagonal corner cut.
    const key = [
      'junction',
      span.segmentIndex,
      span.a.x,
      span.a.y,
      span.b.x,
      span.b.y,
      point.x,
      point.y,
    ].join(':');
    let node = nodeIndex.get(key);
    if (node === undefined) {
      node = builderAddNode(builder, point.x, point.y, 1);
      nodeIndex.set(key, node);
    }
    return node;
  };
  /** The first link from `a` to `b`, or -1. */
  const linkFrom = (a: number, b: number): number => {
    const pairs = adjacency[a];
    for (let k = 0; k < pairs.length; k += 2) if (pairs[k] === b) return pairs[k + 1];
    return -1;
  };
  const linkHas = (link: number, segmentIndex: number): boolean =>
    builder.linkSeg0[link] === segmentIndex || !!builder.linkSegMore.get(link)?.includes(segmentIndex);
  const linkPush = (link: number, segmentIndex: number): void => {
    const more = builder.linkSegMore.get(link);
    if (more) more.push(segmentIndex);
    else builder.linkSegMore.set(link, [segmentIndex]);
  };
  const link = (a: number, b: number, segmentIndex: number, kind: number): void => {
    if (a === b) return;
    const existingForward = linkFrom(a, b);
    const existingReverse = linkFrom(b, a);
    if (existingForward >= 0 && existingReverse >= 0) {
      if (!linkHas(existingForward, segmentIndex)) {
        linkPush(existingForward, segmentIndex);
        // The two directions of a link share one segment list; push once.
        if (existingReverse !== existingForward) linkPush(existingReverse, segmentIndex);
      }
      return;
    }
    builderAddLink(builder, a, b, Math.hypot(xs[a] - xs[b], ys[a] - ys[b]), kind, segmentIndex);
  };
  const addSpanToGrid = (span: IndexedSpan, width: number): void => {
    const pad = width + gridPadding;
    const gx0 = Math.floor((Math.min(span.a.x, span.b.x) - pad) / gridCellSize);
    const gx1 = Math.floor((Math.max(span.a.x, span.b.x) + pad) / gridCellSize);
    const gy0 = Math.floor((Math.min(span.a.y, span.b.y) - pad) / gridCellSize);
    const gy1 = Math.floor((Math.max(span.a.y, span.b.y) + pad) / gridCellSize);
    for (let gx = gx0; gx <= gx1; gx++) {
      for (let gy = gy0; gy <= gy1; gy++) {
        const key = cellKey(gx, gy);
        const bucket = spanGrid.get(key) ?? [];
        bucket.push(span);
        spanGrid.set(key, bucket);
      }
    }
  };

  for (let segmentIndex = 0; segmentIndex < segments.length; segmentIndex++) {
    const segment = segments[segmentIndex];
    for (let pointIndex = 1; pointIndex < segment.points.length; pointIndex++) {
      const a = segment.points[pointIndex - 1];
      const b = segment.points[pointIndex];
      const from = nodeFor(a, segmentIndex);
      const to = nodeFor(b, segmentIndex);
      link(from, to, segmentIndex, KIND_CENTRELINE);
      // A merged end sits up to a cell diagonal off its vertex, so the edge
      // the router plans along runs beside the span, not on it: over a long
      // span the planned line left the corridor by ~5 px mid-way (route
      // coverage, 2026-10-01: an unnamed way in Westpoort, Geldershoofd).
      // Cover the edge as planned, too.
      if (Math.hypot(a.x - xs[from], a.y - ys[from]) > CONNECTOR_MIN || Math.hypot(b.x - xs[to], b.y - ys[to]) > CONNECTOR_MIN) {
        connectors.push({ a: { x: xs[from], y: ys[from] }, b: { x: xs[to], y: ys[to] }, segmentIndex });
      }
      addSpanToGrid({ a, b, segmentIndex, id: spanCount++ }, segment.width ?? 0);
    }
    if (segmentIndex % 32 === 0) yield;
  }

  const spansNear = (point: RoadGraphPoint): IndexedSpan[] => {
    const gx = Math.floor(point.x / gridCellSize);
    const gy = Math.floor(point.y / gridCellSize);
    // A long/wide span belongs to several cells. Stitch it once per endpoint;
    // repeated projections added identical links and duplicate surface connectors.
    // First-seen order across the nine cells, as a Set gave, with a stamp per span instead.
    stamp++;
    const found: IndexedSpan[] = [];
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const bucket = spanGrid.get(cellKey(gx + dx, gy + dy));
        if (!bucket) continue;
        for (const span of bucket) {
          if (seen[span.id] === stamp) continue;
          seen[span.id] = stamp;
          found.push(span);
        }
      }
    }
    return found;
  };
  const seen = new Int32Array(spanCount);
  let stamp = 0;
  // Beyond the radius plus a hair on either axis, the projection is too: skip it.
  const reach = junctionStitchRadius + 1e-6;

  for (let segmentIndex = 0; segmentIndex < segments.length; segmentIndex++) {
    const segment = segments[segmentIndex];
    if (segment.points.length < 2) continue;
    const endpoints = [segment.points[0], segment.points[segment.points.length - 1]];
    for (const endpoint of endpoints) {
      const from = nodeIndex.get(keyFor(endpoint));
      if (from === undefined) continue;
      for (const span of spansNear(endpoint)) {
        if (span.segmentIndex === segmentIndex) continue;
        if (endpoint.x < Math.min(span.a.x, span.b.x) - reach || endpoint.x > Math.max(span.a.x, span.b.x) + reach
          || endpoint.y < Math.min(span.a.y, span.b.y) - reach || endpoint.y > Math.max(span.a.y, span.b.y) + reach) continue;
        const projection = closestPointOnSegment(endpoint, span.a, span.b);
        if (projection.distance > junctionStitchRadius) continue;
        // Split the through span at the actual projected junction. Linking the
        // side street straight to the nearer *endpoint* of a long simplified
        // span made route paths cut diagonally across corners and buildings.
        const spanStart = nodeIndex.get(keyFor(span.a));
        const spanEnd = nodeIndex.get(keyFor(span.b));
        if (spanStart === undefined || spanEnd === undefined) continue;
        const target = distanceBetween(projection, span.a) < 1e-6
          ? spanStart
          : distanceBetween(projection, span.b) < 1e-6
            ? spanEnd
            : projectionNodeFor(projection, span);
        link(spanStart, target, span.segmentIndex, KIND_CENTRELINE);
        link(target, spanEnd, span.segmentIndex, KIND_CENTRELINE);
        link(from, target, span.segmentIndex, KIND_STITCH);
        if (projection.distance > CONNECTOR_MIN) {
          connectors.push({ a: endpoint, b: { x: projection.x, y: projection.y }, segmentIndex });
        }
      }
    }
    if (segmentIndex % 32 === 0) yield;
  }

  const metadata = segments.map((segment) => segment?.metadata);
  return new CsrRoadGraph(freezeBuilder(builder, mergeSize, metadata), connectors);
}

/** Synchronous callers and the responsive browser build share exactly the same topology. */
export function buildRoadGraph<TMetadata = unknown>(
  segments: readonly RoadGraphSegment<TMetadata>[], options: RoadGraphBuildOptions = {},
): RoadGraph<TMetadata> {
  const stages = roadGraphStages(segments, options);
  let step = stages.next();
  while (!step.done) step = stages.next();
  return step.value;
}

export async function buildRoadGraphAsync<TMetadata = unknown>(
  segments: readonly RoadGraphSegment<TMetadata>[], options: RoadGraphBuildOptions = {},
  scheduling: BuildScheduling = {},
): Promise<RoadGraph<TMetadata>> {
  return finishBatchedBuild(roadGraphStages(segments, options), scheduling);
}

export type RoadGraphAddition<TMetadata = unknown> = Readonly<{
  /** New nodes, numbered after the graph's own: the first is `storage.nodeCount`. Keys must be unique. */
  nodes: readonly Readonly<{ x: number; y: number; key: string }>[];
  /**
   * New links, both directions, appended after each node's existing edges in
   * this order. `a`/`b` are node indexes (existing or new). `metadata` is
   * the link's own (its `segmentMetadata`), whatever the segment table holds.
   */
  links: readonly Readonly<{ a: number; b: number; segmentIndex: number; metadata?: TMetadata }>[];
}>;

/**
 * A new graph: this one plus `addition` (ferry crossings, added after the
 * street build so they are never junction-stitched). Links are not merged
 * with existing ones. The original graph is left unchanged.
 */
export function appendRoadGraph<TMetadata>(graph: RoadGraph<TMetadata>, addition: RoadGraphAddition<TMetadata>): RoadGraph<TMetadata> {
  const old = graph.storage;
  const nodeCount = old.nodeCount + addition.nodes.length;
  const x = new Float64Array(nodeCount), y = new Float64Array(nodeCount), keyKind = new Uint8Array(nodeCount);
  x.set(old.x); y.set(old.y); keyKind.set(old.keyKind);
  const extraKeys = new Map(old.extraKeys);
  addition.nodes.forEach((node, i) => {
    x[old.nodeCount + i] = node.x;
    y[old.nodeCount + i] = node.y;
    keyKind[old.nodeCount + i] = 2;
    extraKeys.set(old.nodeCount + i, node.key);
  });
  const oldLinkCount = old.linkDistance.length;
  const linkCount = oldLinkCount + addition.links.length;
  const added: number[][] = Array.from({ length: nodeCount }, () => []);
  const linkMetadata = new Map(old.linkMetadata);
  addition.links.forEach((link, i) => {
    if (!(link.a >= 0 && link.a < nodeCount && link.b >= 0 && link.b < nodeCount)) throw new RangeError(`appendRoadGraph: link ${i} names a missing node`);
    linkMetadata.set(oldLinkCount + i, link.metadata);
    added[link.a].push(link.b, oldLinkCount + i);
    added[link.b].push(link.a, oldLinkCount + i);
  });
  const offsets = new Int32Array(nodeCount + 1);
  for (let i = 0; i < nodeCount; i++) {
    const own = i < old.nodeCount ? old.offsets[i + 1] - old.offsets[i] : 0;
    offsets[i + 1] = offsets[i] + own + added[i].length / 2;
  }
  const targets = new Int32Array(offsets[nodeCount]), edgeLink = new Int32Array(offsets[nodeCount]);
  for (let i = 0; i < nodeCount; i++) {
    let e = offsets[i];
    if (i < old.nodeCount) {
      for (let o = old.offsets[i]; o < old.offsets[i + 1]; o++, e++) {
        targets[e] = old.targets[o];
        edgeLink[e] = old.edgeLink[o];
      }
    }
    const pairs = added[i];
    for (let k = 0; k < pairs.length; k += 2, e++) {
      targets[e] = pairs[k];
      edgeLink[e] = pairs[k + 1];
    }
  }
  const linkDistance = new Float64Array(linkCount), linkKind = new Uint8Array(linkCount);
  linkDistance.set(old.linkDistance); linkKind.set(old.linkKind);
  const linkSegOffsets = new Int32Array(linkCount + 1), linkSegIndexes = new Int32Array(old.linkSegIndexes.length + addition.links.length);
  linkSegOffsets.set(old.linkSegOffsets); linkSegIndexes.set(old.linkSegIndexes);
  addition.links.forEach((link, i) => {
    const l = oldLinkCount + i;
    linkDistance[l] = Math.hypot(x[link.a] - x[link.b], y[link.a] - y[link.b]);
    linkKind[l] = KIND_CENTRELINE;
    linkSegIndexes[linkSegOffsets[l]] = link.segmentIndex;
    linkSegOffsets[l + 1] = linkSegOffsets[l] + 1;
  });
  return new CsrRoadGraph({
    mergeSize: old.mergeSize, nodeCount, x, y, keyKind, extraKeys, offsets, targets, edgeLink,
    linkDistance, linkKind, linkSegOffsets, linkSegIndexes, metadata: old.metadata, linkMetadata, views: new Map(), keyTable: null,
  }, graph.connectors);
}

// ---- Views over the storage ----

const keyAt = (storage: RoadGraphStorage<unknown>, index: number): string => {
  const kind = storage.keyKind[index];
  if (kind === 0) return `${Math.round(storage.x[index] / storage.mergeSize)},${Math.round(storage.y[index] / storage.mergeSize)}`;
  if (kind === 1) return `junction:${index}`;
  return storage.extraKeys.get(index)!;
};

const quantHash = (qx: number, qy: number, mask: number): number =>
  ((Math.imul(qx, 73856093) ^ Math.imul(qy, 19349663)) >>> 0) & mask;

/** Index of the node with `key`, or -1. Quantised keys go through an open-addressed table built on first use. */
function indexOfKey(storage: RoadGraphStorage<unknown>, key: string): number {
  if (key.startsWith('junction:')) {
    const index = Number(key.slice(9));
    return Number.isInteger(index) && storage.keyKind[index] === 1 ? index : -1;
  }
  const comma = key.indexOf(',');
  const qx = Number(key.slice(0, comma)), qy = Number(key.slice(comma + 1));
  if (comma < 0 || !Number.isInteger(qx) || !Number.isInteger(qy)) {
    for (const [index, extra] of storage.extraKeys) if (extra === key) return index;
    return -1;
  }
  const m = storage.mergeSize;
  if (!storage.keyTable) {
    let size = 16;
    while (size < storage.nodeCount * 2) size *= 2;
    const table = new Int32Array(size);
    for (let i = 0; i < storage.nodeCount; i++) {
      if (storage.keyKind[i] !== 0) continue;
      let slot = quantHash(Math.round(storage.x[i] / m), Math.round(storage.y[i] / m), size - 1);
      while (table[slot]) slot = (slot + 1) & (size - 1);
      table[slot] = i + 1;
    }
    storage.keyTable = table;
  }
  const table = storage.keyTable, mask = table.length - 1;
  for (let slot = quantHash(qx, qy, mask); table[slot]; slot = (slot + 1) & mask) {
    const i = table[slot] - 1;
    if (Math.round(storage.x[i] / m) === qx && Math.round(storage.y[i] / m) === qy) return i;
  }
  return -1;
}

const segmentIndexesOf = (storage: RoadGraphStorage<unknown>, link: number): number[] =>
  Array.from(storage.linkSegIndexes.subarray(storage.linkSegOffsets[link], storage.linkSegOffsets[link + 1]));

function segmentMetadataOf<TMetadata>(storage: RoadGraphStorage<TMetadata>, link: number): (TMetadata | undefined)[] {
  if (storage.linkMetadata.size && storage.linkMetadata.has(link)) return [storage.linkMetadata.get(link)];
  const out: (TMetadata | undefined)[] = [];
  for (let s = storage.linkSegOffsets[link]; s < storage.linkSegOffsets[link + 1]; s++) out.push(storage.metadata[storage.linkSegIndexes[s]]);
  return out;
}

class NodeView<TMetadata> implements RoadGraphNode<TMetadata> {
  readonly #storage: RoadGraphStorage<TMetadata>;
  readonly x: number;
  readonly y: number;
  readonly index: number;
  constructor(storage: RoadGraphStorage<TMetadata>, index: number) {
    this.#storage = storage;
    this.index = index;
    this.x = storage.x[index];
    this.y = storage.y[index];
  }
  get key(): string { return keyAt(this.#storage, this.index); }
  get edges(): RoadGraphEdge<TMetadata>[] {
    const storage = this.#storage, out: RoadGraphEdge<TMetadata>[] = [];
    for (let e = storage.offsets[this.index]; e < storage.offsets[this.index + 1]; e++) out.push(edgeView(storage, e));
    return out;
  }
}

/** The cached view of node `index` (one object per node, created on first access). */
export function roadGraphNodeAt<TMetadata>(graph: RoadGraph<TMetadata>, index: number): RoadGraphNode<TMetadata> {
  return nodeView(graph.storage, index);
}

function nodeView<TMetadata>(storage: RoadGraphStorage<TMetadata>, index: number): RoadGraphNode<TMetadata> {
  let view = storage.views.get(index);
  if (!view) {
    view = new NodeView(storage, index);
    storage.views.set(index, view);
  }
  return view;
}

function edgeView<TMetadata>(storage: RoadGraphStorage<TMetadata>, edge: number): RoadGraphEdge<TMetadata> {
  const link = storage.edgeLink[edge];
  return {
    node: nodeView(storage, storage.targets[edge]),
    distance: storage.linkDistance[link],
    kind: EDGE_KINDS[storage.linkKind[link]],
    segmentIndexes: segmentIndexesOf(storage, link),
    segmentMetadata: segmentMetadataOf(storage, link),
  };
}

/** A node cursor for edge-cost callbacks: repointed per edge, never cached. */
class NodeCursor<TMetadata> implements RoadGraphNode<TMetadata> {
  index = 0;
  constructor(private readonly storage: RoadGraphStorage<TMetadata>) {}
  get x(): number { return this.storage.x[this.index]; }
  get y(): number { return this.storage.y[this.index]; }
  get key(): string { return keyAt(this.storage, this.index); }
  get edges(): RoadGraphEdge<TMetadata>[] { return nodeView(this.storage, this.index).edges as RoadGraphEdge<TMetadata>[]; }
}

class EdgeCursor<TMetadata> implements RoadGraphEdge<TMetadata> {
  link = 0;
  constructor(private readonly storage: RoadGraphStorage<TMetadata>, readonly node: NodeCursor<TMetadata>) {}
  get distance(): number { return this.storage.linkDistance[this.link]; }
  get kind(): RoadGraphEdge['kind'] { return EDGE_KINDS[this.storage.linkKind[this.link]]; }
  get segmentIndexes(): number[] { return segmentIndexesOf(this.storage, this.link); }
  get segmentMetadata(): (TMetadata | undefined)[] { return segmentMetadataOf(this.storage, this.link); }
}

/** `ReadonlyMap<string, V>` over node indexes: `valueAt` returns undefined for absent nodes. */
abstract class IndexedMap<V> implements ReadonlyMap<string, V> {
  constructor(protected readonly storage: RoadGraphStorage<any>) {}
  protected abstract valueAt(index: number): V | undefined;
  get(key: string): V | undefined {
    const index = indexOfKey(this.storage, key);
    return index < 0 ? undefined : this.valueAt(index);
  }
  has(key: string): boolean { return this.get(key) !== undefined; }
  get size(): number {
    let n = 0;
    for (let i = 0; i < this.storage.nodeCount; i++) if (this.valueAt(i) !== undefined) n++;
    return n;
  }
  *entries(): MapIterator<[string, V]> {
    for (let i = 0; i < this.storage.nodeCount; i++) {
      const value = this.valueAt(i);
      if (value !== undefined) yield [keyAt(this.storage, i), value];
    }
  }
  *keys(): MapIterator<string> { for (const [key] of this.entries()) yield key; }
  *values(): MapIterator<V> { for (const [, value] of this.entries()) yield value; }
  [Symbol.iterator](): MapIterator<[string, V]> { return this.entries(); }
  forEach(callback: (value: V, key: string, map: ReadonlyMap<string, V>) => void): void {
    for (const [key, value] of this.entries()) callback(value, key, this);
  }
}

class NodeMap<TMetadata> extends IndexedMap<RoadGraphNode<TMetadata>> {
  protected valueAt(index: number) { return nodeView(this.storage as RoadGraphStorage<TMetadata>, index); }
  override get size(): number { return this.storage.nodeCount; }
}

class DistanceMap extends IndexedMap<number> {
  constructor(storage: RoadGraphStorage<any>, private readonly dist: Float64Array) { super(storage); }
  protected valueAt(index: number) { return this.dist[index] === Infinity ? undefined : this.dist[index]; }
}

class PreviousMap<TMetadata> extends IndexedMap<RoadGraphNode<TMetadata>> {
  constructor(storage: RoadGraphStorage<TMetadata>, readonly prev: Int32Array) { super(storage); }
  protected valueAt(index: number) { return this.prev[index] < 0 ? undefined : nodeView(this.storage as RoadGraphStorage<TMetadata>, this.prev[index]); }
}

class CsrRoadGraph<TMetadata> implements RoadGraph<TMetadata> {
  constructor(readonly storage: RoadGraphStorage<TMetadata>, readonly connectors: readonly RoadGraphConnector[]) {}
  get nodes(): ReadonlyMap<string, RoadGraphNode<TMetadata>> { return new NodeMap<TMetadata>(this.storage); }
  get allNodes(): RoadGraphNode<TMetadata>[] {
    return Array.from({ length: this.storage.nodeCount }, (_, i) => nodeView(this.storage, i));
  }
}

// ---- Routing over the arrays ----

/** Index of the node nearest `point` (first of equals), or -1 for an empty graph. */
function nearestIndex(storage: RoadGraphStorage<unknown>, point: RoadGraphPoint): number {
  let best = -1;
  let bestDistance = Infinity;
  const { x, y, nodeCount } = storage;
  for (let i = 0; i < nodeCount; i++) {
    const distance = (x[i] - point.x) ** 2 + (y[i] - point.y) ** 2;
    if (distance < bestDistance) {
      best = i;
      bestDistance = distance;
    }
  }
  return best;
}

export function nearestRoadGraphNode<TMetadata>(
  graph: RoadGraph<TMetadata>,
  point: RoadGraphPoint,
): RoadGraphNode<TMetadata> | null {
  const index = nearestIndex(graph.storage, point);
  return index < 0 ? null : nodeView(graph.storage, index);
}

/**
 * Dijkstra from node `start` with a binary heap of node indexes. The heap's
 * sift order and the lazy deletion are those of the object-graph router, so
 * equal-cost ties resolve to the same paths.
 */
function dijkstra<TMetadata>(
  storage: RoadGraphStorage<TMetadata>,
  start: number,
  stopAt: number,
  edgeCost: RoadGraphEdgeCost<TMetadata> | undefined,
): { dist: Float64Array; prev: Int32Array } {
  const { offsets, targets, edgeLink, linkDistance } = storage;
  const dist = new Float64Array(storage.nodeCount).fill(Infinity);
  const prev = new Int32Array(storage.nodeCount).fill(-1);
  dist[start] = 0;
  const heapNode: number[] = [start];
  const heapCost: number[] = [0];
  const push = (node: number, cost: number): void => {
    let index = heapNode.length;
    heapNode.push(node);
    heapCost.push(cost);
    while (index > 0) {
      const parent = (index - 1) >> 1;
      if (heapCost[parent] <= cost) break;
      heapNode[index] = heapNode[parent];
      heapCost[index] = heapCost[parent];
      index = parent;
    }
    heapNode[index] = node;
    heapCost[index] = cost;
  };
  const from = edgeCost ? new NodeCursor(storage) : null;
  const to = edgeCost ? new NodeCursor(storage) : null;
  const edge = edgeCost ? new EdgeCursor(storage, to!) : null;
  const context = { edge: edge!, from: from!, to: to!, distance: 0 };

  while (heapNode.length) {
    const current = heapNode[0];
    const currentCost = heapCost[0];
    const lastNode = heapNode.pop()!;
    const lastCost = heapCost.pop()!;
    const size = heapNode.length;
    if (size) {
      let index = 0;
      while (true) {
        const left = index * 2 + 1;
        const right = left + 1;
        if (left >= size) break;
        const child = right < size && heapCost[right] < heapCost[left] ? right : left;
        if (heapCost[child] >= lastCost) break;
        heapNode[index] = heapNode[child];
        heapCost[index] = heapCost[child];
        index = child;
      }
      heapNode[index] = lastNode;
      heapCost[index] = lastCost;
    }
    if (currentCost !== dist[current]) continue;
    if (current === stopAt) break;
    for (let e = offsets[current]; e < offsets[current + 1]; e++) {
      const target = targets[e];
      const distance = linkDistance[edgeLink[e]];
      let cost = distance;
      if (edgeCost) {
        from!.index = current;
        to!.index = target;
        edge!.link = edgeLink[e];
        context.distance = distance;
        cost = edgeCost(context) ?? distance;
      }
      if (!Number.isFinite(cost) || cost < 0) {
        throw new RangeError(`Dijkstra edge cost must be finite and non-negative (received ${cost})`);
      }
      const nextCost = currentCost + cost;
      if (nextCost >= dist[target]) continue;
      dist[target] = nextCost;
      prev[target] = current;
      push(target, nextCost);
    }
  }
  return { dist, prev };
}

export function shortestRoadPaths<TMetadata>(
  graph: RoadGraph<TMetadata>,
  startPoint: RoadGraphPoint,
  options: ShortestPathOptions<TMetadata> = {},
): ShortestPathTree<TMetadata> | null {
  const storage = graph.storage;
  const start = nearestIndex(storage, startPoint);
  if (start < 0) return null;
  const { dist, prev } = dijkstra(storage, start, options.stopAt ? options.stopAt.index : -1, options.edgeCost);
  return {
    start: nodeView(storage, start),
    distances: new DistanceMap(storage, dist),
    previous: new PreviousMap(storage, prev),
    dist,
    prev,
  };
}

/** Node indexes from the tree's start to `end`. */
function indexPath(prev: Int32Array, end: number): number[] {
  const route: number[] = [];
  for (let node = end; node >= 0; node = prev[node]) route.push(node);
  return route.reverse();
}

const pointsOf = (storage: RoadGraphStorage<unknown>, nodes: readonly number[]): RoadGraphPoint[] =>
  nodes.map((i) => ({ x: storage.x[i], y: storage.y[i] }));

export function reconstructRoadPath<TMetadata>(
  previous: ReadonlyMap<string, RoadGraphNode<TMetadata>>,
  endNode: RoadGraphNode<TMetadata>,
): RoadGraphPoint[] {
  if (previous instanceof PreviousMap) {
    const storage = (previous as PreviousMap<TMetadata>)['storage'] as RoadGraphStorage<TMetadata>;
    return pointsOf(storage, indexPath((previous as PreviousMap<TMetadata>).prev, endNode.index));
  }
  const route: RoadGraphPoint[] = [];
  for (let node: RoadGraphNode<TMetadata> | undefined = endNode; node; node = previous.get(node.key)) {
    route.push({ x: node.x, y: node.y });
  }
  return route.reverse();
}

export function findRoadRoute<TMetadata>(
  graph: RoadGraph<TMetadata>,
  startPoint: RoadGraphPoint,
  finishPoint: RoadGraphPoint,
  edgeCost?: RoadGraphEdgeCost<TMetadata>,
): RoadGraphPoint[] {
  const storage = graph.storage;
  const finish = nearestIndex(storage, finishPoint);
  if (finish < 0) return [];
  const start = nearestIndex(storage, startPoint);
  const { dist, prev } = dijkstra(storage, start, finish, edgeCost);
  if (dist[finish] === Infinity) return [];
  return pointsOf(storage, indexPath(prev, finish));
}

export function findRoadRouteToFirstReachable<TMetadata>(
  graph: RoadGraph<TMetadata>,
  startPoint: RoadGraphPoint,
  candidatePoints: readonly RoadGraphPoint[],
  edgeCost?: RoadGraphEdgeCost<TMetadata>,
): { index: number; path: RoadGraphPoint[] } | null {
  const storage = graph.storage;
  const start = nearestIndex(storage, startPoint);
  if (start < 0) return null;
  const { dist, prev } = dijkstra(storage, start, -1, edgeCost);
  for (let index = 0; index < candidatePoints.length; index++) {
    const node = nearestIndex(storage, candidatePoints[index]);
    if (node < 0 || dist[node] === Infinity) continue;
    const path = indexPath(prev, node);
    if (path.length >= 2) return { index, path: pointsOf(storage, path) };
  }
  return null;
}

/** The first directed edge from `from` to `to`, or -1. */
function edgeIndexBetween(storage: RoadGraphStorage<unknown>, from: number, to: number): number {
  for (let e = storage.offsets[from]; e < storage.offsets[from + 1]; e++) if (storage.targets[e] === to) return e;
  return -1;
}

/** The first edge from `from` to `to` (as the object graph's `edges.find`), or undefined. */
export function roadGraphEdgeBetween<TMetadata>(
  graph: RoadGraph<TMetadata>,
  from: RoadGraphNode<TMetadata>,
  to: RoadGraphNode<TMetadata>,
): RoadGraphEdge<TMetadata> | undefined {
  const edge = edgeIndexBetween(graph.storage, from.index, to.index);
  return edge < 0 ? undefined : edgeView(graph.storage, edge);
}

/**
 * Prefer unfamiliar named roads without turning them into a maze.
 *
 * The ordinary shortest route is always computed first. Familiarity is then a
 * small, non-negative edge penalty (so Dijkstra remains valid), and the result
 * is rejected if its real geometric length exceeds the explicit detour cap.
 */
export function planLearningRoadRoute<TMetadata>(
  graph: RoadGraph<TMetadata>,
  startPoint: RoadGraphPoint,
  finishPoint: RoadGraphPoint,
  options: LearningRouteOptions<TMetadata>,
): LearningRoutePlan | null {
  const { via, ...direct } = options;
  const plan = planDirectLearningRoute(graph, startPoint, finishPoint, direct);
  if (!via || !plan || (Array.isArray(via) && !via.length)) return plan;
  const viaDetourRatio = options.viaDetourRatio ?? 0.4;
  const isPoint = (value: unknown): value is RoadGraphPoint => !Array.isArray(value);
  // A stretch with a dead-end end can only be ridden out and back, which the
  // repeat check below refuses anyway; dropping it first saves its planning.
  const storage = graph.storage;
  const through = (point: RoadGraphPoint) => {
    const node = nearestIndex(storage, point);
    return node >= 0 && storage.offsets[node + 1] - storage.offsets[node] >= 2;
  };
  const stretches: ViaStretch[] = (isPoint(via) ? [] : isPoint(via[0]) ? [via as ViaStretch] : [...(via as readonly ViaStretch[])])
    .filter(([a, b]) => through(a) && through(b))
    .slice(0, options.viaTries ?? 3);
  const crow = (a: RoadGraphPoint, b: RoadGraphPoint) => Math.hypot(a.x - b.x, a.y - b.y);
  // Each stretch in the order that looks likelier to lead on, then reversed.
  const orders: RoadGraphPoint[][] = isPoint(via) ? [[via]] : stretches.flatMap(([a, b]) =>
    crow(startPoint, a) + crow(b, finishPoint) <= crow(startPoint, b) + crow(a, finishPoint) ? [[a, b], [b, a]] : [[b, a], [a, b]]);
  for (const stretch of orders) {
    const legs: LearningRoutePlan[] = [];
    const stops = [startPoint, ...stretch, finishPoint];
    for (let index = 1; index < stops.length; index++) {
      const leg = planDirectLearningRoute(graph, stops[index - 1], stops[index], direct, true);
      // Only the stretch itself may collapse to one node (its ends merged).
      if (!leg || (leg.path.length < 2 && !(stretch.length === 2 && index === 2))) break;
      legs.push(leg);
    }
    if (legs.length !== stops.length - 1) continue;
    const path: RoadGraphPoint[] = [];
    for (const leg of legs) path.push(...(path.length ? leg.path.slice(1) : leg.path));
    // Every node once: a repeat means riding back the way it came, out of a
    // dead end or round a lollipop to a junction already passed, which also
    // confuses the live route line's nearest point.
    // Two graph nodes can share a position (a bridge ramp meeting its deck, a
    // connector); the hop between them is zero metres, not a turn-back, so
    // consecutive equal positions count once. Before 2026-10-13 any such pair
    // on the approach refused every stretch, whatever the start was.
    const keys = path.map(({ x, y }) => `${x},${y}`).filter((key, index, all) => index === 0 || key !== all[index - 1]);
    if (new Set(keys).size !== keys.length) continue;
    const physicalDistance = legs.reduce((sum, leg) => sum + leg.physicalDistance, 0);
    if (plan.shortestDistance > 0 && physicalDistance > plan.shortestDistance * (1 + viaDetourRatio + 1e-9)) continue;
    return {
      path,
      expectedNovelty: physicalDistance > 0
        ? legs.reduce((sum, leg) => sum + leg.expectedNovelty * leg.physicalDistance, 0) / physicalDistance
        : 0,
      physicalDistance,
      shortestDistance: plan.shortestDistance,
      detourRatio: plan.shortestDistance > 0 ? physicalDistance / plan.shortestDistance - 1 : 0,
      usedLearningBias: true,
      dueNamesOnPath: [...new Set(legs.flatMap(leg => leg.dueNamesOnPath))].sort(),
      viaUsed: true,
      ...(stretch.length === 2 ? { viaStretch: [stretch[0], stretch[1]] as const } : {}),
    };
  }
  return plan;
}

function planDirectLearningRoute<TMetadata>(
  graph: RoadGraph<TMetadata>,
  startPoint: RoadGraphPoint,
  finishPoint: RoadGraphPoint,
  options: LearningRouteOptions<TMetadata>,
  /** Skip the biased pass: a via leg is short, and the via itself is the
   *  review, so a second Dijkstra per leg buys little. */
  shortestOnly = false,
): LearningRoutePlan | null {
  const familiarityPenalty = options.familiarityPenalty ?? 0.18;
  const dueNames = options.dueNames && options.dueNames.size ? options.dueNames : null;
  const dueDiscount = Math.max(0, Math.min(0.9, options.dueDiscount ?? 0.35));
  const maxDetourRatio = dueNames ? (options.reviewDetourRatio ?? 0.25) : (options.maxDetourRatio ?? 0.12);
  if (!(familiarityPenalty >= 0) || !(maxDetourRatio >= 0)) {
    throw new RangeError('Learning-route bounds must be non-negative');
  }
  const storage = graph.storage;
  const finish = nearestIndex(storage, finishPoint);
  if (finish < 0) return null;
  const start = nearestIndex(storage, startPoint);
  const shortest = dijkstra(storage, start, finish, undefined);
  if (shortest.dist[finish] === Infinity) return null;

  const mastery = (edge: RoadGraphEdge<TMetadata>): number => {
    const names = [...new Set(options.namesForEdge(edge).filter(Boolean))];
    if (!names.length) return 0;
    return Math.max(...names.map((name) => Math.max(0, Math.min(1, options.masteryForName(name) || 0))));
  };
  const homeBias = options.homeBias;
  const outsidePenalty = homeBias?.outsidePenalty ?? 0.25;
  if (homeBias && (!(homeBias.radius > 0) || !(outsidePenalty >= 0))) {
    throw new RangeError('homeBias.radius must be positive and outsidePenalty non-negative');
  }
  const homeOutside = (from: RoadGraphPoint, to: RoadGraphPoint): number => {
    if (!homeBias) return 0;
    const midX = (from.x + to.x) * 0.5;
    const midY = (from.y + to.y) * 0.5;
    const dist = Math.hypot(midX - homeBias.x, midY - homeBias.y);
    return Math.max(0, Math.min(1, dist / homeBias.radius - 1));
  };
  const isDue = (edge: RoadGraphEdge<TMetadata>): boolean =>
    !!dueNames && options.namesForEdge(edge).some(name => name && dueNames.has(name));
  const preferred = shortestOnly ? null : dijkstra(storage, start, finish, ({ edge, distance, from, to }) => isDue(edge)
    ? distance * (1 - dueDiscount + outsidePenalty * homeOutside(from, to))
    : distance * (1 + familiarityPenalty * mastery(edge) + outsidePenalty * homeOutside(from, to)));
  const shortestNodes = indexPath(shortest.prev, finish);
  const preferredNodes = preferred && preferred.dist[finish] !== Infinity ? indexPath(preferred.prev, finish) : shortestNodes;
  const physicalLength = (nodes: readonly number[]) => nodes.slice(1).reduce((sum, node, index) => {
    const edge = edgeIndexBetween(storage, nodes[index], node);
    return sum + (edge >= 0
      ? storage.linkDistance[storage.edgeLink[edge]]
      : Math.hypot(storage.x[nodes[index]] - storage.x[node], storage.y[nodes[index]] - storage.y[node]));
  }, 0);
  const shortestDistance = physicalLength(shortestNodes);
  const preferredDistance = physicalLength(preferredNodes);
  const withinCap = shortestDistance === 0 || preferredDistance <= shortestDistance * (1 + maxDetourRatio + 1e-9);
  const selected = withinCap ? preferredNodes : shortestNodes;
  const physicalDistance = withinCap ? preferredDistance : shortestDistance;
  const pathEdge = new EdgeCursor(storage, new NodeCursor(storage));
  let newDistance = 0;
  const dueOnPath = new Set<string>();
  for (let index = 1; index < selected.length; index++) {
    const edgeIndex = edgeIndexBetween(storage, selected[index - 1], selected[index]);
    // A cursor, not a cached view: replanning must not grow the view cache.
    const edge = edgeIndex >= 0 ? pathEdge : undefined;
    pathEdge.link = storage.edgeLink[Math.max(0, edgeIndex)];
    pathEdge.node.index = selected[index];
    if (edge && options.namesForEdge(edge).some(Boolean) && mastery(edge) < 0.5) newDistance += edge.distance;
    if (edge && dueNames) for (const name of options.namesForEdge(edge)) if (name && dueNames.has(name)) dueOnPath.add(name);
  }
  return {
    path: pointsOf(storage, selected),
    expectedNovelty: physicalDistance > 0 ? newDistance / physicalDistance : 0,
    physicalDistance,
    shortestDistance,
    detourRatio: shortestDistance > 0 ? physicalDistance / shortestDistance - 1 : 0,
    usedLearningBias: withinCap && selected.some((node, index) => node !== shortestNodes[index]),
    dueNamesOnPath: [...dueOnPath].sort(),
  };
}
