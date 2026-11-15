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
