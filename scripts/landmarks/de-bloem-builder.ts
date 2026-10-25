import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {upwardRoofPlane} from './house-geometry';
import foot from './de-bloem-footprints.json';
import {beam, board, boatCap, facingRotation, octagon, octFrustum, octWindow, framedOpening, sails, stage, turned, wallUnder, windingWheel, type P} from './windmill-kit';

/**
 * De Bloem (Haarlemmerweg 465), stellingmolen, 1768, rebuilt here 1878. Molendatabase 00802: masonry square foot 4.50 m,
 * thatched octagonal underbody, stage (stelling) at 12.30 m, thatched upper octagon and cap, sail span 26.20/26.40 m
 * (Fauel leading boards), very plain dark-green beard with white edge, no rear beard; two gable stones over the north
 * doors. Photos: municipal panoramas 2018-2025 (CC BY 4.0) and Wikimedia Commons 2008-2014 (CC BY-SA), see the spec.
 * Frame: mill axis at the BAG square's centre, sails on +Z turned to bearing 255 (west, as in the 2024-2025 panoramas).
 */
export const DE_BLOEM = {facing: 255, base: 4.5, stageY: 12.3, lowerTop: 12.3, capY: 22.6, hub: [0, 24.3, 4.6] as P, radius: 13.15, lean: .24, stageR: 7.2};

export function buildDeBloem(_w: number, _d: number, root: BuildingTools): void {
  const ring = foot.ringLocal as [number, number][];
  // BAG ring: square foot (vertices 4-7) plus the small house against its north wall (vertices 0-3).
  const sq = [ring[4], ring[5], ring[6], ring[7]], ax = sq.reduce((s, p) => s + p[0], 0) / 4, az = sq.reduce((s, p) => s + p[1], 0) / 4;
  const th = facingRotation(DE_BLOEM.facing), b = turned(root, th, ax, az);
  const toMill = ([x, z]: [number, number]) => { const dx = x - ax, dz = z - az; return [dx * Math.cos(th) - dz * Math.sin(th), dx * Math.sin(th) + dz * Math.cos(th)] as [number, number]; };
  const half = Math.max(...sq.map(toMill).map(p => Math.max(Math.abs(p[0]), Math.abs(p[1]))));
  // Square masonry foot: north face whitewashed with the arched doors (Commons 2008), the rest dark brick (panoramas 2019/2021, Commons 2014).
  const base = new T.Shape().moveTo(-half, -half).lineTo(half, -half).lineTo(half, half).lineTo(-half, half).closePath();
  const corners: [number, number][] = [[-half, -half], [half, -half], [half, half], [-half, half]];
  for (let i = 0; i < 4; i++) { const a = corners[i], q = corners[(i + 1) % 4]; wallUnder(b, a, q, 0, () => DE_BLOEM.base, a[0] === -half && q[0] === -half ? 'concrete' : 'brick', [0, 1], 'base-wall'); }
  b.add(upwardRoofPlane(base, DE_BLOEM.base), 'stone');
  for (const s of [-1, 1]) { b.box(0, DE_BLOEM.base - .08, s * (half + .07), 2 * half + .28, .2, .14, 'stone'); b.box(s * (half + .07), DE_BLOEM.base - .08, 0, .14, .2, 2 * half, 'stone'); }
  // North wall is -X in the mill frame (bearing 345 when the sails face 255): two arched doors, gable stones, windows.
  const nx = -half - .06;
  for (const z of [-1.15, 1.15]) {
    const door = new T.Shape().moveTo(-.75, 0).lineTo(.75, 0).lineTo(.75, 1.85).absarc(0, 1.85, .75, 0, Math.PI, false).closePath();
    const g = new T.ExtrudeGeometry(door, {depth: .1, bevelEnabled: false, curveSegments: 6}); g.rotateY(-Math.PI / 2); g.userData.role = 'arched-door';
    b.add(g, 'dark', -half + .04, 0, z);
  }
  b.box(nx - .06, 2.95, 0, .1, .55, .9, 'stone'); b.box(nx - .06, 3.65, 0, .1, .45, 1.1, 'stone'); // the two gable stones over the doors
  for (const z of [-3.6, 3.6]) framedOpening(b, [-half, z], [-1, 0], 3.05, .7, .9, 'glass', 'white');
  for (const n of [[1, 0], [0, 1], [0, -1]] as [number, number][]) framedOpening(b, [n[0] * half, n[1] * half], n, 2.6, .75, .95, 'glass', 'white');
  // The small whitewashed house on the north wall (BAG vertices 0-3), flat roofed.
  const h = ring.slice(0, 4).map(toMill), hx = [Math.min(...h.map(p => p[0])), Math.max(...h.map(p => p[0]))], hz = [Math.min(...h.map(p => p[1])), Math.max(...h.map(p => p[1]))];
  const hw = hx[1] - hx[0], hd = hz[1] - hz[0], hcx = (hx[0] + hx[1]) / 2 - .05, hcz = (hz[0] + hz[1]) / 2;
  b.box(hcx, 0, hcz, hw - .1, 2.7, hd, 'concrete'); b.box(hcx, 2.7, hcz, hw + .1, .18, hd + .2, 'slate');
  b.box(hx[0] - .03, 0, hcz - .55, .08, 2.05, .85, 'dark'); b.box(hx[0] - .03, 1.1, hcz + .8, .08, .7, .6, 'glass');
  // Thatched underbody: flared skirt over the foot, then near-straight sides up to the stage (Commons 2008, panoramas 2019/2021).
  octFrustum(b, DE_BLOEM.base, .9, 5.55, 4.95, 'greyBrick', 'lower-skirt');
  octFrustum(b, DE_BLOEM.base + .9, DE_BLOEM.lowerTop - DE_BLOEM.base - .9, 4.95, 4.7, 'greyBrick', 'lower-octagon');
  const rLow = (y: number) => 4.95 + (y - 5.4) / (DE_BLOEM.lowerTop - 5.4) * (4.7 - 4.95);
  for (const i of [0, 2, 4, 6]) octWindow(b, i, 9.0, rLow(9.4), .62, .82, 'white', 'glass', .033);
  for (const i of [1, 5]) octWindow(b, i, 6.3, rLow(6.7), .6, .8, 'white', 'glass', .033);
  // Upper octagon tapering to the cap, small windows on alternate faces at two levels.
  octFrustum(b, DE_BLOEM.lowerTop, DE_BLOEM.capY - DE_BLOEM.lowerTop, 4.65, 3.3, 'greyBrick', 'upper-octagon');
  const rUp = (y: number) => 4.65 + (y - DE_BLOEM.lowerTop) / (DE_BLOEM.capY - DE_BLOEM.lowerTop) * (3.3 - 4.65);
  for (const i of [0, 2, 4, 6]) octWindow(b, i, 15.6, rUp(16), .55, .75, 'white', 'glass', .121);
  for (const i of [1, 7]) octWindow(b, i, 19.4, rUp(19.8), .5, .7, 'white', 'glass', .121);
  // Stage with white beams, rails and struts down to the underbody.
  stage(b, {y: DE_BLOEM.stageY, rOuter: DE_BLOEM.stageR, rInner: 4.66, deck: 'slate', edge: 'concrete', rail: 'concrete', braces: {toY: 8.2, toR: 4.88, c: 'concrete', perSide: 2}});
  // Cap rim: red and white bands under the thatched cap (panoramas 2021-2025, Commons 2008).
  octFrustum(b, DE_BLOEM.capY - .32, .16, 3.42, 3.42, 'red', 'cap-band');
  octFrustum(b, DE_BLOEM.capY - .16, .16, 3.42, 3.42, 'concrete', 'cap-band');
  boatCap(b, DE_BLOEM.capY, 3.45, 3.85, 2.35, 'greyBrick', 'slate');
  // Beard (baard): plain dark green board, white edge, no lettering; no rear beard (Molendatabase).
  board(b, 0, DE_BLOEM.capY - .1, 3.92, 2.6, 1.05, 'green', 'concrete', .12);
  const clear = sails(b, {cross: {hub: DE_BLOEM.hub, radius: DE_BLOEM.radius, rotationDeg: 20, lean: DE_BLOEM.lean}, style: 'fauel', stock: 'slate', lattice: 'pink', leading: 'concrete', latticeWidth: 2.1, barStep: .62, barSize: .11, hubC: 'slate', shaftFrom: [0, 24.0, 1.8]});
  if (clear.lowest < DE_BLOEM.stageY + 1.2 && clear.forward < DE_BLOEM.stageR + .4) throw new Error(`de-bloem: sails hit the stage (${JSON.stringify(clear)})`);
  // Tail: tail pole and two struts (schoren) from the cap to the stage, winding wheel at the stage edge.
  const tail: P = [0, DE_BLOEM.stageY + 1.3, -DE_BLOEM.stageR - .25];
  beam(b, [0, DE_BLOEM.capY + .6, -3.4], tail, .3, 'slate', 'tail-pole');
  for (const s of [-1, 1]) beam(b, [s * 3.3, DE_BLOEM.capY + .3, -.6], [0, DE_BLOEM.stageY + 1.5, -DE_BLOEM.stageR - .2], .18, 'slate', 'tail-strut');
  beam(b, [-3.6, DE_BLOEM.capY + .25, -.9], [3.6, DE_BLOEM.capY + .25, -.9], .22, 'slate', 'tail-crossbeam');
  windingWheel(b, [0, DE_BLOEM.stageY + 1.35, -DE_BLOEM.stageR - .5], 1.0, 'red');
}
