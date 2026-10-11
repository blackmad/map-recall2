import type {BuildingTools} from './cultural-builders';
import {addShell} from './worship-shell';
import {addBays, wallsOf} from './worship-walls';
import {archBand, disc, frameOf, ringSlab, slab, type Frame} from './nearbar-kit';
import source from './petrus-en-paulus-kerk-footprints.json';

/**
 * Old Catholic church, parsonage and schoolroom (J.W.F. Hartkamp jr., 1914).
 * Massing is the 3DBAG LoD2.2 shell (native east/south metres); detail follows the
 * Wikimedia (Ruysdaelstraat 37/39) and 2025 street panoramas: a steep brick gable
 * (apex 16.7 m) with two tall four-light mullioned windows, a louvred slot under the
 * ridge, a stone-capped cross, a gabled porch with a pointed timber door, and a brick
 * tower (20.7 m) with a stepped corbel-arch cornice, stone clock stage with a clock on
 * the north and west faces, and louvres on the west face.
 */
export function buildPetrusEnPaulusKerk(_w: number, _d: number, b: BuildingTools) {
  addShell(b, source as never, {wall: 'brick', roof: 'slate'});
  const walls = new Map(wallsOf(source as never).map(w => [w.index, w]));
  const wall = (i: number) => walls.get(i)!;
  // Long street wall: triple-light windows in a lower band (municipal panorama), shorter rooms above.
  addBays(b, wall(50), {y: 3.0, h: 3.8, wd: 2.3, pitch: 4.2, margin: 1.2});
  addBays(b, wall(14), {y: 2.4, h: 3.2, wd: 1.5, pitch: 3.0, margin: 1.2});
  addBays(b, wall(21), {y: 2.4, h: 3.2, wd: 1.5, pitch: 3.0, margin: 1.2});
  addBays(b, wall(38), {y: 1.2, h: 2.2, wd: 1.2, pitch: 2.6, margin: 1.0});
  addBays(b, wall(37), {y: 1.2, h: 2.2, wd: 1.2, pitch: 2.6, margin: 1.0});
  addBays(b, wall(28), {y: 1.2, h: 2.2, wd: 1.2, pitch: 2.6, margin: 1.0});
  addBays(b, wall(45), {y: 1.2, h: 3.0, wd: 1.4, pitch: 3.0, margin: 0.8});
  addBays(b, wall(49), {y: 1.2, h: 3.0, wd: 1.4, pitch: 3.0, margin: 0.8});

  // Mullioned window: stone surround, glass, one centre mullion and transom rows.
  const window = (f: Frame, t: number, y: number, w: number, h: number, rows: number, o = 0) => {
    slab(b, f, t, y - 0.14, w + 0.4, 0.16, 0.2, 'stone', o);
    slab(b, f, t, y + h, w + 0.4, 0.2, 0.2, 'stone', o);
    slab(b, f, t, y, w, h, 0.08, 'glass', o + 0.02);
    slab(b, f, t, y, 0.08, h, 0.14, 'frame', o + 0.02);
    for (let k = 1; k < rows; k++) slab(b, f, t, y + (h * k) / rows - 0.04, w, 0.08, 0.14, 'frame', o + 0.02);
  };

  // Gable front (north, bearing 343): frame of wall 35, t=0 at its east end, gable apex at t = -0.65.
  const gf = frameOf(wall(35)), apex = -0.65;
  window(gf, apex - 0.65, 7.6, 1.05, 4.6, 4, -1.3);
  window(gf, apex + 1.55, 7.6, 1.05, 4.6, 4);
  slab(b, gf, apex - 0.3, 13.7, 0.8, 1.3, 0.1, 'dark', -1.23);
  slab(b, gf, apex - 0.3, 13.55, 1.2, 0.16, 0.2, 'stone', -1.25);
  slab(b, gf, apex - 0.3, 15.0, 1.2, 0.2, 0.2, 'stone', -1.25);
  // Stone cross on the apex.
  slab(b, gf, apex, 16.6, 0.2, 1.6, 0.2, 'stone', -1.1);
  slab(b, gf, apex, 17.3, 0.8, 0.2, 0.2, 'stone', -1.1);
  // Gabled porch: stone pointed arch around the red timber double door.
  slab(b, gf, 0.2, 0, 1.6, 2.8, 0.1, 'red', 0.02);
  archBand(b, gf, 0.2, 0, 2.3, 3.6, 0.22, 0.25, 'stone', 0);

  // Tower: north face is wall 31+29 (frame of 31, 2.7 m wide), west face is wall 30.
  const tower = (f: Frame, w: number, clock: boolean, louvres: boolean) => {
    const c = w / 2;
    // stepped brick corbel cornice below the clock stage
    slab(b, f, c, 15.2, w + 0.2, 0.5, 0.2, 'greyBrick');
    slab(b, f, c, 15.7, w + 0.3, 0.5, 0.3, 'greyBrick');
    // stone clock stage: sill band, panel, head cornice
    slab(b, f, c, 16.2, w + 0.3, 0.3, 0.3, 'stone');
    slab(b, f, c, 16.5, w - 0.5, 2.9, 0.12, 'stone');
    slab(b, f, c, 19.4, w + 0.3, 0.35, 0.3, 'stone');
    if (clock) {
      disc(b, f, c, 17.95, 0.62, 0.1, 'white', 0.12);
      ringSlab(b, f, c, 17.95, 0.56, 0.66, 0.12, 'dark', 0.12);
      slab(b, f, c + 0.02, 17.9, 0.07, 0.42, 0.06, 'dark', 0.22);
      slab(b, f, c + 0.2, 17.92, 0.3, 0.07, 0.06, 'dark', 0.22);
    }
    if (louvres) for (const dt of [-0.55, 0.55]) slab(b, f, c + dt, 12.3, 0.55, 2.9, 0.1, 'dark', 0.02);
    // stone corner posts under the cap
    for (const t of [0.15, w - 0.15]) slab(b, f, t, 19.0, 0.5, 1.2, 0.3, 'stone');
  };
  const north = wall(31), west = wall(30);
  tower(frameOf(north), north.length + wall(29).length, true, false);
  tower(frameOf(west), west.length, true, true);
}
