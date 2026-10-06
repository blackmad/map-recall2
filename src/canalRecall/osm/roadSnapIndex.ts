import { finishBatchedBuild, type BuildScheduling } from '../buildScheduling.ts';
import { closestPointOnSegment, type WorldPoint } from './roadProjection.ts';

type Span = { a: WorldPoint; b: WorldPoint; order: number };
type Node = { minX: number; minY: number; maxX: number; maxY: number; spans?: Span[]; left?: Node; right?: Node };
const distanceTo = (point: WorldPoint, node: Node) => Math.hypot(
  Math.max(node.minX - point.x, 0, point.x - node.maxX),
  Math.max(node.minY - point.y, 0, point.y - node.maxY),
);

function* roadSnapStages(segments: ReadonlyArray<{ points: WorldPoint[] }>): Generator<void, Node | undefined> {
  const spans: Span[] = [];
  for (const segment of segments) for (let i = 1; i < segment.points.length; i++) {
    spans.push({ a: segment.points[i - 1], b: segment.points[i], order: spans.length });
    if (spans.length % 1024 === 0) yield;
  }
  // Partition at the median without one uninterruptible full-array sort.
  function* partition(items: Span[], middle: number, axis: 'x' | 'y'): Generator<void> {
    const coordinate = (span: Span) => span.a[axis] + span.b[axis];
    let left = 0, right = items.length - 1, steps = 0;
    while (left < right) {
      const pivot = coordinate(items[(left + right) >>> 1]);
      let i = left, j = right;
      while (i <= j) {
        while (coordinate(items[i]) < pivot) { i++; if (++steps % 1024 === 0) yield; }
        while (coordinate(items[j]) > pivot) { j--; if (++steps % 1024 === 0) yield; }
        if (i <= j) { [items[i], items[j]] = [items[j], items[i]]; i++; j--; }
        if (++steps % 1024 === 0) yield;
      }
      if (middle <= j) right = j;
      else if (middle >= i) left = i;
      else break;
      yield;
    }
  }
  function* build(items: Span[]): Generator<void, Node> {
    const node: Node = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
    for (let i = 0; i < items.length; i++) {
      const { a, b } = items[i];
      node.minX = Math.min(node.minX, a.x, b.x); node.minY = Math.min(node.minY, a.y, b.y);
      node.maxX = Math.max(node.maxX, a.x, b.x); node.maxY = Math.max(node.maxY, a.y, b.y);
      if (i % 1024 === 0) yield;
    }
    if (items.length <= 8) node.spans = items;
    else {
      const middle = Math.floor(items.length / 2);
      yield* partition(items, middle, node.maxX - node.minX >= node.maxY - node.minY ? 'x' : 'y');
      node.left = yield* build(items.slice(0, middle));
      node.right = yield* build(items.slice(middle));
    }
    return node;
  }
  return spans.length ? yield* build(spans) : undefined;
}

/** Exact nearest road span for one installed, immutable network. */
export class RoadSnapIndex {
  private root?: Node;
  constructor(segments: ReadonlyArray<{ points: WorldPoint[] }>) {
    const stages = roadSnapStages(segments);
    let step = stages.next();
    while (!step.done) step = stages.next();
    this.root = step.value;
  }
  static async create(segments: ReadonlyArray<{ points: WorldPoint[] }>, scheduling: BuildScheduling = {}): Promise<RoadSnapIndex> {
    const index = new RoadSnapIndex([]);
    index.root = await finishBatchedBuild(roadSnapStages(segments), scheduling);
    return index;
  }
  nearest(point: WorldPoint): (WorldPoint & { distance: number }) | null {
    let best: (WorldPoint & { distance: number }) | null = null, order = Infinity;
    const visit = (node: Node): void => {
      if (best && distanceTo(point, node) > best.distance + 1e-8) return;
      if (node.spans) {
        for (const span of node.spans) {
          const candidate = closestPointOnSegment(point, span.a, span.b);
          // Keep the old source-order tie break, even when spatial traversal differs.
          if (!best || candidate.distance < best.distance || candidate.distance === best.distance && span.order < order) {
            best = candidate; order = span.order;
          }
        }
      } else {
        const a = node.left!, b = node.right!;
        if (distanceTo(point, a) <= distanceTo(point, b)) { visit(a); visit(b); }
        else { visit(b); visit(a); }
      }
    };
    if (this.root) visit(this.root);
    return best;
  }
}
