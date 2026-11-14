/**
 * A pointed-arch (lancet) dormer standing in a steep mansard: the front frame (the ring between the arch outline and
 * the inset window outline), the recessed window panel, and the arched roof (one quad per outline segment, from the
 * front plane back into the slope). Pure geometry in wall-local coordinates, no three.js, the convention of
 * holedWall.ts and mansardDormers.ts:
 *   t  along the wall, from the viewer's left end (0) to the right end (len), facing the wall from outside;
 *   y  up;
 *   o  out of the wall (0 = wall plane, negative = into the building).
 *
 * Why (2026-11-13, Houthavens landmark lane, Hotel Boat&Co on the Revaleiland): Kollhoff's hotel ends every bay of its
 * zinc mansard in a tall dormer whose head is a pointed arch, and its two corner pavilions carry one wide pointed-arch
 * dormer each. mansardDormers.ts only draws flat-topped box dormers; a box with a triangle on top read as a cottage
 * gable on the gallery card, not as the lancet outline of the panoramas.
 *
 * The arch: two circular arcs springing at `ySpring` from the dormer's sides and meeting at `yApex` on its centre line.
 * Each arc's centre lies on the springing line on the far side of the centre line (a lancet), at
 * c = (h^2 - r^2) / (2 r) from the centre for half-width r and rise h; h = r gives a round head (c = 0).
 */
export type V3 = [number, number, number];
export type Quad = {pts: V3[]; normal: V3};

export interface PointedDormerOptions {
  /** Centre of the dormer along the wall. */
  t: number;
  /** Outer width of the dormer front. */
  width: number;
  /** Bottom of the dormer front (the sill line, at or above the mansard foot). */
  y0: number;
  /** Height where the sides end and the arch begins. */
  ySpring: number;
  /** Height of the arch apex (>= ySpring + width / 2). */
  yApex: number;
  /** o of the front plane. */
  front: number;
  /** How far the roof and cheeks run back from the front (into the slope; the hidden end is left open). */
  depth: number;
  /** Width of the frame around the window (sides and arch); the sill strip is `frame` too. */
  frame?: number;
  /** How far the window panel sits behind the front. */
  recess?: number;
  /** Arc segments per side (default 6). */
  segments?: number;
}
export interface PointedDormer {
  /** Front frame quads (outward +o). */
  frame: Quad[];
  /** Window reveal quads (inside the frame, from the front back to the panel). */
  reveal: Quad[];
  /** Window panel outline at o = front - recess, from the left foot over the arch to the right foot (triangulate it facing +o). */
  window: V3[];
  /** Roof and cheek quads following the outline, front to back (outward). */
  roof: Quad[];
  /** The outline used (t, y) from the left foot round the arch to the right foot. */
  outline: [number, number][];
}

/** Lancet outline from the left springing point over the apex to the right one, (t, y), `segments` per side. */
export function lancetArc(t: number, halfWidth: number, ySpring: number, yApex: number, segments = 6): [number, number][] {
  const r = halfWidth, h = yApex - ySpring;
  if (!(r > 0) || !(h >= r - 1e-9)) throw new Error(`lancetArc: rise ${h} must be at least the half-width ${r}`);
  const c = (h * h - r * r) / (2 * r), R = c + r;
  const left: [number, number][] = [], right: [number, number][] = [];
  // Left arc: centre (t + c, ySpring), from angle pi (the left foot) to the apex angle.
  const a1 = Math.atan2(h, -c);
  for (let i = 0; i <= segments; i++) {
    const a = Math.PI + (a1 - Math.PI) * (i / segments);
    left.push([t + c + R * Math.cos(a), ySpring + R * Math.sin(a)]);
  }
  for (let i = segments - 1; i >= 0; i--) right.push([2 * t - left[i][0], left[i][1]]);
  left[segments] = [t, yApex];
  return [...left, ...right];
}

const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = (v: V3): V3 => { const l = Math.hypot(...v) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
/** Quad a,b,c,d (counter-clockwise seen from its outside). */
const quad = (a: V3, b: V3, c: V3, d: V3): Quad => ({pts: [a, b, c, d], normal: unit(cross(sub(b, a), sub(d, a)))});

export function pointedDormer(o: PointedDormerOptions): PointedDormer {
  const seg = o.segments ?? 6, fw = o.frame ?? 0.18, recess = o.recess ?? 0.12, r = o.width / 2;
  if (!(o.ySpring > o.y0)) throw new Error('pointedDormer: ySpring must be above y0');
  if (!(fw > 0 && fw < r)) throw new Error('pointedDormer: frame must be between 0 and the half-width');
  if (!(o.depth > 0)) throw new Error('pointedDormer: depth must be positive');
  const arc = lancetArc(o.t, r, o.ySpring, o.yApex, seg);
  // Inner outline: same springing line, half-width r - fw, apex lowered by fw (the frame keeps its width at the apex
  // to within the arc's curvature; exact offset curves are not needed at the scale of a dormer).
  const inner = lancetArc(o.t, r - fw, o.ySpring, o.yApex - fw, seg);
  const outline: [number, number][] = [[o.t - r, o.y0], ...arc, [o.t + r, o.y0]];
  const inl: [number, number][] = [[o.t - r + fw, o.y0 + fw], ...inner, [o.t + r - fw, o.y0 + fw]];
  const F = o.front, B = o.front - o.depth, W = o.front - recess;
  const P = (p: [number, number], z: number): V3 => [p[0], p[1], z];
  const frame: Quad[] = [];
  // Ring between outline and inner outline: the two lists have equal length; walk from left foot to right foot.
  for (let i = 0; i + 1 < outline.length; i++) frame.push(quad(P(outline[i], F), P(inl[i], F), P(inl[i + 1], F), P(outline[i + 1], F)));
  // Sill strip closes the ring at the bottom.
  frame.push(quad(P([o.t + r, o.y0], F), P(inl[inl.length - 1], F), P(inl[0], F), P([o.t - r, o.y0], F)));
  // Reveals of the window: inner outline from the front back to the panel, facing into the opening.
  const reveal: Quad[] = [];
  const ring = [...inl, inl[0]];
  for (let i = 0; i + 1 < ring.length; i++) reveal.push(quad(P(ring[i], F), P(ring[i], W), P(ring[i + 1], W), P(ring[i + 1], F)));
  // Roof and cheeks: the outer outline swept back from the front plane.
  const roof: Quad[] = [];
  for (let i = 0; i + 1 < outline.length; i++) roof.push(quad(P(outline[i], B), P(outline[i], F), P(outline[i + 1], F), P(outline[i + 1], B)));
  return {frame, reveal, window: inl.map(p => P(p, W)), roof, outline};
}
