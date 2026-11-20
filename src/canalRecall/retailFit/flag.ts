// `?retailFit=1` (env RETAIL_FIT=1): tenants drawn inside a placed model's own openings (lane retail-fit-20261120).
// Default off until a blind photo review wins; off, nothing is added to any model and every frame is byte-identical.
export const RETAIL_FIT_DEFAULT = false;
export function retailFitEnabled(search?: string | null, env?: string | null): boolean {
  const q = search ? /[?&]retailFit=([01])\b/.exec(search)?.[1] : undefined;
  const v = q ?? (env === '0' || env === '1' ? env : undefined);
  return v === undefined ? RETAIL_FIT_DEFAULT : v === '1';
}
let cached: boolean | undefined;
/** The flag for this page or process (a test may set `__canalRecallRetailFit`). */
export function retailFitOn(): boolean {
  const g = globalThis as { __canalRecallRetailFit?: boolean; location?: { search?: string }; process?: { env?: Record<string, string | undefined> } };
  if (typeof g.__canalRecallRetailFit === 'boolean') return g.__canalRecallRetailFit;
  return (cached ??= retailFitEnabled(g.location?.search ?? null, g.process?.env?.RETAIL_FIT ?? null));
}
