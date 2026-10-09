import type {BuildingTools} from './cultural-builders';
import {addShell} from './worship-shell';
import {addBays, onWall, wallsOf} from './worship-walls';
import source from './koningskerk-footprints.json';

/**
 * Koningskerk, Van 't Hofflaan, Watergraafsmeer (W. van de Kuilen and C. Trappenburg, 1954-56). Massing is the 3DBAG
 * LoD2.2 shell (flat-roofed church hall 11 m, low foyer and annexes). Detail follows the municipal panorama: the hall wall
 * is a concrete frame holding glass-in-concrete panels in three tiers, and a freestanding square brick tower with two
 * projecting concrete bands stands beside the entrance. 3DBAG does not include the tower; its 20 m height is a photograph
 * estimate (it clearly overtops the 11 m hall).
 */
export function buildKoningskerk(_w: number, _d: number, b: BuildingTools) {
  addShell(b, source as never, {wall: 'stone', roof: 'slate'});
  const walls = wallsOf(source as never);
  // Hall walls: three tiers of glass-in-concrete panels between a concrete frame.
  for (const w of walls) {
    if (w.length < 3 || Math.max(...w.poly.map(p => p[1])) < 10.5) continue;
    for (const y of [0.9, 4.0, 7.1]) addBays(b, w, {y, h: 2.5, wd: 2.5, pitch: 3.4, margin: 0.9, trim: 'frame', frame: 'frame'});
    for (const y of [3.35, 6.5, 9.65]) onWall(b, w, w.length / 2, y, w.length, 0.22, 0.2, 'frame', 0.0);
  }
  // Freestanding tower on the entrance side: brick shaft, two projecting concrete bands, narrow slit lights.
  const tx = -4.3, tz = 16.0, H = 20, S = 3.8;
  b.box(tx, 0, tz, S, H, S, 'brick');
  for (const y of [8.2, 17.0]) b.box(tx, y, tz, S + 0.9, 1.0, S + 0.9, 'stone');
  b.box(tx, H, tz, S + 0.5, 0.3, S + 0.5, 'stone');
  for (const y of [12.5, 14.3]) b.box(tx, y, tz + S / 2 + 0.03, 0.3, 1.1, 0.1, 'dark');
}
