/**
 * Tree silhouette measurement from an aimed panorama view (lane T-shape #371).
 *
 * The Gemeente Amsterdam panorama thumbnail endpoint renders a pinhole view with a known horizontal field of view,
 * aspect and pitch, aimed at a heading. A municipal tree at a known horizontal distance `d` sits on the vertical plane
 * `forward = d`; every pixel ray is intersected with that plane, so a foliage pixel becomes (lateral, height) in metres.
 * The crown is the foliage run in the columns over the trunk; its width is the widest row run, its base the lowest
 * foliage above the camera horizon (below the horizon background lawn and hedges are indistinguishable, so a base
 * there is reported as censored at the camera height).
 *
 * Pure: no I/O, so `silhouetteMeasure.test.ts` exercises it on synthetic frames.
 */

export interface ViewGeometry {
  width: number;
  height: number;
  /** Horizontal field of view, degrees. */
  fovDeg: number;
  /** Camera pitch, degrees (positive looks up). */
  pitchDeg: number;
  /** Camera height above the tree's ground, metres. */
  cameraHeight: number;
  /** Horizontal distance from the camera to the trunk, metres. */
  distance: number;
}

export interface CrownMeasure {
  /** Crown top above ground, metres. */
  top: number;
  /** Lowest foliage above ground, metres; `baseCensored` when it reached the horizon. */
  base: number;
  baseCensored: boolean;
  /** Widest crown run, metres. */
  width: number;
  /** Height of the widest row, metres. */
  widestAt: number;
  /** The run touched a neighbour midpoint (width is a lower bound) or the image edge. */
  widthCapped: boolean;
  topCut: boolean;
  /** Foliage share of the crown's bounding box, 0-1 (density / openness). */
  fill: number;
  /** Image column chosen as the trunk axis. */
  column: number;
  /** Width every 10 % of crown height (base → top), metres; the outline profile. */
  profile: number[];
}

const DEG = Math.PI / 180;

/** Focal length in pixels and the ray of pixel (u, v): [forward, up, right] in the horizontal camera frame. */
export function pixelRay(g: ViewGeometry, u: number, v: number): [number, number, number] {
  const f = (g.width / 2) / Math.tan((g.fovDeg / 2) * DEG);
  const x = (u + 0.5 - g.width / 2) / f, y = (g.height / 2 - v - 0.5) / f, p = g.pitchDeg * DEG;
  return [Math.cos(p) - y * Math.sin(p), Math.sin(p) + y * Math.cos(p), x];
}

/** Pixel → (lateral, height) on the trunk plane; null for a ray that never reaches it. */
export function onPlane(g: ViewGeometry, u: number, v: number): [number, number] | null {
  const [fw, up, rt] = pixelRay(g, u, v);
  if (fw <= 1e-6) return null;
  const t = g.distance / fw;
  return [t * rt, g.cameraHeight + t * up];
}

/** Image row (fractional) of a given height on the trunk plane at the centre column. */
export function rowOfHeight(g: ViewGeometry, height: number): number {
  const f = (g.width / 2) / Math.tan((g.fovDeg / 2) * DEG), e = Math.atan2(height - g.cameraHeight, g.distance) - g.pitchDeg * DEG;
  return g.height / 2 - Math.tan(e) * f - 0.5;
}

/** Image column of a lateral offset on the trunk plane. */
export function columnOfLateral(g: ViewGeometry, lateral: number): number {
  const f = (g.width / 2) / Math.tan((g.fovDeg / 2) * DEG);
  return g.width / 2 + (lateral / g.distance) * f - 0.5;
}

/**
 * Summer foliage: green dominates in chromaticity. Sky (blue/white), brick, render, asphalt and bark fail; dark shaded
 * leaves pass on chromaticity alone. Tuned on the 2026-11-10 summer frames (survey.json lists the threshold).
 */
export function isFoliage(r: number, g: number, b: number): boolean {
  const s = r + g + b;
  if (s < 45 || s > 690) return false;
  const exg = 2 * g - r - b;
  return exg > 0.06 * s + 4 && g >= b;
}

export function foliageMask(rgb: Uint8Array | Uint8ClampedArray, width: number, height: number, channels = 3): Uint8Array {
  const m = new Uint8Array(width * height);
  for (let i = 0; i < width * height; i++) m[i] = isFoliage(rgb[i * channels], rgb[i * channels + 1], rgb[i * channels + 2]) ? 1 : 0;
  return m;
}

/** Close gaps of up to `gap` pixels in each row and column (binary closing along axes). */
export function closeMask(mask: Uint8Array, width: number, height: number, gap: number): Uint8Array {
  const out = mask.slice();
  const fill = (get: (i: number) => number, set: (i: number) => void, n: number) => {
    let last = -1;
    for (let i = 0; i < n; i++) if (get(i)) { if (last >= 0 && i - last > 1 && i - last <= gap + 1) for (let k = last + 1; k < i; k++) set(k); last = i; }
  };
  for (let y = 0; y < height; y++) fill(i => mask[y * width + i], i => { out[y * width + i] = 1; }, width);
  const tmp = out.slice();
  for (let x = 0; x < width; x++) fill(i => tmp[i * width + x], i => { out[i * width + x] = 1; }, height);
  return out;
}

export interface MeasureOptions {
  /** Lateral metres either side of the expected trunk to search for the crown axis. */
  axisSearch?: number;
  /** Lateral limits (metres, negative = left) where a neighbour crown begins to share the view. */
  leftLimit?: number;
  rightLimit?: number;
  /** Expected tree height (inventory), metres: bounds the vertical search. */
  expectedHeight?: number;
}

export function measureCrown(maskIn: Uint8Array, g: ViewGeometry, o: MeasureOptions = {}): CrownMeasure | null {
  const { width: W, height: H } = g;
  const mask = closeMask(maskIn, W, H, Math.max(2, Math.round(W * 0.006)));
  const horizon = Math.min(H - 1, Math.max(0, Math.floor(rowOfHeight(g, g.cameraHeight))));
  const expected = o.expectedHeight ?? 15;
  const searchTop = Math.max(0, Math.floor(rowOfHeight(g, expected * 1.6 + 2)));
  const span = o.axisSearch ?? Math.max(1.2, g.distance * 0.08);
  const c0 = Math.max(0, Math.floor(columnOfLateral(g, -span))), c1 = Math.min(W - 1, Math.ceil(columnOfLateral(g, span)));
  // The crown axis: the column in the search band with the longest foliage run above the horizon.
  let best = -1, bestCol = -1, bestTop = 0, bestBottom = 0;
  for (let x = c0; x <= c1; x++) {
    let runTop = -1;
    for (let y = searchTop; y <= horizon + 1; y++) {
      const on = y <= horizon && mask[y * W + x];
      if (on && runTop < 0) runTop = y;
      if (!on && runTop >= 0) {
        const len = y - runTop;
        if (len > best) { best = len; bestCol = x; bestTop = runTop; bestBottom = y - 1; }
        runTop = -1;
      }
    }
  }
  if (bestCol < 0 || best < H * 0.04) return null;
  const left = o.leftLimit ?? -Infinity, right = o.rightLimit ?? Infinity;
  const lc = Math.max(0, Math.floor(columnOfLateral(g, left))), rc = Math.min(W - 1, Math.ceil(columnOfLateral(g, right)));
  let maxW = 0, widestRow = bestTop, capped = false, filled = 0, area = 0;
  const rows: Array<[number, number]> = [];
  for (let y = bestTop; y <= bestBottom; y++) {
    let a = bestCol, b = bestCol;
    while (a - 1 >= lc && mask[y * W + a - 1]) a--;
    while (b + 1 <= rc && mask[y * W + b + 1]) b++;
    if (!mask[y * W + bestCol]) { rows.push([0, 0]); continue; }
    const pl = onPlane(g, a, y), pr = onPlane(g, b + 1, y);
    if (!pl || !pr) continue;
    const w = pr[0] - pl[0];
    rows.push([w, onPlane(g, bestCol, y)![1]]);
    if (w > maxW) { maxW = w; widestRow = y; capped = a <= lc || b >= rc; }
    for (let x = a; x <= b; x++) filled += maskIn[y * W + x];
    area += b - a + 1;
  }
  const top = onPlane(g, bestCol, bestTop)![1];
  const baseRow = bestBottom;
  const baseCensored = baseRow >= horizon - 1;
  const base = baseCensored ? g.cameraHeight : onPlane(g, bestCol, baseRow + 1)![1];
  const profile: number[] = [];
  for (let k = 0; k < 10; k++) {
    const h0 = base + (top - base) * (k / 10), h1 = base + (top - base) * ((k + 1) / 10);
    let w = 0;
    for (const [rw, rh] of rows) if (rh >= h0 && rh <= h1) w = Math.max(w, rw);
    profile.push(+w.toFixed(2));
  }
  return {
    top: +top.toFixed(2), base: +base.toFixed(2), baseCensored, width: +maxW.toFixed(2), widestAt: +onPlane(g, bestCol, widestRow)![1].toFixed(2),
    widthCapped: capped, topCut: bestTop <= searchTop + 1 && bestTop <= 1, fill: area ? +(filled / area).toFixed(3) : 0, column: bestCol, profile,
  };
}

export type Outline = 'columnar' | 'conical' | 'ovoid' | 'rounded' | 'spreading';

/**
 * Outline class from the measured width/crown ratio and where the crown is widest:
 * narrow → columnar; widest in the lower third with a tapering top → conical; widest high and wide → spreading;
 * roughly as wide as tall → rounded; otherwise ovoid.
 */
export function outlineOf(width: number, crownHeight: number, widestFraction: number): Outline {
  const r = width / Math.max(0.1, crownHeight);
  if (r < 0.42) return 'columnar';
  if (widestFraction < 0.34 && r < 0.95) return 'conical';
  if (r > 1.15) return 'spreading';
  if (r > 0.82) return 'rounded';
  return 'ovoid';
}
