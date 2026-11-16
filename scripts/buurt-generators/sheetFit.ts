/**
 * How a member's preview render goes into a sheet band (sheet.ts). The render is `topM` tall at `ppm` px/m and stands
 * on the band's bottom. A render taller than the band (a raised tower over the photo's top) is cropped at the top, never
 * squeezed into the band: squeezing drew the whole member short, eaves and windows 0.6-0.75 m under the series line
 * (round 22, Stadionweg 0363100012067736, Michelangelostraat 0363100012122157).
 */
export interface BandFit { /** The render resized to this height (px). */ renderH: number; /** Rows cut off its top (px). */ cropTop: number; /** Its height in the band (px). */ h: number }
export function bandFit(topM: number, ppm: number, bandH: number): BandFit {
  const renderH = Math.max(1, Math.round(topM * ppm)), h = Math.max(1, Math.min(bandH, renderH));
  return { renderH, cropTop: renderH - h, h };
}
