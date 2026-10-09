import type {BuildingTools} from './cultural-builders';
import {addShell} from './worship-shell';
import {addBays, onWall, wallsOf, wallTop} from './worship-walls';
import source from './thomaskerk-footprints.json';

/**
 * De Thomaskerk, Amsterdam-Zuid (BAG pand 0363100012099552). Massing is the 3DBAG LoD2.2 shell in native east/south metres:
 * a cluster of flat-roofed brick volumes. Detail follows the municipal panorama: pale yellow brick, a curved front with a
 * continuous ribbon window under a projecting cornice, a flat concrete entrance canopy over dark double doors and a
 * white-tiled plinth beside it. Roof edges carry a green-grey metal coping.
 */
export function buildThomaskerk(_w: number, _d: number, b: BuildingTools) {
  addShell(b, source as never, {wall: 'brick', roof: 'slate'});
  const walls = new Map(wallsOf(source as never).map(w => [w.index, w]));
  const wall = (i: number) => walls.get(i)!;
  // Metal coping along every flat wall top, so the volumes read as flat-roofed.
  for (const w of walls.values()) {
    if (w.length < 2) continue;
    const tops = [0.15, 0.5, 0.85].map(f => wallTop(w, w.length * f));
    if (Math.max(...tops) - Math.min(...tops) > 0.25 || !Number.isFinite(tops[0])) continue;
    onWall(b, w, w.length / 2, tops[1] - 0.05, w.length, 0.22, 0.26, 'copper', -0.02);
  }
  // Curved entrance front facing south: ribbon windows between a cornice and a dark spandrel.
  for (const i of [48, 19, 8]) {
    const w = wall(i);
    addBays(b, w, {y: 4.4, h: 1.6, wd: Math.max(1, w.length - 0.6), pitch: 99, margin: 0.3, trim: 'copper', frame: 'dark'});
  }
  // Entrance: flat canopy, dark double doors, side light and tiled plinth.
  {
    const w = wall(42);
    onWall(b, w, w.length / 2, 2.55, w.length + 1.6, 0.3, 1.1, 'stone', 0);
    onWall(b, w, w.length / 2, 0, 2.0, 2.4, 0.1, 'dark', 0.02);
    onWall(b, w, w.length / 2, 0, 0.06, 2.4, 0.14, 'frame', 0.02);
  }
  for (const i of [50]) {
    const w = wall(i);
    onWall(b, w, 1.8, 0.0, 2.6, 1.2, 0.08, 'white', 0.01);
    onWall(b, w, 4.2, 0.9, 1.7, 2.4, 0.08, 'glass', 0.01, 'pane');
  }
  // Long north/east hall walls: bands of small window lights at upper level.
  for (const i of [62, 13, 61, 9]) addBays(b, wall(i), {y: 2.0, h: 1.3, wd: 1.1, pitch: 2.6, margin: 1.5, trim: 'stone'});
}
