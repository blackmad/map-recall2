import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {wallTop} from './worship-walls';
import type {Wall} from './worship-walls';
import type {Surface} from './worship-shell';

/**
 * Facade kit for the "near-bar" landmark rework. Everything is authored against a wall frame:
 * x runs along the wall tangent (viewer's right when facing the wall from outside), y up, z out of the wall.
 * Every solid has its back face on the wall plane (out = 0) so nothing floats; flat decoration is a thin solid.
 */
export type Frame = {origin: [number, number]; tangent: [number, number]; n: [number, number]};
export const frameOf = (w: Wall): Frame => ({origin: w.origin, tangent: w.tangent, n: w.n});
type Col = string;
/** Depth every solid sinks behind its wall plane (hidden inside the building) so uneven 3DBAG walls still catch it. */
let SINK = 0;
export const setSink = (v: number) => { SINK = v; };
export const getSink = () => SINK;

export function put(b: BuildingTools, f: Frame, g: T.BufferGeometry, t: number, y: number, out: number, colour: Col) {
  g.rotateY(Math.atan2(f.n[0], f.n[1]));
  g.translate(f.origin[0] + f.tangent[0] * t + f.n[0] * out, y, f.origin[1] + f.tangent[1] * t + f.n[1] * out);
  b.add(g, colour as never);
}
/** Box with its back face at `out`, bottom at y, centred at t. */
export function slab(b: BuildingTools, f: Frame, t: number, y: number, w: number, h: number, d: number, colour: Col, out = 0) {
  put(b, f, new T.BoxGeometry(w, h, d + SINK).translate(0, h / 2, (d + SINK) / 2), t, y, out - SINK, colour);
}
/** Round-headed slab (rectangle plus half-disc), bottom at y. */
export function archSlab(b: BuildingTools, f: Frame, t: number, y: number, w: number, h: number, d: number, colour: Col, out = 0) {
  const s = new T.Shape(), r = w / 2;
  s.moveTo(-r, 0); s.lineTo(r, 0); s.lineTo(r, h - r); s.absarc(0, h - r, r, 0, Math.PI, false); s.lineTo(-r, 0);
  put(b, f, new T.ExtrudeGeometry(s, {depth: d + SINK, bevelEnabled: false, curveSegments: 8}), t, y, out - SINK, colour);
}
/** Arched band (round-headed outline of thickness `th`, open at the bottom). */
export function archBand(b: BuildingTools, f: Frame, t: number, y: number, w: number, h: number, th: number, d: number, colour: Col, out = 0) {
  const r = w / 2, ri = r - th, s = new T.Shape();
  s.moveTo(-r, 0); s.lineTo(-r, h - r); s.absarc(0, h - r, r, Math.PI, 0, true); s.lineTo(r, 0);
  s.lineTo(ri, 0); s.lineTo(ri, h - r); s.absarc(0, h - r, ri, 0, Math.PI, false); s.lineTo(-ri, 0); s.lineTo(-r, 0);
  put(b, f, new T.ExtrudeGeometry(s, {depth: d + SINK, bevelEnabled: false, curveSegments: 8}), t, y, out - SINK, colour);
}
/** Flat-topped solid polygon in (x,y), extruded outward from the wall. */
export function poly(b: BuildingTools, f: Frame, t: number, y: number, pts: [number, number][], d: number, colour: Col, out = 0) {
  const s = new T.Shape(pts.map(p => new T.Vector2(p[0], p[1])));
  put(b, f, new T.ExtrudeGeometry(s, {depth: d + SINK, bevelEnabled: false}), t, y, out - SINK, colour);
}
/** Disc facing out of the wall, centre height y. */
export function disc(b: BuildingTools, f: Frame, t: number, y: number, r: number, d: number, colour: Col, out = 0) {
  put(b, f, new T.CylinderGeometry(r, r, d, 20).rotateX(Math.PI / 2).translate(0, 0, d / 2), t, y, out, colour);
}
/** Ring (annulus) facing out of the wall, centre height y. */
export function ringSlab(b: BuildingTools, f: Frame, t: number, y: number, r0: number, r1: number, d: number, colour: Col, out = 0) {
  const s = new T.Shape(); s.absarc(0, 0, r1, 0, Math.PI * 2, false);
  const hole = new T.Path(); hole.absarc(0, 0, r0, 0, Math.PI * 2, true); s.holes.push(hole);
  put(b, f, new T.ExtrudeGeometry(s, {depth: d, bevelEnabled: false, curveSegments: 20}), t, y, out, colour);
}
/** Segmental arch band (flat-ish arc of chord W and rise `rise`) with its springing at y. */
export function segBand(b: BuildingTools, f: Frame, t: number, y: number, W: number, rise: number, th: number, d: number, colour: Col, out = 0) {
  const R = (W * W / 4 + rise * rise) / (2 * rise), n = 12, pts: [number, number][] = [];
  const yo = (x: number) => rise - R + Math.sqrt(R * R - x * x);
  for (let i = 0; i <= n; i++) { const x = -W / 2 + W * i / n; pts.push([x, yo(x)]); }
  for (let i = n; i >= 0; i--) { const x = -W / 2 + W * i / n; pts.push([x, yo(x) - th]); }
  poly(b, f, t, y, pts, d, colour, out);
}
/** Quarter-dome awning hood hanging over an opening: top edge at y+h on the wall, lip `proj` out at y. */
export function awning(b: BuildingTools, f: Frame, t: number, y: number, w: number, h: number, proj: number, colour: Col) {
  const s = new T.Shape();
  s.moveTo(0, h); s.quadraticCurveTo(proj * 0.95, h, proj, 0); s.lineTo(0, 0); s.lineTo(0, h);
  const g = new T.ExtrudeGeometry(s, {depth: w, bevelEnabled: false, curveSegments: 8});
  // shape x -> outward (z), extrusion z -> along -x; centre on t
  g.rotateY(-Math.PI / 2).translate(w / 2, 0, 0);
  put(b, f, g, t, y, 0, colour);
}
/** Wall-top lookup that falls back to the wall's max when t is outside its polygon. */
export function topAt(w: Wall, t: number) {
  const v = wallTop(w, t);
  return Number.isFinite(v) ? v : Math.max(...w.poly.map(p => p[1]));
}

/** Windows with arched heads in white frames, glazing bars and a sill, spaced evenly along a wall. */
export function archWindows(b: BuildingTools, f: Frame, ts: number[], o: {y: number; w: number; h: number; wall?: Wall; frame?: Col; glass?: Col; sill?: Col; bars?: number; rows?: number}) {
  const frame = o.frame ?? 'white', glass = o.glass ?? 'glass';
  for (const t of ts) {
    if (o.wall && (topAt(o.wall, t - o.w / 2) < o.y + o.h + 0.3 || topAt(o.wall, t + o.w / 2) < o.y + o.h + 0.3)) continue;
    archSlab(b, f, t, o.y - 0.04, o.w + 0.2, o.h + 0.12, 0.08, frame);
    archSlab(b, f, t, o.y, o.w, o.h, 0.11, glass);
    const bars = o.bars ?? 1;
    for (let k = 1; k <= bars; k++) slab(b, f, t - o.w / 2 + o.w * k / (bars + 1), o.y, 0.05, o.h - o.w / 2, 0.14, frame);
    const rows = o.rows ?? 2;
    for (let r = 1; r <= rows; r++) slab(b, f, t, o.y + (o.h - o.w / 2) * r / (rows + 1), o.w, 0.05, 0.14, frame);
    if (o.sill) slab(b, f, t, o.y - 0.14, o.w + 0.45, 0.1, 0.2, o.sill);
  }
}

/** 5x7 capitals; rows are merged into runs so the sign stays cheap. */
const GL: Record<string, string[]> = {
  P: ['11110', '10001', '10001', '11110', '10000', '10000', '10000'],
  A: ['01110', '10001', '10001', '11111', '10001', '10001', '10001'],
  N: ['10001', '11001', '10101', '10011', '10001', '10001', '10001'],
  M: ['10001', '11011', '10101', '10101', '10001', '10001', '10001'],
  H: ['10001', '10001', '10001', '11111', '10001', '10001', '10001'],
  O: ['01110', '10001', '10001', '10001', '10001', '10001', '01110'],
  T: ['11111', '00100', '00100', '00100', '00100', '00100', '00100'],
  E: ['11111', '10000', '10000', '11110', '10000', '10000', '11111'],
  L: ['10000', '10000', '10000', '10000', '10000', '10000', '11111'],
  J: ['00111', '00010', '00010', '00010', '00010', '10010', '01100'],
  K: ['10001', '10010', '10100', '11000', '10100', '10010', '10001'],
  R: ['11110', '10001', '10001', '11110', '10100', '10010', '10001'],
  D: ['11110', '10001', '10001', '10001', '10001', '10001', '11110'],
  S: ['01111', '10000', '10000', '01110', '00001', '00001', '11110'],
};
/** Letters as solid pixel runs in a wall frame; back face at `out`. Returns total width. */
export function letters(b: BuildingTools, f: Frame, text: string, t: number, y: number, out: number, px: number, d: number, colour: Col) {
  const total = ([...text].length * 6 - 1) * px; let u = t - total / 2;
  for (const ch of text) {
    const rows = GL[ch];
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

/** Highest roof y at (x,z) across planar roof surfaces (plane interpolation), or null. */
export function roofHeightAt(surfaces: Surface[], x: number, z: number): number | null {
  let best: number | null = null;
  for (const s of surfaces) {
    if (s.type !== 'RoofSurface') continue;
    const r = s.rings[0];
    let inside = false;
    for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
      const a = r[i], c = r[j];
      if ((a[2] > z) !== (c[2] > z) && x < (c[0] - a[0]) * (z - a[2]) / (c[2] - a[2]) + a[0]) inside = !inside;
    }
    if (!inside) continue;
    let nx = 0, ny = 0, nz = 0;
    for (let i = 0; i < r.length; i++) { const a = r[i], c = r[(i + 1) % r.length]; nx += (a[1] - c[1]) * (a[2] + c[2]); ny += (a[2] - c[2]) * (a[0] + c[0]); nz += (a[0] - c[0]) * (a[1] + c[1]); }
    if (Math.abs(ny) < 1e-6) continue;
    const y = r[0][1] - (nx * (x - r[0][0]) + nz * (z - r[0][2])) / ny;
    if (best === null || y > best) best = y;
  }
  return best;
}

/** The wall as seen from the open side. wallsOf() flips interior walls (clerestories, upper hall walls)
 * inward because both sides of them are inside the BAG ring; pick the side with the lower roof instead. */
export function faceOut(w: Wall, surfaces: Surface[]): Wall {
  const mx = w.origin[0] + w.tangent[0] * w.length / 2, mz = w.origin[1] + w.tangent[1] * w.length / 2;
  const a = roofHeightAt(surfaces, mx + w.n[0] * 0.5, mz + w.n[1] * 0.5), c = roofHeightAt(surfaces, mx - w.n[0] * 0.5, mz - w.n[1] * 0.5);
  if (a === null || c === null || a <= c + 0.15) return w;
  return {...w, n: [-w.n[0], -w.n[1]], tangent: [-w.tangent[0], -w.tangent[1]], origin: [w.origin[0] + w.tangent[0] * w.length, w.origin[1] + w.tangent[1] * w.length], poly: w.poly.map(p => [w.length - p[0], p[1]] as [number, number])};
}

function inRingXZ(ring: number[][], x: number, z: number) {
  let yes = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i], c = ring[j];
    if ((a[1] > z) !== (c[1] > z) && x < (c[0] - a[0]) * (z - a[1]) / (c[1] - a[1]) + a[0]) yes = !yes;
  }
  return yes;
}
/** Wall frame on ring edge i -> i+1 (native east/south metres): x = viewer's right facing the wall from outside, z outward. `off` shifts the plane outward. */
export function ringFrame(ring: number[][], i: number, off = 0, into = false): {f: Frame; len: number} {
  const a = ring[i], c = ring[(i + 1) % ring.length], len = Math.hypot(c[0] - a[0], c[1] - a[1]);
  const tx = (c[0] - a[0]) / len, tz = (c[1] - a[1]) / len;
  let n: [number, number] = [-tz, tx], tangent: [number, number] = [tx, tz], o = a;
  if (inRingXZ(ring, (a[0] + c[0]) / 2 + n[0] * 0.4, (a[1] + c[1]) / 2 + n[1] * 0.4) !== into) { n = [tz, -tx]; tangent = [-tx, -tz]; o = c; }
  return {f: {origin: [o[0] + n[0] * off, o[1] + n[1] * off], tangent, n}, len};
}
/** Median outward offset of the 3DBAG eave vertices along a ring edge: where the shell wall really is. */
export function eaveOffset(ring: number[][], roofs: {rings: number[][][]}[], i: number, u0 = 0.3, u1 = Infinity, reach = 0.8) {
  const a = ring[i], c = ring[(i + 1) % ring.length], len = Math.hypot(c[0] - a[0], c[1] - a[1]);
  const tx = (c[0] - a[0]) / len, tz = (c[1] - a[1]) / len, {f} = ringFrame(ring, i);
  const offs: number[] = [];
  for (const r of roofs) for (const p of r.rings[0]) {
    const u = (p[0] - a[0]) * tx + (p[2] - a[1]) * tz, o = ((p[0] - a[0]) * tz - (p[2] - a[1]) * tx) * -1;
    const side = (-tz) * f.n[0] + tx * f.n[1] > 0 ? 1 : -1;
    if (u > u0 && u < Math.min(u1, len - 0.3) && Math.abs(o) < reach) offs.push(o * side);
  }
  offs.sort((x, y) => x - y);
  return offs.length ? offs[Math.floor(offs.length / 2)] : 0;
}

/** Ray probe against the shell so details can snap to where the (skirted, uneven) shell wall really is. */
export function wallProbe(shell: T.BufferGeometry[]) {
  const group = new T.Group();
  for (const g of shell) group.add(new T.Mesh(g, new T.MeshBasicMaterial({side: T.DoubleSide})));
  group.updateMatrixWorld(true);
  const rc = new T.Raycaster();
  return {
    /** Outward offset of the shell wall from frame f at (t, y), or null when no wall is within 2 m. */
    offset(f: Frame, t: number, y: number): number | null {
      const reach = 2;
      const o = new T.Vector3(f.origin[0] + f.tangent[0] * t + f.n[0] * reach, y, f.origin[1] + f.tangent[1] * t + f.n[1] * reach);
      rc.set(o, new T.Vector3(-f.n[0], 0, -f.n[1])); rc.far = reach * 2;
      const hit = rc.intersectObject(group, true).find(h => h.distance > 0.001);
      return hit ? reach - hit.distance : null;
    },
    /** Frame shifted onto the wall at (t, y). */
    snap(f: Frame, t: number, y: number): Frame {
      const off = this.offset(f, t, y);
      return off === null ? f : {...f, origin: [f.origin[0] + f.n[0] * off, f.origin[1] + f.n[1] * off]};
    },
  };
}

/** Rectangular sash windows: white frame, glazing bars, pale sill and an optional flat lintel. */
export function sashWindows(b: BuildingTools, f: Frame, ts: number[], o: {y: number; w: number; h: number; cols?: number; rows?: number; sill?: Col; lintel?: Col; frame?: Col; glass?: Col; snap?: (f: Frame, t: number, y: number) => Frame | null}) {
  const frame = o.frame ?? 'white', cols = o.cols ?? 2, rows = o.rows ?? 3;
  for (const t of ts) {
    const g = o.snap ? o.snap(f, t, o.y + o.h / 2) : f;
    if (!g) continue;
    slab(b, g, t, o.y - 0.06, o.w + 0.26, o.h + 0.12, 0.07, frame);
    slab(b, g, t, o.y, o.w, o.h, 0.1, o.glass ?? 'glass');
    for (let k = 1; k < cols; k++) slab(b, g, t - o.w / 2 + o.w * k / cols, o.y, 0.045, o.h, 0.13, frame);
    for (let r = 1; r < rows; r++) slab(b, g, t, o.y + o.h * r / rows - 0.02, o.w, 0.045, 0.13, frame);
    if (o.sill) slab(b, g, t, o.y - 0.17, o.w + 0.5, 0.1, 0.2, o.sill);
    if (o.lintel) slab(b, g, t, o.y + o.h + 0.06, o.w + 0.4, 0.14, 0.14, o.lintel);
  }
}
