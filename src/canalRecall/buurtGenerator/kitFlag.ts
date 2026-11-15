/**
 * Buurt generator kit flag (docs/handoffs/buurt-generators-20261115.md): the district window presets the generator's
 * rows need (bayLook.ts BAY_STYLES.school's Plan Zuid casement). Off by default: the presets are appended to the bay
 * table only with the flag on, so the layer table, the atlas and the baked shells' layer hash are byte-identical without
 * it (the newbuildFamily pattern, contemporaryFamily.ts). `?buurtKit=1` in the page, BUURT_KIT=1 in Node; a test or
 * harness may set `globalThis.__canalRecallBuurtKit`.
 */
export function buurtKitEnabled(): boolean {
  const g = globalThis as { __canalRecallBuurtKit?: boolean; location?: { search?: string }; process?: { env?: Record<string, string | undefined> } };
  if (typeof g.__canalRecallBuurtKit === 'boolean') return g.__canalRecallBuurtKit;
  try {
    const q = new URLSearchParams(g.location?.search ?? '').get('buurtKit');
    if (q !== null) return q === '1';
  } catch { /* no location */ }
  return g.process?.env?.BUURT_KIT === '1';
}
