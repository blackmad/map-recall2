// Time hysteresis on landmark level swaps (desktop-perf 2026-11-27).
//
// chooseLandmarkLevel (landmarkLod.ts) already has size hysteresis, but a ride that weaves (a bend, a bridge crest, the
// camera's lag) still flips a model full → lod1 → full within seconds, and every flip loads, parses, compiles and welds
// a level (the ride showed 178-415 stand-in welds a minute). A downgrade now waits until the level on screen has been
// there LEVEL_DWELL_MS; an upgrade (more detail) never waits, so the model on screen is never coarser than before.
// `?levelDwell=0` (or `__canalRecallLevelDwell = false`) swaps as soon as the size rule says; `?levelDwellMs=` tunes it.

export const LEVEL_DWELL_MS = 4000;
const DETAIL: Record<string, number> = { full: 2, lod1: 1, lod2: 0 };

/** Whether a swap from `current` (on since `since`, ms) to `wanted` may go now. */
export function levelSwapDue(current: string, wanted: string, since: number | undefined, now: number, dwellMs = LEVEL_DWELL_MS): boolean {
  if (wanted === current) return false;
  if ((DETAIL[wanted] ?? 2) > (DETAIL[current] ?? 2)) return true;
  return since === undefined || now - since >= dwellMs;
}

/** The page's dwell in ms (0: off). */
export function levelDwellMs(search = typeof location !== 'undefined' ? location.search : '', global: unknown = (globalThis as { __canalRecallLevelDwell?: unknown }).__canalRecallLevelDwell): number {
  if (global === false) return 0;
  if (/[?&]levelDwell=(0|false|off)\b/.test(search)) return 0;
  const ms = Number(/[?&]levelDwellMs=(\d+)/.exec(search)?.[1]);
  return Number.isFinite(ms) ? ms : LEVEL_DWELL_MS;
}
