import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {put, slab} from './nearbar-kit';
import type {Frame} from './nearbar-kit';

/**
 * Pointed-arch and elliptical helpers for the brick-Gothic church fronts (Fatih Mosque). Same wall-frame convention as
 * nearbar-kit: t along the wall (viewer's right), y up, back face on the wall plane.
 */
type Col = string;

/** Filled pointed-arch slab, bottom at y, width w, height h (including the pointed head of height `rise`). */
export function pointedSlab(b: BuildingTools, f: Frame, t: number, y: number, w: number, h: number, rise: number, d: number, colour: Col, out = 0) {
  const ys = h - rise, dd = (rise * rise - (w / 2) * (w / 2)) / w, R = w / 2 + dd;
  const a1 = Math.atan2(rise, dd), n = 8;
  const s = new T.Shape();
  s.moveTo(-w / 2, 0); s.lineTo(w / 2, 0); s.lineTo(w / 2, ys);
  for (let i = 1; i <= n; i++) { const a = a1 * i / n; s.lineTo(-dd + R * Math.cos(a) * 1, ys + R * Math.sin(a)); }
  // right arc has centre (-dd, ys); reflect for the left half
  for (let i = n - 1; i >= 0; i--) { const a = a1 * i / n; s.lineTo(dd - R * Math.cos(a), ys + R * Math.sin(a)); }
  s.lineTo(-w / 2, 0);
  put(b, f, new T.ExtrudeGeometry(s, {depth: d, bevelEnabled: false}), t, y, out, colour);
}

/** Pointed-arch band (outline of thickness th, open at the bottom). */
export function pointedBand(b: BuildingTools, f: Frame, t: number, y: number, w: number, h: number, rise: number, th: number, d: number, colour: Col, out = 0) {
  const outer = archOutline(w, h, rise), inner = archOutline(w - 2 * th, h - th, Math.max(0.2, rise - th * 0.5));
  const ring = [...outer, ...inner.slice().reverse()];
  put(b, f, new T.ExtrudeGeometry(new T.Shape(ring.map(p => new T.Vector2(p[0], p[1]))), {depth: d, bevelEnabled: false}), t, y, out, colour);
}

/** Left base, up the left jamb, over the two arcs, down the right jamb to the right base. */
function archOutline(w: number, h: number, rise: number): [number, number][] {
  const ys = h - rise, dd = (rise * rise - (w / 2) * (w / 2)) / w, R = w / 2 + dd, a1 = Math.atan2(rise, dd), n = 8;
  const pts: [number, number][] = [[-w / 2, 0], [-w / 2, ys]];
  for (let i = 1; i <= n; i++) { const a = a1 * i / n; pts.push([dd - R * Math.cos(a), ys + R * Math.sin(a)]); }
  for (let i = n - 1; i >= 1; i--) { const a = a1 * i / n; pts.push([-dd + R * Math.cos(a), ys + R * Math.sin(a)]); }
  pts.push([w / 2, ys], [w / 2, 0]);
  return pts;
}

/** Elliptical disc facing out of the wall, centre height y. */
export function ellipseSlab(b: BuildingTools, f: Frame, t: number, y: number, rx: number, ry: number, d: number, colour: Col, out = 0) {
  const s = new T.Shape(); s.absellipse(0, 0, rx, ry, 0, Math.PI * 2, false, 0);
  put(b, f, new T.ExtrudeGeometry(s, {depth: d, bevelEnabled: false, curveSegments: 24}), t, y, out, colour);
}

/** Elliptical ring facing out of the wall. */
export function ellipseRing(b: BuildingTools, f: Frame, t: number, y: number, rx0: number, ry0: number, rx1: number, ry1: number, d: number, colour: Col, out = 0) {
  const s = new T.Shape(); s.absellipse(0, 0, rx1, ry1, 0, Math.PI * 2, false, 0);
  const hole = new T.Path(); hole.absellipse(0, 0, rx0, ry0, 0, Math.PI * 2, true, 0); s.holes.push(hole);
  put(b, f, new T.ExtrudeGeometry(s, {depth: d, bevelEnabled: false, curveSegments: 24}), t, y, out, colour);
}

/** A thin bar between two points in the wall plane. */
export function bar(b: BuildingTools, f: Frame, t0: number, y0: number, t1: number, y1: number, th: number, d: number, colour: Col, out = 0) {
  const len = Math.hypot(t1 - t0, y1 - y0), ang = Math.atan2(y1 - y0, t1 - t0);
  put(b, f, new T.BoxGeometry(len, th, d).rotateZ(ang).translate(0, 0, d / 2), (t0 + t1) / 2, (y0 + y1) / 2, out, colour);
}

/** Frame for a face with outward normal n through point p (native east/south metres); t measured from p. */
export function frameAt(p: [number, number], n: [number, number]): Frame {
  const l = Math.hypot(n[0], n[1]);
  const nn: [number, number] = [n[0] / l, n[1] / l];
  return {origin: p, tangent: [nn[1], -nn[0]], n: nn};
}

/** Lancet window: stone surround band, glass, centre mullion and a sill. */
export function lancet(b: BuildingTools, f: Frame, t: number, y: number, w: number, h: number, rise: number, o: {surround?: Col; sill?: Col; glass?: Col; frame?: Col; mullion?: boolean} = {}) {
  if (o.surround) pointedBand(b, f, t, y - 0.02, w + 0.3, h + 0.16, rise + 0.1, 0.12, 0.1, o.surround);
  pointedSlab(b, f, t, y, w, h, rise, 0.1, o.frame ?? 'frame');
  pointedSlab(b, f, t, y + 0.06, w - 0.12, h - 0.1, rise - 0.04, 0.12, o.glass ?? 'glass');
  if (o.mullion !== false) slab(b, f, t, y, 0.05, h - rise, 0.15, o.frame ?? 'frame');
  if (o.sill) slab(b, f, t, y - 0.12, w + 0.4, 0.1, 0.2, o.sill);
}
