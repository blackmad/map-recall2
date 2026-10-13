import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {textBoxes, textWidth} from './pixel-font';

/**
 * Standbeeld van Johan Rudolph Thorbecke, Thorbeckeplein (Ferdinand Leenhoff, unveiled 1876): the statesman in a frock coat, a rolled document in his
 * left hand at his chest, his right hand resting on a draped fluted column stump, bronze on a bronze plate over a grey granite pedestal whose front die
 * carries THORBECKE in gilt capitals and whose side panels carry OPTIMO CIVI / CIVES; inside a black iron railing with spear finials.
 * Original low-poly figure from the Commons photographs (public domain by Maarten Benschop and Andries Jager; CC BY-SA 3.0 photograph of the statue)
 * and Gemeente Amsterdam panoramas (CC BY 4.0, 2025). Local frame: x east, z south, y up. The figure faces bearing FACING (a visual estimate from
 * the panoramas). In the figure's frame +z is forward and +x its LEFT.
 */
const FACING = 200 * Math.PI / 180;

type Colour = Parameters<BuildingTools['add']>[1];

export function buildThorbeckeStandbeeld(_w: number, _d: number, b: BuildingTools) {
  const yaw = Math.PI - FACING;
  const put = (g: T.BufferGeometry, x: number, y: number, z: number, colour: Colour) => {
    g.rotateY(yaw);
    const c = Math.cos(yaw), s = Math.sin(yaw);
    b.add(g, colour, x * c + z * s, y, -x * s + z * c);
  };
  const box = (x: number, y: number, z: number, w: number, h: number, d: number, colour: Colour) => put(new T.BoxGeometry(w, h, d), x, y + h / 2, z, colour);
  const ball = (x: number, y: number, z: number, rx: number, ry: number, rz: number, colour: Colour) => { const g = new T.SphereGeometry(1, 10, 7); g.scale(rx, ry, rz); put(g, x, y, z, colour); };
  const limb = (a: number[], c: number[], r0: number, r1: number, colour: Colour, seg = 8) => {
    const from = new T.Vector3(...a), to = new T.Vector3(...c), v = to.clone().sub(from), g = new T.CylinderGeometry(r1, r0, v.length(), seg);
    g.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 1, 0), v.clone().normalize()));
    const m = from.clone().add(to).multiplyScalar(0.5);
    put(g, m.x, m.y, m.z, colour);
  };

  // ---- steps and pedestal (grey granite)
  box(0, 0, 0, 3.4, 0.18, 3.4, 'concrete');
  box(0, 0.18, 0, 3.0, 0.18, 3.0, 'concrete');
  box(0, 0.36, 0, 2.55, 0.5, 2.55, 'concrete');          // base block
  box(0, 0.86, 0, 2.25, 0.2, 2.25, 'greyBrick');          // base moulding
  const dieY = 1.06, dieH = 1.55, dieW = 1.9;
  box(0, dieY, 0, dieW, dieH, dieW, 'concrete');
  box(0, dieY + dieH, 0, 2.05, 0.18, 2.05, 'greyBrick');   // neck
  box(0, dieY + dieH + 0.18, 0, 2.4, 0.3, 2.4, 'concrete'); // cornice
  box(0, dieY + dieH + 0.48, 0, 2.2, 0.1, 2.2, 'greyBrick');
  // recessed panel borders (raised frames) on the front and the two side faces
  const frame = (x: number, z: number, nx: number, nz: number) => {
    const w = 1.35, h = 1.0, y = dieY + 0.25, out = dieW / 2 + 0.03;
    const alongX = nz !== 0; // face normal along z: panel extends in x
    const sx = alongX ? w : 0.05, sz = alongX ? 0.05 : w;
    box(x + nx * out, y, z + nz * out, alongX ? w : 0.06, h, alongX ? 0.06 : w, 'greyBrick');
    void sx; void sz;
  };
  frame(0, 0, 0, 1); frame(0, 0, 1, 0); frame(0, 0, -1, 0);
  // lettering: THORBECKE on the front die (gilt), OPTIMO CIVI / CIVES on the figure's left side panel (+x), a small text block on the right
  const front = dieW / 2 + 0.07;
  { const word = 'THORBECKE', px = 0.024, W = textWidth(word, px);
    for (const t of textBoxes(word, px)) box((t.x + t.w / 2 - W / 2), dieY + 0.62 + t.y, front + 0.02, t.w, t.h, 0.04, 'gold'); }
  { const word = 'OPTIMO CIVI', px = 0.016, W = textWidth(word, px);
    for (const t of textBoxes(word, px)) box(dieW / 2 + 0.06, dieY + 0.8 + t.y, -(t.x + t.w / 2 - W / 2), 0.04, t.h, t.w, 'gold'); }
  { const word = 'CIVES', px = 0.016, W = textWidth(word, px);
    for (const t of textBoxes(word, px)) box(dieW / 2 + 0.06, dieY + 0.5 + t.y, -(t.x + t.w / 2 - W / 2), 0.04, t.h, t.w, 'gold'); }

  // ---- bronze plate and figure (2.35 m)
  const pY = dieY + dieH + 0.58;
  box(0, pY, 0, 1.6, 0.26, 1.5, 'bronze');
  const base = pY + 0.26;
  // shoes and legs: weight on the left leg, right foot a little forward and out
  box(0.16, base, 0.1, 0.22, 0.1, 0.4, 'bronze'); box(-0.22, base, 0.2, 0.22, 0.1, 0.42, 'bronze');
  limb([0.16, base + 0.1, 0.0], [0.16, base + 0.95, -0.02], 0.1, 0.14, 'bronze');
  limb([-0.22, base + 0.1, 0.08], [-0.2, base + 0.95, 0.0], 0.1, 0.14, 'bronze');
  // frock coat: skirts to the knee, waisted torso, lapels as a slight ridge
  { const g = new T.CylinderGeometry(0.31, 0.36, 0.75, 10); put(g, 0, base + 1.22, -0.02, 'bronze'); }
  { const g = new T.CylinderGeometry(0.31, 0.29, 0.5, 10); put(g, 0, base + 1.82, 0, 'bronze'); }
  ball(0, base + 2.1, 0, 0.35, 0.14, 0.2, 'bronze');                                  // shoulders
  box(0, base + 1.6, 0.27, 0.12, 0.7, 0.05, 'bronze');                                  // lapels / waistcoat front
  // arms: left forearm folded up holding the roll at the chest; right arm lowered, hand on the stump
  limb([0.34, base + 2.05, 0.0], [0.42, base + 1.6, 0.12], 0.09, 0.08, 'bronze');
  limb([0.42, base + 1.6, 0.12], [0.1, base + 1.85, 0.3], 0.08, 0.07, 'bronze');
  { const g = new T.CylinderGeometry(0.045, 0.045, 0.3, 8); g.rotateZ(Math.PI / 2.4); put(g, 0.08, base + 1.9, 0.36, 'bronze'); }   // rolled document
  limb([-0.34, base + 2.05, 0.0], [-0.52, base + 1.55, 0.1], 0.09, 0.08, 'bronze');
  limb([-0.52, base + 1.55, 0.1], [-0.62, base + 1.18, 0.34], 0.08, 0.07, 'bronze');
  ball(-0.62, base + 1.12, 0.38, 0.08, 0.07, 0.1, 'bronze');
  // neck, head with side-swept hair and a high collar
  limb([0, base + 2.12, 0], [0, base + 2.22, 0.02], 0.1, 0.09, 'bronze');
  box(0, base + 2.12, 0.05, 0.26, 0.1, 0.2, 'bronze');
  ball(0, base + 2.4, 0.04, 0.14, 0.18, 0.15, 'bronze');
  ball(0, base + 2.5, -0.01, 0.15, 0.1, 0.15, 'bronze');
  // the stump at his right: fluted column, cloth over the top with a scroll
  { const g = new T.CylinderGeometry(0.27, 0.3, 1.05, 12); put(g, -0.78, base + 0.52, 0.33, 'bronze'); }
  { const g = new T.CylinderGeometry(0.34, 0.3, 0.22, 12); put(g, -0.78, base + 1.14, 0.33, 'bronze'); }
  box(-0.7, base + 1.2, 0.34, 0.5, 0.12, 0.42, 'bronze');
  { const g = new T.CylinderGeometry(0.05, 0.05, 0.42, 8); g.rotateX(Math.PI / 2); put(g, -0.7, base + 1.36, 0.34, 'bronze'); }
  for (let k = 0; k < 5; k++) { const a = k / 5 * Math.PI * 2; box(-0.78 + Math.cos(a) * 0.29, base + 0.2, 0.33 + Math.sin(a) * 0.29, 0.04, 0.8, 0.04, 'bronze'); }

  // ---- black iron railing round the steps, spear finials and a taller post at every corner
  {
    const half = 2.6, n = 24;
    const post = (x: number, z: number, tall: boolean) => {
      box(x, 0, z, 0.1, tall ? 1.25 : 1.0, 0.1, 'dark');
      put(new T.ConeGeometry(0.07, tall ? 0.32 : 0.22, 5), x, tall ? 1.41 : 1.11, z, 'dark');
    };
    for (const [ax, az, bx, bz] of [[-half, -half, half, -half], [half, -half, half, half], [half, half, -half, half], [-half, half, -half, -half]]) {
      const len = Math.hypot(bx - ax, bz - az), count = Math.round(len / 0.2);
      const ang = Math.atan2(bz - az, bx - ax);
      for (const y of [0.18, 0.55, 0.92]) {
        const g = new T.BoxGeometry(len, 0.04, 0.04); g.rotateY(-ang); put(g, (ax + bx) / 2, y, (az + bz) / 2, 'dark');
      }
      for (let k = 0; k < count; k++) {
        const t = (k + 0.5) / count, x = ax + (bx - ax) * t, z = az + (bz - az) * t;
        box(x, 0, z, 0.03, 0.9, 0.03, 'dark');
        put(new T.ConeGeometry(0.035, 0.14, 4), x, 0.97, z, 'dark');
      }
      post(ax, az, true);
    }
    void n;
  }
}
