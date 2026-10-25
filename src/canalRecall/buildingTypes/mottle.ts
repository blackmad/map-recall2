/**
 * Mottled multi-tone brick (issue #77). Some post-2000 terraces are laid in a blend of bricks: K-buurt-Zuidwest's upper
 * storeys mix grey, grey-brown, purple-brown and red-brown stretchers. One flat tint draws that wall as a dull dark brown;
 * the look of the wall is the speckle. A wall `SlotTint` may carry `mottle: {tones}`: the brick tones measured from sunlit
 * crops (k-means over the wall's brick pixels) with their shares. The tint stays the wall's mean colour; the runtime brick
 * cell (look/slotCells.ts `paintMottledBrickCanvas`) gives each brick of its bond one tone, as a ratio to the share-weighted
 * mean, so the wall averages to its tint and only the brick-to-brick variation is added. No triangles, no extra materials:
 * one brick cell per distinct mottle. Absent, specs, GLBs and the look are unchanged.
 *
 * Pure: measurement, ratios, per-brick assignment and the cell gain are tested in buildingTypes.test.ts.
 */
export type Rgb = [number, number, number];
export interface MottleTone { hex: string; share: number }
export interface Mottle {
  /** Brick tones (#rrggbb) and their shares of the wall's bricks; shares sum to 1. */
  tones: MottleTone[];
  /** Where the tones were measured (crops, boxes). */
  evidence?: string;
}

const hexOf = (c: readonly number[]) => `#${c.map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')}`;
export const rgbOf = (hex: string): Rgb => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)) as Rgb;
/** Weight of the chroma axes against luma when clustering brick pixels. */
export const CHROMA_WEIGHT = 2.5;
const luma = (c: readonly number[]) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];

export function validateMottle(m: Mottle): string[] {
  const errors: string[] = [];
  if (!Array.isArray(m.tones) || m.tones.length < 2 || m.tones.length > 6) errors.push('mottle needs 2-6 tones');
  for (const t of m.tones ?? []) {
    if (!/^#[0-9a-f]{6}$/i.test(t.hex)) errors.push(`mottle tone ${t.hex} is not #rrggbb`);
    if (!(t.share > 0)) errors.push(`mottle tone ${t.hex}: share must be > 0`);
  }
  const sum = (m.tones ?? []).reduce((s, t) => s + t.share, 0);
  if (Math.abs(sum - 1) > 0.02) errors.push(`mottle shares sum to ${sum.toFixed(3)}, not 1`);
  return errors;
}

/** Stable key of a mottle (material identity, texture cache): tones in order with shares to 2 decimals. */
export const mottleKey = (m: Mottle) => m.tones.map(t => `${t.hex.toLowerCase()}:${t.share.toFixed(2)}`).join(',');

/** Share-weighted mean of the tones (sRGB bytes). */
export function mottleMean(m: Mottle): Rgb {
  const out: Rgb = [0, 0, 0];
  for (const t of m.tones) { const c = rgbOf(t.hex); for (let i = 0; i < 3; i++) out[i] += c[i] * t.share; }
  return out;
}

/** Per-tone per-channel ratio to the share-weighted mean: the multiplier a brick of that tone applies to the neutral cell. */
export function mottleRatios(m: Mottle): Rgb[] {
  const mean = mottleMean(m);
  return m.tones.map(t => rgbOf(t.hex).map((v, i) => (mean[i] > 0 ? v / mean[i] : 1)) as Rgb);
}

/**
 * Cell gain: the neutral brick cell is lifted to a mean of ~`base`; a brick of ratio > 255/base would clip. The mottled cell
 * is painted at `gain` (<= 1) so the brightest tone fits, and the material tint is divided by it (sRGB product) to keep the mean.
 */
export function mottleGain(ratios: readonly Rgb[], base = 225, ceiling = 250): number {
  const max = Math.max(1, ...ratios.flat());
  return Math.min(1, ceiling / (base * max));
}

/** Deterministic hash in [0, 1) of a brick's (course, index) in the cell. */
export function brickHash(course: number, index: number, seed = 0): number {
  let h = (course * 374761393 + index * 668265263 + seed * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/**
 * Tone index of each brick in a cell of `courses` x `perCourse` bricks: the counts follow the shares exactly (largest
 * remainder), the order is a hash shuffle, so a cell (and the wall that repeats it) carries the measured mix.
 */
export function assignBrickTones(m: Mottle, courses: number, perCourse: number, seed = 1): number[][] {
  const total = courses * perCourse, raw = m.tones.map(t => t.share * total), counts = raw.map(Math.floor);
  let left = total - counts.reduce((a, b) => a + b, 0);
  for (const i of raw.map((r, i) => [r - Math.floor(r), i]).sort((a, b) => b[0] - a[0]).map(x => x[1])) { if (left <= 0) break; counts[i]++; left--; }
  const pool: number[] = counts.flatMap((n, i) => Array.from({length: n}, () => i));
  const order = pool.map((_, j) => ({j, h: brickHash(Math.floor(j / perCourse), j % perCourse, seed)})).sort((a, b) => a.h - b.h);
  const out = Array.from({length: courses}, () => new Array<number>(perCourse).fill(0));
  order.forEach(({j}, k) => { out[Math.floor(j / perCourse)][j % perCourse] = pool[k]; });
  return out;
}

/**
 * Brick tones of a wall from photo pixels (a sunlit crop box that is mostly brick): drops openings and shadow (luma under
 * `darkShare` x the median), pale trim and sky (over `brightShare` x the median, or blue-dominant), then k-means (k tones)
 * seeded on the luma-sorted pixels. Returns the tones by share and their mean (the wall tint).
 */
export function measureMottle(px: readonly Rgb[], k = 4, darkShare = 0.55, brightShare = 1.6): {mean: string; tones: MottleTone[]; kept: number} {
  const lumas = px.map(luma).sort((a, b) => a - b), med = lumas[Math.floor(lumas.length / 2)] ?? 0;
  const kept = px.filter(p => { const l = luma(p); return l >= med * darkShare && l <= med * brightShare && !(p[2] > p[0] + 18 && p[2] > p[1] + 6); });
  if (kept.length < k * 10) throw new Error(`measureMottle: ${kept.length} brick pixels`);
  // Cluster in an opponent space (luma, red-green, yellow-blue) with the chroma axes weighted up: in RGB the brick-to-brick
  // spread is mostly lightness and k-means splits a grey/purple/red blend into lightness bands only.
  const f = (p: Rgb) => [luma(p), CHROMA_WEIGHT * (p[0] - p[1]), CHROMA_WEIGHT * ((p[0] + p[1]) / 2 - p[2])];
  const feats = kept.map(f), order = feats.map((q, i) => i).sort((a, b) => feats[a][0] - feats[b][0]);
  let cs = Array.from({length: k}, (_, i) => [...feats[order[Math.floor((i + 0.5) * order.length / k)]]]);
  let counts = new Array(k).fill(0), rgbSum = cs.map(() => [0, 0, 0]);
  for (let it = 0; it < 25; it++) {
    const sum = cs.map(() => [0, 0, 0]); counts = new Array(k).fill(0); rgbSum = cs.map(() => [0, 0, 0]);
    feats.forEach((q, j) => {
      let b = 0, bd = Infinity;
      for (let i = 0; i < k; i++) { const d = (q[0] - cs[i][0]) ** 2 + (q[1] - cs[i][1]) ** 2 + (q[2] - cs[i][2]) ** 2; if (d < bd) { bd = d; b = i; } }
      counts[b]++; for (let c = 0; c < 3; c++) { sum[b][c] += q[c]; rgbSum[b][c] += kept[j][c]; }
    });
    cs = cs.map((c, i) => (counts[i] ? sum[i].map(v => v / counts[i]) : c));
  }
  const centres = rgbSum.map((s3, i) => s3.map(v => v / Math.max(1, counts[i])));
  const tones = centres.map((c, i) => ({hex: hexOf(c), share: counts[i] / kept.length})).filter(t => t.share > 0).sort((a, b) => b.share - a.share);
  // Shares to 2 decimals, summing to 1 (the largest takes the rounding).
  const rounded = tones.map(t => ({hex: t.hex, share: Math.round(t.share * 100) / 100}));
  rounded[0].share = +(1 - rounded.slice(1).reduce((s, t) => s + t.share, 0)).toFixed(2);
  const mean = [0, 1, 2].map(c => kept.reduce((s, p) => s + p[c], 0) / kept.length);
  return {mean: hexOf(mean), tones: rounded, kept: kept.length};
}
