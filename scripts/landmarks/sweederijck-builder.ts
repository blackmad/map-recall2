import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {addShell, type Surface} from './worship-shell';
import {archSlab, getSink, put, ringFrame, setSink, slab, type Frame} from './nearbar-kit';
import {balustrade} from '../../src/canalRecall/landmarks/balustrade';
import source from './sweederijck-footprints.json';

/**
 * SWEEDERIJCK, HERENGRACHT (BAG pand 0363100012176171, rijksmonument 1859: house, core c. 1671, stone front, empire; the
 * register lists the stoop, the attic, the glazing bars, the entrance and sculpture). The corner of the Herengracht and the
 * Nieuwe Spiegelstraat.
 *
 * Massing: the 3DBAG LoD2.2 shell (footprints.json, bag-shell-prepare.ts), front wall top 15.6 m, roof to 19 m.
 *
 * Canal front (facade ring edge 0, 14.9 m, w01-43) read from the rectified Gemeente Amsterdam panoramas
 * TMX7316010203-001975_pano_0000_000569 (2021, frontal, overcast; w01-43.alt.jpg) and TMX7316010203-000355_pano_0000_000773
 * (2017, frontal; w01-43.jpg), CC BY 4.0. The 2021 crop is 50.1 px/m across: t = x / 50.1 from the front's east end;
 * heights h = (790 - y) / 49.5, fitted to the 3DBAG's 15.6 m wall top at the cornice crown (y 18). Symmetric about the
 * door (t 7.58):
 *  - grey sandstone laid in bands (joints every 0.33 m) between plain pilaster strips: wide ones at both corners, narrow
 *    ones between the outer and inner axes and either side of the centre bay;
 *  - five axes of white sash windows with glazing bars: the bel-etage (h 2.1-5.4), the first storey (6.9-9.9), the low
 *    second storey (11.5-13.1);
 *  - the entrance: an arched double door of dark varnished wood under a radial fanlight, between pilasters carrying an
 *    entablature at the first-storey sill, two wall lanterns, and the straight stoop down to the pavement;
 *  - two statues on the entablature either side of the centre window (2017 crop; the 2021 crop shows the east one);
 *  - string courses at the first- and second-storey sills and under the attic; the attic band with paired oval windows over
 *    the outer axes; the cornice, and the white roof balustrade over the three middle axes;
 *  - the basement behind iron area railings, with barred lights under the windows.
 */
type Src = {facadeRing: number[][]; surfaces: Surface[]};
const src = source as unknown as Src;
const FRONT = ringFrame(src.facadeRing, 0);
const F = FRONT.f, L = FRONT.len;
type Col = 'sandstone' | 'concrete' | 'white' | 'frame' | 'glass' | 'stone' | 'brick' | 'ochre' | 'bronze' | 'slate' | 'dark';

const t = (x: number) => +(x / 50.1).toFixed(3);
const h = (y: number) => +((790 - y) / 49.5).toFixed(3);
const MID = 7.58;
const AXES = [MID - 5.38, MID - 2.92, MID, MID + 2.92, MID + 5.38];
const WIN_W = 1.6;
const BASE = h(705); // the bel-etage floor and the top of the stone basement: 1.72 m
const ROWS = {g: [h(685), h(522)], f1: [h(447), h(298)], f2: [h(222), h(140)]} as const;
const BANDS: [number, number][] = [[h(470), h(448)], [h(275), h(255)], [h(130), h(110)]];
const CORNICE: [number, number] = [h(50), 15.6];
const SKIN = 0.1; // the banded stone face stands 10 cm proud of the 3DBAG wall; windows sit in its reveals
const DOOR = {t0: t(330), t1: t(432), spring: h(575)};
const PIL = [[0.05, 0.75], [MID - 4.15 - 0.22, MID - 4.15 + 0.22], [MID - 1.79 - 0.2, MID - 1.79 + 0.2], [MID + 1.79 - 0.2, MID + 1.79 + 0.2], [MID + 4.15 - 0.22, MID + 4.15 + 0.22], [L - 0.75, L - 0.05]] as const;

export function buildSweederijck(_w: number, _d: number, b: BuildingTools) {
  addShell(b, src as never, {wall: 'brick', roof: 'slate', wallFor: (_s, i) => (frontSurface.has(i) ? 'sandstone' : 'brick')});
  const sink0 = getSink();
  setSink(0.04);
  front(b);
  setSink(sink0);
}

/** 3DBAG walls in the front plane (the canal face is sandstone; every other wall is the side's dark brick). */
const frontSurface = new Set<number>();
src.surfaces.forEach((s, i) => {
  if (s.type !== 'WallSurface') return;
  const r = s.rings[0];
  if (r.every(p => Math.abs((p[0] - F.origin[0]) * F.n[0] + (p[2] - F.origin[1]) * F.n[1]) < 0.15)) frontSurface.add(i);
});

/** Openings in the stone skin: [t0, t1, y0, y1]. */
function openings(): [number, number, number, number][] {
  const o: [number, number, number, number][] = [];
  for (const a of AXES) {
    for (const [k, [y0, y1]] of Object.entries(ROWS)) {
      if (k === 'g' && a === MID) continue;
      o.push([a - WIN_W / 2, a + WIN_W / 2, y0, y1]);
    }
  }
  o.push([DOOR.t0, DOOR.t1, BASE, DOOR.spring + (DOOR.t1 - DOOR.t0) / 2]);
  return o;
}

function front(b: BuildingTools) {
  const holes = openings();
  // grey stone basement under the bel-etage, with its barred lights under the outer windows (one in view in 2021, x 80-150)
  slab(b, F, L / 2, 0, L - 0.1, BASE, SKIN + 0.04, 'stone');
  for (const a of AXES) {
    if (a === MID) continue;
    slab(b, F, a, 0.4, 1.4, 1.0, 0.02, 'glass', SKIN + 0.12);
    for (let k = 1; k < 8; k++) slab(b, F, a - 0.7 + k * 1.4 / 8, 0.4, 0.03, 1.0, 0.03, 'bronze', SKIN + 0.16);
  }
  // banded sandstone: courses 0.29 m tall with 0.04 m joints, cut round the openings and stopped at the bands
  for (let y = BASE; y < CORNICE[0] - 0.1; y += 0.33) {
    const y1 = Math.min(y + 0.29, CORNICE[0]);
    if (BANDS.some(([a, c]) => y < c && y1 > a)) continue;
    const cuts = holes.filter(o => y1 > o[2] && y < o[3]).map(o => [o[0] - 0.02, o[1] + 0.02] as [number, number]).sort((p, q) => p[0] - q[0]);
    // 5 cm clear of the party walls at both ends, so no end face lies in their planes
    let p0 = 0.05;
    for (const [c0, c1] of [...cuts, [L - 0.05, L - 0.05] as [number, number]]) {
      if (c0 - p0 > 0.05) slab(b, F, (p0 + c0) / 2, y, c0 - p0, y1 - y, SKIN, 'sandstone');
      p0 = Math.max(p0, c1);
    }
  }
  // string courses and the attic band
  for (const [y0, y1] of BANDS) slab(b, F, L / 2, y0, L - 0.1, y1 - y0, SKIN + 0.1, 'concrete');
  // plain pilaster strips over the banding, basement to cornice (2017: shadows at x 165, 280, 470, 590 and both corners)
  for (const [a, c] of PIL) {
    const segs: [number, number][] = [[BASE, CORNICE[0]]];
    for (const [s0, s1] of segs) slab(b, F, (a + c) / 2, s0, c - a, s1 - s0, SKIN + 0.06, 'sandstone');
  }
  // windows
  for (const a of AXES) {
    for (const [k, [y0, y1]] of Object.entries(ROWS)) {
      if (k === 'g' && a === MID) continue;
      sash(b, a, y0, y1, k === 'f2' ? 2 : 4);
    }
  }
  entrance(b);
  // statues on the entablature either side of the centre window (2017: x 290 and 450, y 385-445)
  for (const x of [290, 452]) statue(b, t(x), h(447) + 0.02);
  // attic: paired oval windows in a sunk panel over the outer axes (2021: x 68-100, 112-148; y 65-85)
  for (const a of [AXES[0], AXES[4]]) {
    slab(b, F, a, h(110) + 0.02, 2.0, h(55) - h(110) - 0.02, SKIN + 0.04, 'concrete'); // between the pilaster strips
    // ovals at x 84 and 130 px (centres 0.92 m apart, 0.24 m of stone between them), mirrored on the west axis
    for (const s of [-1, 1]) oval(b, a + s * 0.46, (h(85) + h(65)) / 2, 0.34, 0.21);
  }
  // cornice: bed moulding, corona and crown
  slab(b, F, L / 2, CORNICE[0], L - 0.1, 0.2, SKIN + 0.2, 'concrete');
  slab(b, F, L / 2, CORNICE[0] + 0.2, L - 0.1, 0.25, SKIN + 0.45, 'concrete');
  slab(b, F, L / 2, CORNICE[0] + 0.45, L - 0.1, CORNICE[1] - CORNICE[0] - 0.45, SKIN + 0.6, 'sandstone');
  // the white roof balustrade over the three middle axes (2017: x 195-560 px), on the cornice
  const bw = t(560) - t(195);
  const lay = balustrade({width: bw, height: 0.85, post: 0.24, plinth: 0.12, rail: 0.12, baluster: 0.12, pitch: 0.24, bays: 3});
  const by = CORNICE[1];
  for (const p of lay.posts) slab(b, F, (t(195) + t(560)) / 2 + p.x, by + p.y, p.w, p.h, 0.3, 'white', SKIN + 0.2);
  for (const k of lay.balusters) slab(b, F, (t(195) + t(560)) / 2 + k.x, by + k.y, k.w, k.h, 0.14, 'white', SKIN + 0.28);
  slab(b, F, (t(195) + t(560)) / 2, by, bw, 0.12, 0.3, 'white', SKIN + 0.2);
  slab(b, F, (t(195) + t(560)) / 2, by + 0.85 - 0.12, bw + 0.1, 0.12, 0.34, 'white', SKIN + 0.18);
  // a statue on the balustrade over the fourth axis (2017 review view: on the parapet, right of centre)
  statue(b, 10.2, by + 0.85);
  // area railings along the front, either side of the stoop (2021: black bars, y 680-770)
  railing(b, 0.3, DOOR.t0 - 0.35);
  railing(b, DOOR.t1 + 0.35, L - 0.3);
}

/** A white sash window in the stone reveal: glass, frame, glazing bars, a stone sill. */
function sash(b: BuildingTools, a: number, y0: number, y1: number, rows: number) {
  // white frame 0.13 m (2021 crop: 6-7 px at 50 px/m), meeting rail 0.1 m, glazing bars 0.06 m, so the frames still read
  // white at gallery and sheet distance
  const w = WIN_W - 0.04, B = 0.13;
  slab(b, F, a, y0, w, y1 - y0, 0.02, 'glass', 0.04);
  for (const s of [-1, 1]) slab(b, F, a + s * (w / 2 - B / 2), y0, B, y1 - y0, 0.04, 'frame', 0.06);
  slab(b, F, a, y0, w, B, 0.04, 'frame', 0.06);
  slab(b, F, a, y1 - B, w, B, 0.04, 'frame', 0.06);
  slab(b, F, a, y0 + (y1 - y0) / 2 - 0.05, w, 0.1, 0.04, 'frame', 0.06); // meeting rail
  slab(b, F, a, y0, 0.06, y1 - y0, 0.03, 'frame', 0.065);
  for (let r = 1; r < rows; r++) if (r * 2 !== rows) slab(b, F, a, y0 + r * (y1 - y0) / rows - 0.03, w, 0.06, 0.03, 'frame', 0.065);
  slab(b, F, a, y0 - 0.12, WIN_W + 0.2, 0.12, SKIN + 0.12, 'concrete');
}

function entrance(b: BuildingTools) {
  const tc = (DOOR.t0 + DOOR.t1) / 2, w = DOOR.t1 - DOOR.t0, r = w / 2;
  // double door of dark varnished wood with raised panels (2021: x 330-432, y 580-705)
  slab(b, F, tc, BASE, w, DOOR.spring - BASE, 0.04, 'ochre', 0.04);
  for (const s of [-1, 1]) for (const [y0, y1] of [[BASE + 0.25, BASE + 1.1], [BASE + 1.35, DOOR.spring - 0.2]]) slab(b, F, tc + s * w / 4, y0, w / 2 - 0.3, y1 - y0, 0.03, 'ochre', 0.08);
  slab(b, F, tc, BASE, 0.05, DOOR.spring - BASE, 0.04, 'dark', 0.08);
  // radial fanlight
  archSlab(b, F, tc, DOOR.spring, w, r, 0.02, 'glass', 0.04, 12);
  for (let k = 1; k < 8; k++) {
    const a = Math.PI * k / 8;
    put(b, F, new T.BoxGeometry(0.04, r, 0.03).translate(0, r / 2, 0.015).rotateZ(a - Math.PI / 2), tc, DOOR.spring, 0.06, 'frame');
  }
  slab(b, F, tc, DOOR.spring - 0.04, w, 0.08, 0.04, 'frame', 0.06);
  // stone archivolt with a keystone
  for (let k = 0; k <= 10; k++) {
    const a = Math.PI * k / 10, rr = r + 0.12;
    put(b, F, new T.BoxGeometry(0.32, 0.24, SKIN + 0.12).translate(0, 0, (SKIN + 0.12) / 2).rotateZ(a - Math.PI / 2), tc + Math.cos(a) * rr, DOOR.spring + Math.sin(a) * rr, 0, 'concrete');
  }
  slab(b, F, tc, DOOR.spring + r, 0.36, 0.5, SKIN + 0.18, 'concrete');
  // pilasters and the entablature carrying the statues (2021: x 297-327 and 435-465; y 448-470)
  for (const x of [312, 450]) {
    slab(b, F, t(x), BASE, 0.6, h(470) - BASE, SKIN + 0.16, 'concrete');
    slab(b, F, t(x), h(470) - 0.3, 0.72, 0.3, SKIN + 0.22, 'sandstone');
  }
  slab(b, F, tc, h(470), t(490) - t(270), h(448) - h(470), SKIN + 0.3, 'concrete');
  slab(b, F, tc, h(448), t(495) - t(265), 0.16, SKIN + 0.42, 'sandstone');
  // wall lanterns on brackets (2021: x 293 and 470, y 565-610)
  for (const x of [293, 470]) {
    slab(b, F, t(x), h(610) - 0.05, 0.06, 0.06, 0.45, 'bronze', SKIN);
    slab(b, F, t(x), h(610), 0.28, h(565) - h(610), 0.28, 'bronze', SKIN + 0.3);
    slab(b, F, t(x), h(610) + 0.08, 0.2, h(565) - h(610) - 0.18, 0.2, 'white', SKIN + 0.34);
  }
  // the stoop: five steps straight down to the pavement, iron railings either side (2021: y 705-765)
  const rise = BASE / 5, run = 0.3, sw = w + 0.5;
  for (let k = 0; k < 5; k++) slab(b, F, tc, 0, sw, BASE - k * rise, 0.55 + k * run, 'stone', SKIN);
  for (const s of [-1, 1]) {
    const x = tc + s * (sw / 2 - 0.03);
    const S: Frame = {origin: [F.origin[0] + F.tangent[0] * x, F.origin[1] + F.tangent[1] * x], tangent: [F.n[0], F.n[1]], n: [-F.tangent[0] * s, -F.tangent[1] * s]};
    for (let k = 0; k <= 6; k++) { const u = SKIN + 0.1 + k * 0.33; slab(b, S, u, Math.max(0, BASE - Math.max(0, u - SKIN - 0.55) / run * rise), 0.025, 1.0, 0.025, 'bronze'); }
    put(b, S, new T.BoxGeometry(2.1, 0.05, 0.05).translate(1.05, 0, 0).rotateZ(-Math.atan2(BASE, 5 * run)), SKIN + 0.1, BASE + 0.95, 0, 'bronze');
  }
}

/** A standing figure on a block plinth (simplified: plinth, draped body, shoulders, head). */
function statue(b: BuildingTools, at: number, y: number) {
  const out = SKIN + 0.12;
  slab(b, F, at, y, 0.46, 0.2, 0.36, 'concrete', out - 0.06);
  slab(b, F, at, y + 0.2, 0.36, 0.65, 0.26, 'sandstone', out);
  slab(b, F, at, y + 0.85, 0.42, 0.16, 0.24, 'sandstone', out);
  const head = new T.SphereGeometry(0.12, 8, 6).translate(0, 0.12, 0);
  put(b, F, head, at, y + 1.0, out + 0.13, 'sandstone');
}

/** An oval window: dark glass standing 5 cm proud of a white frame disc 0.09 m larger (flattened discs). */
function oval(b: BuildingTools, at: number, yc: number, rx: number, ry: number) {
  const k = ry / rx;
  put(b, F, new T.CylinderGeometry(rx + 0.09, rx + 0.09, 0.06, 20).rotateX(Math.PI / 2).scale(1, k, 1).translate(0, 0, 0.03), at, yc, SKIN + 0.02, 'white');
  put(b, F, new T.CylinderGeometry(rx, rx, 0.04, 20).rotateX(Math.PI / 2).scale(1, k, 1).translate(0, 0, 0.02), at, yc, SKIN + 0.09, 'glass');
}

/** Black iron area railing 1.0 m tall, 1.3 m in front of the basement. */
function railing(b: BuildingTools, t0: number, t1: number) {
  const out = SKIN + 1.3, n = Math.round((t1 - t0) / 0.14);
  slab(b, F, (t0 + t1) / 2, 0.95, t1 - t0, 0.05, 0.05, 'bronze', out);
  slab(b, F, (t0 + t1) / 2, 0.1, t1 - t0, 0.04, 0.04, 'bronze', out);
  for (let k = 0; k <= n; k++) slab(b, F, t0 + k * (t1 - t0) / n, 0, 0.022, 1.05, 0.022, 'bronze', out + 0.01);
}
