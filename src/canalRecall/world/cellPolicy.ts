/**
 * World-cell compile policy (P2 bytes gate, format v4, decisions on #130 2026-10-31): the two value changes
 * the cells may make against the default tile path, both below what the look or collision can see.
 *   - Heights (`height`, `minHeight`, `roofEavesHeightM`) to the centimetre. The eaves are a computed double
 *     (`height - plan.riseM`, roofMesh.ts) and were the largest STYL column (0.95 MB gzip city-wide).
 *   - Collinear vertices removed from footprints when every removed vertex lies within 5 cm of the edge that
 *     replaces it (measured against the original vertices, so removals never accumulate), a ring keeps at
 *     least three vertices, and a vertex another building of the cell also has (a party-wall corner or
 *     T-junction) is always kept, so shared edges still match exactly. A building whose footprint area would
 *     change by more than 1% (slivers a few centimetres wide) keeps its original footprint.
 * The compiler applies it before encoding; `world:verify` applies the same function to the default path before
 * comparing, so the comparison stays exact. Pure and deterministic.
 */
import type { Cell, Geometry, Props } from './cellFormat.js';

export const POLICY_VERSION = 'world-policy-1';
export const HEIGHT_KEYS = ['height', 'minHeight', 'roofEavesHeightM'] as const;
export const HEIGHT_STEP_M = 0.01;
export const COLLINEAR_TOLERANCE_M = 0.05;
const M_PER_DEG_LAT = 111_320;

/** A number rounded to the centimetre, as the shortest decimal (so it encodes as a 2-place mantissa). */
export const toCentimetre = (v: number): number => { const r = Math.round(v * 100) / 100; return Object.is(r, -0) ? 0 : r; };

/** The bag with its height keys at centimetres (same key order; the input is not modified). */
export function quantiseHeights(bag: Props): Props {
  let out: Props | null = null;
  for (const k of HEIGHT_KEYS) {
    const v = bag[k];
    if (typeof v !== 'number' || !Number.isFinite(v)) continue;
    const q = toCentimetre(v);
    if (q === v) continue;
    out ??= { ...bag };
    out[k] = q;
  }
  return out ?? bag;
}

const key = (c: number[]) => `${c[0]},${c[1]}`;
/** Coordinates used by more than one building of a cell: never removed. */
export function sharedVertices(geometries: readonly Geometry[]): Set<string> {
  const seen = new Map<string, number>(), shared = new Set<string>();
  geometries.forEach((g, b) => {
    for (const rings of g.type === 'Polygon' ? [g.coordinates] : g.coordinates) for (const ring of rings) for (const c of ring) {
      const k = key(c), at = seen.get(k);
      if (at === undefined) seen.set(k, b); else if (at !== b) shared.add(k);
    }
  });
  return shared;
}

/** Distance in metres from p to segment a-b (local equirectangular metres at the segment's latitude). */
function offset(p: number[], a: number[], b: number[]): number {
  const kx = M_PER_DEG_LAT * Math.cos(a[1] * Math.PI / 180);
  const ax = 0, ay = 0, bx = (b[0] - a[0]) * kx, by = (b[1] - a[1]) * M_PER_DEG_LAT, px = (p[0] - a[0]) * kx, py = (p[1] - a[1]) * M_PER_DEG_LAT;
  const dx = bx - ax, dy = by - ay, len2 = dx * dx + dy * dy;
  const t = len2 > 0 ? Math.max(0, Math.min(1, (px * dx + py * dy) / len2)) : 0;
  return Math.hypot(px - t * dx, py - t * dy);
}

/** One ring without its near-collinear vertices. Closed rings stay closed; the first vertex is kept (it anchors
 *  the coarse group and the ring's start). */
function simplifyRing(ring: number[][], shared: Set<string>, tol: number): number[][] {
  const closed = ring.length > 1 && ring[0][0] === ring[ring.length - 1][0] && ring[0][1] === ring[ring.length - 1][1];
  const pts = closed ? ring.slice(0, -1) : ring;
  if (pts.length <= 3) return ring;
  const keep = pts.map(() => true);
  let changed = true;
  while (changed) {
    changed = false;
    let kept = keep.reduce((n, k) => n + (k ? 1 : 0), 0);
    for (let i = 1; i < pts.length && kept > 3; i++) {
      if (!keep[i] || shared.has(key(pts[i]))) continue;
      let p = i - 1; while (!keep[p]) p--;
      let n = (i + 1) % pts.length; while (!keep[n]) n = (n + 1) % pts.length;
      if (!closed && n < i) continue; // an open ring's last vertex stays
      // Every original vertex between p and n (the ones already dropped and i) must stay within tolerance.
      let ok = true;
      for (let q = (p + 1) % pts.length; q !== n; q = (q + 1) % pts.length) if (offset(pts[q], pts[p], pts[n]) > tol) { ok = false; break; }
      if (ok) { keep[i] = false; kept--; changed = true; }
    }
  }
  if (keep.every(Boolean)) return ring;
  const out = pts.filter((_, i) => keep[i]);
  if (closed) out.push(out[0]);
  return out;
}

/** The geometry without near-collinear vertices (the input is returned unchanged when nothing goes). */
export function simplifyGeometry(g: Geometry, shared: Set<string>, tol = COLLINEAR_TOLERANCE_M): Geometry {
  let changed = false;
  const polys = (g.type === 'Polygon' ? [g.coordinates] : g.coordinates).map(rings => rings.map(r => { const s = simplifyRing(r, shared, tol); if (s !== r) changed = true; return s; }));
  if (!changed) return g;
  return g.type === 'Polygon' ? { type: 'Polygon', coordinates: polys[0] } : { type: 'MultiPolygon', coordinates: polys };
}

/** Signed-area magnitude in m² (outer minus holes), for the per-building area report. */
export function areaM2(g: Geometry): number {
  let total = 0;
  for (const rings of g.type === 'Polygon' ? [g.coordinates] : g.coordinates) rings.forEach((ring, k) => {
    if (ring.length < 3) return;
    const kx = M_PER_DEG_LAT * Math.cos(ring[0][1] * Math.PI / 180);
    let a = 0;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) a += ((ring[j][0] - ring[0][0]) * kx) * ((ring[i][1] - ring[0][1]) * M_PER_DEG_LAT) - ((ring[i][0] - ring[0][0]) * kx) * ((ring[j][1] - ring[0][1]) * M_PER_DEG_LAT);
    total += (k === 0 ? 1 : -1) * Math.abs(a / 2);
  });
  return total;
}

export const MAX_AREA_CHANGE = 0.01;
/** Which parts of the policy a compile applies; recorded as index.policyOptions so world:verify applies the same.
 *  Collinear-vertex removal is off by default (held 2026-10-31, #130: 0.14 MB, no pixel proof yet). */
export type PolicyOptions = { collinear: boolean };
export const DEFAULT_POLICY_OPTIONS: PolicyOptions = { collinear: false };
/** index.policyOptions as written (absent on the first policy stagings, which removed collinear vertices). */
export const policyOptionsOf = (index: { policy?: unknown; policyOptions?: Partial<PolicyOptions> }): PolicyOptions | null =>
  index.policy ? { collinear: index.policyOptions?.collinear ?? true } : null;
export type PolicyReport = { buildings: number; heightsRounded: number; footprintsSimplified: number; verticesBefore: number; verticesAfter: number; keptForArea: number; areaChangeM2: number[]; areaChangeRel: number[] };
export const emptyPolicyReport = (): PolicyReport => ({ buildings: 0, heightsRounded: 0, footprintsSimplified: 0, verticesBefore: 0, verticesAfter: 0, keptForArea: 0, areaChangeM2: [], areaChangeRel: [] });
const vertexCount = (g: Geometry) => (g.type === 'Polygon' ? [g.coordinates] : g.coordinates).reduce((n, rings) => n + rings.reduce((m, r) => m + r.length, 0), 0);

/** A footprint as the policy writes it: simplified, unless that changes its area by more than MAX_AREA_CHANGE. */
export function policyFootprint(g: Geometry, shared: Set<string>, report?: PolicyReport): Geometry {
  let out = simplifyGeometry(g, shared);
  if (report) report.verticesBefore += vertexCount(g);
  if (out !== g) {
    const a0 = areaM2(g), d = Math.abs(areaM2(out) - a0), rel = a0 > 0 ? d / a0 : d > 0 ? Infinity : 0;
    if (rel > MAX_AREA_CHANGE) { out = g; if (report) report.keptForArea++; }
    else if (report) { report.footprintsSimplified++; report.areaChangeM2.push(d); report.areaChangeRel.push(rel); }
  }
  if (report) report.verticesAfter += vertexCount(out);
  return out;
}

/** The cell as the policy writes it (a new cell; the input is not modified). Apply it once, to a cell compiled
 *  without it: simplifying an already simplified footprint measures against the simplified vertices. */
export function applyPolicy(cell: Cell, report: PolicyReport = emptyPolicyReport(), options: PolicyOptions = DEFAULT_POLICY_OPTIONS): Cell {
  const shared = options.collinear ? sharedVertices(cell.buildings.map(b => b.geometry)) : new Set<string>();
  const buildings = cell.buildings.map(b => {
    report.buildings++;
    const attr = quantiseHeights(b.attr), styled = b.styled && quantiseHeights(b.styled);
    if (attr !== b.attr || styled !== b.styled) report.heightsRounded++;
    const geometry = options.collinear ? policyFootprint(b.geometry, shared, report) : b.geometry;
    const out = { ...b, geometry, attr };
    if (styled) out.styled = styled;
    return out;
  });
  return { ...cell, buildings };
}

/** max / p99 / count of the area changes, for reports. */
export function summarisePolicy(r: PolicyReport) {
  const q = (xs: number[], p: number) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.min(s.length - 1, Math.floor(p * s.length))] : 0; };
  return { policy: POLICY_VERSION, buildings: r.buildings, heightsRounded: r.heightsRounded, footprintsSimplified: r.footprintsSimplified, keptForArea: r.keptForArea, verticesBefore: r.verticesBefore, verticesAfter: r.verticesAfter,
    areaChangeM2: { max: q(r.areaChangeM2, 1), p99: q(r.areaChangeM2, 0.99) }, areaChangeRel: { max: q(r.areaChangeRel, 1), p99: q(r.areaChangeRel, 0.99) } };
}
