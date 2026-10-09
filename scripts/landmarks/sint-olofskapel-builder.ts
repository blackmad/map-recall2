import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {onWall} from './worship-walls';
import {archWindow, gabledHall, oculus, wallBetween, wallPoint, type P2, type Quad} from './worship-kit';
import source from './sint-olofskapel-footprints.json';

/**
 * Sint Olofskapel (Oudezijds Kapel), Zeedijk. BAG 1440 pand. 3DBAG LoD2.2 is unusable here (spurious roof slabs up to
 * 25 m), so the massing is rebuilt from the BAG ring corners and the clean 3DBAG roof planes: a quadrilateral hall under
 * two steep gables (eaves 9.1 m, ridge 17.3 m), ridges running ENE-WSW. Detail follows the Commons/panorama photographs:
 * tall pointed gable windows, round windows high on the flank, the 1644 stone portal and a slim bell turret in the valley.
 */
export function buildSintOlofskapel(_w: number, _d: number, b: BuildingTools) {
  void source;
  const N1: P2 = [6.55, -15.65], C1: P2 = [19.08, 4.09], W1: P2 = [-14.86, -3.5], S1: P2 = [1.8, 16.2];
  const hall: Quad = {p00: N1, p01: C1, p10: W1, p11: S1};
  const EAVE = 9.1, RIDGE = 17.3;
  gabledHall(b, hall, {eave: EAVE, ridge: RIDGE, gables: 2, wall: 'brick', roof: 'slate'});
  const neWall = wallBetween(N1, C1, 14, [0.844, -0.536]);
  const swWall = wallBetween(W1, S1, 14, [-0.763, 0.646]);
  const nwWall = wallBetween(N1, W1, EAVE, [-0.46, -0.883]);
  const seWall = wallBetween(C1, S1, EAVE, [0.57, 0.82]);
  // Gable windows: one tall pointed window per gable, with the stone portal beneath the east one.
  for (const t of [neWall.length * 0.25, neWall.length * 0.75]) archWindow(b, neWall, t, 4.6, 3.0, 9.2, {pointed: true, mullions: 2});
  for (const t of [swWall.length * 0.25, swWall.length * 0.75]) archWindow(b, swWall, t, 2.2, 3.0, 10.6, {pointed: true, mullions: 2});
  // Zeedijk portal (1644): stepped stone pilasters, round pediment with relief, lantern brackets.
  {
    const t = neWall.length * 0.75;
    onWall(b, neWall, t - 1.45, 0, 0.7, 3.9, 0.45, 'stone', 0);
    onWall(b, neWall, t + 1.45, 0, 0.7, 3.9, 0.45, 'stone', 0);
    onWall(b, neWall, t, 3.0, 3.6, 1.0, 0.45, 'stone', 0);
    onWall(b, neWall, t, 0, 2.2, 3.0, 0.2, 'dark', 0.05);
    const pediment = new T.CylinderGeometry(1.8, 1.8, 0.42, 14, 1, false, -Math.PI / 2, Math.PI);
    pediment.rotateX(Math.PI / 2); pediment.rotateY(Math.atan2(neWall.n[0], neWall.n[1]));
    const p = wallPoint(neWall, t, 0.21); pediment.translate(p[0], 3.9, p[1]); b.add(pediment, 'stone' as never);
  }
  // Round windows high on the Nieuwebrugsteeg flank.
  for (const t of [4.5, 11.5, 18.5]) oculus(b, nwWall, t, 6.4, 0.75);
  onWall(b, nwWall, 7.5, 0, 1.3, 2.6, 0.2, 'dark', 0.04);
  for (const t of [4.5, 10.5, 16.5]) archWindow(b, seWall, t, 2.6, 1.6, 4.4, {});
  // Bell turret in the valley between the gables: square louvred stage, lantern and needle.
  const tx = 1.0, tz = 0.6;
  b.box(tx, 14.0, tz, 1.4, 6.4, 1.4, 'stone');
  b.box(tx, 19.2, tz, 1.9, 0.3, 1.9, 'stone');
  const lantern = new T.CylinderGeometry(0.55, 0.7, 1.8, 8); b.add(lantern, 'white' as never, tx, 20.6, tz);
  const cone = new T.ConeGeometry(0.8, 3.4, 8); b.add(cone, 'slate' as never, tx, 23.2, tz);
}
