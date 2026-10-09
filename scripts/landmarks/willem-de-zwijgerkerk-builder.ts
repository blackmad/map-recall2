import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {addShell} from './worship-shell';
import {onWall, wallsOf, type Wall} from './worship-walls';
import {archWindow, wallBetween, wallPoint} from './worship-kit';
import source from './willem-de-zwijgerkerk-footprints.json';

/**
 * Willem de Zwijgerkerk, Olympiaweg 14 (Cornelis Kruyswijk, 1931, Amsterdam School). Dark red-brown brick, dark tiled roofs:
 * a steep N-S nave with gables at both ends, pent-roofed aisles with a row of small clerestory windows above them, a
 * transverse north gable with a 6-window ground row and a 3-window group over a white ledge, and a slender clock tower beside
 * the south gable. Massing is the 3DBAG LoD2.2 shell; the tower needle is cut at 31 m and rebuilt as a stone cornice, green
 * copper clock drum and dome (3DBAG top 36.1 m). References: municipal panoramas 2025-07-29 (12-06-07_02930 north gable,
 * 13-09-56_00001 east wall, 13-09-56_00010 entrance/tower) and a Wikimedia Commons view of the south gable and tower.
 */
const TOWER_CUT = 31;
const patched = {
  ...source,
  surfaces: (source.surfaces as {type: string; rings: number[][][]}[]).map(s => {
    const ys = s.rings[0].map(p => p[1]);
    if (s.type === 'WallSurface' && Math.max(...ys) > TOWER_CUT) return {...s, rings: s.rings.map(r => r.map(p => [p[0], Math.min(p[1], TOWER_CUT), p[2]]))};
    return s;
  }).filter(s => !(s.type === 'RoofSurface' && Math.min(...s.rings[0].map(p => p[1])) > 30)),
};
const walls = new Map(wallsOf(patched as never).map(w => [w.index, w]));
const wall = (i: number): Wall => walls.get(i)!;

/** Window with a thick pale surround (Amsterdam School reveals), glass and glazing bars. */
function win(b: BuildingTools, w: Wall, t: number, y: number, wd: number, h: number, bars = 2, surround = 0.12, sill = false) {
  const s = surround;
  onWall(b, w, t, y - s, wd + 2 * s, h + 2 * s, 0.07, 'frame', 0); // pale reveal
  onWall(b, w, t, y, wd, h, 0.06, 'glass', 0.04, 'pane');
  for (let k = 1; k <= bars; k++) onWall(b, w, t - wd / 2 + wd * k / (bars + 1), y, 0.05, h, 0.1, 'frame', 0.04);
  onWall(b, w, t, y + h * 0.55, wd, 0.05, 0.1, 'frame', 0.04);
  if (sill) onWall(b, w, t, y - s - 0.08, wd + 2 * s + 0.2, 0.09, 0.16, 'stone', 0);
}

export function buildWillemDeZwijgerkerk(_w: number, _d: number, b: BuildingTools) {
  addShell(b, patched as never, {wall: 'brick', roof: 'slate'});
  (b as {mark?: (n: string) => void}).mark?.('shell');

  // --- Clock tower (walls 36 front, 49 side, 108, 87), clamped at 31 m ---
  const tf = wall(36), ts = wall(49);
  for (const [w, t0] of [[tf, 1.5], [ts, 1.9]] as [Wall, number][]) {
    win(b, w, t0, 8.0, 0.7, 3.0, 1, 0.1); // tall slit window
    for (const dt of [-0.55, 0, 0.55]) onWall(b, w, t0 + dt, 27.6, 0.3, 2.3, 0.05, 'dark', 0.01); // louvre slots under the cornice
  }
  archWindow(b, tf, 1.5, 0, 1.5, 2.9, {trim: 'stone', glass: 'dark', mullions: 1}); // arched entrance in the tower foot
  onWall(b, tf, 1.5, 3.7, 0.45, 0.45, 0.1, 'stone', 0); // medallion head over the arch
  const th = Math.atan2(tf.n[0], tf.n[1]), cx = -1.15, cz = 22.0;
  b.box(cx, TOWER_CUT, cz, 3.5, 0.4, 4.5, 'stone', th);
  const prof = [[1.3, 0], [1.3, 2.7], [1.55, 2.85], [1.55, 3.1], [1.0, 3.3], [0.55, 3.7], [0.04, 4.1]].map(p => new T.Vector2(p[0], p[1]));
  b.add(new T.LatheGeometry(prof, 14), 'copper' as never, cx, TOWER_CUT + 0.4, cz);
  b.add(new T.CylinderGeometry(0.06, 0.06, 1.0, 5), 'copper' as never, cx, TOWER_CUT + 0.4 + 4.1 + 0.45, cz);
  for (let k = 0; k < 4; k++) { // clock dials on the drum
    const a = th + k * Math.PI / 2, nx = Math.sin(a), nz = Math.cos(a);
    for (const [r, off, col] of [[0.78, 1.31, 'dark'], [0.68, 1.34, 'white']] as [number, number, string][]) {
      const d = new T.CylinderGeometry(r, r, 0.06, 18);
      d.rotateX(Math.PI / 2); d.rotateY(a);
      b.add(d, col as never, cx + nx * off, TOWER_CUT + 0.4 + 1.5, cz + nz * off);
    }
  }

  // --- South gable (walls 15 + 84 form one plane; apex 20.8 m at t=6.6): tall narrow window and apex slit ---
  const sg = wallBetween([0.96, 19.74], [11.7, 15.13], 21, [0.394, 0.919]);
  win(b, sg, 6.6, 8.2, 1.0, 5.6, 2, 0.14, true);
  onWall(b, sg, 6.6, 17.4, 0.4, 1.7, 0.06, 'dark', 0.01);
  onWall(b, sg, 6.6, 15.6, 0.7, 1.3, 0.05, 'stone', 0.01);

  for (const [t, y, wd] of [[0.5, 10.9, 1.5], [11.1, 12.9, 0.9]] as [number, number, number][]) onWall(b, sg, t, y, wd, 0.16, 0.9, 'white', 0); // corner eave canopies

  // --- North transverse gable: dark plinth, six tall windows, three-window group over a white ledge ---
  const ng = wallBetween([-2.83, -15.59], [-10.23, -12.38], 15.5, [-0.399, -0.917]);
  const c = ng.length / 2;
  onWall(b, ng, c, 0, ng.length, 2.0, 0.05, 'greyBrick', 0.0);
  for (let k = 0; k < 6; k++) win(b, ng, c + (k - 2.5) * 1.12, 2.2, 0.72, 2.5, 2, 0.1, true);
  onWall(b, ng, c, 6.9, 4.6, 0.16, 0.3, 'stone', 0);
  for (const dt of [-1.55, 0, 1.55]) win(b, ng, c + dt, 7.2, dt === 0 ? 1.2 : 0.7, 1.6, dt === 0 ? 3 : 2, 0.08);

  // --- East side: six wide low windows in the aisle wall (48), nine clerestory windows (18 + 43 plane), dark plinth ---
  const ea = wall(48);
  onWall(b, ea, ea.length / 2, 0, ea.length, 1.7, 0.05, 'greyBrick', 0.0);
  for (let k = 0; k < 6; k++) win(b, ea, 1.9 + k * 2.55, 1.9, 1.7, 1.1, 1, 0.13);
  const ec = wallBetween([3.06, -10.43], [10.46, 6.78], 10.6, [0.92, -0.39]);
  ec.origin = [ec.origin[0] - ec.n[0] * 0.09, ec.origin[1] - ec.n[1] * 0.09]; // the shell's two clerestory walls sit 9 cm behind the chord between their ends
  for (let k = 0; k < 9; k++) win(b, ec, 1.2 + k * 2.0, 8.85, 1.0, 1.35, 1, 0.08);
  // --- West side (hidden behind the housing block; mirrored from the east evidence): clerestory + aisle windows ---
  const wc = wallBetween([-3.36, 11.43], [-10.14, -4.31], 10.5, [-0.918, 0.396]);
  for (let k = 0; k < 8; k++) win(b, wc, 1.2 + k * 2.0, 8.85, 1.0, 1.35, 1, 0.08);
  const wa = wall(91);
  for (let k = 0; k < 3; k++) win(b, wa, 1.5 + k * 2.6, 1.7, 1.6, 1.1, 1, 0.12);
  void wallPoint;
}
