/**
 * Olympisch Stadion, Olympisch Stadion 2 (BAG pand 0363100012076088, 1928, Jan Wils with G. Jonkheid and Cor van
 * Eesteren; Rijksmonument), with the Marathontoren (BAG pand 0363100012250984, 1928) in front of its east side.
 * Every part comes from the rectified Gemeente Amsterdam panoramas (CC BY 4.0) listed in
 * scripts/landmarks/olympisch-stadion-inventory.json, the Wikimedia Commons photographs named there, or the cited
 * Wikipedia nl:Olympisch Stadion (Amsterdam) text (CC BY-SA 4.0); nothing is described from memory.
 *
 *  - The outer wall follows the BAG ring (scripts/landmarks/olympisch-stadion-footprints.json): dark red-brown brick,
 *    12.8 m high around the curves and the east side (w04-95, w10-172: 50 px/m crops), 15.3 m along the west main
 *    stand (eretribune, w01-258), with a thin grey coping, a row of small grey blocks under it every 1.3 m and a
 *    flagpole on a stone bracket every 6.6 m (every crop).
 *  - Curves: red doors and small red-framed windows in the brick ground storey, alternating with ground-floor runs of
 *    red doors between white piers under a thin concrete canopy (w09, w12, w13, w15, w16); a group of three
 *    red-framed windows at 4.6-5.9 m; open galleries (a dark slot under a concrete lintel with piers, w03, w04, w08,
 *    w13, w14, w17) and stair towers with tall vertical concrete fins (w07, w21, w23, w25, w26, w27).
 *  - North and south ends (w02-348, w10-172, w20, w24): offices looking out (Wikipedia "Aan de noord- en zuidzijde"):
 *    a glazed ground storey under a canopy at 2.8 m, a window band at 3.0-4.7 m under a canopy at 5.0 m and a long
 *    ribbon at 6.4-7.9 m in a concrete surround.
 *  - West main stand (w01-258, 56.7 m): ground windows and doors, ribbon windows at 5.3-6.5 m and 8.4-9.6 m with
 *    concrete bands, the projecting glazed entrance bay with its canopies and the porch on two piers; the stand roof on
 *    short steel posts above the brick (16.9 m), as 3DBAG's 18.8-19.5 m roof.
 *  - East side: the Marathonpoort (main entrance, Wikipedia: gate with two hardstone reliefs by J.C. Altorf, a flat
 *    canopy, a wall with the Olympic rings and CITIUS ALTIUS FORTIUS, a balcony with six decorative frames above),
 *    seen on Commons "Olympisch Stadion Amsterdam front 1" and "Marathontoren 2018" and the tower panoramas; the
 *    Marathon stand's roof shows over the wall on steel posts.
 *  - Four floodlight masts on the diagonals (w05, w11, w15/w28, w22: white lattice; Wikipedia: "de halfronde
 *    lichtmasten gereconstrueerd"), with a semicircular lamp head.
 *  - Inside (Commons "Amsterdam Olympisch Stadion" overview): concrete terraces from the wall top down to a low wall
 *    round the track, a red track and a green field.
 *  - Marathontoren (Wikipedia: 46 m; concrete frame clad in brick; four far-cantilevering canopies over four balconies;
 *    diagonal concrete sound plates above; a big concrete bowl on top): brick plinth on the BAG outline, shaft with a
 *    red-framed glazing slit at both edges of every face, the canopies, sound plates, the Olympic rings on its east
 *    face (Commons "Marathontoren 2018") and the bowl. The Van Tuyll monument (Gra Rueb) stands beside it.
 *
 * Frame: x east, z south, y up from the ground; origin = vertex average of the stadium's outer BAG ring (RD).
 */
import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {upwardRoofPlane} from './house-geometry';
import {raisedLettering} from './ornament-kit';
import {setSink, slab, put, type Frame} from './nearbar-kit';
import plan from './olympisch-stadion-footprints.json';

type V = [number, number];
type C = Parameters<BuildingTools['add']>[1];
let b: BuildingTools;

const WALL = 12.8, WEST_WALL = 15.3;
const O = plan.outer as V[], I = plan.inner as V[], TOWER = plan.tower as V[];
const area = (r: V[]) => r.reduce((s, p, i) => { const q = r[(i + 1) % r.length]; return s + p[0] * q[1] - q[0] * p[1]; }, 0) / 2;
const SIGN = Math.sign(area(O));
const centroid = (r: V[]): V => [r.reduce((s, p) => s + p[0], 0) / r.length, r.reduce((s, p) => s + p[1], 0) / r.length];
const CEN = centroid(I);

type Zone = 'west' | 'east' | 'end' | 'curve';
function zoneOf(x: number, z: number): Zone {
  if (x < -76 && z > -42 && z < 56) return 'west';
  if (x > 66 && z > -66 && z < 30) return 'east';
  // ribbon-windowed office fronts: south-east of the south end (w10, w16, w19)
  if (z > 100 && x > 12 && x < 52) return 'end';
  return 'curve';
}
interface Edge {i: number; a: V; c: V; len: number; mid: V; n: V; fr: Frame; zone: Zone}
/** Wall frame of edge i: local x = (n.z, -n.x) (put() turns local +z to n), t from the end that makes x run along t. */
const EDGES: Edge[] = O.map((a, i) => {
  const c = O[(i + 1) % O.length], len = Math.hypot(c[0] - a[0], c[1] - a[1]);
  const d: V = [(c[0] - a[0]) / len, (c[1] - a[1]) / len];
  const n: V = SIGN < 0 ? [-d[1], d[0]] : [d[1], -d[0]];
  const tan: V = [n[1], -n[0]], fwd = tan[0] * d[0] + tan[1] * d[1] > 0;
  const mid: V = [(a[0] + c[0]) / 2, (a[1] + c[1]) / 2];
  return {i, a, c, len, mid, n, fr: {origin: fwd ? a : c, tangent: tan, n}, zone: zoneOf(mid[0], mid[1])};
});
const nearestEdge = (p: V, minLen = 4) => EDGES.filter(e => e.len >= minLen).reduce((best, e) => (Math.hypot(e.mid[0] - p[0], e.mid[1] - p[1]) < Math.hypot(best.mid[0] - p[0], best.mid[1] - p[1]) ? e : best));
/** The Marathonpoort bay: the BAG edges within 7 m of its front centre (front plus both returns). */
const POORT: V = [81, -22];
const TALL = new Set(EDGES.filter(e => e.zone === 'west' || Math.hypot(e.mid[0] - POORT[0], e.mid[1] - POORT[1]) < 7).map(e => e.i));
/** Edges turned well away from the radial direction (the sides of notches and recesses) get no projecting canopies. */
const radial = (e: Edge) => {
  const d = [e.mid[0] - CEN[0], e.mid[1] - CEN[1]], L = Math.hypot(d[0], d[1]);
  // an edge at a sharp turn (the V-shaped south entrance notch) counts as a recess side too
  const nb = [EDGES[(e.i + EDGES.length - 1) % EDGES.length], EDGES[(e.i + 1) % EDGES.length]];
  if (nb.some(o => o.len > 3 && o.n[0] * e.n[0] + o.n[1] * e.n[1] < 0.5)) return 0;
  return (d[0] * e.n[0] + d[1] * e.n[1]) / L;
};
/** w02-348: the north end's flat-topped office block, 19 m to its white coping (50 px/m crop), 8 m deep (estimated). */
const NORTH = nearestEdge([-25, -125], 20).i, NORTH_H = 19, NORTH_D = 8;
TALL.add(NORTH);
const hWall = (e: Edge) => (e.i === NORTH ? NORTH_H : TALL.has(e.i) ? WEST_WALL : WALL);
const sl = (e: Edge, t: number, y: number, w: number, h: number, d: number, c: C, out = 0) => slab(b, e.fr, t, y, w, h, d, c, out);
const at = (e: Edge, t: number, out: number): V => [e.fr.origin[0] + e.fr.tangent[0] * t + e.n[0] * out, e.fr.origin[1] + e.fr.tangent[1] * t + e.n[1] * out];

function tris(positions: number[]): T.BufferGeometry {
  const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(positions, 3)); g.computeVertexNormals(); return g;
}
function strut(a: T.Vector3, c: T.Vector3, r: number, colour: C) {
  const delta = c.clone().sub(a), g = new T.CylinderGeometry(r, r, delta.length(), 4, 1, true);
  g.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 1, 0), delta.clone().normalize()));
  const m = a.clone().add(c).multiplyScalar(0.5); b.add(g, colour, m.x, m.y, m.z);
}
/** Nearest hit of the ray CEN + s*dir with a ring. */
function rayHit(ring: V[], dir: V): number {
  let best = Infinity;
  for (let i = 0; i < ring.length; i++) {
    const p = ring[i], q = ring[(i + 1) % ring.length], ex = q[0] - p[0], ez = q[1] - p[1];
    const den = dir[0] * ez - dir[1] * ex; if (Math.abs(den) < 1e-9) continue;
    const ox = p[0] - CEN[0], oz = p[1] - CEN[1], s = (ox * ez - oz * ex) / den, u = (ox * dir[1] - oz * dir[0]) / den;
    if (s > 0 && u >= 0 && u <= 1) best = Math.min(best, s);
  }
  return best;
}

/* ========================================================================================== shell: wall, top, bowl */
function shell() {
  // Outer brick wall, one quad per BAG edge, its own height per zone; a filler where the west stand steps up.
  const wall: number[] = [];
  for (const e of EDGES) {
    const h = hWall(e), [ax, az] = e.a, [cx, cz] = e.c;
    // winding so the face normal is the outward n
    const A = [ax, 0, az], B = [cx, 0, cz], Ct = [cx, h, cz], D = [ax, h, az];
    // (B-A) x (Ct-A) is along (-dz, 0, dx): keep the order when that is the outward n
    if (-(cz - az) * e.n[0] + (cx - ax) * e.n[1] > 0) wall.push(...A, ...B, ...Ct, ...A, ...Ct, ...D); else wall.push(...A, ...Ct, ...B, ...A, ...D, ...Ct);
  }
  b.add(tris(wall), 'brick');
  // Sample the ring on rays from the arena centre: the wall line, the terrace's top edge 4.5 m in, the arena edge.
  const N = 160, top: V[] = [], low: V[] = [], fieldEdge: V[] = [], zones: Zone[] = [], back: V[] = [];
  const dirs: V[] = [...Array(N).keys()].map(k => [Math.cos(-k / N * Math.PI * 2), Math.sin(-k / N * Math.PI * 2)]);
  const sOs = dirs.map(d => rayHit(O, d));
  for (let k = 0; k < N; k++) {
    const dir = dirs[k], sO = sOs[k], sI = rayHit(I, dir);
    // the terrace top line keeps 4.5 m inside the nearest wall over a +-2 sample window, so its chords never cut
    // across a recess in the outline (the south entrance notch)
    const sTop = Math.min(...[-2, -1, 0, 1, 2].map(j => sOs[(k + j + N) % N])) - 4.5;
    back.push([CEN[0] + dir[0] * sO, CEN[1] + dir[1] * sO]);
    top.push([CEN[0] + dir[0] * sTop, CEN[1] + dir[1] * sTop]);
    low.push([CEN[0] + dir[0] * sI, CEN[1] + dir[1] * sI]);
    fieldEdge.push([CEN[0] + dir[0] * (sI - 9), CEN[1] + dir[1] * (sI - 9)]);
    zones.push(zoneOf(CEN[0] + dir[0] * sO, CEN[1] + dir[1] * sO));
  }
  // Walkway on the wall top (outer ring minus the terrace top line).
  const ringShape = new T.Shape(O.map(p => new T.Vector2(p[0], p[1])));
  ringShape.holes = [new T.Path(top.map(p => new T.Vector2(p[0], p[1])))];
  b.add(upwardRoofPlane(ringShape, WALL), 'concrete');
  // Terraces: from the walkway down to the low arena wall (1.6 m), facing up and in.
  const LOW = 1.6, inner: number[] = [];
  for (let k = 0; k < N; k++) {
    const j = (k + 1) % N, p = low[k], q = low[j];
    inner.push(p[0], 0, p[1], p[0], LOW, p[1], q[0], LOW, q[1], p[0], 0, p[1], q[0], LOW, q[1], q[0], 0, q[1]);
  }
  fixInward(inner); b.add(tris(inner), 'concrete');
  // Terrace tiers in two tones (Commons overview: grey steps with dark seat rows), welded strips, nothing overlaid.
  const TIERS = [0, 0.18, 0.3, 0.48, 0.6, 0.78, 0.9, 1];
  for (let g = 0; g + 1 < TIERS.length; g++) {
    const P = (m: number, f: number): number[] => { const a = top[m], q = low[m]; return [a[0] + (q[0] - a[0]) * f, WALL + (LOW - WALL) * f, a[1] + (q[1] - a[1]) * f]; };
    const band: number[] = [];
    for (let k = 0; k < N; k++) {
      const j = (k + 1) % N, a0 = P(k, TIERS[g]), a1 = P(j, TIERS[g]), c0 = P(k, TIERS[g + 1]), c1 = P(j, TIERS[g + 1]);
      band.push(...a0, ...c0, ...c1, ...a0, ...c1, ...a1);
    }
    fixUp(band); b.add(tris(band), g % 2 ? 'slate' : 'stone');
  }
  // Track and field.
  const lowShape = new T.Shape(low.map(p => new T.Vector2(p[0], p[1])));
  lowShape.holes = [new T.Path(fieldEdge.map(p => new T.Vector2(p[0], p[1])))];
  b.add(upwardRoofPlane(lowShape, 0.06), 'red');
  b.add(upwardRoofPlane(new T.Shape(fieldEdge.map(p => new T.Vector2(p[0], p[1]))), 0.06), 'green');
  // Stand roofs: the west main stand (on posts over the 15.3 m brick, 22 m deep) and the east Marathon stand
  // (over the 12.8 m wall, 12 m deep): closed slabs over the sampled wall line, on dark steel posts.
  for (const [zone, y, depth, start] of [['west', 16.9, 22, 0.1], ['east', 14.7, 12, 0.25]] as const) {
    const inPt = (k: number, s: number): V => { const d = [back[k][0] - CEN[0], back[k][1] - CEN[1]], L = Math.hypot(d[0], d[1]); return [back[k][0] - d[0] / L * s, back[k][1] - d[1] / L * s]; };
    for (const run of runs(zones.map(z => z === zone), N)) {
      if (run.length < 2) continue;
      bandSolid(run.map(k => inPt(k, start)), run.map(k => inPt(k, depth)), y - 0.45, y + 0.1, 'slate');
      for (const k of run) if (k % 3 === 0) {
        const s = inPt(k, start + 0.5), base = zone === 'west' ? WEST_WALL : WALL;
        if (zone === 'east') b.add(new T.BoxGeometry(0.22, y - base, 0.22), 'dark', s[0], base + (y - base) / 2 - 0.2, s[1]);
        else { const w = inPt(k, 0.15); b.add(new T.BoxGeometry(0.2, y - base - 0.2, 0.2), 'dark', w[0], base - 0.1 + (y - base - 0.2) / 2, w[1]); }
        const sd = depth * 0.8, lowDist = Math.hypot(back[k][0] - low[k][0], back[k][1] - low[k][1]);
        const ground = sd <= 4.5 ? WALL : WALL + (LOW - WALL) * (sd - 4.5) / Math.max(1, lowDist - 4.5), m = inPt(k, sd);
        b.add(new T.BoxGeometry(0.3, y - ground + 0.3, 0.3), 'dark', m[0], ground - 0.3 + (y - ground + 0.3) / 2, m[1]);
      }
    }
  }
  // The raised runs (west main stand, Marathonpoort bay): a 0.3 m thick parapet top, back and ends over the walkway.
  for (const run of runs(EDGES.map(e => TALL.has(e.i)), EDGES.length)) {
    const verts = [...run.map(i => EDGES[i].a), EDGES[run.at(-1)!].c];
    const block = run.includes(NORTH), H = block ? NORTH_H : WEST_WALL, depth = block ? NORTH_D : 0.3, base = block ? 0 : WALL;
    const off = verts.map((v, k) => {
      const n1 = EDGES[run[Math.max(0, k - 1)]].n, n2 = EDGES[run[Math.min(run.length - 1, k)]].n, dot = n1[0] * n2[0] + n1[1] * n2[1];
      const m: V = [(n1[0] + n2[0]) / (1 + dot), (n1[1] + n2[1]) / (1 + dot)];
      return [v[0] - m[0] * depth, v[1] - m[1] * depth] as V;
    });
    const capTop: number[] = [], backs: number[] = [];
    for (let k = 0; k + 1 < verts.length; k++) {
      const a = verts[k], c = verts[k + 1], p = off[k], q = off[k + 1];
      capTop.push(a[0], H, a[1], p[0], H, p[1], q[0], H, q[1], a[0], H, a[1], q[0], H, q[1], c[0], H, c[1]);
      quad(backs, [p[0], base, p[1]], [q[0], base, q[1]], [q[0], H, q[1]], [p[0], H, p[1]], [-EDGES[run[k]].n[0], 0, -EDGES[run[k]].n[1]]);
    }
    for (const [k, sgn] of [[0, -1], [verts.length - 1, 1]] as const) {
      const e = EDGES[run[k === 0 ? 0 : run.length - 1]], d = [e.c[0] - e.a[0], e.c[1] - e.a[1]];
      quad(backs, [verts[k][0], base, verts[k][1]], [off[k][0], base, off[k][1]], [off[k][0], H, off[k][1]], [verts[k][0], H, verts[k][1]], [d[0] * sgn, 0, d[1] * sgn]);
    }
    fixUp(capTop); b.add(tris(capTop), 'brick'); b.add(tris(backs), 'brick');
  }
}
/** Maximal cyclic runs of true flags. */
function runs(flags: boolean[], n: number): number[][] {
  const out: number[][] = [];
  if (flags.every(f => f)) return [[...Array(n).keys()]];
  const start = flags.findIndex((f, k) => !f && flags[(k + 1) % n]);
  if (start < 0) return out;
  let cur: number[] = [];
  for (let s = 1; s <= n; s++) { const k = (start + s) % n; if (flags[k]) cur.push(k); else if (cur.length) { out.push(cur); cur = []; } }
  if (cur.length) out.push(cur);
  return out;
}
/** Quad with its normal along `want`. */
function quad(out: number[], a: number[], c: number[], d: number[], e: number[], want: number[]) {
  const u = new T.Vector3(c[0] - a[0], c[1] - a[1], c[2] - a[2]), v = new T.Vector3(d[0] - a[0], d[1] - a[1], d[2] - a[2]), n = u.cross(v);
  if (n.x * want[0] + n.y * want[1] + n.z * want[2] >= 0) out.push(...a, ...c, ...d, ...a, ...d, ...e); else out.push(...a, ...d, ...c, ...a, ...e, ...d);
}
/** Closed slab between an outer and an inner polyline (same length), from y0 to y1. */
function bandSolid(outer: V[], inner: V[], y0: number, y1: number, colour: C) {
  const g: number[] = [];
  for (let k = 0; k + 1 < outer.length; k++) {
    const a = outer[k], c = outer[k + 1], p = inner[k], q = inner[k + 1];
    const outN = [a[0] - p[0], 0, a[1] - p[1]];
    quad(g, [a[0], y1, a[1]], [c[0], y1, c[1]], [q[0], y1, q[1]], [p[0], y1, p[1]], [0, 1, 0]);
    quad(g, [a[0], y0, a[1]], [c[0], y0, c[1]], [q[0], y0, q[1]], [p[0], y0, p[1]], [0, -1, 0]);
    quad(g, [a[0], y0, a[1]], [c[0], y0, c[1]], [c[0], y1, c[1]], [a[0], y1, a[1]], outN);
    quad(g, [p[0], y0, p[1]], [q[0], y0, q[1]], [q[0], y1, q[1]], [p[0], y1, p[1]], [-outN[0], 0, -outN[2]]);
  }
  for (const [k, sgn] of [[0, -1], [outer.length - 1, 1]] as const) {
    const o = outer[k], i = inner[k], nb = outer[k === 0 ? 1 : k - 1], d = [(o[0] - nb[0]) * (k === 0 ? 1 : 1), 0, (o[1] - nb[1])];
    void sgn;
    quad(g, [o[0], y0, o[1]], [i[0], y0, i[1]], [i[0], y1, i[1]], [o[0], y1, o[1]], d);
  }
  b.add(tris(g), colour);
}
/** Make every triangle of a flat-ish soup face up. */
function fixUp(p: number[]) {
  for (let i = 0; i < p.length; i += 9) {
    const ux = p[i + 3] - p[i], uz = p[i + 5] - p[i + 2], vx = p[i + 6] - p[i], vz = p[i + 8] - p[i + 2];
    if (uz * vx - ux * vz < 0) for (let k = 0; k < 3; k++) { const t = p[i + 3 + k]; p[i + 3 + k] = p[i + 6 + k]; p[i + 6 + k] = t; }
  }
}
/** Make every vertical triangle face the arena centre. */
function fixInward(p: number[]) {
  for (let i = 0; i < p.length; i += 9) {
    const u = new T.Vector3(p[i + 3] - p[i], p[i + 4] - p[i + 1], p[i + 5] - p[i + 2]), v = new T.Vector3(p[i + 6] - p[i], p[i + 7] - p[i + 1], p[i + 8] - p[i + 2]);
    const n = u.cross(v), toC = new T.Vector3(CEN[0] - p[i], 0, CEN[1] - p[i + 2]);
    if (n.dot(toC) < 0) for (let k = 0; k < 3; k++) { const t = p[i + 3 + k]; p[i + 3 + k] = p[i + 6 + k]; p[i + 6 + k] = t; }
  }
}

/* ===================================================================================== wall-top coping, flagpoles */
/** A small block on the wall: front, top and both sides only (8 triangles); the back and bottom are never seen. */
function block(e: Edge, t: number, y: number, w: number, h: number, d: number, c: C) {
  const g = new T.BoxGeometry(w, h, d + 0.06).translate(0, h / 2, (d + 0.06) / 2), idx = g.getIndex()!.array, keep: number[] = [];
  for (const face of [0, 1, 2, 4]) for (let i = 0; i < 6; i++) keep.push(idx[face * 6 + i]);
  g.setIndex(keep); put(b, e.fr, g, t, y, -0.06, c);
}
function crown() {
  let run = 3.3;
  for (const e of EDGES) {
    const h = hWall(e);
    if (e.len > 0.5) sl(e, e.len / 2, h - 0.2, e.len + 0.02, 0.35, 0.1, 'concrete');
    // small grey blocks under the coping, every 1.3 m
    if (e.i !== NORTH) for (let t = 0.65; t < e.len - 0.3; t += 1.3) block(e, t, h - 0.55, 0.26, 0.24, 0.2, 'concrete');
    // flagpoles every 6.6 m of perimeter on a stone bracket
    for (let t = 0; t < e.len; t += 0.5) {
      // the west main stand and the Marathonpoort carry no flagpoles (w01-258, Commons front 1)
      run += 0.5; if (TALL.has(e.i) || run < 6.6 || t < 0.5 || t > e.len - 0.5) continue; run = 0;
      sl(e, t, h - 1.7, 0.36, 1.25, 0.32, 'concrete');
      const [px, pz] = at(e, t, 0.2);
      b.add(new T.CylinderGeometry(0.05, 0.06, 5.6, 4, 1), 'concrete', px, h - 0.5 + 2.8, pz);
      b.add(new T.CylinderGeometry(0.1, 0.1, 0.35, 4, 1), 'gold', px, h + 5.25, pz);
      // pennant, hanging off the pole towards the viewer's right
      const tan = e.fr.tangent, y0 = h + 4.9;
      b.add(tris([px, y0, pz, px + tan[0] * 0.9, y0 - 0.9, pz + tan[1] * 0.9, px, y0 - 1.5, pz]), 'red');
    }
  }
}

/* ============================================================================================ facades per zone */
function window3(e: Edge, t: number, y: number, w: number, h: number) {
  sl(e, t, y, w, h, 0.07, 'red');
  sl(e, t, y + 0.08, w - 0.16, h - 0.16, 0.13, 'glass');
}
function curveFacade(e: Edge) {
  if (e.len < 4) return;
  const L = e.len, m = 0.5;
  if (e.i % 2 === 0) {
    // ground-floor run: red doors between white piers under a thin canopy (w09, w12, w13)
    if (radial(e) > 0.6) sl(e, L / 2, 2.75, L - 2 * m, 0.22, 0.95, 'concrete');
    const n = Math.max(1, Math.round((L - 2 * m) / 2.4)), p = (L - 2 * m) / n;
    for (let k = 0; k <= n; k++) sl(e, m + k * p, 0, 0.4, 2.75, 0.45, 'concrete');
    for (let k = 0; k < n; k++) { const t = m + (k + 0.5) * p; sl(e, t, 0, p - 0.7, 2.4, 0.09, 'red'); sl(e, t, 1.25, p - 1.2, 0.9, 0.15, 'glass'); }
  } else {
    // brick ground storey: red doors and small windows (w04, w05, w11)
    sl(e, m + 0.8, 0, 1.15, 2.35, 0.1, 'red');
    for (let t = m + 2.4; t < L - m - 0.7; t += 1.6) window3(e, t, 1.2, 1.2, 1.4);
  }
  if (L >= 5.5) for (const dt of [-1.5, 0, 1.5]) window3(e, L / 2 + dt, 4.6, 1.15, 1.3);
}
function gallery(e: Edge) {
  // open gallery: dark slot 5.9-7.6 m under a concrete lintel, with piers (w04)
  const w = Math.min(e.len - 1, 7.5), t = e.len / 2;
  sl(e, t, 5.9, w, 1.75, 0.08, 'dark');
  sl(e, t, 7.65, w + 0.3, 0.3, 0.6, 'concrete');
  for (let k = 0; k <= 3; k++) sl(e, t - w / 2 + 0.25 + k * (w - 0.5) / 3, 5.9, 0.35, 1.75, 0.3, 'concrete');
}
function stairFins(e: Edge) {
  // stair tower: tall recessed opening filled with vertical concrete fins (w07, w21, w25)
  const w = Math.min(e.len - 1.2, 5.2), t = e.len / 2;
  sl(e, t, 3.2, w, 7.6, 0.07, 'dark');
  for (let u = -w / 2 + 0.25; u <= w / 2 - 0.2; u += 0.62) sl(e, t + u, 3.2, 0.14, 7.6, 0.45, 'concrete');
  sl(e, t, 10.8, w + 0.4, 0.3, 0.55, 'concrete');
}
function northFacade(e: Edge) {
  // w02-348: six concrete piers carrying a deep canopy at 5.0 m over red glazed doors (small canopies at 2.4 m) and
  // windows at 3.0-4.0 m; five ribbon windows at 6.0-7.4 m under a concrete band at 7.5 m; a few small windows high up.
  const L = e.len, p = (L - 1.2) / 5;
  sl(e, L / 2, 4.85, L - 0.2, 0.25, 1.6, 'concrete');
  for (let k = 0; k <= 5; k++) sl(e, 0.6 + k * p, 0, 0.6, 4.85, 0.6, 'concrete', 1.0);
  for (let k = 0; k < 5; k++) {
    const t = 0.6 + (k + 0.5) * p;
    sl(e, t, 0, 3.2, 2.3, 0.08, 'red'); sl(e, t, 0.1, 2.9, 2.1, 0.14, 'glass');
    sl(e, t, 2.35, 4.0, 0.15, 0.7, 'concrete');
    window3(e, t, 2.95, 2.9, 1.1);
    sl(e, t, 6.0, 4.4, 1.4, 0.08, 'red'); sl(e, t, 6.08, 4.2, 1.24, 0.14, 'glass');
  }
  sl(e, L / 2, 7.5, L - 0.2, 0.15, 0.15, 'concrete');
  for (const [t, y] of [[3, 16.7], [3, 14.3], [24.5, 16.7], [24.5, 14.3], [19, 14.3]] as const) if (t < L - 1) window3(e, t, y, 1.25, 0.8);
}
function endFacade(e: Edge) {
  if (e.len < 3) return;
  const L = e.len, m = 0.35;
  // glazed ground storey under a canopy at 2.8 m (w10, w02)
  sl(e, L / 2, 0, L - 2 * m, 2.5, 0.08, 'red'); sl(e, L / 2, 0.1, L - 2 * m - 0.3, 2.3, 0.14, 'glass');
  if (radial(e) > 0.6) sl(e, L / 2, 2.8, L - 0.1, 0.2, 0.85, 'concrete');
  // window band 3.0-4.7 m under a canopy at 5.0 m
  sl(e, L / 2, 3.0, L - 2 * m, 1.7, 0.08, 'red'); sl(e, L / 2, 3.1, L - 2 * m - 0.3, 1.5, 0.14, 'glass');
  sl(e, L / 2, 5.0, L - 0.1, 0.2, 0.6, 'concrete');
  // ribbon 6.4-7.9 m in a concrete surround
  sl(e, L / 2, 6.2, L - 0.1, 1.95, 0.08, 'concrete');
  sl(e, L / 2, 6.4, L - 0.6, 1.5, 0.14, 'red'); sl(e, L / 2, 6.5, L - 0.9, 1.3, 0.2, 'glass');
}
/** w01-258 (56.7 m) is BAG edges 111 + 112, nearly collinear: one run along both, global position s. */
const W01 = (() => {
  const two = EDGES.filter(x => x.zone === 'west').sort((p, q) => q.len - p.len).slice(0, 2);
  const tan = two[0].fr.tangent, proj = (e: Edge) => e.fr.origin[0] * tan[0] + e.fr.origin[1] * tan[1];
  two.sort((p, q) => proj(p) - proj(q));
  return {edges: two, total: two[0].len + two[1].len};
})();
/** Global s measured along edge 112's line (the photo's facade plane); on edge 111 the point is projected back onto it. */
const w01At = (s: number): [Edge, number] => {
  const [e0, e1] = W01.edges, t1 = s - e0.len;
  if (t1 >= 0) return [e1, t1];
  const P = at(e1, t1, 0), o = e0.fr.origin, tg = e0.fr.tangent;
  return [e0, (P[0] - o[0]) * tg[0] + (P[1] - o[1]) * tg[1]];
};
function w01Facade() {
  // band 2 (5.3-6.5 m): three runs either side of the 18 m glazed entrance bay; band 3 (8.4-9.6 m): eleven runs (w01-258)
  // measured on the crop (35.3 px/m): runs 4.4 m wide, centres 4.6 m from each end and 5.65 m apart
  const T0 = W01.total, side = 5.3;
  const runs2 = [0, 1, 2].flatMap(k => [4.6 + k * 5.65, T0 - 4.6 - k * 5.65]);
  const runs3 = [...Array(11).keys()].map(k => (k + 0.5) * T0 / 11);
  for (const [y, h, list, w] of [[5.3, 1.2, runs2, 4.4], [8.4, 1.2, runs3, T0 / 11 - 0.9]] as const)
    for (const s0 of list) { const [e, t] = w01At(s0); sl(e, t, y, w, h, 0.08, 'red'); sl(e, t, y + 0.08, w - 0.2, h - 0.16, 0.14, 'glass'); }
  // ground storey, mirrored about the entrance: tall red-framed windows, every fourth a red door
  for (let k = 0; 6.2 + k * 1.75 < T0 / 2 - 0.8; k++) for (const sg of [-1, 1]) {
    const [e, t] = w01At(T0 / 2 + sg * (6.2 + k * 1.75));
    if (k % 4 === 3) { sl(e, t, 0, 1.0, 2.8, 0.07, 'red'); sl(e, t, 0.8, 0.8, 1.9, 0.13, 'glass'); } else window3(e, t, 1.0, 1.0, 1.8);
  }
}
function westFacade(e: Edge) {
  if (e.len < 2) return;
  const L = e.len, isW01 = W01.edges.includes(e);
  // ribbons 5.3-6.5 m and 8.4-9.6 m, each under a concrete band; piers of brick between 4.6 m runs
  for (const [y, h, band, proj] of [[5.3, 1.2, 6.75, 0.6], [8.4, 1.2, 9.8, 0.18]] as const) {
    sl(e, L / 2, band, L + 0.02, 0.22, proj, 'concrete');
    sl(e, L / 2, y - 0.25, L + 0.02, 0.18, 0.12, 'concrete');
    const n = Math.max(1, Math.round(L / 5.4)), p = L / n;
    if (!isW01) for (let k = 0; k < n; k++) { const t = (k + 0.5) * p; sl(e, t, y, p - 0.8, h, 0.08, 'red'); sl(e, t, y + 0.08, p - 1.0, h - 0.16, 0.14, 'glass'); }
  }
  sl(e, L / 2, 4.85, L + 0.02, 0.2, 0.15, 'concrete');
  // ground storey: windows and red doors
  if (!isW01) for (let t = 1.0; t < L - 0.6; t += 1.75) { if (Math.round(t / 1.75) % 4 === 3) sl(e, t, 0, 0.95, 2.6, 0.1, 'red'); else window3(e, t, 1.0, 1.0, 1.8); }
}
function westEntrance() {
  // Centre of w01 (edges 111 + 112, 56.6 m): the glazed bay at 5.3-7.0 m with its canopies and the porch on two piers.
  const [e, tc] = w01At(W01.total / 2);
  sl(e, tc, 4.55, 20.5, 0.25, 1.9, 'concrete');
  sl(e, tc, 4.8, 18, 2.1, 1.3, 'concrete');
  sl(e, tc, 4.95, 17.4, 1.8, 1.42, 'red'); sl(e, tc, 5.05, 17.0, 1.6, 1.5, 'glass');
  sl(e, tc, 6.9, 20.5, 0.25, 1.9, 'concrete');
  sl(e, tc, 3.25, 9.5, 0.3, 3.7, 'concrete');
  for (const d of [-3.4, 3.4]) sl(e, tc + d, 0, 0.55, 3.25, 0.55, 'concrete', 3.0);
  sl(e, tc, 0, 4.2, 2.8, 0.1, 'red'); sl(e, tc, 0.1, 3.8, 2.5, 0.16, 'glass');
  for (let k = 0; k < 3; k++) sl(e, tc, 0, 5.2 - k * 0.6, 0.16 * (k + 1), 2.6 - k * 0.6, 'concrete', 0);
}
function eastFacade(e: Edge) {
  if (e.len < 4) return;
  const L = e.len;
  // flat ground-floor canopies on square columns over glazing (Commons front 1)
  sl(e, L / 2, 3.3, L - 0.2, 0.25, 1.8, 'concrete');
  for (let t = 0.6; t < L - 0.4; t += 4.2) sl(e, t, 0, 0.45, 3.3, 0.45, 'concrete', 1.25);
  for (let t = 2.7; t < L - 1.5; t += 4.2) { sl(e, t, 0, 3.2, 2.9, 0.08, 'red'); sl(e, t, 0.1, 2.9, 2.6, 0.14, 'glass'); }
  for (let t = 3; t < L - 2; t += 8) for (const dt of [-0.8, 0.8]) window3(e, t + dt, 5.4, 1.1, 1.3);
}
function marathonpoort() {
  // Edge 21 region: the 10 m bay projecting ~2.7 m from the east wall, north of the gate stands the tower.
  const e = nearestEdge([81, -22], 8), L = e.len, t = L / 2;
  sl(e, t, 0, 5.0, 4.0, 0.08, 'dark');
  for (const d of [-3.4, 3.4]) sl(e, t + d, 0.6, 1.3, 2.6, 0.12, 'stone');
  sl(e, t, 4.15, L - 0.3, 0.3, 2.4, 'concrete');
  // names cut beside the gate: pale stone tablets
  for (const d of [-4.4, 4.4]) sl(e, t + d, 4.8, 1.0, 1.6, 0.08, 'stone');
  const txt = raisedLettering({text: 'CITIUS ALTIUS FORTIUS', heightM: 0.42, maxWidthM: 7.6, depthM: 0.05});
  put(b, e.fr, txt.geometry, t, 5.9, 0, 'blue');
  rings(e.fr, t, 7.6, 0.06, 0.62);
  // balcony with six decorative frames rising over the wall top
  sl(e, t, 9.8, L - 0.2, 0.3, 1.1, 'concrete');
  for (let k = 0; k < 6; k++) sl(e, t - (L - 1.6) / 2 + k * (L - 1.6) / 5, 9.8, 0.32, 5.0, 1.1, 'concrete');
  sl(e, t, 14.4, L - 0.4, 0.35, 1.1, 'concrete');
}
/** The five Olympic rings, facing out of frame f, centred at (t, y). */
function rings(f: Frame, t: number, y: number, out: number, r: number) {
  const cols: C[] = ['blue', 'dark', 'red', 'gold', 'green'], pos = [[-2.2, 0], [0, 0], [2.2, 0], [-1.1, -0.6], [1.1, -0.6]];
  pos.forEach(([dx, dy], k) => {
    const g = new T.TorusGeometry(r, r * 0.13, 4, 14);
    put(b, f, g, t + dx * r, y + dy * r, out + r * 0.13 + 0.02 + (k > 2 ? 0.06 : 0), cols[k]);
  });
}

/* ================================================================================================ masts, tower */
function mast(p: V, pier = false) {
  const e = nearestEdge(p, 4), t = Math.min(Math.max(e.len / 2, 1), e.len - 1), H = 32;
  // w22, w28: a tall brick pier beside the mast foot
  if (pier) sl(e, t + 1.9, 0, 1.2, 9.5, 1.0, 'brick');
  const legs = [-0.75, 0.75].map(d => at(e, t + d, 0.1));
  for (const [x, z] of legs) b.add(new T.BoxGeometry(0.3, H, 0.3), 'concrete', x, H / 2, z);
  for (let y = 1; y < H - 3; y += 3.2) {
    strut(new T.Vector3(legs[0][0], y, legs[0][1]), new T.Vector3(legs[1][0], y + 3.2, legs[1][1]), 0.06, 'concrete');
    strut(new T.Vector3(legs[1][0], y, legs[1][1]), new T.Vector3(legs[0][0], y + 3.2, legs[0][1]), 0.06, 'concrete');
  }
  // semicircular lamp head over the legs, facing the arena
  const s = new T.Shape(); s.moveTo(3.2, 0); s.absarc(0, 0, 3.2, 0, Math.PI, false); s.lineTo(-2.5, 0); s.absarc(0, 0, 2.5, Math.PI, 0, true); s.lineTo(3.2, 0);
  const head: Frame = {origin: at(e, t, 0.3), tangent: e.fr.tangent, n: [-e.n[0], -e.n[1]]};
  put(b, head, new T.ExtrudeGeometry(s, {depth: 0.3, bevelEnabled: false, curveSegments: 10}), 0, H - 0.4, 0, 'concrete');
  const lamps = new T.Shape(); lamps.moveTo(3.0, 0); lamps.absarc(0, 0, 3.0, 0, Math.PI, false); lamps.lineTo(-2.7, 0); lamps.absarc(0, 0, 2.7, Math.PI, 0, true); lamps.lineTo(3.0, 0);
  put(b, head, new T.ExtrudeGeometry(lamps, {depth: 0.1, bevelEnabled: false, curveSegments: 10}), 0, H - 0.4, 0.3, 'gold');
  sl(e, t, H - 0.45, 6.6, 0.45, 0.3, 'concrete', -0.05);
}
function tower() {
  const c = centroid(TOWER);
  // long side of the BAG plinth: (86.83,-32.27) -> (92.28,-33.44), about 12 deg off east
  const ang = Math.atan2(-(TOWER[9][1] - TOWER[8][1]), TOWER[9][0] - TOWER[8][0]);
  const bx = (x: number, y: number, z: number, w: number, h: number, d: number, col: C, extra = 0) => {
    const g = new T.BoxGeometry(w, h, d); g.rotateY(extra);
    g.translate(x, y + h / 2, z); g.rotateY(ang); g.translate(c[0], 0, c[1]); b.add(g, col);
  };
  const BASE = 9.6, SH = 37.2, sw = 3.5, sd = 3.1;
  bx(0, 0, 0, 5.4, BASE, 4.2, 'brick');
  bx(0, BASE - 0.05, 0, 5.7, 0.3, 4.5, 'concrete');
  for (const s of [-1, 1]) bx(s * 2.0, BASE + 0.25, 0, 1.0, 1.4, 3.6, 'brick');
  bx(0, BASE + 0.25, 0, sw, SH - BASE - 0.25, sd, 'brick');
  // red-framed glazing slits at both edges of every face, concrete ledges every 3.3 m
  const faces: [number, number, number, number][] = [[1, 0, sw, sd], [-1, 0, sw, sd], [0, 1, sd, sw], [0, -1, sd, sw]];
  for (const [fx, fz, , across] of faces) for (const s of [-1, 1]) {
    const off = s * (across / 2 - 0.45);
    const px = fx ? fx * (sw / 2) : off, pz = fz ? fz * (sd / 2) : off;
    const along = fx ? [0.06, 0.5] : [0.5, 0.06];
    bx(px + fx * 0.03, 11.2, pz + fz * 0.03, fx ? 0.12 : 0.55, 24.8, fz ? 0.12 : 0.55, 'red');
    bx(px + fx * 0.09, 11.3, pz + fz * 0.09, fx ? 0.1 : 0.32, 24.6, fz ? 0.1 : 0.32, 'glass');
    for (let y = 11.2; y < 36; y += 3.3) bx(px + fx * 0.1, y, pz + fz * 0.1, fx ? 0.3 : 0.75, 0.14, fz ? 0.3 : 0.75, 'concrete');
    void along;
  }
  // four cantilevering canopies over four balconies
  bx(0, SH, 0, 7.4, 0.35, 2.4, 'concrete'); bx(0, SH - 0.02, 0, 2.4, 0.39, 6.8, 'concrete');
  for (const [x, z] of [[2.3, 0], [-2.3, 0], [0, 2.1], [0, -2.1]]) bx(x, SH - 1.1, z, x ? 1.0 : 1.6, 1.05, z ? 1.0 : 1.6, 'concrete');
  // stepped block with diagonal sound plates, then the stem and the bowl
  bx(0, SH + 0.35, 0, 2.6, 1.9, 2.6, 'concrete');
  for (const q of [0, 1, 2, 3]) {
    const a = Math.PI / 4 + q * Math.PI / 2;
    bx(Math.cos(a) * 1.6, SH + 1.4, -Math.sin(a) * 1.6, 1.6, 0.22, 0.9, 'concrete', a);
  }
  bx(0, SH + 2.25, 0, 1.8, 1.8, 1.8, 'concrete');
  bx(0, SH + 4.05, 0, 1.0, 1.4, 1.0, 'concrete');
  const stem = new T.CylinderGeometry(0.35, 0.45, 1.6, 8, 1); b.add(stem, 'concrete', c[0], SH + 5.45 + 0.8, c[1]);
  const prof = [[0.3, 0], [1.1, 0.25], [1.7, 0.7], [1.95, 1.2], [1.9, 1.6], [1.6, 1.75]].map(([r, y]) => new T.Vector2(r, y));
  b.add(new T.LatheGeometry(prof, 14), 'concrete', c[0], SH + 7.05, c[1]);
  const lid = new T.CircleGeometry(1.6, 14); lid.rotateX(-Math.PI / 2); b.add(lid, 'dark', c[0], SH + 8.75, c[1]);
  // Olympic rings on the east face, at the shaft top (Commons "Marathontoren 2018")
  const east: Frame = {origin: [c[0] + Math.cos(ang) * sw / 2, c[1] - Math.sin(ang) * sw / 2], tangent: [-Math.sin(ang), -Math.cos(ang)], n: [Math.cos(ang), -Math.sin(ang)]};
  rings(east, 0, SH - 0.7, 0.05, 0.5);
  // Van Tuyll monument beside the tower: brick pedestal with a bronze saluting figure
  const m: V = [c[0] - 1.5, c[1] - 8.5];
  b.add(new T.BoxGeometry(1.5, 3.0, 1.5), 'brick', m[0], 1.5, m[1]);
  b.add(new T.BoxGeometry(0.55, 1.5, 0.35), 'bronze', m[0], 3.75, m[1]);
  b.add(new T.BoxGeometry(0.3, 0.3, 0.3), 'bronze', m[0], 4.65, m[1]);
  const arm = new T.BoxGeometry(0.14, 0.9, 0.14); arm.rotateX(-0.6); b.add(arm, 'bronze', m[0] + 0.32, 4.6, m[1] + 0.2);
}

export function buildOlympischStadion(_w: number, _d: number, tools: BuildingTools) {
  b = tools;
  setSink(0);
  shell();
  crown();
  const galleries: V[] = [[86, 46], [-56, 77], [-66, -91], [58, -77], [-43, -109], [44, -95]];
  const stairs: V[] = [[-83, -44], [-79, -64], [-59, -99], [62, 101], [-11, 117], [82, 66]];
  const MASTS: [V, boolean][] = [[[77, 77], false], [[-74, -75], false], [[-27, 110], true], [[34, -102], true]];
  const special = new Set<number>([...galleries.map(p => nearestEdge(p, 5).i), ...stairs.map(p => nearestEdge(p, 5).i), ...MASTS.map(([p]) => nearestEdge(p, 4).i)]);
  for (const p of galleries) gallery(nearestEdge(p, 5));
  for (const p of stairs) stairFins(nearestEdge(p, 5));
  const poort = nearestEdge([81, -22], 8).i;
  for (const e of EDGES) {
    if (e.i === poort) continue;
    if (special.has(e.i)) continue;
    if (e.i === NORTH) { northFacade(e); continue; }
    if (e.zone === 'west') westFacade(e);
    else if (e.zone === 'east') eastFacade(e);
    else if (e.zone === 'end') endFacade(e);
    else curveFacade(e);
  }
  w01Facade();
  westEntrance();
  marathonpoort();
  for (const [p, pier] of MASTS) mast(p, pier);
  tower();
}
