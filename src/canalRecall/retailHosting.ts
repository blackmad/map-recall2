// Which pand, and which of its walls, a template POI's shopfront goes on (lane retail-ground round 2). shopGate.ts
// hostForPoi took the footprint the node fell in, and the mesher then put the front on that pand's street wall nearest
// the node, however far: an AH to go in a petrol station's building got its fascia on the street side, the car wash
// (Nieuwe Hemweg 11, pand 0363100012239989). Now the front must be within FRONT_SNAP_M of the node:
//   1. the containing footprint's street-facing wall within FRONT_SNAP_M (BAG shop/horeca preferred), unless an open
//      (not party) wall is nearer the node by more than NEAREST_MARGIN_M: a node sits by its entrance;
//   2. else any footprint's street-facing wall within FRONT_SNAP_M (a node on the pavement, or in the neighbour's
//      corner), BAG-gated as shopGate (non-shop pands only within PAVEMENT_NODE_M);
//   3. else the containing footprint, its front on the wall nearest the node whatever faces it (`front: 'nearest'`:
//      a forecourt, a courtyard, a square that is not a mapped street);
//   4. else a node deep inside a large footprint (more than FRONT_SNAP_M from any open wall: a supermarket in a block)
//      keeps the old rule, its pand's street wall nearest the node;
//   5. else nothing.
// Pure: Node build (scripts/retail-ground/build-templates.ts) and tests.
import { bagAllowsShop, PAVEMENT_NODE_M, type PandUses } from './shopGate.js';

export const FRONT_SNAP_M = 6;
/** A street wall loses to an open wall this much nearer the node (m). */
export const NEAREST_MARGIN_M = 2;
export type FrontCandidate = { id: string; ring: [number, number][] };
export type HostFront = { id: string; front: 'street' | 'nearest'; inside: boolean; distanceM: number };

export function insideRing(ring: readonly [number, number][], x: number, y: number): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) { const [xi, yi] = ring[i], [xj, yj] = ring[j]; if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside; }
  return inside;
}
export function segDist(ax: number, ay: number, bx: number, by: number, x: number, y: number): number {
  const dx = bx - ax, dy = by - ay, l = dx * dx + dy * dy || 1, t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / l));
  return Math.hypot(x - ax - t * dx, y - ay - t * dy);
}
/** A ring's edges with outward unit normals (either winding). */
export function ringEdges(ring: readonly [number, number][]): Array<{ x0: number; y0: number; x1: number; y1: number; nx: number; ny: number; len: number }> {
  let area = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) area += ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1];
  const s = area > 0 ? 1 : -1, out = [];
  for (let i = 0; i + 1 < ring.length; i++) {
    const [x0, y0] = ring[i], [x1, y1] = ring[i + 1], len = Math.hypot(x1 - x0, y1 - y0);
    if (len < 1e-6) continue;
    out.push({ x0, y0, x1, y1, len, nx: s * (y1 - y0) / len, ny: -s * (x1 - x0) / len });
  }
  return out;
}

/**
 * The host and front for a node at (x, y). `streetFacing(candidate, edge)` says whether that wall faces a street
 * (the mesher's rule: streetFronts.ts streetDistance, unobstructed within its reach); `open(candidate, edge)` whether it
 * is not a party wall (nothing stands right in front of it).
 */
export function hostOnFront(candidates: readonly FrontCandidate[], x: number, y: number, uses: (id: string) => PandUses | undefined,
  streetFacing: (c: FrontCandidate, e: ReturnType<typeof ringEdges>[number]) => boolean,
  open: (c: FrontCandidate, e: ReturnType<typeof ringEdges>[number]) => boolean = () => true): HostFront | null {
  const rows = candidates.map(c => {
    let front = Infinity, any = Infinity;
    for (const e of ringEdges(c.ring)) { const d = segDist(e.x0, e.y0, e.x1, e.y1, x, y); if (d < any && open(c, e)) any = d; if (d < front && streetFacing(c, e)) front = d; }
    return { c, inside: insideRing(c.ring, x, y), front, any, shop: bagAllowsShop(uses(c.id)) };
  });
  const best = (list: typeof rows, by: (r: (typeof rows)[number]) => number) => list.sort((p, q) => (Number(q.shop) - Number(p.shop)) || by(p) - by(q))[0];
  const inside = rows.filter(r => r.inside);
  const own = best(inside.filter(r => r.front <= FRONT_SNAP_M && r.front <= r.any + NEAREST_MARGIN_M), r => r.front);
  if (own) return { id: own.c.id, front: 'street', inside: true, distanceM: own.front };
  const near = rows.filter(r => !r.inside && r.front <= FRONT_SNAP_M && (r.shop || r.front <= PAVEMENT_NODE_M)).sort((p, q) => p.front - q.front)[0];
  if (near) return { id: near.c.id, front: 'street', inside: near.inside, distanceM: near.front };
  const court = best(inside.filter(r => r.any <= FRONT_SNAP_M), r => r.any);
  if (court) return { id: court.c.id, front: 'nearest', inside: true, distanceM: court.any };
  // A node deep inside a large footprint (a supermarket in a block, a mall): the old rule, its nearest street wall.
  const deep = best(inside, r => r.front);
  if (deep) return { id: deep.c.id, front: deep.front < Infinity ? 'street' : 'nearest', inside: true, distanceM: Math.min(deep.front, deep.any) };
  return null;
}
