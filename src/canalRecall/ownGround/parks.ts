// Parks on the own ground (pure, DOM-free; built in the ground worker).
// docs/handoffs/lane-parks-20261013.md.
//
// A park used to be one flat green (the OSM `leisure=park` area) with the
// tree inventory scattered on it. The parks-v1 extract
// (scripts/own-ground/fetch-bgt-parks.ts) carries, per 1 km cell, what the
// city surveyed inside OSM parks, public gardens and playgrounds:
//
//   surfaces   BGT polygons: lawn, planting beds, shrub planting, bark, play
//              sand, half-paved (gravel) and closed (asphalt) paths, tiled
//              paving, red cycle paths, ponds
//   hedges     BGT `vegetatieobject` haag polygons and OSM `barrier=hedge`
//   lines      BGT `scheiding` hek/muur and OSM `barrier=fence|wall`
//   points     BGT light masts, OSM benches and playground equipment, plus
//              benches and a playground kit placed by measured rules where
//              the data has none (`gen: 1`, so a review can tell them apart)
//   dropWays   OSM path ways a BGT path polygon covers (the survey's width
//              and surface replace the drawn band)
//
// Surfaces are drawn only from features the extractor kept inside a park, at
// lifts between the OSM area (0.015) and the carriageway (0.03), so a street
// band always wins and a park never paints over a street.

import earcut from 'earcut';
import { emptyMesh, vertex, type MeshArrays } from './drape.js';
import type { HeightFn, Vec2 } from './surface.js';

/**
 * Geometry in the cell file is in the game's local frame (groundStore toLocal, metres east/north of 4.9 E
 * 52.37 N) as whole decimetres, each polyline delta-encoded: [x0, y0, dx1, dy1, ...]. Half the size of
 * lng/lat floats after gzip, and what the worker draws in anyway.
 */
export type EncodedLine = number[];

export type ParkSurface = 'lawn' | 'bed' | 'shrub' | 'bark' | 'sand' | 'gravel' | 'path' | 'paving' | 'cycle' | 'pond';
export type ParkLineKind = 'hedge' | 'fence' | 'wall';
export type ParkPointKind = 'bench' | 'lamp' | 'swing' | 'slide' | 'sandpit' | 'climb' | 'seesaw' | 'springy' | 'playhouse' | 'structure';

export interface ParksCell {
  version: 2;
  key: string;
  /** Parks, gardens and playgrounds whose bbox centre lies in this cell (diagnostics, the review report). */
  parks: { id: string; name?: string; kind: 'park' | 'garden' | 'playground' }[];
  surfaces: { k: ParkSurface; r: EncodedLine[] }[];
  /** Hedge polygons (BGT haag) extruded whole. */
  hedges: EncodedLine[][];
  /** Hedge / fence / wall centrelines. */
  lines: { k: ParkLineKind; g: EncodedLine }[];
  /** `p`: decimetres, local frame; `a`: the way the thing faces (radians, 0 = east, CCW); `gen`: placed by rule, not mapped. */
  points: { k: ParkPointKind; p: [number, number]; a?: number; gen?: 1 }[];
  /** OSM path ways a BGT path polygon covers: not drawn as bands. */
  dropWays: number[];
}

/** Delta-encode a polyline (metres, local frame) as whole decimetres; consecutive duplicates dropped. */
export function encodeLine(pts: readonly Vec2[]): EncodedLine {
  const out: number[] = [];
  let px = 0, py = 0;
  for (const [x, y] of pts) {
    const qx = Math.round(x * 10), qy = Math.round(y * 10);
    if (out.length && qx === px && qy === py) continue;
    out.push(qx - px, qy - py); px = qx; py = qy;
  }
  return out;
}

export function decodeLine(e: readonly number[]): Vec2[] {
  const out: Vec2[] = [];
  let x = 0, y = 0;
  for (let i = 0; i + 1 < e.length; i += 2) { x += e[i]; y += e[i + 1]; out.push([x / 10, y / 10]); }
  return out;
}

export interface ParksManifest { version: 1; cells: string[]; fetched: string; attribution: string; report?: Record<string, unknown> }

// ------------------------------------------------------------------ classification (extractor)

/**
 * A BGT terrain polygon's park surface, or null when it is not drawn as one.
 * `begroeidterreindeel`: groenvoorziening with plus types gras → lawn,
 * heesters/bosplantsoen/struiken → shrub, planten/struikrozen/bodembedekkers → bed,
 * anything mentioning schors → bark; untyped groenvoorziening is grass in practice.
 * `onbegroeidterreindeel`: zand → sand, half verhard / onverhard → gravel,
 * gesloten → path, open → paving, erf (yards) → null.
 * `wegdeel`: only foot/cycle/bridle paths and pedestrian areas.
 * `waterdeel`: ponds.
 */
export function bgtParkSurface(collection: string, p: { fysiek_voorkomen?: string | null; plus_fysiek_voorkomen?: string | null; functie?: string | null }): ParkSurface | null {
  const fv = (p.fysiek_voorkomen ?? '').toLowerCase(), plus = (p.plus_fysiek_voorkomen ?? '').toLowerCase(), fn = (p.functie ?? '').toLowerCase();
  if (collection === 'begroeidterreindeel') {
    if (plus.includes('schors')) return 'bark';
    if (/heester|bosplantsoen|struiken|houtwal|haag/.test(plus) || /bos|struiken|houtwal/.test(fv)) return 'shrub';
    if (/planten|rozen|bodembedekker|bloem|vaste/.test(plus) || /heide|rietland|moeras/.test(fv)) return 'bed';
    return 'lawn';
  }
  if (collection === 'onbegroeidterreindeel') {
    if (fv === 'zand') return 'sand';
    if (fv === 'half verhard' || fv === 'onverhard') return 'gravel';
    if (fv === 'gesloten verharding') return 'path';
    if (fv === 'open verharding') return 'paving';
    return null;
  }
  if (collection === 'wegdeel') {
    if (!/^(voetpad|fietspad|ruiterpad|voetgangersgebied)/.test(fn)) return null;
    if (fv === 'half verhard' || fv === 'onverhard') return 'gravel';
    if (fn.startsWith('fietspad') && fv === 'gesloten verharding') return 'cycle';
    if (fv === 'gesloten verharding') return 'path';
    return 'paving';
  }
  if (collection === 'waterdeel') return 'pond';
  return null;
}

/** OSM `playground=*` value → the kit piece drawn. */
export function playgroundPiece(v: string | undefined): ParkPointKind | null {
  if (!v) return null;
  if (v === 'swing' || v === 'basketswing' || v === 'baby_swing') return 'swing';
  if (v === 'slide') return 'slide';
  if (v === 'sandpit') return 'sandpit';
  if (v === 'seesaw') return 'seesaw';
  if (v === 'springy') return 'springy';
  if (v === 'playhouse') return 'playhouse';
  if (v === 'climbingframe' || v === 'climbing_frame' || v === 'climbingwall' || v === 'horizontal_bar' || v === 'monkey_bars') return 'climb';
  if (['structure', 'balancebeam', 'trampoline', 'roundabout', 'zipwire', 'activitypanel', 'cushion'].includes(v)) return 'structure';
  return null;
}

// ------------------------------------------------------------------ geometry helpers (extractor and tests)

/** Even-odd point in a polygon given as rings (outer and holes, any order). */
export function inRings(rings: readonly (readonly Vec2[])[], x: number, y: number): boolean {
  let inside = false;
  for (const ring of rings) for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i], b = ring[j];
    if ((a[1] > y) !== (b[1] > y) && x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
  }
  return inside;
}

/** Distance from a point to a polyline / ring boundary. */
export function distToLine(pts: readonly Vec2[], x: number, y: number, closed = false): number {
  let best = Infinity;
  const n = pts.length, last = closed ? n : n - 1;
  for (let i = 0; i < last; i++) {
    const a = pts[i], b = pts[(i + 1) % n], dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy;
    const t = l2 ? Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / l2)) : 0;
    best = Math.min(best, Math.hypot(a[0] + t * dx - x, a[1] + t * dy - y));
  }
  return best;
}

/** A point surely inside a polygon: the centroid of its largest earcut triangle. */
export function interiorPoint(rings: readonly (readonly Vec2[])[]): Vec2 | null {
  const { flat, holes } = flatten(rings);
  const tris = earcut(flat, holes);
  let best = -1, out: Vec2 | null = null;
  for (let t = 0; t < tris.length; t += 3) {
    const a = tris[t] * 2, b = tris[t + 1] * 2, c = tris[t + 2] * 2;
    const area = Math.abs((flat[b] - flat[a]) * (flat[c + 1] - flat[a + 1]) - (flat[b + 1] - flat[a + 1]) * (flat[c] - flat[a])) / 2;
    if (area > best) { best = area; out = [(flat[a] + flat[b] + flat[c]) / 3, (flat[a + 1] + flat[b + 1] + flat[c + 1]) / 3]; }
  }
  return out;
}

/** Polygon area (outer minus holes, by earcut), square metres. */
export function polygonArea(rings: readonly (readonly Vec2[])[]): number {
  const { flat, holes } = flatten(rings);
  const tris = earcut(flat, holes);
  let s = 0;
  for (let t = 0; t < tris.length; t += 3) {
    const a = tris[t] * 2, b = tris[t + 1] * 2, c = tris[t + 2] * 2;
    s += Math.abs((flat[b] - flat[a]) * (flat[c + 1] - flat[a + 1]) - (flat[b + 1] - flat[a + 1]) * (flat[c] - flat[a])) / 2;
  }
  return s;
}

/** Rings (closed or not; the first is the outer) as earcut input. */
export function flatten(rings: readonly (readonly Vec2[])[]): { flat: number[]; holes: number[] } {
  const flat: number[] = [], holes: number[] = [];
  rings.forEach((r, i) => {
    const pts = r.length > 1 && r[0][0] === r[r.length - 1][0] && r[0][1] === r[r.length - 1][1] ? r.slice(0, -1) : r;
    if (i > 0) holes.push(flat.length / 2);
    for (const p of pts) flat.push(p[0], p[1]);
  });
  return { flat, holes };
}

/**
 * Bench spots along path centrelines every `spacing` metres (first at half a
 * spacing), set `offset` metres to the left of travel and facing the path.
 * `ok` vetoes a spot (outside the park, on a path or in a pond).
 */
export function benchesAlong(lines: readonly (readonly Vec2[])[], spacing: number, offset: number, ok: (x: number, y: number) => boolean): { p: Vec2; a: number }[] {
  const out: { p: Vec2; a: number }[] = [];
  for (const line of lines) {
    let next = spacing / 2, run = 0;
    for (let i = 1; i < line.length; i++) {
      const a = line[i - 1], b = line[i], len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (!len) continue;
      const ux = (b[0] - a[0]) / len, uy = (b[1] - a[1]) / len;
      while (next < run + len) {
        const t = next - run, x = a[0] + ux * t - uy * offset, y = a[1] + uy * t + ux * offset;
        // Facing the path: from the bench toward the line, i.e. to the right of travel.
        if (ok(x, y)) out.push({ p: [x, y], a: Math.atan2(-ux, uy) });
        next += spacing;
      }
      run += len;
    }
  }
  return out;
}

/**
 * The default playground kit (sandpit ring, swing, slide) inside a playground
 * polygon that maps no equipment: the sandpit at the point deepest inside,
 * the swing and slide at the next deepest spots at least 6 m from the others,
 * each at least `clear` metres inside the edge. `ok` vetoes spots (paths).
 * Returns fewer pieces when the playground is too small.
 */
export function playgroundKit(rings: readonly (readonly Vec2[])[], ok: (x: number, y: number) => boolean = () => true, clear = 2.2): { k: ParkPointKind; p: Vec2; a: number }[] {
  const outer = rings[0];
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of outer) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  const step = Math.max(1, Math.min(3, Math.sqrt((x1 - x0) * (y1 - y0)) / 30));
  const spots: { p: Vec2; d: number }[] = [];
  for (let y = y0 + step / 2; y < y1; y += step) for (let x = x0 + step / 2; x < x1; x += step) {
    if (!inRings(rings, x, y) || !ok(x, y)) continue;
    const d = Math.min(...rings.map(r => distToLine(r, x, y, true)));
    if (d >= clear) spots.push({ p: [x, y], d });
  }
  spots.sort((a, b) => b.d - a.d);
  // Long axis of the bbox: the swing's beam and the slide's run follow it.
  const a = x1 - x0 >= y1 - y0 ? 0 : Math.PI / 2;
  const kit: { k: ParkPointKind; p: Vec2; a: number }[] = [];
  for (const k of ['sandpit', 'swing', 'slide'] as const) {
    const need = k === 'sandpit' ? 2.6 : clear;
    const s = spots.find(s => s.d >= need && kit.every(q => Math.hypot(q.p[0] - s.p[0], q.p[1] - s.p[1]) >= 6));
    if (s) kit.push({ k, p: s.p, a });
  }
  return kit;
}

// ------------------------------------------------------------------ meshes (worker)

/**
 * Earcut triangles draped by longest-edge bisection until no edge exceeds
 * `maxEdge` (drape.ts drapeTriangles splits every triangle into n², which
 * on the long slivers earcut makes of park paths and pond banks cost 6-10x
 * the triangles: a Vondelpark cell went from 0.39 M to 0.80 M). Shared
 * vertices are reused per triangle; neighbours may meet at T-junctions a few
 * millimetres apart, hidden by the lawn and park fill beneath.
 *
 * `clearanceM` keeps a fill from sagging under the surface it covers: a plane
 * through three vertices of a crest of the 5 m land grid dips under the grid
 * between them (9 cm at p99, more on a canal bank), so the bare land poked
 * through the fill in beige specks. A triangle whose plane would sit more than
 * `clearanceM` under `height` at a land grid node inside it (within one grid
 * cell both are planes, so the deepest sag is at a node) is split further,
 * down to `minEdge`; only crests pay the extra triangles.
 */
export function drapeBisect(m: MeshArrays, coords: ArrayLike<number>, tris: ArrayLike<number>, height: HeightFn, lift: number, maxEdge: number, clearanceM?: number, minEdge = 1, landStep = 5): void {
  const max2 = maxEdge * maxEdge, min2 = Math.min(minEdge, maxEdge) ** 2;
  const stack: number[] = [];
  const sags = (x1: number, y1: number, x2: number, y2: number, x3: number, y3: number): boolean => {
    if (clearanceM === undefined) return false;
    const z1 = height(x1, y1), z2 = height(x2, y2), z3 = height(x3, y3);
    const d = (y2 - y3) * (x1 - x3) + (x3 - x2) * (y1 - y3);
    if (Math.abs(d) < 1e-12) return false;
    const u = (px: number, py: number) => ((y2 - y3) * (px - x3) + (x3 - x2) * (py - y3)) / d;
    const v = (px: number, py: number) => ((y3 - y1) * (px - x3) + (x1 - x3) * (py - y3)) / d;
    const plane = (px: number, py: number) => { const a = u(px, py), b = v(px, py); return a * z1 + b * z2 + (1 - a - b) * z3 + lift; };
    const minX = Math.min(x1, x2, x3), maxX = Math.max(x1, x2, x3), minY = Math.min(y1, y2, y3), maxY = Math.max(y1, y2, y3);
    const below = (px: number, py: number) => plane(px, py) < height(px, py) - clearanceM;
    for (let gx = Math.ceil(minX / landStep) * landStep; gx <= maxX; gx += landStep) for (let gy = Math.ceil(minY / landStep) * landStep; gy <= maxY; gy += landStep) {
      if (!below(gx, gy)) continue;
      const a = u(gx, gy), b = v(gx, gy);
      if (a >= -1e-6 && b >= -1e-6 && a + b <= 1 + 1e-6) return true;
    }
    // The sag of two planes over one grid cell peaks at a corner of their intersection, which can also be where a
    // triangle edge crosses a grid line: check those crossings (a crest running along an edge is missed otherwise).
    const edges: [number, number, number, number][] = [[x1, y1, x2, y2], [x2, y2, x3, y3], [x3, y3, x1, y1]];
    for (const [ax, ay, bx, by] of edges) {
      for (let gx = Math.ceil(Math.min(ax, bx) / landStep) * landStep; gx <= Math.max(ax, bx); gx += landStep) {
        const t = bx === ax ? -1 : (gx - ax) / (bx - ax);
        if (t >= 0 && t <= 1 && below(gx, ay + t * (by - ay))) return true;
      }
      for (let gy = Math.ceil(Math.min(ay, by) / landStep) * landStep; gy <= Math.max(ay, by); gy += landStep) {
        const t = by === ay ? -1 : (gy - ay) / (by - ay);
        if (t >= 0 && t <= 1 && below(ax + t * (bx - ax), gy)) return true;
      }
    }
    // A crease can also cross an edge between nodes; the centroid catches the rest (and smooth, deck-blended ground).
    const cx = (x1 + x2 + x3) / 3, cy = (y1 + y2 + y3) / 3;
    return plane(cx, cy) < height(cx, cy) - clearanceM;
  };
  for (let t = 0; t < tris.length; t += 3) {
    const ax = coords[tris[t] * 2], ay = coords[tris[t] * 2 + 1], bx = coords[tris[t + 1] * 2], by = coords[tris[t + 1] * 2 + 1], cx = coords[tris[t + 2] * 2], cy = coords[tris[t + 2] * 2 + 1];
    // CCW from above.
    if ((bx - ax) * (cy - ay) - (by - ay) * (cx - ax) > 0) stack.push(ax, ay, bx, by, cx, cy); else stack.push(ax, ay, cx, cy, bx, by);
    while (stack.length) {
      const y3 = stack.pop()!, x3 = stack.pop()!, y2 = stack.pop()!, x2 = stack.pop()!, y1 = stack.pop()!, x1 = stack.pop()!;
      const e1 = (x2 - x1) ** 2 + (y2 - y1) ** 2, e2 = (x3 - x2) ** 2 + (y3 - y2) ** 2, e3 = (x1 - x3) ** 2 + (y1 - y3) ** 2;
      const longest = Math.max(e1, e2, e3);
      const refine = longest > max2 || (longest > min2 && sags(x1, y1, x2, y2, x3, y3));
      if (!refine || stack.length > 6e5) {
        const i = vertex(m, x1, y1, height(x1, y1) + lift), j = vertex(m, x2, y2, height(x2, y2) + lift), k = vertex(m, x3, y3, height(x3, y3) + lift);
        m.indices.push(i, j, k);
        continue;
      }
      // Split the longest edge at its midpoint; both halves keep the winding.
      if (longest === e1) { const mx = (x1 + x2) / 2, my = (y1 + y2) / 2; stack.push(x1, y1, mx, my, x3, y3, mx, my, x2, y2, x3, y3); }
      else if (longest === e2) { const mx = (x2 + x3) / 2, my = (y2 + y3) / 2; stack.push(x1, y1, x2, y2, mx, my, x1, y1, mx, my, x3, y3); }
      else { const mx = (x3 + x1) / 2, my = (y3 + y1) / 2; stack.push(x1, y1, x2, y2, mx, my, mx, my, x2, y2, x3, y3); }
    }
  }
}

export type ParkLayer = 'lawn' | 'bed' | 'shrub' | 'bark' | 'sand' | 'parkGravel' | 'parkPath' | 'pond' | 'hedge' | 'furniture';
/** Park surfaces drawn into existing street layers (same look as the street's paving and cycle paths). */
export type SharedLayer = 'paving' | 'cycle';

/** Lift above the relief per park surface (metres): above OSM areas (0.015), below every street band (0.03+). */
export const PARK_LIFT: Record<ParkSurface, number> = {
  lawn: 0.018, bed: 0.021, shrub: 0.021, bark: 0.021, sand: 0.022, gravel: 0.024, path: 0.024, paving: 0.024, cycle: 0.025, pond: 0.023,
};
export const SURFACE_LAYER: Record<ParkSurface, ParkLayer | SharedLayer> = {
  lawn: 'lawn', bed: 'bed', shrub: 'shrub', bark: 'bark', sand: 'sand', gravel: 'parkGravel', path: 'parkPath', paving: 'paving', cycle: 'cycle', pond: 'pond',
};
/** How far (m) a fill may sag under the land surface it covers before drapeBisect splits it. Land pokes through at about a centimetre and reads as a beige speck in the grass. */
/** How far (m) a fill may sag under the land surface it covers before drapeBisect splits it. Land pokes through at about a centimetre and reads as a beige speck in the grass; the far ring may sag more, where a centimetre is under a pixel. */
export const CLEARANCE_M = 0.002, CLEARANCE_FAR_M = 0.01;

type RGB = [number, number, number];
/** Furniture colours (sRGB 0..1), vertex-coloured into one layer per cell. */
export const PARK_FURNITURE_COLOURS = {
  hedge: [0.25, 0.38, 0.17], hedgeTop: [0.31, 0.45, 0.2],
  fence: [0.17, 0.22, 0.19], wall: [0.55, 0.36, 0.28], wallCap: [0.62, 0.6, 0.55],
  wood: [0.5, 0.36, 0.22], steel: [0.2, 0.24, 0.22], lamp: [0.13, 0.17, 0.15], lampHead: [0.9, 0.88, 0.78],
  red: [0.75, 0.2, 0.15], yellow: [0.88, 0.7, 0.16], blue: [0.18, 0.38, 0.66], green: [0.2, 0.5, 0.3], sandRing: [0.55, 0.42, 0.27],
} satisfies Record<string, RGB>;
const C = PARK_FURNITURE_COLOURS as Record<string, RGB>;

export interface ParkBuildStats { surfaces: number; pondsInWater: number; hedgeM: number; fenceM: number; wallM: number; benches: number; lamps: number; play: number; generated: number; dropWays: number }

/**
 * A square-section prism `w` × `d` between two 3D points (posts, rails,
 * chains, swing legs): four sides and the two ends, unshared vertices so the
 * normals stay flat.
 */
export function beam(m: MeshArrays, a: [number, number, number], b: [number, number, number], w: number, d: number, colour: RGB): void {
  const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2], len = Math.hypot(dx, dy, dz);
  if (len < 1e-6) return;
  const u = [dx / len, dy / len, dz / len];
  // Two axes across the beam: horizontal first (vertical beams: east/north).
  let s = Math.hypot(u[0], u[1]) > 1e-3 ? [-u[1], u[0], 0] : [1, 0, 0];
  const sl = Math.hypot(s[0], s[1], s[2]); s = s.map(v => v / sl);
  const t = [u[1] * s[2] - u[2] * s[1], u[2] * s[0] - u[0] * s[2], u[0] * s[1] - u[1] * s[0]];
  const corner = (p: [number, number, number], i: number, j: number): [number, number, number] =>
    [p[0] + s[0] * i * w / 2 + t[0] * j * d / 2, p[1] + s[1] * i * w / 2 + t[1] * j * d / 2, p[2] + s[2] * i * w / 2 + t[2] * j * d / 2];
  const ring: [number, number][] = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
  const quad = (q: [number, number, number][]) => {
    const i0 = vertex(m, q[0][0], q[0][1], q[0][2], colour), i1 = vertex(m, q[1][0], q[1][1], q[1][2], colour);
    const i2 = vertex(m, q[2][0], q[2][1], q[2][2], colour), i3 = vertex(m, q[3][0], q[3][1], q[3][2], colour);
    m.indices.push(i0, i1, i2, i0, i2, i3);
  };
  for (let k = 0; k < 4; k++) {
    const [i, j] = ring[k], [i2, j2] = ring[(k + 1) % 4];
    quad([corner(a, i, j), corner(a, i2, j2), corner(b, i2, j2), corner(b, i, j)]);
  }
  quad(ring.map(([i, j]) => corner(b, i, j)));
  quad([...ring].reverse().map(([i, j]) => corner(a, i, j)));
}

/** An upright box `l` (along `ang`) × `w`, from z0 to z1 above the ground at its centre. */
function box(m: MeshArrays, x: number, y: number, ang: number, l: number, w: number, z0: number, z1: number, colour: RGB): void {
  const ux = Math.cos(ang), uy = Math.sin(ang);
  beam(m, [x, y, z0], [x, y, z1], l, w, colour);
  // beam() puts the first cross axis east for vertical beams; rotate the last 24 vertices about the centre.
  const n = m.positions.length / 3;
  for (let v = n - 24; v < n; v++) {
    const px = m.positions[v * 3] - x, py = m.positions[v * 3 + 1] - y;
    m.positions[v * 3] = x + px * ux - py * uy; m.positions[v * 3 + 1] = y + px * uy + py * ux;
    m.uvs[v * 2] = m.positions[v * 3]; m.uvs[v * 2 + 1] = m.positions[v * 3 + 1];
  }
}

/** A wall-like strip along a polyline: `w` wide, from the ground to `h`, in straight boxes per segment. */
function strip(m: MeshArrays, line: readonly Vec2[], height: HeightFn, w: number, h: number, colour: RGB, top?: RGB): number {
  let len = 0;
  for (let i = 1; i < line.length; i++) {
    const a = line[i - 1], b = line[i], l = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (l < 0.05) continue;
    len += l;
    // Long segments are split so the strip follows the relief.
    const n = Math.max(1, Math.ceil(l / 6));
    for (let k = 0; k < n; k++) {
      const p: Vec2 = [a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n], q: Vec2 = [a[0] + (b[0] - a[0]) * (k + 1) / n, a[1] + (b[1] - a[1]) * (k + 1) / n];
      const cx = (p[0] + q[0]) / 2, cy = (p[1] + q[1]) / 2, z = Math.min(height(p[0], p[1]), height(q[0], q[1]));
      box(m, cx, cy, Math.atan2(q[1] - p[1], q[0] - p[0]), l / n + w * 0.5, w, z - 0.05, z + h, colour);
      if (top) box(m, cx, cy, Math.atan2(q[1] - p[1], q[0] - p[0]), l / n + w * 0.6, w * 1.15, z + h, z + h + 0.06, top);
    }
  }
  return len;
}

/** Post-and-rail fence along a polyline: posts every 2.5 m, a top and a middle rail per segment. */
function fence(m: MeshArrays, line: readonly Vec2[], height: HeightFn): number {
  let len = 0, run = 0;
  for (let i = 1; i < line.length; i++) {
    const a = line[i - 1], b = line[i], l = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (l < 0.05) continue;
    for (; run <= len + l; run += 2.5) {
      const t = (run - len) / l, x = a[0] + (b[0] - a[0]) * t, y = a[1] + (b[1] - a[1]) * t, z = height(x, y);
      beam(m, [x, y, z - 0.05], [x, y, z + 1.2], 0.06, 0.06, C.fence);
    }
    const za = height(a[0], a[1]), zb = height(b[0], b[1]);
    for (const h of [0.55, 1.12]) beam(m, [a[0], a[1], za + h], [b[0], b[1], zb + h], 0.05, 0.04, C.fence);
    len += l;
  }
  return len;
}

/** A hedge polygon (BGT haag) extruded to `h`: earcut top and walls along every ring. */
function hedgeBlock(m: MeshArrays, rings: readonly Vec2[][], height: HeightFn, h: number): void {
  const { flat, holes } = flatten(rings);
  if (flat.length < 6) return;
  let zmin = Infinity;
  for (let i = 0; i < flat.length; i += 2) zmin = Math.min(zmin, height(flat[i], flat[i + 1]));
  const top = zmin + h;
  const tris = earcut(flat, holes);
  const base = m.positions.length / 3;
  for (let i = 0; i < flat.length; i += 2) vertex(m, flat[i], flat[i + 1], top, C.hedgeTop);
  for (let t = 0; t < tris.length; t += 3) {
    const a = tris[t], b = tris[t + 1], c = tris[t + 2];
    const ccw = (flat[b * 2] - flat[a * 2]) * (flat[c * 2 + 1] - flat[a * 2 + 1]) - (flat[b * 2 + 1] - flat[a * 2 + 1]) * (flat[c * 2] - flat[a * 2]) > 0;
    if (ccw) m.indices.push(base + a, base + b, base + c); else m.indices.push(base + a, base + c, base + b);
  }
  for (const r of rings) {
    const pts = r.length > 1 && r[0][0] === r[r.length - 1][0] && r[0][1] === r[r.length - 1][1] ? r.slice(0, -1) : r;
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i], q = pts[(i + 1) % pts.length];
      const zp = height(p[0], p[1]) - 0.05, zq = height(q[0], q[1]) - 0.05;
      const a = vertex(m, p[0], p[1], zp, C.hedge), b = vertex(m, q[0], q[1], zq, C.hedge), c = vertex(m, q[0], q[1], top, C.hedge), d = vertex(m, p[0], p[1], top, C.hedge);
      // Winding does not matter for a double-sided read of a hedge; keep both faces cheap by one side (the material is DoubleSide).
      m.indices.push(a, b, c, a, c, d);
    }
  }
}

/** A park bench (seat, back, two frames) at `p` facing `a` (the sitter looks along `a`). */
function bench(m: MeshArrays, p: Vec2, a: number, z: number): void {
  const fx = Math.cos(a), fy = Math.sin(a), along = a + Math.PI / 2;
  box(m, p[0], p[1], along, 1.8, 0.45, z + 0.4, z + 0.46, C.wood);
  box(m, p[0] - fx * 0.24, p[1] - fy * 0.24, along, 1.8, 0.05, z + 0.55, z + 0.88, C.wood);
  for (const s of [-0.75, 0.75]) {
    const x = p[0] + Math.cos(along) * s, y = p[1] + Math.sin(along) * s;
    box(m, x, y, a, 0.45, 0.06, z, z + 0.4, C.steel);
    box(m, x - fx * 0.24, y - fy * 0.24, a, 0.05, 0.06, z + 0.4, z + 0.88, C.steel);
  }
}

/** An Amsterdam park light: a dark green 4.5 m mast with a lantern head. */
function lamp(m: MeshArrays, p: Vec2, z: number): void {
  beam(m, [p[0], p[1], z], [p[0], p[1], z + 4.3], 0.12, 0.12, C.lamp);
  box(m, p[0], p[1], 0, 0.36, 0.36, z + 4.3, z + 4.65, C.lampHead);
  box(m, p[0], p[1], 0, 0.44, 0.44, z + 4.65, z + 4.72, C.lamp);
}

/** One playground piece at `p` (axis `a`). */
function playPiece(m: MeshArrays, k: ParkPointKind, p: Vec2, a: number, z: number): void {
  const ux = Math.cos(a), uy = Math.sin(a), vx = -uy, vy = ux;
  const at = (s: number, t: number, h: number): [number, number, number] => [p[0] + ux * s + vx * t, p[1] + uy * s + vy * t, z + h];
  if (k === 'swing') {
    // A-frame each end, a 3 m beam at 2.3 m, two seats on chains.
    for (const s of [-1.6, 1.6]) { beam(m, at(s, -0.9, 0), at(s, 0, 2.3), 0.08, 0.08, C.steel); beam(m, at(s, 0.9, 0), at(s, 0, 2.3), 0.08, 0.08, C.steel); }
    beam(m, at(-1.7, 0, 2.3), at(1.7, 0, 2.3), 0.1, 0.1, C.steel);
    for (const s of [-0.7, 0.7]) {
      for (const e of [-0.2, 0.2]) beam(m, at(s + e, 0, 2.28), at(s + e, 0, 0.45), 0.02, 0.02, C.steel);
      box(m, ...(at(s, 0, 0).slice(0, 2) as Vec2), a, 0.5, 0.18, z + 0.4, z + 0.45, C.red);
    }
  } else if (k === 'slide') {
    // Ladder up to a 1.5 m platform, chute down along the axis.
    const ph = 1.5;
    for (const t of [-0.3, 0.3]) beam(m, at(-1.2, t, 0), at(-0.4, t, ph + 0.8), 0.06, 0.06, C.steel);
    for (const t of [-0.35, 0.35]) for (const s of [-0.4, 0.35]) beam(m, at(s, t, 0), at(s, t, ph), 0.08, 0.08, C.steel);
    box(m, ...(at(0, 0, 0).slice(0, 2) as Vec2), a, 0.8, 0.8, z + ph - 0.06, z + ph, C.yellow);
    beam(m, at(0.4, 0, ph - 0.05), at(2.8, 0, 0.25), 0.55, 0.06, C.blue);
    for (const t of [-0.3, 0.3]) beam(m, at(0.4, t, ph + 0.15), at(2.8, t, 0.4), 0.05, 0.12, C.blue);
  } else if (k === 'sandpit') {
    // A wooden kerb ring (the sand itself is a surface polygon).
    const r = 2.2, n = 10;
    for (let i = 0; i < n; i++) {
      const t0 = (i / n) * Math.PI * 2, t1 = ((i + 1) / n) * Math.PI * 2;
      beam(m, [p[0] + Math.cos(t0) * r, p[1] + Math.sin(t0) * r, z + 0.12], [p[0] + Math.cos(t1) * r, p[1] + Math.sin(t1) * r, z + 0.12], 0.25, 0.3, C.sandRing);
    }
  } else if (k === 'seesaw') {
    box(m, p[0], p[1], a, 0.3, 0.3, z, z + 0.45, C.steel);
    beam(m, at(-1.6, 0, 0.25), at(1.6, 0, 0.65), 0.22, 0.06, C.red);
  } else if (k === 'springy') {
    beam(m, at(0, 0, 0), at(0, 0, 0.5), 0.12, 0.12, C.steel);
    box(m, p[0], p[1], a, 0.7, 0.3, z + 0.5, z + 0.75, C.yellow);
  } else if (k === 'playhouse') {
    box(m, p[0], p[1], a, 1.6, 1.4, z, z + 1.3, C.wood);
    beam(m, at(0, 0, 1.3), at(0, 0, 1.9), 1.2, 1.0, C.red);
  } else {
    // Climbing frame / generic structure: a 2.4 m cube of bars.
    const h = k === 'climb' ? 2.2 : 1.6, s = 1.2;
    for (const [i, j] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) beam(m, at(i * s, j * s, 0), at(i * s, j * s, h), 0.07, 0.07, k === 'climb' ? C.green : C.blue);
    for (const hh of [h / 2, h]) {
      beam(m, at(-s, -s, hh), at(s, -s, hh), 0.05, 0.05, C.yellow); beam(m, at(s, -s, hh), at(s, s, hh), 0.05, 0.05, C.yellow);
      beam(m, at(s, s, hh), at(-s, s, hh), 0.05, 0.05, C.yellow); beam(m, at(-s, s, hh), at(-s, -s, hh), 0.05, 0.05, C.yellow);
    }
  }
}

/**
 * The park meshes of one cell. `height` is the land surface the other flat
 * layers drape on (groundCell `onLand`); `lod` 1 (far ring) keeps surfaces
 * (coarser) and hedges, drops benches, lamps, fences and the playground kit.
 */
export function buildParks(cell: ParksCell, height: HeightFn, lod: 0 | 1, isWater: (x: number, y: number) => boolean = () => false): { layers: Partial<Record<ParkLayer | SharedLayer, MeshArrays>>; stats: ParkBuildStats } {
  const layers: Partial<Record<ParkLayer | SharedLayer, MeshArrays>> = {};
  const get = (l: ParkLayer | SharedLayer, colours = false) => (layers[l] ??= emptyMesh(colours));
  const stats: ParkBuildStats = { surfaces: 0, pondsInWater: 0, hedgeM: 0, fenceM: 0, wallM: 0, benches: 0, lamps: 0, play: 0, generated: 0, dropWays: cell.dropWays.length };
  for (const s of cell.surfaces) {
    const rings = s.r.map(decodeLine);
    const { flat, holes } = flatten(rings);
    if (flat.length < 6) continue;
    const tris = earcut(flat, holes);
    if (s.k === 'pond') {
      // A pond the canal water already draws (elevation-v1 water, the land is cut there) is not drawn twice.
      const at = interiorPoint(rings);
      if (at && isWater(at[0], at[1])) { stats.pondsInWater++; continue; }
    }
    drapeBisect(get(SURFACE_LAYER[s.k]), flat, tris, height, PARK_LIFT[s.k], lod === 0 ? 8 : 20, lod === 0 ? CLEARANCE_M : CLEARANCE_FAR_M, lod === 0 ? 1 : 2, lod === 0 ? 5 : 10);
    stats.surfaces++;
  }
  const hedge = get('hedge', true);
  for (const h of cell.hedges) hedgeBlock(hedge, h.map(decodeLine), height, 1.05);
  for (const l of cell.lines) {
    const line = decodeLine(l.g);
    if (l.k === 'hedge') stats.hedgeM += strip(hedge, line, height, 0.8, 1.1, C.hedge, C.hedgeTop);
    else if (lod === 0 && l.k === 'fence') stats.fenceM += fence(get('furniture', true), line, height);
    else if (lod === 0 && l.k === 'wall') stats.wallM += strip(get('furniture', true), line, height, 0.3, 0.75, C.wall, C.wallCap);
  }
  if (lod === 0) {
    const f = get('furniture', true);
    for (const pt of cell.points) {
      const p: Vec2 = [pt.p[0] / 10, pt.p[1] / 10], z = height(p[0], p[1]);
      if (pt.k === 'bench') { bench(f, p, pt.a ?? 0, z); stats.benches++; }
      else if (pt.k === 'lamp') { lamp(f, p, z); stats.lamps++; }
      else { playPiece(f, pt.k, p, pt.a ?? 0, z); stats.play++; }
      if (pt.gen) stats.generated++;
    }
  }
  for (const k of Object.keys(layers) as (ParkLayer | SharedLayer)[]) if (!layers[k]!.indices.length) delete layers[k];
  return { layers, stats };
}

// ------------------------------------------------------------------ the OSM park fill under the survey

/**
 * The surfaces as a raster: `find` the surface id at a point (-1: none); `uniform`: every texel of a box is surface k;
 * `every`: every texel of a box holds a surface (id ≥ 0) that `ok` accepts (a box over several surfaces that tile it).
 */
export interface SurfaceRaster { find(x: number, y: number): number; uniform(ax: number, ay: number, bx: number, by: number, k: number): boolean; every(ax: number, ay: number, bx: number, by: number, ok: (k: number) => boolean): boolean }

/**
 * Point lookup over the BGT surfaces of a cell neighbourhood (a 25 m bucket grid of their bboxes).
 * Generic over the surface record (`r`: encoded rings): parks-v1 surfaces by default, roads-v1 polygons
 * through roadSurfaces.ts RoadIndex. `records[k]` is the record behind polygon `k`.
 */
export class SurfaceIndex<S extends { r: EncodedLine[] } = ParksCell['surfaces'][number]> {
  private readonly polys: { rings: Vec2[][]; box: [number, number, number, number]; flat: number[]; tris: number[] }[] = [];
  /** The record each polygon was built from, parallel to the polygon ids `find` returns. */
  readonly records: S[] = [];
  private readonly grid = new Map<string, number[]>();
  private static readonly G = 25;
  /** Surfaces [0, own) belong to the first cell passed (drawn by the same build as the land under them). */
  readonly own: number = 0;
  /** `keep`: which records are cover (parks: not ponds, which buildParks may skip and whose edge is a bank). */
  /** `within`: a box past which the other cells' polygons are left out (the first cell's are all kept). */
  constructor(cells: readonly ({ surfaces: readonly S[] } | null | undefined)[], keep: (s: S) => boolean = s => (s as { k?: string }).k !== 'pond', within?: readonly [number, number, number, number]) {
    const seen = new Set<{ surfaces: readonly S[] }>();
    for (const c of cells) {
      if (!c || seen.has(c)) continue;
      seen.add(c);
      for (const s of c.surfaces) {
        if (!keep(s)) continue;
        const rings = s.r.map(decodeLine);
        if (!rings.length || rings[0].length < 3) continue;
        const xs = rings[0].map(p => p[0]), ys = rings[0].map(p => p[1]);
        const box: [number, number, number, number] = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)], k = this.polys.length;
        if (within && c !== cells[0] && (box[2] < within[0] || box[0] > within[2] || box[3] < within[1] || box[1] > within[3])) continue;
        // The cover is what buildParks draws: the same earcut triangles (a self-intersecting BGT ring loses areas there,
        // and the Vondelpark had a 5 x 4 m one that the even-odd ring test called lawn).
        const { flat, holes } = flatten(rings);
        this.polys.push({ rings, box, flat, tris: flat.length >= 6 ? earcut(flat, holes) : [] });
        this.records.push(s);
        const G = SurfaceIndex.G;
        for (let gx = Math.floor(box[0] / G); gx <= Math.floor(box[2] / G); gx++) for (let gy = Math.floor(box[1] / G); gy <= Math.floor(box[3] / G); gy++) (this.grid.get(`${gx}:${gy}`) ?? this.grid.set(`${gx}:${gy}`, []).get(`${gx}:${gy}`)!).push(k);
      }
      if (c === cells[0]) (this as { own: number }).own = this.polys.length;
    }
  }
  /** Decoded rings of polygon `k` (outer first). */
  ringsOf(k: number): readonly Vec2[][] { return this.polys[k].rings; }
  /** Earcut input of polygon `k` (as the raster and the drawn mesh use it). */
  flatOf(k: number): { flat: readonly number[]; tris: readonly number[] } { const p = this.polys[k]; return { flat: p.flat, tris: p.tris }; }
  boxOf(k: number): readonly [number, number, number, number] { return this.polys[k].box; }
  get size(): number { return this.polys.length; }
  /** Bounding box of every surface (null: none). */
  bounds(): [number, number, number, number] | null {
    if (!this.polys.length) return null;
    const b: [number, number, number, number] = [Infinity, Infinity, -Infinity, -Infinity];
    for (const p of this.polys) { b[0] = Math.min(b[0], p.box[0]); b[1] = Math.min(b[1], p.box[1]); b[2] = Math.max(b[2], p.box[2]); b[3] = Math.max(b[3], p.box[3]); }
    return b;
  }
  /** Index of a surface containing (x, y), or -1. */
  find(x: number, y: number): number {
    const G = SurfaceIndex.G;
    for (const k of this.grid.get(`${Math.floor(x / G)}:${Math.floor(y / G)}`) ?? []) {
      const { rings, box } = this.polys[k];
      if (x < box[0] || x > box[2] || y < box[1] || y > box[3]) continue;
      let c = false;
      for (const r of rings) for (let i = 0, j = r.length - 1; i < r.length; j = i++) { const [xi, yi] = r[i], [xj, yj] = r[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c; }
      if (c) return k;
    }
    return -1;
  }
  contains(x: number, y: number): boolean { return this.find(x, y) >= 0; }
  /** Every surface containing (x, y) (stacked bridge decks over a street). */
  findAll(x: number, y: number): number[] {
    const G = SurfaceIndex.G, out: number[] = [];
    for (const k of this.grid.get(`${Math.floor(x / G)}:${Math.floor(y / G)}`) ?? []) {
      const { rings, box } = this.polys[k];
      if (x < box[0] || x > box[2] || y < box[1] || y > box[3]) continue;
      if (inRings(rings, x, y)) out.push(k);
    }
    return out;
  }

  /**
   * The surfaces over a box as a raster of surface ids + 1 (0: none) at `res`
   * (a texel takes the surface its centre lies in). Cheap point lookups for the
   * fill culling: a polygon test per sample cost 0.4–0.6 s per park cell.
   */
  raster(box: readonly [number, number, number, number], res: number): SurfaceRaster {
    const [x0, y0] = box, W = Math.max(1, Math.ceil((box[2] - x0) / res)), H = Math.max(1, Math.ceil((box[3] - y0) / res));
    if (this.polys.length >= 65535) throw new Error('SurfaceIndex.raster: too many surfaces for 16-bit ids');
    const ids = new Uint16Array(W * H);
    this.polys.forEach(({ box: b, flat, tris }, k) => {
      if (b[2] < x0 || b[0] > box[2] || b[3] < y0 || b[1] > box[3]) return;
      for (let t = 0; t < tris.length; t += 3) {
        const ax = (flat[tris[t] * 2] - x0) / res - 0.5, ay = (flat[tris[t] * 2 + 1] - y0) / res - 0.5, bx = (flat[tris[t + 1] * 2] - x0) / res - 0.5, by = (flat[tris[t + 1] * 2 + 1] - y0) / res - 0.5, cx = (flat[tris[t + 2] * 2] - x0) / res - 0.5, cy = (flat[tris[t + 2] * 2 + 1] - y0) / res - 0.5;
        const i0 = Math.max(0, Math.ceil(Math.min(ax, bx, cx))), i1 = Math.min(W - 1, Math.floor(Math.max(ax, bx, cx))), j0 = Math.max(0, Math.ceil(Math.min(ay, by, cy))), j1 = Math.min(H - 1, Math.floor(Math.max(ay, by, cy)));
        const d = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy);
        if (i0 > i1 || j0 > j1 || Math.abs(d) < 1e-12) continue;
        for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
          const u = ((by - cy) * (i - cx) + (cx - bx) * (j - cy)) / d, v = ((cy - ay) * (i - cx) + (ax - cx) * (j - cy)) / d;
          if (u >= -1e-9 && v >= -1e-9 && u + v <= 1 + 1e-9) ids[j * W + i] = k + 1;
        }
      }
    });
    return {
      find: (x, y) => { const i = Math.floor((x - x0) / res), j = Math.floor((y - y0) / res); return i < 0 || j < 0 || i >= W || j >= H ? -1 : ids[j * W + i] - 1; },
      uniform: (ax, ay, bx, by, k) => {
        const i0 = Math.floor((ax - x0) / res), i1 = Math.floor((bx - x0) / res), j0 = Math.floor((ay - y0) / res), j1 = Math.floor((by - y0) / res);
        if (i0 < 0 || j0 < 0 || i1 >= W || j1 >= H) return false;
        for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) if (ids[j * W + i] !== k + 1) return false;
        return true;
      },
      every: (ax, ay, bx, by, ok) => {
        const i0 = Math.floor((ax - x0) / res), i1 = Math.floor((bx - x0) / res), j0 = Math.floor((ay - y0) / res), j1 = Math.floor((by - y0) / res);
        if (i0 < 0 || j0 < 0 || i1 >= W || j1 >= H) return false;
        let last = -1;
        for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
          const id = ids[j * W + i];
          if (id === last) continue;
          if (id === 0 || !ok(id - 1)) return false;
          last = id;
        }
        return true;
      },
    };
  }
}

/** A culled triangle must lie inside one surface by this margin. */
export const CULL_MARGIN_M = 0.5;
/** Surface raster for the culling, metres per texel. */
export const CULL_RES_M = 0.5;

/**
 * Drop the triangles of a draped fill that the BGT surfaces hide entirely (every
 * texel of its box inside one surface, CULL_MARGIN_M clear of its edge), compacting the
 * vertices (20–160k hidden triangles per park cell, the parks lane's next
 * saving). Skipping a whole park at 90 % coverage (the handoff's rule) exposed the land
 * in its unsurveyed tenth (42 of 459 visible-fill probes in cell -2_-2 turned
 * to bare land); per triangle, the green stays wherever the survey has a gap.
 */
export function cullCovered(m: MeshArrays, index: SurfaceRaster): { mesh: MeshArrays; dropped: number } {
  const p = m.positions, keep: number[] = [];
  let dropped = 0;
  if (!m.indices.length) return { mesh: m, dropped };
  for (let t = 0; t < m.indices.length; t += 3) {
    const a = m.indices[t] * 3, b = m.indices[t + 1] * 3, c = m.indices[t + 2] * 3;
    // Hidden only when every texel of the triangle's box, grown by CULL_MARGIN_M, lies in one surface: holes in a lawn
    // (a 5 x 4 m one in the Vondelpark sat between the corner and midpoint samples) and the slivers between two
    // surveyed polygons stay green.
    const k = index.find(p[a], p[a + 1]);
    if (k >= 0 && index.uniform(Math.min(p[a], p[b], p[c]) - CULL_MARGIN_M, Math.min(p[a + 1], p[b + 1], p[c + 1]) - CULL_MARGIN_M, Math.max(p[a], p[b], p[c]) + CULL_MARGIN_M, Math.max(p[a + 1], p[b + 1], p[c + 1]) + CULL_MARGIN_M, k)) { dropped++; continue; }
    keep.push(m.indices[t], m.indices[t + 1], m.indices[t + 2]);
  }
  if (!dropped) return { mesh: m, dropped };
  const out = emptyMesh(!!m.colors), remap = new Map<number, number>();
  for (const i of keep) {
    let j = remap.get(i);
    if (j === undefined) {
      j = out.positions.length / 3; remap.set(i, j);
      out.positions.push(p[i * 3], p[i * 3 + 1], p[i * 3 + 2]); out.uvs.push(m.uvs[i * 2], m.uvs[i * 2 + 1]);
      if (m.colors && out.colors) out.colors.push(m.colors[i * 3], m.colors[i * 3 + 1], m.colors[i * 3 + 2]);
    }
    out.indices.push(j);
  }
  return { mesh: out, dropped };
}
