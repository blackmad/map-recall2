// Bridge bodies on the own ground (pure): measured decks from their re-based
// profiles (surface.ts) and unmeasured footprints as flat decks.
//
// The deck *top* is the riding surface itself (GroundSurface.height). The
// street ribbons drawn over it carry road paint across the bridge, and a deck
// top under them fills the footprint out to the railings, so no water shows
// between a carriageway, its sidewalk and the parapet (lane bridges-elevation
// 2026-10-13: the Nieuwe-Wercksbrug by the Westerkerk read as a road floating
// between two dark lines). This module draws what is on, under and beside
// the top:
//
//   deck top      footprint strip draped on the surface (layer deckTop)
//   side faces    fascia over water down to the soffit or vault, abutment
//                 walls buried into the relief over land
//   abutments     a face across the deck at every land/water change, from the
//                 deck down past the water, so the quay walls meet the bridge
//   railings      stone/edge plinth plus post-and-rail on both edges of the
//                 deck span (Amsterdam green; wood on wooden decks)
//   piers/arches  only where the measured water span is over PIER_SPAN_M:
//                 bays of at most ~BAY_M, piers between them; masonry arches
//                 vault each bay
//   frames        a portal frame with balance beams on movable bridges (one
//                 shared unit, placed on the crossing axis)

import earcut from 'earcut';
import { densify, drapeTriangles, emptyMesh, vertex, type MeshArrays } from './drape.js';
import type { DeckSurface, HeightFn, Vec2 } from './surface.js';

type RGB = [number, number, number];
type V3 = [number, number, number];
const hex = (h: string): RGB => { const v = parseInt(h.slice(1), 16); return [((v >> 16) & 255) / 255, ((v >> 8) & 255) / 255, (v & 255) / 255]; };

const FAMILY: Record<string, { thickness: number; fascia: RGB; parapet: RGB; railing: RGB; plinth: number }> = {
  'masonry-arch': { thickness: 0.6, fascia: hex('#8a5541'), parapet: hex('#a49a8a'), railing: hex('#26392e'), plinth: 0.4 },
  'concrete-deck': { thickness: 0.45, fascia: hex('#a7a29a'), parapet: hex('#b4afa6'), railing: hex('#26392e'), plinth: 0.14 },
  'steel-deck': { thickness: 0.35, fascia: hex('#4f5d57'), parapet: hex('#8f8a80'), railing: hex('#26392e'), plinth: 0.14 },
  'wooden-deck': { thickness: 0.3, fascia: hex('#7a5a3c'), parapet: hex('#6a4c32'), railing: hex('#5c432d'), plinth: 0.1 },
};
export const DECK_TOP: RGB = hex('#8e8a84');
const SOFFIT: RGB = hex('#4d4843');
const ABUTMENT: RGB = hex('#7b5a4a');
const PIER_STONE: RGB = hex('#8f877b');
const FRAME_WHITE: RGB = hex('#ecebe4');
const FRAME_DARK: RGB = hex('#2d2f2e');
/** Amsterdam bridge-railing green (near-black fir green). */
export const RAILING_GREEN: RGB = FAMILY['steel-deck'].railing;
const BURY = 0.4;
/** Deck-top lift over the surface: under every street band (LIFT.carriageway 0.03; bridge bands are sampled every 0.5 m so their chords stay within it on a hump). */
export const DECK_TOP_LIFT = 0;
/** Railing geometry, metres. */
export const RAILING = { height: 1.05, postStep: 1.8, post: 0.07, rail: 0.06, plinthWidth: 0.28, inset: 0.04 };
/** A measured water span over this gets piers (and, on masonry, several arches). */
export const PIER_SPAN_M = 12;
const BAY_M = 8;
const PIER_LEN = 1.0;

/** Is (x, y) over water? (signed mask distance < 0) */
export type WaterTest = (x: number, y: number) => boolean;

function quad(m: MeshArrays, a: number, b: number, c: number, d: number): void { m.indices.push(a, b, c, a, c, d); }

/** A planar quad (corners in order round it), wound so its normal points along `want`. Own vertices: flat shading. */
function face(m: MeshArrays, p: readonly V3[], c: RGB, want: V3): void {
  const u = [p[1][0] - p[0][0], p[1][1] - p[0][1], p[1][2] - p[0][2]], v = [p[2][0] - p[0][0], p[2][1] - p[0][1], p[2][2] - p[0][2]];
  const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
  const pts = n[0] * want[0] + n[1] * want[1] + n[2] * want[2] < 0 ? [p[0], p[3], p[2], p[1]] : p;
  const i = pts.map(q => vertex(m, q[0], q[1], q[2], c));
  quad(m, i[0], i[1], i[2], i[3]);
}

/** An upright box on a centre, its long axis `u` (unit), no bottom face. */
function box(m: MeshArrays, c: Vec2, u: Vec2, halfLen: number, halfWid: number, z0: number, z1: number, col: RGB): void {
  const v: Vec2 = [-u[1], u[0]];
  const at = (a: number, b: number, z: number): V3 => [c[0] + u[0] * a + v[0] * b, c[1] + u[1] * a + v[1] * b, z];
  const L = halfLen, W = halfWid;
  face(m, [at(L, -W, z0), at(L, W, z0), at(L, W, z1), at(L, -W, z1)], col, [u[0], u[1], 0]);
  face(m, [at(-L, -W, z0), at(-L, W, z0), at(-L, W, z1), at(-L, -W, z1)], col, [-u[0], -u[1], 0]);
  face(m, [at(-L, W, z0), at(L, W, z0), at(L, W, z1), at(-L, W, z1)], col, [v[0], v[1], 0]);
  face(m, [at(-L, -W, z0), at(L, -W, z0), at(L, -W, z1), at(-L, -W, z1)], col, [-v[0], -v[1], 0]);
  face(m, [at(-L, -W, z1), at(L, -W, z1), at(L, W, z1), at(-L, W, z1)], col, [0, 0, 1]);
}

/** A box between two points (a beam or a sloping rod), square section `half`. */
function beam(m: MeshArrays, a: V3, b: V3, half: number, col: RGB): void {
  const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], l = Math.hypot(d[0], d[1], d[2]) || 1, t = d.map(x => x / l);
  // Two unit vectors across the beam.
  const up: V3 = Math.abs(t[2]) > 0.9 ? [1, 0, 0] : [0, 0, 1];
  const s1: V3 = [t[1] * up[2] - t[2] * up[1], t[2] * up[0] - t[0] * up[2], t[0] * up[1] - t[1] * up[0]], l1 = Math.hypot(...s1);
  const e1 = s1.map(x => x / l1 * half) as V3;
  const e2 = [t[1] * e1[2] - t[2] * e1[1], t[2] * e1[0] - t[0] * e1[2], t[0] * e1[1] - t[1] * e1[0]] as V3;
  const P = (p: V3, i: number, j: number): V3 => [p[0] + e1[0] * i + e2[0] * j, p[1] + e1[1] * i + e2[1] * j, p[2] + e1[2] * i + e2[2] * j];
  for (const [i0, j0, i1, j1, w] of [[1, -1, 1, 1, e1], [-1, -1, -1, 1, e1.map(x => -x)], [-1, 1, 1, 1, e2], [-1, -1, 1, -1, e2.map(x => -x)]] as [number, number, number, number, number[]][]) {
    face(m, [P(a, i0, j0), P(a, i1, j1), P(b, i1, j1), P(b, i0, j0)], col, w as V3);
  }
}

export interface RailingStyle { plinth: RGB; plinthHeight: number; railing: RGB }

/**
 * Post-and-rail along an edge: `line` is the deck edge, `out` the outward unit
 * normal per point, `z` the deck top per point. A plinth (edge beam or masonry
 * parapet) of RAILING.plinthWidth inward from the edge, posts every
 * RAILING.postStep, a top rail and a mid rail.
 */
export function railing(m: MeshArrays, line: readonly Vec2[], out: readonly Vec2[], z: readonly number[], style: RailingStyle): { posts: number } {
  const n = line.length;
  if (n < 2) return { posts: 0 };
  const W = RAILING.plinthWidth, H = RAILING.height, ins = RAILING.inset;
  const P = (k: number, off: number): Vec2 => [line[k][0] - out[k][0] * off, line[k][1] - out[k][1] * off];
  for (let k = 0; k + 1 < n; k++) {
    const o: V3 = [out[k][0] + out[k + 1][0], out[k][1] + out[k + 1][1], 0];
    const a0 = P(k, 0), a1 = P(k + 1, 0), b0 = P(k, W), b1 = P(k + 1, W);
    const za = z[k], zb = z[k + 1], ha = za + style.plinthHeight, hb = zb + style.plinthHeight;
    // Plinth: outer face down to the deck bottom edge is the fascia's job; here top, outer and inner faces.
    face(m, [[a0[0], a0[1], za - 0.05], [a1[0], a1[1], zb - 0.05], [a1[0], a1[1], hb], [a0[0], a0[1], ha]], style.plinth, o);
    face(m, [[b0[0], b0[1], za], [b1[0], b1[1], zb], [b1[0], b1[1], hb], [b0[0], b0[1], ha]], style.plinth, [-o[0], -o[1], 0]);
    face(m, [[a0[0], a0[1], ha], [a1[0], a1[1], hb], [b1[0], b1[1], hb], [b0[0], b0[1], ha]], style.plinth, [0, 0, 1]);
    // Rails over the plinth's middle.
    for (const [lvl, half] of [[H, RAILING.rail / 2], [style.plinthHeight + (H - style.plinthHeight) * 0.45, RAILING.rail / 3]] as const) {
      const c0 = P(k, W / 2 - ins), c1 = P(k + 1, W / 2 - ins);
      beam(m, [c0[0], c0[1], za + lvl], [c1[0], c1[1], zb + lvl], half, style.railing);
    }
  }
  // Posts at even spacing along the line (and at both ends).
  const st = [0];
  for (let k = 1; k < n; k++) st.push(st[k - 1] + Math.hypot(line[k][0] - line[k - 1][0], line[k][1] - line[k - 1][1]));
  const total = st[n - 1], count = Math.max(1, Math.round(total / RAILING.postStep));
  let posts = 0;
  for (let i = 0; i <= count; i++) {
    const s = total * i / count;
    let k = 1; while (k < n - 1 && st[k] < s) k++;
    const t = Math.max(0, Math.min(1, (s - st[k - 1]) / ((st[k] - st[k - 1]) || 1)));
    const lerp = (a: number, b: number) => a + (b - a) * t;
    const ox = lerp(out[k - 1][0], out[k][0]), oy = lerp(out[k - 1][1], out[k][1]), ol = Math.hypot(ox, oy) || 1;
    const c: Vec2 = [lerp(line[k - 1][0], line[k][0]) - ox / ol * (W / 2 - ins), lerp(line[k - 1][1], line[k][1]) - oy / ol * (W / 2 - ins)];
    const zz = lerp(z[k - 1], z[k]);
    box(m, c, [oy / ol, -ox / ol], RAILING.post / 2, RAILING.post / 2, zz + style.plinthHeight - 0.02, zz + H, style.railing);
    posts++;
  }
  return { posts };
}

/** What one measured deck drew (named regressions and the lane report). */
export interface DeckBuildInfo { id: string; railingPosts: number; piers: number; arches: number; abutments: number; topRows: number }

/**
 * One measured deck. `ground` is the relief without decks (for burying the
 * abutment walls), `waterZ` the canal level, `height` the riding surface (the
 * deck top and the tops of the side faces follow it exactly).
 */
export function measuredDeckBody(deck: DeckSurface, ground: HeightFn, overWater: WaterTest, waterZ: number, height?: HeightFn, info?: DeckBuildInfo[]): MeshArrays {
  const m = emptyMesh(true), p = deck.profile, fam = FAMILY[p.family] ?? FAMILY['concrete-deck'];
  const idx: number[] = [];
  for (let i = 0; i < p.s.length; i++) if (p.s[i] >= p.deck[0] - 0.5 && p.s[i] <= p.deck[1] + 0.5) idx.push(i);
  if (idx.length < 2) return m;
  const stats: DeckBuildInfo = { id: p.id, railingPosts: 0, piers: 0, arches: 0, abutments: 0, topRows: idx.length };
  const onDeck = (s: number) => s >= p.deck[0] && s <= p.deck[1];
  type Row = { s: number; c: Vec2; n: Vec2; L: Vec2; R: Vec2; z: number; zL: number; zR: number; water: boolean; parapet: boolean };
  const rows: Row[] = idx.map(i => {
    const a = Math.max(0, i - 1), b = Math.min(p.s.length - 1, i + 1), dx = p.x[b] - p.x[a], dy = p.y[b] - p.y[a], l = Math.hypot(dx, dy) || 1;
    const n: Vec2 = [-dy / l, dx / l], hw = p.halfWidth[i];
    const L: Vec2 = [p.x[i] + n[0] * hw, p.y[i] + n[1] * hw], R: Vec2 = [p.x[i] - n[0] * hw, p.y[i] - n[1] * hw];
    const z = deck.z[i];
    return { s: p.s[i], c: [p.x[i], p.y[i]], n, L, R, z, zL: height ? height(L[0], L[1]) : z, zR: height ? height(R[0], R[1]) : z, water: overWater(p.x[i], p.y[i]), parapet: onDeck(p.s[i]) };
  });

  // Water runs along the axis (centreline over water), and their bays.
  const runs: [number, number][] = [];
  for (let k = 0; k < rows.length; k++) {
    if (!rows[k].water) continue;
    if (runs.length && runs[runs.length - 1][1] === k - 1) runs[runs.length - 1][1] = k; else runs.push([k, k]);
  }
  type Bay = { s0: number; s1: number; spring: number; crown: number };
  const bays: Bay[] = [], piers: number[] = [];
  const zAtS = (s: number) => { let k = 0; while (k < rows.length - 1 && rows[k].s < s) k++; return rows[k].z; };
  const arched = p.family === 'masonry-arch';
  // Bays over the profile's measured water span where it has one (the pipeline's AHN water), else the mask's runs.
  const spans: [number, number][] = p.water ? [[Math.max(p.water[0], rows[0].s), Math.min(p.water[1], rows[rows.length - 1].s)]] : runs.map(([k0, k1]) => [rows[k0].s, rows[k1].s]);
  for (const [w0, w1] of spans) {
    const span = w1 - w0;
    if (span < 1.5) continue;
    const nb = span > PIER_SPAN_M ? Math.max(2, Math.min(7, Math.round(span / BAY_M))) : 1;
    for (let j = 1; j < nb; j++) piers.push(w0 + span * j / nb);
    if (!arched) continue;
    for (let j = 0; j < nb; j++) {
      const s0 = w0 + span * j / nb + (j > 0 ? PIER_LEN / 2 : 0.3), s1 = w0 + span * (j + 1) / nb - (j < nb - 1 ? PIER_LEN / 2 : 0.3);
      const crown = zAtS((s0 + s1) / 2) - fam.thickness - 0.15, spring = waterZ + 0.35;
      if (s1 - s0 > 1.5 && crown - spring > 0.5) bays.push({ s0, s1, spring, crown });
    }
  }
  stats.arches = bays.length;
  const archZ = (s: number): number | null => {
    for (const a of bays) {
      if (s <= a.s0 || s >= a.s1) continue;
      const u = (s - (a.s0 + a.s1) / 2) / ((a.s1 - a.s0) / 2);
      return a.spring + (a.crown - a.spring) * Math.sqrt(Math.max(0, 1 - u * u));
    }
    return null;
  };
  // Over water: the vault where a bay is, spandrel/pier masonry down to the water between bays, else the deck soffit.
  const underAt = (s: number, z: number) => archZ(s) ?? (bays.length ? waterZ - 0.2 : z - fam.thickness);

  // Side faces: left faces left (outward), right faces right.
  for (let k = 0; k + 1 < rows.length; k++) {
    const a = rows[k], b = rows[k + 1];
    for (const side of [1, -1] as const) {
      const pa = side > 0 ? a.L : a.R, pb = side > 0 ? b.L : b.R, za = side > 0 ? a.zL : a.zR, zb = side > 0 ? b.zL : b.zR;
      const wa = overWater(pa[0], pa[1]), wb = overWater(pb[0], pb[1]);
      const bottom = (q: Vec2, w: boolean, s: number, z: number) => (w ? Math.min(underAt(s, z), z - 0.1) : Math.min(ground(q[0], q[1]), z) - BURY);
      const col = wa || wb ? fam.fascia : ABUTMENT;
      const o: V3 = [(a.n[0] + b.n[0]) * side, (a.n[1] + b.n[1]) * side, 0];
      face(m, [[pa[0], pa[1], za], [pb[0], pb[1], zb], [pb[0], pb[1], bottom(pb, wb, b.s, zb)], [pa[0], pa[1], bottom(pa, wa, a.s, za)]], col, o);
    }
    if (a.water && b.water) {
      // Soffit / vault facing down.
      const zA = underAt(a.s, a.z), zB = underAt(b.s, b.z);
      if (!bays.length || archZ(a.s) !== null || archZ(b.s) !== null) face(m, [[a.L[0], a.L[1], zA], [a.R[0], a.R[1], zA], [b.R[0], b.R[1], zB], [b.L[0], b.L[1], zB]], SOFFIT, [0, 0, -1]);
    }
  }

  // Abutments: at each land/water change along the axis (and at a deck end still over water), a wall across
  // the deck from its top down past the water, facing the water.
  const changes: { land: Row; toWater: 1 | -1 }[] = [];
  for (let k = 0; k + 1 < rows.length; k++) if (rows[k].water !== rows[k + 1].water) changes.push(rows[k].water ? { land: rows[k + 1], toWater: -1 } : { land: rows[k], toWater: 1 });
  if (rows[0].water) changes.push({ land: rows[0], toWater: 1 });
  if (rows[rows.length - 1].water) changes.push({ land: rows[rows.length - 1], toWater: -1 });
  for (const { land, toWater } of changes) {
    const u: Vec2 = [land.n[1], -land.n[0]]; // along the axis (+s)
    const ext = 0.4, top = Math.min(land.zL, land.zR) - 0.05, bot = waterZ - 0.4;
    const A: Vec2 = [land.L[0] + land.n[0] * ext, land.L[1] + land.n[1] * ext], B: Vec2 = [land.R[0] - land.n[0] * ext, land.R[1] - land.n[1] * ext];
    face(m, [[A[0], A[1], top], [B[0], B[1], top], [B[0], B[1], bot], [A[0], A[1], bot]], ABUTMENT, [u[0] * toWater, u[1] * toWater, 0]);
    stats.abutments++;
  }

  // Piers between the bays of a long span.
  for (const s of piers) {
    let k = 0; while (k < rows.length - 1 && rows[k].s < s) k++;
    const r = rows[k], hw = Math.hypot(r.L[0] - r.c[0], r.L[1] - r.c[1]);
    const top = r.z - fam.thickness + 0.02;
    box(m, r.c, [r.n[1], -r.n[0]], PIER_LEN / 2, hw + 0.2, waterZ - 0.5, top, arched ? ABUTMENT : PIER_STONE);
    stats.piers++;
  }

  // Railings on both edges of the deck span.
  const span = rows.filter(r => r.parapet);
  if (span.length >= 2) {
    const style: RailingStyle = { plinth: arched ? fam.parapet : fam.fascia, plinthHeight: fam.plinth, railing: fam.railing };
    stats.railingPosts += railing(m, span.map(r => r.L), span.map(r => r.n), span.map(r => r.zL), style).posts;
    stats.railingPosts += railing(m, span.map(r => r.R), span.map(r => [-r.n[0], -r.n[1]] as Vec2), span.map(r => r.zR), style).posts;
  }
  info?.push(stats);
  return m;
}

/**
 * The deck top of a measured deck: a strip over its footprint (the deck span
 * plus half a metre), draped on the riding surface, under every street band.
 */
export function measuredDeckTop(deck: DeckSurface, height: HeightFn, across = 6): MeshArrays {
  const m = emptyMesh(true), p = deck.profile;
  const idx: number[] = [];
  for (let i = 0; i < p.s.length; i++) if (p.s[i] >= p.deck[0] - 0.5 && p.s[i] <= p.deck[1] + 0.5) idx.push(i);
  if (idx.length < 2) return m;
  const J = Math.max(2, across), base = m.positions.length / 3;
  for (const i of idx) {
    const a = Math.max(0, i - 1), b = Math.min(p.s.length - 1, i + 1), dx = p.x[b] - p.x[a], dy = p.y[b] - p.y[a], l = Math.hypot(dx, dy) || 1;
    const nx = -dy / l, ny = dx / l, hw = p.halfWidth[i];
    for (let j = 0; j <= J; j++) {
      const t = hw * (1 - 2 * j / J), x = p.x[i] + nx * t, y = p.y[i] + ny * t;
      vertex(m, x, y, height(x, y) + DECK_TOP_LIFT, DECK_TOP);
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

/** Frame geometry of the movable-bridge unit, metres. */
export const FRAME = { postHeight: 6.2, post: 0.32, beamHeight: 0.42, maxLeaf: 9, doubleOver: 24 };

/**
 * A movable bridge's portal frame and balance beams (the Amsterdam ophaalbrug
 * "galg" and "hameien"), one shared unit: two posts either side of the deck,
 * a cross beam on top, a balance beam along each side over the leaf with its
 * counterweight box behind the posts and pull rods down to the leaf's tip.
 * Footprints longer than FRAME.doubleOver get two units facing each other (a
 * double bascule like the Magere Brug).
 */
export function movableFrame(ring: readonly Vec2[], height: HeightFn, ways: readonly (readonly Vec2[])[] = [], topLift = 0.02): { mesh: MeshArrays; units: number } {
  const m = emptyMesh(true), ax = footprintAxis(ring, ways), { u } = ax, v: Vec2 = [-u[1], u[0]];
  const length = ax.along[1] - ax.along[0], half = Math.max(1.5, (ax.across[1] - ax.across[0]) / 2), mid = (ax.along[0] + ax.along[1]) / 2, vc = (ax.across[0] + ax.across[1]) / 2;
  const P = (a: number, b: number): Vec2 => [ax.centre[0] + u[0] * a + v[0] * b, ax.centre[1] + u[1] * a + v[1] * b];
  const double = length > FRAME.doubleOver;
  // A double bascule's two leaves meet over the middle (the Magere Brug's are ~5 m each).
  const leaf = double ? Math.min(5, Math.max(3, length * 0.15)) : Math.min(FRAME.maxLeaf, Math.max(3, length * 0.45));
  // Single: posts at one end of the leaf, beams over it toward the other end. Double: two units, beams meeting over the middle.
  const units: { at: number; dir: 1 | -1 }[] = double ? [{ at: mid - leaf, dir: 1 }, { at: mid + leaf, dir: -1 }] : [{ at: mid - leaf / 2, dir: 1 }];
  const H = FRAME.postHeight, Ph = FRAME.post / 2, Bh = FRAME.beamHeight;
  for (const { at, dir } of units) {
    const side = [vc + half + 0.45, vc - half - 0.45];
    const base = Math.min(...side.map(b => { const q = P(at, b); return height(q[0], q[1]); })) + topLift;
    for (const b of side) {
      const q = P(at, b);
      box(m, q, u, Ph, Ph, base - 0.3, base + 0.7, FRAME_DARK);
      box(m, q, u, Ph * 0.85, Ph * 0.85, base + 0.7, base + H, FRAME_WHITE);
      // Balance beam over the post, from the counterweight to the leaf tip, slightly falling toward the tip.
      const back = P(at - dir * 2.6, b), tip = P(at + dir * leaf, b);
      beam(m, [back[0], back[1], base + H + Bh * 0.5 + 0.25], [tip[0], tip[1], base + H + Bh * 0.5 - 0.35], Bh / 2, FRAME_WHITE);
      // Pull rod from the beam's tip down to the leaf.
      const rodTop: V3 = [tip[0], tip[1], base + H - 0.35], rodFoot = P(at + dir * leaf, b - Math.sign(b - vc) * 0.35);
      beam(m, rodTop, [rodFoot[0], rodFoot[1], height(rodFoot[0], rodFoot[1]) + topLift + 0.1], 0.05, FRAME_DARK);
    }
    // Cross beam on the posts, the beam joining the tips, and the counterweight box between the beams' back ends.
    const pl = P(at, side[0]), pr = P(at, side[1]);
    beam(m, [pl[0], pl[1], base + H - 0.2], [pr[0], pr[1], base + H - 0.2], 0.2, FRAME_WHITE);
    const tl = P(at + dir * leaf, side[0]), tr = P(at + dir * leaf, side[1]);
    beam(m, [tl[0], tl[1], base + H - 0.1], [tr[0], tr[1], base + H - 0.1], 0.12, FRAME_WHITE);
    const bl = P(at - dir * 2.3, side[0]), br = P(at - dir * 2.3, side[1]);
    beam(m, [bl[0], bl[1], base + H + 0.45], [br[0], br[1], base + H + 0.45], 0.28, FRAME_WHITE);
  }
  return { mesh: m, units: units.length };
}

/** An unmeasured footprint (CCW ring, scene coords): top draped on the surface, fascia and soffit over water, railings along the water. */
export function flatDeckBody(ring: readonly Vec2[], height: HeightFn, overWater: WaterTest, topLift = 0.02, thickness = 0.45, opts: { railings?: boolean; axis?: Vec2 } = {}): { top: MeshArrays; body: MeshArrays; railingPosts: number } {
  const top = emptyMesh(true), body = emptyMesh(true);
  const flat = ring.flatMap(p => [p[0], p[1]]);
  const tris = earcut(flat);
  drapeTriangles(top, flat, tris, height, topLift, 3, DECK_TOP);
  // Soffit: same triangles, reversed, a deck thickness down.
  const under = emptyMesh(true);
  drapeTriangles(under, flat, tris, height, topLift - thickness, 3, SOFFIT);
  for (let i = 0; i < under.indices.length; i += 3) [under.indices[i + 1], under.indices[i + 2]] = [under.indices[i + 2], under.indices[i + 1]];
  const base = body.positions.length / 3;
  body.positions.push(...under.positions); body.uvs.push(...under.uvs); body.colors!.push(...under.colors!);
  for (const i of under.indices) body.indices.push(i + base);
  const closed = [...ring, ring[0]];
  const pts = densify(closed, 1);
  // Runs of the edge over water get the fascia and (by default) a railing.
  // Railings only on edges along the crossing (an edge across it is where the road runs on and off).
  const axis = opts.axis ?? footprintAxis(ring).u;
  const runs: Vec2[][] = [];
  let run: Vec2[] | null = null;
  for (let i = 0; i + 1 < pts.length; i++) {
    const a = pts[i], b = pts[i + 1], mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
    if (!overWater(mx, my)) { run = null; continue; }
    const el = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, along = Math.abs(((b[0] - a[0]) * axis[0] + (b[1] - a[1]) * axis[1]) / el) > 0.8;
    if (!along) run = null;
    else { if (!run) { run = [a]; runs.push(run); } run.push(b); }
    const ha = height(a[0], a[1]) + topLift, hb = height(b[0], b[1]) + topLift, c = ABUTMENT.map(v => v * 0.8) as RGB;
    const t0 = vertex(body, a[0], a[1], ha, c), t1 = vertex(body, b[0], b[1], hb, c), b1 = vertex(body, b[0], b[1], hb - thickness, c), b0 = vertex(body, a[0], a[1], ha - thickness, c);
    // CCW ring: outward is the right of a→b.
    quad(body, t0, b0, b1, t1);
  }
  let railingPosts = 0;
  if (opts.railings !== false) {
    for (const r of runs) {
      if (r.length < 3) continue;
      const out: Vec2[] = r.map((_, k) => {
        const a = r[Math.max(0, k - 1)], b = r[Math.min(r.length - 1, k + 1)], dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1;
        return [dy / l, -dx / l];
      });
      railingPosts += railing(body, r, out, r.map(q => height(q[0], q[1]) + topLift), { plinth: FAMILY['steel-deck'].parapet, plinthHeight: 0.12, railing: RAILING_GREEN }).posts;
    }
  }
  return { top, body, railingPosts };
}
