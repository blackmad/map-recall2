/**
 * Wall reliefs from image-to-3D meshes (lane sculpture-r2-20261122): a generated mesh of a relief, pediment group,
 * bust or medallion, put on a landmark wall at the measured spot and size, with the generator's invented back lump cut
 * flat at the wall plane.
 *
 * Why: the generators (TripoSR, TRELLIS.2) model a relief as a free-standing object, depth/width 0.2–1.0 where a relief
 * is 0.05–0.3, and the back side is a guessed blob. Attached to a wall that blob pokes through the facade or floats
 * in front of it. Here the mesh is
 *   1. turned from the generator frame (`front`/`up` axes) into the wall frame (along the wall to the viewer's right,
 *      up, out of the wall);
 *   2. scaled to the measured width and height (separately: a photo taken from below compresses the height);
 *   3. kept to `depth` metres from its front-most point; everything further back is pressed onto the wall plane, and
 *      triangles lying wholly on that plane (the hidden back) are dropped;
 *   4. sunk `embed` metres into the wall so no gap shows along the relief's edge.
 * Pure geometry, no three.js; the triangles are plain [a, b, c] vertex triples.
 */
import type {V3} from './kitParts.js';

export type Axis = '+x' | '-x' | '+y' | '-y' | '+z' | '-z';

export interface WallFrame {
  /** Bottom centre of the relief on the wall plane, in the landmark frame (x east, y up, z south), metres. */
  origin: V3;
  /** Outward wall normal in plan, [x, z] (unit length after normalisation). */
  normal: [number, number];
}

export interface ReliefFit {
  /** Measured width along the wall and height, metres. */
  width: number;
  height: number;
  /** Relief depth kept in front of the wall plane, metres. */
  depth: number;
  /** How far the flattened back sits behind the wall plane, metres (default 0.02). */
  embed?: number;
  /** Keep the aspect ratio of the mesh (scale both from the width) instead of fitting width and height separately. */
  uniform?: boolean;
  /**
   * Turn the mesh so its thinnest principal axis points out of the wall before fitting (at most `maxTiltDeg`, default 35).
   * A generator reconstructs a flat relief tilted the way the photo looked up at it; without this the depth cut keeps
   * one rim and drops the face (Hofkerk pelican, 2026-11-22). Leave it off for free-standing figures.
   */
  alignToPlane?: boolean;
  maxTiltDeg?: number;
  /**
   * Drop triangles facing into the wall (outward-wound mesh: face normal's out component below -0.05) before the depth cut,
   * so a relief whose field lies deeper than its rim keeps that field (the Hofkerk pelican's ring and bird) while the
   * generator's back lump still goes.
   */
  dropBackFacing?: boolean;
}

/** Eigenvector of the smallest eigenvalue of a symmetric 3x3 matrix (cyclic Jacobi). */
export function smallestAxis(m: number[][]): V3 {
  const a = m.map(r => [...r]), v = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
  for (let sweep = 0; sweep < 50; sweep++) {
    let off = 0;
    for (let p = 0; p < 2; p++) for (let q = p + 1; q < 3; q++) off += a[p][q] ** 2;
    if (off < 1e-18) break;
    for (let p = 0; p < 2; p++) for (let q = p + 1; q < 3; q++) {
      if (Math.abs(a[p][q]) < 1e-15) continue;
      const th = (a[q][q] - a[p][p]) / (2 * a[p][q]);
      const t = Math.sign(th || 1) / (Math.abs(th) + Math.sqrt(th * th + 1)), c = 1 / Math.sqrt(t * t + 1), s = t * c;
      for (let k = 0; k < 3; k++) { const akp = a[k][p], akq = a[k][q]; a[k][p] = c * akp - s * akq; a[k][q] = s * akp + c * akq; }
      for (let k = 0; k < 3; k++) { const apk = a[p][k], aqk = a[q][k]; a[p][k] = c * apk - s * aqk; a[q][k] = s * apk + c * aqk; }
      for (let k = 0; k < 3; k++) { const vkp = v[k][p], vkq = v[k][q]; v[k][p] = c * vkp - s * vkq; v[k][q] = s * vkp + c * vkq; }
    }
  }
  const i = [0, 1, 2].reduce((b, k) => a[k][k] < a[b][b] ? k : b, 0);
  return [v[0][i], v[1][i], v[2][i]];
}

/** Rotation (as a function) turning the point cloud's thinnest axis onto +z (out of the wall), capped at maxDeg; identity past the cap. */
export function planeAlignment(points: V3[], maxDeg = 35): {rotate: (p: V3) => V3; tiltDeg: number} {
  const c = [0, 1, 2].map(k => points.reduce((s, p) => s + p[k], 0) / points.length);
  const m = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  for (const p of points) for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) m[i][j] += (p[i] - c[i]) * (p[j] - c[j]);
  let e = smallestAxis(m);
  if (e[2] < 0) e = [-e[0], -e[1], -e[2]];
  const tilt = Math.acos(Math.min(1, e[2])) * 180 / Math.PI;
  if (tilt < 0.5 || tilt > maxDeg) return {rotate: p => p, tiltDeg: tilt};
  const ax = cross(e, [0, 0, 1]), l = Math.hypot(...ax), k: V3 = [ax[0] / l, ax[1] / l, ax[2] / l];
  const th = tilt * Math.PI / 180, cs = Math.cos(th), sn = Math.sin(th);
  // Rodrigues: v cos + (k x v) sin + k (k . v)(1 - cos)
  return {tiltDeg: tilt, rotate: p => { const kv = cross(k, p), kd = dot(k, p); return [0, 1, 2].map(i => p[i] * cs + kv[i] * sn + k[i] * kd * (1 - cs)) as V3; }};
}

export interface PlacedRelief {
  triangles: V3[][];
  /** Triangles dropped because they lay wholly on the flattened back. */
  droppedBack: number;
  /** Scale factors applied along the wall, up and out. */
  scale: [number, number, number];
}

const AXES: Record<Axis, V3> = {'+x': [1, 0, 0], '-x': [-1, 0, 0], '+y': [0, 1, 0], '-y': [0, -1, 0], '+z': [0, 0, 1], '-z': [0, 0, -1]};
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

/**
 * Wall-frame coordinates (right, up, out) of a generator-frame point. `front` is the generator axis that points at the
 * camera that took the photo (out of the wall), `up` its up axis; right = up x out, so the result is never mirrored.
 */
export function toWallLocal(p: V3, front: Axis, up: Axis): V3 {
  const f = AXES[front], u = AXES[up];
  if (dot(f, u) !== 0) throw new Error(`front ${front} and up ${up} must be perpendicular`);
  const r = cross(u, f);
  return [dot(p, r), dot(p, u), dot(p, f)];
}

/** Place a generated relief mesh on a wall (see the module comment). */
export function placeRelief(tris: V3[][], front: Axis, up: Axis, frame: WallFrame, fit: ReliefFit): PlacedRelief {
  let local = tris.map(t => t.map(p => toWallLocal(p, front, up)));
  if (fit.alignToPlane) {
    const {rotate} = planeAlignment(local.flat(), fit.maxTiltDeg);
    local = local.map(t => t.map(rotate));
  }
  const lo: V3 = [Infinity, Infinity, Infinity], hi: V3 = [-Infinity, -Infinity, -Infinity];
  for (const t of local) for (const p of t) for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], p[k]); hi[k] = Math.max(hi[k], p[k]); }
  if (!(hi[0] > lo[0]) || !(hi[1] > lo[1])) throw new Error('relief mesh has no extent');
  const sx = fit.width / (hi[0] - lo[0]);
  const sy = fit.uniform ? sx : fit.height / (hi[1] - lo[1]);
  const sz = sx; // depth follows the width scale: a photo's foreshortening is vertical
  const embed = fit.embed ?? 0.02;
  const nl = Math.hypot(frame.normal[0], frame.normal[1]);
  const n: [number, number] = [frame.normal[0] / nl, frame.normal[1] / nl];
  // Along the wall to the viewer's right, seen from outside (looking along -normal): up x out in the x-east/z-south frame.
  const t: [number, number] = [n[1], -n[0]];
  const cx = (lo[0] + hi[0]) / 2;
  const out: V3[][] = [];
  let droppedBack = 0;
  for (const tri of local) {
    if (fit.dropBackFacing) {
      const e1 = [tri[1][0] - tri[0][0], tri[1][1] - tri[0][1], tri[1][2] - tri[0][2]] as V3, e2 = [tri[2][0] - tri[0][0], tri[2][1] - tri[0][1], tri[2][2] - tri[0][2]] as V3;
      const fn = cross(e1, e2), fl = Math.hypot(...fn);
      if (fl > 0 && fn[2] / fl < -0.05) { droppedBack++; continue; }
    }
    let flat = 0;
    const placed = tri.map(p => {
      const x = (p[0] - cx) * sx, y = (p[1] - lo[1]) * sy;
      let d = fit.depth - (hi[2] - p[2]) * sz; // distance in front of the wall plane
      if (d <= 0) { d = 0; flat++; }
      const o = d - embed;
      return [frame.origin[0] + t[0] * x + n[0] * o, frame.origin[1] + y, frame.origin[2] + t[1] * x + n[1] * o] as V3;
    });
    if (flat === 3) { droppedBack++; continue; }
    out.push(placed);
  }
  return {triangles: out, droppedBack, scale: [sx, sy, sz]};
}

/** An oriented cut box on a wall: kit triangles whose centroid lies within it are replaced by the relief. */
export interface WallCut {
  origin: V3;
  normal: [number, number];
  /** Extents in the wall frame: along the wall (right +), up from origin.y, out of the wall (+ outward). */
  min: V3;
  max: V3;
}

/** True when the point lies inside the oriented wall cut box. */
export function inWallCut(p: V3, cut: WallCut): boolean {
  const nl = Math.hypot(cut.normal[0], cut.normal[1]);
  const n = [cut.normal[0] / nl, cut.normal[1] / nl], t = [n[1], -n[0]];
  const dx = p[0] - cut.origin[0], dz = p[2] - cut.origin[2];
  const q = [dx * t[0] + dz * t[1], p[1] - cut.origin[1], dx * n[0] + dz * n[1]];
  return q.every((v, k) => v >= cut.min[k] && v <= cut.max[k]);
}
