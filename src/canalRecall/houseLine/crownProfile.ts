/**
 * Lane 1 step c (Haarlemmerdijk renderer, 2026-11-13): measured crown profiles for a gabled street front, drawn by the
 * roof planner in place of its own `gableProfile` when a front record states the crown (roofMesh `plan.rowCrown`, set by
 * houseLine/rowFront.ts behind the rowFront flag). Absent: nothing here runs.
 *
 * The planner's own neck is shoulders that ride the roof slope with a square box on top (the "stovepipe hat" on 167818,
 * 176174, 176175); its bell and step take their size from the roof's rise. Here every profile is sized from the record:
 * the crown's rise above the foot (`riseM`), the foot width (`footW`, the full front when unread) and the neck or cap
 * width (`neckW`), symmetric, and the saddle behind it is lowered to sit inside it (`rowCrownRoofRise`).
 *
 *   neck  - claw shoulders (white scroll pieces, klauwstukken) from the foot to an upright neck, a white pediment cap;
 *   bell  - S-curved shoulders sweeping in to the cap width, closed by an arch, white blocks at the shoulders;
 *   point - a plain triangle on the saddle itself, white verge;
 *   step  - treads up to a flat top of the neck width, a white coping on each.
 * Each gets white edge trim and, when the record reads one, an attic light or a hoist door in the crown.
 */
import type { RoofSink, V2, V3 } from '../roofSink.js';

export type RowCrownShape = 'neck' | 'bell' | 'point' | 'step';
export const ROW_CROWN_SHAPES: readonly RowCrownShape[] = ['neck', 'bell', 'point', 'step'];
export interface RowCrown {
  shape: RowCrownShape;
  /** Crown top above its foot (the wall's eaves), metres. */
  riseM: number;
  /** Width of the crown at its foot; the whole front when unread. */
  footW?: number;
  /** Neck (neck gable), cap (bell) or top tread (step) width. */
  neckW?: number;
  /** Attic lights read in the crown (0 = none, absent = unread: one light where it fits). */
  attic?: number;
  hoist?: boolean;
}
export function isRowCrown(v: unknown): v is RowCrown {
  const c = v as RowCrown | null;
  return !!c && typeof c === 'object' && (ROW_CROWN_SHAPES as readonly string[]).includes(c.shape) && Number.isFinite(c.riseM) && c.riseM > 0.5;
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const r3 = (v: number) => Math.round(v * 1000) / 1000;

/** The sizes every profile and its trim agree on, for a front `W` wide. */
export function crownDims(c: RowCrown, W: number) {
  const half = W / 2, T = c.riseM;
  const foot = clamp(c.footW ?? W, Math.min(W, 1.6), W) / 2;
  const defaultNeck = c.shape === 'bell' ? foot * 0.9 : c.shape === 'step' ? foot * 0.55 : foot * 0.65;
  const neck = clamp((c.neckW ?? defaultNeck) / 2, 0.45, foot * 0.8);
  // Neck: a pediment cap as tall as a third of the neck width, at most 0.6 m; the upright neck under it.
  const cap = c.shape === 'neck' ? clamp(neck * 0.6, 0.3, Math.min(0.6, T * 0.3)) : 0;
  const steps = c.shape === 'step' ? clamp(Math.round(T / 0.85), 2, 5) : 0;
  return { half, T, foot, neck, cap, steps };
}

/** The saddle's rise behind the crown: its ridge meets the crown under its top, and its slope stays inside the profile. */
export function rowCrownRoofRise(c: RowCrown, W: number): number {
  const d = crownDims(c, W);
  if (c.shape === 'point') return r3(d.T);
  if (c.shape === 'neck') return r3(Math.max(0.8, d.T - d.cap - 0.15));
  if (c.shape === 'bell') return r3(Math.max(0.8, d.T - 0.3));
  // Step: the highest ridge whose slope passes under every tread's inner corner (0.1 m clear).
  const prof = rowCrownProfile(c, W, 0);
  let R = d.T - 0.2;
  for (const [x, y] of prof) if (Math.abs(x) < d.half - 1e-6 && y > 0) R = Math.min(R, (y - 0.1) / (1 - Math.abs(x) / d.half));
  return r3(Math.max(0.8, R));
}

/** A crown plate's outline above the eaves, x across (-W/2..W/2, never going back), y up; at or above the saddle `R`. */
export function rowCrownProfile(c: RowCrown, W: number, R: number): V2[] {
  const d = crownDims(c, W), { half, T, foot, neck } = d;
  const slope = (x: number) => R * (1 - Math.abs(x) / half);
  const left: V2[] = [];
  const add = (x: number, y: number) => left.push([x, Math.max(y, slope(x) + 0.04)]);
  left.push([-half, 0]);
  // Outside a narrower crown's foot: the roof's cheek, the plate just covering the slope.
  const y0 = foot < half - 0.01 ? slope(-foot) + 0.04 : 0;
  if (foot < half - 0.01) add(-foot, y0);
  if (c.shape === 'point') {
    left.push([0, T]);
  } else if (c.shape === 'neck') {
    const tN = T - d.cap, sh = clamp(Math.max(slope(-neck) + 0.12, y0 + (tN - y0) * 0.42), y0 + 0.3, tN - 0.5);
    // Claw: a quarter ellipse bulging outward from the foot to the neck.
    for (let i = 1; i <= 6; i++) { const t = (i / 6) * Math.PI / 2; add(-neck - (foot - neck) * Math.cos(t), y0 + (sh - y0) * Math.sin(t)); }
    add(-neck, tN); left.push([0, T]);
  } else if (c.shape === 'bell') {
    const sh = clamp(T - Math.min(neck * 0.9, T * 0.4), y0 + 0.4, T - 0.2);
    for (let i = 1; i <= 8; i++) { const t = i / 8; add(-foot + (foot - neck) * t, y0 + (sh - y0) * (3 * t * t - 2 * t * t * t)); }
    for (let i = 1; i <= 6; i++) { const a = Math.PI - (i / 6) * (Math.PI / 2); add(neck * Math.cos(a), sh + (T - sh) * Math.sin(a)); }
  } else {
    const n = d.steps, w = (foot - neck) / (n - 1);
    let x = -foot;
    for (let j = 1; j <= n; j++) {
      const h = y0 + ((T - y0) * j) / n;
      left.push([x, Math.max(h, slope(x) + 0.04)]);
      x = j === n ? 0 : x + w;
      left.push([x, Math.max(h, slope(x) + 0.04)]);
    }
  }
  const apexAtZero = left[left.length - 1][0] === 0;
  const right = (apexAtZero ? left.slice(0, -1) : left).slice().reverse().map(([x, y]) => [-x, y] as V2);
  const all = [...left, ...right];
  return all.filter((p, i) => i === 0 || p[0] !== all[i - 1][0] || p[1] !== all[i - 1][1]);
}

const PROUD = 0.014, PROUD_HI = 0.026;
const GLASS = '#272c33';

function rect(s: RoofSink, f: number, e: number, v0: number, v1: number, z0: number, z1: number, hex: string, proud = PROUD): void {
  const u = f + e * proud;
  s.quad([u, v0, z0], [u, v1, z0], [u, v1, z1], [u, v0, z1], [0, 0], [0, 0], [0, 0], [0, 0], 'decal', [e, 0, 0], hex);
}
function fan(s: RoofSink, f: number, e: number, centre: V2, rim: readonly V2[], hex: string): void {
  const u = f + e * PROUD_HI;
  for (let i = 0; i < rim.length - 1; i++) s.tri([u, centre[0], centre[1]], [u, rim[i][0], rim[i][1]], [u, rim[i + 1][0], rim[i + 1][1]], [0, 0], [0, 0], [0, 0], 'decal', [e, 0, 0], hex);
}
/** A band `bw` wide just inside the outline, over the crown's own edges (not the roof cheeks outside its foot). */
function edgeBand(s: RoofSink, prof: readonly V2[], f: number, e: number, bw: number, foot: number, hex: string): void {
  const u = f + e * PROUD;
  for (let i = 0; i < prof.length - 1; i++) {
    const [x0, y0] = prof[i], [x1, y1] = prof[i + 1];
    if ((y0 < 0.02 && y1 < 0.02) || Math.max(Math.abs(x0), Math.abs(x1)) > foot + 0.01 && Math.min(Math.abs(x0), Math.abs(x1)) >= foot - 0.01) continue;
    const dx = x1 - x0, dy = y1 - y0, l = Math.hypot(dx, dy);
    if (l < 1e-4) continue;
    const nx = dy / l, ny = -dx / l;
    const a: V3 = [u, x0, y0], b: V3 = [u, x1, y1], c: V3 = [u, x1 + nx * bw, Math.max(0, y1 + ny * bw)], dd: V3 = [u, x0 + nx * bw, Math.max(0, y0 + ny * bw)];
    s.quad(a, b, c, dd, [0, 0], [0, 0], [0, 0], [0, 0], 'decal', [e, 0, 0], hex);
  }
}
/** Left and right extent of the profile at height y. */
function spanAt(prof: readonly V2[], y: number): [number, number] | null {
  let lo = Infinity, hi = -Infinity;
  for (let i = 0; i < prof.length - 1; i++) {
    const [x0, y0] = prof[i], [x1, y1] = prof[i + 1];
    if ((y0 <= y && y1 >= y) || (y1 <= y && y0 >= y)) {
      if (Math.abs(y1 - y0) < 1e-9) { lo = Math.min(lo, x0, x1); hi = Math.max(hi, x0, x1); continue; }
      const x = x0 + ((y - y0) / (y1 - y0)) * (x1 - x0);
      lo = Math.min(lo, x); hi = Math.max(hi, x);
    }
  }
  return hi > lo ? [lo, hi] : null;
}

/** White edge trim, scrolls, cap, shoulder blocks and the crown's light or hoist door on one gable end at u = f. */
export function rowCrownAccents(s: RoofSink, c: RowCrown, prof: readonly V2[], f: number, e: number, W: number, R: number, trimHex: string): void {
  const d = crownDims(c, W), { T, foot, neck } = d;
  const slope = (x: number) => R * (1 - Math.abs(x) / d.half);
  const y0 = foot < d.half - 0.01 ? slope(-foot) + 0.04 : 0;
  edgeBand(s, prof, f, e, c.shape === 'point' ? 0.2 : 0.15, foot, trimHex);
  if (c.shape === 'neck') {
    // Scroll pieces: a broad white stone band along each claw (the brick shows inside it) ending in a volute at the
    // foot; the pediment cap filled white.
    const tN = T - d.cap;
    for (const side of [-1, 1]) {
      const claw = prof.filter(([x, y]) => side * x >= neck - 1e-6 && side * x <= foot + 1e-6 && y <= tN - 0.3 && y > 0.001);
      if (claw.length >= 2) edgeBand(s, claw, f, e, 0.3, foot, trimHex);
      const r = clamp((foot - neck) * 0.16, 0.14, 0.26), cx = side * (foot - r - 0.04), cy = y0 + r + 0.04, rim: V2[] = [];
      for (let i = 0; i <= 10; i++) { const a = (i / 10) * Math.PI * 2; rim.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); }
      fan(s, f, e, [cx, cy], rim, trimHex);
    }
    const capRim = prof.filter(([, y]) => y >= tN - 1e-6);
    if (capRim.length >= 3) fan(s, f, e, [0, tN], capRim, trimHex);
    rect(s, f, e, -neck, neck, tN - 0.12, tN, trimHex, PROUD_HI);
  }
  if (c.shape === 'bell') for (const side of [-1, 1]) rect(s, f, e, side < 0 ? -foot : foot - 0.4, side < 0 ? -foot + 0.4 : foot, y0, y0 + 0.32, trimHex, PROUD_HI);
  // The crown's opening: a hoist door (white frame, dark leaves) or an attic light, centred, inside the profile.
  const lights = c.attic ?? 1;
  if (!c.hoist && lights < 1) return;
  const capTop = c.shape === 'neck' ? T - d.cap : c.shape === 'bell' ? T - 0.35 : c.shape === 'point' ? T * 0.72 : T - 0.25;
  const z0 = Math.max(y0 + 0.3, c.shape === 'point' ? 0.35 : y0 + 0.3);
  const z1 = Math.min(capTop - 0.15, z0 + (c.hoist ? 1.5 : 1.15));
  if (z1 - z0 < 0.55) return;
  const sp = spanAt(prof, z1), inner = sp ? Math.min(-sp[0], sp[1]) - 0.2 : 0;
  const hw = Math.min(c.hoist ? 0.5 : 0.42, inner, (c.shape === 'neck' || c.shape === 'step' ? neck : foot) - 0.25);
  if (hw < 0.22) return;
  const fr = 0.08;
  rect(s, f, e, -hw - fr, hw + fr, z0 - fr, z1 + fr, trimHex);
  rect(s, f, e, -hw, hw, z0, z1, GLASS, PROUD_HI);
  if (c.hoist) rect(s, f, e, -0.025, 0.025, z0, z1, trimHex, PROUD_HI + 0.004);
  else rect(s, f, e, -hw, hw, (z0 + z1) / 2 - 0.025, (z0 + z1) / 2 + 0.025, trimHex, PROUD_HI + 0.004);
}
