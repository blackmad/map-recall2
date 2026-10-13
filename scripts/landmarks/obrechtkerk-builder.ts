import type {BuildingTools} from './cultural-builders';
import {block, clockFace, door, extrude, face, frame, gable, hipRoof, lathe, localB, onWall, rect, tris, win, type Col, type Kit, type V2, type Win} from './church-kit';
import {archBand, archSlab, disc, poly, ringSlab} from './nearbar-kit';
// Material slots: 'brick' brown brick, 'stone' light stone dressings and helm stripes, 'concrete' the sandstone base,
// 'white' the blind arcade panels, 'pink' the patterned-brick bands, 'greyBrick' recessed brick panels, 'ochre' the
// wooden doors, 'red' the parish hall's tiles, 'slate' the church roofs, 'gold' mosaics and crosses.

/**
 * Obrechtkerk, Jacob Obrechtstraat (J. Stuyt, 1911-1913). Built from intent on the BAG plan and 3DBAG heights.
 *
 * Plan (BAG 0363100012124153; plan coordinates (x along the church axis, 22.4 degrees counter-clockwise from east; z to the left of it, see
 * localB), the towered
 * front at +x facing east-north-east onto Jacob Obrechtstraat): a cruciform basilica with a 11.8 m nave (eaves 17.5,
 * ridge 23.4 m), lean-to aisles, transepts of the nave's height, a square crossing tower (walls 26 m, pyramid to
 * 35.4 m), a chancel and a semicircular apse at the back, low chapels in the angles, two 6.4 m square front towers
 * with striped helm roofs (3DBAG 36.9 m + cross), and the gabled parish hall standing forward of the south tower.
 * Facade rhythm per wall: scripts/landmarks/obrechtkerk-research.json.
 */
const XF = 39.6, XT0 = 33.6, XT1 = 40.0; // front centre face, towers
const ZN0 = -3.2, ZN1 = 8.6, ZC = (ZN0 + ZN1) / 2; // nave walls, centre line (2.7)
const ZTA: V2 = [-9.6, -3.2], ZTB: V2 = [8.6, 15.0]; // south tower (beside the hall, with the clock), north tower
const XC0 = -9, XC1 = 3; // crossing and transepts
const XA = -14.2; // chancel end / apse centre
const EAVE = 17.5, RIDGE = 23.4, TOWER_TOP = 29.2;

const BELL_PITCH = 1.15, ARC_PITCH = 0.97;

/** One arch of the blind arcade: a white round-headed panel in a brick surround. */
function blindArch(k: Kit, f: ReturnType<typeof frame>, t: number) {
  archSlab(k, f, t, 4.7, 0.5, 2.8, 0.08, 'white', -0.04);
  archBand(k, f, t, 4.7, 0.9, 3.0, 0.2, 0.18, 'brick', -0.04);
}

/** Blind arcade (six bays on a tower face) with white panels, the band that runs round the towers and aisles at 4.6-7.6 m. */
function arcade(k: Kit, f: ReturnType<typeof frame>, t0: number, t1: number) {
  const n = Math.floor((t1 - t0) / ARC_PITCH), s = (t1 - t0 - n * ARC_PITCH) / 2;
  for (let i = 0; i < n; i++) blindArch(k, f, t0 + s + ARC_PITCH * (i + 0.5));
  onWall(k, f, (t0 + t1) / 2, 7.85, t1 - t0 - 0.1, 0.35, 0.12, 'pink');
}

function tower(k: Kit, z0: number, z1: number, clocks: boolean) {
  const zc = (z0 + z1) / 2, w = z1 - z0, xc = (XT0 + XT1) / 2;
  extrude(k, rect(XT0, XT1, z0, z1), 0, TOWER_TOP - 0.8, 'brick');
  extrude(k, rect(XT0 - 0.3, XT1 + 0.3, z0 - 0.3, z1 + 0.3), TOWER_TOP - 0.8, TOWER_TOP, 'stone');
  const outer = z0 < 0 ? -1 : 1;
  // The south tower's outer face is hidden by the parish hall up to about 9 m.
  const faces: {fr: ReturnType<typeof face>; u: number; low: boolean; tall: boolean; clock: boolean}[] = [
    {fr: face([1, 0], XT1), u: zc, low: true, tall: true, clock: clocks},
    {fr: face([0, outer], outer < 0 ? z0 : z1), u: xc, low: outer > 0, tall: true, clock: clocks},
    {fr: face([0, -outer], outer < 0 ? z1 : z0), u: xc, low: false, tall: false, clock: false},
    {fr: face([-1, 0], XT0), u: zc, low: false, tall: false, clock: false},
  ];
  for (const {fr, u, low, tall, clock} of faces) {
    const t = fr.at(u);
    if (low) {
      onWall(k, fr.f, t, 0, w - 0.1, 4.4, 0.12, 'concrete');
      arcade(k, fr.f, t - w / 2 + 0.3, t + w / 2 - 0.3);
      for (const s of [-1.9, 0, 1.9]) onWall(k, fr.f, t + s, 9.3, 0.36, 1.5, 0.08, 'dark');
    }
    // Three tall windows in round-headed recesses between brick strips, the chequered band, the clock.
    if (tall) for (const s of [-1.9, 0, 1.9]) {
      archBand(k, fr.f, t + s, 11.6, 1.5, 9.0, 0.35, 0.1, 'greyBrick', -0.04);
      win(k, fr.f, t + s, {w: 0.8, y0: 13.2, y1: 19.6, bars: 1, rowM: 0.8, surround: 'brick', bar: 'frame'});
    }
    onWall(k, fr.f, t, 20.9, w - 0.1, 0.9, 0.08, 'pink');
    if (clock) clockFace(k, fr.f, t, 22.6, 0.95);
    // Belfry: five round-headed openings on colonnettes.
    const nb = low || tall ? 2 : 1; // inner and back faces: three openings (photos show only the front and outer faces; with five, the audit read the opening beside the front gable as overhanging)
    for (let i = -nb; i <= nb; i++) {
      archSlab(k, fr.f, t + i * BELL_PITCH, 23.8, 0.8, 4.0, 0.1, 'dark', -0.06);
      if (i < nb) onWall(k, fr.f, t + (i + 0.5) * BELL_PITCH, 23.8, 0.22, 3.2, 0.14, 'stone');
    }
    onWall(k, fr.f, t, 23.5, 6.0, 0.3, 0.16, 'stone');
    onWall(k, fr.f, t, 27.9, w - 0.1, 0.35, 0.14, 'pink');
  }
  // Striped helm: square ogive in brick with light stone bands, ball and cross.
  const HELM = 8.8, prof: [number, number][] = [[3.2, 0], [3.1, 1.5], [2.8, 3.0], [2.3, 4.5], [1.65, 6.0], [0.95, 7.3], [0.4, 8.3], [0.12, HELM]];
  const r = (y: number) => { for (let i = 1; i < prof.length; i++) if (y <= prof[i][1]) { const [a, b] = [prof[i - 1], prof[i]]; return a[0] + (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]); } return 0.12; };
  let y = 0, band = 0;
  while (y < HELM - 1e-6) {
    const h = band % 2 ? 0.3 : 0.9, y1 = Math.min(HELM, y + h);
    const pts: [number, number][] = [[r(y), TOWER_TOP + y], [r((y + y1) / 2), TOWER_TOP + (y + y1) / 2], [r(y1), TOWER_TOP + y1]];
    if (y1 >= HELM) pts.push([0, TOWER_TOP + y1]);
    lathe(k, xc, zc, pts, band % 2 ? 'stone' : 'brick', 4);
    y = y1; band++;
  }
  lathe(k, xc, zc, [[0.02, TOWER_TOP + HELM - 0.05], [0.28, TOWER_TOP + HELM + 0.15], [0.3, TOWER_TOP + HELM + 0.3], [0.2, TOWER_TOP + HELM + 0.5], [0.02, TOWER_TOP + HELM + 0.6]], 'gold', 10);
  block(k, xc - 0.07, xc + 0.07, zc - 0.07, zc + 0.07, TOWER_TOP + HELM + 0.55, TOWER_TOP + HELM + 2.0, 'gold');
  block(k, xc - 0.07, xc + 0.07, zc - 0.45, zc + 0.45, TOWER_TOP + HELM + 1.3, TOWER_TOP + HELM + 1.44, 'gold');
}

/** Lean-to roof from the outer eave at z = zo (y0) up to the wall at z = zi (y1), between x0 and x1. */
function leanTo(k: Kit, x0: number, x1: number, zo: number, zi: number, y0: number, y1: number, c: Col = 'slate') {
  tris(k, [[[x0, y0, zo], [x1, y0, zo], [x1, y1, zi]], [[x0, y0, zo], [x1, y1, zi], [x0, y1, zi]]], c, (_c, n) => n.y > 0);
  for (const [x, s] of [[x0, -1], [x1, 1]] as const) tris(k, [[[x, y0, zo], [x, y1, zi], [x, y0, zi]]], 'brick', (_c, n) => n.x * s > 0);
}

const AISLE_WIN: Win = {w: 0.9, y0: 2.2, y1: 3.9, head: 'flat', bars: 1, rowM: 0.9, surround: 'stone', bar: 'frame'};
const CLERE: Win = {w: 0.9, y0: 14.0, y1: 16.6, bars: 1, rowM: 0.9, surround: 'brick', bar: 'frame'};
const TRANS: Win = {w: 1.1, y0: 7.0, y1: 14.0, bars: 1, rowM: 1.0, surround: 'brick', bar: 'frame'};
const APSE: Win = {w: 1.0, y0: 6.4, y1: 11.4, bars: 1, rowM: 0.9, surround: 'brick', bar: 'frame'};

export function buildObrechtkerk(_w: number, _d: number, b: BuildingTools) {
  const k = localB(b, 22.4);

  // ---- Nave, aisles, crossing, transepts, chancel, chapels ----------------------------------------------------------
  extrude(k, rect(XC1, XF - 0.6, ZN0, ZN1), 0, EAVE, 'brick');
  extrude(k, rect(XC0, XC1, ZN0, ZN1), 0, 26, 'brick');
  extrude(k, rect(XC0, XC1, -17.2, ZN0), 0, EAVE, 'brick');
  extrude(k, rect(XC0, XC1, ZN1, 20.2), 0, EAVE, 'brick');
  extrude(k, rect(XA, XC0, ZN0, ZN1), 0, EAVE, 'brick');
  extrude(k, rect(9.8, XT0, -9.95, ZN0), 0, 9.3, 'brick');
  extrude(k, rect(9.4, XT0, ZN1, 14.25), 0, 9.8, 'brick');
  extrude(k, rect(27.6, 32.8, -11.9, -9.95), 0, 6.5, 'brick');
  extrude(k, rect(XC1, 9.8, -17.0, ZN0), 0, 10.7, 'brick');
  extrude(k, rect(XC1, 9.4, ZN1, 20.6), 0, 9.7, 'brick');
  extrude(k, rect(-20.4, XC0, 13.0, 22.3), 0, 8.9, 'brick');
  extrude(k, rect(-20.0, XC0, -20.1, -11.4), 0, 9.6, 'brick');
  // Sacristies between the chancel and the west chapels.
  extrude(k, rect(-16.3, XC0, -11.4, ZN0), 0, 10.5, 'brick');
  extrude(k, rect(-16.6, XC0, ZN1, 13.0), 0, 10.8, 'brick');
  // Apse: half of a 14-sided polygon.
  const R = 6.4, apse: V2[] = [];
  for (let i = 0; i <= 7; i++) { const a = Math.PI / 2 + i * Math.PI / 7; apse.push([XA + R * Math.cos(a), ZC - R * Math.sin(a)]); }
  extrude(k, apse, 0, 14, 'brick');
  // Stair turrets in the angles behind the transepts.
  lathe(k, -14.9, 10.6, [[2.4, 0], [2.4, 12.6], [2.6, 12.7], [2.6, 13.0], [0, 15.6]], 'brick', 12);
  lathe(k, -15.4, -8.1, [[1.8, 0], [1.8, 11.6], [2.0, 11.7], [2.0, 12.0], [0, 14.2]], 'brick', 12);

  // ---- Roofs from intent -------------------------------------------------------------------------------------------
  extrude(k, rect(XC1, XF - 0.3, ZN0 - 0.3, ZN1 + 0.3), EAVE - 0.4, EAVE, 'stone');
  gable(k, XC1, XF - 0.6, ZN0 - 0.3, ZN1 + 0.3, EAVE, RIDGE - EAVE, 'x', 'slate', 'brick');
  for (const [z0, z1] of [[-17.2, ZN0], [ZN1, 20.2]]) {
    extrude(k, rect(XC0 - 0.3, XC1 + 0.3, z0 - (z0 < 0 ? 0.3 : 0), z1 + (z1 > 10 ? 0.3 : 0)), EAVE - 0.4, EAVE - 0.02, 'stone');
    gable(k, XC0 - 0.3, XC1 + 0.3, z0, z1, EAVE, RIDGE - EAVE - 0.3, 'z', 'slate', 'brick');
  }
  extrude(k, rect(XA - 0.3, XC0, ZN0 - 0.3, ZN1 + 0.3), EAVE - 0.4, EAVE - 0.02, 'stone');
  gable(k, XA, XC0, ZN0 - 0.3, ZN1 + 0.3, EAVE, RIDGE - EAVE - 0.2, 'x', 'slate', 'brick');
  // Apse roof: a half cone of facets to the chancel end wall.
  const top: [number, number, number] = [XA, 21.0, ZC];
  for (let i = 0; i < 7; i++) tris(k, [[[apse[i][0], 14, apse[i][1]], [apse[i + 1][0], 14, apse[i + 1][1]], top]], 'slate', (_c, n) => n.y > 0);
  // Crossing tower: cornice and steep pyramid; three small windows a face.
  extrude(k, rect(XC0 - 0.3, XC1 + 0.3, ZN0 - 0.3, ZN1 + 0.3), 25.6, 26, 'stone');
  hipRoof(k, XC0 - 0.3, XC1 + 0.3, ZN0 - 0.3, ZN1 + 0.3, 26, 9.4, 'slate');
  for (const [n, plane, u] of [[[1, 0], XC1, ZC], [[-1, 0], XC0, ZC], [[0, 1], ZN1, (XC0 + XC1) / 2], [[0, -1], ZN0, (XC0 + XC1) / 2]] as [V2, number, number][]) {
    const fr = face(n, plane);
    for (const s of [-2.4, 0, 2.4]) win(k, fr.f, fr.at(u) + s, {w: 0.8, y0: 21.8, y1: 24.6, bars: 1, rowM: 0.8, surround: 'brick', bar: 'frame'});
    onWall(k, fr.f, fr.at(u), 20.8, 11.7, 0.5, 0.12, 'pink');
  }
  leanTo(k, 9.8, XT0, -9.95, ZN0, 9.3, 13.0);
  leanTo(k, 9.4, XT0, 14.25, ZN1, 9.8, 12.8);
  block(k, 27.6, 32.8, -11.9, -9.95, 6.5, 6.8, 'slate');
  hipRoof(k, XC1, 9.8, -17.0, ZN0, 10.7, 1.6, 'slate');
  hipRoof(k, XC1, 9.4, ZN1, 20.6, 9.7, 2.6, 'slate');
  hipRoof(k, -20.4, XC0, 13.0, 22.3, 8.9, 3.0, 'slate');
  leanTo(k, -16.3, XC0, -11.4, ZN0, 10.5, 12.4);
  leanTo(k, -16.6, XC0, 13.0, ZN1, 10.8, 12.8);
  hipRoof(k, -20.0, XC0, -20.1, -11.4, 9.6, 2.6, 'slate');

  // ---- Windows on the body ---------------------------------------------------------------------------------------
  const bays = [12.4, 16.6, 20.8, 25.0, 29.2];
  for (const [n, plane] of [[[0, -1], ZN0], [[0, 1], ZN1]] as [V2, number][]) {
    const fr = face(n, plane);
    for (const x of bays) for (const s of [-0.65, 0.65]) win(k, fr.f, fr.at(x + s), CLERE);
  }
  for (const [n, plane, x0] of [[[0, -1], -9.95, 9.8], [[0, 1], 14.25, 9.4]] as [V2, number, number][]) {
    const fr = face(n, plane), t0 = fr.at(x0), t1 = fr.at(XT0);
    arcade(k, fr.f, Math.min(t0, t1) + 0.3, Math.max(t0, t1) - 0.3);
    for (const x of bays) win(k, fr.f, fr.at(x), AISLE_WIN);
  }
  for (const [n, plane] of [[[0, -1], -17.2], [[0, 1], 20.2]] as [V2, number][]) {
    const fr = face(n, plane), t = fr.at((XC0 + XC1) / 2);
    for (const s of [-2.2, 0, 2.2]) win(k, fr.f, t + s, TRANS);
    disc(k, fr.f, t, 19.6, 1.0, 0.1, 'glass', -0.04);
    ringSlab(k, fr.f, t, 19.6, 1.0, 1.35, 0.12, 'stone', -0.04);
  }
  for (let i = 1; i < 6; i++) {
    const [a, c] = [apse[i], apse[i + 1]], mid: V2 = [(a[0] + c[0]) / 2, (a[1] + c[1]) / 2];
    const len = Math.hypot(mid[0] - XA, mid[1] - ZC), n: V2 = [(mid[0] - XA) / len, (mid[1] - ZC) / len];
    win(k, frame([mid[0] - n[0] * 0.02, mid[1] - n[1] * 0.02], n), 0, APSE);
  }

  // ---- Towered front --------------------------------------------------------------------------------------------
  tower(k, ZTA[0], ZTA[1], true);
  tower(k, ZTB[0], ZTB[1], false);
  extrude(k, rect(XF - 0.6, XF, ZN0 - 0.1, ZN1 + 0.1), 0, 20.6, 'brick');
  const fr = face([1, 0], XF), tc = fr.at(ZC), W = ZN1 - ZN0;
  onWall(k, fr.f, tc, 0, W - 0.1, 0.9, 0.3, 'concrete'); // steps
  // Portal: two wooden doors under a light tympanum, a banded arch and a gabled hood.
  for (const s of [-1, 1]) onWall(k, fr.f, tc + s * 1.25, 0.9, 2.1, 4.5, 0.08, 'ochre');
  onWall(k, fr.f, tc, 0.9, 0.4, 4.5, 0.14, 'white');
  archSlab(k, fr.f, tc, 5.4, 5.2, 2.6, 0.1, 'white', -0.04);
  onWall(k, fr.f, tc, 5.4, 5.2, 0.3, 0.12, 'white');
  for (const s of [-1, 1]) onWall(k, fr.f, tc + s * 2.95, 0.9, 0.7, 4.5, 0.2, 'white');
  archBand(k, fr.f, tc, 5.4, 7.2, 3.6, 1.0, 0.3, 'red', -0.04);
  poly(k, fr.f, tc, 9.2, [[-4.6, 0], [4.6, 0], [0, 4.4]], 0.35, 'pink', -0.04);
  disc(k, fr.f, tc, 14.1, 0.45, 0.25, 'gold', 0);
  // Rose window: glass disc with a five-circle star, moulded rings.
  disc(k, fr.f, tc, 17.2, 3.0, 0.08, 'glass', -0.04);
  ringSlab(k, fr.f, tc, 17.2, 3.0, 3.5, 0.22, 'stone', -0.04);
  ringSlab(k, fr.f, tc, 17.2, 3.5, 4.1, 0.12, 'pink', -0.04);
  ringSlab(k, fr.f, tc, 17.2, 0.95, 1.15, 0.12, 'dark', -0.04);
  for (let i = 0; i < 5; i++) { const a = Math.PI / 2 + i * 2 * Math.PI / 5; ringSlab(k, fr.f, tc + 1.95 * Math.cos(a), 17.2 + 1.95 * Math.sin(a), 0.78, 0.95, 0.12, 'dark', -0.04); }
  // Gable: diamond-patterned brick between stone copings, mosaic at the apex.
  onWall(k, fr.f, tc, 20.3, W - 0.1, 0.3, 0.14, 'stone');
  poly(k, fr.f, tc, 20.6, [[-W / 2, 0], [W / 2, 0], [0, 4.6]], 0.6, 'brick', -0.6);
  poly(k, fr.f, tc, 20.75, [[-W / 2 + 0.6, 0], [W / 2 - 0.6, 0], [0, 4.05]], 0.05, 'pink', 0);
  poly(k, fr.f, tc, 23.0, [[-1.6, 0], [1.6, 0], [0, 1.65]], 0.12, 'gold', 0);
  block(k, XF - 0.5, XF - 0.1, ZC - 0.3, ZC + 0.3, 25.1, 25.9, 'stone');
  // Side bays of the centre front: a small door under one arch of the arcade, either side of the portal.
  for (const s of [-1, 1]) {
    door(k, fr.f, tc + s * 4.75, {w: 1.0, y0: 0.9, y1: 3.4, leaf: 'ochre', surround: 'stone'});
    blindArch(k, fr.f, tc + s * 4.75);
  }

  // ---- Parish hall forward of the south tower ----------------------------------------------------------------------
  const H0 = 33.0, H1 = 49.2, HZ0 = -22.1, HZ1 = -9.6;
  extrude(k, rect(H0, H1, HZ0, HZ1), 0, 8.6, 'brick');
  gable(k, H0, H1, HZ0 - 0.3, HZ1 + 0.3, 8.6, 9.2, 'x', 'red', 'brick');
  {
    const hf = face([1, 0], H1), t = hf.at((HZ0 + HZ1) / 2);
    win(k, hf.f, t, {w: 4.4, y0: 9.2, y1: 14.2, head: 'flat', bars: 3, rowM: 1.25, surround: 'stone', bar: 'frame'});
    for (const [s, w] of [[-3.3, 1.5], [0, 2.6], [3.3, 1.5]]) win(k, hf.f, t + s, {w, y0: 1.5, y1: 4.9, head: 'flat', bars: w > 2 ? 2 : 1, rowM: 1.1, surround: 'stone', bar: 'frame'});
    ringSlab(k, hf.f, t, 7.2, 0.35, 0.6, 0.12, 'stone', -0.04);
    disc(k, hf.f, t, 15.6, 0.9, 0.08, 'gold', -0.04);
  }
  for (const [n, plane, xs] of [[[0, -1], HZ0, [36.0, 40.0, 44.0]], [[0, 1], HZ1, [42.5, 46.0]]] as [V2, number, number[]][]) {
    const hf = face(n, plane);
    for (const x of xs) win(k, hf.f, hf.at(x), {w: 1.5, y0: 1.5, y1: 4.9, head: 'flat', bars: 1, rowM: 1.1, surround: 'stone', bar: 'frame'});
  }
  door(k, face([0, 1], HZ1).f, face([0, 1], HZ1).at(44.25), {w: 1.1, y1: 2.6, leaf: 'dark', surround: 'stone'});
}
