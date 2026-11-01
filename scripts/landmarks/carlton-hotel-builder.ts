import * as T from 'three';
import polygonClipping, {type Polygon} from 'polygon-clipping';
import type {BuildingTools} from './cultural-builders';
import {put, ringFrame, setSink, slab, type Frame} from './nearbar-kit';
import {bayPrism} from './big-kit';
import {exposedRuns, inRing, type Piece, type Pt, type Run} from '../../src/canalRecall/landmarks/terraceBands';
import {runFrame, slopedPrism} from './plan-prism';
import source from './carlton-hotel-footprints.json';

/**
 * Carlton Hotel, Vijzelstraat 4 / Singel 550 at the Muntplein (BAG pand 0363100012168111, one pand: the 1926-1928 hotel by
 * G.J. Rutgers north of the Reguliersdwarsstraat, the block bridging that street, and the later annex south of it). Native
 * east/south metres from the BAG vertex average (scripts/landmarks/vijzelstraat-prepare.ts), y up from the 3DBAG ground.
 *
 * Massing: one prism per 3DBAG LoD2.2 roof piece (CC BY 4.0) with its top on the roof plane; sloped pieces (the mansard over
 * the Vijzelstraat front) keep their slope but start at the photographed eave (26.3 m), not 3DBAG's 22.5 m. The ground storey
 * is cut back 3 m behind the arcade on the Vijzelstraat and the Muntplein and left open under the Reguliersdwarsstraat bridge.
 *
 * The Vijzelstraat front of the hotel (ring edge 7, 51.7 m) is drawn from the rectified 2024 panorama
 * (b_20241203_1333_Track15_Sphere_00264, 32.8 px/m, Gemeente Amsterdam CC BY 4.0) and Commons "Jolly Carlton Hotel Rutgers"
 * (Brbbl, CC BY-SA 3.0) / "Vijzelstraat 4 Amsterdam" (Marion Golsteijn, CC BY-SA 3.0):
 *  - a grey concrete arcade: seven piers that widen into pointed (five-sided) arches, under a band to 7.9 m;
 *  - twelve bays at 4.05 m: a low mezzanine window, a wide window with a pointed top and a white sill, a stone pendant
 *    between bays, then three storeys of canted brick oriels (a front light and a narrow light in each cheek) on stone consoles, grey stone fins between the oriels at the top, a coping at 26.3 m;
 *  - the mansard roof behind.
 * Other faces: punched white-framed windows on the hotel's storey lines; ribbon windows on the post-war annex at the south
 * end (south of z = 26 m: the pale banded block of panorama TMX7316060226-000019_pano_0000_005187, left of the Carlton's
 * south corner tower).
 */
type Src = {surfaces: {type: string; rings: number[][][]}[]; facadeRing: number[][]; neighbours: {id: string; height: number; ring: Pt[]}[]};
const src = source as unknown as Src;

const ARC = {top: 6.3, band: 7.9, depth: 3.0};
const EAVE = 26.3;
const FRONT = ringFrame(src.facadeRing, 7);
/** Arcade pier centres on the front, metres from its south end (viewer-left). */
const PIERS = [0.55, 2.9, 10.8, 18.6, 26.3, 33.7, 41.2, 48.8, FRONT.len - 0.55];
/** Bay centres (mezzanine, pointed windows, oriels): twelve at 4.05 m. */
const BAYS = [...Array(12)].map((_, k) => 3.6 + 4.05 * k);
/** Hotel storey windows (bottom, height) above the arcade. */
const ROWS = [{y: 8.0, h: 1.2}, {y: 9.7, h: 2.0}, {y: 14.3, h: 2.0}, {y: 17.8, h: 2.0}, {y: 21.3, h: 2.0}];
/** The annex south of the Reguliersdwarsstraat: storey ribbons. */
const ANNEX_ROWS = [8.4, 11.6, 14.8, 18.0, 21.2];
const ORIEL = {y0: 13.9, y1: 24.1, w: 3.3, proj: 0.75, bevel: 0.6};
const FR = 0.07, GL = 0.13;

const at = (f: Frame, t: number, o: number): Pt => [f.origin[0] + f.tangent[0] * t + f.n[0] * o, f.origin[1] + f.tangent[1] * t + f.n[1] * o];
const quadOn = (f: Frame, t0: number, t1: number, o0: number, o1: number): Polygon => [[at(f, t0, o0), at(f, t1, o0), at(f, t1, o1), at(f, t0, o1), at(f, t0, o0)]];
const open = (r: Pt[]) => (r.length > 1 && r[0][0] === r.at(-1)![0] && r[0][1] === r.at(-1)![1] ? r.slice(0, -1) : r);
const closed = (r: Pt[]): Pt[] => [...r, r[0]];
const area = (r: Pt[]) => Math.abs(r.reduce((a, p, i) => { const q = r[(i + 1) % r.length]; return a + p[0] * q[1] - q[0] * p[1]; }, 0) / 2);

/** The north (Muntplein) end: the line of ring edge 13 run out to the NE corner (15.9, -54.5). */
const NORTH: Frame = (() => {
  const {f} = ringFrame(src.facadeRing, 13), c: Pt = [15.9, -54.5];
  const t = (c[0] - f.origin[0]) * f.tangent[0] + (c[1] - f.origin[1]) * f.tangent[1];
  const o = (c[0] - f.origin[0]) * f.n[0] + (c[1] - f.origin[1]) * f.n[1];
  return {origin: at(f, t, o), tangent: f.tangent, n: f.n};
})();
/** The Reguliersdwarsstraat under the bridge: between ring edges 3 (Vijzelstraat side) and 23 (Singel side), run 2 m out. */
const PASSAGE: Polygon = [[[9.8, -2.5], [7.5, 11.0], [-13.8, 7.1], [-11.6, -6.0], [9.8, -2.5]]];

/** Least-squares roof plane y = a x + b z + c of a 3DBAG roof ring. */
function plane(r: number[][]): (x: number, z: number) => number {
  const n = r.length, mx = r.reduce((s, p) => s + p[0], 0) / n, mz = r.reduce((s, p) => s + p[2], 0) / n, my = r.reduce((s, p) => s + p[1], 0) / n;
  let sxx = 0, sxz = 0, szz = 0, sxy = 0, szy = 0;
  for (const p of r) { const x = p[0] - mx, z = p[2] - mz, y = p[1] - my; sxx += x * x; sxz += x * z; szz += z * z; sxy += x * y; szy += z * y; }
  const det = sxx * szz - sxz * sxz;
  if (Math.abs(det) < 1e-6) return () => my;
  const a = (sxy * szz - szy * sxz) / det, b2 = (szy * sxx - sxy * sxz) / det;
  return (x, z) => my + a * (x - mx) + b2 * (z - mz);
}

/** A white frame with glass proud of it, on frame f at (t, y) and `out` from it. */
function windowOn(b: BuildingTools, f: Frame, t: number, y: number, w: number, h: number, out: number) {
  slab(b, f, t, y, w, h, FR, 'white', out);
  slab(b, f, t, y + 0.09, w - 0.18, h - 0.18, GL, 'glass', out);
}

/** Five-sided outline: a rectangle w x hs with a pointed top rising to h at the middle, bottom-centre at the origin. */
const pointed = (w: number, hs: number, h: number) => [[-w / 2, 0], [w / 2, 0], [w / 2, hs], [0, h], [-w / 2, hs]] as Pt[];

export function buildCarltonHotel(_w: number, _d: number, b: BuildingTools & {mark?: (n: string) => void}) {
  // ---- plan ----
  const ring: Polygon = [closed(src.facadeRing.map(p => [p[0], p[1]] as Pt))];
  const e0 = ringFrame(src.facadeRing, 0), e37 = ringFrame(src.facadeRing, 37);
  const arcade = polygonClipping.union(quadOn(FRONT.f, -2, FRONT.len + 1, -ARC.depth, 10), quadOn(NORTH, -1, 18.5, -ARC.depth, 10),
    quadOn(e0.f, -1, e0.len + 1, -ARC.depth, 10), quadOn(e37.f, -2, e37.len + 1, -ARC.depth, 10));
  const ground = polygonClipping.difference(ring, arcade, PASSAGE);

  // ---- pieces: one per 3DBAG roof piece; higher pieces keep overlapping plan; sloped pieces start at the eave ----
  type P = Piece & {topAt: (x: number, z: number) => number; annex: boolean};
  const raw: {poly: Polygon; topAt: (x: number, z: number) => number; max: number}[] = [];
  for (const s of src.surfaces) {
    if (s.type !== 'RoofSurface') continue;
    const r0 = s.rings[0], ys = r0.map(p => p[1]), lo = Math.min(...ys), hi = Math.max(...ys);
    const plan = open(r0.map(p => [p[0], p[2]] as Pt));
    if (plan.length < 3 || area(plan) < 2) continue;
    const pl = plane(r0), sloped = hi - lo > 2;
    const topAt = sloped ? (x: number, z: number) => Math.min(hi, Math.max(EAVE, pl(x, z))) : () => (lo + hi) / 2;
    // a hole in a 3DBAG roof ring is kept only where another roof piece fills it (a lower court roof); an unfilled hole (the
    // tower's mast well, a roof light) would be an open shaft down to the arcade soffit, so it is closed
    const filled = (h: number[][]) => {
      const hp = h.map(p => [p[0], p[2]] as Pt);
      return src.surfaces.some(o => {
        if (o === s || o.type !== 'RoofSurface') return false;
        const r = o.rings[0], cx = r.reduce((q, p) => q + p[0], 0) / r.length, cz = r.reduce((q, p) => q + p[2], 0) / r.length;
        let ar = 0;
        for (let i = 0; i < r.length; i++) { const q = r[(i + 1) % r.length]; ar += r[i][0] * q[2] - q[0] * r[i][2]; }
        return Math.abs(ar / 2) >= 2 && inRing(hp, cx, cz);
      });
    };
    const holes = s.rings.slice(1).filter(filled).map(h => closed(open(h.map(p => [p[0], p[2]] as Pt))));
    raw.push({poly: [closed(plan), ...holes], topAt, max: sloped ? hi : (lo + hi) / 2});
  }
  raw.sort((a, c) => c.max - a.max);
  const taken: Polygon[] = [], pieces: P[] = [];
  for (const r of raw) {
    const rest = taken.length ? polygonClipping.difference(r.poly, ...taken) : [r.poly];
    taken.push(r.poly);
    for (const pg of rest) {
      const outer = open(pg[0] as Pt[]);
      if (area(outer) < 0.5 || r.max <= ARC.top + 0.5) continue;
      const cz = outer.reduce((s, p) => s + p[1], 0) / outer.length;
      pieces.push({ring: outer, holes: pg.slice(1).map(h => open(h as Pt[])), base: ARC.top, top: r.max, topAt: r.topAt, annex: cz > 26});
    }
  }
  const groundPieces: Piece[] = ground.map(pg => ({ring: open(pg[0] as Pt[]), holes: pg.slice(1).map(h => open(h as Pt[])), base: 0, top: ARC.top}));
  for (const pg of ground) slopedPrism(b, pg as Pt[][], 0, () => ARC.top, 'brick', null, null);
  // the post-war annex reads grey (concrete bands and glass ribbons, panoramas b_20241203_1333_Track15_Sphere_00249 and w06), the hotel brick
  for (const p of pieces) slopedPrism(b, [p.ring, ...(p.holes ?? [])], p.base, p.topAt, p.annex ? 'concrete' : 'brick', 'slate', 'concrete');
  b.mark?.('shell');

  setSink(0);
  const blocked = (x: number, z: number, y: number) => src.neighbours.some(n => n.height > y && inRing(n.ring, x, z));
  const onFront = (r: Run) => {
    const f = FRONT.f, d = r.n[0] * f.n[0] + r.n[1] * f.n[1];
    const o = (p: Pt) => (p[0] - f.origin[0]) * f.n[0] + (p[1] - f.origin[1]) * f.n[1];
    return d > 0.99 && Math.abs(o(r.a)) < 1.2 && Math.abs(o(r.b)) < 1.2;
  };

  // ---- Vijzelstraat front: arcade face with pointed openings and the band over it ----
  {
    const {f, len} = FRONT;
    const shape = new T.Shape([new T.Vector2(0, 0), new T.Vector2(len, 0), new T.Vector2(len, ARC.band), new T.Vector2(0, ARC.band)]);
    for (let k = 0; k + 1 < PIERS.length; k++) {
      const a = PIERS[k] + (k === 0 ? 0.35 : 0.55), c = PIERS[k + 1] - (k + 2 === PIERS.length ? 0.35 : 0.55), w = c - a, m = (a + c) / 2;
      const top = w > 4 ? 5.75 : 4.6, spring = w > 4 ? 3.9 : 3.6, inset = Math.min(0.7, w * 0.12);
      shape.holes.push(new T.Path([[a, 0], [c, 0], [c - inset, spring], [m, top], [a + inset, spring]].reverse().map(([x, y]) => new T.Vector2(x, y))));
    }
    const g = new T.ExtrudeGeometry(shape, {depth: 0.6, bevelEnabled: false});
    put(b, f, g, 0, 0, -0.3, 'concrete');
    b.mark?.('arcade');

    // mezzanine and pointed windows, sills, pendants
    for (const t of BAYS) {
      windowOn(b, f, t, ROWS[0].y, 1.5, ROWS[0].h, 0);
      const outer = pointed(3.0, 1.9, 2.65), inner = pointed(2.8, 1.8, 2.5);
      const fr = new T.ExtrudeGeometry(new T.Shape(outer.map(([x, y]) => new T.Vector2(x, y))), {depth: FR, bevelEnabled: false});
      put(b, f, fr, t, ROWS[1].y, 0, 'white');
      const gl = new T.ExtrudeGeometry(new T.Shape(inner.map(([x, y]) => new T.Vector2(x, y))), {depth: GL, bevelEnabled: false});
      put(b, f, gl, t, ROWS[1].y + 0.08, 0, 'glass');
      slab(b, f, t, ROWS[1].y - 0.3, 3.3, 0.3, 0.28, 'stone', 0);
    }
    for (let k = 0; k <= BAYS.length; k++) {
      const t = k === 0 ? BAYS[0] - 2.025 : BAYS[k - 1] + 2.025;
      slab(b, f, t, 12.55, 0.5, 0.6, 0.3, 'stone', 0);
    }
    // oriels on stone consoles, windows in the front and in both cheeks (the panorama shows the cheeks that face its camera)
    for (const t of BAYS) {
      bayPrism(b, f, t, ORIEL.y0, ORIEL.w, ORIEL.y1 - ORIEL.y0, ORIEL.proj, ORIEL.bevel, 'brick', 0.3);
      slab(b, f, t - ORIEL.w / 2 + 0.5, ORIEL.y0 - 0.5, 0.45, 0.5, 0.55, 'stone', 0);
      slab(b, f, t + ORIEL.w / 2 - 0.5, ORIEL.y0 - 0.5, 0.45, 0.5, 0.55, 'stone', 0);
      for (const r of ROWS.slice(2)) windowOn(b, f, t, r.y, 1.5, r.h, ORIEL.proj);
      for (const side of [1, -1]) {
        // cheek from (t + side (w/2 - bevel), proj) to (t + side w/2, 0); outward normal (side proj, bevel) in (tangent, n)
        const cl = Math.hypot(ORIEL.proj, ORIEL.bevel);
        const n: Pt = [(f.tangent[0] * side * ORIEL.proj + f.n[0] * ORIEL.bevel) / cl, (f.tangent[1] * side * ORIEL.proj + f.n[1] * ORIEL.bevel) / cl];
        const tan: Pt = [n[1], -n[0]];
        const A = at(f, t + side * (ORIEL.w / 2 - ORIEL.bevel), ORIEL.proj), B = at(f, t + side * ORIEL.w / 2, 0);
        const ta = A[0] * tan[0] + A[1] * tan[1], tb = B[0] * tan[0] + B[1] * tan[1];
        const cheek: Frame = {origin: ta < tb ? A : B, tangent: tan, n};
        const faceLen = Math.hypot(B[0] - A[0], B[1] - A[1]);
        for (const r of ROWS.slice(2)) windowOn(b, cheek, faceLen / 2, r.y, 0.62, r.h, 0);
      }
    }
    // stone fins between the oriels at the top, and the coping
    for (let k = 0; k <= BAYS.length; k++) {
      const t = k === 0 ? BAYS[0] - 2.025 : BAYS[k - 1] + 2.025;
      slab(b, f, t, 22.6, 0.45, EAVE - 22.6 + 0.4, 0.55, 'stone', 0);
    }
    slab(b, f, len / 2, EAVE - 0.3, len, 0.35, 0.25, 'stone', 0);
    b.mark?.('front');
  }

  // ---- every other exposed face: punched windows on the hotel's storey lines, ribbons on the annex ----
  for (const row of ROWS) {
    for (const r of exposedRuns(pieces, row.y + row.h / 2, {blocked})) {
      if (onFront(r) || (pieces[r.piece] as P).annex) continue;
      const {f, len} = runFrame(r);
      if (len < 2) continue;
      const n = Math.max(1, Math.round(len / 3.1));
      for (let k = 0; k < n; k++) windowOn(b, f, (k + 0.5) * len / n, row.y, Math.min(1.3, len / n - 0.6), row.h, 0);
    }
  }
  for (const y of ANNEX_ROWS) {
    for (const r of exposedRuns(pieces, y + 1, {blocked})) {
      if (!(pieces[r.piece] as P).annex || pieces[r.piece].top < y + 2.4) continue;
      const {f, len} = runFrame(r);
      if (len < 2) continue;
      const n = Math.max(1, Math.round(len / 4.2));
      for (let k = 0; k < n; k++) windowOn(b, f, (k + 0.5) * len / n, y, len / n - 0.4, 2.0, 0);
      slab(b, f, len / 2, y + 2.25, len, 0.35, 0.12, 'stone', 0);
    }
  }
  // ground storey: dark shopfronts on every exposed ground wall (behind the arcade, under the bridge, the Singel side)
  for (const r of exposedRuns(groundPieces, 2, {blocked})) {
    const {f, len} = runFrame(r);
    const n = Math.max(1, Math.round(len / 4.0));
    for (let k = 0; k < n; k++) {
      const a = k * len / n + 0.3, c = (k + 1) * len / n - 0.3;
      if (c - a > 0.6) slab(b, f, (a + c) / 2, 0.3, c - a, 3.4, 0.12, 'dark', 0);
    }
  }
  // square piers carrying the upper storeys over the gallery south of the bridge (ring edges 0 and 37)
  for (const e of [0, 37]) {
    const {f, len} = ringFrame(src.facadeRing, e), n = Math.max(1, Math.round(len / 7.5));
    for (let k = 0; k <= n; k++) slab(b, f, Math.min(len - 0.5, Math.max(0.5, k * len / n)), 0, 0.9, ARC.top, 0.9, 'concrete', -0.9);
  }
  // Muntplein arcade piers (the corner piers and one between)
  for (const t of [0.5, 9, 17.5]) slab(b, NORTH, t, 0, 1.1, ARC.top, 0.9, 'concrete', -0.9);
  slab(b, NORTH, 9, ARC.top, 18, ARC.band - ARC.top, 0.35, 'concrete', 0);
  b.mark?.('faces');

  // ---- tower mast on the 38.8 m tower: four steel posts and three rings (slate slot: dark steel, not an opening) ----
  {
    const c: Pt = [-0.5, -44.5], s = 1.3, y0 = 38.8, h = 6;
    for (const [dx, dz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      b.add(new T.BoxGeometry(0.14, h, 0.14).translate(c[0] + dx * s, y0 + h / 2, c[1] + dz * s), 'slate' as never);
    }
    for (const y of [y0 + 2, y0 + 4, y0 + h - 0.1]) {
      for (const [dx, dz, w, d] of [[0, -1, 2 * s, 0.1], [0, 1, 2 * s, 0.1], [-1, 0, 0.1, 2 * s], [1, 0, 0.1, 2 * s]]) {
        b.add(new T.BoxGeometry(w, 0.1, d).translate(c[0] + dx * s, y, c[1] + dz * s), 'slate' as never);
      }
    }
  }

}
