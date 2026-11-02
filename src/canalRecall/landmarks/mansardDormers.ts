/**
 * A steep mansard run above a cornice with box dormers standing in it: the slope around the dormers, each dormer's two
 * cheeks, its flat cap (top, fascia, soffit) and the rectangle of its front, which the caller cuts windows into with
 * holedWall.ts. Pure geometry in wall-local coordinates, no three.js, same convention as holedWall.ts:
 *   t  along the wall, from the viewer's left end (0) to the right end (len), facing the wall from outside;
 *   y  up;
 *   o  out of the wall (0 = wall plane, negative = into the building).
 *
 * Why (2026-11-02, Kinkerstraat 32-54 lane #211): the 1990s urban-renewal blocks of Oud-West finish their brick fronts
 * with a grey cornice and a zinc mansard about a metre deep and three high, with flat-topped zinc dormers standing on the
 * cornice line (Kinkerstraat 32-54: five dormers on the street front, two on the Da Costakade, one on the Da Costastraat).
 * The kit had no mansard: builders either drew a vertical top storey (the photo shows a receding slope with sky above it)
 * or hand-placed sloped boxes that z-fight where the dormer meets the slope. Here the slope is cut around every dormer, so
 * nothing overlaps and every surface winds outward.
 */
export type V3 = [number, number, number];
export type MansardPoly = {pts: V3[]; normal: V3};
export interface MansardDormer {
  t0: number;
  t1: number;
  /** Height of the dormer's flat top (must lie between the mansard's foot and top). */
  top: number;
  /** o of the dormer front plane; defaults to the slope foot (oFoot). */
  front?: number;
}
export interface MansardOptions {
  /** Foot of the slope: height and o (usually just behind the cornice's back edge). */
  yFoot: number;
  oFoot: number;
  /** Top of the slope (the flat roof's edge) and how far behind the foot it lies (> 0). */
  yTop: number;
  depth: number;
  dormers?: MansardDormer[];
  /** Cap: overhang past the front and the cheeks, and its thickness. */
  capOverhang?: number;
  capThickness?: number;
}
export interface MansardRun {
  /** The slope, with the dormers cut out. */
  slope: MansardPoly[];
  /** Two per dormer (left facing -t, right facing +t). */
  cheeks: MansardPoly[];
  /** Per dormer: top, front fascia, two side fascias, front soffit, two side soffits. */
  caps: MansardPoly[];
  /** Per dormer: the front rectangle (cut windows into it with holedWall, at o = `o`). */
  fronts: {t0: number; t1: number; y0: number; y1: number; o: number}[];
}

/** Newell normal of a planar polygon, unit length. */
export function polyNormal(pts: V3[]): V3 {
  let x = 0, y = 0, z = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    x += (a[1] - b[1]) * (a[2] + b[2]);
    y += (a[2] - b[2]) * (a[0] + b[0]);
    z += (a[0] - b[0]) * (a[1] + b[1]);
  }
  const l = Math.hypot(x, y, z) || 1;
  return [x / l, y / l, z / l];
}
/** Area of a planar polygon. */
export function polyArea(pts: V3[]): number {
  let x = 0, y = 0, z = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    x += (a[1] - b[1]) * (a[2] + b[2]);
    y += (a[2] - b[2]) * (a[0] + b[0]);
    z += (a[0] - b[0]) * (a[1] + b[1]);
  }
  return Math.hypot(x, y, z) / 2;
}
/** Wind `pts` so its Newell normal agrees with `normal`. */
function oriented(pts: V3[], normal: V3): MansardPoly {
  const n = polyNormal(pts);
  return {pts: n[0] * normal[0] + n[1] * normal[1] + n[2] * normal[2] < 0 ? [...pts].reverse() : pts, normal};
}

/** Mansard run from t 0..len. Dormers may not overlap each other; they are clipped to the run. */
export function mansardDormers(len: number, o: MansardOptions): MansardRun {
  const {yFoot, oFoot, yTop, depth} = o;
  if (!(yTop > yFoot) || !(depth > 0)) throw Error('mansardDormers: yTop must exceed yFoot and depth must be > 0');
  const rise = yTop - yFoot, ov = o.capOverhang ?? 0.12, th = o.capThickness ?? 0.12;
  const at = (s: number): [number, number] => [yFoot + s * rise, oFoot - s * depth];
  const sOf = (y: number) => (y - yFoot) / rise;
  const ds = (o.dormers ?? [])
    .map(d => ({...d, t0: Math.max(0, d.t0), t1: Math.min(len, d.t1), front: d.front ?? oFoot}))
    .filter(d => d.t1 - d.t0 > 1e-6)
    .sort((a, b) => a.t0 - b.t0);
  for (const d of ds) if (!(d.top > yFoot && d.top <= yTop + 1e-9)) throw Error(`mansardDormers: dormer top ${d.top} outside ${yFoot}..${yTop}`);
  for (let i = 1; i < ds.length; i++) if (ds[i].t0 < ds[i - 1].t1 - 1e-6) throw Error('mansardDormers: dormers overlap');

  // Slope: the (t, s) rectangle minus the dormer rectangles [t0, t1] x [0, sTop], merged into runs along t per s band.
  const cuts = ds.map(d => ({t0: d.t0, t1: d.t1, s1: Math.min(1, sOf(d.top))}));
  const ts = [...new Set([0, len, ...cuts.flatMap(c => [c.t0, c.t1])])].sort((a, b) => a - b);
  const ss = [...new Set([0, 1, ...cuts.map(c => c.s1)])].sort((a, b) => a - b);
  const solid = (t: number, s: number) => !cuts.some(c => t > c.t0 && t < c.t1 && s < c.s1);
  const slope: MansardPoly[] = [];
  const slopeNormal = ((): V3 => { const l = Math.hypot(depth, rise); return [0, depth / l, rise / l]; })();
  for (let r = 0; r + 1 < ss.length; r++) {
    const sm = (ss[r] + ss[r + 1]) / 2, [ya, oa] = at(ss[r]), [yb, ob] = at(ss[r + 1]);
    let start = -1;
    for (let c = 0; c + 1 <= ts.length; c++) {
      const isSolid = c + 1 < ts.length && solid((ts[c] + ts[c + 1]) / 2, sm);
      if (isSolid && start < 0) start = c;
      if (!isSolid && start >= 0) {
        const t0 = ts[start], t1 = ts[c];
        slope.push(oriented([[t0, ya, oa], [t1, ya, oa], [t1, yb, ob], [t0, yb, ob]], slopeNormal));
        start = -1;
      }
    }
  }

  const cheeks: MansardPoly[] = [], caps: MansardPoly[] = [], fronts: MansardRun['fronts'] = [];
  for (const d of ds) {
    const [, oBack] = at(Math.min(1, sOf(d.top)));
    for (const [t, nx] of [[d.t0, -1], [d.t1, 1]] as const) {
      // (y, o) outline: front foot, front top, back top on the slope, slope foot (dropped when it equals the front foot)
      const ring: [number, number][] = [[yFoot, d.front], [d.top, d.front], [d.top, oBack], [yFoot, oFoot]];
      const pts = ring.filter((p, i) => i < 3 || Math.abs(p[1] - d.front) > 1e-9).map(([y, oo]): V3 => [t, y, oo]);
      cheeks.push(oriented(pts, [nx, 0, 0]));
    }
    // cap: a flat slab from the overhanging front edge back to where its top meets the slope
    const a0 = d.t0 - ov, a1 = d.t1 + ov, of = d.front + ov, y1 = d.top + th, [, oCapBack] = at(Math.min(1, sOf(y1)));
    const ob = Math.min(oCapBack, oBack);
    caps.push(oriented([[a0, y1, of], [a1, y1, of], [a1, y1, ob], [a0, y1, ob]], [0, 1, 0]));
    caps.push(oriented([[a0, d.top, of], [a1, d.top, of], [a1, y1, of], [a0, y1, of]], [0, 0, 1]));
    caps.push(oriented([[a0, d.top, of], [a0, d.top, ob], [a0, y1, ob], [a0, y1, of]], [-1, 0, 0]));
    caps.push(oriented([[a1, d.top, of], [a1, d.top, ob], [a1, y1, ob], [a1, y1, of]], [1, 0, 0]));
    caps.push(oriented([[a0, d.top, of], [a1, d.top, of], [a1, d.top, d.front], [a0, d.top, d.front]], [0, -1, 0]));
    // soffits of the side overhangs, back to the slope
    for (const [s0, s1] of [[a0, d.t0], [d.t1, a1]]) caps.push(oriented([[s0, d.top, d.front], [s1, d.top, d.front], [s1, d.top, oBack], [s0, d.top, oBack]], [0, -1, 0]));
    fronts.push({t0: d.t0, t1: d.t1, y0: yFoot, y1: d.top, o: d.front});
  }
  return {slope, cheeks, caps, fronts};
}

/**
 * The run's cross-section behind the slope at one end (t = `t`), facing `side` (-1 left end, +1 right end): the wedge
 * between the slope and the plane of the flat roof's edge. Close a free end with it; an end against a taller wall needs none.
 */
export function mansardEnd(t: number, side: -1 | 1, o: Pick<MansardOptions, 'yFoot' | 'oFoot' | 'yTop' | 'depth'>): MansardPoly {
  return oriented([[t, o.yFoot, o.oFoot], [t, o.yTop, o.oFoot - o.depth], [t, o.yFoot, o.oFoot - o.depth]], [side, 0, 0]);
}
