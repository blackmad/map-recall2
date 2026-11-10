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

/** Image column of a lateral offset on the trunk plane, in image row `row` (default: the camera-height row). */
export function columnOfLateral(g: ViewGeometry, lateral: number, row = rowOfHeight(g, g.cameraHeight)): number {
  const f = (g.width / 2) / Math.tan((g.fovDeg / 2) * DEG), y = (g.height / 2 - row - 0.5) / f, p = g.pitchDeg * DEG;
  const fw = Math.cos(p) - y * Math.sin(p);
  return g.width / 2 + (lateral * fw / g.distance) * f - 0.5;
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
  let maxW = 0, widestRow = bestTop, capped = false, filled = 0, area = 0;
  const rows: Array<[number, number]> = [];
  for (let y = bestTop; y <= bestBottom; y++) {
    const lc = Math.max(0, Math.floor(columnOfLateral(g, left, y))), rc = Math.min(W - 1, Math.ceil(columnOfLateral(g, right, y)));
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

/** A canopy-height grid (metres above ground), row-major, north row first, `cell` metres per pixel, centred on the trunk. */
export interface CanopyGrid { width: number; height: number; cell: number; chm: Float32Array | number[]; }

export interface CanopyMeasure {
  /** Highest canopy within 2 m of the trunk, metres. */
  top: number;
  /** Crown width across the row (or the mean of four directions for a lone tree), metres. */
  width: number;
  /** Crown width along the row; a lower bound when the next crown touches it. */
  along: number;
}

/**
 * Crown width from the AHN canopy height model: walk out from the trunk until the canopy falls below half of the
 * tree's top (or rises 1.5 m above it: a building), at most 0.75 × top. `row` is the unit [east, north] row axis.
 */
export function measureCanopy(g: CanopyGrid, row: [number, number] | null): CanopyMeasure | null {
  const cx = g.width / 2, cy = g.height / 2;
  // Leaf-off returns are sparse inside a deciduous crown: a 3 × 3 max filter fills the gaps between branches; the
  // half-window it adds on each side is taken off the widths again (DILATE_BIAS).
  const k = 1, D = new Float32Array(g.width * g.height);
  for (let r = 0; r < g.height; r++) for (let c = 0; c < g.width; c++) {
    let m = NaN;
    for (let dr = -k; dr <= k; dr++) for (let dc = -k; dc <= k; dc++) { const rr = r + dr, cc = c + dc; if (rr >= 0 && cc >= 0 && rr < g.height && cc < g.width) { const v = g.chm[rr * g.width + cc]; if (v > m || Number.isNaN(m)) m = v; } }
    D[r * g.width + c] = m;
  }
  const DILATE_BIAS = 2 * k * g.cell;
  const at = (e: number, n: number) => {
    const c = Math.floor(cx + e / g.cell), r = Math.floor(cy - n / g.cell);
    return c < 0 || r < 0 || c >= g.width || r >= g.height ? NaN : D[r * g.width + c];
  };
  let top = -Infinity;
  for (let e = -2; e <= 2; e += g.cell) for (let n = -2; n <= 2; n += g.cell) if (e * e + n * n <= 4) { const v = at(e, n); if (v > top) top = v; }
  if (!(top > 2)) return null;
  const limit = Math.max(2, 0.5 * top), reach = 0.75 * top;
  const walk = (de: number, dn: number) => {
    let s = 0;
    for (let d = g.cell / 2; d <= reach; d += g.cell / 2) {
      const v = at(de * d, dn * d);
      if (!(v >= limit) || v > top + 1.5) break;
      s = d;
    }
    return s;
  };
  const span = (de: number, dn: number) => Math.max(0, walk(de, dn) + walk(-de, -dn) - DILATE_BIAS);
  const axis: [number, number] = row ?? [1, 0];
  const across = span(-axis[1], axis[0]), along = span(axis[0], axis[1]);
  const width = row ? across : (across + along + span(Math.SQRT1_2, Math.SQRT1_2) + span(Math.SQRT1_2, -Math.SQRT1_2)) / 4;
  return { top: +top.toFixed(2), width: +width.toFixed(2), along: +along.toFixed(2) };
}

/**
 * Crown width from a leaf-on orthophoto (PDOK 2024_orthoHR, flown in summer) masked by "something tall here" from the
 * leaf-off AHN canopy height: green pixels over lawns, hedges and water fail the height test, branches without leaves
 * fail the colour test. The crown is the masked component nearest the trunk (an ortho is not a true ortho: a tall
 * crown leans away from nadir by a few metres); its width is its extent across the row axis within a 3 m band along
 * the row (or the mean of across and along for a lone tree). The grid is centred on the trunk, north row first.
 */
export interface OrthoGrid { width: number; height: number; cell: number; rgb: Uint8Array | Uint8ClampedArray; channels: number; tall: (e: number, n: number) => boolean; }
export interface OrthoCrown { width: number; along: number; offset: number; pixels: number; }

export const isLeafOn = (r: number, g: number, b: number): boolean => { const s = r + g + b; return s > 30 && 2 * g - r - b > 0.04 * s && g >= b; };

/** Half the distance to the nearest inventory tree on each side, across and along the row axis (metres, positive). */
export interface CrownCaps { left: number; right: number; back: number; front: number; }

export function measureOrthoCrown(o: OrthoGrid, row: [number, number] | null, reach: number, caps: CrownCaps = { left: Infinity, right: Infinity, back: Infinity, front: Infinity }): OrthoCrown | null {
  const { width: W, height: H, cell } = o, cx = W / 2, cy = H / 2;
  const en = (i: number): [number, number] => [((i % W) + 0.5 - cx) * cell, (cy - Math.floor(i / W) - 0.5) * cell];
  const ok = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) {
    const [e, n] = en(i);
    if (e * e + n * n > reach * reach) continue;
    if (isLeafOn(o.rgb[i * o.channels], o.rgb[i * o.channels + 1], o.rgb[i * o.channels + 2]) && o.tall(e, n)) ok[i] = 1;
  }
  let seed = -1, bestD = 3.5 * 3.5;
  for (let i = 0; i < W * H; i++) if (ok[i]) { const [e, n] = en(i), d = e * e + n * n; if (d < bestD) { bestD = d; seed = i; } }
  if (seed < 0) return null;
  const comp: number[] = [], seen = new Uint8Array(W * H), stack = [seed]; seen[seed] = 1;
  while (stack.length) {
    const i = stack.pop()!; comp.push(i);
    const x = i % W, y = (i / W) | 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const xx = x + dx, yy = y + dy, j = yy * W + xx;
      if (xx >= 0 && yy >= 0 && xx < W && yy < H && ok[j] && !seen[j]) { seen[j] = 1; stack.push(j); }
    }
  }
  const axis = row ?? [1, 0], perp: [number, number] = [-axis[1], axis[0]];
  const [se, sn] = en(seed), sAlong = se * axis[0] + sn * axis[1], sAcross = se * perp[0] + sn * perp[1];
  let a0 = Infinity, a1 = -Infinity, l0 = Infinity, l1 = -Infinity;
  for (const i of comp) {
    const [e, n] = en(i), al = e * axis[0] + n * axis[1], ac = e * perp[0] + n * perp[1];
    // A neighbour's crown begins halfway to its trunk: canopy that runs on into it is not this tree's.
    if (Math.abs(al - sAlong) <= 1.5 && ac >= -caps.left && ac <= caps.right) { a0 = Math.min(a0, ac); a1 = Math.max(a1, ac); }
    if (Math.abs(ac - sAcross) <= 1.5 && al >= -caps.back && al <= caps.front) { l0 = Math.min(l0, al); l1 = Math.max(l1, al); }
  }
  if (!(a1 >= a0) || !(l1 >= l0)) return null;
  const across = a1 - a0 + cell, along = l1 - l0 + cell;
  return { width: +(row ? across : (across + along) / 2).toFixed(2), along: +along.toFixed(2), offset: +Math.sqrt(bestD).toFixed(2), pixels: comp.length };
}
