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
export function glassDome(b: BuildingTools, c: XZ, R: number, y0: number, apex: number, o: {glass?: string; rib?: string; meridians?: number; rings?: number; segments?: number; panes?: boolean} = {}) {
  const h = apex - y0, Rs = (R * R + h * h) / (2 * h), theta = Math.asin(Math.min(1, R / Rs)), segs = o.segments ?? 48;
  const cy = apex - Rs;
  if (o.panes) add(b, domePanes(c, Rs, cy, theta, o.meridians ?? 16, (o.rings ?? 3) + 1), o.glass ?? 'glass', 'roof');
  else add(b, new T.SphereGeometry(Rs, segs, 12, 0, Math.PI * 2, 0, theta).translate(c[0], cy, c[1]), o.glass ?? 'glass', 'roof');
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

/**
 * The glass of a spherical cap as one pane per rib cell, each pane a flat quad with its own UV 0..1 (2026-11-15, pools2 lane).
 *
 * Why: the game dresses a glass-slot material with a per-pane cell (look/slotCells.ts paintGlassCanvas: sky-lit top, dark
 * foot, a diagonal streak), read through the mesh's UVs. One SphereGeometry gave the whole Mirandabad dome a single sliver
 * of that cell (the cap's v range is the top 25 % of the sphere's), so it drew as one flat pale shell and the reviewers read it
 * as opaque. Per-pane UVs give every cell between the ribs the pane's gradient and streak, which is what reads as glazing on
 * the orthophoto and from the street. Panes are flat (4 corners on the sphere), rings of cells from the apex to the foot;
 * the apex cell row is triangles. Pure geometry, native frame; `meridians` x `rows` cells.
 */
export function domePanes(c: XZ, Rs: number, cy: number, theta: number, meridians: number, rows: number): T.BufferGeometry {
  const pos: number[] = [], uv: number[] = [], idx: number[] = [];
  const P = (j: number, k: number) => { const t = (theta * j) / rows, a = (k / meridians) * Math.PI * 2; return [c[0] + Math.cos(a) * Rs * Math.sin(t), cy + Rs * Math.cos(t), c[1] + Math.sin(a) * Rs * Math.sin(t)]; };
  for (let j = 0; j < rows; j++) for (let k = 0; k < meridians; k++) {
    // corners: top (ring j, nearer the apex) and bottom (ring j + 1); v runs up the pane (1 at the top edge)
    const n = pos.length / 3;
    const tl = P(j, k + 1), tr = P(j, k), bl = P(j + 1, k + 1), br = P(j + 1, k);
    pos.push(...bl, ...br, ...tr, ...tl);
    uv.push(0, 0, 1, 0, 1, 1, 0, 1);
    // outward-facing winding (counter-clockwise seen from outside)
    if (j === 0) idx.push(n, n + 1, n + 2); // apex row: tl == tr, a triangle
    else idx.push(n, n + 1, n + 2, n, n + 2, n + 3);
  }
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  // flat shading per pane: split normals by computing them on a non-indexed copy
  const flat = g.toNonIndexed(); flat.computeVertexNormals();
  return flat;
}

/** Point-in-ring for native (x, z). */
export function inRing(ring: number[][], x: number, z: number) {
  let ins = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) { const [xi, zi] = ring[i], [xj, zj] = ring[j]; if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) ins = !ins; }
  return ins;
}

export type SolarOptions = {
  /** Rows run along this plan axis (the orthophoto's stripes): 'x' = east-west rows, 'z' = north-south rows. */
  along?: 'x' | 'z';
  /** Panel depth across the row (m), row pitch (m, >= depth), tilt (deg) facing +z (south) for x rows, +x (east) for z rows. */
  depth?: number; pitch?: number; tilt?: number;
  /** Keep this far inside the field ring (m). Rows shorter than `minRun` are dropped. */
  inset?: number; minRun?: number;
  /** Turn the row axis by this many degrees (clockwise in plan, from +x toward +z) for a field on a building that is not
   *  square to the grid (Sloterparkbad's wing runs at 309 deg). */
  angleDeg?: number;
};
/**
 * Solar-panel rows over a roof field (2026-11-15, pools2 lane): pure plan layout. The field ring (native x, z) is inset, cut
 * by scanlines every `pitch` metres across the row axis, and each scanline's inside runs become one row from p0 to p1
 * (at the row's centre line). Rows are what the orthophoto shows on Sportplaza Mercator and Noorderparkbad: dark striped
 * fields that the plain green or dark roof lost.
 */
export function solarRows(field: number[][], o: SolarOptions = {}): {p0: XZ; p1: XZ}[] {
  if (o.angleDeg) {
    // rotate the field by -angle, lay the rows square, rotate them back
    const a = (o.angleDeg * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a);
    const rot = (p: number[], k: number): XZ => [p[0] * c + k * p[1] * s, p[1] * c - k * p[0] * s];
    return solarRows(field.map(p => rot(p, 1)), {...o, angleDeg: 0}).map(r => ({p0: rot(r.p0, -1), p1: rot(r.p1, -1)}));
  }
  const along = o.along ?? 'x', depth = o.depth ?? 1.0, pitch = Math.max(depth, o.pitch ?? 1.6), minRun = o.minRun ?? 1.5;
  const r = o.inset ? offsetRing(field, -Math.abs(o.inset)) : cleanRing(field);
  // work in (u along, v across)
  const uv = r.map(p => (along === 'x' ? [p[0], p[1]] : [p[1], p[0]]));
  const vs = uv.map(p => p[1]), v0 = Math.min(...vs), v1 = Math.max(...vs);
  const rows: {p0: XZ; p1: XZ}[] = [];
  for (let v = v0 + depth / 2 + 0.01; v <= v1 - depth / 2; v += pitch) {
    // the row must fit across its whole depth: intersect the runs at its two edges
    const runs = [v - depth / 2, v + depth / 2].map(vv => scan(uv, vv));
    for (const [a0, a1] of runs[0]) for (const [b0, b1] of runs[1]) {
      const u0 = Math.max(a0, b0), u1 = Math.min(a1, b1);
      if (u1 - u0 >= minRun) rows.push(along === 'x' ? {p0: [u0, v], p1: [u1, v]} : {p0: [v, u0], p1: [v, u1]});
    }
  }
  return rows;
}
/** Inside runs [u0, u1] of a polygon (u, v) on the line v = vv. */
function scan(poly: number[][], vv: number): [number, number][] {
  const xs: number[] = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], c = poly[(i + 1) % poly.length];
    if ((a[1] > vv) !== (c[1] > vv)) xs.push(a[0] + ((vv - a[1]) / (c[1] - a[1])) * (c[0] - a[0]));
  }
  xs.sort((p, q) => p - q);
  const out: [number, number][] = [];
  for (let i = 0; i + 1 < xs.length; i += 2) out.push([xs[i], xs[i + 1]]);
  return out;
}
/**
 * Draw solarRows as tilted panel rows standing on the roof: each row a closed wedge prism (its foot 5 cm into the roof at the
 * row's lowest roof height, the low edge 0.2 m up, the panel face tilted `tilt` degrees), so it is grounded and never shares a
 * plane with the roof. `roofAt(x, z)` is the roof height there (nearbar-kit roofHeightAt over the 3DBAG surfaces); a row
 * whose ends have no roof is skipped. Returns the row count.
 */
export function solarField(b: BuildingTools, field: number[][], roofAt: (x: number, z: number) => number | null, colour: string, o: SolarOptions = {}): number {
  const depth = o.depth ?? 1.0, tilt = ((o.tilt ?? 12) * Math.PI) / 180, rise = depth * Math.sin(tilt), run = depth * Math.cos(tilt);
  let n = 0;
  for (const {p0, p1} of solarRows(field, o)) {
    const ys = [p0, p1, [(p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2]].map(p => roofAt(p[0], p[1]));
    if (ys.some(y => y === null)) continue;
    const yb = Math.min(...(ys as number[])) - 0.05, yLo = Math.max(...(ys as number[])) + 0.2;
    // cross-section in (across, up), across = left of the row direction (north for an eastward row, a right-handed basis):
    // the low edge on the south/east side (-across), the high edge on the other
    const sec = new T.Shape([new T.Vector2(-run / 2, yb), new T.Vector2(run / 2, yb), new T.Vector2(run / 2, yLo + rise), new T.Vector2(-run / 2, yLo)]);
    const L = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]);
    const g = new T.ExtrudeGeometry(sec, {depth: L, bevelEnabled: false});
    // shape x = across, y = up, extrusion z = along; turn the extrusion axis onto the row
    const dir = [(p1[0] - p0[0]) / L, (p1[1] - p0[1]) / L];
    const m = new T.Matrix4().makeBasis(new T.Vector3(dir[1], 0, -dir[0]), new T.Vector3(0, 1, 0), new T.Vector3(dir[0], 0, dir[1])).setPosition(p0[0], 0, p0[1]);
    g.applyMatrix4(m);
    add(b, g, colour, 'roof');
    n++;
  }
  return n;
}
