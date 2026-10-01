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

export type RoadGraph<TMetadata = unknown> = Readonly<{
  nodes: ReadonlyMap<string, RoadGraphNode<TMetadata>>;
  allNodes: readonly RoadGraphNode<TMetadata>[];
  connectors: readonly RoadGraphConnector[];
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
  const connectors: RoadGraphConnector[] = [];
  // Below this a merge is the same vertex; above it the gap is rideable only
  // through a connector span.
  const CONNECTOR_MIN = 0.5;
  const spanGrid = new Map<string, IndexedSpan[]>();
  const keyFor = (point: RoadGraphPoint): string =>
    `${Math.round(point.x / mergeSize)},${Math.round(point.y / mergeSize)}`;
  const nodeFor = (point: RoadGraphPoint, segmentIndex = -1): RoadGraphNode<TMetadata> => {
    const key = keyFor(point);
    let node = nodes.get(key);
    if (!node) {
      node = { key, x: point.x, y: point.y, edges: [] };
      nodes.set(key, node);
    } else if (segmentIndex >= 0 && distanceBetween(point, node) > CONNECTOR_MIN) {
      // Merged onto another way's vertex up to a cell diagonal away (25 px at
      // mergeSize 18): the route jumps the gap, so the surface must span it.
      connectors.push({ a: point, b: { x: node.x, y: node.y }, segmentIndex });
    }
    return node;
  };
  const projectionNodeFor = (
    point: RoadGraphPoint,
    span: IndexedSpan,
  ): RoadGraphNode<TMetadata> => {
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
      const from = nodeFor(a, segmentIndex);
      const to = nodeFor(b, segmentIndex);
      link(from, to, segmentIndex, 'centreline');
      // A merged end sits up to a cell diagonal off its vertex, so the edge
      // the router plans along runs beside the span, not on it: over a long
      // span the planned line left the corridor by ~5 px mid-way (route
      // coverage, 2026-10-01: an unnamed way in Westpoort, Geldershoofd).
      // Cover the edge as planned, too.
      if (distanceBetween(a, from) > CONNECTOR_MIN || distanceBetween(b, to) > CONNECTOR_MIN) {
        connectors.push({ a: { x: from.x, y: from.y }, b: { x: to.x, y: to.y }, segmentIndex });
      }
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
        const projection = closestPointOnSegment(endpoint, span.a, span.b);
        if (projection.distance > junctionStitchRadius) continue;
        // Split the through span at the actual projected junction. Linking the
        // side street straight to the nearer *endpoint* of a long simplified
        // span made route paths cut diagonally across corners and buildings.
        const spanStart = nodes.get(keyFor(span.a));
        const spanEnd = nodes.get(keyFor(span.b));
        if (!spanStart || !spanEnd) continue;
        const target = distanceBetween(projection, span.a) < 1e-6
          ? spanStart
          : distanceBetween(projection, span.b) < 1e-6
            ? spanEnd
            : projectionNodeFor(projection, span);
        link(spanStart, target, span.segmentIndex, 'centreline');
        link(target, spanEnd, span.segmentIndex, 'centreline');
        link(from, target, span.segmentIndex, 'junction-stitch');
        if (projection.distance > CONNECTOR_MIN) {
          connectors.push({ a: endpoint, b: { x: projection.x, y: projection.y }, segmentIndex });
        }
      }
    }
  });

  return { nodes, allNodes: [...nodes.values()], connectors };
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
  const { via, ...direct } = options;
  const plan = planDirectLearningRoute(graph, startPoint, finishPoint, direct);
  if (!via || !plan || (Array.isArray(via) && !via.length)) return plan;
  const viaDetourRatio = options.viaDetourRatio ?? 0.4;
  const isPoint = (value: unknown): value is RoadGraphPoint => !Array.isArray(value);
  // A stretch with a dead-end end can only be ridden out and back, which the
  // repeat check below refuses anyway; dropping it first saves its planning.
  const through = (point: RoadGraphPoint) => (nearestRoadGraphNode(graph, point)?.edges.length ?? 0) >= 2;
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
    const keys = path.map(({ x, y }) => `${x},${y}`);
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
  const finish = nearestRoadGraphNode(graph, finishPoint);
  if (!finish) return null;
  const shortest = shortestRoadPaths(graph, startPoint, { stopAt: finish });
  if (!shortest?.distances.has(finish.key)) return null;

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
  const homeOutside = (from: RoadGraphNode<TMetadata>, to: RoadGraphNode<TMetadata>): number => {
    if (!homeBias) return 0;
    const midX = (from.x + to.x) * 0.5;
    const midY = (from.y + to.y) * 0.5;
    const dist = Math.hypot(midX - homeBias.x, midY - homeBias.y);
    return Math.max(0, Math.min(1, dist / homeBias.radius - 1));
  };
  const isDue = (edge: RoadGraphEdge<TMetadata>): boolean =>
    !!dueNames && options.namesForEdge(edge).some(name => name && dueNames.has(name));
  const preferred = shortestOnly ? null : shortestRoadPaths(graph, startPoint, {
    stopAt: finish,
    edgeCost: ({ edge, distance, from, to }) => isDue(edge)
      ? distance * (1 - dueDiscount + outsidePenalty * homeOutside(from, to))
      : distance * (1 + familiarityPenalty * mastery(edge) + outsidePenalty * homeOutside(from, to)),
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
  const dueOnPath = new Set<string>();
  for (let index = 1; index < selected.length; index++) {
    const edge = edgeBetween(selected[index - 1], selected[index]);
    if (edge && options.namesForEdge(edge).some(Boolean) && mastery(edge) < 0.5) newDistance += edge.distance;
    if (edge && dueNames) for (const name of options.namesForEdge(edge)) if (name && dueNames.has(name)) dueOnPath.add(name);
  }
  return {
    path: selected.map(({ x, y }) => ({ x, y })),
    expectedNovelty: physicalDistance > 0 ? newDistance / physicalDistance : 0,
    physicalDistance,
    shortestDistance,
    detourRatio: shortestDistance > 0 ? physicalDistance / shortestDistance - 1 : 0,
    usedLearningBias: withinCap && selected.some((node, index) => node !== shortestNodes[index]),
    dueNamesOnPath: [...dueOnPath].sort(),
  };
}
