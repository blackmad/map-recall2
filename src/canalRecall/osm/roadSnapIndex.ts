import { finishBatchedBuild, type BuildScheduling } from '../buildScheduling.ts';
import { closestPointOnSegment, type WorldPoint } from './roadProjection.ts';

type Span = { a: WorldPoint; b: WorldPoint; order: number };
type Node = { minX: number; minY: number; maxX: number; maxY: number; spans?: Span[]; left?: Node; right?: Node };
const distanceTo = (point: WorldPoint, node: Node) => Math.hypot(
  Math.max(node.minX - point.x, 0, point.x - node.maxX),
  Math.max(node.minY - point.y, 0, point.y - node.maxY),
);

/**
 * A median-split box tree over the spans. Built in place over one index
 * permutation with the span midpoints in typed arrays: the earlier build
 * sliced both halves at every level and partitioned through a per-step
 * generator and a keyed `span.a[axis]` read, which made it the largest part
 * of the segment step at ride start (time to ride, #136). `nearest` returns
 * the minimum by (distance, source order), so the tree's exact shape does not
 * change any answer.
 */
function* roadSnapStages(segments: ReadonlyArray<{ points: WorldPoint[] }>): Generator<void, Node | undefined> {
  const spans: Span[] = [];
  for (const segment of segments) for (let i = 1; i < segment.points.length; i++) {
    spans.push({ a: segment.points[i - 1], b: segment.points[i], order: spans.length });
    if (spans.length % 4096 === 0) yield;
  }
  const count = spans.length;
  if (!count) return undefined;
  // A cancellation point before the tree, however few spans there are.
  yield;
  // Twice the midpoint: the same key the old partition compared.
  const keyX = new Float64Array(count), keyY = new Float64Array(count);
  for (let i = 0; i < count; i++) {
    keyX[i] = spans[i].a.x + spans[i].b.x;
    keyY[i] = spans[i].a.y + spans[i].b.y;
  }
  const ids = new Int32Array(count);
  for (let i = 0; i < count; i++) ids[i] = i;
  /** Hoare quickselect on ids[lo..hi]: afterwards key(ids[k]) <= key(ids[middle]) <= key(ids[m]) for k < middle < m. */
  const select = (lo: number, hi: number, middle: number, key: Float64Array): void => {
    let left = lo, right = hi;
    while (left < right) {
      const pivot = key[ids[(left + right) >>> 1]];
      let i = left, j = right;
      while (i <= j) {
        while (key[ids[i]] < pivot) i++;
        while (key[ids[j]] > pivot) j--;
        if (i <= j) { const t = ids[i]; ids[i] = ids[j]; ids[j] = t; i++; j--; }
      }
      if (middle <= j) right = j;
      else if (middle >= i) left = i;
      else break;
    }
  };
  let work = 0;
  function* build(lo: number, hi: number): Generator<void, Node> {
    const node: Node = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
    for (let k = lo; k < hi; k++) {
      const { a, b } = spans[ids[k]];
      if (a.x < node.minX) node.minX = a.x; if (b.x < node.minX) node.minX = b.x;
      if (a.y < node.minY) node.minY = a.y; if (b.y < node.minY) node.minY = b.y;
      if (a.x > node.maxX) node.maxX = a.x; if (b.x > node.maxX) node.maxX = b.x;
      if (a.y > node.maxY) node.maxY = a.y; if (b.y > node.maxY) node.maxY = b.y;
    }
    work += hi - lo;
    if (work >= 8192) { work = 0; yield; }
    if (hi - lo <= 8) {
      node.spans = [];
      for (let k = lo; k < hi; k++) node.spans.push(spans[ids[k]]);
    } else {
      const middle = lo + Math.floor((hi - lo) / 2);
      select(lo, hi - 1, middle, node.maxX - node.minX >= node.maxY - node.minY ? keyX : keyY);
      node.left = yield* build(lo, middle);
      node.right = yield* build(middle, hi);
    }
    return node;
  }
  return yield* build(0, count);
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
