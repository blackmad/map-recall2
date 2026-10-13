import * as T from 'three';
import type {BuildingTools} from './cultural-builders';

/**
 * Nationaal monument Slavernijverleden (Oosterpark; Erwin de Vries, unveiled 1 July 2002). A low dark concrete platform carrying three bronze
 * groups: a huge leaning figure whose long head points like a beak, a second tall figure with raised arms before a post, and a chain of about a
 * dozen walking figures roped together. Original low-poly interpretation from the CC0 Commons photographs by RoMaVo and Ceescamel (2025),
 * the CC BY-SA photograph by Arthena and the Gemeente Amsterdam panoramas (CC BY 4.0). Sizes are estimates against the figures (about 1.8 m).
 * Local frame: x east, z south, y up; the platform's long axis runs along x, the chain of walkers at the west end.
 */
type Colour = Parameters<BuildingTools['add']>[1];

export function buildSlavernijmonument(_w: number, _d: number, b: BuildingTools) {
  const box = (x: number, y: number, z: number, w: number, h: number, d: number, c: Colour) => b.box(x, y, z, w, h, d, c);
  const limb = (a: number[], c: number[], r0: number, r1: number, colour: Colour, seg = 7) => {
    const from = new T.Vector3(...a), to = new T.Vector3(...c), v = to.clone().sub(from), g = new T.CylinderGeometry(r1, r0, v.length(), seg);
    g.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 1, 0), v.clone().normalize()));
    const m = from.clone().add(to).multiplyScalar(.5);
    b.add(g, colour, m.x, m.y, m.z);
  };
  const ball = (x: number, y: number, z: number, r: number, colour: Colour) => b.add(new T.SphereGeometry(r, 8, 6), colour, x, y, z);

  // Circular gravel/paved apron and the grey platform (11 x 4.5 m, 0.75 m high), long side east-west.
  b.add(new T.CylinderGeometry(6.2, 6.2, .12, 28), 'concrete', 0, .06, 0);
  box(0, .12, 0, 11, .75, 4.5, 'greyBrick');
  const top = .87;

  // The great leaning figure at the east end: a tapering body rising from the platform and bending over, its head a long beak.
  const base: number[] = [3.9, top, .2], knee: number[] = [3.3, top + 1.8, .15], waist: number[] = [2.4, top + 3.3, .1], neck: number[] = [1.5, top + 4.5, .05];
  limb(base, knee, .22, .42, 'bronze', 8);
  limb(knee, waist, .42, .46, 'bronze', 8);
  limb(waist, neck, .46, .34, 'bronze', 8);
  // The head: a long beak pointing east (down-slope) from the top.
  const tip: number[] = [4.7, top + 5.3, .05];
  limb(neck, tip, .34, .05, 'bronze', 8);
  ball(1.5, top + 4.6, .05, .38, 'bronze');
  // An arm hanging from the shoulder, and the back ridge.
  limb([2.1, top + 3.9, .45], [2.7, top + 2.6, .75], .1, .07, 'bronze');

  // The second group at the centre: a post with a tall figure leaning on it, arms raised and hair streaming to the west.
  box(-1.2, top, -.3, .35, 2.6, .35, 'bronze');
  limb([-1.2, top + 2.6, -.3], [-2.6, top + 3.0, -.2], .14, .08, 'bronze');
  limb([-1.2, top + 2.6, -.3], [-.1, top + 3.5, -.3], .12, .06, 'bronze');
  limb([-.3, top, .4], [-.55, top + 1.7, .35], .14, .1, 'bronze');
  ball(-.6, top + 2.0, .35, .16, 'bronze');
  limb([-.55, top + 1.7, .35], [-.2, top + 2.9, .35], .1, .06, 'bronze');
  limb([-.55, top + 1.7, .35], [-1.4, top + 2.6, .5], .1, .06, 'bronze');

  // The chain of walkers, west end: twelve slim figures, each leaning into the pull, bound by a rope.
  for (let k = 0; k < 12; k++) {
    const x = -4.7 + (k % 6) * .72 + (k > 5 ? .35 : 0), z = -1.2 + Math.floor(k / 6) * 1.5 + ((k * 37) % 5) * .12, lean = .5 + (k % 3) * .08;
    limb([x, top, z], [x - lean, top + 1.0, z], .08, .11, 'bronze', 6);
    limb([x - lean, top + 1.0, z], [x - lean * 1.6, top + 1.75, z], .11, .1, 'bronze', 6);
    ball(x - lean * 1.8, top + 1.9, z, .12, 'bronze');
    limb([x - lean * 1.5, top + 1.6, z], [x - lean * 2.6, top + 1.3, z + .1], .05, .04, 'bronze', 5);
  }
  for (const z of [-1.2, .3]) limb([-5.4, top + 1.25, z], [-.9, top + 1.4, z], .02, .02, 'bronze', 4);
}
