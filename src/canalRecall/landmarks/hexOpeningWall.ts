/**
 * A flat wall band with stretched-hexagon openings cut through it: the wall face around the openings, the six reveals
 * of every opening and the recessed glass (or void) at the opening's depth.
 *
 * Why (Tolhuis Paviljoen lane, 2026-11-02): Arthur Staal's former Shell canteen at IJpromenade 2 carries a row of
 * pointed hexagonal windows in the dark exposed-aggregate parapet of its canal-side modules (panorama
 * TMX7316010203-000353_pano_0000_001026, six across 23 m). `holedWall` cuts only rectangles, and a glass hexagon laid on
 * an unholed band z-fights and has no reveal. Pure geometry in wall-local coordinates, no three.js, same frame as
 * `holedWall`:
 *   t  along the wall, from the viewer's left end (0) to the right end (len), facing the wall from outside;
 *   y  up;
 *   o  out of the wall (0 = wall plane, negative = into the building).
 * Every triangle is listed counter-clockwise seen from where its normal points.
 *
 * The hexagon is a box `t0..t1` x `y0..y1` with its left and right ends pointed: the tips sit at mid-height, `tip`
 * metres in from the box ends (tip = 0 gives a rectangle).
 */
export type HexOpening = {t0: number; t1: number; y0: number; y1: number; tip: number; depth: number};
export type V3 = [number, number, number];
export type Tri = {pts: [V3, V3, V3]; normal: V3};
export type HexOpeningWall = {face: Tri[]; reveals: Tri[][]; backs: Tri[][]};

/** The six corners of an opening, counter-clockwise seen from outside (+o), starting at the left tip. */
export function hexCorners(o: HexOpening): [number, number][] {
  const ym = (o.y0 + o.y1) / 2;
  return [[o.t0, ym], [o.t0 + o.tip, o.y0], [o.t1 - o.tip, o.y0], [o.t1, ym], [o.t1 - o.tip, o.y1], [o.t0 + o.tip, o.y1]];
}

const tri = (a: V3, b: V3, c: V3, normal: V3): Tri => ({pts: [a, b, c], normal});
const rect = (t0: number, t1: number, y0: number, y1: number, out: Tri[]) => {
  if (t1 - t0 < 1e-9 || y1 - y0 < 1e-9) return;
  out.push(tri([t0, y0, 0], [t1, y0, 0], [t1, y1, 0], [0, 0, 1]), tri([t0, y0, 0], [t1, y1, 0], [t0, y1, 0], [0, 0, 1]));
};

/**
 * Wall from t 0..len, y y0..y1 with hexagon `openings` cut through it. Openings must lie inside the wall and must not
 * overlap each other in t (they are cut column by column); either is a caller error and throws.
 */
export function hexOpeningWall(len: number, y0: number, y1: number, openings: HexOpening[]): HexOpeningWall {
  const ops = [...openings].sort((a, b) => a.t0 - b.t0);
  for (const o of ops) {
    if (o.t0 < -1e-9 || o.t1 > len + 1e-9 || o.y0 < y0 - 1e-9 || o.y1 > y1 + 1e-9) throw Error('hexOpeningWall: opening outside the wall');
    if (o.tip < 0 || 2 * o.tip > o.t1 - o.t0 + 1e-9 || o.depth <= 0) throw Error('hexOpeningWall: bad opening shape');
  }
  for (let i = 1; i < ops.length; i++) if (ops[i].t0 < ops[i - 1].t1 - 1e-9) throw Error('hexOpeningWall: openings overlap along the wall');
  const face: Tri[] = [];
  // solid columns between openings, full height
  let t = 0;
  for (const o of ops) { rect(t, o.t0, y0, y1, face); t = o.t1; }
  rect(t, len, y0, y1, face);
  // each opening's column: above, below and the four corner triangles beside the pointed ends
  for (const o of ops) {
    rect(o.t0, o.t1, o.y1, y1, face);
    rect(o.t0, o.t1, y0, o.y0, face);
    if (o.tip > 1e-9) {
      const ym = (o.y0 + o.y1) / 2, a = o.t0 + o.tip, b = o.t1 - o.tip, n: V3 = [0, 0, 1];
      face.push(tri([o.t0, o.y0, 0], [a, o.y0, 0], [o.t0, ym, 0], n));   // lower left
      face.push(tri([o.t0, ym, 0], [a, o.y1, 0], [o.t0, o.y1, 0], n));   // upper left
      face.push(tri([b, o.y0, 0], [o.t1, o.y0, 0], [o.t1, ym, 0], n));   // lower right
      face.push(tri([o.t1, ym, 0], [o.t1, o.y1, 0], [b, o.y1, 0], n));   // upper right
    }
  }
  const reveals = ops.map(o => {
    const c = hexCorners(o), d = -o.depth, out: Tri[] = [];
    for (let i = 0; i < c.length; i++) {
      const p = c[i], q = c[(i + 1) % c.length];
      if (Math.hypot(q[0] - p[0], q[1] - p[1]) < 1e-9) continue;
      // the hexagon runs counter-clockwise seen from outside, so its inward normal is the edge direction turned left
      const ex = q[0] - p[0], ey = q[1] - p[1], l = Math.hypot(ex, ey), n: V3 = [-ey / l, ex / l, 0];
      out.push(tri([p[0], p[1], 0], [q[0], q[1], d], [p[0], p[1], d], n), tri([p[0], p[1], 0], [q[0], q[1], 0], [q[0], q[1], d], n));
    }
    return out;
  });
  const backs = ops.map(o => {
    const c = hexCorners(o).filter((p, i, a) => i === 0 || Math.hypot(p[0] - a[i - 1][0], p[1] - a[i - 1][1]) > 1e-9), d = -o.depth, out: Tri[] = [];
    for (let i = 1; i + 1 < c.length; i++) out.push(tri([c[0][0], c[0][1], d], [c[i][0], c[i][1], d], [c[i + 1][0], c[i + 1][1], d], [0, 0, 1]));
    return out;
  });
  return {face, reveals, backs};
}

/** Geometric normal of a triangle from its winding, unit length. */
export function triNormal(t: Tri): V3 {
  const [a, b, c] = t.pts, u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
  const n: V3 = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]], l = Math.hypot(...n) || 1;
  return [n[0] / l, n[1] / l, n[2] / l];
}

/** Triangle area. */
export function triArea(t: Tri): number {
  const [a, b, c] = t.pts, u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
  return Math.hypot(u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]) / 2;
}

/** Area of a stretched hexagon opening. */
export const hexArea = (o: HexOpening) => (o.t1 - o.t0 - o.tip) * (o.y1 - o.y0);
