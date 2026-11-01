/**
 * A flat wall with rectangular openings cut through it: the wall face around the openings, the four reveals of every
 * opening and the recessed back panel (glass, a dark void, a door) at the opening's depth.
 *
 * Why: bespoke builders mostly lay window sheets a few centimetres proud of an unholed wall, which z-fights at distance
 * and cannot show a deep reveal. Modern fronts (Het Marnix's ribbon window and curtain walls, the Bungehuis's deep
 * stone-framed windows) read by their depth, so the opening is cut. Pure geometry in wall-local coordinates, no three.js:
 *   t  along the wall, from the viewer's left end (0) to the right end (len), facing the wall from outside;
 *   y  up;
 *   o  out of the wall (0 = wall plane, negative = into the building).
 * (t, y, o) is right-handed, so a quad listed counter-clockwise seen from where its normal points is front-facing.
 */
export type HoledOpening = {t0: number; t1: number; y0: number; y1: number; depth: number};
export type WallQuad = {pts: [number, number, number][]; normal: [number, number, number]};
export type HoledWall = {face: WallQuad[]; reveals: WallQuad[][]; backs: WallQuad[]};

const quad = (pts: [number, number, number][], normal: [number, number, number]): WallQuad => ({pts, normal});
/** Counter-clockwise rectangle in a plane of constant o, facing +o. */
const faceRect = (t0: number, t1: number, y0: number, y1: number, o: number) =>
  quad([[t0, y0, o], [t1, y0, o], [t1, y1, o], [t0, y1, o]], [0, 0, 1]);

/**
 * Wall from t 0..len, y y0..y1 with `openings` cut through it. Openings are clipped to the wall; overlapping openings are
 * a caller error and throw. Openings may touch each other or the wall edge (no face strip is emitted there; a reveal is
 * emitted only where the opening borders solid wall or a shallower neighbour).
 */
export function holedWall(len: number, y0: number, y1: number, openings: HoledOpening[]): HoledWall {
  const ops = openings
    .map(o => ({...o, t0: Math.max(0, o.t0), t1: Math.min(len, o.t1), y0: Math.max(y0, o.y0), y1: Math.min(y1, o.y1)}))
    .filter(o => o.t1 - o.t0 > 1e-6 && o.y1 - o.y0 > 1e-6);
  for (let i = 0; i < ops.length; i++) for (let j = i + 1; j < ops.length; j++) {
    const a = ops[i], b = ops[j];
    if (a.t0 < b.t1 - 1e-6 && b.t0 < a.t1 - 1e-6 && a.y0 < b.y1 - 1e-6 && b.y0 < a.y1 - 1e-6) throw Error(`holedWall: openings ${i} and ${j} overlap`);
  }
  // Face: split the wall into a grid on every opening edge, keep the solid cells, merge runs along t per row.
  const ts = [...new Set([0, len, ...ops.flatMap(o => [o.t0, o.t1])])].sort((a, b) => a - b);
  const ys = [...new Set([y0, y1, ...ops.flatMap(o => [o.y0, o.y1])])].sort((a, b) => a - b);
  const solid = (t: number, y: number) => !ops.some(o => t > o.t0 && t < o.t1 && y > o.y0 && y < o.y1);
  const face: WallQuad[] = [];
  for (let r = 0; r + 1 < ys.length; r++) {
    const ym = (ys[r] + ys[r + 1]) / 2;
    let start = -1;
    for (let c = 0; c + 1 <= ts.length; c++) {
      const isSolid = c + 1 < ts.length && solid((ts[c] + ts[c + 1]) / 2, ym);
      if (isSolid && start < 0) start = c;
      if (!isSolid && start >= 0) { face.push(faceRect(ts[start], ts[c], ys[r], ys[r + 1], 0)); start = -1; }
    }
  }
  // Depth of whatever is beside an opening edge at (t, y): solid wall = 0, another opening = its depth, outside the wall = 0.
  const depthAt = (t: number, y: number) => ops.find(o => t > o.t0 && t < o.t1 && y > o.y0 && y < o.y1)?.depth ?? 0;
  const reveals = ops.map(o => {
    const d = -o.depth, out: WallQuad[] = [];
    const e = 1e-4, tm = (o.t0 + o.t1) / 2, ym = (o.y0 + o.y1) / 2;
    // each reveal runs from the neighbour's depth (0 for solid wall) to this opening's depth; none where the neighbour is as deep or deeper
    const nL = -depthAt(o.t0 - e, ym), nR = -depthAt(o.t1 + e, ym), nB = -depthAt(tm, o.y0 - e), nT = -depthAt(tm, o.y1 + e);
    if (o.t0 > e && nL > d) out.push(quad([[o.t0, o.y0, nL], [o.t0, o.y0, d], [o.t0, o.y1, d], [o.t0, o.y1, nL]], [1, 0, 0]));
    if (o.t1 < len - e && nR > d) out.push(quad([[o.t1, o.y0, d], [o.t1, o.y0, nR], [o.t1, o.y1, nR], [o.t1, o.y1, d]], [-1, 0, 0]));
    if (o.y0 > y0 + e && nB > d) out.push(quad([[o.t0, o.y0, nB], [o.t1, o.y0, nB], [o.t1, o.y0, d], [o.t0, o.y0, d]], [0, 1, 0]));
    if (o.y1 < y1 - e && nT > d) out.push(quad([[o.t0, o.y1, d], [o.t1, o.y1, d], [o.t1, o.y1, nT], [o.t0, o.y1, nT]], [0, -1, 0]));
    return out;
  });
  const backs = ops.map(o => faceRect(o.t0, o.t1, o.y0, o.y1, -o.depth));
  return {face, reveals, backs};
}

/** Geometric normal of a quad from its winding (Newell), unit length. */
export function windingNormal(q: WallQuad): [number, number, number] {
  let x = 0, y = 0, z = 0;
  const p = q.pts;
  for (let i = 0; i < p.length; i++) {
    const a = p[i], b = p[(i + 1) % p.length];
    x += (a[1] - b[1]) * (a[2] + b[2]);
    y += (a[2] - b[2]) * (a[0] + b[0]);
    z += (a[0] - b[0]) * (a[1] + b[1]);
  }
  const l = Math.hypot(x, y, z) || 1;
  return [x / l, y / l, z / l];
}

/** Area of a planar quad (two triangles). */
export function quadArea(q: WallQuad): number {
  const [a, b, c, d] = q.pts;
  const tri = (p: number[], r: number[], s: number[]) => {
    const u = [r[0] - p[0], r[1] - p[1], r[2] - p[2]], v = [s[0] - p[0], s[1] - p[1], s[2] - p[2]];
    return Math.hypot(u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]) / 2;
  };
  return tri(a, b, c) + tri(a, c, d);
}
