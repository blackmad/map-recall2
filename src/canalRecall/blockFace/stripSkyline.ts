/**
 * Skyline of one pand on the rectified strip (buurt auto-placement, 2026-10-16): per pixel column the top of the
 * building (the first row from the top, below a run of sky, where `run` consecutive rows are not sky), then
 *   - the eaves line: a low percentile of the column tops (a crown over part of the front, a dormer or a chimney stands
 *     higher; the cornice is what most columns end on),
 *   - the crown: the columns standing more than `crownMinM` over that line, as one span (its width, rise over the eaves,
 *     and the width of its top within 0.3 m of the peak: a flat dormer is wide at its top, a step or neck gable narrow),
 *   - confidence: the share of columns whose top was found under clean sky (trees, a grey placeholder or a cut-off
 *     strip lower it).
 * Sky is light and unsaturated (overcast) or blue-dominant and light (clear), or the strip's grey placeholder.
 */
import {rgbToHsl, type Rgb} from './wallColour.ts';

export interface Skyline {
  /** Eaves line, m above the strip ground, and the strip row of it. */
  eavesM: number; eavesRow: number;
  /** Share of the columns with a top under clean sky. */
  confidence: number;
  crown: {widthM: number; riseM: number; topWidthM: number; centre: number} | null;
}

export const SKYLINE = {run: 6, crownMinM: 0.6, eavesPercentile: 0.3, minTopM: 4} as const;

export function isSky(p: Rgb): boolean {
  if (Math.abs(p[0] - 128) <= 2 && Math.abs(p[1] - 128) <= 2 && Math.abs(p[2] - 128) <= 2) return true;
  const [, s, l] = rgbToHsl(p);
  return (l > 0.72 && s < 0.25) || (l > 0.55 && p[2] > p[0] + 12 && p[2] > p[1]);
}

export function measureSkyline(a: {rgb: Uint8Array; width: number; height: number; x0: number; x1: number; pixelsPerMetre: number}): Skyline | null {
  const {rgb, width, height, pixelsPerMetre: ppm} = a, inset = Math.round((a.x1 - a.x0) * 0.04);
  const xa = Math.max(0, a.x0 + inset), xb = Math.min(width, a.x1 - inset);
  if (xb - xa < 10) return null;
  const tops: number[] = [], clean: boolean[] = [];
  for (let x = xa; x < xb; x++) {
    let solid = 0, top = -1, skyAbove = 0;
    for (let y = 0; y < height; y++) {
      const i = (y * width + x) * 3, sky = isSky([rgb[i], rgb[i + 1], rgb[i + 2]]);
      if (sky) { solid = 0; skyAbove++; continue; }
      if (++solid >= SKYLINE.run) { top = y - SKYLINE.run + 1; break; }
    }
    const m = top < 0 ? 0 : (height - top) / ppm;
    tops.push(m); clean.push(top > 0 && skyAbove >= Math.min(top, 0.5 * ppm) && m >= SKYLINE.minTopM);
  }
  const good = tops.filter((_, k) => clean[k]).sort((p, q) => p - q);
  const confidence = +(good.length / tops.length).toFixed(2);
  if (good.length < tops.length * 0.3) return {eavesM: 0, eavesRow: height, confidence, crown: null};
  const eavesM = good[Math.floor(good.length * SKYLINE.eavesPercentile)];
  // Crown: the widest run of clean columns over the line (gaps of up to 0.2 m bridged).
  const over = tops.map((t, k) => clean[k] && t > eavesM + SKYLINE.crownMinM);
  let best: [number, number] | null = null, start = -1, gap = 0;
  for (let k = 0; k <= over.length; k++) {
    if (k < over.length && over[k]) { if (start < 0) start = k; gap = 0; continue; }
    if (start >= 0 && k < over.length && ++gap <= 0.2 * ppm) continue;
    if (start >= 0) { const end = k - gap; if (!best || end - start > best[1] - best[0]) best = [start, end]; }
    start = -1; gap = 0;
  }
  let crown: Skyline['crown'] = null;
  if (best && best[1] - best[0] >= 0.5 * ppm) {
    const seg = tops.slice(best[0], best[1]), peak = Math.max(...seg);
    crown = {widthM: +((best[1] - best[0]) / ppm).toFixed(2), riseM: +(peak - eavesM).toFixed(2), topWidthM: +(seg.filter(t => t >= peak - 0.3).length / ppm).toFixed(2),
      centre: +(((best[0] + best[1]) / 2) / tops.length).toFixed(2)};
  }
  return {eavesM: +eavesM.toFixed(2), eavesRow: Math.round(height - eavesM * ppm), confidence, crown};
}
