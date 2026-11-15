/**
 * Buurt generator (docs/handoffs/buurt-generators-20261115.md): the street-side rows and series of a district's
 * undescribed pands, from BAG footprints, build years, 3DBAG eaves and the OSM street names. Pure: no fs, no DOM.
 *
 *  - Front edge: a pand's outline edge that no neighbour shares (a party wall is an edge another pand's edge runs along
 *    within PARTY_M), facing the nearest named street within FRONT_MAX_M of its midpoint, the street on its outside.
 *  - Row: pands on one front street whose front edges continue each other (ends within JOIN_M, directions within
 *    JOIN_DEG) and which share a party wall. Members are in street order, left to right as seen from the street.
 *  - Series: a run of one design inside a row. A new series starts at a build-year step of more than SERIES_YEAR_STEP or
 *    an eaves step of more than ROW_EAVES_STEP_M against the run's median; a lone member that steps out and back
 *    (both neighbours agree) is clamped to the run (memory "row coherence"), never a series of its own.
 *
 * Nothing here is hashed: the same footprints give the same rows and series, whatever order they come in.
 */

import { erkersOf, type BuurtErker } from './kit/frontKit.ts';

export type LngLat = readonly [number, number];
export interface GenPand {
  id: string;
  /** Outer ring, lng/lat, closed or open. */
  ring: readonly LngLat[];
  year: number | null;
  /** 3DBAG eaves and ridge above the pand's ground (m), as the base tiles carry them. */
  eavesM: number | null;
  ridgeM: number | null;
}
export interface GenStreet { name: string; path: readonly LngLat[] }

/** An edge another pand's edge runs along within this distance (m) is a party wall. */
export const PARTY_M = 0.35;
/** A front edge faces a named street whose centre line is at most this far from its midpoint (m). */
export const FRONT_MAX_M = 30;
/** Edges shorter than this are not fronts (chamfers, jogs). */
export const FRONT_MIN_M = 2.5;
/** Front edges continue each other when their ends are this close (m) and their directions this close (degrees). */
export const JOIN_M = 1.2;
export const JOIN_DEG = 25;
/** A front runs on over ring edges within this offset (m) of its line, in its direction (degrees), or shorter than a jog (m). */
export const EXTEND_OFFSET_M = 1.5;
export const EXTEND_DEG = 20;
export const EXTEND_JOG_M = 1.6;
/** Pands under this eaves (m) or footprint (m²) are sheds, porches and garages: never row members (they break no row either). */
export const MINOR_EAVES_M = 5;
export const MINOR_AREA_M2 = 30;
export const SERIES_YEAR_STEP = 1;
/** The row-coherence step (memory "row coherence"): an eaves outlier beyond this is a step, a lone one is clamped. */
export const ROW_EAVES_STEP_M = 0.8;

type XY = { x: number; y: number };
export interface FrontEdge {
  street: string;
  /** Left and right end as seen from the street (local metres), and lng/lat. */
  a: XY; b: XY;
  aLngLat: LngLat; bLngLat: LngLat;
  lengthM: number;
  /** Outward unit normal (towards the street). */
  n: XY;
  /** Street centre line distance from the edge midpoint (m). */
  streetM: number;
  /** The front line: the chosen edge's line over the whole front (a, b projected onto it), lng/lat, left to right. */
  lineA: LngLat; lineB: LngLat;
  /** Erkers BAG draws in front of the line (kit/frontKit.ts erkersOf). */
  erkers: BuurtErker[];
}
export interface GenMember { pand: GenPand; front: FrontEdge }
export interface GenSeries {
  id: string;
  members: GenMember[];
  year: number | null;
  /** Median member eaves (m) and the members clamped to it. */
  eavesM: number | null;
  clamped: string[];
}
export interface GenRow {
  id: string;
  street: string;
  members: GenMember[];
  series: GenSeries[];
}
export interface RowsResult {
  rows: GenRow[];
  /** Pands that are in no row of two or more, with the reason. */
  unplaced: Array<{ id: string; reason: 'no-front' | 'single' | 'minor' }>;
}

/** A local equirectangular frame in metres around a reference latitude (the mesher's own frame, look/measuredWallPool.ts). */
export function frameAt(lat0: number) {
  const kx = 111_320 * Math.cos(lat0 * Math.PI / 180), ky = 110_540;
  return { xy: (p: LngLat): XY => ({ x: p[0] * kx, y: p[1] * ky }), lngLat: (q: XY): LngLat => [q.x / kx, q.y / ky] };
}

const sub = (p: XY, q: XY): XY => ({ x: p.x - q.x, y: p.y - q.y });
const dot = (p: XY, q: XY) => p.x * q.x + p.y * q.y;
const len = (p: XY) => Math.hypot(p.x, p.y);
function segDist(p: XY, a: XY, b: XY): number {
  const d = sub(b, a), l2 = dot(d, d) || 1, t = Math.max(0, Math.min(1, dot(sub(p, a), d) / l2));
  return len(sub(p, { x: a.x + d.x * t, y: a.y + d.y * t }));
}
function openRing(ring: readonly LngLat[]): LngLat[] {
  const r = [...ring];
  if (r.length > 1 && r[0][0] === r[r.length - 1][0] && r[0][1] === r[r.length - 1][1]) r.pop();
  return r;
}
const median = (xs: number[]) => { const s = [...xs].sort((p, q) => p - q); return s.length ? s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2 : NaN; };

/** Does edge (a, b) of one pand run along an edge of another within PARTY_M for most of its length? */
function sharedLength(a: XY, b: XY, others: XY[][]): number {
  const L = len(sub(b, a));
  if (!(L > 0)) return 0;
  let best = 0;
  for (const ring of others) for (let i = 0; i < ring.length; i++) {
    const p = ring[i], q = ring[(i + 1) % ring.length];
    // Sample the edge and count the part within PARTY_M of the other edge.
    let hit = 0; const N = 8;
    for (let k = 0; k <= N; k++) { const t = k / N, s = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }; if (segDist(s, p, q) <= PARTY_M) hit++; }
    best = Math.max(best, hit / (N + 1) * L);
  }
  return best;
}

/** Signed area > 0: counter-clockwise in a y-up frame. */
const signedArea = (r: XY[]) => r.reduce((t, p, i) => { const q = r[(i + 1) % r.length]; return t + p.x * q.y - q.x * p.y; }, 0) / 2;

/**
 * The pand's front edge: the longest unshared edge whose outward side faces a named street within FRONT_MAX_M, scored by
 * length over distance. `neighbours` are the rings of the pands around it (local metres).
 */
export function frontEdgeOf(pand: GenPand, ringXY: XY[], neighbours: XY[][], streets: Array<{ name: string; path: XY[] }>, frame: ReturnType<typeof frameAt>): FrontEdge | null {
  const ccw = signedArea(ringXY) > 0;
  let best: { e: FrontEdge; score: number } | null = null;
  for (let i = 0; i < ringXY.length; i++) {
    const p = ringXY[i], q = ringXY[(i + 1) % ringXY.length], d = sub(q, p), L = len(d);
    if (L < FRONT_MIN_M) continue;
    if (sharedLength(p, q, neighbours) > 0.5 * L) continue;
    // Outward normal: right of the edge direction for a counter-clockwise ring.
    const n = ccw ? { x: d.y / L, y: -d.x / L } : { x: -d.y / L, y: d.x / L };
    const mid = { x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 };
    let near: { name: string; m: number } | null = null;
    for (const s of streets) for (let k = 0; k + 1 < s.path.length; k++) {
      const a = s.path[k], b = s.path[k + 1], m = segDist(mid, a, b);
      if (m > FRONT_MAX_M || (near && m >= near.m)) continue;
      // The street must lie outside the edge: the nearest point is on the normal's side.
      const t = Math.max(0, Math.min(1, dot(sub(mid, a), sub(b, a)) / (dot(sub(b, a), sub(b, a)) || 1)));
      const foot = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
      if (dot(sub(foot, mid), n) <= 0.5) continue;
      near = { name: s.name, m };
    }
    if (!near) continue;
    const score = L / (1 + near.m / 10);
    if (best && score <= best.score) continue;
    // The whole front: extend over the ring's next and previous unshared edges that run on in the same line (BAG fronts
    // carry jogs of a few centimetres and short erker or porch steps), so the front ends meet the neighbours' fronts.
    const u = { x: d.x / L, y: d.y / L };
    const onLine = (s0: XY, s1: XY) => { const e = sub(s1, s0), l = len(e); if (l < 1e-6) return true; if (sharedLength(s0, s1, neighbours) > 0.5 * l) return false;
      return Math.abs(dot(sub(s0, p), n)) <= EXTEND_OFFSET_M && Math.abs(dot(sub(s1, p), n)) <= EXTEND_OFFSET_M && (l < EXTEND_JOG_M || Math.abs(dot(e, u)) / l >= Math.cos(EXTEND_DEG * Math.PI / 180)); };
    let lo = p, hi = q;
    for (let k = 1; k < ringXY.length - 1; k++) { const s0 = ringXY[(i + k) % ringXY.length], s1 = ringXY[(i + k + 1) % ringXY.length]; if (!onLine(s0, s1)) break; hi = s1; }
    for (let k = 1; k < ringXY.length - 1; k++) { const s1 = ringXY[(i - k + 1 + ringXY.length) % ringXY.length], s0 = ringXY[(i - k + ringXY.length) % ringXY.length]; if (!onLine(s0, s1)) break; lo = s0; }
    // Left to right as seen from the street: the viewer faces -n, so right is (-n.y, n.x).
    const right = { x: -n.y, y: n.x };
    const [aa, bb] = dot(sub(hi, lo), right) >= 0 ? [lo, hi] : [hi, lo];
    const proj = (v: XY): XY => { const t = dot(sub(v, p), u); return { x: p.x + u.x * t, y: p.y + u.y * t }; };
    const la = proj(aa), lb = proj(bb);
    best = { score, e: { street: near.name, a: aa, b: bb, aLngLat: frame.lngLat(aa), bLngLat: frame.lngLat(bb), lengthM: +len(sub(bb, aa)).toFixed(2), n, streetM: +near.m.toFixed(1),
      lineA: frame.lngLat(la), lineB: frame.lngLat(lb), erkers: [], la, lb } as FrontEdge & { la: XY; lb: XY } };
  }
  if (!best) return null;
  const { la, lb, ...e } = best.e as FrontEdge & { la: XY; lb: XY };
  return { ...e, erkers: erkersOf(ringXY, la, lb, e.n) };
}

const angleDeg = (u: XY, v: XY) => Math.acos(Math.max(-1, Math.min(1, dot(u, v) / (len(u) * len(v) || 1)))) * 180 / Math.PI;

/** Split a row (street order) into series by build year and eaves; a lone eaves outlier between agreeing neighbours is clamped. */
export function seriesOf(rowId: string, members: GenMember[]): GenSeries[] {
  const out: GenSeries[] = [];
  const eaves = (m: GenMember) => m.pand.eavesM;
  let run: GenMember[] = [];
  const close = () => {
    if (!run.length) return;
    const es = run.map(eaves).filter((e): e is number => typeof e === 'number' && e > 0);
    const line = es.length ? +median(es).toFixed(2) : null;
    const years = run.map(m => m.pand.year).filter((y): y is number => typeof y === 'number');
    out.push({ id: `${rowId}:s${out.length}`, members: run, year: years.length ? Math.round(median(years)) : null, eavesM: line,
      clamped: line === null ? [] : run.filter(m => eaves(m) !== null && Math.abs(eaves(m)! - line) > ROW_EAVES_STEP_M).map(m => m.pand.id) });
    run = [];
  };
  members.forEach((m, i) => {
    if (!run.length) { run.push(m); return; }
    const y0 = run[run.length - 1].pand.year, y = m.pand.year;
    const yearStep = y0 !== null && y !== null && Math.abs(y - y0) > SERIES_YEAR_STEP;
    const es = run.map(eaves).filter((e): e is number => e !== null);
    const line = es.length ? median(es) : null, e = eaves(m);
    let eavesStep = line !== null && e !== null && Math.abs(e - line) > ROW_EAVES_STEP_M;
    if (eavesStep) {
      // Lone outlier: the next member returns to the run's line (and shares its year): clamp, do not split.
      const next = members[i + 1], en = next ? eaves(next) : null;
      if (next && en !== null && Math.abs(en - line!) <= ROW_EAVES_STEP_M && !(next.pand.year !== null && y0 !== null && Math.abs(next.pand.year - y0) > SERIES_YEAR_STEP)) eavesStep = false;
    }
    if (yearStep || eavesStep) close();
    run.push(m);
  });
  close();
  return out;
}

/**
 * The rows of a district: every pand with a front edge, joined into rows on one street by continuing front edges and a
 * shared party wall, ordered left to right as seen from the street. `streets` are named centre lines (lng/lat).
 */
export function districtRows(input: readonly GenPand[], streets: readonly GenStreet[]): RowsResult {
  let pands = input;
  if (!pands.length) return { rows: [], unplaced: [] };
  const lat0 = pands[0].ring[0][1];
  const frame = frameAt(lat0);
  const minor: RowsResult['unplaced'] = [];
  pands = pands.filter(p => {
    const r = openRing(p.ring).map(frame.xy), small = Math.abs(signedArea(r)) < MINOR_AREA_M2 || (p.eavesM !== null && p.eavesM < MINOR_EAVES_M);
    if (small) minor.push({ id: p.id, reason: 'minor' });
    return !small;
  });
  if (!pands.length) return { rows: [], unplaced: minor };
  const rings = new Map(pands.map(p => [p.id, openRing(p.ring).map(frame.xy)]));
  const box = (r: XY[]) => [Math.min(...r.map(p => p.x)), Math.min(...r.map(p => p.y)), Math.max(...r.map(p => p.x)), Math.max(...r.map(p => p.y))] as const;
  const boxes = new Map([...rings].map(([id, r]) => [id, box(r)]));
  // Grid for neighbour lookups (25 m cells).
  const G = 25, grid = new Map<string, string[]>();
  for (const [id, b] of boxes) for (let gx = Math.floor(b[0] / G); gx <= Math.floor(b[2] / G); gx++) for (let gy = Math.floor(b[1] / G); gy <= Math.floor(b[3] / G); gy++) {
    const k = `${gx},${gy}`; (grid.get(k) ?? grid.set(k, []).get(k)!).push(id);
  }
  const near = (id: string) => {
    const b = boxes.get(id)!, s = new Set<string>();
    for (let gx = Math.floor((b[0] - 1) / G); gx <= Math.floor((b[2] + 1) / G); gx++) for (let gy = Math.floor((b[1] - 1) / G); gy <= Math.floor((b[3] + 1) / G); gy++)
      for (const o of grid.get(`${gx},${gy}`) ?? []) if (o !== id) { const c = boxes.get(o)!; if (c[0] <= b[2] + 1 && c[2] >= b[0] - 1 && c[1] <= b[3] + 1 && c[3] >= b[1] - 1) s.add(o); }
    return [...s].sort();
  };
  const sxy = streets.filter(s => s.name && s.path.length > 1).map(s => ({ name: s.name, path: s.path.map(frame.xy) }));
  const fronts = new Map<string, FrontEdge>();
  const unplaced: RowsResult['unplaced'] = [...minor];
  const byId = new Map(pands.map(p => [p.id, p]));
  const neighbours = new Map<string, string[]>();
  for (const p of [...pands].sort((u, v) => u.id < v.id ? -1 : 1)) {
    const nb = near(p.id); neighbours.set(p.id, nb);
    const e = frontEdgeOf(p, rings.get(p.id)!, nb.map(o => rings.get(o)!), sxy, frame);
    if (e) fronts.set(p.id, e); else unplaced.push({ id: p.id, reason: 'no-front' });
  }
  // Join: same street, continuing front edges, a shared party wall.
  const link = new Map<string, Set<string>>();
  const add = (u: string, v: string) => { (link.get(u) ?? link.set(u, new Set()).get(u)!).add(v); };
  for (const [id, e] of fronts) for (const o of neighbours.get(id)!) {
    const f = fronts.get(o);
    if (!f || f.street !== e.street || o < id) continue;
    if (angleDeg(sub(e.b, e.a), sub(f.b, f.a)) > JOIN_DEG) continue;
    const ends = Math.min(len(sub(e.b, f.a)), len(sub(f.b, e.a)), len(sub(e.a, f.a)), len(sub(e.b, f.b)));
    if (ends > JOIN_M) continue;
    const ri = rings.get(id)!, ro = rings.get(o)!;
    let party = 0;
    for (let i = 0; i < ri.length; i++) party = Math.max(party, sharedLength(ri[i], ri[(i + 1) % ri.length], [ro]));
    if (party < 2) continue;
    add(id, o); add(o, id);
  }
  const seen = new Set<string>(), rows: GenRow[] = [];
  for (const id of [...fronts.keys()].sort()) {
    if (seen.has(id)) continue;
    const comp: string[] = [], stack = [id];
    while (stack.length) { const u = stack.pop()!; if (seen.has(u)) continue; seen.add(u); comp.push(u); for (const v of link.get(u) ?? []) if (!seen.has(v)) stack.push(v); }
    if (comp.length < 2) { unplaced.push({ id, reason: 'single' }); continue; }
    // Street order: project each front midpoint on the mean left-to-right direction.
    const dir = comp.reduce((t, u) => { const e = fronts.get(u)!, d = sub(e.b, e.a), l = len(d) || 1; return { x: t.x + d.x / l, y: t.y + d.y / l }; }, { x: 0, y: 0 });
    const at = (u: string) => { const e = fronts.get(u)!; return dot({ x: (e.a.x + e.b.x) / 2, y: (e.a.y + e.b.y) / 2 }, dir); };
    comp.sort((u, v) => at(u) - at(v));
    const members = comp.map(u => ({ pand: byId.get(u)!, front: fronts.get(u)! }));
    const street = members[0].front.street;
    const rowId = `${street.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${comp[0].slice(-6)}`;
    rows.push({ id: rowId, street, members, series: seriesOf(rowId, members) });
  }
  rows.sort((p, q) => p.id < q.id ? -1 : p.id > q.id ? 1 : 0);
  return { rows, unplaced };
}
