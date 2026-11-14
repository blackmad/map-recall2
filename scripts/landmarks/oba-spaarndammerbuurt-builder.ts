import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {ringFrame, roofHeightAt, slab, ledgeStrip, setSink, put, type Frame} from './nearbar-kit';
import {addShellTess, beginFacade, quad} from './big-facade';
import type {ShellSource} from './worship-shell';
import {columns, shellGroups, shellWalls, shellWindow, sill, wallLetters} from './houthavens-shell';
import type {RawWall} from './big-kit';
import {barRailing, roundedFrontPath} from '../../src/canalRecall/landmarks/barRailing';
import raw from './oba-spaarndammerbuurt-footprints.json';

/**
 * OBA Spaarndammerbuurt, Spaarndammerstraat 490: the public library on the ground floor of a 1981 apartment block (BAG pand
 * 0363100012127052, bouwjaar 1981; the library is the 545 m2 bijeenkomstfunctie verblijfsobject at no. 490, PDOK BAG).
 * OSM node 2788129544, Wikidata Q60290410.
 *
 * Identity: the red "oba" letters over the shop front and the red-and-white blade sign beside the entrance on the panoramas
 * (TMX7316010203-002854 2019, and 2022). The right-hand balcony stack in the photos is ring edge 5 of this pand (4.3 m, set
 * 0.17 m forward, 3DBAG 12.9 m), mirroring the left one.
 *
 * Massing is the 3DBAG LoD2.2 shell (CC BY 4.0; native east/south metres, ground 0.6 m NAP): the apartment block to 15.8 m
 * (its NW end to 12.9), the library hall behind it to 4.3-4.6 m. The Spaarndammerstraat front (ring edge 3, facing SW, t from
 * its NW end) measured on the rectified 2019 panorama (38.5 px/m across, 37 px/m up, ground at py 930):
 *  - t 0-3.9: a stack of three rounded white balconies with dark rails and a canopy slab, white wall with glazed doors;
 *  - t 3.9-8.8: dark grey-brown brick, two columns of white-framed windows with a white panel under each, four storeys;
 *  - t 8.8-13.3: the central white bay: three rounded balconies, glazed doors, narrow side lights, a white top storey;
 *  - t 13.3-18.6: brick with a column of wide three-light windows (French rails on the 2nd and 3rd storey), two on the top;
 *  - ground storey: shop glazing in dark blue frames between concrete piers, a white cornice at 2.4 m, then a brick fascia
 *    carrying the red "oba" letters (t 4.4-6.0) and a projecting red blade sign (t 8.4).
 * Brick colour: the 2019 panorama reads #4f4b48 (backlit), the 2022 one #878177; the model takes #6a625d between them, which
 * is the dark-brick ruling question of 2026-11-12, left to the user (see the lane report).
 * INFERRED: the rear (garden) face's window rows and the hall's rear windows (the rear panorama crop is a close-up behind a tree).
 */
const src = raw as unknown as ShellSource & {facadeRing: number[][]};
type V2 = [number, number];
const R = src.facadeRing.map(p => [p[0], p[1]] as V2);
let b: BuildingTools;
const FLOORS = [3.6, 6.5, 9.4, 12.3];

function topAt(f: Frame, t: number): number {
  const x = f.origin[0] + f.tangent[0] * t - f.n[0] * 0.4, z = f.origin[1] + f.tangent[1] * t - f.n[1] * 0.4;
  return roofHeightAt(src.surfaces as never, x, z) ?? 0;
}

/** A skin segment over t0..t1 of the front: 0.55 m into the shell, `O` proud, top 0.12 m over the roof line. */
function skin(f: Frame, t0: number, t1: number, O: number, colour: string) {
  const top = Math.max(topAt(f, Math.max(t0 + 0.3, 0.3)), topAt(f, (t0 + t1) / 2)) + 0.12;
  slab(b, f, (t0 + t1) / 2, 0, t1 - t0, top, 0.55 + O, colour, -0.55);
}

/** A framed window on the skin: frame ring, sill, glass, optional mullions and a white panel beneath (the brick bays). */
function win(f: Frame, O: number, t0: number, t1: number, y0: number, y1: number, o: {frame?: string; lights?: number; panelBelow?: number; rail?: boolean} = {}) {
  const fr = o.frame ?? 'frame', c = (t0 + t1) / 2, w = t1 - t0, pb = o.panelBelow ?? 0, ring = 0.07;
  quad(b, f, c, y0 - pb, w, y1 - y0 + pb, fr, O + 0.045);
  sill(b, f, c, y0 - pb, w, fr, O);
  quad(b, f, c, y0 + ring, w - 2 * ring, y1 - y0 - 2 * ring, 'glass', O + 0.09);
  const n = o.lights ?? Math.max(1, Math.round(w / 0.9));
  for (let k = 1; k < n; k++) quad(b, f, t0 + (w * k) / n, y0 + ring, 0.06, y1 - y0 - 2 * ring, fr, O + 0.135);
  if (o.rail) {
    setSink(0);
    slab(b, f, c, y0 + 0.95, w * 0.5, 0.04, 0.05, 'copper', O + 0.15);
    for (let t = c - w * 0.25 + 0.03; t < c + w * 0.25; t += 0.11) quad(b, f, t, y0 + 0.1, 0.018, 0.85, 'copper', O + 0.17);
    setSink(0.3, true);
  }
}

/**
 * A rounded balcony as on the 2022 panorama: a white slab 0.4 m thick with its two front corners rounded (radius r), `d`
 * deep from the plane 0.3 m behind the face, top at y, and a see-through bar railing (src/canalRecall/landmarks/barRailing:
 * top rail, bottom rail, bars at 13 cm) along its open front edge, 6 cm in from the slab edge.
 */
function roundBalcony(f: Frame, O: number, t0: number, t1: number, y: number, d: number, r: number, rail = true) {
  const s = new T.Shape(), rr = r;
  s.moveTo(t0, 0);
  s.lineTo(t1, 0);
  s.lineTo(t1, d - rr);
  s.absarc(t1 - rr, d - rr, rr, 0, Math.PI / 2, false);
  s.lineTo(t0 + rr, d);
  s.absarc(t0 + rr, d - rr, rr, Math.PI / 2, Math.PI, false);
  s.lineTo(t0, 0);
  // shape x = t, shape y = depth; rotateX(+90 deg) sends shape y to +z (out of the wall) and the extrusion downwards
  const slabG = new T.ExtrudeGeometry(s, {depth: 0.4, bevelEnabled: false, curveSegments: 4}).rotateX(Math.PI / 2);
  put(b, f, slabG, 0, y, O - 0.3, 'pink');
  if (!rail) return;
  const m = barRailing(roundedFrontPath(t0 + 0.06, t1 - 0.06, 0.3, d - 0.06, r - 0.06, 4), {height: 1.0});
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.Float32BufferAttribute(m.positions, 3));
  g.setIndex(m.indices);
  g.computeVertexNormals();
  put(b, f, g, 0, y, O - 0.3, 'copper');
}

/** The Spaarndammerstraat front (ring edge 3). Pixels of the rectified 2019 crop: t = px / 38.5, y = (930 - py) / 37. */
function front() {
  // 3DBAG cuts the front into pieces up to 0.08 m proud of the BAG line (the central bay): the skin stands 0.25 m proud
  const {f, len} = ringFrame(R, 3), O = 0.25;
  const tx = (px: number) => Math.min(len - 0.1, px / 38.5), ty = (py: number) => (930 - py) / 37;
  // wall segments: white stack wall, brick, white central bay, brick
  skin(f, 0.06, 3.9, O, 'stone');
  skin(f, 3.9, 8.85, O, 'brick');
  skin(f, 8.85, 13.3, O, 'stone');
  skin(f, 13.3, len - 0.06, O, 'brick');
  // ground storey: concrete piers, shop glazing in dark blue frames, white cornice, brick fascia above
  for (const [x0, x1] of [[150, 175], [330, 355], [505, 520], [680, 712]]) slab(b, f, (tx(x0) + tx(x1)) / 2, 0, tx(x1) - tx(x0), 2.4, 0.08, 'concrete', O);
  for (const [x0, x1, top] of [[25, 148, 845], [177, 328, 845], [357, 503, 840], [522, 678, 845]]) win(f, O, tx(x0) + 0.05, tx(x1) - 0.05, 0.06, ty(top), {frame: 'dark', lights: Math.round((x1 - x0) / 38.5 / 1.1)});
  for (const [a, c] of [[3.95, 11.2], [11.2, len - 0.08]]) ledgeStrip(b, f, (a + c) / 2, 2.32, c - a, 0.2, 0.16, 'stone', O);   // in two (open strips past ~14 m read as holes)
  // brick windows: two columns, white panel under each, four storeys (the top one taller, a white panel over it)
  const rows: [number, number][] = [[700, 760], [590, 650], [480, 540], [375, 445]];
  for (const [k, [top, bot]] of rows.entries()) for (const [x0, x1] of [[185, 225], [263, 305]]) {
    win(f, O, tx(x0), tx(x1), ty(bot), ty(top), {panelBelow: k < 3 ? 0.4 : 0, lights: 2});
    if (k === 3) slab(b, f, (tx(x0) + tx(x1)) / 2, ty(top) + 0.12, tx(x1) - tx(x0), ty(352) - ty(top) - 0.12, 0.05, 'stone', O);
  }
  // right brick bay: wide three-light windows (French rails on the 2nd and 3rd storeys), two windows on the top storey
  for (const [k, [top, bot]] of rows.slice(0, 3).entries()) win(f, O, tx(550), tx(668), ty(bot + 15), ty(top - 5), {lights: 3, rail: k > 0, panelBelow: 0.2});
  for (const [x0, x1] of [[550, 590], [628, 668]]) win(f, O, tx(x0), tx(x1), ty(445), ty(370), {lights: 2});
  // left stack: glazed doors behind the balconies, three rounded balconies and a canopy slab
  for (const y of FLOORS.slice(0, 3)) win(f, O, tx(25), tx(115), y + 0.05, y + 2.3, {lights: 3});
  for (const y of FLOORS.slice(0, 3)) roundBalcony(f, O, 0.12, 3.15, y, 1.6, 0.6);
  roundBalcony(f, O, 0.12, 3.6, 12.6, 1.7, 0.6, false);
  // central bay: glazed doors, narrow side lights, rounded balconies; the white top storey with four windows
  for (const y of FLOORS.slice(0, 3)) {
    win(f, O, tx(375), tx(482), y + 0.05, y + 2.3, {lights: 3});
    win(f, O, tx(345), tx(366), y + 0.6, y + 2.3, {lights: 1});
    win(f, O, tx(490), tx(510), y + 0.6, y + 2.3, {lights: 1});
    roundBalcony(f, O, tx(362), tx(490), y, 1.5, 0.55);
  }
  for (const [x0, x1] of [[345, 366], [398, 426], [432, 460], [490, 510]]) win(f, O, tx(x0), tx(x1), ty(465), ty(398), {lights: 1});
  // the library's signs: red "oba" letters on the fascia, a projecting red blade beside the entrance
  wallLetters(b, f, 'oba', (tx(168) + tx(230)) / 2, ty(830), 0.62, 1.7, 'red', O, 0.06);
  setSink(0);
  slab(b, f, tx(321), ty(838), 0.1, 0.9, 0.62, 'red', O);
  slab(b, f, tx(321), ty(838) + 0.25, 0.18, 0.32, 0.5, 'sandstone', O + 0.06);   // white field with the logo, both faces
  setSink(0.3, true);
}

/** The right-hand balcony stack (ring edge 5, crop px 715-865): white wall, glazed doors, three rounded balconies, canopy. */
function rightStack() {
  const {f, len} = ringFrame(R, 5), O = 0.1;
  skin(f, 0.06, len - 0.06, O, 'stone');
  win(f, O, 0.3, len - 0.3, 0.06, 2.3, {frame: 'dark', lights: 3});
  for (const y of FLOORS.slice(0, 3)) win(f, O, 0.5, len - 0.5, y + 0.05, y + 2.3, {lights: 3});
  for (const y of FLOORS.slice(0, 3)) roundBalcony(f, O, 0.12, len - 0.12, y, 1.6, 0.6);
  roundBalcony(f, O, 0.12, len - 0.12, 12.6, 1.7, 0.6, false);
}

/**
 * INFERRED rear (garden) and courtyard faces of the apartments and the library hall, dressed as the 2020 rear photo (w01-64)
 * shows them: the front's brick with white frames (a top light over two casements) on a white sill course. Party walls on
 * ring edges 0 and 8 and the street front stay as they are.
 */
function rear() {
  const party = [0, 8].map(i => [R[i], R[(i + 1) % R.length]] as [V2, V2]);
  const near = (m: V2, [a, c]: [V2, V2]) => {
    const L = Math.hypot(c[0] - a[0], c[1] - a[1]), tx = (c[0] - a[0]) / L, tz = (c[1] - a[1]) / L;
    return Math.abs((m[0] - a[0]) * tz - (m[1] - a[1]) * tx) < 0.6;
  };
  const one = (w: RawWall, t: number, y: number, ww: number, wh: number) => {
    if (!shellWindow(b, w, t, y, ww, wh, {frame: 'frame', mullion: true, transom: wh * 0.68, ring: 0.1})) return;
    ledgeStrip(b, w.f, t, y - 0.1 - 0.06 - 0.1, ww + 0.36, 0.1, 0.1, 'stone');                      // white sill course
  };
  for (const w of shellWalls(src, 2.4, 2.4)) {
    if (Math.abs(((w.bearing - 244 + 540) % 360) - 180) < 30) continue;                           // the street front
    const m: V2 = [w.f.origin[0] + w.f.tangent[0] * w.len / 2, w.f.origin[1] + w.f.tangent[1] * w.len / 2];
    if (party.some(p => near(m, p))) continue;
    if (w.base >= 3.5) for (const y of FLOORS.map(v => v + 0.9).filter(v => v >= w.base + 0.35)) for (const t of columns(w.len, 2.7, 1.0)) one(w, t, y, 1.4, 1.5);
    else if (w.top < 6) for (const t of columns(w.len, 3.6, 1.2)) one(w, t, 1.0, 1.6, 1.8);
  }
}

export function buildObaSpaarndammerbuurt(_w: number, _d: number, tools: BuildingTools) {
  b = tools;
  for (const [key, g] of shellGroups(src, () => 'brick', () => 'concrete')) addShellTess(b, g, {wall: key.slice(2), roof: key.slice(2)});
  beginFacade(src);
  setSink(0.3, true);
  front();
  rightStack();
  rear();
  setSink(0);
}
