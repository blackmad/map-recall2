import { closestPointOnSegment, type WorldPoint } from './roadProjection.ts';

type Span = { a: WorldPoint; b: WorldPoint; order: number };
type Node = { minX: number; minY: number; maxX: number; maxY: number; spans?: Span[]; left?: Node; right?: Node };
const distanceTo = (point: WorldPoint, node: Node) => Math.hypot(
  Math.max(node.minX - point.x, 0, point.x - node.maxX),
  Math.max(node.minY - point.y, 0, point.y - node.maxY),
);

/** Exact nearest road span for one installed, immutable network. */
export class RoadSnapIndex {
  private readonly root?: Node;
  constructor(segments: ReadonlyArray<{ points: WorldPoint[] }>) {
    const spans: Span[] = [];
    for (const segment of segments) for (let i = 1; i < segment.points.length; i++)
      spans.push({ a: segment.points[i - 1], b: segment.points[i], order: spans.length });
    const build = (items: Span[]): Node => {
      const node: Node = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
      for (const { a, b } of items) {
        node.minX = Math.min(node.minX, a.x, b.x); node.minY = Math.min(node.minY, a.y, b.y);
        node.maxX = Math.max(node.maxX, a.x, b.x); node.maxY = Math.max(node.maxY, a.y, b.y);
      }
      if (items.length <= 8) node.spans = items;
      else {
        const axis = node.maxX - node.minX >= node.maxY - node.minY ? 'x' : 'y';
        items.sort((a, b) => (a.a[axis] + a.b[axis]) - (b.a[axis] + b.b[axis]));
        const middle = Math.floor(items.length / 2);
        node.left = build(items.slice(0, middle)); node.right = build(items.slice(middle));
      }
      return node;
    };
    if (spans.length) this.root = build(spans);
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
