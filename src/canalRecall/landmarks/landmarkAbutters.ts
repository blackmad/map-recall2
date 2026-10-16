/**
 * Which city buildings belong with a placed landmark but are still drawn by the kit?
 *
 * check:osm-under-models (osmUnderModels.ts) only sees a city building that is
 * at least half INSIDE the model footprint. It misses the Noorderkerk case
 * (2026-10-16): three 1623 corner houses of the same rijksmonument stand in the
 * angles of the Greek cross, outside the church walls, and the city tiles draw
 * them as a generic block. This module is the pure part of the abutter survey:
 *
 *   wall     the candidate shares a measured wall length with the model outline
 *            (a corner touch does not count);
 *   notch    the candidate lies mostly inside the model footprint's convex hull,
 *            i.e. in an angle, notch or courtyard of the model;
 *   partial  the candidate overlaps the model by more than a sliver but below
 *            osmUnderModels' 50% "drawn through" threshold.
 *
 * Each candidate is then scored from geometry plus identity evidence (shared
 * monument number, bouwjaar, OSM building:part, roof/height mismatch). The CLI
 * is scripts/landmarks/survey-landmark-abutters.ts; the gate is
 * scripts/check-landmark-abutters.ts.
 */
import {overlapFraction, pointInRing, ringAreaM2, type Footprint, type LngLat, type Ring} from './osmUnderModels';

const M_PER_DEG_LAT = 111_320;

/** Shared wall shorter than this is a corner touch, not a wall. */
export const MIN_SHARED_WALL_M = 2;
/** Outward probe distances (m): OSM and BAG outlines disagree by up to about a metre. */
export const WALL_PROBES_M = [0.35, 0.7, 1.1] as const;
/** Inward probe (m): an edge whose inside is also model is overlap, not a wall. */
export const WALL_INWARD_PROBE_M = 1.5;
/** Share of the candidate in the hull (outside the model) for a notch. */
export const MIN_NOTCH_SHARE = 0.5;
/** Below this overlap a candidate is not "partial" (outline noise). */
export const MIN_PARTIAL_OVERLAP = 0.05;
/** At and above this osmUnderModels reports it; the survey leaves it alone. */
export const MAX_PARTIAL_OVERLAP = 0.5;
/** The regression gate fails on an unreviewed notch candidate at or above this score. */
export const NOTCH_GATE_SCORE = 8;

export type Category = 'wall' | 'notch' | 'partial';

/** Local tangent-plane metres around an origin. */
export function localFrame(origin: LngLat) {
  const mx = M_PER_DEG_LAT * Math.cos((origin[1] * Math.PI) / 180);
  return {
    toM: (p: LngLat): [number, number] => [(p[0] - origin[0]) * mx, (p[1] - origin[1]) * M_PER_DEG_LAT],
    toLngLat: (x: number, y: number): LngLat => [origin[0] + x / mx, origin[1] + y / M_PER_DEG_LAT],
  };
}

/** Monotone-chain convex hull, counter-clockwise, no repeated closing point. */
export function convexHull(points: readonly (readonly [number, number])[]): [number, number][] {
  const pts = [...new Map(points.map(p => [`${p[0]},${p[1]}`, [p[0], p[1]] as [number, number]])).values()].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (pts.length < 3) return pts;
  const cross = (o: number[], a: number[], b: number[]) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower: [number, number][] = [], upper: [number, number][] = [];
  for (const p of pts) { while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop(); lower.push(p); }
  for (const p of [...pts].reverse()) { while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop(); upper.push(p); }
  return [...lower.slice(0, -1), ...upper.slice(0, -1)];
}

/**
 * Convex hull of any Footprint (rings, GLB raster or union) as a lng/lat ring,
 * from the footprint sampled on a grid of about `stepMetres` (coarser for big
 * models so the grid stays under `maxCells` per axis). Cell corners are used so
 * the hull reaches the outline rather than the cell centres.
 */
export function footprintHull(fp: Footprint, stepMetres = 0.5, maxCells = 400): Ring {
  const {w, s, e, n} = fp.bounds, origin: LngLat = [w, s], f = localFrame(origin);
  const [W, H] = f.toM([e, n]);
  const step = Math.max(stepMetres, W / maxCells, H / maxCells), half = step / 2;
  const pts: [number, number][] = [];
  for (let x = half; x < W + half; x += step) for (let y = half; y < H + half; y += step) {
    if (!fp.contains(f.toLngLat(x, y))) continue;
    pts.push([x - half, y - half], [x + half, y - half], [x + half, y + half], [x - half, y + half]);
  }
  return convexHull(pts).map(([x, y]) => f.toLngLat(x, y));
}

/** Perimeter of a ring in metres. */
export function ringPerimeterM(ring: Ring): number {
  const f = localFrame(ring[0]);
  let len = 0;
  for (let i = 0; i < ring.length - 1; i++) { const a = f.toM(ring[i]), b = f.toM(ring[i + 1]); len += Math.hypot(b[0] - a[0], b[1] - a[1]); }
  const a = f.toM(ring[ring.length - 1]), b = f.toM(ring[0]);
  return len + Math.hypot(b[0] - a[0], b[1] - a[1]);
}

/**
 * Length (m) of `ring`'s boundary that runs along the model: walking the edge
 * at `stepMetres`, a sample counts when a point just outside the candidate
 * (any of WALL_PROBES_M along the outward normal) is model and the point
 * WALL_INWARD_PROBE_M inside the candidate is not (that would be overlap).
 * A corner touch therefore contributes about one probe distance, well under
 * MIN_SHARED_WALL_M.
 */
export function sharedWallM(ring: Ring, fp: Footprint, stepMetres = 0.25): number {
  return sharedWalls(ring, fp, stepMetres).reduce((a, w) => a + w.lengthM, 0);
}

/** Shared wall per candidate edge: length and the edge's outward normal bearing (degrees, 0 = north, clockwise). */
export function sharedWalls(ring: Ring, fp: Footprint, stepMetres = 0.25): {lengthM: number; normalDeg: number}[] {
  const f = localFrame(ring[0]);
  const pts = ring.map(f.toM);
  if (pts.length > 1 && pts[0][0] === pts[pts.length - 1][0] && pts[0][1] === pts[pts.length - 1][1]) pts.pop();
  let area2 = 0;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) area2 += pts[j][0] * pts[i][1] - pts[i][0] * pts[j][1];
  const ccw = area2 > 0;
  const walls: {lengthM: number; normalDeg: number}[] = [];
  for (let i = 0; i < pts.length; i++) {
    let shared = 0;
    const a = pts[i], b = pts[(i + 1) % pts.length], len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (len < 1e-6) continue;
    const t = [(b[0] - a[0]) / len, (b[1] - a[1]) / len];
    const out = ccw ? [t[1], -t[0]] : [-t[1], t[0]]; // right of travel for CCW
    const steps = Math.max(1, Math.round(len / stepMetres)), ds = len / steps;
    for (let k = 0; k < steps; k++) {
      const u = (k + 0.5) * ds, p = [a[0] + t[0] * u, a[1] + t[1] * u];
      const outside = WALL_PROBES_M.some(d => fp.contains(f.toLngLat(p[0] + out[0] * d, p[1] + out[1] * d)));
      if (!outside) continue;
      if (fp.contains(f.toLngLat(p[0] - out[0] * WALL_INWARD_PROBE_M, p[1] - out[1] * WALL_INWARD_PROBE_M))) continue;
      shared += ds;
    }
    if (shared > 0) walls.push({lengthM: shared, normalDeg: ((Math.atan2(out[0], out[1]) * 180) / Math.PI + 360) % 360});
  }
  return walls;
}

/**
 * Number of distinct sides (outward normals more than 45 degrees apart) carrying at least
 * MIN_SHARED_WALL_M of shared wall. A terrace neighbour has one; a corner house in an angle two
 * (an L); a building in a slot between two wings two (opposite sides).
 */
export function sharedSides(walls: readonly {lengthM: number; normalDeg: number}[]): number {
  const buckets: {normalDeg: number; lengthM: number}[] = [];
  for (const w of [...walls].sort((a, b) => b.lengthM - a.lengthM)) {
    const near = buckets.find(b => Math.abs(((w.normalDeg - b.normalDeg + 540) % 360) - 180) < 45);
    if (near) near.lengthM += w.lengthM; else buckets.push({...w});
  }
  return buckets.filter(b => b.lengthM >= MIN_SHARED_WALL_M).length;
}

export interface AbutterGeometry {
  /** Share of the candidate's area inside the model footprint. */
  overlap: number;
  /** Share of the candidate's area inside the model's convex hull (includes `overlap`). */
  inHull: number;
  /** Shared wall with the model outline, metres. */
  sharedWallM: number;
  perimeterM: number;
  /** sharedWallM / perimeter. */
  sharedShare: number;
  /** Distinct sides with a shared wall (sharedSides): 1 for a terrace neighbour, 2+ for a building wrapped by the model. */
  sides: number;
  areaM2: number;
  categories: Category[];
}

/** Geometry signals of one candidate (all its outer rings) against a model footprint and its hull. */
export function abutterGeometry(rings: readonly Ring[], fp: Footprint, hull: Ring): AbutterGeometry {
  let area = 0, inside = 0, inHull = 0, wall = 0, perim = 0, sides = 0;
  const hullFp: Footprint = {bounds: boundsOf(hull), contains: p => pointInRing(p, hull)};
  for (const r of rings) {
    const a = ringAreaM2(r);
    area += a; inside += a * overlapFraction(r, fp); inHull += a * overlapFraction(r, hullFp);
    const walls = sharedWalls(r, fp);
    wall += walls.reduce((a, w) => a + w.lengthM, 0); perim += ringPerimeterM(r); sides = Math.max(sides, sharedSides(walls));
  }
  const overlap = area ? inside / area : 0, hullShare = area ? inHull / area : 0;
  const categories: Category[] = [];
  if (wall >= MIN_SHARED_WALL_M) categories.push('wall');
  if (overlap < MAX_PARTIAL_OVERLAP && hullShare >= MIN_NOTCH_SHARE) categories.push('notch');
  if (overlap >= MIN_PARTIAL_OVERLAP && overlap < MAX_PARTIAL_OVERLAP) categories.push('partial');
  return {overlap, inHull: hullShare, sharedWallM: wall, perimeterM: perim, sharedShare: perim ? wall / perim : 0, sides, areaM2: area, categories};
}

export const boundsOf = (ring: Ring) => {
  let w = Infinity, s = Infinity, e = -Infinity, n = -Infinity;
  for (const [x, y] of ring) { if (x < w) w = x; if (x > e) e = x; if (y < s) s = y; if (y > n) n = y; }
  return {w, s, e, n};
};

/** Identity evidence joined from BAG/3DBAG, the monument registers and OSM tags. All optional. */
export interface AbutterIdentity {
  /** Candidate bouwjaar (earliest plausible of its pands). */
  year?: number | null;
  /** Landmark bouwjaar (earliest plausible of the landmark's own pands). */
  landmarkYear?: number | null;
  /** Monument numbers (`gm:3923`, `rce:3923`) the candidate shares with the landmark's pands. */
  sharedMonuments?: readonly string[];
  /** BAG verblijfsobject ids the candidate shares with the landmark (from the RCE register). */
  sharedVbos?: readonly string[];
  /** 3DBAG roof type of the candidate's main pand (`slanted`, `horizontal`, `multiple horizontal`). */
  bagRoof?: string | null;
  /** 3DBAG ridge (or roof) height above ground, m. */
  bagRidgeM?: number | null;
  /** What the city tile draws: extrusion height and roof shape (absent = flat box). */
  tileHeightM?: number | null;
  tileRoofShape?: string | null;
  /** The tile feature is an OSM way (tier 2), not a BAG pand: the kit has no 3DBAG facts for it. */
  tileIsOsm?: boolean;
  /** The OSM way is tagged building:part (a piece of a larger building), not building=*. */
  osmBuildingPart?: boolean;
  /** OSM building=* value (church, chapel, house, ...). */
  osmBuilding?: string | null;
}

export interface ScoreTerm { signal: string; points: number; note: string }

/**
 * Additive, explainable score. Geometry says "could belong", identity says
 * "does belong"; a terrace neighbour along a street usually has a short shared
 * party wall, no hull share and a different year, and stays low.
 */
export function scoreAbutter(g: AbutterGeometry, id: AbutterIdentity = {}): {score: number; terms: ScoreTerm[]} {
  const terms: ScoreTerm[] = [];
  const add = (signal: string, points: number, note: string) => { if (points) terms.push({signal, points, note}); };
  if (id.sharedMonuments?.length) add('monument', 4, `same monument record ${id.sharedMonuments.join(', ')}`);
  if (id.sharedVbos?.length) add('address', 2, `shares verblijfsobject ${id.sharedVbos.slice(0, 3).join(', ')}`);
  if (id.year && id.landmarkYear) {
    const gap = Math.abs(id.year - id.landmarkYear);
    add('year', gap <= 2 ? 3 : gap <= 25 ? 2 : gap <= 75 ? 1 : id.year - id.landmarkYear > 150 ? -1 : 0, `bouwjaar ${id.year} vs landmark ${id.landmarkYear}`);
  }
  if (g.categories.includes('notch')) add('hull', g.inHull >= 0.85 ? 3 : 2, `${Math.round(g.inHull * 100)}% inside the model's convex hull`);
  else if (g.inHull >= 0.25) add('hull', 1, `${Math.round(g.inHull * 100)}% inside the hull`);
  if (g.sharedWallM >= MIN_SHARED_WALL_M) add('wall', Math.min(3, Math.round((g.sharedWallM / 6) * 10) / 10), `${g.sharedWallM.toFixed(1)} m shared wall`);
  if (g.sides >= 2) add('wraps', 1.5, `shared walls on ${g.sides} sides (${Math.round(g.sharedShare * 100)}% of its perimeter)`);
  if (g.overlap >= MIN_PARTIAL_OVERLAP) add('overlap', g.overlap >= 0.2 ? 1 : 0.5, `${Math.round(g.overlap * 100)}% under the model`);
  if (id.osmBuildingPart) add('osm-part', 2, 'OSM building:part (a piece of a larger building)');
  if (id.osmBuilding && /^(church|chapel|cathedral|synagogue|mosque|temple|religious)$/.test(id.osmBuilding)) add('osm-religious', 1, `OSM building=${id.osmBuilding}`);
  // An OSM-only tile feature gets no BAG roof plan from the kit: a slanted 3DBAG roof under it is drawn as a flat box.
  if (id.bagRoof === 'slanted' && !id.tileRoofShape && id.tileIsOsm) add('roof', 1, '3DBAG slanted roof, OSM tile feature drawn as a flat box');
  if (id.bagRidgeM && id.tileHeightM && Math.abs(id.bagRidgeM - id.tileHeightM) > 3) add('height', 0.5, `tile ${id.tileHeightM} m vs 3DBAG ridge ${id.bagRidgeM.toFixed(1)} m`);
  // Terrace-neighbour damping: one short party wall, outside the hull, no shared identity.
  if (!id.sharedMonuments?.length && !id.osmBuildingPart && g.inHull < 0.25 && g.sides <= 1 && g.overlap < MIN_PARTIAL_OVERLAP) add('terrace', -1.5, 'single party wall along the street, outside the hull');
  const score = Math.round(terms.reduce((a, t) => a + t.points, 0) * 10) / 10;
  return {score, terms};
}

export type Verdict = 'fold-in' | 'separate-but-wrong' | 'fine' | 'unclear';

/** Allowlist entry ({modelId: {tileId: entry}}): a reviewed abutter. `fold-in` stays listed as known-pending. */
export interface AbutterReview { verdict: Verdict; reason: string; evidence?: string }

export interface GateHit { model: string; id: string; score: number; categories: Category[] }

/**
 * The regression gate: notch candidates at or above `threshold` that no review
 * covers fail; reviewed `fold-in` ones are reported as known pending.
 */
export function gate(hits: readonly GateHit[], reviews: Record<string, Record<string, AbutterReview>>, threshold = NOTCH_GATE_SCORE) {
  const fail: GateHit[] = [], pending: (GateHit & {review: AbutterReview})[] = [];
  for (const h of hits) {
    if (!h.categories.includes('notch') || h.score < threshold) continue;
    const review = reviews[h.model]?.[h.id];
    if (!review) fail.push(h);
    else if (review.verdict === 'fold-in' || review.verdict === 'unclear') pending.push({...h, review});
  }
  return {fail, pending};
}
