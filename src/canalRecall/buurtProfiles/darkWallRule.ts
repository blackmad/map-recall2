/**
 * Near-black measured modern walls (lane fb-placement2, 2026-11-20). Of the 5,079 per-pand walls in
 * modern-pand-walls.json, 289 publish at CIE L* < 17. Their panorama thumbnails (sample-panos.ts --modern) show that
 * most are not dark walls: grey render, beige brick, white cladding and glazed fronts. The cause is systematic.
 * look/brickTone.ts takes the wall luma as the mode of the *warm* pixels (r > b + 2). On a neutral or pale facade the
 * warm pixels are a minority made of window reveals, shadow under balconies and loggias, and dark glass, so the mode
 * lands on them. On an under-exposed thumbnail it lands lower still.
 *
 * The rule re-reads the centre box without its dark pixels (luma < `litLumaMin`) and without the warm-only filter
 * (`litWallTone`: the luma mode over every remaining pixel, any hue, then the mean of the pixels within `band` of it). A reading is an artefact when that re-read is markedly brighter than the published one
 * (lit / raw >= MIN_LIFT) and the dark pixels are not the facade itself (darkShare < MAX_DARK_SHARE). A truly dark
 * wall (dark brick, black cladding, stained wood) fills most of the box with dark pixels and stays as measured.
 * A reading whose centre box is mostly sky (skyShare >= `maxSkyShare`) is `exposure`-limited: the thumbnail is exposed
 * for the sky, so a white hall, a grey fascia and black cladding all read near-black and the photo cannot tell them
 * apart. Those take the plausible family from their neighbours (`neighbourWall`: the lower-quartile published wall of
 * the buurt's other measured modern pands, of the same decade when there are enough), which the wall-colour ruling of
 * 2026-11-14 allows.
 * The corrected colour of an artefact is the re-read run through the population's own raw-to-published mapping (`calibrateByNeighbours`:
 * the median published colour of the K samples whose raw reading is nearest), so it carries derive.ts's exposure and
 * chroma calibration without re-running it.
 *
 * Checked by eye (artifacts/fb-placement2/artefact-sheet-*.jpg, dark-verdict-sheet-*.jpg): on the first 48 `dark`
 * verdicts of the two-way rule, 23 were artefacts; 17 of them had a sky-dominated box, against 7 of 25 truly dark walls.
 */
export const DARK_WALL_RULE = { maxLstar: 17, litLumaMin: 45, minLift: 1.3, maxDarkShare: 0.5, k: 15, band: 0.12, minPixels: 100, maxSkyShare: 0.6, minDecadeNeighbours: 5, neighbourQuantile: 0.25 } as const;

export type Rgb = readonly [number, number, number];
export const luma = (c: Rgb) => 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2];

/** CIE L* of a hex colour (`rrggbb`, with or without `#`). */
export function lstar(hex: string): number {
  const h = hex.replace(/^#/, ''), lin = (c: number) => c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  const [r, g, b] = [0, 2, 4].map(i => lin(parseInt(h.slice(i, i + 2), 16) / 255));
  const y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return 116 * (y > 0.008856 ? Math.cbrt(y) : 7.787 * y + 16 / 116) - 16;
}

/** The lit wall: luma mode (4-level bins, smoothed over 3) of rgb pixels `px` (flat r,g,b), any hue; the mean of those within `band`. */
export function litWallTone(px: ArrayLike<number>): Rgb | null {
  const n = Math.floor(px.length / 3);
  if (n < DARK_WALL_RULE.minPixels) return null;
  const hist = new Array(64).fill(0), y = (i: number) => 0.299 * px[i * 3] + 0.587 * px[i * 3 + 1] + 0.114 * px[i * 3 + 2];
  for (let i = 0; i < n; i++) hist[Math.min(63, Math.floor(y(i) / 4))]++;
  let best = -1, at = 0;
  for (let i = 0; i < 64; i++) { const v = (hist[i - 1] ?? 0) + 2 * hist[i] + (hist[i + 1] ?? 0); if (v > best) { best = v; at = i; } }
  const m = at * 4 + 2, sum = [0, 0, 0]; let k = 0;
  for (let i = 0; i < n; i++) if (Math.abs(y(i) - m) <= m * DARK_WALL_RULE.band) { sum[0] += px[i * 3]; sum[1] += px[i * 3 + 1]; sum[2] += px[i * 3 + 2]; k++; }
  return k ? [sum[0] / k, sum[1] / k, sum[2] / k] : null;
}

export type DarkWallVerdict = 'artefact' | 'exposure' | 'dark' | 'unread';
/**
 * The verdict on one near-black reading: `artefact` (re-read it), `exposure` (sky-exposed: the neighbours' family),
 * `dark` (a dark wall: keep), or `unread` (no re-read, no sky: keep).
 */
export function classifyDarkWall(raw: Rgb, lit: Rgb | null, darkShare: number, skyShare = 0): DarkWallVerdict {
  if (lit && darkShare < DARK_WALL_RULE.maxDarkShare && luma(lit) >= luma(raw) * DARK_WALL_RULE.minLift) return 'artefact';
  if (skyShare >= DARK_WALL_RULE.maxSkyShare) return 'exposure';
  return lit ? 'dark' : 'unread';
}

/**
 * The neighbours' wall: of `others` of the same decade when there are enough (else all of them), the real wall at the
 * `neighbourQuantile` of their luma: a plausible family that still leans dark, since the photo read the front darker than
 * its street (a median turned black cladding white). Null when there are none.
 */
export function neighbourWall(year: number, others: ReadonlyArray<{ year: number; published: Rgb }>): Rgb | null {
  const decade = others.filter(o => Math.floor(o.year / 10) === Math.floor(year / 10));
  const pool = decade.length >= DARK_WALL_RULE.minDecadeNeighbours ? decade : others;
  if (!pool.length) return null;
  const sorted = [...pool].sort((a, b) => luma(a.published) - luma(b.published));
  return sorted[Math.floor((sorted.length - 1) * DARK_WALL_RULE.neighbourQuantile)].published;
}

/** The published colour for raw reading `raw`: the per-channel median of the K population samples nearest in raw RGB. */
export function calibrateByNeighbours(raw: Rgb, population: ReadonlyArray<{ raw: Rgb; published: Rgb }>, k: number = DARK_WALL_RULE.k): Rgb {
  const near = [...population].map(p => ({ p, d: (p.raw[0] - raw[0]) ** 2 + (p.raw[1] - raw[1]) ** 2 + (p.raw[2] - raw[2]) ** 2 })).sort((a, b) => a.d - b.d).slice(0, k);
  const med = (i: number) => { const v = near.map(n => n.p.published[i]).sort((a, b) => a - b); return v[Math.floor(v.length / 2)]; };
  return [med(0), med(1), med(2)];
}

export const hexOf = (c: Rgb) => c.map(v => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');
export const rgbOf = (hex: string): Rgb => { const h = hex.replace(/^[#bp]/, ''); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; };
