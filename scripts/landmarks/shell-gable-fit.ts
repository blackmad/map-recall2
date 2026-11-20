import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {poly, put, slab, type Frame} from './nearbar-kit';
import type {Surface} from './worship-shell';

/**
 * Symmetric gables over an irregular 3DBAG shell (2026-11-20, landmarks r7 lane, De Kroon's Amstel front and tower crest).
 *
 * The LoD2.2 shell of a gabled front is often lopsided: the ridge sits off the gable axis, the eaves step between
 * neighbouring roof planes, and a decorative topgevel shows up as a lump in the roof instead of a clean outline. Drawing
 * a symmetric gable in front of that shell leaves the lopsided roof sticking out round it. This module does the two
 * halves of the fix:
 *  - `reshapeShell` edits the shell's vertices, not its topology: in a band behind one front it clamps the front edge to
 *    a single eaves line and snaps a ridge band to one height, and in a region it compresses heights above a level (a
 *    tower roof the scan drew too tall). Walls that collapse to nothing are dropped.
 *  - the outlines (`pointedGableOutline`, `bellCrestOutline`) are pure and symmetric about their axis, and `gableWall`
 *    draws one as a solid wall `thick` deep with its face `out` proud of the front, so nothing is coplanar with the shell.
 *    `pointedGable` adds stone copings along the rakes, pinnacles on the feet and a finial on the apex.
 *
 * Coordinates: the nearbar-kit wall frame (t along the wall to the viewer's right, y up, out from the wall). Shell
 * surfaces are native [x, y, z] (x east, y up, z south), as bag-shell-prepare writes them.
 */
export type V2 = [number, number];

/** Position of a native point in a wall frame: t along, d into the building (positive behind the wall plane). */
export function frameCoords(f: Frame, x: number, z: number): {t: number; d: number} {
  const dx = x - f.origin[0], dz = z - f.origin[1];
  return {t: dx * f.tangent[0] + dz * f.tangent[1], d: -(dx * f.n[0] + dz * f.n[1])};
}

export interface FrontClamp {
  frame: Frame;
  /** The front's extent along the frame (t); vertices up to 0.3 m past either end are included (corner vertices). */
  t0: number;
  t1: number;
  /** Depth of the band treated as the front edge: vertices closer than this to the wall plane get the eaves height. */
  front: number;
  /** The single eaves line. Front-band vertices at or above `eaves - reach` are moved to it. */
  eaves: number;
  /** How far below the eaves a front vertex may sit and still be pulled up to it (default 0.6 m). */
  reach?: number;
  /** Optional ridge band: vertices behind the front band, within maxDepth, with lo <= y <= hi are set to `to`. */
  ridge?: {lo: number; hi: number; to: number; maxDepth: number};
}
export interface Compress {
  /** Region test on native (x, z). */
  inside: (x: number, z: number) => boolean;
  /** Heights above y0 are scaled by s about y0. */
  y0: number;
  s: number;
}
/**
 * Snap band (2026-11-20, landmarks r9, the Oranjekerk's lumpy hipped roof): inside a region, vertices with lo <= y <= hi
 * are set to `to`. One eaves line and one ridge height over a scan that drew them 13.4-14.2 m and 21.6-22.8 m.
 */
export interface Snap {
  inside: (x: number, z: number) => boolean;
  lo: number;
  hi: number;
  to: number;
}

const yspan = (s: Surface) => { const ys = s.rings[0].map(p => p[1]); return Math.max(...ys) - Math.min(...ys); };

/** Vertex edits for a symmetric gable over an irregular shell; returns new surfaces (the input is not touched). */
export function reshapeShell(surfaces: Surface[], o: {fronts?: FrontClamp[]; compress?: Compress[]; snap?: Snap[]}): Surface[] {
  const move = (p: number[]): number[] => {
    let y = p[1];
    for (const sn of o.snap ?? []) if (y >= sn.lo && y <= sn.hi && sn.inside(p[0], p[2])) { y = sn.to; break; }
    for (const c of o.compress ?? []) if (y > c.y0 && c.inside(p[0], p[2])) y = c.y0 + (y - c.y0) * c.s;
    for (const fc of o.fronts ?? []) {
      const {t, d} = frameCoords(fc.frame, p[0], p[2]);
      if (t < fc.t0 - 0.3 || t > fc.t1 + 0.3) continue;
      if (d < fc.front && y >= fc.eaves - (fc.reach ?? 0.6)) y = fc.eaves;
      else if (fc.ridge && d >= fc.front && d <= fc.ridge.maxDepth && y >= fc.ridge.lo && y <= fc.ridge.hi) y = fc.ridge.to;
    }
    return [p[0], y, p[2]];
  };
  const out: Surface[] = [];
  for (const s of surfaces) {
    const r = {...s, rings: s.rings.map(ring => ring.map(move))};
    // a wall the edit flattened to a line (a 30 cm step between roof planes) is gone
    if (r.type === 'WallSurface' && yspan(r) < 0.05) continue;
    out.push(r);
  }
  return out;
}

export interface PointedGableSpec {
  /** Axis (t), half-width at the foot, foot height (the eaves line) and apex height. */
  axis: number;
  half: number;
  footY: number;
  apexY: number;
}
/** Triangle outline, counter-clockwise in (t, y). */
export function pointedGableOutline(g: PointedGableSpec): V2[] {
  return [[g.axis - g.half, g.footY], [g.axis + g.half, g.footY], [g.axis, g.apexY]];
}

export interface BellCrestSpec {
  axis: number;
  /** Half-width at the foot, at the neck, and the radius of the round head. */
  half: number;
  neckHalf: number;
  footY: number;
  /** Height where the concave shoulders meet the neck, and the top of the neck (where the round head starts). */
  shoulderY: number;
  neckTopY: number;
}
/** Curved (bell) crest: concave shoulders from the foot into a neck, a half-round head; counter-clockwise in (t, y). */
export function bellCrestOutline(g: BellCrestSpec, steps = 6): V2[] {
  const side = (s: -1 | 1): V2[] => {
    const pts: V2[] = [];
    const x0 = g.axis + s * g.half, x1 = g.axis + s * g.neckHalf, dx = x1 - x0, dy = g.shoulderY - g.footY;
    for (let i = 0; i <= steps; i++) {
      const a = (i / steps) * Math.PI / 2;
      pts.push([x0 + dx * Math.sin(a), g.footY + dy * (1 - Math.cos(a))]);
    }
    return pts;
  };
  const right = side(1), left = side(-1).reverse();
  const head: V2[] = [];
  for (let i = 0; i <= steps * 2; i++) {
    const a = (i / (steps * 2)) * Math.PI;
    head.push([g.axis + g.neckHalf * Math.cos(a), g.neckTopY + g.neckHalf * Math.sin(a)]);
  }
  // foot left -> foot right, up the right shoulder, over the head right to left, down the left shoulder
  const ring: V2[] = [[g.axis - g.half, g.footY], ...right, [g.axis + g.neckHalf, g.neckTopY], ...head.slice(1, -1), [g.axis - g.neckHalf, g.neckTopY], ...left.slice(0, -1)];
  return dedupe(ring);
}

function dedupe(r: V2[]): V2[] {
  const out: V2[] = [];
  for (const p of r) { const q = out[out.length - 1]; if (!q || Math.hypot(p[0] - q[0], p[1] - q[1]) > 1e-6) out.push(p); }
  const a = out[0], z = out[out.length - 1];
  if (out.length > 1 && Math.hypot(a[0] - z[0], a[1] - z[1]) < 1e-6) out.pop();
  return out;
}

/** True when an outline is mirror-symmetric about `axis` (every vertex has a mirror vertex). */
export function isSymmetric(r: V2[], axis: number, eps = 1e-6): boolean {
  return r.every(p => r.some(q => Math.abs(q[0] - (2 * axis - p[0])) < eps && Math.abs(q[1] - p[1]) < eps));
}

type Col = Parameters<BuildingTools['add']>[1];

/** A gable outline as a solid wall: face `out` proud of the wall plane, `thick` deep behind it. */
export function gableWall(b: BuildingTools, f: Frame, outline: V2[], thick: number, colour: Col, out = 0.05) {
  poly(b, f, 0, 0, outline, thick + out, colour, -thick);
}

/** Pinnacle: square shaft and pyramid cap, its back on the wall plane. */
export function pinnacle(b: BuildingTools, f: Frame, t: number, y0: number, h: number, w: number, shaft: Col, cap: Col, out = 0) {
  slab(b, f, t, y0, w, h, w, shaft, out);
  const capH = w * 1.6;
  const g = new T.ConeGeometry(w * 0.72, capH, 4).rotateY(Math.PI / 4).translate(0, h + capH / 2, w / 2);
  put(b, f, g, t, y0, out, cap);
}

/**
 * Pointed (triangular) topgevel: the gable wall, stone copings along both rakes, a pinnacle on each foot and a finial on
 * the apex. The copings straddle the rake line (half above, half buried) so they share no plane with the wall.
 */
export function pointedGable(b: BuildingTools, f: Frame, g: PointedGableSpec, o: {wall: Col; coping: Col; thick?: number; out?: number; feet?: boolean; finial?: number}) {
  const thick = o.thick ?? 0.45, out = o.out ?? 0.05;
  gableWall(b, f, pointedGableOutline(g), thick, o.wall, out);
  const rise = g.apexY - g.footY, run = g.half, L = Math.hypot(run, rise), a = Math.atan2(rise, run);
  for (const s of [-1, 1] as const) {
    const cg = new T.BoxGeometry(L + 0.1, 0.24, thick + out + 0.12).translate(0, 0, (thick + out + 0.12) / 2);
    cg.rotateZ(s < 0 ? a : -a);
    put(b, f, cg, g.axis + s * run / 2, g.footY + rise / 2, -thick, o.coping);
  }
  if (o.feet ?? true) for (const s of [-1, 1]) pinnacle(b, f, g.axis + s * (g.half - 0.15), g.footY - 0.4, 1.3, 0.38, o.wall, o.coping, out + 0.02);
  const fin = o.finial ?? 0.9;
  if (fin > 0) slab(b, f, g.axis, g.apexY - 0.1, 0.26, fin, 0.3, o.coping, out - 0.1);
}
