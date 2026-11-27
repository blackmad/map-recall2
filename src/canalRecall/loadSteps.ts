/**
 * Loading steps for the ride heartbeat (iPhone start memory, 2026-11-27). Sentry CANAL-RECALL-V reported tabs that
 * died ~10 s into loading with `phase=loading` and nothing else: the heartbeat could not say which step was running.
 * Each step the start completes is pushed onto one page global, `window.__canalRecallLoadSteps`, as
 * `[name, ms since navigation]`, and a `canal-load-step` event lets monitoring.ts stamp the heartbeat at once (a tab
 * killed between two 5 s beats would otherwise lose up to five seconds of steps).
 *
 * The legacy scripts (game-route.js) cannot import this bundle and push the same pair themselves; the format below is
 * the contract.
 */
export const LOAD_STEPS_KEY = '__canalRecallLoadSteps';
export const LOAD_STEP_EVENT = 'canal-load-step';
/** Steps kept on the page (the oldest go first; a ride start marks ~20). */
export const LOAD_STEPS_MAX = 64;
/** Steps the heartbeat carries, newest last. */
export const LOAD_STEPS_REPORTED = 10;

export type LoadStep = [name: string, atMs: number];
type Scope = { [LOAD_STEPS_KEY]?: LoadStep[]; dispatchEvent?: (e: Event) => boolean; performance?: { now(): number } };

/** Record that `name` has completed now. Never throws. */
export function markLoadStep(name: string, scope: Scope = globalThis as Scope): void {
  try {
    const steps = (scope[LOAD_STEPS_KEY] ??= []);
    steps.push([name, Math.round(scope.performance?.now() ?? 0)]);
    if (steps.length > LOAD_STEPS_MAX) steps.splice(0, steps.length - LOAD_STEPS_MAX);
    if (typeof Event === 'function') scope.dispatchEvent?.(new Event(LOAD_STEP_EVENT));
  } catch { /* a page half torn down */ }
}

/** The heartbeat's view: the last completed step, when (s since navigation), and the recent trail `name@s,…`. */
export function loadStepSummary(steps: readonly LoadStep[] | null | undefined, n = LOAD_STEPS_REPORTED): { step?: string; stepAtS?: number; steps?: string } {
  if (!Array.isArray(steps) || !steps.length) return {};
  const valid = steps.filter(s => Array.isArray(s) && typeof s[0] === 'string' && Number.isFinite(s[1]));
  if (!valid.length) return {};
  const [name, at] = valid[valid.length - 1];
  const sec = (ms: number) => Math.round(ms / 100) / 10;
  return { step: name, stepAtS: sec(at), steps: valid.slice(-n).map(([s, t]) => `${s}@${sec(t)}`).join(',') };
}
