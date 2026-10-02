/**
 * Cutting a rectified landmark photo to the building's own outline.
 *
 * A rectified panorama crop is a rectangle, but a landmark front rarely is: the
 * Bijenkorf has an arched pediment, the Beurs a row of stepped gables below a
 * hall roof. Pasted as a rectangle, everything above the roofline is white sky
 * on a solid quad, which reads as a billboard rather than a building. Measuring
 * the roofline per column lets the viewer build the wall only up to the
 * building, so the sky never gets drawn.
 *
 * The same pass samples the facade's typical colour, so the footprint's other
 * walls can be tinted to match the photo instead of standing out as a grey box.
 */
import type { Strip } from './skyline.ts';
import { rejectSpikes } from './elevationRoofline.ts';

export interface PhotoSilhouette {
  /** Spacing of `topsM` along the wall, in metres from the wall's start. */
  sampleM: number;
  /** Height of the building's top above the photo's base at each sample, in metres. */
  topsM: number[];
  /** Median facade colour between ground floor and roofline, as `#rrggbb`. */
  wallColour: string;
}

const hex = (v: number) => Math.round(v).toString(16).padStart(2, '0');
const median = (values: number[]) => { const s = [...values].sort((a, b) => a - b); return s[s.length >> 1] ?? 0; };

/** Running median over `radius` samples either side; flattens jitter from window ledges and ornaments. */
function smooth(values: number[], radius: number): number[] {
  return values.map((_, i) => median(values.slice(Math.max(0, i - radius), i + radius + 1)));
}

export function photoSilhouette(strip: Strip, pixelsPerMetre: number, { sampleM = 0.25 } = {}): PhotoSilhouette {
  const { width, height, data } = strip;
  // Sky by colour, per pixel: overcast white (bright, unsaturated) or blue. `skyline()` derives
  // its threshold from the top band, which fails when the building reaches the top edge (the
  // Royal Palace's pediment) or the sky is blue (the Concertgebouw): everything read as sky.
  const isSky = (i: number) => {
    const r = data[i], g = data[i + 1], b = data[i + 2], luma = 0.299 * r + 0.587 * g + 0.114 * b;
    return (luma > 185 && Math.max(r, g, b) - Math.min(r, g, b) < 40) || (b > r + 20 && b > g + 4 && luma > 110);
  };
  const runLength = Math.max(4, Math.round(pixelsPerMetre * 0.15));
  const rows: Array<number | null> = Array.from({ length: width }, (_, x) => {
    let run = 0;
    for (let y = 0; y < height; y++) {
      if (isSky((y * width + x) * 4)) { run = 0; continue; }
      if (++run >= runLength) return y - runLength + 1;
    }
    return null;
  });
  const topSky = (x: number) => isSky(x * 4);
  // A null column is either all sky (a gap) or all building (the photo stops below the roof).
  const fullHeightM = height / pixelsPerMetre;
  const columnTopM = rows.map((row, x) => (row == null ? (topSky(x) ? 0 : fullHeightM) : (height - row) / pixelsPerMetre));

  const samples = Math.max(2, Math.round(width / pixelsPerMetre / sampleM) + 1);
  const step = (width - 1) / (samples - 1), half = Math.max(1, Math.floor(step / 2));
  const resampled = Array.from({ length: samples }, (_, i) => {
    const x = Math.round(i * step);
    return median(columnTopM.slice(Math.max(0, x - half), Math.min(width, x + half + 1)));
  });
  // Lamp posts, tram wires and flagpoles poke above the roofline as thin spikes.
  const despiked = rejectSpikes(resampled, sampleM, 0.8, 1.5);
  const filled = despiked.map((v, i) => v ?? median(resampled.slice(Math.max(0, i - 4), i + 5)));
  const topsM = smooth(filled, 2).map(v => Math.round(Math.min(fullHeightM, Math.max(0, v)) * 100) / 100);

  // Colour: pixels under the roofline but above the shopfront level.
  const channels: number[][] = [[], [], []];
  const stride = Math.max(1, Math.round(pixelsPerMetre / 4));
  for (let x = 0; x < width; x += stride) {
    const topRow = height - columnTopM[x] * pixelsPerMetre, groundRow = height - 5 * pixelsPerMetre;
    for (let y = Math.ceil(topRow + pixelsPerMetre); y < groundRow; y += stride) {
      const i = (y * width + x) * 4;
      for (let c = 0; c < 3; c++) channels[c].push(data[i + c]);
    }
  }
  const wallColour = channels[0].length ? `#${channels.map(c => hex(median(c))).join('')}` : '#9a8a78';
  return { sampleM, topsM, wallColour };
}
