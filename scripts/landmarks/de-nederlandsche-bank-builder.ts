import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {addShell, planarPolygon, type Surface} from './worship-shell';
import {wallsOf, type Wall} from './worship-walls';
import {faceOut, frameOf, put, ringFrame, roofHeightAt, setSink, slab, type Frame} from './nearbar-kit';
import rawSource from './de-nederlandsche-bank-footprints.json';

/**
 * De Nederlandsche Bank, Westeinde 1 / Frederiksplein 61 (Marius Duintjer, 1961-68; restored by Mecanoo, 2025).
 * Massing is the 3DBAG LoD2.2 shell of the BAG pand (native east/south metres from the pand centroid); axes run along
 * bearings 166 and 76. The 1990 cylindrical satellite tower in the courtyard (J. Abma) is demolished (BAG pand
 * 0363100012178159 "gesloopt"), so its 3DBAG surfaces are skipped and the courtyard is open again.
 *  - podium: ground floor of dark glazing behind round concrete columns, a red-brown tile fascia carried on concrete
 *    corbels, two storeys of ribbon windows divided by a white spandrel band, a thin eave plate and a set-back top storey;
 *  - tower (66 m, 18 x 48 m plan): red-brown tile spandrels with narrow window strips, two small technical storeys and a
 *    thin pale roof plate that overhangs the walls, with the tile-clad plant blocks above it.
 * Window levels and strip pitches are measured by eye from the 2025 Commons photographs, the 2021 municipal panoramas and
 * the Mecanoo elevations; the tower strips follow the east-elevation drawing (12 strips above the podium, 3.6 m pitch).
 *
 * Link core (2026-10-11): the 3DBAG point cloud is AHN4 2020, from before the satellite was demolished, and 3DBAG fused the satellite's
 * link core (x 12-25 m east, z 9-23 m south, up to 51-64 m; the heights are the satellite's roof levels 50.9 / 54.5 / 64.4), a 5.5-18.4 m
 * annex at its foot and a 3-5 m protruding block into the tower's west face (walls 313, 312, 293, 294, 168, 125, 126 ...). The BAG pand of
 * the satellite (0363100012178159, "Pand gesloopt", document 2022-02-22, footprint x -13..14 m) abuts them, the 2022 and 2025 photographs
 * and the Mecanoo west/south/east elevations show a plain slab with no fin, and the 1960s aerial shows the slab alone. So every tall wall
 * and roof west of the tower's west face line is dropped, the west face is closed with one plane through the roof outline's own vertices,
 * and the terrace holes the core leaves are filled flat at the terrace level.
 */
type V2 = [number, number];
const centroid = (s: Surface) => {
  const p = s.rings[0];
  return [p.reduce((a, v) => a + v[0], 0) / p.length, p.reduce((a, v) => a + v[2], 0) / p.length];
};
const maxY = (s: Surface) => Math.max(...s.rings[0].map(p => p[1]));
const minY = (s: Surface) => Math.min(...s.rings[0].map(p => p[1]));
/** x of the tower's west face at depth z (line through the 3DBAG north-end wall 391 corner (21.0, -7.2) and the south west-face wall 84 corner (26.4, 17.0)). */
const westFaceX = (z: number) => 21.0 + (26.4 - 21.0) / (17.0 + 7.2) * (z + 7.2);
const dropCore = (s: Surface) => {
  if (s.type !== 'WallSurface' && s.type !== 'RoofSurface') return false;
  const [x, z] = centroid(s);
  if (!(z > -12 && z < 24 && x > 10 && x < westFaceX(z) - 0.9)) return false;
  const xs = s.rings[0].map(p => p[0]), zs = s.rings[0].map(p => p[2]);
  const span = Math.max(...xs) - Math.min(...xs) + Math.max(...zs) - Math.min(...zs);
  const annex = span < 14 && maxY(s) > 18 && maxY(s) < 19 && (s.type === 'RoofSurface' || minY(s) < 6.5);
  return (maxY(s) > 30) || annex;
};
const SYNTH = new WeakSet<Surface>();
/** Wall ring along the polyline pts (x, z) from y0 to y1, wound so the Newell normal points west. */
const westWall = (pts: V2[], y0: number, y1: number, lastSplits: number[], firstSplits: number[]): Surface => {
  // extra vertices on the two vertical sides at the heights where the neighbouring 3DBAG walls have vertices, so the edges are shared exactly
  const last = pts[pts.length - 1], first = pts[0];
  const r = [
    ...pts.map(p => [p[0], y1, p[1]]),
    ...lastSplits.map(y => [last[0], y, last[1]]),
    ...pts.slice().reverse().map(p => [p[0], y0, p[1]]),
    ...firstSplits.map(y => [first[0], y, first[1]]),
  ];
  let nx = 0;
  for (let i = 0; i < r.length; i++) { const a = r[i], c = r[(i + 1) % r.length]; nx += (a[1] - c[1]) * (a[2] + c[2]); }
  const s: Surface = {type: 'WallSurface', rings: [nx <= 0 ? r : r.slice().reverse()]};
  SYNTH.add(s);
  return s;
};
// the polyline is the west edge of the 3DBAG roof outline (460), so the top edge is shared exactly
const WEST_POLY: V2[] = [[20.959, -7.181], [23.361, 2.867], [24.812, 8.935], [26.706, 16.859], [26.359, 16.967]];
const source = {
  ...rawSource,
  surfaces: [
    ...(rawSource.surfaces as Surface[]).filter(s => !dropCore(s)),
    westWall(WEST_POLY, 0, 66.1, [65.7, 8.33], [17.05]),
  ],
};
const ring = (source as {nativeRing: number[][]}).nativeRing;
const surfaces = source.surfaces as Surface[];
const ROT: [number, number, number] = [0.5, 20.7, 16.5];
const inRot =(s: Surface) => { const [x, z] = centroid(s); return Math.hypot(x - ROT[0], z - ROT[1]) < ROT[2] && maxY(s) > 20; };

const GROUND = 5.9;     // top of the ground storey / tile fascia
const EAVE = 13.1;       // top of the two podium office storeys
const TOWER_TOP = 66.1;
const STRIP0 = 18.9, PITCH = 3.6, STRIPS = 12;

/** Mullion as one flat strip standing just proud of the glazing (2 triangles instead of a 12-triangle box). */
function mull(b: BuildingTools, f: Frame, t: number, y: number, h: number, out: number, w = 0.07) {
  put(b, f, new T.PlaneGeometry(w, h).translate(0, h / 2, 0), t, y, out, 'frame');
}

export function buildDeNederlandscheBank(_w: number, _d: number, b: BuildingTools & {mark?: (n: string) => void}) {
  // ---- shell: tower walls tile-red, podium ground storey dark, upper podium walls pale ----
  const skip = (s: Surface) => inRot(s);
  const isTower = (s: Surface) => s.type === 'WallSurface' && maxY(s) > 40;
  const isGround = (s: Surface) => s.type === 'WallSurface' && maxY(s) <= GROUND + 0.15;
  addShell(b, source as never, {wall: 'brick', roof: 'slate', skip: (s, i) => skip(s) || s.type === 'WallSurface' && !isTower(s)});
  addShell(b, source as never, {wall: 'dark', roof: 'slate', skip: (s, i) => skip(s) || s.type !== 'WallSurface' || !isGround(s)});
  addShell(b, source as never, {wall: 'white', roof: 'slate', skip: (s, i) => skip(s) || s.type !== 'WallSurface' || isTower(s) || isGround(s)});
  b.mark?.('shell');

  const kept = surfaces.filter(s => !skip(s) && s.type !== 'GroundSurface');
  const geos = kept.map(s => planarPolygon(s.rings)).filter((g): g is T.BufferGeometry => !!g);
  const edgeGeos = kept.map(s => planarPolygon(s.rings)).filter((g): g is T.BufferGeometry => !!g);
  const group = new T.Group();
  for (const g of geos) group.add(new T.Mesh(g, new T.MeshBasicMaterial({side: T.DoubleSide})));
  group.updateMatrixWorld(true);
  const rc = new T.Raycaster();
  /** Outward offset of the shell wall from ring frame f at (t, y); null when no wall within 6 m. */
  const offsetAt = (f: Frame, t: number, y: number): number | null => {
    const reach = 6;
    rc.set(new T.Vector3(f.origin[0] + f.tangent[0] * t + f.n[0] * reach, y, f.origin[1] + f.tangent[1] * t + f.n[1] * reach), new T.Vector3(-f.n[0], 0, -f.n[1]));
    rc.far = reach * 2;
    const hit = rc.intersectObject(group, true).find(h => h.distance > 0.001);
    return hit ? reach - hit.distance : null;
  };
  /** Wall top at t: highest y where a wall is still within reach, scanning down from 14 m. */
  const wallTopAt = (f: Frame, t: number) => { for (let y = 14; y > 8; y -= 0.1) if (offsetAt(f, t, y) !== null && offsetAt(f, t, y - 0.3) !== null) return y; return 13.1; };
  /** Frame lying on the real wall between t0 and t1 at height y (the 3DBAG wall is rarely parallel to the BAG ring). Local t starts at t0. */
  const segFrame = (f: Frame, t0: number, t1: number, y: number): Frame => {
    const o0 = offsetAt(f, t0 + 0.2, y), o1 = offsetAt(f, t1 - 0.2, y);
    const a0 = o0 ?? o1 ?? 0, a1 = o1 ?? o0 ?? 0;
    const dx = (t1 - t0 - 0.4), dn = a1 - a0, l = Math.hypot(dx, dn);
    const tg: [number, number] = [(f.tangent[0] * dx + f.n[0] * dn) / l, (f.tangent[1] * dx + f.n[1] * dn) / l];
    const o = a0 - dn / dx * 0.2;   // offset extrapolated to t0
    return {origin: [f.origin[0] + f.tangent[0] * t0 + f.n[0] * o, f.origin[1] + f.tangent[1] * t0 + f.n[1] * o], tangent: tg, n: [-tg[1], tg[0]]};
  };

  // ---- close the shell where the demolished satellite tower was cut away ----
  // The 3DBAG shell is watertight; removing the cylinder leaves the end faces of its link core and the rim of the courtyard
  // terrace open. Chain those open (non-ground) edges into loops, drop open ends to the ground and fill each loop with a fan
  // facing the former tower, so the courtyard reads as terrace rim and a blank link end rather than a torn shell.
  {
    const kq = (v: number[]) => v.map(n => Math.round(n * 200)).join(',');
    const edges = new Map<string, {a: number[]; b: number[]; n: number; c: number[]}>();
    for (const g of edgeGeos) {
      const pos = g.getAttribute('position'), idx = g.getIndex()!;
      const P = (k: number) => [pos.getX(k), pos.getY(k), pos.getZ(k)];
      for (let t = 0; t < idx.count; t += 3) for (let e = 0; e < 3; e++) {
        const a = P(idx.getX(t + e)), c = P(idx.getX(t + (e + 1) % 3)), ka = kq(a), kc = kq(c);
        if (ka === kc) continue;
        const k = ka < kc ? ka + '|' + kc : kc + '|' + ka, cur = edges.get(k);
        if (cur) cur.n++; else {
          const third = P(idx.getX(t + (e + 2) % 3));
          edges.set(k, {a, b: c, n: 1, c: [(a[0] + c[0] + third[0]) / 3, (a[2] + c[2] + third[2]) / 3]});
        }
      }
    }
    // edges lying on the added west wall are closed by it (its own boundary is not a hole either)
    const onWall = (p: number[]) => p[1] >= -0.01 && p[1] <= 66.2 && WEST_POLY.some((q, i) => {
      if (i === 0) return false;
      const a = WEST_POLY[i - 1], dx = q[0] - a[0], dz = q[1] - a[1], l2 = dx * dx + dz * dz;
      const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[2] - a[1]) * dz) / l2));
      return Math.hypot(p[0] - (a[0] + t * dx), p[2] - (a[1] + t * dz)) < 0.05;
    });
    const open = [...edges.values()].filter(e => e.n === 1 && !(onWall(e.a) && onWall(e.b)) && Math.min(e.a[1], e.b[1]) < 60 && !(e.a[1] < 0.02 && e.b[1] < 0.02));
    if (process.env.DNB_DEBUG) for (const e of open) if (Math.abs(e.a[0] - 26.4) < 0.2 && Math.abs(e.a[2] - 17) < 0.2) console.log('openedge', JSON.stringify([e.a, e.b]), onWall(e.a), onWall(e.b));
    // Terrace slab edges the core left exposed (all below 7 m) get a skirt wall down to the ground, facing away from the slab:
    // the courtyard terrace is the roof of the ground storey, so its cut rim must not float over open air.
    for (const e of open) {
      if (Math.max(e.a[1], e.b[1]) >= 7 || Math.min(e.a[1], e.b[1]) < 0.5) continue;
      const a0: number[] = [e.a[0], 0, e.a[2]], b0: number[] = [e.b[0], 0, e.b[2]];
      const dx = e.b[0] - e.a[0], dz = e.b[2] - e.a[2], l = Math.hypot(dx, dz);
      if (l < 0.05) continue;
      let nx = dz / l, nz = -dx / l;
      if ((e.c[0] - e.a[0]) * nx + (e.c[1] - e.a[2]) * nz > 0) { nx = -nx; nz = -nz; }
      const g = new T.BufferGeometry();
      g.setAttribute('position', new T.Float32BufferAttribute([...e.a, ...e.b, ...b0, ...a0], 3));
      const tn = new T.Vector3(...e.b).sub(new T.Vector3(...e.a)).cross(new T.Vector3(...a0).sub(new T.Vector3(...e.a)));
      g.setIndex(tn.x * nx + tn.z * nz >= 0 ? [0, 1, 2, 0, 2, 3] : [0, 2, 1, 0, 3, 2]);
      g.computeVertexNormals();
      b.add(g, 'dark' as never);
    }
    const adj = new Map<string, typeof open>();
    for (const e of open) for (const q of [e.a, e.b]) { const k = kq(q); if (!adj.has(k)) adj.set(k, []); adj.get(k)!.push(e); }
    const used = new Set<(typeof open)[number]>();
    for (const e0 of open) {
      if (used.has(e0)) continue;
      used.add(e0);
      // walk both ways from e0 to get the whole chain
      const walk = (start: number[]) => {
        const chain: number[][] = []; let at = start;
        for (let guard = 0; guard < 500; guard++) {
          const next = (adj.get(kq(at)) ?? []).find(x => !used.has(x));
          if (!next) break;
          used.add(next); at = kq(next.a) === kq(at) ? next.b : next.a; chain.push(at);
        }
        return chain;
      };
      const fwd = walk(e0.b), back = walk(e0.a);
      let loop = [...back.reverse(), e0.a, e0.b, ...fwd];
      const closed = loop.length > 1 && kq(loop[0]) === kq(loop[loop.length - 1]);
      if (closed) loop.pop();
      else {
        if (loop[0][1] > 0.02) loop = [[loop[0][0], 0, loop[0][2]], ...loop];
        if (loop[loop.length - 1][1] > 0.02) loop.push([loop[loop.length - 1][0], 0, loop[loop.length - 1][2]]);
      }
      if (loop.length < 3) continue;
      if (process.env.DNB_DEBUG) console.log('loop', loop.length, JSON.stringify(loop.map(v => v.map(n => +n.toFixed(1)))));
      // A flat loop (the hole the core leaves in the courtyard terrace) is filled flat, facing up.
      const ys = loop.map(v => v[1]);
      if (Math.max(...ys) - Math.min(...ys) < 1.2) {
        const level = ys.reduce((s2, v) => s2 + v, 0) / ys.length;
        const pts2 = loop.map(v => new T.Vector2(v[0], v[2]));
        const tris = T.ShapeUtils.triangulateShape(pts2, []);
        const g = new T.BufferGeometry();
        g.setAttribute('position', new T.Float32BufferAttribute(pts2.flatMap(p => [p.x, level, p.y]), 3));
        g.setIndex(tris.flatMap(([a, c2, d]) => {
          const ny = (pts2[c2].x - pts2[a].x) * (pts2[d].y - pts2[a].y) - (pts2[c2].y - pts2[a].y) * (pts2[d].x - pts2[a].x);
          return ny >= 0 ? [a, d, c2] : [a, c2, d];
        }));
        g.computeVertexNormals();
        g.userData.role = 'roof';
        b.add(g, 'slate' as never);
        continue;
      }
      const c = loop.reduce((acc, v) => [acc[0] + v[0] / loop.length, acc[1] + v[1] / loop.length, acc[2] + v[2] / loop.length], [0, 0, 0]);
      const pos: number[] = [...c], index: number[] = [];
      for (const v of loop) pos.push(...v);
      for (let k = 0; k < loop.length; k++) {
        const A = new T.Vector3(...c), B = new T.Vector3(...loop[k]), C = new T.Vector3(...loop[(k + 1) % loop.length]);
        const nrm = B.clone().sub(A).cross(C.clone().sub(A));
        const toward = new T.Vector3(ROT[0] - c[0], 0, ROT[1] - c[2]);
        if (nrm.dot(toward) >= 0) index.push(0, 1 + k, 1 + (k + 1) % loop.length); else index.push(0, 1 + (k + 1) % loop.length, 1 + k);
      }
      const g = new T.BufferGeometry();
      g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
      g.setIndex(index); g.computeVertexNormals();
      b.add(g, 'brick' as never);
    }
  }

  // ---- podium: four outer faces on the BAG ring ----
  const EDGES = [{name: 'W', i: 0}, {name: 'S', i: 1}, {name: 'E', i: 2}, {name: 'N', i: 3}];
  for (const {i} of EDGES) {
    const {f, len} = ringFrame(ring, i, 0);
    const nb = Math.round(len / 7.6), pitch = len / nb;
    const SEGS = Math.ceil(len / 4), sl = len / SEGS;
    for (let k = 0; k < SEGS; k++) {
      const t0 = k * sl, t1 = t0 + sl, c = sl / 2;
      const top = wallTopAt(f, (t0 + t1) / 2);
      // Ground storey: dark glazing wall; tile fascia under the first office floor.
      const gF = segFrame(f, t0, t1, 2.5);
      if (offsetAt(f, (t0 + t1) / 2, 2.5) !== null) slab(b, gF, c, 0.05, sl, 4.6, 0.12, 'dark', 0);
      const fF = segFrame(f, t0, t1, 5.2);
      if (offsetAt(f, (t0 + t1) / 2, 5.2) !== null) slab(b, fF, c, 4.7, sl, 1.2, 0.3, 'brick', 0);
      // Two ribbon-window storeys with a white spandrel between; tile fascia and a thin eave plate at the top.
      const uF = segFrame(f, t0, t1, 9);
      if (offsetAt(f, (t0 + t1) / 2, 9) === null) continue;
      const l2 = top - 2.6;
      slab(b, uF, c, 6.3, sl, 2.5, 0.22, 'glass', 0);
      slab(b, uF, c, 8.8, sl, Math.max(0.3, l2 - 8.8), 0.28, 'white', 0);
      slab(b, uF, c, l2, sl, 2.1, 0.22, 'glass', 0);
      slab(b, uF, c, top - 0.5, sl, 0.5, 0.45, 'brick', 0);
      slab(b, uF, c, top, sl, 0.28, 0.55, 'white', 0);
      // mullions
      const m0 = Math.ceil(t0 / 2.2), m1 = Math.floor((t1 - 0.01) / 2.2);
      for (let m = m0; m <= m1; m++) {
        const tm = m * 2.2;
        if (tm < 0.3 || tm > len - 0.3) continue;
        mull(b, uF, tm - t0, 6.3, 2.5, 0.26);
        mull(b, uF, tm - t0, l2, 2.1, 0.26);
      }
    }
    // Round columns and stone corbels under the fascia.
    for (let k = 0; k <= nb; k++) {
      const t = Math.min(len - 0.6, Math.max(0.6, k * pitch)), o = offsetAt(f, t, 2.5);
      if (o === null) continue;
      const g: Frame = {...f, origin: [f.origin[0] + f.n[0] * o, f.origin[1] + f.n[1] * o]};
      put(b, g, new T.CylinderGeometry(0.5, 0.5, 4.7, 10).translate(0, 2.35, 0), t, 0, 0.1, 'concrete');
      slab(b, g, t, 4.2, 0.7, 0.55, 0.5, 'stone', 0);
      const tm = t + pitch / 2;
      if (k < nb && offsetAt(f, tm, 4.5) !== null) slab(b, {...f, origin: [f.origin[0] + f.n[0] * offsetAt(f, tm, 4.5)!, f.origin[1] + f.n[1] * offsetAt(f, tm, 4.5)!]}, tm, 4.2, 0.55, 0.5, 0.45, 'stone', 0);
    }
  }

  // ---- set-back top storey and other upper walls: continuous ribbon glazing with mullions ----
  for (const w0 of wallsOf(source as never)) {
    const top = Math.max(...w0.poly.map(p => p[1]));
    if (w0.base < 12.9 || w0.base > 13.7 || top > 19 || w0.length < 6) continue;
    const w = faceOut(w0, surfaces), f = frameOf(w);
    const y0 = w.base + 0.45, h = Math.min(top - w.base, 2.2) - 0.8;
    if (h < 0.6) continue;
    slab(b, f, w.length / 2, y0, w.length - 0.8, h, 0.18, 'glass', 0);
    const n = Math.floor(w.length / 2.2);
    for (let k = 1; k < n; k++) mull(b, f, k * w.length / n, y0, h, 0.19);
  }

  // ---- tower: tile spandrels with window strips, technical storeys, roof plate ----
  const rotWall = (w: Wall) => Math.hypot(w.origin[0] + w.tangent[0] * w.length / 2 - ROT[0], w.origin[1] + w.tangent[1] * w.length / 2 - ROT[1]) < ROT[2];
  const walls = wallsOf(source as never).filter(w => w.length >= 3 && !rotWall(w) && Math.max(...w.poly.map(p => p[1])) >= 50 && w.base < 20).map(w => faceOut(w, surfaces));
  // Collinear wall pieces (3DBAG splits one face where the base or top height changes) form one face, so strips run on across seams.
  type Piece = {w: Wall; t0: number; t1: number};
  const groups: {first: Wall; pieces: Piece[]}[] = [];
  for (const w of walls.sort((p, q) => p.length - q.length).reverse()) {
    const g = groups.find(h => h.first.n[0] * w.n[0] + h.first.n[1] * w.n[1] > 0.9995 &&
      Math.abs((w.origin[0] - h.first.origin[0]) * h.first.n[0] + (w.origin[1] - h.first.origin[1]) * h.first.n[1]) < 0.5);
    const first = g?.first ?? w;
    const t0 = (w.origin[0] - first.origin[0]) * first.tangent[0] + (w.origin[1] - first.origin[1]) * first.tangent[1];
    if (g) g.pieces.push({w, t0, t1: t0 + w.length}); else groups.push({first, pieces: [{w, t0, t1: t0 + w.length}]});
  }
  for (const g of groups) {
    const G0 = Math.min(...g.pieces.map(p => p.t0)), G1 = Math.max(...g.pieces.map(p => p.t1));
    if (G1 - G0 < 6) continue;
    const a0 = G0 + 0.9, a1 = G1 - 0.9, nm = Math.max(1, Math.round((a1 - a0) / 1.3));
    for (const {w, t0, t1} of g.pieces) {
      const f = frameOf(w);   // each piece on its own wall plane, t shifted into the piece
      const top = Math.max(...w.poly.map(p => p[1]));
      const mx = w.origin[0] + w.tangent[0] * w.length / 2, mz = w.origin[1] + w.tangent[1] * w.length / 2;
      const outsideRoof = roofHeightAt(surfaces, mx + w.n[0] * 1.2, mz + w.n[1] * 1.2) ?? 0;
      const s0 = Math.max(t0, a0) - t0, s1 = Math.min(t1, a1) - t0;
      if (s1 - s0 > 0.5) {
        const strips: [number, number][] = [];
        for (let k = 0; k < STRIPS; k++) strips.push([STRIP0 + PITCH * k, 1.25]);
        strips.push([62.2, 0.9], [64.3, 0.8]);
        for (const [y0, h] of strips) {
          if (y0 < outsideRoof + 0.5 || y0 < w.base + 0.3 || y0 + h > top - 0.45) continue;
          slab(b, f, (s0 + s1) / 2, y0, s1 - s0, h, 0.16, 'glass', 0);
          for (let k = 0; k <= nm; k++) { const t = a0 + k * (a1 - a0) / nm - t0; if (t >= s0 - 1e-6 && t <= s1 + 1e-6) mull(b, f, t, y0, h, 0.17, 0.06); }
        }
      }
      // Roof plate: a thin pale slab overhanging the walls.
      const lo = -(t0 <= G0 + 0.01 ? 1.2 : 0), hi = w.length + (t1 >= G1 - 0.01 ? 1.2 : 0);
      slab(b, f, (lo + hi) / 2, top - 0.8, hi - lo, 0.8, 1.9, 'concrete', 0);
    }
  }
}
