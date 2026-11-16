/**
 * A pand's street front height from AHN (lane D round 6): the DSM cells within FRONT_BAND_M of the front line (RD metres)
 * over the median DTM ground. `p90` stands for the front's wall top (cornice, or the gable's upper reach); `max` for a
 * gable's apex at the front. Pure: no fs, no DOM.
 */
export interface AhnFront { n: number; p50: number; p90: number; max: number }
export const FRONT_BAND_M = 1.5;
/** Fewer band cells than this is no measurement (a sliver of a front, or a footprint off the street). */
export const AHN_FRONT_MIN_CELLS = 8;
const q = (xs: number[], p: number) => { const s = [...xs].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };

export function frontBandHeights(cells: ReadonlyArray<readonly [number, number, number]>, ground: readonly number[], a: readonly [number, number], b: readonly [number, number], bandM = FRONT_BAND_M): AhnFront | null {
  const g = ground.filter(Number.isFinite);
  if (g.length < 8) return null;
  const g0 = q(g, 0.5), dx = b[0] - a[0], dy = b[1] - a[1], L2 = dx * dx + dy * dy;
  if (!(L2 > 0)) return null;
  const band: number[] = [];
  for (const [x, y, z] of cells) {
    if (!Number.isFinite(z)) continue;
    const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / L2));
    if (Math.hypot(x - a[0] - t * dx, y - a[1] - t * dy) <= bandM) band.push(z - g0);
  }
  if (band.length < AHN_FRONT_MIN_CELLS) return null;
  const r = (v: number) => +v.toFixed(2);
  return { n: band.length, p50: r(q(band, 0.5)), p90: r(q(band, 0.9)), max: r(Math.max(...band)) };
}
