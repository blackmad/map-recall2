/**
 * A flat wall with round-headed and pointed (lancet) openings cut through it: the wall face around the openings, the
 * reveals of every opening (jambs, sill and the curved soffit of the head) and the recessed glass, void or door at the
 * opening's depth.
 *
 * Why (Hofkerk lane, 2026-11-02): Kropholler's Hofkerk on the Linnaeushof reads by its arched openings: three pointed
 * portals and lancets in the closed west front, rows of round-headed lights between the aisle buttresses, graded
 * round-headed lancets in the crossing tower and the paired round-headed belfry openings (panoramas
 * recording_2024-09-17_09-46-52_01528, recording_2025-06-26_11-50-11_00779). `holedWall` cuts only rectangles and
 * `hexOpeningWall` only hexagons; an arched glass sheet laid on an unholed wall z-fights and has no reveal. Pure geometry
 * in wall-local coordinates, no three.js, the same frame as `holedWall`:
 *   t  along the wall, from the viewer's left end (0) to the right end (len), facing the wall from outside;
 *   y  up;
 *   o  out of the wall (0 = wall plane, negative = into the building).
 * Every triangle is listed counter-clockwise seen from where its normal points.
 *
 * An opening is a box `t0..t1` x `y0..y1` whose head is a two-centred arch reaching the apex `y1` at mid-width. Each
 * half is a circular arc of radius `arch * width` centred on the springing line at the opposite side's distance:
 * `arch = 0.5` (the default) is a semicircle, `arch = 1` the equilateral pointed arch, values in between are blunt
 * lancets; `arch = 0` is a flat head (a plain rectangle), so square windows and doors can share the wall with the
 * arches. Openings may share columns (a clerestory light above an aisle light) but must not touch or overlap.
 *
 * `rise` (optional, 0 < rise <= width / 2) makes the head a segmental ("gedrukte", depressed) arch instead: one circular arc
 * through both springing points and the apex `y1`, rising `rise` above the springing line, its centre below the springing
 * line on the centre line (rise = width / 2 is the semicircle). Added for the Tetterode type foundry (Da Costakade 146 lane,
 * 2026-11-02): its 1902 Bilderdijkstraat front is described by the monument register (524828) as "grote vensters met gedrukte
 * toging" and its 1898 dairy front by three "brede gedrukte bogen"; a semicircle on those 4-6 m wide workshop windows would
 * rise 2-3 m instead of the photographed ~0.6-1 m. `arch` is ignored when `rise` is set; openings without `rise` are drawn
 * exactly as before.
 */
export type ArchOpening = {t0: number; t1: number; y0: number; y1: number; depth: number; arch?: number; segments?: number; rise?: number};
export type V3 = [number, number, number];
export type Tri = {pts: [V3, V3, V3]; normal: V3};
export type ArchOpeningWall = {face: Tri[]; reveals: Tri[][]; backs: Tri[][]};

const EPS = 1e-9;
const tri = (a: V3, b: V3, c: V3, normal: V3): Tri => ({pts: [a, b, c], normal});
const OUT: V3 = [0, 0, 1];

/** Rise of the head (apex above the springing line) for a width and radius factor. */
export function archRise(width: number, arch = 0.5): number {
  const r = arch * width, off = r - width / 2;
  return Math.sqrt(Math.max(0, r * r - off * off));
}

/** Springing height of an opening (where the jambs end and the head begins). */
export const springing = (o: ArchOpening) => o.y1 - (o.rise !== undefined ? o.rise : archRise(o.t1 - o.t0, o.arch));

/** Radius of a segmental head of half-width `half` rising `rise`. */
export const segmentalRadius = (half: number, rise: number) => (half * half + rise * rise) / (2 * rise);

/** Top edge of the opening at t (t inside t0..t1): the jamb top on the springing line plus the arc. */
export function headAt(o: ArchOpening, t: number): number {
  if (o.rise !== undefined) {
    const half = (o.t1 - o.t0) / 2, R = segmentalRadius(half, o.rise), dt = t - (o.t0 + o.t1) / 2;
    return o.y1 - R + Math.sqrt(Math.max(0, R * R - dt * dt));
  }
  const w = o.t1 - o.t0, r = (o.arch ?? 0.5) * w, ys = springing(o), mid = (o.t0 + o.t1) / 2;
  const c = t <= mid ? o.t0 + r : o.t1 - r;            // the left half is drawn about a centre on the right, and vice versa
  return ys + Math.sqrt(Math.max(0, r * r - (t - c) * (t - c)));
}

/** Sample t values of the head from t0 to t1: `segments` per half (default 6), apex included. */
function headTs(o: ArchOpening): number[] {
  if (o.rise !== undefined) {
    // equal angle steps on the one arc, `segments` per half, apex included
    const n = Math.max(1, o.segments ?? 6), half = (o.t1 - o.t0) / 2, mid = (o.t0 + o.t1) / 2, R = segmentalRadius(half, o.rise);
    const phi = Math.asin(Math.min(1, half / R)), xs: number[] = [];
    for (let k = -n; k <= n; k++) xs.push(mid + R * Math.sin(phi * k / n));
    xs[0] = o.t0; xs[n] = mid; xs[2 * n] = o.t1;
    return xs;
  }
  if (o.arch === 0) return [o.t0, o.t1];
  const n = Math.max(1, o.segments ?? 6), w = o.t1 - o.t0, r = (o.arch ?? 0.5) * w, mid = (o.t0 + o.t1) / 2;
  // equal angle steps on each arc: the left arc runs from angle a0 (at t0) to a1 (at the apex) about centre t0 + r
  const a0 = Math.PI, a1 = Math.acos(Math.min(1, Math.max(-1, (mid - (o.t0 + r)) / r)));
  const left: number[] = [];
  for (let k = 0; k <= n; k++) left.push(o.t0 + r + r * Math.cos(a0 + (a1 - a0) * k / n));
  left[0] = o.t0; left[n] = mid;
  const right = left.slice(0, n).reverse().map(t => o.t0 + o.t1 - t);
  return [...left, ...right];
}

/** Top edge of the sampled outline at t: linear between the head samples, so the face meets the reveals without cracks. */
export function sampledHeadAt(o: ArchOpening, t: number): number {
  const xs = headTs(o);
  for (let k = 0; k + 1 < xs.length; k++) if (t <= xs[k + 1] + EPS) {
    const a = xs[k], b = xs[k + 1], ha = k === 0 ? springing(o) : headAt(o, a), hb = k + 2 === xs.length ? springing(o) : headAt(o, b);
    return b - a < EPS ? ha : ha + (hb - ha) * (t - a) / (b - a);
  }
  return springing(o);
}

/** The opening outline, counter-clockwise seen from outside: sill left, sill right, up the right jamb, over the head. */
export function archOutline(o: ArchOpening): [number, number][] {
  const ys = springing(o), head = headTs(o).reverse().map(t => [t, headAt(o, t)] as [number, number]);
  head[0][1] = ys; head[head.length - 1][1] = ys;
  const pts: [number, number][] = [[o.t0, o.y0], [o.t1, o.y0]];
  if (ys - o.y0 > EPS) pts.push(...head); else pts.push(...head.slice(1, -1));
  return pts.filter((p, i, a) => i === 0 || Math.hypot(p[0] - a[i - 1][0], p[1] - a[i - 1][1]) > EPS);
}

function rect(t0: number, t1: number, y0: number, y1: number, out: Tri[]) {
  if (t1 - t0 < EPS || y1 - y0 < EPS) return;
  out.push(tri([t0, y0, 0], [t1, y0, 0], [t1, y1, 0], OUT), tri([t0, y0, 0], [t1, y1, 0], [t0, y1, 0], OUT));
}

/**
 * Wall from t 0..len, y y0..y1 with arched `openings` cut through it. An opening outside the wall, two openings that touch
 * or overlap, a radius factor below 0.5 (other than 0), a head taller than the opening or a non-positive depth is a caller error and
 * throws.
 */
export function archOpeningWall(len: number, y0: number, y1: number, openings: ArchOpening[]): ArchOpeningWall {
  for (const o of openings) {
    if (o.t0 < -EPS || o.t1 > len + EPS || o.y0 < y0 - EPS || o.y1 > y1 + EPS) throw Error('archOpeningWall: opening outside the wall');
    const badRise = o.rise !== undefined && (!(o.rise > EPS) || o.rise > (o.t1 - o.t0) / 2 + EPS);
    const badArch = o.rise === undefined && o.arch !== 0 && (o.arch ?? 0.5) < 0.5 - EPS;
    if (o.t1 - o.t0 < EPS || o.depth <= 0 || badArch || badRise || springing(o) < o.y0 - 1e-6) throw Error('archOpeningWall: bad opening shape');
  }
  for (let i = 0; i < openings.length; i++) for (let j = i + 1; j < openings.length; j++) {
    const a = openings[i], b = openings[j];
    if (a.t0 <= b.t1 + EPS && b.t0 <= a.t1 + EPS && a.y0 <= b.y1 + EPS && b.y0 <= a.y1 + EPS) throw Error(`archOpeningWall: openings ${i} and ${j} touch or overlap`);
  }
  // Face: horizontal bands between every opening's sill and apex level; in each band the wall is solid outside the boxes
  // (t0..t1 x y0..y1) of the openings that reach into it, so storeys without openings are one strip the length of the wall.
  // Long strips keep the wall's plane exact once positions are quantized (narrow columns of a 1 m pier tilt by degrees at
  // 4 mm steps and the geometry audit then splits the wall). The part of each box above its arch is filled by two fans from
  // the box's top corners.
  const ys = [...new Set([y0, y1, ...openings.flatMap(o => [o.y0, o.y1])])].sort((a, b) => a - b);
  const face: Tri[] = [];
  for (let k = 0; k + 1 < ys.length; k++) {
    const ya = ys[k], yb = ys[k + 1];
    if (yb - ya < EPS) continue;
    const busy = openings.filter(o => o.y0 < yb - EPS && o.y1 > ya + EPS).map(o => [o.t0, o.t1]).sort((p, q) => p[0] - q[0]);
    let t = 0;
    for (const [a, c] of busy) { rect(t, a, ya, yb, face); t = Math.max(t, c); }
    rect(t, len, ya, yb, face);
  }
  for (const o of openings) {
    if (o.arch === 0 && o.rise === undefined) continue;
    const xs = headTs(o), mid = (o.t0 + o.t1) / 2, L: V3 = [o.t0, o.y1, 0], R: V3 = [o.t1, o.y1, 0];
    const h = (t: number, i: number) => (i === 0 || i === xs.length - 1 ? springing(o) : headAt(o, t));
    for (let i = 0; i + 1 < xs.length; i++) {
      const p: V3 = [xs[i], h(xs[i], i), 0], q: V3 = [xs[i + 1], h(xs[i + 1], i + 1), 0];
      const corner = xs[i + 1] <= mid + EPS ? L : R;
      if (triArea(tri(p, q, corner, OUT)) > 1e-9) face.push(tri(p, q, corner, OUT));
    }
    face.push(tri([mid, o.y1, 0], R, L, OUT));            // zero area (apex on y1): dropped below
  }
  for (let i = face.length - 1; i >= 0; i--) if (triArea(face[i]) < 1e-9) face.splice(i, 1);
  const reveals = openings.map(o => {
    const c = archOutline(o), d = -o.depth, out: Tri[] = [];
    for (let i = 0; i < c.length; i++) {
      const p = c[i], q = c[(i + 1) % c.length];
      // the outline runs counter-clockwise seen from outside, so the edge direction turned left points into the opening
      const ex = q[0] - p[0], ey = q[1] - p[1], l = Math.hypot(ex, ey), n: V3 = [-ey / l, ex / l, 0];
      out.push(tri([p[0], p[1], 0], [q[0], q[1], d], [p[0], p[1], d], n), tri([p[0], p[1], 0], [q[0], q[1], 0], [q[0], q[1], d], n));
    }
    return out;
  });
  // Backs: the outline is convex (a rectangle under two arcs that meet at the apex), so a fan from the sill's left corner covers it.
  const backs = openings.map(o => {
    const c = archOutline(o), d = -o.depth, out: Tri[] = [];
    for (let i = 1; i + 1 < c.length; i++) out.push(tri([c[0][0], c[0][1], d], [c[i][0], c[i][1], d], [c[i + 1][0], c[i + 1][1], d], OUT));
    return out;
  });
  return {face, reveals, backs};
}

/** Area enclosed by an opening's sampled outline (what the face loses and the back covers). */
export function archArea(o: ArchOpening): number {
  const c = archOutline(o);
  let s = 0;
  for (let i = 0; i < c.length; i++) { const p = c[i], q = c[(i + 1) % c.length]; s += p[0] * q[1] - q[0] * p[1]; }
  return s / 2;
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
