import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {addShell} from './worship-shell';
import {addBays, onWall, wallsOf} from './worship-walls';
import source from './petrus-en-paulus-kerk-footprints.json';

/**
 * Old Catholic church, parsonage and schoolroom (J.W.F. Hartkamp jr., 1914).
 * Massing is the 3DBAG LoD2.2 shell (native east/south metres); detail follows the
 * Wikimedia/municipal photographs: tall mullioned gable windows, a tower with a
 * belfry cornice and clock faces, triple-light lower windows along the long wall.
 */
export function buildPetrusEnPaulusKerk(_w: number, _d: number, b: BuildingTools) {
  addShell(b, source as never, {wall: 'brick', roof: 'slate'});
  const walls = new Map(wallsOf(source as never).map(w => [w.index, w]));
  const wall = (i: number) => walls.get(i)!;
  // Long street wall: triple-light windows in a lower band (municipal panorama), shorter rooms above.
  addBays(b, wall(50), {y: 2.6, h: 3.6, wd: 2.3, pitch: 4.2, margin: 1.2});
  addBays(b, wall(14), {y: 2.4, h: 3.2, wd: 1.5, pitch: 3.0, margin: 1.2});
  addBays(b, wall(21), {y: 2.4, h: 3.2, wd: 1.5, pitch: 3.0, margin: 1.2});
  addBays(b, wall(38), {y: 1.2, h: 2.2, wd: 1.2, pitch: 2.6, margin: 1.0});
  addBays(b, wall(37), {y: 1.2, h: 2.2, wd: 1.2, pitch: 2.6, margin: 1.0});
  addBays(b, wall(28), {y: 1.2, h: 2.2, wd: 1.2, pitch: 2.6, margin: 1.0});
  addBays(b, wall(45), {y: 1.2, h: 3.0, wd: 1.4, pitch: 3.0, margin: 0.8});
  addBays(b, wall(49), {y: 1.2, h: 3.0, wd: 1.4, pitch: 3.0, margin: 0.8});
  // Gable front: two tall windows under the ridge, stepped stone head and a cross on the apex.
  for (const i of [35, 9]) {
    const w = wall(i), t = w.length / 2;
    addBays(b, w, {y: 3.6, h: 5.6, wd: 1.1, pitch: 1.4, margin: 0.4});
    onWall(b, w, t, w.base + 12.4, 1.6, 0.18, 0.2, 'stone', 0);
  }
  { const w = wall(35); onWall(b, w, w.length / 2, w.base + 15.8, 0.18, 1.5, 0.18, 'stone', 0); onWall(b, w, w.length / 2, w.base + 16.6, 0.8, 0.18, 0.18, 'stone', 0); }
  // Entrance in the tower foot: pointed red door under a stone arch.
  { const w = wall(34); onWall(b, w, w.length / 2, w.base, 1.5, 2.8, 0.1, 'dark', 0.02); onWall(b, w, w.length / 2, w.base + 2.8, 1.8, 0.25, 0.2, 'stone', 0); }
  // Tower: belfry louvres, cornice and two clock faces below the gabled cap.
  const tower = wall(30), upper = wall(53);
  onWall(b, tower, tower.length / 2, 13.2, 1.1, 2.4, 0.1, 'dark', 0.02);
  onWall(b, tower, tower.length / 2, 17.1, tower.length + 0.5, 0.35, 0.4, 'stone', -0.1);
  onWall(b, tower, tower.length / 2, 15.9, tower.length - 0.4, 0.3, 0.25, 'stone', 0);
  onWall(b, upper, upper.length / 2, 17.6, 1.1, 1.1, 0.12, 'white', 0.02);
  const clock = new T.CylinderGeometry(0.62, 0.62, 0.1, 16); clock.rotateX(Math.PI / 2);
  { const n = tower.n; clock.rotateY(Math.atan2(n[0], n[1])); clock.translate(tower.origin[0] + tower.tangent[0] * tower.length / 2 + n[0] * 0.06, 18.2, tower.origin[1] + tower.tangent[1] * tower.length / 2 + n[1] * 0.06); b.add(clock, 'white' as never); }
}
