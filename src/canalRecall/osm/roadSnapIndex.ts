import { finishBatchedBuild, type BuildScheduling } from '../buildScheduling.ts';
import { closestPointOnSegment, type WorldPoint } from './roadProjection.ts';

/**
 * The tree, packed (#130): node bounds in Float64 arrays, a node's children (or, for a leaf, its range of the
 * span permutation `ids`) in Int32 arrays, and each span as its way and point index into the ways it was built
 * from. The object tree (a node object per box, a span object per centreline piece) was 6.7 MB on the
 * ride-start heap; this is about 2.
 */
interface Packed {
  segments: ReadonlyArray<{ points: WorldPoint[] }>;
  spanSeg: Int32Array;
  spanPt: Int32Array;
  ids: Int32Array;
  minX: Float64Array; minY: Float64Array; maxX: Float64Array; maxY: Float64Array;
  /** Internal node: children. Leaf: left = −1 − lo, right = hi over `ids`. */
  left: Int32Array; right: Int32Array;
}

/**
 * A median-split box tree over the spans. Built in place over one index
 * permutation with the span midpoints in typed arrays: the earlier build
 * sliced both halves at every level and partitioned through a per-step
 * generator and a keyed `span.a[axis]` read, which made it the largest part
 * of the segment step at ride start (time to ride, #136). `nearest` returns
 * the minimum by (distance, source order), so the tree's exact shape does not
 * change any answer.
 */
function* roadSnapStages(segments: ReadonlyArray<{ points: WorldPoint[] }>): Generator<void, Packed | undefined> {
  const segList: number[] = [], ptList: number[] = [];
  for (let s = 0; s < segments.length; s++) for (let i = 1; i < segments[s].points.length; i++) {
    segList.push(s); ptList.push(i);
    if (segList.length % 4096 === 0) yield;
  }
  const count = segList.length;
  if (!count) return undefined;
  // A cancellation point before the tree, however few spans there are.
  yield;
  const spanSeg = Int32Array.from(segList), spanPt = Int32Array.from(ptList);
  const a = (id: number) => segments[spanSeg[id]].points[spanPt[id] - 1], b = (id: number) => segments[spanSeg[id]].points[spanPt[id]];
  // Twice the midpoint: the same key the old partition compared.
  const keyX = new Float64Array(count), keyY = new Float64Array(count);
  for (let i = 0; i < count; i++) {
    const p = a(i), q = b(i);
    keyX[i] = p.x + q.x;
    keyY[i] = p.y + q.y;
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
  // At most 2·count/8 + 1 nodes for leaves of up to 8 spans; trimmed at the end.
  const cap = Math.max(1, 2 * Math.ceil(count / 4));
  const minX = new Float64Array(cap), minY = new Float64Array(cap), maxX = new Float64Array(cap), maxY = new Float64Array(cap);
  const left = new Int32Array(cap), right = new Int32Array(cap);
  let nodes = 0, work = 0;
  function* build(lo: number, hi: number): Generator<void, number> {
    const node = nodes++;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (let k = lo; k < hi; k++) {
      const p = a(ids[k]), q = b(ids[k]);
      if (p.x < x0) x0 = p.x; if (q.x < x0) x0 = q.x;
      if (p.y < y0) y0 = p.y; if (q.y < y0) y0 = q.y;
      if (p.x > x1) x1 = p.x; if (q.x > x1) x1 = q.x;
      if (p.y > y1) y1 = p.y; if (q.y > y1) y1 = q.y;
    }
    minX[node] = x0; minY[node] = y0; maxX[node] = x1; maxY[node] = y1;
    work += hi - lo;
    if (work >= 8192) { work = 0; yield; }
    if (hi - lo <= 8) {
      left[node] = -1 - lo; right[node] = hi;
    } else {
      const middle = lo + Math.floor((hi - lo) / 2);
      select(lo, hi - 1, middle, x1 - x0 >= y1 - y0 ? keyX : keyY);
      left[node] = yield* build(lo, middle);
      right[node] = yield* build(middle, hi);
    }
    return node;
  }
  yield* build(0, count);
  return { segments, spanSeg, spanPt, ids, minX: minX.slice(0, nodes), minY: minY.slice(0, nodes), maxX: maxX.slice(0, nodes), maxY: maxY.slice(0, nodes), left: left.slice(0, nodes), right: right.slice(0, nodes) };
}

/** Exact nearest road span for one installed, immutable network. */
export class RoadSnapIndex {
  private tree?: Packed;
  constructor(segments: ReadonlyArray<{ points: WorldPoint[] }>) {
    const stages = roadSnapStages(segments);
    let step = stages.next();
    while (!step.done) step = stages.next();
    this.tree = step.value;
  }
  static async create(segments: ReadonlyArray<{ points: WorldPoint[] }>, scheduling: BuildScheduling = {}): Promise<RoadSnapIndex> {
    const index = new RoadSnapIndex([]);
    index.tree = await finishBatchedBuild(roadSnapStages(segments), scheduling);
    return index;
  }
  nearest(point: WorldPoint): (WorldPoint & { distance: number }) | null {
    const t = this.tree;
    if (!t) return null;
    let best: (WorldPoint & { distance: number }) | null = null, order = Infinity;
    const distanceTo = (node: number) => Math.hypot(
      Math.max(t.minX[node] - point.x, 0, point.x - t.maxX[node]),
      Math.max(t.minY[node] - point.y, 0, point.y - t.maxY[node]),
    );
    const visit = (node: number): void => {
      if (best && distanceTo(node) > best.distance + 1e-8) return;
      const l = t.left[node];
      if (l < 0) {
        for (let k = -1 - l, hi = t.right[node]; k < hi; k++) {
          const id = t.ids[k], points = t.segments[t.spanSeg[id]].points, at = t.spanPt[id];
          const candidate = closestPointOnSegment(point, points[at - 1], points[at]);
          // Keep the old source-order tie break, even when spatial traversal differs.
          if (!best || candidate.distance < best.distance || candidate.distance === best.distance && id < order) {
            best = candidate; order = id;
          }
        }
      } else {
        const r = t.right[node];
        if (distanceTo(l) <= distanceTo(r)) { visit(l); visit(r); }
        else { visit(r); visit(l); }
      }
    };
    visit(0);
    return best;
  }
}
