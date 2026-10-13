import * as T from 'three';
import type {BuildingTools} from './cultural-builders';

/**
 * Rembrandtmonument, Rembrandtplein (Louis Royer, bronze cast in iron, unveiled 27 May 1852; the plaza was renamed after it).
 * Original low-poly figure from the Rijksmuseum print RP-P-1933-342 (CC0) for the pose and costume and the Gemeente Amsterdam
 * panoramas (CC BY 4.0, 2020 and 2025, four aimed views) for the pedestal, plaques and the stepped granite terrace.
 * Local frame: x east, z south, y up; the figure faces bearing FACING (clockwise from north), the pedestal is square.
 * Sizes are estimates from the panoramas against street furniture (figure about 2.9 m on a 3.1 m pedestal).
 */
const FACING = 225 * Math.PI / 180;

type Colour = Parameters<BuildingTools['add']>[1];

export function buildRembrandtmonument(_w: number, _d: number, b: BuildingTools) {
  const yaw = Math.PI - FACING;
  /** Place a local-frame geometry (x right of the figure, z in front of it, y up) in the model frame. */
  const put = (g: T.BufferGeometry, x: number, y: number, z: number, colour: Colour) => {
    g.rotateY(yaw);
    const c = Math.cos(yaw), s = Math.sin(yaw);
    b.add(g, colour, x * c + z * s, y, -x * s + z * c);
  };
  const box = (x: number, y: number, z: number, w: number, h: number, d: number, colour: Colour) => put(new T.BoxGeometry(w, h, d), x, y + h / 2, z, colour);
  const cyl = (x: number, y: number, z: number, r0: number, r1: number, h: number, colour: Colour, seg = 10) => put(new T.CylinderGeometry(r1, r0, h, seg), x, y + h / 2, z, colour);
  const ball = (x: number, y: number, z: number, rx: number, ry: number, rz: number, colour: Colour) => { const g = new T.SphereGeometry(1, 12, 8); g.scale(rx, ry, rz); put(g, x, y, z, colour); };
  /** A limb between two points (local frame), tapered. */
  const limb = (a: number[], c: number[], r0: number, r1: number, colour: Colour) => {
    const from = new T.Vector3(...a), to = new T.Vector3(...c), v = to.clone().sub(from), g = new T.CylinderGeometry(r1, r0, v.length(), 8);
    g.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 1, 0), v.clone().normalize()));
    const m = from.clone().add(to).multiplyScalar(0.5);
    put(g, m.x, m.y, m.z, colour);
  };

  // Terrace: a low granite platform with a black-stone coping, 11 x 6.5 m, one step up from the plaza (panoramas 2025, a/c/d); two flights of steps on its south-east side.
  const TH = 0.5;
  b.box(0, 0, 0, 11, TH, 6.5, 'concrete');
  b.box(0, TH - 0.02, 0, 11.3, 0.14, 6.8, 'greyBrick');
  const top = TH + 0.12;
  // Pedestal in grey granite (Royer's design): stepped plinth, die with a bronze plaque on each face, moulded cap.
  box(0, top, 0, 2.7, 0.35, 2.7, 'concrete');
  box(0, top + 0.35, 0, 2.3, 0.3, 2.3, 'greyBrick');
  box(0, top + 0.65, 0, 1.9, 2.2, 1.9, 'concrete');
  box(0, top + 2.85, 0, 2.2, 0.2, 2.2, 'greyBrick');
  box(0, top + 3.05, 0, 2.0, 0.18, 2.0, 'concrete');
  for (const [px, pz, w, d] of [[0, 0.97, 1.1, 0.06], [0, -0.97, 1.1, 0.06], [0.97, 0, 0.06, 1.1], [-0.97, 0, 0.06, 1.1]]) box(px, top + 1.2, pz, w, 1.0, d, 'dark');
  const base = top + 3.23;

  // The figure (local frame): standing on the cap, weight on the left leg, right foot forward; contrapposto.
  const F = 2.9;
  // Shoes and legs (stockings and knee breeches).
  box(0.2, base, 0.25, 0.3, 0.12, 0.55, 'bronze');
  box(-0.22, base, 0.05, 0.3, 0.12, 0.55, 'bronze');
  limb([0.2, base + 0.12, 0.12], [0.18, base + 0.95, 0.05], 0.1, 0.13, 'bronze');
  limb([-0.22, base + 0.12, 0.0], [-0.2, base + 0.95, 0.0], 0.1, 0.13, 'bronze');
  // Breeches and skirt of the jerkin.
  cyl(0, base + 0.9, 0.02, 0.4, 0.34, 0.6, 'bronze');
  // Torso: tapered doublet with a row of buttons and a flat collar.
  cyl(0, base + 1.5, 0.02, 0.32, 0.37, 0.7, 'bronze');
  for (let k = 0; k < 6; k++) put(new T.SphereGeometry(0.025, 5, 4), 0, base + 1.55 + k * 0.1, 0.36, 'gold');
  box(0, base + 2.15, 0.04, 0.5, 0.06, 0.4, 'bronze');
  // Cloak: a heavy drape from the left shoulder across the body and over the left forearm.
  const cloak = new T.Shape();
  cloak.moveTo(0, 0); cloak.lineTo(0.15, 0.1); cloak.lineTo(0.5, 0.0); cloak.lineTo(0.55, -0.9); cloak.lineTo(0.3, -1.45); cloak.lineTo(-0.4, -1.5); cloak.lineTo(-0.55, -0.9); cloak.lineTo(-0.35, -0.2); cloak.closePath();
  const cg = new T.ExtrudeGeometry(cloak, {depth: 0.14, bevelEnabled: false});
  put(cg, -0.12, base + 2.25, 0.28, 'bronze');
  ball(-0.38, base + 1.65, 0.06, 0.15, 0.55, 0.28, 'bronze');
  // Arms: left forearm raised under the cloak holding the hem, right hand at the belt holding a brush.
  limb([-0.36, base + 2.0, 0.0], [-0.42, base + 1.45, 0.22], 0.09, 0.08, 'bronze');
  limb([-0.42, base + 1.45, 0.22], [-0.1, base + 1.35, 0.4], 0.08, 0.07, 'bronze');
  limb([0.36, base + 2.0, 0.0], [0.42, base + 1.55, 0.2], 0.09, 0.08, 'bronze');
  limb([0.42, base + 1.55, 0.2], [0.14, base + 1.35, 0.36], 0.08, 0.07, 'bronze');
  ball(-0.05, base + 1.35, 0.42, 0.09, 0.08, 0.08, 'bronze');
  ball(0.12, base + 1.35, 0.38, 0.08, 0.07, 0.08, 'bronze');
  // Head with a soft wide beret, beard and moustache.
  cyl(0, base + 2.2, 0.04, 0.09, 0.08, 0.14, 'bronze');
  ball(0, base + 2.5, 0.06, 0.19, 0.24, 0.21, 'bronze');
  ball(0, base + 2.38, 0.2, 0.12, 0.09, 0.07, 'bronze');
  cyl(0.02, base + 2.68, 0.06, 0.3, 0.2, 0.2, 'bronze', 12);
  ball(0.04, base + 2.84, 0.04, 0.2, 0.08, 0.2, 'bronze');
  // Stump behind the left leg with the painter's palette, a portfolio and a scroll (print RP-P-1933-342).
  box(-0.62, base, -0.1, 0.5, 0.95, 0.4, 'bronze');
  box(-0.62, base + 0.95, -0.1, 0.56, 0.06, 0.46, 'bronze');
  put(new T.CylinderGeometry(0.2, 0.2, 0.03, 10).rotateX(Math.PI / 2.3), -0.5, base + 1.2, 0.2, 'bronze');
  box(-0.82, base + 0.5, 0.08, 0.04, 0.5, 0.4, 'bronze');
  put(new T.CylinderGeometry(0.06, 0.06, 0.5, 8).rotateZ(Math.PI / 2), -0.6, base + 1.05, -0.28, 'bronze');
  void F;
}
