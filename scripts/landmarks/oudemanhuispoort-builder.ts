import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {lodSurfaces, type LodSurface} from './civic-kit';
import {disc, poly, put, segBand, slab, type Frame} from './nearbar-kit';
import {addBaysClean} from './clean-bays';
import type {Wall} from './worship-walls';
import source from './oudemanhuispoort-footprints.json';

/**
 * Oudemanhuispoort, Oudezijds Achterburgwal end: the sandstone gate framed between the two houses that hold its piers.
 *
 * BAG: the portal has no pand of its own. Its south pier is the 1.1 x 1.0 m jog at the north-west corner of Oudezijds
 * Achterburgwal 229 (pand 0363100012180206, 1775) and its north pier is the ragged south-west corner of Oudemanhuispoort 1A
 * (pand 0363100012179854, 1550, the white-fronted barber's house). Between them the 2.0 m gate opening leads into an open-air alley
 * (no pand over it) that runs east to the covered book-market passage in the university complex (pand 0363100012171179).
 *
 * The model therefore draws all three: no. 229 (3DBAG LoD2.2 envelope with the pier jog cut back to the portal height, hipped
 * pantile roof with a dormer, three window axes with the door and stoop on the south axis), no. 1A (3DBAG LoD2.2 envelope, three
 * axes, shop ground floor), and the portal between them (rusticated piers, free-standing columns, entablature with dentils,
 * segmental pediment with cartouche, two urns, open gate leaves), so the gate is never a free-standing screen.
 * Photo heights: winter panorama b_20250108_1349_Track16_Sphere_00088 from across the canal, scaled to the 3DBAG eaves.
 */

type P2 = [number, number];
const H229 = source.pands.find(p => p.bagId === '0363100012180206')!;
const H1A = source.pands.find(p => p.bagId === '0363100012179854')!;

/** Wall frame from p to q, p being the left end seen from outside (nearbar-kit convention: tangent p->q, normal out). */
function frame(p: P2, q: P2, top: number | [number, number]): {f: Frame; wall: Wall} {
  const dx = q[0] - p[0], dz = q[1] - p[1], len = Math.hypot(dx, dz);
  const tangent: P2 = [dx / len, dz / len], n: P2 = [-tangent[1], tangent[0]];
  const [h0, h1] = typeof top === 'number' ? [top, top] : top;
  return {f: {origin: p, tangent, n}, wall: {n, origin: p, tangent, length: len, base: 0, index: 0, poly: [[0, 0], [len, 0], [len, h1], [0, h0]]}};
}
/** LoD surfaces in the 3DBAG convention (local x east, y up, z south; walls run with the building on their left). */
const wallSurf = (p: P2, q: P2, hp: number, hq: number): LodSurface => ({type: 'WallSurface', rings: [[[p[0], hp, p[1]], [p[0], 0, p[1]], [q[0], 0, q[1]], [q[0], hq, q[1]]]]});
const roofSurf = (pts: [number, number, number][]): LodSurface => ({type: 'RoofSurface', rings: [pts.map(([x, y, z]) => [x, y, z])]});

export function buildOudemanhuispoort(_w: number, _d: number, b: BuildingTools) {
  const S = 0.04;
  // ======================= No. 229: envelope ==================================================================================
  // 3DBAG ring without the pier jog (the jog is the portal's south pier, drawn below at portal height).
  const A: P2 = [-5.721, 1.996], B: P2 = [-2.894, -3.438], C: P2 = [5.415, -1.685], D: P2 = [5.51, -0.565], E: P2 = [4.962, 1.983], F: P2 = [4.487, 4.19], G: P2 = [-1.879, 2.822];
  const R1: P2 = [-0.883, 0.803]; // top of the front hip (3DBAG)
  const EAVE = 12.12, TOP = 16.9;
  const shell: LodSurface[] = [
    wallSurf(A, B, EAVE, EAVE), wallSurf(B, C, EAVE, 12.16), wallSurf(C, D, 12.16, 13.53), wallSurf(D, E, 13.53, 16.83), wallSurf(E, F, 16.83, TOP),
    wallSurf(F, G, TOP, 16.93), wallSurf(G, A, 16.93, EAVE),
    roofSurf([[A[0], EAVE, A[1]], [G[0], 16.93, G[1]], [R1[0], 16.87, R1[1]], [B[0], EAVE, B[1]]]),
    roofSurf([[B[0], EAVE, B[1]], [R1[0], 16.87, R1[1]], [E[0], 16.83, E[1]], [D[0], 13.53, D[1]], [C[0], 12.16, C[1]]]),
    roofSurf([[F[0], TOP, F[1]], [E[0], 16.83, E[1]], [R1[0], 16.87, R1[1]], [G[0], 16.93, G[1]]]),
  ];
  // The Newell orientation in lodSurfaces is calibrated on mirrored 3DBAG rings; these rings follow the same order as the 3DBAG ones.
  lodSurfaces(b, shell, ['WallSurface'], 'brick');
  lodSurfaces(b, shell, ['RoofSurface'], 'red');
  void H229;

  // ---- Canal front (photo: three axes, the door with its stoop on the south axis) ------------------------------------------
  const {f: FF, wall: FW} = frame(B, A, EAVE);
  const sl = (f: Frame, t: number, y: number, w: number, h: number, d: number, c: string, out = 0) => slab(b, f, t, y, w, h, d + S, c, out - S);
  const AX = [1.3, 3.24, 5.12], WIN = 1.36;
  const bay = (wall: Wall, at: number[], y: number, h: number, wd: number, rows: number) =>
    addBaysClean(b, wall, {at, y, h, wd, pitch: 2, cols: 2, rows, jamb: 0.1, trim: 'white', proud: 0.1, frame: 'dark', glass: 'glass'});
  bay(FW, AX.slice(0, 2), 2.1, 2.9, WIN, 4);       // bel-etage: two tall windows north of the door
  bay(FW, AX, 6.0, 2.4, WIN, 3);                    // second floor
  bay(FW, AX, 9.3, 1.6, WIN, 2);                    // top floor
  // jack arches over every window (rubbed brick, darker than the wall)
  for (const t of AX) for (const y of [8.56, 11.06]) sl(FF, t, y - 0.12, WIN + 0.5, 0.3, 0.05, 'greyBrick');
  for (const t of AX.slice(0, 2)) sl(FF, t, 5.18, WIN + 0.5, 0.32, 0.05, 'greyBrick');
  // basement lights under the two north axes, under brick relieving arches
  addBaysClean(b, FW, {at: AX.slice(0, 2), y: 0.25, h: 0.9, wd: 1.2, pitch: 2, cols: 3, rows: 1, jamb: 0.08, trim: 'white', proud: 0.08, frame: 'dark', glass: 'dark'});
  for (const t of AX.slice(0, 2)) segBand(b, FF, t, 1.3, 1.7, 0.3, 0.26, 0.05 + S, 'greyBrick', -S);
  // door: panelled black leaf, white surround, glazed transom with a lozenge bar pattern
  const tD = AX[2];
  sl(FF, tD, 1.45, 1.5, 3.75, 0.1, 'white');
  sl(FF, tD, 1.55, 1.1, 2.4, 0.13, 'dark');
  sl(FF, tD, 4.08, 1.1, 0.92, 0.12, 'glass');
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) put(b, FF, new T.BoxGeometry(0.05, 0.62, 0.05).rotateZ(sx * sy * 0.87), tD + sx * 0.25, 4.54 + sy * 0.2, 0.15, 'dark');
  sl(FF, tD, 3.95, 1.3, 0.12, 0.16, 'white');
  // stoop: landing before the door, steps descending north along the front, wrought-iron railing ('bronze', overridden near-black)
  sl(FF, tD - 0.05, 0, 1.6, 1.5, 1.25, 'stone');
  for (let k = 0; k < 6; k++) sl(FF, tD - 0.85 - k * 0.3 - 0.15, 0, 0.3, 1.5 - (k + 1) * 0.215, 1.15, 'stone');
  const rail = (t0: number, y0: number, t1: number, y1: number, out: number) => {
    const len = Math.hypot(t1 - t0, y1 - y0);
    put(b, FF, new T.BoxGeometry(len, 0.05, 0.05).rotateZ(Math.atan2(y1 - y0, t1 - t0)), (t0 + t1) / 2, (y0 + y1) / 2, out, 'bronze');
  };
  rail(tD - 0.85 - 1.8, 0.95, tD - 0.85, 2.45, 1.1); rail(tD - 0.85, 2.45, tD + 0.75, 2.45, 1.2);
  for (const t of [tD - 2.6, tD - 0.85, tD + 0.75]) put(b, FF, new T.BoxGeometry(0.07, 1.0, 0.07), t, t > tD - 1 ? 1.95 : 0.45, 1.15, 'bronze');
  // dormer on the front hip over the middle axis (photo: white-cased two-light dormer)
  {
    const t = AX[1], y0 = 12.2, h = 1.75, w = 1.5, back = 2.3, o0 = -0.45;
    sl(FF, t, y0, w, h, back, 'white', o0 - back);                               // cheeks/body
    sl(FF, t, y0 + 0.2, 1.0, 1.3, 0.06, 'glass', o0);                           // glazing
    sl(FF, t, y0 + 0.2 + 0.62, 1.0, 0.06, 0.1, 'dark', o0);
    sl(FF, t, y0 + 0.2, 0.06, 1.3, 0.1, 'dark', o0);
    const cap = new T.Shape([new T.Vector2(-w / 2 - 0.12, 0), new T.Vector2(w / 2 + 0.12, 0), new T.Vector2(0, 0.6)]);
    put(b, FF, new T.ExtrudeGeometry(cap, {depth: back + 0.15, bevelEnabled: false}), t, y0 + h, o0 - back, 'red');
  }
  // eaves cornice: white, wrapping onto the alley side
  sl(FF, FW.length / 2, 11.62, FW.length - 0.02, 0.5, 0.42, 'white');
  sl(FF, FW.length / 2, 11.45, FW.length - 0.02, 0.17, 0.26, 'white');

  // ---- Alley (north) side: photo shows two window columns on the upper floors near the front; the rest is inferred ----------
  const {f: NF, wall: NW} = frame(C, B, [12.16, EAVE]);
  const NAX = [NW.length - 1.7, NW.length - 3.5, NW.length - 5.6, NW.length - 7.3];
  for (const [y, h, rows] of [[6.6, 1.9, 3], [9.4, 1.5, 2]] as const) bay(NW, NAX, y, h, 1.0, rows);
  bay(NW, NAX.slice(1), 2.6, 2.2, 1.0, 3);                                                // inferred: above the portal height only
  // stops 0.45 m short of the front corner so it does not cross the front cornice's return
  sl(NF, (NW.length - 0.45) / 2, 11.62, NW.length - 0.47, 0.5, 0.42, 'white');
  sl(NF, (NW.length - 0.45) / 2, 11.45, NW.length - 0.47, 0.17, 0.26, 'white');
  // chimneys: one on the alley wall just behind the front (photo), one on the party wall near the ridge (photo), one at the
  // back corner where 3DBAG has a 14.7 m stack
  const chim = (x: number, z: number, w: number, d: number, y0: number, y1: number) => {
    const g = new T.BoxGeometry(w, y1 - y0, d); g.rotateY(Math.atan2(FF.n[0], FF.n[1])); g.translate(x, (y0 + y1) / 2, z); b.add(g, 'brick' as never);
    const c = new T.BoxGeometry(w + 0.16, 0.14, d + 0.16); c.rotateY(Math.atan2(FF.n[0], FF.n[1])); c.translate(x, y1 + 0.07, z); b.add(c, 'stone' as never);
  };
  { const t = NW.length - 1.2; chim(NF.origin[0] + NF.tangent[0] * t - NF.n[0] * 0.25, NF.origin[1] + NF.tangent[1] * t - NF.n[1] * 0.25, 0.9, 0.6, 10.5, 15.2); }
  chim(-1.0, 2.55, 0.8, 0.55, 15.5, 18.0);
  chim(5.3, -1.1, 0.5, 0.9, 12.0, 14.7);

  // ---- Back (east, inferred) ------------------------------------------------------------------------------------------------
  const {wall: BW} = frame(F, C, [TOP, 12.16]);
  for (const [y, h, rows] of [[2.2, 2.2, 3], [6.0, 2.0, 3], [9.3, 1.5, 2]] as const) bay(BW, [1.7, 4.0], y, h, 1.0, rows);

  // ======================= Portal ==============================================================================================
  // Front frame t runs south from the house corner B. South pier = BAG jog of 229, t -1.15..0.05; north pier = the ragged
  // south-west corner of the 1A ring, t -4.75..-3.5; opening t -3.5..-1.15 (2.35 m; photo 2.3-2.4 m, portal about as wide as the
  // 1A front). Pier faces stand 0.23 m proud of the house front; the piers are 1.04 m deep. Heights from the across-canal photo:
  // opening 3.85 m, cornice top 4.55 m, pediment top 5.65 m (just under the 1A second-floor sills).
  const PF = 0.23, PB = -0.81, DEP = PF - PB;
  const tS = -0.55, tN = -4.12, tO = (-3.5 + -1.15) / 2, WO = 2.35, HO = 3.85;
  const st = (t: number, y: number, w: number, h: number, d: number, out: number, c = 'stone') => slab(b, FF, t, y, w, h, d, c, out);
  st(tS, 0, 1.2, 4.0, DEP, PB);                      // south pier
  st(tN, 0, 1.25, 4.0, DEP, PB);                     // north pier
  st(tO, HO - 0.05, WO + 0.1, 4.0 - HO + 0.05, DEP, PB);           // lintel over the opening (its underside is the soffit)
  // rounded upper corners of the opening (basket head)
  for (const sg of [-1, 1]) {
    // filler between the opening's corner and a quarter circle of radius r (x into the opening, y down from the head)
    const r = 0.42, pts: [number, number][] = [[0, 0]];
    for (let i = 0; i <= 6; i++) { const a = (Math.PI / 2) * (i / 6); pts.push([r - r * Math.sin(a), -r + r * Math.cos(a)]); }
    const shape = pts.map(([x, y]) => [-sg * x, y] as [number, number]);
    poly(b, FF, tO + sg * WO / 2, HO, shape, DEP - 0.02, 'stone', PB + 0.01);
  }
  // moulded architrave round the opening
  st(tO - WO / 2 - 0.1, 0.5, 0.2, HO - 0.5, 0.06, PF);
  st(tO + WO / 2 + 0.1, 0.5, 0.2, HO - 0.5, 0.06, PF);
  st(tO, HO - 0.02, WO + 0.4, 0.22, 0.06, PF);
  // rusticated pilaster strips behind the columns (alternating long and short blocks)
  for (const t of [tS, tN]) for (let k = 0; k < 5; k++) st(t, 0.55 + k * 0.62, (k % 2 ? 0.78 : 0.92), 0.56, 0.07, PF);
  // free-standing columns on plinths, volute capitals
  for (const t of [tS, tN]) {
    const cx = FF.origin[0] + FF.tangent[0] * t + FF.n[0] * (PF + 0.36), cz = FF.origin[1] + FF.tangent[1] * t + FF.n[1] * (PF + 0.36);
    const rot = Math.atan2(FF.n[0], FF.n[1]);
    const add = (g: T.BufferGeometry, y: number) => { g.rotateY(rot); g.translate(cx, y, cz); b.add(g, 'stone' as never); };
    add(new T.BoxGeometry(0.72, 0.55, 0.72), 0.275);
    add(new T.CylinderGeometry(0.3, 0.32, 0.12, 14), 0.61);
    add(new T.CylinderGeometry(0.22, 0.26, 2.95, 14), 0.67 + 1.475);
    add(new T.CylinderGeometry(0.33, 0.23, 0.24, 14), 3.62 + 0.12);
    add(new T.BoxGeometry(0.74, 0.1, 0.74), 3.86 + 0.05);
    for (const dt of [-0.3, 0.3]) disc(b, FF, t + dt, 3.73, 0.11, 0.1, 'stone', PF + 0.62);
  }
  // entablature (breaking forward over the columns), dentils, cornice
  const tL = tN - 0.7, tR = tS + 0.62, tw = tR - tL, tc = (tL + tR) / 2;
  st(tc, 3.96, tw, 0.4, 0.18, PF);
  for (const t of [tS, tN]) st(t, 3.96, 0.86, 0.4, 0.62, PF);
  for (let k = 0; k < 17; k++) st(tL + 0.15 + (k * (tw - 0.3)) / 16, 4.24, 0.1, 0.11, 0.26, PF);
  st(tc, 4.35, tw + 0.25, 0.2, 0.36, PF);
  for (const t of [tS, tN]) st(t, 4.35, 1.1, 0.2, 0.82, PF);
  // segmental pediment over the opening: tympanum with cartouche, moulded arch
  const PW = 3.1, rise = 1.0, y0 = 4.55;
  const R = (PW * PW / 4 + rise * rise) / (2 * rise);
  const tym: [number, number][] = [];
  for (let i = 0; i <= 12; i++) { const x = -PW / 2 + (PW * i) / 12; tym.push([x, rise - R + Math.sqrt(R * R - x * x)]); }
  poly(b, FF, tO, y0, tym, DEP - 0.3, 'stone', PB + 0.3);
  segBand(b, FF, tO, y0 + 0.02, PW + 0.3, rise + 0.08, 0.2, 0.3, 'stone', PF - 0.05);
  // cartouche: an upright oval shield in a scrolled frame, flanked by two reclining supporters (photo relief), all in the same stone
  const oval = (rx: number, ry: number): [number, number][] => Array.from({length: 16}, (_, i) => [rx * Math.cos((i / 16) * 2 * Math.PI), ry + ry * Math.sin((i / 16) * 2 * Math.PI)]);
  poly(b, FF, tO, y0 + 0.08, oval(0.36, 0.33), 0.1, 'stone', PF - 0.02);
  poly(b, FF, tO, y0 + 0.16, oval(0.24, 0.25), 0.12, 'stone', PF - 0.02);
  for (const sg of [-1, 1]) {
    poly(b, FF, tO + sg * 0.72, y0 + 0.05, [[-0.32, 0], [0.32, 0], [0.2, 0.3], [-0.12, 0.42], [-0.3, 0.22]].map(([x, y]) => [-sg * x, y] as [number, number]), 0.1, 'stone', PF - 0.02);
  }
  // urns on the cornice ends above the columns
  for (const t of [tS, tN]) {
    st(t, 4.55, 0.5, 0.26, 0.5, PF + 0.11);
    const cx = FF.origin[0] + FF.tangent[0] * t + FF.n[0] * (PF + 0.36), cz = FF.origin[1] + FF.tangent[1] * t + FF.n[1] * (PF + 0.36);
    const vase = new T.SphereGeometry(0.25, 12, 8); vase.scale(1, 1.2, 1); vase.translate(cx, 5.1, cz); b.add(vase, 'stone' as never);
    const lid = new T.ConeGeometry(0.16, 0.38, 10); lid.translate(cx, 5.55, cz); b.add(lid, 'stone' as never);
  }
  // gate leaves standing open against the reveals: black, panelled, glazed under arched heads (photos)
  for (const sg of [-1, 1]) {
    const t = tO + sg * (WO / 2 - 0.05);
    st(t, 0.02, 0.07, HO - 0.5, 0.95, PB + 0.02, 'dark');
    st(t - sg * 0.04, 2.2, 0.02, 0.9, 0.62, PB + 0.18, 'glass');
  }

  // ======================= Oudemanhuispoort 1A (north neighbour) ===============================================================
  const lod1a = H1A.lod22 as LodSurface[];
  lodSurfaces(b, lod1a, ['WallSurface'], 'concrete');
  lodSurfaces(b, lod1a, ['RoofSurface'], 'slate');
  // Canal front (photo): three axes; ground floor two shop windows and the shop door on the south axis; two upper floors of
  // two-by-two sashes; flat white cornice. Painted boarding is suggested by a few thin white rails.
  const {f: QF, wall: QW} = frame([1.897, -12.198], [-0.808, -7.651], [8.1, 8.48]);
  const QA = [0.97, 2.45, 4.1];
  addBaysClean(b, QW, {at: QA, y: 3.4, h: 1.75, wd: 1.05, pitch: 1.5, cols: 2, rows: 2, jamb: 0.08, trim: 'white', proud: 0.08, frame: 'white', glass: 'glass'});
  addBaysClean(b, QW, {at: QA, y: 5.9, h: 1.45, wd: 1.0, pitch: 1.5, cols: 2, rows: 2, jamb: 0.08, trim: 'white', proud: 0.08, frame: 'white', glass: 'glass'});
  addBaysClean(b, QW, {at: QA.slice(0, 2), y: 0.6, h: 1.75, wd: 1.15, pitch: 1.5, cols: 2, rows: 1, jamb: 0.08, trim: 'white', proud: 0.08, frame: 'dark', glass: 'glass'});
  sl(QF, QA[2], 0, 1.15, 2.65, 0.08, 'white');
  sl(QF, QA[2], 0.05, 0.9, 2.45, 0.12, 'dark');
  sl(QF, QW.length / 2, 2.85, QW.length, 0.25, 0.14, 'white');           // shopfront fascia
  sl(QF, QW.length / 2, 7.9, QW.length + 0.2, 0.32, 0.3, 'white');        // cornice
  for (const y of [5.5, 7.6]) sl(QF, QW.length / 2, y, QW.length, 0.05, 0.03, 'white');
  // alley side of 1A (inferred): two windows on each upper floor
  const {wall: QS} = frame([0.147, -7.354], [3.02, -6.646], [8.14, 7.16]);
  for (const y of [3.4, 5.6]) addBaysClean(b, QS, {at: [0.9, 2.2], y, h: 1.4, wd: 0.9, pitch: 1.3, cols: 2, rows: 2, jamb: 0.06, trim: 'white', proud: 0.08, frame: 'white', glass: 'glass'});
}
