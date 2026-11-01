/**
 * Amstelstation, Julianaplein 1 (BAG 0363100012145715): H.G.J. Schelling's 1939 functionalist station of the
 * Amsterdam-Utrecht line. Every part below comes from the rectified Gemeente Amsterdam panoramas (CC BY 4.0) named in
 * scripts/landmarks/amstelstation-inventory.json, from Wikipedia nl:Station_Amsterdam_Amstel (CC BY-SA 4.0, quoted in
 * the brief) and from the BAG / 3DBAG survey (scripts/landmarks/amstelstation-prepare.ts); nothing from memory.
 *
 *  - Ticket hall (3DBAG: 42.5 x 23.2 m, eaves 16.8 m, ridge 18.7 m): two long glazed walls of 18 bays (2.23 m) between
 *    banded brick corner piers, heavier mullions after bays 3, 9 and 15 (w07-160, w18-160); cream mullion grid with a
 *    centre bar and ~0.7 m transoms; a skeleton clock in the south glazing 12 bays from the west pier (w07, w18); the
 *    shallow saddle roof with its dark overhanging edge; pale stone-panel gables with vertical ribs and a louvre under
 *    the apex (w13-70, w21-70); brick corner piers with white stone courses (w06-160, w18-160).
 *  - "Amsterdam Amstel" with the NS logo and an M in white on the north glazing above the entrance (w01-339).
 *  - Two cantilevered entrance canopies with a dark-wood underside on one round column, north (w01-339) and south
 *    (w20-160).
 *  - The wings (two-storey brick, rounded ends; one-storey brick fronts under a flat canopy band) are the 3DBAG LoD2.2
 *    shell, dressed with their window rows (w11-70, w07-160, w14-160); the glazed upper storey and the ring canopy on
 *    slim columns round the north end of the long wing (w19-340).
 *  - The forecourt podium over the bicycle cellar (in the BAG pand, not in 3DBAG): its pale brick east wall with the
 *    railing, the entrance, two round spoked windows, the clock, the "Amsterdam Amstel" lettering and the metro M
 *    (w12/w13/w21/w22-70, w05-70); the north forecourt steps (w01-339). The game ground is flat while the real east
 *    street runs lower than the north forecourt: the podium is 4.2 m east of the hall gable and 1.2 m (four steps) north
 *    of it, a measured compromise reported in the hand-back.
 *  - Theo van Reijn's sculpture on the podium at the north end of the east gable (w05-70), simplified.
 *  - Not modelled here: the platform shed over the tracks (rail-infra canopy w1302881959 draws it) and the passage
 *    block under the tracks (3DBAG measures the shed roof over it, 13-14.8 m).
 *
 * Frame: x east, z south, y up from the 3DBAG ground (-0.61 m NAP), origin = vertex average of the BAG ring (RD).
 */
import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {raisedLettering} from './ornament-kit';
import {planarPolygon} from './worship-shell';
import {setSink, slab, put, type Frame} from './nearbar-kit';
import {openTopPrism, upwardRoofPlane} from './house-geometry';
import plan from './amstelstation-footprints.json';

type V2 = [number, number];
type V3 = [number, number, number];
type C = string;

let b: BuildingTools;
const hall = plan.hall as {centre: V2; along: V2; across: V2; length: number; width: number; eaves: number; ridge: number};
const A = hall.along, S = hall.across, HL = hall.length / 2, HW = hall.width / 2;
/** Hall-local (u along towards the east gable, v across towards the south) to native (x, z). */
const hp = (u: number, v: number): V2 => [hall.centre[0] + A[0] * u + S[0] * v, hall.centre[1] + A[1] * u + S[1] * v];
const hallU = (p: V2) => (p[0] - hall.centre[0]) * A[0] + (p[1] - hall.centre[1]) * A[1];
/** nearbar-kit frame on a wall: origin, outward normal n; the kit's tangent (n.z, -n.x) is the viewer's left-to-right. */
const frame = (origin: V2, n: V2): Frame => ({origin, n, tangent: [n[1], -n[0]]});
const neg = (v: V2): V2 => [-v[0], -v[1]];

/** Measured heights (m above the 3DBAG ground). */
export const H = {
  glassFoot: 7.5, glassHead: 15.9, eaves: hall.eaves, ridge: hall.ridge,
  bay: 0, pier: 1.2, gablePier: 2.6, canopyTop: 7.45, canopyNorth: 7.45, canopySouth: 5.6,
  podiumEast: 4.2, podiumNorth: 1.2, clockY: 13.1, letteringY: 8.7,
} as const;
const BAYS = 18, BAY = (hall.length - 2 * H.pier) / BAYS;
/** Hall-local u where the long wing's roof stops against the hall walls, and that roof's top (3DBAG hall walls start there). */
const WING_EDGE = -18.6, WING_TOP = 10.9;

const geom = (pos: number[]) => { const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.computeVertexNormals(); return g; };
/** A planar polygon facing `up` (+1 up, -1 down) or along a given normal. */
function poly(pts: V3[], c: C, want?: T.Vector3) {
  const g = planarPolygon([pts]);
  if (!g) return;
  if (want) {
    g.computeVertexNormals();
    const n = g.getAttribute('normal');
    if (n.getX(0) * want.x + n.getY(0) * want.y + n.getZ(0) * want.z < 0) {
      const idx = g.getIndex()!;
      for (let i = 0; i < idx.count; i += 3) { const k = idx.getX(i + 1); idx.setX(i + 1, idx.getX(i + 2)); idx.setX(i + 2, k); }
      g.computeVertexNormals();
    }
  }
  b.add(g.index ? g.toNonIndexed() : g, c as never);
}
const shapeOf = (ring: V2[]) => new T.Shape(ring.map(p => new T.Vector2(p[0], p[1])));
const signedArea = (r: V2[]) => r.reduce((s, p, i) => { const q = r[(i + 1) % r.length]; return s + p[0] * q[1] - q[0] * p[1]; }, 0) / 2;
/** Offset a counter-clockwise ring inward by d (mitred, capped at 4d for sharp corners). */
function inset(r: V2[], d: number): V2[] {
  const n = r.length, out: V2[] = [];
  for (let i = 0; i < n; i++) {
    const p = r[(i + n - 1) % n], c = r[i], q = r[(i + 1) % n];
    const e1 = [c[0] - p[0], c[1] - p[1]], e2 = [q[0] - c[0], q[1] - c[1]], l1 = Math.hypot(e1[0], e1[1]) || 1, l2 = Math.hypot(e2[0], e2[1]) || 1;
    const n1 = [-e1[1] / l1, e1[0] / l1], n2 = [-e2[1] / l2, e2[0] / l2];      // left normals = inside for a CCW ring
    const bx = n1[0] + n2[0], by = n1[1] + n2[1], bl = Math.hypot(bx, by) || 1;
    const k = Math.min(4 * d, d / Math.max(0.25, (bx * n1[0] + by * n1[1]) / bl));
    out.push([c[0] + bx / bl * k, c[1] + by / bl * k]);
  }
  return out;
}
/** Sutherland-Hodgman clip of a ring to the half-plane keep(p) >= 0 (keep is affine). */
function clip(ring: V2[], f: (p: V2) => number): V2[] {
  const out: V2[] = [];
  for (let i = 0; i < ring.length; i++) {
    const p = ring[i], q = ring[(i + 1) % ring.length], fp = f(p), fq = f(q);
    if (fp >= 0) out.push(p);
    if ((fp >= 0) !== (fq >= 0)) { const t = fp / (fp - fq); out.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]); }
  }
  return out;
}

// ---------------------------------------------------------------- ticket hall
/** A closed slab between two parallel quads (top and underside 0.14 m apart): no open boundary. */
function closedSlab(q: V3[], th: number, c: C, under: C) {
  const lo = q.map(p => [p[0], p[1] - th, p[2]] as V3);
  poly(q, c, new T.Vector3(0, 1, 0));
  poly(lo, under, new T.Vector3(0, -1, 0));
  const cx = q.reduce((s, p) => s + p[0], 0) / q.length, cz = q.reduce((s, p) => s + p[2], 0) / q.length;
  for (let i = 0; i < q.length; i++) {
    const j = (i + 1) % q.length, m = [(q[i][0] + q[j][0]) / 2 - cx, 0, (q[i][2] + q[j][2]) / 2 - cz];
    poly([q[i], q[j], lo[j], lo[i]], under, new T.Vector3(m[0], 0, m[2]));
  }
}
function hallBody() {
  // The hall walls and the 3DBAG roof are the measured shell (shell()); the roof here sits on it with its overhangs:
  // two closed planes, underside through the 3DBAG eaves and ridge lines, 1.0 m over the long walls, 0.6 m at the gables.
  const oh = 1.0, og = 0.6, th = 0.16, drop = (H.ridge - H.eaves) / HW * oh, lift = 0;
  for (const s of [1, -1]) {
    const e0 = hp(-HL - og, s * (HW + oh)), e1 = hp(HL + og, s * (HW + oh)), r0 = hp(-HL - og, 0), r1 = hp(HL + og, 0);
    const ye = H.eaves - drop + lift + th, yr = H.ridge + lift + th;
    closedSlab([[e0[0], ye, e0[1]], [e1[0], ye, e1[1]], [r1[0], yr, r1[1]], [r0[0], yr, r0[1]]], th, 'slate', 'dark');
    // fascia along the eaves
    slab(b, frame(hp(0, s * (HW + oh)), s > 0 ? S : neg(S)), 0, ye - th - 0.36, hall.length + 2 * og, 0.5, 0.12, 'dark', 0.0);
  }
}

/**
 * The long walls' measured lines (3DBAG hall walls, hall-local v at u = 0 and the slope dv/du): the south wall is
 * straight on the rectangle (v 11.53-11.56); the north wall runs 0.73 m out of square, v -10.74 at u -18.5 to -11.47
 * at u 16.3 (prepare.ts output, checked against the BAG ring).
 */
const FACE = {south: {v0: 11.545, k: 0}, north: {v0: -11.125, k: -0.021}} as const;
function faceFrame(side: 1 | -1): Frame {
  const {v0, k} = side > 0 ? FACE.south : FACE.north;
  // outward normal of the line v = v0 + k u: (k, -1) for the north side, (-k, 1) for the south, in (A, S) components
  const nu = side > 0 ? -k : k, nv = side > 0 ? 1 : -1, l = Math.hypot(nu, nv);
  const n: V2 = [(A[0] * nu + S[0] * nv) / l, (A[1] * nu + S[1] * nv) / l];
  return frame(hp(0, v0), n);
}

/** Long glazed wall: 18 bays between corner piers, heavier mullions at bays 3, 9, 15, transoms, sill and head. */
/** Hall u where a 3DBAG wing wall meets the long face (the low wings' 7.4 m walls and the long wing's end): no
 *  mullion straddles those seams, the glazing runs past them. Measured from amstelstation-footprints.json. */
const JUNCTIONS: Record<string, number[]> = {'1': [-19.1, 15.72], '-1': [16.27]};
const atJunction = (side: 1 | -1, u: number) => JUNCTIONS[String(side)].some(j => Math.abs(u - j) < 0.75);

function glazedWall(side: 1 | -1) {
  const f = faceFrame(side);
  // The frame tangent runs east on the south face and west on the north face; map hall u to frame t.
  const tu = (u: number) => side > 0 ? u : -u;
  const u0 = -HL + H.pier, u1 = HL - H.pier, h = H.glassHead - H.glassFoot;
  /** The long wing's roof (10.6 m) covers the hall's west end: the first bay's glazing starts above it (3DBAG walls). */
  const foot = (u: number) => u < WING_EDGE ? WING_TOP : H.glassFoot;
  const seg = (a: number, c: number, y: number, hh: number, d: number, col: C, out: number) => slab(b, f, tu((a + c) / 2), y, c - a, hh, d, col, out);
  slab(b, f, 0, 0, hall.length + 0.3, H.eaves, 0.3, 'brick', -0.3);                // the wall itself, on the measured line
  seg(u0, WING_EDGE, WING_TOP, H.glassHead - WING_TOP, 0.06, 'glass', 0.02);
  seg(WING_EDGE, u1, H.glassFoot, h, 0.06, 'glass', 0.02);
  seg(WING_EDGE, u1 + 0.05, H.glassFoot - 0.35, 0.35, 0.22, 'frame', 0.0);           // sill
  seg(u0 - 0.05, u1 + 0.05, H.glassHead, 0.3, 0.2, 'frame', 0.0);                    // head
  for (let k = 0; k <= BAYS; k++) {
    const major = k === 0 || k === BAYS || k % 6 === 3;
    // the end mullions stand just inside the piers, not on them
    const u = -HL + H.pier + k * BAY + (k === 0 ? 0.17 : k === BAYS ? -0.17 : 0), y0 = foot(u - 0.2);
    if (!atJunction(side, u)) slab(b, f, tu(u), y0, major ? 0.22 : 0.16, H.glassHead - y0, major ? 0.3 : 0.18, 'frame', 0.02);
    const uc = -HL + H.pier + (k + 0.5) * BAY, yc = foot(uc - 0.1);
    if (k < BAYS && !atJunction(side, uc)) slab(b, f, tu(uc), yc, 0.07, H.glassHead - yc, 0.12, 'frame', 0.02);
  }
  for (let y = H.glassFoot + 0.72; y < H.glassHead - 0.3; y += 0.74) seg(y < WING_TOP ? WING_EDGE : u0, u1, y, 0.07, 0.12, 'frame', 0.02);
}

/** Banded brick corner piers: one mass per hall corner (1.5 m on the long face, 2.9 m on the gable), white stone courses. */
function cornerPiers() {
  const angle = Math.atan2(-A[1], A[0]);                                           // box local x -> A, local z -> S
  for (const su of [-1, 1]) for (const side of [-1, 1] as const) {
    const {v0, k} = side > 0 ? FACE.south : FACE.north, ue = su * HL, ve = v0 + k * ue;
    const ua = su * (HL - H.pier), ub = su * (HL + 0.32), va = ve - side * H.gablePier, vb = ve + side * 0.3;
    const c = hp((ua + ub) / 2, (va + vb) / 2), wu = Math.abs(ub - ua), wv = Math.abs(vb - va);
    const y0 = su < 0 ? WING_TOP - 0.3 : 0;                                         // the west piers stand on the wing roof
    b.box(c[0], y0, c[1], wu, H.eaves - 0.2 - y0, wv, 'brick', angle);
    // courses: 8 cm proud on the two outer faces, 5 cm inside the pier on the inner ones
    const ca = hp((ua + 0.05 * su + ub + 0.08 * su) / 2, (va + 0.05 * side + vb + 0.08 * side) / 2);
    for (let y = Math.max(0.9, y0 + 0.5); y < H.eaves - 0.5; y += 0.86) b.box(ca[0], y, ca[1], wu + 0.03, 0.14, wv + 0.03, 'white', angle);
  }
}

/** Stone gable end: stone field with vertical ribs between the corner piers, a louvre under the apex. */
function gableEnd(side: 1 | -1) {
  const n = side > 0 ? A : neg(A), f = frame(hp(side * HL, 0), n), field = hall.width - 2 * H.gablePier;
  const y0 = side > 0 ? 0.5 : WING_TOP;
  for (let k = 1; k < 8; k++) { const t = -field / 2 + k * field / 8; slab(b, f, t, y0, 0.22, H.eaves - 0.8 + (H.ridge - H.eaves) * (1 - Math.abs(t) / HW) - y0, 0.1, 'sandstone', 0.0); }
  slab(b, f, 0, H.eaves + 0.15, 2.6, 0.9, 0.08, 'dark', 0.0);                           // louvre under the apex
  for (let y = H.eaves + 0.3; y < H.eaves + 1.0; y += 0.2) slab(b, f, 0, y, 2.5, 0.05, 0.12, 'frame', 0.0);
}

/** Skeleton station clock on the glazing: dark ring, twelve gold markers, gold hands. */
function hallClock() {
  const f = faceFrame(1), u = -HL + H.pier + 11.9 * BAY, r = 1.3;
  put(b, f, new T.RingGeometry(r - 0.16, r, 24).toNonIndexed(), u, H.clockY, 0.32, 'bronze');
  for (let i = 0; i < 12; i++) {
    const a = i * Math.PI / 6;
    put(b, f, new T.BoxGeometry(0.12, 0.3, 0.06).translate(0, (r - 0.36), 0).rotateZ(-a).translate(0, 0, 0.03), u, H.clockY, 0.3, 'gold');
  }
  put(b, f, new T.BoxGeometry(0.1, 0.9, 0.05).translate(0, 0.42, 0.025).rotateZ(-0.6), u, H.clockY, 0.36, 'gold');
  put(b, f, new T.BoxGeometry(0.08, 1.15, 0.05).translate(0, 0.55, 0.025).rotateZ(2.1), u, H.clockY, 0.36, 'gold');
  put(b, f, new T.CylinderGeometry(0.12, 0.12, 0.08, 8).rotateX(Math.PI / 2).translate(0, 0, 0.04), u, H.clockY, 0.34, 'gold');
}

/** White raised lettering on a wall frame, centred at t. */
function letters(f: Frame, text: string, t: number, y: number, h: number, maxW: number, c: C = 'white', out = 0) {
  const L = raisedLettering({text, heightM: h, maxWidthM: maxW, depthM: 0.06});
  put(b, f, L.geometry, t, y, out, c);
  return L.widthM;
}
/** NS logo, simplified: two opposed arrow bars inside a rounded outline. */
function nsLogo(f: Frame, t: number, y: number, s: number, out: number) {
  slab(b, f, t, y + 0.62 * s, 1.5 * s, 0.14 * s, 0.06, 'white', out);
  slab(b, f, t, y + 0.24 * s, 1.5 * s, 0.14 * s, 0.06, 'white', out);
  slab(b, f, t - 0.25 * s, y + 0.43 * s, 0.9 * s, 0.1 * s, 0.06, 'white', out);
  for (const sd of [-1, 1]) slab(b, f, t + sd * 0.82 * s, y + 0.3 * s, 0.12 * s, 0.4 * s, 0.06, 'white', out);
}

/** Northern lettering on the glazing above the canopy: NS logo, "Amsterdam Amstel", M. */
function northSign() {
  // on the glazing: the letters' backs touch the minor mullions' fronts (0.2 m)
  const f = faceFrame(-1), w = letters(f, 'AMSTERDAM AMSTEL', 0.6, H.letteringY, 1.05, 17, 'white', 0.2);
  nsLogo(f, 0.6 - w / 2 - 1.6, H.letteringY, 1.2, 0.2);
  letters(f, 'M', 0.6 + w / 2 + 1.2, H.letteringY, 1.05, 1.2, 'white', 0.2);
}

/** Cantilevered entrance canopy: a half-ellipse slab off the wall, dark-wood underside, one round column. */
function canopy(origin: V2, n: V2, rx: number, rz: number, top: number) {
  const f = frame(origin, n), seg = 20, pts: V2[] = [];
  for (let i = 0; i <= seg; i++) { const a = Math.PI * i / seg; pts.push([-rx * Math.cos(a), rz * Math.sin(a)]); }
  // local (t, out) -> native
  const nat = (p: V2): V2 => [origin[0] + f.tangent[0] * p[0] + n[0] * p[1], origin[1] + f.tangent[1] * p[0] + n[1] * p[1]];
  const ring = pts.map(nat), th = 0.55;
  poly(ring.map(p => [p[0], top, p[1]] as V3), 'slate', new T.Vector3(0, 1, 0));
  poly(ring.map(p => [p[0], top - th, p[1]] as V3), 'red', new T.Vector3(0, -1, 0));
  const pos: number[] = [];
  for (let i = 0; i < ring.length - 1; i++) {
    const p = ring[i], q = ring[i + 1];
    pos.push(p[0], top, p[1], p[0], top - th, p[1], q[0], top - th, q[1], p[0], top, p[1], q[0], top - th, q[1], q[0], top, q[1]);
  }
  const edge = geom(pos);
  // orient the rim outward: flip when the first face points back to the wall
  const nn = edge.getAttribute('normal');
  if (nn.getX(seg / 2 * 6) * n[0] + nn.getZ(seg / 2 * 6) * n[1] < 0) for (let i = 0; i < pos.length; i += 9) for (let k = 0; k < 3; k++) { const t = pos[i + 3 + k]; pos[i + 3 + k] = pos[i + 6 + k]; pos[i + 6 + k] = t; }
  b.add(geom(pos), 'dark' as never);
  // back face against the wall closes the slab
  const a0 = ring[0], a1 = ring[ring.length - 1];
  poly([[a0[0], top, a0[1]], [a1[0], top, a1[1]], [a1[0], top - th, a1[1]], [a0[0], top - th, a0[1]]], 'dark', new T.Vector3(-n[0], 0, -n[1]));
  const col = nat([0, rz * 0.62]);
  b.add(new T.CylinderGeometry(0.32, 0.36, top - th, 12).translate(0, (top - th) / 2, 0), 'ochre' as never, col[0], 0, col[1]);
  b.add(new T.CylinderGeometry(0.55, 0.55, 0.25, 12).translate(0, 0.125, 0), 'stone' as never, col[0], 0, col[1]);
}

// ---------------------------------------------------------------- 3DBAG shell (wings) and their openings
type Wall = {ring: V3[]; hall?: boolean};
/** Shell parts drawn: everything but the passage block under the platforms (x west of the wing, south of the platform shed edge). */
function keepSurface(ring: V3[]) {
  const cx = ring.reduce((s, p) => s + p[0], 0) / ring.length, cz = ring.reduce((s, p) => s + p[2], 0) / ring.length;
  const top = Math.max(...ring.map(p => p[1]));
  // the passage block under the tracks: west of the wing, south of the platform-shed edge, or rising past the wing's 11.5 m
  // (the west entrance's low east step, 8.3 m, reaches x = -41.6 and stays)
  return !(cx < -2 && cx > (top < 9 ? -41 : -46) && cz > -16) && !(top > 12 && cx < 2 && cx > -46);
}
const westEntrance = (ring: V3[]) => ring.reduce((s, p) => s + p[0], 0) / ring.length < -40;

function newell(r: V3[]) {
  let nx = 0, ny = 0, nz = 0;
  for (let i = 0; i < r.length; i++) { const a = r[i], q = r[(i + 1) % r.length]; nx += (a[1] - q[1]) * (a[2] + q[2]); ny += (a[2] - q[2]) * (a[0] + q[0]); nz += (a[0] - q[0]) * (a[1] + q[1]); }
  const l = Math.hypot(nx, ny, nz) || 1; return [nx / l, ny / l, nz / l] as V3;
}
const roofs2D = (plan.roofs as {rings: V3[][]}[]).map(r => ({ring: r.rings[0].map(p => [p[0], p[2]] as V2), lo: Math.min(...r.rings[0].map(p => p[1]))}));
const inside = (p: V2, r: V2[]) => { let c = false; for (let i = 0, j = r.length - 1; i < r.length; j = i++) { if ((r[i][1] > p[1]) !== (r[j][1] > p[1]) && p[0] < (r[j][0] - r[i][0]) * (p[1] - r[i][1]) / (r[j][1] - r[i][1]) + r[i][0]) c = !c; } return c; };
const underRoof = (p: V2) => roofs2D.some(r => r.lo > 2 && inside(p, r.ring)) || (Math.abs(hallU(p)) < HL && Math.abs((p[0] - hall.centre[0]) * S[0] + (p[1] - hall.centre[1]) * S[1]) < HW);

function shell() {
  for (const w of plan.walls as Wall[]) {
    if (!keepSurface(w.ring)) continue;
    const g = planarPolygon([w.ring]);
    if (!g) continue;
    // hall: the gables are pale stone, the long walls stand dark behind the glazing
    const nv = newell(w.ring), gable = Math.abs(nv[0] * A[0] + nv[2] * A[1]) > 0.8;
    // the hall's long walls are rebuilt on their fitted lines behind the glazing (glazedWall), so the glass hangs on them
    if (w.hall && Math.abs(nv[0] * S[0] + nv[2] * S[1]) > 0.8) continue;
    b.add(g.toNonIndexed(), (w.hall ? (gable ? 'stone' : 'brick') : westEntrance(w.ring) ? 'greyBrick' : 'brick') as never);
  }
  for (const r of plan.roofs as {rings: V3[][]; hall?: boolean}[]) {
    if (r.hall || !keepSurface(r.rings[0])) continue;                          // the hall roof is hallBody()'s
    const g = planarPolygon(r.rings);
    if (g) b.add(g.toNonIndexed(), 'slate' as never);
  }
  closeSeams();
}

/**
 * Close the seams the dropped passage block leaves in the 3DBAG solid: chain the kept surfaces' edges used once into
 * loops and fill each loop with a polygon (fan from its centroid when it is not planar).
 */
function closeSeams() {
  // Where the dropped passage block met a lower kept roof, 3DBAG has only the passage's wall above that roof line: below
  // it the kept block is open. Each such junction wall becomes a wall from its bottom edge down to the ground.
  const keptRoofs = (plan.roofs as {rings: V3[][]}[]).filter(r => keepSurface(r.rings[0])).map(r => r.rings[0]);
  const segDist = (p: V3, a: V3, q: V3) => {
    const d = [q[0] - a[0], q[1] - a[1], q[2] - a[2]], l2 = d[0] ** 2 + d[1] ** 2 + d[2] ** 2 || 1;
    const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * d[0] + (p[1] - a[1]) * d[1] + (p[2] - a[2]) * d[2]) / l2));
    return Math.hypot(p[0] - a[0] - d[0] * t, p[1] - a[1] - d[1] * t, p[2] - a[2] - d[2] * t);
  };
  for (const w of plan.walls as Wall[]) {
    if (keepSurface(w.ring)) continue;
    const lo = Math.min(...w.ring.map(p => p[1]));
    if (lo < 0.3) continue;
    const bottom = w.ring.filter(p => p[1] < lo + 0.05);
    if (bottom.length < 2) continue;
    let e: [V3, V3] = [bottom[0], bottom[1]], L = 0;
    for (const p of bottom) for (const q of bottom) { const d = Math.hypot(p[0] - q[0], p[2] - q[2]); if (d > L) { L = d; e = [p, q]; } }
    if (L < 0.5) continue;
    const m: V3 = [(e[0][0] + e[1][0]) / 2, (e[0][1] + e[1][1]) / 2, (e[0][2] + e[1][2]) / 2];
    const onKept = keptRoofs.some(r => r.some((p, i) => segDist(m, p, r[(i + 1) % r.length]) < 0.1));
    if (!onKept) continue;
    poly([[e[0][0], 0, e[0][2]], [e[1][0], 0, e[1][2]], e[1], e[0]], 'brick');
  }
}

/** Ground-standing shell walls: base edge, outward normal, top. */
function groundWalls() {
  const out: {a: V2; b: V2; n: V2; len: number; top: number; mid: V2}[] = [];
  for (const w of plan.walls as Wall[]) {
    if (w.hall || !keepSurface(w.ring) || westEntrance(w.ring)) continue;
    const r = w.ring, low = r.filter(p => p[1] < 0.3);
    if (low.length < 2) continue;
    let best: [V3, V3] = [low[0], low[1]], L = 0;
    for (const p of low) for (const q of low) { const d = Math.hypot(p[0] - q[0], p[2] - q[2]); if (d > L) { L = d; best = [p, q]; } }
    if (L < 3) continue;
    const nv = newell(r); if (Math.abs(nv[1]) > 0.2) continue;
    let n: V2 = [nv[0], nv[2]]; const l = Math.hypot(n[0], n[1]); n = [n[0] / l, n[1] / l];
    const mid: V2 = [(best[0][0] + best[1][0]) / 2, (best[0][2] + best[1][2]) / 2];
    if (underRoof([mid[0] + n[0] * 0.8, mid[1] + n[1] * 0.8])) n = neg(n);
    if (underRoof([mid[0] + n[0] * 0.8, mid[1] + n[1] * 0.8])) continue;            // an inner wall: both sides covered
    out.push({a: [best[0][0], best[0][2]], b: [best[1][0], best[1][2]], n, len: L, top: Math.max(...r.map(p => p[1])), mid});
  }
  return out;
}

/** A window: dark reveal behind glass, frame bars; sits 5+ cm proud of the wall. */
function windowAt(f: Frame, t: number, y: number, w: number, h: number, bars = 2) {
  slab(b, f, t, y - 0.12, w + 0.3, 0.12, 0.2, 'frame', 0.0);
  slab(b, f, t, y + 0.08, w, h - 0.16, 0.07, 'glass', 0.0);
  slab(b, f, t, y, w + 0.12, 0.08, 0.12, 'frame', 0.0);
  slab(b, f, t, y + h - 0.08, w + 0.12, 0.08, 0.12, 'frame', 0.0);
  for (const s of [-1, 1]) slab(b, f, t + s * (w / 2), y, 0.08, h, 0.12, 'frame', 0.0);
  for (let k = 1; k < bars; k++) slab(b, f, t - w / 2 + k * w / bars, y, 0.06, h, 0.11, 'frame', 0.0);
}
/** Round spoked window (the portholes of w07/w18 and the podium front): frame ring, glass, a cross and spokes. */
function roundWindow(f: Frame, t: number, y: number, r: number) {
  // frame annulus 0.14 deep, embedded 5 cm in the wall; glass disc recessed 4 cm behind the frame face; cross and spokes
  const ring = new T.Shape().absarc(0, 0, r + 0.14, 0, Math.PI * 2, false);
  ring.holes.push(new T.Path().absarc(0, 0, r, 0, Math.PI * 2, true));
  put(b, f, new T.ExtrudeGeometry(ring, {depth: 0.14, bevelEnabled: false, curveSegments: 16}).translate(0, 0, -0.05).toNonIndexed(), t, y, 0, 'frame');
  put(b, f, new T.CylinderGeometry(r, r, 0.1, 16).rotateX(Math.PI / 2).translate(0, 0, 0.0).toNonIndexed(), t, y, 0, 'glass');
  for (let k = 0; k < 4; k++) put(b, f, new T.BoxGeometry(0.06, 2 * r, 0.06).rotateZ(k * Math.PI / 4).translate(0, 0, 0.07), t, y, 0, 'frame');
}

function dressWalls() {
  const {east} = podiumParts();
  for (const w of groundWalls()) {
    if (inside([w.mid[0] + w.n[0] * 0.8, w.mid[1] + w.n[1] * 0.8], east)) continue;   // behind the 4.2 m podium
    const f = frame(w.mid, w.n), usable = w.len - 1.6;
    if (usable < 1.5) continue;
    if (w.top > 9) {
      // two-storey wing: shop windows below, punched windows above (w11-70, w14-160, w19-340)
      const n = Math.max(1, Math.floor(usable / 4.2)), pitch = usable / n;
      for (let k = 0; k < n; k++) {
        const t = -usable / 2 + (k + 0.5) * pitch;
        windowAt(f, t, 0.55, Math.min(2.9, pitch - 0.7), 3.0, 3);
        windowAt(f, t, 5.7, Math.min(1.15, pitch - 0.7), 1.9, 2);
      }
    } else if (w.top > 5) {
      // one-storey front: large windows between brick piers at 2.6 m under a projecting flat canopy band (w07-160:
      // eight windows and a round window over the 22 m front); the short front east of the south canopy carries only
      // its round window (w18-160)
      const porthole = Math.abs(w.n[1]) > 0.8 && w.len < 8 ? 0 : Math.abs(w.n[1]) > 0.8 && w.n[1] > 0 && w.len > 18 ? 1 : -1;
      const span = porthole === 1 ? usable - 2.2 : usable;
      if (porthole !== 0) {
        const n = Math.max(1, Math.floor(span / 2.6)), pitch = span / n;
        for (let k = 0; k < n; k++) windowAt(f, -usable / 2 + (k + 0.5) * pitch, 0.9, Math.min(1.9, pitch - 0.6), 3.0, 2);
      }
      if (porthole >= 0) roundWindow(f, porthole === 1 ? usable / 2 - 1.0 : 0, 1.9, 0.5);
      slab(b, f, 0, w.top - 0.95, w.len, 0.3, 1.1, 'dark', 0.0);
    }
  }
}

/** Kasa circle fit. */
function fitCircle(pts: V2[]) {
  const n = pts.length, mx = pts.reduce((s, p) => s + p[0], 0) / n, my = pts.reduce((s, p) => s + p[1], 0) / n;
  let suu = 0, svv = 0, suv = 0, suuu = 0, svvv = 0, suvv = 0, svuu = 0;
  for (const p of pts) { const u = p[0] - mx, v = p[1] - my; suu += u * u; svv += v * v; suv += u * v; suuu += u ** 3; svvv += v ** 3; suvv += u * v * v; svuu += v * u * u; }
  const det = suu * svv - suv * suv, b0 = (suuu + suvv) / 2, b1 = (svvv + svuu) / 2, uc = (b0 * svv - b1 * suv) / det, vc = (suu * b1 - suv * b0) / det;
  return {c: [mx + uc, my + vc] as V2, r: Math.sqrt(uc * uc + vc * vc + (suu + svv) / n)};
}

/** Upper-storey glazing and the ring canopy round the north end of the long wing (w19-340). */
function northRound() {
  const arc = (plan.ring as V2[]).slice(80, 100);                              // the BAG arc round the north end
  const {c: [cx, cz], r} = fitCircle(arc);
  // three.js cylinders: x = r sin(theta), z = r cos(theta); the north half is theta in [pi/2, 3pi/2].
  const th0 = Math.PI / 2, th = Math.PI;
  b.add(new T.CylinderGeometry(r + 0.08, r + 0.08, 3.2, 20, 1, true, th0, th).translate(0, 1.6, 0), 'glass' as never, cx, 5.5, cz);
  for (const [yy, up] of [[8.7, 1], [5.5, -1]] as const) {
    const cap = new T.RingGeometry(r - 0.3, r + 0.08, 20, 1, 0, Math.PI).rotateX(up > 0 ? -Math.PI / 2 : Math.PI / 2);
    // RingGeometry's theta runs from +x towards +y; turned flat it must cover the north half (z < 0)
    if (up > 0) cap.rotateY(0); else cap.rotateY(Math.PI);
    b.add(cap.toNonIndexed(), 'dark' as never, cx, yy, cz);
  }
  for (let i = 0; i <= 10; i++) { const a = th0 + th * i / 10; b.add(new T.BoxGeometry(0.12, 3.2, 0.12), 'frame' as never, cx + (r + 0.14) * Math.sin(a), 5.5 + 1.6, cz + (r + 0.14) * Math.cos(a), a); }
  // ring canopy at 3.9-4.25 m, 2.6 m deep, on slim columns
  const ro = r + 2.6, y = 4.25, d = 0.35;
  const ringPts = (rad: number) => Array.from({length: 21}, (_, i) => { const a = th0 + th * i / 20; return [cx + rad * Math.sin(a), cz + rad * Math.cos(a)] as V2; });
  const inner = ringPts(r - 0.2), outer = ringPts(ro), pos: number[] = [], under: number[] = [], rim: number[] = [], inRim: number[] = [];
  for (let i = 0; i < 20; i++) {
    const a = inner[i], q = inner[i + 1], o = outer[i], p = outer[i + 1];
    pos.push(a[0], y, a[1], o[0], y, o[1], p[0], y, p[1], a[0], y, a[1], p[0], y, p[1], q[0], y, q[1]);
    under.push(a[0], y - d, a[1], p[0], y - d, p[1], o[0], y - d, o[1], a[0], y - d, a[1], q[0], y - d, q[1], p[0], y - d, p[1]);
    rim.push(o[0], y, o[1], o[0], y - d, o[1], p[0], y - d, p[1], o[0], y, o[1], p[0], y - d, p[1], p[0], y, p[1]);
    inRim.push(a[0], y, a[1], q[0], y - d, q[1], a[0], y - d, a[1], a[0], y, a[1], q[0], y, q[1], q[0], y - d, q[1]);
  }
  // the two straight ends of the half ring
  for (const i of [0, 20]) { const a = inner[i], o = outer[i]; poly([[a[0], y, a[1]], [o[0], y, o[1]], [o[0], y - d, o[1]], [a[0], y - d, a[1]]], 'dark', new T.Vector3(i ? -1 : 1, 0, 0)); }
  b.add(geom(inRim), 'dark' as never);
  const fix = (arr: number[], want: (g: T.BufferGeometry) => boolean) => { let g = geom(arr); if (!want(g)) { for (let i = 0; i < arr.length; i += 9) for (let k = 0; k < 3; k++) { const t = arr[i + 3 + k]; arr[i + 3 + k] = arr[i + 6 + k]; arr[i + 6 + k] = t; } g = geom(arr); } return g; };
  b.add(fix(pos, g => g.getAttribute('normal').getY(0) > 0), 'slate' as never);
  b.add(fix(under, g => g.getAttribute('normal').getY(0) < 0), 'dark' as never);
  b.add(fix(rim, g => { const n = g.getAttribute('normal'); const a = th0 + th / 40; return n.getX(0) * Math.sin(a) + n.getZ(0) * Math.cos(a) > 0; }), 'dark' as never);
  for (let i = 0; i <= 4; i++) { const a = th0 + 0.15 + (th - 0.3) * i / 4; b.add(new T.CylinderGeometry(0.1, 0.1, y - d, 6).translate(0, (y - d) / 2, 0), 'ochre' as never, cx + (ro - 0.4) * Math.sin(a), 0, cz + (ro - 0.4) * Math.cos(a)); }
  return {cx, cz, r};
}

// ---------------------------------------------------------------- forecourt podium
const CUT = HL - 0.6;
/** The podium area (BAG ring east and north edges closed through the hall), split at the east gable. */
function podiumParts() {
  const ring = plan.ring as V2[];
  const front: V2[] = ring.slice(50, 79);                                     // east and north edges, (65.1,-5.1) .. (15.6,-47.3)
  const area: V2[] = [...front, hp(-HL, -HW), hp(HL, HW)];
  return {front, east: clip(area, p => hallU(p) - CUT), north: clip(area, p => CUT - hallU(p))};
}
function podium() {
  const {front, east, north} = podiumParts(), cut = CUT, ring = plan.ring as V2[];
  const northDir: V2 = (() => { const p = ring[77], q = ring[78], L = Math.hypot(q[0] - p[0], q[1] - p[1]); return [(q[0] - p[0]) / L, (q[1] - p[1]) / L]; })();
  for (const [part, h, wall] of [[east, H.podiumEast, 'greyBrick'], [north, H.podiumNorth, 'concrete']] as const) {
    if (part.length < 3) continue;
    // 8 cm inside the BAG line, so the podium never shares a plane with the 3DBAG walls standing on the same line
    const r = inset(signedArea(part) < 0 ? [...part].reverse() : part, 0.08);
    b.add(openTopPrism(shapeOf(r), 0, h), wall as never);
    b.add(upwardRoofPlane(shapeOf(r), h), 'concrete' as never);
  }
  // railing along the east block's outer edges
  const isOuter = (p: V2, q: V2) => front.some(f => f === p) && front.some(f => f === q);
  const eastRing = east;
  for (let i = 0; i < eastRing.length; i++) {
    const p = eastRing[i], q = eastRing[(i + 1) % eastRing.length];
    if (!isOuter(p, q)) continue;
    const L = Math.hypot(q[0] - p[0], q[1] - p[1]); if (L < 0.3) continue;
    const a = -Math.atan2(q[1] - p[1], q[0] - p[0]), m: V2 = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
    b.box(m[0], H.podiumEast + 1.0, m[1], L, 0.06, 0.06, 'ochre', a);
    b.box(m[0], H.podiumEast + 0.5, m[1], L, 0.04, 0.04, 'ochre', a);
    const posts = Math.max(1, Math.round(L / 2.4));
    for (let k = 0; k < posts; k++) { const s = k / posts; b.box(p[0] + (q[0] - p[0]) * s, H.podiumEast, p[1] + (q[1] - p[1]) * s, 0.06, 1.0, 0.06, 'ochre', a); }
  }
  // four steps up the north forecourt (w01-339): in front of the 1.2 m deck's north edge
  for (let i = 0; i < north.length; i++) {
    const p = north[i], q = north[(i + 1) % north.length];
    if (!isOuter(p, q) && !(front.includes(p) || front.includes(q))) continue;
    const L = Math.hypot(q[0] - p[0], q[1] - p[1]); if (L < 8) continue;
    const d: V2 = [(q[0] - p[0]) / L, (q[1] - p[1]) / L];
    if (Math.abs(d[0] * northDir[0] + d[1] * northDir[1]) < 0.97) continue;
    let n: V2 = [d[1], -d[0]];
    const m: V2 = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
    if (hallU(m) > cut) continue;
    if (inside([m[0] + n[0] * 0.5, m[1] + n[1] * 0.5], north)) n = neg(n);
    for (let k = 0; k < 3; k++) {
      const off = 0.45 * (k + 0.5), h = H.podiumNorth - 0.3 * (k + 1);
      b.box(m[0] + n[0] * off, 0, m[1] + n[1] * off, L - 0.4, h, 0.45, 'concrete', -Math.atan2(d[1], d[0]));
    }
  }
  return {front};
}

/** East front of the podium: entrance, round windows, clock, lettering (w13-70), metro entrance and M (w21-70). */
function podiumFront() {
  const ring = plan.ring as V2[];
  const edge = (i: number, j: number) => {
    const p = ring[i], q = ring[j], L = Math.hypot(q[0] - p[0], q[1] - p[1]);
    let n: V2 = [(q[1] - p[1]) / L, -(q[0] - p[0]) / L];
    let m: V2 = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
    if (hallU([m[0] + n[0], m[1] + n[1]]) < hallU(m)) n = neg(n);
    m = [m[0] - n[0] * 0.08, m[1] - n[1] * 0.08];                              // the podium wall stands 8 cm inside the BAG line
    return {f: frame(m, n), L};
  };
  const main = edge(54, 55);                                                    // the 9 m front of w13-70
  slab(b, main.f, -2.0, 0, 3.2, 2.7, 0.08, 'glass', 0.0);
  slab(b, main.f, -2.0, 2.7, 3.4, 0.14, 0.14, 'frame', 0.0);
  for (let k = 1; k <= 3; k++) slab(b, main.f, -3.6 + k * 0.8, 0, 0.08, 2.7, 0.12, 'frame', 0.0);
  roundWindow(main.f, 0.9, 1.55, 0.55);
  roundWindow(main.f, 2.4, 1.55, 0.55);
  slab(b, main.f, 3.7, 0, 1.0, 2.2, 0.08, 'dark', 0.0);
  const w = letters(main.f, 'AMSTERDAM AMSTEL', 0.5, 3.15, 0.55, 7.2, 'white');
  // small round clock left of the lettering
  put(b, main.f, new T.CylinderGeometry(0.4, 0.4, 0.12, 16).rotateX(Math.PI / 2).translate(0, 0, 0.01).toNonIndexed(), 0.5 - w / 2 - 0.6, 3.42, 0, 'dark');
  put(b, main.f, new T.CylinderGeometry(0.32, 0.32, 0.06, 16).rotateX(Math.PI / 2).translate(0, 0, 0.09).toNonIndexed(), 0.5 - w / 2 - 0.6, 3.42, 0, 'white');
  const metro = edge(63, 64);                                                   // w21-70
  slab(b, metro.f, 0, 0, 3.4, 2.8, 0.08, 'dark', 0.0);
  letters(metro.f, 'M', 0, 3.05, 0.7, 0.8, 'white');
  nsLogo(edge(55, 63).f, 0, 3.0, 1.0, 0.0);
}

/** Theo van Reijn's sculpture on the podium at the north end of the east gable (w05-70): plinth and figure, simplified. */
function sculpture() {
  const p = hp(HL + 3.2, -HW + 2.2);
  b.box(p[0], H.podiumEast, p[1], 1.4, 0.9, 1.0, 'stone');
  const y = H.podiumEast + 0.9;
  b.add(new T.CylinderGeometry(0.3, 0.42, 1.5, 8).translate(0, 0.75, 0), 'bronze' as never, p[0], y, p[1]);
  b.add(new T.SphereGeometry(0.2, 8, 6).translate(0, 1.72, 0), 'bronze' as never, p[0], y, p[1]);
  b.add(new T.BoxGeometry(1.1, 0.5, 0.45).translate(0.35, 0.3, 0), 'bronze' as never, p[0], y, p[1]);
}

export function buildAmstelstation(_w: number, _d: number, tools: BuildingTools) {
  b = tools;
  setSink(0.06, true);
  try {
    shell();
    dressWalls();
    hallBody();
    glazedWall(1); glazedWall(-1);
    cornerPiers();
    gableEnd(1); gableEnd(-1);
    hallClock();
    northSign();
    // north canopy centred on the vestibule front (3DBAG wall at (39.8, -49.8), facing 347 deg); south at w20-160
    canopy([39.8, -49.9], [-0.22, -0.975], 10.5, 7.0, H.canopyNorth);
    canopy([56.3, 0.25], [0.339, 0.941], 7.5, 6.5, H.canopySouth);
    northRound();
    podium();
    podiumFront();
    sculpture();
  } finally { setSink(0); }
}
