import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {put, slab} from './nearbar-kit';
import type {Frame} from './nearbar-kit';

/**
 * Shapes for the Zevenlandenhuizen: each house borrows a national arch family, so the kit adds the ones
 * nearbar-kit lacks (pointed Gothic, Moorish horseshoe, Russian ogee/kokoshnik), the onion dome, the
 * octagonal oriel and a small incised-capitals font for the country names carved into each front.
 * Frame convention is nearbar-kit's: x along the wall (viewer's right), y up, z out of the wall.
 */
type Col = string;
const SINK = 0.3;

const extrude = (s: T.Shape, d: number, curveSegments = 10) => new T.ExtrudeGeometry(s, {depth: d + SINK, bevelEnabled: false, curveSegments});

/** Pointed (two-centred) arch shape: sides to the springing, then two arcs meeting at the apex. */
export function pointedShape(w: number, h: number, rise = 0.8 * w) {
  const r = w / 2, ys = h - rise, s = new T.Shape();
  // Two arcs of radius w centred on the opposite springing points.
  const R = w;
  s.moveTo(-r, 0); s.lineTo(r, 0); s.lineTo(r, ys);
  const n = 10;
  for (let i = 1; i <= n; i++) { const a = Math.PI / 3 * (i / n); s.lineTo(r - R + R * Math.cos(a), ys + R * Math.sin(a)); }
  for (let i = n - 1; i >= 0; i--) { const a = Math.PI / 3 * (i / n); s.lineTo(-(r - R + R * Math.cos(a)), ys + R * Math.sin(a)); }
  s.lineTo(-r, 0);
  return s;
}
/** Moorish horseshoe arch: vertical jambs pinch in at the springing, the arch swells past a semicircle. */
export function horseshoeShape(w: number, h: number) {
  const r0 = w / 2, R = r0 * 1.14, dy = Math.sqrt(R * R - r0 * r0), s = new T.Shape();
  const cy = h - R - 0.02 * w;
  s.moveTo(-r0, 0); s.lineTo(r0, 0); s.lineTo(r0, cy - dy);
  const a0 = -Math.atan2(dy, r0), a1 = Math.PI + Math.atan2(dy, r0);
  s.absarc(0, cy, R, a0, a1, false);
  s.lineTo(-r0, 0);
  return s;
}
/** Russian ogee ("kokoshnik") head over a rectangle: S-curved flanks rising to a pointed crest. */
export function ogeeShape(w: number, h: number, h0 = 0.45 * h) {
  const r = w / 2, s = new T.Shape();
  s.moveTo(-r, 0); s.lineTo(r, 0); s.lineTo(r, h0);
  s.bezierCurveTo(r, h0 + 0.35 * (h - h0), 0.12 * w, h0 + 0.3 * (h - h0), 0, h);
  s.bezierCurveTo(-0.12 * w, h0 + 0.3 * (h - h0), -r, h0 + 0.35 * (h - h0), -r, h0);
  s.lineTo(-r, 0);
  return s;
}
export function shapeSlab(b: BuildingTools, f: Frame, shape: T.Shape, t: number, y: number, d: number, colour: Col, out = 0) {
  put(b, f, extrude(shape, d), t, y, out - SINK, colour);
}
export const pointedSlab = (b: BuildingTools, f: Frame, t: number, y: number, w: number, h: number, d: number, c: Col, out = 0) => shapeSlab(b, f, pointedShape(w, h), t, y, d, c, out);
export const horseshoeSlab = (b: BuildingTools, f: Frame, t: number, y: number, w: number, h: number, d: number, c: Col, out = 0) => shapeSlab(b, f, horseshoeShape(w, h), t, y, d, c, out);
export const ogeeSlab = (b: BuildingTools, f: Frame, t: number, y: number, w: number, h: number, d: number, c: Col, out = 0, h0?: number) => shapeSlab(b, f, ogeeShape(w, h, h0), t, y, d, c, out);
/** Arch-shaped ring (frame around an opening). */
export function archRing(b: BuildingTools, f: Frame, kind: 'pointed' | 'horseshoe' | 'ogee' | 'round', t: number, y: number, w: number, h: number, th: number, d: number, c: Col, out = 0) {
  const shapeFor = (ww: number, hh: number) => kind === 'pointed' ? pointedShape(ww, hh) : kind === 'horseshoe' ? horseshoeShape(ww, hh) : kind === 'ogee' ? ogeeShape(ww, hh) : (() => { const r = ww / 2, s = new T.Shape(); s.moveTo(-r, 0); s.lineTo(r, 0); s.lineTo(r, hh - r); s.absarc(0, hh - r, r, 0, Math.PI, false); s.lineTo(-r, 0); return s; })();
  const outer = shapeFor(w, h), inner = shapeFor(w - 2 * th, h - th);
  const s = new T.Shape(outer.getPoints(14));
  s.holes.push(new T.Path(inner.getPoints(14)));
  put(b, f, new T.ExtrudeGeometry(s, {depth: d + SINK, bevelEnabled: false}), t, y, out - SINK, c);
}
/** Arched opening: frame ring, dark glazing in the same shape, white bars. */
export function archedWindow(b: BuildingTools, f: Frame, kind: 'pointed' | 'horseshoe' | 'ogee' | 'round', t: number, y: number, w: number, h: number, o: {frame?: Col; glass?: Col; ring?: Col; bars?: number; rows?: number; ringTh?: number; out?: number} = {}) {
  const frame = o.frame ?? 'frame', glass = o.glass ?? 'glass', out = o.out ?? 0;
  if (o.ring) archRing(b, f, kind, t, Math.max(0, y - 0.06), w + 0.5, h + 0.28, o.ringTh ?? 0.2, 0.1, o.ring, out);
  const shape = (ww: number, hh: number) => kind === 'pointed' ? pointedShape(ww, hh) : kind === 'horseshoe' ? horseshoeShape(ww, hh) : kind === 'ogee' ? ogeeShape(ww, hh) : (() => { const r = ww / 2, s = new T.Shape(); s.moveTo(-r, 0); s.lineTo(r, 0); s.lineTo(r, hh - r); s.absarc(0, hh - r, r, 0, Math.PI, false); s.lineTo(-r, 0); return s; })();
  shapeSlab(b, f, shape(w + 0.16, h + 0.08), t, Math.max(0, y - 0.04), 0.08, frame, out);
  shapeSlab(b, f, shape(w, h), t, y, 0.11, glass, out);
  const bars = o.bars ?? 1, rows = o.rows ?? 2;
  for (let k = 1; k <= bars; k++) slab(b, f, t - w / 2 + w * k / (bars + 1), y, 0.05, h * 0.7, 0.14, frame, out);
  for (let r = 1; r <= rows; r++) slab(b, f, t, y + h * 0.7 * r / (rows + 1), w, 0.05, 0.14, frame, out);
}

/** Cone-ended onion dome built with a lathe (r, y profile), standing on the frame's local (t, y, out). */
export function onion(b: BuildingTools, f: Frame, t: number, y: number, out: number, r: number, h: number, colour: Col) {
  const prof: T.Vector2[] = [];
  const pts: [number, number][] = [[0.0, 0], [0.78, 0.0], [0.98, 0.1], [1.0, 0.24], [0.92, 0.38], [0.7, 0.52], [0.42, 0.68], [0.2, 0.84], [0.07, 0.95], [0, 1]];
  for (const [rr, yy] of pts) prof.push(new T.Vector2(rr * r, yy * h));
  const g = new T.LatheGeometry(prof, 16);
  put(b, f, g, t, y, out, colour);
}
/** Upright cylinder (columns, drums, finials). */
export function cyl(b: BuildingTools, f: Frame, t: number, y: number, out: number, r: number, h: number, colour: Col, rTop = r, seg = 10) {
  put(b, f, new T.CylinderGeometry(rTop, r, h, seg).translate(0, h / 2, 0), t, y, out, colour);
}
/** Four-sided pyramid (obelisks, hip roofs): base side `s`, optional rectangular base `sx` x `sz`. */
export function pyramid(b: BuildingTools, f: Frame, t: number, y: number, out: number, sx: number, sz: number, h: number, colour: Col) {
  const g = new T.ConeGeometry(0.5 * Math.SQRT2, h, 4, 1).rotateY(Math.PI / 4);
  g.scale(sx, 1, sz); g.translate(0, h / 2, 0);
  put(b, f, g, t, y, out, colour);
}
/** Octagonal oriel turret: corbel cone, eight-sided body, cornice ring, scaled dome and finial, centred at (t, out). */
export function oriel(b: BuildingTools, f: Frame, t: number, out: number, y0: number, o: {r: number; corbel: number; body: number; wall: Col; trim: Col; glass: Col; frame: Col; dome: Col; finial: Col; domeH: number}) {
  const {r} = o;
  const prism = (rr: number, rTop: number, hh: number, y: number, c: Col) => put(b, f, new T.CylinderGeometry(rTop, rr, hh, 8).rotateY(Math.PI / 8).translate(0, hh / 2, 0), t, y, out, c);
  prism(0.12, r * 0.98, o.corbel, y0, o.trim);                                   // corbel (inverted cone)
  const yb = y0 + o.corbel;
  prism(r, r, o.body, yb, o.wall);
  prism(r * 1.1, r * 1.1, 0.14, yb, o.trim);
  prism(r * 1.1, r * 1.1, 0.14, yb + o.body - 0.14, o.trim);
  for (const a of [-1, 0, 1]) {
    // glazed facets: tall panes on the three front-facing facets (facet normal at a*45 degrees from the wall normal)
    const ang = a * Math.PI / 4, ap = r * Math.cos(Math.PI / 8) + 0.012;
    for (const [yy, hh] of [[yb + 0.28, o.body * 0.42], [yb + 0.28 + o.body * 0.46, o.body * 0.34]] as [number, number][]) {
      const g = new T.BoxGeometry(r * 0.52, hh, 0.07).translate(0, hh / 2, 0.035);
      g.rotateY(ang); g.translate(Math.sin(ang) * ap, 0, Math.cos(ang) * ap);
      put(b, f, g, t, yy, out, o.glass);
      const fr = new T.BoxGeometry(r * 0.62, hh + 0.1, 0.05).translate(0, hh / 2 - 0.02, 0.025);
      fr.rotateY(ang); fr.translate(Math.sin(ang) * (ap - 0.015), 0, Math.cos(ang) * (ap - 0.015));
      put(b, f, fr, t, yy, out, o.frame);
    }
  }
  const dome = new T.SphereGeometry(r * 1.05, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, o.domeH / (r * 1.05), 1);
  put(b, f, dome, t, yb + o.body, out, o.dome);
  cyl(b, f, t, yb + o.body + o.domeH, out, 0.04, 0.55, o.finial, 0.015, 6);
}

/** 5x7 capitals for the carved country names (DUITSCHLAND, FRANKRIJK, SPANJE, ITALIE, RUSLAND, NEDERLAND, ENGELAND). */
const GL: Record<string, string[]> = {
  A: ['01110', '10001', '10001', '11111', '10001', '10001', '10001'],
  C: ['01110', '10001', '10000', '10000', '10000', '10001', '01110'],
  D: ['11110', '10001', '10001', '10001', '10001', '10001', '11110'],
  E: ['11111', '10000', '10000', '11110', '10000', '10000', '11111'],
  F: ['11111', '10000', '10000', '11110', '10000', '10000', '10000'],
  G: ['01110', '10001', '10000', '10111', '10001', '10001', '01111'],
  H: ['10001', '10001', '10001', '11111', '10001', '10001', '10001'],
  I: ['11111', '00100', '00100', '00100', '00100', '00100', '11111'],
  J: ['00111', '00010', '00010', '00010', '00010', '10010', '01100'],
  K: ['10001', '10010', '10100', '11000', '10100', '10010', '10001'],
  L: ['10000', '10000', '10000', '10000', '10000', '10000', '11111'],
  N: ['10001', '11001', '10101', '10011', '10001', '10001', '10001'],
  P: ['11110', '10001', '10001', '11110', '10000', '10000', '10000'],
  R: ['11110', '10001', '10001', '11110', '10100', '10010', '10001'],
  S: ['01111', '10000', '10000', '01110', '00001', '00001', '11110'],
  T: ['11111', '00100', '00100', '00100', '00100', '00100', '00100'],
  U: ['10001', '10001', '10001', '10001', '10001', '10001', '01110'],
};
/** Carved lettering as merged pixel runs on a wall frame; back face at `out`. Returns the width used. */
export function carve(b: BuildingTools, f: Frame, text: string, t: number, y: number, px: number, d: number, colour: Col, out = 0) {
  const total = ([...text].length * 6 - 1) * px; let u = t - total / 2;
  for (const ch of text) {
    const rows = GL[ch];
    if (!rows) throw new Error(`carve: no glyph for ${ch}`);
    for (let j = 0; j < 7; j++) {
      const row = rows[j]; let k = 0;
      while (k < 5) {
        if (row[k] !== '1') { k++; continue; }
        let e = k; while (e < 5 && row[e] === '1') e++;
        slab(b, f, u + (k + e) / 2 * px, y + (6 - j) * px, (e - k) * px, px, d, colour, out);
        k = e;
      }
    }
    u += 6 * px;
  }
  return total;
}
