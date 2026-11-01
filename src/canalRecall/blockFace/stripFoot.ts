/**
 * The facade foot on a rectified strip (#157 fix 5). The strip's bottom row is its ground estimate (camera height over
 * NAP) and the model stands on that row. On the Tugelaweg 2020-04-29 strips the pavement runs 0.6-1.8 m up the strip
 * under the 1929 blocks, so the model's storeys sit that much below the photo's and the edge NCC of the right type read
 * 0.07-0.13 (a lower frontEavesM was worse).
 *
 * The foot is read as the pavement line: per row of the span (inset columns) the median and the inter-quartile range of
 * luma; a row is pavement-like when its IQR is small (paving is even, a facade has openings, joints and frames). The
 * foot is the highest row where (a) the row medians step by at least `minStep` between the `bandM` above and below it
 * (a plinth, the wall or a door sill over the paving) and (b) the rows from it down to the strip's bottom are paving
 * (median row IQR under `pavingIqr`). Under `minM` it reads as none: offset 0, the comparison is as before.
 */
export const FACADE_FOOT = {maxM: 2.4, bandM: 0.2, minStep: 15, pavingIqr: 16, minM: 0.4, insetShare: 0.06} as const;

export interface FootReading { offsetM: number; row: number | null; step: number; pavingIqr: number | null }

export function measureFacadeFoot(a: {rgb: Uint8Array; width: number; height: number; x0: number; x1: number; pixelsPerMetre: number}): FootReading {
  const {rgb, width, height, pixelsPerMetre: ppm} = a, inset = Math.round((a.x1 - a.x0) * FACADE_FOOT.insetShare);
  const x0 = Math.max(0, Math.round(a.x0) + inset), x1 = Math.min(width, Math.round(a.x1) - inset), k = Math.max(2, Math.round(FACADE_FOOT.bandM * ppm));
  const none: FootReading = {offsetM: 0, row: null, step: 0, pavingIqr: null};
  if (x1 - x0 < 10) return none;
  const yTop = Math.max(k, Math.round(height - FACADE_FOOT.maxM * ppm));
  const med = new Float64Array(height), iqr = new Float64Array(height), v = new Float64Array(x1 - x0);
  for (let y = yTop - k; y < height; y++) {
    for (let x = x0; x < x1; x++) { const i = (y * width + x) * 3; v[x - x0] = 0.299 * rgb[i] + 0.587 * rgb[i + 1] + 0.114 * rgb[i + 2]; }
    const s = Array.from(v).sort((p, q) => p - q), n = s.length;
    med[y] = s[n >> 1]; iqr[y] = s[(3 * n) >> 2] - s[n >> 2];
  }
  const median = (arr: number[]) => { const s = [...arr].sort((p, q) => p - q); return s[s.length >> 1]; };
  const bandMed = (ya: number, yb: number) => median(Array.from(med.subarray(ya, yb)));
  const lowest = height - Math.round(FACADE_FOOT.minM * ppm);
  for (let y = yTop; y <= lowest; y++) {
    const step = bandMed(y, Math.min(height, y + k)) - bandMed(y - k, y);
    if (Math.abs(step) < FACADE_FOOT.minStep) continue;
    const paving = median(Array.from(iqr.subarray(y + 1, height)));
    if (paving > FACADE_FOOT.pavingIqr) continue;
    return {offsetM: +((height - y) / ppm).toFixed(2), row: y, step: +step.toFixed(1), pavingIqr: +paving.toFixed(1)};
  }
  return none;
}

/**
 * One offset per strip from its spans' readings: the median of every span's reading (none = 0) when at least half the
 * spans read a foot and those readings agree (inter-quartile spread under `maxSpreadM`); else 0. The strip is a mosaic
 * of panoramas and a parked van or a hedge hides the paving under some spans; a lone reading never moves a face.
 */
export const STRIP_FOOT = {minReadShare: 0.5, maxSpreadM: 0.6} as const;
export function stripFootOffset(readings: readonly FootReading[]): {offsetM: number; read: number; spans: number; spreadM: number | null} {
  const all = readings.map(r => r.offsetM).sort((p, q) => p - q), read = all.filter(v => v > 0);
  const q = (s: number[], f: number) => s[Math.min(s.length - 1, Math.floor(s.length * f))];
  const spreadM = read.length ? +(q(read, 0.75) - q(read, 0.25)).toFixed(2) : null;
  const ok = read.length > 0 && read.length >= all.length * STRIP_FOOT.minReadShare && spreadM! <= STRIP_FOOT.maxSpreadM;
  return {offsetM: ok ? all[all.length >> 1] : 0, read: read.length, spans: all.length, spreadM};
}

/**
 * The facade foot of a strip image (auto-place.ts runLikeness, review.ts sheets): every span read, one offset per strip.
 * `enabled` false (`--no-foot`) reads the strip from its bottom row as before #157.
 */
export function runFootOffset(raw: {rgb: Uint8Array; width: number; height: number}, strip: {spans: {px: [number, number]}[]; pixelsPerMetre: number}, enabled = true) {
  if (!enabled) return {offsetM: 0, read: 0, spans: strip.spans.length, spreadM: null as number | null, readings: [] as number[]};
  const readings = strip.spans.map(s => measureFacadeFoot({rgb: raw.rgb, width: raw.width, height: raw.height, x0: s.px[0], x1: s.px[1], pixelsPerMetre: strip.pixelsPerMetre}));
  return {...stripFootOffset(readings), readings: readings.map(r => r.offsetM)};
}
