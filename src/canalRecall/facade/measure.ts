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
 * Openings are dark against their wall, but "dark" is local.
 *
 * A single global threshold fails on a canal terrace within one image: a
 * whitewashed house and a sooted brick one differ more from each other than a
 * window differs from its own wall. The threshold is therefore taken per column
 * band, against the brick immediately beside the opening.
 */
function darkMask(gray: Gray, bandPx: number, blueExcess?: Int16Array): Uint8Array {
  const { width, height, data } = gray;
  const mask = new Uint8Array(width * height);
  const bands = Math.max(1, Math.round(width / bandPx));
  for (let b = 0; b < bands; b++) {
    const from = Math.floor((b * width) / bands), to = Math.floor(((b + 1) * width) / bands);
    const values: number[] = [];
    for (let y = 0; y < height; y++) for (let x = from; x < to; x++) values.push(data[y * width + x]);
    values.sort((a, b2) => a - b2);
    // The wall is the bright majority; openings sit in the lower tail. The 65th
    // percentile stands in for "the wall", and a fixed fraction below it is dark.
    const wall = values[Math.floor(values.length * 0.65)];
    // 0.78 rather than 0.62: a window with a pale frame and a net curtain is
    // only moderately darker than its brick, and the tighter threshold found
    // only the near-black ones.
    const threshold = wall * 0.78;
    for (let y = 0; y < height; y++) {
      for (let x = from; x < to; x++) {
        const index = y * width + x;
        // Glass reads two ways depending on the sky: darker than brick when it
        // shows a room, distinctly bluer when it reflects sky. Either counts,
        // because a rule that only knows the first misses every sunlit façade.
        const reflectsSky = blueExcess ? blueExcess[index] > 26 : false;
        if (data[index] < threshold || reflectsSky) mask[index] = 1;
      }
    }
  }
  return mask;
}

interface Component { minX: number; maxX: number; minY: number; maxY: number; area: number; sum: number }

function components(mask: Uint8Array, width: number, height: number): Component[] {
  const seen = new Uint8Array(mask.length);
  const found: Component[] = [];
  const stack: number[] = [];
  for (let start = 0; start < mask.length; start++) {
    if (!mask[start] || seen[start]) continue;
    stack.length = 0;
    stack.push(start);
    seen[start] = 1;
    const box = { minX: width, maxX: -1, minY: height, maxY: -1, area: 0, sum: 0 };
    while (stack.length) {
      const index = stack.pop()!;
      const x = index % width, y = (index / width) | 0;
      box.minX = Math.min(box.minX, x); box.maxX = Math.max(box.maxX, x);
      box.minY = Math.min(box.minY, y); box.maxY = Math.max(box.maxY, y);
      box.area++;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        const next = ny * width + nx;
        if (mask[next] && !seen[next]) { seen[next] = 1; stack.push(next); }
      }
    }
    found.push(box);
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
export function measureFacade(
  image: { width: number; height: number; data: Uint8ClampedArray },
  options: MeasureOptions,
): FacadeMeasurement {
  const {
    pixelsPerMetre: ppm,
    minWindowW = 0.5, maxWindowW = 2.4,
    minWindowH = 0.7, maxWindowH = 3.2,
  } = options;

  const gray = toGray(image);
  const blueExcess = new Int16Array(gray.width * gray.height);
  for (let i = 0, p = 0; i < blueExcess.length; i++, p += 4) blueExcess[i] = image.data[p + 2] - image.data[p];
  const mask = darkMask(gray, Math.max(24, Math.round(ppm * 1.2)), blueExcess);
  const raw = components(mask, gray.width, gray.height);

  const openings: Opening[] = [];
  for (const box of raw) {
    const widthM = (box.maxX - box.minX + 1) / ppm;
    const heightM = (box.maxY - box.minY + 1) / ppm;
    if (widthM < minWindowW || widthM > maxWindowW) continue;
    if (heightM < minWindowH || heightM > maxWindowH) continue;
    // A window is a filled rectangle. A branch or railing spans a big box with
    // little inside it, and gets rejected on fill.
    const fill = box.area / ((box.maxX - box.minX + 1) * (box.maxY - box.minY + 1));
    if (fill < 0.55) continue;
    // Upright: Dutch sash windows are taller than wide, or nearly square.
    if (heightM / widthM < 0.7) continue;

    let sum = 0;
    for (let y = box.minY; y <= box.maxY; y++) for (let x = box.minX; x <= box.maxX; x++) sum += gray.data[y * gray.width + x];
    openings.push({
      xM: box.minX / ppm,
      yM: (gray.height - box.maxY - 1) / ppm,
      widthM, heightM,
      darkness: sum / ((box.maxY - box.minY + 1) * (box.maxX - box.minX + 1)),
    });
  }

  // Storeys: cluster openings by the height of their sills. A storey band is a
  // run of openings whose sills agree to well within a storey height.
  const byHeight = [...openings].sort((a, b) => a.yM - b.yM);
  const storeys: Storey[] = [];
  let band: Opening[] = [];
  for (const opening of byHeight) {
    if (band.length && opening.yM - band[band.length - 1].yM > 1.0) {
      storeys.push({ centreM: band.reduce((s, o) => s + o.yM + o.heightM / 2, 0) / band.length, openings: band.length });
      band = [];
    }
    band.push(opening);
  }
  if (band.length) storeys.push({ centreM: band.reduce((s, o) => s + o.yM + o.heightM / 2, 0) / band.length, openings: band.length });

  const storeyHeightsM: number[] = [];
  for (let i = 1; i < storeys.length; i++) storeyHeightsM.push(Number((storeys[i].centreM - storeys[i - 1].centreM).toFixed(2)));

  // Bays: cluster opening centres horizontally. A bay is a vertical column of
  // windows, so its members come from different storeys at the same offset.
  const centres = openings.map(o => o.xM + o.widthM / 2).sort((a, b) => a - b);
  const bayOffsetsM: number[] = [];
  let group: number[] = [];
  for (const centre of centres) {
    if (group.length && centre - group[group.length - 1] > 0.7) {
      bayOffsetsM.push(Number((group.reduce((s, v) => s + v, 0) / group.length).toFixed(2)));
      group = [];
    }
    group.push(centre);
  }
  if (group.length) bayOffsetsM.push(Number((group.reduce((s, v) => s + v, 0) / group.length).toFixed(2)));

  const groundOpenings = openings.filter(o => o.yM < 0.6);

  return { openings, storeys, bays: bayOffsetsM.length, bayOffsetsM, storeyHeightsM, groundOpenings };
}
