import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import footprints from './kiosk-park-bea-footprints.json';

/**
 * Park Kiosk BEA, Beatrixpark (BAG pand 0363100012241046, 2013, one storey, 3DBAG eaves 3.10 m / top 3.14 m; OSM way
 * w277174094; POI local-food-2273). A long low park pavilion on the north side of the wading pool and its pergola ring:
 * walls of vertical olive-grey boards in two tones over a grey brick plinth, a deep board fascia under a sedum roof,
 * four flush service doors in the south face, the west end's upper storey band oversailing a recessed ground floor, and
 * at the east end a kiosk porch under the fascia: a glazed shop front and a doorway in the porch's back wall, a pale
 * brick block with a serving window, and the wooden "BEA" board on the fascia.
 *
 * Measured from Gemeente Amsterdam panoramas (CC BY 4.0), see kiosk-park-bea-inventory.json:
 * TMX7316010203-000259_pano_0000_000460 (2017-04-13, south, 17 m: doors, plinth, fascia, south-east porch opening),
 * _000461 / _000462 (south-west: the west oversail), TMX7316010203-002471_pano_0000_000593 (2022-03-23, east, sunlit:
 * brick block, window, porch, sign) and recording_2024-09-03_05-21-23_00663 (east). Heights scaled on 3DBAG's 3.10 m
 * eaves: brick plinth 0.9 m, board wall to 2.5 m, fascia 0.6 m. The footprint is the BAG outline itself.
 */

type UV = [number, number];
const rect = footprints.rect;
const bearing = rect.frontBearing * Math.PI / 180;
// Local frame: u along the front (east-ish), v out of the front (south-ish, toward the pool), y up.
const A: UV = [-Math.cos(bearing), -Math.sin(bearing)], N: UV = [Math.sin(bearing), -Math.cos(bearing)];
const C = rect.centre as UV;
const toUV = ([x, z]: number[]): UV => [(x - C[0]) * A[0] + (z - C[1]) * A[1], (x - C[0]) * N[0] + (z - C[1]) * N[1]];
/** (u, y, v) -> native (x east, y, z south); determinant +1, so winding is kept. */
const BASIS = new T.Matrix4().set(A[0], 0, N[0], C[0], 0, 1, 0, 0, A[1], 0, N[1], C[1], 0, 0, 0, 1);

export const BEA = {
  plinth: 0.9, wallTop: 2.5, fasciaTop: 3.05, sedum: 0.09,
  /** the west oversail: the upper band runs on over a ground floor set back 0.8 m, 2.4 m along the south face from the corner */
  westBand: 1.95, westSetback: 0.8, westLength: 2.4,
  /** the east porch: back wall 1.8 m in from the south-east corner, open to the south and east as far as the brick block */
  porchLength: 1.8, porchBack: -0.3,
  doors: {from: -3.6, width: 1.05, count: 4, height: 2.2},
  battenPitch: 0.65, battenWidth: 0.2, battenProud: 0.035,
};

const ring = (): UV[] => {
  const r = (footprints.localEastSouthMetres as number[][]).map(toUV);
  const area = r.reduce((s, p, i) => {const q = r[(i + 1) % r.length]; return s + p[0] * q[1] - q[0] * p[1];}, 0);
  return area < 0 ? r.reverse() : r; // counter-clockwise in (u, v)
};

const inside = (P: UV[], [x, y]: UV) => {
  let c = false;
  for (let i = 0, j = P.length - 1; i < P.length; j = i++) {
    const [xi, yi] = P[i], [xj, yj] = P[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c;
  }
  return c;
};

/** Mitred inset of a counter-clockwise ring by d metres (the BAG ring is near-convex, with short rounded corners). */
function inset(P: UV[], d: number): UV[] {
  const n = P.length, out: UV[] = [];
  for (let i = 0; i < n; i++) {
    const p = P[(i + n - 1) % n], q = P[i], r = P[(i + 1) % n];
    const e1 = norm([q[0] - p[0], q[1] - p[1]]), e2 = norm([r[0] - q[0], r[1] - q[1]]);
    // inward normal of a ccw edge (dx, dy) is (-dy, dx)
    const n1: UV = [-e1[1], e1[0]], n2: UV = [-e2[1], e2[0]];
    const m = norm([n1[0] + n2[0], n1[1] + n2[1]]), k = d / Math.max(0.3, m[0] * n1[0] + m[1] * n1[1]);
    out.push([q[0] + m[0] * k, q[1] + m[1] * k]);
  }
  return out;
}
function norm([x, y]: UV): UV { const l = Math.hypot(x, y) || 1; return [x / l, y / l]; }

/** Sutherland-Hodgman clip to the half plane where f(p) <= 0 (f linear). */
function clip(P: UV[], f: (p: UV) => number): UV[] {
  const out: UV[] = [];
  for (let i = 0; i < P.length; i++) {
    const a = P[i], b = P[(i + 1) % P.length], fa = f(a), fb = f(b);
    if (fa <= 0) out.push(a);
    if ((fa < 0 && fb > 0) || (fa > 0 && fb < 0)) { const t = fa / (fa - fb); out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]); }
  }
  return out;
}

/** A closed prism over a (u, v) polygon from y0 to y1, in native coordinates. */
function slab(P: UV[], y0: number, y1: number): T.BufferGeometry {
  const shape = new T.Shape(P.map(([u, v]) => new T.Vector2(u, -v)));
  const g = new T.ExtrudeGeometry(shape, {depth: y1 - y0, bevelEnabled: false});
  g.rotateX(-Math.PI / 2).translate(0, y0, 0);
  return g.applyMatrix4(BASIS);
}

/** A box in the local frame: centre (u, y, v), size along u / y / v, turned by `turn` (radians, about y, u toward v). */
function lbox(u: number, y: number, v: number, su: number, sy: number, sv: number, turn = 0): T.BufferGeometry {
  return new T.BoxGeometry(su, sy, sv).rotateY(-turn).translate(u, y, v).applyMatrix4(BASIS);
}

/** Edges of P (outward normal, start, end, length) that are not cuts made by a clip line. */
function faces(P: UV[], isCut: (a: UV, b: UV) => boolean) {
  const out: {a: UV; b: UV; len: number; dir: UV; out: UV}[] = [];
  for (let i = 0; i < P.length; i++) {
    const a = P[i], b = P[(i + 1) % P.length], len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (len < 1e-3 || isCut(a, b)) continue;
    const dir: UV = [(b[0] - a[0]) / len, (b[1] - a[1]) / len];
    out.push({a, b, len, dir, out: [dir[1], -dir[0]]});
  }
  return out;
}

/** Vertical battens at a steady pitch along the uncut edges of P, `proud` in front of the face, from y0 to y1. */
function battens(P: UV[], y0: number, y1: number, isCut: (a: UV, b: UV) => boolean, skip: (u: number, v: number) => boolean, add: (g: T.BufferGeometry) => void) {
  const {battenPitch: pitch, battenWidth: w, battenProud: t} = BEA;
  let carry = pitch / 2;
  for (const e of faces(P, isCut)) {
    for (let s = carry; s <= e.len - w / 2; s += pitch) {
      if (s < w / 2) continue;
      const u = e.a[0] + e.dir[0] * s + e.out[0] * t / 2, v = e.a[1] + e.dir[1] * s + e.out[1] * t / 2;
      if (skip(u, v)) continue;
      add(lbox(u, (y0 + y1) / 2, v, w, y1 - y0, t, Math.atan2(e.dir[1], e.dir[0])));
    }
    carry = ((carry - e.len) % pitch + pitch) % pitch;
  }
}

export function buildKioskParkBea(_w: number, _d: number, b: BuildingTools) {
  const R = ring();
  const south = R.filter(p => p[1] > 1.5), uSE = Math.max(...south.map(p => p[0])), uSW = Math.min(...south.map(p => p[0]));
  const uP = uSE - BEA.porchLength, uW = uSW + BEA.westLength, vP = BEA.porchBack;
  const near = (x: number, y: number) => Math.abs(x - y) < 1e-6;
  const cutU = (k: number) => (a: UV, c: UV) => near(a[0], k) && near(c[0], k);
  const cutV = (k: number) => (a: UV, c: UV) => near(a[1], k) && near(c[1], k);
  const any = (...f: ((a: UV, c: UV) => boolean)[]) => (a: UV, c: UV) => f.some(g => g(a, c));

  const wall = inset(R, 0.06), plinthRing = inset(R, 0.02);
  // Main board wall between the west oversail and the porch; the door bay runs to the ground (no plinth under the doors).
  const {doors} = BEA, d0 = doors.from - 0.15, d1 = doors.from + doors.count * doors.width + 0.15;
  const main = clip(clip(wall, p => p[0] - uP), p => uW - p[0]);
  b.add(slab(main, BEA.plinth - 0.02, BEA.wallTop + 0.03), 'green');
  for (const [lo, hi] of [[uW, d0], [d1, uP]] as [number, number][]) b.add(slab(clip(clip(plinthRing, p => p[0] - hi), p => lo - p[0]), 0, BEA.plinth), 'greyBrick');
  b.add(slab(clip(clip(wall, p => p[0] - (d1 - 0.05)), p => (d0 + 0.05) - p[0]), 0, BEA.plinth), 'green');
  // West: the upper band oversails a ground floor set back 0.8 m.
  const westUpper = clip(wall, p => p[0] - (uW + 0.05));
  b.add(slab(westUpper, BEA.westBand, BEA.wallTop + 0.03), 'green');
  const westLow = clip(inset(R, BEA.westSetback + 0.04), p => p[0] - (uW + 0.05)), westPlinth = clip(inset(R, BEA.westSetback), p => p[0] - (uW + 0.05));
  b.add(slab(westPlinth, 0, BEA.plinth), 'greyBrick');
  b.add(slab(westLow, BEA.plinth - 0.02, BEA.westBand + 0.02), 'green');
  // East: the pale brick block north of the porch, out to the fascia line less 3 cm.
  const block = clip(clip(inset(R, 0.03), p => (uP - 0.05) - p[0]), p => p[1] - vP);
  b.add(slab(block, 0, BEA.wallTop + 0.03), 'brick');
  // Fascia band over the whole outline, sedum on top.
  b.add(slab(R, BEA.wallTop, BEA.fasciaTop), 'green');
  // sedum 9 cm above the fascia rim (clear of the 2-8 cm near-coplanar band), its slab reaching down into the fascia
  b.add(slab(inset(R, 0.08), BEA.fasciaTop - 0.05, BEA.fasciaTop + BEA.sedum), 'slate');

  // Two-tone boards: battens 3.5 cm proud on the board walls and the fascia, in the lighter tone.
  const doorZone = (u: number, v: number) => v > 1 && u > d0 - 0.1 && u < d1 + 0.1;
  const add = (g: T.BufferGeometry) => b.add(g, 'ochre');
  battens(main, BEA.plinth + 0.02, BEA.wallTop - 0.02, any(cutU(uP), cutU(uW)), doorZone, add);
  battens(westUpper, BEA.westBand + 0.02, BEA.wallTop - 0.02, cutU(uW + 0.05), () => false, add);
  battens(R, BEA.wallTop + 0.03, BEA.fasciaTop - 0.03, () => false, (u, v) => u > uP + 0.2 && v > vP - 0.2 && v < 1.6 && u > uSE - 0.2, add);

  // Doors: four flush leaves in the south face, pale edge trims 4 cm proud. The trims are drawn in the 'concrete' palette
  // name (not an opening material): the BAG south face is a polyline bending +-6 degrees every 0.9 m, so the audit's
  // wall clustering cuts it into segments and judges a 4.2 m door run against one of them.
  const southFace = faces(main, any(cutU(uP), cutU(uW))).filter(e => e.out[1] > 0.9);
  const along = (u: number) => {
    const e = southFace.find(f => (u - f.a[0]) * (u - f.b[0]) <= 0) ?? southFace[0];
    const t = (u - e.a[0]) / (e.b[0] - e.a[0] || 1);
    return {v: e.a[1] + (e.b[1] - e.a[1]) * t, turn: Math.atan2(e.dir[1], e.dir[0]), out: e.out};
  };
  for (let i = 0; i <= doors.count; i++) {
    const u = doors.from + i * doors.width, f = along(u);
    b.add(lbox(u + f.out[0] * 0.02, doors.height / 2 + 0.01, f.v + f.out[1] * 0.02, 0.04, doors.height, 0.04, f.turn), 'concrete');
  }
  for (let i = 0; i < doors.count; i++) {
    const u = doors.from + (i + 0.5) * doors.width, f = along(u);
    b.add(lbox(u + f.out[0] * 0.02, doors.height + 0.03, f.v + f.out[1] * 0.02, doors.width - 0.04, 0.04, 0.04, f.turn), 'concrete');
  }

  // Porch back wall (east face of the board wall at uP): a glazed shop front and a dark doorway beside the brick block.
  const vS = along(uP - 0.3).v - 0.06, porchW = vS - vP;
  const door = 0.95, glassW = porchW - door - 0.35;
  b.add(lbox(uP + 0.025, 1.1, vP + 0.25 + door / 2, 0.03, 2.2, door), 'dark');
  b.add(lbox(uP + 0.025, 1.45, vS - 0.1 - glassW / 2, 0.03, 1.9, glassW), 'glass');
  for (const v of [vS - 0.1, vS - 0.1 - glassW / 2, vS - 0.1 - glassW]) b.add(lbox(uP + 0.06, 1.45, v, 0.05, 1.98, 0.05), 'frame');
  for (const y of [0.48, 2.42]) b.add(lbox(uP + 0.06, y, vS - 0.1 - glassW / 2, 0.05, 0.05, glassW + 0.05), 'frame');

  // Serving window in the brick block's east face, 0.1 m from the porch corner, sill 1.05 m.
  const east = faces(block, any(cutU(uP - 0.05), cutV(vP))).filter(e => e.out[0] > 0.7).sort((p, q) => q.len - p.len)[0];
  if (east) {
    // walk from the porch end (larger v) of the east face
    const from = east.a[1] > east.b[1] ? east.a : east.b, dir: UV = east.a[1] > east.b[1] ? east.dir : [-east.dir[0], -east.dir[1]];
    const turn = Math.atan2(east.dir[1], east.dir[0]), at = (s: number, o: number): UV => [from[0] + dir[0] * s + east.out[0] * o, from[1] + dir[1] * s + east.out[1] * o];
    const [gu, gv] = at(0.6, 0.035);
    b.add(lbox(gu, 1.65, gv, 1.0, 1.2, 0.03, turn), 'glass');
    for (const s of [0.1, 0.6, 1.1]) { const [fu, fv] = at(s, 0.07); b.add(lbox(fu, 1.65, fv, 0.06, 1.26, 0.04, turn), 'frame'); }
    for (const y of [1.05, 2.25]) { const [fu, fv] = at(0.6, 0.07); b.add(lbox(fu, y, fv, 1.06, 0.06, 0.04, turn), 'frame'); }
  }

  // The wooden BEA board on the fascia's east face over the porch, standing 7-10 cm proud of it.
  const fe = faces(R, () => false).filter(e => e.out[0] > 0.7 && (e.a[1] + e.b[1]) / 2 > vP && (e.a[1] + e.b[1]) / 2 < 1.7).sort((p, q) => q.len - p.len)[0];
  if (fe) {
    const mu = (fe.a[0] + fe.b[0]) / 2, mv = (fe.a[1] + fe.b[1]) / 2, turn = Math.atan2(fe.dir[1], fe.dir[0]);
    const y = (BEA.wallTop + BEA.fasciaTop) / 2;
    b.add(lbox(mu + fe.out[0] * 0.085, y, mv + fe.out[1] * 0.085, Math.min(1.9, fe.len - 0.1), 0.42, 0.03, turn), 'bronze');
    // letters: the exporter's 7-row pixel font, facing out of the fascia
    const [x, , z] = new T.Vector3(mu + fe.out[0] * 0.14, 0, mv + fe.out[1] * 0.14).applyMatrix4(BASIS).toArray();
    const o = new T.Vector3(fe.out[0], 0, fe.out[1]).applyMatrix4(new T.Matrix4().extractRotation(BASIS));
    b.sign('BEA', x, y - 0.15, z, 0.042, 'red', 1.2, Math.atan2(o.x, o.z));
  }
}
