// Decks for OSM bridge ways the elevation extract does not carry (user 2026-10-16, "bridge missing entirely here":
// the Jan Evertsenstraat over the Erasmusgracht beside the Erasmuspark, OSM way 323258135). The extract's bridges come
// from the municipal outlines (measured profiles and flat footprints); where neither covers a bridge way, the way's
// bands draped on the relief, which runs down to the canal bed between the quays, and sank under the water: the
// street stopped at the quay wall and resumed on the far bank. Pure, DOM-free.
//
// A bridge way that crosses at least WAY_DECK_MIN_WATER_M of water, away from every measured deck and flat footprint,
// becomes a measured-deck profile on its own centreline: stations every WAY_DECK_STEP_M, a flat crown (h 0, so
// GroundSurface.addDeck lays the deck on the chord between the approach ends: a flush street bridge), the deck span the
// water run plus ABUTMENT_M onto each bank, the approaches reaching APPROACH_M past it (extended straight where the
// way ends over the water). The surface, the street bands, the kit (girder or footbridge by width), the deck top and
// the water mask then treat it as any measured deck.

import type { DeckProfile } from '../elevation/bridgeDeck.js';
import type { Vec2 } from './surface.js';
import type { OpeningDeck } from './water.js';

export const WAY_DECK_STEP_M = 0.5, WAY_DECK_MIN_WATER_M = 2, ABUTMENT_M = 1, APPROACH_M = 6;
/** A wet station this close to a measured deck or a flat footprint belongs to that bridge (no second deck beside it). */
export const WAY_DECK_CLEAR_M = 4;
/** The water run's chord over its length at least this (a crossing, not a path along or round the water). */
export const WAY_DECK_STRAIGHT = 0.85;

/**
 * A hole in the relief at a way deck's end (user 2026-10-16, the Jan Evertsenstraat over the Erasmusgracht: the bridge
 * spans the canal and the Rembrandtpark underpass beside it, OSM path 122525654, with stair wells beyond; the elevation
 * model is interpolated under the whole structure, 1.9 m under the west bank for 25 m past the water). Where the relief
 * at one approach lies more than HOLE_M under the other bank's and climbs back within HOLE_MAX_M along the way, the deck
 * runs on to where it does: the street stays on its deck over the underpass instead of sloping down into it. A slope
 * that never comes back (a dike down to a polder) keeps the deck as it was, and so does a way that ends within
 * HOLE_MIN_M of the water or a bank that is not low HOLE_MIN_M past it (the hole lies under the bridge way itself). Its station ranges past the water are the
 * profile's `under`: the edge has a drop outside it, so the parapet runs on over them.
 */
export const HOLE_M = 0.6, HOLE_MAX_M = 30, HOLE_MIN_M = 3;

/** Highway kinds that get a deck (not steps, not a platform or proposed way). */
export const wayDeckHighway = (h: string | undefined): boolean => !!h && !/^(steps|platform|proposed|construction|corridor|elevator)$/.test(h);

/**
 * The profile for one bridge way, or null when it crosses less than WAY_DECK_MIN_WATER_M of water or any wet station
 * is `claimed` (another bridge is there). `points` in scene metres, `halfWidth` the way's drawn half-width.
 */
/** Audits only: why a bridge way got no deck (probe-way-decks --why). */
export const wayDeckWhy: { fn: ((id: string, reason: string) => void) | null } = { fn: null };

export function wayDeckProfile(id: string, name: string, points: readonly Vec2[], halfWidth: number, wet: (x: number, y: number) => boolean, claimed: (x: number, y: number) => boolean, ground?: (x: number, y: number) => number, openEnds = false): DeckProfile | null {
  const no = (reason: string): null => { wayDeckWhy.fn?.(id, reason); return null; };
  if (points.length < 2) return no('fewer than 2 points');
  // A coarse pass first (every 2 m): most bridge ways in a cell cross no water the extract leaves undecked.
  let any = false;
  for (let i = 0; i + 1 < points.length && !any; i++) {
    const [ax, ay] = points[i], [bx, by] = points[i + 1], n = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / 2));
    for (let j = 0; j <= n && !any; j++) any = wet(ax + (bx - ax) * j / n, ay + (by - ay) * j / n);
  }
  if (!any) return no('no water on the coarse pass');
  // Resample the polyline every WAY_DECK_STEP_M.
  const pts: Vec2[] = [];
  for (let i = 0; i + 1 < points.length; i++) {
    const [ax, ay] = points[i], [bx, by] = points[i + 1], l = Math.hypot(bx - ax, by - ay), n = Math.max(1, Math.ceil(l / WAY_DECK_STEP_M));
    for (let j = i === 0 ? 0 : 1; j <= n; j++) pts.push([ax + (bx - ax) * j / n, ay + (by - ay) * j / n]);
  }
  // Extend straight past an end still over the water (the way stops on the quay line, or short of it).
  const extend = (end: 0 | 1) => {
    const a = end === 0 ? pts[1] : pts[pts.length - 2], b = end === 0 ? pts[0] : pts[pts.length - 1];
    const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, u: Vec2 = [(b[0] - a[0]) / l, (b[1] - a[1]) / l], out: Vec2[] = [];
    for (let d = WAY_DECK_STEP_M; d <= APPROACH_M + 1e-6; d += WAY_DECK_STEP_M) out.push([b[0] + u[0] * d, b[1] + u[1] * d]);
    return out;
  };
  const APPROACH_STATIONS = extend(0).length;
  let all = [...extend(0).reverse(), ...pts, ...extend(1)];
  const wetAt = all.map(p => wet(p[0], p[1]));
  let first = wetAt.indexOf(true), last = wetAt.lastIndexOf(true);
  if (first < 0) return no('no water');
  // The water run: first to last wet station (a pier or island between counts as the span).
  if ((last - first) * WAY_DECK_STEP_M < WAY_DECK_MIN_WATER_M) return no(`water run ${((last - first) * WAY_DECK_STEP_M).toFixed(1)} m`);
  // Both ends must reach land within the approaches (a way along a quay or a pontoon is not a crossing).
  // `openEnds` (dryWayDeck): a structure over land may run on past the way (a bus station deck's busways).
  if (!openEnds && (wetAt[0] || wetAt[all.length - 1])) return no(`an end over water (${+wetAt[0]}, ${+wetAt[all.length - 1]})`);
  // A crossing runs straight over the water: a boardwalk curving round a pond (the Westerpark ring, OSM 47460645) is not one.
  if (Math.hypot(all[last][0] - all[first][0], all[last][1] - all[first][1]) < WAY_DECK_STRAIGHT * (last - first) * WAY_DECK_STEP_M) return no('not straight over the water');
  for (let k = first; k <= last; k++) if (claimed(all[k][0], all[k][1])) return no(`claimed at station ${k - first} of ${last - first}`);
  // A hole in the relief past either end of the water (HOLE_M): the deck runs on to the bank beyond it.
  const reach = Math.round((ABUTMENT_M + APPROACH_M) / WAY_DECK_STEP_M), maxK = Math.round(HOLE_MAX_M / WAY_DECK_STEP_M);
  let lo = first, hi = last;
  if (ground) {
    const step = (from: Vec2, back: Vec2, k: number): Vec2 => { const l = Math.hypot(from[0] - back[0], from[1] - back[1]) || 1; return [from[0] + (from[0] - back[0]) / l * k * WAY_DECK_STEP_M, from[1] + (from[1] - back[1]) / l * k * WAY_DECK_STEP_M]; };
    // Station k of the line, extended straight past either end.
    const at = (k: number): Vec2 => (k < 0 ? step(all[0], all[1], -k) : k >= all.length ? step(all[all.length - 1], all[all.length - 2], k - all.length + 1) : all[k]);
    const g0 = ground(...at(first - reach)), g1 = ground(...at(last + reach));
    const bank = (from: number, dir: 1 | -1, level: number): number | null => {
      for (let j = 1; j <= maxK; j++) if (ground(...at(from + dir * j)) >= level - HOLE_M) return from + dir * j;
      return null;
    };
    // The bridge way itself runs on over the hole: at least HOLE_MIN_M past the water, low there (not a bank sloping
    // away from a quay at the water's edge).
    const w0 = APPROACH_STATIONS, w1 = APPROACH_STATIONS + pts.length - 1, m = Math.round(HOLE_MIN_M / WAY_DECK_STEP_M);
    const holeAt = (k: number, level: number) => ground(...at(k)) < level - HOLE_M;
    const e1 = g1 < g0 - HOLE_M && w1 >= last + m && holeAt(last + m, g0) ? bank(last + m, 1, g0) : null;
    const e0 = g0 < g1 - HOLE_M && w0 <= first - m && holeAt(first - m, g1) ? bank(first - m, -1, g1) : null;
    let claimedHole = false;
    for (let k = e0 ?? first; k <= (e1 ?? last) && !claimedHole; k++) if ((k < first || k > last) && claimed(...at(k))) claimedHole = true;
    if (!claimedHole && (e0 !== null || e1 !== null)) {
      // Rebuild the line with room for the approaches past the hole.
      const k0 = Math.min(0, (e0 ?? first) - reach), k1 = Math.max(all.length - 1, (e1 ?? last) + reach), line: Vec2[] = [];
      for (let k = k0; k <= k1; k++) line.push(at(k));
      all = line; first -= k0; last -= k0;
      lo = e0 !== null ? e0 - k0 - Math.round(ABUTMENT_M / WAY_DECK_STEP_M) : first; hi = e1 !== null ? e1 - k0 + Math.round(ABUTMENT_M / WAY_DECK_STEP_M) : last;
    }
  }
  // Approaches: APPROACH_M past the abutments (or the underpass) on each side.
  const k0 = Math.max(0, Math.min(first, lo) - reach), k1 = Math.min(all.length - 1, Math.max(last, hi) + reach);
  const runs: [number, number][] = [...(lo < first ? [[lo, first] as [number, number]] : []), ...(hi > last ? [[last, hi] as [number, number]] : [])];
  all = all.slice(k0, k1 + 1);
  const n = all.length, x = new Float64Array(n), y = new Float64Array(n), s = new Float64Array(n), h = new Float64Array(n), hw = new Float64Array(n);
  let bx0 = Infinity, by0 = Infinity, bx1 = -Infinity, by1 = -Infinity;
  for (let i = 0; i < n; i++) {
    x[i] = all[i][0]; y[i] = all[i][1]; s[i] = i === 0 ? 0 : s[i - 1] + Math.hypot(x[i] - x[i - 1], y[i] - y[i - 1]); hw[i] = halfWidth;
    bx0 = Math.min(bx0, x[i] - halfWidth); by0 = Math.min(by0, y[i] - halfWidth); bx1 = Math.max(bx1, x[i] + halfWidth); by1 = Math.max(by1, y[i] + halfWidth);
  }
  const w0 = s[first - k0], w1 = s[last - k0], u0 = lo < first ? s[lo - k0] : Infinity, u1 = hi > last ? s[hi - k0] : -Infinity;
  return {
    id, name, family: 'way-deck', x, y, s, h, halfWidth: hw, water: [w0, w1],
    deck: [Math.max(0, Math.min(w0 - ABUTMENT_M, u0)), Math.min(s[n - 1], Math.max(w1 + ABUTMENT_M, u1))], bbox: [bx0, by0, bx1, by1],
    ...(runs.length ? { under: runs.map(([a, b]): [number, number] => [s[a - k0], s[b - k0]]) } : {}),
  };
}

/** One bridge way for wayDeckGroups: id, name, centreline, drawn half-width. */
export interface WayDeckInput { id: number; name: string; points: Vec2[]; halfWidth: number }

/**
 * A bridge mapped as consecutive ways (the Satellietbaan over the Gaasp, OSM 24343390 + 1252138995; the Zuiderzeeweg's
 * pieces): each piece alone ends over the water and gets no deck (both ends must reach land). Pieces that meet end to
 * end (within CHAIN_JOIN_M) and run on within CHAIN_TURN of straight join into one line, the first piece's id and name,
 * the widest half-width. Returns the joined ways and, per joined way, the ids it took in.
 */
export const CHAIN_JOIN_M = 1, CHAIN_TURN = Math.cos(Math.PI / 6);
export function joinChains(ways: readonly WayDeckInput[]): { ways: WayDeckInput[]; members: Map<number, number[]> } {
  const out = ways.map(w => ({ ...w, points: [...w.points] })), members = new Map(out.map(w => [w.id, [w.id]]));
  const dir = (a: Vec2, b: Vec2): Vec2 => { const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1; return [(b[0] - a[0]) / l, (b[1] - a[1]) / l]; };
  for (let joined = true; joined;) {
    joined = false;
    outer: for (let i = 0; i < out.length; i++) for (let j = 0; j < out.length; j++) {
      if (i === j) continue;
      const a = out[i].points, b = out[j].points;
      // a's end meets b's start or end: b (reversed if needed) continues a.
      for (const rev of [false, true]) {
        const bb = rev ? [...b].reverse() : b, e = a[a.length - 1], s0 = bb[0];
        if (Math.hypot(e[0] - s0[0], e[1] - s0[1]) > CHAIN_JOIN_M) continue;
        const u = dir(a[a.length - 2], e), v = dir(s0, bb[1]);
        if (u[0] * v[0] + u[1] * v[1] < CHAIN_TURN) continue;
        out[i] = { ...out[i], name: out[i].name || out[j].name, points: [...a, ...bb.slice(1)], halfWidth: Math.max(out[i].halfWidth, out[j].halfWidth) };
        members.set(out[i].id, [...members.get(out[i].id)!, ...members.get(out[j].id)!]);
        members.delete(out[j].id);
        out.splice(j, 1);
        joined = true;
        break outer;
      }
    }
  }
  return { ways: out, members };
}

/** The polyline shifted `d` metres to its left (each point along the mean normal of its segments). */
export function offsetLine(points: readonly Vec2[], d: number): Vec2[] {
  return points.map((p, i) => {
    const a = points[Math.max(0, i - 1)], b = points[Math.min(points.length - 1, i + 1)], l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    return [p[0] - (b[1] - a[1]) / l * d, p[1] + (b[0] - a[0]) / l * d] as Vec2;
  });
}

/**
 * One deck per crossing (the Jan Evertsenstraat: a carriageway and two cycle paths mapped as three parallel bridge
 * ways): ways whose water runs lie within WAY_DECK_GROUP_M of each other and run within ~37° of parallel share one deck
 * on the widest way's centreline, shifted and widened to cover all of them (a deck per way drew parapets between the
 * carriageway and its cycle paths, and water between them). Returns the profiles and every way id they cover.
 */
export const WAY_DECK_GROUP_M = 25;
export function wayDeckGroups(ways: readonly WayDeckInput[], wet: (x: number, y: number) => boolean, claimed: (x: number, y: number) => boolean, ground?: (x: number, y: number) => number): { profiles: DeckProfile[]; covered: number[] } {
  return groupWayDecks(ways.map(w => wayDeckCrossing(w, wet, claimed, ground)), wet, ground);
}

/** One way's deck profile for wayDeckGroups (null: it crosses no water, or a measured deck carries it). */
export function wayDeckCrossing(w: WayDeckInput, wet: (x: number, y: number) => boolean, claimed: (x: number, y: number) => boolean, ground?: (x: number, y: number) => number): { w: WayDeckInput; p: DeckProfile | null } {
  return { w, p: wayDeckProfile(`OSM${w.id}`, w.name, w.points, w.halfWidth, wet, claimed, ground) };
}

/**
 * wayDeckGroups from the ways' profiles (wayDeckCrossing, in the ways' order): the page makes them one task each
 * (groundStore placeWayDecks, #129) and groups them here.
 */
export function groupWayDecks(crossings: readonly { w: WayDeckInput; p: DeckProfile | null }[], wet: (x: number, y: number) => boolean, ground?: (x: number, y: number) => number): { profiles: DeckProfile[]; covered: number[] } {
  const crossing = crossings.filter(c => !!c.p) as { w: WayDeckInput; p: DeckProfile }[];
  const mid = (p: DeckProfile): Vec2 => { const s = (p.water![0] + p.water![1]) / 2; const i = Math.max(0, p.s.findIndex(v => v >= s)); return [p.x[i], p.y[i]]; };
  const dir = (p: DeckProfile): Vec2 => { const n = p.x.length - 1, l = Math.hypot(p.x[n] - p.x[0], p.y[n] - p.y[0]) || 1; return [(p.x[n] - p.x[0]) / l, (p.y[n] - p.y[0]) / l]; };
  const used = new Set<number>(), profiles: DeckProfile[] = [], covered: number[] = [];
  // Widest first: it carries the group.
  const order = [...crossing].sort((a, b) => b.w.halfWidth - a.w.halfWidth);
  for (const main of order) {
    if (used.has(main.w.id)) continue;
    const m = mid(main.p), u = dir(main.p), nrm: Vec2 = [-u[1], u[0]];
    let left = main.w.halfWidth, right = main.w.halfWidth;
    for (const o of order) {
      if (used.has(o.w.id) || o === main) continue;
      const c = mid(o.p), v = dir(o.p);
      if (Math.hypot(c[0] - m[0], c[1] - m[1]) > WAY_DECK_GROUP_M || Math.abs(u[0] * v[0] + u[1] * v[1]) < 0.8) continue;
      const lat = (c[0] - m[0]) * nrm[0] + (c[1] - m[1]) * nrm[1];
      left = Math.max(left, lat + o.w.halfWidth); right = Math.max(right, -lat + o.w.halfWidth);
      used.add(o.w.id); covered.push(o.w.id);
    }
    used.add(main.w.id); covered.push(main.w.id);
    const shift = (left - right) / 2, half = (left + right) / 2;
    const p = shift === 0 && half === main.w.halfWidth ? main.p : wayDeckProfile(`OSM${main.w.id}`, main.w.name, offsetLine(main.w.points, shift), half, wet, () => false, ground) ?? main.p;
    profiles.push(p);
  }
  return { profiles, covered };
}


/**
 * A way deck's sides from the road surfaces it carries (coordinator 2026-10-16, the motorway viaducts OSM 7382983 and
 * 7041280: the PDOK orthophoto puts the railings at the outer edges of each carriageway, ours ran down the middle lanes
 * at the OSM way's drawn half-width, check:bridge-railings insideM; the Jan Evertsenstraat's ran along its cycle
 * paths, the railing stands past the footways). Over the deck span, each side walks out in ROAD_EDGE_STEP_M steps
 * through the roads-v1 polygons (`onRoad`) from the way's half-width when that lies on one, else from the road line
 * when that does (a tram bed or verge between them, without a polygon, ends the walk there), until it leaves them; the
 * side's width is the median of those edges over ROAD_EDGE_MIN_STATIONS stations at least, at most halfWidth +
 * ROAD_EDGE_REACH_MAX_M. `undefined` when no side lies more than ROAD_EDGE_WIDER_M past the half-width (no road
 * surfaces there, or the way's width already reaches their edge): the deck keeps its offset.
 */
export const ROAD_EDGE_STEP_M = 0.25, ROAD_EDGE_MIN_STATIONS = 3, ROAD_EDGE_REACH_MAX_M = 12, ROAD_EDGE_WIDER_M = 0.3;
export function roadEdgeSides(p: DeckProfile, onRoad: (x: number, y: number) => boolean): [number, number] | undefined {
  const edges: [number[], number[]] = [[], []];
  for (let i = 0; i < p.s.length; i++) {
    if (p.s[i] < p.deck[0] || p.s[i] > p.deck[1]) continue;
    const a = Math.max(0, i - 1), b = Math.min(p.s.length - 1, i + 1), dx = p.x[b] - p.x[a], dy = p.y[b] - p.y[a], l = Math.hypot(dx, dy) || 1, nx = -dy / l, ny = dx / l;
    const hw = p.halfWidth[i], max = hw + ROAD_EDGE_REACH_MAX_M;
    for (const side of [0, 1] as const) {
      const sg = side === 0 ? 1 : -1, on = (t: number) => onRoad(p.x[i] + nx * sg * t, p.y[i] + ny * sg * t);
      let t = on(hw) ? hw : on(0) ? 0 : -1;
      if (t < 0) continue;
      while (t + ROAD_EDGE_STEP_M <= max && on(t + ROAD_EDGE_STEP_M)) t += ROAD_EDGE_STEP_M;
      if (t + ROAD_EDGE_STEP_M <= max) edges[side].push(t + ROAD_EDGE_STEP_M / 2);
    }
  }
  const hw = Math.max(...p.halfWidth), med = (v: number[]) => { const s = [...v].sort((x, y) => x - y); return s[s.length >> 1]; };
  const sides = edges.map(v => (v.length >= ROAD_EDGE_MIN_STATIONS ? Math.max(hw, med(v)) : hw)) as [number, number];
  return sides.some(w => w > hw + ROAD_EDGE_WIDER_M) ? sides : undefined;
}

/**
 * Water under OSM bridge ways whose water polygon stops at the bridge (user 2026-10-31, "why missing road": the
 * Kinkerbrug, Postjesweg over the Kostverlorenvaart, OSM 743740428, and the Beltbrug, Jan van Galenstraat, OSM 27316608
 * + 467803028). The OpenFreeMap water ends at both deck edges and no register outline carries the bridge, so the way
 * crossed no water, got no way deck, and the survey's deck-level road polygons (h 1) had nothing to lie on: the
 * carriageway stopped at both abutments over a patch of bare land. The footbridge openings rule (water.ts
 * openUnderFootbridges) opens that strip for every bridge way no measured deck or flat footprint claims, with no width
 * cap (the OSM bridge tag, not the width, says it is a bridge and not a dam) and WAY_OPENING_REACH_M beside the edges;
 * the way deck then finds its water as on any other crossing.
 */
export const WAY_OPENING_REACH_M = 8;
/** Bridge ways side by side on one crossing join a bundle while the gap between their bands is at most this. */
export const BUNDLE_GAP_M = 8;
/** At most this far apart (midpoints) and within ~37° of parallel, as wayDeckGroups. */
export const BUNDLE_MID_M = WAY_DECK_GROUP_M;

/**
 * The bridge ways of one crossing as one line covering all of them (the Beltbrug: two carriageways and two cycle paths
 * mapped as four ways, each too narrow for the water beside the bridge's far edge to lie within reach). Ways within
 * BUNDLE_MID_M of each other, within ~37° of parallel and with at most BUNDLE_GAP_M between neighbouring bands join;
 * the line is the widest way's, shifted to the bundle's middle, with the bundle's half-width. A lone way is returned
 * as it is.
 */
export function bridgeWayBundles(ways: readonly WayDeckInput[]): WayDeckInput[] {
  const len = (pts: readonly Vec2[]) => pts.reduce((a, p, i) => (i ? a + Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]) : 0), 0);
  const mid = (pts: readonly Vec2[]): Vec2 => {
    const half = len(pts) / 2;
    for (let i = 1, a = 0; i < pts.length; i++) {
      const l = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
      if (a + l >= half) { const t = l ? (half - a) / l : 0; return [pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * t, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * t]; }
      a += l;
    }
    return pts[0] as Vec2;
  };
  const dir = (pts: readonly Vec2[]): Vec2 => { const n = pts.length - 1, l = Math.hypot(pts[n][0] - pts[0][0], pts[n][1] - pts[0][1]) || 1; return [(pts[n][0] - pts[0][0]) / l, (pts[n][1] - pts[0][1]) / l]; };
  const order = ways.filter(w => w.points.length >= 2).sort((a, b) => b.halfWidth - a.halfWidth || a.id - b.id);
  const used = new Set<number>(), out: WayDeckInput[] = [];
  for (const main of order) {
    if (used.has(main.id)) continue;
    used.add(main.id);
    const m = mid(main.points), u = dir(main.points), nrm: Vec2 = [-u[1], u[0]];
    // Candidates by their lateral offset; a band joins when it reaches within BUNDLE_GAP_M of the bundle's edge.
    const cands = order.filter(o => !used.has(o.id)).map(o => {
      const c = mid(o.points), v = dir(o.points);
      return { o, c, ok: Math.hypot(c[0] - m[0], c[1] - m[1]) <= BUNDLE_MID_M && Math.abs(u[0] * v[0] + u[1] * v[1]) >= 0.8, lat: (c[0] - m[0]) * nrm[0] + (c[1] - m[1]) * nrm[1] };
    }).filter(c => c.ok);
    let left = main.halfWidth, right = main.halfWidth, grew = true;
    while (grew) {
      grew = false;
      for (const c of cands) {
        if (used.has(c.o.id)) continue;
        const lo = c.lat - c.o.halfWidth, hi = c.lat + c.o.halfWidth;
        if (lo > left + BUNDLE_GAP_M || hi < -right - BUNDLE_GAP_M) continue;
        left = Math.max(left, hi); right = Math.max(right, -lo); used.add(c.o.id); grew = true;
      }
    }
    if (left === main.halfWidth && right === main.halfWidth) { out.push(main); continue; }
    out.push({ ...main, points: offsetLine(main.points, (left - right) / 2), halfWidth: (left + right) / 2 });
  }
  return out;
}

/**
 * The opening stops this far past the way's ends. OSM puts a bridge way's end nodes on the abutments, and along the
 * axis there is no water to stop at (the cut covers the whole crossing): run on further and a skewed crossing's quays
 * have water on both sides too (the Beltbrug opened 27 m of quay for a 12 m way, and its way deck then ended over water).
 */
export const WAY_OPENING_PAST_M = 0.5;

/**
 * One bridge way as the openings rule reads a deck (water.ts OpeningDeck): stations every WAY_DECK_STEP_M along it,
 * extended straight WAY_OPENING_PAST_M past each end, the whole line its span.
 */
export function wayOpeningDeck(w: WayDeckInput): OpeningDeck {
  const pts: Vec2[] = [];
  for (let i = 0; i + 1 < w.points.length; i++) {
    const [ax, ay] = w.points[i], [bx, by] = w.points[i + 1], n = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / WAY_DECK_STEP_M));
    for (let j = i === 0 ? 0 : 1; j <= n; j++) pts.push([ax + (bx - ax) * j / n, ay + (by - ay) * j / n]);
  }
  const ext = (b: Vec2, a: Vec2): Vec2[] => {
    const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, out: Vec2[] = [];
    for (let d = WAY_DECK_STEP_M; d <= WAY_OPENING_PAST_M + 1e-6; d += WAY_DECK_STEP_M) out.push([b[0] + (b[0] - a[0]) / l * d, b[1] + (b[1] - a[1]) / l * d]);
    return out;
  };
  const all = pts.length >= 2 ? [...ext(pts[0], pts[1]).reverse(), ...pts, ...ext(pts[pts.length - 1], pts[pts.length - 2])] : pts;
  const n = all.length, x = new Float64Array(n), y = new Float64Array(n), s = new Float64Array(n), hw = new Float64Array(n).fill(w.halfWidth);
  for (let i = 0; i < n; i++) { x[i] = all[i][0]; y[i] = all[i][1]; s[i] = i ? s[i - 1] + Math.hypot(x[i] - x[i - 1], y[i] - y[i - 1]) : 0; }
  return { id: `OSM${w.id}`, x, y, s, halfWidth: hw, deck: [0, n ? s[n - 1] : 0] };
}

/**
 * Cap a way deck's sides at the water found beside an opened bridge's edges (`cap`: left, right of the axis, from
 * water.ts openUnderFootbridges `sides`), when the roads survey gives no deck-level outline (deckEdgeSides). Sides
 * (roadEdgeSides) that lie inside stay; the bbox is left as it was (it only bounds lookups).
 */
export function capDeckSides(p: DeckProfile, cap: readonly [number, number]): void {
  const hw = Math.max(...p.halfWidth), [l, r] = p.sides ?? [hw, hw];
  if (l <= cap[0] && r <= cap[1]) return;
  setDeckSides(p, [Math.min(l, cap[0]), Math.min(r, cap[1])]);
}

/**
 * A deck over water opened under its way: its sides from the survey's deck-level polygons (h ≥ 1, `onDeckPoly`), which
 * outline the bridge itself. The road edges (roadEdgeSides) walk on along the quay's pavements, and the water found
 * beside the opening can lie past the bridge where the source water was cut wider than the deck (the De Clercqstraat:
 * 12.8 m to the south over a 3 m pavement). Per station over the deck span, each side walks out from the axis in
 * ROAD_EDGE_STEP_M steps, across gaps of at most DECK_EDGE_GAP_M between polygons, to the last deck-level point;
 * the median over ROAD_EDGE_MIN_STATIONS stations at least, else undefined for that side.
 */
export const DECK_EDGE_GAP_M = 1.5;
export function deckEdgeSides(p: DeckProfile, onDeckPoly: (x: number, y: number) => boolean, reach: number): [number | undefined, number | undefined] {
  const edges: [number[], number[]] = [[], []];
  for (let i = 0; i < p.s.length; i++) {
    if (p.s[i] < p.deck[0] || p.s[i] > p.deck[1]) continue;
    const a = Math.max(0, i - 1), b = Math.min(p.s.length - 1, i + 1), dx = p.x[b] - p.x[a], dy = p.y[b] - p.y[a], l = Math.hypot(dx, dy) || 1, nx = -dy / l, ny = dx / l;
    for (const side of [0, 1] as const) {
      const sg = side === 0 ? 1 : -1;
      let last = -1;
      for (let t = 0; t <= reach && t - Math.max(0, last) <= DECK_EDGE_GAP_M; t += ROAD_EDGE_STEP_M) if (onDeckPoly(p.x[i] + nx * sg * t, p.y[i] + ny * sg * t)) last = t;
      if (last >= 0) edges[side].push(last + ROAD_EDGE_STEP_M / 2);
    }
  }
  const med = (v: number[]) => { const q = [...v].sort((x, y) => x - y); return q[q.length >> 1]; };
  return edges.map(v => (v.length >= ROAD_EDGE_MIN_STATIONS ? med(v) : undefined)) as [number | undefined, number | undefined];
}

/**
 * A way deck re-centred on its outline (deckEdgeSides, or the water beside an opening): `sides` left and right of
 * the current axis. The axis shifts by (left - right) / 2 and the half-width becomes (left + right) / 2, with no
 * `sides`: the deck surface, its weight and the water mask read the half-width (GroundSurface.locate), so narrowing
 * a side through `sides` alone would leave the half-width standing over the water. The bbox follows.
 */
export function setDeckSides(p: DeckProfile, sides: readonly [number, number]): void {
  const shift = (sides[0] - sides[1]) / 2, half = (sides[0] + sides[1]) / 2, n = p.x.length;
  const pts = offsetLine(Array.from({ length: n }, (_, i) => [p.x[i], p.y[i]] as Vec2), shift);
  let bx0 = Infinity, by0 = Infinity, bx1 = -Infinity, by1 = -Infinity;
  for (let i = 0; i < n; i++) {
    p.x[i] = pts[i][0]; p.y[i] = pts[i][1]; p.halfWidth[i] = half;
    bx0 = Math.min(bx0, p.x[i] - half); by0 = Math.min(by0, p.y[i] - half); bx1 = Math.max(bx1, p.x[i] + half); by1 = Math.max(by1, p.y[i] + half);
  }
  delete p.sides;
  p.bbox = [bx0, by0, bx1, by1];
}

/**
 * A deck for a bridge way over land (bridgeGaps step 3, issue #178; integrator 2026-11-01): the road survey puts a
 * deck-level polygon (h ≥ 1) under the way and nothing at road level on the ground under it (`dry`: the condition that
 * keeps a bridge from being painted over the street beneath a viaduct). The way deck spans the dry run, its ends may
 * stay on the structure (a bus station deck), it carries no water (`water` null: no piers or arches from water spans)
 * and lies on the chord between its approach ends (h 0), as the canal way decks do.
 */
export function dryWayDeckProfile(w: WayDeckInput, dry: (x: number, y: number) => boolean, claimed: (x: number, y: number) => boolean): DeckProfile | null {
  const p = wayDeckProfile(`OSM${w.id}`, w.name, w.points, w.halfWidth, dry, claimed, undefined, true);
  if (!p) return null;
  p.water = null;
  return p;
}
