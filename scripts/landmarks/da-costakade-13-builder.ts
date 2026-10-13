import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import raw from './da-costakade-13-footprints.json';

/**
 * Da Costakade 13 (BAG pand 0363100012166570, oorspronkelijk bouwjaar 1904, ligging "Kopgebouw", five dwellings; 3DBAG 5 bouwlagen,
 * eaves about 13.9 m and ridge about 17.3 m above the pavement). The head of a curved 1904 row: two street walls on the curved
 * Da Costakade (wall 0, the gabled section, facing NNW; wall 1 with the entrance, NW), a blank end wall over the garden (NE), a courtyard
 * wall (SE) and a party wall with Da Costakade 11 (SW).
 *
 * Facade rhythm (artifacts/landmark-lanes/da-costakade-13/ref-*.jpg, municipal panoramas 2020-05-11, 2021-01/03, 2024-12-11):
 *  - wall 0 (4.9 m, NNW): two identical bays symmetric about a pointed brick gable. Ground floor: one tall segmental-headed window per bay
 *    between stepped brick corbels. Floors 1-3: one segmental-headed French window per bay onto its own stone balcony slab (black railing)
 *    carried on stepped brick corbels. Attic: one three-light segmental window centred in the gable, stone coping and finial on top.
 *  - wall 1 (5.6 m, NW): two axes. Wide segmental-headed window (bend side) and a pair of narrow round-headed windows (party-wall side) on
 *    floors 1-3; ground floor: a window under the wide axis and the red double door with fanlight in a round stone arch under the pair.
 *    Eaves cornice (painted) and a slate mansard with one three-light dormer over the wide axis.
 *  - every street opening has a green glazed-brick hood; green glazed bands at sill level on wall 1; grey stone plinth.
 *  - NE end wall: blank brick under the cornice (ivy-covered in every capture), mansard hip above (ref-northeast-2024.jpg).
 *  - INFERRED (no photograph): the SE courtyard wall (two windows per storey and a balcony stack at its east end, whose edge shows in the
 *    north views), and the party wall.
 * Roof from intent, not the 3DBAG mesh: a slate mansard (steep 0.9 m-deep slopes from the 14.0 m eaves to a flat top at 16.4 m) on all
 * free walls, plus the gable's own saddle roof (ridge 17.4 m) running back from wall 0 and hipped into the mansard.
 * Native east/south metres from the BAG ring vertex mean (footprints anchor); y is height above the pavement.
 */
type Col = Parameters<BuildingTools['add']>[1];
const ring = (raw as {nativeRing: number[][]}).nativeRing.slice(0, -1); // closed ring -> open
const N = ring.length;
const E = 14.0, TOP = 16.4, APEX = 17.4, INSET = .9, GROUND = .3, FLOORS = [3.9, 7.3, 10.7];
const cx = ring.reduce((s, p) => s + p[0], 0) / N, cz = ring.reduce((s, p) => s + p[1], 0) / N;

interface Frame {origin: [number, number]; tangent: [number, number]; n: [number, number]; len: number; a: number[]; c: number[]}
/** Frame on ring edge i: t along the wall from ring[i], y up, o outward (o = 0 is the brick face). */
function frame(i: number): Frame {
  const a = ring[i], c = ring[(i + 1) % N], dx = c[0] - a[0], dz = c[1] - a[1], len = Math.hypot(dx, dz);
  const tangent: [number, number] = [dx / len, dz / len];
  const n: [number, number] = [-tangent[1], tangent[0]]; // put() convention: tangent = [n.z, -n.x]
  const mx = (a[0] + c[0]) / 2 - cx, mz = (a[1] + c[1]) / 2 - cz;
  if (n[0] * mx + n[1] * mz < 0) throw Error(`edge ${i} normal points inward; ring winding changed`);
  return {origin: [a[0], a[1]], tangent, n, len, a, c};
}
const F = Array.from({length: N}, (_, i) => frame(i));
const W0 = 0, W1 = 1, W2 = 2, W4 = 4, W5 = 5; // NNW gable front, NW entrance front, SW party wall, SE courtyard, NE end

export function buildDaCostakade13(_w: number, _d: number, b: BuildingTools) {
  const put = (f: Frame, g: T.BufferGeometry, colour: Col) => {
    g.rotateY(Math.atan2(f.n[0], f.n[1]));
    g.translate(f.origin[0], 0, f.origin[1]);
    b.add(g, colour);
  };
  /** Axis-aligned box in frame coordinates. */
  const box = (f: Frame, t0: number, t1: number, y0: number, y1: number, o0: number, o1: number, colour: Col) =>
    put(f, new T.BoxGeometry(t1 - t0, y1 - y0, o1 - o0).translate((t0 + t1) / 2, (y0 + y1) / 2, (o0 + o1) / 2), colour);
  /** Extrude a (t, y) shape between o0 and o1. */
  const slabShape = (f: Frame, sh: T.Shape, o0: number, o1: number, colour: Col) =>
    put(f, new T.ExtrudeGeometry(sh, {depth: o1 - o0, bevelEnabled: false, curveSegments: 8}).translate(0, 0, o0), colour);
  /** Segmental (or, with rise = w/2, round) arch-headed outline: springing at y0 + h, crown at y0 + h + rise. */
  const archPts = (tc: number, w: number, ys: number, rise: number, steps = 10) => {
    const r = (w * w / 4 + rise * rise) / (2 * rise), pts: T.Vector2[] = [];
    for (let k = 0; k <= steps; k++) {
      const x = w / 2 - w * k / steps;
      pts.push(new T.Vector2(tc + x, ys + Math.sqrt(Math.max(0, r * r - x * x)) - (r - rise)));
    }
    return pts; // right springing -> left springing
  };
  const archShape = (tc: number, w: number, y0: number, h: number, rise: number) => {
    const sh = new T.Shape([new T.Vector2(tc - w / 2, y0), new T.Vector2(tc + w / 2, y0), ...archPts(tc, w, y0 + h, rise)]);
    return sh;
  };
  const holeOf = (s: T.Shape) => new T.Path(s.getPoints());

  /**
   * One street window: white surround ring, glass, white glazing bars, stone sill and a green glazed-brick hood.
   * kind 'french' has two leaves to the floor (balcony door), 'sash' a transom with two lights below, 'single' one light below a transom.
   */
  const FW = .08;
  const windowAt = (f: Frame, tc: number, sill: number, w: number, h: number, rise: number, kind: 'french' | 'sash' | 'single' | 'narrow', hood = .15) => {
    const inner = archShape(tc, w, sill, h, rise);
    const outerRise = rise + FW * (rise >= w / 2 - 1e-6 ? 1 : 1.2);
    const outer = archShape(tc, w + 2 * FW, sill - FW, h + FW, outerRise);
    outer.holes.push(holeOf(inner));
    slabShape(f, outer, -.03, .075, 'white');
    slabShape(f, archShape(tc, w, sill, h, rise), -.03, .036, 'glass');
    const bar = (t0: number, t1: number, y0: number, y1: number) => box(f, t0, t1, y0, y1, -.01, .08, 'white');
    const transom = kind === 'narrow' ? sill + h - .02 : sill + h * .78;
    if (kind !== 'narrow') bar(tc - w / 2, tc + w / 2, transom - .035, transom + .035);
    if (kind === 'french' || kind === 'sash') bar(tc - .035, tc + .035, sill, transom - .035);
    if (kind === 'sash') bar(tc - w / 2, tc + w / 2, sill + (transom - sill) * .5 - .025, sill + (transom - sill) * .5 + .025);
    if (kind !== 'french') box(f, tc - w / 2 - .12, tc + w / 2 + .12, sill - FW - .1, sill - FW, -.03, .11, 'stone');
    if (hood) {
      const ys = sill + h, wo = w + 2 * FW;
      const big = archPts(tc, wo + 2 * hood, ys, outerRise + hood), small = archPts(tc, wo, ys, outerRise);
      slabShape(f, new T.Shape([...big, ...small.reverse()]), -.02, .04, 'green');
    }
  };

  // ---------- shell: walls to the eaves, wall 0 with its gable ----------
  const wallFace = (f: Frame, pts: [number, number][], colour: Col) => {
    const sh = new T.Shape(pts.map(([t, y]) => new T.Vector2(t, y)));
    put(f, new T.ShapeGeometry(sh), colour);
  };
  for (let i = 0; i < N; i++) {
    const f = F[i];
    if (i === W0) wallFace(f, [[0, 0], [f.len, 0], [f.len, E], [f.len / 2, APEX], [0, E]], 'brick');
    else wallFace(f, [[0, 0], [f.len, 0], [f.len, E], [0, E]], 'brick');
  }

  // ---------- mansard: free walls slope in by INSET over E..TOP, party/courtyard-corner walls rise vertically ----------
  const inset = (i: number) => (i === W2 || i === 3 ? 0 : INSET);
  const line = (i: number) => { const f = F[i], d = inset(i); return {p: [f.a[0] - f.n[0] * d, f.a[1] - f.n[1] * d], t: f.tangent}; };
  const inner: number[][] = [];
  for (let i = 0; i < N; i++) {
    const A = line((i + N - 1) % N), B = line(i), cr = A.t[0] * B.t[1] - A.t[1] * B.t[0];
    if (Math.abs(cr) < 1e-3) { const f = F[i], d = inset(i); inner.push([f.a[0] - f.n[0] * d, f.a[1] - f.n[1] * d]); continue; }
    const dx = B.p[0] - A.p[0], dz = B.p[1] - A.p[1], s = (dx * B.t[1] - dz * B.t[0]) / cr;
    inner.push([A.p[0] + A.t[0] * s, A.p[1] + A.t[1] * s]);
  }
  const tri = (pa: number[], pb: number[], pc: number[], colour: Col) => {
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute([...pa, ...pb, ...pc], 3));
    g.computeVertexNormals();
    b.add(g, colour);
  };
  const quad = (pa: number[], pb: number[], pc: number[], pd: number[], colour: Col) => { tri(pa, pb, pc, colour); tri(pa, pc, pd, colour); };
  for (let i = 0; i < N; i++) {
    const j = (i + 1) % N, a = ring[i], c = ring[j], qa = inner[i], qc = inner[j];
    quad([a[0], E, a[1]], [c[0], E, c[1]], [qc[0], TOP, qc[1]], [qa[0], TOP, qa[1]], inset(i) ? 'slate' : 'brick');
  }
  {
    const contour = inner.map(p => new T.Vector2(p[0], p[1])), tris = T.ShapeUtils.triangulateShape(contour, []);
    for (const [i, j, k] of tris) {
      const p = [inner[i], inner[j], inner[k]].map(q => [q[0], TOP, q[1]]);
      const up = (p[1][2] - p[0][2]) * (p[2][0] - p[0][0]) - (p[1][0] - p[0][0]) * (p[2][2] - p[0][2]);
      if (up >= 0) tri(p[0], p[1], p[2], 'slate'); else tri(p[0], p[2], p[1], 'slate');
    }
  }

  // ---------- gable roof behind wall 0: ridge perpendicular to the wall, hipped into the mansard ----------
  {
    const f = F[W0], L = f.len, m = L / 2, back = 6, ridgeEnd = 4.5, o0 = -.3;
    const P = (t: number, y: number, o: number) => [f.origin[0] + f.tangent[0] * t + f.n[0] * o, y, f.origin[1] + f.tangent[1] * t + f.n[1] * o];
    quad(P(0, E, o0), P(0, E, -back), P(m, APEX, -ridgeEnd), P(m, APEX, o0), 'slate');
    quad(P(L, E, o0), P(m, APEX, o0), P(m, APEX, -ridgeEnd), P(L, E, -back), 'slate');
    tri(P(0, E, -back), P(L, E, -back), P(m, APEX, -ridgeEnd), 'slate');
    // stone coping on both flanks (covers the gap to the roof planes) and a finial on the apex
    const flank = Math.hypot(m, APEX - E), ang = Math.atan2(APEX - E, m), th = .16;
    for (const side of [-1, 1]) {
      const a = side < 0 ? ang : -ang, g = new T.BoxGeometry(flank + .1, th, .43).rotateZ(a);
      const tMid = side < 0 ? m / 2 : L - m / 2, yMid = (E + APEX) / 2;
      g.translate(tMid - Math.sin(a) * th / 2, yMid + Math.cos(a) * th / 2, -.15);
      put(f, g, 'stone');
    }
    box(f, m - .16, m + .16, APEX - .05, APEX + .55, -.3, .08, 'stone');
    box(f, m - .08, m + .08, APEX + .55, APEX + .8, -.22, 0, 'stone');
    // attic: three-light segmental window centred in the gable
    windowAt(f, m, 14.5, 1.7, 1.1, .2, 'single');
    for (const t of [m - .57, m + .57]) box(f, t - .03, t + .03, 14.5, 14.5 + 1.1 * .78, -.01, .06, 'white');
    // band at the eaves line across the gabled section
    box(f, .05, L - .05, E - .3, E - .18, -.02, .05, 'stone');
  }

  // ---------- wall 0: two identical bays, balconies on floors 1-3 ----------
  {
    const f = F[W0], bays = [1.35, f.len - 1.35];
    for (const tc of bays) {
      windowAt(f, tc, .6, 1.45, 2.4, .25, 'single');
      for (const y of FLOORS) windowAt(f, tc, y + .05, 1.3, 2.15, .2, 'french');
      for (const y of FLOORS) {
        box(f, tc - 1.04, tc + 1.04, y - .15, y, -.02, .55, 'stone'); // balcony slab
        for (const s of [-1, 1]) {
          const tt = tc + s * 1.0;
          const c0 = s < 0 ? tt - .04 : tt - .24, c1 = c0 + .28; // stepped brick corbels, a green glazed course on each step
          box(f, c0, c1, y - .4, y - .15, -.02, .45, 'brick');
          box(f, c0, c1, y - .46, y - .4, -.02, .33, 'green');
          box(f, c0, c1, y - .7, y - .46, -.02, .3, 'brick');
          box(f, c0, c1, y - .76, y - .7, -.02, .18, 'green');
          box(f, c0, c1, y - 1.0, y - .76, -.02, .15, 'brick');
        }
        // railing: top and bottom rails on three sides, balusters every ~0.14 m; side rails reach back into the brick
        const r0 = tc - 1.0, r1 = tc + 1.0, oF = .5;
        box(f, r0, r1, y + .94, y + .99, oF - .025, oF + .025, 'bronze');
        box(f, r0, r1, y + .08, y + .11, oF - .015, oF + .015, 'bronze');
        for (const tt of [r0, r1]) {
          box(f, tt - .02, tt + .02, y + .94, y + .99, -.02, oF, 'bronze');
          box(f, tt - .015, tt + .015, y + .08, y + .11, -.02, oF, 'bronze');
          for (let o = .08; o < oF; o += .14) box(f, tt - .011, tt + .011, y, y + .94, o - .011, o + .011, 'bronze');
        }
        for (let t = r0; t <= r1 + 1e-6; t += (r1 - r0) / 14) box(f, t - .011, t + .011, y, y + .94, oF - .011, oF + .011, 'bronze');
      }
    }
    box(f, 0, f.len, 0, .55, -.02, .04, 'stone'); // plinth
  }

  // ---------- wall 1: wide axis + paired narrow axis over the door ----------
  {
    const f = F[W1], wide = 1.6, pair = [3.74, 4.66], door = 4.2;
    windowAt(f, wide, 1.0, 1.3, 1.9, .2, 'single');
    for (const y of FLOORS) {
      windowAt(f, wide, y + .55, 1.3, 2.0, .2, 'sash');
      for (const tc of pair) windowAt(f, tc, y + .75, .62, 1.69, .31, 'narrow', .06);
      box(f, .02, f.len - .02, y + .31, y + .43, -.02, .04, 'green'); // glazed sill band
    }
    // entrance: stone round arch, red double door, fanlight, stone step
    const dw = 1.5, spring = 2.85, ow = dw + .64;
    const opening = archShape(door, dw, GROUND, spring - GROUND, dw / 2);
    const arch = archShape(door, ow, 0, spring, ow / 2);
    arch.holes.push(holeOf(opening));
    slabShape(f, arch, -.02, .07, 'stone');
    box(f, door - dw / 2, door - .02, GROUND, 2.72, -.03, .04, 'red');
    box(f, door + .02, door + dw / 2, GROUND, 2.72, -.03, .04, 'red');
    box(f, door - .02, door + .02, GROUND, 2.72, -.03, .075, 'white');
    for (const s of [-1, 1]) { // glazed upper panels with an iron grille in each leaf (ref-north-entrance-2024.jpg)
      const c = door + s * dw / 4;
      box(f, c - .22, c + .22, 1.55, 2.6, -.03, .055, 'glass');
      for (const k of [-1, 0, 1]) box(f, c + k * .11 - .012, c + k * .11 + .012, 1.55, 2.6, -.03, .085, 'dark');
    }
    box(f, door - dw / 2, door + dw / 2, 2.72, 2.85, -.03, .075, 'white');
    slabShape(f, archShape(door, dw, 2.85, .001, dw / 2), -.03, .04, 'glass');
    box(f, door - .025, door + .025, 2.85, 2.85 + dw / 2 - .02, -.01, .075, 'white');
    box(f, door - 1.05, door + 1.05, 0, GROUND, -.02, .45, 'stone');
    box(f, .0, door - 1.07, 0, .55, -.02, .04, 'stone'); // plinth either side of the step
    box(f, door + 1.07, f.len, 0, .55, -.02, .04, 'stone');
    // eaves cornice and one three-light dormer on the mansard over the wide axis
    box(f, 0, f.len, E - .4, E - .05, -.02, .18, 'concrete');
    box(f, -.05, f.len, E - .05, E + .06, -.02, .3, 'concrete');
    const d0 = wide - 1.1, d1 = wide + 1.1, dy0 = E + .06, dy1 = E + 1.8, dfront = .06; // dormer front flush over the cornice
    box(f, d0, d1, dy0, dy1, -1.05, dfront, 'slate');
    box(f, d0 - .08, d1 + .08, dy1, dy1 + .1, -1.05, dfront + .12, 'concrete');
    const win = new T.Shape([new T.Vector2(d0 + .12, dy0 + .45), new T.Vector2(d1 - .12, dy0 + .45), new T.Vector2(d1 - .12, dy1 - .15), new T.Vector2(d0 + .12, dy1 - .15)]);
    const fr = new T.Shape([new T.Vector2(d0 + .04, dy0 + .37), new T.Vector2(d1 - .04, dy0 + .37), new T.Vector2(d1 - .04, dy1 - .07), new T.Vector2(d0 + .04, dy1 - .07)]);
    fr.holes.push(holeOf(win));
    slabShape(f, fr, dfront - .02, dfront + .05, 'white');
    slabShape(f, win, dfront - .02, dfront + .035, 'glass');
    for (const k of [1, 2]) { const t = d0 + .12 + (d1 - d0 - .24) * k / 3; box(f, t - .03, t + .03, dy0 + .45, dy1 - .15, dfront, dfront + .07, 'white'); }
  }

  // ---------- NE end wall: blank brick (photographed), plinth and cornice ----------
  {
    const f = F[W5];
    box(f, 0, f.len, 0, .55, -.02, .04, 'stone');
    box(f, 0, f.len, E - .4, E - .05, -.02, .18, 'concrete');
    box(f, 0, f.len + .05, E - .05, E + .06, -.02, .3, 'concrete');
  }

  // ---------- SE courtyard wall (INFERRED): two windows per storey, balcony stack at the east end ----------
  {
    const f = F[W4], L = f.len, east = L - 1.2;
    for (const tc of [2.4, 4.9]) {
      windowAt(f, tc, 1.0, 1.1, 1.8, .15, 'sash', 0);
      for (const y of FLOORS) windowAt(f, tc, y + .8, 1.1, 1.8, .15, 'sash', 0);
    }
    for (const y of FLOORS) {
      windowAt(f, east, y + .05, .9, 2.25, .12, 'french', 0);
      box(f, east - 1.0, east + 1.0, y - .15, y, -.02, 1.1, 'stone');
      box(f, east - 1.0, east + 1.0, y + .94, y + .99, 1.05, 1.1, 'bronze');
      for (const tt of [east - 1.0, east + 1.0]) box(f, tt - .02, tt + .02, y + .94, y + .99, -.02, 1.1, 'bronze');
      for (let t = east - 1.0; t <= east + 1.0 + 1e-6; t += .2) box(f, t - .011, t + .011, y, y + .94, 1.065, 1.085, 'bronze');
    }
    box(f, 0, L, 0, .55, -.02, .04, 'stone');
    box(f, 0, L, E - .4, E - .05, -.02, .18, 'concrete');
    box(f, 0, L, E - .05, E + .06, -.02, .3, 'concrete');
  }
}
