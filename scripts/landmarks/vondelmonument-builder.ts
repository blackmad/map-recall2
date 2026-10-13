import * as T from 'three';
import type {BuildingTools} from './cultural-builders';

/**
 * Vondelmonument, Vondelpark (Louis Royer, unveiled 1867; pedestal and figures by Royer, the bronze Vondel seated on a chair).
 * Original low-poly interpretation from the Gemeente Amsterdam panoramas of 2017-04-13 (CC BY 4.0, four aimed views), the
 * Commons photograph "Amsterdam, Vondelpark monument of Joost van den Vondel" (Dguendel, CC BY 4.0) and the Rijksmuseum photograph
 * RP-F-F01187-BS (CC0). Proportions estimated from the panorama against the pedestal width (pedestal about 4.7 m, bronze 2.9 m).
 * Local frame: x east, z south, y up; the front (inscription, three allegorical figures, the seated poet) faces FACING.
 */
const FACING = 130 * Math.PI / 180;
type Colour = Parameters<BuildingTools['add']>[1];

export function buildVondelmonument(_w: number, _d: number, b: BuildingTools) {
  const yaw = Math.PI - FACING;
  const put = (g: T.BufferGeometry, x: number, y: number, z: number, colour: Colour) => {
    g.rotateY(yaw);
    const c = Math.cos(yaw), s = Math.sin(yaw);
    b.add(g, colour, x * c + z * s, y, -x * s + z * c);
  };
  const box = (x: number, y: number, z: number, w: number, h: number, d: number, colour: Colour) => put(new T.BoxGeometry(w, h, d), x, y + h / 2, z, colour);
  const cyl = (x: number, y: number, z: number, r0: number, r1: number, h: number, colour: Colour, seg = 10) => put(new T.CylinderGeometry(r1, r0, h, seg), x, y + h / 2, z, colour);
  const ball = (x: number, y: number, z: number, rx: number, ry: number, rz: number, colour: Colour) => { const g = new T.SphereGeometry(1, 12, 8); g.scale(rx, ry, rz); put(g, x, y, z, colour); };
  const limb = (a: number[], c: number[], r0: number, r1: number, colour: Colour) => {
    const from = new T.Vector3(...a), to = new T.Vector3(...c), v = to.clone().sub(from), g = new T.CylinderGeometry(r1, r0, v.length(), 8);
    g.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 1, 0), v.clone().normalize()));
    const m = from.clone().add(to).multiplyScalar(0.5);
    put(g, m.x, m.y, m.z, colour);
  };

  // Ground ring: a low octagonal stone kerb round the monument (the flower bed inside is not modelled) with eight carved posts
  // joined by chains (panorama b: six posts in view, 1.3 m, finials on gabled caps).
  const R = 6.4;
  const kerb = new T.Shape();
  for (let k = 0; k < 8; k++) { const a = (k + 0.5) * Math.PI / 4; const x = Math.cos(a) * R, y = Math.sin(a) * R; if (k === 0) kerb.moveTo(x, y); else kerb.lineTo(x, y); }
  kerb.closePath();
  const kerbG = new T.ExtrudeGeometry(kerb, {depth: 0.3, bevelEnabled: false});
  kerbG.rotateX(-Math.PI / 2);
  put(kerbG, 0, 0, 0, 'stone');
  for (let k = 0; k < 8; k++) {
    const a = (k + 0.5) * Math.PI / 4, x = Math.cos(a) * (R - 0.4), z = Math.sin(a) * (R - 0.4);
    box(x, 0.3, z, 0.55, 0.9, 0.55, 'sandstone');
    box(x, 1.2, z, 0.7, 0.18, 0.7, 'sandstone');
    put(new T.ConeGeometry(0.4, 0.4, 4).rotateY(Math.PI / 4), x, 1.5, z, 'sandstone');
    // chain to the next post: a thin sagging bar at 0.9 m
    const a2 = (k + 1.5) * Math.PI / 4, x2 = Math.cos(a2) * (R - 0.4), z2 = Math.sin(a2) * (R - 0.4), L = Math.hypot(x2 - x, z2 - z);
    const g = new T.BoxGeometry(L - 0.6, 0.05, 0.05);
    g.rotateY(-Math.atan2(z2 - z, x2 - x));
    put(g, (x + x2) / 2, 1.05, (z + z2) / 2, 'dark');
  }
  // Pedestal in pale sandstone: three-step base, die with an inscription panel, moulded cap, bronze plinth.
  box(0, 0.3, 0, 5.2, 0.35, 5.2, 'sandstone');
  box(0, 0.65, 0, 4.7, 0.35, 4.7, 'sandstone');
  box(0, 1.0, 0, 4.2, 0.9, 4.2, 'sandstone');
  box(0, 1.9, 0, 3.4, 2.0, 3.4, 'sandstone');
  box(0, 3.9, 0, 3.0, 0.3, 3.0, 'stone');
  box(0, 4.2, 0, 2.6, 0.2, 2.6, 'sandstone');
  box(0, 4.4, 0, 2.2, 0.3, 2.2, 'dark');
  const top = 4.7;
  // Inscription panel and carved reliefs on the die's front face; plain panels on the other faces.
  box(0.55, 2.9, 1.72, 1.2, 0.8, 0.06, 'stone');
  box(-0.7, 2.7, 1.72, 0.7, 1.1, 0.05, 'stone');
  for (const [px, pz, w, d] of [[0, -1.72, 1.6, 0.06], [1.72, 0, 0.06, 1.6], [-1.72, 0, 0.06, 1.6]]) box(px, 2.5, pz, w, 1.2, d, 'stone');
  // Three seated allegorical figures on the base step, in front of the die (left and right on stone seats, the central one raised).
  const seatedStone = (x: number, h: number, sx: number) => {
    box(x, 1.9, 1.95, 0.9, 0.45, 0.6, 'sandstone');
    box(x, 2.35, 1.85, 0.55, 0.55 * h, 0.35, 'stone');
    cyl(x, 2.75, 1.85, 0.28, 0.22, 0.6 * h, 'stone');
    ball(x, 2.75 + 0.7 * h, 1.87, 0.17, 0.2, 0.18, 'stone');
    limb([x + sx * 0.15, 3.0, 1.95], [x + sx * 0.5, 2.7, 2.15], 0.07, 0.06, 'stone');
  };
  seatedStone(-1.25, 1.0, -1);
  seatedStone(0.05, 1.25, 1);
  seatedStone(1.35, 1.0, 1);
  // The bronze Vondel: seated in a high-backed chair, the cloak thrown over the shoulders, the right forearm resting on a book on the knee.
  // chair
  box(0, top, -0.15, 1.15, 0.6, 0.95, 'bronze');
  box(0, top + 0.6, -0.55, 1.0, 1.4, 0.18, 'bronze');
  for (const s of [-1, 1]) box(s * 0.55, top + 0.6, 0.05, 0.12, 0.45, 0.7, 'bronze');
  // legs and shoes (knees forward, shoes on the plinth)
  limb([0.22, top + 0.75, 0.0], [0.26, top + 0.65, 0.58], 0.15, 0.12, 'bronze');
  limb([-0.22, top + 0.75, 0.0], [-0.24, top + 0.65, 0.58], 0.15, 0.12, 'bronze');
  limb([0.26, top + 0.65, 0.58], [0.28, top + 0.15, 0.68], 0.11, 0.1, 'bronze');
  limb([-0.24, top + 0.65, 0.58], [-0.26, top + 0.15, 0.68], 0.11, 0.1, 'bronze');
  box(0.28, top, 0.78, 0.26, 0.1, 0.5, 'bronze');
  box(-0.26, top, 0.78, 0.26, 0.1, 0.5, 'bronze');
  // torso leaning slightly forward, with doublet and sash
  put(new T.CylinderGeometry(0.36, 0.42, 1.0, 10).rotateX(0.12), 0, top + 1.45, -0.05, 'bronze');
  // cloak: a long drape behind and over the left shoulder down to the seat
  const cloak = new T.Shape();
  cloak.moveTo(-0.55, 0); cloak.lineTo(0.5, 0); cloak.lineTo(0.7, -1.7); cloak.lineTo(-0.2, -2.1); cloak.lineTo(-0.85, -1.9); cloak.closePath();
  put(new T.ExtrudeGeometry(cloak, {depth: 0.2, bevelEnabled: false}), -0.05, top + 2.15, -0.5, 'bronze');
  // arms: right forearm across the knee on a book, left hand on the chair arm
  limb([0.4, top + 1.85, -0.05], [0.5, top + 1.35, 0.3], 0.1, 0.08, 'bronze');
  limb([0.5, top + 1.35, 0.3], [0.1, top + 1.2, 0.55], 0.08, 0.07, 'bronze');
  box(0.1, top + 1.1, 0.55, 0.4, 0.12, 0.3, 'bronze');
  limb([-0.4, top + 1.85, -0.05], [-0.55, top + 1.35, 0.2], 0.1, 0.08, 'bronze');
  // head: long hair, moustache, high forehead
  cyl(0, top + 1.9, -0.02, 0.1, 0.09, 0.14, 'bronze');
  ball(0, top + 2.28, 0.0, 0.2, 0.26, 0.22, 'bronze');
  ball(0, top + 2.15, -0.12, 0.26, 0.3, 0.2, 'bronze');
}
