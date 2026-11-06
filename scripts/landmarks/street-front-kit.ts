import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {archBand, ledgeStrip, poly, slab, type Frame} from './nearbar-kit';
import {geomOf} from './cut-face';
import {archOpeningWall, type ArchOpening, type Tri} from '../../src/canalRecall/landmarks/archOpeningWall';

/**
 * Street fronts laid along BAG chords, for landmark builders that sit a measured front in front of a 3DBAG massing
 * (the pattern binnengasthuis-kloveniersburgwal-builder.ts introduced, #208, there as module-level helpers). Round 5
 * centrum lane (#235) needed the same helpers in five builders, so they live here as one typed object per model:
 *
 *  - `sec`: a flat wall face OFF metres outside a chord, from s0 to s1 and y0 to y1, that takes cut openings;
 *  - `opening`: a cut opening with its frame ring and glazing bars standing inside the reveal (never flush, never 2-3 cm
 *    proud of the wall), refusing one that does not fit;
 *  - `archHead`: a round or segmental arched head over a cut opening (arch ring proud of the wall, tympanum infill
 *    recessed), which the rectangular cut holes cannot draw themselves;
 *  - `coping`, `along`, `endCap`: cornices over a wall top, extruded sections along a chord, and the end returns that
 *    close the gap between a front and the massing behind it.
 *
 * Coordinates: native plan (x east, z south, y up). A chord a -> b has its outward normal n = (-tz, tx); s runs from a.
 * Nothing here changes an existing model: the binnengasthuis builder keeps its own copies.
 */
export type P2 = [number, number];
export type Col = Parameters<BuildingTools['add']>[1];
export type Chord = {a: P2; b: P2};
export type FrontHole = ArchOpening & {back: Col | null};
export type FrontFace = {f: Frame; len: number; y0: number; y1: number; c: Col; holes: FrontHole[]};
export type Sec = {F: FrontFace; s0: number; s1: number; ch: Chord; off: number};
/** `rise`: segmental or round head (rise = w/2) of that height inside the opening's top; frames then stop at the springing. */
export type OpenOpts = {depth?: number; cols?: number; rows?: number; frame?: Col; back?: Col; edge?: number; bars?: number[]; rise?: number; barW?: number};

/** A cut opening when it lies inside the face (margin m) and clear of its other openings (bounding boxes). */
export function cutHole(F: FrontFace, h: FrontHole, m = 0.04): boolean {
  if (F.len < 1 || F.y1 - F.y0 < 1) return false;
  if (h.t0 < m || h.t1 > F.len - m || h.y0 < F.y0 + m || h.y1 > F.y1 - m || h.t1 - h.t0 < 0.05 || h.y1 - h.y0 < 0.05) return false;
  if (h.rise !== undefined && (h.rise <= 0 || h.rise > (h.t1 - h.t0) / 2 + 1e-9 || h.rise > h.y1 - h.y0)) return false;
  if (F.holes.some(o => o.t0 < h.t1 && h.t0 < o.t1 && o.y0 < h.y1 && h.y0 < o.y1)) return false;
  F.holes.push(h);
  return true;
}

export const chordLength = (ch: Chord) => Math.hypot(ch.b[0] - ch.a[0], ch.b[1] - ch.a[1]);

export function frameAt(ch: Chord, s: number, off: number): Frame & {len: number} {
  const L = chordLength(ch), tx = (ch.b[0] - ch.a[0]) / L, tz = (ch.b[1] - ch.a[1]) / L;
  return {origin: [ch.a[0] + tx * s - tz * off, ch.a[1] + tz * s + tx * off], tangent: [tx, tz], n: [-tz, tx], len: L};
}

/** Arch outline (round when rise >= w/2, segmental below) as a closed band polygon in (t, y) about the springing centre. */
export function archRingOutline(w: number, rise: number, th: number, steps = 8): P2[] {
  const half = w / 2, r = rise >= half - 1e-6 ? half : (half * half + rise * rise) / (2 * rise), cy = rise - r;
  const a0 = Math.asin(Math.min(1, half / r)), outer: P2[] = [], inner: P2[] = [];
  for (let k = 0; k <= steps; k++) {
    const a = -a0 + (2 * a0 * k) / steps, ro = r + th;
    outer.push([ro * Math.sin(a), cy + ro * Math.cos(a)]);
    inner.push([r * Math.sin(a), cy + r * Math.cos(a)]);
  }
  // foot of the ring: drop the outer ends to the springing line so the band sits on the jambs
  const o = outer.map(([x, y], i) => (i === 0 || i === steps ? [x, Math.min(y, 0)] as P2 : [x, y] as P2));
  return [...o, ...inner.reverse()];
}

/** Tympanum (the solid inside an arch above the springing line) as a polygon in (t, y). */
export function archFillOutline(w: number, rise: number, steps = 8): P2[] {
  const half = w / 2, r = rise >= half - 1e-6 ? half : (half * half + rise * rise) / (2 * rise), cy = rise - r;
  const a0 = Math.asin(Math.min(1, half / r)), pts: P2[] = [];
  for (let k = 0; k <= steps; k++) { const a = a0 - (2 * a0 * k) / steps; pts.push([r * Math.sin(a), cy + r * Math.cos(a)]); }
  return pts;
}

export function makeFrontKit(b: BuildingTools, OFF = 0.3) {
  const FACES: FrontFace[] = [];
  const sec = (ch: Chord, s0: number, s1: number, y0: number, y1: number, c: Col, off = OFF): Sec => {
    const fr = frameAt(ch, s0, off), F: FrontFace = {f: {origin: fr.origin, tangent: fr.tangent, n: fr.n}, len: s1 - s0, y0, y1, c, holes: []};
    FACES.push(F); return {F, s0, s1, ch, off};
  };
  /** Opening centred at chord s; the frame ring and bars stand 9 cm off the back, inside the reveal. */
  const opening = (S: Sec, s: number, y: number, w: number, h: number, o: OpenOpts = {}) => {
    const t = s - S.s0, depth = o.depth ?? 0.16, frame = o.frame ?? 'frame', back = o.back ?? 'glass', fw = o.edge ?? 0.07, d = Math.min(0.09, depth - 0.03), out = -depth;
    const H: FrontHole = {t0: t - w / 2, t1: t + w / 2, y0: y, y1: y + h, depth, back, ...(o.rise !== undefined ? {rise: o.rise, segments: 8} : {arch: 0})};
    if (!cutHole(S.F, H)) throw Error(`opening refused at s=${s.toFixed(2)} y=${y} on ${S.s0}-${S.s1}`);
    const f = S.F.f, hr = h - (o.rise ?? 0);          // frames and bars stop at the springing line under an arched head
    if (fw > 0) {
      const fb = Math.max(fw, 0.1);
      ledgeStrip(b, f, t, y, w, fb, d, frame, out);
      if (o.rise === undefined) ledgeStrip(b, f, t, y + h - fw, w, fw, d, frame, out);
      else ledgeStrip(b, f, t, y + hr - fw, w - 0.02, fw, d, frame, out);
      for (const sd of [-1, 1]) ledgeStrip(b, f, t + sd * (w - fw) / 2, y + fb, fw, hr - fw - fb, d, frame, out);
    }
    const cols = o.cols ?? 1, rows = o.rows ?? 1;
    const bw = o.barW ?? 0.05;                         // glazing-bar width: 5 cm sash bars, ~10 cm for the heavy timber crosses
    for (let k = 1; k < cols; k++) ledgeStrip(b, f, t - w / 2 + w * k / cols, y + fw, bw, hr - 2 * fw, d, frame, out);
    for (let k = 1; k < rows; k++) ledgeStrip(b, f, t, y + hr * k / rows - bw / 2, w - 2 * fw, bw, d, frame, out);
    for (const yb of o.bars ?? []) ledgeStrip(b, f, t, y + yb - 0.04, w - 2 * fw, 0.08, d, frame, out);
  };
  /** Wall-plane frame of a section, `proud` metres out of its face. */
  const faceFrame = (S: Sec, proud = 0): Frame => frameAt(S.ch, 0, S.off + proud);
  /** Arched head over an opening of width w whose top is at y: ring `th` wide standing `d` proud, tympanum 6 cm recessed... */
  const archHead = (S: Sec, s: number, y: number, w: number, rise: number, th: number, d: number, ring: Col, fill: Col | null = null) => {
    const f = faceFrame(S);
    poly(b, f, s, y, archRingOutline(w, rise, th), d, ring);
    if (fill) poly(b, f, s, y, archFillOutline(w, rise), 0.05, fill);
  };
  /** Round-headed relieving band (archBand) proud of the face. */
  const blindArch = (S: Sec, s: number, y: number, w: number, h: number, th: number, d: number, c: Col) => archBand(b, faceFrame(S), s, y, w, h, th, d, c);
  /** Coping or cornice over a wall top, `proud` out of the face and reaching `back` behind the chord to the massing; its
   *  underside lies on the wall's top edge, so the face's top boundary is covered. */
  const coping = (S: Sec, y: number, h: number, proud: number, c: Col, s0 = S.s0, s1 = S.s1, back = 0.5) => {
    slab(b, frameAt(S.ch, 0, S.off), (s0 + s1) / 2, y, s1 - s0 + 0.02, h, S.off + back + proud, c, -(S.off + back));
  };
  /** Closed solid along a chord: section polygon in (o, y) (o out of the chord), extruded from s0 to s1. */
  const along = (ch: Chord, s0: number, s1: number, sect: P2[], c: Col) => {
    const fr = frameAt(ch, 0, 0), shape = new T.Shape(sect.map(p => new T.Vector2(p[0], p[1])));
    const g = new T.ExtrudeGeometry(shape, {depth: s1 - s0, bevelEnabled: false, curveSegments: 4});
    const p = g.getAttribute('position');
    for (let i = 0; i < p.count; i++) {
      const o = p.getX(i), y = p.getY(i), s = s1 - p.getZ(i);
      p.setXYZ(i, fr.origin[0] + fr.tangent[0] * s + fr.n[0] * o, y, fr.origin[1] + fr.tangent[1] * s + fr.n[1] * o);
    }
    g.computeVertexNormals(); b.add(g, c);
  };
  /** End return quad in the plane s from o = outer back to o = inner, facing -t (sign -1) or +t (sign 1). */
  const endCap = (ch: Chord, s: number, y0: number, y1: number, c: Col, sign: -1 | 1, inner = -0.6, outer = OFF) => {
    const fr = frameAt(ch, s, 0), P = (o: number, y: number) => [fr.origin[0] + fr.n[0] * o, y, fr.origin[1] + fr.n[1] * o];
    const q = [P(outer, y0), P(inner, y0), P(inner, y1), P(outer, y1)];
    const nrm = [fr.tangent[0] * sign, 0, fr.tangent[1] * sign];
    const u = q[1].map((v, i) => v - q[0][i]), w = q[2].map((v, i) => v - q[0][i]);
    const flip = (u[1] * w[2] - u[2] * w[1]) * nrm[0] + (u[0] * w[1] - u[1] * w[0]) * nrm[2] < 0;
    const order = flip ? [0, 2, 1, 0, 3, 2] : [0, 1, 2, 0, 2, 3];
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(order.flatMap(i => q[i]), 3));
    g.computeVertexNormals(); b.add(g, c);
  };
  /** Emits every face: wall and reveals in the face colour, backs grouped by colour. */
  const flush = () => {
    const byCol = new Map<Col, number[]>();
    const push = (c: Col, p: number[]) => { const a = byCol.get(c); if (a) a.push(...p); else byCol.set(c, [...p]); };
    for (const F of FACES) {
      const w = archOpeningWall(F.len, F.y0, F.y1, F.holes);
      const P = (q: [number, number, number]) => [F.f.origin[0] + F.f.tangent[0] * q[0] + F.f.n[0] * q[2], q[1], F.f.origin[1] + F.f.tangent[1] * q[0] + F.f.n[1] * q[2]];
      const tris = (ts: Tri[]) => ts.flatMap(t => t.pts.flatMap(P));
      push(F.c, [...tris(w.face), ...tris(w.reveals.flat())]);
      F.holes.forEach((h, i) => { if (h.back) push(h.back, tris(w.backs[i])); });
    }
    for (const [c, p] of byCol) if (p.length) b.add(geomOf(p), c);
    FACES.length = 0;
  };
  return {OFF, sec, opening, faceFrame, archHead, blindArch, coping, along, endCap, flush, faces: FACES};
}
export type FrontKit = ReturnType<typeof makeFrontKit>;
