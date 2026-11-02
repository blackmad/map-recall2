import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {local, extrude, onWall, tris, win, hipRoof, type Kit, type V2, type Col} from './church-kit';
import {slab, poly, put, letters, disc, ringSlab, type Frame} from './nearbar-kit';
import {neckGable, type NeckGableSpec} from './neck-gable';
import {addShell, type Surface} from './worship-shell';
import source from './barbizon-palace-footprints.json';

/**
 * NH Collection Barbizon Palace, Prins Hendrikkade 59 and 66-72 (opposite Amsterdam Centraal): the 1988 hotel (BAG pand
 * 0363100012165693) with the five historic fronts it took in on the Prins Hendrikkade, PH 72 (0363100012182721, a neck
 * gable with oeil-de-boeuf windows), 69 (0363100012182719, white cornice), 68 (0363100012182720, dentil cornice, dark
 * window frames), 67 (0363100012182718, hipped tent roof) and 66 (0363100012171455, a small neck gable). The hotel VBO
 * (PH 59) also lies in eight panden behind the Zeedijk fronts (165688, 171654, 177880 In 't Aepjen, 182723, 182724,
 * 182820, 182821, 249789); those keep their own addressed Zeedijk fronts and are not part of this model. The
 * Sint-Olofskapel across the Zeedijk is its own model (`sint-olofskapel`).
 *
 * Front frame (church-kit `local`, barbizon-palace-footprints.json): x along the Prins Hendrikkade front from the PH 72 /
 * 73 party corner (Sint-Nicolaas side) to the west end of the hotel, z out of the front towards the street, y up from the
 * pavement (2.29 NAP). Openings, cornices and gables were read on the rectified strip of the 2025-01-14 Gemeente
 * Amsterdam panoramas b_20250114_1026_Track01_Sphere_00060-00068 (40 px/m, CC BY 4.0); the hotel's canopy, oriels, roof
 * lettering and logo also on recording_2025-06-17_08-04-10_03792. Photo positions are mapped per house onto the BAG
 * party lines (`PHOTO`). Massing of the 1988 hotel is its 3DBAG LoD2.2 shell (CC BY 4.0); the historic houses are built
 * on their BAG rings with the roof each front shows. Inventory: barbizon-palace-inventory.json.
 */
type Pand = {ringFront: number[][]; shellNative: Surface[]};
const P = source.pands as unknown as Record<string, Pand>;
export const AXIS_DEG = source.axisDeg;
export const ORIGIN: V2 = source.origin as V2;
const HOTEL = '0363100012165693';

/** Photo spans (rectified strip, metres along the front) and BAG spans of each front, viewer's left to right. */
const PHOTO: {pand: string; photo: [number, number]; bag: [number, number]}[] = [
  {pand: '0363100012182721', photo: [0, 5.4], bag: [0, 5.75]}, // PH 72
  {pand: '0363100012182719', photo: [5.4, 11.0], bag: [5.75, 11.32]}, // PH 69
  {pand: '0363100012182720', photo: [11.0, 17.0], bag: [11.32, 16.94]}, // PH 68
  {pand: '0363100012182718', photo: [17.0, 21.6], bag: [16.94, 22.0]}, // PH 67
  {pand: '0363100012171455', photo: [21.6, 25.8], bag: [22.0, 25.94]}, // PH 66
  {pand: HOTEL, photo: [25.8, 48.0], bag: [25.94, 47.97]}, // PH 59 (1988)
];
/** Photo t -> model t, piecewise linear per front. */
export function ph(t: number): number {
  const s = PHOTO.find(p => t <= p.photo[1] + 1e-9) ?? PHOTO[PHOTO.length - 1];
  return s.bag[0] + (t - s.photo[0]) * (s.bag[1] - s.bag[0]) / (s.photo[1] - s.photo[0]);
}
const scaleOf = (pand: string) => { const s = PHOTO.find(p => p.pand === pand)!; return (s.bag[1] - s.bag[0]) / (s.photo[1] - s.photo[0]); };

/** Least-squares front line z = a + c x of a pand (ring vertices within 1 m of the street line). */
function frontLine(pand: string, x0: number, x1: number): {a: number; c: number} {
  const pts = P[pand].ringFront.filter(p => p[1] > -1 && p[0] >= x0 - 0.3 && p[0] <= x1 + 0.3);
  const n = pts.length, mx = pts.reduce((s, p) => s + p[0], 0) / n, mz = pts.reduce((s, p) => s + p[1], 0) / n;
  const sxx = pts.reduce((s, p) => s + (p[0] - mx) ** 2, 0), sxz = pts.reduce((s, p) => s + (p[0] - mx) * (p[1] - mz), 0);
  const c = sxx > 1e-6 ? sxz / sxx : 0;
  return {a: mz - c * mx, c};
}
/** Wall frame on a front line, t ~ x (the lines tilt < 0.6 degrees), `off` metres out of the wall. */
const lineFrame = (l: {a: number; c: number}, off = 0): Frame => {
  const L = Math.hypot(1, l.c), n: V2 = [-l.c / L, 1 / L];
  return {origin: [n[0] * off, l.a + n[1] * off], n, tangent: [n[1], -n[0]]};
};

/** Sutherland-Hodgman clip of a ring to the half plane out <= lim behind a front line. */
function clipBehind(ring: V2[], l: {a: number; c: number}, lim: number): V2[] {
  const out = (p: V2) => p[1] - (l.a + l.c * p[0]);
  const res: V2[] = [];
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i], b = ring[(i + 1) % ring.length], ia = out(a) <= lim, ib = out(b) <= lim;
    if (ia !== ib) { const u = (lim - out(a)) / (out(b) - out(a)); res.push([a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u]); }
    if (ib) res.push(b);
  }
  return res;
}
const ringOf = (pand: string): V2[] => P[pand].ringFront.map(p => [p[0], p[1]] as V2);

/**
 * Saddle with its ridge along z (front to back), closed by gable triangles at both ends. The front end follows the
 * (slightly tilted) front line 5 cm behind the back of the front wall, where the neck gable hides it.
 */
function saddleZ(k: Kit, x0: number, x1: number, zf: (x: number) => number, zb: number, eaves: number, ridge: number, gableCol: Col) {
  const xm = (x0 + x1) / 2, up = (_c: T.Vector3, n: T.Vector3) => n.y > 0, f0 = zf(x0), f1 = zf(x1), fm = zf(xm);
  tris(k, [[[x0, eaves, zb], [x0, eaves, f0], [xm, ridge, fm]], [[x0, eaves, zb], [xm, ridge, fm], [xm, ridge, zb]],
    [[x1, eaves, f1], [x1, eaves, zb], [xm, ridge, zb]], [[x1, eaves, f1], [xm, ridge, zb], [xm, ridge, fm]]], 'slate', up);
  tris(k, [[[x0, eaves, zb], [xm, ridge, zb], [x1, eaves, zb]]], gableCol, (_c, n) => n.z < 0);
  tris(k, [[[x0, eaves, f0], [xm, ridge, fm], [x1, eaves, f1]]], gableCol, (_c, n) => n.z > 0);
}

const sphere = (r: number, sx = 1, sy = 1, sz = 1) => new T.SphereGeometry(r, 6, 4).scale(sx, sy, sz);

/** Segmental crown on a neck gable: a flat segment of chord w and rise h standing on y, `d` deep from `out`. */
function segment(k: Kit, f: Frame, t: number, y: number, w: number, h: number, d: number, c: Col, out: number) {
  const pts: [number, number][] = [];
  const R = (w * w / 4 + h * h) / (2 * h), a0 = Math.asin(w / 2 / R);
  for (let i = 0; i <= 8; i++) { const a = -a0 + 2 * a0 * i / 8; pts.push([R * Math.sin(a), h - R + R * Math.cos(a)]); }
  poly(k, f, t, y, pts, d, c, out);
}

type Bay = {t: number; w: number};
function windowRows(k: Kit, f: Frame, bays: Bay[], rows: [number, number][], o: {surround: Col; bar: Col; bars: number; rowM: number}) {
  for (const [y0, y1] of rows) for (const b of bays) win(k, f, b.t, {w: b.w, y0, y1, head: 'flat', bars: o.bars, rowM: o.rowM, surround: o.surround, bar: o.bar, sill: 'white'});
}

export function buildBarbizonPalace(_w: number, _d: number, b: BuildingTools) {
  const k: Kit = local(b, AXIS_DEG, ORIGIN);

  // ---------------- the 1988 hotel: 3DBAG LoD2.2 shell ----------------
  addShell(b, {surfaces: P[HOTEL].shellNative, nativeRing: []}, {
    wall: 'greyBrick', roof: 'concrete',
    // sloped roof planes of the rear wings are tiled; the flat roofs read as pale membrane
    roofFor: s => { const r = s.rings[0], ys = r.map(p => p[1]); return Math.max(...ys) - Math.min(...ys) > 0.6 ? 'slate' : 'concrete'; },
  });

  // the enclosed 1741 back house (pand 0363100012249789, hotel use only) between the street panden and the Zeedijk: its 3DBAG
  // shell, brick under a tiled saddle roof; it is seen only from above
  addShell(b, {surfaces: P['0363100012249789'].shellNative, nativeRing: []}, {wall: 'brick', roof: 'slate'});

  // ---------------- historic houses: carcass behind a 0.5 m front wall, roofs as the fronts show ----------------
  type House = {pand: string; top: number; roof: (x0: number, x1: number, zb: number) => void};
  const lines = PHOTO.map(s => frontLine(s.pand, s.bag[0], s.bag[1]));
  const houses: House[] = [
    {pand: PHOTO[0].pand, top: 15.2, roof: (x0, x1, zb) => saddleZ(k, x0, x1, x => lines[0].a + lines[0].c * x - 0.55, zb, 12.6, 17.8, 'brick')},
    {pand: PHOTO[1].pand, top: 14.9, roof: () => undefined},
    {pand: PHOTO[2].pand, top: 15.0, roof: () => undefined},
    {pand: PHOTO[3].pand, top: 13.1, roof: (x0, x1, zb) => hipRoof(k, x0, x1, zb, lines[3].a + lines[3].c * x0 - 0.5, 13.1, 2.0, 'slate')},
    {pand: PHOTO[4].pand, top: 13.6, roof: (x0, x1, zb) => saddleZ(k, x0, x1, x => lines[4].a + lines[4].c * x - 0.55, zb, 12.3, 15.3, 'brick')},
  ];
  houses.forEach((h, i) => {
    const l = lines[i], [x0, x1] = PHOTO[i].bag;
    const ring = clipBehind(ringOf(h.pand), l, -0.5);
    const flat = h.top >= 14.8;
    const carcass = flat ? h.top : i === 3 ? 13.1 : i === 0 ? 12.6 : 12.3;
    extrude(k, ring, 0, carcass, 'brick');
    if (flat) extrude(k, ring, carcass, carcass + 0.12, 'slate');
    const zb = Math.max(...ring.filter(p => p[0] > x0 + 0.5 && p[0] < x1 - 0.5).map(p => p[1]).filter(z => z < -8), -16);
    h.roof(x0 + 0.02, x1 - 0.02, Math.min(zb, -12.5));
    // the front wall itself, 0.5 m deep behind the BAG front line
    slab(k, lineFrame(l), (x0 + x1) / 2, 0, x1 - x0, h.top, 0.5, 'brick', -0.5);
  });

  // ---------------- PH 72: neck gable with oeil-de-boeuf windows ----------------
  {
    const F = lineFrame(lines[0]), s = scaleOf(PHOTO[0].pand), X = ph, W = (w: number) => w * s;
    const S = (t: number, y: number, w: number, h: number, d: number, c: Col) => onWall(k, F, X(t), y, W(w), h, d, c);
    // white stone pui: pilasters, fascia, a cornice; three dark doorways
    S(2.7, 0, 5.32, 4.0, 0.05, 'stone');
    for (const [t0, t1] of [[0.15, 1.15], [1.65, 3.0], [3.8, 5.0]]) S((t0 + t1) / 2, 0, t1 - t0, 2.25, 0.12, 'dark');
    for (const t of [1.4, 3.4]) S(t, 0, 0.36, 3.8, 0.16, 'stone');
    for (const t of [0.14, 5.26]) S(t, 0, 0.14, 3.8, 0.18, 'stone');
    S(2.7, 2.55, 5.4, 0.08, 0.12, 'white');
    S(2.7, 3.82, 5.5, 0.22, 0.24, 'stone');
    for (const t of [1.4, 3.4]) { // wall lanterns
      put(k, F, new T.BoxGeometry(0.04, 0.04, 0.35).translate(0, 0, 0.17), X(t), 2.75, 0.16, 'bronze');
      k.add(new T.BoxGeometry(0.2, 0.32, 0.2), 'white', X(t), 2.55, lines[0].a + 0.48);
      k.add(new T.ConeGeometry(0.17, 0.14, 4).rotateY(Math.PI / 4), 'bronze', X(t), 2.78, lines[0].a + 0.48);
    }
    const bays = [0.68, 2.46, 4.25].map(t => ({t: X(t), w: W(1.22)}));
    windowRows(k, F, bays, [[4.3, 7.25], [8.0, 10.2], [10.9, 12.9]], {surround: 'white', bar: 'white', bars: 2, rowM: 0.5});
    S(2.46, 7.5, 0.7, 0.4, 0.08, 'red'); // gable stone
    // shoulder storey: middle window, two round oculi with white rings
    win(k, F, X(2.46), {w: W(1.3), y0: 13.8, y1: 15.05, head: 'flat', bars: 2, rowM: 0.45, surround: 'white', bar: 'white', sill: 'white'});
    for (const t of [0.68, 4.25]) {
      ringSlab(k, F, X(t), 14.25, 0.3, 0.46, 0.14, 'white', -0.04, 14);
      disc(k, F, X(t), 14.25, 0.31, 0.1, 'glass', -0.04);
    }
    const g: NeckGableSpec = {x0: X(0), x1: X(5.4), axis: X(2.46), neckHalf: W(1.18), shoulderY: 15.2, clawTopY: 17.4, corniceY: 19.35, corniceH: 0.3, corniceHalf: W(1.5), apexY: 19.75, thick: 0.5};
    neckGable(k, F, g, {wall: 'brick', trim: 'stone'});
    // white carved claws over the brick claw solids, the segmental crown and the carved cartouche on the neck
    for (const side of [-1, 1] as const) {
      const edge = side < 0 ? g.x0 : g.x1, neck = g.axis + side * g.neckHalf, pts: [number, number][] = [[edge, 15.2]];
      for (let i = 1; i <= 8; i++) { const a = i / 8 * Math.PI / 2; pts.push([edge + (neck - edge) * Math.sin(a), 15.2 + 2.2 * (1 - Math.cos(a))]); }
      pts.push([neck, 15.2]);
      const ccw = pts.reduce((s2, p, j) => { const q = pts[(j + 1) % pts.length]; return s2 + p[0] * q[1] - q[0] * p[1]; }, 0) > 0;
      poly(k, F, 0, 0, ccw ? pts : pts.reverse(), 0.1, 'stone', -0.04);
      for (const [dt, dy, r] of [[0.35, 0.6, 0.16], [0.15, 1.3, 0.14], [0.05, 1.9, 0.12]] as const) put(k, F, sphere(r, 1, 1, 0.6), neck - side * dt, 15.2 + dy, 0.06, 'stone');
    }
    segment(k, F, g.axis, 19.6, W(2.9), 0.6, 0.5, 'stone', -0.45);
    for (const [dt, dy, r, sx] of [[0, 18.6, 0.32, 1.3], [-0.42, 18.25, 0.18, 1], [0.42, 18.25, 0.18, 1], [0, 19.05, 0.2, 1.6], [-0.5, 17.9, 0.13, 1], [0.5, 17.9, 0.13, 1]] as const) put(k, F, sphere(r, sx, 1, 0.5), g.axis + dt, dy, 0.05, 'stone');
    S(2.46, 15.9, 0.75, 1.0, 0.07, 'dark'); // loft door in the neck
    S(2.46, 16.9, 0.95, 0.12, 0.14, 'stone');
    put(k, F, new T.BoxGeometry(0.18, 0.2, 0.8).translate(0, 0.1, 0.4), g.axis, 17.2, 0, 'frame'); // hoist beam
  }

  // ---------------- PH 69: white cornice, white sashes ----------------
  {
    const F = lineFrame(lines[1]), s = scaleOf(PHOTO[1].pand), X = ph, W = (w: number) => w * s;
    const S = (t: number, y: number, w: number, h: number, d: number, c: Col) => onWall(k, F, X(t), y, W(w), h, d, c);
    S(8.2, 0, 5.5, 3.0, 0.05, 'stone');
    for (const [t0, t1] of [[5.92, 6.74], [7.05, 7.92]]) { S((t0 + t1) / 2, 0, t1 - t0, 2.2, 0.12, 'dark'); S((t0 + t1) / 2, 2.3, t1 - t0, 0.55, 0.12, 'glass'); S((t0 + t1) / 2, 2.52, t1 - t0, 0.06, 0.18, 'white'); }
    for (const [t0, t1] of [[8.36, 9.3], [9.74, 10.8]]) { S((t0 + t1) / 2, 0.5, t1 - t0, 2.4, 0.12, 'glass'); S((t0 + t1) / 2, 0.5, 0.05, 2.4, 0.18, 'white'); }
    for (const t of [5.52, 6.9, 7.98, 8.0 + 1.08 + 0.45, 10.8]) S(t, 0, 0.18, 3.0, 0.2, 'white');
    S(8.2, 2.95, 5.6, 0.2, 0.26, 'white');
    windowRows(k, F, [6.5, 8.25, 10.0].map(t => ({t: X(t), w: W(1.28)})), [[3.6, 5.9], [6.4, 8.55], [9.0, 11.2], [11.7, 13.2]], {surround: 'white', bar: 'white', bars: 1, rowM: 0.6});
    S(8.2, 13.4, 5.6, 0.6, 0.08, 'white');
    S(8.2, 14.0, 5.6, 0.85, 0.35, 'stone');
    S(8.2, 14.85, 5.66, 0.15, 0.5, 'stone');
  }

  // ---------------- PH 68: dentil cornice, dark-framed windows ----------------
  {
    const F = lineFrame(lines[2]), s = scaleOf(PHOTO[2].pand), X = ph, W = (w: number) => w * s;
    const S = (t: number, y: number, w: number, h: number, d: number, c: Col) => onWall(k, F, X(t), y, W(w), h, d, c);
    // door with a white surround and transom light, two shop windows
    S(11.88, 0, 0.85, 2.85, 0.08, 'dark');
    S(11.88, 2.95, 0.85, 0.65, 0.06, 'glass');
    for (const t of [11.28, 12.48]) S(t, 0, 0.2, 3.9, 0.14, 'white');
    S(11.88, 3.65, 1.4, 0.25, 0.16, 'white');
    for (const [t0, t1] of [[13.4, 14.7], [15.2, 16.6]]) { S((t0 + t1) / 2, 0.9, t1 - t0, 2.6, 0.07, 'glass'); S((t0 + t1) / 2, 0.75, t1 - t0 + 0.2, 0.15, 0.16, 'frame'); S((t0 + t1) / 2, 2.7, t1 - t0, 0.06, 0.12, 'frame'); }
    windowRows(k, F, [12.25, 14.05, 15.9].map(t => ({t: X(t), w: W(1.3)})), [[4.25, 6.7], [8.0, 10.4], [10.9, 12.6]], {surround: 'frame', bar: 'frame', bars: 1, rowM: 1.2});
    S(14.05, 7.25, 0.6, 0.35, 0.08, 'stone'); // plaque
    S(14.0, 13.0, 6.0, 1.2, 0.08, 'white');
    S(14.0, 14.2, 6.0, 0.3, 0.2, 'stone');
    for (let j = 0; j < 24; j++) S(11.15 + j * 0.25, 14.5, 0.12, 0.16, 0.3, 'stone'); // dentils
    S(14.0, 14.66, 6.0, 0.64, 0.42, 'stone');
    // chimney on the roof just behind the cornice
    k.add(new T.BoxGeometry(0.6, 1.1, 0.6), 'brick', X(14.3), 15.45, lines[2].a + lines[2].c * X(14.3) - 1.1);
  }

  // ---------------- PH 67: pale pui, white cornice band, hipped tent roof ----------------
  {
    const F = lineFrame(lines[3]), s = scaleOf(PHOTO[3].pand), X = ph, W = (w: number) => w * s;
    const S = (t: number, y: number, w: number, h: number, d: number, c: Col) => onWall(k, F, X(t), y, W(w), h, d, c);
    S(19.3, 0, 4.5, 3.1, 0.05, 'stone');
    for (const [t0, t1] of [[17.5, 18.4], [18.9, 19.8], [20.2, 21.0]]) S((t0 + t1) / 2, 0.5, t1 - t0, 1.9, 0.12, 'dark');
    S(19.3, 2.95, 4.7, 0.18, 0.18, 'stone');
    windowRows(k, F, [17.95, 19.4, 20.8].map(t => ({t: X(t), w: W(0.95)})), [[3.5, 5.6], [6.4, 8.6], [9.6, 11.6]], {surround: 'white', bar: 'frame', bars: 1, rowM: 1.0});
    S(19.3, 12.0, 4.6, 0.85, 0.08, 'white');
    S(19.3, 12.85, 4.66, 0.31, 0.35, 'stone');
  }

  // ---------------- PH 66: small neck gable, shopfront ----------------
  {
    const F = lineFrame(lines[4]), s = scaleOf(PHOTO[4].pand), X = ph, W = (w: number) => w * s;
    const S = (t: number, y: number, w: number, h: number, d: number, c: Col) => onWall(k, F, X(t), y, W(w), h, d, c);
    S(23.7, 0.3, 3.9, 3.1, 0.07, 'glass');
    for (const t of [21.68, 22.6, 23.3, 24.2, 25.0, 25.72]) S(t, 0, 0.12, 3.5, 0.14, 'white');
    S(23.7, 0, 4.0, 0.3, 0.12, 'stone');
    S(23.7, 3.5, 4.1, 0.38, 0.22, 'white');
    windowRows(k, F, [22.45, 23.75, 25.07].map(t => ({t: X(t), w: W(0.85)})), [[4.2, 6.4], [7.05, 8.8], [9.45, 10.95], [11.8, 13.1]], {surround: 'white', bar: 'frame', bars: 1, rowM: 1.0});
    const g: NeckGableSpec = {x0: X(21.6), x1: X(25.8), axis: X(23.8), neckHalf: W(0.8), shoulderY: 13.6, clawTopY: 15.2, corniceY: 15.75, corniceH: 0.22, corniceHalf: W(0.95), apexY: 16.05, thick: 0.5};
    neckGable(k, F, g, {wall: 'brick', trim: 'stone'});
    segment(k, F, g.axis, 15.92, W(1.85), 0.45, 0.5, 'stone', -0.45);
    win(k, F, g.axis, {w: W(0.95), y0: 13.5, y1: 14.5, head: 'flat', bars: 1, rowM: 0.5, surround: 'white', bar: 'frame', sill: 'white'});
    for (const side of [-1, 1]) put(k, F, sphere(0.12, 1, 1, 0.6), g.axis + side * (g.neckHalf + 0.12), 14.9, 0.06, 'stone');
  }

  // ---------------- PH 59: the 1988 hotel front ----------------
  {
    const l = frontLine(HOTEL, 25.94, 47.97), F = lineFrame(l), X = ph;
    const S = (t: number, y: number, w: number, h: number, d: number, c: Col, f: Frame = F) => onWall(k, f, X(t), y, w, h, d, c);
    const x0 = 25.94, x1 = 47.97, xm = (x0 + x1) / 2;
    // ground floor: recessed dark glazing behind round white columns
    onWall(k, F, xm, 0, x1 - x0, 3.4, 0.14, 'glass');
    for (let t = x0 + 1.15; t < x1 - 0.5; t += 1.15) onWall(k, F, t, 0, 0.08, 3.4, 0.2, 'frame'); // mullions
    for (const t of [26.3, 30.9, 34.9, 39.0, 43.1, 47.6]) put(k, F, new T.CylinderGeometry(0.22, 0.22, 3.4, 10).translate(0, 1.7, 0.34), X(t), 0, 0, 'stone');
    // canopy over the entrance (t 26-38.6): dark slate fascia, 3.2 m deep, lettering on its front
    const c0 = X(26.0), c1 = X(38.6), depth = 3.2;
    onWall(k, F, (c0 + c1) / 2, 3.4, c1 - c0, 0.8, depth, 'blue');
    const FC: Frame = lineFrame(l, depth);
    letters(k, FC, 'NH COLLECTION', X(30.6), 3.58, -0.02, 0.065, 0.08, 'white');
    letters(k, FC, 'BARBIZON PALACE', X(35.9), 3.6, -0.02, 0.042, 0.08, 'white');
    // the rest of the ground floor: a pale stone fascia
    onWall(k, F, (c1 + x1) / 2, 3.4, x1 - c1, 0.65, 0.3, 'stone');
    // the parapet coping; the grey sill bands run across the stacks only, the lit brick piers between them carry none
    onWall(k, F, xm, 18.05, x1 - x0, 0.2, 0.12, 'concrete');
    const rows: [number, number][] = [[4.6, 6.5], [7.1, 9.3], [9.9, 12.1], [12.7, 14.9], [15.5, 17.6]];
    type Stack = {t0: number; t1: number; wins: number[]; oriel: boolean; cap: number};
    // pair centres measured on the strip (photo t): 28.1, 32.25, 36.5, 40.8, 45.05
    const stacks: Stack[] = [
      {t0: 26.7, t1: 29.7, wins: [27.35, 28.85], oriel: false, cap: 17.9},
      {t0: 30.55, t1: 33.95, wins: [31.45, 33.05], oriel: true, cap: 19.3},
      {t0: 34.8, t1: 38.2, wins: [35.7, 37.3], oriel: true, cap: 19.3},
      {t0: 39.1, t1: 42.4, wins: [40.0, 41.5], oriel: false, cap: 18.9},
      {t0: 43.4, t1: 46.7, wins: [44.3, 45.8], oriel: false, cap: 18.9},
    ];
    for (const st of stacks) {
      const a = X(st.t0), z = X(st.t1), m = (a + z) / 2, w = z - a, proj = st.oriel ? 0.55 : 0;
      if (st.oriel) {
        // projecting brick stack on stone sill slabs, the windows on its face
        onWall(k, F, m, 4.3, w, 18.05 - 4.3, proj, 'greyBrick');
        for (const [y0] of rows) onWall(k, F, m, y0 - 0.3, w + 0.66, 0.26, proj + 0.24, 'concrete');
        for (const s2 of [-1, 1]) onWall(k, F, m + s2 * (w / 2 + 0.06), 4.3, 0.24, 18.05 - 4.3, proj + 0.18, 'greyBrick');
      } else {
        for (const s2 of [-1, 1]) onWall(k, F, m + s2 * (w / 2 - 0.12), 4.3, 0.24, 18.05 - 4.3, 0.24, 'greyBrick');
        for (const [y0] of rows) onWall(k, F, m, y0 - 0.3, w - 0.48, 0.26, 0.2, 'concrete');
      }
      const FS = proj ? lineFrame(l, proj) : F;
      for (const [y0, y1] of rows) for (const t of st.wins) win(k, FS, X(t), {w: 0.95, y0, y1, head: 'flat', bars: 0, rowM: 1.1, surround: 'white', bar: 'white', sill: 'concrete'});
      // stone cap box over the stack
      slab(k, F, m, 18.05, w + 0.2, st.cap - 18.05, proj + 0.1 + 1.2, 'concrete', -1.2);
    }
    // rooftop: BARBIZON PALACE on a dark rail, the round logo, flags
    const FR = lineFrame(l, -1.6); // behind the stack caps
    onWall(k, FR, X(38.2), 18.2, X(46.4) - X(30.0), 0.25, 0.12, 'bronze');
    for (let t = 30.4; t < 46.2; t += 2.0) onWall(k, FR, X(t), 18.2, 0.1, 0.3, 0.1, 'bronze');
    letters(k, FR, 'BARBIZON PALACE', X(38.2), 18.48, 0.02, 0.18, 0.1, 'stone', 0.22);
    const lt = X(28.4);
    for (const s2 of [-0.35, 0.35]) onWall(k, FR, lt + s2, 18.2, 0.08, 0.4, 0.08, 'bronze');
    disc(k, FR, lt, 19.3, 0.9, 0.16, 'red', 0.0);
    ringSlab(k, FR, lt, 19.3, 0.55, 0.65, 0.27, 'stone', 0.03, 20);
    ringSlab(k, FR, lt, 19.3, 0.28, 0.36, 0.27, 'stone', 0.03, 16);
    onWall(k, FR, lt, 18.62, 0.1, 1.36, 0.3, 'stone');
    for (const t of [29.6, 37.0, 42.0]) {
      const x = X(t), zf = l.a + l.c * x - 2.3;
      k.add(new T.CylinderGeometry(0.04, 0.05, 3.0, 6).translate(0, 1.5, 0), 'stone', x, 18.2, zf);
      k.add(new T.BoxGeometry(1.2, 0.75, 0.04), 'red', x - 0.62, 20.75, zf);
    }

    // ---------------- Zeedijk 9-11: the hotel's side front on the Zeedijk ----------------
    const r = ringOf(HOTEL);
    let best = -1, bd = Infinity;
    r.forEach((p, i) => { const q = r[(i + 1) % r.length], L = Math.hypot(q[0] - p[0], q[1] - p[1]); const d2 = Math.abs(L - 10.3) + Math.hypot((p[0] + q[0]) / 2 - 46.7, (p[1] + q[1]) / 2 + 38.3); if (d2 < bd) { bd = d2; best = i; } });
    const A = r[best], B = r[(best + 1) % r.length], len = Math.hypot(B[0] - A[0], B[1] - A[1]);
    const tg: V2 = [(B[0] - A[0]) / len, (B[1] - A[1]) / len], n: V2 = [-tg[1], tg[0]];
    // The 3DBAG walls on this edge stand 0 and 0.26 m behind the BAG line in two parts: the front is drawn as one brick
    // face 6 cm in front of the line, over both.
    const SET = -0.06, FZ: Frame = {origin: [A[0] - n[0] * SET, A[1] - n[1] * SET], n, tangent: tg};
    slab(k, FZ, len / 2, 0, len - 0.04, 17.45, 0.38, 'greyBrick', -0.38);
    const Z = (t: number, y: number, w: number, h: number, d: number, c: Col) => onWall(k, FZ, t, y, w, h, d, c);
    Z(len / 2, 3.4, len, 0.4, 0.1, 'stone');
    // Zeedijk 9 and 11 mirror about the drainpipe at mid-front (ref-zeedijk.jpg): red door under a glazed transom in a
    // pale frame at each end, and a louvre over a shop window either side of the middle.
    for (const t of [len * 0.2, len * 0.8]) {
      Z(t, 0, 1.3, 2.3, 0.08, 'red');
      Z(t, 2.45, 1.3, 0.75, 0.06, 'glass');
      for (const s2 of [-1, 1]) Z(t + s2 * 0.78, 0, 0.26, 3.3, 0.12, 'stone');
      Z(t, 2.3, 1.3, 0.15, 0.12, 'stone');
      Z(t, 3.2, 1.82, 0.15, 0.12, 'stone');
    }
    for (const t of [len * 0.4, len * 0.6]) {
      Z(t, 0.3, 0.8, 1.75, 0.06, 'glass');
      Z(t, 2.15, 0.8, 0.95, 0.06, 'frame');
      for (let j = 1; j < 6; j++) Z(t, 2.15 + j * 0.16, 0.8, 0.04, 0.1, 'stone');
      for (const s2 of [-1, 1]) Z(t + s2 * 0.47, 0.3, 0.14, 2.8, 0.1, 'stone');
    }
    Z(len / 2, 0, 0.1, 17.3, 0.14, 'concrete'); // drainpipe on the party line
    const zRows: [number, number][] = [[4.4, 6.6], [7.3, 9.5], [10.2, 12.4], [13.1, 15.3]];
    for (const [y0, y1] of zRows) {
      for (const t of [len * 0.25, len * 0.75]) {
        win(k, FZ, t, {w: 1.1, y0, y1, head: 'flat', bars: 1, rowM: 1.1, surround: 'white', bar: 'red', glass: 'glass', sill: 'stone'});
        Z(t, y0 + 0.9, 1.3, 0.05, 0.3, 'red');
        for (let j = 0; j <= 6; j++) Z(t - 0.6 + j * 0.2, y0, 0.03, 0.95, 0.3, 'red');
      }
      for (const t of [len * 0.08, len * 0.42, len * 0.58, len * 0.92]) win(k, FZ, t, {w: 0.65, y0: y0 + 0.9, y1: y0 + 2.0, head: 'flat', bars: 0, rowM: 2, surround: 'white', bar: 'white', sill: 'stone'});
    }
  }
}
