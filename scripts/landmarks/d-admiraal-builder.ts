import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import foot from './d-admiraal-footprints.json';
import {beam, board, boatCap, facingRotation, octFrustum, octWindow, framedOpening, pixelText, ringArea, sails, stage, turned, wallUnder, windingWheel, type C, type P} from './windmill-kit';

/**
 * D'Admiraal (Noordhollandschkanaaldijk 21), chalk and trass mill, 1792 (Rijksmonument 6609: "achtkante bovenkruier,
 * geheel met riet bedekt"). Molendatabase 00238: thatched pine octagon on a timber base (the shed), stage at 3.50 m,
 * thatched cap, beard dark green with yellow edging lettered '17' '92', rear beard 'd'Admiraal' in the same style, sails
 * 17.10 m (Fauel, leading boards on both stocks), English curb. Photos: municipal panoramas 2017-2025 (CC BY 4.0),
 * Wikimedia Commons 2008-2022 (CC BY-SA).
 * Frame: mill axis at the OSM mill node; sails on +Z turned to bearing 206 (the canal-dike side, as the 2024 panorama and
 * the 2022 Commons photo show them), which makes +X the shed's long axis (bearing 116) and +Z its cross axis.
 */
export const D_ADMIRAAL = {facing: 206, eave: 2.3, band: 3.45, bandZ: [-4.1, 2.45] as const, ridgeWing: 4.8, wingX: -8.85, wingZ: [-6.6, 4.0] as const,
  stageY: 3.8, stageR: 5.4, octBase: 2.6, octTop: 11.9, hub: [0, 12.6, 3.6] as P, radius: 8.55, lean: .26};

type XZ = [number, number];
/** Roof height over the mill shed: flat band under the stage, low slopes down to the NE (-Z) and SW (+Z) eaves. */
function shedRoof(z: number): number {
  const [a, c] = D_ADMIRAAL.bandZ, {band, eave} = D_ADMIRAAL;
  if (z > c) return band - (z - c) * (band - eave) / (7.4 - c);
  if (z < a) return band - (a - z) * (band - eave) / (a + 9.3);
  return band;
}
/** The wing west of the mill shed: gable roof along X, ridge midway between its long walls. */
function wingRoof(z: number): number {
  const [a, c] = D_ADMIRAAL.wingZ, mid = (a + c) / 2;
  return D_ADMIRAAL.eave + (D_ADMIRAAL.ridgeWing - D_ADMIRAAL.eave) * (1 - Math.abs(z - mid) / ((c - a) / 2));
}

function clip(poly: XZ[], keep: (p: XZ) => number): XZ[] {
  const out: XZ[] = [];
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i], q = poly[(i + 1) % poly.length], fp = keep(p), fq = keep(q);
    if (fp >= 0) out.push(p);
    if ((fp >= 0) !== (fq >= 0)) { const t = fp / (fp - fq); out.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]); }
  }
  return out;
}
/** Piecewise-planar roof over a footprint polygon: cut into strips between `breaks` (in z), each strip planar. */
function heightRoof(b: BuildingTools, poly: XZ[], h: (z: number) => number, breaks: number[], c: C, role: string): void {
  const pos: number[] = [];
  for (let i = 0; i + 1 < breaks.length; i++) {
    const piece = clip(clip(poly, p => p[1] - breaks[i]), p => breaks[i + 1] - p[1]);
    if (piece.length < 3) continue;
    const tris = T.ShapeUtils.triangulateShape(piece.map(p => new T.Vector2(p[0], p[1])), []);
    for (const [ia, ib, ic] of tris) {
      const v = [ia, ib, ic].map(k => [piece[k][0], h(piece[k][1]), piece[k][1]]);
      const n = (v[1][2] - v[0][2]) * (v[2][0] - v[0][0]) - (v[1][0] - v[0][0]) * (v[2][2] - v[0][2]);
      pos.push(...v[0], ...(n > 0 ? v[1] : v[2]), ...(n > 0 ? v[2] : v[1]));
    }
  }
  const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.computeVertexNormals(); g.userData.role = role; b.add(g, c);
}

/** Semicircular fanlight with white radiating bars (south-east wall, panorama 2017/2021). */
function fanlight(b: BuildingTools, z: number, x: number, y: number, r: number): void {
  const half = new T.Shape().moveTo(r, 0).absarc(0, 0, r, 0, Math.PI, false).closePath();
  const g = new T.ShapeGeometry(half, 8); g.rotateY(Math.PI / 2); g.userData.role = 'fanlight'; b.add(g, 'glass', x, y, z);
  const rim = new T.TorusGeometry(r, .05, 4, 10, Math.PI); rim.rotateY(Math.PI / 2); rim.userData.role = 'fanlight'; b.add(rim, 'white', x + .03, y, z);
  b.box(x + .03, y - .04, z, .06, .08, 2 * r + .1, 'white');
  for (let k = 1; k < 6; k++) { const a = k * Math.PI / 6; beam(b, [x + .04, y, z], [x + .04, y + Math.sin(a) * r, z + Math.cos(a) * r], .04, 'white', 'fanlight-bar'); }
}

export function buildDAdmiraal(_w: number, _d: number, root: BuildingTools): void {
  const th = facingRotation(D_ADMIRAAL.facing), b = turned(root, th);
  const toMill = ([x, z]: XZ): XZ => [+(x * Math.cos(th) - z * Math.sin(th)).toFixed(3), +(x * Math.sin(th) + z * Math.cos(th)).toFixed(3)];
  const ring0 = (foot.ringLocal as XZ[]).map(toMill), ring = ringArea(ring0) > 0 ? ring0 : [...ring0].reverse(), {wingX, eave} = D_ADMIRAAL;
  const top = (x: number, z: number) => x < wingX - .05 ? wingRoof(z) : shedRoof(z);
  // Walls: tarred weatherboarding on a low brick plinth, tops following the roofs (gable ends included).
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i], q = ring[(i + 1) % ring.length], ts = new Set([0, 1]);
    const add = (lo: number, hi: number, v: number) => { if ((v - lo) * (v - hi) < 0) ts.add((v - lo) / (hi - lo)); };
    for (const z of [...D_ADMIRAAL.bandZ, (D_ADMIRAAL.wingZ[0] + D_ADMIRAAL.wingZ[1]) / 2]) add(a[1], q[1], z);
    add(a[0], q[0], wingX - .05); add(a[0], q[0], wingX - .07);
    wallUnder(b, a, q, .25, top, 'copper', [...ts].sort((m, n) => m - n), 'shed-wall');
    wallUnder(b, a, q, 0, () => .25, 'brick', [0, 1], 'plinth');
    b.box(a[0], .25, a[1], .2, top(a[0], a[1]) - .3, .2, 'pink'); // white corner boards
  }
  // Roofs: red pantiles. Mill shed (cleaned BAG outline + 0.3 m eaves) and the wing's gable roof.
  const shed: XZ[] = [[-4.45, -9.6], [-4.45, -6.9], [wingX, -6.9], [wingX, 4.0], [-9.15, 4.0], [-9.15, 7.95], [6.3, 7.65], [6.22, -4.13], [5.66, -9.6]];
  heightRoof(b, shed, shedRoof, [-9.6, ...D_ADMIRAAL.bandZ, 7.95], 'red', 'shed-roof');
  const [wa, wc] = D_ADMIRAAL.wingZ, wing: XZ[] = [[-24.35, wa - .3], [wingX, wa - .3], [wingX, wc + .3], [-24.35, wc + .3]];
  heightRoof(b, wing, wingRoof, [wa - .3, (wa + wc) / 2, wc + .3], 'red', 'wing-roof');
  wallUnder(b, [wingX, wa], [wingX, wc], 2.0, (_x, z) => wingRoof(z), 'copper', [0, .5, 1], 'wing-gable');
  // White fascias along the eaves (panoramas).
  beam(b, [-9.15, eave - .02, 7.97], [6.3, eave - .02, 7.67], .2, 'pink', 'fascia', .06);
  beam(b, [-4.45, eave - .02, -9.62], [5.66, eave - .02, -9.62], .2, 'pink', 'fascia', .06);
  for (const z of [wa - .32, wc + .32]) beam(b, [-24.35, eave - .16, z], [wingX, eave - .16, z], .2, 'pink', 'fascia', .06);
  // South-east (canal) wall, panorama 2017/2021: two green stable doors and two fanlights.
  const seX = (z: number) => 5.92 + (z + 4.13) * .007;
  for (const z of [3.41, -.91]) framedOpening(b, [seX(z), z], [1, 0], .25, 1.45, 2.2, 'green', 'white');
  for (const z of [1.01, -2.85]) fanlight(b, z, seX(z) + .045, 1.5, .78);
  // South-west (dike) wall, panorama 2024: two white-framed windows, the green double door, a notice board.
  const swZ = (x: number) => 7.64 - (x + 8.82) / 14.82 * .29;
  for (const x of [-5.26, -3.85]) framedOpening(b, [x, swZ(x)], [0, 1], .95, .95, .95, 'glass', 'white');
  framedOpening(b, [-1.54, swZ(-1.54)], [0, 1], .25, 1.75, 2.1, 'green', 'white');
  framedOpening(b, [5.0, swZ(5.0)], [0, 1], 1.2, .8, .6, 'stone', 'white');
  // North-east and wing walls: no clear photograph (house and trees in front); doors and windows inferred, kept plain.
  framedOpening(b, [.6, -9.27], [0, -1], .25, 1.3, 2.05, 'green', 'white');
  const nz = (x: number) => -6.64 + (x + 4.15) / -19.93 * .19, sz = (x: number) => 4.04 + (x + 24.02) / 15.14 * -.08;
  for (const x of [-12, -16, -20]) { framedOpening(b, [x, nz(x)], [0, -1], 1.0, .8, .8, 'glass', 'white'); framedOpening(b, [x, sz(x)], [0, 1], 1.0, .8, .8, 'glass', 'white'); }
  // Thatched octagon on the shed with its bell flare, two small windows.
  octFrustum(b, D_ADMIRAAL.octBase, 1.7, 4.85, 4.1, 'greyBrick', 'octagon-flare');
  octFrustum(b, 4.3, D_ADMIRAAL.octTop - 4.3, 4.1, 2.4, 'greyBrick', 'octagon');
  const rAt = (y: number) => 4.1 + (y - 4.3) / (D_ADMIRAAL.octTop - 4.3) * (2.4 - 4.1);
  octWindow(b, 0, 5.0, rAt(5.5), .75, 1.05, 'white', 'glass', .207); octWindow(b, 4, 7.6, rAt(7.95), .5, .7, 'white', 'glass', .207);
  // Stage on the shed roof: cream frame and railing (Commons 2014/2022).
  stage(b, {y: D_ADMIRAAL.stageY, rOuter: D_ADMIRAAL.stageR, rInner: 4.0, deck: 'stone', edge: 'gold', rail: 'gold', postsPerSide: 2});
  // Thatched cap; beard and rear beard dark green, yellow edging and lettering.
  boatCap(b, D_ADMIRAAL.octTop, 2.65, 2.95, 1.9, 'greyBrick', 'slate');
  board(b, -1.15, D_ADMIRAAL.octTop - .05, 3.05, 1.5, .78, 'green', 'ochre', .1); board(b, 1.15, D_ADMIRAAL.octTop - .05, 3.05, 1.5, .78, 'green', 'ochre', .1);
  pixelText(b, '17', -1.15, D_ADMIRAAL.octTop + .34, 3.18, .42, 'ochre'); pixelText(b, '92', 1.15, D_ADMIRAAL.octTop + .34, 3.18, .42, 'ochre');
  const rear = turned(b, Math.PI);
  board(rear, 0, D_ADMIRAAL.octTop - .05, 3.05, 3.4, .7, 'green', 'ochre', .1);
  pixelText(rear, "D'ADMIRAAL", 0, D_ADMIRAAL.octTop + .3, 3.18, .38, 'ochre');
  const clear = sails(b, {cross: {hub: D_ADMIRAAL.hub, radius: D_ADMIRAAL.radius, rotationDeg: 15, lean: D_ADMIRAAL.lean}, style: 'fauel', stock: 'green', lattice: 'blue', leading: 'green', latticeWidth: 1.45, barStep: .45, hubC: 'red', shaftFrom: [0, D_ADMIRAAL.hub[1] - .25, .8]});
  if (clear.forward < D_ADMIRAAL.stageR + .3) throw new Error(`d-admiraal: sails sweep through the stage (${JSON.stringify(clear)})`);
  if (clear.lowest < shedRoof(clear.forward) + .5) throw new Error(`d-admiraal: sails sweep into the shed roof (${JSON.stringify(clear)})`);
  // Tail with cream struts down to the stage edge and the winding wheel.
  const foot2: P = [0, D_ADMIRAAL.stageY + 1.1, -D_ADMIRAAL.stageR - .2];
  beam(b, [0, D_ADMIRAAL.octTop + .5, -2.7], foot2, .26, 'gold', 'tail-pole');
  for (const s of [-1, 1]) beam(b, [s * 2.5, D_ADMIRAAL.octTop + .25, -.5], [0, D_ADMIRAAL.stageY + 1.3, -D_ADMIRAAL.stageR - .15], .16, 'gold', 'tail-strut');
  beam(b, [-2.9, D_ADMIRAAL.octTop + .2, -.7], [2.9, D_ADMIRAAL.octTop + .2, -.7], .2, 'gold', 'tail-crossbeam');
  windingWheel(b, [0, D_ADMIRAAL.stageY + 1.15, -D_ADMIRAAL.stageR - .45], .85, 'gold');
}
