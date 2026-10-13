import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {placeFigure, localFrame, letterBoxes, rod} from './figure-kit';

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
  // Inscription panel on the die's front face (gold lettering on the stone: the name, then the Amsterdam line); plain panels on the other faces.
  box(0, 2.35, 1.75, 2.5, 1.45, 0.1, 'stone');
  for (const g of letterBoxes('JOOST VAN DEN VONDEL', 0.2, 2.2, 0.04)) put(g, 0, 3.5, 1.8, 'gold');
  for (const g of letterBoxes('GEVESTIGD TE AMSTERDAM', 0.12, 1.8, 0.035)) put(g, 0, 3.05, 1.8, 'gold');
  for (const [px, pz, w, d] of [[0, -1.75, 1.6, 0.1], [1.75, 0, 0.1, 1.6], [-1.75, 0, 0.1, 1.6]]) box(px, 2.5, pz, w, 1.2, d, 'stone');
  // Four seated winged allegories on the step at the die's corners (photographs Ceescamel 2019 and the Commons Hullernuc view): front left the
  // tragic mask, front right the lyre, rear right the book, rear left the praying figure. Kit figures, 3.0 m standing height, in sandstone; wings behind.
  const fr = localFrame(yaw);
  const wing = (x: number, z: number, face: number, side: number) => {
    const sh = new T.Shape();
    sh.moveTo(0, 0); sh.lineTo(0.4 * side, 0.15); sh.lineTo(0.5 * side, 0.8); sh.lineTo(0.25 * side, 1.05); sh.lineTo(0.04 * side, 0.65); sh.closePath();
    const g = new T.ExtrudeGeometry(sh, {depth: 0.07, bevelEnabled: false});
    g.rotateY(face); put(g, x, 2.9, z, 'sandstone');
  };
  const allegory = (x: number, z: number, face: number, kind: 'mask' | 'lyre' | 'book' | 'pray') => {
    box(x, 1.9, z, 1.0, 0.5, 0.9, 'sandstone');
    const ground = fr.pt(x, 2.4, z);
    const arms = kind === 'pray' ? {l: {pitch: 0.8, roll: -0.25, bend: 1.9}, r: {pitch: 0.8, roll: -0.25, bend: 1.9}}
      : kind === 'lyre' ? {l: {pitch: 0.9, bend: 1.3}, r: {pitch: 1.0, bend: 1.5}}
      : kind === 'mask' ? {l: {pitch: 0.4, bend: 1.2}, r: {pitch: 0.2, bend: 0.8}}
      : {l: {pitch: 0.7, bend: 1.5}, r: {pitch: 0.4, bend: 1.0}};
    const j = placeFigure(b, {
      height: 3.0, pelvisY: 0.1, stout: 1.3, skirt: {len: 0.9, flare: 1.7}, lean: kind === 'pray' ? 0.12 : 0.04,
      legs: {l: {pitch: 1.45, bend: 1.35}, r: {pitch: 1.5, bend: 1.4}}, arms, head: {pitch: kind === 'pray' ? 0.4 : 0.1, yaw: kind === 'book' ? 0.3 : 0},
    }, {x: ground.x, y: ground.y, z: ground.z, yaw: fr.yaw + face}, 'stone');
    wing(x, z - Math.cos(face) * 0.3, face, 1); wing(x, z - Math.cos(face) * 0.3, face, -1);
    const prop = (g: T.BufferGeometry, c: Colour = 'sandstone') => b.add(g, c, 0, 0, 0);
    if (kind === 'lyre') {
      // a two-armed lyre held in the left hand: two uprights, a yoke and a sound box
      const up = new T.Vector3(0, 1, 0), h = j.handL;
      for (const dx of [-0.17, 0.17]) { const o = new T.Vector3(dx * Math.cos(fr.yaw + face), 0, -dx * Math.sin(fr.yaw + face)); prop(rod(h.clone().addScaledVector(up, -0.1).add(o), h.clone().addScaledVector(up, 0.7).add(o), 0.025)); }
      prop(rod(h.clone().addScaledVector(up, 0.7).add(new T.Vector3(-0.17 * Math.cos(fr.yaw + face), 0, 0.17 * Math.sin(fr.yaw + face))), h.clone().addScaledVector(up, 0.7).add(new T.Vector3(0.17 * Math.cos(fr.yaw + face), 0, -0.17 * Math.sin(fr.yaw + face))), 0.025));
      prop(new T.BoxGeometry(0.4, 0.16, 0.12).translate(h.x, h.y - 0.05, h.z));
    } else if (kind === 'mask') {
      const h = j.handL, f = new T.Vector3(Math.sin(fr.yaw + face), 0, Math.cos(fr.yaw + face));
      const m = new T.CylinderGeometry(0.2, 0.17, 0.07, 6); m.rotateX(Math.PI / 2); m.rotateY(fr.yaw + face);
      m.translate(h.x + f.x * 0.1, h.y + 0.05, h.z + f.z * 0.1); prop(m);
    } else if (kind === 'book') {
      const h = j.handL, bk = new T.BoxGeometry(0.5, 0.07, 0.4); bk.rotateY(fr.yaw + face); bk.translate(h.x, h.y - 0.05, h.z); prop(bk);
    }
  };
  allegory(-1.5, 1.95, 0.25, 'mask');
  allegory(1.5, 1.95, -0.25, 'lyre');
  allegory(1.5, -1.95, Math.PI - 0.25, 'book');
  allegory(-1.5, -1.95, Math.PI + 0.25, 'pray');
  // The bronze Vondel (kit figure, 3.3 m standing height): seated on a carved chair with turned legs, writing: the right hand holds a pen at the
  // chest, the left rests on a book on the knee; long hair, falling collar, the cloak over the shoulders and down behind the chair.
  box(0, top, -0.2, 1.3, 0.12, 1.1, 'bronze'); // plinth block under the chair
  for (const [cx, cz] of [[0.52, 0.3], [-0.52, 0.3], [0.52, -0.55], [-0.52, -0.55]]) cyl(cx, top + 0.12, cz, 0.07, 0.07, 0.62, 'bronze', 6);
  box(0, top + 0.74, -0.15, 1.3, 0.14, 1.0, 'bronze'); // seat
  box(0, top + 0.88, -0.62, 1.2, 1.5, 0.14, 'bronze'); // chair back
  for (const sx of [-1, 1]) box(sx * 0.62, top + 0.88, -0.1, 0.1, 0.42, 0.7, 'bronze');
  const sit = fr.pt(0, top + 0.88, -0.1), v = placeFigure(b, {
    height: 3.3, pelvisY: 0.1, stout: 1.15, skirt: {len: 0.32, flare: 1.3}, lean: 0.08,
    legs: {l: {pitch: 1.5, bend: 1.2, roll: 0.05}, r: {pitch: 1.45, bend: 1.15, roll: -0.05}},
    arms: {l: {pitch: 0.3, bend: 0.95, roll: 0.1}, r: {pitch: 0.95, bend: 1.95, roll: -0.15}},
    head: {yaw: 0.1, pitch: 0.12},
  }, {x: sit.x, y: sit.y, z: sit.z, yaw: fr.yaw}, 'bronze');
  // book on the left knee, pen in the right hand, long hair behind the head, cloak
  const fw = new T.Vector3(Math.sin(fr.yaw), 0, Math.cos(fr.yaw));
  const bk = new T.BoxGeometry(0.5, 0.07, 0.4); bk.rotateY(fr.yaw); bk.translate(v.handL.x, v.handL.y - 0.06, v.handL.z); b.add(bk, 'bronze', 0, 0, 0);
  b.add(rod(v.handR, v.handR.clone().addScaledVector(fw, 0.25).add(new T.Vector3(0, 0.08, 0)), 0.012, 4), 'bronze');
  const hair = new T.SphereGeometry(0.3, 6, 3); hair.scale(1, 1.1, 0.8); hair.translate(v.head.x - fw.x * 0.14, v.head.y - 0.08, v.head.z - fw.z * 0.14); b.add(hair, 'bronze', 0, 0, 0);
  const cloak = new T.Shape();
  cloak.moveTo(-0.5, 0); cloak.lineTo(0.5, 0); cloak.lineTo(0.75, -1.2); cloak.lineTo(-0.1, -1.55); cloak.lineTo(-0.8, -1.3); cloak.closePath();
  put(new T.ExtrudeGeometry(cloak, {depth: 0.12, bevelEnabled: false}), -0.05, top + 2.15, -0.74, 'bronze');
}
