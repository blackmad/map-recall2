// Retail fit (lane retail-fit-20261120): tenants drawn inside a placed model's own openings.
// Modes: 'published' (default) draws the reads whose blind A/B was won; `?retailFit=1` (env RETAIL_FIT=1) also draws
// staged reads for review; `?retailFit=0` draws nothing, and then every frame is byte-identical to the pre-fit game.
export type RetailFitMode = 'off' | 'published' | 'all';
export const RETAIL_FIT_DEFAULT: RetailFitMode = 'published';
export function retailFitModeOf(search?: string | null, env?: string | null): RetailFitMode {
  const q = search ? /[?&]retailFit=([01])\b/.exec(search)?.[1] : undefined;
  const v = q ?? (env === '0' || env === '1' ? env : undefined);
  return v === undefined ? RETAIL_FIT_DEFAULT : v === '1' ? 'all' : 'off';
}
/** Back-compatible boolean: is any fit drawn? */
export const retailFitEnabled = (search?: string | null, env?: string | null): boolean => retailFitModeOf(search, env) !== 'off';
let cached: RetailFitMode | undefined;
/** The mode for this page or process (a test may set `__canalRecallRetailFit` to a mode or a boolean). */
export function retailFitMode(): RetailFitMode {
  const g = globalThis as { __canalRecallRetailFit?: boolean | RetailFitMode; location?: { search?: string }; process?: { env?: Record<string, string | undefined> } };
  const o = g.__canalRecallRetailFit;
  if (typeof o === 'boolean') return o ? 'all' : 'off';
  if (o === 'off' || o === 'published' || o === 'all') return o;
  return (cached ??= retailFitModeOf(g.location?.search ?? null, g.process?.env?.RETAIL_FIT ?? null));
}
export const retailFitOn = (): boolean => retailFitMode() !== 'off';
