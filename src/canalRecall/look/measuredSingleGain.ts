/**
 * Measured walls without the second cell gain (lane landmarks-next, 2026-11-16; flag `?measuredSingleGain=1`,
 * MEASURED_SINGLE_GAIN=1, default off).
 *
 * A measured brick/accent tint is divided by the brick cell mean (palette.ts `cityMeasuredWallTint`, / 225/255) and a
 * measured stone tint by the stone cell mean (`cityMeasuredStoneTint`, / 228/255), "so cell x tint lands on the authored
 * colour". But the slot layer already gains its cell to a lit mean of 1 (cityLook.ts SLOT_LAYERS: brick `LIFT` =
 * 255/225, stone `STONE_GAIN` = 255/228), so lit, the drawn colour is the measured hex x ~1.13. On, the divide is
 * skipped for measured brick, accent and stone (the brick L floor stays); off, every tint is byte-identical.
 * Glass and roofs are not touched (their cells carry no such layer gain). SUNNY_EXPOSURE is not touched.
 */
export const MEASURED_SINGLE_GAIN_DEFAULT_ON = false;
export function measuredSingleGainEnabled(search?: string | null, env?: string | null): boolean {
  const v = (search ? /[?&]measuredSingleGain=([01])\b/.exec(search)?.[1] : undefined) ?? env ?? undefined;
  return v === '1' ? true : v === '0' ? false : MEASURED_SINGLE_GAIN_DEFAULT_ON;
}
let cached: boolean | undefined;
export function measuredSingleGainOn(): boolean {
  if (cached !== undefined) return cached;
  const g = globalThis as { location?: { search?: string }; process?: { env?: Record<string, string | undefined> } };
  return (cached = measuredSingleGainEnabled(g.location?.search ?? null, g.process?.env?.MEASURED_SINGLE_GAIN ?? null));
}
export const resetMeasuredSingleGain = () => { cached = undefined; };
