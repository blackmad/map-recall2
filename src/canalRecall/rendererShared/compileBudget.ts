/**
 * Shader warm-up spread over frames (Sentry CANAL-RECALL-7 / -J / -N, Firefox Mobile 159 on Android 17,
 * 2026-10-29). The own ground precompiles every program a cell can use in its first frame, which on a phone
 * is ~21 three.js program links in one task (measured 2026-10-29, scripts/gpu-startup-timeline.mjs, the
 * guest briefing behind the Rijksmuseum boat start), on top of MapLibre's own ~16. That phone lost its GPU
 * process at 7.8 s, and again 1.4 s after the context came back, mid-compile, as the same burst re-ran on
 * restore (2 -> 22 programs). Desktop compiles everything at once, as before.
 *
 * Pure: the caller hands over the compile step and a program counter (`renderer.info.programs.length`).
 */

/** New programs a touch device links per warm-up step. */
export const TOUCH_PRECOMPILE_PROGRAMS_PER_FRAME = 2;
/**
 * Least time between two warm-up steps, ms. Per frame alone is not a spread on a fast phone (60 fps put 14 links
 * in 100 ms in the measurement); this makes the ~21 ground programs take about half a second wherever it runs.
 */
export const PRECOMPILE_STEP_MS = 50;

/** Is a warm-up step due? The first always is. */
export function precompileStepDue(now: number, lastStep: number | null, stepMs = PRECOMPILE_STEP_MS): boolean {
  return lastStep == null || now - lastStep >= stepMs;
}

/**
 * Compile `items` from `start` until `budget` new programs have been linked (by `programs()`), or the list ends.
 * Returns the index to resume from next frame (`items.length` when done). An item already cached costs nothing
 * and the walk goes on; the item that crosses the budget is kept compiled, so each call makes progress.
 */
export function compileWithinBudget<T>(items: readonly T[], start: number, budget: number, compile: (item: T) => void, programs: () => number): number {
  const before = programs();
  let i = start;
  while (i < items.length) {
    compile(items[i++]);
    if (programs() - before >= budget) break;
  }
  return i;
}

/**
 * Programs per frame for the warm-up: `Infinity` (one compile, the desktop behaviour) unless this is a touch device.
 * `?precompile=N` (or `window.__canalRecallPrecompile`) overrides it; `all` or 0 restores the single burst.
 */
export function precompileBudget(env: { coarse?: boolean; asked?: string | number | null } = browserEnv()): number {
  const asked = env.asked == null || env.asked === '' ? null : env.asked;
  if (asked === 'all') return Infinity;
  if (asked != null) {
    const n = Number(asked);
    if (Number.isFinite(n) && n >= 0) return n === 0 ? Infinity : Math.max(1, Math.floor(n));
  }
  return env.coarse ? TOUCH_PRECOMPILE_PROGRAMS_PER_FRAME : Infinity;
}

function browserEnv(): { coarse?: boolean; asked?: string | number | null } {
  const g = globalThis as { __canalRecallPrecompile?: string | number; matchMedia?: (query: string) => { matches: boolean }; location?: { search?: string } };
  let asked: string | number | null = g.__canalRecallPrecompile ?? null;
  if (asked == null && g.location?.search) { try { asked = new URLSearchParams(g.location.search).get('precompile'); } catch { asked = null; } }
  return { coarse: !!g.matchMedia?.('(pointer: coarse)')?.matches, asked };
}
