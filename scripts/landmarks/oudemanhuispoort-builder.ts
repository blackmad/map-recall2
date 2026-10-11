import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {edgesOf, lodSurfaces, ringPoints, type Edge, type LodSurface} from './civic-kit';
import {archBand, archSlab, disc, poly, segBand, slab, type Frame} from './nearbar-kit';
import {addBaysClean} from './clean-bays';
import type {Wall} from './worship-walls';
import source from './oudemanhuispoort-footprints.json';

/**
 * Oudemanhuispoort: the gate-house block and stone portal at the Oudezijds Achterburgwal end of the covered passage (BAG pand
 * 0363100012180206; 3DBAG LoD2.2 solid, about 17 m to the flat roof top). The pand has 6.1 m of canal frontage with two window axes
 * (panorama 0, 2025) and the south jamb of the portal at its north-west corner; the gate opening and its north jamb stand outside the
 * pand ring, in the gap to the next house, and are drawn here as one stone screen: rusticated piers, free-standing columns with
 * volute capitals, a black door under two arched transom lights, an entablature with a dentil course and a segmental pediment with a
 * cartouche (panoramas 1 and 3). Upper storeys are painted white sashes in brick reveals, as on the neighbouring Oudezijds Achterburgwal 229.
 */
export const OMHP_PORTAL_POINT = [-4.6, -1];

const frameOfEdge = (e: Edge): {f: Frame; wall: Wall} => {
  const n: [number, number] = [e.out.x, e.out.y], tangent: [number, number] = [n[1], -n[0]];
  const fwd = e.u.x * tangent[0] + e.u.y * tangent[1] > 0;
  const o = fwd ? e.p : e.q;
  const H = 12.1;
  return {f: {origin: [o.x, o.y], tangent, n}, wall: {n, origin: [o.x, o.y], tangent, length: e.len, base: 0, index: 0, poly: [[0, 0], [e.len, 0], [e.len, H], [0, H]]}};
};

export function buildOudemanhuispoort(_w: number, _d: number, b: BuildingTools) {
  const pand = source.pands[0];
  const surfaces = pand.lod22 as LodSurface[];
  // The 3DBAG portal jamb (a 1.6 x 1.1 m footprint at the north-west corner) is extruded to the roof plane; draw it as stone.
  const jamb = (s: LodSurface) => s.type === 'WallSurface' && s.rings[0].every(p => p[0] > -3.2 && p[0] < -1.4 && p[2] < -3.0 && p[2] > -4.3);
  lodSurfaces(b, surfaces.filter(s => s.type === 'WallSurface' && !jamb(s)), ['WallSurface'], 'brick');
  lodSurfaces(b, surfaces.filter(jamb), ['WallSurface'], 'stone');
  lodSurfaces(b, surfaces, ['RoofSurface'], 'slate');
  const pts = ringPoints(pand.localRing);
  const es = edgesOf(pts).filter(e => e.len > 2);
  const ap = new T.Vector2(OMHP_PORTAL_POINT[0], OMHP_PORTAL_POINT[1]);
  const front: Edge = es.reduce((a, e) => (e.mid.distanceTo(ap) < a.mid.distanceTo(ap) ? e : a));
  const {f: F, wall: FW} = frameOfEdge(front);
  const S = 0.04;
  const sl = (t: number, y: number, w: number, h: number, d: number, c: string, out = 0) => slab(b, F, t, y, w, h, d + S, c, out - S);

  // ---- Canal front: two window axes on every floor, basement lights with brick arches, white cornice ----------------------
  const axes = [1.55, 4.15];
  const floors: [number, number][] = [[1.9, 2.8], [5.2, 2.6], [8.3, 2.0]]; // sill, height
  for (const [y, h] of floors) addBaysClean(b, FW, {at: axes, y, h, wd: 1.3, pitch: 2.6, cols: 2, rows: Math.round(h / 0.65), jamb: 0.13, trim: 'white', proud: 0.1, frame: 'dark', glass: 'glass'});
  addBaysClean(b, FW, {at: axes, y: 0.25, h: 0.95, wd: 1.0, pitch: 2.6, cols: 3, rows: 1, jamb: 0.1, trim: 'white', proud: 0.08, frame: 'dark', glass: 'dark'});
  for (const t of axes) for (const [y, h] of floors) sl(t, y + h + 0.28, 1.9, 0.26, 0.06, 'stone', 0); // brick-on-edge flat arch (read as a lighter course)
  sl(FW.length / 2, 11.5, FW.length + 0.3, 0.32, 0.42, 'white', 0);   // eaves cornice
  sl(FW.length / 2, 3.95, FW.length, 0.14, 0.12, 'stone', 0);          // floor band

  // ---- Passage side (north wall): same sash pattern, inferred ----------------------------------------------------------------
  const north = es.filter(e => e !== front && e.out.y < -0.5 && e.len > 5)[0];
  if (north) {
    const {wall: NW} = frameOfEdge(north);
    for (const [y, h] of floors) addBaysClean(b, NW, {y, h, wd: 1.2, pitch: 2.3, margin: 1.0, cols: 2, rows: Math.round(h / 0.65), jamb: 0.12, trim: 'white', proud: 0.1, frame: 'dark'});
  }

  // ---- Portal: screen with gate opening north of the pand ring ------------------------------------------------------------
  const tS = -0.45, tN = -3.05, tg = (tS + tN) / 2;           // pier centres (south pier is the BAG jamb)
  const PIER = 0.75, DEP = 0.5;
  const px = (t: number, y: number, w: number, h: number, d: number, c: string, out = 0) => sl(t, y, w, h, d, c, out);
  px(tN, 0, PIER, 6.4, DEP, 'stone', -DEP + 0.5 - 0.5);          // north pier (the south one is the 3DBAG jamb, drawn in stone)
  // The gate opening is closed by a stone back plate carrying the black door and the two arched transom lights (panorama 3).
  const P = -0.28;
  px(tg, 0, tS - tN + PIER, 6.1, 0.14, 'stone', -0.42);
  px(tg, 0, 1.65, 3.45, 0.1, 'dark', P + 0.02);
  for (const dt of [-0.42, 0.42]) {
    archSlab(b, F, tg + dt, 3.55, 0.82, 1.45, 0.12 + S, 'dark', P + 0.02 - S);
    archSlab(b, F, tg + dt, 3.7, 0.56, 1.2, 0.08 + S, 'glass', P + 0.12 - S);
  }
  // free-standing columns on plinths with flared volute capitals
  for (const t of [tS, tN]) {
    const R = 0.27;
    const col = new T.CylinderGeometry(R * 0.92, R, 5.0, 14), cx = F.origin[0] + F.tangent[0] * t + F.n[0] * 0.3, cz = F.origin[1] + F.tangent[1] * t + F.n[1] * 0.3;
    col.translate(cx, 0.4 + 2.5, cz); b.add(col, 'stone' as never);
    const base = new T.BoxGeometry(0.72, 0.45, 0.72); base.rotateY(Math.atan2(F.n[0], F.n[1])); base.translate(cx, 0.225, cz); b.add(base, 'stone' as never);
    const cap = new T.CylinderGeometry(0.42, R * 0.92, 0.55, 14); cap.translate(cx, 5.4 + 0.275, cz); b.add(cap, 'stone' as never);
    const aba = new T.BoxGeometry(0.9, 0.14, 0.9); aba.rotateY(Math.atan2(F.n[0], F.n[1])); aba.translate(cx, 5.98 + 0.07, cz); b.add(aba, 'stone' as never);
    // volutes: a pair of small discs on the capital's front corners
    for (const dt of [-0.38, 0.38]) disc(b, F, t + dt, 5.75, 0.17, 0.12, 'stone', 0.6);
    // rusticated pier behind the column, in alternating courses
    if (t === tN) for (let k = 0; k < 7; k++) px(t, 0.45 + k * 0.78, PIER + 0.08 + (k % 2 ? 0.1 : 0), 0.7, DEP + 0.17, 'stone', -DEP - 0.03);
  }
  // entablature, dentils and cornice
  const tw = tS - tN + 1.5;
  px(tg, 6.1, tw, 0.76, DEP + 0.65, 'stone', -DEP + 0.0);
  px(tg, 6.86, tw + 0.1, 0.16, DEP + 0.75, 'stone', -DEP);
  for (let k = 0; k < 13; k++) px(tg - tw / 2 + 0.2 + k * (tw - 0.4) / 12, 6.7, 0.12, 0.16, 0.12, 'stone', 0.0 + DEP - 0.5 + 0.55);
  px(tg, 7.02, tw + 0.3, 0.2, DEP + 0.9, 'stone', -DEP);
  // segmental pediment with a cartouche
  segBand(b, F, tg, 7.22, tw - 0.1, 0.85, 0.3, DEP + 0.25 + S, 'stone', -DEP - S);
  poly(b, F, tg, 7.22, (() => { const W = tw - 0.4, rise = 0.7, pts: [number, number][] = [[-W / 2, 0], [W / 2, 0]]; for (let i = 8; i >= 0; i--) { const x = -W / 2 + (W * i) / 8; pts.push([x, rise * (1 - Math.pow((2 * x) / W, 2))]); } return pts; })(), 0.3 + S, 'stone', -0.3 - S);
  disc(b, F, tg, 7.85, 0.34, 0.14, 'white', 0.02);
  for (const dt of [-0.55, 0.55]) disc(b, F, tg + dt, 7.62, 0.14, 0.1, 'white', 0.02);
  // finial scroll on the south end of the entablature (visible in panorama 0)
  px(tS + 0.1, 7.2, 0.55, 0.7, 0.45, 'stone', -DEP + 0.05);
  const urn = new T.SphereGeometry(0.26, 10, 8); urn.translate(F.origin[0] + F.tangent[0] * (tS + 0.1) + F.n[0] * -0.2, 8.15, F.origin[1] + F.tangent[1] * (tS + 0.1) + F.n[1] * -0.2); b.add(urn, 'stone' as never);
  void archBand;
}
