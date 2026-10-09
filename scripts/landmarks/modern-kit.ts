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
  const t0 = Math.min(...ts), d = Math.max(...r.map(p => p[0] * n[0] + p[2] * n[1]));   // outermost vertex: the plane the windows sit on
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

export type PunchedOptions = {
  y0: number;                 // top of the ground storey (first window floor sits here)
  pitch: number;              // floor-to-floor
  colPitch: number;           // window axis spacing (the wall is divided into whole columns)
  winW: number; winBottom: number; winH: number;
  band: string;               // wall colour of the spandrel bands (same family as the wall)
  stripe?: string;            // thin stripe along each band
  darkStripe?: string; darkFloors?: number;   // lowest floors use this stripe colour
  glass: string; ground?: string;
  crenel?: string;            // merlons along a flat wall top
  margin?: number; minTop?: number;
};

/**
 * Punched masonry facade: one tall glazed strip per window axis, hidden between floors by a spandrel band
 * across the wall, so each axis reads as a stack of storey-high windows between brick piers. Clipped to the
 * wall outline; floors follow one grid (y0 + k * pitch) across stepped walls of the same building.
 */
export function punchedFacade(b: BuildingTools, w: Wall, o: PunchedOptions) {
  const f = frameOf(w), m = o.margin ?? 0.8;
  const n = Math.max(1, Math.round((w.length - 2 * m) / o.colPitch)), pitch = (w.length - 2 * m) / n;
  const tc = (i: number) => m + pitch * (i + 0.5);
  const top = (t: number) => { const v = wallTop(w, Math.max(0.01, Math.min(w.length - 0.01, t))); return Number.isFinite(v) ? v : 0; };
  const topMax = Math.max(...w.poly.map(p => p[1]));
  if (w.base < o.y0 - 0.5 && o.ground) slab(b, f, w.length / 2, w.base, w.length - 0.1, o.y0 - w.base - 0.05, 0.24, o.ground);
  const kFirst = Math.max(0, Math.ceil((w.base - o.y0 - 0.05) / o.pitch));
  // glazed strips
  for (let i = 0; i < n; i++) {
    const t = tc(i), lim = top(t) - 0.35;
    let kLast = -1;
    for (let k = kFirst; o.y0 + k * o.pitch + o.winBottom + o.winH <= lim; k++) kLast = k;
    if (kLast < kFirst) continue;
    const yb = o.y0 + kFirst * o.pitch + o.winBottom, yt = o.y0 + kLast * o.pitch + o.winBottom + o.winH;
    slab(b, f, t, yb, o.winW, yt - yb, 0.1, o.glass);
  }
  // spandrel bands between and below windows, as runs of columns whose strip reaches that floor
  for (let k = kFirst; ; k++) {
    const yf = o.y0 + k * o.pitch, y1 = yf + o.winBottom + o.winH;
    if (y1 > topMax - 0.3) break;
    const bandY = y1, bandH = o.pitch - o.winH;
    let run: number | null = null;
    for (let i = 0; i <= n; i++) {
      const ok = i < n && top(tc(i)) - 0.35 >= y1 + 0.2;
      if (ok && run === null) run = i;
      if (!ok && run !== null) {
        const t0 = i === n ? w.length : tc(run) - pitch / 2, t1 = i === n ? w.length : tc(i - 1) + pitch / 2;
        const a = run === 0 ? 0 : t0, c = i === n ? w.length : t1;
        if (Math.min(top(a + 0.05), top(c - 0.05)) >= bandY + 0.4) {
          const hh = Math.min(bandH, Math.min(top(a + 0.05), top(c - 0.05)) - bandY - 0.05);
          slab(b, f, (a + c) / 2, bandY, c - a, hh, 0.14, o.band);
          if (o.stripe) slab(b, f, (a + c) / 2, bandY + hh * 0.35, c - a, Math.min(0.4, hh * 0.3), 0.17, k < (o.darkFloors ?? 0) && o.darkStripe ? o.darkStripe : o.stripe);
        }
        run = null;
      }
    }
  }
  // crenellated parapet along a flat top
  if (o.crenel && topMax < 100 && Math.abs(top(1) - top(w.length - 1)) < 0.3 && w.length > 6) {
    for (let i = 0; i < n; i += 2) slab(b, f, tc(i), top(tc(i)) - 0.02, pitch * 0.6, 0.9, 0.3, o.crenel);
  }
}

/** A rectangular virtual wall on a face plane, for facades that span several noisy 3DBAG wall pieces. */
export function faceWall(origin: [number, number], bearingDeg: number, length: number, yBase: number, yTop: number, index = -1): Wall {
  const f = frameFromBearing(origin, bearingDeg);
  return {n: f.n, origin, tangent: f.tangent, length, base: yBase, poly: [[0, yBase], [length, yBase], [length, yTop], [0, yTop]], index};
}
