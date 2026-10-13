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
  // ---- the fallen trunk: tapers from 0.9 m at the root end (+x) to 0.3 m at the top (-x), lying 0.4-0.6 m off the ground
  const trunk: [number, number, number, number][] = [[-3.9, 0.42, -1.4, 0.15], [-2.2, 0.5, -1.45, 0.21], [-0.4, 0.55, -1.35, 0.3], [1.4, 0.58, -1.4, 0.38], [3.0, 0.55, -1.2, 0.45]];
  for (let i = 0; i + 1 < trunk.length; i++) {
    const a = trunk[i], c = trunk[i + 1];
    limb([a[0], a[1], a[2]], [c[0], c[1], c[2]], a[3], c[3], 'bronze', 9);
  }
  // five thick branches that bend and fork once, irregularly placed; most lie near the ground, one rises. Each: knuckles and radii, then two fork tips.
  type Branch = {pts: number[][]; r: number[]; forks: [number[], number][]};
  const branches: Branch[] = [
    {pts: [[-2.6, 0.5, -1.4], [-3.3, 0.4, -0.2], [-3.9, 0.25, 1.0]], r: [0.17, 0.13, 0.09], forks: [[[-4.6, 0.1, 2.0], 0.03], [[-3.4, 0.15, 2.2], 0.03]]},
    {pts: [[-0.8, 0.58, -1.35], [-1.2, 0.6, -0.1], [-1.0, 0.35, 1.3]], r: [0.2, 0.15, 0.11], forks: [[[-1.8, 0.1, 2.4], 0.04], [[-0.4, 0.12, 2.5], 0.03]]},
    {pts: [[0.9, 0.6, -1.4], [1.0, 1.2, -0.5], [0.6, 1.7, 0.3]], r: [0.22, 0.16, 0.1], forks: [[[0.2, 2.2, 0.9], 0.03], [[1.2, 1.9, 0.8], 0.03]]},
    {pts: [[-1.8, 0.5, -1.45], [-2.2, 0.5, -2.2], [-3.0, 0.3, -2.9]], r: [0.15, 0.11, 0.08], forks: [[[-3.7, 0.1, -3.1], 0.03], [[-2.5, 0.15, -3.5], 0.03]]},
    {pts: [[1.8, 0.55, -1.4], [2.2, 0.6, -2.2], [2.0, 0.35, -3.0]], r: [0.2, 0.14, 0.1], forks: [[[1.4, 0.1, -3.6], 0.03], [[2.7, 0.12, -3.5], 0.03]]},
  ];
  for (const br of branches) {
    for (let i = 0; i + 1 < br.pts.length; i++) limb(br.pts[i], br.pts[i + 1], br.r[i], br.r[i + 1], 'bronze', 8);
    const end = br.pts[br.pts.length - 1];
    for (const [tip, r1] of br.forks) limb(end, tip, br.r[br.r.length - 1], r1, 'bronze', 6);
  }
  // short stubs where smaller limbs broke off
  for (const [a, c] of [[[-1.5, 0.55, -1.4], [-1.6, 0.95, -1.3]], [[0.2, 0.58, -1.4], [0.2, 0.5, -0.7]], [[2.3, 0.6, -1.35], [2.4, 1.0, -1.3]], [[-0.3, 0.55, -1.4], [-0.2, 0.5, -2.0]]] as number[][][]) limb(a, c, 0.07, 0.03, 'bronze', 5);
  // root end: five thick roots splaying up and out from the butt
  for (let k = 0; k < 5; k++) {
    const a = (k - 2) / 2 * 0.9, mid = [3.35, 0.6 + 0.2 * Math.cos(a), -1.2 + Math.sin(a) * 0.9], tip = [3.8 + Math.cos(a) * 0.5, 0.3 + 0.7 * Math.abs(Math.sin(a * 1.4)) + 0.2, -1.2 + Math.sin(a) * 1.9];
    limb([3.0, 0.55, -1.2], mid, 0.24, 0.13, 'bronze', 7);
    limb(mid, tip, 0.13, 0.04, 'bronze', 6);
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
