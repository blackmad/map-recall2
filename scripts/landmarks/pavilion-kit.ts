import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {inside, surface, p3, type Col} from './civic-kit';
import {upwardRoofPlane} from './house-geometry';

/**
 * Small kit for clusters of attached pavilions on OSM building:part rings (the Stationsplein koffiehuis island):
 * walls only where a part is exposed (outside every neighbour, or above a lower neighbour's top), mansard rings with
 * per-edge insets over concave rings, and lathe profiles for the lead turret caps. Local metres, x east, z south.
 */
export type V2 = [number, number];
export interface Part { ring: V2[]; top: number }
export interface Run { edge: number; a: V2; b: V2; t0: number; t1: number; from: number; out: V2 }

const sub = (a: V2, b: V2): V2 => [a[0] - b[0], a[1] - b[1]];
const len = (a: V2) => Math.hypot(a[0], a[1]);
const lerp = (a: V2, b: V2, t: number): V2 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];

export function signedArea(ring: V2[]): number {
  let s = 0;
  for (let i = 0; i < ring.length; i++) { const p = ring[i], q = ring[(i + 1) % ring.length]; s += p[0] * q[1] - q[0] * p[1]; }
  return s / 2;
}
const vin = (ring: V2[], p: V2) => inside(ring.map(q => new T.Vector2(q[0], q[1])), new T.Vector2(p[0], p[1]));

/** Outward unit normal of edge i of a ring (either winding). */
export function outward(ring: V2[], i: number): V2 {
  const a = ring[i], b = ring[(i + 1) % ring.length], d = sub(b, a), L = len(d) || 1;
  const n: V2 = [d[1] / L, -d[0] / L];
  return signedArea(ring) > 0 ? n : [-n[0], -n[1]];
}

/**
 * Exposed wall runs of part `i`: each edge is sampled every `step` metres just outside the wall; a sample outside every
 * other part is exposed from the ground, one inside lower parts is exposed above the highest of them, one inside a part
 * at least as tall is hidden. Consecutive samples with the same base merge into one run.
 */
export function exposedRuns(parts: Part[], i: number, step = 0.5, probe = 0.15): Run[] {
  const ring = parts[i].ring, runs: Run[] = [];
  for (let e = 0; e < ring.length; e++) {
    const a = ring[e], b = ring[(e + 1) % ring.length], L = len(sub(b, a)), out = outward(ring, e);
    if (L < 1e-6) continue;
    const n = Math.max(1, Math.round(L / step));
    let cur: Run | null = null;
    for (let k = 0; k < n; k++) {
      const m = lerp(a, b, (k + .5) / n), p: V2 = [m[0] + out[0] * probe, m[1] + out[1] * probe];
      let from = 0;
      for (let j = 0; j < parts.length; j++) if (j !== i && vin(parts[j].ring, p)) from = Math.max(from, parts[j].top);
      const t0 = L * k / n, t1 = L * (k + 1) / n;
      if (from >= parts[i].top - 1e-6) { if (cur) { runs.push(cur); cur = null; } continue; }
      if (cur && Math.abs(cur.from - from) < 1e-6) { cur.t1 = t1; cur.b = lerp(a, b, t1 / L); continue; }
      if (cur) runs.push(cur);
      cur = {edge: e, a: lerp(a, b, t0 / L), b: lerp(a, b, t1 / L), t0, t1, from, out};
    }
    if (cur) runs.push(cur);
  }
  return runs;
}

/** One outward-facing vertical quad from (a, y0)-(b, y1). */
export function wallQuad(b: BuildingTools, a: V2, c: V2, y0: number, y1: number, out: V2, col: Col) {
  const d = sub(c, a), n: V2 = [-d[1], d[0]];
  const pts = [p3(new T.Vector2(a[0], a[1]), y0), p3(new T.Vector2(c[0], c[1]), y0), p3(new T.Vector2(c[0], c[1]), y1), p3(new T.Vector2(a[0], a[1]), y1)];
  surface(b, n[0] * out[0] + n[1] * out[1] >= 0 ? pts : [pts[1], pts[0], pts[3], pts[2]], col);
}

/** Walls of every exposed run of part `i`, from each run's base to `top` (default the part's top). */
export function exposedWalls(b: BuildingTools, parts: Part[], i: number, col: Col, top = parts[i].top): Run[] {
  const runs = exposedRuns(parts, i);
  for (const r of runs) if (top > r.from) wallQuad(b, r.a, r.b, r.from, top, r.out, col);
  return runs;
}

/**
 * Miter inset of a ring with a distance per edge (0 keeps the edge where it is). Throws when an inset edge reverses
 * direction, which means the inset is too deep for that ring.
 */
export function insetRing(ring: V2[], d: number[]): V2[] {
  const n = ring.length, lines = ring.map((a, i) => {
    const b = ring[(i + 1) % n], o = outward(ring, i);
    return {p: [a[0] - o[0] * d[i], a[1] - o[1] * d[i]] as V2, u: sub(b, a)};
  });
  const pts = ring.map((_, i) => {
    const A = lines[(i + n - 1) % n], B = lines[i], den = A.u[0] * B.u[1] - A.u[1] * B.u[0];
    if (Math.abs(den) < 1e-9) return B.p;
    const t = ((B.p[0] - A.p[0]) * B.u[1] - (B.p[1] - A.p[1]) * B.u[0]) / den;
    return [A.p[0] + A.u[0] * t, A.p[1] + A.u[1] * t] as V2;
  });
  for (let i = 0; i < n; i++) {
    const u = ring[(i + 1) % n], v = ring[i], q = pts[(i + 1) % n], p = pts[i];
    if ((u[0] - v[0]) * (q[0] - p[0]) + (u[1] - v[1]) * (q[1] - p[1]) <= 0) throw new Error(`insetRing: edge ${i} reverses`);
  }
  return pts;
}

/**
 * Mansard / hipped-to-flat roof: tile slopes from the ring at `eaveY` up to the inset ring at `topY`, then a flat top.
 * Edges with a zero inset get no slope (a wall or a neighbour owns them). `overhang` pushes the eave line outward.
 */
export function mansardRoof(b: BuildingTools, ring: V2[], insets: number[], eaveY: number, topY: number, slope: Col, cap: Col, overhang = 0): V2[] {
  const inner = insetRing(ring, insets);
  const eave = overhang ? insetRing(ring, insets.map(d => (d > 0 ? -overhang : 0))) : ring;
  const P = (p: V2, y: number) => p3(new T.Vector2(p[0], p[1]), y);
  for (let i = 0; i < ring.length; i++) {
    if (insets[i] <= 0) continue;
    const j = (i + 1) % ring.length;
    surface(b, [P(eave[i], eaveY), P(eave[j], eaveY), P(inner[j], topY), P(inner[i], topY)], slope, true);
  }
  b.add(upwardRoofPlane(new T.Shape(inner.map(p => new T.Vector2(p[0], p[1]))), topY), cap);
  return inner;
}

/** Lathe profile of a lead ogee bell cap: radius r at y0, swelling then pinching to a neck of radius `neck` at y1. */
export function ogeeProfile(r: number, y0: number, y1: number, neck = 0.08, steps = 8, lip = 0.1): V2[] {
  // a 10 cm lip, so the ledge where the bell starts stands clear of a cornice the cap is sunk into
  const h = y1 - y0 - lip, out: V2[] = [[r * 1.08, y0], [r * 1.08, y0 + lip]];
  for (let k = 0; k <= steps; k++) {
    const t = k / steps, s = .5 - .5 * Math.cos(Math.PI * t); // S curve from full radius to the neck
    const bulge = Math.sin(Math.PI * t) * .12 * r;
    out.push([neck + (r - neck) * (1 - s) + bulge, y0 + lip + h * t]);
  }
  return out;
}
