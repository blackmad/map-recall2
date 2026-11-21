import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {poly, put, type Frame} from './nearbar-kit';
import lettering from './wallen-theatres-lettering.json';

/**
 * Shared parts of the De Wallen theatre landmarks (casa-rosso, moulin-rouge-amsterdam; lane lm-wallen-theatres-20261121):
 * font-outline lettering on a wall frame, thin tubes along a polyline (neon lines, outlines), and a cut-out silhouette with
 * a tube outline (the Casa Rosso elephant). All are authored in a wall frame (nearbar-kit): t along the wall from the
 * viewer's left, y up, out from the wall.
 */
type Cmd = {type: string; x?: number; y?: number; x1?: number; y1?: number; x2?: number; y2?: number};
const LINES = lettering.lines as Record<string, {font: string; commands: Cmd[]}>;

function shapesOf(text: string): T.Shape[] {
  const line = LINES[text];
  if (!line) throw new Error(`no lettering outline for "${text}" (run wallen-theatres-lettering.ts)`);
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

/**
 * One sign line in relief: the glyph outlines extruded `d` out of the wall plane at `out`, centred on t, the glyph box's
 * bottom at y, scaled uniformly so the line is `width` wide (`height` then follows the font), or to `height` when given and
 * the tighter of the two. Returns the drawn [width, height].
 */
export function signText(b: BuildingTools, f: Frame, text: string, t: number, y: number, out: number, o: {width: number; height?: number; d: number; colour: string; curve?: number}): [number, number] {
  const curve = o.curve ?? 3;
  const outlines = shapesOf(text).map(s => s.extractPoints(curve));
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const p of outlines.flatMap(e => e.shape)) { x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y); }
  const s = Math.min(o.width / (x1 - x0), o.height ? o.height / (y1 - y0) : Infinity), cx = (x0 + x1) / 2;
  // In metres, points closer than MIN_PT weld into one in the exported GLB (1 mm grid) and leave degenerate triangles: drop them.
  const clean = (pts: T.Vector2[]) => {
    const out: T.Vector2[] = [];
    for (const p of pts) {
      const q = new T.Vector2((p.x - cx) * s, (p.y - y0) * s);
      if (!out.length || q.distanceTo(out[out.length - 1]) >= MIN_PT) out.push(q);
    }
    while (out.length > 2 && out[0].distanceTo(out[out.length - 1]) < MIN_PT) out.pop();
    return out.length >= 3 ? out : null;
  };
  const shapes: T.Shape[] = [];
  for (const e of outlines) {
    const pts = clean(e.shape);
    if (!pts) continue;
    const sh = new T.Shape(pts);
    for (const h of e.holes) { const hp = clean(h); if (hp) sh.holes.push(new T.Path(hp)); }
    shapes.push(sh);
  }
  put(b, f, new T.ExtrudeGeometry(shapes, {depth: o.d, bevelEnabled: false, curveSegments: 1}), t, y, out, o.colour);
  return [(x1 - x0) * s, (y1 - y0) * s];
}
/** Smallest spacing of lettering outline points (m). */
const MIN_PT = 0.006;

/** A tube of width w (in the wall plane) and depth d along a polyline of (t, y) points; `closed` joins the last to the first. */
export function tube(b: BuildingTools, f: Frame, pts: [number, number][], w: number, d: number, colour: string, out: number, closed = false) {
  const n = closed ? pts.length : pts.length - 1;
  for (let i = 0; i < n; i++) {
    const a = pts[i], c = pts[(i + 1) % pts.length];
    const L = Math.hypot(c[0] - a[0], c[1] - a[1]);
    if (L < 1e-4) continue;
    const ux = (c[0] - a[0]) / L, uy = (c[1] - a[1]) / L, nx = -uy * w / 2, ny = ux * w / 2;
    // each piece runs half a width past both ends so the joints close
    const e = w / 2, a0: [number, number] = [a[0] - ux * e, a[1] - uy * e], c0: [number, number] = [c[0] + ux * e, c[1] + uy * e];
    poly(b, f, 0, 0, [[a0[0] + nx, a0[1] + ny], [a0[0] - nx, a0[1] - ny], [c0[0] - nx, c0[1] - ny], [c0[0] + nx, c0[1] + ny]], d, colour, out);
  }
}

/** A ring tube (an eye, a neon dot) of radius r about (t, y). */
export function ringTube(b: BuildingTools, f: Frame, t: number, y: number, r: number, w: number, d: number, colour: string, out: number, seg = 8) {
  const pts: [number, number][] = [];
  for (let i = 0; i < seg; i++) pts.push([t + r * Math.cos(i * 2 * Math.PI / seg), y + r * Math.sin(i * 2 * Math.PI / seg)]);
  tube(b, f, pts, w, d, colour, out, true);
}

/** A small X (two crossed bars) of half-size s about (t, y). */
export function cross(b: BuildingTools, f: Frame, t: number, y: number, s: number, w: number, d: number, colour: string, out: number) {
  tube(b, f, [[t - s, y - s], [t + s, y + s]], w, d, colour, out);
  tube(b, f, [[t - s, y + s], [t + s, y - s]], w, d, colour, out);
}

/** Map an outline given in (t, y) about an origin by uniform scale s and offset (dt, dy). */
export const mapPts = (pts: [number, number][], o: [number, number], s: number, at: [number, number]): [number, number][] =>
  pts.map(([t, y]) => [at[0] + (t - o[0]) * s, at[1] + (y - o[1]) * s]);
