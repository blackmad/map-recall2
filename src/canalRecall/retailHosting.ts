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
// Round 5 (lane retail-look-20261114): rule 1 yields to a much bigger shop next door (SPILL): a node inside a pand
// whose shop space is a kiosk-sized unit, within SPILL.nearM of a neighbour's street wall whose shop space is many
// times larger, belongs to the neighbour. Keurslagerij Pouw (Haarlemmerdijk 95, node 10829630288) sat in pand
// 0363100012176699 (23 m2 shop over a flat, the 5.9 m awning front) while its white 15 m shopfront is 0363100012165106
// (349 m2 shop), 2.8 m away.
// Pure: Node build (scripts/retail-ground/build-templates.ts) and tests.
import { bagAllowsShop, PAVEMENT_NODE_M, type PandUses } from './shopGate.js';

export const FRONT_SNAP_M = 6;
/** A street wall loses to an open wall this much nearer the node (m). */
export const NEAREST_MARGIN_M = 2;
/** Round 5: a kiosk-sized host (shop m2 <= hostMaxM2) yields to a neighbour within nearM whose shop m2 is >= minM2 and >= ratio x the host's. */
export const SPILL = { hostMaxM2: 25, minM2: 150, ratio: 10, nearM: 3.5 } as const;
/** A pand's shop space: its larger of retail (winkel) and horeca (bijeenkomst) m2, and which. */
function shopSpace(u: PandUses | undefined): { m2: number; use: 'winkelfunctie' | 'bijeenkomstfunctie' } {
  const w = u?.area.winkelfunctie ?? 0, b = u?.area.bijeenkomstfunctie ?? 0;
  return w >= b ? { m2: w, use: 'winkelfunctie' } : { m2: b, use: 'bijeenkomstfunctie' };
}
/** Round 5 (lane retail-real): a node within nodeM of a shop pand's wall, in a pand with no shop space, moves to it
 *  when that pand's street wall is no more than frontM further from the node than its own. */
export const PARTY = { nodeM: 1.0, frontM: 1.5 } as const;
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
  open: (c: FrontCandidate, e: ReturnType<typeof ringEdges>[number]) => boolean = () => true,
  /** Round 5: whether this POI may move to a much bigger shop next door (not a red-light window: those are kiosk-sized). */
  spill = false,
  /** Round 5 (lane retail-real): the PARTY move. Off: it lost its blind (1 win, 2 losses, 4 ties on 7 moved pands). */
  party = false): HostFront | null {
  const rows = candidates.map(c => {
    let front = Infinity, any = Infinity;
    for (const e of ringEdges(c.ring)) { const d = segDist(e.x0, e.y0, e.x1, e.y1, x, y); if (d < any && open(c, e)) any = d; if (d < front && streetFacing(c, e)) front = d; }
    return { c, inside: insideRing(c.ring, x, y), front, any, shop: bagAllowsShop(uses(c.id)) };
  });
  const best = (list: typeof rows, by: (r: (typeof rows)[number]) => number) => list.sort((p, q) => (Number(q.shop) - Number(p.shop)) || by(p) - by(q))[0];
  const inside = rows.filter(r => r.inside);
  const own = best(inside.filter(r => r.front <= FRONT_SNAP_M && r.front <= r.any + NEAREST_MARGIN_M), r => r.front);
  if (own) {
    // The neighbour must hold the same kind of shop space (retail or horeca) as the host.
    const mine = shopSpace(uses(own.c.id));
    const next = spill && mine.m2 > 0 && mine.m2 <= SPILL.hostMaxM2 ? rows.filter(r => r !== own && r.front <= SPILL.nearM).map(r => ({ r, s: shopSpace(uses(r.c.id)) })).filter(v => v.s.use === mine.use && v.s.m2 >= Math.max(SPILL.minM2, SPILL.ratio * mine.m2)).sort((p, q) => p.r.front - q.r.front)[0]?.r : undefined;
    if (next) return { id: next.c.id, front: 'street', inside: next.inside, distanceM: next.front };
    // Lane retail-real round 5 (PARTY): a node in a pand with no shop space at all, on the party wall of one that has
    // some, belongs to the neighbour (Toko Sunrise, OSM node 866385089: its node just inside the house next door).
    const partyHost = party && spill && !own.shop ? rows.filter(r => !r.inside && r.shop && r.front <= own.front + PARTY.frontM && ringEdges(r.c.ring).some(e => segDist(e.x0, e.y0, e.x1, e.y1, x, y) <= PARTY.nodeM)).sort((p, q) => p.front - q.front)[0] : undefined;
    if (partyHost) return { id: partyHost.c.id, front: 'street', inside: false, distanceM: partyHost.front };
    return { id: own.c.id, front: 'street', inside: true, distanceM: own.front };
  }
  const near = rows.filter(r => !r.inside && r.front <= FRONT_SNAP_M && (r.shop || r.front <= PAVEMENT_NODE_M)).sort((p, q) => p.front - q.front)[0];
  if (near) return { id: near.c.id, front: 'street', inside: near.inside, distanceM: near.front };
  const court = best(inside.filter(r => r.any <= FRONT_SNAP_M), r => r.any);
  if (court) return { id: court.c.id, front: 'nearest', inside: true, distanceM: court.any };
  // A node deep inside a large footprint (a supermarket in a block, a mall): the old rule, its nearest street wall.
  const deep = best(inside, r => r.front);
  if (deep) return { id: deep.c.id, front: deep.front < Infinity ? 'street' : 'nearest', inside: true, distanceM: Math.min(deep.front, deep.any) };
  return null;
}

/** Round 3b (lane retail-look-20261114): a stepped street wall reads as one shopfront. */
export const STEP = { offsetM: 0.9, jogM: 1.5, cos: 0.97 } as const;
export type RunEdge = { x0: number; y0: number; x1: number; y1: number; len: number; nx: number; ny: number };
export type SteppedRun<E extends RunEdge> = {
  /** The run as one wall frame: origin, unit direction and outward normal, length (m). */
  x0: number; y0: number; ux: number; uy: number; nx: number; ny: number; len: number;
  /** The parallel edges taken, each with its span on the run [t0, t1] and its set-back from the run's line (m, >= 0). */
  parts: Array<{ e: E; t0: number; t1: number; backM: number }>;
};
/**
 * The run of `best` along a stepped wall: BAG traces a shop block's street wall as short parallel pieces stepped by a few
 * decimetres (HEMA Ferdinand Bolstraat 93A, pand 0363100012233666: 4.3 m and 4.5 m pieces between 0.4-1.4 m jogs), and
 * a front on the one nearest piece drew a 4 m HEMA on what reads as the neighbour. Walks the ring from `best` both ways
 * by shared endpoints through jogs of at most STEP.jogM to edges parallel to it (cos > STEP.cos) within STEP.offsetM of
 * its line; the run's line is the outermost piece's. `best` alone when nothing joins it.
 */
export function steppedRun<E extends RunEdge>(best: E, ring: readonly E[]): SteppedRun<E> {
  const ux = (best.x1 - best.x0) / best.len, uy = (best.y1 - best.y0) / best.len;
  const key = (x: number, y: number) => `${Math.round(x * 100)},${Math.round(y * 100)}`;
  const from = new Map<string, E>(), to = new Map<string, E>();
  for (const e of ring) { from.set(key(e.x0, e.y0), e); to.set(key(e.x1, e.y1), e); }
  const off = (e: E) => (e.x0 - best.x0) * best.nx + (e.y0 - best.y0) * best.ny;
  const parallel = (e: E) => ((e.x1 - e.x0) * ux + (e.y1 - e.y0) * uy) / e.len > STEP.cos && Math.abs(off(e)) <= STEP.offsetM;
  const taken: E[] = [best];
  for (const dir of [1, -1] as const) {
    let at: E = best, jog = 0;
    for (let guard = 0; guard < ring.length; guard++) {
      const next = dir > 0 ? from.get(key(at.x1, at.y1)) : to.get(key(at.x0, at.y0));
      if (!next || next === best || taken.includes(next)) break;
      if (parallel(next)) { taken.push(next); jog = 0; } else if (next.len <= STEP.jogM && (jog += next.len) <= STEP.jogM) { /* a jog */ } else break;
      at = next;
    }
  }
  const t = (x: number, y: number) => (x - best.x0) * ux + (y - best.y0) * uy;
  let t0 = 0, t1 = best.len, out = 0;
  for (const e of taken) { t0 = Math.min(t0, t(e.x0, e.y0)); t1 = Math.max(t1, t(e.x1, e.y1)); out = Math.max(out, off(e)); }
  return {
    x0: best.x0 + ux * t0 + best.nx * out, y0: best.y0 + uy * t0 + best.ny * out, ux, uy, nx: best.nx, ny: best.ny, len: t1 - t0,
    parts: taken.map(e => ({ e, t0: t(e.x0, e.y0) - t0, t1: t(e.x1, e.y1) - t0, backM: out - off(e) })).sort((p, q) => p.t0 - q.t0),
  };
}
