import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {archBand, archSlab, slab, type Frame} from './nearbar-kit';

/**
 * Small kit for hand-built churches whose plan is a set of rectangles on one axis (Oosterkerk, Mozes en Aaronkerk,
 * De Duif, Obrechtkerk, Opstandingskerk). Everything is authored in a local frame: x along the church axis, z across
 * it, y up; `local(b, deg, [x0, z0])` maps that frame onto the native east/south metres (deg counter-clockwise from
 * east, the map bearing of local +x). Roofs are built from intent (hip, gable, lean-to, pyramid, dome), never from
 * survey roof planes, and openings are frame-based solids sunk into their wall so none is coplanar with it.
 */
export type Col = Parameters<BuildingTools['add']>[1];
export type V2 = [number, number];
export type Kit = BuildingTools;

/** Tools whose `add` places geometry in the local frame. Only `add` is used by the kit and by nearbar-kit. */
export function local(b: BuildingTools, deg: number, origin: V2 = [0, 0]): Kit {
  const th = deg * Math.PI / 180;
  const add = (g: T.BufferGeometry, c: Col, x = 0, y = 0, z = 0, angle = 0) => {
    g.rotateY(angle); g.translate(x, y, z); g.rotateY(th); g.translate(origin[0], 0, origin[1]); b.add(g, c);
  };
  const no = () => { throw new Error('church-kit: only add() is available in a local frame'); };
  return {add, box: no, prism: no, gableRoof: no, hip: no, window: no, clock: no, sign: no} as Kit;
}

/**
 * Like `local`, but in plan coordinates (a, b) with b to the LEFT of the axis (counter-clockwise from +a), as the
 * plan readings in the research files are written. `local`'s own +z points to the right of the axis, so a builder
 * that copies b straight into z mirrors the building across its axis; this frame mirrors it back. Geometry is
 * reflected in z with its triangle winding restored, so normals and face orientation stay correct.
 */
export function localB(b: BuildingTools, deg: number, origin: V2 = [0, 0]): Kit {
  const inner = local(b, deg, origin);
  const add = (g: T.BufferGeometry, c: Col, x = 0, y = 0, z = 0, angle = 0) => {
    g.rotateY(angle); g.translate(x, y, z); g.scale(1, 1, -1);
    const idx = g.getIndex();
    if (idx) {
      for (let i = 0; i + 2 < idx.count; i += 3) { const v = idx.getX(i + 1); idx.setX(i + 1, idx.getX(i + 2)); idx.setX(i + 2, v); }
      idx.needsUpdate = true;
    } else {
      for (const attr of Object.values(g.attributes)) {
        const a = attr as T.BufferAttribute, n = a.itemSize;
        for (let i = 0; i + 2 < a.count; i += 3) for (let j = 0; j < n; j++) {
          const v = a.array[(i + 1) * n + j]; (a.array as Float32Array)[(i + 1) * n + j] = a.array[(i + 2) * n + j]; (a.array as Float32Array)[(i + 2) * n + j] = v;
        }
        a.needsUpdate = true;
      }
    }
    inner.add(g, c);
  };
  return {...inner, add} as Kit;
}

/** Wall frame: origin on the wall plane, outward normal n; tangent is the viewer's right facing the wall. */
export const frame = (origin: V2, n: V2): Frame => ({origin, n, tangent: [n[1], -n[0]]});
/** Frame on an axis-aligned wall plane; `at(u)` maps the local x or z coordinate along the wall to the frame's t. */
export function face(n: V2, plane: number) {
  if (n[1] === 0) return {f: frame([plane, 0], n), at: (z: number) => (n[0] < 0 ? z : -z)};
  return {f: frame([0, plane], n), at: (x: number) => (n[1] > 0 ? x : -x)};
}
/** Frames for the four faces of an axis-aligned rectangle; t measured from the face's own left end (viewer's left). */
export function rectFaces(x0: number, x1: number, z0: number, z1: number) {
  return {
    px: {f: frame([x1, z1], [1, 0]), len: z1 - z0}, // faces +x, viewer's left is +z
    nx: {f: frame([x0, z0], [-1, 0]), len: z1 - z0},
    pz: {f: frame([x0, z1], [0, 1]), len: x1 - x0}, // faces +z, viewer's left is -x
    nz: {f: frame([x1, z0], [0, -1]), len: x1 - x0},
  };
}

/** Non-indexed triangles with flat normals; each triangle is flipped if needed so its normal agrees with `hint`. */
export function tris(k: Kit, pts: number[][][], c: Col, hint?: (centre: T.Vector3, n: T.Vector3) => boolean) {
  const pos: number[] = [];
  for (const [a, b2, d] of pts) {
    const A = new T.Vector3(...a), B = new T.Vector3(...b2), D = new T.Vector3(...d);
    const n = B.clone().sub(A).cross(D.clone().sub(A));
    if (n.lengthSq() < 1e-10) continue;
    const centre = A.clone().add(B).add(D).multiplyScalar(1 / 3);
    const ok = hint ? hint(centre, n) : n.y >= 0;
    pos.push(...a, ...(ok ? b2 : d), ...(ok ? d : b2));
  }
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  k.add(g, c);
}
const quad = (a: number[], b: number[], c: number[], d: number[]) => [[a, b, c], [a, c, d]];

/** Vertical prism over a polygon in (x, z). */
export function extrude(k: Kit, ring: V2[], y0: number, y1: number, c: Col) {
  const s = new T.Shape(ring.map(([x, z]) => new T.Vector2(x, -z)));
  const g = new T.ExtrudeGeometry(s, {depth: y1 - y0, bevelEnabled: false, curveSegments: 12});
  g.rotateX(-Math.PI / 2); g.translate(0, y0, 0);
  k.add(g, c);
}
export const rect = (x0: number, x1: number, z0: number, z1: number): V2[] => [[x0, z0], [x1, z0], [x1, z1], [x0, z1]];
export function block(k: Kit, x0: number, x1: number, z0: number, z1: number, y0: number, y1: number, c: Col) {
  k.add(new T.BoxGeometry(x1 - x0, y1 - y0, z1 - z0), c, (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
}

/**
 * Hipped roof over a rectangle, eaves at y, every slope at the same pitch (rise / half the short side). The ridge runs
 * along the long side; a square gives a pyramid. `ends: false` turns the short ends into gables (a plain pitched roof).
 */
export function hipRoof(k: Kit, x0: number, x1: number, z0: number, z1: number, y: number, rise: number, c: Col, o: {ends?: boolean; gableCol?: Col} = {}) {
  const ends = o.ends ?? true, alongX = x1 - x0 >= z1 - z0, half = (alongX ? z1 - z0 : x1 - x0) / 2, yt = y + rise;
  const xm = (x0 + x1) / 2, zm = (z0 + z1) / 2;
  const up = (cn: T.Vector3, n: T.Vector3) => n.y > 0;
  if (alongX) {
    const ra = ends ? Math.min(x0 + half, xm) : x0, rb = ends ? Math.max(x1 - half, xm) : x1;
    tris(k, [...quad([x0, y, z0], [x1, y, z0], [rb, yt, zm], [ra, yt, zm]), ...quad([x1, y, z1], [x0, y, z1], [ra, yt, zm], [rb, yt, zm])], c, up);
    if (ends) tris(k, [[[x0, y, z0], [ra, yt, zm], [x0, y, z1]], [[x1, y, z1], [rb, yt, zm], [x1, y, z0]]], c, up);
    else for (const [x, sx] of [[x0, -1], [x1, 1]] as const) tris(k, [[[x, y, z0], [x, yt, zm], [x, y, z1]]], o.gableCol ?? 'brick', (_c, n) => n.x * sx > 0);
  } else {
    const ra = ends ? Math.min(z0 + half, zm) : z0, rb = ends ? Math.max(z1 - half, zm) : z1;
    tris(k, [...quad([x0, y, z1], [x0, y, z0], [xm, yt, ra], [xm, yt, rb]), ...quad([x1, y, z0], [x1, y, z1], [xm, yt, rb], [xm, yt, ra])], c, up);
    if (ends) tris(k, [[[x0, y, z0], [xm, yt, ra], [x1, y, z0]], [[x1, y, z1], [xm, yt, rb], [x0, y, z1]]], c, up);
    else for (const [z, sz] of [[z0, -1], [z1, 1]] as const) tris(k, [[[x0, y, z], [xm, yt, z], [x1, y, z]]], o.gableCol ?? 'brick', (_c, n) => n.z * sz > 0);
  }
}

/** Plain pitched roof with its ridge along `axis` (gable triangles in `gableCol`), whatever the rectangle's proportions. */
export function gable(k: Kit, x0: number, x1: number, z0: number, z1: number, y: number, rise: number, axis: 'x' | 'z', c: Col, gableCol: Col) {
  const yt = y + rise, up = (_c: T.Vector3, n: T.Vector3) => n.y > 0;
  if (axis === 'x') {
    const zm = (z0 + z1) / 2;
    tris(k, [...quad([x0, y, z0], [x1, y, z0], [x1, yt, zm], [x0, yt, zm]), ...quad([x1, y, z1], [x0, y, z1], [x0, yt, zm], [x1, yt, zm])], c, up);
    for (const [x, sx] of [[x0, -1], [x1, 1]] as const) tris(k, [[[x, y, z0], [x, yt, zm], [x, y, z1]]], gableCol, (_c, n) => n.x * sx > 0);
  } else {
    const xm = (x0 + x1) / 2;
    tris(k, [...quad([x0, y, z1], [x0, y, z0], [xm, yt, z0], [xm, yt, z1]), ...quad([x1, y, z0], [x1, y, z1], [xm, yt, z1], [xm, yt, z0])], c, up);
    for (const [z, sz] of [[z0, -1], [z1, 1]] as const) tris(k, [[[x0, y, z], [xm, yt, z], [x1, y, z]]], gableCol, (_c, n) => n.z * sz > 0);
  }
}

/** A roof of planes, each rising from one eave line at `slope` (m per m) towards the inside, clipped by the others: the
 * lower envelope of the planes over a convex polygon. Used for lean-to and corner roofs that run into higher walls. */
export function envelopeRoof(k: Kit, poly: V2[], eaves: {a: V2; b: V2; y: number; slope: number}[], c: Col, cell = 0.5) {
  // Sample the envelope on a fine triangle fan per eave region: split the polygon by which plane is lowest, using a grid.
  const xs = poly.map(p => p[0]), zs = poly.map(p => p[1]);
  const minx = Math.min(...xs), maxx = Math.max(...xs), minz = Math.min(...zs), maxz = Math.max(...zs);
  const inside = (x: number, z: number) => { let s = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [xi, zi] = poly[i], [xj, zj] = poly[j]; if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) s = !s; } return s; };
  const h = (x: number, z: number) => Math.min(...eaves.map(e => { const dx = e.b[0] - e.a[0], dz = e.b[1] - e.a[1], L = Math.hypot(dx, dz); const d = Math.abs((x - e.a[0]) * dz - (z - e.a[1]) * dx) / L; return e.y + e.slope * d; }));
  const out: number[][][] = [];
  const nx = Math.ceil((maxx - minx) / cell), nz = Math.ceil((maxz - minz) / cell);
  for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
    const xa = minx + (maxx - minx) * i / nx, xb = minx + (maxx - minx) * (i + 1) / nx, za = minz + (maxz - minz) * j / nz, zb = minz + (maxz - minz) * (j + 1) / nz;
    if (!inside((xa + xb) / 2, (za + zb) / 2)) continue;
    const P = (x: number, z: number) => [x, h(x, z), z];
    out.push(...quad(P(xa, za), P(xb, za), P(xb, zb), P(xa, zb)));
  }
  tris(k, out, c);
}

/** Planar roof facet(s) given explicitly (each a convex polygon of 3D points), normals up. */
export function facets(k: Kit, polys: number[][][], c: Col) {
  const out: number[][][] = [];
  for (const p of polys) for (let i = 1; i < p.length - 1; i++) out.push([p[0], p[i], p[i + 1]]);
  tris(k, out, c);
}

/** Octagonal prism, `w` across the flats, flats facing the local axes (or the diagonals with `diag`). */
export function octagon(k: Kit, x: number, z: number, w: number, y0: number, y1: number, c: Col, diag = false, w1 = w) {
  const r0 = w / 2 / Math.cos(Math.PI / 8), r1 = w1 / 2 / Math.cos(Math.PI / 8);
  const g = new T.CylinderGeometry(r1, r0, y1 - y0, 8, 1, false, Math.PI / 8 + (diag ? Math.PI / 8 : 0));
  k.add(g, c, x, (y0 + y1) / 2, z);
}
/** Lathe solid: profile [half-width-across-flats, y] pairs from the base up; 8 segments (an octagon, flats on the axes),
 * 4 (a square cap, flats on the axes) or more (round). */
export function lathe(k: Kit, x: number, z: number, profile: V2[], c: Col, segments = 8, diag = false) {
  const flat = segments <= 8, scale = flat ? 1 / Math.cos(Math.PI / segments) : 1;
  const g = new T.LatheGeometry(profile.map(([r, y]) => new T.Vector2(Math.max(r, 0.001) * scale, y)), segments, Math.PI / segments + (diag ? Math.PI / segments : 0) + Math.PI / 2);
  k.add(g.toNonIndexed(), c, x, 0, z);
}

/** Column shaft with a base and a simple capital, standing at (x, z). */
export function column(k: Kit, x: number, z: number, d: number, y0: number, y1: number, c: Col, cap: Col = c) {
  lathe(k, x, z, [[d * 0.62, y0], [d * 0.62, y0 + 0.3], [d * 0.5, y0 + 0.4], [d * 0.5, y1 - 0.5], [d * 0.44, y1 - 0.4]], c, 16);
  block(k, x - d * 0.68, x + d * 0.68, z - d * 0.68, z + d * 0.68, y1 - 0.4, y1, cap);
}

const S = 0.04; // every wall solid sinks this far behind its plane
/** Box on a wall: back face S behind the plane, front `d` proud. */
export const onWall = (k: Kit, f: Frame, t: number, y: number, w: number, h: number, d: number, c: Col, out = 0) => slab(k, f, t, y, w, h, d + S, c, out - S);

export type Win = {w: number; y0: number; y1: number; head?: 'round' | 'flat' | 'segment'; bars?: number; rowM?: number; surround?: Col; sill?: Col; glass?: Col; bar?: Col; blind?: boolean; fill?: Col};
/**
 * A window on a wall frame at t: glass pane (front 0.06 proud), a surround band 0.22 wide (front 0.14), glazing bars
 * (horizontal front 0.10, vertical 0.14, never coplanar) and a sill. Round heads are semicircles. `blind` draws only the surround and a brick panel (a blind arch).
 */
export function win(k: Kit, f: Frame, t: number, o: Win) {
  const h = o.y1 - o.y0, head = o.head ?? 'round', surround = o.surround ?? 'stone', glass = o.glass ?? 'glass', bar = o.bar ?? 'frame';
  if (head === 'round') {
    archBand(k, f, t, o.y0, o.w + 0.44, h + 0.22, 0.22, 0.14 + S, surround, -S);
    if (!o.blind) archSlab(k, f, t, o.y0, o.w, h, 0.06 + S, glass, -S);
  } else {
    for (const s of [-1, 1]) onWall(k, f, t + s * (o.w / 2 + 0.11), o.y0, 0.22, h, 0.14, surround);
    onWall(k, f, t, o.y1, o.w + 0.44, 0.22, 0.14, surround);
    if (!o.blind) onWall(k, f, t, o.y0, o.w, h, 0.06, glass);
  }
  if (o.blind) { onWall(k, f, t, o.y0, o.w, head === 'round' ? h - o.w / 2 : h, 0.04, o.fill ?? 'brick'); return; }
  const rect = head === 'round' ? h - o.w / 2 : h, bars = o.bars ?? 2, rowM = o.rowM ?? 0.9;
  for (let i = 1; i <= bars; i++) onWall(k, f, t - o.w / 2 + o.w * i / (bars + 1), o.y0, 0.06, rect + (head === 'round' ? o.w / 2 * Math.sqrt(1 - (2 * i / (bars + 1) - 1) ** 2) : 0) - 0.02, 0.14, bar);
  const rows = Math.max(1, Math.round(rect / rowM));
  for (let r = 1; r < rows; r++) onWall(k, f, t, o.y0 + rect * r / rows - 0.03, o.w, 0.06, 0.1, bar);
  if (head === 'round') onWall(k, f, t, o.y0 + rect - 0.03, o.w, 0.06, 0.1, bar);
  onWall(k, f, t, o.y0 - 0.16, o.w + 0.5, 0.16, 0.2, o.sill ?? 'stone');
}

/** A door leaf with a stone surround and optional semicircular fanlight above (y1 = top of the leaf). */
export function door(k: Kit, f: Frame, t: number, o: {w: number; y0?: number; y1: number; fan?: boolean; leaf?: Col; surround?: Col; pediment?: boolean}) {
  const y0 = o.y0 ?? 0, sur = o.surround ?? 'stone';
  onWall(k, f, t, y0, o.w, o.y1 - y0, 0.06, o.leaf ?? 'dark');
  for (const s of [-1, 1]) onWall(k, f, t + s * (o.w / 2 + 0.17), y0, 0.34, o.y1 - y0, 0.16, sur);
  if (o.fan) {
    archSlab(k, f, t, o.y1, o.w, o.w / 2, 0.06 + S, 'glass', -S);
    archBand(k, f, t, o.y1, o.w + 0.68, o.w / 2 + 0.34, 0.34, 0.16 + S, sur, -S);
    onWall(k, f, t, o.y1 - 0.06, o.w, 0.12, 0.11, sur);
  } else onWall(k, f, t, o.y1, o.w + 0.68, 0.3, 0.16, sur);
  if (o.pediment) onWall(k, f, t, o.y1 + (o.fan ? o.w / 2 + 0.34 : 0.3), o.w + 1.2, 0.35, 0.3, sur);
}

/** Flared buttress footing (the curved plinths at Oosterkerk's corners): `d` deep at the ground, tapering to 0 at h. */
export function flare(k: Kit, f: Frame, t: number, w: number, h: number, d: number, c: Col) {
  const s = new T.Shape();
  s.moveTo(-S, 0); s.lineTo(d, 0);
  for (let i = 1; i <= 6; i++) { const u = i / 6; s.lineTo(d * (1 - u) ** 2, h * u); }
  s.lineTo(-S, h); s.closePath();
  const g = new T.ExtrudeGeometry(s, {depth: w, bevelEnabled: false});
  // shape x -> outward, shape y -> up, extrusion -> along the tangent
  g.translate(0, 0, -w / 2);
  const m = new T.Matrix4().makeBasis(new T.Vector3(f.n[0], 0, f.n[1]), new T.Vector3(0, 1, 0), new T.Vector3(f.tangent[0], 0, f.tangent[1]));
  g.applyMatrix4(m);
  if (new T.Vector3(f.n[0], 0, f.n[1]).cross(new T.Vector3(0, 1, 0)).dot(new T.Vector3(f.tangent[0], 0, f.tangent[1])) < 0) {
    // left-handed basis mirrors the triangles: flip winding back
    const p = g.toNonIndexed(); const a = p.getAttribute('position') as T.BufferAttribute;
    for (let i = 0; i < a.count; i += 3) { const x = a.getX(i + 1), y = a.getY(i + 1), z = a.getZ(i + 1); a.setXYZ(i + 1, a.getX(i + 2), a.getY(i + 2), a.getZ(i + 2)); a.setXYZ(i + 2, x, y, z); }
    p.computeVertexNormals();
    p.translate(f.origin[0] + f.tangent[0] * t, 0, f.origin[1] + f.tangent[1] * t);
    k.add(p, c); return;
  }
  g.translate(f.origin[0] + f.tangent[0] * t, 0, f.origin[1] + f.tangent[1] * t);
  k.add(g, c);
}

/** Balustrade along a frame: plinth, balusters at `pitch`, rail, with solid dies at the ends. */
export function balustrade(k: Kit, f: Frame, t0: number, t1: number, y: number, o: {h?: number; out: number; c?: Col; pitch?: number} ) {
  const h = o.h ?? 1.1, c = o.c ?? 'stone', pitch = o.pitch ?? 0.45, L = t1 - t0, d = 0.3;
  const P = (t: number, yy: number, w: number, hh: number, dd: number, out: number) => slab(k, f, t, yy, w, hh, dd, c, out);
  P((t0 + t1) / 2, y, L, 0.18, d + 0.06, o.out - 0.03);
  P((t0 + t1) / 2, y + h - 0.16, L, 0.16, d + 0.08, o.out - 0.04);
  const n = Math.floor((L - 1.2) / pitch);
  for (let i = 0; i <= n; i++) P(t0 + 0.6 + (L - 1.2) * i / Math.max(n, 1), y + 0.18, 0.16, h - 0.34, 0.16, o.out + 0.07);
  for (const t of [t0 + 0.25, t1 - 0.25]) P(t, y + 0.18, 0.5, h - 0.34, d, o.out);
}

/** A round clock face (disc, ring of numerals as one gilt ring, two hands) on a frame. */
export function clockFace(k: Kit, f: Frame, t: number, y: number, r: number) {
  const disc = (rr: number, d: number, c: Col, out: number) => {
    const g = new T.CylinderGeometry(rr, rr, d, 20).rotateX(Math.PI / 2).translate(0, 0, d / 2);
    g.rotateY(Math.atan2(f.n[0], f.n[1]));
    g.translate(f.origin[0] + f.tangent[0] * t + f.n[0] * out, y, f.origin[1] + f.tangent[1] * t + f.n[1] * out);
    k.add(g, c);
  };
  disc(r, 0.08 + S, 'gold', -S);
  disc(r * 0.82, 0.12 + S, 'dark', -S);
  onWall(k, f, t, y - 0.04, 0.07, r * 0.65, 0.16, 'gold');
  onWall(k, f, t - r * 0.2, y - 0.04, r * 0.45, 0.07, 0.17, 'gold');
}
