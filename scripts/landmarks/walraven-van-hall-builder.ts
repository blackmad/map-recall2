import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {memorialFrame} from './memorial-frame';

/**
 * Monument Walraven van Hall, Frederiksplein (Fernando Sánchez Castillo, 2010; a monument to the banker of the resistance, shot in 1945): a bronze cast of a
 * felled tree lying on a circle of red brick paving inside a curved rubble-stone wall, its root end splayed, a cut stump standing apart, a bronze plaque
 * in the paving lettered WALRAVEN VAN HALL / BANKIER VAN HET VERZET / 1906 - 1945.
 * Original low-poly reconstruction from the Commons photographs (Ceescamel, CC BY-SA 4.0) and Gemeente Amsterdam panoramas
 * recording_2025-06-19_04-38-42_02947 and recording_2025-07-14_06-43-08_01048 (CC BY 4.0). Local frame: +z is the plaque side, the viewer's right is +x
 * (the root end). The branch layout is a procedural stand-in for the cast, not a scan; FACING is a visual estimate.
 */
const FACING = 280;

export function buildWalravenVanHall(_w: number, _d: number, b: BuildingTools) {
  const {put, box, limb, lettering} = memorialFrame(b, FACING);
  const R = 4.5;
  // ---- paving circle and its kerb of 32 short stones
  { const g = new T.CylinderGeometry(R - 0.1, R - 0.1, 0.04, 32); put(g, 0, 0.02, 0, 'brick'); }
  for (let k = 0; k < 32; k++) {
    const a = k / 32 * Math.PI * 2, len = 2 * Math.PI * (R + 0.1) / 32 * 0.96;
    box(Math.cos(a) * (R + 0.1), 0, Math.sin(a) * (R + 0.1), len, 0.09, 0.25, 'concrete', -a + Math.PI / 2);
  }
  // ---- rubble wall: an arc along the back (z < 0), 0.85 m high, 0.45 thick, laid as irregular stones
  {
    const WR = R + 0.9, n = 34;
    for (let k = 0; k < n; k++) {
      const a = Math.PI * (0.12 + 0.76 * (k + 0.5) / n) , len = WR * 0.76 * Math.PI / n * 1.05, jitter = ((k * 37) % 11) / 11;
      box(Math.cos(a) * WR, 0, -Math.sin(a) * WR, len, 0.8 + jitter * 0.1, 0.46 + jitter * 0.05, 'concrete', Math.PI / 2 - a + 0.0 * jitter);
    }
  }
  // ---- the fallen trunk: a bent run of five tapered segments lying 0.55 m off the ground, crown at -x, roots at +x
  const trunk: [number, number, number, number][] = [[-3.7, 0.5, -1.35, 0.1], [-2.2, 0.55, -1.4, 0.2], [-0.5, 0.6, -1.3, 0.3], [1.2, 0.62, -1.4, 0.38], [2.9, 0.58, -1.2, 0.44]];
  for (let i = 0; i + 1 < trunk.length; i++) {
    const a = trunk[i], c = trunk[i + 1];
    limb([a[0], a[1], a[2]], [c[0], c[1], c[2]], a[3], c[3], 'bronze', 8);
  }
  // main limbs: [x along the trunk, side (+1 toward the plaque), reach, droop, lift]
  const limbs: [number, number, number, number, number][] = [
    [-3.2, 1, 2.2, 0.0, 0.2], [-2.6, 1, 3.1, 0.1, 0.35], [-1.7, 1, 2.6, 0.0, 0.3], [-0.9, 1, 3.4, 0.15, 0.4], [0.0, 1, 2.2, 0.0, 0.5], [0.6, 1, 3.0, 0.1, 0.3],
    [-2.9, -1, 0.9, 0.0, 0.5], [-1.4, -1, 1.0, 0.0, 0.6], [0.2, -1, 0.8, 0.0, 0.5],
  ];
  limbs.forEach(([x, side, reach, droop, lift], n) => {
    const z0 = -1.38, y0 = 0.58, r0 = 0.1 + 0.018 * reach, j = ((n * 53) % 7) / 7 - 0.5;   // j: a fixed per-limb wobble, the cast is not a comb
    // branches sweep back toward the crown (-x) as they leave the trunk, like a tree fallen with its limbs laid over
    const p1 = [x - 0.5 - j * 0.3, y0 + lift, z0 + side * reach * 0.35], p2 = [x - 1.5 + j * 0.4, y0 + lift * 0.3 - droop, z0 + side * reach * (0.7 + j * 0.2)], p3 = [x - 2.3 + j * 0.5, 0.07, z0 + side * reach];
    limb([x, y0, z0], p1, r0, r0 * 0.7, 'bronze', 6);
    limb(p1, p2, r0 * 0.7, r0 * 0.45, 'bronze', 6);
    limb(p2, p3, r0 * 0.45, 0.03, 'bronze', 5);
    limb(p2, [p2[0] - 0.7, 0.2, p2[2] + side * 0.5], 0.04, 0.015, 'bronze', 4);   // a twig off the second knuckle
    limb(p1, [p1[0] + 0.5, 0.35, p1[2] + side * 0.7], 0.05, 0.015, 'bronze', 4);   // and a spur off the first
  });
  // root end: seven roots fanning up and out from the butt
  for (let k = 0; k < 7; k++) {
    const a = (k - 3) / 3 * 1.0, tip = [3.6 + Math.cos(a) * 0.6, 0.15 + 0.7 * Math.abs(Math.sin(a * 1.4)) + 0.2, -1.2 + Math.sin(a) * 1.9];
    limb([2.85, 0.55, -1.2], [3.25, 0.6 + 0.2 * Math.cos(a), -1.2 + Math.sin(a) * 0.9], 0.2, 0.1, 'bronze', 6);
    limb([3.25, 0.6 + 0.2 * Math.cos(a), -1.2 + Math.sin(a) * 0.9], tip, 0.1, 0.03, 'bronze', 5);
  }
  // ---- the stump: a hollow-topped cut cylinder 1.2 m high with splintered crown, standing behind the root end
  { const g = new T.CylinderGeometry(0.5, 0.58, 1.2, 10); put(g, 3.9, 0.6, -2.4, 'bronze'); }
  for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2; put(new T.ConeGeometry(0.1, 0.3 + (k % 3) * 0.08, 4), 3.9 + Math.cos(a) * 0.32, 1.35, -2.4 + Math.sin(a) * 0.32, 'bronze'); }
  // ---- plaque in the paving, 1.5 x 0.75 m, with three lines of raised lettering laid for a reader standing on the +z side
  box(-0.6, 0.04, 1.9, 1.5, 0.1, 0.75, 'bronze');
  lettering('WALRAVEN VAN HALL', 0.12, 1.36, -0.6, 0.14, 1.9 - 0.2, 'up', 'gold', 0.015);
  lettering('BANKIER VAN HET VERZET', 0.07, 1.2, -0.6, 0.14, 1.9 + 0.0, 'up', 'gold', 0.015);
  lettering('1906 - 1945', 0.1, 0.8, -0.6, 0.14, 1.9 + 0.22, 'up', 'gold', 0.015);
}
