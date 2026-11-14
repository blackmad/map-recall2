// The house-rows flag on its own, for modules that must not pull the renderer in (landmarks/ordinaryChunks.ts: a
// chunk's ROW_FRONT variant). On by default since the round-1 install (2026-11-15): the published records
// (public/data/front-records/row-front.json, signed-off rows only) draw with no flag; `?rowFront=0` / ROW_FRONT=0 turn
// every row off. Node scripts and tests that compare against the flag-off world set ROW_FRONT=0.
export const ROW_FRONT_DEFAULT = true;
export function rowFrontEnabled(search?: string | null, env?: string | null): boolean {
  const q = search ? /[?&]rowFront=([01])\b/.exec(search)?.[1] : undefined;
  const v = q ?? (env === '0' || env === '1' ? env : undefined);
  return v === undefined ? ROW_FRONT_DEFAULT : v === '1';
}
/** The flag as this page or process states it. */
export function rowFrontFlagNow(): boolean {
  const g = globalThis as { location?: { search?: string }; process?: { env?: Record<string, string | undefined> } };
  return rowFrontEnabled(g.location?.search ?? null, g.process?.env?.ROW_FRONT ?? null);
}
