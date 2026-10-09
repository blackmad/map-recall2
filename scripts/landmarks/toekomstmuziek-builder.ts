import type {BuildingTools} from './cultural-builders';
import {addShell} from './worship-shell';
import {addBays, onWall, wallsOf} from './worship-walls';
import source from './toekomstmuziek-footprints.json';

/**
 * Toekomstmuziek (Danzigerbocht 29): a two-storey 1994 BAG pand with pale yellow-grey brick walls
 * curving round the corner, small square windows with yellow frames on the upper floor and a glazed
 * entrance under a painted sign board. Massing is the 3DBAG LoD2.2 shell (native east/south metres);
 * openings follow the 2025 municipal panorama.
 */
export function buildToekomstmuziek(_w: number, _d: number, b: BuildingTools) {
  addShell(b, source as never, {wall: 'concrete', roof: 'slate'});
  const walls = new Map(wallsOf(source as never).map(w => [w.index, w]));
  const wall = (i: number) => walls.get(i)!;
  // Upper-floor square windows with yellow frames; the front wall carries the main rhythm.
  addBays(b, wall(14), {y: 3.5, h: 1.1, wd: 1.35, pitch: 2.9, margin: 1.4, trim: 'ochre', frame: 'gold'});
  for (const i of [3, 11, 13]) addBays(b, wall(i), {y: 3.5, h: 1.1, wd: 1.35, pitch: 4.2, margin: 1.8, trim: 'ochre', frame: 'gold'});
  // Entrance: glazed door with yellow frame, side panels and a sign board above.
  const w = wall(14), t = w.length * 0.5;
  onWall(b, w, t, 0.05, 1.6, 2.5, 0.1, 'dark', 0.02);
  onWall(b, w, t, 0.05, 0.9, 2.2, 0.1, 'glass', 0.05, 'pane');
  onWall(b, w, t, 2.7, 3.0, 0.5, 0.3, 'white', 0);
  onWall(b, w, t, 2.95, 1.2, 0.25, 0.32, 'gold', 0);
  // Dark plinth course.
  for (const i of [14, 3, 11, 13]) { const k = wall(i); onWall(b, k, k.length / 2, 0, k.length, 0.5, 0.05, 'dark', 0); }
}
