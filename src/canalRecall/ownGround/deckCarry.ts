// Road surfaces carried across bridges (lane R5-C1, issue #262; user aerial shots 2026-11-08: "missing continuity at
// bridges, looks chaotic, grey clipping through red").
//
// Measured on main ff96ebd7f (probe-bridge-roads.ts, issue #262 step 1): at the Kattenburgerbrug and the Prins
// Hendrikkade bridge over the Schippersgracht the pale band across the carriageway and the red at each abutment is the
// survey's own ground-level polygons (h = 0: the quay footways that pass under the abutment) drawn at the sidewalk top
// (+0.14 m) over the deck polygons (h >= 1, +0.03 / +0.04 m) in the same plan position. On a flat (unmeasured) footprint
// the deck surface is the land, so the footway under the bridge wins by its lift; and where every triangle of a deck
// polygon lies over such a footway, bridgeGaps' deckShare dropped them all and the polygon was skipped (9 of 17 at
// BRU0487). From the air and from the saddle the deck is the surface: the space under a bridge is not modelled.
//
// The rule (`?bridgeCarry=0` restores the build before it):
//   - a deck polygon that sits LOW over the ground polygons it overlaps (the riding surface within CARRY_RISE_M of the
//     land there) is drawn whole on the riding surface, and the ground polygons under it are cut out of their own
//     polygons (a polygon difference) with their kerb runs, so one surface shows: the deck's;
//   - a deck polygon that would be skipped (over no deck, no water, no flat footprint) is still drawn when it lies at
//     a bridge (water within CARRY_NEAR_WATER_M of it), on the riding surface;
//   - a deck polygon well above the ground under it (a real overpass) keeps the bridgeGaps rule: the street under it stays.
// Pure; roadSurfaces.ts calls it per cell, the decisions are the same for a polygon in every cell that sees it.
import polygonClipping, { type MultiPolygon, type Polygon } from 'polygon-clipping';
import type { HeightFn, Vec2 } from './surface.js';

/** A deck polygon whose riding surface lies within this of the land under it competes with the ground polygons there. */
export const CARRY_RISE_M = 1.0;
/** A deck polygon over no deck, no water and no flat footprint is carried when water lies within this (a bridge's end). */
export const CARRY_NEAR_WATER_M = 12;
/** Ground pieces left by the cut smaller than this (m²) are dropped (slivers along the deck's edge). */
export const CARRY_MIN_PIECE_M2 = 0.05;

/** What the carry needs of the road index (RoadIndex satisfies it). */
export interface CarryIndex {
  readonly records: readonly { h: number }[];
  ringsOf(k: number): readonly (readonly Vec2[])[];
  flatOf(k: number): { flat: readonly number[]; tris: readonly number[] };
  findAll(x: number, y: number): number[];
}

export interface CarryInput {
  /** The land surface the ground polygons drape on. */
  land: HeightFn;
  /** The riding surface with the decks (deckLevelHeight). */
  deck: HeightFn;
  /** Over mapped water. */
  overWater: (x: number, y: number) => boolean;
  /** The existing test: is this point carried by a measured deck, water or a flat footprint (roadSurfaces deckSurface)? */
  carried: (x: number, y: number) => boolean;
}

export interface DeckDecision {
  /** Draw the polygon (on the riding surface). */
  draw: boolean;
  /** Draw all its triangles (no bridgeGaps deckShare drop): it is low, the ground under it is cut instead. */
  whole: boolean;
  /** It lies low over ground polygons: they are cut under it. */
  low: boolean;
  /** Drawn only because of the carry (it was skipped before). */
  carriedOnly: boolean;
}

/** Is water within `r` of any vertex of the polygon's outer ring (8 directions)? */
export function nearWater(ring: readonly Vec2[], overWater: (x: number, y: number) => boolean, r = CARRY_NEAR_WATER_M): boolean {
  const dirs: Vec2[] = [];
  for (let i = 0; i < 8; i++) dirs.push([Math.cos(i * Math.PI / 4), Math.sin(i * Math.PI / 4)]);
  for (const p of ring) {
    if (overWater(p[0], p[1])) return true;
    for (const f of [r / 2, r]) for (const d of dirs) if (overWater(p[0] + d[0] * f, p[1] + d[1] * f)) return true;
  }
  return false;
}

/**
 * The carry's decision for deck polygon `k` (h >= 1): `drawnBefore` is what the build without the carry decided
 * (drawn, possibly with triangles dropped over ground polygons).
 */
export function deckDecision(index: CarryIndex, k: number, input: CarryInput, drawnBefore: boolean): DeckDecision {
  const rises = overlapRises(index, k, input);
  rises.sort((a, b) => a - b);
  // Low: three quarters of the overlap within CARRY_RISE_M of the land (a hump's crown may rise past it).
  const low = rises.length > 0 && rises[Math.floor(0.75 * (rises.length - 1))] < CARRY_RISE_M;
  if (drawnBefore) return { draw: true, whole: low, low, carriedOnly: false };
  const ring = index.ringsOf(k)[0] ?? [];
  // Skipped before: carried when it is low over the ground there, or when it lies at a bridge.
  if (low || (ring.length >= 3 && nearWater(ring, input.overWater))) return { draw: true, whole: true, low, carriedOnly: true };
  return { draw: false, whole: false, low: false, carriedOnly: false };
}

/** Sample spacing (m) over a deck polygon; coarser on large polygons (at most ~CARRY_MAX_SAMPLES points). */
export const CARRY_SAMPLE_M = 0.5, CARRY_MAX_SAMPLES = 2000;

/**
 * The riding surface's rise over the land at the points of deck polygon `k` that lie over a ground polygon (h = 0), on
 * a grid (earcut's centroids miss the overlap of a long thin polygon: the Kattenburgerbrug's fietspad, 0 of its
 * centroids over the footway its abutment covers).
 */
export function overlapRises(index: CarryIndex, k: number, input: Pick<CarryInput, 'land' | 'deck'>): number[] {
  const ring = index.ringsOf(k)[0] ?? [];
  if (ring.length < 3) return [];
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const p of ring) { x0 = Math.min(x0, p[0]); y0 = Math.min(y0, p[1]); x1 = Math.max(x1, p[0]); y1 = Math.max(y1, p[1]); }
  const step = Math.max(CARRY_SAMPLE_M, Math.sqrt((x1 - x0) * (y1 - y0) / CARRY_MAX_SAMPLES));
  const out: number[] = [];
  for (let x = x0 + step / 2; x < x1; x += step) for (let y = y0 + step / 2; y < y1; y += step) {
    const all = index.findAll(x, y);
    if (!all.includes(k) || !all.some(j => index.records[j].h === 0)) continue;
    out.push(input.deck(x, y) - input.land(x, y));
  }
  return out;
}

/** Ring list → polygon-clipping polygon (closed rings). */
const asPolygon = (rings: readonly (readonly Vec2[])[]): Polygon => rings.map(r => {
  const pts = r.map(p => [p[0], p[1]] as [number, number]);
  if (pts.length && (pts[0][0] !== pts[pts.length - 1][0] || pts[0][1] !== pts[pts.length - 1][1])) pts.push([pts[0][0], pts[0][1]]);
  return pts;
});

const ringArea = (r: readonly (readonly number[])[]): number => {
  let a = 0;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) a += (r[j][0] + r[i][0]) * (r[j][1] - r[i][1]);
  return Math.abs(a) / 2;
};

/**
 * Ground polygon `rings` minus the deck polygons `cutters` (rings each). Returns the pieces as ring lists (outer first,
 * then holes; open rings), or null when nothing was cut (draw the polygon as it is).
 */
export function cutUnderDecks(rings: readonly (readonly Vec2[])[], cutters: readonly (readonly (readonly Vec2[])[])[]): Vec2[][][] | null {
  if (!cutters.length || !rings.length) return null;
  let out: MultiPolygon;
  try { out = polygonClipping.difference(asPolygon(rings), ...cutters.map(asPolygon)); } catch { return null; }
  const before = ringArea(rings[0]) - rings.slice(1).reduce((s, r) => s + ringArea(r), 0);
  const after = out.reduce((s, p) => s + ringArea(p[0]) - p.slice(1).reduce((t, r) => t + ringArea(r), 0), 0);
  if (Math.abs(before - after) < 1e-3) return null;
  return out.filter(p => ringArea(p[0]) >= CARRY_MIN_PIECE_M2).map(p => p.map(r => r.slice(0, -1).map(q => [q[0], q[1]] as Vec2)));
}

/** Split a polyline into the runs whose points lie outside `under` (a kerb under a carried deck is not drawn). */
export function runsOutside(run: readonly Vec2[], under: (x: number, y: number) => boolean, step = 0.5): Vec2[][] {
  if (!run.some((p, i) => under(p[0], p[1]) || (i > 0 && under((p[0] + run[i - 1][0]) / 2, (p[1] + run[i - 1][1]) / 2)))) {
    // Nothing under a deck at the vertices and midpoints: the run as it is (the same vertices as without the carry).
    let hit = false;
    for (let i = 1; i < run.length && !hit; i++) {
      const q = run[i - 1], p = run[i], n = Math.max(1, Math.ceil(Math.hypot(p[0] - q[0], p[1] - q[1]) / step));
      for (let s = 1; s < n && !hit; s++) hit = under(q[0] + (p[0] - q[0]) * s / n, q[1] + (p[1] - q[1]) * s / n);
    }
    if (!hit) return [run.map(p => [p[0], p[1]] as Vec2)];
  }
  const out: Vec2[][] = [];
  let cur: Vec2[] = [];
  const flush = () => { if (cur.length >= 2) out.push(cur); cur = []; };
  for (let i = 0; i < run.length; i++) {
    const p = run[i];
    if (i > 0) {
      const q = run[i - 1], len = Math.hypot(p[0] - q[0], p[1] - q[1]), n = Math.max(1, Math.ceil(len / step));
      for (let s = 1; s < n; s++) {
        const x = q[0] + (p[0] - q[0]) * s / n, y = q[1] + (p[1] - q[1]) * s / n;
        if (under(x, y)) flush(); else cur.push([x, y]);
      }
    }
    if (under(p[0], p[1])) flush(); else cur.push([p[0], p[1]]);
  }
  flush();
  return out;
}
