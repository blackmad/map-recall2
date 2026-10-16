/**
 * DeLaMar (Marnixstraat 402 / Leidsekade 90): the 2010 DeLaMar theatre (BAG 0363100012571556, 0363100012169853) and the
 * Theater Bellevue it incorporates (BAG 0363100012169852). Every wall is drawn from the Gemeente Amsterdam panoramas
 * (CC BY 4.0), measured on the 50 px/m rectified crops listed per wall in scripts/landmarks/delamar-inventory.json:
 *
 *  - massing: the 3DBAG LoD2.2 shells of the three pands verbatim (scripts/landmarks/delamar-shell.json, from
 *    delamar-prepare.ts): the Bellevue drum on the Leidsekade, its brick fly tower and set-back storeys, the stage house
 *    under sage zinc, the DeLaMar hall rising to 22.9 m under its grey standing-seam roof, the fan-shaped auditorium;
 *  - the Bellevue drum (glazed tile base, ribbon window, dark canopy, glazed yellow brick, deep roof edge, the
 *    two-colour Theater / Bellevue sign, the oculus) round its west curve and east return; the cream block with its
 *    THEATER BELLEVUE / DE SMOESHAAN fascia and the 1880s house front with its bay window;
 *  - the fly tower's white pilaster strips and coping; the set-back storey's window row; standing seams on the zinc;
 *  - the Marnixstraat front: the glass foyer on steel fins with its canopy and DELAMAR THEATER letters, the two
 *    neo-Renaissance tower bays with turrets, the palazzo with oriels, loggia and dormers, the gabled house and the
 *    169853 house.
 *
 * Frame: x east, z south, y up (each pand's own 3DBAG ground), origin = the catalogue's surveyed anchor. Details are
 * authored in ring-edge frames of the BAG footprints (nearbar-kit: x = viewer's right, z out of the wall) and snapped to
 * the 3DBAG wall behind them.
 */
import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {planarPolygon} from './worship-shell';
import type {Surface} from './worship-shell';
import {archBand, archSlab, disc, ledgeStrip, put, ringFrame, ringSlab, roofHeightAt, segBand, setSink, slab, wallProbe} from './nearbar-kit';
import type {Frame} from './nearbar-kit';
import {raisedLettering} from './ornament-kit';
import shell from './delamar-shell.json';

type Col = 'ochre' | 'brick' | 'greyBrick' | 'sandstone' | 'stone' | 'white' | 'concrete' | 'dark' | 'frame' | 'glass' | 'bronze' | 'red' | 'gold' | 'slate' | 'copper' | 'green';
type Pand = {pand: string; footprint: number[][]; surfaces: Surface[]};
const PANDS = (shell as unknown as {pands: Pand[]}).pands;
const BELLEVUE = 0, DELAMAR = 1, H853 = 2;
const ALL: Surface[] = PANDS.flatMap(p => p.surfaces);

/** Ring edge indices (BAG footprints in delamar-shell.json, see the inventory notes). */
const E = {
  west: 1, drumCurve: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13], drum: 14, jog: 15, ret: 16, cream: 18,
  glass: 10, towerSE: 12, palazzo: 14, towerNW: 16, gable: 17, h853: 0,
};

// ------------------------------------------------------------------ surface classification
const centroid = (s: Surface) => { const r = s.rings[0]; return r.reduce((a, p) => [a[0] + p[0] / r.length, a[1] + p[1] / r.length, a[2] + p[2] / r.length], [0, 0, 0]); };
const yRange = (s: Surface) => { const ys = s.rings[0].map(p => p[1]); return [Math.min(...ys), Math.max(...ys)]; };
function newell(r: number[][]) {
  let nx = 0, ny = 0, nz = 0;
  for (let i = 0; i < r.length; i++) { const a = r[i], c = r[(i + 1) % r.length]; nx += (a[1] - c[1]) * (a[2] + c[2]); ny += (a[2] - c[2]) * (a[0] + c[0]); nz += (a[0] - c[0]) * (a[1] + c[1]); }
  const l = Math.hypot(nx, ny, nz) || 1;
  return [nx / l, ny / l, nz / l];
}
/** Distance from (x, z) to ring edge i of pand k. */
function edgeDist(k: number, i: number, x: number, z: number) {
  const r = PANDS[k].footprint, a = r[i], c = r[(i + 1) % r.length], dx = c[0] - a[0], dz = c[1] - a[1], L = dx * dx + dz * dz;
  const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / L));
  return Math.hypot(x - a[0] - t * dx, z - a[1] - t * dz);
}
const nearEdge = (k: number, edges: number[], s: Surface, tol = 0.6) => { const [x, , z] = centroid(s); return edges.some(i => edgeDist(k, i, x, z) < tol); };

function wallColour(k: number, s: Surface): Col {
  const [x, , z] = centroid(s), [y0, y1] = yRange(s);
  if (k === BELLEVUE) {
    if (x > 8.5 && y1 > 12 && nearEdge(k, [E.cream], s, 0.6)) return 'brick';             // the 1880s house kept in the pand (front only; its sides are party walls)
    if (nearEdge(k, [E.cream], s) && x < 8.8) return 'stone';                             // cream block
    if (nearEdge(k, [E.west], s) && y1 < 9.5) return 'greyBrick';                         // west two-storey block
    if (y1 < 9.5 && nearEdge(k, [...E.drumCurve, E.drum, E.jog, E.ret, 17], s, 0.9)) return 'ochre';
    if (y0 > 7.4 && y1 < 12.6) return 'concrete';                                        // set-back storeys over the drum
    return 'greyBrick';                                                                  // fly tower, stage house
  }
  if (k === DELAMAR) {
    if (nearEdge(k, [E.glass], s, 0.1) && y0 < 1) return 'glass';
    if (nearEdge(k, [E.towerSE, E.palazzo, E.towerNW, E.gable, 11, 13, 15], s, 0.8)) return 'brick';
    return 'greyBrick';
  }
  return nearEdge(k, [E.h853], s, 0.6) ? 'brick' : 'greyBrick';
}
function roofColour(k: number, s: Surface): Col {
  const n = newell(s.rings[0]);
  if (Math.abs(n[1]) > 0.985) return 'slate';                                            // flat bitumen
  return k === BELLEVUE ? 'green' : 'copper';                                            // sage zinc (Bellevue) / grey zinc (DeLaMar)
}

// ------------------------------------------------------------------ helpers in wall frames
type B = BuildingTools;
let b: B;
let probe: ReturnType<typeof wallProbe>;
const P = (g: T.BufferGeometry, f: Frame, t: number, y: number, out: number, c: Col) => put(b, f, g, t, y, out, c);
/** Frames of ring edges carry `snap`: every part placed on them moves onto the 3DBAG wall right behind its own centre
 * (the shell is faceted where BAG has one edge: the drum front, the 169853 front). */
type SnapFrame = Frame & {snap?: number};
const on = (f: SnapFrame, t: number, y: number) => (f.snap ? snapAt(f, t, y, f.snap) : f);
const sl = (f: SnapFrame, t: number, y: number, w: number, h: number, d: number, c: Col, out = 0) => slab(b, w > 3 ? f : on(f, t, y + h / 2), t, y, w, h, d, c, out);
const strip = (f: Frame, t: number, y: number, w: number, h: number, d: number, c: Col, out = 0) => ledgeStrip(b, f, t, y, w, h, d, c, out);
const shift = (f: Frame, o: number): Frame => ({...f, origin: [f.origin[0] + f.n[0] * o, f.origin[1] + f.n[1] * o]});
/** Ring-edge frame moved onto the 3DBAG wall (median of probes at the given t, y). */
/** Ring-edge frame on the shell; parts snap to the wall behind them within `tol` metres (a recessed porch is deeper). */
function edgeFrame(k: number, i: number, ys: number[] = [2, 6], tol = 0.4): {f: Frame; len: number} {
  const {f, len} = ringFrame(PANDS[k].footprint, i);
  const offs: number[] = [];
  for (const y of ys) for (const t of [0.2, 0.5, 0.8].map(u => u * len)) { const o = probe.offset(f, t, y); if (o !== null && Math.abs(o) < 0.3) offs.push(o); }
  offs.sort((a, c) => a - c);
  return {f: {...shift(f, offs.length ? offs[offs.length >> 1] : 0), snap: tol} as SnapFrame, len};
}
/**
 * Window on the wall plane (or `out` in front of it): glass 6 cm proud, a 9 cm frame ring 10 cm proud round it (no plate
 * behind the glass, so no same-facing faces 3 cm apart), glazing bars 12 cm, optional sill and lintel.
 */
function win(f: SnapFrame, ts: number[], y: number, w: number, h: number, o: {cols?: number; rows?: number; frame?: Col; sill?: Col; lintel?: Col} = {}, out = 0) {
  const fr = o.frame ?? 'white', cols = o.cols ?? 2, rows = o.rows ?? 2, k = 0.09;
  for (const t of ts) {
    const g0 = on(f, t, y + h / 2), g = out ? shift(g0, out) : g0;
    slab(b, g, t, y, w, h, 0.06, 'glass');
    slab(b, g, t, y - k, w + 2 * k, k, 0.1, fr); slab(b, g, t, y + h, w + 2 * k, k, 0.1, fr);
    slab(b, g, t - w / 2 - k / 2, y, k, h, 0.1, fr); slab(b, g, t + w / 2 + k / 2, y, k, h, 0.1, fr);
    for (let c = 1; c < cols; c++) slab(b, g, t - w / 2 + w * c / cols, y, 0.05, h, 0.12, fr);
    for (let r = 1; r < rows; r++) slab(b, g, t, y + h * r / rows - 0.025, w, 0.05, 0.12, fr);
    if (o.sill) slab(b, g, t, y - k - 0.1, w + 0.4, 0.1, 0.18, o.sill);
    if (o.lintel) slab(b, g, t, y + h + k, w + 0.36, 0.14, 0.14, o.lintel);
  }
}
function letters(f: SnapFrame, text: string, t: number, y: number, h: number, maxW: number, c: Col, out: number) {
  const L = raisedLettering({text, heightM: h, maxWidthM: maxW, depthM: 0.04});
  P(L.geometry, on(f, t, y + h / 2), t, y + L.heightM / 2, out, c);
}
/** Canted bay (oriel) in plan: front `depth` out, side chamfer `ch`, from y0 to y1. */
function bay(f: Frame, t0: number, t1: number, y0: number, y1: number, depth: number, ch: number, c: Col) {
  const s = new T.Shape([new T.Vector2(t0, 0.03), new T.Vector2(t1, 0.03), new T.Vector2(t1 - ch, -depth), new T.Vector2(t0 + ch, -depth)]);
  P(new T.ExtrudeGeometry(s, {depth: y1 - y0, bevelEnabled: false}).rotateX(-Math.PI / 2), f, 0, y0, -0.03, c);
}
/** Steep gable cap (triangle prism) centred at t, base at y. */
function gableCap(f: Frame, t: number, y: number, w: number, h: number, d: number, c: Col, out = 0) {
  const s = new T.Shape([new T.Vector2(-w / 2, 0), new T.Vector2(w / 2, 0), new T.Vector2(0, h)]);
  P(new T.ExtrudeGeometry(s, {depth: d, bevelEnabled: false}), f, t, y, out, c);
}
/** Thin rod from (t, y0, out0) to (t, y1, out1) in the wall's normal plane. */
function rod(f: Frame, t: number, y0: number, out0: number, y1: number, out1: number, r: number, c: Col) {
  const len = Math.hypot(y1 - y0, out1 - out0), g = new T.BoxGeometry(r, len, r).translate(0, len / 2, 0);
  g.rotateX(Math.atan2(out1 - out0, y1 - y0));
  P(g, f, t, y0, out0, c);
}

// ------------------------------------------------------------------ shell
function addShellSurfaces() {
  const geoms: T.BufferGeometry[] = [];
  PANDS.forEach((p, k) => p.surfaces.forEach(s => {
    if (s.type === 'GroundSurface') return;
    const g = planarPolygon(s.rings);
    if (!g) return;
    if (s.type === 'RoofSurface') {
      const pos = g.getAttribute('position'), idx = g.getIndex()!, A = new T.Vector3(), Bv = new T.Vector3(), C = new T.Vector3();
      for (let q = 0; q < idx.count; q += 3) {
        A.fromBufferAttribute(pos, idx.getX(q)); Bv.fromBufferAttribute(pos, idx.getX(q + 1)); C.fromBufferAttribute(pos, idx.getX(q + 2));
        if (Bv.sub(A).cross(C.sub(A)).y < 0) { const t = idx.getX(q + 1); idx.setX(q + 1, idx.getX(q + 2)); idx.setX(q + 2, t); }
      }
      g.computeVertexNormals();
    }
    geoms.push(g.clone());
    b.add(g, (s.type === 'RoofSurface' ? roofColour(k, s) : wallColour(k, s)) as never);
  }));
  return geoms;
}

/** Standing seams down every sloped zinc roof: 4 cm ribs at 0.6 m, clipped to the roof polygon. */
function standingSeams() {
  PANDS.forEach((p, k) => p.surfaces.forEach(s => {
    if (s.type !== 'RoofSurface') return;
    const r = s.rings[0], n = new T.Vector3(...newell(r));
    if (n.y < 0) n.negate();
    if (n.y > 0.985 || n.y < 0.3) return;
    const H = new T.Vector3(0, 1, 0).cross(n).normalize(), S = n.clone().cross(H).normalize(), o = new T.Vector3(...r[0]);
    const uv = r.map(q => { const v = new T.Vector3(...q).sub(o); return [v.dot(H), v.dot(S)]; });
    const us = uv.map(q => q[0]), u0 = Math.min(...us), u1 = Math.max(...us);
    if ((u1 - u0) * (Math.max(...uv.map(q => q[1])) - Math.min(...uv.map(q => q[1]))) < 12) return;
    for (let u = u0 + 0.45; u < u1 - 0.3; u += 0.6) {
      const hits: number[] = [];
      for (let i = 0; i < uv.length; i++) {
        const a = uv[i], c = uv[(i + 1) % uv.length];
        if ((a[0] - u) * (c[0] - u) < 0) hits.push(a[1] + (u - a[0]) / (c[0] - a[0]) * (c[1] - a[1]));
      }
      hits.sort((x, y) => x - y);
      for (let j = 0; j + 1 < hits.length; j += 2) {
        const v0 = hits[j] + 0.15, v1 = hits[j + 1] - 0.15;
        if (v1 - v0 < 0.8) continue;
        // a ridge of two sloped strips (no hidden underside): half-width 3 cm, 4 cm high, along S
        const P0 = o.clone().addScaledVector(H, u).addScaledVector(n, 0.005), q = (du: number, dn: number, v: number) => P0.clone().addScaledVector(H, du).addScaledVector(n, dn).addScaledVector(S, v);
        const L0 = q(-0.03, 0, v0), L1 = q(-0.03, 0, v1), R0 = q(0.03, 0, v0), R1 = q(0.03, 0, v1), T0 = q(0, 0.04, v0), T1 = q(0, 0.04, v1);
        const tri: T.Vector3[] = [L0, T0, T1, L0, T1, L1, T0, R0, R1, T0, R1, T1];
        const g = new T.BufferGeometry().setAttribute('position', new T.Float32BufferAttribute(tri.flatMap(v => [v.x, v.y, v.z]), 3));
        g.computeVertexNormals();
        // face the ridge strips up (winding from the plane normal)
        const A = new T.Vector3().fromArray(g.getAttribute('position').array as Float32Array, 0), Bq = new T.Vector3().fromArray(g.getAttribute('position').array as Float32Array, 3), C = new T.Vector3().fromArray(g.getAttribute('position').array as Float32Array, 6);
        if (Bq.sub(A).cross(C.sub(A)).dot(n) < 0) { const pos = g.getAttribute('position'); for (let i = 0; i < pos.count; i += 3) { const x = pos.getX(i + 1), y = pos.getY(i + 1), z = pos.getZ(i + 1); pos.setXYZ(i + 1, pos.getX(i + 2), pos.getY(i + 2), pos.getZ(i + 2)); pos.setXYZ(i + 2, x, y, z); } g.computeVertexNormals(); }
        b.add(g, (k === BELLEVUE ? 'green' : 'copper') as never);
      }
    }
  }));
}

type WallFrame = {s: Surface; f: Frame; len: number; low: number; top: number};
/** Frame of every vertical 3DBAG wall of pand k (origin its left end on its plane) and the roof height outside it. */
function wallFrames(k: number, minLen = 1.5): WallFrame[] {
  const out: WallFrame[] = [];
  for (const s of PANDS[k].surfaces) {
    if (s.type !== 'WallSurface') continue;
    const r = s.rings[0], n = newell(r), hl = Math.hypot(n[0], n[2]);
    if (hl < 0.9) continue;
    const nx = n[0] / hl, nz = n[2] / hl, right: [number, number] = [nz, -nx];
    const ts = r.map(q => q[0] * right[0] + q[2] * right[1]), t0 = Math.min(...ts), t1 = Math.max(...ts), len = t1 - t0;
    if (len < minLen) continue;
    const [, top] = yRange(s), c = centroid(s), dc = c[0] * nx + c[2] * nz;
    const f: Frame = {origin: [right[0] * t0 + nx * dc, right[1] * t0 + nz * dc], tangent: right, n: [nx, nz]};
    let low = 0;
    for (const u of [0.25, 0.5, 0.75]) {
      const px = f.origin[0] + right[0] * len * u + nx * 0.6, pz = f.origin[1] + right[1] * len * u + nz * 0.6;
      low = Math.max(low, roofHeightAt(ALL, px, pz) ?? 0);
    }
    out.push({s, f, len, low, top});
  }
  return out;
}
/** Exposed upper walls passing `test` (the roof height outside each wall is `low`). */
const exposedFrames = (k: number, test: (s: Surface, f: Frame, len: number, low: number, top: number) => boolean) =>
  wallFrames(k).filter(w => test(w.s, w.f, w.len, w.low, w.top));
/** Frame f moved onto the shell wall right behind (t, y). */
function snapAt(f: Frame, t: number, y: number, tol = 0.4): Frame {
  const o = probe.offset(f, t, y);
  return o !== null && Math.abs(o) < tol ? shift(f, o) : f;
}

// ------------------------------------------------------------------ Bellevue
function bellevueDrum() {
  // bands on every 3DBAG facet of the drum (the front is faceted, the west corner a 12-facet curve)
  for (const w of wallFrames(BELLEVUE, 0.3)) {
    if (wallColour(BELLEVUE, w.s) !== 'ochre') continue;
    const f = w.f, c = w.len / 2, wd = w.len + 0.08, side = nearEdge(BELLEVUE, [E.ret, 17], w.s, 0.4);
    if (!side) {
      sl(f, c, 0, wd, 2.8, 0.06, 'bronze');                                                  // glazed tile base
      for (let y = 0.3; y < 2.75; y += 0.3) strip(f, c, y, wd, 0.02, 0.1, 'dark');          // tile courses
      sl(f, c, 2.8, wd, 0.15, 0.14, 'dark');                                                  // sill
      sl(f, c, 4.4, wd, 0.15, 0.1, 'dark');                                                   // head rail
      sl(f, c, 2.95, wd, 1.45, 0.04, nearEdge(BELLEVUE, [E.jog], w.s, 0.3) ? 'brick' : 'glass'); // ribbon glazing (red pier on the jog)
      sl(f, c, 4.55, wd + 0.1, 0.25, 0.4, 'dark');                                            // canopy
      if (w.len < 1.6) sl(f, 0.05, 2.95, 0.09, 1.45, 0.1, 'dark');                            // a mullion at each curve facet joint
    } else sl(f, c, 0, wd, 0.45, 0.06, 'bronze');                                             // low plinth on the return
    if (w.top > 8.3) sl(f, c, 8.24, wd + 0.1, Math.min(0.64, w.top - 8.2), 0.5, 'dark');      // deep roof edge
  }
  // straight front: measured mullions (wide 1.65 / narrow 0.65 rhythm), red pier, sign, poster cases
  const {f} = ringFrame(PANDS[BELLEVUE].footprint, E.drum);
  for (const t of [0.3, 1.9, 2.56, 4.2, 4.8, 6.5, 7.16, 8.84, 9.4, 11.1, 11.76]) sl(snapAt(f, t, 3.6), t, 2.95, 0.09, 1.45, 0.1, 'dark');
  sl(snapAt(f, 13.7, 3.6), 13.7, 2.95, 0.52, 1.45, 0.08, 'brick');
  const g = snapAt(f, 5.54, 6.9);
  sl(g, 5.54, 6.2, 2.52, 0.67, 0.14, 'red');
  sl(g, 5.54, 6.87, 2.52, 0.67, 0.14, 'gold');
  letters(g, 'THEATER', 5.54, 7.0, 0.36, 2.0, 'white', 0.14);
  letters(g, 'BELLEVUE', 5.54, 6.33, 0.36, 2.1, 'white', 0.14);
  for (const t of [2.15, 9.2, 11.4]) { const h = snapAt(f, t, 1.6); sl(h, t, 1.15, 0.95, 1.2, 0.1, 'dark'); sl(h, t, 1.22, 0.8, 1.06, 0.06, 'red', 0.1); }
  // east return: oculus and the grey-framed side door
  const r = edgeFrame(BELLEVUE, E.ret, [1.5, 6]).f;
  ringSlab(b, r, 2.8, 6.4, 0.62, 0.78, 0.12, 'white');
  disc(b, r, 2.8, 6.4, 0.63, 0.05, 'glass');
  sl(r, 2.8, 5.8, 0.06, 1.2, 0.09, 'white'); sl(r, 2.8, 6.37, 1.24, 0.06, 0.09, 'white');
  sl(r, 4.4, 0, 1.9, 2.55, 0.1, 'concrete'); sl(r, 4.4, 0.05, 1.5, 2.35, 0.05, 'red', 0.1);
}

function bellevueLeidsekade() {
  // current state (2025, recording_2025-07-03_10-58-37_00042): pale grey glazed brick on the block and the house's
  // two lower storeys, big white "Theater Bellevue" letters over a white canopy band, porthole, revolving door
  const {f} = edgeFrame(BELLEVUE, E.cream, [1.5, 6]);
  sl(f, 10.4, 0, 6.9, 5.3, 0.05, 'stone');                                                     // grey lower storeys of the house
  sl(f, 7.0, 2.85, 13.95, 0.32, 0.55, 'white');                                               // white canopy band
  letters(f, 'THEATER BELLEVUE', 4.1, 3.3, 0.62, 7.0, 'white', 0.06);
  letters(f, 'DE SMOESHAAN', 12.6, 2.5, 0.16, 1.4, 'white', 0.06);
  sl(f, 12.6, 2.45, 1.6, 0.26, 0.09, 'dark');
  ringSlab(b, f, 0.8, 1.95, 0.34, 0.45, 0.12, 'white'); disc(b, f, 0.8, 1.95, 0.35, 0.05, 'glass');
  sl(f, 3.5, 0, 2.9, 2.85, 0.12, 'glass');                                                    // revolving-door entrance
  for (const t of [2.1, 3.5, 4.9]) sl(f, t, 0, 0.1, 2.85, 0.17, 'dark');
  P(new T.CylinderGeometry(0.95, 0.95, 2.5, 12, 1, true, 0, Math.PI), f, 3.5, 1.25, 0.05, 'dark');
  sl(f, 10.0, 0, 2.4, 2.85, 0.12, 'glass');                                                   // cafe doors
  for (const t of [1.9, 5.1, 8.7, 11.3]) sl(f, t, 0, 0.3, 2.85, 0.18, 'white');
  win(f, [3.55], 4.7, 2.9, 1.6, {cols: 3, rows: 2});
  sl(f, 3.55, 6.3, 3.2, 0.3, 0.45, 'stone');
  sl(f, 3.45, 7.85, 6.95, 0.2, 0.12, 'white');
  // the 1880s house
  win(f, [7.78, 9.62, 11.07, 12.78], 3.9, 0.75, 0.94, {cols: 2, rows: 1}, 0.05);
  bay(f, 9.1, 11.8, 5.3, 8.3, 0.75, 0.35, 'stone');
  sl(f, 10.45, 6.5, 1.9, 1.7, 0.05, 'glass', 0.75);
  for (const t of [9.85, 10.45, 11.05]) sl(f, t, 6.5, 0.07, 1.7, 0.06, 'white', 0.8);
  sl(f, 10.45, 8.3, 2.9, 0.22, 0.95, 'white');
  win(f, [7.85], 6.5, 0.75, 1.8); win(f, [12.9], 6.5, 1.2, 1.8);
  sl(f, 10.45, 9.3, 2.8, 0.18, 0.75, 'white');                                               // balcony slab
  for (let t = 9.15; t <= 11.8; t += 0.18) sl(f, t, 9.48, 0.03, 0.85, 0.03, 'dark', 0.7);
  sl(f, 10.45, 10.3, 2.8, 0.05, 0.05, 'dark', 0.7);
  for (const y of [10.0, 12.7]) { win(f, [7.85], y, 0.75, 1.8); win(f, [10.45], y, 1.3, 1.8); win(f, [12.9], y, 1.2, 1.8); }
  for (const y of [9.3, 12.2]) strip(f, 11.3, y, 4.8, 0.16, 0.1, 'white');
  for (const y of [5.3]) strip(f, 10.4, y, 6.9, 0.16, 0.1, 'white');
  sl(f, 10.4, 15.5, 6.9, 0.45, 0.4, 'white');                                                 // cornice
}

function bellevueWest() {
  const {f, len} = edgeFrame(BELLEVUE, E.west, [1.5, 6]);
  strip(f, len / 2, 4.6, len, 0.2, 0.14, 'white');
  sl(f, len / 2, 8.1, len + 0.05, 0.22, 0.1, 'white');
  sl(f, 3.0, 0, 1.2, 2.3, 0.07, 'dark');
}

function bellevueUpper() {
  // fly tower: white strips (about 3.3 m pitch, corners included) and coping on every exposed face over 15 m
  for (const w of exposedFrames(BELLEVUE, (s, _f, len, low, top) => top > 16.8 && top < 18 && top - low > 2.5 && len > 2 && centroid(s)[0] < 0)) {
    const n = Math.max(1, Math.round(w.len / 3.3));
    for (let i = 0; i <= n; i++) sl(w.f, Math.min(w.len - 0.5, Math.max(0.5, w.len * i / n)), w.low, 0.35, w.top - 0.4 - w.low, 0.08, 'white');
    sl(w.f, w.len / 2, w.top - 0.34, w.len, 0.4, 0.12, 'white');                          // coping stands 6 cm over the roof, never on its plane
  }
  // set-back storeys over the drum: window row on the south-facing ones
  for (const w of exposedFrames(BELLEVUE, (s, f, len, low, top) => { const [y0, y1] = yRange(s); return y0 > 7.4 && y1 < 12.6 && len > 3 && top - low > 1.6 && f.n[1] > 0.5; })) {
    const k = Math.floor((w.len - 0.6) / 2.2), ts: number[] = [];
    for (let i = 0; i < k; i++) ts.push((w.len - (k - 1) * 2.2) / 2 + i * 2.2);
    win(w.f, ts, w.low + 0.45, 1.3, Math.min(1.3, w.top - w.low - 0.8), {cols: 2, rows: 1});
  }
}

// ------------------------------------------------------------------ Marnixstraat
function glassFoyer() {
  const {f, len} = edgeFrame(DELAMAR, E.glass, [2, 8]);
  const gw = 17.8, top = 15.5;
  for (const t of [0.12, 1.5, 3.1, 4.74, 6.36, 8.0, 9.6, 11.2, 12.8, 14.4, 16.0, 17.64]) sl(f, t, 0, 0.1, top, 0.42, 'frame');
  for (const y of [2.6, 5.6, 8.7, 11.9]) sl(f, gw / 2, y, gw, 0.08, 0.12, 'frame');
  sl(f, gw / 2, top, gw, 0.25, 0.3, 'frame');
  sl(f, gw / 2, 3.7, gw, 0.3, 0.06, 'red');                                                  // red band seen through the glass
  sl(f, 14.8, 5.9, 0.6, 7.2, 0.05, 'red');                                                   // vertical show banner
  for (const t of [2.3, 3.9, 5.55, 7.2, 10.4, 12.0, 13.6]) sl(f, t, 0, 0.06, 2.6, 0.08, 'dark');  // door frames
  // canopy, its steel edge and tie rods from the fins
  sl(f, 8.9, 4.5, 17.4, 0.08, 1.95, 'glass');
  sl(f, 8.9, 4.42, 17.4, 0.2, 0.08, 'frame', 1.95);
  for (const t of [1.5, 4.74, 8.0, 11.2, 14.4, 17.64]) rod(f, t, 6.9, 0.3, 4.6, 1.9, 0.04, 'copper');                                  // steel tie rods (zinc-grey paint slot: not glazing)
  letters(f, 'DELAMAR', 7.1, 4.6, 0.8, 5.0, 'gold', 0.6);
  letters(f, 'THEATER', 11.1, 4.6, 0.55, 3.1, 'gold', 0.6);
  // brick pier and chimney at the north-west end
  sl(f, (gw + len) / 2, 0, len - gw + 0.02, 16.5, 0.05, 'brick');
  sl(f, len - 0.6, 16.5, 0.9, 1.2, 0.9, 'brick', -0.95);
}

function towerBay(i: number) {
  const {f, len} = edgeFrame(DELAMAR, i, [2, 8]), c = len / 2;
  sl(f, c, 0, len - 0.2, 0.6, 0.08, 'concrete');
  sl(f, c, 0.6, len - 0.2, 5.8, 0.05, 'sandstone');
  for (const s of [-1, 1]) sl(f, c + s * 0.95, 0.6, 0.25, 3.2, 0.18, 'sandstone');
  sl(f, c, 0.2, 1.6, 2.8, 0.08, 'dark', 0.05); sl(f, c, 3.05, 1.6, 0.55, 0.06, 'glass', 0.05); sl(f, c, 3.0, 1.75, 0.08, 0.1, 'dark', 0.05);
  for (const s of [-1, 1]) { sl(f, c + s * 1.3, 2.3, 0.22, 0.35, 0.25, 'dark'); sl(f, c + s * 1.3, 2.36, 0.16, 0.24, 0.02, 'gold', 0.25); }
  win({...f, snap: undefined} as SnapFrame, [c - 0.4, c + 0.4], 4.2, 0.62, 1.4, {cols: 1, rows: 2}, 0.05);   // one plane: the pair shares a mullion
  sl(f, c, 5.75, len - 0.2, 0.5, 0.3, 'sandstone');
  for (let y = 6.9; y < 14; y += 0.6) strip(f, c, y, len - 0.2, 0.12, 0.04, 'sandstone');
  // round balcony on a corbel
  sl(f, c, 6.1, 0.9, 0.5, 0.45, 'sandstone');
  P(new T.CylinderGeometry(0.75, 0.75, 0.15, 12, 1, false, -Math.PI / 2, Math.PI), f, c, 6.675, 0, 'sandstone');
  P(new T.CylinderGeometry(0.74, 0.74, 0.85, 12, 1, true, -Math.PI / 2, Math.PI), f, c, 7.175, 0, 'dark');
  win(f, [c], 7.3, 1.2, 2.2, {cols: 2, rows: 2}, 0.1);
  segBand(b, f, c, 9.55, 1.6, 0.35, 0.22, 0.12, 'sandstone');
  win(f, [c], 11.2, 1.2, 2.2, {cols: 2, rows: 2}, 0.1);
  sl(f, c, 11.2, 1.3, 0.05, 0.05, 'dark', 0.25); sl(f, c, 12.05, 1.3, 0.05, 0.05, 'dark', 0.25);
  for (let t = c - 0.55; t <= c + 0.56; t += 0.1375) sl(f, t, 11.2, 0.03, 0.9, 0.03, 'dark', 0.25);
  sl(f, c, 14.1, len - 0.2, 0.35, 0.4, 'sandstone');
  for (const s of [-1, 1]) sl(f, c + s * 0.6, 14.45, 0.3, 1.0, 0.3, 'sandstone');
  sl(f, c, 15.45, len - 0.2, 0.3, 0.45, 'sandstone');
  // turret: brick box, round-arched window, sandstone cap, slate pyramid, iron finial
  sl(f, c, 15.75, 1.6, 1.75, 1.4, 'brick', -1.2);
  archSlab(b, f, c, 15.95, 0.7, 1.15, 0.05, 'glass', 0.2);
  archBand(b, f, c, 15.9, 0.82, 1.21, 0.07, 0.08, 'white', 0.2);
  sl(f, c, 17.5, 1.8, 0.15, 1.55, 'sandstone', -1.25);
  P(new T.ConeGeometry(1.2, 0.95, 4, 1).rotateY(Math.PI / 4), f, c, 17.65 + 0.475, -0.45, 'slate');
  P(new T.CylinderGeometry(0.04, 0.04, 1.5, 6), f, c, 18.6 + 0.75, -0.45, 'dark');
}

function palazzo() {
  const {f, len} = edgeFrame(DELAMAR, E.palazzo, [2, 8]);
  sl(f, len / 2, 0, len - 0.2, 0.7, 0.2, 'concrete');
  sl(f, len / 2, 0.7, len - 0.2, 5.3, 0.05, 'sandstone');
  for (let y = 6.6; y < 13.6; y += 0.6) strip(f, len / 2, y, len - 0.2, 0.12, 0.04, 'sandstone');
  sl(f, len / 2, 15.2, len - 0.2, 1.4, 0.06, 'slate');                                              // mansard face above the cornice
  // corner oriels
  for (const [t0, t1] of [[0.1, 2.2], [10.15, 12.25]]) {
    bay(f, t0, t1, 3.6, 12.4, 0.55, 0.35, 'brick');
    sl(f, (t0 + t1) / 2, 3.2, t1 - t0, 0.4, 0.6, 'sandstone');
    sl(f, (t0 + t1) / 2, 12.4, t1 - t0 + 0.1, 0.3, 0.65, 'sandstone');
    P(new T.ConeGeometry((t1 - t0) * 0.42, 0.9, 4, 1).rotateY(Math.PI / 4), f, (t0 + t1) / 2, 12.7 + 0.45, 0.25, 'slate');
    for (const y of [4.6, 7.0, 9.6]) win(f, [(t0 + t1) / 2], y, 0.8, 1.6, {cols: 2, rows: 2}, 0.55);
  }
  // ground storey: two-tier windows, door with aedicule, arched light and pediment
  for (const t of [3.63, 8.68]) { win(f, [t], 0.5, 1.46, 2.7, {cols: 2, rows: 2}, 0.05); win(f, [t], 3.6, 1.46, 1.4, {cols: 2, rows: 1}, 0.05); }
  sl(f, 6.18, 0.2, 1.64, 3.0, 0.08, 'dark', 0.05);
  for (const t of [5.18, 7.18]) sl(f, t, 0.2, 0.36, 5.6, 0.24, 'sandstone');
  archSlab(b, f, 6.2, 3.9, 0.6, 1.1, 0.06, 'glass', 0.05);
  gableCap(f, 6.18, 5.8, 2.3, 0.6, 0.25, 'sandstone');
  // first storey: four windows with balconettes and stone lintels
  for (const t of [3.4, 5.17, 7.16, 8.9]) {
    win(f, [t], 6.5, 1.0, 2.4, {cols: 2, rows: 2}, 0.1);
    sl(f, t, 6.5, 1.25, 0.7, 0.04, 'dark', 0.3); sl(f, t, 9.0, 1.3, 0.25, 0.12, 'sandstone');
  }
  // loggia: corbels, balcony slab, railing, arched windows
  for (const t of [3.0, 4.6, 6.2, 7.8, 9.4]) sl(f, t, 10.4, 0.3, 0.8, 0.7, 'sandstone');
  sl(f, 6.15, 11.2, 7.9, 0.25, 0.8, 'sandstone');
  sl(f, 6.15, 12.3, 7.9, 0.06, 0.05, 'dark', 0.72);
  for (let t = 2.3; t <= 10.0; t += 0.32) sl(f, t, 11.45, 0.03, 0.85, 0.03, 'dark', 0.72);
  for (const t of [3.3, 5.05, 7.1, 8.9]) { archSlab(b, f, t, 11.4, 0.95, 1.6, 0.05, 'glass', 0.06); archBand(b, f, t, 11.35, 1.1, 1.68, 0.08, 0.08, 'white', 0.06); }
  // cornice with corbel table
  sl(f, len / 2, 13.8, len - 0.2, 0.3, 0.35, 'sandstone');
  for (let t = 0.4; t < len - 0.2; t += 0.5) sl(f, t, 14.1, 0.12, 0.25, 0.3, 'sandstone');
  sl(f, len / 2, 14.35, len - 0.2, 0.4, 0.55, 'sandstone');
  // two pointed dormers
  for (const t of [4.05, 8.11]) {
    sl(f, t, 14.75, 1.7, 1.8, 1.3, 'concrete', -0.4);
    sl(f, t, 15.0, 1.0, 1.3, 0.05, 'glass', 0.9);
    gableCap(f, t, 16.55, 1.85, 1.25, 1.4, 'concrete', -0.45);
    P(new T.CylinderGeometry(0.035, 0.035, 0.6, 6), f, t, 17.8 + 0.3, 0.6, 'dark');
  }
}

function gableHouse() {
  const {f, len} = edgeFrame(DELAMAR, E.gable, [2, 8], 0.01), c = len / 2;
  sl(f, c, 0.05, len - 0.9, 3.4, 0.06, 'glass');
  for (const t of [0.3, 1.9, 3.64, len - 0.3]) sl(f, t, 0, 0.3, 3.7, 0.15, 'sandstone');
  sl(f, c, 3.45, len, 0.35, 0.22, 'dark');
  sl(f, c, 3.9, len - 0.7, 2.2, 0.05, 'glass');
  for (const t of [c - 0.9, c + 0.9]) sl(f, t, 3.9, 0.1, 2.2, 0.12, 'white');
  segBand(b, f, c, 5.6, len - 0.5, 0.75, 0.3, 0.1, 'white');
  for (const y of [6.5, 9.05, 11.25, 13.75, 14.3]) strip(f, c, y, len - 0.3, 0.2, 0.04, 'white');   // white bands between the window rows
  bay(f, c - 0.95, c + 0.95, 6.9, 11.1, 0.5, 0.3, 'white');
  for (const y of [7.2, 9.3]) sl(f, c, y, 1.25, 1.6, 0.05, 'glass', 0.5);
  sl(f, c, 11.1, 2.0, 0.2, 0.6, 'white');
  for (const y of [7.3, 9.4]) win(f, [0.95, len - 0.95], y, 0.8, 1.5, {cols: 1, rows: 2});
  win(f, [0.95, c, len - 0.95], 11.6, 0.85, 1.9, {cols: 2, rows: 2});
  sl(f, c, 11.6, 1.1, 0.8, 0.04, 'dark', 0.25);
  win(f, [0.95, len - 0.95], 15.6, 0.6, 1.2, {cols: 1, rows: 2});
  archSlab(b, f, c, 15.5, 1.0, 2.0, 0.05, 'glass', 0.03); archBand(b, f, c, 15.45, 1.16, 2.08, 0.08, 0.08, 'white', 0.03);
  for (const y of [14.9, 17.7]) strip(f, c, y, len - 0.3, 0.22, 0.08, 'white');
}

function house853() {
  const {f, len} = edgeFrame(H853, E.h853, [2, 8], 0.95);                                  // the door bay is a 0.8 m deep porch
  sl(f, 1.45, 0.2, 0.9, 3.2, 0.07, 'dark');
  archSlab(b, f, 1.45, 2.6, 0.4, 0.75, 0.03, 'gold', 0.07);
  win(f, [3.1, 4.8], 2.6, 1.0, 2.0, {cols: 2, rows: 2, lintel: 'white'});
  for (const y of [5.8, 9.0, 12.2]) win(f, [1.4, 3.1, 4.8], y, 1.0, 2.0, {cols: 2, rows: 2, lintel: 'white'});
  for (const y of [5.8, 9.0]) { sl(f, 3.1, y - 0.15, 1.5, 0.15, 0.5, 'concrete'); sl(f, 3.1, y, 1.3, 0.8, 0.04, 'dark', 0.45); }
  for (const y of [4.95, 8.2, 11.4]) strip(f, len / 2, y, len, 0.2, 0.06, 'white');
  sl(f, len / 2, 15.6, len, 0.8, 0.4, 'white');
  sl(f, len / 2, 16.4, len, 1.6, 0.05, 'slate');
  for (const t of [1.4, 4.4]) { sl(f, t, 16.4, 1.2, 1.4, 0.8, 'white', -0.2); sl(f, t, 16.6, 0.7, 0.95, 0.05, 'glass', 0.6); }
}

/** Height of a wall's top edge when it is level (within 0.25 m), else null (a raking top under a sloped roof). */
function flatTop(s: Surface): number | null {
  const ys = s.rings[0].map(p => p[1]), top = Math.max(...ys), edge = ys.filter(y => y > top - 2);
  return top - Math.min(...edge) < 0.25 ? Math.min(...edge) : null;
}
function auditoriumParapet() {
  for (const w of exposedFrames(DELAMAR, (s, f, len, low, top) => top > 13 && top < 16.8 && top - low > 2 && len > 1 && centroid(s)[0] < 2 && f.n[0] < -0.3))
    if (flatTop(w.s) !== null) sl(w.f, w.len / 2, flatTop(w.s)! - 0.3, w.len - 0.02, 0.38, 0.1, 'white');
}

export function buildDelamar(_w: number, _d: number, tools: BuildingTools & {mark?: (n: string) => void}) {
  b = tools;
  const geoms = addShellSurfaces();
  probe = wallProbe(geoms);
  tools.mark?.('shell');
  setSink(0.03, true);
  standingSeams();
  bellevueDrum();
  bellevueLeidsekade();
  bellevueWest();
  bellevueUpper();
  glassFoyer();
  towerBay(E.towerSE);
  towerBay(E.towerNW);
  palazzo();
  gableHouse();
  house853();
  auditoriumParapet();
  setSink(0);
}
