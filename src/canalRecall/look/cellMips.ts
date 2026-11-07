// A sharper mip chain for the facade colour array (lane R3-B #231, user shot S2 "windows and trim look fuzzy" at
// Da Costakade, Mac DPR 2). Round two measured the owner: the near quay walls sit at 4-16 texels per device pixel, so
// windows are drawn from mips 2-4, and GL's generateMipmap is a 2x2 box per level: by mip 3 a painted frame 2.5-6
// texels wide has been averaged into the glass three times over (a box passes 71 % at half Nyquist per level, 35 %
// after three). Here levels 1..N are built on the CPU instead:
//   - each level from the one above by a Lanczos-3 2:1 kernel (12 taps per axis, separable, wrapped like the
//     RepeatWrapping sampler), which keeps ~95 % at half Nyquist and cuts above it, in linear light (sRGB bytes are
//     decoded, filtered and re-encoded, so a white frame on dark glass keeps its brightness instead of greying);
//     cascaded rather than from level 0 directly, because a direct 2^L kernel costs 6 x size^2 taps per level and layer
//     (~3.5 G multiply-adds for the 222-layer atlas, seconds of main thread) where the cascade is ~0.7 G;
//   - a mild unsharp step on non-wall texels only (the tint mask's R channel, 0 on windows, frames, doors and shutters),
//     so the window edges keep their contrast and the brick does not ring;
//   - the last level (1 x 1) is the exact mean of level 0's bytes, as the facade tier reads it (roofTier.ts textureLod 12):
//     the far colour of every layer is unchanged.
// The alpha channel (the packed accent, look/maskPacking.ts) is filtered linearly without the unsharp step. The tint
// mask array keeps GL's own mips. `?cellMips=0` restores generateMipmap for the colour array too.

export type CellMipOptions = {
  /** Unsharp amount on non-wall texels (0 = none). */
  sharpen?: number;
  /** Filter in linear light (true) or on the sRGB bytes. */
  linear?: boolean;
  /** The 2:1 kernel's lobes: 3 (Lanczos-3, 12 taps) or 2 (Lanczos-2, 8 taps, softer, less ringing). */
  lobes?: 2 | 3;
};

export const CELL_MIP_DEFAULTS: Required<CellMipOptions> = { sharpen: 0.5, linear: true, lobes: 3 };

function pageParam(param: string): string | null {
  try {
    return typeof URLSearchParams === 'function' ? new URLSearchParams((globalThis as { location?: { search?: string } }).location?.search ?? '').get(param) : null;
  } catch { return null; }
}

/** Unasked, the page builds the custom chain when this is true (set from the measured A/B, see the lane's hand-back). */
export const CELL_MIPS_DEFAULT = false;

/** `?cellMips=1|0` (or `window.__canalRecallCellMips = true | false`); unasked CELL_MIPS_DEFAULT. */
export function cellMipsEnabled(): boolean {
  const asked = (globalThis as Record<string, unknown>).__canalRecallCellMips ?? pageParam('cellMips');
  if (asked === false || asked === '0' || asked === 'false' || asked === 'off') return false;
  if (asked === true || asked === '1' || asked === 'true' || asked === 'on') return true;
  return CELL_MIPS_DEFAULT;
}

/**
 * `?cellLodBias=-0.5` (or `window.__canalRecallCellLodBias`): a mip bias on the facade cell sample (roofTier.ts
 * CELL_LOD_BIAS), the cheap alternative to the custom chain; null (no define, no uniform) unless asked.
 */
export function cellLodBiasFlag(): number | null {
  const asked = (globalThis as Record<string, unknown>).__canalRecallCellLodBias ?? pageParam('cellLodBias');
  if (asked == null || asked === '') return null;
  const v = Number(asked);
  return Number.isFinite(v) && v >= -4 && v <= 4 ? v : null;
}

/** `?cellMipSharpen=0.5` overrides the unsharp amount, `?cellMipLinear=0` filters the bytes (A/B knobs). */
export function cellMipOptions(): Required<CellMipOptions> {
  const s = Number(pageParam('cellMipSharpen'));
  const lin = pageParam('cellMipLinear'), lobes = pageParam('cellMipLobes');
  return { sharpen: Number.isFinite(s) && pageParam('cellMipSharpen') != null ? Math.max(0, s) : CELL_MIP_DEFAULTS.sharpen, linear: lin == null ? CELL_MIP_DEFAULTS.linear : lin !== '0', lobes: lobes === '2' ? 2 : lobes === '3' ? 3 : CELL_MIP_DEFAULTS.lobes };
}

/** Lanczos-a 2:1 taps: source offsets -(2a - 0.5) .. (2a - 0.5) around the output texel's centre, normalised. */
export function lanczos2x(a: 2 | 3): Float32Array {
  const sinc = (x: number) => (x === 0 ? 1 : Math.sin(Math.PI * x) / (Math.PI * x));
  const n = 4 * a, w = new Float32Array(n);
  let sum = 0;
  for (let k = 0; k < n; k++) { const d = (k - (n - 1) / 2) / 2; w[k] = sinc(d) * sinc(d / a); sum += w[k]; }
  for (let k = 0; k < n; k++) w[k] /= sum;
  return w;
}
export const LANCZOS3_2X: Float32Array = lanczos2x(3);
const LANCZOS2_2X: Float32Array = lanczos2x(2);

const TO_LINEAR = new Float32Array(256);
for (let i = 0; i < 256; i++) { const v = i / 255; TO_LINEAR[i] = v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }
const ENC_STEPS = 4096;
const TO_SRGB = new Uint8Array(ENC_STEPS + 1);
for (let i = 0; i <= ENC_STEPS; i++) { const v = i / ENC_STEPS; TO_SRGB[i] = Math.round(255 * (v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055)); }
const encode = (v: number) => TO_SRGB[Math.round(Math.min(1, Math.max(0, v)) * ENC_STEPS)];

/** One 2:1 Lanczos-3 step of a square single-channel plane (wrapped), size -> size / 2. */
export function downsample2x(src: Float32Array, size: number, out = new Float32Array((size >> 1) * (size >> 1)), w: Float32Array = LANCZOS3_2X): Float32Array {
  const half = size >> 1, mask = size - 1, taps = w.length, lead = taps / 2 - 1;
  const rows = new Float32Array(half * size);
  // Horizontal: output column j sits between source columns 2j and 2j+1; taps start (taps/2 - 1) columns left of 2j.
  for (let y = 0; y < size; y++) {
    const row = y * size;
    for (let j = 0; j < half; j++) {
      let acc = 0;
      const base = 2 * j - lead;
      for (let k = 0; k < taps; k++) acc += w[k] * src[row + ((base + k) & mask)];
      rows[y * half + j] = acc;
    }
  }
  for (let i = 0; i < half; i++) {
    const base = 2 * i - lead;
    for (let j = 0; j < half; j++) {
      let acc = 0;
      for (let k = 0; k < taps; k++) acc += w[k] * rows[((base + k) & mask) * half + j];
      out[i * half + j] = acc;
    }
  }
  return out;
}

/** 2:1 box of a square plane (the weight mask's chain). */
function box2x(src: Float32Array, size: number): Float32Array {
  const half = size >> 1, out = new Float32Array(half * half);
  for (let i = 0; i < half; i++) for (let j = 0; j < half; j++) {
    const a = 2 * i * size + 2 * j;
    out[i * half + j] = 0.25 * (src[a] + src[a + 1] + src[a + size] + src[a + size + 1]);
  }
  return out;
}

/** In place: v += amount * weight * (v - blur3x3(v)), wrapped. */
function unsharp(v: Float32Array, size: number, weight: Float32Array, amount: number): void {
  if (amount <= 0 || size < 4) return;
  const copy = v.slice(), mask = size - 1;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const i = y * size + x, wgt = weight[i];
    if (wgt <= 0.01) continue;
    const ym = ((y - 1) & mask) * size, yp = ((y + 1) & mask) * size, yc = y * size, xm = (x - 1) & mask, xp = (x + 1) & mask;
    const blur = (4 * copy[i] + 2 * (copy[yc + xm] + copy[yc + xp] + copy[ym + x] + copy[yp + x]) + copy[ym + xm] + copy[ym + xp] + copy[yp + xm] + copy[yp + xp]) / 16;
    v[i] = copy[i] + amount * wgt * (copy[i] - blur);
  }
}

export type CellMipLevels = { size: number; levels: Uint8Array[] };

/** Number of levels below level 0 for a square power-of-two cell. */
export const mipLevelCount = (size: number) => Math.round(Math.log2(size));

/**
 * Levels 1..N (N = log2 size) of one layer of the RGBA colour array. `colour` holds `layer`'s level-0 bytes at
 * `offset`; `wallMask` (optional) the tint mask R bytes of the same texels (255 = wall, no unsharp).
 */
export function layerMips(colour: Uint8Array, offset: number, size: number, wallMask: Uint8Array | null, maskOffset: number, options: Required<CellMipOptions>): Uint8Array[] {
  const n = size * size, levels: Uint8Array[] = [];
  const planes: Float32Array[] = [];
  const toLin = options.linear ? TO_LINEAR : null;
  for (let c = 0; c < 4; c++) {
    const p = new Float32Array(n);
    for (let i = 0; i < n; i++) { const b = colour[offset + i * 4 + c]; p[i] = c < 3 && toLin ? toLin[b] : b / 255; }
    planes.push(p);
  }
  // The exact level-0 mean (the far colour), in bytes.
  const mean = [0, 0, 0, 0];
  for (let i = 0; i < n; i++) for (let c = 0; c < 4; c++) mean[c] += colour[offset + i * 4 + c];
  let weight: Float32Array | null = null;
  if (wallMask && options.sharpen > 0) {
    weight = new Float32Array(n);
    for (let i = 0; i < n; i++) weight[i] = 1 - wallMask[maskOffset + i] / 255;
  }
  let s = size;
  while (s > 1) {
    const h = s >> 1;
    const kernel = options.lobes === 2 ? LANCZOS2_2X : LANCZOS3_2X;
    for (let c = 0; c < 4; c++) planes[c] = downsample2x(planes[c], s, undefined, kernel);
    if (weight) weight = box2x(weight, s);
    s = h;
    const out = new Uint8Array(s * s * 4);
    if (s === 1) {
      for (let c = 0; c < 4; c++) out[c] = Math.round(mean[c] / n);
    } else {
      if (weight) for (let c = 0; c < 3; c++) unsharp(planes[c], s, weight, options.sharpen);
      for (let i = 0; i < s * s; i++) {
        for (let c = 0; c < 3; c++) out[i * 4 + c] = toLin ? encode(planes[c][i]) : Math.round(Math.min(1, Math.max(0, planes[c][i])) * 255);
        out[i * 4 + 3] = Math.round(Math.min(1, Math.max(0, planes[3][i])) * 255);
      }
    }
    levels.push(out);
  }
  return levels;
}

/**
 * Levels 1..N of the whole colour array (`layers` square layers of `size`), each level one buffer of all layers in
 * layer order (the layout texSubImage3D wants). Async: yields to the frame every `sliceMs` of work.
 */
export async function arrayMips(colour: Uint8Array, size: number, layers: number, wallMask: Uint8Array | null, wallChannels: 1 | 2, options = cellMipOptions(), sliceMs = 8, yieldFn: () => Promise<void> = () => new Promise(r => setTimeout(r, 0))): Promise<CellMipLevels> {
  const count = mipLevelCount(size);
  const levels: Uint8Array[] = [];
  for (let l = 1; l <= count; l++) { const s = size >> l; levels.push(new Uint8Array(s * s * 4 * layers)); }
  const n = size * size;
  // The R channel of an RG mask is every other byte: copy it out once per layer.
  let red: Uint8Array | null = wallMask && wallChannels === 1 ? wallMask : null;
  let started = performance.now();
  for (let layer = 0; layer < layers; layer++) {
    let maskOffset = layer * n;
    if (wallMask && wallChannels === 2) { red = new Uint8Array(n); for (let i = 0; i < n; i++) red[i] = wallMask[(layer * n + i) * 2]; maskOffset = 0; }
    const mips = layerMips(colour, layer * n * 4, size, red, maskOffset, options);
    for (let l = 0; l < count; l++) { const s = size >> (l + 1); levels[l].set(mips[l], layer * s * s * 4); }
    if (sliceMs > 0 && performance.now() - started > sliceMs) { await yieldFn(); started = performance.now(); }
  }
  return { size, levels };
}

// ---------------------------------------------------------------------------------------------------------------
// The roll-off chain (lane R3-E #240, the S3 slab moiré). Three lanes measured the owner at the user's S3 pose
// (`s3-slab-user`, the 1962 slab on Weesperstraat, DPR 2): 92 % of the moving pixels are the facade texture on the
// slab's long street wall (#230), seen at 16-32 texels per device pixel (#233), where a window grid whose pitch nears
// two texels at the level read is drawn one texel per pixel and beats against the pixels. GL's 2x2 box chain keeps
// ~71 % of such a grid's contrast per level; R3-B's sharper Lanczos chain made it worse (#231). This chain is the
// converse: levels 1..N from a 2x2 box cascade (GL's own, on the sRGB bytes unless `linear`), and at each level L, per
// layer and per axis, where the layer's window pitch at that level (`pitch / 2^L`) is under `ROLLOFF_PITCH_TEXELS`,
// a wrapped Gaussian (in the cascade's space) whose sigma takes the grid's contrast toward the layer mean: sigma =
// pitch_L / 2 at pitch_L <= 2 (contrast ~1 %), falling to 0 at the threshold (untouched). The cascade continues from the
// rolled-off level, so a grid that has gone stays gone. The last level is the exact level-0 mean (the facade tier's
// textureLod 12 read). Layers whose windows are far apart at the levels the quay houses read (S2: levels 3-4, pitch
// 5-10 texels there) keep GL's levels. The tint mask array (its R is the wall weight, so the window grid is in it too)
// takes the same per-layer blur unless `mask` is off. `?cellRolloff=0` keeps GL's chain for both arrays.

/** Window pitch below which a level is rolled off, in that level's texels (swept 3, 4, 6; see the lane's hand-back). */
export const ROLLOFF_PITCH_TEXELS = 4;
/** Unasked, the page builds the roll-off chain when this is true (both tiers; set from the measured A/B). */
export const CELL_ROLLOFF_DEFAULT = false;

export type CellRolloffOptions = {
  /** ROLLOFF_PITCH_TEXELS: the pitch (level texels) under which the level is blurred. */
  pitch: number;
  /**
   * Cascade and blur in linear light (true, as look/cellMips' Lanczos chain) or on the sRGB bytes like GL's
   * generateMipmap (false): the facade shader decodes after sampling, so GL's levels, trilinear blending and the tier's
   * mean all average the bytes, and an untouched level is then GL's to a byte.
   */
  linear: boolean;
  /** Roll the tint mask array off too. */
  mask: boolean;
};
export const CELL_ROLLOFF_DEFAULTS: CellRolloffOptions = { pitch: ROLLOFF_PITCH_TEXELS, linear: false, mask: true };

/** `?cellRolloff=1|0` (or `window.__canalRecallCellRolloff`); unasked CELL_ROLLOFF_DEFAULT. Off while `cellMips` is on. */
export function cellRolloffEnabled(): boolean {
  if (cellMipsEnabled()) return false;
  const asked = (globalThis as Record<string, unknown>).__canalRecallCellRolloff ?? pageParam('cellRolloff');
  if (asked === false || asked === '0' || asked === 'false' || asked === 'off') return false;
  if (asked === true || asked === '1' || asked === 'true' || asked === 'on') return true;
  return CELL_ROLLOFF_DEFAULT;
}

/** `?cellRolloffPitch=6`, `?cellRolloffLinear=1`, `?cellRolloffMask=0` (A/B knobs). */
export function cellRolloffOptions(): CellRolloffOptions {
  const p = Number(pageParam('cellRolloffPitch')), lin = pageParam('cellRolloffLinear'), mask = pageParam('cellRolloffMask');
  return {
    pitch: pageParam('cellRolloffPitch') != null && Number.isFinite(p) && p > 0 ? p : CELL_ROLLOFF_DEFAULTS.pitch,
    linear: lin == null ? CELL_ROLLOFF_DEFAULTS.linear : lin !== '0',
    mask: mask == null ? CELL_ROLLOFF_DEFAULTS.mask : mask !== '0',
  };
}

/** A layer's dominant window pitch in level-0 texels per axis; Infinity where it has no window grid on that axis. */
export type WindowPitch = { x: number; y: number };
/** A window opening in cell uv (0..1 on both axes). */
export type UvRect = { x0: number; x1: number; y0: number; y1: number };

const median = (v: number[]) => { if (!v.length) return Infinity; const s = [...v].sort((a, b) => a - b), m = s.length >> 1; return s.length & 1 ? s[m] : 0.5 * (s[m - 1] + s[m]); };

/**
 * The periods of the window runs along one wrapped line of `n` texels (`at(i)` the mask R byte, < `cut` = window):
 * the centre-to-centre distances of successive runs at least `minRun` long, wrapping (one run per line: period n).
 * A line with no window run, or no wall texel, has none.
 */
export function runPeriods(at: (i: number) => number, n: number, cut = 128, minRun = 2): number[] {
  let wall = -1;
  for (let i = 0; i < n; i++) if (at(i) >= cut) { wall = i; break; }
  if (wall < 0) return [];
  const centres: number[] = [];
  let start = -1;
  for (let k = 1; k <= n; k++) {
    const i = wall + k, win = at(i % n) < cut;
    if (win && start < 0) start = i;
    if (!win && start >= 0) { if (i - start >= minRun) centres.push(0.5 * (start + i - 1)); start = -1; }
  }
  if (!centres.length) return [];
  if (centres.length === 1) return [n];
  const out: number[] = [];
  for (let k = 0; k < centres.length; k++) out.push(k + 1 < centres.length ? centres[k + 1] - centres[k] : centres[0] + n - centres[k]);
  return out;
}

/**
 * A layer's window pitch from its tint mask (R: 0 on windows, frames, doors and shutters; 255 on wall), `size` square,
 * `channels` bytes per texel with R first: the median run period along every `stride`-th row (x) and column (y).
 */
export function maskWindowPitch(mask: Uint8Array, offset: number, size: number, channels: 1 | 2 = 1, stride = Math.max(1, size >> 5)): WindowPitch {
  const xs: number[] = [], ys: number[] = [];
  for (let r = stride >> 1; r < size; r += stride) {
    xs.push(...runPeriods(i => mask[offset + (r * size + i) * channels], size));
    ys.push(...runPeriods(i => mask[offset + (i * size + r) * channels], size));
  }
  return { x: median(xs), y: median(ys) };
}

/** A layer's window pitch from its window table rects (look/windowTable.ts, uv): wrapped centre spacing per axis. */
export function rectWindowPitch(rects: readonly UvRect[], size: number): WindowPitch {
  if (!rects.length) return { x: Infinity, y: Infinity };
  const axis = (centres: number[]) => {
    const u = [...centres].map(c => ((c % 1) + 1) % 1).sort((a, b) => a - b);
    const merged: number[] = [];
    for (const c of u) if (!merged.length || c - merged[merged.length - 1] > 1 / size) merged.push(c);
    if (merged.length > 1 && merged[0] + 1 - merged[merged.length - 1] <= 1 / size) merged.pop();
    if (merged.length === 1) return size;
    const d: number[] = [];
    for (let k = 0; k < merged.length; k++) d.push(((k + 1 < merged.length ? merged[k + 1] : merged[0] + 1) - merged[k]) * size);
    return median(d);
  };
  return { x: axis(rects.map(r => 0.5 * (r.x0 + r.x1))), y: axis(rects.map(r => 0.5 * (r.y0 + r.y1))) };
}

/**
 * The roll-off blur at a level whose window pitch is `pitchL` of its own texels: 0 at and above `threshold`, rising
 * linearly to pitch_L / 2 at pitch_L = 2 (a Gaussian of sigma P / 2 leaves exp(-pi^2 / 2) < 1 % of a period-P grid),
 * and 1 texel below 2 (that level cannot hold the grid; what is left of it is the cascade's residue).
 */
export function rolloffSigma(pitchL: number, threshold = ROLLOFF_PITCH_TEXELS): number {
  if (!(pitchL < threshold) || !Number.isFinite(pitchL)) return 0;
  if (pitchL <= 2) return 1;
  const w = threshold > 2 ? Math.min(1, Math.max(0, (threshold - pitchL) / (threshold - 2))) : 1;
  return w * pitchL / 2;
}

/** Normalised Gaussian taps for `sigma` (radius ceil(3 sigma)); [1] for sigma 0. */
export function gaussianTaps(sigma: number): Float32Array {
  if (!(sigma > 0)) return Float32Array.of(1);
  const r = Math.max(1, Math.ceil(3 * sigma)), w = new Float32Array(2 * r + 1);
  let sum = 0;
  for (let k = -r; k <= r; k++) { w[k + r] = Math.exp(-(k * k) / (2 * sigma * sigma)); sum += w[k + r]; }
  for (let k = 0; k < w.length; k++) w[k] /= sum;
  return w;
}

/** In place: a separable wrapped Gaussian of sigma `sx` along x and `sy` along y on a square plane. */
export function blurWrapped(v: Float32Array, size: number, sx: number, sy: number): void {
  const mask = size - 1, tmp = new Float32Array(size);
  if (sx > 0) {
    const w = gaussianTaps(sx), r = (w.length - 1) >> 1;
    for (let y = 0; y < size; y++) {
      const row = y * size;
      for (let x = 0; x < size; x++) { let a = 0; for (let k = -r; k <= r; k++) a += w[k + r] * v[row + ((x + k) & mask)]; tmp[x] = a; }
      v.set(tmp, row);
    }
  }
  if (sy > 0) {
    const w = gaussianTaps(sy), r = (w.length - 1) >> 1;
    for (let x = 0; x < size; x++) {
      for (let y = 0; y < size; y++) { let a = 0; for (let k = -r; k <= r; k++) a += w[k + r] * v[((y + k) & mask) * size + x]; tmp[y] = a; }
      for (let y = 0; y < size; y++) v[y * size + x] = tmp[y];
    }
  }
}

export type RolloffLayerLevels = { colour: Uint8Array[]; mask: Uint8Array[] | null; /** Per level (1..N): [sigma x, sigma y]. */ sigmas: [number, number][] };

/**
 * Levels 1..N of one layer: `colour` RGBA bytes at `offset`; `mask` (optional) its tint-mask bytes at `maskOffset`,
 * `maskChannels` per texel, which get the same blur. `pitch` from maskWindowPitch / rectWindowPitch.
 */
export function layerRolloffMips(colour: Uint8Array, offset: number, size: number, pitch: WindowPitch, options: CellRolloffOptions, mask: Uint8Array | null = null, maskOffset = 0, maskChannels: 1 | 2 = 1): RolloffLayerLevels {
  const n = size * size, lin = options.linear;
  // RGB in the cascade's space (linear light, or sRGB 0..1 as GL's box sees the bytes); alpha (the packed accent) linear.
  let planes: Float32Array[] = [0, 1, 2, 3].map(c => {
    const p = new Float32Array(n);
    for (let i = 0; i < n; i++) { const b = colour[offset + i * 4 + c]; p[i] = c < 3 && lin ? TO_LINEAR[b] : b / 255; }
    return p;
  });
  let mplanes: Float32Array[] | null = mask ? Array.from({ length: maskChannels }, (_, c) => {
    const p = new Float32Array(n);
    for (let i = 0; i < n; i++) p[i] = mask[maskOffset + i * maskChannels + c] / 255;
    return p;
  }) : null;
  const mean = [0, 0, 0, 0], mmean = [0, 0];
  for (let i = 0; i < n; i++) for (let c = 0; c < 4; c++) mean[c] += colour[offset + i * 4 + c];
  if (mask) for (let i = 0; i < n; i++) for (let c = 0; c < maskChannels; c++) mmean[c] += mask[maskOffset + i * maskChannels + c];
  const out: RolloffLayerLevels = { colour: [], mask: mask ? [] : null, sigmas: [] };
  let s = size, level = 0;
  while (s > 1) {
    planes = planes.map(p => box2x(p, s));
    if (mplanes) mplanes = mplanes.map(p => box2x(p, s));
    s >>= 1; level++;
    const k = 2 ** level, sx = s > 1 ? rolloffSigma(pitch.x / k, options.pitch) : 0, sy = s > 1 ? rolloffSigma(pitch.y / k, options.pitch) : 0;
    out.sigmas.push([+sx.toFixed(3), +sy.toFixed(3)]);
    if (sx > 0 || sy > 0) {
      // The blur in the cascade's own space: a rolled-off grid then has the tone GL's neighbouring levels and the
      // tier's mean give it (a linear-light blur of dark glass and pale wall comes out ~40 levels brighter than the
      // byte box beside it, a tone step with distance).
      for (const p of planes) blurWrapped(p, s, Math.min(sx, s / 2), Math.min(sy, s / 2));
      if (mplanes) for (const p of mplanes) blurWrapped(p, s, Math.min(sx, s / 2), Math.min(sy, s / 2));
    }
    const bytes = new Uint8Array(s * s * 4);
    if (s === 1) for (let c = 0; c < 4; c++) bytes[c] = Math.round(mean[c] / n);
    else for (let i = 0; i < s * s; i++) {
      for (let c = 0; c < 3; c++) bytes[i * 4 + c] = lin ? encode(planes[c][i]) : Math.round(Math.min(1, Math.max(0, planes[c][i])) * 255);
      bytes[i * 4 + 3] = Math.round(Math.min(1, Math.max(0, planes[3][i])) * 255);
    }
    out.colour.push(bytes);
    if (mplanes && out.mask) {
      const m = new Uint8Array(s * s * maskChannels);
      if (s === 1) for (let c = 0; c < maskChannels; c++) m[c] = Math.round(mmean[c] / n);
      else for (let i = 0; i < s * s; i++) for (let c = 0; c < maskChannels; c++) m[i * maskChannels + c] = Math.round(Math.min(1, Math.max(0, mplanes[c][i])) * 255);
      out.mask.push(m);
    }
  }
  return out;
}

export type RolloffArrayLevels = {
  size: number;
  colour: Uint8Array[];
  mask: Uint8Array[] | null;
  maskChannels: 1 | 2;
  /** Per layer: the pitch used and the first level (1..N) it was rolled off at (0: never). */
  layers: { pitch: WindowPitch; from: number; source: 'table' | 'mask' | 'none' }[];
};

/**
 * Levels 1..N of the whole colour array (and, when given, the tint mask array) with the roll-off, each level one
 * buffer of all layers in layer order. `pitchMask` / `pitchMaskChannels`: the mask bytes the pitch is read from (R
 * first); `rects(layer)` the window table's openings where a layer has them (else the mask decides). Async: yields
 * every `sliceMs` of work.
 */
export async function arrayRolloffMips(colour: Uint8Array, size: number, layers: number, opts: {
  options?: CellRolloffOptions;
  pitchMask: Uint8Array | null; pitchMaskChannels: 1 | 2;
  mask?: Uint8Array | null; maskChannels?: 1 | 2;
  rects?: (layer: number) => readonly UvRect[] | null;
  sliceMs?: number; yieldFn?: () => Promise<void>;
}): Promise<RolloffArrayLevels> {
  const options = opts.options ?? cellRolloffOptions(), sliceMs = opts.sliceMs ?? 8, yieldFn = opts.yieldFn ?? (() => new Promise<void>(r => setTimeout(r, 0)));
  const mask = options.mask ? opts.mask ?? null : null, maskChannels = opts.maskChannels ?? 1;
  const count = mipLevelCount(size), n = size * size;
  const colourLevels: Uint8Array[] = [], maskLevels: Uint8Array[] | null = mask ? [] : null;
  for (let l = 1; l <= count; l++) { const s = size >> l; colourLevels.push(new Uint8Array(s * s * 4 * layers)); maskLevels?.push(new Uint8Array(s * s * maskChannels * layers)); }
  const info: RolloffArrayLevels['layers'] = [];
  let started = performance.now();
  for (let layer = 0; layer < layers; layer++) {
    const rects = opts.rects?.(layer);
    let pitch: WindowPitch = { x: Infinity, y: Infinity }, source: 'table' | 'mask' | 'none' = 'none';
    if (rects && rects.length) { pitch = rectWindowPitch(rects, size); source = 'table'; }
    else if (opts.pitchMask) { pitch = maskWindowPitch(opts.pitchMask, layer * n * opts.pitchMaskChannels, size, opts.pitchMaskChannels); source = 'mask'; }
    const got = layerRolloffMips(colour, layer * n * 4, size, pitch, options, mask, layer * n * maskChannels, maskChannels);
    for (let l = 0; l < count; l++) {
      const s = size >> (l + 1);
      colourLevels[l].set(got.colour[l], layer * s * s * 4);
      if (maskLevels && got.mask) maskLevels[l].set(got.mask[l], layer * s * s * maskChannels);
    }
    const first = got.sigmas.findIndex(([x, y]) => x > 0 || y > 0);
    info.push({ pitch, from: first < 0 ? 0 : first + 1, source });
    if (sliceMs > 0 && performance.now() - started > sliceMs) { await yieldFn(); started = performance.now(); }
  }
  return { size, colour: colourLevels, mask: maskLevels, maskChannels, layers: info };
}

/**
 * Diagnosis (`setCellMipDebug`): levels 0..N of an array where every texel of level L is LEVEL_DEBUG_RGB[L], so a
 * frame shows which level the sampler reads (trilinear blends neighbours: the hue between two). Level 0 red through
 * level 5 magenta around the hue circle, 6 and beyond white.
 */
export const LEVEL_DEBUG_RGB: readonly (readonly [number, number, number])[] = [[255, 0, 0], [255, 255, 0], [0, 255, 0], [0, 255, 255], [0, 0, 255], [255, 0, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255]];
export function debugLevels(size: number, layers: number, channels: 1 | 2 | 4, fill: (level: number) => readonly number[]): Uint8Array[] {
  const out: Uint8Array[] = [];
  for (let l = 0, s = size; s >= 1; l++, s >>= 1) {
    const v = fill(l), b = new Uint8Array(s * s * channels * layers);
    for (let i = 0; i < b.length; i += channels) for (let c = 0; c < channels; c++) b[i + c] = v[c] ?? 255;
    out.push(b);
  }
  return out;
}

/** The fractional level a debug-coloured pixel shows: hue / 60 degrees on saturated pixels, >= 5.5 on pale ones; null on dark ones. */
export function debugLevelOf(r: number, g: number, b: number): number | null {
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
  if (mx < 24) return null;
  const sat = (mx - mn) / mx;
  if (sat < 0.25) return 6;
  let h: number;
  if (mx === r) h = ((g - b) / (mx - mn) + 6) % 6; else if (mx === g) h = (b - r) / (mx - mn) + 2; else h = (r - g) / (mx - mn) + 4;
  // Magenta (5) wraps to red (0) on the hue circle; level 0 never borders level 5, so hue > 5.5 is level 5 paling toward 6.
  return h > 5.5 ? 5.5 + (1 - sat) : h;
}

/**
 * `?cellTierBand=24,45` (measurement only, lane R3-E #240): the facade tier's flatten band (roofTier.ts
 * FACADE_TIER_FROM/TO_TEXELS) given as texels per device pixel at DPR 2, i.e. the constants x 2; it scales with the
 * ratio and the texture policy's tierScale exactly as they do. null unless asked (the constants decide).
 */
export function cellTierBandFlag(): [number, number] | null {
  const asked = (globalThis as Record<string, unknown>).__canalRecallCellTierBand ?? pageParam('cellTierBand');
  if (asked == null || asked === '') return null;
  const v = (Array.isArray(asked) ? asked : String(asked).split(',')).map(Number);
  return v.length === 2 && v.every(Number.isFinite) && v[0] > 0 && v[1] > v[0] ? [v[0], v[1]] : null;
}
/** The tier uniform for a band given at DPR 2 (cellTierBandFlag), at `pixelRatio` and `tierScale`. */
export function cellTierFromBand(band: readonly [number, number], pixelRatio = 1, tierScale = 1): [number, number] {
  const k = (Number.isFinite(pixelRatio) && pixelRatio > 1 ? pixelRatio : 1) * (Number.isFinite(tierScale) && tierScale > 0 ? tierScale : 1) / 2;
  return [band[0] * k, band[1] * k];
}

/**
 * Diagnosis (`setCellLayerDebug`): an RGB per layer whose hue carries one base-16 digit of the layer index (digit 0:
 * layer & 15, digit 1: layer >> 4), so two frames name the layer drawn at each pixel. `layerDigitOf` reads it back.
 */
export function layerDigitRgb(layer: number, digit: 0 | 1): [number, number, number] {
  const d = digit ? (layer >> 4) & 15 : layer & 15, h = d / 16 * 6, x = 1 - Math.abs((h % 2) - 1);
  const [r, g, b] = h < 1 ? [1, x, 0] : h < 2 ? [x, 1, 0] : h < 3 ? [0, 1, x] : h < 4 ? [0, x, 1] : h < 5 ? [x, 0, 1] : [1, 0, x];
  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}
export function layerDigitOf(r: number, g: number, b: number): number | null {
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
  if (mx < 24 || (mx - mn) / mx < 0.5) return null;
  let h: number;
  if (mx === r) h = ((g - b) / (mx - mn) + 6) % 6; else if (mx === g) h = (b - r) / (mx - mn) + 2; else h = (r - g) / (mx - mn) + 4;
  return Math.round(h / 6 * 16) % 16;
}
