/**
 * Post-1965 housing kit flag (kit.ts). On by default since round 5 of lane postwar-housing-kit-20261120 (clean blind
 * 11 wins, 4 losses, 5 ties, no kit regression; docs/reports/postwar-kit-20261120.md). Off: `?postwarKit=0` in the page
 * (forwarded to the chunk worker, engine/workerPool.ts), POSTWAR_KIT=0 in Node; a test or harness may set
 * `globalThis.__canalRecallPostwarKit`. Off, the wall components are not even in the registry (facadeExtras.ts), so
 * every building is byte-identical to before the kit. The baked world-v1 cells need a recompile to carry it.
 */
export function postwarKitEnabled(): boolean {
  const g = globalThis as { __canalRecallPostwarKit?: boolean; location?: { search?: string }; process?: { env?: Record<string, string | undefined> } };
  if (typeof g.__canalRecallPostwarKit === 'boolean') return g.__canalRecallPostwarKit;
  try {
    const q = new URLSearchParams(g.location?.search ?? '').get('postwarKit');
    if (q !== null) return q !== '0';
  } catch { /* no location */ }
  return g.process?.env?.POSTWAR_KIT !== '0';
}
