import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {poly, put, slab, ringSlab, type Frame} from './nearbar-kit';

/**
 * Vingboons-type neck gable (halsgevel) on a canal front: the full-width wall stops at the shoulder line, a neck one
 * to three bays wide rises to a crowning cornice with a triangular pediment (fronton), and concave claw pieces
 * (klauwstukken) fill the shoulders between the house edge and the neck, each ending in a scroll at its foot.
 * Written for the Cromhouthuizen (Herengracht 364-370, Philips Vingboons 1660-62, four sandstone neck gables) and
 * usable for any neck-gabled canal house: the shapes are pure functions of measured heights and half-widths, so a
 * builder passes what it read off a rectified photo and gets back solids on its wall frame.
 *
 * Coordinates: wall frame (nearbar-kit `Frame`), t along the wall to the viewer's right, y up from the pavement, the
 * wall plane at out = 0 and the building behind it. Every solid has its back on or behind the plane; ornament stands
 * at least 5 cm proud.
 */
export type V2 = [number, number];

export interface NeckGableSpec {
  /** Party lines of the house (t), left and right. */
  x0: number;
  x1: number;
  /** Neck axis (t) and half-width of the neck shaft. */
  axis: number;
  neckHalf: number;
  /** Top of the full-width wall at the house edges, where each claw starts. */
  shoulderY: number;
  /** Height where the claw meets the neck side. */
  clawTopY: number;
  /** Underside of the crowning cornice, its height and half-width (it overhangs the neck). */
  corniceY: number;
  corniceH: number;
  corniceHalf: number;
  /** Apex of the triangular pediment over the cornice. */
  apexY: number;
  /** Wall thickness of the gable solids (they stand behind the wall plane). */
  thick?: number;
  /**
   * Crown over the cornice: 'triangle' (default, a fronton: Cromhouthuizen) or 'segment', a segmental (arched)
   * pediment whose arc rises from the cornice ends to apexY (Odeon, Singel 460, Vingboons 1662).
   */
  crown?: 'triangle' | 'segment';
}

/** Concave claw outline on one side, closed polygon in (t, y): foot at the house edge, top against the neck side. */
export function clawOutline(g: NeckGableSpec, side: -1 | 1, steps = 8): V2[] {
  const edge = side < 0 ? g.x0 : g.x1, neck = g.axis + side * g.neckHalf;
  const dx = neck - edge, dy = g.clawTopY - g.shoulderY;
  const curve: V2[] = [];
  // starts flat at the edge and turns vertical against the neck (a quarter of an ellipse, concave to the sky)
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * Math.PI / 2;
    curve.push([edge + dx * Math.sin(a), g.shoulderY + dy * (1 - Math.cos(a))]);
  }
  const ring: V2[] = [[edge, g.shoulderY], ...curve.slice(1), [neck, g.shoulderY]];
  // counter-clockwise in (t, y) for ExtrudeGeometry
  return signedArea(ring) < 0 ? ring.reverse() : ring;
}

/** Pediment over the crowning cornice, closed polygon in (t - axis, y - corniceTop): a triangle, or a circular segment. */
export function pedimentOutline(g: NeckGableSpec, steps = 10): V2[] {
  const h = g.apexY - (g.corniceY + g.corniceH);
  if (g.crown !== 'segment') return [[-g.corniceHalf, 0], [g.corniceHalf, 0], [0, h]];
  const out: V2[] = [];
  for (let i = 0; i <= steps; i++) { const x = g.corniceHalf * (2 * i / steps - 1); out.push([x, segmentY(g, x)]); }
  return out.reverse(); // right to left over the top, closing along the cornice: counter-clockwise
}

/** Height of a segmental crown's arc over the cornice top at offset x from the axis (0 at the cornice ends, h at the axis). */
export function segmentY(g: NeckGableSpec, x: number) {
  const h = g.apexY - (g.corniceY + g.corniceH), c = g.corniceHalf, R = (c * c + h * h) / (2 * h);
  return Math.max(0, h - R + Math.sqrt(Math.max(0, R * R - x * x)));
}

export function signedArea(r: V2[]) {
  let s = 0;
  for (let i = 0; i < r.length; i++) { const a = r[i], b = r[(i + 1) % r.length]; s += a[0] * b[1] - b[0] * a[1]; }
  return s / 2;
}

/** The silhouette the gable presents above the shoulder line, left edge to right edge (for checks and tests). */
export function gableSilhouette(g: NeckGableSpec): V2[] {
  const left = clawOutline(g, -1).filter(p => p[1] > g.shoulderY - 1e-9 && !(Math.abs(p[0] - (g.axis - g.neckHalf)) < 1e-9 && Math.abs(p[1] - g.shoulderY) < 1e-9));
  const leftCurve = left.sort((a, b) => a[0] - b[0]);
  const right = clawOutline(g, 1).filter(p => !(Math.abs(p[0] - (g.axis + g.neckHalf)) < 1e-9 && Math.abs(p[1] - g.shoulderY) < 1e-9)).sort((a, b) => a[0] - b[0]);
  const top = g.corniceY + g.corniceH;
  const crown: V2[] = g.crown === 'segment' ? pedimentOutline(g).slice().reverse().map(([x, y]) => [g.axis + x, top + y] as V2) : [[g.axis - g.corniceHalf, top], [g.axis, g.apexY], [g.axis + g.corniceHalf, top]];
  return [...leftCurve, [g.axis - g.neckHalf, g.corniceY], [g.axis - g.corniceHalf, g.corniceY], ...crown,
    [g.axis + g.corniceHalf, g.corniceY], [g.axis + g.neckHalf, g.corniceY], ...right];
}

type Col = Parameters<BuildingTools['add']>[1];

/**
 * Builds the gable solids: claws, neck shaft, crowning cornice and pediment, the scroll at each claw foot and a
 * moulded rim along each claw curve. Openings and carving are the caller's (they differ per house).
 */
export function neckGable(b: BuildingTools, f: Frame, g: NeckGableSpec, o: {wall?: Col; trim?: Col; neck?: Col} = {}) {
  const wall = o.wall ?? 'stone', trim = o.trim ?? wall, th = g.thick ?? 0.5;
  for (const side of [-1, 1] as const) poly(b, f, 0, 0, clawOutline(g, side), th, wall, -th);
  // neck shaft from the shoulder line to the cornice (its own colour when the neck is brick between stone claws)
  slab(b, f, g.axis, g.shoulderY, g.neckHalf * 2, g.corniceY - g.shoulderY, th, o.neck ?? wall, -th);
  // crowning cornice (proud of the neck on all sides) and the pediment with a raking moulding
  slab(b, f, g.axis, g.corniceY, g.corniceHalf * 2, g.corniceH, th + 0.3, trim, -th);
  poly(b, f, g.axis, g.corniceY + g.corniceH, pedimentOutline(g), th + 0.15, wall, -th);
  if (g.crown === 'segment') {
    // arched moulding: short blocks along the arc, standing proud of the tympanum like the raking mouldings
    const arc = pedimentOutline(g).slice().reverse();
    for (let i = 0; i + 1 < arc.length; i++) {
      const [a, c] = [arc[i], arc[i + 1]], L = Math.hypot(c[0] - a[0], c[1] - a[1]);
      const m = new T.BoxGeometry(L + 0.06, 0.16, th + 0.4).translate(0, 0.08, (th + 0.4) / 2).rotateZ(Math.atan2(c[1] - a[1], c[0] - a[0]));
      put(b, f, m, g.axis + (a[0] + c[0]) / 2, g.corniceY + g.corniceH + (a[1] + c[1]) / 2 - 0.08, -th, trim);
    }
  } else {
    const rise = g.apexY - g.corniceY - g.corniceH, len = Math.hypot(g.corniceHalf, rise), ang = Math.atan2(rise, g.corniceHalf);
    for (const s of [-1, 1]) {
      const m = new T.BoxGeometry(len + 0.1, 0.16, th + 0.4).translate(0, 0.08, (th + 0.4) / 2).rotateZ(s * ang);
      put(b, f, m, g.axis - s * g.corniceHalf / 2, g.corniceY + g.corniceH + rise / 2 - 0.08, -th, trim);
    }
  }
  // claw rim: short stone blocks along the curve, standing 8 cm proud of the claw face, and the scroll at the foot
  for (const side of [-1, 1] as const) {
    const r = clawOutline(g, side, 8).filter(p => !(p[1] === g.shoulderY));
    for (let i = 0; i + 1 < r.length; i++) {
      const [a, c] = [r[i], r[i + 1]], L = Math.hypot(c[0] - a[0], c[1] - a[1]);
      if (L < 0.05) continue;
      const blk = new T.BoxGeometry(L + 0.04, 0.16, 0.16).translate(0, -0.08, 0.04).rotateZ(Math.atan2(c[1] - a[1], c[0] - a[0]));
      put(b, f, blk, (a[0] + c[0]) / 2, (a[1] + c[1]) / 2, 0, trim);
    }
    const edge = side < 0 ? g.x0 : g.x1, foot = edge - side * 0.45;
    put(b, f, new T.CylinderGeometry(0.28, 0.28, 0.2, 12).rotateX(Math.PI / 2).translate(0, 0, 0.06), foot, g.shoulderY + 0.32, 0, trim);
    ringSlab(b, f, foot, g.shoulderY + 0.32, 0.12, 0.2, 0.3, trim, -0.04, 10);
  }
}
