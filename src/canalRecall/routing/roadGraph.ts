export type RoadGraphPoint = Readonly<{ x: number; y: number }>;

export type RoadGraphSegment<TMetadata = unknown> = Readonly<{
  points: readonly RoadGraphPoint[];
  width?: number;
  metadata?: TMetadata;
}>;

export type RoadGraphNode<TMetadata = unknown> = {
  readonly key: string;
  readonly x: number;
  readonly y: number;
  readonly edges: RoadGraphEdge<TMetadata>[];
};

export type RoadGraphEdge<TMetadata = unknown> = {
  readonly node: RoadGraphNode<TMetadata>;
  readonly distance: number;
  readonly kind: 'centreline' | 'junction-stitch';
  /** All source segments represented by this link, in input order. */
  readonly segmentIndexes: readonly number[];
  readonly segmentMetadata: readonly (TMetadata | undefined)[];
};

export type RoadGraph<TMetadata = unknown> = Readonly<{
  nodes: ReadonlyMap<string, RoadGraphNode<TMetadata>>;
  allNodes: readonly RoadGraphNode<TMetadata>[];
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
}>;

export type LearningRoutePlan = Readonly<{
  path: readonly RoadGraphPoint[];
  /** Fraction of physical route distance on names below 50% mastery. */
  expectedNovelty: number;
  physicalDistance: number;
  shortestDistance: number;
  detourRatio: number;
  usedLearningBias: boolean;
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
}>;

const DEFAULT_MERGE_SIZE = 18;
const DEFAULT_STITCH_RADIUS = 10;
const DEFAULT_GRID_CELL_SIZE = 100;
const DEFAULT_GRID_PADDING = 10;

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
}>;

/** Build the topology shared by every route query against one road network. */
export function buildRoadGraph<TMetadata = unknown>(
  segments: readonly RoadGraphSegment<TMetadata>[],
  options: RoadGraphBuildOptions = {},
): RoadGraph<TMetadata> {
  const mergeSize = options.mergeSize ?? DEFAULT_MERGE_SIZE;
  const junctionStitchRadius = options.junctionStitchRadius ?? DEFAULT_STITCH_RADIUS;
  const gridCellSize = options.gridCellSize ?? DEFAULT_GRID_CELL_SIZE;
  const gridPadding = options.gridPadding ?? DEFAULT_GRID_PADDING;
  if (!(mergeSize > 0) || !(junctionStitchRadius >= 0) || !(gridCellSize > 0) || !(gridPadding >= 0)) {
    throw new RangeError('Road graph dimensions must be finite and non-negative');
  }

  const nodes = new Map<string, RoadGraphNode<TMetadata>>();
  const spanGrid = new Map<string, IndexedSpan[]>();
  const keyFor = (point: RoadGraphPoint): string =>
    `${Math.round(point.x / mergeSize)},${Math.round(point.y / mergeSize)}`;
  const nodeFor = (point: RoadGraphPoint): RoadGraphNode<TMetadata> => {
    const key = keyFor(point);
    let node = nodes.get(key);
    if (!node) {
      node = { key, x: point.x, y: point.y, edges: [] };
      nodes.set(key, node);
    }
    return node;
  };
  const link = (
    a: RoadGraphNode<TMetadata>,
    b: RoadGraphNode<TMetadata>,
    segmentIndex: number,
    kind: RoadGraphEdge<TMetadata>['kind'],
  ): void => {
    if (a === b) return;
    const existingForward = a.edges.find((edge) => edge.node === b);
    const existingReverse = b.edges.find((edge) => edge.node === a);
    if (existingForward && existingReverse) {
      if (!existingForward.segmentIndexes.includes(segmentIndex)) {
        (existingForward.segmentIndexes as number[]).push(segmentIndex);
        (existingForward.segmentMetadata as (TMetadata | undefined)[]).push(segments[segmentIndex]?.metadata);
        (existingReverse.segmentIndexes as number[]).push(segmentIndex);
        (existingReverse.segmentMetadata as (TMetadata | undefined)[]).push(segments[segmentIndex]?.metadata);
      }
      return;
    }
    const distance = distanceBetween(a, b);
    const forward: RoadGraphEdge<TMetadata> = {
      node: b,
      distance,
      kind,
      segmentIndexes: [segmentIndex],
      segmentMetadata: [segments[segmentIndex]?.metadata],
    };
    const reverse: RoadGraphEdge<TMetadata> = {
      node: a,
      distance,
      kind,
      segmentIndexes: [segmentIndex],
      segmentMetadata: [segments[segmentIndex]?.metadata],
    };
    a.edges.push(forward);
    b.edges.push(reverse);
  };
  const addSpanToGrid = (span: IndexedSpan, width: number): void => {
    const pad = width + gridPadding;
    const gx0 = Math.floor((Math.min(span.a.x, span.b.x) - pad) / gridCellSize);
    const gx1 = Math.floor((Math.max(span.a.x, span.b.x) + pad) / gridCellSize);
    const gy0 = Math.floor((Math.min(span.a.y, span.b.y) - pad) / gridCellSize);
    const gy1 = Math.floor((Math.max(span.a.y, span.b.y) + pad) / gridCellSize);
    for (let gx = gx0; gx <= gx1; gx++) {
      for (let gy = gy0; gy <= gy1; gy++) {
        const key = `${gx},${gy}`;
        const bucket = spanGrid.get(key) ?? [];
        bucket.push(span);
        spanGrid.set(key, bucket);
      }
    }
  };

  segments.forEach((segment, segmentIndex) => {
    for (let pointIndex = 1; pointIndex < segment.points.length; pointIndex++) {
      const a = segment.points[pointIndex - 1];
      const b = segment.points[pointIndex];
      link(nodeFor(a), nodeFor(b), segmentIndex, 'centreline');
      addSpanToGrid({ a, b, segmentIndex }, segment.width ?? 0);
    }
  });

  const spansNear = (point: RoadGraphPoint): IndexedSpan[] => {
    const gx = Math.floor(point.x / gridCellSize);
    const gy = Math.floor(point.y / gridCellSize);
    const found: IndexedSpan[] = [];
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) found.push(...(spanGrid.get(`${gx + dx},${gy + dy}`) ?? []));
    }
    return found;
  };

  segments.forEach((segment, segmentIndex) => {
    if (segment.points.length < 2) return;
    const endpoints = [segment.points[0], segment.points[segment.points.length - 1]];
    for (const endpoint of endpoints) {
      const from = nodes.get(keyFor(endpoint));
      if (!from) continue;
      for (const span of spansNear(endpoint)) {
        if (span.segmentIndex === segmentIndex) continue;
        if (closestPointOnSegment(endpoint, span.a, span.b).distance > junctionStitchRadius) continue;
        const nearer = distanceBetween(endpoint, span.a) <= distanceBetween(endpoint, span.b) ? span.a : span.b;
        const target = nodes.get(keyFor(nearer));
        if (target) link(from, target, span.segmentIndex, 'junction-stitch');
      }
    }
  });

  return { nodes, allNodes: [...nodes.values()] };
}

export function nearestRoadGraphNode<TMetadata>(
  graph: RoadGraph<TMetadata>,
  point: RoadGraphPoint,
): RoadGraphNode<TMetadata> | null {
  let best: RoadGraphNode<TMetadata> | null = null;
  let bestDistance = Infinity;
  for (const node of graph.allNodes) {
    const distance = (node.x - point.x) ** 2 + (node.y - point.y) ** 2;
    if (distance < bestDistance) {
      best = node;
      bestDistance = distance;
    }
  }
  return best;
}

type QueueItem<TMetadata> = { node: RoadGraphNode<TMetadata>; cost: number };

export function shortestRoadPaths<TMetadata>(
  graph: RoadGraph<TMetadata>,
  startPoint: RoadGraphPoint,
  options: ShortestPathOptions<TMetadata> = {},
): ShortestPathTree<TMetadata> | null {
  const start = nearestRoadGraphNode(graph, startPoint);
  if (!start) return null;
  const distances = new Map<string, number>([[start.key, 0]]);
  const previous = new Map<string, RoadGraphNode<TMetadata>>();
  const queue: QueueItem<TMetadata>[] = [{ node: start, cost: 0 }];
  const push = (item: QueueItem<TMetadata>): void => {
    queue.push(item);
    let index = queue.length - 1;
    while (index > 0) {
      const parent = Math.floor((index - 1) / 2);
      if (queue[parent].cost <= item.cost) break;
      queue[index] = queue[parent];
      index = parent;
    }
    queue[index] = item;
  };
  const pop = (): QueueItem<TMetadata> => {
    const first = queue[0];
    const last = queue.pop();
    if (queue.length && last) {
      let index = 0;
      while (true) {
        const left = index * 2 + 1;
        const right = left + 1;
        if (left >= queue.length) break;
        const child = right < queue.length && queue[right].cost < queue[left].cost ? right : left;
        if (queue[child].cost >= last.cost) break;
        queue[index] = queue[child];
        index = child;
      }
      queue[index] = last;
    }
    return first;
  };

  while (queue.length) {
    const current = pop();
    if (current.cost !== distances.get(current.node.key)) continue;
    if (options.stopAt && current.node === options.stopAt) break;
    for (const edge of current.node.edges) {
      const edgeCost = options.edgeCost?.({
        edge,
        from: current.node,
        to: edge.node,
        distance: edge.distance,
      }) ?? edge.distance;
      if (!Number.isFinite(edgeCost) || edgeCost < 0) {
        throw new RangeError(`Dijkstra edge cost must be finite and non-negative (received ${edgeCost})`);
      }
      const nextCost = current.cost + edgeCost;
      if (nextCost >= (distances.get(edge.node.key) ?? Infinity)) continue;
      distances.set(edge.node.key, nextCost);
      previous.set(edge.node.key, current.node);
      push({ node: edge.node, cost: nextCost });
    }
  }
  return { start, distances, previous };
}

export function reconstructRoadPath<TMetadata>(
  previous: ReadonlyMap<string, RoadGraphNode<TMetadata>>,
  endNode: RoadGraphNode<TMetadata>,
): RoadGraphPoint[] {
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
  const finish = nearestRoadGraphNode(graph, finishPoint);
  if (!finish) return [];
  const paths = shortestRoadPaths(graph, startPoint, { stopAt: finish, edgeCost });
  if (!paths?.distances.has(finish.key)) return [];
  return reconstructRoadPath(paths.previous, finish);
}

export function findRoadRouteToFirstReachable<TMetadata>(
  graph: RoadGraph<TMetadata>,
  startPoint: RoadGraphPoint,
  candidatePoints: readonly RoadGraphPoint[],
  edgeCost?: RoadGraphEdgeCost<TMetadata>,
): { index: number; path: RoadGraphPoint[] } | null {
  const paths = shortestRoadPaths(graph, startPoint, { edgeCost });
  if (!paths) return null;
  for (let index = 0; index < candidatePoints.length; index++) {
    const node = nearestRoadGraphNode(graph, candidatePoints[index]);
    if (!node || !paths.distances.has(node.key)) continue;
    const path = reconstructRoadPath(paths.previous, node);
    if (path.length >= 2) return { index, path };
  }
  return null;
}

function nodePath<TMetadata>(
  previous: ReadonlyMap<string, RoadGraphNode<TMetadata>>,
  endNode: RoadGraphNode<TMetadata>,
): RoadGraphNode<TMetadata>[] {
  const route: RoadGraphNode<TMetadata>[] = [];
  for (let node: RoadGraphNode<TMetadata> | undefined = endNode; node; node = previous.get(node.key)) {
    route.push(node);
  }
  return route.reverse();
}

function edgeBetween<TMetadata>(from: RoadGraphNode<TMetadata>, to: RoadGraphNode<TMetadata>) {
  return from.edges.find((edge) => edge.node === to);
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
  const familiarityPenalty = options.familiarityPenalty ?? 0.18;
  const maxDetourRatio = options.maxDetourRatio ?? 0.12;
  if (!(familiarityPenalty >= 0) || !(maxDetourRatio >= 0)) {
    throw new RangeError('Learning-route bounds must be non-negative');
  }
  const finish = nearestRoadGraphNode(graph, finishPoint);
  if (!finish) return null;
  const shortest = shortestRoadPaths(graph, startPoint, { stopAt: finish });
  if (!shortest?.distances.has(finish.key)) return null;

  const mastery = (edge: RoadGraphEdge<TMetadata>): number => {
    const names = [...new Set(options.namesForEdge(edge).filter(Boolean))];
    if (!names.length) return 0;
    return Math.max(...names.map((name) => Math.max(0, Math.min(1, options.masteryForName(name) || 0))));
  };
  const preferred = shortestRoadPaths(graph, startPoint, {
    stopAt: finish,
    edgeCost: ({ edge, distance }) => distance * (1 + familiarityPenalty * mastery(edge)),
  });
  const shortestNodes = nodePath(shortest.previous, finish);
  const preferredNodes = preferred?.distances.has(finish.key) ? nodePath(preferred.previous, finish) : shortestNodes;
  const physicalLength = (nodes: readonly RoadGraphNode<TMetadata>[]) => nodes.slice(1).reduce((sum, node, index) =>
    sum + (edgeBetween(nodes[index], node)?.distance ?? distanceBetween(nodes[index], node)), 0);
  const shortestDistance = physicalLength(shortestNodes);
  const preferredDistance = physicalLength(preferredNodes);
  const withinCap = shortestDistance === 0 || preferredDistance <= shortestDistance * (1 + maxDetourRatio + 1e-9);
  const selected = withinCap ? preferredNodes : shortestNodes;
  const physicalDistance = withinCap ? preferredDistance : shortestDistance;
  let newDistance = 0;
  for (let index = 1; index < selected.length; index++) {
    const edge = edgeBetween(selected[index - 1], selected[index]);
    if (edge && options.namesForEdge(edge).some(Boolean) && mastery(edge) < 0.5) newDistance += edge.distance;
  }
  return {
    path: selected.map(({ x, y }) => ({ x, y })),
    expectedNovelty: physicalDistance > 0 ? newDistance / physicalDistance : 0,
    physicalDistance,
    shortestDistance,
    detourRatio: shortestDistance > 0 ? physicalDistance / shortestDistance - 1 : 0,
    usedLearningBias: withinCap && selected.some((node, index) => node !== shortestNodes[index]),
  };
}
