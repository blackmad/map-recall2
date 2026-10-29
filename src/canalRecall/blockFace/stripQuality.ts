/**
 * Strip quality: is a face's rectified panorama strip usable as the photo the batch installer matches against, or is it
 * blown out / colour-cast so that the type match, the wall palette and the likeness score would read the light instead of
 * the facade (#98: Kinkerstraat 56-84's 2024-11-29 low-sun strip was blown over the gables and cast cyan, which drew the
 * fronts olive; re-stripped on 2023-01-10). Measured per pand span on the facade box (above the shopfront, under the
 * eaves), the placeholder grey of missing panorama pixels left out.
 *
 *   blown   share of facade pixels at the top of the range (every channel >= BLOWN_MIN): sun on stucco or gables;
 *   dark    share of facade pixels under DARK_MAX luma: a facade in deep shadow or a night/backlit capture;
 *   cast    the facade's mean opponent colour: rb = mean(R - B) / 255 (brick and stucco read warm, rb > 0) and
 *           gm = mean(G - (R + B) / 2) / 255 (a green/cyan cast lifts G over the R/B mean);
 *   usable  share of facade pixels that are not placeholder grey.
 *
 * A span is bad when blown, dark or cast passes its limit (STRIP_QUALITY); a face strip is bad when more than
 * `maxBadShare` of its usable spans (by width) are bad. Thresholds were set on the committed faces' strips (batch.ts
 * --calibrate-quality), with Kinkerstraat 56-84 2024-11-29 as the named bad case and its 2023-01-10 strip as the good one.
 */
export const STRIP_QUALITY = {
  blownMin: 235,
  darkMax: 28,
  /** Span limits. */
  /** Sunny strips read white frames and stucco at 0.1-0.35 (median 0.09 over 180 committed strips); above 0.4 the light
   * washes out the fronts themselves (Bellamy 2024-12-11 sun, 0.42-0.58). */
  maxBlown: 0.4,
  maxDark: 0.35,
  /** Cold cast: under this R-B mean the facade reads blue-grey (p5 of the committed strips 0.007; Kinkerstraat 56-84
   * 2024-11-29 -0.043). */
  minRb: -0.02,
  /** Cyan cast: G over the R/B mean above `maxGm` while R-B stays under `cyanRb` (Kinkerstraat 56-84 2024-11-29: gm 0.049,
   * rb -0.043; its 2023-01-10 re-strip -0.005 / 0.026). Green alone is foliage on a warm front (Bilderdijkstraat 2024-11-29
   * gm 0.042 at rb 0.19), not a cast. */
  maxGm: 0.035,
  cyanRb: 0.02,
  /** A face is re-stripped when more than this width share of its usable spans is bad. */
  maxBadShare: 0.3,
  /** Under this usable share a span is no evidence (not bad, not good). */
  minUsable: 0.4,
} as const;

export interface SpanQuality {blown: number; dark: number; rb: number; gm: number; usable: number; bad: string[]}
export interface StripQualityVerdict {badShare: number; bad: boolean; reasons: string[]; spans: SpanQuality[]}

const r3 = (v: number) => +v.toFixed(3);

/** One span's facade box: x0..x1 columns, y0..y1 rows (y down, the strip's top is row 0). */
export function spanQuality(rgb: Uint8Array | Uint8ClampedArray, width: number, box: {x0: number; x1: number; y0: number; y1: number}, channels = 3): SpanQuality {
  let n = 0, total = 0, blown = 0, dark = 0, rb = 0, gm = 0;
  for (let y = Math.max(0, box.y0); y < box.y1; y++) for (let x = Math.max(0, box.x0); x < Math.min(width, box.x1); x++) {
    const i = (y * width + x) * channels, r = rgb[i], g = rgb[i + 1], b = rgb[i + 2];
    total++;
    if (Math.abs(r - 128) <= 1 && Math.abs(g - 128) <= 1 && Math.abs(b - 128) <= 1) continue; // no panorama data
    n++;
    if (r >= STRIP_QUALITY.blownMin && g >= STRIP_QUALITY.blownMin && b >= STRIP_QUALITY.blownMin) blown++;
    if (0.2126 * r + 0.7152 * g + 0.0722 * b < STRIP_QUALITY.darkMax) dark++;
    rb += r - b; gm += g - (r + b) / 2;
  }
  const q: SpanQuality = {blown: n ? r3(blown / n) : 0, dark: n ? r3(dark / n) : 0, rb: n ? r3(rb / n / 255) : 0, gm: n ? r3(gm / n / 255) : 0, usable: total ? r3(n / total) : 0, bad: []};
  if (q.usable >= STRIP_QUALITY.minUsable) {
    if (q.blown > STRIP_QUALITY.maxBlown) q.bad.push(`blown ${q.blown}`);
    if (q.dark > STRIP_QUALITY.maxDark) q.bad.push(`dark ${q.dark}`);
    if (q.rb < STRIP_QUALITY.minRb) q.bad.push(`cold cast rb ${q.rb}`);
    else if (q.gm > STRIP_QUALITY.maxGm && q.rb < STRIP_QUALITY.cyanRb) q.bad.push(`cyan cast gm ${q.gm}`);
  }
  return q;
}

/** The face verdict from its spans (weighted by span width in pixels). */
export function stripQuality(spans: {quality: SpanQuality; widthPx: number}[]): StripQualityVerdict {
  const usable = spans.filter(s => s.quality.usable >= STRIP_QUALITY.minUsable);
  const w = usable.reduce((a, s) => a + s.widthPx, 0), badW = usable.filter(s => s.quality.bad.length).reduce((a, s) => a + s.widthPx, 0);
  const badShare = w ? r3(badW / w) : 1;
  const reasons = [...new Set(usable.flatMap(s => s.quality.bad.map(b => b.split(' ').slice(0, -1).join(' '))))];
  return {badShare, bad: !w || badShare > STRIP_QUALITY.maxBadShare, reasons: w ? reasons : ['no usable span'], spans: spans.map(s => s.quality)};
}
