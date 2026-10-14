import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {memorialFrame} from './memorial-frame';
import {portraitHead} from './bust-kit';
import {lump} from './clothing-kit';

/**
 * Mama Baranka (Moeder Rots, Nelson Carrilho; Vondelpark, OSM node 6052790489): a rough-cast bronze woman, about 1.9 m, standing with her feet
 * apart on a thin irregular bronze disc about 2.4 m across that lies on the lawn and carries a spiral of incised text; a heavy shapeless
 * skirt-like body whose surface is all lumps and thumb marks, a child (or a bundle) held to her left breast in the crook of the arm, her right
 * arm across the front, short curled hair, a lined face lifted a little. The text on the disc is not legible in the photos, so it is modelled as
 * three incised arcs of line plates, not as words.
 * Source photos: Wikimedia Commons "Mama Baranka in 2019 (1) (2) (4) (6)" (Ceescamel, CC BY-SA 4.0). Every Amsterdam panorama blurs the statue
 * with a grey box, so the facing comes from the photos only: in photo (1) the figure faces the camera with the park road and a block of flats behind
 * it. Local frame: +z is the way she faces, +x her left. FACING 200 (SSW, towards the Vondelpark road) is a weak estimate (+-60). Heights and the disc are
 * scaled off the figure standard and the people in the photos: estimates.
 */
const FACING = 200;

export function buildMamaBaranka(_w: number, _d: number, b: BuildingTools) {
  const fr = memorialFrame(b, FACING);
  const {put, ball} = fr;
  const P = (x: number, y: number, z: number) => new T.Vector3(x, y, z);
  const B = 'bronze' as const;
  // ---- the disc: an irregular blob, thicker at the rim, with the incised text as three arcs of line plates
  for (const [x, z, rx, rz] of [[0, 0, 1.2, 1.1], [0.35, 0.3, 0.9, 0.8], [-0.4, -0.3, 0.85, 0.9]]) ball(x, 0.05, z, rx, 0.07, rz, B, 16);
  for (const [r, a0, a1] of [[0.8, 0.5, 2.7], [0.95, 0.2, 3.0], [1.05, 3.5, 5.8]]) {
    const n = 14;
    for (let i = 0; i < n; i++) {
      const a = a0 + (a1 - a0) * (i + 0.5) / n, len = r * (a1 - a0) / n * 0.8;
      const g = new T.BoxGeometry(len, 0.012, 0.03); g.rotateY(-a - Math.PI / 2); put(g, r * Math.sin(a), 0.115, r * Math.cos(a), 'dark');
    }
  }
  // ---- the woman: rough columns, hips and breast as lumps, never a smooth cylinder
  const L = (a: T.Vector3, c: T.Vector3, r0: number, r1: number, zs = 0.9) => lump(fr, a, c, r0, r1, B, {zs, seg: 9});
  L(P(0.24, 0.1, 0.12), P(0.14, 0.95, 0.04), 0.14, 0.22);              // left leg
  L(P(-0.24, 0.1, -0.08), P(-0.13, 0.95, -0.02), 0.13, 0.21);          // right leg, set back
  L(P(0, 0.9, 0), P(0.02, 1.4, 0.04), 0.3, 0.28, 0.72);               // hips and belly
  L(P(0.02, 1.38, 0.04), P(0.03, 1.62, 0.07), 0.27, 0.3, 0.7);        // chest
  ball(0.03, 1.62, 0.07, 0.36, 0.08, 0.2, B, 10);                      // shoulders
  ball(-0.12, 1.5, 0.22, 0.13, 0.15, 0.1, B, 7);                       // right breast
  // child at the left breast, arm cradling it; right forearm across the front
  ball(0.22, 1.36, 0.27, 0.15, 0.18, 0.13, B, 8);
  ball(0.22, 1.5, 0.3, 0.09, 0.09, 0.08, B, 6);
  L(P(0.3, 1.6, 0.05), P(0.36, 1.25, 0.14), 0.1, 0.085, 1);
  L(P(0.36, 1.25, 0.14), P(0.12, 1.2, 0.3), 0.085, 0.07, 1);
  L(P(-0.3, 1.58, 0.05), P(-0.32, 1.3, 0.15), 0.09, 0.08, 1);
  L(P(-0.32, 1.3, 0.15), P(0.0, 1.28, 0.32), 0.08, 0.065, 1);
  // thumb-mark roughness: lumps standing proud on the skirt and back
  for (const [x, y, z, r] of [[0.28, 0.6, 0.08, 0.07], [-0.26, 0.5, 0.0, 0.065], [0.05, 0.3, 0.16, 0.06], [0.0, 0.8, -0.2, 0.09], [-0.2, 1.2, -0.12, 0.08], [0.2, 1.1, -0.15, 0.07], [0.3, 0.85, 0.05, 0.08], [-0.25, 0.9, 0.1, 0.07], [-0.3, 1.45, -0.05, 0.09], [0.32, 1.5, -0.04, 0.08], [0.12, 0.5, -0.12, 0.07], [-0.12, 0.25, 0.1, 0.06], [-0.03, 1.1, 0.27, 0.08], [0.1, 0.7, 0.19, 0.07]]) ball(x, y, z, r, r, r, B, 5);
  // neck and head, a little lifted, short curls
  L(P(0.03, 1.62, 0.07), P(0.04, 1.76, 0.1), 0.085, 0.075, 1);
  portraitHead(fr, {x: 0.04, y: 1.86, z: 0.11, turn: 0.1, scale: 1.25, sex: 'f', hair: 'short', colour: B});
  for (const [x, y, z] of [[0.1, 1.97, 0.06], [-0.04, 1.98, 0.05], [0.0, 1.9, -0.06], [0.14, 1.9, 0.0]]) ball(x, y, z, 0.05, 0.05, 0.05, B, 5);
}
