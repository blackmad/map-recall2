import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {geomOf} from './cut-face';
import {slab, poly, put, type Frame} from './nearbar-kit';
import type {Surface} from './worship-shell';
import {frameAt, type Chord, type Sec} from './street-front-kit';
import {glyphRuns, MIXED_CASE_GLYPHS} from './mixed-case-glyphs';
import {bandQuads, frameAtArc, ledgeQuads, type BandQuad} from '../../src/canalRecall/landmarks/pathBand';

/**
 * Shared parts of the centre-venues lane (2026-11-14: Arti et Amicitiae, Industrieele Groote Club, Splendor, De Uitkijk,
 * Escape, Bitterzoet). Each of those BAG panden holds more than the venue (Arti's pand runs through the block to the
 * Kalverstraat), so the builders keep the 3DBAG LoD2.2 shell for the parts they do not draw and lay measured fronts on
 * the street faces. What the existing kits did not have:
 *
 *  - `clipRingByLine`: a planar 3DBAG roof piece cut by a vertical plane, so the part of a roof outside a hand-drawn
 *    block survives (a skipped piece that straddles the block's back wall otherwise leaves a hole);
 *  - `profileAlong`: a moulding profile (o out of the wall, y up) extruded along a wall frame: cornices, belts, consoles;
 *  - `pedimentSolid`: a triangular pediment with raking and base cornices standing proud of its tympanum;
 *  - `modillions`: evenly spaced blocks under a cornice soffit;
 *  - `verticalLettering`: glyph runs turned 90 degrees (text reading bottom to top) on a banner or a vertical sign;
 *  - `clipRingByY`: the same cut by a horizontal plane, so a builder can keep a 3DBAG wall's gable or tower top and draw
 *    the storeys below it with cut openings (Industrieele Groote Club);
 *  - `arcLettering`: glyph runs set on an arc over an arched doorway (DE INDUSTRIEELE GROOTE CLUB over its entrance);
 *  - `cutFrontWalls`: the 3DBAG walls on a street front cut into chord ranges, each kept only above the top of the
 *    storeys the builder draws there (Splendor's six fronts of different heights on one chord).
 *  - `pathSkin`, `pathLedge` (venues round 3): a wall skin or a ledge along a plan polyline (src/canalRecall/landmarks/
 *    pathBand.ts), for fronts that run round a curve (Theater Bellevue's corner drum, Q-Factory, the Muziekgebouw);
 *  - `pathLettering` (venues round 3): glyph runs set along a plan polyline, each glyph square to the facet it sits on
 *    (De Meervaart's name across the faceted, bowed fly-tower front).
 *
 * Frames follow nearbar-kit: t along the wall to the viewer's right, y up, out of the wall along n. Every solid's back
 * face sits at `out` (sunk by nearbar-kit's SINK when the builder sets one); fronts stand >= 5 cm proud.
 */
export type XZ = [number, number];
export type Col = Parameters<BuildingTools['add']>[1];

/** Plan centroid (x, z) of a 3DBAG surface's outer ring. */
export function centroidXZ(s: Surface): XZ {
  const r = s.rings[0];
  return [r.reduce((a, p) => a + p[0], 0) / r.length, r.reduce((a, p) => a + p[2], 0) / r.length];
}
/**
 * Plan unit normal (x, z) of a 3DBAG wall surface, turned to point away from `ref` (a point inside the block it bounds),
 * so it does not depend on the ring's winding after the native frame's z flip. [0, 0] for a horizontal ring. Builders use
 * it with addShell's `wallFor` to colour a shell's walls by the way they face (a white-rendered south block, say).
 */
export function wallFacingXZ(s: Surface, ref: XZ): XZ {
  const r = s.rings[0];
  let nx = 0, nz = 0;
  for (let i = 0; i < r.length; i++) {
    const p = r[i], q = r[(i + 1) % r.length];
    nx += (p[1] - q[1]) * (p[2] + q[2]);
    nz += (p[0] - q[0]) * (p[1] + q[1]);
  }
  const len = Math.hypot(nx, nz);
  if (len < 1e-9) return [0, 0];
  nx /= len; nz /= len;
  const [cx, cz] = centroidXZ(s);
  return (cx - ref[0]) * nx + (cz - ref[1]) * nz < 0 ? [-nx, -nz] : [nx, nz];
}
/** Even-odd point in polygon (plan x, z). */
export function insidePoly(p: XZ, ring: XZ[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, zi] = ring[i], [xj, zj] = ring[j];
    if ((zi > p[1]) !== (zj > p[1]) && p[0] < (xj - xi) * (p[1] - zi) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}
/** Distance in plan from p to segment a-b, and the position along it (0..1). */
export function segDist(p: XZ, a: XZ, b: XZ): {d: number; u: number} {
  const dx = b[0] - a[0], dz = b[1] - a[1], L2 = dx * dx + dz * dz || 1e-12;
  const u = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / L2, c = Math.max(0, Math.min(1, u));
  return {d: Math.hypot(p[0] - a[0] - c * dx, p[1] - a[1] - c * dz), u};
}
/** A wall surface lying on the plan segment a-b: every vertex within `tol` of the line and between its ends. */
export function wallOnSegment(s: Surface, a: XZ, b: XZ, tol = 0.35): boolean {
  if (s.type !== 'WallSurface') return false;
  return s.rings[0].every(p => { const q = segDist([p[0], p[2]], a, b); return q.d <= tol && q.u >= -0.02 && q.u <= 1.02; });
}
/**
 * Clip a 3D ring (points [x, y, z]) by the vertical plane through plan points a-b, keeping the side where the cross
 * product (b - a) x (p - a) has the sign of `keep` (+1 left of a->b in plan x/z, -1 right). Planar rings stay planar.
 */
export function clipRingByLine(ring: number[][], a: XZ, b: XZ, keep: 1 | -1): number[][] {
  const side = (p: number[]) => keep * ((b[0] - a[0]) * (p[2] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]));
  const out: number[][] = [];
  for (let i = 0; i < ring.length; i++) {
    const p = ring[i], q = ring[(i + 1) % ring.length], sp = side(p), sq = side(q);
    if (sp >= 0) out.push(p);
    if ((sp >= 0) !== (sq >= 0)) { const t = sp / (sp - sq); out.push(p.map((v, k) => v + (q[k] - v) * t)); }
  }
  return out.length >= 3 ? out : [];
}

/** Clip a 3D ring by the horizontal plane y = h, keeping the part above (keep 1) or below (keep -1). */
export function clipRingByY(ring: number[][], h: number, keep: 1 | -1): number[][] {
  const out: number[][] = [];
  for (let i = 0; i < ring.length; i++) {
    const p = ring[i], q = ring[(i + 1) % ring.length], sp = keep * (p[1] - h), sq = keep * (q[1] - h);
    if (sp >= 0) out.push(p);
    if ((sp > 0 && sq < 0) || (sp < 0 && sq > 0)) { const t = sp / (sp - sq); out.push(p.map((v, k) => v + (q[k] - v) * t)); }
  }
  // a sliver thinner than 2 cm is dropped (it would z-fight the drawn section's top)
  return out.length >= 3 && Math.max(...out.map(p => keep * (p[1] - h))) > 0.02 ? out : [];
}

/** Triangle sink grouped by colour, with each triangle wound to face `want` (morgan-mees-builder's Mesh). */
export class TriSink {
  tris = new Map<Col, number[]>();
  tri(c: Col, a: number[], b: number[], d: number[], want: number[]) {
    const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [d[0] - a[0], d[1] - a[1], d[2] - a[2]];
    const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    if (Math.hypot(...n) < 1e-10) return;
    const arr = this.tris.get(c) ?? [];
    if (n[0] * want[0] + n[1] * want[1] + n[2] * want[2] >= 0) arr.push(...a, ...b, ...d); else arr.push(...a, ...d, ...b);
    this.tris.set(c, arr);
  }
  quad(c: Col, a: number[], b: number[], d: number[], e: number[], want: number[]) { this.tri(c, a, b, d, want); this.tri(c, a, d, e, want); }
  /** Convex or simple planar polygon fan from its first vertex. */
  fan(c: Col, pts: number[][], want: number[]) { for (let i = 1; i + 1 < pts.length; i++) this.tri(c, pts[0], pts[i], pts[i + 1], want); }
  flush(b: BuildingTools) {
    for (const [c, pos] of this.tris) if (pos.length) b.add(geomOf(pos), c);
    this.tris.clear();
  }
}

/** Profile (o out of the wall, y up) extruded along the wall from t0 to t1; closed at both ends. */
export function profileAlong(b: BuildingTools, f: Frame, t0: number, t1: number, sect: [number, number][], c: Col, out = 0) {
  b.add(profileGeometry(f, t0, t1, sect, out), c);
}
/** The geometry of `profileAlong` in model coordinates (swapping shape x and extrusion z mirrors it: windings are flipped back). */
export function profileGeometry(f: Frame, t0: number, t1: number, sect: [number, number][], out = 0): T.BufferGeometry {
  const shape = new T.Shape(sect.map(([o, y]) => new T.Vector2(o, y)));
  const g = new T.ExtrudeGeometry(shape, {depth: t1 - t0, bevelEnabled: false, curveSegments: 4});
  const src = (g.index ? g.toNonIndexed() : g).getAttribute('position'), pos: number[] = [];
  const P = (i: number) => { const o = src.getX(i) + out, y = src.getY(i), t = t0 + src.getZ(i); return [f.origin[0] + f.tangent[0] * t + f.n[0] * o, y, f.origin[1] + f.tangent[1] * t + f.n[1] * o]; };
  for (let i = 0; i < src.count; i += 3) pos.push(...P(i), ...P(i + 2), ...P(i + 1));
  return geomOf(pos);
}

/** Classical cornice profile: frieze fascia, bed moulding, corona and cymatium, `proj` metres proud at the top. */
export function corniceSection(y: number, h: number, proj: number, back = 0.3): [number, number][] {
  return [[-back, y], [proj * 0.25, y], [proj * 0.25, y + h * 0.3], [proj * 0.55, y + h * 0.42], [proj * 0.55, y + h * 0.5],
    [proj * 0.92, y + h * 0.55], [proj * 0.92, y + h * 0.82], [proj, y + h * 0.9], [proj, y + h], [-back, y + h]];
}

/** Modillion blocks under a cornice soffit, `n` evenly spaced over t0..t1 (centres), each w wide, h tall, d deep. */
export function modillionCentres(t0: number, t1: number, pitch: number): number[] {
  const n = Math.max(1, Math.floor((t1 - t0) / pitch + 1e-9));
  const step = (t1 - t0) / n, out: number[] = [];
  for (let k = 0; k <= n; k++) out.push(t0 + k * step);
  return out;
}
export function modillions(b: BuildingTools, f: Frame, t0: number, t1: number, y: number, o: {pitch: number; w: number; h: number; d: number; c: Col; out?: number}) {
  for (const t of modillionCentres(t0, t1, o.pitch)) slab(b, f, t, y, o.w, o.h, o.d, o.c, o.out ?? 0);
}

/**
 * Triangular pediment over a base of width w at y (centred at t), apex h above: a recessed tympanum plate, raking
 * cornices `rake` wide standing `d` proud, and a horizontal base cornice. Returns the tympanum's inner triangle
 * (t, y offsets about the base centre) for relief layout.
 */
export function pedimentOutline(w: number, h: number, inset = 0): [number, number][] {
  const k = h / (w / 2), x = w / 2 - inset * Math.sqrt(1 + k * k) / k, y0 = inset, apex = h - inset * Math.sqrt(1 + k * k);
  return [[-x + inset / k, y0], [x - inset / k, y0], [0, apex]];
}
export function pedimentSolid(b: BuildingTools, f: Frame, t: number, y: number, w: number, h: number, o: {d: number; rake: number; tymp: Col; trim: Col; out?: number}) {
  const out = o.out ?? 0;
  // raking cornices: outer triangle band minus the inner, as two sloping bars and the base bar; the tympanum fills the
  // inner triangle only, so none of its faces lies in a bar's plane (coplanar faces z-fight)
  const outer = pedimentOutline(w, h), inner = pedimentOutline(w, h, o.rake);
  poly(b, f, t, y, inner, o.d * 0.4, o.tymp, out);
  poly(b, f, t, y, [outer[0], outer[2], inner[2], inner[0]], o.d, o.trim, out);
  poly(b, f, t, y, [inner[2], outer[2], outer[1], inner[1]], o.d, o.trim, out);
  slab(b, f, t, y, w, o.rake, o.d, o.trim, out);
  return inner;
}

/**
 * Mixed-case glyph runs set level on a wall frame, centred on t with the baseline at y; `track` adds that many metres
 * between letters (spaced shop lettering such as E S C A P E). Returns the set width.
 */
export function lettering(b: BuildingTools, f: Frame, text: string, t: number, y: number, px: number, d: number, c: Col, out = 0, track = 0) {
  let width = 0;
  const glyphs = [...text].map(ch => glyphRuns(ch, px, MIXED_CASE_GLYPHS));
  for (const g of glyphs) width += g.width;
  width += track * Math.max(0, glyphs.length - 1) + px * Math.max(0, glyphs.length - 1);
  let u = t - width / 2;
  for (const g of glyphs) {
    for (const r of g.runs) slab(b, f, u + (r.t0 + r.t1) / 2, y + r.y0, r.t1 - r.t0, r.y1 - r.y0, d, c, out);
    u += g.width + px + track;
  }
  return width;
}

/**
 * Glyph runs set vertically on a wall frame. Default 'up': reading bottom to top from y0, the letters' tops facing -t.
 * 'down' (a banner read top-down, Zaal 100's ZAAL 100 banner): reading top to bottom from y0, the tops facing +t.
 */
export function verticalLettering(b: BuildingTools, f: Frame, text: string, t: number, y0: number, px: number, d: number, c: Col, out = 0, dir: 'up' | 'down' = 'up') {
  const {runs, width} = glyphRuns(text, px, MIXED_CASE_GLYPHS);
  // text x -> along the wall's vertical, text y (0..7px) -> across t
  if (dir === 'down') for (const r of runs) slab(b, f, t + (r.y0 + r.y1) / 2 - 3.5 * px, y0 - r.t1, r.y1 - r.y0, r.t1 - r.t0, d, c, out);
  else for (const r of runs) slab(b, f, t - (r.y0 + r.y1) / 2 + 3.5 * px, y0 + r.t0, r.y1 - r.y0, r.t1 - r.t0, d, c, out);
  return width;
}

/**
 * Concave-sided dormer gable (Perdu, Kloveniersburgwal 86): a gable rising from the cornice whose sides run up from
 * short vertical shoulders and curve inward (concave to the sky, as a neck gable's claws) to a narrow neck, closed by a
 * point. Outline in (t - axis, y - base), counter-clockwise, base on y = 0.
 */
export type ConcaveGable = {half: number; shoulder: number; neckHalf: number; neckY: number; apexY: number};
export function concaveGableOutline(g: ConcaveGable, steps = 8): [number, number][] {
  const side = (sd: -1 | 1): [number, number][] => {
    const pts: [number, number][] = [];
    for (let i = 0; i <= steps; i++) {
      const a = (i / steps) * Math.PI / 2;
      // flat at the shoulder, turning vertical against the neck
      pts.push([sd * (g.half - (g.half - g.neckHalf) * Math.sin(a)), g.shoulder + (g.neckY - g.shoulder) * (1 - Math.cos(a))]);
    }
    return pts;
  };
  return [[-g.half, 0], [g.half, 0], ...side(1), [0, g.apexY], ...side(-1).reverse()];
}
/**
 * The gable as solids on a wall frame: a body `depth` deep standing behind the wall plane (its sides run back into the
 * roof), and a stone edge `rim` wide standing `rimD` proud along the shoulders, the curves and the point.
 */
export function concaveGable(b: BuildingTools, f: Frame, t: number, y: number, g: ConcaveGable, o: {depth: number; wall: Col; trim: Col; rim: number; rimD: number}) {
  const ring = concaveGableOutline(g);
  poly(b, f, t, y, ring, o.depth, o.wall, -o.depth);
  // edge blocks just inside every outline segment but the base (the left of a counter-clockwise ring's travel)
  for (let i = 1; i < ring.length; i++) {
    const p = ring[i], q = ring[(i + 1) % ring.length];
    if (i + 1 === ring.length) break;                                   // the closing base segment
    const L = Math.hypot(q[0] - p[0], q[1] - p[1]);
    if (L < 1e-6) continue;
    const m = new T.BoxGeometry(L + o.rim * 0.5, o.rim, o.rimD + 0.04).translate(0, o.rim / 2, (o.rimD + 0.04) / 2 - 0.04).rotateZ(Math.atan2(q[1] - p[1], q[0] - p[0]));
    put(b, f, m, t + (p[0] + q[0]) / 2, y + (p[1] + q[1]) / 2, 0, o.trim);
  }
  return ring;
}

/**
 * Glyph runs set on an arc about (ct, cy) in the wall plane, radius r to the letters' baseline, the text centred at the
 * top of the arc and reading clockwise (left to right over a doorway). Each run is a box turned to the arc's tangent;
 * its back sits 2 cm inside the face at `out` so the letters stay attached on a curved course.
 */
export function arcLettering(b: BuildingTools, f: Frame, text: string, ct: number, cy: number, r: number, px: number, d: number, c: Col, out = 0) {
  const {runs, width} = glyphRuns(text, px, MIXED_CASE_GLYPHS);
  for (const run of runs) {
    const u = (run.t0 + run.t1) / 2 - width / 2, v = (run.y0 + run.y1) / 2, th = Math.PI / 2 - u / r, rr = r + v;
    const g = new T.BoxGeometry(run.t1 - run.t0, run.y1 - run.y0, d + 0.02).translate(0, 0, (d + 0.02) / 2).rotateZ(th - Math.PI / 2);
    g.translate(0, cy + rr * Math.sin(th), 0);
    put(b, f, g, ct + rr * Math.cos(th), 0, out - 0.02, c);
  }
  return width / r;   // the arc angle the text spans (radians)
}

/**
 * 3DBAG walls lying on a street front (every vertex within `tol` of the `path` polyline) cut per chord range: each
 * range [s0, s1, top] keeps the wall only above `top` (the builder draws the storeys below). Ranges are measured along
 * the chord a -> b; a wall part outside every range is dropped. Walls off the path come back unchanged.
 */
export function cutFrontWalls(surfaces: Surface[], path: XZ[], chord: {a: XZ; b: XZ}, ranges: Array<[number, number, number]>, tol = 0.7): Surface[] {
  const L = Math.hypot(chord.b[0] - chord.a[0], chord.b[1] - chord.a[1]);
  const t: XZ = [(chord.b[0] - chord.a[0]) / L, (chord.b[1] - chord.a[1]) / L], n: XZ = [-t[1], t[0]];
  const at = (s: number, o = 0): XZ => [chord.a[0] + t[0] * s + n[0] * o, chord.a[1] + t[1] * s + n[1] * o];
  const keep = (a: XZ, b: XZ, inside: XZ): 1 | -1 => ((b[0] - a[0]) * (inside[1] - a[1]) - (b[1] - a[1]) * (inside[0] - a[0]) >= 0 ? 1 : -1);
  const onPath = (s: Surface) => s.type === 'WallSurface' && s.rings[0].every(p => path.some((q, i) => i + 1 < path.length && segDist([p[0], p[2]], q, path[i + 1]).d <= tol));
  const out: Surface[] = [];
  for (const s of surfaces) {
    if (!onPath(s)) { out.push(s); continue; }
    for (const [s0, s1, top] of ranges) {
      let r = clipRingByLine(s.rings[0], at(s0), at(s0, 1), keep(at(s0), at(s0, 1), at(s0 + 1)));
      if (r.length) r = clipRingByLine(r, at(s1), at(s1, 1), keep(at(s1), at(s1, 1), at(s1 - 1)));
      if (r.length) r = clipRingByY(r, top, 1);
      if (r.length) out.push({...s, rings: [r]});
    }
  }
  return out;
}

/** Emit pathBand quads into a TriSink, each wound to face its own normal. */
export function emitQuads(M: TriSink, qs: BandQuad[], c: Col) {
  for (const q of qs) M.quad(c, q.pts[0], q.pts[1], q.pts[2], q.pts[3], q.n);
}
/** Vertical wall skin from y0 to y1 along a plan polyline, `off` metres out of it (pathBand.bandQuads). */
export function pathSkin(M: TriSink, path: XZ[], y0: number, y1: number, off: number, c: Col) {
  emitQuads(M, bandQuads(path, y0, y1, off), c);
}
/** Ledge (front, top, soffit, end caps) along a plan polyline from `back` to `front` metres out (pathBand.ledgeQuads). */
export function pathLedge(M: TriSink, path: XZ[], y: number, h: number, back: number, front: number, c: Col) {
  emitQuads(M, ledgeQuads(path, y, h, back, front), c);
}

/** Square-section strut of width w between two model points (Bimhuis's V struts under its cantilevered box). */
export function strutBetween(b: BuildingTools, p: [number, number, number], q: [number, number, number], w: number, c: Col) {
  const d = new T.Vector3(q[0] - p[0], q[1] - p[1], q[2] - p[2]), L = d.length();
  const g = new T.BoxGeometry(w, L, w).applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 1, 0), d.normalize()));
  g.translate((p[0] + q[0]) / 2, (p[1] + q[1]) / 2, (p[2] + q[2]) / 2);
  b.add(g, c);
}

/**
 * Mixed-case lettering along an open plan polyline (pathBand frames), centred on arc length `s`, baseline at y, `out`
 * metres proud of the path. Each glyph sits square to the segment under its centre, so text follows a faceted or bowed
 * front instead of floating off it as one flat run. Returns the set width.
 */
export function pathLettering(b: BuildingTools, path: XZ[], text: string, s: number, y: number, px: number, d: number, c: Col, out = 0, track = 0) {
  const glyphs = [...text].map(ch => glyphRuns(ch, px, MIXED_CASE_GLYPHS));
  let width = 0;
  for (const g of glyphs) width += g.width;
  width += (px + track) * Math.max(0, glyphs.length - 1);
  let u = s - width / 2;
  for (const g of glyphs) {
    const fr = frameAtArc(path, u + g.width / 2, out), f: Frame = {origin: fr.origin, tangent: fr.tangent, n: fr.n};
    for (const r of g.runs) slab(b, f, (r.t0 + r.t1) / 2 - g.width / 2, y + r.y0, r.t1 - r.t0, r.y1 - r.y0, d, c);
    u += g.width + px + track;
  }
  return width;
}

/**
 * Venues round 4 (lane venues-r4-20261114): the Universiteitstheater's Amstel front carries a festoon relief panel over
 * every first-floor window and a balustrade between brick dies on its cornice; nothing in the kits drew either.
 *
 * `swagOutline`: a hanging garland as a closed band polygon in (t, y) about the panel centre: a catenary-like sag from
 * the two top corners (half-width w/2 each side, `sag` metres down at the middle), `th` thick, thickest at the middle.
 */
export function swagOutline(w: number, sag: number, th: number, steps = 10): [number, number][] {
  const top: [number, number][] = [], bot: [number, number][] = [];
  for (let k = 0; k <= steps; k++) {
    const u = -w / 2 + (w * k) / steps, q = 1 - (2 * u / w) ** 2;   // 0 at the ends, 1 in the middle
    const y = -sag * q, t = th * (0.45 + 0.55 * q);
    top.push([u, y]); bot.push([u, y - t]);
  }
  return [...top, ...bot.reverse()];
}
/**
 * Festoon relief panel: a plain panel slab (w x h, `d` proud) with a swag hung from its upper corners and two ribbon
 * drops at its ends, standing `relief` metres proud of the panel's face. Bottom of the panel at y, centred at t.
 */
export function festoonPanel(b: BuildingTools, f: Frame, t: number, y: number, w: number, h: number, o: {panel: Col; swag: Col; d?: number; relief?: number; out?: number}) {
  const d = o.d ?? 0.06, rel = o.relief ?? 0.05, out = o.out ?? 0;
  slab(b, f, t, y, w, h, d, o.panel, out);
  const sw = w * 0.82, top = y + h * 0.82;
  poly(b, f, t, top, swagOutline(sw, h * 0.45, h * 0.28), rel, o.swag, out + d);
  for (const sd of [-1, 1]) slab(b, f, t + sd * sw / 2, y + h * 0.18, w * 0.05, h * 0.62, rel, o.swag, out + d);
}

/** Baluster centres between t0 and t1 at about `pitch`, starting half a pitch in (both ends clear). */
export function balusterCentres(t0: number, t1: number, pitch: number): number[] {
  const n = Math.max(1, Math.round((t1 - t0) / pitch)), step = (t1 - t0) / n;
  return Array.from({length: n}, (_, k) => t0 + step * (k + 0.5));
}
/**
 * Balustrade run on a parapet from t0 to t1: plinth course, balusters, handrail, and solid dies over the given centres
 * (`dies`, each `dieW` wide, `dieH` tall with a cap); balusters skip the dies. Back faces stand at `out`.
 */
export function balustradeRun(b: BuildingTools, f: Frame, t0: number, t1: number, y: number, o: {h: number; d: number; pitch: number; c: Col; dies?: number[]; dieW?: number; dieH?: number; die?: Col; cap?: Col; out?: number}) {
  const out = o.out ?? 0, L = t1 - t0, dieW = o.dieW ?? 0.9, dieH = o.dieH ?? o.h + 0.25;
  slab(b, f, (t0 + t1) / 2, y, L, 0.14, o.d + 0.06, o.c, out - 0.03);
  slab(b, f, (t0 + t1) / 2, y + o.h - 0.12, L, 0.12, o.d + 0.04, o.c, out - 0.02);
  const dies = [...(o.dies ?? [])].sort((p, q) => p - q);
  const spans: [number, number][] = [];
  let s = t0;
  for (const c of dies) { if (c - dieW / 2 > s) spans.push([s, c - dieW / 2]); s = Math.max(s, c + dieW / 2); }
  if (t1 > s) spans.push([s, t1]);
  for (const [a, z] of spans) if (z - a > o.pitch * 0.6) for (const c of balusterCentres(a, z, o.pitch)) slab(b, f, c, y + 0.14, o.pitch * 0.42, o.h - 0.26, o.d * 0.6, o.c, out + o.d * 0.2);
  for (const c of dies) {
    // die fronts 8 cm before the plinth course and caps 3 cm before the dies: no same-facing faces closer than 2-3 cm
    slab(b, f, c, y, dieW, dieH - 0.12, o.d + 0.16, o.die ?? o.c, out - 0.05);
    slab(b, f, c, y + dieH - 0.12, dieW + 0.1, 0.12, o.d + 0.22, o.cap ?? o.c, out - 0.08);
  }
}

/**
 * A long front as a grid of wall sections (street-front-kit `sec`), cut at `sCuts` along the chord and `yCuts` up the
 * wall, `gap` apart, each seam backed by a closed strip of the wall colour set back behind the face, so the seams read
 * as solid wall while every section keeps a short open boundary (the GLB audit fails one loop over 30 m; a 26 x 15 m
 * rendered front is one 80 m loop drawn whole). Cut between window columns and rows: an opening must sit inside one
 * section. `at(s, y)` returns the section holding a point. Vertical backings stop short of the horizontal ones so no
 * two backings share a plane.
 */
export function tiledFront(K: {sec: (ch: Chord, s0: number, s1: number, y0: number, y1: number, c: Col, off?: number) => Sec}, b: BuildingTools, ch: Chord, s0: number, s1: number, y0: number, y1: number, c: Col, sCuts: number[], yCuts: number[], gap = 0.02) {
  const ss = [s0, ...sCuts, s1], ys = [y0, ...yCuts, y1], g = gap / 2;
  const secs: Sec[][] = [];
  for (let i = 0; i + 1 < ss.length; i++) {
    secs.push([]);
    for (let j = 0; j + 1 < ys.length; j++) secs[i].push(K.sec(ch, ss[i] + (i ? g : 0), ss[i + 1] - (i + 2 < ss.length ? g : 0), ys[j] + (j ? g : 0), ys[j + 1] - (j + 2 < ys.length ? g : 0), c, 0));
  }
  const f = frameAt(ch, 0, 0);
  for (const y of yCuts) slab(b, f, (s0 + s1) / 2, y - 0.06, s1 - s0 - 0.04, 0.12, 0.08, c, -0.13);
  for (const s of sCuts) {
    for (let j = 0; j + 1 < ys.length; j++) {
      const a = ys[j] + (j ? 0.065 : 0), z = ys[j + 1] - (j + 2 < ys.length ? 0.065 : 0);
      slab(b, f, s, a, 0.12, z - a, 0.08, c, -0.12);
    }
  }
  const at = (s: number, y: number) => {
    const i = ss.findIndex((v, k) => k + 1 < ss.length && s >= v && s <= ss[k + 1]);
    const j = ys.findIndex((v, k) => k + 1 < ys.length && y >= v && y <= ys[k + 1]);
    return secs[Math.max(0, i)][Math.max(0, j)];
  };
  return {secs: secs.flat(), at};
}

/**
 * Rounded tower cap (the Industrieele Groote Club's Dam tower, 2026-11-15; the kit had only 3DBAG pyramids and cones):
 * a drum of `sides` facets, a tall rounded dome over it (a bullet profile: radius r at the foot, vertical tangent there,
 * closing to a point `h` higher, fuller than a cone and narrower than a hemisphere) and a ball with a short spike.
 * Profile points (radius, height over the dome foot), foot to tip: r = r0 cos(u pi/2)^f. The side rises vertical from the
 * foot; f 1 closes in a point at a finite angle, f 0.5 is close to an ellipse quarter (round top), between is a rounded bullet.
 */
export function bulletDomeProfile(r: number, h: number, fullness = 0.8, steps = 10): [number, number][] {
  const pts: [number, number][] = [];
  for (let i = 0; i < steps; i++) { const u = i / steps; pts.push([r * Math.pow(Math.cos(u * Math.PI / 2), fullness), h * u]); }
  pts.push([0, h]);
  return pts;
}
export type TowerCap = {drumR: number; drumH: number; sides: number; corniceR: number; corniceH: number; domeR: number; domeH: number; fullness?: number; ballR: number; spikeH: number};
/** Builds the cap on frame f at (t, out) with its foot at y; returns the top of the spike. */
export function roundedTowerCap(b: BuildingTools, f: Frame, t: number, out: number, y: number, c: TowerCap, col: {drum: Col; trim: Col; dome: Col; ball: Col}) {
  const at = (g: T.BufferGeometry, yy: number, colour: Col) => put(b, f, g, t, yy, out, colour);
  at(new T.CylinderGeometry(c.drumR, c.drumR, c.drumH, c.sides, 1, false, Math.PI / c.sides).translate(0, c.drumH / 2, 0), y, col.drum);
  at(new T.CylinderGeometry(c.corniceR, c.corniceR, c.corniceH, c.sides, 1, false, Math.PI / c.sides).translate(0, c.corniceH / 2, 0), y + c.drumH, col.trim);
  const foot = y + c.drumH + c.corniceH;
  const prof = bulletDomeProfile(c.domeR, c.domeH, c.fullness ?? 0.8).map(([r, hh]) => new T.Vector2(r, hh));
  at(new T.LatheGeometry(prof, c.sides * 2), foot, col.dome);
  const top = foot + c.domeH;
  at(new T.SphereGeometry(c.ballR, 10, 6).translate(0, c.ballR * 0.8, 0), top, col.ball);
  at(new T.CylinderGeometry(0.03, 0.05, c.spikeH, 6).translate(0, c.spikeH / 2, 0), top + c.ballR * 1.6, col.ball);
  return top + c.ballR * 1.6 + c.spikeH;
}
