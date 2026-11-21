/**
 * A Jugendstil sweep gable (belt kit roofs lane, 2026-11-21; Herengracht 74, 0363100012175616). The kit drew 74's crown as
 * a classic bell with two small round lights; the photo shows a broad gable whose top runs nearly flat across the front,
 * swept down on one side in a quarter round to a low ledge, a stone pier at that end and a pinnacle at the other, and one
 * wide three-light window whose head follows the sweep (its light nearest the curve round-headed).
 *
 * The outline, x across the front (-W/2..W/2 as seen from the street, the viewer's left first), y over the foot:
 *   - the swept side: a low ledge from the front's edge to `startShare` of the front, an upright rise, then a quarter
 *     ellipse reaching the top at `topShare`;
 *   - the top: flat to the other edge (`side: 'both'`: swept on both sides, flat between).
 * The parts: a stone coping along the outline, a pier at each swept end (`pierM`: width and height over the foot) and a
 * pinnacle on each unswept end (`pinnacleM`: width and height over the top), and the window (`window`).
 *
 * Pure: the outline and the parts as outlines with their tone; crownProfile.ts draws them (RowCrown.sweep). Absent:
 * nothing here runs.
 */
import type { V2 } from '../roofSink.js';

export interface CrownSweep {
  /** The swept side as seen from the street. */
  side: 'left' | 'right' | 'both';
  /** Where the curve starts and where it reaches the top, as shares of the front from the swept edge. */
  startShare?: number;
  topShare?: number;
  /** The low ledge's height over the foot outside the curve (m). */
  ledgeM?: number;
  /** The quarter round's height as a share of the rise (the rest of the swept side rises upright). */
  roundShare?: number;
  /** A stone pier at each swept end: width and height over the foot (m). */
  pierM?: [number, number];
  /** A stone pinnacle on each unswept end: width and height over the top (m). */
  pinnacleM?: [number, number];
  /** The window under the sweep: its lights, its width as a share of the front, its head's gap under the top (m). */
  window?: { lights: number; widthShare?: number; headGapM?: number; /** The light nearest the sweep round-headed. */ archNearSweep?: boolean };
}

/** Herengracht 74's sweep, measured on the 2023 pano (W 5.1 m, rise 2.84 m): the curve from 0.2 to 0.43 of the front,
 *  its round 0.45 of the rise, a 0.4 x 0.82 m pier, a 0.45 x 0.55 m pinnacle, a three-light window 0.52 of the front
 *  wide, its head 1.0 m under the top, 0.15 of the front from the far edge. */
export const CROWN_SWEEP = { startShare: 0.2, topShare: 0.43, ledgeM: 0.12, roundShare: 0.45, pierM: [0.4, 0.82] as [number, number], pinnacleM: [0.45, 0.55] as [number, number],
  window: { widthShare: 0.52, headGapM: 1.0, margin: 0.15, sill: 0.1, frame: 0.08, bar: 0.05, transom: 0.8, inset: 0.55 }, coping: 0.16, seg: 12 } as const;

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** One swept side's outline from the front's edge at x = -h (left as seen) to where it reaches the top. */
function sweptSide(sw: CrownSweep, h: number, T: number): V2[] {
  const W = 2 * h, S = CROWN_SWEEP;
  const ledge = clamp(sw.ledgeM ?? S.ledgeM, 0.05, T * 0.3);
  const xs = -h + W * clamp(sw.startShare ?? S.startShare, 0.05, 0.45), xt = Math.max(xs + 0.3, -h + W * clamp(sw.topShare ?? S.topShare, 0.1, 0.5));
  const ry = (T - ledge) * clamp(sw.roundShare ?? S.roundShare, 0.15, 1), yk = T - ry, rx = xt - xs;
  const out: V2[] = [[-h, ledge], [xs, ledge]];
  if (yk > ledge + 1e-3) out.push([xs, yk]);
  for (let i = 1; i <= S.seg; i++) { const t = (i / S.seg) * Math.PI / 2; out.push([xt - rx * Math.cos(t), yk + ry * Math.sin(t)]); }
  return out;
}

/** The sweep's outline over a front `W` wide rising `T`, x never going back (the plate's single-valued outline). */
export function sweepOutline(sw: CrownSweep, W: number, T: number): V2[] {
  const h = W / 2, left = sweptSide(sw, h, T);
  const right = left.map(([x, y]): V2 => [-x, y]).reverse();
  const flatL: V2[] = [[-h, T]], flatR: V2[] = [[h, T]];
  const pts = [...(sw.side === 'right' ? flatL : left), ...(sw.side === 'left' ? flatR : right)];
  return [[-h, 0], ...pts, [h, 0]];
}

export type SweepPiece = { pts: V2[]; tone: 'stone' | 'coping' | 'glass' | 'frame'; proud: number; back: number };

/** The outline's height at x (its top crossing). */
function heightAt(prof: readonly V2[], x: number): number {
  let best = -Infinity;
  for (let i = 0; i < prof.length - 1; i++) {
    const [x0, y0] = prof[i], [x1, y1] = prof[i + 1];
    if ((x0 - x) * (x1 - x) > 0) continue;
    best = Math.max(best, Math.abs(x1 - x0) < 1e-9 ? Math.max(y0, y1) : y0 + ((x - x0) / (x1 - x0)) * (y1 - y0));
  }
  return best;
}

/** The sweep's parts as seen from the street (x as in sweepOutline). */
export function sweepParts(sw: CrownSweep, W: number, T: number): SweepPiece[] {
  const S = CROWN_SWEEP, h = W / 2, prof = sweepOutline(sw, W, T), out: SweepPiece[] = [];
  // The coping: a band just inside the outline along the swept edge and the top (not the uprights at the party walls).
  const cw = S.coping;
  for (let i = 1; i < prof.length - 2; i++) {
    const [x0, y0] = prof[i], [x1, y1] = prof[i + 1];
    const l = Math.hypot(x1 - x0, y1 - y0);
    if (l < 1e-4 || (Math.abs(x0) >= h - 1e-6 && Math.abs(x1) >= h - 1e-6)) continue;
    const nx = (y1 - y0) / l, ny = -(x1 - x0) / l; // points inward (below the outline) for an outline running left to right
    out.push({ pts: [[x0 - nx * 0.03, y0 - ny * 0.03], [x1 - nx * 0.03, y1 - ny * 0.03], [x1 + nx * cw, y1 + ny * cw], [x0 + nx * cw, y0 + ny * cw]], tone: 'coping', proud: 0.06, back: 0.3 });
  }
  // Piers at the swept ends, pinnacles on the unswept ones.
  const [pw, ph] = sw.pierM ?? S.pierM, [qw, qh] = sw.pinnacleM ?? S.pinnacleM;
  const ends: Array<[number, boolean]> = [[-1, sw.side !== 'right'], [1, sw.side !== 'left']];
  for (const [sg, swept] of ends) {
    const xo = sg * h, xi = sg * (h - (swept ? pw : qw));
    const [a, b] = sg < 0 ? [xo, xi] : [xi, xo];
    if (swept) {
      out.push({ pts: [[a, 0], [b, 0], [b, ph], [a, ph]], tone: 'stone', proud: 0.1, back: 0.35 });
      out.push({ pts: [[a - 0.04, ph], [b + 0.04, ph], [(a + b) / 2, ph + Math.min(0.25, pw * 0.6)]], tone: 'stone', proud: 0.12, back: 0.35 });
    } else {
      const z0 = Math.max(0, T - 1.2);
      out.push({ pts: [[a, z0], [b, z0], [b, T + qh], [a, T + qh]], tone: 'stone', proud: 0.1, back: 0.35 });
      out.push({ pts: [[a - 0.04, T + qh], [b + 0.04, T + qh], [(a + b) / 2, T + qh + Math.min(0.35, qw * 0.8)]], tone: 'stone', proud: 0.12, back: 0.35 });
    }
  }
  // The window: right of a left sweep (left of a right one, centred under two), its head the outline inset, in lights.
  const win = sw.window;
  if (win && win.lights >= 1) {
    const ww = W * clamp(win.widthShare ?? S.window.widthShare, 0.2, 0.8), m = W * S.window.margin;
    const x1 = sw.side === 'left' ? h - m : sw.side === 'right' ? -h + m + ww : ww / 2, x0 = x1 - ww;
    const z0 = S.window.sill, zTop = T - clamp(win.headGapM ?? S.window.headGapM, 0.3, T * 0.6);
    // The head: the outline offset inward by the inset (a disc rolled under it), so a light under the round takes an arch
    // concentric with it (74's left light) and the others stop flat at the head line.
    const dense: V2[] = [];
    for (let i = 0; i < prof.length - 1; i++) {
      const [x0, y0] = prof[i], [x1, y1] = prof[i + 1], n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 0.04));
      for (let k = 0; k < n; k++) dense.push([x0 + ((x1 - x0) * k) / n, y0 + ((y1 - y0) * k) / n]);
    }
    const r = S.window.inset, pitch = (x1 - x0) / win.lights;
    // The light nearest the sweep round-headed (Herengracht 74's left light), its crown on the head line.
    const arched = win.archNearSweep && sw.side !== 'both' ? (sw.side === 'left' ? 0 : win.lights - 1) : -1;
    const head = (x: number) => {
      let y = Math.min(zTop, heightAt(prof, x) - r);
      for (const [px, py] of dense) { const dx = x - px; if (Math.abs(dx) < r) y = Math.min(y, py - Math.sqrt(r * r - dx * dx)); }
      if (arched >= 0) {
        const la = x0 + pitch * arched, hw = pitch / 2, dx = x - (la + hw);
        if (Math.abs(dx) <= hw + 1e-9) y = Math.min(y, zTop - hw + Math.sqrt(Math.max(0, hw * hw - dx * dx)));
      }
      return y;
    };
    const fr = S.window.frame, n = 16;
    const strips = (a: number, b: number, grow: number, tone: SweepPiece['tone'], proud: number) => {
      for (let i = 0; i < n; i++) {
        const xa = a + ((b - a) * i) / n, xb = a + ((b - a) * (i + 1)) / n, ya = head(xa) + grow, yb = head(xb) + grow;
        if (ya - (z0 - grow) < 0.1 || yb - (z0 - grow) < 0.1) continue;
        out.push({ pts: [[xa, z0 - grow], [xb, z0 - grow], [xb, yb], [xa, ya]], tone, proud, back: 0 });
      }
    };
    if (zTop - z0 >= 0.6) {
      strips(x0 - fr, x1 + fr, fr, 'frame', 0.014);
      strips(x0, x1, 0, 'glass', 0.026);
      const bw = S.window.bar;
      for (let k = 1; k < win.lights; k++) {
        const xm = x0 + pitch * k, top = head(xm);
        out.push({ pts: [[xm - bw, z0], [xm + bw, z0], [xm + bw, top], [xm - bw, top]], tone: 'frame', proud: 0.03, back: 0 });
      }
      const zt = z0 + (zTop - z0) * S.window.transom;
      const tl = [x0, x1].map(x => Math.min(head(x), zt));
      if (zt < Math.min(...tl) + 1e-6) out.push({ pts: [[x0, zt - 0.03], [x1, zt - 0.03], [x1, zt + 0.03], [x0, zt + 0.03]], tone: 'frame', proud: 0.03, back: 0 });
      out.push({ pts: [[x0 - fr - 0.06, z0 - fr - 0.08], [x1 + fr + 0.06, z0 - fr - 0.08], [x1 + fr + 0.06, z0 - fr], [x0 - fr - 0.06, z0 - fr]], tone: 'stone', proud: 0.04, back: 0.05 });
    }
  }
  return out;
}

/** The saddle's rise behind a sweep: under the outline everywhere (0.1 m clear), at least 0.2 m. */
export function sweepRoofRise(sw: CrownSweep, W: number, T: number): number {
  const h = W / 2;
  let R = T - 0.2;
  for (const [x, y] of sweepOutline(sw, W, T)) if (Math.abs(x) < h - 1e-6 && y > 0) R = Math.min(R, (y - 0.1) / (1 - Math.abs(x) / h));
  return Math.round(Math.max(0.2, R) * 1000) / 1000;
}
