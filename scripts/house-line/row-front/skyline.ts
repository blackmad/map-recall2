/**
 * Strip skyline (lane 1, interim until lane 2's front records land): per pand span of a block-face strip, the height
 * the front reaches across most of its width (the cornice top, or a gable's foot) and the height its highest part
 * reaches (a gable or dormer top), read where the strip turns from sky to wall. Pure over an RGB buffer, so it is tested.
 */
export type SkylineSpan = { pandId: string; px: [number, number] };
export type SkylineReading = {
  pandId: string;
  /** Height reached by at least `WIDE_SHARE` of the span's columns (m above the strip's ground). */
  frontTopM: number | null;
  /** Height reached by at least `FOOT_SHARE` of the columns: a gable's foot (its shoulders sit higher). */
  footM: number | null;
  /** Height reached by at least `PEAK_SHARE` of the columns: a gable, neck or dormer top. */
  peakM: number | null;
  /** Width share of the columns standing above frontTopM + 0.6 m: a crown's footprint on the front. */
  crownShare: number;
  /** Share of the span's columns with a sky/wall edge at all (grey no-data, scaffolding sheets: low). */
  readShare: number;
};
export const WIDE_SHARE = 0.7;
export const PEAK_SHARE = 0.12;
export const FOOT_SHARE = 0.92;
/** A run this many pixels of wall below the edge, so a wire or a crane arm does not end the sky. */
export const EDGE_RUN_PX = 10;

/** Sky in the 2022 strips: bright, blue at least as strong as red, low chroma; the strip's no-data grey is neither. */
export function isSky(r: number, g: number, b: number): boolean {
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  if (Math.abs(r - 128) < 3 && Math.abs(g - 128) < 3 && Math.abs(b - 128) < 3) return false;
  return lum > 150 && b >= r - 4 && Math.max(r, g, b) - Math.min(r, g, b) < 60;
}
const isNoData = (r: number, g: number, b: number) => Math.abs(r - 128) < 3 && Math.abs(g - 128) < 3 && Math.abs(b - 128) < 3;

/** First row (from the top) where `EDGE_RUN_PX` non-sky pixels follow sky, or null (no sky above, or no data). */
export function columnEdge(rgb: Uint8Array | Buffer, width: number, height: number, x: number): number | null {
  let skySeen = false;
  for (let y = 0; y < height; y++) {
    const i = (y * width + x) * 3, r = rgb[i], g = rgb[i + 1], b = rgb[i + 2];
    if (isNoData(r, g, b)) return null;
    if (isSky(r, g, b)) { skySeen = true; continue; }
    if (!skySeen) continue;
    let run = 1;
    while (run < EDGE_RUN_PX && y + run < height) { const j = ((y + run) * width + x) * 3; if (isSky(rgb[j], rgb[j + 1], rgb[j + 2])) break; run++; }
    if (run >= EDGE_RUN_PX) return y;
  }
  return null;
}

export function readSkyline(rgb: Uint8Array | Buffer, width: number, height: number, ppm: number, spans: SkylineSpan[]): SkylineReading[] {
  return spans.map(({ pandId, px }) => {
    // Inset the span by 6 % each side: a neighbour's gable or party wall leans into the edge columns.
    const inset = Math.round((px[1] - px[0]) * 0.06), x0 = px[0] + inset, x1 = px[1] - inset;
    const tops: number[] = [];
    let cols = 0;
    for (let x = x0; x < x1; x++) { cols++; const e = columnEdge(rgb, width, height, x); if (e !== null) tops.push((height - e) / ppm); }
    const readShare = cols ? tops.length / cols : 0;
    if (tops.length < Math.max(4, cols * 0.4)) return { pandId, frontTopM: null, footM: null, peakM: null, crownShare: 0, readShare };
    const sorted = [...tops].sort((a, b) => b - a);
    const at = (share: number) => sorted[Math.min(sorted.length - 1, Math.floor(share * sorted.length))];
    const frontTopM = at(WIDE_SHARE), footM = at(FOOT_SHARE), peakM = at(PEAK_SHARE);
    const crownShare = tops.filter(t => t > frontTopM + 0.6).length / tops.length;
    return { pandId, frontTopM: +frontTopM.toFixed(2), footM: +footM.toFixed(2), peakM: +peakM.toFixed(2), crownShare: +crownShare.toFixed(2), readShare: +readShare.toFixed(2) };
  });
}
