import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {local, extrude, frame, onWall, tris, win, type Kit, type V2, type Col} from './church-kit';
import {slab, poly, put, archBand, type Frame} from './nearbar-kit';
import {neckGable, type NeckGableSpec} from './neck-gable';
import source from './cromhouthuizen-footprints.json';

/**
 * Cromhouthuizen, Herengracht 362-370 (BAG panden 0363100012176599, 0363100012169510, 0363100012176534; Rijksmonumenten;
 * Philips Vingboons 1660-62 for Jacob Cromhout; the Bijbels Museum at 366-368 until 2020). Four sandstone canal fronts of
 * three bays each, every one under a neck gable with claw pieces, two oval oeil-de-boeuf windows on the shoulders and a
 * crowning cornice with a triangular pediment (nl.wikipedia "Cromhouthuizen"); 364 and 366 are the wide pair with the
 * taller gables, 368 and 370 the narrow pair. 362, in the same BAG pand as 364, is a later stucco front with a balcony on
 * scroll consoles, three wooden doors and a roof falling towards the Huidenstraat corner; it is modelled because its pand
 * is replaced.
 *
 * Local frame (church-kit `local`): x along the front from the south corner (370 / 372 party line) to the north corner
 * (362 / 360), y up from the pavement, z out of the front towards the canal; the building is z <= 0. Heights and
 * openings were read on the 2021-01-22 Gemeente Amsterdam panorama TMX7316010203-001975_pano_0000_000497, rectified onto
 * the BAG front plane with a metre grid (photo height minus the 0.5 m pavement offset); massing behind the front from
 * the 3DBAG LoD2.2 roof planes (cromhouthuizen-footprints.json). Inventory: cromhouthuizen-inventory.json.
 */
export const AXIS_DEG = source.axisDeg;
export const ORIGIN: V2 = source.origin as V2;

const FRONT_D = 15.4; // front houses run back 15.4-16 m (BAG ring of 370, 3DBAG front roofs)
const EAVES = 13.4; // 3DBAG eaves on the party walls, 14.2-15.0 NAP
const SHOULDER = 16.6; // top of the full-width wall at the party lines (claw feet)
const ROW = 29.0; // the four Vingboons fronts end at the 364 / 362 line
const END = source.frontLengthM;

type House = {
  id: string; x0: number; x1: number; bays: [number, number, number];
  door: number | null; // bay index of the bel-etage door
  gable: NeckGableSpec; ridge: number;
  neckWin: {y0: number; y1: number; w: number}; topWin: {y0: number; y1: number; w: number};
  bars: Col; paneCols: number; relief: boolean; whiteSash: boolean;
};

const gable = (x0: number, x1: number, axis: number, neckHalf: number, clawTopY: number, corniceY: number, corniceH: number, corniceHalf: number, apexY: number): NeckGableSpec =>
  ({x0, x1, axis, neckHalf, shoulderY: SHOULDER, clawTopY, corniceY, corniceH, corniceHalf, apexY, thick: 0.5});

/** Per house, measured on the rectified panorama (metres along the front, heights above the pavement). */
export const HOUSES: House[] = [
  {id: '370', x0: 0, x1: 5.85, bays: [1.15, 3.0, 4.9], door: 0, gable: gable(0, 5.85, 3.05, 1.05, 18.2, 18.8, 0.5, 1.6, 20.25), ridge: 19.9,
    neckWin: {y0: 13.95, y1: 15.5, w: 0.95}, topWin: {y0: 16.9, y1: 17.6, w: 0.6}, bars: 'frame', paneCols: 2, relief: false, whiteSash: false},
  {id: '368', x0: 5.85, x1: 11.9, bays: [6.95, 8.9, 10.85], door: 2, gable: gable(5.85, 11.9, 8.85, 1.05, 18.2, 18.8, 0.5, 1.5, 20.25), ridge: 19.9,
    neckWin: {y0: 13.95, y1: 15.6, w: 1.0}, topWin: {y0: 16.9, y1: 17.6, w: 0.6}, bars: 'white', paneCols: 3, relief: true, whiteSash: false},
  {id: '366', x0: 11.9, x1: 20.0, bays: [13.1, 15.95, 18.8], door: 0, gable: gable(11.9, 20.0, 15.95, 1.85, 17.6, 20.85, 0.7, 2.05, 22.55), ridge: 20.8,
    neckWin: {y0: 13.95, y1: 15.6, w: 1.1}, topWin: {y0: 17.7, y1: 18.9, w: 0.8}, bars: 'frame', paneCols: 2, relief: true, whiteSash: false},
  {id: '364', x0: 20.0, x1: 29.0, bays: [21.6, 24.5, 27.35], door: null, gable: gable(20.0, 29.0, 24.55, 1.55, 19.6, 20.85, 0.7, 2.3, 22.6), ridge: 20.8,
    neckWin: {y0: 13.95, y1: 16.25, w: 1.6}, topWin: {y0: 17.7, y1: 18.9, w: 0.8}, bars: 'white', paneCols: 3, relief: false, whiteSash: true},
];

/** Storey heights shared by the four fronts (rectified panorama, minus the pavement offset). */
export const Y = {
  plinth: 2.05, door0: 2.25, door1: 4.55, transom1: 6.45, bel0: 2.85, bel1: 6.45, ped0: 6.6, ped1: 7.35,
  first0: 7.9, first1: 10.5, cornice: 10.75, second0: 11.8, second1: 13.25, band: 13.65, oculus: 14.75,
};

const sphere = (r: number, sx = 1, sy = 1, sz = 1, w = 6, h = 4) => new T.SphereGeometry(r, w, h).scale(sx, sy, sz);

/** Sutherland-Hodgman clip of a ring to zLo <= z <= zHi. */
export function clipZ(ring: V2[], zLo: number, zHi: number): V2[] {
  const clip = (pts: V2[], inside: (p: V2) => boolean, cut: (a: V2, b: V2) => V2) => {
    const out: V2[] = [];
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length];
      if (inside(b)) { if (!inside(a)) out.push(cut(a, b)); out.push(b); } else if (inside(a)) out.push(cut(a, b));
    }
    return out;
  };
  const at = (z: number) => (a: V2, b: V2): V2 => { const u = (z - a[1]) / (b[1] - a[1]); return [a[0] + (b[0] - a[0]) * u, z]; };
  return clip(clip(ring, p => p[1] >= zLo, at(zLo)), p => p[1] <= zHi, at(zHi));
}
const ringOf = (pand: string): V2[] => {
  const r = (source.pands as Record<string, {ringLocal: number[][]}>)[pand].ringLocal.map(p => [p[0], p[1]] as V2);
  return r.slice(0, -1);
};

/** Saddle roof with its ridge along z (front to back): two slopes and a rear gable triangle; the front end stays open behind the neck gable. */
function saddleZ(k: Kit, x0: number, x1: number, zf: number, zb: number, eaves: number, ridge: number, gableCol: Col) {
  const xm = (x0 + x1) / 2, up = (_c: T.Vector3, n: T.Vector3) => n.y > 0;
  tris(k, [[[x0, eaves, zb], [x0, eaves, zf], [xm, ridge, zf]], [[x0, eaves, zb], [xm, ridge, zf], [xm, ridge, zb]],
    [[x1, eaves, zf], [x1, eaves, zb], [xm, ridge, zb]], [[x1, eaves, zf], [xm, ridge, zb], [xm, ridge, zf]]], 'slate', up);
  tris(k, [[[x0, eaves, zb], [xm, ridge, zb], [x1, eaves, zb]]], gableCol, (_c, n) => n.z < 0);
}
/** Saddle with its ridge along x (parallel to the canal), both gable ends closed. */
export function saddleX(k: Kit, x0: number, x1: number, zf: number, zb: number, eaves: number, ridge: number) {
  const zm = (zf + zb) / 2, up = (_c: T.Vector3, n: T.Vector3) => n.y > 0;
  tris(k, [[[x0, eaves, zf], [x1, eaves, zf], [x1, ridge, zm]], [[x0, eaves, zf], [x1, ridge, zm], [x0, ridge, zm]],
    [[x1, eaves, zb], [x0, eaves, zb], [x0, ridge, zm]], [[x1, eaves, zb], [x0, ridge, zm], [x1, ridge, zm]]], 'slate', up);
  tris(k, [[[x0, eaves, zf], [x0, ridge, zm], [x0, eaves, zb]]], 'brick', (_c, n) => n.x < 0);
  tris(k, [[[x1, eaves, zb], [x1, ridge, zm], [x1, eaves, zf]]], 'brick', (_c, n) => n.x > 0);
}

export function buildCromhouthuizen(_w: number, _d: number, b: BuildingTools) {
  const k: Kit = local(b, AXIS_DEG, ORIGIN);
  const F: Frame = frame([0, 0], [0, 1]);
  const S = (t: number, y: number, w: number, h: number, d: number, c: Col, out = 0) => onWall(k, F, t, y, w, h, d, c, out);
  const P = (g: T.BufferGeometry, t: number, y: number, out: number, c: Col) => put(k, F, g, t, y, out, c);

  // ---------- masses ----------
  // front houses: brick carcass behind a 0.5 m sandstone front that rises to the shoulder line
  extrude(k, [[0.1, -0.3], [ROW - 0.1, -0.3], [ROW - 0.1, -FRONT_D], [0.1, -FRONT_D]], 0, EAVES, 'brick');
  slab(k, F, ROW / 2, 0, ROW, SHOULDER, 0.5, 'stone', -0.5);
  // 362: stucco front block, a flat-roofed rear part (3DBAG 14.5-15.0 NAP)
  extrude(k, [[ROW, -0.15], [END - 0.1, -0.15], [END - 0.1, -6.9], [ROW, -6.9]], 0, 13.5, 'brick');
  slab(k, F, (ROW + END) / 2, 0, END - ROW, 13.6, 0.3, 'ochre', -0.3);
  extrude(k, [[ROW, -6.9], [END, -6.9], [END - 0.1, -FRONT_D], [ROW, -FRONT_D]], 0, 13.9, 'brick');
  extrude(k, [[ROW + 0.05, -6.95], [END - 0.15, -6.95], [END - 0.2, -FRONT_D + 0.05], [ROW + 0.05, -FRONT_D + 0.05]], 13.9, 14.02, 'slate');
  // behind the front houses (3DBAG): low courtyard buildings 15.4-22 m deep, rear houses 22-32 m with saddles parallel to
  // the canal (370 and 366-368) or a flat roof (362-364), the low rearmost strip
  const zones: {lo: number; hi: number; h: number}[] = [{lo: -21.95, hi: -FRONT_D - 0.05, h: 5.0}, {lo: -32.0, hi: -22.0, h: 12.0}, {lo: -40, hi: -32.05, h: 2.8}];
  for (const pand of Object.keys(source.pands)) for (const z of zones) {
    const r = clipZ(ringOf(pand), z.lo, z.hi);
    if (r.length < 3) continue;
    const h = pand === '0363100012176599' && z.h === 12.0 ? 13.6 : z.h;
    extrude(k, r, 0, h, 'brick');
    extrude(k, r, h, h + 0.12, 'slate');
  }
  saddleX(k, -4.8, 5.2, -22.0, -31.6, 12.12, 18.2);
  saddleX(k, 5.3, 20.15, -22.0, -32.0, 12.12, 18.3);

  // ---------- roofs of the front houses: one saddle each, ridge from the gable back to a rear brick gable ----------
  for (const h of HOUSES) saddleZ(k, h.x0, h.x1, -0.5, -FRONT_D, EAVES, h.ridge, 'brick');
  // 362: roof falling to the north (Huidenstraat side) and hipped to the front, 3DBAG 13.4-19.7 NAP
  {
    const e = 13.6, r = 18.2, zr = -2.6, zb = -6.9, up = (_c: T.Vector3, n: T.Vector3) => n.y > 0;
    tris(k, [[[ROW, e, 0], [END, e, 0], [ROW, r, zr]], [[END, e, 0], [END, e, zb], [ROW, r, zb]], [[END, e, 0], [ROW, r, zb], [ROW, r, zr]]], 'slate', up);
    tris(k, [[[ROW, e, 0], [ROW, r, zr], [ROW, r, zb]], [[ROW, e, 0], [ROW, r, zb], [ROW, e, zb]]], 'brick', (_c, n) => n.x < 0);
    tris(k, [[[ROW, e, zb], [ROW, r, zb], [END, e, zb]]], 'brick', (_c, n) => n.z < 0);
  }

  // ---------- the four Vingboons fronts ----------
  // continuous courses: plinth ledge, the cornice over the first floor, the band under the shoulder storey
  S(ROW / 2, Y.plinth - 0.18, ROW, 0.18, 0.12, 'stone');
  S(ROW / 2, Y.cornice, ROW, 0.3, 0.22, 'stone');
  S(ROW / 2, Y.cornice + 0.3, ROW, 0.06, 0.12, 'stone');
  S(ROW / 2, Y.band, ROW, 0.25, 0.18, 'stone');
  // party-line pilaster strips
  for (const t of [0.17, 5.85, 11.9, 20.0, 28.83]) S(t, Y.plinth, 0.34, Y.band - Y.plinth, 0.07, 'stone');

  for (const h of HOUSES) {
    const g = h.gable, mid = h.bays[1], sash = h.whiteSash ? 'white' : h.bars;
    neckGable(k, F, g, {wall: 'stone', trim: 'stone'});
    h.bays.forEach((t, i) => {
      const isDoor = h.door === i, outer = i !== 1;
      // bel-etage: tall sash window, or the door under a leaded transom light
      if (isDoor) {
        S(t, Y.door0, 1.05, Y.door1 - Y.door0, 0.06, 'dark');
        for (const s of [-0.26, 0.26]) S(t + s, Y.door0 + 0.25, 0.4, Y.door1 - Y.door0 - 0.5, 0.09, 'dark'); // raised panels
        S(t, Y.door1 + 0.05, 1.15, 0.2, 0.14, 'white');
        S(t, Y.door1 + 0.25, 1.05, Y.transom1 - Y.door1 - 0.25, 0.06, 'glass');
        for (const s of [-1, 1]) for (let j = -1; j <= 1; j++) { // leaded lattice: diagonal cames
          P(new T.BoxGeometry(0.03, 2.1, 0.03).rotateZ(s * 0.62).translate(0, 0, 0.015), t + j * 0.42, Y.door1 + 0.25 + (Y.transom1 - Y.door1 - 0.25) / 2, 0.06, 'frame');
        }
        for (const s of [-1, 1]) S(t + s * 0.64, Y.door0, 0.22, Y.transom1 - Y.door0, 0.14, 'white');
        S(t, Y.transom1, 1.5, 0.22, 0.14, 'white');
      } else {
        win(k, F, t, {w: h.id === '364' ? 1.5 : 1.35, y0: Y.bel0, y1: Y.bel1, head: 'flat', bars: h.paneCols - 1, rowM: h.whiteSash ? 0.45 : 0.9, surround: 'white', bar: sash});
      }
      // hoods over the bel-etage: triangular pediments over the outer bays, a flat hood over the middle one
      if (outer) {
        S(t, Y.ped0, 1.75, 0.16, 0.24, 'stone');
        poly(k, F, t, Y.ped0 + 0.16, [[-0.88, 0], [0.88, 0], [0, 0.58]], 0.22, 'stone', -0.04);
      } else {
        S(t, Y.ped0, 1.6, 0.2, 0.2, 'stone');
        // relief tablet under the middle first-floor window (366 and 368), plain sunk panel on 364 and 370
        if (h.relief) {
          S(t, 7.0, 1.6, 0.62, 0.08, 'stone');
          for (const [dx, dy, r, sx] of [[-0.45, 0.32, 0.13, 1.6], [-0.1, 0.34, 0.15, 2.2], [0.3, 0.3, 0.12, 1.4], [0.55, 0.36, 0.09, 1]] as const) P(sphere(r, sx, 0.9, 0.45), t + dx, 7.0 + dy, 0.1, 'stone');
        } else S(t, 7.1, 1.3, 0.45, 0.07, 'stone');
      }
      // first floor: tall sash windows
      win(k, F, t, {w: h.id === '364' ? 1.55 : 1.4, y0: Y.first0, y1: Y.first1, head: 'flat', bars: h.paneCols - 1, rowM: h.whiteSash ? 0.45 : 0.9, surround: 'white', bar: sash});
      // second floor: shorter windows over a festoon (fruit swag hanging from two rosettes)
      win(k, F, t, {w: h.id === '364' ? 1.45 : 1.3, y0: Y.second0, y1: Y.second1, head: 'flat', bars: h.paneCols - 1, rowM: 0.5, surround: 'white', bar: sash});
      for (let j = 0; j <= 4; j++) { const u = j / 4 - 0.5; P(sphere(0.09, 1.2, 1, 0.6), t + u * 1.0, 11.5 - 0.22 * (1 - 4 * u * u), 0.02, 'stone'); }
      for (const s of [-1, 1]) P(sphere(0.07, 1, 1.6, 0.6), t + s * 0.55, 11.33, 0.02, 'stone');
      // basement (souterrain): barred window, or the cellar door below a door bay
      if (isDoor || (h.id === '370' && i === 2)) S(t + (isDoor && h.id !== '370' ? (h.id === '368' ? 0.55 : -0.0) : 0), 0, 0.8, 1.85, 0.05, 'dark');
      // the middle bays of 370, 368 and 366 sit behind a stoop flight: their cellar windows are not visible
      else if (!(['370', '368', '366'].includes(h.id) && i === 1)) {
        S(t, 0.6, 0.95, 1.15, 0.05, 'dark');
        for (let j = -2; j <= 2; j++) S(t + j * 0.18, 0.6, 0.04, 1.15, 0.1, 'frame');
        S(t, 0.45, 1.2, 0.15, 0.14, 'stone');
      }
    });
    // shoulder storey: the oeil-de-boeuf over each outer bay, carved surround; the neck window over the middle bay
    for (const t of [h.bays[0], h.bays[2]]) {
      const oval = new T.Shape(); oval.absellipse(0, 0, 0.42, 0.55, 0, Math.PI * 2, false, 0);
      const hole = new T.Path(); hole.absellipse(0, 0, 0.27, 0.38, 0, Math.PI * 2, true, 0); oval.holes.push(hole);
      P(new T.ExtrudeGeometry(oval, {depth: 0.18, bevelEnabled: false, curveSegments: 7}).translate(0, 0, -0.04), t, Y.oculus, 0, 'stone');
      const pane = new T.Shape(); pane.absellipse(0, 0, 0.28, 0.39, 0, Math.PI * 2, false, 0);
      P(new T.ExtrudeGeometry(pane, {depth: 0.1, bevelEnabled: false, curveSegments: 6}).translate(0, 0, -0.04), t, Y.oculus, 0, 'glass');
      S(t, Y.oculus - 0.38, 0.04, 0.76, 0.1, h.whiteSash ? 'white' : 'frame');
      // carved cartouche: scrolls and leaves around the frame
      for (const [dx, dy, r] of [[-0.55, 0.3, 0.13], [0.55, 0.3, 0.13], [-0.6, -0.25, 0.12], [0.6, -0.25, 0.12], [0, 0.66, 0.14], [0, -0.66, 0.11]] as const) P(sphere(r, 1, 1, 0.55), t + dx, Y.oculus + dy, 0.03, 'stone');
    }
    const nw = h.neckWin;
    win(k, F, mid === g.axis ? mid : g.axis, {w: nw.w, y0: nw.y0, y1: nw.y1, head: 'flat', bars: h.whiteSash ? 2 : 1, rowM: h.whiteSash ? 0.45 : 0.8, surround: 'white', bar: sash});
    archBand(k, F, g.axis, nw.y1 + 0.22, nw.w + 0.5, (nw.w + 0.5) / 2, 0.16, 0.16, 'stone', -0.04);
    if (h.id === '364') { // French window with a low iron balconette
      S(g.axis, nw.y0 + 0.05, nw.w + 0.3, 0.05, 0.3, 'bronze');
      for (let j = 0; j <= 6; j++) S(g.axis - (nw.w + 0.2) / 2 + j * (nw.w + 0.2) / 6, nw.y0 + 0.05, 0.03, 0.6, 0.3, 'bronze');
      S(g.axis, nw.y0 + 0.62, nw.w + 0.3, 0.04, 0.3, 'bronze');
    }
    // the neck: sill course, the attic window, the hoist beam under the crown
    S(g.axis, SHOULDER - 0.05, g.neckHalf * 2, 0.18, 0.12, 'stone');
    const tw = h.topWin;
    win(k, F, g.axis, {w: tw.w, y0: tw.y0, y1: tw.y1, head: 'flat', bars: 1, rowM: 0.6, surround: 'white', bar: sash});
    const hy = g.corniceY - 0.45;
    P(new T.BoxGeometry(0.2, 0.24, 1.0).translate(0, 0.12, 0.46), g.axis, hy, 0, 'frame');
    if (h.id === '364' || h.id === '366') { // boarded hood over the beam (white on 364)
      S(g.axis, hy - 0.05, 0.7, 0.42, 0.75, h.id === '364' ? 'white' : 'stone');
    }
  }

  // ---------- stoops: 370 one flight to the right; 368 and 366 share a landing with flights to both sides ----------
  const landing = (t0: number, t1: number) => {
    k.add(new T.BoxGeometry(t1 - t0, 0.22, 1.5), 'stone', (t0 + t1) / 2, Y.door0 - 0.11, 0.75);
    for (const t of [t0 + 0.2, t1 - 0.2]) k.add(new T.BoxGeometry(0.4, Y.door0 - 0.22, 1.4), 'stone', t, (Y.door0 - 0.22) / 2, 0.7);
    // iron railing along the landing front: posts and a top rail (the flights carry their own)
    for (let t = t0 + 0.05; t <= t1 - 0.04; t += (t1 - t0 - 0.1) / Math.max(1, Math.round((t1 - t0) / 0.6))) k.add(new T.BoxGeometry(0.03, 0.9, 0.03), 'bronze', t, Y.door0 + 0.45, 1.45);
    k.add(new T.BoxGeometry(t1 - t0 - 0.06, 0.05, 0.05), 'bronze', (t0 + t1) / 2, Y.door0 + 0.9, 1.45);
  };
  const flight = (tTop: number, dir: number, n: number) => {
    const rise = Y.door0 / (n + 1), run = 0.27;
    for (let i = 0; i < n; i++) {
      const top = Y.door0 - rise * (i + 1), t = tTop + dir * run * (i + 0.5);
      k.add(new T.BoxGeometry(run, top, 1.2), 'stone', t, top / 2, 0.75);
    }
    const len = n * run, ang = Math.atan2(Y.door0 - rise, len);
    const rail = new T.BoxGeometry(Math.hypot(len, Y.door0) + 0.1, 0.05, 0.05).rotateZ(-dir * ang);
    k.add(rail, 'bronze', tTop + dir * len / 2, Y.door0 / 2 + 0.9, 1.33);
    for (let i = 0; i <= n; i += 2) k.add(new T.BoxGeometry(0.03, 0.9, 0.03), 'bronze', tTop + dir * run * i, Y.door0 - rise * i + 0.45, 1.33);
  };
  landing(0.45, 1.95); flight(1.95, 1, 7);
  landing(10.2, 13.75); flight(10.2, -1, 7); flight(13.75, 1, 7);

  // wall lanterns: on the 370 / 372 line and the 366 / 364 line
  for (const t of [0.6, 20.0]) {
    P(new T.BoxGeometry(0.05, 0.05, 0.45).translate(0, 0, 0.21), t, 4.75, 0, 'bronze');
    k.add(new T.BoxGeometry(0.26, 0.42, 0.26), 'glass', t, 4.45, 0.55);
    k.add(new T.ConeGeometry(0.22, 0.2, 4).rotateY(Math.PI / 4), 'bronze', t, 4.76, 0.55);
    k.add(new T.BoxGeometry(0.3, 0.05, 0.3), 'bronze', t, 4.22, 0.55);
  }

  // ---------- 362: stucco front with a balcony on scroll consoles ----------
  const c362 = 31.0;
  // three wooden doors in a stone frame, glazed transoms, a cartouche over the middle one
  S(c362, 0, 3.6, 0.25, 0.1, 'stone');
  S(c362, 4.15, 3.7, 0.3, 0.16, 'stone');
  for (const [t, w] of [[29.85, 0.72], [31.0, 1.1], [32.15, 0.7]] as const) {
    S(t, 0.25, w, 3.35, 0.06, 'dark');
    S(t, 0.55, w - 0.2, 1.2, 0.09, 'dark');
    S(t, 2.0, w - 0.2, 1.3, 0.09, 'dark');
    S(t, 3.65, w, 0.45, 0.06, 'glass');
    S(t, 3.6, w + 0.08, 0.05, 0.1, 'white');
  }
  for (const t of [29.4, 30.45, 31.6, 32.62]) S(t, 0.25, 0.2, 3.9, 0.14, 'stone');
  win(k, F, c362, {w: 0.85, y0: 4.75, y1: 6.05, head: 'flat', bars: 1, rowM: 0.65, surround: 'white', bar: 'white'});
  for (const s of [-1, 1]) P(sphere(0.16, 1, 1.5, 0.5), c362 + s * 0.75, 5.4, 0.03, 'ochre');
  P(sphere(0.22, 1.6, 0.8, 0.5), c362, 6.35, 0.03, 'ochre');
  // balcony: slab, bulbous balusters between pedestals, rail; two big scroll consoles under it
  const b0 = 29.25, b1 = END - 0.1, by = 7.3;
  k.add(new T.BoxGeometry(b1 - b0, 0.22, 0.95), 'stone', (b0 + b1) / 2, by + 0.11, 0.47);
  for (const t of [b0 + 0.15, b1 - 0.15]) k.add(new T.BoxGeometry(0.3, 0.85, 0.3), 'stone', t, by + 0.22 + 0.42, 0.8);
  for (let t = b0 + 0.45; t < b1 - 0.35; t += 0.24) {
    const bal = new T.LatheGeometry([new T.Vector2(0.001, 0), new T.Vector2(0.07, 0.02), new T.Vector2(0.05, 0.15), new T.Vector2(0.09, 0.35), new T.Vector2(0.04, 0.6), new T.Vector2(0.06, 0.66), new T.Vector2(0.001, 0.67)], 6);
    k.add(bal, 'stone', t, by + 0.22, 0.8);
  }
  k.add(new T.BoxGeometry(b1 - b0, 0.12, 0.34), 'stone', (b0 + b1) / 2, by + 0.95, 0.8);
  for (const t of [29.6, 32.55]) {
    // console profile: full depth under the balcony slab, curving back to the wall 1.1 m below it
    const sc: [number, number][] = [[0, 0]];
    for (let i = 0; i <= 8; i++) { const a = i / 8 * Math.PI / 2; sc.push([0.85 * Math.cos(a), -1.1 * Math.sin(a)]); }
    const shape = new T.Shape(sc.map(([x, y]) => new T.Vector2(x, y)));
    const g = new T.ExtrudeGeometry(shape, {depth: 0.32, bevelEnabled: false}).rotateY(-Math.PI / 2).translate(0.16, 0, 0);
    k.add(g, 'stone', t, by, 0);
    k.add(new T.CylinderGeometry(0.17, 0.17, 0.34, 10).rotateZ(Math.PI / 2), 'stone', t, by - 0.95, 0.2);
  }
  // first floor behind the balcony: wide French window; second floor window; cornice
  win(k, F, c362, {w: 2.1, y0: by + 0.25, y1: 10.55, head: 'flat', bars: 5, rowM: 0.5, surround: 'white', bar: 'white'});
  S(c362, 10.85, END - ROW, 0.28, 0.2, 'stone');
  win(k, F, c362, {w: 1.55, y0: 11.85, y1: 13.2, head: 'flat', bars: 3, rowM: 0.45, surround: 'white', bar: 'white'});
  S(c362, 13.35, END - ROW, 0.25, 0.3, 'stone');
}
