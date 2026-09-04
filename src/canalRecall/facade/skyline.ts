/**
 * Finding the roofline in a rectified façade strip.
 *
 * This exists to solve a registration problem, and the reason it works is
 * specific to the fabric being reconstructed. An Amsterdam terrace is a run of
 * narrow plots built at different dates to different heights, so its roofline
 * is a *staircase*: near-constant across each house, stepping at every party
 * wall. Those steps are the plot boundaries BAG already knows the position of,
 * which makes the skyline a direct, low-noise way to ask whether a projection
 * is registered.
 *
 * It replaces vertical-edge density, which failed for a reason worth recording:
 * a canal façade's strongest vertical edges are window jambs, and they repeat
 * every metre or two. That signal is quasi-periodic, so it correlates almost
 * equally well at many different shifts and the best match lands essentially at
 * random. A signal has to be *aperiodic* to localise anything, and a roofline
 * is — no two neighbours step by the same amount twice in a row.
 */

export interface Strip {
  width: number;
  height: number;
  data: Uint8ClampedArray;
}

/**
 * Height of the sky/building boundary in each column, in pixels from the top.
 *
 * Returns `null` for a column whose whole height reads as sky (a gap between
 * buildings) or as building (the strip did not reach above the ridge), because
 * a column with no transition has no roofline to report and guessing one would
 * invent a step where none exists.
 */
export function skyline(strip: Strip, { runLength = 4 }: { runLength?: number } = {}): Array<number | null> {
  const { width, height, data } = strip;
  const luma = (index: number) => 0.299 * data[index] + 0.587 * data[index + 1] + 0.114 * data[index + 2];

  /**
   * Sky is anything *at least as bright* as the sky above it — a floor, not a
   * band.
   *
   * The obvious test, "close to the median sky colour", is wrong in a way that
   * silently ruins the measurement: a white cloud is brighter than median blue
   * sky, so a symmetric band classifies cloud as building and plants a
   * roofline halfway up the sky. On a part-cloudy January morning that happens
   * across most of the frame. Both blue sky and cloud are brighter than brick
   * and far brighter than a slate roof, so the floor separates them cleanly and
   * the ceiling was never doing useful work.
   */
  const band = Math.max(2, Math.floor(height * 0.04));
  const lumas: number[] = [];
  for (let y = 0; y < band; y++) {
    for (let x = 0; x < width; x++) lumas.push(luma((y * width + x) * 4));
  }
  const quantile = (values: number[], q: number) => { const s = [...values].sort((a, b) => a - b); return s[Math.floor((s.length - 1) * q)]; };
  // An upper quantile, not the median. The top band is mostly sky but not
  // always only sky: a taller building on the block behind can fill part of it,
  // and a median then reports brick as "sky", which drags the floor below every
  // pixel in the image and reports no roofline anywhere. The 80th percentile
  // survives a top band that is a third obstructed.
  const skyLuma = quantile(lumas, 0.8);
  const spread = quantile(lumas.map(v => Math.abs(v - skyLuma)), 0.5) * 1.4826 || 8;
  // Deep enough below the sky to survive a shaded patch of sky, well above the
  // brightest brick.
  const floor = skyLuma - Math.max(30, spread * 3.5);

  // If the band is so dark that the floor sits in brick territory, there is no
  // usable sky reference and every column would be reported as sky. Say so by
  // reporting no roofline rather than reporting a wrong one.
  if (skyLuma < 60) return new Array(width).fill(null);

  const isSky = (index: number) => luma(index) >= floor;

  const result: Array<number | null> = new Array(width).fill(null);
  for (let x = 0; x < width; x++) {
    let run = 0;
    for (let y = 0; y < height; y++) {
      if (isSky((y * width + x) * 4)) { run = 0; continue; }
      if (++run >= runLength) { result[x] = y - runLength + 1; break; }
    }
  }
  return result;
}

/**
 * Where the roofline steps, as a per-column score.
 *
 * Compared over a window rather than differenced pointwise: a real party wall
 * is a sustained change of level between one house and the next, while a
 * chimney, an aerial or a dormer is a spike a few columns wide. Taking the
 * difference of medians either side rejects those and keeps the steps.
 */
export function skylineSteps(heights: Array<number | null>, windowPx: number): number[] {
  const steps = new Array(heights.length).fill(0);
  const medianOf = (from: number, to: number) => {
    const values: number[] = [];
    for (let i = Math.max(0, from); i < Math.min(heights.length, to); i++) {
      const value = heights[i];
      if (value !== null) values.push(value);
    }
    if (values.length < Math.max(3, windowPx * 0.4)) return null;
    values.sort((a, b) => a - b);
    return values[Math.floor(values.length / 2)];
  };
  for (let x = 0; x < heights.length; x++) {
    const left = medianOf(x - windowPx, x);
    const right = medianOf(x + 1, x + 1 + windowPx);
    steps[x] = left === null || right === null ? 0 : Math.abs(right - left);
  }
  return steps;
}

/** Zero-mean, unit-variance, so correlation is not dominated by scale. */
export function normalise(values: number[]): number[] {
  const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
  const sd = Math.sqrt(values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length) || 1;
  return values.map(v => (v - mean) / sd);
}
