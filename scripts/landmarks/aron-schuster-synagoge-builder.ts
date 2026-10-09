import type {BuildingTools} from './cultural-builders';
import {addShell} from './worship-shell';
import {archWindow, wallPoint} from './worship-kit';
import {onWall, wallsOf, type Wall} from './worship-walls';
import source from './aron-schuster-synagoge-footprints.json';

/**
 * Raw Aron Schuster Synagoge (Obrechtsjoel), Jacob Obrechtplein / Heinzestraat, Harry Elte 1928, Amsterdam School.
 * Massing is the 3DBAG LoD2.2 shell (hall, tower, side blocks, 22.6 m tower). The facade features come from the 2025
 * municipal panoramas: the north-west wall on Jacob Obrechtplein (arched side door, pair of tall steel-framed windows with a
 * plaque beside them, small windows above), the covered entrance in the recess west of the strip-windowed hall wall (flat
 * concrete canopy with a dark inscription band on posts, double doors, steps), the five small strip windows, and the slit
 * windows of the tower. The Hebrew fascia inscription is represented as a plain dark band (letters not reproduced).
 */
const walls = wallsOf(source as never);
const W = (i: number): Wall => {
  const w = walls.find(x => x.index === i);
  if (!w) throw Error(`wall #${i}`);
  return w;
};

/** Steel-framed tall window pane with grid bars. */
function steelPane(b: BuildingTools, w: Wall, t: number, y: number, wd: number, h: number) {
  const f = 0.06;
  onWall(b, w, t, y, wd, h, 0.06, 'glass', 0.02, 'pane');
  onWall(b, w, t, y, wd, f, 0.1, 'frame', 0.02);
  onWall(b, w, t, y + h - f, wd, f, 0.1, 'frame', 0.02);
  onWall(b, w, t - wd / 2 + f / 2, y, f, h, 0.1, 'frame', 0.02);
  onWall(b, w, t + wd / 2 - f / 2, y, f, h, 0.1, 'frame', 0.02);
  for (let k = 1; k <= 4; k++) onWall(b, w, t, y + h * k / 5, wd, 0.04, 0.09, 'frame', 0.02);
  onWall(b, w, t - wd / 6, y, 0.04, h, 0.09, 'frame', 0.02);
  onWall(b, w, t + wd / 6, y, 0.04, h, 0.09, 'frame', 0.02);
}

/** Small white-framed window with stone sill. */
function smallWindow(b: BuildingTools, w: Wall, t: number, y: number, wd: number, h: number, frame = 'white') {
  onWall(b, w, t, y - 0.07, wd + 0.14, 0.07, 0.12, 'concrete', 0);
  onWall(b, w, t, y, wd, h, 0.06, 'glass', 0.02, 'pane');
  onWall(b, w, t, y, wd, 0.05, 0.09, frame, 0.02);
  onWall(b, w, t, y + h - 0.05, wd, 0.05, 0.09, frame, 0.02);
  onWall(b, w, t - wd / 2 + 0.025, y, 0.05, h, 0.09, frame, 0.02);
  onWall(b, w, t + wd / 2 - 0.025, y, 0.05, h, 0.09, frame, 0.02);
}

export function buildAronSchusterSynagoge(_w: number, _d: number, b: BuildingTools) {
  addShell(b, source as never, {wall: 'brick', roof: 'slate'});
  (b as {mark?: (n: string) => void}).mark?.('shell');

  // ---- north-west wall on Jacob Obrechtplein (#133, t runs from its east end to the west)
  const nw = W(133);
  archWindow(b, nw, 1.9, 0, 1.15, 2.7, {trim: 'greyBrick', glass: 'dark', mullions: 0, round: true});
  onWall(b, nw, 1.9, 0, 1.4, 0.18, 0.4, 'concrete', 0); // threshold
  steelPane(b, nw, 4.4, 0.85, 1.15, 3.35);
  steelPane(b, nw, 5.85, 0.85, 1.15, 3.35);
  onWall(b, nw, 5.15, 4.2, 3.4, 0.3, 0.1, 'greyBrick', 0); // soldier-course lintel
  onWall(b, nw, 5.15, 0.7, 3.4, 0.15, 0.1, 'greyBrick', 0); // sill course
  onWall(b, nw, 7.05, 1.0, 1.5, 0.45, 0.06, 'concrete', 0); // inscription plaque
  smallWindow(b, nw, 2.05, 4.7, 0.75, 0.9);
  smallWindow(b, nw, 4.35, 5.5, 0.75, 0.9);
  smallWindow(b, nw, 6.7, 5.5, 0.75, 0.9);

  // ---- covered entrance in the recess (#8): canopy with dark inscription fascia, double doors, steps
  const en = W(8), el = en.length, mid = el / 2;
  onWall(b, en, mid, 0, 1.7, 2.7, 0.1, 'ochre', 0.02); // timber double doors
  onWall(b, en, mid, 0, 0.06, 2.7, 0.14, 'dark', 0.02);
  onWall(b, en, mid - 1.15, 0.2, 0.55, 2.1, 0.08, 'glass', 0.02, 'pane');
  onWall(b, en, mid + 1.15, 0.2, 0.55, 2.1, 0.08, 'glass', 0.02, 'pane');
  onWall(b, en, mid, 3.5, 5.0, 0.18, 2.4, 'white', 0); // canopy slab
  onWall(b, en, mid, 3.68, 5.0, 0.45, 0.1, 'white', 2.4); // cream fascia on the front edge
  onWall(b, en, mid, 3.82, 4.5, 0.17, 0.04, 'dark', 2.5); // inscription strip (letters not reproduced)
  for (const dt of [-2.3, 2.3]) {
    const q = wallPoint(en, mid + dt, 2.2);
    b.box(q[0], 0, q[1], 0.14, 3.5, 0.14, 'white');
  }
  for (let s = 0; s < 2; s++) { const q = wallPoint(en, mid, 0.2 + s * 0.35); b.box(q[0], 0, q[1], 2.6, 0.14 * (2 - s), 0.4, 'concrete', Math.atan2(en.n[0], en.n[1])); }

  // ---- five small strip windows on the hall wall east of the entrance (#110) and its stone course
  const hall = W(110);
  onWall(b, hall, hall.length / 2, 4.1, hall.length, 0.14, 0.16, 'white', 0);
  for (let k = 0; k < 5; k++) smallWindow(b, hall, hall.length / 2 + (k - 2) * 1.2, 7.6, 0.8, 0.65, 'frame');
  for (const t of [1.4, 3.2]) smallWindow(b, hall, t, 2.7, 0.7, 0.6, 'frame');
  onWall(b, hall, hall.length / 2, 11.9, hall.length + 0.4, 0.3, 0.55, 'white', 0); // projecting roof slab

  // ---- tower: slit windows and stone coping
  const tn = W(14), te = W(12);
  for (const w of [tn, te]) {
    for (const f of [0.3, 0.7]) onWall(b, w, w.length * f, 13.0, 0.22, 6.0, 0.08, 'dark', 0.01);
    onWall(b, w, w.length / 2, 22.0, w.length - 0.1, 0.3, 0.2, 'concrete', -0.05);
  }
}
