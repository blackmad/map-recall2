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
//   at grade A component no approach meets (the data cannot place it) is drawn plainly on the relief, without
//            its slab, and listed in the stats (`plain`).
//
// The cell keeps the levels of its own ways; every cell solves the same 3×3 graph near its tracks, so the levels
// agree across a seam.

import type { HeightFn, Vec2 } from './surface.js';
import type { RailKind, RailWay } from './railTracks.js';

/**
 * Steepest grade per kind (rise over run), a little over practice so a measured ramp (a tunnel cut's floor) is never
 * lifted: main lines 2.5 % in ProRail practice (3 % here), metro 4 % (5 %), tram 6-7 % (8 %).
 */
export const RAIL_GRADE: Record<RailKind, number> = { rail: 0.03, narrow_gauge: 0.04, light_rail: 0.06, subway: 0.05, tram: 0.08 };
/** Graph spacing along a way, metres: the envelope and the deck lines are solved on these points. */
export const PROFILE_STEP_M = 4;
/** Half the bed's top (railTracks RAIL_SECTION.topHalf): the land across it sets a node's relief. */
export const BED_HALF_M = 1.55;
/** The graph reaches this far past the cell, metres (inside groundStore CELL_RELIEF_PAD_M, 350 m). */
export const PROFILE_PAD_M = 300;
/** The envelope lifts a track at most its grade over this many metres (12 m for a main line). */
export const ENVELOPE_REACH_M = 400;

/** A way's level along it: bed floor `z` (scene metres) at distances `s` from its first point. */
export interface WayLevel { s: number[]; z: number[]; /** A bridge way the data cannot place: drawn on the relief without its slab. */ plain?: boolean }
export interface RailProfileStats { nodes: number; components: number; anchored: number; plain: number; /** Largest lift of the bed over the relief by the envelope, metres. */ maxLift: number }

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
export function railLevels(ways: readonly RailWay[], graph: readonly RailWay[], height: HeightFn, box?: readonly [number, number, number, number], measured?: (x: number, y: number) => boolean): { levels: Map<RailWay, WayLevel>; stats: RailProfileStats } {
  // Only the graph inside `box` (the cell and PROFILE_PAD_M around it, where the relief is loaded whatever else is).
  const inBox = (p: Vec2) => !box || (p[0] >= box[0] && p[0] <= box[2] && p[1] >= box[1] && p[1] <= box[3]);
  const all = new Map<string, RailWay>();
  for (const w of [...ways, ...graph]) { const k = railWayKey(w); if (!all.has(k)) all.set(k, w); }
  // Nodes and edges.
  const id = new Map<string, number>(), pos: Vec2[] = [], h0: number[] = [], hc: number[] = [];
  const adj: { to: number; len: number; bridge: boolean; grade: number }[][] = [];
  // A node's relief is the highest land across the bed's top there (centre and both edges, across every way through it).
  const node = (p: Vec2, nx: number, ny: number): number => {
    const k = nodeKey(p);
    let i = id.get(k);
    if (i === undefined) { i = pos.length; id.set(k, i); pos.push(p); h0.push(height(p[0], p[1])); hc.push(-Infinity); adj.push([]); }
    hc[i] = Math.max(hc[i], height(p[0] + nx * BED_HALF_M, p[1] + ny * BED_HALF_M), height(p[0] - nx * BED_HALF_M, p[1] - ny * BED_HALF_M));
    return i;
  };
  const wayNodes = new Map<string, { nodes: number[]; s: number[]; p: Vec2[] }>();
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
      adj[a].push({ to: b, len, bridge: w.bridge, grade: g }); adj[b].push({ to: a, len, bridge: w.bridge, grade: g });
    }
    wayNodes.set(k, { nodes, s: st.s, p: st.p });
  }
  const N = pos.length, onGround = adj.map(es => es.some(e => !e.bridge)), z = new Float64Array(N).fill(NaN);
  // Envelope over the tracks off the bridges: z(n) = max(relief(n), z(m) − grade · len) along ground edges.
  // A point whose floor is measured (a tunnel cut's ramp, tunnels.ts) keeps it: the envelope never lifts it.
  // So does a track's dead end (one edge): where rail-v1 dropped a tunnel the way ends at the portal, at the trench's floor.
  const fixed = pos.map((p, i) => adj[i].length === 1 || !!measured?.(p[0], p[1]));
  // Elsewhere a point's relief is the highest land across the bed (in a trench the land beside it is not under it).
  for (let i = 0; i < N; i++) if (!fixed[i]) h0[i] = Math.max(h0[i], hc[i]);
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
  // Bridge components: their deck between the levels of the approaches that meet them.
  const comp = new Int32Array(N).fill(-1);
  let components = 0, anchored = 0, plain = 0;
  const plainNodes = new Set<number>();
  for (let s0 = 0; s0 < N; s0++) {
    if (comp[s0] >= 0 || !adj[s0].some(e => e.bridge)) continue;
    const members: number[] = [], c = components++;
    comp[s0] = c;
    for (let q = [s0]; q.length;) {
      const i = q.pop()!; members.push(i);
      for (const e of adj[i]) if (e.bridge && comp[e.to] < 0) { comp[e.to] = c; q.push(e.to); }
    }
    const anchors = members.filter(i => onGround[i]);
    if (!anchors.length) { plain++; for (const i of members) { z[i] = h0[i]; plainNodes.add(i); } continue; }
    anchored++;
    // Path distance (along bridge edges) from each anchor; the level is the inverse-distance mean of the anchors' levels.
    const local = new Map(members.map((m, j) => [m, j]));
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
    for (let j = 0; j < members.length; j++) {
      const i = members[j];
      if (onGround[i]) continue;
      z[i] = Math.max(h0[i], wsum[j] > 0 ? zsum[j] / wsum[j] : h0[i]);
    }
  }
  const levels = new Map<RailWay, WayLevel>();
  for (const w of ways) {
    const wn = wayNodes.get(railWayKey(w));
    if (!wn) continue;
    const zz = wn.nodes.map((i, j) => (i < 0 ? height(wn.p[j][0], wn.p[j][1]) : Number.isNaN(z[i]) ? h0[i] : z[i]));
    levels.set(w, { s: wn.s, z: zz, ...(w.bridge && wn.nodes.some(i => plainNodes.has(i)) ? { plain: true } : {}) });
  }
  return { levels, stats: { nodes: N, components, anchored, plain, maxLift: +maxLift.toFixed(2) } };
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
