// Tram rails centred in their carriageway (pure; lane fb-bridges-20261119, feedback 62d5a35f "why are the rails slightly
// off-center?", Vijzelstraat).
//
// The rails are drawn on the OSM road way at track offsets (osmGround.ts crossSection `rails`): measured from BGT spoor /
// OSM railway=tram where patch-osm-trams.ts tagged `embedded_rails:offsets`, else the default ±1.5 m (one track: 0).
// The road way is not the carriageway's centreline, so the pair can sit to one side of the dark rijbaan the rider sees:
// on Vijzelstraat 0.45-0.75 m (probe-rail-centre.ts), where the 8 cm orthophoto shows the tracks centred.
//
// Rule: per rail way, the median over stations every RAIL_CENTRE_STATION_M of (carriageway centre − rails' centre), the
// carriageway being the run of surveyed carriage polygons (red cycle strips left out) across the way through the rails'
// centre. Within RAIL_CENTRE_TOL_M (RAIL_CENTRE_TOL_MEASURED_M for measured offsets: BGT spoor is surveyed too) the pair
// moves by it; further off it is taken as real (a tram lane beside the car lane, a median bed) and kept. So the rails
// stay continuous where two rail ways with the same tracks meet, each way's shift eases over RAIL_CENTRE_TAPER_M to the
// mean of the ways' shifts at their shared node, measured from the stations within RAIL_CENTRE_NODE_M of it.

/** What carriagewaySpan reads: the survey's polygon classes and meshes at a point (RoadIndex). */
export interface CarriageIndex {
  findAtLevel(x: number, y: number, bridge?: boolean): number;
  drawClass(k: number): string;
  mesh(k: number): string;
}

type Vec2 = readonly [number, number];

/** Coarse scan step across the way, metres; the edge is then bisected to SPAN_TOL_M. */
export const SPAN_STEP_M = 0.5;
export const SPAN_TOL_M = 0.05;
/** Furthest a carriageway edge is looked for from the rails' centre, metres. */
export const SPAN_REACH_M = 12;
/** A pair of unmeasured (default) offsets within this of the carriageway's centre is centred, metres. */
export const RAIL_CENTRE_TOL_M = 1;
/** Measured offsets (embedded_rails:offsets from BGT spoor) are moved only within this, metres. */
export const RAIL_CENTRE_TOL_MEASURED_M = 0.5;
/** The carriageway must be at least this much wider than the outer rails' spread (gauge + clearance), metres. */
export const RAIL_CENTRE_MIN_WIDTH_M = 3.5;
/** Stations along the way, metres apart. */
export const RAIL_CENTRE_STATION_M = 2;
/** At least this share of a way's stations must find a carriageway span. */
export const RAIL_CENTRE_MIN_SHARE = 0.5;
/** A shared node's shift is read off each way's stations within this of it, metres. */
export const RAIL_CENTRE_NODE_M = 8;
/** A way's shift eases to its nodes' over this length at each end (at most half the way), metres. */
export const RAIL_CENTRE_TAPER_M = 10;

/**
 * The carriageway's extent across the way at (x, y): the run of carriage polygons along the left normal (nx, ny)
 * through offset `mid`, as [lo, hi] offsets. `red`: count red cycle strips (mesh 'cycle') as carriageway too.
 * Null when `mid` itself is off the carriageway.
 */
export function carriagewaySpan(index: CarriageIndex, x: number, y: number, nx: number, ny: number, mid: number, bridge: boolean, red: boolean): [number, number] | null {
  const on = (t: number) => {
    const k = index.findAtLevel(x + nx * t, y + ny * t, bridge);
    return k >= 0 && index.drawClass(k) === 'carriage' && (red || index.mesh(k) !== 'cycle');
  };
  if (!on(mid)) return null;
  const edge = (dir: 1 | -1): number => {
    let inside = mid;
    while (Math.abs(inside - mid) < SPAN_REACH_M && on(inside + dir * SPAN_STEP_M)) inside += dir * SPAN_STEP_M;
    if (Math.abs(inside - mid) >= SPAN_REACH_M) return inside;
    let outside = inside + dir * SPAN_STEP_M;
    while (Math.abs(outside - inside) > SPAN_TOL_M) { const m = (inside + outside) / 2; if (on(m)) inside = m; else outside = m; }
    return inside;
  };
  return [edge(-1), edge(1)];
}

/** A rail way for the plan: its points, its track offsets, bridge level, and whether the offsets were measured. */
export interface RailWayIn { id: number; points: readonly Vec2[]; rails: readonly number[]; bridge: boolean; measured: boolean }
/** A way's shift along it: `start` at s = 0, `mid` in the middle, `end` at the far end, eased over `taper`. */
export interface RailShift { start: number; mid: number; end: number; taper: number; length: number }

const median = (xs: number[]): number => { const a = [...xs].sort((p, q) => p - q), n = a.length; return n % 2 ? a[n >> 1] : (a[n / 2 - 1] + a[n / 2]) / 2; };
const nodeKey = (p: Vec2) => `${Math.round(p[0] * 10)},${Math.round(p[1] * 10)}`;

/** Stations of a way: (s, carriageway centre − rails' centre) where measurable, and the station count. */
export function stationOffsets(index: CarriageIndex, w: RailWayIn): { at: { s: number; off: number }[]; n: number; length: number } {
  const mid = w.rails.reduce((a, b) => a + b, 0) / w.rails.length, spread = Math.max(...w.rails) - Math.min(...w.rails);
  const at: { s: number; off: number }[] = [];
  let n = 0, s0 = 0;
  for (let i = 0; i + 1 < w.points.length; i++) {
    const [ax, ay] = w.points[i], [bx, by] = w.points[i + 1], l = Math.hypot(bx - ax, by - ay);
    if (l < 1e-6) continue;
    const nx = -(by - ay) / l, ny = (bx - ax) / l;
    for (let s = RAIL_CENTRE_STATION_M / 2; s < l; s += RAIL_CENTRE_STATION_M) {
      n++;
      const span = carriagewaySpan(index, ax + (bx - ax) * s / l, ay + (by - ay) * s / l, nx, ny, mid, w.bridge, false);
      if (span && span[1] - span[0] >= RAIL_CENTRE_MIN_WIDTH_M + spread) at.push({ s: s0 + s, off: (span[0] + span[1]) / 2 - mid });
    }
    s0 += l;
  }
  return { at, n, length: s0 };
}

/**
 * The shifts for a set of rail ways (each way's own and its neighbours' sharing a node, so the nodes agree): ways whose
 * shift is 0 everywhere are left out.
 */
export function planRailCentres(index: CarriageIndex, ways: readonly RailWayIn[]): Map<number, RailShift> {
  const tol = (w: RailWayIn) => (w.measured ? RAIL_CENTRE_TOL_MEASURED_M : RAIL_CENTRE_TOL_M);
  const info = new Map<number, { w: RailWayIn; mid: number; near: [number, number]; length: number }>();
  for (const w of ways) {
    if (info.has(w.id) || !w.rails.length || w.points.length < 2) continue;
    const { at, n, length } = stationOffsets(index, w);
    const ok = n > 0 && at.length >= RAIL_CENTRE_MIN_SHARE * n;
    const m = ok ? median(at.map(a => a.off)) : 0, mid = Math.abs(m) <= tol(w) ? m : 0;
    // The shift near each end: the stations within RAIL_CENTRE_NODE_M of it alone (a neighbouring cell's build of the
    // same node reads the same stations), else the way's own; out of tolerance, none.
    const end = (inRange: (s: number) => boolean) => { const xs = at.filter(a => inRange(a.s)).map(a => a.off); const v = xs.length >= 2 ? median(xs) : mid; return Math.abs(v) <= tol(w) ? v : 0; };
    info.set(w.id, { w, mid, near: [end(s => s <= RAIL_CENTRE_NODE_M), end(s => s >= length - RAIL_CENTRE_NODE_M)], length });
  }
  // Shared nodes between ways with the same tracks: the mean of their near-end shifts.
  const nodes = new Map<string, { id: number; end: 0 | 1 }[]>();
  for (const [id, { w }] of info) for (const end of [0, 1] as const) {
    const k = `${nodeKey(end ? w.points[w.points.length - 1] : w.points[0])}|${w.rails.join(';')}`;
    (nodes.get(k) ?? nodes.set(k, []).get(k)!).push({ id, end });
  }
  const at = new Map<string, number>();
  for (const [k, list] of nodes) at.set(k, list.length > 1 ? list.reduce((a, e) => a + info.get(e.id)!.near[e.end], 0) / list.length : info.get(list[0].id)!.near[list[0].end]);
  const out = new Map<number, RailShift>();
  for (const [id, { w, mid, length }] of info) {
    const v = (end: 0 | 1) => at.get(`${nodeKey(end ? w.points[w.points.length - 1] : w.points[0])}|${w.rails.join(';')}`)!;
    const sh: RailShift = { start: v(0), mid, end: v(1), taper: Math.min(RAIL_CENTRE_TAPER_M, length / 2), length };
    if (sh.start || sh.mid || sh.end) out.set(id, sh);
  }
  return out;
}

/** The shift at station s along the way. */
export function shiftAt(sh: RailShift, s: number): number {
  if (sh.taper <= 0) return sh.mid;
  if (s < sh.taper) return sh.start + (sh.mid - sh.start) * Math.max(0, s) / sh.taper;
  if (s > sh.length - sh.taper) return sh.end + (sh.mid - sh.end) * Math.max(0, sh.length - s) / sh.taper;
  return sh.mid;
}

/**
 * The way's polyline moved left by the shift along it (vertices added where the tapers end), so the rails drawn on it at
 * their offsets sit on the carriageway's centre. The ends stay on the way's end nodes' normals.
 */
export function shiftedLine(points: readonly Vec2[], sh: RailShift): [number, number][] {
  const st = [0];
  for (let i = 1; i < points.length; i++) st.push(st[i - 1] + Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]));
  // The taper ends as vertices.
  const pts: [number, number, number][] = points.map((p, i) => [p[0], p[1], st[i]]);
  for (const cut of new Set([sh.taper, sh.length - sh.taper])) {
    if (cut <= 0 || cut >= sh.length || pts.some(q => Math.abs(q[2] - cut) < 0.05)) continue;
    const i = st.findIndex(s => s > cut);
    if (i <= 0) continue;
    const t = (cut - st[i - 1]) / (st[i] - st[i - 1]), j = pts.findIndex(q => q[2] > cut);
    pts.splice(j, 0, [points[i - 1][0] + (points[i][0] - points[i - 1][0]) * t, points[i - 1][1] + (points[i][1] - points[i - 1][1]) * t, cut]);
  }
  return pts.map(([x, y, s], i) => {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
    // The vertex normal: the mean of the two segment directions (the end segments' own at the ends).
    let dx = b[0] - a[0], dy = b[1] - a[1];
    const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l;
    const d = shiftAt(sh, s);
    return [x - dy * d, y + dx * d];
  });
}
