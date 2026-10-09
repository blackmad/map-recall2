import type {BuildingTools} from './cultural-builders';
import {slab, frameOf, type Frame} from './nearbar-kit';
import type {Surface} from './worship-shell';
import {wallTop, type Wall} from './worship-walls';

/**
 * Small shared kit for the modern towers and halls (IJ-toren, Symphony, Klimhal).
 * Frames follow nearbar-kit: x along the wall tangent (viewer's right facing the wall from outside), y up,
 * z out of the wall. All solids sink into the wall plane so uneven 3DBAG faces still hold them.
 */

/** Frame for a face given its outward compass bearing (0 = north, 90 = east) and the point where t = 0. */
export function frameFromBearing(origin: [number, number], bearingDeg: number): Frame {
  const a = bearingDeg * Math.PI / 180;
  const n: [number, number] = [Math.sin(a), -Math.cos(a)];   // native: x east, z south
  return {origin, tangent: [n[1], -n[0]], n};
}

/** Point on a frame at tangent position t and offset `out` along the normal. */
export const pointOn = (f: Frame, t: number, out = 0): [number, number] => [f.origin[0] + f.tangent[0] * t + f.n[0] * out, f.origin[1] + f.tangent[1] * t + f.n[1] * out];

/** Compass bearing of a wall's outward normal. */
export const bearingOf = (n: [number, number]) => (Math.atan2(n[0], -n[1]) * 180 / Math.PI + 360) % 360;

/**
 * Wall face from a vertical 3DBAG wall surface whose outward side is chosen to point away from `centre`
 * (for convex towers inside a larger pand, where the ring test of wallsOf cannot decide).
 */
export function wallAwayFrom(s: Surface, index: number, centre: [number, number]): Wall | null {
  const r = s.rings[0];
  let nx = 0, nz = 0;
  for (let i = 0; i < r.length; i++) { const a = r[i], q = r[(i + 1) % r.length]; nx += (a[1] - q[1]) * (a[2] + q[2]); nz += (a[0] - q[0]) * (a[1] + q[1]); }
  const l = Math.hypot(nx, nz);
  if (l < 1e-6) return null;
  let n: [number, number] = [nx / l, nz / l];
  const mx = r.reduce((q, p) => q + p[0], 0) / r.length, mz = r.reduce((q, p) => q + p[2], 0) / r.length;
  if ((mx - centre[0]) * n[0] + (mz - centre[1]) * n[1] < 0) n = [-n[0], -n[1]];
  const tangent: [number, number] = [n[1], -n[0]];
  const ts = r.map(p => p[0] * tangent[0] + p[2] * tangent[1]);
  const t0 = Math.min(...ts), d = mx * n[0] + mz * n[1];
  return {n, origin: [n[0] * d + tangent[0] * t0, n[1] * d + tangent[1] * t0], tangent, length: Math.max(...ts) - t0, base: Math.min(...r.map(p => p[1])), poly: r.map((p, i) => [ts[i] - t0, p[1]] as [number, number]), index};
}

export type CurtainOptions = {
  y0: number; floorH: number;
  spandrelH: number;                   // pale panel at the bottom of each floor
  bayW: number;                        // mullion pitch
  spandrel: string; mullion: string;
  mullionW?: number; depth?: number;
  margin?: number;
  /** Extra cap strip colour at the wall top. */
  cap?: string;
};

/**
 * Curtain wall over a glazed shell wall: a spandrel strip per floor and a mullion per bay, clipped to the
 * wall's own outline (so stepped crowns and set-backs keep their steps).
 */
export function curtainOnWall(b: BuildingTools, w: Wall, o: CurtainOptions) {
  const f = frameOf(w), d = o.depth ?? 0.12, m = o.margin ?? 0.15;
  const n = Math.max(1, Math.round((w.length - 2 * m) / o.bayW)), pitch = (w.length - 2 * m) / n;
  const tAt = (i: number) => m + i * pitch;
  const top = (t: number) => { const v = wallTop(w, t); return Number.isFinite(v) ? v : 0; };
  const topMax = Math.max(...w.poly.map(p => p[1]));
  const yStart = Math.max(o.y0, w.base);
  for (let k = 0; ; k++) {
    const y = o.y0 + k * o.floorH;
    if (y + o.spandrelH > topMax - 0.2) break;
    if (y + o.spandrelH < w.base + 0.05) continue;
    // contiguous runs of bays whose wall top clears the strip
    let run: number | null = null;
    for (let i = 0; i <= n; i++) {
      const ok = i < n && top(tAt(i) + pitch / 2) >= y + o.spandrelH + 0.2;
      if (ok && run === null) run = i;
      if (!ok && run !== null) { const t0 = tAt(run), t1 = tAt(i); slab(b, f, (t0 + t1) / 2, y, t1 - t0, o.spandrelH, d * 0.8, o.spandrel); run = null; }
    }
  }
  for (let i = 0; i <= n; i++) {
    const t = tAt(i), h = Math.min(top(Math.max(0.01, Math.min(w.length - 0.01, t - 0.02))), top(Math.max(0.01, Math.min(w.length - 0.01, t + 0.02)))) - 0.2;
    if (h - yStart > 0.5) slab(b, f, t, yStart, o.mullionW ?? 0.08, h - yStart, d, o.mullion);
  }
  if (o.cap) slab(b, f, w.length / 2, topMax - 0.05, w.length, 0.3, d * 1.5, o.cap);
}

/** n evenly spaced punched windows along a wall: glazing with a frame surround. */
export function windowRow(b: BuildingTools, w: Wall, o: {n: number; y: number; h: number; wd: number; glass: string; frame: string; margin?: number}) {
  const f = frameOf(w), m = o.margin ?? 1.0, pitch = (w.length - 2 * m) / o.n;
  for (let i = 0; i < o.n; i++) {
    const t = m + pitch * (i + 0.5);
    slab(b, f, t, o.y - 0.12, o.wd + 0.3, o.h + 0.24, 0.1, o.frame);
    slab(b, f, t, o.y, o.wd, o.h, 0.16, o.glass);
  }
}
