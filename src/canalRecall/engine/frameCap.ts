// The ride's frame cap (desktop-perf lane, 2026-11-27, question 5 "the game runs my Mac fan"). A 120 Hz display gave the
// own engine 120 animation frames a second and it ran the whole frame, game and GPU, on every one: measured at dpr 2 on
// the M4 Pro (docs/perf/desktop-power-20261127.md) a steady ride drew ~100+ frames a second for ~3.4 CPU cores and
// ~550 ms of GPU work a second. Capped at 60 the same ride does about half of each.
//
// A credit clock, not a minimum interval: each animation frame earns (its interval × maxFps) credit, a run costs one.
// 120 Hz runs every other frame (an even 60), 90 Hz alternates one and two frames (60 on average), 144 Hz runs 3 of
// every 7 or so, and 60 Hz and slower run every frame. A minimum interval with slack read 90 Hz as 45 fps.
//
// `?fpsCap=0` (or the player's "Full frame rate" setting) runs every frame; `?fpsCap=<n>` caps at n.

/** The default cap: frames a second the ride draws on any display faster than this. */
export const DEFAULT_FPS_CAP = 60;
/** Timestamp jitter: a frame whose credit is this close to one still runs (120 Hz stamps are 8.3 ± ~0.5 ms). */
const CREDIT_SLACK = 0.1;

export class FrameCap {
  private credit = 1;
  private lastT: number | null = null;

  /** Should the animation frame at `t` (ms) run under `maxFps` (null or ≤ 0: every frame)? Call once per frame. */
  admit(t: number, maxFps: number | null | undefined): boolean {
    const last = this.lastT;
    this.lastT = t;
    if (!maxFps || !(maxFps > 0)) { this.credit = 1; return true; }
    // A first frame, a stall or a clock jump: run, and start a fresh budget.
    if (last == null || !(t > last) || t - last > 250) { this.credit = 0; return true; }
    // Up to 1.5 banked: 90 Hz earns 0.67 a frame and must carry the 0.33 over a run, or it reads as 45 fps.
    this.credit = Math.min(1.5, this.credit + (t - last) / 1000 * maxFps);
    if (this.credit < 1 - CREDIT_SLACK) return false;
    this.credit = Math.max(-0.5, this.credit - 1);
    return true;
  }
}

/** `?fpsCap=`: a number > 0 caps, `0`/`off` runs every frame (null), absent or unreadable is undefined. */
export function fpsCapFromQuery(search: string): number | null | undefined {
  let asked: string | null = null;
  try { asked = new URLSearchParams(search).get('fpsCap'); } catch { asked = null; }
  if (asked == null || asked === '') return undefined;
  const n = Number(asked);
  if (asked === 'off' || n === 0) return null;
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

/**
 * The cap in force: the query's (fpsCapFromQuery) wins, then the page global the game sets from the player's setting
 * (`__canalRecallFpsCap`: a number, 0 = full frame rate), else DEFAULT_FPS_CAP. Cheap: read every frame.
 */
export function fpsCap(fromQuery: number | null | undefined, global: unknown): number | null {
  if (fromQuery !== undefined) return fromQuery;
  if (typeof global === 'number' && Number.isFinite(global)) return global > 0 ? global : null;
  return DEFAULT_FPS_CAP;
}
