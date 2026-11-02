import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {ledgeStrip, slab, type Frame} from './nearbar-kit';
import {holedWall, type HoledOpening, type WallQuad} from '../../src/canalRecall/landmarks/holedWall';

/**
 * Flat wall faces with openings cut through them (holedWall.ts), collected while a builder lays out its facades and emitted
 * at the end, one mesh per face colour and one per opening-back colour.
 *
 * Why: a window pane laid a few centimetres in front of an unholed wall z-fights at distance (audit zfight-near/-tight) and
 * shows no reveal. Builders that place many windows on many faces (the Apollo hotel's slab bays, the Sarphati Plaza tower)
 * push holes onto a face and get the face, the reveals and the recessed backs in one pass. `hole()` refuses an opening that
 * does not fit inside the face or would overlap one already there, so a facade rule written for a typical face cannot break
 * an odd one.
 */
type Col = Parameters<BuildingTools['add']>[1];
export type CutHole = HoledOpening & {back: Col | null};
export type CutFace = {f: Frame; len: number; y0: number; y1: number; c: Col; holes: CutHole[]};

export function geomOf(pos: number[]): T.BufferGeometry {
  const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.computeVertexNormals(); return g;
}

/**
 * A cut opening when it lies inside the face (margin `m`) and clear of its other openings; returns whether it was cut. Faces
 * under 1 m either way take none: the geometry audit never takes so small a plane as an opening's host wall.
 */
export function hole(F: CutFace, t0: number, t1: number, y0: number, y1: number, depth: number, back: Col | null, m = 0.04): boolean {
  if (F.len < 1 || F.y1 - F.y0 < 1) return false;
  if (t0 < m || t1 > F.len - m || y0 < F.y0 + m || y1 > F.y1 - m || t1 - t0 < 0.05 || y1 - y0 < 0.05) return false;
  if (F.holes.some(h => h.t0 < t1 && t0 < h.t1 && h.y0 < y1 && y0 < h.y1)) return false;
  F.holes.push({t0, t1, y0, y1, depth, back});
  return true;
}

/** Emits every face: wall and reveals in the face colour, backs grouped by colour. */
export function flushCutFaces(b: BuildingTools, faces: CutFace[]) {
  const byCol = new Map<Col, number[]>();
  const push = (c: Col, p: number[]) => { const a = byCol.get(c); if (a) a.push(...p); else byCol.set(c, [...p]); };
  for (const F of faces) {
    const hw = holedWall(F.len, F.y0, F.y1, F.holes);
    const P = (q: [number, number, number]) => [F.f.origin[0] + F.f.tangent[0] * q[0] + F.f.n[0] * q[2], q[1], F.f.origin[1] + F.f.tangent[1] * q[0] + F.f.n[1] * q[2]];
    const tris = (qs: WallQuad[]) => qs.flatMap(q => { const v = q.pts.map(P); return [...v[0], ...v[1], ...v[2], ...v[0], ...v[2], ...v[3]]; });
    push(F.c, [...tris(hw.face), ...tris(hw.reveals.flat())]);
    F.holes.forEach((h, i) => { if (h.back) push(h.back, tris([hw.backs[i]])); });
  }
  for (const [c, p] of byCol) if (p.length) b.add(geomOf(p), c);
}

/** Frame border of width fw round a w x h opening at t, y, standing d proud; sides taller than 8 m are closed slabs. */
export function border(b: BuildingTools, f: Frame, t: number, y: number, w: number, h: number, fw: number, d: number, c: Col) {
  const long = w > 8 ? slab : ledgeStrip;
  long(b, f, t, y - fw, w + 2 * fw, fw, d, c);
  long(b, f, t, y + h, w + 2 * fw, fw, d, c);
  for (const s of [-1, 1]) (h > 8 ? slab : ledgeStrip)(b, f, t + s * (w + fw) / 2, y, fw, h, d, c);
}
