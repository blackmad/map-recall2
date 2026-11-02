import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {setSink, slab, ledgeStrip, put, poly, ringSlab, type Frame} from './nearbar-kit';
import {upwardRoofPlane} from './house-geometry';

/**
 * De Joodsche Invalide, Weesperplein 1 / Nieuwe Achtergracht (BAG pand 0363100012170299, bouwjaar 1936; Rijksmonument 518494).
 * The 1935-1937 extension by J.F. Staal (with M. Oesterman) in the Nieuwe Bouwen, which took in part of Harry Elte's 1925
 * building; opened 19 September 1937, called "Het Glazen Paleis"; since 1979 the GG&GD (nl.wikipedia De Joodse Invalide,
 * RCE register 518494). Elte's brick wing further east along the Nieuwe Achtergracht (Commons RM518494 ... (vleugel).jpg) is
 * BAG pand 0363100012170300 and is not part of this model.
 *
 * Native frame of scripts/landmarks/joodse-invalide-footprints.json (x east, z south, y up from the 3DBAG ground 0.6 m NAP;
 * origin = vertex average of the BAG ring in RD). The plan is a near-rectangle 56 x 39 m set in the building's own axes:
 * a runs east along the Nieuwe Achtergracht front (bearing 343 face), b runs south along the Weesperplein front (bearing 250
 * face); A(a, b) maps them to native metres from the north-west BAG corner. Measured on rectified Gemeente Amsterdam
 * panorama crops (CC BY 4.0; w02-343 at 31 px/m, w04-250 at 44 px/m, w11-340 and w12-250 at 50 px/m) and Wikimedia Commons
 * "Voormalige Joodsche Invalide Ziekenhuis.JPG" (Marcelmulder68, 2013, CC BY-SA 3.0 nl), with heights from the 3DBAG
 * LoD2.2 roof parts (CC BY 4.0):
 *  - the corner (hoekpartij): a glass box of five storeys (6.0-27.2 m, 4.2 m storeys; 3DBAG rim 27.2 m) that stands
 *    0.7 m proud of the canal front and 1.2 m proud of the Weesperplein front, cantilevered over a recessed tiled ground
 *    floor with a glazed band and slender white columns; on its roof terrace the board room (Staalzaal): a rounded glass
 *    room under a shallow curved shell roof on two thin columns (3DBAG 29.8-31.3 m);
 *  - the canal wing in grey glazed tile (RCE: 12.5 x 25 cm tiles), eight window rows on a 4.0 m pitch, one narrow and four
 *    wide steel windows per row (w02-343); further east the lower, set-back brown brick part (RCE: possibly Elte's) with a
 *    tiled two-storey base, a steel gallery at 7 m, double-tier windows, and a recent glazed storey to 26 m (3DBAG 26-27.7);
 *    then the shallow full-height glass erker over an entrance, and the tall eastern block (3DBAG 31.5 m);
 *  - the Weesperplein wing (w04-250): a tall ground floor (the former synagogue) and six storeys of eight window axes with
 *    small hoods, a column of seven round windows at the stair, one narrow window column, and the entrance with its canopy
 *    at Weesperplein 11; the lower brick building at its south end with the passage to the courtyard (in the same BAG pand);
 *  - the open courtyard inside the BAG ring (orthophoto: parked cars) and the lower courtyard blocks (3DBAG 15-27 m).
 */
type P2 = [number, number];
type Col = Parameters<BuildingTools['add']>[1];

// building axes: e along the canal front (east), s along the Weesperplein front (south); origin = BAG corner ring[0]
const E: P2 = norm([0.955, -0.296]), S: P2 = norm([0.340, 0.940]), O: P2 = [-35.9, -5.5];
function norm(v: P2): P2 { const l = Math.hypot(v[0], v[1]); return [v[0] / l, v[1] / l]; }
const A = (a: number, b: number): P2 => [O[0] + a * E[0] + b * S[0], O[1] + a * E[1] + b * S[1]];
const rect = (a0: number, a1: number, b0: number, b1: number): P2[] => [A(a0, b0), A(a1, b0), A(a1, b1), A(a0, b1)];
/** East face line a = aE(b) of the BAG ring (56 at the canal, 54.2 at the south). */
const aE = (b: number) => 56.0 - (1.8 / 38.1) * (b - 0.4);

/** Wall frame from p (viewer's left) to q; n = [-tz, tx] is outward for the faces built below. */
function lineFrame(p: P2, q: P2): {f: Frame; len: number} {
  const len = Math.hypot(q[0] - p[0], q[1] - p[1]), tx = (q[0] - p[0]) / len, tz = (q[1] - p[1]) / len;
  return {f: {origin: p, tangent: [tx, tz], n: [-tz, tx]}, len};
}
/** North (canal) face at b, seen from the canal: t runs west from a1. */
const fN = (a0: number, a1: number, b: number) => lineFrame(A(a1, b), A(a0, b));
/** West (Weesperplein) face at a: t runs south from b0. */
const fW = (a: number, b0: number, b1: number) => lineFrame(A(a, b0), A(a, b1));
/** South (courtyard) face at b: t runs east from a0. */
const fS = (a0: number, a1: number, b: number) => lineFrame(A(a0, b), A(a1, b));
/** East face at a: t runs north from b1. */
const fE = (a: number, b0: number, b1: number) => lineFrame(A(a, b1), A(a, b0));

// ---- solids from plan outlines ----------------------------------------------------------------------------------------
const pane = (b: BuildingTools, f: Frame, t: number, y: number, w: number, h: number, c: Col, base: number) => ledgeStrip(b, f, t, y, w, h, 0.05, c, base);
const shapeOf = (pts: P2[]) => new T.Shape(pts.map(p => new T.Vector2(p[0], p[1])));
function walls(b: BuildingTools, pts: P2[], y0: number, y1: number, c: Col) {
  const ex = new T.ExtrudeGeometry(shapeOf(pts), {depth: y1 - y0, bevelEnabled: false});
  ex.rotateX(Math.PI / 2); ex.translate(0, y1, 0);
  const flat = ex.index ? ex.toNonIndexed() : ex;
  const p = flat.getAttribute('position'), n = flat.getAttribute('normal'), v: number[] = [];
  for (let i = 0; i < p.count; i += 3) {
    if ([0, 1, 2].every(j => Math.abs(n.getY(i + j)) > 0.9)) continue;
    for (let j = 0; j < 3; j++) v.push(p.getX(i + j), p.getY(i + j), p.getZ(i + j));
  }
  const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(v, 3)); g.computeVertexNormals();
  b.add(g, c);
}
const capUp = (b: BuildingTools, pts: P2[], y: number, c: Col) => b.add(upwardRoofPlane(shapeOf(pts), y), c);
function capDown(b: BuildingTools, pts: P2[], y: number, c: Col) {
  const g = new T.ShapeGeometry(shapeOf(pts)); g.rotateX(Math.PI / 2); g.computeVertexNormals(); g.translate(0, y, 0); b.add(g, c);
}
function block(b: BuildingTools, pts: P2[], y0: number, y1: number, c: Col, top: Col | null = 'slate', bottom: Col | null = null) {
  walls(b, pts, y0, y1, c);
  if (top) capUp(b, pts, y1, top);
  if (bottom) capDown(b, pts, y0, bottom);
}

/** Steel window: white frame slab on the wall, glass on it, glazing bars on the glass (cols x rows lights). */
function steelWindow(b: BuildingTools, f: Frame, t: number, y: number, w: number, h: number, cols: number, rows: number, frame: Col = 'white') {
  slab(b, f, t, y - 0.06, w + 0.12, h + 0.12, 0.045, frame, 0);
  pane(b, f, t, y, w, h, 'glass', 0.045);
  for (let k = 1; k < cols; k++) pane(b, f, t - w / 2 + w * k / cols, y, 0.05, h, frame, 0.095);
  for (let k = 1; k < rows; k++) pane(b, f, t, y + h * k / rows - 0.025, w, 0.05, frame, 0.095);
}

// ---- the main mass (31.45 m): Weesperplein wing, canal wing, the tall block behind the brick part and the east block -----
const H_MAIN = 31.45;
function mainMass(b: BuildingTools) {
  const pts: P2[] = [A(1.2, 10.4), A(11.1, 10.4), A(11.1, 0.4), A(31.6, 0.4), A(31.6, 8.3), A(48.6, 8.3), A(48.6, 17.0),
    A(11.8, 17.0), A(11.8, 33.4), A(1.2, 33.4)];
  block(b, pts, 0, H_MAIN, 'greyBrick', 'slate');
  // parapet coping along the street fronts
  slab(b, fN(11.1, 31.6, 0.4).f, 10.25, H_MAIN - 0.3, 20.3, 0.4, 0.06, 'concrete');
  slab(b, fW(1.2, 10.4, 33.4).f, 11.5, H_MAIN - 0.3, 22.8, 0.4, 0.06, 'concrete');
}

// ---- the corner: glass box, recessed ground floor, columns, the board room and its shell roof ------------------------------
const BOX_Y0 = 6.0, BOX_Y1 = 27.2, BOX_FL = [6.0, 10.2, 14.4, 18.6, 22.8];
function corner(b: BuildingTools) {
  // recessed tiled ground floor under the box (0.6 m behind both box faces)
  const g = rect(0.6, 11.4, 0.3, 10.7);
  block(b, g, 0, BOX_Y0 + 0.1, 'greyBrick', null);
  const gN = fN(0.6, 11.4, 0.3), gW = fW(0.6, 0.3, 10.7);
  // canal side: low windows behind the parked cars, then the glazed band between white piers (w11-340: 1.6-2.8, 4.0-5.8 m)
  for (const t of [1.6, 4.3, 7.0]) steelWindow(b, gN.f, t, 1.6, 2.2, 1.2, 3, 1);
  for (const [t0, t1] of [[0.25, 5.1], [5.5, 10.55]]) steelWindow(b, gN.f, (t0 + t1) / 2, 4.0, t1 - t0, 1.8, 6, 2);
  // Weesperplein side (w12-250): plaque, two glazed bays over a tiled sill, the main entrance with its curved canopy
  for (const [t0, t1] of [[0.4, 4.7], [4.9, 7.4]]) steelWindow(b, gW.f, (t0 + t1) / 2, 3.7, t1 - t0, 2.1, 4, 2);
  slab(b, gW.f, 9.0, 0, 1.9, 2.6, 0.045, 'frame', 0);
  pane(b, gW.f, 9.0, 0.05, 1.8, 2.5, 'dark', 0.045);
  plaque(b, gW.f, 3.1);
  canopy(b, gW.f, 9.0);
  // the glass box (walls are its glazing), 0.7 m proud of the canal wing and 1.2 m of the Weesperplein wing
  const box = rect(0, 11.4, -0.3, 10.7);
  block(b, box, BOX_Y0, BOX_Y1, 'glass', 'slate', 'concrete');
  const faces = [fN(0, 11.4, -0.3), fW(0, -0.3, 10.7), fE(11.4, -0.3, 0.4), fS(0, 1.2, 10.7)];
  faces.forEach(({f, len}, i) => {
    const street = i < 2;
    // floor bands and the top fascia
    for (const y of BOX_FL) slab(b, f, len / 2, y - 0.05, len - 0.04, 0.45, 0.08, 'concrete');
    slab(b, f, len / 2, BOX_Y1 - 0.35, len - 0.04, 0.45, 0.08, 'concrete');
    if (!street) return;
    // mullions about 1.43 m apart (w11-340: eight bays on the canal side), a rail at 1.05 m in every storey
    const n = Math.round(len / 1.43);
    for (let k = 0; k <= n; k++) slab(b, f, Math.min(Math.max(len * k / n, 0.15), len - 0.15), BOX_Y0 + 0.4, 0.08, BOX_Y1 - BOX_Y0 - 0.8, 0.1, 'frame');
    for (const y of BOX_FL) pane(b, f, len / 2, y + 1.05, len - 0.1, 0.05, 'frame', 0);
    // slender white columns under the box front
    for (const t of i === 0 ? [0.35, len / 2, len - 0.5] : [len / 2]) {
      const c = new T.CylinderGeometry(0.17, 0.17, BOX_Y0, 10).translate(0, BOX_Y0 / 2, -0.3);
      put(b, f, c, t, 0, 0, 'white');
    }
  });
  // roof terrace railing round the board room
  for (const {f, len} of [fN(0, 11.4, -0.3), fW(0, -0.3, 10.7)]) {
    slab(b, f, len / 2, BOX_Y1 + 0.95, len - 0.5, 0.05, 0.05, 'slate', -0.2);
    for (let t = 0.3; t < len; t += 1.6) slab(b, f, t, BOX_Y1, 0.05, 1.0, 0.05, 'slate', -0.2);
  }
  boardRoom(b);
}

/** The Staalzaal: a rounded glass room on the terrace under a shallow curved shell roof carried by two thin columns. */
function boardRoom(b: BuildingTools) {
  const C = A(5.4, 4.7), d = norm([-(E[0] + S[0]), -(E[1] + S[1])]), side: P2 = [-d[1], d[0]];
  const R = 3.3, y0 = BOX_Y1, y1 = 29.45, back = 6.0;
  // plan: half circle toward the corner, straight sides running back into the main mass
  const pts: P2[] = [];
  for (let k = 0; k <= 12; k++) {
    const th = -Math.PI / 2 + Math.PI * k / 12, c = Math.cos(th), s = Math.sin(th);
    pts.push([C[0] + d[0] * R * c + side[0] * R * s, C[1] + d[1] * R * c + side[1] * R * s]);
  }
  pts.push([C[0] + side[0] * R - d[0] * back, C[1] + side[1] * R - d[1] * back], [C[0] - side[0] * R - d[0] * back, C[1] - side[1] * R - d[1] * back]);
  block(b, pts, y0, y1, 'glass', 'slate');
  // mullions round the bow
  for (let k = 0; k <= 12; k++) {
    const th = -Math.PI / 2 + Math.PI * k / 12, c = Math.cos(th), s = Math.sin(th);
    const p: P2 = [C[0] + (d[0] * c + side[0] * s) * (R + 0.02), C[1] + (d[1] * c + side[1] * s) * (R + 0.02)];
    const m = new T.BoxGeometry(0.08, y1 - y0 - 0.1, 0.1).translate(0, (y1 - y0 - 0.1) / 2, 0);
    m.rotateY(Math.atan2(d[0] * c + side[0] * s, d[1] * c + side[1] * s));
    m.translate(p[0], y0, p[1]);
    b.add(m, 'frame');
  }
  // shell roof: a shallow spherical cap 0.22 m thick, rim 29.8 m, crown 31.3 m (3DBAG), overhanging the room
  const Cr: P2 = [C[0] + d[0] * 0.6, C[1] + d[1] * 0.6], r = 5.0, rise = 1.5, Rs = (r * r + rise * rise) / (2 * rise), th = 0.22;
  const amax = Math.asin(r / Rs), prof: T.Vector2[] = [];
  const top = 31.3, n = 10;
  for (let k = 0; k <= n; k++) { const a = amax * k / n; prof.push(new T.Vector2(Rs * Math.sin(a), top - Rs + Rs * Math.cos(a))); }
  for (let k = n; k >= 0; k--) { const a = amax * k / n; prof.push(new T.Vector2((Rs - th) * Math.sin(a), top - Rs + (Rs - th) * Math.cos(a) - 0.0)); }
  prof[0].x = 0; prof[prof.length - 1].x = 0;
  const shell = new T.LatheGeometry(prof.reverse(), 28);
  shell.translate(Cr[0], 0, Cr[1]);
  b.add(shell, 'white');
  // two thin columns at the front of the shell (Commons photo)
  for (const sgn of [-1, 1]) {
    const p: P2 = [C[0] + d[0] * (R + 0.9) + side[0] * sgn * 2.2, C[1] + d[1] * (R + 0.9) + side[1] * sgn * 2.2];
    const dist = Math.hypot(p[0] - Cr[0], p[1] - Cr[1]), yTop = top - Rs + Math.sqrt(Rs * Rs - dist * dist) - th;
    b.add(new T.CylinderGeometry(0.1, 0.1, yTop - y0 + 0.05, 8).translate(p[0], (y0 + yTop + 0.05) / 2, p[1]), 'white');
  }
}

/** Memorial plaque by C. Stauthamer (1950) beside the Weesperplein entrance: bronze, arched top, three kneeling figures. */
function plaque(b: BuildingTools, f: Frame, t: number) {
  const w = 1.1, h = 1.45, y = 0.7;
  poly(b, f, t, y, [[-w / 2, 0], [w / 2, 0], [w / 2, h - 0.1], [w * 0.25, h - 0.02], [0, h], [-w * 0.25, h - 0.02], [-w / 2, h - 0.1]], 0.06, 'bronze');
  slab(b, f, t, y + h * 0.66, w * 0.8, 0.04, 0.05, 'bronze', 0.06);
  for (const dx of [-0.28, 0, 0.28]) {
    slab(b, f, t + dx, y + h * 0.66 + 0.04, 0.16, 0.26, 0.04, 'bronze', 0.06);
    slab(b, f, t + dx + (dx === 0 ? 0 : -Math.sign(dx) * 0.02), y + h * 0.66 + 0.31, 0.08, 0.08, 0.04, 'bronze', 0.06);
  }
  // lettering rows as low bronze bands
  for (let k = 0; k < 6; k++) pane(b, f, t, y + 0.15 + k * 0.1, w * (k % 2 ? 0.7 : 0.8), 0.04, 'bronze', 0.06);
}

/** The curved entrance canopy (luifel): a thin slab with a rounded front, 1.8 m out at 3.1 m. */
function canopy(b: BuildingTools, f: Frame, t: number) {
  const w = 3.6, proj = 1.8, s = new T.Shape();
  s.moveTo(-w / 2, 0); s.lineTo(w / 2, 0); s.lineTo(w / 2, proj - w / 2 * 0.4); s.quadraticCurveTo(0, proj + w * 0.15, -w / 2, proj - w / 2 * 0.4); s.lineTo(-w / 2, 0);
  const g = new T.ExtrudeGeometry(s, {depth: 0.18, bevelEnabled: false, curveSegments: 10});
  g.rotateX(Math.PI / 2); // shape y -> local z (outward), extrusion -> down
  g.translate(0, 3.25, -0.15);
  put(b, f, g, t, 0, 0, 'white');
}

// ---- canal front: the grey tiled block, the brick part, the erker and the east block ----------------------------------------
const N_FLOORS = [3.3, 7.3, 11.3, 15.3, 19.3, 23.3, 27.3];
function canalWing(b: BuildingTools) {
  const {f} = fN(11.1, 31.6, 0.4); // t from a 31.6 (east end of the grey block) westward
  const axes: [number, number][] = [[1.1, 2.9], [4.35, 7.7], [8.2, 11.7], [12.2, 15.7], [16.3, 19.8]];
  for (const [t0, t1] of axes) {
    const w = t1 - t0, cols = w < 2 ? 2 : 4;
    steelWindow(b, f, (t0 + t1) / 2, 1.0, w, 1.6, cols, 1);
    for (const fl of N_FLOORS) steelWindow(b, f, (t0 + t1) / 2, fl + 0.5, w, 2.75, cols, 3);
  }
}

function brickPart(b: BuildingTools) {
  // tiled two-storey base, brown brick above to 21.5 m, the recent glazed storey set back 2 m to 26.0 m
  const base = rect(31.6, 48.6, 0.4, 8.3);
  walls(b, base, 0, 7.0, 'greyBrick');
  block(b, base, 7.0, 21.5, 'brick', 'slate');
  slab(b, fN(31.6, 48.6, 0.4).f, 8.5, 21.15, 16.9, 0.45, 0.06, 'concrete');
  const top = rect(31.9, 48.6, 2.4, 8.3);
  block(b, top, 21.5, 26.0, 'white', 'slate');
  const {f: ft, len: lt} = fN(31.9, 48.6, 2.4);
  pane(b, ft, lt / 2, 22.1, lt - 0.6, 2.9, 'glass', 0);
  for (let t = 0.3; t <= lt - 0.3 + 1e-6; t += (lt - 0.6) / 10) slab(b, ft, t, 22.1, 0.07, 2.9, 0.1, 'frame', 0.05);
  slab(b, ft, lt / 2, 25.6, lt - 0.1, 0.5, 0.12, 'concrete');
  const {f} = fN(31.6, 48.6, 0.4); // t from a 48.6 (east) westward, photo w02-343 x 110-680
  // ground: eight small windows; second storey: three wide windows (both in the tiled base)
  for (const [t0, t1] of [[1.45, 2.4], [3.2, 4.4], [5.6, 7.6], [8.2, 10.2], [10.8, 12.6], [13.2, 14.4], [14.8, 15.9], [16.1, 16.9]]) steelWindow(b, f, (t0 + t1) / 2, 1.0, t1 - t0, 1.6, t1 - t0 > 1.5 ? 2 : 1, 2);
  for (const [t0, t1] of [[3.5, 6.9], [8.7, 12.1], [13.7, 15.5]]) steelWindow(b, f, (t0 + t1) / 2, 4.2, t1 - t0, 2.3, t1 - t0 > 2 ? 4 : 2, 2);
  // steel gallery along the front at the top of the tiled base
  slab(b, f, 8.7, 7.0, 16.6, 0.15, 1.1, 'concrete');
  pane(b, f, 8.7, 8.0, 16.6, 0.05, 'frame', 1.05);
  for (let t = 0.5; t < 17; t += 1.4) slab(b, f, t, 7.15, 0.05, 0.9, 0.05, 'frame', 1.0);
  // brick storeys: five windows per row; rows 4 and 5 are double-tier windows (w02-343)
  const ax: [number, number][] = [[3.5, 5.6], [6.1, 8.4], [8.9, 11.0], [11.6, 13.7], [14.4, 16.5]];
  for (const [t0, t1] of ax) {
    steelWindow(b, f, (t0 + t1) / 2, 7.9, t1 - t0, 2.1, 3, 2);
    steelWindow(b, f, (t0 + t1) / 2, 11.4, t1 - t0, 2.1, 3, 2);
    steelWindow(b, f, (t0 + t1) / 2, 15.1, t1 - t0, 2.1, 3, 2);
  }
  for (let k = 0; k < 8; k++) steelWindow(b, f, 2.9 + k * 1.95, 18.8, 1.1, 1.2, 2, 1);
  // two small round windows at the junction with the grey block
  for (const y of [9.2, 16.1]) { ringSlab(b, f, 17.4, y, 0.25, 0.33, 0.08, 'white', -0.03); slabDisc(b, f, 17.4, y, 0.26); }
}
/** Round glass light set into a ring frame (2.5-3.5 cm off the wall, inside its frame). */
function slabDisc(b: BuildingTools, f: Frame, t: number, y: number, r: number) {
  put(b, f, new T.CircleGeometry(r, 16), t, y, 0.035, 'glass');
}

function erkerAndEast(b: BuildingTools) {
  // shallow full-height glass erker over an entrance (RCE), 3DBAG 27.4 m
  block(b, rect(49.6, 52.5, -0.3, 0.7), 3.3, 27.4, 'glass', 'slate', 'concrete');
  const {f, len} = fN(49.6, 52.5, -0.3);
  for (let y = 3.3; y < 27; y += 4.0) slab(b, f, len / 2, y - 0.08, len - 0.04, 0.35, 0.08, 'concrete');
  for (const t of [0.15, len / 2, len - 0.15]) slab(b, f, t, 3.65, 0.08, 23.4, 0.1, 'frame');
  slab(b, fN(48.6, aE(0.4), 0.4).f, aE(0.4) - 51.05, 0, 1.7, 2.6, 0.045, 'frame', 0);
  pane(b, fN(48.6, aE(0.4), 0.4).f, aE(0.4) - 51.05, 0.05, 1.6, 2.5, 'dark', 0.045);
  // east block: the canal strip to 27.4 m (3DBAG), the main mass rises behind it from b 1.8
  block(b, [A(48.6, 0.4), A(aE(0.4), 0.4), A(aE(17.0), 17.0), A(48.6, 17.0)], 0, 27.4, 'greyBrick', 'slate');
  block(b, [A(48.6, 1.8), A(aE(1.8), 1.8), A(aE(17.0), 17.0), A(48.6, 17.0)], 27.4, H_MAIN, 'greyBrick', 'slate');
  const fe = fN(48.6, aE(0.4), 0.4).f;
  for (const fl of N_FLOORS.slice(0, 6)) steelWindow(b, fe, 1.8, fl + 0.5, 1.0, 2.6, 1, 3);
}

// ---- Weesperplein wing -------------------------------------------------------------------------------------------------------
function weesperpleinWing(b: BuildingTools) {
  const {f} = fW(1.2, 10.4, 33.4);
  const t0 = 0.3; // t = b - 10.4 (w04-250 measures from b 10.7)
  // seven round windows on the stair (w04-250: 1.5 m, centres 2.9 + 3.9 k m)
  for (let k = 0; k < 7; k++) {
    const y = 2.9 + 3.9 * k;
    ringSlab(b, f, t0 + 1.8, y, 0.62, 0.76, 0.1, 'white', -0.03);
    put(b, f, new T.CircleGeometry(0.63, 18), t0 + 1.8, y, 0.035, 'glass');
    pane(b, f, t0 + 1.8, y - 0.025, 1.25, 0.05, 'white', 0.035);
    pane(b, f, t0 + 1.8, y - 0.62, 0.05, 1.24, 'white', 0.035);
  }
  const rows = [6.5, 10.55, 14.6, 18.65, 22.7, 26.75];
  // narrow window column
  steelWindow(b, f, t0 + 6.33, 2.9, 0.62, 1.7, 1, 2);
  for (const y of rows) steelWindow(b, f, t0 + 6.33, y, 0.62, 2.65, 1, 3);
  // eight axes 1.93 m apart: tall ground-floor windows (the former synagogue) and six upper rows with small hoods
  for (let k = 0; k < 8; k++) {
    const t = t0 + 7.95 + 1.93 * k;
    if (k < 7) steelWindow(b, f, t, 1.7, 1.35, 3.3, 2, 4);
    for (const y of rows) {
      steelWindow(b, f, t, y, 1.35, 2.65, 2, 3);
      slab(b, f, t, y + 2.65 + 0.06, 1.6, 0.12, 0.2, 'concrete');
    }
  }
  // Weesperplein 11 entrance: recessed glazed door with a canopy
  const te = t0 + 7.95 + 1.93 * 7;
  slab(b, f, te, 0, 1.5, 3.0, 0.045, 'frame', 0);
  pane(b, f, te, 0.05, 1.4, 2.9, 'glass', 0.045);
  slab(b, f, te, 3.05, 2.0, 0.15, 1.2, 'white');
  // lower brick building at the south end (same BAG pand): four storeys, passage to the courtyard
  block(b, rect(1.3, 12.4, 33.1, 39.1), 0, 13.5, 'brick', 'slate');
  const lo = fW(1.3, 33.4, 39.1);
  slab(b, lo.f, 2.9, 0, 3.0, 3.6, 0.045, 'dark', 0);
  for (const y of [4.3, 7.3, 10.3]) { steelWindow(b, lo.f, 1.3, y, 1.6, 1.8, 2, 2); steelWindow(b, lo.f, 4.0, y, 1.2, 1.8, 2, 2); }
  // the wing's south end face above the low building
  const se = fS(1.2, 11.8, 33.4);
  for (const y of rows.slice(2)) for (const t of [3.0, 7.6]) steelWindow(b, se.f, t, y, 1.3, 2.3, 2, 3);
}

// ---- courtyard faces (no photograph: inferred from the street rhythm), the courtyard blocks and rooftop plant ---------------
function courtyard(b: BuildingTools) {
  const ww = fE(11.8, 17.0, 33.4); // W wing east face, t north from b 33.4
  for (let t = 1.6; t < ww.len - 1; t += 3.6) for (const fl of N_FLOORS) steelWindow(b, ww.f, t, fl + 0.6, 1.8, 2.3, 2, 2);
  const ns = fS(11.8, 43.5, 17.0); // canal wing south face, t east from a 11.8
  for (let t = 2.0; t < ns.len - 1; t += 3.6) for (const fl of N_FLOORS) steelWindow(b, ns.f, t, fl + 0.6, 1.8, 2.3, 2, 2);
  // south-east courtyard blocks (3DBAG 22.7, 27.2 and 15.0 m)
  block(b, [A(43.5, 17.0), A(47.0, 17.0), A(47.0, 29.7), A(43.5, 29.7)], 0, 22.7, 'greyBrick', 'slate');
  block(b, [A(47.0, 17.0), A(aE(17.0), 17.0), A(aE(28.9), 28.9), A(47.0, 28.9)], 0, 27.2, 'greyBrick', 'slate');
  block(b, [A(47.0, 28.9), A(aE(28.9), 28.9), A(aE(31.7), 31.7), A(47.0, 31.7)], 0, 15.0, 'brick', 'slate');
  const cw = fW(43.5, 17.0, 29.7);
  for (let t = 1.5; t < cw.len - 1; t += 3.0) for (const fl of N_FLOORS.slice(0, 5)) steelWindow(b, cw.f, t, fl + 0.6, 1.6, 2.2, 2, 2);
  // rooftop stair and plant houses (3DBAG 33.7-35.6 m)
  block(b, rect(8.2, 12.6, 3.8, 8.8), BOX_Y1 - 0.1, 33.7, 'greyBrick', 'slate');
  block(b, rect(8.2, 10.8, 8.8, 15.0), BOX_Y1 - 0.1, 34.5, 'greyBrick', 'slate');
  block(b, rect(22.7, 27.4, 5.6, 8.1), H_MAIN - 0.2, 33.9, 'greyBrick', 'slate');
  block(b, rect(24.4, 27.9, 11.3, 17.0), H_MAIN - 0.2, 35.0, 'greyBrick', 'slate');
  block(b, rect(44.7, 51.4, 10.1, 16.9), H_MAIN - 0.2, 34.4, 'greyBrick', 'slate');
}

export function buildJoodseInvalide(_w: number, _d: number, b: BuildingTools) {
  setSink(0.12, true);
  mainMass(b);
  corner(b);
  canalWing(b);
  brickPart(b);
  erkerAndEast(b);
  weesperpleinWing(b);
  courtyard(b);
}
