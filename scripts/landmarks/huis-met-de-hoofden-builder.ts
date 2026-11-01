import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {local, extrude, frame, gable, onWall, win, type Kit, type V2, type Col} from './church-kit';
import {slab, archSlab, archBand, segBand, poly, put, type Frame} from './nearbar-kit';
import {letterBoxes} from './figure-kit';

/**
 * Huis met de Hoofden, Keizersgracht 123 (BAG pand 0363100012177213, Rijksmonument 2249; 1622, Amsterdam Renaissance,
 * attributed to Hendrick de Keyser and finished by his son Pieter). The 17 m canal front faces the Keizersgracht (bearing
 * 300): a 13.9 m double-width "huis met zijhuis" of red brick with sandstone bands, blocks, cross windows under relieving
 * arches, the six sandstone busts on consoles between the bel-etage windows (Apollo, Ceres, Mercury, Minerva, Bacchus,
 * Diana; nl.wikipedia "De zes hoofden"), the sandstone door portal on a low double stoop, balustrades over the outer
 * bays, and a three-stage stepped gable with obelisks, volutes, niches, free-standing columns, a broken segmental pediment
 * and a ball finial; plus the 3.1 m gateway wing on the right (sandstone gate portal with lion masks, the coachman's room
 * over it, a crest with balls). Roofs from the 3DBAG LoD2.2 planes: a cross roof behind the front (eaves 12.6, ridge 20.3)
 * with an "insnijdend" roof behind the gable, and two parallel saddles to the double stepped rear gable (ridge 19.2).
 *
 * Local frame (church-kit `local`): x along the front from its north end (the viewer's left facing it from the canal) to
 * the south end, y up from the pavement, z out of the front towards the canal; the building is z <= 0. Plan and roof
 * heights from huis-met-de-hoofden-footprints.json; facade heights and positions measured on the RCE photograph 20408929
 * (2005, CC BY-SA 4.0) scaled to the BAG front width, cross-checked on the 2016/2022 Gemeente Amsterdam panoramas.
 * Elements are listed in huis-met-de-hoofden-inventory.json.
 */
export const AXIS_DEG = -120.0;
/** Front-left (north) corner of the BAG front, native east/south metres from the catalogue anchor. */
export const ORIGIN: V2 = [-0.09, -10.25];

/** Facade axis (door, gable) and bay axes, metres along the front. */
const A = 7.07;
const BAYS = [A - 5.35, A - 2.65, A + 2.65, A + 5.35];
/** Busts left to right; t along the front. */
const HEADS: {t: number; who: 'apollo' | 'ceres' | 'mercury' | 'minerva' | 'bacchus' | 'diana'}[] = [
  {t: A - 6.7, who: 'apollo'}, {t: A - 4.0, who: 'ceres'}, {t: A - 1.42, who: 'mercury'},
  {t: A + 1.42, who: 'minerva'}, {t: A + 4.0, who: 'bacchus'}, {t: A + 6.7, who: 'diana'},
];
export const H = {
  plinth: 2.0, bel0: 2.2, bel1: 6.7, belTransom: 4.1, cornice1: 7.62, sec0: 7.95, sec1: 10.8, secTransom: 9.3, cornice2: 11.85,
  eaves: 12.6, third0: 12.15, third1: 13.95, stage1: 15.0, stage2: 18.2, stage3: 20.95, ridge: 20.3, rearRidge: 19.2,
  wing: 8.0, wingBack: 18.7, rearLow: 6.7,
};
const MAIN_W = 13.87, WING_W = 3.11, DEPTH = 19.2;

const MAIN: V2[] = [[0, 0], [13.87, -0.17], [13.87, -4.1], [14.5, -4.1], [14.5, -19.3], [-0.2, -19.15], [-0.17, -16.27]];
const WING: V2[] = [[13.87, 0.01], [16.99, -0.02], [16.95, -4.1], [13.87, -4.1]];
const WING_BACK: V2[] = [[14.5, -4.1], [16.95, -4.1], [16.86, -11.7], [14.5, -11.7]];
const REAR_LOW: V2[] = [[14.5, -11.7], [16.86, -11.7], [16.8, -19.35], [14.5, -19.3]];

type Part = {g: T.BufferGeometry; c: Col};
const sphere = (r: number, sx = 1, sy = 1, sz = 1, w = 8, h = 6) => new T.SphereGeometry(r, w, h).scale(sx, sy, sz);

/**
 * A sandstone bust on its console, in the wall's own frame (x along the wall, y up from the console top, z out of the
 * wall). Each god carries the attribute nl.wikipedia names: Apollo a laurel wreath, Ceres corn ears, Mercury a winged
 * helmet, Minerva a crested helmet, Bacchus grapes, Diana a crescent. About 0.6 m wide and 1.1 m tall (RCE 20408929).
 */
function bust(who: typeof HEADS[number]['who']): Part[] {
  const p: Part[] = [], z = 0.34;
  // console: a tapering bracket under the bust plus a plate
  const br = new T.Shape(); br.moveTo(-0.16, 0); br.lineTo(0.16, 0); br.lineTo(0.05, -0.45); br.lineTo(-0.05, -0.45); br.closePath();
  p.push({g: new T.ExtrudeGeometry(br, {depth: 0.32, bevelEnabled: false}), c: 'stone'});
  p.push({g: new T.BoxGeometry(0.62, 0.1, 0.52).translate(0, -0.05, 0.26), c: 'stone'});
  // shoulders and chest, neck, head
  p.push({g: sphere(0.3, 1, 0.75, 0.55, 10, 6).translate(0, 0.2, z - 0.04), c: 'stone'});
  p.push({g: new T.CylinderGeometry(0.08, 0.09, 0.2, 8).translate(0, 0.46, z), c: 'stone'});
  p.push({g: sphere(0.15, 0.95, 1.2, 1.05, 10, 8).translate(0, 0.68, z + 0.02), c: 'stone'});
  p.push({g: sphere(0.05, 0.8, 0.8, 1).translate(0, 0.66, z + 0.18), c: 'stone'}); // nose and face plane
  if (who === 'apollo') {
    p.push({g: new T.TorusGeometry(0.15, 0.04, 4, 12).rotateX(Math.PI / 2).translate(0, 0.76, z + 0.02), c: 'stone'});
    for (const s of [-1, 1]) p.push({g: sphere(0.07, 1, 1.4, 0.8).translate(s * 0.15, 0.62, z), c: 'stone'}); // curls
  } else if (who === 'ceres') {
    for (let i = -2; i <= 2; i++) p.push({g: new T.ConeGeometry(0.04, 0.22, 4).rotateZ(-i * 0.3).translate(i * 0.06, 0.9, z), c: 'stone'});
    p.push({g: new T.TorusGeometry(0.15, 0.035, 4, 12).rotateX(Math.PI / 2).translate(0, 0.76, z + 0.02), c: 'stone'});
  } else if (who === 'mercury') {
    p.push({g: sphere(0.17, 1, 0.6, 1.05, 10, 4).translate(0, 0.76, z + 0.01), c: 'stone'});
    for (const s of [-1, 1]) {
      const wing = new T.Shape(); wing.moveTo(0, 0); wing.lineTo(0.2, 0.2); wing.lineTo(0.12, 0.02); wing.closePath();
      p.push({g: new T.ExtrudeGeometry(wing, {depth: 0.04, bevelEnabled: false}).scale(s, 1, 1).rotateY(s * 0.2).translate(s * 0.14, 0.76, z - 0.02), c: 'stone'});
    }
  } else if (who === 'minerva') {
    p.push({g: sphere(0.17, 1, 0.65, 1.1, 10, 4).translate(0, 0.76, z + 0.01), c: 'stone'});
    p.push({g: new T.BoxGeometry(0.05, 0.16, 0.34).translate(0, 0.94, z - 0.02), c: 'stone'}); // crest
    p.push({g: new T.BoxGeometry(0.3, 0.04, 0.08).translate(0, 0.74, z + 0.19), c: 'stone'}); // visor
  } else if (who === 'bacchus') {
    for (const [x, y] of [[-0.12, 0.8], [0, 0.85], [0.12, 0.8], [-0.17, 0.66], [0.17, 0.66], [-0.06, 0.92], [0.06, 0.92]]) p.push({g: sphere(0.06, 1, 1, 1, 6, 4).translate(x, y, z + 0.03), c: 'stone'});
  } else {
    p.push({g: new T.TorusGeometry(0.1, 0.025, 4, 10, Math.PI).rotateZ(Math.PI).translate(0, 0.98, z), c: 'stone'}); // crescent, horns up
    p.push({g: sphere(0.08, 1, 0.7, 1).translate(0, 0.83, z - 0.06), c: 'stone'}); // hair knot
  }
  return p;
}

/** Cross window (kruiskozijn): stone frame, mullion and transom, leaded glass in four lights, sill. */
function crossWindow(k: Kit, f: Frame, t: number, y0: number, y1: number, w: number, transom: number, o: {lights?: number} = {}) {
  const h = y1 - y0, lights = o.lights ?? 2;
  onWall(k, f, t, y0, w, h, 0.06, 'glass');
  for (const s of [-1, 1]) onWall(k, f, t + s * (w / 2 + 0.08), y0 - 0.02, 0.16, h + 0.04, 0.16, 'white');
  onWall(k, f, t, y1, w + 0.32, 0.16, 0.16, 'white');
  for (let i = 1; i < lights; i++) onWall(k, f, t - w / 2 + w * i / lights, y0, 0.12, h, 0.13, 'white');
  onWall(k, f, t, transom - 0.06, w, 0.12, 0.13, 'white');
  // lead cames: one horizontal per light row, kept thin and proud of the glass
  for (const yy of [y0 + (transom - y0) / 2, transom + (y1 - transom) / 2]) onWall(k, f, t, yy - 0.02, w, 0.04, 0.09, 'frame');
  onWall(k, f, t, y0 - 0.14, w + 0.4, 0.14, 0.22, 'stone');
}

/** Stepped gable as stacked brick boxes (solid), stone caps on each step; span along `axis` from a to b at c. */
function steppedGable(k: Kit, axis: 'x' | 'z', a: number, b: number, c: number, thick: number, y0: number, y1: number, steps: number) {
  const L = b - a, dh = (y1 - y0) / steps, inset = L / 2 / (steps + 0.5);
  for (let i = 0; i < steps; i++) {
    const s0 = a + inset * i, s1 = b - inset * i, ya = y0 + dh * i, yb = ya + dh;
    const g = new T.BoxGeometry(axis === 'x' ? s1 - s0 : thick, yb - ya, axis === 'x' ? thick : s1 - s0);
    k.add(g, 'brick', axis === 'x' ? (s0 + s1) / 2 : c, (ya + yb) / 2, axis === 'x' ? c : (s0 + s1) / 2);
    for (const e of [s0, s1]) {
      const cap = new T.BoxGeometry(axis === 'x' ? inset + 0.12 : thick + 0.12, 0.12, axis === 'x' ? thick + 0.12 : inset + 0.12);
      const m = e === s0 ? e + inset / 2 - 0.06 : e - inset / 2 + 0.06;
      k.add(cap, 'stone', axis === 'x' ? m : c, yb + 0.06, axis === 'x' ? c : m);
    }
  }
}

export function buildHuisMetDeHoofden(_w: number, _d: number, b: BuildingTools) {
  const k: Kit = local(b, AXIS_DEG, ORIGIN);
  const sinA = 0.17 / MAIN_W, F: Frame = frame([0, 0], [sinA, Math.sqrt(1 - sinA * sinA)]);
  const W: Frame = frame([13.87, 0.01], [0.01, 1]);
  const S = (f: Frame, t: number, y: number, w: number, h: number, d: number, c: Col, out = 0) => onWall(k, f, t, y, w, h, d, c, out);
  const P = (f: Frame, g: T.BufferGeometry, t: number, y: number, out: number, c: Col) => put(k, f, g, t, y, out, c);

  // ---------- masses ----------
  extrude(k, MAIN, 0, H.eaves, 'brick');
  extrude(k, WING, 0, H.wing, 'brick');
  extrude(k, WING_BACK, 0, H.wingBack, 'brick');
  extrude(k, REAR_LOW, 0, H.rearLow, 'brick');
  extrude(k, [[14.45, -4.05], [16.9, -4.05], [16.82, -11.65], [14.45, -11.65]], H.wingBack, H.wingBack + 0.12, 'slate');
  extrude(k, [[14.45, -11.75], [16.82, -11.75], [16.76, -19.3], [14.45, -19.25]], H.rearLow, H.rearLow + 0.12, 'slate');
  extrude(k, [[13.95, -0.05], [16.94, -0.07], [16.9, -4.05], [13.95, -4.05]], H.wing, H.wing + 0.1, 'slate');

  // ---------- roofs (3DBAG LoD2.2): cross roof, the roof behind the gable, two rear saddles ----------
  gable(k, 0, MAIN_W, -9.0, -0.45, H.eaves, H.ridge - H.eaves, 'x', 'slate', 'brick');
  gable(k, A - 4.07, A + 4.07, -5.2, -0.45, H.eaves, 7.4, 'z', 'slate', 'brick');
  gable(k, -0.18, A, -19.2, -4.6, H.eaves, H.rearRidge - H.eaves, 'z', 'slate', 'brick');
  gable(k, A, 14.5, -19.25, -4.6, H.eaves, H.rearRidge - H.eaves, 'z', 'slate', 'brick');
  // stepped side gables of the cross roof (the profile steps beside the front) and the double stepped rear gable
  steppedGable(k, 'z', -9.0, -0.3, 0.2, 0.42, H.eaves, H.ridge + 0.5, 6);
  steppedGable(k, 'z', -9.0, -0.3, MAIN_W - 0.2, 0.42, H.eaves, H.ridge + 0.5, 6);
  steppedGable(k, 'x', -0.18, A, -19.0, 0.4, H.eaves, H.rearRidge + 0.6, 5);
  steppedGable(k, 'x', A, 14.5, -19.05, 0.4, H.eaves, H.rearRidge + 0.6, 5);
  // chimneys on the party walls (3DBAG flats at 22.0-22.1)
  for (const [x0, x1, z0, z1] of [[0.0, 0.62, -4.9, -3.5], [13.4, 14.4, -5.2, -4.2]]) {
    k.add(new T.BoxGeometry(x1 - x0, 22.0 - 14, z1 - z0), 'brick', (x0 + x1) / 2, (14 + 22.0) / 2, (z0 + z1) / 2);
    k.add(new T.BoxGeometry(x1 - x0 + 0.2, 0.18, z1 - z0 + 0.2), 'stone', (x0 + x1) / 2, 22.0 + 0.09, (z0 + z1) / 2);
  }
  // dormers on the cross roof's front slope, two over each outer bay (RCE 20408929)
  const slope = (H.ridge - H.eaves) / 4.275;
  for (const t of [A - 5.2, A + 5.2]) for (const [yb, w, h] of [[14.15, 1.0, 1.25], [16.2, 0.85, 1.05]]) {
    const z = -0.45 - (yb - H.eaves) / slope; // front of the dormer where its sill meets the slope
    k.add(new T.BoxGeometry(w, h, 1.6).translate(0, h / 2, -0.8), 'slate', t, yb - 0.2, z);
    k.add(new T.BoxGeometry(w - 0.24, h - 0.36, 0.08), 'glass', t, yb + h / 2 - 0.12, z + 0.04);
    k.add(new T.BoxGeometry(w - 0.1, 0.1, 0.12), 'white', t, yb - 0.02, z + 0.06);
    k.add(new T.ConeGeometry(w * 0.78, 0.9, 4).rotateY(Math.PI / 4).translate(0, 0.45, -0.6), 'slate', t, yb + h - 0.2, z);
  }

  // ---------- canal front, main house ----------
  // sandstone plinth with the two arched cellar gates (lion masks on the keystones) and two barred basement windows
  S(F, MAIN_W / 2, 0, MAIN_W, H.plinth, 0.12, 'stone');
  S(F, MAIN_W / 2, H.plinth - 0.05, MAIN_W, 0.25, 0.2, 'stone');
  for (const t of [BAYS[0], BAYS[3]]) {
    archSlab(k, F, t, 0, 1.4, 1.75, 0.18, 'dark', -0.02);
    archBand(k, F, t, 0, 1.8, 1.95, 0.2, 0.2, 'stone', 0);
    P(F, sphere(0.16, 1, 1.15, 0.5), t, 1.86, 0.24, 'stone');
  }
  for (const t of [BAYS[1], BAYS[2]]) {
    S(F, t, 0.55, 0.95, 0.55, 0.17, 'dark');
    for (let i = -2; i <= 2; i++) S(F, t + i * 0.17, 0.55, 0.04, 0.55, 0.21, 'frame');
  }
  // bel-etage: four tall cross windows, relieving arches with keystones, stone blocks on the piers
  for (const t of BAYS) {
    crossWindow(k, F, t, H.bel0, H.bel1, 1.42, H.belTransom);
    // the outer bays carry the date stones over their windows instead of an arch
    if (t === BAYS[0] || t === BAYS[3]) continue;
    segBand(k, F, t, H.bel1 + 0.18, 2.0, 0.42, 0.24, 0.05, 'red');
    S(F, t, H.bel1 + 0.34, 0.3, 0.32, 0.1, 'stone');
  }
  const pierT = [0.37, (BAYS[0] + BAYS[1]) / 2, A - 1.55, A + 1.55, (BAYS[2] + BAYS[3]) / 2, MAIN_W - 0.22];
  for (const t of pierT) for (const y of [H.belTransom - 0.1, H.bel1 - 0.05]) S(F, t, y, t < 0.5 || t > MAIN_W - 0.5 ? 0.5 : 0.75, 0.22, 0.1, 'stone');
  // the six busts on their consoles, at the bel-etage
  for (const h of HEADS) for (const part of bust(h.who)) P(h.t > MAIN_W ? W : F, part.g, h.t > MAIN_W ? h.t - 13.87 : h.t, 4.2, 0, part.c);
  // cornice over the bel-etage, the "ANNO" and "1622" date stones over the outer windows
  S(F, MAIN_W / 2, H.cornice1, MAIN_W, 0.28, 0.28, 'stone');
  S(F, MAIN_W / 2, H.cornice1 + 0.28, MAIN_W, 0.06, 0.16, 'stone');
  for (const [t, text] of [[BAYS[0], 'ANNO'], [BAYS[3], '1622']] as const) {
    S(F, t, 7.0, 1.45, 0.4, 0.08, 'stone');
    for (const g of letterBoxes(text, 0.24, 1.2, 0.05)) P(F, g, t, 7.2, 0.1, 'frame');
  }

  // door portal: sandstone pilasters, arched door, entablature, window over the door flanked by cartouches, crowning
  // pediment with a lion-mask roundel; low double stoop with iron railing
  const doorY = 0.75;
  for (const s of [-1, 1]) {
    S(F, A + s * 1.05, doorY, 0.42, 4.0, 0.26, 'stone');
    S(F, A + s * 1.05, doorY + 0.9, 0.5, 0.18, 0.32, 'stone');
  }
  archSlab(k, F, A, doorY, 1.3, 3.0, 0.08, 'dark', 0);
  archBand(k, F, A, doorY, 1.75, 3.22, 0.22, 0.2, 'stone', 0);
  S(F, A, 4.5, 2.95, 0.38, 0.32, 'stone');
  crossWindow(k, F, A, 4.95, 6.25, 1.25, 5.6);
  for (const s of [-1, 1]) {
    poly(k, F, A + s * 0.95, 4.95, [[-0.22, 0], [0.22, 0], [0.26, 0.4], [0, 0.62], [-0.26, 0.4]], 0.16, 'stone', 0.06);
  }
  S(F, A, 6.35, 2.0, 0.22, 0.28, 'stone');
  poly(k, F, A, 6.57, [[-0.75, 0], [0.75, 0], [0.4, 0.55], [-0.4, 0.55]], 0.18, 'stone', 0);
  P(F, new T.CylinderGeometry(0.2, 0.2, 0.1, 10).rotateX(Math.PI / 2), A, 6.85, 0.24, 'stone');
  // stoop: landing in front of the door, flights down to the left and right
  k.add(new T.BoxGeometry(3.2, doorY, 1.5), 'stone', A, doorY / 2, 0.75);
  for (const s of [-1, 1]) for (let i = 0; i < 3; i++) {
    const h = doorY * (3 - i) / 4;
    k.add(new T.BoxGeometry(0.34, h, 1.3), 'stone', A + s * (1.77 + i * 0.32), h / 2, 0.68);
  }
  for (const s of [-1, 1]) {
    for (let i = 0; i <= 4; i++) k.add(new T.BoxGeometry(0.05, 0.95, 0.05), 'frame', A + s * (0.2 + i * 0.35), doorY + 0.47, 1.45);
    k.add(new T.BoxGeometry(1.5, 0.06, 0.07), 'frame', A + s * 0.9, doorY + 0.97, 1.45);
  }

  // second storey: five cross windows under relieving arches; on the piers a fruit festoon under a small oculus and a
  // vertical stone tablet
  for (const t of [BAYS[0], BAYS[1], A, BAYS[2], BAYS[3]]) {
    crossWindow(k, F, t, H.sec0, H.sec1, 1.36, H.secTransom);
    segBand(k, F, t, H.sec1 + 0.16, 1.9, 0.38, 0.22, 0.05, 'red');
    S(F, t, H.sec1 + 0.3, 0.28, 0.3, 0.1, 'stone');
  }
  for (const t of [0.37, (BAYS[0] + BAYS[1]) / 2, (BAYS[1] + A) / 2, (A + BAYS[2]) / 2, (BAYS[2] + BAYS[3]) / 2, MAIN_W - 0.22]) {
    for (const [dx, dy, r] of [[-0.14, 0.08, 0.08], [0, 0, 0.1], [0.14, 0.08, 0.08], [-0.07, -0.1, 0.07], [0.07, -0.1, 0.07]]) P(F, sphere(r, 1, 1, 0.7, 6, 4), t + dx, 9.1 + dy, 0.06, 'stone');
    P(F, new T.CylinderGeometry(0.12, 0.12, 0.06, 10).rotateX(Math.PI / 2), t, 9.45, 0.04, 'frame');
    S(F, t, 9.65, 0.24, 0.7, 0.08, 'stone');
    S(F, t, H.secTransom - 0.55, t < 0.5 || t > MAIN_W - 0.5 ? 0.5 : 0.7, 0.2, 0.1, 'stone');
  }
  // Comenius tablet between the second-storey window and the cornice on the axis (lettering too small to model)
  S(F, A, 11.15, 1.7, 0.36, 0.08, 'stone');
  // cornice under the gable and the balustrades
  S(F, MAIN_W / 2, H.cornice2, MAIN_W, 0.3, 0.3, 'stone');

  // ---------- stepped gable: stage 1 (third storey, three cross windows), stage 2, stage 3 ----------
  // the stage walls follow the BAG front's 0.7 degree skew (frame F), their faces on the facade plane
  const gableBox = (half: number, y0: number, y1: number) => slab(k, F, A, y0, half * 2, y1 - y0, 0.55, 'brick', -0.55);
  gableBox(4.07, H.eaves, H.stage1);
  gableBox(2.95, H.stage1, H.stage2);
  gableBox(1.5, H.stage2, H.stage3);
  for (const t of [A - 2.65, A, A + 2.65]) {
    crossWindow(k, F, t, H.third0, H.third1, 1.28, 13.07);
    segBand(k, F, t, H.third1 + 0.16, 1.8, 0.35, 0.2, 0.05, 'red');
  }
  S(F, A, H.stage1 - 0.22, 8.3, 0.28, 0.28, 'stone');
  // outer bays: balustrades in front of the roof, pedestal below and coping above
  for (const [t0, t1] of [[0.45, A - 4.07], [A + 4.07, MAIN_W - 0.45]]) {
    const L = t1 - t0, m = (t0 + t1) / 2;
    S(F, m, H.cornice2 + 0.3, L, 0.55, 0.22, 'stone');
    const n = Math.max(2, Math.floor(L / 0.3));
    for (let i = 0; i < n; i++) P(F, new T.CylinderGeometry(0.06, 0.09, 0.72, 6).translate(0, 0.36, 0), t0 + 0.2 + (L - 0.4) * (i + 0.5) / n, H.cornice2 + 0.85, 0.14, 'white');
    S(F, m, H.cornice2 + 1.57, L, 0.2, 0.26, 'stone');
    for (const t of [t0 + 0.12, t1 - 0.12]) S(F, t, H.cornice2 + 0.85, 0.3, 0.72, 0.22, 'stone');
  }
  // volutes (klauwstukken) at the shoulders, obelisks on stage 1, niches beside the stage-2 window
  const volute = (t: number, y: number, w: number, h: number, s: number) => {
    const pts: [number, number][] = [];
    for (let i = 0; i <= 8; i++) { const u = i / 8; pts.push([s * w * (1 - Math.sin(u * Math.PI / 2)), h * u]); }
    pts.push([0, h]); pts.push([0, 0]);
    poly(k, F, t, y, s < 0 ? pts.reverse() : pts, 0.24, 'stone', 0);
    P(F, new T.CylinderGeometry(0.14, 0.14, 0.26, 10).rotateX(Math.PI / 2), t + s * w * 0.85, y + 0.16, 0.13, 'stone');
  };
  for (const s of [-1, 1]) {
    volute(A + s * 4.07, H.cornice2 + 1.77, 0.75, H.stage1 - H.cornice2 - 1.99, s);
    volute(A + s * 2.95, H.stage1 + 0.06, 0.9, 1.6, s);
    volute(A + s * 1.5, H.stage2 + 0.06, 0.32, 1.2, s);
    // obelisk on the stage-1 shoulder
    const ob = A + s * 3.6;
    S(F, ob, H.stage1 + 0.06, 0.55, 0.35, 0.5, 'stone', -0.5);
    P(F, new T.CylinderGeometry(0.04, 0.2, 2.3, 4, 1).rotateY(Math.PI / 4), ob, H.stage1 + 1.56, -0.25, 'stone');
    P(F, sphere(0.1), ob, H.stage1 + 2.75, -0.25, 'stone');
    // arched niche (white plaster) and lion mask on stage 2
    archSlab(k, F, A + s * 1.95, 15.55, 0.7, 1.8, 0.06, 'white', 0);
    P(F, sphere(0.14, 1, 1.1, 0.5), A + s * 1.98, 17.75, 0.08, 'stone');
  }
  S(F, A, H.stage2 - 0.22, 6.2, 0.26, 0.28, 'stone');
  crossWindow(k, F, A, 15.1, 16.6, 1.3, 15.85);
  segBand(k, F, A, 16.75, 1.7, 0.3, 0.18, 0.05, 'red');
  // stage 3: arched niche between free-standing columns on the stage-2 cornice, entablature, vases, broken segmental
  // pediment, crowning block with scrolls, ball finial (RCE 20408929)
  archSlab(k, F, A, 18.7, 1.1, 1.55, 0.06, 'white', 0);
  for (const s of [-1, 1]) {
    const t = A + s * 1.95;
    S(F, t, H.stage2 + 0.04, 0.42, 0.3, 0.42, 'stone', -0.1);
    P(F, new T.CylinderGeometry(0.12, 0.14, 2.3, 8).translate(0, 1.15, 0), t, H.stage2 + 0.34, 0.12, 'white');
    S(F, t, 20.64, 0.4, 0.2, 0.44, 'stone', -0.1);
    P(F, new T.LatheGeometry([new T.Vector2(0.001, 0), new T.Vector2(0.13, 0.05), new T.Vector2(0.17, 0.25), new T.Vector2(0.08, 0.5), new T.Vector2(0.03, 0.62), new T.Vector2(0.001, 0.66)], 8), t, H.stage3, 0.1, 'stone');
  }
  S(F, A, 20.66, 4.3, 0.32, 0.34, 'stone', -0.1);
  // broken segmental pediment: two arc halves with a gap for the crowning block
  for (const s of [-1, 1]) {
    const pts: [number, number][] = [];
    for (let i = 0; i <= 6; i++) { const u = 0.35 + 0.65 * i / 6, x = s * 1.45 * u; pts.push([x, 0.75 * Math.cos(u * Math.PI / 2) + 0.0]); }
    for (let i = 6; i >= 0; i--) { const u = 0.35 + 0.65 * i / 6, x = s * 1.45 * u; pts.push([x, Math.max(0, 0.75 * Math.cos(u * Math.PI / 2) - 0.2)]); }
    poly(k, F, A, H.stage3, s < 0 ? pts.reverse() : pts, 0.3, 'stone', -0.1);
  }
  S(F, A, H.stage3, 1.0, 0.95, 0.4, 'brick', -0.15);
  S(F, A, H.stage3 + 0.95, 1.25, 0.18, 0.46, 'stone', -0.15);
  for (const s of [-1, 1]) P(F, new T.CylinderGeometry(0.13, 0.13, 0.3, 8).rotateZ(Math.PI / 2), A + s * 0.62, H.stage3 + 1.25, 0.05, 'stone');
  P(F, new T.CylinderGeometry(0.06, 0.12, 0.45, 6).translate(0, 0.22, 0), A, H.stage3 + 1.13, 0.05, 'stone');
  P(F, sphere(0.28, 1, 1, 1, 10, 8), A, H.stage3 + 1.82, 0.05, 'frame');

  // ---------- gateway wing (the "poortje" with the coachman's room over it) ----------
  S(W, WING_W / 2, 0, WING_W, H.plinth, 0.12, 'stone');
  for (const s of [-1, 1]) {
    S(W, WING_W / 2 + s * 1.3, 0, 0.45, 4.45, 0.24, 'stone');
    for (const y of [1.2, 2.5]) P(W, sphere(0.14, 1, 1.15, 0.5), WING_W / 2 + s * 1.3, y, 0.3, 'stone');
  }
  archSlab(k, W, WING_W / 2, 0, 1.8, 3.75, 0.08, 'dark', 0);
  archBand(k, W, WING_W / 2, 0, 2.2, 3.95, 0.2, 0.2, 'stone', 0);
  S(W, WING_W / 2, 4.45, WING_W, 0.5, 0.32, 'stone');
  for (const t of [1.0, 2.33]) {
    crossWindow(k, W, t, 5.15, 6.8, 0.68, 6.1, {lights: 1});
    segBand(k, W, t, 6.95, 0.95, 0.2, 0.16, 0.05, 'red');
  }
  S(W, WING_W / 2, 7.72, WING_W, 0.3, 0.3, 'stone');
  // crest: pedestal with volutes each side and three balls
  S(W, WING_W / 2, H.wing, 0.9, 0.85, 0.3, 'brick', -0.1);
  S(W, WING_W / 2, H.wing + 0.85, 1.05, 0.15, 0.36, 'stone', -0.1);
  for (const s of [-1, 1]) {
    const pts: [number, number][] = [];
    for (let i = 0; i <= 8; i++) { const u = i / 8; pts.push([s * (0.45 + 0.6 * (1 - Math.sin(u * Math.PI / 2))), 0.75 * u]); }
    pts.push([s * 0.45, 0.75]); pts.push([s * 0.45, 0]);
    poly(k, W, WING_W / 2, H.wing, s < 0 ? pts.reverse() : pts, 0.22, 'stone', -0.05);
    S(W, WING_W / 2 + s * 1.35, H.wing, 0.32, 0.3, 0.32, 'stone', -0.05);
    P(W, sphere(0.15), WING_W / 2 + s * 1.35, H.wing + 0.45, 0.11, 'stone');
  }
  P(W, sphere(0.17), WING_W / 2, H.wing + 1.17, 0.05, 'stone');
}

export const PLAN = {MAIN, WING, WING_BACK, REAR_LOW, MAIN_W, WING_W, DEPTH};
