import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {memorialFrame} from './memorial-frame';

/**
 * Spinoza statue on the Zwanenburgwal (Nicolas Dings, 2008): a tall, narrow bronze figure in a long cloak with vertical folds, curly shoulder-length hair and a
 * calm face, scattered with small raised bird and leaf shapes, standing at the north end of an oval granite slab. A dark faceted polyhedron (a stretched
 * icosahedron) rests on the slab's south end, and the slab's long east edge is cut with HET DOEL VAN DE STAAT IS DE VRIJHEID, SPINOZA on the step at the figure's end.
 * Plan of the slab: the OSM outline of way 175846077 (24 vertices, ~3.1 x 5.9 m), turned into the local frame. Original low-poly model from the Gemeente
 * Amsterdam panoramas (CC BY 4.0) b_20250130_0915_Track35_Sphere_00080/00081, TMX7316010203-002926_pano_0008_000045/46 and TMX7316010203-000717_pano_0000_000027.
 * Local frame: +z is the way the figure faces (toward the polyhedron, south-south-west), +x the figure's left (east-south-east, the lettered edge). FACING is a
 * visual estimate from the head's profile in three panoramas; the figure height (2.3 m) is estimated from the bicycles beside it.
 */
const FACING = 180;
/** OSM way 175846077 relative to its centroid (x east, z south, metres). */
const OUTLINE: [number, number][] = [
  [-1.35, 1.93], [-1.46, 1.12], [-1.44, 0.32], [-1.31, -0.48], [-1.06, -1.26], [-0.71, -1.99], [-0.25, -2.66], [0.05, -2.99], [0.47, -3.15], [0.92, -3.09],
  [1.28, -2.82], [1.48, -2.42], [1.63, -1.59], [1.65, -0.75], [1.54, 0.08], [1.3, 0.88], [0.93, 1.64], [0.45, 2.34], [0.17, 2.61], [-0.2, 2.74], [-0.59, 2.73],
  [-0.94, 2.58], [-1.21, 2.29],
];

export function buildSpinozaStandbeeld(_w: number, _d: number, b: BuildingTools) {
  const {yaw, put, box, ball, limb, lettering} = memorialFrame(b, FACING);
  const c = Math.cos(yaw), s = Math.sin(yaw);
  const toLocal = ([x, z]: [number, number]): [number, number] => [x * c - z * s, x * s + z * c];
  const ring = OUTLINE.map(toLocal);
  // ---- slab: the outline extruded 0.5 m, with a 7 cm lower footing course 8 cm proud of it
  const slab = (pts: [number, number][], y0: number, h: number, grow: number, colour: 'concrete' | 'greyBrick') => {
    const cx = pts.reduce((a, p) => a + p[0], 0) / pts.length, cz = pts.reduce((a, p) => a + p[1], 0) / pts.length;
    const sh = new T.Shape();
    pts.forEach(([x, z], i) => {
      const dx = x - cx, dz = z - cz, l = Math.hypot(dx, dz) || 1, px = x + dx / l * grow, pz = z + dz / l * grow;
      if (i === 0) sh.moveTo(px, -pz); else sh.lineTo(px, -pz);
    });
    const g = new T.ExtrudeGeometry(sh, {depth: h, bevelEnabled: false});
    g.rotateX(-Math.PI / 2); g.translate(0, y0, 0);
    b.add(g, colour, 0, 0, 0);
  };
  const SH = 0.5;
  slab(ring, 0, 0.07, 0.08, 'greyBrick');
  slab(ring, 0.07, SH - 0.07, 0, 'concrete');
  // the step at the figure's end: a low pedestal block that carries SPINOZA on its face
  box(0.25, SH, -1.75, 1.2, 0.1, 1.0, 'concrete');
  // ---- inscription cut along the east (+x) edge, reading south to north toward the figure, and the name on the step
  lettering('HET DOEL VAN DE STAAT IS DE VRIJHEID', 0.14, 2.1, 1.56, 0.27, -0.55, 'left', 'greyBrick', 0.02);
  lettering('SPINOZA', 0.09, 0.8, 0.85, SH + 0.05, -1.75, 'left', 'greyBrick', 0.02);
  // ---- polyhedron: a stretched, tilted icosahedron in dark stone resting on a vertex near the south end
  {
    const g = new T.IcosahedronGeometry(0.5, 0); g.scale(1.0, 0.92, 1.28); g.rotateZ(0.5); g.rotateX(0.35); g.rotateY(0.6);
    g.computeBoundingBox(); const lowest = g.boundingBox!.min.y;
    put(g, 0.0, SH - lowest - 0.04, 1.5, 'dark');
  }
  // ---- figure on the step: standing man in a long cloak that widens to the hem, shoulders and upper arms under it, wide flat collar, curls to the shoulders
  const base = SH + 0.1, FZ = -1.75, FX = 0.25;
  const rx = (y: number) => 0.38 - 0.13 * (y / 1.5), rz = (y: number) => rx(y) * 0.62;       // cloak half-width and half-depth at height y
  {
    const cloak = new T.CylinderGeometry(rx(1.5), rx(0), 1.5, 14, 1, true); cloak.scale(1, 1, 0.62); cloak.translate(0, 0.75, 0);
    put(cloak, FX, base, FZ, 'bronze');
    const hem = new T.CylinderGeometry(rx(0) + 0.015, rx(0) + 0.02, 0.07, 14); hem.scale(1, 1, 0.62);
    put(hem, FX, base + 0.035, FZ, 'bronze');
    // shoes show under the hem at the front
    box(FX - 0.13, base, FZ + 0.27, 0.13, 0.07, 0.24, 'bronze'); box(FX + 0.13, base, FZ + 0.27, 0.13, 0.07, 0.24, 'bronze');
    // shoulders and upper arms read through the cloak
    ball(FX, base + 1.46, FZ, 0.28, 0.11, 0.17, 'bronze', 12);
    for (const sx of [-1, 1]) {                                                                                         // arms hang inside the cloak, wider than its hem line
      limb([FX + sx * 0.26, base + 1.45, FZ + 0.01], [FX + sx * 0.36, base + 0.82, FZ + 0.05], 0.085, 0.07, 'bronze', 8);
      ball(FX + sx * 0.36, base + 0.78, FZ + 0.06, 0.07, 0.08, 0.06, 'bronze', 7);
    }
    // a few long vertical folds, fanning wider toward the hem
    for (let i = 0; i < 7; i++) {
      const a = (i / 6 - 0.5) * 2.7, th = 0.055;
      const y0 = 0.06, y1 = 1.38, f = (y: number) => [FX + Math.sin(a) * (rx(y) + 0.008), FZ + Math.cos(a) * (rz(y) + 0.006)];
      const [x0, z0] = f(y0), [x1, z1] = f(y1);
      limb([x0, base + y0, z0], [x1, base + y1, z1], th, th * 0.5, 'bronze', 5);
    }
    // wide flat collar and short neck
    ball(FX, base + 1.58, FZ + 0.01, 0.27, 0.04, 0.19, 'bronze', 12);
    limb([FX, base + 1.6, FZ + 0.01], [FX, base + 1.76, FZ + 0.02], 0.08, 0.075, 'bronze', 8);
    // head and face
    const hy = base + 1.98, hz = FZ + 0.03;
    ball(FX, hy, hz, 0.125, 0.165, 0.135, 'bronze', 10);                                                                   // skull
    box(FX, hy + 0.05, hz + 0.115, 0.17, 0.025, 0.03, 'bronze');                                                         // brow
    box(FX, hy - 0.015, hz + 0.125, 0.03, 0.08, 0.04, 'bronze');                                                         // nose
    box(FX, hy - 0.075, hz + 0.115, 0.07, 0.02, 0.03, 'bronze');                                                         // mouth line
    ball(FX, hy - 0.115, hz + 0.08, 0.04, 0.035, 0.04, 'bronze', 6);                                                     // chin
    // shoulder-length curly hair as one smooth, overlapping mass (no gaps, no free-standing lobes): a cap swept back from the forehead,
    // a wide fall behind to the collar, a long fall over each ear, sideburn curls framing the face, a ruffled hem of small curls on the nape
    ball(FX, hy + 0.03, hz - 0.045, 0.145, 0.16, 0.15, 'bronze', 14);                                                    // cap over the skull
    ball(FX, hy - 0.11, hz - 0.095, 0.158, 0.23, 0.085, 'bronze', 14);                                                   // fall behind the head
    ball(FX, hy - 0.27, hz - 0.085, 0.165, 0.11, 0.08, 'bronze', 12);                                                    // lower fall resting on the collar
    for (const sx of [-1, 1]) {
      ball(FX + sx * 0.128, hy - 0.1, hz - 0.03, 0.058, 0.18, 0.1, 'bronze', 12);                                        // fall over the ear
      ball(FX + sx * 0.108, hy - 0.04, hz + 0.05, 0.03, 0.085, 0.04, 'bronze', 8);                                       // sideburn curl
      ball(FX + sx * 0.12, hy - 0.26, hz - 0.045, 0.062, 0.07, 0.07, 'bronze', 8);                                       // curled end on the shoulder
    }
    for (let k = -2; k <= 2; k++) ball(FX + k * 0.058, hy - 0.335, hz - 0.1 + Math.abs(k) * 0.01, 0.036, 0.04, 0.04, 'bronze', 7);   // nape curls
  }
  // ---- about a dozen small birds (parakeets and sparrows) perched on the cloak, mostly on the lower half: body, head, tail hanging down
  const birds: [number, number, number][] = [[-0.4, 0.2, 1], [0.5, 0.28, 0.9], [-1.1, 0.4, 1], [1.3, 0.5, 1.1], [0.1, 0.62, 0.9], [-0.7, 0.75, 1], [2.1, 0.35, 1], [-2.0, 0.6, 0.9], [0.9, 0.95, 1], [-1.6, 1.05, 1.1], [1.7, 1.2, 0.9], [-0.1, 1.28, 1], [2.6, 0.7, 1], [-2.6, 0.25, 1]];
  for (const [a, y, k] of birds) {
    const px = FX + Math.sin(a) * (rx(y) + 0.03), pz = FZ + Math.cos(a) * (rz(y) + 0.025);
    const body = new T.SphereGeometry(1, 6, 4); body.scale(0.034 * k, 0.05 * k, 0.034 * k); body.rotateX(-0.35); body.rotateY(a);
    put(body, px, base + y, pz, 'bronze');
    const head = new T.SphereGeometry(1, 5, 4); head.scale(0.022 * k, 0.022 * k, 0.022 * k); head.rotateY(a);
    put(head, px + Math.sin(a) * 0.012, base + y + 0.06 * k, pz + Math.cos(a) * 0.01, 'bronze');
    const tail = new T.BoxGeometry(0.02 * k, 0.07 * k, 0.012); tail.rotateX(0.35); tail.rotateY(a);
    put(tail, px + Math.sin(a) * 0.012, base + y - 0.07 * k, pz + Math.cos(a) * 0.01, 'bronze');
  }
}
