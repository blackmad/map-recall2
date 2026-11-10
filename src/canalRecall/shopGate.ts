// The shopfront gate (lane storefront-gate 2026-11-10): a ground floor is drawn as a shop only where a shop really is.
//
// Two pieces of evidence count:
//   1. an OSM shop/amenity POI on the building (scripts/build-shopfronts.ts, the direct path);
//   2. the BAG registers the pand for retail (winkelfunctie) or hospitality/assembly (bijeenkomstfunctie).
// A building that has neither is never given a guessed shop. In particular the busy-stretch inference (a building
// between shops borrows its nearest neighbour's kind) now needs BAG retail or horeca use, so a warehouse, an office
// or a block of flats between two shops keeps a quiet ground floor.
//
// BAG uses come from scripts/industrial/fetch-bag-uses.ts: per pand, floor area per gebruiksdoel for every
// verblijfsobject whose gebruiksdoel is not plain woonfunctie. A pand absent from that table has only housing or no
// verblijfsobject at all.

/** Per-pand registered floor area (m2) per gebruiksdoel, as written by fetch-bag-uses.ts. */
export interface PandUses { vbos: number; area: Record<string, number> }
export type BagUsesTable = Record<string, PandUses>;

/** The gebruiksdoelen that justify a shopfront: retail and hospitality/assembly (cafes, restaurants, bars). */
export const SHOP_USES = ['winkelfunctie', 'bijeenkomstfunctie'] as const;

export const USE_CLASSES = ['winkelfunctie', 'bijeenkomstfunctie', 'industriefunctie', 'kantoorfunctie', 'woonfunctie', 'other', 'unknown'] as const;
export type UseClass = (typeof USE_CLASSES)[number];

/** BAG says the pand holds a shop or a horeca/assembly unit. */
export const bagAllowsShop = (uses: PandUses | undefined): boolean =>
  !!uses && SHOP_USES.some(k => (uses.area[k] ?? 0) > 0);

/**
 * The census class of a pand: the retail or assembly use if it has one (the gate's own test), else the largest
 * registered non-housing use. Absent from the table: 'woonfunctie' (housing only), or 'unknown' when the pand has no
 * verblijfsobject in the register (told apart by `known`, the set of pands that do have one; omit it to get 'woonfunctie').
 */
export function useClassOf(uses: PandUses | undefined, hasHousingVbo = true): UseClass {
  if (!uses) return hasHousingVbo ? 'woonfunctie' : 'unknown';
  if ((uses.area.winkelfunctie ?? 0) > 0) return 'winkelfunctie';
  if ((uses.area.bijeenkomstfunctie ?? 0) > 0) return 'bijeenkomstfunctie';
  const ranked = Object.entries(uses.area).sort((a, b) => b[1] - a[1]);
  const top = ranked[0]?.[0];
  if (top === 'industriefunctie' || top === 'kantoorfunctie') return top;
  return top ? 'other' : 'unknown';
}

/** Where a pand's shopfront came from. */
export type ShopSource = 'poi' | 'busy-stretch';

export interface ShopPoint { x: number; y: number; kind: string }
export interface GateBuilding { id: string; cx: number; cy: number }

/**
 * Busy stretches: a building with no POI whose centre has `minBusinesses` or more businesses within `radiusM` borrows its
 * nearest one's kind, provided BAG registers retail or horeca in it (`gate`; false reproduces the pre-gate behaviour).
 * `near` returns the points around a building's centre. Returns the kinds given, and how many the gate refused.
 */
export function inferBusyStretch<K extends string>(
  buildings: readonly GateBuilding[],
  has: (id: string) => boolean,
  near: (b: GateBuilding) => Array<{ x: number; y: number; kind: K }>,
  uses: (id: string) => PandUses | undefined,
  options: { gate: boolean; minBusinesses?: number; radiusM?: number } = { gate: true },
): { given: Map<string, K>; refused: Map<string, K> } {
  const min = options.minBusinesses ?? 5, radius = options.radiusM ?? 40;
  const given = new Map<string, K>(), refused = new Map<string, K>();
  for (const b of buildings) {
    if (has(b.id)) continue;
    const around = near(b).filter(pt => Math.hypot(pt.x - b.cx, pt.y - b.cy) < radius);
    if (around.length < min) continue;
    around.sort((p, q) => Math.hypot(p.x - b.cx, p.y - b.cy) - Math.hypot(q.x - b.cx, q.y - b.cy));
    if (options.gate && !bagAllowsShop(uses(b.id))) refused.set(b.id, around[0].kind);
    else given.set(b.id, around[0].kind);
  }
  return { given, refused };
}

export interface HostCandidate { id: string; ring: [number, number][] }

/** Squared-free helpers kept local so the module stays dependency-free. */
const insideRing = (ring: [number, number][], x: number, y: number) => {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) { const [xi, yi] = ring[i], [xj, yj] = ring[j]; if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside; }
  return inside;
};
const edgeDist = (ring: [number, number][], x: number, y: number) => {
  let best = Infinity;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) { const [ax, ay] = ring[j], [bx, by] = ring[i], dx = bx - ax, dy = by - ay, l = dx * dx + dy * dy || 1, t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / l)); best = Math.min(best, Math.hypot(x - ax - t * dx, y - ay - t * dy)); }
  return best;
};

/** A POI drawn on the pavement in front of its shop sits this close to the footprint edge at most (m), for a pand BAG does not list as a shop. */
export const PAVEMENT_NODE_M = 2;
/** The old snap distance, still used for a pand BAG lists as retail or horeca. */
export const SNAP_M = 8;

export interface HostResult { id: string; inside: boolean; distanceM: number }

/**
 * The building an OSM business node belongs to. Inside a footprint wins (a BAG-listed shop among several containing
 * footprints is preferred). Otherwise the nearest footprint edge within SNAP_M that BAG lists as shop or horeca, else the
 * nearest within PAVEMENT_NODE_M whatever BAG says: a node 3-8 m off a warehouse is not the warehouse's shop.
 */
export function hostForPoi(candidates: readonly HostCandidate[], x: number, y: number, uses: (id: string) => PandUses | undefined, gate = true): HostResult | null {
  const containing = candidates.filter(b => insideRing(b.ring, x, y));
  if (containing.length) { const pick = containing.find(b => bagAllowsShop(uses(b.id))) ?? containing[0]; return { id: pick.id, inside: true, distanceM: 0 }; }
  let best: HostResult | null = null;
  for (const b of candidates) {
    const d = edgeDist(b.ring, x, y);
    const limit = !gate || bagAllowsShop(uses(b.id)) ? SNAP_M : PAVEMENT_NODE_M;
    if (d < limit && (!best || d < best.distanceM)) best = { id: b.id, inside: false, distanceM: d };
  }
  return best;
}

/**
 * OSM `shop=` values that mean a trade, workshop or storage business rather than a street shopfront. On a pand BAG does not
 * list as shop or horeca (a garage in an industrial unit, a wholesaler on a trading estate) they draw no shopfront; where
 * BAG lists retail the node counts as before.
 */
export const TRADE_SHOPS: ReadonlySet<string> = new Set(['car_repair', 'car_parts', 'tyres', 'wholesale', 'trade', 'storage_rental', 'industrial', 'machine_hire', 'truck', 'agrarian', 'repair']);
export const isTradeBusiness = (tags: Record<string, string>): boolean => !!tags.shop && TRADE_SHOPS.has(tags.shop);
