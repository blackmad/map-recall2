import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {memorialFrame} from './memorial-frame';
import {portraitHead} from './bust-kit';
import {lump} from './clothing-kit';

/**
 * De Waterdraagster met vissen (Leo Braat) on the Bellamyplein: a round fountain basin with a low curved white concrete rim and a grated drain
 * strip along its inside; on the rim three small bronzes face the water: the Waterdraagster on the south edge (a stylised woman whose body
 * tapers into a fish tail on a square bronze base, both hands behind her head steadying a jug on it, scaled body, large staring eyes) and the
 * two fish on the north edge (Vis I and Vis II: a bulbous domed head with brow ridge, round eyes and a wide smiling mouth, a slanting body
 * with side fins and a tail on a square base, rearing out of the rim).
 * Source photos: Wikimedia Commons "2021 Waterdraagster met vissen - Waterdraagster (1)(2), Vis I (1), Vis II (1)" (Ceescamel, CC BY-SA 4.0) and
 * "Waterdraagster 4" (Marion Golsteijn, CC BY-SA 3.0); OSM nodes 9465999990 (waterdraagster), 2303927479 and 2303927486 (fish) fix the three
 * positions and the circle through them is the rim. The Commons photos stand inside the (dry) basin looking out, so every figure faces the
 * pond centre. Local frame: origin the Waterdraagster, +z north (FACING 0, the figure looks across the water to the fish), +x west.
 * The bronzes are about 0.9-1.0 m high and the rim 0.42 m, scaled off the 0.3 m bases and the 0.7 m rim width: estimates; the basin radius comes
 * from the three OSM nodes. The gate piers and the Kinderspeelplaats behind in the panoramas are not modelled.
 */
const FACING = 0;

export function buildWaterdraagsterBellamyplein(_w: number, _d: number, b: BuildingTools) {
  const fr = memorialFrame(b, FACING);
  const {put, box, ball} = fr;
  const P = (x: number, y: number, z: number) => new T.Vector3(x, y, z);
  // fish 1 (east -5.2, north +9.4), fish 2 (east +3.9, north +9.9) from the woman: local x = -east, z = north
  const A = {x: 0, z: 0}, F1 = {x: 5.2, z: 9.4}, F2 = {x: -3.9, z: 9.9};
  const d = 2 * (A.x * (F1.z - F2.z) + F1.x * (F2.z - A.z) + F2.x * (A.z - F1.z));
  const sq = (p: {x: number; z: number}) => p.x * p.x + p.z * p.z;
  const cx = (sq(A) * (F1.z - F2.z) + sq(F1) * (F2.z - A.z) + sq(F2) * (A.z - F1.z)) / d;
  const cz = (sq(A) * (F2.x - F1.x) + sq(F1) * (A.x - F2.x) + sq(F2) * (F1.x - A.x)) / d;
  const R = Math.hypot(A.x - cx, A.z - cz);
  const RIM = 0.42;
  // ---- rim: a white concrete ring 0.7 m wide, 0.42 m high, with a dark grate strip along its inner edge
  const ring = (r0: number, r1: number, y0: number, h: number, colour: 'concrete' | 'dark') => {
    const sh = new T.Shape(); sh.absarc(0, 0, r1, 0, Math.PI * 2, false);
    const hole = new T.Path(); hole.absarc(0, 0, r0, 0, Math.PI * 2, true); sh.holes.push(hole);
    const g = new T.ExtrudeGeometry(sh, {depth: h, bevelEnabled: false, curveSegments: 44});
    g.rotateX(-Math.PI / 2); g.translate(0, y0, 0);
    put(g, cx, 0, cz, colour);
  };
  ring(R - 0.35, R + 0.35, 0, RIM, 'concrete');
  ring(R - 1.0, R - 0.45, 0, 0.06, 'dark');
  // basin floor
  const floor = new T.CircleGeometry(R - 0.99, 44); floor.rotateX(-Math.PI / 2); put(floor, cx, 0.01, cz, 'blue');
  // unit vector from a rim point towards the pond centre (the way the bronze faces)
  const face = (p: {x: number; z: number}) => Math.atan2(cx - p.x, cz - p.z);
  const placed = (p: {x: number; z: number}, fn: (g: (x: number, y: number, z: number) => T.Vector3) => void) => {
    const t = face(p), c = Math.cos(t), s = Math.sin(t);
    fn((x, y, z) => P(p.x + x * c + z * s, RIM + y, p.z - x * s + z * c));
  };
  // ---- the Waterdraagster
  placed(A, W => {
    const base = W(0, 0, 0);
    box(base.x, base.y, base.z, 0.34, 0.07, 0.34, 'bronze');
    // fish tail: two flared flukes at the foot, the scaled tapering body, the chest, shoulders
    lump(fr, W(0, 0.06, 0), W(0, 0.42, 0), 0.05, 0.12, 'bronze', {zs: 0.55, seg: 8});
    for (const sx of [-1, 1]) lump(fr, W(sx * 0.05, 0.07, 0), W(sx * 0.17, 0.2, -0.02), 0.03, 0.01, 'bronze', {zs: 0.4, seg: 4});
    lump(fr, W(0, 0.42, 0), W(0, 0.66, 0), 0.12, 0.15, 'bronze', {zs: 0.55, seg: 8});
    const sh = W(0, 0.68, 0); ball(sh.x, sh.y, sh.z, 0.17, 0.05, 0.09, 'bronze', 8);
    // arms up, elbows out wide, hands behind the head
    for (const sx of [-1, 1]) {
      const s0 = W(sx * 0.15, 0.66, 0), e = W(sx * 0.31, 0.8, 0), h = W(sx * 0.07, 0.9, -0.07);
      lump(fr, s0, e, 0.04, 0.035, 'bronze', {seg: 6, cap: true}); lump(fr, e, h, 0.035, 0.027, 'bronze', {seg: 6});
    }
    // head with a big staring face, the jug on top
    const hd = W(0, 0.82, 0.01);
    portraitHead(fr, {x: hd.x, y: hd.y, z: hd.z, turn: face(A), scale: 0.62, sex: 'f', hair: 'bald', colour: 'bronze'});
    for (const sx of [-1, 1]) { const e = W(sx * 0.035, 0.84, 0.065); ball(e.x, e.y, e.z, 0.014, 0.014, 0.01, 'bronze', 5); }
    const j0 = W(0, 0.84, 0), j1 = W(0, 1.0, 0);
    lump(fr, j0, j1, 0.045, 0.06, 'bronze', {seg: 8});
    lump(fr, j1, W(0, 1.06, 0), 0.06, 0.03, 'bronze', {seg: 8});
  });
  // ---- the two fish: tail on the base, body rearing up and forwards, bulbous head
  for (const p of [F1, F2]) placed(p, W => {
    const base = W(0, 0, 0);
    box(base.x, base.y, base.z, 0.42, 0.05, 0.42, 'bronze');
    lump(fr, W(0, 0.05, -0.2), W(0, 0.3, -0.04), 0.03, 0.1, 'bronze', {zs: 0.8, seg: 8});          // tail stalk into the body
    lump(fr, W(0, 0.3, -0.04), W(0, 0.45, 0.12), 0.1, 0.12, 'bronze', {seg: 9});                   // body
    const hd = W(0, 0.5, 0.17); ball(hd.x, hd.y, hd.z, 0.17, 0.16, 0.17, 'bronze', 11);            // domed head
    for (const sx of [-1, 1]) {
      const brow = W(sx * 0.07, 0.56, 0.3); ball(brow.x, brow.y, brow.z, 0.05, 0.022, 0.03, 'bronze', 6);
      const eye = W(sx * 0.075, 0.52, 0.32); ball(eye.x, eye.y, eye.z, 0.026, 0.026, 0.02, 'dark', 5);
      lump(fr, W(sx * 0.1, 0.34, 0), W(sx * 0.22, 0.2, -0.06), 0.03, 0.012, 'bronze', {zs: 0.4, seg: 4});   // side fin
    }
    const m = W(0, 0.42, 0.33); ball(m.x, m.y, m.z, 0.11, 0.014, 0.03, 'dark', 6);               // the wide mouth
    const t = W(0, 0.05, -0.22); lump(fr, t, W(0, 0.19, -0.3), 0.01, 0.07, 'bronze', {zs: 0.3, seg: 4});   // tail fin
  });
}
