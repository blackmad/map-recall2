import type {BuildingTools} from './cultural-builders';
import {addShell} from './worship-shell';
import type {Surface} from './worship-shell';
import {setSink, slab} from './nearbar-kit';
import {bayPrism, rawWall} from './big-kit';
import source from './overtoom-197-footprints.json';

/**
 * Overtoom 197-205 (BAG 0363100012236683, 1925): a 2,700 m2 Amsterdam School shop-and-flat block with a courtyard. Only the Overtoom
 * front (wall 5 plane, 43.6 m, t -20.08..23.50 in its own frame) is street-facing; the side and rear walls are 3DBAG shell.
 * Rhythm is read in pixels from three rectified municipal panoramas (artifacts/landmark-lanes/overtoom-197):
 *  - EAST block, nos. 195-199 side (rect-e.jpg, 40 px/m): a 20 m wide, 23 m high lighter-brick block with a stepped, dentilled white cornice;
 *    4 + 4 + 4 window axes per floor (side groups of four, a centre group of four French doors), three stacked balconies and a
 *    canopy over the centre six metres; dotted dark-brick courses above every row; Avis garage portal and shops on the ground floor.
 *  - WEST block, nos. 201-205 (rect-w-c.jpg, 44 px/m): a 22.9 m wide dark-brown block, four floors plus an attic row of small
 *    windows, eight window axes (single, wide, wide, bay, wide, bay, wide, single), concrete shop piers with dark/white fascias.
 * Photo heights are scaled per block so the cornice meets the 3DBAG roof edge (the rectifier's ground datum is not the 3DBAG one).
 * Not modelled: fire ladders at the balcony ends, signage lettering, the pavement furniture, the roof plant behind the cornice.
 */
const KW = 1.121, KE = 1.07;
const xw = (px: number) => px / 44 - 1, yw = (py: number) => (888 - py) / 44 * KW;
const xe = (px: number) => px / 40 - 22, ye = (py: number) => (982 - py) / 40 * KE;
type Conv = {x: (px: number) => number; y: (py: number) => number};
const W: Conv = {x: xw, y: yw}, E: Conv = {x: xe, y: ye};

export function buildOvertoom197(_w: number, _d: number, b: BuildingTools & {mark?: (n: string) => void}) {
  const r5 = rawWall(source as never, 5), f = r5.f;
  // Surfaces of the east block (lighter brick) are those whose centroid lies at t < 0.3 in the front frame.
  const tOf = (s: Surface) => { const r = s.rings[0]; const x = r.reduce((a, p) => a + p[0], 0) / r.length, z = r.reduce((a, p) => a + p[2], 0) / r.length; return (x - f.origin[0]) * f.tangent[0] + (z - f.origin[1]) * f.tangent[1]; };
  const east = (s: Surface) => s.type === 'WallSurface' && tOf(s) < 0.3;
  addShell(b, source as never, {wall: 'brick', roof: 'slate', skip: (s) => east(s)});
  addShell(b, source as never, {wall: 'ochre', roof: 'slate', skip: (s) => !east(s)});
  b.mark?.('shell');
  if (process.env.BIG_SHELL_ONLY) return;
  setSink(0.3);

  const px = (c: Conv, a: number, z: number) => ({t: (c.x(a) + c.x(z)) / 2, w: c.x(z) - c.x(a)});
  /** Window from pixel box [x0,x1,yTop,ySill]: cream frame, dark glass, mullions and a glazing-bar transom row. */
  const win = (c: Conv, x0: number, x1: number, yHead: number, ySill: number, o: {cols?: number; transoms?: number; sill?: boolean} = {}) => {
    const {t, w} = px(c, x0, x1), y = c.y(ySill), h = c.y(yHead) - y;
    if (o.sill !== false) slab(b, f, t, y - 0.1, w + 0.3, 0.1, 0.14, 'white');
    slab(b, f, t, y, w + 0.1, h + 0.1, 0.07, 'white');
    slab(b, f, t, y + 0.05, w - 0.1, h - 0.0, 0.1, 'glass');
    const cols = o.cols ?? Math.max(1, Math.round(w / 0.55));
    for (let k = 1; k < cols; k++) slab(b, f, t - w / 2 + w * k / cols, y, 0.05, h, 0.14, 'white');
    const tr = o.transoms ?? 1;
    for (let k = 0; k < tr; k++) slab(b, f, t, y + h * (0.62 + 0.1 * k) - 0.02, w, 0.05, 0.14, 'white');
  };
  const band = (c: Conv, x0: number, x1: number, y0: number, y1: number, col: string, d: number, out = 0) => { const {t, w} = px(c, x0, x1); slab(b, f, t, c.y(y1), w, c.y(y0) - c.y(y1), d, col, out); };
  /** Row of small dark-brick dots (the Amsterdam School toothing) above a window row. */
  const dots = (c: Conv, x0: number, x1: number, py: number) => { const t0 = c.x(x0), t1 = c.x(x1), n = Math.max(2, Math.round((t1 - t0) / 0.5)); for (let k = 0; k < n; k++) slab(b, f, t0 + (k + 0.5) * (t1 - t0) / n, c.y(py), 0.22, 0.13, 0.07, 'greyBrick'); };
  /** Dentilled white cornice: a white capping band over a row of dentil blocks. */
  const cornice = (c: Conv, x0: number, x1: number, pyTop: number, pyBot: number) => {
    const t0 = c.x(x0), t1 = c.x(x1), yT = c.y(pyTop), yB = c.y(pyBot), n = Math.round((t1 - t0) / 0.55);
    slab(b, f, (t0 + t1) / 2, yT - 0.2, t1 - t0, 0.2, 0.34, 'white');
    for (let k = 0; k < n; k++) slab(b, f, t0 + (k + 0.5) * (t1 - t0) / n, yB, 0.28, yT - 0.2 - yB, 0.2, 'white');
  };

  // ================= WEST block (nos. 201-205) =================
  {
    const ROWS: [number, number][] = [[598, 681], [459, 545], [321, 408]], ATTIC: [number, number] = [241, 270];
    // [x0, x1, kind]: s = single narrow, w = wide, b = canted bay
    const cols: [number, number, 's' | 'w' | 'b'][] = [[62, 112, 's'], [153, 270, 'w'], [332, 448, 'w'], [483, 543, 'b'], [588, 693, 'w'], [731, 786, 'b'], [818, 900, 'w'], [944, 990, 's']];
    for (const [x0, x1, kind] of cols) {
      const {t, w} = px(W, x0, x1);
      for (const [hd, sl] of ROWS) {
        if (kind === 'b') {
          const y = yw(sl), h = yw(hd) - y;
          bayPrism(b, f, t, y - 0.12, w + 0.1, h + 0.22, 0.34, 0.2, 'white');
          slab(b, f, t, y, w - 0.12, h, 0.37, 'glass');
          for (const k of [-0.5, 0.5]) slab(b, f, t + k * (w - 0.3) / 1, y, 0.05, h, 0.4, 'white');
          slab(b, f, t, y + h * 0.66, w - 0.1, 0.05, 0.39, 'white');
        } else win(W, x0, x1, hd, sl, {cols: kind === 's' ? 1 : Math.round(w / 0.75), transoms: kind === 's' ? 1 : 2});
      }
      if (kind !== 'b' || true) win(W, x0 + 4, x1 - 4, ATTIC[0], ATTIC[1], {cols: Math.max(2, Math.round(w / 0.5)), transoms: 0, sill: false});
    }
    for (const rows of [[598, 590], [459, 451], [321, 313]]) dots(W, 40, 1030, rows[1]);
    // shop band: dark fascia (tempo team / JMW) and a white fascia (BIYU), piers, shopfronts
    band(W, 30, 562, 683, 740, 'dark', 0.22);
    band(W, 562, 1040, 683, 740, 'white', 0.22);
    band(W, 30, 75, 740, 888, 'concrete', 0.2); band(W, 270, 328, 740, 888, 'concrete', 0.2); band(W, 520, 562, 740, 888, 'concrete', 0.2);
    band(W, 712, 780, 740, 888, 'white', 0.2); band(W, 975, 1040, 740, 888, 'white', 0.2);
    for (const [a, c] of [[30, 75], [272, 326], [520, 545], [712, 780]]) band(W, a, c, 835, 888, 'stone', 0.26);
    for (const [a, c] of [[125, 270, ], [328, 520], [565, 712], [780, 985]]) {
      band(W, a, c, 745, 868, 'glass', 0.1);
      band(W, a, c, 743, 748, 'frame', 0.16);
      band(W, a, c, 785, 789, 'frame', 0.16);
      band(W, a, c, 866, 872, 'frame', 0.16);
      const n = Math.round((W.x(c) - W.x(a)) / 1.4);
      for (let k = 0; k <= n; k++) band(W, a + (c - a) * k / n - 2, a + (c - a) * k / n + 2, 745, 868, 'frame', 0.16);
    }
    band(W, 75, 122, 745, 880, 'concrete', 0.12); band(W, 465, 520, 745, 880, 'white', 0.12);   // doors 201 and 203
    band(W, 80, 118, 750, 872, 'white', 0.18);
    band(W, 780, 985, 745, 790, 'dark', 0.2);
    // lettering as flat strips: logo disc and "tempo team" (red), JMW (orange)
    band(W, 155, 250, 705, 724, 'red', 0.12); band(W, 385, 462, 706, 726, 'ochre', 0.12);
    band(W, 852, 925, 706, 722, 'dark', 0.12);
    cornice(W, 30, 1040, 195, 172);
    band(W, 38, 1040, 150, 172, 'slate', 0.34);
  }

  // ================= EAST block (Avis, no. 197) =================
  {
    const ROW: [number, number][] = [[665, 735], [535, 600], [395, 460]];
    const side = [153, 203, 253, 303, 672, 722, 772, 822], centre = [411, 461, 511, 561];
    for (const c of side) for (const [hd, sl] of ROW) win(E, c - 18, c + 18, hd, sl, {cols: 2, transoms: 1});
    for (const c of side.concat(centre)) if (c < 330 || c > 640) { /* attic windows are separate */ }
    for (const c of centre) {
      win(E, c - 18, c + 18, ROW[0][0], ROW[0][1], {cols: 2, transoms: 1});
      win(E, c - 18, c + 18, 535, 612, {cols: 2, transoms: 1, sill: false});
      win(E, c - 18, c + 18, 395, 468, {cols: 2, transoms: 1, sill: false});
      win(E, c - 18, c + 18, 262, 310, {cols: 2, transoms: 0, sill: false});
    }
    for (const c of [179, 229, 279, 697, 747, 799]) win(E, c - 19, c + 19, 255, 300, {cols: 2, transoms: 0});
    for (const py of [645, 512, 380]) { dots(E, 135, 322, py); dots(E, 655, 845, py); dots(E, 380, 600, py); }
    for (const py of [790]) { dots(E, 100, 322, py); dots(E, 655, 880, py); }
    // balconies: slab top py, 1.3 m deep, from px 347 to 637
    const BX0 = 347, BX1 = 637, DEP = 1.3;
    for (const top of [612, 468, 310]) {
      const {t, w} = px(E, BX0, BX1), y = ye(top);
      slab(b, f, t, y - 0.32, w, 0.32, DEP, 'white');
      for (const bx of [BX0 + 22, BX1 - 22, (BX0 + BX1) / 2]) slab(b, f, E.x(bx), y - 1.15, 0.2, 0.85, 0.5, 'white');
      slab(b, f, t, y + 0.92, w, 0.06, 0.06, 'frame', DEP - 0.08);
      slab(b, f, t, y + 0.04, w, 0.05, 0.05, 'frame', DEP - 0.08);
      const n = Math.round(w / 0.28);
      for (let k = 0; k <= n; k++) slab(b, f, t - w / 2 + w * k / n, y + 0.04, 0.03, 0.92, 0.03, 'frame', DEP - 0.07);
      for (const s of [-1, 1]) { slab(b, f, t + s * (w / 2 - 0.03), y + 0.04, 0.05, 0.95, 0.05, 'frame', DEP - 0.08); slab(b, f, t + s * (w / 2 - 0.03), y + 0.92, 0.05, 0.06, DEP - 0.2, 'frame', 0); }
      slab(b, f, t, y - 0.32, w + 0.12, 0.04, DEP + 0.06, 'white', -0.03);
    }
    // canopy over the top balcony
    { const {t, w} = px(E, 372, 607); slab(b, f, t, ye(250), w, ye(205) - ye(250), 1.35, 'white'); slab(b, f, t, ye(250) - 0.04, w + 0.1, 0.08, 1.4, 'white'); }
    // roofline: dentilled white cornices (centre block higher than the wings)
    cornice(E, 305, 690, 135, 103); cornice(E, 95, 305, 180, 148); cornice(E, 690, 880, 175, 143);
    // ground floor: Avis shops and garage portal
    band(E, 98, 880, 800, 982, 'white', 0.03);
    band(E, 98, 142, 930, 982, 'stone', 0.24); band(E, 322, 358, 930, 982, 'stone', 0.24); band(E, 598, 640, 930, 982, 'stone', 0.24); band(E, 836, 880, 930, 982, 'stone', 0.24);
    band(E, 148, 318, 850, 965, 'glass', 0.1); band(E, 148, 318, 846, 852, 'frame', 0.14); band(E, 148, 318, 960, 967, 'frame', 0.14);
    band(E, 655, 830, 850, 965, 'dark', 0.1); band(E, 655, 830, 846, 852, 'frame', 0.14); band(E, 655, 830, 960, 967, 'frame', 0.14);
    band(E, 378, 596, 818, 982, 'dark', 0.1);
    band(E, 378, 596, 818, 848, 'concrete', 0.2);     // grey louvre band at the head of the portal
    band(E, 360, 380, 815, 982, 'white', 0.22); band(E, 594, 616, 815, 982, 'white', 0.22);
    band(E, 325, 655, 750, 800, 'red', 0.24);          // AVIS Autoverhuur
    band(E, 137, 252, 800, 838, 'red', 0.2); band(E, 252, 368, 800, 838, 'dark', 0.2);
    band(E, 605, 722, 800, 838, 'dark', 0.2); band(E, 722, 840, 800, 838, 'red', 0.2);
  }
  setSink(0);
}
