/**
 * Terrace placement (lane terraces-20261114): furniture units laid inside a permitted terrace polygon. Pure: the
 * caller hands in the polygons (local metres, extract.ts toLocal) and a surface probe built from the own ground's
 * survey (scripts/terraces/build.ts: roads-v1 BGT wegdeel polygons and the elevation-v1 water).
 *
 * Rules
 *  - Axis: the polygon's dominant edge direction (length-weighted, modulo 90 deg), so rows run along the facade.
 *  - Grid: units on a grid at the style's pitch (kit.ts UNIT_SIZE, 1.4-2.1 m), centred in the polygon's box on that
 *    axis; a unit is kept when its footprint (corners and edge midpoints, PLACE_TOL_M of overhang allowed) lies in the
 *    polygon and none of those points lies on a carriageway, cycle path or water (the probe); parking bays are allowed
 *    (Amsterdam permits terraces on parking places) and drawn at carriageway level.
 *  - Strips under WALL_STRIP_M deep get the bench-against-the-facade unit instead; a polygon nothing fits in gets one
 *    unit at its interior point when that point is allowed, else none (counted by the build).
 *  - Street edges: an outer edge with a carriageway or cycle path within STREET_PROBE_M outside it carries planters or
 *    windbreak screens (per style and terrace hash), inset EDGE_INSET_M; units keep EDGE_CLEAR_M off those edges.
 *  - Big permits (park pavilions, event venues: Groot Melkhuis 3,693 m2, 2,280 grid units) keep the MAX_TABLE_UNITS
 *    units nearest the premises: the permit covers the whole outdoor area, the tables stand round the building.
 *  - Parasols: on terraces at least PARASOL_MIN_DEPTH_M deep, by style and terrace hash, over every second unit.
 * Deterministic: everything random is a hash of the permit id.
 */
import { inPolygon, distToPolygonEdge, segDist, polygonArea, type Polygon, type Vec2, type TerraceStyle } from './extract.js';
import { TERRACE_COLOURS, UNIT_SIZE, type TerraceModelId, type UnitSize } from './kit.js';

export type SurfaceKind = 'pavement' | 'parking' | 'road' | 'water';
/** What lies at a local-frame point: 'pavement' (footway, square, unknown land), 'parking', 'road' (carriageway, cycle), 'water'. */
export type SurfaceProbe = (p: Vec2) => SurfaceKind;

export const PLACE_TOL_M = 0.15;
export const WALL_STRIP_M = 1.3;
export const STREET_PROBE_M = 2.5;
export const EDGE_INSET_M = 0.3;
export const EDGE_CLEAR_M = 0.75;
export const PARASOL_MIN_DEPTH_M = 2.4;
export const EDGE_MIN_DEPTH_M = 2.0;
export const EDGE_MIN_AREA_M2 = 10;
export const MAX_TABLE_UNITS = 120;

export const STYLE_SET: Readonly<Record<TerraceStyle, TerraceModelId>> = {
  brown: 'set-brown', bistro: 'set-bistro', restaurant: 'set-restaurant', bar: 'set-bar', modern: 'set-modern',
};
/** Share of terraces with parasols, and with edge furniture (and which), per style. */
export const STYLE_DRESS: Readonly<Record<TerraceStyle, { parasol: number; edge: number; edgeModel: 'screen' | 'planter' }>> = {
  brown: { parasol: 0.25, edge: 0.25, edgeModel: 'planter' },
  bistro: { parasol: 0.45, edge: 0.4, edgeModel: 'planter' },
  restaurant: { parasol: 0.6, edge: 0.6, edgeModel: 'screen' },
  bar: { parasol: 0.35, edge: 0.45, edgeModel: 'screen' },
  modern: { parasol: 0.45, edge: 0.35, edgeModel: 'planter' },
};

export interface PlacedUnit { model: TerraceModelId; x: number; y: number; yawDeg: number; colour?: number; level: 0 | 1 }
export interface Placement { units: PlacedUnit[]; axisDeg: number; depthM: number; streetEdges: number; fallback: boolean }

/** FNV-1a of a string → [0, 1). */
export function hash01(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return (h >>> 0) / 4294967296;
}

/** Dominant edge direction (radians, 0..PI/2) of the outer rings, length-weighted modulo 90 deg. */
export function dominantAxis(polys: readonly Polygon[]): number {
  const bins = new Float64Array(90);
  for (const poly of polys) {
    const r = poly[0];
    for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
      const dx = r[i][0] - r[j][0], dy = r[i][1] - r[j][1], l = Math.hypot(dx, dy);
      if (l < 1e-6) continue;
      let a = Math.atan2(dy, dx) * 180 / Math.PI; a = ((a % 90) + 90) % 90;
      bins[Math.floor(a) % 90] += l;
    }
  }
  let best = 0; for (let i = 1; i < 90; i++) if (bins[i] + bins[(i + 89) % 90] + bins[(i + 1) % 90] > bins[best] + bins[(best + 89) % 90] + bins[(best + 1) % 90]) best = i;
  // Length-weighted mean of the neighbourhood (circular modulo 90).
  let s = 0, w = 0; for (const d of [-1, 0, 1]) { const k = (best + d + 90) % 90; s += (best + d + 0.5) * bins[k]; w += bins[k]; }
  return ((w ? s / w : best + 0.5) % 90) * Math.PI / 180;
}

const rot = (p: Vec2, c: number, s: number): Vec2 => [p[0] * c - p[1] * s, p[0] * s + p[1] * c];

/** Footprint probe points of a unit (corners, edge midpoints, centre) at (x, y) with its x along `axis`. */
function footprint(x: number, y: number, axis: number, size: Pick<UnitSize, 'halfX' | 'halfY'>, alongX: boolean): Vec2[] {
  const hx = (alongX ? size.halfX : size.halfY) - PLACE_TOL_M, hy = (alongX ? size.halfY : size.halfX) - PLACE_TOL_M;
  const c = Math.cos(axis), s = Math.sin(axis), out: Vec2[] = [];
  for (const [u, v] of [[0, 0], [-hx, -hy], [hx, -hy], [hx, hy], [-hx, hy], [0, -hy], [0, hy], [-hx, 0], [hx, 0]] as const) { const [dx, dy] = rot([u, v], c, s); out.push([x + dx, y + dy]); }
  return out;
}

/** The terrace's extent on the axis frame (u along, v across). */
function extent(polys: readonly Polygon[], axis: number) {
  const c = Math.cos(-axis), s = Math.sin(-axis);
  let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity;
  for (const poly of polys) for (const p of poly[0]) { const [u, v] = rot(p, c, s); u0 = Math.min(u0, u); u1 = Math.max(u1, u); v0 = Math.min(v0, v); v1 = Math.max(v1, v); }
  return { u0, u1, v0, v1 };
}

/** The depth of a terrace: twice the largest inscribed distance found on a coarse grid (a strip 1 m deep reads 1 m). */
export function terraceDepth(poly: Polygon, step = 0.25): number {
  let lo = [Infinity, Infinity], hi = [-Infinity, -Infinity];
  for (const p of poly[0]) { lo = [Math.min(lo[0], p[0]), Math.min(lo[1], p[1])]; hi = [Math.max(hi[0], p[0]), Math.max(hi[1], p[1])]; }
  const n = Math.max(1, Math.ceil(Math.max(hi[0] - lo[0], hi[1] - lo[1]) / step)), st = Math.max(step, Math.max(hi[0] - lo[0], hi[1] - lo[1]) / Math.min(n, 120));
  let best = 0;
  for (let x = lo[0] + st / 2; x < hi[0]; x += st) for (let y = lo[1] + st / 2; y < hi[1]; y += st) if (inPolygon([x, y], poly)) best = Math.max(best, distToPolygonEdge([x, y], poly));
  return 2 * best;
}

/** Outer edges with a carriageway or cycle path just outside them (both directions tried: rings may wind either way). */
export function streetEdges(poly: Polygon, probe: SurfaceProbe): [Vec2, Vec2][] {
  const r = poly[0], out: [Vec2, Vec2][] = [];
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const a = r[j], b = r[i], dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy);
    if (l < 1.5) continue;
    const nx = -dy / l, ny = dx / l;
    let hits = 0, tries = 0;
    for (const t of [0.25, 0.5, 0.75]) {
      const m: Vec2 = [a[0] + dx * t, a[1] + dy * t];
      for (const sgn of [1, -1]) {
        if (inPolygon([m[0] + sgn * nx * 0.3, m[1] + sgn * ny * 0.3], poly)) continue; // inside: not the outward side
        tries++;
        for (const d of [0.6, 1.2, 1.8, STREET_PROBE_M]) if (probe([m[0] + sgn * nx * d, m[1] + sgn * ny * d]) === 'road') { hits++; break; }
      }
    }
    if (tries && hits >= 2) out.push([a, b]);
  }
  return out;
}

export function placeTerrace(id: string, style: TerraceStyle, polys: readonly Polygon[], probe: SurfaceProbe, premises: Vec2 | null = null): Placement {
  const units: PlacedUnit[] = [], h = hash01(id), dress = STYLE_DRESS[style];
  const axis = dominantAxis(polys), axisDeg = axis * 180 / Math.PI;
  const depth = Math.max(0, ...polys.map(p => terraceDepth(p)));
  const area = polys.reduce((s, p) => s + polygonArea(p), 0);
  const inAny = (p: Vec2) => polys.some(poly => inPolygon(p, poly) || distToPolygonEdge(p, poly) <= PLACE_TOL_M * 0.5);
  const colour = Math.floor(hash01(`${id}/colour`) * TERRACE_COLOURS.length);
  // Street edges first: units keep clear of them when they carry furniture.
  const edges = polys.flatMap(p => streetEdges(p, probe));
  const dressEdges = edges.length > 0 && depth >= EDGE_MIN_DEPTH_M && area >= EDGE_MIN_AREA_M2 && hash01(`${id}/edge`) < dress.edge;
  const levelAt = (pts: Vec2[]): 0 | 1 | null => {
    let parking = 0;
    for (const p of pts) { const k = probe(p); if (k === 'road' || k === 'water') return null; if (k === 'parking') parking++; }
    return parking * 2 > pts.length ? 1 : 0;
  };
  if (dressEdges) {
    const model = dress.edgeModel, pitch = model === 'screen' ? 1.55 : 1.25;
    for (const [a, b] of edges) {
      const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy), ux = dx / l, uy = dy / l;
      let nx = -uy, ny = ux; const mid: Vec2 = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      if (!inAny([mid[0] + nx * EDGE_INSET_M, mid[1] + ny * EDGE_INSET_M])) { nx = -nx; ny = -ny; }
      const n = Math.floor((l - 0.4) / pitch);
      for (let k = 0; k < n; k++) {
        const t = (l - n * pitch) / 2 + pitch * (k + 0.5), p: Vec2 = [a[0] + ux * t + nx * EDGE_INSET_M, a[1] + uy * t + ny * EDGE_INSET_M];
        if (!inAny(p)) continue;
        const lv = levelAt([p]);
        if (lv === null) continue;
        units.push({ model, x: p[0], y: p[1], yawDeg: Math.atan2(uy, ux) * 180 / Math.PI, ...(model === 'screen' ? { colour } : {}), level: lv });
      }
    }
  }
  const clearOfEdges = (pts: Vec2[]) => !dressEdges || pts.every(p => edges.every(([a, b]) => segDist(p, a, b) >= EDGE_CLEAR_M - PLACE_TOL_M));
  const narrow = depth < WALL_STRIP_M;
  const model: TerraceModelId = narrow ? 'set-wall' : STYLE_SET[style];
  const size = UNIT_SIZE[model as keyof typeof UNIT_SIZE];
  // A deep terrace turns the two-chair sets across the axis (chairs face along the facade); a strip runs them along it.
  const { u0, u1, v0, v1 } = extent(polys, axis);
  const tryGrid = (alongX: boolean, yaw: number): PlacedUnit[] => {
    const pu = alongX ? size.pitchX : size.pitchY, pv = alongX ? size.pitchY : size.pitchX;
    const nu = Math.max(1, Math.floor((u1 - u0) / pu)), nv = Math.max(1, Math.floor((v1 - v0) / pv));
    const ou = u0 + (u1 - u0 - nu * pu) / 2 + pu / 2, ov = v0 + (v1 - v0 - nv * pv) / 2 + pv / 2;
    const c = Math.cos(axis), s = Math.sin(axis), out: PlacedUnit[] = [];
    for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) {
      const [x, y] = rot([ou + i * pu, ov + j * pv], c, s);
      const pts = footprint(x, y, axis, size, alongX);
      if (!pts.every(inAny) || !clearOfEdges(pts)) continue;
      const lv = levelAt(pts);
      if (lv === null) continue;
      out.push({ model, x, y, yawDeg: axisDeg + yaw, level: lv });
    }
    return out;
  };
  let grid: PlacedUnit[];
  if (narrow) {
    // The bench's back to the nearer long side (the facade is unknown here; either long side reads the same from the street).
    grid = tryGrid(true, 0);
  } else {
    const a = tryGrid(false, 90), b = tryGrid(true, 0);
    grid = a.length >= b.length ? a : b;
  }
  if (grid.length > MAX_TABLE_UNITS) {
    const ref = premises ?? polys[0][0][0];
    grid = grid.map(u => ({ u, d: Math.hypot(u.x - ref[0], u.y - ref[1]) })).sort((a, b) => a.d - b.d).slice(0, MAX_TABLE_UNITS).map(e => e.u);
  }
  let fallback = false;
  if (!grid.length) {
    // One unit at the polygon's best interior point, if allowed.
    const poly = polys.reduce((m, p) => polygonArea(p) > polygonArea(m) ? p : m, polys[0]);
    const best = interiorPoint(poly);
    if (best && levelAt([best]) !== null) { grid = [{ model, x: best[0], y: best[1], yawDeg: axisDeg, level: levelAt([best])! }]; fallback = true; }
  }
  units.push(...grid);
  if (!narrow && depth >= PARASOL_MIN_DEPTH_M && hash01(`${id}/parasol`) < dress.parasol) {
    grid.forEach((u, k) => { if (k % 2 === 0) units.push({ model: 'parasol', x: u.x, y: u.y, yawDeg: u.yawDeg, colour, level: u.level }); });
  }
  return { units, axisDeg, depthM: depth, streetEdges: dressEdges ? edges.length : 0, fallback };
}

/** The interior point farthest from the edges (coarse grid), or null for a degenerate polygon. */
export function interiorPoint(poly: Polygon, step = 0.2): Vec2 | null {
  let lo = [Infinity, Infinity], hi = [-Infinity, -Infinity];
  for (const p of poly[0]) { lo = [Math.min(lo[0], p[0]), Math.min(lo[1], p[1])]; hi = [Math.max(hi[0], p[0]), Math.max(hi[1], p[1])]; }
  let best: Vec2 | null = null, bd = -1;
  const st = Math.max(step, Math.max(hi[0] - lo[0], hi[1] - lo[1]) / 100);
  for (let x = lo[0] + st / 2; x < hi[0]; x += st) for (let y = lo[1] + st / 2; y < hi[1]; y += st) if (inPolygon([x, y], poly)) { const d = distToPolygonEdge([x, y], poly); if (d > bd) { bd = d; best = [x, y]; } }
  return best;
}
