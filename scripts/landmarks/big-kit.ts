import type {Frame} from './nearbar-kit';
import type {ShellSource} from './worship-shell';

/**
 * Wall frames from the raw 3DBAG surface winding. `wallsOf` flips a normal whenever 0.3 m outside the wall is inside the BAG ring,
 * which is wrong for tower walls that rise from a podium of the same pand; the LoD2.2 surfaces are consistently outward-oriented, so
 * large buildings with stepped volumes use the raw normal.
 */
export type RawWall = {f: Frame; len: number; base: number; top: number; index: number; poly: [number, number][]; bearing: number};

export function rawWall(src: ShellSource, index: number): RawWall {
  const r = src.surfaces[index].rings[0];
  let nx = 0, nz = 0;
  for (let i = 0; i < r.length; i++) { const a = r[i], q = r[(i + 1) % r.length]; nx += (a[1] - q[1]) * (a[2] + q[2]); nz += (a[0] - q[0]) * (a[1] + q[1]); }
  const l = Math.hypot(nx, nz), n: [number, number] = [nx / l, nz / l], tangent: [number, number] = [n[1], -n[0]];
  const ts = r.map(p => p[0] * tangent[0] + p[2] * tangent[1]), t0 = Math.min(...ts);
  const mx = r.reduce((s, p) => s + p[0], 0) / r.length, mz = r.reduce((s, p) => s + p[2], 0) / r.length;
  const d = mx * n[0] + mz * n[1];
  return {
    f: {origin: [n[0] * d + tangent[0] * t0, n[1] * d + tangent[1] * t0], tangent, n},
    len: Math.max(...ts) - t0, base: Math.min(...r.map(p => p[1])), top: Math.max(...r.map(p => p[1])), index,
    poly: r.map((p, i) => [ts[i] - t0, p[1]] as [number, number]), bearing: (Math.atan2(n[0], -n[1]) * 180 / Math.PI + 360) % 360,
  };
}

/** Highest wall y at tangent position t (NaN outside the wall). */
export function topOf(w: RawWall, t: number): number {
  let best = -Infinity;
  const p = w.poly;
  for (let i = 0; i < p.length; i++) {
    const a = p[i], q = p[(i + 1) % p.length];
    if ((a[0] - t) * (q[0] - t) > 0) continue;
    if (Math.abs(a[0] - q[0]) < 1e-6) { best = Math.max(best, a[1], q[1]); continue; }
    best = Math.max(best, a[1] + (q[1] - a[1]) * (t - a[0]) / (q[0] - a[0]));
  }
  return Number.isFinite(best) ? best : NaN;
}
