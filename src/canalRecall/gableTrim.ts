// White stone and paint on Amsterdam gables, for the roof builder.
//
// All of it is flat-coloured geometry in the gable's own plane (decals 1–2 cm
// proud of the brick) or small closed boxes:
//   band     – sandstone edging that follows a shaped gable's outline
//   claws    – the white quarter-round scroll pieces (klauwstukken) of a raised neck gable
//   crown    – a white pediment or arch on top of a neck or clock gable
//   quoins   – white corner stones on each step of a stepped gable
//   speklaag – horizontal white stone courses across a stepped or neck gable
//   shutters – painted loading-door shutters in a warehouse spout gable
//   cornice  – the deep white wooden cornice (and frieze) of a flat-topped lijstgevel
//   verge    – white barge boards along a plain gable or a pitched roof's end

import type { GableShape } from './roofMesh.js';
import type { RoofSink, V2, V3 } from './roofSink.js';

/** Decal offsets in front of the gable plane: frames sit behind the things framed. */
const PROUD = 0.012, PROUD_HI = 0.022;

/** Left and right extent of a gable profile at height y (crossing segments), or null above it. */
export function profileSpan(prof: readonly V2[], y: number): [number, number] | null {
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

/** A rectangle decal on the gable plane at u = `f` (facing e), from v0..v1 and z0..z1. */
function rectDecal(s: RoofSink, f: number, e: number, v0: number, v1: number, z0: number, z1: number, hex: string, proud = PROUD): void {
  const u = f + e * proud;
  s.quad([u, v0, z0], [u, v1, z0], [u, v1, z1], [u, v0, z1], [0, 0], [0, 0], [0, 0], [0, 0], 'decal', [e, 0, 0], hex);
}

/** A band of width `bw` just inside the profile outline (skipping the eaves line). */
export function outlineBand(s: RoofSink, prof: readonly V2[], f: number, e: number, bw: number, hex: string, from = 0, to = Infinity): void {
  const u = f + e * PROUD;
  for (let i = 0; i < prof.length - 1; i++) {
    const [x0, y0] = prof[i], [x1, y1] = prof[i + 1];
    if (Math.max(y0, y1) < from || Math.min(y0, y1) > to) continue;
    if (y0 < 0.02 && y1 < 0.02) continue;
    const dx = x1 - x0, dy = y1 - y0, l = Math.hypot(dx, dy);
    if (l < 1e-4) continue;
    const nx = dy / l, ny = -dx / l; // right of travel: into the gable
    const a: V3 = [u, x0, y0], b: V3 = [u, x1, y1], c: V3 = [u, x1 + nx * bw, Math.max(0, y1 + ny * bw)], d: V3 = [u, x0 + nx * bw, Math.max(0, y0 + ny * bw)];
    s.quad(a, b, c, d, [0, 0], [0, 0], [0, 0], [0, 0], 'decal', [e, 0, 0], hex);
  }
}

/** A filled convex region on the gable plane: a fan about `centre`. */
function fanDecal(s: RoofSink, f: number, e: number, centre: V2, rim: readonly V2[], hex: string, proud = PROUD_HI): void {
  const u = f + e * proud;
  for (let i = 0; i < rim.length - 1; i++) s.tri([u, centre[0], centre[1]], [u, rim[i][0], rim[i][1]], [u, rim[i + 1][0], rim[i + 1][1]], [0, 0], [0, 0], [0, 0], 'decal', [e, 0, 0], hex);
}

export type GableTrimInput = { shape: GableShape; prof: readonly V2[]; f: number; e: number; W: number; R: number; trimHex: string; shutterHex: string; shutters: boolean; /** Raised neck: the claw arcs (left, right) to fill white. */ claws?: V2[][]; /** Height where the white crown (pediment, arch) starts. */ crownBase?: number };

/** The white accents of one gable end. `prof` is the gable profile (x across, y up from the eaves). */
export function gableAccents(s: RoofSink, g: GableTrimInput): void {
  const { shape, prof, f, e, W, trimHex } = g, half = W / 2;
  const top = Math.max(...prof.map(p => p[1]));
  if (shape === 'plain') { outlineBand(s, prof, f, e, 0.2, trimHex); return; }
  if (shape === 'cornice') { corniceFront(s, g, top); return; }
  if (shape === 'step') {
    // Quoins: white stones down the outer corner of every step, alternating long and short.
    for (let i = 0; i < prof.length - 1; i++) {
      const [x0, y0] = prof[i], [x1, y1] = prof[i + 1];
      if (Math.abs(x1 - x0) > 1e-4 || Math.abs(y1 - y0) < 0.3) continue;
      const hi = Math.max(y0, y1), lo = Math.min(y0, y1), inward = x0 < 0 ? 1 : -1;
      for (let k = 0, z = hi - 0.02; z - 0.24 > lo + 0.02 && k < 3; k++, z -= 0.27) {
        const w = k % 2 === 0 ? 0.36 : 0.22;
        rectDecal(s, f, e, inward > 0 ? x0 : x0 - w, inward > 0 ? x0 + w : x0, z - 0.24, z, trimHex);
      }
    }
    speklagen(s, prof, f, e, top, trimHex, [0.3, 0.62]);
    return;
  }
  if (shape === 'raisedNeck' || shape === 'clock' || shape === 'neck' || shape === 'bell') outlineBand(s, prof, f, e, shape === 'clock' ? 0.22 : 0.16, trimHex);
  if (shape === 'neck') speklagen(s, prof, f, e, top, trimHex, [0.45]);
  if (shape === 'raisedNeck') {
    // Claw pieces: the quarter-round arcs of the profile, filled white about their centre.
    for (const side of [-1, 1]) {
      const arc = g.claws?.[side < 0 ? 0 : 1];
      if (!arc || arc.length < 2) continue;
      const cx = side * Math.min(...arc.map(p => Math.abs(p[0]))), cy = Math.min(...arc.map(p => p[1]));
      fanDecal(s, f, e, [cx, cy], arc, trimHex);
    }
    crown(s, prof, f, e, top, trimHex, g.crownBase ?? top - 0.6);
    speklagen(s, prof, f, e, top, trimHex, [0.62]);
  }
  if (shape === 'clock') crown(s, prof, f, e, top, trimHex, g.crownBase ?? top - 0.6);
  if (shape === 'bell') {
    const span = profileSpan(prof, top - 0.5);
    if (span) rectDecal(s, f, e, span[0] + 0.05, span[1] - 0.05, top - 0.5, top - 0.34, trimHex);
  }
  if (shape === 'spout' && g.shutters) spoutShutters(s, prof, f, e, half, top, trimHex, g.shutterHex);
}

/** The profile above `base` (a pediment or an arch) filled white. */
function crown(s: RoofSink, prof: readonly V2[], f: number, e: number, top: number, hex: string, base: number): void {
  const rim = prof.filter(p => p[1] >= base - 1e-6);
  if (rim.length < 3 || top - base < 0.15) return;
  fanDecal(s, f, e, [(rim[0][0] + rim[rim.length - 1][0]) / 2, base], rim, hex);
}

/** White stone courses across the gable at fractions of its height. */
function speklagen(s: RoofSink, prof: readonly V2[], f: number, e: number, top: number, hex: string, at: number[]): void {
  for (const t of at) {
    const y = top * t, a = profileSpan(prof, y), b = profileSpan(prof, y + 0.15);
    if (!a || !b) continue;
    const v0 = Math.max(a[0], b[0]) + 0.02, v1 = Math.min(a[1], b[1]) - 0.02;
    if (v1 - v0 > 0.5) rectDecal(s, f, e, v0, v1, y, y + 0.15, hex);
  }
}

/** A pair of painted shutters (a loading door) in a white frame, centred in a spout gable. */
function spoutShutters(s: RoofSink, prof: readonly V2[], f: number, e: number, half: number, top: number, trimHex: string, shutterHex: string): void {
  const y0 = 0.3, h = Math.min(1.5, top * 0.45), span = profileSpan(prof, y0 + h + 0.1);
  if (!span) return;
  const w = Math.min(1.0, half * 0.4, span[1] - span[0] - 0.35);
  if (w < 0.5 || h < 0.8) return;
  rectDecal(s, f, e, -w / 2 - 0.08, w / 2 + 0.08, y0 - 0.08, y0 + h + 0.08, trimHex);
  rectDecal(s, f, e, -w / 2, -0.025, y0, y0 + h, shutterHex, PROUD_HI);
  rectDecal(s, f, e, 0.025, w / 2, y0, y0 + h, shutterHex, PROUD_HI);
}

/**
 * The lijstgevel's cornice: a deep closed white box along the top of the
 * flat-topped front, a white frieze under it and white corner pilasters.
 */
function corniceFront(s: RoofSink, g: GableTrimInput, top: number): void {
  const { f, e, W, trimHex } = g, depth = 0.42, h = 0.48, over = 0.08;
  const u0 = Math.min(f, f + e * depth), u1 = Math.max(f, f + e * depth);
  s.box(u0, u1, -W / 2 - over, W / 2 + over, top - h, top + 0.05, 'trim', trimHex);
  rectDecal(s, f, e, -W / 2, W / 2, top - h - 0.34, top - h - 0.06, trimHex);
  for (const side of [-1, 1]) rectDecal(s, f, e, side < 0 ? -W / 2 : W / 2 - 0.3, side < 0 ? -W / 2 + 0.3 : W / 2, -1.6, top - h - 0.06, trimHex);
}

/** White barge boards along the sloped edges of a plain triangular or trapezoid gable end. */
export function vergeBoards(s: RoofSink, f: number, e: number, edges: ReadonlyArray<[V2, V2]>, hex: string, bw = 0.22): void {
  for (const [a, b] of edges) outlineBand(s, [a, b], f, e, bw, hex);
}
