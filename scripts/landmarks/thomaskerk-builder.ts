import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {addShell} from './worship-shell';
import {onWall, wallsOf, wallTop, type Wall} from './worship-walls';
import {wallPoint} from './worship-kit';
import source from './thomaskerk-footprints.json';

/**
 * De Thomas / Thomaskerk, Prinses Irenestraat 34 (Karel Sijmons, 1966). A cluster of flat-roofed buff-brick volumes:
 * the worship hall rises as a monopitch (5.6 m west to 14.9 m east) behind a lower two-storey entrance block with a ribbon
 * of dark-framed windows under a thin projecting cornice, a long low east wing with white tile base and window ribbon, a
 * windowless west wing with green copper coping, and a white concrete bell frame standing on the hall's south-east corner.
 * Massing is the 3DBAG LoD2.2 shell; features are placed on its own wall planes (indices from worship-walls-list.ts).
 * Reference: municipal panoramas 2025-07-29 (recording_..._00527 front, _00541 west, 2019 TMX..._002571 east end) and the RCE
 * photograph of the south facade; entrance block bands (ground 0-3, brick band to 4.8, ribbon 4.8-6.2, brick to 7.5) read from them.
 */
const walls = new Map(wallsOf(source as never).map(w => [w.index, w]));
const wall = (i: number): Wall => walls.get(i)!;

/** Glazed opening: recessed-looking dark frame, glass pane and mullions, flush on the wall. */
function opening(b: BuildingTools, w: Wall, t0: number, t1: number, y0: number, y1: number, lights: number, frame = 'frame', sill = true) {
  const wd = t1 - t0, tm = (t0 + t1) / 2, f = 0.07;
  if (sill) onWall(b, w, tm, y0 - 0.08, wd + 0.2, 0.08, 0.14, 'concrete', 0);
  onWall(b, w, tm, y0, wd, y1 - y0, 0.06, 'glass', 0.02, 'pane');
  onWall(b, w, tm, y0, wd, f, 0.1, frame, 0.02);
  onWall(b, w, tm, y1 - f, wd, f, 0.1, frame, 0.02);
  for (let k = 0; k <= lights; k++) onWall(b, w, t0 + f / 2 + (wd - f) * k / lights, y0, f, y1 - y0, 0.1, frame, 0.02);
}

/** Flat tile-clad base (1 ft white glazed tiles read as pale panels with fine joints) up to height h. */
function tileBase(b: BuildingTools, w: Wall, t0: number, t1: number, h: number) {
  onWall(b, w, (t0 + t1) / 2, 0, t1 - t0, h, 0.06, 'white', 0.01);
}

function addEntranceBlock() { /* placeholder replaced below */ }

export function buildThomaskerk(_w: number, _d: number, b: BuildingTools) {
  addShell(b, source as never, {wall: 'brick', roof: 'slate'});
  (b as {mark?: (n: string) => void}).mark?.('shell');
  void addEntranceBlock;

  // --- South facade, west part (wall 50, 4.8 m: slim window group, tile panel) and wall 48 ---
  const w50 = wall(50), w48 = wall(48);
  tileBase(b, w50, 0.6, 1.7, 3.0); // corner brick pier stays to the left
  opening(b, w50, 1.9, 4.1, 0.5, 3.0, 4);
  tileBase(b, w50, 4.2, w50.length, 3.0);
  tileBase(b, w48, 0, 1.3, 3.0);
  opening(b, w48, 1.4, 2.8, 0.9, 2.9, 2, 'white');
  // string course between the ground storey and the brick band
  onWall(b, w50, w50.length / 2, 2.95, w50.length, 0.12, 0.12, 'concrete', 0);
  onWall(b, w48, 1.5, 2.95, 3.0, 0.12, 0.12, 'concrete', 0);

  // --- Entrance porch (walls 42 front, 49 west side, 7 east side): concrete frame, canopy, double doors, side lights ---
  const w42 = wall(42), w49 = wall(49), w7 = wall(7);
  onWall(b, w42, w42.length / 2, 0, 2.0, 2.65, 0.08, 'dark', 0.02); // door leaves
  onWall(b, w42, w42.length / 2, 0, 0.06, 2.65, 0.12, 'frame', 0.02);
  for (const t of [0.12, w42.length - 0.12]) onWall(b, w42, t, 0, 0.24, 2.9, 0.3, 'concrete', 0);
  onWall(b, w42, w42.length / 2, 2.9, w42.length + 0.8, 0.4, 0.7, 'concrete', 0); // canopy slab, overhangs the front
  onWall(b, w42, w42.length / 2, 3.3, w42.length + 0.9, 0.08, 0.8, 'copper', -0.05);
  void w49; void w7;

  // --- Upper entrance block ribbon (walls 48, 19, 39): brick 3.0-4.8 band, ribbon 4.8-6.2, brick to 7.5, thin cornice ---
  const w19 = wall(19), w39 = wall(39);
  for (const w of [w48, w19, w39]) {
    const base = w === w39 ? 2.7 : 0;
    void base;
    onWall(b, w, w.length / 2, 4.75, w.length, 0.1, 0.18, 'concrete', 0); // cornice line over the brick band
    onWall(b, w, w.length / 2, 7.3, w.length, 0.2, 0.32, 'concrete', 0); // projecting top cornice
  }
  // ribbon panes: dark-framed band with five lights across the block
  opening(b, w48, 0.1, 2.9, 4.95, 6.2, 2, 'dark', false);
  opening(b, w19, 0.15, 3.1, 4.95, 6.2, 2, 'dark', false);
  onWall(b, w39, 3.9, 4.95, 7.4, 1.25, 0.05, 'dark', 0.01);
  opening(b, w39, 0.3, 2.1, 4.95, 6.2, 1, 'dark', false);
  opening(b, w39, 2.15, 4.2, 4.95, 6.2, 1, 'dark', false);
  opening(b, w39, 5.4, 7.4, 4.95, 6.2, 1, 'dark', false);
  // screen wall in front of the block (wall 23, 2.7 m) with a white tile return, coping and the house number plate
  const w23 = wall(23);
  onWall(b, w23, w23.length / 2, 2.6, w23.length + 0.2, 0.12, 0.34, 'concrete', -0.05);
  // east return of the entrance block: tile
  tileBase(b, w19, 0, w19.length, 3.0);

  // --- East wing (wall 52 south, 33 east end, 9 north): white tile base, window ribbon, grey fascia, brick above ---
  const w52 = wall(52), w33 = wall(33);
  tileBase(b, w52, 0, w52.length, 2.9);
  onWall(b, w52, w52.length / 2, 2.9, w52.length, 0.3, 0.16, 'concrete', 0);
  for (const [a, c] of [[3.2, 6.6], [6.7, 10.1], [10.2, 13.6], [13.7, 16.2]]) opening(b, w52, a, c, 0.75, 2.75, 2, 'frame');
  onWall(b, w52, w52.length / 2, 4.7, w52.length, 0.18, 0.28, 'dark', -0.05); // coping
  tileBase(b, w33, 0, w33.length, 2.9);
  onWall(b, w33, w33.length / 2, 2.9, w33.length, 0.3, 0.16, 'concrete', 0);
  opening(b, w33, 1.6, 5.2, 0.75, 2.75, 3, 'frame');
  opening(b, w33, 5.5, 9.6, 0.75, 2.75, 4, 'frame');
  onWall(b, w33, w33.length / 2, 4.7, w33.length, 0.18, 0.28, 'dark', -0.05);

  // --- West wing: windowless, green copper coping on its parapets (walls 69, 91, 90, 16) ---
  for (const i of [69, 91, 90, 16]) {
    const w = wall(i);
    const top = Math.min(wallTop(w, 0.1), wallTop(w, w.length - 0.1), wallTop(w, w.length / 2));
    onWall(b, w, w.length / 2, top - 0.05, w.length, 0.3, 0.46, 'copper', -0.2);
  }
  const w16 = wall(16);
  for (const t of [2.6, 6.2]) onWall(b, w16, t, 0.35, 0.9, 0.35, 0.1, 'frame', 0.01); // vent grilles at the foot of the west wall

  // --- Bell frame: hollow white concrete rectangle standing on the hall's south-east corner, bell inside ---
  const cx = -1.0, cz = 4.6, top = 16.6, bot = 12.8, wd = 1.5, dp = 1.1, th = 0.32;
  b.box(cx, bot, cz, wd, th, dp, 'white');
  b.box(cx, top - th, cz, wd, th, dp, 'white');
  for (const s of [-1, 1]) b.box(cx + s * (wd / 2 - th / 2), bot, cz, th, top - bot, dp, 'white');
  const bell = new T.LatheGeometry([[0.05, 0], [0.34, 0.05], [0.3, 0.35], [0.2, 0.55], [0.1, 0.62]].map(p => new T.Vector2(p[0], p[1])), 10);
  b.add(bell, 'bronze' as never, cx, bot + 1.6, cz);
  b.box(cx, bot + 2.3, cz, 0.08, 0.06, dp, 'frame'); // headstock beam
  void wallPoint;
}
