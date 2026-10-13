import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {textBoxes, textWidth} from './pixel-font';

/**
 * Ruiterstandbeeld van koningin Wilhelmina, Rokin (Theresia van der Pant, unveiled 1960; bronze, the queen riding side-saddle on a walking horse, on
 * a tall inverted-pyramid bronze pedestal that stands on a stone pier of the Rokin bridge parapet).
 * Original low-poly figure from the RCE photographs of the statue (Loek Tangel, Commons, CC BY-SA 4.0), FaceMePLS (CC BY 2.0) and Gemeente
 * Amsterdam panoramas (CC BY 4.0, 2025): the horse's raised near foreleg, the skirt of the habit falling over its left side, the brimmed hat,
 * the reins, the funnel with the lettering WILHELMINA 1880-1962.
 * Local frame: x east, z south, y up; the horse faces bearing FACING (a visual estimate from the panoramas; clockwise from north). In the
 * figure's frame +z is forward, +x the horse's LEFT (the side the rider's skirt hangs on), y up.
 */
const FACING = 265 * Math.PI / 180;

type Colour = Parameters<BuildingTools['add']>[1];

export function buildWilhelminaRuiterstandbeeld(_w: number, _d: number, b: BuildingTools) {
  const yaw = Math.PI - FACING;
  const put = (g: T.BufferGeometry, x: number, y: number, z: number, colour: Colour) => {
    g.rotateY(yaw);
    const c = Math.cos(yaw), s = Math.sin(yaw);
    b.add(g, colour, x * c + z * s, y, -x * s + z * c);
  };
  const box = (x: number, y: number, z: number, w: number, h: number, d: number, colour: Colour) => put(new T.BoxGeometry(w, h, d), x, y + h / 2, z, colour);
  const ball = (x: number, y: number, z: number, rx: number, ry: number, rz: number, colour: Colour, pitch = 0, seg = 10) => {
    const g = new T.SphereGeometry(1, seg, Math.max(5, seg - 3)); g.scale(rx, ry, rz); if (pitch) g.rotateX(pitch); put(g, x, y, z, colour);
  };
  const limb = (a: number[], c: number[], r0: number, r1: number, colour: Colour, seg = 7) => {
    const from = new T.Vector3(...a), to = new T.Vector3(...c), v = to.clone().sub(from), g = new T.CylinderGeometry(r1, r0, v.length(), seg);
    g.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 1, 0), v.clone().normalize()));
    const m = from.clone().add(to).multiplyScalar(0.5);
    put(g, m.x, m.y, m.z, colour);
  };

  // Stone pier on the bridge parapet.
  box(0, 0, 0, 2.3, 1.0, 2.3, 'concrete');
  box(0, 1.0, 0, 2.55, 0.14, 2.55, 'greyBrick');
  // The funnel: a rectangular inverted pyramid, long axis along the horse (3.6 m at the top), 1.2 m square at the foot, 2.3 m high.
  const FY = 1.14, FH = 2.3, topL = 3.6, topW = 2.1, footL = 1.3, footW = 1.2;
  {
    const g = new T.CylinderGeometry(1, 1, FH, 4, 1); g.rotateY(Math.PI / 4);
    const pos = g.getAttribute('position') as T.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const top = pos.getY(i) > 0, hx = (top ? topW : footW) / 2, hz = (top ? topL : footL) / 2;
      pos.setXYZ(i, Math.sign(pos.getX(i)) * hx, pos.getY(i), Math.sign(pos.getZ(i)) * hz);
    }
    g.computeVertexNormals(); put(g, 0, FY + FH / 2, 0, 'bronze');
  }
  box(0, FY + FH, 0, topW + 0.14, 0.12, topL + 0.14, 'bronze');
  // Lettering on the left face: WILHELMINA (large) and 1880-1962, raised 3 cm, following the face's 11 degree lean.
  {
    const lean = Math.atan2((topW - footW) / 2, FH);
    const place = (text: string, pixel: number, yAt: number) => {
      const W = textWidth(text, pixel), faceX = (footW / 2) + ((yAt - FY) / FH) * (topW - footW) / 2;
      for (const t of textBoxes(text, pixel)) {
        const g = new T.BoxGeometry(0.05, t.h, t.w); g.rotateZ(-lean);
        put(g, faceX + 0.025, yAt + t.y + t.h / 2, -(t.x + t.w / 2 - W / 2) + 0.0, 'gold');
      }
    };
    place('WILHELMINA', 0.046, FY + 1.35);
    place('1880-1962', 0.034, FY + 0.95);
  }

  const base = FY + FH + 0.12;
  // ---- horse (walking: near foreleg raised and folded, off hind a step behind)
  ball(0, base + 2.05, -0.05, 0.52, 0.6, 1.2, 'bronze');                 // barrel
  ball(0, base + 2.0, -0.95, 0.55, 0.58, 0.6, 'bronze');                 // croup
  ball(0, base + 2.1, 0.7, 0.48, 0.56, 0.6, 'bronze');                   // chest
  limb([0, base + 2.2, 0.85], [0, base + 2.95, 1.3], 0.33, 0.22, 'bronze', 8); // arched neck
  ball(0, base + 2.62, 1.62, 0.17, 0.4, 0.2, 'bronze', -0.7);            // head, nose down
  put(new T.ConeGeometry(0.06, 0.28, 5), 0.1, base + 3.1, 1.42, 'bronze');
  put(new T.ConeGeometry(0.06, 0.28, 5), -0.1, base + 3.1, 1.42, 'bronze');
  // Legs: [hip, knee, hoof]
  const leg = (x: number, hip: [number, number], knee: [number, number], hoof: [number, number], r: number) => {
    limb([x, base + 1.5, hip[1]], [x, base + 0.95, knee[1]], r, r * 0.75, 'bronze');
    limb([x, base + 0.95, knee[1]], [x, base + 0.08, hoof[1]], r * 0.75, r * 0.5, 'bronze');
    box(x, base, hoof[1], r * 1.2, 0.1, r * 1.5, 'bronze');
    void hip; void knee; void hoof;
  };
  leg(-0.26, [0, 0.85], [0, 0.95], [0, 0.85], 0.21);   // off foreleg, planted
  leg(-0.26, [0, -0.9], [0, -0.95], [0, -1.15], 0.23);  // off hind, a step behind
  leg(0.26, [0, -0.9], [0, -0.85], [0, -0.8], 0.23);    // near hind, planted
  // near foreleg raised: upper arm forward, forearm folded back under the knee
  limb([0.26, base + 1.5, 0.85], [0.26, base + 1.3, 1.5], 0.17, 0.13, 'bronze');
  limb([0.26, base + 1.3, 1.5], [0.26, base + 0.75, 1.25], 0.13, 0.09, 'bronze');
  box(0.26, base + 0.62, 1.2, 0.14, 0.12, 0.2, 'bronze');
  // tail: a heavy plume falling from the croup
  limb([0, base + 2.4, -1.45], [0, base + 1.2, -1.75], 0.1, 0.18, 'bronze');
  // mane crest
  limb([0, base + 2.95, 1.3], [0, base + 2.45, 1.75], 0.04, 0.04, 'bronze');
  // saddle and bridle: a pad under the rider, noseband and cheek straps
  box(0, base + 2.62, -0.1, 0.7, 0.1, 0.9, 'bronze');
  box(0, base + 2.55, 1.66, 0.34, 0.06, 0.07, 'bronze');
  box(0.14, base + 2.62, 1.55, 0.04, 0.5, 0.04, 'bronze'); box(-0.14, base + 2.62, 1.55, 0.04, 0.5, 0.04, 'bronze');
  // ---- rider: side-saddle, torso upright, long habit skirt over the horse's left flank
  const sx = 0.0, sy = base + 2.72;
  { const g = new T.CylinderGeometry(0.2, 0.66, 1.05, 10, 1, true); g.rotateZ(-0.3); put(g, 0.42, base + 2.18, -0.05, 'bronze'); }
  { const g = new T.CylinderGeometry(0.4, 0.55, 0.38, 10); put(g, sx + 0.05, sy + 0.1, -0.05, 'bronze'); }
  { const g = new T.CylinderGeometry(0.2, 0.24, 0.7, 10); put(g, sx, sy + 0.62, -0.02, 'bronze'); }
  ball(sx, sy + 1.05, -0.02, 0.24, 0.12, 0.17, 'bronze');                 // shoulders
  limb([sx, sy + 1.12, 0], [sx, sy + 1.22, 0.02], 0.07, 0.06, 'bronze');  // neck
  ball(sx, sy + 1.38, 0.0, 0.11, 0.14, 0.12, 'bronze');                  // head
  put(new T.CylinderGeometry(0.3, 0.3, 0.035, 14), sx, sy + 1.5, 0.0, 'bronze');      // hat brim
  put(new T.CylinderGeometry(0.16, 0.17, 0.14, 12), sx, sy + 1.58, 0.0, 'bronze');    // hat crown
  // arms and reins: both hands low in front, reins to the bit
  limb([-0.2, sy + 1.0, 0.0], [-0.12, sy + 0.55, 0.38], 0.06, 0.05, 'bronze');
  limb([0.2, sy + 1.0, 0.0], [0.14, sy + 0.55, 0.36], 0.06, 0.05, 'bronze');
  for (const x of [-0.14, 0.14]) limb([x, sy + 0.5, 0.4], [x * 0.9, base + 2.55, 1.66], 0.012, 0.012, 'bronze', 4);
}
