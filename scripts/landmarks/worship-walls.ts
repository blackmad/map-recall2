import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import type {ShellSource} from './worship-shell';

export type Wall = {n: [number, number]; origin: [number, number]; tangent: [number, number]; length: number; base: number; poly: [number, number][]; index: number};

function inRing(x: number, z: number, ring: number[][]) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i], q = ring[j];
    if ((a[1] > z) !== (q[1] > z) && x < (q[0] - a[0]) * (z - a[1]) / (q[1] - a[1]) + a[0]) inside = !inside;
  }
  return inside;
}

/** Vertical wall faces of the shell with outward normals (checked against the BAG ring) and (t,y) outlines. */
export function wallsOf(src: ShellSource): Wall[] {
  const out: Wall[] = [];
  src.surfaces.forEach((s, index) => {
    if (s.type !== 'WallSurface') return;
    const r = s.rings[0];
    let nx = 0, nz = 0;
    for (let i = 0; i < r.length; i++) { const a = r[i], q = r[(i + 1) % r.length]; nx += (a[1] - q[1]) * (a[2] + q[2]); nz += (a[0] - q[0]) * (a[1] + q[1]); }
    const l = Math.hypot(nx, nz);
    if (l < 1e-6) return;
    let n: [number, number] = [nx / l, nz / l];
    const mx = r.reduce((s2, p) => s2 + p[0], 0) / r.length, mz = r.reduce((s2, p) => s2 + p[2], 0) / r.length;
    if (inRing(mx + n[0] * 0.3, mz + n[1] * 0.3, src.nativeRing)) n = [-n[0], -n[1]];
    const tangent: [number, number] = [n[1], -n[0]];
    const ts = r.map(p => p[0] * tangent[0] + p[2] * tangent[1]);
    const t0 = Math.min(...ts);
    const d = mx * n[0] + mz * n[1];
    out.push({n, origin: [n[0] * d + tangent[0] * t0, n[1] * d + tangent[1] * t0], tangent, length: Math.max(...ts) - t0, base: Math.min(...r.map(p => p[1])), poly: r.map((p, i) => [ts[i] - t0, p[1]] as [number, number]), index});
  });
  return out;
}

/** Highest wall y at tangent position t. */
export function wallTop(w: Wall, t: number) {
  let best = -Infinity;
  const p = w.poly;
  for (let i = 0; i < p.length; i++) {
    const a = p[i], q = p[(i + 1) % p.length];
    if ((a[0] - t) * (q[0] - t) > 0) continue;
    if (Math.abs(a[0] - q[0]) < 1e-6) { best = Math.max(best, a[1], q[1]); continue; }
    best = Math.max(best, a[1] + (q[1] - a[1]) * (t - a[0]) / (q[0] - a[0]));
  }
  return best;
}

/** Place a box flush on a wall: t along the wall, y bottom, out = offset along the outward normal. */
export function onWall(b: BuildingTools, w: Wall, t: number, y: number, bw: number, bh: number, bd: number, colour: string, out = 0, tag?: string) {
  const g = new T.BoxGeometry(bw, bh, bd);
  g.rotateY(Math.atan2(w.n[0], w.n[1]));
  g.translate(w.origin[0] + w.tangent[0] * t + w.n[0] * (out + bd / 2), y + bh / 2, w.origin[1] + w.tangent[1] * t + w.n[1] * (out + bd / 2));
  if (tag) g.userData.tag = tag;
  b.add(g, colour as never);
}

export type BayOptions = {y: number; h: number; wd: number; pitch: number; margin?: number; glass?: string; trim?: string; frame?: string; arch?: boolean};

/** Evenly spaced window bays with stone sills and lintels; skips bays that would poke through the wall top. */
export function addBays(b: BuildingTools, w: Wall, o: BayOptions) {
  const margin = o.margin ?? 1, usable = w.length - 2 * margin;
  if (usable < o.wd) return 0;
  const n = Math.max(1, Math.floor((usable - o.wd) / o.pitch) + 1);
  const span = (n - 1) * o.pitch, start = w.length / 2 - span / 2;
  let placed = 0;
  for (let i = 0; i < n; i++) {
    const t = start + i * o.pitch, y = w.base + o.y;
    if (wallTop(w, t - o.wd / 2) < y + o.h + 0.5 || wallTop(w, t + o.wd / 2) < y + o.h + 0.5) continue;
    const trim = o.trim ?? 'stone', frame = o.frame ?? 'frame';
    onWall(b, w, t, y - 0.12, o.wd + 0.3, 0.14, 0.16, trim, 0);
    onWall(b, w, t, y + o.h, o.wd + 0.3, 0.16, 0.16, trim, 0);
    onWall(b, w, t, y, o.wd, o.h, 0.08, o.glass ?? 'glass', 0.02, 'pane');
    const rows = Math.max(1, Math.round(o.h / 1.2));
    for (let k = 1; k < rows; k++) onWall(b, w, t, y + o.h * k / rows - 0.03, o.wd, 0.06, 0.12, frame, 0.02);
    const cols = o.wd > 1.6 ? 3 : o.wd > 0.9 ? 2 : 1;
    for (let k = 0; k <= cols; k++) onWall(b, w, t - o.wd / 2 + 0.03 + (o.wd - 0.06) * k / cols, y, 0.06, o.h, 0.12, frame, 0.02);
    placed++;
  }
  return placed;
}
