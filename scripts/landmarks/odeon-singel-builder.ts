import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {local, extrude, frame, onWall, tris, win, type Kit, type V2, type Col} from './church-kit';
import {slab, put, letters, ringSlab, type Frame} from './nearbar-kit';
import {neckGable, clawOutline, type NeckGableSpec} from './neck-gable';
import source from './odeon-singel-footprints.json';

/**
 * Odeon, Singel 460 (BAG pand 0363100012171740; Rijksmonument; Philips Vingboons 1661-62, the house "Nuerenburg", a
 * concert hall from the 19th century, now a club and event venue). A three-bay canal front of painted dark-red brick
 * under a sandstone neck gable: white claw pieces with carved scroll rims and ball finials at the shoulders, a brick
 * neck crowned by a cornice and a segmental pediment, a hoist beam in a carved cartouche, the "1662" date stone and the
 * attic window in the neck; oval windows in carved cartouches over the outer bays; festoons under the outer windows of
 * three storeys; a middle column of stacked windows in white frames; the "ODEON" stone tablet over the middle
 * bel-etage window; the entrance on the right bay (leaded fanlight, entresol window over it).
 *
 * Local frame (church-kit `local`): x along the front from the south-east corner (458 / 460 party line) to the north-west
 * corner (460 / 462), y up from the pavement, z out of the front towards the Singel; the building is z <= 0. Heights and
 * openings were read on the 2023-01-13 Gemeente Amsterdam panorama TMX7316010203-002932_pano_0001_000256 rectified onto
 * the BAG front plane with a metre grid (grid height minus the 1.0 m pavement offset), detail from the 2011 Commons
 * photograph; massing behind the front from the 3DBAG LoD2.2 roof planes (odeon-singel-footprints.json).
 * Inventory: odeon-singel-inventory.json.
 */
export const AXIS_DEG = source.axisDeg;
export const ORIGIN: V2 = source.origin as V2;

const W = 9.4; // BAG front
const BAYS = [1.55, 4.7, 7.85] as const; // outer bays and the middle (neck) axis
const SHOULDER = 17.0;
const FRONT_D = 18.08; // the front house: 3DBAG saddle and the BAG jog at 18.1 m
const EAVES = 15.5;

export const GABLE: NeckGableSpec = {x0: 0, x1: W, axis: 4.7, neckHalf: 1.45, shoulderY: SHOULDER, clawTopY: 22.4, corniceY: 23.0, corniceH: 0.55, corniceHalf: 2.1, apexY: 24.6, thick: 0.5, crown: 'segment'};

/** Openings per storey, measured on the rectified panorama (heights above the pavement). */
export const Y = {
  cellar0: 0.25, cellar1: 1.15, plinth: 1.4,
  door0: 0.2, fan0: 2.3, door1: 4.0, entresol0: 4.6, entresol1: 5.7,
  bel0: 1.7, bel1: 5.7, tablet0: 6.15, tablet1: 6.85,
  f1a: 7.1, f1b: 9.7, f2a: 10.8, f2b: 12.6, f3a: 13.7, f3b: 15.2, oculus: 16.1,
  m1a: 7.2, m1b: 9.6, m2a: 10.5, m2b: 12.9, m3a: 13.3, m3b: 15.6, m4a: 16.0, m4b: 17.8,
  date0: 18.45, attic0: 19.2, attic1: 20.6, hoist: 21.75,
};
/** Festoons hang under the outer windows of the first three storeys (their tops just under each sill). */
export const FESTOONS = [6.85, 10.6, 13.5];

const sphere = (r: number, sx = 1, sy = 1, sz = 1, w = 6, h = 4) => new T.SphereGeometry(r, w, h).scale(sx, sy, sz);

/** Sutherland-Hodgman clip of a ring to a half-plane a*x + b*z <= c. */
function clipHalf(ring: V2[], a: number, b: number, c: number): V2[] {
  const out: V2[] = [], f = (p: V2) => a * p[0] + b * p[1] - c;
  for (let i = 0; i < ring.length; i++) {
    const p = ring[i], q = ring[(i + 1) % ring.length], fp = f(p), fq = f(q);
    if (fp <= 0) out.push(p);
    if ((fp < 0 && fq > 0) || (fp > 0 && fq < 0)) { const u = fp / (fp - fq); out.push([p[0] + (q[0] - p[0]) * u, p[1] + (q[1] - p[1]) * u]); }
  }
  return out;
}

/** Saddle with its ridge along z (front to back) at xm: two slopes and a rear gable triangle; the front end stays open behind the gable. */
function saddleZ(k: Kit, x0: number, x1: number, xm: number, zf: number, zb: number, eaves: number, ridge: number, rearGable: Col | null, frontGable: Col | null = null) {
  const up = (_c: T.Vector3, n: T.Vector3) => n.y > 0;
  tris(k, [[[x0, eaves, zb], [x0, eaves, zf], [xm, ridge, zf]], [[x0, eaves, zb], [xm, ridge, zf], [xm, ridge, zb]],
    [[x1, eaves, zf], [x1, eaves, zb], [xm, ridge, zb]], [[x1, eaves, zf], [xm, ridge, zb], [xm, ridge, zf]]], 'slate', up);
  if (rearGable) tris(k, [[[x0, eaves, zb], [xm, ridge, zb], [x1, eaves, zb]]], rearGable, (_c, n) => n.z < 0);
  if (frontGable) tris(k, [[[x0, eaves, zf], [xm, ridge, zf], [x1, eaves, zf]]], frontGable, (_c, n) => n.z > 0);
}

export function buildOdeonSingel(_w: number, _d: number, b: BuildingTools) {
  const k: Kit = local(b, AXIS_DEG, ORIGIN);
  const F: Frame = frame([0, 0], [0, 1]);
  const S = (t: number, y: number, w: number, h: number, d: number, c: Col, out = 0) => onWall(k, F, t, y, w, h, d, c, out);
  const P = (g: T.BufferGeometry, t: number, y: number, out: number, c: Col) => put(k, F, g, t, y, out, c);
  const ring = (source.pands['0363100012171740'].ringLocal as number[][]).slice(0, -1).map(p => [p[0], p[1]] as V2);

  // ---------- masses ----------
  // front house: brick carcass behind the 0.5 m front wall, saddle roof with its ridge along the depth (3DBAG ridge
  // 24.85 NAP kept under the crown: the front decides the roof), brick rear gable over the lower rear part
  // the carcass carries the front plane up to the eaves; the 0.5 m front wall continues alone to the shoulder line
  const frontRing: V2[] = [[0, 0], [W, 0], [8.92, -FRONT_D], [-0.24, -FRONT_D]];
  extrude(k, frontRing, 0, EAVES, 'brick');
  slab(k, F, W / 2, EAVES, W, SHOULDER - EAVES, 0.5, 'brick', -0.5);
  saddleZ(k, 0.0, 9.15, 4.7, -0.5, -FRONT_D, EAVES, 23.0, 'brick');
  // rear part (18-35 m deep): the hall block to 15.5 m under a narrow saddle (3DBAG ridge 22.45 NAP), the low flat
  // wing on the north-west side (3DBAG 14.0-14.5 NAP)
  const rear = clipHalf(ring, 0, 1, -FRONT_D); // z <= -18.08
  const rearLeft = clipHalf(rear, 1, 0, 8.92), rearRight = clipHalf(rear, -1, 0, -8.92);
  extrude(k, rearLeft, 0, EAVES, 'brick');
  extrude(k, rearRight, 0, 13.1, 'brick');
  extrude(k, rearRight.map(([x, z]) => [x + (x > 11 ? -0.05 : 0.05), z + (z > -20 ? -0.05 : 0.05)] as V2), 13.1, 13.22, 'slate');
  saddleZ(k, -0.3, 8.92, 4.3, -FRONT_D - 0.05, -34.4, EAVES, 21.45, 'brick');
  // the strip left of the rear saddle (3DBAG 17.2-20.5 NAP falls into it): flat roof at the eaves
  extrude(k, clipHalf(rearLeft, 1, 0, -0.3), EAVES, EAVES + 0.12, 'slate');

  // ---------- the neck gable ----------
  neckGable(k, F, GABLE, {wall: 'stone', trim: 'stone', neck: 'brick'});
  // shoulder course either side of the neck, ball finials on the outer corners
  for (const [t0, t1] of [[0, GABLE.axis - GABLE.neckHalf], [GABLE.axis + GABLE.neckHalf, W]]) S((t0 + t1) / 2, SHOULDER - 0.2, t1 - t0, 0.2, 0.16, 'white');
  for (const t of [0.28, W - 0.28]) {
    S(t, SHOULDER, 0.4, 0.22, 0.12, 'stone');
    P(sphere(0.2, 1, 1.1, 1, 8, 6), t, SHOULDER + 0.42, 0.06, 'stone');
  }
  // carved scrolls and leaves along each claw (the claws' foliage, simplified): knobs on the rim and a large volute high
  // on the claw against the neck
  for (const side of [-1, 1] as const) {
    const curve = clawOutline(GABLE, side, 8).filter(p => p[1] > SHOULDER + 0.3);
    for (const i of [1, 3, 5]) { const p = curve[i]; if (p) P(sphere(0.17, 1.2, 1, 0.7), p[0], p[1] - 0.05, 0.08, 'stone'); }
    const vt = GABLE.axis + side * (GABLE.neckHalf + 0.35);
    ringSlab(k, F, vt, 21.0, 0.1, 0.32, 0.18, 'stone', 0.04, 12);
    P(sphere(0.12, 1, 1, 0.6), vt, 21.0, 0.1, 'stone');
  }
  // neck: hoist beam in a carved cartouche under the crown, attic window, the 1662 date stone
  S(GABLE.axis, Y.hoist - 0.35, 1.0, 1.15, 0.12, 'white');
  for (const s of [-1, 1]) {
    P(sphere(0.2, 0.8, 1.6, 0.6), GABLE.axis + s * 0.6, Y.hoist + 0.05, 0.08, 'white');
    P(sphere(0.13, 1, 1, 0.6), GABLE.axis + s * 0.62, Y.hoist - 0.45, 0.08, 'white');
  }
  P(new T.BoxGeometry(0.22, 0.26, 0.9).translate(0, 0.13, 0.45), GABLE.axis, Y.hoist, 0.12, 'frame');
  win(k, F, GABLE.axis, {w: 0.8, y0: Y.attic0, y1: Y.attic1, head: 'flat', bars: 1, rowM: 0.7, surround: 'white', bar: 'frame', sill: 'white'});
  S(GABLE.axis, Y.date0, 1.3, 0.5, 0.1, 'white');
  letters(k, F, '1662', GABLE.axis, Y.date0 + 0.06, 0.09, 0.045, 0.06, 'frame', 0.055);

  // ---------- middle column: four stacked windows in white frames, the ODEON tablet, the bel-etage window ----------
  const mid = BAYS[1];
  for (const [a, c, w] of [[Y.m1a, Y.m1b, 1.3], [Y.m2a, Y.m2b, 1.3], [Y.m3a, Y.m3b, 1.3], [Y.m4a, Y.m4b, 1.15]] as const) {
    win(k, F, mid, {w, y0: a, y1: c, head: 'flat', bars: 1, rowM: 0.8, surround: 'white', bar: 'frame', sill: 'white'});
  }
  // white side frames running the full column between the windows (the photo's continuous white strip)
  for (const s of [-1, 1]) S(mid + s * 0.83, Y.m1a - 0.16, 0.12, Y.m4b - Y.m1a + 0.16, 0.1, 'white');
  // ODEON tablet over the doorcase cornice of the bel-etage window
  S(mid, Y.tablet0, 1.8, Y.tablet1 - Y.tablet0, 0.12, 'white');
  letters(k, F, 'ODEON', mid, Y.tablet0 + 0.14, 0.11, 0.055, 0.06, 'frame', 0.06);
  win(k, F, mid, {w: 1.35, y0: Y.bel0, y1: Y.bel1, head: 'flat', bars: 1, rowM: 1.0, surround: 'white', bar: 'frame', sill: 'white'});
  S(mid, Y.bel1 + 0.22, 2.0, 0.2, 0.22, 'white');

  // ---------- outer bays ----------
  for (const t of [BAYS[0], BAYS[2]]) {
    for (const [a, c] of [[Y.f1a, Y.f1b], [Y.f2a, Y.f2b], [Y.f3a, Y.f3b]]) win(k, F, t, {w: 1.2, y0: a, y1: c, head: 'flat', bars: 1, rowM: 0.85, surround: 'white', bar: 'frame', sill: 'white'});
    // festoons: a swag of fruit and leaves hanging between two knots, with a drop at each end
    for (const top of FESTOONS) {
      for (let j = 0; j <= 6; j++) { const u = j / 6 - 0.5; P(sphere(0.1, 1.3, 1, 0.6), t + u * 1.15, top - 0.12 - 0.26 * (1 - 4 * u * u), 0.04, 'white'); }
      for (const s of [-1, 1]) { P(sphere(0.09, 1, 1, 0.6), t + s * 0.62, top - 0.08, 0.04, 'white'); P(sphere(0.07, 1, 2.0, 0.6), t + s * 0.66, top - 0.36, 0.04, 'white'); }
    }
    // oval window in a carved cartouche over each outer bay, under the shoulder
    const oval = new T.Shape(); oval.absellipse(0, 0, 0.55, 0.42, 0, Math.PI * 2, false, 0);
    const hole = new T.Path(); hole.absellipse(0, 0, 0.36, 0.25, 0, Math.PI * 2, true, 0); oval.holes.push(hole);
    P(new T.ExtrudeGeometry(oval, {depth: 0.2, bevelEnabled: false, curveSegments: 7}).translate(0, 0, -0.04), t, Y.oculus, 0, 'white');
    const pane = new T.Shape(); pane.absellipse(0, 0, 0.37, 0.26, 0, Math.PI * 2, false, 0);
    P(new T.ExtrudeGeometry(pane, {depth: 0.1, bevelEnabled: false, curveSegments: 6}).translate(0, 0, -0.04), t, Y.oculus, 0, 'glass');
    for (const [dx, dy, r] of [[-0.68, 0.18, 0.15], [0.68, 0.18, 0.15], [-0.62, -0.3, 0.13], [0.62, -0.3, 0.13], [0, 0.55, 0.16], [-0.32, 0.5, 0.11], [0.32, 0.5, 0.11], [0, -0.5, 0.12]] as const) P(sphere(r, 1.1, 1, 0.55), t + dx, Y.oculus + dy, 0.03, 'white');
  }
  // left bay, bel-etage: tall window with an eared white surround and a hood
  win(k, F, BAYS[0], {w: 1.35, y0: Y.bel0, y1: Y.bel1, head: 'flat', bars: 1, rowM: 1.0, surround: 'white', bar: 'frame', sill: 'white'});
  S(BAYS[0], Y.bel1 + 0.22, 1.95, 0.18, 0.2, 'white');
  // right bay: entrance door (panelled leaves under a fanlight with a round leaded medallion), doorcase and step;
  // the entresol window over it
  const r = BAYS[2];
  S(r, Y.door0, 1.2, Y.fan0 - Y.door0, 0.06, 'dark');
  for (const s of [-0.28, 0.28]) S(r + s, Y.door0 + 0.2, 0.44, Y.fan0 - Y.door0 - 0.4, 0.09, 'dark');
  S(r, Y.fan0, 1.2, Y.door1 - Y.fan0, 0.06, 'glass');
  S(r, Y.fan0 - 0.04, 1.2, 0.08, 0.1, 'frame');
  ringSlab(k, F, r, (Y.fan0 + Y.door1) / 2, 0.3, 0.36, 0.1, 'frame', 0, 16);
  for (const s of [-1, 1]) S(r + s * 0.72, Y.door0, 0.24, Y.door1 - Y.door0 + 0.2, 0.14, 'white');
  S(r, Y.door1, 1.7, 0.2, 0.14, 'white');
  S(r, Y.door1 + 0.2, 2.0, 0.18, 0.26, 'white');
  k.add(new T.BoxGeometry(1.6, 0.2, 0.45), 'stone', r, 0.1, 0.22);
  win(k, F, r, {w: 1.2, y0: Y.entresol0, y1: Y.entresol1, head: 'flat', bars: 1, rowM: 1.2, surround: 'white', bar: 'frame', sill: 'white'});
  for (const s of [-1, 1]) S(r + s * 0.8, Y.entresol1 - 0.05, 0.2, 0.25, 0.14, 'white'); // the surround's ears

  // ---------- base: souterrain windows under the left and middle bays, plinth course ----------
  for (const t of [BAYS[0], BAYS[1]]) {
    S(t, Y.cellar0, 1.0, Y.cellar1 - Y.cellar0, 0.05, 'dark');
    for (let j = -2; j <= 2; j++) S(t + j * 0.19, Y.cellar0, 0.04, Y.cellar1 - Y.cellar0, 0.1, 'frame');
  }
  for (const [t0, t1] of [[0, 6.95], [8.75, W]]) S((t0 + t1) / 2, Y.plinth, t1 - t0, 0.14, 0.12, 'white');
  S(W / 2, 0, W, 0.18, 0.08, 'stone');
}
