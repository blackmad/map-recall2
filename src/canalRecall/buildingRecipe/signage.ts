/**
 * Shop-sign lettering as real geometry: a small single-stroke capital font
 * (each stroke is one flat quad, about 8-16 triangles per letter) laid on the
 * fascia. Legible at street distance, no textures, no font files.
 *
 * Glyph cells are 4 wide x 6 high; strokes are polylines in that grid.
 */
import * as T from 'three';

type Stroke = [number, number][];
const O: Stroke = [[1, 0], [0, 1], [0, 5], [1, 6], [3, 6], [4, 5], [4, 1], [3, 0], [1, 0]];
const P: Stroke = [[0, 0], [0, 6], [3, 6], [4, 5], [4, 4], [3, 3], [0, 3]];
export const GLYPHS: Record<string, {w: number; s: Stroke[]}> = {
  A: {w: 4, s: [[[0, 0], [2, 6], [4, 0]], [[0.8, 2], [3.2, 2]]]},
  B: {w: 4, s: [[[0, 0], [0, 6], [3, 6], [4, 5], [4, 4], [3, 3], [0, 3]], [[3, 3], [4, 2], [4, 1], [3, 0], [0, 0]]]},
  C: {w: 4, s: [[[4, 5], [3, 6], [1, 6], [0, 5], [0, 1], [1, 0], [3, 0], [4, 1]]]},
  D: {w: 4, s: [[[0, 0], [0, 6], [2.5, 6], [4, 4.5], [4, 1.5], [2.5, 0], [0, 0]]]},
  E: {w: 4, s: [[[4, 6], [0, 6], [0, 0], [4, 0]], [[0, 3], [3, 3]]]},
  F: {w: 4, s: [[[4, 6], [0, 6], [0, 0]], [[0, 3], [3, 3]]]},
  G: {w: 4, s: [[[4, 5], [3, 6], [1, 6], [0, 5], [0, 1], [1, 0], [3, 0], [4, 1], [4, 3], [2, 3]]]},
  H: {w: 4, s: [[[0, 0], [0, 6]], [[4, 0], [4, 6]], [[0, 3], [4, 3]]]},
  I: {w: 0, s: [[[0, 0], [0, 6]]]},
  J: {w: 4, s: [[[4, 6], [4, 1], [3, 0], [1, 0], [0, 1]]]},
  K: {w: 4, s: [[[0, 0], [0, 6]], [[4, 6], [0, 2.5]], [[1.2, 3.7], [4, 0]]]},
  L: {w: 4, s: [[[0, 6], [0, 0], [4, 0]]]},
  M: {w: 4, s: [[[0, 0], [0, 6], [2, 2.5], [4, 6], [4, 0]]]},
  N: {w: 4, s: [[[0, 0], [0, 6], [4, 0], [4, 6]]]},
  O: {w: 4, s: [O]},
  P: {w: 4, s: [P]},
  Q: {w: 4, s: [O, [[2.5, 1.5], [4, -0.5]]]},
  R: {w: 4, s: [P, [[2, 3], [4, 0]]]},
  S: {w: 4, s: [[[4, 5], [3, 6], [1, 6], [0, 5], [0, 4], [1, 3], [3, 3], [4, 2], [4, 1], [3, 0], [1, 0], [0, 1]]]},
  T: {w: 4, s: [[[0, 6], [4, 6]], [[2, 6], [2, 0]]]},
  U: {w: 4, s: [[[0, 6], [0, 1], [1, 0], [3, 0], [4, 1], [4, 6]]]},
  V: {w: 4, s: [[[0, 6], [2, 0], [4, 6]]]},
  W: {w: 5, s: [[[0, 6], [1.2, 0], [2.5, 4], [3.8, 0], [5, 6]]]},
  X: {w: 4, s: [[[0, 0], [4, 6]], [[0, 6], [4, 0]]]},
  Y: {w: 4, s: [[[0, 6], [2, 3], [4, 6]], [[2, 3], [2, 0]]]},
  Z: {w: 4, s: [[[0, 6], [4, 6], [0, 0], [4, 0]]]},
  '0': {w: 4, s: [O]}, '1': {w: 3, s: [[[0, 5], [2, 6], [2, 0]]]},
  '2': {w: 4, s: [[[0, 5], [1, 6], [3, 6], [4, 5], [4, 4], [0, 0], [4, 0]]]},
  '3': {w: 4, s: [[[0, 5], [1, 6], [3, 6], [4, 5], [4, 4], [3, 3], [1.5, 3]], [[3, 3], [4, 2], [4, 1], [3, 0], [1, 0], [0, 1]]]},
  '4': {w: 4, s: [[[3, 0], [3, 6], [0, 2], [4, 2]]]},
  '5': {w: 4, s: [[[4, 6], [0, 6], [0, 3], [3, 3], [4, 2], [4, 1], [3, 0], [0, 0]]]},
  '6': {w: 4, s: [[[4, 5], [3, 6], [1, 6], [0, 5], [0, 1], [1, 0], [3, 0], [4, 1], [4, 2], [3, 3], [0, 3]]]},
  '7': {w: 4, s: [[[0, 6], [4, 6], [1.5, 0]]]},
  '8': {w: 4, s: [[[1, 3], [0, 4], [0, 5], [1, 6], [3, 6], [4, 5], [4, 4], [3, 3], [1, 3], [0, 2], [0, 1], [1, 0], [3, 0], [4, 1], [4, 2], [3, 3]]]},
  '9': {w: 4, s: [[[0, 1], [1, 0], [3, 0], [4, 1], [4, 5], [3, 6], [1, 6], [0, 5], [0, 4], [1, 3], [4, 3]]]},
  '-': {w: 3, s: [[[0, 3], [3, 3]]]}, '.': {w: 0, s: [[[0, 0], [0, 0.4]]]}, '&': {w: 4, s: [[[4, 0], [0, 4], [1, 6], [3, 6], [3, 4], [0, 1], [1, 0], [3, 0], [4, 2]]]},
  ' ': {w: 3, s: []},
};
const GAP = 1.6, STROKE = 0.85;

export interface LetteringOptions { text: string; heightM: number; /** Maximum width of the text block. */ maxWidthM: number; align?: 'left' | 'centre' | 'right' }
export interface Lettering { positions: number[]; widthM: number; heightM: number; triangles: number }

/** Quads (two triangles each, facing +z) in sign-plane metres, origin at the block's centre. `mirrorX` reverses x and the winding (text on a mirrored elevation frame). */
export function letteringGeometry(o: LetteringOptions, mirrorX = false): Lettering {
  const chars = [...o.text.toUpperCase()].filter(c => c in GLYPHS);
  let units = 0;
  for (const c of chars) units += GLYPHS[c].w + GAP;
  units -= GAP;
  const unit = Math.min(o.heightM / 6, o.maxWidthM / Math.max(units, 1)), widthM = units * unit, h = 6 * unit;
  const stroke = STROKE * unit, positions: number[] = [];
  const x0 = -widthM / 2;
  const quad = (ax: number, ay: number, bx: number, by: number) => {
    const dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy) || 1, ux = dx / len, uy = dy / len, nx = -uy * stroke / 2, ny = ux * stroke / 2, ex = ux * stroke / 2, ey = uy * stroke / 2;
    const p = [[ax - ex + nx, ay - ey + ny], [ax - ex - nx, ay - ey - ny], [bx + ex - nx, by + ey - ny], [bx + ex + nx, by + ey + ny]];
    const tri = (i: number, j: number, k: number) => {
      const order = (p[j][0] - p[i][0]) * (p[k][1] - p[i][1]) - (p[j][1] - p[i][1]) * (p[k][0] - p[i][0]) > 0 ? [i, j, k] : [i, k, j];
      for (const v of order) positions.push(p[v][0], p[v][1], 0);
    };
    tri(0, 1, 2); tri(0, 2, 3);
  };
  let cursor = 0;
  for (const c of chars) {
    const g = GLYPHS[c];
    for (const stroke of g.s) for (let i = 0; i + 1 < stroke.length; i++) {
      const [ax, ay] = stroke[i], [bx, by] = stroke[i + 1];
      quad(x0 + (cursor + ax) * unit, -h / 2 + ay * unit, x0 + (cursor + bx) * unit, -h / 2 + by * unit);
    }
    cursor += g.w + GAP;
  }
  if (mirrorX) for (let i = 0; i < positions.length; i += 9) for (const k of [0, 3, 6]) positions[i + k] = -positions[i + k];
  if (mirrorX) {
    for (let i = 0; i < positions.length; i += 9) {
      for (const k of [0, 1, 2]) { const t = positions[i + 3 + k]; positions[i + 3 + k] = positions[i + 6 + k]; positions[i + 6 + k] = t; }
    }
  }
  return {positions, widthM, heightM: h, triangles: positions.length / 9};
}

export interface SignPlacement { leftM: number; widthM: number; bottomM: number; heightM: number; depthM: number; frontLeftM: number; mirrored: boolean; sign?: {text: string; textColour: string; background?: string; span?: number; align?: 'left' | 'centre' | 'right'} }

/** Add lettering meshes to the named elevation group; returns the triangle count added. */
export function addLettering(elevation: T.Object3D, f: SignPlacement, colour: string, pandId: string): number {
  const sign = f.sign; if (!sign) return 0;
  const pad = 0.12, avail = f.widthM - 2 * pad, span = sign.span ?? 0.8;
  const lettering = letteringGeometry({text: sign.text, heightM: Math.min(0.34, f.heightM * 0.55), maxWidthM: avail * span, align: sign.align}, f.mirrored);
  const align = sign.align ?? 'centre';
  // x of the block centre in viewer metres from the viewer's left of the fascia.
  const cx = align === 'left' ? pad + lettering.widthM / 2 : align === 'right' ? f.widthM - pad - lettering.widthM / 2 : f.widthM / 2;
  const localX = f.mirrored ? f.frontLeftM + f.widthM - cx : f.frontLeftM + cx;
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.Float32BufferAttribute(lettering.positions, 3));
  g.computeVertexNormals();
  g.translate(localX, f.bottomM + f.heightM / 2, f.depthM + 0.03);
  const mesh = new T.Mesh(g, new T.MeshStandardMaterial({color: colour, roughness: 0.6}));
  mesh.name = 'sign/lettering'; mesh.userData = {component: 'sign', surface: 'sign', pandId};
  elevation.add(mesh);
  return lettering.triangles;
}
