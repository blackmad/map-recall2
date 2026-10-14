// Bridge bodies on the own ground (pure): measured decks from their re-based
// profiles (surface.ts) and unmeasured footprints as flat decks.
//
// The deck *top* is the riding surface itself (GroundSurface.height). The
// street ribbons drawn over it carry road paint across the bridge, and a deck
// top under them fills the footprint out to the railings, so no water shows
// between a carriageway, its sidewalk and the parapet (lane bridges-elevation
// 2026-10-13: the Nieuwe-Wercksbrug by the Westerkerk read as a road floating
// between two dark lines).
//
// Everything under, beside and on the edge of the top is the bridge kit
// (bridgeKit.ts, lane bridge-kit 2026-10-13): this module turns a measured
// profile or an unmeasured footprint into the kit's spine of stations, picks
// the type (arch, girder, footbridge, bascule) from the extract's family and
// the municipal register, and adds the movable-bridge portals.

import earcut from 'earcut';
import { drapeTriangles, emptyMesh, vertex, type MeshArrays } from './drape.js';
import {
  basculeColour, basculeLeaves, basculeStyle, basculeUnit, basementEnd, bridgeFacts, buildKit, flatHintAt, flatKind, FRAME, materialOf, measuredKind, registerHint, KIT_BUDGET, KIT_COLOURS,
  type BridgeKind, type KitRow, type RGB,
} from './bridgeKit.js';
import type { DeckSurface, HeightFn, Vec2 } from './surface.js';
import { sideWidths } from '../elevation/bridgeDeck.js';

export { FRAME, RAILING, PIER_SPAN_M } from './bridgeKit.js';
const hex = (h: string): RGB => { const v = parseInt(h.slice(1), 16); return [((v >> 16) & 255) / 255, ((v >> 8) & 255) / 255, (v & 255) / 255]; };

export const DECK_TOP: RGB = hex('#8e8a84');
/** Amsterdam bridge-railing green (near-black fir green). */
export const RAILING_GREEN: RGB = KIT_COLOURS.iron;
/** Deck-top lift over the surface: under every street band (LIFT.carriageway 0.03; bridge bands are sampled every 0.75 m), 2 cm down so the deck top's 1 m chords stay under the bands where a ramp turns concave (BRU0290, BRU0044, BRU0052 in the belt audit); the parapet covers its edge. */
export const DECK_TOP_LIFT = 0;

/** Is (x, y) over water? (signed mask distance < 0) */
export type WaterTest = (x: number, y: number) => boolean;

function quad(m: MeshArrays, a: number, b: number, c: number, d: number): void { m.indices.push(a, b, c, a, c, d); }

/**
 * The crossing direction at station i, over ±AXIS_WINDOW stations: the
 * measured centreline wobbles by decimetres, and a normal from the next
 * stations alone swings a 10 m half-width edge by up to 0.8 m per station
 * (the Blauwbrug's deck top and faces zigzagged).
 */
const AXIS_WINDOW = 4;
function axisAt(p: { x: Float64Array; y: Float64Array }, i: number): [number, number] {
  const n = p.x.length, a = Math.max(0, i - AXIS_WINDOW), b = Math.min(n - 1, i + AXIS_WINDOW);
  return [p.x[b] - p.x[a], p.y[b] - p.y[a]];
}

/**
 * Deck ends on the bank (user 2026-10-14, a Houthavens footbridge "disconnected": the deck hung over the water short of
 * both banks, the quay surfaces ending flush). A deck must overlap each bank by ABUTMENT_DEPTH_M and meet the quay top
 * within DECK_END_TOL_M. Where the water mask runs past the measured deck span (the water polygon drawn under the
 * approach), the drawn deck reaches on along the profile to the first station whose centre and both edges are on
 * land, plus the abutment depth, at most DECK_REACH_MAX_M.
 */
export const ABUTMENT_DEPTH_M = 1.0, DECK_END_TOL_M = 0.15, DECK_REACH_MAX_M = 12;
const onLandAt = (p: DeckSurface['profile'], i: number, overWater: WaterTest): boolean => {
  const [dx, dy] = axisAt(p, i), l = Math.hypot(dx, dy) || 1, nx = -dy / l, ny = dx / l, hw = p.halfWidth[i];
  return !overWater(p.x[i], p.y[i]) && !overWater(p.x[i] + nx * hw, p.y[i] + ny * hw) && !overWater(p.x[i] - nx * hw, p.y[i] - ny * hw);
};
/** The station range the deck is drawn over: the measured span, reaching on to the banks (see ABUTMENT_DEPTH_M). */
export function deckReach(deck: DeckSurface, overWater: WaterTest): { reach: [number, number]; landed: [boolean, boolean] } {
  const p = deck.profile, n = p.s.length, reach: [number, number] = [p.deck[0], p.deck[1]], landed: [boolean, boolean] = [true, true];
  for (const end of [0, 1] as const) {
    const dir = end === 0 ? -1 : 1, limit = p.deck[end] + dir * DECK_REACH_MAX_M;
    // The station at the deck end, then outward.
    let i = end === 0 ? p.s.findIndex(v => v >= p.deck[0]) : n - 1 - [...p.s].reverse().findIndex(v => v <= p.deck[1]);
    if (i < 0 || i >= n) continue;
    if (onLandAt(p, i, overWater)) continue;
    landed[end] = false;
    for (i += dir; i >= 0 && i < n && (dir < 0 ? p.s[i] >= limit : p.s[i] <= limit); i += dir) {
      if (!onLandAt(p, i, overWater)) continue;
      reach[end] = Math.max(p.s[0], Math.min(p.s[n - 1], p.s[i] + dir * ABUTMENT_DEPTH_M));
      landed[end] = true;
      break;
    }
  }
  return { reach, landed };
}
/** Ends of a drawn deck that float: still over water at the reach, or more than DECK_END_TOL_M off the bank's relief there. */
export function floatingEnds(deck: DeckSurface, overWater: WaterTest, height: HeightFn, ground: HeightFn): { end: 0 | 1; reason: string }[] {
  const p = deck.profile, { reach, landed } = deckReach(deck, overWater), out: { end: 0 | 1; reason: string }[] = [];
  for (const end of [0, 1] as const) {
    if (!landed[end]) { out.push({ end, reason: `over water ${DECK_REACH_MAX_M} m past the deck` }); continue; }
    let i = 0; while (i < p.s.length - 1 && p.s[i] < reach[end]) i++;
    const x = p.x[i], y = p.y[i], dz = height(x, y) - ground(x, y);
    if (Math.abs(dz) > DECK_END_TOL_M && !overWater(x, y)) out.push({ end, reason: `deck ${dz.toFixed(2)} m off the bank` });
  }
  return out;
}

/** What one measured deck drew (named regressions and the lane report). */
export interface DeckBuildInfo { id: string; kind: BridgeKind; triangles: number; level: number; railingPosts: number; piers: number; arches: number; abutments: number; lamps: number; topRows: number }

/**
 * One measured deck. `ground` is the relief without decks (for burying the
 * abutment walls), `waterZ` the canal level, `height` the riding surface (the
 * deck top and the tops of the side faces follow it exactly). `detail` false
 * is the far ring (LOD 1): the kit's far budget, no railings.
 */
export function measuredDeckBody(deck: DeckSurface, ground: HeightFn, overWater: WaterTest, waterZ: number, height?: HeightFn, info?: DeckBuildInfo[], detail = true, reach?: [number, number]): MeshArrays {
  const p = deck.profile, [r0, r1] = reach ?? [p.deck[0], p.deck[1]];
  const idx: number[] = [];
  for (let i = 0; i < p.s.length; i++) if (p.s[i] >= r0 - 0.5 && p.s[i] <= r1 + 0.5) idx.push(i);
  if (idx.length < 2) return emptyMesh(true);
  const rows: KitRow[] = idx.map(i => {
    const [dx, dy] = axisAt(p, i), l = Math.hypot(dx, dy) || 1;
    const n: Vec2 = [-dy / l, dx / l], hw = p.halfWidth[i], [hl, hr] = sideWidths(p, i);
    const L: Vec2 = [p.x[i] + n[0] * hl, p.y[i] + n[1] * hl], R: Vec2 = [p.x[i] - n[0] * hr, p.y[i] - n[1] * hr];
    const z = deck.z[i];
    // Past the road's half-width (an outline wider than the road, DeckProfile.sides) the surface there is the canal: the deck's own level.
    const zAt = (q: Vec2, w: number) => (!height ? z : w > hw + 0.01 ? Math.max(z, height(q[0], q[1])) : height(q[0], q[1]));
    return { s: p.s[i], c: [p.x[i], p.y[i]], n, L, R, z, zL: zAt(L, hl), zR: zAt(R, hr),
      water: overWater(p.x[i], p.y[i]), wL: overWater(L[0], L[1]), wR: overWater(R[0], R[1]), gL: ground(L[0], L[1]), gR: ground(R[0], R[1]) };
  });
  // Water spans: the profile's measured water (the pipeline's AHN water) where it has one, else the mask's runs along the centre.
  const runs: [number, number][] = [];
  for (let k = 0; k < rows.length; k++) {
    if (!rows[k].water) continue;
    const last = runs[runs.length - 1];
    if (last && k > 0 && rows[k - 1].water) last[1] = rows[k].s; else runs.push([rows[k].s, rows[k].s]);
  }
  let spans: [number, number][] = p.water ? [[Math.max(p.water[0], rows[0].s), Math.min(p.water[1], rows[rows.length - 1].s)]] : runs;
  const hint = registerHint(p.id);
  const onSpan = idx.filter(i => p.s[i] >= p.deck[0] && p.s[i] <= p.deck[1]);
  // No water measured or mapped under a humped deck: the water polygon stops at the bridge (BRU0016, the
  // Melkmeisjesbrug). It still crosses a canal: its humped middle is the opening, not a brick causeway.
  if (!spans.length && Math.max(0, ...onSpan.map(i => p.h[i])) >= 0.4) {
    const humped = onSpan.filter(i => p.h[i] >= 0.25);
    if (humped.length > 2) spans = [[p.s[humped[0]], p.s[humped[humped.length - 1]]]];
  }
  const widths = onSpan.map(i => 2 * p.halfWidth[i]).sort((a, b) => a - b), width = widths[widths.length >> 1] ?? 2 * p.halfWidth[idx[0]];
  const hump = Math.max(0, ...onSpan.map(i => p.h[i])), waterM = spans.reduce((s, [a, b]) => s + Math.max(0, b - a), 0);
  const facts = bridgeFacts(p.id);
  const kind = measuredKind(p.family, width, hump, waterM, hint, facts);
  const { mesh, info: k } = buildKit({ id: p.id, kind, material: materialOf(p.family, hint), rows, parapet: [p.deck[0], p.deck[1]], spans, waterZ, lod: detail ? 0 : 1, facts });
  info?.push({ id: p.id, kind, triangles: k.triangles, level: k.level, railingPosts: k.railingPosts, piers: k.piers, arches: k.arches, abutments: k.abutments, lamps: k.lamps, topRows: idx.length });
  return mesh;
}

/**
 * The deck top of a measured deck: a strip over its footprint (the deck span
 * plus half a metre), draped on the riding surface, under every street band.
 */
export function measuredDeckTop(deck: DeckSurface, height: HeightFn, across = 4, stride = 2, reach?: [number, number]): MeshArrays {
  const m = emptyMesh(true), p = deck.profile, [r0, r1] = reach ?? [p.deck[0], p.deck[1]];
  const all: number[] = [];
  for (let i = 0; i < p.s.length; i++) if (p.s[i] >= r0 - 0.5 && p.s[i] <= r1 + 0.5) all.push(i);
  // Every `stride`-th station (1 m at 0.5 m stations): on a hump the coarser chords sag under the bands, never over them.
  // The stride keeps its phase from the measured span's first station, so a reach to the bank leaves the chords over the hump as they were.
  const k0 = Math.max(0, all.findIndex(i => p.s[i] >= p.deck[0] - 0.5)), k0m = ((k0 % stride) + stride) % stride;
  const idx = all.filter((_, k) => k % stride === k0m || k === 0 || k === all.length - 1);
  if (idx.length < 2) return m;
  // Columns across, left to right: the road's half-width in `across` steps, then every ≤ 4 m out to a wider outline
  // (DeckProfile.sides; the same count on every row, so the grid stays regular).
  const sideMax = p.sides ? [Math.max(0, p.sides[0] - Math.max(...idx.map(i => p.halfWidth[i]))), Math.max(0, p.sides[1] - Math.max(...idx.map(i => p.halfWidth[i])))] : [0, 0];
  const extra = sideMax.map(w => (w > 0.01 ? Math.ceil(w / 4) : 0));
  const J = Math.max(2, across) + extra[0] + extra[1], base = m.positions.length / 3;
  for (const i of idx) {
    const [dx, dy] = axisAt(p, i), l = Math.hypot(dx, dy) || 1;
    const nx = -dy / l, ny = dx / l, hw = p.halfWidth[i], [hl, hr] = sideWidths(p, i), A = Math.max(2, across);
    for (let j = 0; j <= J; j++) {
      const t = j < extra[0] ? hl - (hl - hw) * j / extra[0] : j > J - extra[1] ? -hw - (hr - hw) * (j - (J - extra[1])) / extra[1] : hw * (1 - 2 * (j - extra[0]) / A);
      const x = p.x[i] + nx * t, y = p.y[i] + ny * t;
      // Past the measured span (a reach to the bank) the top stays on the riding surface too: the street bands drawn on it
      // must stay on top (BRU0077 in the belt audit, a top on the profile's z rose 2 cm over the klinker band).
      // Past the road's half-width on a wider outline: the deck's own level (the surface there is the canal).
      const z = Math.abs(t) > hw + 0.01 ? Math.max(deck.z[i], height(x, y)) : height(x, y);
      vertex(m, x, y, z + DECK_TOP_LIFT, DECK_TOP);
    }
  }
  // Left (+n) to right per row; the next row is +s. (+s) × (−n) is up, so a row's j → j+1 then the next row is counter-clockwise from above.
  for (let r = 0; r + 1 < idx.length; r++) for (let j = 0; j < J; j++) {
    const a = base + r * (J + 1) + j, b = a + 1, c = a + J + 2, d = a + J + 1;
    quad(m, a, b, c, d);
  }
  return m;
}

/** Crossing axis of a flat footprint: the bridge ways through it if any, else its long axis. */
export function footprintAxis(ring: readonly Vec2[], ways: readonly (readonly Vec2[])[] = []): { centre: Vec2; u: Vec2; along: [number, number]; across: [number, number] } {
  const cx = ring.reduce((s, q) => s + q[0], 0) / ring.length, cy = ring.reduce((s, q) => s + q[1], 0) / ring.length;
  let ax = 0, ay = 0;
  for (const w of ways) for (let i = 0; i + 1 < w.length; i++) {
    const mx = (w[i][0] + w[i + 1][0]) / 2, my = (w[i][1] + w[i + 1][1]) / 2;
    if (!pointInRing(ring, mx, my)) continue;
    let dx = w[i + 1][0] - w[i][0], dy = w[i + 1][1] - w[i][1];
    if (ax * dx + ay * dy < 0) { dx = -dx; dy = -dy; }
    ax += dx; ay += dy;
  }
  if (Math.hypot(ax, ay) < 1) {
    let sxx = 0, syy = 0, sxy = 0;
    for (const [x, y] of ring) { sxx += (x - cx) ** 2; syy += (y - cy) ** 2; sxy += (x - cx) * (y - cy); }
    const th = 0.5 * Math.atan2(2 * sxy, sxx - syy);
    ax = Math.cos(th); ay = Math.sin(th);
  }
  const l = Math.hypot(ax, ay), u: Vec2 = [ax / l, ay / l];
  let a0 = Infinity, a1 = -Infinity, b0 = Infinity, b1 = -Infinity;
  for (const [x, y] of ring) {
    const a = (x - cx) * u[0] + (y - cy) * u[1], b = -(x - cx) * u[1] + (y - cy) * u[0];
    a0 = Math.min(a0, a); a1 = Math.max(a1, a); b0 = Math.min(b0, b); b1 = Math.max(b1, b);
  }
  return { centre: [cx, cy], u, along: [a0, a1], across: [b0, b1] };
}

export function pointInRing(ring: readonly Vec2[], x: number, y: number): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}


/** A footprint's frame on a given crossing axis `u`: vertex centroid, extents along and across. */
function ringFrame(ring: readonly Vec2[], u: Vec2): { centre: Vec2; v: Vec2; along: [number, number]; across: [number, number] } {
  const cx = ring.reduce((s, q) => s + q[0], 0) / ring.length, cy = ring.reduce((s, q) => s + q[1], 0) / ring.length, v: Vec2 = [-u[1], u[0]];
  let a0 = Infinity, a1 = -Infinity, b0 = Infinity, b1 = -Infinity;
  for (const [x, y] of ring) {
    const a = (x - cx) * u[0] + (y - cy) * u[1], b = (x - cx) * v[0] + (y - cy) * v[1];
    a0 = Math.min(a0, a); a1 = Math.max(a1, a); b0 = Math.min(b0, b); b1 = Math.max(b1, b);
  }
  return { centre: [cx, cy], v, along: [a0, a1], across: [b0, b1] };
}

/**
 * A movable bridge's portals (the Amsterdam ophaalbrug "galg" with its
 * "hameien"): one unit at the heel of each leaf, its balance beams sloping
 * down over the leaf. A footprint longer than FRAME.doubleOver is a double
 * bascule (the Magere Brug): two units facing each other, their beam heads
 * FRAME.tipGap apart over the middle. Colour from the register (timber
 * bridges white, steel and concrete green). `detail` false: the far ring's
 * posts and beams only.
 */
export function movableFrame(ring: readonly Vec2[], height: HeightFn, ways: readonly (readonly Vec2[])[] = [], topLift = 0.02, detail = true): { mesh: MeshArrays; units: number } {
  const m = emptyMesh(true), ax = footprintAxis(ring, ways), { u } = ax, v: Vec2 = [-u[1], u[0]];
  const half = Math.max(1.5, (ax.across[1] - ax.across[0]) / 2), vc = (ax.across[0] + ax.across[1]) / 2;
  const P = (a: number, b: number): Vec2 => [ax.centre[0] + u[0] * a + v[0] * b, ax.centre[1] + u[1] * a + v[1] * b];
  const { double, leaf, mid } = basculeLeaves(ax.along);
  const found = flatHintAt(ax.centre[0], ax.centre[1]), colour = basculeColour(found?.hint ?? null, found?.id);
  const deckZ = (q: Vec2) => height(q[0], q[1]) + topLift;
  const side = [vc + half + 0.45, vc - half - 0.45] as const;
  if (basculeStyle(found?.id, found?.hint ?? null) === 'basement') {
    // No portal: signal masts and barrier boxes just off each end of the footprint, on the approach.
    const masts = [ax.along[0] - 1.2, ax.along[1] + 1.2], mastSide = [vc + half - 0.3, vc - half + 0.3] as const;
    for (const at of masts) basementEnd(m, P, u, at, mastSide, deckZ, !detail);
    return { mesh: m, units: 0 };
  }
  const units: { at: number; dir: 1 | -1; reach: number }[] = double
    ? [{ at: mid - leaf, dir: 1, reach: Math.max(1.5, leaf - FRAME.tipGap / 2) }, { at: mid + leaf, dir: -1, reach: Math.max(1.5, leaf - FRAME.tipGap / 2) }]
    : [{ at: mid - leaf / 2, dir: 1, reach: leaf * 0.85 }];
  for (const { at, dir, reach } of units) {
    // The posts stand on the deck: its level at the heel (beside the footprint the surface is the canal's relief, and a
    // base taken there left the portal floating or sunk: the Haarlemmerpoort report, 2026-10-14).
    const base = deckZ(P(at, vc));
    basculeUnit(m, P, u, at, dir, reach, side, base, deckZ, colour, !detail);
  }
  return { mesh: m, units: units.length };
}

/** Triangles of movableFrame's portals for a footprint this long along its axis. */
function frameTriangles(along: readonly [number, number], detail: boolean, style: 'portal' | 'basement' = 'portal'): number {
  const L = along[1] - along[0];
  if (style === 'basement') { const m = emptyMesh(true); for (const at of [0, L]) basementEnd(m, (a, b) => [a, b], [1, 0], at, [3, -3], () => 0, !detail); return m.indices.length / 3; }
  return movableFrame([[0, -3], [L, -3], [L, 3], [0, 3]], () => 0, [], 0.02, detail).mesh.indices.length / 3;
}

/** Width across a footprint at each station along `u` (ring ∩ the cross line), as the kit's rows. */
function flatRows(ring: readonly Vec2[], u: Vec2, height: HeightFn, overWater: WaterTest, topLift: number, step: number): KitRow[] {
  const f = ringFrame(ring, u), { centre, v } = f, rows: KitRow[] = [];
  const n = ring.length, len = f.along[1] - f.along[0], count = Math.max(2, Math.ceil(len / step));
  for (let i = 0; i <= count; i++) {
    const s = f.along[0] + 0.05 + (len - 0.1) * i / count, O: Vec2 = [centre[0] + u[0] * s, centre[1] + u[1] * s];
    let t0 = Infinity, t1 = -Infinity;
    for (let k = 0; k < n; k++) {
      const a = ring[k], b = ring[(k + 1) % n];
      // Signed along-distances of the edge's ends; it crosses the line where they change sign.
      const da = (a[0] - O[0]) * u[0] + (a[1] - O[1]) * u[1], db = (b[0] - O[0]) * u[0] + (b[1] - O[1]) * u[1];
      if ((da > 0) === (db > 0) || da === db) continue;
      const t = da / (da - db), x = a[0] + (b[0] - a[0]) * t, y = a[1] + (b[1] - a[1]) * t, w = (x - O[0]) * v[0] + (y - O[1]) * v[1];
      t0 = Math.min(t0, w); t1 = Math.max(t1, w);
    }
    if (!(t1 - t0 > 0.5)) continue;
    const L: Vec2 = [O[0] + v[0] * t1, O[1] + v[1] * t1], R: Vec2 = [O[0] + v[0] * t0, O[1] + v[1] * t0], c: Vec2 = [(L[0] + R[0]) / 2, (L[1] + R[1]) / 2];
    rows.push({ s, c, n: v, L, R, z: height(c[0], c[1]) + topLift, zL: height(L[0], L[1]) + topLift, zR: height(R[0], R[1]) + topLift,
      water: overWater(c[0], c[1]), wL: overWater(L[0], L[1]), wR: overWater(R[0], R[1]), gL: height(L[0], L[1]), gR: height(R[0], R[1]) });
  }
  return rows;
}

/**
 * An unmeasured footprint (CCW ring, scene coords): its top draped on the
 * surface, and the kit's body over the stretch that crosses water (the
 * crossing axis `opts.axis`, from the bridge ways through it, else its long
 * axis). Masonry footprints (the Torensluis) get arches, movable ones the
 * bascule leaf, narrow ones the footbridge, the rest a girder.
 */
export function flatDeckBody(ring: readonly Vec2[], height: HeightFn, overWater: WaterTest, topLift = 0.02, thickness = 0.45, opts: { railings?: boolean; axis?: Vec2 } = {}): { top: MeshArrays; body: MeshArrays; railingPosts: number; kind: BridgeKind | null; triangles: number; level: number; floating: number } {
  const top = emptyMesh(true);
  const flat = ring.flatMap(p => [p[0], p[1]]);
  drapeTriangles(top, flat, earcut(flat), height, topLift, 3, DECK_TOP);
  const u = opts.axis ?? footprintAxis(ring).u, lod = opts.railings === false ? 1 : 0;
  // A station a metre apart, at most ~40 along a long footprint (a lock complex: BRU0246 is 85 m with 127 ring vertices).
  const all = flatRows(ring, u, height, overWater, topLift, Math.max(1, (ringFrame(ring, u).along[1] - ringFrame(ring, u).along[0]) / 40));
  // A footprint end still over water reaches on to the bank (ABUTMENT_DEPTH_M past the first land, at most DECK_REACH_MAX_M).
  let floating = 0;
  if (all.length >= 2) for (const end of [0, 1] as const) {
    const r = end === 0 ? all[0] : all[all.length - 1], dir = end === 0 ? -1 : 1;
    if (!r.water && !r.wL && !r.wR) continue;
    const hw: Vec2 = [(r.L[0] - r.R[0]) / 2, (r.L[1] - r.R[1]) / 2];
    const at = (d: number): KitRow => {
      const c: Vec2 = [r.c[0] + u[0] * dir * d, r.c[1] + u[1] * dir * d], L: Vec2 = [c[0] + hw[0], c[1] + hw[1]], R: Vec2 = [c[0] - hw[0], c[1] - hw[1]];
      const z = Math.max(r.z, height(c[0], c[1]) + topLift), zL = Math.max(r.zL, height(L[0], L[1]) + topLift), zR = Math.max(r.zR, height(R[0], R[1]) + topLift);
      return { s: r.s + dir * d, c, n: r.n, L, R, z, zL, zR, water: overWater(c[0], c[1]), wL: overWater(L[0], L[1]), wR: overWater(R[0], R[1]), gL: height(L[0], L[1]), gR: height(R[0], R[1]) };
    };
    let land = -1;
    for (let d = 0.5; d <= DECK_REACH_MAX_M; d += 0.5) { const q = at(d); if (!q.water && !q.wL && !q.wR) { land = d; break; } }
    if (land < 0) { floating++; continue; }
    const apron: KitRow[] = [];
    for (let d = 1; d < land + ABUTMENT_DEPTH_M; d += 1) apron.push(at(d));
    apron.push(at(land + ABUTMENT_DEPTH_M));
    // The apron's top: quads from the end row out, at the deck's level until the bank.
    const seq = [r, ...apron];
    for (let k = 0; k + 1 < seq.length; k++) {
      const a = seq[k], b = seq[k + 1], i0 = vertex(top, a.L[0], a.L[1], a.zL, DECK_TOP), i1 = vertex(top, a.R[0], a.R[1], a.zR, DECK_TOP), i2 = vertex(top, b.R[0], b.R[1], b.zR, DECK_TOP), i3 = vertex(top, b.L[0], b.L[1], b.zL, DECK_TOP);
      // Counter-clockwise from above: L→R across, then outward along ±u.
      const cross = (a.R[0] - a.L[0]) * (b.L[1] - a.L[1]) - (a.R[1] - a.L[1]) * (b.L[0] - a.L[0]);
      if (cross > 0) top.indices.push(i0, i1, i2, i0, i2, i3); else top.indices.push(i0, i2, i1, i0, i3, i2);
    }
    if (end === 0) all.unshift(...apron.reverse()); else all.push(...apron);
  }
  const first = all.findIndex(r => r.water), last = all.length - 1 - [...all].reverse().findIndex(r => r.water);
  if (first < 0) return { top, body: emptyMesh(true), railingPosts: 0, kind: null, triangles: 0, level: 0, floating };
  const rows = all.slice(Math.max(0, first - 1), Math.min(all.length, last + 2));
  const spans: [number, number][] = [];
  for (let k = 0; k < rows.length; k++) if (rows[k].water) {
    const run = spans[spans.length - 1];
    // Runs a pier or a mapped island apart (under 6 m) are one span: the kit draws its own piers.
    if (run && (rows[k - 1]?.water || rows[k].s - run[1] < 6)) run[1] = rows[k].s; else spans.push([rows[k].s, rows[k].s]);
  }
  const centre = ringFrame(ring, u).centre, found = flatHintAt(centre[0], centre[1]), hint = found?.hint ?? null;
  const widths = rows.map(r => Math.hypot(r.L[0] - r.R[0], r.L[1] - r.R[1])).sort((a, b) => a - b);
  const facts = found ? bridgeFacts(found.id) : null;
  const kind = flatKind(false, widths[widths.length >> 1], hint, facts);
  const leaves = kind === 'bascule' ? basculeLeaves(ringFrame(ring, u).along).leaves : undefined;
  const { mesh, info } = buildKit({
    id: found?.id ?? '', kind, material: kind === 'arch' ? 'masonry' : hint?.material ?? 'concrete', rows,
    parapet: [all[first].s - 0.5, all[last].s + 0.5], spans, waterZ: Math.min(...rows.map(r => r.z)) - FLAT_FREEBOARD_M, lod, thickness,
    leaves, colour: kind === 'bascule' ? basculeColour(hint, found?.id) : undefined, lateralTol: 0.5, facts,
    // A bascule's portals (movableFrame, drawn by the cell beside this body) share its budget.
    budget: kind === 'bascule' ? (lod === 0 ? (facts?.named ? KIT_BUDGET.named : KIT_BUDGET.near) : (facts?.named ? KIT_BUDGET.namedFar : KIT_BUDGET.far)) - frameTriangles(ringFrame(ring, u).along, lod === 0, basculeStyle(found?.id, hint)) : undefined,
  });
  // The far ring of a double bascule: its two portals are the silhouette; a fascia that does not fit beside them is dropped.
  if (kind === 'bascule' && lod === 1 && info.triangles > (facts?.named ? KIT_BUDGET.namedFar : KIT_BUDGET.far) - frameTriangles(ringFrame(ring, u).along, false, basculeStyle(found?.id, hint))) return { top, body: emptyMesh(true), railingPosts: 0, kind, triangles: 0, level: info.level, floating };
  return { top, body: mesh, railingPosts: info.railingPosts, kind, triangles: info.triangles, level: info.level, floating };
}

/** An unmeasured footprint carries no water level: its kit body reaches this far under its lowest top (the belt quays stand ~1.8 m over the boezem). */
const FLAT_FREEBOARD_M = 1.8;

/**
 * Inside a measured deck's corridor over its water: within the water extent (the deck span where the profile has none)
 * shrunk by `inset` at both ends, and within the deck's half-width plus `pad`. The water polygons of the extract stop
 * at a wide bridge's faces (the BGT waterdeel leaves the overbruggingsdeel out), so their shores ran across the canal
 * under the Torensluis and the quay wall drawn there, topped at the deck's height, filled its arches (bridge-fidelity
 * e2e 2026-10-14). The quay walls skip shores in here.
 */
export function underDeck(decks: readonly DeckSurface[], inset = 1.5, pad = 2): (x: number, y: number) => boolean {
  const boxes = decks.map(d => d.profile.bbox);
  return (x, y) => {
    for (let k = 0; k < decks.length; k++) {
      const b = boxes[k];
      if (x < b[0] - 30 || x > b[2] + 30 || y < b[1] - 30 || y > b[3] + 30) continue;
      const p = decks[k].profile, ext = p.water ?? p.deck;
      let best = -1, bd = Infinity;
      for (let i = 0; i < p.s.length; i++) { const d = (p.x[i] - x) ** 2 + (p.y[i] - y) ** 2; if (d < bd) { bd = d; best = i; } }
      if (best < 0 || p.s[best] < ext[0] + inset || p.s[best] > ext[1] - inset) continue;
      // Which side of the road line, and that side's half-width (DeckProfile.sides).
      const [dx, dy] = axisAt(p, best), l = Math.hypot(dx, dy) || 1, c = (-(x - p.x[best]) * dy + (y - p.y[best]) * dx) / l, [hl, hr] = sideWidths(p, best);
      if ((c >= 0 ? c < hl + pad : -c < hr + pad)) return true;
    }
    return false;
  };
}

