import { STOREY_HEIGHT_M } from './grammar.ts';

/**
 * Measuring a façade: openings, storeys and bays.
 *
 * This is the step the whole pipeline exists to reach. Everything before it —
 * the boundary, the registry join, the coverage survey, the rectifier — was in
 * service of one thing: an image of one wall, seen square on, at a known number
 * of pixels per metre. Once that exists, a façade can be measured with ordinary
 * geometry rather than guessed at, because in a rectified elevation the things
 * being measured are axis-aligned: storey lines are horizontal, window jambs
 * are vertical, and a metre is a metre everywhere in the frame.
 *
 * The measurements taken here are the ones the parameter record needs and the
 * register cannot supply — RECON-3 found it states bay count for 3% of listings
 * and storey count for 1%.
 *
 * Nothing here invents. An opening is reported where one was found; a façade
 * with no detectable openings returns none rather than a plausible grid.
 */

export interface Gray {
  width: number;
  height: number;
  /** Luma, one byte per pixel. */
  data: Uint8Array;
}

/**
 * How far below the building's own ground level the rectified strip starts.
 *
 * This is a *datum*, not a margin, and it was a bare `0.4` copied into four
 * scripts — the rectifier that builds the strip, the extract that converts the
 * detector's `yM` back to a height above ground, the texture sampler and the
 * block builder. Every one of them has to agree, and nothing made them: moving
 * the strip in one file would have shifted every opening in the extract by the
 * difference, silently, and the render would have looked *almost* right.
 *
 * 1.8 m, not the original 0.4 m, because a canal house is entered up a stoep
 * and the storey the stoep steps over is a souterrain whose windows sit 0.8–1.6
 * m below street level. At 0.4 m the strip's bottom edge cut through them, so
 * the detector clamped them to the edge — 1,020 of 10,335 openings came out at
 * a sill of exactly -0.40 m, which is the picture running out rather than a
 * measurement — and the front door, being the other thing that reaches the
 * ground, was missed with them.
 */
export const STRIP_BASE_BELOW_GROUND_M = 1.8;

export interface Opening {
  /** Metres from the left edge of the measured strip. */
  xM: number;
  /** Metres above the base of the strip. */
  yM: number;
  widthM: number;
  heightM: number;
  /** Mean luma inside, kept so glass can be told from a dark painted panel. */
  darkness: number;
}

export interface Storey {
  /** Height of this storey's window band above the strip base, in metres. */
  centreM: number;
  openings: number;
}

export interface FacadeMeasurement {
  /** Columns discarded as continuous vertical obstructions — trunks, downpipes. */
  obstructionColumns: number;
  openings: Opening[];
  storeys: Storey[];
  /** Distinct vertical window columns — the bay rhythm. */
  bays: number;
  bayOffsetsM: number[];
  /** Storey-to-storey spacing, top to bottom. Empty when fewer than two bands. */
  storeyHeightsM: number[];
  /** Openings that reach the base of the strip: doors and shopfronts. */
  groundOpenings: Opening[];
}

export function toGray(image: { width: number; height: number; data: Uint8ClampedArray }): Gray {
  const data = new Uint8Array(image.width * image.height);
  for (let i = 0, p = 0; i < data.length; i++, p += 4) {
    data[i] = 0.299 * image.data[p] + 0.587 * image.data[p + 1] + 0.114 * image.data[p + 2];
  }
  return { width: image.width, height: image.height, data };
}

/**
 * Reject columns that run the whole height of the façade.
 *
 * A tree trunk, a downpipe, a drainpipe or a lamp standard all read as a strong
 * deviation from the wall — the detector's own signal — and they do it in one
 * continuous vertical band from pavement to roofline. A window never does: it
 * belongs to one storey. So a column whose score stays high across nearly the
 * full height is an obstruction in front of the façade, not part of it, and
 * including it drags a whole bay onto the tree.
 *
 * Found in the reference sheet, where several sampled "façades" at low
 * obliquity and short standoff turned out to be photographs of canal elms.
 */
function suppressObstructions(score: Float32Array, width: number, height: number): number {
  const top = Math.floor(height * 0.1), bottom = Math.floor(height * 0.92);
  const rows = bottom - top;
  let suppressed = 0;
  for (let x = 0; x < width; x++) {
    let high = 0;
    for (let y = top; y < bottom; y++) if (score[y * width + x] > 0.3) high++;
    // 82%: a genuine bay is broken by spandrel wall between every storey, so it
    // cannot be continuously "not the wall" over four storeys and a cornice.
    if (high / rows < 0.82) continue;
    for (let y = 0; y < height; y++) score[y * width + x] = 0;
    suppressed++;
  }
  return suppressed;
}

/**
 * Openings sit on a grid, and the grid is easier to find than they are.
 *
 * Hunting for each window separately fails on these façades: frames are pale,
 * net curtains fill the glass, sunlight splits one window into fragments and
 * joins two others into a blob. But a terrace is *grammatical* — the brief says
 * so, and the data agrees. Windows in a canal house line up in vertical bays
 * and horizontal storey bands, because that is how the building was built.
 *
 * That regularity is a legitimate prior and it does real work here. It is not
 * being used as a source of values: nothing infers that this house has four
 * bays because its neighbours do. It says only *where in this image to look*,
 * and every opening reported is one that was found in this building's own
 * photograph. The brief draws exactly that line — grammar as a way of reading,
 * never as a source of facts.
 *
 * Aggregating along each axis is also what makes the signal survive. A single
 * fragmented window is noise; forty pixels of window across a whole storey band
 * summed into one row is not.
 */
function openingScore(gray: Gray, blueExcess: Int16Array, bandPx: number): Float32Array {
  const { width, height, data } = gray;
  const score = new Float32Array(width * height);
  const bands = Math.max(1, Math.round(width / bandPx));
  for (let b = 0; b < bands; b++) {
    const from = Math.floor((b * width) / bands), to = Math.floor(((b + 1) * width) / bands);
    const values: number[] = [];
    for (let y = 0; y < height; y++) for (let x = from; x < to; x++) values.push(data[y * width + x]);
    values.sort((a, b2) => a - b2);
    // The wall is the majority of the band; the median is a good stand-in for
    // it, and the interquartile range for how much brick alone varies.
    const wall = values[Math.floor(values.length * 0.5)] || 1;
    const iqr = Math.max(10, values[Math.floor(values.length * 0.75)] - values[Math.floor(values.length * 0.25)]);
    for (let y = 0; y < height; y++) {
      for (let x = from; x < to; x++) {
        const index = y * width + x;
        // Deviation in *either* direction. An earlier version looked only for
        // dark regions and found almost nothing, because on these façades a
        // window is as often brighter than its wall as darker: white-painted
        // frames, net curtains, sunlit leaded glass and sky reflections all read
        // lighter than brick, while an unlit room reads darker. What a window
        // reliably is, is *not the wall* — so that is what gets measured.
        const luma = Math.abs(data[index] - wall) / iqr;
        const sky = Math.max(0, (blueExcess[index] - 14) / 60);
        score[index] = Math.min(1, Math.max(luma * 0.55, sky));
      }
    }
  }
  return score;
}

/**
 * Fit a storey ladder to the row profile.
 *
 * This is where the grammar earns its place. Storey bands found independently
 * come out at impossible spacings — eleven metres between one band and the
 * next, which is three storeys read as one — because a band that happens to be
 * shadowed simply goes missing and nothing notices. But a canal house's storeys
 * are regular: roughly 2.4 to 4.2 metres apart, and diminishing upward as the
 * rooms get meaner toward the attic. That is a fact about how these houses were
 * built, not about any one of them.
 *
 * So instead of asking "where are the bands", ask "which regular ladder best
 * explains this profile" — search the spacings a canal house can actually have
 * and take the one the image supports most strongly. A missing rung is then
 * predicted rather than lost, and a spurious one has to beat the whole ladder
 * rather than just a local threshold.
 *
 * The ladder still says only where to look. Every opening reported is one
 * confirmed in this building's own photograph.
 */
function storeyLadder(profile: Float32Array, ppm: number): number[] {
  // Range and prior from `grammar.ts`: 2,390 buildings' 3DBAG storey counts
  // divided by their AHN eaves heights give p05 2.40, p50 3.01, p95 3.71 m.
  // The old 2.4–4.2 m search was both too wide and centred too low, and the
  // ladder kept drifting to the 2.4 m end where more rungs fit.
  const minSpacing = STOREY_HEIGHT_M.min * ppm, maxSpacing = STOREY_HEIGHT_M.max * ppm;
  if (profile.length < minSpacing * 1.6) return [];

  let best: { spacing: number; phase: number; score: number } | null = null;
  for (let spacing = minSpacing; spacing <= maxSpacing; spacing += 0.05 * ppm) {
    for (let phase = 0; phase < spacing; phase += Math.max(1, ppm * 0.05)) {
      let score = 0, rungs = 0;
      for (let y = phase; y < profile.length; y += spacing) {
        // Each rung scores the window band around it, not a single row.
        const half = Math.min(spacing * 0.3, ppm * 1.1);
        let sum = 0, n = 0;
        for (let i = Math.max(0, Math.round(y - half)); i <= Math.min(profile.length - 1, Math.round(y + half)); i++) { sum += profile[i]; n++; }
        if (!n) continue;
        score += sum / n;
        rungs++;
      }
      /**
       * Mean fit per rung, and nothing else.
       *
       * An earlier version multiplied the mean by the rung count, capped at
       * six — which is a *reward* for having six rungs, not a normalisation,
       * whatever the comment beside it claimed. Measured across the boundary it
       * put the median storey count at exactly 6 on a fabric whose own massing
       * model says 4–5, because the tightest spacing that reached six rungs won
       * regardless of whether the extra ones landed on anything.
       *
       * Mean alone is self-correcting: a ladder at half the true spacing puts
       * every second rung on blank wall, and the blank rungs drag the mean down.
       * The rung count is only used to reject a ladder too short to be a façade.
       */
      if (rungs < 2) continue;
      // A gentle pull toward the measured median, enough to break a tie between
      // two ladders the image supports equally and not enough to override one it
      // supports better. At the extremes of the range this costs about 8%.
      const fromMedian = Math.abs(spacing / ppm - STOREY_HEIGHT_M.median);
      const prior = 1 - Math.min(0.08, fromMedian * 0.06);
      const mean = (score / rungs) * prior;
      if (!best || mean > best.score) best = { spacing, phase, score: mean };
    }
  }
  if (!best) return [];
  const rungs: number[] = [];
  for (let y = best.phase; y < profile.length; y += best.spacing) rungs.push(y);
  return rungs;
}

/** Smooth a 1-D profile with a moving average, to merge one window's fragments. */
function smooth(values: Float32Array, radius: number): Float32Array {
  const out = new Float32Array(values.length);
  for (let i = 0; i < values.length; i++) {
    let sum = 0, n = 0;
    for (let j = Math.max(0, i - radius); j <= Math.min(values.length - 1, i + radius); j++) { sum += values[j]; n++; }
    out[i] = sum / n;
  }
  return out;
}

/**
 * Bands of a 1-D profile that stand above their surroundings.
 *
 * `minGapPx` keeps two adjacent windows from merging into one band, and
 * `minWidthPx` throws away a downpipe's worth of signal.
 */
function bands(profile: Float32Array, minWidthPx: number, minGapPx: number): Array<{ from: number; to: number; peak: number }> {
  const sorted = [...profile].sort((a, b) => a - b);
  const low = sorted[Math.floor(sorted.length * 0.25)];
  const high = sorted[Math.floor(sorted.length * 0.9)];
  if (high - low < 0.02) return [];
  const threshold = low + (high - low) * 0.45;

  const found: Array<{ from: number; to: number; peak: number }> = [];
  let start = -1;
  for (let i = 0; i <= profile.length; i++) {
    const above = i < profile.length && profile[i] >= threshold;
    if (above && start < 0) start = i;
    if (!above && start >= 0) {
      if (i - start >= minWidthPx) {
        let peak = 0;
        for (let j = start; j < i; j++) peak = Math.max(peak, profile[j]);
        const previous = found[found.length - 1];
        if (previous && start - previous.to < minGapPx) { previous.to = i; previous.peak = Math.max(previous.peak, peak); }
        else found.push({ from: start, to: i, peak });
      }
      start = -1;
    }
  }
  return found;
}

export interface MeasureOptions {
  pixelsPerMetre: number;
  /** Real-world height of the strip's base above ground, for reporting. */
  baseOffsetM?: number;
  /** Plausible window sizes for the fabric being measured, in metres. */
  minWindowW?: number;
  maxWindowW?: number;
  minWindowH?: number;
  maxWindowH?: number;
}

/**
 * Measure one rectified façade strip.
 *
 * Size limits are Amsterdam canal-house limits, and they do real work: a
 * *schuifraam* is roughly 0.9–1.8 m wide and 1.4–2.6 m tall, so a dark region
 * four metres across is a shadow or a shopfront, not a window, and one thirty
 * centimetres across is a downpipe.
 */
/**
 * Measure one rectified façade strip.
 *
 * Storey bands and bays are found first, from the whole image at once, and
 * openings are then confirmed cell by cell where the two cross. The size limits
 * are Amsterdam limits and they do real work: a *schuifraam* is roughly
 * 0.9–1.8 m wide and a storey is 2.4–4.2 m, so a band four metres deep is two
 * storeys read as one and a bay 0.3 m wide is a downpipe.
 */
export function measureFacade(
  image: { width: number; height: number; data: Uint8ClampedArray },
  options: MeasureOptions,
): FacadeMeasurement {
  const {
    pixelsPerMetre: ppm,
    minWindowW = 0.5, maxWindowW = 2.6,
    minWindowH = 0.7, maxWindowH = 3.2,
  } = options;

  const gray = toGray(image);
  const { width, height } = gray;
  const blueExcess = new Int16Array(width * height);
  for (let i = 0, p = 0; i < blueExcess.length; i++, p += 4) blueExcess[i] = image.data[p + 2] - image.data[p];
  const score = openingScore(gray, blueExcess, Math.max(24, Math.round(ppm * 1.2)));
  const obstructions = suppressObstructions(score, width, height);

  // Horizontal bands: sum each row. A storey's windows all sit at the same
  // height, so their combined signal survives any one of them being obscured.
  const rowProfile = new Float32Array(height);
  for (let y = 0; y < height; y++) {
    let sum = 0;
    for (let x = 0; x < width; x++) sum += score[y * width + x];
    rowProfile[y] = sum / width;
  }
  const smoothedRows = smooth(rowProfile, Math.round(ppm * 0.12));
  const rungs = storeyLadder(smoothedRows, ppm);
  const halfBand = Math.round(Math.min(maxWindowH, 2.4) * ppm * 0.5);
  const storeyBands = rungs
    .map(y => ({ from: Math.max(0, Math.round(y - halfBand)), to: Math.min(height, Math.round(y + halfBand)), peak: 0 }))
    .filter(band => band.to - band.from > minWindowH * ppm * 0.5);

  // Vertical bays: sum each column, but only over the rows that a storey band
  // occupies. Including the wall between storeys buries the signal in brick.
  const columnProfile = new Float32Array(width);
  let bandRows = 0;
  for (const band of storeyBands) {
    for (let y = band.from; y < band.to; y++, bandRows++) {
      for (let x = 0; x < width; x++) columnProfile[x] += score[y * width + x];
    }
  }
  if (bandRows) for (let x = 0; x < width; x++) columnProfile[x] /= bandRows;
  const bayBands = bands(smooth(columnProfile, Math.round(ppm * 0.1)), Math.round(minWindowW * ppm * 0.55), Math.round(ppm * 0.3));

  // Confirm an opening in each cell where a bay crosses a storey. Knowing where
  // to look is what makes this tractable: the question becomes "is this
  // rectangle darker than the wall beside it", which survives a pale frame and
  // a net curtain that defeat a blob search.
  const openings: Opening[] = [];
  for (const band of storeyBands) {
    for (const bay of bayBands) {
      let inside = 0, n = 0;
      for (let y = band.from; y < band.to; y++) {
        for (let x = bay.from; x < bay.to; x++) { inside += score[y * width + x]; n++; }
      }
      if (!n) continue;
      const mean = inside / n;
      if (mean < 0.14) continue;

      // Tighten the cell to the part that actually carries the signal, so the
      // reported size is the opening's and not the search window's.
      const tighten = (from: number, to: number, at: (i: number) => number) => {
        let lo = from, hi = to - 1;
        while (lo < hi && at(lo) < mean * 0.6) lo++;
        while (hi > lo && at(hi) < mean * 0.6) hi--;
        return [lo, hi] as const;
      };
      const [y0, y1] = tighten(band.from, band.to, y => {
        let sum = 0;
        for (let x = bay.from; x < bay.to; x++) sum += score[y * width + x];
        return sum / (bay.to - bay.from);
      });
      const [x0, x1] = tighten(bay.from, bay.to, x => {
        let sum = 0;
        for (let y = band.from; y < band.to; y++) sum += score[y * width + x];
        return sum / (band.to - band.from);
      });

      const widthM = (x1 - x0 + 1) / ppm, heightM = (y1 - y0 + 1) / ppm;
      if (widthM < minWindowW || widthM > maxWindowW) continue;
      if (heightM < minWindowH || heightM > maxWindowH) continue;

      let sum = 0;
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) sum += gray.data[y * width + x];
      openings.push({
        xM: x0 / ppm,
        yM: (height - y1 - 1) / ppm,
        widthM, heightM,
        darkness: sum / ((y1 - y0 + 1) * (x1 - x0 + 1)),
      });
    }
  }

  const storeys: Storey[] = storeyBands.map(band => ({
    centreM: (height - (band.from + band.to) / 2) / ppm,
    openings: openings.filter(o => {
      const centre = (height - (o.yM + o.heightM / 2) * ppm);
      return centre >= band.from && centre <= band.to;
    }).length,
  })).filter(storey => storey.openings > 0);

  const storeyHeightsM: number[] = [];
  const ordered = [...storeys].sort((a, b) => a.centreM - b.centreM);
  for (let i = 1; i < ordered.length; i++) storeyHeightsM.push(Number((ordered[i].centreM - ordered[i - 1].centreM).toFixed(2)));

  const bayOffsetsM = bayBands
    .filter(bay => openings.some(o => o.xM * ppm >= bay.from - ppm * 0.3 && (o.xM + o.widthM) * ppm <= bay.to + ppm * 0.3))
    .map(bay => Number((((bay.from + bay.to) / 2) / ppm).toFixed(2)));

  return {
    obstructionColumns: obstructions,
    openings,
    storeys: ordered,
    bays: bayOffsetsM.length,
    bayOffsetsM,
    storeyHeightsM,
    groundOpenings: openings.filter(o => o.yM < 0.8),
  };
}
