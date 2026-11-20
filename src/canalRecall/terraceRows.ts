/**
 * Post-war terraces outside the profiled city (feedback 0046bb, 2026-11-10, "these look weird, why?": Badhoevedorp,
 * Haarlemmermeer, pand 0394100000219929). A 1955 row of two-storey houses under one orange pantile saddle roof (PDOK
 * luchtfoto; 3DBAG: slanted, one ridge, eaves 5.8 m, ridge 8.5 m on every member) drew as a strip of unrelated houses:
 * every per-building prior (period wall, bay preset, roof material and tone) hashes the pand id, and outside the
 * profiled Amsterdam buurten nothing else ties a row together (no buurt profile, measured pool, row series or design
 * unit). This module finds such rows in a chunk's features and gives the members one seed, so the row draws as one
 * design, as the design units do for the Ring (designUnits/drawProps.ts seedIdOf).
 *
 * A row: footprints that share a party wall (two edges within 0.35 m of each other, parallel within 6 degrees,
 * overlapping at least 2 m), built within 2 years of each other, heights within 1.2 m. Only pands built 1945 or later,
 * with no buurt profile at their footprint and nothing stated about them (row series, design unit, kit, spec, recipe,
 * shed) take part. The seed is `terrace:<smallest member id>`. A row cut by a chunk edge splits into two seeds.
 *
 * `?terraceRows=1` (or globalThis.__canalRecallTerraceRows, or TERRACE_ROWS=1 in Node) turns it on; off, features pass
 * through untouched (byte-identical). Pure apart from the flag read.
 */
export type TerraceFeature = { type: 'Feature'; properties: Record<string, unknown>; geometry: unknown };

export const TERRACE_ROWS = { wallGapM: 0.35, parallelDeg: 6, minOverlapM: 2, yearSpan: 2, heightSpanM: 1.2, minYear: 1945 } as const;

/** The flag, read at call time (never at module load: bundles are evaluated in Node by the structure gate). */
export function terraceRowsOn(): boolean {
  const g = globalThis as { __canalRecallTerraceRows?: boolean; location?: { search?: string }; process?: { env?: Record<string, string | undefined> } };
  if (typeof g.__canalRecallTerraceRows === 'boolean') return g.__canalRecallTerraceRows;
  try {
    const q = new URLSearchParams(g.location?.search ?? '').get('terraceRows');
    if (q !== null) return q === '1';
  } catch { /* no location */ }
  return g.process?.env?.TERRACE_ROWS === '1';
}

/** The stamped seed, or null. */
export function terraceSeedOf(p: Record<string, unknown> | null | undefined): string | null {
  const s = p?.terraceSeed;
  return typeof s === 'string' && s.startsWith('terrace:') ? s : null;
}

type Edge = { ax: number; ay: number; bx: number; by: number; len: number; ux: number; uy: number };
const KX = 111_320 * Math.cos(52.37 * Math.PI / 180), KY = 110_540;

function outerRing(geometry: unknown): number[][] | null {
  const g = geometry as { type?: string; coordinates?: unknown } | null;
  if (!g) return null;
  const ring = g.type === 'Polygon' ? (g.coordinates as number[][][])?.[0] : g.type === 'MultiPolygon' ? (g.coordinates as number[][][][])?.[0]?.[0] : null;
  return Array.isArray(ring) && ring.length >= 4 ? ring : null;
}

function edgesOf(ring: number[][], lng0: number, lat0: number): Edge[] {
  const out: Edge[] = [];
  for (let i = 0; i + 1 < ring.length; i++) {
    const ax = (ring[i][0] - lng0) * KX, ay = (ring[i][1] - lat0) * KY, bx = (ring[i + 1][0] - lng0) * KX, by = (ring[i + 1][1] - lat0) * KY;
    const len = Math.hypot(bx - ax, by - ay);
    if (len >= TERRACE_ROWS.minOverlapM) out.push({ ax, ay, bx, by, len, ux: (bx - ax) / len, uy: (by - ay) / len });
  }
  return out;
}

/** Two footprint edges are one party wall: parallel, on one line within `wallGapM`, overlapping at least `minOverlapM`. */
export function shareWall(a: Edge, b: Edge): boolean {
  const cos = Math.abs(a.ux * b.ux + a.uy * b.uy);
  if (cos < Math.cos(TERRACE_ROWS.parallelDeg * Math.PI / 180)) return false;
  const off = (x: number, y: number) => Math.abs((x - a.ax) * -a.uy + (y - a.ay) * a.ux);
  if (off(b.ax, b.ay) > TERRACE_ROWS.wallGapM || off(b.bx, b.by) > TERRACE_ROWS.wallGapM) return false;
  const t0 = (b.ax - a.ax) * a.ux + (b.ay - a.ay) * a.uy, t1 = (b.bx - a.ax) * a.ux + (b.by - a.ay) * a.uy;
  return Math.min(a.len, Math.max(t0, t1)) - Math.max(0, Math.min(t0, t1)) >= TERRACE_ROWS.minOverlapM;
}

const STATED = ['rowSeries', 'rowFront', 'designUnit', 'kitWall', 'kitRoof', 'largeTier', 'frontCarrier', 'gardenShed', 'gardenRoom', 'houseSpec', 'specRecipe', 'landmarkId'];

/**
 * The members' seeds: pand id -> `terrace:<smallest id>` for every pand in a row of two or more. `profiled(lng, lat)`
 * says whether a buurt profile covers a point (those pands keep their own draw).
 */
export function terraceSeeds(features: readonly TerraceFeature[], profiled: (lng: number, lat: number) => boolean): Map<string, string> {
  type Node = { id: string; year: number; h: number; edges: Edge[]; box: [number, number, number, number] };
  const nodes: Node[] = [];
  let lng0 = NaN, lat0 = NaN;
  for (const f of features) {
    const p = f.properties ?? {}, id = String(p.id ?? ''), year = Number(p.constructionYear), h = Number(p.height);
    if (!id || p.constructionYear === null || p.constructionYear === undefined || !Number.isFinite(year) || year < TERRACE_ROWS.minYear || !(h > 0)) continue;
    if (STATED.some(k => p[k] !== undefined && p[k] !== null && p[k] !== false)) continue;
    const ring = outerRing(f.geometry);
    if (!ring) continue;
    if (!Number.isFinite(lng0)) { lng0 = ring[0][0]; lat0 = ring[0][1]; }
    if (profiled(ring[0][0], ring[0][1])) continue;
    const edges = edgesOf(ring, lng0, lat0);
    if (!edges.length) continue;
    const xs = edges.flatMap(e => [e.ax, e.bx]), ys = edges.flatMap(e => [e.ay, e.by]);
    nodes.push({ id, year, h, edges, box: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)] });
  }
  const parent = nodes.map((_, i) => i);
  const find = (i: number): number => { while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i]; } return i; };
  // Grid buckets (20 m) so a chunk of a few thousand pands stays near linear.
  const CELL = 20, grid = new Map<string, number[]>();
  nodes.forEach((n, i) => {
    for (let x = Math.floor(n.box[0] / CELL); x <= Math.floor(n.box[2] / CELL); x++) for (let y = Math.floor(n.box[1] / CELL); y <= Math.floor(n.box[3] / CELL); y++) {
      const k = `${x},${y}`; const l = grid.get(k); if (l) l.push(i); else grid.set(k, [i]);
    }
  });
  const tried = new Set<string>();
  for (const list of grid.values()) for (let a = 0; a < list.length; a++) for (let b = a + 1; b < list.length; b++) {
    const i = list[a], j = list[b], key = i < j ? `${i}:${j}` : `${j}:${i}`;
    if (tried.has(key)) continue;
    tried.add(key);
    const A = nodes[i], B = nodes[j], g = TERRACE_ROWS.wallGapM;
    if (A.box[0] > B.box[2] + g || B.box[0] > A.box[2] + g || A.box[1] > B.box[3] + g || B.box[1] > A.box[3] + g) continue;
    if (Math.abs(A.year - B.year) > TERRACE_ROWS.yearSpan || Math.abs(A.h - B.h) > TERRACE_ROWS.heightSpanM) continue;
    if (A.edges.some(ea => B.edges.some(eb => shareWall(ea, eb)))) parent[find(i)] = find(j);
  }
  const groups = new Map<number, Node[]>();
  nodes.forEach((n, i) => { const r = find(i); const l = groups.get(r); if (l) l.push(n); else groups.set(r, [n]); });
  const out = new Map<string, string>();
  for (const members of groups.values()) {
    if (members.length < 2) continue;
    const seed = `terrace:${members.map(m => m.id).sort()[0]}`;
    for (const m of members) out.set(m.id, seed);
  }
  return out;
}

/**
 * The chunk step: features with `terraceSeed` stamped on row members, each then passed through `restamp` (the roof
 * re-plan on the row's seed, roofMesh.ts replanTerraceRoof); with the flag off, the same array.
 */
export function withTerraceSeeds<T extends TerraceFeature>(features: T[], profiled: (lng: number, lat: number) => boolean, context: readonly TerraceFeature[] = [], restamp: (f: T) => T = f => f): T[] {
  if (!terraceRowsOn()) return features;
  // The chunk's context (its neighbours' features) joins the grouping, so a row cut by the chunk edge keeps one seed
  // when its far members are in the context; only the chunk's own features are stamped.
  const own = new Set(features.map(f => String(f.properties?.id ?? '')));
  const seeds = terraceSeeds([...features, ...context.filter(f => !own.has(String(f.properties?.id ?? '')))], profiled);
  if (!seeds.size) return features;
  return features.map(f => { const s = seeds.get(String(f.properties?.id ?? '')); return s ? restamp({ ...f, properties: { ...f.properties, terraceSeed: s } }) : f; });
}
