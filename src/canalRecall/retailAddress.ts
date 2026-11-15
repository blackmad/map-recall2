// Round 7 (lane retail-look-20261114): host a shop by its address before its geometry. An OSM shop node often sits a
// few metres off its unit, so the nearest street front can belong to the neighbour; when the node carries
// addr:street + addr:housenumber, the BAG verblijfsobject (VBO) with that address lies inside the right pand.
// scripts/retail-ground/build-templates.ts --addresses fetches the VBOs near each audited node (PDOK BAG OGC v2,
// cached under .cache/retail-ground/vbo/), finds the pand whose footprint holds the matching VBO and stages
// data/retail-ground/address-hosts.json; a plain build reads that file and hosts the node there.
// Pure: Node build and tests.

/** One BAG verblijfsobject, slimmed to what the match needs. */
export type Vbo = { street: string; short?: string; nr: number; letter?: string | null; add?: string | null; use: string; m2: number; at: [number, number] };
export type HouseNumber = { nr: number; letter: string; add: string };

/** "88", "252-H", "54B-H", "12 h", "86-88", "1E" → number, letter, toevoeging (upper case; '' when absent). */
export function parseHouseNumber(s: string | undefined): HouseNumber | null {
  const m = /^\s*(\d+)\s*([a-zA-Z](?![a-zA-Z]))?\s*(?:[-\s/]\s*([a-zA-Z0-9]+))?/.exec(s ?? '');
  if (!m) return null;
  const add = (m[3] ?? '').toUpperCase();
  // "86-88" is a range, not a toevoeging.
  return { nr: Number(m[1]), letter: (m[2] ?? '').toUpperCase(), add: /^\d+$/.test(add) ? '' : add };
}

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');

/** The VBOs carrying this address: same street (full or short name), same number; a stated letter must match;
 *  a stated toevoeging wins over the rest when one carries it. Shop uses first. */
export function matchAddress(street: string | undefined, housenumber: string | undefined, vbos: readonly Vbo[]): Vbo[] {
  const h = parseHouseNumber(housenumber);
  if (!street || !h) return [];
  const s = norm(street);
  let hits = vbos.filter(v => (norm(v.street) === s || (v.short && norm(v.short) === s)) && v.nr === h.nr && (!h.letter || (v.letter ?? '').toUpperCase() === h.letter));
  if (h.add) { const exact = hits.filter(v => (v.add ?? '').toUpperCase() === h.add); if (exact.length) hits = exact; }
  const shop = hits.filter(v => /winkel|bijeenkomst/.test(v.use));
  return shop.length ? shop : hits;
}

/** The pand holding the address: among `pands` whose ring holds a matching VBO, the one with the most matched shop
 *  m2. Null when the address matches nothing, or matches VBOs outside every candidate ring. */
export function addressPand<P extends { id: string; ring: readonly [number, number][] }>(hits: readonly Vbo[], pands: readonly P[], inside: (ring: readonly [number, number][], x: number, y: number) => boolean): P | null {
  const score = new Map<P, number>();
  for (const v of hits) for (const p of pands) if (inside(p.ring, v.at[0], v.at[1])) score.set(p, (score.get(p) ?? 0) + Math.max(1, v.m2));
  return [...score].sort((a, b) => b[1] - a[1] || (a[0].id < b[0].id ? -1 : 1))[0]?.[0] ?? null;
}

/** Round 8: the wall a shop fronts. On a corner pand the nearest wall to the OSM point can be the side street's; a
 *  node whose addr:street names one of the streets the pand faces is fronted on the ring edge nearest that street
 *  (its midpoint within STREET_WALL_M of a segment of that name). Returns the node's point moved onto that edge (the
 *  mesher picks the candidate wall nearest `at`), or null when no edge faces the named street or the nearest edge does. */
export const STREET_WALL_M = 25;
export type NamedSeg = { name: string; x0: number; y0: number; x1: number; y1: number };
const segDistM = (s: { x0: number; y0: number; x1: number; y1: number }, x: number, y: number) => {
  const dx = s.x1 - s.x0, dy = s.y1 - s.y0, l = dx * dx + dy * dy, t = l ? Math.max(0, Math.min(1, ((x - s.x0) * dx + (y - s.y0) * dy) / l)) : 0;
  return Math.hypot(x - s.x0 - dx * t, y - s.y0 - dy * t);
};
export function atOnStreetWall(ring: readonly [number, number][], x: number, y: number, street: string, segs: readonly NamedSeg[]): [number, number] | null {
  const want = norm(street), mine = segs.filter(s => norm(s.name) === want);
  if (!mine.length) return null;
  let best: { d: number; p: [number, number]; i: number } | null = null, nearest = -1, nd = Infinity;
  for (let i = 0; i + 1 < ring.length; i++) { if (Math.hypot(ring[i + 1][0] - ring[i][0], ring[i + 1][1] - ring[i][1]) < 2.5) continue; const d = segDistM({ x0: ring[i][0], y0: ring[i][1], x1: ring[i + 1][0], y1: ring[i + 1][1] }, x, y); if (d < nd) { nd = d; nearest = i; } }
  // One wall: the same edge, or a near-collinear piece of the same facade (the mesher's stepped run): parallel within
  // 15 degrees and its line within 1 m.
  const sameWall = (i: number, j: number) => {
    if (i === j) return true; if (i < 0 || j < 0) return false;
    const ax = ring[i + 1][0] - ring[i][0], ay = ring[i + 1][1] - ring[i][1], bx = ring[j + 1][0] - ring[j][0], by = ring[j + 1][1] - ring[j][1];
    const la = Math.hypot(ax, ay), lb = Math.hypot(bx, by), cos = (ax * bx + ay * by) / (la * lb);
    const off = Math.abs((ring[j][0] - ring[i][0]) * ay - (ring[j][1] - ring[i][1]) * ax) / la;
    return cos > Math.cos(Math.PI / 12) && off < 1;
  };
  for (let i = 0; i + 1 < ring.length; i++) {
    const e = { x0: ring[i][0], y0: ring[i][1], x1: ring[i + 1][0], y1: ring[i + 1][1] }, len = Math.hypot(e.x1 - e.x0, e.y1 - e.y0);
    if (len < 2.5) continue;
    const mx = (e.x0 + e.x1) / 2, my = (e.y0 + e.y1) / 2, d = Math.min(...mine.map(s => segDistM(s, mx, my)));
    if (d > STREET_WALL_M || (best && d >= best.d)) continue;
    const dx = e.x1 - e.x0, dy = e.y1 - e.y0, t = Math.max(0.1, Math.min(0.9, ((x - e.x0) * dx + (y - e.y0) * dy) / (len * len)));
    best = { d, p: [e.x0 + dx * t, e.y0 + dy * t], i };
  }
  // Only a corner needs it: when the nearest wall already faces the street, the point stays as it is.
  return best && !sameWall(best.i, nearest) ? best.p : null;
}
