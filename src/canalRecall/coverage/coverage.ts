/**
 * Coverage map: per Amsterdam buurt, which share of BAG pands each drawing tier
 * owns, how repetitive the buurt's building stock is, and whether a street
 * survey or block-face type library already reaches it.
 *
 * Pure and typed; `scripts/coverage/build-coverage.ts` does the IO (buurt
 * polygons from api.data.amsterdam.nl, BAG base tiles, the model catalogues)
 * and `docs/coverage/index.html` reads the output.
 *
 * Repetition proxy: every pand gets a cluster key from its footprint width
 * (short side of the minimum-area rectangle, 1 m bins), BAG/3DBAG height
 * (3 m bins, about a storey) and build year (5-year bins). A buurt's repetition
 * score is the share of its pands in its three largest clusters. Sheds, garage
 * boxes and annexes (under 3.5 m or 20 m²) are left out of it. Pands without a
 * height or a year stay in the denominator and in no cluster, so missing data
 * lowers the score rather than inflating it.
 */

export type LngLat = [number, number];
export type Ring = LngLat[];

/**
 * Drawing tiers, highest precedence first: a pand two sources claim is counted
 * once, under the earlier tier. `defaultOn` says whether the game draws the tier
 * without a URL flag today (2026-10-16).
 */
export const TIERS = [
  { id: 'bespoke', label: 'Bespoke landmark', defaultOn: true, note: 'manual/signature landmark catalogue GLBs (incl. manual ordinary blocks)' },
  { id: 'chunk', label: 'Block-face kit chunk', defaultOn: true, note: 'ordinary-buildings-data/chunks.json; default since 2026-10-16 (?streetChunks=retired hides them)' },
  { id: 'largeRecipe', label: 'Large-tier recipe', defaultOn: true, note: 'ordinary catalogue, source building-recipes-large' },
  { id: 'houseRecipe', label: 'Per-house recipe GLB', defaultOn: false, note: 'ordinary catalogue, category street-survey; ?streetChunks=0 (retired by default)' },
  { id: 'ordinaryGlb', label: 'Hand-built ordinary GLB', defaultOn: true, note: 'ordinary catalogue, category ordinary, hand-built (no recipe source)' },
  { id: 'buildingType', label: 'Building-type instance', defaultOn: true, note: 'building-types/instances.json; default since 2026-10-16 (?buildingTypes=0 hides them)' },
  { id: 'landmarkKit', label: 'Landmark kit on extrusion', defaultOn: true, note: 'landmarkKits.ts KITS (towers/roofs/halls on the BAG/OSM parts)' },
  { id: 'generic', label: 'Generic extrusion', defaultOn: true, note: 'everything else (era facade grammar / large-tier generic facade)' },
] as const;
export type TierId = typeof TIERS[number]['id'];
export const TIER_IDS: readonly TierId[] = TIERS.map(t => t.id);
const RANK: Record<TierId, number> = Object.fromEntries(TIER_IDS.map((id, i) => [id, i])) as Record<TierId, number>;
/** Tiers counted as "modelled" (everything that is not the generic extrusion). */
export const MODELLED_TIERS: readonly TierId[] = TIER_IDS.filter(t => t !== 'generic');
export const DEFAULT_ON_TIERS: ReadonlySet<TierId> = new Set(TIERS.filter(t => t.defaultOn && t.id !== 'generic').map(t => t.id));

/** Record `tier` for `pand`, keeping the higher-precedence tier on a conflict. Returns true when it changed. */
export function claim(map: Map<string, TierId>, pand: string, tier: TierId): boolean {
  const prior = map.get(pand);
  if (prior !== undefined && RANK[prior] <= RANK[tier]) return false;
  map.set(pand, tier);
  return true;
}

// ---------------------------------------------------------------------------
// Geometry
// ---------------------------------------------------------------------------

const M_PER_DEG_LAT = 111_320;

/** Equirectangular metres around `lat0`; fine at buurt scale. */
export const toMetres = (ring: Ring, lat0: number): [number, number][] => {
  const kx = M_PER_DEG_LAT * Math.cos(lat0 * Math.PI / 180);
  return ring.map(([x, y]) => [x * kx, y * M_PER_DEG_LAT]);
};

function convexHull(points: [number, number][]): [number, number][] {
  const p = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (p.length < 3) return p;
  const cross = (o: number[], a: number[], b: number[]) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower: [number, number][] = [], upper: [number, number][] = [];
  for (const q of p) { while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], q) <= 0) lower.pop(); lower.push(q); }
  for (let i = p.length - 1; i >= 0; i--) { const q = p[i]; while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], q) <= 0) upper.pop(); upper.push(q); }
  return [...lower.slice(0, -1), ...upper.slice(0, -1)];
}

/** Minimum-area bounding rectangle of a footprint ring: `[short, long]` sides in metres. */
export function rectSides(ring: Ring): [number, number] {
  if (ring.length < 3) return [0, 0];
  const hull = convexHull(toMetres(ring, ring[0][1]));
  if (hull.length < 3) return [0, 0];
  let best: [number, number] = [0, 0], bestArea = Infinity;
  for (let i = 0; i < hull.length; i++) {
    const a = hull[i], b = hull[(i + 1) % hull.length];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (len < 1e-9) continue;
    const ux = (b[0] - a[0]) / len, uy = (b[1] - a[1]) / len;
    let minU = Infinity, maxU = -Infinity, minV = Infinity, maxV = -Infinity;
    for (const [x, y] of hull) {
      const u = x * ux + y * uy, v = -x * uy + y * ux;
      if (u < minU) minU = u; if (u > maxU) maxU = u; if (v < minV) minV = v; if (v > maxV) maxV = v;
    }
    const w = maxU - minU, h = maxV - minV;
    if (w * h < bestArea) { bestArea = w * h; best = w < h ? [w, h] : [h, w]; }
  }
  return best;
}

/** Even-odd point-in-polygon over all rings of one polygon (outer + holes). */
export function inPolygon(pt: LngLat, rings: readonly Ring[]): boolean {
  let inside = false;
  for (const ring of rings) {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i], [xj, yj] = ring[j];
      if ((yi > pt[1]) !== (yj > pt[1]) && pt[0] < (xj - xi) * (pt[1] - yi) / (yj - yi) + xi) inside = !inside;
    }
  }
  return inside;
}

/** Polygon or MultiPolygon coordinates as a list of polygons (each a list of rings). */
export type Polygons = Ring[][];
export function polygonsOf(geometry: { type: string; coordinates: unknown }): Polygons {
  if (geometry.type === 'Polygon') return [geometry.coordinates as Ring[]];
  if (geometry.type === 'MultiPolygon') return geometry.coordinates as Ring[][];
  return [];
}

function perpDist(p: LngLat, a: LngLat, b: LngLat): number {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const len2 = dx * dx + dy * dy;
  if (!len2) return Math.hypot(p[0] - a[0], p[1] - a[1]);
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2));
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
}

/** Douglas–Peucker on a closed ring (tolerance in degrees), coordinates rounded to 5 decimals (~1 m). */
export function simplifyRing(ring: Ring, tolerance: number): Ring {
  if (ring.length <= 4) return ring.map(([x, y]) => [round5(x), round5(y)]);
  const keep = new Uint8Array(ring.length);
  keep[0] = keep[ring.length - 1] = 1;
  const stack: [number, number][] = [[0, ring.length - 1]];
  while (stack.length) {
    const [s, e] = stack.pop()!;
    let worst = -1, idx = -1;
    for (let i = s + 1; i < e; i++) { const d = perpDist(ring[i], ring[s], ring[e]); if (d > worst) { worst = d; idx = i; } }
    if (idx >= 0 && worst > tolerance) { keep[idx] = 1; stack.push([s, idx], [idx, e]); }
  }
  // A closed ring's first and last points coincide, so DP over it alone can collapse it: keep the farthest point too.
  if (ring.length > 3) {
    let far = 1, fd = -1;
    for (let i = 1; i < ring.length - 1; i++) { const d = Math.hypot(ring[i][0] - ring[0][0], ring[i][1] - ring[0][1]); if (d > fd) { fd = d; far = i; } }
    keep[far] = 1;
  }
  const out = ring.filter((_, i) => keep[i]).map(([x, y]) => [round5(x), round5(y)] as LngLat);
  return out.length >= 4 ? out : ring.map(([x, y]) => [round5(x), round5(y)]);
}
const round5 = (v: number) => Math.round(v * 1e5) / 1e5;

// ---------------------------------------------------------------------------
// Buurt assignment
// ---------------------------------------------------------------------------

export type Buurt = { code: string; name: string; polygons: Polygons; bbox: [number, number, number, number] };

export function bboxOf(polygons: Polygons): [number, number, number, number] {
  let w = Infinity, s = Infinity, e = -Infinity, n = -Infinity;
  for (const poly of polygons) for (const [x, y] of poly[0] ?? []) { if (x < w) w = x; if (x > e) e = x; if (y < s) s = y; if (y > n) n = y; }
  return [w, s, e, n];
}

/** Grid index over buurt bounding boxes; `locate` returns the code of the buurt holding a point, or null. */
export function buurtLocator(buurten: readonly Buurt[], cell = 0.01): (pt: LngLat) => string | null {
  const grid = new Map<string, Buurt[]>();
  const key = (i: number, j: number) => `${i}:${j}`;
  for (const b of buurten) {
    const [w, s, e, n] = b.bbox;
    for (let i = Math.floor(w / cell); i <= Math.floor(e / cell); i++) for (let j = Math.floor(s / cell); j <= Math.floor(n / cell); j++) {
      const k = key(i, j); const list = grid.get(k); if (list) list.push(b); else grid.set(k, [b]);
    }
  }
  return pt => {
    for (const b of grid.get(key(Math.floor(pt[0] / cell), Math.floor(pt[1] / cell))) ?? []) {
      const [w, s, e, n] = b.bbox;
      if (pt[0] < w || pt[0] > e || pt[1] < s || pt[1] > n) continue;
      if (b.polygons.some(poly => inPolygon(pt, poly))) return b.code;
    }
    return null;
  };
}

// ---------------------------------------------------------------------------
// Repetition
// ---------------------------------------------------------------------------

export type PandRecord = { id: string; centroid: LngLat; ring: Ring; height?: number; year?: number };
export const WIDTH_BIN_M = 1, HEIGHT_BIN_M = 3, YEAR_BIN = 5;
/** Below either limit a pand is a shed, garage box or annex: drawn (and counted per tier) but left out of repetition. */
export const MINOR_HEIGHT_M = 3.5, MINOR_AREA_M2 = 20;

/** Shoelace area of a footprint ring in m². */
export function ringAreaM2(ring: Ring): number {
  if (ring.length < 3) return 0;
  const m = toMetres(ring, ring[0][1]);
  let a = 0;
  for (let i = 0, j = m.length - 1; i < m.length; j = i++) a += (m[j][0] + m[i][0]) * (m[j][1] - m[i][1]);
  return Math.abs(a) / 2;
}

/** A shed/annex-sized pand. Synthetic units (no ring) are never minor. */
export const isMinor = (p: PandRecord): boolean => p.ring.length >= 3 && ((p.height !== undefined && p.height < MINOR_HEIGHT_M) || ringAreaM2(p.ring) < MINOR_AREA_M2);

/** `w×h×y` cluster key (bin floors), or null when height or year is missing or implausible. */
export function clusterKey(p: PandRecord): string | null {
  if (!(p.height && p.height > 0) || !(p.year && p.year > 1000 && p.year < 2100)) return null;
  const [w] = rectSides(p.ring);
  if (!(w > 0)) return null;
  const wb = Math.floor(w / WIDTH_BIN_M) * WIDTH_BIN_M, hb = Math.floor(p.height / HEIGHT_BIN_M) * HEIGHT_BIN_M, yb = Math.floor(p.year / YEAR_BIN) * YEAR_BIN;
  return `${wb}m×${hb}m×${yb}`;
}

export type Cluster = { key: string; n: number };
/** Share of the buurt's non-minor pands in its `top` largest clusters. */
export function repetition(all: readonly PandRecord[], top = 3): { score: number; clusters: Cluster[] } {
  const pands = all.filter(p => !isMinor(p));
  if (!pands.length) return { score: 0, clusters: [] };
  const counts = new Map<string, number>();
  for (const p of pands) { const k = clusterKey(p); if (k) counts.set(k, (counts.get(k) ?? 0) + 1); }
  const clusters = [...counts].map(([key, n]) => ({ key, n })).sort((a, b) => b.n - a.n || a.key.localeCompare(b.key)).slice(0, top);
  return { score: clusters.reduce((a, c) => a + c.n, 0) / pands.length, clusters };
}

export function dominantDecade(pands: readonly PandRecord[]): { decade: number | null; share: number } {
  const counts = new Map<number, number>();
  const major = pands.filter(p => !isMinor(p));
  for (const p of major) if (p.year && p.year > 1000 && p.year < 2100) { const d = Math.floor(p.year / 10) * 10; counts.set(d, (counts.get(d) ?? 0) + 1); }
  let decade: number | null = null, n = 0;
  for (const [d, c] of counts) if (c > n || (c === n && decade !== null && d < decade)) { decade = d; n = c; }
  return { decade, share: major.length ? n / major.length : 0 };
}

// ---------------------------------------------------------------------------
// Aggregation
// ---------------------------------------------------------------------------

export type BuurtMeta = { code: string; name: string; wijk?: string; wijkCode?: string; gebied?: string; stadsdeel?: string; cbsCode?: string };
export type BuurtCoverage = BuurtMeta & {
  pands: number;
  /** Shed/annex-sized pands (isMinor): in the tier counts, not in repetition or the decade. */
  minor: number;
  tiers: Record<TierId, number>;
  /** Pands drawn by any non-generic tier (all flags on). */
  modelled: number;
  /** Pands drawn by a non-generic tier the game shows without URL flags. */
  modelledDefault: number;
  share: number; shareDefault: number;
  repetition: number;
  clusters: Cluster[];
  /** Pands in the top clusters that only the generic tier draws: what a generator lane could pick up. */
  repetitiveGeneric: number;
  /** repetition × (1 − share): the ranking score for the generator to-do list. */
  priority: number;
  decade: number | null; decadeShare: number;
  survey: { pands: number; streets: string[] };
  types: { pands: number; districts: string[] };
  faces: number;
};

export type Flags = {
  /** pand → street names of the street surveys that list it. */
  survey: ReadonlyMap<string, readonly string[]>;
  /** pand → type-library districts whose evidence cites it. */
  types: ReadonlyMap<string, readonly string[]>;
  /** pands on an authored block face (scripts/block-face/faces/<face>/pands). */
  faces: ReadonlySet<string>;
};

const r3 = (v: number) => Math.round(v * 1000) / 1000;

export function aggregate(meta: readonly BuurtMeta[], byBuurt: ReadonlyMap<string, PandRecord[]>, tierOf: ReadonlyMap<string, TierId>, flags: Flags): BuurtCoverage[] {
  return meta.map(m => {
    const list = byBuurt.get(m.code) ?? [];
    const tiers = Object.fromEntries(TIER_IDS.map(t => [t, 0])) as Record<TierId, number>;
    const streets = new Set<string>(), districts = new Set<string>();
    let surveyN = 0, typeN = 0, faceN = 0;
    for (const p of list) {
      tiers[tierOf.get(p.id) ?? 'generic']++;
      const s = flags.survey.get(p.id); if (s) { surveyN++; s.forEach(x => streets.add(x)); }
      const t = flags.types.get(p.id); if (t) { typeN++; t.forEach(x => districts.add(x)); }
      if (flags.faces.has(p.id)) faceN++;
    }
    const modelled = MODELLED_TIERS.reduce((a, t) => a + tiers[t], 0);
    const modelledDefault = [...DEFAULT_ON_TIERS].reduce((a, t) => a + tiers[t], 0);
    const rep = repetition(list);
    const top = new Set(rep.clusters.map(c => c.key));
    const repetitiveGeneric = list.filter(p => (tierOf.get(p.id) ?? 'generic') === 'generic' && top.has(clusterKey(p) ?? '')).length;
    const share = list.length ? modelled / list.length : 0;
    const dec = dominantDecade(list);
    return {
      ...m, pands: list.length, minor: list.filter(isMinor).length, tiers, modelled, modelledDefault,
      share: r3(share), shareDefault: r3(list.length ? modelledDefault / list.length : 0),
      repetition: r3(rep.score), clusters: rep.clusters, repetitiveGeneric,
      priority: r3(rep.score * (1 - share)),
      decade: dec.decade, decadeShare: r3(dec.share),
      survey: { pands: surveyN, streets: [...streets].sort() },
      types: { pands: typeN, districts: [...districts].sort() },
      faces: faceN,
    };
  });
}

/** Generator to-do list: buurten with at least `minPands`, by priority, then by uncovered repetitive pands. */
export function rankForGenerators(rows: readonly BuurtCoverage[], minPands = 80): BuurtCoverage[] {
  return rows.filter(r => r.pands >= minPands).sort((a, b) => b.priority - a.priority || b.repetitiveGeneric - a.repetitiveGeneric || a.code.localeCompare(b.code));
}

// ---------------------------------------------------------------------------
// Per-buurt content lists (coverage.html's buurt panel)
// ---------------------------------------------------------------------------

/** `[item id, units of that item in the buurt]`. */
export type Tally = [id: string, n: number];
/** What a buurt holds, by id; details live in the contents catalogue (coverage-v1/contents.json). */
export type BuurtContent = {
  /** Block-face type libraries whose evidence pands lie in the buurt. */
  types: Tally[];
  /** Authored or staged block faces (scripts/block-face/faces) with a pand in the buurt. */
  faces: Tally[];
  /** Building-type designs (instances.json `unit`) instanced in the buurt. */
  designs: Tally[];
  /** Placed models: bespoke landmarks, block-face chunks, large/per-house recipes, hand-built ordinary GLBs. */
  models: Tally[];
  /** Landmark kits drawn on the buurt's extrusions. */
  kits: Tally[];
};
export const CONTENT_KINDS = ['types', 'faces', 'designs', 'models', 'kits'] as const satisfies readonly (keyof BuurtContent)[];

/**
 * Group items into buurten by where their units (pands, synthetic model units) lie. An item spanning two buurten
 * appears in both, each with its own count; units no buurt holds are dropped. Lists run by count, then id.
 */
export function tallyByBuurt(items: Iterable<{ id: string; units: Iterable<string> }>, buurtOf: (unit: string) => string | null | undefined): Map<string, Tally[]> {
  const counts = new Map<string, Map<string, number>>();
  for (const item of items) {
    for (const unit of new Set(item.units)) {
      const code = buurtOf(unit);
      if (!code) continue;
      let m = counts.get(code);
      if (!m) counts.set(code, m = new Map());
      m.set(item.id, (m.get(item.id) ?? 0) + 1);
    }
  }
  return new Map([...counts].map(([code, m]) => [code, [...m].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))]));
}

export const emptyContent = (): BuurtContent => ({ types: [], faces: [], designs: [], models: [], kits: [] });
export const hasContent = (c: BuurtContent): boolean => CONTENT_KINDS.some(k => c[k].length > 0);

/** A repetition cluster key (`6m×15m×1900`) as numbers: footprint width bin (m), height bin (m), five-year bin start. */
export function parseClusterKey(key: string): { widthM: number; heightM: number; year: number } | null {
  const m = /^(\d+(?:\.\d+)?)m×(\d+(?:\.\d+)?)m×(\d{4})$/.exec(key);
  return m ? { widthM: Number(m[1]), heightM: Number(m[2]), year: Number(m[3]) } : null;
}
