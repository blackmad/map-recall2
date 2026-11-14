import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {put, slab, ledgeStrip, type Frame} from './nearbar-kit';
import {rawWall, topOf, type RawWall} from './big-kit';
import {bottomOf, claimOpening, quad} from './big-facade';
import {raisedLettering} from './ornament-kit';
import type {ShellSource, Surface} from './worship-shell';

/**
 * Shared helpers of the second Houthavens landmark lane (blok0-ij4you, de-rede, oba-spaarndammerbuurt; 2026-11-14):
 * modern residential blocks drawn on their 3DBAG LoD2.2 shell (CC BY 4.0) with the facade dressed per wall from the
 * rectified panoramas. Frames follow big-kit rawWall (t along the viewer's right, y up, out of the wall).
 */
export type V2 = [number, number];

/** Split a shell's surfaces into colour groups (walls by `wallColour`, roofs by `roofColour`); each group is one ShellSource. */
export function shellGroups(src: ShellSource, wallColour: (s: Surface, i: number) => string, roofColour: (s: Surface, i: number) => string): Map<string, ShellSource> {
  const out = new Map<string, ShellSource>();
  src.surfaces.forEach((s, i) => {
    if (s.type === 'GroundSurface') return;
    const c = s.type === 'RoofSurface' ? roofColour(s, i) : wallColour(s, i);
    const g = out.get(`${s.type === 'RoofSurface' ? 'r' : 'w'}:${c}`) ?? {surfaces: [], nativeRing: src.nativeRing};
    g.surfaces.push(s);
    out.set(`${s.type === 'RoofSurface' ? 'r' : 'w'}:${c}`, g);
  });
  return out;
}

/** Every 3DBAG wall at least `minLen` long and `minH` high, with a usable frame. */
export function shellWalls(src: ShellSource, minLen = 2.4, minH = 2.4): RawWall[] {
  const out: RawWall[] = [];
  src.surfaces.forEach((s, i) => {
    if (s.type !== 'WallSurface') return;
    const w = rawWall(src, i);
    if (!(w.len >= minLen) || !Number.isFinite(w.f.n[0]) || w.top - w.base < minH) return;
    out.push(w);
  });
  return out;
}

export const midOf = (w: RawWall): V2 => [w.f.origin[0] + w.f.tangent[0] * w.len / 2, w.f.origin[1] + w.f.tangent[1] * w.len / 2];
export const centroidXZ = (s: Surface): V2 => {
  const r = s.rings[0];
  return [r.reduce((a, p) => a + p[0], 0) / r.length, r.reduce((a, p) => a + p[2], 0) / r.length];
};
/** Signed side of point p relative to the line a -> c (positive on the left in x/z). */
export const sideOf = (p: V2, a: V2, c: V2) => (c[0] - a[0]) * (p[1] - a[1]) - (c[1] - a[1]) * (p[0] - a[0]);
/** Distance of p from the infinite line a -> c. */
export const lineDist = (p: V2, a: V2, c: V2) => Math.abs(sideOf(p, a, c)) / Math.hypot(c[0] - a[0], c[1] - a[1]);

/** Whether the rectangle t0..t1, y0..y1 fits inside the wall polygon (with margin). */
export function fits(w: RawWall, t0: number, t1: number, y0: number, y1: number, margin = 0.15): boolean {
  for (const t of [t0 - margin, (t0 + t1) / 2, t1 + margin]) {
    const top = topOf(w, t), bot = bottomOf(w, t);
    if (!Number.isFinite(top) || !Number.isFinite(bot) || y1 + margin > top || y0 - margin < bot) return false;
  }
  return true;
}

/**
 * A window on a shell wall: frame ring and glass as stacked sheets (big-facade quad layers), optional mullion and a glass
 * balustrade (French window). Returns false when the opening does not fit or overlaps a claimed one.
 */
export function shellWindow(b: BuildingTools, w: RawWall, t: number, y: number, ww: number, wh: number,
  o: {frame?: string; glass?: string; ring?: number; mullion?: boolean; rail?: string; transom?: number} = {}): boolean {
  const ring = o.ring ?? 0.09;
  if (!claimOpening(w, t - ww / 2, t + ww / 2, y, y + wh, ring + 0.02)) return false;
  quad(b, w.f, t, y - ring, ww + 2 * ring, wh + 2 * ring, o.frame ?? 'frame', 0.02);
  sill(b, w.f, t, y - ring, ww + 2 * ring, o.frame ?? 'frame');
  quad(b, w.f, t, y, ww, wh, o.glass ?? 'glass', 0.04);
  if (o.mullion) quad(b, w.f, t, y, 0.08, wh, o.frame ?? 'frame', 0.06);
  if (o.transom !== undefined) quad(b, w.f, t, y + o.transom, ww, 0.07, o.frame ?? 'frame', 0.06);
  if (o.rail) quad(b, w.f, t, y + 0.95, ww, 0.06, o.rail, 0.06);                 // balustrade top rail of a French window
  return true;
}

/**
 * A sill under a window frame: a strip run back into the wall (nearbar ledgeStrip), 6 cm high, 8 cm deep, whose top meets the
 * frame's bottom edge. The layered frame sheets stand 4.5 cm off the wall (big-facade layerOut, clear of z-fighting), past the
 * openings audit's 3 cm touch tolerance; the sill joins the assembly to its wall, as on the real facade.
 */
export function sill(b: BuildingTools, f: Frame, t: number, yBottom: number, w: number, colour: string, out = 0) {
  if (yBottom < 0.01) return;
  const h = Math.min(0.06, yBottom);
  ledgeStrip(b, f, t, yBottom - h, w + 0.06, h, 0.09, colour, out);
}

/** Window rows: one window per column per sill, skipped where it does not fit. Returns the count placed. */
export function shellRows(b: BuildingTools, w: RawWall, cols: number[], sills: number[], ww: number, wh: number,
  o: Parameters<typeof shellWindow>[6] = {}): number {
  let n = 0;
  for (const y of sills) for (const t of cols) if (shellWindow(b, w, t, y, ww, wh, o)) n++;
  return n;
}

/** Columns centred on a wall: n = floor((len - 2 margin) / pitch) + 1, at least one if the wall takes one. */
export function columns(len: number, pitch: number, margin: number): number[] {
  const n = Math.floor((len - 2 * margin) / pitch) + 1;
  if (n < 1) return len >= 2 * margin ? [len / 2] : [];
  const t0 = (len - (n - 1) * pitch) / 2;
  return Array.from({length: n}, (_, k) => t0 + k * pitch);
}

/**
 * A slab balcony on a wall: floor slab `d` deep (white/concrete edge), glass balustrade on its front and ends. The slab
 * is a solid box sunk into the wall (nearbar-kit slab), the balustrade a closed 4 cm glass box. The balustrade glass defaults
 * to the `blue` (accent) slot so the openings audit does not judge it as a window pane standing off its wall.
 */
export function slabBalcony(b: BuildingTools, f: Frame, t0: number, t1: number, y: number, d: number, o: {slab?: string; rail?: string; thick?: number; railH?: number; ends?: boolean} = {}) {
  const th = o.thick ?? 0.22, rh = o.railH ?? 1.0, rail = o.rail ?? 'blue', w = t1 - t0, c = (t0 + t1) / 2;
  slab(b, f, c, y - th, w, th, d, o.slab ?? 'white');
  slab(b, f, c, y, w - 0.04, rh, 0.04, rail, d - 0.08);
  if (o.ends !== false) for (const e of [t0 + 0.04, t1 - 0.04]) slab(b, f, e, y, 0.04, rh, d - 0.12, rail, 0.02);
}

/** Lettering on a wall (left edge at t, bottom at y), raised `depth` out of the plane at `out`. */
export function wallLetters(b: BuildingTools, f: Frame, text: string, t: number, y: number, height: number, maxWidth: number, colour: string, out = 0, depth = 0.04, centre = true) {
  const L = raisedLettering({text, heightM: height, maxWidthM: maxWidth, depthM: depth});
  const box = new T.Box3().setFromBufferAttribute(L.geometry.getAttribute('position') as T.BufferAttribute);
  // normalise: left edge at x = 0, bottom at y = 0 (the glyph kit is not consistent about its origin)
  L.geometry.translate(-box.min.x, -box.min.y, 0);
  const w = box.max.x - box.min.x;
  put(b, f, L.geometry, centre ? t - w / 2 : t, y, out, colour);
  return w;
}

/** Horizontal band (projecting course) along a whole wall where the wall stands at that height. */
export function wallBand(b: BuildingTools, w: RawWall, y: number, h: number, d: number, colour: string, inset = 0) {
  // keep to the part of the wall that reaches y + h
  const step = 0.25;
  let a = -1;
  const emit = (t0: number, t1: number) => { if (t1 - t0 > 0.4) ledgeStrip(b, w.f, (t0 + t1) / 2, y, t1 - t0, h, d, colour); };
  for (let t = inset; t <= w.len - inset + 1e-6; t += step) {
    const ok = topOf(w, t) >= y + h - 1e-3 && bottomOf(w, t) <= y + 1e-3;
    if (ok && a < 0) a = t;
    if (!ok && a >= 0) { emit(a, t - step); a = -1; }
  }
  if (a >= 0) emit(a, w.len - inset);
}

/** A flight of steps rising from (t0, y = 0) at the mouth to y1 at depth `run` into a recess: one box per step. */
export function stairFlight(b: BuildingTools, f: Frame, t0: number, t1: number, run: number, y1: number, colour: string, steps: number) {
  const rise = y1 / steps, tread = run / steps;
  for (let k = 0; k < steps; k++) {
    // step k: from depth k*tread (measured inward from the mouth) to the back, top at (k + 1) * rise; drawn as a box
    // whose front face is at -k*tread (frame out = negative inward)
    const g = new T.BoxGeometry(t1 - t0, rise, run - k * tread).translate((t1 - t0) / 2, rise / 2 + k * rise, -(run - k * tread) / 2 - k * tread);
    put(b, f, g, t0, 0, 0, colour);
  }
}

/**
 * The shell wall under ring-edge position t at height y..y+h: parallel to the edge (12 deg), its plane within `reach` of the
 * edge, t inside it with 0.2 m to spare. 3DBAG splits fronts into pieces at slightly different depths, so every opening is
 * hosted on the piece it actually sits on (blok0-ij4you quay fronts, de-rede gables).
 */
export function hostOn(walls: RawWall[], f: Frame, t: number, y: number, h: number, half: number, reach = 1.2): {w: RawWall; tw: number} | null {
  const px = f.origin[0] + f.tangent[0] * t, pz = f.origin[1] + f.tangent[1] * t;
  let best: {w: RawWall; tw: number; d: number} | null = null;
  for (const w of walls) {
    if (w.f.n[0] * f.n[0] + w.f.n[1] * f.n[1] < 0.978) continue;
    const ox = px - w.f.origin[0], oz = pz - w.f.origin[1];
    const d = Math.abs(ox * w.f.n[0] + oz * w.f.n[1]), tw = ox * w.f.tangent[0] + oz * w.f.tangent[1];
    if (d > reach || tw - half < 0.2 || tw + half > w.len - 0.2 || !fits(w, tw - half, tw + half, Math.max(y, w.base + 0.21), y + h, 0.2)) continue;
    if (!best || d < best.d) best = {w, tw, d};
  }
  return best;
}
