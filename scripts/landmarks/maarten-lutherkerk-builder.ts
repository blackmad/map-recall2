import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {addShell} from './worship-shell';
import {addBays, onWall, wallsOf} from './worship-walls';
import source from './maarten-lutherkerk-footprints.json';

/**
 * Maarten Lutherkerk (F. Jantzen, Amsterdam School, BAG 1937). Massing is the 3DBAG LoD2.2 shell
 * in native east/south metres; detail follows the municipal panorama and Commons photograph:
 * tall narrow hall windows above a continuous band of small lights, a tripled entrance with
 * lamps and steps, and a slim copper-green spire.
 */
export function buildMaartenLutherkerk(_w: number, _d: number, b: BuildingTools) {
  addShell(b, source as never, {wall: 'brick', roof: 'slate', roofFor: s => (s.rings[0].every(p => p[1] > 13.5) ? 'copper' : 'slate')});
  const walls = new Map(wallsOf(source as never).map(w => [w.index, w]));
  const wall = (i: number) => walls.get(i)!;
  // Long hall walls: tall narrow windows between brick piers, small-light band at the foot.
  for (const i of [56, 17]) {
    addBays(b, wall(i), {y: 4.4, h: 5.2, wd: 1.0, pitch: 3.3, margin: 1.5, trim: 'brick'});
    addBays(b, wall(i), {y: 0.9, h: 1.7, wd: 0.85, pitch: 1.35, margin: 1.0, trim: 'stone'});
  }
  for (const i of [10, 30, 34, 37, 33]) addBays(b, wall(i), {y: 3.1, h: 1.6, wd: 0.8, pitch: 1.9, margin: 0.8, trim: 'stone'});
  // Entrance front: three tall timber doors with lamps, stone steps and slit windows above.
  for (const i of [27, 73]) {
    const w = wall(i);
    addBays(b, w, {y: 5.0, h: 6.6, wd: 0.55, pitch: 1.5, margin: 0.5, trim: 'stone'});
  }
  {
    const w = wall(27), n = 3, pitch = 1.25, start = w.length / 2 - pitch;
    for (let k = 0; k < n; k++) {
      const t = start + k * pitch;
      onWall(b, w, t, 0.55, 1.0, 2.5, 0.1, 'ochre', 0.02, 'pane');
      onWall(b, w, t, 3.05, 1.2, 0.2, 0.2, 'stone', 0);
      onWall(b, w, t + 0.7, 3.2, 0.2, 0.3, 0.2, 'dark', 0.1);
    }
    for (let s = 0; s < 4; s++) onWall(b, w, w.length / 2, s * 0.14, 4.0, 0.14, 0.3 + (3 - s) * 0.35, 'stone', 0);
  }
  // Spire: slim copper-green needle above the east roof (municipal panorama).
  const spire = new T.ConeGeometry(0.55, 5.2, 8);
  spire.translate(11.3, 20.9 + 2.6, 2.8);
  b.add(spire, 'copper' as never);
}
