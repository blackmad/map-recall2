/**
 * F3 (#381): white bands (speklagen, string courses, continuous lintel bands) and white window surrounds read from the pixels of a
 * rectified facade crop. No model reads these (J3: Gemini finds 3 of 12 bands and 1 of 23 surrounds, Jev is near chance), so the
 * stored value comes from here, the register text or a hand label; the models' "yes" is a positive-only signal.
 *
 * Bands: rows of the body whose light-pixel share is high, thin (a few cm to half a metre), and set off from the rows around them.
 * Surrounds: dark openings (windows) whose left, right and top edges are lined by a light strip outside the opening.
 * Light = a pixel clearly lighter than the wall and not saturated (white, cream, pale stone). Pure; scored on the hand set by
 * scripts/house-crops/f3/score-accents.mjs.
 */
export type RgbCrop = {width: number; height: number; rgb: Uint8Array; ppm: number};
export type AccentParams = {
  /** body rows (share of the crop height) that bands are searched in: above is sky / crown, below is the shopfront */
  rows: [number, number];
  /** the ground storey (shopfront, entrance) is left out: bands are searched this many metres above the crop bottom ... */ groundM: number;
  /** ... in the pier columns only: a column is a pier when at most this share of its body rows is dark (a window column is not) */ pierDark: number;
  /** a light pixel is this much lighter than the wall (0-255 luma) ... */
  lightDelta: number; /** ... or at least this light outright */ lightAbs: number; /** ... and no more saturated than this (max-min)/max */ maxSat: number;
  /** a band row has at least this share of light pixels, runs 0.06-0.6 m thick, and the rows 0.2-0.5 m around it average under `contrast` x its share */
  rowShare: number; minM: number; maxM: number; contrast: number;
  /** rows with at least this share are sky or an all-white wall, not a band */
  skyShare: number;
  /** a crop shows bands when it has at least this many */
  minBands: number;
  /** surrounds: strip widths (m) beside the opening, share of the strip that is light, the sides that must pass, openings that must have a surround */
  stripM: [number, number]; /** the strip also reaches this far (m) inside the opening's edge: a painted frame sits on it */ innerM: number; stripShare: number; sides: number; openingShare: number; minOpenings: number;
  /** an opening is a connected dark region this wide and tall (m) */
  openingW: [number, number]; openingH: [number, number]; darkDelta: number;
};
export const ACCENT_DEFAULTS: AccentParams = {
  rows: [0.22, 0.85], groundM: 3.4, pierDark: 0.25, lightDelta: 28, lightAbs: 185, maxSat: 0.32, rowShare: 0.6, minM: 0.06, maxM: 0.45, contrast: 0.5, skyShare: 0.92, minBands: 1,
  stripM: [0.05, 0.3], innerM: 0.1, stripShare: 0.5, sides: 3, openingShare: 0.5, minOpenings: 2, openingW: [0.4, 2.6], openingH: [0.6, 3.6], darkDelta: 38,
};

const lumaOf = (c: RgbCrop, p: number) => 0.299 * c.rgb[p * 3] + 0.587 * c.rgb[p * 3 + 1] + 0.114 * c.rgb[p * 3 + 2];
const satOf = (c: RgbCrop, p: number) => { const mx = Math.max(c.rgb[p * 3], c.rgb[p * 3 + 1], c.rgb[p * 3 + 2]), mn = Math.min(c.rgb[p * 3], c.rgb[p * 3 + 1], c.rgb[p * 3 + 2]); return mx ? (mx - mn) / mx : 0; };

/** Median luma of the body (rows 30-75 %, columns 10-90 %): the wall, since windows are a minority of it. */
export function wallLuma(c: RgbCrop): number {
  const v: number[] = [];
  for (let y = Math.floor(c.height * 0.3); y < c.height * 0.75; y += 3) for (let x = Math.floor(c.width * 0.1); x < c.width * 0.9; x += 3) v.push(lumaOf(c, y * c.width + x));
  v.sort((a, b) => a - b); return v.length ? v[v.length >> 1] : 128;
}
export function lightMask(c: RgbCrop, wall: number, p: AccentParams): Uint8Array {
  const m = new Uint8Array(c.width * c.height), thr = Math.min(p.lightAbs, wall + p.lightDelta);
  for (let i = 0; i < m.length; i++) if (lumaOf(c, i) >= Math.max(thr, p.lightAbs - 40) && satOf(c, i) <= p.maxSat && lumaOf(c, i) >= wall + p.lightDelta * 0.6) m[i] = 1;
  return m;
}

export type Band = {y0M: number; y1M: number; share: number};
export function detectBands(c: RgbCrop, params: Partial<AccentParams> = {}): {present: boolean; bands: Band[]; wall: number} {
  const p = {...ACCENT_DEFAULTS, ...params}, wall = wallLuma(c), m = lightMask(c, wall, p), {width: W, height: H, ppm} = c;
  const x0 = Math.floor(W * 0.08), x1 = Math.ceil(W * 0.92), share = new Float64Array(H);
  // pier columns: not dark over the body rows (windows are dark or framed; the wall between them is where a band must show)
  const piers: number[] = [], ya = Math.floor(H * 0.25), yb = Math.floor(H * 0.8);
  for (let x = x0; x < x1; x++) { let d = 0, n = 0; for (let y = ya; y < yb; y += 2) { n++; if (lumaOf(c, y * W + x) < wall - 30) d++; } if (d / Math.max(1, n) <= p.pierDark) piers.push(x); }
  const cols = piers.length >= (x1 - x0) * 0.15 ? piers : Array.from({length: x1 - x0}, (_, i) => x0 + i);
  for (let y = 0; y < H; y++) { let n = 0; for (const x of cols) n += m[y * W + x]; share[y] = n / Math.max(1, cols.length); }
  const sm = new Float64Array(H); for (let y = 0; y < H; y++) { let s = 0, n = 0; for (let k = -1; k <= 1; k++) if (y + k >= 0 && y + k < H) { s += share[y + k]; n++; } sm[y] = s / n; }
  const yA = Math.floor(H * p.rows[0]), yB = Math.min(Math.floor(H * p.rows[1]), Math.floor(H - p.groundM * ppm)), bands: Band[] = [];
  let y = yA;
  while (y < yB) {
    if (sm[y] < p.rowShare || sm[y] >= p.skyShare) { y++; continue; }
    let e = y; while (e < yB && sm[e] >= p.rowShare && sm[e] < p.skyShare) e++;
    const t = (e - y) / ppm;
    if (t >= p.minM && t <= p.maxM) {
      let mean = 0, mn = 0; for (let k = y; k < e; k++) { mean += sm[k]; mn++; } mean /= mn;
      const around = (a: number, b: number) => { let s = 0, n = 0; for (let k = Math.max(0, a); k < Math.min(H, b); k++) { s += sm[k]; n++; } return n ? s / n : 0; };
      const above = around(y - Math.round(0.5 * ppm), y - Math.round(0.2 * ppm)), below = around(e + Math.round(0.2 * ppm), e + Math.round(0.5 * ppm));
      if (above <= p.contrast * mean && below <= p.contrast * mean) bands.push({y0M: +(y / ppm).toFixed(2), y1M: +(e / ppm).toFixed(2), share: +mean.toFixed(2)});
    }
    y = e;
  }
  return {present: bands.length >= p.minBands, bands, wall};
}

type Opening = {x0: number; x1: number; y0: number; y1: number};
/** Dark openings: 4-connected dark regions on a 0.05 m grid, closed over 0.1 m so window bars do not split a window, kept when window-sized and filled enough. */
export function findOpenings(c: RgbCrop, wall: number, p: AccentParams): Opening[] {
  const g = Math.max(2, Math.round(0.05 * c.ppm)), gw = Math.floor(c.width / g), gh = Math.floor(c.height / g);
  const dark = new Uint8Array(gw * gh);
  for (let gy = 0; gy < gh; gy++) for (let gx = 0; gx < gw; gx++) { let s = 0, n = 0; for (let y = gy * g; y < (gy + 1) * g; y += 2) for (let x = gx * g; x < (gx + 1) * g; x += 2) { s += lumaOf(c, y * c.width + x); n++; } if (s / n < wall - p.darkDelta) dark[gy * gw + gx] = 1; }
  const closed = new Uint8Array(dark); const k = 2;
  for (let gy = 0; gy < gh; gy++) for (let gx = 0; gx < gw; gx++) if (!dark[gy * gw + gx]) { // fill a 1-2 cell gap between dark cells on the same row or column
    let h = false, v = false;
    for (let a = 1; a <= k && !h; a++) if (gx - a >= 0 && gx + (k + 1 - a) < gw && dark[gy * gw + gx - a] && dark[gy * gw + gx + (k + 1 - a)]) h = true;
    for (let a = 1; a <= k && !v; a++) if (gy - a >= 0 && gy + (k + 1 - a) < gh && dark[(gy - a) * gw + gx] && dark[(gy + (k + 1 - a)) * gw + gx]) v = true;
    if (h || v) closed[gy * gw + gx] = 1;
  }
  const out: Opening[] = [], seen = new Uint8Array(gw * gh), stack: number[] = [];
  for (let s = 0; s < closed.length; s++) {
    if (!closed[s] || seen[s]) continue;
    let x0 = gw, x1 = 0, y0 = gh, y1 = 0, n = 0; seen[s] = 1; stack.push(s);
    while (stack.length) { const q = stack.pop()!, qx = q % gw, qy = (q / gw) | 0; n++; x0 = Math.min(x0, qx); x1 = Math.max(x1, qx); y0 = Math.min(y0, qy); y1 = Math.max(y1, qy);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) { const nx = qx + dx, ny = qy + dy; if (nx < 0 || ny < 0 || nx >= gw || ny >= gh) continue; const r = ny * gw + nx; if (closed[r] && !seen[r]) { seen[r] = 1; stack.push(r); } } }
    const wM = (x1 - x0 + 1) * g / c.ppm, hM = (y1 - y0 + 1) * g / c.ppm;
    if (wM < p.openingW[0] || wM > p.openingW[1] || hM < p.openingH[0] || hM > p.openingH[1]) continue;
    if (n < 0.45 * (x1 - x0 + 1) * (y1 - y0 + 1)) continue; // a ragged shadow, not a rectangle
    if (y1 * g < c.height * 0.18 || y0 * g > c.height * 0.8) continue; // sky-side or shopfront-side
    out.push({x0: x0 * g, x1: (x1 + 1) * g, y0: y0 * g, y1: (y1 + 1) * g});
  }
  return out;
}

export function detectSurrounds(c: RgbCrop, params: Partial<AccentParams> = {}): {present: boolean; openings: number; framed: number; wall: number} {
  const p = {...ACCENT_DEFAULTS, ...params}, wall = wallLuma(c), m = lightMask(c, wall, p), ops = findOpenings(c, wall, p), {width: W, height: H, ppm} = c;
  const s0 = Math.round(p.stripM[0] * ppm), s1 = Math.max(s0 + 1, Math.round(p.stripM[1] * ppm)), inn = Math.round(p.innerM * ppm);
  const lit = (xa: number, xb: number, ya: number, yb: number) => { let n = 0, t = 0; for (let y = Math.max(0, ya); y < Math.min(H, yb); y++) for (let x = Math.max(0, xa); x < Math.min(W, xb); x++) { t++; n += m[y * W + x]; } return t ? n / t : 0; };
  let framed = 0;
  for (const o of ops) {
    const sides = [lit(o.x0 - s1, o.x0 + inn, o.y0, o.y1) >= p.stripShare, lit(o.x1 - inn, o.x1 + s1, o.y0, o.y1) >= p.stripShare, lit(o.x0, o.x1, o.y0 - s1, o.y0 + inn) >= p.stripShare].filter(Boolean).length;
    if (sides >= p.sides) framed++;
  }
  return {present: ops.length >= p.minOpenings && framed / ops.length >= p.openingShare, openings: ops.length, framed, wall};
}

/** measureFacade's opening mask (cells of `cell` m, row 0 at v1; `isOpening(code)` true for dark / frame cells) read as openings, then the same ring test as detectSurrounds. Glass that reflects the sky is light, so the colour-only `findOpenings` misses those windows and the mask does not. */
export function detectSurroundsFromMask(c: RgbCrop, mask: {cols: number; rows: number; cell: number; u0: number; topM: number; v1: number; isOpening: (code: number) => boolean; data: Uint8Array}, params: Partial<AccentParams> = {}): {present: boolean; openings: number; framed: number} {
  const p = {...ACCENT_DEFAULTS, ...params}, wall = wallLuma(c), lm = lightMask(c, wall, p), {cols, rows, cell} = mask, {width: W, height: H, ppm} = c;
  const seen = new Uint8Array(cols * rows), stack: number[] = [], ops: Opening[] = [];
  for (let s = 0; s < mask.data.length; s++) {
    if (seen[s] || !mask.isOpening(mask.data[s])) continue;
    let x0 = cols, x1 = 0, y0 = rows, y1 = 0, n = 0; seen[s] = 1; stack.push(s);
    while (stack.length) { const q = stack.pop()!, qx = q % cols, qy = (q / cols) | 0; n++; x0 = Math.min(x0, qx); x1 = Math.max(x1, qx); y0 = Math.min(y0, qy); y1 = Math.max(y1, qy);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) { const nx = qx + dx, ny = qy + dy; if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue; const r = ny * cols + nx; if (!seen[r] && mask.isOpening(mask.data[r])) { seen[r] = 1; stack.push(r); } } }
    const wM = (x1 - x0 + 1) * cell, hM = (y1 - y0 + 1) * cell;
    if (wM < p.openingW[0] || wM > p.openingW[1] || hM < p.openingH[0] || hM > p.openingH[1] || n < 0.5 * (x1 - x0 + 1) * (y1 - y0 + 1)) continue;
    const px0 = Math.round((mask.u0 + x0 * cell) * ppm), px1 = Math.round((mask.u0 + (x1 + 1) * cell) * ppm), py0 = Math.round((mask.topM - (mask.v1 - y0 * cell)) * ppm), py1 = Math.round((mask.topM - (mask.v1 - (y1 + 1) * cell)) * ppm);
    if (py1 > H - p.groundM * ppm + 0.5 * ppm) continue; // the ground storey's openings are not asked
    ops.push({x0: px0, x1: px1, y0: py0, y1: py1});
  }
  const s0 = Math.round(p.stripM[0] * ppm), s1 = Math.max(s0 + 1, Math.round(p.stripM[1] * ppm)), inn = Math.round(p.innerM * ppm);
  const lit = (xa: number, xb: number, ya: number, yb: number) => { let n = 0, t = 0; for (let y = Math.max(0, ya); y < Math.min(H, yb); y++) for (let x = Math.max(0, xa); x < Math.min(W, xb); x++) { t++; n += lm[y * W + x]; } return t ? n / t : 0; };
  let framed = 0;
  for (const o of ops) {
    const sides = [lit(o.x0 - s1, o.x0 + inn, o.y0, o.y1) >= p.stripShare, lit(o.x1 - inn, o.x1 + s1, o.y0, o.y1) >= p.stripShare, lit(o.x0, o.x1, o.y0 - s1, o.y0 + inn) >= p.stripShare].filter(Boolean).length;
    if (sides >= p.sides) framed++;
  }
  return {present: ops.length >= p.minOpenings && framed / ops.length >= p.openingShare, openings: ops.length, framed};
}
