import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {addShell} from './worship-shell';
import {addBays, onWall, wallsOf} from './worship-walls';
import source from './club-panama-footprints.json';

/**
 * Panama (Oostelijke Handelskade 4): the 1885 machine house and boiler house of the former Oostelijke
 * Handelskade power station, converted to a club in 2001. Massing is the 3DBAG LoD2.2 shell in native
 * east/south metres; detail follows the 2025 municipal panorama: paired arched sash windows under an
 * arch-frieze cornice along the quay front, a glazed clerestory ridge, and the gabled machine-house
 * end with a row of blind arches and a round window.
 */
export function buildClubPanama(_w: number, _d: number, b: BuildingTools) {
  addShell(b, source as never, {wall: 'brick', roof: 'slate', roofFor: s => (s.rings[0].every(p => p[1] > 10.5) ? 'glass' : 'slate')});
  const walls = new Map(wallsOf(source as never).map(w => [w.index, w]));
  const wall = (i: number) => walls.get(i)!;
  // Quay front (north): paired arched windows between pilasters.
  for (const i of [17, 16]) addBays(b, wall(i), {y: 1.1, h: 2.7, wd: 0.95, pitch: 2.35, margin: 1.2, trim: 'stone', frame: 'frame'});
  // Side and rear walls: tall factory windows.
  for (const i of [57, 4, 6, 7, 14, 29, 67, 49]) addBays(b, wall(i), {y: 1.2, h: 3.0, wd: 1.1, pitch: 3.0, margin: 1.2, trim: 'stone', frame: 'frame'});
  // Cornice band along the long walls.
  for (const i of [17, 16, 57, 4]) {
    const w = wall(i);
    onWall(b, w, w.length / 2, w.base + 5.0, w.length, 0.25, 0.22, 'stone', 0);
  }
  // Entrance: dark arched canopy and door on the quay front.
  {
    const w = wall(17), t = w.length * 0.78;
    onWall(b, w, t, w.base + 0.3, 1.8, 2.5, 0.12, 'dark', 0.02);
    onWall(b, w, t, w.base + 2.8, 2.6, 0.7, 0.35, 'dark', 0);
  }
  // Machine-house gable: round window and blind arches.
  {
    const w = wall(10), t = 1.05, y = w.base + 9.0;
    const g = new T.CylinderGeometry(0.85, 0.85, 0.12, 16).rotateX(Math.PI / 2);
    g.rotateY(Math.atan2(w.n[0], w.n[1]));
    g.translate(w.origin[0] + w.tangent[0] * t + w.n[0] * 0.08, y, w.origin[1] + w.tangent[1] * t + w.n[1] * 0.08);
    b.add(g, 'frame' as never);
    const gl = new T.CylinderGeometry(0.6, 0.6, 0.12, 16).rotateX(Math.PI / 2);
    gl.rotateY(Math.atan2(w.n[0], w.n[1]));
    gl.translate(w.origin[0] + w.tangent[0] * t + w.n[0] * 0.12, y, w.origin[1] + w.tangent[1] * t + w.n[1] * 0.12);
    b.add(gl, 'glass' as never);
    for (const i of [21, 10]) onWall(b, wall(i), wall(i).length / 2, wall(i).base + 6.2, 1.2, 0.3, 0.2, 'stone', 0);
  }
}
