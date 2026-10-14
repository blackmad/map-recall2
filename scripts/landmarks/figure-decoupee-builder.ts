import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {memorialFrame} from './memorial-frame';

/**
 * Figure decoupee (Pablo Picasso, 1965; Vondelpark near the Amsterdamse Poort; sand-blasted concrete with dark aggregate by Carl Nesjar): a flat,
 * free-standing cut-out slab, a bull/fish-like head with two horns, a tail fin, a fish fin and an eye, the face engraved with dark lines. Outline traced
 * by hand from the Wikimedia Commons photo "Figure decoupee in 2019 (1)" (CC BY-SA 4.0, Cees); placement and orientation from Gemeente Amsterdam
 * panoramas TMX7316010203-001687_pano_0000_001782/1784, -002062_pano_0000_001260, -001892_pano_0000_002736 (broad face towards about 140/320 degrees,
 * edge-on from the south-west in -001687_pano_0000_001857). FACING 140 is an estimate (+-20 degrees); the 4.4 m height and 0.25 m thickness are visual
 * estimates. Only the near face is engraved here (the far face was never seen).
 */
const FACING = 140;
// outline in photo pixels (600 px wide overlay of the Commons photo), clockwise on screen from the bottom left of the base
const OUTLINE: [number, number][] = [
  [250, 790], [228, 745], [214, 690], [212, 620], [150, 545], [55, 585], [52, 540], [60, 470], [65, 415], [150, 455], [180, 440], [235, 405],
  [150, 400], [95, 375], [72, 340], [80, 255], [100, 185], [125, 172], [155, 180], [160, 250], [165, 310], [200, 340], [260, 330], [305, 345],
  [330, 320], [370, 290], [380, 215], [385, 185], [425, 178], [470, 190], [515, 240], [518, 300], [500, 350], [470, 390], [430, 410], [470, 420],
  [500, 415], [522, 415], [534, 435], [536, 500], [515, 530], [500, 520], [512, 565], [500, 600], [440, 612], [415, 628], [400, 710], [385, 790], [320, 820],
];
// engraved lines (photo px polylines) on the near face
const LINES: [number, number][][] = [
  [[118, 185], [125, 260], [150, 330], [200, 365], [265, 360], [300, 345]],
  [[420, 188], [445, 260], [440, 330], [415, 395]],
  [[310, 345], [292, 440], [265, 520], [235, 610], [262, 720], [285, 790]],
  [[150, 540], [215, 560], [300, 600], [400, 610]],
  [[70, 505], [150, 520]], [[70, 470], [150, 480]], [[72, 540], [148, 548]],
  [[500, 450], [470, 470], [455, 500], [445, 560], [415, 625]],
  [[330, 400], [380, 470], [430, 520]],
  [[240, 650], [300, 640], [380, 625]], [[230, 700], [300, 690], [390, 670]],
  [[250, 745], [300, 735], [330, 760]],
];

export function buildFigureDecoupee(_w: number, _d: number, b: BuildingTools) {
  const {put} = memorialFrame(b, FACING);
  const H = 4.4, S = H / 650, T0 = 0.25, SINK = 0.05;
  const X = (px: number) => (px - 300) * S, Y = (py: number) => (820 - py) * S - SINK;
  const sh = new T.Shape();
  OUTLINE.forEach(([px, py], i) => (i ? sh.lineTo(X(px), Y(py)) : sh.moveTo(X(px), Y(py))));
  sh.closePath();
  const g = new T.ExtrudeGeometry(sh, {depth: T0, bevelEnabled: false});
  put(g, 0, 0, -T0 / 2, 'concrete');
  // engraved lines: thin dark strips 3 cm proud of the near face
  const z = T0 / 2 + 0.02;
  const stroke = (a: [number, number], c: [number, number], w: number) => {
    const x0 = X(a[0]), y0 = Y(a[1]), x1 = X(c[0]), y1 = Y(c[1]), len = Math.hypot(x1 - x0, y1 - y0);
    const sg = new T.BoxGeometry(len + w * 0.6, w, 0.04); sg.rotateZ(Math.atan2(y1 - y0, x1 - x0));
    put(sg, (x0 + x1) / 2, (y0 + y1) / 2, z, 'greyBrick');
  };
  for (const pl of LINES) for (let i = 0; i + 1 < pl.length; i++) stroke(pl[i], pl[i + 1], 0.045);
  for (const [px, py, r] of [[452, 497, 20], [432, 443, 14]] as [number, number, number][]) {
    put(new T.TorusGeometry(r * S, 0.025, 4, 14), X(px), Y(py), z + 0.015, 'greyBrick');
    const pupil = new T.CylinderGeometry(r * S * 0.35, r * S * 0.35, 0.04, 8); pupil.rotateX(Math.PI / 2);
    put(pupil, X(px), Y(py), z + 0.015, 'greyBrick');
  }
}
