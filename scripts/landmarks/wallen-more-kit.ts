import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {getSink, poly, put, roofHeightAt, setSink, slab, type Frame} from './nearbar-kit';
import type {Surface} from './worship-shell';
import {paneGrid} from '../../src/canalRecall/landmarks/paneGrid';
import lettering from './wallen-more-lettering.json';

/**
 * Shared parts of the De Wallen landmarks of lane lm-wallen-more-20261121 (bulldog-first, in-t-aepjen, erotic-museum,
 * red-light-secrets, condomerie, banana-bar): font-outline sign lettering on a wall frame (one colour, or one colour per
 * glyph), thin tubes along a polyline (neon), a timber window with paneGrid glazing bars, and a painted mosaic panel
 * (a field of flat coloured patches). All are authored in a nearbar-kit wall frame: t along the wall from the viewer's
 * left, y up, out from the wall. Same signText contract as the theatres lane's wallen-theatres-kit (lettering JSON differs).
 */
type Cmd = {type: string; x?: number; y?: number; x1?: number; y1?: number; x2?: number; y2?: number};
const LINES = lettering.lines as Record<string, {font: string; commands: Cmd[]}>;

function shapesOf(text: string): T.Shape[] {
  const line = LINES[text];
  if (!line) throw new Error(`no lettering outline for "${text}" (run wallen-more-lettering.ts)`);
  const p = new T.ShapePath();
  for (const c of line.commands) {
    if (c.type === 'M') p.moveTo(c.x!, -c.y!);
    else if (c.type === 'L') p.lineTo(c.x!, -c.y!);
    else if (c.type === 'Q') p.quadraticCurveTo(c.x1!, -c.y1!, c.x!, -c.y!);
    else if (c.type === 'C') p.bezierCurveTo(c.x1!, -c.y1!, c.x2!, -c.y2!, c.x!, -c.y!);
    else if (c.type === 'Z') p.currentPath?.closePath();
  }
  return p.toShapes(false);
}
/** Smallest spacing of lettering outline points (m): closer points weld on the exported 1 mm grid. */
const MIN_PT = 0.006;

/**
 * One sign line in relief: the glyph outlines extruded `d` out of the wall plane at `out`, centred on t, the glyph box's
 * bottom at y, scaled uniformly to `width` (or to `height` when that is tighter). `colours` (cycled) paints each glyph
 * outline left to right in turn instead of `colour` (the CONDOMERIE fascia). Returns the drawn [width, height].
 */
export function signText(b: BuildingTools, f: Frame, text: string, t: number, y: number, out: number, o: {width: number; height?: number; d: number; colour: string; colours?: string[]; curve?: number}): [number, number] {
  const curve = o.curve ?? 3;
  const outlines = shapesOf(text).map(s => s.extractPoints(curve));
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const p of outlines.flatMap(e => e.shape)) { x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y); }
  const s = Math.min(o.width / (x1 - x0), o.height ? o.height / (y1 - y0) : Infinity), cx = (x0 + x1) / 2;
  const clean = (pts: T.Vector2[]) => {
    const res: T.Vector2[] = [];
    for (const p of pts) {
      const q = new T.Vector2((p.x - cx) * s, (p.y - y0) * s);
      if (!res.length || q.distanceTo(res[res.length - 1]) >= MIN_PT) res.push(q);
    }
    while (res.length > 2 && res[0].distanceTo(res[res.length - 1]) < MIN_PT) res.pop();
    return res.length >= 3 ? res : null;
  };
  const shapes: {sh: T.Shape; x: number}[] = [];
  for (const e of outlines) {
    const pts = clean(e.shape);
    if (!pts) continue;
    const sh = new T.Shape(pts);
    for (const h of e.holes) { const hp = clean(h); if (hp) sh.holes.push(new T.Path(hp)); }
    shapes.push({sh, x: Math.min(...pts.map(p => p.x))});
  }
  if (o.colours?.length) {
    shapes.sort((a, c) => a.x - c.x);
    shapes.forEach((g, i) => put(b, f, new T.ExtrudeGeometry([g.sh], {depth: o.d, bevelEnabled: false, curveSegments: 1}), t, y, out, o.colours![i % o.colours!.length]));
  } else {
    put(b, f, new T.ExtrudeGeometry(shapes.map(g => g.sh), {depth: o.d, bevelEnabled: false, curveSegments: 1}), t, y, out, o.colour);
  }
  return [(x1 - x0) * s, (y1 - y0) * s];
}

/** A tube of width w (in the wall plane) and depth d along a polyline of (t, y) points; `closed` joins the last to the first. */
export function tube(b: BuildingTools, f: Frame, pts: [number, number][], w: number, d: number, colour: string, out: number, closed = false) {
  const n = closed ? pts.length : pts.length - 1;
  for (let i = 0; i < n; i++) {
    const a = pts[i], c = pts[(i + 1) % pts.length];
    const L = Math.hypot(c[0] - a[0], c[1] - a[1]);
    if (L < 1e-4) continue;
    const ux = (c[0] - a[0]) / L, uy = (c[1] - a[1]) / L, nx = -uy * w / 2, ny = ux * w / 2;
    const e = w / 2, a0: [number, number] = [a[0] - ux * e, a[1] - uy * e], c0: [number, number] = [c[0] + ux * e, c[1] + uy * e];
    poly(b, f, 0, 0, [[a0[0] + nx, a0[1] + ny], [a0[0] - nx, a0[1] - ny], [c0[0] - nx, c0[1] - ny], [c0[0] + nx, c0[1] + ny]], d, colour, out);
  }
}

/** Points of a circle (or arc a0..a1, radians, counter-clockwise from +t) of radius r about (t, y). */
export const arcPts = (t: number, y: number, r: number, a0 = 0, a1 = 2 * Math.PI, seg = 16): [number, number][] => {
  const res: [number, number][] = [];
  const full = Math.abs(a1 - a0 - 2 * Math.PI) < 1e-6;
  const n = full ? seg : seg + 1;
  for (let i = 0; i < n; i++) { const a = a0 + (a1 - a0) * i / seg; res.push([t + r * Math.cos(a), y + r * Math.sin(a)]); }
  return res;
};

/**
 * A timber window: frame border `fw` wide, a dark pane, glazing bars from paneGrid (shallower than they are wide) and a sill.
 * (t, y0) is the bottom centre; `arch` raises a round head of the frame's half width (the glazing stays rectangular below
 * the springing, the head is a solid pane with a frame band).
 */
export function timberWindow(b: BuildingTools, f: Frame, t: number, y0: number, w: number, h: number, o: {cols: number; rows: number; frame?: string; glass?: string; sill?: string | null; fw?: number; out?: number; rowWeights?: number[]; arch?: boolean; bar?: number}) {
  const fr = o.frame ?? 'frame', gl = o.glass ?? 'glass', fw = o.fw ?? 0.07, out = o.out ?? 0, bar = o.bar ?? 0.05;
  const rect = o.arch ? h - w / 2 : h;
  slab(b, f, t, y0, w, rect, 0.04, fr as never, out);
  if (o.arch) poly(b, f, t, y0 + rect, arcPts(0, 0, w / 2, 0, Math.PI, 10), 0.04, fr, out);
  // glass and bars are not sunk: a sunk pane would sit mostly behind the wall plane (the openings audit's "buried").
  // Faces step 4 cm apart (frame front out+0.04, glass front out+0.08, bars front out+0.12): closer same-facing faces z-fight
  // in the audit (coplanar under 2 cm, tight 2-3 cm inclusive).
  const s0 = getSink();
  setSink(0);
  slab(b, f, t, y0 + fw, w - 2 * fw, rect - 2 * fw, 0.02, gl as never, out + 0.06);
  if (o.arch) poly(b, f, t, y0 + rect - 0.001, arcPts(0, 0, w / 2 - fw, 0, Math.PI, 10), 0.02, gl, out + 0.06);
  for (const m of paneGrid({width: w - 2 * fw, height: rect - 2 * fw, cols: o.cols, rows: o.rows, bar, frame: 0, ...(o.rowWeights ? {rowWeights: o.rowWeights} : {})}))
    slab(b, f, t + m.x, y0 + fw + m.y, m.w, m.h, 0.04, fr as never, out + 0.08);
  setSink(s0, true);
  if (o.sill !== null) slab(b, f, t, y0 - 0.06, w + 0.12, 0.06, 0.12, (o.sill ?? fr) as never, out);
}

/** Deterministic pseudo-random in [0, 1) from integers (a mosaic that does not change between builds). */
const hash = (i: number, j: number, k = 0) => {
  let h = (i * 374761393 + j * 668265263 + k * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

/**
 * A painted mosaic: a w x h panel in `ground`, covered with flat coloured patches (cell x cell metres, `fill` of the cells
 * painted, colours cycled pseudo-randomly from `inks`), as one relief layer. The Bulldog's painted ground storey.
 * Adjacent cells of one colour merge along a row so the patch count (and triangle count) stays low.
 */
export function mosaicPanel(b: BuildingTools, f: Frame, t: number, y: number, w: number, h: number, inks: string[], o: {ground: string; cell?: number; fill?: number; d?: number; out?: number; seed?: number}) {
  const cell = o.cell ?? 0.3, fill = o.fill ?? 0.8, d = o.d ?? 0.02, out = o.out ?? 0, seed = o.seed ?? 1;
  slab(b, f, t, y, w, h, d, o.ground as never, out);
  const nx = Math.max(1, Math.round(w / cell)), ny = Math.max(1, Math.round(h / cell)), cw = w / nx, ch = h / ny;
  const s0 = getSink();
  setSink(0);
  for (let j = 0; j < ny; j++) {
    let run: {i0: number; ink: string} | null = null;
    const flush = (i1: number) => {
      if (!run) return;
      slab(b, f, t - w / 2 + (run.i0 + i1) / 2 * cw, y + j * ch + ch * 0.06, (i1 - run.i0) * cw - cw * 0.08, ch * 0.88, 0.04, run.ink as never, out + d);
      run = null;
    };
    for (let i = 0; i < nx; i++) {
      const painted = hash(i, j, seed) < fill;
      const ink = painted ? inks[Math.floor(hash(j, i, seed + 7) * inks.length)] : null;
      if (run && ink !== run.ink) flush(i);
      if (ink && !run) run = {i0: i, ink};
    }
    flush(nx);
  }
  setSink(s0, true);
}

/** Shell walls lying in the plane of frame f (within `tol` m): the 3DBAG front this builder replaces with its own gable. */
export const onFramePlane = (f: Frame, tol = 0.4) => (s: Surface) => s.type === 'WallSurface' && s.rings[0].every(p => Math.abs((p[0] - f.origin[0]) * f.n[0] + (p[2] - f.origin[1]) * f.n[1]) < tol);

/**
 * The builder's own front wall over 0..len in frame f, its top following `topAt(t)` (the gable read from the photo) but never
 * lower than the 3DBAG roof just behind the front plus `clear` (so no roof plane pokes through a gable drawn a little low),
 * as one solid 0.25 m thick behind the plane, with a coping band (`coping` colour, 14 cm, lifted 5 cm) riding its top.
 * Returns the sampled top outline [(t, y)].
 */
export function ownFront(b: BuildingTools, f: Frame, len: number, topAt: (t: number) => number, surfaces: Surface[], colour: string, o: {coping?: string | null; n?: number; clear?: number; copingW?: number} = {}) {
  const n = o.n ?? 24, clear = o.clear ?? 0.12;
  const top: [number, number][] = [];
  for (let i = 0; i <= n; i++) {
    const t = Math.min(len - 0.001, Math.max(0.001, len * i / n));
    const x = f.origin[0] + f.tangent[0] * t - f.n[0] * 0.3, z = f.origin[1] + f.tangent[1] * t - f.n[1] * 0.3;
    const roof = roofHeightAt(surfaces, x, z);
    top.push([len * i / n, Math.max(topAt(len * i / n), roof === null ? 0 : roof + clear)]);
  }
  const s0 = getSink();
  setSink(0);
  poly(b, f, 0, 0, [[0, 0], ...top, [len, 0]], 0.25, colour, -0.25);
  if (o.coping !== null) {
    const cw = o.copingW ?? 0.14;
    for (let i = 0; i < n; i++) {
      const [t0, y0] = top[i], [t1, y1] = top[i + 1];
      const L = Math.hypot(t1 - t0, y1 - y0), a = Math.atan2(y1 - y0, t1 - t0);
      if (L < 1e-3) continue;
      poly(b, f, (t0 + t1) / 2, (y0 + y1) / 2 + 0.05, ([[-L / 2 - 0.02, -cw / 2], [L / 2 + 0.02, -cw / 2], [L / 2 + 0.02, cw / 2], [-L / 2 - 0.02, cw / 2]] as [number, number][]).map(([x, y]) => [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)]) as [number, number][], 0.1, o.coping ?? colour, 0);
    }
  }
  setSink(s0, true);
  return top;
}

/** A rectangular frame outline (four bars `fw` wide, `d` deep, `out` off the wall) round the box t +- w/2, y..y+h: a surround that does not back the panel it frames. */
export function frameRing(b: BuildingTools, f: Frame, t: number, y: number, w: number, h: number, fw: number, d: number, colour: string, out = 0) {
  slab(b, f, t, y - fw, w + 2 * fw, fw, d, colour, out);
  slab(b, f, t, y + h, w + 2 * fw, fw, d, colour, out);
  for (const s of [-1, 1]) slab(b, f, t + s * (w / 2 + fw / 2), y, fw, h, d, colour, out);
}

/**
 * A wall-section polygon (points [out, y]: metres in front of the wall plane, up) extruded along the wall from t0 to t1: a
 * jetty, apron, moulding or lap board in profile (src/canalRecall/landmarks/jettyProfile.ts). Built in a frame turned to
 * face along the wall, whose local x is the wall's outward normal.
 */
export function sectionAlong(b: BuildingTools, f: Frame, t0: number, t1: number, pts: [number, number][], colour: string) {
  const side: Frame = {origin: [f.origin[0] + f.tangent[0] * t1, f.origin[1] + f.tangent[1] * t1], tangent: [-f.n[0], -f.n[1]], n: [-f.tangent[0], -f.tangent[1]]};
  const s0 = getSink();
  setSink(0);
  // the turned frame maps section x onto the wall's normal, a reflection of put()'s usual (x along the wall) mapping, so the
  // section is wound clockwise to keep every face turned outward
  poly(b, side, 0, 0, [...pts].reverse(), t1 - t0, colour, 0);
  setSink(s0, true);
}
