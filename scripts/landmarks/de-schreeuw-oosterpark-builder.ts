import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {memorialFrame} from './memorial-frame';

/**
 * De Schreeuw (The Scream, Jeroen Henneman, 2007) in the Oosterpark: the memorial to Theo van Gogh, murdered at the Linnaeusstraat in 2004. A
 * stainless-steel head in profile made of seven vertical blades about 12 cm thick and 15 cm apart: the column is a woman's or man's neck and chest
 * (chest bulge, a notch at the throat), and the head at the top throws its chin up, opens the mouth in a cry, tips the nose and brow and lets
 * the hair stream backwards as seven long ribbons. The blades are the same silhouette, each a little shorter and further back than the last, so
 * the profile reads from the side as layered lines and from the front as a row of thin steel strips. A stainless plate lies in the grass beside the
 * foot with the title and a text about the work.
 * Source photos: Wikimedia Commons "2020 De Schreeuw (01) (03) (06) (08)" (Ceescamel, CC BY-SA 4.0) and "De schreeuw - oosterpark" (CC BY-SA 3.0);
 * the 2019-2020 panoramas show the statue 15-20 m SW of the backlog point (a ray intersection of three panoramas, +-4 m), seen from the north.
 * Local frame: +z is the way the face looks (the cry), +x its left; the blades stack along x. FACING 110 (the face looks ESE) is an estimate (+-30) read
 * from those panoramas, where the face turns to the camera's left while it looks SSW. Height 3.7 m and the blade pitch are scaled off the people in the
 * Commons photos and the 0.4 m plate: estimates.
 */
const FACING = 110;

/** Silhouette of one blade in (z, y): front edge up the chest and face, hair ribbon back, back edge down the neck. */
const FRONT: [number, number][] = [
  [0.2, 0], [0.22, 0.8], [0.3, 1.4], [0.37, 1.75], [0.26, 2.1], [0.3, 2.4], [0.42, 2.58], [0.35, 2.74], [0.4, 2.84], [0.32, 2.95],
  [0.52, 3.12], [0.36, 3.28], [0.42, 3.45], [0.3, 3.62], [0.1, 3.78],
];
const HAIR: [number, number][] = [[-0.45, 3.84], [-0.95, 3.72], [-1.35, 3.5]];
const BACK: [number, number][] = [[-1.34, 3.66], [-0.9, 3.56], [-0.5, 3.4], [-0.3, 3.15], [-0.26, 2.7], [-0.2, 2.0], [-0.12, 1.4], [-0.16, 0.8], [-0.22, 0]];

export function buildDeSchreeuwOosterpark(_w: number, _d: number, b: BuildingTools) {
  const fr = memorialFrame(b, FACING);
  const {put, box, lettering} = fr;
  const N = 7, THICK = 0.1, PITCH = 0.27;
  for (let i = 0; i < N; i++) {
    const k = i / (N - 1);
    // each blade is a little lower and further back at the head, the chest keeps its place
    const sh = new T.Shape();
    const pts = [...FRONT, ...HAIR, ...BACK].map(([z, y]): [number, number] => {
      const up = Math.max(0, y - 1.6) / 2.2;
      return [z - 0.07 * i * up - 0.025 * i, y - 0.1 * k * up * (z > 0 ? 1 : 0.6)];
    });
    sh.moveTo(pts[0][0], pts[0][1]);
    for (const [z, y] of pts.slice(1)) sh.lineTo(z, y);
    const g = new T.ExtrudeGeometry(sh, {depth: THICK, bevelEnabled: false});
    g.rotateY(-Math.PI / 2);                       // shape x -> local +z, extrusion -> -x
    g.translate(THICK / 2, 0, 0);
    put(g, (i - (N - 1) / 2) * PITCH, 0, 0, 'frame');
  }
  // a shallow footing joins the blades at the foot (they are one welded piece)
  box(0, 0, 0.05, 1.9, 0.07, 0.62, 'concrete');
  // stainless plate in the grass at the foot, to the front-left, with the title in raised letters
  box(1.1, 0, 1.1, 0.42, 0.02, 0.42, 'concrete');
  lettering('DE SCHREEUW', 0.03, 0.3, 1.1, 0.021, 1.1, 'up', 'frame', 0.004);
}
