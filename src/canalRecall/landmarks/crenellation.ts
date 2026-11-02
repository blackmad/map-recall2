/**
 * Wall-plane outlines for the two castle-like brick motifs of 19th-century eclectic warehouses and towers: the corbel
 * arcade (rondboogfries, a band whose lower edge is a row of small round arches resting on corbels) and the crenellated
 * parapet (kantelen, merlons and crenels along a wall top).
 *
 * Why: the Graansilo Korthals Altes (1896-98) closes every recessed panel of its silo wings with a corbel arcade and
 * crowns its centre tower with a crenellated, arcaded parapet; the register names both ("door rondboogfriezen ...
 * afgesloten spaarvelden", "door kantelen bekroonde lostoren"). The kit had only single arches (archSlab/archBand) and
 * boxes, so a frieze of 5-7 arches per bay cost 5-7 extrusions and a crenellation was a row of loose boxes. These
 * functions return one simple polygon per motif, extruded once by the builder (`poly` in scripts/landmarks/nearbar-kit).
 *
 * Pure geometry, no three.js: points are (t, y) in the wall plane, t along the wall (viewer's left to right), y up,
 * counter-clockwise (positive shoelace area), first point not repeated. Nothing changes for models that do not call them.
 */
export type Pt = [number, number];

export interface ArcadeOptions {
  /** Band extent along the wall. */
  t0: number; t1: number;
  /** Bottom of the corbels and top of the band. */
  y0: number; y1: number;
  /** Number of arches. */
  arches: number;
  /** Corbel width (the pier between two arches); the end corbels are half this wide. */
  corbel: number;
  /** Corbel height: the arches spring at y0 + drop. */
  drop: number;
  /** Segments per semicircle (3 or more). */
  segments?: number;
}

/**
 * Corbel arcade: a band from y0 to y1 whose underside is `arches` round arches springing from corbels. The arch span is
 * the pitch minus one corbel; the arch crown must stay below y1 (throws otherwise).
 */
export function corbelArcadeOutline(o: ArcadeOptions): Pt[] {
  const n = Math.round(o.arches), seg = Math.max(3, Math.round(o.segments ?? 6));
  if (n < 1) throw Error('corbelArcadeOutline: at least one arch');
  if (!(o.t1 > o.t0) || !(o.y1 > o.y0)) throw Error('corbelArcadeOutline: empty band');
  const pitch = (o.t1 - o.t0) / n, span = pitch - o.corbel, r = span / 2, ys = o.y0 + o.drop;
  if (!(span > 0)) throw Error('corbelArcadeOutline: corbels wider than the pitch');
  if (ys + r >= o.y1 - 1e-6) throw Error('corbelArcadeOutline: arch crown reaches the top of the band');
  const pts: Pt[] = [[o.t0, o.y1], [o.t0, o.y0]];
  for (let k = 0; k < n; k++) {
    const a = o.t0 + k * pitch + o.corbel / 2, b = a + span, c = (a + b) / 2;
    pts.push([a, o.y0], [a, ys]);
    for (let i = 1; i < seg; i++) { const th = Math.PI - Math.PI * i / seg; pts.push([c + r * Math.cos(th), ys + r * Math.sin(th)]); }
    pts.push([b, ys], [b, o.y0]);
  }
  pts.push([o.t1, o.y0], [o.t1, o.y1]);
  return dedupe(pts);
}

export interface CrenellationOptions {
  t0: number; t1: number;
  /** Bottom of the parapet, floor of the crenels and top of the merlons. */
  y0: number; yCrenel: number; y1: number;
  /** Number of merlons; the parapet starts and ends with a merlon. */
  merlons: number;
  /** Merlon width as a fraction of the merlon + crenel pitch (0..1). */
  ratio?: number;
}

/** Crenellated parapet: a band from y0 up to the crenel floor, with `merlons` merlons up to y1, ends on a merlon. */
export function crenellationOutline(o: CrenellationOptions): Pt[] {
  const n = Math.round(o.merlons), ratio = o.ratio ?? 0.5;
  if (n < 2) throw Error('crenellationOutline: at least two merlons');
  if (!(o.y0 < o.yCrenel && o.yCrenel < o.y1)) throw Error('crenellationOutline: y0 < yCrenel < y1');
  if (!(ratio > 0 && ratio < 1)) throw Error('crenellationOutline: ratio in (0, 1)');
  // n merlons and n - 1 crenels: n * m + (n - 1) * c = len with m = ratio * (m + c)
  const len = o.t1 - o.t0, pitch = len / (n - 1 + ratio), m = ratio * pitch;
  const a = (k: number) => o.t0 + k * pitch, b = (k: number) => (k === n - 1 ? o.t1 : a(k) + m);
  const pts: Pt[] = [[o.t0, o.y0], [o.t1, o.y0], [o.t1, o.y1]];
  for (let k = n - 1; k >= 1; k--) pts.push([a(k), o.y1], [a(k), o.yCrenel], [b(k - 1), o.yCrenel], [b(k - 1), o.y1]);
  pts.push([o.t0, o.y1]);
  return dedupe(pts);
}

/** Shoelace area (positive for counter-clockwise). */
export function outlineArea(pts: Pt[]): number {
  let s = 0;
  for (let i = 0; i < pts.length; i++) { const p = pts[i], q = pts[(i + 1) % pts.length]; s += p[0] * q[1] - q[0] * p[1]; }
  return s / 2;
}

function dedupe(pts: Pt[]): Pt[] {
  const out: Pt[] = [];
  for (const p of pts) { const q = out[out.length - 1]; if (!q || Math.hypot(p[0] - q[0], p[1] - q[1]) > 1e-9) out.push(p); }
  while (out.length > 1 && Math.hypot(out[0][0] - out[out.length - 1][0], out[0][1] - out[out.length - 1][1]) < 1e-9) out.pop();
  return out;
}
