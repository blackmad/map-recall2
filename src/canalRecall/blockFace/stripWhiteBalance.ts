/**
 * White balance for the strip's foliage test (measureFacade.ts isLeaf), so a green-cast panorama day stops reading its
 * white frames, stone trim, stucco and glass as leaves.
 *
 * Why: the 2024-11-21 and 2024-12-11 centre panoramas (Haarlemmerstraat, Haarlemmerdijk; the Dec 2024 / Jan 2025 Jordaan
 * days; Vogelbuurt) carry a yellow-green cast. Their white trim photographs as (205, 212, 190): G over R, both well
 * over B, which is exactly isLeaf's yellow-green branch. Haarlemmerstraat 46-96 read 31 % of its body band as foliage,
 * so the likeness score abstained ("usable photo < 50 %") on fronts with no tree in front of them. Brick itself is not
 * the problem; the bright near-neutrals are.
 *
 * Method (white patch): the reference white of one panorama day is the per-channel median of its brightest 15 % of
 * pixels below clipping (placeholder grey, clipped highlights and open blue sky left out), in practice white frames,
 * stone trim and overcast sky, all lit by the same camera. The gains map that reference to grey.
 *
 * Applied only under a green or yellow-green cast: the reference's G within `greenTint` of its R (or over it) and over
 * its B. A warm day (Haarlemmerdijk 2022-12-15: white (141, 132, 126), R 9 over G) never makes a neutral read green,
 * and balancing it towards blue would add leaf pixels (2-58: 1.0 % -> 2.1 %). Those strips keep the plain isLeaf,
 * byte-identical.
 *
 * Only the MASKS use the balance (likeness photo mask, body-band foliage share, batch foliage columns). Measured
 * colours (wall, trim, palette) stay on the unbalanced strip: brickForDrawnLuma, the row trim gain (autoPlace.ts
 * rowExposure) and the city look's brick lift are calibrated on unbalanced strips across every installed buurt, and
 * the cast moves the brick median only a few per cent (gains 0.95-1.07), while it moves the leaf share by 25 points.
 */
import {isLeaf} from '../buildingRecipe/measureFacade.ts';

export type Rgb3 = [number, number, number];
export type LeafTest = (r: number, g: number, b: number) => boolean;

export const WHITE_BALANCE = {
  /** The reference white: this top share of the usable pixels by luma. */
  refShare: 0.15,
  /** Pixels with a channel at or over this are clipped, not a colour reading. */
  clip: 250,
  /** Fewer usable pixels than this: no reference (gains 1). */
  minPixels: 500,
  /**
   * Balance only when the reference's G - R is over this share of its luma (and G over B): the day's white sits inside
   * isLeaf's yellow-green window (G > R - 6, i.e. about -4 % of a mid luma). Calibrated on the Haarlemmer strips:
   * cast days 2024-11-21 +0.034, 2024-12-11 -0.005..+0.011 and -0.038, 2024-12-03 0.0; neutral 2022-12-15 -0.047 and -0.066.
   */
  greenTint: -0.04,
  /** Gains are clamped to 1/maxGain .. maxGain. */
  maxGain: 1.25,
} as const;

export interface WhiteBalance {
  gains: Rgb3;
  /** The reference white (median of the bright pixels), null when too few pixels. */
  ref: Rgb3 | null;
  /** (G - R) / luma of the reference: >= 0 green or yellow-green, clearly < 0 a warm (red-over-green) white. */
  tint: number;
  applied: boolean;
  reason: string;
}

export const NO_BALANCE: WhiteBalance = {gains: [1, 1, 1], ref: null, tint: 0, applied: false, reason: 'not measured'};

const median = (v: number[]) => { v.sort((a, b) => a - b); return v[v.length >> 1]; };

/**
 * The white balance of the pixels in `cols` (pixel column ranges [x0, x1) of one panorama day), every row.
 * Placeholder grey (128, 128, 128), clipped highlights and open blue sky are no reference.
 */
export function measureWhiteBalance(rgb: Uint8Array, width: number, height: number, cols: [number, number][]): WhiteBalance {
  const px: number[][] = [];
  for (const [a, b] of cols) for (let y = 0; y < height; y++) for (let x = Math.max(0, a); x < Math.min(width, b); x++) {
    const i = (y * width + x) * 3, r = rgb[i], g = rgb[i + 1], bl = rgb[i + 2];
    if (r === 128 && g === 128 && bl === 128) continue;
    if (Math.max(r, g, bl) >= WHITE_BALANCE.clip) continue;
    if (bl > r + 15 && bl >= g - 5) continue;
    px.push([r, g, bl, 0.299 * r + 0.587 * g + 0.114 * bl]);
  }
  if (px.length < WHITE_BALANCE.minPixels) return {...NO_BALANCE, reason: `${px.length} usable pixels < ${WHITE_BALANCE.minPixels}`};
  px.sort((p, q) => p[3] - q[3]);
  const top = px.slice(Math.floor(px.length * (1 - WHITE_BALANCE.refShare)));
  const ref: Rgb3 = [median(top.map(p => p[0])), median(top.map(p => p[1])), median(top.map(p => p[2]))];
  const m = (ref[0] + ref[1] + ref[2]) / 3, l = 0.299 * ref[0] + 0.587 * ref[1] + 0.114 * ref[2];
  const tint = +((ref[1] - ref[0]) / Math.max(1, l)).toFixed(3);
  if (tint <= WHITE_BALANCE.greenTint || ref[1] <= ref[2]) return {gains: [1, 1, 1], ref, tint, applied: false, reason: `reference ${ref.join(',')} tint ${tint}: no green cast (G - R <= ${WHITE_BALANCE.greenTint} of luma, or G <= B)`};
  const clamp = (v: number) => Math.min(WHITE_BALANCE.maxGain, Math.max(1 / WHITE_BALANCE.maxGain, v));
  const gains = ref.map(c => +clamp(m / Math.max(1, c)).toFixed(3)) as Rgb3;
  return {gains, ref, tint, applied: true, reason: `reference ${ref.join(',')} tint ${tint}: green cast, gains ${gains.join(',')}`};
}

/**
 * One white balance per panorama day of a strip: spans sharing a date share a reference (the cast is the day's camera),
 * returned per span in the strip's span order. Spans without a date are measured on their own.
 */
export function stripWhiteBalances(rgb: Uint8Array, width: number, height: number, spans: {px: [number, number]; date?: string}[]): WhiteBalance[] {
  const byDate = new Map<string, WhiteBalance>();
  return spans.map((s, k) => {
    const key = s.date ?? `#${k}`;
    if (!byDate.has(key)) byDate.set(key, measureWhiteBalance(rgb, width, height, spans.filter((t, j) => (t.date ?? `#${j}`) === key).map(t => t.px)));
    return byDate.get(key)!;
  });
}

/** isLeaf on white-balanced values; the plain isLeaf itself when the balance is not applied. */
export function balancedLeaf(wb: WhiteBalance | null | undefined): LeafTest {
  if (!wb?.applied) return isLeaf;
  const [gr, gg, gb] = wb.gains;
  return (r, g, b) => isLeaf(Math.min(255, r * gr), Math.min(255, g * gg), Math.min(255, b * gb));
}
