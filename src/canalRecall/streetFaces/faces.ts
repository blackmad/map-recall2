/**
 * Street faces from data (lane FD, 2026-11-13). Pure, no DOM. Plan: describe street faces, not single houses.
 *
 * A FACE is a run of pands that
 *   1. stand on the same side of the same street (street = nearest named street centreline to the footprint, side =
 *      the cardinal direction of the street's normal pointing at the pand),
 *   2. touch (footprint gap <= TOUCH_GAP_M, i.e. share a party wall),
 *   3. were built within YEAR_TOL years of each other (BAG bouwjaar, +-3), and
 *   4. have the same footprint SIGNATURE (below).
 * A pand that meets no such neighbour is a face of one (a long single pand counts as a face of one).
 *
 * SIGNATURE of a pand, measured on the frontage axis (the footprint edge longest among those within AXIS_TOL_DEG of
 * the street's direction; the street direction when none):
 *   frontM   extent of the footprint along the axis        (frontage width)
 *   depthM   extent across the axis                         (depth)
 *   corners  vertices whose turn is >= CORNER_DEG           (BAG rings also carry collinear nodes where neighbours'
 *                                                            walls meet, so raw point counts differ inside one row)
 *   points   raw ring vertices, kept for the record
 * Two pands match when |depth - depth'| <= max(DEPTH_TOL_M, DEPTH_TOL_REL x depth), |front - front'| <=
 * max(FRONT_TOL_M, FRONT_TOL_REL x front) and (strict mode) corners are equal. Matching is pairwise between
 * neighbours and faces are the connected components (union-find), so a face can drift in width along a row but never
 * jumps a mismatch. Modes: strict (signature), shape (depth and width, any corner count), year (adjacency and year only).
 */
export type XY = readonly [number, number];
export type Ring = readonly XY[];

export const TOUCH_GAP_M = 0.6;
export const YEAR_TOL = 3;
export const DEPTH_TOL_M = 1, DEPTH_TOL_REL = 0.08;
export const FRONT_TOL_M = 1, FRONT_TOL_REL = 0.15;
export const CORNER_DEG = 15;
export const AXIS_TOL_DEG = 25;
export const STREET_REACH_M = 45;
export type MatchMode = 'strict' | 'shape' | 'year';

export interface Segment { name: string; x0: number; y0: number; x1: number; y1: number }

/** Metres around lat0/lng0 (equirectangular). */
export function projector(lat0: number): (lng: number, lat: number) => [number, number] {
  const kx = 111_320 * Math.cos((lat0 * Math.PI) / 180), ky = 111_320;
  return (lng, lat) => [lng * kx, lat * ky];
}

const open = (r: Ring): XY[] => (r.length > 1 && r[0][0] === r[r.length - 1][0] && r[0][1] === r[r.length - 1][1] ? r.slice(0, -1) : [...r]);

export function cornerCount(ring: Ring, deg = CORNER_DEG): number {
  const p = open(ring); let n = 0;
  for (let i = 0; i < p.length; i++) {
    const a = p[(i + p.length - 1) % p.length], b = p[i], c = p[(i + 1) % p.length];
    const u = [b[0] - a[0], b[1] - a[1]], v = [c[0] - b[0], c[1] - b[1]];
    const lu = Math.hypot(u[0], u[1]), lv = Math.hypot(v[0], v[1]);
    if (lu < 1e-6 || lv < 1e-6) continue;
    const turn = Math.acos(Math.max(-1, Math.min(1, (u[0] * v[0] + u[1] * v[1]) / (lu * lv)))) * 180 / Math.PI;
    if (turn >= deg) n++;
  }
  return n;
}

/** Frontage axis (unit vector): longest edge within AXIS_TOL_DEG of the street direction (either way), else the street direction. */
export function frontageAxis(ring: Ring, street: XY): [number, number] {
  const p = open(ring), sl = Math.hypot(street[0], street[1]) || 1, s: [number, number] = [street[0] / sl, street[1] / sl];
  let best: [number, number] | null = null, bestLen = 0;
  for (let i = 0; i < p.length; i++) {
    const a = p[i], b = p[(i + 1) % p.length], dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy);
    if (len < 1e-6) continue;
    const cos = Math.abs((dx * s[0] + dy * s[1]) / len);
    if (cos >= Math.cos((AXIS_TOL_DEG * Math.PI) / 180) && len > bestLen) { bestLen = len; best = [dx / len, dy / len]; }
  }
  return best ?? s;
}

export interface Signature { frontM: number; depthM: number; corners: number; points: number }
export function signatureOf(ring: Ring, axis: XY): Signature {
  const p = open(ring); let a0 = Infinity, a1 = -Infinity, c0 = Infinity, c1 = -Infinity;
  for (const [x, y] of p) { const a = x * axis[0] + y * axis[1], c = -x * axis[1] + y * axis[0]; a0 = Math.min(a0, a); a1 = Math.max(a1, a); c0 = Math.min(c0, c); c1 = Math.max(c1, c); }
  return { frontM: a1 - a0, depthM: c1 - c0, corners: cornerCount(ring), points: p.length };
}

export const signatureKey = (s: Signature): string => `${Math.round(s.depthM)}m deep x ${Math.round(s.frontM)}m front, ${s.corners} corners, ${s.points} pts`;

export function signaturesMatch(a: Signature, b: Signature, mode: MatchMode): boolean {
  if (mode === 'year') return true;
  const dd = Math.abs(a.depthM - b.depthM) <= Math.max(DEPTH_TOL_M, DEPTH_TOL_REL * Math.max(a.depthM, b.depthM));
  const ff = Math.abs(a.frontM - b.frontM) <= Math.max(FRONT_TOL_M, FRONT_TOL_REL * Math.max(a.frontM, b.frontM));
  return dd && ff && (mode === 'shape' || a.corners === b.corners);
}

// --- streets ---------------------------------------------------------------------------------------------------

const CELL = 30;
export class StreetGrid {
  private cells = new Map<string, Segment[]>();
  constructor(segments: readonly Segment[]) {
    for (const s of segments) {
      const x0 = Math.floor((Math.min(s.x0, s.x1) - STREET_REACH_M) / CELL), x1 = Math.floor((Math.max(s.x0, s.x1) + STREET_REACH_M) / CELL);
      const y0 = Math.floor((Math.min(s.y0, s.y1) - STREET_REACH_M) / CELL), y1 = Math.floor((Math.max(s.y0, s.y1) + STREET_REACH_M) / CELL);
      for (let i = x0; i <= x1; i++) for (let j = y0; j <= y1; j++) { const k = `${i}:${j}`; const l = this.cells.get(k); if (l) l.push(s); else this.cells.set(k, [s]); }
    }
  }
  near(x: number, y: number): readonly Segment[] { return this.cells.get(`${Math.floor(x / CELL)}:${Math.floor(y / CELL)}`) ?? []; }
}

export function pointSegment(px: number, py: number, s: Segment): { d: number; x: number; y: number } {
  const dx = s.x1 - s.x0, dy = s.y1 - s.y0, l2 = dx * dx + dy * dy;
  const t = l2 > 0 ? Math.max(0, Math.min(1, ((px - s.x0) * dx + (py - s.y0) * dy) / l2)) : 0;
  const x = s.x0 + t * dx, y = s.y0 + t * dy;
  return { d: Math.hypot(px - x, py - y), x, y };
}

/** Boundary samples: every vertex and a point every <= 3 m along each edge. */
export function boundarySamples(ring: Ring, step = 3): XY[] {
  const p = open(ring), out: XY[] = [];
  for (let i = 0; i < p.length; i++) {
    const a = p[i], b = p[(i + 1) % p.length], n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / step));
    for (let k = 0; k < n; k++) out.push([a[0] + ((b[0] - a[0]) * k) / n, a[1] + ((b[1] - a[1]) * k) / n]);
  }
  return out;
}

export interface StreetFront { street: string; side: 'N' | 'E' | 'S' | 'W'; distM: number; dir: [number, number]; corner: boolean }

/** The nearest named street to a footprint, the side of it the footprint stands on, and whether a second street is also close (a corner). */
export function streetFront(ring: Ring, grid: StreetGrid, cornerM = 12): StreetFront | null {
  let best: { d: number; s: Segment; x: number; y: number } | null = null;
  const samples = boundarySamples(ring), near = new Map<string, number>();
  for (const [px, py] of samples) for (const s of grid.near(px, py)) {
    const r = pointSegment(px, py, s);
    if (r.d > STREET_REACH_M) continue;
    if (!best || r.d < best.d) best = { d: r.d, s, x: r.x, y: r.y };
    if (r.d <= cornerM) near.set(s.name, Math.min(near.get(s.name) ?? Infinity, r.d));
  }
  if (!best) return null;
  const p = open(ring), cx = p.reduce((a, q) => a + q[0], 0) / p.length, cy = p.reduce((a, q) => a + q[1], 0) / p.length;
  // Side: the cardinal direction of the segment's normal that points from the street towards the footprint's centre.
  const sx = best.s.x1 - best.s.x0, sy = best.s.y1 - best.s.y0;
  let nx = -sy, ny = sx; if (nx * (cx - best.x) + ny * (cy - best.y) < 0) { nx = -nx; ny = -ny; }
  const side = Math.abs(nx) >= Math.abs(ny) ? (nx >= 0 ? 'E' : 'W') : ny >= 0 ? 'N' : 'S';
  const corner = [...near.keys()].some(n => n !== best!.s.name);
  return { street: best.s.name, side, distM: best.d, dir: [best.s.x1 - best.s.x0, best.s.y1 - best.s.y0], corner };
}

// --- adjacency -------------------------------------------------------------------------------------------------

function ringGap(a: Ring, b: Ring, limit: number): boolean {
  const pa = open(a), pb = open(b), l2 = limit * limit;
  const seg = (q: XY[], r: XY[]) => { for (const [x, y] of q) for (let j = 0; j < r.length; j++) { const u = r[j], v = r[(j + 1) % r.length]; const r2 = pointSegment(x, y, { name: '', x0: u[0], y0: u[1], x1: v[0], y1: v[1] }); if (r2.d * r2.d <= l2) return true; } return false; };
  return seg(pa, pb) || seg(pb, pa);
}

export interface FacePand {
  id: string;
  ring: Ring;
  year: number | null;
  street: string | null;
  side: string | null;
  sig: Signature;
}
export interface Face { street: string | null; side: string | null; pands: string[]; frontageM: number; year: number | null; yearMin: number | null; yearMax: number | null; signature: string }

/** Pairs (i < j) of pands on the same street side whose footprints touch: the face graph before year and shape are asked. */
export function adjacentPairs(pands: readonly Pick<FacePand, 'ring' | 'street' | 'side'>[]): [number, number][] {
  const cells = new Map<string, number[]>(), C = 40, out: [number, number][] = [];
  const box = pands.map(p => { let a = Infinity, b = Infinity, c = -Infinity, d = -Infinity; for (const [x, y] of p.ring) { a = Math.min(a, x); b = Math.min(b, y); c = Math.max(c, x); d = Math.max(d, y); } return [a, b, c, d]; });
  pands.forEach((p, i) => {
    if (p.street === null) return;
    const [a, b, c, d] = box[i];
    for (let x = Math.floor((a - 1) / C); x <= Math.floor((c + 1) / C); x++) for (let y = Math.floor((b - 1) / C); y <= Math.floor((d + 1) / C); y++) { const k = `${x}:${y}`; const l = cells.get(k); if (l) l.push(i); else cells.set(k, [i]); }
  });
  const seen = new Set<number>();
  for (const list of cells.values()) for (const i of list) for (const j of list) {
    if (j <= i) continue;
    const key = i * pands.length + j;
    if (seen.has(key)) continue; seen.add(key);
    if (pands[i].street !== pands[j].street || pands[i].side !== pands[j].side) continue;
    if (box[i][0] > box[j][2] + TOUCH_GAP_M || box[j][0] > box[i][2] + TOUCH_GAP_M || box[i][1] > box[j][3] + TOUCH_GAP_M || box[j][1] > box[i][3] + TOUCH_GAP_M) continue;
    if (ringGap(pands[i].ring, pands[j].ring, TOUCH_GAP_M)) out.push([i, j]);
  }
  return out;
}

/** Do two touching pands belong to one face? Year within +-YEAR_TOL (unknown years never join) and the signature rule of `mode`. */
export const sameFace = (a: FacePand, b: FacePand, mode: MatchMode): boolean =>
  a.year !== null && b.year !== null && Math.abs(a.year - b.year) <= YEAR_TOL && signaturesMatch(a.sig, b.sig, mode);

/** Faces among `pands` (all generic, metres rings). */
export function buildFaces(pands: readonly FacePand[], mode: MatchMode = 'strict'): Face[] {
  const parent = pands.map((_, i) => i);
  const find = (i: number): number => { while (parent[i] !== i) i = parent[i] = parent[parent[i]]; return i; };
  for (const [i, j] of adjacentPairs(pands)) if (sameFace(pands[i], pands[j], mode)) parent[find(i)] = find(j);
  const groups = new Map<number, number[]>();
  pands.forEach((_, i) => { const r = find(i); const l = groups.get(r); if (l) l.push(i); else groups.set(r, [i]); });
  return [...groups.values()].map(m => {
    const years = m.map(i => pands[i].year).filter((y): y is number => y !== null).sort((a, b) => a - b);
    const first = pands[m[0]];
    return { street: first.street, side: first.side, pands: m.map(i => pands[i].id), frontageM: +m.reduce((s, i) => s + pands[i].sig.frontM, 0).toFixed(1),
      year: years.length ? years[Math.floor(years.length / 2)] : null, yearMin: years[0] ?? null, yearMax: years.at(-1) ?? null, signature: signatureKey(first.sig) };
  });
}

export type SingleReason = 'no-neighbour' | 'year-differs' | 'shape-differs' | 'year-and-shape-differ' | 'described-neighbour' | 'no-street-or-year';
/**
 * Why each pand stands alone: nothing touches it on its street side; every touching generic neighbour differs in
 * year, shape or both; or only an already-described pand (`fixed`) touches it. `pands` then `fixed` share one index space in the pairs.
 */
export function singleReasons(pands: readonly FacePand[], fixed: readonly FacePand[], mode: MatchMode = 'strict'): Map<string, SingleReason> {
  const all = [...pands, ...fixed], n = pands.length, touch = new Map<number, number[]>();
  for (const [i, j] of adjacentPairs(all)) { (touch.get(i) ?? touch.set(i, []).get(i)!).push(j); (touch.get(j) ?? touch.set(j, []).get(j)!).push(i); }
  const joined = new Set<number>();
  for (const [i, js] of touch) if (i < n && js.some(j => j < n && sameFace(all[i], all[j], mode))) joined.add(i);
  const out = new Map<string, SingleReason>();
  for (let i = 0; i < n; i++) {
    if (joined.has(i)) continue;
    const p = all[i], js = touch.get(i) ?? [];
    if (p.street === null || p.year === null) { out.set(p.id, 'no-street-or-year'); continue; }
    const generic = js.filter(j => j < n);
    if (!generic.length) { out.set(p.id, js.length ? 'described-neighbour' : 'no-neighbour'); continue; }
    const yearOk = generic.some(j => all[j].year !== null && Math.abs(all[j].year! - p.year!) <= YEAR_TOL);
    const shapeOk = generic.some(j => signaturesMatch(p.sig, all[j].sig, mode));
    out.set(p.id, yearOk ? 'shape-differs' : shapeOk ? 'year-differs' : 'year-and-shape-differ');
  }
  return out;
}

// --- distribution ----------------------------------------------------------------------------------------------

export interface Distribution {
  faces: number; pands: number; frontageM: number;
  meanSize: number; medianSize: number; singleFaceShare: number; pandsInSingleShare: number; maxSize: number;
  /** Faces needed (largest first) to cover this share of pands / of frontage metres. */
  facesFor: Record<'p50' | 'p80' | 'p95', number>;
  facesForFrontage: Record<'p50' | 'p80' | 'p95', number>;
}
export function distribution(faces: readonly Face[]): Distribution {
  const sizes = faces.map(f => f.pands.length), total = sizes.reduce((a, b) => a + b, 0), front = faces.reduce((s, f) => s + f.frontageM, 0);
  const need = (vals: number[], sum: number) => {
    const sorted = [...vals].sort((a, b) => b - a), out = { p50: 0, p80: 0, p95: 0 }; let acc = 0;
    sorted.forEach((v, i) => { acc += v; for (const [k, q] of [['p50', 0.5], ['p80', 0.8], ['p95', 0.95]] as const) if (!out[k] && acc >= q * sum) out[k] = i + 1; });
    return out;
  };
  const ss = [...sizes].sort((a, b) => a - b);
  return {
    faces: faces.length, pands: total, frontageM: Math.round(front), meanSize: total / Math.max(1, faces.length), medianSize: ss.length ? ss[Math.floor(ss.length / 2)] : 0,
    singleFaceShare: sizes.filter(n => n === 1).length / Math.max(1, faces.length), pandsInSingleShare: sizes.filter(n => n === 1).length / Math.max(1, total), maxSize: ss.at(-1) ?? 0,
    facesFor: need(sizes, total), facesForFrontage: need(faces.map(f => f.frontageM), front),
  };
}
