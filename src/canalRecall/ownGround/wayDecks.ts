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

export const WAY_DECK_STEP_M = 0.5, WAY_DECK_MIN_WATER_M = 2, ABUTMENT_M = 1, APPROACH_M = 6;
/** A wet station this close to a measured deck or a flat footprint belongs to that bridge (no second deck beside it). */
export const WAY_DECK_CLEAR_M = 4;

/** Highway kinds that get a deck (not steps, not a platform or proposed way). */
export const wayDeckHighway = (h: string | undefined): boolean => !!h && !/^(steps|platform|proposed|construction|corridor|elevator)$/.test(h);

/**
 * The profile for one bridge way, or null when it crosses less than WAY_DECK_MIN_WATER_M of water or any wet station
 * is `claimed` (another bridge is there). `points` in scene metres, `halfWidth` the way's drawn half-width.
 */
export function wayDeckProfile(id: string, name: string, points: readonly Vec2[], halfWidth: number, wet: (x: number, y: number) => boolean, claimed: (x: number, y: number) => boolean): DeckProfile | null {
  if (points.length < 2) return null;
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
  let all = [...extend(0).reverse(), ...pts, ...extend(1)];
  const wetAt = all.map(p => wet(p[0], p[1]));
  const first = wetAt.indexOf(true), last = wetAt.lastIndexOf(true);
  if (first < 0) return null;
  // The water run: first to last wet station (a pier or island between counts as the span).
  if ((last - first) * WAY_DECK_STEP_M < WAY_DECK_MIN_WATER_M) return null;
  // Both ends must reach land within the approaches (a way along a quay or a pontoon is not a crossing).
  if (wetAt[0] || wetAt[all.length - 1]) return null;
  for (let k = first; k <= last; k++) if (claimed(all[k][0], all[k][1])) return null;
  // Approaches: APPROACH_M past the abutments on each side.
  const reach = Math.round((ABUTMENT_M + APPROACH_M) / WAY_DECK_STEP_M);
  const k0 = Math.max(0, first - reach), k1 = Math.min(all.length - 1, last + reach);
  all = all.slice(k0, k1 + 1);
  const n = all.length, x = new Float64Array(n), y = new Float64Array(n), s = new Float64Array(n), h = new Float64Array(n), hw = new Float64Array(n);
  let bx0 = Infinity, by0 = Infinity, bx1 = -Infinity, by1 = -Infinity;
  for (let i = 0; i < n; i++) {
    x[i] = all[i][0]; y[i] = all[i][1]; s[i] = i === 0 ? 0 : s[i - 1] + Math.hypot(x[i] - x[i - 1], y[i] - y[i - 1]); hw[i] = halfWidth;
    bx0 = Math.min(bx0, x[i] - halfWidth); by0 = Math.min(by0, y[i] - halfWidth); bx1 = Math.max(bx1, x[i] + halfWidth); by1 = Math.max(by1, y[i] + halfWidth);
  }
  const w0 = s[first - k0], w1 = s[last - k0];
  return {
    id, name, family: 'way-deck', x, y, s, h, halfWidth: hw, water: [w0, w1],
    deck: [Math.max(0, w0 - ABUTMENT_M), Math.min(s[n - 1], w1 + ABUTMENT_M)], bbox: [bx0, by0, bx1, by1],
  };
}

/** One bridge way for wayDeckGroups: id, name, centreline, drawn half-width. */
export interface WayDeckInput { id: number; name: string; points: Vec2[]; halfWidth: number }

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
export function wayDeckGroups(ways: readonly WayDeckInput[], wet: (x: number, y: number) => boolean, claimed: (x: number, y: number) => boolean): { profiles: DeckProfile[]; covered: number[] } {
  const crossing = ways.map(w => ({ w, p: wayDeckProfile(`OSM${w.id}`, w.name, w.points, w.halfWidth, wet, claimed) })).filter(c => !!c.p) as { w: WayDeckInput; p: DeckProfile }[];
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
    const p = shift === 0 && half === main.w.halfWidth ? main.p : wayDeckProfile(`OSM${main.w.id}`, main.w.name, offsetLine(main.w.points, shift), half, wet, () => false) ?? main.p;
    profiles.push(p);
  }
  return { profiles, covered };
}
