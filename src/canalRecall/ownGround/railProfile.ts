// The railway tracks' vertical profile (pure, dependency-free; groundCell.ts → railTracks.ts railMeshes `levels`).
//
// rail-v1 drew every track on the relief under its centreline and every bridge way on the straight line between the
// relief at its own two ends (lane rail-look 2026-10-31, three player notes on build 04e3c88). AHN's DTM has no
// ground under a deck, and the 2 m field fills that hole from its rim: the embankment on one side, the street or
// water on the other. So at the Oostertoegang east of Centraal (note "ooof, these rails look really bad") a 46 m
// bridge way ran from +2.7 to +2.3 between embankments at +4.4, its 17 m neighbour from +4.6 down to +2.7 and the
// next from +1.4 to −0.7: separate slabs at separate tilts, floating over the water.
//
// The rule, city-wide, on the 3×3 neighbourhood's tracks as one graph (ways meet at shared points):
//
//   grade    A track never climbs or drops faster than its kind allows (RAIL_GRADE). Over the tracks off any
//            bridge the bed level is the relief's upward envelope at that grade: z(n) = max over m of
//            relief(m) − grade · path(m, n), where a point's relief is the highest land across the bed's top. A dip the fill smeared under the track next to an abutment is
//            lifted to the embankment's line; a genuine ramp at grade is left as it is.
//   bridges  The bridge ways form components (bridge ways meeting each other). A component's level at its
//            boundary points (where an approach meets it) is the approach's level there; inside, the deck runs
//            between them by path distance (two ends: the straight line). Never under the relief it crosses.
//   measured A point in a tunnel cut's box (`measured`) keeps its relief: its ramp is surveyed, not smeared (the IJburg
//            tram drops ~8 m into its cut under the A10 at Zeeburgereiland, steeper than any grade here).
//   platforms Track beside a platform (`platforms`, OSM railway=platform within PLATFORM_REACH_M) is levelled like a
//            deck: under a station roof AHN has no ground and the field is the rim's fill (Centraal's hall: the quay at
//            +1.2 against platforms at +4.5, lane rail-look round 3), so its level comes from the measured track
//            past the platforms' ends, never under the relief under its centreline. At a station at grade the track
//            around is at the platform's level already and nothing moves.
//   approachless  A component no approach meets (a tram whose street approaches rail-v1 leaves out): on a measured road
//            deck it rides that deck, drawn plainly without its slab (`plain`, `onDeck`); elsewhere it spans between
//            the relief at its own dead ends (`endAnchored`). A bridge way's dead end within SNAP_M of another track
//            joins it first (`snapped`).
//
// The cell keeps the levels of its own ways; every cell solves the same 3×3 graph near its tracks, so the levels
// agree across a seam.

import type { HeightFn, Vec2 } from './surface.js';
import type { RailKind, RailPlatform, RailWay } from './railTracks.js';

/**
 * Steepest grade per kind (rise over run), a little over practice so a measured ramp (a tunnel cut's floor) is never
 * lifted: main lines 2.5 % in ProRail practice (3 % here), metro 4 % (5 %), tram 6-7 % (8 %).
 */
export const RAIL_GRADE: Record<RailKind, number> = { rail: 0.03, narrow_gauge: 0.04, light_rail: 0.06, subway: 0.05, tram: 0.08 };
/** Graph spacing along a way, metres: the envelope and the deck lines are solved on these points. */
export const PROFILE_STEP_M = 4;
/** A bridge way's dead end this close to a track off the bridges joins it, metres. */
export const SNAP_M = 3;
/** Half the bed's top (railTracks RAIL_SECTION.topHalf): the land across it sets a node's relief. */
export const BED_HALF_M = 1.55;
/** The graph reaches this far past the cell, metres (inside groundStore CELL_RELIEF_PAD_M, 350 m). */
export const PROFILE_PAD_M = 300;
/** Track within this distance of a platform's outline (or over it) stands at the platform, metres: NS track centre to platform edge is 1.65-1.75 m. */
export const PLATFORM_REACH_M = 3;
/** Deck levels: at most this many over-relaxed sweeps toward the harmonic level, with this factor. */
export const HARMONIC_ITERATIONS = 600, HARMONIC_OMEGA = 1.85;
/** Land samples this close to a platform are its top, not ground under the bed, metres. */
export const PLATFORM_EDGE_M = 1;
/** The envelope lifts a track at most its grade over this many metres (12 m for a main line). */
export const ENVELOPE_REACH_M = 400;

/** A way's level along it: bed floor `z` (scene metres) at distances `s` from its first point. */
export interface WayLevel { s: number[]; z: number[]; /** A bridge way the data cannot place: drawn on the relief without its slab. */ plain?: boolean }
export interface RailProfileStats { nodes: number; /** Bridge dead ends joined to a nearby track (SNAP_M). */ snapped?: number; /** Components no track meets, spanned between the relief at their dead ends. */ endAnchored?: number; /** Of the plain ones, those riding a measured road deck. */ onDeck?: number; /** Graph points beside a platform, levelled from the track past its ends. */ platformNodes?: number; /** Largest lift of such a point off the bridges over its relief, metres. */ platformLift?: number; /** Where (game frame). */ platformLiftAt?: Vec2; components: number; anchored: number; plain: number; /** Largest lift of the bed over the relief by the envelope, metres. */ maxLift: number }

/** A way's identity across cells (each cell decodes its own copy). */
export const railWayKey = (w: RailWay): string => `${w.kind}${w.bridge ? 'b' : ''}${w.service ? 's' : ''}:${w.points.map(p => `${Math.round(p[0] * 10)},${Math.round(p[1] * 10)}`).join(';')}`;

const nodeKey = (p: Vec2) => `${Math.round(p[0] * 10)},${Math.round(p[1] * 10)}`;

/** Points every ≤ `step` metres along the way (its own points kept), with their distance from the start. */
function stations(pts: readonly Vec2[], step: number): { p: Vec2[]; s: number[] } {
  const p: Vec2[] = [pts[0]], s = [0];
  for (let i = 0; i + 1 < pts.length; i++) {
    const [ax, ay] = pts[i], [bx, by] = pts[i + 1], l = Math.hypot(bx - ax, by - ay), n = Math.max(1, Math.ceil(l / step));
    for (let k = 1; k <= n; k++) { p.push(k === n ? pts[i + 1] : [ax + (bx - ax) * k / n, ay + (by - ay) * k / n]); s.push(s[s.length - 1] + l / n); }
  }
  return { p, s };
}

/** A binary max-heap of (value, node). */
class Heap {
  private v: number[] = []; private n: number[] = [];
  get size(): number { return this.v.length; }
  push(value: number, node: number): void {
    const v = this.v, n = this.n; let i = v.length; v.push(value); n.push(node);
    while (i > 0) { const p = (i - 1) >> 1; if (v[p] >= v[i]) break; [v[p], v[i]] = [v[i], v[p]]; [n[p], n[i]] = [n[i], n[p]]; i = p; }
  }
  pop(): [number, number] {
    const v = this.v, n = this.n, top: [number, number] = [v[0], n[0]], lv = v.pop()!, ln = n.pop()!;
    if (v.length) {
      v[0] = lv; n[0] = ln; let i = 0;
      for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < v.length && v[l] > v[m]) m = l; if (r < v.length && v[r] > v[m]) m = r; if (m === i) break; [v[m], v[i]] = [v[i], v[m]]; [n[m], n[i]] = [n[i], n[m]]; i = m; }
    }
    return top;
  }
}

/**
 * Levels for `ways` (the cell's own tracks), solved on the graph of `graph` (the 3×3 neighbourhood's tracks; the
 * cell's own are added when missing). `height`: the riding surface (relief and decks).
 */
export function railLevels(ways: readonly RailWay[], graph: readonly RailWay[], height: HeightFn, box?: readonly [number, number, number, number], measured?: (x: number, y: number) => boolean, onDeck?: (x: number, y: number) => boolean, platforms: readonly RailPlatform[] = []): { levels: Map<RailWay, WayLevel>; stats: RailProfileStats } {
  const atPlatform = platformTest(stationHulls(platforms), PLATFORM_REACH_M), onPlatform = platformTest(platforms, PLATFORM_EDGE_M);
  // Only the graph inside `box` (the cell and PROFILE_PAD_M around it, where the relief is loaded whatever else is).
  const inBox = (p: Vec2) => !box || (p[0] >= box[0] && p[0] <= box[2] && p[1] >= box[1] && p[1] <= box[3]);
  const all = new Map<string, RailWay>();
  for (const w of [...ways, ...graph]) { const k = railWayKey(w); if (!all.has(k)) all.set(k, w); }
  // Nodes and edges.
  const id = new Map<string, number>(), pos: Vec2[] = [], h0: number[] = [], hc: number[] = [], under: boolean[] = [];
  // `bridge`: a deck edge (off the ground envelope), on a bridge way or beside a platform.
  const adj: { to: number; len: number; bridge: boolean; grade: number }[][] = [];
  // A node's relief is the highest land across the bed's top there (centre and both edges, across every way through it).
  const node = (p: Vec2, nx: number, ny: number): number => {
    const k = nodeKey(p);
    let i = id.get(k);
    if (i === undefined) { i = pos.length; id.set(k, i); pos.push(p); h0.push(height(p[0], p[1])); hc.push(-Infinity); adj.push([]); under.push(atPlatform(p[0], p[1])); }
    // AHN has a platform's top as ground: a sample on a platform is not land under the bed.
    for (const o of [BED_HALF_M, -BED_HALF_M]) { const x = p[0] + nx * o, y = p[1] + ny * o; if (!onPlatform(x, y)) hc[i] = Math.max(hc[i], height(x, y)); }
    return i;
  };
  const wayNodes = new Map<string, { nodes: number[]; s: number[]; p: Vec2[] }>(), onBridge: number[] = [];
  for (const [k, w] of all) {
    const st = stations(w.points, PROFILE_STEP_M), g = RAIL_GRADE[w.kind];
    const nodes = st.p.map((p, j) => {
      if (!inBox(p)) return -1;
      const a = st.p[Math.max(0, j - 1)], b = st.p[Math.min(st.p.length - 1, j + 1)], l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
      return node(p, -(b[1] - a[1]) / l, (b[0] - a[0]) / l);
    });
    for (let i = 0; i + 1 < nodes.length; i++) {
      const a = nodes[i], b = nodes[i + 1], len = st.s[i + 1] - st.s[i];
      if (a === b || a < 0 || b < 0) continue;
      // A deck edge: on a bridge, or beside a platform (levelled from the track past it).
      const deck = w.bridge || (under[a] && under[b]);
      if (w.bridge) { onBridge[a] = 1; onBridge[b] = 1; }
      adj[a].push({ to: b, len, bridge: deck, grade: g }); adj[b].push({ to: a, len, bridge: deck, grade: g });
    }
    wayNodes.set(k, { nodes, s: st.s, p: st.p });
  }
  // A bridge way's dead end within SNAP_M of a track off the bridges meets it (OSM leaves 2-3 m gaps where a bridge way
  // was split from its approach: two tram decks at Osdorp drew unanchored, lane rail-look round 3).
  const grid = new Map<string, number[]>(), gk = (x: number, y: number) => `${Math.floor(x / SNAP_M)},${Math.floor(y / SNAP_M)}`;
  for (let i = 0; i < pos.length; i++) if (adj[i].some(e => !e.bridge)) { const k = gk(pos[i][0], pos[i][1]); (grid.get(k) ?? grid.set(k, []).get(k)!).push(i); }
  let snapped = 0;
  for (let i = 0; i < pos.length; i++) {
    if (adj[i].length !== 1 || !adj[i][0].bridge) continue;
    const [x, y] = pos[i], cx = Math.floor(x / SNAP_M), cy = Math.floor(y / SNAP_M);
    let best = -1, bd = SNAP_M;
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (const j of grid.get(`${cx + dx},${cy + dy}`) ?? []) { const d = Math.hypot(pos[j][0] - x, pos[j][1] - y); if (d < bd && j !== i) { bd = d; best = j; } }
    if (best < 0) continue;
    const g = adj[i][0].grade;
    adj[i].push({ to: best, len: Math.max(bd, 0.1), bridge: false, grade: g }); adj[best].push({ to: i, len: Math.max(bd, 0.1), bridge: false, grade: g });
    snapped++;
  }
  const N = pos.length, onGround = adj.map(es => es.some(e => !e.bridge)), z = new Float64Array(N).fill(NaN);
  // Envelope over the tracks off the bridges: z(n) = max(relief(n), z(m) − grade · len) along ground edges.
  // A point whose floor is measured (a tunnel cut's ramp, tunnels.ts) keeps it: the envelope never lifts it.
  // So does a track's dead end (one edge): where rail-v1 dropped a tunnel the way ends at the portal, at the trench's floor.
  const fixed = pos.map((p, i) => adj[i].length === 1 || !!measured?.(p[0], p[1]));
  // Elsewhere a point's relief is the highest land across the bed (in a trench the land beside it is not under it).
  // Beside a platform the land across the bed is the platform's top (where AHN has it): the centre's relief only.
  for (let i = 0; i < N; i++) if (!fixed[i] && !(under[i] && !onBridge[i])) h0[i] = Math.max(h0[i], hc[i]);
  const env = new Float64Array(N).fill(-Infinity), heap = new Heap();
  for (let i = 0; i < N; i++) if (onGround[i]) { env[i] = h0[i]; heap.push(h0[i], i); }
  let maxLift = 0;
  while (heap.size) {
    const [v, i] = heap.pop();
    if (v < env[i]) continue;
    for (const e of adj[i]) {
      if (e.bridge || !onGround[e.to] || fixed[e.to]) continue;
      const c = v - e.grade * e.len;
      if (c > env[e.to] && h0[e.to] + ENVELOPE_REACH_M * e.grade > c) { env[e.to] = c; heap.push(c, e.to); }
    }
  }
  for (let i = 0; i < N; i++) if (onGround[i]) { z[i] = env[i]; maxLift = Math.max(maxLift, env[i] - h0[i]); }
  // Deck components: bridge ways and the track beside a platform, meeting each other. A component's level at its
  // boundary points (where a track off the decks meets it) is that track's level; inside, the deck runs between them.
  const comp = new Int32Array(N).fill(-1);
  let components = 0, anchored = 0, plain = 0, endAnchored = 0, onDeckComps = 0;
  const plainNodes = new Set<number>();
  // Inverse path distance from the anchors, then relaxed to the harmonic level (each free point the length-weighted mean
  // of its neighbours, never under its relief; over-relaxed Gauss-Seidel): linear along a chain between two anchors,
  // and no cusp at each anchor where a station's many anchors disagree (inverse distance alone put a 0.2 slope on the
  // Oostertoegang decks next to Centraal's platforms).
  const solve = (members: number[], anchors: number[]) => {
    const local = new Map(members.map((m, j) => [m, j])), isAnchor = new Set(anchors);
    const wsum = new Float64Array(members.length), zsum = new Float64Array(members.length);
    for (const a of anchors) {
      const d = new Float64Array(members.length).fill(Infinity), dh = new Heap();
      d[local.get(a)!] = 0; dh.push(0, a);
      while (dh.size) {
        const [nv, i] = dh.pop(), di = -nv;
        if (di > d[local.get(i)!]) continue;
        for (const e of adj[i]) {
          if (!e.bridge) continue;
          const j = local.get(e.to)!, nd = di + e.len;
          if (nd < d[j]) { d[j] = nd; dh.push(-nd, e.to); }
        }
      }
      for (let j = 0; j < members.length; j++) if (d[j] < Infinity) { const w = 1 / Math.max(d[j], 1e-3); wsum[j] += w; zsum[j] += w * z[a]; }
    }
    const free = members.filter(i => !isAnchor.has(i));
    for (const i of free) { const j = local.get(i)!; z[i] = Math.max(h0[i], wsum[j] > 0 ? zsum[j] / wsum[j] : h0[i]); }
    for (let it = 0; it < HARMONIC_ITERATIONS; it++) {
      let change = 0;
      for (const i of free) {
        let ws = 0, zs = 0;
        for (const e of adj[i]) if (e.bridge) { const w = 1 / Math.max(e.len, 0.1); ws += w; zs += w * z[e.to]; }
        if (!ws) continue;
        const next = Math.max(h0[i], z[i] + HARMONIC_OMEGA * (zs / ws - z[i]));
        change = Math.max(change, Math.abs(next - z[i]));
        z[i] = next;
      }
      if (change < 1e-3) break;
    }
  };
  for (let s0 = 0; s0 < N; s0++) {
    if (comp[s0] >= 0 || !adj[s0].some(e => e.bridge)) continue;
    const members: number[] = [], c = components++;
    comp[s0] = c;
    for (let q = [s0]; q.length;) {
      const i = q.pop()!; members.push(i);
      for (const e of adj[i]) if (e.bridge && comp[e.to] < 0) { comp[e.to] = c; q.push(e.to); }
    }
    let anchors = members.filter(i => onGround[i]);
    if (!anchors.length) {
      if (members.every(i => under[i] && !onBridge[i])) { for (const i of members) z[i] = h0[i]; continue; }
      // No track meets it (a tram whose approaches run embedded in the street, which rail-v1 leaves out). On a measured
      // road deck it rides that deck (the road kit draws the bridge); elsewhere it spans between the relief (AHN) at its
      // own dead ends, the deck-end heights, on its slab. With neither it is drawn plainly on the relief.
      const ends = members.filter(i => adj[i].length === 1);
      if (members.filter(i => onDeck?.(pos[i][0], pos[i][1])).length * 2 > members.length || !ends.length) { plain++; for (const i of members) { z[i] = h0[i]; plainNodes.add(i); } if (ends.length) onDeckComps++; continue; }
      for (const i of ends) z[i] = h0[i];
      anchors = ends;
      endAnchored++;
    } else anchored++;
    solve(members, anchors);
  }
  const liftAt = () => { let m = 0, at: Vec2 | undefined; for (let i = 0; i < N; i++) if (under[i] && !onBridge[i] && !Number.isNaN(z[i]) && z[i] - h0[i] > m) { m = z[i] - h0[i]; at = pos[i]; } return at ? { platformLiftAt: at } : {}; };
  const levels = new Map<RailWay, WayLevel>();
  for (const w of ways) {
    const wn = wayNodes.get(railWayKey(w));
    if (!wn) continue;
    const zz = wn.nodes.map((i, j) => (i < 0 ? height(wn.p[j][0], wn.p[j][1]) : Number.isNaN(z[i]) ? h0[i] : z[i]));
    levels.set(w, { s: wn.s, z: zz, ...(w.bridge && wn.nodes.some(i => plainNodes.has(i)) ? { plain: true } : {}) });
  }
  return { levels, stats: { ...liftAt(), nodes: N, snapped, components, anchored, plain, endAnchored, onDeck: onDeckComps, platformNodes: under.filter(Boolean).length, platformLift: +under.reduce((m, u, i) => (u && !onBridge[i] && !Number.isNaN(z[i]) ? Math.max(m, z[i] - h0[i]) : m), 0).toFixed(2), maxLift: +maxLift.toFixed(2) } };
}

/**
 * A station's platforms within STATION_GAP_M of each other, as one hull: the track field between them, with the
 * crossovers between a platform's a and b halves (Centraal's 5a/5b), stands at the platforms' level too.
 */
export function stationHulls(platforms: readonly RailPlatform[]): RailPlatform[] {
  const box = platforms.map(p => { let a = Infinity, b = Infinity, c = -Infinity, d = -Infinity; for (const [x, y] of p.ring) { a = Math.min(a, x); b = Math.min(b, y); c = Math.max(c, x); d = Math.max(d, y); } return [a, b, c, d]; });
  const parent = platforms.map((_, i) => i), find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  const near = (i: number, j: number) => !(box[i][2] + STATION_GAP_M < box[j][0] || box[j][2] + STATION_GAP_M < box[i][0] || box[i][3] + STATION_GAP_M < box[j][1] || box[j][3] + STATION_GAP_M < box[i][1])
    && platforms[i].ring.some(p => platforms[j].ring.some(q => Math.hypot(p[0] - q[0], p[1] - q[1]) < STATION_GAP_M) || ringDist(platforms[j].ring, p) < STATION_GAP_M);
  for (let i = 0; i < platforms.length; i++) for (let j = i + 1; j < platforms.length; j++) if (find(i) !== find(j) && near(i, j)) parent[find(i)] = find(j);
  const groups = new Map<number, Vec2[]>();
  platforms.forEach((p, i) => { const g = groups.get(find(i)) ?? groups.set(find(i), []).get(find(i))!; g.push(...p.ring); });
  return [...groups.values()].map(pts => ({ ring: hull(pts) }));
}

/** Platforms closer than this join one station hull, metres (Centraal's widest gap between platform halves is ~25 m). */
export const STATION_GAP_M = 40;

function ringDist(r: readonly Vec2[], [x, y]: Vec2): number {
  let best = Infinity;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const [xi, yi] = r[i], [xj, yj] = r[j], dx = xi - xj, dy = yi - yj, l2 = dx * dx + dy * dy, t = l2 > 0 ? Math.max(0, Math.min(1, ((x - xj) * dx + (y - yj) * dy) / l2)) : 0;
    best = Math.min(best, Math.hypot(xj + dx * t - x, yj + dy * t - y));
  }
  return best;
}

/** Convex hull (monotone chain), counter-clockwise. */
function hull(pts: Vec2[]): Vec2[] {
  const p = [...pts].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (p.length < 3) return p;
  const cross = (o: Vec2, a: Vec2, b: Vec2) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo: Vec2[] = [], up: Vec2[] = [];
  for (const q of p) { while (lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
  for (let i = p.length - 1; i >= 0; i--) { const q = p[i]; while (up.length >= 2 && cross(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); }
  return lo.slice(0, -1).concat(up.slice(0, -1));
}

/** Is (x, y) over a platform or within `reach` of its outline? */
export function platformTest(platforms: readonly RailPlatform[], reach: number): (x: number, y: number) => boolean {
  if (!platforms.length) return () => false;
  const boxes = platforms.map(p => { let a = Infinity, b = Infinity, c = -Infinity, d = -Infinity; for (const [x, y] of p.ring) { a = Math.min(a, x); b = Math.min(b, y); c = Math.max(c, x); d = Math.max(d, y); } return [a - reach, b - reach, c + reach, d + reach]; });
  return (x, y) => platforms.some((p, k) => {
    const bb = boxes[k];
    if (x < bb[0] || x > bb[2] || y < bb[1] || y > bb[3]) return false;
    const r = p.ring;
    let inside = false;
    for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
      const [xi, yi] = r[i], [xj, yj] = r[j];
      if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
      const dx = xi - xj, dy = yi - yj, l2 = dx * dx + dy * dy, t = l2 > 0 ? Math.max(0, Math.min(1, ((x - xj) * dx + (y - yj) * dy) / l2)) : 0;
      if (Math.hypot(xj + dx * t - x, yj + dy * t - y) <= reach) return true;
    }
    return inside;
  });
}

/** The level at distance `s` along a way (linear between its stations). */
export function levelAt(l: WayLevel, s: number): number {
  const S = l.s;
  if (s <= S[0]) return l.z[0];
  if (s >= S[S.length - 1]) return l.z[S.length - 1];
  let lo = 0, hi = S.length - 1;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (S[m] <= s) lo = m; else hi = m; }
  const t = (s - S[lo]) / (S[hi] - S[lo] || 1);
  return l.z[lo] + (l.z[hi] - l.z[lo]) * t;
}
