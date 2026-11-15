/**
 * Pool kit for the swimming-pool landmarks (2026-11-15, pools lane): outdoor basins, decks, slides, glass domes and plain
 * pavilions, in the bespoke builders' native frame (x east, z south, y up from the site's ground; see pool-site-prepare.ts).
 *
 * Why it exists: the ground layer draws no pool basins (no `swimming_pool` anywhere in src/canalRecall), and an outdoor bath
 * is its basins. A basin is drawn as a lid of pool-blue water a little under a white coping, with the deck around it, so it
 * reads as a pool (light, saturated, hard-edged) and never as canal water, from the street and from the chase camera.
 *
 * Colours are palette names of build-manual-landmarks.ts, tinted per landmark through `materialOverrides`:
 * `blue` = pool water, `white` = coping, `concrete` = deck, `dark` = lane lines; the builder passes its own names when it needs to.
 * Pure geometry: no I/O. Heights are kept apart (deck 0.10, water 0.22, lane ropes 0.31, coping 0.32) so no two faces are coplanar; every
 * piece is a closed solid standing on the ground.
 */
import * as T from 'three';
import type {BuildingTools} from './cultural-builders';

export type XZ = [number, number];
const add = (b: BuildingTools, g: T.BufferGeometry, c: string, role?: string) => { if (role) g.userData.role = role; b.add(g, c as never); };

/** Signed area of a native ring (x, z). */
export const ringArea = (r: number[][]) => r.reduce((s, p, i) => s + p[0] * r[(i + 1) % r.length][1] - r[(i + 1) % r.length][0] * p[1], 0) / 2;
/** Ring without consecutive near-duplicates (< 5 cm) and closing duplicate. */
export function cleanRing(r: number[][]): XZ[] {
  const out: XZ[] = [];
  for (const p of r) { const q = out.at(-1); if (!q || Math.hypot(p[0] - q[0], p[1] - q[1]) > 0.05) out.push([p[0], p[1]]); }
  if (out.length > 2 && Math.hypot(out[0][0] - out.at(-1)![0], out[0][1] - out.at(-1)![1]) < 0.05) out.pop();
  return out;
}
/** Mitred outward offset of a simple ring by d metres (negative = inward). Mitre capped at 3d. */
export function offsetRing(r: number[][], d: number): XZ[] {
  const ring = cleanRing(r), n = ring.length, s = Math.sign(ringArea(ring)) || 1, out: XZ[] = [];
  for (let i = 0; i < n; i++) {
    const p = ring[(i + n - 1) % n], c = ring[i], q = ring[(i + 1) % n];
    const e1 = norm([c[0] - p[0], c[1] - p[1]]), e2 = norm([q[0] - c[0], q[1] - c[1]]);
    // outward normal of an edge for a ring of sign s: (dz, -dx) * s
    const n1: XZ = [e1[1] * s, -e1[0] * s], n2: XZ = [e2[1] * s, -e2[0] * s];
    const m = norm([n1[0] + n2[0], n1[1] + n2[1]]), cos = m[0] * n2[0] + m[1] * n2[1];
    const k = Math.min(3, 1 / Math.max(cos, 1e-3)) * d;
    out.push([c[0] + m[0] * k, c[1] + m[1] * k]);
  }
  return out;
}
const norm = (v: number[]): XZ => { const L = Math.hypot(v[0], v[1]) || 1; return [v[0] / L, v[1] / L]; };
const shapeOf = (r: XZ[]) => new T.Shape(r.map(p => new T.Vector2(p[0], p[1])));

/** Flat polygon (with optional holes) facing up at height y. */
export function lid(b: BuildingTools, ring: number[][], y: number, colour: string, holes: number[][][] = [], role?: string) {
  const s = shapeOf(cleanRing(ring));
  for (const h of holes) s.holes.push(new T.Path(cleanRing(h).map(p => new T.Vector2(p[0], p[1]))));
  const g = new T.ShapeGeometry(s);
  g.rotateX(Math.PI / 2).translate(0, y, 0);
  // rotateX(+90deg) maps the shape's +y to +z and its face normal to -y: flip the winding so the lid faces up
  const idx = g.getIndex()!; const a = idx.array as Uint16Array | Uint32Array;
  for (let k = 0; k < a.length; k += 3) [a[k + 1], a[k + 2]] = [a[k + 2], a[k + 1]];
  g.computeVertexNormals();
  add(b, g, colour, role);
}
/** Solid prism over a native ring from y0 to y1 (walls and both caps). */
export function prismRing(b: BuildingTools, ring: number[][], y0: number, y1: number, colour: string, role?: string) {
  const g = new T.ExtrudeGeometry(shapeOf(cleanRing(ring)), {depth: y1 - y0, bevelEnabled: false});
  g.rotateX(Math.PI / 2).translate(0, y1, 0);
  add(b, g, colour, role);
}
/** A band (strip of width w) along a closed ring, as a low solid from y0 to y1, centred on the ring line. */
export function ringBand(b: BuildingTools, ring: number[][], w: number, y0: number, y1: number, colour: string) {
  const outer = offsetRing(ring, w / 2), inner = offsetRing(ring, -w / 2);
  const s = shapeOf(outer); s.holes.push(new T.Path(inner.map(p => new T.Vector2(p[0], p[1]))));
  const g = new T.ExtrudeGeometry(s, {depth: y1 - y0, bevelEnabled: false, curveSegments: 1});
  g.rotateX(Math.PI / 2).translate(0, y1, 0);
  add(b, g, colour);
}

export type BasinOptions = {
  /** Deck width around the basin (m); 0 = no deck drawn here (the builder draws a shared deck). */
  deck?: number;
  water?: string; coping?: string; deckColour?: string;
  /** Lane lines along the basin's long axis: count of lanes (lines = lanes - 1 plus the two end targets are not drawn). */
  lanes?: number; laneColour?: string;
  /** Heights: deck top, water surface, coping top (m above ground). */
  yDeck?: number; yWater?: number; yCoping?: number;
};
/** An outdoor basin: water lid, white coping band on the rim, optional deck and lane lines. */
export function basin(b: BuildingTools, ring: number[][], o: BasinOptions = {}) {
  const r = cleanRing(ring);
  const yDeck = o.yDeck ?? 0.1, yWater = o.yWater ?? 0.22, yCop = o.yCoping ?? 0.32;
  // all three are closed solids standing on the ground (the audit reads open lids as holes and raised lids as hovering parts);
  // the water's foot runs into the deck so no two faces are coplanar
  if (o.deck) prismRing(b, offsetRing(r, o.deck), 0, yDeck, o.deckColour ?? 'concrete');
  prismRing(b, offsetRing(r, -0.15), 0.02, yWater, o.water ?? 'blue');
  ringBand(b, r, 0.5, 0, yCop, o.coping ?? 'white');
  if (o.lanes && o.lanes > 1) laneLines(b, r, o.lanes, yWater + 0.09, o.laneColour ?? 'dark'); // floating lane ropes
}
/** Lane lines on the floor of a (near-)rectangular basin, seen through the water: thin dark strips along the long axis. */
export function laneLines(b: BuildingTools, ring: number[][], lanes: number, y: number, colour: string) {
  const {c, u, v, hu, hv} = obb(ring);
  for (let k = 1; k < lanes; k++) {
    const off = -hv + (2 * hv * k) / lanes;
    const p0: XZ = [c[0] + u[0] * (-hu + 1.5) + v[0] * off, c[1] + u[1] * (-hu + 1.5) + v[1] * off];
    const p1: XZ = [c[0] + u[0] * (hu - 1.5) + v[0] * off, c[1] + u[1] * (hu - 1.5) + v[1] * off];
    strip(b, p0, p1, 0.25, y, colour);
  }
}
/** Flat strip of width w from p0 to p1 at height y (facing up). */
export function strip(b: BuildingTools, p0: XZ, p1: XZ, w: number, y: number, colour: string) {
  const d = norm([p1[0] - p0[0], p1[1] - p0[1]]), n: XZ = [-d[1] * w / 2, d[0] * w / 2];
  // a thin solid from 0.03 m (inside the water) to y, so it is grounded in the basin and closed
  prismRing(b, [[p0[0] + n[0], p0[1] + n[1]], [p1[0] + n[0], p1[1] + n[1]], [p1[0] - n[0], p1[1] - n[1]], [p0[0] - n[0], p0[1] - n[1]]], 0.03, y, colour);
}
/** Oriented bounding box of a ring by its longest edge: centre, long axis u, short axis v, half extents. */
export function obb(ring: number[][]) {
  const r = cleanRing(ring);
  let best = 0, u: XZ = [1, 0];
  for (let i = 0; i < r.length; i++) { const a = r[i], c = r[(i + 1) % r.length], L = Math.hypot(c[0] - a[0], c[1] - a[1]); if (L > best) { best = L; u = norm([c[0] - a[0], c[1] - a[1]]); } }
  const v: XZ = [-u[1], u[0]];
  const pu = r.map(p => p[0] * u[0] + p[1] * u[1]), pv = r.map(p => p[0] * v[0] + p[1] * v[1]);
  const cu = (Math.min(...pu) + Math.max(...pu)) / 2, cv = (Math.min(...pv) + Math.max(...pv)) / 2;
  let hu = (Math.max(...pu) - Math.min(...pu)) / 2, hv = (Math.max(...pv) - Math.min(...pv)) / 2;
  let U = u, V = v;
  if (hv > hu) { [hu, hv] = [hv, hu]; U = v; V = [-u[0], -u[1]]; }
  return {c: centreOf(u, v, cu, cv), u: U, v: V, hu, hv};
}
const centreOf = (u: XZ, v: XZ, cu: number, cv: number): XZ => [u[0] * cu + v[0] * cv, u[1] * cu + v[1] * cv];

/** Helical water-slide tube around a vertical axis at c: radius r, from y0 (bottom) to y1, `turns` turns, tube radius tr. */
export function spiralSlide(b: BuildingTools, c: XZ, r: number, y0: number, y1: number, turns: number, tr: number, colour: string, start = 0) {
  const pts: T.Vector3[] = [], n = Math.max(12, Math.round(turns * 20));
  for (let k = 0; k <= n; k++) { const u = k / n, a = start + u * turns * Math.PI * 2; pts.push(new T.Vector3(c[0] + Math.cos(a) * r, y1 - (y1 - y0) * u, c[1] + Math.sin(a) * r)); }
  add(b, new T.TubeGeometry(new T.CatmullRomCurve3(pts), n * 2, tr, 8, false), colour);
}
/** Tube or chute along a polyline of native points with heights [x, y, z]. */
export function tubePath(b: BuildingTools, pts: [number, number, number][], tr: number, colour: string, radial = 8) {
  const curve = new T.CatmullRomCurve3(pts.map(p => new T.Vector3(p[0], p[1], p[2])));
  add(b, new T.TubeGeometry(curve, Math.max(8, pts.length * 6), tr, radial, false), colour);
}
/** Vertical round post from y0 to y1. */
export function post(b: BuildingTools, c: XZ, y0: number, y1: number, r: number, colour: string) {
  add(b, new T.CylinderGeometry(r, r, y1 - y0, 6).translate(c[0], (y0 + y1) / 2, c[1]), colour);
}
/** Axis-aligned-in-plan box rotated by `angle` (radians, from +x toward +z) with its base at y0. */
export function boxAt(b: BuildingTools, c: XZ, w: number, d: number, y0: number, h: number, angle: number, colour: string, role?: string) {
  const g = new T.BoxGeometry(w, h, d).rotateY(-angle).translate(c[0], y0 + h / 2, c[1]);
  add(b, g, colour, role);
}

/**
 * Spherical-cap glass dome over a circle (centre c, base radius R) from y0 to the apex, with meridian ribs and ring ribs.
 * The glass is one cap; ribs stand 4 cm proud of it so they never share its surface.
 */
export function glassDome(b: BuildingTools, c: XZ, R: number, y0: number, apex: number, o: {glass?: string; rib?: string; meridians?: number; rings?: number; segments?: number} = {}) {
  const h = apex - y0, Rs = (R * R + h * h) / (2 * h), theta = Math.asin(Math.min(1, R / Rs)), segs = o.segments ?? 48;
  const cy = apex - Rs;
  const g = new T.SphereGeometry(Rs, segs, 12, 0, Math.PI * 2, 0, theta).translate(c[0], cy, c[1]);
  add(b, g, o.glass ?? 'glass', 'roof');
  const rib = o.rib ?? 'frame', M = o.meridians ?? 16;
  for (let k = 0; k < M; k++) {
    const a = (k / M) * Math.PI * 2, pts: T.Vector3[] = [];
    for (let j = 0; j <= 10; j++) { const t = (j / 10) * theta, rr = (Rs + 0.04) * Math.sin(t); pts.push(new T.Vector3(c[0] + Math.cos(a) * rr, cy + (Rs + 0.04) * Math.cos(t), c[1] + Math.sin(a) * rr)); }
    add(b, new T.TubeGeometry(new T.CatmullRomCurve3(pts), 10, 0.09, 4, false), rib);
  }
  for (let j = 1; j <= (o.rings ?? 3); j++) {
    const t = (theta * j) / ((o.rings ?? 3) + 1), rr = (Rs + 0.04) * Math.sin(t), y = cy + (Rs + 0.04) * Math.cos(t);
    add(b, new T.TorusGeometry(rr, 0.08, 4, segs).rotateX(Math.PI / 2).translate(c[0], y, c[1]), rib);
  }
  // base ring beam where the dome meets the roof
  add(b, new T.TorusGeometry(R + 0.05, 0.22, 4, segs).rotateX(Math.PI / 2).translate(c[0], y0 + 0.12, c[1]), rib);
}

/** Point-in-ring for native (x, z). */
export function inRing(ring: number[][], x: number, z: number) {
  let ins = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) { const [xi, zi] = ring[i], [xj, zj] = ring[j]; if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) ins = !ins; }
  return ins;
}
