/**
 * Canal-row block kit (lane belt-block-pilot-20261122): draws a row of canal-house fronts on measured front lines,
 * one block at a time, the way the hand-block and landmark builders draw (scripts/landmarks/hand-block-kit.ts,
 * modern-front-kit.ts), but for gabled and corniced canal fronts:
 *
 *  - a front is ONE holed polygon per colour band: the body rectangle up to the eaves joined with the crown outline
 *    (neck, bell, step, spout, arch), every window/door a hole (flat, segmental or round head), so gable windows,
 *    arched heads and stepped outlines need no special faces;
 *  - openings get reveals in the band's colour, a back (glass, door leaf), a frame and glazing bars, an optional sill,
 *    lintel, relieving arch or keystone;
 *  - crowns: entablature cornices (frieze with attic lights, corona, consoles, raised attic pediments) and gables with
 *    claw pieces, copings and caps; a gable stands 0.3 m thick so it reads from the side;
 *  - colours are free hex strings (one material per colour, as the landmark exporter's decal path names them).
 *
 * Coordinates: native x east, z south, y up (metres); a front frame runs along the street wall from the viewer's left
 * (t), up (y), out of the wall (o). Geometry goes to a `Sink` (one colour per call), so the builder stays exporter-free.
 */
import * as T from 'three';

export type P2 = [number, number];
export type Sink = {add(g: T.BufferGeometry, colour: string): void};
export type FF = {o: P2; t: P2; n: P2; len: number};

/** World point at t along the front, y up, `out` metres out of it. */
export const W = (F: FF, t: number, y: number, out = 0): [number, number, number] => [F.o[0] + F.t[0] * t + F.n[0] * out, y, F.o[1] + F.t[1] * t + F.n[1] * out];

function geom(pos: number[]) {
  const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.computeVertexNormals(); return g;
}
/** Quads/polygons in front-local (t, y, o), fanned (convex pieces only). */
export function quads(S: Sink, F: FF, ps: [number, number, number][][], c: string) {
  const pos: number[] = [];
  for (const p of ps) { const v = p.map(q => W(F, q[0], q[1], q[2])); for (let i = 1; i + 1 < v.length; i++) pos.push(...v[0], ...v[i], ...v[i + 1]); }
  if (pos.length) S.add(geom(pos), c);
}
/** A box in the front frame: t0..t1, y0..y1, o0..o1 (all six sides; `open` drops the back). */
export function box(S: Sink, F: FF, t0: number, t1: number, y0: number, y1: number, o0: number, o1: number, c: string, open = true) {
  const q: [number, number, number][][] = [
    [[t0, y0, o1], [t1, y0, o1], [t1, y1, o1], [t0, y1, o1]],
    [[t0, y1, o1], [t1, y1, o1], [t1, y1, o0], [t0, y1, o0]],
    [[t0, y0, o0], [t1, y0, o0], [t1, y0, o1], [t0, y0, o1]],
    [[t0, y0, o0], [t0, y0, o1], [t0, y1, o1], [t0, y1, o0]],
    [[t1, y0, o1], [t1, y0, o0], [t1, y1, o0], [t1, y1, o1]],
  ];
  if (!open) q.push([[t1, y0, o0], [t0, y0, o0], [t0, y1, o0], [t1, y1, o0]]);
  quads(S, F, q, c);
}

// ---- 2D polygons ----------------------------------------------------------------------------------------------------
const area = (p: P2[]) => p.reduce((s, a, i) => { const b = p[(i + 1) % p.length]; return s + a[0] * b[1] - b[0] * a[1]; }, 0) / 2;
export const ccw = (p: P2[]) => (area(p) < 0 ? [...p].reverse() : p);
/** Sutherland-Hodgman against one axis-aligned half-plane (k = 0 t, 1 y): keep v >= at (above) or <= at. */
export function clipHalf(p: P2[], k: 0 | 1, at: number, above: boolean): P2[] {
  const inside = (q: P2) => (above ? q[k] >= at - 1e-9 : q[k] <= at + 1e-9), out: P2[] = [];
  for (let i = 0; i < p.length; i++) {
    const a = p[i], b = p[(i + 1) % p.length], ia = inside(a), ib = inside(b);
    if (ia) out.push(a);
    if (ia !== ib) { const u = (at - a[k]) / (b[k] - a[k]); out.push([a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u]); }
  }
  // drop repeated points
  return out.filter((q, i) => { const r = out[(i + 1) % out.length]; return Math.hypot(q[0] - r[0], q[1] - r[1]) > 1e-6; });
}
export const clipBox = (p: P2[], t0: number, t1: number, y0: number, y1: number) => clipHalf(clipHalf(clipHalf(clipHalf(p, 0, t0, true), 0, t1, false), 1, y0, true), 1, y1, false);
/** Planar polygon with holes in the front plane at `out`, triangulated (earcut via THREE.ShapeUtils). */
export function flat(S: Sink, F: FF, outer: P2[], holes: P2[][], c: string, out = 0) {
  if (outer.length < 3 || Math.abs(area(outer)) < 1e-4) return;
  const o = ccw(outer), hs = holes.filter(h => h.length >= 3).map(h => (area(h) > 0 ? [...h].reverse() : h));
  const tris = T.ShapeUtils.triangulateShape(o.map(p => new T.Vector2(p[0], p[1])), hs.map(h => h.map(p => new T.Vector2(p[0], p[1]))));
  const pts = [...o, ...hs.flat()], pos: number[] = [];
  for (const [a, b, d] of tris) for (const k of [a, b, d]) pos.push(...W(F, pts[k][0], pts[k][1], out));
  S.add(geom(pos), c);
}
/** A polygon extruded from o0 to o1 (front, back and side walls). */
export function slabPoly(S: Sink, F: FF, p: P2[], o0: number, o1: number, c: string) {
  const q = ccw(p);
  flat(S, F, q, [], c, o1);
  flat(S, F, [...q].reverse(), [], c, o0);
  const sides: [number, number, number][][] = q.map((a, i) => { const b = q[(i + 1) % q.length]; return [[a[0], a[1], o0], [b[0], b[1], o0], [b[0], b[1], o1], [a[0], a[1], o1]]; });
  quads(S, F, sides, c);
}
/** A strip of width w following polyline `line` (left side of travel), `proj` out of the wall: copings, gable edges. */
export function edgeStrip(S: Sink, F: FF, line: P2[], w: number, o0: number, o1: number, c: string) {
  for (let i = 0; i + 1 < line.length; i++) {
    const a = line[i], b = line[i + 1], L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (L < 1e-4) continue;
    const nx = -(b[1] - a[1]) / L * w, ny = (b[0] - a[0]) / L * w;
    slabPoly(S, F, [[a[0] - nx / 2, a[1] - ny / 2], [b[0] - nx / 2, b[1] - ny / 2], [b[0] + nx / 2, b[1] + ny / 2], [a[0] + nx / 2, a[1] + ny / 2]], o0, o1, c);
  }
}
/** Points along an arc centred (cx, cy), radius rx/ry, angles a0..a1 (radians), n steps. */
export const arc = (cx: number, cy: number, rx: number, ry: number, a0: number, a1: number, n: number): P2[] =>
  Array.from({length: n + 1}, (_, k) => { const a = a0 + (a1 - a0) * k / n; return [cx + rx * Math.cos(a), cy + ry * Math.sin(a)] as P2; });

// ---- openings ------------------------------------------------------------------------------------------------------
export type Head = 'flat' | 'seg' | 'round';
export type Win = {
  s: number; w: number; y0: number; y1: number;
  head?: Head; /** segmental rise (m) */ rise?: number;
  cols?: number; rows?: number; /** transom bar height above y0 (fanlight over a door or a tall window) */ transom?: number;
  frame?: string; /** back colour: glass by default; a door leaf colour for doors */ back?: string; depth?: number;
  /** sill slab under the opening, in this colour */ sill?: string;
  /** a flat lintel band over the head (h metres), or a relieving arch of voussoirs (segmental heads) */ lintel?: {h: number; c: string; key?: string};
  /** frame width (default 0.07) */ fw?: number;
  /** decorative surround (architrave) proud of the wall, width m */ surround?: {w: number; c: string; d?: number; cap?: number};
};
/** The hole outline of an opening (counter-clockwise). */
export function holeOf(w: Win): P2[] {
  const l = w.s - w.w / 2, r = w.s + w.w / 2, head = w.head ?? 'flat';
  if (head === 'flat') return [[l, w.y0], [r, w.y0], [r, w.y1], [l, w.y1]];
  if (head === 'round') { const rr = w.w / 2, yc = w.y1 - rr; return [[l, w.y0], [r, w.y0], ...arc(w.s, yc, rr, rr, 0, Math.PI, 10)]; }
  const rise = w.rise ?? w.w * 0.15, yc = w.y1 - rise, R = (w.w * w.w / 4 + rise * rise) / (2 * rise), a = Math.asin(w.w / 2 / R);
  return [[l, w.y0], [r, w.y0], [r, yc], ...arc(w.s, w.y1 - R, R, R, Math.PI / 2 - a, Math.PI / 2 + a, 8).slice(1, -1), [l, yc]];
}
export const GLASS = 'glass:#2a3238';
/** Reveals, back, frame and bars of an opening already cut as a hole in a face of colour `wall`. */
export function drawOpening(S: Sink, F: FF, w: Win, wall: string) {
  const h = holeOf(w), d = w.depth ?? 0.14, fw = w.fw ?? 0.07, frame = w.frame ?? 'frame:#f1efe8', back = w.back ?? GLASS;
  // reveals: one quad per hole edge, from the wall plane back to -d
  quads(S, F, h.map((a, i) => { const b = h[(i + 1) % h.length]; return [[a[0], a[1], 0], [a[0], a[1], -d], [b[0], b[1], -d], [b[0], b[1], 0]] as [number, number, number][]; }), wall);
  flat(S, F, h, [], back, -d);
  const o0 = -d, o1 = -d + 0.05, l = w.s - w.w / 2, r = w.s + w.w / 2, yTop = (w.head ?? 'flat') === 'flat' ? w.y1 : w.y1 - (w.head === 'round' ? w.w / 2 : (w.rise ?? w.w * 0.15));
  if (fw > 0) {
    box(S, F, l, r, w.y0, w.y0 + fw * 1.4, o0, o1, frame);
    box(S, F, l, l + fw, w.y0, yTop, o0, o1, frame);
    box(S, F, r - fw, r, w.y0, yTop, o0, o1, frame);
    if ((w.head ?? 'flat') === 'flat') box(S, F, l, r, w.y1 - fw, w.y1, o0, o1, frame);
    else edgeStrip(S, F, h.slice(2).map(p => p), fw * 1.2, o0, o1, frame);
    const cols = w.cols ?? 1, rows = w.rows ?? 1, bar = 0.045, glassTop = w.transom ? w.y0 + w.transom : yTop;
    for (let k = 1; k < cols; k++) { const x = l + (r - l) * k / cols; box(S, F, x - bar / 2, x + bar / 2, w.y0, glassTop, o0, o1, frame); }
    for (let k = 1; k < rows; k++) { const y = w.y0 + (glassTop - w.y0) * k / rows; box(S, F, l, r, y - bar / 2, y + bar / 2, o0, o1, frame); }
    if (w.transom) box(S, F, l, r, w.y0 + w.transom - 0.05, w.y0 + w.transom + 0.05, o0, o1 + 0.02, frame);
  }
  if (w.sill) box(S, F, l - 0.06, r + 0.06, w.y0 - 0.08, w.y0, 0, 0.09, w.sill);
  if (w.lintel) {
    if ((w.head ?? 'flat') === 'flat') box(S, F, l - 0.08, r + 0.08, w.y1, w.y1 + w.lintel.h, 0, 0.03, w.lintel.c);
    else edgeStrip(S, F, archLine(w, w.lintel.h / 2 + 0.01), w.lintel.h, 0, 0.03, w.lintel.c);
    if (w.lintel.key) box(S, F, w.s - 0.13, w.s + 0.13, w.y1 - 0.05, w.y1 + w.lintel.h + 0.08, 0, 0.06, w.lintel.key);
  }
  if (w.surround) {
    const sw = w.surround.w, sd = w.surround.d ?? 0.06;
    box(S, F, l - sw, l, w.y0, w.y1, 0, sd, w.surround.c);
    box(S, F, r, r + sw, w.y0, w.y1, 0, sd, w.surround.c);
    box(S, F, l - sw, r + sw, w.y1, w.y1 + sw, 0, sd, w.surround.c);
    if (w.surround.cap) box(S, F, l - sw - 0.1, r + sw + 0.1, w.y1 + sw, w.y1 + sw + w.surround.cap, 0, sd + 0.08, w.surround.c);
  }
}
/** The head of a curved opening offset outward by `off` (for relieving arches). */
function archLine(w: Win, off: number): P2[] {
  const h = holeOf({...w, s: w.s, w: w.w + 2 * off, y1: w.y1 + off});
  return h.slice(2);
}

// ---- fronts ----------------------------------------------------------------------------------------------------------
export type Band = {y0: number; y1: number; c: string};
/**
 * A front: `outline` (counter-clockwise, front-local) cut into colour `bands` (each from y0 to y1; the last band runs to
 * the top), every opening a hole in the band holding its sill. Returns nothing: reveals and frames are drawn too.
 */
export function front(S: Sink, F: FF, outline: P2[], bands: Band[], wins: Win[]) {
  const sorted = [...bands].sort((a, b) => a.y0 - b.y0), top = Math.max(...outline.map(p => p[1])) + 1;
  for (let i = 0; i < sorted.length; i++) {
    const b = sorted[i], y1 = i + 1 < sorted.length ? sorted[i + 1].y0 : top;
    const piece = clipHalf(clipHalf(outline, 1, b.y0, true), 1, y1, false);
    if (piece.length < 3) continue;
    // the band holding the sill draws the reveals; every band an opening crosses is holed (clipped 1 mm inside the
    // band, so a hole never touches the piece's own edge and the triangulation stays valid)
    const mine = wins.filter(w => w.y0 >= b.y0 - 1e-6 && w.y0 < y1 - 1e-6);
    const crossing = wins.filter(w => w.y1 > b.y0 + 1e-6 && w.y0 < y1 - 1e-6);
    const holes = crossing.map(w => clipHalf(clipHalf(holeOf(w), 1, Math.max(w.y0, b.y0 + 0.001), true), 1, Math.min(w.y1, y1 - 0.001), false));
    flat(S, F, piece, holes, b.c);
    for (const w of mine) drawOpening(S, F, w, b.c);
  }
}
/** Front outline: body rectangle 0..len up to `eaves`, then the crown's outline points (left to right) on top. */
export const outlineOf = (len: number, eaves: number, crown: P2[] = []): P2[] => [[0, 0], [len, 0], [len, eaves], ...[...crown].reverse(), [0, eaves]];

/** Crown outline points (left to right, excluding the eaves corners) for gables. */
export const gables = {
  /** neck gable: neck of width wn centred at c, from eaves to top (a cap drawn separately) */
  neck: (c: number, wn: number, eaves: number, top: number): P2[] => [[c - wn / 2, eaves], [c - wn / 2, top], [c + wn / 2, top], [c + wn / 2, eaves]],
  /** bell gable: from the eaves corners (inset `i`) a convex curve in to the neck half-width at `yn`, up to top */
  bell: (len: number, i: number, wn: number, eaves: number, yn: number, top: number): P2[] => {
    const c = len / 2, left = arc(c - wn / 2, eaves, c - wn / 2 - i, yn - eaves, Math.PI, Math.PI / 2, 8);
    const right = left.map(([x, y]) => [2 * c - x, y] as P2).reverse();
    return [...left, [c - wn / 2, top], [c + wn / 2, top], ...right];
  },
  /** step gable: n steps per side from full width at the eaves to wTop at top */
  step: (len: number, n: number, wTop: number, eaves: number, top: number): P2[] => {
    const c = len / 2, run = (len / 2 - wTop / 2) / n, rise = (top - eaves) / (n + 1), left: P2[] = [];
    let x = 0, y = eaves + rise;
    left.push([x, y]);
    for (let k = 0; k < n; k++) { x += run; left.push([x, y]); y += rise; left.push([x, y]); }
    const right = left.map(([px, py]) => [2 * c - px, py] as P2).reverse();
    return [...left, ...right];
  },
  /** spout/pointed gable: base half-width hb at eaves+foot, straight to the apex */
  spout: (c: number, hb: number, eaves: number, foot: number, top: number): P2[] => [[c - hb, eaves], [c - hb, eaves + foot], [c, top], [c + hb, eaves + foot], [c + hb, eaves]],
  /** arched top: insets i at both sides rising to ys, then a segmental arc to top */
  arch: (len: number, i: number, eaves: number, ys: number, top: number): P2[] => {
    const half = len / 2 - i, rise = top - ys, R = (half * half + rise * rise) / (2 * rise), a = Math.asin(Math.min(1, half / R));
    return [[i, eaves], [i, ys], ...arc(len / 2, top - R, R, R, Math.PI / 2 + a, Math.PI / 2 - a, 12).slice(1, -1), [len - i, ys], [len - i, eaves]];
  },
};

/** Gable thickness: the part of the outline above `eaves` gets a back and sides (0.3 m), so it reads from the side. */
export function gableBody(S: Sink, F: FF, crown: P2[], eaves: number, c: string, d = 0.3) {
  if (crown.length < 2) return;
  const poly: P2[] = [[crown[0][0], eaves], ...crown, [crown[crown.length - 1][0], eaves]];
  flat(S, F, [...ccw(poly)].reverse(), [], c, -d);
  const q = crown.length ? [[crown[0][0], eaves] as P2, ...crown, [crown[crown.length - 1][0], eaves] as P2] : [];
  quads(S, F, q.slice(0, -1).map((a, i) => { const b = q[i + 1]; return [[a[0], a[1], -d], [b[0], b[1], -d], [b[0], b[1], 0], [a[0], a[1], 0]] as [number, number, number][]; }), c);
}

/** A claw piece beside a neck: a concave quarter from the outer foot (xo, y0) to the neck side (xn, y0 + h). */
export function claw(S: Sink, F: FF, xo: number, xn: number, y0: number, h: number, c: string, d = 0.12) {
  const dir = Math.sign(xn - xo), w = Math.abs(xn - xo);
  const curve = arc(xo, y0 + h, w, h, -Math.PI / 2, 0, 8).map(([x, y]) => [xo + (x - xo) * dir, y] as P2);
  // region between the curve and the neck: (xo, y0) -> curve -> (xn, y0 + h) -> (xn, y0)
  const p: P2[] = [[xo, y0], ...curve.slice(1), [xn, y0]];
  slabPoly(S, F, p, -0.05, d, c);
  // a scroll disc at the outer foot
  const r = Math.min(0.32, h * 0.3), seg = arc(xo + dir * r * 0.6, y0 + r, r, r, 0, Math.PI * 2, 12).slice(0, -1);
  slabPoly(S, F, seg, -0.05, d + 0.06, c);
}

/** Entablature cornice from y0: frieze (h f, flush-ish), corona (h c, projecting `depth`), optional consoles. */
export function cornice(S: Sink, F: FF, t0: number, t1: number, y0: number, f: number, c: number, depth: number, col: string, consoles: number[] = [], soffit?: string) {
  box(S, F, t0, t1, y0, y0 + f, 0, 0.06, col);
  box(S, F, t0 - 0.05, t1 + 0.05, y0 + f, y0 + f + c, 0, depth, col);
  if (soffit) quads(S, F, [[[t0, y0 + f - 0.001, depth], [t1, y0 + f - 0.001, depth], [t1, y0 + f - 0.001, 0.06], [t0, y0 + f - 0.001, 0.06]]], soffit);
  for (const s of consoles) box(S, F, s - 0.09, s + 0.09, y0, y0 + f, 0.06, depth * 0.85, col);
}
