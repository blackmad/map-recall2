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
//   - a deck polygon that would be skipped (every triangle over a ground polygon) is drawn when it is low there;
//   - only a bridge's deck polygons (part of them on a measured deck, a flat footprint or water): an elevated station
//     deck with nothing modelled under it (the Centraal IJ-side bus station) stays as it was;
//   - a deck polygon well above the ground under it (a real overpass) keeps the bridgeGaps rule: the street under it stays.
// Pure; roadSurfaces.ts calls it per cell, the decisions are the same for a polygon in every cell that sees it.
import polygonClipping, { type MultiPolygon, type Polygon } from 'polygon-clipping';
import type { HeightFn, Vec2 } from './surface.js';

/** A deck polygon whose riding surface lies within this of the land under it competes with the ground polygons there. */
export const CARRY_RISE_M = 1.0;
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

/**
 * The carry's decision for deck polygon `k` (h >= 1): `drawnBefore` is what the build without the carry decided
 * (drawn, possibly with triangles dropped over ground polygons).
 */
export function deckDecision(index: CarryIndex, k: number, input: CarryInput, drawnBefore: boolean): DeckDecision {
  const { rises, onDeck } = overlapRises(index, k, input);
  // Only a bridge's deck polygons: part of it on a measured deck, a flat footprint or water. An elevated plaza or a
  // station deck with no deck modelled under it (the Centraal IJ-side bus station, h = 1 over De Ruijterkade) is left
  // as it was: drawn at ground level it would cut the streets under it.
  if (!onDeck) return drawnBefore ? { draw: true, whole: false, low: false, carriedOnly: false } : { draw: false, whole: false, low: false, carriedOnly: false };
  rises.sort((a, b) => a - b);
  // Low: three quarters of the overlap within CARRY_RISE_M of the land (a hump's crown may rise past it).
  const low = rises.length > 0 && rises[Math.floor(0.75 * (rises.length - 1))] < CARRY_RISE_M;
  if (drawnBefore) return { draw: true, whole: low, low, carriedOnly: false };
  // Skipped before (every triangle over a ground polygon): carried when it is low over the ground there.
  if (low) return { draw: true, whole: true, low, carriedOnly: true };
  return { draw: false, whole: false, low: false, carriedOnly: false };
}

/** Sample spacing (m) over a deck polygon; coarser on large polygons (at most ~CARRY_MAX_SAMPLES points). */
export const CARRY_SAMPLE_M = 0.5, CARRY_MAX_SAMPLES = 400;

/**
 * The riding surface's rise over the land at the points of deck polygon `k` that lie over a ground polygon (h = 0), on
 * a grid (earcut's centroids miss the overlap of a long thin polygon: the Kattenburgerbrug's fietspad, 0 of its
 * centroids over the footway its abutment covers).
 */
export function overlapRises(index: CarryIndex, k: number, input: Pick<CarryInput, 'land' | 'deck' | 'carried'>): { rises: number[]; onDeck: boolean } {
  const ring = index.ringsOf(k)[0] ?? [];
  if (ring.length < 3) return { rises: [], onDeck: false };
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const p of ring) { x0 = Math.min(x0, p[0]); y0 = Math.min(y0, p[1]); x1 = Math.max(x1, p[0]); y1 = Math.max(y1, p[1]); }
  const step = Math.max(CARRY_SAMPLE_M, Math.sqrt((x1 - x0) * (y1 - y0) / CARRY_MAX_SAMPLES));
  const out: number[] = [];
  let onDeck = false;
  for (let x = x0 + step / 2; x < x1; x += step) for (let y = y0 + step / 2; y < y1; y += step) {
    const all = index.findAll(x, y);
    if (!all.includes(k)) continue;
    if (!onDeck && input.carried(x, y)) onDeck = true;
    if (!all.some(j => index.records[j].h === 0)) continue;
    out.push(input.deck(x, y) - input.land(x, y));
  }
  return { rises: out, onDeck };
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

/**
 * Split a polyline into the runs whose points lie outside `under` (a kerb under a carried deck is not drawn). The runs
 * keep the polyline's own vertices plus one point at each crossing (found every `step` metres), so a kerb is no denser
 * than before; a run never under is returned as it is.
 */
export function runsOutside(run: readonly Vec2[], under: (x: number, y: number) => boolean, step = 0.5): Vec2[][] {
  const out: Vec2[][] = [];
  let cur: Vec2[] = [], hit = false;
  const flush = () => { if (cur.length >= 2) out.push(cur); cur = []; };
  let inside = run.length ? under(run[0][0], run[0][1]) : false;
  if (inside) hit = true; else if (run.length) cur.push([run[0][0], run[0][1]]);
  for (let i = 1; i < run.length; i++) {
    const q = run[i - 1], p = run[i], n = Math.max(1, Math.ceil(Math.hypot(p[0] - q[0], p[1] - q[1]) / step));
    let last: Vec2 = [q[0], q[1]];
    for (let s = 1; s <= n; s++) {
      const pt: Vec2 = s === n ? [p[0], p[1]] : [q[0] + (p[0] - q[0]) * s / n, q[1] + (p[1] - q[1]) * s / n];
      const now = under(pt[0], pt[1]);
      if (now !== inside) {
        hit = true;
        if (now) { cur.push(last); flush(); } else cur.push(pt);
        inside = now;
      } else if (!now && s === n) cur.push(pt);
      last = pt;
    }
  }
  flush();
  if (!hit) return [run.map(p => [p[0], p[1]] as Vec2)];
  // A crossing point equal to the vertex before it (a crossing at a vertex) is not a second vertex.
  return out.map(r => r.filter((p, i) => i === 0 || p[0] !== r[i - 1][0] || p[1] !== r[i - 1][1])).filter(r => r.length >= 2);
}
