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
  // ---- figure on the step: long cloak, narrow shoulders, curls
  const base = SH + 0.1, FZ = -1.75, FX = 0.25;
  {
    const cloak = new T.CylinderGeometry(0.3, 0.44, 1.72, 12, 1, true); cloak.scale(1, 1, 0.72); cloak.translate(0, 0.86, 0);
    put(cloak, FX, base, FZ, 'bronze');
    const hem = new T.CylinderGeometry(0.46, 0.5, 0.06, 12); hem.scale(1, 1, 0.72);
    put(hem, FX, base + 0.03, FZ, 'bronze');
    const top = new T.SphereGeometry(1, 12, 6); top.scale(0.4, 0.17, 0.25);                                                 // shoulders
    put(top, FX, base + 1.72, FZ, 'bronze');
    // cloak folds: eight thin ribs down the front and sides, the back plain
    for (let i = 0; i < 9; i++) {
      const a = (i / 8 - 0.5) * 2.5, x = FX + Math.sin(a) * 0.42, z = FZ + Math.cos(a) * 0.3;
      limb([x, base + 0.08, z], [FX + Math.sin(a) * 0.3, base + 1.74, FZ + Math.cos(a) * 0.215], 0.028, 0.02, 'bronze', 5);
    }
    // raised birds and leaves, flat little bodies on the cloak
    const marks: [number, number, number][] = [[-0.5, 1.5, 0], [0.3, 1.3, 0.2], [-0.2, 1.05, -0.3], [0.7, 0.9, 0.5], [-0.9, 0.7, -0.2], [0.1, 0.55, 0.1], [0.9, 0.35, -0.3], [-0.6, 0.3, 0.4], [1.3, 1.45, 0.3], [-1.3, 1.15, 0.3], [-1.9, 0.9, 0.1], [1.9, 0.7, -0.2], [2.4, 0.4, 0.2], [-2.3, 0.45, -0.1]];
    for (const [a, y, tilt] of marks) {
      const x = FX + Math.sin(a) * (0.46 - y * 0.09), z = FZ + Math.cos(a) * (0.33 - y * 0.065);
      const g = new T.SphereGeometry(1, 5, 4); g.scale(0.035, 0.09, 0.02); g.rotateZ(tilt); g.rotateY(a);
      put(g, x + Math.sin(a) * 0.02, base + y, z + Math.cos(a) * 0.015, 'bronze');
    }
    // neck, head, face
    limb([FX, base + 1.9, FZ], [FX, base + 1.98, FZ + 0.02], 0.1, 0.09, 'bronze', 7);
    const hy = base + 2.06, hz = FZ + 0.03;
    ball(FX, hy, hz, 0.12, 0.16, 0.13, 'bronze', 10);                                                                   // skull
    box(FX, hy + 0.05, hz + 0.115, 0.17, 0.025, 0.03, 'bronze');                                                         // brow
    box(FX, hy - 0.015, hz + 0.125, 0.03, 0.08, 0.04, 'bronze');                                                         // nose
    box(FX, hy - 0.075, hz + 0.115, 0.07, 0.02, 0.03, 'bronze');                                                         // mouth line
    ball(FX, hy - 0.115, hz + 0.08, 0.04, 0.035, 0.04, 'bronze', 6);                                                     // chin
    // wig: curls in two rows at the sides and nape, falling to the shoulders (none over the face)
    for (let i = 0; i < 9; i++) {
      const a = (i / 8) * Math.PI, r = 0.135;
      ball(FX + Math.cos(a) * r, hy - 0.02 - (i % 2) * 0.085, hz - Math.sin(a) * r * 1.0, 0.052, 0.07, 0.052, 'bronze', 6);
    }
    ball(FX, hy + 0.07, hz - 0.03, 0.13, 0.06, 0.13, 'bronze', 8);                                                      // crown
    ball(FX - 0.13, hy - 0.2, hz - 0.03, 0.05, 0.07, 0.05, 'bronze', 6); ball(FX + 0.13, hy - 0.2, hz - 0.03, 0.05, 0.07, 0.05, 'bronze', 6);
  }
}
