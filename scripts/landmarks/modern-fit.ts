import type {Surface} from './worship-shell';
import type {Wall} from './worship-walls';
import {faceWall, frameFromBearing} from './modern-kit';

/**
 * Like faceWall, but refines the plane against the 3DBAG wall vertices that lie near it: a least-squares line
 * d = a + b t through the vertices within [-2.5, +1.5] m of the nominal plane and the nominal span, so a slightly
 * rotated face (3DBAG blocks are rarely axis aligned) gets its true bearing and offset.
 */
export function fitFace(surfaces: Surface[], origin: [number, number], bearingDeg: number, length: number, yBase: number, yTop: number): Wall {
  const f = frameFromBearing(origin, bearingDeg);
  const pts: [number, number][] = [];
  for (const s of surfaces) {
    if (s.type !== 'WallSurface') continue;
    const r = s.rings[0];
    const ymin = Math.min(...r.map(p => p[1])), ymax = Math.max(...r.map(p => p[1]));
    if (ymax < yBase + 1 || ymin > yTop - 1) continue;
    let nx = 0, nz = 0;
    for (let i = 0; i < r.length; i++) { const a = r[i], q = r[(i + 1) % r.length]; nx += (a[1] - q[1]) * (a[2] + q[2]); nz += (a[0] - q[0]) * (a[1] + q[1]); }
    const l = Math.hypot(nx, nz);
    if (l < 1e-6 || Math.abs((nx * f.n[0] + nz * f.n[1]) / l) < 0.96) continue;
    for (const p of r) {
      const dx = p[0] - origin[0], dz = p[2] - origin[1];
      const t = dx * f.tangent[0] + dz * f.tangent[1], d = dx * f.n[0] + dz * f.n[1];
      if (t >= -1 && t <= length + 1 && d >= -2.5 && d <= 1.5) pts.push([t, d]);
    }
  }
  if (pts.length < 4) return faceWall(origin, bearingDeg, length, yBase, yTop);
  const n = pts.length, st = pts.reduce((q, p) => q + p[0], 0), sd = pts.reduce((q, p) => q + p[1], 0);
  const stt = pts.reduce((q, p) => q + p[0] * p[0], 0), std = pts.reduce((q, p) => q + p[0] * p[1], 0);
  const den = n * stt - st * st, slope = Math.abs(den) < 1e-9 ? 0 : (n * std - st * sd) / den, a = (sd - slope * st) / n;
  const newBearing = bearingDeg + Math.atan(slope) * 180 / Math.PI;
  const o2: [number, number] = [origin[0] + f.n[0] * a, origin[1] + f.n[1] * a];
  return faceWall(o2, newBearing, length, yBase, yTop);
}
