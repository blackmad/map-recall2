/**
 * Structured facade comparison: what a reference photo shows versus what a landmark GLB shows.
 *
 * A photo inventory (`<id>-elevations.json`, written from the reference photo, ideally by a reviewer
 * who has not seen the model) declares per facade: openings per row bottom→top, distinct window axes,
 * whether the opening pattern is mirror-symmetric, and how many gable peaks crown it. This module
 * renders the GLB orthographically along each facade's outward normal (a material-ID z-buffer, so
 * only visible glazing counts), finds the openings and measures the same things.
 *
 * Coordinates are the landmark GLB frame: x east, y up, z south (metres).
 */

export type MaterialSoup = {
  /** xyz triplets. */
  positions: Float32Array | number[];
  /** Vertex index triplets. */
  indices: Uint32Array | number[];
  /** One material index per triangle. */
  triMaterial: Uint16Array | number[];
  materials: {name: string; rgb: [number, number, number]}[];
};

export type FacadeInventory = {
  name: string;
  /** Compass bearing (degrees, 0 = north, 90 = east) of the facade's outward normal. */
  bearing: number;
  /** Openings per row, bottom row first, as counted on the photo. A row is one storey band. */
  rows?: number[];
  /** Distinct vertical window axes across the facade. */
  columns?: number;
  /** Is the opening pattern mirror-symmetric about the facade centre? */
  symmetric?: boolean;
  /** Number of separate gable/peak tops in the facade silhouette (0 for a flat cornice line). */
  gables?: number;
  /** Material names that count as openings (default glass). */
  openings?: string[];
  /** Restrict to [t0, t1] metres along the facade (viewer's left → right) when other wings face the same way. */
  span?: [number, number];
  /** Only geometry within this many metres of the facade's front-most plane counts (default 4). */
  depthBand?: number;
  /** Allowed per-row count difference (default 0; rows with ≥ 12 openings allow 1). */
  tolerance?: number;
  photo?: string;
  note?: string;
};

export type ElevationsFile = {id: string; source?: string; countedBy?: string; facades: FacadeInventory[]};

export type Opening = {t0: number; t1: number; y0: number; y1: number; area: number};

export type FacadeMeasure = {
  name: string;
  width: number;
  height: number;
  openings: Opening[];
  rows: number[];
  rowHeights: number[];
  columns: number;
  /** IoU of the opening mask with its mirror about the facade's silhouette centre. */
  symmetry: number;
  gables: number;
  /** Rendered elevation: RGB bytes, `cols × rowsPx`, top row first. */
  image: {data: Uint8Array; width: number; height: number; cell: number; tMin: number; yMax: number};
};

export type Check = {facade: string; what: string; expected: string; measured: string; pass: boolean};

const RAD = Math.PI / 180;

/** Outward unit normal (x east, z south) for a compass bearing. */
export function normalForBearing(bearing: number): [number, number] {
  return [Math.sin(bearing * RAD), -Math.cos(bearing * RAD)];
}

/**
 * Orthographic material render looking at the facade from outside. Pixel (i, j): i along the
 * viewer's left → right, j from the top. Depth = position · n (larger is nearer the viewer).
 */
export function renderElevation(soup: MaterialSoup, f: FacadeInventory, cell = 0.1) {
  const [nx, nz] = normalForBearing(f.bearing);
  const tx = nz, tz = -nx; // viewer's right when facing the wall from outside
  const P = soup.positions, I = soup.indices;
  const nv = P.length / 3;
  const T = new Float64Array(nv), Y = new Float64Array(nv), D = new Float64Array(nv);
  for (let v = 0; v < nv; v++) {
    const x = P[v * 3], y = P[v * 3 + 1], z = P[v * 3 + 2];
    T[v] = x * tx + z * tz; Y[v] = y; D[v] = x * nx + z * nz;
  }
  // Front-most plane: the 98th percentile of depth over vertices inside the span (robust to a stray sign).
  const inSpan = (t: number) => !f.span || (t >= f.span[0] && t <= f.span[1]);
  const depths: number[] = [];
  for (let v = 0; v < nv; v++) if (inSpan(T[v])) depths.push(D[v]);
  depths.sort((a, b) => a - b);
  const front = depths.length ? depths[Math.floor(depths.length * 0.98)] : 0;
  const minDepth = front - (f.depthBand ?? 4);

  let tMin = Infinity, tMax = -Infinity, yMin = Infinity, yMax = -Infinity;
  for (let v = 0; v < nv; v++) {
    if (!inSpan(T[v])) continue;
    tMin = Math.min(tMin, T[v]); tMax = Math.max(tMax, T[v]);
    yMin = Math.min(yMin, Y[v]); yMax = Math.max(yMax, Y[v]);
  }
  if (f.span) { tMin = Math.max(tMin, f.span[0]); tMax = Math.min(tMax, f.span[1]); }
  yMin = Math.min(0, yMin);
  const W = Math.max(1, Math.ceil((tMax - tMin) / cell)), H = Math.max(1, Math.ceil((yMax - yMin) / cell));
  const zbuf = new Float64Array(W * H).fill(-Infinity);
  const mat = new Int32Array(W * H).fill(-1);
  const shade = new Float32Array(W * H);

  for (let k = 0; k * 3 + 2 < I.length; k++) {
    const a = I[k * 3], b = I[k * 3 + 1], c = I[k * 3 + 2];
    // Facing: screen-space signed area; also keep back faces (two-sided preview) but shade them.
    const ax = (T[a] - tMin) / cell, ay = (yMax - Y[a]) / cell;
    const bx = (T[b] - tMin) / cell, by = (yMax - Y[b]) / cell;
    const cx = (T[c] - tMin) / cell, cy = (yMax - Y[c]) / cell;
    const area = (bx - ax) * (cy - ay) - (cx - ax) * (by - ay);
    if (Math.abs(area) < 1e-9) continue; // edge-on
    if (Math.max(D[a], D[b], D[c]) < minDepth) continue;
    // Lambert-ish shade from the 3D normal's facing component.
    const ux = P[b * 3] - P[a * 3], uy = P[b * 3 + 1] - P[a * 3 + 1], uz = P[b * 3 + 2] - P[a * 3 + 2];
    const wx = P[c * 3] - P[a * 3], wy = P[c * 3 + 1] - P[a * 3 + 1], wz = P[c * 3 + 2] - P[a * 3 + 2];
    const qx = uy * wz - uz * wy, qy = uz * wx - ux * wz, qz = ux * wy - uy * wx;
    const ql = Math.hypot(qx, qy, qz) || 1;
    const facing = Math.abs((qx * nx + qz * nz) / ql), up = Math.abs(qy / ql);
    const s = 0.55 + 0.45 * facing + 0.15 * up;
    const x0 = Math.max(0, Math.floor(Math.min(ax, bx, cx))), x1 = Math.min(W - 1, Math.ceil(Math.max(ax, bx, cx)));
    const y0 = Math.max(0, Math.floor(Math.min(ay, by, cy))), y1 = Math.min(H - 1, Math.ceil(Math.max(ay, by, cy)));
    const m = soup.triMaterial[k];
    for (let py = y0; py <= y1; py++) {
      for (let px = x0; px <= x1; px++) {
        const sx = px + 0.5, sy = py + 0.5;
        const w0 = ((bx - sx) * (cy - sy) - (cx - sx) * (by - sy)) / area;
        const w1 = ((cx - sx) * (ay - sy) - (ax - sx) * (cy - sy)) / area;
        const w2 = 1 - w0 - w1;
        if (w0 < -1e-6 || w1 < -1e-6 || w2 < -1e-6) continue;
        const d = w0 * D[a] + w1 * D[b] + w2 * D[c];
        if (d < minDepth) continue;
        const i = py * W + px;
        if (d > zbuf[i] + 1e-4) { zbuf[i] = d; mat[i] = m; shade[i] = s; }
      }
    }
  }
  return {W, H, cell, tMin, yMax, yMin, mat, shade};
}

/** 4-connected components of a boolean mask; returns pixel bounding boxes and areas. */
function components(mask: Uint8Array, W: number, H: number) {
  const label = new Int32Array(W * H).fill(-1);
  const out: {x0: number; x1: number; y0: number; y1: number; n: number}[] = [];
  const stack: number[] = [];
  for (let s = 0; s < W * H; s++) {
    if (!mask[s] || label[s] >= 0) continue;
    const id = out.length, box = {x0: W, x1: -1, y0: H, y1: -1, n: 0};
    label[s] = id; stack.push(s);
    while (stack.length) {
      const p = stack.pop()!, x = p % W, y = (p - x) / W;
      box.n++; box.x0 = Math.min(box.x0, x); box.x1 = Math.max(box.x1, x); box.y0 = Math.min(box.y0, y); box.y1 = Math.max(box.y1, y);
      for (const q of [x > 0 ? p - 1 : -1, x < W - 1 ? p + 1 : -1, y > 0 ? p - W : -1, y < H - 1 ? p + W : -1]) {
        if (q >= 0 && mask[q] && label[q] < 0) { label[q] = id; stack.push(q); }
      }
    }
    out.push(box);
  }
  return out;
}

/** Morphological closing with a square of radius r pixels (joins panes split by glazing bars). */
function close(mask: Uint8Array, W: number, H: number, r: number) {
  const dil = new Uint8Array(W * H), ero = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    let on = 0;
    for (let dy = -r; dy <= r && !on; dy++) for (let dx = -r; dx <= r; dx++) {
      const xx = x + dx, yy = y + dy;
      if (xx >= 0 && yy >= 0 && xx < W && yy < H && mask[yy * W + xx]) { on = 1; break; }
    }
    dil[y * W + x] = on;
  }
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    let all = 1;
    for (let dy = -r; dy <= r && all; dy++) for (let dx = -r; dx <= r; dx++) {
      const xx = x + dx, yy = y + dy;
      if (xx >= 0 && yy >= 0 && xx < W && yy < H && !dil[yy * W + xx]) { all = 0; break; }
    }
    ero[y * W + x] = all && mask.length ? 1 : 0;
  }
  return ero;
}

/** Group sorted values into clusters whose consecutive gaps are ≤ gap. */
function cluster(values: number[], gap: number) {
  const s = [...values].sort((a, b) => a - b);
  const groups: number[][] = [];
  for (const v of s) {
    const g = groups[groups.length - 1];
    if (g && v - g[g.length - 1] <= gap) g.push(v); else groups.push([v]);
  }
  return groups;
}

export function measureFacade(soup: MaterialSoup, f: FacadeInventory, cell = 0.1): FacadeMeasure {
  const r = renderElevation(soup, f, cell);
  const {W, H, mat, shade} = r;
  const openingNames = new Set((f.openings ?? ['glass']).map(s => s.toLowerCase()));
  const isOpening = soup.materials.map(m => openingNames.has(m.name.toLowerCase()));
  const raw = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) raw[i] = mat[i] >= 0 && isOpening[mat[i]] ? 1 : 0;
  const mask = close(raw, W, H, Math.max(1, Math.round(0.15 / cell)));
  const minArea = 0.15 / (cell * cell);
  const openings: Opening[] = components(mask, W, H)
    .filter(c => c.n >= minArea && (c.x1 - c.x0 + 1) * cell >= 0.25 && (c.y1 - c.y0 + 1) * cell >= 0.3)
    .map(c => ({t0: c.x0 * cell, t1: (c.x1 + 1) * cell, y0: r.yMax - r.yMin - (c.y1 + 1) * cell, y1: r.yMax - r.yMin - c.y0 * cell, area: c.n * cell * cell}));

  // Rows: cluster opening centre heights. Gap of half the median opening height (≥ 0.9 m).
  const hs = openings.map(o => o.y1 - o.y0).sort((a, b) => a - b);
  const medH = hs.length ? hs[Math.floor(hs.length / 2)] : 1;
  const centres = openings.map(o => (o.y0 + o.y1) / 2);
  const rowGroups = cluster(centres, Math.max(0.9, medH * 0.5));
  const rows = rowGroups.map(g => g.length);
  const rowHeights = rowGroups.map(g => +(g.reduce((a, b) => a + b, 0) / g.length).toFixed(1));
  const columns = cluster(openings.map(o => (o.t0 + o.t1) / 2), 0.5).length;

  // Silhouette: any rendered pixel. Symmetry about the silhouette's horizontal centre.
  let sx0 = W, sx1 = -1;
  for (let i = 0; i < W * H; i++) if (mat[i] >= 0) { const x = i % W; sx0 = Math.min(sx0, x); sx1 = Math.max(sx1, x); }
  let inter = 0, uni = 0;
  for (let y = 0; y < H; y++) for (let x = sx0; x <= sx1; x++) {
    const m = sx0 + sx1 - x;
    const a = mask[y * W + x], b = m >= 0 && m < W ? mask[y * W + m] : 0;
    if (a && b) inter++;
    if (a || b) uni++;
  }
  const symmetry = uni ? inter / uni : 1;

  // Gables: peaks in the top profile with ≥ 1.5 m prominence on both sides, at least 2 m wide at half height.
  const top: number[] = [];
  for (let x = 0; x < W; x++) {
    let y = 0;
    while (y < H && mat[y * W + x] < 0) y++;
    top.push(y < H ? (H - y) * cell : 0);
  }
  const gables = countPeaks(top, cell, 1.5);

  const data = new Uint8Array(W * H * 3);
  for (let i = 0; i < W * H; i++) {
    const m = mat[i];
    const rgb: [number, number, number] = m < 0 ? [236, 240, 243] : soup.materials[m].rgb.map(c => Math.min(255, Math.round(c * shade[i]))) as [number, number, number];
    data.set(rgb, i * 3);
  }
  return {
    name: f.name, width: (sx1 - sx0 + 1) * cell, height: (r.yMax - r.yMin), openings, rows, rowHeights, columns,
    symmetry: +symmetry.toFixed(2), gables,
    image: {data, width: W, height: H, cell, tMin: r.tMin, yMax: r.yMax},
  };
}

/** Count peaks in a height profile whose prominence on both sides is at least `prom` metres. */
export function countPeaks(h: number[], cell: number, prom: number) {
  const n = h.length;
  // Smooth over 0.5 m to ignore finials and chimneys.
  const k = Math.max(1, Math.round(0.25 / cell));
  const s = h.map((_, i) => { let a = 0, c = 0; for (let j = i - k; j <= i + k; j++) if (j >= 0 && j < n) { a += h[j]; c++; } return a / c; });
  let peaks = 0;
  let i = 0;
  while (i < n) {
    // Find a plateau maximum.
    let j = i;
    while (j + 1 < n && s[j + 1] === s[i]) j++;
    const v = s[i];
    const leftUp = i === 0 ? false : s[i - 1] > v, rightUp = j === n - 1 ? false : s[j + 1] > v;
    if (!leftUp && !rightUp && v > 0) {
      let lMin = v, rMin = v;
      for (let a = i - 1; a >= 0 && s[a] <= v; a--) lMin = Math.min(lMin, s[a]);
      for (let a = j + 1; a < n && s[a] <= v; a++) rMin = Math.min(rMin, s[a]);
      if (v - lMin >= prom && v - rMin >= prom) peaks++;
    }
    i = j + 1;
  }
  return peaks;
}

export function compare(f: FacadeInventory, m: FacadeMeasure): Check[] {
  const out: Check[] = [];
  if (f.rows) {
    const tol = (n: number) => f.tolerance ?? (n >= 12 ? 1 : 0);
    const sameLength = f.rows.length === m.rows.length;
    const rowsOk = sameLength && f.rows.every((n, i) => Math.abs(n - m.rows[i]) <= tol(n));
    out.push({facade: f.name, what: 'openings per row (bottom→top)', expected: f.rows.join(','), measured: `${m.rows.join(',')} at y≈${m.rowHeights.join(',')} m`, pass: rowsOk});
  }
  if (f.columns !== undefined) out.push({facade: f.name, what: 'window axes', expected: String(f.columns), measured: String(m.columns), pass: Math.abs(f.columns - m.columns) <= (f.tolerance ?? 0)});
  if (f.symmetric !== undefined) {
    const pass = f.symmetric ? m.symmetry >= 0.7 : true;
    out.push({facade: f.name, what: 'mirror symmetry (IoU)', expected: f.symmetric ? '≥ 0.70' : 'asymmetric (report only)', measured: m.symmetry.toFixed(2), pass});
  }
  if (f.gables !== undefined) out.push({facade: f.name, what: 'gable peaks', expected: String(f.gables), measured: String(m.gables), pass: f.gables === m.gables});
  return out;
}
