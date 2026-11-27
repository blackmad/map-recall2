import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {getSink, ledgeStrip, poly, ringFrame, sashWindows, setSink, slab, type Frame} from './nearbar-kit';
import {glyphRuns} from './mixed-case-glyphs';
import source from './sluyswacht-footprints.json';

/**
 * DE SLUYSWACHT, Jodenbreestraat 1 (BAG pand 0363100012182908, bouwjaar 1695, rijksmonument): the lock-keeper's house on
 * the Sint Antoniessluis, a free-standing two-storey house with a pointed gable at each end, black-painted brick, white
 * frames and a pantile roof. The SW gable is the street front with "de Sluyswacht" painted across it; the NE gable stands
 * over the lock and the cafe terrace.
 *
 * Massing is authored, not the 3DBAG shell: the shell's SE eave (5.96 m against 6.89 m NW) makes the roof lopsided,
 * while both gables show straight rakes of about 56 deg either side of a central apex and the NE gable shows the SE eave
 * at the NW eave's height. The BAG ring's four corners (scripts/landmarks/sluyswacht-footprints.json; the fifth vertex
 * lies on the NE edge), walls to the 6.9 m eave, the 10.1 m 3DBAG ridge on the centre line, and the roof flaring out over
 * a short sprocket at each eave, which is what the white kneelers at the gable shoulders close.
 *
 * Read from Gemeente Amsterdam panoramas (CC BY 4.0), rectified at 50 px/m, t left to right facing the wall:
 *  - NW side (b_20250108_1349_Track08_Sphere_00001, 2025, w02-313.jpg): h = 7.0 + (178 - y) / 50.2, t = x / 50.2 from the NE end.
 *  - NE gable (TMX7316010203-000354_pano_0001_001178, 2017, square on; w04-44.jpg 2021): h = 7.0 + (95 - y) / 50, t from
 *    the E corner (the 2017 crop sits 0.3 m left of the 2021 one and of the gable's own centre; the 2021 axes are used).
 *  - SW street gable (TMX7316010203-001664_pano_0000_001558, 2020, and three more 41-43 m street views through a tree):
 *    h = 10.1 + (180 - y) / 50, axes symmetric about the centre (the crops disagree by up to 0.5 m).
 *  - SE side: no panorama (inferred: plain wall, eave board).
 */
type Src = {facadeRing: number[][]};
const src = source as unknown as Src;
const R = src.facadeRing;
/** The four corners: N, W, S, E (facadeRing[0] lies on the E-N edge). */
const RING = [R[1], R[2], R[3], R[4]];
const NW = ringFrame(RING, 0), SW = ringFrame(RING, 1), SE = ringFrame(RING, 2), NE = ringFrame(RING, 3);
/** `concrete` is the white boarding (eave, verge, kneeler) and the lantern glass: pale like the frames, but not an opening. */
type Col = 'brick' | 'red' | 'frame' | 'glass' | 'green' | 'dark' | 'white' | 'stone' | 'concrete';

const EAVE = 6.9, RIDGE = 10.1;
/** Sprocket: the roof flattens over the last 0.45 m inside the wall and 0.3 m out; its knee sits at KNEE. */
const KNEE_IN = 0.45, KNEE = 7.05, OVER = 0.3, LIP = 6.82, VERGE = 0.15;

// plan axes: u along the ridge from the SW gable to the NE gable, v across towards the NW side
const mid = (a: number[], c: number[]) => [(a[0] + c[0]) / 2, (a[1] + c[1]) / 2];
const MSW = mid(RING[1], RING[2]), MNE = mid(RING[3], RING[0]);
const LU = Math.hypot(MNE[0] - MSW[0], MNE[1] - MSW[1]);
const U = [(MNE[0] - MSW[0]) / LU, (MNE[1] - MSW[1]) / LU];
let V = [-U[1], U[0]];
{ const mNW = mid(RING[0], RING[1]); if ((mNW[0] - MSW[0]) * V[0] + (mNW[1] - MSW[1]) * V[1] < 0) V = [-V[0], -V[1]]; }
const HW = Math.abs((RING[0][0] - MSW[0]) * V[0] + (RING[0][1] - MSW[1]) * V[1]); // half width, NW wall to the ridge line
const at = (u: number, v: number, y: number) => new T.Vector3(MSW[0] + U[0] * u + V[0] * v, y, MSW[1] + U[1] * u + V[1] * v);

/** A board between four corners (a quad p0 p1 p2 p3 in order) thickened by `th` along its upward normal; flat-shaded. */
function board(b: BuildingTools, p: T.Vector3[], th: number, colour: Col) {
  const n = new T.Vector3().subVectors(p[1], p[0]).cross(new T.Vector3().subVectors(p[3], p[0])).normalize();
  if (n.y < 0) n.negate();
  const q = p.map(v => v.clone().addScaledVector(n, th));
  const c = [...p, ...q].reduce((s, v) => s.add(v), new T.Vector3()).multiplyScalar(1 / 8);
  const faces = [[0, 1, 2, 3], [7, 6, 5, 4], [0, 4, 5, 1], [1, 5, 6, 2], [2, 6, 7, 3], [3, 7, 4, 0]];
  const all = [...p, ...q], pos: number[] = [];
  for (const f of faces) {
    const [a, bq, cq, d] = f.map(i => all[i]);
    const fn = new T.Vector3().subVectors(bq, a).cross(new T.Vector3().subVectors(d, a));
    const fc = new T.Vector3().add(a).add(bq).add(cq).add(d).multiplyScalar(0.25);
    const tri = fn.dot(fc.clone().sub(c)) >= 0 ? [a, bq, cq, a, cq, d] : [a, cq, bq, a, d, cq];
    for (const v of tri) pos.push(v.x, v.y, v.z);
  }
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  b.add(g, colour as never);
}

export function buildSluyswacht(_w: number, _d: number, b: BuildingTools) {
  body(b);
  roof(b);
  const sink0 = getSink();
  setSink(0.04, true);
  for (const g of [SW, NE]) gableTrim(b, g.f, g.len, g === NE);
  nwSide(b);
  neGable(b);
  swGable(b);
  for (const s of [NW, SE]) slab(b, s.f, s.len / 2, LIP - 0.2, s.len + 2 * VERGE, 0.22, 0.05, 'concrete', OVER - 0.02); // white eave boards
  setSink(sink0);
}

/** Walls to the eave and the two gable triangles (their outline is the roof's underside). */
function body(b: BuildingTools) {
  const s = new T.Shape(RING.map(p => new T.Vector2(p[0], -p[1])));
  const g = new T.ExtrudeGeometry(s, {depth: EAVE, bevelEnabled: false});
  g.rotateX(-Math.PI / 2);
  b.add(g, 'brick' as never);
  for (const {f, len} of [SW, NE]) {
    const k = KNEE_IN, top = (RIDGE - KNEE) * (len / 2 - k) / (HW - k) + KNEE; // the apex on the centre line
    poly(b, f, 0, EAVE - 0.05, [[0, 0], [k, KNEE - EAVE + 0.05], [len / 2, top - EAVE + 0.05], [len - k, KNEE - EAVE + 0.05], [len, 0]], 0.3, 'brick', -0.3);
  }
}

/** Pantile roof: main slopes from the ridge to the knee, flatter sprockets to the lip, tile courses and a ridge capping. */
function roof(b: BuildingTools) {
  const u0 = -VERGE, u1 = LU + VERGE;
  for (const s of [1, -1]) {
    const vK = s * (HW - KNEE_IN), vL = s * (HW + OVER);
    board(b, [at(u0, 0, RIDGE), at(u1, 0, RIDGE), at(u1, vK, KNEE), at(u0, vK, KNEE)], 0.1, 'red');
    board(b, [at(u0, vK, KNEE), at(u1, vK, KNEE), at(u1, vL, LIP), at(u0, vL, LIP)], 0.1, 'red');
    // raised tile courses every 0.33 m down the main slope: a narrow board standing 3 cm proud
    const n = Math.floor(Math.hypot(HW - KNEE_IN, RIDGE - KNEE) / 0.33);
    for (let i = 1; i < n; i++) {
      const f = i / n, f2 = f + 0.025;
      const lift = (p: T.Vector3) => p.add(new T.Vector3(0, 0.1, 0));
      board(b, [lift(at(u0, vK * f, RIDGE + (KNEE - RIDGE) * f)), lift(at(u1, vK * f, RIDGE + (KNEE - RIDGE) * f)), lift(at(u1, vK * f2, RIDGE + (KNEE - RIDGE) * f2)), lift(at(u0, vK * f2, RIDGE + (KNEE - RIDGE) * f2))], 0.035, 'red');
    }
  }
  // ridge capping
  board(b, [at(u0, 0.14, RIDGE + 0.02), at(u1, 0.14, RIDGE + 0.02), at(u1, -0.14, RIDGE + 0.02), at(u0, -0.14, RIDGE + 0.02)], 0.14, 'red');
}

/** White verge boards along both rakes and the sprocket kneelers of a gable. */
function gableTrim(b: BuildingTools, F: Frame, len: number, ne: boolean) {
  const k = KNEE_IN, apex = (RIDGE - KNEE) * (len / 2 - k) / (HW - k) + KNEE;
  const line: [number, number][] = [[-OVER, LIP], [k, KNEE], [len / 2, apex], [len - k, KNEE], [len + OVER, LIP]];
  for (let i = 0; i + 1 < line.length; i++) {
    const [a, c] = [line[i], line[i + 1]], w = 0.2;
    poly(b, F, 0, 0, [[a[0], a[1] + 0.02], [c[0], c[1] + 0.02], [c[0], c[1] - w], [a[0], a[1] - w]], 0.05, 'concrete', 0.1);
  }
  // the NE gable's NW shoulder: a deeper white kneeler block under the sprocket (2017 crop x 200-232, y 92-97)
  if (ne) slab(b, F, len - 0.12, LIP - 0.12, 0.5, 0.2, 0.18, 'concrete', 0);
}

/** A window: white frame, glazing bars over `cols` x `rows` lights, optionally over a dark lower panel. */
function win(b: BuildingTools, F: Frame, t: number, w: number, y0: number, y1: number, cols: number, rows: number, panel = 0, panelCol: Col = 'dark') {
  if (panel > 0) {
    slab(b, F, t, y0 - 0.06, w + 0.14, panel + 0.06, 0.07, 'frame');
    slab(b, F, t, y0 + 0.04, w - 0.12, panel - 0.1, 0.11, panelCol);
  }
  sashWindows(b, F, [t], {lean: true, y: y0 + panel, w, h: y1 - y0 - panel, cols, rows, frame: 'frame', glass: 'glass'});
}

/** A hinged shutter standing open against the wall beside a window. */
const shutter = (b: BuildingTools, F: Frame, t: number, w: number, y0: number, y1: number) => {
  slab(b, F, t, y0, w, y1 - y0, 0.06, 'green');
  slab(b, F, t, (y0 + y1) / 2 - 0.03, w - 0.08, 0.06, 0.08, 'green');
};

function nwSide(b: BuildingTools) {
  const F = NW.f;
  const h = (y: number) => +(7.0 + (178 - y) / 50.2).toFixed(3), t = (x: number) => +(x / 50.2).toFixed(3);
  // the two lower windows (x 58-105 and 158-213, y 350-445): four lights over a dark panel
  for (const [x0, x1] of [[58, 105], [158, 213]]) win(b, F, (t(x0) + t(x1)) / 2, t(x1) - t(x0) - 0.12, h(445), h(350), 2, 2, 0.95);
  // the upper window (x 283-325, y 245-293) and its shutter hooked back on the right (x 330-362)
  win(b, F, (t(283) + t(325)) / 2, t(325) - t(283) - 0.12, h(293), h(245), 2, 2);
  shutter(b, F, (t(330) + t(362)) / 2, t(362) - t(330), h(293), h(255));
  dormer(b, F, (t(240) + t(292)) / 2, t(292) - t(240), h(168), h(112));
}

/** Flat-roofed dormer standing back on the roof slope: dark cheeks and front, a white-framed window, a lead top. */
function dormer(b: BuildingTools, F: Frame, t: number, w: number, y0: number, y1: number) {
  const slope = (RIDGE - KNEE) / (HW - KNEE_IN);
  const front = KNEE_IN + (y0 + 0.05 - KNEE) / slope, back = KNEE_IN + (y1 - KNEE) / slope + 0.15;
  slab(b, F, t, y0 - 0.25, w, y1 - y0 + 0.25, back - front, 'brick', -back);
  slab(b, F, t, y1, w + 0.16, 0.1, back - front + 0.1, 'dark', -back);
  sashWindows(b, F, [t], {lean: true, y: y0 + 0.17, w: 0.58, h: y1 - y0 - 0.32, cols: 2, rows: 2, frame: 'frame', glass: 'glass', snap: (f) => ({...f, origin: [f.origin[0] - f.n[0] * front, f.origin[1] - f.n[1] * front]})});
}

function neGable(b: BuildingTools) {
  const F = NE.f;
  // 2017 square-on crop: h = 7.0 + (95 - y) / 50; t from the 2021 crop's axes (= 2017 x / 50 + 0.3)
  const h = (y: number) => +(7.0 + (95 - y) / 50).toFixed(3), t = (x: number) => +(x / 50 + 0.3).toFixed(3);
  // first floor: two cross windows of 6 over 6 lights (x 20-90 and 132-200, y 180-265)
  for (const [x0, x1] of [[20, 90], [132, 200]]) win(b, F, (t(x0) + t(x1)) / 2, t(x1) - t(x0) - 0.14, h(265), h(181), 3, 4);
  // attic window (x 78-132, y 70-135) between dark-green shutters (x 53-75 and 135-155, 2017)
  win(b, F, (t(78) + t(132)) / 2, t(132) - t(78) - 0.14, h(135), h(70), 2, 3);
  shutter(b, F, (t(53) + t(75)) / 2, t(75) - t(53), h(133), h(74));
  shutter(b, F, (t(135) + t(157)) / 2, t(157) - t(135), h(133), h(74));
  // hoist window under the apex (x 85-122, y 0-45): white frame, two lights (2021 square-on crop)
  win(b, F, (t(85) + t(122)) / 2, t(122) - t(85) - 0.14, h(45), h(0), 1, 2);
  // ground storey (2021 crop w04-44.jpg, t = x / 50, heads 2.5 m): window over a dark shutter panel on the left,
  // a glazed door and a window under one transom of 2 x 4 lights on the right
  win(b, F, 1.21, 0.86, 0.1, 2.48, 2, 1, 1.75);
  slab(b, F, 3.44, 0, 1.96, 2.62, 0.07, 'frame');
  sashWindows(b, F, [2.98, 3.92], {lean: true, y: 2.02, w: 0.8, h: 0.46, cols: 4, rows: 1, frame: 'frame', glass: 'glass'});
  slab(b, F, 2.98, 0.04, 0.82, 1.9, 0.12, 'dark'); // door leaf
  slab(b, F, 2.98, 0.95, 0.5, 0.82, 0.17, 'glass');
  win(b, F, 3.92, 0.8, 0.04, 1.92, 2, 2, 0.9);
  // the black wall lantern on its bracket right of the first-floor window (2017 x 198, y 250-275)
  slab(b, F, 4.5, 3.72, 0.06, 0.06, 0.22, 'dark');
  slab(b, F, 4.5, 3.4, 0.18, 0.36, 0.18, 'dark', 0.2);
  slab(b, F, 4.5, 3.46, 0.12, 0.24, 0.24, 'concrete', 0.19);
}

function swGable(b: BuildingTools) {
  const F = SW.f, L = SW.len, c = L / 2;
  // first floor: two cross windows (2020 crop y 400-485, 1.3 m wide, 2.25 m apart)
  const h = (y: number) => +(10.1 + (180 - y) / 50).toFixed(3);
  for (const s of [-1, 1]) win(b, F, c + s * 1.12, 1.18, h(485), h(401), 3, 4);
  // two small attic windows (y 300-345)
  for (const s of [-1, 1]) win(b, F, c + s * 0.6, 0.5, h(345), h(302), 2, 2);
  // "de Sluyswacht" painted across the gable over the ground storey (2017-11 crop y 497-520)
  const px = 0.036, sy = 1.55, text = 'de Sluyswacht', {runs, width} = glyphRuns(text, px);
  for (const r of runs) ledgeStrip(b, F, c - width / 2 + (r.t0 + r.t1) / 2, h(520) + r.y0 * sy, r.t1 - r.t0, (r.y1 - r.y0) * sy, 0.025, 'white', 0.0);
  // ground storey at street level: the glazed door with its transom (left) and the window with its transom (right)
  const head = h(548);
  slab(b, F, 1.43, 0.8, 1.38, 0.12, 0.3, 'stone'); // door step
  slab(b, F, 1.43, 0.92, 1.3, head - 0.92 + 0.07, 0.07, 'frame');
  // a glazed door under its four-light transom: one glass field from the door's lock rail to the head, a dark rail below
  slab(b, F, 1.43, 0.97, 1.1, 0.5, 0.12, 'dark');
  sashWindows(b, F, [1.43], {lean: true, y: 1.5, w: 1.1, h: head - 1.56, cols: 4, rows: 1, frame: 'frame', glass: 'glass'});
  for (const y of [head - 0.5]) slab(b, F, 1.43, y, 1.1, 0.07, 0.17, 'frame');
  for (const s of [-1, 1]) slab(b, F, 1.43 + s * 0.2, 1.5, 0.05, head - 0.5 - 1.5, 0.17, 'frame');
  win(b, F, 3.38, 1.1, 1.3, head - 0.52, 3, 2);
  sashWindows(b, F, [3.38], {lean: true, y: head - 0.44, w: 1.1, h: 0.38, cols: 3, rows: 1, frame: 'frame', glass: 'glass'});
}
