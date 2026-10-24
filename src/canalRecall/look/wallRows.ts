/**
 * Rows for wall colour coherence (look/measuredWalls.ts): pands that share a party wall (or stand within a few
 * decimetres of each other along a parallel wall) and were built within ROW_YEAR_GAP years of each other form one row
 * and share a base wall tone. Computed offline (scripts/look/build-wall-rows.ts) into the building-facts tiles' `rows`
 * (pand short id -> row seed), so the runtime needs no neighbour information. Pure: no I/O.
 *
 * BAG outlines of a terrace share their party walls (identical or near-identical edges); OSM-only outlines and
 * redrawn pands drift by a few decimetres, hence the gap tolerance and the overlap length.
 */
export type RowBuilding = { id: string; ring: readonly (readonly [number, number])[]; year: number | null };

/** Two walls are one party wall when parallel within maxAngleDeg, at most maxGapM apart and overlapping minOverlapM. */
export const PARTY_WALL = { maxGapM: 0.6, minOverlapM: 2, maxAngleDeg: 10 } as const;
/** BAG years of two neighbours in one row differ by at most this. */
export const ROW_YEAR_GAP = 3;

const KY = 110_540, kxAt = (lat: number) => 111_320 * Math.cos((lat * Math.PI) / 180);

type Edge = { b: number; ax: number; ay: number; bx: number; by: number; ux: number; uy: number; len: number };

/** Index pairs [i, j] (i < j) of buildings that share a party wall. `refLat` fixes the metre projection. */
export function partyWallPairs(buildings: readonly RowBuilding[], refLat = 52.37, opts = PARTY_WALL): [number, number][] {
  const kx = kxAt(refLat), cell = 4, grid = new Map<string, number[]>(), edges: Edge[] = [];
  const cos = Math.cos((opts.maxAngleDeg * Math.PI) / 180);
  buildings.forEach((building, b) => {
    const ring = building.ring;
    for (let i = 0; i + 1 < ring.length; i++) {
      const ax = ring[i][0] * kx, ay = ring[i][1] * KY, bx = ring[i + 1][0] * kx, by = ring[i + 1][1] * KY;
      const len = Math.hypot(bx - ax, by - ay);
      if (len < opts.minOverlapM) continue;
      const e = edges.push({ b, ax, ay, bx, by, ux: (bx - ax) / len, uy: (by - ay) / len, len }) - 1;
      const pad = opts.maxGapM;
      for (let gx = Math.floor((Math.min(ax, bx) - pad) / cell); gx <= Math.floor((Math.max(ax, bx) + pad) / cell); gx++)
        for (let gy = Math.floor((Math.min(ay, by) - pad) / cell); gy <= Math.floor((Math.max(ay, by) + pad) / cell); gy++) {
          const k = `${gx},${gy}`, list = grid.get(k);
          if (list) list.push(e); else grid.set(k, [e]);
        }
    }
  });
  const seen = new Set<string>(), pairs: [number, number][] = [];
  for (const list of grid.values()) for (let p = 0; p < list.length; p++) for (let q = p + 1; q < list.length; q++) {
    const e = edges[list[p]], f = edges[list[q]];
    if (e.b === f.b) continue;
    const i = Math.min(e.b, f.b), j = Math.max(e.b, f.b), key = `${i},${j}`;
    if (seen.has(key)) continue;
    if (Math.abs(e.ux * f.ux + e.uy * f.uy) < cos) continue;
    // f's endpoints in e's frame: along (t) and across (d).
    const t1 = (f.ax - e.ax) * e.ux + (f.ay - e.ay) * e.uy, t2 = (f.bx - e.ax) * e.ux + (f.by - e.ay) * e.uy;
    const d1 = (f.ax - e.ax) * -e.uy + (f.ay - e.ay) * e.ux, d2 = (f.bx - e.ax) * -e.uy + (f.by - e.ay) * e.ux;
    if (Math.abs(d1) > opts.maxGapM || Math.abs(d2) > opts.maxGapM) continue;
    const overlap = Math.min(e.len, Math.max(t1, t2)) - Math.max(0, Math.min(t1, t2));
    if (overlap < opts.minOverlapM) continue;
    seen.add(key); pairs.push([i, j]);
  }
  return pairs;
}

/**
 * Rows: connected components of the party-wall graph whose edges join buildings with known years at most `yearGap`
 * apart. Returns building id -> row seed (the component's smallest id) for components of two or more.
 */
export function wallRows(buildings: readonly RowBuilding[], pairs: readonly (readonly [number, number])[], yearGap = ROW_YEAR_GAP): Map<string, string> {
  const parent = buildings.map((_, i) => i);
  const find = (i: number): number => { while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i]; } return i; };
  for (const [i, j] of pairs) {
    const a = buildings[i].year, b = buildings[j].year;
    if (a === null || b === null || Math.abs(a - b) > yearGap) continue;
    const ri = find(i), rj = find(j);
    if (ri !== rj) parent[ri] = rj;
  }
  const members = new Map<number, string[]>();
  buildings.forEach((b, i) => { const r = find(i); const m = members.get(r); if (m) m.push(b.id); else members.set(r, [b.id]); });
  const out = new Map<string, string>();
  for (const ids of members.values()) {
    if (ids.length < 2) continue;
    const seed = ids.reduce((a, b) => (b < a ? b : a));
    for (const id of ids) out.set(id, seed);
  }
  return out;
}

/** A row seed as the facts tiles carry it: base-36 FNV-1a of the seed id (6-7 characters, same for every member). */
export function rowSeedKey(seedId: string): string {
  let h = 2166136261;
  for (let i = 0; i < seedId.length; i++) { h ^= seedId.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(36);
}

/** A facts tile's `rows` ([seed, index into Object.keys(buildings), ...][]) as short id -> row seed. */
export function decodeWallRows(buildings: Record<string, unknown>, rows: unknown): Map<string, string> {
  const out = new Map<string, string>();
  if (!Array.isArray(rows)) return out;
  const keys = Object.keys(buildings);
  for (const row of rows) {
    if (!Array.isArray(row) || typeof row[0] !== 'string') continue;
    for (let i = 1; i < row.length; i++) { const k = keys[row[i]]; if (typeof k === 'string') out.set(k, row[0]); }
  }
  return out;
}
